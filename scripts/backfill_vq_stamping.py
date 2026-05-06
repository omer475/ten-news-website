"""
Backfill vq_primary / vq_secondary on published_articles where they're NULL.

Trinity Step 12 stamping silently failed in production from 2026-05-01 onward,
leaving ~4,900 articles untagged. This script retroactively stamps them by
calling the same `assign_vq_clusters()` function the live pipeline uses.

This script also serves as a diagnostic — if it succeeds, the projection
function works in isolation, meaning the live failure is a Cloud Run
runtime issue (env, deps, or supabase client). If it fails, the error
output identifies the exact cause.

Usage:
  python scripts/backfill_vq_stamping.py [--since 2026-05-01] [--batch-size 100] [--dry-run] [--yes]

Env required:
  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
  SUPABASE_SERVICE_KEY
"""

import os
import sys
import time
import argparse
import traceback
from collections import Counter

from supabase import create_client

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')


# ────────────────────────────────────────────────────────────────────────
# VQ projection — copy of complete_clustered_8step_workflow.py:330-440.
#
# We inline rather than import because the workflow file raises at module-
# init when pipeline-only API keys (GEMINI_API_KEY, BRIGHTDATA_API_KEY) are
# missing — the backfill needs neither. Keep BYTE-IDENTICAL to the
# workflow's so this script behaves the same as the live pipeline.
# ────────────────────────────────────────────────────────────────────────

_VQ_CODEBOOK_CACHE = {'ts': 0, 'codebook': None}
_VQ_CACHE_TTL_S = 300


def _l2_normalize(vec):
    import numpy as np
    a = np.asarray(vec, dtype=np.float32)
    n = float(np.linalg.norm(a))
    if n == 0.0:
        return a
    return a / n


def _load_active_codebook(supabase_client):
    now = time.time()
    if _VQ_CODEBOOK_CACHE['codebook'] and (now - _VQ_CODEBOOK_CACHE['ts']) < _VQ_CACHE_TTL_S:
        return _VQ_CODEBOOK_CACHE['codebook']
    try:
        resp = (supabase_client.table('vq_codebooks')
                .select('id, version, parent_map, dim')
                .eq('is_active', True)
                .order('trained_at', desc=True)
                .limit(1)
                .execute())
        rows = resp.data or []
        if not rows:
            print('   ⚠️ FAIL_REASON=no_active_codebook')
            return None
        import numpy as np
        cb = rows[0]
        codebook_id = cb['id']
        dim = cb['dim']
        # supabase-py defaults to a 1000-row PostgREST pagination cap.
        # Codebook has 256 L1 + 2048 L2 = 2304 centroid rows, so an
        # un-paginated query silently truncates to 1000 (256 L1 + 744 L2)
        # and the resulting l2 array is shape (744, dim) instead of
        # (2048, dim) — projection fails with "argmin of empty sequence"
        # for any L1 code whose sub-residual base ≥ 744. ROOT CAUSE of
        # the silent stamping failure since 2026-05-01.
        cent_rows = []
        page_size = 1000
        offset = 0
        while True:
            cent_resp = (supabase_client.table('vq_centroids')
                         .select('level, idx, vec')
                         .eq('codebook_id', codebook_id)
                         .range(offset, offset + page_size - 1)
                         .execute())
            page = cent_resp.data or []
            cent_rows.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
        if not cent_rows:
            print(f'   ⚠️ FAIL_REASON=no_centroids codebook_id={codebook_id}')
            return None

        def _parse_vec(v):
            if isinstance(v, list):
                return v
            s = str(v).strip().lstrip('[').rstrip(']')
            return [float(x) for x in s.split(',')] if s else []

        l1_rows = [r for r in cent_rows if r['level'] == 1]
        l2_rows = [r for r in cent_rows if r['level'] == 2]
        l1_size = max((r['idx'] for r in l1_rows), default=-1) + 1
        l2_size = max((r['idx'] for r in l2_rows), default=-1) + 1
        if l1_size == 0 or l2_size == 0:
            print(f'   ⚠️ FAIL_REASON=empty_centroid_levels l1={len(l1_rows)} l2={len(l2_rows)}')
            return None
        l1 = np.zeros((l1_size, dim), dtype=np.float32)
        l2 = np.zeros((l2_size, dim), dtype=np.float32)
        for r in l1_rows:
            l1[r['idx']] = _parse_vec(r['vec'])
        for r in l2_rows:
            l2[r['idx']] = _parse_vec(r['vec'])
        cooked = {
            'id': codebook_id,
            'version': cb['version'],
            'l1': l1,
            'l2': l2,
            'parent_map': cb['parent_map'],
            'dim': dim,
        }
        _VQ_CODEBOOK_CACHE['ts'] = now
        _VQ_CODEBOOK_CACHE['codebook'] = cooked
        return cooked
    except Exception as e:
        print(f'   ⚠️ FAIL_REASON=codebook_fetch_exception type={type(e).__name__} msg={e}')
        traceback.print_exc()
        return None


def assign_vq_clusters(embedding_minilm, supabase_client):
    """Project a 384-d MiniLM embedding into (vq_primary, vq_secondary)."""
    if embedding_minilm is None:
        return None, None
    cb = _load_active_codebook(supabase_client)
    if cb is None:
        return None, None
    try:
        import numpy as np
        v = _l2_normalize(embedding_minilm)
        if v.shape[0] != cb['dim']:
            return None, None
        d1 = np.linalg.norm(cb['l1'] - v[None, :], axis=1)
        c1 = int(np.argmin(d1))
        residual = v - cb['l1'][c1]
        SUBCODEBOOK_K = 8
        base = c1 * SUBCODEBOOK_K
        sub_residuals = cb['l2'][base : base + SUBCODEBOOK_K]
        d2 = np.linalg.norm(sub_residuals - residual[None, :], axis=1)
        local = int(np.argmin(d2))
        c2 = base + local
        return c1, c2
    except Exception as e:
        print(f'   ⚠️ FAIL_REASON=projection_exception type={type(e).__name__} msg={e}')
        return None, None
# ────────────────────────────────────────────────────────────────────────


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--since', default='2026-05-01', help='Only backfill articles created on/after this date (ISO).')
    p.add_argument('--batch-size', type=int, default=100, help='Rows per fetch+update batch.')
    p.add_argument('--dry-run', action='store_true', help='Compute codes but do not write back.')
    p.add_argument('--yes', action='store_true', help='Skip confirmation prompt.')
    p.add_argument('--limit', type=int, default=None, help='Stop after N rows (for testing).')
    return p.parse_args()


def main():
    args = parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env.')
        sys.exit(2)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Diagnose the codebook first so we fail fast with a clear message.
    print('=' * 70)
    print('VQ stamping backfill — diagnostic + repair tool')
    print('=' * 70)
    print(f'Supabase URL: {SUPABASE_URL}')
    print(f'Since:        {args.since}')
    print(f'Batch size:   {args.batch_size}')
    print(f'Dry run:      {args.dry_run}')
    print()
    print('Loading active codebook...')
    cb = _load_active_codebook(sb)
    if cb is None:
        print('FATAL: codebook load failed. See log lines above for FAIL_REASON.')
        sys.exit(3)
    print(f'  ✓ codebook id={cb["id"]} version={cb["version"]} dim={cb["dim"]} '
          f'l1={cb["l1"].shape} l2={cb["l2"].shape}')

    # Count target rows.
    count_resp = (sb.table('published_articles')
                  .select('id', count='exact')
                  .is_('vq_primary', 'null')
                  .gte('created_at', args.since)
                  .limit(1)
                  .execute())
    total = count_resp.count or 0
    print(f'\nTarget rows (vq_primary IS NULL AND created_at >= {args.since}): {total}')

    if total == 0:
        print('Nothing to do. Exiting.')
        return

    if args.limit and args.limit < total:
        print(f'  (capped to --limit {args.limit})')

    if not args.dry_run and not args.yes:
        ans = input(f'\nWILL UPDATE up to {total} rows in production. Type "yes" to proceed: ').strip()
        if ans != 'yes':
            print('Aborted.')
            return

    # Stream + stamp.
    success = 0
    fail = 0
    fail_reasons = Counter()
    t0 = time.time()
    last_id = 0  # keyset pagination on id ascending

    while True:
        if args.limit and (success + fail) >= args.limit:
            break

        q = (sb.table('published_articles')
             .select('id, embedding_minilm, title_news, created_at')
             .is_('vq_primary', 'null')
             .gte('created_at', args.since)
             .gt('id', last_id)
             .order('id')
             .limit(args.batch_size))
        resp = q.execute()
        rows = resp.data or []
        if not rows:
            break

        for r in rows:
            last_id = r['id']
            emb = r.get('embedding_minilm')
            # Supabase pgvector returns either list or string '[..]'.
            if isinstance(emb, str):
                s = emb.strip().lstrip('[').rstrip(']')
                if s:
                    try:
                        emb = [float(x) for x in s.split(',')]
                    except Exception as e:
                        fail += 1
                        fail_reasons[f'embed_parse_{type(e).__name__}'] += 1
                        continue
                else:
                    emb = None
            if emb is None:
                fail += 1
                fail_reasons['embed_null'] += 1
                continue

            c1, c2 = assign_vq_clusters(emb, sb)
            if c1 is None:
                fail += 1
                fail_reasons['assign_returned_null'] += 1
                continue

            if not args.dry_run:
                try:
                    (sb.table('published_articles')
                     .update({'vq_primary': c1, 'vq_secondary': c2})
                     .eq('id', r['id'])
                     .execute())
                except Exception as e:
                    fail += 1
                    fail_reasons[f'update_{type(e).__name__}'] += 1
                    continue
            success += 1

            if (success + fail) % 100 == 0:
                rate = (success + fail) / max(time.time() - t0, 1e-3)
                print(f'  progress: {success + fail}/{total}  success={success}  fail={fail}  '
                      f'rate={rate:.1f}/s  last_id={last_id}')

        if args.limit and (success + fail) >= args.limit:
            break

    elapsed = time.time() - t0
    print()
    print('=' * 70)
    print(f'Done in {elapsed:.1f}s.')
    print(f'  success: {success}')
    print(f'  fail:    {fail}')
    if fail_reasons:
        print('  fail reasons:')
        for reason, n in fail_reasons.most_common():
            print(f'    {n:>5}  {reason}')
    if args.dry_run:
        print('  (DRY RUN — no rows were updated)')


if __name__ == '__main__':
    main()

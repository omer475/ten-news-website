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
from collections import Counter

# Allow importing from the repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from complete_clustered_8step_workflow import (
    assign_vq_clusters,
    _load_active_codebook,
)

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')


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

"""
Retry-only backfill for any articles still missing a global cluster assignment.

After the main global_cluster_builder run finishes, some articles may remain
with NULL super_cluster_id / leaf_cluster_id because of transient "Server
disconnected" errors under parallel REST load. This script picks them up
using cached centroids from global_cluster_centroids.

Usage:
  python3 services/backfill_cluster_retry.py

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os
import sys
import time
import logging
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional
from supabase import create_client

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from step1_5_event_clustering import get_embedding_minilm
    HAS_EMBEDDING_HELPER = True
except Exception as _e:
    HAS_EMBEDDING_HELPER = False
    print(f"⚠️  Embedding helper import failed: {_e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [cluster-retry] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)

SUPER_K = 10
LEAF_K = 10
TOP_K = 3
WORKERS = 12  # lower than main run — reduces connection pressure
WINDOW_DAYS = 90


def sb_client():
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    return create_client(url, key)


def load_leaf_centroids(sb) -> np.ndarray:
    """Return (10, 10, 384) leaf centroid array."""
    resp = sb.table('global_cluster_centroids').select('*').execute()
    rows = resp.data or []
    leaf_centroids = np.zeros((SUPER_K, LEAF_K, 384), dtype=np.float32)
    for r in rows:
        if r.get('leaf_cluster_id') is None:
            continue
        cent = r['centroid']
        if isinstance(cent, str):
            cent = [float(x) for x in cent.strip('[]').split(',')]
        leaf_centroids[r['super_cluster_id'], r['leaf_cluster_id']] = np.asarray(cent, dtype=np.float32)
    log.info(f"loaded leaf centroids, shape={leaf_centroids.shape}")
    return leaf_centroids


def load_unclustered_articles(sb) -> List[dict]:
    """Load id + embedding for articles still missing super_cluster_id in the 90-day window."""
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)).isoformat()
    PAGE = 1000
    offset = 0
    out = []
    while True:
        resp = (sb.table('published_articles')
                .select('id, embedding_minilm, title_news, summary_bullets_news')
                .is_('super_cluster_id', 'null')
                .gte('published_at', cutoff)
                .range(offset, offset + PAGE - 1)
                .execute())
        rows = resp.data or []
        if not rows:
            break
        out.extend(rows)
        offset += PAGE
        log.info(f"  paged: collected {len(out)} unclustered articles so far")
        if len(rows) < PAGE:
            break
    log.info(f"found {len(out)} unclustered articles")
    return out


def assign_for_embedding(emb: List[float], leaf_centroids: np.ndarray):
    flat = leaf_centroids.reshape(SUPER_K * LEAF_K, -1)
    super_idx = np.repeat(np.arange(SUPER_K), LEAF_K)
    leaf_idx = np.tile(np.arange(LEAF_K), SUPER_K)

    vec = np.asarray(emb, dtype=np.float32)
    vec_norm = vec / (np.linalg.norm(vec) + 1e-12)
    flat_norms = np.linalg.norm(flat, axis=1, keepdims=True) + 1e-12
    flat_n = flat / flat_norms
    sims = flat_n @ vec_norm

    top1 = int(np.argmax(sims))
    primary_super = int(super_idx[top1])
    primary_leaf = int(leaf_idx[top1])

    top_k_idx = np.argpartition(-sims, kth=min(TOP_K, len(sims)-1))[:TOP_K]
    top_k_sims = sims[top_k_idx]
    order = np.argsort(-top_k_sims)
    top_k_idx_sorted = top_k_idx[order]
    top_k_sims_sorted = top_k_sims[order]
    clipped = np.clip(top_k_sims_sorted, 0.0, None)
    total = clipped.sum()
    if total == 0:
        return primary_super, primary_leaf, []
    weights = clipped / total

    assigns = []
    for k in range(min(TOP_K, len(top_k_idx_sorted))):
        cidx = int(top_k_idx_sorted[k])
        w = float(weights[k])
        if w < 0.01:
            continue
        assigns.append({'super': int(super_idx[cidx]), 'leaf': int(leaf_idx[cidx]), 'weight': round(w, 4)})
    return primary_super, primary_leaf, assigns


def main():
    sb = sb_client()
    log.info("=== CLUSTER RETRY BACKFILL — START ===")
    t0 = time.time()

    leaf_centroids = load_leaf_centroids(sb)
    articles = load_unclustered_articles(sb)
    if not articles:
        log.info("no unclustered articles — nothing to do")
        return

    # Compute missing embeddings for any UGC/etc. that lack them
    missing_emb = [a for a in articles if not a.get('embedding_minilm')]
    if missing_emb and HAS_EMBEDDING_HELPER:
        log.info(f"computing {len(missing_emb)} missing embeddings (sequential, may be slow)")
        for a in missing_emb:
            title = a.get('title_news') or ''
            bullets = a.get('summary_bullets_news')
            if isinstance(bullets, list):
                text = f"{title}\n" + "\n".join(str(b) for b in bullets[:5])
            else:
                text = title
            emb = get_embedding_minilm(text)
            if emb:
                a['embedding_minilm'] = emb
                try:
                    sb.table('published_articles').update({'embedding_minilm': emb}).eq('id', a['id']).execute()
                except Exception:
                    pass

    # Assign + update
    def _assign_and_write(a):
        emb = a.get('embedding_minilm')
        if not emb or len(emb) != 384:
            return False
        ps, pl, assigns = assign_for_embedding(emb, leaf_centroids)
        try:
            sb.table('published_articles').update({
                'super_cluster_id': ps,
                'leaf_cluster_id': pl,
                'cluster_assignments': assigns,
            }).eq('id', a['id']).execute()
            return True
        except Exception as e:
            log.warning(f"  update failed for id={a['id']}: {e}")
            return False

    ok, fail = 0, 0
    last_log = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for r in pool.map(_assign_and_write, articles, chunksize=1):
            if r:
                ok += 1
            else:
                fail += 1
            now = time.time()
            if now - last_log >= 5.0:
                log.info(f"  progress: {ok}/{len(articles)} ok, {fail} failed")
                last_log = now

    log.info(f"=== DONE in {time.time() - t0:.1f}s — {ok} updated, {fail} failed ===")


if __name__ == '__main__':
    main()

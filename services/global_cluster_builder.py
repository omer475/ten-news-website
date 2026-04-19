"""
Global Hierarchical Cluster Builder — nightly Cloud Run job.

Replaces per-user 7-cluster Ward clustering with TikTok-style shared global
topic clusters. Rebuilds centroids from the last-90-day article corpus and
assigns every article to its top-3 nearest leaves (multi-label).

Structure:
  - 10 super-cluster centroids (level 1)
  - 10 leaf centroids per super-cluster = 100 leaves total (level 2)

Each article gets:
  - super_cluster_id (nearest super-centroid)
  - leaf_cluster_id (nearest leaf within its super)
  - cluster_assignments: JSONB list of top-3 (super, leaf, weight) tuples
    across all 100 leaves, weights normalized to sum = 1.0

Run daily at 3 AM UTC via Cloud Scheduler → Cloud Run Job.

Env required:
  SUPABASE_URL, SUPABASE_SERVICE_KEY

Usage:
  python3 services/global_cluster_builder.py         # full rebuild (default)
  python3 services/global_cluster_builder.py --dry   # log stats, don't write
"""

import os
import sys
import time
import math
import argparse
import logging
import numpy as np
from datetime import datetime, timezone
from typing import List, Tuple, Optional

from sklearn.cluster import KMeans
from supabase import create_client

# Allow importing the MiniLM helper for UGC articles missing embeddings.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from step1_5_event_clustering import get_embeddings_minilm_batch
    HAS_EMBEDDING_HELPER = True
except Exception as _e:
    HAS_EMBEDDING_HELPER = False
    print(f"⚠️  Embedding helper import failed: {_e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [global-cluster] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


# --- Config ---
SUPER_K = 10
LEAF_K = 10
WINDOW_DAYS = 90
MIN_ARTICLE_SCORE = 0          # include UGC (ai_final_score=500) and news
TOP_N_LEAVES_PER_ARTICLE = 3   # multi-label top-K
KMEANS_N_INIT = 5
KMEANS_RANDOM_STATE = 42
BATCH_SIZE_UPDATE = 500        # per UPDATE batch to keep requests small


def supabase_client():
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    return create_client(url, key)


def load_article_embeddings(sb) -> Tuple[List[int], np.ndarray, List[int]]:
    """Load (id, embedding) for articles in the 90-day window.

    Returns:
      ids: list of article ids (aligned with embeddings rows)
      embeddings: (N, 384) ndarray
      missing_ids: list of ids that had embedding_minilm == NULL
    """
    cutoff_iso = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=WINDOW_DAYS)).isoformat()
    log.info(f"loading articles with published_at >= {cutoff_iso}")

    # Supabase REST caps rows per request; page via range.
    PAGE = 1000
    offset = 0
    ids: List[int] = []
    embs: List[List[float]] = []
    missing: List[int] = []
    missing_texts: List[Tuple[int, str]] = []

    while True:
        resp = (sb.table('published_articles')
                .select('id, embedding_minilm, title_news, summary_bullets_news')
                .gte('published_at', cutoff_iso)
                .gte('ai_final_score', MIN_ARTICLE_SCORE)
                .range(offset, offset + PAGE - 1)
                .execute())
        rows = resp.data or []
        if not rows:
            break
        for r in rows:
            emb = r.get('embedding_minilm')
            if emb and isinstance(emb, list) and len(emb) == 384:
                ids.append(r['id'])
                embs.append(emb)
            else:
                missing.append(r['id'])
                # Build fallback text for on-the-fly embedding of UGC
                title = r.get('title_news') or ''
                bullets = r.get('summary_bullets_news')
                if isinstance(bullets, str):
                    text = f"{title}\n{bullets}"
                elif isinstance(bullets, list):
                    text = f"{title}\n" + "\n".join(str(b) for b in bullets[:5])
                else:
                    text = title
                missing_texts.append((r['id'], text))
        offset += PAGE
        log.info(f"  paged: have {len(ids)} with embedding, {len(missing)} missing")
        if len(rows) < PAGE:
            break

    # Compute embeddings for articles missing them (UGC etc.)
    if missing_texts and HAS_EMBEDDING_HELPER:
        log.info(f"computing {len(missing_texts)} missing embeddings via MiniLM batch")
        texts = [t for _, t in missing_texts]
        computed = get_embeddings_minilm_batch(texts)
        new_embeddings_to_write: List[Tuple[int, List[float]]] = []
        for (aid, _), emb in zip(missing_texts, computed):
            if emb is not None and len(emb) == 384:
                ids.append(aid)
                embs.append(emb)
                new_embeddings_to_write.append((aid, emb))
        # Persist new UGC embeddings so they don't need re-computing next night
        if new_embeddings_to_write:
            log.info(f"persisting {len(new_embeddings_to_write)} newly-computed embeddings")
            for i in range(0, len(new_embeddings_to_write), 200):
                chunk = new_embeddings_to_write[i:i+200]
                for aid, emb in chunk:
                    try:
                        sb.table('published_articles').update({
                            'embedding_minilm': emb
                        }).eq('id', aid).execute()
                    except Exception as e:
                        log.warning(f"  failed to persist embedding for {aid}: {e}")

    if not embs:
        raise RuntimeError("no article embeddings found in window; cannot cluster")

    arr = np.asarray(embs, dtype=np.float32)
    log.info(f"loaded {len(ids)} articles with embeddings, shape={arr.shape}")
    return ids, arr, missing


def run_kmeans(embs: np.ndarray, k: int, label: str) -> Tuple[KMeans, np.ndarray]:
    """Run k-means and return (model, cluster-assignments-per-row)."""
    log.info(f"  kmeans[{label}] k={k} on n={len(embs)}")
    t0 = time.time()
    km = KMeans(
        n_clusters=k,
        n_init=KMEANS_N_INIT,
        random_state=KMEANS_RANDOM_STATE,
        verbose=0,
    )
    labels = km.fit_predict(embs)
    dt = time.time() - t0
    log.info(f"  kmeans[{label}] done in {dt:.1f}s, centroids shape={km.cluster_centers_.shape}")
    return km, labels


def build_hierarchy(ids: List[int], embs: np.ndarray):
    """Run 2-level k-means: super-clusters, then leaves per super.

    Returns:
      super_centroids: (10, 384)
      leaf_centroids:  (10, 10, 384)  — leaf_centroids[s, l]
      super_assignment: (N,) — which super each article is in
      leaf_assignment:  (N,) — which leaf within its super
      leaf_counts:     (10, 10) — number of articles per leaf
    """
    # Level 1: super-clusters
    super_km, super_labels = run_kmeans(embs, SUPER_K, "super")
    super_centroids = super_km.cluster_centers_.astype(np.float32)

    # Level 2: leaf centroids within each super-cluster
    leaf_centroids = np.zeros((SUPER_K, LEAF_K, embs.shape[1]), dtype=np.float32)
    leaf_labels = np.zeros(len(embs), dtype=np.int32)
    leaf_counts = np.zeros((SUPER_K, LEAF_K), dtype=np.int64)

    for s in range(SUPER_K):
        mask = (super_labels == s)
        sub_embs = embs[mask]
        if len(sub_embs) < LEAF_K:
            log.warning(f"  super={s} has only {len(sub_embs)} articles — fewer than LEAF_K={LEAF_K}, all go to leaf 0")
            # Fill all leaves with the super centroid (degenerate case)
            for l in range(LEAF_K):
                leaf_centroids[s, l] = super_centroids[s]
            leaf_labels[np.nonzero(mask)[0]] = 0
            leaf_counts[s, 0] = int(mask.sum())
            continue
        km, labels = run_kmeans(sub_embs, LEAF_K, f"leaf super={s}")
        leaf_centroids[s] = km.cluster_centers_.astype(np.float32)
        leaf_labels[np.nonzero(mask)[0]] = labels
        for l in range(LEAF_K):
            leaf_counts[s, l] = int((labels == l).sum())

    return super_centroids, leaf_centroids, super_labels, leaf_labels, leaf_counts


def compute_top_k_assignments(embs: np.ndarray, leaf_centroids: np.ndarray, top_k: int = 3):
    """For each article, find the top-K nearest leaves across all 100.

    Returns list of length N, each entry is a list of {super, leaf, weight} dicts
    (weights normalized to sum=1.0, higher = closer).
    """
    # Flatten leaf_centroids from (10,10,384) to (100,384) with a (super, leaf) map
    flat = leaf_centroids.reshape(SUPER_K * LEAF_K, -1)  # (100, 384)
    super_idx = np.repeat(np.arange(SUPER_K), LEAF_K)    # [0,0,...,9,9]
    leaf_idx = np.tile(np.arange(LEAF_K), SUPER_K)       # [0,1,...,9,0,1,...,9]

    # Cosine distance = 1 - cosine similarity. We'll compute similarity directly.
    # Normalize both sides once.
    emb_norm = embs / (np.linalg.norm(embs, axis=1, keepdims=True) + 1e-12)
    flat_norm = flat / (np.linalg.norm(flat, axis=1, keepdims=True) + 1e-12)

    # Batch matmul: (N, 100)
    sims = emb_norm @ flat_norm.T  # higher = more similar

    # argtop-K per row
    top_k_idx = np.argpartition(-sims, kth=top_k, axis=1)[:, :top_k]
    # Sort within top-K by similarity descending
    row_ids = np.arange(len(embs))[:, None]
    top_k_sims = sims[row_ids, top_k_idx]
    order = np.argsort(-top_k_sims, axis=1)
    top_k_idx_sorted = np.take_along_axis(top_k_idx, order, axis=1)
    top_k_sims_sorted = np.take_along_axis(top_k_sims, order, axis=1)

    # Normalize similarities to weights (softmax would be smoother but linear-norm
    # is easier to interpret: top-1 dominates, top-3 gets residual).
    # Clip to [0, inf) before normalizing — negative cosines shouldn't contribute.
    clipped = np.clip(top_k_sims_sorted, 0.0, None)
    row_sums = clipped.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0  # avoid division by zero
    weights = clipped / row_sums

    assignments = []
    for i in range(len(embs)):
        entries = []
        for k in range(top_k):
            cidx = int(top_k_idx_sorted[i, k])
            w = float(weights[i, k])
            if w < 0.01:  # drop near-zero weights
                continue
            entries.append({
                'super': int(super_idx[cidx]),
                'leaf': int(leaf_idx[cidx]),
                'weight': round(w, 4),
            })
        assignments.append(entries)
    return assignments


def write_centroids_to_db(sb, super_centroids: np.ndarray,
                          leaf_centroids: np.ndarray,
                          leaf_counts: np.ndarray,
                          super_counts: np.ndarray):
    """Replace all rows in global_cluster_centroids."""
    log.info("writing centroids table")
    # Truncate via delete-all (no primary key known server-side for TRUNCATE via REST).
    try:
        sb.table('global_cluster_centroids').delete().gte('super_cluster_id', -32768).execute()
    except Exception as e:
        log.warning(f"  delete-all failed (continuing): {e}")

    rows = []
    # Super-cluster centroids (leaf_cluster_id=NULL)
    for s in range(SUPER_K):
        rows.append({
            'super_cluster_id': int(s),
            'leaf_cluster_id': None,
            'centroid': super_centroids[s].tolist(),
            'article_count': int(super_counts[s]),
            'last_rebuilt_at': datetime.now(timezone.utc).isoformat(),
        })
    # Leaf centroids
    for s in range(SUPER_K):
        for l in range(LEAF_K):
            rows.append({
                'super_cluster_id': int(s),
                'leaf_cluster_id': int(l),
                'centroid': leaf_centroids[s, l].tolist(),
                'article_count': int(leaf_counts[s, l]),
                'last_rebuilt_at': datetime.now(timezone.utc).isoformat(),
            })
    # Batch insert
    for i in range(0, len(rows), 50):
        chunk = rows[i:i+50]
        sb.table('global_cluster_centroids').insert(chunk).execute()
    log.info(f"  wrote {len(rows)} centroids (10 super + 100 leaf)")


def write_article_clusters(sb, ids: List[int], super_labels: np.ndarray,
                            leaf_labels: np.ndarray, assignments):
    """Parallel-update published_articles with cluster columns.

    Serial UPDATE per row against the Supabase REST API takes ~100ms each,
    which is 2+ hours for 75k articles. ThreadPoolExecutor with 24 workers
    drops this to ~10 minutes.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    log.info(f"writing cluster assignments for {len(ids)} articles (parallel, 24 workers)")
    n = len(ids)
    t0 = time.time()

    def _update_one(args):
        aid, s, l, ap = args
        try:
            sb.table('published_articles').update({
                'super_cluster_id': int(s),
                'leaf_cluster_id': int(l),
                'cluster_assignments': ap,
            }).eq('id', int(aid)).execute()
            return True
        except Exception as e:
            log.warning(f"  update failed for id={aid}: {e}")
            return False

    written = 0
    failed = 0
    last_log = t0

    tasks = list(zip(ids, super_labels, leaf_labels, assignments))

    with ThreadPoolExecutor(max_workers=24) as pool:
        for ok in pool.map(_update_one, tasks, chunksize=1):
            if ok:
                written += 1
            else:
                failed += 1
            now = time.time()
            if now - last_log >= 5.0:  # log every 5 seconds
                elapsed = now - t0
                rate = written / elapsed if elapsed > 0 else 0
                eta = (n - written - failed) / rate if rate > 0 else 0
                log.info(f"  progress: {written}/{n} in {elapsed:.1f}s ({rate:.1f}/s, ETA {eta:.0f}s)")
                last_log = now

    elapsed = time.time() - t0
    log.info(f"  final: {written} updated, {failed} failed in {elapsed:.1f}s")


def log_distribution_stats(leaf_counts: np.ndarray):
    """Log cluster-size distribution for sanity checks."""
    flat = leaf_counts.flatten()
    log.info("=== leaf distribution ===")
    log.info(f"  min={flat.min()}, max={flat.max()}, median={int(np.median(flat))}")
    log.info(f"  quartiles: q1={int(np.percentile(flat, 25))}, q3={int(np.percentile(flat, 75))}")
    empty = int((flat == 0).sum())
    tiny = int((flat < 20).sum())
    huge = int((flat > flat.sum() * 0.15).sum())  # >15% of all articles
    log.info(f"  empty leaves: {empty}/100, <20 articles: {tiny}/100, >15% of corpus: {huge}/100")
    if empty > 10 or huge > 3:
        log.warning(f"⚠️  distribution looks unhealthy — consider adjusting SUPER_K/LEAF_K")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry', action='store_true', help='compute but do not write to DB')
    args = parser.parse_args()

    log.info("=== GLOBAL CLUSTER BUILDER — START ===")
    t_start = time.time()

    sb = supabase_client()
    ids, embs, _missing = load_article_embeddings(sb)

    super_centroids, leaf_centroids, super_labels, leaf_labels, leaf_counts = build_hierarchy(ids, embs)
    super_counts = leaf_counts.sum(axis=1)

    log_distribution_stats(leaf_counts)

    assignments = compute_top_k_assignments(embs, leaf_centroids, top_k=TOP_N_LEAVES_PER_ARTICLE)
    log.info(f"computed top-{TOP_N_LEAVES_PER_ARTICLE} assignments for {len(assignments)} articles")

    if args.dry:
        log.info("--dry: skipping DB writes")
    else:
        write_centroids_to_db(sb, super_centroids, leaf_centroids, leaf_counts, super_counts)
        write_article_clusters(sb, ids, super_labels, leaf_labels, assignments)

    elapsed = time.time() - t_start
    log.info(f"=== DONE in {elapsed:.1f}s ===")


if __name__ == '__main__':
    main()

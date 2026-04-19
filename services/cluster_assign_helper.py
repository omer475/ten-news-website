"""
Real-time cluster assignment helper.

Used by the news pipeline (and potentially the UGC endpoint) to assign
freshly-published articles to their top-3 nearest leaves, using centroids
from the last nightly rebuild.

Between nightly rebuilds, new articles are placed relative to existing
(possibly slightly stale) centroids. Tomorrow's nightly rebuild will recompute
centroids and reassign all articles.

Typical call pattern (in complete_clustered_8step_workflow.py):
    from services.cluster_assign_helper import assign_clusters_for_embedding
    assignments = assign_clusters_for_embedding(embedding)
    article_data['super_cluster_id'] = assignments['super_cluster_id']
    article_data['leaf_cluster_id']  = assignments['leaf_cluster_id']
    article_data['cluster_assignments'] = assignments['cluster_assignments']

Centroids are cached per-process — a fresh Cloud Run instance fetches once
from global_cluster_centroids on first call, then reuses in-memory.
"""

import os
import logging
import numpy as np
from typing import Optional, List, Dict, Tuple
from supabase import create_client

log = logging.getLogger(__name__)

SUPER_K = 10
LEAF_K = 10
TOP_K = 3

# Per-process cache: centroids are stable between nightly rebuilds
_centroid_cache: Optional[Dict] = None


def _supabase():
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    return create_client(url, key)


def _load_centroids(force_reload: bool = False) -> Optional[Dict]:
    """Load 100 leaf centroids + 10 super centroids, cache in memory."""
    global _centroid_cache
    if _centroid_cache is not None and not force_reload:
        return _centroid_cache

    try:
        sb = _supabase()
        resp = sb.table('global_cluster_centroids').select('*').execute()
        rows = resp.data or []
        if not rows:
            log.warning("global_cluster_centroids is empty — nightly job hasn't run yet")
            return None

        leaf_centroids = np.zeros((SUPER_K, LEAF_K, 384), dtype=np.float32)
        super_centroids = np.zeros((SUPER_K, 384), dtype=np.float32)

        for r in rows:
            cent = r.get('centroid')
            if not cent:
                continue
            # Supabase VECTOR returns as a string "[0.1,0.2,...]" or list
            if isinstance(cent, str):
                # Parse pgvector text format
                cent = [float(x) for x in cent.strip('[]').split(',')]
            vec = np.asarray(cent, dtype=np.float32)
            s = r['super_cluster_id']
            l = r.get('leaf_cluster_id')
            if l is None:
                super_centroids[s] = vec
            else:
                leaf_centroids[s, l] = vec

        _centroid_cache = {
            'super_centroids': super_centroids,
            'leaf_centroids': leaf_centroids,
            'loaded_at': __import__('time').time(),
        }
        log.info(f"loaded {len(rows)} centroids from global_cluster_centroids")
        return _centroid_cache
    except Exception as e:
        log.warning(f"failed to load centroids: {e}")
        return None


def assign_clusters_for_embedding(embedding: List[float]) -> Dict:
    """Given an article's 384-dim MiniLM embedding, return its cluster assignment.

    Returns:
      {
        'super_cluster_id': int | None,
        'leaf_cluster_id':  int | None,
        'cluster_assignments': list of {super, leaf, weight} (top-3, sums to 1.0)
      }
    If no centroids are available yet (nightly hasn't run), returns None fields —
    caller should still insert the article; nightly will cluster it later.
    """
    default = {'super_cluster_id': None, 'leaf_cluster_id': None, 'cluster_assignments': None}

    if not embedding or len(embedding) != 384:
        return default
    cache = _load_centroids()
    if cache is None:
        return default

    leaf_centroids = cache['leaf_centroids']  # (10, 10, 384)
    # Flatten to (100, 384) for vectorized cosine
    flat = leaf_centroids.reshape(SUPER_K * LEAF_K, -1)
    super_idx = np.repeat(np.arange(SUPER_K), LEAF_K)
    leaf_idx = np.tile(np.arange(LEAF_K), SUPER_K)

    vec = np.asarray(embedding, dtype=np.float32)
    vec_norm = vec / (np.linalg.norm(vec) + 1e-12)
    flat_norms = np.linalg.norm(flat, axis=1, keepdims=True) + 1e-12
    flat_n = flat / flat_norms
    sims = flat_n @ vec_norm  # (100,)

    # Top-1 = primary; top-K = multi-label
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
        return default
    weights = clipped / total

    assignments = []
    for k in range(min(TOP_K, len(top_k_idx_sorted))):
        cidx = int(top_k_idx_sorted[k])
        w = float(weights[k])
        if w < 0.01:
            continue
        assignments.append({
            'super': int(super_idx[cidx]),
            'leaf': int(leaf_idx[cidx]),
            'weight': round(w, 4),
        })

    return {
        'super_cluster_id': primary_super,
        'leaf_cluster_id': primary_leaf,
        'cluster_assignments': assignments,
    }

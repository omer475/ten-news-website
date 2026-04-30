"""Train the Trinity 2-level cluster codebook (J=128 primary, K=1024 secondary).

Bootstraps from existing MiniLM 384-d embeddings (`published_articles.embedding_minilm_vec`).
Codebook structure: hierarchical k-means.
  - Level 1: 128 primary centroids (J=128).
  - Level 2: 8 sub-centroids per primary cluster -> 128*8 = 1024 globally (K=1024).
  - parent_map[c2] = c2 // 8 (deterministic; the only mapping that satisfies
    Trinity Algorithm 1's `parent(c2) == c1` predicate).

Each article is then stamped with (vq_primary, vq_secondary) where
  vq_primary  = argmin_c1   ||embedding - L1_centroids[c1]||
  vq_secondary = c1 * 8 + argmin_local ||residual - L2_sub[c1][local]||

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py --dry-run
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py --no-stamp

Idempotent. Each run creates a new vq_codebooks row (auto-versioned by timestamp)
and (unless --no-activate) flips it to is_active=true atomically. Stamping the
articles uses an UPDATE batch keyed on id.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np

try:
    from sklearn.cluster import MiniBatchKMeans
except ImportError:
    print("scikit-learn missing. pip install scikit-learn>=1.3.0", file=sys.stderr)
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("supabase missing. pip install supabase>=2.0.0", file=sys.stderr)
    sys.exit(1)


PRIMARY_K = 256                 # J — doubled from 128 (Streaming-VQ direction)
SUBCODEBOOK_K = 8               # K / J = 2048 / 256 = 8
SECONDARY_K = PRIMARY_K * SUBCODEBOOK_K   # 2048
EMBEDDING_DIM = 384             # MiniLM
FETCH_BATCH = 1000
STAMP_BATCH = 1000   # bulk_stamp_vq RPC has statement_timeout=120s, plenty of room
MIN_ARTICLES = 5000             # bail if we don't have enough to train

# K-means tuning
KM_RANDOM_STATE = 42
KM_MAX_ITER = 100
KM_BATCH_SIZE = 4096
KM_REASSIGN_RATIO = 0.01


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def parse_pgvector(value):
    """pgvector returns either a list or a string like '[0.1,0.2,...]'. Coerce to list[float]."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        s = value.strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return None
    return None


def fetch_all_embeddings(supabase: Client) -> tuple[np.ndarray, list[int]]:
    """Stream every (id, embedding_minilm_vec) into memory. ~87K rows × 384 floats × 4 bytes ≈ 130 MB."""
    print(f"[{ts()}] Fetching all article embeddings…")
    ids: list[int] = []
    vectors: list[list[float]] = []
    last_id = 0
    while True:
        resp = (
            supabase.table("published_articles")
            .select("id, embedding_minilm_vec")
            .gt("id", last_id)
            .not_.is_("embedding_minilm_vec", "null")
            .order("id")
            .limit(FETCH_BATCH)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        for row in rows:
            vec = parse_pgvector(row["embedding_minilm_vec"])
            if vec is None or len(vec) != EMBEDDING_DIM:
                continue
            ids.append(row["id"])
            vectors.append(vec)
        last_id = rows[-1]["id"]
        if len(ids) % 10000 == 0:
            print(f"[{ts()}]   fetched {len(ids)} so far (last id={last_id})…")

    arr = np.asarray(vectors, dtype=np.float32)
    # Cosine similarity on unit-length vectors == Euclidean clustering
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    arr = arr / norms
    print(f"[{ts()}] Fetched {len(ids)} embeddings, shape {arr.shape}.")
    return arr, ids


def train_level1(X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """K-means on the full corpus to produce J=128 primary centroids."""
    print(f"[{ts()}] Training L1 ({PRIMARY_K} clusters) on {X.shape[0]} vectors…")
    km = MiniBatchKMeans(
        n_clusters=PRIMARY_K,
        random_state=KM_RANDOM_STATE,
        max_iter=KM_MAX_ITER,
        batch_size=KM_BATCH_SIZE,
        reassignment_ratio=KM_REASSIGN_RATIO,
        n_init="auto",
    )
    km.fit(X)
    centroids = km.cluster_centers_.astype(np.float32)
    # Normalize centroids the same way (preserves cosine semantics for downstream lookup).
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    centroids /= norms
    assignments = km.labels_.astype(np.int32)
    return centroids, assignments


def train_level2(
    X: np.ndarray, l1_assign: np.ndarray, l1_centroids: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Per-primary k-means on residuals: 8 sub-centroids inside each L1 cluster.

    Returns (level2_centroids[1024,384], parent_map[1024]). parent_map[c2] = c2 // 8
    (enforced by construction). For each article we also produce a global secondary
    assignment: c2 = c1 * 8 + local_sub_index.
    """
    print(f"[{ts()}] Training L2 ({SUBCODEBOOK_K} sub-clusters per primary)…")
    level2 = np.zeros((SECONDARY_K, EMBEDDING_DIM), dtype=np.float32)
    secondary_assign = np.zeros(X.shape[0], dtype=np.int32)
    parent_map = np.repeat(np.arange(PRIMARY_K, dtype=np.int32), SUBCODEBOOK_K)

    for c1 in range(PRIMARY_K):
        mask = l1_assign == c1
        items = X[mask]
        residuals = items - l1_centroids[c1]
        n = items.shape[0]

        base = c1 * SUBCODEBOOK_K

        if n == 0:
            # Empty primary: fill with the L1 centroid duplicated. Trinity-LT will
            # exclude these for having < T_i=3 articles; harmless placeholder.
            for s in range(SUBCODEBOOK_K):
                level2[base + s] = l1_centroids[c1]
            continue

        if n < SUBCODEBOOK_K:
            # Not enough items to train 8 sub-clusters. Use the items themselves as
            # centroids (replicated to fill 8 slots). All articles in this primary
            # collapse to whichever sub-slot is closest to them.
            for s in range(SUBCODEBOOK_K):
                level2[base + s] = items[s % n] - l1_centroids[c1]
            # Local assignment by nearest among the n unique sub-slots
            sub_centroids_residual = level2[base : base + SUBCODEBOOK_K]
            d = np.linalg.norm(residuals[:, None, :] - sub_centroids_residual[None, :, :], axis=2)
            local = np.argmin(d, axis=1).astype(np.int32)
            secondary_assign[mask] = base + local
            continue

        sub_km = MiniBatchKMeans(
            n_clusters=SUBCODEBOOK_K,
            random_state=KM_RANDOM_STATE,
            max_iter=KM_MAX_ITER,
            batch_size=min(KM_BATCH_SIZE, max(SUBCODEBOOK_K * 4, n)),
            reassignment_ratio=KM_REASSIGN_RATIO,
            n_init="auto",
        )
        sub_km.fit(residuals)
        # Stored as residuals (not absolute vectors) so that to assign a new
        # article we can compute residual then look up nearest sub-residual.
        level2[base : base + SUBCODEBOOK_K] = sub_km.cluster_centers_.astype(np.float32)
        local = sub_km.labels_.astype(np.int32)
        secondary_assign[mask] = base + local

    return level2, secondary_assign, parent_map


def write_codebook(
    supabase: Client,
    *,
    l1: np.ndarray,
    l2: np.ndarray,
    parent_map: np.ndarray,
    item_count: int,
    activate: bool,
    notes: str | None,
) -> int:
    """Insert codebook row + per-centroid rows into vq_centroids.

    The two big arrays (level1 256x384 + level2 2048x384) used to live as
    jsonb on vq_codebooks itself, but that triggered statement_timeout at
    J=256. Now we write the small header to vq_codebooks then stream
    centroids in batches into vq_centroids.
    """
    version = datetime.now(timezone.utc).strftime("v%Y%m%d_%H%M%S")
    header = {
        "version": version,
        "signal_type": "semantic",
        "parent_map": parent_map.tolist(),
        "dim": EMBEDDING_DIM,
        "item_count": item_count,
        "is_active": False,
        "notes": notes or "",
    }
    print(f"[{ts()}] Writing codebook header version={version}…")
    inserted = supabase.table("vq_codebooks").insert(header).execute()
    codebook_id = inserted.data[0]["id"]
    print(f"[{ts()}]   inserted vq_codebooks.id = {codebook_id}")

    # Stream centroids row-per-vector in batches of 200.
    print(f"[{ts()}] Writing {l1.shape[0]} L1 centroids + {l2.shape[0]} L2 centroids…")
    centroid_rows = []
    for i in range(l1.shape[0]):
        centroid_rows.append({
            "codebook_id": codebook_id, "level": 1, "idx": i,
            "vec": _format_vector(l1[i]),
        })
    for i in range(l2.shape[0]):
        centroid_rows.append({
            "codebook_id": codebook_id, "level": 2, "idx": i,
            "vec": _format_vector(l2[i]),
        })
    BATCH = 200
    for start in range(0, len(centroid_rows), BATCH):
        chunk = centroid_rows[start : start + BATCH]
        supabase.table("vq_centroids").insert(chunk).execute()
        if start % (BATCH * 5) == 0:
            print(f"[{ts()}]   wrote {start + len(chunk)}/{len(centroid_rows)} centroids")
    print(f"[{ts()}]   done writing centroids")

    if activate:
        # Deactivate any existing active codebook then mark this one active.
        supabase.table("vq_codebooks").update({"is_active": False}).eq("is_active", True).execute()
        supabase.table("vq_codebooks").update({"is_active": True}).eq("id", codebook_id).execute()
        print(f"[{ts()}]   activated codebook id={codebook_id}.")
    return codebook_id


def _format_vector(arr: np.ndarray) -> str:
    """pgvector accepts a string of the form '[v1,v2,...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in arr) + "]"


def stamp_articles(
    supabase: Client,
    ids: list[int],
    primary: np.ndarray,
    secondary: np.ndarray,
    *,
    dry_run: bool,
) -> None:
    """Bulk-update vq_primary/vq_secondary on every article via bulk_stamp_vq RPC.

    Each batch is a single SQL UPDATE FROM VALUES, so 87K rows takes ~90 batches
    instead of 87K round-trips."""
    print(f"[{ts()}] Stamping {len(ids)} articles with (vq_primary, vq_secondary)…")
    n = len(ids)
    updated = 0
    for start in range(0, n, STAMP_BATCH):
        end = min(start + STAMP_BATCH, n)
        payload = [
            {"id": int(ids[i]), "c1": int(primary[i]), "c2": int(secondary[i])}
            for i in range(start, end)
        ]
        if dry_run:
            updated += len(payload)
            if start % (STAMP_BATCH * 10) == 0:
                print(f"[{ts()}]   (dry-run) would stamp {updated}/{n}")
            continue
        resp = supabase.rpc("bulk_stamp_vq", {"p_payload": payload}).execute()
        rows_updated = resp.data if isinstance(resp.data, int) else len(payload)
        updated += int(rows_updated or 0)
        if start % (STAMP_BATCH * 5) == 0:
            print(f"[{ts()}]   stamped {updated}/{n}")
    print(f"[{ts()}] Stamping done — {updated}/{n}.")


def report_balance(primary: np.ndarray, secondary: np.ndarray) -> None:
    p_counts = np.bincount(primary, minlength=PRIMARY_K)
    s_counts = np.bincount(secondary, minlength=SECONDARY_K)
    print("L1 cluster size summary:")
    print(f"  min={p_counts.min()} max={p_counts.max()} mean={p_counts.mean():.0f} median={np.median(p_counts):.0f}")
    print(f"  P95={np.percentile(p_counts, 95):.0f} share-of-largest={p_counts.max()/p_counts.sum():.3%}")
    print("L2 cluster size summary:")
    print(f"  empty={(s_counts == 0).sum()} <3-items={(s_counts < 3).sum()} (excluded by Trinity-LT T_i=3)")
    print(f"  min={s_counts.min()} max={s_counts.max()} mean={s_counts.mean():.1f} median={np.median(s_counts):.0f}")


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Train + report balance but do not write to DB.")
    parser.add_argument("--no-activate", action="store_true",
                        help="Insert codebook with is_active=false (manual flip later).")
    parser.add_argument("--no-stamp", action="store_true",
                        help="Train + write codebook, but skip article stamping. For first runs to inspect balance.")
    parser.add_argument("--notes", default=None, help="Free-form notes saved on the codebook row.")
    args = parser.parse_args()

    sb = get_supabase()
    t0 = time.time()
    X, ids = fetch_all_embeddings(sb)
    if X.shape[0] < MIN_ARTICLES:
        print(f"Only {X.shape[0]} embeddings found; need ≥{MIN_ARTICLES}. Aborting.", file=sys.stderr)
        return 2

    l1_centroids, l1_assign = train_level1(X)
    l2_centroids, secondary_assign, parent_map = train_level2(X, l1_assign, l1_centroids)
    report_balance(l1_assign, secondary_assign)

    if args.dry_run:
        print(f"[{ts()}] Dry-run: skipping all writes. Total time: {time.time()-t0:.1f}s.")
        return 0

    write_codebook(
        sb,
        l1=l1_centroids,
        l2=l2_centroids,
        parent_map=parent_map,
        item_count=X.shape[0],
        activate=not args.no_activate,
        notes=args.notes,
    )

    if args.no_stamp:
        print(f"[{ts()}] --no-stamp: codebook saved, articles not stamped. Total time: {time.time()-t0:.1f}s.")
        return 0

    stamp_articles(sb, ids, l1_assign, secondary_assign, dry_run=False)
    print(f"[{ts()}] Done. Total time: {time.time()-t0:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

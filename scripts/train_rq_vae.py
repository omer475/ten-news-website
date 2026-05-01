"""Train the Trinity 2-level cluster codebook (J=256 primary, K=2048 secondary).

Bootstraps from existing MiniLM 384-d embeddings (`published_articles.embedding_minilm_vec`).
Codebook structure: hierarchical k-means.
  - Level 1: 256 primary centroids (J=256 — doubled from the paper's 128 to
    halve average primary cluster size; Streaming-VQ KDD 2025 direction).
  - Level 2: 8 sub-centroids per primary cluster -> 256*8 = 2048 globally (K=2048).
  - parent_map[c2] = c2 // 8 (deterministic).

Each article is then stamped with (vq_primary, vq_secondary) where
  vq_primary  = argmin_c1   ||embedding - L1_centroids[c1]||
  vq_secondary = c1 * 8 + argmin_local ||residual - L2_sub[c1][local]||

Centroids are stored in the `vq_centroids` table (one pgvector row per
centroid). The `vq_codebooks` row is a small header.

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py --dry-run
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/train_rq_vae.py --no-stamp
"""

from __future__ import annotations

import argparse
import json
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


PRIMARY_K = 256                 # J — doubled from paper's 128
SUBCODEBOOK_K = 8               # K / J = 2048 / 256
SECONDARY_K = PRIMARY_K * SUBCODEBOOK_K   # 2048
EMBEDDING_DIM = 384             # MiniLM
FETCH_BATCH = 1000
STAMP_BATCH = 1000              # bulk_stamp_vq RPC has statement_timeout=120s
CENTROID_BATCH = 200
MIN_ARTICLES = 5000             # bail if too few to train

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
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    arr = arr / norms
    print(f"[{ts()}] Fetched {len(ids)} embeddings, shape {arr.shape}.")
    return arr, ids


def train_level1(X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    print(f"[{ts()}] Training L1 ({PRIMARY_K} clusters) on {X.shape[0]} vectors…")
    km = MiniBatchKMeans(
        n_clusters=PRIMARY_K, random_state=KM_RANDOM_STATE,
        max_iter=KM_MAX_ITER, batch_size=KM_BATCH_SIZE,
        reassignment_ratio=KM_REASSIGN_RATIO, n_init="auto",
    )
    km.fit(X)
    centroids = km.cluster_centers_.astype(np.float32)
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    centroids /= norms
    return centroids, km.labels_.astype(np.int32)


def train_level2(X: np.ndarray, l1_assign: np.ndarray, l1_centroids: np.ndarray):
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
            for s in range(SUBCODEBOOK_K):
                level2[base + s] = l1_centroids[c1]
            continue

        if n < SUBCODEBOOK_K:
            for s in range(SUBCODEBOOK_K):
                level2[base + s] = items[s % n] - l1_centroids[c1]
            sub_centroids_residual = level2[base : base + SUBCODEBOOK_K]
            d = np.linalg.norm(residuals[:, None, :] - sub_centroids_residual[None, :, :], axis=2)
            local = np.argmin(d, axis=1).astype(np.int32)
            secondary_assign[mask] = base + local
            continue

        sub_km = MiniBatchKMeans(
            n_clusters=SUBCODEBOOK_K, random_state=KM_RANDOM_STATE,
            max_iter=KM_MAX_ITER, batch_size=min(KM_BATCH_SIZE, max(SUBCODEBOOK_K * 4, n)),
            reassignment_ratio=KM_REASSIGN_RATIO, n_init="auto",
        )
        sub_km.fit(residuals)
        level2[base : base + SUBCODEBOOK_K] = sub_km.cluster_centers_.astype(np.float32)
        local = sub_km.labels_.astype(np.int32)
        secondary_assign[mask] = base + local

    return level2, secondary_assign, parent_map


def write_codebook(supabase: Client, *, l1, l2, parent_map, item_count, activate, notes):
    """Insert codebook header + stream centroids into vq_centroids."""
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

    print(f"[{ts()}] Writing {l1.shape[0]} L1 + {l2.shape[0]} L2 centroids…")
    rows = []
    for i in range(l1.shape[0]):
        rows.append({"codebook_id": codebook_id, "level": 1, "idx": i, "vec": _format_vector(l1[i])})
    for i in range(l2.shape[0]):
        rows.append({"codebook_id": codebook_id, "level": 2, "idx": i, "vec": _format_vector(l2[i])})
    for start in range(0, len(rows), CENTROID_BATCH):
        chunk = rows[start : start + CENTROID_BATCH]
        supabase.table("vq_centroids").insert(chunk).execute()
        if start % (CENTROID_BATCH * 5) == 0:
            print(f"[{ts()}]   wrote {start + len(chunk)}/{len(rows)} centroids")
    print(f"[{ts()}]   done writing centroids")

    if activate:
        supabase.table("vq_codebooks").update({"is_active": False}).eq("is_active", True).execute()
        supabase.table("vq_codebooks").update({"is_active": True}).eq("id", codebook_id).execute()
        print(f"[{ts()}]   activated codebook id={codebook_id}.")
    return codebook_id


def _format_vector(arr: np.ndarray) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in arr) + "]"


def stamp_articles(supabase, ids, primary, secondary, *, dry_run):
    print(f"[{ts()}] Stamping {len(ids)} articles via bulk_stamp_vq RPC…")
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


def report_balance(primary, secondary):
    p_counts = np.bincount(primary, minlength=PRIMARY_K)
    s_counts = np.bincount(secondary, minlength=SECONDARY_K)
    print("L1 cluster size summary:")
    print(f"  min={p_counts.min()} max={p_counts.max()} mean={p_counts.mean():.0f} median={np.median(p_counts):.0f}")
    print(f"  P95={np.percentile(p_counts, 95):.0f} share-of-largest={p_counts.max()/p_counts.sum():.3%}")
    print("L2 cluster size summary:")
    print(f"  empty={(s_counts == 0).sum()} <3-items={(s_counts < 3).sum()} (excluded by Trinity-LT T_i=3)")
    print(f"  min={s_counts.min()} max={s_counts.max()} mean={s_counts.mean():.1f} median={np.median(s_counts):.0f}")


def ts():
    return datetime.now().strftime("%H:%M:%S")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-activate", action="store_true")
    parser.add_argument("--no-stamp", action="store_true")
    parser.add_argument("--notes", default=None)
    args = parser.parse_args()

    sb = get_supabase()
    t0 = time.time()
    X, ids = fetch_all_embeddings(sb)
    if X.shape[0] < MIN_ARTICLES:
        print(f"Only {X.shape[0]} embeddings; need ≥{MIN_ARTICLES}. Aborting.", file=sys.stderr)
        return 2

    l1_centroids, l1_assign = train_level1(X)
    l2_centroids, secondary_assign, parent_map = train_level2(X, l1_assign, l1_centroids)
    report_balance(l1_assign, secondary_assign)

    if args.dry_run:
        print(f"[{ts()}] Dry-run done. Total: {time.time()-t0:.1f}s.")
        return 0

    write_codebook(sb, l1=l1_centroids, l2=l2_centroids, parent_map=parent_map,
                   item_count=X.shape[0], activate=not args.no_activate, notes=args.notes)
    if args.no_stamp:
        print(f"[{ts()}] --no-stamp; codebook saved, articles not stamped. Total: {time.time()-t0:.1f}s.")
        return 0
    stamp_articles(sb, ids, l1_assign, secondary_assign, dry_run=False)
    print(f"[{ts()}] Done. Total: {time.time()-t0:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

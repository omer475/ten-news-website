#!/usr/bin/env python3
"""Phase 2.3 (2026-05-11). Train the X-style v1 ranker.

Reads `ranker_training_labels` view × published_articles join from the
Supabase prod DB, builds a feature matrix, fits three IPS-weighted heads
via sklearn LogisticRegression / Ridge, and writes `lib/ranker_v1_model.json`
for the JS runtime (lib/ranker_v1.js) to consume.

USAGE
-----
    # Dry-run: pulls data, prints stats, no model write.
    python scripts/train_ranker_v1.py --dry-run

    # Full train (writes lib/ranker_v1_model.json):
    python scripts/train_ranker_v1.py

    # Custom window / output:
    python scripts/train_ranker_v1.py --days-back 30 --output lib/ranker_v1_model.json

ENVIRONMENT
-----------
    NEXT_PUBLIC_SUPABASE_URL    Required.
    SUPABASE_SERVICE_KEY        Required (service-role read access).

DEPENDS
-------
    Python 3.10+, `pip install psycopg[binary] scikit-learn numpy`.
    (Plain stdlib + numpy + sklearn — no DB drivers beyond psycopg.)

LABELS
------
    P_tap   = label_engaged OR label_liked OR label_saved OR label_shared OR label_revisit
    P_save  = label_saved OR label_shared
    E_dwell = log1p(max_dwell_seconds) on tap-positive rows only (regression)

Weighting: each row's `ips_weight` column scales its loss contribution.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

import numpy as np


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

FEATURE_ORDER = [
    "log_quality",            # log1p(article_quality / 100)
    "age_hours_log",          # log1p(hours_since_shown_at_minus_published_or_estimate)
    "log_expected_read",      # log1p(expected_read_seconds)
    "log_num_sources",        # log1p(num_sources)
    "cluster_fit",             # 1.0 if matches user top-N primary, else 0.5
    "tap_rate",                # 0.20 baseline; refined when user funnel stats available
    "read_rate",               # 0.30 baseline
    "is_followed_author",      # 0/1
    "seen_count",              # raw count (then z-scored)
]


def build_feature_matrix(rows, article_meta, user_signals):
    """Convert raw DB rows into a feature matrix + label vectors.

    Inputs:
        rows: list of ranker_training_labels rows
        article_meta: dict[article_id → {created_at, published_at, num_sources,
                                          vq_primary, author_id}] from a
                      separate published_articles fetch.
        user_signals: dict[user_id → {funnel_by_primary, followed_authors_set,
                                       histogram_top1_primary, histogram_total}].

    Returns:
        X (N×F float32)
        y_tap (N,) bool — positive of any tap-tier event
        y_save (N,) bool — saved or shared
        dwell_seconds (N,) float — only meaningful where y_tap is True
        w (N,) float — IPS weights
    """
    n = len(rows)
    f = len(FEATURE_ORDER)
    X = np.zeros((n, f), dtype=np.float64)
    y_tap = np.zeros(n, dtype=bool)
    y_save = np.zeros(n, dtype=bool)
    dwell = np.zeros(n, dtype=np.float64)
    w = np.ones(n, dtype=np.float64)

    for i, r in enumerate(rows):
        quality = float(r.get("article_quality") or 0)
        expected_read = float(r.get("expected_read_seconds") or 30)
        article_id = r.get("article_id")
        user_id = r.get("user_id")
        shown_at = r.get("shown_at")

        meta = article_meta.get(article_id) or {}
        sig  = user_signals.get(user_id) or {}

        # Age: hours between article publish + impression shown_at.
        age_hours = 0.0
        published = meta.get("published_at") or meta.get("created_at")
        if published and shown_at:
            try:
                pub_t = datetime.fromisoformat(published.replace("Z", "+00:00"))
                show_t = datetime.fromisoformat(shown_at.replace("Z", "+00:00"))
                age_hours = max(0.0, (show_t - pub_t).total_seconds() / 3600.0)
            except Exception:
                pass

        num_sources = float(meta.get("num_sources") or 1)
        vq_primary = meta.get("vq_primary")
        author_id = meta.get("author_id")

        # cluster_fit: how much of the user's engagement history is on this primary?
        # Computed from the user's funnel-stats impressions per primary, normalized
        # against the user's max-impression primary. Range [0, 1].
        cluster_fit = 0.0
        funnel = sig.get("funnel_by_primary") or {}
        max_imp = sig.get("histogram_max_imp") or 1
        if vq_primary is not None:
            fp = funnel.get(int(vq_primary))
            if fp and max_imp > 0:
                cluster_fit = min(1.0, fp.get("impressions", 0) / max_imp)
        elif funnel:
            cluster_fit = 0.5  # fallback when article has no primary tag

        # Per-primary funnel rates. Beta(5,20) and Beta(2,6) shrunk like the
        # runtime in lib/trinityServe.js loadUserFunnelStats.
        tap_rate, read_rate = 0.20, 0.30
        if vq_primary is not None:
            fp = funnel.get(int(vq_primary))
            if fp and fp.get("impressions", 0) >= 5:
                tap_rate  = (fp["taps"] + 5)        / (fp["impressions"] + 25)
                read_rate = (fp["deep_reads"] + 2)  / (max(1, fp["taps"]) + 8)

        # Followed author: 1 if author_id in user's follows.
        is_followed = 0.0
        if author_id and author_id in (sig.get("followed_authors") or set()):
            is_followed = 1.0

        X[i, 0] = np.log1p(quality / 100.0)
        X[i, 1] = np.log1p(age_hours)
        X[i, 2] = np.log1p(expected_read)
        X[i, 3] = np.log1p(num_sources)
        X[i, 4] = cluster_fit
        X[i, 5] = tap_rate
        X[i, 6] = read_rate
        X[i, 7] = is_followed
        X[i, 8] = float(r.get("max_dwell_seconds") or 0) > 0  # crude proxy for seen=1+

        y_tap[i]  = bool(r.get("label_engaged") or r.get("label_liked")
                          or r.get("label_saved") or r.get("label_shared")
                          or r.get("label_revisit"))
        y_save[i] = bool(r.get("label_saved") or r.get("label_shared"))
        dwell[i]  = float(r.get("max_dwell_seconds") or 0)
        w_i = r.get("ips_weight")
        if w_i is not None and float(w_i) > 0:
            w[i] = float(w_i)

    # Clamp IPS weights to avoid blowups from low-propensity slots.
    w = np.clip(w, 0.1, 20.0)
    return X, y_tap, y_save, dwell, w


# ---------------------------------------------------------------------------
# Model fitting
# ---------------------------------------------------------------------------

def fit_logistic_head(X, y, w, scaler_means, scaler_stds, head_name):
    from sklearn.linear_model import LogisticRegression

    # Pre-scaled X via the shared scaler.
    X_norm = (X - scaler_means) / np.where(scaler_stds == 0, 1, scaler_stds)
    pos_count = int(y.sum())
    neg_count = int((~y).sum())
    if pos_count < 5 or neg_count < 5:
        print(f"  WARN head={head_name} positives={pos_count} negatives={neg_count} — refusing to train (need ≥5 each)")
        return None
    model = LogisticRegression(
        max_iter=500,
        class_weight="balanced",
        solver="liblinear",  # small dataset
    )
    model.fit(X_norm, y.astype(int), sample_weight=w)

    # Simple Platt calibration: fit logistic on top of model.decision_function.
    from sklearn.linear_model import LogisticRegression as PlattLR
    df = model.decision_function(X_norm)
    platt = PlattLR(max_iter=200)
    platt.fit(df.reshape(-1, 1), y.astype(int), sample_weight=w)

    return {
        "coefficients": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "platt_a": float(platt.coef_[0, 0]),
        "platt_b": float(platt.intercept_[0]),
        "metrics": {
            "positives": pos_count,
            "negatives": neg_count,
            "pos_rate": pos_count / (pos_count + neg_count),
        },
    }


def fit_ridge_dwell(X, dwell, mask, w, scaler_means, scaler_stds):
    from sklearn.linear_model import Ridge

    if mask.sum() < 20:
        print(f"  WARN E_dwell: only {int(mask.sum())} tap-positive rows — refusing to train (need ≥20)")
        return None
    X_norm = (X - scaler_means) / np.where(scaler_stds == 0, 1, scaler_stds)
    target = np.log1p(np.maximum(0, dwell))
    model = Ridge(alpha=1.0)
    # Predict normalized read-ratio (target / log1p(expected_read)), bounded [0, 1].
    # This makes JS-side rescaling (log_score × expected_read) cleaner.
    model.fit(X_norm[mask], target[mask] / np.maximum(0.5, X[mask, 2]), sample_weight=w[mask])
    return {
        "coefficients": model.coef_.tolist(),
        "intercept": float(model.intercept_),
        # No Platt for regression; JS-side clamps to [0, 1].
        "platt_a": None,
        "platt_b": None,
        "metrics": {
            "tap_positive_rows": int(mask.sum()),
            "mean_target": float(target[mask].mean()),
        },
    }


# ---------------------------------------------------------------------------
# DB load
# ---------------------------------------------------------------------------

def _build_ssl_context():
    """Robust SSL context that prefers certifi, then macOS keychain, then default.

    On Python 3.12 macOS framework installs, the default SSL store often
    can't find a CA bundle and SSL handshake fails. Try certifi (typically
    installed alongside scikit-learn deps); fall back to the system default
    context which works on Linux + Vercel.
    """
    import ssl
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _supabase_env():
    """Returns (base_url, service_role_key) where base_url already includes /rest/v1."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("error: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.", file=sys.stderr)
        sys.exit(1)
    return url.rstrip("/") + "/rest/v1", key


def _rest_get(path: str, ssl_ctx, key: str, base: str):
    """GET against /rest/v1 and return parsed JSON. Raises on error with body."""
    import urllib.request, urllib.error
    req = urllib.request.Request(base + path, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    })
    try:
        with urllib.request.urlopen(req, timeout=60, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} for URL: {base + path}", file=sys.stderr)
        print(f"  body: {e.read().decode('utf-8')[:500]}", file=sys.stderr)
        raise


def _rpc_post(rpc_name: str, payload: dict, ssl_ctx, key: str, base: str):
    """POST to /rest/v1/rpc/<name>."""
    import urllib.request, urllib.error
    req = urllib.request.Request(
        base + f"/rpc/{rpc_name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  RPC {rpc_name} HTTP {e.code}: {e.read().decode('utf-8')[:500]}", file=sys.stderr)
        return []


def load_rows(days_back: int, ssl_ctx, key: str, base: str):
    """Fetch ranker_training_labels via Supabase REST."""
    import urllib.parse, datetime as dt
    select = "impression_id,user_id,article_id,bucket,article_quality,expected_read_seconds,max_dwell_seconds,read_fraction,label_engaged,label_skipped,label_saved,label_shared,label_liked,label_revisit,ips_weight,propensity_score,shown_at"
    page_size = 1000
    offset = 0
    all_rows = []
    horizon_iso = (datetime.now(timezone.utc) - dt.timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%SZ")
    horizon = f"shown_at=gte.{horizon_iso}"
    while True:
        q = f"/ranker_training_labels?select={urllib.parse.quote(select)}&{horizon}&order=shown_at.desc&limit={page_size}&offset={offset}"
        page = _rest_get(q, ssl_ctx, key, base)
        all_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
        if offset >= 50000:
            print(f"  warn: hit 50k row cap; stopping.")
            break
    return all_rows


def load_article_meta(article_ids, ssl_ctx, key: str, base: str):
    """Fetch published_articles join data keyed by article_id.

    Returns dict[article_id → {published_at, created_at, num_sources, vq_primary, author_id}].
    Chunks the IN clause to stay under PostgREST URL length limits.
    """
    import urllib.parse
    out = {}
    if not article_ids:
        return out
    distinct = sorted({int(a) for a in article_ids if a is not None})
    CHUNK = 500
    for i in range(0, len(distinct), CHUNK):
        chunk = distinct[i:i + CHUNK]
        in_clause = ",".join(str(x) for x in chunk)
        q = (f"/published_articles?select=id,published_at,created_at,num_sources,vq_primary,author_id"
             f"&id=in.({in_clause})")
        page = _rest_get(q, ssl_ctx, key, base)
        for row in page:
            out[int(row["id"])] = row
    return out


def load_user_signals(user_ids, ssl_ctx, key: str, base: str):
    """Fetch per-user funnel stats + follow set.

    Returns dict[user_id → {funnel_by_primary, followed_authors, histogram_max_imp}].
    """
    out = {}
    for uid in sorted({u for u in user_ids if u}):
        funnel_rows = _rpc_post("user_funnel_stats",
                                {"p_user_id": uid, "p_days_back": 30},
                                ssl_ctx, key, base)
        funnel_by_primary = {}
        max_imp = 0
        for r in (funnel_rows or []):
            pri = r.get("vq_primary")
            if pri is None: continue
            funnel_by_primary[int(pri)] = {
                "impressions": int(r.get("impressions") or 0),
                "taps": int(r.get("taps") or 0),
                "deep_reads": int(r.get("deep_reads") or 0),
            }
            if int(r.get("impressions") or 0) > max_imp:
                max_imp = int(r.get("impressions") or 0)
        follows_rows = _rest_get(
            f"/user_follows?select=publisher_id&user_id=eq.{uid}", ssl_ctx, key, base)
        followed = {r["publisher_id"] for r in (follows_rows or []) if r.get("publisher_id")}
        out[uid] = {
            "funnel_by_primary": funnel_by_primary,
            "followed_authors": followed,
            "histogram_max_imp": max_imp,
        }
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Pull data, print stats, do not write the model JSON.")
    ap.add_argument("--days-back", type=int, default=14,
                    help="Training horizon in days (default 14).")
    ap.add_argument("--output", default="lib/ranker_v1_model.json",
                    help="Output JSON path (relative to repo root).")
    args = ap.parse_args()

    base, key = _supabase_env()
    ssl_ctx = _build_ssl_context()

    print(f"[train_ranker_v1] fetching last {args.days_back} days of ranker_training_labels…")
    rows = load_rows(args.days_back, ssl_ctx, key, base)
    print(f"  fetched {len(rows)} rows")
    if len(rows) < 100:
        print("error: fewer than 100 rows — refusing to train. Wait for more data.", file=sys.stderr)
        sys.exit(2)

    article_ids = {r.get("article_id") for r in rows if r.get("article_id")}
    user_ids    = {r.get("user_id")    for r in rows if r.get("user_id")}
    print(f"[train_ranker_v1] joining published_articles meta for {len(article_ids)} articles…")
    article_meta = load_article_meta(article_ids, ssl_ctx, key, base)
    print(f"  resolved {len(article_meta)} articles")
    print(f"[train_ranker_v1] loading user signals (funnel stats + follows) for {len(user_ids)} users…")
    user_signals = load_user_signals(user_ids, ssl_ctx, key, base)
    print(f"  resolved {len(user_signals)} users")

    X, y_tap, y_save, dwell, w = build_feature_matrix(rows, article_meta, user_signals)
    print(f"  features: {X.shape} | tap+ {y_tap.sum()} / {len(y_tap)} ({y_tap.mean()*100:.1f}%) | "
          f"save+ {y_save.sum()} ({y_save.mean()*100:.2f}%) | "
          f"dwell mean (tap+) {dwell[y_tap].mean():.1f}s")

    # Per-feature non-zero coverage sanity check.
    for j, name in enumerate(FEATURE_ORDER):
        nonzero = int((X[:, j] != 0).sum())
        print(f"  feature[{j}] {name:<22s} nonzero={nonzero:>5d}/{len(rows)} ({nonzero/len(rows)*100:5.1f}%)")

    means = X.mean(axis=0)
    stds  = X.std(axis=0)

    print("[train_ranker_v1] fitting P_tap (logistic, IPS-weighted)…")
    p_tap  = fit_logistic_head(X, y_tap, w, means, stds, "p_tap")
    print("[train_ranker_v1] fitting P_save (logistic, IPS-weighted)…")
    p_save = fit_logistic_head(X, y_save, w, means, stds, "p_save")
    print("[train_ranker_v1] fitting E_dwell (Ridge on tap-positive)…")
    e_dwell = fit_ridge_dwell(X, dwell, y_tap, w, means, stds)

    heads = {}
    if p_tap:  heads["p_tap"]  = p_tap
    if p_save: heads["p_save"] = p_save
    if e_dwell: heads["e_dwell"] = e_dwell

    model = {
        "version": "v1." + datetime.now(timezone.utc).strftime("%Y%m%d.%H%M"),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feature_order": FEATURE_ORDER,
        "scaler_means": means.tolist(),
        "scaler_stds":  stds.tolist(),
        "heads": heads,
        "training_rows": len(rows),
        "days_back": args.days_back,
    }
    print(f"[train_ranker_v1] fit {len(heads)} of 3 heads")
    for name, head in heads.items():
        m = head.get("metrics", {})
        print(f"  {name}: {m}")

    if args.dry_run:
        print("[train_ranker_v1] --dry-run set; not writing model.")
        return

    # Resolve output path relative to repo root (caller-friendly).
    out = os.path.abspath(args.output)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=2)
    print(f"[train_ranker_v1] wrote {out}")


if __name__ == "__main__":
    main()

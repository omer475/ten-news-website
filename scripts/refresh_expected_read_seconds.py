"""Promote observed reading time into per-article expected_read_seconds.

`article_dwell_stats` is already populated (article_id, observation_count,
median_dwell_sec, p60_dwell_sec). This script copies p60 over the word-count
estimate stored on `published_articles.expected_read_seconds` once we have
enough observations to trust the empirical value.

Run nightly. Idempotent. Skips rows where p60 is essentially the same as what
we already have (within 1s).

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/refresh_expected_read_seconds.py
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/refresh_expected_read_seconds.py --dry-run
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/refresh_expected_read_seconds.py --min-obs 10
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime

try:
    from supabase import create_client, Client
except ImportError:
    print("supabase missing. pip install supabase>=2.0.0", file=sys.stderr)
    sys.exit(1)


DEFAULT_MIN_OBS = 5      # need at least this many user observations to trust p60
MIN_SECS = 5             # matches lib/readingTime.js MIN_EXPECTED
MAX_SECS = 600           # matches lib/readingTime.js MAX_EXPECTED
PAGE_SIZE = 500          # rows per fetch
NEAR_TOLERANCE_SEC = 1   # don't bother updating if change is within this band


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--min-obs", type=int, default=DEFAULT_MIN_OBS,
                        help=f"Minimum observations to trust p60 (default {DEFAULT_MIN_OBS}).")
    args = parser.parse_args()

    sb = get_supabase()
    print(f"[{ts()}] Refreshing expected_read_seconds (min observations = {args.min_obs}).")

    last_id = -1
    total_seen = 0
    total_updated = 0
    total_skipped_close = 0
    total_skipped_low_obs = 0

    while True:
        resp = (
            sb.table("article_dwell_stats")
            .select("article_id, observation_count, p60_dwell_sec")
            .gt("article_id", last_id)
            .order("article_id")
            .limit(PAGE_SIZE)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        total_seen += len(rows)
        last_id = rows[-1]["article_id"]

        # Filter to qualifying rows in-memory.
        qualifying_ids = [r["article_id"] for r in rows if (r.get("observation_count") or 0) >= args.min_obs]
        skipped_low = len(rows) - len(qualifying_ids)
        total_skipped_low_obs += skipped_low

        if not qualifying_ids:
            continue

        # Fetch the corresponding published_articles current expected_read_seconds.
        existing = (
            sb.table("published_articles")
            .select("id, expected_read_seconds")
            .in_("id", qualifying_ids)
            .execute()
        )
        existing_map = {row["id"]: row.get("expected_read_seconds") for row in (existing.data or [])}

        for r in rows:
            if (r.get("observation_count") or 0) < args.min_obs:
                continue
            article_id = r["article_id"]
            p60 = int(r.get("p60_dwell_sec") or 0)
            if p60 <= 0:
                continue
            new_value = max(MIN_SECS, min(MAX_SECS, p60))
            current = existing_map.get(article_id)
            if current is not None and abs(current - new_value) <= NEAR_TOLERANCE_SEC:
                total_skipped_close += 1
                continue
            if args.dry_run:
                total_updated += 1
                continue
            sb.table("published_articles").update(
                {"expected_read_seconds": new_value}
            ).eq("id", article_id).execute()
            total_updated += 1

        print(f"[{ts()}]   scanned {total_seen}, updated {total_updated}, skipped (close) {total_skipped_close}, skipped (low-obs) {total_skipped_low_obs}.")

    suffix = " (dry-run)" if args.dry_run else ""
    print(f"[{ts()}] Done{suffix}. {total_updated} expected_read_seconds promoted from learned p60.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

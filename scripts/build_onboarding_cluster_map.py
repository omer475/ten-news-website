#!/usr/bin/env python3
"""build_onboarding_cluster_map.py — populate onboarding_topic_clusters.

Phase 1.8 (TikTok mirror plan, 2026-05-10).

For each topic_code in lib/coldStart.js ONBOARDING_TOPIC_MAP, find the top-N
clusters whose articles' interest_tags overlap with the topic's tag set, and
write (topic_code, vq_primary, vq_secondary, weight) rows to
onboarding_topic_clusters.

Run after each codebook retrain (every ~1-3 months). When this table is empty
or stale, lib/coldStart.js falls back to the live-aggregation RPC
(onboarding_clusters_live, migration 108).

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    python scripts/build_onboarding_cluster_map.py [--dry-run] [--top-n 8]

Dependencies: supabase-py.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from typing import Dict, List

try:
    from supabase import create_client
except ImportError:
    sys.exit("Install supabase-py: pip install supabase")

# Mirrors lib/coldStart.js ONBOARDING_TOPIC_MAP. Update both files together.
# Single source of truth: lib/coldStart.js (this is a copy parsed from there
# at runtime — see parse_topic_map below).
DEFAULT_COLD_START_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "lib", "coldStart.js",
)


def parse_topic_map(coldstart_js_path: str) -> Dict[str, List[str]]:
    """Parse ONBOARDING_TOPIC_MAP out of lib/coldStart.js.

    The JS object literal is non-trivial to evaluate from Python, but each
    entry is a single line of the form:
      'ai_ml': { tags: ['ai', 'artificial intelligence', ...] },
    so a regex pulls out (code, [tags]) pairs.
    """
    with open(coldstart_js_path, "r") as f:
        src = f.read()
    # Find the ONBOARDING_TOPIC_MAP block (between the outer '{' and matching '}').
    start = src.find("ONBOARDING_TOPIC_MAP")
    if start < 0:
        sys.exit("ONBOARDING_TOPIC_MAP not found in coldStart.js")
    block_start = src.find("{", start)
    if block_start < 0:
        sys.exit("Block start `{` not found")
    # Walk to matching close brace.
    depth = 0
    end = -1
    for i in range(block_start, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        sys.exit("Block close `}` not found")
    block = src[block_start:end]

    # Extract each row 'code': { tags: ['t1', 't2', ...] }
    pattern = re.compile(
        r"['\"]([a-z_]+)['\"]\s*:\s*\{\s*tags:\s*\[([^\]]*)\]",
        re.MULTILINE,
    )
    out: Dict[str, List[str]] = {}
    for m in pattern.finditer(block):
        code = m.group(1)
        tags_raw = m.group(2)
        tags = [t.strip().strip("'\"") for t in tags_raw.split(",") if t.strip()]
        if code and tags:
            out[code] = tags
    return out


def fetch_top_clusters(client, tags: List[str], top_n: int) -> List[Dict]:
    """Call onboarding_clusters_live RPC for one topic's tags."""
    res = client.rpc("onboarding_clusters_live", {
        "p_tags": tags,
        "p_top_n": top_n,
    }).execute()
    rows = res.data or []
    return rows


def build_map(client, topic_map: Dict[str, List[str]], top_n: int) -> List[Dict]:
    """For each topic, fetch top clusters and build normalized weight rows."""
    rows = []
    for code, tags in sorted(topic_map.items()):
        try:
            clusters = fetch_top_clusters(client, tags, top_n)
        except Exception as e:
            print(f"[warn] {code}: live RPC failed: {e}", file=sys.stderr)
            continue
        if not clusters:
            print(f"[warn] {code}: no matching clusters")
            continue
        total_cnt = sum(int(c.get("cnt", 0)) for c in clusters)
        if total_cnt <= 0:
            continue
        for c in clusters:
            cnt = int(c.get("cnt", 0))
            weight = cnt / total_cnt if total_cnt > 0 else 0
            rows.append({
                "topic_code": code,
                "vq_primary": int(c.get("vq_primary")),
                "vq_secondary": int(c.get("vq_secondary")),
                "weight": float(weight),
            })
        print(f"[ok] {code}: {len(clusters)} clusters, total {total_cnt} articles")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    ap.add_argument("--top-n", type=int, default=8, help="Top-N clusters per topic")
    ap.add_argument(
        "--coldstart",
        default=DEFAULT_COLD_START_PATH,
        help="Path to lib/coldStart.js",
    )
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL + SUPABASE_SERVICE_KEY")
    client = create_client(url, key)

    topic_map = parse_topic_map(args.coldstart)
    print(f"Parsed {len(topic_map)} topics from {args.coldstart}")

    rows = build_map(client, topic_map, args.top_n)
    print(f"Built {len(rows)} (topic, cluster) rows")

    if args.dry_run:
        print(json.dumps(rows[:10], indent=2))
        print(f"[dry-run] would have inserted {len(rows)} rows")
        return

    if not rows:
        sys.exit("No rows to insert")

    # Truncate then bulk insert.
    print("Truncating onboarding_topic_clusters...")
    # Use raw SQL via RPC if available; otherwise delete-all + insert chunks.
    client.from_("onboarding_topic_clusters").delete().neq("topic_code", "").execute()
    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        client.from_("onboarding_topic_clusters").insert(chunk).execute()
        print(f"  inserted {i + len(chunk)}/{len(rows)}")
    print("Done.")


if __name__ == "__main__":
    main()

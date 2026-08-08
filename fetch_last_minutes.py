#!/usr/bin/env python3
"""
fetch_last_minutes.py — pull every article published in the last N minutes
across the full RSS_FEEDS list in rss_sources.py.

Usage:
    python3 fetch_last_minutes.py 30            # last 30 minutes, text
    python3 fetch_last_minutes.py 60 --json     # last 60 minutes, JSON
    python3 fetch_last_minutes.py 90 --category technology
    python3 fetch_last_minutes.py 45 --workers 60 --timeout 8

Requires: requests, feedparser  (pip install requests feedparser)
"""
import sys
import json
import argparse
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import feedparser

from rss_sources import RSS_FEEDS

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
}


def entry_time(entry):
    """Best-effort UTC datetime for an entry, or None if unknown."""
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            # feedparser gives a time.struct_time already normalized to UTC
            return datetime(*t[:6], tzinfo=timezone.utc)
    return None


def dedupe_feeds(feeds):
    seen, out = set(), []
    for f in feeds:
        if f["url"] in seen:
            continue
        seen.add(f["url"])
        out.append(f)
    return out


def fetch_one(feed, cutoff, timeout):
    name, url, cat = feed["name"], feed["url"], feed.get("category", "?")
    try:
        resp = requests.get(url, timeout=timeout, headers=HEADERS)
        parsed = feedparser.parse(resp.content)
    except Exception as e:
        return {"name": name, "error": str(e), "items": []}

    items = []
    for e in parsed.entries:
        ts = entry_time(e)
        if ts is None or ts < cutoff:
            continue
        items.append({
            "title": (e.get("title") or "").strip(),
            "link": e.get("link", ""),
            "published": ts.isoformat(),
            "source": name,
            "category": cat,
        })
    return {"name": name, "error": None, "items": items,
            "no_date": all(entry_time(e) is None for e in parsed.entries) and bool(parsed.entries)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("minutes", type=int, help="look-back window in minutes")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    ap.add_argument("--category", help="restrict to one category (e.g. news, technology)")
    ap.add_argument("--workers", type=int, default=50)
    ap.add_argument("--timeout", type=int, default=8)
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=args.minutes)

    feeds = dedupe_feeds(RSS_FEEDS)
    if args.category:
        feeds = [f for f in feeds if f.get("category") == args.category]

    results, no_date_sources = [], []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(fetch_one, f, cutoff, args.timeout) for f in feeds]
        for fut in as_completed(futures):
            r = fut.result()
            results.extend(r["items"])
            if r.get("no_date"):
                no_date_sources.append(r["name"])

    results.sort(key=lambda x: x["published"], reverse=True)

    if args.json:
        print(json.dumps({
            "window_minutes": args.minutes,
            "generated_at": now.isoformat(),
            "count": len(results),
            "feeds_polled": len(feeds),
            "items": results,
        }, ensure_ascii=False, indent=2))
        return

    print(f"\n{'='*80}")
    print(f"News in the last {args.minutes} min  ·  {len(results)} items  "
          f"·  {len(feeds)} feeds polled  ·  {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*80}\n")
    for it in results:
        hhmm = it["published"][11:16]
        print(f"[{hhmm}Z] ({it['category']}/{it['source']}) {it['title']}")
        print(f"        {it['link']}")
    if not results:
        print("(nothing published in that window)")
    if no_date_sources:
        print(f"\n⚠️  {len(no_date_sources)} feeds carry no per-item timestamp and were "
              f"skipped by the time filter: {', '.join(sorted(no_date_sources)[:15])}"
              + (" …" if len(no_date_sources) > 15 else ""))


if __name__ == "__main__":
    main()

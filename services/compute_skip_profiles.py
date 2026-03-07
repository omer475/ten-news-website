#!/usr/bin/env python3
"""
Compute skip profiles for users.

A "skip" = article shown in feed but never clicked/engaged with.
The skip profile is a tag frequency map from skipped articles,
used to penalize similar content in future feeds.

Run periodically (e.g., every 6 hours via cron or Cloud Scheduler).
"""

import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
supabase = create_client(supabase_url, supabase_key)

LOOKBACK_HOURS = 72  # Consider impressions from last 3 days


def compute_skip_profile(user_id):
    """Compute skip profile for a single user."""
    cutoff = (datetime.now() - timedelta(hours=LOOKBACK_HOURS)).isoformat()

    # Get feed impressions (articles shown to user)
    imp_result = supabase.table('user_feed_impressions') \
        .select('article_id') \
        .eq('user_id', user_id) \
        .gte('created_at', cutoff) \
        .limit(1000) \
        .execute()

    impression_ids = set(r['article_id'] for r in (imp_result.data or []))
    if len(impression_ids) < 10:
        return None  # Not enough data

    # Get engagements (articles user clicked/saved)
    eng_result = supabase.table('user_article_events') \
        .select('article_id') \
        .eq('user_id', user_id) \
        .gte('created_at', cutoff) \
        .in_('event_type', ['article_detail_view', 'article_engaged', 'article_saved']) \
        .limit(500) \
        .execute()

    engaged_ids = set(r['article_id'] for r in (eng_result.data or []))

    # Skipped = shown but never engaged
    skipped_ids = list(impression_ids - engaged_ids)
    if len(skipped_ids) < 5:
        return None

    # Fetch interest_tags for skipped articles
    tag_counts = {}
    for i in range(0, len(skipped_ids), 300):
        batch = skipped_ids[i:i+300]
        result = supabase.table('published_articles') \
            .select('id, interest_tags') \
            .in_('id', batch) \
            .execute()

        for a in (result.data or []):
            tags = a.get('interest_tags') or []
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except:
                    tags = []
            for tag in tags:
                t = tag.lower()
                tag_counts[t] = tag_counts.get(t, 0) + 1

    if not tag_counts:
        return None

    # Normalize to 0-1
    max_count = max(tag_counts.values())
    skip_profile = {t: c / max_count for t, c in tag_counts.items()}

    return skip_profile


def main():
    print("Computing skip profiles...")

    # Get users who have feed impressions
    result = supabase.table('user_feed_impressions') \
        .select('user_id') \
        .gte('created_at', (datetime.now() - timedelta(hours=LOOKBACK_HOURS)).isoformat()) \
        .limit(1000) \
        .execute()

    user_ids = list(set(r['user_id'] for r in (result.data or [])))
    print(f"Found {len(user_ids)} users with feed impressions")

    updated = 0
    for uid in user_ids:
        profile = compute_skip_profile(uid)
        if profile:
            supabase.table('users') \
                .update({'skip_profile': profile}) \
                .eq('id', uid) \
                .execute()
            updated += 1
            top = sorted(profile.items(), key=lambda x: -x[1])[:5]
            print(f"  Updated {uid[:8]}... top skips: {dict(top)}")

    print(f"\nDone: {updated}/{len(user_ids)} users updated")


if __name__ == '__main__':
    main()

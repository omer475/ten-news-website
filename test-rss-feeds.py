#!/usr/bin/env python3
"""Quick test to verify RSS feeds are working"""

import feedparser
import requests
from datetime import datetime, timedelta
from rss_sources import RSS_FEEDS

print("🔍 Testing RSS Feeds")
print("=" * 60)
print(f"Total feeds to test: {len(RSS_FEEDS)}")
print()

# Test time: last 24 hours
cutoff_time = datetime.now() - timedelta(hours=24)

working_feeds = 0
broken_feeds = 0
total_articles = 0

print("Testing first 10 feeds...")
print()

for i, (source_name, feed_url) in enumerate(list(RSS_FEEDS.items())[:10], 1):
    print(f"{i}. {source_name}...")
    
    try:
        # Fetch RSS feed using requests (better SSL handling)
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; TenNewsBot/1.0)'}
        response = requests.get(feed_url, headers=headers, timeout=10, verify=True)
        response.raise_for_status()
        
        # Parse RSS feed
        feed = feedparser.parse(response.content)
        
        if feed.bozo:
            error_msg = str(feed.bozo_exception)[:60] if hasattr(feed, 'bozo_exception') else "Unknown error"
            print(f"   ⚠️ Feed warning: {error_msg}")
            # Don't fail, many feeds have minor issues but still work
        
        # Count recent articles
        recent_count = 0
        for entry in feed.entries:
            try:
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    pub_date = datetime(*entry.published_parsed[:6])
                    if pub_date >= cutoff_time:
                        recent_count += 1
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    pub_date = datetime(*entry.updated_parsed[:6])
                    if pub_date >= cutoff_time:
                        recent_count += 1
            except:
                pass
        
        if recent_count > 0:
            print(f"   ✅ {recent_count} articles in last 24h")
            print(f"      Sample: {feed.entries[0].get('title', 'N/A')[:60]}...")
            working_feeds += 1
            total_articles += recent_count
        else:
            print(f"   ⚠️  0 recent articles (but feed works)")
            working_feeds += 1
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)[:50]}")
        broken_feeds += 1

print()
print("=" * 60)
print(f"✅ Working feeds: {working_feeds}/10")
print(f"❌ Broken feeds: {broken_feeds}/10")
print(f"📰 Total recent articles: {total_articles}")
print("=" * 60)

if working_feeds >= 8:
    print("\n🎉 RSS system is ready to use!")
else:
    print("\n⚠️  Some feeds may need adjustment")


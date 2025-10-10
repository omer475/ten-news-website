"""
Quick test to verify RSS fetching works
Tests 5 sources to confirm the timeout fix
"""

import feedparser
import requests

# Test sources
TEST_SOURCES = [
    ('Reuters World', 'http://feeds.reuters.com/Reuters/worldNews'),
    ('BBC News', 'http://feeds.bbci.co.uk/news/rss.xml'),
    ('TechCrunch', 'http://feeds.feedburner.com/TechCrunch/'),
    ('NASA', 'https://www.nasa.gov/rss/dyn/breaking_news.rss'),
    ('Nature News', 'http://feeds.nature.com/nature/rss/current'),
]

print("🧪 RSS FETCH TEST")
print("=" * 60)
print("Testing the feedparser timeout fix...\n")

for source_name, feed_url in TEST_SOURCES:
    print(f"📡 Testing: {source_name}")
    print(f"   URL: {feed_url}")
    
    try:
        # Use the FIXED method: requests first, then parse
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(feed_url, timeout=10, headers=headers)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        
        if feed.bozo:
            print(f"   ❌ Parse error: {feed.bozo_exception}")
        else:
            articles = len(feed.entries)
            print(f"   ✅ SUCCESS: Found {articles} articles")
            if articles > 0:
                print(f"      Latest: {feed.entries[0].title[:60]}...")
        
    except requests.exceptions.Timeout:
        print(f"   ⏱️  Timeout (>10s)")
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request error: {str(e)[:60]}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)[:60]}")
    
    print()

print("=" * 60)
print("✅ Test complete! If you see articles above, the fix works!")


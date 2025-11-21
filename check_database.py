#!/usr/bin/env python3
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

# Check total articles
total = supabase.table('published_articles').select('id', count='exact').execute()
print(f"\n📊 TOTAL ARTICLES IN DATABASE: {total.count}")

# Check recent articles (last 24 hours)
twentyFourHoursAgo = (datetime.now() - timedelta(hours=24)).isoformat()
recent = supabase.table('published_articles').select('id', count='exact').gte('created_at', twentyFourHoursAgo).execute()
print(f"📊 ARTICLES IN LAST 24 HOURS: {recent.count}")

# Get one article to check its fields
article = supabase.table('published_articles').select('*').limit(1).execute()

if article.data:
    print(f"\n📋 ARTICLE FIELDS IN DATABASE:")
    a = article.data[0]
    print(f"  • title: {'EXISTS' if a.get('title') else 'MISSING'}")
    print(f"  • title_news: {'EXISTS' if a.get('title_news') else 'MISSING'}")
    print(f"  • title_b2: {'EXISTS' if a.get('title_b2') else 'MISSING'}")
    print(f"  • url: {'EXISTS' if a.get('url') else 'MISSING'}")
    print(f"  • source: {'EXISTS' if a.get('source') else 'MISSING'}")
    print(f"  • created_at: {a.get('created_at', 'MISSING')}")
    print(f"  • ai_final_score: {a.get('ai_final_score', 'MISSING')}")
    
    print(f"\n⚠️  PROBLEM FOUND:")
    if not a.get('title') and a.get('title_news'):
        print(f"  ❌ Articles have 'title_news' but NOT 'title'")
        print(f"  ❌ API checks for 'title' field (line 55 in news-supabase.js)")
        print(f"  💡 Solution: API needs to check 'title_news' instead")

# Check if system is running
print(f"\n🔍 DIAGNOSIS:")
if total.count == 0:
    print("  ❌ Database is empty - system has never published articles")
    print("  💡 Solution: Run ./RUN_LIVE_CLUSTERED_SYSTEM.sh")
elif recent.count == 0:
    print("  ⚠️  Database has articles, but all are older than 24 hours")
    print("  💡 Solution: Run the system to publish new articles")
else:
    print("  ✅ Recent articles exist - API should be showing them")
    print("  ⚠️  Possible issue with API query or filtering")


#!/usr/bin/env python3
"""
One-time backfill script: Tag existing articles with countries and topics.
Finds articles with empty countries/topics and runs step 11 tagging on them.
"""

import os
import json
import time
import requests
from dotenv import load_dotenv
from supabase import create_client
from step11_article_tagging import tag_article

load_dotenv('.env.local')

def update_article_tags(supabase_url, service_key, article_id, countries, topics):
    """Update article tags using direct REST API to avoid trigger issues."""
    url = f"{supabase_url}/rest/v1/published_articles?id=eq.{article_id}"
    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    payload = {
        'countries': countries,
        'topics': topics
    }
    response = requests.patch(url, json=payload, headers=headers)
    if response.status_code not in (200, 204):
        raise Exception(f"HTTP {response.status_code}: {response.text}")
    return True

def main():
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    gemini_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    
    if not all([supabase_url, supabase_key, gemini_key]):
        print("❌ Missing env vars. Need SUPABASE_URL, SUPABASE_KEY, and GEMINI_API_KEY")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Fetch articles with empty countries AND topics from last 48 hours
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    
    print("📊 Fetching untagged articles from last 48 hours...")
    
    result = supabase.table('published_articles') \
        .select('id, title_news, summary_bullets_news, category, countries, topics') \
        .gte('created_at', cutoff) \
        .order('ai_final_score', desc=True) \
        .limit(200) \
        .execute()
    
    articles = result.data or []
    print(f"   Found {len(articles)} total articles")
    
    # Filter to only untagged ones (empty countries AND empty topics)
    untagged = [a for a in articles if (not a.get('countries') or len(a.get('countries', [])) == 0) 
                and (not a.get('topics') or len(a.get('topics', [])) == 0)]
    print(f"   {len(untagged)} need tagging\n")
    
    if not untagged:
        print("✅ All articles already tagged!")
        return
    
    tagged_count = 0
    errors = 0
    for i, article in enumerate(untagged):
        title = article.get('title_news', '')
        article_id = article['id']
        category = article.get('category', 'Other')
        
        # Parse bullets
        bullets_raw = article.get('summary_bullets_news', [])
        if isinstance(bullets_raw, str):
            try:
                bullets = json.loads(bullets_raw)
            except:
                bullets = [bullets_raw]
        else:
            bullets = bullets_raw or []
        
        print(f"[{i+1}/{len(untagged)}] Tagging: {title[:60]}...")
        
        try:
            result = tag_article(title, bullets, category, gemini_key)
            countries = result.get('countries', [])
            topics = result.get('topics', [])
            
            print(f"   🌍 Countries: {countries}")
            print(f"   📌 Topics: {topics}")
            
            # Update using direct REST API (avoids trigger issues)
            update_article_tags(supabase_url, supabase_key, article_id, countries, topics)
            
            tagged_count += 1
            print(f"   ✅ Updated article {article_id}")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            errors += 1
        
        # Rate limiting
        if i < len(untagged) - 1:
            time.sleep(1)
    
    print(f"\n{'='*50}")
    print(f"✅ BACKFILL COMPLETE: {tagged_count}/{len(untagged)} articles tagged ({errors} errors)")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()

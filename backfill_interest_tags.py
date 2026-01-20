#!/usr/bin/env python3
"""
Backfill interest_tags for existing published_articles that don't have them.
Uses Gemini to generate 4-8 keywords per article.
"""

import os
import json
import time
from supabase import create_client
import google.generativeai as genai

# Load environment - try multiple sources
from dotenv import load_dotenv

# Try .env.local first (Next.js style), then .env
script_dir = os.path.dirname(os.path.abspath(__file__))
env_local = os.path.join(script_dir, '.env.local')
env_file = os.path.join(script_dir, '.env')

if os.path.exists(env_local):
    load_dotenv(env_local)
    print(f"✅ Loaded environment from .env.local")
elif os.path.exists(env_file):
    load_dotenv(env_file)
    print(f"✅ Loaded environment from .env")
else:
    print("⚠️ No .env file found, using system environment")

# Support multiple variable name formats
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

missing = []
if not SUPABASE_URL: missing.append("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
if not SUPABASE_KEY: missing.append("SUPABASE_SERVICE_KEY")
if not GEMINI_API_KEY: missing.append("GEMINI_API_KEY or GOOGLE_API_KEY")

if missing:
    print(f"❌ Missing environment variables: {', '.join(missing)}")
    print(f"   Check your .env.local or .env file")
    raise ValueError("Missing required environment variables")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

def generate_interest_tags(title: str, bullets: list = None) -> list:
    """Generate 4-8 interest keywords using Gemini."""
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        content = f"Title: {title}"
        if bullets and isinstance(bullets, list):
            content += f"\nSummary: {' '.join(bullets[:3])}"
        
        prompt = f"""Extract 4-8 keywords/tags from this news article for interest-based personalization.

{content}

Rules:
- Return ONLY a JSON array of lowercase strings
- Include: key people, companies, topics, locations, technologies
- Be specific (e.g., "tesla" not just "car", "joe biden" not just "president")
- Include broader categories too (e.g., "tech", "politics", "finance")
- 4-8 tags total

Example output: ["elon musk", "tesla", "electric vehicles", "stock market", "tech", "finance"]

Return ONLY the JSON array, no other text:"""

        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        
        tags = json.loads(text)
        if isinstance(tags, list) and len(tags) >= 4:
            return [t.lower().strip() for t in tags[:8] if isinstance(t, str)]
        return []
    except Exception as e:
        print(f"  Error generating tags: {e}")
        return []

def backfill_articles(hours=24, batch_size=10):
    """Backfill interest_tags for articles from the last N hours."""
    
    print(f"🔍 Finding articles without interest_tags from last {hours} hours...")
    
    # Get articles without tags
    result = supabase.rpc('get_articles_without_tags', {'hours_ago': hours}).execute()
    
    # If RPC doesn't exist, use direct query
    if not result.data:
        from datetime import datetime, timedelta
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        result = supabase.table('published_articles') \
            .select('id, title_news, summary_bullets_news') \
            .gte('created_at', cutoff) \
            .or_('interest_tags.is.null,interest_tags.eq.[]') \
            .order('created_at', desc=True) \
            .limit(200) \
            .execute()
    
    articles = result.data or []
    print(f"📰 Found {len(articles)} articles to process")
    
    if not articles:
        print("✅ All articles already have interest_tags!")
        return
    
    success_count = 0
    error_count = 0
    
    for i, article in enumerate(articles):
        article_id = article['id']
        title = article.get('title_news') or article.get('title', '')
        bullets = article.get('summary_bullets_news') or []
        
        if isinstance(bullets, str):
            try:
                bullets = json.loads(bullets)
            except:
                bullets = []
        
        print(f"\n[{i+1}/{len(articles)}] Article {article_id}: {title[:50]}...")
        
        tags = generate_interest_tags(title, bullets)
        
        if tags:
            try:
                supabase.table('published_articles') \
                    .update({'interest_tags': tags}) \
                    .eq('id', article_id) \
                    .execute()
                print(f"  ✅ Added {len(tags)} tags: {tags}")
                success_count += 1
            except Exception as e:
                print(f"  ❌ Update failed: {e}")
                error_count += 1
        else:
            print(f"  ⚠️ No tags generated")
            error_count += 1
        
        # Rate limiting for Gemini API
        if (i + 1) % batch_size == 0:
            print(f"\n⏳ Processed {i+1} articles, waiting 2 seconds...")
            time.sleep(2)
    
    print(f"\n{'='*50}")
    print(f"✅ Backfill complete!")
    print(f"   Success: {success_count}")
    print(f"   Errors: {error_count}")
    print(f"   Total: {len(articles)}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--hours', type=int, default=24, help='Hours to look back')
    args = parser.parse_args()
    
    backfill_articles(hours=args.hours)

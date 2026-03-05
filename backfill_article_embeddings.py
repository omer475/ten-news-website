#!/usr/bin/env python3
"""
Backfill embeddings for existing published_articles.

Generates embeddings using Gemini gemini-embedding-001 (3072 dims)
and stores them as JSONB in the `embedding` column.
The DB trigger auto-syncs to `embedding_vec` (pgvector).

Usage:
  python backfill_article_embeddings.py

Requires: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY in .env
"""

import os
import re
import time
import requests
from datetime import datetime, timedelta
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ==========================================
# CONFIG
# ==========================================

BATCH_SIZE = 20          # Articles per embedding batch
MAX_WORKERS = 5          # Parallel embedding requests
LOOKBACK_HOURS = 72      # Only backfill articles from last N hours (matches feed window)
RATE_LIMIT_DELAY = 0.1   # Seconds between API calls

# ==========================================
# GEMINI EMBEDDING
# ==========================================

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY must be set in environment")


def get_embedding(text: str) -> Optional[List[float]]:
    """Get Gemini embedding for a text string (3072 dims)."""
    try:
        clean_text = re.sub(r'&#\d+;|&\w+;', '', text)
        clean_text = clean_text.strip()[:500]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": clean_text}]}
        }

        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result['embedding']['values']
    except Exception as e:
        print(f"  ⚠️ Embedding error: {e}")
        return None


def get_embedding_with_retry(text: str, retries: int = 3) -> Optional[List[float]]:
    """Get embedding with retry logic for rate limits."""
    for attempt in range(retries):
        result = get_embedding(text)
        if result is not None:
            return result
        if attempt < retries - 1:
            wait = (attempt + 1) * 2
            print(f"    Retrying in {wait}s...")
            time.sleep(wait)
    return None


# ==========================================
# MAIN BACKFILL
# ==========================================

def main():
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

    supabase = create_client(supabase_url, supabase_key)

    # Get articles missing embeddings
    cutoff = (datetime.now() - timedelta(hours=LOOKBACK_HOURS)).isoformat()

    print(f"🔍 Fetching articles from last {LOOKBACK_HOURS}h without embeddings...")

    result = supabase.table('published_articles') \
        .select('id, title_news, category, topics, countries') \
        .gte('created_at', cutoff) \
        .is_('embedding', 'null') \
        .order('created_at', desc=True) \
        .limit(1000) \
        .execute()

    articles = result.data
    total = len(articles)

    if total == 0:
        print("✅ No articles need backfilling!")
        return

    print(f"📊 Found {total} articles to backfill\n")

    success_count = 0
    fail_count = 0

    for i in range(0, total, BATCH_SIZE):
        batch = articles[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"📦 Batch {batch_num}/{total_batches} ({len(batch)} articles)")

        def process_article(article):
            title = article.get('title_news', '')
            category = article.get('category', '')
            topics = article.get('topics', [])
            countries = article.get('countries', [])

            if isinstance(topics, str):
                try:
                    import json
                    topics = json.loads(topics)
                except:
                    topics = []
            if isinstance(countries, str):
                try:
                    import json
                    countries = json.loads(countries)
                except:
                    countries = []

            embed_text = f"{title} {category} {' '.join(topics or [])} {' '.join(countries or [])}"
            embedding = get_embedding_with_retry(embed_text)

            if embedding:
                try:
                    supabase.table('published_articles') \
                        .update({'embedding': embedding}) \
                        .eq('id', article['id']) \
                        .execute()
                    return True, article['id'], title[:60]
                except Exception as e:
                    return False, article['id'], str(e)
            return False, article['id'], "No embedding generated"

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_article, a): a for a in batch}
            for future in as_completed(futures):
                ok, aid, info = future.result()
                if ok:
                    success_count += 1
                    print(f"  ✅ [{aid}] {info}...")
                else:
                    fail_count += 1
                    print(f"  ❌ [{aid}] {info}")

        # Rate limit between batches
        if i + BATCH_SIZE < total:
            time.sleep(RATE_LIMIT_DELAY * BATCH_SIZE)

    print(f"\n{'='*50}")
    print(f"🏁 Backfill complete!")
    print(f"   ✅ Success: {success_count}/{total}")
    print(f"   ❌ Failed:  {fail_count}/{total}")
    print(f"\nThe DB trigger auto-synced embedding → embedding_vec (pgvector).")
    print(f"The feed API can now use these for similarity search.")


if __name__ == '__main__':
    main()

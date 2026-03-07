#!/usr/bin/env python3
"""
Backfill MiniLM embeddings for existing published_articles.

Generates 384-dim embeddings using sentence-transformers all-MiniLM-L6-v2
and stores them as JSONB in the `embedding_minilm` column.
The DB trigger auto-syncs to `embedding_minilm_vec` (pgvector).

Also backfills user taste_vector_minilm from engagement history.

Usage:
  python backfill_minilm_embeddings.py
"""

import os
import re
import json
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Try multiple env file locations
for env_path in [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.env.local'),
    os.path.expanduser('~/Ten News Website/.env.local'),
]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break
else:
    load_dotenv()

BATCH_SIZE = 64
LOOKBACK_HOURS = 72

supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
supabase = create_client(supabase_url, supabase_key)

print("Loading MiniLM model...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
print(f"Model loaded ({model.get_sentence_embedding_dimension()}-dim)")


def backfill_articles():
    """Backfill MiniLM embeddings for articles missing them."""
    cutoff = (datetime.now() - timedelta(hours=LOOKBACK_HOURS)).isoformat()

    print(f"\nFetching articles from last {LOOKBACK_HOURS}h without MiniLM embeddings...")

    result = supabase.table('published_articles') \
        .select('id, title_news, category, topics, countries') \
        .gte('created_at', cutoff) \
        .is_('embedding_minilm', 'null') \
        .order('created_at', desc=True) \
        .limit(2000) \
        .execute()

    articles = result.data or []
    total = len(articles)

    if total == 0:
        print("No articles need MiniLM backfilling!")
        return

    print(f"Found {total} articles to embed\n")

    # Prepare texts
    texts = []
    for a in articles:
        title = a.get('title_news', '')
        category = a.get('category', '')
        topics = a.get('topics', [])
        countries = a.get('countries', [])
        if isinstance(topics, str):
            try: topics = json.loads(topics)
            except: topics = []
        if isinstance(countries, str):
            try: countries = json.loads(countries)
            except: countries = []
        embed_text = f"{title} {category} {' '.join(topics or [])} {' '.join(countries or [])}"
        clean_text = re.sub(r'&#\d+;|&\w+;', '', embed_text).strip()[:500]
        texts.append(clean_text)

    # Batch encode
    success = 0
    for i in range(0, total, BATCH_SIZE):
        batch_texts = texts[i:i + BATCH_SIZE]
        batch_articles = articles[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"Batch {batch_num}/{total_batches} ({len(batch_texts)} articles)...")

        embeddings = model.encode(batch_texts, batch_size=BATCH_SIZE, show_progress_bar=False)

        for art, emb in zip(batch_articles, embeddings):
            try:
                supabase.table('published_articles') \
                    .update({'embedding_minilm': emb.tolist()}) \
                    .eq('id', art['id']) \
                    .execute()
                success += 1
            except Exception as e:
                print(f"  Failed [{art['id']}]: {e}")

    print(f"\nArticle backfill complete: {success}/{total}")


def backfill_user_taste_vectors():
    """Rebuild MiniLM taste vectors for users with engagement history."""
    print("\nBackfilling user MiniLM taste vectors...")

    # Get users with taste vectors (they have engagement history)
    result = supabase.table('users') \
        .select('id') \
        .not_.is_('taste_vector', 'null') \
        .is_('taste_vector_minilm', 'null') \
        .limit(500) \
        .execute()

    users = result.data or []
    print(f"Found {len(users)} users needing MiniLM taste vectors")

    for user in users:
        uid = user['id']

        # Get recent engagements
        cutoff = (datetime.now() - timedelta(days=14)).isoformat()
        events = supabase.table('user_article_events') \
            .select('article_id, event_type') \
            .eq('user_id', uid) \
            .gte('created_at', cutoff) \
            .in_('event_type', ['article_saved', 'article_engaged', 'article_detail_view']) \
            .order('created_at', desc=False) \
            .limit(500) \
            .execute()

        if not events.data:
            continue

        article_ids = list(set(e['article_id'] for e in events.data))

        # Fetch MiniLM embeddings
        emb_map = {}
        for i in range(0, len(article_ids), 300):
            batch = article_ids[i:i+300]
            res = supabase.table('published_articles') \
                .select('id, embedding_minilm') \
                .in_('id', batch) \
                .not_.is_('embedding_minilm', 'null') \
                .execute()
            for a in (res.data or []):
                emb_map[a['id']] = a['embedding_minilm']

        if not emb_map:
            continue

        # Build EMA taste vector
        event_weights = {'article_saved': 0.15, 'article_engaged': 0.10, 'article_detail_view': 0.05}
        taste = None
        for e in events.data:
            emb = emb_map.get(e['article_id'])
            if emb is None: continue
            alpha = event_weights.get(e['event_type'], 0.05)
            arr = np.array(emb, dtype=np.float64)
            taste = arr.copy() if taste is None else (1 - alpha) * taste + alpha * arr

        if taste is not None:
            supabase.table('users') \
                .update({'taste_vector_minilm': taste.tolist()}) \
                .eq('id', uid) \
                .execute()
            print(f"  Updated user {uid[:8]}... ({len(emb_map)} articles)")

    print("User taste vector backfill complete!")


def backfill_cluster_minilm():
    """Rebuild MiniLM medoids for user interest clusters."""
    print("\nBackfilling cluster MiniLM medoids...")

    result = supabase.table('user_interest_clusters') \
        .select('id, medoid_article_id') \
        .is_('medoid_minilm', 'null') \
        .not_.is_('medoid_article_id', 'null') \
        .limit(500) \
        .execute()

    clusters = result.data or []
    print(f"Found {len(clusters)} clusters needing MiniLM medoids")

    article_ids = list(set(c['medoid_article_id'] for c in clusters if c.get('medoid_article_id')))
    if not article_ids:
        return

    emb_map = {}
    for i in range(0, len(article_ids), 300):
        batch = article_ids[i:i+300]
        res = supabase.table('published_articles') \
            .select('id, embedding_minilm') \
            .in_('id', batch) \
            .not_.is_('embedding_minilm', 'null') \
            .execute()
        for a in (res.data or []):
            emb_map[a['id']] = a['embedding_minilm']

    updated = 0
    for c in clusters:
        emb = emb_map.get(c.get('medoid_article_id'))
        if emb:
            supabase.table('user_interest_clusters') \
                .update({'medoid_minilm': emb}) \
                .eq('id', c['id']) \
                .execute()
            updated += 1

    print(f"Updated {updated}/{len(clusters)} cluster medoids")


if __name__ == '__main__':
    print("=" * 60)
    print("  MiniLM EMBEDDING BACKFILL")
    print("=" * 60)

    backfill_articles()
    backfill_user_taste_vectors()
    backfill_cluster_minilm()

    print("\n" + "=" * 60)
    print("  BACKFILL COMPLETE")
    print("=" * 60)

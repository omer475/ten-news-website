"""
Backfill typed_signals for existing published_articles.
Uses Gemini for NER extraction. Processes articles from last 30 days in batches.

Usage:
  python scripts/backfill_typed_signals.py [--days 30] [--batch-size 50] [--dry-run]
"""

import os
import sys
import json
import re
import time
import unicodedata
import argparse
from datetime import datetime, timedelta

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

SIGNAL_CATEGORY_BLOCKLIST = {
    'tech', 'technology', 'science', 'world', 'politics', 'sports',
    'entertainment', 'business', 'health', 'lifestyle', 'finance',
    'news', 'breaking', 'opinion', 'culture', 'education',
}

def slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
    return s

def build_typed_signals_from_existing(article):
    """Build typed signals from existing article fields (interest_tags, countries, topics).
    This is a lightweight version that doesn't require NER — used for backfill when
    we want to avoid expensive LLM calls for every article."""
    signals = []
    seen = set()

    def add(signal_type, value):
        slug = slugify(value)
        if not slug or slug in SIGNAL_CATEGORY_BLOCKLIST or len(slug) > 64:
            return
        sig = f"{signal_type}:{slug}"
        if sig not in seen:
            seen.add(sig)
            signals.append(sig)

    # Locations from countries
    countries = article.get('countries') or []
    if isinstance(countries, str):
        try: countries = json.loads(countries)
        except: countries = []
    for c in countries:
        add('loc', c)

    # Language: default English (detect Turkish sources)
    source = (article.get('source') or '').lower()
    turkish_sources = {'sözcü', 'cumhuriyet', 'anadolu agency', 'sozcu'}
    if any(ts in source for ts in turkish_sources):
        add('lang', 'tr')
    else:
        add('lang', 'en')

    # Interest tags → classify into entity types based on patterns
    tags = article.get('interest_tags') or []
    if isinstance(tags, str):
        try: tags = json.loads(tags)
        except: tags = []

    for tag in tags:
        t = tag.lower().strip()
        if not t or t in SIGNAL_CATEGORY_BLOCKLIST:
            continue

        # Heuristic: multi-word names with capitals → likely person or org
        words = tag.strip().split()
        if len(words) >= 2 and all(w[0].isupper() for w in words if len(w) > 2):
            # Check if it looks like a person name (2-3 capitalized words)
            if len(words) <= 3 and not any(kw in t for kw in ['university', 'institute', 'inc', 'corp', 'agency', 'party', 'bank', 'committee']):
                add('person', tag.strip())
            else:
                add('org', tag.strip())
        elif any(kw in t for kw in ['cup', 'championship', 'masters', 'olympics', 'summit', 'conference', 'festival']):
            add('event', tag.strip())
        elif any(kw in t for kw in ['iphone', 'galaxy', 'playstation', 'xbox', 'tesla model']):
            add('product', tag.strip())
        else:
            # Default to topic for remaining tags
            add('topic', tag.strip())

    return signals

def build_typed_signals_with_ner(article, gemini_model):
    """Full NER-based extraction using Gemini. More accurate but costs API calls."""
    title = article.get('title_news', '')
    bullets = article.get('summary_bullets_news', [])
    if isinstance(bullets, str):
        try: bullets = json.loads(bullets)
        except: bullets = [bullets]

    bullet_text = ' | '.join(bullets) if isinstance(bullets, list) else str(bullets)

    prompt = f"""Extract named entities from this news article. Return ONLY valid JSON, no markdown.

Title: {title}
Content: {bullet_text}

Return JSON:
{{
  "organizations": [],
  "people": [],
  "events": [],
  "products": [],
  "cities": [],
  "narrow_topics": []
}}

Rules:
- organizations: companies, agencies, sports teams
- people: full names only
- events: named events like "World Cup 2026"
- products: product/franchise names
- cities: city-level locations
- narrow_topics: 2-5 specific concepts, NEVER category names like "tech" or "sports"
"""

    try:
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith('```'): text = text.split('\n', 1)[1] if '\n' in text else text[3:]
        if text.endswith('```'): text = text[:-3]
        if text.startswith('json'): text = text[4:]
        ner = json.loads(text.strip())
    except Exception as e:
        print(f"  NER failed for {article['id']}: {e}")
        ner = {}

    signals = []
    seen = set()

    def add(signal_type, value):
        slug = slugify(value)
        if not slug or slug in SIGNAL_CATEGORY_BLOCKLIST or len(slug) > 64:
            return
        sig = f"{signal_type}:{slug}"
        if sig not in seen:
            seen.add(sig)
            signals.append(sig)

    for org in ner.get('organizations', []): add('org', org)
    for person in ner.get('people', []): add('person', person)
    for event in ner.get('events', []): add('event', event)
    for product in ner.get('products', []): add('product', product)
    for city in ner.get('cities', []): add('loc', city)
    for topic in ner.get('narrow_topics', []): add('topic', topic)

    # Always include countries as locations
    countries = article.get('countries') or []
    if isinstance(countries, str):
        try: countries = json.loads(countries)
        except: countries = []
    for c in countries:
        add('loc', c)

    # Language
    source = (article.get('source') or '').lower()
    if any(ts in source for ts in ['sözcü', 'cumhuriyet', 'sozcu']):
        add('lang', 'tr')
    else:
        add('lang', 'en')

    return signals


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--days', type=int, default=30, help='Days of articles to backfill')
    parser.add_argument('--batch-size', type=int, default=50, help='Articles per batch')
    parser.add_argument('--use-ner', action='store_true', help='Use Gemini NER (slower, more accurate)')
    parser.add_argument('--dry-run', action='store_true', help='Print signals without writing')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    gemini_model = None
    if args.use_ner:
        if not GEMINI_API_KEY:
            print("Error: GEMINI_API_KEY required for --use-ner")
            sys.exit(1)
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-2.5-flash-lite')
        print(f"Using Gemini NER for extraction")

    cutoff = (datetime.utcnow() - timedelta(days=args.days)).isoformat()
    print(f"Backfilling articles from {cutoff} (last {args.days} days)")

    # Count total articles
    count_result = supabase.table('published_articles') \
        .select('id', count='exact') \
        .gte('created_at', cutoff) \
        .execute()
    total = count_result.count or 0
    print(f"Total articles to process: {total}")

    offset = 0
    processed = 0
    skipped = 0

    while offset < total:
        batch = supabase.table('published_articles') \
            .select('id, title_news, summary_bullets_news, interest_tags, countries, source, typed_signals') \
            .gte('created_at', cutoff) \
            .order('created_at', desc=True) \
            .range(offset, offset + args.batch_size - 1) \
            .execute()

        if not batch.data:
            break

        for article in batch.data:
            # Skip if already has typed_signals
            existing = article.get('typed_signals')
            if existing and isinstance(existing, list) and len(existing) > 0:
                skipped += 1
                continue

            if args.use_ner and gemini_model:
                signals = build_typed_signals_with_ner(article, gemini_model)
                time.sleep(0.1)  # Rate limit
            else:
                signals = build_typed_signals_from_existing(article)

            if args.dry_run:
                title = (article.get('title_news') or '')[:60]
                print(f"  [{article['id']}] {title}... → {signals[:5]}")
            else:
                supabase.table('published_articles') \
                    .update({'typed_signals': signals}) \
                    .eq('id', article['id']) \
                    .execute()

            processed += 1

        offset += args.batch_size
        print(f"  Processed {processed}/{total} (skipped {skipped} already done)")

    print(f"\nDone! Processed: {processed}, Skipped: {skipped}")


if __name__ == '__main__':
    main()

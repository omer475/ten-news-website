#!/usr/bin/env python3
"""
Analyze article-to-entity matching quality.
Checks if articles are correctly placed under Explore entities.
"""

import os
import json
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Step 1: Get all concept entities
print("=" * 100)
print("STEP 1: Fetching all concept entities...")
print("=" * 100)

entities_result = supabase.table('concept_entities') \
    .select('id, entity_name, category') \
    .execute()

entities = entities_result.data
print(f"Found {len(entities)} concept entities")

# Show categories
cats = {}
for e in entities:
    cat = e.get('category', 'Unknown')
    cats[cat] = cats.get(cat, 0) + 1

for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")

# Step 2: Get recent published articles with their interest_tags
print(f"\n{'=' * 100}")
print("STEP 2: Fetching recent articles with interest_tags...")
print("=" * 100)

cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
articles_result = supabase.table('published_articles') \
    .select('id, cluster_id, title_news, category, interest_tags, published_at') \
    .gte('published_at', cutoff) \
    .order('published_at', desc=True) \
    .limit(1000) \
    .execute()

articles = articles_result.data
print(f"Found {len(articles)} articles in last 48h")

# Step 3: Build entity -> articles mapping
print(f"\n{'=' * 100}")
print("STEP 3: Analyzing entity-to-article mapping...")
print("=" * 100)

entity_names = {e['entity_name'].lower(): e for e in entities}

# Map: entity -> list of articles tagged with it
entity_articles = {}
for article in articles:
    tags = article.get('interest_tags') or []
    title = (article.get('title_news') or '').strip()
    title_clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', title)

    for tag in tags:
        tag_lower = tag.lower()
        if tag_lower not in entity_articles:
            entity_articles[tag_lower] = []
        entity_articles[tag_lower].append({
            'id': article['id'],
            'title': title_clean[:100],
            'category': article.get('category', ''),
            'all_tags': tags,
        })

# Step 4: Check each entity for mismatched articles
print(f"\n{'=' * 100}")
print("STEP 4: ENTITY-BY-ENTITY QUALITY CHECK")
print("=" * 100)

# Focus on entities that have articles
problem_entities = []

for entity in sorted(entities, key=lambda e: e['entity_name']):
    ename = entity['entity_name']
    ename_lower = ename.lower()

    matched_articles = entity_articles.get(ename_lower, [])
    if not matched_articles:
        continue

    # Heuristic: check if article titles seem related to the entity
    # We'll flag articles where the entity name (or key words) don't appear in title or tags
    entity_words = set(ename_lower.replace('-', ' ').replace('_', ' ').split())
    # Remove very short/generic words
    entity_words = {w for w in entity_words if len(w) > 2}

    suspicious = []
    for art in matched_articles:
        title_lower = art['title'].lower()
        tags_lower = ' '.join(art['all_tags']).lower()
        combined = title_lower + ' ' + tags_lower

        # Check if ANY entity word appears in title or tags
        word_match = any(w in combined for w in entity_words)

        # Also check for common abbreviation patterns
        abbrev_match = ename_lower.replace(' ', '') in combined.replace(' ', '')

        if not word_match and not abbrev_match:
            suspicious.append(art)

    if suspicious:
        problem_entities.append({
            'entity': ename,
            'category': entity.get('category', ''),
            'total_articles': len(matched_articles),
            'suspicious': suspicious,
            'good': [a for a in matched_articles if a not in suspicious]
        })

# Sort by number of suspicious articles
problem_entities.sort(key=lambda x: -len(x['suspicious']))

print(f"\nEntities with potentially mismatched articles: {len(problem_entities)}")
print()

for pe in problem_entities[:30]:
    suspicious_pct = len(pe['suspicious']) / pe['total_articles'] * 100
    print(f"\n{'─' * 80}")
    print(f"🏷️  {pe['entity']} ({pe['category']}) — {pe['total_articles']} articles, {len(pe['suspicious'])} suspicious ({suspicious_pct:.0f}%)")
    print(f"{'─' * 80}")

    if pe['good']:
        print(f"  ✅ CORRECT ({len(pe['good'])}):")
        for a in pe['good'][:3]:
            print(f"     {a['title'][:90]}")
        if len(pe['good']) > 3:
            print(f"     ... and {len(pe['good']) - 3} more")

    print(f"  ❌ SUSPICIOUS ({len(pe['suspicious'])}):")
    for a in pe['suspicious']:
        print(f"     {a['title'][:90]}")
        print(f"       Tags: {', '.join(a['all_tags'][:8])}")

# Step 5: Summary stats
print(f"\n{'=' * 100}")
print("SUMMARY")
print("=" * 100)

total_entity_articles = sum(len(v) for v in entity_articles.values())
total_suspicious = sum(len(pe['suspicious']) for pe in problem_entities)
total_entities_with_articles = len([k for k, v in entity_articles.items() if v])

print(f"  Entities with articles: {total_entities_with_articles}")
print(f"  Total article-entity associations: {total_entity_articles}")
print(f"  Potentially mismatched: {total_suspicious} ({total_suspicious/total_entity_articles*100:.1f}%)" if total_entity_articles > 0 else "")
print(f"  Entities with issues: {len(problem_entities)}")

# Step 6: Show the worst offenders by entity
print(f"\n{'=' * 100}")
print("WORST ENTITIES (highest % suspicious)")
print("=" * 100)

for pe in sorted(problem_entities, key=lambda x: -len(x['suspicious'])/x['total_articles'])[:15]:
    pct = len(pe['suspicious']) / pe['total_articles'] * 100
    print(f"  {pe['entity']:40s} | {pe['total_articles']:3d} articles | {len(pe['suspicious']):3d} suspicious ({pct:.0f}%)")

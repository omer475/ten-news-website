#!/usr/bin/env python3
"""
Deep analysis: What articles appear under each Explore entity?
Uses the same ANN (embedding similarity) matching that the app uses.
"""

import os
import json
import re
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Get all concept entities with their embeddings
print("Fetching concept entities...")
entities_result = supabase.table('concept_entities') \
    .select('id, entity_name, category, embedding') \
    .execute()
entities = entities_result.data
print(f"Found {len(entities)} entities")

# Get recent articles with their MiniLM embeddings
print("Fetching recent articles with embeddings...")
cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
articles_result = supabase.table('published_articles') \
    .select('id, cluster_id, title_news, category, interest_tags, embedding_minilm, published_at') \
    .gte('published_at', cutoff) \
    .order('published_at', desc=True) \
    .limit(500) \
    .execute()
articles = articles_result.data
print(f"Found {len(articles)} articles")

# Filter to those with MiniLM embeddings
articles_with_emb = [a for a in articles if a.get('embedding_minilm')]
print(f"  With MiniLM embeddings: {len(articles_with_emb)}")

# Also check which entities have embeddings
entities_with_emb = [e for e in entities if e.get('embedding')]
print(f"  Entities with embeddings: {len(entities_with_emb)}")

def cosine_sim(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0
    return float(dot / norm)

def clean_title(t):
    return re.sub(r'\*\*([^*]+)\*\*', r'\1', t or '').strip()

# For each entity, find articles that match via embedding similarity
# This mimics what the app's match_concept_entities RPC does
MATCH_THRESHOLD = 0.45  # Same as in the pipeline code

print(f"\n{'='*100}")
print(f"ENTITY-BY-ARTICLE MATCHING (threshold: {MATCH_THRESHOLD})")
print(f"{'='*100}")

entity_issues = []

for entity in sorted(entities_with_emb, key=lambda e: e['entity_name']):
    ename = entity['entity_name']
    ecat = entity.get('category', '')
    e_emb = entity['embedding']

    if not e_emb or len(e_emb) < 10:
        continue

    # Find all articles that match this entity
    matches = []
    for art in articles_with_emb:
        a_emb = art['embedding_minilm']
        if not a_emb or len(a_emb) != len(e_emb):
            continue
        sim = cosine_sim(e_emb, a_emb)
        if sim >= MATCH_THRESHOLD:
            matches.append({
                'sim': sim,
                'title': clean_title(art['title_news'])[:100],
                'category': art.get('category', ''),
                'tags': art.get('interest_tags', []),
                'id': art['id'],
            })

    if not matches:
        continue

    matches.sort(key=lambda x: -x['sim'])

    # Check if matches make sense
    # A match is "bad" if the article's category and title have nothing to do with the entity
    entity_words = set(ename.lower().replace('-', ' ').replace('_', ' ').split())
    entity_words = {w for w in entity_words if len(w) > 2}

    bad_matches = []
    good_matches = []
    for m in matches:
        title_lower = m['title'].lower()
        tags_str = ' '.join(m['tags']).lower()
        combined = title_lower + ' ' + tags_str + ' ' + m['category'].lower()

        # Check word overlap
        has_overlap = any(w in combined for w in entity_words)

        # Also check category match
        cat_match = ecat.lower() in m['category'].lower() or m['category'].lower() in ecat.lower()

        if has_overlap or cat_match:
            good_matches.append(m)
        else:
            bad_matches.append(m)

    if bad_matches:
        entity_issues.append({
            'entity': ename,
            'category': ecat,
            'total': len(matches),
            'good': good_matches,
            'bad': bad_matches,
        })

# Sort by number of bad matches
entity_issues.sort(key=lambda x: -len(x['bad']))

print(f"\nEntities with mismatched articles: {len(entity_issues)}")

for ei in entity_issues[:40]:
    bad_pct = len(ei['bad']) / ei['total'] * 100
    print(f"\n{'─'*90}")
    print(f"🏷️  {ei['entity']} ({ei['category']}) — {ei['total']} matches, {len(ei['bad'])} BAD ({bad_pct:.0f}%)")
    print(f"{'─'*90}")

    if ei['good']:
        print(f"  ✅ CORRECT ({len(ei['good'])}):")
        for m in ei['good'][:3]:
            print(f"     [{m['sim']:.2f}] {m['title'][:85]}")
        if len(ei['good']) > 3:
            print(f"     ... +{len(ei['good'])-3} more")

    print(f"  ❌ WRONG ({len(ei['bad'])}):")
    for m in ei['bad'][:5]:
        print(f"     [{m['sim']:.2f}] {m['title'][:85]}")
        print(f"            Cat: {m['category']} | Tags: {', '.join(m['tags'][:5])}")
    if len(ei['bad']) > 5:
        print(f"     ... +{len(ei['bad'])-5} more")

# Summary
print(f"\n{'='*100}")
print(f"SUMMARY")
print(f"{'='*100}")
total_matches = sum(ei['total'] for ei in entity_issues)
total_bad = sum(len(ei['bad']) for ei in entity_issues)
total_good = sum(len(ei['good']) for ei in entity_issues)

# Also count entities with no issues
clean_entities = len(entities_with_emb) - len(entity_issues)
print(f"  Total entities checked: {len(entities_with_emb)}")
print(f"  Clean entities (no issues): {clean_entities}")
print(f"  Entities with issues: {len(entity_issues)}")
if total_matches > 0:
    print(f"  Bad matches in problematic entities: {total_bad}/{total_matches} ({total_bad/total_matches*100:.0f}%)")

# Top problem categories
cat_issues = {}
for ei in entity_issues:
    cat = ei['category']
    if cat not in cat_issues:
        cat_issues[cat] = {'entities': 0, 'bad': 0, 'total': 0}
    cat_issues[cat]['entities'] += 1
    cat_issues[cat]['bad'] += len(ei['bad'])
    cat_issues[cat]['total'] += ei['total']

print(f"\n  Issues by category:")
for cat, stats in sorted(cat_issues.items(), key=lambda x: -x[1]['bad']):
    pct = stats['bad'] / stats['total'] * 100 if stats['total'] > 0 else 0
    print(f"    {cat:25s} | {stats['entities']:3d} entities | {stats['bad']:3d} bad matches ({pct:.0f}%)")

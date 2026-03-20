#!/usr/bin/env python3
"""
Deep entity matching analysis — check what articles show up under each entity.
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

def parse_embedding(emb):
    """Parse embedding that might be string or list."""
    if isinstance(emb, list):
        return np.array(emb, dtype=np.float32)
    if isinstance(emb, str):
        try:
            return np.array(json.loads(emb), dtype=np.float32)
        except:
            return None
    return None

def cosine_sim(a, b):
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(dot / norm) if norm > 0 else 0

def clean_title(t):
    return re.sub(r'\*\*([^*]+)\*\*', r'\1', t or '').strip()

# Fetch entities
print("Fetching entities...")
entities = supabase.table('concept_entities') \
    .select('id, entity_name, category, embedding') \
    .limit(1000).execute().data
print(f"  {len(entities)} entities")

# Parse entity embeddings
entity_data = []
dims = set()
for e in entities:
    emb = parse_embedding(e.get('embedding'))
    if emb is not None:
        dims.add(len(emb))
        entity_data.append({
            'name': e['entity_name'],
            'category': e.get('category', ''),
            'emb': emb,
            'dim': len(emb),
        })
print(f"  Parsed: {len(entity_data)} with embeddings")
print(f"  Dimensions found: {dims}")

# Fetch articles
print("\nFetching articles...")
cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
articles = supabase.table('published_articles') \
    .select('id, title_news, category, interest_tags, embedding_minilm, published_at') \
    .gte('published_at', cutoff) \
    .order('published_at', desc=True) \
    .limit(500).execute().data

art_data = []
for a in articles:
    emb = parse_embedding(a.get('embedding_minilm'))
    if emb is not None:
        art_data.append({
            'title': clean_title(a.get('title_news', '')),
            'category': a.get('category', ''),
            'tags': a.get('interest_tags', []) or [],
            'emb': emb,
            'dim': len(emb),
        })
print(f"  {len(art_data)} articles with embeddings (dim: {art_data[0]['dim'] if art_data else '?'})")

# Match dimensions
entity_dim = art_data[0]['dim'] if art_data else 384
matching_entities = [e for e in entity_data if e['dim'] == entity_dim]
print(f"  Entities matching article dim ({entity_dim}): {len(matching_entities)}")
if not matching_entities:
    # Try all dims
    for d in dims:
        matching = [e for e in entity_data if e['dim'] == d]
        arts = [a for a in art_data if a['dim'] == d]
        print(f"    dim={d}: {len(matching)} entities, {len(arts)} articles")

# Do the matching
THRESHOLD = 0.45
print(f"\n{'='*100}")
print(f"MATCHING ENTITIES TO ARTICLES (threshold={THRESHOLD})")
print(f"{'='*100}")

problems = []

for ent in matching_entities:
    matches = []
    for art in art_data:
        if art['dim'] != ent['dim']:
            continue
        sim = cosine_sim(ent['emb'], art['emb'])
        if sim >= THRESHOLD:
            matches.append((sim, art))

    if not matches:
        continue

    matches.sort(key=lambda x: -x[0])

    # Check quality of matches
    ename_words = set(ent['name'].lower().replace('-', ' ').replace('_', ' ').split())
    ename_words = {w for w in ename_words if len(w) > 1}

    wrong = []
    right = []
    for sim, art in matches:
        combined = (art['title'] + ' ' + ' '.join(art['tags']) + ' ' + art['category']).lower()
        has_match = any(w in combined for w in ename_words)
        if has_match:
            right.append((sim, art))
        else:
            wrong.append((sim, art))

    if wrong:
        problems.append({
            'entity': ent['name'],
            'category': ent['category'],
            'total': len(matches),
            'right': right,
            'wrong': wrong,
        })

problems.sort(key=lambda x: -len(x['wrong']))

print(f"\nEntities with mismatched articles: {len(problems)}")
print()

for p in problems[:30]:
    wrong_pct = len(p['wrong']) / p['total'] * 100
    print(f"{'─'*90}")
    print(f"🏷️  {p['entity']} ({p['category']}) — {p['total']} matches, {len(p['wrong'])} WRONG ({wrong_pct:.0f}%)")

    if p['right']:
        print(f"  ✅ Correct ({len(p['right'])}):")
        for sim, art in p['right'][:2]:
            print(f"     [{sim:.3f}] {art['title'][:85]}")

    print(f"  ❌ Wrong ({len(p['wrong'])}):")
    for sim, art in p['wrong'][:5]:
        print(f"     [{sim:.3f}] {art['title'][:85]}")
        print(f"            Cat: {art['category']} | Tags: {', '.join(art['tags'][:5])}")
    if len(p['wrong']) > 5:
        print(f"     ... +{len(p['wrong'])-5} more")
    print()

# Summary by category
print(f"{'='*100}")
print("SUMMARY BY CATEGORY")
print(f"{'='*100}")
cat_stats = {}
for p in problems:
    c = p['category']
    if c not in cat_stats:
        cat_stats[c] = {'entities': 0, 'wrong': 0, 'total': 0}
    cat_stats[c]['entities'] += 1
    cat_stats[c]['wrong'] += len(p['wrong'])
    cat_stats[c]['total'] += p['total']

for cat, s in sorted(cat_stats.items(), key=lambda x: -x[1]['wrong']):
    pct = s['wrong'] / s['total'] * 100 if s['total'] > 0 else 0
    print(f"  {cat:25s} | {s['entities']:3d} entities | {s['wrong']:3d}/{s['total']:3d} wrong ({pct:.0f}%)")

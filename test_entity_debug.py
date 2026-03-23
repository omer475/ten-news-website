#!/usr/bin/env python3
"""Debug: Check embedding dimensions and actual ANN matching."""

import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Check entity embedding dimensions
print("=== ENTITY EMBEDDINGS ===")
e_result = supabase.table('concept_entities') \
    .select('id, entity_name, category, embedding') \
    .limit(5) \
    .execute()

for e in e_result.data:
    emb = e.get('embedding')
    dim = len(emb) if emb else 0
    print(f"  {e['entity_name']:40s} | embedding dim: {dim}")

# Check article embedding dimensions
print("\n=== ARTICLE EMBEDDINGS ===")
cutoff = (datetime.now() - timedelta(hours=24)).isoformat()
a_result = supabase.table('published_articles') \
    .select('id, title_news, embedding, embedding_minilm') \
    .gte('published_at', cutoff) \
    .limit(5) \
    .execute()

for a in a_result.data:
    emb = a.get('embedding')
    emb_ml = a.get('embedding_minilm')
    dim = len(emb) if emb else 0
    dim_ml = len(emb_ml) if emb_ml else 0
    title = (a.get('title_news') or '')[:50]
    print(f"  {title:50s} | Gemini: {dim}-dim | MiniLM: {dim_ml}-dim")

# Test the actual RPC that the pipeline uses
print("\n=== TESTING match_concept_entities RPC ===")
# Get one article's MiniLM embedding
if a_result.data and a_result.data[0].get('embedding_minilm'):
    test_emb = a_result.data[0]['embedding_minilm']
    test_title = a_result.data[0]['title_news']
    print(f"Testing with article: {test_title[:70]}")
    print(f"  MiniLM embedding dim: {len(test_emb)}")

    emb_str = '[' + ','.join(str(x) for x in test_emb) + ']'
    try:
        rpc_result = supabase.rpc('match_concept_entities', {
            'query_embedding': emb_str,
            'match_threshold': 0.45,
            'match_count': 10
        }).execute()

        print(f"  Matched entities ({len(rpc_result.data)}):")
        for r in rpc_result.data:
            print(f"    [{r.get('similarity', 0):.3f}] {r.get('entity_name', '')} ({r.get('category', '')})")
    except Exception as e:
        print(f"  RPC error: {e}")

# Now test: for specific entities the user mentioned, what articles match?
print("\n=== SPECIFIC ENTITY CHECKS ===")
# Find entities related to EVs, Electric Vehicles
ev_entities = supabase.table('concept_entities') \
    .select('id, entity_name, category, embedding') \
    .or_('entity_name.ilike.%electric%,entity_name.ilike.%EV%,entity_name.ilike.%tesla%,entity_name.ilike.%vehicle%') \
    .execute()

print(f"\nEV-related entities found: {len(ev_entities.data)}")
for e in ev_entities.data:
    print(f"  {e['entity_name']} ({e.get('category', '')})")

# For each EV entity, use RPC to find matching articles
for entity in ev_entities.data:
    emb = entity.get('embedding')
    if not emb:
        continue

    print(f"\n--- Articles matching '{entity['entity_name']}' ---")
    emb_str = '[' + ','.join(str(x) for x in emb) + ']'

    # Use the same RPC but reversed: find articles matching this entity's embedding
    # Actually, let's just do manual cosine similarity
    import numpy as np

    # Get recent articles
    cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
    articles = supabase.table('published_articles') \
        .select('id, title_news, interest_tags, embedding_minilm') \
        .gte('published_at', cutoff) \
        .limit(500) \
        .execute()

    e_emb = np.array(emb, dtype=np.float32)
    matches = []
    for art in articles.data:
        a_emb = art.get('embedding_minilm')
        if not a_emb or len(a_emb) != len(emb):
            continue
        a_emb = np.array(a_emb, dtype=np.float32)
        sim = float(np.dot(e_emb, a_emb) / (np.linalg.norm(e_emb) * np.linalg.norm(a_emb)))
        if sim >= 0.40:  # Slightly lower than threshold to see borderline
            import re
            title = re.sub(r'\*\*([^*]+)\*\*', r'\1', art.get('title_news', ''))
            matches.append((sim, title[:90], art.get('interest_tags', [])))

    matches.sort(key=lambda x: -x[0])
    for sim, title, tags in matches[:10]:
        marker = "✅" if sim >= 0.45 else "⚠️ "
        print(f"  {marker} [{sim:.3f}] {title}")
        print(f"           Tags: {', '.join(tags[:6])}")
    if not matches:
        print("  No matches found")
    break  # Only check first EV entity to avoid too much output

# Check ALL entities: find ones where the top matches seem wrong
print(f"\n{'='*100}")
print("BROAD SCAN: Entities where top match seems unrelated")
print(f"{'='*100}")

import numpy as np
import re

# Sample entities from different categories
sample_entities = supabase.table('concept_entities') \
    .select('id, entity_name, category, embedding') \
    .limit(1000) \
    .execute()

# Get articles once
cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
all_articles = supabase.table('published_articles') \
    .select('id, title_news, category, interest_tags, embedding_minilm') \
    .gte('published_at', cutoff) \
    .limit(500) \
    .execute()

# Pre-convert article embeddings
art_embs = []
for art in all_articles.data:
    emb = art.get('embedding_minilm')
    if emb and len(emb) > 10:
        art_embs.append({
            'emb': np.array(emb, dtype=np.float32),
            'title': re.sub(r'\*\*([^*]+)\*\*', r'\1', art.get('title_news', '')).strip()[:90],
            'category': art.get('category', ''),
            'tags': art.get('interest_tags', []),
        })

problems = []

for entity in sample_entities.data:
    e_emb = entity.get('embedding')
    if not e_emb or len(e_emb) < 10:
        continue

    e_np = np.array(e_emb, dtype=np.float32)
    e_norm = np.linalg.norm(e_np)
    if e_norm == 0:
        continue

    # Find top matches
    top_matches = []
    for art in art_embs:
        if len(art['emb']) != len(e_np):
            continue
        sim = float(np.dot(e_np, art['emb']) / (e_norm * np.linalg.norm(art['emb'])))
        if sim >= 0.45:
            top_matches.append((sim, art))

    if not top_matches:
        continue

    top_matches.sort(key=lambda x: -x[0])

    # Check the top match — does entity name appear anywhere in article?
    ename_lower = entity['entity_name'].lower()
    entity_words = set(ename_lower.replace('-', ' ').replace('_', ' ').split())
    entity_words = {w for w in entity_words if len(w) > 3}

    wrong_top = []
    for sim, art in top_matches[:5]:
        combined = (art['title'] + ' ' + ' '.join(art['tags']) + ' ' + art['category']).lower()
        has_overlap = any(w in combined for w in entity_words)
        if not has_overlap:
            wrong_top.append((sim, art))

    if wrong_top and len(wrong_top) >= 2:
        problems.append({
            'entity': entity['entity_name'],
            'category': entity.get('category', ''),
            'total_matches': len(top_matches),
            'wrong_top': wrong_top,
            'all_top': top_matches[:5],
        })

problems.sort(key=lambda x: -len(x['wrong_top']))

print(f"\nEntities with wrong top matches: {len(problems)}")
for p in problems[:25]:
    print(f"\n🏷️  {p['entity']} ({p['category']}) — {p['total_matches']} total matches")
    for sim, art in p['all_top'][:5]:
        combined = (art['title'] + ' ' + ' '.join(art['tags']) + ' ' + art['category']).lower()
        entity_words = set(p['entity'].lower().replace('-', ' ').split())
        entity_words = {w for w in entity_words if len(w) > 3}
        has_overlap = any(w in combined for w in entity_words)
        marker = "✅" if has_overlap else "❌"
        print(f"  {marker} [{sim:.3f}] {art['title'][:80]}")
        print(f"           Cat: {art['category']} | Tags: {', '.join(art['tags'][:5])}")

#!/usr/bin/env python3
"""
Test clustering threshold: Compare 0.87 vs 0.84 on last 48h of published articles.
Pulls all published articles, computes pairwise cosine similarity on their embeddings,
and shows which articles would have been merged at different thresholds.
"""

import os
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client
from difflib import SequenceMatcher

load_dotenv('.env.local')

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Fetch last 48h of published articles with their embeddings
cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
print(f"Fetching articles published since {cutoff[:16]}...")

result = supabase.table('published_articles') \
    .select('id, cluster_id, title_news, category, embedding, published_at, num_sources') \
    .gte('published_at', cutoff) \
    .order('published_at', desc=True) \
    .limit(1000) \
    .execute()

articles = result.data
print(f"Found {len(articles)} published articles in last 48h")

# Filter to articles with embeddings
with_emb = [a for a in articles if a.get('embedding') and len(a['embedding']) > 0]
without_emb = len(articles) - len(with_emb)
print(f"  With embeddings: {len(with_emb)}")
if without_emb:
    print(f"  Without embeddings: {without_emb}")

def cosine_sim(a, b):
    a = np.array(a)
    b = np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def title_sim(t1, t2):
    # Clean markdown bold
    import re
    t1 = re.sub(r'\*\*([^*]+)\*\*', r'\1', t1 or '').lower().strip()
    t2 = re.sub(r'\*\*([^*]+)\*\*', r'\1', t2 or '').lower().strip()
    return SequenceMatcher(None, t1, t2).ratio()

# Compute pairwise similarities for all articles
print(f"\nComputing pairwise similarities for {len(with_emb)} articles...")

# Group by different thresholds
thresholds = [0.87, 0.86, 0.85, 0.84, 0.83]
pairs_by_threshold = {t: [] for t in thresholds}

for i in range(len(with_emb)):
    for j in range(i + 1, len(with_emb)):
        a1 = with_emb[i]
        a2 = with_emb[j]

        # Skip if same cluster already
        if a1['cluster_id'] == a2['cluster_id']:
            continue

        sim = cosine_sim(a1['embedding'], a2['embedding'])

        for t in thresholds:
            if sim >= t:
                tsim = title_sim(a1['title_news'], a2['title_news'])
                pairs_by_threshold[t].append({
                    'sim': sim,
                    'title_sim': tsim,
                    'a1_id': a1['id'],
                    'a2_id': a2['id'],
                    'a1_cluster': a1['cluster_id'],
                    'a2_cluster': a2['cluster_id'],
                    'a1_title': (a1['title_news'] or '')[:80],
                    'a2_title': (a2['title_news'] or '')[:80],
                    'a1_cat': a1.get('category', ''),
                    'a2_cat': a2.get('category', ''),
                })

# Report
print(f"\n{'='*100}")
print(f"CLUSTERING THRESHOLD COMPARISON")
print(f"{'='*100}")

for t in thresholds:
    pairs = pairs_by_threshold[t]
    # Only count pairs that are NOT already in the same cluster
    new_at_this = [p for p in pairs if p not in pairs_by_threshold.get(t + 0.01, [])] if t < 0.87 else pairs
    print(f"\n  Threshold {t}: {len(pairs)} pairs would match")

# Show what 0.84 catches that 0.87 misses
new_pairs = [p for p in pairs_by_threshold[0.84] if p not in pairs_by_threshold[0.87]]
new_pairs.sort(key=lambda x: -x['sim'])

print(f"\n{'='*100}")
print(f"NEW MERGES AT 0.84 (that 0.87 misses): {len(new_pairs)} pairs")
print(f"{'='*100}")

# Classify each pair
good_merges = []  # Same event, should merge
bad_merges = []   # Different events, should NOT merge
ambiguous = []    # Unclear

for p in new_pairs:
    t1 = p['a1_title'].lower()
    t2 = p['a2_title'].lower()
    tsim = p['title_sim']

    # Heuristic: if title similarity > 40%, likely same event
    if tsim > 0.45:
        good_merges.append(p)
    elif tsim < 0.30:
        bad_merges.append(p)
    else:
        ambiguous.append(p)

print(f"\n  GOOD merges (same event, title sim > 45%): {len(good_merges)}")
print(f"  BAD merges (different events, title sim < 30%): {len(bad_merges)}")
print(f"  AMBIGUOUS (title sim 30-45%): {len(ambiguous)}")

print(f"\n{'='*100}")
print(f"GOOD MERGES (would correctly group these, sim 0.84-0.87):")
print(f"{'='*100}")
for p in good_merges[:30]:
    print(f"\n  Embedding sim: {p['sim']:.3f} | Title sim: {p['title_sim']:.0%}")
    print(f"    [{p['a1_cluster']}] {p['a1_title']}")
    print(f"    [{p['a2_cluster']}] {p['a2_title']}")

print(f"\n{'='*100}")
print(f"BAD MERGES (would incorrectly group these, sim 0.84-0.87):")
print(f"{'='*100}")
for p in bad_merges[:30]:
    print(f"\n  Embedding sim: {p['sim']:.3f} | Title sim: {p['title_sim']:.0%}")
    print(f"    [{p['a1_cluster']}] {p['a1_title']}")
    print(f"    [{p['a2_cluster']}] {p['a2_title']}")

print(f"\n{'='*100}")
print(f"AMBIGUOUS (need human judgement, sim 0.84-0.87):")
print(f"{'='*100}")
for p in ambiguous[:30]:
    print(f"\n  Embedding sim: {p['sim']:.3f} | Title sim: {p['title_sim']:.0%}")
    print(f"    [{p['a1_cluster']}] {p['a1_title']}")
    print(f"    [{p['a2_cluster']}] {p['a2_title']}")

print(f"\n{'='*100}")
print(f"SUMMARY")
print(f"{'='*100}")
print(f"  Articles analyzed: {len(with_emb)}")
print(f"  At 0.87 threshold: {len(pairs_by_threshold[0.87])} pairs would merge")
print(f"  At 0.84 threshold: {len(pairs_by_threshold[0.84])} pairs would merge")
print(f"  New merges (0.84 catches, 0.87 misses): {len(new_pairs)}")
print(f"    - Good (same event): {len(good_merges)}")
print(f"    - Bad (different event): {len(bad_merges)}")
print(f"    - Ambiguous: {len(ambiguous)}")
if len(new_pairs) > 0:
    print(f"    - Accuracy: {len(good_merges)/len(new_pairs)*100:.0f}% good, {len(bad_merges)/len(new_pairs)*100:.0f}% bad")

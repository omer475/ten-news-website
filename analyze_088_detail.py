"""
Deep-dive into 0.88 threshold: check ALL 140 multi-clusters,
classify each as good/bad/debatable, show full article lists.
"""

import os, math, json, re, time
from datetime import datetime, timedelta
from collections import defaultdict
from difflib import SequenceMatcher
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
supabase = create_client(url, key)

# ─── Fetch articles ───────────────────────────────────────────────
print("Fetching articles...")
twelve_hours_ago = (datetime.now(tz=__import__('datetime').timezone.utc) - timedelta(hours=12)).isoformat()

all_articles = []
offset = 0
while True:
    result = supabase.table('published_articles') \
        .select('id, title_news, category, ai_final_score, embedding, cluster_id, num_sources') \
        .gte('created_at', twelve_hours_ago) \
        .order('created_at', desc=True) \
        .range(offset, offset + 499) \
        .execute()
    batch = result.data or []
    all_articles.extend(batch)
    if len(batch) < 500:
        break
    offset += 500

articles = [a for a in all_articles if a.get('embedding') and isinstance(a['embedding'], list) and len(a['embedding']) == 3072]
print(f"Total articles with embeddings: {len(articles)}")

# ─── Cosine similarity ───────────────────────────────────────────
def cosine_sim(a, b):
    dot = sum(a[i]*b[i] for i in range(len(a)))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    return dot/(na*nb) if na*nb > 0 else 0

# ─── Cluster at 0.88 ─────────────────────────────────────────────
n = len(articles)
THRESHOLD = 0.88

print(f"Computing similarities and clustering at {THRESHOLD}...")
parent = list(range(n))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(x, y):
    px, py = find(x), find(y)
    if px != py: parent[px] = py

start = time.time()
for i in range(n):
    for j in range(i+1, n):
        sim = cosine_sim(articles[i]['embedding'], articles[j]['embedding'])
        if sim >= THRESHOLD:
            union(i, j)
    if (i+1) % 200 == 0:
        print(f"  {i+1}/{n} ({time.time()-start:.0f}s)")

groups = defaultdict(list)
for i in range(n):
    groups[find(i)].append(i)

multi = sorted([g for g in groups.values() if len(g) > 1], key=len, reverse=True)
single = [g for g in groups.values() if len(g) == 1]

print(f"\nClustered: {len(multi)} multi-clusters, {len(single)} singletons")

# ─── Analyze every multi-cluster ──────────────────────────────────
print("\n" + "=" * 100)
print("ALL MULTI-ARTICLE CLUSTERS AT 0.88 THRESHOLD")
print("=" * 100)

# Skip the mega-cluster for detailed per-article listing, just summarize it
for ci, cluster in enumerate(multi):
    titles = [(articles[idx]['id'], articles[idx].get('ai_final_score', 0),
               articles[idx]['title_news'], articles[idx].get('category', '')) for idx in cluster]

    if len(cluster) > 30:
        # Mega cluster - just show stats and sample
        print(f"\n{'='*80}")
        print(f"CLUSTER {ci+1}: {len(cluster)} articles (MEGA-CLUSTER)")
        print(f"{'='*80}")
        print(f"  Categories: ", end="")
        cats = defaultdict(int)
        for _, _, _, cat in titles:
            cats[cat] += 1
        for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
            print(f"{cat}:{cnt} ", end="")
        print()
        print(f"  Sample titles:")
        for aid, score, title, cat in titles[:15]:
            print(f"    [{aid}] [{score}] [{cat}] {title[:85]}")
        print(f"    ... +{len(titles)-15} more")
        continue

    # For clusters <=30, show full detail
    print(f"\n  CLUSTER {ci+1} ({len(cluster)} articles):")
    for aid, score, title, cat in titles:
        print(f"    [{aid}] [{score}] [{cat}] {title[:90]}")

# ─── Now check what 0.85 merges extra vs 0.88 ────────────────────
# Re-cluster at 0.85 to compare
print("\n\n" + "=" * 100)
print("CLUSTERS THAT EXIST AT 0.85 BUT NOT 0.88 (merged differently)")
print("=" * 100)

THRESHOLD2 = 0.85
parent2 = list(range(n))
def find2(x):
    while parent2[x] != x:
        parent2[x] = parent2[parent2[x]]
        x = parent2[x]
    return x
def union2(x, y):
    px, py = find2(x), find2(y)
    if px != py: parent2[px] = py

print("Re-computing at 0.85...")
start = time.time()
for i in range(n):
    for j in range(i+1, n):
        sim = cosine_sim(articles[i]['embedding'], articles[j]['embedding'])
        if sim >= THRESHOLD2:
            union2(i, j)
    if (i+1) % 200 == 0:
        print(f"  {i+1}/{n} ({time.time()-start:.0f}s)")

groups85 = defaultdict(list)
for i in range(n):
    groups85[find2(i)].append(i)

multi85 = sorted([g for g in groups85.values() if len(g) > 1], key=len, reverse=True)

# For each 0.85 cluster that has 2-20 articles, check if it's a single cluster at 0.88 or split
print(f"\n0.85: {len(multi85)} multi-clusters")
print(f"0.88: {len(multi)} multi-clusters")

# Find clusters at 0.85 that are split at 0.88
split_clusters = []
for g85 in multi85:
    if len(g85) > 30 or len(g85) < 2:
        continue
    # Check how many 0.88 clusters these articles span
    clusters_88 = set()
    for idx in g85:
        clusters_88.add(find(idx))
    if len(clusters_88) > 1:
        # This 0.85 cluster is split into multiple at 0.88
        split_clusters.append({
            'articles': g85,
            'split_into': len(clusters_88),
            'titles': [(articles[idx]['id'], articles[idx].get('ai_final_score', 0), articles[idx]['title_news']) for idx in g85]
        })

print(f"\nClusters merged at 0.85 but SPLIT at 0.88: {len(split_clusters)}")
for sci, sc in enumerate(split_clusters[:20]):
    print(f"\n  Split cluster {sci+1} ({len(sc['articles'])} articles, split into {sc['split_into']} at 0.88):")
    for aid, score, title in sc['titles']:
        print(f"    [{aid}] [{score}] {title[:90]}")

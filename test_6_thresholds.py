"""
Test 6 thresholds above 0.88 to find the sweet spot that breaks the mega-cluster
without losing good merges. Computes similarities ONCE, then clusters at each threshold.
"""

import os, math, time
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
supabase = create_client(url, key)

# --- Fetch articles ---
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

# --- Cosine similarity ---
def cosine_sim(a, b):
    dot = sum(a[i]*b[i] for i in range(len(a)))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    return dot/(na*nb) if na*nb > 0 else 0

# --- Precompute ALL pairwise similarities above 0.85 (covers all thresholds) ---
n = len(articles)
embeddings = [a['embedding'] for a in articles]

print(f"\nPrecomputing pairwise similarities for {n} articles...")
similar_pairs = []
MIN_SIM = 0.85

start = time.time()
for i in range(n):
    for j in range(i+1, n):
        sim = cosine_sim(embeddings[i], embeddings[j])
        if sim >= MIN_SIM:
            similar_pairs.append((i, j, sim))
    if (i+1) % 200 == 0:
        print(f"  {i+1}/{n} ({time.time()-start:.0f}s, {len(similar_pairs)} pairs so far)")

print(f"Done: {len(similar_pairs)} pairs >= {MIN_SIM} in {time.time()-start:.0f}s")

# --- Similarity distribution ---
print("\nSimilarity distribution of stored pairs:")
buckets = defaultdict(int)
for _, _, sim in similar_pairs:
    bucket = round(sim, 2)
    buckets[bucket] += 1
for t in sorted(buckets.keys()):
    bar = "#" * min(buckets[t], 60)
    print(f"  {t:.2f}: {buckets[t]:5d} {bar}")

# --- Cluster function ---
def cluster_at(threshold):
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(x, y):
        px, py = find(x), find(y)
        if px != py: parent[px] = py

    for i, j, sim in similar_pairs:
        if sim >= threshold:
            union(i, j)

    groups = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)
    return groups

# --- Test 6 thresholds ---
THRESHOLDS = [0.88, 0.89, 0.90, 0.91, 0.92, 0.93]

for threshold in THRESHOLDS:
    groups = cluster_at(threshold)
    multi = sorted([g for g in groups.values() if len(g) > 1], key=len, reverse=True)
    single = [g for g in groups.values() if len(g) == 1]

    articles_in_multi = sum(len(g) for g in multi)

    print(f"\n{'='*100}")
    print(f"THRESHOLD: {threshold}")
    print(f"{'='*100}")
    print(f"  Multi-clusters: {len(multi)}")
    print(f"  Singletons: {len(single)}")
    print(f"  Articles in multi-clusters: {articles_in_multi} ({articles_in_multi/n*100:.1f}%)")
    if multi:
        print(f"  Largest cluster: {len(multi[0])} articles")
        sizes = [len(g) for g in multi]
        print(f"  Cluster size distribution: ", end="")
        size_counts = defaultdict(int)
        for s in sizes:
            if s > 50: size_counts["50+"] += 1
            elif s > 20: size_counts["21-50"] += 1
            elif s > 10: size_counts["11-20"] += 1
            elif s > 5: size_counts["6-10"] += 1
            elif s > 2: size_counts["3-5"] += 1
            else: size_counts["2"] += 1
        for label in ["50+", "21-50", "11-20", "6-10", "3-5", "2"]:
            if size_counts[label]:
                print(f"{label}:{size_counts[label]} ", end="")
        print()

    # Show ALL clusters with full article titles
    for ci, cluster in enumerate(multi):
        titles = [(articles[idx]['id'], articles[idx].get('ai_final_score', 0),
                   articles[idx]['title_news'], articles[idx].get('category', '')) for idx in cluster]

        if len(cluster) > 50:
            # Mega cluster - show stats + categorized sample
            print(f"\n  {'='*80}")
            print(f"  CLUSTER {ci+1}: {len(cluster)} articles (MEGA-CLUSTER)")
            print(f"  {'='*80}")
            cats = defaultdict(int)
            for _, _, _, cat in titles:
                cats[cat] += 1
            print(f"    Categories: ", end="")
            for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
                print(f"{cat}:{cnt} ", end="")
            print()

            # Categorize by sub-event
            sub_events = defaultdict(list)
            for aid, score, title, cat in titles:
                t = title.lower()
                if 'khamenei' in t:
                    sub_events['Khamenei death/assassination'].append(title)
                elif 'hormuz' in t or 'strait' in t:
                    sub_events['Hormuz Strait'].append(title)
                elif 'kurd' in t:
                    sub_events['Kurdish insurgents'].append(title)
                elif 'evacuati' in t or 'embassy' in t or 'stranded' in t or 'charter flight' in t:
                    sub_events['Evacuations/Embassy'].append(title)
                elif 'nato' in t:
                    sub_events['NATO response'].append(title)
                elif 'oil' in t or 'fuel' in t or 'energy price' in t or 'gas price' in t:
                    sub_events['Oil/Energy prices'].append(title)
                elif 'hezbollah' in t or 'beirut' in t or 'lebanon' in t:
                    sub_events['Hezbollah/Lebanon'].append(title)
                elif 'putin' in t:
                    sub_events['Putin reaction'].append(title)
                elif 'china' in t:
                    sub_events['China reaction'].append(title)
                elif 'india' in t or 'modi' in t:
                    sub_events['India reaction'].append(title)
                elif ('strike' in t or 'attack' in t or 'bomb' in t or 'missile' in t) and ('iran' in t or 'iranian' in t or 'tehran' in t):
                    sub_events['Iran strikes/attacks'].append(title)
                elif 'sanction' in t:
                    sub_events['Sanctions'].append(title)
                elif 'nuclear' in t and ('iran' in t or 'weapon' in t):
                    sub_events['Nuclear/Iran'].append(title)
                elif 'drone' in t and ('iran' in t or 'shahed' in t):
                    sub_events['Iranian drones'].append(title)
                elif 'turkey' in t or 'türkiye' in t or 'erdogan' in t or 'erdoğan' in t:
                    sub_events['Turkey/Erdogan'].append(title)
                elif 'ukraine' in t or 'zelensky' in t or 'zelenskyy' in t:
                    sub_events['Ukraine-related'].append(title)
                elif 'qatar' in t or 'doha' in t:
                    sub_events['Qatar'].append(title)
                elif 'israel' in t or 'idf' in t or 'netanyahu' in t:
                    sub_events['Israel operations'].append(title)
                elif 'iran' in t or 'iranian' in t or 'tehran' in t:
                    sub_events['Iran general'].append(title)
                else:
                    sub_events['Other/Tangential'].append(title)

            print(f"    Sub-event breakdown:")
            for event, items in sorted(sub_events.items(), key=lambda x: -len(x[1])):
                print(f"      {event}: {len(items)} articles")
            print(f"    DISTINCT sub-events in mega-cluster: {len(sub_events)}")
            print(f"    Sample titles from each sub-event:")
            for event, items in sorted(sub_events.items(), key=lambda x: -len(x[1])):
                print(f"      [{event}] ({len(items)}):")
                for t in items[:3]:
                    print(f"        - {t[:90]}")
                if len(items) > 3:
                    print(f"        ... +{len(items)-3} more")

        elif len(cluster) > 15:
            # Large cluster - show all titles with sub-event analysis
            print(f"\n  CLUSTER {ci+1} ({len(cluster)} articles) [LARGE]:")
            # Detect if it's mixing topics
            topics = set()
            for aid, score, title, cat in titles:
                t = title.lower()
                if 'ukraine' in t or 'zelensky' in t: topics.add('ukraine')
                if 'iran' in t: topics.add('iran')
                if 'drone' in t: topics.add('drones')
                if 'pow' in t or 'prisoner' in t: topics.add('POW')
                if 'peace' in t or 'talks' in t: topics.add('peace_talks')
                if 'f-16' in t or 'missile shortage' in t: topics.add('weapons')
            if len(topics) > 2:
                print(f"    WARNING: Mixed topics detected: {topics}")
            for aid, score, title, cat in titles:
                print(f"    [{aid}] [{score}] [{cat}] {title[:95]}")

        else:
            # Normal cluster - show all titles
            print(f"\n  CLUSTER {ci+1} ({len(cluster)} articles):")
            for aid, score, title, cat in titles:
                print(f"    [{aid}] [{score}] [{cat}] {title[:95]}")

    # Summary stats for this threshold
    print(f"\n  --- QUALITY SUMMARY FOR {threshold} ---")
    # Count bad merges (crude heuristic: 2-article clusters where titles share < 2 significant words)
    good = 0
    bad = 0
    for cluster in multi:
        if len(cluster) > 30:
            bad += 1  # mega-clusters are always bad
            continue
        titles_clean = []
        for idx in cluster:
            import re
            t = re.sub(r'\*\*([^*]+)\*\*', r'\1', articles[idx]['title_news'] or '').lower()
            titles_clean.append(set(w for w in t.split() if len(w) >= 4))

        is_bad = False
        for ci2 in range(len(titles_clean)):
            for cj2 in range(ci2+1, len(titles_clean)):
                if titles_clean[ci2] and titles_clean[cj2]:
                    overlap = len(titles_clean[ci2] & titles_clean[cj2]) / min(len(titles_clean[ci2]), len(titles_clean[cj2]))
                    if overlap < 0.15:
                        is_bad = True
                        break
            if is_bad:
                break
        if is_bad:
            bad += 1
        else:
            good += 1

    print(f"  Good clusters: {good}")
    print(f"  Bad/mixed clusters: {bad}")
    print(f"  Mega-cluster articles: {len(multi[0]) if multi else 0}")


# --- Final comparison table ---
print(f"\n\n{'='*100}")
print("FINAL COMPARISON TABLE")
print(f"{'='*100}")
print(f"{'Threshold':<12} {'Multi':<8} {'Singles':<9} {'InMulti%':<10} {'Largest':<10} {'Good':<8} {'Bad':<8}")
print("-" * 65)

for threshold in THRESHOLDS:
    groups = cluster_at(threshold)
    multi = sorted([g for g in groups.values() if len(g) > 1], key=len, reverse=True)
    single = [g for g in groups.values() if len(g) == 1]
    articles_in_multi = sum(len(g) for g in multi)

    import re
    good = 0
    bad = 0
    for cluster in multi:
        if len(cluster) > 30:
            bad += 1
            continue
        titles_clean = []
        for idx in cluster:
            t = re.sub(r'\*\*([^*]+)\*\*', r'\1', articles[idx]['title_news'] or '').lower()
            titles_clean.append(set(w for w in t.split() if len(w) >= 4))
        is_bad = False
        for ci2 in range(len(titles_clean)):
            for cj2 in range(ci2+1, len(titles_clean)):
                if titles_clean[ci2] and titles_clean[cj2]:
                    overlap = len(titles_clean[ci2] & titles_clean[cj2]) / min(len(titles_clean[ci2]), len(titles_clean[cj2]))
                    if overlap < 0.15:
                        is_bad = True
                        break
            if is_bad:
                break
        if is_bad:
            bad += 1
        else:
            good += 1

    print(f"{threshold:<12.2f} {len(multi):<8} {len(single):<9} {articles_in_multi/n*100:<10.1f} {len(multi[0]) if multi else 0:<10} {good:<8} {bad:<8}")

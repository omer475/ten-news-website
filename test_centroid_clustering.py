"""
Test centroid-based clustering at 0.90 and 0.91 thresholds using numpy.
Each new article is compared to cluster centroids (average embeddings).
"""

import os, time, re
import numpy as np
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
        .select('id, title_news, category, ai_final_score, embedding') \
        .gte('created_at', twelve_hours_ago) \
        .order('id') \
        .range(offset, offset + 199) \
        .execute()
    batch = result.data or []
    all_articles.extend(batch)
    print(f"  Fetched {len(all_articles)} so far...")
    if len(batch) < 200:
        break
    offset += 200

# Deduplicate by id
seen_ids = set()
unique = []
for a in all_articles:
    if a['id'] not in seen_ids:
        seen_ids.add(a['id'])
        unique.append(a)

articles = [a for a in unique if a.get('embedding') and isinstance(a['embedding'], list) and len(a['embedding']) == 3072]
n = len(articles)
print(f"Total unique articles with embeddings: {n}")

# Convert to numpy matrix
embeddings = np.array([a['embedding'] for a in articles], dtype=np.float32)
# Normalize for fast cosine sim (cosine = dot product of normalized vectors)
norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
norms[norms == 0] = 1
embeddings_normed = embeddings / norms

# --- Centroid-based clustering with numpy ---
def centroid_cluster(threshold):
    cluster_indices = []   # list of lists of article indices
    cluster_sums = []      # unnormalized sum vectors
    cluster_centroids = [] # normalized centroid vectors (for fast cosine)

    for i in range(n):
        emb = embeddings[i]
        emb_normed = embeddings_normed[i]

        if len(cluster_centroids) > 0:
            # Cosine similarity to all centroids at once
            centroid_matrix = np.array(cluster_centroids, dtype=np.float32)
            sims = centroid_matrix @ emb_normed
            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])
        else:
            best_sim = -1
            best_idx = -1

        if best_sim >= threshold and best_idx >= 0:
            cluster_indices[best_idx].append(i)
            cluster_sums[best_idx] = cluster_sums[best_idx] + emb
            # Recompute normalized centroid
            new_centroid = cluster_sums[best_idx] / len(cluster_indices[best_idx])
            norm = np.linalg.norm(new_centroid)
            if norm > 0:
                new_centroid = new_centroid / norm
            cluster_centroids[best_idx] = new_centroid
        else:
            cluster_indices.append([i])
            cluster_sums.append(emb.copy())
            cluster_centroids.append(emb_normed.copy())

        if (i+1) % 500 == 0:
            print(f"    {i+1}/{n}, {len(cluster_indices)} clusters")

    return cluster_indices


def print_cluster_detail(cluster_indices_list, threshold):
    multi = sorted([c for c in cluster_indices_list if len(c) > 1], key=len, reverse=True)
    single = [c for c in cluster_indices_list if len(c) == 1]
    articles_in_multi = sum(len(c) for c in multi)

    print(f"  Multi-clusters: {len(multi)}")
    print(f"  Singletons: {len(single)}")
    print(f"  Articles in multi-clusters: {articles_in_multi} ({articles_in_multi/n*100:.1f}%)")
    if multi:
        print(f"  Largest cluster: {len(multi[0])} articles")
        size_counts = defaultdict(int)
        for c in multi:
            s = len(c)
            if s > 50: size_counts["50+"] += 1
            elif s > 20: size_counts["21-50"] += 1
            elif s > 10: size_counts["11-20"] += 1
            elif s > 5: size_counts["6-10"] += 1
            elif s > 2: size_counts["3-5"] += 1
            else: size_counts["2"] += 1
        print(f"  Size distribution: ", end="")
        for label in ["50+", "21-50", "11-20", "6-10", "3-5", "2"]:
            if size_counts[label]:
                print(f"{label}:{size_counts[label]} ", end="")
        print()

    # Show all multi-clusters
    for ci, indices in enumerate(multi):
        titles = [(articles[idx]['id'], articles[idx].get('ai_final_score', 0),
                   articles[idx]['title_news'], articles[idx].get('category', '')) for idx in indices]

        if len(indices) > 20:
            print(f"\n  {'='*80}")
            print(f"  CLUSTER {ci+1}: {len(indices)} articles (LARGE)")
            print(f"  {'='*80}")
            cats = defaultdict(int)
            for _, _, _, cat in titles:
                cats[cat] += 1
            print(f"    Categories: ", end="")
            for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
                print(f"{cat}:{cnt} ", end="")
            print()

            sub_events = defaultdict(list)
            for aid, score, title, cat in titles:
                t = title.lower()
                if 'khamenei' in t: sub_events['Khamenei'].append(title)
                elif 'hormuz' in t or ('strait' in t and 'iran' in t): sub_events['Hormuz Strait'].append(title)
                elif 'kurd' in t: sub_events['Kurdish'].append(title)
                elif 'hezbollah' in t or ('beirut' in t and 'evacu' not in t) or ('lebanon' in t and ('strike' in t or 'attack' in t)): sub_events['Hezbollah/Lebanon'].append(title)
                elif 'oil' in t or 'tanker' in t: sub_events['Oil/Tankers'].append(title)
                elif 'evacuati' in t or 'embassy' in t: sub_events['Evacuations'].append(title)
                elif 'azerbaijan' in t or 'nakhichevan' in t: sub_events['Azerbaijan'].append(title)
                elif 'ukraine' in t or 'zelensky' in t: sub_events['Ukraine'].append(title)
                elif 'nato' in t: sub_events['NATO'].append(title)
                elif 'turkey' in t or 'türkiye' in t or 'erdogan' in t or 'erdoğan' in t: sub_events['Turkey'].append(title)
                elif ('strike' in t or 'attack' in t or 'bomb' in t) and ('iran' in t or 'tehran' in t): sub_events['Iran strikes'].append(title)
                elif 'israel' in t or 'idf' in t: sub_events['Israel ops'].append(title)
                elif 'iran' in t or 'iranian' in t: sub_events['Iran general'].append(title)
                else: sub_events['Other'].append(title)

            print(f"    Sub-events ({len(sub_events)} distinct):")
            for event, items in sorted(sub_events.items(), key=lambda x: -len(x[1])):
                print(f"      {event}: {len(items)}")
                for t in items[:2]:
                    print(f"        - {t[:90]}")
                if len(items) > 2:
                    print(f"        ... +{len(items)-2} more")
            # Show all titles
            print(f"    All titles:")
            for aid, score, title, cat in titles:
                print(f"      [{aid}] [{score}] [{cat}] {title[:95]}")
        else:
            print(f"\n  CLUSTER {ci+1} ({len(indices)} articles):")
            for aid, score, title, cat in titles:
                print(f"    [{aid}] [{score}] [{cat}] {title[:95]}")

    # Quality check
    good = 0
    bad = 0
    for indices in multi:
        if len(indices) > 30:
            bad += 1
            continue
        titles_clean = []
        for idx in indices:
            t = re.sub(r'\*\*([^*]+)\*\*', r'\1', articles[idx]['title_news'] or '').lower()
            titles_clean.append(set(w for w in t.split() if len(w) >= 4))
        is_bad = False
        for a in range(len(titles_clean)):
            for b in range(a+1, len(titles_clean)):
                if titles_clean[a] and titles_clean[b]:
                    overlap = len(titles_clean[a] & titles_clean[b]) / min(len(titles_clean[a]), len(titles_clean[b]))
                    if overlap < 0.15:
                        is_bad = True
                        break
            if is_bad:
                break
        if is_bad:
            bad += 1
        else:
            good += 1

    print(f"\n  --- QUALITY SUMMARY FOR CENTROID @ {threshold} ---")
    print(f"  Good: {good}")
    print(f"  Bad/mixed: {bad}")
    print(f"  Largest: {len(multi[0]) if multi else 0}")
    return len(multi), len(single), articles_in_multi, len(multi[0]) if multi else 0, good, bad


# --- Run both thresholds ---
results = {}
for threshold in [0.90, 0.91]:
    print(f"\n{'='*100}")
    print(f"CENTROID-BASED CLUSTERING AT THRESHOLD {threshold}")
    print(f"{'='*100}")

    start = time.time()
    clusters = centroid_cluster(threshold)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.0f}s")

    r = print_cluster_detail(clusters, threshold)
    results[threshold] = r

# --- Comparison table ---
print(f"\n\n{'='*100}")
print("FINAL COMPARISON: CENTROID vs SINGLE-LINKAGE")
print(f"{'='*100}")
print(f"{'Method':<25} {'Thresh':<8} {'Multi':<8} {'InMulti%':<10} {'Largest':<10} {'Good':<8} {'Bad':<8}")
print("-" * 77)
print(f"{'Single-linkage':<25} {'0.90':<8} {'132':<8} {'25.7':<10} {'109':<10} {'108':<8} {'24':<8}")
print(f"{'Single-linkage':<25} {'0.91':<8} {'124':<8} {'20.1':<10} {'25':<10} {'101':<8} {'23':<8}")
for threshold in [0.90, 0.91]:
    multi, single, in_multi, largest, good, bad = results[threshold]
    print(f"{'Centroid-based':<25} {threshold:<8} {multi:<8} {in_multi/n*100:<10.1f} {largest:<10} {good:<8} {bad:<8}")

#!/usr/bin/env python3
"""
DEEP THRESHOLD INSPECTION
==========================
Looks at actual article pairs to determine if 0.90 is splitting articles
that should be together, and if 0.87 is merging articles that shouldn't be.
"""

import os
import time
import numpy as np
import requests
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import List, Dict, Optional
from supabase import create_client
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

THRESHOLDS = [0.82, 0.85, 0.87, 0.90, 0.92, 0.95]


def get_embedding(text: str):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
        payload = {"model": "models/gemini-embedding-001", "content": {"parts": [{"text": text[:2000]}]}}
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()['embedding']['values']
    except:
        return None


def get_embeddings_batch(texts, max_workers=10):
    embeddings = [None] * len(texts)
    def fetch_one(idx_text):
        idx, text = idx_text
        return idx, get_embedding(text)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for idx, emb in executor.map(fetch_one, enumerate(texts)):
            embeddings[idx] = emb
    return embeddings


def fetch_articles_24h():
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    print(f"📥 Fetching articles from last 24h (since {cutoff[:19]})...")
    all_articles = []
    offset = 0
    while True:
        result = supabase.table('source_articles')\
            .select('id, title, category, cluster_id, published_at, source_name, url')\
            .gte('created_at', cutoff)\
            .order('created_at', desc=True)\
            .range(offset, offset + 999)\
            .execute()
        if not result.data:
            break
        all_articles.extend(result.data)
        offset += 1000
        if len(result.data) < 1000:
            break
    print(f"   ✅ {len(all_articles)} articles")
    return all_articles


def simulate_clustering(articles, embeddings, threshold):
    """Returns clusters dict AND per-article assignment info."""
    clusters = {}
    next_id = 1
    article_assignments = {}  # article_index -> cluster_id
    article_best_sims = {}   # article_index -> best similarity score seen

    indices = list(range(len(articles)))
    indices.reverse()

    for idx in indices:
        emb = embeddings[idx]
        if emb is None:
            cid = next_id; next_id += 1
            clusters[cid] = {'centroid': None, 'count': 1, 'articles': [(idx, articles[idx])], 'no_embedding': True}
            article_assignments[idx] = cid
            article_best_sims[idx] = 0.0
            continue

        emb_np = np.array(emb, dtype=np.float64)
        best_cid = None
        best_sim = 0.0

        for cid, cluster in clusters.items():
            if cluster.get('no_embedding'):
                continue
            centroid = cluster['centroid']
            dot = np.dot(emb_np, centroid)
            n1 = np.linalg.norm(emb_np)
            n2 = np.linalg.norm(centroid)
            if n1 == 0 or n2 == 0:
                continue
            sim = dot / (n1 * n2)
            if sim > best_sim:
                best_sim = sim
            if sim >= threshold and sim > (clusters[best_cid]['best_match_sim'] if best_cid and 'best_match_sim' in clusters.get(best_cid, {}) else 0):
                pass
            if sim >= threshold and (best_cid is None or sim > article_best_sims.get(idx, 0)):
                best_cid = cid

        # Re-find properly
        best_cid = None
        best_sim_match = 0.0
        best_sim_overall = 0.0

        for cid, cluster in clusters.items():
            if cluster.get('no_embedding'):
                continue
            centroid = cluster['centroid']
            dot = np.dot(emb_np, centroid)
            n1 = np.linalg.norm(emb_np)
            n2 = np.linalg.norm(centroid)
            if n1 == 0 or n2 == 0:
                continue
            sim = dot / (n1 * n2)
            if sim > best_sim_overall:
                best_sim_overall = sim
            if sim >= threshold and sim > best_sim_match:
                best_sim_match = sim
                best_cid = cid

        article_best_sims[idx] = best_sim_overall

        if best_cid is not None:
            old_count = clusters[best_cid]['count']
            old_centroid = clusters[best_cid]['centroid']
            new_centroid = (old_centroid * old_count + emb_np) / (old_count + 1)
            clusters[best_cid]['centroid'] = new_centroid
            clusters[best_cid]['count'] = old_count + 1
            clusters[best_cid]['articles'].append((idx, articles[idx]))
            article_assignments[idx] = best_cid
        else:
            cid = next_id; next_id += 1
            clusters[cid] = {'centroid': emb_np.copy(), 'count': 1, 'articles': [(idx, articles[idx])]}
            article_assignments[idx] = cid

    return clusters, article_assignments, article_best_sims


def main():
    articles = fetch_articles_24h()
    if len(articles) < 50:
        print("❌ Not enough articles")
        return

    titles = [a.get('title', '') for a in articles]
    print(f"\n🧠 Generating embeddings for {len(titles)} articles...")
    start = time.time()
    batch_size = 200
    all_embeddings = []
    for bs in range(0, len(titles), batch_size):
        be = min(bs + batch_size, len(titles))
        print(f"   Batch {bs//batch_size + 1}/{(len(titles)-1)//batch_size + 1}...")
        all_embeddings.extend(get_embeddings_batch(titles[bs:be], max_workers=10))
        time.sleep(0.5)

    success = sum(1 for e in all_embeddings if e is not None)
    print(f"   ✅ Done in {time.time()-start:.0f}s ({success}/{len(titles)} success)")

    # =====================================================
    # PART 1: CONSISTENT STATS (fix the confusing %)
    # =====================================================
    print(f"\n\n{'='*100}")
    print(f"📊 THRESHOLD COMPARISON — ALL NUMBERS AS % OF ARTICLES ({len(articles)} total)")
    print(f"{'='*100}\n")

    print(f"{'Threshold':>10} │ {'Clusters':>8} │ {'Standalone':>10} │ {'Stand %':>8} │ "
          f"{'Grouped':>8} │ {'Group %':>8} │ {'2-3 art':>7} │ {'4-7 art':>7} │ "
          f"{'8+ art':>7} │ {'Max':>4}")
    print(f"{'─'*100}")

    all_cluster_results = {}

    for threshold in THRESHOLDS:
        clusters, assignments, best_sims = simulate_clustering(articles, all_embeddings, threshold)
        all_cluster_results[threshold] = (clusters, assignments, best_sims)

        total = len(articles)
        standalone_articles = sum(1 for c in clusters.values() if c['count'] == 1)
        grouped_articles = total - standalone_articles
        sizes = [c['count'] for c in clusters.values()]
        art_in_2_3 = sum(c['count'] for c in clusters.values() if 2 <= c['count'] <= 3)
        art_in_4_7 = sum(c['count'] for c in clusters.values() if 4 <= c['count'] <= 7)
        art_in_8plus = sum(c['count'] for c in clusters.values() if c['count'] >= 8)
        max_size = max(sizes)

        marker = " ◄ CURRENT" if threshold == 0.90 else ""
        print(f"{threshold:>10.2f} │ {len(clusters):>8} │ {standalone_articles:>10} │ "
              f"{standalone_articles/total*100:>7.1f}% │ {grouped_articles:>8} │ "
              f"{grouped_articles/total*100:>7.1f}% │ {art_in_2_3:>7} │ {art_in_4_7:>7} │ "
              f"{art_in_8plus:>7} │ {max_size:>4}{marker}")

    print(f"{'─'*100}")

    # =====================================================
    # PART 2: NEAR-MISSES AT 0.90
    # Find articles with best similarity 0.85-0.90
    # These are articles that ALMOST matched a cluster
    # =====================================================
    print(f"\n\n{'='*100}")
    print(f"🔍 NEAR-MISSES AT 0.90: Articles with best similarity 0.85-0.899")
    print(f"   These articles almost matched a cluster but the threshold kept them apart")
    print(f"{'='*100}\n")

    clusters_90, assignments_90, best_sims_90 = all_cluster_results[0.90]
    clusters_87, assignments_87, best_sims_87 = all_cluster_results[0.87]

    # Find articles that are singletons at 0.90 but grouped at 0.87
    gained_at_87 = []
    for idx in range(len(articles)):
        cid_90 = assignments_90.get(idx)
        cid_87 = assignments_87.get(idx)
        if cid_90 is None or cid_87 is None:
            continue

        is_singleton_90 = clusters_90[cid_90]['count'] == 1
        is_grouped_87 = clusters_87[cid_87]['count'] >= 2

        if is_singleton_90 and is_grouped_87:
            cluster_87 = clusters_87[cid_87]
            gained_at_87.append({
                'article': articles[idx],
                'idx': idx,
                'best_sim': best_sims_90[idx],
                'cluster_titles': [a[1]['title'] for a in cluster_87['articles']],
                'cluster_sources': list(set(a[1].get('source_name', '?') for a in cluster_87['articles'])),
                'cluster_size': cluster_87['count'],
            })

    gained_at_87.sort(key=lambda x: x['best_sim'], reverse=True)

    print(f"📈 {len(gained_at_87)} articles are STANDALONE at 0.90 but GROUPED at 0.87\n")

    # Show them grouped by their 0.87 cluster
    seen_clusters = set()
    shown = 0
    for item in gained_at_87:
        cid_87 = assignments_87[item['idx']]
        if cid_87 in seen_clusters:
            continue
        seen_clusters.add(cid_87)

        cluster_87 = clusters_87[cid_87]
        cluster_titles = [a[1]['title'][:100] for a in cluster_87['articles']]
        cluster_sources = list(set(a[1].get('source_name', '?') for a in cluster_87['articles']))
        cluster_cats = list(set(a[1].get('category', '?') for a in cluster_87['articles']))

        # Check how many of these are singletons at 0.90
        singleton_count = sum(1 for a_idx, _ in cluster_87['articles']
                            if clusters_90[assignments_90[a_idx]]['count'] == 1)

        print(f"  ┌─ Cluster at 0.87: {cluster_87['count']} articles ({singleton_count} are singletons at 0.90)")
        print(f"  │  Sources: {', '.join(cluster_sources[:6])}")
        print(f"  │  Categories: {', '.join(cluster_cats)}")
        for t in cluster_titles[:6]:
            print(f"  │  • {t}")
        if len(cluster_titles) > 6:
            print(f"  │  ... and {len(cluster_titles)-6} more")

        # Verdict
        # Check if titles are actually about the same thing
        from difflib import SequenceMatcher
        sims = []
        for i in range(len(cluster_titles)):
            for j in range(i+1, min(len(cluster_titles), i+4)):
                sims.append(SequenceMatcher(None, cluster_titles[i].lower(), cluster_titles[j].lower()).ratio())
        avg_sim = sum(sims) / len(sims) if sims else 0

        if avg_sim > 0.4:
            verdict = "✅ SHOULD be together (same story)"
        elif avg_sim > 0.25:
            verdict = "🟡 PROBABLY same story (different wording)"
        else:
            verdict = "❌ MIGHT be different stories"
        print(f"  └─ Title similarity: {avg_sim:.2f} → {verdict}\n")

        shown += 1
        if shown >= 30:
            remaining = len(seen_clusters)
            print(f"  ... and more clusters")
            break

    # =====================================================
    # PART 3: What does 0.87 merge WRONGLY?
    # =====================================================
    print(f"\n\n{'='*100}")
    print(f"❌ WHAT DOES 0.87 MERGE THAT 0.90 DOESN'T? (potential bad merges)")
    print(f"{'='*100}\n")

    # Find clusters at 0.87 that contain articles from DIFFERENT 0.90 clusters
    bad_merges = []
    for cid_87, cluster_87 in clusters_87.items():
        if cluster_87['count'] < 2:
            continue

        # What 0.90 clusters do these articles belong to?
        clusters_90_in_this = set()
        for a_idx, _ in cluster_87['articles']:
            c90 = assignments_90.get(a_idx)
            if c90:
                clusters_90_in_this.add(c90)

        if len(clusters_90_in_this) > 1:
            # This 0.87 cluster merges multiple 0.90 clusters
            titles = [a[1]['title'][:100] for a in cluster_87['articles']]
            sources = list(set(a[1].get('source_name', '?') for a in cluster_87['articles']))

            from difflib import SequenceMatcher
            sims = []
            for i in range(len(titles)):
                for j in range(i+1, min(len(titles), i+4)):
                    sims.append(SequenceMatcher(None, titles[i].lower(), titles[j].lower()).ratio())
            avg_sim = sum(sims) / len(sims) if sims else 0

            bad_merges.append({
                'size': cluster_87['count'],
                'num_90_clusters': len(clusters_90_in_this),
                'titles': titles,
                'sources': sources,
                'avg_title_sim': avg_sim,
            })

    bad_merges.sort(key=lambda x: x['avg_title_sim'])

    actually_bad = [m for m in bad_merges if m['avg_title_sim'] < 0.3]
    borderline = [m for m in bad_merges if 0.3 <= m['avg_title_sim'] < 0.5]
    actually_good = [m for m in bad_merges if m['avg_title_sim'] >= 0.5]

    print(f"Total clusters at 0.87 that merge multiple 0.90 clusters: {len(bad_merges)}")
    print(f"  ✅ Actually same story (title sim ≥0.5): {len(actually_good)}")
    print(f"  🟡 Borderline (title sim 0.3-0.5): {len(borderline)}")
    print(f"  ❌ Possibly wrong (title sim <0.3): {len(actually_bad)}")

    if actually_bad:
        print(f"\n  ❌ POSSIBLY WRONG MERGES:")
        for m in actually_bad[:10]:
            print(f"\n    Cluster: {m['size']} articles, merges {m['num_90_clusters']} separate 0.90 clusters")
            print(f"    Avg title similarity: {m['avg_title_sim']:.2f}")
            for t in m['titles'][:5]:
                print(f"      • {t}")

    if borderline:
        print(f"\n  🟡 BORDERLINE MERGES:")
        for m in borderline[:10]:
            print(f"\n    Cluster: {m['size']} articles, merges {m['num_90_clusters']} separate 0.90 clusters")
            print(f"    Avg title similarity: {m['avg_title_sim']:.2f}")
            for t in m['titles'][:5]:
                print(f"      • {t}")

    if actually_good:
        print(f"\n  ✅ GOOD MERGES (0.90 was splitting these unnecessarily):")
        for m in actually_good[:15]:
            print(f"\n    Cluster: {m['size']} articles, merges {m['num_90_clusters']} separate 0.90 clusters")
            print(f"    Avg title similarity: {m['avg_title_sim']:.2f}")
            for t in m['titles'][:4]:
                print(f"      • {t}")

    # =====================================================
    # PART 4: FINAL VERDICT
    # =====================================================
    print(f"\n\n{'='*100}")
    print(f"🏆 FINAL VERDICT")
    print(f"{'='*100}\n")

    total = len(articles)
    for threshold in THRESHOLDS:
        clusters, _, _ = all_cluster_results[threshold]
        standalone = sum(1 for c in clusters.values() if c['count'] == 1)
        grouped = total - standalone
        marker = " ◄ CURRENT" if threshold == 0.90 else ""
        print(f"  {threshold:.2f}: {standalone} standalone ({standalone/total*100:.1f}%) + "
              f"{grouped} grouped ({grouped/total*100:.1f}%) = {total} total{marker}")

    print(f"\n  0.87 vs 0.90 diff:")
    c87, _, _ = all_cluster_results[0.87]
    c90, _, _ = all_cluster_results[0.90]
    s87 = sum(1 for c in c87.values() if c['count'] == 1)
    s90 = sum(1 for c in c90.values() if c['count'] == 1)
    g87 = total - s87
    g90 = total - s90
    print(f"  → {g87 - g90} MORE articles grouped at 0.87")
    print(f"  → {len(actually_bad)} potentially wrong merges")
    print(f"  → {len(actually_good)} correct merges that 0.90 was splitting")


if __name__ == '__main__':
    main()

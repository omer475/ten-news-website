#!/usr/bin/env python3
"""
EMBEDDING THRESHOLD ANALYSIS
=============================
Tests 6 different similarity thresholds against the last 3000 source articles
to find the optimal clustering threshold.

Simulates the centroid-based clustering algorithm offline using real article
embeddings from Gemini.
"""

import os
import sys
import json
import time
import numpy as np
import requests
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import List, Dict, Optional, Tuple
from supabase import create_client
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv('.env.local')

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

# ==========================================
# THRESHOLDS TO TEST
# ==========================================
THRESHOLDS = [0.82, 0.85, 0.87, 0.90, 0.92, 0.95]

# ==========================================
# EMBEDDING FUNCTIONS
# ==========================================

def get_embedding(text: str) -> Optional[List[float]]:
    """Get Gemini embedding for a text string."""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": text[:2000]}]}
        }
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        return result['embedding']['values']
    except Exception as e:
        return None


def get_embeddings_batch(texts: List[str], max_workers: int = 10) -> List[Optional[List[float]]]:
    """Get embeddings for multiple texts in parallel."""
    embeddings = [None] * len(texts)

    def fetch_one(idx_text):
        idx, text = idx_text
        emb = get_embedding(text)
        return idx, emb

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = list(executor.map(fetch_one, enumerate(texts)))
        for idx, emb in futures:
            embeddings[idx] = emb

    return embeddings


def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    v1 = np.array(vec1, dtype=np.float64)
    v2 = np.array(vec2, dtype=np.float64)
    dot = np.dot(v1, v2)
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


# ==========================================
# FETCH ARTICLES
# ==========================================

def fetch_articles(limit: int = 3000) -> List[Dict]:
    """Fetch last N approved source articles with their titles and metadata."""
    print(f"📥 Fetching last {limit} approved source articles from Supabase...")

    all_articles = []
    page_size = 1000
    offset = 0

    while len(all_articles) < limit:
        batch_size = min(page_size, limit - len(all_articles))
        result = supabase.table('source_articles')\
            .select('id, title, category, cluster_id, published_at, source_name, url')\
            .order('created_at', desc=True)\
            .range(offset, offset + batch_size - 1)\
            .execute()

        if not result.data:
            break

        all_articles.extend(result.data)
        offset += batch_size

        if len(result.data) < batch_size:
            break

    print(f"   ✅ Fetched {len(all_articles)} articles")
    return all_articles


def fetch_articles_24h() -> List[Dict]:
    """Fetch ALL source articles from the last 24 hours."""
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    print(f"📥 Fetching all source articles from last 24 hours (since {cutoff[:19]})...")

    all_articles = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.table('source_articles')\
            .select('id, title, category, cluster_id, published_at, source_name, url')\
            .gte('created_at', cutoff)\
            .order('created_at', desc=True)\
            .range(offset, offset + page_size - 1)\
            .execute()

        if not result.data:
            break

        all_articles.extend(result.data)
        offset += page_size

        if len(result.data) < page_size:
            break

    print(f"   ✅ Fetched {len(all_articles)} articles from last 24h")
    return all_articles


# ==========================================
# CLUSTERING SIMULATION
# ==========================================

def simulate_clustering(articles: List[Dict], embeddings: List[np.ndarray],
                       threshold: float) -> Dict:
    """
    Simulate centroid-based clustering at a given threshold.

    Returns detailed stats about the clustering results.
    """
    clusters = {}       # cluster_id -> {'centroid': np.array, 'count': int, 'articles': []}
    next_cluster_id = 1

    # Process articles in chronological order (oldest first)
    # Since we fetched newest first, reverse
    indices = list(range(len(articles)))
    indices.reverse()

    for idx in indices:
        article = articles[idx]
        emb = embeddings[idx]

        if emb is None:
            # No embedding - create standalone cluster
            cid = next_cluster_id
            next_cluster_id += 1
            clusters[cid] = {
                'centroid': None,
                'count': 1,
                'articles': [article],
                'no_embedding': True
            }
            continue

        emb_np = np.array(emb, dtype=np.float64)

        # Find best matching cluster
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

            if sim >= threshold and sim > best_sim:
                best_sim = sim
                best_cid = cid

        if best_cid is not None:
            # Match found - update centroid
            old_count = clusters[best_cid]['count']
            old_centroid = clusters[best_cid]['centroid']
            new_centroid = (old_centroid * old_count + emb_np) / (old_count + 1)
            clusters[best_cid]['centroid'] = new_centroid
            clusters[best_cid]['count'] = old_count + 1
            clusters[best_cid]['articles'].append(article)
        else:
            # New cluster
            cid = next_cluster_id
            next_cluster_id += 1
            clusters[cid] = {
                'centroid': emb_np.copy(),
                'count': 1,
                'articles': [article],
            }

    return clusters


def analyze_clusters(clusters: Dict, threshold: float) -> Dict:
    """Deep analysis of clustering results."""
    total_articles = sum(c['count'] for c in clusters.values())
    total_clusters = len(clusters)

    # Size distribution
    sizes = [c['count'] for c in clusters.values()]
    singleton_count = sum(1 for s in sizes if s == 1)
    small_count = sum(1 for s in sizes if 2 <= s <= 3)
    medium_count = sum(1 for s in sizes if 4 <= s <= 7)
    large_count = sum(1 for s in sizes if 8 <= s <= 15)
    mega_count = sum(1 for s in sizes if s > 15)

    # Category breakdown for multi-article clusters
    multi_clusters = {cid: c for cid, c in clusters.items() if c['count'] >= 2}

    # Check cluster quality - are articles in the same cluster about the same thing?
    # Look at title similarity within clusters
    good_clusters = 0
    bad_clusters = 0
    questionable_clusters = 0
    bad_cluster_examples = []
    good_cluster_examples = []

    for cid, cluster in multi_clusters.items():
        titles = [a.get('title', '') for a in cluster['articles']]
        if len(titles) < 2:
            continue

        # Check pairwise title similarities within cluster
        from difflib import SequenceMatcher
        sims = []
        for i in range(len(titles)):
            for j in range(i+1, min(len(titles), i+5)):  # Check up to 5 pairs
                sim = SequenceMatcher(None, titles[i].lower(), titles[j].lower()).ratio()
                sims.append(sim)

        avg_title_sim = sum(sims) / len(sims) if sims else 0

        # Also check if they share key entities
        def get_entities(title):
            words = title.split()
            entities = set()
            for w in words:
                clean = w.strip('.,!?:;()[]"\'').strip('*')
                if clean and clean[0].isupper() and len(clean) > 2 and clean.lower() not in {
                    'the', 'and', 'for', 'new', 'how', 'why', 'what', 'top', 'best', 'from',
                    'this', 'that', 'will', 'has', 'have', 'not', 'but', 'are', 'was', 'its',
                    'can', 'may', 'all', 'over', 'just', 'more', 'now', 'after', 'before',
                    'into', 'says', 'said', 'could', 'should', 'would', 'about', 'than',
                }:
                    entities.add(clean.lower())
            return entities

        all_entities = [get_entities(t) for t in titles]
        if all_entities:
            common = all_entities[0]
            for ent_set in all_entities[1:]:
                common = common.intersection(ent_set)
            has_common_entity = len(common) > 0
        else:
            has_common_entity = False

        if avg_title_sim > 0.5 or has_common_entity:
            good_clusters += 1
            if len(good_cluster_examples) < 5:
                good_cluster_examples.append({
                    'size': cluster['count'],
                    'titles': titles[:5],
                    'avg_title_sim': avg_title_sim,
                    'common_entities': list(common) if has_common_entity else []
                })
        elif avg_title_sim > 0.3:
            questionable_clusters += 1
        else:
            bad_clusters += 1
            if len(bad_cluster_examples) < 5:
                bad_cluster_examples.append({
                    'size': cluster['count'],
                    'titles': titles[:5],
                    'avg_title_sim': avg_title_sim,
                })

    # Category diversity in clusters
    category_counts = Counter()
    for cluster in clusters.values():
        for a in cluster['articles']:
            cat = a.get('category', 'Unknown')
            category_counts[cat] += 1

    # Multi-source coverage
    multi_source_articles = sum(c['count'] for c in clusters.values() if c['count'] >= 2)
    multi_source_pct = multi_source_articles / total_articles * 100 if total_articles > 0 else 0

    # Biggest clusters
    sorted_clusters = sorted(clusters.values(), key=lambda c: c['count'], reverse=True)
    top_clusters = []
    for c in sorted_clusters[:10]:
        titles = [a.get('title', '')[:80] for a in c['articles'][:5]]
        sources = list(set(a.get('source_name', 'Unknown') for a in c['articles']))
        top_clusters.append({
            'size': c['count'],
            'titles': titles,
            'sources': sources[:10],
            'category': c['articles'][0].get('category', 'Unknown') if c['articles'] else 'Unknown'
        })

    return {
        'threshold': threshold,
        'total_articles': total_articles,
        'total_clusters': total_clusters,
        'avg_cluster_size': total_articles / total_clusters if total_clusters > 0 else 0,
        'median_cluster_size': sorted(sizes)[len(sizes)//2] if sizes else 0,
        'max_cluster_size': max(sizes) if sizes else 0,
        'singleton_clusters': singleton_count,
        'singleton_pct': singleton_count / total_clusters * 100 if total_clusters > 0 else 0,
        'small_clusters_2_3': small_count,
        'medium_clusters_4_7': medium_count,
        'large_clusters_8_15': large_count,
        'mega_clusters_16plus': mega_count,
        'multi_source_articles': multi_source_articles,
        'multi_source_pct': multi_source_pct,
        'good_clusters': good_clusters,
        'questionable_clusters': questionable_clusters,
        'bad_clusters': bad_clusters,
        'good_cluster_examples': good_cluster_examples,
        'bad_cluster_examples': bad_cluster_examples,
        'top_clusters': top_clusters,
        'category_distribution': dict(category_counts.most_common()),
    }


# ==========================================
# MAIN
# ==========================================

def main():
    print("=" * 80)
    print("🔬 EMBEDDING THRESHOLD ANALYSIS")
    print("=" * 80)
    print(f"Testing thresholds: {THRESHOLDS}")
    print(f"Current production threshold: 0.90")
    print()

    # Step 1: Fetch articles (last 24 hours)
    articles = fetch_articles_24h()
    if len(articles) < 100:
        print("❌ Not enough articles to analyze")
        return

    # Step 2: Generate embeddings
    titles = [a.get('title', '') for a in articles]
    print(f"\n🧠 Generating embeddings for {len(titles)} articles...")
    print(f"   Using Gemini gemini-embedding-001 (same as production)")
    print(f"   This will take a few minutes with 10 parallel workers...")

    start_time = time.time()

    # Process in batches to show progress
    batch_size = 200
    all_embeddings = []
    for batch_start in range(0, len(titles), batch_size):
        batch_end = min(batch_start + batch_size, len(titles))
        batch = titles[batch_start:batch_end]
        print(f"   Batch {batch_start//batch_size + 1}/{(len(titles)-1)//batch_size + 1}: "
              f"articles {batch_start+1}-{batch_end}...")

        batch_embeddings = get_embeddings_batch(batch, max_workers=10)
        all_embeddings.extend(batch_embeddings)

        # Rate limit
        time.sleep(0.5)

    embed_time = time.time() - start_time
    success_count = sum(1 for e in all_embeddings if e is not None)
    print(f"\n   ✅ Embeddings complete in {embed_time:.1f}s")
    print(f"   Success: {success_count}/{len(titles)} ({success_count/len(titles)*100:.1f}%)")

    # Step 3: Run clustering for each threshold
    all_results = []

    for threshold in THRESHOLDS:
        print(f"\n{'='*80}")
        print(f"🔄 SIMULATING CLUSTERING AT THRESHOLD {threshold}")
        print(f"{'='*80}")

        start = time.time()
        clusters = simulate_clustering(articles, all_embeddings, threshold)
        elapsed = time.time() - start

        print(f"   ⏱️  Clustering took {elapsed:.1f}s")

        analysis = analyze_clusters(clusters, threshold)
        all_results.append(analysis)

        print(f"   📊 Clusters: {analysis['total_clusters']}, "
              f"Singletons: {analysis['singleton_clusters']} ({analysis['singleton_pct']:.1f}%), "
              f"Multi-source: {analysis['multi_source_pct']:.1f}%")

    # Step 4: Print deep analysis
    print("\n\n")
    print("=" * 100)
    print("📊 DEEP ANALYSIS: THRESHOLD COMPARISON")
    print("=" * 100)

    # Overview table
    print(f"\n{'─'*100}")
    print(f"{'Threshold':>10} │ {'Clusters':>8} │ {'Singletons':>11} │ {'Sing %':>7} │ "
          f"{'2-3':>5} │ {'4-7':>5} │ {'8-15':>5} │ {'16+':>5} │ "
          f"{'Multi-src %':>11} │ {'Max Size':>8} │ {'Avg Size':>8}")
    print(f"{'─'*100}")

    for r in all_results:
        marker = " ◄ CURRENT" if r['threshold'] == 0.90 else ""
        print(f"{r['threshold']:>10.2f} │ {r['total_clusters']:>8} │ {r['singleton_clusters']:>11} │ "
              f"{r['singleton_pct']:>6.1f}% │ {r['small_clusters_2_3']:>5} │ "
              f"{r['medium_clusters_4_7']:>5} │ {r['large_clusters_8_15']:>5} │ "
              f"{r['mega_clusters_16plus']:>5} │ {r['multi_source_pct']:>10.1f}% │ "
              f"{r['max_cluster_size']:>8} │ {r['avg_cluster_size']:>8.2f}{marker}")

    print(f"{'─'*100}")

    # Quality analysis
    print(f"\n\n{'='*100}")
    print(f"🔍 CLUSTER QUALITY ANALYSIS (multi-article clusters)")
    print(f"{'='*100}")
    print(f"\n{'─'*80}")
    print(f"{'Threshold':>10} │ {'Good':>6} │ {'Questionable':>13} │ {'Bad':>6} │ {'Quality %':>10}")
    print(f"{'─'*80}")

    for r in all_results:
        total_quality = r['good_clusters'] + r['questionable_clusters'] + r['bad_clusters']
        quality_pct = r['good_clusters'] / total_quality * 100 if total_quality > 0 else 0
        marker = " ◄ CURRENT" if r['threshold'] == 0.90 else ""
        print(f"{r['threshold']:>10.2f} │ {r['good_clusters']:>6} │ {r['questionable_clusters']:>13} │ "
              f"{r['bad_clusters']:>6} │ {quality_pct:>9.1f}%{marker}")

    print(f"{'─'*80}")
    print(f"\nGood = articles share entities or high title similarity (>50%)")
    print(f"Questionable = moderate title similarity (30-50%)")
    print(f"Bad = low title similarity (<30%) and no shared entities")

    # Trade-off analysis
    print(f"\n\n{'='*100}")
    print(f"⚖️  TRADE-OFF ANALYSIS")
    print(f"{'='*100}")

    for r in all_results:
        total_quality = r['good_clusters'] + r['questionable_clusters'] + r['bad_clusters']
        quality_pct = r['good_clusters'] / total_quality * 100 if total_quality > 0 else 0

        marker = " ◄◄◄ CURRENT PRODUCTION" if r['threshold'] == 0.90 else ""
        print(f"\n  Threshold {r['threshold']:.2f}{marker}")
        print(f"  ├── Clusters: {r['total_clusters']} ({r['singleton_pct']:.1f}% singletons)")
        print(f"  ├── Multi-source coverage: {r['multi_source_pct']:.1f}% of articles grouped with others")
        print(f"  ├── Cluster quality: {quality_pct:.1f}% good")
        print(f"  ├── Bad clusters: {r['bad_clusters']} (mismatched articles)")
        print(f"  └── Max cluster size: {r['max_cluster_size']}")

        if r['threshold'] <= 0.85:
            print(f"       ⚠️  AGGRESSIVE: More merging, risk of mixing unrelated articles")
        elif r['threshold'] <= 0.87:
            print(f"       📊 MODERATE: Good grouping with some risk")
        elif r['threshold'] <= 0.90:
            print(f"       🎯 CONSERVATIVE: Safe grouping, some articles stay separate")
        else:
            print(f"       🔒 VERY STRICT: Minimal merging, lots of standalone articles")

    # Top clusters examples for each threshold
    print(f"\n\n{'='*100}")
    print(f"📰 TOP 5 LARGEST CLUSTERS PER THRESHOLD")
    print(f"{'='*100}")

    for r in all_results:
        marker = " (CURRENT)" if r['threshold'] == 0.90 else ""
        print(f"\n{'─'*80}")
        print(f"  Threshold {r['threshold']:.2f}{marker}")
        print(f"{'─'*80}")

        for i, tc in enumerate(r['top_clusters'][:5]):
            print(f"\n  #{i+1} — {tc['size']} articles [{tc['category']}]")
            print(f"  Sources: {', '.join(tc['sources'][:5])}")
            for t in tc['titles'][:3]:
                print(f"    • {t}")

    # Bad cluster examples
    print(f"\n\n{'='*100}")
    print(f"❌ BAD CLUSTER EXAMPLES (mismatched articles grouped together)")
    print(f"{'='*100}")

    for r in all_results:
        if not r['bad_cluster_examples']:
            continue
        marker = " (CURRENT)" if r['threshold'] == 0.90 else ""
        print(f"\n{'─'*80}")
        print(f"  Threshold {r['threshold']:.2f}{marker} — {r['bad_clusters']} bad clusters total")
        print(f"{'─'*80}")

        for i, bc in enumerate(r['bad_cluster_examples'][:3]):
            print(f"\n  Bad cluster #{i+1} ({bc['size']} articles, title sim: {bc['avg_title_sim']:.2f}):")
            for t in bc['titles'][:4]:
                print(f"    • {t[:90]}")

    # Good cluster examples
    print(f"\n\n{'='*100}")
    print(f"✅ GOOD CLUSTER EXAMPLES")
    print(f"{'='*100}")

    for r in all_results:
        if not r['good_cluster_examples']:
            continue
        marker = " (CURRENT)" if r['threshold'] == 0.90 else ""
        print(f"\n{'─'*80}")
        print(f"  Threshold {r['threshold']:.2f}{marker}")
        print(f"{'─'*80}")

        for i, gc in enumerate(r['good_cluster_examples'][:3]):
            entities = ', '.join(gc['common_entities'][:5]) if gc['common_entities'] else 'none'
            print(f"\n  Good cluster #{i+1} ({gc['size']} articles, title sim: {gc['avg_title_sim']:.2f}, "
                  f"shared entities: {entities}):")
            for t in gc['titles'][:4]:
                print(f"    • {t[:90]}")

    # Recommendation
    print(f"\n\n{'='*100}")
    print(f"🏆 RECOMMENDATION")
    print(f"{'='*100}")

    # Score each threshold: quality * multi-source coverage, penalize bad clusters
    best_score = -1
    best_threshold = None

    for r in all_results:
        total_quality = r['good_clusters'] + r['questionable_clusters'] + r['bad_clusters']
        quality_pct = r['good_clusters'] / total_quality * 100 if total_quality > 0 else 0

        # Score = quality * multi_source_coverage - bad_cluster_penalty
        score = (quality_pct * r['multi_source_pct'] / 100) - (r['bad_clusters'] * 2)

        print(f"  {r['threshold']:.2f}: score={score:.1f} "
              f"(quality={quality_pct:.1f}% × coverage={r['multi_source_pct']:.1f}% "
              f"- {r['bad_clusters']}×2 bad penalty)")

        if score > best_score:
            best_score = score
            best_threshold = r['threshold']

    print(f"\n  🏆 BEST THRESHOLD: {best_threshold:.2f} (score: {best_score:.1f})")
    print(f"     Current production: 0.90")

    if best_threshold != 0.90:
        print(f"\n  💡 Consider changing from 0.90 → {best_threshold:.2f}")
    else:
        print(f"\n  ✅ Current threshold 0.90 is already optimal!")


if __name__ == '__main__':
    main()

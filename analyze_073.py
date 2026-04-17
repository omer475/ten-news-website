#!/usr/bin/env python3
"""
Analyze clustering quality at threshold 0.73.
Fetches last 3000 source articles, generates embeddings, runs greedy clustering,
and dumps ALL multi-article clusters with full title listings.
Flags potential wrong merges and produces a quality assessment.
"""

import os
import sys
import numpy as np
import requests
import re
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env.local'))

# ==========================================
# CONFIG
# ==========================================

THRESHOLD = 0.73
ARTICLE_LIMIT = 3000

TOPIC_KEYWORDS = {
    'iran': ['iran', 'iranian', 'tehran', 'khamenei', 'irgc', 'persian gulf'],
    'trump': ['trump', 'donald trump', 'maga'],
    'israel': ['israel', 'israeli', 'gaza', 'hamas', 'netanyahu', 'idf'],
    'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy'],
}

# ==========================================
# SUPABASE + EMBEDDING HELPERS
# ==========================================

def get_supabase():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


def cosine_similarity(vec1, vec2):
    a = np.array(vec1)
    b = np.array(vec2)
    dot = np.dot(a, b)
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def get_embedding(text, api_key):
    clean = re.sub(r'&#\d+;|&\w+;', '', text).strip()[:500]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": clean}]}
    }
    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, timeout=30)
            if resp.status_code == 429:
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            return resp.json()['embedding']['values']
        except Exception as e:
            if attempt == 2:
                print(f"  WARNING: Embedding failed for: {text[:50]}... ({e})")
                return None
            time.sleep(1)
    return None


# ==========================================
# FETCH ARTICLES
# ==========================================

def fetch_articles(supabase, limit=3000):
    print(f"Fetching last {limit} source articles...")
    all_articles = []
    page_size = 1000
    offset = 0

    while offset < limit:
        batch_size = min(page_size, limit - offset)
        result = supabase.table('source_articles').select(
            'id, title, source_name, cluster_id, created_at, category'
        ).order(
            'created_at', desc=True
        ).range(offset, offset + batch_size - 1).execute()

        if not result.data:
            break
        all_articles.extend(result.data)
        offset += len(result.data)
        print(f"  Fetched {len(all_articles)} articles so far...")

        if len(result.data) < batch_size:
            break

    print(f"Got {len(all_articles)} articles total\n")
    return all_articles


# ==========================================
# GENERATE EMBEDDINGS
# ==========================================

def generate_embeddings(articles, api_key, max_workers=5):
    print(f"Generating embeddings for {len(articles)} articles...")

    embeddings = {}

    def embed_one(idx_article):
        idx, article = idx_article
        title = article.get('title', '')
        if not title:
            return idx, None
        emb = get_embedding(title, api_key)
        return idx, emb

    done = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(embed_one, (i, a)): i for i, a in enumerate(articles)}
        for future in as_completed(futures):
            idx, emb = future.result()
            if emb is not None:
                embeddings[idx] = emb
            else:
                failed += 1
            done += 1
            if done % 100 == 0:
                print(f"  Embedded {done}/{len(articles)} ({failed} failed)")

    print(f"Generated {len(embeddings)} embeddings ({failed} failed)\n")
    return embeddings


# ==========================================
# SIMULATE CLUSTERING
# ==========================================

def simulate_clustering(articles, embeddings, threshold):
    print(f"Running greedy clustering at threshold {threshold}...")
    clusters = []  # list of {'title': str, 'embedding': list, 'article_indices': list}

    for idx, article in enumerate(articles):
        if idx not in embeddings:
            continue

        emb = embeddings[idx]
        best_cluster = None
        best_sim = 0.0

        for ci, cluster in enumerate(clusters):
            sim = cosine_similarity(emb, cluster['embedding'])
            if sim >= threshold and sim > best_sim:
                best_sim = sim
                best_cluster = ci

        if best_cluster is not None:
            clusters[best_cluster]['article_indices'].append(idx)
        else:
            clusters.append({
                'title': article.get('title', 'Unknown'),
                'embedding': emb,
                'article_indices': [idx]
            })

    multi = [c for c in clusters if len(c['article_indices']) >= 2]
    print(f"Total clusters: {len(clusters)}")
    print(f"Multi-article clusters (2+): {len(multi)}\n")
    return clusters


# ==========================================
# WRONG MERGE DETECTION
# ==========================================

def detect_wrong_merges(cluster, articles, embeddings):
    """
    For each article in a cluster, compute its similarity to the cluster centroid
    AND to the cluster's representative title embedding.
    Articles that are low-similarity outliers are flagged as potential wrong merges.
    """
    indices = cluster['article_indices']
    if len(indices) < 2:
        return []

    # Compute centroid
    vecs = [np.array(embeddings[i]) for i in indices if i in embeddings]
    if len(vecs) < 2:
        return []
    centroid = np.mean(vecs, axis=0)

    # Compute each article's similarity to centroid
    sims = []
    for i in indices:
        if i not in embeddings:
            continue
        sim = cosine_similarity(embeddings[i], centroid.tolist())
        sims.append((i, sim))

    if not sims:
        return []

    avg_sim = np.mean([s for _, s in sims])
    std_sim = np.std([s for _, s in sims])

    # Flag articles more than 1.5 std below average, or similarity < 0.70
    # (below the threshold used, so they were "borderline" accepted)
    outlier_threshold = max(avg_sim - 1.5 * std_sim, 0.65)

    wrong_merges = []
    for i, sim in sims:
        if sim < outlier_threshold:
            title = articles[i].get('title', 'Unknown')
            wrong_merges.append({
                'article_idx': i,
                'title': title,
                'centroid_sim': sim,
                'avg_sim': avg_sim,
            })
    return wrong_merges


# ==========================================
# TOPIC CLASSIFICATION
# ==========================================

def classify_article_topic(article):
    title = (article.get('title') or '').lower()
    topics = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(kw in title for kw in keywords):
            topics.append(topic)
    return topics


def cluster_has_topic(cluster, articles, topic):
    for idx in cluster['article_indices']:
        if topic in classify_article_topic(articles[idx]):
            return True
    return False


# ==========================================
# REPORTING
# ==========================================

def print_all_clusters(clusters, articles, embeddings):
    """Print ALL multi-article clusters sorted by size descending."""
    multi = [c for c in clusters if len(c['article_indices']) >= 2]
    multi.sort(key=lambda c: len(c['article_indices']), reverse=True)

    print(f"\n{'='*90}")
    print(f"ALL MULTI-ARTICLE CLUSTERS AT THRESHOLD 0.73 — {len(multi)} clusters")
    print(f"{'='*90}\n")

    all_wrong_merges = []

    for ci, cluster in enumerate(multi):
        size = len(cluster['article_indices'])
        rep_title = cluster['title']
        wrong_merges = detect_wrong_merges(cluster, articles, embeddings)

        print(f"CLUSTER {ci+1:>3} [{size:>3} articles]  Representative: {rep_title[:80]}")
        print(f"{'─'*90}")
        for rank, idx in enumerate(cluster['article_indices']):
            title = articles[idx].get('title', 'Unknown')
            source = articles[idx].get('source_name', '')
            topics = classify_article_topic(articles[idx])
            topic_tag = f" [{','.join(topics)}]" if topics else ""
            wrong_tag = ""
            if any(wm['article_idx'] == idx for wm in wrong_merges):
                wm = next(wm for wm in wrong_merges if wm['article_idx'] == idx)
                wrong_tag = f"  *** POTENTIAL WRONG MERGE (centroid_sim={wm['centroid_sim']:.3f}, avg={wm['avg_sim']:.3f}) ***"
            print(f"  {rank+1:>2}. {title[:85]}{topic_tag}{wrong_tag}")
            if source:
                print(f"      [{source}]")

        if wrong_merges:
            print(f"  [!] {len(wrong_merges)} potential wrong merge(s) in this cluster")
            for wm in wrong_merges:
                all_wrong_merges.append({
                    'cluster_idx': ci + 1,
                    'cluster_rep': rep_title,
                    'cluster_size': size,
                    'article_title': wm['title'],
                    'centroid_sim': wm['centroid_sim'],
                    'avg_sim': wm['avg_sim'],
                })
        print()

    return multi, all_wrong_merges


def print_topic_clusters(clusters, articles, topic, keywords):
    """Print all clusters containing articles matching a topic."""
    topic_clusters = []
    for cluster in clusters:
        if cluster_has_topic(cluster, articles, topic):
            topic_clusters.append(cluster)

    topic_clusters.sort(key=lambda c: len(c['article_indices']), reverse=True)

    print(f"\n{'='*90}")
    print(f"{topic.upper()} CLUSTERS (keywords: {keywords}) — {len(topic_clusters)} clusters")
    print(f"{'='*90}\n")

    if not topic_clusters:
        print(f"  No clusters found for topic: {topic}\n")
        return

    for ci, cluster in enumerate(topic_clusters):
        size = len(cluster['article_indices'])
        print(f"  Cluster [{size:>3} articles]  Rep: {cluster['title'][:75]}")
        for idx in cluster['article_indices']:
            title = articles[idx].get('title', 'Unknown')
            is_topic = topic in classify_article_topic(articles[idx])
            marker = "  >>>" if is_topic else "     "
            print(f"  {marker} {title[:85]}")
        print()


def print_quality_assessment(multi_clusters, all_wrong_merges, articles, clusters):
    """Print detailed quality assessment."""
    total_clusters = len(clusters)
    multi = multi_clusters
    total_multi = len(multi)

    # Classify clusters
    correct_clusters = []
    wrong_clusters = []

    wrong_cluster_indices = set(wm['cluster_idx'] for wm in all_wrong_merges)

    for ci, cluster in enumerate(multi):
        if (ci + 1) in wrong_cluster_indices:
            wrong_clusters.append(cluster)
        else:
            correct_clusters.append(cluster)

    pct_correct = (len(correct_clusters) / total_multi * 100) if total_multi > 0 else 0
    pct_wrong = (len(wrong_clusters) / total_multi * 100) if total_multi > 0 else 0

    print(f"\n{'='*90}")
    print(f"QUALITY ASSESSMENT — THRESHOLD 0.73")
    print(f"{'='*90}\n")

    print(f"Total clusters (all sizes):    {total_clusters}")
    print(f"Multi-article clusters (2+):   {total_multi}")
    print(f"Singleton clusters:            {total_clusters - total_multi}")

    sizes = [len(c['article_indices']) for c in clusters]
    print(f"\nCluster size distribution:")
    size_dist = defaultdict(int)
    for s in sizes:
        if s == 1:
            size_dist['1 (singleton)'] += 1
        elif s <= 3:
            size_dist['2-3'] += 1
        elif s <= 10:
            size_dist['4-10'] += 1
        elif s <= 25:
            size_dist['11-25'] += 1
        else:
            size_dist['26+'] += 1
    for bucket in ['1 (singleton)', '2-3', '4-10', '11-25', '26+']:
        print(f"  {bucket:<20}: {size_dist.get(bucket, 0)}")

    print(f"\nClusters CORRECT (no detected wrong merges): {len(correct_clusters)} ({pct_correct:.1f}%)")
    print(f"Clusters with WRONG MERGES detected:         {len(wrong_clusters)} ({pct_wrong:.1f}%)")
    print(f"Total wrong-merge instances flagged:         {len(all_wrong_merges)}")

    if all_wrong_merges:
        print(f"\n{'─'*90}")
        print(f"COMPLETE LIST OF WRONG MERGES:")
        print(f"{'─'*90}")
        for i, wm in enumerate(all_wrong_merges):
            print(f"\n  [{i+1}] In cluster {wm['cluster_idx']} (size {wm['cluster_size']}):")
            print(f"       Cluster rep : {wm['cluster_rep'][:80]}")
            print(f"       Mismatch    : {wm['article_title'][:80]}")
            print(f"       Centroid sim: {wm['centroid_sim']:.3f}  (cluster avg: {wm['avg_sim']:.3f})")

    # Overall quality score: simple heuristic
    # Start at 100, subtract per wrong merge weighted by severity
    if total_multi > 0:
        wrong_rate = len(wrong_clusters) / total_multi
        # Quality = 1 - wrong_rate, scaled to 0-10
        quality_score = round((1 - wrong_rate) * 10, 1)
    else:
        quality_score = 0

    print(f"\n{'='*90}")
    print(f"OVERALL QUALITY SCORE for threshold 0.73: {quality_score}/10")
    print(f"  ({len(correct_clusters)}/{total_multi} multi-article clusters appear correct)")
    print()

    if quality_score >= 8:
        verdict = "GOOD — threshold 0.73 produces mostly clean clusters"
    elif quality_score >= 6:
        verdict = "ACCEPTABLE — some wrong merges but generally reasonable"
    elif quality_score >= 4:
        verdict = "POOR — significant number of wrong merges, consider raising threshold"
    else:
        verdict = "BAD — threshold 0.73 is too low, many unrelated articles grouped together"

    print(f"  Verdict: {verdict}")
    print(f"{'='*90}\n")


# ==========================================
# MAIN
# ==========================================

def main():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    supabase = get_supabase()

    # Fetch articles
    articles = fetch_articles(supabase, ARTICLE_LIMIT)
    if not articles:
        print("ERROR: No articles found")
        sys.exit(1)

    # Generate embeddings
    embeddings = generate_embeddings(articles, api_key, max_workers=5)

    # Run clustering
    clusters = simulate_clustering(articles, embeddings, THRESHOLD)

    # Print ALL multi-article clusters
    multi_clusters, all_wrong_merges = print_all_clusters(clusters, articles, embeddings)

    # Print topic-specific clusters
    for topic, keywords in TOPIC_KEYWORDS.items():
        print_topic_clusters(clusters, articles, topic, keywords)

    # Quality assessment
    print_quality_assessment(multi_clusters, all_wrong_merges, articles, clusters)


if __name__ == '__main__':
    main()

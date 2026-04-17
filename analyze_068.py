#!/usr/bin/env python3
"""
Deep quality analysis of greedy clustering at threshold 0.68.
Dumps ALL multi-article clusters with titles and flags potential wrong merges.
"""

import os
import sys
import numpy as np
import requests
import re
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# ==========================================
# ENV / CONFIG
# ==========================================

THRESHOLD = 0.68
ARTICLE_LIMIT = 3000

TOPIC_KEYWORDS = {
    'iran': ['iran', 'iranian', 'tehran', 'khamenei', 'irgc', 'persian gulf'],
    'trump': ['trump', 'donald trump', 'maga'],
    'israel': ['israel', 'israeli', 'gaza', 'hamas', 'netanyahu', 'idf'],
    'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy'],
}

# ==========================================
# SUPABASE HELPERS
# ==========================================

def get_supabase():
    from supabase import create_client
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


def fetch_articles(supabase, limit=3000):
    print(f"Fetching last {limit} source articles...")
    all_articles = []
    page_size = 1000
    offset = 0
    while offset < limit:
        batch_size = min(page_size, limit - offset)
        result = supabase.table('source_articles').select(
            'id, title, source_name, cluster_id, created_at, category'
        ).order('created_at', desc=True).range(offset, offset + batch_size - 1).execute()
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
# EMBEDDING HELPERS
# ==========================================

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
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-embedding-001:embedContent?key={api_key}"
    )
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": clean}]},
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
# GREEDY CLUSTERING
# ==========================================

def simulate_clustering(articles, embeddings, threshold):
    """
    Greedy clustering: each article joins the best matching existing cluster
    above threshold, or creates a new one.
    """
    clusters = []
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
                'article_indices': [idx],
            })
    return clusters


# ==========================================
# TOPIC HELPERS
# ==========================================

def article_topics(article):
    title = (article.get('title') or '').lower()
    return [t for t, kws in TOPIC_KEYWORDS.items() if any(kw in title for kw in kws)]


def cluster_has_topic(cluster, articles, topic):
    for idx in cluster['article_indices']:
        if topic in article_topics(articles[idx]):
            return True
    return False


# ==========================================
# WRONG-MERGE DETECTION
# ==========================================

def detect_wrong_merges(cluster, articles, embeddings, threshold):
    """
    For a cluster, compute each article's average cosine similarity to all
    other articles in the cluster. Articles with avg_sim significantly below
    the cluster mean are flagged as potential wrong merges.
    """
    indices = cluster['article_indices']
    if len(indices) < 2:
        return []

    # Build pairwise similarity matrix
    n = len(indices)
    avg_sims = {}
    for i, idx_i in enumerate(indices):
        if idx_i not in embeddings:
            continue
        sims = []
        for j, idx_j in enumerate(indices):
            if i == j or idx_j not in embeddings:
                continue
            s = cosine_similarity(embeddings[idx_i], embeddings[idx_j])
            sims.append(s)
        if sims:
            avg_sims[idx_i] = np.mean(sims)

    if not avg_sims:
        return []

    all_vals = list(avg_sims.values())
    cluster_mean = np.mean(all_vals)
    cluster_std = np.std(all_vals)

    # Flag articles whose avg similarity is more than 1.5 std below the mean,
    # AND below a hard floor of 0.60 (noticeably weaker than threshold)
    flagged = []
    for idx, avg_s in avg_sims.items():
        z = (avg_s - cluster_mean) / (cluster_std + 1e-9)
        if z < -1.5 and avg_s < 0.62:
            flagged.append({
                'idx': idx,
                'title': articles[idx].get('title', ''),
                'avg_sim': avg_s,
                'z_score': z,
            })

    return sorted(flagged, key=lambda x: x['avg_sim'])


# ==========================================
# PRINT ALL CLUSTERS
# ==========================================

def print_all_clusters(clusters, articles, embeddings):
    multi = [c for c in clusters if len(c['article_indices']) >= 2]
    multi_sorted = sorted(multi, key=lambda c: len(c['article_indices']), reverse=True)

    print(f"\n{'='*90}")
    print(f"ALL MULTI-ARTICLE CLUSTERS AT THRESHOLD {THRESHOLD}")
    print(f"Total multi-article clusters: {len(multi_sorted)}")
    print(f"{'='*90}\n")

    wrong_merge_report = []

    for rank, cluster in enumerate(multi_sorted, 1):
        size = len(cluster['article_indices'])
        anchor = cluster['title'][:80]
        print(f"[{rank:>4}]  SIZE={size}  ANCHOR: {anchor}")
        for idx in cluster['article_indices']:
            a = articles[idx]
            title = (a.get('title') or '').strip()
            src = (a.get('source_name') or '').strip()
            print(f"         - {title}  [{src}]")

        # Wrong merge detection
        flagged = detect_wrong_merges(cluster, articles, embeddings, THRESHOLD)
        if flagged:
            print(f"  *** POTENTIAL WRONG MERGES ({len(flagged)}) ***")
            for f in flagged:
                print(f"      avg_sim={f['avg_sim']:.3f}  z={f['z_score']:.2f}  \"{f['title']}\"")
            wrong_merge_report.append({
                'rank': rank,
                'size': size,
                'anchor': anchor,
                'flagged': flagged,
            })

        print()

    return wrong_merge_report, multi_sorted


# ==========================================
# TOPIC-SPECIFIC OUTPUT
# ==========================================

def print_topic_clusters(multi_sorted, articles, topic_label, keywords):
    print(f"\n{'='*90}")
    print(f"TOPIC: {topic_label.upper()}")
    print(f"{'='*90}")

    relevant = []
    for c in multi_sorted:
        for idx in c['article_indices']:
            t = (articles[idx].get('title') or '').lower()
            if any(kw in t for kw in keywords):
                relevant.append(c)
                break

    if not relevant:
        print("  No clusters found for this topic.")
        return

    print(f"  {len(relevant)} clusters contain {topic_label} articles\n")
    for rank_in_topic, cluster in enumerate(relevant, 1):
        size = len(cluster['article_indices'])
        print(f"  [{rank_in_topic}]  SIZE={size}  ANCHOR: {cluster['title'][:75]}")
        for idx in cluster['article_indices']:
            a = articles[idx]
            t = (a.get('title') or '').strip()
            kw_match = [kw for kw in keywords if kw in t.lower()]
            marker = " <-- TOPIC" if kw_match else ""
            print(f"           - {t}{marker}")
        print()


# ==========================================
# QUALITY ASSESSMENT
# ==========================================

def quality_assessment(multi_sorted, wrong_merge_report, articles):
    total = len(multi_sorted)
    wrong_count = len(wrong_merge_report)
    correct_count = total - wrong_count

    print(f"\n{'='*90}")
    print(f"QUALITY ASSESSMENT — THRESHOLD {THRESHOLD}")
    print(f"{'='*90}\n")

    print(f"Total multi-article clusters:  {total}")
    print(f"Clusters that appear CORRECT:  {correct_count}  ({100*correct_count/total:.1f}%)")
    print(f"Clusters with WRONG MERGES:    {wrong_count}   ({100*wrong_count/total:.1f}%)")

    total_flagged_articles = sum(len(r['flagged']) for r in wrong_merge_report)
    print(f"Total wrongly-merged articles: {total_flagged_articles}\n")

    if wrong_merge_report:
        print("DETAILED WRONG MERGE LIST:")
        print("-" * 90)
        for r in wrong_merge_report:
            print(f"\nCluster rank #{r['rank']}  SIZE={r['size']}")
            print(f"  Anchor: \"{r['anchor']}\"")
            for f in r['flagged']:
                print(f"  MISMATCHED: avg_sim={f['avg_sim']:.3f}  \"{f['title']}\"")

    # Score: penalize wrong merges
    # Base score = % correct clusters, minus 2 points per wrong-merged article
    base = 100 * correct_count / total if total else 0
    penalty = min(total_flagged_articles * 2, 30)  # cap penalty at 30
    score = max(0, base - penalty)

    print(f"\n{'='*90}")
    print(f"OVERALL QUALITY SCORE FOR THRESHOLD {THRESHOLD}:  {score:.1f} / 100")
    print(f"  (base {base:.1f}% correct clusters, minus {penalty:.0f} pts penalty for {total_flagged_articles} wrong-merged articles)")
    print(f"{'='*90}\n")

    # Plain-language verdict
    if score >= 85:
        verdict = "EXCELLENT — very tight clustering, almost no noise."
    elif score >= 70:
        verdict = "GOOD — most clusters are coherent, a few borderline merges."
    elif score >= 55:
        verdict = "FAIR — noticeable wrong merges; threshold may be too low."
    else:
        verdict = "POOR — many wrong merges; threshold is definitely too low."

    print(f"Verdict: {verdict}\n")


# ==========================================
# MAIN
# ==========================================

def main():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    supabase = get_supabase()
    articles = fetch_articles(supabase, ARTICLE_LIMIT)
    if not articles:
        print("ERROR: No articles found")
        sys.exit(1)

    embeddings = generate_embeddings(articles, api_key, max_workers=5)

    print(f"Running greedy clustering at threshold {THRESHOLD}...")
    clusters = simulate_clustering(articles, embeddings, THRESHOLD)
    total_multi = sum(1 for c in clusters if len(c['article_indices']) >= 2)
    singletons = sum(1 for c in clusters if len(c['article_indices']) == 1)
    print(f"  Total clusters: {len(clusters)}")
    print(f"  Multi-article:  {total_multi}")
    print(f"  Singletons:     {singletons}\n")

    # Dump ALL clusters with wrong-merge detection
    wrong_merge_report, multi_sorted = print_all_clusters(clusters, articles, embeddings)

    # Topic-specific dumps
    topic_defs = [
        ("Iran", ['iran', 'iranian', 'tehran', 'khamenei', 'irgc', 'persian gulf']),
        ("Trump", ['trump', 'donald trump', 'maga']),
        ("Israel", ['israel', 'israeli', 'gaza', 'hamas', 'netanyahu', 'idf']),
        ("Ukraine", ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy']),
    ]
    for label, kws in topic_defs:
        print_topic_clusters(multi_sorted, articles, label, kws)

    # Final quality assessment
    quality_assessment(multi_sorted, wrong_merge_report, articles)


if __name__ == '__main__':
    main()

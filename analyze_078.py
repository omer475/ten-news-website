#!/usr/bin/env python3
"""
Deep cluster quality analysis at threshold 0.78.
Fetches last 3000 source articles, generates embeddings, runs greedy clustering,
then dumps ALL multi-article clusters with full titles and flags potential wrong merges.
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

THRESHOLD = 0.78
ARTICLE_LIMIT = 3000

TOPIC_KEYWORDS = {
    'iran': ['iran', 'iranian', 'tehran', 'khamenei', 'irgc', 'persian gulf'],
    'trump': ['trump', 'donald trump', 'maga'],
    'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy'],
    'israel': ['israel', 'israeli', 'gaza', 'hamas', 'netanyahu', 'idf'],
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
# CLUSTERING
# ==========================================

def simulate_clustering(articles, embeddings, threshold):
    """
    Greedy clustering using vectorized NumPy ops for speed.
    For each article, compute cosine similarity against all cluster seed embeddings
    in one matrix multiplication, then pick best match above threshold.
    """
    # Pre-normalize all embeddings so dot product == cosine similarity
    valid_indices = sorted(embeddings.keys())
    emb_matrix = np.array([embeddings[i] for i in valid_indices], dtype=np.float32)
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    emb_matrix_norm = emb_matrix / norms  # shape: (N, D)

    clusters = []
    cluster_seed_embs = []  # normalized seed embeddings as list, used for matrix ops
    cluster_seed_matrix = None  # np.array of shape (C, D), rebuilt incrementally

    done = 0
    for pos, idx in enumerate(valid_indices):
        article = articles[idx]
        emb_norm = emb_matrix_norm[pos]  # already normalized

        if cluster_seed_matrix is not None and len(clusters) > 0:
            # Compute dot products (= cosine sims since normalized)
            sims = cluster_seed_matrix.dot(emb_norm)  # shape: (C,)
            best_ci = int(np.argmax(sims))
            best_sim = float(sims[best_ci])
        else:
            best_ci = -1
            best_sim = 0.0

        if best_sim >= threshold:
            clusters[best_ci]['article_indices'].append(idx)
        else:
            # New cluster — add to structures
            clusters.append({
                'title': article.get('title', 'Unknown'),
                'embedding': emb_norm.tolist(),
                'article_indices': [idx]
            })
            cluster_seed_embs.append(emb_norm)
            if cluster_seed_matrix is None:
                cluster_seed_matrix = emb_norm.reshape(1, -1)
            else:
                cluster_seed_matrix = np.vstack([cluster_seed_matrix, emb_norm])

        done += 1
        if done % 500 == 0:
            print(f"  Clustered {done}/{len(valid_indices)} articles, {len(clusters)} clusters so far...")

    return clusters


# ==========================================
# TOPIC HELPERS
# ==========================================

def classify_article_topic(article):
    title = (article.get('title') or '').lower()
    topics = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(kw in title for kw in keywords):
            topics.append(topic)
    return topics


def article_has_topic(article, topic):
    return topic in classify_article_topic(article)


def cluster_has_topic(cluster, articles, topic):
    for idx in cluster['article_indices']:
        if article_has_topic(articles[idx], topic):
            return True
    return False


# ==========================================
# WRONG MERGE DETECTION
# ==========================================

def detect_wrong_merges(cluster, articles, embeddings):
    """
    For each article in a cluster, compute its average cosine similarity
    to all OTHER articles in the cluster using vectorized ops.
    Articles with avg_sim < 0.72 are flagged as potential wrong merges.
    """
    indices = cluster['article_indices']
    if len(indices) < 2:
        return []

    valid_pairs = [(i, embeddings[i]) for i in indices if i in embeddings]
    if len(valid_pairs) < 2:
        return []

    idx_list = [p[0] for p in valid_pairs]
    emb_arr = np.array([p[1] for p in valid_pairs], dtype=np.float32)

    # Normalize
    norms = np.linalg.norm(emb_arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    emb_norm = emb_arr / norms

    # Full similarity matrix
    sim_matrix = emb_norm.dot(emb_norm.T)  # (M, M)
    np.fill_diagonal(sim_matrix, np.nan)

    avg_sims = np.nanmean(sim_matrix, axis=1)
    min_sims = np.nanmin(sim_matrix, axis=1)

    outliers = []
    for i, (idx_i, avg_sim, min_sim) in enumerate(zip(idx_list, avg_sims, min_sims)):
        if avg_sim < 0.72:
            title = articles[idx_i].get('title', 'Unknown')
            outliers.append({
                'idx': idx_i,
                'title': title,
                'avg_sim': float(avg_sim),
                'min_sim': float(min_sim),
                'reason': f'avg similarity to cluster = {avg_sim:.3f} (below 0.72)'
            })

    return outliers


# ==========================================
# MAIN OUTPUT
# ==========================================

def print_separator(char='=', width=100):
    print(char * width)


def main():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    supabase = get_supabase()

    # Fetch
    articles = fetch_articles(supabase, ARTICLE_LIMIT)
    if not articles:
        print("ERROR: No articles found")
        sys.exit(1)

    # Embed
    embeddings = generate_embeddings(articles, api_key, max_workers=5)

    # Cluster
    print(f"Running greedy clustering at threshold {THRESHOLD}...")
    clusters = simulate_clustering(articles, embeddings, THRESHOLD)
    print(f"  -> {len(clusters)} total clusters\n")

    # Multi-article clusters only, sorted by size desc
    multi_clusters = sorted(
        [c for c in clusters if len(c['article_indices']) >= 2],
        key=lambda c: len(c['article_indices']),
        reverse=True
    )

    print_separator()
    print(f"CLUSTER QUALITY ANALYSIS — threshold={THRESHOLD}, articles={len(articles)}")
    print_separator()
    print(f"Total clusters: {len(clusters)}")
    print(f"Multi-article clusters (2+): {len(multi_clusters)}")
    sizes = [len(c['article_indices']) for c in clusters]
    print(f"Avg cluster size: {np.mean(sizes):.2f}")
    print(f"Max cluster size: {max(sizes)}")
    print(f"Singletons: {sum(1 for s in sizes if s == 1)}")
    print()

    # ==========================================
    # DUMP ALL MULTI-ARTICLE CLUSTERS
    # ==========================================
    print_separator()
    print("ALL MULTI-ARTICLE CLUSTERS (sorted by size, descending)")
    print_separator()

    wrong_merges_all = []  # collect all wrong merges for summary

    for rank, cluster in enumerate(multi_clusters, 1):
        indices = cluster['article_indices']
        size = len(indices)
        cluster_title = cluster['title'][:90]

        print(f"\n[CLUSTER #{rank}] Size={size} | Seed title: {cluster_title}")
        print("-" * 90)

        # Print all article titles
        for pos, idx in enumerate(indices):
            art = articles[idx]
            title = art.get('title', 'Unknown')
            source = art.get('source_name', '?')
            created = (art.get('created_at') or '')[:10]
            print(f"  {pos+1:>3}. [{created}] ({source}) {title}")

        # Detect wrong merges
        outliers = detect_wrong_merges(cluster, articles, embeddings)
        if outliers:
            print(f"  *** POTENTIAL WRONG MERGES ({len(outliers)}) ***")
            for o in outliers:
                print(f"      - avg_sim={o['avg_sim']:.3f}: {o['title'][:85]}")
            wrong_merges_all.append({
                'rank': rank,
                'cluster_title': cluster['title'],
                'size': size,
                'outliers': outliers
            })

    # ==========================================
    # TOPIC-SPECIFIC SECTIONS
    # ==========================================

    for topic, keywords in TOPIC_KEYWORDS.items():
        topic_clusters = [c for c in multi_clusters if cluster_has_topic(c, articles, topic)]
        print_separator()
        print(f"TOPIC: {topic.upper()} — {len(topic_clusters)} clusters containing {topic}-related articles")
        print_separator()
        print(f"(keywords: {', '.join(keywords)})")
        print()

        if not topic_clusters:
            print(f"  No multi-article clusters found for topic: {topic}\n")
            continue

        for rank_t, cluster in enumerate(topic_clusters, 1):
            indices = cluster['article_indices']
            size = len(indices)
            print(f"\n  [{topic.upper()} cluster #{rank_t}] Size={size} | Seed: {cluster['title'][:85]}")
            print("  " + "-" * 85)
            for pos, idx in enumerate(indices):
                art = articles[idx]
                title = art.get('title', 'Unknown')
                source = art.get('source_name', '?')
                created = (art.get('created_at') or '')[:10]
                # Mark topic articles
                has_topic = article_has_topic(art, topic)
                marker = "[*]" if has_topic else "   "
                print(f"  {marker} {pos+1:>3}. [{created}] ({source}) {title}")

    # ==========================================
    # WRONG MERGE SUMMARY
    # ==========================================

    print_separator()
    print("WRONG MERGE SUMMARY")
    print_separator()
    print(f"Total clusters with potential wrong merges: {len(wrong_merges_all)}")
    print(f"Total wrong-merge articles flagged: {sum(len(w['outliers']) for w in wrong_merges_all)}")
    print()

    if wrong_merges_all:
        print("EVERY WRONG MERGE FOUND:")
        print()
        for w in wrong_merges_all:
            print(f"  Cluster #{w['rank']} (size={w['size']}): {w['cluster_title'][:75]}")
            for o in w['outliers']:
                print(f"    MISMATCHED: avg_sim={o['avg_sim']:.3f} | {o['title'][:80]}")
            print()
    else:
        print("  No wrong merges detected by similarity analysis.")

    # ==========================================
    # QUALITY ASSESSMENT
    # ==========================================

    print_separator()
    print("OVERALL QUALITY ASSESSMENT — THRESHOLD 0.78")
    print_separator()

    total_multi = len(multi_clusters)
    num_wrong = len(wrong_merges_all)
    num_correct = total_multi - num_wrong
    pct_correct = 100.0 * num_correct / total_multi if total_multi > 0 else 0.0
    quality_score = pct_correct / 100.0

    print(f"""
Threshold tested : {THRESHOLD}
Articles analyzed: {len(articles)}
Total clusters   : {len(clusters)}
  - Singletons   : {sum(1 for s in sizes if s == 1)}
  - Multi-article: {total_multi}

Multi-article cluster breakdown:
  2-3   articles : {sum(1 for c in multi_clusters if 2 <= len(c['article_indices']) <= 3)}
  4-10  articles : {sum(1 for c in multi_clusters if 4 <= len(c['article_indices']) <= 10)}
  11-25 articles : {sum(1 for c in multi_clusters if 11 <= len(c['article_indices']) <= 25)}
  26+   articles : {sum(1 for c in multi_clusters if len(c['article_indices']) >= 26)}

Quality metrics (based on similarity-score outlier detection):
  Clusters that appear CORRECT (no outliers)  : {num_correct} ({pct_correct:.1f}%)
  Clusters with POTENTIAL wrong merges        : {num_wrong} ({100-pct_correct:.1f}%)
  Overall quality score                       : {quality_score:.2f} / 1.00

Assessment:
  > 0.90 = Excellent (very tight clustering, almost no wrong merges)
  > 0.80 = Good (occasional false positives, acceptable for production)
  > 0.70 = Fair (noticeable wrong merges, borderline)
  < 0.70 = Poor (threshold too low, many unrelated articles merged)
""")

    if quality_score >= 0.90:
        verdict = "EXCELLENT — threshold 0.78 produces very tight, high-quality clusters."
    elif quality_score >= 0.80:
        verdict = "GOOD — threshold 0.78 is acceptable for production use with occasional mismatches."
    elif quality_score >= 0.70:
        verdict = "FAIR — threshold 0.78 produces noticeable wrong merges; consider raising to 0.82."
    else:
        verdict = "POOR — threshold 0.78 is too low; many unrelated articles are being merged."

    print(f"VERDICT: {verdict}")
    print()

    # Topic cluster summary
    print("Topic-specific cluster counts at threshold 0.78:")
    for topic in TOPIC_KEYWORDS:
        topic_clusters = [c for c in multi_clusters if cluster_has_topic(c, articles, topic)]
        topic_article_count = sum(
            1 for c in multi_clusters
            for idx in c['article_indices']
            if article_has_topic(articles[idx], topic)
        )
        print(f"  {topic:<12}: {len(topic_clusters):>3} clusters containing {topic_article_count:>4} articles")

    print()
    print_separator()
    print("Analysis complete.")
    print_separator()


if __name__ == '__main__':
    main()

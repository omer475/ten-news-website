#!/usr/bin/env python3
"""
K-Means User Interest Clustering Service
==========================================
Replaces the SQL category-based cluster_user_interests() with proper
embedding-space k-means clustering.

Usage:
    # Cluster a single user
    python3 services/cluster_user_interests.py --user-id <uuid>

    # Cluster all users with taste vectors
    python3 services/cluster_user_interests.py --all

    # Dry run (print clusters without saving)
    python3 services/cluster_user_interests.py --user-id <uuid> --dry-run
"""

import os
import sys
import argparse
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import Counter
from dotenv import load_dotenv
from supabase import create_client

try:
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
except ImportError:
    print("ERROR: scikit-learn required. Install with: pip install scikit-learn")
    sys.exit(1)

# Load env
for env_path in [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.env.local'),
]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MAX_CLUSTERS = 5
LOOKBACK_DAYS = 90
MIN_INTERACTIONS = 10


def fetch_user_engagements(user_id, lookback_days=LOOKBACK_DAYS):
    """Fetch user's engaged article embeddings."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat()

    result = supabase.table('user_article_events') \
        .select('article_id, event_type, created_at') \
        .eq('user_id', user_id) \
        .in_('event_type', ['article_engaged', 'article_saved', 'article_detail_view']) \
        .gte('created_at', cutoff) \
        .order('created_at', desc=True) \
        .limit(1000) \
        .execute()

    if not result.data:
        return [], []

    article_ids = list(set(e['article_id'] for e in result.data if e['article_id']))

    # Fetch embeddings
    all_articles = []
    for i in range(0, len(article_ids), 300):
        batch = article_ids[i:i+300]
        art_result = supabase.table('published_articles') \
            .select('id, title_news, category, embedding') \
            .in_('id', batch) \
            .not_.is_('embedding', 'null') \
            .execute()
        all_articles.extend(art_result.data or [])

    return result.data, all_articles


def find_optimal_k(embeddings, max_k=MAX_CLUSTERS):
    """Find optimal number of clusters using silhouette score."""
    n = len(embeddings)
    if n < 6:
        return 1

    max_possible_k = min(max_k, n // 3)
    if max_possible_k < 2:
        return 1

    best_k = 1
    best_score = -1

    for k in range(2, max_possible_k + 1):
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=100)
        labels = km.fit_predict(embeddings)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(embeddings, labels, sample_size=min(500, n))
        if score > best_score:
            best_score = score
            best_k = k

    return best_k


def compute_similarity_floor(embeddings, taste_vector):
    """Compute 25th percentile similarity as the dynamic floor."""
    sims = []
    taste_norm = np.linalg.norm(taste_vector)
    for emb in embeddings:
        dot = np.dot(emb, taste_vector)
        norm = np.linalg.norm(emb) * taste_norm
        sims.append(dot / norm if norm > 0 else 0)
    if len(sims) < 5:
        return 0.0
    return float(np.percentile(sims, 25))


def cluster_user(user_id, dry_run=False, verbose=True):
    """Run k-means clustering for a single user."""
    if verbose:
        print(f"\nClustering user {user_id[:12]}...")

    # Fetch engagements
    events, articles = fetch_user_engagements(user_id)
    if len(articles) < MIN_INTERACTIONS:
        if verbose:
            print(f"  Only {len(articles)} articles with embeddings. Need {MIN_INTERACTIONS}+. Skipping.")
        return 0

    # Build embedding matrix
    article_map = {}
    embeddings = []
    article_ids = []
    for art in articles:
        emb = art.get('embedding')
        if emb and isinstance(emb, list) and len(emb) > 0:
            embeddings.append(np.array(emb, dtype=np.float64))
            article_ids.append(art['id'])
            article_map[art['id']] = art

    if len(embeddings) < MIN_INTERACTIONS:
        if verbose:
            print(f"  Only {len(embeddings)} valid embeddings. Skipping.")
        return 0

    emb_matrix = np.array(embeddings)

    # Find optimal k
    k = find_optimal_k(emb_matrix, MAX_CLUSTERS)

    # Run k-means
    km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=100)
    labels = km.fit_predict(emb_matrix)
    centroids = km.cluster_centers_

    if verbose:
        print(f"  {len(embeddings)} articles → {k} clusters")

    # Build cluster metadata
    clusters = []
    for ci in range(k):
        mask = labels == ci
        cluster_article_ids = [article_ids[i] for i in range(len(labels)) if mask[i]]
        cluster_categories = [article_map[aid].get('category', '?') for aid in cluster_article_ids if aid in article_map]
        category_counts = Counter(cluster_categories)

        # Find nearest article to centroid (for medoid_article_id)
        cluster_indices = np.where(mask)[0]
        distances = np.linalg.norm(emb_matrix[cluster_indices] - centroids[ci], axis=1)
        nearest_idx = cluster_indices[np.argmin(distances)]
        nearest_article_id = article_ids[nearest_idx]

        # Label: most common category + top keyword from titles
        label = category_counts.most_common(1)[0][0] if category_counts else f"Cluster-{ci}"

        clusters.append({
            'cluster_index': ci,
            'centroid': centroids[ci],
            'medoid_article_id': nearest_article_id,
            'article_count': int(mask.sum()),
            'label': label,
            'categories': dict(category_counts.most_common(3)),
        })

        if verbose:
            print(f"    Cluster {ci}: '{label}' ({mask.sum()} articles, cats={dict(category_counts.most_common(3))})")

    # Compute similarity floor
    # Use the weighted average of centroids as the "taste vector" for floor computation
    total_count = sum(c['article_count'] for c in clusters)
    weighted_centroid = np.zeros_like(centroids[0])
    for c in clusters:
        weighted_centroid += c['centroid'] * (c['article_count'] / total_count)
    sim_floor = compute_similarity_floor(emb_matrix, weighted_centroid)

    if verbose:
        print(f"  Similarity floor: {sim_floor:.4f}")

    if dry_run:
        if verbose:
            print("  DRY RUN — not saving to DB")
        return k

    # Save to DB
    # 1. Delete old clusters
    try:
        supabase.table('user_interest_clusters').delete().eq('user_id', user_id).execute()
    except:
        pass

    # 2. Insert new clusters
    for c in clusters:
        supabase.table('user_interest_clusters').insert({
            'user_id': user_id,
            'cluster_index': c['cluster_index'],
            'medoid_embedding': c['centroid'].tolist(),
            'medoid_article_id': c['medoid_article_id'],
            'article_count': c['article_count'],
            'label': c['label'],
            'is_centroid': True,
        }).execute()

    # 3. Update taste vector (weighted centroid) and similarity floor
    supabase.table('users').update({
        'taste_vector': weighted_centroid.tolist(),
        'similarity_floor': sim_floor,
    }).eq('id', user_id).execute()

    if verbose:
        print(f"  Saved {k} clusters + taste vector + floor to DB")

    return k


def cluster_all_users(dry_run=False):
    """Cluster all users who have taste vectors."""
    result = supabase.table('users') \
        .select('id') \
        .not_.is_('taste_vector', 'null') \
        .execute()

    users = result.data or []
    print(f"Found {len(users)} users with taste vectors")

    total_clustered = 0
    for user in users:
        k = cluster_user(user['id'], dry_run=dry_run)
        if k > 0:
            total_clustered += 1

    print(f"\nClustered {total_clustered}/{len(users)} users")


def main():
    parser = argparse.ArgumentParser(description='K-Means User Interest Clustering')
    parser.add_argument('--user-id', help='Cluster a specific user')
    parser.add_argument('--all', action='store_true', help='Cluster all users with taste vectors')
    parser.add_argument('--dry-run', action='store_true', help='Print results without saving')
    args = parser.parse_args()

    if args.user_id:
        cluster_user(args.user_id, dry_run=args.dry_run)
    elif args.all:
        cluster_all_users(dry_run=args.dry_run)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
K-Means User Interest Clustering Service
==========================================
Runs proper embedding-space k-means clustering to maintain 3-5 interest
vectors per user (PinnerSage-lite). Supports both batch and single-user mode.

The SQL RPC cluster_user_interests() handles real-time auto-triggering
(category-based, fast). This script is for periodic batch re-clustering
with higher quality k-means.

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
    from scipy.cluster.hierarchy import linkage, fcluster
    from scipy.spatial.distance import pdist
except ImportError:
    print("ERROR: scipy required. Install with: pip install scipy")
    sys.exit(1)

# Load env
for env_path in [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env.local'),
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

MAX_CLUSTERS = 8
MIN_CLUSTER_SIZE = 3
LOOKBACK_DAYS = 90
MIN_INTERACTIONS = 10

# Recency weights: newer interactions matter more
RECENCY_WEIGHTS = {7: 3.0, 30: 1.5}  # days: multiplier (default 1.0)

# Event weights: stronger signals count more
EVENT_WEIGHTS = {
    'article_revisit': 4.0,
    'article_saved': 3.0,
    'article_engaged': 2.0,
    'article_detail_view': 1.0,
}


def fetch_user_engagements(user_id, lookback_days=LOOKBACK_DAYS):
    """Fetch user's engaged article embeddings with recency weighting."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat()

    result = supabase.table('user_article_events') \
        .select('article_id, event_type, created_at') \
        .eq('user_id', user_id) \
        .in_('event_type', ['article_engaged', 'article_saved', 'article_detail_view', 'article_revisit']) \
        .gte('created_at', cutoff) \
        .order('created_at', desc=True) \
        .limit(1000) \
        .execute()

    if not result.data:
        return [], []

    article_ids = list(set(e['article_id'] for e in result.data if e['article_id']))

    # Fetch embeddings (both Gemini and MiniLM)
    all_articles = []
    for i in range(0, len(article_ids), 300):
        batch = article_ids[i:i+300]
        art_result = supabase.table('published_articles') \
            .select('id, title_news, category, embedding, embedding_minilm, interest_tags') \
            .in_('id', batch) \
            .not_.is_('embedding_minilm', 'null') \
            .execute()
        all_articles.extend(art_result.data or [])

    return result.data, all_articles


def get_recency_weight(created_at_str):
    """Compute recency multiplier for an event."""
    now = datetime.now(timezone.utc)
    created = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
    days_ago = (now - created).days
    for threshold, weight in sorted(RECENCY_WEIGHTS.items()):
        if days_ago <= threshold:
            return weight
    return 1.0


def ward_cluster(embeddings, max_distance=1.2):
    """Ward's hierarchical clustering — discovers natural number of clusters.
    No need to specify k. A user with 3 interests gets 3 clusters,
    a user with 10 gets 10. No fake clusters from K-means forcing."""
    n = len(embeddings)
    if n < 4:
        return np.zeros(n, dtype=int), 1

    distances = pdist(embeddings, metric='cosine')
    Z = linkage(distances, method='ward')
    labels = fcluster(Z, t=max_distance, criterion='distance') - 1  # 0-indexed
    n_clusters = len(set(labels))
    return labels, n_clusters


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

    # Fix A: Load skip_profile to exclude skip-heavy articles from clustering
    skip_profile = {}
    try:
        sp_result = supabase.table('profiles').select('skip_profile').eq('id', user_id).single().execute()
        if sp_result.data and sp_result.data.get('skip_profile'):
            skip_profile = sp_result.data['skip_profile']
    except:
        pass

    # Build recency-weighted embedding matrix
    # Weight each article by its strongest event's recency * event weight
    article_weights = {}
    for event in events:
        aid = event['article_id']
        event_w = EVENT_WEIGHTS.get(event['event_type'], 1.0)
        recency_w = get_recency_weight(event['created_at'])
        w = event_w * recency_w
        article_weights[aid] = max(article_weights.get(aid, 0), w)

    article_map = {}
    embeddings = []
    weights = []
    article_ids = []
    skipped_out = 0
    for art in articles:
        # Fix A: Skip articles whose primary tags are heavily skipped
        tags = art.get('interest_tags', [])
        if isinstance(tags, list) and len(tags) >= 2 and skip_profile:
            top2_skip_weight = sum(
                skip_profile.get(t.lower(), 0) if isinstance(skip_profile.get(t.lower()), (int, float)) else 0
                for t in tags[:2]
            )
            if top2_skip_weight > 0.30:
                skipped_out += 1
                continue  # exclude this article from clustering

        # Use MiniLM 384-dim embeddings (matches pgvector search)
        emb = art.get('embedding_minilm') or art.get('embedding')
        if emb and isinstance(emb, list) and len(emb) > 0:
            embeddings.append(np.array(emb, dtype=np.float64))
            weights.append(article_weights.get(art['id'], 1.0))
            article_ids.append(art['id'])
            article_map[art['id']] = art

    if len(embeddings) < MIN_INTERACTIONS:
        if verbose:
            print(f"  Only {len(embeddings)} valid embeddings. Skipping.")
        return 0

    emb_matrix = np.array(embeddings)
    weight_array = np.array(weights)

    # Ward's hierarchical clustering — discovers natural cluster count
    labels, k = ward_cluster(emb_matrix, max_distance=1.2)

    # Compute centroids as weighted mean of each cluster
    centroids = np.zeros((k, emb_matrix.shape[1]))
    for ci in range(k):
        mask = labels == ci
        if mask.sum() > 0:
            cluster_weights = weight_array[mask]
            centroids[ci] = np.average(emb_matrix[mask], axis=0, weights=cluster_weights)

    if verbose:
        print(f"  {len(embeddings)} articles → {k} clusters (Ward's hierarchical)")

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

        # Label from most common interest tags (more specific than category)
        cluster_tags = []
        broad_tags = {'politics','sports','business','technology','health','science',
                      'entertainment','world','finance','energy','military','economy',
                      'government','trade','security','lifestyle','culture'}
        for aid in cluster_article_ids:
            art = article_map.get(aid, {})
            tags = art.get('interest_tags', [])
            if isinstance(tags, list):
                for t in tags[:3]:
                    if t.lower() not in broad_tags:
                        cluster_tags.append(t)
        tag_counts = Counter(cluster_tags)
        if tag_counts:
            top_tags = [t for t, _ in tag_counts.most_common(2)]
            label = ' & '.join(top_tags)
        else:
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

    # Merge small clusters (< MIN_CLUSTER_SIZE) into the largest
    if len(clusters) > 1:
        clusters.sort(key=lambda c: c['article_count'], reverse=True)
        merged = [clusters[0]]
        for c in clusters[1:]:
            if c['article_count'] < MIN_CLUSTER_SIZE:
                merged[0]['article_count'] += c['article_count']
                if verbose:
                    print(f"    Merged small cluster '{c['label']}' ({c['article_count']} articles) into '{merged[0]['label']}'")
            else:
                merged.append(c)
        clusters = merged
        # Re-index
        for i, c in enumerate(clusters):
            c['cluster_index'] = i

    # Compute similarity floor
    total_count = sum(c['article_count'] for c in clusters)
    weighted_centroid = np.zeros_like(centroids[0])
    for c in clusters:
        weighted_centroid += c['centroid'] * (c['article_count'] / total_count)
    sim_floor = compute_similarity_floor(emb_matrix, weighted_centroid)

    # Fix A: Validate clusters against skip_profile — suppress skip-heavy clusters
    for c in clusters:
        # Get the top tags from the label (split by ' & ')
        label_tags = [t.strip().lower() for t in c['label'].split('&')]
        avg_skip = 0
        count = 0
        for tag in label_tags:
            w = skip_profile.get(tag, 0)
            if isinstance(w, (int, float)):
                avg_skip += w
                count += 1
        avg_skip = avg_skip / max(count, 1)
        c['suppressed'] = avg_skip > 0.20
        if c['suppressed'] and verbose:
            print(f"    ⛔ Cluster '{c['label']}' SUPPRESSED (avg skip weight: {avg_skip:.2f})")

    if verbose:
        print(f"  Similarity floor: {sim_floor:.4f}")
        active = sum(1 for c in clusters if not c.get('suppressed'))
        print(f"  Final: {len(clusters)} clusters ({active} active, {len(clusters)-active} suppressed)")

    if dry_run:
        if verbose:
            print("  DRY RUN - not saving to DB")
        return len(clusters)

    # Save to DB
    # Fix 2: Resolve personalization_id so clusters are saved with the right key
    pers_id = None
    try:
        pers_result = supabase.rpc('resolve_personalization_id', {'p_auth_id': user_id}).execute()
        if pers_result.data and len(pers_result.data) > 0:
            pers_id = pers_result.data[0]['personalization_id']
    except Exception:
        pass

    # 1. Delete old clusters (both legacy user_id and V3 personalization_id)
    try:
        supabase.table('user_interest_clusters').delete().eq('user_id', user_id).execute()
    except Exception:
        pass
    if pers_id:
        try:
            supabase.table('user_interest_clusters').delete().eq('personalization_id', pers_id).execute()
        except Exception:
            pass

    # 2. Insert new clusters with personalization_id (V3) when available
    for c in clusters:
        centroid_list_c = c['centroid'].tolist()
        row = {
            'cluster_index': c['cluster_index'],
            'medoid_embedding': centroid_list_c,
            'medoid_minilm': centroid_list_c,  # Use centroid as medoid_minilm (more accurate than nearest article)
            'medoid_article_id': c['medoid_article_id'],
            'article_count': c['article_count'],
            'label': c['label'],
            'suppressed': c.get('suppressed', False),
            'last_engaged_at': datetime.now(timezone.utc).isoformat(),
        }
        # Set the correct key: V3 uses personalization_id, legacy uses user_id
        if pers_id:
            row['personalization_id'] = pers_id
            row['user_id'] = None
        else:
            row['user_id'] = user_id
        # Compute importance_score proportional to article count
        row['importance_score'] = c['article_count'] / total_count

        supabase.table('user_interest_clusters').insert(row).execute()

    # 3. Update taste vectors — write weighted centroid to BOTH profiles and personalization_profiles
    # Fix 3A: Long-term vector is ONLY set by clustering (weighted centroid of top 3 clusters)
    top3_clusters = sorted(clusters, key=lambda c: c['article_count'], reverse=True)[:3]
    top3_total = sum(c['article_count'] for c in top3_clusters)
    focused_centroid = np.zeros_like(centroids[0])
    for c in top3_clusters:
        focused_centroid += c['centroid'] * (c['article_count'] / top3_total)
    centroid_list = focused_centroid.tolist()

    supabase.table('profiles').update({
        'taste_vector': centroid_list,
        'taste_vector_minilm': centroid_list,
        'similarity_floor': sim_floor,
    }).eq('id', user_id).execute()

    # Also update personalization_profiles (this is what the feed reads)
    # Use personalization_id (V3) when available, fall back to auth_profile_id
    if pers_id:
        supabase.table('personalization_profiles').update({
            'taste_vector_minilm': centroid_list,
            'last_clustered_at': datetime.now(timezone.utc).isoformat(),
        }).eq('personalization_id', pers_id).execute()
    else:
        supabase.table('personalization_profiles').update({
            'taste_vector_minilm': centroid_list,
            'last_clustered_at': datetime.now(timezone.utc).isoformat(),
        }).eq('auth_profile_id', user_id).execute()

    if verbose:
        print(f"  Saved {len(clusters)} clusters + taste vector + floor to DB")

    return len(clusters)


def cluster_all_users(dry_run=False):
    """Cluster all users who have taste vectors."""
    # Check both profiles and users tables
    result = supabase.table('profiles') \
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

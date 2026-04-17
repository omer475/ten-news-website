#!/usr/bin/env python3
"""
Personalized Feed Analysis: 5-User Multi-Interest Study
========================================================
Tests single EMA taste vector vs improved multi-cluster approach:
  - K-means clustering on article embeddings (replaces category-based grouping)
  - Round-robin slot allocation per cluster
  - Similarity floor to block irrelevant leaks

5 test users:
  1. F1 Racing + NBA + Tennis
  2. AI/ML + K-pop + Space
  3. Turkish Politics + Middle East + Turkish Football
  4. Crypto + Climate + Gaming
  5. Only UFC (control — single interest)
"""

import os
import sys
import re
import uuid
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from dotenv import load_dotenv
from supabase import create_client
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# Load env
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.env.local')
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Similarity floor: articles below this won't enter the personal feed
SIM_FLOOR = 0.0  # Will be dynamically computed per user

# ==========================================
# TEST USER PROFILES
# ==========================================

TEST_USERS = [
    {
        "name": "User 1: F1 + NBA + Tennis",
        "email": "test_multi_f1nba@tennews.test",
        "home_country": "usa",
        "interests": {
            "F1 Racing": {
                "search_terms": ["F1", "Formula", "Grand Prix", "Hamilton", "Verstappen",
                                 "Mercedes", "Red Bull", "Ferrari", "McLaren", "racing",
                                 "pole position", "pit stop", "constructor"],
                "categories": ["Motorsport", "Auto Racing"],
                "weight": 0.40,
            },
            "NBA": {
                "search_terms": ["NBA", "basketball", "Lakers", "Celtics", "LeBron",
                                 "Curry", "playoff", "dunk", "rebound", "three-pointer",
                                 "Knicks", "Warriors", "Bucks"],
                "categories": ["Basketball"],
                "weight": 0.35,
            },
            "Tennis": {
                "search_terms": ["tennis", "Djokovic", "Alcaraz", "Sinner", "Wimbledon",
                                 "Roland Garros", "ATP", "WTA", "Grand Slam", "serve",
                                 "match point", "set", "Medvedev", "Sabalenka"],
                "categories": ["Tennis"],
                "weight": 0.25,
            },
        },
    },
    {
        "name": "User 2: AI/ML + K-pop + Space",
        "email": "test_multi_aiml@tennews.test",
        "home_country": "usa",
        "interests": {
            "AI/ML": {
                "search_terms": ["AI", "artificial intelligence", "machine learning",
                                 "GPT", "OpenAI", "neural", "deep learning", "LLM",
                                 "ChatGPT", "transformer", "Anthropic", "Google AI",
                                 "Gemini", "Claude"],
                "categories": ["AI", "Artificial Intelligence"],
                "weight": 0.40,
            },
            "K-pop": {
                "search_terms": ["K-pop", "BTS", "BLACKPINK", "Korean", "idol",
                                 "album", "concert", "K-drama", "TWICE", "Stray Kids",
                                 "ENHYPEN", "aespa", "NewJeans", "HYBE"],
                "categories": ["K-pop", "Korean"],
                "weight": 0.30,
            },
            "Space": {
                "search_terms": ["NASA", "SpaceX", "space", "Mars", "rocket",
                                 "satellite", "asteroid", "moon", "orbit", "launch",
                                 "ISS", "astronaut", "Starship", "Webb telescope"],
                "categories": ["Space", "Astronomy"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 3: TurkPol + MidEast + TurkFB",
        "email": "test_multi_turkey@tennews.test",
        "home_country": "turkiye",
        "interests": {
            "Turkish Politics": {
                "search_terms": ["Turkey", "Turkish", "Erdogan", "Ankara", "parliament",
                                 "CHP", "AKP", "Turkiye", "minister", "Imamoglu",
                                 "opposition", "Turkish lira"],
                "categories": ["Turkish Politics"],
                "weight": 0.35,
            },
            "Middle East": {
                "search_terms": ["Syria", "Iran", "Iraq", "Lebanon", "Gaza", "Israel",
                                 "Middle East", "Saudi", "Hamas", "Hezbollah",
                                 "Palestinian", "Yemen", "Houthi"],
                "categories": ["Middle East"],
                "weight": 0.35,
            },
            "Turkish Football": {
                "search_terms": ["Galatasaray", "Fenerbahce", "Besiktas", "Super Lig",
                                 "Trabzonspor", "Turkish football", "Basaksehir",
                                 "Icardi", "Osimhen", "Mourinho"],
                "categories": ["Turkish Football", "Super Lig"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 4: Crypto + Climate + Gaming",
        "email": "test_multi_crypto@tennews.test",
        "home_country": "usa",
        "interests": {
            "Crypto": {
                "search_terms": ["Bitcoin", "crypto", "Ethereum", "blockchain", "NFT",
                                 "DeFi", "token", "Web3", "cryptocurrency", "BTC",
                                 "Solana", "SEC crypto", "Coinbase", "Binance"],
                "categories": ["Crypto", "Cryptocurrency", "Blockchain"],
                "weight": 0.35,
            },
            "Climate": {
                "search_terms": ["climate", "carbon", "renewable", "solar", "wind energy",
                                 "emissions", "global warming", "sustainability",
                                 "green energy", "environment", "EV", "electric vehicle",
                                 "clean energy", "fossil fuel"],
                "categories": ["Climate", "Environment", "Energy"],
                "weight": 0.35,
            },
            "Gaming": {
                "search_terms": ["gaming", "PlayStation", "Xbox", "Nintendo", "Steam",
                                 "esports", "video game", "Fortnite", "console", "GPU",
                                 "GTA", "Elden Ring", "PS5", "Switch 2"],
                "categories": ["Gaming", "Video Games", "Esports"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 5: UFC Only (Control)",
        "email": "test_single_ufc@tennews.test",
        "home_country": "usa",
        "interests": {
            "UFC": {
                "search_terms": ["UFC", "MMA", "boxing", "fight", "knockout",
                                 "championship", "belt", "wrestling", "martial arts",
                                 "cage", "submission", "round", "octagon", "Dana White",
                                 "Conor McGregor", "Jon Jones", "middleweight"],
                "categories": ["Combat Sports", "Boxing", "MMA", "UFC"],
                "weight": 1.0,
            },
        },
    },
]


# ==========================================
# HELPERS
# ==========================================

def now_utc():
    return datetime.now(timezone.utc)


def get_or_create_test_user(profile):
    result = supabase.table('users').select('id').eq('email', profile['email']).execute()
    if result.data:
        user_id = result.data[0]['id']
        supabase.table('users').update({'taste_vector': None}).eq('id', user_id).execute()
        try:
            supabase.table('user_article_events').delete().eq('user_id', user_id).execute()
        except:
            pass
        try:
            supabase.table('user_interest_clusters').delete().eq('user_id', user_id).execute()
        except:
            pass
        return user_id

    user_id = str(uuid.uuid4())
    supabase.table('users').insert({
        'id': user_id,
        'email': profile['email'],
        'home_country': profile.get('home_country', 'usa'),
        'followed_topics': [],
        'followed_countries': [],
        'taste_vector': None,
    }).execute()
    return user_id


def find_articles_for_interest(interest_name, interest_config, limit=80):
    """Find articles matching a specific interest via title keywords (not broad categories)."""
    cutoff = (now_utc() - timedelta(hours=72)).isoformat()
    matched = []
    seen_ids = set()

    # Search ONLY by title keywords (not category) to avoid "generic Sports" pollution
    for term in interest_config['search_terms']:
        if len(matched) >= limit:
            break
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding') \
            .gte('created_at', cutoff) \
            .ilike('title_news', f'%{term}%') \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(40) \
            .execute()
        for a in (result.data or []):
            if a['id'] not in seen_ids:
                seen_ids.add(a['id'])
                a['_interest'] = interest_name
                matched.append(a)

    # Also search by specific categories (not broad ones like "Sports")
    for cat in interest_config['categories']:
        if len(matched) >= limit:
            break
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding') \
            .gte('created_at', cutoff) \
            .ilike('category', f'%{cat}%') \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(40) \
            .execute()
        for a in (result.data or []):
            if a['id'] not in seen_ids:
                seen_ids.add(a['id'])
                a['_interest'] = interest_name
                matched.append(a)

    return matched[:limit]


def classify_article(article, interests_config):
    """Classify article by interest using word-boundary keyword matching."""
    title = (article.get('title_news') or '').lower()

    best_match = None
    best_count = 0

    for interest_name, config in interests_config.items():
        hits = 0
        for term in config['search_terms']:
            t = term.lower()
            # Word boundary match to avoid "serve" in "Reserves", "AI" in "Claims"
            if re.search(r'\b' + re.escape(t) + r'\b', title):
                hits += 1
        if hits > best_count:
            best_count = hits
            best_match = interest_name

    return best_match if best_count > 0 else 'IRRELEVANT'


def build_taste_vector_ema(articles):
    """Build single taste vector from articles via EMA."""
    taste = None
    for idx, article in enumerate(articles):
        emb = article.get('embedding')
        if not emb or not isinstance(emb, list) or len(emb) == 0:
            continue
        emb_np = np.array(emb, dtype=np.float64)

        if idx % 5 == 0:
            alpha = 0.15
        elif idx % 3 == 0:
            alpha = 0.10
        else:
            alpha = 0.05

        if taste is None:
            taste = emb_np.copy()
        else:
            taste = (1 - alpha) * taste + alpha * emb_np
    return taste


def query_personal_feed(taste_vector, limit=150, min_sim=0.0):
    """Query personal feed using a single vector."""
    result = supabase.rpc('match_articles_personal', {
        'query_embedding': taste_vector.tolist() if isinstance(taste_vector, np.ndarray) else taste_vector,
        'match_count': limit,
        'hours_window': 72,
        'exclude_ids': [],
    }).execute()
    results = result.data or []
    if min_sim > 0:
        results = [r for r in results if r['similarity'] >= min_sim]
    return results


def fetch_article_details(article_ids):
    if not article_ids:
        return []
    all_articles = []
    for i in range(0, len(article_ids), 300):
        batch = article_ids[i:i+300]
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, topics, countries') \
            .in_('id', batch) \
            .execute()
        all_articles.extend(result.data or [])
    return all_articles


def cosine_sim(a, b):
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return dot / norm if norm > 0 else 0


# ==========================================
# K-MEANS CLUSTERING (The Fix)
# ==========================================

def cluster_embeddings_kmeans(embeddings, max_k=5):
    """
    Cluster article embeddings using k-means with automatic k selection.
    Returns (centroids, assignments, k).
    """
    n = len(embeddings)
    if n < 4:
        return embeddings.mean(axis=0, keepdims=True), np.zeros(n, dtype=int), 1

    # Try k=2..min(max_k, n//3) and pick best silhouette
    best_k = 1
    best_score = -1
    best_km = None

    max_possible_k = min(max_k, n // 3)
    if max_possible_k < 2:
        return embeddings.mean(axis=0, keepdims=True), np.zeros(n, dtype=int), 1

    for k in range(2, max_possible_k + 1):
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=100)
        labels = km.fit_predict(embeddings)
        # Need at least 2 clusters with points
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(embeddings, labels, sample_size=min(500, n))
        if score > best_score:
            best_score = score
            best_k = k
            best_km = km

    if best_km is None:
        return embeddings.mean(axis=0, keepdims=True), np.zeros(n, dtype=int), 1

    return best_km.cluster_centers_, best_km.labels_, best_k


def round_robin_merge(per_cluster_results, cluster_weights, total=20):
    """
    Round-robin merge results from multiple clusters.
    Each cluster gets slots proportional to its weight.
    Within each cluster, articles are sorted by similarity (highest first).
    """
    if not per_cluster_results:
        return []

    # Sort each cluster's results by similarity
    for ci in per_cluster_results:
        per_cluster_results[ci].sort(key=lambda x: x['similarity'], reverse=True)

    # Compute slot allocation: proportional to weight, min 1 per cluster
    total_weight = sum(cluster_weights.values())
    slots = {}
    remaining = total
    for ci in sorted(per_cluster_results.keys()):
        w = cluster_weights.get(ci, 1)
        s = max(1, round(total * w / total_weight))
        slots[ci] = s
        remaining -= s

    # Distribute remaining slots to largest clusters
    while remaining > 0:
        for ci in sorted(slots.keys(), key=lambda x: cluster_weights.get(x, 0), reverse=True):
            if remaining <= 0:
                break
            slots[ci] += 1
            remaining -= 1

    # Pick articles round-robin
    merged = []
    seen_ids = set()
    pointers = {ci: 0 for ci in per_cluster_results}

    for round_num in range(50):  # safety limit
        if len(merged) >= total:
            break
        added_any = False
        for ci in sorted(per_cluster_results.keys()):
            if len(merged) >= total:
                break
            count_for_ci = sum(1 for m in merged if m.get('_cluster') == ci)
            if count_for_ci >= slots.get(ci, 0):
                continue
            results = per_cluster_results[ci]
            while pointers[ci] < len(results):
                r = results[pointers[ci]]
                pointers[ci] += 1
                if r['id'] not in seen_ids:
                    seen_ids.add(r['id'])
                    r['_cluster'] = ci
                    merged.append(r)
                    added_any = True
                    break
        if not added_any:
            break

    # Fill any remaining slots from best available
    for ci in sorted(per_cluster_results.keys(), key=lambda x: cluster_weights.get(x, 0), reverse=True):
        if len(merged) >= total:
            break
        results = per_cluster_results[ci]
        while pointers[ci] < len(results) and len(merged) < total:
            r = results[pointers[ci]]
            pointers[ci] += 1
            if r['id'] not in seen_ids:
                seen_ids.add(r['id'])
                r['_cluster'] = ci
                merged.append(r)

    return merged


def compute_dynamic_sim_floor(all_engagement_embeddings, taste_vector):
    """
    Compute a dynamic similarity floor: the 25th percentile similarity
    of the user's engaged articles to their taste vector.
    Articles below this are unlikely to be interesting.
    """
    sims = []
    for emb in all_engagement_embeddings:
        sims.append(cosine_sim(emb, taste_vector))
    if len(sims) < 5:
        return 0.0
    return float(np.percentile(sims, 25))


# ==========================================
# ANALYSIS FOR ONE USER
# ==========================================

def analyze_user(profile, all_high_score_ids):
    print(f"\n{'#'*80}")
    print(f"  {profile['name']}")
    print(f"{'#'*80}")

    interests = profile['interests']
    print(f"  Interests: {', '.join(interests.keys())}")

    # 1. Setup
    user_id = get_or_create_test_user(profile)
    print(f"  User ID: {user_id[:12]}...")

    # 2. Find articles per interest
    articles_by_interest = {}
    all_engagement_articles = []

    for interest_name, config in interests.items():
        arts = find_articles_for_interest(interest_name, config, limit=80)
        articles_by_interest[interest_name] = arts
        print(f"  [{interest_name}] Found {len(arts)} articles")

        target = int(config['weight'] * 250)
        engaged = arts[:target]
        all_engagement_articles.extend(engaged)

    total_engagements = len(all_engagement_articles)
    print(f"\n  Total engagements: {total_engagements}")

    if total_engagements < 20:
        print("  WARNING: Too few articles. Skipping.")
        return None

    # 3. Shuffle (realistic user behavior)
    np.random.seed(42)
    np.random.shuffle(all_engagement_articles)

    # 4. Build SINGLE taste vector
    single_taste = build_taste_vector_ema(all_engagement_articles)
    if single_taste is None:
        print("  ERROR: No embeddings found")
        return None

    supabase.table('users').update({
        'taste_vector': single_taste.tolist()
    }).eq('id', user_id).execute()

    # Insert events
    events_inserted = 0
    for idx, art in enumerate(all_engagement_articles):
        evt = 'article_saved' if idx % 5 == 0 else ('article_engaged' if idx % 3 == 0 else 'article_detail_view')
        try:
            supabase.table('user_article_events').insert({
                'user_id': user_id,
                'event_type': evt,
                'article_id': art['id'],
                'category': art.get('category'),
                'metadata': {'test': True},
            }).execute()
            events_inserted += 1
        except:
            pass
    print(f"  Events inserted: {events_inserted}")

    # Collect all engagement embeddings for clustering
    all_embs = []
    all_emb_interests = []
    for art in all_engagement_articles:
        emb = art.get('embedding')
        if emb and isinstance(emb, list) and len(emb) > 0:
            all_embs.append(np.array(emb, dtype=np.float64))
            all_emb_interests.append(art.get('_interest', '?'))

    emb_matrix = np.array(all_embs)

    # Compute dynamic similarity floor
    sim_floor = compute_dynamic_sim_floor(all_embs, single_taste)
    print(f"  Dynamic similarity floor: {sim_floor:.4f}")

    # ==========================================
    # APPROACH A: Single Taste Vector (Current)
    # ==========================================

    print(f"\n  {'='*60}")
    print(f"  APPROACH A: Single Taste Vector (Current)")
    print(f"  {'='*60}")

    personal_a = query_personal_feed(single_taste, limit=150)
    sim_map_a = {r['id']: r['similarity'] for r in personal_a}
    top_ids_a = [r['id'] for r in personal_a]
    top_articles_a = fetch_article_details(top_ids_a[:50])
    top_articles_a.sort(key=lambda a: sim_map_a.get(a['id'], 0), reverse=True)

    result_a = evaluate_top20(top_articles_a[:20], sim_map_a, interests, all_high_score_ids, "A")

    # ==========================================
    # APPROACH B: K-Means Clustering + Round-Robin + Sim Floor
    # ==========================================

    print(f"\n  {'='*60}")
    print(f"  APPROACH B: K-Means + Round-Robin + Sim Floor (The Fix)")
    print(f"  {'='*60}")

    # K-means clustering
    centroids, assignments, k = cluster_embeddings_kmeans(emb_matrix, max_k=min(5, len(interests)))
    print(f"  K-means: k={k} clusters from {len(emb_matrix)} embeddings")

    # Label clusters by majority interest
    cluster_labels = {}
    cluster_weights = {}
    for ci in range(k):
        mask = assignments == ci
        cluster_interests = [all_emb_interests[i] for i in range(len(assignments)) if mask[i]]
        counts = Counter(cluster_interests)
        cluster_labels[ci] = counts.most_common(1)[0][0] if counts else f"Cluster-{ci}"
        cluster_weights[ci] = int(mask.sum())
        print(f"    Cluster {ci}: '{cluster_labels[ci]}' ({cluster_weights[ci]} articles, top={dict(counts.most_common(3))})")

    # Build engaged category set for category suppression
    engaged_categories = set()
    for art in all_engagement_articles:
        cat = (art.get('category') or '').strip()
        if cat:
            engaged_categories.add(cat)
    print(f"    Engaged categories: {engaged_categories}")

    # Per-centroid similarity search with floor + category cap
    MAX_PER_CATEGORY = 3  # Same cap as trending bucket
    per_cluster_results = {}
    for ci in range(k):
        centroid = centroids[ci]
        raw_results = query_personal_feed(centroid, limit=100, min_sim=sim_floor)

        # Fetch categories for cap enforcement
        if raw_results:
            result_ids = [r['id'] for r in raw_results]
            result_details = fetch_article_details(result_ids)
            cat_map = {a['id']: a.get('category', '') for a in result_details}

            # Category cap: max 3 articles per category per cluster
            cat_counts = defaultdict(int)
            capped = []
            for r in raw_results:
                art_cat = cat_map.get(r['id'], 'Other')
                cat_counts[art_cat] += 1
                if cat_counts[art_cat] <= MAX_PER_CATEGORY:
                    capped.append(r)
            per_cluster_results[ci] = capped[:50]
        else:
            per_cluster_results[ci] = []
        print(f"    Cluster {ci} ({cluster_labels[ci]}): {len(raw_results)}→{len(per_cluster_results[ci])} candidates (floor={sim_floor:.4f}, cat-capped@{MAX_PER_CATEGORY})")

    # Round-robin merge
    merged = round_robin_merge(per_cluster_results, cluster_weights, total=20)

    # Fetch details for merged
    merged_ids = [m['id'] for m in merged]
    merged_details = fetch_article_details(merged_ids)
    merged_article_map = {a['id']: a for a in merged_details}

    # Evaluate
    result_b = evaluate_merged_top20(merged, merged_article_map, interests, all_high_score_ids, cluster_labels, "B")

    # ==========================================
    # COMPARISON
    # ==========================================

    single_prec = result_a['precision']
    multi_prec = result_b['precision']
    improvement = multi_prec - single_prec

    print(f"\n  {'='*60}")
    print(f"  COMPARISON: A vs B")
    print(f"  {'='*60}")
    print(f"  Single vector precision:   {single_prec:5.1f}%")
    print(f"  K-Means+RR precision:      {multi_prec:5.1f}%")
    print(f"  Improvement:               {improvement:+5.1f}%")

    for interest_name in interests:
        a_hits = result_a['interest_hits'].get(interest_name, 0)
        b_hits = result_b['interest_hits'].get(interest_name, 0)
        print(f"    {interest_name:25s}: {a_hits:2d} → {b_hits:2d} ({b_hits-a_hits:+d})")

    print(f"    {'IRRELEVANT':25s}: {result_a['irrelevant']:2d} → {result_b['irrelevant']:2d} ({result_b['irrelevant']-result_a['irrelevant']:+d})")

    return {
        'user': profile['name'],
        'num_interests': len(interests),
        'engagements': total_engagements,
        'sim_floor': sim_floor,
        'k_clusters': k,
        # Approach A
        'a_precision': single_prec,
        'a_interest_hits': dict(result_a['interest_hits']),
        'a_irrelevant': result_a['irrelevant'],
        'a_leaks': result_a['leaks'],
        'a_sim_mean': result_a['sim_mean'],
        'a_sim_std': result_a['sim_std'],
        # Approach B
        'b_precision': multi_prec,
        'b_interest_hits': dict(result_b['interest_hits']),
        'b_irrelevant': result_b['irrelevant'],
        'b_leaks': result_b['leaks'],
        'b_sim_mean': result_b['sim_mean'],
        'b_sim_std': result_b['sim_std'],
        # Delta
        'improvement': improvement,
    }


def evaluate_top20(top20, sim_map, interests, high_score_ids, label):
    """Evaluate top 20 articles from a single-vector approach."""
    interest_hits = defaultdict(int)
    irrelevant = 0
    leaks = 0

    print(f"\n  Top 20 ({label}):")
    for idx, art in enumerate(top20):
        sim = sim_map.get(art['id'], 0)
        classification = classify_article(art, interests)
        title = (art.get('title_news') or '')[:55]
        score = art.get('ai_final_score', 0)

        if classification == 'IRRELEVANT':
            irrelevant += 1
            marker = ' !!' if art['id'] in high_score_ids else '  X'
            if art['id'] in high_score_ids:
                leaks += 1
        else:
            interest_hits[classification] += 1
            marker = '  *'

        print(f"    {marker} {idx+1:2d}. sim:{sim:.4f} score:{score:4.0f} | {classification:20s} | {title}")

    total_matched = sum(interest_hits.values())
    precision = total_matched / 20 * 100

    print(f"\n  Coverage ({label}):")
    for interest_name in interests:
        hits = interest_hits.get(interest_name, 0)
        pct = hits / 20 * 100
        expected = interests[interest_name]['weight'] * 100
        print(f"    {interest_name:25s}: {hits:2d}/20 ({pct:5.1f}%) — target ~{expected:.0f}%")
    print(f"    {'IRRELEVANT':25s}: {irrelevant:2d}/20 ({irrelevant/20*100:5.1f}%)")
    print(f"    {'PRECISION':25s}: {total_matched:2d}/20 ({precision:5.1f}%)")

    sims = [sim_map.get(a['id'], 0) for a in top20]
    return {
        'precision': precision,
        'interest_hits': dict(interest_hits),
        'irrelevant': irrelevant,
        'leaks': leaks,
        'sim_mean': float(np.mean(sims)) if sims else 0,
        'sim_std': float(np.std(sims)) if sims else 0,
    }


def evaluate_merged_top20(merged, article_map, interests, high_score_ids, cluster_labels, label):
    """Evaluate top 20 articles from multi-cluster round-robin approach."""
    interest_hits = defaultdict(int)
    irrelevant = 0
    leaks = 0

    print(f"\n  Top 20 ({label}):")
    for idx, m in enumerate(merged[:20]):
        art = article_map.get(m['id'], {})
        sim = m.get('similarity', 0)
        ci = m.get('_cluster', '?')
        cl = cluster_labels.get(ci, '?')
        classification = classify_article(art, interests)
        title = (art.get('title_news') or '')[:50]
        score = art.get('ai_final_score', 0)

        if classification == 'IRRELEVANT':
            irrelevant += 1
            marker = ' !!' if m['id'] in high_score_ids else '  X'
            if m['id'] in high_score_ids:
                leaks += 1
        else:
            interest_hits[classification] += 1
            marker = '  *'

        print(f"    {marker} {idx+1:2d}. sim:{sim:.4f} score:{score:4.0f} | c:{cl:15s} → {classification:20s} | {title}")

    total_matched = sum(interest_hits.values())
    precision = total_matched / max(len(merged[:20]), 1) * 100

    print(f"\n  Coverage ({label}):")
    for interest_name in interests:
        hits = interest_hits.get(interest_name, 0)
        pct = hits / max(len(merged[:20]), 1) * 100
        expected = interests[interest_name]['weight'] * 100
        print(f"    {interest_name:25s}: {hits:2d}/20 ({pct:5.1f}%) — target ~{expected:.0f}%")
    print(f"    {'IRRELEVANT':25s}: {irrelevant:2d}/20 ({irrelevant/max(len(merged[:20]),1)*100:5.1f}%)")
    print(f"    {'PRECISION':25s}: {total_matched:2d}/20 ({precision:5.1f}%)")

    sims = [m.get('similarity', 0) for m in merged[:20]]
    return {
        'precision': precision,
        'interest_hits': dict(interest_hits),
        'irrelevant': irrelevant,
        'leaks': leaks,
        'sim_mean': float(np.mean(sims)) if sims else 0,
        'sim_std': float(np.std(sims)) if sims else 0,
    }


# ==========================================
# MAIN
# ==========================================

def main():
    print("=" * 80)
    print("  PERSONALIZED FEED: SINGLE VECTOR vs K-MEANS MULTI-CLUSTER")
    print("=" * 80)
    print(f"  Time: {now_utc().isoformat()}")
    print(f"  Supabase: {SUPABASE_URL}")

    cutoff = (now_utc() - timedelta(hours=72)).isoformat()
    count_result = supabase.table('published_articles') \
        .select('id', count='exact') \
        .gte('created_at', cutoff) \
        .not_.is_('embedding', 'null') \
        .execute()
    total_articles = count_result.count if hasattr(count_result, 'count') and count_result.count else len(count_result.data or [])
    print(f"  Articles with embeddings (72h): {total_articles}")

    high_score_result = supabase.table('published_articles') \
        .select('id, title_news, category, ai_final_score') \
        .gte('created_at', cutoff) \
        .gte('ai_final_score', 850) \
        .not_.is_('embedding', 'null') \
        .order('ai_final_score', desc=True) \
        .limit(50) \
        .execute()
    all_high_score_ids = set(a['id'] for a in (high_score_result.data or []))
    print(f"  High-score articles (>=850): {len(all_high_score_ids)}")

    # Run analysis
    all_results = []
    for profile in TEST_USERS:
        result = analyze_user(profile, all_high_score_ids)
        if result:
            all_results.append(result)

    # ==========================================
    # FINAL SUMMARY
    # ==========================================

    print(f"\n\n{'='*110}")
    print("  FINAL COMPARISON TABLE")
    print(f"{'='*110}")

    header = (f"{'User':<35s} | {'#I':>2s} | {'Eng':>3s} | {'K':>1s} | "
              f"{'A Prec':>7s} | {'B Prec':>7s} | {'Delta':>7s} | "
              f"{'A Irrel':>7s} | {'B Irrel':>7s} | {'Floor':>6s}")
    print(header)
    print("-" * 110)

    for r in all_results:
        print(f"{r['user']:<35s} | {r['num_interests']:>2d} | {r['engagements']:>3d} | {r['k_clusters']:>1d} | "
              f"{r['a_precision']:>6.1f}% | {r['b_precision']:>6.1f}% | {r['improvement']:>+6.1f}% | "
              f"{r['a_irrelevant']:>5d}/20 | {r['b_irrelevant']:>5d}/20 | {r['sim_floor']:>6.4f}")

    # Per-user interest coverage
    print(f"\n\n{'='*110}")
    print("  PER-USER INTEREST BREAKDOWN: Single(A) vs K-Means+RR(B)")
    print(f"{'='*110}")

    for r in all_results:
        print(f"\n  {r['user']}  (k={r['k_clusters']}, floor={r['sim_floor']:.4f}):")
        print(f"    {'Interest':<25s} | {'A (now)':>8s} | {'B (fix)':>8s} | {'Delta':>6s} | {'Target':>6s}")
        print(f"    {'-'*65}")

        for profile in TEST_USERS:
            if profile['name'] == r['user']:
                for interest_name, config in profile['interests'].items():
                    a = r['a_interest_hits'].get(interest_name, 0)
                    b = r['b_interest_hits'].get(interest_name, 0)
                    target = config['weight'] * 20
                    print(f"    {interest_name:<25s} | {a:>6d}/20 | {b:>6d}/20 | {b-a:>+5d} | ~{target:.0f}/20")
                break
        print(f"    {'IRRELEVANT':<25s} | {r['a_irrelevant']:>6d}/20 | {r['b_irrelevant']:>6d}/20 | {r['b_irrelevant']-r['a_irrelevant']:>+5d} |")

    # Aggregate stats
    print(f"\n\n{'='*110}")
    print("  AGGREGATE STATISTICS")
    print(f"{'='*110}")

    multi_results = [r for r in all_results if r['num_interests'] > 1]
    control_results = [r for r in all_results if r['num_interests'] == 1]

    if multi_results:
        avg_a = np.mean([r['a_precision'] for r in multi_results])
        avg_b = np.mean([r['b_precision'] for r in multi_results])
        avg_irr_a = np.mean([r['a_irrelevant'] for r in multi_results])
        avg_irr_b = np.mean([r['b_irrelevant'] for r in multi_results])

        print(f"\n  Multi-interest users ({len(multi_results)}):")
        print(f"    Avg precision A (single vector): {avg_a:.1f}%")
        print(f"    Avg precision B (k-means+RR):    {avg_b:.1f}%")
        print(f"    Avg improvement:                 {avg_b - avg_a:+.1f}%")
        print(f"    Avg irrelevant A:                {avg_irr_a:.1f}/20")
        print(f"    Avg irrelevant B:                {avg_irr_b:.1f}/20")

        # Interest coverage diversity (how many distinct interests are represented)
        avg_diversity_a = np.mean([len([v for v in r['a_interest_hits'].values() if v > 0]) for r in multi_results])
        avg_diversity_b = np.mean([len([v for v in r['b_interest_hits'].values() if v > 0]) for r in multi_results])
        avg_total_interests = np.mean([r['num_interests'] for r in multi_results])
        print(f"    Avg interests represented A:     {avg_diversity_a:.1f} / {avg_total_interests:.0f}")
        print(f"    Avg interests represented B:     {avg_diversity_b:.1f} / {avg_total_interests:.0f}")

    if control_results:
        r = control_results[0]
        print(f"\n  Control user (single interest):")
        print(f"    Precision A: {r['a_precision']:.1f}%")
        print(f"    Precision B: {r['b_precision']:.1f}%")
        print(f"    Delta:       {r['improvement']:+.1f}%")

    # VERDICT
    print(f"\n\n{'='*110}")
    print("  VERDICT")
    print(f"{'='*110}")

    if multi_results:
        avg_improvement = np.mean([r['improvement'] for r in multi_results])
        avg_irr_reduction = np.mean([r['a_irrelevant'] - r['b_irrelevant'] for r in multi_results])

        if avg_improvement > 15:
            verdict = "STRONG: K-means multi-cluster is significantly better"
        elif avg_improvement > 5:
            verdict = "MODERATE: Multi-cluster provides meaningful improvement"
        elif avg_improvement > 0:
            verdict = "MARGINAL: Slight improvement, consider deployment cost"
        else:
            verdict = "NO IMPROVEMENT: Multi-cluster doesn't help (or hurts)"

        print(f"\n  Multi-interest improvement: {avg_improvement:+.1f}% precision")
        print(f"  Irrelevant reduction:       {avg_irr_reduction:+.1f} articles/20")
        print(f"  Assessment: {verdict}")

        # Check if any minority interests went from 0 to >0
        minority_fixed = 0
        minority_total = 0
        for r in multi_results:
            for profile in TEST_USERS:
                if profile['name'] == r['user']:
                    for interest_name in profile['interests']:
                        a = r['a_interest_hits'].get(interest_name, 0)
                        b = r['b_interest_hits'].get(interest_name, 0)
                        if a == 0:
                            minority_total += 1
                            if b > 0:
                                minority_fixed += 1
        if minority_total > 0:
            print(f"\n  Minority interest recovery: {minority_fixed}/{minority_total} zero-representation interests now have coverage")

    print(f"\n{'='*110}")
    print(f"  Analysis complete: {now_utc().isoformat()}")
    print(f"{'='*110}")


if __name__ == '__main__':
    main()

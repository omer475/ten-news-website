#!/usr/bin/env python3
"""
Personalized Feed Analysis v2: 6-User Study (Post Clustering Threshold Change)
===============================================================================
Tests feed quality after lowering embedding clustering threshold from 0.91 to 0.90.
6 users with diverse interests, 200+ engagements each.

Measures:
  - Interest coverage in top 20 personal feed
  - Precision (% relevant articles)
  - Interest diversity (how many interests represented)
  - Similarity distributions
  - Iran war / breaking news flooding
  - Single vector vs K-Means comparison
"""

import os
import sys
import re
import uuid
import json
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

# ==========================================
# 6 TEST USER PROFILES (all different from v1)
# ==========================================

TEST_USERS = [
    {
        "name": "User 1: Soccer + Hip-Hop + Finance",
        "email": "test_v2_soccer_hiphop@tennews.test",
        "home_country": "usa",
        "interests": {
            "Soccer": {
                "search_terms": ["soccer", "Premier League", "Champions League", "Messi",
                                 "Mbappe", "Arsenal", "Liverpool", "Barcelona", "Real Madrid",
                                 "La Liga", "Bundesliga", "Serie A", "transfer", "goal",
                                 "manager", "Europa League"],
                "categories": ["Soccer", "Football"],
                "weight": 0.40,
            },
            "Hip-Hop": {
                "search_terms": ["hip-hop", "rap", "Drake", "Kendrick", "Travis Scott",
                                 "Kanye", "album", "Grammy", "rapper", "hip hop",
                                 "Eminem", "Jay-Z", "Nicki Minaj", "Lil"],
                "categories": ["Hip-Hop", "Rap"],
                "weight": 0.30,
            },
            "Finance": {
                "search_terms": ["stock market", "Wall Street", "S&P 500", "Nasdaq",
                                 "Federal Reserve", "interest rate", "inflation", "GDP",
                                 "bond", "IPO", "earnings", "recession", "banking",
                                 "hedge fund", "investment"],
                "categories": ["Finance", "Markets"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 2: Cybersecurity + Anime + Electric Vehicles",
        "email": "test_v2_cyber_anime@tennews.test",
        "home_country": "usa",
        "interests": {
            "Cybersecurity": {
                "search_terms": ["cybersecurity", "hack", "breach", "ransomware", "malware",
                                 "vulnerability", "phishing", "data leak", "encryption",
                                 "zero-day", "firewall", "CISA", "cyber attack"],
                "categories": ["Cybersecurity", "Security"],
                "weight": 0.35,
            },
            "Anime": {
                "search_terms": ["anime", "manga", "One Piece", "Dragon Ball", "Naruto",
                                 "Studio Ghibli", "Crunchyroll", "Jujutsu", "Demon Slayer",
                                 "My Hero Academia", "Attack on Titan", "Chainsaw Man"],
                "categories": ["Anime", "Manga"],
                "weight": 0.30,
            },
            "Electric Vehicles": {
                "search_terms": ["Tesla", "EV", "electric vehicle", "Rivian", "BYD",
                                 "charging station", "battery", "Lucid", "electric car",
                                 "hybrid", "Polestar", "electric truck", "range anxiety"],
                "categories": ["Electric Vehicles", "EV"],
                "weight": 0.35,
            },
        },
    },
    {
        "name": "User 3: India Politics + Cricket + Bollywood",
        "email": "test_v2_india@tennews.test",
        "home_country": "india",
        "interests": {
            "India Politics": {
                "search_terms": ["India", "Modi", "BJP", "Congress", "Rahul Gandhi",
                                 "Delhi", "Mumbai", "parliament", "Lok Sabha",
                                 "Indian government", "Supreme Court India", "rupee"],
                "categories": ["Indian Politics"],
                "weight": 0.35,
            },
            "Cricket": {
                "search_terms": ["cricket", "IPL", "Test match", "ODI", "T20", "Virat Kohli",
                                 "Rohit Sharma", "BCCI", "wicket", "batsman", "bowler",
                                 "Ashes", "World Cup cricket", "innings"],
                "categories": ["Cricket"],
                "weight": 0.35,
            },
            "Bollywood": {
                "search_terms": ["Bollywood", "Shah Rukh Khan", "Aamir Khan", "Deepika",
                                 "Ranveer", "Hindi film", "box office India",
                                 "Salman Khan", "Katrina", "Priyanka Chopra"],
                "categories": ["Bollywood"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 4: NFL + True Crime + AI",
        "email": "test_v2_nfl_crime@tennews.test",
        "home_country": "usa",
        "interests": {
            "NFL": {
                "search_terms": ["NFL", "touchdown", "quarterback", "Super Bowl", "Chiefs",
                                 "Eagles", "Cowboys", "Patriots", "draft pick", "football",
                                 "yards", "receiver", "sack", "Mahomes", "rushing"],
                "categories": ["NFL", "American Football"],
                "weight": 0.35,
            },
            "True Crime": {
                "search_terms": ["murder", "serial killer", "crime", "investigation",
                                 "arrested", "suspect", "trial", "prison", "homicide",
                                 "kidnapping", "robbery", "fraud", "sentence", "court case",
                                 "detective", "forensic"],
                "categories": ["Crime", "True Crime"],
                "weight": 0.30,
            },
            "AI": {
                "search_terms": ["AI", "artificial intelligence", "ChatGPT", "OpenAI",
                                 "Anthropic", "machine learning", "GPT", "neural network",
                                 "deep learning", "LLM", "Gemini", "Claude", "generative"],
                "categories": ["AI", "Artificial Intelligence"],
                "weight": 0.35,
            },
        },
    },
    {
        "name": "User 5: Climate + Space + Oceans",
        "email": "test_v2_climate_space@tennews.test",
        "home_country": "australia",
        "interests": {
            "Climate": {
                "search_terms": ["climate change", "global warming", "carbon", "emissions",
                                 "renewable energy", "solar", "wind power", "fossil fuel",
                                 "greenhouse", "COP", "sustainability", "net zero",
                                 "deforestation", "ice cap", "drought"],
                "categories": ["Climate", "Environment"],
                "weight": 0.35,
            },
            "Space": {
                "search_terms": ["NASA", "SpaceX", "space", "Mars", "rocket", "satellite",
                                 "asteroid", "moon", "orbit", "launch", "astronaut",
                                 "telescope", "Starship", "Webb", "cosmos", "galaxy"],
                "categories": ["Space", "Astronomy"],
                "weight": 0.35,
            },
            "Oceans": {
                "search_terms": ["ocean", "marine", "whale", "coral reef", "deep sea",
                                 "fishing", "overfishing", "shark", "submarine", "tsunami",
                                 "Pacific", "Atlantic", "Arctic", "pollution ocean",
                                 "plastic ocean", "sea level"],
                "categories": ["Oceans", "Marine"],
                "weight": 0.30,
            },
        },
    },
    {
        "name": "User 6: Germany Only (Control)",
        "email": "test_v2_germany@tennews.test",
        "home_country": "germany",
        "interests": {
            "Germany": {
                "search_terms": ["Germany", "Berlin", "Scholz", "Bundestag", "Deutsche",
                                 "Munich", "Frankfurt", "Merz", "AfD", "German",
                                 "Volkswagen", "BMW", "Bundesliga", "Merkel",
                                 "European Union", "Hamburg"],
                "categories": ["Germany"],
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


def find_articles_for_interest(interest_name, interest_config, limit=120):
    """Find articles matching a specific interest via title keywords."""
    cutoff = (now_utc() - timedelta(hours=72)).isoformat()
    matched = []
    seen_ids = set()

    for term in interest_config['search_terms']:
        if len(matched) >= limit:
            break
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding') \
            .gte('created_at', cutoff) \
            .ilike('title_news', f'%{term}%') \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(50) \
            .execute()
        for a in (result.data or []):
            if a['id'] not in seen_ids:
                seen_ids.add(a['id'])
                a['_interest'] = interest_name
                matched.append(a)

    for cat in interest_config['categories']:
        if len(matched) >= limit:
            break
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding') \
            .gte('created_at', cutoff) \
            .ilike('category', f'%{cat}%') \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(50) \
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
            .select('id, title_news, category, ai_final_score, created_at, topics, countries, interest_tags') \
            .in_('id', batch) \
            .execute()
        all_articles.extend(result.data or [])
    return all_articles


def build_user_interest_profile(engagement_articles):
    """Build interest tag profile from user's engagement history (like main.js does)."""
    tag_scores = {}
    for idx, art in enumerate(engagement_articles):
        tags = art.get('interest_tags') or []
        if isinstance(tags, str):
            try: tags = json.loads(tags)
            except: tags = []
        # Weight: saved > engaged > viewed (simulated by position)
        weight = 3 if idx % 5 == 0 else (2 if idx % 3 == 0 else 1)
        for tag in tags:
            t = tag.lower()
            tag_scores[t] = tag_scores.get(t, 0) + weight

    if not tag_scores:
        return {}

    max_score = max(tag_scores.values())
    return {t: s / max_score for t, s in tag_scores.items()}


def compute_tag_overlap(article_tags, user_profile):
    """Compute tag overlap score between article and user profile."""
    if not user_profile:
        return 0.0
    tags = article_tags or []
    if isinstance(tags, str):
        try: tags = json.loads(tags)
        except: tags = []
    if not tags:
        return 0.0

    total = 0.0
    for tag in tags:
        t = tag.lower()
        total += user_profile.get(t, 0.0)
    return min(total / len(tags), 1.0)


def score_personal_v2(similarity, tag_overlap, ai_score, hours_old, category):
    """New scoring formula: tag overlap primary, similarity secondary."""
    hard_news = category in ('World', 'Politics', 'Business', 'Finance')
    rate = 0.04 if hard_news else 0.015
    recency = np.exp(-rate * hours_old)
    return tag_overlap * 400 + similarity * 300 + (ai_score / 1000) * 100 * recency


def apply_topic_saturation(scored_articles):
    """Apply topic saturation penalty — penalize repeated tags in feed order."""
    tag_counts = {}
    result = []
    for a in scored_articles:
        tags = a.get('_tags') or []
        penalty = 0
        for tag in tags:
            t = tag.lower()
            count = tag_counts.get(t, 0)
            if count >= 3: penalty += 0.4
            elif count >= 2: penalty += 0.25
            elif count >= 1: penalty += 0.1
        avg_penalty = min(penalty / len(tags), 0.8) if tags else 0
        a['_score'] = a['_score'] * (1 - avg_penalty)
        a['_penalty'] = avg_penalty
        result.append(a)
        for tag in tags:
            t = tag.lower()
            tag_counts[t] = tag_counts.get(t, 0) + 1
    # Re-sort after penalties
    result.sort(key=lambda x: x['_score'], reverse=True)
    return result


def cosine_sim(a, b):
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return dot / norm if norm > 0 else 0


# ==========================================
# K-MEANS CLUSTERING
# ==========================================

def cluster_embeddings_kmeans(embeddings, max_k=5):
    n = len(embeddings)
    if n < 4:
        return embeddings.mean(axis=0, keepdims=True), np.zeros(n, dtype=int), 1

    best_k = 1
    best_score = -1
    best_km = None

    max_possible_k = min(max_k, n // 3)
    if max_possible_k < 2:
        return embeddings.mean(axis=0, keepdims=True), np.zeros(n, dtype=int), 1

    for k in range(2, max_possible_k + 1):
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=100)
        labels = km.fit_predict(embeddings)
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
    if not per_cluster_results:
        return []

    for ci in per_cluster_results:
        per_cluster_results[ci].sort(key=lambda x: x['similarity'], reverse=True)

    total_weight = sum(cluster_weights.values())
    slots = {}
    remaining = total
    for ci in sorted(per_cluster_results.keys()):
        w = cluster_weights.get(ci, 1)
        s = max(1, round(total * w / total_weight))
        slots[ci] = s
        remaining -= s

    while remaining > 0:
        for ci in sorted(slots.keys(), key=lambda x: cluster_weights.get(x, 0), reverse=True):
            if remaining <= 0:
                break
            slots[ci] += 1
            remaining -= 1

    merged = []
    seen_ids = set()
    pointers = {ci: 0 for ci in per_cluster_results}

    for round_num in range(50):
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
                continue
        if not added_any:
            break

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

    user_id = get_or_create_test_user(profile)
    print(f"  User ID: {user_id[:12]}...")

    # Find articles per interest
    articles_by_interest = {}
    all_engagement_articles = []

    for interest_name, config in interests.items():
        arts = find_articles_for_interest(interest_name, config, limit=120)
        articles_by_interest[interest_name] = arts
        print(f"  [{interest_name}] Found {len(arts)} articles")

        # Target at least 200 total, distributed by weight
        target = max(int(config['weight'] * 300), 40)
        engaged = arts[:target]
        all_engagement_articles.extend(engaged)

    total_engagements = len(all_engagement_articles)
    print(f"\n  Total engagements: {total_engagements}")

    if total_engagements < 20:
        print("  WARNING: Too few articles. Skipping.")
        return None

    # Shuffle for realism
    np.random.seed(42)
    np.random.shuffle(all_engagement_articles)

    # Build SINGLE taste vector
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

    # Collect engagement embeddings
    all_embs = []
    all_emb_interests = []
    for art in all_engagement_articles:
        emb = art.get('embedding')
        if emb and isinstance(emb, list) and len(emb) > 0:
            all_embs.append(np.array(emb, dtype=np.float64))
            all_emb_interests.append(art.get('_interest', '?'))

    emb_matrix = np.array(all_embs)
    sim_floor = compute_dynamic_sim_floor(all_embs, single_taste)
    print(f"  Dynamic similarity floor: {sim_floor:.4f}")

    # ========== APPROACH A: Single Taste Vector ==========
    print(f"\n  {'='*60}")
    print(f"  APPROACH A: Single Taste Vector (Current)")
    print(f"  {'='*60}")

    personal_a = query_personal_feed(single_taste, limit=150)
    sim_map_a = {r['id']: r['similarity'] for r in personal_a}
    top_ids_a = [r['id'] for r in personal_a]
    top_articles_a = fetch_article_details(top_ids_a[:50])
    top_articles_a.sort(key=lambda a: sim_map_a.get(a['id'], 0), reverse=True)

    result_a = evaluate_top20(top_articles_a[:20], sim_map_a, interests, all_high_score_ids, "A")

    # ========== APPROACH B: K-Means + Round-Robin ==========
    print(f"\n  {'='*60}")
    print(f"  APPROACH B: K-Means + Round-Robin + Sim Floor (The Fix)")
    print(f"  {'='*60}")

    centroids, assignments, k = cluster_embeddings_kmeans(emb_matrix, max_k=min(5, len(interests)))
    print(f"  K-means: k={k} clusters from {len(emb_matrix)} embeddings")

    cluster_labels = {}
    cluster_weights = {}
    for ci in range(k):
        mask = assignments == ci
        cluster_interests = [all_emb_interests[i] for i in range(len(assignments)) if mask[i]]
        counts = Counter(cluster_interests)
        cluster_labels[ci] = counts.most_common(1)[0][0] if counts else f"Cluster-{ci}"
        cluster_weights[ci] = int(mask.sum())
        print(f"    Cluster {ci}: '{cluster_labels[ci]}' ({cluster_weights[ci]} articles, top={dict(counts.most_common(3))})")

    MAX_PER_CATEGORY = 3
    per_cluster_results = {}
    for ci in range(k):
        centroid = centroids[ci]
        raw_results = query_personal_feed(centroid, limit=100, min_sim=sim_floor)

        if raw_results:
            result_ids = [r['id'] for r in raw_results]
            result_details = fetch_article_details(result_ids)
            cat_map = {a['id']: a.get('category', '') for a in result_details}

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
        print(f"    Cluster {ci} ({cluster_labels[ci]}): {len(raw_results)}→{len(per_cluster_results[ci])} candidates")

    merged = round_robin_merge(per_cluster_results, cluster_weights, total=20)
    merged_ids = [m['id'] for m in merged]
    merged_details = fetch_article_details(merged_ids)
    merged_article_map = {a['id']: a for a in merged_details}

    result_b = evaluate_merged_top20(merged, merged_article_map, interests, all_high_score_ids, cluster_labels, "B")

    # ========== APPROACH C: Tag Overlap + Topic Saturation (New) ==========
    print(f"\n  {'='*60}")
    print(f"  APPROACH C: Tag Overlap + Saturation (Instagram-style)")
    print(f"  {'='*60}")

    # Build user interest profile from engagement history tags
    # Need to fetch interest_tags for engaged articles
    eng_ids = [a['id'] for a in all_engagement_articles]
    eng_details = fetch_article_details(eng_ids)
    user_profile = build_user_interest_profile(eng_details)
    top_tags = sorted(user_profile.items(), key=lambda x: -x[1])[:10]
    print(f"  User interest profile (top 10 tags): {dict(top_tags)}")

    # Use same candidates as Approach A (single taste vector retrieval)
    # but re-score with tag overlap + similarity + saturation
    top_articles_c_details = fetch_article_details(top_ids_a[:100])  # wider pool
    art_map_c = {a['id']: a for a in top_articles_c_details}

    scored_c = []
    for r in personal_a[:100]:
        art = art_map_c.get(r['id'])
        if not art:
            continue
        tags = art.get('interest_tags') or []
        if isinstance(tags, str):
            try: tags = json.loads(tags)
            except: tags = []
        tag_overlap = compute_tag_overlap(tags, user_profile)
        hours_old = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
        score = score_personal_v2(r['similarity'], tag_overlap, art.get('ai_final_score', 0) or 0, hours_old, art.get('category', ''))
        scored_c.append({
            **art,
            '_score': score,
            '_similarity': r['similarity'],
            '_tag_overlap': tag_overlap,
            '_tags': [t.lower() for t in tags],
        })

    scored_c.sort(key=lambda x: x['_score'], reverse=True)
    scored_c = apply_topic_saturation(scored_c)

    result_c = evaluate_scored_top20(scored_c[:20], interests, all_high_score_ids, "C")

    # ========== COMPARISON ==========
    single_prec = result_a['precision']
    multi_prec = result_b['precision']
    tag_prec = result_c['precision']

    iran_count_a = result_a.get('iran_count', 0)
    iran_count_b = result_b.get('iran_count', 0)
    iran_count_c = result_c.get('iran_count', 0)

    print(f"\n  {'='*60}")
    print(f"  COMPARISON: A vs B vs C")
    print(f"  {'='*60}")
    print(f"  A (single vector):          {single_prec:5.1f}%  iran={iran_count_a}/20")
    print(f"  B (k-means+RR):             {multi_prec:5.1f}%  iran={iran_count_b}/20")
    print(f"  C (tag overlap+saturation): {tag_prec:5.1f}%  iran={iran_count_c}/20")

    for interest_name in interests:
        a_h = result_a['interest_hits'].get(interest_name, 0)
        b_h = result_b['interest_hits'].get(interest_name, 0)
        c_h = result_c['interest_hits'].get(interest_name, 0)
        print(f"    {interest_name:25s}: A={a_h:2d}  B={b_h:2d}  C={c_h:2d}")

    print(f"    {'IRRELEVANT':25s}: A={result_a['irrelevant']:2d}  B={result_b['irrelevant']:2d}  C={result_c['irrelevant']:2d}")

    return {
        'user': profile['name'],
        'num_interests': len(interests),
        'engagements': total_engagements,
        'sim_floor': sim_floor,
        'k_clusters': k,
        'a_precision': single_prec,
        'a_interest_hits': dict(result_a['interest_hits']),
        'a_irrelevant': result_a['irrelevant'],
        'a_leaks': result_a['leaks'],
        'a_sim_mean': result_a['sim_mean'],
        'a_sim_std': result_a['sim_std'],
        'a_iran': iran_count_a,
        'b_precision': multi_prec,
        'b_interest_hits': dict(result_b['interest_hits']),
        'b_irrelevant': result_b['irrelevant'],
        'b_leaks': result_b['leaks'],
        'b_sim_mean': result_b['sim_mean'],
        'b_sim_std': result_b['sim_std'],
        'b_iran': iran_count_b,
        'c_precision': tag_prec,
        'c_interest_hits': dict(result_c['interest_hits']),
        'c_irrelevant': result_c['irrelevant'],
        'c_iran': iran_count_c,
        'improvement_ab': multi_prec - single_prec,
        'improvement_ac': tag_prec - single_prec,
    }


def is_iran_war_article(article):
    """Check if article is about the Iran war (the dominant flooding topic)."""
    title = (article.get('title_news') or '').lower()
    tags = article.get('interest_tags') or []
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except:
            tags = []

    iran_kws = ['iran', 'tehran', 'iranian', 'khamenei', 'persian gulf', 'hormuz']
    war_kws = ['strike', 'missile', 'bomb', 'attack', 'military', 'war', 'troops']

    has_iran = any(kw in title for kw in iran_kws) or 'iran' in [t.lower() for t in tags]
    has_war = any(kw in title for kw in war_kws)

    return has_iran and has_war


def evaluate_scored_top20(top20, interests, high_score_ids, label):
    """Evaluate top 20 from tag-overlap scored approach (C)."""
    interest_hits = defaultdict(int)
    irrelevant = 0
    leaks = 0
    iran_count = 0

    print(f"\n  Top 20 ({label}):")
    for idx, art in enumerate(top20):
        sim = art.get('_similarity', 0)
        tag_ov = art.get('_tag_overlap', 0)
        score_val = art.get('_score', 0)
        penalty = art.get('_penalty', 0)
        classification = classify_article(art, interests)
        title = (art.get('title_news') or '')[:45]
        ai_score = art.get('ai_final_score', 0) or 0

        is_iran = is_iran_war_article(art)
        if is_iran:
            iran_count += 1

        if classification == 'IRRELEVANT':
            irrelevant += 1
            marker = ' !!' if art['id'] in high_score_ids else ('  W' if is_iran else '  X')
            if art['id'] in high_score_ids:
                leaks += 1
        else:
            interest_hits[classification] += 1
            marker = '  *'

        iran_flag = ' [IRAN]' if is_iran else ''
        print(f"    {marker} {idx+1:2d}. tag:{tag_ov:.2f} sim:{sim:.4f} pen:{penalty:.2f} | {classification:20s} | {title}{iran_flag}")

    total_matched = sum(interest_hits.values())
    precision = total_matched / max(len(top20), 1) * 100

    print(f"\n  Coverage ({label}):")
    for interest_name in interests:
        hits = interest_hits.get(interest_name, 0)
        pct = hits / max(len(top20), 1) * 100
        expected = interests[interest_name]['weight'] * 100
        print(f"    {interest_name:25s}: {hits:2d}/20 ({pct:5.1f}%) -- target ~{expected:.0f}%")
    print(f"    {'IRRELEVANT':25s}: {irrelevant:2d}/20 ({irrelevant/max(len(top20),1)*100:5.1f}%)")
    print(f"    {'IRAN/WAR':25s}: {iran_count:2d}/20")
    print(f"    {'PRECISION':25s}: {total_matched:2d}/20 ({precision:5.1f}%)")

    sims = [a.get('_similarity', 0) for a in top20]
    return {
        'precision': precision,
        'interest_hits': dict(interest_hits),
        'irrelevant': irrelevant,
        'leaks': leaks,
        'iran_count': iran_count,
        'sim_mean': float(np.mean(sims)) if sims else 0,
        'sim_std': float(np.std(sims)) if sims else 0,
    }


def evaluate_top20(top20, sim_map, interests, high_score_ids, label):
    interest_hits = defaultdict(int)
    irrelevant = 0
    leaks = 0
    iran_count = 0

    print(f"\n  Top 20 ({label}):")
    for idx, art in enumerate(top20):
        sim = sim_map.get(art['id'], 0)
        classification = classify_article(art, interests)
        title = (art.get('title_news') or '')[:55]
        score = art.get('ai_final_score', 0)

        is_iran = is_iran_war_article(art)
        if is_iran:
            iran_count += 1

        if classification == 'IRRELEVANT':
            irrelevant += 1
            marker = ' !!' if art['id'] in high_score_ids else ('  W' if is_iran else '  X')
            if art['id'] in high_score_ids:
                leaks += 1
        else:
            interest_hits[classification] += 1
            marker = '  *'

        iran_flag = ' [IRAN]' if is_iran else ''
        print(f"    {marker} {idx+1:2d}. sim:{sim:.4f} score:{score:4.0f} | {classification:20s} | {title}{iran_flag}")

    total_matched = sum(interest_hits.values())
    precision = total_matched / max(len(top20), 1) * 100

    print(f"\n  Coverage ({label}):")
    for interest_name in interests:
        hits = interest_hits.get(interest_name, 0)
        pct = hits / max(len(top20), 1) * 100
        expected = interests[interest_name]['weight'] * 100
        print(f"    {interest_name:25s}: {hits:2d}/20 ({pct:5.1f}%) -- target ~{expected:.0f}%")
    print(f"    {'IRRELEVANT':25s}: {irrelevant:2d}/20 ({irrelevant/max(len(top20),1)*100:5.1f}%)")
    print(f"    {'IRAN/WAR':25s}: {iran_count:2d}/20")
    print(f"    {'PRECISION':25s}: {total_matched:2d}/20 ({precision:5.1f}%)")

    sims = [sim_map.get(a['id'], 0) for a in top20]
    return {
        'precision': precision,
        'interest_hits': dict(interest_hits),
        'irrelevant': irrelevant,
        'leaks': leaks,
        'iran_count': iran_count,
        'sim_mean': float(np.mean(sims)) if sims else 0,
        'sim_std': float(np.std(sims)) if sims else 0,
    }


def evaluate_merged_top20(merged, article_map, interests, high_score_ids, cluster_labels, label):
    interest_hits = defaultdict(int)
    irrelevant = 0
    leaks = 0
    iran_count = 0

    print(f"\n  Top 20 ({label}):")
    for idx, m in enumerate(merged[:20]):
        art = article_map.get(m['id'], {})
        sim = m.get('similarity', 0)
        ci = m.get('_cluster', '?')
        cl = cluster_labels.get(ci, '?')
        classification = classify_article(art, interests)
        title = (art.get('title_news') or '')[:50]
        score = art.get('ai_final_score', 0)

        is_iran = is_iran_war_article(art)
        if is_iran:
            iran_count += 1

        if classification == 'IRRELEVANT':
            irrelevant += 1
            marker = ' !!' if m['id'] in high_score_ids else ('  W' if is_iran else '  X')
            if m['id'] in high_score_ids:
                leaks += 1
        else:
            interest_hits[classification] += 1
            marker = '  *'

        iran_flag = ' [IRAN]' if is_iran else ''
        print(f"    {marker} {idx+1:2d}. sim:{sim:.4f} score:{score:4.0f} | c:{cl:15s} -> {classification:20s} | {title}{iran_flag}")

    total_matched = sum(interest_hits.values())
    precision = total_matched / max(len(merged[:20]), 1) * 100

    print(f"\n  Coverage ({label}):")
    for interest_name in interests:
        hits = interest_hits.get(interest_name, 0)
        pct = hits / max(len(merged[:20]), 1) * 100
        expected = interests[interest_name]['weight'] * 100
        print(f"    {interest_name:25s}: {hits:2d}/20 ({pct:5.1f}%) -- target ~{expected:.0f}%")
    print(f"    {'IRRELEVANT':25s}: {irrelevant:2d}/20 ({irrelevant/max(len(merged[:20]),1)*100:5.1f}%)")
    print(f"    {'IRAN/WAR':25s}: {iran_count:2d}/20")
    print(f"    {'PRECISION':25s}: {total_matched:2d}/20 ({precision:5.1f}%)")

    sims = [m.get('similarity', 0) for m in merged[:20]]
    return {
        'precision': precision,
        'interest_hits': dict(interest_hits),
        'irrelevant': irrelevant,
        'leaks': leaks,
        'iran_count': iran_count,
        'sim_mean': float(np.mean(sims)) if sims else 0,
        'sim_std': float(np.std(sims)) if sims else 0,
    }


# ==========================================
# MAIN
# ==========================================

def main():
    print("=" * 110)
    print("  PERSONALIZED FEED v2: 6-USER STUDY (Post 0.91->0.90 Threshold Change)")
    print("=" * 110)
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

    # Show top high-score articles
    print(f"\n  Top 10 high-score articles:")
    for a in (high_score_result.data or [])[:10]:
        print(f"    [{a['ai_final_score']}] {a['category']} | {(a['title_news'] or '')[:70]}")

    # Run analysis
    all_results = []
    for profile in TEST_USERS:
        result = analyze_user(profile, all_high_score_ids)
        if result:
            all_results.append(result)

    # ==========================================
    # FINAL SUMMARY
    # ==========================================

    print(f"\n\n{'='*140}")
    print("  FINAL COMPARISON TABLE: A (embedding) vs B (k-means) vs C (tag overlap + saturation)")
    print(f"{'='*140}")

    header = (f"{'User':<45s} | {'Eng':>3s} | "
              f"{'A Prec':>7s} | {'B Prec':>7s} | {'C Prec':>7s} | "
              f"{'A Iran':>6s} | {'B Iran':>6s} | {'C Iran':>6s} | "
              f"{'A Irrel':>7s} | {'C Irrel':>7s}")
    print(header)
    print("-" * 140)

    for r in all_results:
        print(f"{r['user']:<45s} | {r['engagements']:>3d} | "
              f"{r['a_precision']:>6.1f}% | {r['b_precision']:>6.1f}% | {r['c_precision']:>6.1f}% | "
              f"{r['a_iran']:>4d}/20 | {r['b_iran']:>4d}/20 | {r['c_iran']:>4d}/20 | "
              f"{r['a_irrelevant']:>5d}/20 | {r['c_irrelevant']:>5d}/20")

    # Per-user interest breakdown
    print(f"\n\n{'='*140}")
    print("  PER-USER INTEREST BREAKDOWN: A vs B vs C")
    print(f"{'='*140}")

    for r in all_results:
        print(f"\n  {r['user']}:")
        print(f"    {'Interest':<25s} | {'A (emb)':>8s} | {'B (kmeans)':>10s} | {'C (tags)':>10s} | {'Target':>6s}")
        print(f"    {'-'*75}")

        for profile in TEST_USERS:
            if profile['name'] == r['user']:
                for interest_name, config in profile['interests'].items():
                    a = r['a_interest_hits'].get(interest_name, 0)
                    b = r['b_interest_hits'].get(interest_name, 0)
                    c = r['c_interest_hits'].get(interest_name, 0)
                    target = config['weight'] * 20
                    print(f"    {interest_name:<25s} | {a:>6d}/20 | {b:>8d}/20 | {c:>8d}/20 | ~{target:.0f}/20")
                break
        print(f"    {'IRRELEVANT':<25s} | {r['a_irrelevant']:>6d}/20 | {r['b_irrelevant']:>8d}/20 | {r['c_irrelevant']:>8d}/20 |")
        print(f"    {'IRAN/WAR':<25s} | {r['a_iran']:>6d}/20 | {r['b_iran']:>8d}/20 | {r['c_iran']:>8d}/20 |")

    # Aggregate stats
    print(f"\n\n{'='*140}")
    print("  AGGREGATE STATISTICS")
    print(f"{'='*140}")

    multi_results = [r for r in all_results if r['num_interests'] > 1]
    control_results = [r for r in all_results if r['num_interests'] == 1]

    if multi_results:
        avg_a = np.mean([r['a_precision'] for r in multi_results])
        avg_b = np.mean([r['b_precision'] for r in multi_results])
        avg_c = np.mean([r['c_precision'] for r in multi_results])
        avg_iran_a = np.mean([r['a_iran'] for r in multi_results])
        avg_iran_b = np.mean([r['b_iran'] for r in multi_results])
        avg_iran_c = np.mean([r['c_iran'] for r in multi_results])
        avg_irr_a = np.mean([r['a_irrelevant'] for r in multi_results])
        avg_irr_c = np.mean([r['c_irrelevant'] for r in multi_results])

        print(f"\n  Multi-interest users ({len(multi_results)}):")
        print(f"    {'Metric':<30s} | {'A (embedding)':>13s} | {'B (k-means)':>13s} | {'C (tags)':>13s}")
        print(f"    {'-'*75}")
        print(f"    {'Avg precision':<30s} | {avg_a:>12.1f}% | {avg_b:>12.1f}% | {avg_c:>12.1f}%")
        print(f"    {'Avg irrelevant':<30s} | {avg_irr_a:>11.1f}/20 | {'':>13s} | {avg_irr_c:>11.1f}/20")
        print(f"    {'Avg Iran/war':<30s} | {avg_iran_a:>11.1f}/20 | {avg_iran_b:>11.1f}/20 | {avg_iran_c:>11.1f}/20")

        avg_div_a = np.mean([len([v for v in r['a_interest_hits'].values() if v > 0]) for r in multi_results])
        avg_div_b = np.mean([len([v for v in r['b_interest_hits'].values() if v > 0]) for r in multi_results])
        avg_div_c = np.mean([len([v for v in r['c_interest_hits'].values() if v > 0]) for r in multi_results])
        avg_ni = np.mean([r['num_interests'] for r in multi_results])
        print(f"    {'Interests represented':<30s} | {avg_div_a:>10.1f}/{avg_ni:.0f}  | {avg_div_b:>10.1f}/{avg_ni:.0f}  | {avg_div_c:>10.1f}/{avg_ni:.0f} ")

    if control_results:
        r = control_results[0]
        print(f"\n  Control user ({r['user']}):")
        print(f"    A: {r['a_precision']:.1f}% precision, {r['a_iran']}/20 iran")
        print(f"    B: {r['b_precision']:.1f}% precision, {r['b_iran']}/20 iran")
        print(f"    C: {r['c_precision']:.1f}% precision, {r['c_iran']}/20 iran")

    # VERDICT
    print(f"\n\n{'='*140}")
    print("  VERDICT")
    print(f"{'='*140}")

    if multi_results:
        avg_ac = np.mean([r['improvement_ac'] for r in multi_results])
        avg_ab = np.mean([r['improvement_ab'] for r in multi_results])
        avg_iran_drop = np.mean([r['a_iran'] - r['c_iran'] for r in multi_results])

        print(f"\n  A -> B (k-means+RR):              {avg_ab:+.1f}% precision")
        print(f"  A -> C (tag overlap+saturation):   {avg_ac:+.1f}% precision")
        print(f"  Iran/war reduction (A->C):         {avg_iran_drop:+.1f} articles/20")

        if avg_ac > 25:
            verdict = "STRONG: Tag-based scoring dramatically improves feed quality"
        elif avg_ac > 10:
            verdict = "GOOD: Tag-based scoring provides clear improvement"
        elif avg_ac > 0:
            verdict = "MODERATE: Some improvement from tag scoring"
        else:
            verdict = "MINIMAL: Tag scoring doesn't help much"
        print(f"  Assessment: {verdict}")

    print(f"\n{'='*120}")
    print(f"  Analysis complete: {now_utc().isoformat()}")
    print(f"{'='*120}")


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Feed Adaptation Deep Analysis
==============================
Simulates 5 users with distinct niche interests scrolling through 200+ articles.
Tracks how the feed adapts over time by measuring:
  - Interest match rate at every 20-article checkpoint
  - Taste vector drift (cosine similarity to "ideal" vector)
  - Category concentration (are we converging on user interests?)
  - Bucket distribution (personal vs trending vs discovery)
  - Tag overlap scores over time
  - Session re-ranking impact (client-side dwell-time signals)

Usage:
    python3 test_feed_adaptation.py
"""

import os
import sys
import json
import math
import random
import uuid
import numpy as np
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from dotenv import load_dotenv
from supabase import create_client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Try multiple possible .env.local locations
_candidates = [
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env.local'),
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env.local'),
    os.path.join(os.path.dirname(__file__), '..', '.env.local'),
    os.path.expanduser('~/Ten News Website/.env.local'),
]
_loaded = False
for _p in _candidates:
    if os.path.exists(_p):
        load_dotenv(_p)
        _loaded = True
        break
if not _loaded:
    load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# How many articles each user scrolls through
TARGET_ARTICLES = 200
# Batch size per feed request (matches client)
BATCH_SIZE = 10
# Checkpoint interval for metrics
CHECKPOINT_EVERY = 20

# ---------------------------------------------------------------------------
# 5 Users — niche, diverse interests (4-6 topics each)
# ---------------------------------------------------------------------------

TEST_USERS = [
    {
        "name": "Football & Cooking Nerd",
        "email": "test_adapt_football_cook@tennews.test",
        "home_country": "usa",
        "interests": ["Football", "Soccer", "Premier League", "Cooking", "Recipes", "Food"],
        "search_terms": [
            "football", "soccer", "premier league", "champions league", "goal",
            "FIFA", "world cup", "transfer", "manager", "stadium",
            "cooking", "recipe", "chef", "restaurant", "food", "cuisine",
            "michelin", "baking",
        ],
        "engage_terms": [  # terms that trigger "engaged" behavior (>=5s dwell)
            "football", "soccer", "premier league", "champions league", "goal",
            "cooking", "recipe", "chef", "food",
        ],
    },
    {
        "name": "Quantum Physics & Crypto Enthusiast",
        "email": "test_adapt_quantum_crypto@tennews.test",
        "home_country": "usa",
        "interests": ["Quantum Physics", "Cryptocurrency", "Bitcoin", "Quantum Computing", "Blockchain"],
        "search_terms": [
            "quantum", "physics", "particle", "CERN", "qubit", "entanglement",
            "crypto", "bitcoin", "ethereum", "blockchain", "defi", "token",
            "web3", "mining", "halving", "altcoin", "nft",
        ],
        "engage_terms": [
            "quantum", "physics", "qubit", "crypto", "bitcoin", "ethereum",
            "blockchain",
        ],
    },
    {
        "name": "K-Drama & Travel Lover",
        "email": "test_adapt_kdrama_travel@tennews.test",
        "home_country": "usa",
        "interests": ["K-Drama", "Korean Entertainment", "Travel", "Tourism", "Aviation"],
        "search_terms": [
            "kdrama", "k-drama", "korean", "drama", "netflix", "series",
            "BTS", "k-pop", "idol", "album",
            "travel", "tourism", "airline", "flight", "hotel", "destination",
            "airport", "vacation", "resort",
        ],
        "engage_terms": [
            "kdrama", "k-drama", "korean", "drama", "netflix",
            "travel", "tourism", "airline", "flight", "hotel",
        ],
    },
    {
        "name": "Climate & Space Explorer",
        "email": "test_adapt_climate_space@tennews.test",
        "home_country": "usa",
        "interests": ["Climate Change", "Environment", "Space", "NASA", "SpaceX", "Renewable Energy"],
        "search_terms": [
            "climate", "environment", "carbon", "emissions", "renewable",
            "solar", "wind energy", "green", "sustainability", "pollution",
            "NASA", "SpaceX", "Mars", "rocket", "satellite", "astronaut",
            "space", "orbit", "telescope", "moon",
        ],
        "engage_terms": [
            "climate", "environment", "carbon", "renewable", "solar",
            "NASA", "SpaceX", "Mars", "rocket", "space",
        ],
    },
    {
        "name": "MMA & Gaming Fan",
        "email": "test_adapt_mma_gaming@tennews.test",
        "home_country": "usa",
        "interests": ["UFC", "MMA", "Boxing", "Gaming", "Esports", "PlayStation"],
        "search_terms": [
            "UFC", "MMA", "boxing", "fight", "knockout", "championship",
            "wrestling", "martial", "cage", "belt", "submission",
            "gaming", "esports", "playstation", "xbox", "nintendo",
            "steam", "game", "console", "twitch",
        ],
        "engage_terms": [
            "UFC", "MMA", "boxing", "fight", "knockout",
            "gaming", "esports", "playstation", "game",
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def cosine_similarity(a, b):
    """Cosine similarity between two vectors."""
    a, b = np.array(a, dtype=np.float64), np.array(b, dtype=np.float64)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(np.dot(a, b) / norm)


def title_matches_interests(title, category, terms):
    """Check if article title/category matches any of the user interest terms."""
    text = (title or '').lower() + ' ' + (category or '').lower()
    return any(t.lower() in text for t in terms)


def tags_match_interests(interest_tags, terms):
    """Check if article interest_tags overlap with user interest terms."""
    if not interest_tags:
        return False
    tag_text = ' '.join(t.lower() for t in interest_tags)
    return any(t.lower() in tag_text for t in terms)


def simulate_dwell(article, engage_terms):
    """
    Simulate realistic dwell time based on whether article matches interests.
    Returns dwell in seconds.
    """
    title = (article.get('title_news') or article.get('title') or '').lower()
    tags = article.get('interest_tags') or []
    category = (article.get('category') or '').lower()
    text = title + ' ' + category + ' ' + ' '.join(t.lower() for t in tags)

    matches = sum(1 for t in engage_terms if t.lower() in text)

    if matches >= 2:
        # Very interested — long dwell (8-30s)
        return random.uniform(8.0, 30.0)
    elif matches == 1:
        # Somewhat interested (5-12s)
        return random.uniform(5.0, 12.0)
    else:
        # Not interested — fast skip (0.5-2.5s)
        return random.uniform(0.5, 2.5)


def get_event_type_for_dwell(dwell_seconds):
    """Map dwell time to event type — matches the new Swift/server logic.
    <3s = article_skipped (reverse EMA, pushes vector away)
    3-5s = article_view (neutral, no taste vector update)
    >=5s = article_engaged (positive EMA, pulls vector toward)
    """
    if dwell_seconds >= 15:
        return 'article_saved'      # alpha=0.15
    elif dwell_seconds >= 8:
        return 'article_engaged'    # alpha=0.10
    elif dwell_seconds >= 5:
        return 'article_engaged'    # alpha=0.10
    elif dwell_seconds >= 3:
        return 'article_view'       # neutral — no taste vector update
    else:
        return 'article_skipped'    # alpha=0.03, reverse EMA


# ---------------------------------------------------------------------------
# Database Operations
# ---------------------------------------------------------------------------

def ensure_test_profile(profile):
    """Create or reset a test profile in the profiles table."""
    # Use the legacy users table (profiles requires auth.users FK)
    result = supabase.table('users').select('id').eq('email', profile['email']).execute()
    if result.data:
        user_id = result.data[0]['id']
        # Reset for fresh test
        supabase.table('users').update({
            'taste_vector': None,
            'taste_vector_minilm': None,
            'skip_profile': None,
            'home_country': profile.get('home_country', 'usa'),
            'followed_countries': profile['interests'][:3],
            'followed_topics': profile['interests'][:3],
        }).eq('id', user_id).execute()
    else:
        user_id = str(uuid.uuid4())
        supabase.table('users').insert({
            'id': user_id,
            'email': profile['email'],
            'home_country': profile.get('home_country', 'usa'),
            'followed_countries': profile['interests'][:3],
            'followed_topics': profile['interests'][:3],
            'taste_vector': None,
            'taste_vector_minilm': None,
            'skip_profile': None,
        }).execute()

    # Clear old events and clusters
    try:
        supabase.table('user_article_events').delete().eq('user_id', user_id).execute()
    except:
        pass
    try:
        supabase.table('user_interest_clusters').delete().eq('user_id', user_id).execute()
    except:
        pass
    try:
        supabase.table('user_feed_impressions').delete().eq('user_id', user_id).execute()
    except:
        pass

    return user_id


def find_candidate_articles(limit=500):
    """
    Fetch a large pool of recent articles with embeddings.
    We need a big pool so we can simulate scrolling through diverse content.
    """
    cutoff = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    articles = []
    seen_ids = set()

    # Fetch in batches sorted by score (best first)
    for offset in range(0, limit, 100):
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, interest_tags, embedding, embedding_minilm, created_at') \
            .gte('created_at', cutoff) \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .range(offset, offset + 99) \
            .execute()

        for a in (result.data or []):
            if a['id'] not in seen_ids:
                seen_ids.add(a['id'])
                articles.append(a)

        if not result.data or len(result.data) < 100:
            break

    return articles


def update_taste_vector_ema(user_id, article, event_type):
    """
    Update taste vector via EMA in Python (mirrors the DB function).
    - article_skipped: reverse EMA (pushes vector AWAY), alpha=0.03
    - article_view: NO update (neutral, 3-5s dwell)
    - article_engaged: normal EMA (pulls toward), alpha=0.10
    - article_saved: normal EMA, alpha=0.15
    """
    # article_view = neutral, no taste vector update
    if event_type == 'article_view':
        return None, None

    alpha_map = {
        'article_saved': 0.15,
        'article_engaged': 0.10,
        'article_detail_view': 0.05,
        'article_skipped': 0.03,
    }
    alpha = alpha_map.get(event_type, 0.02)
    is_skip = (event_type == 'article_skipped')

    # Get current taste vectors
    result = supabase.table('users').select('taste_vector, taste_vector_minilm').eq('id', user_id).execute()

    current = result.data[0] if result.data else {}
    current_taste = current.get('taste_vector')
    current_minilm = current.get('taste_vector_minilm')

    updates = {}

    # Gemini embedding
    article_emb = article.get('embedding')
    if article_emb and isinstance(article_emb, list) and len(article_emb) > 0:
        emb = np.array(article_emb, dtype=np.float64)
        if current_taste and isinstance(current_taste, list) and len(current_taste) > 0:
            tv = np.array(current_taste, dtype=np.float64)
            if is_skip:
                # Reverse EMA: push AWAY from skipped content
                new_tv = (1 + alpha) * tv - alpha * emb
            else:
                new_tv = (1 - alpha) * tv + alpha * emb
            updates['taste_vector'] = new_tv.tolist()
        elif not is_skip:
            # Only initialize from positive signals, never from skips
            updates['taste_vector'] = article_emb

    # MiniLM embedding
    article_minilm = article.get('embedding_minilm')
    if article_minilm and isinstance(article_minilm, list) and len(article_minilm) > 0:
        emb_m = np.array(article_minilm, dtype=np.float64)
        if current_minilm and isinstance(current_minilm, list) and len(current_minilm) > 0:
            tv_m = np.array(current_minilm, dtype=np.float64)
            if is_skip:
                new_tv_m = (1 + alpha) * tv_m - alpha * emb_m
            else:
                new_tv_m = (1 - alpha) * tv_m + alpha * emb_m
            updates['taste_vector_minilm'] = new_tv_m.tolist()
        elif not is_skip:
            updates['taste_vector_minilm'] = article_minilm

    if updates:
        supabase.table('users').update(updates).eq('id', user_id).execute()

    return updates.get('taste_vector'), updates.get('taste_vector_minilm')


def record_event(user_id, article, event_type):
    """Insert user_article_events record."""
    try:
        supabase.table('user_article_events').insert({
            'user_id': user_id,
            'event_type': event_type,
            'article_id': article['id'],
            'category': article.get('category'),
            'metadata': json.dumps({'test': True}),
        }).execute()
    except:
        pass


def query_personalized_feed(user_id, seen_ids, engaged_ids, skipped_ids, limit=10):
    """
    Query the feed exactly like the real API does — pgvector search using taste vector.
    Returns articles with similarity scores and buckets.
    """
    # Load user data
    result = supabase.table('users') \
        .select('taste_vector, taste_vector_minilm, skip_profile') \
        .eq('id', user_id).execute()

    if not result.data:
        return None

    user = result.data[0]
    taste_vector = user.get('taste_vector')
    taste_minilm = user.get('taste_vector_minilm')

    if not taste_vector and not taste_minilm:
        return None

    # Check for interest clusters
    clusters_result = supabase.table('user_interest_clusters') \
        .select('id, cluster_index, label, article_count') \
        .eq('user_id', user_id).execute()
    has_clusters = bool(clusters_result.data)

    # Exclude seen articles
    exclude = list(set(seen_ids)) if seen_ids else None

    # pgvector similarity search
    min_sim = user.get('skip_profile', {}).get('similarity_floor', 0) if isinstance(user.get('skip_profile'), dict) else 0
    try:
        if has_clusters and taste_minilm:
            personal_result = supabase.rpc('match_articles_multi_cluster_minilm', {
                'p_user_id': user_id,
                'match_per_cluster': 50,
                'hours_window': 48,
                'exclude_ids': exclude,
                'min_similarity': min_sim,
            }).execute()
        elif taste_minilm:
            personal_result = supabase.rpc('match_articles_personal_minilm', {
                'query_embedding': taste_minilm,
                'match_count': 150,
                'hours_window': 48,
                'exclude_ids': exclude,
                'min_similarity': min_sim,
            }).execute()
        elif taste_vector:
            personal_result = supabase.rpc('match_articles_personal', {
                'query_embedding': taste_vector,
                'match_count': 150,
                'hours_window': 48,
                'exclude_ids': exclude,
                'min_similarity': min_sim,
            }).execute()
        else:
            return None
    except Exception as e:
        print(f"   pgvector search failed: {e}")
        return None

    personal_data = personal_result.data or []
    personal_sims = {r['id']: r['similarity'] for r in personal_data}
    personal_ids = [r['id'] for r in sorted(personal_data, key=lambda x: x['similarity'], reverse=True)]

    if not personal_ids:
        return None

    # Fetch full articles
    fetch_ids = personal_ids[:limit * 3]  # fetch extra for filtering
    articles_result = supabase.table('published_articles') \
        .select('id, title_news, category, ai_final_score, interest_tags, created_at') \
        .in_('id', fetch_ids) \
        .execute()

    articles = articles_result.data or []
    # Sort by similarity
    articles.sort(key=lambda a: personal_sims.get(a['id'], 0), reverse=True)

    # Attach similarity and parse interest_tags
    for a in articles:
        a['similarity'] = personal_sims.get(a['id'], 0)
        tags = a.get('interest_tags')
        if isinstance(tags, str):
            try:
                a['interest_tags'] = json.loads(tags)
            except:
                a['interest_tags'] = []
        elif not isinstance(tags, list):
            a['interest_tags'] = []

    return {
        'articles': articles[:limit],
        'total_personal': len(personal_ids),
        'has_clusters': has_clusters,
        'clusters': clusters_result.data if has_clusters else [],
        'avg_similarity': np.mean([r['similarity'] for r in personal_data[:20]]) if personal_data else 0,
    }


# ---------------------------------------------------------------------------
# Session Re-Ranker (mirrors Swift SessionReRanker)
# ---------------------------------------------------------------------------

class SessionReRanker:
    """Python port of the client-side SessionReRanker.swift"""

    def __init__(self):
        self.engaged_ids = set()
        self.skipped_ids = set()
        self.interest_profile = defaultdict(float)
        self.skip_profile = defaultdict(float)

    def record_signal(self, article, dwell_seconds):
        tags = [t.lower() for t in (article.get('interest_tags') or [])]
        cat = (article.get('category') or '').lower()
        aid = str(article['id'])

        if dwell_seconds < 3.0:
            self.skipped_ids.add(aid)
            for tag in tags:
                self.skip_profile[tag] += 1.0
            if cat:
                self.skip_profile[cat] += 0.5
        elif dwell_seconds >= 5.0:
            self.engaged_ids.add(aid)
            for tag in tags:
                self.interest_profile[tag] += 1.0
            if cat:
                self.interest_profile[cat] += 0.5

    def rerank(self, articles, current_index):
        """Re-rank unseen articles based on session signals (60% server / 40% session)."""
        if not self.interest_profile and not self.skip_profile:
            return articles
        split_at = min(current_index + 1, len(articles))
        if split_at >= len(articles):
            return articles

        seen = articles[:split_at]
        unseen = articles[split_at:]

        total_unseen = float(len(unseen))
        scores = {}

        for i, article in enumerate(unseen):
            tags = [t.lower() for t in (article.get('interest_tags') or [])]
            cat = (article.get('category') or '').lower()

            boost = sum(self.interest_profile.get(t, 0) for t in tags)
            if cat:
                boost += self.interest_profile.get(cat, 0) * 0.5

            penalty = sum(self.skip_profile.get(t, 0) for t in tags)
            if cat:
                penalty += self.skip_profile.get(cat, 0) * 0.5

            tag_count = max(len(tags), 1)
            session_score = (boost - penalty) / tag_count
            server_rank = i / max(total_unseen - 1, 1)
            clamped = max(-2.0, min(2.0, session_score))
            scores[str(article['id'])] = (1.0 - server_rank) * 0.6 + clamped * 0.4

        reranked = sorted(unseen, key=lambda a: scores.get(str(a['id']), 0), reverse=True)
        return seen + reranked

    @property
    def signals(self):
        return list(self.engaged_ids)[:20], list(self.skipped_ids)[:20]


# ---------------------------------------------------------------------------
# Main Simulation
# ---------------------------------------------------------------------------

def simulate_user(profile, all_articles, user_idx):
    """
    Simulate one user scrolling through 200+ articles.
    Returns detailed metrics at every checkpoint.
    """
    print(f"\n{'#' * 80}")
    print(f"USER {user_idx + 1}/5: {profile['name']}")
    print(f"{'#' * 80}")
    print(f"Interests: {', '.join(profile['interests'])}")

    # 1. Setup user
    user_id = ensure_test_profile(profile)
    print(f"User ID: {user_id}")

    # 2. Build article pool — simulate the new exploration feed (round-robin by category)
    matching = [a for a in all_articles if title_matches_interests(
        a.get('title_news'), a.get('category'), profile['search_terms']
    ) or tags_match_interests(a.get('interest_tags'), profile['search_terms'])]

    non_matching = [a for a in all_articles if a not in matching]

    print(f"Article pool: {len(matching)} matching, {len(non_matching)} non-matching")

    # Build exploration-style pool: round-robin across categories (matches new fallback feed)
    by_cat = {}
    for a in all_articles:
        cat = a.get('category', 'Other')
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(a)
    # Sort each category by score
    for cat in by_cat:
        by_cat[cat].sort(key=lambda x: x.get('ai_final_score', 0), reverse=True)
    cat_order = sorted(by_cat.keys(), key=lambda c: len(by_cat[c]), reverse=True)

    # Round-robin interleave (exploration feed style)
    article_pool = []
    ptrs = {cat: 0 for cat in cat_order}
    for rnd in range(100):
        if len(article_pool) >= 500:
            break
        for cat in cat_order:
            if ptrs[cat] < len(by_cat[cat]):
                article_pool.append(by_cat[cat][ptrs[cat]])
                ptrs[cat] += 1
    print(f"Exploration pool: {len(article_pool)} articles, {len(cat_order)} categories")
    cats_in_pool = Counter(a.get('category', '?') for a in article_pool[:20])
    print(f"First 20 articles categories: {dict(cats_in_pool.most_common(10))}")

    # 3. Simulate progressive scrolling
    reranker = SessionReRanker()
    seen_ids = []
    checkpoints = []
    total_scrolled = 0
    total_engaged = 0
    total_skipped = 0
    total_neutral = 0

    # Metrics trackers
    interest_matches_running = []
    similarity_scores_running = []
    dwell_times_running = []
    category_history = []
    tag_history = []

    print(f"\nSimulating scroll through {TARGET_ARTICLES} articles...")
    print(f"{'─' * 70}")

    batch_num = 0
    articles_consumed = 0

    while articles_consumed < TARGET_ARTICLES:
        batch_num += 1

        # Determine which articles to show in this batch
        # First few batches: use pool directly (cold start)
        # After taste vector builds: query pgvector for personalized results
        batch_articles = []

        if articles_consumed >= 40 and articles_consumed % 20 == 0:
            # Every 20 articles after warm-up: query real pgvector feed
            engaged_list, skipped_list = reranker.signals
            feed_result = query_personalized_feed(
                user_id, seen_ids, engaged_list, skipped_list, limit=BATCH_SIZE
            )
            if feed_result and feed_result['articles']:
                batch_articles = feed_result['articles']
                similarity_scores_running.extend([
                    a.get('similarity', 0) for a in batch_articles
                ])

        # Fall back to pool if pgvector didn't return enough
        if len(batch_articles) < BATCH_SIZE:
            remaining_pool = [a for a in article_pool if a['id'] not in set(seen_ids)]
            needed = BATCH_SIZE - len(batch_articles)
            batch_articles.extend(remaining_pool[:needed])

        if not batch_articles:
            print(f"   Ran out of articles at {articles_consumed}")
            break

        # Apply client-side re-ranking
        if articles_consumed > 0:
            batch_articles = reranker.rerank(batch_articles, 0)

        # Process each article in the batch
        for article in batch_articles[:BATCH_SIZE]:
            if article['id'] in set(seen_ids):
                continue

            # Simulate dwell time
            dwell = simulate_dwell(article, profile['engage_terms'])
            dwell_times_running.append(dwell)

            # Determine engagement level
            event_type = get_event_type_for_dwell(dwell)

            # Track signals
            is_match = title_matches_interests(
                article.get('title_news'), article.get('category'), profile['search_terms']
            ) or tags_match_interests(article.get('interest_tags'), profile['search_terms'])
            interest_matches_running.append(1 if is_match else 0)

            category_history.append(article.get('category', 'Unknown'))
            tags = article.get('interest_tags') or []
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except:
                    tags = []
            for t in tags:
                tag_history.append(t.lower())

            # Record in session re-ranker
            reranker.record_signal(article, dwell)

            if dwell < 2.0:
                total_skipped += 1
            elif dwell >= 5.0:
                total_engaged += 1
            else:
                total_neutral += 1

            # Record event in DB
            record_event(user_id, article, event_type)

            # Update taste vector via EMA
            update_taste_vector_ema(user_id, article, event_type)

            seen_ids.append(article['id'])
            articles_consumed += 1
            total_scrolled += 1

            # Checkpoint
            if articles_consumed % CHECKPOINT_EVERY == 0 and articles_consumed > 0:
                window = interest_matches_running[-CHECKPOINT_EVERY:]
                match_rate = sum(window) / len(window) * 100

                recent_dwells = dwell_times_running[-CHECKPOINT_EVERY:]
                avg_dwell = sum(recent_dwells) / len(recent_dwells)

                recent_cats = category_history[-CHECKPOINT_EVERY:]
                top_cats = Counter(recent_cats).most_common(3)

                # Query pgvector to check current feed quality
                engaged_list, skipped_list = reranker.signals
                feed_check = query_personalized_feed(
                    user_id, seen_ids, engaged_list, skipped_list, limit=20
                )

                feed_match_rate = 0
                avg_sim = 0
                if feed_check and feed_check['articles']:
                    feed_matches = sum(
                        1 for a in feed_check['articles']
                        if title_matches_interests(a.get('title_news'), a.get('category'), profile['search_terms'])
                        or tags_match_interests(a.get('interest_tags'), profile['search_terms'])
                    )
                    feed_match_rate = feed_matches / len(feed_check['articles']) * 100
                    avg_sim = feed_check['avg_similarity']

                checkpoint = {
                    'at': articles_consumed,
                    'consumed_match_rate': match_rate,
                    'feed_match_rate': feed_match_rate,
                    'avg_similarity': avg_sim,
                    'avg_dwell': avg_dwell,
                    'engaged': total_engaged,
                    'skipped': total_skipped,
                    'top_cats': top_cats,
                    'has_clusters': feed_check['has_clusters'] if feed_check else False,
                }
                checkpoints.append(checkpoint)

                # Compact status line
                cats_str = ', '.join(f"{c}:{n}" for c, n in top_cats)
                print(
                    f"  [{articles_consumed:3d}] "
                    f"consumed_match={match_rate:4.0f}%  "
                    f"feed_match={feed_match_rate:4.0f}%  "
                    f"sim={avg_sim:.3f}  "
                    f"dwell={avg_dwell:4.1f}s  "
                    f"eng/skip={total_engaged}/{total_skipped}  "
                    f"cats=[{cats_str}]"
                )

            if articles_consumed >= TARGET_ARTICLES:
                break

    # Final clustering
    print(f"\nBuilding interest clusters...")
    try:
        cluster_result = supabase.rpc('cluster_user_interests', {
            'p_user_id': user_id,
            'p_max_clusters': 5,
            'p_lookback_days': 90,
        }).execute()
        cluster_count = cluster_result.data if cluster_result.data else 0
        print(f"  Created {cluster_count} interest clusters")
    except Exception as e:
        print(f"  Clustering failed: {e}")

    # Final feed quality check (post-clustering)
    final_feed = query_personalized_feed(user_id, [], [], [], limit=30)
    final_match_rate = 0
    final_articles_info = []
    if final_feed and final_feed['articles']:
        for a in final_feed['articles'][:30]:
            is_match = title_matches_interests(
                a.get('title_news'), a.get('category'), profile['search_terms']
            ) or tags_match_interests(a.get('interest_tags'), profile['search_terms'])
            if is_match:
                final_match_rate += 1
            final_articles_info.append({
                'title': (a.get('title_news') or '')[:60],
                'category': a.get('category', '?'),
                'similarity': a.get('similarity', 0),
                'match': is_match,
                'tags': a.get('interest_tags', [])[:4],
            })
        final_match_rate = final_match_rate / len(final_feed['articles']) * 100

    return {
        'name': profile['name'],
        'interests': profile['interests'],
        'user_id': user_id,
        'total_scrolled': total_scrolled,
        'total_engaged': total_engaged,
        'total_skipped': total_skipped,
        'total_neutral': total_neutral,
        'checkpoints': checkpoints,
        'final_match_rate': final_match_rate,
        'final_feed': final_articles_info,
        'final_feed_data': final_feed,
        'category_distribution': Counter(category_history).most_common(10),
        'top_tags': Counter(tag_history).most_common(15),
    }


def print_detailed_report(results):
    """Print comprehensive analysis report."""
    print(f"\n\n{'=' * 90}")
    print(f"{'DEEP ANALYSIS REPORT':^90}")
    print(f"{'=' * 90}")

    for r in results:
        print(f"\n{'━' * 90}")
        print(f"  {r['name']}")
        print(f"  Interests: {', '.join(r['interests'])}")
        print(f"{'━' * 90}")

        # Engagement summary
        total = r['total_scrolled']
        print(f"\n  Engagement Summary ({total} articles):")
        print(f"    Engaged (>=5s):  {r['total_engaged']:3d} ({r['total_engaged']/max(total,1)*100:.0f}%)")
        print(f"    Neutral (2-5s):  {r['total_neutral']:3d} ({r['total_neutral']/max(total,1)*100:.0f}%)")
        print(f"    Skipped (<2s):   {r['total_skipped']:3d} ({r['total_skipped']/max(total,1)*100:.0f}%)")

        # Adaptation curve
        print(f"\n  Feed Adaptation Over Time:")
        print(f"  {'Articles':>10s}  {'Consumed Match':>15s}  {'Feed Match':>11s}  {'Avg Sim':>8s}  {'Avg Dwell':>10s}")
        print(f"  {'─' * 60}")
        for cp in r['checkpoints']:
            print(
                f"  {cp['at']:10d}  "
                f"{cp['consumed_match_rate']:14.0f}%  "
                f"{cp['feed_match_rate']:10.0f}%  "
                f"{cp['avg_similarity']:8.3f}  "
                f"{cp['avg_dwell']:9.1f}s"
            )

        # Check if feed quality improved
        if len(r['checkpoints']) >= 2:
            first = r['checkpoints'][0]
            last = r['checkpoints'][-1]
            feed_delta = last['feed_match_rate'] - first['feed_match_rate']
            sim_delta = last['avg_similarity'] - first['avg_similarity']
            direction = "IMPROVED" if feed_delta > 0 else ("STABLE" if feed_delta == 0 else "DECLINED")
            print(f"\n  Adaptation: {direction}")
            print(f"    Feed match: {first['feed_match_rate']:.0f}% -> {last['feed_match_rate']:.0f}% ({feed_delta:+.0f}%)")
            print(f"    Similarity: {first['avg_similarity']:.3f} -> {last['avg_similarity']:.3f} ({sim_delta:+.3f})")

        # Category distribution
        print(f"\n  Top Categories Consumed:")
        for cat, count in r['category_distribution'][:7]:
            bar = '█' * int(count / max(total, 1) * 40)
            print(f"    {cat:20s} {count:3d} ({count/max(total,1)*100:4.1f}%) {bar}")

        # Top tags
        print(f"\n  Top Interest Tags Seen:")
        if r['top_tags']:
            max_tag_count = r['top_tags'][0][1] if r['top_tags'] else 1
            for tag, count in r['top_tags'][:10]:
                bar = '█' * int(count / max(max_tag_count, 1) * 30)
                print(f"    {tag:25s} {count:3d} {bar}")

        # Final feed preview
        print(f"\n  Final Personalized Feed (top 15):")
        print(f"  {'#':>3s}  {'Match':>5s}  {'Sim':>6s}  {'Category':>15s}  {'Title':<50s}")
        print(f"  {'─' * 85}")
        for i, a in enumerate(r['final_feed'][:15]):
            marker = " YES" if a['match'] else "    "
            print(
                f"  {i+1:3d}  {marker:>5s}  "
                f"{a['similarity']:.3f}  "
                f"{a['category']:>15s}  "
                f"{a['title']:<50s}"
            )

        if r.get('final_feed_data') and r['final_feed_data'].get('clusters'):
            print(f"\n  Interest Clusters:")
            for c in r['final_feed_data']['clusters']:
                print(f"    Cluster {c['cluster_index']}: {c.get('label', '?')} ({c['article_count']} articles)")

    # ==========================================
    # COMPARATIVE SUMMARY
    # ==========================================

    print(f"\n\n{'=' * 90}")
    print(f"{'COMPARATIVE SUMMARY':^90}")
    print(f"{'=' * 90}")

    print(f"\n{'User':<35s} {'Scrolled':>8s} {'Engaged':>8s} {'Skipped':>8s} "
          f"{'Feed Match':>11s} {'First':>6s} {'Last':>6s} {'Delta':>7s}")
    print(f"{'─' * 95}")

    for r in results:
        first_match = r['checkpoints'][0]['feed_match_rate'] if r['checkpoints'] else 0
        last_match = r['checkpoints'][-1]['feed_match_rate'] if r['checkpoints'] else 0
        delta = last_match - first_match

        print(
            f"{r['name']:<35s} "
            f"{r['total_scrolled']:>8d} "
            f"{r['total_engaged']:>8d} "
            f"{r['total_skipped']:>8d} "
            f"{r['final_match_rate']:>10.0f}% "
            f"{first_match:>5.0f}% "
            f"{last_match:>5.0f}% "
            f"{delta:>+6.0f}%"
        )

    # Similarity progression comparison
    print(f"\n{'Similarity Score Progression':^90}")
    print(f"{'User':<35s}", end="")
    if results and results[0]['checkpoints']:
        for cp in results[0]['checkpoints']:
            print(f"  @{cp['at']:>3d}", end="")
    print()
    print(f"{'─' * 90}")

    for r in results:
        print(f"{r['name']:<35s}", end="")
        for cp in r['checkpoints']:
            print(f" {cp['avg_similarity']:>5.3f}", end="")
        print()

    # Final verdict
    print(f"\n{'─' * 90}")
    improved = sum(1 for r in results
                   if len(r['checkpoints']) >= 2
                   and r['checkpoints'][-1]['feed_match_rate'] > r['checkpoints'][0]['feed_match_rate'])
    total_users = len(results)
    avg_final = np.mean([r['final_match_rate'] for r in results]) if results else 0

    print(f"\n  Feed Adaptation Verdict:")
    print(f"    Users where feed improved: {improved}/{total_users}")
    print(f"    Average final feed match rate: {avg_final:.1f}%")
    print(f"    System {'IS' if improved >= 3 else 'NEEDS WORK to be'} adapting to user interests")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    print("=" * 90)
    print(f"{'FEED ADAPTATION DEEP ANALYSIS':^90}")
    print("=" * 90)
    print(f"Time: {datetime.utcnow().isoformat()}")
    print(f"Target: {TARGET_ARTICLES} articles per user, {len(TEST_USERS)} users")
    print(f"Supabase: {SUPABASE_URL}")

    # Check article availability
    cutoff = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    count_result = supabase.table('published_articles') \
        .select('id', count='exact') \
        .gte('created_at', cutoff) \
        .not_.is_('embedding', 'null') \
        .execute()
    total_articles = count_result.count if hasattr(count_result, 'count') and count_result.count else len(count_result.data or [])
    print(f"Available articles with embeddings (48h): {total_articles}")

    if total_articles < 50:
        print("WARNING: Very few articles available. Results may not be meaningful.")

    # Fetch article pool once (shared across users)
    print(f"\nFetching article pool...")
    article_pool = find_candidate_articles(limit=600)
    print(f"Loaded {len(article_pool)} articles")

    # Show category breakdown
    pool_cats = Counter(a.get('category', '?') for a in article_pool)
    print(f"Categories: {dict(pool_cats.most_common(8))}")

    # Run simulation for each user
    all_results = []
    for idx, profile in enumerate(TEST_USERS):
        result = simulate_user(profile, article_pool, idx)
        all_results.append(result)

    # Print comprehensive report
    print_detailed_report(all_results)

    print(f"\nDone at {datetime.utcnow().isoformat()}")


if __name__ == '__main__':
    main()

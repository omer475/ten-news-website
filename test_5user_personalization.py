#!/usr/bin/env python3
"""
5-User Personalization Test
===========================
Creates 5 test users with different interests, simulates 200+ article reads per user,
builds taste vectors via EMA, then queries the personalized feed to verify results.

Usage:
    python3 test_5user_personalization.py
"""

import os
import sys
import json
import time
import uuid
import numpy as np
import requests
from datetime import datetime, timedelta
from collections import Counter
from dotenv import load_dotenv
from supabase import create_client

# Load env from parent project
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.env.local')
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
# TEST USER PROFILES
# ==========================================

TEST_USERS = [
    {
        "name": "F1 Fan",
        "email": "test_f1_fan@tennews.test",
        "home_country": "usa",
        "interests": ["Formula 1", "Motorsport", "F1", "Racing"],
        "categories": ["Sports", "Motorsport", "Auto Racing"],
        "search_terms": ["F1", "Formula", "racing", "Grand Prix", "Hamilton", "Verstappen", "Mercedes", "Red Bull", "Ferrari"],
    },
    {
        "name": "K-pop / Entertainment Fan",
        "email": "test_kpop_fan@tennews.test",
        "home_country": "usa",
        "interests": ["K-pop", "BTS", "BLACKPINK", "Entertainment"],
        "categories": ["Entertainment", "Music", "Culture", "Lifestyle"],
        "search_terms": ["K-pop", "BTS", "BLACKPINK", "Korean", "idol", "album", "concert", "drama", "anime", "Netflix", "movie", "film", "celebrity", "music"],
    },
    {
        "name": "Space / Science Fan",
        "email": "test_space_fan@tennews.test",
        "home_country": "usa",
        "interests": ["NASA", "SpaceX", "Space", "Science"],
        "categories": ["Science", "Technology", "Space"],
        "search_terms": ["NASA", "SpaceX", "space", "Mars", "rocket", "satellite", "asteroid", "telescope", "quantum", "AI", "research", "scientist"],
    },
    {
        "name": "UFC / Combat Sports Fan",
        "email": "test_ufc_fan@tennews.test",
        "home_country": "usa",
        "interests": ["UFC", "MMA", "Boxing", "Combat Sports"],
        "categories": ["Sports", "Combat Sports", "Boxing"],
        "search_terms": ["UFC", "MMA", "boxing", "fight", "knockout", "championship", "belt", "wrestling", "martial", "cage"],
    },
    {
        "name": "Turkey / Politics Fan",
        "email": "test_turkey_fan@tennews.test",
        "home_country": "turkiye",
        "interests": ["Turkey", "Erdogan", "Istanbul", "Turkish Politics"],
        "categories": ["World", "Politics", "Middle East"],
        "search_terms": ["Turkey", "Turkish", "Erdogan", "Istanbul", "Ankara", "Syria", "Iran", "Middle East", "NATO", "election", "parliament", "minister"],
    },
]

# ==========================================
# HELPERS
# ==========================================

def get_or_create_test_user(profile):
    """Get or create a test user in the users table."""
    # Check if user exists
    result = supabase.table('users').select('id, taste_vector').eq('email', profile['email']).execute()
    if result.data:
        user = result.data[0]
        # Clear taste vector for fresh test
        supabase.table('users').update({'taste_vector': None}).eq('id', user['id']).execute()
        return user['id']

    # Create new user (schema: id, email, home_country, followed_countries, followed_topics, etc.)
    user_data = {
        'id': str(uuid.uuid4()),
        'email': profile['email'],
        'followed_topics': profile['interests'][:3],
        'followed_countries': [],
        'home_country': profile.get('home_country', 'usa'),
        'taste_vector': None,
    }
    result = supabase.table('users').insert(user_data).execute()
    if result.data:
        return result.data[0]['id']
    return None


def find_articles_for_interest(profile, limit=250):
    """Find articles matching user's interests from the last 72h."""
    # Strategy: search by category first, then by title keywords
    cutoff = (datetime.utcnow() - timedelta(hours=72)).isoformat()

    matched_articles = []
    seen_ids = set()

    # 1. Search by category
    for cat in profile['categories']:
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding') \
            .gte('created_at', cutoff) \
            .eq('category', cat) \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(100) \
            .execute()
        for a in (result.data or []):
            if a['id'] not in seen_ids:
                seen_ids.add(a['id'])
                matched_articles.append(a)

    # 2. Search by title keywords (ilike)
    for term in profile['search_terms'][:5]:
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
                matched_articles.append(a)

    # If still not enough, broaden: get any articles with embeddings
    if len(matched_articles) < limit:
        # Get more articles, preferring those with matching keywords in title
        remaining = limit - len(matched_articles)
        for term in profile['search_terms'][5:]:
            if len(matched_articles) >= limit:
                break
            result = supabase.table('published_articles') \
                .select('id, title_news, category, ai_final_score, created_at, embedding') \
                .gte('created_at', cutoff) \
                .ilike('title_news', f'%{term}%') \
                .not_.is_('embedding', 'null') \
                .limit(30) \
                .execute()
            for a in (result.data or []):
                if a['id'] not in seen_ids:
                    seen_ids.add(a['id'])
                    matched_articles.append(a)

    return matched_articles[:limit]


def simulate_engagements(user_id, articles, profile_name):
    """Simulate article engagements and build taste vector via EMA in Python."""
    print(f"\n   Simulating {len(articles)} engagements...")

    # Build taste vector locally via EMA (same logic as the DB function)
    taste_vector = None
    events_inserted = 0

    for idx, article in enumerate(articles):
        # Alternate event types for realistic behavior
        if idx % 5 == 0:
            event_type = 'article_saved'
        elif idx % 3 == 0:
            event_type = 'article_engaged'
        else:
            event_type = 'article_detail_view'

        # Insert engagement event
        try:
            supabase.table('user_article_events').insert({
                'user_id': user_id,
                'event_type': event_type,
                'article_id': article['id'],
                'category': article.get('category'),
                'metadata': {'test': True, 'profile': profile_name},
            }).execute()
            events_inserted += 1
        except Exception as e:
            if 'duplicate' not in str(e).lower():
                pass
            continue

        # EMA taste vector update in Python (avoids Supabase RPC array issue)
        article_emb = article.get('embedding')
        if article_emb and isinstance(article_emb, list) and len(article_emb) > 0:
            emb_np = np.array(article_emb, dtype=np.float64)
            alpha = {'article_saved': 0.15, 'article_engaged': 0.10}.get(event_type, 0.05)

            if taste_vector is None:
                taste_vector = emb_np.copy()
            else:
                taste_vector = (1 - alpha) * taste_vector + alpha * emb_np

        if (idx + 1) % 50 == 0:
            print(f"      {idx + 1}/{len(articles)} engagements processed...")

    # Save taste vector to DB
    if taste_vector is not None:
        try:
            supabase.table('users').update({
                'taste_vector': taste_vector.tolist()
            }).eq('id', user_id).execute()
            print(f"   Done: {events_inserted} events, taste vector saved ({len(taste_vector)} dims)")
        except Exception as e:
            print(f"   Events: {events_inserted}, taste vector save FAILED: {e}")
    else:
        print(f"   Done: {events_inserted} events, no embeddings found for taste vector")

    return events_inserted


def get_personalized_feed(user_id, limit=30):
    """
    Query the personalized feed by replicating the V2 feed logic:
    1. Get taste vector
    2. Call match_articles_personal RPC
    3. Get trending + discovery
    4. Return categorized results
    """
    # Get taste vector
    user_result = supabase.table('users').select('id, taste_vector').eq('id', user_id).single().execute()
    taste_vector = user_result.data.get('taste_vector') if user_result.data else None

    if not taste_vector:
        print("   WARNING: No taste vector found!")
        return None

    # Check for interest clusters
    clusters_result = supabase.table('user_interest_clusters') \
        .select('id, cluster_index, label, article_count') \
        .eq('user_id', user_id) \
        .execute()
    has_clusters = bool(clusters_result.data)

    # PERSONAL: pgvector similarity search
    seen_ids = []
    personal_result = supabase.rpc('match_articles_personal', {
        'query_embedding': taste_vector,
        'match_count': 150,
        'hours_window': 72,
        'exclude_ids': [],
    }).execute()
    personal_ids = [r['id'] for r in (personal_result.data or [])]
    personal_sims = {r['id']: r['similarity'] for r in (personal_result.data or [])}

    # TRENDING: high score articles from last 24h
    cutoff_24h = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    trending_result = supabase.table('published_articles') \
        .select('id, title_news, category, ai_final_score, created_at') \
        .gte('created_at', cutoff_24h) \
        .gte('ai_final_score', 750) \
        .order('ai_final_score', desc=True) \
        .limit(50) \
        .execute()
    trending_ids = [r['id'] for r in (trending_result.data or [])]

    # DISCOVERY: diverse quality from 48h
    cutoff_48h = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    discovery_result = supabase.table('published_articles') \
        .select('id, title_news, category, ai_final_score, created_at') \
        .gte('created_at', cutoff_48h) \
        .gte('ai_final_score', 400) \
        .order('ai_final_score', desc=True) \
        .limit(200) \
        .execute()

    # Fetch full article details for personal results
    if personal_ids:
        articles_result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, topics, countries') \
            .in_('id', personal_ids[:limit]) \
            .execute()
        personal_articles = articles_result.data or []
        # Sort by similarity
        personal_articles.sort(key=lambda a: personal_sims.get(a['id'], 0), reverse=True)
    else:
        personal_articles = []

    trending_articles = trending_result.data or []

    # Discovery: exclude personal & trending
    all_used = set(personal_ids + trending_ids)
    discovery_articles = [a for a in (discovery_result.data or []) if a['id'] not in all_used]

    # Diversify discovery by category
    disc_by_cat = {}
    for a in discovery_articles:
        cat = a.get('category', 'Other')
        if cat not in disc_by_cat:
            disc_by_cat[cat] = a
    discovery_articles = list(disc_by_cat.values())[:10]

    return {
        'personal': personal_articles,
        'personal_sims': personal_sims,
        'trending': trending_articles,
        'discovery': discovery_articles,
        'has_clusters': has_clusters,
        'clusters': clusters_result.data if has_clusters else [],
    }


def print_feed_results(profile, feed, articles_read):
    """Pretty-print the feed results for a user."""
    print(f"\n{'='*80}")
    print(f"FEED RESULTS: {profile['name']}")
    print(f"{'='*80}")
    print(f"Articles read: {articles_read}")
    print(f"Interest clusters: {feed['has_clusters']}")
    if feed['clusters']:
        for c in feed['clusters']:
            print(f"   Cluster {c['cluster_index']}: {c.get('label', '?')} ({c['article_count']} articles)")

    # Personal bucket analysis
    print(f"\n--- PERSONAL BUCKET (top 20 of {len(feed['personal'])}) ---")
    category_counts = Counter()
    interest_match = 0
    for idx, a in enumerate(feed['personal'][:20]):
        sim = feed['personal_sims'].get(a['id'], 0)
        cat = a.get('category', '?')
        title = a.get('title_news', '')[:65]
        score = a.get('ai_final_score', 0)
        category_counts[cat] += 1

        # Check if this matches user's interests
        is_match = any(
            term.lower() in (title + ' ' + cat).lower()
            for term in profile['search_terms']
        )
        if is_match:
            interest_match += 1
        marker = "***" if is_match else "   "

        print(f"  {marker} {idx+1:2d}. [{cat:15s}] (sim:{sim:.3f} score:{score:4.0f}) {title}")

    total_personal = len(feed['personal'])
    total_match_all = sum(
        1 for a in feed['personal']
        if any(t.lower() in (a.get('title_news', '') + ' ' + a.get('category', '')).lower()
               for t in profile['search_terms'])
    )

    print(f"\n   Interest match in top 20: {interest_match}/20 ({interest_match/20*100:.0f}%)")
    print(f"   Interest match in all {total_personal}: {total_match_all}/{total_personal} ({total_match_all/max(total_personal,1)*100:.0f}%)")
    print(f"   Category distribution (top 20): {dict(category_counts.most_common(5))}")

    # Trending
    print(f"\n--- TRENDING BUCKET (top 5 of {len(feed['trending'])}) ---")
    for idx, a in enumerate(feed['trending'][:5]):
        print(f"  {idx+1}. [{a.get('category','?'):15s}] (score:{a.get('ai_final_score',0):4.0f}) {a.get('title_news','')[:65]}")

    # Discovery
    print(f"\n--- DISCOVERY BUCKET ({len(feed['discovery'])} diverse articles) ---")
    for idx, a in enumerate(feed['discovery'][:5]):
        print(f"  {idx+1}. [{a.get('category','?'):15s}] (score:{a.get('ai_final_score',0):4.0f}) {a.get('title_news','')[:65]}")


# ==========================================
# MAIN TEST
# ==========================================

def main():
    print("="*80)
    print("5-USER PERSONALIZATION TEST")
    print("="*80)
    print(f"Time: {datetime.utcnow().isoformat()}")
    print(f"Supabase: {SUPABASE_URL}")

    # Check article availability
    cutoff = (datetime.utcnow() - timedelta(hours=72)).isoformat()
    count_result = supabase.table('published_articles') \
        .select('id', count='exact') \
        .gte('created_at', cutoff) \
        .not_.is_('embedding', 'null') \
        .execute()
    total_with_embeddings = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
    print(f"Articles with embeddings (72h): {total_with_embeddings}\n")

    results_summary = []

    for user_idx, profile in enumerate(TEST_USERS):
        print(f"\n{'#'*80}")
        print(f"USER {user_idx+1}/5: {profile['name']}")
        print(f"{'#'*80}")
        print(f"Interests: {', '.join(profile['interests'])}")
        print(f"Search terms: {', '.join(profile['search_terms'][:5])}")

        # 1. Create/get user
        print(f"\n1. Setting up test user...")
        user_id = get_or_create_test_user(profile)
        if not user_id:
            print("   FAILED to create user, skipping")
            continue
        print(f"   User ID: {user_id}")

        # Clear old events for this test user
        try:
            supabase.table('user_article_events') \
                .delete() \
                .eq('user_id', user_id) \
                .execute()
            print("   Cleared old events")
        except:
            pass

        # Clear interest clusters
        try:
            supabase.table('user_interest_clusters') \
                .delete() \
                .eq('user_id', user_id) \
                .execute()
        except:
            pass

        # 2. Find articles matching interests
        print(f"\n2. Finding articles matching interests...")
        interest_articles = find_articles_for_interest(profile, limit=250)
        print(f"   Found {len(interest_articles)} matching articles")

        if len(interest_articles) < 20:
            print("   WARNING: Too few matching articles, results may be poor")

        # Show category breakdown
        cat_breakdown = Counter(a.get('category', '?') for a in interest_articles)
        print(f"   Categories: {dict(cat_breakdown.most_common(5))}")

        # 3. Simulate engagements
        print(f"\n3. Simulating article engagements...")
        articles_read = simulate_engagements(user_id, interest_articles, profile['name'])

        # 4. Run clustering (optional - builds interest clusters)
        print(f"\n4. Building interest clusters...")
        try:
            cluster_result = supabase.rpc('cluster_user_interests', {
                'p_user_id': user_id,
                'p_max_clusters': 5,
                'p_lookback_days': 90,
            }).execute()
            cluster_count = cluster_result.data if cluster_result.data else 0
            print(f"   Created {cluster_count} interest clusters")
        except Exception as e:
            print(f"   Clustering failed: {e}")

        # 5. Get personalized feed
        print(f"\n5. Fetching personalized feed...")
        feed = get_personalized_feed(user_id, limit=30)

        if feed:
            print_feed_results(profile, feed, articles_read)

            # Calculate summary metrics
            total_personal = len(feed['personal'])
            match_count = sum(
                1 for a in feed['personal'][:20]
                if any(t.lower() in (a.get('title_news', '') + ' ' + a.get('category', '')).lower()
                       for t in profile['search_terms'])
            )
            results_summary.append({
                'user': profile['name'],
                'articles_read': articles_read,
                'personal_count': total_personal,
                'top20_match': match_count,
                'top20_pct': f"{match_count/20*100:.0f}%",
            })
        else:
            print("   No feed data returned")
            results_summary.append({
                'user': profile['name'],
                'articles_read': articles_read,
                'personal_count': 0,
                'top20_match': 0,
                'top20_pct': '0%',
            })

    # ==========================================
    # FINAL SUMMARY
    # ==========================================
    print(f"\n\n{'='*80}")
    print("FINAL SUMMARY")
    print(f"{'='*80}")
    print(f"{'User':<30s} {'Read':>6s} {'Personal':>10s} {'Top20 Match':>12s} {'%':>6s}")
    print("-" * 70)
    for r in results_summary:
        print(f"{r['user']:<30s} {r['articles_read']:>6d} {r['personal_count']:>10d} {r['top20_match']:>12d} {r['top20_pct']:>6s}")

    print(f"\nTest complete at {datetime.utcnow().isoformat()}")


if __name__ == '__main__':
    main()

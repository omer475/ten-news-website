#!/usr/bin/env python3
"""
Analysis 1: Current System (20%) + Negative Signal Simulation
=============================================================
Simulates what happens when we track "user scrolled past without clicking"
and use that to penalize future articles with similar tags.

Flow:
1. Create 5 test users with distinct interests
2. Simulate 200+ engagements per user
3. Generate feed using current best approach (k-means + round-robin + tag overlap)
4. Simulate user behavior: user engages with relevant articles, SKIPS irrelevant ones
5. Build "skip profile" from skipped article tags
6. Re-generate feed with skip penalty applied
7. Compare: without skip vs with skip tracking
"""

import os, sys, re, json, uuid
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from dotenv import load_dotenv
from supabase import create_client
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.env.local')
if os.path.exists(ENV_PATH): load_dotenv(ENV_PATH)
else: load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def now_utc():
    return datetime.now(timezone.utc)

# 5 users with diverse interests
TEST_USERS = [
    {
        "name": "User 1: Soccer + Finance",
        "email": "test_neg_soccer@tennews.test",
        "interests": {
            "Soccer": {
                "terms": ["soccer", "premier league", "champions league", "messi", "mbappe",
                          "arsenal", "liverpool", "barcelona", "real madrid", "la liga",
                          "goal", "manager", "transfer", "europa league", "serie a"],
                "weight": 0.55,
            },
            "Finance": {
                "terms": ["stock market", "wall street", "nasdaq", "federal reserve",
                          "interest rate", "inflation", "gdp", "bond", "ipo", "earnings",
                          "recession", "banking", "hedge fund", "investment", "s&p"],
                "weight": 0.45,
            },
        },
    },
    {
        "name": "User 2: AI + Gaming",
        "email": "test_neg_ai@tennews.test",
        "interests": {
            "AI": {
                "terms": ["artificial intelligence", "chatgpt", "openai", "anthropic",
                          "machine learning", "gpt", "neural network", "deep learning",
                          "llm", "gemini", "claude", "generative", "ai model", "training"],
                "weight": 0.50,
            },
            "Gaming": {
                "terms": ["gaming", "playstation", "xbox", "nintendo", "steam", "esports",
                          "video game", "fortnite", "console", "gpu", "gta", "ps5",
                          "switch", "indie game", "rpg"],
                "weight": 0.50,
            },
        },
    },
    {
        "name": "User 3: India + Cricket",
        "email": "test_neg_india@tennews.test",
        "interests": {
            "India": {
                "terms": ["india", "modi", "bjp", "delhi", "mumbai", "parliament",
                          "lok sabha", "indian government", "rupee", "congress party",
                          "rahul gandhi", "supreme court india"],
                "weight": 0.50,
            },
            "Cricket": {
                "terms": ["cricket", "ipl", "test match", "odi", "t20", "virat kohli",
                          "rohit sharma", "bcci", "wicket", "batsman", "bowler",
                          "ashes", "world cup cricket", "innings"],
                "weight": 0.50,
            },
        },
    },
    {
        "name": "User 4: NFL + True Crime",
        "email": "test_neg_nfl@tennews.test",
        "interests": {
            "NFL": {
                "terms": ["nfl", "touchdown", "quarterback", "super bowl", "chiefs",
                          "eagles", "cowboys", "draft pick", "football", "yards",
                          "receiver", "sack", "mahomes", "rushing", "patriots"],
                "weight": 0.50,
            },
            "True Crime": {
                "terms": ["murder", "serial killer", "crime", "investigation", "arrested",
                          "suspect", "trial", "prison", "homicide", "kidnapping",
                          "robbery", "fraud", "sentence", "court case", "detective"],
                "weight": 0.50,
            },
        },
    },
    {
        "name": "User 5: Germany (Control)",
        "email": "test_neg_germany@tennews.test",
        "interests": {
            "Germany": {
                "terms": ["germany", "berlin", "scholz", "bundestag", "deutsche",
                          "munich", "frankfurt", "merz", "afd", "german",
                          "volkswagen", "bmw", "bundesliga", "european union", "hamburg"],
                "weight": 1.0,
            },
        },
    },
]


def get_or_create_user(profile):
    result = supabase.table('users').select('id').eq('email', profile['email']).execute()
    if result.data:
        uid = result.data[0]['id']
        supabase.table('users').update({'taste_vector': None}).eq('id', uid).execute()
        try: supabase.table('user_article_events').delete().eq('user_id', uid).execute()
        except: pass
        try: supabase.table('user_interest_clusters').delete().eq('user_id', uid).execute()
        except: pass
        return uid
    uid = str(uuid.uuid4())
    supabase.table('users').insert({
        'id': uid, 'email': profile['email'],
        'home_country': 'usa', 'followed_topics': [], 'followed_countries': [],
    }).execute()
    return uid


def find_articles(terms, limit=120):
    cutoff = (now_utc() - timedelta(hours=24)).isoformat()
    matched = []
    seen = set()
    for term in terms:
        if len(matched) >= limit: break
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, embedding, interest_tags') \
            .gte('created_at', cutoff) \
            .ilike('title_news', f'%{term}%') \
            .not_.is_('embedding', 'null') \
            .order('ai_final_score', desc=True) \
            .limit(40).execute()
        for a in (result.data or []):
            if a['id'] not in seen:
                seen.add(a['id'])
                matched.append(a)
    return matched[:limit]


def classify(article, interests):
    title = (article.get('title_news') or '').lower()
    best, best_n = None, 0
    for name, cfg in interests.items():
        hits = sum(1 for t in cfg['terms'] if re.search(r'\b' + re.escape(t.lower()) + r'\b', title))
        if hits > best_n:
            best_n = hits
            best = name
    return best if best_n > 0 else 'IRRELEVANT'


def is_iran(article):
    title = (article.get('title_news') or '').lower()
    tags = article.get('interest_tags') or []
    if isinstance(tags, str):
        try: tags = json.loads(tags)
        except: tags = []
    iran_kws = ['iran', 'tehran', 'iranian', 'khamenei', 'hormuz']
    war_kws = ['strike', 'missile', 'bomb', 'attack', 'military', 'war', 'troops']
    has_iran = any(kw in title for kw in iran_kws) or 'iran' in [t.lower() for t in tags]
    has_war = any(kw in title for kw in war_kws)
    return has_iran and has_war


def build_ema(articles):
    taste = None
    for idx, art in enumerate(articles):
        emb = art.get('embedding')
        if not emb or not isinstance(emb, list): continue
        e = np.array(emb, dtype=np.float64)
        alpha = 0.15 if idx % 5 == 0 else (0.10 if idx % 3 == 0 else 0.05)
        taste = e.copy() if taste is None else (1 - alpha) * taste + alpha * e
    return taste


def query_feed(taste, limit=150):
    result = supabase.rpc('match_articles_personal', {
        'query_embedding': taste.tolist(), 'match_count': limit,
        'hours_window': 24, 'exclude_ids': [],
    }).execute()
    return result.data or []


def fetch_details(ids):
    if not ids: return []
    arts = []
    for i in range(0, len(ids), 300):
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, interest_tags') \
            .in_('id', ids[i:i+300]).execute()
        arts.extend(result.data or [])
    return arts


def get_tags(article):
    tags = article.get('interest_tags') or []
    if isinstance(tags, str):
        try: tags = json.loads(tags)
        except: tags = []
    return [t.lower() for t in tags]


def build_interest_profile(articles):
    scores = {}
    for art in articles:
        for tag in get_tags(art):
            scores[tag] = scores.get(tag, 0) + 1
    mx = max(scores.values()) if scores else 1
    return {t: s / mx for t, s in scores.items()}


def tag_overlap(article, profile):
    if not profile: return 0
    tags = get_tags(article)
    if not tags: return 0
    return min(sum(profile.get(t, 0) for t in tags) / len(tags), 1.0)


def score_v2(sim, tag_ov, ai_score, hours_old, cat):
    rate = 0.04 if cat in ('World', 'Politics', 'Business', 'Finance') else 0.015
    rec = np.exp(-rate * hours_old)
    return tag_ov * 400 + sim * 300 + (ai_score / 1000) * 100 * rec


def saturation_penalty(articles):
    tag_counts = {}
    for a in articles:
        tags = get_tags(a)
        pen = 0
        for t in tags:
            c = tag_counts.get(t, 0)
            if c >= 3: pen += 0.4
            elif c >= 2: pen += 0.25
            elif c >= 1: pen += 0.1
        avg_pen = min(pen / len(tags), 0.8) if tags else 0
        a['_score'] *= (1 - avg_pen)
        a['_penalty'] = avg_pen
        for t in tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1
    articles.sort(key=lambda x: x['_score'], reverse=True)
    return articles


def build_skip_profile(skipped_articles):
    """Build a 'not interested' profile from articles the user skipped."""
    scores = {}
    for art in skipped_articles:
        for tag in get_tags(art):
            scores[tag] = scores.get(tag, 0) + 1
    mx = max(scores.values()) if scores else 1
    return {t: s / mx for t, s in scores.items()}


def skip_penalty(article, skip_profile, interest_profile):
    """Penalize articles matching skip profile, unless they also match interest profile."""
    if not skip_profile: return 0
    tags = get_tags(article)
    if not tags: return 0
    skip_score = sum(skip_profile.get(t, 0) for t in tags) / len(tags)
    interest_score = sum(interest_profile.get(t, 0) for t in tags) / len(tags) if interest_profile else 0
    # Only penalize if skip signal is stronger than interest signal
    net_skip = max(0, skip_score - interest_score * 0.5)
    return min(net_skip, 0.9)  # Cap at 90% penalty


def evaluate(top20, interests, label):
    hits = defaultdict(int)
    irr = 0
    iran_n = 0
    print(f"\n  Top 20 ({label}):")
    for idx, art in enumerate(top20):
        cls = classify(art, interests)
        title = (art.get('title_news') or '')[:50]
        ai = art.get('ai_final_score', 0) or 0
        sim = art.get('_similarity', 0)
        tag_ov = art.get('_tag_overlap', 0)
        pen = art.get('_penalty', 0)
        skip_pen = art.get('_skip_penalty', 0)
        is_ir = is_iran(art)
        if is_ir: iran_n += 1

        if cls == 'IRRELEVANT':
            irr += 1
            marker = '  W' if is_ir else '  X'
        else:
            hits[cls] += 1
            marker = '  *'
        ir_flag = ' [IRAN]' if is_ir else ''
        skip_info = f' skip:{skip_pen:.2f}' if skip_pen > 0 else ''
        print(f"    {marker} {idx+1:2d}. tag:{tag_ov:.2f} sim:{sim:.3f} pen:{pen:.2f}{skip_info} | {cls:15s} | {title}{ir_flag}")

    total = sum(hits.values())
    prec = total / max(len(top20), 1) * 100
    print(f"\n  Coverage ({label}):")
    for name in interests:
        h = hits.get(name, 0)
        print(f"    {name:20s}: {h:2d}/20 ({h/max(len(top20),1)*100:5.1f}%) target ~{interests[name]['weight']*100:.0f}%")
    print(f"    {'IRRELEVANT':20s}: {irr:2d}/20")
    print(f"    {'IRAN/WAR':20s}: {iran_n:2d}/20")
    print(f"    {'PRECISION':20s}: {total:2d}/20 ({prec:.1f}%)")
    return {'precision': prec, 'hits': dict(hits), 'irrelevant': irr, 'iran': iran_n}


def analyze_user(profile):
    print(f"\n{'#'*80}")
    print(f"  {profile['name']}")
    print(f"{'#'*80}")

    interests = profile['interests']
    uid = get_or_create_user(profile)

    # Find and engage with articles
    all_engaged = []
    for name, cfg in interests.items():
        arts = find_articles(cfg['terms'], limit=120)
        print(f"  [{name}] Found {len(arts)} articles")
        target = max(int(cfg['weight'] * 300), 40)
        all_engaged.extend(arts[:target])

    print(f"  Total engagements: {len(all_engaged)}")
    if len(all_engaged) < 10:
        print("  SKIP: Too few articles")
        return None

    np.random.seed(42)
    np.random.shuffle(all_engaged)

    # Build taste vector
    taste = build_ema(all_engaged)
    if taste is None:
        print("  SKIP: No embeddings")
        return None

    # Build interest profile from engaged articles
    interest_prof = build_interest_profile(all_engaged)
    top_tags = sorted(interest_prof.items(), key=lambda x: -x[1])[:10]
    print(f"  Interest profile (top 10): {dict(top_tags)}")

    # Get candidates
    candidates = query_feed(taste, limit=150)
    sim_map = {r['id']: r['similarity'] for r in candidates}
    cand_ids = [r['id'] for r in candidates[:100]]
    cand_details = fetch_details(cand_ids)
    cand_map = {a['id']: a for a in cand_details}

    # ========== ROUND 1: Current best (B+C) without skip ==========
    print(f"\n  {'='*60}")
    print(f"  ROUND 1: Current Best (tag overlap + saturation, NO skip)")
    print(f"  {'='*60}")

    scored_r1 = []
    for r in candidates[:100]:
        art = cand_map.get(r['id'])
        if not art: continue
        to = tag_overlap(art, interest_prof)
        hours = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
        s = score_v2(r['similarity'], to, art.get('ai_final_score', 0) or 0, hours, art.get('category', ''))
        scored_r1.append({**art, '_score': s, '_similarity': r['similarity'], '_tag_overlap': to, '_penalty': 0, '_skip_penalty': 0})
    scored_r1.sort(key=lambda x: x['_score'], reverse=True)
    scored_r1 = saturation_penalty(scored_r1)

    result_r1 = evaluate(scored_r1[:20], interests, "R1: No Skip")

    # ========== SIMULATE SKIP BEHAVIOR ==========
    # User sees top 50, engages with relevant, skips irrelevant
    skipped = []
    for art in scored_r1[:50]:
        cls = classify(art, interests)
        if cls == 'IRRELEVANT':
            skipped.append(art)

    print(f"\n  Simulated: user skipped {len(skipped)}/50 articles in first session")
    skip_prof = build_skip_profile(skipped)
    top_skip_tags = sorted(skip_prof.items(), key=lambda x: -x[1])[:10]
    print(f"  Skip profile (top 10): {dict(top_skip_tags)}")

    # ========== ROUND 2: With skip penalty ==========
    print(f"\n  {'='*60}")
    print(f"  ROUND 2: With Skip Penalty (simulated negative signals)")
    print(f"  {'='*60}")

    scored_r2 = []
    for r in candidates[:100]:
        art = cand_map.get(r['id'])
        if not art: continue
        to = tag_overlap(art, interest_prof)
        sp = skip_penalty(art, skip_prof, interest_prof)
        hours = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
        base = score_v2(r['similarity'], to, art.get('ai_final_score', 0) or 0, hours, art.get('category', ''))
        s = base * (1 - sp)  # Apply skip penalty
        scored_r2.append({**art, '_score': s, '_similarity': r['similarity'], '_tag_overlap': to, '_penalty': 0, '_skip_penalty': sp})
    scored_r2.sort(key=lambda x: x['_score'], reverse=True)
    scored_r2 = saturation_penalty(scored_r2)

    result_r2 = evaluate(scored_r2[:20], interests, "R2: With Skip")

    # ========== COMPARISON ==========
    print(f"\n  {'='*60}")
    print(f"  COMPARISON")
    print(f"  {'='*60}")
    print(f"  Without skip: {result_r1['precision']:.1f}% precision, {result_r1['iran']}/20 iran")
    print(f"  With skip:    {result_r2['precision']:.1f}% precision, {result_r2['iran']}/20 iran")
    print(f"  Improvement:  {result_r2['precision']-result_r1['precision']:+.1f}% precision, {result_r1['iran']-result_r2['iran']:+d} iran reduction")

    return {
        'user': profile['name'],
        'num_interests': len(interests),
        'engagements': len(all_engaged),
        'r1_precision': result_r1['precision'],
        'r1_hits': result_r1['hits'],
        'r1_irrelevant': result_r1['irrelevant'],
        'r1_iran': result_r1['iran'],
        'r2_precision': result_r2['precision'],
        'r2_hits': result_r2['hits'],
        'r2_irrelevant': result_r2['irrelevant'],
        'r2_iran': result_r2['iran'],
        'skipped': len(skipped),
    }


def main():
    print("=" * 100)
    print("  ANALYSIS 1: NEGATIVE SIGNAL SIMULATION (Skip Tracking)")
    print("  Current best system + simulated scroll-past penalties")
    print("=" * 100)
    print(f"  Time: {now_utc().isoformat()}")

    results = []
    for p in TEST_USERS:
        r = analyze_user(p)
        if r: results.append(r)

    # Final table
    print(f"\n\n{'='*120}")
    print("  FINAL RESULTS: Without Skip vs With Skip Tracking")
    print(f"{'='*120}")
    print(f"{'User':<40s} | {'Eng':>3s} | {'R1 Prec':>7s} | {'R2 Prec':>7s} | {'Delta':>7s} | {'R1 Iran':>7s} | {'R2 Iran':>7s} | {'Skipped':>7s}")
    print("-" * 120)
    for r in results:
        delta = r['r2_precision'] - r['r1_precision']
        print(f"{r['user']:<40s} | {r['engagements']:>3d} | {r['r1_precision']:>6.1f}% | {r['r2_precision']:>6.1f}% | {delta:>+6.1f}% | {r['r1_iran']:>5d}/20 | {r['r2_iran']:>5d}/20 | {r['skipped']:>5d}/50")

    multi = [r for r in results if r['num_interests'] > 1]
    if multi:
        avg_r1 = np.mean([r['r1_precision'] for r in multi])
        avg_r2 = np.mean([r['r2_precision'] for r in multi])
        avg_iran_r1 = np.mean([r['r1_iran'] for r in multi])
        avg_iran_r2 = np.mean([r['r2_iran'] for r in multi])
        print(f"\n  AVERAGES (multi-interest users):")
        print(f"    Without skip tracking: {avg_r1:.1f}% precision, {avg_iran_r1:.1f}/20 iran")
        print(f"    With skip tracking:    {avg_r2:.1f}% precision, {avg_iran_r2:.1f}/20 iran")
        print(f"    Improvement:           {avg_r2-avg_r1:+.1f}% precision, {avg_iran_r1-avg_iran_r2:+.1f} iran reduction")

    print(f"\n{'='*100}")
    print(f"  Analysis 1 complete: {now_utc().isoformat()}")
    print(f"{'='*100}")


if __name__ == '__main__':
    main()

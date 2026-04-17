#!/usr/bin/env python3
"""
Analysis 3: Combined — MiniLM Embeddings + Skip Tracking + Tag Overlap
=======================================================================
Tests all three improvements together against the current Gemini-only system.

Approaches compared:
  A) Current: Gemini embedding similarity only (baseline)
  B) Current best: Gemini + tag overlap + saturation penalty
  C) Combined: MiniLM embeddings + skip tracking + tag overlap + saturation

All tested on last 24h articles.
"""

import os, sys, re, json, uuid
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from dotenv import load_dotenv
from supabase import create_client

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.env.local')
if os.path.exists(ENV_PATH): load_dotenv(ENV_PATH)
else: load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def now_utc():
    return datetime.now(timezone.utc)

# Load MiniLM
print("Loading MiniLM model...")
from sentence_transformers import SentenceTransformer
st_model = SentenceTransformer('all-MiniLM-L6-v2')
print(f"Model loaded ({st_model.get_sentence_embedding_dimension()}-dim)")

TEST_USERS = [
    {
        "name": "User 1: Soccer + Finance",
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


def fetch_all_24h_articles():
    cutoff = (now_utc() - timedelta(hours=24)).isoformat()
    all_arts = []
    offset = 0
    while True:
        result = supabase.table('published_articles') \
            .select('id, title_news, category, ai_final_score, created_at, interest_tags') \
            .gte('created_at', cutoff) \
            .not_.is_('embedding', 'null') \
            .order('created_at', desc=True) \
            .range(offset, offset + 999).execute()
        batch = result.data or []
        all_arts.extend(batch)
        if len(batch) < 1000: break
        offset += 1000
    return all_arts


def fetch_gemini_embeddings(ids):
    emb_map = {}
    for i in range(0, len(ids), 50):
        result = supabase.table('published_articles') \
            .select('id, embedding') \
            .in_('id', ids[i:i+50]).execute()
        for a in (result.data or []):
            if a.get('embedding'):
                emb_map[a['id']] = a['embedding']
    return emb_map


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


def cosine_sim(a, b):
    a, b = np.array(a, dtype=np.float64), np.array(b, dtype=np.float64)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0: return 0
    return float(np.dot(a, b) / (na * nb))


def build_ema(embeddings):
    taste = None
    for idx, emb in enumerate(embeddings):
        e = np.array(emb, dtype=np.float64)
        alpha = 0.15 if idx % 5 == 0 else (0.10 if idx % 3 == 0 else 0.05)
        taste = e.copy() if taste is None else (1 - alpha) * taste + alpha * e
    return taste


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


def build_skip_profile(skipped_articles):
    scores = {}
    for art in skipped_articles:
        for tag in get_tags(art):
            scores[tag] = scores.get(tag, 0) + 1
    mx = max(scores.values()) if scores else 1
    return {t: s / mx for t, s in scores.items()}


def skip_penalty(article, skip_profile, interest_profile):
    if not skip_profile: return 0
    tags = get_tags(article)
    if not tags: return 0
    skip_score = sum(skip_profile.get(t, 0) for t in tags) / len(tags)
    interest_score = sum(interest_profile.get(t, 0) for t in tags) / len(tags) if interest_profile else 0
    net_skip = max(0, skip_score - interest_score * 0.5)
    return min(net_skip, 0.9)


def score_v2(sim, tag_ov, ai_score, hours_old, cat):
    rate = 0.04 if cat in ('World', 'Politics', 'Business', 'Finance') else 0.015
    rec = np.exp(-rate * hours_old)
    return tag_ov * 400 + sim * 300 + (ai_score / 1000) * 100 * rec


def apply_saturation(articles):
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
        a['_sat_penalty'] = avg_pen
        for t in tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1
    articles.sort(key=lambda x: x['_score'], reverse=True)
    return articles


def find_engaged_articles(all_articles, terms, limit=120):
    matched = []
    seen = set()
    for term in terms:
        if len(matched) >= limit: break
        for a in all_articles:
            if a['id'] in seen: continue
            title = (a.get('title_news') or '').lower()
            if re.search(r'\b' + re.escape(term.lower()) + r'\b', title):
                seen.add(a['id'])
                matched.append(a)
                if len(matched) >= limit: break
    return matched[:limit]


def evaluate(top20, interests, label):
    hits = defaultdict(int)
    irr = 0
    iran_n = 0
    print(f"\n  Top 20 ({label}):")
    for idx, art in enumerate(top20):
        cls = classify(art, interests)
        title = (art.get('title_news') or '')[:52]
        is_ir = is_iran(art)
        if is_ir: iran_n += 1
        sim = art.get('_sim', 0)
        to = art.get('_tag_overlap', 0)
        sp = art.get('_skip_penalty', 0)
        sat = art.get('_sat_penalty', 0)
        if cls == 'IRRELEVANT':
            irr += 1
            marker = '  W' if is_ir else '  X'
        else:
            hits[cls] += 1
            marker = '  *'
        ir_flag = ' [IRAN]' if is_ir else ''
        extras = []
        if to > 0: extras.append(f'tag:{to:.2f}')
        if sp > 0: extras.append(f'skip:{sp:.2f}')
        if sat > 0: extras.append(f'sat:{sat:.2f}')
        extra_str = ' '.join(extras)
        print(f"    {marker} {idx+1:2d}. sim:{sim:.3f} {extra_str:20s} | {cls:15s} | {title}{ir_flag}")

    total = sum(hits.values())
    prec = total / max(len(top20), 1) * 100
    print(f"\n  Coverage ({label}):")
    for name in interests:
        h = hits.get(name, 0)
        print(f"    {name:20s}: {h:2d}/20 ({h/max(len(top20),1)*100:5.1f}%)")
    print(f"    {'IRRELEVANT':20s}: {irr:2d}/20")
    print(f"    {'IRAN/WAR':20s}: {iran_n:2d}/20")
    print(f"    {'PRECISION':20s}: {total:2d}/20 ({prec:.1f}%)")
    return {'precision': prec, 'hits': dict(hits), 'irrelevant': irr, 'iran': iran_n}


def analyze_user(profile, all_articles, st_embeddings):
    print(f"\n{'#'*80}")
    print(f"  {profile['name']}")
    print(f"{'#'*80}")

    interests = profile['interests']

    # Find engaged articles
    all_engaged = []
    for name, cfg in interests.items():
        arts = find_engaged_articles(all_articles, cfg['terms'], limit=120)
        print(f"  [{name}] Found {len(arts)} articles")
        target = max(int(cfg['weight'] * 300), 40)
        all_engaged.extend(arts[:target])

    print(f"  Total engagements: {len(all_engaged)}")
    if len(all_engaged) < 10:
        print("  SKIP: Too few articles in last 24h")
        return None

    np.random.seed(42)
    np.random.shuffle(all_engaged)

    engaged_ids = [a['id'] for a in all_engaged]

    # Build interest profile from tags
    interest_prof = build_interest_profile(all_engaged)
    top_tags = sorted(interest_prof.items(), key=lambda x: -x[1])[:8]
    print(f"  Interest profile: {dict(top_tags)}")

    # --- Fetch Gemini embeddings for engaged + all articles for RPC ---
    print(f"  Fetching Gemini embeddings for engaged articles...")
    gemini_engaged_map = fetch_gemini_embeddings(engaged_ids)
    gemini_embs = [gemini_engaged_map[a['id']] for a in all_engaged if a['id'] in gemini_engaged_map]
    taste_gemini = build_ema(gemini_embs) if gemini_embs else None

    # --- Build MiniLM taste vector ---
    st_engaged = [st_embeddings[a['id']] for a in all_engaged if a['id'] in st_embeddings]
    taste_st = build_ema(st_engaged) if st_engaged else None

    print(f"  Gemini taste: {len(gemini_embs)} embs | MiniLM taste: {len(st_engaged)} embs")

    # ================================================================
    # APPROACH A: Gemini embedding similarity only (baseline)
    # ================================================================
    print(f"\n  {'='*65}")
    print(f"  A) BASELINE: Gemini embedding similarity only")
    print(f"  {'='*65}")

    if taste_gemini is not None:
        rpc = supabase.rpc('match_articles_personal', {
            'query_embedding': taste_gemini.tolist(), 'match_count': 100,
            'hours_window': 24, 'exclude_ids': [],
        }).execute()
        gemini_cands = rpc.data or []
        cand_ids = [r['id'] for r in gemini_cands[:100]]
        details = {}
        for i in range(0, len(cand_ids), 300):
            res = supabase.table('published_articles') \
                .select('id, title_news, category, ai_final_score, created_at, interest_tags') \
                .in_('id', cand_ids[i:i+300]).execute()
            for a in (res.data or []): details[a['id']] = a

        a_scored = []
        for r in gemini_cands[:100]:
            art = details.get(r['id'])
            if not art: continue
            a_scored.append({**art, '_score': r['similarity'] * 1000, '_sim': r['similarity'],
                           '_tag_overlap': 0, '_skip_penalty': 0, '_sat_penalty': 0})
        a_scored.sort(key=lambda x: x['_score'], reverse=True)
        result_a = evaluate(a_scored[:20], interests, "A: Gemini Only")
    else:
        result_a = {'precision': 0, 'iran': 0, 'irrelevant': 20}

    # ================================================================
    # APPROACH B: Gemini + tag overlap + saturation (current production)
    # ================================================================
    print(f"\n  {'='*65}")
    print(f"  B) CURRENT BEST: Gemini + tag overlap + saturation")
    print(f"  {'='*65}")

    if taste_gemini is not None:
        b_scored = []
        for r in gemini_cands[:100]:
            art = details.get(r['id'])
            if not art: continue
            to = tag_overlap(art, interest_prof)
            hours = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
            s = score_v2(r['similarity'], to, art.get('ai_final_score', 0) or 0, hours, art.get('category', ''))
            b_scored.append({**art, '_score': s, '_sim': r['similarity'],
                           '_tag_overlap': to, '_skip_penalty': 0, '_sat_penalty': 0})
        b_scored.sort(key=lambda x: x['_score'], reverse=True)
        b_scored = apply_saturation(b_scored)
        result_b = evaluate(b_scored[:20], interests, "B: Gemini+Tags+Sat")
    else:
        result_b = {'precision': 0, 'iran': 0, 'irrelevant': 20}

    # ================================================================
    # APPROACH C: MiniLM + tag overlap + saturation + skip tracking
    # ================================================================
    print(f"\n  {'='*65}")
    print(f"  C) COMBINED: MiniLM + tag overlap + saturation + skip tracking")
    print(f"  {'='*65}")

    if taste_st is not None:
        # Score all articles by MiniLM similarity
        c_all = []
        for art in all_articles:
            st_emb = st_embeddings.get(art['id'])
            if st_emb is None: continue
            sim = cosine_sim(st_emb, taste_st)
            c_all.append({**art, '_minilm_sim': sim})
        c_all.sort(key=lambda x: x['_minilm_sim'], reverse=True)

        # Take top 100 candidates
        c_cands = c_all[:100]

        # ROUND 1: Score without skip (to simulate first session)
        c_r1 = []
        for art in c_cands:
            to = tag_overlap(art, interest_prof)
            hours = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
            s = score_v2(art['_minilm_sim'], to, art.get('ai_final_score', 0) or 0, hours, art.get('category', ''))
            c_r1.append({**art, '_score': s, '_sim': art['_minilm_sim'],
                        '_tag_overlap': to, '_skip_penalty': 0, '_sat_penalty': 0})
        c_r1.sort(key=lambda x: x['_score'], reverse=True)
        c_r1 = apply_saturation(c_r1)

        # Simulate skip: user sees top 50, skips irrelevant
        skipped = [a for a in c_r1[:50] if classify(a, interests) == 'IRRELEVANT']
        print(f"  Simulated: user skipped {len(skipped)}/50 in first session")

        skip_prof = build_skip_profile(skipped)
        top_skip = sorted(skip_prof.items(), key=lambda x: -x[1])[:5]
        print(f"  Skip tags: {dict(top_skip)}")

        # ROUND 2: Re-score with skip penalty
        c_r2 = []
        for art in c_cands:
            to = tag_overlap(art, interest_prof)
            sp = skip_penalty(art, skip_prof, interest_prof)
            hours = (now_utc() - datetime.fromisoformat(art['created_at'].replace('Z', '+00:00'))).total_seconds() / 3600
            base = score_v2(art['_minilm_sim'], to, art.get('ai_final_score', 0) or 0, hours, art.get('category', ''))
            s = base * (1 - sp)
            c_r2.append({**art, '_score': s, '_sim': art['_minilm_sim'],
                        '_tag_overlap': to, '_skip_penalty': sp, '_sat_penalty': 0})
        c_r2.sort(key=lambda x: x['_score'], reverse=True)
        c_r2 = apply_saturation(c_r2)

        result_c = evaluate(c_r2[:20], interests, "C: MiniLM+Tags+Sat+Skip")
    else:
        result_c = {'precision': 0, 'iran': 0, 'irrelevant': 20}

    # ================================================================
    # COMPARISON
    # ================================================================
    print(f"\n  {'='*65}")
    print(f"  COMPARISON: {profile['name']}")
    print(f"  {'='*65}")
    print(f"  A) Gemini only:           {result_a['precision']:5.1f}% precision, {result_a['iran']}/20 iran")
    print(f"  B) Gemini+Tags+Sat:       {result_b['precision']:5.1f}% precision, {result_b['iran']}/20 iran")
    print(f"  C) MiniLM+Tags+Sat+Skip:  {result_c['precision']:5.1f}% precision, {result_c['iran']}/20 iran")
    print(f"  A→C improvement:          {result_c['precision']-result_a['precision']:+5.1f}% precision, {result_a['iran']-result_c['iran']:+d} iran")

    return {
        'user': profile['name'],
        'num_interests': len(interests),
        'engagements': len(all_engaged),
        'a_prec': result_a['precision'], 'a_iran': result_a['iran'],
        'b_prec': result_b['precision'], 'b_iran': result_b['iran'],
        'c_prec': result_c['precision'], 'c_iran': result_c['iran'],
    }


def main():
    print("=" * 100)
    print("  ANALYSIS 3: COMBINED — MiniLM + Skip Tracking + Tag Overlap")
    print("  A) Gemini only  vs  B) Gemini+Tags+Sat  vs  C) MiniLM+Tags+Sat+Skip")
    print("=" * 100)
    print(f"  Time: {now_utc().isoformat()}")

    print("\n  Fetching last 24h articles...")
    all_articles = fetch_all_24h_articles()
    print(f"  Found {len(all_articles)} articles")

    print(f"  Embedding all titles with MiniLM...")
    titles = [a.get('title_news') or '' for a in all_articles]
    st_embs = st_model.encode(titles, show_progress_bar=True, batch_size=64)
    st_embeddings = {}
    for art, emb in zip(all_articles, st_embs):
        st_embeddings[art['id']] = emb.tolist()
    print(f"  Embedded {len(st_embeddings)} articles")

    results = []
    for p in TEST_USERS:
        r = analyze_user(p, all_articles, st_embeddings)
        if r: results.append(r)

    # Final table
    print(f"\n\n{'='*140}")
    print("  FINAL RESULTS")
    print(f"{'='*140}")
    print(f"{'User':<35s} | {'Eng':>3s} | {'A: Gemini':>10s} | {'B: +Tags':>10s} | {'C: Combined':>11s} | {'A→C':>7s} | {'A Iran':>6s} | {'B Iran':>6s} | {'C Iran':>6s}")
    print("-" * 140)
    for r in results:
        delta = r['c_prec'] - r['a_prec']
        print(f"{r['user']:<35s} | {r['engagements']:>3d} | {r['a_prec']:>9.1f}% | {r['b_prec']:>9.1f}% | {r['c_prec']:>10.1f}% | {delta:>+6.1f}% | {r['a_iran']:>4d}/20 | {r['b_iran']:>4d}/20 | {r['c_iran']:>4d}/20")

    if results:
        avg_a = np.mean([r['a_prec'] for r in results])
        avg_b = np.mean([r['b_prec'] for r in results])
        avg_c = np.mean([r['c_prec'] for r in results])
        avg_ai = np.mean([r['a_iran'] for r in results])
        avg_bi = np.mean([r['b_iran'] for r in results])
        avg_ci = np.mean([r['c_iran'] for r in results])

        print(f"\n  AVERAGES (all users):")
        print(f"    A) Gemini only:          {avg_a:.1f}% precision, {avg_ai:.1f}/20 iran")
        print(f"    B) Gemini+Tags+Sat:      {avg_b:.1f}% precision, {avg_bi:.1f}/20 iran")
        print(f"    C) MiniLM+Tags+Sat+Skip: {avg_c:.1f}% precision, {avg_ci:.1f}/20 iran")
        print(f"    A→C improvement:         {avg_c-avg_a:+.1f}% precision, {avg_ai-avg_ci:+.1f} iran reduction")

        multi = [r for r in results if r['num_interests'] > 1]
        if multi:
            avg_a_m = np.mean([r['a_prec'] for r in multi])
            avg_c_m = np.mean([r['c_prec'] for r in multi])
            print(f"\n  AVERAGES (multi-interest only):")
            print(f"    A) Gemini only:          {avg_a_m:.1f}%")
            print(f"    C) MiniLM+Tags+Sat+Skip: {avg_c_m:.1f}%")
            print(f"    Improvement:             {avg_c_m-avg_a_m:+.1f}%")

    print(f"\n{'='*100}")
    print(f"  Analysis 3 complete: {now_utc().isoformat()}")
    print(f"{'='*100}")


if __name__ == '__main__':
    main()

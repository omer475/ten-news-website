#!/usr/bin/env python3
"""
Analysis 2: Better Embedding Model Comparison
==============================================
Compares current Gemini 3072-dim embeddings vs sentence-transformers
all-MiniLM-L6-v2 (384-dim, tuned for semantic similarity).

Hypothesis: A smaller, topic-tuned model may produce sharper similarity
distributions (bigger gap between relevant vs irrelevant articles).

Flow:
1. Fetch last 24h articles with existing Gemini embeddings
2. Re-embed article titles with all-MiniLM-L6-v2
3. For each test user: build taste vectors with both models
4. Compare similarity distributions (relevant vs irrelevant)
5. Compare feed precision (top-20 ranking quality)
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


# ---- Embedding model setup ----
print("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
from sentence_transformers import SentenceTransformer
st_model = SentenceTransformer('all-MiniLM-L6-v2')
print(f"Model loaded. Embedding dim: {st_model.get_sentence_embedding_dimension()}")


# ---- Test users (same as analysis 1) ----
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
    """Fetch all articles from last 24 hours (without huge embedding column)."""
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


def fetch_gemini_embeddings(article_ids):
    """Fetch Gemini embeddings for specific article IDs (in batches to avoid timeout)."""
    emb_map = {}
    for i in range(0, len(article_ids), 50):
        batch_ids = article_ids[i:i+50]
        result = supabase.table('published_articles') \
            .select('id, embedding') \
            .in_('id', batch_ids).execute()
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
    a, b = np.array(a), np.array(b)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0: return 0
    return float(np.dot(a, b) / (na * nb))


def build_ema(embeddings):
    """Build EMA taste vector from a list of embedding arrays."""
    taste = None
    for idx, emb in enumerate(embeddings):
        e = np.array(emb, dtype=np.float64)
        alpha = 0.15 if idx % 5 == 0 else (0.10 if idx % 3 == 0 else 0.05)
        taste = e.copy() if taste is None else (1 - alpha) * taste + alpha * e
    return taste


def find_engaged_articles(all_articles, terms, limit=120):
    """Find articles matching interest terms."""
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


def analyze_similarity_distribution(all_articles, engaged, taste_gemini, taste_st, st_embeddings, gemini_map, interests, label):
    """Compare similarity distributions between Gemini and ST models."""

    # Classify all articles
    rel_gemini_sims = []
    irr_gemini_sims = []
    rel_st_sims = []
    irr_st_sims = []

    for art in all_articles:
        cls = classify(art, interests)

        # Gemini similarity
        gemini_emb = gemini_map.get(art['id'])
        if gemini_emb and taste_gemini is not None:
            gsim = cosine_sim(gemini_emb, taste_gemini)
        else:
            gsim = None

        # ST similarity
        st_emb = st_embeddings.get(art['id'])
        if st_emb is not None and taste_st is not None:
            ssim = cosine_sim(st_emb, taste_st)
        else:
            ssim = None

        if cls != 'IRRELEVANT':
            if gsim is not None: rel_gemini_sims.append(gsim)
            if ssim is not None: rel_st_sims.append(ssim)
        else:
            if gsim is not None: irr_gemini_sims.append(gsim)
            if ssim is not None: irr_st_sims.append(ssim)

    print(f"\n  Similarity Distribution ({label}):")
    print(f"  {'':30s} | {'Relevant':>20s} | {'Irrelevant':>20s} | {'Gap':>10s}")
    print(f"  {'-'*90}")

    if rel_gemini_sims and irr_gemini_sims:
        g_rel_avg = np.mean(rel_gemini_sims)
        g_irr_avg = np.mean(irr_gemini_sims)
        g_gap = g_rel_avg - g_irr_avg
        print(f"  {'Gemini 3072-dim':30s} | {g_rel_avg:.4f} (n={len(rel_gemini_sims):>3d}) | {g_irr_avg:.4f} (n={len(irr_gemini_sims):>3d}) | {g_gap:+.4f}")

    if rel_st_sims and irr_st_sims:
        s_rel_avg = np.mean(rel_st_sims)
        s_irr_avg = np.mean(irr_st_sims)
        s_gap = s_rel_avg - s_irr_avg
        print(f"  {'MiniLM 384-dim':30s} | {s_rel_avg:.4f} (n={len(rel_st_sims):>3d}) | {s_irr_avg:.4f} (n={len(irr_st_sims):>3d}) | {s_gap:+.4f}")

    # Show ranges
    if rel_gemini_sims and irr_gemini_sims:
        print(f"\n  Gemini ranges:  rel=[{min(rel_gemini_sims):.3f}, {max(rel_gemini_sims):.3f}]  irr=[{min(irr_gemini_sims):.3f}, {max(irr_gemini_sims):.3f}]")
    if rel_st_sims and irr_st_sims:
        print(f"  MiniLM ranges:  rel=[{min(rel_st_sims):.3f}, {max(rel_st_sims):.3f}]  irr=[{min(irr_st_sims):.3f}, {max(irr_st_sims):.3f}]")

    return {
        'gemini_rel': rel_gemini_sims, 'gemini_irr': irr_gemini_sims,
        'st_rel': rel_st_sims, 'st_irr': irr_st_sims,
    }


def evaluate_top(top_articles, interests, model_name, top_k=20):
    """Evaluate a pre-ranked list of articles."""
    top = top_articles[:top_k]
    hits = defaultdict(int)
    irr = 0
    iran_n = 0
    print(f"\n  Top {top_k} by {model_name}:")
    for idx, art in enumerate(top):
        cls = classify(art, interests)
        title = (art.get('title_news') or '')[:55]
        is_ir = is_iran(art)
        if is_ir: iran_n += 1
        if cls == 'IRRELEVANT':
            irr += 1
            marker = '  W' if is_ir else '  X'
        else:
            hits[cls] += 1
            marker = '  *'
        ir_flag = ' [IRAN]' if is_ir else ''
        print(f"    {marker} {idx+1:2d}. sim:{art['_sim']:.4f} | {cls:15s} | {title}{ir_flag}")

    total = sum(hits.values())
    prec = total / max(len(top), 1) * 100
    print(f"\n  Coverage ({model_name}):")
    for name in interests:
        h = hits.get(name, 0)
        print(f"    {name:20s}: {h:2d}/{top_k} ({h/max(len(top),1)*100:5.1f}%)")
    print(f"    {'IRRELEVANT':20s}: {irr:2d}/{top_k}")
    print(f"    {'IRAN/WAR':20s}: {iran_n:2d}/{top_k}")
    print(f"    {'PRECISION':20s}: {total:2d}/{top_k} ({prec:.1f}%)")
    return {'precision': prec, 'hits': dict(hits), 'irrelevant': irr, 'iran': iran_n}


def rank_and_evaluate(all_articles, taste, embeddings_map, interests, model_name, top_k=20):
    """Rank articles by similarity and evaluate precision."""
    scored = []
    for art in all_articles:
        emb = embeddings_map.get(art['id'])
        if emb is None or taste is None: continue
        sim = cosine_sim(emb, taste)
        scored.append({**art, '_sim': sim})

    scored.sort(key=lambda x: x['_sim'], reverse=True)
    top = scored[:top_k]

    hits = defaultdict(int)
    irr = 0
    iran_n = 0
    print(f"\n  Top {top_k} by {model_name}:")
    for idx, art in enumerate(top):
        cls = classify(art, interests)
        title = (art.get('title_news') or '')[:55]
        is_ir = is_iran(art)
        if is_ir: iran_n += 1
        if cls == 'IRRELEVANT':
            irr += 1
            marker = '  W' if is_ir else '  X'
        else:
            hits[cls] += 1
            marker = '  *'
        ir_flag = ' [IRAN]' if is_ir else ''
        print(f"    {marker} {idx+1:2d}. sim:{art['_sim']:.4f} | {cls:15s} | {title}{ir_flag}")

    total = sum(hits.values())
    prec = total / max(len(top), 1) * 100
    print(f"\n  Coverage ({model_name}):")
    for name in interests:
        h = hits.get(name, 0)
        print(f"    {name:20s}: {h:2d}/{top_k} ({h/max(len(top),1)*100:5.1f}%)")
    print(f"    {'IRRELEVANT':20s}: {irr:2d}/{top_k}")
    print(f"    {'IRAN/WAR':20s}: {iran_n:2d}/{top_k}")
    print(f"    {'PRECISION':20s}: {total:2d}/{top_k} ({prec:.1f}%)")

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
        print("  SKIP: Too few articles")
        return None

    np.random.seed(42)
    np.random.shuffle(all_engaged)

    # Fetch Gemini embeddings for engaged articles + sample of all articles for comparison
    engaged_ids = [a['id'] for a in all_engaged]
    # For distribution analysis, sample up to 300 random articles + all engaged
    sample_ids = list(set(engaged_ids + [a['id'] for a in all_articles[:300]]))
    print(f"  Fetching Gemini embeddings for {len(sample_ids)} articles...")
    gemini_map = fetch_gemini_embeddings(sample_ids)
    print(f"  Got {len(gemini_map)} Gemini embeddings")

    # Build Gemini taste vector
    gemini_embeddings = [gemini_map[a['id']] for a in all_engaged if a['id'] in gemini_map]
    taste_gemini = build_ema(gemini_embeddings) if gemini_embeddings else None

    # Build ST taste vector
    st_engaged = [st_embeddings[a['id']] for a in all_engaged if a['id'] in st_embeddings]
    taste_st = build_ema(st_engaged) if st_engaged else None

    print(f"  Gemini taste vector: {'yes' if taste_gemini is not None else 'no'} ({len(gemini_embeddings)} embeddings)")
    print(f"  MiniLM taste vector: {'yes' if taste_st is not None else 'no'} ({len(st_engaged)} embeddings)")

    # Similarity distributions (use only articles we have Gemini embeddings for)
    dist_articles = [a for a in all_articles if a['id'] in gemini_map or a['id'] in st_embeddings]
    dist = analyze_similarity_distribution(dist_articles, all_engaged, taste_gemini, taste_st, st_embeddings, gemini_map, interests, profile['name'])

    # Rank with Gemini using the RPC function (server-side vector search)
    print(f"\n  {'='*60}")
    print(f"  GEMINI 3072-dim RANKING (via pgvector RPC)")
    print(f"  {'='*60}")
    if taste_gemini is not None:
        rpc_result = supabase.rpc('match_articles_personal', {
            'query_embedding': taste_gemini.tolist(), 'match_count': 100,
            'hours_window': 24, 'exclude_ids': [],
        }).execute()
        gemini_candidates = rpc_result.data or []
        # Fetch details for top 100
        gids = [r['id'] for r in gemini_candidates[:100]]
        gdetails = {}
        for i in range(0, len(gids), 300):
            res = supabase.table('published_articles') \
                .select('id, title_news, category, ai_final_score, created_at, interest_tags') \
                .in_('id', gids[i:i+300]).execute()
            for a in (res.data or []):
                gdetails[a['id']] = a
        gtop = []
        for r in gemini_candidates[:20]:
            art = gdetails.get(r['id'])
            if art:
                gtop.append({**art, '_sim': r['similarity']})
        result_gemini = evaluate_top(gtop, interests, "Gemini 3072-dim")
    else:
        result_gemini = {'precision': 0, 'iran': 0}

    # Rank with MiniLM (local cosine similarity)
    print(f"\n  {'='*60}")
    print(f"  MiniLM 384-dim RANKING")
    print(f"  {'='*60}")
    result_st = rank_and_evaluate(all_articles, taste_st, st_embeddings, interests, "MiniLM 384-dim")

    # Comparison
    print(f"\n  {'='*60}")
    print(f"  COMPARISON: {profile['name']}")
    print(f"  {'='*60}")
    print(f"  Gemini:  {result_gemini['precision']:.1f}% precision, {result_gemini['iran']}/20 iran")
    print(f"  MiniLM:  {result_st['precision']:.1f}% precision, {result_st['iran']}/20 iran")
    print(f"  Delta:   {result_st['precision']-result_gemini['precision']:+.1f}% precision")

    # Similarity gap comparison
    if dist['gemini_rel'] and dist['gemini_irr'] and dist['st_rel'] and dist['st_irr']:
        g_gap = np.mean(dist['gemini_rel']) - np.mean(dist['gemini_irr'])
        s_gap = np.mean(dist['st_rel']) - np.mean(dist['st_irr'])
        print(f"\n  Similarity gap (relevant - irrelevant):")
        print(f"    Gemini: {g_gap:+.4f}")
        print(f"    MiniLM: {s_gap:+.4f}")
        print(f"    {'MiniLM discriminates BETTER' if s_gap > g_gap else 'Gemini discriminates BETTER'} ({abs(s_gap-g_gap):.4f} difference)")

    return {
        'user': profile['name'],
        'gemini_precision': result_gemini['precision'],
        'gemini_iran': result_gemini['iran'],
        'st_precision': result_st['precision'],
        'st_iran': result_st['iran'],
        'gemini_gap': np.mean(dist['gemini_rel']) - np.mean(dist['gemini_irr']) if dist['gemini_rel'] and dist['gemini_irr'] else 0,
        'st_gap': np.mean(dist['st_rel']) - np.mean(dist['st_irr']) if dist['st_rel'] and dist['st_irr'] else 0,
    }


def main():
    print("=" * 100)
    print("  ANALYSIS 2: BETTER EMBEDDING MODEL COMPARISON")
    print("  Gemini 3072-dim vs all-MiniLM-L6-v2 384-dim")
    print("=" * 100)
    print(f"  Time: {now_utc().isoformat()}")

    # Fetch all 24h articles
    print("\n  Fetching all articles from last 24 hours...")
    all_articles = fetch_all_24h_articles()
    print(f"  Found {len(all_articles)} articles with embeddings")

    # Re-embed all titles with sentence-transformers
    print(f"\n  Re-embedding {len(all_articles)} article titles with MiniLM...")
    titles = [a.get('title_news') or '' for a in all_articles]
    st_embs = st_model.encode(titles, show_progress_bar=True, batch_size=64)
    st_embeddings = {}
    for art, emb in zip(all_articles, st_embs):
        st_embeddings[art['id']] = emb.tolist()
    print(f"  Done. Embedded {len(st_embeddings)} articles")

    # Analyze each user
    results = []
    for p in TEST_USERS:
        r = analyze_user(p, all_articles, st_embeddings)
        if r: results.append(r)

    # Final table
    print(f"\n\n{'='*130}")
    print("  FINAL RESULTS: Gemini 3072-dim vs MiniLM 384-dim")
    print(f"{'='*130}")
    print(f"{'User':<35s} | {'Gemini Prec':>11s} | {'MiniLM Prec':>11s} | {'Delta':>8s} | {'Gemini Gap':>10s} | {'MiniLM Gap':>10s} | {'G Iran':>6s} | {'M Iran':>6s}")
    print("-" * 130)
    for r in results:
        delta = r['st_precision'] - r['gemini_precision']
        print(f"{r['user']:<35s} | {r['gemini_precision']:>10.1f}% | {r['st_precision']:>10.1f}% | {delta:>+7.1f}% | {r['gemini_gap']:>+10.4f} | {r['st_gap']:>+10.4f} | {r['gemini_iran']:>4d}/20 | {r['st_iran']:>4d}/20")

    # Averages
    if results:
        avg_g_prec = np.mean([r['gemini_precision'] for r in results])
        avg_s_prec = np.mean([r['st_precision'] for r in results])
        avg_g_gap = np.mean([r['gemini_gap'] for r in results])
        avg_s_gap = np.mean([r['st_gap'] for r in results])
        avg_g_iran = np.mean([r['gemini_iran'] for r in results])
        avg_s_iran = np.mean([r['st_iran'] for r in results])
        print(f"\n  AVERAGES:")
        print(f"    Gemini: {avg_g_prec:.1f}% precision, gap={avg_g_gap:+.4f}, {avg_g_iran:.1f}/20 iran")
        print(f"    MiniLM: {avg_s_prec:.1f}% precision, gap={avg_s_gap:+.4f}, {avg_s_iran:.1f}/20 iran")
        print(f"    Delta:  {avg_s_prec-avg_g_prec:+.1f}% precision, gap improvement={avg_s_gap-avg_g_gap:+.4f}")

        print(f"\n  KEY FINDING:")
        if avg_s_gap > avg_g_gap:
            print(f"    MiniLM has {(avg_s_gap/avg_g_gap):.1f}x better topic discrimination (gap between relevant vs irrelevant)")
        else:
            print(f"    Gemini has {(avg_g_gap/avg_s_gap):.1f}x better topic discrimination")

        if avg_s_prec > avg_g_prec:
            print(f"    MiniLM produces {avg_s_prec-avg_g_prec:+.1f}% better feed precision")
        else:
            print(f"    Gemini produces {avg_g_prec-avg_s_prec:+.1f}% better feed precision")

    print(f"\n{'='*100}")
    print(f"  Analysis 2 complete: {now_utc().isoformat()}")
    print(f"{'='*100}")


if __name__ == '__main__':
    main()

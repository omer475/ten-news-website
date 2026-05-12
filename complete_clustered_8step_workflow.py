"""
COMPLETE 11-STEP NEWS WORKFLOW WITH CLUSTERING
===============================================

Step 0: RSS Feed Collection (287 sources)
Step 1: Gemini V8.2 Scoring & Filtering (score ≥70)
Step 1.5: Event Clustering (clusters similar articles)
Step 2: Bright Data Full Article Fetching (all sources in cluster)
Step 3: Smart Image Selection (selects best image from sources)
Step 4: Multi-Source Synthesis with Gemini Flash (generates article from all sources)
Step 6: Gemini Component Selection (decides which components article needs — cheap, no grounding)
Step 5: Gemini Context Search (Google Search grounding — ONLY if components need it, skipped otherwise)
Step 7: Gemini Component Generation (timeline, details, graph, map)
Step 8: Fact Verification (catches hallucinations, regenerates if needed)
Step 9: Publishing to Supabase
Step 10: Article Scoring (AI importance scoring 700-950)
Step 11: Article Tagging (countries + topics for personalization)
"""

import time
import re
import sys
from datetime import datetime, timedelta
import feedparser
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv
import warnings
import urllib3
from io import BytesIO
from PIL import Image

# Import all pipeline components
from rss_sources import ALL_SOURCES
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step1_5_event_clustering import EventClusteringEngine
from step2_brightdata_full_article_fetching import BrightDataArticleFetcher, fetch_articles_parallel
from step3_image_selection import select_best_image_for_cluster, ImageSelector
from image_quality_checker import ImageQualityChecker, check_and_select_best_image
# step4_multi_source_synthesis no longer used (was Claude-based, now using inline Gemini synthesis)
from step5_gemini_component_selection import GeminiComponentSelector
from step2_gemini_context_search import search_gemini_context
from step6_7_claude_component_generation import GeminiComponentWriter
from step8_fact_verification import FactVerifier
from step10_article_scoring import score_article_with_references, get_reference_articles, generate_interest_tags
from step11_article_tagging import tag_article
# Audit fix A6 (2026-05-06): re-enabled. Was disabled pre-launch; without
# it `article_world_events` was empty (~0% of articles), so Trinity v5's
# story-cluster dedup (Phase 1 fix #2) had nothing to dedup against and
# the cross-session 0.3× demote never fired. The detector adds ~0.5s
# Gemini latency per published article — for ~16 articles/cycle that's
# ~10s extra, well under the 30-min Cloud Run task timeout.
from step6_world_event_detection import detect_world_events
from supabase import create_client
import unicodedata

# ==========================================
# SUBTOPIC TAGGING — appends subtopic names to interest_tags
# so the feed can match user-selected subtopics directly
# ==========================================

SUBTOPIC_MAP = {
    'War & Conflict': ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'military conflict', 'military strikes', 'air strikes', 'bombing'],
    'US Politics': ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'republican party', 'supreme court', 'pentagon'],
    'European Politics': ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'germany', 'france', 'uk', 'hungary', 'spain'],
    'Asian Politics': ['asian politics', 'china', 'india', 'japan', 'southeast asia', 'asean', 'asia', 'north korea', 'south korea', 'taiwan'],
    'Middle East': ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz'],
    'Latin America': ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba'],
    'Africa & Oceania': ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'],
    'Human Rights & Civil Liberties': ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes'],
    'NFL': ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'running back'],
    'NBA': ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'dunk', 'playoffs'],
    'Soccer/Football': ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup'],
    'MLB/Baseball': ['mlb', 'baseball', 'world series', 'home run', 'pitcher'],
    'Cricket': ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'],
    'F1 & Motorsport': ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'],
    'Boxing & MMA/UFC': ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout'],
    'Olympics & Paralympics': ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc', 'olympic'],
    'Oil & Energy': ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'energy security', 'nuclear energy'],
    'Automotive': ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'],
    'Retail & Consumer': ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'],
    'Corporate Deals': ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'],
    'Trade & Tariffs': ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'],
    'Corporate Earnings': ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'],
    'Startups & Venture Capital': ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'],
    'Real Estate': ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'],
    'Movies & Film': ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars'],
    'TV & Streaming': ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'],
    'Music': ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce'],
    'Gaming': ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'],
    'Celebrity News': ['celebrity', 'famous', 'scandal', 'gossip', 'paparazzi', 'star', 'billionaire'],
    'K-Pop & K-Drama': ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'],
    'AI & Machine Learning': ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'],
    'Smartphones & Gadgets': ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'],
    'Social Media': ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta'],
    'Cybersecurity': ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'],
    'Space Tech': ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin', 'space exploration'],
    'Robotics & Hardware': ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor'],
    'Space & Astronomy': ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'],
    'Climate & Environment': ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'],
    'Biology & Nature': ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'],
    'Earth Science': ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'],
    'Medical Breakthroughs': ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery'],
    'Public Health': ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'],
    'Mental Health': ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'],
    'Pharma & Drug Industry': ['pharma', 'pharmaceutical', 'drug', 'fda', 'medication', 'biotech', 'pharmaceuticals'],
    'Stock Markets': ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading'],
    'Banking & Lending': ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'],
    'Commodities': ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'],
    'Bitcoin': ['bitcoin', 'btc', 'satoshi', 'mining', 'halving'],
    'DeFi & Web3': ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized'],
    'Crypto Regulation & Legal': ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'],
    'Pets & Animals': ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'],
    'Home & Garden': ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'],
    'Shopping & Product Reviews': ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'],
    'Sneakers & Streetwear': ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'],
    'Celebrity Style & Red Carpet': ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'],
}

# ==========================================
# TYPED ENTITY SIGNALS — structured entity IDs for feed personalization
# Each signal is prefixed: org:openai, person:jannik_sinner, loc:turkiye
# Category-level words are blocked — they belong in the diversity system
# ==========================================

SIGNAL_CATEGORY_BLOCKLIST = {
    'tech', 'technology', 'science', 'world', 'politics', 'sports',
    'entertainment', 'business', 'health', 'lifestyle', 'finance',
    'news', 'breaking', 'opinion', 'culture', 'education',
}

# Stopword-level tokens Gemini sometimes emits as topics. These get extracted
# from verbs/prepositions/adjectives in headlines (e.g. "Darfur FACES Famine
# AMID Ethnic Cleansing" yielding topic:faces / topic:amid / topic:ethnic).
# Keep this tight — only truly meaningless-on-their-own tokens.
TOPIC_STOPWORDS = {
    # prepositions / conjunctions
    'faces', 'amid', 'after', 'before', 'during', 'against', 'between',
    'through', 'without', 'within', 'across', 'amongst', 'under', 'over',
    'into', 'onto', 'upon', 'beyond', 'among',
    # auxiliaries / common verbs
    'has', 'have', 'had', 'was', 'were', 'been', 'being', 'does', 'did',
    'are', 'is', 'be', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'can', 'shall',
    # function words
    'the', 'and', 'but', 'or', 'for', 'nor', 'yet', 'so',
    # common adjectives that carry no topical meaning alone
    'new', 'old', 'big', 'small', 'first', 'last', 'next', 'prev',
    'major', 'minor', 'high', 'low', 'long', 'short',
    # bare fragments often emitted by NER truncation
    'ethnic', 'global', 'local', 'national', 'international',
    'public', 'private', 'modern', 'ancient',
}


def _is_valid_topic(slug: str) -> bool:
    """Reject stopwords and too-generic single-word topics."""
    if slug in TOPIC_STOPWORDS:
        return False
    if len(slug) < 4:
        return False
    # Single short words are usually noise. Multi-word (contains _) is fine.
    if '_' not in slug and len(slug) < 6:
        return False
    return True

def _slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
    return s

def extract_named_entities_via_gemini(title, bullets, gemini_model_ref, gemini_semaphore_ref):
    """Use Gemini to extract structured named entities from article text."""
    bullet_text = ' | '.join(bullets) if isinstance(bullets, list) else str(bullets)
    prompt = f"""Extract named entities from this news article. Return ONLY valid JSON, no markdown.

Title: {title}
Content: {bullet_text}

Return JSON with these arrays (empty array if none found):
{{
  "organizations": [],
  "people": [],
  "events": [],
  "products": [],
  "countries": [],
  "cities": [],
  "narrow_topics": []
}}

Rules:
- organizations: companies, agencies, sports teams, political parties
- people: full names only (e.g. "Jannik Sinner", not "Sinner")
- events: named events like "World Cup 2026", "Artemis II", "Monte-Carlo Masters"
- products: product/franchise names like "iPhone 17", "Spider-Man 3", "GTA 6"
- countries: ALWAYS infer the article's country/countries even when not
  named explicitly. Examples:
    "Indian Minister Sudhakar lung transplant" → ["India"]
    "Chennai stock exchange falls" → ["India"]
    "Bundestag passes climate bill" → ["Germany"]
    "SCOTUS hears case in DC" → ["USA"]
  Use full English country names (not ISO codes). If the article is
  truly multi-country (a treaty, a global summit), list each. If
  unambiguously global with no country anchor, leave empty.
- cities: city-level locations mentioned
- narrow_topics: 2-5 multi-word concepts or compound terms (e.g. "geopolitical_tensions",
  "brain_hologram", "class_action_lawsuit", "quantum_computing"). NEVER single common
  English words like "faces", "amid", "ethnic", "after", "new", "economy", "global".
  Must be a specific concept, not a generic word or stopword. If the concept can't be
  expressed in 2+ words, omit it entirely.
"""
    try:
        import json as _ner_json
        with gemini_semaphore_ref:
            response = gemini_model_ref.generate_content(prompt)
        text = response.text.strip()
        if text.startswith('```'): text = text.split('\n', 1)[1] if '\n' in text else text[3:]
        if text.endswith('```'): text = text[:-3]
        if text.startswith('json'): text = text[4:]
        return _ner_json.loads(text.strip())
    except Exception as e:
        print(f"   ⚠️ NER extraction failed: {e}")
        return {}

def build_typed_signals(article_countries, interest_tags, ner_result=None, language='en',
                        category=None, article_topics=None):
    """Build typed entity signals from article metadata + NER results.

    Emits a 3-level hierarchy (Phase A — feed v11, see plan
    /Users/omersogancioglu/.claude/plans/harmonic-napping-melody.md):
      L0 root  — `cat:<Category>` (Tech, Politics, Sports, ...)
      L1 topic — `topic:<topic>`  (the article's own topics[] array)
      L2 entity — `topic:<tag>` from interest_tags + org/person/event/product/loc/lang

    Source: Douyin algorithm disclosure 2025 — engagement signals
    propagate at every granularity simultaneously. Without the L0/L1
    layers a user's category-wide preference (e.g. heavy entertainment
    skipping) cannot accumulate into a learnable signal because each
    individual entity tag stays below the confidence floor.

    A slug emitted under a specific type (org/person/event/product) is NOT
    re-emitted as `topic:<slug>`. This prevents double-counting in the
    multiplier's denominator (see feed/main.js entitySignalMultiplier).
    """
    signals = []
    seen = set()
    seen_slugs_specific = set()  # slugs emitted under org/person/event/product

    def add(signal_type: str, value: str):
        slug = _slugify(value)
        if not slug or slug in SIGNAL_CATEGORY_BLOCKLIST or len(slug) > 64:
            return
        # Topics get an extra stopword/quality filter — org/person/event/product
        # come from NER name lists which are noun-phrases by construction.
        if signal_type == 'topic' and not _is_valid_topic(slug):
            return
        sig = f"{signal_type}:{slug}"
        if sig in seen:
            return
        if signal_type == 'topic' and slug in seen_slugs_specific:
            return  # already emitted as org/person/event/product — skip
        seen.add(sig)
        if signal_type in ('org', 'person', 'event', 'product'):
            seen_slugs_specific.add(slug)
        signals.append(sig)

    # Specific types first — so the topic-dedup set is populated before topics run
    for org in (ner_result or {}).get('organizations', []) or []:
        add('org', org)
    for person in (ner_result or {}).get('people', []) or []:
        add('person', person)
    for event in (ner_result or {}).get('events', []) or []:
        add('event', event)
    for product in (ner_result or {}).get('products', []) or []:
        add('product', product)

    # Locations: countries + NER cities (loc: is not deduped against topic: on purpose —
    # a country can legitimately also be a topic in an article about that country)
    #
    # Country sources, in order:
    #   1. article_countries — from step 11 tag_article (TAGGING_PROMPT_V1).
    #      Heavyweight; can fail and leave article without any country.
    #   2. ner_result.countries — NEW (feed v11 follow-up, 2026-04-27). NER
    #      now infers country from context even when not named explicitly,
    #      so an article about an Indian government minister picks up
    #      `loc:india` even if the body doesn't say "India" by name. Closes
    #      the 2026-04-26 session bug where loc:india was missing on slot 10
    #      page 1, letting the loc:india hard veto silently miss.
    for country in (article_countries or []):
        add('loc', country)
    for country in (ner_result or {}).get('countries', []) or []:
        add('loc', country)
    for city in (ner_result or {}).get('cities', []) or []:
        add('loc', city)

    add('lang', language)

    # L0 — root category (Tech, Politics, Sports, ...). One per article.
    # Enables category-wide engagement learning that narrow tags can't reach.
    if category:
        add('cat', category)

    # L1 — article's own topics[] array (ai, conflicts, entertainment, ...).
    # Previously this array was written to published_articles.topics but
    # never propagated into typed_signals — leaving the macro-topic level
    # blind. Article-tagged topics already pass step10's quality check.
    if article_topics:
        for t in article_topics:
            if isinstance(t, str) and t:
                add('topic', t)

    # L2 — interest_tags (existing behaviour, preserved verbatim).
    #
    # Phase 9.3 (2026-04-24): stopped routing NER `narrow_topics` into
    # typed_signals. Audit on 2026-04-24 found that 75 % of distinct
    # `topic:*` strings in the 14-day corpus (31 681 of 42 142) appeared
    # exactly once — Gemini was being instructed by the NER prompt to
    # produce "2-5 multi-word concepts or compound terms" (e.g.
    # `topic:subscription_revenue_guidance`, `topic:ai_product_sales`),
    # which means every engagement dropped 60-80 % of its signal into
    # dead one-shot keys that never match a future article.
    #
    # `interest_tags` (from step10 INTEREST_TAGS_PROMPT) are priority-
    # ordered 1-4 word entity/topic tags drawn mostly from an implicit
    # closed vocabulary — soccer, basketball, donald_trump, premier_league,
    # artificial_intelligence etc. — and they repeat across articles.
    # That's the path we keep. The NER response still carries
    # narrow_topics but we ignore them here.
    for tag in (interest_tags or []):
        add('topic', tag)

    return signals


# ==========================================
# STEP 12: Trinity (KDD 2024) v2 two-level cluster assignment.
# Reads the active codebook from vq_codebooks (header) + vq_centroids
# (per-centroid pgvector rows), cached in-process for 5 min, and projects
# each new article's MiniLM embedding into (vq_primary, vq_secondary).
# Hierarchical k-means: 256 primary x 8 sub = 2048 secondary.
# vq_secondary = vq_primary * 8 + nearest sub-cluster index within that primary.
# ==========================================

_VQ_CODEBOOK_CACHE = {'ts': 0, 'codebook': None}
_VQ_CACHE_TTL_S = 300

def _l2_normalize(vec):
    import numpy as np
    a = np.asarray(vec, dtype=np.float32)
    n = float(np.linalg.norm(a))
    if n == 0.0:
        return a
    return a / n

def _load_active_codebook(supabase_client):
    import time as _t
    now = _t.time()
    if _VQ_CODEBOOK_CACHE['codebook'] and (now - _VQ_CODEBOOK_CACHE['ts']) < _VQ_CACHE_TTL_S:
        return _VQ_CODEBOOK_CACHE['codebook']
    try:
        # Header
        resp = (supabase_client.table('vq_codebooks')
                .select('id, version, parent_map, dim')
                .eq('is_active', True)
                .order('trained_at', desc=True)
                .limit(1)
                .execute())
        rows = resp.data or []
        if not rows:
            print("   ⚠️ [Trinity Step 12] FAIL_REASON=no_active_codebook (vq_codebooks has no is_active=true row)")
            return None
        import numpy as np
        cb = rows[0]
        codebook_id = cb['id']
        dim = cb['dim']
        # Centroids (one row per).
        # supabase-py defaults to a 1000-row PostgREST pagination cap,
        # but the codebook has 256 L1 + 2048 L2 = 2304 rows. A naive
        # query silently truncates to 1000 (256 L1 + 744 L2), producing
        # l2 of shape (744, dim) instead of (2048, dim). For any article
        # whose L1 code projects to vq_primary ≥ 93 (~64% of the
        # codebook), the L2 sub-residual slice base..base+8 falls past
        # 744 and `argmin` raises "empty sequence" — exact ROOT CAUSE of
        # the silent stamping failure that started 2026-05-01.
        cent_rows = []
        _page_size = 1000
        _offset = 0
        while True:
            cent_resp = (supabase_client.table('vq_centroids')
                         .select('level, idx, vec')
                         .eq('codebook_id', codebook_id)
                         .range(_offset, _offset + _page_size - 1)
                         .execute())
            _page = cent_resp.data or []
            cent_rows.extend(_page)
            if len(_page) < _page_size:
                break
            _offset += _page_size
        if not cent_rows:
            print(f"   ⚠️ [Trinity Step 12] FAIL_REASON=no_centroids codebook_id={codebook_id} version={cb.get('version')}")
            return None

        def _parse_vec(v):
            if isinstance(v, list):
                return v
            s = str(v).strip().lstrip('[').rstrip(']')
            return [float(x) for x in s.split(',')] if s else []

        l1_rows = [r for r in cent_rows if r['level'] == 1]
        l2_rows = [r for r in cent_rows if r['level'] == 2]
        l1_size = max((r['idx'] for r in l1_rows), default=-1) + 1
        l2_size = max((r['idx'] for r in l2_rows), default=-1) + 1
        if l1_size == 0 or l2_size == 0:
            print(f"   ⚠️ [Trinity Step 12] FAIL_REASON=empty_centroid_levels codebook_id={codebook_id} l1_rows={len(l1_rows)} l2_rows={len(l2_rows)}")
            return None
        l1 = np.zeros((l1_size, dim), dtype=np.float32)
        l2 = np.zeros((l2_size, dim), dtype=np.float32)
        for r in l1_rows:
            l1[r['idx']] = _parse_vec(r['vec'])
        for r in l2_rows:
            l2[r['idx']] = _parse_vec(r['vec'])
        cooked = {
            'id': codebook_id,
            'version': cb['version'],
            'l1': l1,
            'l2': l2,
            'parent_map': cb['parent_map'],
            'dim': dim,
        }
        _VQ_CODEBOOK_CACHE['ts'] = now
        _VQ_CODEBOOK_CACHE['codebook'] = cooked
        print(f"   ✓ [Trinity Step 12] codebook loaded id={codebook_id} version={cb.get('version')} dim={dim} l1={l1_size} l2={l2_size}")
        return cooked
    except Exception as e:
        import traceback
        print(f"   ⚠️ [Trinity Step 12] FAIL_REASON=codebook_fetch_exception type={type(e).__name__} msg={e}")
        traceback.print_exc()
        return None

def assign_vq_clusters(embedding_minilm, supabase_client):
    """Project a 384-d MiniLM embedding into (vq_primary, vq_secondary)."""
    if embedding_minilm is None:
        print("   ⚠️ [Trinity Step 12] FAIL_REASON=null_embedding")
        return None, None
    cb = _load_active_codebook(supabase_client)
    if cb is None:
        # _load_active_codebook already logged the specific reason
        return None, None
    try:
        import numpy as np
        v = _l2_normalize(embedding_minilm)
        if v.shape[0] != cb['dim']:
            print(f"   ⚠️ [Trinity Step 12] FAIL_REASON=dim_mismatch input_dim={v.shape[0]} codebook_dim={cb['dim']}")
            return None, None
        # Level 1: nearest centroid
        d1 = np.linalg.norm(cb['l1'] - v[None, :], axis=1)
        c1 = int(np.argmin(d1))
        # Level 2: nearest residual within this c1's 8 sub-slots
        residual = v - cb['l1'][c1]
        SUBCODEBOOK_K = 8
        base = c1 * SUBCODEBOOK_K
        sub_residuals = cb['l2'][base : base + SUBCODEBOOK_K]
        d2 = np.linalg.norm(sub_residuals - residual[None, :], axis=1)
        local = int(np.argmin(d2))
        c2 = base + local
        return c1, c2
    except Exception as e:
        import traceback
        print(f"   ⚠️ [Trinity Step 12] FAIL_REASON=projection_exception type={type(e).__name__} msg={e}")
        traceback.print_exc()
        return None, None


# Audit fix F-4 (2026-05-06): Category whitelist enforcement.
# Gemini's category prompt declares 14 valid values but it free-forms 67+
# variants in practice ('Tech' vs 'Technology', 'Art' vs 'Arts' vs 'Arts &
# Culture', 'Law' vs 'Law & Justice', 'U.S' vs 'U.S.' vs 'US' etc.). Each
# variant fragments the user's category-level engagement signal. Map any
# non-canonical input to the closest match, defaulting to 'Other'.
CANONICAL_CATEGORIES = {
    'Tech', 'Business', 'Science', 'Politics', 'Finance', 'Crypto', 'Health',
    'Entertainment', 'Sports', 'World', 'Food', 'Fashion', 'Travel', 'Lifestyle',
}
_CATEGORY_ALIASES = {
    'technology': 'Tech', 'tech': 'Tech', 'ai': 'Tech', 'gadgets': 'Tech',
    'art': 'Entertainment', 'arts': 'Entertainment', 'arts & culture': 'Entertainment',
    'art|culture': 'Entertainment', 'culture': 'Entertainment', 'music': 'Entertainment',
    'movies': 'Entertainment', 'film': 'Entertainment', 'tv': 'Entertainment',
    'royals': 'Entertainment', 'royalty': 'Entertainment', 'celebrity': 'Entertainment',
    'business news': 'Business', 'economics': 'Business', 'economy': 'Business',
    'real estate': 'Business', 'startups': 'Business',
    'law': 'Politics', 'law & justice': 'Politics', 'law and justice': 'Politics',
    'government': 'Politics', 'us politics': 'Politics', 'world politics': 'World',
    'u.s': 'World', 'u.s.': 'World', 'us': 'World', 'usa': 'World', 'world news': 'World',
    'international': 'World', 'global': 'World',
    'wellness': 'Health', 'fitness': 'Health', 'medicine': 'Health',
    'esports': 'Sports', 'football': 'Sports', 'basketball': 'Sports', 'soccer': 'Sports',
    'cooking': 'Food', 'recipes': 'Food', 'cuisine': 'Food', 'restaurants': 'Food',
    'investing': 'Finance', 'crypto news': 'Crypto', 'bitcoin': 'Crypto',
    'science news': 'Science', 'space': 'Science', 'climate': 'Science',
    'environment': 'Science', 'nature': 'Science',
    'photo': 'Lifestyle', 'obituaries': 'Lifestyle', 'city': 'World', 'nsw': 'World',
}

def canonicalize_category(raw):
    """Map any LLM-generated category string to the closed taxonomy."""
    if not raw or not isinstance(raw, str):
        return 'Other'
    cleaned = raw.strip()
    # Already canonical?
    if cleaned in CANONICAL_CATEGORIES:
        return cleaned
    # Case-insensitive canonical match
    for c in CANONICAL_CATEGORIES:
        if cleaned.lower() == c.lower():
            return c
    # Alias lookup (lowercased)
    alias = _CATEGORY_ALIASES.get(cleaned.lower())
    if alias:
        return alias
    # Pipe / ampersand split — take first segment
    for sep in ('|', '&', '/', ','):
        if sep in cleaned:
            first = cleaned.split(sep, 1)[0].strip()
            if first.lower() in (c.lower() for c in CANONICAL_CATEGORIES):
                return next(c for c in CANONICAL_CATEGORIES if c.lower() == first.lower())
            alias2 = _CATEGORY_ALIASES.get(first.lower())
            if alias2:
                return alias2
    print(f"   ⚠️ [F-4] category fallback: {raw!r} → 'Other'")
    return 'Other'


# Audit fix F4 (2026-05-06): expected_read_seconds at insert time.
# 71,907 of 93,880 articles in the DB had this column NULL because nothing
# wrote it. Trinity's qualifying gate, dwell-aware ranking, and the iOS
# read-ratio classifier all depend on it. Compute once at insert (cheap)
# instead of recomputing per-event downstream.
def compute_expected_read_seconds(title, bullets):
    """Words / 3.83 words-per-sec (~230 WPM mobile reading rate).
    Mirrors lib/readingTime.js expectedReadSeconds(). Min 5s, max 600s.

    Returns INTEGER seconds — the DB column is `integer`, not `numeric`.
    Earlier commit 6f1bbd47 ('round expected_read_seconds to int') was
    supposed to enforce this but never landed in this function. Without
    the int() cast, every published_articles insert in the s8xzq run
    failed with `invalid input syntax for type integer: "8.348552..."`
    on 2026-05-09, blocking 20 synthesized articles from reaching the DB.
    """
    text = (title or '') + ' '
    if isinstance(bullets, list):
        text += ' '.join(b for b in bullets if isinstance(b, str))
    elif isinstance(bullets, str):
        text += bullets
    word_count = len([w for w in text.split() if w.strip()])
    seconds = word_count / 3.833
    return int(round(max(5.0, min(600.0, seconds))))


def enrich_with_subtopics(interest_tags, title):
    """Append matching subtopic names to interest_tags list."""
    if not interest_tags:
        interest_tags = []
    tag_set = set(t.lower() for t in interest_tags)
    title_lower = (title or '').lower()
    for subtopic, keywords in SUBTOPIC_MAP.items():
        if subtopic.lower() not in tag_set:
            if any(kw in tag_set or kw in title_lower for kw in keywords):
                interest_tags.append(subtopic)
    return interest_tags


def match_publisher(interest_tags, category, publishers_cache, article_id=0):
    """Always assign a publisher. Tier 1: tag overlap. Tier 2: category round-robin. Tier 3: any publisher."""
    if not publishers_cache:
        return None, None

    article_tags = set(t.lower() for t in (interest_tags or []))
    cat_lower = (category or '').lower()

    # Tier 1: best tag overlap (with category bonus)
    best_pub = None
    best_score = 0
    for pub in publishers_cache:
        pub_tags = set(t.lower() for t in (pub.get('interest_tags') or []))
        overlap = len(article_tags & pub_tags)
        score = overlap
        if pub.get('category', '').lower() == cat_lower:
            score += 2
        if score > best_score:
            best_score = score
            best_pub = pub

    if best_score >= 3 and best_pub:
        return best_pub['id'], best_pub['display_name']

    # Tier 2: round-robin within same category
    cat_pubs = [p for p in publishers_cache if p.get('category', '').lower() == cat_lower]
    if cat_pubs:
        cat_pubs.sort(key=lambda p: p['id'])
        pick = cat_pubs[article_id % len(cat_pubs)]
        return pick['id'], pick['display_name']

    # Tier 3: any publisher (round-robin across all)
    sorted_all = sorted(publishers_cache, key=lambda p: p['id'])
    pick = sorted_all[article_id % len(sorted_all)]
    return pick['id'], pick['display_name']

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Load environment
load_dotenv()

# ============================================================================
# CLUSTER STATUS TRACKING HELPERS
# ============================================================================

def get_supabase_client():
    """Get Supabase client for status updates"""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    return create_client(url, key)

def update_cluster_status(cluster_id: int, status: str, failure_reason: str = None, 
                          failure_details: str = None, increment_attempt: bool = True):
    """
    Update cluster publish_status and tracking fields.
    
    Args:
        cluster_id: The cluster ID
        status: 'pending', 'processing', 'published', 'failed', 'skipped'
        failure_reason: 'no_content', 'no_image', 'synthesis_failed', 
                       'verification_failed', 'duplicate', 'api_error'
        failure_details: Detailed error message
        increment_attempt: Whether to increment attempt_count
    """
    try:
        supabase = get_supabase_client()
        now = datetime.now().isoformat()
        
        # Build update data
        update_data = {
            'publish_status': status,
            'last_attempt_at': now
        }
        
        if failure_reason:
            update_data['failure_reason'] = failure_reason
        if failure_details:
            update_data['failure_details'] = failure_details[:500]  # Limit length
        
        # Get current cluster data for history tracking
        current = supabase.table('clusters').select('attempt_count, first_attempt_at, attempt_history').eq('id', cluster_id).execute()
        
        if current.data:
            cluster_data = current.data[0]
            current_attempt = cluster_data.get('attempt_count') or 0
            
            # Set first_attempt_at if this is the first attempt
            if not cluster_data.get('first_attempt_at'):
                update_data['first_attempt_at'] = now
            
            # Increment attempt count
            if increment_attempt:
                update_data['attempt_count'] = current_attempt + 1
            
            # Track if this is a recovery (previously failed, now published)
            if status == 'published' and current_attempt > 0:
                update_data['recovered'] = True
                update_data['attempts_before_success'] = current_attempt + 1
            
            # Add to attempt history
            history = cluster_data.get('attempt_history') or []
            history_entry = {
                'attempt': current_attempt + 1,
                'at': now,
                'status': status,
                'reason': failure_reason
            }
            history.append(history_entry)
            update_data['attempt_history'] = history
        
        # Update the cluster
        supabase.table('clusters').update(update_data).eq('id', cluster_id).execute()
        
    except Exception as e:
        print(f"   ⚠️ Could not update cluster status: {e}")

def update_source_article_status(source_id: int, content_fetched: bool = None, 
                                  fetch_failure_reason: str = None,
                                  has_image: bool = None, image_quality_score: float = None):
    """
    Update source article tracking fields.
    
    Args:
        source_id: The source article ID
        content_fetched: Whether Bright Data successfully fetched content
        fetch_failure_reason: 'blocked', 'timeout', 'paywall', 'not_found', 'parse_error'
        has_image: Whether the source has a usable image
        image_quality_score: Image quality score from selection
    """
    try:
        supabase = get_supabase_client()
        
        update_data = {}
        if content_fetched is not None:
            update_data['content_fetched'] = content_fetched
        if fetch_failure_reason:
            update_data['fetch_failure_reason'] = fetch_failure_reason
        if has_image is not None:
            update_data['has_image'] = has_image
        if image_quality_score is not None:
            update_data['image_quality_score'] = image_quality_score
        
        if update_data:
            supabase.table('source_articles').update(update_data).eq('id', source_id).execute()
            
    except Exception as e:
        print(f"   ⚠️ Could not update source article status: {e}")

def update_source_reliability(source_domain: str, success: bool, failure_reason: str = None):
    """
    Track source domain reliability for analytics.
    
    Args:
        source_domain: The domain (e.g., 'bbc.com', 'reuters.com')
        success: Whether the fetch was successful
        failure_reason: Why it failed (if applicable)
    """
    try:
        supabase = get_supabase_client()
        now = datetime.now().isoformat()
        
        # Check if domain exists
        existing = supabase.table('source_reliability').select('*').eq('source_domain', source_domain).execute()
        
        if existing.data:
            # Update existing record
            record = existing.data[0]
            update_data = {
                'total_attempts': (record.get('total_attempts') or 0) + 1,
                'last_attempt_at': now
            }
            if success:
                update_data['successful_fetches'] = (record.get('successful_fetches') or 0) + 1
                update_data['last_success_at'] = now
            else:
                update_data['failed_fetches'] = (record.get('failed_fetches') or 0) + 1
                if failure_reason:
                    update_data['common_failure_reason'] = failure_reason
            
            supabase.table('source_reliability').update(update_data).eq('id', record['id']).execute()
        else:
            # Create new record
            insert_data = {
                'source_domain': source_domain,
                'total_attempts': 1,
                'successful_fetches': 1 if success else 0,
                'failed_fetches': 0 if success else 1,
                'first_seen_at': now,
                'last_attempt_at': now,
                'common_failure_reason': failure_reason if not success else None
            }
            if success:
                insert_data['last_success_at'] = now
            
            supabase.table('source_reliability').insert(insert_data).execute()
            
    except Exception as e:
        # Don't fail the pipeline for analytics errors
        pass

def extract_domain(url: str) -> str:
    """Extract domain from URL for reliability tracking"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except:
        return 'unknown'

# ============================================================================
# PRE-SYNTHESIS CLUSTER VALIDATION (Step 3.5)
# ============================================================================

def validate_cluster_sources(sources: List[Dict], cluster_name: str = "") -> List[Dict]:
    """
    Validate that all sources in a cluster are about the SAME event before synthesis.
    
    This prevents the issue where unrelated articles get clustered together due to:
    - Loose embedding matches
    - Keyword similarity (e.g., "trump" in "trump card")
    - Same category but different stories
    
    Args:
        sources: List of source articles in the cluster
        cluster_name: Name of the cluster for logging
        
    Returns:
        List of validated sources (outliers removed)
    """
    import google.generativeai as genai
    
    # Skip validation for single-source clusters
    if len(sources) <= 1:
        return sources
    
    # Skip validation for 2-source clusters (assume embedding match is correct)
    if len(sources) == 2:
        return sources
    
    print(f"   🔍 VALIDATING {len(sources)} sources for cluster: {cluster_name[:50]}...")
    
    try:
        # Configure Gemini
        gemini_key = os.getenv('GEMINI_API_KEY')
        if not gemini_key:
            print(f"      ⚠️ No Gemini key - skipping validation")
            return sources
        
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        
        # Build source list for AI
        sources_text = ""
        for i, source in enumerate(sources):
            title = source.get('title', 'Unknown')
            source_name = source.get('source_name', 'Unknown')
            sources_text += f"{i+1}. [{source_name}] {title}\n"
        
        prompt = f"""You are validating a news cluster. Check if ALL these articles are about the SAME SPECIFIC EVENT.

CLUSTER NAME: {cluster_name}

ARTICLES IN CLUSTER:
{sources_text}

TASK: Identify any articles that are about a DIFFERENT event/topic than the majority.

SAME EVENT examples (should be KEPT):
- "Mall fire kills 50" and "Mall fire death toll rises" = SAME (keep both)
- "Trump threatens tariffs" and "Europe reacts to Trump tariffs" = SAME (keep both)

DIFFERENT EVENT examples (should be REMOVED):
- "Trump threatens tariffs" mixed with "India's trump card in manufacturing" = DIFFERENT (word match error)
- "Apple iPhone launch" mixed with "Apple faces antitrust lawsuit" = DIFFERENT (same company, different stories)
- "Research paper about tumor cells" mixed with "Breaking news about hospital fire" = DIFFERENT (scientific journal mixed with news)

Respond with ONLY the numbers of articles to REMOVE (outliers that don't belong).
If ALL articles belong together, respond with: NONE

Format: REMOVE: 3, 5, 7
Or: NONE

Your response:"""

        response = model.generate_content(prompt)
        result_text = response.text.strip().upper()
        
        # Parse response
        if "NONE" in result_text or "ALL" in result_text or not result_text:
            print(f"      ✅ All {len(sources)} sources validated - same event")
            return sources
        
        # Extract article numbers to remove
        import re
        numbers_match = re.findall(r'\d+', result_text)
        to_remove = set()
        
        for num_str in numbers_match:
            try:
                idx = int(num_str) - 1  # Convert to 0-indexed
                if 0 <= idx < len(sources):
                    to_remove.add(idx)
            except ValueError:
                continue
        
        if not to_remove:
            print(f"      ✅ All {len(sources)} sources validated - same event")
            return sources
        
        # Remove outliers
        validated_sources = []
        removed_sources = []
        
        for i, source in enumerate(sources):
            if i in to_remove:
                removed_sources.append(source)
            else:
                validated_sources.append(source)
        
        # Log what was removed
        print(f"      ⚠️ REMOVED {len(removed_sources)} unrelated sources:")
        for source in removed_sources:
            print(f"         ❌ [{source.get('source_name', 'Unknown')}] {source.get('title', 'Unknown')[:60]}...")
        
        print(f"      ✅ Keeping {len(validated_sources)} validated sources")
        
        # Safety: Never remove all sources
        if not validated_sources:
            print(f"      ⚠️ Validation removed all sources - keeping original")
            return sources
        
        return validated_sources
        
    except Exception as e:
        print(f"      ⚠️ Validation error: {e} - keeping all sources")
        return sources

# ============================================================================
# IMPROVED IMAGE EXTRACTION (Step 0)
# ============================================================================
# Regex to extract src from <img> tags in HTML content
IMG_TAG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

# Sources that need special image handling
# Guardian: Select highest width from RSS media:content
# BBC/DW: Need Bright Data scraping for og:image (handled in Step 2)
SOURCES_NEEDING_OG_IMAGE_SCRAPE = [
    'feeds.bbci.co.uk',
    'bbc.co.uk',
    'bbc.com',
    'rss.dw.com',
    'dw.com',
    'venturebeat.com',
    'venturebeat',
    'cbc.ca',           # CBC Canada - needs og:image scraping
    'lemonde.fr',       # Le Monde - needs og:image scraping
    'straitstimes.com', # The Straits Times - needs og:image scraping
]

def extract_image_url(entry, source_url: str = None) -> Optional[str]:
    """
    Extract the best image URL from an RSS feed entry.
    
    Special handling:
    - Guardian: Select width=700 from media:content (highest quality available)
    - BBC/DW: Returns low-quality RSS image; will be replaced with og:image in Step 2
    
    Priority order:
    1. media:content - choose largest image by WIDTH (for Guardian) or AREA
    2. media:thumbnail - first URL
    3. enclosures - only image/* types
    4. links - image/* types or rel="enclosure"
    5. HTML fallback - <img> tags in content/summary/description
    
    Args:
        entry: A feedparser entry object
        source_url: The RSS feed URL (to detect source type)
        
    Returns:
        Image URL string or None if no image found
    """
    
    # Check if this is Guardian - they provide multiple sizes, select width=700
    is_guardian = source_url and 'theguardian.com' in source_url
    
    # 1) media:content – choose the "best" candidate
    # For Guardian: prioritize by width (select 700px version)
    # For others: prioritize by area (width * height)
    media_content = getattr(entry, 'media_content', None)
    if media_content:
        best = None
        best_score = 0
        
        for m in media_content:
            url = m.get('url')
            if not url:
                continue

            mtype = m.get('type', '')
            # Skip non-image types (but allow empty type as it might still be image)
            if mtype and not mtype.startswith('image/'):
                continue

            try:
                w = int(m.get('width') or 0)
                h = int(m.get('height') or 0)
            except (ValueError, TypeError):
                w, h = 0, 0
            
            # For Guardian: score by width (prefer 700px)
            # For others: score by area
            if is_guardian:
                score = w  # Just use width as score
            else:
                score = w * h

            # Prefer higher scoring images, or take first valid one if no dimensions
            if score > best_score or (best is None and score == 0):
                best_score = score
                best = url

        if best:
            return best

    # 2) media:thumbnail - take first URL
    media_thumb = getattr(entry, 'media_thumbnail', None)
    if media_thumb:
        for t in media_thumb:
            url = t.get('url')
            if url:
                return url

    # 3) enclosures with image/* type
    enclosures = getattr(entry, 'enclosures', None)
    if enclosures:
        for enc in enclosures:
            mtype = enc.get('type', '')
            if mtype.startswith('image/'):
                url = enc.get('href') or enc.get('url')
                if url:
                    return url

    # 4) links with image/* type or rel="enclosure"
    links = getattr(entry, 'links', None)
    if links:
        for link in links:
            ltype = link.get('type', '')
            if ltype.startswith('image/') or link.get('rel') == 'enclosure':
                url = link.get('href')
                if url:
                    return url

    # 5) HTML fallback: <img src="..."> in content/summary/description
    html_candidates = []

    # Check entry.content (list of content blocks)
    if hasattr(entry, 'content'):
        for c in entry.content:
            val = c.get('value') if isinstance(c, dict) else None
            if val:
                html_candidates.append(val)

    # Check entry.summary
    if hasattr(entry, 'summary') and entry.summary:
        html_candidates.append(entry.summary)

    # Check entry.description
    if hasattr(entry, 'description') and entry.description:
        html_candidates.append(entry.description)

    for html in html_candidates:
        if not html:
            continue
        match = IMG_TAG_RE.search(html)
        if match:
            img_url = match.group(1)
            # Handle protocol-relative URLs
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            return img_url

    # 6) Nothing found
    return None


def needs_og_image_scrape(source_url: str) -> bool:
    """Check if this source needs og:image scraping from article page."""
    if not source_url:
        return False
    return any(domain in source_url.lower() for domain in SOURCES_NEEDING_OG_IMAGE_SCRAPE)

# Initialize clients
def get_supabase_client():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)

supabase = get_supabase_client()
clustering_engine = EventClusteringEngine()

# Get API keys
gemini_key = os.getenv('GEMINI_API_KEY')
brightdata_key = os.getenv('BRIGHTDATA_API_KEY')

if not all([gemini_key, brightdata_key]):
    raise ValueError("Missing required API keys in .env file (GEMINI_API_KEY, BRIGHTDATA_API_KEY)")

# Initialize Bright Data fetcher
brightdata_fetcher = BrightDataArticleFetcher(api_key=brightdata_key)

component_selector = GeminiComponentSelector(api_key=gemini_key)
component_writer = GeminiComponentWriter(api_key=gemini_key)  # Using Gemini (Claude API limit reached)
fact_verifier = FactVerifier(api_key=gemini_key)  # Using Gemini (Claude API limit reached)

# Load publisher accounts for article assignment
publishers_cache = []
try:
    _pub_result = supabase.table('publishers').select('id, display_name, category, interest_tags').execute()
    publishers_cache = _pub_result.data or []
    print(f"📢 Loaded {len(publishers_cache)} publishers for article assignment")
except Exception as _pub_err:
    print(f"⚠️ Could not load publishers (will skip assignment): {_pub_err}")


# ==========================================
# STEP 0: RSS FEED COLLECTION
# ==========================================

def normalize_url(url):
    """Normalize URL for duplicate detection"""
    from urllib.parse import urlparse, parse_qs, urlunparse
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    tracking_params = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'source', 'fbclid', 'gclid', '_ga', 'mc_cid', 'mc_eid'
    ]
    query_params = parse_qs(parsed.query)
    clean_params = {k: v for k, v in query_params.items() if k not in tracking_params}
    clean_query = '&'.join([f"{k}={v[0]}" for k, v in clean_params.items()])
    normalized = urlunparse((parsed.scheme, domain, parsed.path, parsed.params, clean_query, ''))
    return normalized

def fetch_rss_articles(max_articles_per_source=10):
    """Step 0: Fetch NEW articles from 171 RSS sources with deduplication"""
    from article_deduplication import get_new_articles_only, mark_article_as_processed
    
    print(f"\n{'='*80}")
    print(f"📡 STEP 0: RSS FEED COLLECTION")
    print(f"{'='*80}")
    print(f"Fetching from {len(ALL_SOURCES)} premium sources...")
    
    all_fetched_articles = []
    source_counts = {}
    
    def fetch_one_source(source_name, url):
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(url, timeout=5, headers=headers, verify=False)
            feed = feedparser.parse(response.content)
            
            source_articles = []
            for entry in feed.entries[:max_articles_per_source]:
                article_url = entry.get('link', '')
                if not article_url:
                    continue
                
                # Handle published date properly
                published_date = entry.get('published', None)
                if published_date == '':
                    published_date = None
                
                # Extract image URL from RSS entry using improved extraction
                # Pass source URL for source-specific handling (e.g., Guardian width selection)
                image_url = extract_image_url(entry, source_url=url)
                
                # Check if this source needs og:image scraping (BBC, DW)
                needs_scrape = needs_og_image_scrape(url)
                
                source_articles.append({
                    'url': article_url,
                    'title': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'source': source_name,
                    'published_date': published_date,
                    'image_url': image_url,
                    'needs_og_scrape': needs_scrape,  # Flag for BBC/DW og:image extraction
                    'source_feed_url': url  # Original RSS feed URL
                })
            
            return (source_name, source_articles)
        except Exception as e:
            return (source_name, [])
    
    # Parallel fetch from all sources
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(fetch_one_source, name, url) for name, url, *_ in ALL_SOURCES]
        for future in as_completed(futures):
            source_name, source_articles = future.result()
            if source_articles:
                all_fetched_articles.extend(source_articles)
                source_counts[source_name] = len(source_articles)
    
    print(f"\n📊 Fetched {len(all_fetched_articles)} articles from {len(source_counts)} sources")
    
    # Apply deduplication (time-based + database check)
    # Use 24-hour window to catch articles when system is offline for extended periods
    new_articles = get_new_articles_only(all_fetched_articles, supabase, time_window=1440)  # 24 hours
    
    # Mark new articles as processed (batched for speed)
    if new_articles:
        try:
            # Deduplicate by URL within the batch to avoid
            # "ON CONFLICT DO UPDATE command cannot affect row a second time"
            seen_urls = set()
            batch_records = []
            for a in new_articles:
                url = a.get('url')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    batch_records.append({
                        'article_url': url,
                        'source': a.get('source', 'Unknown'),
                        'title': a.get('title', 'No title'),
                        'published_date': a.get('published_date')
                    })
            # Batch upsert in chunks of 50
            for i in range(0, len(batch_records), 50):
                chunk = batch_records[i:i+50]
                supabase.table('processed_articles')\
                    .upsert(chunk, on_conflict='article_url')\
                    .execute()
        except Exception as e:
            print(f"⚠️  Batch dedup insert failed, falling back to sequential: {e}")
            for article in new_articles:
                mark_article_as_processed(article, supabase)
    
    # Show which sources had new articles
    new_by_source = {}
    for article in new_articles:
        source = article.get('source', 'Unknown')
        new_by_source[source] = new_by_source.get(source, 0) + 1
    
    for source_name, count in sorted(new_by_source.items()):
                print(f"✅ {source_name}: {count} new")
    
    print(f"\n✅ Step 0 Complete: {len(new_articles)} NEW articles (after deduplication)")
    return new_articles


# ==========================================
# COMPLETE PIPELINE
# ==========================================

def run_complete_pipeline():
    """Run the complete 9-step clustered news workflow"""

    print("\n" + "="*80)
    print("🚀 COMPLETE 10-STEP CLUSTERED NEWS WORKFLOW")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    # PRE-CHECK: Verify Gemini API key exists
    if not gemini_key:
        print("⚠️  Aborting pipeline - GEMINI_API_KEY not set")
        return

    # STEP 0: RSS Feed Collection
    articles = fetch_rss_articles()
    if not articles:
        print("⚠️  No new articles - ending cycle")
        return
    
    # STEP 1: Gemini Scoring & Filtering
    print(f"\n{'='*80}")
    print(f"🎯 STEP 1: GEMINI SCORING & FILTERING")
    print(f"{'='*80}")
    print(f"Scoring {len(articles)} articles...")
    
    scoring_result = score_news_articles_step1(articles, gemini_key)
    approved_articles = scoring_result.get('approved', [])
    filtered_articles = scoring_result.get('filtered', [])
    filtered_count = len(filtered_articles)

    print(f"\n✅ Step 1 Complete: {len(approved_articles)} approved, {filtered_count} filtered")
    
    # SAVE FILTERED ARTICLES TO SUPABASE (for analysis)
    if filtered_articles:
        try:
            filtered_to_save = []
            for article in filtered_articles:
                filtered_to_save.append({
                    'title': article.get('title', 'Unknown'),
                    'score': article.get('score', 0),
                    'source': article.get('source', 'Unknown'),
                    'url': article.get('url', ''),
                    'category': article.get('category', 'Other'),
                    'path': article.get('path', 'DISQUALIFIED'),
                    'disqualifier': article.get('disqualifier', None),
                    'filtered_at': datetime.now().isoformat()
                })
            
            # Insert in batches of 50
            for i in range(0, len(filtered_to_save), 50):
                batch = filtered_to_save[i:i+50]
                supabase.table('filtered_articles').insert(batch).execute()
            
            print(f"   📊 Saved {len(filtered_to_save)} filtered articles to Supabase")
        except Exception as e:
            print(f"   ⚠️ Could not save filtered articles: {e}")
    
    if not approved_articles:
        print("⚠️  No articles approved - ending cycle")
        return
    
    # STEP 1.5: Event Clustering
    print(f"\n{'='*80}")
    print(f"🔗 STEP 1.5: EVENT CLUSTERING (NEW)")
    print(f"{'='*80}")
    print(f"Clustering {len(approved_articles)} articles...")
    
    clustering_result = clustering_engine.cluster_articles(approved_articles)
    
    print(f"\n✅ Step 1.5 Complete:")
    print(f"   📊 New clusters: {clustering_result['new_clusters_created']}")
    print(f"   🔗 Matched existing: {clustering_result['matched_to_existing']}")
    if clustering_result.get('failed', 0) > 0:
        print(f"   ⚠️  Failed: {clustering_result['failed']}")
    
    # ONLY process NEW/UPDATED clusters from THIS cycle (not old ones)
    clusters_to_process = []
    
    # Get cluster IDs that were created or updated in Step 1.5
    affected_cluster_ids = clustering_result.get('cluster_ids', [])
    
    if not affected_cluster_ids:
        print(f"   🎯 No clusters to process this cycle")
        print("⚠️  No new clusters created - ending cycle")
        return
    
    # For each affected cluster, check if it's ready (not yet published)
    for cluster_id in affected_cluster_ids:
        # Check if already published
        existing = supabase.table('published_articles')\
            .select('id')\
            .eq('cluster_id', cluster_id)\
            .execute()
        
        if existing.data:
            continue  # Already published
        
        # Get source count
        sources = supabase.table('source_articles')\
            .select('id')\
            .eq('cluster_id', cluster_id)\
            .execute()
        
        # Process clusters with 1+ sources (single-source articles are now allowed)
        if len(sources.data) >= 1:
            clusters_to_process.append(cluster_id)
    
    print(f"   🎯 Clusters ready for processing: {len(clusters_to_process)} (NEW this cycle)")
    
    if not clusters_to_process:
        print("⚠️  No clusters ready - ending cycle")
        return
    
    # ==========================================
    # PARALLEL CLUSTER PROCESSING (3 workers)
    # ==========================================
    import threading
    
    # Gemini rate limiter - allows max 2 concurrent Gemini API calls
    # This prevents 429 errors without adding any artificial delay.
    # Workers only wait if 2 other workers are already mid-Gemini-call.
    gemini_semaphore = threading.Semaphore(5)
    
    # Thread-safe counter for published articles
    published_lock = threading.Lock()
    # Audit fix A6 (2026-05-06): collect newly-published articles for the
    # post-loop world-event detection batch.
    published_for_events = []
    published_for_events_lock = threading.Lock()
    published_count = 0
    # Per-run typed_signals audit: (id, signal_count, rich_count)
    published_signal_audit = []
    
    # Duplicate title + embedding cache shared across threads
    title_cache_lock = threading.Lock()
    published_titles_cache = []  # Populated before parallel processing

    # Pre-fetch recent titles + embeddings for dedup (48h window, paginated)
    try:
        from difflib import SequenceMatcher
        cutoff_time = (datetime.now() - timedelta(hours=48)).isoformat()

        def _clean_title(t):
            if not t:
                return ''
            t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
            t = re.sub(r'[^\w\s]', '', t.lower())
            return t.strip()

        offset = 0
        page_size = 1000
        while True:
            page = supabase.table('published_articles')\
                .select('id, title_news, embedding_minilm')\
                .gte('published_at', cutoff_time)\
                .order('published_at', desc=True)\
                .range(offset, offset + page_size - 1)\
                .execute()
            if not page.data:
                break
            for r in page.data:
                published_titles_cache.append({
                    'id': r['id'],
                    'title_news': r.get('title_news', ''),
                    'clean': _clean_title(r.get('title_news', '')),
                    'embedding': r.get('embedding_minilm')
                })
            if len(page.data) < page_size:
                break
            offset += page_size

        print(f"   📋 Dedup cache: {len(published_titles_cache)} articles from last 48h")
    except Exception as e:
        print(f"   ⚠️ Could not pre-fetch recent titles: {e}")
    
    def process_single_cluster(cluster_id):
        """Process a single cluster through Steps 2-11. Thread-safe."""
        nonlocal published_count
        
        try:
            print(f"\n{'='*80}")
            print(f"📰 PROCESSING CLUSTER {cluster_id}")
            print(f"{'='*80}")
            
            # Mark cluster as processing
            update_cluster_status(cluster_id, 'processing', increment_attempt=False)
            
            # Get cluster metadata
            cluster_result = supabase.table('clusters')\
                .select('*')\
                .eq('id', cluster_id)\
                .execute()
            
            cluster = cluster_result.data[0] if cluster_result.data else {}
            
            # Get all source articles in this cluster
            sources = supabase.table('source_articles')\
                .select('*')\
                .eq('cluster_id', cluster_id)\
                .execute()
            
            cluster_sources = sources.data
            print(f"   [Cluster {cluster_id}] Sources in cluster: {len(cluster_sources)}")
            
            # STEP 2: Bright Data Full Article Fetching (all sources)
            print(f"\n📡 [Cluster {cluster_id}] STEP 2: BRIGHT DATA FULL ARTICLE FETCHING")
            print(f"   Fetching full text for {len(cluster_sources)} sources...")
            
            urls = [s['url'] for s in cluster_sources]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Build URL mappings for text and og:image
            url_to_text = {a['url']: a.get('text', '') for a in full_articles if a.get('text')}
            url_to_og_image = {a['url']: a.get('og_image') for a in full_articles if a.get('og_image')}
            
            # Add full text and fetch/upgrade images for ALL sources without images
            for source in cluster_sources:
                source['full_text'] = url_to_text.get(source['url'], source.get('content', ''))
                
                # Check if source has no image or needs upgrade (fetch og:image from Bright Data)
                current_image = source.get('image_url')
                has_no_image = not current_image or not current_image.strip()
                
                # Sources that need og:image upgrade (low-quality RSS images)
                source_url = source.get('url', '').lower()
                source_name = source.get('source_name', source.get('source', '')).lower()
                needs_upgrade = any(domain in source_url or domain in source_name 
                                   for domain in ['bbc.co.uk', 'bbc.com', 'dw.com', 'deutsche welle', 'cbc.ca', 'lemonde.fr', 'venturebeat.com', 'venturebeat'])
                
                # Use og:image from scraped page if source has no image OR needs upgrade
                if (has_no_image or needs_upgrade) and source['url'] in url_to_og_image:
                    og_image = url_to_og_image[source['url']]
                    if og_image:
                        source['image_url'] = og_image
                        if has_no_image:
                            print(f"   📸 [Cluster {cluster_id}] Fetched image for {source.get('source_name', source.get('source', 'Unknown'))}: {og_image[:60]}...")
                        else:
                            print(f"   📸 [Cluster {cluster_id}] Upgraded image for {source.get('source_name', source.get('source', 'Unknown'))}: {og_image[:60]}...")
            
            # Track source article status for analytics
            for source in cluster_sources:
                source_id = source.get('id')
                if source_id:
                    content_ok = bool(source.get('full_text') and len(source.get('full_text', '')) > 100)
                    image_ok = bool(source.get('image_url'))
                    
                    # Update source article tracking
                    update_source_article_status(
                        source_id,
                        content_fetched=content_ok,
                        fetch_failure_reason='blocked' if not content_ok else None,
                        has_image=image_ok
                    )
                    
                    # Track domain reliability
                    domain = extract_domain(source.get('url', ''))
                    if domain:
                        update_source_reliability(domain, success=content_ok, 
                            failure_reason='blocked' if not content_ok else None)
            
            success_count = len([s for s in cluster_sources if s.get('full_text') and len(s.get('full_text', '')) > 100])
            print(f"   ✅ [Cluster {cluster_id}] Fetched full text: {success_count}/{len(cluster_sources)}")
            
            # STRICT: Require actual article content - no description fallback
            if success_count == 0:
                print(f"   ❌ [Cluster {cluster_id}] ELIMINATED: No article content fetched")
                update_cluster_status(cluster_id, 'failed', 'no_content', 
                    f'All {len(cluster_sources)} sources blocked or failed to fetch')
                return False
            
            # STEP 3: Smart Image Selection
            print(f"\n📸 [Cluster {cluster_id}] STEP 3: SMART IMAGE SELECTION")
            
            selector = ImageSelector(debug=True)
            all_candidates = []
            for source in cluster_sources:
                image_url = source.get('image_url') or source.get('urlToImage')
                if not image_url:
                    continue
                all_candidates.append({
                    'url': image_url,
                    'source_name': source.get('source_name', source.get('source', 'Unknown')),
                    'source_url': source.get('url', ''),
                    'article_score': source.get('score', 50),
                    'width': source.get('image_width', 0),
                    'height': source.get('image_height', 0)
                })
            
            # Fetch real dimensions for candidates missing width/height
            for candidate in all_candidates:
                if candidate.get('width', 0) == 0 or candidate.get('height', 0) == 0:
                    try:
                        resp = requests.get(candidate['url'], timeout=5, stream=True, headers={
                            'User-Agent': 'Mozilla/5.0 (compatible; TenNewsBot/1.0)'
                        })
                        resp.raise_for_status()
                        # Read up to 512KB to get image header
                        chunk = resp.raw.read(524288)
                        resp.close()
                        img = Image.open(BytesIO(chunk))
                        candidate['width'], candidate['height'] = img.size
                    except Exception:
                        pass  # Keep width=0, height=0 — filter will handle it

            valid_candidates = []
            for candidate in all_candidates:
                if selector._is_valid_image(candidate):
                    candidate['quality_score'] = selector._calculate_image_score(candidate)
                    valid_candidates.append(candidate)
            
            if not valid_candidates:
                print(f"   ❌ [Cluster {cluster_id}] ELIMINATED: No image found")
                update_cluster_status(cluster_id, 'failed', 'no_image',
                    f'No usable image found in {len(cluster_sources)} sources')
                return False
            
            valid_candidates.sort(key=lambda x: x['quality_score'], reverse=True)
            
            # STEP 3.1: AI Image Quality Check (Gemini 2.0 Flash)
            print(f"\n🔍 [Cluster {cluster_id}] STEP 3.1: AI IMAGE QUALITY CHECK")
            
            selected_image = None
            try:
                with gemini_semaphore:
                    ai_approved = check_and_select_best_image(valid_candidates, min_confidence=70)
                if ai_approved:
                    selected_image = {
                        'url': ai_approved['url'],
                        'source_name': ai_approved['source_name'],
                        'quality_score': ai_approved['quality_score']
                    }
                    print(f"   ✅ [Cluster {cluster_id}] AI-approved image from {selected_image['source_name']}")
                else:
                    print(f"   ⚠️  [Cluster {cluster_id}] No images passed AI quality check")
            except Exception as e:
                print(f"   ⚠️  [Cluster {cluster_id}] AI quality check failed: {str(e)[:80]}")
            
            if not selected_image:
                print(f"   ❌ [Cluster {cluster_id}] No images passed AI quality check — skipping article")
                update_cluster_status(cluster_id, 'failed', 'no_quality_image',
                    f'All {len(valid_candidates)} candidate images failed AI quality check')
                return False
            
            # STEP 3.5: VALIDATE CLUSTER SOURCES (removes unrelated articles)
            if len(cluster_sources) > 2:
                with gemini_semaphore:
                    cluster_sources = validate_cluster_sources(
                        cluster_sources, 
                        cluster.get('event_name', f'Cluster {cluster_id}')
                    )
                
                if not cluster_sources:
                    print(f"   ❌ [Cluster {cluster_id}] No valid sources after validation")
                    update_cluster_status(cluster_id, 'failed', 'validation_failed',
                        'All sources were unrelated after validation')
                    return False
            
            # STEP 4: MULTI-SOURCE SYNTHESIS
            print(f"\n✍️  [Cluster {cluster_id}] STEP 4: MULTI-SOURCE SYNTHESIS")
            print(f"   Synthesizing article from {len(cluster_sources)} sources...")
            
            synthesized = synthesize_multisource_article(cluster_sources, cluster_id)
            
            if not synthesized:
                print(f"   ❌ [Cluster {cluster_id}] Synthesis failed")
                update_cluster_status(cluster_id, 'failed', 'synthesis_failed',
                    'Gemini API failed to synthesize article from sources')
                return False
            
            synthesized['image_url'] = selected_image['url']
            synthesized['image_source'] = selected_image['source_name']
            synthesized['image_score'] = selected_image['quality_score']
            
            print(f"   ✅ [Cluster {cluster_id}] Synthesized: {synthesized['title_news'][:60]}...")
            
            # ==========================================
            # STEP 6 FIRST: COMPONENT SELECTION (cheap, no grounding)
            # Then STEP 5: CONTEXT SEARCH (expensive grounding, only if needed)
            # ==========================================

            bullets_text = ' '.join(synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])))

            # --- STEP 6: Decide which components this article needs ---
            print(f"\n📋 [Cluster {cluster_id}] STEP 6: GEMINI COMPONENT SELECTION")

            article_for_selection = {
                'title': synthesized['title_news'],
                'text': bullets_text,
                'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', []))
            }

            selected = []
            component_result = {}
            try:
                with gemini_semaphore:
                    component_result = component_selector.select_components(article_for_selection)
                selected = component_result.get('components', []) if isinstance(component_result, dict) else []
                # Remove "details" — the 3-column stat grid was retired
                # 2026-05-10. Spec said it shipped with rigid label-≤12-chars +
                # value-must-have-digit + exactly-3-columns shape that produced
                # truncated output ("LOTTERY PICK | Projected #6-10..."). High
                # creator friction (you have to hunt for 3 quantitative facts)
                # and low engagement payoff vs the alternatives. Filtered here
                # rather than rewriting step5's 55-reference prompt — single-
                # point fix and doesn't risk breaking anything else.
                selected = [c for c in selected if c != 'details']
                print(f"   ✅ [Cluster {cluster_id}] Step 6 Complete: [{', '.join(selected) if selected else 'none'}]")
            except Exception as comp_error:
                print(f"   ⚠️ [Cluster {cluster_id}] Step 6 Failed: {comp_error}")
                # Fallback used to default to ['details'] — now empty list
                # (no info box) since details is retired.
                selected = []
                component_result = {'components': selected, 'emoji': '📰'}

            # --- STEP 5: Context search ONLY if components need it ---
            # Components that need Google Search grounding: timeline, details, graph, map.
            # (scorecard + recipe retired 2026-05-12.)
            components_needing_search = [c for c in selected if c in ('timeline', 'details', 'graph', 'map')]

            gemini_result = None
            context_data = {}

            if components_needing_search and gemini_key:
                print(f"\n🔍 [Cluster {cluster_id}] STEP 5: GEMINI CONTEXT SEARCH (for: {', '.join(components_needing_search)})")

                full_article_text = ""
                for source in cluster_sources:
                    if source.get('full_text') and len(source.get('full_text', '')) > 100:
                        full_article_text = source['full_text'][:3000]
                        break

                try:
                    with gemini_semaphore:
                        gemini_result = search_gemini_context(
                            synthesized['title_news'],
                            bullets_text,
                            full_article_text,
                            selected_components=components_needing_search
                        )
                    search_context_text = gemini_result.get('results', '') if gemini_result else ""
                    print(f"   ✅ [Cluster {cluster_id}] Step 5 Complete: ({len(search_context_text)} chars)")
                except Exception as search_error:
                    print(f"   ⚠️ [Cluster {cluster_id}] Step 5 Failed: {search_error}")

                if gemini_result:
                    for component in selected:
                        context_data[component] = gemini_result
            elif not components_needing_search and selected:
                print(f"\n⏭️  [Cluster {cluster_id}] STEP 5: SKIPPED (components [{', '.join(selected)}] don't need web search)")
            elif not selected:
                print(f"\n⏭️  [Cluster {cluster_id}] STEP 5: SKIPPED (no components selected)")
            
            # ==========================================
            # STEP 7: COMPONENT GENERATION (with retry)
            # ==========================================
            print(f"\n📊 [Cluster {cluster_id}] STEP 7: COMPONENT GENERATION")
            
            components = {}
            map_locations = component_result.get('map_locations', []) if isinstance(component_result, dict) else []
            
            if selected:
                max_component_retries = 3
                for comp_attempt in range(max_component_retries):
                    try:
                        article_for_components = {
                            'title_news': synthesized['title_news'],
                            'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])),
                            'selected_components': selected,
                            'context_data': context_data,
                            'map_locations': map_locations
                        }
                        with gemini_semaphore:
                            generation_result = component_writer.write_components(article_for_components)

                        if generation_result:
                            components = {
                                'timeline': generation_result.get('timeline'),
                                'details': generation_result.get('details'),
                                'graph': generation_result.get('graph'),
                                'map': generation_result.get('map'),
                            }
                            components = {k: v for k, v in components.items() if v is not None}

                            missing_components = [c for c in selected if c not in components]
                            if missing_components and comp_attempt < max_component_retries - 1:
                                print(f"   ⚠️ [Cluster {cluster_id}] Missing: {missing_components} - retrying ({comp_attempt + 2}/{max_component_retries})...")
                                time.sleep(2)
                                continue

                            print(f"   ✅ [Cluster {cluster_id}] Step 7 Complete: [{', '.join(components.keys())}]")
                            break

                        if comp_attempt < max_component_retries - 1:
                            print(f"   ⚠️ [Cluster {cluster_id}] No components - retrying ({comp_attempt + 2}/{max_component_retries})...")
                            time.sleep(2)
                            continue
                        components = {}

                    except Exception as comp_gen_error:
                        if comp_attempt < max_component_retries - 1:
                            print(f"   ⚠️ [Cluster {cluster_id}] Component error: {comp_gen_error} - retrying ({comp_attempt + 2}/{max_component_retries})...")
                            time.sleep(2)
                            continue
                        print(f"   ⚠️ [Cluster {cluster_id}] Step 7 Failed: {comp_gen_error}")
                        components = {}
            
            # STEP 8: Fact Verification
            print(f"\n🔍 [Cluster {cluster_id}] STEP 8: FACT VERIFICATION")
            
            max_verification_attempts = 3
            verification_passed = False
            verification_feedback = None
            
            for attempt in range(max_verification_attempts):
                if attempt > 0:
                    print(f"\n   🔄 [Cluster {cluster_id}] REGENERATING (Attempt {attempt + 1}/{max_verification_attempts})")
                    
                    synthesized = synthesize_multisource_article(
                        cluster_sources, 
                        cluster_id,
                        verification_feedback=verification_feedback
                    )
                    
                    if not synthesized:
                        print(f"      ❌ [Cluster {cluster_id}] Regeneration failed")
                        continue
                    
                    if selected_image:
                        synthesized['image_url'] = selected_image['url']
                        synthesized['image_source'] = selected_image['source_name']
                        synthesized['image_score'] = selected_image['quality_score']
                    
                    print(f"      ✅ [Cluster {cluster_id}] New article: {synthesized.get('title_news', '')[:50]}...")
                
                with gemini_semaphore:
                    verified, discrepancies, verification_summary = fact_verifier.verify_article(
                        cluster_sources, 
                        synthesized
                    )
                
                if verified:
                    verification_passed = True
                    print(f"   ✅ [Cluster {cluster_id}] Verification PASSED: {verification_summary}")
                    break
                else:
                    print(f"   ⚠️  [Cluster {cluster_id}] Verification FAILED (Attempt {attempt + 1}/{max_verification_attempts})")
                    if discrepancies:
                        for i, d in enumerate(discrepancies[:3], 1):
                            issue = d.get('issue', 'Unknown')
                            print(f"         {i}. {issue[:80]}...")
                    
                    verification_feedback = {
                        'discrepancies': discrepancies,
                        'summary': verification_summary
                    }
            
            if not verification_passed:
                print(f"\n   ❌ [Cluster {cluster_id}] ELIMINATED: Failed verification after {max_verification_attempts} attempts")
                update_cluster_status(cluster_id, 'failed', 'verification_failed',
                    f'Failed fact verification after {max_verification_attempts} attempts')
                return False
            
            synthesized['image_url'] = selected_image['url']
            synthesized['image_source'] = selected_image['source_name']
            synthesized['image_score'] = selected_image['quality_score']
            
            # STEP 9: Publishing to Supabase
            print(f"\n💾 [Cluster {cluster_id}] STEP 9: PUBLISHING TO SUPABASE")
            
            # Check if already published (prevent duplicates)
            existing = supabase.table('published_articles').select('id').eq('cluster_id', cluster_id).execute()
            if existing.data and len(existing.data) > 0:
                print(f"   ⏭️ [Cluster {cluster_id}] Already published (ID: {existing.data[0]['id']})")
                return False
            
            title = synthesized.get('title', synthesized.get('title_news', ''))
            
            # CHECK FOR DUPLICATES: title similarity + embedding similarity (thread-safe)
            is_duplicate = False
            skip_reason = None
            try:
                clean_new_title = _clean_title(title)

                # Check against pre-fetched cache + newly published in this run
                with title_cache_lock:
                    all_titles_to_check = list(published_titles_cache)

                # 1) Title-based dedup (catches rewrites with similar wording)
                for recent in all_titles_to_check:
                    if clean_new_title and recent['clean']:
                        similarity = SequenceMatcher(None, clean_new_title, recent['clean']).ratio()
                        if similarity >= 0.65:
                            print(f"   ⏭️ [Cluster {cluster_id}] DUPLICATE TITLE (similarity: {similarity:.0%})")
                            print(f"      New: {title[:60]}...")
                            print(f"      Existing (ID {recent['id']}): {recent['title_news'][:60]}...")
                            is_duplicate = True
                            skip_reason = "duplicate_title"
                            break

                # 2) Embedding-based dedup (catches same story with different wording)
                if not is_duplicate and article_embedding_minilm:
                    import numpy as np
                    new_emb = np.array(article_embedding_minilm, dtype=np.float32)
                    new_norm = np.linalg.norm(new_emb)
                    if new_norm > 0:
                        new_emb_normed = new_emb / new_norm
                        for recent in all_titles_to_check:
                            cached_emb = recent.get('embedding')
                            if cached_emb and isinstance(cached_emb, list) and len(cached_emb) == len(article_embedding_minilm):
                                old_emb = np.array(cached_emb, dtype=np.float32)
                                old_norm = np.linalg.norm(old_emb)
                                if old_norm > 0:
                                    cosine_sim = float(np.dot(new_emb_normed, old_emb / old_norm))
                                    if cosine_sim >= 0.82:
                                        print(f"   ⏭️ [Cluster {cluster_id}] DUPLICATE EMBEDDING (cosine: {cosine_sim:.2f})")
                                        print(f"      New: {title[:60]}...")
                                        print(f"      Existing (ID {recent['id']}): {recent['title_news'][:60]}...")
                                        is_duplicate = True
                                        skip_reason = "duplicate_embedding"
                                        break

            except Exception as e:
                print(f"   ⚠️ [Cluster {cluster_id}] Duplicate check error: {e}")
            
            if is_duplicate:
                update_cluster_status(cluster_id, 'skipped', 'duplicate',
                    f'Duplicate detected: {skip_reason}')
                return False
            
            # STEPS 10+11: SCORING + TAGGING (run in parallel - both use Gemini independently)
            print(f"\n   🎯 [Cluster {cluster_id}] STEPS 10+11: SCORING + TAGGING (parallel)")
            bullets = synthesized.get('summary_bullets', synthesized.get('summary_bullets_news', []))
            # Audit fix F-4 (2026-05-06): Gemini ignores the category whitelist
            # in the synthesis prompt and free-forms whatever it likes — the DB
            # ended up with 67 distinct categories instead of the declared 14
            # ('cat:art_business', 'cat:art_lifestyle' etc.), fragmenting the L0
            # category signal that Phase A relies on. Canonicalize on the way
            # in so typed_signals stays clean.
            article_category = canonicalize_category(synthesized.get('category', 'Other'))
            
            article_score = 750  # default
            shelf_life_days = 1
            freshness_category = 'short'
            interest_tags = []
            article_countries = []
            article_topics = []
            
            # Wrappers that acquire gemini semaphore before calling API
            def _score_with_sem():
                with gemini_semaphore:
                    return score_article_with_references(title, bullets, gemini_key, supabase)
            def _tags_with_sem():
                with gemini_semaphore:
                    return generate_interest_tags(title, bullets, gemini_key)
            def _tagging_with_sem():
                with gemini_semaphore:
                    return tag_article(title, bullets, article_category, gemini_key)
            
            with ThreadPoolExecutor(max_workers=3) as step_executor:
                # Run scoring, interest tags, and article tagging in parallel (semaphore-throttled)
                score_future = step_executor.submit(_score_with_sem)
                tags_future = step_executor.submit(_tags_with_sem)
                tagging_future = step_executor.submit(_tagging_with_sem)
                
                try:
                    score_result = score_future.result(timeout=30)
                    # score_article_with_references returns {'score': int, 'topic_relevance': {}, 'country_relevance': {}, 'freshness_category': str, 'shelf_life_days': int}
                    if isinstance(score_result, dict):
                        article_score = score_result.get('score', 750)
                        shelf_life_days = score_result.get('shelf_life_days', 1)
                        freshness_category = score_result.get('freshness_category', 'medium')
                    else:
                        article_score = int(score_result) if score_result else 750
                    print(f"   📊 [Cluster {cluster_id}] Score: {article_score}/1000, shelf_life: {shelf_life_days}d ({freshness_category})")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Scoring failed: {e}")
                
                try:
                    interest_tags = tags_future.result(timeout=30)
                    print(f"   🏷️ [Cluster {cluster_id}] Tags: {interest_tags}")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Interest tags failed: {e}")
                
                try:
                    tags_result = tagging_future.result(timeout=30)
                    article_countries = tags_result.get('countries', [])
                    article_topics = tags_result.get('topics', [])
                    print(f"   🌍 [Cluster {cluster_id}] Countries: {article_countries}")
                    print(f"   📌 [Cluster {cluster_id}] Topics: {article_topics}")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Tagging failed: {e}")
            
            # NOTE: enrich_with_subtopics REMOVED — it was appending onboarding
            # subtopic names ("Soccer/Football", "AI & Machine Learning", etc.)
            # to interest_tags, causing wrong articles to appear under Explore entities.
            # Concept entity ANN tagging (below) handles entity matching now.

            five_ws = synthesized.get('five_ws', {})

            source_titles = [
                {
                    'title': s.get('title', 'Unknown'),
                    'source': s.get('source_name', s.get('source', 'Unknown'))
                }
                for s in cluster_sources
            ]
            
            successful_components = [c for c in selected if components.get(c) is not None]
            
            if len(successful_components) < len(selected):
                failed_components = [c for c in selected if c not in successful_components]
                print(f"   ⚠️ [Cluster {cluster_id}] Some components failed: {failed_components}")
            
            # Generate MiniLM embedding for feed personalization (pgvector similarity search).
            # The 768-d Gemini embedding is no longer emitted — main.js only reads
            # `embedding_minilm`, and the extra Gemini API call was pure overhead.
            article_embedding = None  # kept as None for backward-compat with the insert dict shape
            article_embedding_minilm = None
            try:
                from step1_5_event_clustering import get_embedding_minilm
                embed_text = f"{title} {' '.join(bullets) if isinstance(bullets, list) else ''}"
                article_embedding_minilm = get_embedding_minilm(embed_text)
                if article_embedding_minilm:
                    print(f"   🧠 [Cluster {cluster_id}] MiniLM embedding ({len(article_embedding_minilm)} dims)")
            except Exception as e:
                print(f"   ⚠️ [Cluster {cluster_id}] Embedding generation failed: {e}")

            # Cleanup (2026-05-11): removed v11-era global super/leaf cluster
            # assignment + cluster_assign_helper import. The bandit system that
            # consumed super_cluster_id/leaf_cluster_id (update_leaf_arm /
            # update_super_arm) was already dropped in Phase 1.1, leaving these
            # columns write-only. Trinity's vq_primary/vq_secondary stamping
            # (step 12 below) is the live cluster hierarchy.

            # ANN concept entity tagging: find matching entities via embedding similarity
            # Then validate each match by checking if entity name/alias appears in article text
            if article_embedding_minilm:
                try:
                    emb_str = '[' + ','.join(str(x) for x in article_embedding_minilm) + ']'
                    ann_result = supabase.rpc('match_concept_entities', {
                        'query_embedding': emb_str,
                        'match_threshold': 0.60,
                        'match_count': 8
                    }).execute()
                    if ann_result.data:
                        # Name/alias validation: only keep entities actually mentioned in the article
                        article_text_lower = (title + ' ' + (' '.join(bullets) if isinstance(bullets, list) else '')).lower()
                        # Fetch aliases for matched entities
                        matched_names = [r['entity_name'] for r in ann_result.data]
                        aliases_result = supabase.table('concept_entities').select('entity_name, aliases').in_('entity_name', matched_names).execute()
                        aliases_map = {r['entity_name']: r.get('aliases') or [] for r in (aliases_result.data or [])}

                        validated_tags = []
                        rejected_tags = []
                        for r in ann_result.data:
                            ename = r['entity_name']
                            names_to_check = [ename] + aliases_map.get(ename, [])
                            # Check if any name/alias appears in article text
                            if any(n.lower() in article_text_lower for n in names_to_check):
                                validated_tags.append(ename)
                            else:
                                rejected_tags.append(f"{ename}({r['similarity']:.2f})")

                        # Add validated tags to interest_tags
                        existing_lower = {t.lower() for t in interest_tags}
                        for ct in validated_tags:
                            if ct.lower() not in existing_lower:
                                interest_tags.append(ct)
                                existing_lower.add(ct.lower())
                        if validated_tags:
                            print(f"   🎯 [Cluster {cluster_id}] Concept entities: {validated_tags}")
                        if rejected_tags:
                            print(f"   🚫 [Cluster {cluster_id}] Rejected (not in text): {rejected_tags}")
                except Exception as e:
                    # Non-blocking: concept tagging is optional
                    print(f"   ⚠️ [Cluster {cluster_id}] Concept entity tagging skipped: {str(e)[:80]}")

            # TYPED ENTITY SIGNALS: extract NER + build typed signals for personalization
            article_typed_signals = []
            try:
                import google.generativeai as _ts_genai
                _ts_genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
                _ts_model = _ts_genai.GenerativeModel('gemini-2.5-flash-lite')
                ner_result = extract_named_entities_via_gemini(title, bullets, _ts_model, gemini_semaphore)
                article_typed_signals = build_typed_signals(
                    article_countries, interest_tags, ner_result,
                    category=article_category, article_topics=article_topics,
                )
                print(f"   🔖 [Cluster {cluster_id}] Typed signals ({len(article_typed_signals)}): {article_typed_signals[:8]}")
            except Exception as e:
                print(f"   ⚠️ [Cluster {cluster_id}] Typed signals failed (non-blocking): {e}")

            # If article has info box components, trim bullets to 450 max
            # Articles without components keep up to 550 chars
            has_components = any(components.get(c) for c in ['details', 'timeline', 'graph', 'map'])
            if has_components and isinstance(bullets, list):
                total_bullet_chars = sum(len(b) for b in bullets)
                if total_bullet_chars > 450:
                    trimmed = []
                    running = 0
                    for b in bullets:
                        if running + len(b) <= 450:
                            trimmed.append(b)
                            running += len(b)
                        else:
                            remaining = 450 - running
                            if remaining > 30:
                                truncated = b[:remaining]
                                cut_at = max(truncated.rfind('.'), truncated.rfind(','))
                                if cut_at > 30:
                                    trimmed.append(b[:cut_at + 1].rstrip(','))
                                else:
                                    trimmed.append(truncated.rsplit(' ', 1)[0])
                            break
                    bullets = trimmed
                    print(f"   ✂️ [Cluster {cluster_id}] Trimmed bullets to {sum(len(b) for b in bullets)} chars (has components)")

            # Match article to a publisher account
            matched_author_id, matched_author_name = match_publisher(
                interest_tags, synthesized.get('category', 'Other'), publishers_cache, article_id=cluster_id
            )

            # MULTI-PAGE: Generate a "deeper context" page 2 for articles that deserve it
            # Only for analysis/evergreen articles with 3+ bullets and high score
            article_pages = None
            if article_score >= 700 and len(bullets) >= 3 and freshness_category in ('analysis', 'evergreen', 'timeless', 'developing'):
                try:
                    page2_prompt = f"""This news article just published:
Title: {title}
Bullets: {' | '.join(bullets)}
Category: {synthesized.get('category', 'Other')}

Write a SHORT second page that gives the reader deeper context. NOT a summary of page 1.
Instead: explain WHY this matters, the background context, or how it works in simple terms.

Rules:
- 2-3 short bullets, each a specific fact or context that helps understand the news
- Present tense, short sentences, no academic language
- No "Here's why this matters" — just state the context directly
- Each bullet should make the reader go "oh, that makes more sense now"

Return ONLY a JSON array of 2-3 bullet strings. Nothing else.
Example: ["Current solar panels max out at 25% efficiency commercially", "The theoretical limit has been 33% since 1961 — this breaks that barrier", "If scalable, this could cut solar farm sizes by half"]"""

                    with gemini_semaphore:
                        import google.generativeai as _p2_genai
                        _p2_genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
                        _p2_model = _p2_genai.GenerativeModel('gemini-2.5-flash-lite')
                        page2_response = _p2_model.generate_content(page2_prompt)
                    page2_text = page2_response.text.strip()
                    if page2_text.startswith('```'): page2_text = page2_text.split('\n', 1)[1] if '\n' in page2_text else page2_text[3:]
                    if page2_text.endswith('```'): page2_text = page2_text[:-3]
                    if page2_text.startswith('json'): page2_text = page2_text[4:]
                    page2_bullets = json.loads(page2_text.strip())

                    if isinstance(page2_bullets, list) and len(page2_bullets) >= 2:
                        article_pages = [
                            {"title": title, "image_url": None, "bullets": bullets},
                            {"title": None, "image_url": None, "bullets": page2_bullets},
                        ]
                        print(f"   📄 [Cluster {cluster_id}] Added context page 2 ({len(page2_bullets)} bullets)")
                except Exception as page2_err:
                    print(f"   ⚠️ [Cluster {cluster_id}] Page 2 generation failed: {page2_err}")

            # STEP 12: Trinity 2-level cluster assignment.
            vq_primary, vq_secondary = assign_vq_clusters(article_embedding_minilm, supabase)
            if vq_primary is not None:
                print(f"   🎯 [Cluster {cluster_id}] Trinity (c1={vq_primary}, c2={vq_secondary})")
            else:
                # Audit fix A7 (2026-05-06): SKIP this article instead of
                # inserting it with NULL vq_primary. NULL articles are
                # invisible to Trinity-M / Trinity-LT / trinity-fresh
                # retrievers (they all filter on vq_primary IS NOT NULL),
                # so an article with no VQ code costs Cloud Run + Gemini
                # generation budget for zero distribution. Failing the
                # SINGLE article (return False) leaves the rest of the
                # batch untouched — pipeline doesn't grind to a halt, but
                # broken articles never enter the corpus.
                print(f"   ❌ [Cluster {cluster_id}] Trinity stamping FAILED — SKIPPING article. embedding_minilm_present={article_embedding_minilm is not None} embedding_dim={len(article_embedding_minilm) if article_embedding_minilm else 0}")
                return False

            article_data = {
                'cluster_id': cluster_id,
                'url': cluster_sources[0]['url'],
                'source': cluster_sources[0]['source_name'],
                'category': article_category,  # canonicalized — see fix F-4
                'title_news': title,
                'summary_bullets_news': bullets,
                'five_ws': five_ws,
                'timeline': components.get('timeline'),
                'details': components.get('details'),
                'graph': components.get('graph'),
                'map': components.get('map'),
                # Card-format hint from step4's social-voice synthesis takes
                # priority over the legacy component_result.article_type
                # (which was always 'standard' in practice anyway). iOS reads
                # this column to pick the card layout variant: punchy_oneliner,
                # listicle, hot_take, conversational, comparison, story_arc,
                # or standard. Falls back to component_result then to 'standard'.
                'article_type': (
                    synthesized.get('card_format')
                    or (component_result.get('article_type') if isinstance(component_result, dict) else None)
                    or 'standard'
                ),
                'emoji': component_result.get('emoji') if isinstance(component_result, dict) else None,
                'components_order': successful_components,
                'num_sources': len(cluster_sources),
                'published_at': datetime.now().isoformat(),
                'ai_final_score': article_score,
                'interest_tags': interest_tags,
                'countries': article_countries,
                'topics': article_topics,
                'image_url': synthesized.get('image_url'),
                'image_source': synthesized.get('image_source'),
                'image_score': synthesized.get('image_score'),
                'source_titles': source_titles,
                'shelf_life_days': shelf_life_days,
                'freshness_category': freshness_category,
                'embedding': article_embedding,
                'embedding_minilm': article_embedding_minilm,
                'author_id': matched_author_id,
                'author_name': matched_author_name,
                'pages': article_pages,
                'typed_signals': article_typed_signals,
                'vq_primary': vq_primary,
                'vq_secondary': vq_secondary,
                # Cleanup (2026-05-11): super_cluster_id / leaf_cluster_id /
                # cluster_assignments are no longer written. The v11 system
                # that consumed them is gone; columns will be dropped via
                # migration once production has gone one cycle without writes.
                # Audit fix F4 (2026-05-06): write expected_read_seconds at
                # insert so downstream qualifying gates / read-ratio scorers
                # don't have to recompute per event. ~30s for a typical
                # 3-bullet card; ~50s for detail-page articles.
                'expected_read_seconds': compute_expected_read_seconds(title, bullets),
            }
            
            result = supabase.table('published_articles').insert(article_data).execute()
            
            published_article_id = result.data[0]['id']
            print(f"   ✅ [Cluster {cluster_id}] Published article ID: {published_article_id}")
            if len(source_titles) > 1:
                print(f"   📚 [Cluster {cluster_id}] MULTI-SOURCE ({len(source_titles)} articles):")
                for st in source_titles:
                    print(f"      • [{st['source']}] {st['title'][:70]}...")
            
            _rich_signal_count = sum(
                1 for s in article_typed_signals
                if not (s.startswith('lang:') or s.startswith('loc:'))
            )
            with published_lock:
                published_count += 1
                published_signal_audit.append({
                    'id': published_article_id,
                    'total': len(article_typed_signals),
                    'rich': _rich_signal_count,
                })
            # Audit fix A6 (2026-05-06): collect for post-loop step6.
            with published_for_events_lock:
                published_for_events.append({
                    'id': published_article_id,
                    'title': title,
                    'bullets': ' '.join(b for b in bullets if isinstance(b, str)) if isinstance(bullets, list) else str(bullets or ''),
                })
            
            # Add to title + embedding cache for other workers' duplicate detection
            with title_cache_lock:
                published_titles_cache.append({
                    'id': published_article_id,
                    'title_news': title,
                    'clean': _clean_title(title),
                    'embedding': article_embedding_minilm
                })
            
            # Mark cluster as successfully published
            update_cluster_status(cluster_id, 'published')
            
            return True
            
        except Exception as e:
            print(f"   ❌ [Cluster {cluster_id}] Error: {e}")
            update_cluster_status(cluster_id, 'failed', 'api_error', str(e)[:500])
            return False
    
    # ==========================================
    # EXECUTE CLUSTERS IN PARALLEL (3 workers)
    # ==========================================
    MAX_PARALLEL_CLUSTERS = 10
    print(f"\n⚡ Processing {len(clusters_to_process)} clusters with {MAX_PARALLEL_CLUSTERS} parallel workers...")
    
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_CLUSTERS) as cluster_executor:
        future_to_cluster = {
            cluster_executor.submit(process_single_cluster, cid): cid 
            for cid in clusters_to_process
        }
        
        for future in as_completed(future_to_cluster):
            cid = future_to_cluster[future]
            try:
                result = future.result()
                if result:
                    print(f"   ✅ Cluster {cid} completed successfully")
                else:
                    print(f"   ⏭️ Cluster {cid} skipped or failed")
            except Exception as e:
                print(f"   ❌ Cluster {cid} exception: {e}")
    
    # Audit fix A6 (2026-05-06): batch world-event detection on every newly-
    # published article. Tags articles to existing events when they cover the
    # same story, creates new event clusters when they don't. Populates
    # article_world_events which Trinity v5 uses for in-slate story dedup
    # (max 1 per event_id) and 0.3× cross-session demote.
    if published_for_events:
        try:
            print(f"\n🌍 STEP 6 (post-publish): detecting world events for {len(published_for_events)} articles")
            detect_world_events(published_for_events)
        except Exception as e:
            # Non-blocking: detection failure must not abort the pipeline.
            # The articles are already published; tagging is enrichment.
            print(f"   ⚠️ [Step 6] world-event detection failed (non-fatal): {e}")

    # Summary
    print(f"\n{'='*80}")
    print(f"✅ PIPELINE COMPLETE")
    print(f"{'='*80}")
    print(f"   Articles fetched: {len(articles)}")
    print(f"   Approved (Step 1): {len(approved_articles)}")
    print(f"   Clusters processed: {len(clusters_to_process)}")
    print(f"   Articles published: {published_count}")
    print(f"{'='*80}\n")

    # ── NER health check ──
    # If <80% of published articles have ≥3 rich signals (non-lang/loc), NER is
    # silently failing (today's Gemini-model / json scope bugs both produced this
    # exact signature). Fail the job so the next Cloud Run execution retries clean.
    total_audited = len(published_signal_audit)
    if total_audited >= 5:
        rich_articles = sum(1 for a in published_signal_audit if a['rich'] >= 3)
        rich_ratio = rich_articles / total_audited
        print(f"   Typed-signal health: {rich_articles}/{total_audited} articles with ≥3 rich signals ({rich_ratio*100:.0f}%)")
        if rich_ratio < 0.80:
            print(f"\n🚨 CRITICAL: Only {rich_articles}/{total_audited} articles got rich typed_signals ({rich_ratio*100:.0f}%). NER is likely failing silently.")
            print(f"   Sample audit (first 5):")
            for a in published_signal_audit[:5]:
                print(f"     article {a['id']}: total={a['total']} rich={a['rich']}")
            sys.exit(1)  # fail the Cloud Run job so it retries fresh

    return {
        'articles_processed': len(articles),
        'articles_published': published_count,
        'clusters_found': len(clusters_to_process),
        'errors': []
    }


# ==========================================
# MULTI-SOURCE SYNTHESIS
# ==========================================

################################################################################
# VOICE PERSONAS (2026-05-12)
#
# Without per-article voice variation, every article comes out the same length
# and tone because Gemini regresses to the mean of one mega-prompt. Audit on
# 2026-05-12 confirmed: title stddev 1.6 words, bullet stddev 2.8 — 50% of
# every bullet in a 5-word band. Five structural personas rotate per article;
# each enforces tight per-position length rules that the model actually obeys.
################################################################################

VOICE_PERSONAS = {
    "image_led": {
        "title_block": (
            "LENGTH: 16-22 words. HARD CAP: 22 words — never exceed. The title carries\n"
            "the full news because there are no bullets. State what happened, who, when,\n"
            "where, and the key fact in one informative caption-style line. Specific over\n"
            "vague, but anything past 22 words reads as a paragraph, not a title."
        ),
        "bullet_block": (
            "BULLETS: ZERO. summary_bullets_news = []. The title carries the story. Do not\n"
            "add bullets even if you think one would be nice — the format is image + long title."
        ),
        "card_format_hint": "punchy_oneliner",
    },
    "news_flash": {
        "title_block": (
            "LENGTH: 8-12 words / 50-80 chars. Direct factual lead. State the news.\n"
            "BANNED openers: 'Wait,', 'Here's why', 'You won't believe', 'BREAKING:',\n"
            "any opening question mark. State the fact, do not bait the click."
        ),
        "bullet_block": (
            "BULLETS: 2-3 short, with deliberate length variation.\n"
            "Bullet 1: ≤ 9 words.\n"
            "Bullet 2: 11-15 words.\n"
            "Bullet 3 (optional): 14-18 words.\n"
            "\n"
            "Worked example (notice the word counts: 7 / 13 / 16):\n"
            '  ["**Powell** signaled two more cuts.",                                    (7 words)\n'
            '   "Services inflation slowed to **3.1%**, the lowest since 2024.",         (12 words)\n'
            '   "Markets are now pricing a fourth cut by **March 2027**, says Goldman."] (15 words)\n'
            "\n"
            "FINAL CHECK before returning: count the words in each bullet. If any two\n"
            "bullets are within 3 words of each other, REWRITE the offender to a\n"
            "different length. Uniform-length bullets are the #1 AI tell."
        ),
        "card_format_hint": "standard",
    },
    "feature": {
        "title_block": (
            "LENGTH: 10-16 words. Often uses a colon for the subtitle half.\n"
            "Direct, no cutesy openers. No 'Wait,', no 'Here's why', no clickbait Q-marks."
        ),
        "bullet_block": (
            "BULLETS: 2-3 with EXPLICIT length staircase — short → medium → long.\n"
            "Bullet 1: 5-9 words (a punch).\n"
            "Bullet 2: 12-17 words (the meat).\n"
            "Bullet 3 (optional): 18-24 words (the context / payoff).\n"
            "\n"
            "Worked example (4 / 14 / 22 words):\n"
            '  ["**Dončić** went cold late.",                                                          (4 words)\n'
            '   "He shot 4-of-17 in a brutal fourth-quarter collapse.",                                 (10 words — fine)\n'
            '   "**Lakers** blew a 20-point lead, dropping the Western Conference series 2-1 with two road games next."] (19 words)\n'
            "\n"
            "FINAL CHECK: count words in each bullet. If any two are within 3 words of\n"
            "each other, REWRITE the offender. The staircase short → medium → long is\n"
            "the entire point — uniform bullets defeat the persona."
        ),
        "card_format_hint": "conversational",
    },
    "analysis": {
        "title_block": (
            "LENGTH: 11-16 words. Claim-led — state the finding directly.\n"
            "BANNED: 'Here's why', 'The reason X is Y', 'Why X matters' (clickbait endings)."
        ),
        "bullet_block": (
            "BULLETS: 2-3 long, dense bullets defending the thesis. Vary lengths:\n"
            "Bullet 1: 14-20 words.\n"
            "Bullet 2: 20-26 words.\n"
            "Bullet 3 (optional): 22-30 words.\n"
            "\n"
            "Worked example (16 / 24 / 28 words):\n"
            '  ["**Lakers** sent three first-round picks for a 26-year-old with a declining defensive box.",  (15 words)\n'
            '   "Cap impact is **$53M** locked in through 2028, blocking any move for a second star next summer.",  (18 words)\n'
            '   "**Dončić**\'s shot diet shifted from 38% to 51% mid-range over the last two seasons — high-volume mid-range scorers do not age well."]  (25 words)\n'
            "\n"
            "FINAL CHECK: count words. Two bullets within 3 words of each other =\n"
            "REWRITE one. At least 5 words of spread across the bullets total."
        ),
        "card_format_hint": "conversational",
    },
    "hot_take": {
        "title_block": (
            "LENGTH: 9-14 words. Declarative opinion ('X is overrated.' / 'Y is the best Z').\n"
            "BANNED: 'Here's why', any clickbait hook, opening question marks."
        ),
        "bullet_block": (
            "BULLETS: 1-2 bullets defending the stance with specifics.\n"
            "If 1: 14-22 words.\n"
            "If 2: bullet 1 12-15 words, bullet 2 19-25 words (different lengths).\n"
            "\n"
            "Worked 2-bullet example (13 / 21 words):\n"
            '  ["**BookTok** debuts now out-sell Big Five front-list titles 3:1.",          (10 words — within tolerance for ≤15)\n'
            '   "The publishing industry is racing to acquire indie authors whose entire marketing engine is one viral video."]  (17 words)\n'
            "\n"
            "FINAL CHECK: if two bullets exist and are within 3 words of each other,\n"
            "REWRITE one. Specific evidence (number / named actor) in every bullet."
        ),
        "card_format_hint": "hot_take",
    },
}

# Base weights for the picker. Tuned so news_flash is the workhorse (35%) and
# the other four split the remaining variety across the inventory.
_PERSONA_BASE_WEIGHTS = {
    "image_led":   0.10,
    "news_flash":  0.35,
    "feature":     0.20,
    "analysis":    0.20,
    "hot_take":    0.15,
}


def _pick_voice_persona(sources: List[Dict], cluster_id: int) -> Dict:
    """Choose one voice persona per article. Weighted random, nudged by
    source-shape signals (source count, image richness, dominant category)."""
    import random

    weights = dict(_PERSONA_BASE_WEIGHTS)

    # Single-source articles with a strong image lean image_led more often.
    if len(sources) == 1:
        weights["image_led"] *= 2.0

    # Multi-source heavy clusters lean feature/analysis (more to say).
    if len(sources) >= 4:
        weights["feature"] *= 1.5
        weights["analysis"] *= 1.5
        weights["image_led"] *= 0.5

    # Cluster-id keyed deterministic salt so the same article doesn't flip
    # personas on re-synthesis after a verification failure.
    rng = random.Random(cluster_id)
    keys = list(weights.keys())
    values = [weights[k] for k in keys]
    chosen = rng.choices(keys, weights=values, k=1)[0]
    persona = dict(VOICE_PERSONAS[chosen])
    persona["name"] = chosen
    return persona


def synthesize_multisource_article(sources: List[Dict], cluster_id: int, verification_feedback: Optional[Dict] = None) -> Optional[Dict]:
    """
    Synthesize one article from multiple sources using Gemini.

    Args:
        sources: List of source articles
        cluster_id: Cluster ID
        verification_feedback: Optional dict with 'discrepancies' and 'summary' from failed verification
    """
    import requests
    import json
    import time

    # Pick a structural voice persona for this article. The persona overrides
    # the global LENGTH rules in the prompt below — without this each article
    # collapsed to ~12-word bullets and ~9-word titles regardless of content.
    persona = _pick_voice_persona(sources, cluster_id)

    gemini_synthesis_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={gemini_key}"
    
    # Limit sources to avoid token limits
    limited_sources = sources[:10]  # Max 10 sources
    
    # Build prompt with all sources
    sources_text = "\n\n".join([
        f"SOURCE {i+1} ({s.get('source_name', 'Unknown')}):\n"
        f"Title: {s.get('title', 'Unknown')}\n"
        f"Content: {s.get('full_text', s.get('description', ''))[:1500]}"  # Increased from 800 to 1500 chars (~225 words)
        for i, s in enumerate(limited_sources)
    ])
    
    # Add verification feedback section if provided (for regeneration after failed verification)
    feedback_section = ""
    if verification_feedback:
        discrepancies = verification_feedback.get('discrepancies', [])
        summary = verification_feedback.get('summary', '')
        
        if discrepancies:
            feedback_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ PREVIOUS VERIFICATION FAILED - ERRORS TO FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERIFICATION SUMMARY: {summary}

ISSUES FOUND IN PREVIOUS VERSION:
"""
            for i, d in enumerate(discrepancies, 1):
                feedback_section += f"""
{i}. ERROR TYPE: {d.get('type', 'Unknown')}
   ISSUE: {d.get('issue', 'N/A')}
   WHAT YOU WROTE: {d.get('generated_claim', 'N/A')}
   WHAT SOURCES SAY: {d.get('source_fact', 'N/A')}
"""
            feedback_section += """
⚠️ CRITICAL: Fix these specific errors in your new version. Stick STRICTLY to the facts in the sources.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""
    
    today_str = datetime.now().strftime('%B %d, %Y')

    persona_addendum = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎚️ STRUCTURAL VOICE — '{persona['name']}'  (overrides the generic LENGTH rules below)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This article is being written in the '{persona['name']}' persona. The TITLE LENGTH
and BULLET LENGTH rules below OVERRIDE any general '6-12 words' or '5-22 words'
rules elsewhere in the prompt. These are non-negotiable.

TITLE RULES (override prompt's generic title-length section):
{persona['title_block']}

BULLET RULES (override prompt's generic bullet-length section):
{persona['bullet_block']}

PREFERRED card_format: '{persona['card_format_hint']}' — but use your judgment if
the content clearly needs a different shape. Don't force '{persona['card_format_hint']}'
onto an article whose source material doesn't fit it.

Two failure modes auto-reject this article:
  • Title violates the per-persona length range above.
  • Bullets violate the per-persona length pattern above (especially: two bullets
    within 3 words of each other on persona 'feature' or 'news_flash').
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""

    prompt = f"""You write posts for **Today+**, a text-first social platform (peer to TikTok, Threads, X, Instagram). NOT a news app. You synthesize {len(limited_sources)} source articles about the same story into ONE social post — title + bullets — that reads like a smart friend wrote it, not like wire-service journalism.

{persona_addendum}
⚠️ TODAY'S DATE: {today_str}
All these sources are RECENT news. Do NOT guess or invent dates — if sources don't mention a specific date, do NOT include one. Never write a date that contradicts when the sources were published.

SOURCES:
{sources_text}
{feedback_section}
{"⚠️ IMPORTANT: This is a REGENERATION after verification failure. Address the specific errors above and stick strictly to source facts." if verification_feedback else ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 STEP 1 — PICK A VOICE PERSONA (do this BEFORE writing anything)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the sources. Classify the dominant vertical. Then ADOPT THAT VOICE for both title and bullets. Do not write neutral. There is no neutral voice on a social feed.

  Tech / AI:                analyst-with-a-wink. Confident, specific, contrarian-friendly.
                            OK: "X just killed Y," benchmarks, comparisons.
                            Not OK: launch-language ("revolutionizing," "ecosystem").

  Sports (NFL/NBA/Soccer):  fan in a group chat. Hot-take energy.
                            OK: "clutch," "cooked," nicknames, the moment over the score.
                            Not OK: scoreboard recap voice ("with 47 seconds remaining").

  Entertainment / K-pop:    fandom insider. Knows in-group vocab. Reactions ARE the story.
                            OK: "comeback," "bias," "ate," KST/JST date drops.
                            Not OK: distant third-person reporter framing.

  Cooking / Food:           friend texting you a kitchen tip at 11pm. Sensory, conspiratorial.
                            OK: "trust me," sensory verbs (sizzles, melts, browns).
                            Not OK: "delicious," "yummy," "amazing" — auto-banned.

  Fashion / Beauty:         editor's eye. Vibey, named-detail oriented.
                            OK: brand names, prices, the one styling detail that works.
                            Not OK: "stunning," "chic," CTAs.

  Gaming:                   patch-notes-meets-memer. Specific stat changes + community.
                            OK: champion/character names, "nerf," "buff," build vocab.
                            Not OK: marketing-speak about "epic experiences."

  News / World / Politics:  plainspoken, consequence-led, NOT wire-service.
                            OK: "Mortgages just got cheaper." "The vote came in at 1am."
                            Not OK: AP-wire opening ("In a development that..."), passive.

  Business / Finance:       analyst-flat. Numbers + stakes. Confident takes welcome.
                            OK: "X is overpriced," named investors, specific ratios.
                            Not OK: SEC-filing register, "company officials confirmed."

If the article spans verticals, pick the dominant one and commit. Hybrid voice = no voice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ STEP 2 — TITLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 6-12 words / 40-90 characters. Never longer; the feed truncates.

LEAD WITH ONE OF:
  • The CONSEQUENCE: "Apple just killed the M4."
  • The MOMENT: "Doncic went 4-of-17 in the 4th."
  • The TAKE: "The new M5 is a scam."
  • The TURN: "BLACKPINK is back. The teaser site crashed in 6 minutes."

Do NOT lead with the announcement. "Apple announces new M5 chip" is the failure mode.

PERSON / TENSE:
  • First-person ("I tried...") — opinion / personal angle.
  • Second-person ("Why your iPhone just got faster") — utility / how-this-affects-you.
  • Third-person — hard news, but plainspoken (not wire-service).
  • Present tense for live energy, past tense for recap. Don't mix in one title.

VERB POSITION:
  • Strong content word (verb / proper noun / number) in the first 7 words.
  • Starting with a verb is FINE for declarations: "Stop using X." "Watch this."

WITHHOLD ONE THING:
  • Leave a gap (mechanism / why / how) for the bullets to fill.
  • A title that fully self-explains has nothing for the bullets to do, and the post collapses.
  • EXCEPTION: punchy_oneliner format intentionally has no gap (and no bullets).

NUMBERS:
  • Specific > round. "$317K" beats "$300K." "27%" beats "about a quarter."
  • One number per title max. Two competes for attention.
  • Don't force a number where there isn't one. Cooking and fashion titles often don't need one.

NAME RECOGNITION:
  • Globally known figures (Musk, Trump, Biden, Putin, Taylor Swift, Ronaldo): name only.
  • Lesser-known figures: include role/title — "**SD Governor Noem**", "**Rivian CEO RJ Scaringe**".
  • Rule: if a global reader might ask "who is this?", add the title.

BOLD HIGHLIGHTS:
  • 1-2 entities bolded. NEVER more.
  • Bold the entity the user would tap to learn more (brands, people, products, places).
  • NEVER bold verbs, adjectives, or articles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 STEP 3 — BULLETS (0-3, you decide)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bullets are NOT mandatory. Self-contained titles emit ZERO bullets. Forcing bullets onto a one-line declaration is the #1 thing that wrecks a social post.

WHEN TO RETURN ZERO BULLETS:
  • Title is a complete declaration ("Messi just retired.")
  • Title is a single-image moment (the photo carries the rest)
  • Title is a hot take that lands harder unannotated
  • If you find yourself writing a bullet that recaps the title, just don't.

WHEN TO RETURN 1-3 BULLETS:
  • The title raises a question the reader will want answered.
  • There are specific stakes / numbers / quotes worth pulling out.
  • Mix the count by content. 1 short + 1 medium > 3 uniform.

EVERY BULLET MUST:
  1. EXTEND the title, not recap it. If the bullet says the same thing the title already said in different words, regenerate.
     Title: "The Lakers blew a 20-point lead."
     ✗ Recap: "The Lakers lost after leading by 20." (says nothing new)
     ✓ Extend: "**Doncic** went 4-of-17 in the 4th."

  2. Contain AT LEAST ONE of: a bold-able named entity, a specific number, OR a direct quote. If none, the bullet is vapor — drop it.

  3. Use ONE of the four extension patterns:
     • MECHANISM — how/why ("The chip drops to 3nm and ships in October.")
     • STAKES — who wins/loses ("This is **TSMC**'s biggest exclusive in five years.")
     • CONTEXT — what came before ("Last year's M4 launched at $1,599. The M5 starts at $1,299.")
     • REACTION — culture/community response ("**Stan Twitter** broke at 3am KST.")

LENGTH:
  • 5-22 words per bullet. Mix lengths — one short, one medium creates rhythm.
  • Uniform 25-word bullets are the AI tell. Vary them.
  • Avoid wrap-to-3-lines. Mobile users skip those.

VOICE CONSISTENCY:
  • Match the title's persona. If the title is hot-take, bullets are hot-take.
  • Same person (1st/2nd/3rd), same tense, same energy.
  • Read the title and the first bullet aloud. If they sound like two different people, regenerate.

BOLD HIGHLIGHTS PER BULLET:
  • 1 entity bolded. NEVER more than 2. Bold makes it tappable in the app.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎴 STEP 4 — CARD FORMAT (think like a reader, not an editor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're NOT choosing how to summarize the content. You're choosing **how a social-media reader would most want to consume it.** Same story can be standard or hot_take depending on whether the reader is going to nod along or react. Ask: how does the reader engage with this story?

Most articles ARE standard. That's correct — standard is the baseline post type. But when ONE of the cues below clearly fires, pick the matching non-standard format. Don't stretch — if it's not obvious, standard is right. If it IS obvious, picking standard is wrong because you're hiding the format the reader expected.

  punchy_oneliner — Reader sees the title and there's nothing more to say.
                    The reaction IS the post. Use when the fact is fully self-
                    contained AND emotionally complete on its own line.
                    Cues:
                      • Title is a one-line declaration ("Messi just retired.")
                      • Title is a single-line breaking moment ("Fed cuts 50 bps.")
                      • Title is a one-line hot take that lands without backup
                    When this fires, summary_bullets = [] (zero bullets).
                    DO NOT pick this if the reader needs a single fact to
                    understand what happened — those are standard.

  listicle        — Reader expects an enumerated, scannable list.
                    Cues:
                      • Sources literally count items ("3 takeaways," "5 ways")
                      • Article is a ranked / recap roundup of distinct events
                      • Title says "X things..." or "Top N..."
                    Bullets carry distinct, parallel items in a clear order.

  hot_take        — Reader is going to react with agree/disagree, not just
                    nod along. The post is taking a stance.
                    Cues:
                      • Source is opinion / editorial / column
                      • Title is contrarian, calls something a scam / overrated
                        / underrated / dead / done
                      • Bullets defend the take with specific evidence
                    DO NOT pick for normal hard news (consequence-led plain
                    titles are standard, not hot_take, even if punchy).

  conversational  — Reader needs multiple beats to follow the story. There's
                    a setup, a turn, and a payoff that don't fit one card.
                    Cues:
                      • Story has a "wait for it" reveal mid-way through
                      • Multi-step explainer where each step depends on the
                        previous (how something happened, why it matters)
                      • A how-to or guide with sequenced steps

  comparison      — Reader wants to mentally hold X and Y side by side.
                    Cues:
                      • Sources explicitly frame "X vs Y," "before/after,"
                        "old vs new"
                      • Article's whole point is which-one-wins or how-they-differ
                      • Two named entities receive equal billing in sources

  story_arc       — Reader wants the whole arc, not a summary. Beginning,
                    middle, end — with momentum.
                    Cues:
                      • Sports recap with a comeback / collapse moment
                      • Recipe that builds (raw → cooked → plated)
                      • Reveal-style narrative (setup → reveal → reaction)
                      • Fashion show recap (look 1 → look 12 → closer)

  standard        — Default. Reader reads the title, scans the bullets, gets
                    the picture. The most common case across news / tech /
                    business / general updates. If none of the cues above
                    obviously fire, standard is correct.

The audit: after you pick, ask yourself "would a real reader think this
post is in the right shape?" If standard feels lazy because there's a
clear cue you ignored, switch. If a non-standard format feels stretchy
because you wanted variety, go back to standard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED — auto-fail (these will be regenerated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHRASES (anywhere in title or bullets):
  • "announces" / "announced" / "announcement"
  • "according to" / "in a statement" / "in a recent statement"
  • "Today," as the opening word of any title or bullet
  • "In a recent" / "In recent" as opener
  • "in a development" / "in a move that" / "in a surprise move"
  • "officials say" / "experts say" / "sources say"

WORDS:
  • Title: "shocking," "incredible," "you won't believe"
  • Bullet: "delicious," "amazing," "yummy" (cooking-persona ban)
  • Bullet: "stunning," "chic" (fashion-persona ban)
  • Anywhere: "revolutionary," "game-changing," "ecosystem" (corporate-speak)
  • Anywhere: "major," "significant," "various," "some" (vague-words)

PUNCTUATION:
  • Em dashes ( — ) — recognized AI tell in 2026. Use a period or line break.
  • Hashtags ( #anything ) — dead in 2026; do not include.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ BOLD ( **WORD** ) RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bold ONLY:
  ✓ Named people, brands, products, places, specific numbers.
Never bold:
  ✗ Verbs, adjectives, articles, common words, whole phrases.

COUNTS: title 1-2, each bullet 1 (max 2).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FACTUAL ACCURACY (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Voice is social. FACTS are still strictly sourced. Every name, number, date, country, and quote MUST come from the source articles. Strong opinions OK; invented facts are not.

  • Lock the COUNTRY/LOCATION before writing. Spain ≠ Turkey. UK ≠ US.
  • Lock KEY PEOPLE — exact names, exact roles.
  • Lock NUMBERS — verify each appears in a source.
  • If sources conflict, use the most-commonly stated fact.
  • Never combine facts from unrelated events.
  • Never invent a quote. Direct quotes must be verbatim from a source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IDENTIFY THE ARTICLE'S ANGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pick the actual story, not the most dramatic background fact.
  • If sources are about reactions, write about the REACTIONS.
  • If a major event is BACKGROUND, do not headline it.
  • If the event happened days/weeks ago, the post is about AFTERMATH.

Source: "Tech Workers React to Mass Layoffs at Google"
  ✗ "Google Cuts 12,000 Jobs" (old news, wire-service voice)
  ✓ "Tech workers are scared. Here's what they're saying after **Google**'s cuts."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OUTPUT FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "title": "6-12 word social title with 1-2 **bold** entities",
  "summary_bullets": [
    "0-3 bullets. Each extends the title and contains ≥1 bold entity OR specific number OR direct quote. 5-22 words. Mix lengths."
  ],
  "card_format": "punchy_oneliner | listicle | hot_take | conversational | comparison | story_arc | standard",
  "category": "Tech | Business | Science | Politics | Finance | Crypto | Health | Entertainment | Sports | World | Food | Fashion | Travel | Lifestyle | Gaming"
}}

If card_format is "punchy_oneliner", summary_bullets MUST be an empty array [].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EXAMPLES (one per persona to anchor voice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TECH/AI (standard):
{{
  "title": "**Apple**'s **M5** is here. The M4 just got cheaper.",
  "summary_bullets": [
    "27% faster CPU on the same 3nm process.",
    "**M4** quietly dropped to **$1,299** at midnight."
  ],
  "card_format": "standard",
  "category": "Tech"
}}

SPORTS (hot_take):
{{
  "title": "The **Lakers** blew a 20-point lead.",
  "summary_bullets": [
    "**Doncic** went 4-of-17 in the 4th.",
    "**Reaves** played 41 minutes — career high."
  ],
  "card_format": "hot_take",
  "category": "Sports"
}}

K-POP (story_arc):
{{
  "title": "**BLACKPINK** is back. The teaser site crashed in 6 minutes.",
  "summary_bullets": [
    "Comeback drops 14 May at midnight KST.",
    "**Jennie**'s solo teaser pulled 8M views in an hour."
  ],
  "card_format": "story_arc",
  "category": "Entertainment"
}}

PUNCHY_ONELINER (zero bullets):
{{
  "title": "**Messi** just retired.",
  "summary_bullets": [],
  "card_format": "punchy_oneliner",
  "category": "Sports"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ CRITICAL OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ALWAYS output valid JSON — never explanations or commentary
2. NEVER say "Looking at the sources" or explain your reasoning
3. Output starts with {{ and ends with }} — nothing else
4. If sources cover different topics, focus on the MAJORITY topic
5. If sources are completely unrelated, pick the MOST newsworthy one

Return ONLY valid JSON, no markdown, no explanations."""
    
    # Try up to 5 times with exponential backoff
    for attempt in range(5):
        try:
            # Build Gemini API request
            request_data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0,
                    "maxOutputTokens": 2048,
                    "responseMimeType": "application/json"
                }
            }

            response = requests.post(gemini_synthesis_url, json=request_data, timeout=60)

            # Handle rate limiting with exponential backoff
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 10  # 10s, 20s, 40s, 80s, 160s
                print(f"   ⚠️  Rate limited (attempt {attempt + 1}/5) - waiting {wait_time}s...")
                time.sleep(wait_time)
                continue

            if response.status_code >= 400:
                try:
                    error_body = response.json()
                    error_msg = str(error_body.get('error', {}).get('message', response.text[:500]))
                    print(f"   ⚠️  Gemini API error (attempt {attempt + 1}/5): {error_msg[:300]}")
                except Exception:
                    print(f"   ⚠️  Gemini API error (attempt {attempt + 1}/5): HTTP {response.status_code} - {response.text[:500]}")
                if attempt < 4:
                    time.sleep(3)
                continue

            response_json = response.json()

            # Get response text from Gemini format
            candidates = response_json.get('candidates', [])
            if not candidates:
                print(f"   ⚠️  No candidates in Gemini response (attempt {attempt + 1}/5)")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None

            response_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')

            if not response_text:
                print(f"   ⚠️  Empty response from Gemini (attempt {attempt + 1}/5)")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None

            # Clean response (remove markdown if present)
            response_text = response_text.replace('```json', '').replace('```', '').strip()

            if not response_text:
                print(f"   ⚠️  Response empty after cleaning (attempt {attempt + 1}/5)")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None

            # Check if model returned commentary instead of JSON
            if response_text.startswith('Looking') or response_text.startswith('I ') or not response_text.startswith('{'):
                print(f"   ⚠️  Gemini returned text instead of JSON (attempt {attempt + 1}/5)")
                print(f"      Preview: {response_text[:100]}...")
                if attempt < 4:
                    time.sleep(3)
                    continue
                return None

            # Parse JSON
            result = json.loads(response_text)

            # ─── Social-voice contract validation (2026-05-09 rewrite) ───
            #
            # Old contract: 250-550 char total bullets, exactly 1-3 items.
            # New contract:
            #   - title required (non-empty string)
            #   - summary_bullets is a list of 0-3 items (zero is valid for
            #     punchy_oneliner format; forcing 3 onto a one-line decla-
            #     ration was the documented top failure mode of the old
            #     wire-service prompt)
            #   - card_format from a fixed allowlist; falls back to 'standard'
            #   - category required
            # PLUS a banned-phrase gate: title and bullets must not contain
            # wire-service phrases the rewrite explicitly bans, even if the
            # prompt's instructions slipped past the model.
            VALID_CARD_FORMATS = {
                'punchy_oneliner', 'listicle', 'hot_take',
                'conversational', 'comparison', 'story_arc',
                'standard',
            }
            BANNED_PHRASES = (
                'announces', 'announced', 'announcement',
                'according to', 'in a statement', 'in a recent statement',
                'in a development', 'in a move that', 'in a surprise move',
                'officials say', 'experts say', 'sources say',
            )
            BANNED_OPENERS = ('today,', 'in a recent ', 'in recent ')

            def _has_banned_phrase(text):
                if not isinstance(text, str):
                    return None
                t = text.lower()
                for bp in BANNED_PHRASES:
                    if bp in t:
                        return bp
                for opener in BANNED_OPENERS:
                    if t.startswith(opener):
                        return f"opener:{opener!r}"
                return None

            errors = []

            title = result.get('title', '')
            if not isinstance(title, str) or not title.strip():
                errors.append('missing or empty title')

            bullets = result.get('summary_bullets', [])
            if not isinstance(bullets, list):
                errors.append('summary_bullets must be a list')
                bullets = []
            elif len(bullets) > 3:
                errors.append(f'summary_bullets has {len(bullets)} items (max 3) — keeping first 3')
                bullets = bullets[:3]
                result['summary_bullets'] = bullets

            if not isinstance(result.get('category'), str) or not result.get('category', '').strip():
                errors.append('missing category')

            # Banned-phrase gate
            hit = _has_banned_phrase(title)
            if hit:
                errors.append(f'title contains banned phrase: {hit}')
            for i, b in enumerate(bullets):
                hit = _has_banned_phrase(b)
                if hit:
                    errors.append(f'bullet[{i}] contains banned phrase: {hit}')

            # If any hard error and we still have retries, regenerate.
            if errors and attempt < 4:
                preview = '; '.join(errors[:3])
                print(f"   ⚠️  Social-voice gate failed (attempt {attempt + 1}/5): {preview}")
                time.sleep(3)
                continue
            if errors:
                # Final attempt — log and reject if title is empty; otherwise
                # accept with warnings (banned phrases are best-effort).
                if 'missing or empty title' in errors:
                    print(f"   ❌ Final attempt also failed: {errors}")
                    return None
                print(f"   ⚠️  Accepting with warnings after 5 attempts: {errors[:2]}")

            # Normalize card_format with fallback to 'standard'
            cf_raw = result.get('card_format')
            if isinstance(cf_raw, str) and cf_raw.strip().lower() in VALID_CARD_FORMATS:
                result['card_format'] = cf_raw.strip().lower()
            else:
                result['card_format'] = 'standard'

            # Punchy one-liners must have zero bullets — enforce so iOS
            # doesn't render an empty-styled bullet list.
            if result['card_format'] == 'punchy_oneliner':
                result['summary_bullets'] = []

            # Hard cap on image_led titles. Without bullets, the title carries
            # the whole story, but past 22 words it reads as a paragraph instead
            # of a caption. The prompt also enforces this, but truncate as a
            # safety net for the occasional runaway.
            if persona['name'] == 'image_led':
                _title = result.get('title', '')
                _words = _title.split()
                if len(_words) > 22:
                    truncated = ' '.join(_words[:22]).rstrip(',;:—-')
                    if not truncated.endswith(('.', '!', '?')):
                        truncated += '.'
                    print(f"   ✂️  image_led title was {len(_words)} words, truncated to 22: {truncated}")
                    result['title'] = truncated

            # Map to old field names for backward compatibility (downstream
            # orchestrator code reads these old names).
            result['title_news'] = result['title']
            result['summary_bullets_news'] = result['summary_bullets']
            return result

        except json.JSONDecodeError as e:
            print(f"   ⚠️  JSON parse error (attempt {attempt + 1}/5): {str(e)[:100]}")
            print(f"      Response preview: {response_text[:200] if response_text else 'EMPTY'}...")
            if attempt < 4:
                time.sleep(3)
                continue
            return None

        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            print(f"   ⚠️  API error (attempt {attempt + 1}/5): {error_msg[:100]}")
            if attempt < 4:
                time.sleep(3)
            continue

        except Exception as e:
            print(f"   ⚠️  Synthesis error (attempt {attempt + 1}/5): {str(e)[:100]}")
            if attempt < 4:
                time.sleep(3)
                continue
            return None

    print(f"   ❌ Failed after 5 attempts")
    return None


# ==========================================
# SINGLE CYCLE (for Cloud Run)
# ==========================================

def run_single_cycle():
    """
    Run a single iteration of the workflow.
    Used by Cloud Run to execute once per trigger.
    
    Returns:
        dict with stats about the run
    """
    try:
        result = run_complete_pipeline()
        return result or {
            'articles_processed': 0,
            'articles_published': 0,
            'clusters_found': 0,
            'errors': []
        }
    except Exception as e:
        return {
            'articles_processed': 0,
            'articles_published': 0,
            'clusters_found': 0,
            'errors': [str(e)]
        }


# ==========================================
# MAIN LOOP
# ==========================================

def main():
    """Run continuous workflow"""
    
    print("\n" + "="*80)
    print("🚀 COMPLETE 10-STEP CLUSTERED NEWS SYSTEM")
    print("="*80)
    print("\nThis system will:")
    print("  📰 Fetch RSS from 287 sources")
    print("  🎯 Score with Gemini V8.2")
    print("  🔗 Cluster similar events")
    print("  📡 Fetch full article text")
    print("  ✍️  Synthesize multi-source articles")
    print("  📋 Step 6: Select components (Gemini)")
    print("  🔍 Step 5: Search for context (Gemini, only if needed)")
    print("  📊 Step 7: Generate components (Gemini)")
    print("  🔬 Verify facts (catch hallucinations)")
    print("  💾 Publish to Supabase")
    print("\nPress Ctrl+C to stop")
    print("="*80)
    
    cycle = 0
    
    while True:
        try:
            cycle += 1
            print(f"\n\n{'#'*80}")
            print(f"# CYCLE {cycle} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'#'*80}")
            
            run_complete_pipeline()
            
            print(f"\n😴 Sleeping 5 minutes until next cycle...")
            time.sleep(300)  # 5 minutes = 300 seconds
            
        except KeyboardInterrupt:
            print("\n\n🛑 Stopped by user")
            break
        except Exception as e:
            print(f"\n❌ Error in cycle {cycle}: {e}")
            print("   Waiting 1 minute before retry...")
            time.sleep(60)
    
    print("\n✅ System stopped")


if __name__ == '__main__':
    main()


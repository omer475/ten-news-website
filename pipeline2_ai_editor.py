"""
PIPELINE 2 — AI EDITOR (Step 0)
================================
Generates curated-content *briefs* every 20-minute cycle. This module is
READ-ONLY with respect to the live feed: it ONLY writes rows to the
`curated_briefs` queue. The separate `pipeline2_processor.py` turns
pending briefs into published articles.

Per-cycle flow:
  1. gather_editor_inputs()       — date/season, recent news topics (so the
                                    editor doesn't duplicate hot news),
                                    last-30-day cooldown list, Wikipedia
                                    "on this day".
  2. ai_editor_generate_briefs()  — one Gemini 2.5 Flash call -> 10 briefs.
  3. filter_briefs()              — embed each topic (MiniLM 384-d) and drop
                                    any too-similar to a topic still inside
                                    its cooldown window (match_recent_topics RPC).
  4. insert_briefs()              — surviving briefs -> curated_briefs (pending).

Needs only GEMINI_API_KEY + Supabase service key + the free Wikipedia REST API.
No external content/image API keys required at this stage.
"""

import os
import json
import time
import uuid
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from supabase import create_client, Client

# ── Config ────────────────────────────────────────────────────────────────
EDITOR_MODEL = os.getenv('PIPELINE2_EDITOR_MODEL', 'gemini-2.5-flash')
EDITOR_TEMPERATURE = float(os.getenv('PIPELINE2_EDITOR_TEMPERATURE', '0.7'))
BRIEFS_PER_CYCLE = int(os.getenv('PIPELINE2_BRIEFS_PER_CYCLE', '10'))
# Cosine ≥ this against an in-cooldown topic => reject the candidate brief.
DEDUP_SIMILARITY_THRESHOLD = float(os.getenv('PIPELINE2_DEDUP_THRESHOLD', '0.85'))

VALID_BRIEF_TYPES = {
    'list', 'surprising_fact', 'explainer', 'recipe',
    'history', 'comparison', 'how_to', 'myth_busting',
}
VALID_ENTITY_SOURCES = {
    'google_places', 'books_api', 'tmdb', 'web_search', 'wikipedia', 'recipe_api',
}


def get_supabase_client() -> Client:
    url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


# ── Input gathering ─────────────────────────────────────────────────────────
def get_current_season(now: Optional[datetime] = None) -> str:
    """Meteorological season (Northern Hemisphere — most of our 15 countries)."""
    m = (now or datetime.now(timezone.utc)).month
    if m in (12, 1, 2):
        return 'winter'
    if m in (3, 4, 5):
        return 'spring'
    if m in (6, 7, 8):
        return 'summer'
    return 'autumn'


def get_recent_news_topics(supabase: Client, minutes: int = 90, limit: int = 30) -> List[str]:
    """
    Compact summary of what Pipeline 1 is currently covering, so the editor
    avoids piling onto the same hot stories. Returns "category: title" lines.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        res = supabase.table('published_articles') \
            .select('title_news, category, published_at') \
            .gte('published_at', cutoff) \
            .order('published_at', desc=True) \
            .limit(limit) \
            .execute()
        out = []
        for r in (res.data or []):
            title = (r.get('title_news') or '').replace('**', '').strip()
            if title:
                out.append(f"{r.get('category', 'News')}: {title}")
        return out
    except Exception as e:
        print(f"   ⚠️ [AI Editor] recent news topics fetch failed (non-fatal): {e}")
        return []


def get_recent_covered_topics(supabase: Client, days: int = 30, limit: int = 200) -> List[str]:
    """Topics Pipeline 2 has recently published (the AVOID list for the prompt)."""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        res = supabase.table('recently_covered_topics') \
            .select('topic, brief_type') \
            .gte('published_at', cutoff) \
            .order('published_at', desc=True) \
            .limit(limit) \
            .execute()
        return [f"{r['topic']} ({r.get('brief_type', '?')})" for r in (res.data or []) if r.get('topic')]
    except Exception as e:
        print(f"   ⚠️ [AI Editor] recent covered topics fetch failed (non-fatal): {e}")
        return []


def get_wikipedia_on_this_day(limit: int = 8) -> List[str]:
    """Free Wikipedia REST 'on this day' (selected events). No API key needed."""
    try:
        now = datetime.now(timezone.utc)
        url = f"https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/{now.month:02d}/{now.day:02d}"
        resp = requests.get(url, timeout=10, headers={'User-Agent': 'TenNewsBot/1.0 (curated content editor)'})
        if resp.status_code != 200:
            return []
        events = resp.json().get('selected', [])
        out = []
        for ev in events[:limit]:
            year = ev.get('year', '')
            text = (ev.get('text') or '').strip()
            if text:
                out.append(f"{year}: {text}")
        return out
    except Exception as e:
        print(f"   ⚠️ [AI Editor] Wikipedia on-this-day fetch failed (non-fatal): {e}")
        return []


def gather_editor_inputs(supabase: Client) -> Dict:
    return {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "season": get_current_season(),
        "rss_topic_clusters": get_recent_news_topics(supabase),
        "recent_topics": get_recent_covered_topics(supabase),
        "calendar_events": get_wikipedia_on_this_day(),
    }


# ── Prompt ────────────────────────────────────────────────────────────────
def build_editor_prompt(inputs: Dict) -> str:
    rss = "\n".join(f"- {t}" for t in inputs['rss_topic_clusters']) or "- (none this cycle)"
    recent = "\n".join(f"- {t}" for t in inputs['recent_topics']) or "- (none in last 30 days)"
    calendar = "\n".join(f"- {e}" for e in inputs['calendar_events']) or "- (none)"

    return f"""You are the editor for TodayPlus, a short-form reading app for users who want quality, useful content (not entertainment, not noise).

Your job: Generate exactly {BRIEFS_PER_CYCLE} article briefs for this 20-minute publishing cycle.

CONTEXT YOU HAVE:
- Today's date: {inputs['date']}
- Current season: {inputs['season']}
- Topics currently being covered by news (RSS this cycle):
{rss}
- Topics we've recently published (last 30 days, AVOID):
{recent}
- Historical anniversaries today:
{calendar}

REQUIRED CATEGORY DISTRIBUTION (HARD QUOTAS — must be met):
- Maximum 3 briefs in: news, politics, business, tech (only when RSS signals real news)
- At least 2 briefs in: food (recipes, restaurants, cuisine, ingredients)
- At least 1 brief in: science / explainers / how-things-work
- At least 1 brief in: history / cultural / anniversaries
- At least 1 brief in: fitness / health / lifestyle
- At least 1 brief in: travel / places / culture
- At least 1 surprising fact (any domain — counter-intuitive, mind-bending)

BRIEF TYPES YOU CAN USE:
1. list — "Top N X in Y" → uses Google Places, Books API, TMDB for entity data
2. surprising_fact — counter-intuitive fact → uses web search
3. explainer — how X works → uses web search + Wikipedia
4. recipe — how to make X → uses recipe APIs + web search
5. history — historical narrative → uses Wikipedia + web search
6. comparison — X vs Y → uses web search
7. how_to — step-by-step skill → uses web search
8. myth_busting — common belief vs reality → uses web search

FOR EACH BRIEF, OUTPUT JSON:
{{
  "topic": "specific topic statement (5-12 words, NEVER generic)",
  "brief_type": "list | surprising_fact | explainer | recipe | history | comparison | how_to | myth_busting",
  "category": "food | science | history | fitness | travel | news | culture | etc.",
  "hook_angle": "curiosity | contrarian | surprising_fact | promise | utility",
  "page_count": 3-8,
  "entity_source": "google_places | books_api | tmdb | web_search | wikipedia | recipe_api",
  "reasoning": "1-sentence why-this-now justification"
}}

CRITICAL RULES:
- Topics MUST be specific. WRONG: "Top restaurants in Asia" RIGHT: "Top 5 ramen spots in Tokyo's Shinjuku district"
- Topics MUST NOT semantically overlap with recently published topics (last 30 days)
- Distribute across cooldown windows — don't pick {BRIEFS_PER_CYCLE} "Top 5" lists in one cycle
- Each brief must be naturally interesting on its own — would YOU read this?

Return: JSON array of exactly {BRIEFS_PER_CYCLE} brief objects. No markdown, no commentary — only the JSON array."""


# ── Gemini call ─────────────────────────────────────────────────────────────
def _parse_brief_array(text: str) -> Optional[list]:
    """
    Parse a JSON array of brief objects, tolerating markdown fences, dict
    wrappers ({"briefs": [...]}), and truncation (drops a trailing incomplete
    object by scanning for balanced top-level {...} blocks).
    """
    if not text:
        return None
    text = text.replace('```json', '').replace('```', '').strip()

    # Fast path: strict parse.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            for k in ('briefs', 'results', 'items'):
                if isinstance(parsed.get(k), list):
                    return parsed[k]
            return [parsed]
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Salvage path: scan for complete top-level objects inside the array.
    start = text.find('[')
    if start == -1:
        start = text.find('{')
    if start == -1:
        return None
    objs, depth, in_str, esc, buf = [], 0, False, False, []
    for ch in text[start:]:
        if in_str:
            buf.append(ch)
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            buf.append(ch)
        elif ch == '{':
            if depth == 0:
                buf = []
            depth += 1
            buf.append(ch)
        elif ch == '}':
            depth -= 1
            buf.append(ch)
            if depth == 0:
                try:
                    objs.append(json.loads(''.join(buf)))
                except json.JSONDecodeError:
                    pass
                buf = []
        elif depth > 0:
            buf.append(ch)
    return objs or None


def _call_gemini_json(prompt: str, max_retries: int = 4) -> Optional[list]:
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("   ⚠️ [AI Editor] GEMINI_API_KEY not set — skipping")
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{EDITOR_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": EDITOR_TEMPERATURE,
            # Gemini 2.5 Flash has thinking ON by default, and thinking tokens
            # count against maxOutputTokens — they were starving the JSON and
            # truncating it mid-string. The editor needs no chain-of-thought, so
            # disable thinking and give the answer plenty of room.
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=90)
            if resp.status_code == 429:
                wait = (2 ** attempt) * 10
                print(f"   ⚠️ [AI Editor] rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code >= 400:
                print(f"   ⚠️ [AI Editor] Gemini error {resp.status_code}: {resp.text[:200]}")
                if attempt < max_retries - 1:
                    time.sleep(3)
                continue
            cands = resp.json().get('candidates', [])
            if not cands:
                if attempt < max_retries - 1:
                    time.sleep(3)
                continue
            text = cands[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            parsed = _parse_brief_array(text)
            if parsed:
                return parsed
            print(f"   ⚠️ [AI Editor] could not parse brief array (attempt {attempt + 1})")
        except json.JSONDecodeError as e:
            print(f"   ⚠️ [AI Editor] JSON parse error (attempt {attempt + 1}): {str(e)[:80]}")
        except requests.RequestException as e:
            print(f"   ⚠️ [AI Editor] request error (attempt {attempt + 1}): {str(e)[:80]}")
        if attempt < max_retries - 1:
            time.sleep(3)
    return None


def _validate_brief(b: Dict) -> Optional[Dict]:
    """Normalize/validate one brief object; return cleaned dict or None."""
    if not isinstance(b, dict):
        return None
    topic = (b.get('topic') or '').strip()
    brief_type = (b.get('brief_type') or '').strip().lower()
    category = (b.get('category') or '').strip().lower()
    if not topic or brief_type not in VALID_BRIEF_TYPES or not category:
        return None
    try:
        page_count = int(b.get('page_count', 4))
    except (TypeError, ValueError):
        page_count = 4
    page_count = max(3, min(8, page_count))
    entity_source = (b.get('entity_source') or 'web_search').strip().lower()
    if entity_source not in VALID_ENTITY_SOURCES:
        entity_source = 'web_search'
    return {
        'topic': topic,
        'brief_type': brief_type,
        'category': category,
        'hook_angle': (b.get('hook_angle') or '').strip().lower() or None,
        'page_count': page_count,
        'entity_source': entity_source,
        'reasoning': (b.get('reasoning') or '').strip() or None,
    }


def ai_editor_generate_briefs(supabase: Client) -> List[Dict]:
    inputs = gather_editor_inputs(supabase)
    print(f"   📋 [AI Editor] inputs: {len(inputs['rss_topic_clusters'])} recent news, "
          f"{len(inputs['recent_topics'])} cooldown topics, {len(inputs['calendar_events'])} anniversaries")
    raw = _call_gemini_json(build_editor_prompt(inputs))
    if not raw:
        return []
    briefs = [vb for vb in (_validate_brief(b) for b in raw) if vb]
    print(f"   ✅ [AI Editor] {len(briefs)}/{len(raw)} briefs valid")
    return briefs


# ── Dedup filter ─────────────────────────────────────────────────────────────
def _embed_topic(topic: str) -> Optional[List[float]]:
    """384-d MiniLM embedding (same model as Pipeline 1's embedding_minilm)."""
    try:
        from step1_5_event_clustering import get_embedding_minilm
        return get_embedding_minilm(topic)
    except Exception as e:
        print(f"   ⚠️ [AI Editor] embedding failed for {topic[:40]!r}: {str(e)[:60]}")
        return None


def _vec_literal(emb: List[float]) -> str:
    return '[' + ','.join(str(x) for x in emb) + ']'


def filter_briefs(supabase: Client, briefs: List[Dict], cycle_id: str) -> List[Dict]:
    """
    Embed each brief topic and drop any too-similar to a topic still in its
    cooldown window. Also dedups within the same batch. Attaches topic_embedding
    + cycle_id + status to survivors.
    """
    surviving: List[Dict] = []
    batch_embeddings: List[List[float]] = []
    for brief in briefs:
        emb = _embed_topic(brief['topic'])
        if emb is None:
            # Can't dedup safely; keep it but without embedding (processor can
            # still run it, and Stage-9 cooldown insert just won't have a vector).
            brief['topic_embedding'] = None
            brief['cycle_id'] = cycle_id
            brief['status'] = 'pending'
            surviving.append(brief)
            continue

        # 1) Against the persistent cooldown set (DB, HNSW)
        too_similar = False
        try:
            rpc = supabase.rpc('match_recent_topics', {
                'query_embedding': _vec_literal(emb),
                'match_threshold': DEDUP_SIMILARITY_THRESHOLD,
            }).execute()
            if rpc.data:
                hit = rpc.data[0]
                print(f"   ⏭️ [AI Editor] DROP (cooldown dup {hit.get('similarity', 0):.2f}): "
                      f"{brief['topic'][:50]} ~ {hit.get('topic', '')[:50]}")
                too_similar = True
        except Exception as e:
            print(f"   ⚠️ [AI Editor] dedup RPC failed (keeping brief): {str(e)[:80]}")

        # 2) Against earlier survivors in this same batch
        if not too_similar:
            for prev in batch_embeddings:
                if _cosine(emb, prev) >= DEDUP_SIMILARITY_THRESHOLD:
                    print(f"   ⏭️ [AI Editor] DROP (in-batch dup): {brief['topic'][:50]}")
                    too_similar = True
                    break

        if too_similar:
            continue

        brief['topic_embedding'] = _vec_literal(emb)
        brief['cycle_id'] = cycle_id
        brief['status'] = 'pending'
        surviving.append(brief)
        batch_embeddings.append(emb)

    return surviving


def _cosine(a: List[float], b: List[float]) -> float:
    import math
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ── Insert ──────────────────────────────────────────────────────────────────
def insert_briefs(supabase: Client, briefs: List[Dict]) -> int:
    if not briefs:
        return 0
    try:
        supabase.table('curated_briefs').insert(briefs).execute()
        return len(briefs)
    except Exception as e:
        print(f"   ⚠️ [AI Editor] batch insert failed ({str(e)[:80]}), inserting one-by-one...")
        n = 0
        for b in briefs:
            try:
                supabase.table('curated_briefs').insert(b).execute()
                n += 1
            except Exception as e2:
                print(f"   ⚠️ [AI Editor] insert failed for {b.get('topic', '?')[:40]}: {str(e2)[:60]}")
        return n


# ── Orchestrator ──────────────────────────────────────────────────────────────
def run_ai_editor_cycle(supabase: Optional[Client] = None, cycle_id: Optional[str] = None) -> Dict:
    """Generate -> dedup -> queue briefs for this cycle. Returns stats."""
    supabase = supabase or get_supabase_client()
    cycle_id = cycle_id or str(uuid.uuid4())

    print(f"\n{'='*70}\n🧠 PIPELINE 2 — AI EDITOR (cycle {cycle_id[:8]})\n{'='*70}")

    briefs = ai_editor_generate_briefs(supabase)
    if not briefs:
        print("   ⚠️ [AI Editor] no briefs generated this cycle")
        return {'generated': 0, 'survived_dedup': 0, 'queued': 0, 'cycle_id': cycle_id}

    survivors = filter_briefs(supabase, briefs, cycle_id)
    queued = insert_briefs(supabase, survivors)

    print(f"   📊 [AI Editor] generated={len(briefs)} survived_dedup={len(survivors)} queued={queued}")
    return {
        'generated': len(briefs),
        'survived_dedup': len(survivors),
        'queued': queued,
        'cycle_id': cycle_id,
    }


if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv()
    stats = run_ai_editor_cycle()
    print(f"\nDone: {stats}")

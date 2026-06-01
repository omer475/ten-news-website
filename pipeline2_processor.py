"""
PIPELINE 2 — PROCESSOR
=======================
Turns `pending` curated_briefs into published multi-page articles.

Per brief:
  1. research_brief()      — Gemini 2.5 Flash + Google Search grounding ->
                             intro_text + one entity/item per content page.
  2. assign_images         — Wikimedia (free) -> one pooled Unsplash query/brief
                             -> og:image, each candidate through the same Gemini
                             Vision gate; best secured image reused for any miss; each
                             candidate passed through the SAME Gemini Vision
                             quality gate Pipeline 1 uses.
  3. write_post()          — Gemini 2.5 Flash (JSON) -> pages[{title,bullets,body}].
  4. fact-verify           — step8 FactVerifier for non-list briefs.
  5. quality_gate()        — HARD enforcement: banned words (regex), title/
                             bullet length, em-dash/hashtag, every page imaged,
                             bullet!=title recap. No "accept with warnings".
  6. publish_curated()     — insert into published_articles (source_type=
                             'curated_brief', format, pages) WITH full feed
                             parity (embedding_minilm + Trinity vq codes +
                             ai_final_score + interest_tags) so the post is
                             visible to the recommender.
  7. track_cooldown()      — recently_covered_topics row with per-type cooldown.

Image keys: Wikimedia needs none; Unsplash uses UNSPLASH_ACCESS_KEY (optional —
skipped gracefully if unset). Google Places / TMDB / Books / Spoonacular / Imagen
are deferred (handlers fall back to Gemini web-search + the image chain above).
"""

import os
import re
import json
import time
import math
import requests
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional

from pipeline2_ai_editor import get_supabase_client, _vec_literal, _cosine, _parse_brief_array

# ── Config ────────────────────────────────────────────────────────────────
WRITER_MODEL = os.getenv('PIPELINE2_WRITER_MODEL', 'gemini-2.5-flash')
RESEARCH_MODEL = os.getenv('PIPELINE2_RESEARCH_MODEL', 'gemini-2.5-flash')
PROCESS_LIMIT = int(os.getenv('PIPELINE2_PROCESS_LIMIT', '8'))
PROCESS_WORKERS = int(os.getenv('PIPELINE2_PROCESS_WORKERS', '5'))
IMAGE_QC = os.getenv('PIPELINE2_IMAGE_QC', '1') == '1'   # run Gemini Vision gate on candidate images
RECAP_SIM_THRESHOLD = float(os.getenv('PIPELINE2_RECAP_THRESHOLD', '0.9'))

COOLDOWN_BY_TYPE = {
    'list': 45, 'surprising_fact': 180, 'explainer': 120, 'recipe': 90,
    'history': 365, 'comparison': 60, 'how_to': 60, 'myth_busting': 120,
}

# Wikimedia-first categories/types (history / science / cultural). Everything
# else gets Unsplash first. Per user direction 2026-05-24.
WIKIMEDIA_FIRST_TYPES = {'history'}
WIKIMEDIA_FIRST_CATEGORIES = {'history', 'science', 'culture', 'cultural', 'space'}

BANNED_WORDS = [
    'announces', 'unveils', 'reveals', 'significant', 'major', 'massive', 'amid',
    'sweeping', 'key', 'shocking', 'incredible', 'amazing', "you won't believe",
    'trust me', 'ate', 'cooked', 'clutch', 'epic', 'game-changing', 'revolutionary',
    'ecosystem', 'delicious', 'stunning', 'chic',
]
_BANNED_RE = re.compile(r'(?<!\w)(' + '|'.join(re.escape(w) for w in BANNED_WORDS) + r')(?!\w)', re.IGNORECASE)


# ── Gemini helpers ───────────────────────────────────────────────────────────
def _gemini_url(model: str) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={os.getenv('GEMINI_API_KEY')}"


def _gemini_grounded_text(prompt: str, model: str, max_retries: int = 3) -> Optional[str]:
    """Grounded call (Google Search tool). Returns raw text (grounding + JSON mode conflict, so no responseMimeType)."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 8192, "thinkingConfig": {"thinkingBudget": 0}},
    }
    for attempt in range(max_retries):
        try:
            resp = requests.post(_gemini_url(model), json=payload, timeout=90)
            if resp.status_code == 429:
                time.sleep((2 ** attempt) * 10)
                continue
            if resp.status_code >= 400:
                print(f"      ⚠️ research error {resp.status_code}: {resp.text[:150]}")
                time.sleep(3)
                continue
            cands = resp.json().get('candidates', [])
            if cands:
                parts = cands[0].get('content', {}).get('parts', [])
                return ''.join(p.get('text', '') for p in parts)
        except requests.RequestException as e:
            print(f"      ⚠️ research request error: {str(e)[:80]}")
            time.sleep(3)
    return None


def _gemini_json(prompt: str, model: str, max_retries: int = 4) -> Optional[dict]:
    """JSON-mode call (no tools), thinking disabled. Returns parsed dict."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.6, "maxOutputTokens": 8192,
            "responseMimeType": "application/json", "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for attempt in range(max_retries):
        try:
            resp = requests.post(_gemini_url(model), json=payload, timeout=90)
            if resp.status_code == 429:
                time.sleep((2 ** attempt) * 10)
                continue
            if resp.status_code >= 400:
                print(f"      ⚠️ writer error {resp.status_code}: {resp.text[:150]}")
                time.sleep(3)
                continue
            cands = resp.json().get('candidates', [])
            if not cands:
                time.sleep(3)
                continue
            text = cands[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            text = text.replace('```json', '').replace('```', '').strip()
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                # salvage first balanced object
                objs = _parse_brief_array(text)
                if objs and isinstance(objs[0], dict):
                    return objs[0]
        except requests.RequestException as e:
            print(f"      ⚠️ writer request error: {str(e)[:80]}")
            time.sleep(3)
    return None


def _extract_json(text: str) -> Optional[dict]:
    """Pull the first JSON object out of grounded free-text."""
    if not text:
        return None
    text = text.replace('```json', '').replace('```', '').strip()
    start = text.find('{')
    if start == -1:
        return None
    objs = _parse_brief_array(text[start:])
    return objs[0] if objs and isinstance(objs[0], dict) else None


# ── Stage 1: queue pickup ─────────────────────────────────────────────────────
def get_pending_briefs(supabase, limit: int = PROCESS_LIMIT) -> List[Dict]:
    res = supabase.table('curated_briefs').select('*') \
        .eq('status', 'pending').order('created_at', desc=True).limit(limit).execute()
    return res.data or []


def mark_brief(supabase, brief_id: str, status: str, **fields):
    payload = {'status': status, **fields}
    if status in ('published', 'failed'):
        payload['processed_at'] = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table('curated_briefs').update(payload).eq('id', brief_id).execute()
    except Exception as e:
        print(f"      ⚠️ could not update brief {brief_id}: {str(e)[:60]}")


def claim_brief(supabase, brief_id: str) -> bool:
    """Atomically claim a brief for processing. Flips pending -> in_progress ONLY
    if it is still pending, so two overlapping job executions can't both grab the
    same brief and double-publish it. Returns True if THIS worker won the claim,
    False if another worker already took it (skip)."""
    try:
        res = supabase.table('curated_briefs') \
            .update({'status': 'in_progress'}) \
            .eq('id', brief_id).eq('status', 'pending').execute()
        return bool(res.data)  # non-empty => we flipped the row; empty => already claimed
    except Exception as e:
        print(f"      ⚠️ could not claim brief {brief_id}: {str(e)[:60]}")
        return False


# ── Stage 2: research ──────────────────────────────────────────────────────────
def research_brief(brief: Dict) -> Optional[Dict]:
    n_items = max(2, brief['page_count'] - 1)  # page 1 is the intro
    prompt = f"""Research this topic for a short-form reading-app post. Use web search to get accurate, current facts.

TOPIC: {brief['topic']}
TYPE: {brief['brief_type']}
CATEGORY: {brief['category']}

Produce JSON (no markdown):
{{
  "intro_text": "2-3 sentence factual overview of the theme",
  "entities": [
    {{"name": "specific item/entity/concept name", "facts": ["concrete fact 1", "concrete fact 2", "concrete fact 3"]}}
  ],
  "research_sources": ["https://...", "https://..."]
}}

Rules:
- Return EXACTLY {n_items} entities, one per content page, in a sensible order.
- Each fact must be concrete and verifiable (numbers, names, dates). No fluff.
- For list/comparison: each entity is one list item / one side. For explainer/how_to: each entity is one step/concept. For history: chronological beats. For surprising_fact/myth_busting: each entity is one fact/myth+reality.
- research_sources: the actual URLs you used.
Return ONLY the JSON object."""
    raw = _gemini_grounded_text(prompt, RESEARCH_MODEL)
    data = _extract_json(raw)
    if not data or not isinstance(data.get('entities'), list) or not data['entities']:
        return None
    data['entities'] = data['entities'][:n_items]
    data.setdefault('intro_text', '')
    data.setdefault('research_sources', [])
    return data


# ── Stage 3: image sourcing ────────────────────────────────────────────────────
def _wikimedia_image(query: str) -> Optional[str]:
    try:
        from urllib.parse import quote
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(query.replace(' ', '_'))}"
        r = requests.get(url, timeout=10, headers={'User-Agent': 'TenNewsBot/1.0'})
        if r.status_code == 200:
            j = r.json()
            return (j.get('originalimage') or {}).get('source') or (j.get('thumbnail') or {}).get('source')
    except Exception:
        pass
    return None


def _unsplash_pool(query: str, count: int = 8) -> List[str]:
    """ONE Unsplash search -> a pool of candidate image URLs. Replaces per-page
    Unsplash calls (demo tier = 50 req/hour) with one pooled query per brief."""
    key = os.getenv('UNSPLASH_ACCESS_KEY')
    if not key:
        return []
    try:
        r = requests.get('https://api.unsplash.com/search/photos',
                         params={'query': query, 'per_page': count, 'orientation': 'landscape'},
                         headers={'Authorization': f'Client-ID {key}'}, timeout=10)
        if r.status_code == 200:
            return [x.get('urls', {}).get('regular')
                    for x in r.json().get('results', [])
                    if x.get('urls', {}).get('regular')]
        if r.status_code == 403:
            print("      ⚠️ Unsplash 403 (rate limit / demo cap) — falling back to Wikimedia/og")
    except Exception:
        pass
    return []


def _og_image_from_url(url: str) -> Optional[str]:
    try:
        from bs4 import BeautifulSoup
        r = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'}, stream=True)
        content = b''
        for chunk in r.iter_content(8192):
            content += chunk
            if len(content) > 50000:
                break
        soup = BeautifulSoup(content.decode('utf-8', errors='ignore'), 'html.parser')
        tag = soup.find('meta', property='og:image') or soup.find('meta', attrs={'name': 'twitter:image'})
        if tag and tag.get('content'):
            img = tag['content']
            return ('https:' + img) if img.startswith('//') else img
    except Exception:
        pass
    return None


def _qc_check(url: str) -> tuple:
    """Return (passed: bool, confidence: int). When QC is disabled, treat as
    passed with a neutral confidence so intro-reuse ranking still works."""
    if not IMAGE_QC:
        return True, 75
    try:
        from image_quality_checker import ImageQualityChecker
        res = ImageQualityChecker().check_image(url)
        conf = int(res.get('confidence', 0))
        ok = bool(res.get('suitable')) and conf >= 70 and not res.get('error')
        return ok, conf
    except Exception as e:
        print(f"      ⚠️ image QC error (accepting): {str(e)[:60]}")
        return True, 70


def assign_images(brief: Dict, pages: List[Dict], research_sources: List[str]) -> bool:
    """Give every page an image while minimizing Unsplash usage:
      - Wikimedia (free, unlimited) per page title.
      - ONE pooled Unsplash query per brief (lazy — only fetched if a page needs
        it — combined query = the brief topic), drawn distinct per page + cached.
      - og:image from research sources as a last resort.
      - Any page still missing reuses the highest-confidence image already secured
        in the brief (one good image saves the whole brief).
    Returns True iff every page ends with an image."""
    prefer_wikimedia = (brief['brief_type'] in WIKIMEDIA_FIRST_TYPES
                        or brief['category'] in WIKIMEDIA_FIRST_CATEGORIES)

    pool = {'items': None, 'idx': 0}  # lazy + cached: at most ONE Unsplash call/brief

    def _from_pool(_title):
        if pool['items'] is None:
            pool['items'] = _unsplash_pool(brief['topic'], count=max(len(pages) + 3, 6))
        while pool['idx'] < len(pool['items']):
            url = pool['items'][pool['idx']]
            pool['idx'] += 1
            ok, conf = _qc_check(url)
            if ok:
                return url, conf
        return None, -1

    def _from_wiki(title):
        wu = _wikimedia_image(title)
        if wu:
            ok, conf = _qc_check(wu)
            if ok:
                return wu, conf
        return None, -1

    confidences = [-1] * len(pages)
    for i, page in enumerate(pages):
        order = [_from_wiki, _from_pool] if prefer_wikimedia else [_from_pool, _from_wiki]
        url, conf = None, -1
        for fn in order:
            u, c = fn(page['title'])
            if u:
                url, conf = u, c
                break
        if not url:  # og:image last resort
            for src in (research_sources or [])[:3]:
                ou = _og_image_from_url(src)
                if ou:
                    ok, c = _qc_check(ou)
                    if ok:
                        url, conf = ou, c
                        break
        page['image_url'] = url
        confidences[i] = conf if url else -1

    # Global reuse: fill any missing page with the best secured image in the brief.
    best_url, best_conf = None, -1
    for i, page in enumerate(pages):
        if page.get('image_url') and confidences[i] > best_conf:
            best_url, best_conf = page['image_url'], confidences[i]
    if best_url is None:
        return False  # no page got any image — can't fabricate one
    reused = sum(1 for p in pages if not p.get('image_url'))
    for page in pages:
        if not page.get('image_url'):
            page['image_url'] = best_url
    if reused:
        print(f"      ↺ reused best image (conf {best_conf}) for {reused} page(s)")
    return True


# ── Stage 5: writer ───────────────────────────────────────────────────────────
def _build_writer_prompt(brief: Dict, research: Dict, feedback: Optional[str] = None) -> str:
    entities_json = json.dumps(research.get('entities', []), ensure_ascii=False)
    fb = f"\n⚠️ FIX FROM YOUR LAST ATTEMPT: {feedback}\n" if feedback else ""
    return f"""You are writing a TodayPlus post. The post has {brief['page_count']} pages.
{fb}
BRIEF: {brief['topic']}
TYPE: {brief['brief_type']}
HOOK ANGLE: {brief.get('hook_angle') or 'curiosity'}

RESEARCH (use these as your source of truth):
{entities_json}

INTRO CONTEXT: {research.get('intro_text', '')}

PAGES TO WRITE (carousel structure):
Page 1 = COVER. One scroll-stopping hook: a surprising number, a bold claim, or a sharp question. NOT "why this matters", NOT a summary. Make the reader need page 2. Keep it short: a title, optional one-line subline.
Pages 2..N = ONE idea per page, one researched entity each, in the given order. Each page delivers a single concrete unit carried by a real number, name, place, or quote. Land the FINAL page on a payoff: its last sentence delivers the closing point, it does not trail off.

PER-PAGE LENGTH (match the text to what carries the page):
- TEXT-LED page (the writing IS the value: science, history, how/why): write a dense `body` of 2-4 full sentences packed with specifics (numbers, mechanism, names). This is the default for explainer/history/surprising-fact entities. Bullets optional on top.
- IMAGE-LED page (a product, place, car, dish, or person the photo carries): keep it SHORT. A label-style title plus at most one bullet. Do not pad; let the image work.
- VARY length deliberately page to page. Uniform-length pages are the AI tell.

For each page, write:
- title (3-12 words, no clickbait, no wire-speak). On the cover it is the hook.
  On INTERIOR pages, write a punchy one-line take a friend would text, NOT a textbook section header.
  It should make a point or surprise, not just label the topic.
    GOOD: "Salt earlier, not more"  /  "The Romans cracked it with a screw"  /  "Then the streak hit 27 years"
    BAD (header-speak, avoid): "Roman Engineering for Oil Extraction"  /  "Physiological Stressors Mount"  /  "Playoff Struggles Begin"
- bullets (0-3, each 5-22 words, full sentences; every bullet carries a number/name/place/quote and never recaps the title)
- body (long-form prose for TEXT-LED pages: 2-4 specific sentences; null on image-led/short pages)

VOICE: Clear, curious, specific. A smart friend who actually knows the subject. Confident, never padded, no "here's why this matters".

BANNED WORDS (do NOT use any): {', '.join(BANNED_WORDS)}
BANNED PUNCTUATION: em-dashes, hashtags.

OUTPUT JSON (no markdown):
{{
  "format": "C",
  "pages": [
    {{"title": "...", "bullets": ["...", "..."], "body": null}}
  ]
}}
Return EXACTLY {brief['page_count']} pages. Use format "D" instead of "C" only if most pages need a prose `body`."""


def write_post(brief: Dict, research: Dict, feedback: Optional[str] = None) -> Optional[Dict]:
    data = _gemini_json(_build_writer_prompt(brief, research, feedback), WRITER_MODEL)
    if not data or not isinstance(data.get('pages'), list) or not data['pages']:
        return None
    fmt = data.get('format', 'C')
    if fmt not in ('C', 'D'):
        fmt = 'C'
    # normalize pages
    pages = []
    for p in data['pages']:
        if not isinstance(p, dict):
            continue
        pages.append({
            'title': (p.get('title') or '').strip(),
            'bullets': [b.strip() for b in (p.get('bullets') or []) if isinstance(b, str) and b.strip()][:3],
            'body': (p.get('body') or None),
            'image_url': None,
        })
    return {'format': fmt, 'pages': pages} if pages else None


# ── Stage 7: quality gate (HARD) ───────────────────────────────────────────────
def quality_gate_text(post: Dict, brief: Dict) -> Optional[str]:
    """Text-only quality gate (banned words/length/recap). Image presence is
    enforced separately after sourcing. Return None if it passes, else a reason."""
    pages = post.get('pages', [])
    if not pages:
        return 'no_pages'

    # embedding helper for recap detection
    def _emb(t):
        try:
            from step1_5_event_clustering import get_embedding_minilm
            return get_embedding_minilm(t)
        except Exception:
            return None

    for i, page in enumerate(pages):
        title = page.get('title', '')
        bullets = page.get('bullets', [])
        body = page.get('body') or ''
        blob = ' '.join([title] + bullets + [body])

        # banned words
        m = _BANNED_RE.search(blob)
        if m:
            return f"banned_word:{m.group(0)!r}@page{i+1}"
        # banned punctuation
        if '—' in blob or '#' in blob:
            return f"banned_punctuation@page{i+1}"
        # title length 3-12 words. (Spec said 5-12 for a social headline, but
        # curated PAGE titles are section headers — 3-4 word headers like
        # "Understanding ADHD: Beyond Hyperactivity" are good; only 1-2 word
        # stubs are junk.)
        tw = len(title.split())
        if tw < 3 or tw > 12:
            return f"title_len:{tw}w@page{i+1}"
        # bullet length 5-22 words
        for b in bullets:
            bw = len(b.split())
            if bw < 5 or bw > 22:
                return f"bullet_len:{bw}w@page{i+1}"
        # bullet must extend, not recap, the title
        te = _emb(title)
        if te:
            for b in bullets:
                be = _emb(b)
                if be and _cosine(te, be) > RECAP_SIM_THRESHOLD:
                    return f"bullet_recaps_title@page{i+1}"
    return None


def _feedback_for(reason: str) -> str:
    """Turn a quality-gate failure code into a concrete instruction for the writer."""
    if reason.startswith('banned_word:'):
        word = reason.split("'")[1] if "'" in reason else 'a banned word'
        return f'Your previous version used the banned word "{word}". Rewrite without it; avoid every banned word.'
    if reason.startswith('title_len'):
        return 'A page title was the wrong length. Keep every page title between 3 and 12 words.'
    if reason.startswith('bullet_len'):
        return 'A bullet was the wrong length. Keep every bullet between 5 and 22 words.'
    if reason.startswith('banned_punctuation'):
        return 'Remove all em-dashes and hashtags.'
    if reason.startswith('bullet_recaps_title'):
        return 'A bullet just restated its page title. Make every bullet add a NEW concrete fact.'
    return f'Fix this issue from your previous version: {reason}.'


# ── Stage 6: fact verification ─────────────────────────────────────────────────
def run_fact_check(brief: Dict, post: Dict, research: Dict) -> Optional[Dict]:
    """ADVISORY (2026-05-24): run the verifier and return its verdict for logging,
    but NEVER block publishing. Curated content is web-search-grounded, and the
    news verifier (writing-vs-research-notes) is structurally mismatched for it.
    Returns {'verified', 'discrepancies', 'summary'} or None (skipped/error).

    TODO(before launch): replace with a curated-specific verifier that runs FRESH
    web searches against the FINAL article's hard claims (numbers/dates/names),
    instead of comparing the writing to the AI's own research notes."""
    if brief['brief_type'] == 'list':
        return None
    try:
        from step8_fact_verification import FactVerifier
        sources = [{
            'source_name': 'research',
            'title': brief['topic'],
            'full_text': research.get('intro_text', '') + '\n' +
                         '\n'.join(f"{e.get('name','')}: " + '; '.join(e.get('facts', []))
                                   for e in research.get('entities', [])),
        }]
        all_bullets = [b for p in post['pages'] for b in p.get('bullets', [])]
        generated = {'title': post['pages'][0]['title'], 'summary_bullets': all_bullets}
        verified, disc, summary = FactVerifier().verify_article(sources, generated, debug=False)
        return {'verified': bool(verified), 'discrepancies': disc or [], 'summary': summary or ''}
    except Exception as e:
        print(f"      ⚠️ fact check error (advisory, ignoring): {str(e)[:60]}")
        return None


def log_fact_check(supabase, brief: Dict, article_id: int, fc: Optional[Dict]):
    """Persist the advisory fact-check verdict for later analysis."""
    if not fc:
        return
    try:
        supabase.table('fact_check_log').insert({
            'curated_brief_id': brief['id'],
            'published_article_id': article_id,
            'verified': fc['verified'],
            'discrepancies': fc['discrepancies'],
            'summary': fc['summary'],
        }).execute()
    except Exception as e:
        print(f"      ⚠️ fact_check_log insert failed: {str(e)[:60]}")


# ── Stage 8: publish (full feed parity) ─────────────────────────────────────────
def publish_curated(supabase, brief: Dict, post: Dict) -> Optional[int]:
    """
    Insert the curated post into published_articles with the same feed-critical
    fields Pipeline 1 stamps (embedding_minilm + Trinity vq codes + score + tags),
    so the recommender can actually serve it. Lazy-imports the heavy workflow
    helpers (only succeeds where GEMINI/BRIGHTDATA/Supabase secrets exist, i.e.
    in prod).
    """
    from step1_5_event_clustering import get_embedding_minilm
    from step10_article_scoring import score_article_with_references, generate_interest_tags
    from step11_article_tagging import tag_article
    from complete_clustered_8step_workflow import (
        assign_vq_clusters, canonicalize_category, compute_expected_read_seconds,
    )

    pages = post['pages']
    title = pages[0]['title']
    all_bullets = [b for p in pages for b in p.get('bullets', [])]
    embed_text = f"{title} {' '.join(all_bullets)}"

    # Title-dedup guard: distinct briefs on near-identical topics (and same-brief
    # races across overlapping runs) can converge on the SAME cover title. Skip if
    # a curated article with this exact title was published in the dedup window, so
    # the feed never shows two identical-titled carousels.
    try:
        norm_title = ' '.join(title.lower().split())
        since = (datetime.now(timezone.utc) - timedelta(days=int(os.getenv('PIPELINE2_TITLE_DEDUP_DAYS', '7')))).isoformat()
        existing = supabase.table('published_articles') \
            .select('id,title_news') \
            .eq('source_type', 'curated_brief') \
            .gte('published_at', since).execute()
        for r in (existing.data or []):
            if ' '.join((r.get('title_news') or '').lower().split()) == norm_title:
                print(f"      ⏭ duplicate title already published (#{r['id']}): {title!r} — skipping")
                return None
    except Exception as e:
        print(f"      ⚠️ title-dedup check failed (continuing): {str(e)[:60]}")

    embedding_minilm = get_embedding_minilm(embed_text)
    vq_primary, vq_secondary = assign_vq_clusters(embedding_minilm, supabase)
    if vq_primary is None:
        print(f"      ❌ Trinity stamping failed — skipping (would be invisible to feed)")
        return None

    gemini_key = os.getenv('GEMINI_API_KEY')
    category = canonicalize_category(brief.get('category', 'Other'))
    try:
        score_res = score_article_with_references(title, all_bullets, gemini_key, supabase)
        ai_raw = score_res.get('score', 600) if isinstance(score_res, dict) else 600
    except Exception:
        ai_raw = 600
    # Curated score FLOOR (2026-05-24): the news-importance scorer rates evergreen
    # content low (~350), which would bury it in ranked views. Floor at 650 (env
    # PIPELINE2_SCORE_FLOOR); keep the raw score in ai_final_score_raw.
    # TODO(post-launch): replace this floor with a real curated-quality scorer
    # (hook strength / page coherence / image-text fit — a separate dimension
    # from news importance).
    ai_final = max(ai_raw, int(os.getenv('PIPELINE2_SCORE_FLOOR', '650')))
    try:
        interest_tags = generate_interest_tags(title, all_bullets, gemini_key)
    except Exception:
        interest_tags = []
    try:
        tags = tag_article(title, all_bullets, category, gemini_key)
        countries, topics = tags.get('countries', []), tags.get('topics', [])
    except Exception:
        countries, topics = [], []

    row = {
        'title_news': title,
        'summary_bullets_news': pages[0].get('bullets', []),
        'category': category,
        'format': post.get('format', 'C'),
        'pages': pages,
        'source_type': 'curated_brief',
        'curated_brief_id': brief['id'],
        'article_type': 'standard',
        'image_url': pages[0].get('image_url'),
        'num_sources': 0,
        'published_at': datetime.now(timezone.utc).isoformat(),
        'ai_final_score': ai_final,
        'ai_final_score_raw': ai_raw,
        'interest_tags': interest_tags,
        'countries': countries,
        'topics': topics,
        'embedding_minilm': embedding_minilm,
        'vq_primary': vq_primary,
        'vq_secondary': vq_secondary,
        'freshness_category': 'evergreen',
        'shelf_life_days': COOLDOWN_BY_TYPE.get(brief['brief_type'], 90),
        'expected_read_seconds': compute_expected_read_seconds(title, all_bullets),
    }
    res = supabase.table('published_articles').insert(row).execute()
    return res.data[0]['id'] if res.data else None


# ── Stage 9: cooldown tracking ──────────────────────────────────────────────────
def track_cooldown(supabase, brief: Dict):
    cooldown = COOLDOWN_BY_TYPE.get(brief['brief_type'], 90)
    now = datetime.now(timezone.utc)
    row = {
        'topic': brief['topic'],
        'brief_type': brief['brief_type'],
        'category': brief['category'],
        'topic_embedding': brief.get('topic_embedding'),  # already a vector literal/string
        'published_at': now.isoformat(),
        'cooldown_days': cooldown,
        'eligible_after': (now + timedelta(days=cooldown)).isoformat(),
    }
    try:
        supabase.table('recently_covered_topics').insert(row).execute()
    except Exception as e:
        print(f"      ⚠️ cooldown insert failed: {str(e)[:60]}")


# ── Orchestration ───────────────────────────────────────────────────────────────
def process_brief(supabase, brief: Dict) -> bool:
    bid = brief['id']
    label = brief['topic'][:55]
    # Atomic claim: only ONE worker/execution can flip this brief pending->in_progress.
    # If another already claimed it (overlapping cron + manual run), skip to avoid
    # double-publishing the same brief.
    if not claim_brief(supabase, bid):
        print(f"\n   ⏭ [{brief['brief_type']}] {label} — already claimed, skipping")
        return False
    print(f"\n   ▶ [{brief['brief_type']}] {label}")
    try:
        research = research_brief(brief)
        if not research:
            mark_brief(supabase, bid, 'failed', failure_reason='research_failed')
            return False

        # Write -> text quality gate -> fact-check, with a regenerate-on-failure
        # loop (the specific failure is fed back to the writer). Images are
        # sourced only AFTER the text is final, so retries don't waste image-QC.
        post, feedback, last_reason = None, None, 'write_failed'
        for attempt in range(3):
            cand = write_post(brief, research, feedback)
            if not cand:
                last_reason, feedback = 'write_failed', 'Return valid JSON with the required pages.'
                continue
            reason = quality_gate_text(cand, brief)
            if reason:
                print(f"      ↻ quality (attempt {attempt+1}): {reason}")
                last_reason, feedback = f'quality:{reason}', _feedback_for(reason)
                continue
            post = cand
            break
        if post is None:
            mark_brief(supabase, bid, 'failed', failure_reason=last_reason)
            return False

        # Fact-check is ADVISORY: logged, never blocks (content is web-grounded).
        fc = run_fact_check(brief, post, research)

        # Assign images: Wikimedia + one pooled Unsplash query/brief + og, reusing
        # the best secured image for any page that misses. One good image per brief
        # is enough to publish (so a single match saves the whole carousel).
        if not assign_images(brief, post['pages'], research.get('research_sources', [])):
            mark_brief(supabase, bid, 'failed', failure_reason='no_image_any_page')
            return False

        article_id = publish_curated(supabase, brief, post)
        if not article_id:
            mark_brief(supabase, bid, 'failed', failure_reason='publish_failed')
            return False

        log_fact_check(supabase, brief, article_id, fc)
        track_cooldown(supabase, brief)
        mark_brief(supabase, bid, 'published', published_article_id=article_id)
        fc_note = '' if not fc else (' [fact-check ok]' if fc['verified'] else f" [fact-check flagged {len(fc['discrepancies'])}]")
        print(f"      ✅ published article {article_id} ({len(post['pages'])} pages){fc_note}")
        return True

    except Exception as e:
        import traceback
        traceback.print_exc()
        mark_brief(supabase, bid, 'failed', failure_reason=f'exception:{str(e)[:200]}')
        return False


def process_briefs_parallel(supabase, briefs: List[Dict], workers: int = PROCESS_WORKERS) -> int:
    published = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(process_brief, supabase, b): b for b in briefs}
        for fut in as_completed(futs):
            try:
                if fut.result():
                    published += 1
            except Exception as e:
                print(f"   ⚠️ brief worker crashed: {str(e)[:80]}")
    return published


def run_pipeline2_processor(supabase=None, limit: int = PROCESS_LIMIT) -> Dict:
    supabase = supabase or get_supabase_client()
    print(f"\n{'='*70}\n🏭 PIPELINE 2 — PROCESSOR\n{'='*70}")
    briefs = get_pending_briefs(supabase, limit)
    if not briefs:
        print("   (no pending briefs)")
        return {'picked': 0, 'published': 0}
    print(f"   picked {len(briefs)} pending briefs")
    published = process_briefs_parallel(supabase, briefs)
    print(f"   📊 published {published}/{len(briefs)}")
    return {'picked': len(briefs), 'published': published}


if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv()
    print(run_pipeline2_processor())

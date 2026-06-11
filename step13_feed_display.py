# ================================================================
# STEP 8: FEED DISPLAY OBJECT (TodayPlus redesign v1.0)
# ================================================================
# Purpose: Generate the per-article `display` JSON that drives the 9
#          feed card templates (cover/classic/stat/quote/versus/
#          timeline/split/chart/map) on iOS.
# Model:   Gemini 2.5 Flash
# Input:   Synthesized article (title, bullets, category, source text)
# Output:  display object per the Design System Spec v1.0 §3:
#            required: category, title(<em>), lede, bullets, stats, tags
#            optional signals: big, quote, versus, timeline, trend, geo
#          (imageURL + breaking are stamped deterministically by the
#           pipeline, ageLabel is computed client-side from published_at)
# Also:    Daily interstitial-module content (feed_modules table):
#            today-in-history, number-of-the-day, in-10-seconds briefs,
#            countdown events. Market pulse is client-side (live quotes).
# ================================================================

import json
import re
import time
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional
from dataclasses import dataclass


# Design-system categories (spec §2.2 + 3 additions so every pipeline
# category has a home: SPORTS, CULTURE, HEALTH).
DESIGN_CATEGORIES = {
    'WORLD', 'AI', 'ECONOMY', 'TECH', 'POLICY', 'MARKETS', 'SCIENCE',
    'ENERGY', 'SPORTS', 'CULTURE', 'HEALTH',
}

# Deterministic fallback: pipeline canonical category -> design category.
PIPELINE_TO_DESIGN = {
    'Tech': 'TECH', 'Business': 'ECONOMY', 'Science': 'SCIENCE',
    'Politics': 'POLICY', 'Finance': 'MARKETS', 'Crypto': 'MARKETS',
    'Health': 'HEALTH', 'Entertainment': 'CULTURE', 'Sports': 'SPORTS',
    'World': 'WORLD', 'Food': 'CULTURE', 'Fashion': 'CULTURE',
    'Travel': 'CULTURE', 'Lifestyle': 'CULTURE', 'Other': 'WORLD',
}


@dataclass
class FeedDisplayConfig:
    model: str = "gemini-2.5-flash"
    # gemini-2.5-flash spends "thinking" tokens from maxOutputTokens too;
    # too-small budgets truncate the JSON mid-string.
    max_tokens: int = 8192
    temperature: float = 0.4
    timeout: int = 90
    retry_attempts: int = 3
    retry_delay: float = 2.0


DISPLAY_PROMPT = """You are the data editor for a premium news feed. Produce the DISPLAY OBJECT for this story — the structured JSON that drives its feed card.

TODAY'S DATE: {today}
PIPELINE CATEGORY: {category}
STORY TITLE: {title}
BULLET SUMMARY:
{bullets}
ENTITY TAGS: {tags}
SOURCE ARTICLE TEXT:
{source_text}

Return ONE JSON object with these fields:

REQUIRED FIELDS (always present):
- "category": one of WORLD, AI, ECONOMY, TECH, POLICY, MARKETS, SCIENCE, ENERGY, SPORTS, CULTURE, HEALTH. Pick the best fit (an AI-company story is AI, not TECH; an oil/power/climate-infrastructure story is ENERGY; central-bank/stocks/crypto is MARKETS; macro/trade/jobs is ECONOMY; legislation/regulation/elections is POLICY).
- "title": the story title with 1-2 key entities wrapped in <em>…</em> (company, person, country, product). Keep the wording of the title EXACTLY as given — only add <em> marks.
- "lede": ONE plain sentence (max ~140 chars) summarizing the story. No tags.
- "bullets": the 2-3 bullets EXACTLY as given, but with key entities wrapped in <em>…</em> and the single most important phrase per bullet (optionally) in <b>…</b>. Do not rewrite the text.
- "stats": 2-3 key numbers of the story, each as [LABEL, value, prefix, unit, sub]:
    LABEL: 1-3 words, uppercase, max 14 chars (e.g. "DEAL SIZE")
    value: a pure number (no commas/symbols) — 886, 4.6, 5000
    prefix: currency/sign shown before ("$", "€", "" if none)
    unit: short suffix shown small after ("B", "M", "%", "KM", "" if none)
    sub: tiny caption, max 40 chars (e.g. "all-stock, closes Q3") or ""
  Numbers MUST come from the bullets or source text. NEVER invent a number.
  value must be the BARE number — put "M"/"B"/"%" in unit, never inside value.
  A stat must be a meaningful standalone quantity (money, %, count, duration,
  distance). NOT a stat: bare years ("DEATH YEAR 2025"), pieces of a phrase
  ("24/7" is not two stats), classifications ("type 1", "No. 2 seed").
  If the story has 2+ real numbers, you MUST surface them as stats — scan the
  source text carefully before giving up; an empty stats list is a last resort.
- "tags": 2-3 proper-noun entity tags (e.g. ["Nvidia", "Jensen Huang"]).

OPTIONAL SIGNALS — include ONLY when the story GENUINELY supports one (most stories support 0-2). NEVER fabricate data for a signal. Quality bar is high:
- "big": [value, prefix, unit, caption] — include ONLY if ONE number IS the story (a record, an unprecedented scale). caption: max ~50 chars explaining the number. The value must appear in the source.
- "quote": {{"text": "…", "who": "Name · Role"}} — ONLY if the source text contains a real, verbatim, striking quotation (8-30 words). Wrap the key phrase in <em>. NEVER paraphrase into quotation marks.
- "versus": {{"a": {{"val": N, "unit": "", "who": "SIDE A LABEL"}}, "b": {{"val": N, "unit": "", "who": "SIDE B LABEL"}}, "ratio": 0.0-1.0, "note": "one-line context"}} — ONLY for a genuine two-sided numeric comparison stated in the source (two companies, two countries, before/after). ratio = a/(a+b). who: uppercase, max 22 chars.
- "timeline": [["MAY 28","event text"], …] — 3-4 entries, ONLY for genuinely developing stories with distinct dated events from the source. Most recent FIRST. Last entry may be ["NEXT","what's expected"]. Labels: short uppercase date or "NEXT".
- "trend": {{"vals": [n,…], "labels": ["DEC",…], "unit": "%", "caption": "one-line reading"}} — ONLY if the source provides a real numeric series of 4-8 points (monthly figures, quarterly results). vals and labels same length, chronological, latest LAST. NEVER estimate missing points.
- "geo": {{"pins": [{{"lat": 36.17, "lon": -115.14, "label": "Las Vegas"}}], "link": false, "distance": "", "region": "NEVADA · USA"}} — ONLY if a SPECIFIC place (city/site/facility) is central to the story. 1-2 pins, real coordinates. link:true only with exactly 2 related pins (then give "distance" like "1,560 km"). region: uppercase "AREA · COUNTRY".

RULES:
1. NEVER invent numbers, quotes, dates, or coordinates. Every fact must trace to the bullets or source text.
2. Omit an optional signal entirely rather than padding it with weak data.
3. <em>/<b> are the only allowed tags, always properly closed.
4. Return ONLY the JSON object, no markdown fences, no commentary."""


def _strip_tags(s: str) -> str:
    return re.sub(r'</?[^>]+>', '', s or '')


def _sanitize_marked_text(s: str) -> str:
    """Allow only balanced <em>/<b> tags; strip everything else."""
    if not isinstance(s, str):
        return ''
    # Remove any tag that isn't em/b. Lookahead must cover the optional
    # closing slash, otherwise `/?` backtracks to empty and [^>]+ eats
    # "/em" — stripping every closing tag.
    s = re.sub(r'<(?!/?(?:em|b)\b)[^>]*>', '', s)
    for tag in ('em', 'b'):
        if s.count(f'<{tag}>') != s.count(f'</{tag}>'):
            s = s.replace(f'<{tag}>', '').replace(f'</{tag}>', '')
    return s.strip()


def _num(v):
    """Coerce to a finite number or return None."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        try:
            cleaned = v.replace(',', '').replace('$', '').replace('%', '').strip()
            n = float(cleaned)
            return int(n) if n == int(n) else n
        except (ValueError, OverflowError):
            return None
    return None


def _valid_stat(item) -> Optional[list]:
    """Normalize one stats entry to [label, number, prefix, unit, sub]."""
    if not isinstance(item, (list, tuple)) or len(item) < 2:
        return None
    label = _strip_tags(str(item[0]))[:16].strip()
    value = _num(item[1])
    unit = str(item[3])[:6] if len(item) > 3 and item[3] else ''
    # The model sometimes merges the magnitude suffix into the value
    # ("3.5M", "1.2B") — split it into value + unit instead of dropping
    # the whole stat.
    if value is None and isinstance(item[1], str):
        m = re.fullmatch(r'\s*([\d.,]+)\s*([KMBT]|[kmbt]n?)\s*', item[1].strip())
        if m:
            value = _num(m.group(1))
            if not unit:
                unit = m.group(2).upper().rstrip('N')
    if not label or value is None:
        return None
    prefix = str(item[2])[:3] if len(item) > 2 and item[2] else ''
    sub = _strip_tags(str(item[4]))[:48].strip() if len(item) > 4 and item[4] else ''
    return [label.upper(), value, prefix, unit, sub]


def validate_display(result: Dict, pipeline_category: str,
                     orig_title: str, orig_bullets: List[str]) -> Optional[Dict]:
    """
    Validate + repair the model output. Required fields are repaired with
    deterministic fallbacks; invalid OPTIONAL signals are silently dropped
    (a story with zero signals is fine — cover/classic/split always apply).
    Returns the cleaned display dict, or None if it is unusable.
    """
    if not isinstance(result, dict):
        return None
    out = {}

    # category
    cat = str(result.get('category', '')).strip().upper()
    if cat not in DESIGN_CATEGORIES:
        cat = PIPELINE_TO_DESIGN.get(pipeline_category, 'WORLD')
    out['category'] = cat

    # title — must keep the original wording (only <em> added). The
    # synthesis step bolds terms with markdown (**x**), so normalize those
    # markers out of both sides before comparing wording.
    def _plain(s):
        return re.sub(r'\s+', ' ', _strip_tags(s or '').replace('**', '')).strip()

    def _md_to_em(s):
        return re.sub(r'\*\*(.+?)\*\*', r'<em>\1</em>', s or '')

    title = _sanitize_marked_text(result.get('title', ''))
    if _plain(title) != _plain(orig_title):
        # Model rewrote the wording — deterministic fallback: convert the
        # synthesis **bold** marks on the original title into <em>.
        title = _md_to_em(orig_title)
    if not _plain(title):
        return None
    out['title'] = title

    # lede
    lede = _strip_tags(str(result.get('lede', ''))).replace('**', '').strip()
    if not lede:
        lede = _plain(orig_bullets[0]) if orig_bullets else ''
    out['lede'] = lede[:200]

    # bullets — same count/wording as original, only marks added
    bullets = result.get('bullets')
    clean_bullets = []
    if isinstance(bullets, list):
        for i, b in enumerate(bullets[:3]):
            sb = _sanitize_marked_text(str(b))
            # wording must match the original bullet (marks normalized away)
            if i < len(orig_bullets) and _plain(sb) == _plain(orig_bullets[i]):
                clean_bullets.append(sb)
            elif i < len(orig_bullets):
                clean_bullets.append(_md_to_em(orig_bullets[i]))
    if len(clean_bullets) < min(2, len(orig_bullets)):
        clean_bullets = [_md_to_em(b) for b in orig_bullets[:3]]
    out['bullets'] = clean_bullets

    # stats — 2-3 valid entries; if fewer survive, ship [] (client hides row)
    stats = []
    if isinstance(result.get('stats'), list):
        for item in result['stats'][:3]:
            s = _valid_stat(item)
            if s:
                stats.append(s)
    out['stats'] = stats if len(stats) >= 2 else []

    # tags
    tags = []
    if isinstance(result.get('tags'), list):
        tags = [_strip_tags(str(t))[:28].strip() for t in result['tags'][:3]]
        tags = [t for t in tags if t]
    out['tags'] = tags

    # ---- optional signals (drop silently if malformed) ----

    big = result.get('big')
    if isinstance(big, (list, tuple)) and len(big) >= 4:
        v = _num(big[0])
        cap = _strip_tags(str(big[3])).strip()
        if v is not None and cap:
            out['big'] = [v, str(big[1])[:3] if big[1] else '',
                          str(big[2])[:8] if big[2] else '', cap[:64]]

    quote = result.get('quote')
    if isinstance(quote, dict):
        qtext = _sanitize_marked_text(str(quote.get('text', '')))
        qwho = _strip_tags(str(quote.get('who', ''))).strip()
        words = len(_strip_tags(qtext).split())
        if qtext and qwho and 5 <= words <= 40:
            out['quote'] = {'text': qtext, 'who': qwho[:60]}

    versus = result.get('versus')
    if isinstance(versus, dict):
        a, b = versus.get('a'), versus.get('b')
        if isinstance(a, dict) and isinstance(b, dict):
            av, bv = _num(a.get('val')), _num(b.get('val'))
            awho = _strip_tags(str(a.get('who', ''))).strip().upper()[:24]
            bwho = _strip_tags(str(b.get('who', ''))).strip().upper()[:24]
            if av is not None and bv is not None and awho and bwho and (av + bv) > 0:
                ratio = _num(versus.get('ratio'))
                if ratio is None or not (0 < ratio < 1):
                    ratio = av / (av + bv)
                ratio = max(0.05, min(0.95, round(float(ratio), 3)))
                out['versus'] = {
                    'a': {'val': av, 'unit': str(a.get('unit', ''))[:8], 'who': awho},
                    'b': {'val': bv, 'unit': str(b.get('unit', ''))[:8], 'who': bwho},
                    'ratio': ratio,
                    'note': _strip_tags(str(versus.get('note', ''))).strip()[:140],
                }

    timeline = result.get('timeline')
    if isinstance(timeline, list):
        entries = []
        for e in timeline[:4]:
            if isinstance(e, (list, tuple)) and len(e) >= 2:
                lab = _strip_tags(str(e[0])).strip().upper()[:12]
                txt = _strip_tags(str(e[1])).strip()
                if lab and txt:
                    entries.append([lab, txt[:160]])
        if len(entries) >= 3:
            out['timeline'] = entries

    trend = result.get('trend')
    if isinstance(trend, dict):
        vals = [_num(v) for v in (trend.get('vals') or [])]
        labels = [str(l).strip().upper()[:8] for l in (trend.get('labels') or [])]
        caption = _strip_tags(str(trend.get('caption', ''))).strip()
        if (4 <= len(vals) <= 8 and all(v is not None for v in vals)
                and len(labels) == len(vals) and all(labels) and caption):
            out['trend'] = {'vals': vals, 'labels': labels,
                            'unit': str(trend.get('unit', ''))[:6],
                            'caption': caption[:140]}

    geo = result.get('geo')
    if isinstance(geo, dict) and isinstance(geo.get('pins'), list):
        pins = []
        for p in geo['pins'][:2]:
            if not isinstance(p, dict):
                continue
            lat, lon = _num(p.get('lat')), _num(p.get('lon'))
            label = _strip_tags(str(p.get('label', ''))).strip()
            if lat is not None and lon is not None and label \
                    and -90 <= lat <= 90 and -180 <= lon <= 180:
                pins.append({'lat': round(float(lat), 4),
                             'lon': round(float(lon), 4), 'label': label[:28]})
        if pins:
            link = bool(geo.get('link')) and len(pins) == 2
            out['geo'] = {
                'pins': pins,
                'link': link,
                'distance': _strip_tags(str(geo.get('distance', ''))).strip()[:16] if link else '',
                'region': _strip_tags(str(geo.get('region', ''))).strip().upper()[:36],
            }

    return out


class FeedDisplayWriter:
    """Generates the v1.0 display object for one article via Gemini."""

    def __init__(self, api_key: str, config: Optional[FeedDisplayConfig] = None):
        self.api_key = api_key
        self.config = config or FeedDisplayConfig()
        self.api_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.config.model}:generateContent?key={api_key}"
        )

    def write_display(self, article: Dict) -> Optional[Dict]:
        """
        article: {title, bullets, category, source_text, tags}
        Returns the validated display dict or None.
        """
        title = article.get('title', '')
        bullets = article.get('bullets', []) or []
        # Number-rich story? Then an empty stats list is a model miss worth
        # one retry, not a property of the story.
        _digit_groups = len(re.findall(
            r'\d+', f"{title} {' '.join(bullets)} {article.get('source_text') or ''}"))
        prompt = DISPLAY_PROMPT.format(
            today=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            category=article.get('category', 'Other'),
            title=title,
            bullets='\n'.join(f'- {b}' for b in bullets),
            tags=', '.join(article.get('tags', [])[:6]) or 'none',
            source_text=(article.get('source_text') or 'not available')[:6000],
        )
        request_data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_tokens,
                "responseMimeType": "application/json",
            },
        }
        best_statless = None
        for attempt in range(self.config.retry_attempts):
            try:
                response = requests.post(self.api_url, json=request_data,
                                         timeout=self.config.timeout)
                if response.status_code == 429:
                    time.sleep(10 * (attempt + 1))
                    continue
                response.raise_for_status()
                payload = response.json()
                text = payload['candidates'][0]['content']['parts'][0]['text']
                m = re.search(r'\{[\s\S]*\}', text)
                if m:
                    text = m.group(0)
                result = json.loads(text)
                cleaned = validate_display(result, article.get('category', 'Other'),
                                           title, bullets)
                if cleaned:
                    if cleaned.get('stats') or _digit_groups < 6 \
                            or attempt >= self.config.retry_attempts - 1:
                        return cleaned
                    # Number-rich story came back statless — retry once,
                    # keeping this result as the fallback.
                    best_statless = cleaned
            except Exception as e:
                print(f"   ⚠️ [display] attempt {attempt + 1} failed: {e}")
            if attempt < self.config.retry_attempts - 1:
                time.sleep(self.config.retry_delay)
        return best_statless


# ================================================================
# DAILY INTERSTITIAL MODULES (feed_modules table)
# ================================================================
# One row per (module_date, module_type). Generated once per day, the
# first pipeline cycle that runs after midnight UTC. Market pulse is
# NOT generated here — live quotes are a client-side fetch.

MODULES_PROMPT = """You produce daily interstitial-module content for a news feed.
TODAY'S DATE: {today}

RECENT HEADLINES (today's published stories, most recent first):
{headlines}

Return ONE JSON object with EXACTLY these keys:

- "history": exactly 3 significant events that happened on {month_day} in past years, as [[year, "one-sentence event description"], …]. Only well-documented, major events (year as integer). Most impactful first.

- "notd": ONE "number of the day" from TODAY'S HEADLINES above: {{"value": N, "prefix": "$", "unit": "B", "context": "sentence with a memorable comparison (e.g. 'more than the GDP of Denmark')"}}. The number must come from a headline above. NEVER invent one.

- "briefs": exactly 3 one-line briefs from DIFFERENT headlines above, each {{"tag": "2-6 char uppercase topic tag (EU, OIL, CHIPS)", "text": "one sentence, max 110 chars, key entity in <b>"}}.

- "countdowns": 0-2 UPCOMING scheduled events within the next 30 days that you are CONFIDENT about (central-bank decisions, scheduled launches, major scheduled releases/votes), each {{"name": "event name", "datetime": "YYYY-MM-DDTHH:MM:SSZ", "context": "one factual line (market pricing / calendar fact, never user data)"}}. If you are not certain of an exact date, OMIT the event. An empty list is fine.

Rules: no fabricated numbers or dates; return ONLY the JSON object."""


def generate_daily_modules(supabase, api_key: str):
    """Generate today's interstitial modules if not already present."""
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        existing = supabase.table('feed_modules').select('module_type') \
            .eq('module_date', today).execute()
        have = {r['module_type'] for r in (existing.data or [])}
        needed = {'history', 'notd', 'briefs', 'countdowns'} - have
        if not needed:
            return
    except Exception as e:
        print(f"   ⚠️ [modules] table check failed: {e}")
        return

    try:
        arts = supabase.table('published_articles') \
            .select('title_news, summary_bullets_news') \
            .order('published_at', desc=True).limit(15).execute()
        headlines = '\n'.join(
            f"- {a['title_news']}: {' '.join((a.get('summary_bullets_news') or [])[:1])[:150]}"
            for a in (arts.data or [])
        ) or 'none available'
    except Exception:
        headlines = 'none available'

    now = datetime.now(timezone.utc)
    prompt = MODULES_PROMPT.format(
        today=now.strftime('%Y-%m-%d'),
        month_day=now.strftime('%B %d'),
        headlines=headlines,
    )
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    data = None
    for attempt in range(3):
        try:
            resp = requests.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                # 8192: gemini-2.5-flash spends "thinking" tokens from this
                # budget too — 2048 truncated the JSON mid-string.
                "generationConfig": {"temperature": 0.5, "maxOutputTokens": 8192,
                                     "responseMimeType": "application/json"},
            }, timeout=90)
            resp.raise_for_status()
            text = resp.json()['candidates'][0]['content']['parts'][0]['text']
            m = re.search(r'\{[\s\S]*\}', text)
            data = json.loads(m.group(0) if m else text)
            break
        except Exception as e:
            print(f"   ⚠️ [modules] generation attempt {attempt + 1} failed: {e}")
            time.sleep(2)
    if data is None:
        return

    payloads = {}
    hist = data.get('history')
    if isinstance(hist, list):
        rows = [[int(_num(e[0])), _strip_tags(str(e[1])).strip()[:180]]
                for e in hist[:3]
                if isinstance(e, (list, tuple)) and len(e) >= 2 and _num(e[0])]
        if len(rows) == 3:
            payloads['history'] = {'rows': rows}
    notd = data.get('notd')
    if isinstance(notd, dict) and _num(notd.get('value')) is not None \
            and notd.get('context'):
        payloads['notd'] = {
            'value': _num(notd['value']),
            'prefix': str(notd.get('prefix', ''))[:3],
            'unit': str(notd.get('unit', ''))[:8],
            'context': _strip_tags(str(notd['context'])).strip()[:160],
        }
    briefs = data.get('briefs')
    if isinstance(briefs, list):
        rows = []
        for b in briefs[:3]:
            if isinstance(b, dict) and b.get('tag') and b.get('text'):
                rows.append({'tag': _strip_tags(str(b['tag'])).strip().upper()[:6],
                             'text': _sanitize_marked_text(str(b['text']))[:130]})
        if len(rows) == 3:
            payloads['briefs'] = {'rows': rows}
    cds = data.get('countdowns')
    if isinstance(cds, list):
        rows = []
        for c in cds[:2]:
            if not (isinstance(c, dict) and c.get('name') and c.get('datetime')):
                continue
            try:
                dt = datetime.fromisoformat(str(c['datetime']).replace('Z', '+00:00'))
                if dt > now:
                    rows.append({'name': _strip_tags(str(c['name'])).strip()[:60],
                                 'datetime': dt.isoformat(),
                                 'context': _strip_tags(str(c.get('context', ''))).strip()[:140]})
            except ValueError:
                continue
        payloads['countdowns'] = {'rows': rows}  # empty list is valid

    for mtype, payload in payloads.items():
        if mtype not in needed:
            continue
        try:
            supabase.table('feed_modules').upsert(
                {'module_date': today, 'module_type': mtype, 'payload': payload},
                on_conflict='module_date,module_type').execute()
            print(f"   ✅ [modules] {mtype} written for {today}")
        except Exception as e:
            print(f"   ⚠️ [modules] {mtype} insert failed: {e}")

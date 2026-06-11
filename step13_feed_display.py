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

# Map-pin quality nets (2026-06-12): a pin must be a place worth LOOKING at.
# Bare country/continent pins are always dropped; bare metro names are
# dropped for business-ish categories (HQ-city syndrome — "New York" pin
# on a startup-funding story).
_GEO_COUNTRY_PINS = {
    'china', 'russia', 'usa', 'united states', 'us', 'india', 'iran',
    'israel', 'palestine', 'ukraine', 'france', 'germany', 'uk',
    'united kingdom', 'england', 'spain', 'italy', 'japan', 'brazil',
    'canada', 'mexico', 'australia', 'turkey', 'türkiye', 'europe', 'asia',
    'africa', 'middle east', 'north america', 'south america',
}
_GEO_METRO_PINS = {
    'new york', 'new york city', 'nyc', 'manhattan', 'san francisco',
    'los angeles', 'london', 'paris', 'seattle', 'austin', 'boston',
    'chicago', 'miami', 'dallas', 'houston', 'atlanta', 'denver',
    'washington', 'washington dc', 'washington, dc', 'tokyo', 'beijing',
    'shanghai', 'shenzhen', 'hangzhou', 'seoul', 'berlin', 'munich',
    'dublin', 'amsterdam', 'stockholm', 'zurich', 'toronto', 'vancouver',
    'sydney', 'melbourne', 'singapore', 'hong kong', 'bangalore',
    'bengaluru', 'tel aviv', 'dubai', 'cupertino', 'mountain view',
    'menlo park', 'redmond', 'palo alto', 'santa clara', 'san jose',
    'silicon valley',
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
  distance). NOT a stat: bare years ("DEATH YEAR 2025", "WORLD CUP YEAR 2026"),
  pieces of a phrase ("24/7" is not two stats), classifications ("type 1",
  "No. 2 seed"), or trivial filler ("OPENING MATCH 1", "TEAMS PLAYING 2",
  "WEEK 1"). Scan the source text carefully — most stories have real numbers
  (figures, counts, sums, ages, durations) the bullets skipped. But if a story
  genuinely lacks 2 meaningful numbers, return [] — an empty list is ALWAYS
  better than filler a reader would roll their eyes at.
- "tags": 2-3 proper-noun entity tags (e.g. ["Nvidia", "Jensen Huang"]).

OPTIONAL SIGNALS — include ONLY when the story GENUINELY supports one (most stories support 0-2). NEVER fabricate data for a signal. Quality bar is high:
- "big": [value, prefix, unit, caption] — include ONLY if ONE number IS the story (a record, an unprecedented scale). caption: max ~50 chars explaining the number. The value must appear in the source.
- "quote": {{"text": "…", "who": "Name · Role"}} — ONLY if the source text contains a real, verbatim, striking quotation (8-30 words). Wrap the key phrase in <em>. NEVER paraphrase into quotation marks.
- "versus": {{"a": {{"val": N, "unit": "", "who": "SIDE A LABEL"}}, "b": {{"val": N, "unit": "", "who": "SIDE B LABEL"}}, "ratio": 0.0-1.0, "note": "one-line context"}} — ONLY for a genuine two-sided numeric comparison stated in the source (two companies, two countries, before/after). ratio = a/(a+b). who: uppercase, max 22 chars.
- "timeline": [["MAY 28","event text"], …] — 3-4 entries, ONLY for genuinely developing stories with distinct dated events from the source. Most recent FIRST. Last entry may be ["NEXT","what's expected"]. Labels: short uppercase date or "NEXT".
- "trend": {{"vals": [n,…], "labels": ["DEC",…], "unit": "%", "caption": "one-line reading"}} — a real numeric series of 3-8 points from the source: monthly/quarterly figures, values at distinct dates ("was 1.75% in March, 2% in April, 2.25% now"), yearly comparisons, successive poll numbers, season-by-season stats. Even THREE real points across time make a chart. vals and labels same length, chronological, latest LAST. NEVER estimate or interpolate missing points — but DO look for series the source states in prose, not just tables.
- "geo": {{"pins": [{{"lat": 25.997, "lon": -97.155, "label": "Starbase Launch Pad"}}], "link": false, "distance": "", "region": "TEXAS · USA"}} — THE MAP TEST: did this story happen AT a specific place, and would SEEING that spot teach the reader something? The event must physically BE somewhere: a launch (pin the pad: "Starbase Launch Pad", "Vandenberg SLC-4E"), a match (the stadium), a crash/strike/riot/discovery (the site), a landmark sale (the building). Always pin the EXACT site, not the city around it.
  NOT eligible — OMIT geo entirely for: company/product/funding/app news (the company's HQ city is NOT a location story — a healthcare-AI startup raising money has NO geo even if it is in New York); where a person happened to be when they tweeted / got injured / made a statement; the city a court or organization sits in (unless the building itself is the story); whole countries. If the most specific honest pin would just be a big city or country name that isn't itself the event, OMIT geo. 1-2 pins, real coordinates. link:true only with exactly 2 related pins (then "distance" like "1,560 km"). region: uppercase "AREA · COUNTRY".

CHART-DATA FLAGS — charts are a signature card of this feed. When you could NOT build "trend" from the source, set a flag on EVERY story whose subject has a published numeric history. The pipeline fetches and VERIFIES the real series itself — a flag costs nothing if no series exists, so when in doubt, SET it:
- "chart_ticker": Yahoo Finance symbol whenever a publicly traded company, index, or major crypto is CENTRAL to the story — even if the story is not about the price itself (earnings, CEO change, lawsuit, product launch, acquisition: the stock's recent path IS useful context). US stocks "TSLA" "AAPL", European listings "BOSS.DE" "AIR.PA", indices "^GSPC" "^DJI" "^IXIC", crypto "BTC-USD" "ETH-USD".
- "chart_metric": a search phrase (max 10 words) whenever a well-known published indicator is central or gives obvious context: "eurozone monthly inflation rate 2026", "US unemployment rate by month", "ECB key interest rate history", "Brent crude oil price by month", "US box office weekly 2026", "Premier League title odds history". Use for: inflation, rates, jobs, energy/commodity prices, currencies, housing, box office, sales figures, polls/approval ratings, league standings/medal tables, epidemic counts, casualty tallies over time.

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
        if (3 <= len(vals) <= 8 and all(v is not None for v in vals)
                and len(labels) == len(vals) and all(labels) and caption):
            out['trend'] = {'vals': vals, 'labels': labels,
                            'unit': str(trend.get('unit', ''))[:6],
                            'caption': caption[:140]}

    # Chart-data flags (internal — the workflow consumes + removes these
    # after fetching the real series; they never reach the client).
    ticker = result.get('chart_ticker')
    if isinstance(ticker, str):
        ticker = ticker.strip().upper()
        if re.fullmatch(r'[A-Z0-9.^-]{2,12}', ticker):
            out['chart_ticker'] = ticker
    metric = result.get('chart_metric')
    if isinstance(metric, str) and metric.strip():
        out['chart_metric'] = _strip_tags(metric).strip()[:80]

    geo = result.get('geo')
    if isinstance(geo, dict) and isinstance(geo.get('pins'), list):
        pins = []
        for p in geo['pins'][:2]:
            if not isinstance(p, dict):
                continue
            lat, lon = _num(p.get('lat')), _num(p.get('lon'))
            label = _strip_tags(str(p.get('label', ''))).strip()
            # Country/continent pins are useless at map scale — always drop.
            if label.lower() in _GEO_COUNTRY_PINS:
                continue
            # HQ-city syndrome: business/product stories pinned to a bare
            # metro name (company news "in New York"). The event categories
            # (WORLD/POLICY/SPORTS/SCIENCE/ENERGY/HEALTH) keep city pins —
            # riots in Belfast ARE the city.
            if cat in ('AI', 'TECH', 'MARKETS', 'ECONOMY', 'CULTURE') \
                    and label.lower().rstrip('.').replace(', usa', '') in _GEO_METRO_PINS:
                continue
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
# VERIFIED CHART ENRICHMENT
# ================================================================
# Two ways to attach a REAL trend series when the article text has none:
#   1. fetch_trend_from_stooq — actual market data CSV (no AI involved,
#      cannot be hallucinated). US stocks / indices / major crypto.
#   2. fetch_trend_grounded — Gemini WITH Google Search grounding; every
#      value must be backed by a verbatim evidence sentence from the
#      search results or the chart is rejected.

_MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
               'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']


def fetch_trend_from_market(ticker: str) -> Optional[Dict]:
    """Last ~6 monthly closes from Yahoo Finance chart API (real market
    data fetched by code — no AI in the loop, cannot be hallucinated)."""
    try:
        symbol = ticker.upper().replace('.US', '')
        if symbol.endswith('USD') and '-' not in symbol and not symbol.startswith('^'):
            symbol = symbol[:-3] + '-USD'  # BTCUSD -> BTC-USD
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
               f"?range=6mo&interval=1mo")
        resp = requests.get(url, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        resp.raise_for_status()
        result = resp.json()['chart']['result'][0]
        ts = result.get('timestamp') or []
        closes = (result.get('indicators', {}).get('quote') or [{}])[0].get('close') or []
        currency = result.get('meta', {}).get('currency', '')
        rows = [(datetime.fromtimestamp(t, tz=timezone.utc), c)
                for t, c in zip(ts, closes) if c is not None]
        # Yahoo appends a partial current-month candle — collapse rows that
        # share a (year, month), keeping the latest value.
        dedup = {}
        for d, c in rows:
            dedup[(d.year, d.month)] = (d, c)
        rows = sorted(dedup.values(), key=lambda r: r[0])
        if len(rows) < 3:
            return None
        rows = rows[-6:]
        vals = [round(c, 2) if c < 1000 else round(c) for _, c in rows]
        labels = [_MONTH_ABBR[d.month - 1] for d, _ in rows]
        if len(set(vals)) == 1:
            return None
        unit = '$' if currency == 'USD' else ''
        name = result.get('meta', {}).get('symbol', symbol)
        return {'vals': vals, 'labels': labels, 'unit': unit,
                'caption': f"{name} monthly close ({currency})"}
    except Exception as e:
        print(f"   ⚠️ [chart] market fetch failed for {ticker}: {e}")
        return None


GROUNDED_TREND_PROMPT = """Today's date: {today}.
Use Google Search to find the REAL published historical series for this metric:
"{metric}"

Return ONLY a JSON object (no markdown):
{{"vals": [3-8 numbers, chronological, latest LAST],
  "labels": [same length, short uppercase period labels like "MAR", "Q1", "2023"],
  "unit": "%",
  "caption": "one line naming the series and its source, max 90 chars",
  "evidence": ["verbatim sentence from a search result that contains each number"]}}

STRICT RULES:
1. Every number in vals MUST literally appear in your search results. Copy the
   proving sentence(s) into evidence — one sentence may prove several values.
2. NEVER estimate, interpolate, or recall values from memory.
3. If search does not surface a real series, return {{}} — that is a good answer."""


def fetch_trend_grounded(metric: str, api_key: str) -> Optional[Dict]:
    """Google-grounded series fetch; values must verify against evidence."""
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    try:
        resp = requests.post(url, json={
            "contents": [{"parts": [{"text": GROUNDED_TREND_PROMPT.format(
                today=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                metric=metric)}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
        }, timeout=90)
        resp.raise_for_status()
        cand = resp.json()['candidates'][0]
        # No grounding metadata = the model never actually searched. Reject.
        if 'groundingMetadata' not in cand:
            return None
        text = ''.join(p.get('text', '') for p in cand['content']['parts'])
        m = re.search(r'\{[\s\S]*\}', text)
        if not m:
            return None
        data = json.loads(m.group(0))
    except Exception as e:
        print(f"   ⚠️ [chart] grounded fetch failed for {metric!r}: {e}")
        return None

    vals = [_num(v) for v in (data.get('vals') or [])]
    labels = [str(l).strip().upper()[:8] for l in (data.get('labels') or [])]
    caption = _strip_tags(str(data.get('caption', ''))).strip()
    evidence = data.get('evidence')
    if not (3 <= len(vals) <= 8 and all(v is not None for v in vals)
            and len(labels) == len(vals) and all(labels) and caption
            and isinstance(evidence, list) and evidence):
        return None
    if len(set(vals)) == 1:
        return None
    # Anti-hallucination check: every value must appear in the evidence text.
    ev_text = ' '.join(str(e) for e in evidence).replace(',', '')
    for v in vals:
        forms = {f"{v}", f"{v:g}"}
        if isinstance(v, float) and v == int(v):
            forms.add(str(int(v)))
        if not any(f in ev_text for f in forms):
            print(f"   ⚠️ [chart] value {v} not backed by evidence — rejecting chart")
            return None
    return {'vals': vals, 'labels': labels,
            'unit': str(data.get('unit', ''))[:6], 'caption': caption[:140]}


def enrich_display_with_chart(display_obj: Dict, api_key: str) -> None:
    """Consume chart_ticker/chart_metric flags; attach a verified trend."""
    if not isinstance(display_obj, dict):
        return
    ticker = display_obj.pop('chart_ticker', None)
    metric = display_obj.pop('chart_metric', None)
    if 'trend' in display_obj:
        return
    trend = None
    if ticker:
        trend = fetch_trend_from_market(ticker)
        if trend:
            print(f"   📈 [chart] real market series attached ({ticker})")
    if trend is None and metric:
        trend = fetch_trend_grounded(metric, api_key)
        if trend:
            print(f"   📈 [chart] grounded series attached ({metric!r})")
    if trend:
        display_obj['trend'] = trend


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

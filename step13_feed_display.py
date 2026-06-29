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
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass


# Design-system categories (spec §2.2 + 3 additions so every pipeline
# category has a home: SPORTS, CULTURE, HEALTH).
DESIGN_CATEGORIES = {
    'WORLD', 'AI', 'ECONOMY', 'TECH', 'POLICY', 'MARKETS', 'SCIENCE',
    'ENERGY', 'SPORTS', 'CULTURE', 'HEALTH',
}

# Timeline label hygiene (2026-06-12): labels must be compact ABSOLUTE
# dates — relative wording is meaningless in a feed read hours later.
_TL_BANNED_LABELS = {
    'TODAY', 'YESTERDAY', 'TOMORROW', 'NOW', 'EARLIER', 'RECENT',
    'RECENTLY', 'THIS WEEK', 'LAST WEEK', 'THIS MONTH', 'LAST MONTH',
    'LAST SEASON', 'THIS SEASON', 'LAST YEAR', 'THIS YEAR', 'ONGOING',
    'SOON', 'UPCOMING', 'PREVIOUSLY', 'BEFORE', 'PAST',
}
_TL_BANNED_WORDS = ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
                    'FRIDAY', 'SATURDAY', 'SUNDAY')
_TL_MONTHS = {'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
              'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12}
_TL_MONTH_FULL = {'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR',
                  'APRIL': 'APR', 'JUNE': 'JUN', 'JULY': 'JUL',
                  'AUGUST': 'AUG', 'SEPTEMBER': 'SEP', 'SEPT': 'SEP',
                  'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC'}


def _tl_normalize_label(lab: str) -> str:
    """Compact a timeline label: full month names -> 3-letter, strip
    fluff prefixes. (Display shortening happens separately, after the
    sort key is computed — cutting first would lose the year.)"""
    lab = re.sub(r'\s+', ' ', (lab or '').strip().upper().replace('.', ''))
    for full, abbr in _TL_MONTH_FULL.items():
        lab = re.sub(rf'\b{full}\b', abbr, lab)
    lab = re.sub(r'^(EARLY|LATE|MID)[\s-]+', '', lab)
    return lab.strip(' ,')


def _tl_display_label(lab: str) -> str:
    """Shorten for display, never mid-token. 'MMM DD, YYYY' keeps the year
    (drop the day) when the year is not the current one — 'JUN 30, 2027'
    -> 'JUN 2027', but 'JUN 11, 2026' -> 'JUN 11'."""
    if len(lab) > 11:
        m = re.fullmatch(r'(\w{3}) \d{1,2},? (\d{4})', lab)
        if m:
            year = int(m.group(2))
            now_year = datetime.now(timezone.utc).year
            return f"{m.group(1)} {m.group(2)}" if year != now_year \
                else f"{m.group(1)} {lab.split()[1].rstrip(',')}"
        cut = lab[:12].rsplit(' ', 1)[0]
        lab = cut if cut else lab[:11]
    return lab.strip(' ,')


def _tl_sort_key(lab: str):
    """Parse a label to a sortable (year, month, day); NEXT/future first.
    Returns None if unparseable."""
    if lab == 'NEXT':
        return (9999, 12, 31)
    m = re.fullmatch(r'(?:(\w{3}) )?(\d{4})', lab)        # "2023" / "MAY 2025"
    if m and (m.group(1) is None or m.group(1) in _TL_MONTHS):
        return (int(m.group(2)), _TL_MONTHS.get(m.group(1), 6), 15)
    m = re.fullmatch(r'Q([1-4]) (\d{4})', lab)            # "Q1 2026"
    if m:
        return (int(m.group(2)), int(m.group(1)) * 3, 15)
    m = re.fullmatch(r'(\w{3}) (\d{1,2})(?:,? (\d{4}))?', lab)  # "JUN 11[, 2026]"
    if m and m.group(1) in _TL_MONTHS:
        year = int(m.group(3)) if m.group(3) else datetime.now(timezone.utc).year
        return (year, _TL_MONTHS[m.group(1)], int(m.group(2)))
    m = re.fullmatch(r'(\w{3}) (\d{1,2})-\d{1,2}', lab)   # "JUN 8-9"
    if m and m.group(1) in _TL_MONTHS:
        return (datetime.now(timezone.utc).year, _TL_MONTHS[m.group(1)], int(m.group(2)))
    return None


def validate_timeline_entries(timeline) -> Optional[list]:
    """Shared timeline validation: absolute labels, no relative wording,
    dedup, canonical NEXT/newest-first ordering. None if < 3 beats survive."""
    if not isinstance(timeline, list):
        return None
    entries = []
    seen_labels = set()
    for e in timeline[:4]:
        if not (isinstance(e, (list, tuple)) and len(e) >= 2):
            continue
        lab = _tl_normalize_label(_strip_tags(str(e[0])))
        txt = _strip_tags(str(e[1])).strip()
        if not lab or not txt:
            continue
        # Relative labels are useless in a feed read hours later.
        if lab in _TL_BANNED_LABELS or any(w in lab for w in _TL_BANNED_WORDS):
            continue
        # Same label twice = padding, keep the first beat only.
        if lab in seen_labels:
            continue
        seen_labels.add(lab)
        entries.append((_tl_sort_key(lab), [_tl_display_label(lab), txt[:160]]))
    # Canonical order: NEXT/future first, then newest -> oldest. Only
    # reorder when every label parses — otherwise trust the model order
    # (minus the banned entries already dropped).
    if entries and all(k is not None for k, _ in entries):
        entries.sort(key=lambda p: p[0], reverse=True)
        ordered = [e for _, e in entries]
    else:
        ordered = [e for _, e in entries]
        ordered = [e for e in ordered if e[0] == 'NEXT'] + \
                  [e for e in ordered if e[0] != 'NEXT']
    return ordered if len(ordered) >= 3 else None


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
# Well-known places — a single 'site' pin that is JUST one of these teaches
# the reader nothing (everyone knows roughly where it is), so the map is
# dropped. A precise sub-site ("Vandenberg SLC-4E") or a rare/unknown place
# is NOT in this list and survives. route/area/multi maps are kept regardless.
_GEO_WELLKNOWN = {
    'paris', 'london', 'new york', 'new york city', 'nyc', 'tokyo', 'rome',
    'berlin', 'madrid', 'moscow', 'beijing', 'shanghai', 'dubai', 'singapore',
    'hong kong', 'los angeles', 'san francisco', 'chicago', 'washington',
    'washington dc', 'washington, dc', 'boston', 'miami', 'toronto', 'sydney',
    'melbourne', 'amsterdam', 'barcelona', 'vienna', 'venice', 'milan',
    'munich', 'istanbul', 'athens', 'cairo', 'mumbai', 'delhi', 'new delhi',
    'seoul', 'bangkok', 'jakarta', 'rio de janeiro', 'sao paulo',
    'mexico city', 'buenos aires', 'brussels', 'geneva', 'zurich', 'dublin',
    'lisbon', 'prague', 'stockholm', 'copenhagen', 'oslo', 'helsinki',
    'warsaw', 'budapest', 'jerusalem', 'tel aviv', 'doha', 'riyadh',
    'las vegas', 'seattle', 'dallas', 'houston', 'atlanta', 'philadelphia',
    'vancouver', 'montreal', 'manchester', 'liverpool', 'birmingham',
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
- "lede": ONE plain COMPLETE sentence summarizing the story, max ~120 chars (it renders in a small card — it must fit whole, never get cut off). No tags.
- "why_it_matters": 1-2 short sentences (max ~200 chars) on the CONSEQUENCE or meaning — why a reader should CARE. State the stakes / what changes / who is affected, NOT more facts and NOT a restated headline. Every name and number in it MUST appear in the bullets or source text. No speculation ("could", "might"). If the source supports no real, concrete consequence, set it to null. No tags.
- "tone": "light" or "standard". "light" = a deliberately lighter story: uplifting, fascinating, surprising, low-stakes, non-political, non-distressing (a science wonder, a sports/culture delight, good news, a surprising fact). "standard" = everything else (politics, conflict, economy, disasters, hard news). When unsure, "standard".
- "bullets": the 2-3 bullets EXACTLY as given, but with key entities wrapped in <em>…</em> and the single most important phrase per bullet (optionally) in <b>…</b>. Do not rewrite the text.
- "stats": 2-3 key numbers of the story, each as [LABEL, value, prefix, unit, sub]:
    LABEL: 1-3 words, uppercase, max 14 chars (e.g. "DEAL SIZE")
    value: a pure number (no commas/symbols) — 886, 4.6, 5000
    prefix: currency/sign shown before ("$", "€", "" if none)
    unit: short suffix shown small after ("B", "M", "%", "KM", "" if none)
    sub: tiny caption, max 40 chars (e.g. "all-stock, closes Q3") or ""
  Numbers are this feed's signature — ALWAYS surface 2-3 stats when the story
  has them. Pull the KEY numbers stated in the TITLE and BULLETS first (these
  are the story's own figures); most stories have 2-3. NEVER invent a number,
  and prefer numbers that appear in the title/bullets over deep-body trivia.
  value must be the BARE number — put "M"/"B"/"%" in unit, never inside value.
  A stat must be a meaningful standalone quantity (money, %, count, duration,
  distance) that is ABOUT this story's subject. NOT a stat: bare years ("DEATH
  YEAR 2025", "WORLD CUP YEAR 2026"), pieces of a phrase ("24/7" is not two
  stats), classifications ("type 1", "No. 2 seed"), trivial filler ("OPENING
  MATCH 1", "TEAMS PLAYING 2"), or numbers about a DIFFERENT team/event than
  the headline. Two stats must never be the same number. If the story
  genuinely lacks 2 meaningful numbers, return [] — but that should be rare;
  most news has key figures worth showing.
- "tags": 2-3 proper-noun entity tags (e.g. ["Nvidia", "Jensen Huang"]).

OPTIONAL SIGNALS — include ONLY when the story GENUINELY supports one (most stories support 0-2). NEVER fabricate data for a signal. Quality bar is high:
- "big": [value, prefix, unit, caption] — include when ONE standout figure dominates the story: the single number a reader will remember (the headline deal/funding size, the death toll, the scale, the record, the valuation). It need NOT be a world record — just clearly THE number of this story. caption: max ~50 chars explaining the number. The value must appear in the source.
- "quote": {{"text": "…", "who": "Name · Role"}} — RARE, high bar: ONLY a genuinely strong, meaningful, verbatim quotation (10-30 words) from a NAMED newsmaker (a real person or named official — "who" must be "Name · Role", never an anonymous "spokesperson"/"official"/"statement"). The quote must ADVANCE or characterize the story — not boilerplate, not a sentence that merely restates a fact already in the bullets. Wrap the key phrase in <em>. NEVER paraphrase into quotation marks. Most stories have NO quote.
- "versus": {{"kind": "duel|change|gap", "a": {{"val": N, "unit": "", "who": "SIDE A"}}, "b": {{"val": N, "unit": "", "who": "SIDE B"}}, "note": "one-line context"}} — a two-sided numeric comparison from the source. Pick the kind that matches the RELATIONSHIP:
    "duel"   = genuine opposition: vote for/against, match score, two rivals competing. (a and b face off)
    "change" = the SAME metric before vs after: a = BEFORE/older value, b = AFTER/current value (dev time cut from 55 to 26 months; obesity rate pre-COVID vs now). NOT a fight — never use duel for this.
    "gap"    = two related quantities contrasted for scale (company X's fleet vs company Y's, spend vs budget).
  Eligible patterns are broad — emit one whenever the source states two grounded, same-unit numbers worth contrasting: vote/poll splits (for vs against, party A vs B), match or election margins, market-share or revenue A vs B, this-period vs last (quarter, year, season), before vs after a change, two rivals/countries on the same metric. The deterministic grounding gate drops anything not in the source, so prefer emitting a real comparison over omitting.
  who: SHORT uppercase label, max 14 chars ("FOR", "PRE-COVID", "2022-24", "TESLA") — long labels get cut off on screen. Include unit ("%", "MONTHS") in unit, not in who.
- "score": {{"sport": "football|basketball|tennis|hockey|baseball|cricket|rugby|mma|boxing|amfootball|volleyball|other", "a": {{"team": "MEXICO", "score": "2", "detail": ""}}, "b": {{"team": "S. AFRICA", "score": "1", "detail": ""}}, "status": "FT", "note": "Lozano 23' and 67'; Estadio Azteca"}} — ONLY when a played or live head-to-head MATCH RESULT is the story. team: short uppercase name max 13 chars. score: the headline number as a string (goals/points; for tennis = SETS won). detail: secondary score line ("6-4 3-6 7-5" sets, "(4-2 pens)", "1st innings 245"). status: FT, HT, LIVE, Q3, SET 2, FINAL, R3 — max 8 chars. note: scorers/venue/round one-liner. Golf, F1, athletics, leagues tables are NOT score — use "ranking". Transfer news, injuries, previews = NOT score.
- "timeline_story": true — a FLAG, not the timeline itself (a dedicated writer builds it). Set true ONLY if ALL three hold: (1) this story is the latest development in a saga running for days/weeks (war, trial, deal process, investigation, crisis, transfer saga, election process); (2) the SOURCE TEXT itself describes at least TWO earlier dated developments of THIS story; (3) a reader landing on it would ask "how did we get here?". Single events, match results, product launches, awards, announcements, profiles = false. Expect true on roughly 1 story in 10.
- "trend": {{"style": "bar|line", "vals": [n,…], "labels": ["DEC",…], "unit": "%", "caption": "one-line reading"}} — a real numeric TIME SERIES of 3-8 points from the source: monthly/quarterly figures, values at distinct dates ("was 1.75% in March, 2% in April, 2.25% now"), yearly comparisons, successive poll numbers, season-by-season stats. Even THREE real points across time make a chart. style: "line" for continuous metrics with 5+ points (prices, rates), "bar" for few discrete periods. vals and labels same length, chronological, latest LAST. NEVER estimate or interpolate missing points — but DO look for series the source states in prose, not just tables.
- "breakdown": {{"slices": [["LABEL", n], …], "unit": "%", "caption": "one-line reading"}} — COMPOSITION of a whole stated in the source, for a donut chart: vote share by party, market share, budget split, "X of the Y total". 3-6 slices, biggest FIRST, labels max 12 chars uppercase. Values must come from the source; you may add ONE final ["OTHER", n] slice to complete a % total. ONLY when the parts-of-a-whole framing is real.
- "ranking": {{"rows": [["LABEL", n], …], "unit": "", "caption": "one-line reading"}} — comparison of 3-6 ENTITIES on one metric from the source, for horizontal bars: top scorers, biggest creditors, countries by medal count. Largest first, labels max 12 chars uppercase. Values from the source only.
- "geo": {{"kind": "site|route|area|multi", "pins": [{{"lat": 25.997, "lon": -97.155, "label": "Starbase Launch Pad"}}], "link": false, "distance": "", "radius_km": 0, "region": "TEXAS · USA"}} — THE MAP TEST: did this story happen AT a specific place, and would SEEING that spot teach the reader something? The event must physically BE somewhere: a launch (pin the pad: "Starbase Launch Pad", "Vandenberg SLC-4E"), a match (the stadium), a crash/strike/riot/discovery (the site), a landmark sale (the building). Always pin the EXACT site, not the city around it.
  kind picks the map style — match it to the story's SHAPE:
    "site"  = it happened at a spot (default). 1-2 pins.
    "route" = movement with DIRECTION: flight diverted, missile path, convoy/troop advance, migration route. EXACTLY 2 pins in travel order: FROM first, TO second. Give "distance" ("1,560 km").
    "area"  = it covers a ZONE: earthquake felt across, storm path, wildfire, blackout, exclusion zone. 1 pin (the center) + "radius_km" from the source (felt 200 km away -> 200). NEVER guess the radius.
    "multi" = same event in SEVERAL places: riots in 4 cities, nationwide strikes, tournament venues. 3-5 pins, most important first.
  geo is RARE — emit it ONLY when seeing the place on a map genuinely teaches the reader something, which is just two cases: (1) the EXACT site matters (a specific facility, launch pad, crash site, epicenter, battlefield, the precise spot of the event), or (2) the location is one most readers could NOT place on a map (an obscure town, a remote region, a lesser-known country). DO NOT emit geo for well-known world cities or capitals (Paris, London, New York, Tokyo, Rome, Berlin, Moscow, Dubai, Los Angeles, etc.) where everyone already knows roughly where it is and a map adds nothing. Also OMIT for: company/product/funding/app news (an HQ city is not a location story); where a person happened to be when they spoke/tweeted/got injured; the city a court or org sits in; whole famous countries. When in doubt, OMIT — most stories should have NO map. 1-2 pins, real coordinates. link:true only with exactly 2 related pins (then "distance" like "1,560 km"). region: uppercase "AREA · COUNTRY".

- "receipts": {{"claim": "the disputed claim, max ~120 chars", "who": "Name · Role", "receipts": [{{"text": "the establishing fact, max 140 chars", "source": "Reuters"}}], "verdict": "short verdict that FOLLOWS from the receipts, max 90 chars"}} — RARE, high bar: ONLY when the story centers on a disputed or checkable CLAIM (political statement, company spin, viral rumor) AND the source articles THEMSELVES establish the facts. 1-2 receipts; each must name the establishing source (outlet, institution, document) AS STATED in the source text. The verdict must be what the receipts show — NEVER your own ruling, NEVER your own knowledge. If the sources don't settle the claim, OMIT this signal. Most stories do not qualify.
- "countdown": {{"name": "SpaceX IPO pricing", "datetime": "2026-06-12T13:30:00Z", "label": "IPO"}} — RARE: ONLY when the story is about a concretely SCHEDULED future event whose exact date (and time if known; use T00:00:00Z for date-only) is stated in the source, within the next 30 days: a launch, a verdict date, a vote, a match, a release. name max 40 chars, label: 2-12 char uppercase tag. NEVER guess a date. When unsure, OMIT.

CHART-DATA FLAGS — charts are a signature card of this feed, but ONLY when the chart shows THE STORY. The test: would the reader say "ah, so THAT's how big/fast it is" — or "why am I looking at this?". A chart that doesn't directly measure the headline is worse than no chart.
- "chart_ticker": Yahoo Finance symbol, ONLY when the PRICE MOVE ITSELF is the story: the stock jumped or crashed, earnings moved the price, IPO pricing, a valuation milestone, an index record. If the headline is not about money or markets, do NOT set it — a product launch, a partnership, a lawsuit, a delayed flight get NO stock chart (a flat share price tells the reader nothing). US stocks "TSLA" "AAPL", European listings "BOSS.DE" "AIR.PA", indices "^GSPC" "^DJI" "^IXIC", crypto "BTC-USD" "ETH-USD".
- "chart_metric": a search phrase (max 10 words) for a real numeric series over time that measures THE STORY'S OWN NAMED SUBJECT. The series must be about the SPECIFIC entity/event in the title — not industry, market, macro, or career-history backdrop. SET it only when the chart would show how the headline's own subject changed over time. GOOD (subject-specific & verifiable): a record progression the story is about (World Cup goals per tournament for a World Cup story), a named indicator the story IS about (eurozone inflation for an inflation story), heat-deaths per year for a heatwave story. BAD — never do these: a CEO's obituary → "US economic expansion lengths" (macro backdrop, not the person); one rocket launch → "yearly launch totals" (industry aggregate, not this launch); a company's local project → "global mine production" (industry, not the company); a culture story → unrelated population stats. If the only series you can name is generic industry/market/career background, OMIT chart_metric. Prefer NO chart over an adjacent one. AVOID company stock prices entirely unless the price move IS the headline.
- "breakdown_metric": a search phrase (max 10 words) whenever the story centers on a SHARE-OF-WHOLE composition whose full parts are NOT in the source: "Italian parliament seats by party 2026", "global smartphone market share Q1 2026", "US electricity generation mix by source", "World Cup group F standings points". The pipeline searches, verifies, and builds the donut itself.

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


def _canonicalize_marks(s: str) -> str:
    """Display text must carry ONLY flat <em>/<b> tags. The synthesis step
    bolds with markdown (**x**) and the model adds <em> inside those bold
    spans — clients can't render '**Nazi methods in <em>Syria</em>**'.
    Convert residual **markdown** to <b>, then un-nest: tags inside a
    tagged span are dropped (the outer emphasis wins)."""
    if not isinstance(s, str):
        return ''
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = s.replace('**', '')
    for outer in ('b', 'em'):
        pattern = re.compile(rf'<{outer}>.*?</{outer}>', re.S)
        s = pattern.sub(lambda m: f'<{outer}>' +
                        re.sub(r'</?(?:em|b)>', '',
                               m.group(0)[len(outer) + 2:-(len(outer) + 3)]) +
                        f'</{outer}>', s)
    # Drop empty tags left behind, then re-check balance (same-tag nesting
    # can orphan a closer) — unbalanced means strip that tag entirely.
    s = re.sub(r'<(em|b)>\s*</\1>', '', s)
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


_SCALE_UNITS = {'K': 1e3, 'M': 1e6, 'B': 1e9, 'T': 1e12}


def _humanize_number(value, prefix='', unit=''):
    """Rescale a magnitude number so it renders human-readably:
    '$0.0039B'->'$3.9M', '5000 M'->'5 B', '2500000'->'2.5M'. Only touches pure
    magnitude units (K/M/B/T) or bare numbers >= 10000; leaves %, KM, PTS, x,
    small/mid numbers untouched. Returns (value, prefix, unit)."""
    n = _num(value)
    if n is None:
        return value, prefix, unit
    u = str(unit or '').strip()
    if u.upper() in _SCALE_UNITS:
        total = n * _SCALE_UNITS[u.upper()]
    elif u == '' and abs(n) >= 10000:
        total = float(n)
    else:
        return value, prefix, unit
    if total == 0:
        return 0, prefix, ''
    neg = total < 0
    a = abs(total)
    for suf, div in (('T', 1e12), ('B', 1e9), ('M', 1e6), ('K', 1e3), ('', 1)):
        if a >= div:
            mant = a / div
            mant = round(mant, 1) if mant < 100 else round(mant)
            if isinstance(mant, float) and mant == int(mant):
                mant = int(mant)
            return (-mant if neg else mant), prefix, suf
    return value, prefix, unit


def _humanize_display_numbers(out: Dict) -> None:
    """Final display pass: rescale stat/big magnitudes so nothing renders like
    '$0.0039B'. Runs AFTER grounding (grounding checks the raw source value),
    so this only changes presentation, never whether a number is allowed."""
    for s in out.get('stats', []) or []:
        if isinstance(s, list) and len(s) >= 4:
            s[1], s[2], s[3] = _humanize_number(s[1], s[2], s[3])
    if isinstance(out.get('big'), list) and len(out['big']) >= 3:
        b = out['big']
        b[0], b[1], b[2] = _humanize_number(b[0], b[1], b[2])


def _vs_label(who) -> str:
    """Versus side label: short, uppercase, cut at a word boundary —
    'CANADIAN ADULTS (2022-20' mid-cuts are exactly what we're avoiding."""
    s = _strip_tags(str(who or '')).strip().upper()
    if len(s) > 16:
        cut = s[:17].rsplit(' ', 1)[0]
        s = cut if len(cut) >= 4 else s[:16]
    return s.strip(' (,-')


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


# ── SPAN-GROUNDING (2026-06-13 audit) ──────────────────────────────────
# A 658-article audit found 8/11 card types too loose, with rampant
# FABRICATION: the model emits numbers/places/quotes that read as
# authoritative but appear nowhere in the source (stats 20% wrong, versus
# 46% wrong). The prompts already forbid this and are ignored at
# generation. The fix is a deterministic grounding gate: a value may only
# survive if it literally appears in the material the model was given
# (title + bullets + source body). An absent card beats a fabricated one.

_MAG = {'k': 1e3, 'thousand': 1e3, 'm': 1e6, 'mn': 1e6, 'million': 1e6,
        'bn': 1e9, 'b': 1e9, 'billion': 1e9, 't': 1e12, 'trillion': 1e12}
_STAT_LABEL_BLOCKLIST = re.compile(
    r'\b(AGE|SEASONS?|REIGN NO|JUMPER NO|SQUAD NO|SHIRT NO|REPORTERS?|'
    r'MEMBERS ON BOARD|MINUTES OF MEDIA|MEDIA TIME|PRESS)\b')
# Venue / setting / building tokens — a pin built only on one of these is a
# story SETTING, not an insight, so it's dropped unless the venue is named in
# the title (then the venue itself is the story). Leading spaces guard against
# substring collisions (" center" must not match "epicenter").
_GEO_VENUE_TOKENS = ('stadium', 'arena', 'ballpark', 'pavilion', 'coliseum',
                     ' field', 'racecourse', 'velodrome', 'speedway',
                     'headquarters', ' hq', ' hall', ' center', ' centre',
                     'theatre', 'theater', ' club', ' court', ' dome',
                     ' garden', ' plaza', 'hotel', 'resort', 'casino',
                     'museum', 'cathedral', 'church', 'mosque', 'temple',
                     'university', 'college', 'hospital', 'airport',
                     ' station', 'palace', 'racetrack', 'circuit')
_SCORE_NONRESULT = re.compile(
    r'\b(injur|ruled out|rule out|preview|set to face|to face|to play|'
    r'transfer|signs?|signing|contract|record|milestone|retire|retires|'
    r'suspend|appoint|sack|hire|previews?|eyes?|targets?|could|may face)\b', re.I)
_SCORE_RESULT = re.compile(
    r'\b(beat|beats|win|wins|won|defeat|defeats|draw|draws|drew|lost|loses|'
    r'thrash|edge|edges|fall to|falls to|down|downs|hold|holds|rout|stun|'
    r'\d+\s*[-–]\s*\d+)\b', re.I)


def _build_ground_text(title, bullets, source_text):
    parts = [_strip_tags(title or '')]
    if isinstance(bullets, list):
        parts += [_strip_tags(b or '') for b in bullets]
    elif bullets:
        parts.append(_strip_tags(str(bullets)))
    head = ' '.join(parts).lower().replace(',', '')        # title + bullets
    full = (head + ' ' + (source_text or '').lower().replace(',', ''))
    return head, full


def _number_set(text):
    """All numeric forms present in text, magnitude words expanded."""
    nums = set()
    for m in re.finditer(r'\d+(?:\.\d+)?', text):
        tok = m.group(0)
        nums.add(tok)
        try:
            f = float(tok)
            if f == int(f):
                nums.add(str(int(f)))
        except ValueError:
            pass
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(k|thousand|mn|m|bn|b|billion|million|t|trillion)\b', text):
        nums.add(m.group(1))
        full = float(m.group(1)) * _MAG[m.group(2)]
        if full == int(full):
            nums.add(str(int(full)))
    return nums


def _extract_json_obj(text):
    """Pull the FIRST complete balanced {...} object out of a model response.
    Grounded responses append citation chips / source lists after the JSON, so
    a greedy regex over-matches into invalid trailing junk — walk braces
    instead. Prefers a ```json fenced block when present. Returns dict or None."""
    if not text:
        return None
    fence = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass
    start = text.find('{')
    if start < 0:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            esc = (c == '\\' and not esc)
            if c == '"' and not esc:
                in_str = False
        elif c == '"':
            in_str = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except Exception:
                    return None
    return None


def _is_trivial_series(vals):
    """A series that just counts up by 1 (1,2,3,4,5,6 — e.g. a running win
    tally) is not a real metric and makes a meaningless chart. Reject it."""
    if not vals or len(vals) < 3:
        return False
    try:
        diffs = [vals[i + 1] - vals[i] for i in range(len(vals) - 1)]
    except TypeError:
        return False
    return all(d == 1 for d in diffs)


_METRIC_STOP = {'the', 'and', 'for', 'with', 'from', 'over', 'time', 'year',
                'years', 'by', 'per', 'rate', 'number', 'total', 'global',
                'world', 'national', 'annual', 'monthly', 'data', 'index',
                'since', 'amid', 'after', 'before', 'new', 'news'}


def _metric_on_subject(metric, display_obj):
    """A grounded chart must measure the STORY'S named subject, not a topic-
    adjacent macro/industry/career backdrop (audit: 44% of charts were off-
    subject). Require the metric phrase to name an entity from the article's
    tags or a distinctive title word."""
    toks = set()
    for t in (display_obj.get('tags') or []):
        for w in re.sub(r'[^a-z0-9 ]', ' ', str(t).lower()).split():
            if len(w) >= 4:
                toks.add(w)
    title = re.sub(r'<[^>]+>', '', display_obj.get('title', '')).lower()
    for w in re.sub(r'[^a-z0-9 ]', ' ', title).split():
        if len(w) >= 4 and w not in _METRIC_STOP:
            toks.add(w)
    m = (metric or '').lower()
    return any(w in m for w in toks)


def _labels_temporal(labels):
    """Trend x-axis must be a real time axis — years / dated periods — not
    arbitrary category names. Require most labels to look temporal."""
    if not labels:
        return False
    pat = re.compile(r'(\d{4}|^Q[1-4]|\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|'
                     r'\d{2,4}S|\d+\s*BC|\d+\s*AD)\b|^\d{1,2}$|-)', re.I)
    hits = sum(1 for l in labels if pat.search(str(l)))
    return hits >= max(2, int(len(labels) * 0.6))


def _grounded(value, numset):
    """Is this numeric value present in the number set? Non-numeric → True
    (grounding is a numeric gate; text values are handled elsewhere)."""
    n = _num(value)
    if n is None:
        return True
    forms = {str(n)}
    if isinstance(n, float) and n == int(n):
        forms.add(str(int(n)))
    if isinstance(n, float):
        forms.add(f"{n:g}")
    return bool(forms & numset)


def _is_bare_year(value, prefix, unit):
    n = _num(value)
    return (n is not None and not prefix and not unit
            and isinstance(n, int) and 1900 <= n <= 2100)


def _apply_grounding_gates(out, title_text, head_text, full_text, category):
    """Drop fabricated / off-subject / duplicative signals. Mutates `out`."""
    num_full = _number_set(full_text)
    num_head = _number_set(head_text)
    cat = (category or '').lower()

    # User-facing signals ground against TITLE+BULLETS (num_head), not the
    # full body. The body mentions many off-topic numbers (other teams,
    # context figures); the story IS the title+bullets, so a stat/big/versus
    # value only "belongs" if it surfaces there. This single change kills
    # BOTH fabrication and off-subject leakage (Knicks stats on a Spurs
    # story) that full-body grounding let through (2026-06-13 re-audit).

    # --- big: the hero number — must be in title/bullets ---
    if 'big' in out and not _grounded(out['big'][0], num_head):
        del out['big']
    big_val = _num(out['big'][0]) if 'big' in out else None

    # --- versus: both sides grounded in head + SEMANTICALLY comparable ---
    # Grounding alone leaves a real defect (re-audit: 47% still incorrect):
    # two grounded, unequal, real numbers can still measure nothing
    # comparable. So: same unit for ALL kinds (not just change/gap), no
    # bare-year sides, no rank/ordinal sides.
    v = out.get('versus')
    if v:
        av, bv = _num(v['a']['val']), _num(v['b']['val'])
        au, bu = v['a'].get('unit', ''), v['b'].get('unit', '')
        a_ctx = (str(v['a'].get('who', '')) + ' ' + str(au)).lower()
        b_ctx = (str(v['b'].get('who', '')) + ' ' + str(bu)).lower()
        rank_like = any(t in a_ctx or t in b_ctx
                        for t in ('rank', '#', 'no.', 'nth', 'place', 'seed'))
        yearlike = (lambda n, u: n is not None and not u
                    and isinstance(n, int) and 1900 <= n <= 2100)
        drop = (not _grounded(av, num_head) or not _grounded(bv, num_head)
                or av == bv
                or (au and bu and au != bu)            # same metric, every kind
                or yearlike(av, au) or yearlike(bv, bu)
                or rank_like)
        if drop:
            del out['versus']
    versus_nums = set()
    if 'versus' in out:
        for side in ('a', 'b'):
            n = _num(out['versus'][side]['val'])
            if n is not None:
                versus_nums.add(n)

    # --- score: scores grounded in title+bullets + subject is a result ---
    sc = out.get('score')
    if sc:
        an, bn = _num(sc['a']['score']), _num(sc['b']['score'])
        grounded = _grounded(an, num_head) and _grounded(bn, num_head)
        # Subject gate keys on the TITLE only — if the headline is an injury/
        # preview/transfer, the match is background even if a bullet cites it.
        # POSITIVE result requirement: the title must affirmatively signal a
        # finished/live match (a result verb or an explicit scoreline). A
        # match merely mentioned as backdrop (ceremony, milestone, ring night,
        # attendance) has no result verb -> no score card.
        subject_ok = bool(_SCORE_RESULT.search(title_text))
        if not grounded or not subject_ok:
            del out['score']
    score_nums = set()
    if 'score' in out:
        for side in ('a', 'b'):
            n = _num(out['score'][side]['score'])
            if n is not None:
                score_nums.add(n)

    # big duplicates a score number → score owns it
    if big_val is not None and big_val in score_nums:
        out.pop('big', None)
        big_val = None

    # --- stats: grounded, not a bare year, not blocklisted label, not a
    #     duplicate of big/versus/score; suppress the row if <2 survive ---
    if out.get('stats'):
        dup_nums = set(versus_nums | score_nums)
        if big_val is not None:
            dup_nums.add(big_val)
        kept = []
        for s in out['stats']:
            label, value, prefix, unit = s[0], s[1], s[2], s[3]
            if not _grounded(value, num_head):           # in title/bullets
                continue
            if _is_bare_year(value, prefix, unit):
                continue
            if _STAT_LABEL_BLOCKLIST.search(str(label).upper()):
                continue
            if _num(value) in dup_nums:
                continue
            # Triviality floor: a raw count of 1-2 (no money/%/unit) is never
            # a meaningful standalone stat ("2 TEAMS", "TAG CHAMPIONS 2").
            nv = _num(value)
            if not prefix and not unit and isinstance(nv, (int, float)) and nv <= 2:
                continue
            # Within-array dedup: don't show the same number twice (one fact
            # split into two tiles — "both 12", a min/max of one range).
            if any(_num(k[1]) == nv for k in kept):
                continue
            kept.append(s)
        out['stats'] = kept if len(kept) >= 2 else []

    # --- inline charts: ground the series (market/grounded charts are added
    #     post-validate and never reach here) ---
    tr = out.get('trend')
    if tr and not all(_grounded(x, num_full) for x in tr.get('vals', [])):
        del out['trend']
    bd = out.get('breakdown')
    if bd and sum(1 for sl in bd.get('slices', [])
                  if sl[0] != 'OTHER' and not _grounded(sl[1], num_full)) > 0:
        del out['breakdown']
    rk = out.get('ranking')
    if rk:
        rows = rk.get('rows', [])
        ungrounded = sum(1 for r in rows if not _grounded(r[1], num_full))
        vals = [_num(r[1]) for r in rows if _num(r[1]) is not None]
        # Spread gate: near-equal bars are a non-story (3.0/2.5/2.47 → 1.2x).
        flat = vals and max(vals) > 0 and (min(vals) / max(vals)) > 0.67
        if ungrounded > 0 or flat:
            del out['ranking']

    # --- quote: a 6-word run must appear verbatim in the source, and the
    #     quotation itself must not contain an attribution verb (those are
    #     narrator paraphrase dressed as a quote, not real speech) ---
    q = out.get('quote')
    if q:
        qtext = _strip_tags(q['text']).lower()
        qw = re.sub(r'[^a-z0-9 ]', ' ', qtext).split()
        gw = ' '.join(re.sub(r'[^a-z0-9 ]', ' ', full_text).split())
        verbatim = len(qw) >= 8 and any(
            ' '.join(qw[i:i + 6]) in gw for i in range(0, max(1, len(qw) - 5)))
        has_attribution = bool(re.search(
            r'\b(said|says|according to|told|stated|added|noted)\b', qtext))
        # Named-newsmaker gate (2026-06-28): a quote must be attributable to a
        # real, named person — a bare "spokesperson"/"official"/"statement"
        # with no name is boilerplate, not a newsmaker voice. Require the
        # "who" to carry a proper name (a Titlecase token) and not be a generic
        # attribution alone. This is the dominant lever to cut quote volume.
        who_raw = _strip_tags(str(q.get('who', '')))
        who_l = who_raw.lower()
        has_name = bool(re.search(r'\b[A-Z][a-z]+', who_raw))
        generic_only = (not has_name) or bool(re.fullmatch(
            r'\s*(a\s+)?(spokesperson|spokesman|spokeswoman|official|officials|'
            r'statement|report|reports|source|sources|representative|the\s+\w+)\s*',
            who_l))
        if not verbatim or has_attribution or generic_only:
            del out['quote']

    # --- geo: every pin label must be grounded; venue/HQ pins dropped for
    #     sports results unless the venue is named in the headline ---
    g = out.get('geo')
    if g:
        kept_pins = []
        for p in g['pins']:
            lab = p['label'].lower()
            words = [w for w in re.sub(r'[^a-z0-9 ]', ' ', lab).split() if len(w) >= 4]
            # Place must be in the story itself (title+bullets), not merely
            # mentioned somewhere in the body — kills off-topic/incidental pins.
            grounded = any(w in head_text for w in words) or lab in head_text
            # Venue/HQ/setting pins teach nothing unless the venue ITSELF is
            # the story — drop them unless the place is named in the TITLE
            # (re-audit: geo's dominant weak mode). For Sports, treat EVERY
            # single-site pin as a venue (a stadium in any language), since a
            # match's location is never the insight.
            is_venue = (any(tok in lab for tok in _GEO_VENUE_TOKENS)
                        or (cat == 'sports' and g.get('kind', 'site') == 'site'))
            venue_ok = not (is_venue and not any(w in title_text for w in words))
            # Well-known-city gate: a single 'site' pin that's just a famous
            # city teaches nothing — drop it (maps are for precise/rare places).
            # route/area/multi are inherently informative, so exempt them.
            lab_clean = lab.rstrip('.').replace(', usa', '').strip()
            wellknown_ok = not (g.get('kind', 'site') == 'site'
                                and lab_clean in _GEO_WELLKNOWN)
            if grounded and venue_ok and wellknown_ok:
                kept_pins.append(p)
        kind = g.get('kind', 'site')
        if not kept_pins:
            out.pop('geo', None)
        else:
            if kind == 'route' and len(kept_pins) != 2:
                kind = 'site'
            if kind == 'multi' and len(kept_pins) < 3:
                kind = 'site'
            if kind == 'area' and (len(kept_pins) != 1 or 'radius_km' not in g):
                kind = 'site'
            g['kind'] = kind
            g['pins'] = kept_pins[:5 if kind == 'multi' else 2]
            if kind != 'area':
                g.pop('radius_km', None)


# Module impact order (most scroll-stopping first). Drives hero_rank — the
# hint that lets the client resolve each article to ONE primary card and
# composite the rest, instead of scattering a story's modules as separate
# cards. Server-authored so iOS + web feature the identical module.
_IMPACT_ORDER = ['breaking_cover', 'big', 'score', 'versus', 'receipts',
                 'trend', 'ranking', 'breakdown', 'timeline', 'geo', 'quote', 'stats']
# Pure-drama modules: own the full frame, never shrink into an embed.
_PURE_ONLY = {'breaking_cover', 'big', 'score', 'versus', 'receipts', 'quote'}
# Modules that can share a combined card (data-only, no photo, no full-frame
# drama). Composing is RARE — only these genuinely-complementary pairs, and
# only when BOTH are the article's top-2. A combined card is a DISTINCT
# layout (e.g. map + quote, no photo) — never "photo+bullets+module".
_COMPLEMENTARY_PAIRS = {
    frozenset({'geo', 'quote'}),       # a place + a voice from it
    frozenset({'geo', 'timeline'}),    # where + how it unfolded
    frozenset({'trend', 'quote'}),     # the data + a human reaction
    frozenset({'timeline', 'quote'}),  # the arc + a voice
    frozenset({'trend', 'timeline'}),  # the curve + its milestones
}


def compute_hero_rank(display_obj: Dict, category: str = '') -> None:
    """Stamp hero_rank / hero_strength / reserve_pure onto a FULLY-built
    display object (after enrich + breaking/cover_ok stamping). Deterministic,
    no model call. The client treats these as defaults it may demote for
    rhythm, never as mandates."""
    if not isinstance(display_obj, dict):
        return
    cat = (category or '').lower()
    has_stats = bool(display_obj.get('stats'))
    breaking_cover = bool(display_obj.get('breaking') and display_obj.get('cover_ok'))

    present = []
    for m in _IMPACT_ORDER:
        if m == 'breaking_cover':
            if breaking_cover:
                present.append(m)
        elif m == 'stats':
            if has_stats:
                present.append(m)
        elif m in display_obj:
            present.append(m)

    # Data-strength + category lifts (stable: only promote, preserve order).
    def lift(mod, before):
        if mod in present:
            present.remove(mod)
            idx = present.index(before) if before in present else 0
            present.insert(idx, mod)

    if cat == 'sports' and 'score' in present:
        lift('score', present[0])                       # score wins in sports
    geo = display_obj.get('geo')
    if geo and geo.get('kind') in ('route', 'area', 'multi'):
        lift('geo', 'timeline')                         # rich maps beat timelines
    tr = display_obj.get('trend')
    if tr and len(tr.get('vals', [])) >= 5:
        lift('trend', 'versus')                         # dense series is strong

    # MAX 2 candidate card types per article (user ruling). The client
    # renders #1 as a PURE distinct card by default and may fall back to #2
    # to keep that user's feed varied.
    hero_rank = present[:2]
    display_obj['hero_rank'] = hero_rank
    top = hero_rank[0] if hero_rank else None
    display_obj['reserve_pure'] = top in ('breaking_cover', 'big')
    display_obj['hero_strength'] = (
        0.9 if top in ('breaking_cover', 'big', 'score')
        else 0.7 if top in ('versus', 'trend', 'receipts', 'ranking')
        else 0.5 if top in ('timeline', 'geo', 'quote', 'breakdown')
        else 0.4 if top == 'stats'
        else 0.0)
    display_obj['pure_only'] = [m for m in hero_rank if m in _PURE_ONLY]
    # compose: RARE. Render the two as ONE combined distinct layout ONLY when
    # the top-2 are a genuinely-complementary data pair. Otherwise the article
    # stays a single PURE card (the default — this is what keeps the feed from
    # looking same-y). Drama/photo modules never compose.
    display_obj['compose'] = (
        len(hero_rank) == 2
        and frozenset(hero_rank) in _COMPLEMENTARY_PAIRS)


_WHY_STOP = frozenset("""the a an and or but nor of to in on at by with from into over under this that
these those it its their your our his her they them what which who whom is are was were be been being
has have had will would could should may might can more most less least very much many such only also
than then when while because matters meaning consequence stakes change changes affect affects impact
about as""".split())


def _ground_why_it_matters(sentence, head_text, full_text):
    """Anti-fabrication gate for why_it_matters. full_text is the lowercased,
    comma-stripped corpus from _build_ground_text (title+bullets+body). Every
    number and proper noun in the sentence must trace to the source, plus a
    minimum topical overlap. Returns the cleaned sentence or None. Reuses the
    same grounding primitives as the card signals (no separate gate)."""
    s = _strip_tags(str(sentence or '')).replace('**', '').strip()
    if len(s) < 20:
        return None
    corpus = full_text or ''
    corpus_nums = _number_set(corpus)
    # 1. every number must be grounded in the source
    for n in re.findall(r'\d+(?:\.\d+)?', s):
        base = n[:-2] if n.endswith('.0') else n
        if n not in corpus_nums and base not in corpus_nums and n not in corpus:
            return None
    # 2. proper nouns / acronyms (not at a sentence start) must appear in source
    prev_end = True
    for w in s.split():
        bare = re.sub(r"[^A-Za-z0-9]", '', w)
        initial = prev_end
        prev_end = w.endswith(('.', '!', '?', ':'))
        if len(bare) < 3:
            continue
        proper = (bare[0].isupper() and bare[1:].lower() == bare[1:]) \
            or (bare.isupper() and bare.isalpha())
        if proper and not initial and bare.lower() not in corpus:
            return None
    # 3. topical overlap: >=2 substantive content words shared with the source
    content = {t for t in re.findall(r"[a-z0-9']+", s.lower())
               if len(t) >= 4 and t not in _WHY_STOP}
    if sum(1 for t in content if t in corpus) < 2:
        return None
    # clean-truncate to ~200 chars at a sentence/word boundary (never mid-word)
    if len(s) > 200:
        cut = s[:200]
        ends = [m.end() for m in re.finditer(r'[.!?](?:\s|$)', cut) if m.end() >= 120]
        if ends:
            s = cut[:ends[-1]].strip()
        else:
            sp = cut.rfind(' ')
            s = (cut[:sp] if sp >= 120 else cut).rstrip()
        if s.count('(') > s.count(')'):
            s = re.sub(r'\s*\([^)]*$', '', s).rstrip()
        s = s.rstrip(' ,;:—-')
    return s


def validate_display(result: Dict, pipeline_category: str,
                     orig_title: str, orig_bullets: List[str],
                     source_text: str = '') -> Optional[Dict]:
    """
    Validate + repair the model output. Required fields are repaired with
    deterministic fallbacks; invalid OPTIONAL signals are silently dropped
    (a story with zero signals is fine — cover/classic/split always apply).
    A span-grounding pass then removes any signal whose data does not appear
    in the source material (anti-fabrication, 2026-06-13 audit).
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
    out['title'] = _canonicalize_marks(title)

    # lede
    lede = _strip_tags(str(result.get('lede', ''))).replace('**', '').strip()
    if not lede:
        lede = _plain(orig_bullets[0]) if orig_bullets else ''
    # Cut at a sentence/word boundary — a "…" mid-sentence on the card is
    # exactly what we're avoiding.
    if len(lede) > 160:
        first_sentence = re.split(r'(?<=[.!?]) ', lede)[0]
        lede = first_sentence if len(first_sentence) <= 160 \
            else lede[:158].rsplit(' ', 1)[0] + '.'
    out['lede'] = lede

    # why_it_matters (grounded later in the span-grounding pass) + tone.
    # Keep original case here so proper-noun grounding works downstream.
    wim = _strip_tags(str(result.get('why_it_matters', ''))).replace('**', '').strip()
    out['why_it_matters'] = wim or None
    out['tone'] = 'light' if str(result.get('tone', '')).strip().lower() == 'light' else 'standard'

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
    out['bullets'] = [_canonicalize_marks(b) for b in clean_bullets]

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
        if qtext and qwho and 10 <= words <= 32:
            out['quote'] = {'text': _canonicalize_marks(qtext), 'who': qwho[:60]}

    versus = result.get('versus')
    if isinstance(versus, dict):
        a, b = versus.get('a'), versus.get('b')
        if isinstance(a, dict) and isinstance(b, dict):
            av, bv = _num(a.get('val')), _num(b.get('val'))
            awho = _vs_label(a.get('who'))
            bwho = _vs_label(b.get('who'))
            if av is not None and bv is not None and awho and bwho and (av + bv) > 0:
                kind = str(versus.get('kind', '')).strip().lower()
                if kind not in ('duel', 'change', 'gap'):
                    kind = 'duel'
                aunit = str(a.get('unit', ''))[:8]
                bunit = str(b.get('unit', ''))[:8]
                out['versus'] = {
                    'kind': kind,
                    'a': {'val': av, 'unit': aunit, 'who': awho},
                    'b': {'val': bv, 'unit': bunit, 'who': bwho},
                    'note': _strip_tags(str(versus.get('note', ''))).strip()[:140],
                }
                if kind == 'change' and av != 0:
                    # Server-computed delta so the client never does math:
                    # percentage-point diff for % metrics, % change otherwise.
                    if aunit == '%' or bunit == '%':
                        diff = round(bv - av, 1)
                        out['versus']['delta'] = f"{'+' if diff >= 0 else ''}{diff:g} PTS"
                    else:
                        pct = round((bv - av) / abs(av) * 100)
                        out['versus']['delta'] = f"{'+' if pct >= 0 else ''}{pct}%"
                else:
                    ratio = _num(versus.get('ratio'))
                    if ratio is None or not (0 < ratio < 1):
                        ratio = av / (av + bv)
                    out['versus']['ratio'] = max(0.05, min(0.95, round(float(ratio), 3)))

    tl = validate_timeline_entries(result.get('timeline'))
    if tl:
        out['timeline'] = tl

    # timeline_story flag (internal — workflow runs the dedicated timeline
    # writer for flagged stories, then removes the flag).
    if result.get('timeline_story') is True:
        out['timeline_story'] = True

    trend = result.get('trend')
    if isinstance(trend, dict):
        vals = [_num(v) for v in (trend.get('vals') or [])]
        labels = [str(l).strip().upper()[:8] for l in (trend.get('labels') or [])]
        caption = _strip_tags(str(trend.get('caption', ''))).strip()
        if (3 <= len(vals) <= 8 and all(v is not None for v in vals)
                and len(labels) == len(vals) and all(labels) and caption
                and not _is_trivial_series(vals)):
            style = str(trend.get('style', '')).strip().lower()
            if style not in ('bar', 'line'):
                style = 'line' if len(vals) >= 5 else 'bar'
            out['trend'] = {'style': style, 'vals': vals, 'labels': labels,
                            'unit': str(trend.get('unit', ''))[:6],
                            'caption': caption[:140]}

    # breakdown (donut) — composition of a whole
    breakdown = result.get('breakdown')
    if isinstance(breakdown, dict) and isinstance(breakdown.get('slices'), list):
        slices = []
        for s in breakdown['slices'][:6]:
            if isinstance(s, (list, tuple)) and len(s) >= 2:
                lab = _strip_tags(str(s[0])).strip().upper()[:14]
                v = _num(s[1])
                if lab and v is not None and v > 0:
                    slices.append([lab, v])
        caption = _strip_tags(str(breakdown.get('caption', ''))).strip()
        unit = str(breakdown.get('unit', ''))[:6]
        total = sum(v for _, v in slices)
        # % compositions must roughly complete the whole; absolute ones just
        # need 3+ real parts.
        pct_ok = unit != '%' or 90 <= total <= 110
        if len(slices) >= 3 and caption and pct_ok:
            slices.sort(key=lambda s: s[1], reverse=True)
            out['breakdown'] = {'slices': slices, 'unit': unit,
                                'caption': caption[:140]}

    # ranking (horizontal bars) — entities compared on one metric
    ranking = result.get('ranking')
    if isinstance(ranking, dict) and isinstance(ranking.get('rows'), list):
        rows = []
        for s in ranking['rows'][:6]:
            if isinstance(s, (list, tuple)) and len(s) >= 2:
                lab = _strip_tags(str(s[0])).strip().upper()[:14]
                v = _num(s[1])
                if lab and v is not None:
                    rows.append([lab, v])
        caption = _strip_tags(str(ranking.get('caption', ''))).strip()
        if len(rows) >= 3 and caption:
            # Keep the model's order — for lower-is-better metrics (race
            # times) a forced sort-desc would put the winner LAST.
            out['ranking'] = {'rows': rows,
                              'unit': str(ranking.get('unit', ''))[:6],
                              'caption': caption[:140]}

    # score (sports scoreboard) — head-to-head match results
    score = result.get('score')
    if isinstance(score, dict):
        sa, sb = score.get('a'), score.get('b')
        if isinstance(sa, dict) and isinstance(sb, dict):
            sport = str(score.get('sport', '')).strip().lower()
            if sport not in ('football', 'basketball', 'tennis', 'hockey',
                             'baseball', 'cricket', 'rugby', 'mma', 'boxing',
                             'amfootball', 'volleyball'):
                sport = 'other'
            ateam = _strip_tags(str(sa.get('team', ''))).strip().upper()[:14]
            bteam = _strip_tags(str(sb.get('team', ''))).strip().upper()[:14]
            ascore = _strip_tags(str(sa.get('score', ''))).strip()[:8]
            bscore = _strip_tags(str(sb.get('score', ''))).strip()[:8]
            if ateam and bteam and ascore and bscore \
                    and any(c.isdigit() for c in ascore + bscore):
                out['score'] = {
                    'sport': sport,
                    'a': {'team': ateam, 'score': ascore,
                          'detail': _strip_tags(str(sa.get('detail', ''))).strip()[:24]},
                    'b': {'team': bteam, 'score': bscore,
                          'detail': _strip_tags(str(sb.get('detail', ''))).strip()[:24]},
                    'status': _strip_tags(str(score.get('status', ''))).strip().upper()[:8] or 'FT',
                    'note': _strip_tags(str(score.get('note', ''))).strip()[:140],
                }

    # receipts (fact-check card) — every part must be present and sourced
    rec = result.get('receipts')
    if isinstance(rec, dict):
        claim = _strip_tags(str(rec.get('claim', ''))).strip()
        who = _strip_tags(str(rec.get('who', ''))).strip()
        verdict = _strip_tags(str(rec.get('verdict', ''))).strip()
        items = []
        for it in (rec.get('receipts') or [])[:2]:
            if isinstance(it, dict):
                txt = _strip_tags(str(it.get('text', ''))).strip()
                src = _strip_tags(str(it.get('source', ''))).strip()
                if txt and src:
                    items.append({'text': txt[:150], 'source': src[:40]})
        if 10 <= len(claim) <= 160 and verdict and items:
            out['receipts'] = {'claim': claim[:140], 'who': who[:60],
                               'receipts': items, 'verdict': verdict[:100]}

    # countdown (scheduled-event chip) — must parse to a near future moment
    cd = result.get('countdown')
    if isinstance(cd, dict) and cd.get('name') and cd.get('datetime'):
        try:
            dt = datetime.fromisoformat(str(cd['datetime']).replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            if now < dt < now + timedelta(days=45):
                out['countdown'] = {
                    'name': _strip_tags(str(cd['name'])).strip()[:44],
                    'datetime': dt.isoformat(),
                    'label': _strip_tags(str(cd.get('label', ''))).strip().upper()[:12],
                }
        except ValueError:
            pass

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
    bmetric = result.get('breakdown_metric')
    if isinstance(bmetric, str) and bmetric.strip():
        out['breakdown_metric'] = _strip_tags(bmetric).strip()[:80]

    geo = result.get('geo')
    if isinstance(geo, dict) and isinstance(geo.get('pins'), list):
        kind = str(geo.get('kind', '')).strip().lower()
        if kind not in ('site', 'route', 'area', 'multi'):
            kind = 'site'
        max_pins = 5 if kind == 'multi' else 2
        pins = []
        for p in geo['pins'][:max_pins]:
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
        # Per-kind shape requirements (fall back to site rather than drop).
        if kind == 'route' and len(pins) != 2:
            kind = 'site'
        if kind == 'multi' and len(pins) < 3:
            kind, pins = 'site', pins[:2]
        radius_km = _num(geo.get('radius_km'))
        if kind == 'area':
            if radius_km is None or not 1 <= radius_km <= 3000 or len(pins) != 1:
                kind, radius_km = 'site', None
        else:
            radius_km = None
        if pins:
            link = (kind == 'route') or (bool(geo.get('link')) and len(pins) == 2)
            out['geo'] = {
                'kind': kind,
                'pins': pins,
                'link': link,
                'distance': _strip_tags(str(geo.get('distance', ''))).strip()[:16] if link else '',
                'region': _strip_tags(str(geo.get('region', ''))).strip().upper()[:36],
            }
            if radius_km is not None:
                out['geo']['radius_km'] = round(float(radius_km))

    # Span-grounding gate — drop fabricated / off-subject / duplicative
    # signals (2026-06-13 audit). Runs last, with full cross-signal context.
    head_text, full_text = _build_ground_text(orig_title, orig_bullets, source_text)
    title_text = _strip_tags(orig_title or '').lower()
    _apply_grounding_gates(out, title_text, head_text, full_text, pipeline_category)

    # why_it_matters consequence line — grounded against the source (numbers +
    # proper nouns must trace to title/bullets/body); nulled otherwise.
    out['why_it_matters'] = _ground_why_it_matters(
        out.get('why_it_matters'), head_text, full_text)

    # Final display formatting: rescale magnitudes ($0.0039B -> $3.9M).
    _humanize_display_numbers(out)

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
        # Count numbers in the HEADLINE material only (title+bullets). If the
        # story has >=3 there but stats came back empty, the model under-
        # emitted — worth a retry. (Counting the source body instead caused
        # the model to mine body trivia; grounding is head-only now, so a
        # head-driven retry can only surface LEGIT headline numbers.)
        _head_numbers = len(re.findall(
            r'\d+', f"{title} {' '.join(b for b in bullets)}"))
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
                                           title, bullets,
                                           source_text=article.get('source_text', ''))
                if cleaned:
                    # Head-aware retry: a story with >=3 headline numbers but
                    # <2 surviving stats means the model under-surfaced them.
                    # Re-roll once; the grounding gate keeps any new stats
                    # honest, so this raises coverage without filler.
                    if cleaned.get('stats') or _head_numbers < 3 \
                            or attempt >= self.config.retry_attempts - 1:
                        return cleaned
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
        # A near-flat line tells the reader nothing — if the price barely
        # moved over the window, the chart is noise, not news. Skip it.
        mean = sum(vals) / len(vals)
        if mean and (max(vals) - min(vals)) / abs(mean) < 0.08:
            print(f"   ⚠️ [chart] {ticker} moved <8% over the window — flat line, skipping")
            return None
        unit = '$' if currency == 'USD' else ''
        name = result.get('meta', {}).get('symbol', symbol)
        return {'style': 'line', 'vals': vals, 'labels': labels, 'unit': unit,
                'caption': f"{name} share price — last 6 months ({currency})"}
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
    # gemini-2.5 spends "thinking" tokens from maxOutputTokens; search
    # grounding + JSON needs headroom or the response comes back with no
    # content part (intermittent). 8192 + retries.
    data = None
    for attempt in range(4):
        try:
            resp = requests.post(url, json={
                "contents": [{"parts": [{"text": GROUNDED_TREND_PROMPT.format(
                    today=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    metric=metric)}]}],
                "tools": [{"google_search": {}}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192,
                                     "thinkingConfig": {"thinkingBudget": 1024}},
            }, timeout=90)
            resp.raise_for_status()
            cand = resp.json()['candidates'][0]
            # No grounding metadata = the model never actually searched.
            if 'groundingMetadata' not in cand or 'content' not in cand:
                continue
            text = ''.join(p.get('text', '') for p in cand['content'].get('parts', []))
            data = _extract_json_obj(text)
            if data:
                break
        except Exception as e:
            print(f"   ⚠️ [chart] grounded fetch attempt {attempt + 1} for {metric!r}: {e}")
        time.sleep(1)
    if data is None:
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
    if _is_trivial_series(vals):       # a 1,2,3,4,5,6 count-up isn't a metric
        print(f"   ⚠️ [chart] trivial count series for {metric!r} — skipping")
        return None
    # Near-flat series make pointless charts (rates/polls move in small
    # steps, so the threshold is gentler than the market fetcher's).
    _mean = sum(vals) / len(vals)
    if _mean and (max(vals) - min(vals)) / abs(_mean) < 0.02:
        print(f"   ⚠️ [chart] grounded series for {metric!r} is flat — skipping")
        return None
    # Valid time axis — reject category-axis "trends" (audit: many charts had
    # arbitrary non-temporal labels).
    if not _labels_temporal(labels):
        print(f"   ⚠️ [chart] non-temporal labels for {metric!r} — rejecting")
        return None
    # Anti-hallucination: require a MAJORITY of values to be anchored in the
    # cited evidence sentences. The previous 1/3 threshold let through charts
    # that were 44% data-wrong (audit) — web-grounding alone isn't enough;
    # demand the evidence actually prove most of the plotted points.
    ev_text = ' '.join(str(e) for e in evidence).replace(',', '')
    anchored = 0
    for v in vals:
        forms = {f"{v}", f"{v:g}"}
        if isinstance(v, float) and v == int(v):
            forms.add(str(int(v)))
        if any(f in ev_text for f in forms):
            anchored += 1
    if anchored <= len(vals) // 2:
        print(f"   ⚠️ [chart] only {anchored}/{len(vals)} values evidence-anchored — rejecting")
        return None
    return {'style': 'line' if len(vals) >= 5 else 'bar',
            'vals': vals, 'labels': labels,
            'unit': str(data.get('unit', ''))[:6], 'caption': caption[:140]}


TIMELINE_PROMPT = """You write the TIMELINE rail for a premium news feed — the story's arc in 3-4 beats. You only get stories that genuinely developed over time.

TODAY'S DATE: {today}
STORY TITLE: {title}
BULLETS:
{bullets}
SOURCE TEXT:
{source_text}

Return ONLY a JSON object: {{"timeline": [["LABEL", "beat text"], …]}}

HOW TO WRITE EACH BEAT — this is the craft that matters:
- ONE tight factual sentence, 40-90 chars, active voice, present tense for the newest beat, past for earlier ones.
- Every beat carries at least one CONCRETE specific: a number, a name, a place, an amount. "Russia strikes Kyiv grid; 2M lose power" — never "tensions escalated" or "the situation developed".
- Each beat must say what CHANGED on that date — a reader should see the story build beat by beat.
- The newest beat must NOT restate the headline — add the detail the headline didn't have (the where, the exact figure, the mechanism).

STRUCTURE:
- 3-4 entries, ordered: ["NEXT", "…"] FIRST (only if the source states a concrete dated future step), then newest → oldest.
- LABEL: compact absolute date — "JUN 11", "MAY 2025", "Q1 2026", "2023". NEVER weekdays, "TODAY", or relative wording.
- Every beat must belong to THIS story's arc. Career history, biography, institutional background = banned.

GOOD: [["NEXT","Canada opens vs Bosnia on June 14 without him"],["JUN 11","Davies ruled out of the opener after failing fitness test"],["JUN 10","MRI shows the knee at 85%, short of match readiness"],["MAR 2025","Davies tears ACL in Champions League quarterfinal"]]
BAD:  [["JUN 11","Davies ruled out"],["2019","Davies joined Bayern"],["2015","Davies began career in Vancouver"]]

If the source doesn't actually contain 3 dated beats of this story, return {{"timeline": []}} — an honest empty answer beats filler."""


def fetch_timeline_dedicated(article: Dict, api_key: str) -> Optional[list]:
    """Focused timeline writer for flagged developing stories."""
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    prompt = TIMELINE_PROMPT.format(
        today=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        title=_strip_tags(article.get('title', '')).replace('**', ''),
        bullets='\n'.join(f'- {b}' for b in (article.get('bullets') or [])),
        source_text=(article.get('source_text') or 'not available')[:6000],
    )
    for attempt in range(2):
        try:
            resp = requests.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096,
                                     "responseMimeType": "application/json"},
            }, timeout=60)
            resp.raise_for_status()
            text = resp.json()['candidates'][0]['content']['parts'][0]['text']
            m = re.search(r'\{[\s\S]*\}', text)
            data = json.loads(m.group(0) if m else text)
            return validate_timeline_entries(data.get('timeline'))
        except Exception as e:
            print(f"   ⚠️ [timeline] dedicated writer attempt {attempt + 1} failed: {e}")
            time.sleep(2)
    return None


GROUNDED_BREAKDOWN_PROMPT = """Today's date: {today}.
Use Google Search to find the REAL published composition for:
"{metric}"

Return ONLY a JSON object (no markdown):
{{"slices": [["LABEL", n], …],
  "unit": "%",
  "caption": "one line naming the composition and its source, max 90 chars",
  "evidence": ["verbatim sentence from a search result containing each number"]}}

STRICT RULES:
1. 3-6 slices, biggest first, labels max 12 chars uppercase. If unit is "%",
   slices must cover (close to) the whole — add a final ["OTHER", n] if needed,
   computed from the published total, never guessed.
2. Every number MUST literally appear in your search results (OTHER may be the
   arithmetic remainder to 100). Copy the proving sentences into evidence.
3. NEVER estimate or recall from memory. If search does not surface the real
   composition, return {{}} — that is a good answer."""


def fetch_breakdown_grounded(metric: str, api_key: str) -> Optional[Dict]:
    """Google-grounded composition fetch; values must verify vs evidence."""
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    try:
        data = None
        for attempt in range(3):
            resp = requests.post(url, json={
                "contents": [{"parts": [{"text": GROUNDED_BREAKDOWN_PROMPT.format(
                    today=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    metric=metric)}]}],
                "tools": [{"google_search": {}}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192,
                                     "thinkingConfig": {"thinkingBudget": 1024}},
            }, timeout=90)
            resp.raise_for_status()
            cand = resp.json()['candidates'][0]
            if 'groundingMetadata' not in cand or 'content' not in cand:
                time.sleep(1); continue
            text = ''.join(p.get('text', '') for p in cand['content'].get('parts', []))
            data = _extract_json_obj(text)
            if data:
                break
            time.sleep(1)
        if data is None:
            return None
    except Exception as e:
        print(f"   ⚠️ [breakdown] grounded fetch failed for {metric!r}: {e}")
        return None

    slices = []
    for s in (data.get('slices') or [])[:6]:
        if isinstance(s, (list, tuple)) and len(s) >= 2:
            lab = _strip_tags(str(s[0])).strip().upper()[:14]
            v = _num(s[1])
            if lab and v is not None and v > 0:
                slices.append([lab, v])
    caption = _strip_tags(str(data.get('caption', ''))).strip()
    unit = str(data.get('unit', ''))[:6]
    evidence = data.get('evidence')
    if not (3 <= len(slices) <= 6 and caption
            and isinstance(evidence, list) and evidence):
        return None
    if unit == '%' and not 90 <= sum(v for _, v in slices) <= 110:
        return None
    # Anti-hallucination: web-grounded (groundingMetadata present); evidence
    # sentences are a partial spot-check. Require >= half the non-OTHER
    # slices anchored (min 2) rather than all.
    ev_text = ' '.join(str(e) for e in evidence).replace(',', '')
    checkable = [(lab, v) for lab, v in slices if lab != 'OTHER']
    anchored = 0
    for lab, v in checkable:
        forms = {f"{v}", f"{v:g}"}
        if isinstance(v, float) and v == int(v):
            forms.add(str(int(v)))
        if any(f in ev_text for f in forms):
            anchored += 1
    if anchored < max(2, len(checkable) // 2):
        print(f"   ⚠️ [breakdown] only {anchored}/{len(checkable)} slices anchored — rejecting")
        return None
    return {'slices': slices, 'unit': unit, 'caption': caption[:140]}


_PRICE_MOVE = re.compile(
    r'\b(stocks?|shares?|share price|plunges?|plunged|soars?|surges?|surged|'
    r'tumbles?|rally|rallies|rallied|jumps?|jumped|drops?|dropped|falls?|fell|'
    r'rises?|rose|sinks?|sank|crash|crashes|crashed|ipo|valuation|market cap|'
    r'all-time high|record high|sell-?off|listing|float|earnings)\b|%', re.I)


def enrich_display_with_chart(display_obj: Dict, api_key: str) -> None:
    """Consume chart_ticker/chart_metric flags; attach a verified trend."""
    if not isinstance(display_obj, dict):
        return
    ticker = display_obj.pop('chart_ticker', None)
    metric = display_obj.pop('chart_metric', None)
    bmetric = display_obj.pop('breakdown_metric', None)
    title_l = re.sub(r'<[^>]+>', '', display_obj.get('title', '')).lower()
    if 'trend' not in display_obj:
        trend = None
        # Stock chart ONLY when the headline is about a price move — otherwise
        # a tradeable company in the story (e.g. a billionaire's firm on a
        # trafficking story) wrongly gets a share-price chart.
        if ticker and _PRICE_MOVE.search(title_l):
            trend = fetch_trend_from_market(ticker)
            if trend:
                print(f"   📈 [chart] real market series attached ({ticker})")
        elif ticker:
            print(f"   ⏭️ [chart] ticker {ticker} skipped — headline not about price")
        # Subject-match gate: skip off-subject grounded series entirely.
        if trend is None and metric and _metric_on_subject(metric, display_obj):
            trend = fetch_trend_grounded(metric, api_key)
            if trend:
                print(f"   📈 [chart] grounded series attached ({metric!r})")
        elif metric:
            print(f"   ⏭️ [chart] off-subject metric skipped ({metric!r})")
        if trend:
            display_obj['trend'] = trend
    if bmetric and 'breakdown' not in display_obj and _metric_on_subject(bmetric, display_obj):
        breakdown = fetch_breakdown_grounded(bmetric, api_key)
        if breakdown:
            display_obj['breakdown'] = breakdown
            print(f"   🍩 [chart] grounded breakdown attached ({bmetric!r})")


# ================================================================
# DAILY INTERSTITIAL MODULES (feed_modules table)
# ================================================================
# One row per (module_date, module_type). Generated once per day, the
# first pipeline cycle that runs after midnight UTC. Market pulse is
# NOT generated here — live quotes are a client-side fetch.

MODULES_PROMPT = """You produce daily interstitial-module content for a news feed.
TODAY'S DATE: {today}

RECENT HEADLINES (today's published stories; each line is numbered with its id):
{headlines}

Return ONE JSON object with EXACTLY these keys. These are POOLS — produce the
full set; the feed personalizes which ones each reader sees.

- "history": the FULL set of genuinely significant, well-documented events that happened on {month_day} in past years — as many as you confidently know, up to 16 (aim for 10+), spanning DIVERSE topics (science, space, culture, sports, politics, disasters, discovery). Each as [year, "one-sentence description", ["topic","tags"], major]. year = integer. The 1-3 topic tags are lowercase everyday keywords for the event's subject (e.g. "space","war","science","music","politics","sports","technology"). major = a boolean; set it true for EXACTLY ONE event (the single most globally significant) and false for all the rest. Most impactful first.

- "notd": 3-5 candidate "numbers of the day", each from a DIFFERENT headline above: {{"value": N, "prefix": "$", "unit": "B", "context": "one sentence with a memorable comparison", "headline": <the headline NUMBER it comes from>, "topic_tags": ["..."]}}. value = the BARE number (magnitude like B/M/% goes in unit, never in value). The number MUST appear in its headline. topic_tags = 1-3 lowercase subject keywords. NEVER invent a number.

- "briefs": 10-15 one-line briefs, each from a DIFFERENT headline above (cover as many distinct stories as you can), each {{"tag": "2-6 char uppercase topic tag (EU, OIL, CHIPS)", "text": "one sentence, max 110 chars, key entity in <b>"}}.

- "countdowns": 0-4 UPCOMING scheduled events within the next 30 days that you are CONFIDENT about (central-bank decisions, scheduled launches, votes, releases, fixtures), each {{"name": "event name", "datetime": "YYYY-MM-DDTHH:MM:SSZ", "context": "one factual line", "headline": <headline number if it came from one, else null>, "topic_tags": ["..."]}}. If you are not certain of an exact date, OMIT it. An empty list is fine.

Rules: no fabricated numbers or dates; every notd/countdown must trace to a headline or a genuinely-known scheduled event; return ONLY the JSON object."""


def _fetch_launch_countdowns() -> list:
    """Upcoming confirmed rocket launches from Launch Library (exact
    scheduled times, structured API — no AI in the loop)."""
    try:
        resp = requests.get(
            "https://ll.thespacedevs.com/2.2.0/launch/upcoming/"
            "?limit=10&hide_recent_previous=true",
            timeout=20, headers={'User-Agent': 'TodayPlus/1.0'})
        resp.raise_for_status()
        now = datetime.now(timezone.utc)
        rows = []
        for l in resp.json().get('results', []):
            net = l.get('net')
            status = (l.get('status') or {}).get('abbrev', '')
            if not net or status != 'Go':
                continue
            try:
                dt = datetime.fromisoformat(net.replace('Z', '+00:00'))
            except ValueError:
                continue
            if not now < dt < now + timedelta(days=30):
                continue
            provider = (l.get('launch_service_provider') or {}).get('name', '')
            pad_loc = ((l.get('pad') or {}).get('location') or {}).get('name', '')
            rows.append({
                'name': _strip_tags(str(l.get('name', ''))).split('|')[0].strip()[:44] or 'Rocket launch',
                'datetime': dt.isoformat(),
                'context': ' · '.join(x for x in (provider, pad_loc) if x)[:140],
            })
            if len(rows) >= 2:
                break
        return rows
    except Exception as e:
        print(f"   ⚠️ [modules] launch calendar fetch failed: {e}")
        return []


GROUNDED_CALENDAR_PROMPT = """Today's date: {today}.
Use Google Search to find the OFFICIALLY SCHEDULED date (and time if published) of each upcoming event below, within the next 45 days:
1. Next US Federal Reserve (FOMC) interest rate decision
2. Next US CPI inflation report release
3. Next ECB monetary policy (rate) decision
4. Next earnings report from a mega-cap company (Nvidia, Apple, Microsoft, Amazon, Google, Meta, Tesla — whichever reports SOONEST)
5. Next major sports final or marquee match (World Cup final/semis, Champions League final, Super Bowl, NBA Finals game, Grand Slam final — whichever is soonest)
6. Next major film or game release with a confirmed worldwide date

Return ONLY a JSON object:
{{"events": [{{"name": "Fed rate decision", "datetime": "YYYY-MM-DDTHH:MM:SSZ", "context": "one factual line"}}],
  "evidence": ["verbatim sentence from a search result confirming each date"]}}

Rules: include an event ONLY if search confirms its official scheduled date
(copy the proving sentence into evidence). Skip any category you cannot
confirm. Use T00:00:00Z when only the date is published. Names short and
specific ("Nvidia Q2 earnings", "World Cup final"). NEVER guess."""


def _fetch_grounded_calendar(api_key: str) -> list:
    """Officially scheduled economic-calendar events via grounded search."""
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    try:
        resp = requests.post(url, json={
            "contents": [{"parts": [{"text": GROUNDED_CALENDAR_PROMPT.format(
                today=datetime.now(timezone.utc).strftime('%Y-%m-%d'))}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
        }, timeout=90)
        resp.raise_for_status()
        cand = resp.json()['candidates'][0]
        if 'groundingMetadata' not in cand:
            return []
        text = ''.join(p.get('text', '') for p in cand['content']['parts'])
        m = re.search(r'\{[\s\S]*\}', text)
        data = json.loads(m.group(0)) if m else {}
    except Exception as e:
        print(f"   ⚠️ [modules] grounded calendar fetch failed: {e}")
        return []
    now = datetime.now(timezone.utc)
    rows = []
    if isinstance(data.get('events'), list) and data.get('evidence'):
        for e in data['events'][:8]:
            if not (isinstance(e, dict) and e.get('name') and e.get('datetime')):
                continue
            try:
                dt = datetime.fromisoformat(str(e['datetime']).replace('Z', '+00:00'))
            except ValueError:
                continue
            ctx = _strip_tags(str(e.get('context', ''))).strip()
            # "estimated"/"expected" = not officially scheduled — a countdown
            # to a guessed date is exactly what we must never show.
            if any(w in ctx.lower() for w in ('estimated', 'expected to', 'likely', 'tentative')):
                continue
            if now < dt < now + timedelta(days=45):
                rows.append({'name': _strip_tags(str(e['name'])).strip()[:44],
                             'datetime': dt.isoformat(),
                             'context': ctx[:140]})
    return rows


_UPCOMING_TAG_KEYWORDS = [
    (('fomc', 'rate decision', 'interest rate', 'cpi', 'inflation', 'ecb',
      'central bank', 'federal reserve'), ['economy', 'interest rates', 'markets']),
    (('earnings', 'quarterly', 'results'), ['markets', 'business', 'earnings']),
    (('launch', 'rocket', 'spacex', 'nasa', 'starship', 'satellite'), ['space', 'technology']),
    (('election', 'vote', 'referendum', 'ballot'), ['politics', 'election']),
    (('summit', 'talks', 'nato', 'united nations'), ['politics', 'world']),
    (('final', 'semi-final', 'match', 'fixture', 'cup', 'grand prix'), ['sports']),
    (('film', 'movie', 'premiere', 'release', 'season', 'episode'), ['entertainment']),
    (('verdict', 'trial', 'hearing', 'court', 'ruling'), ['law', 'politics']),
    (('ipo', 'listing'), ['markets', 'business']),
]


def _infer_topic_tags(text):
    """Coarse topic tags for calendar events with no source article."""
    t = (text or '').lower()
    for keys, tags in _UPCOMING_TAG_KEYWORDS:
        if any(k in t for k in keys):
            return tags[:3]
    return []


UPCOMING_EXTRACT_PROMPT = """Today's date: {today}.
From the numbered headlines below, extract EVERY concretely SCHEDULED FUTURE event whose date is stated or clearly implied IN the headline/bullet text, happening within the next 30 days. Examples: earnings dates, central-bank decisions, product launches, releases, votes, summits, court dates, sports fixtures.

{headlines}

Return ONLY JSON: {{"events":[{{"name":"short event name","datetime":"YYYY-MM-DDTHH:MM:SSZ","headline":<headline NUMBER>,"entity":"central entity","context":"one factual line drawn from the article"}}]}}
Use T00:00:00Z when only a date is known. NEVER guess a date not supported by the text. Skip vague timing ("soon","next year","Q3" with no year). An empty list is fine."""


def _populate_upcoming_events(supabase, api_key, calendar_rows, hl_by_num, headlines, now):
    """Refresh the upcoming_events pool: expire past, extract groundable future
    events from today's articles, merge with the calendar/launch supply, dedup
    by name+date, insert. Runs once/day (gated by the modules guard)."""
    horizon = now + timedelta(days=30)
    grace = (now - timedelta(days=1)).isoformat()
    try:
        supabase.table('upcoming_events').delete().lt('event_date', grace).execute()
    except Exception as e:
        print(f"   ⚠️ [upcoming_events] expire failed: {e}")

    events = []

    # (a) structured launch/calendar/model supply
    for r in calendar_rows:
        try:
            dt = datetime.fromisoformat(str(r['datetime']).replace('Z', '+00:00'))
        except (ValueError, KeyError):
            continue
        if not (now < dt < horizon):
            continue
        tags = r.get('topic_tags') or _infer_topic_tags(f"{r.get('name', '')} {r.get('context', '')}")
        events.append({'name': str(r['name'])[:120], 'event_date': dt.isoformat(),
                       'topic_tags': tags[:3],
                       'entity': (r.get('entity') or '')[:80] or None,
                       'context': (r.get('context') or '')[:200] or None,
                       'source_article_id': r.get('source_article_id'),
                       'confidence': 9})   # structured launch / grounded calendar

    # (b) groundable future events extracted from today's article text
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={api_key}")
    ex = {}
    try:
        resp = requests.post(url, json={
            "contents": [{"parts": [{"text": UPCOMING_EXTRACT_PROMPT.format(
                today=now.strftime('%Y-%m-%d'), headlines=headlines)}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096,
                                 "responseMimeType": "application/json"},
        }, timeout=90)
        resp.raise_for_status()
        text = resp.json()['candidates'][0]['content']['parts'][0]['text']
        ex = _extract_json_obj(text) or {}
    except Exception as e:
        print(f"   ⚠️ [upcoming_events] extraction failed: {e}")
    for e in (ex.get('events') or [])[:20]:
        if not (isinstance(e, dict) and e.get('name') and e.get('datetime')):
            continue
        try:
            dt = datetime.fromisoformat(str(e['datetime']).replace('Z', '+00:00'))
        except ValueError:
            continue
        if not (now < dt < horizon):
            continue
        hn = _num(e.get('headline'))
        src = hl_by_num.get(int(hn), {}) if hn is not None else {}
        tags = [str(t).strip().lower()[:24] for t in (src.get('tags') or [])[:3]]
        if not tags:
            tags = _infer_topic_tags(f"{e.get('name', '')} {e.get('context', '')}")
        events.append({'name': _strip_tags(str(e['name'])).strip()[:120],
                       'event_date': dt.isoformat(), 'topic_tags': tags[:3],
                       'entity': _strip_tags(str(e.get('entity', ''))).strip()[:80] or None,
                       'context': _strip_tags(str(e.get('context', ''))).strip()[:200] or None,
                       'source_article_id': src.get('id'),
                       'confidence': 7})   # grounded extraction from article text

    if not events:
        return
    seen = set()
    try:
        existing = supabase.table('upcoming_events').select('name, event_date') \
            .gte('event_date', grace).execute()
        for r in (existing.data or []):
            seen.add((str(r['name']).lower(), str(r['event_date'])[:10]))
    except Exception:
        pass
    inserted = 0
    for ev in events:
        key = (ev['name'].lower(), ev['event_date'][:10])
        if key in seen:
            continue
        seen.add(key)
        try:
            supabase.table('upcoming_events').insert(ev).execute()
            inserted += 1
        except Exception:
            pass   # unique-index dedup race — fine
    print(f"   ✅ [upcoming_events] {inserted} new events (pool refreshed)")


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

    # Numbered headlines w/ id + tags so notd/countdowns can cite a headline
    # number that maps back to a real source_article_id.
    hl_by_num = {}        # headline number -> {'id', 'tags', 'title'}
    try:
        arts = supabase.table('published_articles') \
            .select('id, title_news, summary_bullets_news, interest_tags') \
            .order('published_at', desc=True).limit(20).execute()
        lines = []
        for i, a in enumerate((arts.data or []), 1):
            hl_by_num[i] = {'id': a.get('id'),
                            'tags': a.get('interest_tags') or [],
                            'title': a.get('title_news')}
            bullet = ' '.join((a.get('summary_bullets_news') or [])[:1])[:150]
            lines.append(f"{i}. {a['title_news']}: {bullet}")
        headlines = '\n'.join(lines) or 'none available'
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

    # ── history POOL (full tagged set, exactly one major) ─────────────────
    hist = data.get('history')
    if isinstance(hist, list):
        pool = []
        for e in hist[:16]:
            # Accept BOTH the array form [year, text, [tags], major] and the
            # object form {year, text/event, topic_tags/tags, major} — the
            # model returns either depending on the day.
            if isinstance(e, dict):
                yr = _num(e.get('year'))
                text = _strip_tags(str(e.get('text') or e.get('event')
                                       or e.get('description') or '')).strip()[:180]
                raw_tags = e.get('topic_tags') or e.get('tags') or []
                major = bool(e.get('major'))
            elif isinstance(e, (list, tuple)) and len(e) >= 2:
                yr = _num(e[0])
                text = _strip_tags(str(e[1])).strip()[:180]
                raw_tags = e[2] if len(e) >= 3 and isinstance(e[2], list) else []
                major = bool(e[3]) if len(e) >= 4 else False
            else:
                continue
            if not yr or not text:
                continue
            tags = [str(t).strip().lower()[:24] for t in (raw_tags or [])[:3] if str(t).strip()]
            pool.append([int(yr), text, tags, major])
        if len(pool) >= 3:
            # Exactly one major: if none/many flagged, most-impactful (first) wins.
            if sum(1 for r in pool if r[3]) != 1:
                for r in pool:
                    r[3] = False
                pool[0][3] = True
            # Illustrate each event in the day's rotating art style.
            style = style_index = None
            gen_rows = []
            try:
                from history_image_gen import generate_history_images
                gen = generate_history_images(supabase, [[r[0], r[1]] for r in pool], api_key)
                gen_rows = gen.get('rows', [])
                style, style_index = gen.get('style'), gen.get('style_index')
            except Exception as _hist_err:
                print(f"   ⚠️ [history-img] illustration failed (text-only): {_hist_err}")
            rows = []
            for idx, r in enumerate(pool):
                url = gen_rows[idx][2] if idx < len(gen_rows) and len(gen_rows[idx]) > 2 else None
                rows.append([r[0], r[1], url, r[2], r[3]])
            payloads['history'] = {'rows': rows, 'style': style, 'style_index': style_index}

    # ── notd CANDIDATES (3-5 story-linked numbers, auto-scaled) ───────────
    notd = data.get('notd')
    notd_list = notd if isinstance(notd, list) else ([notd] if isinstance(notd, dict) else [])
    cand = []
    for c in notd_list[:5]:
        if not (isinstance(c, dict) and _num(c.get('value')) is not None and c.get('context')):
            continue
        v, p, u = _humanize_number(_num(c['value']), str(c.get('prefix', ''))[:3],
                                   str(c.get('unit', ''))[:8])
        hn = _num(c.get('headline'))
        src = hl_by_num.get(int(hn), {}) if hn is not None else {}
        tags = ([str(t).strip().lower()[:24] for t in c['topic_tags'][:3] if str(t).strip()]
                if isinstance(c.get('topic_tags'), list) else [])
        if not tags:
            tags = [str(t).strip().lower()[:24] for t in (src.get('tags') or [])[:3]]
        cand.append({'value': v, 'prefix': p, 'unit': u,
                     'context': _strip_tags(str(c['context'])).strip()[:160],
                     'source_article_id': src.get('id'),
                     'title': src.get('title'), 'topic_tags': tags})
    if cand:
        payloads['notd'] = {**cand[0], 'candidates': cand}   # hoist best for old clients

    # ── briefs POOL (10-15; feed rotates through unseen at serve time) ────
    briefs = data.get('briefs')
    if isinstance(briefs, list):
        rows = []
        for b in briefs[:15]:
            if isinstance(b, dict) and b.get('tag') and b.get('text'):
                rows.append({'tag': _strip_tags(str(b['tag'])).strip().upper()[:6],
                             'text': _sanitize_marked_text(str(b['text']))[:130]})
        if len(rows) >= 3:
            payloads['briefs'] = {'rows': rows}

    # ── countdowns: model rows + structured launch/calendar supply ────────
    cds = data.get('countdowns')
    model_rows = []
    if isinstance(cds, list):
        for c in cds[:4]:
            if not (isinstance(c, dict) and c.get('name') and c.get('datetime')):
                continue
            try:
                dt = datetime.fromisoformat(str(c['datetime']).replace('Z', '+00:00'))
            except ValueError:
                continue
            if dt <= now:
                continue
            hn = _num(c.get('headline'))
            src = hl_by_num.get(int(hn), {}) if hn is not None else {}
            tags = ([str(t).strip().lower()[:24] for t in c['topic_tags'][:3] if str(t).strip()]
                    if isinstance(c.get('topic_tags'), list) else [])
            if not tags:
                tags = [str(t).strip().lower()[:24] for t in (src.get('tags') or [])[:3]]
            model_rows.append({'name': _strip_tags(str(c['name'])).strip()[:60],
                               'datetime': dt.isoformat(),
                               'context': _strip_tags(str(c.get('context', ''))).strip()[:140],
                               'source_article_id': src.get('id'), 'topic_tags': tags})
    merged = {}
    for r in _fetch_launch_countdowns() + _fetch_grounded_calendar(api_key) + model_rows:
        key = r['name'].lower()[:20]
        if key not in merged:
            merged[key] = r
    all_upcoming = sorted(merged.values(), key=lambda r: r['datetime'])
    if 'countdowns' in needed:
        # feed_modules global fallback (old contract: {rows:[{name,datetime,context}]}).
        payloads['countdowns'] = {'rows': [
            {'name': r['name'], 'datetime': r['datetime'], 'context': r.get('context', '')}
            for r in all_upcoming[:6]]}

    # ── upcoming_events POOL (personalized countdowns, Task 2) ────────────
    try:
        _populate_upcoming_events(supabase, api_key, all_upcoming, hl_by_num, headlines, now)
    except Exception as e:
        print(f"   ⚠️ [upcoming_events] populate failed: {e}")

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

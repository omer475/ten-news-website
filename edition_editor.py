"""
edition_editor.py — the daily Edition editor-in-chief (§12 + §13).

Replaces the old per-article scoring/writing/display. ONE shared edition per day,
exactly 15 items, NOT personalized. Reads TODAY's clusters (the existing pgvector
clustering output — KEPT, not rebuilt), runs an LLM editor over them to select +
write the 15 items in the today+ voice (only from each cluster's source facts),
and assembles the recurring modules. Output is the locked §13 JSON.

Pipeline position:
    ingest + cluster (kept)  ->  THIS (select+write+modules)  ->  illustrations
    (edition_illustrations.py)  ->  upsert editions row (edition_job.py)

LLM: Gemini 2.5 Pro via the REST generateContent endpoint (same auth pattern as
step1_gemini_news_scoring_filtering.py — no new dependency, no Anthropic key).

Hard rules enforced deterministically AFTER the LLM (never trust the model alone):
  - exactly 15 items
  - illustrations ONLY on non-serious items (never war/death/arrests/tragedy)
  - never >3 must-know in a row; edition ENDS on a light positive (fun) item
  - card sub-objects (stat/chart/quote) must match the item's type or it downgrades
  - sources are reconstructed from the DB by cluster id (never trust model URLs)
  - NO quiz
"""

import os
import re
import json
import time
import hashlib
import requests
from datetime import datetime, timezone

# Editor model. Default gemini-2.5-flash (strong enough for the selection+write,
# and on the same access tier as the flash-lite the rest of the pipeline already
# uses in prod). Set EDITION_EDITOR_MODEL=gemini-2.5-pro if the GCP project has
# Pro access — Pro is preferable for the editorial reasoning when available.
EDITOR_MODEL = os.getenv('EDITION_EDITOR_MODEL', 'gemini-2.5-flash')

# ----------------------------------------------------------------------------
# 1. Candidate clusters
# ----------------------------------------------------------------------------

# Words that mark a cluster as SERIOUS — these can never be illustrated or made
# "fun", and are forced to plain text cards. Matched case-insensitively on the
# headline/title + kicker.
SERIOUS_HINTS = (
    'war', 'killed', 'kill', 'dead', 'death', 'died', 'dies', 'fatal', 'massacre',
    'genocide', 'attack', 'airstrike', 'air strike', 'strike', 'shelling', 'bombing',
    'bomb', 'shooting', 'gunman', 'stabbing', 'hostage', 'kidnap', 'terror',
    'arrest', 'arrested', 'charged', 'indicted', 'convicted', 'manslaughter',
    'murder', 'assault', 'rape', 'abuse', 'crash', 'plane crash', 'earthquake',
    'quake', 'flood', 'wildfire', 'famine', 'outbreak', 'casualt', 'wounded',
    'injured', 'evacuat', 'disaster', 'collapse', 'invasion', 'troops', 'militant',
)


def _excerpt(text, limit):
    if not text:
        return ''
    t = re.sub(r'\s+', ' ', str(text)).strip()
    return t[:limit]


def fetch_candidate_clusters(supabase, *, lookback_hours=40, min_sources=3,
                             max_clusters=55, sources_per_cluster=4, body_chars=700):
    """Return a list of candidate cluster dicts for the editor.

    Each = {cluster_id, title, category, coverage_count, sources:[{title, outlet,
    url, published_at, body}]}. Ordered by coverage (source_count) desc — the
    editor re-ranks by importance, but a sane candidate pool keeps tokens bounded.
    """
    cutoff = datetime.now(timezone.utc).timestamp() - lookback_hours * 3600
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()

    cl = (supabase.table('clusters')
          .select('id, main_title, event_name, source_count, last_updated_at')
          .gte('last_updated_at', cutoff_iso)
          .gte('source_count', min_sources)
          .order('source_count', desc=True)
          .limit(max_clusters)
          .execute())
    clusters = cl.data or []
    if not clusters:
        return []

    ids = [c['id'] for c in clusters]
    # One bulk fetch of source articles for all candidate clusters.
    sa = (supabase.table('source_articles')
          .select('cluster_id, title, source_name, url, published_at, content, description, category, score')
          .in_('cluster_id', ids)
          .order('score', desc=True)
          .execute())

    by_cluster = {}
    cat_votes = {}
    for a in (sa.data or []):
        cid = a['cluster_id']
        bucket = by_cluster.setdefault(cid, [])
        if len(bucket) < sources_per_cluster:
            bucket.append({
                'title': a.get('title') or '',
                'outlet': a.get('source_name') or '',
                'url': a.get('url') or '',
                'published_at': a.get('published_at') or '',
                'body': _excerpt(a.get('content') or a.get('description'), body_chars),
            })
        if a.get('category'):
            cat_votes.setdefault(cid, {})
            cat_votes[cid][a['category']] = cat_votes[cid].get(a['category'], 0) + 1

    out = []
    for c in clusters:
        cid = c['id']
        srcs = by_cluster.get(cid, [])
        if not srcs:
            continue
        cats = cat_votes.get(cid, {})
        category = max(cats, key=cats.get) if cats else 'General'
        out.append({
            'cluster_id': cid,
            'title': c.get('main_title') or c.get('event_name') or srcs[0]['title'],
            'category': category,
            'coverage_count': c.get('source_count') or len(srcs),
            'sources': srcs,
        })
    return out


# ----------------------------------------------------------------------------
# 2. The editor prompt (§12, adapted to the LOCKED decisions)
# ----------------------------------------------------------------------------

EDITOR_SYSTEM_PROMPT = """\
You are the editor-in-chief of "today+", a finite daily news app. Build ONE shared
daily edition of EXACTLY 15 items from the clustered source articles provided, and
write each one in the today+ voice. You are an EDITOR/WRITER, never a reporter: you
select, dedup, rank, and REWRITE from the source articles you are given. You must
NEVER invent facts, numbers, names, or context, and never use outside knowledge for
the news items. If the sources do not support a claim, leave it out.

INPUT: a list of story CLUSTERS. Each cluster = one real-world event with its
source articles (title, outlet, url, published_at, body) and coverage_count (how
many outlets covered it). The sources may be in several languages — WRITE EVERYTHING
IN ENGLISH. Different clusters may describe the SAME event in different languages or
angles; treat those as one story (dedup) and never select the same event twice.

SELECT 15 items, split into two buckets:
- ~8 MUST-KNOW (bucket "must"): the genuinely important news (world, the country,
  money, policy, major events). Rank by importance — coverage_count is a strong
  proxy — plus recency. No more than 3 items from any single category.
- ~7 GOOD-TO-KNOW / FUN (bucket "fun"): surprising/"TIL" findings, science, sport,
  culture, a quirky human story. At least one must be uplifting/positive.

ORDER them in a deliberate heavy->light RHYTHM:
- Lead with the single biggest must-know.
- NEVER place more than 3 must-know items in a row without a fun item between them.
- END on a light, POSITIVE fun story — the smile to close on.
- "Fun" is a CATEGORY, never a tone applied to a serious story. A war/death/arrest/
  tragedy story is NEVER made fun and is ALWAYS a plain text card.
- Vary card types so no two of the same kind sit adjacent.

For EACH selected item, assign ONE card "type":
- "illustration": conceptual/abstract or hero stories (NON-SERIOUS only)
- "stat": when ONE number is the story
- "chart": when a trend over time is the story (you must have the real series in
  the sources; otherwise do not use chart)
- "quote": when a single quote is the story (the quote must appear in the sources)
- "text": standard story; ALWAYS use text for war/death/arrests/tragedy

WRITE each item using ONLY facts found in that cluster's source articles. Preserve
attribution for contested claims ("Ankara said...", "according to Reuters...").
Serious stories stay SOBER — plain factual bullets, zero wit, zero jokes. The wit
lives only in word choice on light stories.

Produce, for each item, an object with these fields:
- "cluster_ids": array of the input cluster_id(s) this item was written from (REQUIRED)
- "bucket": "must" | "fun"
- "serious": true if this is war/death/arrests/tragedy/disaster, else false
- "type": one of the five above
- "kicker": 1-2 word category label
- "headline": <= 10 words, punchy, substance first, sentence case
- "accent_entity": ONE short phrase from the headline to highlight in gold, or null
- "dek": one clear sentence (recommended for stat/quote/illustration), or null
- "bullets": array of 1-3 short factual sentences (all will be shown)
- "stat": for type "stat" only -> {"value": number, "prefix": "", "suffix": "",
  "decimals": integer, "label": "short label"}; otherwise null
- "chart": for type "chart" only -> {"series": [numbers], "now_label": "string",
  "source": "string", "highlight_index": integer}; otherwise null
- "quote": for type "quote" only -> {"text": "the quote", "highlight": "phrase
  inside text", "by": "speaker"}; otherwise null
- "illustration_scene": for NON-SERIOUS items you want illustrated, a one-line
  visual SCENE for a pen-and-ink editorial caricature; otherwise null. NEVER
  provide a scene for war/death/arrests/tragedy. Aim for 5-6 scenes across the 15.

ALSO generate (general-knowledge allowed for these two ONLY, not the news items):
- "number_of_day": {"value": number, "unit": "string", "comparison": "a vivid
  real-world comparison"} — ideally tied to one of today's stories.
- "today_in_history": {"rows": [[year, "one-sentence event"], [year, "..."],
  [year, "..."]]} — exactly 3 well-known events that happened on today's month/day.

Do NOT generate a quiz. There is NO separate editorial "take" field.

OUTPUT valid JSON ONLY, no prose outside it:
{"items": [ ...15 item objects in final paced order... ],
 "number_of_day": {...}, "today_in_history": {"rows": [...]}}
"""


def build_user_prompt(clusters, date_str):
    payload = {
        'today': date_str,
        'clusters': [
            {
                'cluster_id': c['cluster_id'],
                'category': c['category'],
                'coverage_count': c['coverage_count'],
                'title': c['title'],
                'sources': c['sources'],
            }
            for c in clusters
        ],
    }
    return (
        f"Today's date is {date_str}. Here are {len(clusters)} candidate clusters as "
        f"JSON. Build the 15-item edition per your instructions, writing only from "
        f"these sources.\n\n{json.dumps(payload, ensure_ascii=False)}"
    )


# ----------------------------------------------------------------------------
# 3. LLM call
# ----------------------------------------------------------------------------

def call_gemini_editor(api_key, system_prompt, user_prompt, *, model=None,
                       max_retries=4, timeout=240):
    """Call Gemini generateContent and return the parsed JSON dict (or raise)."""
    model = model or EDITOR_MODEL
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={api_key}")
    request_data = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "temperature": 0.65,
            "topP": 0.95,
            "maxOutputTokens": 32768,
            "responseMimeType": "application/json",
        },
    }

    last_err = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=request_data, timeout=timeout)
            if resp.status_code == 429:
                wait = (2 ** attempt) * 30
                print(f"  ⚠️ editor rate-limited (429), waiting {wait}s "
                      f"({attempt + 1}/{max_retries})")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            result = resp.json()
            cands = result.get('candidates') or []
            if not cands:
                raise ValueError(f"no candidates: {json.dumps(result)[:300]}")
            cand = cands[0]
            finish = cand.get('finishReason')
            if finish and finish not in ('STOP', 'MAX_TOKENS'):
                raise ValueError(f"editor finishReason={finish}")
            parts = (cand.get('content') or {}).get('parts') or []
            text = ''.join(p.get('text', '') for p in parts)
            if not text.strip():
                raise ValueError("empty editor response text")
            return json.loads(text)
        except (requests.RequestException, ValueError, json.JSONDecodeError) as e:
            last_err = e
            print(f"  ⚠️ editor attempt {attempt + 1}/{max_retries} failed: {e}")
            time.sleep((2 ** attempt) * 5)
    raise RuntimeError(f"editor failed after {max_retries} attempts: {last_err}")


# ----------------------------------------------------------------------------
# 4. Validation + deterministic repair  ->  §13 items
# ----------------------------------------------------------------------------

def _is_serious(item):
    if item.get('serious') is True:
        return True
    blob = f"{item.get('headline', '')} {item.get('kicker', '')}".lower()
    return any(h in blob for h in SERIOUS_HINTS)


def _seed(date_str, idx):
    h = hashlib.sha1(f"{date_str}:{idx}".encode()).hexdigest()
    return int(h[:8], 16) % 1_000_000


def _clean_headline(h):
    words = str(h or '').strip().split()
    return ' '.join(words[:10])  # hard cap 10 words


def _sources_from_clusters(cluster_index, cluster_ids):
    """Reconstruct real {outlet,url} sources from the DB candidate clusters."""
    seen, out = set(), []
    for cid in (cluster_ids or []):
        for s in (cluster_index.get(cid, {}).get('sources') or []):
            key = s.get('url')
            if key and key not in seen:
                seen.add(key)
                out.append({'outlet': s.get('outlet') or '', 'url': key})
    return out[:4]


def normalize_item(raw, idx, date_str, cluster_index):
    bucket = 'fun' if raw.get('bucket') == 'fun' else 'must'
    serious = _is_serious(raw)
    if serious:
        bucket = 'must'  # serious is never fun

    itype = raw.get('type') if raw.get('type') in (
        'illustration', 'stat', 'chart', 'quote', 'text') else 'text'

    stat = raw.get('stat') if isinstance(raw.get('stat'), dict) else None
    chart = raw.get('chart') if isinstance(raw.get('chart'), dict) else None
    quote = raw.get('quote') if isinstance(raw.get('quote'), dict) else None
    scene = raw.get('illustration_scene')
    scene = scene if isinstance(scene, str) and scene.strip() else None

    # Serious items: force text, strip any illustration/jokey media.
    if serious:
        itype, scene = 'text', None

    # Downgrade a type whose required sub-object is missing/invalid.
    if itype == 'stat' and not (stat and 'value' in stat):
        itype = 'text'
    if itype == 'chart' and not (chart and isinstance(chart.get('series'), list) and chart['series']):
        itype = 'text'
    if itype == 'quote' and not (quote and quote.get('text')):
        itype = 'text'
    if itype == 'illustration' and not scene:
        itype = 'text'
    # illustration is non-serious-only and requires a scene
    if itype == 'illustration' and serious:
        itype = 'text'

    item = {
        'bucket': bucket,
        'type': itype,
        'kicker': str(raw.get('kicker') or '').strip()[:24] or 'News',
        'headline': _clean_headline(raw.get('headline')),
        'accent_entity': (raw.get('accent_entity') or None),
        'dek': (raw.get('dek') or None),
        'bullets': [str(b).strip() for b in (raw.get('bullets') or []) if str(b).strip()][:3],
        'lighter': bucket == 'fun',
        'sources': _sources_from_clusters(cluster_index, raw.get('cluster_ids')),
    }
    if itype == 'stat':
        item['stat'] = {
            'value': stat.get('value'),
            'prefix': str(stat.get('prefix', '') or ''),
            'suffix': str(stat.get('suffix', '') or ''),
            'decimals': int(stat.get('decimals', 0) or 0),
            'label': str(stat.get('label', '') or ''),
        }
    if itype == 'chart':
        series = [x for x in chart['series'] if isinstance(x, (int, float))]
        hi = chart.get('highlight_index')
        item['chart'] = {
            'series': series,
            'now_label': str(chart.get('now_label', '') or ''),
            'source': str(chart.get('source', '') or ''),
            'highlight_index': hi if isinstance(hi, int) and 0 <= hi < len(series) else max(0, len(series) - 1),
        }
    if itype == 'quote':
        item['quote'] = {
            'text': str(quote.get('text', '') or ''),
            'highlight': str(quote.get('highlight', '') or ''),
            'by': str(quote.get('by', '') or ''),
        }
    # Illustration object: scene + seed now; asset_url filled by the illustration step.
    if scene and not serious:
        item['illustration'] = {'scene': scene, 'asset_url': None, 'seed': _seed(date_str, idx)}
        if itype == 'text':
            # A non-serious text story can still carry an illustration; render by presence.
            item['type'] = 'illustration'
    return item


def repair_pacing(items):
    """Minimal, order-preserving fixups for the two HARD pacing rules:
    (1) edition ends on a fun item; (2) never >3 must-know in a row.
    The LLM is asked to order correctly; this only fixes violations."""
    items = list(items)

    # (1) End on a fun item: move the last fun item to the end if needed.
    if items and items[-1]['bucket'] != 'fun':
        for i in range(len(items) - 2, -1, -1):
            if items[i]['bucket'] == 'fun':
                items.append(items.pop(i))
                break

    # (2) Break any run of >3 must by pulling the next fun item into the gap.
    i, run = 0, 0
    while i < len(items):
        if items[i]['bucket'] == 'must':
            run += 1
            if run > 3:
                j = next((k for k in range(i + 1, len(items)) if items[k]['bucket'] == 'fun'), None)
                if j is not None:
                    items.insert(i, items.pop(j))
                    run = 0
                    i += 1
                    continue
        else:
            run = 0
        i += 1
    return items


def build_edition_payload(raw, date_str, clusters, countdown):
    """Turn the raw LLM output + DB modules into the final §13 payload dict."""
    cluster_index = {c['cluster_id']: c for c in clusters}
    raw_items = raw.get('items') or []

    items = [normalize_item(r, i, date_str, cluster_index) for i, r in enumerate(raw_items)]
    # Drop items with no headline or no bullets (unusable), then cap at 15.
    items = [it for it in items if it['headline'] and it['bullets']]
    items = items[:15]
    items = repair_pacing(items)
    # Re-stamp lighter after any reordering (cheap, keeps invariant honest).
    for it in items:
        it['lighter'] = it['bucket'] == 'fun'

    nod = raw.get('number_of_day') if isinstance(raw.get('number_of_day'), dict) else None
    hist = raw.get('today_in_history') if isinstance(raw.get('today_in_history'), dict) else None
    hist_rows = (hist or {}).get('rows') if isinstance((hist or {}).get('rows'), list) else None

    payload = {
        'edition_date': date_str,
        'items': items,
        'number_of_day': nod or {'value': None, 'unit': '', 'comparison': ''},
        'today_in_history': {'rows': (hist_rows or [])[:3]},
        'countdown': countdown,
    }
    return payload


# ----------------------------------------------------------------------------
# 5. Modules from the DB
# ----------------------------------------------------------------------------

def fetch_countdown(supabase):
    """The next real upcoming event -> §13 countdown. None-safe."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        r = (supabase.table('upcoming_events')
             .select('name, event_date, context, confidence')
             .gte('event_date', now_iso)
             .order('event_date', desc=False)
             .limit(1)
             .execute())
        row = (r.data or [None])[0]
        if not row:
            return None
        return {
            'name': row.get('name') or '',
            'datetime': row.get('event_date'),
            'context': row.get('context') or '',
        }
    except Exception as e:
        print(f"  ⚠️ countdown fetch failed: {e}")
        return None


# ----------------------------------------------------------------------------
# 6. Orchestration (writing only; illustrations are a separate step)
# ----------------------------------------------------------------------------

def build_edition(supabase, api_key, date_str=None, **fetch_kwargs):
    """Build the §13 edition payload for date_str (default: today UK)."""
    if date_str is None:
        date_str = uk_today()
    print(f"📰 Building edition for {date_str} (model={EDITOR_MODEL})")

    clusters = fetch_candidate_clusters(supabase, **fetch_kwargs)
    print(f"  • {len(clusters)} candidate clusters")
    if len(clusters) < 15:
        print(f"  ⚠️ only {len(clusters)} clusters — edition may be short")
    if not clusters:
        raise RuntimeError("no candidate clusters; cannot build edition")

    raw = call_gemini_editor(api_key, EDITOR_SYSTEM_PROMPT,
                             build_user_prompt(clusters, date_str))
    countdown = fetch_countdown(supabase)
    payload = build_edition_payload(raw, date_str, clusters, countdown)
    print(f"  ✅ {len(payload['items'])} items "
          f"(must={sum(1 for i in payload['items'] if i['bucket'] == 'must')}, "
          f"fun={sum(1 for i in payload['items'] if i['bucket'] == 'fun')}, "
          f"illustrations={sum(1 for i in payload['items'] if 'illustration' in i)})")
    return payload


def uk_today():
    """Current calendar date in Europe/London as YYYY-MM-DD (BST/GMT safe)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo('Europe/London')).strftime('%Y-%m-%d')
    except Exception:
        import pytz
        return datetime.now(pytz.timezone('Europe/London')).strftime('%Y-%m-%d')


def get_supabase():
    from supabase import create_client
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE url/key env not set")
    return create_client(url, key)


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description="Build (and print) today's edition payload")
    ap.add_argument('--date', default=None, help='YYYY-MM-DD (default: today UK)')
    ap.add_argument('--out', default=None, help='write payload JSON to this path')
    args = ap.parse_args()

    sb = get_supabase()
    gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not gemini_key:
        raise SystemExit("GEMINI_API_KEY not set")
    payload = build_edition(sb, gemini_key, args.date)
    txt = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, 'w') as f:
            f.write(txt)
        print(f"wrote {args.out}")
    else:
        print(txt)

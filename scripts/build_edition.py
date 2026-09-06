#!/usr/bin/env python3
"""
TODAY — daily edition builder.

Reads every RSS source in rss_sources.py, keeps only what was published in the
last 24 hours, clusters the duplicates, ranks what is most *instant* (breaking
now x matters), picks ten, writes each one as a poster, and emits a single JSON
edition consumed by the website.

Run once a day:  python scripts/build_edition.py

Env:
  OPENAI_API_KEY                    required — scoring, writing, illustrations
  SUPABASE_URL, SUPABASE_SERVICE_KEY   optional — upsert into daily_editions
  EDITION_DRY_RUN=1                 skip all AI calls (structure smoke test)
"""

import os
import re
import sys
import json
import math
import time
import html
import base64
import hashlib
import argparse
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import feedparser
from dateutil import parser as dateparser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from rss_sources import RSS_FEEDS
from art_direction import (TRADITIONS, ORDER as TRADITION_ORDER, LOUD, FAMILY,
                           DENSITY, brief_for, tradition_menu, device_menu)

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

WINDOW_HOURS = 24            # only news published in this window is eligible
ENTRIES_PER_FEED = 20        # RSS entries read per source
FETCH_TIMEOUT = 8            # seconds per feed
FETCH_WORKERS = 60
SHORTLIST = 220              # clusters sent to the importance model
EDITION_SIZE = 10
MIN_PUBLISHABLE = 6          # below this, yesterday's edition is better than this one
MAX_PER_CATEGORY = 2         # diversity guard on the final ten
MAX_PER_SOURCE = 2

RECENCY_HALFLIFE_H = 6.0     # how fast "instant" decays
MIN_IMPORTANCE = 68          # below this a story is filler, however fresh
LONE_SOURCE_FLOOR = 86       # one outlet alone has to clear a higher bar
UNDATED_ASSUMED_AGE_H = 10.0 # penalty for feeds that publish no date

SCORING_MODEL = "gpt-5.4-mini"      # ranks 220 stories, cheap and fast
WRITING_MODEL = "gpt-5.4"           # writes the ten, quality is the product
IMAGE_MODEL = "gpt-image-2"

CHAT_URL = "https://api.openai.com/v1/chat/completions"
IMAGE_URL = "https://api.openai.com/v1/images/generations"

# Medium matches high on concept and composition for a quarter of the cost;
# low loses the tonal structure that makes these read as real illustration.
# The artwork is shown as a rounded card of roughly 4:5, so a 2:3 image would
# lose a quarter of its height to the crop. Square loses ~6% a side instead.
IMAGE_SIZE = "1024x1024"
IMAGE_QUALITY = "medium"
IMAGE_WEBP_QUALITY = 82      # re-encoded before upload; the API returns ~2.5MB
IMAGE_BUCKET = "images"      # existing public Supabase Storage bucket
IMAGE_PREFIX = "today"
IMAGE_RETRIES = 4

VIDEO_MODEL = "sora-2"
VIDEO_URL = "https://api.openai.com/v1/videos"
VIDEO_BUCKET = "today-video"
VIDEO_COUNT = 3              # the day's top stories move; the rest hold still
VIDEO_SECONDS = "4"
VIDEO_SIZE = "720x1280"
VIDEO_POLL_S = 12
VIDEO_TIMEOUT_S = 600

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "editions")

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"}

STOPWORDS = set("""a an the of in on at to for from with by and or as is are was were be been being
this that these those it its his her their our your my has have had will would can could should
after before over under new says say said report reports amid into out up down about""".split())


def log(msg):
    print(msg, flush=True)


# ----------------------------------------------------------------------------
# 1 · Read every feed, last 24h only
# ----------------------------------------------------------------------------

def clean_text(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime(*st[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    for key in ("published", "updated", "pubDate", "dc:date"):
        raw = entry.get(key)
        if raw:
            try:
                dt = dateparser.parse(raw)
                if dt:
                    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def entry_image(entry):
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key)
        if isinstance(media, list) and media:
            url = media[0].get("url")
            if url:
                return url
    for link in entry.get("links", []) or []:
        if str(link.get("type", "")).startswith("image") and link.get("href"):
            return link["href"]
    for enc in entry.get("enclosures", []) or []:
        if str(enc.get("type", "")).startswith("image") and enc.get("href"):
            return enc["href"]
    body = entry.get("summary", "") or entry.get("description", "")
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', body or "")
    return m.group(1) if m else None


def fetch_all_feeds(now):
    cutoff = now - timedelta(hours=WINDOW_HOURS)
    log(f"Reading {len(RSS_FEEDS)} feeds for everything published since "
        f"{cutoff:%Y-%m-%d %H:%M} UTC ...")

    def one(feed):
        out = []
        try:
            r = requests.get(feed["url"], timeout=FETCH_TIMEOUT, headers=UA, verify=False)
            parsed = feedparser.parse(r.content)
        except Exception:
            return out
        for entry in parsed.entries[:ENTRIES_PER_FEED]:
            url = entry.get("link") or ""
            title = clean_text(entry.get("title"))
            if not url or len(title) < 12:
                continue
            published = parse_date(entry)
            if published is None:
                age = UNDATED_ASSUMED_AGE_H
                dated = False
            else:
                if published > now + timedelta(hours=2):
                    published = now                      # future-dated feeds
                if published < cutoff:
                    continue                             # older than the window
                age = max(0.0, (now - published).total_seconds() / 3600.0)
                dated = True
            out.append({
                "url": url,
                "title": title,
                "description": clean_text(entry.get("summary") or entry.get("description"))[:900],
                "source": feed["name"],
                "category": feed.get("category", "news"),
                "tier": feed.get("tier", "standard"),
                "country": feed.get("country", ""),
                "published": published.isoformat() if published else None,
                "age_hours": age,
                "dated": dated,
                "image_url": entry_image(entry),
            })
        return out

    articles, ok = [], 0
    with ThreadPoolExecutor(max_workers=FETCH_WORKERS) as pool:
        futures = [pool.submit(one, f) for f in RSS_FEEDS]
        for fut in as_completed(futures):
            got = fut.result()
            if got:
                ok += 1
                articles.extend(got)
    log(f"  {len(articles)} articles from {ok}/{len(RSS_FEEDS)} live feeds")
    return articles


# ----------------------------------------------------------------------------
# 2 · Cluster duplicates — the same story told by many outlets
# ----------------------------------------------------------------------------

def norm_url(url):
    u = re.sub(r"[?#].*$", "", url.lower())
    return re.sub(r"^https?://(www\.)?", "", u).rstrip("/")


def keywords(title):
    words = re.findall(r"[a-z0-9']+", title.lower())
    return {w for w in words if len(w) > 2 and w not in STOPWORDS}


def cluster(articles):
    by_url, deduped = set(), []
    for a in articles:
        key = norm_url(a["url"])
        if key in by_url:
            continue
        by_url.add(key)
        a["_kw"] = keywords(a["title"])
        deduped.append(a)

    deduped.sort(key=lambda a: (a["tier"] != "premium", a["age_hours"]))

    clusters = []
    index = {}                      # keyword -> cluster ids that contain it
    for a in deduped:
        if len(a["_kw"]) < 3:
            continue
        candidates = set()
        for w in a["_kw"]:
            candidates.update(index.get(w, ()))
        best, best_sim = None, 0.0
        for cid in candidates:
            c = clusters[cid]
            # Compare against the cluster's first article, not the union of all
            # of them — a union grows with every member and starts swallowing
            # loosely related stories.
            inter = len(a["_kw"] & c["lead_kw"])
            if inter < 3:
                continue
            sim = inter / max(4, min(len(a["_kw"]), len(c["lead_kw"])))
            if sim > best_sim:
                best, best_sim = c, sim
        if best is not None and best_sim >= 0.6:
            best["members"].append(a)
            best["kw"] |= a["_kw"]
            for w in a["_kw"]:
                index.setdefault(w, set()).add(best["id"])
        else:
            c = {"id": len(clusters), "lead": a, "members": [a],
                 "kw": set(a["_kw"]), "lead_kw": set(a["_kw"])}
            clusters.append(c)
            for w in a["_kw"]:
                index.setdefault(w, set()).add(c["id"])

    for c in clusters:
        c["sources"] = sorted({m["source"] for m in c["members"]})
        c["source_count"] = len(c["sources"])
        c["age_hours"] = min(m["age_hours"] for m in c["members"])
        c["lead"] = min(c["members"], key=lambda m: (m["tier"] != "premium", m["age_hours"]))
        c["image_url"] = next((m["image_url"] for m in c["members"] if m.get("image_url")), None)
    log(f"  {len(clusters)} distinct stories after clustering")
    return clusters


# ----------------------------------------------------------------------------
# 3 · Importance from Gemini, then the instant ranking
# ----------------------------------------------------------------------------

def retry_after(response, attempt, cap=75):
    """Seconds to wait after a 429. Use the server's own number when it gives one."""
    header = response.headers.get("retry-after")
    if header:
        try:
            return min(cap, float(header) + 1)
        except ValueError:
            pass
    return min(cap, 5 * (2 ** attempt))


def ask_json(prompt, model, temperature=0.3, max_tokens=4096, retries=5):
    """One JSON answer from an OpenAI chat model."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    last = None
    for attempt in range(retries):
        try:
            r = requests.post(
                CHAT_URL, json=payload, timeout=180,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            if r.status_code == 200:
                text = r.json()["choices"][0]["message"]["content"]
                return json.loads(re.sub(r"^```(?:json)?|```$", "", (text or "").strip(), flags=re.M))
            last = f"HTTP {r.status_code}: {r.text[:200]}"
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(retry_after(r, attempt))
                continue
        except Exception as exc:
            last = str(exc)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{model} call failed after {retries} tries — {last}")


SCORE_PROMPT = """You are the front-page editor of a daily world news brief.

Score each story below 0-100 for how much it matters to a globally curious reader today.

100  a war starts, a government falls, a market crashes, a discovery changes medicine
 80  a major national decision, a large disaster, a landmark scientific result
 60  a significant business, policy, science or culture development
 40  routine coverage, incremental updates, a mid-size company story
 20  celebrity noise, listicles, opinion, sport results with no wider stake
  0  press releases, promotions, horoscopes, live blogs with no news in the title

A LOCAL ACCIDENT, CRIME OR SINGLE-FAMILY TRAGEDY SCORES 20-30, however
distressing it reads. One death, one arrest, one collapsed roof, one village's
bad road — these matter enormously to the people involved and are not national
or world news. Score them up only if they are already driving a change in law,
a resignation, or nationwide protest. Ask yourself: would a reader on another
continent be worse informed for not knowing this? If not, it is under 40.

Also return `category`, one of:
world, politics, business, technology, science, health, climate, culture, sport, security

Return JSON only: {"scores":[{"i":<index>,"score":<0-100>,"category":"<category>"}]}

STORIES:
%s"""


def score_importance(clusters):
    if os.environ.get("EDITION_DRY_RUN"):
        for c in clusters:
            c["importance"] = min(95.0, 40.0 + c["source_count"] * 4.0)
            c["category"] = c["lead"]["category"]
        return

    batches = [clusters[i:i + 40] for i in range(0, len(clusters), 40)]

    def run(batch_index, batch):
        lines = []
        for i, c in enumerate(batch):
            lines.append(f'{i}. [{c["source_count"]} outlets, {c["age_hours"]:.0f}h ago] '
                         f'{c["lead"]["title"]} — {c["lead"]["description"][:180]}')
        try:
            data = ask_json(SCORE_PROMPT % "\n".join(lines), SCORING_MODEL, temperature=0.1)
            return batch_index, data.get("scores", [])
        except Exception as exc:
            log(f"  ! scoring batch {batch_index} failed: {exc}")
            return batch_index, []

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(run, i, b) for i, b in enumerate(batches)]
        for fut in as_completed(futures):
            bi, scores = fut.result()
            batch = batches[bi]
            for s in scores:
                idx = s.get("i")
                if isinstance(idx, int) and 0 <= idx < len(batch):
                    batch[idx]["importance"] = max(0, min(100, float(s.get("score", 0))))
                    batch[idx]["category"] = s.get("category", batch[idx]["lead"]["category"])

    for c in clusters:
        c.setdefault("importance", 0.0)
        c.setdefault("category", c["lead"]["category"])


def instant_score(c):
    """Breaking-first: importance, weighted hard toward the freshest hours."""
    recency = math.exp(-c["age_hours"] / RECENCY_HALFLIFE_H)
    breadth = min(c["source_count"], 8) / 8.0
    if not c["lead"]["dated"]:
        recency *= 0.6
    return c["importance"] * (0.30 + 0.42 * recency + 0.28 * breadth)


def eligible(clusters):
    """
    The pool an edition may draw from — used for the first pick AND for the
    bench that backfills it. Filtering only the first pick let the duplicate
    merge pull replacements straight past the floor.
    """
    strong = [c for c in clusters
              if c["importance"] >= MIN_IMPORTANCE
              and (c["source_count"] > 1 or c["importance"] >= LONE_SOURCE_FLOOR)]
    return strong if len(strong) >= EDITION_SIZE else clusters


def pick_ten(clusters):
    """Top ten by instant score, keeping one edition from being all one thing.

    Caps are relaxed in passes rather than abandoned, so a thin news day still
    yields ten stories and a normal one stays varied.
    """
    ranked = sorted(clusters, key=instant_score, reverse=True)
    picked, chosen = [], set()

    for cat_cap, src_cap in ((MAX_PER_CATEGORY, MAX_PER_SOURCE),
                             (MAX_PER_CATEGORY + 1, MAX_PER_SOURCE + 1),
                             (EDITION_SIZE, EDITION_SIZE)):
        per_cat, per_src = {}, {}
        for c in picked:
            per_cat[c["category"]] = per_cat.get(c["category"], 0) + 1
            per_src[c["lead"]["source"]] = per_src.get(c["lead"]["source"], 0) + 1
        for c in ranked:
            if len(picked) == EDITION_SIZE:
                break
            if c["id"] in chosen:
                continue
            cat, src = c["category"], c["lead"]["source"]
            if per_cat.get(cat, 0) >= cat_cap or per_src.get(src, 0) >= src_cap:
                continue
            picked.append(c)
            chosen.add(c["id"])
            per_cat[cat] = per_cat.get(cat, 0) + 1
            per_src[src] = per_src.get(src, 0) + 1
        if len(picked) == EDITION_SIZE:
            break

    return sorted(picked, key=instant_score, reverse=True)[:EDITION_SIZE]


def reserves_for(clusters, chosen):
    """Everything that didn't make the ten, best first — the bench."""
    taken = {c["id"] for c in chosen}
    return [c for c in sorted(clusters, key=instant_score, reverse=True)
            if c["id"] not in taken]


def next_reserve(bench, kept):
    """Pull the best reserve that doesn't unbalance what we already have."""
    counts = {}
    for c in kept:
        counts[c["category"]] = counts.get(c["category"], 0) + 1
    for i, c in enumerate(bench):
        if counts.get(c["category"], 0) < MAX_PER_CATEGORY:
            return bench.pop(i)
    return bench.pop(0) if bench else None


DEDUP_PROMPT = """These are the ten stories chosen for today's edition. Some may
be the SAME underlying event reported with different wording — a strike described
twice, one summit filed under two angles. Group those together.

%(headlines)s

Two entries are the same story only if they report the same event, not merely
the same topic: two separate attacks in one war are different stories; the same
attack described twice is one.

Return JSON: {"groups": [[1, 4], [2, 7]]} — one array per duplicate set, using
the numbers above. Return {"groups": []} if every story is distinct."""


def drop_duplicates(picked, bench):
    """
    Keyword clustering merges rewrites of one wire story; it does not merge two
    newsrooms describing the same event in different words. That put the same
    Iranian tanker strike in two slots of one edition, so the final ten get one
    cheap read-through before anything is written.
    """
    if os.environ.get("EDITION_DRY_RUN") or len(picked) < 2:
        return picked
    for _ in range(2):
        lines = "\n".join(f"{i + 1}. {c['lead']['title']}" for i, c in enumerate(picked))
        try:
            groups = (ask_json(DEDUP_PROMPT % {"headlines": lines}, SCORING_MODEL,
                               temperature=0.0, max_tokens=600) or {}).get("groups") or []
        except Exception as exc:
            log(f"  ! duplicate check failed: {exc}")
            return picked

        drop = set()
        for g in groups:
            idx = [i - 1 for i in g if isinstance(i, int) and 1 <= i <= len(picked)]
            if len(idx) < 2:
                continue
            keep = max(idx, key=lambda i: instant_score(picked[i]))
            for i in idx:
                if i != keep:
                    drop.add(i)
        if not drop:
            return picked

        log(f"  merged {len(drop)} duplicate slot(s): "
            + "; ".join(picked[i]["lead"]["title"][:44] for i in sorted(drop)))
        picked = [c for i, c in enumerate(picked) if i not in drop]
        while len(picked) < EDITION_SIZE and bench:
            nxt = next_reserve(bench, picked)
            if not nxt:
                break
            picked.append(nxt)
    return picked


# ----------------------------------------------------------------------------
# 4 · Read the lead article
# ----------------------------------------------------------------------------

def fetch_body(url):
    try:
        from bs4 import BeautifulSoup
        r = requests.get(url, timeout=12, headers=UA, verify=False)
        if r.status_code != 200:
            return ""
        soup = BeautifulSoup(r.content, "html.parser")
        for junk in soup(["script", "style", "nav", "header", "footer", "aside", "figure"]):
            junk.decompose()
        root = soup.find("article") or soup.find("main") or soup
        paras = [p.get_text(" ", strip=True) for p in root.find_all("p")]
        text = " ".join(p for p in paras if len(p) > 60)
        return re.sub(r"\s+", " ", text)[:6000]
    except Exception:
        return ""


# ----------------------------------------------------------------------------
# 5 · Write the poster
# ----------------------------------------------------------------------------

WRITE_PROMPT = """You write TODAY, a daily ten-story brief. Every story gets one
commissioned illustration and one short article. Plain, concrete English. No hype,
no cliches, no "in a move that", no rhetorical questions. Short sentences. A reader
who knows nothing about this story must understand it from your text alone.

STORY
Headline as filed: %(title)s
Reported by: %(sources)s
Filed: %(age).0f hours ago
Category: %(category)s
Summary: %(description)s
Article text: %(body)s

Return JSON with exactly these keys:

{
  "tag": "one word, uppercase, e.g. MARKETS / GENOME / BORDER",
  "headline": "8-14 words, states what happened, no colon, no source name",
  "dek": "one sentence, max 25 words, the detail that makes it real",
  "dateline": "PLACE — or the institution, max 30 chars",
  "paragraphs": ["3 paragraphs, 35-55 words each. First: what happened and why now. Second: the context a newcomer needs. Third: what is unresolved."],
  "changes": "one sentence: what this changes for an ordinary reader",
  "unchanged": "one sentence: what it does NOT change — puncture the overreaction",
  "cover": {
    "title": "the poster headline. 7-12 words, max 85 characters. It must be a COMPLETE, PLAIN headline that someone who knows nothing about this story understands on its own: who did what, to whom or where. Compressed telegram fragments are the failure — 'Putin Pauses Kyiv Strikes' and 'US Hits Iranian Oil Carriers' are too clipped to mean anything; write 'Russia halts missile strikes on Kyiv as US envoys arrive' and 'US disables three Iranian oil tankers in the Indian Ocean'. No slogans, no puns, no colons.",
    "standfirst": "the paragraph set across the foot of the poster: 40-60 words, two or three sentences. This is the only text most readers will see, so make it carry the story on its own — who, where, how many, how much, when, and what happens next. Specifics, not summary."
  },
  "art": {
    "tradition": "one of the keys below — pick the one this STORY calls for, not the one that sounds impressive",
    "concept": "2-3 sentences briefing an illustrator on WHAT to draw. NAME THE ACTUAL THINGS: if the story is about Revolut, the Revolut card is in the picture; if it is about a wolf, draw the wolf; if it is about Sydney, draw Sydney. One idea, one image, staged concretely. No text or lettering in it (a brand's own logo is the only exception). Real named individuals cannot be drawn — use their office and attributes instead, never a face.",
    "note": "one short line of art direction: the mood and the palette you want"
  }
}

ILLUSTRATION TRADITIONS — pick for fit:
%(traditions)s

Each is tagged [medium, density]. Newspapers do not illustrate everything by
drawing it — some pages are a photograph of an object, some a chart, some a
thing built out of felt, some a single mark on an empty field. Pick the MEDIUM
this story deserves, not the one that is easiest to draw, and pick the DENSITY
honestly: a small procedural story wants minimal, a sprawling one wants dense.

The two marked GRAVE NEWS ONLY are for death, war and disaster — using them on
an ordinary story makes the edition look funereal, so don't.

Writing the concept is the important part. Bad: "a globe with arrows and charts
around it". Good: "A giant matte-black Revolut card stands upright like a
monolith, logo legible, euro coins spilling from a slot at its base while three
tiny figures scramble to catch them." Specific, staged, one idea. JSON only."""


def write_story(c):
    lead = c["lead"]
    if os.environ.get("EDITION_DRY_RUN"):
        return {
            "tag": c["category"].upper(),
            "headline": lead["title"][:110],
            "dek": lead["description"][:150] or lead["title"],
            "dateline": lead["source"][:30],
            "paragraphs": [lead["description"] or lead["title"]] * 3,
            "changes": "Dry run.",
            "unchanged": "Dry run.",
            "cover": {"title": lead["title"][:48],
                      "standfirst": (lead["description"] or lead["title"])[:220]},
            "art": {"tradition": TRADITION_ORDER[c["id"] % len(TRADITION_ORDER)],
                    "concept": lead["title"], "note": ""},
        }
    body = fetch_body(lead["url"])
    prompt = WRITE_PROMPT % {
        "title": lead["title"],
        "sources": ", ".join(c["sources"][:6]),
        "age": c["age_hours"],
        "category": c["category"],
        "description": lead["description"][:600],
        "body": body[:5000] or "(full text unavailable — write from the summary only)",
        "traditions": tradition_menu(),
    }
    return ask_json(prompt, WRITING_MODEL, temperature=0.6, max_tokens=4000)


MAX_PER_TRADITION = 2
MAX_PER_FAMILY = 2
MIN_MINIMAL = 2          # at least this many very spare posters
MIN_DENSE = 2            # and this many that reward looking closely


def assign_traditions(written):
    """
    The model picks what suits each story; this makes the EDITION vary.

    Left alone the model reaches for drawing almost every time, so an edition
    comes out as ten drawings in ten moods. Real papers move between media —
    a photograph of an object, a chart, something built out of felt — and
    between registers, from one mark on an empty field to something you have
    to lean into. So: no more than two posters share a tradition, no more than
    three share a medium, and every edition carries at least two spare pages
    and two dense ones.
    """
    picks = [(w.get("art") or {}).get("tradition") for w in written]
    tally, fams = {}, {}

    def take(t):
        tally[t] = tally.get(t, 0) + 1
        fams[FAMILY[t]] = fams.get(FAMILY[t], 0) + 1

    def allowed(t):
        return (tally.get(t, 0) < MAX_PER_TRADITION
                and fams.get(FAMILY[t], 0) < MAX_PER_FAMILY)

    # 1 · honour the model's choice where the edition can afford it
    final = []
    for i, t in enumerate(picks):
        if t in TRADITIONS and allowed(t):
            final.append(t)
            take(t)
            continue
        spare = ([k for k in LOUD if allowed(k) and tally.get(k, 0) == 0]
                 or [k for k in TRADITION_ORDER if allowed(k)]
                 or [TRADITION_ORDER[i % len(TRADITION_ORDER)]])
        # prefer a medium nobody has used yet
        spare.sort(key=lambda k: (fams.get(FAMILY[k], 0), tally.get(k, 0)))
        final.append(spare[0])
        take(spare[0])

    # 2 · guarantee the edition has both ends of the register
    def rebalance(want, need):
        have = [i for i, t in enumerate(final) if DENSITY[t] == want]
        if len(have) >= need:
            return
        pool = [k for k in LOUD if DENSITY[k] == want and tally.get(k, 0) == 0]
        swappable = [i for i, t in enumerate(final) if DENSITY[t] == "medium"]
        while len(have) < need and pool and swappable:
            i = swappable.pop()
            new_t, old_t = pool.pop(0), final[i]
            tally[old_t] -= 1
            fams[FAMILY[old_t]] -= 1
            final[i] = new_t
            take(new_t)
            have.append(i)

    rebalance("minimal", MIN_MINIMAL)
    rebalance("dense", MIN_DENSE)

    for w, t in zip(written, final):
        w.setdefault("art", {})["tradition"] = t
    return written


# ----------------------------------------------------------------------------
# 5b · Commission the illustration
# ----------------------------------------------------------------------------


# ----------------------------------------------------------------------------
# 5c · Develop the cover idea
#
# How covers are actually made: an illustrator sketches several competing ideas
# and an art director kills the weak ones. One concept written in one pass, as
# a side-field while the model is busy writing the article, is how you get a
# tasteful inventory of the story's objects instead of an idea about it.
# ----------------------------------------------------------------------------

IDEATE_PROMPT = """You are an editorial illustrator sketching cover ideas.

STORY: %(headline)s
%(dek)s
%(body)s

The cover will be made as: %(label)s — %(fits)s
What that medium can physically do:
%(brief)s

Sketch FIVE different cover ideas. Each must be built on ONE named device:

%(devices)s

Rules for every idea:
- ONE idea, not an arrangement of the story's objects. If your idea is "the
  thing, plus another thing, plus a third thing", it is not an idea.
- It must be SPECIFIC to this story. Name the actual company, place, machine,
  document, animal. An idea that would fit a different story is dead.
- No stock symbols: no cracked globe, ticking clock, chess piece, lightbulb,
  scales of justice, tug of war, domino run, iceberg, house of cards.
- No lettering, labels or words in the picture. A brand's own logo is the only
  exception. Never say a thing "is labelled".
- Real named people cannot be drawn. Use the office and its attributes.
- It must be makeable in the medium above, and its lower third must be quiet.
- Make them genuinely different from each other — not five framings of one idea.
- AT LEAST THREE OF THE FIVE MUST HAVE SOMETHING HAPPENING. A moment caught
  mid-event: something arriving, falling, tearing, spilling, being pulled
  apart, queueing, running out, about to touch. An object sitting still and
  centred is the easiest idea to have and the dullest to look at — it is a
  diagram, not a poster. Put a verb in the picture.

Return JSON:
{"ideas":[{"device":"<key>","concept":"2-3 sentences: what is in the picture and how it is staged","second_beat":"the thing the reader notices a moment later, in one line"}]}"""


SELECT_PROMPT = """You are the art director choosing which cover runs.

STORY: %(headline)s
%(dek)s

The candidates:
%(ideas)s

Judge them hard, in this order:
1. Is there ONE idea with a second beat — something that arrives a moment
   after the first look? An idea with no second beat is decoration.
2. Could this picture be moved onto a different news story without anyone
   noticing? If yes, it fails, however handsome.
3. Is it a stock symbol dressed up? Kill it.
4. Can it actually be made in %(label)s, and does its lower third stay quiet
   enough to set type across?
5. Is anything HAPPENING? A still, centred object — however cleverly chosen —
   is a diagram. Prefer the idea with a verb in it: the moment before, the
   moment during, the moment it gives way. The exception is grave news, where
   stillness is the right register and drama would be vulgar.
6. Would someone who already knows this news still stop on it? If it is merely
   tasteful, it has failed.

Pick the strongest, then TIGHTEN it: cut anything the idea does not need,
sharpen the staging, make the specific named things unmistakable. Remember that
the aim is maximum communication from minimum elements.

If the winner leans on any word, number, label or stamp being READABLE, restage
it so it works without one — the shape of a stamp with no legible text, a form
with ruled lines and no words, a mark rather than a word. The picture will be
rendered with no lettering at all, so an idea that needs a word to land will
arrive broken.

Return JSON:
{"device":"<key of the winner>",
 "concept":"the final brief to the illustrator, 2-3 sentences, staged concretely",
 "why":"one line: what the second beat is"}"""


def develop_concept(story):
    """Sketch five ideas, then art-direct one. Sets art['concept']."""
    art = story["art"]
    t = TRADITIONS[art["tradition"]]
    if os.environ.get("EDITION_DRY_RUN"):
        return
    ctx = {
        "headline": story["headline"],
        "dek": story.get("dek", ""),
        "body": " ".join(story.get("paragraphs", []))[:900],
        "label": t["label"],
        "fits": t["fits"],
        "brief": t["brief"],
        # Stories are developed in parallel, so they cannot see each other's
        # choices. Offering each one a different rotating slice of the
        # vocabulary keeps one device from taking over the edition.
        "devices": device_menu(story.get("slot", 0)),
    }
    try:
        ideas = (ask_json(IDEATE_PROMPT % ctx, WRITING_MODEL,
                          temperature=0.95, max_tokens=2200) or {}).get("ideas") or []
    except Exception as exc:
        log(f"    ! ideation failed for {story['id']}: {exc}")
        return
    if not ideas:
        return

    listed = "\n".join(
        f"{i + 1}. [{d.get('device')}] {d.get('concept')}\n   second beat: {d.get('second_beat')}"
        for i, d in enumerate(ideas))
    try:
        chosen = ask_json(SELECT_PROMPT % {**ctx, "ideas": listed},
                          WRITING_MODEL, temperature=0.3, max_tokens=900)
    except Exception as exc:
        log(f"    ! selection failed for {story['id']}: {exc}")
        chosen = None

    if chosen and chosen.get("concept"):
        art["concept"] = chosen["concept"]
        art["device"] = chosen.get("device")
        art["second_beat"] = chosen.get("why")
    else:
        art["concept"] = ideas[0].get("concept", art.get("concept", ""))
        art["device"] = ideas[0].get("device")



# ----------------------------------------------------------------------------
# 5d · Animate the lead posters
#
# A few pages a day move. The clip is a loop of the SAME poster — same medium,
# same palette, same empty foot band — so the edition reads as one thing rather
# than a slideshow with a video bolted on.
# ----------------------------------------------------------------------------

MOTION_PROMPT = """A short seamlessly looping animated poster.

WHAT IS IN IT — %(concept)s

HOW IT IS MADE — %(brief)s

MOTION — one slow, continuous, looping movement and nothing more: a drift, a
turn, a rise and fall, one element crossing the frame. It must end exactly where
it began so it loops without a seam. No camera moves, no zoom, no push-in, no
parallax, no cuts. The whole picture never changes.

FORMAT — Tall portrait. The artwork fills the top two thirds. THE BOTTOM THIRD
IS COMPLETELY EMPTY FLAT BACKGROUND COLOUR for the whole clip — nothing enters
it at any point. No text, letters, numbers or captions anywhere in the frame.
Flat printed colour, visible paper grain, no gradients, no glow, no gloss, no
photorealism, no 3D rendering."""


def generate_video(prompt):
    """One looping clip from the video model. Returns bytes or None."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    headers = {"Authorization": f"Bearer {key}"}
    try:
        r = requests.post(VIDEO_URL, headers={**headers, "Content-Type": "application/json"},
                          json={"model": VIDEO_MODEL, "prompt": prompt,
                                "seconds": VIDEO_SECONDS, "size": VIDEO_SIZE}, timeout=90)
        if r.status_code >= 300:
            log(f"    video HTTP {r.status_code}: {r.text[:160]}")
            return None
        job = r.json().get("id")
    except Exception as exc:
        log(f"    video submit failed: {exc}")
        return None

    waited = 0
    while waited < VIDEO_TIMEOUT_S:
        time.sleep(VIDEO_POLL_S)
        waited += VIDEO_POLL_S
        try:
            st = requests.get(f"{VIDEO_URL}/{job}", headers=headers, timeout=60).json()
        except Exception:
            continue
        status = st.get("status")
        if status == "completed":
            try:
                clip = requests.get(f"{VIDEO_URL}/{job}/content", headers=headers, timeout=180)
                if clip.status_code == 200:
                    return clip.content
            except Exception as exc:
                log(f"    video download failed: {exc}")
            return None
        if status in ("failed", "cancelled"):
            log(f"    video {status}: {str(st.get('error'))[:140]}")
            return None
    log("    video timed out")
    return None


def upload_video(data, date, story_id):
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    path = f"{IMAGE_PREFIX}/{date}/{story_id}.mp4"
    if url and key:
        try:
            base = url.rstrip("/")
            r = requests.post(f"{base}/storage/v1/object/{VIDEO_BUCKET}/{path}",
                              headers={"Authorization": f"Bearer {key}", "apikey": key,
                                       "Content-Type": "video/mp4", "x-upsert": "true"},
                              data=data, timeout=180)
            if r.status_code < 300:
                return f"{base}/storage/v1/object/public/{VIDEO_BUCKET}/{path}"
            log(f"    video upload HTTP {r.status_code}: {r.text[:140]}")
        except Exception as exc:
            log(f"    video upload failed: {exc}")
    local_dir = os.path.join(ROOT, "public", "editions", "img", date)
    os.makedirs(local_dir, exist_ok=True)
    with open(os.path.join(local_dir, f"{story_id}.mp4"), "wb") as fh:
        fh.write(data)
    return f"/editions/img/{date}/{story_id}.mp4"


def animate(story, date):
    """Give one poster a looping clip alongside its still."""
    art = story["art"]
    t = TRADITIONS[art["tradition"]]
    data = generate_video(MOTION_PROMPT % {"concept": art.get("concept", ""),
                                           "brief": t["brief"]})
    if not data:
        return False
    art["video_url"] = upload_video(data, date, story["id"])
    return True



def generate_image(prompt):
    """One illustration from gpt-image-2. Returns (bytes, mime) or (None, None)."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None, None
    payload = {
        "model": IMAGE_MODEL,
        "prompt": prompt,
        "size": IMAGE_SIZE,
        "quality": IMAGE_QUALITY,
        "output_format": "webp",
        "n": 1,
    }
    for attempt in range(IMAGE_RETRIES):
        try:
            r = requests.post(
                IMAGE_URL, json=payload, timeout=300,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            if r.status_code == 200:
                data = (r.json().get("data") or [{}])[0].get("b64_json")
                if data:
                    return shrink(base64.b64decode(data)), "image/webp"
            elif r.status_code == 429 or r.status_code >= 500:
                wait = retry_after(r, attempt)
                log(f"    image rate-limited, waiting {wait:.0f}s")
                time.sleep(wait)
                continue
            else:
                log(f"    image HTTP {r.status_code}: {r.text[:160]}")
        except Exception as exc:
            log(f"    image error: {exc}")
        time.sleep(2 ** attempt)
    return None, None


def shrink(raw):
    """The API hands back ~2.5MB. Re-encode so the page isn't carrying that."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=IMAGE_WEBP_QUALITY, method=6)
        out = buf.getvalue()
        return out if len(out) < len(raw) else raw
    except Exception:
        return raw


def _luma(rgb):
    r, g, b = [c / 255.0 for c in rgb]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def _contrast(a, b):
    la, lb = _luma(a), _luma(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _ink_from(band, accent, target=8.0):
    """
    A type colour drawn OUT OF the picture rather than defaulted to white.

    Takes the artwork's own accent and walks it toward white or black — away
    from whatever the band underneath is doing — until it clears the contrast
    target. The result reads as chosen for that page instead of stamped on it.
    """
    toward = (255, 255, 255) if _luma(band) < 0.4 else (0, 0, 0)
    best = toward
    for step in range(0, 21):
        t = step / 20.0
        cand = tuple(round(accent[i] + (toward[i] - accent[i]) * t) for i in range(3))
        if _contrast(cand, band) >= target:
            best = cand
            break
        best = cand
    return "#%02x%02x%02x" % best


def palette_of(image_bytes):
    """
    Read the artwork so the type can be keyed to it.

    Title and standfirst sit in different bands, so each band is measured
    separately and gets its own ink mixed from the picture's own colour. That,
    plus the accent, is what stops ten posters reading as one template.
    """
    fallback = {"tint": "#111111", "accent": "#ffffff",
                "panel": "#14140f", "panelInk": "#ffffff",
                "titleTop": "#ffffff", "titleBottom": "#ffffff",
                "topInk": "light", "bottomInk": "light"}
    try:
        from PIL import Image
        import io, colorsys
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size

        def band(y0, y1):
            strip = img.crop((0, int(h * y0), w, int(h * y1))).resize((32, 16))
            px = list(strip.getdata())
            n = len(px)
            return tuple(sum(p[i] for p in px) // n for i in range(3))

        # The brief now keeps these bands empty and flat, so a measurement of
        # them is a measurement of exactly what the type will sit on.
        # All the type now sits in the foot band, which the brief keeps flat
        # and empty — so that is the only measurement that matters.
        top = band(0.68, 1.0)
        bottom = band(0.68, 1.0)

        # The most saturated colour with enough presence to feel deliberate.
        small = img.resize((80, 120)).quantize(colors=12, method=Image.MEDIANCUT)
        pal = small.getpalette()[: 12 * 3]
        counts = dict(small.getcolors() or [])
        best, best_score = None, -1.0
        for i in range(12):
            rgb = tuple(pal[i * 3: i * 3 + 3])
            _, ll, ss = colorsys.rgb_to_hls(*[c / 255 for c in rgb])
            if ll < 0.15 or ll > 0.93:
                continue
            score = ss * (0.45 + counts.get(i, 0) / 9600.0)
            if score > best_score:
                best, best_score = rgb, score
        accent = best or (230, 230, 230)

        # The type is printed on a solid block, not floated over the picture.
        # Its colour is lifted from the artwork so each page reads as one piece.
        panel = accent if 0.06 < _luma(accent) < 0.72 else (
            tuple(max(0, int(c * 0.35)) for c in bottom) if _luma(bottom) > 0.4
            else tuple(min(255, int(c * 0.6 + 90)) for c in bottom))
        panel_ink = (255, 255, 255) if _contrast((255, 255, 255), panel) >= 4.5 else (17, 17, 17)

        return {
            "panel": "#%02x%02x%02x" % panel,
            "panelInk": "#%02x%02x%02x" % panel_ink,
            "tint": "#%02x%02x%02x" % bottom,
            "accent": "#%02x%02x%02x" % accent,
            "titleTop": _ink_from(top, accent),
            "titleBottom": _ink_from(bottom, accent),
            "topInk": "light" if _luma(top) < 0.4 else "dark",
            "bottomInk": "light" if _luma(bottom) < 0.4 else "dark",
        }
    except Exception:
        return fallback


def upload_image(image_bytes, mime, date, story_id):
    """Supabase Storage if configured, otherwise a file under public/."""
    ext = {"image/webp": "webp", "image/png": "png"}.get(mime or "", "jpg")
    path = f"{IMAGE_PREFIX}/{date}/{story_id}.{ext}"

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if url and key:
        try:
            base = url.rstrip("/")
            r = requests.post(
                f"{base}/storage/v1/object/{IMAGE_BUCKET}/{path}",
                headers={"Authorization": f"Bearer {key}", "apikey": key,
                         "Content-Type": mime or "image/png", "x-upsert": "true"},
                data=image_bytes, timeout=90)
            if r.status_code < 300:
                return f"{base}/storage/v1/object/public/{IMAGE_BUCKET}/{path}"
            log(f"    storage upload HTTP {r.status_code}: {r.text[:160]}")
        except Exception as exc:
            log(f"    storage upload failed: {exc}")

    local_dir = os.path.join(ROOT, "public", "editions", "img", date)
    os.makedirs(local_dir, exist_ok=True)
    local = os.path.join(local_dir, f"{story_id}.{ext}")
    with open(local, "wb") as fh:
        fh.write(image_bytes)
    return f"/editions/img/{date}/{story_id}.{ext}"


def commission(story, date):
    """Draw one poster. Mutates story['art'] with the finished image."""
    art = story["art"]
    develop_concept(story)
    prompt = brief_for(art["tradition"], art.get("concept", story["headline"]), art.get("note", ""))
    art["prompt"] = prompt
    if os.environ.get("EDITION_DRY_RUN"):
        return story
    data, mime = generate_image(prompt)
    if not data:
        log(f"    ! no illustration for {story['id']} ({art['tradition']})")
        return story
    art.update(palette_of(data))
    art["image_url"] = upload_image(data, mime, date, story["id"])
    art["bytes"] = len(data)
    return story


# ----------------------------------------------------------------------------
# 6 · Emit
# ----------------------------------------------------------------------------

def issue_number(date):
    return (date - datetime(2026, 1, 1, tzinfo=timezone.utc)).days + 1


def build(now):
    articles = fetch_all_feeds(now)
    if not articles:
        raise RuntimeError("no articles fetched — every feed failed")
    clusters = cluster(articles)
    clusters.sort(key=lambda c: (-c["source_count"], c["age_hours"]))
    shortlist = clusters[:SHORTLIST]
    log(f"Scoring {len(shortlist)} stories for importance ...")
    score_importance(shortlist)
    pool = eligible(shortlist)
    log(f"  {len(pool)}/{len(shortlist)} stories clear the importance floor")
    ten = pick_ten(pool)
    bench = reserves_for(pool, ten)
    ten = drop_duplicates(ten, bench)
    ten = sorted(ten, key=instant_score, reverse=True)

    log("Picked:")
    for i, c in enumerate(ten, 1):
        log(f"  {i:2d}. [{instant_score(c):5.1f} | imp {c['importance']:3.0f} | "
            f"{c['age_hours']:4.1f}h | {c['source_count']} outlets] {c['lead']['title'][:78]}")

    log("Writing ten stories ...")
    kept, drafts = [], []
    batch = list(ten)

    # A story that fails to write is replaced from the bench and tried again.
    # The edition is ten stories; coming up short is not an option it has.
    for attempt in range(4):
        if not batch:
            break
        results = [None] * len(batch)

        def run(i, c):
            try:
                return i, write_story(c)
            except Exception as exc:
                log(f"  ! writing '{c['lead']['title'][:50]}' failed: {exc}")
                return i, None

        with ThreadPoolExecutor(max_workers=3) as pool:
            for fut in as_completed([pool.submit(run, i, c) for i, c in enumerate(batch)]):
                i, w = fut.result()
                results[i] = w

        failed = 0
        for c, w in zip(batch, results):
            if w and w.get("headline"):
                kept.append(c)
                drafts.append(w)
            else:
                failed += 1

        if len(kept) >= EDITION_SIZE or not bench:
            break
        batch = []
        while len(kept) + len(batch) < EDITION_SIZE:
            nxt = next_reserve(bench, kept + batch)
            if not nxt:
                break
            batch.append(nxt)
        if batch:
            log(f"  {failed} failed — bringing in {len(batch)} from the bench "
                f"(attempt {attempt + 2})")

    kept, drafts = kept[:EDITION_SIZE], drafts[:EDITION_SIZE]
    drafts = assign_traditions(drafts)

    date = now.strftime("%Y-%m-%d")
    out = []
    for slot, (c, w) in enumerate(zip(kept, drafts)):
        lead = c["lead"]
        cover = w.get("cover") or {}
        art = w.get("art") or {}
        out.append({
            "slot": slot,
            "id": hashlib.sha1(norm_url(lead["url"]).encode()).hexdigest()[:12],
            "tag": (w.get("tag") or c["category"]).upper()[:14],
            "headline": w.get("headline", lead["title"]),
            "dek": w.get("dek", ""),
            "dateline": w.get("dateline", lead["source"])[:40],
            "paragraphs": [p for p in (w.get("paragraphs") or []) if p][:3],
            "changes": w.get("changes", ""),
            "unchanged": w.get("unchanged", ""),
            "category": c["category"],
            "sources": c["sources"][:6],
            "source_count": c["source_count"],
            "url": lead["url"],
            "photo": ({"url": c.get("image_url"), "credit": lead["source"]}
                      if c.get("image_url") else None),
            "published": lead["published"],
            "age_hours": round(c["age_hours"], 1),
            "importance": round(c["importance"]),
            "instant": round(instant_score(c), 1),
            "cover": {
                "title": str(cover.get("title") or w.get("headline", ""))[:95],
                "standfirst": str(cover.get("standfirst") or w.get("dek", ""))[:420],
            },
            "art": {
                "tradition": art.get("tradition"),
                "video_url": art.get("video_url"),
                "device": art.get("device"),
                "label": (TRADITIONS.get(art.get("tradition")) or {}).get("label", ""),
                "concept": art.get("concept", ""),
                "note": art.get("note", ""),
            },
        })

    log("Commissioning ten illustrations ...")
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(commission, story, date): story for story in out}
        done = 0
        for fut in as_completed(futures):
            try:
                fut.result()
            except Exception as exc:
                log(f"  ! illustration failed: {exc}")
            done += 1
            log(f"  {done}/{len(out)} drawn")

    for story in out:
        story["art"]["device"] = story["art"].get("device")
        story["art"]["second_beat"] = story["art"].get("second_beat")
        story.pop("slot", None)
        story["art"].pop("prompt", None)
        story["art"].pop("bytes", None)

    drawn = sum(1 for st in out if st["art"].get("image_url"))
    log(f"  {drawn}/{len(out)} posters have an illustration")

    movers = [st for st in out if st["art"].get("image_url")][:VIDEO_COUNT]
    if movers and not os.environ.get("EDITION_DRY_RUN") and not os.environ.get("EDITION_NO_VIDEO"):
        log(f"Animating the top {len(movers)} ...")
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(animate, st, date): st for st in movers}
            for fut in as_completed(futures):
                try:
                    fut.result()
                except Exception as exc:
                    log(f"  ! animation failed: {exc}")
        log(f"  {sum(1 for st in out if st['art'].get('video_url'))}/{len(movers)} posters move")

    return {
        "date": date,
        "issue": issue_number(now),
        "generated_at": now.isoformat(),
        "window_hours": WINDOW_HOURS,
        "feeds_read": len(RSS_FEEDS),
        "articles_seen": len(articles),
        "stories_clustered": len(clusters),
        "illustrated": drawn,
        "animated": sum(1 for st in out if st["art"].get("video_url")),
        "stories": out,
    }


def save(edition):
    """
    Publish — unless the run came out too thin to be worth publishing.

    The first live cron ran without an API key: it read 2,641 articles, wrote
    nothing, and pushed an empty edition over a good one, so the site showed no
    news at all. A run that fails should leave yesterday's edition standing,
    which is a bad edition rather than no edition.
    """
    count = len(edition.get("stories") or [])
    if count < MIN_PUBLISHABLE:
        log(f"  REFUSING TO PUBLISH: only {count} stories survived "
            f"(need {MIN_PUBLISHABLE}). The previous edition stands.")
        return False

    os.makedirs(OUT_DIR, exist_ok=True)
    for name in (f"{edition['date']}.json", "latest.json"):
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(edition, fh, ensure_ascii=False, indent=2)
        log(f"  wrote {os.path.relpath(path, ROOT)}")

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        log("  (no Supabase credentials — file output only)")
        return True
    try:
        r = requests.post(
            f"{url.rstrip('/')}/rest/v1/daily_editions?on_conflict=edition_date",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates"},
            json={"edition_date": edition["date"], "issue": edition["issue"],
                  "payload": edition},
            timeout=30)
        log(f"  supabase upsert: HTTP {r.status_code}"
            + ("" if r.status_code < 300 else f" — {r.text[:200]}"))
    except Exception as exc:
        log(f"  ! supabase upsert failed: {exc}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no AI calls")
    args = ap.parse_args()
    if args.dry_run:
        os.environ["EDITION_DRY_RUN"] = "1"

    started = time.time()
    now = datetime.now(timezone.utc)
    log(f"\nTODAY — edition for {now:%Y-%m-%d}\n" + "=" * 60)
    edition = build(now)
    published = save(edition)
    log("=" * 60)
    log(f"Done: {len(edition['stories'])} stories in {time.time() - started:.0f}s")
    if not published:
        return 1
    if len(edition["stories"]) < EDITION_SIZE:
        log(f"WARNING: only {len(edition['stories'])}/{EDITION_SIZE} stories survived writing")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

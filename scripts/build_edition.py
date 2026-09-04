#!/usr/bin/env python3
"""
TODAY — daily edition builder.

Reads every RSS source in rss_sources.py, keeps only what was published in the
last 24 hours, clusters the duplicates, ranks what is most *instant* (breaking
now x matters), picks ten, writes each one as a poster, and emits a single JSON
edition consumed by the website.

Run once a day:  python scripts/build_edition.py

Env:
  GEMINI_API_KEY / GOOGLE_API_KEY   required — scoring + writing
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
from art_direction import TRADITIONS, ORDER as TRADITION_ORDER, brief_for, tradition_menu

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
MAX_PER_CATEGORY = 2         # diversity guard on the final ten
MAX_PER_SOURCE = 2

RECENCY_HALFLIFE_H = 6.0     # how fast "instant" decays
UNDATED_ASSUMED_AGE_H = 10.0 # penalty for feeds that publish no date

SCORING_MODEL = "gemini-2.5-flash-lite"
WRITING_MODEL = "gemini-2.5-flash"
IMAGE_MODEL = "gemini-2.5-flash-image"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

IMAGE_ASPECT = "9:16"        # a phone screen, full bleed
IMAGE_BUCKET = "images"      # existing public Supabase Storage bucket
IMAGE_PREFIX = "today"
IMAGE_RETRIES = 3

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

def gemini(prompt, model, temperature=0.3, max_tokens=4096, retries=3):
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set")
    url = GEMINI_URL.format(model=model, key=key)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    last = None
    for attempt in range(retries):
        try:
            r = requests.post(url, json=payload, timeout=120)
            if r.status_code == 200:
                text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M))
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as exc:
            last = str(exc)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"Gemini call failed after {retries} tries — {last}")


SCORE_PROMPT = """You are the front-page editor of a daily world news brief.

Score each story below 0-100 for how much it matters to a globally curious reader today.

100  a war starts, a government falls, a market crashes, a discovery changes medicine
 80  a major national decision, a large disaster, a landmark scientific result
 60  a significant business, policy, science or culture development
 40  routine coverage, incremental updates, a mid-size company story
 20  celebrity noise, listicles, opinion, sport results with no wider stake
  0  press releases, promotions, horoscopes, live blogs with no news in the title

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
            data = gemini(SCORE_PROMPT % "\n".join(lines), SCORING_MODEL, temperature=0.1)
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
    return c["importance"] * (0.35 + 0.45 * recency + 0.20 * breadth)


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
    "big": "the cover line's number or word, MAX 7 characters, e.g. 2,700 / 1 / OPEN / 40%%",
    "big_label": "max 34 chars, what the big thing counts",
    "hook": "max 90 chars, the line set over the illustration — a fact, not a slogan"
  },
  "art": {
    "tradition": "one of the keys below",
    "concept": "2-3 sentences briefing an illustrator on WHAT to draw. One idea, one image. Describe a concrete scene or a single altered object that carries the meaning — not a list of symbols, not a diagram of the news. No text or lettering anywhere in it. No real, identifiable people.",
    "note": "one short line of art direction: mood, light, or a palette steer"
  }
}

ILLUSTRATION TRADITIONS — pick the one the story actually calls for:
%(traditions)s

Writing the concept is the important part. Bad: "a globe with arrows and charts
around it". Good: "A harvested field seen from low down, the soil opened in one
clean circular void near the horizon; a parked tractor small at the left edge,
its long shadow reaching the rim." Concrete, staged, one idea. JSON only."""


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
            "cover": {"big": str(c["source_count"]), "big_label": "outlets carried it",
                      "hook": lead["title"][:90]},
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
    return gemini(prompt, WRITING_MODEL, temperature=0.6, max_tokens=3000)


def assign_traditions(written):
    """No two posters in one edition are drawn the same way."""
    used = set()
    for i, w in enumerate(written):
        art = w.setdefault("art", {})
        tradition = art.get("tradition")
        if tradition not in TRADITIONS or tradition in used:
            tradition = next(
                (t for t in TRADITION_ORDER if t not in used),
                TRADITION_ORDER[i % len(TRADITION_ORDER)],
            )
        art["tradition"] = tradition
        used.add(tradition)
    return written


# ----------------------------------------------------------------------------
# 5b · Commission the illustration
# ----------------------------------------------------------------------------

def generate_image(prompt):
    """One illustration from the image model. Returns (bytes, mime) or (None, None)."""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None, None
    for attempt in range(IMAGE_RETRIES):
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{IMAGE_MODEL}:generateContent",
                headers={"Content-Type": "application/json", "x-goog-api-key": key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseModalities": ["IMAGE"],
                        "imageConfig": {"aspectRatio": IMAGE_ASPECT},
                    },
                },
                timeout=180,
            )
            if r.status_code == 200:
                parts = (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                for part in parts:
                    inline = part.get("inlineData")
                    if inline and inline.get("data"):
                        return base64.b64decode(inline["data"]), inline.get("mimeType", "image/png")
            else:
                log(f"    image HTTP {r.status_code}: {r.text[:160]}")
        except Exception as exc:
            log(f"    image error: {exc}")
        time.sleep(2 ** attempt)
    return None, None


def tone_of(image_bytes):
    """Average colour of the lower third, and whether type over it should be light."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        strip = img.crop((0, int(h * 0.62), w, h)).resize((24, 12))
        pixels = list(strip.getdata())
        n = len(pixels)
        r = sum(p[0] for p in pixels) // n
        g = sum(p[1] for p in pixels) // n
        b = sum(p[2] for p in pixels) // n
        luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
        return f"#{r:02x}{g:02x}{b:02x}", ("light" if luma < 0.55 else "dark")
    except Exception:
        return "#111111", "light"


def upload_image(image_bytes, mime, date, story_id):
    """Supabase Storage if configured, otherwise a file under public/."""
    ext = "png" if "png" in (mime or "") else "jpg"
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
    prompt = brief_for(art["tradition"], art.get("concept", story["headline"]), art.get("note", ""))
    art["prompt"] = prompt
    if os.environ.get("EDITION_DRY_RUN"):
        return story
    data, mime = generate_image(prompt)
    if not data:
        log(f"    ! no illustration for {story['id']} ({art['tradition']})")
        return story
    tint, overlay = tone_of(data)
    art["image_url"] = upload_image(data, mime, date, story["id"])
    art["tint"] = tint
    art["overlay"] = overlay
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
    ten = pick_ten(shortlist)

    log("Picked:")
    for i, c in enumerate(ten, 1):
        log(f"  {i:2d}. [{instant_score(c):5.1f} | imp {c['importance']:3.0f} | "
            f"{c['age_hours']:4.1f}h | {c['source_count']} outlets] {c['lead']['title'][:78]}")

    log("Writing ten stories ...")
    written = [None] * len(ten)

    def run(i, c):
        try:
            return i, write_story(c)
        except Exception as exc:
            log(f"  ! writing story {i + 1} failed: {exc}")
            return i, None

    with ThreadPoolExecutor(max_workers=5) as pool:
        for fut in as_completed([pool.submit(run, i, c) for i, c in enumerate(ten)]):
            i, w = fut.result()
            written[i] = w

    kept, drafts = [], []
    for c, w in zip(ten, written):
        if w and w.get("headline"):
            kept.append(c)
            drafts.append(w)
    drafts = assign_traditions(drafts)

    date = now.strftime("%Y-%m-%d")
    out = []
    for c, w in zip(kept, drafts):
        lead = c["lead"]
        cover = w.get("cover") or {}
        art = w.get("art") or {}
        out.append({
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
            "published": lead["published"],
            "age_hours": round(c["age_hours"], 1),
            "importance": round(c["importance"]),
            "instant": round(instant_score(c), 1),
            "cover": {
                "big": str(cover.get("big", ""))[:7],
                "bigLabel": str(cover.get("big_label", ""))[:40],
                "hook": str(cover.get("hook", w.get("dek", "")))[:110],
            },
            "art": {
                "tradition": art.get("tradition"),
                "label": (TRADITIONS.get(art.get("tradition")) or {}).get("label", ""),
                "concept": art.get("concept", ""),
                "note": art.get("note", ""),
            },
        })

    log("Commissioning ten illustrations ...")
    with ThreadPoolExecutor(max_workers=4) as pool:
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
        story["art"].pop("prompt", None)
        story["art"].pop("bytes", None)

    drawn = sum(1 for st in out if st["art"].get("image_url"))
    log(f"  {drawn}/{len(out)} posters have an illustration")

    return {
        "date": date,
        "issue": issue_number(now),
        "generated_at": now.isoformat(),
        "window_hours": WINDOW_HOURS,
        "feeds_read": len(RSS_FEEDS),
        "articles_seen": len(articles),
        "stories_clustered": len(clusters),
        "illustrated": drawn,
        "stories": out,
    }


def save(edition):
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
        return
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
    save(edition)
    log("=" * 60)
    log(f"Done: {len(edition['stories'])} stories in {time.time() - started:.0f}s")
    if len(edition["stories"]) < EDITION_SIZE:
        log(f"WARNING: only {len(edition['stories'])}/{EDITION_SIZE} stories survived writing")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

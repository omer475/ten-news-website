# Memory Threads & Quiet Deep Dive — Backend API Contract

Backend is built and deployed on `tennews.ai` / `todayplus.news`. This document
is the contract for the **frontend** work (the other terminal). Nothing here
needs a login — it all works for guest users.

---

## Feature 1 — Memory Threads

> When a new development appears on a story the user previously read, show a
> subtle "Continues from what you read before" indicator, and let them open
> "The thread so far" — a clean recap of the prior key moments.

### What the backend decides vs what the frontend owns

- **Read history stays on-device.** The site already tracks read articles in
  `localStorage` via `ReadArticleTracker` (`readTrackerRef.current.getReadArticles()`
  in `pages/index.js`). Keep using that — the backend stores nothing per-user.
- **Backend decides thread membership + recaps.** A "thread" = articles in the
  same semantic cluster (`vq_secondary`) that share ≥2 specific topic tags. This
  works across every category (a new iOS, a physics result, a war, a playoff
  run), and deliberately does NOT fire on loosely-related soft content.

### 1A. Batch indicator — `POST /api/threads/match`

Call this with the read-article IDs from localStorage plus the IDs of the feed
cards on screen. Use it to decide which cards get the dot/line.

Request:
```json
{
  "readArticleIds": ["1201", "1188", "1175"],
  "articleIds": ["1399", "1402", "1410"]
}
```
Response:
```json
{
  "matches": {
    "1399": { "continuesFromRead": true,  "priorReadCount": 2, "threadKey": 168, "threadSize": 4 },
    "1402": { "continuesFromRead": false, "priorReadCount": 0, "threadKey": 245, "threadSize": 1 },
    "1410": { "continuesFromRead": true,  "priorReadCount": 1, "threadKey": 63,  "threadSize": 3 }
  }
}
```
- `continuesFromRead` → show the "Continues from what you read before" indicator.
- `priorReadCount` → optional ("you read 2 earlier on this").
- `threadSize` → # of this story's articles currently in the batch (≥2 = live thread).
- Never throws: on any error it returns `{ "matches": {} }`. Batch ~30 visible cards per call.

### 1B. The thread so far — `GET /api/threads/recap`

Call when the user opens the recap on a card.

`GET /api/threads/recap?articleId=1399&readIds=1201,1188,1175`

Response:
```json
{
  "threadKey": 168,
  "title": "Kyiv · Russia · Ukraine",
  "eventSlug": "russia-ukraine-war",
  "eventName": "Russia–Ukraine War",
  "priorReadCount": 2,
  "items": [
    { "id": "1100", "title": "Heavy Russian air attacks strike Kyiv again.", "recap": "Overnight strikes hit three districts…", "date": "2026-06-05T22:10:00Z", "url": "https://…", "wasRead": true },
    { "id": "1175", "title": "Russia's attack on Kyiv kills 3, traps civilians.", "recap": "Rescue crews dug through rubble…", "date": "2026-06-07T06:00:00Z", "url": "https://…", "wasRead": true },
    { "id": "1320", "title": "NATO chief visits Kyiv after massive Russian strike", "recap": "The visit signalled…", "date": "2026-06-08T09:30:00Z", "url": "https://…", "wasRead": false }
  ]
}
```
- `items` are **chronological (oldest → newest)**, exclude the current article, capped at 8 key moments.
- `recap` is a clean one-liner per moment (the article's first summary bullet); can be null.
- `wasRead` marks the ones the user already saw (highlight differently, e.g. a filled dot).
- `eventSlug` (nullable) → if present you can deep-link to `/event/[slug]` for the full editorial event page.
- `title` is a short human label (top shared tags, or the event name when one exists).
- Empty thread returns `items: []`.

---

## Feature 2 — The Quiet Deep Dive ("One Story, Deep")

> Once or twice a day, one story gets an AI-written, deeply-researched narrative
> feature. Normal cards for that story show "Go deep on this".

### 2A. Flag on normal feed cards (already in `/api/news`)

Each article in `GET /api/news` may now include a `deepDive` field:
```json
{
  "id": "1399",
  "title": "…",
  "deepDive": { "available": true, "slug": "2026-06-09-iran-israel-strikes", "id": "<uuid>", "headline": "…", "readingTimeMin": 7 }
}
```
- Present on the deep-dive's anchor card **and** its cluster siblings (any card about that story).
- Absent (`undefined`) on everything else. When present → render the "Go deep on this" affordance; navigate using `slug`.

### 2B. Today's deep dive(s) — `GET /api/deep-dive/today`

For the "One Story, Deep" section/entry point.
```json
{
  "deepDives": [
    {
      "id": "<uuid>",
      "slug": "2026-06-09-iran-israel-strikes",
      "date": "2026-06-09",
      "headline": "…",
      "dek": "One-sentence standfirst that frames the piece.",
      "heroImage": "https://…",
      "readingTimeMin": 7,
      "anchorArticleId": "1399",
      "sections": [ { "heading": "The opening", "body": "Prose paragraph(s)…" }, … ],
      "sources": [ { "id": "1399", "title": "…" }, … ],
      "publishedAt": "2026-06-09T11:02:00Z"
    }
  ]
}
```
- Returns today's, or the latest published day if today's hasn't generated yet (never empty once seeded).
- 0–2 items.

### 2C. Single deep dive — `GET /api/deep-dive/[slug]`

```
GET /api/deep-dive/2026-06-09-iran-israel-strikes
→ { "deepDive": { …same shape as a deepDives[] item… } }
→ 404 { "error": "not_found" } if missing/unpublished
```

### Rendering the body

`sections` is an ordered array of `{ heading, body }`. `body` is **plain-text
prose** (paragraphs separated by `\n`), 900–1500 words total across 4–7 sections.
Render `heading` as a section title and `body` as paragraphs. No markdown parsing
required (no bold/links inside body).

---

## Notes / guarantees

- All endpoints send permissive CORS and never 500 on the read paths (they
  degrade to empty results), so the UI can treat them as best-effort enhancers.
- Deep dives are generated by a daily cron (`/api/cron/deep-dive`, 11:00 UTC).
  IDs are stable; `slug` is unique and URL-safe.
- Article IDs are numeric in the DB; send/receive them as strings — both work.

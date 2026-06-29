# Backend handoff — rotating personalized modules + reminders (v2)

Live on prod (todayplus.news). Additive — the legacy `d.modules.*` shape still
works. New this round: **seen-aware rotation**, **stable item ids**, and
**reminders / pin-to-top**.

## GET /api/feed/modules?user_id=...&seen_ids=...

`seen_ids` = comma-separated list of module-item ids the user has already seen.
Pass it on refresh and the endpoint returns the most-relevant **UNSEEN** item(s)
per module, rotating; empty/null when a pool is exhausted. A read item is never
repeated. Every item carries a **stable id**:

- history: `modules.history.ids[i]` (parallel to `rows[i]`), form `h:<date>:<idx>`
- notd: `notd.id`, form `n:<date>:<idx>`
- briefs: `briefs.rows[i].id`, form `b:<date>:<idx>`
- countdowns: the numeric `upcoming_events.id`

Collect the ids of what the user actually saw, accumulate into `seen_ids`, send
on the next call.

```jsonc
{
  "date": "2026-06-29",
  "personalized": true,
  "modules": {
    "history": { "rows": [[year, text, image_url, major], ...], "ids": ["h:..:0", ...], "style", "style_index" },
    "notd":    { "id": "n:..:0", "value", "prefix", "unit", "context", "source_article_id", "title", "topic_tags" },
    "briefs":  { "rows": [{ "id": "b:..:0", "tag", "text" }, ...] },
    "countdowns": { "rows": [{ "name", "datetime", "context" }, ...] },   // legacy soonest
    "countdown_primary": { "id", "name", "datetime", "context", "source_article_id", "topic_tags" } | null,
    "countdown_cards":  [ { "id", "name", "datetime", "context", "source_article_id", "topic_tags" }, ...≤3 ]
  },
  // also mirrored at top level:
  "history", "notd", "briefs", "countdown_primary", "countdown_cards"
}
```

- **history rows are now `[year, text, image_url, major]`** (major = 4th element, index 3). The matching id is in the parallel `history.ids` array.
- `notd.value` is **pre-scaled** (e.g. `3.9` / `"M"`, never `0.0039` / `"B"`).
- No shared CDN cache (rotation is per-user + per-seen-set) — don't cache responses yourself.
- Pools are big now: history = full on-this-date set (up to 16), briefs = 10–15, notd = 3–5 candidates, countdowns = many. So there's real room to rotate.

## Reminders / pin-to-top (NEW)

- **POST /api/feed/reminder** `{ event_id, guest_device_id? }` → add a reminder (logged-in via cookie/bearer, or guest via `guest_device_id`). Idempotent. `event_id` is an `upcoming_events.id` (the `countdown_primary.id` / `countdown_cards[].id` you already get). Past/unknown events are rejected (400/404).
- **DELETE /api/feed/reminder** `{ event_id, guest_device_id? }` → remove it.
- **GET /api/feed/main** now returns **`pinned_events`**: the subject's reminded events still in the future (auto-excludes past), shape `[{ id, name, datetime, context, topic_tags, source_article_id }]` — render these pinned at the top of the feed.
- The literal "alarm" (web-push at event time) is **not** built — it needs a service worker (your domain). Tell me if you want the backend half (a scheduled notifier).

## Supply / behavior notes
- **Delight lane** (pipeline): non-Sports fascinating/uplifting stories (Science/Space/Health/Tech/Entertainment/Lifestyle/World) now publish a reserved ~12% even at mid importance, so the "every ~10 cards" light beat serves real science/good-news to non-sports users (was 84% Sports). This trends in over the next day as the pipeline runs.
- `display.tone` backfilled on the recent window; new articles always carry it.
- Card mix retune (fewer/stronger quotes, more grounded stat/chart/versus, auto-scaled numbers, more covers) is live and trends in as articles regenerate.

# Backend handoff — 4 engagement features (data + ranking side)

Backend half of the TodayPlus engagement features. Frontend UI already landed in
`462bc783`; backend in `627c1940` (branch `claude/todayplus-web-redesign`).
**Both halves go live together on the next prod deploy of this branch.**

## Contract — what /api/feed/main now returns

Per-article (inside each `articles[i]`):
- `display.why_it_matters` : string **or null** — 1–2 sentence consequence line
  ("why care"), ≤200 chars. **null when not groundable** (no fabrication). Render
  nothing when null. ✅ matches your `WhyItMatters` reading `display.why_it_matters`.
- `display.tone` : `"light"` | `"standard"`. ✅ matches your `.toLowerCase().startsWith('li')`.
- `is_essential` : boolean (top-level on the article). ✅ matches your badge + count.
- `published_at` : added as snake_case alias (you already read `publishedAt`; both exist).

Response-level meta:
- `essentials_total` : number — the size of the **global daily** essentials set
  (1-per-world_event deduped). NOTE: your header currently counts
  `stories.filter(is_essential)` from the loaded slate. That undercounts if the
  slate doesn't contain all essentials. If you want the true "N essential stories
  today", use `essentials_total` from the response instead. Either works.
- `last_visit_at` : ISO string or null — the user's PRIOR feed-load time
  (logged-in, cross-device). We stamp `now()` server-side each first-page load.
  Use it (or your localStorage value for guests) to compute "new since last visit"
  via each article's `published_at`.

## POST /api/feed/signal  (your Less/More pills)
- Body `{ article_id, cluster_id?, topic?, source?, signal: "less"|"more" }` — ✅
  exactly what you send. Auth via cookie session (your fetch already sends cookies).
- `less` → demotes the article's cluster/topic/source for the user (feeds Trinity
  rerank immediately). `more` → boosts. Returns `{ success, stored, signal, applied }`.
- **Guests** (no session): returns `200 { success:true, stored:false, reason:'guest' }`
  — safe no-op (signal tables have no guest key). Your optimistic UI is fine as-is.

## Supply notes (important for placement)
- **Essentials**: a strict `ai_final_score >= 900` cut yields only ~4 stories/day.
  Backend uses an **adaptive top-N** (floor 820 / target 10 / cap 12, 36h window),
  so `essentials_total` lands ~10 on a normal day, more on a big news day.
- **Light tone supply is thin**: obviously-light categories are only ~4.7% of
  volume; LLM tone-tagging lifts it across Tech/Sports/World feel-good items but
  margin is tight. **Place light cards _up to_ 1-in-10 and degrade gracefully**
  (skip if none available in the current window) rather than forcing one.

## Where the fields come from (no UI work needed beyond what you built)
- `why_it_matters` + `tone`: generated in `step13_feed_display.py` (live for all
  NEW articles); the recent serving window was backfilled.
- `is_essential` / `essentials_total`: computed at serve time in `lib/essentials.js`.
- `last_visit_at`: `profiles.last_feed_visit_at` (migration 127, applied to prod).

## Still pending
- **Prod deploy of this branch** — required to make the API-side fields
  (`is_essential`, `essentials_total`, `/api/feed/signal`) live. `display.*` fields
  already pass through, so backfilled `why_it_matters`/`tone` show as soon as deployed.

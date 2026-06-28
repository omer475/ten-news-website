# Backend handoff — personalized modules + card retune

Live on prod (todayplus.news). Website on `claude/todayplus-web-redesign`;
pipeline on Cloud Run. The contract is **additive** — the legacy
`d.modules.{history,notd,briefs,countdowns}` shape still works unchanged, so the
current consumer keeps rendering. New richer fields are added alongside.

## /api/feed/modules?user_id=... (user_id optional)

```jsonc
{
  "date": "2026-06-28",
  "personalized": true,                 // false for guests / no-interest users
  "modules": { /* legacy shape, still populated (now personalized) */
    "history":    { "rows": [[year, text, image_url, [tags], major], ...3], "style", "style_index" },
    "notd":       { "value", "prefix", "unit", "context", "source_article_id", "topic_tags" },
    "briefs":     { "rows": [{ "tag", "text" }, ...3] },
    "countdowns": { "rows": [{ "name", "datetime", "context" }, ...] }   // global, soonest
  },
  // NEW richer top-level fields (migrate the UI to these):
  "history": { "rows": [[year, text, image_url, [topic_tags], major], ...3], "style", "style_index" },
  "notd":    { "value", "prefix", "unit", "context", "source_article_id", "topic_tags" } | null,
  "briefs":  { "rows": [{ "tag", "text" }, ...3] },
  "countdown_primary": { "id", "name", "datetime", "context", "source_article_id", "topic_tags" } | null,
  "countdown_cards":  [ { "id", "name", "datetime", "context", "source_article_id", "topic_tags" }, ...≤3 ]
}
```

Notes for the UI:
- **history**: always 1 `major:true` event (most globally significant) + 2 more.
  For a logged-in user with interests the 2 extras are interest-matched; guests
  get the 2 most-impactful. Each row is `[year, text, image_url, topic_tags[], major]`
  — `image_url` is a real illustration (may be null on rare gen failure). The old
  `[year, text]` read still works (extra elements are ignored).
- **notd**: a single best-matching "number of the day", auto-scaled so it never
  renders like `$0.0039B` (→ `$3.9M`). `source_article_id` links to the story.
- **countdowns**: `countdown_primary` = the single most relevant upcoming event,
  `countdown_cards` = up to 3 more. Personalized by the user's interests; guests
  get soonest-first. From a live `upcoming_events` pool (real, grounded, dated
  events — launches, Fed/CPI/ECB, plus events extracted from article text).
- **caching**: guest responses are CDN-cacheable; `user_id` responses are
  `private` (per-user), so don't shared-cache them.
- **degrade gracefully**: any field can be `null`/empty (thin supply, gen miss).

## Card production (display jsonb) changes — already flowing on new articles
- `display.why_it_matters` + `display.tone` are now generated **in the pipeline**
  (previously only on the website branch, so no new article had them — fixed).
- Numbers in `display.stats` / `display.big` / notd are auto-scaled (no `$0.0039B`).
- Quotes are rarer + stronger (named-newsmaker only). `big`/`versus` slightly more
  frequent where grounded. Charts unchanged. More articles carry a usable cover
  image (image gate 70→60). NOTE: the cover-template choice is still your
  `selector.js` (`cover_ok` is a never-written/dead flag you could implement).

Ping me if you want any field renamed/reshaped before you wire the UI.

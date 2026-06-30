# Edition API — contract for the WEB terminal

Pipeline terminal owns this. Web terminal **consumes** it. This is the locked §13 shape.

## Endpoint

```
GET /api/edition?date=YYYY-MM-DD
```

- `date` optional. Default = **today's edition in Europe/London** (publishes 07:00 UK).
- Always returns `200` with a §13 JSON body (never empty): falls back to the most
  recent published edition, then to a bundled hand-written sample.
- Fully OPEN — no auth, no paywall.
- `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.

## Body (the only shape you render)

```jsonc
{
  "edition_date": "2026-06-30",
  "is_sample": true,                 // present ONLY when the bundled sample is served; omit-safe
  "items": [ /* exactly 15, in paced order */
    {
      "bucket": "must" | "fun",
      "type":   "illustration" | "stat" | "chart" | "quote" | "text",
      "kicker": "World",
      "headline": "<=10 words",
      "accent_entity": "string" | null,   // the ONE phrase to gold-highlight in the headline
      "dek": "one sentence" | null,
      "bullets": ["...", "..."],          // 1-3, all shown
      "lighter": false,                    // true for every fun item -> show the gold "lighter" pill
      "sources": [{ "outlet": "Reuters", "url": "https://..." }],

      // present ONLY on the matching card type — render by FIELD PRESENCE, not just `type`:
      "stat":  { "value": 4.25, "prefix": "", "suffix": "%", "decimals": 2, "label": "..." },
      "chart": { "series": [301200, ...], "now_label": "323,250", "source": "... · 6mo", "highlight_index": 5 },
      "quote": { "text": "...", "highlight": "phrase inside text", "by": "attribution" },
      "illustration": { "scene": "...", "asset_url": "/path-or-https" | null, "seed": 110735 }
    }
  ],
  "number_of_day":   { "value": 130000, "unit": "hectares", "comparison": "..." },
  "today_in_history":{ "rows": [[1969, "..."], [1990, "..."], [2004, "..."]] },
  "countdown":       { "name": "...", "datetime": "2026-08-12T17:46:00Z", "context": "..." }
}
```

## Invariants you can rely on (enforced pipeline-side)

- **Exactly 15** items, paced heavy→light, **ending on a light positive `fun` item**.
- **Never >3 `must` in a row** without a `fun` beat.
- **Illustrations only on non-serious (`fun`) items.** War/death/arrests/tragedy are
  always plain `text` cards with no `illustration` and no jokes.
- No two adjacent items share the same `type`.
- **No `quiz` field.** The ending is: all-caught-up → one-more-thing → finale clock.
- The 3 modules (`number_of_day`, `today_in_history`, `countdown`) are **top-level**,
  not entries in `items[]`.

## Fail-soft for illustrations

`illustration.asset_url` may be `null` if generation failed — render that item as a
text/no-image card. The current sample points `asset_url` at a bundled placeholder
SVG (`/sample-illustrations/placeholder.svg`) so you can build the illustration card
today; the pipeline swaps in real art.

## Status

- ✅ `editions` table live (migration `131_editions.sql`).
- ✅ A **published** sample row exists for today's UK date — you hit the real DB path.
- ⏳ Real LLM-written editions + generated illustrations land next (pipeline steps b/c).
  The shape will not change.

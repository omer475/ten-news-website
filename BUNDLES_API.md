# Story Bundles API — frontend contract

A "Top Stories" / "Spotlight" section: named topic bundles, each a header + 2-4
articles, mixing the biggest stories everyone should see with bundles matched to
the user. Render it like Must Know — a few expandable bundles near the top, then
the normal feed continues below.

## `POST /api/bundles`

Stateless / guest-friendly — the client passes its own personalization signals
(same ones the feed already uses: reading-history interest tags, followed topics,
home country, and the localStorage read-article ids).

Request body (all optional):
```json
{
  "interests": ["semiconductors", "nvidia", "stocks"],   // user's strong interest_tags (from reading history)
  "topics": ["technology", "markets"],                    // followed topics
  "country": "US",                                        // home country
  "readArticleIds": ["1201", "1188"],                     // localStorage read ids — excluded from bundles
  "limit": 6                                              // max bundles (default 6, cap 10)
}
```

Response:
```json
{
  "bundles": [
    {
      "id": "<event id>",
      "header": "Chip Stock Plunge",
      "slug": "chip-stock-plunge",            // world-event slug -> deep-link to /event/[slug] (nullable)
      "importance": 930,                       // top article score in the bundle
      "isMajor": true,                         // true = a "biggest story everyone should see" pick
      "matchedInterests": ["semiconductors"],  // why it surfaced for this user ([] if none)
      "articles": [                            // 2-4 articles, best first
        { "id": "188xxx", "title": "Micron erased weeks of gains on chip stock sell-off.",
          "recap": "Shares fell 12% as the sector rolled over.",   // one-liner (nullable)
          "image": "https://…", "url": "https://…",
          "category": "Business", "date": "2026-06-09T18:00:00Z" }
      ]
    }
  ]
}
```

### Behaviour / guarantees
- **Mix**: the first ~2 bundles are the biggest stories regardless of interests
  (`isMajor: true`); the rest are ranked by relevance to the user. With no
  personalization signals you still get a sensible "biggest stories" list.
- **Cleaned**: bundles whose articles don't actually match their header are
  dropped (no incoherent "AI Discovery" bundle full of unrelated articles).
- **De-duplicated**: near-duplicate events about the same story are merged.
- **2-4 articles** per bundle, freshest+highest-scored first; already-read ones
  are excluded (falls back to including them only if a bundle would otherwise
  drop below 2).
- Never throws — returns `{ "bundles": [] }` on any error. `Cache-Control: no-store`.
- Window: stories from roughly the last 48h.

### Rendering notes
- `header` is the section/bundle title. Under it, list the `articles`.
- `slug` (when present) can deep-link the whole bundle to its event page.
- `matchedInterests` is optional UI ("Because you follow semiconductors").
- Tapping an article navigates to that article id as usual.

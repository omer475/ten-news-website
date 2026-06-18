# PROMPT FOR THE DESIGN TERMINAL — TodayPlus Feed Redesign v1.0 (iOS/SwiftUI)

You are implementing the TodayPlus feed redesign in the iOS app (SwiftUI). The full design spec is the document "TodayPlus Feed — Design System & Implementation Spec v1.0" (9 card templates, 5 interstitial modules, template selector, image-rhythm balancer, engagement mechanics). Implement it exactly as written. This prompt adds the LIVE DATA CONTRACT — the backend (Cloud Run pipeline + feed API) has already been updated to produce everything you need, so build against real data, not mocks.

## 1. Where the data comes from

### Articles — existing feed API, new `display` field
Every article object returned by the feed endpoints the app already uses (`/api/feed/main`, `/api/feed/following`, etc.) now carries a new nullable field:

```jsonc
"display": {
  // REQUIRED fields (always present when display != null)
  "category": "TECH",        // one of the 11 design categories (see §2 below)
  "breaking": false,          // bool, stamped by the pipeline (importance >= 900/1000)
  "title": "… <em>Nvidia</em> …",   // SAME wording as title_news, with <em> entity marks
  "lede": "one-sentence summary",   // plain text, used by the Cover template
  "bullets": ["… <em>e</em> … <b>k</b> …"],  // 2-3, same wording as summary_bullets_news + marks
  "stats": [["DEAL SIZE", 886, "$", "B", "all-stock, closes Q3"], …],
            // 0 or 2-3 entries: [LABEL, number, prefix, unit, sub].
            // [] means no stats row — hide it (don't render an empty row).
  "tags": ["Nvidia", "Jensen Huang"],   // 2-3 entity tag pills
  "imageURL": "https://…",    // same as image_url; every story has one

  // OPTIONAL signals — present only when the story genuinely supports them.
  // Shapes are EXACTLY as spec §3:
  "big": [5000, "", "", "robotaxis requested in a single permit"],
  "quote": { "text": "… <em>key phrase</em> …", "who": "Name · Role" },
  "versus": { "a": {"val": 5000, "unit": "", "who": "TESLA — CAMERAS"},
              "b": {"val": 850, "unit": "", "who": "WAYMO — LIDAR"},
              "ratio": 0.85, "note": "one-line context" },
  "timeline": [["MAY 28", "event text"], ["JUN 07", "…"], ["NEXT", "…"]],  // 3-4, most recent first
  "trend": { "vals": [8,12,11,19,27,35], "labels": ["DEC","JAN","FEB","MAR","APR","MAY"],
             "unit": "%", "caption": "one-line reading" },
  "geo": { "pins": [{"lat": 36.17, "lon": -115.14, "label": "Las Vegas"}],
           "link": false, "distance": "", "region": "NEVADA · USA" }
}
```

Contract notes:
- **`display` can be `null`** (articles published before today, or a rare generation failure). Fallback: render the current/legacy card. Do not crash, do not show an empty card.
- **`ageLabel` is NOT provided** — compute it client-side from `publishedAt` ("30m", "2h", "1d").
- All numbers in `stats`/`big`/`versus`/`trend` are raw numbers (no commas/symbols); `prefix`/`unit` carry the "$"/"B"/"%" parts. Format with thousands separators client-side per spec §7.2.
- `<em>`/`<b>` are the only markup in `title`/`bullets`/`quote.text`. Parse to `AttributedString` at decode time (spec §9).
- Validation upstream guarantees: stats labels ≤16 chars; timeline 3-4 entries; trend vals/labels same length (4-8); geo pins have valid lat/lon and `link` only with exactly 2 pins; versus ratio ∈ [0.05, 0.95]. You can trust the shapes.

### Interstitial modules — new endpoint `GET /api/feed/modules`
```jsonc
{
  "date": "2026-06-10",
  "modules": {
    "history":    { "rows": [[1969, "event sentence"], [1944, "…"], [1903, "…"]] },
    "notd":       { "value": 41, "prefix": "$", "unit": "B", "context": "sentence with comparison" },
    "briefs":     { "rows": [{"tag": "EU", "text": "… <b>entity</b> …"}, …] },  // 3 rows
    "countdowns": { "rows": [{"name": "Fed decision", "datetime": "2026-06-17T18:00:00+00:00", "context": "…"}] }  // may be empty
  }
}
```
- Generated once daily by the pipeline. Cache-friendly (s-maxage 900). A module key may be missing — skip it in the rotation.
- **MARKET PULSE (§8.4) is client-side**: fetch live quotes from the app (or skip it in v1 and rotate the other 4 modules) — the backend does not supply prices.
- COUNTING DOWN (§8.1): use the first future `countdowns` row; if none, skip the module.

## 2. Categories — 11, not 8
The pipeline covers more than the spec's 8 categories. Three additions, with accent colors chosen to meet ≥4.5:1 on `#FCFBF8` and stay distinct from the existing 8:

| Category | Hex       |
|----------|-----------|
| SPORTS   | `#2D7A31` |
| CULTURE  | `#B23A77` |
| HEALTH   | `#0E7C86` |

All other tokens/colors exactly per spec §2.

## 3. What stays client-side (your responsibility)
- **Template selector + image-rhythm balancer (§4)** — run at feed-assembly time in the view model, exactly per the pseudocode. Eligibility comes from which signals exist on `display` (e.g. `chart` eligible iff `display.trend != nil`). `display == null` → only the legacy fallback card.
- **Engagement mechanics (§7)**: sticky header + read counter, count-ups, parallax, infinite scroll, reduce-motion — all client-side.
- **Module insertion** after every 3 story cards, rotating through available modules (§4/§8).
- The acceptance checklist (§10) must pass.

## 4. Build/run notes
- The iOS project lives in `/Users/omersogancioglu/Ten News Website/TenNewsApp` — build from the MAIN working dir, not a worktree copy.
- Never `simctl uninstall` the app (wipes data); terminate + install over existing.
- The user reviews in the iOS Simulator — build and run it yourself after implementing.
- Backend articles started carrying `display` from 2026-06-10 ~19:40 UTC+3; older rows are `null`, so the feed will be a mix — perfect for testing the fallback path.

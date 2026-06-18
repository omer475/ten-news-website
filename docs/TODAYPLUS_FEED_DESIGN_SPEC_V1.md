# TodayPlus Feed — Design System & Implementation Spec v1.0

This document fully specifies the TodayPlus feed redesign: 9 article card templates, 5 interstitial modules, the template-selection algorithm, the image-rhythm balancer, and all engagement mechanics. It is written to be implemented as-is. A working HTML reference prototype exists (`todayplus-feed.html`); when in doubt, match the prototype.

Target: iOS app (SwiftUI). Where web units are given (px), treat 1px = 1pt.

---

## 1. Design Principles

1. **Variable rhythm beats uniform polish.** The feed must never show the same card layout twice in a row. Unpredictability of the next card's format is the core scroll driver.
2. **Images are accents, not wallpaper.** Every story has an image, but only ~40% of cards display one. Never two image cards consecutively; never more than 3 consecutive cards without an image.
3. **Numbers are the brand.** Stats are first-class content. They are never inside filled boxes/cards — they sit directly on the background with a small colored dash above them, and they animate (count up) when they enter the viewport.
4. **No fake social proof.** The product has few users at launch. Never display community counts ("X people voted/read/answered"). All interactive elements must be single-player (countdowns, personal read counter, etc.).
5. **Category color is a thread, not a flood.** Each card inherits exactly one accent color from its category. The accent appears only in: entity highlights, bullet dots, stat dashes, badges/kickers, and template-specific elements (VS ring, chart bars, map pins). Body text and backgrounds stay neutral.

---

## 2. Design Tokens

### 2.1 Colors (light theme, calibrated for white background)

| Token        | Hex       | Usage |
|--------------|-----------|-------|
| `bg`         | `#FCFBF8` | App background (warm white, never pure #FFF) |
| `ink`        | `#16150F` | Headlines, primary text |
| `ink2`       | `#5F5B51` | Body/secondary text, bullet text |
| `ink3`       | `#A39E92` | Labels, timestamps, mono captions |
| `line`       | `#EAE6DD` | Hairline dividers, pill borders |
| `gold`       | `#A8802F` | Brand accent (darkened for white-bg contrast; do NOT use the old `#C9A464` on white — too low contrast) |
| `goldSoft`   | `#C9A464` | Only on dark surfaces (cover overlay, map card) |
| `red`        | `#C8362F` | Breaking, negative deltas |
| `green`      | `#1E7F4F` | Positive deltas |

### 2.2 Category accent colors (each ≥ 4.5:1 contrast on `bg`)

| Category | Hex |
|----------|-----|
| WORLD    | `#B5443F` |
| AI       | `#A8802F` |
| ECONOMY  | `#946A1C` |
| TECH     | `#2F66D0` |
| POLICY   | `#7A4FB6` |
| MARKETS  | `#A8802F` |
| SCIENCE  | `#1F8A70` |
| ENERGY   | `#C25A1F` |

Every card sets `accent = categoryColor[story.category]`.

### 2.3 Typography

| Role | Font | Weight | Size | Tracking | Line height |
|------|------|--------|------|----------|------------|
| Brand wordmark | Inter Tight | 800 | 17–18 | −0.03em | — |
| Headline (standard cards) | Inter Tight | 800 | 22–27 (clamp by width) | −0.03em | 1.12–1.14 |
| Headline (cover, on image) | Inter Tight | 800 | 24–32 | −0.035em | 1.10 |
| Headline (stat-hero) | Inter Tight | 800 | 27–37 | −0.04em | 1.06 |
| Giant numbers (stat-hero, NOTD) | Inter Tight | 800 | 51–84 | −0.05em | 0.95 |
| Stat values (inline) | Inter Tight | 800 | 24–30 | −0.04em | 1.0 |
| Body / bullets | Figtree (or SF Pro as iOS fallback) | 400–500 | 15 | 0 | 1.55 |
| Mono labels/kickers/timestamps | IBM Plex Mono (or SF Mono) | 400–500 | 9–11 | +0.10 to +0.26em | 1.5 |
| Quote text | Inter Tight Italic | 700 | 24–31 | −0.03em | 1.2 |

All numerals: `font-variant-numeric: tabular-nums` (SwiftUI: `.monospacedDigit()`).

Entity highlights inside headlines/bullets (`<em>` in the data): rendered in the card's accent color, same weight as surrounding text, no italic. On dark surfaces (cover/map) use `goldSoft` instead of accent for warmth and contrast.

### 2.4 Layout constants

- Column max width: 600pt, horizontal padding 16pt.
- Vertical gap between cards/modules: 48pt.
- Corner radius: images/figures 22pt (cover 22, split thumbnail 16, map 22).
- Bullet dot: 6×6pt circle in accent color, 2pt from left edge, text indented 20pt.

---

## 3. Story Data Model (template signals)

Each story object carries optional "signals". The AI Editor / synthesis step should populate these in the content JSON. A signal's presence makes the story eligible for the corresponding template.

```jsonc
{
  "category": "TECH",            // required, one of the 8 categories
  "ageLabel": "30m",             // required, relative timestamp
  "breaking": false,             // optional; true = prefers Cover
  "title": "…<em>entity</em>…",  // required; <em> marks entity highlights
  "lede": "one-sentence summary",// required (used by Cover)
  "bullets": ["…", "…", "…"],    // required, 2–3 items, <b>/<em> allowed
  "stats": [                     // required, 2–3 items
    ["LABEL", 886, "$", "B", "sub caption"]
    //  label, number, prefix, unit-suffix, sub
  ],
  "tags": ["Entity 1", "Entity 2"],
  "imageURL": "…",               // required — every story HAS one;
                                 // whether it is SHOWN is the selector's call

  // ── optional signals ──
  "big":      [5000, "", "", "robotaxis requested in a single permit"],
              // one hero number: [value, prefix, unit, caption]
  "quote":    { "text": "… <em>key phrase</em> …", "who": "Name · Role" },
  "versus":   { "a": {"val": 5000, "unit": "", "who": "TESLA — CAMERAS"},
                "b": {"val": 850,  "unit": "", "who": "WAYMO — LIDAR"},
                "ratio": 0.85,    // left side's share of the comparison bar
                "note": "one-line context sentence" },
  "timeline": [ ["MAY 28", "event text"], ["JUN 07", "…"], ["NEXT", "…"] ],
              // 3–4 entries; labels are dates or "NEXT"
  "trend":    { "vals": [8,12,11,19,27,35], "labels": ["DEC","JAN","FEB","MAR","APR","MAY"],
                "unit": "%", "caption": "one-line reading of the chart" },
  "geo":      { "pins": [ {"lat": 36.17, "lon": -115.14, "label": "Las Vegas"} ],
                "link": false,            // true only with exactly 2 pins
                "distance": "1,560 km",   // shown on the link arc
                "region": "NEVADA · USA" }
}
```

---

## 4. Template Selector + Image-Rhythm Balancer

Runs client-side at feed assembly time (selection depends on neighboring cards, so it cannot be precomputed per story).

```
IMG_DESIGNS = { cover, classic, split }        // templates that display the image
ELIGIBILITY:
  cover    : always eligible
  classic  : bullets.count >= 2
  stat     : story.big != nil
  quote    : story.quote != nil
  versus   : story.versus != nil
  line     : story.timeline != nil
  split    : always eligible
  chart    : story.trend != nil
  map      : story.geo != nil

STATE (persisted across the session feed):
  lastUsed[design]  -> last block index it appeared at (default -∞)
  lastDesign        -> previous card's design
  lastWasImage      -> previous card used an image?
  noImgStreak       -> consecutive non-image cards so far

CHOOSE(story, blockIdx):
  candidates = eligible designs for story, excluding lastDesign
  if lastWasImage:
      nonImg = candidates without IMG_DESIGNS
      if nonImg not empty: candidates = nonImg          // rule: never 2 image cards in a row
  else if noImgStreak >= 3:
      img = candidates ∩ IMG_DESIGNS
      if img not empty: candidates = img                 // rule: force an image after 3 dry cards
  if story.breaking AND not lastWasImage AND lastUsed[cover] < blockIdx - 3:
      candidates = [cover]                               // breaking prefers cover, never breaks rhythm
  pick = candidate with the SMALLEST lastUsed value      // least-recently-used → max variety
  update state; return pick
```

Interstitial modules: insert one module after every 3 story cards (i.e., block positions 4, 8, 12, …). Modules rotate through their list in order, reshuffling when exhausted. Modules do not affect the image-rhythm state.

---

## 5. Article Card Templates (9)

Common to all cards unless stated otherwise:
- **Kicker row**: mono 9.5pt, letter-spacing +0.22em, uppercase, accent color; right-aligned timestamp in `ink3`.
- **Footer**: horizontal scrolling tag pills (transparent bg, 1pt `line` border, 7×13pt padding, radius 99) + 3 action icons (info, bookmark, share), 36×36pt circular hit areas, 1.8pt stroke icons in `ink3`, hover/active → `ink`.
- **Bookmark interaction**: tap toggles fill to `gold` with a pop animation — scale to 1.3 at 45% then back, 0.4s, spring `cubic-bezier(.3,1.8,.4,1)`.
- **Entrance**: card fades in and rises 22pt → 0 over 0.55s `cubic-bezier(.2,.7,.2,1)` when ≥12% visible.

### 5.1 COVER — headline inside the photo
*Trigger:* breaking news, or rotation. The flagship "moment" card.
- Figure aspect ratio **4:4.8**, radius 22, full-bleed image.
- Scrim gradient (top→bottom): `rgba(12,11,8)` at opacities `0.18 → 0 (32%) → 0.50 (60%) → 0.94 (96%)`. The bottom 40% must be near-opaque so white text always passes contrast on bright photos.
- Bottom-left content block, 20pt padding:
  - Kicker: white 85% opacity; if breaking, prepend a 7pt red dot (`#FF5A52`) pulsing — box-shadow ring expanding 0→9pt over 2s, infinite — plus the literal text `BREAKING · `.
  - Headline: white, 24–32pt, entity `<em>` in `goldSoft` (NOT dark gold — illegible on photos). Text shadow `0 2 24 rgba(0,0,0,.4)`.
  - Lede: white 82% opacity, 14.7pt, max width ~50ch.
- Timestamp pill top-right: mono 9.5pt on `rgba(12,11,8,.4)` + blur, radius 99.
- Below the figure: open stats row (§6) + footer. No bullets on this template.

### 5.2 CLASSIC — photo top, text below
*Trigger:* default workhorse for stories with ≥2 bullets.
- Figure 16:10, radius 22. Category badge top-left: mono 9.5pt white text on a pill filled with `mix(accent 85%, black)`, padding 7×11.
- Below (16pt gap): headline (22–26pt) with timestamp right-aligned on the same baseline row.
- Bullets (14pt gap): accent dots, 2–3 items.
- Open stats row + footer.

### 5.3 STAT-HERO — no photo, one giant number
*Trigger:* `big` signal present.
- Top border: 3pt solid accent, full width; 18pt padding below it.
- Kicker row (accent) → headline 27–37pt.
- **Big number block** (20pt below headline): value at 51–74pt in accent color, unit as `small` at 42% size; beside it a caption (13.6pt, `ink2`, max 24ch) baseline-aligned.
- Number counts up on viewport entry (§7.2).
- Then max 2 bullets + footer. NO stats row (the big number replaces it).

### 5.4 QUOTE — pull-quote led
*Trigger:* `quote` signal.
- Kicker row → oversized opening quotation mark `“` 86pt Inter Tight 800 in accent, height clipped to 34pt (it hangs over the quote).
- Blockquote: Inter Tight 700 italic 24–31pt, `<em>` phrases in accent.
- Attribution row (14pt below): 26pt-wide 1.5pt accent dash, then mono 10pt uppercase `ink3`, name in `ink2`.
- Then the story headline restyled as a subhead: 17pt, weight 700, `ink2` color with `<em>` in `ink` (inverted emphasis — quote owns the color).
- Max 2 bullets + footer. No photo, no stats row.

### 5.5 VERSUS — two sides face off
*Trigger:* `versus` signal.
- Kicker row → headline 22–27pt.
- **Ring layout** (20pt below): 3-column grid `1fr auto 1fr`:
  - Each side: count-up value 32–46pt weight 800 (unit in accent at 45% size), below it mono 9pt uppercase `ink3` label (the `who`), centered.
  - Center: 40pt circle, 1.5pt accent border, "VS" in Inter Tight 800 12.5pt accent.
- **Ratio bar** (18pt below): 6pt tall, radius 99, track `line`; left segment fills to `ratio×100%` in accent, right segment `mix(accent 30%, white)`. Left segment animates width 0→target over 1s `cubic-bezier(.2,.7,.2,1)` on viewport entry, with 150ms delay.
- One context line (the `note`) as a single bullet, then footer.

### 5.6 TIMELINE — developing story
*Trigger:* `timeline` signal.
- Kicker reads `DEVELOPING · {CATEGORY}`.
- Headline 22–27pt.
- Vertical rail (20pt below): 1.5pt `line` colored line at x=5pt; entries indented 24pt.
  - Node: 11pt circle, 2pt accent border, `bg` fill; FIRST node is solid accent (= most recent / "now").
  - Entry: mono 9.5pt accent uppercase date label, then 14.7pt `ink2` text (bold spans in `ink`), 18pt gap between entries.
- Footer. No photo, no stats.

### 5.7 SPLIT — compact, square thumb left
*Trigger:* rotation filler; keeps medium-weight stories short.
- Grid: 116pt square image (radius 16) | text column, 16pt gap.
- Kicker row → headline 17–20pt (1.2 line height) → exactly ONE bullet rendered as plain paragraph (no dot), 14pt `ink2`.
- Footer (12pt top margin). The whole card is intentionally small — it is the feed's "breath".

### 5.8 CHART — animated trend bars
*Trigger:* `trend` signal.
- Kicker row → headline 22–27pt.
- Bar chart (20pt below): height 120pt, bars flex-equal width with 8pt gaps, radius `6 6 2 2`.
  - All bars `mix(accent 22%, white)`; the LAST bar solid accent (the news is the latest data point).
  - Value labels above each bar: mono 9pt `ink3`; last bar's label accent + medium weight.
  - Bars animate `scaleY 0→1` (transform-origin bottom) 0.8s, staggered 80ms left-to-right, on viewport entry.
- X-axis labels row: mono 9pt `ink3`, centered under each bar.
- Caption line (14pt below): 14pt `ink2`, key phrase bold `ink`.
- Footer. No photo, no stats row.

### 5.9 MAP — location card
*Trigger:* `geo` signal. The only dark surface besides Cover — a deliberate contrast moment.
- Kicker reads `ON THE MAP · {CATEGORY}`.
- Headline 22–27pt (on white, above the map).
- **Map figure** (18pt below): aspect 16:11, radius 22, background `#0E1320` (deep navy).
  - Stylized inline vector world map (equirectangular, 720×360 coordinate space; x=(lon+180)/360·720, y=(90−lat)/180·360). Low-poly continent polygons: fill `#1A2233`, stroke `#27314A` 0.8pt. Graticule grid every 20 units: `#1D2536` 0.6pt. (Polygon data is in the prototype — copy it verbatim. No external map service, no API keys, works offline.)
  - **Auto-zoom**: viewBox = bounding box of all pins, padded ×2.4, min width 200 units, clamped to map bounds, 16:11 aspect.
  - **Pins**: solid accent dot (r≈3.4, scaled by zoom) + expanding pulse ring (accent stroke 1.2pt, scale 0.4→2.6, opacity .9→0, 2.2s infinite). Label right of pin: mono ~9pt (zoom-scaled) `#E8EAF2` uppercase.
  - **Two-pin mode** (`link:true`): dashed quadratic arc between pins (accent, 1.2pt, dash 4-4), arc peak lifted by 22% of pin distance; distance label (mono, accent) centered above the arc apex.
  - Bottom-left: coordinates of pin 0, mono 9pt, `rgba(232,234,242,.55)`, format `36.17°N · 115.14°W`.
  - Top-right region pill: mono 9pt, `rgba(232,234,242,.75)` on `rgba(14,19,32,.6)` + blur, 1pt border `rgba(232,234,242,.14)`.
- Max 2 bullets below the map + footer. No stats row.

---

## 6. Open Stats Row (shared component)

Used by Cover and Classic. **Never inside a filled box/card — no background, no border.**
- Horizontal row, items flex-equal, 14pt gaps.
- Each stat: a 22pt-wide 2pt accent dash on top (radius 2, opacity on dark surfaces n/a — stats always sit on `bg`), 10pt gap, then:
  - Value: 24–30pt Inter Tight 800 `ink`, unit suffix as `small` 60% size in accent (`$886` + `B`).
  - Label: mono 9pt uppercase `ink3`, 7pt below.
  - Sub caption: 11.5pt `ink2`, 2pt below (optional).
- Values count up on viewport entry (§7.2).

---

## 7. Engagement Mechanics

### 7.1 Sticky header
- Blurred `bg` at 80% + system blur. Contains: wordmark `today` + `plus` (plus in gold); right side **read counter**: lightning bolt glyph (gold) + count + mono `READ` label.
- Read counter increments when a story card reaches 55% viewport visibility (once per card; modules don't count). On increment, the counter pops: scale 1→1.14→1, 0.45s spring.
- Under the header: 2pt **reading progress bar** (gold) = scroll progress of the page.
- Under that: **breaking ticker** — one line, mono 10.5pt, hairline borders top/bottom, marquee scrolling right-to-left, 38s loop, seamless (content duplicated). `BREAKING` in red; entity names in `ink`.

### 7.2 Count-up numbers
Every stat value, big number, and versus value animates from 0 to target when it first becomes ≥50% visible. Duration 0.9s, ease-out-cubic (`1−(1−p)³`). Format: thousands separators for ≥1000; one decimal if target has decimals. Prefix ($) included from frame zero.

### 7.3 Image parallax
Card images translate vertically by `(cardCenterOffsetFromViewportCenter / viewportHeight) × −26pt`. Image layer is oversized (inset −12% vertical) so edges never show. Updated on scroll via rAF.

### 7.4 Infinite scroll
Sentinel loader 1100pt below viewport bottom triggers the next batch of 4 blocks. Loader: three 5pt dots hopping (staggered 150ms), the hop tinting gold.

### 7.5 Reduced motion
If the OS reduce-motion setting is on: kill ALL animations (entrances, count-ups render final values instantly, ticker becomes static text, parallax off, chart bars full height, pulse rings hidden).

---

## 8. Interstitial Modules (5)

All modules share a header: mono 10pt, letter-spacing +0.26em, uppercase, gold, followed by a hairline rule filling the remaining width. No boxes/backgrounds — open layouts with hairline dividers only.

**8.1 COUNTING DOWN** — live countdown to a scheduled event (Fed decision, earnings, launch). Event name 18.4pt weight 700; below, 4 equal columns (days/hours/min/sec) separated by hairlines: tabular numbers 30–42pt weight 800, mono 9pt uppercase unit labels. Ticks every second. One context line below (market pricing/calendar facts only — never user data).

**8.2 TODAY IN HISTORY** — 3 rows: year (20.8pt weight 800, gold, fixed 64pt column) + event text (14.7pt `ink2`, bold spans `ink`), hairline dividers between rows.

**8.3 IN 10 SECONDS / WHILE YOU SCROLLED** — 3 one-liner briefs: fixed 42pt mono gold prefix tag (EU / OIL / CHIPS…) + 14.9pt text. Two title variants rotate.

**8.4 MARKET PULSE** — 4 equal columns: mono 10pt symbol `ink3`, 18.4pt weight 800 price, mono 10.5pt change (green `#1E7F4F` up / red down with −/+ signs).

**8.5 NUMBER OF THE DAY** — one giant count-up number (58–84pt, `ink`, unit small in gold) + a 14.7pt context sentence with a memorable comparison ("more than the GDP of Denmark").

**Banned module types:** polls, quizzes, anything displaying aggregate user counts. (Low user base — social proof would look fake or empty. Revisit post-traction.)

---

## 9. SwiftUI Implementation Notes

- One `enum CardTemplate` with 9 cases; a `TemplateSelector` class holding the balancer state (§4) owned by the feed view model. Selection happens when items are appended to the feed array, not in the view body (state mutation in body = bugs).
- Entity highlighting: parse `<em>`/`<b>` into `AttributedString` once at decode time, cache on the model.
- Count-up: `TimelineView(.animation)` or a `@State` driven by `withAnimation` + `AnimatableModifier` on a `Double`; format with `Text(value, format: .number)` + `.monospacedDigit()`.
- Parallax: `GeometryReader` inside the image container reading `frame(in: .global).midY` vs screen midY; clamp and apply `offset(y:)`. Keep the image scaled ~1.12 with `.clipped()`.
- Map card: render with `Canvas` (draw graticule, polygons, arc, pins) or pre-generate as a `Path` set. Pulse ring = `Circle().scaleEffect` repeatForever. Polygon coordinate data: copy from the prototype's `LANDS` array.
- Ticker: duplicate the text in an `HStack`, animate `offset(x:)` linearly over 38s, `.repeatForever(autoreverses: false)`.
- Visibility triggers (entrances, count-ups, read counter): `onScrollVisibilityChange` (iOS 18+) or a `GeometryReader`-based visibility helper with the thresholds given (12% entrance, 50% count-up, 55% read counter).
- Read counter persists per session only; do not gamify across days yet.
- Honor `@Environment(\.accessibilityReduceMotion)` everywhere per §7.5.
- Scrim gradients: `LinearGradient` with the exact stops in §5.1 — do not eyeball; bright photos will break text contrast otherwise.

## 10. Acceptance Checklist

1. No two consecutive cards share a template; no two consecutive image cards; never >3 consecutive non-image cards.
2. Breaking stories render as Cover unless that would break the image rhythm.
3. All numbers count up exactly once, never re-animate on scroll-back.
4. No stat ever appears inside a filled box.
5. Map renders offline with no network/map SDK.
6. No UI element anywhere displays aggregate user counts.
7. Reduce Motion produces a fully static, instantly-readable feed.
8. Every card passes WCAG AA contrast (white-on-photo text relies on the specified scrims).
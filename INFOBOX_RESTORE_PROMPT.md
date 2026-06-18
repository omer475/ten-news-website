# Handoff: rebuild the liquid-glass info boxes in the new feed

Paste into a fresh Claude Code terminal. Working dir: `/Users/omersogancioglu/Ten News Website`.

## Background
The site pivoted from a full-screen TikTok pager to a continuous Threads/X-style feed.
The new card is `components/feed/FeedCard.js` (header → image → title → bullets → action row).
It works: the feed loads, scrolls smoothly (windowing via `components/feed/LazyMount.js`,
mount-once), and does not crash. Articles come from Supabase `published_articles` via
`/api/news`; the homepage is `pages/index.js` (~6200 lines), feed rendered by a memoized
`feedCards` list (search `const feedCards = useMemo`).

## The task
Each article can carry **info boxes**: `details`, `timeline`, `map`, `graph` (and rarely
`scorecard`/`recipe`). The ORIGINAL design showed them as **liquid-glass cards**: a small
~85px collapsed "preview" with a glassmorphism background, a row of switcher pills to flip
between available types, and an expand control that grows the box (timeline ~300px, map ~320px,
graph/details ~240px). I (previous terminal) reimplemented these crudely in `FeedCard.js` and
they were WRONG: the Mapbox map blew up to fill the whole screen, and there was no glass styling.
**I have DISABLED them** — in `FeedCard.js` the block now starts `{false && infoTypes.length...}`
(search `Info boxes — TEMPORARILY DISABLED`). The `InfoBox`/`Expandable` helpers below it and the
`availableInfoTypes()` helper (top of file) are my crude versions — replace them.

**Goal:** re-render the info boxes inside `FeedCard.js` so they look and behave like the original
liquid-glass version, correctly sized (NEVER full-screen), performant, and matching the app.

## Where the ORIGINAL implementation lives (copy from here)
File `index.js.bak-pivot` at the repo ROOT — this is the pre-pivot homepage with the full,
correct implementation. Read these ranges:
- **Glass CSS** (the liquid-glass look): lines ~3507–3640 — `.glass-container`, and its children
  `.glass-filter`, `.glass-overlay`, `.glass-specular`, `.glass-content` (backdrop-filter blur,
  layered highlights). Port this CSS into `styles/globals.css` (global, imported in `_app.js`) or
  a CSS module so `FeedCard` can use the same classes.
- **Helper logic**: `getAvailableInformationTypes` (line ~422), `getCurrentInformationType` (~458),
  `switchToNextInformationType` (~472).
- **Switcher pills**: line ~6929–7150 (the row of type buttons; `getAvailableComponentsCount`,
  `.map((infoType) => ...)`, active state).
- **Box rendering** (each with `glass-container` + expand/collapse): Graph ~7602, Timeline ~7728,
  Map ~7886, Details ~8083. Note collapsed heights are 85px, expanded heights 240–320px, with a
  small expand chevron in the corner.
- **Correct `<MapboxMap>` usage**: line ~8010 — props are
  `center={story.map.center || {lat:0,lon:0}}`, `markers={story.map.markers || []}`,
  `expanded={...}`, `highlightColor={accentColor}`, `locationType={story.map.location_type||'auto'}`,
  `regionName={story.map.region_name||null}`, `location={story.map.location||story.map.name||null}`.
  (My bug: I passed a non-existent `map={...}` prop and no height constraint → fullscreen map.)
- **`<GraphChart>` usage**: line ~7703.

## Component interfaces (in `components/`)
- `MapboxMap.js`: `export default function MapboxMap({ center, markers, expanded, highlightColor,
  locationType, regionName, location })`. It creates a `mapboxgl.Map` in an internal container —
  **that container MUST be inside a fixed-height, `overflow:hidden` glass box** (85px collapsed /
  ~240–320px expanded). It will fill its parent, so if the parent has no bounded height it takes the
  whole screen — that was the bug. Import it as `dynamic(() => import('../MapboxMap'), {ssr:false})`.
- `GraphChart.js`: `export default GraphChart({ graph, expanded, accentColor })` (recharts). It is
  already imported in `pages/index.js` via `dynamic(..., {ssr:false})` "to avoid SSR issues" — do the
  SAME in FeedCard (dynamic, ssr:false), don't static-import it.

## Data shapes (verified from live `/api/news`)
- `details`: `Array<{ label, value }>` (often empty `[]`).
- `timeline`: `Array<{ date, event }>` (note `event`, not `text`). null when absent.
- `map`: `{ center:{lat,lon}, markers:[], name, location, region, region_name, location_type }`.
  ~9 of ~590 articles have one.
- `graph`: `{ data:[{date,value}], type:'line'|'bar'|'area'|'column', title, x_label, y_label }`. rare.
- `components`: ordered `Array<'details'|'timeline'|'map'|'graph'|'scorecard'|'recipe'>` (may be null;
  fall back to "whichever fields are present"). Only include a type if its data is actually present.

## CRITICAL constraints
1. **Never let the map (or any box) exceed its bounded height.** Wrap every box in a glass container
   with explicit `height` + `overflow:hidden`. Verify a map article does NOT fill the screen.
2. **Performance**: the feed holds ~590 articles; windowing (`LazyMount`) mounts only near-viewport
   cards. Mapbox GL is heavy and WebGL contexts are limited — STRONGLY prefer rendering the map only
   when its box is the active/expanded one (collapsed = a cheap static placeholder), so you never have
   many live maps at once. Same caution for charts.
3. Keep it client-only safe (the feed renders only on the client; maps via dynamic ssr:false).
4. Match the app's accent color: `FeedCard` computes an `accent` from the hero image — pass it as the
   glass highlight / chart / pin color.

## Build / deploy / test (IMPORTANT — environment gotchas)
- **Build with the LOCAL Next, not npx**: `node_modules/.bin/next build`. (Global `npx next` pulls
  Next 16 and fails on this project's webpack config. If `node_modules` is missing, run `npm ci`.)
- **Deploy** (the repo dir has ~50k untracked junk files and the CLI ignores `.vercelignore`, so a
  normal `vercel` deploy fails with >15000 files). Use a clean git-archive deploy:
  ```
  rm -rf /tmp/cd && mkdir -p /tmp/cd && git archive HEAD | tar -x -C /tmp/cd && cp -r .vercel /tmp/cd/.vercel
  cd /tmp/cd && npx vercel@latest --prod --yes --scope omers-projects-47aba337
  ```
  Production domain is **todayplus.news**. Commit your work first so `git archive HEAD` includes it.
- **Test in a real browser** (the crash/visual bugs only show client-side with real data). System
  Chrome is at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Use puppeteer-core
  (`npm i puppeteer-core` — but DON'T commit it to package.json; keep deploys clean). Pattern: launch
  headless Chrome, `page.goto('https://todayplus.news')`, then
  `localStorage.setItem('todayplus_preferences', JSON.stringify({home_country:'United States',
  followed_topics:['Technology','Business','Science'],onboarding_completed:true,user_id:'p'}))`, reload,
  wait, and check `document.querySelectorAll('article')`, capture `page.on('pageerror')` and console
  errors. For full React error messages + component/hook stacks, run `next dev` and intercept
  `/api/news` to fulfill from a saved prod JSON (real data locally). Example probes exist at /tmp/probe*.js.

## Acceptance criteria
- Info boxes render in the feed with the original liquid-glass look (blurred glass card, layered
  highlights), collapsed ~85px preview + tap-to-expand, switcher pills to flip types.
- A map article shows a SMALL bounded map (never full-screen), correct location.
- Graph/details/timeline render correctly with the article's accent color.
- No crash (no React error boundary "Something went wrong"), feed still scrolls smoothly, no freeze.
- `node_modules/.bin/next build` passes; verified live on todayplus.news via a headless browser check.

## Notes
- Don't touch the Cloud Run / Python pipeline (another terminal owns it).
- The pivot decision: feed is "public by default, personalized when logged in." A separate open item
  is the sign-up paywall after 6 articles (`paywallThreshold` in `pages/index.js`) — leave it unless
  asked.

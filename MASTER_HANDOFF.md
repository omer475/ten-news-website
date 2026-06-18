# MASTER HANDOFF — Today+ website feed (news-platform pivot)

Paste this whole file into a fresh Claude Code terminal. Working dir: `/Users/omersogancioglu/Ten News Website`.
Live site: **todayplus.news**. Vercel project `ten-news-website`, scope `omers-projects-47aba337`.

---

## 0. The single most important open problem
**The user (Omer) reports he STILL cannot scroll the homepage feed.** Automated headless-Chrome tests
(desktop) DO scroll it (~4300px, no errors), so there is a disconnect between my tests and his real
experience. **Your first job is to reproduce on HIS conditions and fix scrolling for real.** Likely causes,
in priority order:
1. **Browser/edge cache** serving an old bundle (there is NO service worker, but check HTTP caching / that
   he hard-reloads / try an incognito window / a different device). Confirm the live bundle hash matches the
   latest deploy.
2. **Touch device** (he views on iOS Simulator / iPhone). My test scrolled via `window.scrollBy` (programmatic),
   which bypasses touch handling. On touch, native scroll can be killed by `touch-action:none` or an
   `onTouchMove`+`preventDefault` on an ancestor. I believe I removed those from the feed path (see §4), but
   VERIFY on a real touch surface (Chrome devtools touch emulation, or Safari iOS). Search index.js for
   `onTouchMove`, `touch-action`, `preventDefault`.
3. **Short feed when logged out**: an anonymous user hits a sign-up paywall after 6 articles
   (`paywallThreshold = 6` in `pages/index.js`), so the page is short. If he means "there's barely anything to
   scroll," removing/raising the paywall (§5) fixes the perception and matches the pivot ("public by default").
4. He may be looking at the **iOS app**, not the website — confirm he's on todayplus.news in a browser.

Get him to tell you: which device/browser, logged in or out, and a screenshot. Then fix.

---

## 1. Project context (the pivot)
Today+ was being built as a text social platform; Omer ABANDONED that and pivoted back to a focused **news
platform**. Going forward only two surfaces run: the **website** (Next.js on Vercel) and the **email
newsletter** (Resend daily digest, already working). The **iOS app is being shut down.** Both read the same
Supabase `published_articles` produced by a Cloud Run pipeline (a SEPARATE terminal owns Cloud Run / Python —
do not touch `*.py`, `rss_sources.py`, `cloudrun_*`). Pivot decision: feed is **public by default,
personalized when logged in**.

## 2. What I did this session
Rebuilt the homepage from a full-screen TikTok pager into a **continuous Threads/X-style scroll feed** that
matches the current iOS app, and then fixed a cascade of bugs. Commits (oldest→newest):
- `0d86c4ac` — replaced the ~2700-line full-screen pager block in `pages/index.js` with a continuous
  `feedCards` list rendering a new `components/feed/FeedCard.js`. Kept paywall + the "Detailed Article Overlay"
  reader (tap a card → opens it).
- `60ace4b9` — unlock page scroll (styled-jsx html/body were `overflow:hidden;touch-action:none`).
- `bb7770dd` / `75ad2597` — windowing via `components/feed/LazyMount.js` (feed holds ~590 articles; rendering
  all at once froze the browser).
- `b2bce867` / `b7480018` — fixed a whole-page crash (React #310 "more hooks than previous render"): the
  `feedCards` useMemo was placed AFTER an early `return` → moved it above all early returns. Added
  `components/feed/CardBoundary.js` (per-card error boundary).
- `bc09c6c0` — **real scroll unlock**: `styles/globals.css` (imported in `_app.js`) had
  `body{overflow-y:hidden;height:100%}` overriding the styled-jsx fix → changed to
  `overflow-y:auto;min-height:100%`.
- `2c2b56d9` — `LazyMount` switched to **mount-once** (never unmount) to stop scroll snap-back (unmounting
  collapsed card heights and yanked scroll back to the top).
- `56d9398b` — **DISABLED the info boxes** (`{false && infoTypes...}` in `FeedCard.js`) because my
  reimplementation rendered the Mapbox map FULL-SCREEN and had no liquid-glass styling.

Current live prod deploy: `ten-news-website-dzw3rbjs3-omers` (verify with `vercel inspect todayplus.news`).

## 3. Current state (verified via headless Chrome)
- Feed loads (~590 articles into `stories`), renders, **no crash**, scrolls in desktop automation.
- **Info boxes are OFF** (disabled) — clean card: header (avatar+source+time) → image → title → ≤3 bullets →
  action row. No maps/charts/timelines right now.
- Anonymous users see 6 cards + a sign-up gate (paywall). Logged-in users get the full feed.

## 4. Architecture / key files & line anchors
- `pages/index.js` (~6200 lines) — the homepage `Home` component.
  - Imports: `FeedCard`, `LazyMount`, `CardBoundary` from `components/feed/`.
  - `const feedCards = useMemo(...)` — builds the list; **must stay ABOVE the `if(!onboardingChecked) return`
    and `if(loading) return` early returns** (Rules of Hooks — this caused the #310 crash).
  - Feed container: `<div style={{ position:'relative', minHeight:'100dvh', ... }}>` (search `100dvh`) — was
    `position:fixed;overflow:hidden;touch-action:none`, now relative/scrollable.
  - Data load: `loadNewsData` (mount `useEffect`, fetches `/api/news?pageSize=2000`); if SSR data exists it does
    a background refresh that replaces stories only if length differs. `getServerSideProps` fetches `pageSize=30`.
  - Paywall: `const paywallThreshold = 6`.
  - Scroll tracker: a `window.addEventListener('scroll', ...)` calls `setMaxScrollPercent` (search it). This
    re-renders `Home` on every scroll — that's WHY `feedCards` is memoized (rebuilding 590 cards per scroll froze
    it). Don't un-memoize.
  - `.story-container` CSS (~line 3760) still has `touch-action:none;overflow:hidden` but is DEAD (no element uses
    that class anymore) — safe, but if you suspect touch issues, confirm nothing re-applies it.
- `components/feed/FeedCard.js` — the card. Self-contained; computes an `accent` color from the hero image.
  The info-box block is disabled (`{false && ...}`) and the `InfoBox`/`availableInfoTypes` helpers in it are my
  crude versions — REPLACE per §6.
- `components/feed/LazyMount.js` — IntersectionObserver, mount-once, `rootMargin:'1200px'`, `overflowAnchor:none`.
- `components/feed/CardBoundary.js` — per-card error boundary.
- `styles/globals.css` — body/html overflow (now auto). Global, wins over styled-jsx.
- `index.js.bak-pivot` (repo ROOT) — the ORIGINAL pre-pivot homepage; source of the liquid-glass info boxes (§6).

## 5. Open item: paywall vs "public by default"
`paywallThreshold = 6` in `pages/index.js` gates anonymous users. The pivot says public-by-default. Ask Omer,
then likely remove/raise it so logged-out visitors get the full feed (a news site must be readable).

## 6. Open item: rebuild the liquid-glass info boxes (currently disabled)
Articles carry `details` / `timeline` / `map` / `graph` (rarely `scorecard`/`recipe`). Restore them as the
ORIGINAL **liquid-glass** cards: small ~85px collapsed preview + switcher pills + tap-to-expand
(timeline ~300px, map ~320px, graph/details ~240px). Copy from `index.js.bak-pivot`:
- Glass CSS ~3507–3640: `.glass-container` + `.glass-filter`/`.glass-overlay`/`.glass-specular`/`.glass-content`
  (port into `styles/globals.css`).
- Helpers: `getAvailableInformationTypes` ~422, `getCurrentInformationType` ~458, `switchToNextInformationType` ~472.
- Switcher pills ~6929; box renders: Graph ~7602, Timeline ~7728, Map ~7886, Details ~8083.
- Correct `<MapboxMap>` usage ~8010.
Component interfaces:
- `components/MapboxMap.js`: `{ center:{lat,lon}, markers:[], expanded, highlightColor, locationType, regionName,
  location }`. **THE BUG I made:** passed a bogus `map=` prop and gave the map no bounded height → it filled the
  whole screen. The map's container MUST sit in a fixed-height `overflow:hidden` glass box. Import dynamic
  `{ssr:false}`. Mapbox GL is heavy + WebGL contexts are limited → render the map ONLY when its box is
  active/expanded (collapsed = cheap static placeholder), so you never have many live maps in the windowed feed.
- `components/GraphChart.js`: `{ graph, expanded, accentColor }` (recharts) — import dynamic `{ssr:false}`.
Data shapes (from live `/api/news`): `details: Array<{label,value}>`; `timeline: Array<{date,event}>` (note
`event` not `text`); `map: {center:{lat,lon}, markers, location, name, region_name, location_type}`;
`graph: {data:[{date,value}], type, title, x_label, y_label}`; `components: ordered string[] | null`.

## 7. Environment / build / deploy / test gotchas (hard-won — follow exactly)
- **Build with LOCAL Next**: `node_modules/.bin/next build`. Global `npx next` pulls Next 16 and FAILS on this
  project's webpack config. If `node_modules` missing: `npm ci` (project is Next 14.2.32, Node 20 expected).
- **Deploying** — the repo dir has ~50k untracked junk files (data dumps, `__pycache__`, `chatgpt-app/`,
  `node_modules`) and the Vercel CLI does NOT honor `.vercelignore`, so a plain `vercel --prod` fails (>15000
  files) and `--archive=tgz` hits transient 500s. **Working method = clean git-archive deploy:**
  ```
  git add -A && git commit -m "..."        # commit first; archive uses committed tree
  rm -rf /tmp/cd && mkdir -p /tmp/cd && git archive HEAD | tar -x -C /tmp/cd && cp -r .vercel /tmp/cd/.vercel
  cd /tmp/cd && npx vercel@latest --prod --yes --scope omers-projects-47aba337
  ```
  Then `vercel inspect todayplus.news --scope omers-projects-47aba337` to confirm the alias points to the new
  deployment. Branch is `claude/carousel-writing-prompts`; todayplus.news does NOT auto-track it, so you MUST
  deploy via CLI.
- **Testing must use a real browser** (the crashes/visual/scroll bugs are client-only with real data). System
  Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. `npm i puppeteer-core` (do NOT commit
  it — keep it out of the deployed package.json). Pattern: launch headless, goto todayplus.news, then
  `localStorage.setItem('todayplus_preferences', JSON.stringify({home_country:'United States',
  followed_topics:['Technology','Business','Science'], onboarding_completed:true, user_id:'p'}))` to bypass the
  onboarding gate, reload, wait ~7s, inspect `document.querySelectorAll('article')`, capture `pageerror`+console.
  **To get FULL React errors** (prod is minified, e.g. "error #310"): run `next dev`, intercept `/api/news` and
  fulfill from a saved prod JSON (so real data renders locally, non-minified → full message + hook table +
  component stack). For TOUCH scroll, use Chrome devtools touch emulation / `page.touchscreen`, not
  `window.scrollBy`. Old probe scripts are at /tmp/probe*.js, /tmp/snap.js, /tmp/dbg.js.

## 8. Acceptance criteria
1. **Omer can scroll the feed on his actual device** (the #1 issue — verify with him, not just automation).
2. Liquid-glass info boxes restored: bounded map (never full-screen), switcher pills, collapse/expand, accent
   colors; no crash; feed still scrolls smoothly; windowing intact.
3. `node_modules/.bin/next build` passes; deployed to todayplus.news and verified live via headless browser
   (no "Something went wrong" boundary, `<article>` elements present, scroll works).
4. Paywall decision applied per Omer.

## 9. Memory
Project memory at `/Users/omersogancioglu/.claude/projects/-Users-omersogancioglu-Ten-News-Website/memory/`,
index `MEMORY.md`. Key file: `project_pivot_news_platform_2026_06_06.md` (full history of this work). The
Cloud-Run/RSS side was handled by another terminal (already done: RSS pruned 481→293, Pipeline 2 stopped).
```

// Exposure (impression) tracking — the "I keep seeing the same articles" fix.
//
// ReadArticleTracker only knows about articles the user OPENED. In the
// continuous-scroll feed most cards are seen but never opened, so nothing
// recorded them and every refresh re-served the same top of the pool. This
// store counts *sightings*: a card ≥55% visible for ~1.5s = one impression
// (recorded by TodayPlusFeed). Ranking then decays an article's effective
// score by 0.5^impressions — seen-but-ignored stories sink fast, yet a truly
// big story can still resurface (decay, not a hard hide).
//
// localStorage: { id: { n: count, ts: lastSeen } }, 24h expiry (matches the
// serving window). Counted at most once per page load.

const STORAGE_KEY = 'tn_seen_impressions';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_COUNTED = 3; // cap the penalty at 0.5^3 = 12.5%

const countedThisLoad = new Set(); // one impression per article per page load

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    // Prune expired entries so the store can't grow unbounded.
    const now = Date.now();
    let dirty = false;
    for (const id of Object.keys(store)) {
      if (!store[id] || now - (store[id].ts || 0) > TTL_MS) { delete store[id]; dirty = true; }
    }
    if (dirty) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return store;
  } catch (_) {
    return {};
  }
}

export function recordImpression(articleId) {
  if (typeof window === 'undefined' || articleId == null) return;
  const id = String(articleId);
  if (countedThisLoad.has(id)) return;
  countedThisLoad.add(id);
  try {
    const store = readStore();
    const prev = store[id]?.n || 0;
    store[id] = { n: Math.min(prev + 1, 9), ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (_) { /* storage unavailable — feed still works, just without decay */ }
}

// { id: impressionCount } for ranking. Cheap enough to read per ranking pass.
export function getExposureCounts() {
  const store = readStore();
  const counts = {};
  for (const [id, v] of Object.entries(store)) counts[id] = v.n || 0;
  return counts;
}

// Multiplier for an article's effective score given its sightings.
export function exposureFactor(count) {
  return Math.pow(0.5, Math.min(count || 0, MAX_COUNTED));
}

// Mark an article READ from a dwell signal (card visible 7s+). Writes the
// same { id: timestamp } store ReadArticleTracker reads, so the existing
// load-time read-filter (24h) excludes it with no extra wiring.
const READ_KEY = 'tennews_read_articles';

export function markSeenRead(articleId) {
  if (typeof window === 'undefined' || articleId == null) return;
  try {
    const raw = localStorage.getItem(READ_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[String(articleId)] = Date.now();
    localStorage.setItem(READ_KEY, JSON.stringify(store));
  } catch (_) {}
}

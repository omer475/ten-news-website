// TodayPlus Feed — template selector + image-rhythm balancer (spec §4),
// implemented exactly per the pseudocode. Runs at feed-assembly time
// (selection depends on neighboring cards, so it cannot be precomputed).

// Special "data" templates — picked ONLY when the story actually carries the
// data they visualize (never for decoration). Probed in priority order. Anything
// that matches none of these falls through to CLASSIC (image-on-top), the
// default for ~80% of cards. COVER is reserved for the hero (position 0) and is
// assigned by the feed, not chosen here. SPLIT is dropped entirely.
const DATA_TEMPLATES = [
  ['map',      (d) => !!(d.geo && d.geo.pins && d.geo.pins.length)],
  ['chart',    (d) => !!(d.trend || d.breakdown || d.ranking)],
  ['stat',     (d) => !!d.big],
  ['line',     (d) => Array.isArray(d.timeline) && d.timeline.length > 0],
  ['score',    (d) => !!d.score],
  ['versus',   (d) => !!d.versus],
  ['receipts', (d) => !!d.receipts],
];
const QUOTE_MIN_GAP = 6; // rationed: ≥6 blocks between quote cards

// --- Per-article template memory ---------------------------------------------
// The selector picks by feed POSITION, and the order jitters between loads —
// so the same article used to come back wearing a different card style every
// refresh, disguising repeats as new content. Remember the first template an
// article gets (24h, matching the serving window) and reuse it on every load.

const TPL_KEY = 'tn_card_templates_v2'; // v2: data-driven selection (image-on-top default)
const TPL_TTL_MS = 24 * 60 * 60 * 1000;
let _tplCache = null; // { id: { t, ts } }

function tplStore() {
  if (_tplCache) return _tplCache;
  if (typeof window === 'undefined') return (_tplCache = {});
  try {
    const raw = localStorage.getItem(TPL_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const id of Object.keys(store)) {
      if (!store[id] || now - (store[id].ts || 0) > TPL_TTL_MS) delete store[id];
    }
    _tplCache = store;
  } catch (_) { _tplCache = {}; }
  return _tplCache;
}

export function rememberedTemplate(articleId) {
  if (articleId == null) return null;
  const e = tplStore()[String(articleId)];
  return e ? e.t : null;
}

const TPL_MAX = 400; // feed assembly walks the whole pool (~1000) — cap the store

export function rememberTemplate(articleId, template) {
  if (typeof window === 'undefined' || articleId == null || !template) return;
  const store = tplStore();
  store[String(articleId)] = { t: template, ts: Date.now() };
  const ids = Object.keys(store);
  if (ids.length > TPL_MAX) {
    ids.sort((a, b) => (store[a].ts || 0) - (store[b].ts || 0));
    for (const id of ids.slice(0, ids.length - TPL_MAX)) delete store[id];
  }
  try { localStorage.setItem(TPL_KEY, JSON.stringify(store)); } catch (_) {}
}

export function createSelector() {
  let lastQuoteIdx = -Infinity;

  return {
    // Data-driven, position-independent: a story shows a special template only
    // when it owns the data for it; otherwise CLASSIC (image on top). The result
    // is uniform — image-on-top almost everywhere, with the few visually distinct
    // cards being the ones that actually display data.
    choose(display, blockIdx) {
      for (const [name, has] of DATA_TEMPLATES) {
        if (has(display)) return name;
      }
      // Quote carries a little content but mostly varies the layout — ration it.
      if (display.quote && blockIdx - lastQuoteIdx >= QUOTE_MIN_GAP) {
        lastQuoteIdx = blockIdx;
        return 'quote';
      }
      return 'classic';
    },

    // Replay a template remembered from a previous load. Cover is hero-only, so
    // a remembered cover anywhere but position 0 is rejected (→ re-choose); the
    // dropped split is likewise rejected. Returns null when the memory shouldn't
    // be honored, telling the caller to re-choose.
    use(design, blockIdx, display) {
      if (design === 'split') return null;
      if (design === 'cover' && blockIdx !== 0) return null;
      if (design === 'quote') lastQuoteIdx = blockIdx;
      return design;
    },

    recordLegacy() {},
  };
}

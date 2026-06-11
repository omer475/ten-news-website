// TodayPlus Feed — template selector + image-rhythm balancer (spec §4),
// implemented exactly per the pseudocode. Runs at feed-assembly time
// (selection depends on neighboring cards, so it cannot be precomputed).

const IMG_DESIGNS = new Set(['cover', 'classic', 'split', 'legacy']);
const ORDER = ['cover', 'classic', 'stat', 'quote', 'receipts', 'versus', 'line', 'split', 'chart', 'map'];

// --- Per-article template memory ---------------------------------------------
// The selector picks by feed POSITION, and the order jitters between loads —
// so the same article used to come back wearing a different card style every
// refresh, disguising repeats as new content. Remember the first template an
// article gets (24h, matching the serving window) and reuse it on every load.

const TPL_KEY = 'tn_card_templates';
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

export function rememberTemplate(articleId, template) {
  if (typeof window === 'undefined' || articleId == null || !template) return;
  const store = tplStore();
  store[String(articleId)] = { t: template, ts: Date.now() };
  try { localStorage.setItem(TPL_KEY, JSON.stringify(store)); } catch (_) {}
}

export function createSelector() {
  const lastUsed = {};          // design -> last block index (default -∞)
  let lastDesign = null;
  let lastWasImage = false;
  let noImgStreak = 0;

  const eligible = (d) =>
    ORDER.filter((design) => {
      switch (design) {
        // cover goes full-bleed — the pipeline's image-quality flag blocks
        // pixelated/mugshot images. Older rows predate the flag (missing =
        // pre-flag era, not rejected); a strict ===true gate erased the cover
        // template from 97% of the feed, so only an explicit false blocks.
        case 'cover': return d.cover_ok !== false;
        case 'split': return true;
        case 'classic': return (d.bullets || []).length >= 2;
        case 'stat': return !!d.big;
        case 'quote': return !!d.quote;
        case 'receipts': return !!d.receipts;
        case 'versus': return !!d.versus;
        case 'line': return Array.isArray(d.timeline) && d.timeline.length > 0;
        case 'chart': return !!(d.trend || d.breakdown || d.ranking);
        case 'map': return !!(d.geo && d.geo.pins && d.geo.pins.length);
        default: return false;
      }
    });

  const record = (design, blockIdx) => {
    lastUsed[design] = blockIdx;
    lastDesign = design;
    lastWasImage = IMG_DESIGNS.has(design);
    noImgStreak = lastWasImage ? 0 : noImgStreak + 1;
  };

  return {
    choose(display, blockIdx) {
      let candidates = eligible(display).filter((c) => c !== lastDesign);
      if (!candidates.length) candidates = ['split'];

      if (lastWasImage) {
        // rule: never 2 image cards in a row
        const nonImg = candidates.filter((c) => !IMG_DESIGNS.has(c));
        if (nonImg.length) candidates = nonImg;
      } else if (noImgStreak >= 3) {
        // rule: force an image after 3 dry cards
        const img = candidates.filter((c) => IMG_DESIGNS.has(c));
        if (img.length) candidates = img;
      }

      if (display.breaking && display.cover_ok !== false && !lastWasImage
          && (lastUsed.cover ?? -Infinity) < blockIdx - 3) {
        // breaking prefers cover, never breaks rhythm (and never with a weak image)
        candidates = ['cover'];
      }

      // least-recently-used → max variety (ties resolve in declared order)
      let pick = candidates[0];
      let best = Infinity;
      for (const c of candidates) {
        const used = lastUsed[c] ?? -Infinity;
        if (used < best) { best = used; pick = c; }
      }

      record(pick, blockIdx);
      return pick;
    },

    // A template remembered from a previous load — record it so the rhythm
    // rules (image spacing, LRU) account for it, without re-choosing.
    use(design, blockIdx) {
      record(design, blockIdx);
      return design;
    },

    // display == null → only the legacy fallback card; it shows the photo,
    // so it still participates in the image rhythm.
    recordLegacy(blockIdx) {
      record('legacy', blockIdx);
    },
  };
}

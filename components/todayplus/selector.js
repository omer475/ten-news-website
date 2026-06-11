// TodayPlus Feed — template selector + image-rhythm balancer (spec §4),
// implemented exactly per the pseudocode. Runs at feed-assembly time
// (selection depends on neighboring cards, so it cannot be precomputed).

const IMG_DESIGNS = new Set(['cover', 'classic', 'split', 'legacy']);
const ORDER = ['cover', 'classic', 'stat', 'quote', 'versus', 'line', 'split', 'chart', 'map'];

export function createSelector() {
  const lastUsed = {};          // design -> last block index (default -∞)
  let lastDesign = null;
  let lastWasImage = false;
  let noImgStreak = 0;

  const eligible = (d) =>
    ORDER.filter((design) => {
      switch (design) {
        // cover goes full-bleed — gated on the pipeline's image-quality flag
        // (pixelated/mugshot images must not be blown up).
        case 'cover': return d.cover_ok === true;
        case 'split': return true;
        case 'classic': return (d.bullets || []).length >= 2;
        case 'stat': return !!d.big;
        case 'quote': return !!d.quote;
        case 'versus': return !!d.versus;
        case 'line': return Array.isArray(d.timeline) && d.timeline.length > 0;
        case 'chart': return !!d.trend;
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

      if (display.breaking && display.cover_ok === true && !lastWasImage
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

    // display == null → only the legacy fallback card; it shows the photo,
    // so it still participates in the image rhythm.
    recordLegacy(blockIdx) {
      record('legacy', blockIdx);
    },
  };
}

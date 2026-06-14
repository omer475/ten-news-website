// TodayPlus Feed — card selector v3 (the planning brain).
//
// Each article resolves to exactly ONE card type. There are two families:
//   • IMAGE cards (photo)        — cover · classic · split  (target ~40%)
//   • DATA cards (no photo, no bullet list, full-frame figure) —
//       stat · quote · chart · map · versus · line(timeline) · score · receipts
//
// There is no composite/switcher card anymore: a module never rides embedded
// under a photo — it gets its own pure card, or it isn't shown on that article.
//
// Per article we derive a `heroRank` (≤2 candidate card types, most-distinctive
// first) plus `heroStrength`. The stateful planner then picks ONE candidate per
// the rhythm rules:
//   1. never the same card type twice in a row (when an alternative exists),
//   2. prefer the type shown LESS recently (spreads quote/chart/map/etc. evenly),
//   3. steer the running image share toward ~40% (proportional nudge).
// heroRank[1] is the variety fallback the rules fall through to.
//
// The backend MAY later emit hero_rank / hero_strength / reserve_pure on the
// display object; we honor them when present and derive them otherwise.

// ── Module detection ─────────────────────────────────────────────────────────

export function modulesOf(d) {
  if (!d) return {};
  return {
    big:      !!d.big,
    quote:    !!d.quote,
    versus:   !!d.versus,
    timeline: Array.isArray(d.timeline) && d.timeline.length > 0,
    chart:    !!(d.trend || d.breakdown || d.ranking),
    map:      !!(d.geo && d.geo.pins && d.geo.pins.length),
    score:    !!d.score,
    receipts: !!d.receipts,
    stats:    Array.isArray(d.stats) && d.stats.length >= 2,
  };
}

// Card-type families.
export const IMAGE_TYPES = new Set(['cover', 'classic', 'split']);
export const DATA_TYPES = new Set(['stat', 'quote', 'chart', 'map', 'versus', 'line', 'score', 'receipts']);

// Module → the pure data card that renders it whole. (`stats` has no own card —
// it never defines a card type; it can only ride a cover/classic chrome, which
// the redesign removed, so a stats-only article falls back to image/split.)
const DATA_TEMPLATE = {
  score: 'score', map: 'map', big: 'stat', versus: 'versus',
  receipts: 'receipts', quote: 'quote', chart: 'chart', timeline: 'line',
};

// Impact order: how distinctive / valuable each module's card is. The article's
// strongest module leads its heroRank.
const IMPACT_ORDER = ['score', 'map', 'big', 'versus', 'receipts', 'quote', 'chart', 'timeline'];

function hasImage(d, story) {
  return !!(d.imageURL || story?.urlToImage);
}

function heroStrengthOf(d, m) {
  if (typeof d.hero_strength === 'number') return d.hero_strength;
  if (d.breaking) return 0.9;
  if (m.score) return 0.92;
  if (m.big) return 0.84;
  if (m.map) return 0.78;
  if (m.versus) return 0.7;
  if (m.quote) return 0.62;
  return 0.5;
}

// ── Candidate card types for one article (≤2, most-distinctive first) ─────────

export function candidatesFor(display, story) {
  const d = display || {};
  const m = modulesOf(d);
  const img = hasImage(d, story);
  const coverOk = img && d.cover_ok !== false;
  const strength = heroStrengthOf(d, m);
  const bullets = (d.bullets || []).length;

  // honor a backend-supplied hero_rank when present (filter to renderable types)
  if (Array.isArray(d.hero_rank) && d.hero_rank.length) {
    const wanted = d.hero_rank
      .map((t) => (DATA_TEMPLATE[t] || (IMAGE_TYPES.has(t) ? t : null)))
      .filter(Boolean)
      .filter((t) => (DATA_TYPES.has(t) ? !!m[Object.keys(DATA_TEMPLATE).find((k) => DATA_TEMPLATE[k] === t)] : img));
    if (wanted.length) return wanted.slice(0, 2);
  }

  const dataTemplates = IMPACT_ORDER.filter((t) => m[t]).map((t) => DATA_TEMPLATE[t]);
  const bestData = dataTemplates[0] || null;
  const secondData = dataTemplates[1] || null;

  // image + a data module → offer BOTH: the distinct data card (redesign intent)
  // and the image card as the variety/balance fallback. A strong breaking story
  // with a cover-grade image leads as the flagship Cover instead.
  if (img && bestData) {
    const imageType = coverOk ? 'cover' : 'classic';
    if (d.breaking && coverOk && strength >= 0.8) return ['cover', bestData];
    return [bestData, imageType];
  }
  // image, no data module → an image card. Cover-grade images can fall back to
  // Classic for variety; a photo + bullets is a Classic; only a thin item with
  // a photo but little text becomes a Split (its compact thumb layout).
  if (img && !bestData) {
    if (coverOk) return ['cover', 'classic'];
    return bullets >= 2 ? ['classic'] : ['split'];
  }
  // no image, but a data module → two data cards (variety fallback), if available.
  if (!img && bestData) {
    return secondData ? [bestData, secondData] : [bestData];
  }
  // no image, no module → the text breath.
  return ['split'];
}

// ── Rhythm-aware planner ─────────────────────────────────────────────────────

const IMAGE_TARGET = 0.40;     // ~40% of cards should be photo cards
const BALANCE_GAIN = 30;       // proportional pull toward the image target
const NEW_TYPE_RECENCY = 40;   // recency credit for a type never shown yet
const FIRST_CHOICE_BUMP = 4;   // small default tiebreak toward heroRank[0]
const BREATH = 'split';        // the only card that renders for ANY article
                               // (thumb if usable, else text-only) — used to
                               // break an otherwise-unavoidable repeat.

export function createPlanner() {
  let lastType = null;
  let shown = 0;
  let imageCount = 0;
  const lastSeen = {};   // type → card index when last shown
  let n = 0;

  const scoreOf = (t, idx, err) => {
    let s = 0;
    const seen = lastSeen[t];
    s += (seen == null) ? NEW_TYPE_RECENCY : (n - seen);   // prefer less recent
    if (idx === 0) s += FIRST_CHOICE_BUMP;                  // default to natural pick
    const isImg = IMAGE_TYPES.has(t);
    s += (isImg ? err : -err) * BALANCE_GAIN;               // steer image share
    return s;
  };

  return {
    plan(display, story) {
      n += 1;
      const cands = candidatesFor(display, story);
      const share = shown ? imageCount / shown : IMAGE_TARGET;
      const err = IMAGE_TARGET - share;   // >0 → need more image cards

      // never the same card type twice in a row: drop the previous type first.
      const eligible = cands.filter((t) => t !== lastType);

      let best;
      if (eligible.length) {
        best = eligible[0];
        let bestScore = -Infinity;
        for (const t of eligible) {
          const s = scoreOf(t, cands.indexOf(t), err);
          if (s > bestScore) { bestScore = s; best = t; }
        }
      } else {
        // this article can only be its repeated type — inject a breath (Split)
        // to break the run; if the run already IS Split (two text-only items
        // back to back), the repeat is unavoidable.
        best = lastType !== BREATH ? BREATH : cands[0];
      }

      shown += 1;
      if (IMAGE_TYPES.has(best)) imageCount += 1;
      lastSeen[best] = n;
      lastType = best;

      return { template: best, isImage: IMAGE_TYPES.has(best) };
    },
  };
}

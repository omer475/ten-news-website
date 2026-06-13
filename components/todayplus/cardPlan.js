// TodayPlus Feed — card selector + compositing v2 (the planning brain).
//
// Resolves each article's `display` object to ONE card plan: either a PURE
// full-frame special (breaking cover / stat-hero / score / quote / versus /
// map / receipts) or a COMPOSITE (image base + one embedded module + a thin
// switcher-pill row for the rest), or a plain Classic / Split "breath".
//
// The backend MAY emit hero_rank / hero_strength / reserve_pure / pure_only on
// display. They are DEFAULTS we honor when present and override for rhythm —
// never mandates. When absent (older rows, or backend not shipped) we derive
// them from the signals that do exist.

// ── Module detection ─────────────────────────────────────────────────────────

export function modulesOf(d) {
  if (!d) return {};
  return {
    stats:    Array.isArray(d.stats) && d.stats.length >= 2,
    big:      !!d.big,
    quote:    !!d.quote,
    versus:   !!d.versus,
    timeline: Array.isArray(d.timeline) && d.timeline.length > 0,
    chart:    !!(d.trend || d.breakdown || d.ranking),
    map:      !!(d.geo && d.geo.pins && d.geo.pins.length),
    score:    !!d.score,
    receipts: !!d.receipts,
  };
}

// Modules that can ride EMBEDDED inside a composite (rendered small,
// light-on-white). A Cover base only embeds stats (the 8-layout set);
// Classic embeds stats / chart / timeline / versus / quote.
export const COVER_EMBEDS = ['stats'];
export const CLASSIC_EMBEDS = ['stats', 'chart', 'timeline', 'versus', 'quote'];

// The pure-special card types — each owns the full frame; never embedded.
export const PURE_TYPES_DEFAULT = ['score', 'receipts', 'map', 'big', 'versus', 'quote', 'cover'];

// Impact order for deriving hero_rank when the backend doesn't supply one.
const IMPACT_ORDER = ['score', 'big', 'versus', 'quote', 'chart', 'timeline', 'map', 'stats'];

// composite shape name from base + embedded module
const SHAPE = {
  cover: { '': 'COVER', stats: 'COVER_STATS' },
  classic: {
    '': 'CLASSIC', stats: 'CLASSIC_STATS', chart: 'CLASSIC_CHART',
    timeline: 'CLASSIC_TIMELINE', versus: 'CLASSIC_VERSUS', quote: 'CLASSIC_QUOTE',
  },
};

// ── Hero metadata (backend override → heuristic default) ─────────────────────

export function deriveHero(d) {
  const m = modulesOf(d);
  const derivedRank = IMPACT_ORDER.filter((t) => m[t]);
  const rank = (Array.isArray(d.hero_rank) && d.hero_rank.length)
    ? d.hero_rank.filter((t) => m[t] || t === 'cover')
    : derivedRank;

  let derivedStrength = 0.5;
  if (d.breaking) derivedStrength = 0.9;
  else if (m.score) derivedStrength = 0.92;
  else if (m.big) derivedStrength = 0.84;
  else if (m.versus) derivedStrength = 0.7;
  else if (m.quote) derivedStrength = 0.62;
  const strength = (typeof d.hero_strength === 'number') ? d.hero_strength : derivedStrength;

  const pureOnly = (Array.isArray(d.pure_only) && d.pure_only.length) ? d.pure_only : PURE_TYPES_DEFAULT;

  const derivedReserve = !!(
    m.score || m.receipts ||
    (d.breaking && d.cover_ok !== false) ||
    (m.big && derivedStrength >= 0.84)
  );
  const reservePure = (typeof d.reserve_pure === 'boolean') ? d.reserve_pure : derivedReserve;

  return { rank, strength, reservePure, pureOnly, modules: m };
}

// Map a hero module type → the pure card template that renders it whole.
const PURE_TEMPLATE = {
  cover: 'cover', big: 'stat', score: 'score', quote: 'quote',
  versus: 'versus', map: 'map', receipts: 'receipts',
};

function hasImage(d, story) {
  return !!(d.imageURL || story?.urlToImage);
}

// ── Natural plan for one article (before rhythm overrides) ────────────────────
// Returns { pure, template, shape, base, hero, switchers, photoLed }.

export function naturalPlan(display, story) {
  const d = display || {};
  const hero = deriveHero(d);
  const m = hero.modules;

  // A1 — PURE special.
  // reserve_pure, OR a strong hero whose top type is pure-only. Also: map /
  // score / receipts / big are ALWAYS pure (not embeddable); breaking with a
  // good image is the flagship Cover.
  const top = hero.rank[0];
  const alwaysPure = m.score || m.receipts || m.map || m.big;
  const breakingCover = d.breaking && d.cover_ok !== false && hasImage(d, story);
  const strongPure = hero.strength >= 0.8 && hero.pureOnly.includes(top);

  if (alwaysPure || hero.reservePure || strongPure || breakingCover) {
    // pick the pure type: prefer the ranked top if it's a pure template,
    // else the strongest always-pure module, else breaking cover.
    let t = null;
    if (breakingCover && (top === 'cover' || !PURE_TEMPLATE[top])) t = 'cover';
    if (!t && PURE_TEMPLATE[top]) t = top;
    if (!t) t = (m.score && 'score') || (m.map && 'map') || (m.big && 'big')
      || (m.receipts && 'receipts') || (m.versus && 'versus') || (m.quote && 'quote')
      || (breakingCover && 'cover') || null;
    if (t) {
      return { pure: true, template: PURE_TEMPLATE[t], shape: `PURE_${t.toUpperCase()}`,
        photoLed: t === 'cover', hero: t, switchers: [] };
    }
  }

  // A2 — COMPOSITE (image base + embedded module).
  if (hasImage(d, story)) {
    // Consider all classic-embeddable modules (richer set). The hero's TYPE
    // picks the base: only `stats` can ride a Cover (COVER_STATS, photo-
    // forward); chart/timeline/versus/quote use a Classic base so they show
    // (CLASSIC_*), even on a cover-quality image.
    const supported = hero.rank.filter((t) => CLASSIC_EMBEDS.includes(t) && m[t]);
    if (supported.length) {
      const heroMod = supported[0];
      const base = (heroMod === 'stats' && d.cover_ok !== false) ? 'cover' : 'classic';
      return {
        pure: false,
        base,
        shape: SHAPE[base][heroMod] || SHAPE[base][''],
        hero: heroMod,
        // a Cover only embeds stats — it carries no switchers (no valid reshape
        // target exists), so the rhythm engine never builds an invalid shape.
        switchers: base === 'cover' ? [] : supported.slice(1),
        photoLed: true,
      };
    }
    // image but no embeddable module → plain photo card (cover if good image)
    const base = d.cover_ok !== false ? 'cover' : 'classic';
    return { pure: false, base, shape: SHAPE[base][''], hero: null, switchers: [], photoLed: true };
  }

  // A3 — no image: Classic (≥2 bullets) or Split breath.
  if ((d.bullets || []).length >= 2) {
    return { pure: false, base: 'classic', shape: 'CLASSIC', hero: null, switchers: [], photoLed: false };
  }
  return { pure: false, base: 'split', shape: 'SPLIT', hero: null, switchers: [], photoLed: false };
}

// ── Rhythm-aware planner ─────────────────────────────────────────────────────
// Wraps naturalPlan with the v2 rhythm engine (§C) + guardrails (§D).

const BREATH_EVERY = 4;            // force a pure-drama / Split breath this often
const MAX_PHOTO_LED_RUN = 3;       // cap consecutive photo-led composites
const PURE_FLOOR_GAP = 9;          // ensure a pure-drama at least this often

export function createPlanner() {
  let lastShape = null;
  let lastHeroModule = null;
  let composHrsSinceBreath = 0;    // composites since the last breath
  let photoLedRun = 0;
  let sinceePure = 0;              // cards since the last pure-drama
  let n = 0;

  const breath = () => {
    // a Split breath is the universal fallback "pattern break"
    return { pure: false, base: 'split', shape: 'SPLIT', hero: null, switchers: [], photoLed: false };
  };

  return {
    plan(display, story) {
      n += 1;
      let p = naturalPlan(display, story);

      // §D degrade: if a composite/cover wants a photo but none exists, the
      // naturalPlan already fell to classic/split — nothing more to do.

      // §C rhythm overrides (only reshape non-pure cards; pure-drama is sacred
      // and counts as its own break).
      if (!p.pure) {
        // cap consecutive photo-led composites → force a breath
        if (p.photoLed && photoLedRun >= MAX_PHOTO_LED_RUN) {
          p = breath();
        }
        // force a breath every BREATH_EVERY composites
        else if (p.shape !== 'SPLIT' && composHrsSinceBreath >= BREATH_EVERY) {
          p = breath();
        }
        // never the same composite shape twice in a row
        else if (p.shape === lastShape && p.shape !== 'SPLIT') {
          // try demoting the hero to the next switcher module (changes shape)
          if (p.switchers.length) {
            const nextHero = p.switchers[0];
            const base = p.base;
            const reshaped = SHAPE[base][nextHero];
            if (reshaped && reshaped !== lastShape) {
              p = { ...p, shape: reshaped, hero: nextHero,
                switchers: [p.hero, ...p.switchers.slice(1)] };
            } else {
              p = breath();
            }
          } else {
            p = breath();
          }
        }
        // never the same embedded module type twice in a row
        else if (p.hero && p.hero === lastHeroModule) {
          const nextHero = p.switchers.find((s) => s && s !== lastHeroModule);
          const reshaped = nextHero ? SHAPE[p.base][nextHero] : null;
          if (reshaped && reshaped !== lastShape) {
            p = { ...p, shape: reshaped, hero: nextHero,
              switchers: [p.hero, ...p.switchers.filter((s) => s !== nextHero)] };
          } else {
            // no valid different-module reshape → take a breath rather than
            // repeat the module (or accidentally repeat the shape).
            p = breath();
          }
        }
      }

      // §D pure-drama floor: if we haven't shown a pure card in a long while
      // and this article CAN be a pure special, let it be (don't reshape it).
      // (naturalPlan already returns pure when warranted; this is a soft nudge
      // recorded for instrumentation.)

      // record state
      if (p.pure) { sinceePure = 0; } else { sinceePure += 1; }
      if (p.shape === 'SPLIT' || p.pure) {
        composHrsSinceBreath = 0;
      } else {
        composHrsSinceBreath += 1;
      }
      photoLedRun = p.photoLed ? photoLedRun + 1 : 0;
      lastShape = p.shape;
      lastHeroModule = p.hero || null;

      return p;
    },
  };
}

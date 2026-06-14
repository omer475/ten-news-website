// TodayPlus Feed — card selector v4 (the planning brain).
//
// TWO independent variety axes per article:
//   1. CONTENT  — what the card is about: an ARTICLE card (headline + bullets/
//      lede) or a DATA card (stat · quote · chart · map · versus · line · score
//      · receipts). Never the same DATA type twice in a row.
//   2. PLACEMENT — where/how the photo sits. This is the big new axis. Never the
//      same placement twice in a row; never two full-bleeds in a row.
//
// Photo placements:
//   ARTICLE cards (photo-forward layouts):
//     full-bleed   — photo is the whole card, headline overlaid (cover_ok only)
//     top-banner   — photo on top, text below (the classic)
//     bottom-anchor— text first, photo underneath
//     inline-window— headline → photo → bullets (photo between text blocks)
//     side-left / side-right — photo beside text (alternating side)
//   DATA cards (photo accents — texture, not competition):
//     wash         — photo ~12% behind the data, accent-tinted
//     strip-above  — thin photo above the figure
//     strip-below  — thin photo below the figure
//     inset        — round cut-out portrait floated by the headline/quote
//   none           — photo-free (deliberate "clean beat")
//
// Target ~60% of cards show a photo somewhere; the rest are clean data beats.
// Treatment follows image_subject (portrait → inset/side; scene → full-bleed/
// banner; object → framed/inline; graphic → never used as a photo).

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
  };
}

const DATA_TEMPLATE = {
  score: 'score', map: 'map', big: 'stat', versus: 'versus',
  receipts: 'receipts', quote: 'quote', chart: 'chart', timeline: 'line',
};
const IMPACT_ORDER = ['score', 'map', 'big', 'versus', 'receipts', 'quote', 'chart', 'timeline'];

export const ARTICLE_PLACEMENTS = ['full-bleed', 'top-banner', 'bottom-anchor', 'inline-window', 'side-left', 'side-right'];
export const DATA_PLACEMENTS = ['wash', 'strip-above', 'strip-below', 'inset'];
export const PHOTO_PLACEMENTS = new Set([...ARTICLE_PLACEMENTS, ...DATA_PLACEMENTS]);
const DATA_TYPES = new Set(Object.values(DATA_TEMPLATE));

function hasImage(d, story) { return !!(d.imageURL || story?.urlToImage); }
function subjectOf(d) {
  const s = d.image_subject;
  return (s === 'portrait' || s === 'scene' || s === 'object' || s === 'graphic') ? s : 'scene';
}
// a graphic "photo" IS a chart screenshot — never use it as a real photo.
function usablePhoto(d, story) { return hasImage(d, story) && subjectOf(d) !== 'graphic'; }

// ── Content candidates (ARTICLE and/or a DATA type), most-distinctive first ───

export function contentCandidatesFor(display, story) {
  const d = display || {};
  const m = modulesOf(d);
  const dataRanked = IMPACT_ORDER.filter((t) => m[t]).map((t) => DATA_TEMPLATE[t]);
  const bestData = dataRanked[0] || null;
  const secondData = dataRanked[1] || null;
  const img = hasImage(d, story);
  const bullets = (d.bullets || []).length;
  const canArticle = img || bullets >= 2;

  const cands = [];
  if (bestData) cands.push(bestData);
  if (canArticle) cands.push('article');
  if (secondData) cands.push(secondData);   // variety fallback for module-rich, image-less items
  if (!cands.length) cands.push('article');  // last resort (text breath)
  return cands;
}

// order article placements by what suits the photo subject
function orderArticlePlacements(opts, subject) {
  const pref = {
    portrait: ['side-left', 'side-right', 'full-bleed', 'top-banner', 'inline-window', 'bottom-anchor'],
    scene:    ['full-bleed', 'top-banner', 'bottom-anchor', 'inline-window', 'side-right', 'side-left'],
    object:   ['inline-window', 'top-banner', 'bottom-anchor', 'side-left', 'side-right', 'full-bleed'],
  }[subject] || ARTICLE_PLACEMENTS;
  return [...opts].sort((a, b) => pref.indexOf(a) - pref.indexOf(b));
}

export function placementsFor(content, display, story) {
  const d = display || {};
  const photo = usablePhoto(d, story);
  const subject = subjectOf(d);
  const coverOk = photo && d.cover_ok !== false;

  if (content === 'article') {
    if (!photo) return ['none'];                       // text-only article card
    let opts = coverOk ? [...ARTICLE_PLACEMENTS] : ARTICLE_PLACEMENTS.filter((p) => p !== 'full-bleed');
    return orderArticlePlacements(opts, subject);
  }
  // data content: photo-free clean beat OR a subtle accent
  const opts = ['none'];
  if (photo) {
    opts.push('strip-above', 'strip-below', 'wash');
    // inset = a round portrait the quote wraps around (spec: "portrait-inset
    // quote"). Quote only — a floated cut-out would crowd the stat-hero number.
    if (subject === 'portrait' && content === 'quote') opts.unshift('inset');
  }
  return opts;
}

// ── Rhythm-aware planner ─────────────────────────────────────────────────────

const PHOTO_TARGET = 0.60;
const ARTICLE_TARGET = 0.50;     // ~half article cards, ~half data cards
const BALANCE_GAIN = 26;         // content (article/data) steer
const PHOTO_GAIN = 44;           // photo-share steer — stronger so we reach ~60%
const RECENCY_NEW = 30;
const FIRST_BUMP = 4;
const MAX_PHOTO_RUN = 3;         // force a clean beat after 3 photo cards
const MAX_NONE_RUN = 1;          // after 1 clean beat, show a photo if one's available

export function createPlanner() {
  let lastContent = null;        // 'article' or a data template
  let lastPlacement = null;
  let lastDataType = null;
  let shown = 0;
  let photoCount = 0;
  let articleCount = 0;
  let photoRun = 0;
  let noneRun = 0;
  let lastSide = null;           // alternate side-left / side-right
  const seenContent = {};
  const seenPlacement = {};
  let n = 0;

  const pickBest = (opts, scorer) => {
    let best = opts[0];
    let bestScore = -Infinity;
    for (let i = 0; i < opts.length; i += 1) {
      const s = scorer(opts[i], i);
      if (s > bestScore) { bestScore = s; best = opts[i]; }
    }
    return best;
  };

  return {
    plan(display, story) {
      n += 1;

      // ── 1. CONTENT ──────────────────────────────────────────────
      const contentCands = contentCandidatesFor(display, story);
      // never the same DATA type twice in a row (article may repeat — placement
      // varies it). If the ONLY candidate is the just-used data type, fall back
      // to a bare article beat rather than repeat (ArticleCard renders headline-
      // only when there's no photo/bullets).
      let contentElig = contentCands.filter((c) => !(DATA_TYPES.has(c) && c === lastDataType));
      if (!contentElig.length) contentElig = ['article'];
      const artShare = shown ? articleCount / shown : ARTICLE_TARGET;
      const artErr = ARTICLE_TARGET - artShare;
      const content = pickBest(contentElig, (c, i) => {
        let s = 0;
        const seen = seenContent[c];
        s += (seen == null) ? RECENCY_NEW : (n - seen);
        if (i === 0) s += FIRST_BUMP;
        const isArticle = c === 'article';
        s += (isArticle ? artErr : -artErr) * BALANCE_GAIN;
        return s;
      });

      // ── 2. PLACEMENT ────────────────────────────────────────────
      let placeOpts = placementsFor(content, display, story);
      const photoOpts = placeOpts.filter((p) => p !== 'none');
      const hasNone = placeOpts.includes('none');

      // hard rules: never same placement (non-none) twice; never two full-bleeds;
      // cap photo / clean-beat runs to keep the mix.
      let elig = placeOpts.filter((p) => !(PHOTO_PLACEMENTS.has(p) && p === lastPlacement));
      if (photoRun >= MAX_PHOTO_RUN && hasNone) elig = ['none'];                  // force a clean beat
      else if (noneRun >= MAX_NONE_RUN && photoOpts.length) elig = elig.filter((p) => p !== 'none'); // force a photo
      // fallback must still never re-admit the previous placement (incl. full-
      // bleed) when any alternative exists — only a true single-option article
      // (e.g. no-photo data → 'none') may repeat.
      if (!elig.length) {
        elig = placeOpts.filter((p) => p !== lastPlacement);
        if (!elig.length) elig = placeOpts;
      }

      const photoShare = shown ? photoCount / shown : PHOTO_TARGET;
      const photoErr = PHOTO_TARGET - photoShare;
      const placement = pickBest(elig, (p, i) => {
        let s = 0;
        const seen = seenPlacement[p];
        s += (seen == null) ? RECENCY_NEW : (n - seen);
        if (i === 0) s += FIRST_BUMP;                       // honor subject-preferred order
        const isPhoto = PHOTO_PLACEMENTS.has(p);
        s += (isPhoto ? photoErr : -photoErr) * PHOTO_GAIN;
        // alternate sides so two side-by-sides (if ever adjacent across a gap) differ
        if ((p === 'side-left' && lastSide === 'left') || (p === 'side-right' && lastSide === 'right')) s -= 5;
        return s;
      });

      // ── record ──────────────────────────────────────────────────
      const isPhoto = PHOTO_PLACEMENTS.has(placement);
      shown += 1;
      if (isPhoto) { photoCount += 1; photoRun += 1; noneRun = 0; } else { noneRun += 1; photoRun = 0; }
      if (content === 'article') articleCount += 1;
      if (DATA_TYPES.has(content)) lastDataType = content;
      if (placement === 'side-left') lastSide = 'left';
      else if (placement === 'side-right') lastSide = 'right';
      seenContent[content] = n;
      seenPlacement[placement] = n;
      lastContent = content;
      lastPlacement = placement;

      return {
        mode: content === 'article' ? 'article' : 'data',
        template: content === 'article' ? null : content,
        placement,
        photo: isPhoto,
        subject: subjectOf(display || {}),
      };
    },
  };
}

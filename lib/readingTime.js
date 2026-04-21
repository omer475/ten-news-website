// Reading-time helpers.
//
// Mobile reading average is ~230 wpm (Brysbaert 2019; Nielsen Norman Group).
// expected_read_seconds is computed once per article and stored in
// published_articles.expected_read_seconds so feed/track code can derive
// read_fraction = view_seconds / expected_read_seconds without having to
// re-parse the article body on every event.

const WORDS_PER_SECOND = 230 / 60; // 3.833
const MIN_EXPECTED = 5;
const MAX_EXPECTED = 600;

function pushText(bucket, value) {
  if (!value) return;
  if (typeof value === 'string') { bucket.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) pushText(bucket, v); return; }
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) pushText(bucket, value[k]);
  }
}

export function extractArticleText(article) {
  const parts = [];
  pushText(parts, article?.title_news);
  pushText(parts, article?.title);
  pushText(parts, article?.summary_bullets_news);
  pushText(parts, article?.summary_bullets);
  pushText(parts, article?.details);
  pushText(parts, article?.detailed_text);
  pushText(parts, article?.body);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function wordCount(text) {
  if (!text) return 0;
  const cleaned = String(text)
    .replace(/\*\*/g, ' ')
    .replace(/[#*_`>~\[\]()]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const matches = cleaned.match(/\S+/g);
  return matches ? matches.length : 0;
}

export function expectedReadSeconds(wc) {
  if (!wc || wc <= 0) return MIN_EXPECTED;
  const raw = Math.round(wc / WORDS_PER_SECOND);
  return Math.max(MIN_EXPECTED, Math.min(MAX_EXPECTED, raw));
}

export function expectedReadSecondsForArticle(article) {
  if (article?.expected_read_seconds && Number.isFinite(article.expected_read_seconds)) {
    return Math.max(MIN_EXPECTED, Math.min(MAX_EXPECTED, article.expected_read_seconds));
  }
  return expectedReadSeconds(wordCount(extractArticleText(article)));
}

// read_fraction buckets — used to decide reward magnitude in analytics/track.
// Below 0.15: the user bounced before they could have absorbed the first point.
// 0.15-0.4: skimmed the opener. 0.4-0.8: partial read. 0.8-1.2: full read.
// Above 1.2: re-read / deep dwell.
export function classifyReadFraction(fraction) {
  if (!Number.isFinite(fraction) || fraction <= 0) return 'none';
  if (fraction < 0.15) return 'bounce';
  if (fraction < 0.4) return 'skim';
  if (fraction < 0.8) return 'partial';
  if (fraction < 1.2) return 'full';
  return 'deep';
}

// read_fraction-derived multiplier for entity-signal and bandit reward magnitudes.
// Returns 0 for "this swipe was after a deep read" (don't penalize) up to 2.5x for
// genuine bounces. Layered on top of Fix M's dwellSignal in track.js — Fix M sets
// the *direction* (positive vs negative); this scales the *magnitude* by how much
// of the article the user actually consumed relative to its length. A 3 s skip on
// a 3-sentence card and a 3 s skip on a 400-word longform are both "skips" to Fix M
// but the longform skip is the real negative; this distinction matters once
// articles vary in length.
export function readFractionPenaltyScale(viewSeconds, expected) {
  const fraction = (expected > 0 && viewSeconds >= 0) ? viewSeconds / expected : 0;
  const label = classifyReadFraction(fraction);
  if (label === 'bounce') return 2.5;
  if (label === 'skim') return 1.2;
  if (label === 'partial') return 0.5;
  if (label === 'full') return 0.1;   // basically not a skip at all
  if (label === 'deep') return 0.0;
  return 1.0;
}

export function readFractionEngageScale(viewSeconds, expected) {
  const fraction = (expected > 0 && viewSeconds >= 0) ? viewSeconds / expected : 0;
  const label = classifyReadFraction(fraction);
  if (label === 'deep') return 2.5;
  if (label === 'full') return 1.5;
  if (label === 'partial') return 0.8;
  if (label === 'skim') return 0.3;
  if (label === 'bounce') return 0.0;
  return 1.0;
}

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

// Skip-penalty multiplier. A bounce on a 3-sentence card should not count as
// a full skip — and a "skip" with 10 s dwell on a 5 s card is actually a full
// read that happens to have been swiped away. Scale the magnitude of the
// negative signal by how much of the expected-read the user completed.
export function skipPenaltyWeight(viewSeconds, expected) {
  const fraction = (expected > 0 && viewSeconds >= 0) ? viewSeconds / expected : 0;
  const label = classifyReadFraction(fraction);
  if (label === 'bounce') return 2.5;   // aggressive: sharpens skip signal
  if (label === 'skim') return 1.2;
  if (label === 'partial') return 0.5;
  if (label === 'full') return 0.1;     // basically not a skip at all
  if (label === 'deep') return 0.0;
  return 1.0;
}

// Positive-reward multiplier for engagements. Scales with how much was read.
export function engageRewardWeight(viewSeconds, expected) {
  const fraction = (expected > 0 && viewSeconds >= 0) ? viewSeconds / expected : 0;
  const label = classifyReadFraction(fraction);
  if (label === 'deep') return 2.5;
  if (label === 'full') return 1.5;
  if (label === 'partial') return 0.8;
  if (label === 'skim') return 0.3;
  if (label === 'bounce') return 0.0;
  return 1.0;
}

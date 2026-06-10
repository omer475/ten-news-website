// Must-know classification helper
// Two paths to must-know:
//   1. Globally important: base_score >= 900 (important for everyone)
//   2. Locally critical for THIS user: base >= 600 AND home_country_relevance >= 80
//      AND final >= 900. Only nationally critical stories (relevance 80+) from the
//      user's home country can break through. Capped at 5 local articles.
export const MUST_KNOW_THRESHOLD = 900;
export const LOCAL_MUST_KNOW_FINAL_MIN = 900;
export const LOCAL_MUST_KNOW_MIN_BASE = 600;
export const LOCAL_MUST_KNOW_MIN_RELEVANCE = 80;
export const LOCAL_MUST_KNOW_MAX = 5;

export function isArticleMustKnow(article) {
  if (!article) return false;
  const base = article.base_score || article.final_score || 0;
  // Path 1: Globally important (high AI score alone)
  if (base >= MUST_KNOW_THRESHOLD) return true;
  // Path 2 is checked via markLocalMustKnow() after sorting — not here
  return article.isLocalMustKnow || false;
}

// The Must Know rail's candidate floor. Only ~5 stories/day clear base>=900, so
// a strict rail shows the SAME five all day ("I keep seeing the same article").
// >=850 gives ~50 distinct stories to rotate through while staying important.
export const MUST_KNOW_RAIL_MIN = 850;

// Select the stories shown in the Must Know rail: the day's most important
// stories, ONE per story (cluster), ROTATED per load so refreshing surfaces a
// different, still-important subset instead of the same fixed few.
export function selectMustKnowRail(stories, count = 6) {
  const news = (stories || []).filter((s) => s && s.type === 'news');
  if (!news.length) return [];

  // Widen the pool so there's something to rotate; fall back to top-by-score.
  let pool = news.filter((s) => (s.base_score || s.final_score || 0) >= MUST_KNOW_RAIL_MIN);
  if (pool.length < count) {
    pool = news.slice()
      .sort((a, b) => (b.final_score || 0) - (a.final_score || 0))
      .slice(0, Math.max(count * 3, 18));
  }

  // One article per story (cluster) so the rail isn't 4 versions of one event.
  const seen = new Set();
  const deduped = [];
  for (const s of pool) {
    const c = s.vq_secondary;
    if (c !== null && c !== undefined) { if (seen.has(c)) continue; seen.add(c); }
    deduped.push(s);
  }

  // Weight-shuffle by importance: bigger stories appear more often, but the set
  // genuinely rotates between loads (Math.random recomputes each load).
  return deduped
    .map((s) => {
      const imp = s.base_score || s.final_score || 0;
      const noise = 1 + (Math.random() * 2 - 1) * 0.25;
      return { s, k: imp * noise };
    })
    .sort((a, b) => b.k - a.k)
    .slice(0, count)
    .map((x) => x.s);
}

// Mark top local must-know articles (called after personalization + sorting)
export function markLocalMustKnow(articles) {
  let localCount = 0;
  for (const article of articles) {
    if (localCount >= LOCAL_MUST_KNOW_MAX) break;
    if (article.type) continue; // skip non-article items
    const base = article.base_score || article.final_score || 0;
    const final = article.final_score || 0;
    const homeRel = article.home_country_relevance || 0;
    if (base >= LOCAL_MUST_KNOW_MIN_BASE && final >= LOCAL_MUST_KNOW_FINAL_MIN && homeRel >= LOCAL_MUST_KNOW_MIN_RELEVANCE) {
      article.isLocalMustKnow = true;
      localCount++;
    }
  }
  return localCount;
}

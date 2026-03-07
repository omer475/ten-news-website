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

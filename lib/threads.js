// Memory Threads — shared thread-computation helpers.
//
// A "thread" is an evolving story the user can pick back up: the new article
// they're looking at is a fresh development on something they read before.
//
// DEFINITION (validated against prod data, 2026-06-09):
//   Two articles belong to the same thread when they
//     (1) share the same `vq_secondary` semantic cluster, AND
//     (2) share >= MIN_SHARED_TAGS *specific* interest_tags.
//
// Why both? `vq_secondary` alone is a semantic NEIGHBOURHOOD, not a story —
// it nails hard news (Kyiv strikes, a Stanley Cup final) but on soft topics it
// just buckets loosely-related items (random recipes, unrelated NFL roster
// moves). Requiring a specific-tag overlap tightens that neighbourhood down to
// the actual story, and naturally refuses to thread distinct items that merely
// share a topic. interest_tags is 100% populated and granular
// (["nato","kyiv","ukraine"], ["trpm8 receptor","thermoreceptors"]), so this
// works across EVERY category — tech (a new iOS), science (a physics result),
// sports, world — not just geopolitics.
//
// Precision over recall on purpose: a subtle "continues from what you read"
// indicator is only valuable if it's almost always right. Better to miss a
// thread than to claim a false one.

// Category-level / generic tags carry no story identity — drop them before
// measuring overlap so "two science articles" never counts as a thread.
const GENERIC_TAGS = new Set([
  'science', 'health', 'geopolitics', 'conflicts', 'politics', 'world',
  'business', 'sports', 'sport', 'technology', 'tech', 'food', 'food_industry',
  'cooking', 'recipes', 'entertainment', 'climate', 'finance', 'economy',
  'economics', 'culture', 'general', 'news', 'breaking', 'other', 'lifestyle',
  'travel', 'education', 'opinion', 'analysis', 'markets', 'media', 'gaming',
  'auto', 'automotive', 'crime', 'law', 'weather', 'environment',
]);

const MIN_SHARED_TAGS = 2;

// interest_tags arrives as a jsonb array, a JSON string, or already-parsed array.
// Return a lowercased Set of specific (non-generic) tags.
export function specificTagSet(interestTags) {
  let arr = interestTags;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return new Set();
  const out = new Set();
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().toLowerCase();
    if (!t || GENERIC_TAGS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function sharedCount(setA, setB) {
  let n = 0;
  // iterate the smaller set
  const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const t of small) if (big.has(t)) n++;
  return n;
}

// Normalise a published_articles row into the minimal thread descriptor.
//   { id, vq, tags:Set, title, recap, date, url, score }
export function toThreadItem(row) {
  let bullets = row.summary_bullets_news;
  if (typeof bullets === 'string') {
    try { bullets = JSON.parse(bullets); } catch { bullets = []; }
  }
  const recap = Array.isArray(bullets) && bullets.length ? String(bullets[0]) : null;
  return {
    id: String(row.id),
    vq: row.vq_secondary,
    tags: specificTagSet(row.interest_tags),
    title: row.title_news || row.title || null,
    recap,
    date: row.published_at || row.created_at || null,
    url: row.url || null,
    score: typeof row.ai_final_score === 'number' ? row.ai_final_score : 0,
  };
}

// Do anchor and candidate belong to the same thread?
export function sameThread(anchor, candidate) {
  if (!anchor || !candidate) return false;
  if (anchor.id === candidate.id) return false;
  if (anchor.vq == null || candidate.vq == null) return false;
  if (anchor.vq !== candidate.vq) return false;
  return sharedCount(anchor.tags, candidate.tags) >= MIN_SHARED_TAGS;
}

// Build a short human label for a thread from the most-shared specific tags.
// e.g. ["kyiv","russia","ukraine"] -> "Kyiv · Russia · Ukraine".
export function threadLabelFromItems(anchor, items) {
  const freq = new Map();
  const bump = (set) => { for (const t of set) freq.set(t, (freq.get(t) || 0) + 1); };
  bump(anchor.tags);
  for (const it of items) bump(it.tags);
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([t]) => t.replace(/\b\w/g, (c) => c.toUpperCase()));
  return top.join(' · ') || null;
}

export const THREAD_WINDOW_DAYS = 30;
export const THREAD_MAX_ITEMS = 8;
export { MIN_SHARED_TAGS, GENERIC_TAGS };

// Topic Bundles — group recent news into named "story bundles" (a header +
// 2-4 articles), cleaned, de-duplicated, and ranked for the user.
//
// Source = world_events (they already carry clean human names like "Chip Stock
// Plunge", "Ebola Outbreak in Congo"). But raw event membership is noisy, so we:
//   1. CLEAN — drop articles that don't share the bundle's dominant tags
//      (removes mis-tagged outliers, e.g. an Israel article in a "NEET-UG" event).
//   2. DEDUPE — merge heavily-overlapping events (the Middle-East situation is
//      currently split across ~5 near-duplicate events); keep the strongest.
//   3. CAP — 2-4 articles each, drop bundles with < MIN_ARTICLES clean articles.
//   4. RANK — always surface the biggest stories, then fill by user relevance.

import { specificTagSet } from './threads';

export const MIN_ARTICLES = 2;
export const MAX_ARTICLES = 4;

function parseBullets(b) {
  if (Array.isArray(b)) return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return []; } }
  return [];
}

// Normalise a joined (event + article) row into a bundle article.
function toArticle(row) {
  const bullets = parseBullets(row.summary_bullets_news);
  return {
    id: String(row.article_id ?? row.id),
    title: (row.title_news || row.title || '').replace(/\*\*/g, ''),
    recap: bullets.length ? String(bullets[0]).replace(/\*\*/g, '') : null,
    score: typeof row.ai_final_score === 'number' ? row.ai_final_score : 0,
    tags: specificTagSet(row.interest_tags),
    image: row.image_url || null,
    url: row.url || null,
    category: row.category || null,
    date: row.published_at || row.created_at || null,
    countries: Array.isArray(row.countries) ? row.countries : [],
  };
}

// Group joined rows into bundles keyed by event.
export function groupByEvent(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.event_id;
    if (!map.has(key)) {
      map.set(key, { id: String(key), header: r.event_name, slug: r.event_slug || null, articles: [], _seen: new Set() });
    }
    const b = map.get(key);
    const a = toArticle(r);
    if (b._seen.has(a.id)) continue;
    b._seen.add(a.id);
    b.articles.push(a);
  }
  return [...map.values()];
}

// The tags that define a bundle: those shared by a meaningful share of its
// articles (so a single mis-tagged outlier can't define the bundle).
function dominantTags(articles) {
  const freq = new Map();
  for (const a of articles) for (const t of a.tags) freq.set(t, (freq.get(t) || 0) + 1);
  const threshold = Math.max(2, Math.ceil(articles.length * 0.3));
  const dom = new Set();
  for (const [t, n] of freq) if (n >= threshold) dom.add(t);
  // Fallback: if nothing clears the bar (small bundles), take the top few tags.
  if (!dom.size) {
    [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([t]) => dom.add(t));
  }
  return dom;
}

function sharedCount(setA, setB) {
  let n = 0;
  const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const t of small) if (big.has(t)) n++;
  return n;
}

const HEADER_STOP = new Set([
  'the', 'of', 'in', 'on', 'and', 'to', 'for', 'at', 'as', 'an', 'is', 'are',
  'news', 'update', 'updates', 'latest', 'report', 'reports', 'story', 'crisis',
  'amid', 'over', 'after', 'new', 'talks', 'deal', 'plan',
]);

// Significant words from a bundle's header (its event name), normalised.
function headerTokens(name) {
  return (name || '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !HEADER_STOP.has(w))
    .map((w) => w.replace(/s$/, ''));
}

// Does a tag relate to the header (loose singular/substring match, len-guarded)?
function tagMatchesHeader(tag, tokens) {
  const t = String(tag).replace(/s$/, '');
  return tokens.some((tok) => t === tok || (t.length >= 4 && tok.length >= 4 && (t.includes(tok) || tok.includes(t))));
}

// Clean one bundle: keep only articles that match the bundle's HEADER topic, and
// drop the whole bundle if its articles don't actually match its name (a heavily
// mis-tagged event like an "AI Discovery" event full of Iran-missile articles).
export function cleanBundle(bundle) {
  if (bundle.articles.length < MIN_ARTICLES) return null;
  const dom = dominantTags(bundle.articles);
  const tokens = headerTokens(bundle.header);
  // Core = dominant tags that actually correspond to the header.
  const core = new Set([...dom].filter((t) => tagMatchesHeader(t, tokens)));
  if (!core.size) return null; // header and content disagree -> incoherent, drop
  const kept = bundle.articles.filter((a) => a.tags.size > 0 && sharedCount(a.tags, core) >= 1);
  if (kept.length < MIN_ARTICLES) return null;
  // coreTags = header-aligned (coherence/dedupe); topicTags = the bundle's full
  // descriptive tags (e.g. "semiconductors", "nvidia") used for personalization.
  return {
    ...bundle,
    coreTags: core,
    topicTags: dominantTags(kept),
    articles: kept,
    importance: Math.max(...kept.map((a) => a.score)),
  };
}

// Loose interest match: equal, or a meaningful substring either way.
function fuzzyHas(set, tag) {
  if (set.has(tag)) return true;
  for (const s of set) {
    if (s.length >= 4 && tag.length >= 4 && (s.includes(tag) || tag.includes(s))) return true;
  }
  return false;
}

// Merge heavily-overlapping bundles (same underlying story split across events).
// Greedy: keep strongest first; drop a later bundle that shares most of its
// dominant tags OR many articles with one already kept.
export function dedupeBundles(bundles) {
  const sorted = [...bundles].sort((a, b) => b.importance - a.importance);
  const kept = [];
  for (const b of sorted) {
    const dup = kept.find((k) => {
      // Merge on shared descriptive topic (collapses the 5 near-duplicate
      // Middle-East events) or on shared articles.
      const topicOverlap = sharedCount(b.topicTags, k.topicTags);
      const coreOverlap = sharedCount(b.coreTags, k.coreTags);
      const ids = new Set(k.articles.map((a) => a.id));
      const artOverlap = b.articles.filter((a) => ids.has(a.id)).length / b.articles.length;
      return topicOverlap >= 2 || coreOverlap >= 1 || artOverlap >= 0.4;
    });
    if (!dup) kept.push(b);
  }
  return kept;
}

// Finalise a bundle's article list: drop read ones, sort by score+recency, cap.
function finalizeArticles(bundle, readIds) {
  const now = Date.now();
  const fresh = bundle.articles
    .filter((a) => !readIds.has(a.id))
    .map((a) => {
      const t = a.date ? new Date(a.date).getTime() : 0;
      const ageH = t ? Math.max(0, (now - t) / 3600000) : 48;
      return { a, eff: a.score * Math.pow(0.5, ageH / 12) };
    })
    .sort((x, y) => y.eff - x.eff)
    .map((x) => x.a);
  // If too many were read, fall back to including read ones so the bundle survives.
  const pool = fresh.length >= MIN_ARTICLES ? fresh
    : bundle.articles.slice().sort((a, b) => b.score - a.score);
  return pool.slice(0, MAX_ARTICLES);
}

// Rank bundles: always surface the biggest stories, then fill by user relevance.
//   user = { interests:Set, topics:Set, country:string }
export function rankBundles(bundles, user, { limit = 6, majors = 2 } = {}) {
  const country = (user.country || '').toLowerCase();
  const withScores = bundles.map((b) => {
    let personal = 0;
    const matched = [];
    for (const t of b.topicTags) {
      if (fuzzyHas(user.interests, t)) { personal += 2; matched.push(t); }
      else if (fuzzyHas(user.topics, t)) { personal += 1; matched.push(t); }
      if (country && (t === country || t.includes(country))) personal += 2;
    }
    return { ...b, personal, matched };
  });

  const byImportance = [...withScores].sort((a, b) => b.importance - a.importance);
  const result = [];
  const usedIds = new Set();

  // 1) The biggest stories everyone should see.
  for (const b of byImportance.slice(0, majors)) {
    result.push({ ...b, isMajor: true });
    usedIds.add(b.id);
  }
  // 2) Fill the rest by personal relevance, then importance.
  const rest = withScores
    .filter((b) => !usedIds.has(b.id))
    .sort((a, b) => (b.personal - a.personal) || (b.importance - a.importance));
  for (const b of rest) {
    if (result.length >= limit) break;
    result.push({ ...b, isMajor: false });
    usedIds.add(b.id);
  }
  return result.slice(0, limit);
}

// --- Personal, warm bundle headers ------------------------------------------
//
// The raw event names ("Israel-Palestine Conflict", "OpenAI IPO Filing") read
// like a wire desk. Rewrite them to feel like a friend catching you up
// ("What's going on with OpenAI", "The latest from Israel and Gaza"). Uses a
// fast model, batched (one call for all bundles), and cached per event in a
// module-level map so warm lambdas don't re-call the model for the same events.

const HEADER_MODEL = 'gemini-2.5-flash';
const _headerCache = new Map(); // eventId -> { header, ts }
const HEADER_TTL_MS = 2 * 3600 * 1000;

export async function personalizeHeaders(bundles, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : 0;
  // Use cache where fresh; collect the rest for one batched generation.
  const need = [];
  for (const b of bundles) {
    const c = _headerCache.get(b.id);
    if (c && now && (now - c.ts) < HEADER_TTL_MS) b.header = c.header;
    else need.push(b);
  }
  if (!need.length) return bundles;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return bundles; // no key -> keep raw event names

  const list = need.map((b, i) => {
    const ex = b.articles.slice(0, 2).map((a) => `"${(a.title || '').replace(/\*\*/g, '').slice(0, 70)}"`).join('; ');
    return `${i + 1}. [${b.header}] examples: ${ex}`;
  }).join('\n');

  const prompt = `You write short, warm section titles for a news app's topic
groups — like a friend catching someone up, NOT a formal headline. For each
topic, write ONE title: conversational, 2-6 words, no ending period, no quotes.
Vary the phrasing across these styles: "What's going on with X", "The latest
from X", "Keeping up with X", "News on X", "Where things stand with X",
"X, explained". Keep the subject unmistakable.

Topics:
${list}

Return ONLY JSON: {"headers": ["title 1", "title 2", ...]} with exactly ${need.length} items in the same order.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${HEADER_MODEL}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // thinkingBudget:0 — this is a trivial rewrite; without it 2.5-flash's
        // thinking tokens eat the output budget and truncate the JSON array.
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!resp.ok) return bundles;
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    let parsed; try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    const headers = parsed?.headers;
    if (Array.isArray(headers)) {
      need.forEach((b, i) => {
        const h = typeof headers[i] === 'string' ? headers[i].trim().replace(/^["']|["']$/g, '') : '';
        if (h) { b.header = h; if (now) _headerCache.set(b.id, { header: h, ts: now }); }
      });
    }
  } catch { /* keep raw names on failure */ }
  return bundles;
}

// Shape a bundle for the API response.
export function shapeBundle(b, readIds) {
  const articles = finalizeArticles(b, readIds).map((a) => ({
    id: a.id, title: a.title, recap: a.recap, image: a.image,
    url: a.url, category: a.category, date: a.date,
  }));
  return {
    id: b.id,
    header: b.header,
    slug: b.slug,
    importance: b.importance,
    isMajor: !!b.isMajor,
    matchedInterests: b.matched || [],
    articles,
  };
}

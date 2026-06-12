import { getExposureCounts, getEventExposureCounts, exposureFactor } from './exposure';

// Tags too broad to mean "same topic" — a shared 'politics' tag must not
// penalize two unrelated political stories the way two 'spacex' tags should.
// (Exported: userInterests also excludes these from the interest boost, so a
// heavy 'politics' weight can't lift an entire category.)
export const BROAD_TAGS = new Set([
  'politics', 'world news', 'world', 'sports', 'technology', 'tech',
  'business', 'finance', 'science', 'health', 'entertainment', 'culture',
  'economy', 'government', 'news', 'breaking news', 'us', 'usa', 'europe',
]);

function specificTags(article, max = 6) {
  const t = article.interest_tags;
  const list = Array.isArray(t) ? t : [];
  const out = [];
  for (const raw of list) {
    const tag = String(raw || '').toLowerCase().trim();
    if (tag && !BROAD_TAGS.has(tag)) out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Diversity pass over an effective-score-ordered list (spec: one card per
 * STORY, no topic walls). Greedy walk of the top of the feed:
 *   - EVENT CAP: only the best article of each world event is kept up top —
 *     the pipeline publishes many tellings of the same story (new ids), which
 *     used to re-serve "the same article in a different style".
 *   - TAG-OVERLAP PENALTY: each specific tag already placed multiplies later
 *     candidates sharing it by `tagPenalty` — caps any topic family at ~2-3
 *     cards per screen without hard rules.
 * Only the top `depth` items get the careful treatment (the tail is below
 * the fold); event-capped siblings drop behind the diversified head.
 */
function diversifyHead(scored, { depth = 150, tagPenalty = 0.65 } = {}) {
  if (scored.length <= 2) return scored;
  const head = scored.slice(0, depth);
  const tail = scored.slice(depth);

  const placed = [];
  const displaced = [];
  const usedEvents = new Set();
  const tagSeen = new Map(); // tag -> times placed
  const pool = [...head];

  while (pool.length) {
    // Pick the candidate with the best ADJUSTED score under current state.
    let bestIdx = -1;
    let bestAdj = -Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const c = pool[i];
      const evId = c.article.world_event?.id;
      if (evId != null && usedEvents.has(String(evId))) continue; // capped
      let overlap = 0;
      for (const tag of c.tags) overlap += Math.min(tagSeen.get(tag) || 0, 1);
      const adj = c.effective * Math.pow(tagPenalty, Math.min(overlap, 3));
      if (adj > bestAdj) { bestAdj = adj; bestIdx = i; }
    }
    if (bestIdx === -1) {
      // everything left is an event-capped sibling — they go after the head
      displaced.push(...pool);
      break;
    }
    const picked = pool.splice(bestIdx, 1)[0];
    placed.push(picked);
    const evId = picked.article.world_event?.id;
    if (evId != null) usedEvents.add(String(evId));
    for (const tag of picked.tags) tagSeen.set(tag, (tagSeen.get(tag) || 0) + 1);
  }

  return [...placed, ...displaced, ...tail];
}

/**
 * Article Sorting Utilities
 *
 * Sorts articles by score (descending) with date-based tie-breaking.
 * Used to ensure users always see the highest-quality content first.
 * 
 * Sorting Logic:
 * 1. Primary: Sort by final_score (highest first)
 * 2. Secondary: If scores are equal, sort by published date (most recent first)
 * 
 * Example:
 * Article A: Score 95, Date: Nov 12, 2025 10:00 AM
 * Article B: Score 95, Date: Nov 12, 2025 09:00 AM  
 * Article C: Score 87, Date: Nov 12, 2025 11:00 AM
 * 
 * Result Order: A (95, newest), B (95, older), C (87)
 */

/**
 * Get timestamp from article's date field
 * Handles multiple date formats and missing dates
 * 
 * @param {Object} article - Article object
 * @returns {number} Unix timestamp in milliseconds
 */
function getArticleTimestamp(article) {
  // Try to get date from various possible fields
  const dateValue = article.publishedAt || article.published_at || article.added_at;
  
  if (!dateValue) {
    console.warn('⚠️ Article missing date:', article.id || article.title);
    return 0; // Articles without dates go to the end
  }
  
  // If already a number (Unix timestamp)
  if (typeof dateValue === 'number') {
    // Check if seconds or milliseconds (timestamps after year 2000 in seconds are > 946684800)
    return dateValue > 10000000000 ? dateValue : dateValue * 1000;
  }
  
  // If string or Date object, parse it
  try {
    const date = new Date(dateValue);
    const timestamp = date.getTime();
    
    if (isNaN(timestamp)) {
      console.warn('⚠️ Invalid date format:', dateValue, 'for article:', article.id || article.title);
      return 0;
    }
    
    return timestamp;
  } catch (error) {
    console.error('❌ Error parsing date:', error, 'for article:', article.id || article.title);
    return 0;
  }
}

/**
 * Sort articles by score (descending) and date (descending for ties)
 * 
 * @param {Array} articles - Array of article objects with 'final_score' and date properties
 * @returns {Array} New sorted array (original array is not modified)
 * 
 * Usage:
 * const sorted = sortArticlesByScore(articles);
 * 
 * Properties used:
 * - final_score: Numeric score (higher is better)
 * - publishedAt / published_at / added_at: Date/timestamp
 */
export function sortArticlesByScore(articles) {
  // Handle edge cases
  if (!articles) {
    console.warn('⚠️ sortArticlesByScore: articles is null/undefined');
    return [];
  }
  
  if (!Array.isArray(articles)) {
    console.error('❌ sortArticlesByScore: Expected array, got:', typeof articles);
    return [];
  }
  
  if (articles.length === 0) {
    console.log('📊 sortArticlesByScore: Empty array, nothing to sort');
    return [];
  }
  
  console.log(`📊 Sorting ${articles.length} articles by score...`);
  
  // Create a copy to avoid mutating the original array
  const sortedArticles = [...articles];
  
  sortedArticles.sort((a, b) => {
    // Handle missing scores - default to 0
    const scoreA = typeof a.final_score === 'number' ? a.final_score : 0;
    const scoreB = typeof b.final_score === 'number' ? b.final_score : 0;
    
    // Primary sort: by score (highest first)
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Descending order
    }
    
    // Secondary sort: by date (most recent first)
    const dateA = getArticleTimestamp(a);
    const dateB = getArticleTimestamp(b);
    return dateB - dateA; // Descending order (recent first)
  });
  
  // Log results for debugging
  if (sortedArticles.length > 0) {
    console.log('📊 Sorting complete! Top 5 articles:');
    const top5 = sortedArticles.slice(0, 5).map((article, idx) => ({
      rank: idx + 1,
      score: article.final_score ?? 'N/A',
      title: article.title?.substring(0, 50) + '...' || 'No title',
      date: article.publishedAt || article.published_at || article.added_at || 'N/A'
    }));
    console.table(top5);
  }
  
  return sortedArticles;
}

/**
 * Recency-weighted "fresh + important" ranking with light per-load variety.
 *
 * WHY THIS EXISTS:
 * Pure score ordering (sortArticlesByScore / rankArticles' must-know pin) makes the
 * feed DETERMINISTIC and FROZEN: the single highest-scored article of the day stays
 * at #1 for the whole 24h window, so the feed looks identical on every refresh and
 * brand-new articles get buried below older high-scored ones. For a news platform
 * that is wrong — recency matters and the feed should visibly refresh through the day.
 *
 * This applies, as the FINAL ranking step, an effective score:
 *
 *     effective = importance * timeDecay(ageHours) * (1 ± jitter)
 *
 *   - importance: the article's already-computed score. We prefer _personalizedScore
 *     (set by rankArticles when the user has reading interests) and fall back to
 *     final_score (which already includes country/topic preference boosts). So
 *     freshness composes WITH personalization rather than throwing it away.
 *   - timeDecay: exponential half-life. A story's weight halves every HALF_LIFE_HOURS,
 *     so an important-but-aging story gradually yields to fresher news but never drops
 *     to zero inside the window. With halfLifeHours=8: a 4h-old score-935 story
 *     (935*0.71=661) ranks BELOW a brand-new score-700 story (700*1.0=700) — exactly
 *     the "fresh + important blend" behaviour.
 *   - jitter: a small symmetric multiplier so articles with near-equal effective scores
 *     swap order between loads. This is what makes the feed "change as you refresh"
 *     without scrambling the quality ordering (±6% only reshuffles close neighbours).
 *
 * Determinism note: jitter uses Math.random at call time, so every call produces a
 * (slightly) different order. Compare article MEMBERSHIP, not order, when deciding
 * whether to re-render the feed — see the background-refresh guard in pages/index.js.
 *
 * @param {Array} articles - news articles (final_score / _personalizedScore + a date)
 * @param {Object} [opts]
 * @param {number} [opts.halfLifeHours=8] - hours for importance weight to halve
 * @param {number} [opts.jitter=0.18] - max ± fraction of random reordering noise.
 *   At 0.18 the top tier visibly reshuffles between loads so the feed doesn't
 *   look frozen, while staying bounded (a low-score article can't leap to #1).
 *   Was 0.06 — too weak to notice, so the feed felt identical on every refresh.
 * @returns {Array} New array ordered by effective (fresh + important) score, desc
 */
export function applyFreshness(articles, { halfLifeHours = 8, jitter = 0.18 } = {}) {
  if (!Array.isArray(articles) || articles.length <= 1) return articles || [];

  const now = Date.now();
  const STALE_AGE_HOURS = 48; // articles with no usable date are treated as old

  // Exposure decay: articles the user already SAW this 24h window (card ≥55%
  // visible for ~1.5s, recorded by TodayPlusFeed) halve per sighting — and so
  // does every other article of the SAME world event, because the pipeline
  // keeps publishing fresh tellings of one story (new id, zero impressions)
  // that used to re-serve "the same article in a different card style".
  // Decay (not a hard hide) so a truly big story can still resurface.
  // Client-only; on the server both maps are empty.
  let exposure = {};
  let eventExposure = {};
  if (typeof window !== 'undefined') {
    try { exposure = getExposureCounts(); } catch (_) {}
    try { eventExposure = getEventExposureCounts(); } catch (_) {}
  }

  const scored = articles.map((article) => {
    const importance =
      typeof article._personalizedScore === 'number'
        ? article._personalizedScore
        : (typeof article.final_score === 'number'
            ? article.final_score
            : (typeof article.ai_final_score === 'number' ? article.ai_final_score : 0));

    const ts = getArticleTimestamp(article);
    const ageHours = ts > 0 ? Math.max(0, (now - ts) / 3600000) : STALE_AGE_HOURS;
    const timeDecay = Math.pow(0.5, ageHours / halfLifeHours);
    const noise = 1 + (Math.random() * 2 - 1) * jitter; // scale by [1-jitter, 1+jitter]
    const seen = exposureFactor(exposure[String(article.id)] || 0);
    const evId = article.world_event?.id;
    const seenStory = evId != null ? exposureFactor(eventExposure[String(evId)] || 0) : 1;

    return {
      article,
      tags: specificTags(article),
      effective: importance * timeDecay * noise * seen * seenStory,
    };
  });

  scored.sort((a, b) => b.effective - a.effective);
  return diversifyHead(scored).map((s) => s.article);
}

/**
 * Check if articles need sorting (for optimization)
 * Returns true if articles are not already sorted by score
 *
 * @param {Array} articles - Array of article objects
 * @returns {boolean} True if sorting is needed
 */
export function needsSorting(articles) {
  if (!articles || articles.length <= 1) return false;
  
  for (let i = 0; i < articles.length - 1; i++) {
    const currentScore = articles[i].final_score ?? 0;
    const nextScore = articles[i + 1].final_score ?? 0;
    
    if (currentScore < nextScore) {
      return true; // Found out-of-order articles
    }
  }
  
  return false;
}

// Debug helpers for browser console
if (typeof window !== 'undefined') {
  window.debugSorting = {
    /**
     * Show top N articles with their scores and dates
     */
    showTopArticles: (n = 10) => {
      // This will be populated by the main page component
      console.log('ℹ️ This function needs to be called from the page context');
      console.log('ℹ️ Try: debugSorting.testSorting() to see a demo');
    },
    
    /**
     * Test sorting with sample data
     */
    testSorting: () => {
      console.log('🧪 Testing sorting with sample data...\n');
      
      const testArticles = [
        { id: 1, final_score: 95, publishedAt: '2025-11-12T10:00:00Z', title: 'Article A - High score, recent' },
        { id: 2, final_score: 95, publishedAt: '2025-11-12T09:00:00Z', title: 'Article B - High score, older' },
        { id: 3, final_score: 87, publishedAt: '2025-11-12T11:00:00Z', title: 'Article C - Lower score' },
        { id: 4, final_score: 92, publishedAt: '2025-11-12T08:00:00Z', title: 'Article D - Medium score' },
        { id: 5, final_score: 95, publishedAt: '2025-11-12T11:00:00Z', title: 'Article E - High score, newest' }
      ];
      
      console.log('Before sorting:');
      console.table(testArticles.map(a => ({ 
        title: a.title, 
        score: a.final_score, 
        date: a.publishedAt 
      })));
      
      const sorted = sortArticlesByScore(testArticles);
      
      console.log('\nAfter sorting:');
      console.table(sorted.map(a => ({ 
        title: a.title, 
        score: a.final_score, 
        date: a.publishedAt 
      })));
      
      console.log('\n✅ Expected order: E (95, newest), A (95, middle), B (95, oldest), D (92), C (87)');
      console.log('✅ Actual order:', sorted.map(a => a.title.split(' - ')[0]).join(', '));
    },
    
    /**
     * Test edge cases
     */
    testEdgeCases: () => {
      console.log('🧪 Testing edge cases...\n');
      
      const edgeCases = [
        { id: 1, final_score: 90, publishedAt: '2025-11-12T10:00:00Z', title: 'Normal article' },
        { id: 2, publishedAt: '2025-11-12T11:00:00Z', title: 'Missing score' },
        { id: 3, final_score: 85, title: 'Missing date' },
        { id: 4, title: 'Missing both' },
        { id: 5, final_score: 100, publishedAt: 'invalid-date', title: 'Invalid date' }
      ];
      
      console.log('Test data:');
      console.table(edgeCases);
      
      try {
        const sorted = sortArticlesByScore(edgeCases);
        console.log('\n✅ Sorting handled edge cases successfully!');
        console.table(sorted.map(a => ({ 
          title: a.title, 
          score: a.final_score ?? 'N/A', 
          date: a.publishedAt ?? 'N/A' 
        })));
      } catch (error) {
        console.error('❌ Sorting failed:', error);
      }
    },
    
    /**
     * Check if current articles are sorted
     */
    checkIfSorted: () => {
      console.log('ℹ️ This function needs to be called from the page context');
      console.log('ℹ️ It will be available after the page loads');
    }
  };
  
  console.log('🐛 Sorting debug tools available: window.debugSorting');
  console.log('   Try: debugSorting.testSorting()');
  console.log('   Try: debugSorting.testEdgeCases()');
}

export default sortArticlesByScore;


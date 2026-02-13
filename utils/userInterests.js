/**
 * User Interests Manager
 * Handles personalization by tracking user interests and ranking articles
 * 
 * Storage: localStorage for real-time + Supabase for persistence
 */

const INTERESTS_KEY = 'tennews_interests';
const INTERESTS_SYNCED_KEY = 'tennews_interests_synced_at';
const ARTICLES_READ_KEY = 'tennews_articles_read_count';
const DECAY_DAYS = 30; // Interests decay after 30 days of inactivity

/**
 * Get articles read count from localStorage
 * @returns {number} Total articles read with 10+ seconds engagement
 */
export function getArticlesReadCount() {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(ARTICLES_READ_KEY) || '0', 10);
  } catch (e) {
    return 0;
  }
}

/**
 * Increment articles read count
 */
export function incrementArticlesRead() {
  if (typeof window === 'undefined') return;
  try {
    const current = getArticlesReadCount();
    localStorage.setItem(ARTICLES_READ_KEY, String(current + 1));
  } catch (e) {
    console.warn('[interests] Error incrementing articles read:', e);
  }
}

/**
 * Get user interests from localStorage
 * @returns {Object} Map of keyword -> weight
 */
export function getUserInterests() {
  if (typeof window === 'undefined') return {};
  
  try {
    const raw = localStorage.getItem(INTERESTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[interests] Error reading interests:', e);
    return {};
  }
}

/**
 * Save user interests to localStorage
 * @param {Object} interests - Map of keyword -> weight
 */
export function saveUserInterests(interests) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(INTERESTS_KEY, JSON.stringify(interests));
  } catch (e) {
    console.warn('[interests] Error saving interests:', e);
  }
}

/**
 * Update user interests based on article engagement
 * @param {Array<string>} tags - Article's interest_tags
 * @param {number} engagementWeight - Weight multiplier (default 1.0)
 *   - View only: 0.5
 *   - 10+ seconds: 1.0
 *   - 30+ seconds: 1.5
 *   - Source click: 2.0
 */
export function updateInterests(tags, engagementWeight = 1.0) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return;
  
  const interests = getUserInterests();
  
  for (const tag of tags) {
    if (!tag || typeof tag !== 'string') continue;
    
    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag) continue;
    
    // Increase weight (with diminishing returns for very high weights)
    const currentWeight = interests[normalizedTag] || 0;
    const addedWeight = engagementWeight * (1 / (1 + currentWeight * 0.1)); // Diminishing returns
    interests[normalizedTag] = Math.min(100, currentWeight + addedWeight); // Cap at 100
  }
  
  saveUserInterests(interests);
  console.log('[interests] Updated interests:', Object.keys(interests).slice(0, 5));
  
  return interests;
}

/**
 * Score an article based on user interests
 * @param {Object} article - Article with interest_tags
 * @param {Object} interests - User interests (optional, will fetch if not provided)
 * @returns {number} Personalization score boost
 */
export function getArticlePersonalizationScore(article, interests = null) {
  if (!article?.interest_tags || article.interest_tags.length === 0) return 0;
  
  interests = interests || getUserInterests();
  if (Object.keys(interests).length === 0) return 0;
  
  let boost = 0;
  for (const tag of article.interest_tags) {
    const normalizedTag = (tag || '').toLowerCase().trim();
    if (interests[normalizedTag]) {
      boost += interests[normalizedTag];
    }
  }
  
  return boost;
}

/**
 * Rank articles based on user interests + base score
 * IMPORTANT: Must-know articles (score >= 900) stay at top in original order
 * Personalization only re-ranks the lower-importance articles
 * 
 * @param {Array<Object>} articles - Array of articles with interest_tags
 * @param {number} personalizationWeight - How much to weight personalization (0-1)
 * @param {number} mustKnowThreshold - Score threshold for must-know articles (default 900)
 * @returns {Array<Object>} Sorted articles
 */
export function rankArticles(articles, personalizationWeight = 0.7, mustKnowThreshold = 900) {
  if (!articles || articles.length === 0) return articles;
  
  const interests = getUserInterests();
  const hasInterests = Object.keys(interests).length > 0;
  
  // DEBUG: Log all article scores to diagnose the issue
  console.log('[interests] 📊 ALL ARTICLE SCORES BEFORE RANKING:');
  articles.slice(0, 10).forEach((a, i) => {
    const base = a.base_score || a.final_score || a.ai_final_score || 0;
    const final = a.final_score || a.ai_final_score || 0;
    console.log(`  ${i+1}. Base: ${base} | Final: ${final} | "${a.title?.substring(0, 40)}..."`);
  });
  
  // Separate must-know articles from regular articles
  // IMPORTANT: Use base_score (original AI score) NOT final_score (which includes preference boosts)
  // This prevents preference-boosted articles from being falsely classified as must-know
  const mustKnowArticles = articles.filter(a => {
    const score = a.base_score || a.final_score || a.ai_final_score || 0;
    return score >= mustKnowThreshold;
  });

  const regularArticles = articles.filter(a => {
    const score = a.base_score || a.final_score || a.ai_final_score || 0;
    return score < mustKnowThreshold;
  });
  
  console.log(`[interests] ✅ ${mustKnowArticles.length} MUST-KNOW (base_score >= ${mustKnowThreshold})`);
  console.log(`[interests] 📰 ${regularArticles.length} REGULAR (base_score < ${mustKnowThreshold})`);
  
  // Must-know articles: Keep original base score order (no personalization)
  mustKnowArticles.sort((a, b) => {
    const scoreA = a.base_score || a.final_score || a.ai_final_score || 0;
    const scoreB = b.base_score || b.final_score || b.ai_final_score || 0;
    return scoreB - scoreA;
  });
  
  // Regular articles: Apply personalization if user has interests
  let sortedRegular = regularArticles;
  
  if (hasInterests && regularArticles.length > 0) {
    // Score and sort regular articles with personalization
    const scored = regularArticles.map(article => {
      const baseScore = article.final_score || article.ai_final_score || 500;
      const personalizationBoost = getArticlePersonalizationScore(article, interests);
      
      // Combine scores: base score + personalization boost (weighted)
      const combinedScore = baseScore + (personalizationBoost * 10 * personalizationWeight);
      
      return {
        ...article,
        _personalizedScore: combinedScore,
        _personalizationBoost: personalizationBoost
      };
    });
    
    // Sort regular articles by combined score (descending)
    scored.sort((a, b) => b._personalizedScore - a._personalizedScore);
    sortedRegular = scored;
    
    console.log('[interests] Personalized regular articles, top 3 boosts:', 
      scored.slice(0, 3).map(a => ({ 
        title: a.title?.substring(0, 30), 
        boost: a._personalizationBoost?.toFixed(1) 
      }))
    );
  }
  
  // Combine: Must-know first, then personalized regular articles
  return [...mustKnowArticles, ...sortedRegular];
}

/**
 * Decay old interests (reduce weights for interests not updated recently)
 * Call this periodically (e.g., on app load)
 */
export function decayOldInterests() {
  const interests = getUserInterests();
  if (Object.keys(interests).length === 0) return;
  
  // Apply 10% decay to all interests
  let decayed = false;
  for (const key of Object.keys(interests)) {
    if (interests[key] > 0.1) {
      interests[key] *= 0.95; // 5% decay
      decayed = true;
    } else {
      delete interests[key]; // Remove negligible interests
    }
  }
  
  if (decayed) {
    saveUserInterests(interests);
    console.log('[interests] Applied decay, remaining:', Object.keys(interests).length);
  }
}

/**
 * Sync interests to Supabase for cross-device persistence
 * @param {string} accessToken - Supabase access token
 */
export async function syncInterestsToSupabase(accessToken) {
  if (!accessToken || typeof window === 'undefined') return;
  
  const interests = getUserInterests();
  const articlesReadCount = getArticlesReadCount();
  
  if (Object.keys(interests).length === 0 && articlesReadCount === 0) return;
  
  try {
    const response = await fetch('/api/user/interests/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ 
        interests,
        articles_read_count: articlesReadCount
      }),
      keepalive: true
    });
    
    if (response.ok) {
      localStorage.setItem(INTERESTS_SYNCED_KEY, new Date().toISOString());
      console.log('[interests] Synced to Supabase');
    }
  } catch (e) {
    console.warn('[interests] Sync failed:', e);
  }
}

/**
 * Load interests from Supabase (for new device/session)
 * @param {string} accessToken - Supabase access token
 */
export async function loadInterestsFromSupabase(accessToken) {
  if (!accessToken || typeof window === 'undefined') return;
  
  try {
    const response = await fetch('/api/user/interests', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.interests && Object.keys(data.interests).length > 0) {
        // Merge with local (local takes precedence for recent interactions)
        const local = getUserInterests();
        const merged = { ...data.interests, ...local };
        saveUserInterests(merged);
        console.log('[interests] Loaded from Supabase, merged:', Object.keys(merged).length);
      }
    }
  } catch (e) {
    console.warn('[interests] Load from Supabase failed:', e);
  }
}

/**
 * Get engagement weight based on interaction type
 * ONLY count meaningful engagement (10+ seconds)
 * @param {string} eventType - The type of engagement event
 * @param {Object} metadata - Event metadata
 * @returns {number} Weight multiplier (0 = don't count)
 */
export function getEngagementWeight(eventType, metadata = {}) {
  switch (eventType) {
    case 'article_view':
      return 0; // DON'T count quick views - wait for engagement
      
    case 'article_engaged':
      return 1.0; // 10+ seconds confirmed
      
    case 'article_exit':
      const seconds = metadata.total_active_seconds || 0;
      const scroll = metadata.max_scroll_percent || 0;
      // ONLY count if 10+ seconds OR significant scroll
      if (seconds < 10 && scroll < 30) return 0; // Ignore quick swipes
      if (seconds >= 60) return 3.0; // Very deep read (1+ minute)
      if (seconds >= 30) return 2.0; // Deep read (30+ seconds)
      if (seconds >= 10) return 1.0; // Good engagement (10+ seconds)
      if (scroll >= 50) return 1.0; // Read more than half
      return 0; // Brief view - don't count
      
    case 'source_click':
      return 3.0; // High intent - clicked to read original article
      
    case 'article_shared':
      return 5.0; // Highest weight - user found it worth sharing!
      
    case 'component_click':
      return 0; // Don't count component clicks alone
      
    default:
      return 0;
  }
}

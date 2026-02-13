/**
 * TodayPlus Personalization System
 * Constants, countries, topics, and scoring engine
 */

// ==========================================
// COUNTRIES LIST (15 Total)
// ==========================================
export const COUNTRIES = [
  // Major Powers
  { code: 'usa', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}', region: 'major' },
  { code: 'uk', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', region: 'major' },
  { code: 'china', name: 'China', flag: '\u{1F1E8}\u{1F1F3}', region: 'major' },
  { code: 'russia', name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}', region: 'major' },

  // Europe
  { code: 'germany', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', region: 'europe' },
  { code: 'france', name: 'France', flag: '\u{1F1EB}\u{1F1F7}', region: 'europe' },
  { code: 'spain', name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', region: 'europe' },
  { code: 'italy', name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', region: 'europe' },
  { code: 'ukraine', name: 'Ukraine', flag: '\u{1F1FA}\u{1F1E6}', region: 'europe' },
  { code: 'turkiye', name: 'T\u00FCrkiye', flag: '\u{1F1F9}\u{1F1F7}', region: 'europe' },

  // Asia
  { code: 'india', name: 'India', flag: '\u{1F1EE}\u{1F1F3}', region: 'asia' },
  { code: 'japan', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', region: 'asia' },

  // Middle East
  { code: 'israel', name: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', region: 'middle_east' },

  // Americas
  { code: 'canada', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', region: 'americas' },

  // Oceania
  { code: 'australia', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', region: 'oceania' },
];

// ==========================================
// TOPICS LIST (29 Total)
// ==========================================
export const TOPICS = [
  // Business & Finance (4)
  { code: 'economics', name: 'Economics', icon: '\u{1F4B0}', category: 'business' },
  { code: 'stock_markets', name: 'Stock Markets', icon: '\u{1F4C8}', category: 'business' },
  { code: 'banking', name: 'Banking & Finance', icon: '\u{1F3E6}', category: 'business' },
  { code: 'startups', name: 'Startups', icon: '\u{1F3E2}', category: 'business' },
  
  // Technology (5)
  { code: 'ai', name: 'Artificial Intelligence', icon: '\u{1F916}', category: 'tech' },
  { code: 'tech_industry', name: 'Tech Industry', icon: '\u{1F4BB}', category: 'tech' },
  { code: 'consumer_tech', name: 'Consumer Tech', icon: '\u{1F4F1}', category: 'tech' },
  { code: 'cybersecurity', name: 'Cybersecurity', icon: '\u{1F510}', category: 'tech' },
  { code: 'space', name: 'Space & Aerospace', icon: '\u{1F680}', category: 'tech' },
  
  // Science & Health (4)
  { code: 'science', name: 'Science', icon: '\u{1F52C}', category: 'science' },
  { code: 'climate', name: 'Climate & Environment', icon: '\u{1F30D}', category: 'science' },
  { code: 'health', name: 'Health & Medicine', icon: '\u2695\uFE0F', category: 'science' },
  { code: 'biotech', name: 'Biotech', icon: '\u{1F9EC}', category: 'science' },
  
  // Politics & World (4)
  { code: 'politics', name: 'Politics', icon: '\u{1F3DB}\uFE0F', category: 'politics' },
  { code: 'geopolitics', name: 'Geopolitics', icon: '\u{1F310}', category: 'politics' },
  { code: 'conflicts', name: 'Conflicts & Wars', icon: '\u2694\uFE0F', category: 'politics' },
  { code: 'human_rights', name: 'Human Rights', icon: '\u{1F4DC}', category: 'politics' },
  
  // Sports (8)
  { code: 'football', name: 'Football (Soccer)', icon: '\u26BD', category: 'sports' },
  { code: 'american_football', name: 'American Football', icon: '\u{1F3C8}', category: 'sports' },
  { code: 'basketball', name: 'Basketball', icon: '\u{1F3C0}', category: 'sports' },
  { code: 'tennis', name: 'Tennis', icon: '\u{1F3BE}', category: 'sports' },
  { code: 'f1', name: 'Formula 1', icon: '\u{1F3CE}\uFE0F', category: 'sports' },
  { code: 'cricket', name: 'Cricket', icon: '\u{1F3CF}', category: 'sports' },
  { code: 'combat_sports', name: 'Combat Sports', icon: '\u{1F94A}', category: 'sports' },
  { code: 'olympics', name: 'Olympics', icon: '\u{1F3C5}', category: 'sports' },
  
  // Lifestyle (4)
  { code: 'entertainment', name: 'Entertainment', icon: '\u{1F3AC}', category: 'lifestyle' },
  { code: 'music', name: 'Music', icon: '\u{1F3B5}', category: 'lifestyle' },
  { code: 'gaming', name: 'Gaming', icon: '\u{1F3AE}', category: 'lifestyle' },
  { code: 'travel', name: 'Travel', icon: '\u2708\uFE0F', category: 'lifestyle' },
];

// ==========================================
// PERSONALIZATION CONFIG
// ==========================================
export const PERSONALIZATION_CONFIG = {
  // Country boosts (high max values — AI relevance scales them down for low-relevance articles)
  HOME_COUNTRY_BOOST: 350,
  FOLLOWED_COUNTRY_SINGLE_BOOST: 200,
  FOLLOWED_COUNTRY_MULTIPLE_BOOST: 250,

  // Topic boosts (high max values — AI relevance scales them down for low-relevance articles)
  TOPIC_SINGLE_BOOST: 300,
  TOPIC_DOUBLE_BOOST: 350,
  TOPIC_TRIPLE_PLUS_BOOST: 400,
  
  // Feed thresholds
  TODAY_FEED_MIN_SCORE: 880,
  TODAY_FEED_MAX_ARTICLES: 15,
  
  // User constraints
  MIN_TOPICS_REQUIRED: 3,
  MAX_TOPICS_ALLOWED: 10,
  MAX_FOLLOWED_COUNTRIES: 5,
};

// ==========================================
// PERSONALIZATION ENGINE
// ==========================================

/**
 * Calculate personalized score for an article based on user preferences.
 *
 * Uses AI-generated relevance scores when available (topic_relevance, country_relevance).
 * These scores (0-100) tell us how relevant an article is for each topic/country,
 * so an F1 race result gets f1:95 but a random mention of a driver gets f1:30.
 *
 * Falls back to flat config boosts for older articles without relevance data.
 */
export function calculateFinalScore(article, user) {
  let score = article.base_score || article.ai_final_score || 0;
  const matchReasons = [];

  const articleCountries = article.countries || [];
  const articleTopics = article.topics || [];
  const topicRelevance = article.topic_relevance || {};
  const countryRelevance = article.country_relevance || {};
  const hasAIRelevance = Object.keys(topicRelevance).length > 0 || Object.keys(countryRelevance).length > 0;

  // Maximum boost multiplier: AI relevance of 100 → full boost, 30 → ~30% of max boost
  const MAX_TOPIC_BOOST = PERSONALIZATION_CONFIG.TOPIC_SINGLE_BOOST;     // 120
  const MAX_COUNTRY_BOOST = PERSONALIZATION_CONFIG.HOME_COUNTRY_BOOST;   // 180

  // 1. HOME COUNTRY BOOST
  if (articleCountries.includes(user.home_country)) {
    if (hasAIRelevance && countryRelevance[user.home_country]) {
      // AI relevance: scale boost by how relevant the article is to this country
      const relevance = countryRelevance[user.home_country];
      const boost = Math.round((relevance / 100) * MAX_COUNTRY_BOOST);
      score += boost;
      matchReasons.push(`Home: ${user.home_country} (rel:${relevance}→+${boost})`);
    } else {
      // Fallback: flat boost
      score += PERSONALIZATION_CONFIG.HOME_COUNTRY_BOOST;
      matchReasons.push(`Home country: ${user.home_country}`);
    }
  }

  // 2. FOLLOWED COUNTRIES BOOST
  const followedCountryMatches = articleCountries.filter(
    country => (user.followed_countries || []).includes(country)
  );
  if (followedCountryMatches.length > 0) {
    if (hasAIRelevance) {
      // Use the highest AI relevance score among matched countries
      let bestRelevance = 0;
      let bestCountry = '';
      followedCountryMatches.forEach(country => {
        const rel = countryRelevance[country] || 30; // default 30 if tagged but no AI score
        if (rel > bestRelevance) { bestRelevance = rel; bestCountry = country; }
      });
      const boost = Math.round((bestRelevance / 100) * PERSONALIZATION_CONFIG.FOLLOWED_COUNTRY_SINGLE_BOOST);
      score += boost;
      matchReasons.push(`Country: ${bestCountry} (rel:${bestRelevance}→+${boost})`);
    } else {
      // Fallback: flat boost
      if (followedCountryMatches.length >= 2) {
        score += PERSONALIZATION_CONFIG.FOLLOWED_COUNTRY_MULTIPLE_BOOST;
        matchReasons.push(`Followed countries: ${followedCountryMatches.join(', ')}`);
      } else {
        score += PERSONALIZATION_CONFIG.FOLLOWED_COUNTRY_SINGLE_BOOST;
        matchReasons.push(`Followed country: ${followedCountryMatches[0]}`);
      }
    }
  }

  // 3. TOPIC BOOST
  const topicMatches = articleTopics.filter(
    topic => (user.followed_topics || []).includes(topic)
  );
  if (topicMatches.length > 0) {
    if (hasAIRelevance) {
      // Use the highest AI relevance score among matched topics
      let bestRelevance = 0;
      let bestTopic = '';
      topicMatches.forEach(topic => {
        const rel = topicRelevance[topic] || 30; // default 30 if tagged but no AI score
        if (rel > bestRelevance) { bestRelevance = rel; bestTopic = topic; }
      });
      const boost = Math.round((bestRelevance / 100) * MAX_TOPIC_BOOST);
      score += boost;
      matchReasons.push(`Topic: ${bestTopic} (rel:${bestRelevance}→+${boost})`);
    } else {
      // Fallback: flat boost for older articles
      if (topicMatches.length >= 3) {
        score += PERSONALIZATION_CONFIG.TOPIC_TRIPLE_PLUS_BOOST;
        matchReasons.push(`Topics: ${topicMatches.join(', ')}`);
      } else if (topicMatches.length === 2) {
        score += PERSONALIZATION_CONFIG.TOPIC_DOUBLE_BOOST;
        matchReasons.push(`Topics: ${topicMatches.join(', ')}`);
      } else {
        score += PERSONALIZATION_CONFIG.TOPIC_SINGLE_BOOST;
        matchReasons.push(`Topic: ${topicMatches[0]}`);
      }
    }
  }

  return {
    ...article,
    final_score: score,
    match_reasons: matchReasons,
  };
}

/**
 * Get personalized "For You" feed for a user
 */
export function getForYouFeed(articles, user, limit) {
  const scoredArticles = articles.map(article => 
    calculateFinalScore(article, user)
  );
  
  scoredArticles.sort((a, b) => b.final_score - a.final_score);
  
  if (limit) {
    return scoredArticles.slice(0, limit);
  }
  
  return scoredArticles;
}

/**
 * Get global "Today" feed (same for all users)
 */
export function getTodayFeed(articles) {
  const topArticles = articles.filter(
    article => (article.base_score || article.ai_final_score || 0) >= PERSONALIZATION_CONFIG.TODAY_FEED_MIN_SCORE
  );
  
  topArticles.sort((a, b) => 
    (b.base_score || b.ai_final_score || 0) - (a.base_score || a.ai_final_score || 0)
  );
  
  return topArticles.slice(0, PERSONALIZATION_CONFIG.TODAY_FEED_MAX_ARTICLES);
}

// Helper to get country by code
export function getCountryByCode(code) {
  return COUNTRIES.find(c => c.code === code);
}

// Helper to get topic by code
export function getTopicByCode(code) {
  return TOPICS.find(t => t.code === code);
}

// Group topics by category
export function getTopicsByCategory() {
  const grouped = {};
  TOPICS.forEach(topic => {
    if (!grouped[topic.category]) {
      grouped[topic.category] = [];
    }
    grouped[topic.category].push(topic);
  });
  return grouped;
}

// Group countries by region
export function getCountriesByRegion() {
  const grouped = {};
  COUNTRIES.forEach(country => {
    if (!grouped[country.region]) {
      grouped[country.region] = [];
    }
    grouped[country.region].push(country);
  });
  return grouped;
}

// Category display names
export const TOPIC_CATEGORIES = {
  business: 'Business & Finance',
  tech: 'Technology',
  science: 'Science & Health',
  politics: 'Politics & World',
  sports: 'Sports',
  lifestyle: 'Lifestyle',
};

export const COUNTRY_REGIONS = {
  major: 'Major Powers',
  europe: 'Europe',
  asia: 'Asia',
  middle_east: 'Middle East',
  americas: 'Americas',
  oceania: 'Oceania',
};


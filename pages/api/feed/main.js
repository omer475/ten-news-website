import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper to parse JSON safely
const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

// ==========================================
// ARTICLE FORMATTING (unchanged from before)
// ==========================================

function formatArticle(article, eventMap = {}) {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timeline = safeJsonParse(article.timeline, null);
  const graph = safeJsonParse(article.graph, null);
  const details = safeJsonParse(article.details, []);
  const components = article.components_order || safeJsonParse(article.components, null);
  const countries = safeJsonParse(article.countries, []);
  const topics = safeJsonParse(article.topics, []);
  const countryRelevance = safeJsonParse(article.country_relevance, null);
  const topicRelevance = safeJsonParse(article.topic_relevance, null);
  const interestTags = safeJsonParse(article.interest_tags, []);

  // Parse map data
  let map = null;
  const rawMap = safeJsonParse(article.map, null);
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const primary = rawMap[0];
      map = {
        center: { lat: primary.coordinates?.lat || 0, lon: primary.coordinates?.lng || primary.coordinates?.lon || 0 },
        markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
        name: primary.name,
        location: [primary.name, primary.city, primary.country].filter(Boolean).join(', '),
        city: primary.city,
        country: primary.country,
        region: primary.country,
        description: primary.description,
      };
    } else if (!Array.isArray(rawMap)) {
      map = {
        center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
        markers: [],
        name: rawMap.name,
        location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
        city: rawMap.city,
        country: rawMap.country,
        region: rawMap.country,
        description: rawMap.description,
      };
    }
  }

  // Clean image URL
  let imageUrl = null;
  const raw = article.image_url;
  if (raw) {
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
      imageUrl = s;
    }
  }

  const formatted = {
    id: article.id,
    title: article.title_news,
    title_news: article.title_news || null,
    url: article.url,
    source: article.source || 'Ten News',
    category: article.category,
    emoji: article.emoji || '📰',
    image_url: imageUrl,
    urlToImage: imageUrl,
    image_source: article.image_source || null,
    publishedAt: article.published_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score || 0,
    final_score: article.ai_final_score || 0,
    base_score: article.ai_final_score || 0,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets: summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsNews,
    content_news: null,
    detailed_text: '',
    five_ws: fiveWs,
    timeline,
    graph,
    map,
    details,
    components,
    countries,
    topics,
    country_relevance: countryRelevance,
    topic_relevance: topicRelevance,
    interest_tags: interestTags,
    num_sources: article.num_sources,
    cluster_id: article.cluster_id,
    version_number: article.version_number,
    views: article.view_count || 0,
  };

  // Add world event if available
  if (eventMap[article.id]) {
    formatted.world_event = eventMap[article.id];
  }

  return formatted;
}

// ==========================================
// RECENCY DECAY (category-aware)
// ==========================================

const HARD_NEWS_CATEGORIES = ['World', 'Politics', 'Business', 'Finance'];

function getRecencyDecay(createdAt, category) {
  const hoursOld = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const rate = HARD_NEWS_CATEGORIES.includes(category) ? 0.04 : 0.015;
  return Math.exp(-rate * hoursOld);
}

// ==========================================
// USER INTEREST PROFILE (from engagement history)
// ==========================================

async function buildUserInterestProfile(supabase, userId) {
  // Get article IDs the user engaged with in the last 14 days
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from('user_article_events')
    .select('article_id, event_type')
    .eq('user_id', userId)
    .gte('created_at', twoWeeksAgo)
    .in('event_type', ['article_saved', 'article_engaged', 'article_detail_view'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!events || events.length === 0) return null;

  // Weight by engagement type: saved > engaged > viewed
  const eventWeights = { article_saved: 3, article_engaged: 2, article_detail_view: 1 };
  const articleWeights = {};
  for (const e of events) {
    const w = eventWeights[e.event_type] || 1;
    articleWeights[e.article_id] = Math.max(articleWeights[e.article_id] || 0, w);
  }

  const articleIds = Object.keys(articleWeights).map(Number).filter(Boolean);
  if (articleIds.length === 0) return null;

  // Fetch interest_tags for engaged articles (batch)
  let allTags = [];
  for (let i = 0; i < articleIds.length; i += 300) {
    const batch = articleIds.slice(i, i + 300);
    const { data } = await supabase
      .from('published_articles')
      .select('id, interest_tags')
      .in('id', batch);
    if (data) allTags = allTags.concat(data);
  }

  // Build weighted tag frequency map
  const tagScores = {};
  for (const article of allTags) {
    const tags = safeJsonParse(article.interest_tags, []);
    const weight = articleWeights[article.id] || 1;
    for (const tag of tags) {
      const t = tag.toLowerCase();
      tagScores[t] = (tagScores[t] || 0) + weight;
    }
  }

  // Normalize: divide by max score so top tag = 1.0
  const maxScore = Math.max(...Object.values(tagScores), 1);
  const profile = {};
  for (const [tag, score] of Object.entries(tagScores)) {
    profile[tag] = score / maxScore;
  }

  return profile;
}

function computeTagOverlap(article, userProfile) {
  if (!userProfile) return 0;
  const tags = safeJsonParse(article.interest_tags, []);
  if (tags.length === 0) return 0;

  let totalScore = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    totalScore += userProfile[t] || 0;
  }
  // Average overlap per tag, capped at 1.0
  return Math.min(totalScore / tags.length, 1.0);
}

// ==========================================
// SKIP PROFILE (negative signals)
// ==========================================

async function getUserSkipProfile(supabase, userId) {
  // Get stored skip profile (computed periodically)
  const { data: user } = await supabase
    .from('users')
    .select('skip_profile')
    .eq('id', userId)
    .single();

  return user?.skip_profile || null;
}

function computeSkipPenalty(article, skipProfile, interestProfile) {
  if (!skipProfile) return 0;
  const tags = safeJsonParse(article.interest_tags, []);
  if (tags.length === 0) return 0;

  let skipScore = 0;
  let interestScore = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    skipScore += skipProfile[t] || 0;
    interestScore += interestProfile ? (interestProfile[t] || 0) : 0;
  }
  skipScore /= tags.length;
  interestScore /= tags.length;

  // Only penalize if skip signal is stronger than interest signal
  const netSkip = Math.max(0, skipScore - interestScore * 0.5);
  return Math.min(netSkip, 0.9); // Cap at 90% penalty
}

// ==========================================
// SCORING WITHIN BUCKETS
// ==========================================

function scorePersonal(article, similarity, tagOverlap) {
  const recency = getRecencyDecay(article.created_at, article.category);
  const aiScore = article.ai_final_score || 0;
  // Tag overlap is primary signal (what Instagram calls "interest scores")
  // Embedding similarity is secondary (retrieval signal, not ranking signal)
  // Quality and recency are supporting signals
  return tagOverlap * 400 + similarity * 300 + (aiScore / 1000) * 100 * recency;
}

function scoreTrending(article) {
  const hoursOld = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
  const recency = Math.exp(-0.04 * hoursOld);
  return (article.ai_final_score || 0) * recency;
}

function scoreDiscovery(article) {
  const hoursOld = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
  const recency = Math.exp(-0.02 * hoursOld);
  // Slight randomization for variety each refresh
  return (article.ai_final_score || 0) * recency * (1 + Math.random() * 0.3);
}

// ==========================================
// INTERLEAVING (TikTok-style slot pattern)
// ==========================================

// Per 10 cards: 70% Personal / 20% Trending / 10% Discovery
const SLOT_PATTERN = ['P', 'P', 'T', 'P', 'P', 'D', 'P', 'P', 'T', 'P'];

function interleave(personal, trending, discovery, limit) {
  const result = [];
  let pi = 0, ti = 0, di = 0;

  for (let pos = 0; result.length < limit; pos++) {
    const slot = SLOT_PATTERN[pos % 10];
    let article = null;

    if (slot === 'P' && pi < personal.length) article = personal[pi++];
    else if (slot === 'T' && ti < trending.length) article = trending[ti++];
    else if (slot === 'D' && di < discovery.length) article = discovery[di++];

    // Fallback chain: P → T → D
    if (!article && pi < personal.length) article = personal[pi++];
    if (!article && ti < trending.length) article = trending[ti++];
    if (!article && di < discovery.length) article = discovery[di++];

    if (!article) break;
    result.push({
      ...article,
      bucket: slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : 'discovery',
    });
  }
  return result;
}

// ==========================================
// TAG-BASED FALLBACK (for users without taste vector)
// ==========================================

function calculateTagScore(article, userPrefs) {
  let score = article.ai_final_score || 0;
  const articleCountries = safeJsonParse(article.countries, []);
  const articleTopics = safeJsonParse(article.topics, []);

  if (articleCountries.includes(userPrefs.home_country)) score += 150;

  const countryMatches = articleCountries.filter(
    c => (userPrefs.followed_countries || []).includes(c)
  );
  if (countryMatches.length >= 2) score += 100;
  else if (countryMatches.length === 1) score += 75;

  const topicMatches = articleTopics.filter(
    t => (userPrefs.followed_topics || []).includes(t)
  );
  if (topicMatches.length >= 3) score += 100;
  else if (topicMatches.length === 2) score += 80;
  else if (topicMatches.length === 1) score += 50;

  return score;
}

// ==========================================
// COLUMNS TO SELECT (not SELECT *)
// ==========================================

const ARTICLE_COLUMNS = [
  'id', 'title_news', 'url', 'source', 'category', 'emoji',
  'image_url', 'image_source', 'published_at', 'created_at',
  'ai_final_score', 'summary_bullets_news',
  'five_ws', 'timeline', 'graph', 'map', 'details',
  'components_order', 'components', 'countries', 'topics',
  'country_relevance', 'topic_relevance', 'interest_tags',
  'num_sources', 'cluster_id', 'version_number', 'view_count',
].join(', ');

// ==========================================
// MAIN HANDLER
// ==========================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const homeCountry = req.query.home_country || null;
    const followedCountries = req.query.followed_countries ? req.query.followed_countries.split(',') : [];
    const followedTopics = req.query.followed_topics ? req.query.followed_topics.split(',') : [];
    const userId = req.query.user_id || null;

    // Session signals from client (real-time skip/engage tracking)
    const sessionEngagedIds = req.query.engaged_ids ? req.query.engaged_ids.split(',').map(Number).filter(Boolean) : [];
    const sessionSkippedIds = req.query.skipped_ids ? req.query.skipped_ids.split(',').map(Number).filter(Boolean) : [];

    // ==========================================
    // LOAD USER DATA
    // ==========================================

    let userPrefs = null;
    let tasteVector = null;
    let tasteVectorMinilm = null;
    let skipProfile = null;
    let hasInterestClusters = false;
    let persUserId = null; // The users table ID (may differ from auth user ID)

    if (userId) {
      // Look up profiles table (where real users live, id = auth UUID)
      let { data: userData } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile')
        .eq('id', userId)
        .single();

      if (!userData) {
        // Fallback: try legacy users table
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile')
          .eq('id', userId)
          .single();
        if (!legacyUser) {
          const { data: linkedUser } = await supabase
            .from('users')
            .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile')
            .eq('auth_user_id', userId)
            .single();
          if (linkedUser) userData = linkedUser;
        } else {
          userData = legacyUser;
        }
      }

      if (userData) {
        userPrefs = userData;
        tasteVector = userData.taste_vector;
        persUserId = userData.id;
      }

      // Extract MiniLM taste vector and skip profile
      tasteVectorMinilm = userData?.taste_vector_minilm || null;
      skipProfile = userData?.skip_profile || null;

      // Check if user has interest clusters (PinnerSage-lite)
      if (tasteVector && persUserId) {
        const { count } = await supabase
          .from('user_interest_clusters')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', persUserId);
        hasInterestClusters = (count || 0) > 0;
      }
    }

    if (!userPrefs && homeCountry) {
      userPrefs = { home_country: homeCountry, followed_countries: followedCountries, followed_topics: followedTopics };
    }

    // ==========================================
    // PARSE CURSOR
    // ==========================================

    let offset = 0;
    let isV2Cursor = false;

    if (cursor) {
      if (cursor.startsWith('v2_')) {
        // New v2 cursor: v2_{offset}_{lastArticleId}
        const parts = cursor.split('_');
        offset = parseInt(parts[1]) || 0;
        isV2Cursor = true;
      } else {
        // Legacy numeric offset cursor
        offset = parseInt(cursor) || 0;
      }
    }

    // ==========================================
    // GET SEEN ARTICLE IDS (for dedup across pages)
    // ==========================================

    let seenArticleIds = [];
    if ((persUserId || userId) && offset > 0) {
      // Get recently viewed articles to exclude from results
      // user_article_events uses auth user ID (user.id from auth)
      const { data: seenEvents } = await supabase
        .from('user_article_events')
        .select('article_id')
        .eq('user_id', userId)
        .in('event_type', ['article_view', 'article_detail_view'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (seenEvents) {
        seenArticleIds = [...new Set(seenEvents.map(e => e.article_id).filter(Boolean))];
      }
    }

    // ==========================================
    // DETERMINE FEED STRATEGY
    // ==========================================

    const hasEmbeddingPersonalization = tasteVector || tasteVectorMinilm || hasInterestClusters;
    const similarityFloor = userPrefs?.similarity_floor || 0;

    if (hasEmbeddingPersonalization) {
      // ============================================
      // V2 FEED: Three-Bucket TikTok-Style Algorithm
      // ============================================
      return await handleV2Feed(req, res, supabase, {
        userId: persUserId || userId,
        userPrefs,
        tasteVector,
        tasteVectorMinilm,
        hasInterestClusters,
        similarityFloor,
        skipProfile,
        seenArticleIds,
        sessionEngagedIds,
        sessionSkippedIds,
        limit,
        offset,
      });
    } else {
      // ============================================
      // FALLBACK: Tag-based scoring (unchanged for new users)
      // ============================================
      return await handleFallbackFeed(req, res, supabase, {
        userPrefs,
        seenArticleIds,
        limit,
        offset,
      });
    }

  } catch (error) {
    console.error('Main feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ==========================================
// V2 FEED: Three-Bucket System
// ==========================================

async function handleV2Feed(req, res, supabase, opts) {
  let { userId, userPrefs, tasteVector, tasteVectorMinilm, hasInterestClusters, similarityFloor, skipProfile, seenArticleIds, sessionEngagedIds, sessionSkippedIds, limit, offset } = opts;
  sessionEngagedIds = sessionEngagedIds || [];
  sessionSkippedIds = sessionSkippedIds || [];

  const now = Date.now();
  const seventyTwoHoursAgo = new Date(now - 72 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  // Personalized feed — private cache, shorter TTL
  res.setHeader('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');

  // ==========================================
  // THREE PARALLEL CANDIDATE GENERATORS
  // ==========================================

  const excludeIds = seenArticleIds.length > 0 ? seenArticleIds : null;

  // Build the personal query — prefer MiniLM (better topic discrimination)
  let personalPromise;
  const minSim = similarityFloor || 0;
  const useMinilm = !!tasteVectorMinilm;

  if (hasInterestClusters && useMinilm) {
    // MiniLM multi-cluster ANN search (best: HNSW indexed + 1.8x better discrimination)
    personalPromise = supabase.rpc('match_articles_multi_cluster_minilm', {
      p_user_id: userId,
      match_per_cluster: 50,
      hours_window: 72,
      exclude_ids: excludeIds,
      min_similarity: minSim,
    });
  } else if (hasInterestClusters) {
    // Gemini multi-cluster ANN search (fallback)
    personalPromise = supabase.rpc('match_articles_multi_cluster', {
      p_user_id: userId,
      match_per_cluster: 50,
      hours_window: 72,
      exclude_ids: excludeIds,
      min_similarity: minSim,
    });
  } else if (useMinilm) {
    // MiniLM single taste vector search
    personalPromise = supabase.rpc('match_articles_personal_minilm', {
      query_embedding: tasteVectorMinilm,
      match_count: 150,
      hours_window: 72,
      exclude_ids: excludeIds,
      min_similarity: minSim,
    });
  } else {
    // Gemini single taste vector search (fallback)
    personalPromise = supabase.rpc('match_articles_personal', {
      query_embedding: tasteVector,
      match_count: 150,
      hours_window: 72,
      exclude_ids: excludeIds,
      min_similarity: minSim,
    });
  }

  const [personalResult, trendingResult, discoveryResult, userInterestProfile] = await Promise.all([
    // 1. PERSONAL: pgvector similarity search — finds YOUR content
    personalPromise,

    // 2. TRENDING: high editorial score — what everyone should know
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .gte('ai_final_score', 750)
      .order('ai_final_score', { ascending: false })
      .limit(50),

    // 3. DISCOVERY: diverse quality content from wider pool
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at')
      .gte('created_at', fortyEightHoursAgo)
      .gte('ai_final_score', 400)
      .order('ai_final_score', { ascending: false })
      .limit(200),

    // 4. USER INTEREST PROFILE: tag frequencies from engagement history
    buildUserInterestProfile(supabase, userId),
  ]);

  if (personalResult.error) {
    console.error('Personal query error:', personalResult.error);
    // Fall back to tag-based if embedding search fails
    return await handleFallbackFeed(req, res, supabase, {
      userPrefs, seenArticleIds, limit, offset,
    });
  }

  // ==========================================
  // BLEND SESSION SIGNALS INTO PROFILES
  // ==========================================

  // Boost interest profile with tags from articles engaged in this session
  if (sessionEngagedIds.length > 0) {
    const { data: engagedArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .in('id', sessionEngagedIds.slice(0, 20));
    for (const a of (engagedArticles || [])) {
      const tags = safeJsonParse(a.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        userInterestProfile[t] = Math.min((userInterestProfile[t] || 0) + 0.3, 1.0);
      }
    }
  }

  // Build session skip profile from articles skipped in this session
  const sessionSkipTags = {};
  if (sessionSkippedIds.length > 0) {
    const { data: skippedArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .in('id', sessionSkippedIds.slice(0, 20));
    for (const a of (skippedArticles || [])) {
      const tags = safeJsonParse(a.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        sessionSkipTags[t] = (sessionSkipTags[t] || 0) + 0.15;
      }
    }
    // Merge session skips into stored skip profile
    for (const [tag, score] of Object.entries(sessionSkipTags)) {
      skipProfile = skipProfile || {};
      skipProfile[tag] = Math.min((skipProfile[tag] || 0) + score, 0.9);
    }
  }

  // Exclude session-engaged and session-skipped articles from results
  const sessionExcludeIds = new Set([...sessionEngagedIds, ...sessionSkippedIds]);

  // ==========================================
  // PROCESS CANDIDATES
  // ==========================================

  const personalSimilarityMap = {};
  let personalIdOrder = []; // Ordered list of article IDs for the personal bucket

  if (hasInterestClusters) {
    // Round-robin across clusters for balanced interest representation
    const clusterBuckets = {};
    for (const r of (personalResult.data || [])) {
      const ci = r.cluster_index ?? 0;
      if (!clusterBuckets[ci]) clusterBuckets[ci] = [];
      clusterBuckets[ci].push(r);
      if (!personalSimilarityMap[r.id] || r.similarity > personalSimilarityMap[r.id]) {
        personalSimilarityMap[r.id] = r.similarity;
      }
    }

    // Sort each cluster by similarity
    for (const ci of Object.keys(clusterBuckets)) {
      clusterBuckets[ci].sort((a, b) => b.similarity - a.similarity);
    }

    // Round-robin: pick one from each cluster in turn
    const clusterKeys = Object.keys(clusterBuckets).sort((a, b) =>
      (clusterBuckets[b]?.length || 0) - (clusterBuckets[a]?.length || 0)
    );
    const pointers = {};
    for (const ci of clusterKeys) pointers[ci] = 0;

    const seen = new Set();
    for (let round = 0; round < 200 && personalIdOrder.length < 150; round++) {
      let addedAny = false;
      for (const ci of clusterKeys) {
        while (pointers[ci] < clusterBuckets[ci].length) {
          const r = clusterBuckets[ci][pointers[ci]];
          pointers[ci]++;
          if (!seen.has(r.id)) {
            seen.add(r.id);
            personalIdOrder.push(r.id);
            addedAny = true;
            break;
          }
        }
      }
      if (!addedAny) break;
    }
  } else {
    // Single taste vector: sort by similarity
    const sorted = (personalResult.data || []).sort((a, b) => b.similarity - a.similarity);
    for (const r of sorted) {
      personalSimilarityMap[r.id] = r.similarity;
      personalIdOrder.push(r.id);
    }
  }

  // Filter out session-excluded articles from personal candidates
  personalIdOrder = personalIdOrder.filter(id => !sessionExcludeIds.has(id));
  const personalIds = new Set(personalIdOrder);

  // TRENDING: category-cap to max 3 per category, exclude those already in Personal
  const trendingCategoryCounts = {};
  const trendingIds = new Set();
  const trendingArticles = [];
  for (const a of (trendingResult.data || [])) {
    if (personalIds.has(a.id)) continue; // Personal takes priority
    if (seenArticleIds.includes(a.id)) continue;
    if (sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
    trendingCategoryCounts[cat] = (trendingCategoryCounts[cat] || 0) + 1;
    if (trendingCategoryCounts[cat] > 3) continue; // Max 3 per category
    trendingIds.add(a.id);
    trendingArticles.push(a);
  }

  // DISCOVERY: filter out Personal & Trending, pick top per underrepresented category
  const personalCategories = new Set();
  // We'll determine personal categories once we fetch full articles
  const discoveryCategoryCounts = {};
  const discoveryArticles = [];
  for (const a of (discoveryResult.data || [])) {
    if (personalIds.has(a.id) || trendingIds.has(a.id)) continue;
    if (seenArticleIds.includes(a.id)) continue;
    if (sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
    discoveryCategoryCounts[cat] = (discoveryCategoryCounts[cat] || 0) + 1;
    if (discoveryCategoryCounts[cat] > 2) continue; // Max 2 per category for diversity
    discoveryArticles.push(a);
    if (discoveryArticles.length >= 30) break;
  }

  // ==========================================
  // FETCH FULL ARTICLE DATA FOR ALL CANDIDATES
  // ==========================================

  const allCandidateIds = [
    ...personalIds,
    ...trendingIds,
    ...discoveryArticles.map(a => a.id),
  ];
  const uniqueIds = [...new Set(allCandidateIds)];

  if (uniqueIds.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Fetch full article data in batches (Supabase .in() limit is ~300)
  let allArticles = [];
  for (let i = 0; i < uniqueIds.length; i += 300) {
    const batch = uniqueIds.slice(i, i + 300);
    const { data, error } = await supabase
      .from('published_articles')
      .select(ARTICLE_COLUMNS)
      .in('id', batch);
    if (!error && data) allArticles = allArticles.concat(data);
  }

  // Filter out test articles
  allArticles = allArticles.filter(a => {
    const url = a?.url || '';
    const title = a?.title_news || a?.title || '';
    return !(/test/i.test(url) || /test/i.test(title));
  });

  const articleMap = {};
  for (const a of allArticles) {
    articleMap[a.id] = a;
  }

  // ==========================================
  // SCORE WITHIN BUCKETS
  // ==========================================

  // Personal bucket: score by tag overlap (primary) + similarity (secondary) + skip penalty
  // When round-robin is active, blend cluster order with tag-based ranking
  const personalScoredRaw = personalIdOrder
    .filter(id => articleMap[id])
    .map((id, orderIndex) => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      const tagOverlap = computeTagOverlap(article, userInterestProfile);
      const skipPen = computeSkipPenalty(article, skipProfile, userInterestProfile);
      let baseScore = hasInterestClusters
        ? (1000 - orderIndex) * 0.3 + scorePersonal(article, similarity, tagOverlap)
        : scorePersonal(article, similarity, tagOverlap);
      // Apply skip penalty (demote articles matching user's skip profile)
      baseScore *= (1 - skipPen);
      return {
        ...article,
        _score: baseScore,
        _similarity: similarity,
        _tagOverlap: tagOverlap,
        _skipPenalty: skipPen,
      };
    })
    .sort((a, b) => b._score - a._score);

  // Topic saturation penalty: penalize repeated interest tags in the feed
  // First article with tag "iran" = no penalty, second = -30%, third = -50%, etc.
  const tagSaturation = {};
  const personalScored = [];
  for (const a of personalScoredRaw) {
    const tags = safeJsonParse(a.interest_tags, []);
    // Compute saturation penalty from tags already in the feed
    let penalty = 0;
    for (const tag of tags) {
      const t = tag.toLowerCase();
      const count = tagSaturation[t] || 0;
      if (count >= 3) penalty += 0.4;       // 4th+ article with same tag: heavy penalty
      else if (count >= 2) penalty += 0.25;  // 3rd article: moderate penalty
      else if (count >= 1) penalty += 0.1;   // 2nd article: light penalty
    }
    // Average penalty across tags, cap at 0.8 (never fully zero out)
    const avgPenalty = tags.length > 0 ? Math.min(penalty / tags.length, 0.8) : 0;
    a._score = a._score * (1 - avgPenalty);

    personalScored.push(a);

    // Update saturation counts
    for (const tag of tags) {
      const t = tag.toLowerCase();
      tagSaturation[t] = (tagSaturation[t] || 0) + 1;
    }
  }

  // Track personal categories for discovery filtering
  for (const a of personalScored) {
    personalCategories.add(a.category);
  }

  // Trending bucket: scored by editorial importance × recency
  const trendingScored = trendingArticles
    .filter(a => articleMap[a.id])
    .map(a => ({
      ...articleMap[a.id],
      _score: scoreTrending(articleMap[a.id]),
    }))
    .sort((a, b) => b._score - a._score);

  // Discovery bucket: prioritize categories NOT in personal (true discovery)
  const discoveryScored = discoveryArticles
    .filter(a => articleMap[a.id])
    .map(a => ({
      ...articleMap[a.id],
      _score: scoreDiscovery(articleMap[a.id]) * (personalCategories.has(articleMap[a.id]?.category) ? 0.5 : 1.5),
    }))
    .sort((a, b) => b._score - a._score);

  // ==========================================
  // INTERLEAVE INTO SINGLE SCROLL
  // ==========================================

  const totalAvailable = personalScored.length + trendingScored.length + discoveryScored.length;
  const interleaved = interleave(personalScored, trendingScored, discoveryScored, totalAvailable);

  // Apply pagination
  const page = interleaved.slice(offset, offset + limit);

  if (page.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: totalAvailable });
  }

  // ==========================================
  // FETCH WORLD EVENTS FOR THIS PAGE
  // ==========================================

  const pageIds = page.map(a => a.id);
  const eventMap = await fetchWorldEvents(supabase, pageIds);

  // ==========================================
  // FORMAT & RESPOND
  // ==========================================

  const formattedArticles = page.map(a => {
    const formatted = formatArticle(a, eventMap);
    formatted.bucket = a.bucket;
    formatted.final_score = a._score;
    return formatted;
  });

  // Log feed impressions for skip tracking (fire-and-forget, non-blocking)
  if (userId && pageIds.length > 0) {
    const impressions = pageIds.map(aid => ({ user_id: userId, article_id: aid }));
    supabase.from('user_feed_impressions').insert(impressions).then(() => {}).catch(() => {});
  }

  const hasMore = offset + limit < totalAvailable;
  const lastId = page[page.length - 1]?.id || 0;
  const nextCursor = hasMore ? `v2_${offset + limit}_${lastId}` : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: totalAvailable,
  });
}

// ==========================================
// FALLBACK FEED: Tag-based (for new users)
// ==========================================

async function handleFallbackFeed(req, res, supabase, opts) {
  const { userPrefs, seenArticleIds, limit, offset } = opts;

  // Public cache for non-personalized feed
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: articles, error, count } = await supabase
    .from('published_articles')
    .select(ARTICLE_COLUMNS, { count: 'exact' })
    .gte('created_at', twoDaysAgo)
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit + 4);

  if (error) {
    console.error('Fallback feed query error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles' });
  }

  if (!articles || articles.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Filter out test articles
  let filtered = articles.filter(a => {
    const url = a?.url || '';
    const title = a?.title_news || a?.title || '';
    return !(/test/i.test(url) || /test/i.test(title));
  });

  // Paginate
  const pageArticles = filtered.slice(0, limit);

  if (pageArticles.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Fetch world events
  const articleIds = pageArticles.map(a => a.id);
  const eventMap = await fetchWorldEvents(supabase, articleIds);

  // Format articles
  let formattedArticles = pageArticles.map(a => formatArticle(a, eventMap));

  // Apply tag-based personalization boost if user prefs exist
  if (userPrefs) {
    formattedArticles = formattedArticles.map(article => {
      const finalScore = calculateTagScore(article, userPrefs);
      return { ...article, final_score: finalScore };
    });
    formattedArticles.sort((a, b) => b.final_score - a.final_score);
  }

  const hasMore = (count || 0) > offset + limit;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: count || formattedArticles.length,
  });
}

// ==========================================
// WORLD EVENTS HELPER
// ==========================================

async function fetchWorldEvents(supabase, articleIds) {
  const eventMap = {};
  if (!articleIds || articleIds.length === 0) return eventMap;

  try {
    const { data: articleEvents } = await supabase
      .from('article_world_events')
      .select('article_id, event_id')
      .in('article_id', articleIds);

    if (articleEvents && articleEvents.length > 0) {
      const eventIds = [...new Set(articleEvents.map(ae => ae.event_id))];
      const { data: events } = await supabase
        .from('world_events')
        .select('id, name, slug')
        .in('id', eventIds);

      if (events) {
        const eventLookup = {};
        events.forEach(e => { eventLookup[e.id] = e; });
        articleEvents.forEach(ae => {
          if (eventLookup[ae.event_id]) {
            eventMap[ae.article_id] = eventLookup[ae.event_id];
          }
        });
      }
    }
  } catch (e) {
    // Non-critical — continue without events
  }

  return eventMap;
}

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
  const summaryBullets = safeJsonParse(article.summary_bullets, []);
  const summaryBulletsDetailed = safeJsonParse(article.summary_bullets_detailed, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timeline = safeJsonParse(article.timeline, null);
  const graph = safeJsonParse(article.graph, null);
  const details = article.details_section
    ? article.details_section.split('\n').map(line => {
        const parts = line.split(':');
        return parts.length >= 2
          ? { label: parts[0].trim(), value: parts.slice(1).join(':').trim() }
          : { label: line.trim(), value: '' };
      })
    : safeJsonParse(article.details, []);
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
    title: article.title_news || article.title,
    title_news: article.title_news || null,
    url: article.url,
    source: article.source || 'Ten News',
    category: article.category,
    emoji: article.emoji || '📰',
    image_url: imageUrl,
    urlToImage: imageUrl,
    image_source: article.image_source || null,
    publishedAt: article.published_date || article.published_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score || 0,
    final_score: article.ai_final_score || 0,
    base_score: article.ai_final_score || 0,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets: summaryBullets.length > 0 ? summaryBullets : summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsDetailed,
    content_news: article.content_news || null,
    detailed_text: article.content_news || article.article || article.summary || article.description || '',
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
// SCORING WITHIN BUCKETS
// ==========================================

function scorePersonal(article, similarity) {
  const recency = getRecencyDecay(article.created_at, article.category);
  const aiScore = article.ai_final_score || 0;
  // Similarity is primary (0-1 range × 1000), editorial score is secondary quality signal
  return similarity * 1000 + (aiScore / 1000) * 300 * recency;
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
  'id', 'title', 'title_news', 'url', 'source', 'category', 'emoji',
  'image_url', 'image_source', 'published_date', 'published_at', 'created_at',
  'ai_final_score', 'summary_bullets_news', 'summary_bullets',
  'summary_bullets_detailed', 'content_news', 'article', 'summary', 'description',
  'five_ws', 'timeline', 'graph', 'map', 'details', 'details_section',
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

    // ==========================================
    // LOAD USER DATA
    // ==========================================

    let userPrefs = null;
    let tasteVector = null;
    let hasInterestClusters = false;
    let persUserId = null; // The users table ID (may differ from auth user ID)

    if (userId) {
      // Try lookup by users.id first, then by auth_user_id
      let { data: userData } = await supabase
        .from('users')
        .select('id, home_country, followed_countries, followed_topics, taste_vector')
        .eq('id', userId)
        .single();

      if (!userData) {
        // userId might be the auth user ID — try auth_user_id link
        const { data: linkedUser } = await supabase
          .from('users')
          .select('id, home_country, followed_countries, followed_topics, taste_vector')
          .eq('auth_user_id', userId)
          .single();
        if (linkedUser) userData = linkedUser;
      }

      if (userData) {
        userPrefs = userData;
        tasteVector = userData.taste_vector;
        persUserId = userData.id;
      }

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

    const hasEmbeddingPersonalization = tasteVector || hasInterestClusters;

    if (hasEmbeddingPersonalization) {
      // ============================================
      // V2 FEED: Three-Bucket TikTok-Style Algorithm
      // ============================================
      return await handleV2Feed(req, res, supabase, {
        userId: persUserId || userId,
        userPrefs,
        tasteVector,
        hasInterestClusters,
        seenArticleIds,
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
  const { userId, userPrefs, tasteVector, hasInterestClusters, seenArticleIds, limit, offset } = opts;

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

  // Build the personal query based on cluster availability
  let personalPromise;
  if (hasInterestClusters) {
    // PinnerSage-lite: multi-cluster ANN search
    personalPromise = supabase.rpc('match_articles_multi_cluster', {
      p_user_id: userId,
      match_per_cluster: 50,
      hours_window: 72,
      exclude_ids: excludeIds,
    });
  } else {
    // Single taste vector search
    personalPromise = supabase.rpc('match_articles_personal', {
      query_embedding: tasteVector,
      match_count: 150,
      hours_window: 72,
      exclude_ids: excludeIds,
    });
  }

  const [personalResult, trendingResult, discoveryResult] = await Promise.all([
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
  ]);

  if (personalResult.error) {
    console.error('Personal query error:', personalResult.error);
    // Fall back to tag-based if embedding search fails
    return await handleFallbackFeed(req, res, supabase, {
      userPrefs, seenArticleIds, limit, offset,
    });
  }

  // ==========================================
  // PROCESS CANDIDATES
  // ==========================================

  const personalIds = new Set((personalResult.data || []).map(r => r.id));
  const personalSimilarityMap = {};
  for (const r of (personalResult.data || [])) {
    // Keep highest similarity if article appears in multiple clusters
    if (!personalSimilarityMap[r.id] || r.similarity > personalSimilarityMap[r.id]) {
      personalSimilarityMap[r.id] = r.similarity;
    }
  }

  // TRENDING: category-cap to max 3 per category, exclude those already in Personal
  const trendingCategoryCounts = {};
  const trendingIds = new Set();
  const trendingArticles = [];
  for (const a of (trendingResult.data || [])) {
    if (personalIds.has(a.id)) continue; // Personal takes priority
    if (seenArticleIds.includes(a.id)) continue;
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

  // Personal bucket: scored by similarity × 1000 + editorial quality
  const personalScored = [...personalIds]
    .filter(id => articleMap[id])
    .map(id => ({
      ...articleMap[id],
      _score: scorePersonal(articleMap[id], personalSimilarityMap[id] || 0),
      _similarity: personalSimilarityMap[id] || 0,
    }))
    .sort((a, b) => b._score - a._score);

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
  const filtered = articles.filter(a => {
    const url = a?.url || '';
    const title = a?.title_news || a?.title || '';
    return !(/test/i.test(url) || /test/i.test(title));
  });

  // Fetch world events
  const articleIds = filtered.slice(0, limit).map(a => a.id);
  const eventMap = await fetchWorldEvents(supabase, articleIds);

  // Format articles
  let formattedArticles = filtered.slice(0, limit).map(a => formatArticle(a, eventMap));

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

import { createClient } from '@supabase/supabase-js';
import { calculateFinalScore, calculateEmbeddingScore } from '../../../lib/personalization';
import { cosineSimilarity } from '../../../lib/embeddings';

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

// Map ISO country codes (from iOS app) to API names used by personalization engine
const ISO_TO_API_COUNTRY = {
  'US': 'usa', 'GB': 'uk', 'CA': 'canada', 'AU': 'australia',
  'DE': 'germany', 'FR': 'france', 'JP': 'japan', 'IN': 'india',
  'BR': 'brazil', 'KR': 'south_korea', 'IL': 'israel', 'TR': 'turkiye',
  'UA': 'ukraine', 'CN': 'china', 'RU': 'russia', 'PK': 'pakistan',
  'IR': 'iran', 'ES': 'spain', 'IT': 'italy', 'MX': 'mexico',
  'SA': 'saudi_arabia', 'AE': 'uae', 'QA': 'qatar',
};

const normalizeCountry = (code) => ISO_TO_API_COUNTRY[code] || code.toLowerCase();

// Lightweight columns for scoring — only columns confirmed to exist (from for-you.js)
// No heavy text blobs, no embedding by default
const SCORING_COLUMNS = 'id, ai_final_score, created_at, published_at, url, title_news, source, category, countries, topics, topic_relevance, country_relevance, image_url';

const formatArticle = (article) => {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
  const summaryBullets = safeJsonParse(article.summary_bullets, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timelineData = safeJsonParse(article.timeline, null);
  const graphData = safeJsonParse(article.graph, null);

  let mapData = null;
  const rawMap = safeJsonParse(article.map, null);
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const p = rawMap[0];
      mapData = {
        center: { lat: p.coordinates?.lat || 0, lon: p.coordinates?.lng || p.coordinates?.lon || 0 },
        markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
        name: p.name,
        location: [p.name, p.city, p.country].filter(Boolean).join(', '),
        city: p.city, country: p.country, region: p.country,
        description: p.description,
      };
    } else if (!Array.isArray(rawMap)) {
      mapData = {
        center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
        markers: [],
        name: rawMap.name,
        location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
        city: rawMap.city, country: rawMap.country, region: rawMap.country,
        description: rawMap.description,
      };
    }
  }

  const imgUrl = article.image_url;
  let cleanImageUrl = null;
  if (imgUrl) {
    const urlStr = typeof imgUrl === 'string' ? imgUrl.trim() : String(imgUrl).trim();
    if (urlStr && urlStr !== 'null' && urlStr !== 'undefined' && urlStr !== 'None' && urlStr.length >= 5) {
      cleanImageUrl = urlStr;
    }
  }

  return {
    id: article.id,
    title: article.title_news || article.title,
    url: article.url,
    source: article.source || 'Today+',
    description: article.description || (article.content_news ? article.content_news.substring(0, 200) + '...' : ''),
    content: article.content_news || article.content,
    created_at: article.created_at,
    num_sources: article.num_sources,
    urlToImage: cleanImageUrl,
    image_url: cleanImageUrl,
    image_source: article.image_source,
    publishedAt: article.published_date || article.published_at,
    category: article.category,
    emoji: article.emoji || '📰',
    ai_final_score: article.ai_final_score || 0,
    title_news: article.title_news || null,
    content_news: article.content_news || null,
    summary_bullets_news: summaryBulletsNews,
    five_ws: fiveWs,
    detailed_text: article.content_news || article.article || article.summary || article.description || '',
    summary_bullets: summaryBullets.length > 0 ? summaryBullets : summaryBulletsNews,
    timeline: timelineData,
    graph: graphData,
    map: mapData,
    components: article.components_order || safeJsonParse(article.components, null),
    details: article.details_section ? article.details_section.split('\n') : safeJsonParse(article.details, []),
    countries: safeJsonParse(article.countries, []),
    topics: safeJsonParse(article.topics, []),
    topic_relevance: safeJsonParse(article.topic_relevance, {}),
    country_relevance: safeJsonParse(article.country_relevance, {}),
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    const {
      home_country,
      followed_countries,
      followed_topics,
      user_id,
    } = req.query;

    // -------------------------------------------------------
    // 1. Resolve user preferences + taste vector
    // -------------------------------------------------------
    let userPrefs = null;
    let tasteVector = null;

    // Try database lookup first if user_id provided
    if (user_id) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('home_country, followed_countries, followed_topics, taste_vector')
          .eq('id', user_id)
          .single();

        if (!userError && userData) {
          // DB columns may be arrays or JSON strings — normalize
          const dbCountries = Array.isArray(userData.followed_countries)
            ? userData.followed_countries
            : safeJsonParse(userData.followed_countries, []);
          const dbTopics = Array.isArray(userData.followed_topics)
            ? userData.followed_topics
            : safeJsonParse(userData.followed_topics, []);

          userPrefs = {
            home_country: userData.home_country,
            followed_countries: dbCountries,
            followed_topics: dbTopics,
          };
          tasteVector = userData.taste_vector;
        }
      } catch (profileError) {
        console.error('Profile lookup failed:', profileError.message);
        // Continue — fall back to query params below
      }
    }

    // Fallback to query params (localStorage-based / non-authenticated users)
    if (!userPrefs && (home_country || followed_countries || followed_topics)) {
      userPrefs = {
        home_country: home_country ? normalizeCountry(home_country) : null,
        followed_countries: followed_countries ? followed_countries.split(',').map(normalizeCountry) : [],
        followed_topics: followed_topics ? followed_topics.split(',') : [],
      };
    }

    const useEmbeddings = tasteVector && Array.isArray(tasteVector) && tasteVector.length > 0;

    // Personalized = private cache, unpersonalized = shared cache
    if (userPrefs) {
      res.setHeader('Cache-Control', 'private, max-age=120');
    } else {
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    }

    // -------------------------------------------------------
    // 2. Lightweight scoring query (small columns only, no text blobs)
    //    Embedding added only when user has a taste vector
    // -------------------------------------------------------
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const selectColumns = SCORING_COLUMNS + (useEmbeddings ? ', embedding' : '');

    const { data: allArticles, error: fetchError } = await supabase
      .from('published_articles')
      .select(selectColumns)
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(200);

    if (fetchError) {
      console.error('Main feed query error:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch articles' });
    }

    // -------------------------------------------------------
    // 3. Filter out test/invalid articles
    // -------------------------------------------------------
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    const filtered = (allArticles || []).filter(a => {
      const url = a?.url || '';
      const title = a?.title_news || '';
      const source = a?.source || '';
      if (/test/i.test(url) || /test/i.test(title) || /test/i.test(source)) return false;
      const articleDate = a.created_at || a.published_at;
      if (!articleDate) return false;
      const articleTime = new Date(articleDate).getTime();
      if (isNaN(articleTime)) return false;
      return (now - articleTime) < twentyFourHoursMs;
    });

    // -------------------------------------------------------
    // 4. Score each article (embedding-based or tag-based)
    // -------------------------------------------------------
    const scored = filtered.map(article => {
      if (!userPrefs) {
        return { id: article.id, _final_score: article.ai_final_score || 0, _match_reasons: [], _scoring_method: 'raw' };
      }

      const countries = safeJsonParse(article.countries, []);
      const topics = safeJsonParse(article.topics, []);
      const topicRelevance = safeJsonParse(article.topic_relevance, {});
      const countryRelevance = safeJsonParse(article.country_relevance, {});
      const articleEmbedding = article.embedding;

      // Embedding scoring if both user and article have vectors
      if (useEmbeddings && articleEmbedding && Array.isArray(articleEmbedding) && articleEmbedding.length > 0) {
        const embScore = calculateEmbeddingScore(
          { ...article, embedding: articleEmbedding },
          tasteVector,
          cosineSimilarity
        );
        // Scale 0-1 → 0-1500 to be comparable with tag-based scores
        return {
          id: article.id,
          _final_score: embScore.final_score * 1500,
          _match_reasons: [`Embedding: relevance=${embScore.content_relevance.toFixed(2)}, editorial=${embScore.editorial_importance.toFixed(2)}, recency=${embScore.recency.toFixed(2)}`],
          _scoring_method: 'embedding',
        };
      }

      // Fallback: tag-based scoring
      const result = calculateFinalScore(
        {
          ...article,
          base_score: article.ai_final_score,
          countries,
          topics,
          topic_relevance: topicRelevance,
          country_relevance: countryRelevance,
        },
        userPrefs
      );

      return {
        id: article.id,
        _final_score: result.final_score,
        _match_reasons: result.match_reasons,
        _scoring_method: 'tag',
      };
    });

    // -------------------------------------------------------
    // 5. Sort by personalized score DESC, then id DESC
    // -------------------------------------------------------
    scored.sort((a, b) => {
      if (b._final_score !== a._final_score) return b._final_score - a._final_score;
      return b.id - a.id;
    });

    // -------------------------------------------------------
    // 6. Parse cursor and paginate
    // -------------------------------------------------------
    // Cursor format: "score_id" e.g. "1050.5_36200"
    let cursorFiltered = scored;

    if (cursor) {
      const underscoreIdx = cursor.indexOf('_');
      if (underscoreIdx <= 0) {
        return res.status(400).json({ error: 'Invalid cursor format. Expected "score_id".' });
      }
      const cursorScore = parseFloat(cursor.substring(0, underscoreIdx));
      const cursorId = parseInt(cursor.substring(underscoreIdx + 1));
      if (isNaN(cursorScore) || isNaN(cursorId)) {
        return res.status(400).json({ error: 'Invalid cursor format. Expected "score_id".' });
      }

      cursorFiltered = scored.filter(a => {
        if (a._final_score < cursorScore) return true;
        if (a._final_score === cursorScore && a.id < cursorId) return true;
        return false;
      });
    }

    const hasMore = cursorFiltered.length > limit;
    const pageArticles = cursorFiltered.slice(0, limit);

    // Build next_cursor from last article on this page
    let nextCursor = null;
    if (hasMore && pageArticles.length > 0) {
      const last = pageArticles[pageArticles.length - 1];
      nextCursor = `${last._final_score}_${last.id}`;
    }

    // -------------------------------------------------------
    // 7. Full article data for this page only (20 rows max — safe even with all columns)
    // -------------------------------------------------------
    const pageIds = pageArticles.map(a => a.id);
    let fullArticleMap = {};
    let eventMap = {};

    if (pageIds.length > 0) {
      // Fetch full article data + world events in parallel
      const [fullDataResult, articleEventsResult] = await Promise.all([
        supabase
          .from('published_articles')
          .select('*')
          .in('id', pageIds),
        supabase
          .from('article_world_events')
          .select('article_id, event_id')
          .in('article_id', pageIds),
      ]);

      if (fullDataResult.data) {
        fullDataResult.data.forEach(a => { fullArticleMap[a.id] = a; });
      }

      // Resolve world events
      const articleEvents = articleEventsResult.data;
      if (articleEvents && articleEvents.length > 0) {
        try {
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
        } catch (e) {
          // Non-critical
        }
      }
    }

    // -------------------------------------------------------
    // 8. Format response using full article data
    // -------------------------------------------------------
    const formattedArticles = pageArticles.map(scoredArticle => {
      const fullArticle = fullArticleMap[scoredArticle.id] || scoredArticle;
      const formatted = formatArticle(fullArticle);
      formatted.final_score = scoredArticle._final_score;
      formatted.match_reasons = scoredArticle._match_reasons;
      formatted.scoring_method = scoredArticle._scoring_method;
      if (eventMap[scoredArticle.id]) {
        formatted.world_event = eventMap[scoredArticle.id];
      }
      return formatted;
    });

    return res.status(200).json({
      articles: formattedArticles,
      next_cursor: nextCursor,
      has_more: hasMore,
      total: scored.length,
    });

  } catch (error) {
    console.error('Main feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

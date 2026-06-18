import fs from 'fs';
import path from 'path';
import { createClient } from '../../lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { specificTagSet } from '../../lib/threads';

// Helper to parse JSON safely without excessive logging
const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
};

// Format article data for frontend (optimized - no logging per article)
const formatArticle = (article) => {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
  const summaryBulletsDetailed = safeJsonParse(article.summary_bullets_detailed, []);
  const summaryBullets = safeJsonParse(article.summary_bullets, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timelineData = safeJsonParse(article.timeline, null);
  const graphData = safeJsonParse(article.graph, null);
  
  // Parse map data
  let mapData = null;
  const rawMap = safeJsonParse(article.map, null);
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const primaryLocation = rawMap[0];
      const locationParts = [primaryLocation.name, primaryLocation.city, primaryLocation.country].filter(Boolean);
      mapData = {
        center: {
          lat: primaryLocation.coordinates?.lat || 0,
          lon: primaryLocation.coordinates?.lng || primaryLocation.coordinates?.lon || 0
        },
        markers: rawMap.slice(1).map(loc => ({
          lat: loc.coordinates?.lat || 0,
          lon: loc.coordinates?.lng || loc.coordinates?.lon || 0
        })),
        name: primaryLocation.name,
        location: locationParts.join(', '),
        city: primaryLocation.city,
        country: primaryLocation.country,
        region: primaryLocation.country,
        description: primaryLocation.description,
        location_type: primaryLocation.location_type || 'auto',
        region_name: primaryLocation.region_name || primaryLocation.country || null
      };
    } else if (!Array.isArray(rawMap)) {
      const locationParts = [rawMap.name, rawMap.city, rawMap.country].filter(Boolean);
      mapData = {
        center: {
          lat: rawMap.coordinates?.lat || rawMap.lat || 0,
          lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0
        },
        markers: [],
        name: rawMap.name,
        location: locationParts.join(', ') || rawMap.name,
        city: rawMap.city,
        country: rawMap.country,
        region: rawMap.country,
        description: rawMap.description,
        location_type: rawMap.location_type || 'auto',
        region_name: rawMap.region_name || rawMap.country || null
      };
    }
  }

  // Clean image URL
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
    cluster_id: article.cluster_id,
    version_number: article.version_number,
    urlToImage: cleanImageUrl,
    author: article.author,
    publishedAt: article.published_date || article.published_at,
    category: article.category,
    emoji: article.emoji || '📰',
    final_score: article.ai_final_score || 0,
    title_news: article.title_news || null,
    content_news: article.content_news || null,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsDetailed,
    five_ws: fiveWs,
    detailed_text: article.content_news || article.article || article.summary || article.description || '',
    summary_bullets: summaryBullets.length > 0 ? summaryBullets : summaryBulletsNews,
    timeline: timelineData,
    graph: graphData,
    map: mapData,
    components: article.components_order || safeJsonParse(article.components, null),
    details: article.details_section ? article.details_section.split('\n') : safeJsonParse(article.details, []),
    views: article.view_count || 0,
    interest_tags: safeJsonParse(article.interest_tags, []),
    countries: safeJsonParse(article.countries, []),
    topics: safeJsonParse(article.topics, []),
    topic_relevance: safeJsonParse(article.topic_relevance, {}),
    country_relevance: safeJsonParse(article.country_relevance, {}),
    // Multi-page carousel (curated content has 3-8 pages). Without this the
    // app collapses every article to a single title+photo page.
    pages: safeJsonParse(article.pages, null),
    format: article.format || null,
    source_type: article.source_type || null,
    // TodayPlus feed redesign payload (step13_feed_display.py). Nullable:
    // articles published before 2026-06-11 have none → legacy card fallback.
    display: safeJsonParse(article.display, null)
  };
};

// Server-side "fresh + important" ranking. The DB returns articles in pure
// ai_final_score order, which is FROZEN: the day's top-scored article stays at
// #1 for the whole 24h window, so the feed looks identical on every load and
// brand-new articles get buried.
//
// This re-ranks by importance * 0.5^(ageHours/halfLife) * (1 ± jitter) so recent
// high-importance articles surface, aging ones drift down, AND the order varies
// on every call — the feed visibly changes on refresh instead of looking static.
// Jitter is per-call random: /api/news is NOT edge-cached (vercel.json forces
// no-cache + the client adds a cache-buster), so there's no cache to keep valid.
// The ±18% band is wide enough to reshuffle the top tier each load but bounded,
// so a low-score article can't leap to the top. Mirrors applyFreshness.
function rankByFreshnessServer(articles, halfLifeHours = 8, jitter = 0.18) {
  if (!Array.isArray(articles) || articles.length <= 1) return articles || [];
  const now = Date.now();
  const STALE_AGE_HOURS = 48;
  const sorted = articles
    .map((a) => {
      const importance = typeof a.final_score === 'number' ? a.final_score : 0;
      const dateStr = a.publishedAt || a.created_at;
      const t = dateStr ? new Date(dateStr).getTime() : 0;
      const ageHours = (t && !Number.isNaN(t)) ? Math.max(0, (now - t) / 3600000) : STALE_AGE_HOURS;
      const noise = 1 + (Math.random() * 2 - 1) * jitter; // [1-jitter, 1+jitter]
      return { a, eff: importance * Math.pow(0.5, ageHours / halfLifeHours) * noise };
    })
    .sort((x, y) => y.eff - x.eff)
    .map((s) => s.a);

  // Category-diversity front-load so the top of the feed (and the guest
  // pre-paywall preview) isn't ~60% World+Politics. Cap each category group at
  // CAT_CAP in the front; defer overflow to the tail (never dropped). World +
  // Politics share one group (both "hard global news").
  const CAT_CAP = 5;
  const catGroup = (c) => {
    const k = String(c || 'Other').toLowerCase();
    return (k === 'world' || k === 'politics' || k === 'policy') ? 'world+politics' : k;
  };
  const counts = {};
  const kept = [];
  const deferred = [];
  for (const a of sorted) {
    const g = catGroup(a.category);
    if ((counts[g] || 0) < CAT_CAP) { counts[g] = (counts[g] || 0) + 1; kept.push(a); }
    else deferred.push(a);
  }
  return [...kept, ...deferred];
}

// ── Serve-time duplicate collapse (embedding-based, the real fix) ────────────
// The pipeline's world_event tag misses ~71% of dupes (and gave same_event=false
// for obvious twins like two "Kyiv missiles" stories). vq_secondary splits them
// too. Only the raw MiniLM embedding cosine catches them — so we cluster on that
// here, greedily, in RANK ORDER (the first/highest-ranked of a cluster is kept =
// the best-FOR-USER representative since the list is already personalized/ranked).
// Category-blocked + bounded comparison window so it stays O(n) for a serverless fn.
function parseEmbedding(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const a = JSON.parse(v); return Array.isArray(a) ? a : null; } catch { return null; } }
  return null;
}
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den > 0 ? dot / den : 0;
}
// Drop an article if it's a near-dup of an already-kept, higher-ranked one:
//   cosine >= 0.88                      → near-identical wire copy (any topic)
//   cosine >= 0.60 AND a shared topic   → same EVENT, different wording (the
//                                         "15 US-Iran articles" / "2 Kyiv" case)
// The shared-topic gate stops same-TOPIC-different-EVENT from over-merging.
function collapseDuplicates(rankedFormatted, embById) {
  const NEAR_DUP = 0.88, SAME_EVENT = 0.60, WINDOW = 80;
  const keptByCat = new Map();
  const out = [];
  for (const a of rankedFormatted) {
    const info = embById.get(a.id);
    const emb = info?.emb || null;
    const topics = info?.topics || [];
    const cat = a.category || '?';
    const kept = keptByCat.get(cat) || [];
    let dup = false;
    if (emb) {
      for (let i = kept.length - 1; i >= Math.max(0, kept.length - WINDOW); i--) {
        const k = kept[i];
        if (!k.emb) continue;
        const c = cosineSim(emb, k.emb);
        if (c >= NEAR_DUP || (c >= SAME_EVENT && topics.some((t) => k.topics.includes(t)))) { dup = true; break; }
      }
    }
    if (dup) continue;
    out.push(a);
    kept.push({ emb, topics });
    keptByCat.set(cat, kept);
  }
  return out;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Short edge cache: keep DB load low but let fresh pipeline articles (produced
  // ~every 20 min) enter the candidate pool quickly so the feed stays current.
  // The client cache-busts with ?t=, so this mainly bounds the SSR first paint.
  // (Was s-maxage=120 — long enough to make the feed feel stale on refresh.)
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Pagination support - fetch all articles on page 1 for client-side personalization
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 2000;
  const offset = (page - 1) * pageSize;

  // Check for test mode (for testing Timeline & Graph components)
  if (req.query.test === 'true') {
    try {
      const testFilePath = path.join(process.cwd(), 'public', 'test_timeline_graph.json');
      if (fs.existsSync(testFilePath)) {
        const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
        return res.status(200).json(testData);
      }
    } catch (error) {
      // Silently continue to fallback
    }
  }

  // Check if user wants only unread articles
  const onlyUnread = req.query.unread === 'true';
  
  // If user wants unread articles and is authenticated, use Supabase
  if (onlyUnread) {
    try {
      const supabase = createClient({ req, res });
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return res.status(401).json({ error: 'Authentication required for unread filter' });
      }

      const limit = parseInt(req.query.limit) || 50;
      
      // Get unread articles using the database function
      const { data: articles, error } = await supabase.rpc('get_unread_articles', {
        limit_count: limit
      });

      if (error) {
        // Fall back to regular news if Supabase fails
      } else if (articles && articles.length > 0) {
        const formattedArticles = articles.map(formatArticle);

        return res.status(200).json({
          status: 'ok',
          totalResults: formattedArticles.length,
          articles: formattedArticles,
          generatedAt: new Date().toISOString(),
          displayTimestamp: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          digest_date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          dailyGreeting: 'Your Unread News',
          readingTime: `${formattedArticles.length} unread articles`,
          displayDate: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).toUpperCase(),
          generatedAtUK: new Date().toISOString()
        });
      }
    } catch (error) {
      // Fall back to regular news
    }
  }

  // Try Supabase directly (no internal HTTP call - faster!)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Query published articles from last 24 hours
      // For large pageSize (>1000), fetch in batches to work around Supabase row limits
      console.log('📊 Querying published_articles, since:', twentyFourHoursAgo, 'page:', page, 'offset:', offset, 'pageSize:', pageSize);

      let articles = [];
      let error = null;
      let count = 0;
      const BATCH_SIZE = 1000;
      // Fetch a candidate POOL (>= 300) even for small pageSize, so the freshness
      // re-rank below can pull a brand-new lower-score article into the returned
      // slice (e.g. the 30-item SSR first paint) instead of only reshuffling the
      // top-30-by-score. For the client's full fetch (pageSize ~2000) this is a no-op.
      const totalNeeded = Math.max(pageSize, 300) + 10;

      for (let batchOffset = offset; batchOffset < offset + totalNeeded; batchOffset += BATCH_SIZE) {
        const batchEnd = Math.min(batchOffset + BATCH_SIZE - 1, offset + totalNeeded - 1);
        const result = await supabase
          .from('published_articles')
          .select('*', { count: 'exact' })
          .gte('created_at', twentyFourHoursAgo)
          .order('ai_final_score', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(batchOffset, batchEnd);

        if (result.error) { error = result.error; break; }
        if (result.count) count = result.count;
        if (result.data) articles = articles.concat(result.data);
        // Stop if we got fewer rows than requested (no more data)
        if (!result.data || result.data.length < (batchEnd - batchOffset + 1)) break;
      }

      console.log('📊 Query result:', {
        error: error?.message || 'none',
        articlesCount: articles?.length || 0
      });

      if (!error && articles && articles.length > 0) {
        // Fast filter without logging
        const now = Date.now();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        
        const filteredArticles = articles.filter(a => {
          const url = a?.url || '';
          const title = a?.title_news || a?.title || '';
          const source = a?.source || '';
          if (url && (/test/i.test(url) || /test/i.test(title) || /test/i.test(source))) {
            return false;
          }
          const articleDate = a.created_at || a.added_at || a.published_date || a.published_at;
          if (!articleDate) return false;
          const articleTime = new Date(articleDate).getTime();
          if (isNaN(articleTime)) return false;
          return (now - articleTime) < twentyFourHoursMs;
        });

        // Fetch event associations for top articles only (limit to 100 to keep query fast)
        const articleIds = filteredArticles.slice(0, 100).map(a => a.id);
        let eventMap = {};
        
        try {
          // Get article-event associations
          const { data: articleEvents } = await supabase
            .from('article_world_events')
            .select('article_id, event_id')
            .in('article_id', articleIds);
          
          if (articleEvents && articleEvents.length > 0) {
            // Get unique event IDs
            const eventIds = [...new Set(articleEvents.map(ae => ae.event_id))];
            
            // Fetch event details
            const { data: events } = await supabase
              .from('world_events')
              .select('id, name, slug')
              .in('id', eventIds);
            
            if (events) {
              // Create event lookup
              const eventLookup = {};
              events.forEach(e => { eventLookup[e.id] = e; });
              
              // Map articles to their events
              articleEvents.forEach(ae => {
                if (eventLookup[ae.event_id]) {
                  eventMap[ae.article_id] = eventLookup[ae.event_id];
                }
              });
            }
          }
        } catch (eventError) {
          console.log('⚠️ Event fetch failed (non-critical):', eventError.message);
        }

        // Flag cards belonging to today's "Quiet Deep Dive" story so the client
        // can show "Go deep on this". A card qualifies if it's the exact anchor,
        // or a true thread-sibling (same cluster AND shares the anchor's specific
        // tags) — NOT merely the same cluster, which over-flags loosely-related
        // cards. Best-effort + cheap.
        let deepDives = [];
        try {
          const { data: dives } = await supabase
            .from('deep_dives')
            .select('id, slug, anchor_article_id, vq_secondary, headline, reading_time_min')
            .eq('status', 'published')
            .order('dive_date', { ascending: false })
            .limit(2);
          if (dives && dives.length) {
            const anchorIds = dives.map(d => d.anchor_article_id).filter(x => x != null);
            const anchorTags = {};
            if (anchorIds.length) {
              const { data: anchorRows } = await supabase
                .from('published_articles').select('id, interest_tags').in('id', anchorIds);
              (anchorRows || []).forEach(r => { anchorTags[String(r.id)] = specificTagSet(r.interest_tags); });
            }
            deepDives = dives.map(d => ({
              flag: { available: true, slug: d.slug, id: d.id, headline: d.headline, readingTimeMin: d.reading_time_min },
              anchorId: d.anchor_article_id != null ? String(d.anchor_article_id) : null,
              vq: d.vq_secondary,
              tags: anchorTags[String(d.anchor_article_id)] || new Set(),
            }));
          }
        } catch (ddError) {
          console.log('⚠️ Deep-dive fetch failed (non-critical):', ddError.message);
        }
        const deepDiveFor = (article) => {
          for (const dd of deepDives) {
            if (dd.anchorId && String(article.id) === dd.anchorId) return dd.flag;
            if (dd.vq != null && article.vq_secondary === dd.vq && dd.tags.size) {
              const cardTags = specificTagSet(article.interest_tags);
              let shared = 0;
              for (const t of cardTags) if (dd.tags.has(t)) shared++;
              if (shared >= 2) return dd.flag;
            }
          }
          return null;
        };

        // Format the whole candidate pool, re-rank by the fresh+important blend,
        // THEN slice to pageSize — so the returned articles (incl. the SSR first
        // paint) prioritise recent high-importance stories, not a frozen pure-score
        // order. Ranking is deterministic (cacheable); the client adds per-load jitter.
        // id → embedding + topics from the RAW rows (formatArticle strips the
        // heavy embedding before it reaches the client; we need it here to dedupe).
        const embById = new Map();
        for (const article of filteredArticles) {
          embById.set(article.id, {
            emb: parseEmbedding(article.embedding_minilm_vec),
            topics: safeJsonParse(article.topics, []),
          });
        }
        const formattedPool = filteredArticles.map(article => {
          const formatted = formatArticle(article);
          if (eventMap[article.id]) {
            formatted.world_event = eventMap[article.id];
          }
          // "Go deep on this": anchor or a true thread-sibling of the deep dive.
          const dd = deepDiveFor(article);
          if (dd) formatted.deepDive = dd;
          return formatted;
        });
        // Rank (importance × freshness) FIRST, then collapse near-duplicate
        // stories (keeps the highest-ranked representative), then slice. This is
        // what kills the "same story 15×" / adjacent-twin problem on the guest feed.
        const ranked = rankByFreshnessServer(formattedPool);
        const deduped = collapseDuplicates(ranked, embById);
        console.log(`🧹 [dedup] collapsed ${ranked.length - deduped.length} near-duplicate stories (pool ${ranked.length} → ${deduped.length})`);
        const formattedArticles = deduped.slice(0, pageSize);

        const totalCount = count || formattedArticles.length;
        const hasMore = (offset + pageSize) < totalCount;

        console.log('📊 Pagination:', { page, offset, pageSize, totalCount, hasMore, returnedCount: formattedArticles.length });

        return res.status(200).json({
          status: 'ok',
          totalResults: totalCount,
          articles: formattedArticles,
          pagination: {
            page,
            pageSize,
            total: totalCount,
            hasMore
          },
          generatedAt: new Date().toISOString(),
          displayTimestamp: new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          })
        });
      }
    }
  } catch (fetchError) {
    console.log(`⚠️ Direct Supabase query failed: ${fetchError.message}`);
  }

  // Pagination guard: pages beyond the available data must END the feed —
  // never fall through to the outage fallbacks below, whose sample article
  // ("Ten News System Active") was leaking into infinite scroll as endless
  // placeholder cards. Fallbacks are a page-1 outage path only.
  if (page > 1) {
    return res.status(200).json({
      status: 'ok',
      totalResults: 0,
      articles: [],
      pagination: { page, pageSize, total: 0, hasMore: false },
      generatedAt: new Date().toISOString(),
    });
  }

  // FALLBACK 0.5: Try without 24h filter (get most recent articles)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
      console.log('📊 FALLBACK: Querying without time filter...');
      
      const { data: articles, error } = await supabase
        .from('published_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(pageSize);

      console.log('📊 FALLBACK result:', { 
        error: error?.message || 'none', 
        articlesCount: articles?.length || 0,
        latestArticleDate: articles?.[0]?.created_at || 'none'
      });

      if (!error && articles && articles.length > 0) {
        const formattedArticles = articles.map(formatArticle);

        return res.status(200).json({
          status: 'ok',
          totalResults: formattedArticles.length,
          articles: formattedArticles,
          pagination: { page, pageSize, total: formattedArticles.length, hasMore: false },
          generatedAt: new Date().toISOString(),
          dailyGreeting: "Recent News (no fresh articles in 24h)",
          displayTimestamp: new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })
        });
      }
    }
  } catch (fallbackError) {
    console.log(`⚠️ Fallback query failed: ${fallbackError.message}`);
  }

  // FALLBACK 1: Try test example news (for development/testing only)
  try {
    const testFilePath = path.join(process.cwd(), 'public', 'test_example_news.json');
    if (fs.existsSync(testFilePath)) {
      const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      console.log('✅ Serving TEST EXAMPLE news with photos and content');
      
      // Apply pagination if articles exist
      if (testData.articles && Array.isArray(testData.articles)) {
        const paginatedArticles = testData.articles.slice(offset, offset + pageSize);
        const hasMore = (offset + pageSize) < testData.articles.length;
        
        return res.status(200).json({
          ...testData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: testData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(testData);
    }
  } catch (error) {
    console.log(`⚠️  Error loading test example: ${error.message}`);
  }

  // FALLBACK 2: Try to read today's news file from public directory
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '_');
    
    const newsFileName = `tennews_data_${dateStr}.json`;
    const newsFilePath = path.join(process.cwd(), 'public', newsFileName);
    
    if (fs.existsSync(newsFilePath)) {
      const newsData = JSON.parse(fs.readFileSync(newsFilePath, 'utf8'));
      console.log(`✅ Serving news data from file: ${newsFileName}`);
      
      // Apply pagination if articles exist
      if (newsData.articles && Array.isArray(newsData.articles)) {
        const paginatedArticles = newsData.articles.slice(offset, offset + pageSize);
        const hasMore = (offset + pageSize) < newsData.articles.length;
        
        return res.status(200).json({
          ...newsData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: newsData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(newsData);
    }
  } catch (error) {
    console.log(`⚠️  Error reading today's file: ${error.message}`);
  }
    
  // FALLBACK 2: Find most recent news file in public directory
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir);
    const newsFiles = files
      .filter(file => file.startsWith('tennews_data_') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (newsFiles.length > 0) {
      const latestNewsFile = newsFiles[0];
      const latestNewsPath = path.join(publicDir, latestNewsFile);
      const newsData = JSON.parse(fs.readFileSync(latestNewsPath, 'utf8'));
      console.log(`✅ Serving recent news data from file: ${latestNewsFile}`);
      
      // Apply pagination if articles exist
      if (newsData.articles && Array.isArray(newsData.articles)) {
        const paginatedArticles = newsData.articles.slice(offset, offset + pageSize);
        const hasMore = (offset + pageSize) < newsData.articles.length;
        
        return res.status(200).json({
          ...newsData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: newsData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(newsData);
    }
  } catch (error) {
    console.log(`⚠️  Error finding recent files: ${error.message}`);
  }
    
  // FALLBACK 3: No news files found - return sample data
  const sampleData = {
    "digest_date": new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    "articles": [{
      "rank": 1,
      "emoji": "📰",
      "title": "Ten News System Active",
      "summary": "Your automated news system is running. Fresh articles will appear here soon!",
      "details": ["RSS Fetcher Active", "AI Filter Running", "Live Updates"],
      "category": "System",
      "source": "Ten News",
      "url": "#"
    }],
    "dailyGreeting": "Welcome to Ten News!",
    "readingTime": "1 minute read",
    "displayDate": new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase(),
    "generatedAt": new Date().toISOString(),
    "generatedAtUK": new Date().toISOString()
  };
  
  return res.status(200).json(sampleData);
}

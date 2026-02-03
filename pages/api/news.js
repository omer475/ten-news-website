import fs from 'fs';
import path from 'path';
import { createClient } from '../../lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
    interest_tags: safeJsonParse(article.interest_tags, [])
  };
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // AGGRESSIVE no-caching - prevent all forms of caching
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '-1');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Pagination support - load 30 articles at a time to prevent browser crashes
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 30;
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
      console.log('📊 Querying published_articles, since:', twentyFourHoursAgo);
      
      const { data: articles, error } = await supabase
        .from('published_articles')
        .select('id, title_news, url, source, content_news, created_at, added_at, published_date, published_at, num_sources, cluster_id, version_number, image_url, author, category, emoji, ai_final_score, summary_bullets_news, summary_bullets_detailed, summary_bullets, five_ws, timeline, graph, map, components_order, components, details_section, details, view_count, interest_tags')
        .gte('created_at', twentyFourHoursAgo)
        .order('ai_final_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(pageSize + 10);

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

        const formattedArticles = filteredArticles.slice(0, pageSize).map(formatArticle);
        const hasMore = filteredArticles.length > pageSize;

        return res.status(200).json({
          status: 'ok',
          totalResults: formattedArticles.length,
          articles: formattedArticles,
          pagination: {
            page,
            pageSize,
            total: formattedArticles.length,
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

  // FALLBACK 0.5: Try without 24h filter (get most recent articles)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
      console.log('📊 FALLBACK: Querying without time filter...');
      
      const { data: articles, error } = await supabase
        .from('published_articles')
        .select('id, title_news, url, source, content_news, created_at, added_at, published_date, published_at, num_sources, cluster_id, version_number, image_url, author, category, emoji, ai_final_score, summary_bullets_news, summary_bullets_detailed, summary_bullets, five_ws, timeline, graph, map, components_order, components, details_section, details, view_count, interest_tags')
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
        const paginatedArticles = testData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < testData.articles.length;
        
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
        const paginatedArticles = newsData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < newsData.articles.length;
        
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
        const paginatedArticles = newsData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < newsData.articles.length;
        
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

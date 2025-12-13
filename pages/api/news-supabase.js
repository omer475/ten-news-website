import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️  Supabase not configured, falling back...')
      throw new Error('Supabase not configured')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 30;
    const offset = (page - 1) * pageSize;
    
    // Fetch published articles from last 24 hours, sorted by score (highest first)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // First get total count
    const { count: totalCount } = await supabase
      .from('published_articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);
    
    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false, nullsFirst: false })  // Primary: Score (highest first)
      .order('created_at', { ascending: false })  // Secondary: Date (tie-breaker)
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    console.log(`\n🔍 RAW SUPABASE QUERY RESULT: ${articles?.length || 0} articles fetched`)

    // Filter out test records AND articles older than 24 hours
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    
    let testFilteredCount = 0;
    let dateFilteredCount = 0;
    let noDateCount = 0;
    
    const filteredArticles = (articles || []).filter(a => {
      // Filter out test articles
      const url = a?.url || ''
      const title = a?.title_news || a?.title || ''  // Check title_news first (new schema)
      const source = a?.source || ''
      const isNotTest = url && !/test/i.test(url) && !/test/i.test(title) && !/test/i.test(source);
      
      if (!isNotTest) {
        testFilteredCount++;
        return false;
      }
      
      // Filter by when article was added to database (not when originally published)
      // This shows all articles added in last 24h, even if news is older
      const articleDate = a.created_at || a.added_at || a.published_date || a.published_at;
      
      if (!articleDate) {
        noDateCount++;
        console.warn('⚠️ Article missing ALL date fields, excluding:', title);
        return false;
      }
      
      const articleTime = new Date(articleDate).getTime();
      if (isNaN(articleTime)) {
        console.warn('⚠️ Invalid article date, excluding:', title);
        return false;
      }
      
      const ageMs = now - articleTime;
      const isRecent = ageMs < twentyFourHoursMs;
      
      if (!isRecent) {
        dateFilteredCount++;
        const hoursOld = (ageMs / (1000 * 60 * 60)).toFixed(1);
        const daysOld = (hoursOld / 24).toFixed(1);
        console.log(`🗑️ Filtering out old news (${hoursOld}h / ${daysOld}d old):`, title);
      }
      
      return isRecent;
    })

    console.log(`\n📊 DETAILED FILTER STATS:`)
    console.log(`  ✅ Fetched from Supabase: ${articles?.length || 0} articles`)
    console.log(`  🧪 Filtered as test articles: ${testFilteredCount}`)
    console.log(`  📅 Filtered (added > 24h ago): ${dateFilteredCount}`)
    console.log(`  ⏰ Missing ALL date fields: ${noDateCount}`)
    console.log(`  ✅ Final count: ${filteredArticles.length} articles`)
    console.log(`  🔍 Expected: ~136 articles added in last 24 hours`)
    console.log(`  ❓ Missing articles: ${136 - filteredArticles.length}\n`)

    // Format for frontend
    const formattedArticles = filteredArticles.map(article => {
      let timelineData = null;
      if (article.timeline) {
        try {
          timelineData = typeof article.timeline === 'string' 
            ? JSON.parse(article.timeline) 
            : article.timeline;
        } catch (e) {
          console.error('Error parsing timeline:', e);
        }
      }

      // Parse graph if it's a string
      let graphData = null;
      if (article.graph) {
        try {
          graphData = typeof article.graph === 'string' 
            ? JSON.parse(article.graph) 
            : article.graph;
        } catch (e) {
          console.error('Error parsing graph:', e);
        }
      }

      // Parse summary_bullets if it's a string
      let summaryBullets = [];
      if (article.summary_bullets) {
        try {
          summaryBullets = typeof article.summary_bullets === 'string'
            ? JSON.parse(article.summary_bullets)
            : article.summary_bullets;
        } catch (e) {
          console.error('Error parsing summary_bullets:', e);
          summaryBullets = [];
        }
      }

      // Parse dual-language bullets if they're strings
      let summaryBulletsNews = [];
      let summaryBulletsDetailed = [];
      
      if (article.summary_bullets_news) {
        try {
          summaryBulletsNews = typeof article.summary_bullets_news === 'string'
            ? JSON.parse(article.summary_bullets_news)
            : article.summary_bullets_news;
        } catch (e) {
          console.error('Error parsing summary_bullets_news:', e);
        }
      }
      
      if (article.summary_bullets_detailed) {
        try {
          summaryBulletsDetailed = typeof article.summary_bullets_detailed === 'string'
            ? JSON.parse(article.summary_bullets_detailed)
            : article.summary_bullets_detailed;
          console.log(`✅ Article ${article.id} has detailed bullets:`, summaryBulletsDetailed?.length || 0, 'items');
        } catch (e) {
          console.error('Error parsing summary_bullets_detailed:', e);
        }
      } else {
        console.log(`⚠️ Article ${article.id} has NO detailed bullets in database`);
      }

      // Parse five_ws (5 W's format) if it exists
      let fiveWs = null;
      console.log(`📋 Article ${article.id} raw five_ws:`, typeof article.five_ws, article.five_ws);
      if (article.five_ws) {
        try {
          fiveWs = typeof article.five_ws === 'string'
            ? JSON.parse(article.five_ws)
            : article.five_ws;
          console.log(`✅ Article ${article.id} has 5W's data:`, JSON.stringify(fiveWs));
        } catch (e) {
          console.error('Error parsing five_ws:', e);
          fiveWs = null;
        }
      } else {
        console.log(`⚠️ Article ${article.id} has NO five_ws in database`);
      }

      return {
        id: article.id,
        // Support both old 'title' and new 'title_news' fields
        title: article.title_news || article.title,
        // Support both old 'url' and new cluster-based url
        url: article.url,
        // Support both old 'source' and new 'source' fields
        source: article.source || 'Today+',
        // Use content_news as description fallback
        description: article.description || (article.content_news ? article.content_news.substring(0, 200) + '...' : ''),
        // Support both old 'content' and new 'content_news' fields
        content: article.content_news || article.content,
        created_at: article.created_at,  // DEBUG: Include to check if this field exists
        // Metadata from new schema
        num_sources: article.num_sources,
        cluster_id: article.cluster_id,
        version_number: article.version_number,
        // Ensure image URL is always passed if it exists and is valid
        urlToImage: (() => {
          const imgUrl = article.image_url;
          if (!imgUrl) return null;
          
          // Handle different data types
          const urlStr = typeof imgUrl === 'string' ? imgUrl.trim() : String(imgUrl).trim();
          
          // Validate URL
          if (urlStr === '' || 
              urlStr === 'null' || 
              urlStr === 'undefined' || 
              urlStr === 'None' ||
              urlStr.toLowerCase() === 'null' ||
              urlStr.length < 5) {
            return null;
          }
          
          // Return cleaned URL
          return urlStr;
        })(),  // Frontend expects 'urlToImage'
        author: article.author,
        publishedAt: article.published_date || article.published_at,
        category: article.category,
        emoji: article.emoji || '📰',
        final_score: article.ai_final_score || 0, // Old field, default to 0 for new articles
        
        // Content fields
        title_news: article.title_news || null,
        content_news: article.content_news || null,
        // Bullets - standard (60-80 chars) and detailed (90-120 chars)
        summary_bullets_news: summaryBulletsNews,
        summary_bullets_detailed: summaryBulletsDetailed,
        // 5 W's format (WHO/WHAT/WHEN/WHERE/WHY)
        five_ws: fiveWs,
        
        // Legacy fields for backward compatibility (fallback to new fields)
        detailed_text: article.content_news || article.article || article.summary || article.description || '',
        summary_bullets: summaryBullets.length > 0 ? summaryBullets : summaryBulletsNews,
        
        timeline: timelineData,
        graph: graphData,  // Include graph data
        // Support both 'components_order' (new) and 'components' (old)
        components: article.components_order || (article.components ? (typeof article.components === 'string' ? JSON.parse(article.components) : article.components) : null),
        details: article.details_section ? article.details_section.split('\n') : (article.details ? (typeof article.details === 'string' ? JSON.parse(article.details) : article.details) : []),
        views: article.view_count || 0
      };
    })

    // Calculate if there are more pages
    const hasMore = offset + formattedArticles.length < (totalCount || 0);
    
    return res.status(200).json({
      status: 'ok',
      totalResults: formattedArticles.length,
      articles: formattedArticles,
      pagination: {
        page,
        pageSize,
        total: totalCount || formattedArticles.length,
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
    })

  } catch (error) {
    console.error('Error fetching from Supabase:', error)
    
    // Return empty but valid response
    return res.status(200).json({
      status: 'ok',
      totalResults: 0,
      articles: [],
      generatedAt: new Date().toISOString(),
      displayTimestamp: new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    })
  }
}

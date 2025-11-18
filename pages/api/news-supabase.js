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

    // Fetch published articles from last 24 hours, sorted by score
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('published', true)
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false, nullsLast: true })
      .limit(500)

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
      const title = a?.title || ''
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

      // Parse dual-language bullet arrays
      let summaryBulletsNews = [];
      if (article.summary_bullets_news) {
        try {
          summaryBulletsNews = typeof article.summary_bullets_news === 'string'
            ? JSON.parse(article.summary_bullets_news)
            : article.summary_bullets_news;
        } catch (e) {
          console.error('Error parsing summary_bullets_news:', e);
          summaryBulletsNews = [];
        }
      }

      let summaryBulletsB2 = [];
      if (article.summary_bullets_b2) {
        try {
          summaryBulletsB2 = typeof article.summary_bullets_b2 === 'string'
            ? JSON.parse(article.summary_bullets_b2)
            : article.summary_bullets_b2;
        } catch (e) {
          console.error('Error parsing summary_bullets_b2:', e);
          summaryBulletsB2 = [];
        }
      }

      return {
        id: article.id,
        title: article.title,
        url: article.url,
        source: article.source,
        description: article.description,
        content: article.content,
        created_at: article.created_at,  // DEBUG: Include to check if this field exists
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
        final_score: article.ai_final_score,
        detailed_text: article.article || article.summary || article.description || '',  // NEW: Use 'article' field
        summary_bullets: summaryBullets,
        // Dual-language fields for Advanced/B2 modes
        title_news: article.title_news || null,
        title_b2: article.title_b2 || null,
        summary_bullets_news: summaryBulletsNews,
        summary_bullets_b2: summaryBulletsB2,
        content_news: article.content_news || null,
        content_b2: article.content_b2 || null,
        timeline: timelineData,
        graph: graphData,  // Include graph data
        components: article.components ? (typeof article.components === 'string' ? JSON.parse(article.components) : article.components) : null,  // Include component order
        details: article.details_section ? article.details_section.split('\n') : [],
        views: article.view_count || 0
      };
    })

    return res.status(200).json({
      status: 'ok',
      totalResults: formattedArticles.length,
      articles: formattedArticles,
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


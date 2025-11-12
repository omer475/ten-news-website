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

    // Fetch published articles from Supabase - only news published in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('published', true)
      .gte('published_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false, nullsLast: true })
      .order('published_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Filter out test records AND articles older than 24 hours
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    
    const filteredArticles = (articles || []).filter(a => {
      // Filter out test articles
      const url = a?.url || ''
      const title = a?.title || ''
      const source = a?.source || ''
      const isNotTest = url && !/test/i.test(url) && !/test/i.test(title) && !/test/i.test(source);
      
      if (!isNotTest) return false;
      
      // Filter by when news was originally published (not when added to database)
      const articleDate = a.published_at || a.published_date || a.added_at;
      if (!articleDate) {
        console.warn('⚠️ Article missing publication date, excluding:', title);
        return false; // Exclude articles without publication dates
      }
      
      const articleTime = new Date(articleDate).getTime();
      const ageMs = now - articleTime;
      
      if (isNaN(articleTime)) {
        console.warn('⚠️ Invalid article date, excluding:', title);
        return false;
      }
      
      const isRecent = ageMs < twentyFourHoursMs;
      
      if (!isRecent) {
        const hoursOld = (ageMs / (1000 * 60 * 60)).toFixed(1);
        console.log(`🗑️ Filtering out old news (${hoursOld}h old):`, title);
      }
      
      return isRecent;
    })

    console.log(`✅ Fetched ${articles?.length || 0} articles from Supabase`)
    console.log(`✅ Serving ${filteredArticles.length} articles after filtering tests and old articles`)

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


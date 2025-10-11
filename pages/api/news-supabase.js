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

    // Fetch published articles from Supabase
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    console.log(`✅ Fetched ${articles?.length || 0} articles from Supabase`)

    // Format for frontend
    const formattedArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      url: article.url,
      source: article.source,
      description: article.description,
      content: article.content,
      urlToImage: article.image_url,  // Frontend expects 'urlToImage'
      author: article.author,
      publishedAt: article.published_date || article.published_at,
      category: article.category,
      emoji: article.emoji || '📰',
      final_score: article.ai_final_score,
      summary: article.summary,
      timeline: article.timeline ? JSON.parse(article.timeline) : null,
      details: article.details_section,
      views: article.view_count || 0
    }))

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


import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const CATEGORY_EMOJIS = {
  'Soccer': '⚽', 'Basketball': '🏀', 'Football': '🏈', 'Baseball': '⚾',
  'Cricket': '🏏', 'Motorsport': '🏎️', 'Combat Sports': '🥊', 'Tennis': '🎾',
  'Golf': '⛳', 'Sports Events': '🏅',
  'AI & Tech': '🤖', 'Finance': '💰', 'Business': '💼', 'Crypto': '🪙',
  'US Politics': '🇺🇸', 'World Politics': '🌍',
  'Entertainment': '🎬', 'K-Pop & Music': '🎵',
  'Science': '🔬', 'Health': '🏥', 'Food': '🍽️',
  'Lifestyle': '✨', 'Automotive': '🚗',
  'Gaming': '🎮', 'Fashion': '👟', 'Skincare': '✨',
  'Beauty': '💄', 'Travel': '✈️'
}

/**
 * GET /api/search/trending
 *
 * Returns trending entities (most articles in last 24h) for the
 * empty search state. Called once when user opens search tab.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get recent articles' tags to find trending entities
    const { data: recentArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .gte('published_at', cutoff)
      .lte('published_at', new Date().toISOString())
      .not('interest_tags', 'is', null)
      .limit(500)

    // Count tag frequency
    const tagCounts = {}
    for (const article of (recentArticles || [])) {
      const tags = article.interest_tags || []
      // Only count first 4 tags (primary topics)
      for (const tag of tags.slice(0, 4)) {
        const t = tag.toLowerCase()
        tagCounts[t] = (tagCounts[t] || 0) + 1
      }
    }

    // Match against concept_entities
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag]) => tag)

    if (topTags.length === 0) {
      return res.status(200).json({ trending: [] })
    }

    const { data: entities } = await supabase
      .from('concept_entities')
      .select('entity_name, display_title, category')
      .in('entity_name', topTags)
      .limit(20)

    // Sort by article count and ensure category diversity (max 2 per category)
    const entitySet = new Set((entities || []).map(e => e.entity_name))
    const trending = (entities || [])
      .map(e => ({
        entity_name: e.entity_name,
        display_title: e.display_title,
        category: e.category,
        emoji: CATEGORY_EMOJIS[e.category] || '📰',
        article_count: tagCounts[e.entity_name] || 0
      }))
      .sort((a, b) => b.article_count - a.article_count)

    // Cap at 2 per category for diversity
    const catCount = {}
    const diverse = trending.filter(e => {
      catCount[e.category] = (catCount[e.category] || 0) + 1
      return catCount[e.category] <= 2
    }).slice(0, 8)

    return res.status(200).json({ trending: diverse })
  } catch (err) {
    console.error('[search/trending] Error:', err)
    return res.status(500).json({ error: 'Failed to fetch trending' })
  }
}

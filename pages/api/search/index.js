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
 * GET /api/search?q=<query>&user_id=<uuid>&page=0&limit=40
 *
 * Returns articles (ranked by engagement) + matching entities.
 * Articles include ALL published articles regardless of shelf_life.
 * Entities are matched by name/alias overlap with the query.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q, user_id, page = '0', limit = '40' } = req.query

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const query = q.trim().toLowerCase()
  const pageNum = parseInt(page, 10) || 0
  const pageSize = Math.min(parseInt(limit, 10) || 40, 100)
  const offset = pageNum * pageSize

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Run article search and entity search in parallel
    const [articlesResult, entitiesResult] = await Promise.all([
      searchArticles(supabase, query, pageSize, offset),
      pageNum === 0 ? searchEntities(supabase, query) : { entities: [] }
    ])

    // For matched entities, fetch their top articles for carousels
    let entitiesWithArticles = []
    if (entitiesResult.entities.length > 0) {
      entitiesWithArticles = await fetchEntityArticles(
        supabase,
        entitiesResult.entities,
        articlesResult.articleIds // exclude articles already in main results
      )
    }

    return res.status(200).json({
      articles: articlesResult.articles,
      entities: entitiesWithArticles,
      total_articles: articlesResult.total,
      page: pageNum,
      has_more: offset + pageSize < articlesResult.total,
      query: q.trim()
    })
  } catch (err) {
    console.error('[search] Error:', err)
    return res.status(500).json({ error: 'Search failed' })
  }
}

/**
 * Search articles by title and interest_tags.
 * Returns ALL articles (no shelf_life filter) ordered by engagement.
 */
async function searchArticles(supabase, query, limit, offset) {
  const words = query.split(/\s+/).filter(w => w.length >= 2)

  // Build OR filter: title matches OR any interest_tag matches
  // We use ilike for title and cs (contains) for tags
  const titleFilter = words.map(w => `title_news.ilike.%${w}%`).join(',')

  // Query articles — search by title match
  // We'll also do a separate tag search and merge
  const [titleResult, tagResult] = await Promise.all([
    supabase
      .from('published_articles')
      .select('id, title_news, image_url, category, interest_tags, ai_final_score, like_count, engagement_count, published_at, shelf_life_days, author_id, author_name', { count: 'exact' })
      .filter('published_at', 'lte', new Date().toISOString())
      .or(titleFilter)
      .order('like_count', { ascending: false, nullsFirst: false })
      .order('engagement_count', { ascending: false, nullsFirst: false })
      .order('ai_final_score', { ascending: false, nullsFirst: false })
      .range(0, limit + offset + 50), // fetch extra to merge with tag results

    // Tag-based search: find articles where interest_tags contain the query words
    supabase
      .from('published_articles')
      .select('id, title_news, image_url, category, interest_tags, ai_final_score, like_count, engagement_count, published_at, shelf_life_days, author_id, author_name')
      .filter('published_at', 'lte', new Date().toISOString())
      .contains('interest_tags', [query])
      .order('like_count', { ascending: false, nullsFirst: false })
      .order('engagement_count', { ascending: false, nullsFirst: false })
      .range(0, 100)
  ])

  // Merge and deduplicate
  const seen = new Set()
  const allArticles = []

  const addArticles = (articles) => {
    if (!articles) return
    for (const a of articles) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        allArticles.push(a)
      }
    }
  }

  addArticles(titleResult.data)
  addArticles(tagResult.data)

  // Score and sort by engagement
  allArticles.sort((a, b) => {
    const scoreA = computeSearchRank(a, query)
    const scoreB = computeSearchRank(b, query)
    return scoreB - scoreA
  })

  // Paginate
  const paginated = allArticles.slice(offset, offset + limit)

  return {
    articles: paginated.map(formatArticle),
    articleIds: new Set(paginated.map(a => a.id)),
    total: allArticles.length
  }
}

/**
 * Compute a search ranking score combining relevance + engagement.
 */
function computeSearchRank(article, query) {
  let score = 0

  // Title relevance (highest signal)
  const title = (article.title_news || '').toLowerCase()
  if (title.includes(query)) {
    score += 100 // exact phrase match in title
  } else {
    const words = query.split(/\s+/)
    const matched = words.filter(w => title.includes(w)).length
    score += (matched / words.length) * 60
  }

  // Tag relevance
  const tags = article.interest_tags || []
  if (tags.some(t => t.toLowerCase() === query)) {
    score += 40 // exact tag match
  } else if (tags.some(t => t.toLowerCase().includes(query))) {
    score += 20 // partial tag match
  }

  // Engagement signals
  score += Math.min((article.like_count || 0) * 3, 50)
  score += Math.min((article.engagement_count || 0) * 2, 40)
  score += Math.min((article.ai_final_score || 0) / 20, 30)

  return score
}

/**
 * Search entities by name and aliases.
 */
async function searchEntities(supabase, query) {
  // Search by entity_name prefix + display_title contains
  const { data: entities, error } = await supabase
    .from('concept_entities')
    .select('id, entity_name, display_title, category, aliases, popularity_score')
    .or(`entity_name.ilike.%${query}%,display_title.ilike.%${query}%`)
    .order('popularity_score', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[search] Entity search error:', error)
    return { entities: [] }
  }

  // Also check aliases — Supabase doesn't support ilike on array elements easily,
  // so we filter in JS for alias matches
  let matched = entities || []

  // If few direct matches, try alias matching with a broader query
  if (matched.length < 3) {
    const { data: aliasEntities } = await supabase
      .from('concept_entities')
      .select('id, entity_name, display_title, category, aliases, popularity_score')
      .not('aliases', 'is', null)
      .limit(200)

    if (aliasEntities) {
      const aliasMatches = aliasEntities.filter(e => {
        if (matched.some(m => m.id === e.id)) return false // already matched
        return (e.aliases || []).some(alias =>
          alias.toLowerCase().includes(query)
        )
      })
      matched = [...matched, ...aliasMatches.slice(0, 5)]
    }
  }

  return {
    entities: matched.map(e => ({
      id: e.id,
      entity_name: e.entity_name,
      display_title: e.display_title,
      category: e.category,
      emoji: CATEGORY_EMOJIS[e.category] || '📰',
      popularity_score: e.popularity_score
    }))
  }
}

/**
 * For each matched entity, fetch their top articles for the carousel.
 */
async function fetchEntityArticles(supabase, entities, excludeIds) {
  const results = await Promise.all(
    entities.slice(0, 5).map(async (entity) => {
      // Find articles where interest_tags contain the entity name
      // or title contains the entity name
      const { data: articles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, like_count, engagement_count, ai_final_score, published_at, author_id, author_name')
        .filter('published_at', 'lte', new Date().toISOString())
        .or(`title_news.ilike.%${entity.entity_name}%,interest_tags.cs.{${entity.entity_name}}`)
        .order('like_count', { ascending: false, nullsFirst: false })
        .order('engagement_count', { ascending: false, nullsFirst: false })
        .limit(12)

      const filtered = (articles || [])
        .filter(a => !excludeIds.has(a.id))

      if (filtered.length === 0) return null

      return {
        ...entity,
        article_count: filtered.length,
        articles: filtered.slice(0, 8).map(formatArticle)
      }
    })
  )

  return results.filter(Boolean)
}

/**
 * Format article for API response.
 */
function formatArticle(article) {
  return {
    id: article.id,
    title: article.title_news,
    image_url: article.image_url,
    category: article.category,
    like_count: article.like_count || 0,
    engagement_count: article.engagement_count || 0,
    ai_score: article.ai_final_score || 0,
    published_at: article.published_at
  }
}

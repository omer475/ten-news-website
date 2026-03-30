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

const safeJsonParse = (v, fb = null) => {
  if (!v) return fb; if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fb; }
}

// Decay multiplier from freshness_category (same as feed algorithm)
function decayMultiplier(freshnessCategory, ageHours) {
  switch (freshnessCategory) {
    case 'breaking': return Math.max(0.02, Math.exp(-0.115 * ageHours));
    case 'developing': return Math.max(0.02, Math.exp(-0.015 * ageHours));
    case 'analysis': return Math.max(0.02, Math.exp(-0.0095 * ageHours));
    case 'evergreen': return Math.max(0.02, Math.exp(-0.004 * ageHours));
    case 'timeless': return Math.max(0.02, Math.exp(-0.0007 * ageHours));
    default: return Math.max(0.02, Math.exp(-0.015 * ageHours));
  }
}

/**
 * GET /api/search?q=<query>&user_id=<uuid>&page=0&limit=40
 *
 * Semantic search using pgvector + keyword search, merged and ranked.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q, user_id, page = '0', limit = '40' } = req.query
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const query = q.trim()
  const queryLower = query.toLowerCase()
  const pageNum = parseInt(page, 10) || 0
  const pageSize = Math.min(parseInt(limit, 10) || 40, 100)
  const offset = pageNum * pageSize

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // ══════════════════════════════════════════════
    // STEP 1: Find the best embedding proxy for the query
    // We can't compute MiniLM embeddings at request time on Vercel.
    // Instead, match the query against known entity/subtopic names
    // and use their pre-computed MiniLM embeddings for pgvector search.
    // ══════════════════════════════════════════════

    let queryEmbedding = null;

    // Try 1: Match against subtopic_embeddings (40 pre-computed subtopics)
    const { data: subtopics } = await supabase
      .from('subtopic_embeddings')
      .select('subtopic_name, embedding_minilm')
      .limit(40)

    if (subtopics) {
      // Find subtopics that match the query
      const matches = subtopics.filter(s => {
        const name = s.subtopic_name.toLowerCase()
        return name.includes(queryLower) || queryLower.includes(name) ||
               queryLower.split(/\s+/).some(w => name.includes(w))
      })

      if (matches.length > 0 && matches[0].embedding_minilm) {
        // Average the embeddings of matching subtopics
        const embs = matches
          .map(m => safeJsonParse(m.embedding_minilm, null))
          .filter(e => e && Array.isArray(e) && e.length === 384)

        if (embs.length > 0) {
          const DIM = 384
          queryEmbedding = new Array(DIM).fill(0)
          for (const emb of embs) {
            for (let d = 0; d < DIM; d++) queryEmbedding[d] += emb[d]
          }
          for (let d = 0; d < DIM; d++) queryEmbedding[d] /= embs.length
        }
      }
    }

    // Try 2: If no subtopic match, find articles whose tags match the query
    // and use their embeddings as the query proxy
    if (!queryEmbedding) {
      const { data: tagMatchArticles } = await supabase
        .from('published_articles')
        .select('embedding_minilm')
        .contains('interest_tags', [query])
        .not('embedding_minilm', 'is', null)
        .limit(5)

      if (tagMatchArticles && tagMatchArticles.length > 0) {
        const embs = tagMatchArticles
          .map(a => safeJsonParse(a.embedding_minilm, null) || a.embedding_minilm)
          .filter(e => e && Array.isArray(e) && e.length === 384)

        if (embs.length > 0) {
          const DIM = 384
          queryEmbedding = new Array(DIM).fill(0)
          for (const emb of embs) {
            for (let d = 0; d < DIM; d++) queryEmbedding[d] += emb[d]
          }
          for (let d = 0; d < DIM; d++) queryEmbedding[d] /= embs.length
        }
      }
    }

    // ══════════════════════════════════════════════
    // STEP 2: Run semantic search + keyword search in parallel
    // ══════════════════════════════════════════════

    const words = queryLower.split(/\s+/).filter(w => w.length >= 2)
    const titleFilter = words.map(w => `title_news.ilike.%${w}%`).join(',')

    const [semanticResult, keywordTitleResult, keywordTagResult, entitiesResult] = await Promise.all([
      // Semantic search via pgvector (if we have a query embedding)
      queryEmbedding
        ? supabase.rpc('match_articles_personal_minilm', {
            query_embedding: queryEmbedding,
            match_count: 60,
            hours_window: 720, // 30 days — search shouldn't have time limits
            exclude_ids: null,
            min_similarity: 0.20
          })
        : Promise.resolve({ data: [] }),

      // Keyword search: title matching
      supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category, shelf_life_days')
        .or(titleFilter)
        .order('ai_final_score', { ascending: false })
        .limit(60),

      // Keyword search: tag matching
      supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category, shelf_life_days')
        .contains('interest_tags', [query])
        .order('ai_final_score', { ascending: false })
        .limit(60),

      // Entity search (only on first page)
      pageNum === 0 ? searchEntities(supabase, queryLower, subtopics) : Promise.resolve([])
    ])

    // ══════════════════════════════════════════════
    // STEP 3: Merge, deduplicate, score
    // ══════════════════════════════════════════════

    const articleMap = {} // id → { article, semanticSim, keywordMatch, tagMatch }
    const now = Date.now()

    // Add semantic results
    if (semanticResult.data) {
      for (const r of semanticResult.data) {
        articleMap[r.id] = { id: r.id, semanticSim: r.similarity || 0, keywordMatch: false, tagMatch: false }
      }
    }

    // Add keyword title results
    if (keywordTitleResult.data) {
      for (const a of keywordTitleResult.data) {
        if (articleMap[a.id]) {
          articleMap[a.id].keywordMatch = true
          articleMap[a.id].article = a
        } else {
          articleMap[a.id] = { id: a.id, semanticSim: 0, keywordMatch: true, tagMatch: false, article: a }
        }
      }
    }

    // Add keyword tag results
    if (keywordTagResult.data) {
      for (const a of keywordTagResult.data) {
        if (articleMap[a.id]) {
          articleMap[a.id].tagMatch = true
          if (!articleMap[a.id].article) articleMap[a.id].article = a
        } else {
          articleMap[a.id] = { id: a.id, semanticSim: 0, keywordMatch: false, tagMatch: true, article: a }
        }
      }
    }

    // Fetch full article data for semantic-only results (they don't have article data yet)
    const needsData = Object.values(articleMap).filter(r => !r.article).map(r => r.id)
    if (needsData.length > 0) {
      const { data: fullArticles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category, shelf_life_days')
        .in('id', needsData.slice(0, 100))

      if (fullArticles) {
        for (const a of fullArticles) {
          if (articleMap[a.id]) articleMap[a.id].article = a
        }
      }
    }

    // ══════════════════════════════════════════════
    // STEP 4: Compute blended search score
    // ══════════════════════════════════════════════

    const scored = Object.values(articleMap)
      .filter(r => r.article) // must have article data
      .map(r => {
        const a = r.article
        const ageHours = (now - new Date(a.created_at || a.published_at).getTime()) / 3600000

        // Semantic similarity (0-1)
        const semSim = r.semanticSim || 0

        // Quality score (0-1)
        const quality = (a.ai_final_score || 0) / 1000

        // Freshness decay (0-1)
        const freshness = decayMultiplier(a.freshness_category, ageHours)

        // Entity match bonus: does any query word exactly match a tag?
        const tags = safeJsonParse(a.interest_tags, []) || a.interest_tags || []
        const tagsLower = (Array.isArray(tags) ? tags : []).map(t => (t || '').toLowerCase())
        const entityMatch = words.some(w => tagsLower.includes(w)) ? 1.0 : 0.0

        // Both-source multiplier: articles found by BOTH semantic AND keyword get 1.3x
        const bothBonus = (r.semanticSim > 0 && (r.keywordMatch || r.tagMatch)) ? 1.3 : 1.0

        // Blended score
        const searchScore = (
          semSim * 0.5 +
          quality * 0.2 +
          freshness * 0.15 +
          entityMatch * 0.15
        ) * bothBonus

        return {
          ...a,
          _searchScore: searchScore,
          _semanticSim: semSim,
          _entityMatch: entityMatch
        }
      })
      .sort((a, b) => b._searchScore - a._searchScore)

    // Paginate
    const paginated = scored.slice(offset, offset + pageSize)

    // ══════════════════════════════════════════════
    // STEP 5: Format response
    // ══════════════════════════════════════════════

    // Fetch entity articles for carousels
    const articleIds = new Set(paginated.map(a => a.id))
    let entitiesWithArticles = []
    if (entitiesResult.length > 0) {
      entitiesWithArticles = await fetchEntityArticles(supabase, entitiesResult, articleIds)
    }

    return res.status(200).json({
      articles: paginated.map(formatArticle),
      entities: entitiesWithArticles,
      total_articles: scored.length,
      page: pageNum,
      has_more: offset + pageSize < scored.length,
      query: q.trim()
    })

  } catch (err) {
    console.error('[search] Error:', err)
    return res.status(500).json({ error: 'Search failed' })
  }
}

/**
 * Search entities by name, aliases, AND semantic similarity to query.
 */
async function searchEntities(supabase, query, subtopics) {
  // Direct name/alias match
  const { data: entities } = await supabase
    .from('concept_entities')
    .select('id, entity_name, display_title, category, aliases, popularity_score')
    .or(`entity_name.ilike.%${query}%,display_title.ilike.%${query}%`)
    .order('popularity_score', { ascending: false })
    .limit(10)

  let matched = (entities || []).map(e => ({
    entity_name: e.entity_name,
    display_title: e.display_title,
    category: e.category,
    emoji: CATEGORY_EMOJIS[e.category] || '📰',
  }))

  // Also match against subtopic names for broader suggestions
  if (subtopics && matched.length < 8) {
    const queryWords = query.split(/\s+/)
    const subtopicMatches = subtopics
      .filter(s => {
        const name = s.subtopic_name.toLowerCase()
        return queryWords.some(w => name.includes(w)) && !matched.some(m => m.entity_name === s.subtopic_name)
      })
      .slice(0, 5)
      .map(s => ({
        entity_name: s.subtopic_name.toLowerCase().replace(/\s+/g, '_'),
        display_title: s.subtopic_name,
        category: 'Topic',
        emoji: '🔍',
      }))
    matched = [...matched, ...subtopicMatches]
  }

  return matched.slice(0, 8)
}

/**
 * Fetch top articles for each matched entity.
 */
async function fetchEntityArticles(supabase, entities, excludeIds) {
  const results = await Promise.all(
    entities.slice(0, 5).map(async (entity) => {
      const { data: articles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at')
        .or(`title_news.ilike.%${entity.entity_name}%,interest_tags.cs.{${entity.entity_name}}`)
        .order('ai_final_score', { ascending: false })
        .limit(12)

      const filtered = (articles || []).filter(a => !excludeIds.has(a.id))
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

function formatArticle(article) {
  return {
    id: article.id,
    title: article.title_news,
    image_url: article.image_url,
    category: article.category,
    like_count: article.like_count || 0,
    engagement_count: article.engagement_count || 0,
    ai_score: article.ai_final_score || 0,
    published_at: article.published_at || article.created_at
  }
}

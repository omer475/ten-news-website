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
 * Three-layer search: full-text (ts_rank) + semantic (pgvector) + merge.
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
    // LAYER 1: Full-text search (ts_rank across title + category)
    // Uses the search_vector GIN index for fast ranked results.
    // Handles stemming ("films" → "film"), stop words, field weighting.
    // ══════════════════════════════════════════════

    const tsQuery = query.split(/\s+/).filter(w => w.length >= 2).join(' & ')

    const fullTextPromise = tsQuery
      ? supabase.rpc('search_articles_fulltext', { search_query: tsQuery, result_limit: 50 })
          .then(r => r)
          .catch(() => ({ data: null }))
      : Promise.resolve({ data: null })

    // Fallback: if RPC doesn't exist, do ILIKE search
    const ilikeFallbackPromise = supabase
      .from('published_articles')
      .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category')
      .or(query.split(/\s+/).filter(w => w.length >= 2).map(w => `title_news.ilike.%${w}%`).join(','))
      .order('ai_final_score', { ascending: false })
      .limit(50)

    // Also search tags
    const tagSearchPromise = supabase
      .from('published_articles')
      .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category')
      .contains('interest_tags', [query])
      .order('ai_final_score', { ascending: false })
      .limit(50)

    // ══════════════════════════════════════════════
    // LAYER 2: Semantic search (pgvector cosine similarity)
    // Find the best embedding proxy for the query, then ANN search.
    // ══════════════════════════════════════════════

    let queryEmbedding = null

    // Match query against subtopic embeddings
    const { data: subtopics } = await supabase
      .from('subtopic_embeddings')
      .select('subtopic_name, embedding_minilm')
      .limit(50)

    if (subtopics) {
      const matches = subtopics.filter(s => {
        const name = s.subtopic_name.toLowerCase()
        return name.includes(queryLower) || queryLower.includes(name) ||
               queryLower.split(/\s+/).some(w => w.length >= 3 && name.includes(w))
      })
      if (matches.length > 0) {
        const embs = matches
          .map(m => safeJsonParse(m.embedding_minilm, null))
          .filter(e => e && Array.isArray(e) && e.length === 384)
        if (embs.length > 0) {
          queryEmbedding = new Array(384).fill(0)
          for (const emb of embs) for (let d = 0; d < 384; d++) queryEmbedding[d] += emb[d]
          for (let d = 0; d < 384; d++) queryEmbedding[d] /= embs.length
        }
      }
    }

    // Fallback: use tag-matching articles' embeddings as proxy
    if (!queryEmbedding) {
      const { data: tagArticles } = await supabase
        .from('published_articles')
        .select('embedding_minilm')
        .contains('interest_tags', [query])
        .not('embedding_minilm', 'is', null)
        .limit(5)
      if (tagArticles && tagArticles.length > 0) {
        const embs = tagArticles.map(a => {
          const e = safeJsonParse(a.embedding_minilm, null) || a.embedding_minilm
          return (e && Array.isArray(e) && e.length === 384) ? e : null
        }).filter(Boolean)
        if (embs.length > 0) {
          queryEmbedding = new Array(384).fill(0)
          for (const emb of embs) for (let d = 0; d < 384; d++) queryEmbedding[d] += emb[d]
          for (let d = 0; d < 384; d++) queryEmbedding[d] /= embs.length
        }
      }
    }

    const semanticPromise = queryEmbedding
      ? supabase.rpc('match_articles_personal_minilm', {
          query_embedding: queryEmbedding,
          match_count: 50,
          hours_window: 720,
          exclude_ids: null,
          min_similarity: 0.20
        })
      : Promise.resolve({ data: [] })

    // Entity search
    const entityPromise = pageNum === 0
      ? searchEntities(supabase, queryLower, subtopics)
      : Promise.resolve([])

    // ══════════════════════════════════════════════
    // Execute all searches in parallel
    // ══════════════════════════════════════════════

    const [fullTextResult, ilikeFallback, tagResult, semanticResult, entities] = await Promise.all([
      fullTextPromise, ilikeFallbackPromise, tagSearchPromise, semanticPromise, entityPromise
    ])

    // ══════════════════════════════════════════════
    // LAYER 3: Merge, deduplicate, score
    // ══════════════════════════════════════════════

    const articleMap = {} // id → { article, textRank, semanticSim, tagMatch, keywordMatch }
    const now = Date.now()

    // Add full-text results (if RPC worked)
    if (fullTextResult.data && Array.isArray(fullTextResult.data)) {
      for (const r of fullTextResult.data) {
        articleMap[r.id] = {
          id: r.id, article: r,
          textRank: r.text_rank || 0.5,
          semanticSim: 0, tagMatch: false, keywordMatch: true
        }
      }
    }

    // Add ILIKE fallback results
    if (ilikeFallback.data) {
      for (const a of ilikeFallback.data) {
        if (articleMap[a.id]) {
          articleMap[a.id].keywordMatch = true
          if (!articleMap[a.id].article?.ai_final_score) articleMap[a.id].article = a
        } else {
          articleMap[a.id] = { id: a.id, article: a, textRank: 0.3, semanticSim: 0, tagMatch: false, keywordMatch: true }
        }
      }
    }

    // Add tag results
    if (tagResult.data) {
      for (const a of tagResult.data) {
        if (articleMap[a.id]) {
          articleMap[a.id].tagMatch = true
          if (!articleMap[a.id].article?.ai_final_score) articleMap[a.id].article = a
        } else {
          articleMap[a.id] = { id: a.id, article: a, textRank: 0, semanticSim: 0, tagMatch: true, keywordMatch: false }
        }
      }
    }

    // Add semantic results
    if (semanticResult.data) {
      for (const r of semanticResult.data) {
        if (articleMap[r.id]) {
          articleMap[r.id].semanticSim = r.similarity || 0
        } else {
          articleMap[r.id] = { id: r.id, semanticSim: r.similarity || 0, textRank: 0, tagMatch: false, keywordMatch: false }
        }
      }
    }

    // Fetch article data for entries that only have semantic results (no article data)
    const needsData = Object.values(articleMap).filter(r => !r.article).map(r => r.id)
    if (needsData.length > 0) {
      const { data: fullArticles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, ai_final_score, published_at, created_at, freshness_category')
        .in('id', needsData.slice(0, 100))
      if (fullArticles) {
        for (const a of fullArticles) {
          if (articleMap[a.id]) articleMap[a.id].article = a
        }
      }
    }

    // ══════════════════════════════════════════════
    // Compute blended search score
    // ══════════════════════════════════════════════

    const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 2)

    const scored = Object.values(articleMap)
      .filter(r => r.article)
      .map(r => {
        const a = r.article
        const ageHours = (now - new Date(a.created_at || a.published_at || now).getTime()) / 3600000

        // Semantic similarity (0-1)
        const semSim = r.semanticSim || 0

        // Text rank (0-1, normalized)
        const textRank = Math.min(r.textRank || 0, 1.0)

        // Quality (0-1)
        const quality = (a.ai_final_score || 0) / 1000

        // Freshness decay (0-1)
        const freshness = decayMultiplier(a.freshness_category, ageHours)

        // Entity match bonus: query word exactly matches a tag
        const tags = (Array.isArray(a.interest_tags) ? a.interest_tags : safeJsonParse(a.interest_tags, []) || [])
          .map(t => (t || '').toLowerCase())
        const entityMatch = queryWords.some(w => tags.includes(w)) ? 1.0 : 0.0

        // Both-source multiplier
        const inBoth = (r.semanticSim > 0.2) && (r.keywordMatch || r.tagMatch)
        const bothBonus = inBoth ? 1.3 : 1.0

        const score = (
          semSim * 0.5 +
          textRank * 0.3 +
          quality * 0.1 +
          freshness * 0.1
        ) * bothBonus * (entityMatch > 0 ? 1.15 : 1.0)

        return { ...a, _searchScore: score }
      })
      .sort((a, b) => b._searchScore - a._searchScore)

    const paginated = scored.slice(offset, offset + pageSize)

    // Fetch entity articles
    const articleIds = new Set(paginated.map(a => a.id))
    let entitiesWithArticles = []
    if (entities.length > 0) {
      entitiesWithArticles = await fetchEntityArticles(supabase, entities, articleIds)
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

async function searchEntities(supabase, query, subtopics) {
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

  // Also suggest related subtopics
  if (subtopics && matched.length < 8) {
    const queryWords = query.split(/\s+/)
    const subtopicMatches = subtopics
      .filter(s => {
        const name = s.subtopic_name.toLowerCase()
        return queryWords.some(w => w.length >= 3 && name.includes(w)) &&
               !matched.some(m => m.entity_name === s.subtopic_name)
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
      return { ...entity, article_count: filtered.length, articles: filtered.slice(0, 8).map(formatArticle) }
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

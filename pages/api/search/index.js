// GET /api/search?q=<query>&user_id=<uuid>&page=0&limit=40
//
// Hybrid retrieval: full-text via tsquery + fuzzy trigram + tag-exact +
// publishers lane. Final scoring blends relevance, engagement, and
// recency. Synthesizes a "Top" tab payload mixing the best article,
// publishers, and entities so the iOS Search UI can render a unified
// best-of-everything view.
//
// Response shape:
//   {
//     articles: [...],         // ranked list (Articles tab)
//     entities: [...],         // matched entities + their top articles
//     publishers: [...],       // matched publisher profiles (new)
//     top:       [...],        // synthesized "Top" tab rows (new)
//     total_articles, page, has_more, query
//   }
//
// Old clients (which decode articles + entities only) keep working.
// The new `publishers` and `top` fields are additive.

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

// Ranking weights (tunable via env). The relevance + engagement +
// recency mix. Sum to 1.0.
const W_RELEVANCE = Number(process.env.SEARCH_W_RELEVANCE ?? 0.55)
const W_ENGAGEMENT = Number(process.env.SEARCH_W_ENGAGEMENT ?? 0.30)
const W_RECENCY = Number(process.env.SEARCH_W_RECENCY ?? 0.15)
const RECENCY_HALF_LIFE_DAYS = Number(process.env.SEARCH_RECENCY_HL_DAYS ?? 14)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q, page = '0', limit = '40' } = req.query
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
    // Page 0 also pulls entities + publishers + builds Top. Later pages
    // are just "more articles".
    const isFirstPage = pageNum === 0
    const [
      articlesResult,
      entitiesResult,
      publishersResult,
    ] = await Promise.all([
      searchArticles(supabase, query, queryLower, pageSize, offset),
      isFirstPage ? searchEntities(supabase, queryLower) : Promise.resolve({ entities: [] }),
      isFirstPage ? searchPublishers(supabase, queryLower) : Promise.resolve([]),
    ])

    let entitiesWithArticles = []
    if (isFirstPage && entitiesResult.entities.length > 0) {
      entitiesWithArticles = await fetchEntityArticles(
        supabase, entitiesResult.entities, articlesResult.articleIds
      )
    }

    // Synthesize the "Top" payload — one hero article + 2 publishers +
    // 2 entities + 3 more articles. Replicates the IG / TikTok / X
    // "Top" tab pattern.
    const top = isFirstPage
      ? buildTopRows(articlesResult.articles, publishersResult, entitiesWithArticles)
      : []

    return res.status(200).json({
      articles: articlesResult.articles,
      entities: entitiesWithArticles,
      publishers: publishersResult,
      top,
      total_articles: articlesResult.total,
      page: pageNum,
      has_more: offset + pageSize < articlesResult.total,
      query,
    })
  } catch (err) {
    console.error('[search] error:', err)
    return res.status(500).json({ error: 'Search failed' })
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Articles — full-text via search_vector + trigram fallback + tag exact.
// ─────────────────────────────────────────────────────────────────────────

async function searchArticles(supabase, query, queryLower, limit, offset) {
  const fetchPool = limit + offset + 100  // headroom for client-side rank + dedup

  // PostgREST trigram filter: the `wfts.<query>` text-search modifier is
  // not consistently supported, so we issue an RPC-style call for the
  // ts_query lane and trigram + tag lanes via standard filters.
  //
  // Lane A — full-text. `search_vector` is already a GIN-indexed
  // tsvector column on published_articles. We use websearch_to_tsquery
  // (handles quoted phrases and prefix wildcards) via PostgREST's
  // `textSearch` filter.
  const ftsPromise = supabase
    .from('published_articles')
    .select('id, title_news, image_url, category, interest_tags, ai_final_score, like_count, engagement_count, published_at, author_id, author_name')
    .textSearch('search_vector', query, { type: 'websearch' })
    .lte('published_at', new Date().toISOString())
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .limit(fetchPool)

  // Lane B — trigram (typo tolerance / partial matches the full-text
  // lane missed). Falls back to ILIKE which now hits the
  // articles_title_trgm_idx GIN index. Cheap.
  const trgmPromise = supabase
    .from('published_articles')
    .select('id, title_news, image_url, category, interest_tags, ai_final_score, like_count, engagement_count, published_at, author_id, author_name')
    .ilike('title_news', `%${queryLower}%`)
    .lte('published_at', new Date().toISOString())
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .limit(80)

  // Lane C — exact tag match. Keeps the existing tag-tier behavior
  // (article tagged exactly with the query string).
  const tagPromise = supabase
    .from('published_articles')
    .select('id, title_news, image_url, category, interest_tags, ai_final_score, like_count, engagement_count, published_at, author_id, author_name')
    .contains('interest_tags', [queryLower])
    .lte('published_at', new Date().toISOString())
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .limit(80)

  const [ftsRes, trgmRes, tagRes] = await Promise.all([ftsPromise, trgmPromise, tagPromise])

  // Merge with provenance — tag each row with which lane found it so
  // computeRank can give a small bonus for multi-lane hits.
  const seen = new Map()  // id → { article, lanes: Set }
  const add = (rows, lane) => {
    if (!rows) return
    for (const r of rows) {
      const existing = seen.get(r.id)
      if (existing) {
        existing.lanes.add(lane)
      } else {
        seen.set(r.id, { article: r, lanes: new Set([lane]) })
      }
    }
  }
  add(ftsRes.data, 'fts')
  add(trgmRes.data, 'trgm')
  add(tagRes.data, 'tag')

  // Score and sort.
  const scored = []
  for (const { article, lanes } of seen.values()) {
    scored.push({ article, score: computeRank(article, query, queryLower, lanes) })
  }
  scored.sort((a, b) => b.score - a.score)

  const paginated = scored.slice(offset, offset + limit).map(s => s.article)

  return {
    articles: paginated.map(formatArticle),
    articleIds: new Set(paginated.map(a => a.id)),
    total: scored.length,
  }
}

/**
 * Blended ranking score. Returns a number in roughly [0, 1].
 *
 *   score = W_RELEVANCE   × relevance(query, article, lanes)
 *         + W_ENGAGEMENT × engagement_norm(article)
 *         + W_RECENCY    × recency_decay(article)
 */
function computeRank(article, query, queryLower, lanes) {
  const title = (article.title_news || '').toLowerCase()
  const tags = (article.interest_tags || []).map(t => String(t).toLowerCase())

  // ─── Relevance ───
  let rel = 0
  if (title === queryLower) rel = 1.0
  else if (title.startsWith(queryLower)) rel = 0.85
  else if (title.includes(queryLower)) rel = 0.70
  else {
    const words = queryLower.split(/\s+/).filter(w => w.length >= 2)
    const matched = words.filter(w => title.includes(w)).length
    rel = (matched / Math.max(words.length, 1)) * 0.55
  }
  if (tags.includes(queryLower)) rel = Math.max(rel, 0.80)
  // Multi-lane hit bonus — if all 3 lanes returned this article, +5%.
  if (lanes.size === 3) rel = Math.min(1.0, rel + 0.05)
  else if (lanes.size === 2) rel = Math.min(1.0, rel + 0.02)

  // ─── Engagement ───
  // log-scale so a 1000-like article isn't 1000× a 1-like one.
  const likes = article.like_count || 0
  const engagements = article.engagement_count || 0
  const ai = article.ai_final_score || 0
  const eng = Math.min(1, Math.log10(1 + likes * 2 + engagements + ai / 200) / 4)

  // ─── Recency ───
  const hoursOld = article.published_at
    ? Math.max(0, (Date.now() - new Date(article.published_at).getTime()) / 36e5)
    : 24 * RECENCY_HALF_LIFE_DAYS
  const rec = Math.pow(2, -hoursOld / (24 * RECENCY_HALF_LIFE_DAYS))

  return W_RELEVANCE * rel + W_ENGAGEMENT * eng + W_RECENCY * rec
}

// ─────────────────────────────────────────────────────────────────────────
// Entities — concept_entities table + alias fallback.
// ─────────────────────────────────────────────────────────────────────────

async function searchEntities(supabase, queryLower) {
  const { data: entities } = await supabase
    .from('concept_entities')
    .select('id, entity_name, display_title, category, aliases, popularity_score')
    .or(`entity_name.ilike.${queryLower}%,display_title.ilike.${queryLower}%,entity_name.ilike.%${queryLower}%,display_title.ilike.%${queryLower}%`)
    .order('popularity_score', { ascending: false })
    .limit(10)

  let matched = entities || []

  if (matched.length < 3) {
    const { data: aliasEntities } = await supabase
      .from('concept_entities')
      .select('id, entity_name, display_title, category, aliases, popularity_score')
      .not('aliases', 'is', null)
      .limit(200)
    if (aliasEntities) {
      const seen = new Set(matched.map(m => m.id))
      const aliasHits = aliasEntities.filter(e => {
        if (seen.has(e.id)) return false
        return (e.aliases || []).some(a => String(a).toLowerCase().includes(queryLower))
      })
      matched = [...matched, ...aliasHits.slice(0, 5)]
    }
  }

  return {
    entities: matched.map(e => ({
      id: e.id,
      entity_name: e.entity_name,
      display_title: e.display_title,
      category: e.category,
      emoji: CATEGORY_EMOJIS[e.category] || '📰',
      popularity_score: e.popularity_score,
    })),
  }
}

async function fetchEntityArticles(supabase, entities, excludeIds) {
  const results = await Promise.all(
    entities.slice(0, 5).map(async (entity) => {
      const { data: articles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, like_count, engagement_count, ai_final_score, published_at, author_id, author_name')
        .or(`title_news.ilike.%${entity.entity_name}%,interest_tags.cs.{${entity.entity_name}}`)
        .lte('published_at', new Date().toISOString())
        .order('like_count', { ascending: false, nullsFirst: false })
        .order('engagement_count', { ascending: false, nullsFirst: false })
        .limit(12)
      const filtered = (articles || []).filter(a => !excludeIds.has(a.id))
      if (filtered.length === 0) return null
      return {
        ...entity,
        article_count: filtered.length,
        articles: filtered.slice(0, 8).map(formatArticle),
      }
    })
  )
  return results.filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────
// Publishers — trigram match on display_name + username.
// ─────────────────────────────────────────────────────────────────────────

async function searchPublishers(supabase, queryLower) {
  const { data, error } = await supabase
    .from('publishers')
    .select('id, display_name, username, bio, avatar_url, category, is_verified, follower_count, article_count')
    .or(`display_name.ilike.%${queryLower}%,username.ilike.%${queryLower}%`)
    .order('follower_count', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) {
    console.error('[search] publisher search error:', error.message)
    return []
  }

  return (data || []).map(p => ({
    id: p.id,
    display_name: p.display_name,
    username: p.username,
    bio: p.bio,
    avatar_url: p.avatar_url,
    category: p.category,
    is_verified: !!p.is_verified,
    follower_count: p.follower_count || 0,
    article_count: p.article_count || 0,
  }))
}

// ─────────────────────────────────────────────────────────────────────────
// "Top" tab synthesis — IG / TikTok / X pattern.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Builds an ordered list of typed rows for the iOS "Top" tab:
 *   1. hero article (top-ranked)
 *   2. up to 2 publisher rows
 *   3. up to 2 entity rows
 *   4. up to 3 more articles
 *
 * Each row carries a `type` discriminator so the iOS decoder can switch
 * cleanly. Rows with no data are skipped — caller never needs to filter.
 */
function buildTopRows(articles, publishers, entities) {
  const rows = []

  // 1. hero article
  if (articles.length > 0) {
    rows.push({ type: 'article', payload: articles[0] })
  }

  // 2. publishers (up to 2)
  for (const p of publishers.slice(0, 2)) {
    rows.push({ type: 'publisher', payload: p })
  }

  // 3. entities (up to 2)
  for (const e of entities.slice(0, 2)) {
    rows.push({
      type: 'entity',
      payload: {
        id: e.id,
        entity_name: e.entity_name,
        display_title: e.display_title,
        category: e.category,
        emoji: e.emoji,
        article_count: e.article_count,
      },
    })
  }

  // 4. more articles
  for (const a of articles.slice(1, 4)) {
    rows.push({ type: 'article', payload: a })
  }

  return rows
}

// ─────────────────────────────────────────────────────────────────────────

function formatArticle(article) {
  return {
    id: article.id,
    title: article.title_news,
    image_url: article.image_url,
    category: article.category,
    like_count: article.like_count || 0,
    engagement_count: article.engagement_count || 0,
    ai_score: article.ai_final_score || 0,
    published_at: article.published_at,
  }
}

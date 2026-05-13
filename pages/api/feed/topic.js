// pages/api/feed/topic.js — entity-scoped article feed.
//
// Powers the chip-tap drill-down on the iOS For You feed: when a user
// taps a topic chip under an article (e.g. "Trump", "MagSafe", "Katie
// Holmes"), iOS opens TopicFeedView which calls this endpoint to get
// the list of recent articles tagged with that entity. Same JSON shape
// as /api/feed/main / following so the existing ArticleCardContinuousView
// renderer is reused without changes.
//
// Match strategy: entity is lower-cased and matched against
//   1) interest_tags (jsonb array of canonical concept entities tagged
//      at publish time — highest precision)
//   2) title_news (case-insensitive substring — fallback for compound
//      chips like "US-Israel-Iran war" that are bold-emphasized in
//      bullets but not curated into interest_tags)
//   3) summary_bullets_news::text (catches entities that the iOS chip
//      builder extracted from `**Entity**` markdown but that didn't
//      make it into interest_tags or the title — e.g. Whoop mentioned
//      mid-bullet in a wearables roundup whose title is the parent brand)
// Results from all three queries are merged + de-duplicated by id.
// Pools are tiered (tag → title → bullet) so curated matches always lead.
// Pagination is offset-based to match what TopicFeedView passes
// (offset = articles.count).
//
// Empty result still returns 200 with articles=[] — iOS surfaces the
// "No articles tagged with X right now" empty state.
//
// Cache: 120s public + 60s SWR. Entity-feed contents change slowly
// (publish cadence) and the same chip taps repeat across users.

import { formatArticle, FEED_ARTICLE_COLUMNS } from '../../../lib/formatArticle.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40
// Per-source-pool cap pre-merge. Title-ILIKE is a broad net; without a
// cap it can dominate the page even when the curated tag has a richer
// pool. 80 each is enough to fill 2-3 pages after dedup.
const PER_SOURCE_FETCH = 80

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawEntity = (req.query.entity || '').toString().trim()
  if (!rawEntity) {
    return res.status(400).json({ error: 'entity query param required' })
  }
  // Strip anything that would break PostgREST `or`/`ilike` filters or
  // smuggle additional predicates. Letters, numbers, spaces, hyphens,
  // apostrophes, and ampersands cover every real entity name we tag.
  const cleaned = rawEntity.replace(/[^\p{L}\p{N}\s\-'&]/gu, '').trim()
  if (!cleaned) {
    return res.status(400).json({ error: 'entity contains no usable characters' })
  }
  const entityLower = cleaned.toLowerCase()

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const t0 = Date.now()

  try {
    // Run all three queries in parallel. The supabase-js client escapes
    // .contains() and .ilike() argument values correctly — we don't
    // build raw PostgREST `or` strings here because the entity may
    // contain commas/apostrophes that would need bespoke escaping.
    //
    // The bullet search uses .filter('summary_bullets_news::text','ilike',...)
    // — PostgREST casts the jsonb column to text and the ILIKE runs
    // against the raw JSON serialization. That catches `**Entity**`
    // markdown wrapped inside any bullet object, no jsonb path needed.
    const [tagResult, titleResult, bulletResult] = await Promise.all([
      supabase
        .from('published_articles')
        .select(FEED_ARTICLE_COLUMNS)
        .contains('interest_tags', [entityLower])
        .order('ai_final_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(PER_SOURCE_FETCH),
      supabase
        .from('published_articles')
        .select(FEED_ARTICLE_COLUMNS)
        .ilike('title_news', `%${entityLower}%`)
        .order('ai_final_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(PER_SOURCE_FETCH),
      supabase
        .from('published_articles')
        .select(FEED_ARTICLE_COLUMNS)
        .filter('summary_bullets_news::text', 'ilike', `%${entityLower}%`)
        .order('ai_final_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(PER_SOURCE_FETCH),
    ])

    if (tagResult.error) {
      console.error('[feed:topic] tag query failed:', tagResult.error.message)
    }
    if (titleResult.error) {
      console.error('[feed:topic] title query failed:', titleResult.error.message)
    }
    if (bulletResult.error) {
      console.error('[feed:topic] bullet query failed:', bulletResult.error.message)
    }

    // Sort each pool independently by ai_final_score then recency.
    // Title-ILIKE returns thousands of articles for common entities
    // ("Trump" → 3000+), so it can't be merged flat with the small
    // curated-tag pool — global score sort would let a high-scoring
    // title-mention article outrank a curated tag hit on the same
    // entity. Two-tier instead: all tag hits, then title fill.
    const rankPool = (rows) => {
      const out = (rows || []).slice()
      out.sort((a, b) => {
        const sa = a.ai_final_score || 0
        const sb = b.ai_final_score || 0
        if (sb !== sa) return sb - sa
        const ta = a.created_at ? Date.parse(a.created_at) : 0
        const tb = b.created_at ? Date.parse(b.created_at) : 0
        return tb - ta
      })
      return out
    }
    const tagPool = rankPool(tagResult.data)
    const titlePool = rankPool(titleResult.data)
    const bulletPool = rankPool(bulletResult.data)

    // Tier 1: curated interest_tags matches (high precision).
    // Tier 2: title-ILIKE fill, excluding ids already in tier 1.
    // Tier 3: bullet-ILIKE fill (catches `**Entity**` mentions inside
    //         bullets that aren't tagged and aren't in the title).
    const seen = new Set()
    const merged = []
    for (const row of tagPool) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }
    for (const row of titlePool) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }
    for (const row of bulletPool) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }

    const page = merged.slice(offset, offset + limit)
    const formatted = page.map(a => formatArticle(a, {}))

    console.log(
      `[feed:topic] entity="${entityLower}" tag=${(tagResult.data || []).length} ` +
      `title=${(titleResult.data || []).length} bullet=${(bulletResult.data || []).length} ` +
      `merged=${merged.length} returned=${formatted.length} offset=${offset} ms=${Date.now() - t0}`
    )

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60')
    return res.status(200).json({
      entity: rawEntity,
      offset,
      limit,
      count: formatted.length,
      articles: formatted,
    })
  } catch (err) {
    console.error('[feed:topic] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

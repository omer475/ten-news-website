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
// Results from all three queries are merged + de-duplicated by id, then
// re-ranked by a blended quality + recency score (see constants below).
// Final pipeline:
//   1) merge + dedupe by id
//   2) drop anything older than 30 days
//   3) blended score: 0.55 * log10(score)/3 + 0.45 * 2^(-hoursOld/36)
//   4) cluster_id dedup — keep only one article per news cluster
//   5) per-publisher cap — max 2 from the same author in the first 10 slots
//   6) paginate
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

// ─── Ranking constants ──────────────────────────────────────────────
// Topic pages are exploratory: the user just expressed intent ("what's
// happening with X right now"), so recency weighs nearly as much as
// quality. Numbers picked from published social/news platforms:
//
// QUALITY_WEIGHT / RECENCY_WEIGHT = 0.55 / 0.45 — quality slight edge,
//   recency near-equal. Standard for topic pages on social platforms
//   (vs ~0.7/0.3 for main feeds).
// RECENCY_HALF_LIFE_HOURS = 36 — score halves every 36h. Between
//   Reddit's ~12.5h (very fast) and HN's ~24h (fast); slightly slower
//   because users land here intentionally rather than passively browsing.
// MAX_AGE_HOURS = 30 days — hard cut, matches Google News' 30-day
//   clustering window. Anything older drops off the topic page entirely.
// QUALITY_NORM_DIVISOR = 3 — log10(1000)=3, so dividing by 3 maps the
//   typical ai_final_score range (1..1000) into [0,1] same as recency.
// PUBLISHER_CAP_IN_TOP_K — max 2 articles from any single publisher in
//   the first 10 slots. Stops one outlet dominating page-1 of a topic.
//   Standard practice across news-recommender literature.
const QUALITY_WEIGHT = 0.55
const RECENCY_WEIGHT = 0.45
const RECENCY_HALF_LIFE_HOURS = 36
const MAX_AGE_HOURS = 30 * 24
const QUALITY_NORM_DIVISOR = 3
const PUBLISHER_CAP_IN_TOP_K = 2
const PUBLISHER_CAP_TOP_K = 10

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

    // ── 1. Merge the three pools, dedupe by id ────────────────────
    // Tier order (tag → title → bullet) only matters for which copy
    // wins when the same article is in multiple pools; the global
    // ranker below re-orders everything by blended score anyway, so
    // a strong title hit can still outrank a weak tag hit.
    const seen = new Set()
    const merged = []
    for (const row of [
      ...(tagResult.data || []),
      ...(titleResult.data || []),
      ...(bulletResult.data || []),
    ]) {
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      merged.push(row)
    }

    // ── 2. Hard cut: drop anything older than MAX_AGE_HOURS ───────
    const now = Date.now()
    const cutoffMs = now - MAX_AGE_HOURS * 3600 * 1000
    const fresh = merged.filter(row => {
      const t = row.created_at ? Date.parse(row.created_at) : 0
      return t >= cutoffMs
    })

    // ── 3. Compute blended score per article ──────────────────────
    // qualityNorm = log10(score) / 3 → maps ai_final_score 1..1000 onto [0,1]
    // recency    = 2^(-hoursOld / halfLife) → 1.0 at fresh, 0.5 at halfLife
    // final      = 0.55 * qualityNorm + 0.45 * recency  (range ~ [0, 1])
    const HALF_LIFE_LN2 = Math.LN2 / RECENCY_HALF_LIFE_HOURS
    const scored = fresh.map(row => {
      const rawScore = row.ai_final_score || 0
      const qualityNorm = Math.log10(Math.max(rawScore, 1)) / QUALITY_NORM_DIVISOR
      const tMs = row.created_at ? Date.parse(row.created_at) : now
      const hoursOld = Math.max(0, (now - tMs) / (3600 * 1000))
      const recency = Math.exp(-HALF_LIFE_LN2 * hoursOld)
      const blended = QUALITY_WEIGHT * qualityNorm + RECENCY_WEIGHT * recency
      return { row, blended }
    })
    scored.sort((a, b) => b.blended - a.blended)

    // ── 4. Cluster dedup: keep only the highest-scored article per
    //       cluster_id. Articles with null cluster_id all pass through. ─
    const clusterSeen = new Set()
    const deduped = []
    for (const item of scored) {
      const cid = item.row.cluster_id
      if (cid != null) {
        if (clusterSeen.has(cid)) continue
        clusterSeen.add(cid)
      }
      deduped.push(item.row)
    }

    // ── 5. Per-publisher cap in the top K slots ───────────────────
    // While filling positions 1..PUBLISHER_CAP_TOP_K, skip an article
    // if its publisher already has PUBLISHER_CAP_IN_TOP_K hits. After
    // position K, accept everything in score order. Overflow items
    // (skipped early) are appended at the end so they're still
    // reachable via pagination — just not in the headline slots.
    const counts = new Map()
    const top = []
    const overflow = []
    for (const row of deduped) {
      const pub = row.author_id || row.source || 'unknown'
      const cur = counts.get(pub) || 0
      if (top.length < PUBLISHER_CAP_TOP_K && cur >= PUBLISHER_CAP_IN_TOP_K) {
        overflow.push(row)
      } else {
        top.push(row)
        counts.set(pub, cur + 1)
      }
    }
    const ranked = [...top, ...overflow]

    // ── 6. Paginate ───────────────────────────────────────────────
    const page = ranked.slice(offset, offset + limit)
    const formatted = page.map(a => formatArticle(a, {}))

    console.log(
      `[feed:topic] entity="${entityLower}" tag=${(tagResult.data || []).length} ` +
      `title=${(titleResult.data || []).length} bullet=${(bulletResult.data || []).length} ` +
      `merged=${merged.length} fresh=${fresh.length} ` +
      `clusterDeduped=${deduped.length} ranked=${ranked.length} ` +
      `returned=${formatted.length} offset=${offset} ms=${Date.now() - t0}`
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

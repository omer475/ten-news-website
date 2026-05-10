// pages/api/feed/main.js — Trinity-only feed handler.
//
// Phase 1.1 (TikTok mirror plan, 2026-05-10).
// Replaces the prior 5,381-LOC file. The 4,500-LOC v11 fallback (handleV2Feed
// + helpers) was deleted because:
//   1. v11 silently rotted — no feature commits since 2026-04-27 while
//      Trinity received 9+ days of fixes (ENF, calibrated slate, time-of-day
//      clock, fresh-item boost, cross-pool backfill).
//   2. v11's bandit tables (user_bandit_arms / user_leaf_arms / user_super_arms)
//      were unsynced with Trinity's cluster_state — falling back gave users a
//      worse algorithm than 503.
//   3. Falling-through-to-v11 hid Trinity bugs. The shownClusters typo (PR
//      #124) ran 7 hours undetected because the fallback masked it.
//
// On Trinity error or empty result, this handler returns 503. Phase 1.7
// adds [trinity.path] log lines so any 503 is loud and grep-able. Phase
// 1.8 cold-start warm-start synthesis (lib/coldStart.js) prevents the v11
// deletion from regressing brand-new-user UX.

import { createClient } from '@supabase/supabase-js'
import { serveTrinityFeed } from '../../../lib/trinityServe.js'
import { expectedReadSecondsForArticle } from '../../../lib/readingTime.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TRINITY_DISABLED_GLOBAL = process.env.TRINITY_DISABLE === '1'

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return fallback }
}

// ---------------------------------------------------------------------------
// formatArticle — preserved verbatim from the pre-1.1 file. Shapes a
// published_articles row to the JSON contract the iOS app expects.
// ---------------------------------------------------------------------------
function formatArticle(article, eventMap = {}) {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, [])
  const fiveWs = safeJsonParse(article.five_ws, null)
  const timeline = safeJsonParse(article.timeline, null)
  const graph = safeJsonParse(article.graph, null)
  const details = safeJsonParse(article.details, [])
  const components = article.components_order || safeJsonParse(article.components, null)
  const countries = safeJsonParse(article.countries, [])
  const topics = safeJsonParse(article.topics, [])
  const countryRelevance = safeJsonParse(article.country_relevance, null)
  const topicRelevance = safeJsonParse(article.topic_relevance, null)
  const interestTags = safeJsonParse(article.interest_tags, [])

  let map = null
  const rawMap = safeJsonParse(article.map, null)
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const primary = rawMap[0]
      map = {
        center: { lat: primary.coordinates?.lat || 0, lon: primary.coordinates?.lng || primary.coordinates?.lon || 0 },
        markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
        name: primary.name,
        location: [primary.name, primary.city, primary.country].filter(Boolean).join(', '),
        city: primary.city,
        country: primary.country,
        region: primary.country,
        description: primary.description,
      }
    } else if (!Array.isArray(rawMap)) {
      map = {
        center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
        markers: [],
        name: rawMap.name,
        location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
        city: rawMap.city,
        country: rawMap.country,
        region: rawMap.country,
        description: rawMap.description,
      }
    }
  }

  let imageUrl = null
  const raw = article.image_url
  if (raw) {
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
    if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
      imageUrl = s
    }
  }

  const formatted = {
    id: article.id,
    title: article.title_news,
    title_news: article.title_news || null,
    url: article.url,
    source: article.source || 'Ten News',
    category: article.category,
    emoji: article.emoji || '📰',
    image_url: imageUrl,
    urlToImage: imageUrl,
    image_source: article.image_source || null,
    publishedAt: article.published_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score || 0,
    final_score: article.ai_final_score || 0,
    base_score: article.ai_final_score || 0,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets: summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsNews,
    content_news: null,
    detailed_text: '',
    five_ws: fiveWs,
    timeline,
    graph,
    map,
    details,
    components,
    countries,
    topics,
    country_relevance: countryRelevance,
    topic_relevance: topicRelevance,
    interest_tags: interestTags,
    num_sources: article.num_sources,
    cluster_id: article.cluster_id,
    version_number: article.version_number,
    views: article.view_count || 0,
    author_id: article.author_id || null,
    author_name: article.author_name || null,
    // Kuaishou WTG / TikTok pCompletion analog. Lets the client derive
    // read_ratio = dwell / expected_read_seconds for length-aware engagement.
    expected_read_seconds: expectedReadSecondsForArticle(article),
  }

  if (eventMap[article.id]) formatted.world_event = eventMap[article.id]
  return formatted
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  if (TRINITY_DISABLED_GLOBAL) {
    console.error('[trinity.disabled] TRINITY_DISABLE=1 in env')
    return res.status(503).json({ error: 'feed_disabled', reason: 'global_kill_switch' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  const userId = req.query.user_id || null
  const guestDeviceId = req.query.guest_device_id || null

  // Stable identifier for IPS off-policy slate cohesion analysis.
  const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`

  // iOS-supplied session signals (real-time skip/engage tracking) —
  // counted into recentEngagementZ for bandit-with-abandonment slot allocation.
  const sessionEngagedIds = req.query.engaged_ids ? req.query.engaged_ids.split(',').map(Number).filter(Boolean) : []
  const sessionGlancedIds = req.query.glanced_ids ? req.query.glanced_ids.split(',').map(Number).filter(Boolean) : []
  const sessionSkippedIds = req.query.skipped_ids ? req.query.skipped_ids.split(',').map(Number).filter(Boolean) : []
  // iOS-known seen IDs (cap 2000 to stay under PostgREST URL length limits).
  const clientSeenIds = req.query.seen_ids ? req.query.seen_ids.split(',').map(Number).filter(Boolean) : []
  const seenIds = Array.from(new Set(clientSeenIds.filter(id => id))).slice(0, 2000)

  const engN = sessionEngagedIds.length
  const glnN = sessionGlancedIds.length
  const skpN = sessionSkippedIds.length
  const totN = engN + glnN + skpN
  const recentEngagementZ = totN >= 5 ? (engN + 0.3 * glnN - skpN) / totN : 0

  const t0 = Date.now()
  let trinityResult
  try {
    trinityResult = await serveTrinityFeed(supabase, {
      userId, seenIds, feedSize: limit, recentEngagementZ,
    })
  } catch (trinityErr) {
    // Phase 9.A.3 conspicuous logging — fatal errors must be loud and grep-able.
    const errClass = trinityErr?.constructor?.name || 'Error'
    const errMsg = trinityErr?.message || String(trinityErr)
    const errStack = trinityErr?.stack || '<no stack>'
    console.error(`[trinity.fatal] ${errClass}: ${errMsg}`)
    console.error(`[trinity.fatal] stack: ${errStack}`)
    console.error(`[trinity.fatal] requestId=${requestId} userId=${userId?.slice(0, 8) || 'guest'}`)
    res.setHeader('X-Trinity-Fatal', `${errClass}: ${errMsg.slice(0, 200)}`)
    return res.status(503).json({ error: 'feed_unavailable', reason: 'trinity_error' })
  }

  if (!trinityResult || trinityResult.articles.length === 0) {
    console.error(`[trinity.empty] returned 0 articles; debug=${JSON.stringify(trinityResult?.debug || {})}`)
    return res.status(503).json({ error: 'feed_unavailable', reason: 'empty' })
  }

  const dbg = trinityResult.debug || {}
  // Phase 1.7 — structured per-request log line. Grep [trinity.path] in
  // Vercel logs to monitor traffic distribution, error rates, p99 latency,
  // and per-bucket allocation.
  console.log(
    `[trinity.path] user=${userId?.slice(0, 8) || 'guest'} qc=${dbg.qualifyingCount || 0} ` +
    `articles=${trinityResult.articles.length} path=${dbg.path} ` +
    `bucketCounts=${JSON.stringify(dbg.bucketCounts || {})} ` +
    `windowH=${dbg.mTier1WindowH || 0}/${dbg.ltWindowH || 0} ` +
    `synth=${dbg.synthApplied ? `yes(f=${dbg.synthFactor})` : 'no'} ` +
    `durationMs=${Date.now() - t0}`
  )

  const formatted = trinityResult.articles.map((a, idx) => ({
    ...formatArticle(a),
    _bucket: trinityResult.attribution[idx],
    _trinity: true,
  }))

  // user_feed_impressions has user_id NOT NULL and NO guest_device_id column.
  // Skip impression logging for anonymous-device requests; Trinity bandit
  // updates already happened inside serveTrinityFeed.
  if (userId) {
    const poolSize = dbg.poolSize || formatted.length
    const impressionRows = formatted.map((a, i) => ({
      user_id: userId,
      article_id: a.id,
      bucket: a._bucket,
      slot_index: i,
      pool_size: poolSize,
      propensity_score: poolSize > 0 ? 1.0 / poolSize : null,
      slots_pattern: 'trinity',
      request_id: requestId,
    }))
    // AWAIT — Vercel kills the lambda on return; fire-and-forget loses every row.
    const { error: impErr } = await supabase.from('user_feed_impressions').insert(impressionRows)
    if (impErr) console.error('[trinity] impression log failed:', impErr.message)
  }

  return res.status(200).json({
    articles: formatted,
    next_cursor: null,
    has_more: true,
    total: formatted.length,
    feed_state: 'normal',
    fresh_count: formatted.length,
    caught_up_message: null,
    _trinity_debug: dbg,
  })
}

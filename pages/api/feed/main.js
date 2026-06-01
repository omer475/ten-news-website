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
import { serveTrinityFeed, recordSlateExposure } from '../../../lib/trinityServe.js'
import { formatArticle } from '../../../lib/formatArticle.js'
import { readFeedCache, writeFeedCache, buildExposureMeta, expandExposureMeta } from '../../../lib/feedCache.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TRINITY_DISABLED_GLOBAL = process.env.TRINITY_DISABLE === '1'
// Precompute-cache fast path (lib/feedCache.js). On by default; set
// FEED_CACHE=0 to disable and always recompute live (instant rollback).
const FEED_CACHE_ENABLED = process.env.FEED_CACHE !== '0'

// Phase A.1 (Pinterest playbook, 2026-05-11) — request coalescing.
//
// Symptom: iOS pagination fires 2 concurrent loadMore calls ~100ms apart.
// Both send the same seen_ids. Neither knows about the other's in-flight
// slate. Production audit found 11 of 25 articles appeared in BOTH slates.
//
// Mechanism: in-memory Promise map keyed by (userId, seenIds, limit) with
// a 5s TTL. The second concurrent request with the same key awaits the
// first's Promise and returns the same articles. iOS de-dupes naturally
// on receipt. Owner of the entry writes impressions exactly once.
//
// Source: Pinterest Aperture pattern (atomic impression update per slate
// generation) + Apollo cursor-pagination best practices.
//
// Limitation: in-memory Map only coalesces within ONE Vercel function
// instance. Cross-instance dedup needs Redis/Upstash; deferred to Phase D.
// For the iOS pagination case (two requests 100ms apart same warm instance
// route most of the time), the in-memory variant catches >90% of cases.
const COALESCE_TTL_MS = 5000
const inFlightSlates = new Map()  // key → { promise, isFirst, expiresAt }

function coalesceKey(userId, seenIds, limit) {
  const seenHash = !seenIds || seenIds.length === 0
    ? 'none'
    : `${seenIds.length}-${seenIds[0]}-${seenIds[seenIds.length - 1]}`
  return `${userId || 'guest'}:${limit}:${seenHash}`
}

async function coalescedSlate(key, run) {
  const now = Date.now()
  const existing = inFlightSlates.get(key)
  if (existing && existing.expiresAt > now) {
    console.log(`[trinity.coalesce] hit key=${key.slice(0, 40)}`)
    const result = await existing.promise
    return { result, isOwner: false }
  }
  const promise = (async () => run())()
  inFlightSlates.set(key, { promise, expiresAt: now + COALESCE_TTL_MS })
  let result
  try {
    result = await promise
  } finally {
    // Keep the entry briefly so very-late-arriving requests still hit it,
    // then expire so successive pages get fresh computation.
    setTimeout(() => {
      const cur = inFlightSlates.get(key)
      if (cur && cur.promise === promise) inFlightSlates.delete(key)
    }, 500)
  }
  return { result, isOwner: true }
}

// formatArticle + safeJsonParse moved to lib/formatArticle.js (2026-05-12)
// so /api/feed/following can reuse the same iOS contract.

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

  // ────────────────────────────────────────────────────────────────────
  // Serve-from-cache fast path (precompute model — see lib/feedCache.js).
  // First page only; the cron warmer (warmer=1) and paginated loads (cursor)
  // always recompute. ANY miss / staleness / too-few-unseen / error falls
  // through to the live Trinity compute below, so this is strictly
  // non-regressive — worst case it behaves exactly like before, just slower
  // than a hit. A hit turns the ~8s recompute into a sub-ms PK lookup.
  // ────────────────────────────────────────────────────────────────────
  const isFirstPage = !req.query.cursor
  const isWarmer = req.query.warmer === '1'
  if (FEED_CACHE_ENABLED && userId && isFirstPage && !isWarmer) {
    const cacheT0 = Date.now()
    try {
      const cached = await readFeedCache(supabase, userId, { limit, seenIds })
      if (cached) {
        // Record exposure + impressions for the slate we ACTUALLY serve, just
        // like a live serve would (the precompute ran with skipExposureWrites).
        await recordSlateExposure(supabase, userId, expandExposureMeta(cached.exposure))
        const impressionRows = cached.articles.map((a, i) => ({
          user_id: userId,
          article_id: a.id,
          bucket: a._bucket,
          slot_index: i,
          pool_size: cached.poolSize,
          propensity_score: cached.poolSize > 0 ? 1.0 / cached.poolSize : null,
          slots_pattern: 'trinity-cache',
          request_id: requestId,
        }))
        const { error: impErr } = await supabase.from('user_feed_impressions').insert(impressionRows)
        if (impErr) console.error('[trinity.cache] impression log failed:', impErr.message)
        console.log(`[trinity.cache] HIT user=${userId.slice(0, 8)} served=${cached.articles.length} ageMs=${cached.ageMs} durationMs=${Date.now() - cacheT0}`)
        return res.status(200).json({
          articles: cached.articles,
          next_cursor: null,
          has_more: true,
          total: cached.articles.length,
          feed_state: 'normal',
          fresh_count: cached.articles.length,
          caught_up_message: null,
          _trinity_debug: { path: 'cache', ageMs: cached.ageMs },
        })
      }
    } catch (cacheErr) {
      console.error('[trinity.cache] read path error, falling through to live:', cacheErr.message)
    }
  }

  const t0 = Date.now()
  // Phase A.1 — request coalescing. Concurrent loadMore calls with same
  // (userId, seenIds, limit) share one slate; non-owners skip the
  // impression-log write below.
  const cKey = coalesceKey(userId, seenIds, limit)
  let trinityResult, isOwner = true
  try {
    const coalesced = await coalescedSlate(cKey, () =>
      serveTrinityFeed(supabase, {
        userId, seenIds, feedSize: limit, recentEngagementZ,
      })
    )
    trinityResult = coalesced.result
    isOwner = coalesced.isOwner
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

  // ── Goldilocks chip tags ────────────────────────────────────────────
  // The iOS card renders 2 topic chips under each article. Until 2026-05-14
  // the iOS side parsed `**Bold**` markdown spans in the bullets, which
  // produced hyper-specific entities (84% appeared in only 1 article →
  // ~49% of chip taps were empty). The server now picks the chips from
  // interest_tags filtered to the 3..200 article-count Goldilocks band
  // (see migration interest_tag_frequency + RPC article_chip_tags). Each
  // returned chip is guaranteed to have other articles backing it.
  // Empty array when no tag qualifies — iOS shows no chips rather than
  // sending the user to a dead page. Single RPC, ~25 ids, <20ms.
  const chipIds = formatted.map(a => a.id)
  if (chipIds.length > 0) {
    const { data: chipRows, error: chipErr } = await supabase.rpc('article_chip_tags', {
      article_ids: chipIds,
    })
    if (chipErr) {
      console.error('[trinity.chip_tags] rpc failed:', chipErr.message)
    }
    const chipMap = new Map((chipRows || []).map(r => [r.id, r.chip_tags || []]))
    for (const a of formatted) {
      a.chip_tags = chipMap.get(a.id) || []
    }
  }

  // user_feed_impressions has user_id NOT NULL and NO guest_device_id column.
  // Skip impression logging for anonymous-device requests; Trinity bandit
  // updates already happened inside serveTrinityFeed.
  //
  // Phase A.1 — only the coalesce OWNER writes impressions. Non-owners
  // (concurrent loadMore that shared the slate) would create duplicate
  // impression rows for the same article_id × request_id pair.
  if (userId && isOwner) {
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
  } else if (userId && !isOwner) {
    console.log(`[trinity.coalesce] non-owner: skipping impression write key=${cKey.slice(0, 40)}`)
  }

  // Cache-aside: persist this freshly computed first-page slate so the next
  // cold open for this user is an instant cache hit. Owner-only / first-page /
  // not the warmer. exposureMeta is built from the RAW slate (which still
  // carries _retriever / vq_* / source), 1:1 with `formatted`.
  if (FEED_CACHE_ENABLED && userId && isOwner && isFirstPage && !isWarmer) {
    try {
      const exposureMeta = buildExposureMeta(trinityResult.articles)
      await writeFeedCache(supabase, userId, formatted, exposureMeta, dbg.poolSize || formatted.length)
    } catch (e) {
      console.error('[trinity.cache] write failed:', e.message)
    }
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

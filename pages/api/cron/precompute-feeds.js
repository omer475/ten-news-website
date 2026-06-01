// Vercel cron — precompute first-page feed slates for recently-active users
// and store them in user_feed_cache (lib/feedCache.js). This is the
// fan-out-on-write half of the speed fix: the heavy ~8s Trinity compute runs
// offline on a schedule, so a user's app-open becomes a sub-ms cache read in
// /api/feed/main instead of an 8s live recompute.
//
// Runs every 10 min. Targets the most-recently-active users (their next open
// is the most likely to hit the cache). Everyone else is still covered by the
// cache-aside write on their first live open. Time-boxed to stay under the
// 60s function limit.
//
// IMPORTANT: serveTrinityFeed is called with skipExposureWrites=true — these
// slates have NOT been seen yet, so recording exposure/bandit signals here
// would poison the fatigue/learning counters. The exposure writes are instead
// replayed at SERVE time in /api/feed/main when the cache is actually hit.

import { createClient } from '@supabase/supabase-js'
import { serveTrinityFeed } from '../../../lib/trinityServe.js'
import { formatArticle } from '../../../lib/formatArticle.js'
import { writeFeedCache, buildExposureMeta } from '../../../lib/feedCache.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const FEED_SIZE = 25
const CONCURRENCY = 3
const TIME_BUDGET_MS = 50_000

// Build + persist one user's slate. Returns 'built' | 'empty' | 'error'.
async function precomputeOne(supabase, userId) {
  try {
    // Server-side seen ids so the precomputed slate doesn't resurface content
    // the user already saw (the client also sends its own seen_ids, which the
    // cache read re-filters against — this is the baseline).
    const { data: imps } = await supabase
      .from('user_feed_impressions')
      .select('article_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(300)
    const seenIds = Array.from(new Set((imps || []).map(r => r.article_id).filter(Boolean)))

    const result = await serveTrinityFeed(supabase, {
      userId, seenIds, feedSize: FEED_SIZE, skipExposureWrites: true,
    })
    if (!result || !Array.isArray(result.articles) || result.articles.length === 0) {
      return 'empty'
    }

    const formatted = result.articles.map((a, idx) => ({
      ...formatArticle(a),
      _bucket: result.attribution[idx],
      _trinity: true,
    }))

    // Chip tags — same enrichment the live endpoint applies.
    const chipIds = formatted.map(a => a.id)
    if (chipIds.length > 0) {
      const { data: chipRows, error: chipErr } = await supabase.rpc('article_chip_tags', { article_ids: chipIds })
      if (chipErr) console.error('[precompute] chip_tags rpc failed:', chipErr.message)
      const chipMap = new Map((chipRows || []).map(r => [r.id, r.chip_tags || []]))
      for (const a of formatted) a.chip_tags = chipMap.get(a.id) || []
    }

    const exposureMeta = buildExposureMeta(result.articles)
    await writeFeedCache(supabase, userId, formatted, exposureMeta, result.debug?.poolSize || formatted.length)
    return 'built'
  } catch (e) {
    console.error(`[precompute] user ${userId?.slice(0, 8)} failed:`, e.message)
    return 'error'
  }
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'supabase_not_configured' })
  }

  const start = Date.now()
  const maxUsers = Math.min(parseInt(req.query.max) || 15, 60)
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Most-recently-active users first — their next open is most likely to hit.
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, last_app_activity_at')
    .not('last_app_activity_at', 'is', null)
    .order('last_app_activity_at', { ascending: false })
    .limit(maxUsers)
  if (error) {
    return res.status(500).json({ error: 'user_query_failed', detail: error.message })
  }

  const queue = (users || []).map(u => u.id).filter(Boolean)
  const counts = { built: 0, empty: 0, error: 0, skipped: 0 }

  // Simple fixed-concurrency worker pool, time-boxed.
  let idx = 0
  async function worker() {
    while (idx < queue.length) {
      if (Date.now() - start > TIME_BUDGET_MS) { counts.skipped += (queue.length - idx); idx = queue.length; break }
      const myIdx = idx++
      const outcome = await precomputeOne(supabase, queue[myIdx])
      counts[outcome] = (counts[outcome] || 0) + 1
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

  const elapsed = Date.now() - start
  console.log(`[precompute] built=${counts.built} empty=${counts.empty} error=${counts.error} skipped=${counts.skipped} of=${queue.length} elapsed=${elapsed}ms`)
  return res.status(200).json({ ok: true, ...counts, total: queue.length, elapsed_ms: elapsed })
}

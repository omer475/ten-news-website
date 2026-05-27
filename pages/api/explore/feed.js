// GET /api/explore/feed — the Explore (Discovery) vertical feed.
//
// Same request/response contract as /api/feed/main (so the iOS Explore view
// renders the exact same cards), but powered by serveExploreFeed — a
// discovery pipeline that reaches OUTSIDE the user's core taste (see
// lib/exploreServe.js). Falls back to a 503 (never a broken slate) on error.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { serveExploreFeed } from '../../../lib/exploreServe.js'
import { formatArticle } from '../../../lib/formatArticle.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const limit = Math.min(parseInt(req.query.limit) || 25, 50)
  const userId = req.query.user_id || null
  const clientSeenIds = req.query.seen_ids
    ? req.query.seen_ids.split(',').map(Number).filter(Boolean)
    : []
  const seenIds = Array.from(new Set(clientSeenIds)).slice(0, 2000)
  const requestId = randomUUID()

  let result
  try {
    result = await serveExploreFeed(supabase, { userId, seenIds, feedSize: limit })
  } catch (err) {
    console.error(`[explore.fatal] req=${requestId} user=${userId?.slice(0, 8) || 'guest'}: ${err?.message}`)
    return res.status(503).json({ error: 'explore_unavailable', reason: 'serve_error' })
  }

  const slate = result?.articles || []
  if (slate.length === 0) {
    return res.status(503).json({ error: 'explore_unavailable', reason: 'empty' })
  }

  const formatted = slate.map(a => ({
    ...formatArticle(a),
    bucket: a._retriever || 'explore',
  }))

  console.log(
    `[explore.path] user=${userId?.slice(0, 8) || 'guest'} path=${result.debug?.path} ` +
    `n=${formatted.length} buckets=${JSON.stringify(result.debug?.bucketCounts || {})} ` +
    `cats=${JSON.stringify(result.debug?.categoryCounts || {})} ms=${result.debug?.durationMs}`
  )

  // Log impressions so Explore engagement feeds the bandit + dedup, exactly
  // like the For-You feed. user_feed_impressions.user_id is NOT NULL → only
  // for signed-in users; guests are read-only here.
  if (userId) {
    const rows = formatted.map((a, i) => ({
      user_id: userId,
      article_id: a.id,
      bucket: a.bucket,
      slot_index: i,
      pool_size: slate.length,
      request_id: requestId,
      created_at: new Date().toISOString(),
    }))
    const { error: impErr } = await supabase.from('user_feed_impressions').insert(rows)
    if (impErr) console.error('[explore] impression log failed:', impErr.message)
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    articles: formatted,
    count: formatted.length,
    request_id: requestId,
    debug: result.debug,
  })
}

// pages/api/feed/signal.js — "Tune my feed" (TodayPlus Feature 4).
//
// POST { article_id, cluster_id?, topic?, source?, signal: "less"|"more" }
//
// A per-card tuning control. "less" demotes the article's cluster/topic/source
// for this user; "more" boosts it. This is the explicit-intent sibling of the
// implicit skip path — it reuses the SAME stores Trinity already reads at serve
// time, so no new ranking plumbing is needed:
//   * user_negative_dimensions (RPC bump_user_negative_dim) → rerank negMult
//     demotion, keyed on vq_secondary (cluster) / vq_primary / author.
//   * user_entity_signals (RPC bulk_update_entity_signals) → interestStrength
//     boost/penalty on the article's typed entities (+ an optional topic).
//   * user_primary_cooldown → 48h soft-exclude of the VQ primary (on "less").
//
// The authoritative ranking dimensions come from the article row (vq_*,
// author_id, typed_signals) — what Trinity actually consumes. The optional
// body.topic / body.source are honored as ADDITIONAL signals. body.cluster_id
// is accepted for contract compatibility but not used for ranking (Trinity
// keys on vq_secondary, not published_articles.cluster_id).
//
// Guests (no authenticated user) no-op safely: the signal tables have no
// guest_device_id column, so we acknowledge with stored:false rather than 401.

import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SIGNAL_TYPES, slugify, isValidTypedSignal } from '../../../lib/signals/types.js'

const EXPLICIT_WEIGHT = 2.0          // explicit taps weigh more than skips (0.5-1.0)
const PRIMARY_COOLDOWN_MS = 48 * 3600 * 1000

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { article_id, cluster_id, topic, source, signal } = req.body || {}
  if (!article_id) return res.status(400).json({ error: 'article_id required' })
  if (signal !== 'less' && signal !== 'more') {
    return res.status(400).json({ error: 'signal must be "less" or "more"' })
  }

  const admin = getAdminSupabase()
  if (!admin) return res.status(500).json({ error: 'signal storage not configured (missing SUPABASE_SERVICE_KEY)' })

  try {
    const supabase = createAuthedClient({ req, res })

    // Auth: cookie session first, then Authorization: Bearer <token>.
    let user = null
    try {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) user = data.user
    } catch (_) {}
    if (!user) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization
      const token = (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer '))
        ? authHeader.slice(7).trim() : null
      if (token) {
        try {
          const { data, error } = await admin.auth.getUser(token)
          if (!error && data?.user) user = data.user
        } catch (_) {}
      }
    }
    const userId = user?.id || null

    // Guests: no signal table keys on guest_device_id — acknowledge + no-op.
    if (!userId) {
      return res.status(200).json({ success: true, stored: false, reason: 'guest' })
    }

    // Authoritative ranking dimensions from the article row.
    const { data: art } = await admin
      .from('published_articles')
      .select('id, typed_signals, source, vq_primary, vq_secondary, author_id')
      .eq('id', article_id)
      .maybeSingle()
    if (!art) return res.status(404).json({ error: 'article not found' })

    const isPositive = signal === 'more'

    // Build the entity-signal set: the article's typed entities + an optional
    // explicit topic from the body (e.g. "topic:large_language_models").
    const entities = Array.isArray(art.typed_signals) ? [...art.typed_signals] : []
    if (topic && typeof topic === 'string') {
      const topicEntity = `${SIGNAL_TYPES.TOPIC}:${slugify(topic)}`
      if (isValidTypedSignal(topicEntity) && !entities.includes(topicEntity)) {
        entities.push(topicEntity)
      }
    }

    const applied = { entity_signals: 0, negative_dims: 0, primary_cooldown: false }
    const writes = []

    // 1. Entity signals (both directions). Trinity reads these as
    //    interestStrength — penalty on "less", boost on "more".
    if (entities.length > 0) {
      writes.push(admin.rpc('bulk_update_entity_signals', {
        p_user_id: userId,
        p_entities: entities,
        p_is_positive: isPositive,
        p_weight: EXPLICIT_WEIGHT,
      }))
      applied.entity_signals = entities.length
    }

    // 2. "less" only — per-dimension demotion (rerank negMult) + VQ-primary
    //    48h cooldown, mirroring the implicit skip / not-interested path.
    if (signal === 'less') {
      if (art.vq_secondary != null) {
        writes.push(admin.rpc('bump_user_negative_dim', {
          p_user_id: userId, p_dim_type: 'cluster',
          p_dim_value: String(art.vq_secondary), p_weight: EXPLICIT_WEIGHT,
        }))
        applied.negative_dims++
      }
      if (art.vq_primary != null) {
        writes.push(admin.rpc('bump_user_negative_dim', {
          p_user_id: userId, p_dim_type: 'primary',
          p_dim_value: String(art.vq_primary), p_weight: EXPLICIT_WEIGHT,
        }))
        applied.negative_dims++
      }
      if (art.author_id) {
        writes.push(admin.rpc('bump_user_negative_dim', {
          p_user_id: userId, p_dim_type: 'author',
          p_dim_value: String(art.author_id), p_weight: EXPLICIT_WEIGHT,
        }))
        applied.negative_dims++
      }
      // Optional explicit source from the body (legacy 'source' dim, still read
      // by rerank during the source→author transition).
      const srcVal = (typeof source === 'string' && source.trim()) ? source.trim().toLowerCase()
        : (typeof art.source === 'string' ? art.source.toLowerCase() : null)
      if (srcVal) {
        writes.push(admin.rpc('bump_user_negative_dim', {
          p_user_id: userId, p_dim_type: 'source',
          p_dim_value: srcVal, p_weight: EXPLICIT_WEIGHT,
        }))
        applied.negative_dims++
      }
      if (art.vq_primary != null) {
        writes.push(admin.from('user_primary_cooldown').upsert({
          user_id: userId,
          vq_primary: art.vq_primary,
          expires_at: new Date(Date.now() + PRIMARY_COOLDOWN_MS).toISOString(),
          source_article_id: article_id,
        }, { onConflict: 'user_id,vq_primary' }))
        applied.primary_cooldown = true
      }
    }

    // Record the event for analytics / replay.
    writes.push(admin.from('user_article_events').insert({
      user_id: userId,
      article_id,
      event_type: `feed_signal_${signal}`,
      metadata: { cluster_id: cluster_id ?? null, topic: topic ?? null, source: source ?? null },
    }))

    const results = await Promise.allSettled(writes)
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error)
    if (failed.length) {
      console.error(`[feed.signal] ${failed.length}/${results.length} writes failed for ${signal} art=${article_id}`,
        failed.map(f => f.reason?.message || f.value?.error?.message).filter(Boolean).join('; '))
    }

    return res.status(200).json({ success: true, stored: true, signal, applied })
  } catch (e) {
    console.error('[feed.signal] handler error:', e?.message || e)
    return res.status(500).json({ error: 'internal error' })
  }
}

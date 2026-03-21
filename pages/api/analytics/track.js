import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

  try {
    const supabase = createAuthedClient({ req, res })
    const admin = getAdminSupabase()
    if (!admin) {
      console.log('[analytics] No admin client - missing SUPABASE_SERVICE_KEY')
      return res.status(500).json({ error: 'Server analytics storage not configured (missing SUPABASE_SERVICE_KEY)' })
    }

    // Auth: prefer cookie-based session, but also allow Authorization: Bearer <access_token>
    let user = null
    let authMethod = null
    try {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) {
        user = data.user
        authMethod = 'cookie'
      }
    } catch (_) {}

    if (!user) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization
      const token = (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer '))
        ? authHeader.slice(7).trim()
        : null

      console.log('[analytics] Trying bearer auth, token present:', !!token)
      
      if (token) {
        try {
          const { data, error } = await admin.auth.getUser(token)
          if (!error && data?.user) {
            user = data.user
            authMethod = 'bearer'
          } else if (error) {
            console.log('[analytics] Bearer auth error:', error.message)
          }
        } catch (e) {
          console.log('[analytics] Bearer auth exception:', e.message)
        }
      }
    }

    // Also accept guest device ID from request body for unauthenticated users
    const {
      event_type,
      session_id = null,
      article_id = null,
      cluster_id = null,
      category = null,
      source = null,
      referrer = null,
      page = null,
      metadata = {},
      guest_device_id = null
    } = req.body || {}

    // Fallback: accept guest_device_id OR user_id from request body
    // This handles: (1) guest users, (2) authenticated users with expired tokens
    const fallbackId = guest_device_id || req.body?.user_id
    if (!user && fallbackId) {
      // Validate this ID exists in profiles (prevents spoofing random IDs)
      const { data: fallbackProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', fallbackId)
        .maybeSingle()
      if (fallbackProfile) {
        user = { id: fallbackId }
        authMethod = 'fallback_id'
      } else if (guest_device_id) {
        // Guest — create profile so events can be stored
        await admin.from('profiles').upsert({ id: guest_device_id }, { onConflict: 'id' }).then(() => {}).catch(() => {})
        user = { id: guest_device_id }
        authMethod = 'guest_device_new'
      }
    }

    if (!user) {
      console.log('[analytics] No user found after auth attempts')
      return res.status(401).json({ error: 'Not authenticated' })
    }

    console.log('[analytics] Auth success via', authMethod, 'user:', user.id?.substring(0, 8))

    if (!event_type || typeof event_type !== 'string') {
      return res.status(400).json({ error: 'event_type is required' })
    }

    // Extract view_seconds from metadata for article_exit events
    let view_seconds = null
    if (event_type === 'article_exit' && metadata?.total_active_seconds) {
      view_seconds = parseInt(metadata.total_active_seconds, 10) || null
    } else if (event_type === 'article_engaged' && metadata?.engaged_seconds) {
      view_seconds = parseInt(metadata.engaged_seconds, 10) || null
    }

    const row = {
      user_id: user.id,
      session_id,
      event_type,
      article_id,
      cluster_id,
      category,
      source,
      referrer,
      page,
      view_seconds,
      metadata: (metadata && typeof metadata === 'object') ? metadata : {}
    }

    console.log('[analytics] Inserting event:', event_type, 'article:', article_id)
    
    const { error: insertError } = await admin
      .from('user_article_events')
      .insert(row)

    if (insertError) {
      console.error('[analytics] Insert error:', insertError.message, insertError.code, insertError.details)
      return res.status(500).json({ error: 'Failed to store event', details: insertError.message })
    }

    console.log('[analytics] Event stored successfully:', event_type)

    // Update taste vector via EMA on engagement events (non-blocking)
    // This feeds the pgvector personalization system
    // NOTE: article_view is NOT included — passive views pollute the taste vector
    // toward dominant content. Only real engagement signals update the vector.
    // article_skipped pushes the vector AWAY from skipped content and builds skip_profile.
    const TASTE_UPDATE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_liked', 'article_shared']
    if (TASTE_UPDATE_EVENTS.includes(event_type) && article_id) {
      // user.id IS the profiles.id (auth UUID) — update directly
      admin.rpc('update_taste_vector_ema_profiles', {
        p_user_id: user.id,
        p_article_id: article_id,
        p_event_type: event_type,
      }).then(({ error: emaError }) => {
        if (emaError) {
          console.log('[analytics] Taste vector EMA update failed:', emaError.message)
        } else {
          console.log('[analytics] Taste vector updated for user:', user.id?.substring(0, 8))
        }
      })
    }

    // Build tag_profile from engagement events (entity-level interest tracking, non-blocking)
    // Only first 6 tags (primary topics) with position-based weighting:
    //   Tag 1 gets full weight, Tag 6 gets ~28%. Tail tags are noise.
    const TAG_PROFILE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_liked', 'article_shared']
    const TAG_PROFILE_WEIGHTS = { article_liked: 0.20, article_shared: 0.18, article_saved: 0.15, article_engaged: 0.10, article_detail_view: 0.05 }
    if (TAG_PROFILE_EVENTS.includes(event_type) && article_id) {
      let baseWeight = TAG_PROFILE_WEIGHTS[event_type] || 0.05

      // Tiered dwell amplifier for engaged events — longer reads = stronger learning
      const dwellSeconds = metadata?.dwell ? parseFloat(metadata.dwell) :
                           metadata?.total_active_seconds ? parseFloat(metadata.total_active_seconds) : 0
      if (event_type === 'article_engaged' && dwellSeconds > 0) {
        // Tiers: 6-12s → 1.0x, 12-25s → 1.5x, 25-45s → 2.0x, 45s+ → 2.5x
        if (dwellSeconds >= 45) baseWeight *= 2.5
        else if (dwellSeconds >= 25) baseWeight *= 2.0
        else if (dwellSeconds >= 12) baseWeight *= 1.5
        // 6-12s = default 1.0x (no change)
      }

      admin
        .from('published_articles')
        .select('interest_tags')
        .eq('id', article_id)
        .single()
        .then(({ data: articleData }) => {
          if (!articleData) return
          const allTags = typeof articleData.interest_tags === 'string'
            ? JSON.parse(articleData.interest_tags || '[]')
            : (articleData.interest_tags || [])
          // Only first 6 tags — tail tags are noise (mentioned in passing, not about)
          const tags = allTags.slice(0, 6)
          if (tags.length === 0) return

          admin
            .from('profiles')
            .select('tag_profile')
            .eq('id', user.id)
            .single()
            .then(({ data: profileData }) => {
              const tagProfile = profileData?.tag_profile || {}
              for (let i = 0; i < tags.length; i++) {
                const t = tags[i].toLowerCase()
                // Position-based weighting: tag 0 = full weight, tag 5 = ~28%
                const positionMultiplier = 1.0 - (i * 0.12)
                const tagWeight = baseWeight * positionMultiplier
                tagProfile[t] = Math.min((tagProfile[t] || 0) + tagWeight, 1.0)
              }
              admin
                .from('profiles')
                .update({ tag_profile: tagProfile })
                .eq('id', user.id)
                .then(() => {})
                .catch(() => {})
            })
            .catch(() => {})
        })
        .catch(() => {})
    }

    // ============================================================
    // EXPLORE PAGE SIGNALS → tag_profile updates
    //
    // Three events from Explore browsing:
    //   explore_topic_tap    → +0.02 per entity_name (card tap)
    //   explore_topic_dwell  → min(dwell_seconds * 0.008, 0.12) (time on expanded card)
    //   explore_article_tap  → +0.06 per entity_name + ALL article interest_tags
    //
    // Daily cap: max 0.40 total Explore boost per day to prevent inflation.
    // Debounce: explore_topic_dwell fires once per topic per session (enforced client-side).
    // ============================================================

    const EXPLORE_EVENTS = ['explore_topic_tap', 'explore_topic_dwell', 'explore_article_tap']
    if (EXPLORE_EVENTS.includes(event_type)) {
      const entityName = (metadata?.entity_name || '').toLowerCase().trim()
      if (!entityName) {
        console.log('[analytics] Explore event missing entity_name in metadata')
      } else {
        admin
          .from('profiles')
          .select('tag_profile, explore_daily_boost')
          .eq('id', user.id)
          .single()
          .then(({ data: profileData }) => {
            const tagProfile = profileData?.tag_profile || {}

            // Daily cap tracking: { date: "2026-03-12", total: 0.23 }
            const today = new Date().toISOString().slice(0, 10)
            let dailyBoost = profileData?.explore_daily_boost || {}
            if (dailyBoost.date !== today) {
              dailyBoost = { date: today, total: 0 }
            }
            const DAILY_CAP = 0.40
            const remaining = Math.max(0, DAILY_CAP - (dailyBoost.total || 0))
            if (remaining <= 0) {
              console.log('[analytics] Explore daily cap reached for user:', user.id?.substring(0, 8))
              return
            }

            // Calculate boost based on event type
            let boost = 0
            if (event_type === 'explore_topic_tap') {
              boost = 0.02
            } else if (event_type === 'explore_topic_dwell') {
              const dwellSeconds = parseFloat(metadata?.dwell_seconds || '0')
              boost = Math.min(dwellSeconds * 0.008, 0.12)
            } else if (event_type === 'explore_article_tap') {
              boost = 0.06
            }

            // Clamp to remaining daily budget
            boost = Math.min(boost, remaining)
            if (boost <= 0) return

            // Update entity_name in tag_profile
            tagProfile[entityName] = Math.min((tagProfile[entityName] || 0) + boost, 1.0)
            dailyBoost.total = (dailyBoost.total || 0) + boost

            // For explore_article_tap: ALSO boost all of the article's interest_tags
            // This helps cold-start users build a richer profile faster
            if (event_type === 'explore_article_tap' && article_id) {
              admin
                .from('published_articles')
                .select('interest_tags')
                .eq('id', article_id)
                .single()
                .then(({ data: articleData }) => {
                  if (!articleData) {
                    // No article found, just save the entity_name boost
                    admin
                      .from('profiles')
                      .update({ tag_profile: tagProfile, explore_daily_boost: dailyBoost })
                      .eq('id', user.id)
                      .then(() => {})
                      .catch(() => {})
                    return
                  }
                  const tags = typeof articleData.interest_tags === 'string'
                    ? JSON.parse(articleData.interest_tags || '[]')
                    : (articleData.interest_tags || [])

                  // Boost each article tag at half the entity boost (0.03)
                  const articleTagBoost = Math.min(boost * 0.5, remaining - boost)
                  for (const tag of tags) {
                    const t = tag.toLowerCase()
                    if (t === entityName) continue // already boosted above
                    tagProfile[t] = Math.min((tagProfile[t] || 0) + articleTagBoost, 1.0)
                  }
                  dailyBoost.total += articleTagBoost * tags.length

                  admin
                    .from('profiles')
                    .update({ tag_profile: tagProfile, explore_daily_boost: dailyBoost })
                    .eq('id', user.id)
                    .then(() => console.log('[analytics] Explore article_tap tag_profile updated'))
                    .catch(() => {})
                })
                .catch(() => {})
            } else {
              // topic_tap or topic_dwell: just save the entity_name boost
              admin
                .from('profiles')
                .update({ tag_profile: tagProfile, explore_daily_boost: dailyBoost })
                .eq('id', user.id)
                .then(() => console.log('[analytics] Explore', event_type, 'tag_profile updated'))
                .catch(() => {})
            }
          })
          .catch(() => {})
      }
    }

    // ============================================================
    // SEARCH QUERY SIGNALS → tag_profile updates
    // When a user searches, their query terms reveal strong interest.
    // Boost matching tags in tag_profile.
    // ============================================================
    if (event_type === 'search_query' && metadata?.query) {
      const queryTerms = metadata.query.toLowerCase().trim().split(/\s+/).filter(t => t.length >= 2)
      if (queryTerms.length > 0) {
        admin
          .from('profiles')
          .select('tag_profile')
          .eq('id', user.id)
          .single()
          .then(({ data: profileData }) => {
            const tagProfile = profileData?.tag_profile || {}
            for (const term of queryTerms) {
              // Search is the STRONGEST explicit intent signal — user typed this
              // Weight: 0.40 per term (2x a like, 4x an engage)
              tagProfile[term] = Math.min((tagProfile[term] || 0) + 0.40, 1.0)
            }
            // Multi-word phrase gets even stronger boost (0.50)
            if (queryTerms.length >= 2) {
              const phrase = queryTerms.join(' ')
              tagProfile[phrase] = Math.min((tagProfile[phrase] || 0) + 0.50, 1.0)
            }
            admin
              .from('profiles')
              .update({ tag_profile: tagProfile })
              .eq('id', user.id)
              .then(() => console.log('[analytics] Search query boosted tag_profile:', metadata.query, 'terms:', queryTerms.length))
              .catch(() => {})
          })
          .catch(() => {})
      }
    }

    // Build skip_profile from skipped articles (non-blocking)
    if (event_type === 'article_skipped' && article_id) {
      admin
        .from('published_articles')
        .select('interest_tags')
        .eq('id', article_id)
        .single()
        .then(({ data: articleData }) => {
          if (!articleData) return
          const tags = typeof articleData.interest_tags === 'string'
            ? JSON.parse(articleData.interest_tags || '[]')
            : (articleData.interest_tags || [])
          if (tags.length === 0) return

          // Load current skip_profile, update, and save
          admin
            .from('profiles')
            .select('skip_profile')
            .eq('id', user.id)
            .single()
            .then(({ data: profileData }) => {
              const skipProfile = profileData?.skip_profile || {}
              const now = new Date().toISOString()
              for (const tag of tags) {
                const t = tag.toLowerCase()
                // Store as timestamped objects for proper time decay in feed scoring
                // Weight: 0.20 per skip (same as a like) — skips are clear negative signals
                const existing = skipProfile[t]
                const currentW = typeof existing === 'object' ? (existing.w || 0) : (typeof existing === 'number' ? existing : 0)
                skipProfile[t] = { w: Math.min(currentW + 0.20, 1.5), t: now }
              }
              admin
                .from('profiles')
                .update({ skip_profile: skipProfile })
                .eq('id', user.id)
                .then(() => {})
                .catch(() => {
                  // Fallback to users table
                  admin
                    .from('users')
                    .update({ skip_profile: skipProfile })
                    .eq('id', user.id)
                    .then(() => {})
                    .catch(() => {})
                })
            })
            .catch(() => {})
        })
        .catch(() => {})
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


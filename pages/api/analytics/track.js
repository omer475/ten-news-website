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

    if (!user) {
      console.log('[analytics] No user found after auth attempts')
      return res.status(401).json({ error: 'Not authenticated' })
    }
    
    console.log('[analytics] Auth success via', authMethod, 'user:', user.id?.substring(0, 8))

    const {
      event_type,
      session_id = null,
      article_id = null,
      cluster_id = null,
      category = null,
      source = null,
      referrer = null,
      page = null,
      metadata = {}
    } = req.body || {}

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
    const TASTE_UPDATE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_revisit']
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

      // Auto-clustering trigger: re-cluster user's interest vectors at engagement milestones
      // Thresholds: 20, 50, 100, then every 50 after that
      // Non-blocking — fire-and-forget to avoid slowing the analytics response
      if (['article_engaged', 'article_saved', 'article_revisit'].includes(event_type)) {
        admin
          .from('user_article_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('event_type', ['article_engaged', 'article_saved', 'article_revisit'])
          .then(({ count }) => {
            const n = count || 0
            // Trigger at 20, 50, 100, 150, 200, ...
            const shouldCluster = n === 20 || n === 50 || (n >= 100 && n % 50 === 0)
            if (shouldCluster) {
              console.log(`[analytics] Auto-clustering triggered for user ${user.id?.substring(0, 8)} at ${n} engagements`)
              admin.rpc('cluster_user_interests', {
                p_user_id: user.id,
                p_max_clusters: 5,
                p_lookback_days: 90,
              }).then(({ data: clusterCount, error: clusterError }) => {
                if (clusterError) {
                  console.log('[analytics] Auto-clustering failed:', clusterError.message)
                } else {
                  console.log(`[analytics] Auto-clustered user ${user.id?.substring(0, 8)}: ${clusterCount} clusters`)
                }
              })
            }
          })
          .catch(() => {})
      }
    }

    // Build tag_profile from engagement events (entity-level interest tracking, non-blocking)
    // Only first 6 tags (primary topics) with position-based weighting:
    //   Tag 1 gets full weight, Tag 6 gets ~28%. Tail tags are noise.
    const TAG_PROFILE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_revisit']
    const TAG_PROFILE_WEIGHTS = { article_revisit: 0.30, article_saved: 0.15, article_engaged: 0.10, article_detail_view: 0.05 }
    if (TAG_PROFILE_EVENTS.includes(event_type) && article_id) {
      const baseWeight = TAG_PROFILE_WEIGHTS[event_type] || 0.05
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

              // Time decay: 0.97^days since last update (~50% decay over 23 days)
              // Interests that aren't reinforced fade naturally
              const now = Date.now()
              const lastUpdated = tagProfile._last_updated || now
              const daysSince = (now - lastUpdated) / (1000 * 60 * 60 * 24)
              if (daysSince > 0.04) { // skip if < ~1 hour
                const decayFactor = Math.pow(0.97, daysSince)
                for (const key of Object.keys(tagProfile)) {
                  if (key.startsWith('_')) continue
                  tagProfile[key] *= decayFactor
                  if (tagProfile[key] < 0.02) delete tagProfile[key]
                }
              }
              tagProfile._last_updated = now

              // Track newly discovered interests for first-seen velocity boost
              const newInterests = (tagProfile._new_interests || [])
                .filter(e => (now - e.ts) < 48 * 3600000) // prune entries older than 48h
              for (let i = 0; i < tags.length; i++) {
                const t = tags[i].toLowerCase()
                // First-seen detection: tag is new or was pruned (below 0.02)
                if (!tagProfile[t] || tagProfile[t] < 0.02) {
                  if (!newInterests.find(e => e.tag === t)) {
                    newInterests.push({ tag: t, ts: now })
                  }
                }
                // Position-based weighting: tag 0 = full weight, tag 5 = ~28%
                const positionMultiplier = 1.0 - (i * 0.12)
                const tagWeight = baseWeight * positionMultiplier
                tagProfile[t] = Math.min((tagProfile[t] || 0) + tagWeight, 1.0)
              }
              tagProfile._new_interests = newInterests
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

    // Cold-start boost: article_view with dwell > 4s = weak positive signal
    // Helps new users build a profile from their very first session
    if (event_type === 'article_view' && article_id) {
      const dwell = parseFloat(metadata?.dwell || '0')
      if (dwell >= 4.0) {
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
            const tags = allTags.slice(0, 6)
            if (tags.length === 0) return
            admin
              .from('profiles')
              .select('tag_profile')
              .eq('id', user.id)
              .single()
              .then(({ data: profileData }) => {
                const tagProfile = profileData?.tag_profile || {}
                for (const tag of tags) {
                  const t = tag.toLowerCase()
                  tagProfile[t] = Math.min((tagProfile[t] || 0) + 0.01, 1.0)
                }
                tagProfile._last_updated = Date.now()
                admin.from('profiles').update({ tag_profile: tagProfile }).eq('id', user.id)
                  .then(() => {}).catch(() => {})
              })
              .catch(() => {})
          })
          .catch(() => {})
      }
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

            // Time decay (same as feed engagement path)
            const now = Date.now()
            const lastUpdated = tagProfile._last_updated || now
            const daysSince = (now - lastUpdated) / (1000 * 60 * 60 * 24)
            if (daysSince > 0.04) {
              const decayFactor = Math.pow(0.97, daysSince)
              for (const key of Object.keys(tagProfile)) {
                if (key.startsWith('_')) continue
                tagProfile[key] *= decayFactor
                if (tagProfile[key] < 0.02) delete tagProfile[key]
              }
            }
            tagProfile._last_updated = now

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

    // Build skip_profile from skipped articles (non-blocking)
    // 4-tier contextual skip signals:
    //   hard skip (<1.5s): +0.08 per tag — didn't even read the headline
    //   soft skip (1.5-3s): +0.03 per tag — read headline, not interested
    if (event_type === 'article_skipped' && article_id) {
      const skipType = metadata?.skip_type || 'hard'
      const skipWeight = skipType === 'soft' ? 0.03 : 0.08
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
              for (const tag of tags) {
                const t = tag.toLowerCase()
                skipProfile[t] = Math.min((skipProfile[t] || 0) + skipWeight, 0.9)
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

    // Discovery engagement memory: track shown/engaged per category for discovery articles
    // Used to stop exploring categories the user consistently rejects
    const bucket = metadata?.bucket
    const articleCategory = category || metadata?.category
    if (bucket === 'discovery' && articleCategory &&
        ['article_skipped', 'article_engaged', 'article_revisit', 'article_saved'].includes(event_type)) {
      const isPositive = event_type !== 'article_skipped'
      admin
        .from('profiles')
        .select('discovery_stats')
        .eq('id', user.id)
        .single()
        .then(({ data: profileData }) => {
          const stats = profileData?.discovery_stats || {}
          const cat = articleCategory
          if (!stats[cat]) stats[cat] = { shown: 0, engaged: 0 }
          stats[cat].shown = (stats[cat].shown || 0) + 1
          if (isPositive) stats[cat].engaged = (stats[cat].engaged || 0) + 1
          admin.from('profiles').update({ discovery_stats: stats }).eq('id', user.id)
            .then(() => {}).catch(() => {})
        })
        .catch(() => {})
    }

    // Dynamic category affinity: track engagement rate per category (shown vs engaged)
    // Drives category weights by what user actually likes, not what we show
    if (articleCategory &&
        ['article_skipped', 'article_engaged', 'article_revisit', 'article_saved', 'article_view'].includes(event_type)) {
      const isPositive = ['article_engaged', 'article_revisit', 'article_saved'].includes(event_type)
      admin
        .from('profiles')
        .select('category_profile')
        .eq('id', user.id)
        .single()
        .then(({ data: profileData }) => {
          const catProfile = profileData?.category_profile || {}
          const cat = articleCategory
          if (!catProfile[cat]) catProfile[cat] = { shown: 0, engaged: 0 }
          catProfile[cat].shown = (catProfile[cat].shown || 0) + 1
          if (isPositive) catProfile[cat].engaged = (catProfile[cat].engaged || 0) + 1
          admin.from('profiles').update({ category_profile: catProfile }).eq('id', user.id)
            .then(() => {}).catch(() => {})
        })
        .catch(() => {})
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

// Helper: load a field from profiles, fall back to users table (for guest users)
async function loadUserField(admin, userId, field) {
  const { data: profileData } = await admin.from('profiles').select(field).eq('id', userId).maybeSingle()
  if (profileData) return { data: profileData, table: 'profiles' }
  // Try users table with the requested fields
  const { data: userData, error: userError } = await admin.from('users').select(field).eq('id', userId).maybeSingle()
  if (userError) {
    console.log('[analytics] loadUserField users error:', userError.message?.substring(0, 80), 'field:', field)
    // Fallback: try selecting all common profile fields
    const { data: fallback } = await admin.from('users').select('skip_profile, tag_profile').eq('id', userId).maybeSingle()
    if (fallback) return { data: fallback, table: 'users' }
    // Last resort: just skip_profile
    const { data: last } = await admin.from('users').select('skip_profile').eq('id', userId).maybeSingle()
    if (last) return { data: last, table: 'users' }
  }
  if (userData) return { data: userData, table: 'users' }
  return { data: null, table: null }
}

// Helper: update a field in the correct table for this user
function updateUserField(admin, userId, table, updates) {
  if (!table) return Promise.resolve()
  return admin.from(table).update(updates).eq('id', userId).then(() => {}).catch((err) => {
    // If tag_profile column doesn't exist in users table, just skip it
    console.log('[analytics] updateUserField error:', err?.message?.substring(0, 80))
  })
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
    // TAG_PROFILE UPDATE — lightweight metadata for search/explore only
    // The real learning happens via EMA taste_vector (above).
    // Tags are no longer used for feed scoring (embedding-first v22).
    const TAG_PROFILE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_liked', 'article_shared']
    if (TAG_PROFILE_EVENTS.includes(event_type) && article_id) {
      try {
        const { data: articleData } = await admin.from('published_articles').select('interest_tags').eq('id', article_id).single()
        if (articleData) {
          const allTags = typeof articleData.interest_tags === 'string' ? JSON.parse(articleData.interest_tags || '[]') : (articleData.interest_tags || [])
          const tags = allTags.slice(0, 6)
          if (tags.length > 0) {
            const { data: profileData, table } = await loadUserField(admin, user.id, 'tag_profile')
            if (table) {
              const tagProfile = profileData?.tag_profile || {}
              // Flat weight per tag — all tags equal, frequency does the differentiation
              const weight = 0.15
              for (const tag of tags) {
                const t = tag.toLowerCase()
                tagProfile[t] = Math.min((tagProfile[t] || 0) + weight, 1.5)
              }
              await updateUserField(admin, user.id, table, { tag_profile: tagProfile })
            }
          }
        }
      } catch (e) {}
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
        loadUserField(admin, user.id, 'tag_profile, explore_daily_boost')
          .then(({ data: profileData, table }) => {
            if (!table) return
            const tagProfile = profileData?.tag_profile || {}

            const today = new Date().toISOString().slice(0, 10)
            let dailyBoost = profileData?.explore_daily_boost || {}
            if (dailyBoost.date !== today) dailyBoost = { date: today, total: 0 }
            const DAILY_CAP = 0.40
            const remaining = Math.max(0, DAILY_CAP - (dailyBoost.total || 0))
            if (remaining <= 0) return

            let boost = 0
            if (event_type === 'explore_topic_tap') boost = 0.02
            else if (event_type === 'explore_topic_dwell') boost = Math.min(parseFloat(metadata?.dwell_seconds || '0') * 0.008, 0.12)
            else if (event_type === 'explore_article_tap') boost = 0.06
            boost = Math.min(boost, remaining)
            if (boost <= 0) return

            tagProfile[entityName] = Math.min((tagProfile[entityName] || 0) + boost, 1.0)
            dailyBoost.total = (dailyBoost.total || 0) + boost

            if (event_type === 'explore_article_tap' && article_id) {
              admin.from('published_articles').select('interest_tags').eq('id', article_id).single()
                .then(({ data: articleData }) => {
                  if (articleData) {
                    const tags = typeof articleData.interest_tags === 'string' ? JSON.parse(articleData.interest_tags || '[]') : (articleData.interest_tags || [])
                    const articleTagBoost = Math.min(boost * 0.5, remaining - boost)
                    for (const tag of tags) { const t = tag.toLowerCase(); if (t !== entityName) tagProfile[t] = Math.min((tagProfile[t] || 0) + articleTagBoost, 1.0) }
                    dailyBoost.total += articleTagBoost * tags.length
                  }
                  updateUserField(admin, user.id, table, { tag_profile: tagProfile, explore_daily_boost: dailyBoost })
                }).catch(() => updateUserField(admin, user.id, table, { tag_profile: tagProfile, explore_daily_boost: dailyBoost }))
            } else {
              updateUserField(admin, user.id, table, { tag_profile: tagProfile, explore_daily_boost: dailyBoost })
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
        loadUserField(admin, user.id, 'tag_profile')
          .then(({ data: profileData, table }) => {
            if (!table) return
            const tagProfile = profileData?.tag_profile || {}
            for (const term of queryTerms) {
              tagProfile[term] = Math.min((tagProfile[term] || 0) + 0.40, 1.0)
            }
            if (queryTerms.length >= 2) {
              const phrase = queryTerms.join(' ')
              tagProfile[phrase] = Math.min((tagProfile[phrase] || 0) + 0.50, 1.0)
            }
            updateUserField(admin, user.id, table, { tag_profile: tagProfile })
              .then(() => console.log('[analytics] Search query boosted tag_profile in', table, ':', metadata.query))
          })
          .catch(() => {})
      }
    }

    // Build skip_profile ONLY from DELIBERATE rejections (not fast skips)
    // Per MEGA_RAPOR research:
    //   - TikTok: skip p-value = 0.14 (statistically weak signal)
    //   - LinkedIn: Tskip threshold — below it, P(engagement) ≈ 0
    //   - Twitter/X: only explicit "Not Interested" counts, not regular skips
    //
    // Fast skips (<3s) are NEUTRAL — user may not have even read the headline.
    // Only build skip_profile when dwell >= 3s (user SAW the content and rejected it).
    const skipDwell = metadata?.dwell ? parseFloat(metadata.dwell) : 0
    const isDeliberateSkip = event_type === 'article_skipped' && article_id && skipDwell >= 3
    if (isDeliberateSkip) {
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
          // Try profiles first, then users table (for guest users)
          admin
            .from('profiles')
            .select('skip_profile')
            .eq('id', user.id)
            .maybeSingle()
            .then(({ data: profileData }) => {
              const now = new Date().toISOString()
              const updateSkipProfile = (existing) => {
                const skipProfile = existing || {}
                for (const tag of tags) {
                  const t = tag.toLowerCase()
                  const entry = skipProfile[t]
                  const currentW = typeof entry === 'object' ? (entry.w || 0) : (typeof entry === 'number' ? entry : 0)
                  // Deliberate skip (3s+ dwell): moderate penalty, capped low
                  // Per MEGA_RAPOR: skips are weak signals even when deliberate
                skipProfile[t] = { w: Math.min(currentW + 0.05, 0.5), t: now }
                }
                return skipProfile
              }

              if (profileData) {
                // Profile exists — update it
                const skipProfile = updateSkipProfile(profileData.skip_profile)
                admin.from('profiles').update({ skip_profile: skipProfile }).eq('id', user.id).then(() => {}).catch(() => {})
              } else {
                // No profile row — try users table
                admin.from('users').select('skip_profile').eq('id', user.id).maybeSingle().then(({ data: userData }) => {
                  const skipProfile = updateSkipProfile(userData?.skip_profile)
                  admin.from('users').update({ skip_profile: skipProfile }).eq('id', user.id).then(() => {
                    console.log('[analytics] Updated skip_profile in users table for', user.id?.substring(0, 8))
                  }).catch(() => {})
                }).catch(() => {})
              }
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


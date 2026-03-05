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
    const TASTE_UPDATE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view']
    if (TASTE_UPDATE_EVENTS.includes(event_type) && article_id) {
      // Look up the user's personalization user_id (users table, linked via auth_user_id)
      try {
        const { data: persUser } = await admin
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        if (persUser) {
          // Fire-and-forget: update taste vector via DB function
          admin.rpc('update_taste_vector_ema', {
            p_user_id: persUser.id,
            p_article_id: article_id,
            p_event_type: event_type,
          }).then(({ error: emaError }) => {
            if (emaError) {
              console.log('[analytics] Taste vector EMA update failed:', emaError.message)
            } else {
              console.log('[analytics] Taste vector updated for user:', persUser.id?.substring(0, 8))
            }
          })
        }
      } catch (e) {
        // Non-critical — taste vector update is best-effort
        console.log('[analytics] Taste vector lookup failed:', e.message)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


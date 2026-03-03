import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { evolveTasteVector } from '../../../lib/embeddings'

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

    // Evolve taste vector based on signal strength
    let learningRate = null
    if (event_type === 'article_saved' && article_id) {
      learningRate = 0.15
    } else if (event_type === 'article_engaged' && article_id) {
      learningRate = 0.10
    } else if (event_type === 'article_exit' && article_id && view_seconds) {
      if (view_seconds >= 30) learningRate = 0.12
      else if (view_seconds >= 15) learningRate = 0.07
      else if (view_seconds >= 5) learningRate = 0.03
    }

    if (learningRate !== null) {
      try {
        await evolveTasteVectorAsync(admin, user.id, article_id, learningRate)
        console.log(`[analytics] Taste vector evolution triggered: ${event_type}, lr=${learningRate}, seconds=${view_seconds || 'n/a'}`)
      } catch (err) {
        console.error('[analytics] Taste vector evolution error (non-fatal):', err.message)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Evolve the user's taste vector toward the engaged article's embedding.
 * Runs async (fire-and-forget) so it doesn't slow down the analytics response.
 */
async function evolveTasteVectorAsync(admin, userId, articleId, learningRate = 0.1) {
  // Fetch user's current taste vector
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('taste_vector, taste_vector_version')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.taste_vector) {
    return // No taste vector to evolve
  }

  // Fetch article embedding
  const { data: article, error: articleError } = await admin
    .from('published_articles')
    .select('embedding')
    .eq('id', articleId)
    .single()

  if (articleError || !article?.embedding) {
    return // No article embedding available
  }

  const currentVector = profile.taste_vector
  const articleVector = article.embedding

  if (!Array.isArray(currentVector) || !Array.isArray(articleVector) || currentVector.length !== articleVector.length) {
    return
  }

  const newVector = evolveTasteVector(currentVector, articleVector, learningRate)
  const newVersion = Math.max(2, (profile.taste_vector_version || 1) + 1)

  await admin
    .from('profiles')
    .update({
      taste_vector: newVector,
      taste_vector_version: newVersion,
      taste_vector_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  console.log(`[analytics] Taste vector evolved for user ${userId.substring(0, 8)}, version: ${newVersion}, lr: ${learningRate}`)
}


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
    const admin = getAdminSupabase()
    if (!admin) {
      return res.status(500).json({ error: 'Server not configured' })
    }

    // Get user from token
    const authHeader = req.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { interests } = req.body || {}
    if (!interests || typeof interests !== 'object') {
      return res.status(400).json({ error: 'interests object required' })
    }

    // Clean and normalize the interests object
    const cleanedInterests = {}
    for (const [keyword, weight] of Object.entries(interests)) {
      const cleanKey = keyword.toLowerCase().trim()
      if (cleanKey && typeof weight === 'number') {
        cleanedInterests[cleanKey] = Math.round(Math.min(100, Math.max(0, weight)) * 100) / 100 // 2 decimal places
      }
    }

    if (Object.keys(cleanedInterests).length === 0) {
      return res.status(200).json({ ok: true, keywords: 0 })
    }

    // Upsert single row per user with entire interests JSONB
    const { error: upsertError } = await admin
      .from('user_interests')
      .upsert({
        user_id: user.id,
        interests: cleanedInterests,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Interests sync error:', upsertError)
      return res.status(500).json({ error: 'Failed to sync interests' })
    }

    return res.status(200).json({ 
      ok: true, 
      keywords: Object.keys(cleanedInterests).length 
    })
  } catch (e) {
    console.error('Interests sync error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

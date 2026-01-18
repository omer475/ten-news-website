import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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

    // Fetch user interests (single row per user)
    const { data: row, error: fetchError } = await admin
      .from('user_interests')
      .select('interests, updated_at')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Interests fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch interests' })
    }

    // Return interests or empty object
    return res.status(200).json({ 
      interests: row?.interests || {},
      updated_at: row?.updated_at || null
    })
  } catch (e) {
    console.error('Interests fetch error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

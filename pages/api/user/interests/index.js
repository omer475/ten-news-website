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

    // Fetch user interests
    const { data: rows, error: fetchError } = await admin
      .from('user_interests')
      .select('keyword, weight')
      .eq('user_id', user.id)
      .order('weight', { ascending: false })
      .limit(200) // Max 200 interests

    if (fetchError) {
      console.error('Interests fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch interests' })
    }

    // Convert to object format
    const interests = {}
    for (const row of (rows || [])) {
      interests[row.keyword] = row.weight
    }

    return res.status(200).json({ interests })
  } catch (e) {
    console.error('Interests fetch error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/auth/complete-profile
// For users (typically after Google OAuth) who signed up without a username/DOB.
// Requires a valid access_token — only the authenticated user can update their own row.

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null
    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authenticated' })
    }

    const body = req.body || {}
    const username = (body.username || '').trim()
    const dateOfBirth = body.date_of_birth || body.dateOfBirth || null
    const name = (body.name || body.full_name || '').trim() || null

    if (!username && !dateOfBirth) {
      return res.status(400).json({ success: false, error: 'username or date_of_birth required' })
    }
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username must be 3-20 chars, letters/numbers/underscore only' })
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth)
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date of birth' })
      }
      const years = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      if (years < 13) {
        return res.status(400).json({ success: false, error: 'You must be at least 13 years old' })
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server configuration error' })
    }

    const { createClient } = await import('@supabase/supabase-js')

    // Verify the caller's identity via the bearer token
    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: { user }, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !user) {
      return res.status(401).json({ success: false, error: 'Invalid session' })
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Username availability check (skip if user keeps their existing one)
    if (username) {
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', user.id)
        .maybeSingle()
      if (taken) {
        return res.status(409).json({ success: false, error: 'Username already taken' })
      }
    }

    const patch = { updated_at: new Date().toISOString() }
    if (username) patch.username = username
    if (dateOfBirth) patch.date_of_birth = dateOfBirth
    if (name) patch.full_name = name

    const { error: updateErr } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', user.id)

    if (updateErr) {
      console.error('[complete-profile] update failed:', updateErr.message)
      return res.status(400).json({ success: false, error: updateErr.message })
    }

    const { data: updated } = await admin
      .from('profiles')
      .select('id, email, full_name, username, date_of_birth, avatar_url, created_at')
      .eq('id', user.id)
      .maybeSingle()

    return res.status(200).json({
      success: true,
      user: {
        id: updated?.id,
        email: updated?.email,
        name: updated?.full_name,
        username: updated?.username,
        date_of_birth: updated?.date_of_birth,
        avatar_url: updated?.avatar_url,
        created_at: updated?.created_at,
      }
    })
  } catch (err) {
    console.error('[complete-profile] unexpected error:', err.message)
    return res.status(500).json({ success: false, error: 'Something went wrong' })
  }
}

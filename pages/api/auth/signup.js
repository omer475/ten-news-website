export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    // Accept both `name` (new) and `fullName` (legacy) for backwards compat.
    const email = body.email
    const password = body.password
    const name = (body.name || body.fullName || '').trim()
    const username = (body.username || '').trim()
    const dateOfBirth = body.date_of_birth || body.dateOfBirth || null
    const timezone = body.timezone || 'UTC'

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username must be 3-20 chars, letters/numbers/underscore only' })
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth)
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date of birth' })
      }
      const ageMs = Date.now() - dob.getTime()
      const years = ageMs / (1000 * 60 * 60 * 24 * 365.25)
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

    // Pre-flight: username availability (service key bypasses RLS)
    if (username) {
      const admin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      if (taken) {
        return res.status(409).json({ success: false, error: 'Username already taken' })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://todayplus.news'
    const signupPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || null,
          username: username || null,
          date_of_birth: dateOfBirth || null,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Signup timed out')), 25000)
    )

    const { data, error } = await Promise.race([signupPromise, timeoutPromise])

    if (error) {
      const msg = error.message || ''
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists. Please log in.' })
      }
      return res.status(400).json({ success: false, error: msg || 'Signup failed' })
    }

    if (!data?.user) {
      return res.status(500).json({ success: false, error: 'Failed to create account' })
    }

    // Empty identities array = duplicate email (Supabase quirk)
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists. Please log in.' })
    }

    // Upsert profile with username + dob. Uses service key so it writes even
    // before the user confirms their email.
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const profileRow = {
      id: data.user.id,
      email,
      full_name: name || null,
      username: username || null,
      date_of_birth: dateOfBirth || null,
      email_timezone: timezone,
      newsletter_subscribed: true,
      preferred_email_hour: 10,
      created_at: new Date().toISOString(),
    }
    const { error: profileError } = await admin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
    if (profileError) {
      console.error('[signup] Profile upsert failed:', profileError.message)
      // Non-fatal — auth user exists, profile row will be created on first login
    }

    // If Supabase returned a session, user is fully signed in (auto-confirm mode).
    // Otherwise email OTP verification is required.
    if (data.session) {
      return res.status(201).json({
        success: true,
        requiresVerification: false,
        message: 'Account created',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name || null,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
        },
      })
    }

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Check your email for a verification code.',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: name || null,
      },
    })
  } catch (err) {
    console.error('[signup] Unexpected error:', err.message)
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
}

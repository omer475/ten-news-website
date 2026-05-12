export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const email = (body.email || '').trim().toLowerCase()
    const code = (body.code || '').toString().trim()

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and code are required' })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, error: 'Server configuration error' })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Supabase sends the same code for both signup confirmation and magic-link
    // login. Try the signup type first; on failure fall back to 'email' so a
    // user re-verifying after a token refresh still works.
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      data = retry.data
      error = retry.error
    }

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('expired')) {
        return res.status(400).json({ success: false, error: 'This code has expired. Request a new one.' })
      }
      if (msg.includes('invalid') || msg.includes('token')) {
        return res.status(400).json({ success: false, error: 'Invalid verification code. Check the latest email.' })
      }
      return res.status(400).json({ success: false, error: error.message || 'Verification failed' })
    }

    if (!data?.user || !data?.session) {
      return res.status(400).json({ success: false, error: 'Verification failed — no session returned' })
    }

    const userMeta = data.user.user_metadata || {}
    return res.status(200).json({
      success: true,
      message: 'Email verified',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userMeta.full_name || null,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
    })
  } catch (err) {
    console.error('[verify-otp] Unexpected error:', err.message)
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
}

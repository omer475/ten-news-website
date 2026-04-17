export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  try {
    const { email, code } = req.body || {}

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ success: false, message: 'Server configuration error' })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify the OTP code — this confirms the email and returns a session
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup'
    })

    if (error) {
      console.error('OTP verification error:', error.message)
      const msg = error.message.includes('expired')
        ? 'Code has expired. Please sign up again.'
        : error.message.includes('invalid') || error.message.includes('Token')
        ? 'Invalid code. Please check and try again.'
        : error.message
      return res.status(400).json({ success: false, message: msg })
    }

    if (!data?.user) {
      return res.status(400).json({ success: false, message: 'Verification failed' })
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified!',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name
      },
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type
      } : null
    })

  } catch (error) {
    console.error('Verify OTP error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

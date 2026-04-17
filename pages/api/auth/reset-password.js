export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  try {
    const { email, code, newPassword } = req.body || {}

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, verification code, and new password are required'
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return res.status(500).json({ success: false, message: 'Server configuration error' })
    }

    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Step 1: Verify the OTP code — this confirms the recovery and returns a session
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'recovery'
    })

    if (verifyError) {
      console.error('OTP verify error:', verifyError.message)
      const msg = verifyError.message.includes('expired')
        ? 'Code has expired. Please request a new one.'
        : verifyError.message.includes('invalid') || verifyError.message.includes('Token')
        ? 'Invalid code. Please check and try again.'
        : verifyError.message
      return res.status(400).json({ success: false, message: msg })
    }

    if (!verifyData?.user) {
      return res.status(400).json({ success: false, message: 'Verification failed' })
    }

    // Step 2: Update the password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      verifyData.user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError.message)
      return res.status(400).json({ success: false, message: 'Failed to update password' })
    }

    // Step 3: Sign in with new password to get a fresh session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email, password: newPassword
    })

    const session = signInData?.session || verifyData.session
    const user = signInData?.user || verifyData.user

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully!',
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name
      },
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type
      } : null
    })

  } catch (error) {
    console.error('Reset password error:', error.message)
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
}

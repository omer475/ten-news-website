import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  console.log('📝 Signup request received')

  try {
    const body = req.body || {}
    const { email, password, fullName } = body

    console.log('📝 Request body:', { email, hasPassword: !!password, fullName })

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and full name are required'
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('🔧 Supabase config:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please try again later.'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tennews.ai'
    const redirectUrl = `${siteUrl}/auth/callback`
    
    console.log('🚀 Creating user with Supabase...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectUrl
      }
    })

    if (error) {
      console.error('❌ Supabase error:', error.message)
      
      if (error.message.includes('already') || error.message.includes('exists')) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please try logging in.'
        })
      }

      return res.status(400).json({
        success: false,
        message: error.message || 'Signup failed'
      })
    }

    if (!data?.user) {
      console.error('❌ No user data returned')
      return res.status(500).json({
        success: false,
        message: 'Failed to create account. Please try again.'
      })
    }

    // Check if user already exists (empty identities means duplicate)
    if (data.user.identities?.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please try logging in.'
      })
    }

    console.log('✅ User created:', data.user.id)

    // Try to create profile (non-blocking)
    try {
      await supabase.from('profiles').insert([{
        id: data.user.id,
        email: email,
        full_name: fullName,
        created_at: new Date().toISOString()
      }])
      console.log('✅ Profile created')
    } catch (profileError) {
      console.error('⚠️ Profile error (non-fatal):', profileError.message)
    }

    return res.status(201).json({
      success: true,
      message: 'Account created! Check your email for verification.',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error.message, error.stack)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    })
  }
}

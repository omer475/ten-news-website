export default async function handler(req, res) {
  // Always set JSON content type first
  res.setHeader('Content-Type', 'application/json')
  
  console.log('🔵 Signup endpoint hit:', req.method)
  
  // Wrap everything in try-catch to catch any errors including import errors
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' })
    }

    console.log('📝 Signup POST request received')
    console.log('📝 Body type:', typeof req.body)
    console.log('📝 Body:', JSON.stringify(req.body))

    // TEMPORARY: Test if we can respond to POST at all
    // Remove this after testing
    if (req.query.test === 'early') {
      return res.status(200).json({ success: true, message: 'Early test passed', body: req.body })
    }

    const body = req.body || {}
    const { email, password, fullName, timezone } = body

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

    // Dynamic import to catch any import errors
    console.log('📦 Importing Supabase...')
    const { createClient } = await import('@supabase/supabase-js')
    console.log('✅ Supabase imported')

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tennews.ai'
    const redirectUrl = `${siteUrl}/auth/callback`
    
    console.log('🚀 Creating user with Supabase...')

    // Add timeout wrapper to prevent hanging
    const signupPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectUrl
      }
    })

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Signup timed out after 25 seconds')), 25000)
    )

    const { data, error } = await Promise.race([signupPromise, timeoutPromise])

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
        email_timezone: timezone || 'UTC',
        newsletter_subscribed: true,
        preferred_email_hour: 10,
        created_at: new Date().toISOString()
      }])
      console.log('✅ Profile created with timezone:', timezone || 'UTC')
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

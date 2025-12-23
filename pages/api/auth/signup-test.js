// Test endpoint that simulates signup without actually creating user
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  console.log('📝 Signup test request:', req.method)
  
  try {
    if (req.method !== 'POST') {
      return res.status(200).json({ 
        success: true, 
        message: 'Use POST method to test signup',
        method: req.method 
      })
    }

    // Test body parsing
    const body = req.body
    console.log('📝 Body received:', body)
    
    if (!body) {
      return res.status(400).json({
        success: false,
        message: 'No body received',
        bodyType: typeof body
      })
    }

    const { email, password, fullName } = body
    
    // Test Supabase import
    console.log('📦 Testing Supabase import...')
    const { createClient } = await import('@supabase/supabase-js')
    console.log('✅ Supabase imported successfully')
    
    // Test environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: 'Missing Supabase credentials',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      })
    }
    
    // Test creating client
    console.log('🔧 Creating Supabase client...')
    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log('✅ Client created')
    
    return res.status(200).json({
      success: true,
      message: 'All tests passed! Signup should work.',
      received: {
        email: email || 'not provided',
        hasPassword: !!password,
        fullName: fullName || 'not provided'
      },
      env: {
        hasSupabaseUrl: true,
        hasSupabaseKey: true
      }
    })
    
  } catch (error) {
    console.error('❌ Error:', error.message, error.stack)
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    })
  }
}


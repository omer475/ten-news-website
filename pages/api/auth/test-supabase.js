import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('🔍 Testing Supabase connection...')
    console.log('URL exists:', !!supabaseUrl)
    console.log('Key exists:', !!supabaseKey)
    console.log('URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING')

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Supabase credentials missing',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        env: process.env.NODE_ENV
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test connection by fetching a user count (requires service key, but we'll try auth)
    // Just test if we can create a client
    const testResult = {
      connection: 'OK',
      url: supabaseUrl,
      keyLength: supabaseKey.length,
      keyPrefix: supabaseKey.substring(0, 20) + '...',
      environment: process.env.NODE_ENV
    }

    // Try to check if we can access auth
    try {
      // This will fail with anon key, but we can see the error type
      const { data, error } = await supabase.auth.getSession()
      testResult.authTest = error ? {
        error: true,
        message: error.message,
        status: error.status
      } : {
        error: false,
        hasSession: !!data?.session
      }
    } catch (e) {
      testResult.authTest = {
        error: true,
        message: e.message
      }
    }

    return res.status(200).json({
      success: true,
      ...testResult
    })

  } catch (error) {
    console.error('Test error:', error)
    return res.status(500).json({
      error: 'Test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}



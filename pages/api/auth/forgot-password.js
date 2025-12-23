import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials missing')
      return res.status(500).json({
        message: 'Server configuration error. Please contact support.'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the site URL for the redirect
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.NODE_ENV === 'production' 
                      ? 'https://tennews.ai' 
                      : 'http://localhost:3000')
    const redirectUrl = `${siteUrl}/auth/callback?type=recovery`

    console.log('🔐 Password reset request for:', email)
    console.log('📍 Redirect URL:', redirectUrl)

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      console.error('❌ Password reset error:', error.message)
      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
    }

    // Always return success to prevent email enumeration attacks
    console.log('✅ Password reset email sent (or user not found)')
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return res.status(500).json({ 
      message: 'Failed to process request. Please try again.'
    })
  }
}


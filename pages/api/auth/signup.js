import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Make Resend optional for local development
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email, password, fullName } = req.body

  console.log('📝 Signup request received:', { email, hasPassword: !!password, fullName })

  if (!email || !password || !fullName) {
    console.error('❌ Missing required fields')
    return res.status(400).json({
      message: 'Email, password, and full name are required'
    })
  }

  // Validate password strength
  if (password.length < 8) {
    console.error('❌ Password too short')
    return res.status(400).json({
      message: 'Password must be at least 8 characters long'
    })
  }

  try {
    // Use direct Supabase client for signup (more reliable than auth helpers)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials missing:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
      return res.status(500).json({
        message: 'Server configuration error. Please contact support.'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if user already exists in profiles table
    console.log('🔍 Checking if user already exists...')
    let existingProfile = null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .single()
      existingProfile = data
    } catch (error) {
      // Ignore error - user doesn't exist, which is fine
      console.log('ℹ️ No existing profile found (expected for new users)')
    }

    // Note: We'll let Supabase handle duplicate detection in auth.users, but log if found in profiles
    if (existingProfile) {
      console.warn('⚠️ User exists in profiles table:', email)
      // Don't block signup - Supabase will handle duplicate emails
    }

    // Create the user account
    // Use environment variable for site URL, fallback to localhost for development
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.NODE_ENV === 'production' 
                      ? 'https://tennews.ai' 
                      : 'http://localhost:3000')
    const redirectUrl = `${siteUrl}/auth/callback`
    
    console.log('🔐 Signup attempt for:', email)
    console.log('📍 Redirect URL:', redirectUrl)
    console.log('🌍 Environment:', process.env.NODE_ENV)
    
    console.log('🚀 Attempting to create user in Supabase...')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: redirectUrl
      }
    })

    if (error) {
      console.error('❌ Supabase signup error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        fullError: JSON.stringify(error, null, 2)
      })
      
      // Handle specific Supabase errors
      if (error.message.includes('already registered') || 
          error.message.includes('User already registered') || 
          error.message.includes('already been registered') ||
          error.message.includes('already exists')) {
        return res.status(409).json({
          message: 'You already have an account with this email address. Please try logging in instead.',
          error: error.message
        })
      }

      return res.status(error.status || 400).json({
        message: error.message || 'Signup failed',
        error: error.message
      })
    }

    if (!data || !data.user) {
      console.error('❌ No user data returned from Supabase:', data)
      return res.status(500).json({
        message: 'User creation failed. No user data returned.',
        error: 'No user data'
      })
    }

    console.log('✅ User created successfully:', {
      userId: data.user.id,
      email: data.user.email,
      emailConfirmed: !!data.user.email_confirmed_at,
      createdAt: data.user.created_at
    })
    
    // Check if email was sent
    if (data.user && !data.user.email_confirmed_at) {
      console.log('📬 Confirmation email should be sent by Supabase')
      console.log('📧 Check Supabase Settings -> Authentication -> Email to ensure emails are enabled')
    } else if (data.user?.email_confirmed_at) {
      console.log('⚠️ User email already confirmed (auto-confirmed in Supabase settings)')
      console.log('💡 This means "Enable email confirmations" is OFF in Supabase')
    }

    // Create user profile
    if (data.user) {
      console.log('📋 Creating user profile...')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            email: email,
            full_name: fullName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()

      if (profileError) {
        console.error('❌ Profile creation error:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        })
        // Don't fail the signup if profile creation fails, but log it
      } else {
        console.log('✅ User profile created:', profileData)
      }
    }

    // Send welcome email (optional - skip if Resend not configured)
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Ten News <onboarding@resend.dev>',
          to: email,
          subject: 'Welcome to Ten News! 🎉',
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1f2937; text-align: center;">Welcome to Ten News, ${fullName}! 🎉</h1>

            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
              Thank you for joining Ten News! Your account has been created successfully.
            </p>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1f2937; margin-top: 0;">What happens next?</h2>
              <ul style="color: #4b5563; line-height: 1.6;">
                <li><strong>Verify your email:</strong> Check your inbox for a verification link from Supabase</li>
                <li><strong>Daily news:</strong> Get AI-curated global news summaries every day</li>
                <li><strong>Timeline feature:</strong> Explore historical context for current events</li>
                <li><strong>Dark mode:</strong> Switch between light and dark themes</li>
              </ul>
            </div>

            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
              If you have any questions, feel free to reply to this email.
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
              Happy reading! 📰<br>
              The Ten News Team
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 12px; color: #6b7280; text-align: center;">
              You're receiving this email because you signed up for Ten News.<br>
              If you didn't create this account, please ignore this email.
            </p>
          </div>
        `
        })
        console.log('✅ Welcome email sent to:', email)
      } catch (emailError) {
        console.error('⚠️ Failed to send welcome email:', emailError)
        // Don't fail signup if email fails
      }
    } else {
      console.log('ℹ️ Resend not configured - skipping welcome email (verification email still sent by Supabase)')
    }

    return res.status(201).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: !!data.user.email_confirmed_at
      },
      message: 'Account created successfully! Check your email for a welcome message and verification instructions.'
    })

  } catch (error) {
    console.error('❌ Unexpected signup error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    })
    return res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    })
  }
}

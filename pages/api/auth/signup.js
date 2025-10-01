import { createClient } from '../../../lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email, password, fullName } = req.body

  if (!email || !password || !fullName) {
    return res.status(400).json({
      message: 'Email, password, and full name are required'
    })
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters long'
    })
  }

  try {
    const supabase = createClient({ req, res })

    // Check if user already exists by looking in profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()

    if (existingProfile) {
      return res.status(409).json({
        message: 'You already have an account with this email address. Please try logging in instead.'
      })
    }

    // Create the user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('already registered') || error.message.includes('User already registered') || error.message.includes('already been registered')) {
        return res.status(409).json({
          message: 'You already have an account with this email address. Please try logging in instead.'
        })
      }

      return res.status(error.status || 400).json({
        message: error.message || 'Signup failed'
      })
    }

    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
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

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Don't fail the signup if profile creation fails
      }
    }

    // Send welcome email
    try {
      await resend.emails.send({
        from: 'Ten News <noreply@tennews.app>',
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
      console.log('Welcome email sent to:', email)
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // Don't fail signup if email fails
    }

    return res.status(201).json({
      user: data.user,
      message: 'Account created successfully! Check your email for a welcome message and verification instructions.'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

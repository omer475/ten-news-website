import { createClient } from '../../../lib/supabase-server'

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
    const supabase = createClient()

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

    return res.status(201).json({
      user: data.user,
      message: 'Account created successfully. Please check your email to verify your account.'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

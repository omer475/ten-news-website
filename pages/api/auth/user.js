import { createClient } from '../../../lib/supabase-server'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const supabase = createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return res.status(error.status || 400).json({
        message: error.message || 'Failed to get user'
      })
    }

    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' })
    }

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
    }

    return res.status(200).json({
      user,
      profile: profile || null
    })

  } catch (error) {
    console.error('Get user error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

import { createClient } from '../../../lib/supabase-server'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const supabase = createClient({ req, res })

    const { error } = await supabase.auth.signOut()

    if (error) {
      return res.status(error.status || 400).json({
        message: error.message || 'Logout failed'
      })
    }

    return res.status(200).json({ message: 'Logout successful' })

  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

export function createClient({ req, res }) {
  return createServerSupabaseClient({ req, res })
}

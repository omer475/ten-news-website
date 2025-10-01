import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export function createClient({ req, res }) {
  return createPagesServerClient({ req, res })
}

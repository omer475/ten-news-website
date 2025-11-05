import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

export function createClient({ req, res }) {
  // If Supabase credentials are missing, return null instead of throwing error
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase not configured - API routes will work without authentication');
    return null;
  }
  
  try {
    return createServerSupabaseClient({ req, res });
  } catch (error) {
    console.error('❌ Error creating Supabase server client:', error);
    return null;
  }
}

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  // If Supabase credentials are missing, return null instead of throwing error
  // This allows the app to work for testing without Supabase configured
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase not configured - running without authentication');
    return null;
  }
  
  try {
    return createBrowserClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('❌ Error creating Supabase client:', error);
    return null;
  }
}

export { supabaseUrl, supabaseKey }

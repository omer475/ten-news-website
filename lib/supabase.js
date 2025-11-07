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
    return createBrowserClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name) {
          // Get cookie value from document.cookie
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(';').shift();
        },
        set(name, value, options) {
          // Set cookie with proper options
          let cookie = `${name}=${value}`;
          if (options?.maxAge) {
            cookie += `; max-age=${options.maxAge}`;
          }
          if (options?.path) {
            cookie += `; path=${options.path}`;
          }
          if (options?.sameSite) {
            cookie += `; samesite=${options.sameSite}`;
          }
          document.cookie = cookie;
        },
        remove(name, options) {
          // Remove cookie by setting expired date
          let cookie = `${name}=; max-age=0`;
          if (options?.path) {
            cookie += `; path=${options.path}`;
          }
          document.cookie = cookie;
        },
      },
    });
  } catch (error) {
    console.error('❌ Error creating Supabase client:', error);
    return null;
  }
}

export { supabaseUrl, supabaseKey }

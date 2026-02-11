-- =====================================================
-- MIGRATION 015: Link Auth Users to Personalization Profiles
-- =====================================================
-- This connects Supabase Auth users (auth.users / profiles table)
-- with the personalization system (users table).
-- Run this in Supabase SQL Editor.

-- 1. Add auth_user_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 2. Create index for fast lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- 3. Update the constraint to include spain and italy
-- (Drop old constraint first if it exists, then recreate)
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_home_country;
ALTER TABLE users ADD CONSTRAINT valid_home_country CHECK (home_country = ANY(ARRAY[
  'usa', 'uk', 'china', 'russia', 'germany', 'france',
  'ukraine', 'turkiye', 'ireland', 'india', 'japan', 'south_korea',
  'pakistan', 'singapore', 'israel', 'canada', 'brazil',
  'nigeria', 'south_africa', 'australia', 'spain', 'italy'
]));

-- 4. Allow service role to query users table (for linking)
-- The backend API uses service_key which bypasses RLS, but add policy for completeness
DROP POLICY IF EXISTS "Service role can read all users" ON users;
CREATE POLICY "Service role can read all users" ON users
  FOR SELECT USING (true);

-- Done!
-- Verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_user_id';

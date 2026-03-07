-- Migration: Merge personalization columns from users table into profiles table
-- This consolidates user data so authenticated users have everything in one place.

-- Add personalization columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followed_countries TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followed_topics TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Backfill from users table where auth_user_id is linked
UPDATE profiles p
SET
  home_country = u.home_country,
  followed_countries = u.followed_countries,
  followed_topics = u.followed_topics,
  onboarding_completed = u.onboarding_completed
FROM users u
WHERE u.auth_user_id = p.id
  AND u.onboarding_completed = true;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed);

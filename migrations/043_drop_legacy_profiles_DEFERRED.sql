-- Migration 043: Drop legacy signal columns
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DO NOT RUN THIS until 24 hours after migration 042 deploys cleanly.
-- Verify the feed works correctly with typed entity signals first.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- Drop skip_profile column from profiles (saturated, replaced by user_entity_signals)
ALTER TABLE profiles DROP COLUMN IF EXISTS skip_profile;

-- Drop tag_profile column from profiles (replaced by user_entity_signals)
ALTER TABLE profiles DROP COLUMN IF EXISTS tag_profile;

-- Drop home_country as a personalization input (now behavior-derived via loc: signals)
-- NOTE: Keep home_country in profiles for display purposes if needed.
-- Only remove it if the iOS Profile screen no longer references it.
-- ALTER TABLE profiles DROP COLUMN IF EXISTS home_country;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS followed_countries;

-- Also drop from users table if it exists there
ALTER TABLE users DROP COLUMN IF EXISTS skip_profile;

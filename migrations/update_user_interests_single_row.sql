-- Update user_interests to have ONE row per user with all keywords in JSONB
-- This replaces the old multi-row design

-- Drop the old table
DROP TABLE IF EXISTS user_interests;

-- Create new single-row-per-user table
CREATE TABLE user_interests (
  user_id UUID PRIMARY KEY NOT NULL,
  interests JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_interests_updated ON user_interests(updated_at DESC);

-- Example of what the data will look like:
-- user_id: 7328ada5-bba7-41d1-9cc3-21a1119f3586
-- interests: {
--   "donald trump": 5.28,
--   "international relations": 5.34,
--   "china": 3.08,
--   "finance": 3.22,
--   ...
-- }
-- updated_at: 2026-01-18 12:55:52+00

-- Add tag_profile column to users table (for guest users who don't have profiles rows)
-- Guest users have device UUIDs that aren't in auth.users, so they can't have profiles rows.
-- This column lets the analytics pipeline store engagement signals for guest users.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tag_profile JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.tag_profile IS
  'Entity-level interest tag weights for guest users. Same format as profiles.tag_profile.';

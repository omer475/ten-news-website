-- Add tag_profile column to profiles table
-- Stores entity-level interest weights (e.g., {"galatasaray": 0.92, "ai": 0.85})
-- Updated incrementally by track.js on engagement events (saved/engaged/detail_view)
-- Used by the feed algorithm for entity-level personalization scoring

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tag_profile JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.tag_profile IS
  'Entity-level interest tag weights. Keys are lowercase interest tags (e.g., galatasaray, champions league, ai). Values are 0.0-1.0 weights incremented by engagement events.';

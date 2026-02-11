-- =====================================================
-- MIGRATION 017: Add summary column to world_event_timeline
-- =====================================================
-- The world_event_timeline table is missing a 'summary' column
-- that the pipeline code (step6_world_event_detection.py) tries to insert.
-- This causes "Could not find the 'summary' column" errors.
-- Run this in Supabase SQL Editor.

-- 1. Add summary column to world_event_timeline
ALTER TABLE world_event_timeline 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Add comment for documentation
COMMENT ON COLUMN world_event_timeline.summary IS 'Brief summary of this timeline development';

-- Done!
-- Verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'world_event_timeline' AND column_name = 'summary';

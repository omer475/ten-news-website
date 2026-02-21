-- Add missing analytics and component columns to world_events
-- These are written by event_components.py but were never added to the schema

ALTER TABLE world_events
ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS data_analytics JSONB,
ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_what_to_watch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS what_to_watch JSONB DEFAULT '[]'::jsonb;

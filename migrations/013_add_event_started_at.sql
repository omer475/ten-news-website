-- Add started_at field to world_events for accurate day counter
-- This stores the actual start date of the event (not when we added it to our database)

ALTER TABLE world_events 
ADD COLUMN IF NOT EXISTS started_at DATE;

-- Add show_day_counter flag to manually control which events show the counter
ALTER TABLE world_events 
ADD COLUMN IF NOT EXISTS show_day_counter BOOLEAN DEFAULT false;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_world_events_started_at ON world_events(started_at);

-- Comment explaining the fields
COMMENT ON COLUMN world_events.started_at IS 'Actual start date of the event (e.g., Feb 24 2022 for Ukraine War), found via AI search at event creation';
COMMENT ON COLUMN world_events.show_day_counter IS 'Whether to show the day counter for this event on the UI';

-- =====================================================
-- MIGRATION 016: Pipeline Run Lock Table
-- =====================================================
-- Prevents overlapping Cloud Run executions.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS pipeline_run_lock (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_running BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  
  -- Only allow one row
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the initial row
INSERT INTO pipeline_run_lock (id, is_running, started_at, finished_at)
VALUES (1, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow service role full access
ALTER TABLE pipeline_run_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages run lock" ON pipeline_run_lock;
CREATE POLICY "Service role manages run lock" ON pipeline_run_lock
  FOR ALL USING (true);

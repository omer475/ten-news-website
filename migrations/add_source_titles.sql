-- Add source_titles column to published_articles table for clustering verification
-- Run this in Supabase SQL Editor

-- Add column to store original source article titles as JSON array
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS source_titles JSONB;

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'published_articles' AND column_name = 'source_titles';


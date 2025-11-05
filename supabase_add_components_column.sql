-- Add components column to articles table for component ordering
-- This stores the ordered array like ["graph", "timeline", "details"]
-- Run this in Supabase SQL Editor

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN articles.components IS 'Ordered array of component types for display: ["graph", "timeline", "details"]';

-- Create index for faster queries on components
CREATE INDEX IF NOT EXISTS idx_articles_components ON articles USING GIN (components);


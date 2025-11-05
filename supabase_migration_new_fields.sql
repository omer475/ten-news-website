-- SUPABASE MIGRATION: Add new fields for live news system
-- Run this in your Supabase SQL editor to add the new columns

-- Add new columns for the enhanced live news system
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS summary_bullets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS graph JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS map JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_summary_bullets ON articles USING GIN (summary_bullets);
CREATE INDEX IF NOT EXISTS idx_articles_graph ON articles USING GIN (graph);
CREATE INDEX IF NOT EXISTS idx_articles_map ON articles USING GIN (map);

-- Update existing articles to have empty JSON for new fields
UPDATE articles 
SET 
    summary_bullets = '[]'::jsonb,
    graph = '{}'::jsonb,
    map = '{}'::jsonb
WHERE 
    summary_bullets IS NULL 
    OR graph IS NULL 
    OR map IS NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'articles' 
    AND column_name IN ('summary_bullets', 'graph', 'map')
ORDER BY column_name;

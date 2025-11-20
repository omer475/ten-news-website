-- Duplicate Article Prevention System
-- Create processed_articles tracking table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS processed_articles (
    article_url TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT NOT NULL,
    published_date TIMESTAMP WITH TIME ZONE,
    title TEXT
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_articles(processed_at);
CREATE INDEX IF NOT EXISTS idx_source ON processed_articles(source);

-- Verify table was created
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'processed_articles'
ORDER BY ordinal_position;


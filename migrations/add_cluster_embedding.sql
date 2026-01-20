-- Add embedding column to clusters table for caching
-- Run this in Supabase SQL Editor

-- Add embedding column (stores vector as JSON array)
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS embedding JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clusters_embedding_not_null 
ON clusters (id) WHERE embedding IS NOT NULL;

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clusters' AND column_name = 'embedding';


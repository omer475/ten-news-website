-- ==========================================
-- ADD EMBEDDING STORAGE TO CLUSTERS TABLE
-- This avoids regenerating 600+ embeddings every run
-- Run this in Supabase SQL Editor
-- ==========================================

-- Add embedding column to clusters table
-- Using JSONB to store the embedding array (768 floats for Gemini text-embedding-004)
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS title_embedding JSONB;

-- Add index for faster queries on clusters with/without embeddings
CREATE INDEX IF NOT EXISTS idx_clusters_has_embedding 
ON clusters ((title_embedding IS NOT NULL));

-- Add index on active clusters for faster filtering
CREATE INDEX IF NOT EXISTS idx_clusters_status_created 
ON clusters (status, created_at DESC);


-- ==========================================
-- ADD IMAGE_URL COLUMN TO SOURCE_ARTICLES
-- ==========================================
-- Run this in Supabase SQL Editor to add image URL support

-- Add image_url column to store RSS feed images
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional: Add index for faster queries (if you plan to query by image presence)
CREATE INDEX IF NOT EXISTS idx_source_articles_has_image 
ON source_articles(image_url) WHERE image_url IS NOT NULL;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'source_articles' 
AND column_name = 'image_url';


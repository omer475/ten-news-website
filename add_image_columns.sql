-- Add image-related columns to published_articles table
-- Run this in Supabase SQL Editor

-- Add image URL column
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image source name (which outlet provided the image)
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS image_source TEXT;

-- Add image quality score (for debugging/analytics)
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS image_score FLOAT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_published_articles_image_url 
ON published_articles(image_url) 
WHERE image_url IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'published_articles' 
AND column_name IN ('image_url', 'image_source', 'image_score');


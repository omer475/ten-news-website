-- Migration to add 'article' and 'summary_bullets' columns to articles table
-- Run this in Supabase SQL Editor

-- Step 1: Add 'article' column for detailed article text (150-200 words)
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS article TEXT;

-- Step 2: Add 'summary_bullets' column for bullet points (stored as JSONB array)
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS summary_bullets JSONB;

-- Step 3: Copy existing data from ai_detailed_text to article (if column exists)
-- This ensures backward compatibility
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name = 'ai_detailed_text'
    ) THEN
        UPDATE articles 
        SET article = ai_detailed_text 
        WHERE article IS NULL AND ai_detailed_text IS NOT NULL;
    END IF;
END $$;

-- Step 4: Create index on summary_bullets for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_articles_summary_bullets ON articles USING GIN (summary_bullets);

-- Step 5: Verify the migration
SELECT 
    COUNT(*) as total_articles,
    COUNT(article) as articles_with_article_text,
    COUNT(summary_bullets) as articles_with_bullets
FROM articles
WHERE published = true;

-- Expected output:
-- total_articles: Total number of published articles
-- articles_with_article_text: Number of articles with detailed text
-- articles_with_bullets: Number of articles with bullet points

-- Note: Newly generated articles will automatically populate both fields
-- Old articles may only have article text but no bullets until they are regenerated


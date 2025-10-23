-- FIX AND RESET ARTICLES TABLE
-- Run this in Supabase SQL Editor

-- Step 1: Check current schema (just to see what we have)
-- Uncomment to run:
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'articles'
-- AND column_name IN ('article', 'summary_bullets', 'ai_detailed_text', 'summary')
-- ORDER BY column_name;

-- Step 2: Drop old columns if they exist
ALTER TABLE articles DROP COLUMN IF EXISTS ai_detailed_text;
ALTER TABLE articles DROP COLUMN IF EXISTS summary;

-- Step 3: Ensure correct columns exist with correct types
-- Add article column (TEXT) for detailed article text
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles' AND column_name = 'article'
    ) THEN
        ALTER TABLE articles ADD COLUMN article TEXT;
    ELSE
        -- Make sure it's TEXT type
        ALTER TABLE articles ALTER COLUMN article TYPE TEXT;
    END IF;
END $$;

-- Add summary_bullets column (JSONB array) for bullet points
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles' AND column_name = 'summary_bullets'
    ) THEN
        ALTER TABLE articles ADD COLUMN summary_bullets JSONB;
    ELSE
        -- Make sure it's JSONB type
        ALTER TABLE articles ALTER COLUMN summary_bullets TYPE JSONB USING summary_bullets::jsonb;
    END IF;
END $$;

-- Step 4: Delete all existing articles
DELETE FROM articles;

-- Step 5: Verify the schema is correct
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'articles'
AND column_name IN ('article', 'summary_bullets', 'emoji', 'ai_title')
ORDER BY column_name;

-- Expected output:
-- article          | text  | YES
-- ai_title         | text  | YES  
-- emoji            | text  | YES
-- summary_bullets  | jsonb | YES

-- Step 6: Verify table is empty
SELECT COUNT(*) as total_articles FROM articles;

-- Should return: 0

-- ✅ DONE! 
-- The table is now ready to receive articles with:
-- - article (TEXT): Detailed article text (max 200 words)
-- - summary_bullets (JSONB): Array of 3-5 bullet points
-- - emoji (TEXT): Single emoji for the article


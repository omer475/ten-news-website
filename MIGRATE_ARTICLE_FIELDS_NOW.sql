-- ==========================================
-- MIGRATION: Add article and summary_bullets columns
-- Run this in Supabase SQL Editor
-- ==========================================

-- Step 1: Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add article column (detailed text, max 200 words)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles' AND column_name = 'article'
    ) THEN
        ALTER TABLE articles ADD COLUMN article TEXT;
        RAISE NOTICE 'Added article column';
    ELSE
        RAISE NOTICE 'article column already exists';
    END IF;

    -- Add summary_bullets column (JSONB array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles' AND column_name = 'summary_bullets'
    ) THEN
        ALTER TABLE articles ADD COLUMN summary_bullets JSONB;
        RAISE NOTICE 'Added summary_bullets column';
    ELSE
        RAISE NOTICE 'summary_bullets column already exists';
    END IF;
END $$;

-- Step 2: Create index on summary_bullets for fast searching
CREATE INDEX IF NOT EXISTS idx_articles_summary_bullets ON articles USING gin(summary_bullets);

-- Step 3: Verify the columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name IN ('article', 'summary_bullets')
ORDER BY column_name;

-- ==========================================
-- SUCCESS! Your database is now ready
-- ==========================================
-- The live system will now save:
-- - article: Detailed text (max 200 words)
-- - summary_bullets: Array of 3-5 bullet points
-- ==========================================


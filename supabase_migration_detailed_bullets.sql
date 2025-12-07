-- ============================================
-- SUPABASE MIGRATION: Add Detailed Bullets Column
-- ============================================
-- Run this in your Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard -> SQL Editor
-- ============================================

-- Add new column for detailed bullet summaries
-- This column stores longer bullet points (90-120 chars each)
-- The existing summary_bullets column will store standard bullets (60-80 chars)

ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS summary_bullets_detailed JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN published_articles.summary_bullets_detailed IS 'Detailed bullet summaries (90-120 chars each) - longer version for expanded view';

-- Optional: Update existing articles to copy standard bullets to detailed
-- (You can skip this if you prefer to regenerate articles)
-- UPDATE published_articles 
-- SET summary_bullets_detailed = summary_bullets 
-- WHERE summary_bullets_detailed IS NULL;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the column was added:

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'published_articles' 
  AND column_name IN ('summary_bullets', 'summary_bullets_detailed');

-- ============================================
-- FIELD MAPPING REFERENCE
-- ============================================
-- OLD SYSTEM:
--   summary_bullets     -> Standard bullets (news language)
--   summary_bullets_b2  -> B2 simplified bullets
--
-- NEW SYSTEM:
--   summary_bullets          -> Standard bullets (60-80 chars)
--   summary_bullets_detailed -> Detailed bullets (90-120 chars)
--
-- The language toggle now switches between:
--   Standard view: summary_bullets
--   Detailed view: summary_bullets_detailed
-- ============================================


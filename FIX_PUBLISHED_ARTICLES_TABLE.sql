-- ==========================================
-- FIX: Add Missing Columns to published_articles
-- ==========================================
-- These columns are required by the Step 7 publishing code
-- but were not in the original schema

-- 1. Add url column (primary source URL)
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS url TEXT;

-- 2. Add source column (primary source name)
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS source TEXT;

-- 3. Add num_sources column (count of sources synthesized)
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS num_sources INTEGER DEFAULT 1;

-- 4. Rename 'components' to 'components_order' (the code uses this name)
-- First check if components_order exists
DO $$ 
BEGIN
    -- Add components_order if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='published_articles' AND column_name='components_order'
    ) THEN
        ALTER TABLE published_articles ADD COLUMN components_order TEXT[];
    END IF;
END $$;

-- 5. Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_published_articles_url ON published_articles(url);
CREATE INDEX IF NOT EXISTS idx_published_articles_source ON published_articles(source);
CREATE INDEX IF NOT EXISTS idx_published_articles_num_sources ON published_articles(num_sources);

-- ==========================================
-- VERIFY: Check all required columns exist
-- ==========================================

SELECT 
    column_name, 
    data_type,
    CASE 
        WHEN column_name IN ('url', 'source', 'num_sources', 'components_order') 
        THEN '✅ ADDED' 
        ELSE 'ℹ️  Original'
    END as status
FROM information_schema.columns 
WHERE table_name = 'published_articles'
ORDER BY ordinal_position;

-- ==========================================
-- EXPECTED COLUMNS (for reference)
-- ==========================================
-- ✅ id (BIGSERIAL PRIMARY KEY)
-- ✅ cluster_id (BIGINT UNIQUE NOT NULL)
-- ✅ url (TEXT) ← ADDED
-- ✅ source (TEXT) ← ADDED
-- ✅ category (VARCHAR)
-- ✅ title_news (TEXT)
-- ✅ title_b2 (TEXT)
-- ✅ content_news (TEXT)
-- ✅ content_b2 (TEXT)
-- ✅ summary_bullets_news (JSONB)
-- ✅ summary_bullets_b2 (JSONB)
-- ✅ timeline (JSONB)
-- ✅ details (JSONB)
-- ✅ graph (JSONB)
-- ✅ components (TEXT[]) - Original column
-- ✅ components_order (TEXT[]) ← ADDED (what code uses)
-- ✅ num_sources (INTEGER) ← ADDED
-- ✅ emoji (TEXT)
-- ✅ version_number (INTEGER)
-- ✅ view_count (INTEGER)
-- ✅ created_at (TIMESTAMP)
-- ✅ last_updated_at (TIMESTAMP)
-- ✅ published_at (TIMESTAMP)


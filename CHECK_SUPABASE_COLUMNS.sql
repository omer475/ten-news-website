-- ==========================================
-- CHECK WHAT COLUMNS EXIST IN ARTICLES TABLE
-- Run this in Supabase SQL Editor first
-- ==========================================

-- 1. Show all columns in articles table
SELECT 
    column_name, 
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- 2. Check if article and summary_bullets exist
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'articles' AND column_name = 'article'
        ) THEN '✅ article column EXISTS'
        ELSE '❌ article column MISSING - need to add it'
    END AS article_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'articles' AND column_name = 'summary_bullets'
        ) THEN '✅ summary_bullets column EXISTS'
        ELSE '❌ summary_bullets column MISSING - need to add it'
    END AS summary_bullets_status;

-- 3. Sample data from latest articles (to see what's actually saved)
SELECT 
    id,
    title,
    CASE 
        WHEN article IS NOT NULL THEN '✅ Has article'
        ELSE '❌ No article'
    END AS article_status,
    CASE 
        WHEN summary_bullets IS NOT NULL THEN '✅ Has bullets'
        ELSE '❌ No bullets'
    END AS bullets_status,
    LENGTH(article) AS article_length,
    jsonb_array_length(summary_bullets) AS bullet_count,
    published_at
FROM articles
WHERE published = true
ORDER BY published_at DESC
LIMIT 10;


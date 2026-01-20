-- ==========================================
-- CHECK IF COLUMNS WERE ADDED
-- Run each query separately to diagnose
-- ==========================================

-- 1. Check clusters table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'clusters'
ORDER BY ordinal_position;

-- 2. Check source_articles table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'source_articles'
ORDER BY ordinal_position;

-- 3. Check if source_reliability table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'source_reliability'
);

-- 4. Check for any errors in the migration
-- If you see the new columns below, the migration worked:
SELECT 
    publish_status,
    failure_reason,
    attempt_count
FROM clusters
LIMIT 1;


-- Test if the schema was created successfully
-- Run this after running supabase-rss-schema-safe.sql

-- Check if table exists
SELECT 
  'articles table exists' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'articles';

-- Check if indexes exist
SELECT 
  'indexes' as type,
  indexname as name
FROM pg_indexes
WHERE tablename = 'articles';

-- Check if RLS is enabled
SELECT 
  'RLS enabled' as status,
  relrowsecurity as enabled
FROM pg_class
WHERE relname = 'articles';

-- Check if policies exist
SELECT 
  'policies' as type,
  policyname as name
FROM pg_policies
WHERE tablename = 'articles';

-- Check if view exists
SELECT 
  'latest_articles view' as status,
  COUNT(*) as exists
FROM information_schema.views
WHERE table_name = 'latest_articles';

-- Check if functions exist
SELECT 
  'functions' as type,
  routine_name as name
FROM information_schema.routines
WHERE routine_name IN ('get_top_articles', 'increment_article_views', 'update_updated_at_column');

-- If all queries return results, schema is working! ✅


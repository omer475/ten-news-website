-- TEN NEWS - RSS SYSTEM - SUPABASE DATABASE SCHEMA (SAFE VERSION)
-- This version handles existing objects gracefully
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Drop old views and functions safely
DROP VIEW IF EXISTS latest_articles CASCADE;
DROP VIEW IF EXISTS breaking_news CASCADE;
DROP VIEW IF EXISTS global_news CASCADE;
DROP FUNCTION IF EXISTS get_top_articles(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS increment_article_views(UUID) CASCADE;

-- Step 2: Drop old triggers and functions
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Step 3: Drop old policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert articles" ON articles;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Service role can manage articles" ON articles;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Step 4: Drop old table
DROP TABLE IF EXISTS articles CASCADE;

-- Step 5: Create new unified articles table
CREATE TABLE articles (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core article data (from RSS)
  url TEXT UNIQUE NOT NULL,
  guid TEXT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  image_url TEXT,
  author TEXT,
  published_date TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- AI Processing
  ai_processed BOOLEAN DEFAULT FALSE,
  ai_score_raw REAL,
  ai_category TEXT,
  ai_reasoning TEXT,
  ai_final_score REAL,
  
  -- Publishing status
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  category TEXT,
  emoji TEXT,
  
  -- Enhanced content
  timeline TEXT,
  details_section TEXT,
  summary TEXT,
  timeline_generated BOOLEAN DEFAULT FALSE,
  details_generated BOOLEAN DEFAULT FALSE,
  
  -- Engagement
  view_count INTEGER DEFAULT 0,
  image_extraction_method TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create indexes
CREATE INDEX idx_articles_published ON articles(published, published_at DESC);
CREATE INDEX idx_articles_score ON articles(ai_final_score DESC) WHERE published = TRUE;
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_source ON articles(source);

-- Step 7: Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Step 8: Create policies
CREATE POLICY "Public articles are viewable by everyone"
  ON articles FOR SELECT
  USING (published = TRUE);

CREATE POLICY "Service role can manage articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 9: Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger
CREATE TRIGGER update_articles_updated_at 
  BEFORE UPDATE ON articles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 11: Create view for latest articles
CREATE OR REPLACE VIEW latest_articles AS
SELECT 
  id, title, summary, url, image_url, source, category, emoji,
  ai_final_score, details_section, timeline, published_at, view_count
FROM articles
WHERE published = TRUE
  AND published_at > NOW() - INTERVAL '7 days'
ORDER BY ai_final_score DESC, published_at DESC;

-- Step 12: Grant view access
GRANT SELECT ON latest_articles TO anon, authenticated;

-- Step 13: Create function to get top articles
CREATE OR REPLACE FUNCTION get_top_articles(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  url TEXT,
  image_url TEXT,
  source TEXT,
  category TEXT,
  emoji TEXT,
  ai_final_score REAL,
  details_section TEXT,
  timeline TEXT,
  published_at TIMESTAMPTZ,
  view_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id, a.title, a.summary, a.url, a.image_url, a.source, 
    a.category, a.emoji, a.ai_final_score, a.details_section, 
    a.timeline, a.published_at, a.view_count
  FROM articles a
  WHERE a.published = TRUE
  ORDER BY a.ai_final_score DESC, a.published_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Grant function access
GRANT EXECUTE ON FUNCTION get_top_articles(INTEGER) TO anon, authenticated;

-- Step 15: Create function to increment views
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE articles
  SET view_count = view_count + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Step 16: Grant function access
GRANT EXECUTE ON FUNCTION increment_article_views(UUID) TO anon, authenticated;

-- SUCCESS MESSAGE
DO $$ 
BEGIN
  RAISE NOTICE '✅ Schema created successfully!';
  RAISE NOTICE '📊 Table: articles';
  RAISE NOTICE '🔍 View: latest_articles';
  RAISE NOTICE '⚙️  Functions: get_top_articles(), increment_article_views()';
  RAISE NOTICE '🔒 RLS: Enabled with public read access';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Ready to receive articles from RSS system!';
END $$;


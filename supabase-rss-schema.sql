-- TEN NEWS - RSS SYSTEM - SUPABASE DATABASE SCHEMA
-- Updated for unified RSS news system (no breaking/global split)
-- Run this SQL in your Supabase SQL Editor

-- Drop old tables/views if they exist from previous system
DROP VIEW IF EXISTS latest_articles CASCADE;
DROP VIEW IF EXISTS breaking_news CASCADE;
DROP VIEW IF EXISTS global_news CASCADE;
DROP FUNCTION IF EXISTS get_top_articles CASCADE;
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;
DROP POLICY IF EXISTS "Authenticated users can insert articles" ON articles;
DROP TABLE IF EXISTS articles CASCADE;

-- Create unified articles table (matches RSS system structure)
CREATE TABLE articles (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core article data (from RSS)
  url TEXT UNIQUE NOT NULL,
  guid TEXT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,  -- Full article text
  image_url TEXT,
  author TEXT,
  published_date TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- AI Processing (Gemini scoring)
  ai_processed BOOLEAN DEFAULT FALSE,
  ai_score_raw REAL,  -- 0-100 raw score from Gemini
  ai_category TEXT,   -- technology, science, politics, etc.
  ai_reasoning TEXT,  -- Why this score was given
  ai_final_score REAL, -- Final score (with source credibility)
  
  -- Publishing status
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  category TEXT,
  emoji TEXT,
  
  -- Enhanced content (Claude-generated)
  timeline TEXT,  -- JSON string: array of {date, event} objects
  details_section TEXT,  -- 3 key details/facts
  summary TEXT,  -- 35-40 word AI summary
  timeline_generated BOOLEAN DEFAULT FALSE,
  details_generated BOOLEAN DEFAULT FALSE,
  
  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  
  -- Image metadata
  image_extraction_method TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX idx_articles_published ON articles(published, published_at DESC);
CREATE INDEX idx_articles_score ON articles(ai_final_score DESC) WHERE published = TRUE;
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_source ON articles(source);

-- Enable Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read published articles)
CREATE POLICY "Public articles are viewable by everyone"
  ON articles FOR SELECT
  USING (published = TRUE);

-- Service role can insert/update (for RSS system)
CREATE POLICY "Service role can manage articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_articles_updated_at 
  BEFORE UPDATE ON articles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for latest published articles
CREATE OR REPLACE VIEW latest_articles AS
SELECT 
  id, title, summary, url, image_url, source, category, emoji,
  ai_final_score, details_section, timeline, published_at, view_count
FROM articles
WHERE published = TRUE
  AND published_at > NOW() - INTERVAL '7 days'
ORDER BY ai_final_score DESC, published_at DESC;

-- Grant access to view
GRANT SELECT ON latest_articles TO anon;

-- Create function to get top articles
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

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_top_articles TO anon;

-- Create function to increment view count
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE articles
  SET view_count = view_count + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_article_views TO anon;

-- SUCCESS!
-- Schema is ready for RSS system
-- Next: Use push_to_supabase.py to sync articles


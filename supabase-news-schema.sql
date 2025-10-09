-- TEN NEWS - SUPABASE DATABASE SCHEMA
-- Run this SQL in your Supabase SQL Editor

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core article data
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  
  -- Metadata
  source TEXT NOT NULL,
  source_part INTEGER CHECK (source_part IN (1, 2)), -- 1 = Breaking, 2 = Global
  category TEXT NOT NULL,
  emoji TEXT,
  
  -- Scores and rankings
  final_score DECIMAL(5,2) NOT NULL,
  global_impact DECIMAL(5,2),
  scientific_significance DECIMAL(5,2),
  novelty DECIMAL(5,2),
  credibility DECIMAL(5,2),
  engagement DECIMAL(5,2),
  
  -- Enhanced content
  details JSONB, -- Array of 3 detail strings
  timeline JSONB, -- Array of {date, event} objects
  citations JSONB, -- Array of {url, publisher} objects
  
  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast queries
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_final_score ON articles(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source_part ON articles(source_part);
CREATE INDEX IF NOT EXISTS idx_articles_added_at ON articles(added_at DESC);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING GIN (to_tsvector('english', title || ' ' || summary));

-- Enable Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read articles)
CREATE POLICY "Public articles are viewable by everyone"
  ON articles FOR SELECT
  USING (true);

-- Only authenticated users can insert (for admin/system)
CREATE POLICY "Authenticated users can insert articles"
  ON articles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_articles_updated_at 
  BEFORE UPDATE ON articles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for latest articles (sorted by score)
CREATE OR REPLACE VIEW latest_articles AS
SELECT 
  id, title, summary, url, image_url, source, category, emoji,
  final_score, details, timeline, citations, published_at, added_at
FROM articles
WHERE published_at > NOW() - INTERVAL '7 days'
ORDER BY final_score DESC;

-- Create view for breaking news (Part 1)
CREATE OR REPLACE VIEW breaking_news AS
SELECT 
  id, title, summary, url, image_url, source, category, emoji,
  final_score, details, timeline, citations, published_at, added_at
FROM articles
WHERE source_part = 1 AND published_at > NOW() - INTERVAL '24 hours'
ORDER BY final_score DESC;

-- Create view for global news (Part 2)
CREATE OR REPLACE VIEW global_news AS
SELECT 
  id, title, summary, url, image_url, source, category, emoji,
  final_score, details, timeline, citations, published_at, added_at
FROM articles
WHERE source_part = 2 AND published_at > NOW() - INTERVAL '7 days'
ORDER BY final_score DESC;

-- Grant access to views
GRANT SELECT ON latest_articles TO anon;
GRANT SELECT ON breaking_news TO anon;
GRANT SELECT ON global_news TO anon;

-- Create function to get top articles by score
CREATE OR REPLACE FUNCTION get_top_articles(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  url TEXT,
  image_url TEXT,
  source TEXT,
  category TEXT,
  emoji TEXT,
  final_score DECIMAL,
  details JSONB,
  timeline JSONB,
  citations JSONB,
  published_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id, a.title, a.summary, a.url, a.image_url, a.source, a.category, a.emoji,
    a.final_score, a.details, a.timeline, a.citations, a.published_at, a.added_at
  FROM articles a
  WHERE a.published_at > NOW() - INTERVAL '7 days'
  ORDER BY a.final_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_top_articles TO anon;

-- SUCCESS!
-- Now you can insert articles and query them easily


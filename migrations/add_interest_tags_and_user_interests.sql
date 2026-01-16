-- Ten News: Personalization tables
-- Adds interest_tags to articles and creates user_interests table

-- 1. Add interest_tags column to published_articles
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS interest_tags JSONB DEFAULT '[]';

-- 2. Create user_interests table for storing user preferences
CREATE TABLE IF NOT EXISTS user_interests (
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  engagement_count INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, keyword)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id 
ON user_interests(user_id);

-- Index for finding top interests per user
CREATE INDEX IF NOT EXISTS idx_user_interests_user_weight 
ON user_interests(user_id, weight DESC);

-- 3. Create a function to decay old interests (optional, run periodically)
-- Reduces weight of interests not updated in 30+ days
CREATE OR REPLACE FUNCTION decay_old_interests()
RETURNS void AS $$
BEGIN
  UPDATE user_interests
  SET weight = weight * 0.9
  WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the tables
COMMENT ON COLUMN published_articles.interest_tags IS 'Array of 4-8 keywords for personalization matching';
COMMENT ON TABLE user_interests IS 'Stores user keyword preferences with weights for feed personalization';

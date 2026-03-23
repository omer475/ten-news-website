-- =====================================================
-- DATABASE MIGRATION: TodayPlus Personalization System
-- =====================================================
-- Run this in Supabase SQL Editor

-- 1. Add countries and topics columns to published_articles
ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

-- Create GIN indexes for fast array queries
CREATE INDEX IF NOT EXISTS idx_published_articles_countries ON published_articles USING GIN(countries);
CREATE INDEX IF NOT EXISTS idx_published_articles_topics ON published_articles USING GIN(topics);

-- 2. Create users table for personalization
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  home_country TEXT NOT NULL,
  followed_countries TEXT[] DEFAULT '{}',
  followed_topics TEXT[] NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Validation constraints
  CONSTRAINT valid_home_country CHECK (home_country = ANY(ARRAY[
    'usa', 'uk', 'china', 'russia', 'germany', 'france',
    'ukraine', 'turkiye', 'ireland', 'india', 'japan', 'south_korea',
    'pakistan', 'singapore', 'israel', 'canada', 'brazil',
    'nigeria', 'south_africa', 'australia'
  ])),
  CONSTRAINT min_topics CHECK (array_length(followed_topics, 1) >= 3),
  CONSTRAINT max_topics CHECK (array_length(followed_topics, 1) <= 10),
  CONSTRAINT max_followed_countries CHECK (
    followed_countries IS NULL OR 
    array_length(followed_countries, 1) IS NULL OR 
    array_length(followed_countries, 1) <= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_users_home_country ON users(home_country);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. Create reading_history table (for future implicit personalization)
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  article_id BIGINT REFERENCES published_articles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_spent_seconds INTEGER,
  
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_history_user ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_article ON reading_history(article_id);

-- 4. Enable Row Level Security (RLS) for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own data
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Allow insert for authenticated users
DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Enable RLS for reading_history
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own history" ON reading_history;
CREATE POLICY "Users can read own history" ON reading_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON reading_history;
CREATE POLICY "Users can insert own history" ON reading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Add trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Service role policy for backend pipeline (to write countries/topics)
-- The backend uses service_key so it bypasses RLS, but let's also add an explicit policy
DROP POLICY IF EXISTS "Service role can manage articles" ON published_articles;
CREATE POLICY "Service role can manage articles" ON published_articles
  FOR ALL USING (true);

-- Done!
-- After running this, you can verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'published_articles' AND column_name IN ('countries', 'topics');
-- SELECT * FROM information_schema.tables WHERE table_name IN ('users', 'reading_history');

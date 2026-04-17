-- Migration 040: Publisher accounts and user follows
-- Creates publisher bot accounts system and follow relationships

-- 1. Publishers table (links to profiles via same UUID)
CREATE TABLE IF NOT EXISTS publishers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL,
  interest_tags JSONB DEFAULT '[]'::jsonb,
  is_verified BOOLEAN DEFAULT TRUE,
  is_bot BOOLEAN DEFAULT TRUE,
  follower_count INT DEFAULT 0,
  article_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishers_category ON publishers(category);
CREATE INDEX IF NOT EXISTS idx_publishers_username ON publishers(username);
CREATE INDEX IF NOT EXISTS idx_publishers_interest_tags ON publishers USING GIN(interest_tags);

-- 2. User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_user ON user_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_publisher ON user_follows(publisher_id);

-- 3. Auto-update follower_count on follow/unfollow
CREATE OR REPLACE FUNCTION update_publisher_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE publishers SET follower_count = follower_count + 1 WHERE id = NEW.publisher_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE publishers SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.publisher_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_follows_count ON user_follows;
CREATE TRIGGER trg_user_follows_count
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_publisher_follower_count();

-- 4. RLS policies
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Publishers are publicly readable
CREATE POLICY "Publishers are public" ON publishers FOR SELECT USING (true);

-- User follows: users can read their own follows
CREATE POLICY "Users can read own follows" ON user_follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can follow" ON user_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow" ON user_follows FOR DELETE USING (auth.uid() = user_id);

-- Service role bypasses RLS for API/pipeline operations

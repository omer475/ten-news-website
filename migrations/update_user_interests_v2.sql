-- Enhanced user_interests table with computed major interests
-- One row per user with all keywords + computed summary columns

-- Drop the old table
DROP TABLE IF EXISTS user_interests;

-- Create enhanced single-row-per-user table
CREATE TABLE user_interests (
  user_id UUID PRIMARY KEY NOT NULL,
  
  -- All keywords with weights (raw data)
  interests JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Computed major interests (weight >= threshold)
  major_keywords TEXT[] DEFAULT '{}',      -- Keywords with weight >= 2.0
  major_countries TEXT[] DEFAULT '{}',     -- Countries with weight >= 1.5  
  major_topics TEXT[] DEFAULT '{}',        -- Topics with weight >= 1.5
  
  -- Summary stats
  primary_category TEXT DEFAULT NULL,      -- Highest weighted category (TECH, POLITICS, etc.)
  interest_count INT DEFAULT 0,            -- Total number of keywords tracked
  engagement_score FLOAT DEFAULT 0,        -- Sum of all weights (overall engagement)
  articles_read_count INT DEFAULT 0,       -- Total articles read (10+ seconds)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_interests_updated ON user_interests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interests_category ON user_interests(primary_category);

-- Example data after user reads 500+ articles:
-- 
-- user_id: 5082a1df-24e4-4a39-a0c0-639c4de70627
-- interests: {"donald trump": 45.2, "china": 38.5, "ai": 32.0, "tech": 28.0, ...}
-- major_keywords: ["donald trump", "china", "ai", "tech", "politics", "finance"]
-- major_countries: ["china", "usa", "germany", "japan", "uk"]
-- major_topics: ["politics", "tech", "finance", "world"]
-- primary_category: "POLITICS"
-- interest_count: 156
-- engagement_score: 892.5
-- updated_at: 2026-01-18 16:47:34+00

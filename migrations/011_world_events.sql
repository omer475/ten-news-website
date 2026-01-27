-- World Events System
-- Tracks major ongoing global events for the "World Events" feature

-- Main events table
CREATE TABLE IF NOT EXISTS world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Display info
  name VARCHAR(100) NOT NULL,                    -- "Russia-Ukraine War"
  slug VARCHAR(100) UNIQUE NOT NULL,             -- "russia-ukraine-war"
  topic_prompt TEXT NOT NULL,                    -- Full prompt for image generation
  
  -- Generated content
  image_url TEXT,                                -- Gemini-generated image URL
  blur_color VARCHAR(7) DEFAULT '#1a365d',       -- Extracted from image
  background TEXT,                               -- AI-generated background paragraph
  
  -- Key facts (JSON array)
  key_facts JSONB DEFAULT '[]',                  -- [{ "label": "Started", "value": "Feb 2022" }]
  
  -- Status
  status VARCHAR(20) DEFAULT 'ongoing',          -- 'ongoing' | 'resolved'
  importance INTEGER DEFAULT 5,                   -- 1-10 scale for sorting
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  last_article_at TIMESTAMP WITH TIME ZONE,      -- When last article was tagged
  
  -- Metadata
  created_by_article_id UUID                     -- First article that created this event
);

-- Timeline entries for each event
CREATE TABLE IF NOT EXISTS world_event_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  
  -- Timeline entry content
  date DATE NOT NULL,
  time TIME,
  headline VARCHAR(200) NOT NULL,
  summary TEXT,
  significance VARCHAR(10) DEFAULT 'medium',     -- 'high' | 'medium' | 'low'
  
  -- Source article
  source_article_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Latest development for each event (one row per event, updated)
CREATE TABLE IF NOT EXISTS world_event_latest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  
  -- Content
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,                         -- AI-written paragraph
  image_url TEXT,
  
  -- Components from article (JSON)
  components JSONB DEFAULT '{}',                 -- { graph: {...}, map: {...}, info_boxes: [...] }
  
  -- Source
  source_article_id UUID,
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link articles to events (many-to-many)
CREATE TABLE IF NOT EXISTS article_world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  
  -- When tagged
  tagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(article_id, event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_world_events_status ON world_events(status);
CREATE INDEX IF NOT EXISTS idx_world_events_importance ON world_events(importance DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_last_article ON world_events(last_article_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_event_timeline_event ON world_event_timeline(event_id);
CREATE INDEX IF NOT EXISTS idx_world_event_timeline_date ON world_event_timeline(date DESC);
CREATE INDEX IF NOT EXISTS idx_article_world_events_article ON article_world_events(article_id);
CREATE INDEX IF NOT EXISTS idx_article_world_events_event ON article_world_events(event_id);

-- Function to update event's last_article_at when article is tagged
CREATE OR REPLACE FUNCTION update_event_last_article()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE world_events 
  SET last_article_at = NOW(), updated_at = NOW()
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_article_at
DROP TRIGGER IF EXISTS trigger_update_event_last_article ON article_world_events;
CREATE TRIGGER trigger_update_event_last_article
  AFTER INSERT ON article_world_events
  FOR EACH ROW
  EXECUTE FUNCTION update_event_last_article();

-- View for event update counts (articles since a given timestamp)
CREATE OR REPLACE FUNCTION get_event_update_count(p_event_id UUID, p_since TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM article_world_events 
    WHERE event_id = p_event_id AND tagged_at > p_since
  );
END;
$$ LANGUAGE plpgsql;

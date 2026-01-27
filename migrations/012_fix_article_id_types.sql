-- Fix article_id column types to accept integer IDs (not just UUIDs)
-- This is needed because published_articles uses SERIAL (integer) IDs

-- Drop the old column and recreate as TEXT
ALTER TABLE article_world_events DROP COLUMN IF EXISTS article_id;
ALTER TABLE article_world_events ADD COLUMN article_id TEXT NOT NULL;

-- Drop source_article_id columns (we're not using them anyway)
ALTER TABLE world_event_timeline DROP COLUMN IF EXISTS source_article_id;
ALTER TABLE world_event_latest DROP COLUMN IF EXISTS source_article_id;
ALTER TABLE world_events DROP COLUMN IF EXISTS created_by_article_id;

-- Recreate unique constraint
ALTER TABLE article_world_events DROP CONSTRAINT IF EXISTS article_world_events_article_id_event_id_key;
ALTER TABLE article_world_events ADD CONSTRAINT article_world_events_article_id_event_id_key UNIQUE(article_id, event_id);

-- Recreate index
DROP INDEX IF EXISTS idx_article_world_events_article;
CREATE INDEX idx_article_world_events_article ON article_world_events(article_id);

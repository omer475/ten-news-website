-- Migration 039: Adaptive budget tracking + story clusters for dedup
-- Supports 3 fixes: adaptive trending/exploration, story dedup, weighted subtopic allocation

-- ============================================================
-- 1. BUCKET ENGAGEMENT TRACKING on personalization_profiles
-- Tracks per-user engagement rates for trending/exploration
-- ============================================================
ALTER TABLE personalization_profiles
  ADD COLUMN IF NOT EXISTS trending_shown INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_engaged INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exploration_shown INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exploration_engaged INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtopic_order TEXT[] DEFAULT '{}';

-- ============================================================
-- 2. PER-SUBTOPIC ENGAGEMENT STATS
-- Tracks shown/engaged per subtopic for weighted allocation
-- ============================================================
CREATE TABLE IF NOT EXISTS user_subtopic_stats (
  id BIGSERIAL PRIMARY KEY,
  personalization_id UUID NOT NULL,
  subtopic_name TEXT NOT NULL,
  times_shown INT DEFAULT 0,
  times_engaged INT DEFAULT 0,
  times_liked INT DEFAULT 0,
  times_saved INT DEFAULT 0,
  last_shown_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(personalization_id, subtopic_name)
);

CREATE INDEX IF NOT EXISTS idx_user_subtopic_stats_pers
  ON user_subtopic_stats(personalization_id);

-- ============================================================
-- 3. STORY CLUSTERS for deduplication
-- Groups similar articles about the same event/story
-- ============================================================
CREATE TABLE IF NOT EXISTS story_clusters (
  id BIGSERIAL PRIMARY KEY,
  representative_article_id BIGINT,
  centroid_embedding vector(384),
  entity_names TEXT[] DEFAULT '{}',
  article_count INT DEFAULT 1,
  category TEXT,
  first_published_at TIMESTAMPTZ DEFAULT NOW(),
  latest_published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_clusters_recent
  ON story_clusters(latest_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_clusters_representative
  ON story_clusters(representative_article_id);

-- Add story_cluster_id to published_articles
ALTER TABLE published_articles
  ADD COLUMN IF NOT EXISTS story_cluster_id BIGINT REFERENCES story_clusters(id);

CREATE INDEX IF NOT EXISTS idx_articles_story_cluster
  ON published_articles(story_cluster_id) WHERE story_cluster_id IS NOT NULL;

-- ============================================================
-- 4. RPC: Update bucket engagement stats (called from track.js)
-- ============================================================
CREATE OR REPLACE FUNCTION update_bucket_stats(
  p_pers_id UUID,
  p_bucket TEXT,
  p_engaged BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  IF p_bucket = 'trending' THEN
    UPDATE personalization_profiles
    SET trending_shown = trending_shown + 1,
        trending_engaged = trending_engaged + (CASE WHEN p_engaged THEN 1 ELSE 0 END)
    WHERE personalization_id = p_pers_id;
  ELSIF p_bucket IN ('exploration', 'discovery', 'cold-start') THEN
    UPDATE personalization_profiles
    SET exploration_shown = exploration_shown + 1,
        exploration_engaged = exploration_engaged + (CASE WHEN p_engaged THEN 1 ELSE 0 END)
    WHERE personalization_id = p_pers_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. RPC: Update subtopic engagement stats (called from track.js)
-- ============================================================
CREATE OR REPLACE FUNCTION update_subtopic_stats(
  p_pers_id UUID,
  p_subtopic TEXT,
  p_event_type TEXT
)
RETURNS VOID AS $$
DECLARE
  is_engaged BOOLEAN;
BEGIN
  is_engaged := p_event_type NOT IN ('article_skipped', 'article_glance');

  INSERT INTO user_subtopic_stats (personalization_id, subtopic_name, times_shown, times_engaged, last_shown_at)
  VALUES (p_pers_id, p_subtopic, 1, CASE WHEN is_engaged THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (personalization_id, subtopic_name)
  DO UPDATE SET
    times_shown = user_subtopic_stats.times_shown + 1,
    times_engaged = user_subtopic_stats.times_engaged + (CASE WHEN is_engaged THEN 1 ELSE 0 END),
    times_liked = user_subtopic_stats.times_liked + (CASE WHEN p_event_type IN ('article_liked', 'article_saved', 'article_shared') THEN 1 ELSE 0 END),
    times_saved = user_subtopic_stats.times_saved + (CASE WHEN p_event_type = 'article_saved' THEN 1 ELSE 0 END),
    last_shown_at = NOW();
END;
$$ LANGUAGE plpgsql;

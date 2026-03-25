-- ============================================================
-- MIGRATION 031: Precomputed Entity Clusters + UCB Tracking
-- ============================================================

-- Precomputed entity clusters per subtopic category
-- Computed nightly, used at feed time for diverse cold start
CREATE TABLE IF NOT EXISTS subtopic_entity_clusters (
  id BIGSERIAL PRIMARY KEY,
  subtopic_category TEXT NOT NULL,
  cluster_index INT NOT NULL,
  centroid_embedding JSONB NOT NULL,
  entity_names TEXT[] DEFAULT '{}',
  cluster_size INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subtopic_category, cluster_index)
);

CREATE INDEX IF NOT EXISTS idx_sec_category ON subtopic_entity_clusters(subtopic_category);

-- Per-user engagement stats per cluster (for UCB scoring)
CREATE TABLE IF NOT EXISTS user_cluster_stats (
  id BIGSERIAL PRIMARY KEY,
  personalization_id UUID NOT NULL REFERENCES personalization_profiles(personalization_id) ON DELETE CASCADE,
  subtopic_category TEXT NOT NULL,
  cluster_index INT NOT NULL,
  times_shown INT DEFAULT 0,
  times_engaged INT DEFAULT 0,
  ucb_score FLOAT DEFAULT 999999,
  last_shown_at TIMESTAMPTZ,
  UNIQUE(personalization_id, subtopic_category, cluster_index)
);

CREATE INDEX IF NOT EXISTS idx_ucs_pers ON user_cluster_stats(personalization_id);

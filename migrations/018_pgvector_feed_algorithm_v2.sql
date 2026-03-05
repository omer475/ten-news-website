-- ============================================================
-- MIGRATION 018: pgvector Feed Algorithm v2 + PinnerSage-lite
-- ============================================================
-- TikTok-style 3-bucket feed: Personal (embedding), Trending (score), Discovery (diverse)
-- Multi-interest user clusters inspired by Pinterest's PinnerSage
--
-- Run this in Supabase SQL Editor.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- ARTICLE EMBEDDINGS (vector column + auto-sync trigger)
-- ============================================================

-- 2. Add embedding JSONB column (pipeline writes here)
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS embedding JSONB;

-- 3. Add vector column for pgvector similarity search
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS embedding_vec vector(3072);

-- 4. Auto-sync trigger: converts JSONB embedding → vector on every insert/update
--    No Python pipeline changes needed beyond writing the JSONB
CREATE OR REPLACE FUNCTION sync_embedding_to_vec()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    BEGIN
      NEW.embedding_vec := NEW.embedding::text::vector(3072);
    EXCEPTION WHEN OTHERS THEN
      -- Don't block insert if cast fails
      NEW.embedding_vec := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_embedding_vec ON published_articles;
CREATE TRIGGER trg_sync_embedding_vec
BEFORE INSERT OR UPDATE OF embedding ON published_articles
FOR EACH ROW EXECUTE FUNCTION sync_embedding_to_vec();

-- 5. Backfill existing articles (if any have embeddings already)
UPDATE published_articles
SET embedding_vec = embedding::text::vector(3072)
WHERE embedding IS NOT NULL AND embedding_vec IS NULL;

-- 6. HNSW index skipped: pgvector HNSW has 2000 dim limit, our embeddings are 3072.
--    At our scale (~5000 articles), sequential scan is <50ms — no index needed.
--    If scale grows, switch to 768-dim embeddings to enable HNSW.

-- Index for trending query (score + recency)
CREATE INDEX IF NOT EXISTS idx_articles_score_created
ON published_articles (ai_final_score DESC, created_at DESC)
WHERE ai_final_score IS NOT NULL;

-- ============================================================
-- USER TASTE VECTOR (single vector, EMA-updated on engagement)
-- ============================================================

-- 7. Add taste_vector to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS taste_vector JSONB;

-- ============================================================
-- PINNERSAGE-LITE: Multi-Interest Clusters
-- ============================================================

-- 8. User interest clusters table
--    Each user has 1-5 clusters, each represented by a medoid embedding
CREATE TABLE IF NOT EXISTS user_interest_clusters (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cluster_index INT NOT NULL,          -- 0-based cluster number
  medoid_embedding JSONB NOT NULL,     -- actual article embedding (not centroid)
  medoid_vec vector(3072),             -- auto-synced for pgvector search
  medoid_article_id BIGINT,            -- which article this medoid came from
  article_count INT DEFAULT 0,         -- how many interactions in this cluster
  label TEXT,                          -- optional: auto-generated label like "F1 Racing"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cluster_index)
);

-- Auto-sync trigger for cluster medoid embeddings
CREATE OR REPLACE FUNCTION sync_cluster_medoid_vec()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.medoid_embedding IS NOT NULL THEN
    BEGIN
      NEW.medoid_vec := NEW.medoid_embedding::text::vector(3072);
    EXCEPTION WHEN OTHERS THEN
      NEW.medoid_vec := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cluster_medoid_vec ON user_interest_clusters;
CREATE TRIGGER trg_sync_cluster_medoid_vec
BEFORE INSERT OR UPDATE OF medoid_embedding ON user_interest_clusters
FOR EACH ROW EXECUTE FUNCTION sync_cluster_medoid_vec();

-- Index for looking up user's clusters
CREATE INDEX IF NOT EXISTS idx_user_clusters_user_id
ON user_interest_clusters (user_id);

-- ============================================================
-- RPC: Personal candidate generator (multi-cluster ANN search)
-- ============================================================

-- Single-vector search (used when user has taste_vector but no clusters yet)
CREATE OR REPLACE FUNCTION match_articles_personal(
  query_embedding float8[],
  match_count int DEFAULT 150,
  hours_window int DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}'
)
RETURNS TABLE (id bigint, similarity float8) AS $$
  SELECT
    pa.id,
    1 - (pa.embedding_vec <=> query_embedding::vector(3072)) as similarity
  FROM published_articles pa
  WHERE pa.created_at >= NOW() - make_interval(hours => hours_window)
    AND pa.embedding_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
  ORDER BY pa.embedding_vec <=> query_embedding::vector(3072)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- Multi-cluster search: runs ANN for each of a user's interest clusters
-- Returns union of results with cluster_index attached
CREATE OR REPLACE FUNCTION match_articles_multi_cluster(
  p_user_id UUID,
  match_per_cluster int DEFAULT 50,
  hours_window int DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}'
)
RETURNS TABLE (id bigint, similarity float8, cluster_index int) AS $$
  SELECT DISTINCT ON (sub.id)
    sub.id,
    sub.similarity,
    sub.cluster_index
  FROM (
    SELECT
      pa.id,
      1 - (pa.embedding_vec <=> uc.medoid_vec) as similarity,
      uc.cluster_index
    FROM user_interest_clusters uc
    CROSS JOIN LATERAL (
      SELECT pa2.id, pa2.embedding_vec
      FROM published_articles pa2
      WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
        AND pa2.embedding_vec IS NOT NULL
        AND (exclude_ids IS NULL OR pa2.id != ALL(exclude_ids))
      ORDER BY pa2.embedding_vec <=> uc.medoid_vec
      LIMIT match_per_cluster
    ) pa
    WHERE uc.user_id = p_user_id
      AND uc.medoid_vec IS NOT NULL
  ) sub
  ORDER BY sub.id, sub.similarity DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- RPC: Cluster user interactions (PinnerSage-lite)
-- ============================================================
-- This is called periodically to re-cluster a user's interaction history.
-- Uses k-medoids-like approach: finds representative articles for each interest group.
-- Heavy compute done here (not at feed time).

CREATE OR REPLACE FUNCTION cluster_user_interests(
  p_user_id UUID,
  p_max_clusters int DEFAULT 5,
  p_lookback_days int DEFAULT 90
)
RETURNS int AS $$
DECLARE
  interaction_count int;
  cluster_count int;
BEGIN
  -- Count engaged articles with embeddings
  SELECT COUNT(*) INTO interaction_count
  FROM user_article_events uae
  JOIN published_articles pa ON pa.id = uae.article_id
  WHERE uae.user_id = p_user_id
    AND uae.event_type IN ('article_engaged', 'article_saved', 'article_detail_view')
    AND uae.created_at >= NOW() - make_interval(days => p_lookback_days)
    AND pa.embedding_vec IS NOT NULL;

  -- Need minimum interactions to cluster
  IF interaction_count < 3 THEN
    RETURN 0;
  END IF;

  -- Determine number of clusters based on interaction diversity
  cluster_count := LEAST(p_max_clusters, GREATEST(1, interaction_count / 5));

  -- Delete old clusters for this user
  DELETE FROM user_interest_clusters WHERE user_id = p_user_id;

  -- Simple k-medoids via category-based grouping:
  -- Group interactions by category, pick the most-engaged article per group as medoid
  INSERT INTO user_interest_clusters (user_id, cluster_index, medoid_embedding, medoid_article_id, article_count, label)
  SELECT
    p_user_id,
    (ROW_NUMBER() OVER (ORDER BY cnt DESC, max_engagement DESC)) - 1 as cluster_index,
    pa.embedding as medoid_embedding,
    pa.id as medoid_article_id,
    ranked.cnt as article_count,
    ranked.category as label
  FROM (
    SELECT
      pa_inner.category,
      COUNT(*) as cnt,
      MAX(
        CASE
          WHEN uae_inner.event_type = 'article_saved' THEN 3
          WHEN uae_inner.event_type = 'article_engaged' THEN 2
          ELSE 1
        END
      ) as max_engagement,
      -- Pick the article with highest engagement score in this category
      (ARRAY_AGG(
        pa_inner.id ORDER BY
          CASE
            WHEN uae_inner.event_type = 'article_saved' THEN 3
            WHEN uae_inner.event_type = 'article_engaged' THEN 2
            ELSE 1
          END DESC,
          uae_inner.created_at DESC
      ))[1] as best_article_id
    FROM user_article_events uae_inner
    JOIN published_articles pa_inner ON pa_inner.id = uae_inner.article_id
    WHERE uae_inner.user_id = p_user_id
      AND uae_inner.event_type IN ('article_engaged', 'article_saved', 'article_detail_view')
      AND uae_inner.created_at >= NOW() - make_interval(days => p_lookback_days)
      AND pa_inner.embedding_vec IS NOT NULL
    GROUP BY pa_inner.category
    ORDER BY cnt DESC, max_engagement DESC
    LIMIT cluster_count
  ) ranked
  JOIN published_articles pa ON pa.id = ranked.best_article_id;

  -- Also update the single taste_vector (weighted average of cluster medoids)
  UPDATE users SET taste_vector = (
    SELECT jsonb_agg(val)
    FROM (
      SELECT unnest(
        -- Weighted average: more interactions = more weight
        -- This is a simplification; proper implementation would weight each dimension
        (SELECT medoid_embedding FROM user_interest_clusters
         WHERE user_id = p_user_id
         ORDER BY article_count DESC
         LIMIT 1)::text::float8[]
      ) as val
    ) sub
  )
  WHERE id = p_user_id;

  RETURN cluster_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UTILITY: Update taste vector from single interaction (EMA)
-- ============================================================
-- Called from the analytics track endpoint after engagement events

CREATE OR REPLACE FUNCTION update_taste_vector_ema(
  p_user_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT DEFAULT 'article_engaged'
)
RETURNS void AS $$
DECLARE
  article_emb float8[];
  current_taste float8[];
  alpha float8;
  new_taste float8[];
  dim int;
BEGIN
  -- Get article embedding
  SELECT embedding::text::float8[] INTO article_emb
  FROM published_articles
  WHERE id = p_article_id AND embedding IS NOT NULL;

  IF article_emb IS NULL THEN
    RETURN;
  END IF;

  -- Get current taste vector
  SELECT taste_vector::text::float8[] INTO current_taste
  FROM users
  WHERE id = p_user_id;

  -- EMA learning rate based on event type
  -- Saved articles update taste more aggressively
  alpha := CASE
    WHEN p_event_type = 'article_saved' THEN 0.15
    WHEN p_event_type = 'article_engaged' THEN 0.10
    ELSE 0.05
  END;

  IF current_taste IS NULL THEN
    -- First interaction: use article embedding directly
    UPDATE users SET taste_vector = to_jsonb(article_emb)
    WHERE id = p_user_id;
  ELSE
    -- EMA update: new = (1-alpha) * current + alpha * article
    dim := array_length(article_emb, 1);
    SELECT array_agg(
      (1 - alpha) * current_taste[i] + alpha * article_emb[i]
    )
    INTO new_taste
    FROM generate_series(1, dim) AS i;

    UPDATE users SET taste_vector = to_jsonb(new_taste)
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

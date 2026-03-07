-- ============================================================
-- MIGRATION 020: MiniLM Embeddings + Skip Tracking
-- ============================================================
-- 1. Add MiniLM 384-dim embedding column with HNSW index (fast!)
-- 2. Add MiniLM taste vector to users
-- 3. RPC functions for MiniLM-based similarity search
-- 4. Skip tracking: feed impressions table + skip profile
-- 5. EMA update function for MiniLM taste vector
--
-- Run this in Supabase SQL Editor.

-- ============================================================
-- 1. MiniLM ARTICLE EMBEDDINGS (384-dim — fits HNSW index!)
-- ============================================================

-- JSONB column (pipeline writes here)
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS embedding_minilm JSONB;

-- pgvector column for similarity search
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS embedding_minilm_vec vector(384);

-- Auto-sync trigger: JSONB → vector on insert/update
CREATE OR REPLACE FUNCTION sync_embedding_minilm_to_vec()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.embedding_minilm IS NOT NULL THEN
    BEGIN
      NEW.embedding_minilm_vec := NEW.embedding_minilm::text::vector(384);
    EXCEPTION WHEN OTHERS THEN
      NEW.embedding_minilm_vec := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_embedding_minilm_vec ON published_articles;
CREATE TRIGGER trg_sync_embedding_minilm_vec
BEFORE INSERT OR UPDATE OF embedding_minilm ON published_articles
FOR EACH ROW EXECUTE FUNCTION sync_embedding_minilm_to_vec();

-- Backfill existing articles that already have MiniLM embeddings
UPDATE published_articles
SET embedding_minilm_vec = embedding_minilm::text::vector(384)
WHERE embedding_minilm IS NOT NULL AND embedding_minilm_vec IS NULL;

-- HNSW index for fast ANN search (384 < 2000 dim limit!)
-- This gives us sub-10ms search instead of 50ms sequential scan
CREATE INDEX IF NOT EXISTS idx_articles_embedding_minilm_hnsw
ON published_articles
USING hnsw (embedding_minilm_vec vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 2. MiniLM TASTE VECTOR ON USERS
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS taste_vector_minilm JSONB;

-- ============================================================
-- 3. MiniLM CLUSTER CENTROIDS
-- ============================================================

ALTER TABLE user_interest_clusters
  ADD COLUMN IF NOT EXISTS medoid_minilm JSONB;

ALTER TABLE user_interest_clusters
  ADD COLUMN IF NOT EXISTS medoid_minilm_vec vector(384);

-- Auto-sync trigger for MiniLM cluster medoids
CREATE OR REPLACE FUNCTION sync_cluster_medoid_minilm_vec()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.medoid_minilm IS NOT NULL THEN
    BEGIN
      NEW.medoid_minilm_vec := NEW.medoid_minilm::text::vector(384);
    EXCEPTION WHEN OTHERS THEN
      NEW.medoid_minilm_vec := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cluster_medoid_minilm_vec ON user_interest_clusters;
CREATE TRIGGER trg_sync_cluster_medoid_minilm_vec
BEFORE INSERT OR UPDATE OF medoid_minilm ON user_interest_clusters
FOR EACH ROW EXECUTE FUNCTION sync_cluster_medoid_minilm_vec();

-- ============================================================
-- 4. RPC: MiniLM personal similarity search
-- ============================================================

CREATE OR REPLACE FUNCTION match_articles_personal_minilm(
  query_embedding float8[],
  match_count int DEFAULT 150,
  hours_window int DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}',
  min_similarity float8 DEFAULT 0.0
)
RETURNS TABLE (id bigint, similarity float8) AS $$
  SELECT
    pa.id,
    1 - (pa.embedding_minilm_vec <=> query_embedding::vector(384)) as similarity
  FROM published_articles pa
  WHERE pa.created_at >= NOW() - make_interval(hours => hours_window)
    AND pa.embedding_minilm_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_minilm_vec <=> query_embedding::vector(384)) >= min_similarity)
  ORDER BY pa.embedding_minilm_vec <=> query_embedding::vector(384)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 5. RPC: MiniLM multi-cluster search
-- ============================================================

CREATE OR REPLACE FUNCTION match_articles_multi_cluster_minilm(
  p_user_id UUID,
  match_per_cluster int DEFAULT 50,
  hours_window int DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}',
  min_similarity float8 DEFAULT 0.0
)
RETURNS TABLE (id bigint, similarity float8, cluster_index int) AS $$
  SELECT DISTINCT ON (sub.id)
    sub.id,
    sub.similarity,
    sub.cluster_index
  FROM (
    SELECT
      pa.id,
      1 - (pa.embedding_minilm_vec <=> uc.medoid_minilm_vec) as similarity,
      uc.cluster_index
    FROM user_interest_clusters uc
    CROSS JOIN LATERAL (
      SELECT pa2.id, pa2.embedding_minilm_vec
      FROM published_articles pa2
      WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
        AND pa2.embedding_minilm_vec IS NOT NULL
        AND (exclude_ids IS NULL OR pa2.id != ALL(exclude_ids))
        AND (min_similarity <= 0 OR 1 - (pa2.embedding_minilm_vec <=> uc.medoid_minilm_vec) >= min_similarity)
      ORDER BY pa2.embedding_minilm_vec <=> uc.medoid_minilm_vec
      LIMIT match_per_cluster
    ) pa
    WHERE uc.user_id = p_user_id
      AND uc.medoid_minilm_vec IS NOT NULL
  ) sub
  ORDER BY sub.id, sub.similarity DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 6. EMA update for MiniLM taste vector
-- ============================================================

CREATE OR REPLACE FUNCTION update_taste_vector_minilm_ema(
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
  -- Get article MiniLM embedding
  SELECT embedding_minilm::text::float8[] INTO article_emb
  FROM published_articles
  WHERE id = p_article_id AND embedding_minilm IS NOT NULL;

  IF article_emb IS NULL THEN
    RETURN;
  END IF;

  -- Get current MiniLM taste vector
  SELECT taste_vector_minilm::text::float8[] INTO current_taste
  FROM users
  WHERE id = p_user_id;

  -- EMA learning rate
  alpha := CASE
    WHEN p_event_type = 'article_saved' THEN 0.15
    WHEN p_event_type = 'article_engaged' THEN 0.10
    ELSE 0.05
  END;

  IF current_taste IS NULL THEN
    UPDATE users SET taste_vector_minilm = to_jsonb(article_emb)
    WHERE id = p_user_id;
  ELSE
    dim := array_length(article_emb, 1);
    SELECT array_agg(
      (1 - alpha) * current_taste[i] + alpha * article_emb[i]
    )
    INTO new_taste
    FROM generate_series(1, dim) AS i;

    UPDATE users SET taste_vector_minilm = to_jsonb(new_taste)
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. SKIP TRACKING: Feed impressions + skip profile
-- ============================================================

-- Track which articles were shown in feed (for skip detection)
CREATE TABLE IF NOT EXISTS user_feed_impressions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_feed_impressions_user_created
ON user_feed_impressions (user_id, created_at DESC);

-- Skip profile stored on user (computed periodically)
ALTER TABLE users ADD COLUMN IF NOT EXISTS skip_profile JSONB;

-- ============================================================
-- 8. Update existing update_taste_vector_ema to also update MiniLM
-- ============================================================

CREATE OR REPLACE FUNCTION update_taste_vector_ema(
  p_user_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT DEFAULT 'article_engaged'
)
RETURNS void AS $$
DECLARE
  article_emb float8[];
  article_emb_minilm float8[];
  current_taste float8[];
  current_taste_minilm float8[];
  alpha float8;
  new_taste float8[];
  new_taste_minilm float8[];
  dim int;
BEGIN
  -- Get article embeddings (both Gemini and MiniLM)
  SELECT
    embedding::text::float8[],
    embedding_minilm::text::float8[]
  INTO article_emb, article_emb_minilm
  FROM published_articles
  WHERE id = p_article_id;

  -- EMA learning rate
  alpha := CASE
    WHEN p_event_type = 'article_saved' THEN 0.15
    WHEN p_event_type = 'article_engaged' THEN 0.10
    ELSE 0.05
  END;

  -- Update Gemini taste vector (existing behavior)
  IF article_emb IS NOT NULL THEN
    SELECT taste_vector::text::float8[] INTO current_taste
    FROM users WHERE id = p_user_id;

    IF current_taste IS NULL THEN
      UPDATE users SET taste_vector = to_jsonb(article_emb)
      WHERE id = p_user_id;
    ELSE
      dim := array_length(article_emb, 1);
      SELECT array_agg((1 - alpha) * current_taste[i] + alpha * article_emb[i])
      INTO new_taste FROM generate_series(1, dim) AS i;
      UPDATE users SET taste_vector = to_jsonb(new_taste)
      WHERE id = p_user_id;
    END IF;
  END IF;

  -- Update MiniLM taste vector
  IF article_emb_minilm IS NOT NULL THEN
    SELECT taste_vector_minilm::text::float8[] INTO current_taste_minilm
    FROM users WHERE id = p_user_id;

    IF current_taste_minilm IS NULL THEN
      UPDATE users SET taste_vector_minilm = to_jsonb(article_emb_minilm)
      WHERE id = p_user_id;
    ELSE
      dim := array_length(article_emb_minilm, 1);
      SELECT array_agg((1 - alpha) * current_taste_minilm[i] + alpha * article_emb_minilm[i])
      INTO new_taste_minilm FROM generate_series(1, dim) AS i;
      UPDATE users SET taste_vector_minilm = to_jsonb(new_taste_minilm)
      WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

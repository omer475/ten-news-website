-- Migration 038: Replace hardcoded time windows with per-article shelf_life_days
-- Each article has its own shelf_life_days (1d for breaking, 14d for explainers, 60d for evergreen).
-- Instead of a global hours_window, articles are active while:
--   created_at + shelf_life_days > NOW()
-- hours_window parameter kept for backwards compatibility but ignored.

-- 1. match_articles_personal (Gemini embeddings)
CREATE OR REPLACE FUNCTION match_articles_personal(
  query_embedding float8[],
  match_count int DEFAULT 150,
  hours_window int DEFAULT 720,
  exclude_ids bigint[] DEFAULT '{}',
  min_similarity float8 DEFAULT 0.0
)
RETURNS TABLE (id bigint, similarity float8) AS $$
  SELECT
    pa.id,
    1 - (pa.embedding_vec <=> query_embedding::vector(3072)) as similarity
  FROM published_articles pa
  WHERE pa.created_at + make_interval(days => COALESCE(pa.shelf_life_days, 7)) > NOW()
    AND pa.published_at <= NOW()
    AND pa.embedding_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_vec <=> query_embedding::vector(3072)) >= min_similarity)
  ORDER BY pa.embedding_vec <=> query_embedding::vector(3072)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 2. match_articles_multi_cluster (Gemini embeddings)
CREATE OR REPLACE FUNCTION match_articles_multi_cluster(
  p_user_id UUID,
  match_per_cluster int DEFAULT 50,
  hours_window int DEFAULT 720,
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
      1 - (pa.embedding_vec <=> uc.medoid_vec) as similarity,
      uc.cluster_index
    FROM user_interest_clusters uc
    CROSS JOIN LATERAL (
      SELECT pa2.id, pa2.embedding_vec
      FROM published_articles pa2
      WHERE pa2.created_at + make_interval(days => COALESCE(pa2.shelf_life_days, 7)) > NOW()
        AND pa2.published_at <= NOW()
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

-- 3. match_articles_personal_minilm (MiniLM embeddings)
CREATE OR REPLACE FUNCTION match_articles_personal_minilm(
  query_embedding float8[],
  match_count int DEFAULT 150,
  hours_window int DEFAULT 720,
  exclude_ids bigint[] DEFAULT '{}',
  min_similarity float8 DEFAULT 0.0
)
RETURNS TABLE (id bigint, similarity float8) AS $$
  SELECT
    pa.id,
    1 - (pa.embedding_minilm_vec <=> query_embedding::vector(384)) as similarity
  FROM published_articles pa
  WHERE pa.created_at + make_interval(days => COALESCE(pa.shelf_life_days, 7)) > NOW()
    AND pa.published_at <= NOW()
    AND pa.embedding_minilm_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_minilm_vec <=> query_embedding::vector(384)) >= min_similarity)
  ORDER BY pa.embedding_minilm_vec <=> query_embedding::vector(384)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 4. match_articles_multi_cluster_minilm (MiniLM embeddings)
CREATE OR REPLACE FUNCTION match_articles_multi_cluster_minilm(
  p_user_id UUID,
  match_per_cluster int DEFAULT 50,
  hours_window int DEFAULT 720,
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
      WHERE pa2.created_at + make_interval(days => COALESCE(pa2.shelf_life_days, 7)) > NOW()
        AND pa2.published_at <= NOW()
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

-- Add index to speed up shelf_life filtering
CREATE INDEX IF NOT EXISTS idx_articles_shelf_life_active
ON published_articles (created_at, shelf_life_days)
WHERE shelf_life_days IS NOT NULL;

-- Migration 035: Add published_at <= NOW() filter to all article RPCs
-- Prevents future-scheduled articles from appearing in feeds before their publish time.

-- 1. Fix match_articles_personal (OpenAI embeddings)
CREATE OR REPLACE FUNCTION match_articles_personal(
  query_embedding float8[],
  match_count int DEFAULT 150,
  hours_window int DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}',
  min_similarity float8 DEFAULT 0.0
)
RETURNS TABLE (id bigint, similarity float8) AS $$
  SELECT
    pa.id,
    1 - (pa.embedding_vec <=> query_embedding::vector(3072)) as similarity
  FROM published_articles pa
  WHERE pa.created_at >= NOW() - make_interval(hours => hours_window)
    AND pa.published_at <= NOW()
    AND pa.embedding_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_vec <=> query_embedding::vector(3072)) >= min_similarity)
  ORDER BY pa.embedding_vec <=> query_embedding::vector(3072)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 2. Fix match_articles_multi_cluster (OpenAI embeddings)
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

-- 3. Fix match_articles_personal_minilm
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
    AND pa.published_at <= NOW()
    AND pa.embedding_minilm_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_minilm_vec <=> query_embedding::vector(384)) >= min_similarity)
  ORDER BY pa.embedding_minilm_vec <=> query_embedding::vector(384)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 4. Fix match_articles_multi_cluster_minilm
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

-- ============================================================
-- MIGRATION 019: Multi-Cluster Feed Improvements
-- ============================================================
-- Fixes for single taste vector limitations:
-- 1. Similarity floor on match RPCs (blocks irrelevant high-score leaks)
-- 2. Updated match_articles_multi_cluster returns cluster_index for round-robin
-- 3. New cluster_user_interests_v2 supports centroid-based clustering
--
-- Run this in Supabase SQL Editor.

-- ============================================================
-- 1. match_articles_personal with similarity floor
-- ============================================================

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
    AND pa.embedding_vec IS NOT NULL
    AND (exclude_ids IS NULL OR pa.id != ALL(exclude_ids))
    AND (min_similarity <= 0 OR 1 - (pa.embedding_vec <=> query_embedding::vector(3072)) >= min_similarity)
  ORDER BY pa.embedding_vec <=> query_embedding::vector(3072)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 2. match_articles_multi_cluster with similarity floor
-- ============================================================

CREATE OR REPLACE FUNCTION match_articles_multi_cluster(
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
      1 - (pa.embedding_vec <=> uc.medoid_vec) as similarity,
      uc.cluster_index
    FROM user_interest_clusters uc
    CROSS JOIN LATERAL (
      SELECT pa2.id, pa2.embedding_vec
      FROM published_articles pa2
      WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
        AND pa2.embedding_vec IS NOT NULL
        AND (exclude_ids IS NULL OR pa2.id != ALL(exclude_ids))
        AND (min_similarity <= 0 OR 1 - (pa2.embedding_vec <=> uc.medoid_vec) >= min_similarity)
      ORDER BY pa2.embedding_vec <=> uc.medoid_vec
      LIMIT match_per_cluster
    ) pa
    WHERE uc.user_id = p_user_id
      AND uc.medoid_vec IS NOT NULL
  ) sub
  ORDER BY sub.id, sub.similarity DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 3. Add centroid_embedding column for k-means centroids
-- ============================================================
-- The existing medoid_embedding stores a real article's embedding.
-- For k-means, we need to store computed centroids that may not
-- correspond to any single article.

ALTER TABLE user_interest_clusters
  ADD COLUMN IF NOT EXISTS is_centroid BOOLEAN DEFAULT FALSE;

-- When is_centroid = true, medoid_embedding contains a computed centroid
-- (not a real article embedding). medoid_article_id is the nearest article.
-- The existing trigger sync_cluster_medoid_vec() handles vector sync.

-- ============================================================
-- 4. Add similarity_floor to users table (per-user adaptive floor)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS similarity_floor FLOAT DEFAULT 0.0;

COMMENT ON COLUMN users.similarity_floor IS
  'Dynamic similarity floor: 25th percentile of engaged article similarities. Articles below this threshold are filtered from the personal feed.';

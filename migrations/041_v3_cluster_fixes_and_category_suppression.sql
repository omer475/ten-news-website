-- Migration 041: V3 cluster key fix + category engagement suppression
-- Fixes: cluster RPCs to support personalization_id, category stats RPC

-- ============================================================
-- 1. Fix match_articles_multi_cluster_minilm to support personalization_id
-- V3 clusters use personalization_id column, not user_id
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
    WHERE (uc.user_id = p_user_id OR uc.personalization_id = p_user_id)
      AND uc.medoid_minilm_vec IS NOT NULL
      AND (uc.suppressed IS NULL OR uc.suppressed = false)
  ) sub
  ORDER BY sub.id, sub.similarity DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 2. Same fix for non-minilm version
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
      1 - (pa.embedding <=> uc.medoid_embedding) as similarity,
      uc.cluster_index
    FROM user_interest_clusters uc
    CROSS JOIN LATERAL (
      SELECT pa2.id, pa2.embedding
      FROM published_articles pa2
      WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
        AND pa2.embedding IS NOT NULL
        AND (exclude_ids IS NULL OR pa2.id != ALL(exclude_ids))
        AND (min_similarity <= 0 OR 1 - (pa2.embedding <=> uc.medoid_embedding) >= min_similarity)
      ORDER BY pa2.embedding <=> uc.medoid_embedding
      LIMIT match_per_cluster
    ) pa
    WHERE (uc.user_id = p_user_id OR uc.personalization_id = p_user_id)
      AND uc.medoid_embedding IS NOT NULL
      AND (uc.suppressed IS NULL OR uc.suppressed = false)
  ) sub
  ORDER BY sub.id, sub.similarity DESC;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 3. Category engagement stats RPC (Fix 5)
-- Returns per-category impression and engagement counts
-- ============================================================

CREATE OR REPLACE FUNCTION get_category_engagement_stats(p_user_id uuid, p_days int DEFAULT 7)
RETURNS TABLE(category text, impressions bigint, engaged bigint) AS $$
  SELECT
    pa.category,
    COUNT(DISTINCT uae.article_id) as impressions,
    COUNT(DISTINCT uae.article_id) FILTER (
      WHERE uae.event_type IN ('article_engaged', 'article_liked', 'article_saved', 'article_revisit')
    ) as engaged
  FROM user_article_events uae
  JOIN published_articles pa ON pa.id = uae.article_id
  WHERE uae.user_id = p_user_id
  AND uae.created_at > NOW() - (p_days || ' days')::interval
  AND uae.event_type IN ('article_view', 'article_skipped', 'article_engaged', 'article_liked', 'article_saved', 'article_detail_view', 'article_revisit')
  GROUP BY pa.category
$$ LANGUAGE sql STABLE;

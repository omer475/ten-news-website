-- Migration 082 — Phoenix Phase 1.2b. Replace hard antijoin with seen_count.
--
-- Why this exists:
--   The migration-080 RPCs hard-filter every article the user has ever
--   seen (NOT EXISTS against user_feed_impressions). For a power user
--   with 12,973 distinct lifetime impressions, this leaves the M-tier
--   retrieval pool empty in narrow taste clusters where the user has
--   already exhausted the catalog. composeWithBudgets then spills explore
--   into the empty slots and the feed becomes ~93% explore content.
--
-- Fix:
--   New RPCs return articles with `seen_count` (LEFT JOIN against
--   user_feed_impressions, COUNT). The application-side rerank applies
--   a soft multiplier (1.0 / 0.4 / 0.1 / 0.02 by 0/1/2/3+ views) so
--   pools never come back empty — the score system handles attenuation.
--
--   This is the TikTok pattern for power users (per ex-engineer talks):
--   in-cluster exhaustion is solved by score decay, not hard filter.
--   Hard filter is reserved for explicit Not-Interested + abuse blocks.

CREATE OR REPLACE FUNCTION public.trinity_fetch_cluster_with_seencount(
  p_user_id      uuid,
  p_vq_secondary smallint,
  p_hours_window int  DEFAULT 168,
  p_min_score    real DEFAULT 0,
  p_limit        int  DEFAULT 20
)
RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           real,
  vq_primary               smallint,
  vq_secondary             smallint,
  embedding_minilm_vec     vector(384),
  image_url                text,
  image_source             text,
  source                   text,
  url                      text,
  expected_read_seconds    int,
  created_at               timestamptz,
  published_at             timestamptz,
  components_order         text[],
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.emoji, pa.num_sources,
    pa.freshness_category, pa.shelf_life_days, pa.author_id, pa.author_name,
    COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id
      AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_secondary = p_vq_secondary
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_cluster_with_seencount IS
  'Phoenix Phase 1.2b. Per-secondary candidate fetch returning seen_count. Replaces trinity_fetch_cluster_antijoin which over-filtered narrow-cluster pools for power users.';


CREATE OR REPLACE FUNCTION public.trinity_fetch_fresh_with_seencount(
  p_user_id      uuid,
  p_vq_primaries smallint[],
  p_hours_window int  DEFAULT 48,
  p_min_score    real DEFAULT 500,
  p_limit        int  DEFAULT 80
)
RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           real,
  vq_primary               smallint,
  vq_secondary             smallint,
  embedding_minilm_vec     vector(384),
  image_url                text,
  image_source             text,
  source                   text,
  url                      text,
  expected_read_seconds    int,
  created_at               timestamptz,
  published_at             timestamptz,
  components_order         text[],
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.emoji, pa.num_sources,
    pa.freshness_category, pa.shelf_life_days, pa.author_id, pa.author_name,
    COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id
      AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_primary = ANY(p_vq_primaries)
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phoenix Phase 1.2b. Trinity-fresh fetch returning seen_count for soft decay.';

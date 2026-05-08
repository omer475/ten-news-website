-- Migration 085 — Phoenix Phase 4.A. Recent-seen hard exclusion window.
--
-- Bug: Phase 1.2b replaced the hard lifetime antijoin (migration 080) with
-- a soft seenDecay multiplier (1.0 / 0.4 / 0.1 / 0.02 by view count). The
-- 73-minute session at 13:20-14:34 UTC on test user 5082a1df-… showed 20%
-- of 323 slots were duplicates — same article served 3-5 times within the
-- session because a 790-score article × 0.4 soft decay = effective 316,
-- still high enough to win in narrow taste clusters.
--
-- Fix: hard-exclude articles seen in the last 6 hours. Lifetime soft decay
-- still applies to articles seen >6h ago, preserving the original Phase
-- 1.2b benefit (narrow-cluster pools don't go empty for power users)
-- for genuinely-old content.
--
-- TikTok-aligned: ex-engineers describe seen-video dedup as "weeks at
-- minimum." 6h is conservative for our text feed where articles have
-- a faster news cycle.

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
    AND (
      p_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id
          AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '6 hours'
      )
    )
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_cluster_with_seencount IS
  'Phoenix Phase 4.A. Per-secondary candidate fetch with 6h recent-seen hard exclusion + lifetime seen_count for soft decay.';


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
    AND (
      p_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id
          AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '6 hours'
      )
    )
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phoenix Phase 4.A. Trinity-fresh fetch with 6h recent-seen hard exclusion + lifetime seen_count for soft decay.';

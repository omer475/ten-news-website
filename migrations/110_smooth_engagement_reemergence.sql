-- Migration 110 — Phase 2.5 (TikTok mirror plan).
-- Smooth engagement re-emergence: replaces the article_engaged 30-day hard
-- cliff with a smooth ranker-side multiplier.
--
-- Pre-2.5 (mig 095/104): articles with article_engaged events in last 30
-- days are HARD-excluded from the candidate pool. After day 30, full re-show
-- eligibility — a cliff transition. TikTok's suppression curve is smoother:
-- recently-engaged content fades out, attenuates over weeks, and gradually
-- re-emerges if quality is high relative to current alternatives.
--
-- This migration:
--   1. Removes the article_engaged 30-day hard exclude from
--      trinity_fetch_cluster_with_seencount and trinity_fetch_fresh_with_seencount.
--   2. Adds last_engaged_at timestamptz to the return shape so JS rerank
--      can compute days_since_engagement and apply 1/(1+0.04·d) attenuation.
--   3. Keeps the deliberate-keep (liked/saved/shared/revisit/detail_view)
--      lifetime exclude — those are "I want this kept" signals, not "I
--      finished reading this". The rerank() smooth-engagement multiplier
--      doesn't apply to them.
--   4. Keeps the 7-day impression window (mig 104) — within-week dedup is
--      still hard.
--
-- Net effect: an article_engaged event 25 days ago goes from "fully blocked"
-- (cliff) to "in pool, score multiplier 0.50×" (smooth). At 60 days, mult is
-- 0.29×. At 365 days, 0.06×.

DROP FUNCTION IF EXISTS public.trinity_fetch_cluster_with_seencount(uuid, smallint, int, real, int);
DROP FUNCTION IF EXISTS public.trinity_fetch_fresh_with_seencount(uuid, smallint[], int, real, int);

CREATE FUNCTION public.trinity_fetch_cluster_with_seencount(
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
  components               text[],
  details                  jsonb,
  timeline                 jsonb,
  graph                    jsonb,
  map                      jsonb,
  five_ws                  jsonb,
  countries                text[],
  topics                   text[],
  interest_tags            jsonb,
  country_relevance        jsonb,
  topic_relevance          jsonb,
  cluster_id               bigint,
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int,
  last_engaged_at          timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, COALESCE(seen.cnt, 0)::int AS seen_count,
    eng.last_engaged_at
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT MAX(e.created_at) AS last_engaged_at
    FROM public.user_article_events e
    WHERE e.user_id = p_user_id AND e.article_id = pa.id
      AND e.event_type = 'article_engaged'
  ) eng ON p_user_id IS NOT NULL
  WHERE pa.vq_secondary = p_vq_secondary
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      -- Deliberate-keep events stay LIFETIME excluded. Phase 2.5 only
      -- changes article_engaged to smooth re-emergence.
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id AND e.article_id = pa.id
          AND e.event_type IN (
            'article_liked', 'article_saved', 'article_shared',
            'article_revisit', 'article_detail_view'
          )
      )
      -- 7-day unengaged impression window (mig 104) preserved.
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '7 days'
      )
    ))
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

CREATE FUNCTION public.trinity_fetch_fresh_with_seencount(
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
  components               text[],
  details                  jsonb,
  timeline                 jsonb,
  graph                    jsonb,
  map                      jsonb,
  five_ws                  jsonb,
  countries                text[],
  topics                   text[],
  interest_tags            jsonb,
  country_relevance        jsonb,
  topic_relevance          jsonb,
  cluster_id               bigint,
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int,
  last_engaged_at          timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, COALESCE(seen.cnt, 0)::int AS seen_count,
    eng.last_engaged_at
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT MAX(e.created_at) AS last_engaged_at
    FROM public.user_article_events e
    WHERE e.user_id = p_user_id AND e.article_id = pa.id
      AND e.event_type = 'article_engaged'
  ) eng ON p_user_id IS NOT NULL
  WHERE pa.vq_primary = ANY(p_vq_primaries)
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id AND e.article_id = pa.id
          AND e.event_type IN (
            'article_liked', 'article_saved', 'article_shared',
            'article_revisit', 'article_detail_view'
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '7 days'
      )
    ))
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_cluster_with_seencount IS
  'Phase 2.5 (2026-05-10). article_engaged 30-day hard exclude removed; replaced with smooth ranker-side attenuation via last_engaged_at. Deliberate keeps still lifetime-excluded; impressions still 7-day blocked.';
COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phase 2.5 (2026-05-10). article_engaged 30-day hard exclude removed; replaced with smooth ranker-side attenuation via last_engaged_at.';
-- Migration 089 — Phoenix Phase 5.A. Restore JSONB component columns.
--
-- CRITICAL bug found in Day 2 audit: migrations 082/085/086/087's
-- RETURNS TABLE schema for trinity_fetch_cluster_with_seencount and
-- trinity_fetch_fresh_with_seencount omitted the JSONB component columns.
-- Every Trinity-served article since Phase 1.2b reaches iOS with
-- details/timeline/graph/map/five_ws/components/countries/topics all NULL,
-- so the card UI's component sections render BLANK — even though the
-- pipeline produces them and they're in the DB.
--
-- The legacy fallback path in lib/trinity.js:854 and :1231 explicitly
-- selects them; the active RPC path was silently dropping them.
--
-- This migration DROPs and recreates both RPCs with the full schema while
-- preserving Phase 4.A.3 engagement-aware exclusion (lifetime engaged +
-- 48h impressions). Postgres requires DROP because the return type is
-- changing (additional columns).

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
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_secondary = p_vq_secondary
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id AND e.article_id = pa.id
          AND e.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit','article_detail_view')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '48 hours'
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
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_primary = ANY(p_vq_primaries)
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id AND e.article_id = pa.id
          AND e.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit','article_detail_view')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '48 hours'
      )
    ))
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_cluster_with_seencount IS
  'Phoenix Phase 5.A. Per-secondary candidate fetch with full JSONB component columns + Phase 4.A.3 engagement-aware exclusion.';
COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phoenix Phase 5.A. Trinity-fresh fetch with full JSONB component columns + Phase 4.A.3 engagement-aware exclusion.';

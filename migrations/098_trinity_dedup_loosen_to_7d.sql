-- Migration 098 — Phoenix Phase 9.D. Loosen unengaged-impression dedup 14d -> 7d.
--
-- Session 3 (2026-05-10 00:15-00:18 UTC) showed migration 095's 14-day window
-- starved heavy users. The test user has 821 lifetime events on primary 39
-- (AI/Tech) and has been impressed by virtually every fresh primary 39 article
-- in the last 14 days. Result: tier1 produced 1 article, fresh produced 4,
-- and trinity-LT swallowed 72% of the slate with random long-tail content
-- (Indian politics, Spanish politics, Turkish crime, sports, food trivia)
-- the user found unrecognizable.
--
-- 7-day window: still blocks within-week repeats (the original concern from
-- session 2 where 31% of slots were repeats from 2-13 days ago, mostly
-- 6-7 day gaps) but lets older impressions back into retrieval. Soft
-- seenDecay in rerank (1.0 / 0.4 / 0.1 / 0.02 by view count) still
-- attenuates re-shown articles past the hard window.
--
-- 9.B.2's engagement-class split (lifetime for liked/saved/shared/revisit/
-- detail_view; 30-day cooldown for article_engaged) is unchanged.

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
          AND (
            e.event_type IN (
              'article_liked', 'article_saved', 'article_shared',
              'article_revisit', 'article_detail_view'
            )
            OR (
              e.event_type = 'article_engaged'
              AND e.created_at > NOW() - interval '30 days'
            )
          )
      )
      -- Phase 9.D: 14d -> 7d to unblock heavy-user top primaries.
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
          AND (
            e.event_type IN (
              'article_liked', 'article_saved', 'article_shared',
              'article_revisit', 'article_detail_view'
            )
            OR (
              e.event_type = 'article_engaged'
              AND e.created_at > NOW() - interval '30 days'
            )
          )
      )
      -- Phase 9.D: 14d -> 7d.
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
  'Phoenix Phase 9.D (2026-05-10). Loosen unengaged-impression hard exclude window 14d -> 7d to unblock heavy-user top primaries. Engagement-class split (9.B.2) preserved.';
COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phoenix Phase 9.D (2026-05-10). Loosen unengaged-impression hard exclude window 14d -> 7d to unblock heavy-user top primaries. Engagement-class split (9.B.2) preserved.';

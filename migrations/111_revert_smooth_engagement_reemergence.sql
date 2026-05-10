-- Migration 111 — Phase 3.0 (multiplier-cleanup).
-- REVERTS migration 110 (Phase 2.5 smooth engagement re-emergence).
--
-- Why: mig 110 removed the article_engaged 30-day hard cliff in
-- trinity_fetch_*_with_seencount and replaced it with a smooth
-- ranker-side multiplier (engageReEmergeMult in lib/trinityServe.js).
-- Live evidence from session d5c1c943 (2026-05-10 16:30 UTC): 9 of 25
-- slate slots were 9–14 day old previously-engaged articles. The smooth
-- attenuation wasn't strong enough when fresh supply ran out.
--
-- Restores mig 104 / mig 095 behavior: article_engaged events in last
-- 30 days hard-exclude the article from retrieval. Soft seenDecay still
-- attenuates older repeats outside the 30-day window.
--
-- The engageReEmergeMult ranker term is also being deleted from
-- lib/trinityServe.js in this same release. The last_engaged_at column
-- in the RETURNS TABLE stays (extra field; JS ignores it). Re-creating
-- the function without it would be a wider change for no benefit.

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
      -- Phase 3.0: restored mig 104 engagement-aware exclude.
      -- article_engaged events in last 30d hard-exclude. Deliberate
      -- keeps (liked/saved/shared/revisit/detail_view) stay LIFETIME excluded.
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
  'Phase 3.0 (2026-05-10). Restored article_engaged 30-day cliff (reverts mig 110). Smooth engagement re-emergence caused old-content regression in live sessions.';
COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phase 3.0 (2026-05-10). Restored article_engaged 30-day cliff (reverts mig 110).';

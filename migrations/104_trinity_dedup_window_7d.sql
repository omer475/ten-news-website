-- Migration 104 — Phase 1.4 (TikTok mirror plan).
-- REVERTS migration 099 (Phoenix Phase 9.E). Hard impression window 24h → 7d.
--
-- Why: mig 099 collapsed the unengaged hard exclusion to 24h "trusting
-- soft seenDecay." The cliff at 0.4× / 0.1× / 0.02× (mig 098-era seenDecay)
-- was insufficient on quiet days — recency*qualityNorm of a 25-hour-old
-- repeat could still beat a fresh-but-mid-quality alternative. Users saw
-- articles they'd just scrolled past hours ago.
--
-- The real underlying problem mig 099 was treating: insufficient supply in
-- top-3 primaries for power users. The 14-day window in mig 095 blocked
-- 100% of fresh AI articles for the test user because they had been
-- impressed by every fresh AI article from the past two weeks.
--
-- Fix: 7d hard window AS THE BASELINE (TikTok industry norm for unengaged
-- content). Plus:
--   1. lib/trinityServe.js — fresh score floor lowered for top-3 primaries
--      (300 instead of 500) to expand supply for the user's strongest
--      interests.
--   2. lib/trinityServe.js seenDecay — smooth 1/(1+0.4*seen_count) instead
--      of the 1.0/0.4/0.1/0.02 cliff. Keeps the ranker informed by view
--      count without the hard 0.02 effective-exclusion at 3+ views.
--   3. Migration 105 supply-health view — quantitative observability so the
--      window/floor tradeoff is measured, not guessed.

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
      -- Engagement-aware exclude (kept from mig 095). Deliberate keeps stay
      -- LIFETIME excluded; article_engaged becomes a 30-day cooldown only.
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
      -- Phase 1.4 (2026-05-10): unengaged-impression window restored to 7 days.
      -- Reverts mig 099's 24h window. Soft seenDecay in lib/trinityServe.js
      -- handles within-window soft attenuation; hard window prevents jarring
      -- re-shows of articles the user saw in the past week.
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
  'Phase 1.4 (2026-05-10). 7-day unengaged hard window restored. Reverts mig 099 24h. Soft seenDecay in lib/trinityServe.js handles within-window attenuation.';
COMMENT ON FUNCTION public.trinity_fetch_fresh_with_seencount IS
  'Phase 1.4 (2026-05-10). 7-day unengaged hard window restored. Caller can lower p_min_score (default 500) for top-N primaries to expand supply.';

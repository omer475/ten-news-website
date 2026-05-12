-- 2026-05-12: revert seen-history dedup from lifetime (36500d, mig 117) to
-- 48-hour hard exclude. Reason:
--
-- Mig 117 (earlier today) set lifetime exclusion, which catastrophically
-- starved the personal retriever for heavy users. Test user audit after
-- mig 117 deploy: trinity-personal share collapsed from 34% → 3.4%, slate
-- size dropped from 25 → 6 cards mid-session, follow flooded the gap.
--
-- Root cause: a heavy user (15k+ unique articles seen) under lifetime
-- exclusion has 0 unseen articles in their top primaries for any short
-- recency window. The 48h hard / soft-decay design (Phoenix Phase 1.2b,
-- migrations 082/085/086) was the correct shape — articles seen 3+ days
-- ago can re-appear in retrieval with seen_count populated, and the
-- existing rerank chain applies `seenMult = 1/(1+0.4*seen_count)` to
-- penalize them softly. That's how the algorithm avoids same-day repeats
-- without permanently locking the user out of resurfaceable content.
--
-- This migration sets p_dedup_days DEFAULT = 2 (48 hours). The user-
-- complaint that drove mig 115/115b was "I see the same article across
-- sessions" — 48h hard exclude solves that for multi-session-per-day
-- usage. The seenMult soft penalty handles longer-term repetition.

-- ---------------------------------------------------------------------------
-- articles_ann_in_primary — default 36500 (lifetime) → 2 (48h)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.articles_ann_in_primary(uuid, vector, int, bigint[], int, int, int, int);

CREATE OR REPLACE FUNCTION public.articles_ann_in_primary(
  p_user_id       uuid,
  p_user_vec      vector(384),
  p_vq_primary    int,
  p_exclude_ids   bigint[] DEFAULT NULL,
  p_hours_window  int DEFAULT 48,
  p_min_score     int DEFAULT 200,
  p_limit         int DEFAULT 20,
  p_dedup_days    int DEFAULT 2
) RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           int,
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
  ann_similarity           double precision,
  seen_count               int
) LANGUAGE sql STABLE AS $$
  WITH dedup_cutoff AS (
    SELECT (NOW() - (p_dedup_days || ' days')::interval) AS cutoff
  )
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name,
    (1.0 - (pa.embedding_minilm_vec <=> p_user_vec))::double precision AS ann_similarity,
    COALESCE((
      SELECT COUNT(*)::int FROM public.user_feed_impressions ufi
      WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
    ), 0) AS seen_count
  FROM public.published_articles pa
  WHERE pa.vq_primary = p_vq_primary
    AND pa.created_at >= NOW() - (p_hours_window || ' hours')::interval
    AND pa.ai_final_score >= p_min_score
    AND pa.embedding_minilm_vec IS NOT NULL
    AND (p_exclude_ids IS NULL OR NOT (pa.id = ANY(p_exclude_ids)))
    AND NOT EXISTS (
      SELECT 1 FROM public.user_feed_impressions ufi, dedup_cutoff dc
      WHERE ufi.user_id = p_user_id
        AND ufi.article_id = pa.id
        AND ufi.created_at >= dc.cutoff
    )
  ORDER BY pa.embedding_minilm_vec <=> p_user_vec
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.articles_ann_in_primary(uuid, vector, int, bigint[], int, int, int, int) TO authenticated, service_role, anon;

-- ---------------------------------------------------------------------------
-- retrieve_followed_with_seen_dedup — default 36500 (lifetime) → 2 (48h)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.retrieve_followed_with_seen_dedup(uuid, uuid[], int[], int, int, int, int);

CREATE OR REPLACE FUNCTION public.retrieve_followed_with_seen_dedup(
  p_user_id        uuid,
  p_publisher_ids  uuid[],
  p_only_primaries int[] DEFAULT NULL,
  p_hours_window   int DEFAULT 168,
  p_min_score      int DEFAULT 200,
  p_limit          int DEFAULT 30,
  p_dedup_days     int DEFAULT 2
) RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           int,
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
) LANGUAGE sql STABLE AS $$
  WITH dedup_cutoff AS (
    SELECT (NOW() - (p_dedup_days || ' days')::interval) AS cutoff
  )
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name,
    COALESCE((
      SELECT COUNT(*)::int FROM public.user_feed_impressions ufi
      WHERE ufi.user_id = p_user_id AND ufi.article_id = pa.id
    ), 0) AS seen_count
  FROM public.published_articles pa
  WHERE pa.author_id = ANY(p_publisher_ids)
    AND pa.created_at >= NOW() - (p_hours_window || ' hours')::interval
    AND pa.ai_final_score >= p_min_score
    AND (p_only_primaries IS NULL OR pa.vq_primary = ANY(p_only_primaries))
    AND NOT EXISTS (
      SELECT 1 FROM public.user_feed_impressions ufi, dedup_cutoff dc
      WHERE ufi.user_id = p_user_id
        AND ufi.article_id = pa.id
        AND ufi.created_at >= dc.cutoff
    )
  ORDER BY pa.ai_final_score DESC, pa.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.retrieve_followed_with_seen_dedup(uuid, uuid[], int[], int, int, int, int) TO authenticated, service_role, anon;

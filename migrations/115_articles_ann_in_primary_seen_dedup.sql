-- Hot fix (2026-05-12): add 7-day seen-history antijoin to
-- articles_ann_in_primary. The PR #148 version only filtered on
-- iOS-supplied excludeIds, which is the current-session seen list. Articles
-- shown to the user days ago weren't in that list, so the personal
-- retriever was happily re-serving them — once trinity-personal grew to
-- 44% of the slate post-#151, the result was 100% repeats.
--
-- Matches the pattern from trinity_fetch_fresh_with_seencount /
-- trinity_fetch_cluster_with_seencount (mig 089): NOT EXISTS join against
-- user_feed_impressions in a 7-day hard window. Older shows are allowed
-- through with the soft seen_count decay applied downstream.

DROP FUNCTION IF EXISTS public.articles_ann_in_primary(vector, int, bigint[], int, int, int);

CREATE OR REPLACE FUNCTION public.articles_ann_in_primary(
  p_user_id       uuid,
  p_user_vec      vector(384),
  p_vq_primary    int,
  p_exclude_ids   bigint[] DEFAULT NULL,
  p_hours_window  int DEFAULT 48,
  p_min_score     int DEFAULT 200,
  p_limit         int DEFAULT 20,
  p_dedup_days    int DEFAULT 7
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

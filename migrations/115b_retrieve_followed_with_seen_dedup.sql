-- Hot fix (2026-05-12): retrieve_followed_with_seen_dedup RPC.
-- retrieveFollowed in JS only excluded iOS-supplied seenIds. Same bug as
-- articles_ann_in_primary — articles shown days ago weren't in that list,
-- so the follow pool also re-served them. With trinity-follow capped at
-- 14% post-#151 the impact is smaller than personal's, but still 4-7
-- repeat slots per slate.

CREATE OR REPLACE FUNCTION public.retrieve_followed_with_seen_dedup(
  p_user_id        uuid,
  p_publisher_ids  uuid[],
  p_only_primaries int[] DEFAULT NULL,
  p_hours_window   int DEFAULT 168,
  p_min_score      int DEFAULT 200,
  p_limit          int DEFAULT 30,
  p_dedup_days     int DEFAULT 7
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

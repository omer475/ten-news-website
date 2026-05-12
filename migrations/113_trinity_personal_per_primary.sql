-- Migration 113: Trinity personal-per-primary retrieval (P2 fix)
-- Date: 2026-05-11
-- Source: Trinity (KDD 2024, arxiv:2402.02842) N_M=10 retrieval + PinnerSage
-- (KDD 2020, arxiv:2007.03634) recency-weighted per-cluster user vectors.
--
-- Replaces the broken `trinity-m-tier1` + `trinity-m-tier2` pools that
-- consistently return 0 articles (P2 from prod audit on test user
-- 5082a1df-...). Top-3 primaries were starved despite high histogram weight
-- because trinityM secondary-cluster sampling was too narrow.
--
-- New retrieval: for each of the user's top-10 primary clusters, compute a
-- per-primary user vector (recency-weighted mean of engaged-article
-- embeddings in that primary) and run pgvector cosine ANN against fresh
-- articles in that primary.
--
-- Two RPCs:
--   1. user_engagement_buffer(user_id, limit) — fetches the engagement-filtered
--      buffer (read_complete OR save OR share OR like OR revisit OR
--      more_like_this) joined with article embedding + vq_primary + age_days.
--      Locked size: 1000 items (Trinity uses 2500 for video, we scale down
--      for text-feed throughput; spec section 3.2).
--   2. articles_ann_in_primary(user_vec, vq_primary, exclude_ids, hours, score,
--      limit) — pgvector cosine ANN restricted to one primary. Uses the
--      existing HNSW index on embedding_minilm_vec (mig 020).

-- ---------------------------------------------------------------------------
-- 1. user_engagement_buffer
-- ---------------------------------------------------------------------------
-- read_complete is server-derived here as a 0.7× threshold on view_seconds /
-- expected_read_seconds (Kuaishou WTG, arXiv:2308.13249 — spec section 4.4).
-- When iOS eventually emits an explicit article_read_complete event_type,
-- add it to the IN clause and drop the dwell branch.
CREATE OR REPLACE FUNCTION public.user_engagement_buffer(
  p_user_id uuid,
  p_limit int DEFAULT 1000
) RETURNS TABLE (
  article_id        bigint,
  vq_primary        int,
  embedding_minilm_vec vector(384),
  age_days          double precision,
  event_type        text
) LANGUAGE sql STABLE AS $$
  SELECT
    uae.article_id,
    pa.vq_primary,
    pa.embedding_minilm_vec,
    EXTRACT(EPOCH FROM (NOW() - uae.created_at)) / 86400.0 AS age_days,
    uae.event_type
  FROM public.user_article_events uae
  JOIN public.published_articles pa ON pa.id = uae.article_id
  WHERE uae.user_id = p_user_id
    AND uae.article_id IS NOT NULL
    AND pa.embedding_minilm_vec IS NOT NULL
    AND pa.vq_primary IS NOT NULL
    AND (
      uae.event_type IN (
        'article_liked', 'article_saved', 'article_shared',
        'article_revisit', 'article_more_like_this'
      )
      OR (
        uae.event_type = 'article_engaged'
        AND uae.view_seconds IS NOT NULL
        AND uae.view_seconds >= 0.7 * COALESCE(pa.expected_read_seconds, 30)
      )
    )
  ORDER BY uae.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.user_engagement_buffer(uuid, int) TO authenticated, service_role, anon;

-- ---------------------------------------------------------------------------
-- 2. articles_ann_in_primary
-- ---------------------------------------------------------------------------
-- Returns the same column set Trinity's other retrievers use. Cosine distance
-- ordering via the HNSW index (mig 020). Bounded primary + recency + score
-- filter keep the ANN candidate set small and the index hot.
--
-- excluded_ids takes precedence over recency: if iOS sends a seen_id from a
-- concurrent in-flight request, we drop it here even if it's < hours_window.
CREATE OR REPLACE FUNCTION public.articles_ann_in_primary(
  p_user_vec      vector(384),
  p_vq_primary    int,
  p_exclude_ids   bigint[] DEFAULT NULL,
  p_hours_window  int DEFAULT 48,
  p_min_score     int DEFAULT 200,
  p_limit         int DEFAULT 20
) RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           int,
  vq_primary               int,
  vq_secondary             int,
  embedding_minilm_vec     vector(384),
  image_url                text,
  image_source             text,
  source                   text,
  url                      text,
  expected_read_seconds    int,
  created_at               timestamptz,
  published_at             timestamptz,
  components_order         jsonb,
  components               jsonb,
  details                  jsonb,
  timeline                 jsonb,
  graph                    jsonb,
  map                      jsonb,
  five_ws                  jsonb,
  countries                jsonb,
  topics                   jsonb,
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
  ann_similarity           double precision
) LANGUAGE sql STABLE AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name,
    (1.0 - (pa.embedding_minilm_vec <=> p_user_vec))::double precision AS ann_similarity
  FROM public.published_articles pa
  WHERE pa.vq_primary = p_vq_primary
    AND pa.created_at >= NOW() - (p_hours_window || ' hours')::interval
    AND pa.ai_final_score >= p_min_score
    AND pa.embedding_minilm_vec IS NOT NULL
    AND (p_exclude_ids IS NULL OR NOT (pa.id = ANY(p_exclude_ids)))
  ORDER BY pa.embedding_minilm_vec <=> p_user_vec
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.articles_ann_in_primary(vector, int, bigint[], int, int, int) TO authenticated, service_role, anon;

-- ---------------------------------------------------------------------------
-- Verification queries (manual, post-apply):
--   SELECT COUNT(*) FROM user_engagement_buffer('5082a1df-...'::uuid, 1000);
--   SELECT id, vq_primary, ann_similarity FROM articles_ann_in_primary(
--     '[0.1, 0.2, ...]'::vector(384), 39, NULL, 48, 200, 20
--   ) LIMIT 5;
-- ---------------------------------------------------------------------------

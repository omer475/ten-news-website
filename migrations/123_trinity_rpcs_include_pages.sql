-- Migration 123: add pages/format/source_type to the 3 Trinity retriever RPCs
-- ==========================================================================
-- ROOT CAUSE of "multi-page articles render as single page": the feed's
-- retriever tiers fetch articles through Postgres RPCs whose RETURNS TABLE /
-- SELECT column lists did NOT include `pages` (nor format/source_type). So
-- curated multi-page articles came back without pages and the iOS carousel
-- never triggered. (The JS .select() lists in trinity.js/trinityServe.js were
-- fallback paths.) Adding the 3 columns to all 3 RPCs. Columns inserted AFTER
-- author_name to keep RETURNS-TABLE order aligned with the SELECT.

CREATE OR REPLACE FUNCTION public.retrieve_followed_with_seen_dedup(p_user_id uuid, p_publisher_ids uuid[], p_only_primaries integer[] DEFAULT NULL::integer[], p_hours_window integer DEFAULT 168, p_min_score integer DEFAULT 200, p_limit integer DEFAULT 30, p_dedup_days integer DEFAULT 2)
 RETURNS TABLE(id bigint, title_news text, summary_bullets_news jsonb, category text, ai_final_score integer, vq_primary smallint, vq_secondary smallint, embedding_minilm_vec vector, image_url text, image_source text, source text, url text, expected_read_seconds integer, created_at timestamp with time zone, published_at timestamp with time zone, components_order text[], components text[], details jsonb, timeline jsonb, graph jsonb, map jsonb, five_ws jsonb, countries text[], topics text[], interest_tags jsonb, country_relevance jsonb, topic_relevance jsonb, cluster_id bigint, emoji text, num_sources integer, freshness_category text, shelf_life_days integer, author_id uuid, author_name text, pages jsonb, format text, source_type text, seen_count integer)
 LANGUAGE sql
 STABLE
AS $function$
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
    pa.author_name, pa.pages, pa.format, pa.source_type,
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
$function$;

CREATE OR REPLACE FUNCTION public.trinity_fetch_cluster_with_seencount(p_user_id uuid, p_vq_secondary smallint, p_hours_window integer DEFAULT 168, p_min_score real DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, title_news text, summary_bullets_news jsonb, category text, ai_final_score real, vq_primary smallint, vq_secondary smallint, embedding_minilm_vec vector, image_url text, image_source text, source text, url text, expected_read_seconds integer, created_at timestamp with time zone, published_at timestamp with time zone, components_order text[], components text[], details jsonb, timeline jsonb, graph jsonb, map jsonb, five_ws jsonb, countries text[], topics text[], interest_tags jsonb, country_relevance jsonb, topic_relevance jsonb, cluster_id bigint, emoji text, num_sources integer, freshness_category text, shelf_life_days integer, author_id uuid, author_name text, pages jsonb, format text, source_type text, seen_count integer, last_engaged_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, pa.pages, pa.format, pa.source_type, COALESCE(seen.cnt, 0)::int AS seen_count,
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
$function$;

CREATE OR REPLACE FUNCTION public.trinity_fetch_fresh_with_seencount(p_user_id uuid, p_vq_primaries smallint[], p_hours_window integer DEFAULT 48, p_min_score real DEFAULT 500, p_limit integer DEFAULT 80)
 RETURNS TABLE(id bigint, title_news text, summary_bullets_news jsonb, category text, ai_final_score real, vq_primary smallint, vq_secondary smallint, embedding_minilm_vec vector, image_url text, image_source text, source text, url text, expected_read_seconds integer, created_at timestamp with time zone, published_at timestamp with time zone, components_order text[], components text[], details jsonb, timeline jsonb, graph jsonb, map jsonb, five_ws jsonb, countries text[], topics text[], interest_tags jsonb, country_relevance jsonb, topic_relevance jsonb, cluster_id bigint, emoji text, num_sources integer, freshness_category text, shelf_life_days integer, author_id uuid, author_name text, pages jsonb, format text, source_type text, seen_count integer, last_engaged_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.components, pa.details, pa.timeline,
    pa.graph, pa.map, pa.five_ws, pa.countries, pa.topics, pa.interest_tags,
    pa.country_relevance, pa.topic_relevance, pa.cluster_id, pa.emoji,
    pa.num_sources, pa.freshness_category, pa.shelf_life_days, pa.author_id,
    pa.author_name, pa.pages, pa.format, pa.source_type, COALESCE(seen.cnt, 0)::int AS seen_count,
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
$function$;

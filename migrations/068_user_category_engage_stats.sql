-- Phase 10.5: per-category engagement-rate aggregation function.
--
-- Used by the feed handler to compute a per-user, per-category multiplier
-- that down-weights articles in categories the user systematically skips
-- but doesn't have enough single-tag negative signal to trigger the
-- Phase 10.4 entity-level veto.
--
-- Joins user_feed_impressions × user_article_events × published_articles
-- and returns per-category engagement counts. Filtered to categories
-- with at least p_min_total impressions to avoid noisy small samples.
--
-- The handler does the multiplier calculation client-side from these
-- values; the RPC just does the aggregation.

CREATE OR REPLACE FUNCTION public.user_category_engage_stats(
  p_user_id uuid,
  p_days integer DEFAULT 30,
  p_min_total integer DEFAULT 100
)
RETURNS TABLE (
  category text,
  total_impressions integer,
  engaged integer,
  engage_rate numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH imp AS (
    SELECT fi.id AS impression_id, pa.category, fi.created_at
    FROM public.user_feed_impressions fi
    JOIN public.published_articles pa ON pa.id = fi.article_id
    WHERE fi.user_id = p_user_id
      AND fi.created_at > now() - (p_days || ' days')::interval
  ),
  imp_engaged AS (
    SELECT DISTINCT ON (i.impression_id) i.impression_id, i.category
    FROM imp i
    JOIN public.user_article_events ev
      ON ev.user_id = p_user_id
     AND ev.article_id = (SELECT article_id FROM public.user_feed_impressions WHERE id = i.impression_id)
     AND ev.event_type IN ('article_engaged', 'article_liked', 'article_saved',
                           'article_shared', 'article_detail_view', 'article_revisit')
     AND ev.created_at >= i.created_at
     AND ev.created_at < i.created_at + interval '30 minutes'
  )
  SELECT
    i.category::text AS category,
    COUNT(*)::integer AS total_impressions,
    COUNT(ie.impression_id)::integer AS engaged,
    ROUND(COUNT(ie.impression_id)::numeric / COUNT(*)::numeric, 4) AS engage_rate
  FROM imp i
  LEFT JOIN imp_engaged ie ON ie.impression_id = i.impression_id
  GROUP BY i.category
  HAVING COUNT(*) >= p_min_total;
$$;

COMMENT ON FUNCTION public.user_category_engage_stats(uuid, integer, integer) IS
  'Per-category engagement rate for a user over the last N days. Returns categories with >= p_min_total impressions. Used by feed/main.js Phase 10.5 category multiplier.';

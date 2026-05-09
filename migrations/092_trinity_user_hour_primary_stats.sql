-- Migration 092 — Phoenix Phase 6.B. Per-user hour-of-day primary engagement.
--
-- Source: Long-Term Interest Clock (LIC, arxiv:2501.15817), Douyin live
-- deployment +0.122% active days. Time-of-day interests vary (8am vs 10pm,
-- weekday vs weekend). For text content: K-pop fans peak at night, NFL
-- Monday morning, work-news at 9am.
--
-- Returns the user's per-primary engagement at a specific hour of UTC.
-- Caller (trinityServe.js loadHourPrimaryBoosts) computes a small
-- multiplier per primary based on engagement-rate-relative-to-baseline.
-- Cold-start: <5 events at hour → no signal, return empty.

CREATE OR REPLACE FUNCTION public.user_hour_primary_stats(
  p_user_id     uuid,
  p_hour_of_day int,
  p_days_back   int DEFAULT 21,
  p_min_total   int DEFAULT 5
)
RETURNS TABLE (vq_primary smallint, hour_engage int, hour_total int, engage_rate real)
LANGUAGE sql
STABLE
AS $$
  WITH events_at_hour AS (
    SELECT a.vq_primary, e.event_type
    FROM public.user_article_events e
    JOIN public.published_articles a ON a.id = e.article_id
    WHERE e.user_id = p_user_id
      AND a.vq_primary IS NOT NULL
      AND e.created_at > NOW() - make_interval(days => p_days_back)
      AND EXTRACT(HOUR FROM e.created_at AT TIME ZONE 'UTC') = p_hour_of_day
  ),
  per_primary AS (
    SELECT vq_primary,
           COUNT(*) FILTER (WHERE event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit','article_detail_view'))::int AS engs,
           COUNT(*)::int AS total
    FROM events_at_hour
    GROUP BY vq_primary
  )
  SELECT vq_primary,
         engs AS hour_engage,
         total AS hour_total,
         (engs::real / NULLIF(total, 0))::real AS engage_rate
  FROM per_primary
  WHERE total >= p_min_total;
$$;

COMMENT ON FUNCTION public.user_hour_primary_stats IS
  'Phoenix Phase 6.B (LIC-lite). Per-user, per-hour-of-day, per-primary engagement-rate. Used for time-conditioned slate boost during rerank.';

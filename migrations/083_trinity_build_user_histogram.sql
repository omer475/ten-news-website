-- Migration 083 — Phoenix Phase 1.8. Server-side histogram builder.
--
-- Why: PostgREST's default max-rows is 1000. The Phase 1.6 JS-side
-- loader with .limit(30000) was silently capped at 1000 — power users
-- with 16K+ events never had their long-term taste reflected
-- (qualifyingCount stuck at ~942). The Phase 1.7 Float64 fix exposed
-- the symptom: histogram showed fractional sums, but only ~1000 events
-- ever made it to the loop.
--
-- This RPC does the entire histogram aggregation in Postgres:
--   * Joins user_article_events × published_articles
--   * Mirrors engagementWeight() from lib/trinity.js exactly
--   * Applies exponential time decay (HISTOGRAM_HALFLIFE_DAYS = 30)
--   * Returns aggregated (vq_primary, vq_secondary, weight_sum)
-- One round-trip, no row cap.

CREATE OR REPLACE FUNCTION public.trinity_build_histogram(
  p_user_id        uuid,
  p_halflife_days  real    DEFAULT 30,
  p_max_events     int     DEFAULT 30000
)
RETURNS TABLE (
  vq_primary       smallint,
  vq_secondary     smallint,
  weight_sum       double precision,
  qualifying_count int,
  is_not_interested boolean,
  ev_within_48h    boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  now_ms      double precision := EXTRACT(EPOCH FROM NOW()) * 1000;
  halflife_ms double precision := p_halflife_days * 86400 * 1000;
BEGIN
  RETURN QUERY
  WITH events AS (
    SELECT
      e.event_type, e.view_seconds, e.metadata, e.created_at,
      a.vq_primary, a.vq_secondary, a.expected_read_seconds,
      EXTRACT(EPOCH FROM e.created_at) * 1000 AS ev_ms
    FROM public.user_article_events e
    JOIN public.published_articles a ON a.id = e.article_id
    WHERE e.user_id = p_user_id
      AND a.vq_primary IS NOT NULL AND a.vq_secondary IS NOT NULL
    ORDER BY e.created_at DESC
    LIMIT p_max_events
  ),
  weighted AS (
    SELECT
      ev.vq_primary, ev.vq_secondary, ev.event_type, ev.created_at, ev.ev_ms,
      CASE
        WHEN ev.event_type = 'article_not_interested' THEN -2.0
        WHEN ev.event_type IN ('article_liked','article_saved','article_shared','article_revisit','article_detail_view') THEN 1.5
        ELSE
          CASE
            WHEN COALESCE(ev.view_seconds, 0) > 0
              OR (ev.metadata->>'dwell') IS NOT NULL AND (ev.metadata->>'dwell')::float > 0
              OR (ev.metadata->>'total_active_seconds') IS NOT NULL AND (ev.metadata->>'total_active_seconds')::float > 0
            THEN
              CASE
                WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) >= 25.0 THEN 1.5
                WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) >= 12.0 THEN 1.0
                WHEN ev.expected_read_seconds IS NULL OR ev.expected_read_seconds <= 0 THEN
                  CASE
                    WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) < 1.0 THEN -0.5
                    WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) < 3.0 THEN -0.2
                    WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) < 6.0 THEN 0.1
                    ELSE 0.5
                  END
                ELSE
                  CASE
                    WHEN (COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) / ev.expected_read_seconds) < 0.05 THEN -0.5
                    WHEN (COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) / ev.expected_read_seconds) < 0.20 THEN -0.2
                    WHEN (COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) / ev.expected_read_seconds) < 0.50 THEN 0.1
                    WHEN (COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) / ev.expected_read_seconds) < 1.00 THEN 0.5
                    ELSE 1.0
                  END
              END
            ELSE 0
          END
      END AS w
    FROM events ev
  ),
  with_decay AS (
    SELECT
      w.vq_primary, w.vq_secondary, w.event_type, w.created_at,
      w.w * power(0.5, GREATEST(0, now_ms - w.ev_ms) / halflife_ms) AS weighted
    FROM weighted w
    WHERE w.w <> 0
  )
  SELECT
    wd.vq_primary, wd.vq_secondary,
    SUM(wd.weighted)::double precision AS weight_sum,
    COUNT(*)::int AS qualifying_count,
    bool_or(wd.event_type = 'article_not_interested') AS is_not_interested,
    bool_or(wd.event_type = 'article_not_interested' AND wd.created_at > NOW() - interval '48 hours') AS ev_within_48h
  FROM with_decay wd
  GROUP BY wd.vq_primary, wd.vq_secondary;
END;
$$;

COMMENT ON FUNCTION public.trinity_build_histogram IS
  'Phoenix Phase 1.8. Server-side time-decayed histogram builder. Bypasses PostgREST max-rows cap so power users with 16K+ events get their full lifetime taste reflected.';

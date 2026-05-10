-- Migration 103 — Phase 1.3 (TikTok mirror plan).
-- New RPC: user_median_dwell_by_primary. Returns the user's median dwell-
-- seconds per vq_primary across the last N days, filtered by a min event
-- count to avoid noise from one-off long-dwell outliers.
--
-- Used by lib/trinityServe.js loadUserMedianDwellByPrimary → dwellMult in
-- rerank(). This is the Phase 1.3 home for watch-time dominance: a candidate
-- whose primary the user reads DEEPLY gets a boost; a candidate whose
-- primary the user only TAPS gets a demotion.

CREATE OR REPLACE FUNCTION public.user_median_dwell_by_primary(
  p_user_id    uuid,
  p_days_back  int DEFAULT 30,
  p_min_events int DEFAULT 5
)
RETURNS TABLE (
  vq_primary    smallint,
  median_dwell  real,
  event_count   int
)
LANGUAGE sql
STABLE
AS $$
  WITH events AS (
    SELECT
      a.vq_primary,
      COALESCE(
        NULLIF(e.view_seconds, 0)::float,
        (e.metadata->>'dwell')::float,
        (e.metadata->>'total_active_seconds')::float,
        0
      ) AS dwell
    FROM public.user_article_events e
    JOIN public.published_articles a ON a.id = e.article_id
    WHERE e.user_id = p_user_id
      AND a.vq_primary IS NOT NULL
      AND e.created_at > NOW() - make_interval(days => p_days_back)
      -- Only include events that have a meaningful dwell signal. Skip pure
      -- explicit events (like/save/share) that don't carry dwell metadata.
      AND (
        COALESCE(e.view_seconds, 0) > 0
        OR (e.metadata->>'dwell') IS NOT NULL
        OR (e.metadata->>'total_active_seconds') IS NOT NULL
      )
  )
  SELECT
    e.vq_primary,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY e.dwell)::real AS median_dwell,
    COUNT(*)::int AS event_count
  FROM events e
  GROUP BY e.vq_primary
  HAVING COUNT(*) >= p_min_events;
$$;

COMMENT ON FUNCTION public.user_median_dwell_by_primary IS
  'Phase 1.3 (2026-05-10). Per-primary median dwell for a user, last N days, min M events. Feeds dwellMult in rerank() so deep-read clusters get a ranker boost without polluting the histogram.';

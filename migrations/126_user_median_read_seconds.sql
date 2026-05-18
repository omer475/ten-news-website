-- Migration 126 — PR3 (2026-05-18) — Reading-time fit RPC.
--
-- New RPC: user_median_read_seconds. Returns the user's median read-seconds
-- across the last N days, filtered by a minimum event count to avoid noise.
-- Scalar (not per-primary) because the multiplier in rerank() penalizes
-- articles whose expected_read_seconds deviates from the user's typical
-- session-length, regardless of topic.
--
-- Used by lib/trinityServe.js loadUserMedianReadSeconds → readTimeFit in
-- rerank(). A user whose median read is ~60s and gets served a 300s
-- long-form piece has read-time fit ≈ 0.6× (multiplier floor).
--
-- Returns NULL when n < p_min_events (signal too thin). The loader treats
-- NULL as "no penalty" — readTimeFit defaults to 1.0.
--
-- Bounds: 5 < view_seconds < 600. Excludes instant-skips (no real read)
-- and obvious idle/AFK readings (>10min on a single article = phone left
-- open). Mirrors the dwell-bug-fix bounds from migration 119.
--
-- Pattern: mirrors migration 103 (user_median_dwell_by_primary, dropped in
-- mig 107). Same percentile_cont / event-count gate / 30-day window.
--
-- Source: This pattern (user-specific reading-time match) is NOT in TikTok
-- / X / Instagram public algorithm docs because their content format
-- (video/photo) doesn't have a meaningful "expected read time" dimension.
-- Text-social specific opportunity.

CREATE OR REPLACE FUNCTION public.user_median_read_seconds(
  p_user_id     uuid,
  p_days_back   int DEFAULT 30,
  p_min_events  int DEFAULT 20
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH events AS (
    SELECT COALESCE(
      NULLIF(e.view_seconds, 0)::float,
      (e.metadata->>'dwell')::float,
      (e.metadata->>'total_active_seconds')::float,
      0
    ) AS read_seconds
    FROM public.user_article_events e
    WHERE e.user_id = p_user_id
      AND e.created_at > NOW() - make_interval(days => p_days_back)
      AND (
        COALESCE(e.view_seconds, 0) > 0
        OR (e.metadata->>'dwell') IS NOT NULL
        OR (e.metadata->>'total_active_seconds') IS NOT NULL
      )
  ),
  bounded AS (
    SELECT read_seconds
    FROM events
    WHERE read_seconds BETWEEN 5 AND 600
  )
  SELECT CASE
    WHEN COUNT(*) >= p_min_events
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY read_seconds)::numeric
    ELSE NULL
  END
  FROM bounded;
$$;

COMMENT ON FUNCTION public.user_median_read_seconds IS
  'PR3 (2026-05-18). Scalar median read-seconds for a user across last N days. Feeds readTimeFit multiplier in rerank() so articles whose expected_read_seconds is far from the user''s typical session-length get a Gaussian penalty. Returns NULL when n < min_events.';

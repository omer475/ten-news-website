-- Migration 097 — Phoenix Phase 9.C.2. Watch-time weights bumped to dominate.
--
-- Source: TikTok Algo 101 leak (NYT 2021) score formula:
--   score = P_like·V_like + P_comment·V_comment + E_playtime·V_playtime + P_play·V_play
-- Industry consensus on V values (Buffer 2025, Fanpage Karma 2025):
--   * watch_time / completion ≈ 40-50% of total weight
--   * share ≈ 3× like
--   * save ≈ share
--   * comment > like
--   * like = floor signal
--
-- Old (mig 084): dwell ≥ 25s → 1.5 (equal to like), dwell ≥ 12s → 1.0.
-- This makes a 25-second read worth the SAME as a tap-and-forget like.
-- For a TikTok-aligned ranker, watch_time should DOMINATE the histogram.
--
-- New:
--   dwell ≥ 25s → 5.0  (~3× share=4.0, dominant signal)
--   dwell ≥ 12s → 2.5  (between like and revisit)
--   dwell <12s read-fraction tiers: unchanged
--   explicit-positive weights (share/save/revisit/detail_view/like): unchanged
--
-- Effect for the test user: primary 39 (AI/Tech) — they read AI deeply
-- (avg dwell 17s with many 25s+ reads). Primary 224 (Yahoo Finance) — they
-- tap briefly (avg dwell ~6s). Old rule: both look similar in histogram.
-- New rule: primary 39 dominates because deep reading dominates light taps.
-- This realigns h¹ with what the user ACTUALLY reads vs. what they brush by.

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
        WHEN ev.event_type = 'article_not_interested' THEN -3.0
        WHEN ev.event_type = 'article_shared'       THEN 4.0
        WHEN ev.event_type = 'article_saved'        THEN 3.0
        WHEN ev.event_type = 'article_revisit'      THEN 2.5
        WHEN ev.event_type = 'article_detail_view'  THEN 2.0
        WHEN ev.event_type = 'article_liked'        THEN 1.5
        ELSE
          CASE
            WHEN COALESCE(ev.view_seconds, 0) > 0
              OR (ev.metadata->>'dwell') IS NOT NULL AND (ev.metadata->>'dwell')::float > 0
              OR (ev.metadata->>'total_active_seconds') IS NOT NULL AND (ev.metadata->>'total_active_seconds')::float > 0
            THEN
              CASE
                -- Phoenix Phase 9.C.2: dominant watch-time weights.
                WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) >= 25.0 THEN 5.0
                WHEN COALESCE(NULLIF(ev.view_seconds,0)::float, (ev.metadata->>'dwell')::float, (ev.metadata->>'total_active_seconds')::float, 0) >= 12.0 THEN 2.5
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
  'Phoenix Phase 9.C.2 (2026-05-09). Watch-time weights bumped to dominate: dwell>=25s -> 5.0, dwell>=12s -> 2.5. Aligns histogram with TikTok industry-consensus where watch_time is 40-50% of ranker score. Replaces previous 1.5/1.0 from migration 084 which made dwell equal to like.';

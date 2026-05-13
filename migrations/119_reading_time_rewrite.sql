-- Migration 119 — Reading-time rewrite + event weight rebalance + dwell-bug fix.
--
-- Replaces trinity_build_histogram (last touched by migration 084 — Phoenix
-- Phase 3.A effort-weighted positives) with a substantially-bumped weight
-- ladder and a fixed CASE ordering.
--
-- Three changes versus mig 084:
--
--   1. Hard 3-second floor. Any event with dwell < 3 seconds is a hard
--      negative regardless of article length. The percentage path never
--      fires for short dwells. Matches Kuaishou WTG's GVV definition
--      (arxiv:2308.13249 §2.1 Table 1: "Watch time < 3 seconds" = Glance
--      Video Viewing, the canonical fast-skip).
--
--   2. Percentage path runs BEFORE raw-seconds fallback when
--      expected_read_seconds is known. Fixes the bug where a 25-second
--      dwell on a 5-minute article scored +1.5 (full-read level) via
--      the raw-seconds branch instead of being correctly scored as an
--      8%-completion skim. The old CASE checked
--      `WHEN view_seconds >= 25.0 THEN 1.5` BEFORE the percentage path,
--      short-circuiting completion-based scoring entirely.
--
--   3. Larger magnitudes both directions. Reading became the strongest
--      single signal on the platform — a full read is now worth more than
--      a share. Industry anchor: X's GoodClick = +11 in additive scoring,
--      ~22× a Like at +0.5. Our new ratios (full read +6 vs Like +0.8 =
--      7.5×) are still conservative versus X but a major lift from the
--      mig 084 ladder where reading capped at +1.5 (= a Like).
--
-- Explicit event weights bumped per the X-style negative-asymmetry pattern
-- (X NegFeedbackV2 = −74 vs Like = +0.5 → ~150× magnitude on negatives):
--   article_liked         1.5 → 0.8   (low-effort tap, X-aligned downscale)
--   article_detail_view   2.0 → 2.5   (source/details tap = curiosity)
--   article_revisit       2.5 → 3.0   (intentional re-engagement)
--   article_saved         3.0 → 3.0   (keep)
--   article_shared        4.0 → 4.0   (keep)
--   article_not_interested −3.0 → −10.0   (3× stronger; still ~7× weaker
--                                          than X's NegFeedbackV2 = −74
--                                          but enough to drown ~10 likes)
--
-- The JS-side mirror lives in lib/signals/weights.js — both must match.
-- Comments in each file point to the other.

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
      EXTRACT(EPOCH FROM e.created_at) * 1000 AS ev_ms,
      -- Canonical dwell pick: view_seconds first, then metadata.dwell, then
      -- metadata.total_active_seconds. Materialized once so the CASE below
      -- doesn't recompute it five times.
      COALESCE(
        NULLIF(e.view_seconds, 0)::float,
        NULLIF((e.metadata->>'dwell'), '')::float,
        NULLIF((e.metadata->>'total_active_seconds'), '')::float,
        0
      ) AS dwell_sec
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
        -- Explicit events use the canonical weight table (mirrored in
        -- lib/signals/weights.js).
        WHEN ev.event_type = 'article_not_interested' THEN -10.0
        WHEN ev.event_type = 'article_shared'         THEN 4.0
        WHEN ev.event_type = 'article_saved'          THEN 3.0
        WHEN ev.event_type = 'article_revisit'        THEN 3.0
        WHEN ev.event_type = 'article_detail_view'    THEN 2.5
        WHEN ev.event_type = 'article_liked'          THEN 0.8

        -- Dwell-classified events (article_skipped / article_view /
        -- article_engaged): use dwell to decide direction and magnitude.
        -- Requires positive dwell to score (zero/null dwell = 0).
        WHEN ev.dwell_sec > 0 THEN
          CASE
            -- Hard floor: <3s is ALWAYS negative, regardless of article length.
            -- Matches Kuaishou WTG GVV definition (arxiv:2308.13249).
            WHEN ev.dwell_sec < 1.0 THEN -3.0
            WHEN ev.dwell_sec < 3.0 THEN -2.0

            -- Percentage path: ≥3s AND expected_read_seconds known.
            -- Bands designed so a full read (+6.0) is worth more than a
            -- share (+4.0) — reading is the strongest consumption signal on
            -- a text platform. Mid-bands match save/revisit value.
            WHEN ev.expected_read_seconds IS NOT NULL
              AND ev.expected_read_seconds > 0 THEN
              CASE
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.05 THEN -2.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.20 THEN -1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.50 THEN  1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.70 THEN  3.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 1.00 THEN  5.0
                ELSE 6.0
              END

            -- Raw-seconds fallback: ≥3s AND no expected_read_seconds known.
            -- Calibrated for a typical text-card length (~30s expected) so
            -- the bands roughly track the percentage path.
            ELSE
              CASE
                WHEN ev.dwell_sec < 6.0  THEN -0.5
                WHEN ev.dwell_sec < 12.0 THEN  1.0
                WHEN ev.dwell_sec < 25.0 THEN  2.5
                ELSE 4.0
              END
          END
        ELSE 0
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
    bool_or(wd.event_type = 'article_not_interested'
            AND wd.created_at > NOW() - interval '48 hours') AS ev_within_48h
  FROM with_decay wd
  GROUP BY wd.vq_primary, wd.vq_secondary;
END;
$$;

COMMENT ON FUNCTION public.trinity_build_histogram IS
  'Mig 119. Histogram with 3s-floor hard negatives, percentage-first scoring path, raw-seconds fallback, and bumped event weights. JS-side mirror in lib/signals/weights.js — keep in sync.';

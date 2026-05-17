-- Migration 124 — Histogram weight cleanup.
--
-- Two changes to trinity_build_histogram:
--
-- 1. DELETE the `article_detail_view` branch. iOS never emits this event
--    (verified: 0 lifetime events across all users in user_article_events).
--    The +2.5 weight was waiting for an event that doesn't exist. The
--    feature was half-built — SQL side done, iOS side never wired up.
--
-- 2. SIMPLIFY the dwell path. Every recent article has expected_read_seconds
--    populated (verified: 2467/2467 = 100% of last 48h articles). The
--    raw-seconds fallback path was dead code. Drop it as defensive code
--    only (fires when expected is NULL on legacy rows).
--
-- The user's rule, made explicit:
--   dwell < 1s            → -3   (instant skip)
--   dwell < 3s            → -2   (quick skip)
--   dwell ≥ 3s, ratio = dwell / expected_read_seconds:
--     ratio < 20%         → -1   (saw it, didn't read)
--     ratio 20%–50%       → +1
--     ratio 50%–70%       → +3
--     ratio 70%–100%      → +5
--     ratio ≥ 100%        → +6   (read past the end)
--
-- Pattern source: Kuaishou WTG (CIKM 2023, arxiv:2308.13249) — read-ratio
-- bands for video watch time. TikTok-style.

CREATE OR REPLACE FUNCTION public.trinity_build_histogram(
  p_user_id uuid,
  p_halflife_days real DEFAULT 30,
  p_max_events integer DEFAULT 30000
)
RETURNS TABLE(
  vq_primary smallint,
  vq_secondary smallint,
  weight_sum double precision,
  qualifying_count integer,
  is_not_interested boolean,
  ev_within_48h boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
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
        -- Explicit action events (override dwell-based weighting).
        WHEN ev.event_type = 'article_not_interested' THEN -10.0
        WHEN ev.event_type = 'article_shared'         THEN  4.0
        WHEN ev.event_type = 'article_saved'          THEN  3.0
        WHEN ev.event_type = 'article_revisit'        THEN  3.0
        -- 2026-05-17 (mig 124): article_detail_view branch removed.
        -- iOS never emitted this event (0 lifetime occurrences).
        WHEN ev.event_type = 'article_liked'          THEN  0.8

        -- Dwell-based weighting (covers article_engaged / article_view /
        -- article_skipped where the event type alone isn't enough).
        WHEN ev.dwell_sec > 0 THEN
          CASE
            -- Hard skip: always negative, regardless of expected_read_seconds.
            WHEN ev.dwell_sec < 1.0 THEN -3.0
            WHEN ev.dwell_sec < 3.0 THEN -2.0

            -- ≥3s: prefer read-ratio against expected_read_seconds.
            -- Every recent article has expected_read_seconds populated by
            -- the pipeline; the ELSE branch is defensive for legacy NULL rows.
            WHEN ev.expected_read_seconds IS NOT NULL
              AND ev.expected_read_seconds > 0 THEN
              CASE
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.20 THEN -1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.50 THEN  1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.70 THEN  3.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 1.00 THEN  5.0
                ELSE 6.0
              END

            -- Defensive: rows without expected_read_seconds fall back to
            -- absolute-seconds bands. Should be rare (0 of 2467 recent
            -- articles missed it as of 2026-05-17).
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
$function$;

COMMENT ON FUNCTION public.trinity_build_histogram IS
  'Build user histogram h1/h2 from user_article_events. Event weights from migration 119 + cleanup 124. Decay half-life 30 days. Dwell ≥3s uses ratio bands against expected_read_seconds (Kuaishou WTG style).';

-- Migration 125 — Add weight_sum_strong column to trinity_build_histogram.
--
-- Background: the long-tail pool (trinityLT in lib/trinity.js) qualifies any
-- secondary cluster where h2[c] ≥ 3. The h2 array is built from
-- weight_sum which counts EVERY positive event — including 6-second dwells
-- (+1 weight each). Three such dwells over a user's lifetime is enough to
-- qualify a cluster as a "forgotten interest" and serve it from LT.
--
-- This means a single year-old slow-scroll past 3 NBA cards keeps NBA
-- qualifying for the LT pool forever. Audit (2026-05-17 session):
-- LT served 5 Sports cards from primaries 26/30/70/78/108 — none of which
-- the user actually engages with.
--
-- TikTok Trinity paper (KDD 2024, arxiv:2402.02842) §3 specifies:
--   "the sequence only stores item IDs that playtime ≥ 10s or have been
--   finished or interacted (upvote/follow/share/comment)."
--
-- We apply the same filter to our histogram via a NEW column
-- `weight_sum_strong` that only sums:
--   * Explicit positive actions: liked, saved, shared, revisit
--   * Long reads: dwell ≥ 3s AND read-ratio ≥ 50%
--
-- The existing `weight_sum` still includes everything — used by personal
-- and fresh pools (h1, h2). LT switches to weight_sum_strong via h2_strong
-- in the JS layer. Threshold T_L=3 unchanged (Trinity paper value).

DROP FUNCTION IF EXISTS public.trinity_build_histogram(uuid, real, integer);

CREATE OR REPLACE FUNCTION public.trinity_build_histogram(
  p_user_id uuid,
  p_halflife_days real DEFAULT 30,
  p_max_events integer DEFAULT 30000
)
RETURNS TABLE(
  vq_primary smallint,
  vq_secondary smallint,
  weight_sum double precision,
  weight_sum_strong double precision,
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
      -- w: full weight including brief dwells (migration 124 logic).
      CASE
        WHEN ev.event_type = 'article_not_interested' THEN -10.0
        WHEN ev.event_type = 'article_shared'         THEN  4.0
        WHEN ev.event_type = 'article_saved'          THEN  3.0
        WHEN ev.event_type = 'article_revisit'        THEN  3.0
        WHEN ev.event_type = 'article_liked'          THEN  0.8
        WHEN ev.dwell_sec > 0 THEN
          CASE
            WHEN ev.dwell_sec < 1.0 THEN -3.0
            WHEN ev.dwell_sec < 3.0 THEN -2.0
            WHEN ev.expected_read_seconds IS NOT NULL
              AND ev.expected_read_seconds > 0 THEN
              CASE
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.20 THEN -1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.50 THEN  1.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.70 THEN  3.0
                WHEN (ev.dwell_sec / ev.expected_read_seconds) < 1.00 THEN  5.0
                ELSE 6.0
              END
            ELSE
              CASE
                WHEN ev.dwell_sec < 6.0  THEN -0.5
                WHEN ev.dwell_sec < 12.0 THEN  1.0
                WHEN ev.dwell_sec < 25.0 THEN  2.5
                ELSE 4.0
              END
          END
        ELSE 0
      END AS w,
      -- w_strong: TikTok Trinity §3 — only count explicit actions OR
      -- long reads (ratio >= 0.50). Brief positive dwells excluded.
      CASE
        WHEN ev.event_type = 'article_shared'  THEN 4.0
        WHEN ev.event_type = 'article_saved'   THEN 3.0
        WHEN ev.event_type = 'article_revisit' THEN 3.0
        WHEN ev.event_type = 'article_liked'   THEN 0.8
        WHEN ev.dwell_sec >= 3.0
          AND ev.expected_read_seconds IS NOT NULL
          AND ev.expected_read_seconds > 0
          AND (ev.dwell_sec / ev.expected_read_seconds) >= 0.50 THEN
          CASE
            WHEN (ev.dwell_sec / ev.expected_read_seconds) < 0.70 THEN 3.0
            WHEN (ev.dwell_sec / ev.expected_read_seconds) < 1.00 THEN 5.0
            ELSE 6.0
          END
        ELSE 0
      END AS w_strong
    FROM events ev
  ),
  with_decay AS (
    SELECT
      w.vq_primary, w.vq_secondary, w.event_type, w.created_at,
      w.w        * power(0.5, GREATEST(0, now_ms - w.ev_ms) / halflife_ms) AS weighted,
      w.w_strong * power(0.5, GREATEST(0, now_ms - w.ev_ms) / halflife_ms) AS weighted_strong
    FROM weighted w
    WHERE w.w <> 0 OR w.w_strong <> 0
  )
  SELECT
    wd.vq_primary, wd.vq_secondary,
    SUM(wd.weighted)::double precision        AS weight_sum,
    SUM(wd.weighted_strong)::double precision AS weight_sum_strong,
    COUNT(*)::int AS qualifying_count,
    bool_or(wd.event_type = 'article_not_interested') AS is_not_interested,
    bool_or(wd.event_type = 'article_not_interested'
            AND wd.created_at > NOW() - interval '48 hours') AS ev_within_48h
  FROM with_decay wd
  GROUP BY wd.vq_primary, wd.vq_secondary;
END;
$function$;

COMMENT ON FUNCTION public.trinity_build_histogram IS
  'Build user histogram h1/h2 from user_article_events. Returns weight_sum (all weighted events) AND weight_sum_strong (only explicit actions + long reads, ratio >= 50%). LT pool reads weight_sum_strong via h2_strong (Trinity paper §3 quality filter). Personal + fresh use weight_sum.';

COMMENT ON COLUMN public.user_article_events.event_type IS
  'Event types: article_engaged | article_view | article_skipped | article_liked | article_saved | article_shared | article_revisit | article_not_interested | article_exit | (others not consumed by histogram build).';

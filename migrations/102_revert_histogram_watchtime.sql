-- Migration 102 — Phase 1.3 (TikTok mirror plan).
-- REVERTS migration 097 (Phoenix Phase 9.C.2). Watch-time dominance moves
-- from the histogram to the ranker.
--
-- Why: mig 097 bumped dwell>=25s → 5.0 and dwell>=12s → 2.5 in
-- trinity_build_histogram. This conflated *what cluster* the user is
-- interested in (h¹ signal — interest distribution) with *how intensely*
-- they engage (per-cluster magnitude). A user with one extremely deep
-- read (40s) on cluster X had h¹[X] dominate over a cluster they tap 20×
-- at 8s each. That narrows the user to a single deep-read niche.
--
-- TikTok's actual playtime dominance lives in the ranker score formula:
--   score = P_like·V_like + P_comment·V_comment + E_playtime·V_playtime + P_play·V_play
-- (Algo 101 leak). E_playtime is a per-(user, item, context) prediction
-- multiplied by a value weight, not a fixed weight in the user's
-- INTEREST representation.
--
-- This migration restores the mig-084 weights (1.5 / 1.0) for the
-- histogram. The dwell-vs-skim distinction is now applied as a `dwellMult`
-- term in lib/trinityServe.js rerank(), using a user_median_dwell_by_primary
-- map (migration 103) so candidates from clusters where the user reads
-- deeply get a multiplicative boost in the *ranker*, where it belongs.
--
-- Effect: histogram becomes an interest distribution again. Ranker
-- preference for deep-read clusters survives via dwellMult.

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
                -- Phase 1.3 (2026-05-10): reverted mig 097's 5.0/2.5 to
                -- mig 084's 1.5/1.0. Watch-time dominance now lives in the
                -- ranker (dwellMult term), not the histogram.
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
  'Phase 1.3 (2026-05-10). Histogram weights restored to mig-084 baseline (dwell>=25s -> 1.5, dwell>=12s -> 1.0). Reverts mig 097 5.0/2.5 bump. Watch-time dominance now lives in lib/trinityServe.js rerank() as dwellMult term, sourced from user_median_dwell_by_primary RPC (mig 103).';

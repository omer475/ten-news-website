-- Migration 091 — Phoenix Phase 7.C. Time-decayed Beta cron RPC.
--
-- Purpose: stale clusters (no engagement for weeks/months) shouldn't
-- dominate the explore-arm Beta posterior forever. A cluster with
-- explore_engages=50, explore_shows=200 from 6 months ago has a Beta
-- posterior of (50.5, 154.5) — high mean engage rate, "great cluster!"
-- But maybe everyone moved on and that cluster's content is now stale.
-- Without decay, the bandit keeps preferring it.
--
-- Daily cron multiplies both counters by γ=0.97/day. Half-life ~23 days.
-- After 30 days unused, counter is at 40% of original. After 90 days,
-- 6%. After 180 days, 0.4%.
--
-- Active clusters (engaged daily) maintain near-current values: γ × +1
-- per engagement compounds back up. Stale clusters decay exponentially.

CREATE OR REPLACE FUNCTION public.decay_cluster_explore_bandit(
  p_gamma real DEFAULT 0.97
)
RETURNS TABLE (rows_updated bigint, sum_engages_before bigint, sum_shows_before bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  cnt bigint := 0;
  sumE bigint := 0;
  sumS bigint := 0;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(explore_engages), 0), COALESCE(SUM(explore_shows), 0)
  INTO cnt, sumE, sumS
  FROM public.cluster_state
  WHERE explore_engages > 0 OR explore_shows > 0;

  UPDATE public.cluster_state
  SET explore_engages = (explore_engages::double precision * p_gamma)::bigint,
      explore_shows   = (explore_shows::double precision * p_gamma)::bigint,
      updated_at      = NOW()
  WHERE explore_engages > 0 OR explore_shows > 0;

  RETURN QUERY SELECT cnt, sumE, sumS;
END;
$$;

COMMENT ON FUNCTION public.decay_cluster_explore_bandit IS
  'Phoenix Phase 7.C. Daily multiplicative decay (γ=0.97) on cluster_state.explore_engages/shows. Stale clusters fade out of bandit posterior.';

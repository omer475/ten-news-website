-- Migration 078 — Atomic increment RPCs for cluster_state counters.
--
-- Audit fix A2 (2026-05-06): replaces the read-modify-write pattern in
-- lib/trinityServe.js bumpExploreShows and pages/api/analytics/track.js
-- explore_engages updater. Two concurrent requests previously each read
-- the same value and each wrote +1 instead of +2, corrupting the Beta(α,β)
-- posterior used by the explore arm.

CREATE OR REPLACE FUNCTION public.bump_cluster_explore_shows(p_cluster_ids smallint[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.cluster_state (cluster_id, explore_shows, last_shown_at, updated_at)
  SELECT unnest(p_cluster_ids), 1, now(), now()
  ON CONFLICT (cluster_id) DO UPDATE SET
    explore_shows = public.cluster_state.explore_shows + 1,
    last_shown_at = now(),
    updated_at    = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_cluster_explore_engages(p_cluster_id smallint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.cluster_state (cluster_id, explore_engages, updated_at)
  VALUES (p_cluster_id, 1, now())
  ON CONFLICT (cluster_id) DO UPDATE SET
    explore_engages = public.cluster_state.explore_engages + 1,
    updated_at      = now();
END;
$$;

COMMENT ON FUNCTION public.bump_cluster_explore_shows(smallint[]) IS
  'Atomic +1 increment of explore_shows; replaces read-modify-write race in trinityServe.js.';
COMMENT ON FUNCTION public.bump_cluster_explore_engages(smallint) IS
  'Atomic +1 increment of explore_engages; replaces read-modify-write race in track.js.';

-- Trinity v3: Thompson Sampling bandit columns on cluster_state.
--
-- Trinity v1/v2 had no exploration mechanism. With user h²>0 in only 781 of
-- 2048 secondaries, and 1,267 secondaries unexplored (567 with fresh quality
-- content), we need a deliberate path to surface NEW interest clusters.
--
-- Solution: per-cluster Beta(alpha, beta) posterior, sampled at request time.
--   alpha = 1 + (qualifying-engagement events on articles served via explore)
--   beta  = 1 + (skips on articles served via explore)
-- Sampling once and picking max yields Thompson Sampling — the optimal
-- multi-armed bandit policy for explore/exploit trade-offs (Russo et al. 2018).
--
-- Why beta=1 prior: uninformed. Cluster's true engagement rate is unknown
-- until we've shown it.
--
-- Idempotent.

ALTER TABLE public.cluster_state
  ADD COLUMN IF NOT EXISTS explore_engages bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS explore_shows   bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cluster_state.explore_engages IS
  'Trinity v3 explore arm: count of qualifying-engagement events on articles served from this cluster via the explore bucket. Beta(alpha) numerator.';
COMMENT ON COLUMN public.cluster_state.explore_shows IS
  'Trinity v3 explore arm: count of times this cluster was served via the explore bucket. Beta denominator.';

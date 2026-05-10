-- Migration 106 — Phase 1.6 (TikTok mirror plan).
--
-- Extend bump_user_negative_dim to accept a weight parameter so the analytics
-- pipeline can encode skip-strength tiers:
--   * dwell <= 1.0s → weight 1.5  (hardest fast-skip; user swiped instantly)
--   * dwell <= 3.0s → weight 1.0  (existing fast-skip)
--   * dwell <= 6.0s → weight 0.5  (NEW: glance-skip — saw card but didn't engage)
--
-- Pre-migration 106: only dwell <= 3.0 fired bump_user_negative_dim, ignoring
-- the meaningful "glance and bounce" signal. ENF (arxiv:2511.18700) treats
-- watched-but-no-engagement as a real negative. This change extends the window
-- and weights it by tier.
--
-- The fast_skip_count column changes from int to real to accommodate fractional
-- weights. Existing integer values are preserved (PostgreSQL widens losslessly).
--
-- Backwards compatibility: the OLD 3-arg signature stays available with default
-- weight=1.0, so any caller that hasn't been updated to pass p_weight still works.

-- 1. Widen the fast_skip_count column from int to real.
ALTER TABLE public.user_negative_dimensions
  ALTER COLUMN fast_skip_count TYPE real USING fast_skip_count::real;

-- 2. Drop the old 3-arg function and replace with a 4-arg signature
-- that accepts an optional weight (default 1.0, matching old behavior).
DROP FUNCTION IF EXISTS public.bump_user_negative_dim(uuid, text, text);

CREATE OR REPLACE FUNCTION public.bump_user_negative_dim(
  p_user_id   uuid,
  p_dim_type  text,
  p_dim_value text,
  p_weight    real DEFAULT 1.0
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.user_negative_dimensions (user_id, dim_type, dim_value, fast_skip_count, last_skip_at)
  VALUES (p_user_id, p_dim_type, p_dim_value, p_weight, NOW())
  ON CONFLICT (user_id, dim_type, dim_value) DO UPDATE SET
    fast_skip_count = user_negative_dimensions.fast_skip_count + p_weight,
    last_skip_at    = NOW();
$$;

-- 3. get_user_negative_dimensions stays unchanged structurally, but the
-- decayed_count return type already accommodates real values (it cast to real).
-- No further changes needed.

COMMENT ON FUNCTION public.bump_user_negative_dim IS
  'Phase 1.6 (2026-05-10). Weighted negative-dim bump. Caller passes p_weight in [0.5, 1.5] by skip-tier (glance/fast/instant). Counts are real-valued.';

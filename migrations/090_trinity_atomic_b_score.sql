-- Migration 090 — Phoenix Phase 5.D. Atomic b_score EMA RPC.
--
-- The previous JS-side emaUpdates + upsert pattern was a read-modify-write race:
-- two concurrent serveTrinityFeed requests both compute newB from the same
-- snapshot prevB, then both upsert with onConflict — last write wins, an
-- update is silently lost. Migration 078 fixed this for explore_engages /
-- explore_shows; this migration extends the same atomic pattern to b_score
-- and shown_count.
--
-- Formula: newB = (1-α) * prevB + α * gapSec
-- where gapSec = seconds since prev.last_shown_at (or 0 for first impression).
-- α defaults to 0.1 (LT_EMA_RATE in lib/trinity.js).

CREATE OR REPLACE FUNCTION public.bump_cluster_b_score(
  p_cluster_ids smallint[],
  p_alpha       real DEFAULT 0.1
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  ts timestamptz := NOW();
BEGIN
  IF array_length(p_cluster_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.cluster_state (cluster_id, last_shown_at, b_score, shown_count, updated_at)
  SELECT
    cid AS cluster_id,
    ts AS last_shown_at,
    0::double precision AS b_score,  -- first-time: prevB=0, gapSec=0 → newB=0
    1::bigint AS shown_count,
    ts AS updated_at
  FROM unnest(p_cluster_ids) AS cid
  ON CONFLICT (cluster_id) DO UPDATE SET
    b_score       = (1.0 - p_alpha::double precision) * cluster_state.b_score
                  + p_alpha::double precision
                    * GREATEST(0, EXTRACT(EPOCH FROM (ts - cluster_state.last_shown_at))),
    last_shown_at = ts,
    shown_count   = cluster_state.shown_count + 1,
    updated_at    = ts;
END;
$$;

COMMENT ON FUNCTION public.bump_cluster_b_score IS
  'Phoenix Phase 5.D. Atomic EMA update for cluster_state.b_score + shown_count. Replaces JS-side read-modify-write race in emaUpdates(). α=0.1 default matches LT_EMA_RATE.';

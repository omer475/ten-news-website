-- 070_weighted_entity_signal_rpc.sql
--
-- Phase B of feed-algorithm-v11 plan.
-- See ~/.claude/plans/harmonic-napping-melody.md
--
-- Source: Kuaishou CIKM 2023 — "Learning and Optimization of Implicit
-- Negative Feedback for Industrial Short-video Recommender System"
-- (arXiv:2308.13249). Differentiates negative feedback by dwell time:
--   < 3s   : weak negative (likely accidental scroll)
--   3-20s  : standard negative
--   ≥ 20s  : "read-then-reject" — strongest negative signal
--
-- Why
-- ----
-- Today every article_skipped event writes negative_count += 1 regardless
-- of dwell. Latest session analysis showed 39s/43s/34s read-then-skip
-- events being treated identically to 1s scroll-pasts — the algorithm
-- discards the strongest signal we have about user intent.
--
-- This migration extends update_entity_signal with a p_weight parameter
-- (DEFAULT 1.0 for backward compat). Every +1 is multiplied by p_weight.
-- positive_count / negative_count columns are already DOUBLE PRECISION
-- in production (verified 2026-04-26).
--
-- Idempotent — uses CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION update_entity_signal(
  p_user_id     uuid,
  p_entity      text,
  p_is_positive boolean,
  p_weight      double precision DEFAULT 1.0,
  p_event_at    timestamptz       DEFAULT NOW()
)
RETURNS void AS $$
DECLARE
  pos_delta double precision := CASE WHEN p_is_positive THEN p_weight ELSE 0 END;
  neg_delta double precision := CASE WHEN NOT p_is_positive THEN p_weight ELSE 0 END;
BEGIN
  INSERT INTO user_entity_signals (user_id, entity,
    positive_count, negative_count,
    positive_24h, negative_24h,
    positive_7d, negative_7d,
    last_positive_at, last_negative_at, updated_at)
  VALUES (
    p_user_id,
    lower(p_entity),
    pos_delta, neg_delta,
    pos_delta, neg_delta,
    pos_delta, neg_delta,
    CASE WHEN p_is_positive     THEN p_event_at ELSE NULL END,
    CASE WHEN NOT p_is_positive THEN p_event_at ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id, entity) DO UPDATE SET
    positive_count   = user_entity_signals.positive_count + pos_delta,
    negative_count   = user_entity_signals.negative_count + neg_delta,
    positive_24h     = user_entity_signals.positive_24h   + pos_delta,
    negative_24h     = user_entity_signals.negative_24h   + neg_delta,
    positive_7d      = user_entity_signals.positive_7d    + pos_delta,
    negative_7d      = user_entity_signals.negative_7d    + neg_delta,
    last_positive_at = CASE WHEN p_is_positive THEN p_event_at ELSE user_entity_signals.last_positive_at END,
    last_negative_at = CASE WHEN NOT p_is_positive THEN p_event_at ELSE user_entity_signals.last_negative_at END,
    updated_at       = NOW();
END;
$$ LANGUAGE plpgsql;

-- Back-compat note: existing callers that don't pass p_weight get the
-- DEFAULT 1.0 — exact same behaviour as before. The new dwell-aware
-- path in pages/api/analytics/track.js (Phase B same PR) starts using
-- weights of 0.5 / 1.0 / 1.8 for skips based on view_seconds.

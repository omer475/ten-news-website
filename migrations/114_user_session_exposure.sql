-- Migration 114: user_session_exposure — 3-axis topic/sub-topic/source memory
-- Date: 2026-05-12
--
-- Source: Kuaishou tri-level fatigue model (WTG paper CIKM 2023,
-- arxiv:2308.13249) section 3.3. Matches the Instagram "connected content
-- fatigue" pattern (transparency 2023) and TikTok's per-category exposure
-- tracking (Trinity paper KDD 2024 + Algo 101).
--
-- Solves the audit finding that primary 62 (China geopolitics) dominated
-- 35% of feed across 8 sessions in 30 min — our per-slate diversity discount
-- has slate-only memory, so the system has no way to know "we already showed
-- this primary heavily in the last hour."
--
-- Three axes tracked, each with its own decay rate (set in JS layer):
--   primary    half-life 60 min  — broad topic (vq_primary)
--   secondary  half-life 30 min  — sub-topic (vq_secondary)
--   source     half-life 20 min  — publisher
--
-- Decay is applied READ-side in JS (loadSessionExposure). Writes are raw
-- increments; the table never needs a sweeper. Rows older than ~6 hours
-- become effectively 1.0× multiplier and can be pruned periodically.

CREATE TABLE IF NOT EXISTS public.user_session_exposure (
  user_id          uuid NOT NULL,
  axis             text NOT NULL,
  value            text NOT NULL,
  count            double precision NOT NULL DEFAULT 0,
  last_updated_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, axis, value)
);

-- Hot-path index for the per-request read.
CREATE INDEX IF NOT EXISTS idx_user_session_exposure_user
  ON public.user_session_exposure (user_id, last_updated_at DESC);

-- RLS off — service-role only. Mirrors user_feed_impressions.
ALTER TABLE public.user_session_exposure DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- bump_session_exposure — atomic upsert called after each slate is served.
-- ---------------------------------------------------------------------------
-- Inputs:
--   p_user_id    — uuid
--   p_axes       — text[] e.g. {'primary','primary','source','secondary'}
--   p_values     — text[] same length, e.g. {'62','19','SCMP','494'}
--
-- For each pair, increments count by 1.0 and sets last_updated_at = NOW().
-- The decay logic lives in the JS reader — this RPC is dumb on purpose so
-- it stays atomic + cheap (one statement per pair, batched in a CTE).
CREATE OR REPLACE FUNCTION public.bump_session_exposure(
  p_user_id uuid,
  p_axes    text[],
  p_values  text[]
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_axes IS NULL OR p_values IS NULL THEN
    RETURN;
  END IF;
  IF array_length(p_axes, 1) IS NULL OR array_length(p_axes, 1) <> array_length(p_values, 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_session_exposure (user_id, axis, value, count, last_updated_at)
  SELECT p_user_id, t.axis, t.value, 1.0, NOW()
  FROM (
    SELECT unnest(p_axes) AS axis, unnest(p_values) AS value
  ) t
  ON CONFLICT (user_id, axis, value) DO UPDATE
    SET count = user_session_exposure.count + 1.0,
        last_updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_session_exposure(uuid, text[], text[]) TO authenticated, service_role, anon;

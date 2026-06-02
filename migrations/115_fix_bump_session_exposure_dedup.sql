-- Migration 115: fix bump_session_exposure — pre-aggregate duplicate pairs
-- Date: 2026-05-29
--
-- BUG: bumpSessionExposure (lib/sessionExposure.js) pushes one (axis, value)
-- pair PER slate item. A real slate always contains several articles sharing
-- the same source / vq_secondary / vq_primary, so p_axes/p_values contain
-- duplicate (axis, value) pairs. The original RPC did:
--     INSERT ... SELECT unnest(p_axes), unnest(p_values) ...
--     ON CONFLICT (user_id, axis, value) DO UPDATE ...
-- With duplicate keys in the same statement Postgres aborts with
--   "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- and the ENTIRE upsert fails. Result: the per-session tri-axis fatigue
-- model (migration 114) silently never recorded exposure — user_session_exposure
-- stayed near-empty and the For-You feed lost its cross-slate diversity guard
-- (the exact "one primary dominates the session" problem 114 was built to fix).
--
-- FIX: pre-aggregate within the statement. Pair the two arrays positionally
-- with WITH ORDINALITY, GROUP BY (axis, value), and increment count by the
-- true number of occurrences (COUNT(*)) instead of a hard-coded 1.0. After
-- grouping each (axis, value) appears once, so ON CONFLICT can no longer be
-- hit twice — and counts are now accurate (a source shown 4× in a slate
-- bumps its exposure by 4, as intended) rather than capped at 1.

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
  SELECT p_user_id, t.axis, t.value, t.n, NOW()
  FROM (
    SELECT a.axis, v.value, COUNT(*)::double precision AS n
    FROM unnest(p_axes)   WITH ORDINALITY AS a(axis,  ord)
    JOIN unnest(p_values) WITH ORDINALITY AS v(value, ord) USING (ord)
    GROUP BY a.axis, v.value
  ) t
  ON CONFLICT (user_id, axis, value) DO UPDATE
    SET count = user_session_exposure.count + EXCLUDED.count,
        last_updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_session_exposure(uuid, text[], text[]) TO authenticated, service_role, anon;

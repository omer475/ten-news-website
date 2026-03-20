-- Migration 031: Atomic tag_profile update RPC
-- Fixes critical race condition: concurrent events doing read-modify-write
-- on tag_profile overwrite each other. Only the last event's tags survive.
-- This RPC uses SELECT ... FOR UPDATE to serialize writes per user.

CREATE OR REPLACE FUNCTION update_tag_profile_atomic(
  p_user_id UUID,
  p_tags JSONB,                -- {"tag_name": weight, ...} pre-computed weights to ADD
  p_session_id TEXT DEFAULT NULL,
  p_cluster_id INT DEFAULT NULL,
  p_tag_pair TEXT DEFAULT NULL  -- "tag1+tag2" for saturation tracking
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile JSONB;
  v_momentum JSONB;
  v_saturation JSONB;
  v_now BIGINT;
  v_last_updated BIGINT;
  v_days_since FLOAT;
  v_decay FLOAT;
  v_key TEXT;
  v_val FLOAT;
  v_prev_sid TEXT;
  v_sat_key TEXT;
  v_seven_days_ago BIGINT;
  v_mom_tags JSONB;
BEGIN
  v_now := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_seven_days_ago := v_now - 604800000;

  -- Lock row and read current values
  SELECT
    COALESCE(tag_profile, '{}'::JSONB),
    COALESCE(session_momentum, '{}'::JSONB),
    COALESCE(topic_saturation, '{}'::JSONB)
  INTO v_profile, v_momentum, v_saturation
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  -- 1. Session boundary: fold previous session's momentum into tag_profile at 40%
  IF p_session_id IS NOT NULL THEN
    v_prev_sid := v_momentum->>'session_id';
    IF v_prev_sid IS NOT NULL AND v_prev_sid != p_session_id THEN
      FOR v_key, v_val IN
        SELECT key, (value#>>'{}')::FLOAT
        FROM jsonb_each(COALESCE(v_momentum->'tags', '{}'::JSONB))
      LOOP
        v_profile := jsonb_set(
          v_profile,
          ARRAY[v_key],
          to_jsonb(LEAST(COALESCE((v_profile->>v_key)::FLOAT, 0) + v_val * 0.4, 1.0))
        );
      END LOOP;
    END IF;
  END IF;

  -- 2. Decay: only if 12+ hours since last update (prevents over-decay)
  v_last_updated := COALESCE((v_profile->>'_last_updated')::BIGINT, v_now);
  v_days_since := (v_now - v_last_updated)::FLOAT / 86400000.0;
  IF v_days_since > 0.5 THEN
    v_decay := POWER(0.97, v_days_since);
    FOR v_key IN
      SELECT key FROM jsonb_each(v_profile)
      WHERE key NOT LIKE '\_%'
    LOOP
      v_val := (v_profile->>v_key)::FLOAT * v_decay;
      IF v_val < 0.02 THEN
        v_profile := v_profile - v_key;
      ELSE
        v_profile := jsonb_set(v_profile, ARRAY[v_key], to_jsonb(v_val));
      END IF;
    END LOOP;
    v_profile := jsonb_set(v_profile, ARRAY['_last_updated'], to_jsonb(v_now));
  END IF;

  -- 3. Add tag weights (pre-computed with position + dwell modulation)
  FOR v_key, v_val IN
    SELECT key, (value#>>'{}')::FLOAT FROM jsonb_each(p_tags)
  LOOP
    v_profile := jsonb_set(
      v_profile,
      ARRAY[v_key],
      to_jsonb(LEAST(COALESCE((v_profile->>v_key)::FLOAT, 0) + v_val, 1.0))
    );
  END LOOP;

  -- 4. Update session momentum
  IF p_session_id IS NOT NULL THEN
    v_prev_sid := v_momentum->>'session_id';
    IF p_session_id = v_prev_sid OR v_prev_sid IS NULL THEN
      -- Same session: accumulate into existing momentum
      v_mom_tags := COALESCE(v_momentum->'tags', '{}'::JSONB);
      FOR v_key, v_val IN
        SELECT key, (value#>>'{}')::FLOAT FROM jsonb_each(p_tags)
      LOOP
        v_mom_tags := jsonb_set(
          v_mom_tags,
          ARRAY[v_key],
          to_jsonb(LEAST(COALESCE((v_mom_tags->>v_key)::FLOAT, 0) + v_val, 0.6))
        );
      END LOOP;
    ELSE
      -- New session: reset momentum with current event's tags
      v_mom_tags := '{}'::JSONB;
      FOR v_key, v_val IN
        SELECT key, (value#>>'{}')::FLOAT FROM jsonb_each(p_tags)
      LOOP
        v_mom_tags := jsonb_set(v_mom_tags, ARRAY[v_key], to_jsonb(LEAST(v_val, 0.6)));
      END LOOP;
    END IF;
    v_momentum := jsonb_build_object('session_id', p_session_id, 'tags', v_mom_tags);
  END IF;

  -- 5. Topic saturation: prune old entries, then track new exposure
  FOR v_key IN
    SELECT key FROM jsonb_each(v_saturation)
    WHERE COALESCE((value->>'last')::BIGINT, 0) < v_seven_days_ago
  LOOP
    v_saturation := v_saturation - v_key;
  END LOOP;

  IF p_cluster_id IS NOT NULL THEN
    v_sat_key := 'c_' || p_cluster_id::TEXT;
    v_saturation := jsonb_set(
      v_saturation,
      ARRAY[v_sat_key],
      jsonb_build_object(
        'count', COALESCE((v_saturation->v_sat_key->>'count')::INT, 0) + 1,
        'last', v_now
      )
    );
  END IF;

  IF p_tag_pair IS NOT NULL THEN
    v_sat_key := 't_' || p_tag_pair;
    v_saturation := jsonb_set(
      v_saturation,
      ARRAY[v_sat_key],
      jsonb_build_object(
        'count', COALESCE((v_saturation->v_sat_key->>'count')::INT, 0) + 1,
        'last', v_now
      )
    );
  END IF;

  -- 6. Write back atomically (still under FOR UPDATE lock)
  UPDATE profiles
  SET tag_profile = v_profile,
      session_momentum = v_momentum,
      topic_saturation = v_saturation
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Also create an atomic skip_profile update to prevent the same race condition
CREATE OR REPLACE FUNCTION update_skip_profile_atomic(
  p_user_id UUID,
  p_tags JSONB  -- {"tag_name": weight_to_add, ...}
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile JSONB;
  v_key TEXT;
  v_val FLOAT;
BEGIN
  SELECT COALESCE(skip_profile, '{}'::JSONB)
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  FOR v_key, v_val IN
    SELECT key, (value#>>'{}')::FLOAT FROM jsonb_each(p_tags)
  LOOP
    v_profile := jsonb_set(
      v_profile,
      ARRAY[v_key],
      to_jsonb(LEAST(COALESCE((v_profile->>v_key)::FLOAT, 0) + v_val, 0.9))
    );
  END LOOP;

  UPDATE profiles
  SET skip_profile = v_profile
  WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- MIGRATION 028: Feed Algorithm v3 — Complete Schema
-- ============================================================
-- New tables: personalization_profiles, engagement_buffer,
--             user_entity_affinity, user_sessions
-- Extended:   user_interest_clusters, published_articles
-- New RPCs:   update_sliding_window, update_entity_affinity
--
-- Run this in Supabase SQL Editor.

-- ============================================================
-- 1. PERSONALIZATION_PROFILES — Unified user identity
-- ============================================================
-- One row per user (guest or authenticated). All algorithm tables
-- reference personalization_id, not auth UUID or device ID.

CREATE TABLE IF NOT EXISTS personalization_profiles (
  personalization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_profile_id UUID UNIQUE,
  guest_device_id TEXT UNIQUE,
  phase INT NOT NULL DEFAULT 1 CHECK (phase IN (1, 2, 3)),
  total_interactions INT NOT NULL DEFAULT 0,
  taste_vector_minilm JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT at_least_one_identity CHECK (
    auth_profile_id IS NOT NULL OR guest_device_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_pp_auth ON personalization_profiles(auth_profile_id) WHERE auth_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_guest ON personalization_profiles(guest_device_id) WHERE guest_device_id IS NOT NULL;

-- ============================================================
-- 2. ENGAGEMENT_BUFFER — Sliding window of recent engagements
-- ============================================================
-- Stores last 50 engaged article embeddings per user.
-- Phase 1 uses weighted average of last 30 as taste vector.
-- Phase 2/3 uses all for clustering input.

CREATE TABLE IF NOT EXISTS engagement_buffer (
  id BIGSERIAL PRIMARY KEY,
  personalization_id UUID NOT NULL REFERENCES personalization_profiles(personalization_id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL,
  embedding_minilm JSONB NOT NULL,
  interaction_weight FLOAT NOT NULL DEFAULT 1.0,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eb_pers_created ON engagement_buffer(personalization_id, created_at DESC);

-- ============================================================
-- 3. USER_ENTITY_AFFINITY — Entity-level interest with decay
-- ============================================================
-- Tracks affinity for specific entities (e.g., "Galatasaray", "vegan recipes")
-- with content-type aware decay rates.

CREATE TABLE IF NOT EXISTS user_entity_affinity (
  personalization_id UUID NOT NULL REFERENCES personalization_profiles(personalization_id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  affinity_score FLOAT NOT NULL DEFAULT 0.0,
  decay_rate FLOAT NOT NULL DEFAULT 0.99,
  entity_type TEXT NOT NULL DEFAULT 'evergreen' CHECK (entity_type IN ('time_sensitive', 'evergreen')),
  last_engaged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engagement_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (personalization_id, entity)
);

CREATE INDEX IF NOT EXISTS idx_uea_pers ON user_entity_affinity(personalization_id);

-- ============================================================
-- 4. USER_SESSIONS — Session vector tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personalization_id UUID NOT NULL REFERENCES personalization_profiles(personalization_id) ON DELETE CASCADE,
  session_vector_minilm JSONB,
  is_activated BOOLEAN NOT NULL DEFAULT FALSE,
  engagement_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_us_pers_start ON user_sessions(personalization_id, started_at DESC);

-- ============================================================
-- 5. EXTEND user_interest_clusters for v3
-- ============================================================
-- Add importance scoring, cluster types, archiving, and
-- link to personalization_profiles.

ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.0;
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS cluster_type TEXT DEFAULT 'mixed';
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS decay_lambda FLOAT DEFAULT 0.0231;
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS personalization_id UUID;
ALTER TABLE user_interest_clusters ADD COLUMN IF NOT EXISTS last_engaged_at TIMESTAMPTZ;

-- ============================================================
-- 6. EXTEND published_articles for v3
-- ============================================================
-- entity_tags: structured NER entities (separate from interest_tags)
-- shelf_life_category + shelf_life_hours: freshness management

ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS entity_tags TEXT[] DEFAULT '{}';
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS shelf_life_category TEXT DEFAULT 'recent';
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS shelf_life_hours INT;

-- Backfill shelf_life_hours from existing shelf_life_days
UPDATE published_articles
SET shelf_life_hours = CASE
  WHEN shelf_life_days IS NOT NULL THEN (shelf_life_days * 24)::INT
  ELSE 168  -- 7 days default
END
WHERE shelf_life_hours IS NULL;

-- ============================================================
-- 7. RPC: update_sliding_window
-- ============================================================
-- Replaces EMA. Inserts into engagement_buffer, computes weighted
-- average of last 30 embeddings as new taste vector.

CREATE OR REPLACE FUNCTION update_sliding_window(
  p_pers_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT
)
RETURNS VOID AS $$
DECLARE
  article_emb JSONB;
  interaction_w FLOAT;
  buffer_count INT;
  new_taste FLOAT[];
  dim INT := 384;
  i INT;
  total_weight FLOAT;
BEGIN
  -- Calculate interaction weight from spec
  interaction_w := CASE p_event_type
    WHEN 'article_saved' THEN 3.0
    WHEN 'article_shared' THEN 2.0
    WHEN 'article_liked' THEN 1.5
    WHEN 'article_engaged' THEN 1.0
    WHEN 'article_detail_view' THEN 1.0
    WHEN 'article_skipped' THEN -0.5
    ELSE 1.0
  END;

  -- Get article embedding
  SELECT embedding_minilm INTO article_emb
  FROM published_articles WHERE id = p_article_id;

  IF article_emb IS NULL THEN
    RETURN;
  END IF;

  -- Insert into engagement buffer
  INSERT INTO engagement_buffer (personalization_id, article_id, embedding_minilm, interaction_weight, event_type)
  VALUES (p_pers_id, p_article_id, article_emb, interaction_w, p_event_type);

  -- Trim buffer to last 50 entries
  DELETE FROM engagement_buffer
  WHERE id IN (
    SELECT id FROM engagement_buffer
    WHERE personalization_id = p_pers_id
    ORDER BY created_at DESC
    OFFSET 50
  );

  -- Compute weighted average of last 30 positive engagements as taste vector
  -- Skip entries are excluded from taste vector computation (they're in buffer for clustering)
  SELECT COUNT(*) INTO buffer_count
  FROM (
    SELECT 1 FROM engagement_buffer
    WHERE personalization_id = p_pers_id AND interaction_weight > 0
    ORDER BY created_at DESC
    LIMIT 30
  ) sub;

  IF buffer_count = 0 THEN
    RETURN;
  END IF;

  -- Compute weighted average across all 384 dimensions
  SELECT SUM(eb.interaction_weight) INTO total_weight
  FROM (
    SELECT interaction_weight FROM engagement_buffer
    WHERE personalization_id = p_pers_id AND interaction_weight > 0
    ORDER BY created_at DESC
    LIMIT 30
  ) eb;

  IF total_weight <= 0 THEN
    RETURN;
  END IF;

  new_taste := ARRAY[]::FLOAT[];
  FOR i IN 0..dim-1 LOOP
    new_taste := array_append(new_taste, (
      SELECT SUM((eb.embedding_minilm->>i)::FLOAT * eb.interaction_weight) / total_weight
      FROM (
        SELECT embedding_minilm, interaction_weight FROM engagement_buffer
        WHERE personalization_id = p_pers_id AND interaction_weight > 0
        ORDER BY created_at DESC
        LIMIT 30
      ) eb
    ));
  END LOOP;

  -- Update taste vector and increment interactions
  UPDATE personalization_profiles
  SET taste_vector_minilm = to_jsonb(new_taste),
      total_interactions = total_interactions + 1,
      updated_at = NOW()
  WHERE personalization_id = p_pers_id;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. RPC: update_entity_affinity
-- ============================================================
-- Updates entity-level affinity with time-aware decay.
-- Formula: new_score = (old_score × decay^days_elapsed) + interaction_weight

CREATE OR REPLACE FUNCTION update_entity_affinity(
  p_pers_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT
)
RETURNS VOID AS $$
DECLARE
  tags TEXT[];
  tag TEXT;
  interaction_w FLOAT;
  tag_count INT := 0;
  existing_score FLOAT;
  existing_decay FLOAT;
  existing_last TIMESTAMPTZ;
  days_elapsed FLOAT;
  decayed_score FLOAT;
  e_type TEXT;
  article_cat TEXT;
BEGIN
  -- Calculate interaction weight
  interaction_w := CASE p_event_type
    WHEN 'article_saved' THEN 3.0
    WHEN 'article_shared' THEN 2.0
    WHEN 'article_liked' THEN 1.5
    WHEN 'article_engaged' THEN 1.0
    WHEN 'article_detail_view' THEN 1.0
    WHEN 'article_skipped' THEN -0.5
    ELSE 1.0
  END;

  -- Skip negative signals for entity affinity (only positive builds affinity)
  IF interaction_w < 0 THEN
    RETURN;
  END IF;

  -- Get article tags and category
  SELECT
    COALESCE(
      CASE WHEN entity_tags IS NOT NULL AND array_length(entity_tags, 1) > 0
           THEN entity_tags
           ELSE NULL
      END,
      CASE WHEN interest_tags IS NOT NULL
           THEN ARRAY(SELECT jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(interest_tags) = 'array' THEN interest_tags
                  ELSE '[]'::jsonb
             END
           ))
           ELSE '{}'::TEXT[]
      END
    ),
    category
  INTO tags, article_cat
  FROM published_articles WHERE id = p_article_id;

  IF tags IS NULL OR array_length(tags, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Determine entity type based on article category
  -- Sports/Entertainment = time_sensitive (0.95 decay, ~14 day half-life)
  -- Everything else = evergreen (0.99 decay, ~69 day half-life)
  e_type := CASE
    WHEN article_cat IN ('Sports', 'Entertainment', 'Politics') THEN 'time_sensitive'
    ELSE 'evergreen'
  END;

  -- Process first 6 tags only
  FOREACH tag IN ARRAY tags[1:LEAST(6, array_length(tags, 1))]
  LOOP
    tag := lower(trim(tag));
    IF tag = '' THEN CONTINUE; END IF;

    -- Check existing affinity
    SELECT affinity_score, decay_rate, last_engaged_at
    INTO existing_score, existing_decay, existing_last
    FROM user_entity_affinity
    WHERE personalization_id = p_pers_id AND entity = tag;

    IF existing_score IS NOT NULL THEN
      -- Apply decay since last engagement, then add new weight
      days_elapsed := EXTRACT(EPOCH FROM (NOW() - existing_last)) / 86400.0;
      decayed_score := existing_score * POWER(existing_decay, days_elapsed);

      UPDATE user_entity_affinity
      SET affinity_score = LEAST(decayed_score + interaction_w, 10.0),
          last_engaged_at = NOW(),
          engagement_count = engagement_count + 1
      WHERE personalization_id = p_pers_id AND entity = tag;
    ELSE
      -- New entity
      INSERT INTO user_entity_affinity (personalization_id, entity, affinity_score, decay_rate, entity_type, last_engaged_at, engagement_count)
      VALUES (p_pers_id, tag, interaction_w, CASE WHEN e_type = 'time_sensitive' THEN 0.95 ELSE 0.99 END, e_type, NOW(), 1);
    END IF;

    tag_count := tag_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. RPC: resolve_personalization_id
-- ============================================================
-- Finds or creates a personalization_profiles row for a user.
-- Returns personalization_id, phase, total_interactions.

CREATE OR REPLACE FUNCTION resolve_personalization_id(
  p_auth_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS TABLE (personalization_id UUID, phase INT, total_interactions INT) AS $$
DECLARE
  found_id UUID;
  found_phase INT;
  found_interactions INT;
BEGIN
  -- Try to find existing
  IF p_auth_id IS NOT NULL THEN
    SELECT pp.personalization_id, pp.phase, pp.total_interactions
    INTO found_id, found_phase, found_interactions
    FROM personalization_profiles pp
    WHERE pp.auth_profile_id = p_auth_id;
  ELSIF p_device_id IS NOT NULL THEN
    SELECT pp.personalization_id, pp.phase, pp.total_interactions
    INTO found_id, found_phase, found_interactions
    FROM personalization_profiles pp
    WHERE pp.guest_device_id = p_device_id;
  ELSE
    RETURN;
  END IF;

  -- Create if not found
  IF found_id IS NULL THEN
    INSERT INTO personalization_profiles (auth_profile_id, guest_device_id)
    VALUES (p_auth_id, p_device_id)
    RETURNING personalization_profiles.personalization_id, personalization_profiles.phase, personalization_profiles.total_interactions
    INTO found_id, found_phase, found_interactions;
  END IF;

  personalization_id := found_id;
  phase := found_phase;
  total_interactions := found_interactions;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. BACKFILL: Migrate existing profiles to personalization_profiles
-- ============================================================
-- For each profiles row with taste_vector_minilm, create a
-- personalization_profiles row.

INSERT INTO personalization_profiles (auth_profile_id, taste_vector_minilm, phase, total_interactions)
SELECT
  p.id,
  p.taste_vector_minilm,
  CASE
    WHEN COALESCE(event_counts.cnt, 0) >= 50 THEN 3
    WHEN COALESCE(event_counts.cnt, 0) >= 30 THEN 2
    ELSE 1
  END,
  COALESCE(event_counts.cnt, 0)
FROM profiles p
LEFT JOIN (
  SELECT user_id, COUNT(*) as cnt
  FROM user_article_events
  WHERE event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_liked', 'article_shared')
  GROUP BY user_id
) event_counts ON event_counts.user_id = p.id
WHERE p.id IS NOT NULL
ON CONFLICT (auth_profile_id) DO NOTHING;

-- ============================================================
-- DONE
-- ============================================================
-- Verify with:
-- SELECT COUNT(*) FROM personalization_profiles;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'personalization_profiles';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'engagement_buffer';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_entity_affinity';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_sessions';

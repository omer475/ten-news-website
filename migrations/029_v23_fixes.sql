-- ============================================================
-- MIGRATION 029: V23 Algorithm Fixes
-- ============================================================
-- 1. Remove 50-row cap from update_sliding_window
-- 2. Fix entity affinity: use interaction_weight × 0.5
-- Run in Supabase SQL Editor.

-- ============================================================
-- 1. update_sliding_window — Remove buffer cap, keep all history
-- ============================================================

CREATE OR REPLACE FUNCTION update_sliding_window(
  p_pers_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT
)
RETURNS VOID AS $$
DECLARE
  article_emb JSONB;
  interaction_w FLOAT;
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

  -- Insert into engagement buffer (NO cap — keep all history for clustering)
  INSERT INTO engagement_buffer (personalization_id, article_id, embedding_minilm, interaction_weight, event_type)
  VALUES (p_pers_id, p_article_id, article_emb, interaction_w, p_event_type);

  -- Increment total interactions
  UPDATE personalization_profiles
  SET total_interactions = total_interactions + 1,
      updated_at = NOW()
  WHERE personalization_id = p_pers_id;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. update_entity_affinity — Use interaction_weight × 0.5
-- ============================================================

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
  affinity_add FLOAT;
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

  -- Skip negative signals for entity affinity
  IF interaction_w < 0 THEN
    RETURN;
  END IF;

  -- Scale down to prevent hitting 10.0 cap too fast
  affinity_add := interaction_w * 0.5;

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
      -- Apply decay since last engagement, then add scaled weight
      days_elapsed := EXTRACT(EPOCH FROM (NOW() - existing_last)) / 86400.0;
      decayed_score := existing_score * POWER(existing_decay, days_elapsed);

      UPDATE user_entity_affinity
      SET affinity_score = LEAST(decayed_score + affinity_add, 10.0),
          last_engaged_at = NOW(),
          engagement_count = engagement_count + 1
      WHERE personalization_id = p_pers_id AND entity = tag;
    ELSE
      -- New entity
      INSERT INTO user_entity_affinity (personalization_id, entity, affinity_score, decay_rate, entity_type, last_engaged_at, engagement_count)
      VALUES (p_pers_id, tag, affinity_add, CASE WHEN e_type = 'time_sensitive' THEN 0.95 ELSE 0.99 END, e_type, NOW(), 1);
    END IF;

    tag_count := tag_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

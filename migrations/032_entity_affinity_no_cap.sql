-- Remove the 10.0 cap from entity affinity and use interaction_weight directly
-- The scoring function now normalizes against the user's max affinity

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
  interaction_w := CASE p_event_type
    WHEN 'article_saved' THEN 4.0
    WHEN 'article_shared' THEN 5.0
    WHEN 'article_liked' THEN 3.0
    WHEN 'article_engaged' THEN 1.0
    WHEN 'article_detail_view' THEN 0.5
    WHEN 'article_skipped' THEN -0.5
    ELSE 0.5
  END;

  IF interaction_w < 0 THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(
      CASE WHEN entity_tags IS NOT NULL AND array_length(entity_tags, 1) > 0
           THEN entity_tags ELSE NULL END,
      CASE WHEN interest_tags IS NOT NULL
           THEN ARRAY(SELECT jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(interest_tags) = 'array' THEN interest_tags ELSE '[]'::jsonb END
           )) ELSE '{}'::TEXT[] END
    ),
    category
  INTO tags, article_cat
  FROM published_articles WHERE id = p_article_id;

  IF tags IS NULL OR array_length(tags, 1) IS NULL THEN
    RETURN;
  END IF;

  e_type := CASE
    WHEN article_cat IN ('Sports', 'Entertainment', 'Politics') THEN 'time_sensitive'
    ELSE 'evergreen'
  END;

  FOREACH tag IN ARRAY tags[1:LEAST(6, array_length(tags, 1))]
  LOOP
    tag := lower(trim(tag));
    IF tag = '' THEN CONTINUE; END IF;

    SELECT affinity_score, decay_rate, last_engaged_at
    INTO existing_score, existing_decay, existing_last
    FROM user_entity_affinity
    WHERE personalization_id = p_pers_id AND entity = tag;

    IF existing_score IS NOT NULL THEN
      days_elapsed := EXTRACT(EPOCH FROM (NOW() - existing_last)) / 86400.0;
      decayed_score := existing_score * POWER(existing_decay, days_elapsed);

      -- NO CAP — let scores grow naturally
      UPDATE user_entity_affinity
      SET affinity_score = decayed_score + interaction_w,
          last_engaged_at = NOW(),
          engagement_count = engagement_count + 1
      WHERE personalization_id = p_pers_id AND entity = tag;
    ELSE
      INSERT INTO user_entity_affinity (personalization_id, entity, affinity_score, decay_rate, entity_type, last_engaged_at, engagement_count)
      VALUES (p_pers_id, tag, interaction_w, CASE WHEN e_type = 'time_sensitive' THEN 0.95 ELSE 0.99 END, e_type, NOW(), 1);
    END IF;

    tag_count := tag_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

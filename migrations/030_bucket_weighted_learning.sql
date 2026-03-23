-- ============================================================
-- MIGRATION 030: Bucket-weighted learning
-- ============================================================
-- Add p_bucket_multiplier to update_sliding_window
-- Personal=1.0, Trending=0.2, Discovery=0.1

CREATE OR REPLACE FUNCTION update_sliding_window(
  p_pers_id UUID,
  p_article_id BIGINT,
  p_event_type TEXT,
  p_bucket_multiplier FLOAT DEFAULT 1.0
)
RETURNS VOID AS $$
DECLARE
  article_emb JSONB;
  interaction_w FLOAT;
BEGIN
  interaction_w := CASE p_event_type
    WHEN 'article_saved' THEN 3.0
    WHEN 'article_shared' THEN 2.0
    WHEN 'article_liked' THEN 1.5
    WHEN 'article_engaged' THEN 1.0
    WHEN 'article_detail_view' THEN 1.0
    WHEN 'article_skipped' THEN -0.5
    WHEN 'article_glance' THEN 0.0
    ELSE 1.0
  END;

  -- Apply bucket multiplier
  interaction_w := interaction_w * p_bucket_multiplier;

  -- If weight is effectively zero, just increment interactions
  IF interaction_w = 0 OR (interaction_w > -0.01 AND interaction_w < 0.01) THEN
    UPDATE personalization_profiles
    SET total_interactions = total_interactions + 1, updated_at = NOW()
    WHERE personalization_id = p_pers_id;
    RETURN;
  END IF;

  SELECT embedding_minilm INTO article_emb
  FROM published_articles WHERE id = p_article_id;

  IF article_emb IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO engagement_buffer (personalization_id, article_id, embedding_minilm, interaction_weight, event_type)
  VALUES (p_pers_id, p_article_id, article_emb, interaction_w, p_event_type);

  UPDATE personalization_profiles
  SET total_interactions = total_interactions + 1, updated_at = NOW()
  WHERE personalization_id = p_pers_id;
END;
$$ LANGUAGE plpgsql;

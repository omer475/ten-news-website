-- Migration 042: Typed entity signals system
-- Adds typed_signals column to published_articles and creates user_entity_signals table

-- Step 2: Add typed_signals column to published_articles
ALTER TABLE published_articles
ADD COLUMN IF NOT EXISTS typed_signals jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_published_articles_typed_signals
ON published_articles USING gin (typed_signals);

-- Step 5: Create user_entity_signals table (unified behavioral signal store)
CREATE TABLE IF NOT EXISTS user_entity_signals (
  user_id uuid NOT NULL,
  entity text NOT NULL,
  positive_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity)
);

CREATE INDEX IF NOT EXISTS idx_user_entity_signals_user
ON user_entity_signals (user_id);

CREATE INDEX IF NOT EXISTS idx_user_entity_signals_entity
ON user_entity_signals (entity);

-- Bulk update RPC: inserts or increments signal counts in one call
-- Note: existing table uses updated_at, not last_updated. This RPC handles both.
CREATE OR REPLACE FUNCTION bulk_update_entity_signals(
  p_user_id uuid,
  p_signals text[],
  p_is_positive boolean
) RETURNS void AS $$
BEGIN
  INSERT INTO user_entity_signals (user_id, entity, positive_count, negative_count, updated_at)
  SELECT
    p_user_id,
    unnest(p_signals),
    CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN p_is_positive THEN 0 ELSE 1 END,
    NOW()
  ON CONFLICT (user_id, entity) DO UPDATE SET
    positive_count = user_entity_signals.positive_count +
      CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    negative_count = user_entity_signals.negative_count +
      CASE WHEN p_is_positive THEN 0 ELSE 1 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

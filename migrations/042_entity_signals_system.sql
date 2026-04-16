-- Migration 042: Replace dual tag_profile/skip_profile with unified entity_signals
-- Root cause fix: the additive dual-counter system saturates both profiles for any
-- entity seen enough times, regardless of net engagement direction.
-- The new system tracks positive/negative counts with time windows.

-- ============================================================
-- 1. Create user_entity_signals table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_entity_signals (
  user_id uuid NOT NULL,
  entity text NOT NULL,
  positive_count int DEFAULT 0,
  negative_count int DEFAULT 0,
  positive_24h int DEFAULT 0,
  negative_24h int DEFAULT 0,
  positive_7d int DEFAULT 0,
  negative_7d int DEFAULT 0,
  last_positive_at timestamptz,
  last_negative_at timestamptz,
  updated_at timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, entity)
);

CREATE INDEX IF NOT EXISTS idx_entity_signals_user ON user_entity_signals (user_id);
CREATE INDEX IF NOT EXISTS idx_entity_signals_updated ON user_entity_signals (user_id, updated_at DESC);

-- ============================================================
-- 2. RPC: update_entity_signal
-- Called on every engaged/skipped event. Increments the right counters.
-- ============================================================

CREATE OR REPLACE FUNCTION update_entity_signal(
  p_user_id uuid,
  p_entity text,
  p_is_positive boolean,
  p_event_at timestamptz DEFAULT NOW()
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_entity_signals (user_id, entity,
    positive_count, negative_count,
    positive_24h, negative_24h,
    positive_7d, negative_7d,
    last_positive_at, last_negative_at, updated_at)
  VALUES (
    p_user_id,
    lower(p_entity),
    CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN p_is_positive THEN p_event_at ELSE NULL END,
    CASE WHEN NOT p_is_positive THEN p_event_at ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id, entity) DO UPDATE SET
    positive_count = user_entity_signals.positive_count + CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    negative_count = user_entity_signals.negative_count + CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    positive_24h = user_entity_signals.positive_24h + CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    negative_24h = user_entity_signals.negative_24h + CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    positive_7d = user_entity_signals.positive_7d + CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    negative_7d = user_entity_signals.negative_7d + CASE WHEN NOT p_is_positive THEN 1 ELSE 0 END,
    last_positive_at = CASE WHEN p_is_positive THEN p_event_at ELSE user_entity_signals.last_positive_at END,
    last_negative_at = CASE WHEN NOT p_is_positive THEN p_event_at ELSE user_entity_signals.last_negative_at END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. RPC: decay_entity_signal_windows
-- Call periodically (every hour or on read) to slide the 24h/7d windows.
-- Resets 24h/7d counters by recomputing from events.
-- ============================================================

CREATE OR REPLACE FUNCTION decay_entity_signal_windows(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Recompute 24h and 7d windows from actual event data
  UPDATE user_entity_signals ues
  SET
    positive_24h = COALESCE(fresh.pos_24h, 0),
    negative_24h = COALESCE(fresh.neg_24h, 0),
    positive_7d = COALESCE(fresh.pos_7d, 0),
    negative_7d = COALESCE(fresh.neg_7d, 0),
    updated_at = NOW()
  FROM (
    SELECT
      lower(tag) as entity,
      COUNT(*) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit') AND uae.created_at > NOW() - INTERVAL '24 hours') as pos_24h,
      COUNT(*) FILTER (WHERE uae.event_type = 'article_skipped' AND uae.created_at > NOW() - INTERVAL '24 hours') as neg_24h,
      COUNT(*) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit') AND uae.created_at > NOW() - INTERVAL '7 days') as pos_7d,
      COUNT(*) FILTER (WHERE uae.event_type = 'article_skipped' AND uae.created_at > NOW() - INTERVAL '7 days') as neg_7d
    FROM user_article_events uae
    JOIN published_articles pa ON pa.id = uae.article_id,
    LATERAL unnest(
      CASE
        WHEN pa.interest_tags IS NOT NULL AND jsonb_typeof(pa.interest_tags::jsonb) = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(pa.interest_tags::jsonb))
        ELSE ARRAY[]::text[]
      END
    ) AS tag
    WHERE uae.user_id = p_user_id
    AND uae.created_at > NOW() - INTERVAL '7 days'
    GROUP BY lower(tag)
  ) fresh
  WHERE ues.user_id = p_user_id
  AND ues.entity = fresh.entity;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Backfill: populate entity_signals from existing event history
-- ============================================================

INSERT INTO user_entity_signals (user_id, entity, positive_count, negative_count, positive_7d, negative_7d, positive_24h, negative_24h, last_positive_at, last_negative_at, updated_at)
SELECT
  uae.user_id,
  lower(tag) as entity,
  COUNT(*) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit')) as positive_count,
  COUNT(*) FILTER (WHERE uae.event_type = 'article_skipped') as negative_count,
  COUNT(*) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit') AND uae.created_at > NOW() - INTERVAL '7 days') as positive_7d,
  COUNT(*) FILTER (WHERE uae.event_type = 'article_skipped' AND uae.created_at > NOW() - INTERVAL '7 days') as negative_7d,
  COUNT(*) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit') AND uae.created_at > NOW() - INTERVAL '24 hours') as positive_24h,
  COUNT(*) FILTER (WHERE uae.event_type = 'article_skipped' AND uae.created_at > NOW() - INTERVAL '24 hours') as negative_24h,
  MAX(uae.created_at) FILTER (WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit')) as last_positive_at,
  MAX(uae.created_at) FILTER (WHERE uae.event_type = 'article_skipped') as last_negative_at,
  NOW()
FROM user_article_events uae
JOIN published_articles pa ON pa.id = uae.article_id,
LATERAL unnest(
  CASE
    WHEN pa.interest_tags IS NOT NULL AND jsonb_typeof(pa.interest_tags::jsonb) = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(pa.interest_tags::jsonb))
    ELSE ARRAY[]::text[]
  END
) AS tag
WHERE uae.event_type IN ('article_engaged','article_liked','article_saved','article_shared','article_revisit','article_skipped')
GROUP BY uae.user_id, lower(tag)
ON CONFLICT (user_id, entity) DO UPDATE SET
  positive_count = EXCLUDED.positive_count,
  negative_count = EXCLUDED.negative_count,
  positive_7d = EXCLUDED.positive_7d,
  negative_7d = EXCLUDED.negative_7d,
  positive_24h = EXCLUDED.positive_24h,
  negative_24h = EXCLUDED.negative_24h,
  last_positive_at = EXCLUDED.last_positive_at,
  last_negative_at = EXCLUDED.last_negative_at,
  updated_at = NOW();

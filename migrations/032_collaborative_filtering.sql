-- Migration 032: Collaborative filtering, article popularity, and likes
--
-- Three new feed signals:
-- 1. Article popularity: like_count + engagement_count on published_articles
-- 2. Entity-based collaborative filtering: "users who like galatasaray also liked..."
-- 3. Like feature: article_liked event type with popularity tracking
--
-- How collaborative filtering works:
-- - Extract user's top 10 tags from tag_profile (e.g., "galatasaray", "nba", "ai")
-- - Find other users who share >= 2 of these tags with weight > 0.1
-- - Return articles those similar users recently engaged/liked
-- - These articles get a boost in the feed based on recommender count

-- 1. Article popularity columns
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS engagement_count INT DEFAULT 0;

-- 2. Partial indexes for popularity-aware queries (only index non-zero rows)
CREATE INDEX IF NOT EXISTS idx_articles_engagement_count
  ON published_articles(engagement_count DESC) WHERE engagement_count > 0;
CREATE INDEX IF NOT EXISTS idx_articles_like_count
  ON published_articles(like_count DESC) WHERE like_count > 0;

-- 3. Atomic increment: article engagement count
-- Called on article_engaged, article_saved, article_revisit
CREATE OR REPLACE FUNCTION increment_article_engagement(p_article_id BIGINT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE published_articles
  SET engagement_count = COALESCE(engagement_count, 0) + 1
  WHERE id = p_article_id;
$$;

-- 4. Atomic increment: article like count
-- Called on article_liked
CREATE OR REPLACE FUNCTION increment_article_like(p_article_id BIGINT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE published_articles
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = p_article_id;
$$;

-- 5. GIN index on tag_profile for efficient JSONB key lookups (? operator)
CREATE INDEX IF NOT EXISTS idx_profiles_tag_profile_gin
  ON profiles USING gin (tag_profile);

-- 6. Collaborative filtering RPC
-- Entity-based user matching: finds articles engaged by users with similar interests.
-- Performance: GIN index makes tag_profile ? 'key' fast. For 50-500 users this
-- completes in <50ms. For 10K+ users, consider pre-computed similarity tables.
CREATE OR REPLACE FUNCTION get_collab_articles(
  p_user_id UUID,
  p_limit INT DEFAULT 50,
  p_hours INT DEFAULT 168  -- 7 days default
)
RETURNS TABLE(article_id BIGINT, recommender_count INT)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_top_tags TEXT[];
BEGIN
  -- Step 1: Get user's top 10 tags by weight (excluding metadata keys like _last_updated)
  SELECT ARRAY(
    SELECT key
    FROM jsonb_each_text(COALESCE(
      (SELECT tag_profile FROM profiles WHERE id = p_user_id),
      '{}'::jsonb
    ))
    WHERE key NOT LIKE E'\\_%'
    ORDER BY value::float DESC
    LIMIT 10
  ) INTO v_top_tags;

  -- No tags = no collaborative recommendations
  IF v_top_tags IS NULL OR array_length(v_top_tags, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Step 2: Find users sharing >= 2 tags → get their engaged articles
  RETURN QUERY
  WITH tag_matches AS (
    -- For each of user's top tags, find other users who also have it with weight > 0.1
    SELECT p.id AS uid, t.tag
    FROM profiles p
    CROSS JOIN unnest(v_top_tags) AS t(tag)
    WHERE p.id != p_user_id
      AND p.tag_profile IS NOT NULL
      AND p.tag_profile ? t.tag
      AND COALESCE((p.tag_profile->>t.tag)::float, 0) > 0.1
  ),
  similar_users AS (
    -- Only keep users who share at least 2 tags (meaningful overlap)
    SELECT uid, COUNT(DISTINCT tag)::int AS shared_count
    FROM tag_matches
    GROUP BY uid
    HAVING COUNT(DISTINCT tag) >= 2
    ORDER BY COUNT(DISTINCT tag) DESC
    LIMIT 50
  ),
  their_articles AS (
    -- Get articles these similar users engaged with recently
    SELECT e.article_id, COUNT(DISTINCT e.user_id)::int AS rec_count
    FROM user_article_events e
    INNER JOIN similar_users su ON e.user_id = su.uid
    WHERE e.event_type IN ('article_engaged', 'article_saved', 'article_liked', 'article_revisit')
      AND e.created_at > NOW() - make_interval(hours => p_hours)
      AND NOT EXISTS (
        -- Exclude articles the target user has already seen
        SELECT 1 FROM user_article_events uae
        WHERE uae.user_id = p_user_id AND uae.article_id = e.article_id
      )
    GROUP BY e.article_id
    ORDER BY rec_count DESC
    LIMIT p_limit
  )
  SELECT ta.article_id, ta.rec_count FROM their_articles ta;
END;
$$;

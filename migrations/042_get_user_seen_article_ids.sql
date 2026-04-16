-- Returns DISTINCT article_ids for a user's events within a time window.
-- Solves the LIMIT overflow problem where 5000 raw events only covers
-- ~500 unique articles due to multiple events per article.
CREATE OR REPLACE FUNCTION get_user_seen_article_ids(
  p_user_id UUID,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days'
)
RETURNS TABLE(article_id BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT article_id
  FROM user_article_events
  WHERE user_id = p_user_id
  AND created_at >= p_since
  AND article_id IS NOT NULL;
$$;

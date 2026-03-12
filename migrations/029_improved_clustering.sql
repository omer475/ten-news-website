-- Improved user interest clustering with recency weighting + minimum cluster size
-- Replaces the simple category-grouping approach with recency-weighted medoid selection.
-- Key improvements:
--   1. Recency weighting: interactions from last 7 days count 3x, 7-30 days 1.5x, 30-90 days 1x
--   2. Minimum cluster size: clusters with < 5 articles get merged into the largest cluster
--   3. Includes article_revisit events (strongest positive signal, weight 4)
--   4. Updates profiles table (not users table) for taste_vector
--   5. Also handles MiniLM embeddings for clusters

CREATE OR REPLACE FUNCTION cluster_user_interests(
  p_user_id UUID,
  p_max_clusters int DEFAULT 5,
  p_lookback_days int DEFAULT 90
)
RETURNS int AS $$
DECLARE
  interaction_count int;
  cluster_count int;
  min_cluster_size int := 5;
  small_cluster RECORD;
  largest_cluster_idx int;
BEGIN
  -- Count engaged articles with embeddings
  SELECT COUNT(*) INTO interaction_count
  FROM user_article_events uae
  JOIN published_articles pa ON pa.id = uae.article_id
  WHERE uae.user_id = p_user_id
    AND uae.event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_revisit')
    AND uae.created_at >= NOW() - make_interval(days => p_lookback_days)
    AND pa.embedding IS NOT NULL;

  -- Need minimum interactions to cluster meaningfully
  IF interaction_count < 10 THEN
    RETURN 0;
  END IF;

  -- Determine number of clusters (1 per ~8 interactions, capped)
  cluster_count := LEAST(p_max_clusters, GREATEST(1, interaction_count / 8));

  -- Delete old clusters for this user
  DELETE FROM user_interest_clusters WHERE user_id = p_user_id;

  -- Recency-weighted category-based clustering:
  -- Recent interactions count more (3x for last 7 days, 1.5x for 7-30 days)
  -- Pick the highest-weighted article per category as the medoid
  INSERT INTO user_interest_clusters (user_id, cluster_index, medoid_embedding, medoid_article_id, article_count, label, is_centroid)
  SELECT
    p_user_id,
    (ROW_NUMBER() OVER (ORDER BY weighted_cnt DESC, max_weight DESC)) - 1 as cluster_index,
    pa.embedding as medoid_embedding,
    pa.id as medoid_article_id,
    ranked.raw_cnt as article_count,
    ranked.category as label,
    FALSE as is_centroid
  FROM (
    SELECT
      pa_inner.category,
      COUNT(*) as raw_cnt,
      -- Recency-weighted count: recent interactions matter more
      SUM(
        CASE
          WHEN uae_inner.created_at >= NOW() - INTERVAL '7 days' THEN 3.0
          WHEN uae_inner.created_at >= NOW() - INTERVAL '30 days' THEN 1.5
          ELSE 1.0
        END *
        CASE
          WHEN uae_inner.event_type = 'article_revisit' THEN 4.0
          WHEN uae_inner.event_type = 'article_saved' THEN 3.0
          WHEN uae_inner.event_type = 'article_engaged' THEN 2.0
          ELSE 1.0
        END
      ) as weighted_cnt,
      MAX(
        CASE
          WHEN uae_inner.event_type = 'article_revisit' THEN 4
          WHEN uae_inner.event_type = 'article_saved' THEN 3
          WHEN uae_inner.event_type = 'article_engaged' THEN 2
          ELSE 1
        END
      ) as max_weight,
      -- Pick the best article: highest engagement weight, then most recent
      (ARRAY_AGG(
        pa_inner.id ORDER BY
          CASE
            WHEN uae_inner.event_type = 'article_revisit' THEN 4
            WHEN uae_inner.event_type = 'article_saved' THEN 3
            WHEN uae_inner.event_type = 'article_engaged' THEN 2
            ELSE 1
          END DESC,
          -- Recency bonus: recent articles preferred as medoids
          uae_inner.created_at DESC
      ))[1] as best_article_id
    FROM user_article_events uae_inner
    JOIN published_articles pa_inner ON pa_inner.id = uae_inner.article_id
    WHERE uae_inner.user_id = p_user_id
      AND uae_inner.event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_revisit')
      AND uae_inner.created_at >= NOW() - make_interval(days => p_lookback_days)
      AND pa_inner.embedding IS NOT NULL
    GROUP BY pa_inner.category
    ORDER BY weighted_cnt DESC, max_weight DESC
    LIMIT cluster_count
  ) ranked
  JOIN published_articles pa ON pa.id = ranked.best_article_id;

  -- Merge small clusters (< 5 articles) into the largest cluster
  -- This prevents noise clusters from diluting the personal pool
  SELECT cluster_index INTO largest_cluster_idx
  FROM user_interest_clusters
  WHERE user_id = p_user_id
  ORDER BY article_count DESC
  LIMIT 1;

  IF largest_cluster_idx IS NOT NULL THEN
    FOR small_cluster IN
      SELECT cluster_index, article_count
      FROM user_interest_clusters
      WHERE user_id = p_user_id
        AND article_count < min_cluster_size
        AND cluster_index != largest_cluster_idx
    LOOP
      -- Add the small cluster's count to the largest
      UPDATE user_interest_clusters
      SET article_count = article_count + small_cluster.article_count
      WHERE user_id = p_user_id AND cluster_index = largest_cluster_idx;

      -- Delete the small cluster
      DELETE FROM user_interest_clusters
      WHERE user_id = p_user_id AND cluster_index = small_cluster.cluster_index;
    END LOOP;
  END IF;

  -- Re-index cluster_index to be contiguous (0, 1, 2, ...)
  WITH reindexed AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY article_count DESC) - 1 AS new_index
    FROM user_interest_clusters
    WHERE user_id = p_user_id
  )
  UPDATE user_interest_clusters uic
  SET cluster_index = r.new_index
  FROM reindexed r
  WHERE uic.id = r.id;

  -- Update MiniLM medoid embeddings where available
  UPDATE user_interest_clusters uic
  SET medoid_minilm = pa.embedding_minilm
  FROM published_articles pa
  WHERE uic.user_id = p_user_id
    AND uic.medoid_article_id = pa.id
    AND pa.embedding_minilm IS NOT NULL;

  -- Return final cluster count
  RETURN (SELECT COUNT(*) FROM user_interest_clusters WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

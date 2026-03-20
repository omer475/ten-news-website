-- Cross-session learning improvements (6 changes)
-- 1. Session momentum persistence
-- 2. Tag profile decay bug fix (code-only)
-- 3. Dwell-time weighted EMA
-- 4. Faster cold-start (warm-up EMA + earlier clustering)
-- 5. Smarter discovery (code-only)
-- 6. Topic saturation tracking

-- Change 1: Persist session momentum across sessions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_momentum JSONB DEFAULT '{}';

-- Change 4: Cache engagement count to avoid COUNT queries in RPC
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS engagement_count INT DEFAULT 0;

-- Change 6: Topic saturation tracking (diminishing returns for repeated topics)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS topic_saturation JSONB DEFAULT '{}';

-- Changes 3+4: Updated EMA RPC with dwell-time modulation + granular warm-up
CREATE OR REPLACE FUNCTION update_taste_vector_ema_profiles(
    p_user_id UUID,
    p_article_id BIGINT,
    p_event_type TEXT,
    p_dwell_seconds FLOAT DEFAULT 0,
    p_engagement_count INT DEFAULT -1
) RETURNS VOID AS $$
DECLARE
    article_emb JSONB;
    article_emb_minilm JSONB;
    current_taste JSONB;
    current_taste_minilm JSONB;
    alpha FLOAT;
    is_skip BOOLEAN;
    new_taste FLOAT[];
    new_taste_minilm FLOAT[];
    dim INT;
    i INT;
    interaction_count INT;
    cold_start_multiplier FLOAT;
    dwell_multiplier FLOAT;
BEGIN
    is_skip := (p_event_type = 'article_skipped');

    -- Use cached engagement_count from profiles, or fall back to COUNT query
    SELECT engagement_count INTO interaction_count FROM profiles WHERE id = p_user_id;
    IF interaction_count IS NULL OR interaction_count <= 0 THEN
        SELECT COUNT(*) INTO interaction_count
        FROM user_article_events
        WHERE user_id = p_user_id
          AND event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_revisit');
        UPDATE profiles SET engagement_count = interaction_count WHERE id = p_user_id;
    ELSE
        -- Increment cached count
        interaction_count := interaction_count + 1;
        UPDATE profiles SET engagement_count = interaction_count WHERE id = p_user_id;
    END IF;

    -- Change 4: Granular warm-up EMA (finer-grained than previous 3x/1x split)
    -- Engagements 1-5: 3x, 6-15: 2x, 16-30: 1.5x, 30+: 1x
    IF interaction_count <= 5 THEN
        cold_start_multiplier := 3.0;
    ELSIF interaction_count <= 15 THEN
        cold_start_multiplier := 2.0;
    ELSIF interaction_count <= 30 THEN
        cold_start_multiplier := 1.5;
    ELSE
        cold_start_multiplier := 1.0;
    END IF;

    -- Event type weights (base alpha)
    alpha := CASE p_event_type
        WHEN 'article_revisit' THEN 0.20
        WHEN 'article_saved' THEN 0.15
        WHEN 'article_engaged' THEN 0.10
        WHEN 'article_detail_view' THEN 0.05
        WHEN 'article_skipped' THEN 0.03
        ELSE 0.02
    END;

    -- Change 3: Dwell-time modulation of alpha
    -- Deep read (20s+): 1.8x, moderate (10-20s): 1.3x, quick (<10s): 1x
    IF p_dwell_seconds >= 20 THEN
        dwell_multiplier := 1.8;
    ELSIF p_dwell_seconds >= 10 THEN
        dwell_multiplier := 1.3;
    ELSE
        dwell_multiplier := 1.0;
    END IF;

    -- Apply both multipliers (cap at 0.50 to avoid wild swings)
    alpha := LEAST(alpha * cold_start_multiplier * dwell_multiplier, 0.50);

    -- Get article embeddings
    SELECT embedding, embedding_minilm INTO article_emb, article_emb_minilm
    FROM published_articles WHERE id = p_article_id;

    IF article_emb IS NULL AND article_emb_minilm IS NULL THEN
        RETURN;
    END IF;

    -- Get current taste vectors from profiles
    SELECT taste_vector, taste_vector_minilm INTO current_taste, current_taste_minilm
    FROM profiles WHERE id = p_user_id;

    -- Update Gemini taste vector
    IF article_emb IS NOT NULL THEN
        IF current_taste IS NULL THEN
            IF NOT is_skip THEN
                UPDATE profiles SET taste_vector = article_emb WHERE id = p_user_id;
            END IF;
        ELSE
            dim := jsonb_array_length(article_emb);
            new_taste := ARRAY[]::FLOAT[];
            IF is_skip THEN
                FOR i IN 0..dim-1 LOOP
                    new_taste := array_append(new_taste,
                        (1.0 + alpha) * (current_taste->>i)::FLOAT - alpha * (article_emb->>i)::FLOAT
                    );
                END LOOP;
            ELSE
                FOR i IN 0..dim-1 LOOP
                    new_taste := array_append(new_taste,
                        (1.0 - alpha) * (current_taste->>i)::FLOAT + alpha * (article_emb->>i)::FLOAT
                    );
                END LOOP;
            END IF;
            UPDATE profiles SET taste_vector = to_jsonb(new_taste) WHERE id = p_user_id;
        END IF;
    END IF;

    -- Update MiniLM taste vector
    IF article_emb_minilm IS NOT NULL THEN
        IF current_taste_minilm IS NULL THEN
            IF NOT is_skip THEN
                UPDATE profiles SET taste_vector_minilm = article_emb_minilm WHERE id = p_user_id;
            END IF;
        ELSE
            dim := jsonb_array_length(article_emb_minilm);
            new_taste_minilm := ARRAY[]::FLOAT[];
            IF is_skip THEN
                FOR i IN 0..dim-1 LOOP
                    new_taste_minilm := array_append(new_taste_minilm,
                        (1.0 + alpha) * (current_taste_minilm->>i)::FLOAT - alpha * (article_emb_minilm->>i)::FLOAT
                    );
                END LOOP;
            ELSE
                FOR i IN 0..dim-1 LOOP
                    new_taste_minilm := array_append(new_taste_minilm,
                        (1.0 - alpha) * (current_taste_minilm->>i)::FLOAT + alpha * (article_emb_minilm->>i)::FLOAT
                    );
                END LOOP;
            END IF;
            UPDATE profiles SET taste_vector_minilm = to_jsonb(new_taste_minilm) WHERE id = p_user_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Change 4: Lower minimum interaction count for clustering (was 10, now 5)
-- Enables clustering to trigger at 8 engagements
CREATE OR REPLACE FUNCTION cluster_user_interests(
  p_user_id UUID,
  p_max_clusters int DEFAULT 5,
  p_lookback_days int DEFAULT 90
)
RETURNS int AS $$
DECLARE
  interaction_count int;
  cluster_count int;
  min_cluster_size int := 3;
  small_cluster RECORD;
  largest_cluster_idx int;
BEGIN
  SELECT COUNT(*) INTO interaction_count
  FROM user_article_events uae
  JOIN published_articles pa ON pa.id = uae.article_id
  WHERE uae.user_id = p_user_id
    AND uae.event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_revisit')
    AND uae.created_at >= NOW() - make_interval(days => p_lookback_days)
    AND pa.embedding IS NOT NULL;

  -- Lowered from 10 to 5 for faster cold-start clustering
  IF interaction_count < 5 THEN
    RETURN 0;
  END IF;

  cluster_count := LEAST(p_max_clusters, GREATEST(1, interaction_count / 8));

  DELETE FROM user_interest_clusters WHERE user_id = p_user_id;

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
      (ARRAY_AGG(
        pa_inner.id ORDER BY
          CASE
            WHEN uae_inner.event_type = 'article_revisit' THEN 4
            WHEN uae_inner.event_type = 'article_saved' THEN 3
            WHEN uae_inner.event_type = 'article_engaged' THEN 2
            ELSE 1
          END DESC,
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

  -- Merge small clusters (< 3 articles, lowered from 5)
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
      UPDATE user_interest_clusters
      SET article_count = article_count + small_cluster.article_count
      WHERE user_id = p_user_id AND cluster_index = largest_cluster_idx;

      DELETE FROM user_interest_clusters
      WHERE user_id = p_user_id AND cluster_index = small_cluster.cluster_index;
    END LOOP;
  END IF;

  WITH reindexed AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY article_count DESC) - 1 AS new_index
    FROM user_interest_clusters
    WHERE user_id = p_user_id
  )
  UPDATE user_interest_clusters uic
  SET cluster_index = r.new_index
  FROM reindexed r
  WHERE uic.id = r.id;

  UPDATE user_interest_clusters uic
  SET medoid_minilm = pa.embedding_minilm
  FROM published_articles pa
  WHERE uic.user_id = p_user_id
    AND uic.medoid_article_id = pa.id
    AND pa.embedding_minilm IS NOT NULL;

  RETURN (SELECT COUNT(*) FROM user_interest_clusters WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

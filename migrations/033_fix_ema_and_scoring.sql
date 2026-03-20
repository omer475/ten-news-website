-- Migration 033: Fix EMA taste vector function
--
-- Problem: The 5-param version was dropped to fix PostgREST overloading.
-- Now only the 3-param version (migration 027) is active, which means:
--   - Dwell-time weighting is NOT working (p_dwell_seconds ignored)
--   - Engagement count caching is NOT working
--
-- Fix: Drop old 3-param version, create single 4-param version with DEFAULT.
-- PostgREST will match both 3-param and 4-param calls to this single function.

-- Step 1: Drop the old 3-param version
DROP FUNCTION IF EXISTS update_taste_vector_ema_profiles(UUID, BIGINT, TEXT);

-- Step 2: Create unified version (4 params, last one has DEFAULT)
CREATE OR REPLACE FUNCTION update_taste_vector_ema_profiles(
    p_user_id UUID,
    p_article_id BIGINT,
    p_event_type TEXT,
    p_dwell_seconds DOUBLE PRECISION DEFAULT 0
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

    -- Read and increment cached engagement_count from profiles
    SELECT COALESCE(engagement_count, 0) INTO interaction_count
    FROM profiles WHERE id = p_user_id;

    IF interaction_count <= 0 THEN
        -- First time or reset: count from events table
        SELECT COUNT(*) INTO interaction_count
        FROM user_article_events
        WHERE user_id = p_user_id
          AND event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_revisit');
    END IF;

    interaction_count := interaction_count + 1;
    UPDATE profiles SET engagement_count = interaction_count WHERE id = p_user_id;

    -- Granular warm-up EMA:
    -- Engagements 1-5: 3x (taste vector moves fast, learns from first impressions)
    -- Engagements 6-15: 2x (still learning, but less volatile)
    -- Engagements 16-30: 1.5x (converging)
    -- 30+: 1x (stable)
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
        WHEN 'article_liked' THEN 0.18
        WHEN 'article_revisit' THEN 0.20
        WHEN 'article_saved' THEN 0.15
        WHEN 'article_engaged' THEN 0.10
        WHEN 'article_detail_view' THEN 0.05
        WHEN 'article_skipped' THEN 0.03
        ELSE 0.02
    END;

    -- Dwell-time modulation: deep reads shift the vector more
    -- 20s+: 1.8x, 10-20s: 1.3x, <10s: 1x
    IF p_dwell_seconds >= 20 THEN
        dwell_multiplier := 1.8;
    ELSIF p_dwell_seconds >= 10 THEN
        dwell_multiplier := 1.3;
    ELSE
        dwell_multiplier := 1.0;
    END IF;

    -- Apply both multipliers (cap at 0.50 to prevent wild swings)
    alpha := LEAST(alpha * cold_start_multiplier * dwell_multiplier, 0.50);

    -- Get article embeddings
    SELECT embedding, embedding_minilm INTO article_emb, article_emb_minilm
    FROM published_articles WHERE id = p_article_id;

    IF article_emb IS NULL AND article_emb_minilm IS NULL THEN
        RETURN;
    END IF;

    -- Get current taste vectors
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

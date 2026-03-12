-- Aggressive EMA for cold-start users: alpha 3x higher for first 20 interactions
-- After 20 events the taste vector has enough signal, so standard alpha applies.

CREATE OR REPLACE FUNCTION update_taste_vector_ema_profiles(
    p_user_id UUID,
    p_article_id BIGINT,
    p_event_type TEXT
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
BEGIN
    is_skip := (p_event_type = 'article_skipped');

    -- Count user's total taste-updating interactions for cold-start detection
    SELECT COUNT(*) INTO interaction_count
    FROM user_article_events
    WHERE user_id = p_user_id
      AND event_type IN ('article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_revisit');

    -- Cold-start: 3x alpha for first 20 interactions, then taper to 1x by interaction 40
    IF interaction_count < 20 THEN
        cold_start_multiplier := 3.0;
    ELSIF interaction_count < 40 THEN
        cold_start_multiplier := 3.0 - ((interaction_count - 20)::FLOAT / 20.0) * 2.0; -- 3.0 → 1.0
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

    -- Apply cold-start multiplier (cap at 0.5 to avoid wild swings)
    alpha := LEAST(alpha * cold_start_multiplier, 0.50);

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

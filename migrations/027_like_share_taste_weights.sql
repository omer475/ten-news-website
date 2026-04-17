-- Migration 027: Add article_liked and article_shared weights to taste vector EMA
-- These are the strongest positive signals — explicit user intent
-- Like = "I want more of this", Share = "I vouch for this content"

CREATE OR REPLACE FUNCTION update_taste_vector_ema_profiles(
    p_user_id UUID,
    p_article_id BIGINT,
    p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
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
BEGIN
    -- Determine if this is a skip (reverse) or positive signal
    is_skip := (p_event_type = 'article_skipped');

    -- Event type weights
    -- article_liked is the strongest — explicit "I want more of this"
    -- article_shared is second — user vouches for this content publicly
    alpha := CASE p_event_type
        WHEN 'article_liked' THEN 0.20
        WHEN 'article_shared' THEN 0.18
        WHEN 'article_saved' THEN 0.15
        WHEN 'article_engaged' THEN 0.10
        WHEN 'article_detail_view' THEN 0.05
        WHEN 'article_skipped' THEN 0.03
        ELSE 0.02
    END;

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
            FOR i IN 0..dim-1 LOOP
                IF is_skip THEN
                    new_taste := new_taste || ((current_taste->>i)::FLOAT * (1.0 + alpha * 0.5) - (article_emb->>i)::FLOAT * alpha * 0.5);
                ELSE
                    new_taste := new_taste || ((current_taste->>i)::FLOAT * (1.0 - alpha) + (article_emb->>i)::FLOAT * alpha);
                END IF;
            END LOOP;
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
            FOR i IN 0..dim-1 LOOP
                IF is_skip THEN
                    new_taste_minilm := new_taste_minilm || ((current_taste_minilm->>i)::FLOAT * (1.0 + alpha * 0.5) - (article_emb_minilm->>i)::FLOAT * alpha * 0.5);
                ELSE
                    new_taste_minilm := new_taste_minilm || ((current_taste_minilm->>i)::FLOAT * (1.0 - alpha) + (article_emb_minilm->>i)::FLOAT * alpha);
                END IF;
            END LOOP;
            UPDATE profiles SET taste_vector_minilm = to_jsonb(new_taste_minilm) WHERE id = p_user_id;
        END IF;
    END IF;
END;
$$;

-- Add taste vector columns to profiles table
-- Real users live in profiles (id = auth user UUID), not the users table.
-- The feed API and analytics need these columns on profiles to work.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS taste_vector JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS taste_vector_minilm JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skip_profile JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS similarity_floor FLOAT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followed_countries JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followed_topics JSONB;

-- RPC: Update taste vector via EMA on profiles table
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
BEGIN
    -- Determine if this is a skip (reverse) or positive signal
    is_skip := (p_event_type = 'article_skipped');

    -- Event type weights
    -- article_view is no longer sent here (passive views pollute the vector)
    alpha := CASE p_event_type
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
            -- For skips, don't initialize taste vector from skipped content
            IF NOT is_skip THEN
                UPDATE profiles SET taste_vector = article_emb WHERE id = p_user_id;
            END IF;
        ELSE
            dim := jsonb_array_length(article_emb);
            new_taste := ARRAY[]::FLOAT[];
            IF is_skip THEN
                -- Reverse EMA: push vector AWAY from skipped content
                FOR i IN 0..dim-1 LOOP
                    new_taste := array_append(new_taste,
                        (1.0 + alpha) * (current_taste->>i)::FLOAT - alpha * (article_emb->>i)::FLOAT
                    );
                END LOOP;
            ELSE
                -- Normal EMA: pull vector toward engaged content
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

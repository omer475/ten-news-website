-- ============================================================
-- 025: CONCEPT ENTITIES TABLE
-- ============================================================
-- Stores ~2,000+ real-world entities with embeddings for:
-- 1. Semantic article tagging (ANN lookup)
-- 2. Explore page with beautiful display titles
-- ============================================================

CREATE TABLE IF NOT EXISTS concept_entities (
  id BIGSERIAL PRIMARY KEY,
  entity_name TEXT NOT NULL UNIQUE,           -- normalized for matching: "galatasaray"
  display_title TEXT NOT NULL,                -- beautiful title: "Galatasaray & Turkish Super Lig"
  seed_text TEXT NOT NULL,                    -- for initial embedding generation
  embedding VECTOR(384),                      -- MiniLM 384-dim vector
  category TEXT,                              -- grouping: "Sports", "Tech", "Politics", etc.
  aliases TEXT[],                             -- alternative names
  popularity_score INTEGER DEFAULT 1,         -- default ranking weight
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast ANN cosine similarity search
CREATE INDEX IF NOT EXISTS concept_entities_embedding_hnsw
  ON concept_entities USING hnsw (embedding vector_cosine_ops);

-- Index for category-based queries on Explore page
CREATE INDEX IF NOT EXISTS concept_entities_category_idx
  ON concept_entities (category);

-- Index for entity_name lookups (tag_profile → display_title)
CREATE INDEX IF NOT EXISTS concept_entities_name_idx
  ON concept_entities (entity_name);

-- ============================================================
-- RPC function for ANN similarity lookup (called by pipeline)
-- ============================================================
CREATE OR REPLACE FUNCTION match_concept_entities(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.35,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  entity_name TEXT,
  display_title TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.entity_name,
    ce.display_title,
    ce.category,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM concept_entities ce
  WHERE ce.embedding IS NOT NULL
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

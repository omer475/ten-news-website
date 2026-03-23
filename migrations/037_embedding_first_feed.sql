-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 037: Embedding-First Feed Architecture
--
-- Creates infrastructure for embedding-based personalization:
-- 1. subtopic_embeddings: pre-computed embedding per onboarding subtopic
-- 2. concept_entities.avg_article_embedding: per-entity article embedding
-- 3. match_explore_entities(): pgvector ANN search for explore page
-- ═══════════════════════════════════════════════════════════════

-- 1. Subtopic embeddings table
CREATE TABLE IF NOT EXISTS subtopic_embeddings (
  subtopic_name TEXT PRIMARY KEY,
  embedding_minilm vector(384),
  article_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add avg_article_embedding to concept_entities
ALTER TABLE concept_entities
ADD COLUMN IF NOT EXISTS avg_article_embedding vector(384);

-- 3. RPC: Find explore entities by embedding similarity
CREATE OR REPLACE FUNCTION match_explore_entities(
  query_embedding float8[],
  match_count int DEFAULT 25,
  min_similarity float8 DEFAULT 0.3
)
RETURNS TABLE (
  entity_name text,
  display_title text,
  category text,
  similarity float8
) AS $$
  SELECT
    ce.entity_name,
    ce.display_title,
    ce.category,
    1 - (ce.avg_article_embedding <=> query_embedding::vector(384)) as similarity
  FROM concept_entities ce
  WHERE ce.avg_article_embedding IS NOT NULL
    AND 1 - (ce.avg_article_embedding <=> query_embedding::vector(384)) >= min_similarity
  ORDER BY ce.avg_article_embedding <=> query_embedding::vector(384)
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 4. Index for fast entity embedding search
CREATE INDEX IF NOT EXISTS idx_concept_entities_avg_embedding
ON concept_entities USING hnsw (avg_article_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. Also add taste_vector_minilm to users table (for guest users)
-- profiles table already has it, but guest users are in users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS taste_vector_minilm JSONB DEFAULT NULL;

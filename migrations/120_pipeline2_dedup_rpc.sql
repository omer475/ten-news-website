-- Migration 120: Pipeline 2 dedup RPC + lock down internal queue tables
-- =====================================================================
-- match_recent_topics(): given a candidate brief's topic embedding, return
-- any topics still inside their cooldown window that are too similar
-- (cosine). The AI Editor calls this per brief and drops matches. Uses the
-- HNSW index on recently_covered_topics.topic_embedding.

CREATE OR REPLACE FUNCTION match_recent_topics(
  query_embedding vector(384),
  match_threshold float
)
RETURNS TABLE(topic text, brief_type varchar, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT topic,
         brief_type,
         1 - (topic_embedding <=> query_embedding) AS similarity
  FROM recently_covered_topics
  WHERE eligible_after > now()
    AND topic_embedding IS NOT NULL
    AND 1 - (topic_embedding <=> query_embedding) >= match_threshold
  ORDER BY topic_embedding <=> query_embedding
  LIMIT 5;
$$;

-- The two queue tables are internal — only the pipeline (service role, which
-- bypasses RLS) ever touches them. Enable RLS with no policies = deny-by-default
-- for anon/authenticated clients (defense in depth; quiets the security advisor).
ALTER TABLE curated_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_covered_topics ENABLE ROW LEVEL SECURITY;

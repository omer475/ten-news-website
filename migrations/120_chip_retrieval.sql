-- migrations/120_chip_retrieval.sql
--
-- Chip-tap topic feed rewrite. Applied to prod via supabase MCP on
-- 2026-05-14 alongside the API change in pages/api/feed/topic.js +
-- pages/api/feed/main.js. This file is kept in the repo for history.
--
-- Adds:
--   1. interest_tag_frequency matview — lower(tag) → article_count over
--      the last 30 days, refreshed nightly. Used to pick "Goldilocks"
--      chips (tags appearing in 3..200 articles). Below 3 = dead-end chip;
--      above 200 = too generic.
--   2. topic_knn_candidates(source_vec, k, min_sim) — embedding kNN over
--      the existing HNSW index. Lane D of the 4-lane retrieval in
--      /api/feed/topic — finds semantically related articles when no
--      lexical match exists.
--   3. article_chip_tags(article_ids) — picks up to 2 Goldilocks-band
--      tags per article id, ordered by article_count DESC. Called from
--      /api/feed/main to populate the chip_tags response field.

CREATE MATERIALIZED VIEW IF NOT EXISTS interest_tag_frequency AS
SELECT
  lower(t #>> '{}') AS tag,
  count(*)::bigint AS article_count
FROM published_articles pa,
     jsonb_array_elements(pa.interest_tags) t
WHERE pa.published_at >= NOW() - INTERVAL '30 days'
GROUP BY 1;

-- Unique index required by REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS interest_tag_frequency_tag_idx
  ON interest_tag_frequency (tag);

-- Range queries on article_count (e.g. BETWEEN 3 AND 200).
CREATE INDEX IF NOT EXISTS interest_tag_frequency_count_idx
  ON interest_tag_frequency (article_count);

-- Nightly refresh at 04:00 UTC.
SELECT cron.schedule(
  'refresh_interest_tag_frequency',
  '0 4 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY interest_tag_frequency;$$
);

CREATE OR REPLACE FUNCTION topic_knn_candidates(
  source_vec vector,
  k integer DEFAULT 30,
  min_sim float DEFAULT 0.40
)
RETURNS TABLE (id bigint, similarity float)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    pa.id,
    (1 - (pa.embedding_minilm_vec <=> source_vec))::float AS similarity
  FROM published_articles pa
  WHERE pa.embedding_minilm_vec IS NOT NULL
    AND (1 - (pa.embedding_minilm_vec <=> source_vec)) >= min_sim
  ORDER BY pa.embedding_minilm_vec <=> source_vec
  LIMIT k;
$$;

CREATE OR REPLACE FUNCTION article_chip_tags(article_ids bigint[])
RETURNS TABLE (id bigint, chip_tags text[])
LANGUAGE SQL
STABLE
AS $$
  SELECT
    a.id,
    COALESCE(
      ARRAY(
        SELECT tag
        FROM (
          SELECT
            lower(t #>> '{}') AS tag,
            f.article_count
          FROM jsonb_array_elements(a.interest_tags) t
          JOIN interest_tag_frequency f
            ON f.tag = lower(t #>> '{}')
          WHERE f.article_count BETWEEN 3 AND 200
          ORDER BY f.article_count DESC
          LIMIT 2
        ) sub
      ),
      ARRAY[]::text[]
    ) AS chip_tags
  FROM published_articles a
  WHERE a.id = ANY(article_ids);
$$;

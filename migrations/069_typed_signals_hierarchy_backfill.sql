-- 069_typed_signals_hierarchy_backfill.sql
--
-- Phase A of feed-algorithm-v11 plan.
-- See ~/.claude/plans/harmonic-napping-melody.md
--
-- Source: Douyin algorithm disclosure 2025.
-- Adds the L0 (cat:Category) and L1 (topic:<topic>) hierarchy entries to
-- typed_signals on existing rows of published_articles, so that learning
-- in user_entity_signals starts accumulating against macro labels
-- (topic:entertainment, topic:conflicts, cat:Tech, etc.).
--
-- IDEMPOTENT — uses jsonb DISTINCT to skip already-present entries.
-- DRY-RUN this against staging before prod. Wrap in BEGIN/COMMIT for
-- transactional safety. Estimated 52k rows, ~2 min on production sizing.

BEGIN;

UPDATE published_articles pa
SET typed_signals = (
    SELECT jsonb_agg(DISTINCT s ORDER BY s)
    FROM (
        SELECT jsonb_array_elements_text(pa.typed_signals) AS s
        UNION ALL
        SELECT 'cat:' || pa.category
        WHERE pa.category IS NOT NULL AND pa.category <> ''
        UNION ALL
        SELECT 'topic:' || t
        FROM unnest(COALESCE(pa.topics, ARRAY[]::text[])) AS t
        WHERE t IS NOT NULL AND t <> ''
    ) AS combined
)
WHERE pa.typed_signals IS NOT NULL
  AND jsonb_typeof(pa.typed_signals) = 'array'
  AND (
       (pa.category IS NOT NULL AND pa.category <> '')
    OR (pa.topics IS NOT NULL AND array_length(pa.topics, 1) > 0)
  );

COMMIT;

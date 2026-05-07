-- 081_backfill_broken_details.sql — 2026-05-07
--
-- Null out `published_articles.details` on rows whose detail items violate
-- the tightened validation rules added the same day:
--   1. Label > 18 chars
--   2. Label has > 2 words
--   3. Two items in the same article share a label (case-insensitive)
--   4. Value is a bare digit / digits-only with no unit/currency/symbol
--
-- The iOS card truncates long labels with an ellipsis, duplicate labels
-- look broken in the 3-column layout, and "1" / "2" without units read as
-- meaningless. Re-publishing these articles isn't worth the spend; we
-- just drop the bad component so the rest of the article still renders
-- (title + bullets + photo + the other components).
--
-- Idempotent: safe to re-run. Only nulls; never modifies item text.

BEGIN;

WITH bad AS (
  SELECT pa.id
  FROM published_articles pa
  WHERE pa.details IS NOT NULL
    AND jsonb_typeof(pa.details::jsonb) = 'array'
    AND (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(pa.details::jsonb) AS item
        WHERE jsonb_typeof(item) = 'object'
          AND char_length(coalesce(item->>'label', '')) > 18
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(pa.details::jsonb) AS item
        WHERE jsonb_typeof(item) = 'object'
          AND array_length(string_to_array(trim(coalesce(item->>'label', '')), ' '), 1) > 2
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(pa.details::jsonb) AS item
        WHERE jsonb_typeof(item) = 'object'
          AND coalesce(item->>'value', '') !~ '[A-Za-z%$+]'
      )
      OR (
        SELECT COUNT(*) FILTER (WHERE jsonb_typeof(item) = 'object')
             - COUNT(DISTINCT lower(item->>'label')) FILTER (WHERE jsonb_typeof(item) = 'object')
        FROM jsonb_array_elements(pa.details::jsonb) AS item
      ) > 0
    )
)
UPDATE published_articles pa
SET details = NULL,
    components_order = (
      SELECT coalesce(jsonb_agg(c) FILTER (WHERE c <> 'details'), '[]'::jsonb)::jsonb
      FROM jsonb_array_elements_text(coalesce(pa.components_order::jsonb, '[]'::jsonb)) AS c
    )
FROM bad
WHERE pa.id = bad.id;

DO $$
DECLARE
  affected int;
BEGIN
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Backfill 081: nulled details on % articles', affected;
END $$;

COMMIT;

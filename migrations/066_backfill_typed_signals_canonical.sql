-- Phase 9.3: strip one-shot topic:* strings from typed_signals.
--
-- Audit 2026-04-24 on a 14-day window:
--   42 142 distinct `topic:*` strings across typed_signals
--   31 681 (75 %) appeared exactly once — dead one-shots
--    5 828 (14 %) appeared >= 3 times — genuinely canonical
--
-- Cause: the NER prompt instructed Gemini to produce "2-5 multi-word
-- concepts or compound terms" (e.g. topic:subscription_revenue_guidance),
-- which meant 60-80 % of each engagement's learned signal dropped into
-- dead keys that never matched a future article.
--
-- The pipeline change in this same PR stops routing narrow_topics into
-- typed_signals for new articles. This migration cleans the existing
-- corpus.
--
-- Conservative scope: only published_articles.typed_signals. Leaves
-- user_entity_signals alone (dealt with in a follow-up after observing
-- the effect of this migration). Only touches topic:* entries — org:,
-- person:, loc:, event:, product:, lang: are untouched.
--
-- Threshold >= 3 was chosen because the corpus distribution is clearly
-- bimodal: genuinely-useful tags like topic:soccer (1155x) / topic:ai
-- (556x) / topic:donald_trump (525x) sit in the reused bucket, while
-- the one-shots (topic:subscription_revenue_guidance etc.) are
-- concentrated at count=1.

-- Build the canonical allow-list in a temp table.
CREATE TEMP TABLE canonical_topics AS
SELECT sig
FROM (
  SELECT jsonb_array_elements_text(typed_signals::jsonb) AS sig
  FROM public.published_articles
  WHERE typed_signals IS NOT NULL
) AS all_sigs
WHERE sig LIKE 'topic:%'
GROUP BY sig
HAVING COUNT(*) >= 3;

CREATE UNIQUE INDEX ON canonical_topics (sig);

-- Rewrite typed_signals row-by-row: keep every non-topic entry as-is,
-- keep topic:* entries only if they're in canonical_topics. Entity
-- types (org/person/loc/event/product/lang) are passed through
-- untouched, so named-entity signals like org:microsoft or
-- person:donald_trump are fully preserved.
UPDATE public.published_articles pa
SET typed_signals = cleaned.sigs
FROM (
  SELECT pa2.id,
         jsonb_agg(sig) FILTER (
           WHERE sig NOT LIKE 'topic:%'
              OR sig IN (SELECT ct.sig FROM canonical_topics ct)
         ) AS sigs
  FROM public.published_articles pa2,
       jsonb_array_elements_text(pa2.typed_signals::jsonb) AS sig
  WHERE pa2.typed_signals IS NOT NULL
  GROUP BY pa2.id
) AS cleaned
WHERE pa.id = cleaned.id
  AND pa.typed_signals::jsonb IS DISTINCT FROM cleaned.sigs;

DROP TABLE canonical_topics;

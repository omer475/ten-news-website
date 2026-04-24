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

-- Rewrite typed_signals: keep every non-topic entry as-is, keep topic:*
-- entries only if they're in canonical_topics. Entity types
-- (org/person/loc/event/product/lang) are passed through untouched.
--
-- IMPORTANT: we alias the unfolded element as `s`, not `sig`. If we
-- named it `sig` too, the EXISTS subquery's unqualified `sig` reference
-- would silently resolve to `canonical_topics.sig` (the table column)
-- — which makes the EXISTS always true and the filter a no-op. Learned
-- this the hard way on 2026-04-24 when the first migration attempt
-- left every one-shot in place.
--
-- Run in chunks (LIMIT 5000 per call) — Postgres plans a single-shot
-- UPDATE across 75 k rows as one transaction that exceeds the 30 s
-- Supabase statement timeout. Loop from your driver until the
-- verification query below returns zero.

UPDATE public.published_articles pa
SET typed_signals = (
  SELECT jsonb_agg(s)
  FROM jsonb_array_elements_text(pa.typed_signals::jsonb) AS s
  WHERE s NOT LIKE 'topic:%'
     OR EXISTS (SELECT 1 FROM canonical_topics ct WHERE ct.sig = s)
)
WHERE pa.id IN (
  SELECT DISTINCT pa2.id
  FROM public.published_articles pa2,
       jsonb_array_elements_text(pa2.typed_signals::jsonb) AS s
  WHERE pa2.typed_signals IS NOT NULL
    AND s LIKE 'topic:%'
    AND NOT EXISTS (SELECT 1 FROM canonical_topics ct WHERE ct.sig = s)
  LIMIT 5000
);

-- Verification: run this until it returns 0. Then drop the working table.
--   SELECT COUNT(DISTINCT pa.id)
--   FROM public.published_articles pa,
--        jsonb_array_elements_text(pa.typed_signals::jsonb) AS s
--   WHERE pa.typed_signals IS NOT NULL
--     AND s LIKE 'topic:%'
--     AND NOT EXISTS (SELECT 1 FROM canonical_topics ct WHERE ct.sig = s);

DROP TABLE canonical_topics;

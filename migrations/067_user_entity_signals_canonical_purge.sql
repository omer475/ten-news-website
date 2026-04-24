-- Phase 9.3b: purge non-canonical topic:* rows from user_entity_signals.
--
-- Companion to migration 066 (typed_signals canonical cleanup). Once
-- 066 stripped the hallucinated `topic:subscription_revenue_guidance`-
-- shaped strings from `published_articles.typed_signals`, the matching
-- rows still sat in `user_entity_signals` — accumulated by every past
-- engagement before the Phase 9.3 pipeline fix landed. They're inert
-- (no future article will ever re-tag them) but cost bandwidth on
-- every feed request that loads the user's entity-signal map.
--
-- Audit before:
--   user_entity_signals total rows:               9 901
--   topic:* rows:                                 7 212
--   non-canonical topic:* (noise to delete):      3 832  (53 % of topic rows)
--   canonical topic:* (keep):                     3 380
--
-- TikTok / ByteDance Monolith reference (arXiv:2209.07663):
--   "Embeddings corresponding to these infrequent IDs are underfit
--    due to lack of training data."
--   "Stale IDs from a distant history seldom contribute to the
--    current model."
--   They use a passive expiration timer (ID existence timer). We
--   emulate that here with a one-shot purge against the canonical-
--   topics allow-list. A future migration could add a 60-day TTL
--   sweep (`last_positive_at < now() - interval '60 days' AND
--   last_negative_at < now() - interval '60 days'`) for steady-state
--   maintenance once user count grows.
--
-- Conservative scope: only `topic:*` keys. Entity-typed keys
-- (org:, person:, loc:, event:, product:, lang:) are never touched —
-- those are open-vocabulary identifiers and even rare ones may match
-- future articles (e.g. an obscure org name reappearing).

CREATE TEMP TABLE canonical_topics_purge AS
SELECT sig FROM (
  SELECT jsonb_array_elements_text(typed_signals::jsonb) AS sig
  FROM public.published_articles
  WHERE typed_signals IS NOT NULL
) AS all_sigs
WHERE sig LIKE 'topic:%'
GROUP BY sig
HAVING COUNT(*) >= 3;

CREATE UNIQUE INDEX ON canonical_topics_purge (sig);

DELETE FROM public.user_entity_signals
WHERE entity LIKE 'topic:%'
  AND entity NOT IN (SELECT sig FROM canonical_topics_purge);

DROP TABLE canonical_topics_purge;

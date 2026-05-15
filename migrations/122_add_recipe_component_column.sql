-- Migration 122 — add missing `recipe` JSONB component column.
--
-- The Cloud Run pipeline (complete_clustered_8step_workflow.py lines 1719,
-- 2034, 2134) has been writing a `recipe` field to published_articles since
-- some prior change, but the column was never added to the schema. Result:
-- every article INSERT failed with PostgREST error PGRST204
-- "Could not find the 'recipe' column of 'published_articles' in the
-- schema cache."
--
-- Live impact: from 2026-05-14 17:03 (pipeline deploy with this code path
-- newly active) through 2026-05-15 ~12:00, the pipeline reported
-- "articles_processed: 326, articles_published: 0" — every single
-- article failed to insert. The audit session at 08:36 UTC saw a slate
-- with zero personal/fresh content because retrieval had nothing fresh
-- to pull (user's top primaries had no new articles since the deploy).
--
-- recipe matches the existing component-column pattern (details, timeline,
-- graph, map, five_ws are all JSONB nullable). Mirrors the AI-generated
-- "recipe" component for food/cooking articles, alongside the other
-- per-article structured components.
--
-- APPLIED TO PROD: 2026-05-15. See git history for the manual application
-- timing; this migration file is the canonical record of the change.

ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS recipe JSONB;

COMMENT ON COLUMN public.published_articles.recipe IS
  'Mig 122. AI-generated structured recipe component (ingredients, steps, timing) for food/cooking articles. Mirrors the JSONB pattern of details/timeline/graph/map/five_ws. Written by complete_clustered_8step_workflow.py step 7 (Claude component generation).';

-- Migration 123 — add missing `scorecard` JSONB component column.
--
-- Companion to migration 122. complete_clustered_8step_workflow.py lines
-- 1718, 2034, 2133 write a `scorecard` field on every article INSERT, but
-- the column was never added to published_articles. PostgREST raised the
-- error on `recipe` first (mig 122 fixed that); the next insert would
-- have failed on `scorecard`. Adding both unblocks the pipeline end-to-end.
--
-- Same JSONB shape as the other component columns (details, timeline,
-- graph, map, five_ws, recipe). Used for the AI-generated structured
-- "scorecard" component (sports scores, election results, rating
-- summaries, etc.).
--
-- APPLIED TO PROD: 2026-05-15.

ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS scorecard JSONB;

COMMENT ON COLUMN public.published_articles.scorecard IS
  'Mig 123. AI-generated structured scorecard component (sports scores, election results, rating summaries) for relevant article types. Mirrors the JSONB pattern of details/timeline/graph/map/five_ws/recipe. Written by complete_clustered_8step_workflow.py step 7.';

-- Migration 121 — Event-cluster redundancy decay.
--
-- Problem: when 20+ outlets cover the same event (Trump-Beijing summit,
-- May 14 2026 audit), step10_article_scoring.py scores each piece
-- INDEPENDENTLY. The 5th and 10th wire-pickup pieces both end up at 850+
-- because step10 has no view of the other 19. Then ComposeWithBudgets
-- pulls 10 of them into a single 25-slot slate. Audit slate 1: 10 of 25
-- cards primary 62 (China), all about Trump-Beijing.
--
-- Fix: after step6 world-event detection assigns event_id, run a small
-- post-processing step that sorts each event-cluster's articles by score
-- and applies X-style exponential decay to the 2nd, 3rd, ... articles.
-- The top article in each cluster keeps its full score; subsequent
-- articles get progressively smaller scores until they fall out of the
-- score-floored retrieval pools.
--
-- Decay formula matches X's open-source AuthorDiversityDiscountProvider
-- and CandidateSourceDiversityListwiseRescoringProvider (twitter/the-
-- algorithm, home-mixer/server/.../scorer/DiversityDiscountProvider.scala):
--
--     multiplier = (1 - floor) * decay^position + floor
--                  with decay=0.5, floor=0.25
--
-- Per-position multipliers:
--   pos 0 (highest score in cluster) → 1.000×
--   pos 1                             → 0.625×
--   pos 2                             → 0.438×
--   pos 3                             → 0.344×
--   pos 5+                            → asymptote 0.250×
--
-- Stored as a SEPARATE column (`redundancy_adjusted_score`) rather than
-- mutating `ai_final_score`. The original score remains the source of
-- truth; the adjusted score is computed deterministically from it.
-- Idempotent — re-running the function over the same window produces
-- identical results (since it always re-derives from ai_final_score).
--
-- Reading: JS-side trinityServe.js rerank prefers
-- `redundancy_adjusted_score` when present, falls back to `ai_final_score`.
-- This means articles outside the 72-hour processing window (or that
-- never got an event_id) continue to use ai_final_score — no regression.

-- 1. New column on published_articles.
ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS redundancy_adjusted_score REAL;

-- Index isn't needed — column is only read by id (after the JS retrieval
-- has already selected its candidates) and written by a single batched
-- UPDATE in the function below.

-- 2. The decay function.
--
-- Window: 72 hours by default. Covers all articles still actively
-- competing in the retrieval pools (fresh pool window is 48h; LT pool
-- adaptive 3d/7d/14d). Going wider would re-touch stale articles for
-- no benefit; going narrower would leave just-aged-out articles with
-- stale adjusted scores.
--
-- Tie-break within event cluster: ai_final_score DESC, then created_at
-- DESC (newer wins if scores tie). Matches Google News story-cluster
-- ranking logic (Search Engine Land interview with Josh Cohen).

CREATE OR REPLACE FUNCTION public.apply_event_redundancy_decay(
  p_decay         REAL    DEFAULT 0.5,
  p_floor         REAL    DEFAULT 0.25,
  p_hours_window  INT     DEFAULT 72
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  WITH ranked AS (
    SELECT
      awe.article_id,
      pa.ai_final_score,
      ROW_NUMBER() OVER (
        PARTITION BY awe.event_id
        ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
      ) - 1 AS position
    FROM public.article_world_events awe
    JOIN public.published_articles pa ON pa.id = awe.article_id
    WHERE pa.created_at > NOW() - make_interval(hours => p_hours_window)
      AND pa.ai_final_score IS NOT NULL
  )
  UPDATE public.published_articles pa
  SET redundancy_adjusted_score = ranked.ai_final_score::real *
        ((1.0 - p_floor) * power(p_decay, ranked.position) + p_floor)
  FROM ranked
  WHERE pa.id = ranked.article_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.apply_event_redundancy_decay IS
  'Mig 121. Post-clustering soft-decay of redundant articles within each event_id. Position 0 keeps full score; positions 1+ exponentially decay (X-style, decay=0.5 floor=0.25). Writes to redundancy_adjusted_score. Idempotent — re-running over the same window gives identical results. Called by complete_clustered_8step_workflow.py as step 13 after world-event detection.';

COMMENT ON COLUMN public.published_articles.redundancy_adjusted_score IS
  'Mig 121. ai_final_score after event-cluster redundancy decay. NULL when article not yet processed (outside 72h window or no event_id). JS-side rerank uses (redundancy_adjusted_score ?? ai_final_score) for quality.';

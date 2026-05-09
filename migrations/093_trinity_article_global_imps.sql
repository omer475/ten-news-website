-- Migration 093 — Phoenix Phase 7.B. Global article impression count RPC.
--
-- Source: Google YouTube Shorts 2025 "Item Level Exploration Traffic
-- Allocation" (arxiv:2505.09033). When the explore arm picks a cluster,
-- prefer COLD articles (low global impression count) — gives new content
-- a "test audience" stage even when ai_final_score is mid-range.
--
-- Returns Map<article_id, total_global_impressions> for a list of article
-- IDs. Caller (trinityServe.js loadGlobalImpressionBoosts) computes a
-- freshness boost per candidate:
--   boost = 1 + 0.5 * max(0, 1 - imps / 50)
-- Articles with ≤50 global impressions get +50% boost decaying to 1.0.

CREATE OR REPLACE FUNCTION public.article_global_impression_counts(
  p_article_ids bigint[]
)
RETURNS TABLE (article_id bigint, global_impressions int)
LANGUAGE sql
STABLE
AS $$
  SELECT i.article_id, COUNT(*)::int AS global_impressions
  FROM public.user_feed_impressions i
  WHERE i.article_id = ANY(p_article_ids)
  GROUP BY i.article_id;
$$;

COMMENT ON FUNCTION public.article_global_impression_counts IS
  'Phoenix Phase 7.B. Global impression counts per article for the fresh-item explore boost.';

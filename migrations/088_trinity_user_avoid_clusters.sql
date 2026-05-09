-- Migration 088 — Phoenix Phase 4.F. Per-cluster avoid set.
--
-- Problem: user reported Sports/college-sports leakage via explore +
-- trinity-lt. Verified: user's actual category engage rates are 12-33%
-- across ALL categories — Sports is 19.1%, not low enough to trigger the
-- existing category-multiplier gate (which fires at <10%). The user's
-- negatives are SUB-category specific (basketball within Sports,
-- college within Sports).
--
-- Category-level gate doesn't help. Per-CLUSTER gate does: identify
-- secondary clusters where the user has been impressed many times but
-- rarely engaged. These represent specific topics (e.g. basketball
-- cluster) the user has actively rejected, regardless of parent-category
-- stats.
--
-- TikTok-aligned: per ex-engineer talks, the algorithm tracks per-cluster
-- (creator/topic) negative signals, not just per-category. Our explore
-- arm has been picking these clusters via Thompson Sampling because the
-- cluster_state.explore_engages counter is GLOBAL (other users'
-- engagement) — doesn't reflect the current user's repeated rejection.

CREATE OR REPLACE FUNCTION public.user_avoid_clusters(
  p_user_id          uuid,
  p_min_impressions  int   DEFAULT 8,
  p_max_engage_rate  real  DEFAULT 0.12,
  p_days             int   DEFAULT 60
)
RETURNS TABLE (vq_secondary smallint, impressions int, engaged int, engage_rate real)
LANGUAGE sql
STABLE
AS $$
  WITH per_cluster AS (
    SELECT a.vq_secondary,
           COUNT(DISTINCT i.article_id) AS imps,
           COUNT(DISTINCT e.id) AS engs
    FROM public.user_feed_impressions i
    JOIN public.published_articles a ON a.id = i.article_id
    LEFT JOIN public.user_article_events e
      ON e.user_id = i.user_id
      AND e.article_id = i.article_id
      AND e.event_type IN (
        'article_engaged', 'article_liked', 'article_saved',
        'article_shared', 'article_revisit', 'article_detail_view'
      )
    WHERE i.user_id = p_user_id
      AND a.vq_secondary IS NOT NULL
      AND i.created_at > NOW() - make_interval(days => p_days)
    GROUP BY a.vq_secondary
  )
  SELECT pc.vq_secondary,
         pc.imps::int AS impressions,
         pc.engs::int AS engaged,
         (pc.engs::real / NULLIF(pc.imps, 0))::real AS engage_rate
  FROM per_cluster pc
  WHERE pc.imps >= p_min_impressions
    AND (pc.engs::real / NULLIF(pc.imps, 0)) < p_max_engage_rate;
$$;

COMMENT ON FUNCTION public.user_avoid_clusters IS
  'Phoenix Phase 4.F. Per-secondary clusters the user has actively rejected — impressed >= p_min_impressions times with engage rate < p_max_engage_rate over p_days. Used by exploreArm and trinityLT to suppress sub-category negatives (e.g. basketball within Sports) that category-level gate misses.';

-- Migration 109 — Phase 2.2 (TikTok mirror plan).
-- Per-primary tap-then-read funnel stats. Replaces the dwellMult term
-- (mig 103) with a richer two-stage signal that mirrors what TikTok
-- actually models: P(tap) and P(deep_read | tap).
--
-- Why this is better than median-dwell alone: a user who taps cards in
-- primary X 80% of the time but only deep-reads 20% has very different
-- ranker preferences than a user who taps 30% but deep-reads 70% of
-- those taps. dwellMult collapses both into one number; funnelMult
-- separates them.
--
-- The funnel:
--   impression  — any event on the article (server saw the card)
--   tap         — dwell >= 5s OR explicit detail_view/like/save/share
--   deep_read   — dwell >= 25s OR explicit like/save/share (the latter
--                 are stronger commitment signals than just deep dwell)
--
-- The JS rerank() applies an empirical-Bayes-shrunk per-primary boost:
--   funnelMult = clamp([0.7, 1.6], (tapRate / 0.20) * (deepReadRate / 0.30))
-- where tapRate is Beta(5, 20)-shrunk and deepReadRate is Beta(2, 6)-shrunk.

CREATE OR REPLACE FUNCTION public.user_funnel_stats(
  p_user_id   uuid,
  p_days_back int DEFAULT 30
)
RETURNS TABLE (
  vq_primary  smallint,
  impressions int,
  taps        int,
  deep_reads  int
)
LANGUAGE sql
STABLE
AS $$
  WITH events AS (
    SELECT
      a.vq_primary,
      e.event_type,
      COALESCE(
        NULLIF(e.view_seconds, 0)::float,
        (e.metadata->>'dwell')::float,
        (e.metadata->>'total_active_seconds')::float,
        0
      ) AS dwell
    FROM public.user_article_events e
    JOIN public.published_articles a ON a.id = e.article_id
    WHERE e.user_id = p_user_id
      AND a.vq_primary IS NOT NULL
      AND e.created_at > NOW() - make_interval(days => p_days_back)
  )
  SELECT
    e.vq_primary,
    COUNT(*)::int AS impressions,
    COUNT(*) FILTER (
      WHERE e.dwell >= 5.0
        OR e.event_type IN ('article_detail_view', 'article_liked', 'article_saved', 'article_shared', 'article_revisit')
    )::int AS taps,
    COUNT(*) FILTER (
      WHERE e.dwell >= 25.0
        OR e.event_type IN ('article_liked', 'article_saved', 'article_shared')
    )::int AS deep_reads
  FROM events e
  GROUP BY e.vq_primary
  HAVING COUNT(*) >= 5;
$$;

COMMENT ON FUNCTION public.user_funnel_stats IS
  'Phase 2.2 (2026-05-10). Per-primary tap-then-read funnel for a user. tap = dwell>=5s OR explicit detail_view/like/save/share/revisit. deep_read = dwell>=25s OR like/save/share. Feeds funnelMult in rerank() (replaces dwellMult).';
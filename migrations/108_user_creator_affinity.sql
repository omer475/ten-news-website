-- migrations/108_user_creator_affinity.sql
--
-- Phase 1.2 (2026-05-11): Per-user × per-creator affinity RPC.
--
-- Mirrors the X RealGraph pattern: when a user has engaged with a specific
-- creator/publisher more than baseline, the ranker should boost their
-- content. When the user has been impressed repeatedly without engaging,
-- demote it.
--
-- Returns one row per (user_id, author_id) pair with >= 3 impressions in
-- the last p_days_back days, with raw impression + engagement counts. The
-- caller (lib/trinityServe.js loadUserCreatorAffinity) applies Beta(5, 20)
-- shrinkage and bounds to [0.5, 1.5] — same shape as funnelMult.
--
-- Used ONLY for follow-pool reranking. Other retrievers are scoped by VQ
-- cluster, not author; per-author affinity there would be redundant with
-- the cluster-level signals.

CREATE OR REPLACE FUNCTION public.user_creator_affinity(
  p_user_id uuid,
  p_days_back int DEFAULT 60
) RETURNS TABLE (
  author_id uuid,
  impressions int,
  engagements int
) LANGUAGE sql STABLE AS $$
  WITH impressions AS (
    SELECT
      pa.author_id,
      ufi.article_id,
      ufi.user_id,
      ufi.created_at AS impr_at
    FROM user_feed_impressions ufi
    JOIN published_articles pa ON pa.id = ufi.article_id
    WHERE ufi.user_id = p_user_id
      AND ufi.created_at > NOW() - (p_days_back || ' days')::interval
      AND pa.author_id IS NOT NULL
  ),
  engagements AS (
    SELECT DISTINCT i.author_id, i.article_id
    FROM impressions i
    JOIN user_article_events uae
      ON uae.user_id = i.user_id AND uae.article_id = i.article_id
    WHERE uae.event_type IN (
      'article_engaged', 'article_liked', 'article_saved',
      'article_shared', 'article_revisit', 'article_detail_view',
      'article_more_like_this'
    )
      AND uae.created_at >= i.impr_at
      AND uae.created_at <  i.impr_at + interval '24 hours'
  )
  SELECT
    i.author_id,
    COUNT(*)::int AS impressions,
    (SELECT COUNT(*)::int FROM engagements e WHERE e.author_id = i.author_id) AS engagements
  FROM impressions i
  GROUP BY i.author_id
  HAVING COUNT(*) >= 3;
$$;

COMMENT ON FUNCTION public.user_creator_affinity IS
  'Phase 1.2 RealGraph-style per-creator affinity. Returns (author_id, impressions, engagements) over p_days_back. Caller shrinks via Beta(5, 20) and bounds to [0.5, 1.5] for use as a follow-pool ranker multiplier.';

-- Migration 080 — Trinity TikTok-style seen-history antijoin RPCs.
--
-- Aligns Trinity's retrieval with how TikTok / Twitter / YouTube actually
-- handle "already seen" deduplication: server-side antijoin against the
-- full impressions table at retrieval time, NOT a 7-day windowed exact-id
-- list pushed via NOT IN (...) from the application layer.
--
-- Why this matters: Trinity's old path used `excludeIds: seenIds` at the
-- application layer with a 7-day window capped at 2000 IDs. For a power
-- user with 11K+ lifetime seen articles, ~80% of their history is outside
-- both the time window and the cap — articles seen 8+ days ago re-served
-- whenever Phase 1 fix #7's 14-day adaptive tier kicks in. That's the bug
-- the user reported as "loads of articles I've seen before."
--
-- The right fix per TikTok pattern: lifetime retention, post-retrieval
-- (or in-retrieval via SQL) membership check. Since we have Postgres + a
-- (user_id, article_id) index on user_feed_impressions, NOT EXISTS is
-- O(log n) per candidate — same big-O as a Bloom filter check, just
-- without the 1% false-positive risk.
--
-- TikTok uses Bloom filters in Redis for the same purpose; Twitter uses
-- a Manhattan-backed served-tweets cache with antijoin filtering.
-- Pattern is identical: lifetime seen history, post-retrieval dedup.

-- 1. Per-secondary (vq_secondary) cluster fetch with NOT EXISTS dedup.
-- Used by trinity-M tier1, tier2, LT, and explore retrieval paths.
CREATE OR REPLACE FUNCTION public.trinity_fetch_cluster_antijoin(
  p_user_id     uuid,
  p_vq_secondary smallint,
  p_hours_window int  DEFAULT 168,
  p_min_score   real  DEFAULT 0,
  p_limit       int   DEFAULT 20
)
RETURNS SETOF public.published_articles
LANGUAGE sql
STABLE
AS $$
  SELECT pa.*
  FROM public.published_articles pa
  WHERE pa.vq_secondary = p_vq_secondary
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (
      p_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi
        WHERE ufi.user_id = p_user_id
          AND ufi.article_id = pa.id
      )
    )
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_cluster_antijoin IS
  'Trinity per-secondary candidate fetch with TikTok-style lifetime seen-history antijoin. Replaces NOT IN (excludeIds) at the application layer.';


-- 2. Trinity-fresh: per-primary fetch, last N hours, with antijoin.
CREATE OR REPLACE FUNCTION public.trinity_fetch_fresh_antijoin(
  p_user_id      uuid,
  p_vq_primaries smallint[],
  p_hours_window int   DEFAULT 48,
  p_min_score    real  DEFAULT 500,
  p_limit        int   DEFAULT 80
)
RETURNS SETOF public.published_articles
LANGUAGE sql
STABLE
AS $$
  SELECT pa.*
  FROM public.published_articles pa
  WHERE pa.vq_primary = ANY(p_vq_primaries)
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (
      p_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi
        WHERE ufi.user_id = p_user_id
          AND ufi.article_id = pa.id
      )
    )
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_fresh_antijoin IS
  'Trinity-fresh retrieval: top-N primaries × last-N-hours with lifetime seen antijoin.';


-- 3. Cold-start trending fetch with antijoin.
CREATE OR REPLACE FUNCTION public.trinity_fetch_trending_antijoin(
  p_user_id      uuid,
  p_hours_window int  DEFAULT 168,
  p_min_score    real DEFAULT 400,
  p_limit        int  DEFAULT 100
)
RETURNS SETOF public.published_articles
LANGUAGE sql
STABLE
AS $$
  SELECT pa.*
  FROM public.published_articles pa
  WHERE pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (
      p_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi
        WHERE ufi.user_id = p_user_id
          AND ufi.article_id = pa.id
      )
    )
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.trinity_fetch_trending_antijoin IS
  'Trinity cold-start: trending across all primaries with lifetime seen antijoin.';

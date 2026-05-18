-- Migration 127 — PR6 (2026-05-18) — Per-primary engagement buffer.
--
-- Root cause diagnosis (test user 5082a1df, real audit 2026-05-18):
--
-- The existing user_engagement_buffer RPC (mig 113) caps the result at 1000
-- events globally, recency-ordered. For heavy users (22k+ lifetime events),
-- 1000 events = ~6 days of history. This creates a TIGHT FEEDBACK LOOP:
--
--   1. Algorithm serves wrong content (e.g. China/LT flood from PR4-bug era)
--   2. User deep-reads what's served (because there's nothing else)
--   3. Buffer skews toward whatever was served (e.g. 48 China rows vs 15 Tech)
--   4. computePrimaryUserVectors builds a strong vector for over-served primary
--      and a WEAK vector for the user's actual top interest
--   5. ANN retrieval for the weak-vector primary returns empty
--   6. Personal pool starved → slate falls back to LT → loop tightens
--
-- For the audited user:
--   * Primary 39 (Tech, h1=1929, USER'S #1 INTEREST BY 60-DAY HISTOGRAM)
--     - 155 deep-read events in last 60 days
--     - ONLY 15 in the recency-capped 1000-row buffer
--     - Vector built from 15 articles → weak → returns 0 candidates
--   * Primary 62 (China, h1=609, rank 7)
--     - 80 deep-read events
--     - 48 in buffer (because recent algorithm bug served them lots of China)
--     - Strong vector → returns matches → primary 62 dominates personal pool
--
-- This is opposite to PinnerSage (arxiv:2007.03634 §3.3) which uses
-- per-cluster importance with λ=0.01/day decay (~69-day half-life). Pinterest
-- has no global recency cap — each cluster's representation is independent.
--
-- New RPC: user_engagement_buffer_per_primary. Per-primary top-K (default 200)
-- using ROW_NUMBER() PARTITION BY vq_primary. Total output bounded by
-- p_max_primaries × p_per_primary_limit (default 50 × 200 = 10,000 rows max,
-- but typically ~2,000-4,000 for real users). Same row shape as the existing
-- RPC so callers can swap with no schema change.

CREATE OR REPLACE FUNCTION public.user_engagement_buffer_per_primary(
  p_user_id            uuid,
  p_per_primary_limit  int DEFAULT 200,
  p_max_primaries      int DEFAULT 50
)
RETURNS TABLE (
  article_id            bigint,
  vq_primary            smallint,
  embedding_minilm_vec  vector(384),
  age_days              double precision,
  event_type            text
)
LANGUAGE sql
STABLE
AS $$
  WITH qualifying AS (
    SELECT
      uae.article_id,
      pa.vq_primary,
      pa.embedding_minilm_vec,
      EXTRACT(EPOCH FROM (NOW() - uae.created_at)) / 86400.0 AS age_days,
      uae.event_type,
      uae.created_at,
      ROW_NUMBER() OVER (PARTITION BY pa.vq_primary ORDER BY uae.created_at DESC) AS rn_in_primary
    FROM public.user_article_events uae
    JOIN public.published_articles pa ON pa.id = uae.article_id
    WHERE uae.user_id = p_user_id
      AND uae.article_id IS NOT NULL
      AND pa.embedding_minilm_vec IS NOT NULL
      AND pa.vq_primary IS NOT NULL
      AND (
        uae.event_type IN (
          'article_liked', 'article_saved', 'article_shared',
          'article_revisit', 'article_more_like_this'
        )
        OR (
          uae.event_type = 'article_engaged'
          AND uae.view_seconds IS NOT NULL
          AND uae.view_seconds >= 0.7 * COALESCE(pa.expected_read_seconds, 30)
        )
      )
  ),
  primary_totals AS (
    SELECT vq_primary, COUNT(*) AS total
    FROM qualifying
    GROUP BY vq_primary
    ORDER BY total DESC
    LIMIT p_max_primaries
  )
  SELECT
    q.article_id,
    q.vq_primary,
    q.embedding_minilm_vec,
    q.age_days,
    q.event_type
  FROM qualifying q
  JOIN primary_totals pt ON pt.vq_primary = q.vq_primary
  WHERE q.rn_in_primary <= p_per_primary_limit
  ORDER BY q.vq_primary, q.created_at DESC;
$$;

COMMENT ON FUNCTION public.user_engagement_buffer_per_primary IS
  'PR6 (2026-05-18). Per-primary engagement buffer for personal user-vector computation. Returns top p_per_primary_limit deep-read events PER vq_primary (across top p_max_primaries primaries by total deep-reads). Fixes the feedback-loop bug where the global recency-capped buffer skewed user vectors toward whatever the algorithm happened to serve recently — independent of the user''s actual histogram-level interests.';

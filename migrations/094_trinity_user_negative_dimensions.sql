-- Migration 094 — Phoenix Phase 6.C. Multi-granular negative feedback (ENF-lite).
--
-- Source: Multi-Granular Negative Feedback / ENF (arxiv:2511.18700, Nov
-- 2025). ByteDance reported +6.2% avg watch time, -9.4% fast-skip rate
-- vs prior model. Core insight: when a user skips, classify WHY (entity?
-- source? topic? cluster?) and propagate the negative signal ALONG THAT
-- DIMENSION ONLY — not as a uniform penalty across everything similar.
--
-- We don't need an LLM agent stack (their full ENF). The signal we
-- already have can attribute skips to dimensions:
--   * cluster: published_articles.vq_secondary
--   * source:  published_articles.source
--   * primary: published_articles.vq_primary

CREATE TABLE IF NOT EXISTS public.user_negative_dimensions (
  user_id        uuid NOT NULL,
  dim_type       text NOT NULL,
  dim_value      text NOT NULL,
  fast_skip_count int NOT NULL DEFAULT 0,
  last_skip_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, dim_type, dim_value)
);

CREATE INDEX IF NOT EXISTS idx_user_neg_dim_lookup ON public.user_negative_dimensions (user_id);

CREATE OR REPLACE FUNCTION public.bump_user_negative_dim(
  p_user_id   uuid,
  p_dim_type  text,
  p_dim_value text
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.user_negative_dimensions (user_id, dim_type, dim_value, fast_skip_count, last_skip_at)
  VALUES (p_user_id, p_dim_type, p_dim_value, 1, NOW())
  ON CONFLICT (user_id, dim_type, dim_value) DO UPDATE SET
    fast_skip_count = user_negative_dimensions.fast_skip_count + 1,
    last_skip_at    = NOW();
$$;

CREATE OR REPLACE FUNCTION public.get_user_negative_dimensions(
  p_user_id     uuid,
  p_days_back   int  DEFAULT 30,
  p_min_count   int  DEFAULT 3
)
RETURNS TABLE (dim_type text, dim_value text, decayed_count real)
LANGUAGE sql
STABLE
AS $$
  SELECT
    n.dim_type,
    n.dim_value,
    (n.fast_skip_count::real
      * power(0.95::real, EXTRACT(DAY FROM NOW() - n.last_skip_at)::real)
    )::real AS decayed_count
  FROM public.user_negative_dimensions n
  WHERE n.user_id = p_user_id
    AND n.last_skip_at > NOW() - make_interval(days => p_days_back)
    AND n.fast_skip_count >= p_min_count;
$$;

COMMENT ON TABLE public.user_negative_dimensions IS
  'Phoenix Phase 6.C (ENF-lite). Per-(user, dimension, value) fast-skip counter with time decay (γ=0.95/day). Dimensions: cluster (vq_secondary), source (publisher), primary (vq_primary). Used by trinityServe.js rerank to apply per-dimension penalty.';

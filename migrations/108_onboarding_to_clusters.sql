-- Migration 108 — Phase 1.8 (TikTok mirror plan).
-- Precomputed onboarding-topic → cluster lookup. Populated offline by
-- scripts/build_onboarding_cluster_map.py against the active codebook
-- (J=256/K=2048).
--
-- Each row is (topic_code, vq_primary, vq_secondary, weight) representing
-- "if user selected this onboarding topic, weight clusters this much for
-- their synthetic warm-start histogram."
--
-- topic_code matches what iOS sends in followed_topics (e.g. 'ai_ml',
-- 'nba', 'crypto'). vq_primary/vq_secondary are clusters whose articles
-- have interest_tags that align with the topic's tag set (defined in the
-- ONBOARDING_TOPIC_MAP that lives in lib/coldStart.js).
--
-- weight is normalized so SUM(weight) per topic_code == ~1.0 — the synthesis
-- function in lib/coldStart.js scales by a global "synthetic strength"
-- constant when injecting into the user's histogram.
--
-- Refresh cadence: regenerate this table whenever the codebook is
-- retrained (every ~1-3 months currently). When the table is empty or
-- missing rows for a topic_code, lib/coldStart.js falls back to a live
-- aggregation against published_articles.interest_tags.

CREATE TABLE IF NOT EXISTS public.onboarding_topic_clusters (
  topic_code   text     NOT NULL,
  vq_primary   smallint NOT NULL,
  vq_secondary smallint NOT NULL,
  weight       real     NOT NULL,
  codebook_id  bigint,
  PRIMARY KEY (topic_code, vq_secondary)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_topic_clusters_lookup
  ON public.onboarding_topic_clusters (topic_code);

CREATE INDEX IF NOT EXISTS idx_onboarding_topic_clusters_primary
  ON public.onboarding_topic_clusters (vq_primary);

COMMENT ON TABLE public.onboarding_topic_clusters IS
  'Phase 1.8 (2026-05-10). Precomputed onboarding-topic → cluster lookup. Populated by scripts/build_onboarding_cluster_map.py. Used by lib/coldStart.js synthesizeWarmStartHistogram for new users (qualifyingCount < 100). When empty, lib/coldStart.js falls back to live aggregation.';

-- Live-aggregation fallback RPC. Used by lib/coldStart.js when the lookup
-- table has no rows for the requested topic codes (fresh codebook, partial
-- backfill, etc.). Returns the top-N clusters by article count whose
-- interest_tags array overlaps the provided tag list.
--
-- This is heavier than a lookup-table read (~50-150ms vs <10ms), but only
-- fires for new users (QC<100) and is cached at the request scope by the
-- caller. Production should populate the table; the fallback is a safety
-- net so the v11 deletion doesn't regress cold-start UX during the gap
-- between deploy and table-population.

CREATE OR REPLACE FUNCTION public.onboarding_clusters_live(
  p_tags     text[],
  p_top_n    int DEFAULT 8
)
RETURNS TABLE (
  vq_primary   smallint,
  vq_secondary smallint,
  cnt          int
)
LANGUAGE sql
STABLE
AS $$
  -- Build a lower-cased tag set for case-insensitive comparison against
  -- the JSONB interest_tags array.
  WITH lowered AS (
    SELECT array_agg(lower(t)) AS tags
    FROM unnest(p_tags) t
  ),
  -- Match articles whose interest_tags array (text[]) intersects with the
  -- lowered tag set. interest_tags is JSONB; we cast it to text[] for &&.
  matches AS (
    SELECT
      a.vq_primary,
      a.vq_secondary,
      COUNT(*)::int AS cnt
    FROM public.published_articles a, lowered
    WHERE a.vq_primary IS NOT NULL
      AND a.vq_secondary IS NOT NULL
      AND a.interest_tags IS NOT NULL
      -- Convert JSONB array of strings to text[] then check overlap.
      AND ARRAY(SELECT lower(jsonb_array_elements_text(a.interest_tags))) && lowered.tags
      AND a.created_at > NOW() - interval '90 days'
    GROUP BY a.vq_primary, a.vq_secondary
  )
  SELECT vq_primary, vq_secondary, cnt
  FROM matches
  ORDER BY cnt DESC
  LIMIT p_top_n;
$$;

COMMENT ON FUNCTION public.onboarding_clusters_live IS
  'Phase 1.8 (2026-05-10). Live fallback for onboarding_topic_clusters when the lookup table is empty. Returns top-N clusters by article-count whose interest_tags overlap the provided tag set.';

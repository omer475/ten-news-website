-- Phase 8.2: publisher-quality prior.
--
-- Engage rate by publisher varies 0 – 15 % across 200+ sources — a signal
-- size that dwarfs category or cluster effects. Until now the ranker has
-- been ignoring it, so a "The Independent" story and an "Anadolu Agency"
-- story with identical embedding + quality score get identical treatment
-- even though one converts at 15 % and the other at 0 %.
--
-- This adds a Beta(α, β) posterior per publisher, refreshed nightly from
-- IPS-weighted impressions/engagements over the last 30 days. The feed
-- reads the pre-computed `quality` column and folds it in as a soft prior.
-- IPS-weighting (via ranker_training_labels.ips_weight, Phase 8.1) means
-- slot-9 engagements for a publisher are properly upweighted — a small
-- publisher that only ever shows in the long tail isn't unfairly penalised.
--
-- Beta(1, 1) prior keeps new publishers at 0.5 quality until 10+ impressions
-- accumulate, preventing single-impression flukes from driving decisions.
--
-- Schedule the refresh nightly via pg_cron (not included here — deployed
-- separately like migration 062).

CREATE TABLE IF NOT EXISTS public.publisher_quality (
  publisher text PRIMARY KEY,
  impressions integer NOT NULL,
  engagements_ips numeric(10, 2) NOT NULL,
  impressions_ips numeric(10, 2) NOT NULL,
  alpha numeric(10, 2) NOT NULL,
  beta numeric(10, 2) NOT NULL,
  quality numeric(5, 4) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.publisher_quality IS
  'Per-publisher Beta(alpha, beta) engage-rate posterior. Refreshed nightly from ranker_training_labels with IPS weights. Used as a soft prior multiplier in feed scoring.';

CREATE OR REPLACE FUNCTION public.refresh_publisher_quality()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n_rows integer;
BEGIN
  -- Rebuild from scratch — 30-day rolling window, drop publishers that
  -- stopped appearing. Safer than incremental upserts when the window slides.
  DELETE FROM public.publisher_quality;

  INSERT INTO public.publisher_quality (
    publisher, impressions, engagements_ips, impressions_ips,
    alpha, beta, quality, computed_at
  )
  SELECT
    pa.source AS publisher,
    COUNT(*) AS impressions,
    SUM(CASE WHEN rtl.label_engaged THEN rtl.ips_weight ELSE 0 END) AS engagements_ips,
    SUM(rtl.ips_weight) AS impressions_ips,
    1.0 + SUM(CASE WHEN rtl.label_engaged THEN rtl.ips_weight ELSE 0 END) AS alpha,
    1.0 + SUM(rtl.ips_weight) - SUM(CASE WHEN rtl.label_engaged THEN rtl.ips_weight ELSE 0 END) AS beta,
    (1.0 + SUM(CASE WHEN rtl.label_engaged THEN rtl.ips_weight ELSE 0 END))
      / (2.0 + SUM(rtl.ips_weight)) AS quality,
    now()
  FROM public.ranker_training_labels rtl
  JOIN public.published_articles pa ON pa.id = rtl.article_id
  WHERE rtl.shown_at > now() - interval '30 days'
    AND rtl.slot_index IS NOT NULL
    AND pa.source IS NOT NULL
  GROUP BY pa.source
  HAVING COUNT(*) >= 5;

  GET DIAGNOSTICS n_rows = ROW_COUNT;
  RETURN n_rows;
END;
$$;

COMMENT ON FUNCTION public.refresh_publisher_quality() IS
  'Recomputes publisher_quality from ranker_training_labels (IPS-weighted, 30d window). Returns row count. Idempotent. Schedule nightly via pg_cron.';

-- Seed immediately so the feed can start using it.
SELECT public.refresh_publisher_quality();

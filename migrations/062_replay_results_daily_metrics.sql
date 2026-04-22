-- Phase 5: offline replay harness (minimal shipment — daily metrics table +
-- aggregation function. NDCG@10 replay that re-runs the scorer comes later
-- once we have enough labeled data).
--
-- Without this we've been shipping blind — "feed feels better" is subjective
-- and session-to-session variance obscures real shifts. This gives us a daily
-- engage rate + dwell distribution trendline to compare variants.
--
-- Applied to prod via MCP on 2026-04-22. 7-day backfill ran at migration
-- time to seed a baseline. pg_cron scheduled daily at 02:00 UTC.

CREATE TABLE IF NOT EXISTS public.replay_results (
  date date NOT NULL,
  variant text NOT NULL DEFAULT 'prod',
  total_impressions integer NOT NULL DEFAULT 0,
  total_engagements integer NOT NULL DEFAULT 0,
  engage_rate numeric(5, 4),
  active_users integer NOT NULL DEFAULT 0,
  p50_dwell_sec numeric(6, 2),
  p95_dwell_sec numeric(6, 2),
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, variant)
);

COMMENT ON TABLE public.replay_results IS
  'Daily feed metrics. One row per (date, variant). Written by compute_daily_replay_metrics() — scheduled via pg_cron or invoked manually.';

CREATE OR REPLACE FUNCTION public.compute_daily_replay_metrics(p_date date)
RETURNS public.replay_results
LANGUAGE plpgsql
AS $$
DECLARE
  v_result public.replay_results;
  v_impressions integer;
  v_engagements integer;
  v_active_users integer;
  v_p50 numeric;
  v_p95 numeric;
BEGIN
  SELECT COUNT(*) INTO v_impressions
  FROM public.user_feed_impressions
  WHERE created_at::date = p_date;

  -- An engagement = at least one non-skip event on an article shown the same day.
  SELECT COUNT(DISTINCT (e.user_id, e.article_id)) INTO v_engagements
  FROM public.user_article_events e
  JOIN public.user_feed_impressions i
    ON i.user_id = e.user_id AND i.article_id = e.article_id
   AND i.created_at::date = p_date
  WHERE e.event_type IN (
    'article_engaged', 'article_liked', 'article_saved',
    'article_shared', 'article_detail_view', 'article_revisit',
    'article_more_like_this'
  );

  SELECT COUNT(DISTINCT user_id) INTO v_active_users
  FROM public.user_feed_impressions
  WHERE created_at::date = p_date;

  -- Dwell distribution from view_seconds or total_active_seconds metadata.
  -- Cast to numeric because dwell values can be fractional (e.g. "1.3").
  SELECT
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY COALESCE(view_seconds::numeric, (metadata->>'total_active_seconds')::numeric)
    ),
    percentile_cont(0.95) WITHIN GROUP (
      ORDER BY COALESCE(view_seconds::numeric, (metadata->>'total_active_seconds')::numeric)
    )
  INTO v_p50, v_p95
  FROM public.user_article_events
  WHERE created_at::date = p_date
    AND (view_seconds IS NOT NULL OR metadata ? 'total_active_seconds');

  INSERT INTO public.replay_results (
    date, variant, total_impressions, total_engagements, engage_rate,
    active_users, p50_dwell_sec, p95_dwell_sec, computed_at
  )
  VALUES (
    p_date, 'prod', v_impressions, v_engagements,
    CASE WHEN v_impressions > 0 THEN (v_engagements::numeric / v_impressions) ELSE NULL END,
    v_active_users, v_p50, v_p95, now()
  )
  ON CONFLICT (date, variant) DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_engagements = EXCLUDED.total_engagements,
    engage_rate = EXCLUDED.engage_rate,
    active_users = EXCLUDED.active_users,
    p50_dwell_sec = EXCLUDED.p50_dwell_sec,
    p95_dwell_sec = EXCLUDED.p95_dwell_sec,
    computed_at = EXCLUDED.computed_at
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.compute_daily_replay_metrics(date) IS
  'Computes and upserts daily feed metrics for the given date. Idempotent.';

-- Backfill the last 7 days so we have a baseline to compare against.
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series(current_date - interval '7 days', current_date - interval '1 day', interval '1 day')::date
  LOOP
    PERFORM public.compute_daily_replay_metrics(d);
  END LOOP;
END;
$$;

-- Schedule daily at 02:00 UTC to aggregate yesterday's metrics.
-- (pg_cron scheduling done separately in prod via MCP — this SELECT is the
-- canonical record of what was scheduled.)
-- SELECT cron.schedule(
--   'compute-daily-replay-metrics',
--   '0 2 * * *',
--   $$SELECT public.compute_daily_replay_metrics((current_date - interval '1 day')::date);$$
-- );

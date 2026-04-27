-- 073_article_dwell_stats.sql
--
-- Kuaishou-style percentile dwell for the v11 completion-ratio fix.
-- Replaces the text-length expected_read estimate (PR #85) with an
-- observed median dwell aggregated from real users.
--
-- Source: Kuaishou CIKM 2023 (arXiv:2308.13249) — their production
-- definitions are:
--   GVV (Generic View)   : watch_time < 3s        → fast skip
--   EVV (Effective View) : watch > 50%-percentile of other users → positive
--   FVV (Finished View)  : watch > 60%-percentile of other users → strong positive
--
-- The "other users' percentile" is the part we couldn't do before because
-- expected_read_seconds was empty on 7616 of 7617 recent articles. This
-- table fixes that by aggregating user_article_events.view_seconds.
--
-- Table is keyed by article_id and refreshed by refresh_article_dwell_stats().
-- Articles with fewer than 5 observations are excluded — track.js and
-- main.js fall back to the text-length estimate for cold-start cases.

CREATE TABLE IF NOT EXISTS article_dwell_stats (
  article_id           BIGINT PRIMARY KEY,
  observation_count    INTEGER     NOT NULL,
  median_dwell_sec     INTEGER     NOT NULL,  -- p50 — Kuaishou's "EVV" anchor
  p60_dwell_sec        INTEGER     NOT NULL,  -- 60%-percentile — "FVV" anchor
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dwell_stats_updated ON article_dwell_stats (updated_at DESC);

-- ============================================================
-- RPC: refresh_article_dwell_stats
-- Aggregates the last 30 days of article_exit events and writes the
-- per-article median + p60 of view_seconds. Caps view_seconds at 600
-- (10 min) to bound backgrounded-app outliers, and floors at 1s to
-- exclude pure noise. Articles with < 5 observations are skipped.
--
-- Idempotent: ON CONFLICT DO UPDATE replaces stats with the latest
-- aggregate. Safe to run on any schedule. Recommended: nightly via
-- the Cloud Run 03:00 UTC tick (same slot as the cluster centroid
-- rebuild — already wired into cloudrun_entrypoint.py).
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_article_dwell_stats()
RETURNS integer AS $$
DECLARE
  rows_written integer;
BEGIN
  WITH agg AS (
    SELECT
      article_id,
      COUNT(*) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST(view_seconds, 600))::int AS median_sec,
      percentile_cont(0.6) WITHIN GROUP (ORDER BY LEAST(view_seconds, 600))::int AS p60_sec
    FROM user_article_events
    WHERE event_type = 'article_exit'
      AND view_seconds IS NOT NULL
      AND view_seconds >= 1
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY article_id
    HAVING COUNT(*) >= 5
  )
  INSERT INTO article_dwell_stats (article_id, observation_count, median_dwell_sec, p60_dwell_sec, updated_at)
  SELECT article_id, n, median_sec, p60_sec, NOW() FROM agg
  ON CONFLICT (article_id) DO UPDATE SET
    observation_count = EXCLUDED.observation_count,
    median_dwell_sec  = EXCLUDED.median_dwell_sec,
    p60_dwell_sec     = EXCLUDED.p60_dwell_sec,
    updated_at        = NOW();

  GET DIAGNOSTICS rows_written = ROW_COUNT;
  RETURN rows_written;
END;
$$ LANGUAGE plpgsql;

-- Initial population — kick off once on apply.
SELECT refresh_article_dwell_stats();

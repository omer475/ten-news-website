-- 071_user_article_exposures.sql
--
-- Phase D of feed-algorithm-v11 plan.
-- See ~/.claude/plans/harmonic-napping-melody.md
--
-- Source: Douyin algorithm disclosure 2025
--   https://www.scmp.com/tech/big-tech/article/3304799/
--   https://technode.com/2025/04/01/
-- Kuaishou cold-start at WebConf 2025 (10.1145/3701716.3715205) —
-- per-(user, content) exposure threshold + decay multiplier.
--
-- Why
-- ----
-- 2026-04-26 session caught article 132478 ("Apple CEO Faces AI Challenge")
-- being shown to user 5082a1df-… SIX times across 5 days, with declining
-- engagement (92s → 12s → 38s view → 5s skip). The cluster_id dedup at
-- pages/api/feed/main.js:2262-2309 only sees the last 30 impressions, so
-- the same article re-enters as soon as it falls out of that window.
-- This is exactly what ByteDance describes as "weights of user interests
-- on contents with hot reach are discounted as that signal is likely to
-- provide little information reflective of users' interests."
--
-- This table tracks per-(user, article) exposure history. The Phase D
-- consumer change in feed/main.js batch-loads rows for candidate articles
-- and applies a decay multiplier:
--   skipped within 14 days  → 0    (hard exclude)
--   engaged then ignored 2x → 0    (story dead for this user)
--   un-engaged 1 prior      → 0.5
--   un-engaged 2 prior      → 0.1
--   un-engaged ≥3 prior     → 0    (dead)
--   first impression        → 1.0
--
-- Hash-partitioned (16 partitions) on user_id so per-user lookups and
-- per-user vacuums stay fast as we scale.

CREATE TABLE IF NOT EXISTS user_article_exposures (
  user_id          UUID        NOT NULL,
  article_id       BIGINT      NOT NULL,
  shown_count      INTEGER     NOT NULL DEFAULT 0,
  engaged_count    INTEGER     NOT NULL DEFAULT 0,
  skipped_count    INTEGER     NOT NULL DEFAULT 0,
  last_shown_at    TIMESTAMPTZ,
  last_engaged_at  TIMESTAMPTZ,
  last_skipped_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, article_id)
) PARTITION BY HASH (user_id);

-- Create 16 hash partitions
DO $$
DECLARE i int;
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS user_article_exposures_p%s
         PARTITION OF user_article_exposures
         FOR VALUES WITH (MODULUS 16, REMAINDER %s);',
      i, i
    );
  END LOOP;
END$$;

CREATE INDEX IF NOT EXISTS idx_uae_user_article_skipped
  ON user_article_exposures (user_id, article_id) WHERE skipped_count > 0;

CREATE INDEX IF NOT EXISTS idx_uae_user_lastshown
  ON user_article_exposures (user_id, last_shown_at DESC);

-- ============================================================
-- RPC: upsert_article_exposure
-- Called from pages/api/analytics/track.js on every event. Increments
-- shown_count whenever an event arrives (every event implies impression),
-- engaged_count on positive events, skipped_count on negatives.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_article_exposure(
  p_user_id     uuid,
  p_article_id  bigint,
  p_is_engaged  boolean,
  p_is_skipped  boolean,
  p_event_at    timestamptz DEFAULT NOW()
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_article_exposures
    (user_id, article_id, shown_count, engaged_count, skipped_count,
     last_shown_at, last_engaged_at, last_skipped_at)
  VALUES (
    p_user_id, p_article_id,
    1,
    CASE WHEN p_is_engaged THEN 1 ELSE 0 END,
    CASE WHEN p_is_skipped THEN 1 ELSE 0 END,
    p_event_at,
    CASE WHEN p_is_engaged THEN p_event_at ELSE NULL END,
    CASE WHEN p_is_skipped THEN p_event_at ELSE NULL END
  )
  ON CONFLICT (user_id, article_id) DO UPDATE SET
    shown_count     = user_article_exposures.shown_count + 1,
    engaged_count   = user_article_exposures.engaged_count + CASE WHEN p_is_engaged THEN 1 ELSE 0 END,
    skipped_count   = user_article_exposures.skipped_count + CASE WHEN p_is_skipped THEN 1 ELSE 0 END,
    last_shown_at   = p_event_at,
    last_engaged_at = CASE WHEN p_is_engaged THEN p_event_at ELSE user_article_exposures.last_engaged_at END,
    last_skipped_at = CASE WHEN p_is_skipped THEN p_event_at ELSE user_article_exposures.last_skipped_at END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- One-shot backfill from user_feed_impressions × user_article_events.
-- Idempotent because of ON CONFLICT in upsert_article_exposure. Run
-- once after migration applies; safe to re-run.
-- ============================================================

INSERT INTO user_article_exposures
  (user_id, article_id, shown_count, engaged_count, skipped_count,
   last_shown_at, last_engaged_at, last_skipped_at)
SELECT
  i.user_id,
  i.article_id,
  COUNT(*) AS shown_count,
  COUNT(*) FILTER (WHERE ev.event_type = 'article_engaged')::int AS engaged_count,
  COUNT(*) FILTER (WHERE ev.event_type = 'article_skipped')::int AS skipped_count,
  MAX(i.created_at) AS last_shown_at,
  MAX(CASE WHEN ev.event_type = 'article_engaged' THEN ev.created_at END) AS last_engaged_at,
  MAX(CASE WHEN ev.event_type = 'article_skipped' THEN ev.created_at END) AS last_skipped_at
FROM user_feed_impressions i
LEFT JOIN user_article_events ev
  ON ev.user_id = i.user_id
  AND ev.article_id = i.article_id
  AND ev.created_at BETWEEN i.created_at AND i.created_at + INTERVAL '20 minutes'
WHERE i.created_at > NOW() - INTERVAL '60 days'
GROUP BY i.user_id, i.article_id
ON CONFLICT (user_id, article_id) DO UPDATE SET
  shown_count     = EXCLUDED.shown_count,
  engaged_count   = EXCLUDED.engaged_count,
  skipped_count   = EXCLUDED.skipped_count,
  last_shown_at   = EXCLUDED.last_shown_at,
  last_engaged_at = EXCLUDED.last_engaged_at,
  last_skipped_at = EXCLUDED.last_skipped_at;

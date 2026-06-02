-- Migration 120: user_feed_cache — precomputed first-page feed slates
-- Date: 2026-06-01
--
-- Feed speed: the For-You feed was recomputed live on every app open
-- (serveTrinityFeed ≈ 8s warm, plus a 10-20s lambda cold start when the
-- warmer cron wasn't registered → ~45s on a cold open). X/Twitter, Instagram
-- and TikTok don't compute on read — they precompute the timeline and serve
-- it from an in-memory/edge cache (fan-out-on-write). This table is the
-- Postgres equivalent of that precomputed-timeline cache.
--
-- Written by /api/cron/precompute-feeds (offline, every 10 min, for recently
-- active users) and as a cache-aside write on every live compute in
-- /api/feed/main. Read by /api/feed/main on the first page: a single PK
-- lookup (sub-millisecond) replaces the ~8s recompute. On any miss / staleness
-- / error the handler falls straight through to the live path, so this can
-- never be slower or lower-quality than before.
--
-- Columns:
--   slate       — array of fully-formatted articles (the exact client payload,
--                 chip_tags already attached) so the read path returns as-is.
--   exposure    — lightweight [{p,s,src,r}] per article (vq_primary,
--                 vq_secondary, source, retriever). The serve path replays the
--                 exposure/bandit writes (recordSlateExposure) from this so a
--                 cache HIT records fatigue/learning exactly like a live serve.
--                 The precompute itself runs with skipExposureWrites=true.
--   article_ids — flat id list for quick seen-id filtering / debugging.

CREATE TABLE IF NOT EXISTS public.user_feed_cache (
  user_id      uuid PRIMARY KEY,
  slate        jsonb       NOT NULL,
  exposure     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  article_ids  bigint[]    NOT NULL DEFAULT '{}',
  pool_size    integer     NOT NULL DEFAULT 0,
  built_at     timestamptz NOT NULL DEFAULT NOW()
);

-- Lets the precompute cron prune / find stale rows cheaply.
CREATE INDEX IF NOT EXISTS idx_user_feed_cache_built_at
  ON public.user_feed_cache (built_at);

-- Service-role only, mirrors user_feed_impressions / user_session_exposure.
ALTER TABLE public.user_feed_cache DISABLE ROW LEVEL SECURITY;

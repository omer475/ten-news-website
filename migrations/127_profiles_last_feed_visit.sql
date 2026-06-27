-- Migration 127 — TodayPlus "Today's essentials" (2026-06-26).
--
-- Adds profiles.last_feed_visit_at so the website can compute "new since last
-- visit" for logged-in users ACROSS devices. /api/feed/main reads the prior
-- value (returned as last_visit_at in the response) and stamps now() on each
-- first-page load. Guests are handled frontend-side via localStorage, so this
-- column only matters for authenticated users.
--
-- Additive and idempotent. NULL = the user has never loaded the feed before
-- (frontend treats everything as "new" on first ever visit).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_feed_visit_at timestamptz;

COMMENT ON COLUMN public.profiles.last_feed_visit_at IS
  'Last time the user loaded the feed (first page). Used to compute "new since last visit" cross-device. Stamped by /api/feed/main.';

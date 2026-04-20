-- Adds per-article expected reading time (seconds) so analytics/track.js
-- can compute read_fraction without re-tokenizing the article body.
-- Value is populated at publish time by the pipeline and backfilled once
-- via scripts/backfill_expected_read_seconds.js.

ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS expected_read_seconds integer;

COMMENT ON COLUMN public.published_articles.expected_read_seconds IS
  'Expected reading time in seconds at ~230 wpm. Used to compute read_fraction for reward shaping.';

CREATE INDEX IF NOT EXISTS published_articles_expected_read_idx
  ON public.published_articles (expected_read_seconds)
  WHERE expected_read_seconds IS NOT NULL;

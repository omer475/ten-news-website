-- Phase 4: content heating. Every newly-published article enters Tier 1 and
-- receives a scoring boost until it accumulates HEATING_TIER1_IMPRESSIONS
-- impressions. Subsequent tiers (2, 3) are for plan's promotion cascade —
-- can be implemented later as a cron. For now tier 1 alone gives fresh
-- articles guaranteed distribution even if the bandit hasn't learned
-- about their cluster yet.
-- Applied to prod via MCP on 2026-04-22.

CREATE TABLE IF NOT EXISTS public.content_heating (
  article_id bigint PRIMARY KEY REFERENCES public.published_articles(id) ON DELETE CASCADE,
  tier smallint NOT NULL DEFAULT 1,
  entered_tier_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  demoted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_heating_active
  ON public.content_heating (tier, entered_tier_at DESC)
  WHERE demoted_at IS NULL;

CREATE OR REPLACE FUNCTION public.trigger_content_heating_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.content_heating (article_id)
  VALUES (NEW.id)
  ON CONFLICT (article_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS published_articles_heating_insert ON public.published_articles;
CREATE TRIGGER published_articles_heating_insert
  AFTER INSERT ON public.published_articles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_content_heating_insert();

INSERT INTO public.content_heating (article_id, entered_tier_at)
SELECT id, created_at
FROM public.published_articles
WHERE created_at > now() - interval '24 hours'
ON CONFLICT (article_id) DO NOTHING;

COMMENT ON TABLE public.content_heating IS
  'Phase 4 heating cascade — tier 1 articles get a scoring boost until they reach impression quota, then are promoted (tier 2) or demoted. Auto-populated by trigger on published_articles insert.';

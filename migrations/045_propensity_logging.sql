-- Off-policy / counterfactual evaluation foundation. We log the probability
-- the bandit would have selected this article given its state at the moment
-- of selection, so future A/B tests can use IPS-corrected reward estimates
-- (Swaminathan & Joachims 2015) instead of naive A vs B engagement diffs.
-- Also record bucket pool size so we can debias for inventory effects.

ALTER TABLE public.user_feed_impressions
  ADD COLUMN IF NOT EXISTS propensity_score double precision,
  ADD COLUMN IF NOT EXISTS slot_index smallint,
  ADD COLUMN IF NOT EXISTS pool_size integer,
  ADD COLUMN IF NOT EXISTS slots_pattern text,
  ADD COLUMN IF NOT EXISTS request_id uuid;

COMMENT ON COLUMN public.user_feed_impressions.propensity_score IS
  'Probability the article was selected from its bucket pool. 1/pool_size for uniform; lower for ranked-pick scenarios. Used for IPS off-policy evaluation.';

COMMENT ON COLUMN public.user_feed_impressions.slot_index IS
  'Position within the feed (0 = first card). Needed for position-bias correction.';

COMMENT ON COLUMN public.user_feed_impressions.slots_pattern IS
  'The SLOTS string in effect for this feed request (e.g. PPTPPDPP TD). Lets us A/B SLOTS variants.';

COMMENT ON COLUMN public.user_feed_impressions.request_id IS
  'Groups impressions from the same feed request, so we can analyze slate-level outcomes.';

CREATE INDEX IF NOT EXISTS user_feed_impressions_request_idx
  ON public.user_feed_impressions (request_id) WHERE request_id IS NOT NULL;

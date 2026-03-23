-- Discovery engagement memory + dynamic category affinity
-- discovery_stats: { "Food": { shown: 5, engaged: 1 }, ... }
-- category_profile: { "Tech": { shown: 50, engaged: 25 }, ... }

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discovery_stats JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS category_profile JSONB DEFAULT '{}';

-- Migration 100 — Phase 1.1 (TikTok mirror plan).
-- Drops v11 hierarchical-bandit tables. The v11 fallback in pages/api/feed/main.js
-- (handleV2Feed, lines 882-5342) was deleted in this same release, so these
-- tables are dead weight — no caller writes or reads them.
--
-- Tables dropped:
--   user_bandit_arms     — flat Thompson bandit (replaced by Trinity's
--                          cluster_state.explore_engages/explore_shows)
--   user_leaf_arms       — leaf-cluster bandit (deprecated in 2026-04-18 cleanup)
--   user_super_arms      — super-cluster bandit (deprecated in 2026-04-18 cleanup)
--
-- Migration 101 drops the v11-only RPCs that referenced these tables.
--
-- DESTRUCTIVE: Tables are dropped with CASCADE to remove dependent indexes
-- and views. Run only after pages/api/feed/main.js Phase 1.1 deploy is live
-- and verified — once these are gone, the v11 fallback cannot be re-enabled
-- without re-creating the schema.
--
-- Pre-flight check: query the rowcount before dropping to confirm v11 was
-- not still being used. Both should be ~empty if Trinity has been the
-- primary path for the last 9+ days.
--
--   SELECT 'user_bandit_arms' AS t, COUNT(*) FROM public.user_bandit_arms
--   UNION ALL SELECT 'user_leaf_arms', COUNT(*) FROM public.user_leaf_arms
--   UNION ALL SELECT 'user_super_arms', COUNT(*) FROM public.user_super_arms;

DROP TABLE IF EXISTS public.user_bandit_arms CASCADE;
DROP TABLE IF EXISTS public.user_leaf_arms   CASCADE;
DROP TABLE IF EXISTS public.user_super_arms  CASCADE;

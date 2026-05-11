-- migrations/107_drop_user_median_dwell_by_primary.sql
--
-- Phase 0.3 (2026-05-11): Drop the dead user_median_dwell_by_primary RPC.
--
-- This RPC was added by migration 103 (Phase 1.3, plan
-- enchanted-nibbling-dove.md) to feed the legacy `dwellMult` ranker term.
-- Phase 3.0 (commit e56031c7, refactor: 6 multiplier deletions) replaced
-- `dwellMult` with `funnelMult` (Phase 2.2 — tap-then-read funnel stats
-- via user_funnel_stats RPC), making this function unused.
--
-- Verified no JS callers remain:
--   grep -rn "user_median_dwell_by_primary" lib/ pages/ scripts/
--   → only a code comment in lib/trinityServe.js (~line 1128).
--
-- Safe to drop: idempotent, no downstream dependencies in current schema.

DROP FUNCTION IF EXISTS public.user_median_dwell_by_primary(uuid);

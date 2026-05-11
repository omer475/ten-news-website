-- migrations/112_drop_v11_cluster_leftovers.sql
--
-- Cleanup (2026-05-11): drop the dead v11 super/leaf cluster system.
--
-- WHAT'S GOING:
--   * global_cluster_centroids  — output of services/global_cluster_builder.py
--     (the nightly Cloud Run job we just stopped scheduling).
--   * user_leaf_suppress         — written by track.js Not-Interested handler,
--     never read by any current code. Confirmed via grep.
--   * user_publisher_penalty     — Phase 0.2 deleted the write; Phase 3.0
--     deleted the read. Table has been orphan since.
--   * published_articles.super_cluster_id        — column.
--   * published_articles.leaf_cluster_id         — column.
--   * published_articles.cluster_assignments     — column.
--   * published_articles.alpha / .beta (if present) — v11 bandit posteriors.
--
-- WHAT STAYS:
--   * Trinity's vq_codebooks / vq_centroids / cluster_state tables — these
--     are the LIVE hierarchy (J=256 / K=2048 codebook + B-score state).
--   * Trinity's vq_primary / vq_secondary columns on published_articles — the
--     live cluster labels stamped at publish time.
--
-- SAFETY:
--   * All targets verified to have zero live readers via cross-codebase grep.
--   * Migrations applied to a single test-user database.
--   * Rollback: re-run mig 046/047 to restore tables (cluster_assign_helper
--     can be ported back from git history). Re-stamping articles would need
--     a backfill — not trivial. But we don't expect to rollback because
--     nothing reads these anymore.

-- 1) Drop user_leaf_suppress (write-only, no readers).
DROP TABLE IF EXISTS public.user_leaf_suppress;

-- 2) Drop user_publisher_penalty (orphan since Phase 3.0).
DROP TABLE IF EXISTS public.user_publisher_penalty;

-- 3) Drop global_cluster_centroids (nightly job output, no consumer).
DROP TABLE IF EXISTS public.global_cluster_centroids;

-- 4) Drop dead columns from published_articles.
--    Safe: pipeline (complete_clustered_8step_workflow.py) no longer writes
--    them as of this cleanup commit. iOS does not read them.
ALTER TABLE public.published_articles
  DROP COLUMN IF EXISTS super_cluster_id,
  DROP COLUMN IF EXISTS leaf_cluster_id,
  DROP COLUMN IF EXISTS cluster_assignments;

-- Note: published_articles.alpha / .beta may exist as leftovers from the v11
-- bandit. Drop them only if they're present. Postgres' DROP COLUMN IF EXISTS
-- is idempotent.
ALTER TABLE public.published_articles
  DROP COLUMN IF EXISTS alpha,
  DROP COLUMN IF EXISTS beta;

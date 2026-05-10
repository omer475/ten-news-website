-- Migration 101 — Phase 1.1 (TikTok mirror plan).
-- Drops v11-only RPCs that were called exclusively from handleV2Feed in
-- pages/api/feed/main.js (deleted in this release).
--
-- RPCs dropped:
--   fetch_unseen_by_leaves_hierarchical — hierarchical retrieval, deprecated
--   fetch_unseen_per_category           — v11 trending / discovery retrieval
--   match_articles_multi_cluster_minilm_antijoin — v11 taste-vector ANN
--   match_articles_personal_minilm_antijoin      — v11 single-taste fallback
--   update_super_arm                    — v11 bandit update (table dropped in mig 100)
--   update_leaf_arm                     — v11 bandit update (table dropped in mig 100)
--
-- Pre-flight check: grep the codebase for any remaining callers before
-- dropping. As of Phase 1.1, only handleV2Feed referenced these — Trinity
-- uses its own RPCs (trinity_fetch_*, bump_cluster_*, etc.).
--
--   grep -rn "fetch_unseen_by_leaves\|fetch_unseen_per_category\|match_articles_multi_cluster_minilm\|match_articles_personal_minilm\|update_super_arm\|update_leaf_arm" lib/ pages/ scripts/

-- These functions may have multiple overload signatures. DROP FUNCTION IF
-- EXISTS without specifying types may not match overloads — using DROP
-- FUNCTION ... CASCADE on each known signature.

-- fetch_unseen_by_leaves_hierarchical (no canonical signature publicly
-- documented; drop all variants with ROUTINES introspection if available).
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fetch_unseen_by_leaves_hierarchical',
        'fetch_unseen_per_category',
        'match_articles_multi_cluster_minilm_antijoin',
        'match_articles_personal_minilm_antijoin',
        'update_super_arm',
        'update_leaf_arm'
      )
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      fn_record.nspname, fn_record.proname, fn_record.args
    );
  END LOOP;
END $$;

-- Migration 075: Trinity codebook resize J=128/K=1024 → J=256/K=2048.
--
-- Rationale (from 2026-04-30 21:00 session post-mortem):
--   At J=128, the largest L1 cluster held 1696 articles (2.5× the mean of 681).
--   Big-Tech/AI articles concentrated into a few high-density primaries (esp.
--   c1=56), so Trinity-LT's user-affinity sampling kept surfacing
--   c1=56 sub-clusters (~27% of the 52-article session was c1=56).
--
-- Streaming VQ (KDD 2025, ByteDance) achieves diversity through codebook
-- balance, not post-hoc caps. Doubling J halves average primary size and
-- spreads the AI/tech mass across more primaries.
--
-- This migration:
--   1. Relaxes CHECK constraints to allow vq_primary < 256, vq_secondary < 2048
--   2. Truncates cluster_state (old c2 ids 0-1023 are about to be invalidated)
--   3. Leaves vq_codebooks rows alone for audit history (new v4 will be
--      activated by the trainer; v3 with J=128 stays as deactivated history)
--
-- Existing data:
--   - All 87K articles still have valid (vq_primary, vq_secondary) values in
--     the old [0,127]/[0,1023] range. They satisfy the relaxed constraints.
--   - The trainer will UPDATE every row with new values from codebook v4.
--
-- Reversible: yes (re-tighten constraints after re-stamping with old codebook).

BEGIN;

-- Relax constraints on published_articles.
ALTER TABLE public.published_articles
  DROP CONSTRAINT IF EXISTS published_articles_vq_primary_range,
  DROP CONSTRAINT IF EXISTS published_articles_vq_secondary_range;

ALTER TABLE public.published_articles
  ADD CONSTRAINT published_articles_vq_primary_range
    CHECK (vq_primary IS NULL OR (vq_primary >= 0 AND vq_primary < 256)),
  ADD CONSTRAINT published_articles_vq_secondary_range
    CHECK (vq_secondary IS NULL OR (vq_secondary >= 0 AND vq_secondary < 2048));

-- Update column comments to reflect new dimensions.
COMMENT ON COLUMN public.published_articles.vq_primary IS
  'Trinity primary cluster (J=256). Stamped by scripts/train_rq_vae.py + pipeline Step 12.';
COMMENT ON COLUMN public.published_articles.vq_secondary IS
  'Trinity secondary cluster (K=2048). Child of vq_primary; lookup via vq_codebooks.parent_map.';

-- Relax cluster_state constraints. cluster_id is smallint (range -32K..+32K) so the type itself is fine.
ALTER TABLE public.cluster_state
  DROP CONSTRAINT IF EXISTS cluster_state_cluster_id_check;

ALTER TABLE public.cluster_state
  ADD CONSTRAINT cluster_state_cluster_id_check
    CHECK (cluster_id >= 0 AND cluster_id < 2048);

-- Old c2 ids 0..1023 are about to be invalidated by the new codebook (different cluster geometry).
-- The bootstrap migration 076 will repopulate from impression history.
TRUNCATE TABLE public.cluster_state;

COMMIT;


-- ---------------------------------------------------------------------------
-- Rollback (if we ever need to revert to J=128/K=1024):
--   1. Run train_rq_vae.py with PRIMARY_K=128, SUBCODEBOOK_K=8 → restamps articles
--   2. ALTER constraints back to < 128 / < 1024
--   3. TRUNCATE cluster_state
--   4. Re-run bootstrap
-- ---------------------------------------------------------------------------

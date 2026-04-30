-- Migration 074: Trinity columns + tables.
-- Adds the storage Trinity (ByteDance KDD 2024) needs: a 2-level VQ cluster
-- assignment per article, a versioned codebook store, a per-cluster long-tail
-- EMA state, and a per-user trinity_enabled feature flag.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
-- Reversible — see end of file for rollback statements (commented).
-- Zero deletes, zero data loss.
--
-- Phase 0 of the Trinity rebuild (plan file:
--   ~/.claude/plans/luminous-juggling-whistle.md).

BEGIN;

-- 1. Two-level VQ cluster assignment on every published article.
--    Trinity-M operates on h¹ (J=128 primary), Trinity-LT on h² (K=1024 secondary).
ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS vq_primary   smallint,
  ADD COLUMN IF NOT EXISTS vq_secondary smallint;

-- Range checks (added separately so the migration is safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'published_articles_vq_primary_range'
  ) THEN
    ALTER TABLE public.published_articles
      ADD CONSTRAINT published_articles_vq_primary_range
      CHECK (vq_primary IS NULL OR (vq_primary >= 0 AND vq_primary < 128));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'published_articles_vq_secondary_range'
  ) THEN
    ALTER TABLE public.published_articles
      ADD CONSTRAINT published_articles_vq_secondary_range
      CHECK (vq_secondary IS NULL OR (vq_secondary >= 0 AND vq_secondary < 1024));
  END IF;
END $$;

COMMENT ON COLUMN public.published_articles.vq_primary IS
  'Trinity primary cluster (J=128). Stamped by scripts/train_rq_vae.py + pipeline Step 12. NULL until codebook v1 is trained.';
COMMENT ON COLUMN public.published_articles.vq_secondary IS
  'Trinity secondary cluster (K=1024). Child of vq_primary; lookup via vq_codebooks.parent_map. NULL until codebook v1 is trained.';

-- Indexes for retrieval. Per-cluster fetch is the hot path for Trinity-M / Trinity-LT.
-- Filter on vq_secondary IS NOT NULL keeps the indexes lean while we backfill.
CREATE INDEX IF NOT EXISTS idx_published_articles_vq_primary
  ON public.published_articles (vq_primary)
  WHERE vq_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_articles_vq_secondary
  ON public.published_articles (vq_secondary)
  WHERE vq_secondary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_articles_vq_secondary_score
  ON public.published_articles (vq_secondary, ai_final_score DESC, created_at DESC)
  WHERE vq_secondary IS NOT NULL;


-- 2. Versioned codebook store.
--    Multiple codebook versions can coexist; serving reads the latest where
--    is_active = true. Allows blue/green retrain without serving downtime.
CREATE TABLE IF NOT EXISTS public.vq_codebooks (
  id                serial PRIMARY KEY,
  version           text   NOT NULL,
  signal_type       text   NOT NULL DEFAULT 'semantic'
                           CHECK (signal_type IN ('semantic', 'collaborative')),
  -- 384-d MiniLM in this rollout. Stored as jsonb arrays of length J=128
  -- and K=1024 for portability; a Python script reads them, projects new
  -- articles, writes vq_primary/vq_secondary back.
  level1_centroids  jsonb  NOT NULL,           -- shape: [128][dim]
  level2_centroids  jsonb  NOT NULL,           -- shape: [1024][dim]
  parent_map        jsonb  NOT NULL,           -- shape: [1024]; parent_map[c2] = c1
  dim               integer NOT NULL,
  item_count        integer NOT NULL,          -- how many articles trained on
  trained_at        timestamptz NOT NULL DEFAULT now(),
  is_active         boolean NOT NULL DEFAULT false,
  notes             text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vq_codebooks_version
  ON public.vq_codebooks (version);

-- Exactly one row may have is_active = true. Enforced by partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vq_codebooks_active
  ON public.vq_codebooks ((true))
  WHERE is_active = true;

COMMENT ON TABLE public.vq_codebooks IS
  'Trinity 2-level RQ-VAE codebooks. signal_type=''semantic'' bootstraps from MiniLM embeddings; flip to ''collaborative'' once we have ~10K users.';


-- 3. Per-cluster long-tail state (Trinity-LT B-score EMA).
--    Algorithm 2: B[c2] = (1-α_ema) * B[c2] + α_ema * (now - last_shown[c2]).
--    Larger B means rarely shown → the long-tail pool. Updated on every serve.
--    Keyed by secondary cluster id (the unit Trinity-LT samples).
CREATE TABLE IF NOT EXISTS public.cluster_state (
  cluster_id      smallint PRIMARY KEY
                  CHECK (cluster_id >= 0 AND cluster_id < 1024),
  last_shown_at   timestamptz NOT NULL DEFAULT now(),
  b_score         double precision NOT NULL DEFAULT 0.0,
  shown_count     bigint NOT NULL DEFAULT 0,    -- monitoring only
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cluster_state_b_score
  ON public.cluster_state (b_score DESC);

COMMENT ON TABLE public.cluster_state IS
  'Trinity-LT per-cluster EMA. Top N_C=600 by b_score = long-tail pool. Updated atomically on every Trinity serve.';


-- 4. Per-user feature flag for staged rollout.
--    Default false; flip to true on the test user first, then global.
ALTER TABLE public.personalization_profiles
  ADD COLUMN IF NOT EXISTS trinity_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personalization_profiles.trinity_enabled IS
  'When true, /api/feed/main routes to Trinity (pages/api/feed/trinity.js). False = legacy v11 path. Phase 2 of Trinity rebuild.';


-- 5. Helper RPC: count articles per secondary cluster.
--    Trinity-LT needs this to drop clusters with < T_i articles. Cached
--    in the serving layer for ~5 min; refreshed by re-calling.
CREATE OR REPLACE FUNCTION public.count_articles_by_vq_secondary()
RETURNS TABLE(vq_secondary smallint, cnt integer)
LANGUAGE sql
STABLE
AS $$
  SELECT vq_secondary, COUNT(*)::integer AS cnt
  FROM public.published_articles
  WHERE vq_secondary IS NOT NULL
  GROUP BY vq_secondary;
$$;

COMMENT ON FUNCTION public.count_articles_by_vq_secondary() IS
  'Inventory count per Trinity secondary cluster (K=1024). Used by Trinity-LT to enforce T_i article-floor.';

GRANT EXECUTE ON FUNCTION public.count_articles_by_vq_secondary() TO anon, authenticated, service_role;


COMMIT;


-- ---------------------------------------------------------------------------
-- Rollback (run manually if needed; not auto-executed):
--
--   BEGIN;
--   ALTER TABLE public.personalization_profiles DROP COLUMN IF EXISTS trinity_enabled;
--   DROP TABLE IF EXISTS public.cluster_state;
--   DROP TABLE IF EXISTS public.vq_codebooks;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_secondary_score;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_secondary;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_primary;
--   ALTER TABLE public.published_articles DROP CONSTRAINT IF EXISTS published_articles_vq_secondary_range;
--   ALTER TABLE public.published_articles DROP CONSTRAINT IF EXISTS published_articles_vq_primary_range;
--   ALTER TABLE public.published_articles DROP COLUMN IF EXISTS vq_secondary;
--   ALTER TABLE public.published_articles DROP COLUMN IF EXISTS vq_primary;
--   COMMIT;
-- ---------------------------------------------------------------------------

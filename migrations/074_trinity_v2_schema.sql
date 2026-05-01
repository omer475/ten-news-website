-- Migration 074 (Trinity v2): paper-exact ByteDance Trinity (KDD 2024) schema.
--
-- Built from scratch on the post-cleanup baseline. Incorporates all lessons
-- from Trinity v1 (PRs #94 → #98, since reverted):
--   - J=256 / K=2048 (doubled from paper's 128/1024 — Streaming-VQ KDD 2025
--     direction; halves average primary cluster size, breaks AI/tech mass
--     across more primaries).
--   - vq_centroids as a row-per-centroid table (pgvector(384)) instead of
--     giant jsonb columns (which hit Supabase's statement_timeout at K=2048
--     with a ~6 MB payload).
--   - bulk_stamp_vq RPC with statement_timeout=120s so 1000-row batched
--     UPDATE FROM VALUES doesn't hit the default 8s cap.
--   - count_articles_by_vq_secondary RPC for Trinity-LT's T_i article-floor.
--
-- Idempotent. Reversible via DROP statements at the bottom.

BEGIN;

-- ============================================================
-- 1. Two-level VQ cluster columns on every published article.
-- ============================================================
ALTER TABLE public.published_articles
  ADD COLUMN IF NOT EXISTS vq_primary   smallint,
  ADD COLUMN IF NOT EXISTS vq_secondary smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'published_articles_vq_primary_range'
  ) THEN
    ALTER TABLE public.published_articles
      ADD CONSTRAINT published_articles_vq_primary_range
      CHECK (vq_primary IS NULL OR (vq_primary >= 0 AND vq_primary < 256));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'published_articles_vq_secondary_range'
  ) THEN
    ALTER TABLE public.published_articles
      ADD CONSTRAINT published_articles_vq_secondary_range
      CHECK (vq_secondary IS NULL OR (vq_secondary >= 0 AND vq_secondary < 2048));
  END IF;
END $$;

COMMENT ON COLUMN public.published_articles.vq_primary IS
  'Trinity primary cluster (J=256). Stamped by scripts/train_rq_vae.py + pipeline Step 12.';
COMMENT ON COLUMN public.published_articles.vq_secondary IS
  'Trinity secondary cluster (K=2048). parent_map[c2] = c2 // 8.';

CREATE INDEX IF NOT EXISTS idx_published_articles_vq_primary
  ON public.published_articles (vq_primary)
  WHERE vq_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_articles_vq_secondary
  ON public.published_articles (vq_secondary)
  WHERE vq_secondary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_articles_vq_secondary_score
  ON public.published_articles (vq_secondary, ai_final_score DESC, created_at DESC)
  WHERE vq_secondary IS NOT NULL;


-- ============================================================
-- 2. Codebook header table (small).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vq_codebooks (
  id           serial PRIMARY KEY,
  version      text   NOT NULL,
  signal_type  text   NOT NULL DEFAULT 'semantic'
                       CHECK (signal_type IN ('semantic', 'collaborative')),
  parent_map   jsonb  NOT NULL,    -- length K=2048; small enough to keep inline
  dim          integer NOT NULL,
  item_count   integer NOT NULL,
  trained_at   timestamptz NOT NULL DEFAULT now(),
  is_active    boolean NOT NULL DEFAULT false,
  notes        text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vq_codebooks_version
  ON public.vq_codebooks (version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vq_codebooks_active
  ON public.vq_codebooks ((true))
  WHERE is_active = true;

COMMENT ON TABLE public.vq_codebooks IS
  'Trinity 2-level codebook header. Centroids live in vq_centroids (one row per).';


-- ============================================================
-- 3. Centroid storage — one pgvector row per centroid.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vq_centroids (
  codebook_id integer NOT NULL REFERENCES public.vq_codebooks(id) ON DELETE CASCADE,
  level       smallint NOT NULL CHECK (level IN (1, 2)),
  idx         smallint NOT NULL,
  vec         vector(384) NOT NULL,
  PRIMARY KEY (codebook_id, level, idx)
);

CREATE INDEX IF NOT EXISTS idx_vq_centroids_codebook
  ON public.vq_centroids (codebook_id, level);

COMMENT ON TABLE public.vq_centroids IS
  'Trinity codebook centroids — level 1 = primary, level 2 = secondary residual. Indexed by (codebook_id, level) for fast load at projection time.';


-- ============================================================
-- 4. Per-cluster long-tail EMA state.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cluster_state (
  cluster_id      smallint PRIMARY KEY
                  CHECK (cluster_id >= 0 AND cluster_id < 2048),
  last_shown_at   timestamptz NOT NULL DEFAULT now(),
  b_score         double precision NOT NULL DEFAULT 0.0,
  shown_count     bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cluster_state_b_score
  ON public.cluster_state (b_score DESC);

COMMENT ON TABLE public.cluster_state IS
  'Trinity-LT per-cluster B-score EMA. Top N_C=600 by b_score = long-tail pool.';


-- ============================================================
-- 5. Per-user feature flag.
-- ============================================================
ALTER TABLE public.personalization_profiles
  ADD COLUMN IF NOT EXISTS trinity_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personalization_profiles.trinity_enabled IS
  'When true, /api/feed/main routes to Trinity (lib/trinityServe.js).';


-- ============================================================
-- 6. RPC: count articles per secondary cluster (for Trinity-LT T_i floor).
-- ============================================================
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

GRANT EXECUTE ON FUNCTION public.count_articles_by_vq_secondary() TO anon, authenticated, service_role;


-- ============================================================
-- 7. RPC: bulk-stamp vq_primary/vq_secondary on many articles in one shot.
--    Critical for the trainer's 87K-row stamp loop. Default
--    statement_timeout (8s) trips on 1000-row UPDATE FROM VALUES; we raise
--    it to 120s for this function only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_stamp_vq(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_updated integer;
BEGIN
  WITH vals AS (
    SELECT
      (elem->>'id')::bigint   AS id,
      (elem->>'c1')::smallint AS c1,
      (elem->>'c2')::smallint AS c2
    FROM jsonb_array_elements(p_payload) AS elem
  )
  UPDATE public.published_articles AS p
     SET vq_primary   = v.c1,
         vq_secondary = v.c2
    FROM vals v
   WHERE p.id = v.id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

ALTER FUNCTION public.bulk_stamp_vq(jsonb) SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.bulk_stamp_vq(jsonb) TO service_role;

COMMIT;


-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   DROP FUNCTION IF EXISTS public.bulk_stamp_vq(jsonb);
--   DROP FUNCTION IF EXISTS public.count_articles_by_vq_secondary();
--   ALTER TABLE public.personalization_profiles DROP COLUMN IF EXISTS trinity_enabled;
--   DROP TABLE IF EXISTS public.cluster_state;
--   DROP TABLE IF EXISTS public.vq_centroids;
--   DROP TABLE IF EXISTS public.vq_codebooks;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_secondary_score;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_secondary;
--   DROP INDEX IF EXISTS public.idx_published_articles_vq_primary;
--   ALTER TABLE public.published_articles DROP CONSTRAINT IF EXISTS published_articles_vq_primary_range;
--   ALTER TABLE public.published_articles DROP CONSTRAINT IF EXISTS published_articles_vq_secondary_range;
--   ALTER TABLE public.published_articles DROP COLUMN IF EXISTS vq_secondary;
--   ALTER TABLE public.published_articles DROP COLUMN IF EXISTS vq_primary;
-- ---------------------------------------------------------------------------

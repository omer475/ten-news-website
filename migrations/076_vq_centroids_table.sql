-- Migration 076: split codebook centroids into a row-per-centroid table.
--
-- The previous schema stored level1_centroids (256x384) and level2_centroids
-- (2048x384) as jsonb arrays. At J=256/K=2048 the combined JSON is ~6MB and
-- the INSERT times out under Supabase's default statement_timeout (the
-- 2026-04-30 22:17 trainer run failed exactly this way).
--
-- New design: one row per centroid using pgvector. Inserts become 256+2048
-- = 2304 small rows, each ~3KB. Idiomatic, fast, and lets pgvector index
-- centroids if we ever need ANN over them.
--
-- parent_map stays on vq_codebooks (only ~16KB even at K=2048).

BEGIN;

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
  'One row per Trinity codebook centroid (level 1 = primary, level 2 = secondary residual). Replaces giant jsonb columns on vq_codebooks for fast bulk insert.';

ALTER TABLE public.vq_codebooks
  DROP COLUMN IF EXISTS level1_centroids,
  DROP COLUMN IF EXISTS level2_centroids;

COMMIT;

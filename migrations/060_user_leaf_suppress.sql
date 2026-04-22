-- Phase 3.2: user-initiated "Not Interested" long-press suppresses a
-- (super_cluster, leaf_cluster) for 14 days. main.js retrieval excludes
-- articles in suppressed leaves; entry ages out via TTL check.
-- Applied to prod via MCP on 2026-04-22.

CREATE TABLE IF NOT EXISTS public.user_leaf_suppress (
  user_id uuid NOT NULL,
  super_cluster_id smallint NOT NULL,
  leaf_cluster_id smallint NOT NULL,
  source_article_id bigint,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  suppressed_until timestamptz NOT NULL,
  PRIMARY KEY (user_id, super_cluster_id, leaf_cluster_id)
);

COMMENT ON TABLE public.user_leaf_suppress IS
  'User-initiated leaf suppressions from Not Interested long-press. Excluded from retrieval until suppressed_until.';

CREATE INDEX IF NOT EXISTS idx_user_leaf_suppress_user_until
  ON public.user_leaf_suppress (user_id, suppressed_until DESC);

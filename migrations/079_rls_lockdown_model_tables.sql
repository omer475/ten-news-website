-- Migration 079 — RLS lockdown on model-weight tables.
--
-- Audit fix F-23 (2026-05-06): vq_codebooks, vq_centroids, and cluster_state
-- were tamper targets — anon-key writes could corrupt the VQ codebook,
-- centroids, or cluster_state Beta posteriors and degrade recommendations
-- for everyone. Pipeline + feed both use service-role (which bypasses RLS),
-- so enabling RLS is safe for our paths and blocks anon/authenticated
-- clients entirely.
--
-- Verified safe paths (all use SUPABASE_SERVICE_KEY):
--   pages/api/feed/main.js:5
--   complete_clustered_8step_workflow.py supabase setup
--   scripts/backfill_vq_stamping.py

ALTER TABLE public.vq_codebooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vq_centroids    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_state   ENABLE ROW LEVEL SECURITY;

-- Service role policies. service_role bypasses RLS by default; explicit
-- policies make intent legible.
CREATE POLICY service_role_all_codebooks ON public.vq_codebooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_centroids ON public.vq_centroids
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_cstate ON public.cluster_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

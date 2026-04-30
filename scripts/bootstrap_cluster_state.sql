-- One-shot bootstrap for public.cluster_state — warm-starts Trinity-LT B-score.
--
-- Why: Trinity-LT (Algorithm 2) requires a per-cluster B-score (EMA of the
--   gap since last impression) to identify the long-tail pool. With an empty
--   cluster_state, never-shown clusters fall back to a sentinel max, so the
--   long-tail filter becomes a no-op and Trinity-LT collapses to
--   weighted-sample-by-h² — amplifying the user's dominant interest.
--
-- What it does: replays the last 30 days of user_feed_impressions × published_articles,
--   computes MAX(impression_time) per cluster, and seeds cluster_state with
--   b_score = (now - last_shown_at) so the long-tail ranking works on the very
--   first request after bootstrap.
--
-- Run order: AFTER train_rq_vae.py has restamped articles under codebook v4
--   (J=256, K=2048). Reason: the join uses the article's CURRENT vq_secondary,
--   so old impressions resolve to new cluster ids.
--
-- Idempotent: TRUNCATE + INSERT pattern.
--
-- Apply with:
--   psql "$SUPABASE_URL" -f scripts/bootstrap_cluster_state.sql
-- or via mcp__supabase__execute_sql.

TRUNCATE TABLE public.cluster_state;

INSERT INTO public.cluster_state (cluster_id, last_shown_at, b_score, shown_count, updated_at)
SELECT
  pa.vq_secondary AS cluster_id,
  MAX(ufi.created_at) AS last_shown_at,
  EXTRACT(EPOCH FROM (now() - MAX(ufi.created_at)))::float8 AS b_score,
  COUNT(*) AS shown_count,
  now() AS updated_at
FROM public.user_feed_impressions ufi
JOIN public.published_articles pa ON pa.id = ufi.article_id
WHERE pa.vq_secondary IS NOT NULL
  AND ufi.created_at > now() - interval '30 days'
GROUP BY pa.vq_secondary;

-- Verification: how many clusters did we warm? What's the B-score range?
SELECT
  COUNT(*)               AS clusters_warmed,
  MIN(b_score)::int      AS min_b_score_sec,
  MAX(b_score)::int      AS max_b_score_sec,
  AVG(b_score)::int      AS avg_b_score_sec,
  MAX(shown_count)       AS max_shown_count
FROM public.cluster_state;

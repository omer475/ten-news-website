-- One-shot bootstrap for public.cluster_state — warm-starts Trinity-LT B-score
-- from the last 30 days of user_feed_impressions × published_articles.
-- Run order: AFTER train_rq_vae.py has stamped articles with codebook v1.

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

SELECT
  COUNT(*)               AS clusters_warmed,
  MIN(b_score)::int      AS min_b_score_sec,
  MAX(b_score)::int      AS max_b_score_sec,
  AVG(b_score)::int      AS avg_b_score_sec,
  MAX(shown_count)       AS max_shown_count
FROM public.cluster_state;

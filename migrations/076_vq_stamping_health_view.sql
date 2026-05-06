-- Migration 076 — VQ stamping health monitoring view.
--
-- The pipeline silently stopped writing vq_primary/vq_secondary on 2026-05-01,
-- which only became visible 5 days later via session diagnostics. This view
-- exposes a one-row health snapshot (last 6h published vs stamped) so a cron
-- can alert when stamping regresses.

CREATE OR REPLACE VIEW vq_stamping_health AS
SELECT
  COUNT(*)::int                                              AS published_6h,
  COUNT(*) FILTER (WHERE vq_primary IS NOT NULL)::int        AS stamped_6h,
  COUNT(*) FILTER (WHERE vq_primary IS NULL)::int            AS unstamped_6h,
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE vq_primary IS NOT NULL) / COUNT(*), 2)
       ELSE NULL
  END                                                        AS pct_stamped_6h,
  COUNT(*) FILTER (WHERE vq_primary IS NULL
                   AND created_at > now() - interval '24 hours')::int
                                                             AS unstamped_24h,
  MAX(created_at) FILTER (WHERE vq_primary IS NOT NULL)      AS last_stamped_at,
  MIN(created_at) FILTER (WHERE vq_primary IS NULL
                          AND created_at > now() - interval '24 hours')
                                                             AS oldest_unstamped_in_24h
FROM published_articles
WHERE created_at > now() - interval '6 hours';

COMMENT ON VIEW vq_stamping_health IS
  'One-row snapshot for VQ stamping observability. Surfaced via /api/admin/vq-health.';

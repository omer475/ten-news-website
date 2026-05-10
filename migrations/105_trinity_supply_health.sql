-- Migration 105 — Phase 1.4 (TikTok mirror plan).
-- Supply-health observability for the dedup-window-vs-content-supply tradeoff.
--
-- Why: the mig 095/098/099 ping-pong (14d → 7d → 24h in two days) treated a
-- supply problem (test user had been impressed by every fresh AI article in
-- last 14 days) by shrinking the dedup window. Without quantitative metrics,
-- the next supply crisis will be diagnosed the same way.
--
-- This view answers: "for each user's top-3 primaries, how many unseen,
-- engagement-quality articles are retrievable in the last 7 days?" When
-- median user has < 10 retrievable in any top-3 primary, that's a supply
-- alert (not a window-shrink trigger).

CREATE OR REPLACE FUNCTION public.trinity_supply_health(
  p_top_n int DEFAULT 3
)
RETURNS TABLE (
  user_id              uuid,
  vq_primary           smallint,
  primary_rank         int,
  retrievable_count_7d int,
  total_count_7d       int
)
LANGUAGE sql
STABLE
AS $$
  WITH user_top_primaries AS (
    -- Top-N primaries per user by recent (last 30d) event weight.
    SELECT
      e.user_id,
      a.vq_primary,
      ROW_NUMBER() OVER (PARTITION BY e.user_id ORDER BY COUNT(*) DESC) AS rnk
    FROM public.user_article_events e
    JOIN public.published_articles a ON a.id = e.article_id
    WHERE e.user_id IS NOT NULL
      AND a.vq_primary IS NOT NULL
      AND e.created_at > NOW() - interval '30 days'
    GROUP BY e.user_id, a.vq_primary
  ),
  fresh_articles AS (
    SELECT id, vq_primary, ai_final_score
    FROM public.published_articles
    WHERE vq_primary IS NOT NULL
      AND created_at > NOW() - interval '7 days'
      AND COALESCE(ai_final_score, 0) >= 300
  )
  SELECT
    utp.user_id,
    utp.vq_primary,
    utp.rnk::int AS primary_rank,
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi
        WHERE ufi.user_id = utp.user_id AND ufi.article_id = fa.id
          AND ufi.created_at > NOW() - interval '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_article_events ev
        WHERE ev.user_id = utp.user_id AND ev.article_id = fa.id
          AND ev.event_type IN (
            'article_liked', 'article_saved', 'article_shared',
            'article_revisit', 'article_detail_view'
          )
      )
    )::int AS retrievable_count_7d,
    COUNT(*)::int AS total_count_7d
  FROM user_top_primaries utp
  LEFT JOIN fresh_articles fa ON fa.vq_primary = utp.vq_primary
  WHERE utp.rnk <= p_top_n
  GROUP BY utp.user_id, utp.vq_primary, utp.rnk;
$$;

COMMENT ON FUNCTION public.trinity_supply_health IS
  'Phase 1.4 (2026-05-10). Per-(user, top-N primary) retrievable supply count for last 7 days. Used by /api/cron/trinity-supply-alert to surface supply problems before they become window-shrink decisions.';

-- Migration 087 — Phoenix Phase 4.A.3. Engagement-aware lifetime exclude.
--
-- Root cause analysis of repeated duplicates: 6 of 15 repeat articles in
-- the 14:51 UTC request were articles the user PREVIOUSLY ENGAGED with
-- (Dylan Biopic engaged 3×, US Soccer $228M engaged 2×, Berkshire 1×,
-- Hong Kong Home Sales 1×, London Marathon 1×, DoorDash 1×). The 6h
-- (Phase 4.A) and 48h (Phase 4.A.2) windows were chronological — they
-- couldn't distinguish "user actively read this" from "user scrolled past."
--
-- TikTok-aligned rule: dedup WATCHED content for "weeks minimum" (per
-- ex-engineer talks). Translation:
--   * If user has any engagement event (article_engaged / article_liked /
--     article_saved / article_shared / article_revisit / article_detail_view)
--     → LIFETIME hard exclude. They actively chose to read it.
--   * Else (just impressed, no reaction) → 48h hard exclude.
--   * Older impressions (>48h, never engaged) → soft seenDecay applies.
--
-- Pool starvation risk: minimal. Most lifetime impressions have no
-- engagement event. Primary 39 example: 442 seen lifetime, ~100-150 with
-- engagement events. User still has 600+ retrievable articles per top
-- primary.

CREATE OR REPLACE FUNCTION public.trinity_fetch_cluster_with_seencount(
  p_user_id      uuid,
  p_vq_secondary smallint,
  p_hours_window int  DEFAULT 168,
  p_min_score    real DEFAULT 0,
  p_limit        int  DEFAULT 20
)
RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           real,
  vq_primary               smallint,
  vq_secondary             smallint,
  embedding_minilm_vec     vector(384),
  image_url                text,
  image_source             text,
  source                   text,
  url                      text,
  expected_read_seconds    int,
  created_at               timestamptz,
  published_at             timestamptz,
  components_order         text[],
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.emoji, pa.num_sources,
    pa.freshness_category, pa.shelf_life_days, pa.author_id, pa.author_name,
    COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id
      AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_secondary = p_vq_secondary
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id
          AND e.article_id = pa.id
          AND e.event_type IN (
            'article_engaged', 'article_liked', 'article_saved',
            'article_shared', 'article_revisit', 'article_detail_view'
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id
          AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '48 hours'
      )
    ))
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;


CREATE OR REPLACE FUNCTION public.trinity_fetch_fresh_with_seencount(
  p_user_id      uuid,
  p_vq_primaries smallint[],
  p_hours_window int  DEFAULT 48,
  p_min_score    real DEFAULT 500,
  p_limit        int  DEFAULT 80
)
RETURNS TABLE (
  id                       bigint,
  title_news               text,
  summary_bullets_news     jsonb,
  category                 text,
  ai_final_score           real,
  vq_primary               smallint,
  vq_secondary             smallint,
  embedding_minilm_vec     vector(384),
  image_url                text,
  image_source             text,
  source                   text,
  url                      text,
  expected_read_seconds    int,
  created_at               timestamptz,
  published_at             timestamptz,
  components_order         text[],
  emoji                    text,
  num_sources              int,
  freshness_category       text,
  shelf_life_days          int,
  author_id                uuid,
  author_name              text,
  seen_count               int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id, pa.title_news, pa.summary_bullets_news, pa.category, pa.ai_final_score,
    pa.vq_primary, pa.vq_secondary, pa.embedding_minilm_vec, pa.image_url,
    pa.image_source, pa.source, pa.url, pa.expected_read_seconds, pa.created_at,
    pa.published_at, pa.components_order, pa.emoji, pa.num_sources,
    pa.freshness_category, pa.shelf_life_days, pa.author_id, pa.author_name,
    COALESCE(seen.cnt, 0)::int AS seen_count
  FROM public.published_articles pa
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_feed_impressions ufi
    WHERE ufi.user_id = p_user_id
      AND ufi.article_id = pa.id
  ) seen ON p_user_id IS NOT NULL
  WHERE pa.vq_primary = ANY(p_vq_primaries)
    AND pa.created_at >= NOW() - make_interval(hours => p_hours_window)
    AND COALESCE(pa.ai_final_score, 0) >= p_min_score
    AND (p_user_id IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_article_events e
        WHERE e.user_id = p_user_id
          AND e.article_id = pa.id
          AND e.event_type IN (
            'article_engaged', 'article_liked', 'article_saved',
            'article_shared', 'article_revisit', 'article_detail_view'
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_feed_impressions ufi2
        WHERE ufi2.user_id = p_user_id
          AND ufi2.article_id = pa.id
          AND ufi2.created_at > NOW() - interval '48 hours'
      )
    ))
  ORDER BY pa.ai_final_score DESC NULLS LAST, pa.created_at DESC
  LIMIT p_limit;
$$;

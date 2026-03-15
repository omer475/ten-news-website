-- Migration 034: Add bucket tracking to feed impressions
-- Enables server-side bucket resolution for analytics events that don't include bucket metadata.
-- This is critical because ArticleCardView and ArticleDetailViewModel send engagement events
-- (article_engaged, article_detail_view) without bucket info. Without this, those events
-- bypass bucket guards and contaminate taste_vector/tag_profile at full weight.

-- Add bucket column to feed impressions
ALTER TABLE user_feed_impressions ADD COLUMN IF NOT EXISTS bucket TEXT;

-- Index for fast bucket lookup by (user_id, article_id) — used in track.js fallback
CREATE INDEX IF NOT EXISTS idx_feed_impressions_user_article
ON user_feed_impressions (user_id, article_id);

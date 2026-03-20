-- ============================================================
-- 026: EXPLORE DAILY BOOST TRACKER
-- Stores { date: "2026-03-12", total: 0.23 } to cap daily
-- Explore page tag_profile boosts at 0.40 per day.
-- Prevents casual browsing from inflating the taste profile.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS explore_daily_boost JSONB DEFAULT '{}';

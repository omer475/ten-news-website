-- Migration 022: Add scorecard, recipe, and article_type columns
-- Supports specialized info boxes for match results and recipes

ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS scorecard JSONB;
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS recipe JSONB;
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS article_type VARCHAR(50) DEFAULT 'standard';

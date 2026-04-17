-- Migration 043: Add pages column for multi-page carousel articles
-- Each page has: title (optional), image_url (optional, falls back to first page's image), bullets
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS pages jsonb DEFAULT NULL;

-- pages format:
-- [
--   {"title": "Main Title", "image_url": "https://...", "bullets": ["point 1", "point 2"]},
--   {"title": "The Background", "image_url": null, "bullets": ["context 1", "context 2"]},
--   {"title": null, "image_url": null, "bullets": ["detail 1", "detail 2"]}
-- ]
-- When pages is NULL, the article is single-page (backward compatible)

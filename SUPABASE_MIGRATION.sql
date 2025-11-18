-- =================================================================
-- SUPABASE DATABASE MIGRATION
-- Adding News (Advanced) and B2 (Easy) English versions
-- =================================================================

-- 1. TITLES - Add advanced and B2 versions
-- (Keep existing 'title' column for backward compatibility)
ALTER TABLE articles 
ADD COLUMN title_news TEXT,
ADD COLUMN title_b2 TEXT;

-- 2. ARTICLE CONTENT - Add both versions (300-400 words each)
-- Existing 'article' column can be used as reference or deprecated
ALTER TABLE articles 
ADD COLUMN content_news TEXT,
ADD COLUMN content_b2 TEXT;

-- 3. BULLET POINTS - Add advanced and B2 versions (4 bullets, 10-15 words each)
-- (Keep existing 'summary_bullets' column for backward compatibility)
ALTER TABLE articles 
ADD COLUMN summary_bullets_news TEXT[],
ADD COLUMN summary_bullets_b2 TEXT[];

-- =================================================================
-- FINAL COLUMN STRUCTURE:
-- =================================================================
-- title               TEXT      (OLD - keep for backward compatibility)
-- title_news          TEXT      (NEW - Advanced professional title)
-- title_b2            TEXT      (NEW - B2 English title)
--
-- article             TEXT      (OLD - keep for backward compatibility)
-- content_news        TEXT      (NEW - Professional journalism, 300-400 words)
-- content_b2          TEXT      (NEW - B2 English, 300-400 words)
--
-- summary_bullets     TEXT[]    (OLD - keep for backward compatibility)
-- summary_bullets_news TEXT[]   (NEW - Professional bullets, 4 × 10-15 words)
-- summary_bullets_b2   TEXT[]   (NEW - B2 English bullets, 4 × 10-15 words)
-- =================================================================

-- Optional: You can drop old columns later if not needed
-- ALTER TABLE articles DROP COLUMN title;
-- ALTER TABLE articles DROP COLUMN article;
-- ALTER TABLE articles DROP COLUMN summary_bullets;


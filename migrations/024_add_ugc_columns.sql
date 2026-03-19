-- User-generated content columns
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS is_ugc BOOLEAN DEFAULT FALSE;
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Index for filtering UGC content
CREATE INDEX IF NOT EXISTS idx_articles_ugc ON published_articles(is_ugc) WHERE is_ugc = TRUE;
CREATE INDEX IF NOT EXISTS idx_articles_author ON published_articles(author_id) WHERE author_id IS NOT NULL;

-- Supabase Storage bucket for user uploads (run in Supabase Dashboard > Storage if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-content', 'user-content', true) ON CONFLICT DO NOTHING;

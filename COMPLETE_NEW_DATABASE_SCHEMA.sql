-- ==========================================
-- TEN NEWS - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ==========================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ==========================================
-- ARTICLES TABLE
-- ==========================================
CREATE TABLE articles (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Core article fields
    url TEXT UNIQUE NOT NULL,
    guid TEXT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    
    -- Image and media
    image_url TEXT,
    image_extraction_method TEXT,
    
    -- Author and dates
    author TEXT,
    published_date TIMESTAMP WITH TIME ZONE,
    
    -- AI processing fields
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_score_raw FLOAT,
    ai_category TEXT,
    ai_reasoning TEXT,
    ai_final_score FLOAT DEFAULT 0,
    ai_title TEXT,
    
    -- NEW: Main content fields
    article TEXT,                    -- Detailed article text (max 200 words)
    summary_bullets JSONB,           -- Array of 3-5 bullet points
    
    -- Publishing status
    published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT DEFAULT 'World News',
    emoji TEXT DEFAULT '📰',
    
    -- Visual components (stored as JSON)
    timeline JSONB,                  -- Timeline events
    details_section TEXT,            -- Key details as text
    ai_details JSONB,                -- Details as structured data
    graph JSONB,                     -- Graph data
    map JSONB,                       -- Map data
    ai_citations JSONB,              -- Citations
    
    -- Engagement metrics
    view_count INTEGER DEFAULT 0,
    
    -- Timestamps
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- URL index (for duplicate checking)
CREATE INDEX idx_articles_url ON articles(url);

-- Published articles index (most common query)
CREATE INDEX idx_articles_published ON articles(published, published_at DESC);

-- Score index (for filtering high-quality articles)
CREATE INDEX idx_articles_score ON articles(ai_final_score DESC);

-- Category index
CREATE INDEX idx_articles_category ON articles(category);

-- Full-text search on title
CREATE INDEX idx_articles_title_search ON articles USING gin(to_tsvector('english', title));

-- JSONB indexes for components
CREATE INDEX idx_articles_summary_bullets ON articles USING gin(summary_bullets);
CREATE INDEX idx_articles_timeline ON articles USING gin(timeline);
CREATE INDEX idx_articles_graph ON articles USING gin(graph);
CREATE INDEX idx_articles_map ON articles USING gin(map);

-- ==========================================
-- PROFILES TABLE (for user authentication)
-- ==========================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ==========================================
-- ROW LEVEL SECURITY FOR ARTICLES
-- ==========================================

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read access to published articles
CREATE POLICY "Anyone can read published articles"
    ON articles FOR SELECT
    USING (published = true);

-- Only authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert articles"
    ON articles FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users can update articles"
    ON articles FOR UPDATE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users can delete articles"
    ON articles FOR DELETE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for articles table
CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Verify articles table structure
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- Verify indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'articles'
ORDER BY indexname;

-- Count tables
SELECT 
    'articles' as table_name,
    COUNT(*) as row_count
FROM articles
UNION ALL
SELECT 
    'profiles' as table_name,
    COUNT(*) as row_count
FROM profiles;

-- ==========================================
-- ✅ SETUP COMPLETE!
-- ==========================================

-- You should see:
-- 1. Articles table with all columns created
-- 2. Multiple indexes for performance
-- 3. Profiles table for authentication
-- 4. Row Level Security policies enabled
-- 5. Triggers for auto-updating timestamps
-- 6. Both tables showing 0 rows (empty and ready)

-- Next steps:
-- 1. Copy your Supabase URL and anon key
-- 2. Update your .env file with new credentials
-- 3. Start the news generation system
-- 4. Articles will be saved with 'article' and 'summary_bullets' populated!


-- ==========================================
-- EVENT CLUSTERING & AI SYNTHESIS SYSTEM
-- Database Schema for Today+ News Platform
-- ==========================================
-- Run this in Supabase SQL Editor to add clustering tables
-- These tables coexist with existing 'articles' table

-- ==========================================
-- TABLE 1: SOURCE_ARTICLES
-- Original RSS articles before clustering
-- ==========================================

CREATE TABLE IF NOT EXISTS source_articles (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Core article fields
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    
    -- Source metadata
    source_name VARCHAR(255) NOT NULL,
    source_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- AI scoring (from Step 1)
    score INTEGER DEFAULT 0,  -- Score out of 1000
    
    -- Clustering metadata
    keywords TEXT[],  -- Array of extracted keywords
    entities TEXT[],  -- Array of extracted entities (people, places, orgs)
    category VARCHAR(100),  -- e.g., "world", "politics", "science"
    
    -- Cluster assignment
    cluster_id BIGINT,  -- Foreign key to clusters table (NULL if not yet clustered)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_normalized_url UNIQUE (normalized_url)
);

-- Indexes for source_articles
CREATE INDEX idx_source_articles_published_at ON source_articles(published_at DESC);
CREATE INDEX idx_source_articles_cluster_id ON source_articles(cluster_id);
CREATE INDEX idx_source_articles_normalized_url ON source_articles(normalized_url);
CREATE INDEX idx_source_articles_score ON source_articles(score DESC);
CREATE INDEX idx_source_articles_fetched_at ON source_articles(fetched_at DESC);

-- GIN index for array columns (fast keyword/entity searches)
CREATE INDEX idx_source_articles_keywords ON source_articles USING gin(keywords);
CREATE INDEX idx_source_articles_entities ON source_articles USING gin(entities);

-- ==========================================
-- TABLE 2: CLUSTERS
-- Groups of articles about the same event
-- ==========================================

CREATE TABLE IF NOT EXISTS clusters (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Event metadata
    event_name VARCHAR(500),  -- e.g., "Turkey Earthquake"
    main_title TEXT NOT NULL,  -- The title used for the published article
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,  -- When cluster stops accepting new articles
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'closed'
    
    -- Metrics
    source_count INTEGER DEFAULT 0,  -- Number of source articles
    importance_score INTEGER DEFAULT 0,  -- Aggregated importance (max score from sources)
    
    -- Constraints
    CHECK (status IN ('active', 'closed'))
);

-- Indexes for clusters
CREATE INDEX idx_clusters_status ON clusters(status);
CREATE INDEX idx_clusters_last_updated_at ON clusters(last_updated_at DESC);
CREATE INDEX idx_clusters_importance_score ON clusters(importance_score DESC);
CREATE INDEX idx_clusters_created_at ON clusters(created_at DESC);

-- ==========================================
-- TABLE 3: PUBLISHED_ARTICLES
-- AI-generated articles that synthesize multiple sources
-- ==========================================

CREATE TABLE IF NOT EXISTS published_articles (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Link to cluster (one published article per cluster)
    cluster_id BIGINT UNIQUE NOT NULL,
    
    -- Dual-language titles
    title_news TEXT NOT NULL,  -- Advanced/professional language
    title_b2 TEXT NOT NULL,    -- Simplified B2 language
    
    -- Dual-language summaries (bullet points stored as JSONB array)
    summary_bullets_news JSONB,  -- Array of 3-5 bullet points (advanced)
    summary_bullets_b2 JSONB,    -- Array of 3-5 bullet points (B2)
    
    -- Dual-language article content (200 words synthesized from all sources)
    content_news TEXT NOT NULL,  -- Advanced/professional language
    content_b2 TEXT NOT NULL,    -- Simplified B2 language
    
    -- Visual components (stored as JSONB)
    timeline JSONB,           -- Timeline events
    details JSONB,            -- Key details/statistics
    graph JSONB,              -- Graph data
    map JSONB,                -- Map data
    components TEXT[],        -- List of selected components: ['timeline', 'details', 'graph', 'map']
    
    -- Metadata
    category VARCHAR(100) DEFAULT 'World News',
    emoji TEXT DEFAULT '📰',
    
    -- Version tracking (for updates)
    version_number INTEGER DEFAULT 1,  -- Increments with each regeneration
    
    -- Engagement
    view_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to clusters
ALTER TABLE published_articles
    ADD CONSTRAINT fk_published_articles_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE;

-- Indexes for published_articles
CREATE INDEX idx_published_articles_cluster_id ON published_articles(cluster_id);
CREATE INDEX idx_published_articles_last_updated_at ON published_articles(last_updated_at DESC);
CREATE INDEX idx_published_articles_version_number ON published_articles(version_number);
CREATE INDEX idx_published_articles_published_at ON published_articles(published_at DESC);

-- JSONB indexes for components
CREATE INDEX idx_published_articles_timeline ON published_articles USING gin(timeline);
CREATE INDEX idx_published_articles_details ON published_articles USING gin(details);
CREATE INDEX idx_published_articles_graph ON published_articles USING gin(graph);
CREATE INDEX idx_published_articles_map ON published_articles USING gin(map);

-- ==========================================
-- TABLE 4: ARTICLE_UPDATES_LOG
-- Tracks update history for transparency
-- ==========================================

CREATE TABLE IF NOT EXISTS article_updates_log (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Link to published article
    article_id BIGINT NOT NULL,
    
    -- Update metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trigger_type VARCHAR(100) NOT NULL,  -- 'high_score', 'volume', 'manual', 'initial'
    trigger_details TEXT,  -- JSON or text with details (e.g., which source triggered)
    sources_added_count INTEGER DEFAULT 0,  -- How many new sources since last update
    
    -- Version tracking
    old_version INTEGER,
    new_version INTEGER
);

-- Add foreign key constraint to published_articles
ALTER TABLE article_updates_log
    ADD CONSTRAINT fk_article_updates_log_article
    FOREIGN KEY (article_id) REFERENCES published_articles(id) ON DELETE CASCADE;

-- Indexes for article_updates_log
CREATE INDEX idx_article_updates_log_article_id ON article_updates_log(article_id);
CREATE INDEX idx_article_updates_log_updated_at ON article_updates_log(updated_at DESC);
CREATE INDEX idx_article_updates_log_trigger_type ON article_updates_log(trigger_type);

-- ==========================================
-- ADD FOREIGN KEY FROM SOURCE_ARTICLES TO CLUSTERS
-- ==========================================

ALTER TABLE source_articles
    ADD CONSTRAINT fk_source_articles_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE source_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_updates_log ENABLE ROW LEVEL SECURITY;

-- Public read access to published articles and related data
CREATE POLICY "Anyone can read published articles"
    ON published_articles FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read clusters"
    ON clusters FOR SELECT
    USING (status = 'active');

CREATE POLICY "Anyone can read source articles"
    ON source_articles FOR SELECT
    USING (cluster_id IS NOT NULL);

CREATE POLICY "Anyone can read update logs"
    ON article_updates_log FOR SELECT
    USING (true);

-- Authenticated/service role can insert, update, delete
CREATE POLICY "Service role can manage source articles"
    ON source_articles FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Service role can manage clusters"
    ON clusters FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Service role can manage published articles"
    ON published_articles FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Service role can manage update logs"
    ON article_updates_log FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clustering_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for source_articles table
CREATE TRIGGER update_source_articles_updated_at
    BEFORE UPDATE ON source_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_clustering_updated_at_column();

-- Trigger for clusters table
CREATE TRIGGER update_clusters_updated_at
    BEFORE UPDATE ON clusters
    FOR EACH ROW
    EXECUTE FUNCTION update_clustering_updated_at_column();

-- Trigger for published_articles table
CREATE TRIGGER update_published_articles_updated_at
    BEFORE UPDATE ON published_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_clustering_updated_at_column();

-- Function to update cluster metrics when source articles change
CREATE OR REPLACE FUNCTION update_cluster_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update source_count and importance_score in clusters table
    UPDATE clusters
    SET 
        source_count = (
            SELECT COUNT(*) 
            FROM source_articles 
            WHERE cluster_id = NEW.cluster_id
        ),
        importance_score = (
            SELECT COALESCE(MAX(score), 0)
            FROM source_articles
            WHERE cluster_id = NEW.cluster_id
        ),
        last_updated_at = NOW()
    WHERE id = NEW.cluster_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cluster metrics when source article is inserted/updated
CREATE TRIGGER update_cluster_metrics_on_source_change
    AFTER INSERT OR UPDATE OF cluster_id, score ON source_articles
    FOR EACH ROW
    WHEN (NEW.cluster_id IS NOT NULL)
    EXECUTE FUNCTION update_cluster_metrics();

-- ==========================================
-- UTILITY FUNCTIONS
-- ==========================================

-- Function to get all source articles for a cluster
CREATE OR REPLACE FUNCTION get_cluster_sources(cluster_id_param BIGINT)
RETURNS TABLE (
    id BIGINT,
    url TEXT,
    title TEXT,
    description TEXT,
    content TEXT,
    source_name VARCHAR(255),
    score INTEGER,
    published_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.id,
        sa.url,
        sa.title,
        sa.description,
        sa.content,
        sa.source_name,
        sa.score,
        sa.published_at,
        sa.fetched_at
    FROM source_articles sa
    WHERE sa.cluster_id = cluster_id_param
    ORDER BY sa.score DESC, sa.published_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get active clusters
CREATE OR REPLACE FUNCTION get_active_clusters()
RETURNS TABLE (
    id BIGINT,
    event_name VARCHAR(500),
    main_title TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    source_count INTEGER,
    importance_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.event_name,
        c.main_title,
        c.created_at,
        c.last_updated_at,
        c.source_count,
        c.importance_score
    FROM clusters c
    WHERE c.status = 'active'
    ORDER BY c.last_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Count rows in each table
SELECT 'source_articles' as table_name, COUNT(*) as row_count FROM source_articles
UNION ALL
SELECT 'clusters' as table_name, COUNT(*) as row_count FROM clusters
UNION ALL
SELECT 'published_articles' as table_name, COUNT(*) as row_count FROM published_articles
UNION ALL
SELECT 'article_updates_log' as table_name, COUNT(*) as row_count FROM article_updates_log;

-- Show table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('source_articles', 'clusters', 'published_articles', 'article_updates_log')
ORDER BY table_name, ordinal_position;

-- Show indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('source_articles', 'clusters', 'published_articles', 'article_updates_log')
ORDER BY tablename, indexname;

-- ==========================================
-- ✅ MIGRATION COMPLETE!
-- ==========================================

-- You should see:
-- 1. Four new tables created (source_articles, clusters, published_articles, article_updates_log)
-- 2. Multiple indexes for performance
-- 3. Foreign key relationships established
-- 4. Row Level Security policies enabled
-- 5. Triggers for auto-updating timestamps and cluster metrics
-- 6. Utility functions for common queries
-- 7. All tables showing 0 rows (empty and ready)

-- Next steps:
-- 1. Deploy clustering engine (step1_5_event_clustering.py)
-- 2. Deploy multi-source synthesis (step3_multi_source_synthesis.py)
-- 3. Update pipeline to use clustering
-- 4. Test with real RSS articles!


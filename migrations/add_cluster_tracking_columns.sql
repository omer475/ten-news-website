-- ==========================================
-- CLUSTER PUBLISHING TRACKING COLUMNS
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- 1. CLUSTERS TABLE - New Columns
-- ==========================================

-- Publishing status (replaces simple 'active'/'closed')
-- Values: 'pending', 'processing', 'published', 'failed', 'skipped'
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS publish_status VARCHAR(50) DEFAULT 'pending';

-- Why it failed to publish (NULL if published successfully)
-- Values: 'no_content', 'no_image', 'synthesis_failed', 'verification_failed', 
--         'duplicate', 'no_sources', 'api_error', 'unknown'
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100);

-- Detailed failure message (for debugging)
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS failure_details TEXT;

-- How many times we've tried to publish this cluster
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

-- When we first attempted to publish
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS first_attempt_at TIMESTAMP WITH TIME ZONE;

-- When we last attempted to publish
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;

-- Did it succeed after previous failures? (TRUE = recovered)
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS recovered BOOLEAN DEFAULT FALSE;

-- How many attempts before it succeeded (NULL if never succeeded)
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS attempts_before_success INTEGER;

-- Full history of all attempts (JSONB array)
-- Example: [{"attempt": 1, "at": "...", "reason": "no_image", "sources": 1}, 
--           {"attempt": 2, "at": "...", "reason": null, "published": true, "sources": 3}]
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS attempt_history JSONB DEFAULT '[]'::jsonb;

-- ==========================================
-- 2. SOURCE_ARTICLES TABLE - New Columns
-- (Track which sources have problems)
-- ==========================================

-- Did we successfully fetch full content?
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS content_fetched BOOLEAN DEFAULT FALSE;

-- Why content fetch failed (if applicable)
-- Values: 'blocked', 'timeout', 'paywall', 'not_found', 'parse_error'
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS fetch_failure_reason VARCHAR(100);

-- Does this source have a usable image?
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE;

-- Image quality score (from smart image selection)
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS image_quality_score FLOAT;

-- Is this a "problem source" (consistently fails)?
ALTER TABLE source_articles 
ADD COLUMN IF NOT EXISTS is_problem_source BOOLEAN DEFAULT FALSE;

-- ==========================================
-- 3. NEW TABLE: SOURCE_RELIABILITY
-- Track which news sources are reliable for scraping
-- ==========================================

CREATE TABLE IF NOT EXISTS source_reliability (
    id BIGSERIAL PRIMARY KEY,
    
    -- Source identifier (domain or source name)
    source_domain VARCHAR(255) UNIQUE NOT NULL,
    source_name VARCHAR(255),
    
    -- Success metrics
    total_attempts INTEGER DEFAULT 0,
    successful_fetches INTEGER DEFAULT 0,
    failed_fetches INTEGER DEFAULT 0,
    success_rate FLOAT GENERATED ALWAYS AS (
        CASE WHEN total_attempts > 0 
        THEN successful_fetches::FLOAT / total_attempts 
        ELSE 0 END
    ) STORED,
    
    -- Common failure reasons for this source
    common_failure_reason VARCHAR(100),
    
    -- Is this source blocked/unreliable?
    is_blocked BOOLEAN DEFAULT FALSE,
    
    -- Should we skip this source in future?
    should_skip BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    notes TEXT
);

-- ==========================================
-- 4. INDEXES for new columns
-- ==========================================

-- Clusters indexes
CREATE INDEX IF NOT EXISTS idx_clusters_publish_status ON clusters(publish_status);
CREATE INDEX IF NOT EXISTS idx_clusters_failure_reason ON clusters(failure_reason);
CREATE INDEX IF NOT EXISTS idx_clusters_attempt_count ON clusters(attempt_count);
CREATE INDEX IF NOT EXISTS idx_clusters_recovered ON clusters(recovered) WHERE recovered = TRUE;

-- Find failed clusters that should be retried
CREATE INDEX IF NOT EXISTS idx_clusters_retry_candidates ON clusters(publish_status, attempt_count, last_attempt_at) 
WHERE publish_status = 'failed' AND attempt_count < 3;

-- Source articles indexes
CREATE INDEX IF NOT EXISTS idx_source_articles_content_fetched ON source_articles(content_fetched);
CREATE INDEX IF NOT EXISTS idx_source_articles_has_image ON source_articles(has_image);
CREATE INDEX IF NOT EXISTS idx_source_articles_problem_source ON source_articles(is_problem_source) 
WHERE is_problem_source = TRUE;

-- Source reliability indexes
CREATE INDEX IF NOT EXISTS idx_source_reliability_domain ON source_reliability(source_domain);
CREATE INDEX IF NOT EXISTS idx_source_reliability_blocked ON source_reliability(is_blocked) 
WHERE is_blocked = TRUE;

-- ==========================================
-- 5. UPDATE existing clusters with defaults
-- ==========================================

-- Mark clusters that are already published
UPDATE clusters c
SET publish_status = 'published',
    attempt_count = 1,
    first_attempt_at = c.created_at,
    last_attempt_at = c.created_at
WHERE EXISTS (
    SELECT 1 FROM published_articles pa WHERE pa.cluster_id = c.id
);

-- Mark remaining active clusters as pending
UPDATE clusters
SET publish_status = 'pending'
WHERE publish_status IS NULL OR publish_status = 'pending';

-- ==========================================
-- 6. HELPER VIEWS
-- ==========================================

-- View: Clusters that need retry
CREATE OR REPLACE VIEW clusters_retry_queue AS
SELECT 
    c.id,
    c.event_name,
    c.main_title,
    c.source_count,
    c.importance_score,
    c.publish_status,
    c.failure_reason,
    c.attempt_count,
    c.first_attempt_at,
    c.last_attempt_at,
    -- Time since last attempt
    EXTRACT(EPOCH FROM (NOW() - c.last_attempt_at)) / 3600 AS hours_since_last_attempt
FROM clusters c
WHERE c.publish_status = 'failed'
  AND c.attempt_count < 3
  AND (c.last_attempt_at IS NULL OR c.last_attempt_at < NOW() - INTERVAL '1 hour')
ORDER BY c.importance_score DESC, c.source_count DESC;

-- View: Source reliability summary
CREATE OR REPLACE VIEW source_reliability_summary AS
SELECT 
    source_domain,
    source_name,
    total_attempts,
    successful_fetches,
    failed_fetches,
    ROUND(success_rate * 100, 1) AS success_rate_pct,
    common_failure_reason,
    is_blocked,
    should_skip,
    last_attempt_at
FROM source_reliability
ORDER BY total_attempts DESC;

-- View: Publishing success by failure reason
CREATE OR REPLACE VIEW cluster_failure_stats AS
SELECT 
    failure_reason,
    COUNT(*) AS total_failed,
    AVG(attempt_count) AS avg_attempts,
    COUNT(*) FILTER (WHERE recovered = TRUE) AS recovered_count
FROM clusters
WHERE publish_status = 'failed' OR recovered = TRUE
GROUP BY failure_reason
ORDER BY total_failed DESC;

-- ==========================================
-- 7. ROW LEVEL SECURITY for new table
-- ==========================================

ALTER TABLE source_reliability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read source reliability"
    ON source_reliability FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage source reliability"
    ON source_reliability FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ==========================================
-- DONE! 
-- ==========================================
-- 
-- SUMMARY OF CHANGES:
-- 
-- CLUSTERS TABLE (new columns):
--   - publish_status: 'pending'|'processing'|'published'|'failed'|'skipped'
--   - failure_reason: Why it failed
--   - failure_details: Detailed error message
--   - attempt_count: How many times tried
--   - first_attempt_at: When first tried
--   - last_attempt_at: When last tried  
--   - recovered: Did it succeed after failures?
--   - attempts_before_success: How many attempts before success
--   - attempt_history: Full JSON history of all attempts
--
-- SOURCE_ARTICLES TABLE (new columns):
--   - content_fetched: Did Bright Data succeed?
--   - fetch_failure_reason: Why it failed
--   - has_image: Does it have a usable image?
--   - image_quality_score: Image quality score
--   - is_problem_source: Is this source unreliable?
--
-- NEW TABLE: SOURCE_RELIABILITY
--   - Tracks which domains are reliable for scraping
--   - Auto-calculates success_rate
--   - Marks blocked/problematic sources
--
-- VIEWS:
--   - clusters_retry_queue: Clusters ready for retry
--   - source_reliability_summary: Quick source stats
--   - cluster_failure_stats: Failure analytics
--


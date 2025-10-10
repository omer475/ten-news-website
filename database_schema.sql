-- Ten News RSS System - Database Schema
-- SQLite (for development/small scale)
-- Can be migrated to PostgreSQL for production

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    guid TEXT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    image_url TEXT,
    author TEXT,
    published_date TEXT,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- AI Processing
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_score_raw REAL,  -- 0-100 raw score
    ai_category TEXT,   -- breaking, science, technology, etc.
    ai_reasoning TEXT,  -- Why this score?
    ai_final_score REAL, -- Adjusted with source credibility
    
    -- Publishing
    published BOOLEAN DEFAULT FALSE,
    published_at TEXT,
    category TEXT,
    emoji TEXT,
    
    -- Timeline & Details (YOUR EXISTING PROCESS)
    timeline TEXT,  -- JSON array of key events
    details_section TEXT,  -- Detailed writeup
    summary TEXT,  -- 35-40 word summary
    timeline_generated BOOLEAN DEFAULT FALSE,
    details_generated BOOLEAN DEFAULT FALSE,
    
    -- Engagement
    view_count INTEGER DEFAULT 0,
    
    -- Image extraction metadata
    image_extraction_method TEXT,  -- enclosure, media_content, og_image, placeholder
    
    UNIQUE(url)
);

-- Fetch cycles tracking
CREATE TABLE IF NOT EXISTS fetch_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_seconds REAL,
    status TEXT,  -- running, completed, failed
    sources_fetched INTEGER DEFAULT 0,
    failed_sources INTEGER DEFAULT 0,
    new_articles_found INTEGER DEFAULT 0,
    total_articles_fetched INTEGER DEFAULT 0,
    errors TEXT  -- JSON array of errors
);

-- Source performance tracking
CREATE TABLE IF NOT EXISTS source_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT UNIQUE NOT NULL,
    last_fetch_at TEXT,
    total_fetches INTEGER DEFAULT 0,
    successful_fetches INTEGER DEFAULT 0,
    failed_fetches INTEGER DEFAULT 0,
    total_articles_found INTEGER DEFAULT 0,
    average_articles_per_fetch REAL DEFAULT 0,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

-- OPTIMIZATION: Source markers for fast duplicate detection
CREATE TABLE IF NOT EXISTS source_markers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT UNIQUE NOT NULL,
    last_article_url TEXT,
    last_article_guid TEXT,
    last_fetch_timestamp TEXT,
    last_published_date TEXT
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_published ON articles(published, published_at);
CREATE INDEX IF NOT EXISTS idx_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_ai_processed ON articles(ai_processed);
CREATE INDEX IF NOT EXISTS idx_timeline_generated ON articles(timeline_generated);
CREATE INDEX IF NOT EXISTS idx_fetched_at ON articles(fetched_at);
CREATE INDEX IF NOT EXISTS idx_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_guid ON articles(guid);
CREATE INDEX IF NOT EXISTS idx_source ON articles(source);


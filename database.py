"""
TEN NEWS LIVE - DATABASE SCHEMA
SQLite database for storing articles, cycles, and logs
"""

import sqlite3
from datetime import datetime

def init_database(db_path='news.db'):
    """Initialize database with all tables"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Articles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            hash TEXT UNIQUE NOT NULL,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            content TEXT,
            image_url TEXT,
            author TEXT,
            published_date TEXT,
            category TEXT NOT NULL,
            source_credibility INTEGER DEFAULT 6,
            
            -- AI Processing
            ai_processed BOOLEAN DEFAULT FALSE,
            ai_stage1_pass BOOLEAN,
            ai_global_impact INTEGER,
            ai_scientific_significance INTEGER,
            ai_novelty INTEGER,
            ai_credibility INTEGER,
            ai_engagement INTEGER,
            ai_final_score REAL,
            ai_emoji TEXT,
            ai_reasoning TEXT,
            
            -- Publishing
            published BOOLEAN DEFAULT FALSE,
            published_at TEXT,
            view_count INTEGER DEFAULT 0,
            
            -- Timestamps
            fetched_at TEXT NOT NULL,
            processed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Indexes for fast queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_ai_score ON articles(ai_final_score)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_ai_processed ON articles(ai_processed)')
    
    # Fetch cycles tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fetch_cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            duration_seconds REAL,
            sources_total INTEGER,
            sources_success INTEGER,
            sources_failed INTEGER,
            articles_found INTEGER,
            new_articles_saved INTEGER,
            status TEXT DEFAULT 'running',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # AI filter cycles tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_filter_cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            duration_seconds REAL,
            articles_processed INTEGER,
            articles_published INTEGER,
            stage1_rejected INTEGER,
            stage2_rejected INTEGER,
            avg_score REAL,
            status TEXT DEFAULT 'running',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # System logs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            component TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    
    print("✅ Database initialized successfully!")

def get_stats(db_path='news.db'):
    """Get database statistics"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Total articles
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]
    
    # Waiting for AI
    cursor.execute('SELECT COUNT(*) FROM articles WHERE ai_processed = FALSE')
    waiting = cursor.fetchone()[0]
    
    # Published
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
    published = cursor.fetchone()[0]
    
    # Today's published
    cursor.execute('''
        SELECT COUNT(*) FROM articles 
        WHERE published = TRUE AND date(published_at) = date('now')
    ''')
    today = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        'total_articles': total,
        'waiting_for_ai': waiting,
        'published': published,
        'published_today': today
    }

if __name__ == '__main__':
    print("🗄️  Initializing Ten News Live database...")
    init_database()
    
    print("\n📊 Database stats:")
    stats = get_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")


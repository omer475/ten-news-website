"""
TEN NEWS LIVE - HEALTH CHECK
Monitor system health and display statistics
"""

import sqlite3
from datetime import datetime, timedelta
from config import DATABASE_PATH

def check_system_health():
    """Check if system is running properly"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("\n🏥 SYSTEM HEALTH CHECK")
    print("=" * 70)
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # 1. Check last fetch cycle
    cursor.execute('''
        SELECT started_at, status, new_articles_saved, sources_success, sources_failed
        FROM fetch_cycles
        ORDER BY started_at DESC
        LIMIT 1
    ''')
    last_fetch = cursor.fetchone()
    
    if last_fetch:
        last_time = datetime.fromisoformat(last_fetch[0])
        minutes_ago = (datetime.now() - last_time).total_seconds() / 60
        
        print("📡 RSS FETCHER:")
        if minutes_ago > 15:
            print(f"   ⚠️  WARNING: Last fetch was {minutes_ago:.0f} minutes ago")
            print(f"      Expected: < 15 minutes")
        else:
            print(f"   ✅ Running (last fetch {minutes_ago:.0f}m ago)")
            print(f"      New articles: {last_fetch[2]}")
            print(f"      Sources OK: {last_fetch[3]}/{last_fetch[3]+last_fetch[4]}")
    else:
        print("📡 RSS FETCHER:")
        print("   ❌ ERROR: No fetch cycles found!")
    
    # 2. Check last AI filter cycle
    cursor.execute('''
        SELECT started_at, articles_processed, articles_published, avg_score
        FROM ai_filter_cycles
        ORDER BY started_at DESC
        LIMIT 1
    ''')
    last_filter = cursor.fetchone()
    
    print()
    print("🤖 AI FILTER:")
    if last_filter:
        last_time = datetime.fromisoformat(last_filter[0])
        minutes_ago = (datetime.now() - last_time).total_seconds() / 60
        
        if minutes_ago > 10:
            print(f"   ⚠️  WARNING: Last filter was {minutes_ago:.0f} minutes ago")
        else:
            print(f"   ✅ Running (last filter {minutes_ago:.0f}m ago)")
            print(f"      Processed: {last_filter[1]} articles")
            print(f"      Published: {last_filter[2]} articles")
            print(f"      Avg score: {last_filter[3]:.1f}/100")
    else:
        print("   ⏳ Waiting for first cycle...")
    
    # 3. Check articles today
    cursor.execute('''
        SELECT COUNT(*) FROM articles
        WHERE date(fetched_at) = date('now')
    ''')
    fetched_today = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT COUNT(*) FROM articles
        WHERE date(published_at) = date('now')
    ''')
    published_today = cursor.fetchone()[0]
    
    print()
    print("📊 TODAY'S STATISTICS:")
    print(f"   Fetched: {fetched_today:,} articles")
    print(f"   Published: {published_today:,} articles")
    if fetched_today > 0:
        print(f"   Acceptance rate: {(published_today/fetched_today*100):.1f}%")
    
    # 4. Check AI processing queue
    cursor.execute('''
        SELECT COUNT(*) FROM articles
        WHERE ai_processed = FALSE
    ''')
    unprocessed = cursor.fetchone()[0]
    
    print()
    print("⏳ PROCESSING QUEUE:")
    if unprocessed > 1000:
        print(f"   ⚠️  WARNING: {unprocessed:,} articles waiting for AI")
        print(f"      AI filter may be behind!")
    else:
        print(f"   ✅ {unprocessed:,} articles in queue")
    
    # 5. Check database size
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
    published = cursor.fetchone()[0]
    
    print()
    print("💾 DATABASE:")
    print(f"   Total articles: {total:,}")
    print(f"   Published: {published:,}")
    print(f"   Unpublished: {total - published:,}")
    
    # 6. Check source diversity
    cursor.execute('''
        SELECT COUNT(DISTINCT source) FROM articles
        WHERE datetime(fetched_at) >= datetime('now', '-1 hour')
    ''')
    active_sources = cursor.fetchone()[0]
    
    print(f"   Active sources (last hour): {active_sources}")
    
    # 7. Top categories today
    cursor.execute('''
        SELECT category, COUNT(*) as count
        FROM articles
        WHERE published = TRUE
        AND date(published_at) = date('now')
        GROUP BY category
        ORDER BY count DESC
        LIMIT 5
    ''')
    
    print()
    print("🏆 TOP CATEGORIES TODAY:")
    for row in cursor.fetchall():
        print(f"   {row[0]:15} {row[1]:3} articles")
    
    conn.close()
    
    print("=" * 70 + "\n")

if __name__ == '__main__':
    check_system_health()


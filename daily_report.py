"""
TEN NEWS - Daily Report Generator
Generate comprehensive daily statistics report
"""

import sqlite3
from datetime import datetime, timedelta
import json

class DailyReporter:
    def __init__(self, db_path='ten_news.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
    
    def generate_report(self):
        """Generate complete daily report"""
        print("📊 TEN NEWS - DAILY REPORT")
        print("=" * 60)
        print(f"Report Date: {datetime.now().strftime('%A, %B %d, %Y')}")
        print("=" * 60)
        
        self.section_fetch_performance()
        self.section_article_stats()
        self.section_publishing_stats()
        self.section_category_breakdown()
        self.section_top_sources()
        self.section_image_stats()
        self.section_source_health()
        self.section_ai_performance()
        
        self.conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Daily Report Complete")
        print("=" * 60)
    
    def section_fetch_performance(self):
        """RSS fetch performance"""
        print("\n📡 RSS FETCH PERFORMANCE (Last 24 Hours)")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Fetch cycles in last 24 hours
        cursor.execute('''
            SELECT 
                COUNT(*) as cycles,
                AVG(duration_seconds) as avg_duration,
                SUM(new_articles_found) as total_new,
                SUM(total_articles_fetched) as total_fetched,
                SUM(failed_sources) as total_failed
            FROM fetch_cycles
            WHERE started_at > datetime('now', '-1 day')
        ''')
        
        stats = cursor.fetchone()
        
        if stats['cycles'] > 0:
            print(f"Fetch Cycles: {stats['cycles']}")
            print(f"Avg Duration: {stats['avg_duration']:.1f}s")
            print(f"New Articles: {stats['total_new']:,}")
            print(f"Total Fetched: {stats['total_fetched']:,}")
            print(f"Failed Sources: {stats['total_failed']}")
            
            # Expected cycles (every 10 minutes = 144/day)
            expected_cycles = 144
            efficiency = (stats['cycles'] / expected_cycles * 100) if expected_cycles > 0 else 0
            print(f"Uptime: {efficiency:.1f}% ({stats['cycles']}/144 expected cycles)")
        else:
            print("❌ No fetch cycles in last 24 hours")
    
    def section_article_stats(self):
        """Article statistics"""
        print("\n📰 ARTICLE STATISTICS")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Total articles
        cursor.execute('SELECT COUNT(*) FROM articles')
        total = cursor.fetchone()[0]
        
        # Added today
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE fetched_at > datetime('now', '-1 day')
        ''')
        added_today = cursor.fetchone()[0]
        
        # Added this week
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE fetched_at > datetime('now', '-7 days')
        ''')
        added_week = cursor.fetchone()[0]
        
        print(f"Total Articles in Database: {total:,}")
        print(f"Added Today: {added_today:,}")
        print(f"Added This Week: {added_week:,}")
        print(f"Daily Average (7 days): {added_week / 7:.0f}")
    
    def section_publishing_stats(self):
        """Publishing statistics"""
        print("\n📢 PUBLISHING STATISTICS")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Published articles
        cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
        published = cursor.fetchone()[0]
        
        # Published today
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-1 day')
        ''')
        published_today = cursor.fetchone()[0]
        
        # Published this week
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-7 days')
        ''')
        published_week = cursor.fetchone()[0]
        
        # Total articles
        cursor.execute('SELECT COUNT(*) FROM articles')
        total = cursor.fetchone()[0]
        
        publish_rate = (published / total * 100) if total > 0 else 0
        
        print(f"Total Published: {published:,} ({publish_rate:.1f}% of all articles)")
        print(f"Published Today: {published_today}")
        print(f"Published This Week: {published_week}")
        print(f"Daily Average (7 days): {published_week / 7:.0f}")
        
        # Average score
        cursor.execute('''
            SELECT AVG(ai_final_score) FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-1 day')
        ''')
        avg_score = cursor.fetchone()[0]
        
        if avg_score:
            print(f"Average Score (today): {avg_score:.1f}")
    
    def section_category_breakdown(self):
        """Category breakdown"""
        print("\n📂 CATEGORY BREAKDOWN (Published Today)")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT category, COUNT(*) as count
            FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-1 day')
            GROUP BY category
            ORDER BY count DESC
        ''')
        
        categories = cursor.fetchall()
        
        if categories:
            for cat in categories:
                print(f"  {cat['category']}: {cat['count']}")
        else:
            print("  No published articles today")
    
    def section_top_sources(self):
        """Top performing sources"""
        print("\n🏆 TOP 10 SOURCES (Published Today)")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT source, COUNT(*) as count, AVG(ai_final_score) as avg_score
            FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-1 day')
            GROUP BY source
            ORDER BY count DESC
            LIMIT 10
        ''')
        
        sources = cursor.fetchall()
        
        if sources:
            for i, source in enumerate(sources, 1):
                print(f"  {i}. {source['source']}: {source['count']} articles (avg score: {source['avg_score']:.1f})")
        else:
            print("  No published articles today")
    
    def section_image_stats(self):
        """Image statistics"""
        print("\n🖼️  IMAGE STATISTICS")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Overall
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) as with_images
            FROM articles
            WHERE published = TRUE
        ''')
        
        stats = cursor.fetchone()
        
        if stats['total'] > 0:
            coverage = (stats['with_images'] / stats['total'] * 100)
            print(f"Overall Coverage: {stats['with_images']:,}/{stats['total']:,} ({coverage:.1f}%)")
        
        # By extraction method
        cursor.execute('''
            SELECT image_extraction_method, COUNT(*) as count
            FROM articles
            WHERE published = TRUE AND image_url IS NOT NULL
            GROUP BY image_extraction_method
            ORDER BY count DESC
        ''')
        
        methods = cursor.fetchall()
        
        if methods:
            print("\nExtraction Methods:")
            for method in methods:
                print(f"  {method['image_extraction_method']}: {method['count']}")
    
    def section_source_health(self):
        """Source health report"""
        print("\n🏥 SOURCE HEALTH")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Sources with failures
        cursor.execute('''
            SELECT COUNT(*) FROM source_stats
            WHERE consecutive_failures >= 5
        ''')
        failing = cursor.fetchone()[0]
        
        # Total sources
        cursor.execute('SELECT COUNT(*) FROM source_stats')
        total_sources = cursor.fetchone()[0]
        
        healthy = total_sources - failing
        health_rate = (healthy / total_sources * 100) if total_sources > 0 else 0
        
        print(f"Total Sources: {total_sources}")
        print(f"Healthy Sources: {healthy} ({health_rate:.1f}%)")
        print(f"Failing Sources: {failing}")
        
        # Most problematic sources
        if failing > 0:
            cursor.execute('''
                SELECT source, consecutive_failures, last_error
                FROM source_stats
                WHERE consecutive_failures >= 5
                ORDER BY consecutive_failures DESC
                LIMIT 5
            ''')
            
            problem_sources = cursor.fetchall()
            
            print("\nMost Problematic Sources:")
            for source in problem_sources:
                print(f"  • {source['source']}: {source['consecutive_failures']} failures")
                if source['last_error']:
                    error_short = source['last_error'][:60]
                    print(f"    └─ {error_short}...")
    
    def section_ai_performance(self):
        """AI processing performance"""
        print("\n🤖 AI PROCESSING PERFORMANCE")
        print("-" * 60)
        
        cursor = self.conn.cursor()
        
        # Processed today
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE ai_processed = TRUE
            AND fetched_at > datetime('now', '-1 day')
        ''')
        processed_today = cursor.fetchone()[0]
        
        # Pending
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE ai_processed = FALSE
        ''')
        pending = cursor.fetchone()[0]
        
        # Rejected today (processed but not published)
        cursor.execute('''
            SELECT COUNT(*) FROM articles
            WHERE ai_processed = TRUE
            AND published = FALSE
            AND fetched_at > datetime('now', '-1 day')
        ''')
        rejected_today = cursor.fetchone()[0]
        
        print(f"Processed Today: {processed_today:,}")
        print(f"Pending Processing: {pending:,}")
        print(f"Rejected Today: {rejected_today:,}")
        
        if processed_today > 0:
            approval_rate = ((processed_today - rejected_today) / processed_today * 100)
            print(f"Approval Rate: {approval_rate:.1f}%")
        
        # Score distribution
        cursor.execute('''
            SELECT 
                COUNT(CASE WHEN ai_final_score >= 80 THEN 1 END) as score_80_plus,
                COUNT(CASE WHEN ai_final_score >= 70 THEN 1 END) as score_70_plus,
                COUNT(CASE WHEN ai_final_score >= 60 THEN 1 END) as score_60_plus
            FROM articles
            WHERE published = TRUE
            AND published_at > datetime('now', '-1 day')
        ''')
        
        scores = cursor.fetchone()
        
        if scores:
            print(f"\nScore Distribution (Published Today):")
            print(f"  80+: {scores['score_80_plus']}")
            print(f"  70-79: {scores['score_70_plus'] - scores['score_80_plus']}")
            print(f"  60-69: {scores['score_60_plus'] - scores['score_70_plus']}")

if __name__ == '__main__':
    reporter = DailyReporter()
    reporter.generate_report()


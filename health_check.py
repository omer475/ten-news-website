"""
TEN NEWS - Health Check Script
Monitor system health and alert on issues
"""

import sqlite3
from datetime import datetime, timedelta
import json

class HealthChecker:
    def __init__(self, db_path='ten_news.db'):
        self.db_path = db_path
        self.issues = []
        self.warnings = []
    
    def check_all(self):
        """Run all health checks"""
        print("🏥 TEN NEWS - HEALTH CHECK")
        print("=" * 60)
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        self.check_database_connection()
        self.check_recent_fetches()
        self.check_recent_processing()
        self.check_source_failures()
        self.check_article_counts()
        self.check_image_coverage()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 HEALTH SUMMARY")
        print("=" * 60)
        
        if not self.issues and not self.warnings:
            print("✅ ALL SYSTEMS HEALTHY")
            return True
        else:
            if self.warnings:
                print(f"\n⚠️  {len(self.warnings)} WARNING(S):")
                for warning in self.warnings:
                    print(f"   • {warning}")
            
            if self.issues:
                print(f"\n❌ {len(self.issues)} CRITICAL ISSUE(S):")
                for issue in self.issues:
                    print(f"   • {issue}")
                return False
            
            return True
    
    def check_database_connection(self):
        """Test database connectivity"""
        print("\n🗄️  Database Connection...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM articles')
            count = cursor.fetchone()[0]
            conn.close()
            print(f"   ✅ Connected ({count} total articles)")
        except Exception as e:
            self.issues.append(f"Database connection failed: {e}")
            print(f"   ❌ FAILED: {e}")
    
    def check_recent_fetches(self):
        """Check if RSS fetches are happening"""
        print("\n📡 Recent RSS Fetches...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT started_at, status, duration_seconds, 
                       new_articles_found, total_articles_fetched
                FROM fetch_cycles
                ORDER BY started_at DESC
                LIMIT 1
            ''')
            
            last_fetch = cursor.fetchone()
            conn.close()
            
            if not last_fetch:
                self.issues.append("No fetch cycles found")
                print("   ❌ No fetch cycles in database")
                return
            
            last_time = datetime.fromisoformat(last_fetch[0])
            age_minutes = (datetime.now() - last_time).total_seconds() / 60
            
            print(f"   Last fetch: {age_minutes:.1f} minutes ago")
            print(f"   Status: {last_fetch[1]}")
            print(f"   Duration: {last_fetch[2]:.1f}s")
            print(f"   New articles: {last_fetch[3]}")
            
            # Alert if no fetch in 20 minutes (should be every 10 min)
            if age_minutes > 20:
                self.issues.append(f"No fetch in {age_minutes:.0f} minutes (expected every 10 min)")
                print(f"   ❌ STALE: No fetch in {age_minutes:.0f} minutes")
            elif age_minutes > 15:
                self.warnings.append(f"Fetch slightly delayed ({age_minutes:.0f} min)")
                print(f"   ⚠️  Slightly delayed")
            else:
                print("   ✅ Recent activity")
                
        except Exception as e:
            self.issues.append(f"Cannot check fetch cycles: {e}")
            print(f"   ❌ ERROR: {e}")
    
    def check_recent_processing(self):
        """Check if AI processing is happening"""
        print("\n🤖 Recent AI Processing...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check recent AI processing
            cursor.execute('''
                SELECT COUNT(*) FROM articles
                WHERE ai_processed = TRUE
                AND fetched_at > datetime('now', '-1 hour')
            ''')
            processed_last_hour = cursor.fetchone()[0]
            
            # Check pending articles
            cursor.execute('''
                SELECT COUNT(*) FROM articles
                WHERE ai_processed = FALSE
            ''')
            pending = cursor.fetchone()[0]
            
            conn.close()
            
            print(f"   Processed (last hour): {processed_last_hour}")
            print(f"   Pending: {pending}")
            
            if pending > 1000:
                self.warnings.append(f"Large backlog of {pending} unprocessed articles")
                print(f"   ⚠️  Large backlog")
            elif pending > 100:
                print(f"   ℹ️  Moderate backlog")
            else:
                print("   ✅ Normal workload")
                
        except Exception as e:
            self.issues.append(f"Cannot check AI processing: {e}")
            print(f"   ❌ ERROR: {e}")
    
    def check_source_failures(self):
        """Check for sources with consecutive failures"""
        print("\n📰 Source Health...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT source, consecutive_failures, last_error
                FROM source_stats
                WHERE consecutive_failures >= 5
                ORDER BY consecutive_failures DESC
            ''')
            
            failing_sources = cursor.fetchall()
            conn.close()
            
            if failing_sources:
                self.warnings.append(f"{len(failing_sources)} sources failing consistently")
                print(f"   ⚠️  {len(failing_sources)} sources with 5+ consecutive failures:")
                for source, failures, error in failing_sources[:5]:
                    print(f"      • {source}: {failures} failures")
                    if len(failing_sources) > 5:
                        print(f"      ... and {len(failing_sources) - 5} more")
            else:
                print("   ✅ All sources healthy")
                
        except Exception as e:
            self.warnings.append(f"Cannot check source failures: {e}")
            print(f"   ⚠️  ERROR: {e}")
    
    def check_article_counts(self):
        """Check article counts and publishing rate"""
        print("\n📊 Article Statistics...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Total articles
            cursor.execute('SELECT COUNT(*) FROM articles')
            total = cursor.fetchone()[0]
            
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
            
            conn.close()
            
            publish_rate = (published / total * 100) if total > 0 else 0
            
            print(f"   Total articles: {total:,}")
            print(f"   Published: {published:,} ({publish_rate:.1f}%)")
            print(f"   Published today: {published_today}")
            
            if published_today == 0 and total > 0:
                self.warnings.append("No articles published today")
                print("   ⚠️  No articles published today")
            elif published_today < 100:
                print("   ℹ️  Low daily volume")
            else:
                print("   ✅ Good daily volume")
                
        except Exception as e:
            self.issues.append(f"Cannot check article counts: {e}")
            print(f"   ❌ ERROR: {e}")
    
    def check_image_coverage(self):
        """Check percentage of articles with images"""
        print("\n🖼️  Image Coverage...")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) FROM articles
                WHERE published = TRUE AND image_url IS NOT NULL
            ''')
            with_images = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
            total_published = cursor.fetchone()[0]
            
            conn.close()
            
            if total_published > 0:
                coverage = (with_images / total_published * 100)
                print(f"   Images: {with_images:,}/{total_published:,} ({coverage:.1f}%)")
                
                if coverage < 80:
                    self.warnings.append(f"Low image coverage ({coverage:.0f}%)")
                    print(f"   ⚠️  Low coverage")
                elif coverage < 90:
                    print(f"   ℹ️  Moderate coverage")
                else:
                    print(f"   ✅ Good coverage")
            else:
                print("   ℹ️  No published articles yet")
                
        except Exception as e:
            self.warnings.append(f"Cannot check image coverage: {e}")
            print(f"   ⚠️  ERROR: {e}")

if __name__ == '__main__':
    checker = HealthChecker()
    healthy = checker.check_all()
    
    exit(0 if healthy else 1)


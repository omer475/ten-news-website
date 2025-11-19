#!/usr/bin/env python3
"""
TEN NEWS - LIVE CONTINUOUS SYSTEM
Runs RSS feeds every 10 minutes and publishes to Supabase
"""

import os
import sys
import time
import signal
import threading
from datetime import datetime
from typing import List, Dict

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  python-dotenv not available, using system environment variables")

# Import modules after setting environment variables
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step2_scrapingbee_full_article_fetching import ScrapingBeeArticleFetcher, FetcherConfig
from step3_gemini_component_selection import GeminiComponentSelector, ComponentConfig
from step4_perplexity_dynamic_context_search import PerplexityContextSearcher, PerplexityConfig
from step5_claude_final_writing_formatting import ClaudeFinalWriter, WriterConfig
from step6_claude_component_generation import ClaudeComponentWriter, ComponentWriterConfig
from supabase_storage import save_articles_to_supabase

class LiveNewsSystem:
    def __init__(self):
        self.running = True
        self.cycle_count = 0
        self.total_articles_published = 0
        
        # Initialize AI components
        self.scrapingbee_fetcher = ScrapingBeeArticleFetcher(
            api_key=os.getenv('SCRAPINGBEE_API_KEY'),
            config=FetcherConfig(parallel_workers=5)
        )
        
        self.component_selector = GeminiComponentSelector(
            api_key=os.getenv('GOOGLE_API_KEY'),
            config=ComponentConfig()
        )
        
        self.context_searcher = PerplexityContextSearcher(
            api_key=os.getenv('PERPLEXITY_API_KEY'),
            config=PerplexityConfig()
        )
        
        self.dual_language_writer = ClaudeFinalWriter(
            api_key=os.getenv('ANTHROPIC_API_KEY'),
            config=WriterConfig()
        )
        
        self.component_writer = ClaudeComponentWriter(
            api_key=os.getenv('ANTHROPIC_API_KEY'),
            config=ComponentWriterConfig()
        )
        
        print("🚀 TEN NEWS LIVE SYSTEM INITIALIZED")
        print("=" * 50)
        print("✅ All AI components loaded")
        print("✅ Supabase connection configured")
        print("✅ RSS fetcher ready")
        print("=" * 50)
    
    def fetch_new_rss_articles(self):
        """Fetch new RSS articles"""
        print(f"\n📰 [{datetime.now().strftime('%H:%M:%S')}] FETCHING NEW RSS ARTICLES")
        print("-" * 40)
        
        try:
            from rss_fetcher import OptimizedRSSFetcher
            
            fetcher = OptimizedRSSFetcher()
            results = fetcher._parallel_fetch_all_sources()
            
            print(f"✅ RSS Fetch Complete:")
            print(f"   📊 Total articles found: {results['total_articles']}")
            print(f"   🆕 New articles: {results['new_articles']}")
            print(f"   📰 Sources fetched: {results['sources_fetched']}")
            print(f"   ❌ Failed sources: {results['failed_sources']}")
            
            return results['new_articles']
            
        except Exception as e:
            print(f"❌ RSS fetch failed: {e}")
            return 0
    
    def get_new_unread_articles(self, start_time: str, expected_count: int) -> List[Dict]:
        """Get ONLY the new articles from the current RSS fetch cycle"""
        try:
            import sqlite3
            conn = sqlite3.connect('ten_news.db')
            cursor = conn.cursor()
            
            # Get ONLY articles fetched after the cycle start time - limit to expected count
            cursor.execute('''
                SELECT title, source, description, url, fetched_at, id
                FROM articles 
                WHERE published = 0 
                AND fetched_at > ?
                ORDER BY fetched_at DESC
                LIMIT ?
            ''', (start_time, expected_count))
            
            articles = []
            article_ids = []
            for row in cursor.fetchall():
                articles.append({
                    'title': row[0],
                    'source': row[1], 
                    'text': row[2] or '',
                    'url': row[3],
                    'fetched_at': row[4],
                    'id': row[5]
                })
                article_ids.append(row[5])
            
            # Mark these articles as "processing" to avoid double-processing
            if article_ids:
                placeholders = ','.join(['?' for _ in article_ids])
                cursor.execute(f'''
                    UPDATE articles 
                    SET published = -1 
                    WHERE id IN ({placeholders})
                ''', article_ids)
                conn.commit()
            
            conn.close()
            return articles
            
        except Exception as e:
            print(f"❌ Error loading new articles: {e}")
            return []
    
    def process_articles_pipeline(self, articles: List[Dict]) -> List[Dict]:
        """Process articles through the 5-step AI pipeline"""
        
        if not articles:
            return []
        
        print(f"\n🤖 PROCESSING {len(articles)} ARTICLES THROUGH AI PIPELINE")
        print("-" * 50)
        
        try:
            # Step 1: Gemini Scoring
            print("🔄 Step 1: Gemini scoring & filtering...")
            batch_results = score_news_articles_step1(articles, os.getenv('GOOGLE_API_KEY'))
            approved_articles = batch_results['approved']
            
            if not approved_articles:
                print("❌ No articles approved by Gemini")
                return []
            
            print(f"✅ {len(approved_articles)} articles approved")
            
            # Step 2: ScrapingBee Fetching
            print("🔄 Step 2: ScrapingBee full article fetching...")
            full_articles = self.scrapingbee_fetcher.fetch_batch_parallel(approved_articles)
            
            if not full_articles:
                print("❌ No articles fetched by ScrapingBee")
                return []
            
            print(f"✅ {len(full_articles)} articles fetched")
            
            # Step 3: Component Selection
            print("🔄 Step 3: Gemini component selection...")
            articles_with_components = self.component_selector.select_components_batch(full_articles)
            
            print(f"✅ {len(articles_with_components)} articles processed")
            
            # Step 4: Context Search (for components)
            print("🔄 Step 4: Perplexity context search...")
            articles_with_context = self.context_searcher.search_all_articles(articles_with_components)
            
            print(f"✅ {len(articles_with_context)} articles processed")
            
            # Step 5: Dual-Language Content Generation (from scraped article text)
            print("🔄 Step 5: Generating dual-language content from scraped articles...")
            articles_with_content = self.dual_language_writer.write_all_articles(articles_with_context)
            
            print(f"✅ {len(articles_with_content)} articles with dual-language content")
            
            # Step 6: Component Generation (timeline, details, graph from Perplexity context)
            print("🔄 Step 6: Generating components from web context...")
            final_articles = self.component_writer.write_all_articles(articles_with_content)
            
            print(f"✅ {len(final_articles)} final articles complete")
            
            return final_articles
            
        except Exception as e:
            print(f"❌ Pipeline processing failed: {e}")
            return []
    
    def publish_to_supabase(self, articles: List[Dict]) -> int:
        """Publish articles to Supabase"""
        if not articles:
            return 0
        
        print(f"\n🌍 PUBLISHING {len(articles)} ARTICLES TO SUPABASE")
        print("-" * 40)
        
        try:
            # Pass raw articles to supabase_storage.py - it handles all field mapping
            # Just track article IDs for local database update
            article_ids = []
            for article in articles:
                if 'id' in article:
                    article_ids.append(article['id'])
            
            # Publish to Supabase (supabase_storage.py does all mapping)
            success = save_articles_to_supabase(articles, source_part=1)
            success_count = len(articles) if success else 0
            
            # Mark articles as published in local database
            if success and article_ids:
                import sqlite3
                conn = sqlite3.connect('ten_news.db')
                cursor = conn.cursor()
                placeholders = ','.join(['?' for _ in article_ids])
                cursor.execute(f'''
                    UPDATE articles 
                    SET published = 1 
                    WHERE id IN ({placeholders})
                ''', article_ids)
                conn.commit()
                conn.close()
            
            print(f"✅ Publishing Complete:")
            print(f"   📤 Articles published: {success_count}")
            print(f"   🌍 Live on: https://tennews.ai")
            
            return success_count
            
        except Exception as e:
            print(f"❌ Publishing failed: {e}")
            return 0
    
    def run_cycle(self):
        """Run one complete cycle: RSS → Process → Publish"""
        self.cycle_count += 1
        
        cycle_start_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"\n{'='*60}")
        print(f"🔄 CYCLE #{self.cycle_count} - {cycle_start_time}")
        print(f"{'='*60}")
        
        try:
            # Step 1: Fetch new RSS articles
            new_articles_count = self.fetch_new_rss_articles()
            
            if new_articles_count == 0:
                print("⏭️ No new articles - skipping cycle")
                return
            
            # Step 2: Get ONLY the new articles from current RSS fetch
            new_articles = self.get_new_unread_articles(cycle_start_time, new_articles_count)
            
            if not new_articles:
                print("⏭️ No new articles from current RSS fetch - skipping cycle")
                return
            
            print(f"📊 Processing {len(new_articles)} NEW articles from current RSS fetch (expected: {new_articles_count})")
            
            # Step 3: Process through AI pipeline
            final_articles = self.process_articles_pipeline(new_articles)
            
            if not final_articles:
                print("⏭️ No articles processed - skipping cycle")
                return
            
            # Step 4: Publish to Supabase
            published_count = self.publish_to_supabase(final_articles)
            
            # Update totals
            self.total_articles_published += published_count
            
            # Cycle summary
            print(f"\n✅ CYCLE #{self.cycle_count} COMPLETE")
            print(f"   📰 RSS fetch: {new_articles_count} new articles")
            print(f"   📊 Processed: {len(new_articles)} articles")
            print(f"   ✍️ Finalized: {len(final_articles)} articles")
            print(f"      └─ Dual-language content (Step 5)")
            print(f"      └─ Components: timeline/details/graph (Step 6)")
            print(f"   🌍 Published: {published_count} articles")
            print(f"   📈 Total published: {self.total_articles_published} articles")
            
        except Exception as e:
            print(f"❌ Cycle #{self.cycle_count} failed: {e}")
    
    def run_continuous(self):
        """Run the system continuously every 10 minutes"""
        print(f"\n🚀 STARTING CONTINUOUS LIVE SYSTEM")
        print(f"⏰ Running every 10 minutes")
        print(f"🛑 Press Ctrl+C to stop")
        print(f"{'='*60}")
        
        while self.running:
            try:
                self.run_cycle()
                
                if self.running:
                    print(f"\n⏰ Waiting 10 minutes until next cycle...")
                    next_cycle_time = datetime.fromtimestamp(datetime.now().timestamp() + 600)
                    print(f"🕐 Next cycle at: {next_cycle_time.strftime('%H:%M:%S')}")
                    
                    # Wait 10 minutes (600 seconds)
                    for i in range(600):
                        if not self.running:
                            break
                        time.sleep(1)
                
            except KeyboardInterrupt:
                print(f"\n🛑 Stopping live system...")
                self.running = False
                break
            except Exception as e:
                print(f"❌ System error: {e}")
                print(f"⏰ Retrying in 5 minutes...")
                time.sleep(300)  # Wait 5 minutes before retry
        
        print(f"\n✅ LIVE SYSTEM STOPPED")
        print(f"📊 Total cycles completed: {self.cycle_count}")
        print(f"📈 Total articles published: {self.total_articles_published}")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    print(f"\n🛑 Received interrupt signal...")
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    
    # Create and run live system
    live_system = LiveNewsSystem()
    live_system.run_continuous()

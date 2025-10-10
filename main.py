"""
TEN NEWS LIVE - MAIN ORCHESTRATOR
Coordinates RSS fetching and AI filtering
Runs continuously with scheduled intervals
"""

import time
import threading
from datetime import datetime
import signal
import sys

from database import init_database
from rss_fetcher import RSSFetcher
from ai_filter import AINewsFilter
from config import (
    RSS_FETCH_INTERVAL_MINUTES,
    AI_FILTER_INTERVAL_MINUTES,
    RSS_MAX_WORKERS,
    AI_FILTER_BATCH_SIZE,
    DATABASE_PATH
)

# Global flag for graceful shutdown
running = True

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    global running
    print("\n\n⏸️  Shutting down gracefully...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

def rss_fetcher_loop():
    """Continuous RSS fetching loop"""
    fetcher = RSSFetcher(db_path=DATABASE_PATH, max_workers=RSS_MAX_WORKERS)
    
    while running:
        try:
            print(f"\n{'='*70}")
            print(f"🔄 RSS FETCH CYCLE")
            print(f"{'='*70}")
            fetcher.run_fetch_cycle()
            
            if running:
                print(f"⏰ Next RSS fetch in {RSS_FETCH_INTERVAL_MINUTES} minutes...")
                # Sleep in small intervals to allow for quick shutdown
                for _ in range(RSS_FETCH_INTERVAL_MINUTES * 60):
                    if not running:
                        break
                    time.sleep(1)
        except Exception as e:
            print(f"❌ RSS Fetcher error: {e}")
            time.sleep(60)  # Wait a minute before retrying

def ai_filter_loop():
    """Continuous AI filtering loop"""
    filter_engine = AINewsFilter(db_path=DATABASE_PATH)
    
    # Wait a bit before first run (let RSS fetcher get some articles first)
    if running:
        print(f"⏰ AI Filter will start in 2 minutes...")
        for _ in range(120):
            if not running:
                return
            time.sleep(1)
    
    while running:
        try:
            print(f"\n{'='*70}")
            print(f"🤖 AI FILTER CYCLE")
            print(f"{'='*70}")
            filter_engine.run_filter_cycle(batch_size=AI_FILTER_BATCH_SIZE)
            
            if running:
                print(f"⏰ Next AI filter in {AI_FILTER_INTERVAL_MINUTES} minutes...")
                # Sleep in small intervals to allow for quick shutdown
                for _ in range(AI_FILTER_INTERVAL_MINUTES * 60):
                    if not running:
                        break
                    time.sleep(1)
        except Exception as e:
            print(f"❌ AI Filter error: {e}")
            time.sleep(60)  # Wait a minute before retrying

def print_startup_banner():
    """Print startup information"""
    print("\n" + "="*70)
    print("🚀 TEN NEWS LIVE - RSS SYSTEM STARTING")
    print("="*70)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("📋 Configuration:")
    print(f"   RSS Fetch Interval: {RSS_FETCH_INTERVAL_MINUTES} minutes")
    print(f"   AI Filter Interval: {AI_FILTER_INTERVAL_MINUTES} minutes")
    print(f"   RSS Workers: {RSS_MAX_WORKERS}")
    print(f"   AI Batch Size: {AI_FILTER_BATCH_SIZE}")
    print(f"   Database: {DATABASE_PATH}")
    print()
    print("🎯 System Components:")
    print("   ✅ RSS Fetcher - Fetches from 200+ sources")
    print("   ✅ AI Filter - Claude Sonnet 4 scoring")
    print("   ✅ Database - SQLite storage")
    print()
    print("💡 Press Ctrl+C to stop")
    print("="*70 + "\n")

def main():
    """Main entry point"""
    global running
    
    # Print banner
    print_startup_banner()
    
    # Initialize database
    print("🗄️  Initializing database...")
    init_database(DATABASE_PATH)
    print()
    
    # Start both threads
    print("🚀 Starting RSS fetcher thread...")
    rss_thread = threading.Thread(target=rss_fetcher_loop, daemon=True)
    rss_thread.start()
    
    print("🚀 Starting AI filter thread...")
    ai_thread = threading.Thread(target=ai_filter_loop, daemon=True)
    ai_thread.start()
    
    print()
    print("✅ System is running!")
    print("="*70 + "\n")
    
    # Keep main thread alive
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    
    # Cleanup
    print("\n⏸️  Waiting for threads to finish...")
    rss_thread.join(timeout=5)
    ai_thread.join(timeout=5)
    
    print("✅ Shutdown complete!")
    sys.exit(0)

if __name__ == '__main__':
    main()


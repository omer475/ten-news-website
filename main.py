"""
TEN NEWS - MAIN ORCHESTRATOR
Runs both RSS Fetcher and AI Filter in parallel
"""

import threading
import logging
import sys
from rss_fetcher import OptimizedRSSFetcher
from ai_filter import AINewsFilter

def main():
    """Start both systems"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    
    logger.info("="*60)
    logger.info("🚀 TEN NEWS LIVE - RSS SYSTEM STARTING")
    logger.info("="*60)
    logger.info("")
    logger.info("📰 RSS Fetcher: Every 10 minutes (200+ sources)")
    logger.info("🤖 AI Filter: Every 5 minutes (scoring + timeline + details)")
    logger.info("")
    logger.info("Press Ctrl+C to stop")
    logger.info("="*60)
    logger.info("")
    
    # Initialize components
    try:
        fetcher = OptimizedRSSFetcher()
        ai_filter = AINewsFilter()
    except Exception as e:
        logger.error(f"❌ Failed to initialize: {e}")
        sys.exit(1)
    
    # Create threads
    fetcher_thread = threading.Thread(
        target=fetcher.run_forever,
        daemon=True,
        name="RSS-Fetcher"
    )
    
    ai_thread = threading.Thread(
        target=ai_filter.run_forever,
        daemon=True,
        name="AI-Filter"
    )
    
    # Start threads
    fetcher_thread.start()
    ai_thread.start()
    
    logger.info("✅ Both systems running!\n")
    
    # Keep main thread alive
    try:
        fetcher_thread.join()
        ai_thread.join()
    except KeyboardInterrupt:
        logger.info("\n🛑 Shutting down Ten News Live...")
        logger.info("👋 Goodbye!")

if __name__ == '__main__':
    main()


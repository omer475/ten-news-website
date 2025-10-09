#!/usr/bin/env python3
# TEN NEWS - RSS NEWS SCHEDULER
# Runs the RSS news generator continuously every 15 minutes

import schedule
import time
from datetime import datetime
from rss_news_generator import generate_rss_news

def job():
    """Run the news generation job"""
    try:
        print(f"\n{'='*60}")
        print(f"🕐 Starting scheduled run at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        generate_rss_news()
        
        print(f"\n{'='*60}")
        print(f"✅ Scheduled run completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"⏰ Next run in 15 minutes")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n❌ Error in scheduled run: {e}")
        import traceback
        traceback.print_exc()

# Run immediately on startup
print("🚀 TEN NEWS - RSS News Scheduler Starting...")
print(f"   Frequency: Every 15 minutes")
print(f"   Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# First run
job()

# Schedule to run every 15 minutes
schedule.every(15).minutes.do(job)

# Keep running
print("\n⏰ Scheduler active. Waiting for next run...")
while True:
    schedule.run_pending()
    time.sleep(60)  # Check every minute


#!/usr/bin/env python3
"""
Article Deduplication Module
=============================
Prevents processing duplicate articles by tracking processed URLs and using time-based filtering.

Configuration (use environment variables or defaults):
- RSS_FETCH_INTERVAL_MINUTES: 10 (default)
- TIME_FILTER_BUFFER_MINUTES: 5 (default)
- CLEANUP_RETENTION_DAYS: 7 (default)
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import os


# Configuration
RSS_FETCH_INTERVAL_MINUTES = int(os.getenv('RSS_FETCH_INTERVAL_MINUTES', '10'))
TIME_FILTER_BUFFER_MINUTES = int(os.getenv('TIME_FILTER_BUFFER_MINUTES', '5'))
CLEANUP_RETENTION_DAYS = int(os.getenv('CLEANUP_RETENTION_DAYS', '7'))


def is_article_processed(url: str, supabase_client) -> bool:
    """
    Check if an article URL has already been processed.
    
    Args:
        url: Article URL to check
        supabase_client: Supabase client instance
        
    Returns:
        True if article was already processed, False otherwise
    """
    try:
        result = supabase_client.table('processed_articles')\
            .select('article_url')\
            .eq('article_url', url)\
            .limit(1)\
            .execute()
        
        return len(result.data) > 0
        
    except Exception as e:
        print(f"⚠️  Database check failed for {url}: {e}")
        return False  # If DB fails, assume not processed (better to have duplicates than miss articles)


def mark_article_as_processed(article_data: Dict, supabase_client) -> bool:
    """
    Mark an article as processed in the database.
    
    Args:
        article_data: Dict with keys: url, source, published_date (optional), title
        supabase_client: Supabase client instance
        
    Returns:
        True if successfully marked, False otherwise
    """
    try:
        record = {
            'article_url': article_data.get('url'),
            'source': article_data.get('source', 'Unknown'),
            'title': article_data.get('title', 'No title'),
            'published_date': article_data.get('published_date')
        }
        
        # Use upsert to handle duplicates gracefully
        supabase_client.table('processed_articles')\
            .upsert(record, on_conflict='article_url')\
            .execute()
        
        return True
        
    except Exception as e:
        print(f"⚠️  Failed to mark article as processed: {e}")
        return False


def filter_by_published_date(articles: List[Dict], minutes: int = 15) -> List[Dict]:
    """
    Filter articles to only include those published within the last N minutes.
    
    Args:
        articles: List of article dicts with 'published_date' field
        minutes: Time window in minutes (default: 15)
        
    Returns:
        Filtered list of articles
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    filtered = []
    
    for article in articles:
        published_date = article.get('published_date')
        
        # Keep articles with no date (can't filter them out safely)
        if not published_date:
            filtered.append(article)
            continue
        
        try:
            # Handle various date formats
            if isinstance(published_date, str):
                # Try ISO format
                try:
                    pub_dt = datetime.fromisoformat(published_date.replace('Z', '+00:00'))
                except:
                    # Try other common formats
                    try:
                        from dateutil import parser
                        pub_dt = parser.parse(published_date)
                    except ImportError:
                        # If dateutil not available, skip this article (keep it to be safe)
                        filtered.append(article)
                        continue
                    
                # Ensure timezone aware
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    
            elif isinstance(published_date, datetime):
                pub_dt = published_date
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            else:
                # Unknown format, keep it
                filtered.append(article)
                continue
            
            # Only keep if published within time window
            if pub_dt >= cutoff_time:
                filtered.append(article)
                
        except Exception as e:
            # If date parsing fails, keep the article (better safe than sorry)
            print(f"⚠️  Date parsing failed for {article.get('title', 'unknown')}: {e}")
            filtered.append(article)
    
    return filtered


def get_new_articles_only(
    articles: List[Dict], 
    supabase_client, 
    time_window: int = 15
) -> List[Dict]:
    """
    Main function to filter out already-processed articles.
    Uses hybrid approach: time-based filtering + database checking.
    
    Args:
        articles: List of article dicts with url, source, published_date, title
        supabase_client: Supabase client instance
        time_window: Time window in minutes (default: 15 = 10min interval + 5min buffer)
        
    Returns:
        List of only new, unprocessed articles
    """
    if not articles:
        return []
    
    print(f"🔍 Deduplication: Starting with {len(articles)} articles")
    
    # Step 1: Apply time-based filter (performance optimization)
    time_filtered = filter_by_published_date(articles, minutes=time_window)
    print(f"   ⏰ After time filter ({time_window}min): {len(time_filtered)} articles")
    
    # Step 2: Check database for each remaining article
    new_articles = []
    db_check_failed = False
    
    try:
        for article in time_filtered:
            url = article.get('url')
            if not url:
                continue
                
            if not is_article_processed(url, supabase_client):
                new_articles.append(article)
        
        print(f"   ✅ After database check: {len(new_articles)} NEW articles")
        
    except Exception as e:
        print(f"⚠️  Database check failed, falling back to time-only filtering: {e}")
        new_articles = time_filtered
        db_check_failed = True
    
    # Step 3: Return filtered articles
    if db_check_failed:
        print(f"   ⚠️  Returning {len(new_articles)} articles (time-filtered only, DB unavailable)")
    
    return new_articles


def cleanup_old_records(days: int = 7, supabase_client = None) -> int:
    """
    Delete processed_articles records older than specified days.
    Should be called once daily for database maintenance.
    
    Args:
        days: Number of days to retain (default: 7)
        supabase_client: Supabase client instance
        
    Returns:
        Number of records deleted
    """
    if supabase_client is None:
        print("⚠️  No Supabase client provided for cleanup")
        return 0
    
    try:
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        # Delete old records
        result = supabase_client.table('processed_articles')\
            .delete()\
            .lt('processed_at', cutoff_date)\
            .execute()
        
        deleted_count = len(result.data) if result.data else 0
        print(f"🧹 Cleanup: Deleted {deleted_count} records older than {days} days")
        
        return deleted_count
        
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        return 0


if __name__ == "__main__":
    # Test with sample data
    print("🧪 Testing Article Deduplication Module\n")
    
    # Sample articles
    test_articles = [
        {
            'url': 'https://example.com/article1',
            'title': 'Recent Article',
            'source': 'Test Source',
            'published_date': datetime.now(timezone.utc).isoformat()
        },
        {
            'url': 'https://example.com/article2',
            'title': 'Old Article',
            'source': 'Test Source',
            'published_date': (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        },
        {
            'url': 'https://example.com/article3',
            'title': 'Article with no date',
            'source': 'Test Source',
            'published_date': None
        }
    ]
    
    print(f"Input: {len(test_articles)} articles")
    
    # Test time filtering
    filtered = filter_by_published_date(test_articles, minutes=15)
    print(f"After time filter (15min): {len(filtered)} articles")
    print(f"  - Recent article: {'✅' if any(a['url'] == 'https://example.com/article1' for a in filtered) else '❌'}")
    print(f"  - Old article: {'❌' if not any(a['url'] == 'https://example.com/article2' for a in filtered) else '✅ (kept - should be filtered)'}")
    print(f"  - No date article: {'✅' if any(a['url'] == 'https://example.com/article3' for a in filtered) else '❌'}")
    
    print("\n✅ Module test complete!")
    print("\n📝 Note: Database functions require Supabase client for full testing")


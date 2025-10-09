# TEN NEWS - SUPABASE STORAGE HELPER
# Saves articles to Supabase PostgreSQL database

import os
import json
from datetime import datetime
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'your-supabase-url')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', 'your-supabase-service-key')

def get_supabase_client():
    """Initialize Supabase client"""
    if SUPABASE_URL == 'your-supabase-url' or SUPABASE_KEY == 'your-supabase-service-key':
        print("⚠️  Supabase not configured - skipping database storage")
        return None
    
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Supabase client error: {e}")
        return None

def save_articles_to_supabase(articles, source_part):
    """
    Save articles to Supabase database
    
    Args:
        articles: List of article dictionaries
        source_part: 1 for Breaking News, 2 for Global News
    """
    supabase = get_supabase_client()
    if not supabase:
        return False
    
    print(f"\n💾 Saving {len(articles)} articles to Supabase...")
    
    saved_count = 0
    skipped_count = 0
    error_count = 0
    
    for i, article in enumerate(articles, 1):
        try:
            # Prepare article data for database
            db_article = {
                'title': article.get('title', ''),
                'summary': article.get('summary', ''),
                'full_text': article.get('full_text', ''),
                'url': article.get('url', ''),
                'image_url': article.get('image', ''),
                'source': article.get('source', 'Unknown'),
                'source_part': source_part,
                'category': article.get('category', 'World News'),
                'emoji': article.get('emoji', '📰'),
                'final_score': float(article.get('final_score', 0)),
                'global_impact': float(article.get('scores', {}).get('global_impact', 0)),
                'scientific_significance': float(article.get('scores', {}).get('scientific_significance', 0)),
                'novelty': float(article.get('scores', {}).get('novelty', 0)),
                'credibility': float(article.get('scores', {}).get('credibility', 0)),
                'engagement': float(article.get('scores', {}).get('engagement', 0)),
                'details': json.dumps(article.get('details', [])),
                'timeline': json.dumps(article.get('timeline', [])),
                'citations': json.dumps(article.get('citations', [])),
                'published_at': article.get('publishedAt', datetime.now().isoformat()),
                'added_at': article.get('added_at', datetime.now().isoformat())
            }
            
            # Insert into database (upsert to handle duplicates)
            response = supabase.table('articles').upsert(
                db_article,
                on_conflict='url'  # Update if URL already exists
            ).execute()
            
            if response.data:
                saved_count += 1
                print(f"   [{i}/{len(articles)}] ✅ Saved: {article.get('title', '')[:60]}...")
            else:
                skipped_count += 1
                print(f"   [{i}/{len(articles)}] ⏭️  Skipped (duplicate): {article.get('title', '')[:60]}...")
                
        except Exception as e:
            error_count += 1
            print(f"   [{i}/{len(articles)}] ❌ Error: {str(e)[:60]}")
    
    print(f"\n📊 Supabase Storage Results:")
    print(f"   ✅ Saved: {saved_count}")
    print(f"   ⏭️  Skipped (duplicates): {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    
    return saved_count > 0

def get_latest_articles_from_supabase(limit=50):
    """
    Fetch latest articles from Supabase
    
    Args:
        limit: Number of articles to fetch (default 50)
    
    Returns:
        List of articles sorted by score
    """
    supabase = get_supabase_client()
    if not supabase:
        return []
    
    try:
        response = supabase.rpc('get_top_articles', {'limit_count': limit}).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"❌ Error fetching articles: {e}")
        return []

def cleanup_old_articles(days=30):
    """
    Delete articles older than specified days
    
    Args:
        days: Number of days to keep (default 30)
    """
    supabase = get_supabase_client()
    if not supabase:
        return False
    
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        response = supabase.table('articles').delete().lt('published_at', cutoff_date.isoformat()).execute()
        
        deleted_count = len(response.data) if response.data else 0
        print(f"🗑️  Deleted {deleted_count} articles older than {days} days")
        return True
    except Exception as e:
        print(f"❌ Cleanup error: {e}")
        return False

# Test function
if __name__ == "__main__":
    print("🧪 Testing Supabase connection...")
    
    supabase = get_supabase_client()
    if supabase:
        print("✅ Supabase client initialized successfully!")
        
        # Test query
        try:
            response = supabase.table('articles').select("count").execute()
            print(f"📊 Total articles in database: {len(response.data)}")
        except Exception as e:
            print(f"❌ Query error: {e}")
    else:
        print("❌ Supabase client initialization failed")


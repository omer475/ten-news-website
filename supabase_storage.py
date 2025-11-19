# TEN NEWS - SUPABASE STORAGE HELPER
# Saves articles to Supabase PostgreSQL database

import os
import json
from datetime import datetime
from supabase import create_client, Client

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, use system environment variables

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
            # Handle new live system format (detailed_text + summary_bullets)
            detailed_text = article.get('detailed_text', article.get('article', ''))
            summary_bullets_data = article.get('summary_bullets', [])
            
            # DEBUG: Check what we got
            if not detailed_text:
                print(f"  🔍 DEBUG [{i}/{len(articles)}]: No detailed_text found. Article keys: {list(article.keys())[:15]}")
            else:
                print(f"  ✅ DEBUG [{i}/{len(articles)}]: detailed_text length: {len(detailed_text)} chars, bullets: {len(summary_bullets_data)}")
            
            # Ensure summary_bullets is a list
            if not isinstance(summary_bullets_data, list):
                summary_bullets_data = []
            
            # DEBUG: Check components field
            components_data = article.get('components', [])
            print(f"  🔍 DEBUG [{i}/{len(articles)}]: components in article: {components_data}")
            
            # Normalize details into newline-joined string (ensure elements are strings)
            raw_details = article.get('details', []) or []
            normalized_details = []
            for item in raw_details:
                if isinstance(item, str):
                    normalized_details.append(item)
                elif isinstance(item, dict):
                    # Common shapes: {label, value} or {date, event}
                    if 'label' in item or 'value' in item:
                        label = str(item.get('label', '')).strip()
                        value = str(item.get('value', '')).strip()
                        normalized_details.append(f"{label}: {value}".strip(': '))
                    else:
                        normalized_details.append(json.dumps(item, ensure_ascii=False))
                else:
                    normalized_details.append(str(item))

            # Prepare article data for database (full mapping)
            db_article = {
                # Core
                'url': article.get('url', ''),
                'guid': article.get('guid', ''),
                'source': article.get('source', 'Unknown'),
                'title': article.get('title_news', article.get('title', '')),  # Use title_news if available
                'description': article.get('description', ''),
                'content': article.get('content', article.get('text', '')),
                'image_url': article.get('image_url', ''),
                'author': article.get('author', ''),
                'published_date': article.get('published_date') or article.get('published_time'),

                # AI processing / scoring
                'ai_processed': article.get('ai_processed', True),
                'ai_score_raw': article.get('ai_score_raw'),
                'ai_category': article.get('ai_category'),
                'ai_reasoning': article.get('ai_reasoning'),
                'ai_final_score': article.get('score', article.get('final_score', article.get('ai_final_score', 0))),

                # Publishing status
                'published': True,
                'published_at': article.get('publishedAt', article.get('published_at', datetime.now().isoformat())),
                'category': article.get('category', 'World News'),
                'emoji': article.get('emoji', '📰'),

                # Enhanced content - DEPRECATED FIELDS (use dual-language instead)
                # 'article': None,  # DEPRECATED - use content_news/content_b2
                # 'summary_bullets': None,  # DEPRECATED - use summary_bullets_news/summary_bullets_b2
                'timeline': json.dumps(article.get('timeline', [])),
                'details_section': '\n'.join(normalized_details),
                # JSONB fields: pass native structures
                'graph': article.get('graph', {}),
                'map': article.get('map', {}),
                'components': article.get('components', []),  # NEW: Component order array
                
                # DUAL-LANGUAGE CONTENT - PRIMARY FIELDS (use these instead of old article/summary_bullets)
                'title_news': article.get('title_news'),  # Advanced professional title
                'title_b2': article.get('title_b2'),  # B2 English title
                'summary_bullets_news': article.get('summary_bullets_news'),  # Advanced bullets (4 items)
                'summary_bullets_b2': article.get('summary_bullets_b2'),  # B2 bullets (4 items)
                'content_news': article.get('content_news'),  # Advanced full article (300-400 words)
                'content_b2': article.get('content_b2'),  # B2 full article (300-400 words)

                # Engagement / image metadata
                'view_count': article.get('view_count', 0),
                'image_extraction_method': article.get('image_extraction_method', ''),
            }
            
            # DEBUG: Verify dual-language fields made it to db_article
            print(f"  ✅ db_article has title_news: {bool(db_article.get('title_news'))}")
            print(f"  ✅ db_article has content_news: {bool(db_article.get('content_news'))} ({len(db_article.get('content_news') or '')} chars)")
            print(f"  ✅ db_article has summary_bullets_news: {bool(db_article.get('summary_bullets_news'))}")
            
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


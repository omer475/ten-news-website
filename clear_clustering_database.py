"""
Clear all clustering-related data from Supabase
Run this to start fresh from zero
"""

from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

def clear_database():
    """Delete all data from clustering tables"""
    
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        return
    
    supabase = create_client(url, key)
    
    print("\n🗑️  CLEARING CLUSTERING DATABASE")
    print("="*60)
    
    try:
        # Delete in correct order (respecting foreign keys)
        
        print("1. Deleting published_articles...")
        result = supabase.table('published_articles').delete().neq('id', 0).execute()
        print(f"   ✅ Deleted {len(result.data) if hasattr(result, 'data') else 'all'} published articles")
        
        print("2. Deleting article_updates_log...")
        result = supabase.table('article_updates_log').delete().neq('id', 0).execute()
        print(f"   ✅ Deleted {len(result.data) if hasattr(result, 'data') else 'all'} update logs")
        
        print("3. Deleting source_articles...")
        result = supabase.table('source_articles').delete().neq('id', 0).execute()
        print(f"   ✅ Deleted {len(result.data) if hasattr(result, 'data') else 'all'} source articles")
        
        print("4. Deleting clusters...")
        result = supabase.table('clusters').delete().neq('id', 0).execute()
        print(f"   ✅ Deleted {len(result.data) if hasattr(result, 'data') else 'all'} clusters")
        
        print("\n✅ Database cleared successfully!")
        print("="*60)
        print("\nYou can now run the system fresh from zero:")
        print("  ./RUN_LIVE_CLUSTERED_SYSTEM.sh")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTry running these SQL commands in Supabase SQL Editor:")
        print("  DELETE FROM published_articles;")
        print("  DELETE FROM article_updates_log;")
        print("  DELETE FROM source_articles;")
        print("  DELETE FROM clusters;")

if __name__ == '__main__':
    clear_database()


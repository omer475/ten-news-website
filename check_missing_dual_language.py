#!/usr/bin/env python3
"""
Diagnostic tool to check which articles are missing dual-language content in Supabase
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

def check_missing_dual_language():
    """Check which articles are missing dual-language fields"""
    
    print("🔍 CHECKING SUPABASE FOR MISSING DUAL-LANGUAGE CONTENT")
    print("=" * 60)
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get all recent articles (last 100)
        response = supabase.table('articles').select(
            'id, title, source, published_at, title_news, title_b2, content_news, content_b2'
        ).order('published_at', desc=True).limit(100).execute()
        
        articles = response.data
        
        if not articles:
            print("❌ No articles found in Supabase")
            return
        
        print(f"📊 Analyzing {len(articles)} recent articles...")
        print()
        
        # Track statistics
        total = len(articles)
        missing_all = 0
        missing_some = 0
        complete = 0
        
        missing_articles = []
        
        for article in articles:
            has_title_news = bool(article.get('title_news'))
            has_title_b2 = bool(article.get('title_b2'))
            has_content_news = bool(article.get('content_news'))
            has_content_b2 = bool(article.get('content_b2'))
            
            missing_count = sum([
                not has_title_news,
                not has_title_b2,
                not has_content_news,
                not has_content_b2
            ])
            
            if missing_count == 4:
                missing_all += 1
                missing_articles.append({
                    'title': article.get('title', 'No title')[:60],
                    'source': article.get('source', 'Unknown'),
                    'published_at': article.get('published_at', 'Unknown')[:19],
                    'missing': 'ALL fields'
                })
            elif missing_count > 0:
                missing_some += 1
                missing_fields = []
                if not has_title_news: missing_fields.append('title_news')
                if not has_title_b2: missing_fields.append('title_b2')
                if not has_content_news: missing_fields.append('content_news')
                if not has_content_b2: missing_fields.append('content_b2')
                
                missing_articles.append({
                    'title': article.get('title', 'No title')[:60],
                    'source': article.get('source', 'Unknown'),
                    'published_at': article.get('published_at', 'Unknown')[:19],
                    'missing': ', '.join(missing_fields)
                })
            else:
                complete += 1
        
        # Print statistics
        print("📈 STATISTICS")
        print("-" * 60)
        print(f"✅ Complete articles (all 4 fields):  {complete}/{total} ({complete/total*100:.1f}%)")
        print(f"⚠️  Partial articles (some missing):  {missing_some}/{total} ({missing_some/total*100:.1f}%)")
        print(f"❌ Empty articles (all missing):     {missing_all}/{total} ({missing_all/total*100:.1f}%)")
        print()
        
        # Show missing articles
        if missing_articles:
            print("📋 ARTICLES WITH MISSING FIELDS")
            print("-" * 60)
            for i, art in enumerate(missing_articles[:20], 1):  # Show first 20
                print(f"\n{i}. {art['title']}")
                print(f"   Source: {art['source']}")
                print(f"   Published: {art['published_at']}")
                print(f"   Missing: {art['missing']}")
            
            if len(missing_articles) > 20:
                print(f"\n... and {len(missing_articles) - 20} more")
        else:
            print("🎉 All articles have complete dual-language content!")
        
        print()
        print("=" * 60)
        print("✅ Diagnostic complete")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_missing_dual_language()


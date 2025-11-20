#!/usr/bin/env python3
"""
Test that Step 7 publishing will work
Simulates what the real system does
"""

import os
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

load_dotenv()

def test_publishing():
    """Test if we can insert a dummy article"""
    
    print("🧪 TESTING STEP 7: PUBLISHING TO SUPABASE\n")
    
    # Get Supabase connection
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return False
    
    supabase = create_client(url, key)
    
    # Create test data (exactly what Step 7 tries to insert)
    test_article = {
        'cluster_id': 99999,  # Dummy cluster ID
        'url': 'https://test.com/article',
        'source': 'Test Source',
        'category': 'Technology',
        'title_news': 'Test Article Title',
        'title_b2': 'Simple Test Title',
        'content_news': 'This is test content in advanced language.',
        'content_b2': 'This is test content in simple language.',
        'summary_bullets_news': ['Bullet 1', 'Bullet 2', 'Bullet 3'],
        'summary_bullets_b2': ['Simple bullet 1', 'Simple bullet 2', 'Simple bullet 3'],
        'timeline': None,
        'details': None,
        'graph': None,
        'components_order': [],
        'num_sources': 1,
        'published_at': datetime.now().isoformat()
    }
    
    print("📝 Test data prepared:")
    for key, value in test_article.items():
        if isinstance(value, str) and len(value) > 50:
            value = value[:50] + "..."
        print(f"   {key}: {value}")
    
    print("\n🔌 Attempting to insert into published_articles...")
    
    try:
        result = supabase.table('published_articles').insert(test_article).execute()
        
        if result.data:
            article_id = result.data[0]['id']
            print(f"\n✅ SUCCESS! Test article published with ID: {article_id}")
            
            # Clean up test data
            print("\n🧹 Cleaning up test data...")
            supabase.table('published_articles').delete().eq('id', article_id).execute()
            print("✅ Test data removed")
            
            print("\n" + "="*60)
            print("🎉 STEP 7 PUBLISHING IS READY!")
            print("="*60)
            print("\nYour system should work now. Run:")
            print("  ./RUN_LIVE_CLUSTERED_SYSTEM.sh")
            print("="*60)
            return True
        else:
            print("\n❌ Insert succeeded but no data returned")
            return False
            
    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ PUBLISHING FAILED!")
        print(f"\nError: {error_msg}\n")
        
        # Check for missing column errors
        if 'Could not find' in error_msg:
            import re
            match = re.search(r"'(\w+)' column", error_msg)
            if match:
                missing_col = match.group(1)
                print(f"🚨 MISSING COLUMN: {missing_col}\n")
                print("Fix: Run this SQL in Supabase:\n")
                print(f"ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS {missing_col} TEXT;")
                print("\nOr run the complete fix:")
                print("  - Open FIX_PUBLISHED_ARTICLES_TABLE.sql")
                print("  - Copy all SQL")
                print("  - Paste in Supabase SQL Editor")
                print("  - Click 'Run'")
        elif 'foreign key constraint' in error_msg.lower():
            print("⚠️  Foreign key constraint issue")
            print("This is expected - cluster_id 99999 doesn't exist")
            print("But the test shows the columns are there!")
            print("\n✅ COLUMNS ARE PRESENT - Your system should work!")
            return True
        else:
            print("❓ Unexpected error. Please check:")
            print("  1. Supabase connection")
            print("  2. Table permissions")
            print("  3. All columns exist")
        
        return False

if __name__ == "__main__":
    print("="*60)
    print("STEP 7 PUBLISHING TEST")
    print("="*60)
    print()
    
    success = test_publishing()
    
    if not success:
        print("\n⚠️  Fix the issues above, then run this test again.")
        exit(1)
    else:
        exit(0)


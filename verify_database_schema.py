#!/usr/bin/env python3
"""
Verify that published_articles table has all required columns
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

REQUIRED_COLUMNS = [
    'id',
    'cluster_id',
    'url',                      # ← Must add
    'source',                   # ← Must add
    'num_sources',              # ← Must add
    'category',
    'title_news',
    'title_b2',
    'content_news',
    'content_b2',
    'summary_bullets_news',
    'summary_bullets_b2',
    'timeline',
    'details',
    'graph',
    'components_order',         # ← Must add (code uses this, not 'components')
    'emoji',
    'version_number',
    'view_count',
    'created_at',
    'last_updated_at',
    'published_at'
]

def verify_schema():
    """Check if all required columns exist"""
    
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
        return False
    
    supabase = create_client(url, key)
    
    print("🔍 Checking published_articles table schema...\n")
    
    # Try to describe the table by querying it
    try:
        # Get one row to see what columns exist
        result = supabase.table('published_articles').select('*').limit(1).execute()
        
        if result.data and len(result.data) > 0:
            existing_columns = list(result.data[0].keys())
        else:
            # No data, try empty insert to get error
            try:
                supabase.table('published_articles').insert({}).execute()
            except Exception as e:
                error_msg = str(e)
                if 'Could not find' in error_msg:
                    # Extract missing column from error
                    import re
                    match = re.search(r"'(\w+)' column", error_msg)
                    if match:
                        missing = match.group(1)
                        print(f"❌ MISSING COLUMN: {missing}\n")
                        print(f"Run this SQL in Supabase:\n")
                        print(f"ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS {missing} TEXT;")
                        return False
                return False
        
        print("✅ Published Articles Table Columns:")
        for col in sorted(existing_columns):
            status = "✅" if col in REQUIRED_COLUMNS else "ℹ️ "
            print(f"   {status} {col}")
        
        print("\n📋 Required Columns Check:")
        missing = []
        for col in REQUIRED_COLUMNS:
            if col in existing_columns:
                print(f"   ✅ {col}")
            else:
                print(f"   ❌ {col} - MISSING!")
                missing.append(col)
        
        if missing:
            print(f"\n❌ Missing {len(missing)} required columns!\n")
            print("Run this SQL in Supabase SQL Editor:\n")
            print("=" * 60)
            
            for col in missing:
                # Determine column type
                if col in ['num_sources', 'cluster_id']:
                    col_type = "INTEGER"
                elif col in ['summary_bullets_news', 'summary_bullets_b2', 'timeline', 'details', 'components_order']:
                    col_type = "JSONB"
                elif col == 'graph':
                    col_type = "JSONB"
                elif col in ['published_at', 'created_at']:
                    col_type = "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
                else:
                    col_type = "TEXT"
                
                print(f"ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS {col} {col_type};")
            
            if 'cluster_id' in missing:
                print("\n-- Add foreign key for cluster_id")
                print("ALTER TABLE published_articles ADD CONSTRAINT fk_cluster ")
                print("  FOREIGN KEY (cluster_id) REFERENCES clusters(id);")
            
            print("=" * 60)
            return False
        else:
            print("\n✅ All required columns exist!")
            return True
            
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
        return False

if __name__ == "__main__":
    success = verify_schema()
    exit(0 if success else 1)


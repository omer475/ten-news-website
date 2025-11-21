#!/usr/bin/env python3
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

# Check source_articles count
result = supabase.table('source_articles').select('id', count='exact').execute()
print(f"📊 source_articles table: {result.count} articles")

# Check published_articles count
result2 = supabase.table('published_articles').select('id', count='exact').execute()
print(f"📊 published_articles table: {result2.count} articles")

# Check clusters count
result3 = supabase.table('clusters').select('id', count='exact').execute()
print(f"📊 clusters table: {result3.count} clusters")


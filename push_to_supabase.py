#!/usr/bin/env python3
"""
Push articles from local SQLite to Supabase
This makes articles appear on the live website (tennews.ai)
"""

import sqlite3
import os
from supabase import create_client
import json
from datetime import datetime

# Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

def push_to_supabase():
    """Push published articles from local DB to Supabase"""
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Supabase credentials not set!")
        print("   Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        return
    
    print("=" * 70)
    print("📤 PUSHING ARTICLES TO SUPABASE (tennews.ai)")
    print("=" * 70)
    
    # Connect to local database
    conn = sqlite3.connect('ten_news.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get published articles from last 24 hours
    cursor.execute('''
        SELECT * FROM articles
        WHERE published = TRUE
        ORDER BY published_at DESC
        LIMIT 100
    ''')
    
    articles = cursor.fetchall()
    conn.close()
    
    if not articles:
        print("⚠️  No published articles found")
        return
    
    print(f"📊 Found {len(articles)} published articles")
    
    # Connect to Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    pushed_count = 0
    skipped_count = 0
    
    for article in articles:
        try:
            # Check if article already exists in Supabase
            existing = supabase.table('articles').select('id').eq('url', article['url']).execute()
            
            if existing.data:
                skipped_count += 1
                continue
            
            # Prepare article data
            article_data = {
                'url': article['url'],
                'source': article['source'],
                'title': article['title'],
                'description': article['description'] or '',
                'content': article['content'] or '',
                'image_url': article['image_url'],
                'author': article['author'],
                'published_date': article['published_date'],
                'category': article['category'],
                'emoji': article.get('emoji', '📰'),
                'ai_final_score': article['ai_final_score'],
                'summary': article.get('summary', ''),
                'timeline': article.get('timeline'),
                'details_section': article.get('details_section'),
                'published_at': article['published_at'],
                'view_count': 0
            }
            
            # Push to Supabase
            supabase.table('articles').insert(article_data).execute()
            pushed_count += 1
            print(f"   ✅ {article['title'][:60]}...")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("=" * 70)
    print(f"✅ Pushed: {pushed_count} articles")
    print(f"⏭️  Skipped: {skipped_count} (already exist)")
    print("=" * 70)
    print(f"🌐 Articles now live on: https://tennews.ai")
    print("=" * 70)

if __name__ == '__main__':
    push_to_supabase()


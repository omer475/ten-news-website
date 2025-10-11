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
            
            # Prepare article data (matching Supabase schema)
            # Use bracket notation for SQLite Row objects
            article_data = {
                'url': article['url'],
                'guid': article['guid'] if 'guid' in article.keys() else None,
                'source': article['source'],
                'title': article['title'],
                'description': article['description'] if article['description'] else '',
                'content': article['content'] if article['content'] else '',
                'image_url': article['image_url'],
                'author': article['author'],
                'published_date': article['published_date'],
                'fetched_at': article['fetched_at'],
                
                # AI Processing
                'ai_processed': True,
                'ai_score_raw': article['ai_score_raw'] if 'ai_score_raw' in article.keys() else None,
                'ai_category': article['ai_category'] if 'ai_category' in article.keys() else article['category'],
                'ai_reasoning': article['ai_reasoning'] if 'ai_reasoning' in article.keys() else None,
                'ai_final_score': article['ai_final_score'],
                
                # Publishing
                'published': True,
                'published_at': article['published_at'],
                'category': article['category'],
                'emoji': article['emoji'] if article['emoji'] else '📰',
                
                # Enhanced content
                'timeline': article['timeline'],
                'details_section': article['details_section'],
                'summary': article['summary'] if article['summary'] else '',
                'timeline_generated': bool(article['timeline']),
                'details_generated': bool(article['details_section']),
                
                # Engagement
                'view_count': 0,
                'image_extraction_method': article['image_extraction_method'] if 'image_extraction_method' in article.keys() else None
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


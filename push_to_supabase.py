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
            article_data = {
                'url': article['url'],
                'guid': article.get('guid'),
                'source': article['source'],
                'title': article['title'],
                'description': article.get('description', ''),
                'content': article.get('content', ''),
                'image_url': article.get('image_url'),
                'author': article.get('author'),
                'published_date': article.get('published_date'),
                'fetched_at': article.get('fetched_at'),
                
                # AI Processing
                'ai_processed': True,
                'ai_score_raw': article.get('ai_score_raw'),
                'ai_category': article.get('ai_category'),
                'ai_reasoning': article.get('ai_reasoning'),
                'ai_final_score': article.get('ai_final_score'),
                
                # Publishing
                'published': True,
                'published_at': article.get('published_at'),
                'category': article.get('category'),
                'emoji': article.get('emoji', '📰'),
                
                # Enhanced content
                'timeline': article.get('timeline'),
                'details_section': article.get('details_section'),
                'summary': article.get('summary', ''),
                'timeline_generated': bool(article.get('timeline')),
                'details_generated': bool(article.get('details_section')),
                
                # Engagement
                'view_count': 0,
                'image_extraction_method': article.get('image_extraction_method')
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


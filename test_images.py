#!/usr/bin/env python3
"""
Quick test to check if images are in database and API
"""

import sqlite3
import json

print("=" * 70)
print("🔍 TEN NEWS - IMAGE VERIFICATION TEST")
print("=" * 70)

# Check database
print("\n📊 CHECKING DATABASE...")
print("-" * 70)

try:
    conn = sqlite3.connect('ten_news.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Count total published articles
    cursor.execute('SELECT COUNT(*) as count FROM articles WHERE published = TRUE')
    total = cursor.fetchone()['count']
    print(f"✅ Total published articles: {total}")
    
    # Count articles with images
    cursor.execute('SELECT COUNT(*) as count FROM articles WHERE published = TRUE AND image_url IS NOT NULL AND image_url != ""')
    with_images = cursor.fetchone()['count']
    percentage = (with_images / total * 100) if total > 0 else 0
    print(f"📸 Articles with images: {with_images} ({percentage:.1f}%)")
    
    # Show sample articles with images
    print(f"\n📰 Sample articles (first 5):")
    print("-" * 70)
    cursor.execute('''
        SELECT id, title, image_url, source, published_at
        FROM articles
        WHERE published = TRUE
        ORDER BY published_at DESC
        LIMIT 5
    ''')
    
    for i, row in enumerate(cursor.fetchall(), 1):
        has_image = bool(row['image_url'])
        image_status = "✅ HAS IMAGE" if has_image else "❌ NO IMAGE"
        print(f"\n{i}. {image_status}")
        print(f"   Title: {row['title'][:60]}...")
        print(f"   Source: {row['source']}")
        if has_image:
            print(f"   Image URL: {row['image_url'][:80]}...")
        print(f"   Published: {row['published_at']}")
    
    conn.close()
    
except Exception as e:
    print(f"❌ Database error: {e}")
    exit(1)

# Check API
print("\n" + "=" * 70)
print("🌐 CHECKING API...")
print("-" * 70)

try:
    import requests
    
    response = requests.get('http://localhost:5000/api/news?limit=3')
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ API Status: {response.status_code}")
        print(f"📊 Articles returned: {len(data.get('articles', []))}")
        
        print(f"\n📰 Sample API responses:")
        print("-" * 70)
        
        for i, article in enumerate(data.get('articles', [])[:3], 1):
            has_image = bool(article.get('urlToImage'))
            image_status = "✅ HAS IMAGE" if has_image else "❌ NO IMAGE"
            print(f"\n{i}. {image_status}")
            print(f"   Title: {article.get('title', '')[:60]}...")
            print(f"   urlToImage field: {article.get('urlToImage', 'MISSING')[:80] if has_image else 'NULL/EMPTY'}...")
            
    else:
        print(f"❌ API returned status code: {response.status_code}")
        
except requests.exceptions.ConnectionError:
    print("⚠️  API not running. Start with: python3 api.py")
except Exception as e:
    print(f"❌ API error: {e}")

print("\n" + "=" * 70)
print("🎯 SUMMARY")
print("=" * 70)
print("""
If images are in database but not showing on website:
1. Check browser console for image load errors
2. Try opening image URLs directly in browser
3. Check for CORS errors in Network tab
4. Verify frontend is fetching from correct API endpoint

If images are NOT in database:
1. Check RSS fetcher logs
2. Verify image extraction methods in rss_fetcher.py
3. Run: python3 main.py to fetch new articles
""")
print("=" * 70)


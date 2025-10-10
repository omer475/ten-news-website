#!/usr/bin/env python3
"""
Quick script to check if images are in the database
"""
import sqlite3
import os

DB_PATH = 'ten_news.db'

def check_images():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Total articles
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]
    print(f"\n📊 Total articles in database: {total}")
    
    # Published articles
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
    published = cursor.fetchone()[0]
    print(f"✅ Published articles: {published}")
    
    # Articles with images
    cursor.execute('SELECT COUNT(*) FROM articles WHERE image_url IS NOT NULL')
    with_images = cursor.fetchone()[0]
    print(f"🖼️  Articles with images: {with_images}")
    
    # Published with images
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE AND image_url IS NOT NULL')
    published_with_images = cursor.fetchone()[0]
    print(f"📰 Published with images: {published_with_images}")
    
    if published > 0:
        percentage = round((published_with_images / published) * 100, 1)
        print(f"📈 Image coverage: {percentage}%")
    
    # Show sample of published articles
    print(f"\n📋 Sample of published articles (first 5):")
    print("-" * 100)
    
    cursor.execute('''
        SELECT title, image_url, image_extraction_method, source
        FROM articles
        WHERE published = TRUE
        ORDER BY ai_final_score DESC
        LIMIT 5
    ''')
    
    for i, row in enumerate(cursor.fetchall(), 1):
        title, image_url, method, source = row
        has_image = "✅" if image_url else "❌"
        print(f"{i}. {has_image} [{source}] {title[:60]}...")
        if image_url:
            print(f"   🖼️  {image_url[:80]}...")
            print(f"   📍 Method: {method}")
        else:
            print(f"   ⚠️  NO IMAGE")
        print()
    
    # Image extraction method stats
    print("\n📊 Image extraction methods:")
    cursor.execute('''
        SELECT image_extraction_method, COUNT(*) as count
        FROM articles
        WHERE published = TRUE
        GROUP BY image_extraction_method
        ORDER BY count DESC
    ''')
    
    for row in cursor.fetchall():
        method, count = row
        print(f"  • {method or 'none'}: {count}")
    
    conn.close()

if __name__ == '__main__':
    check_images()


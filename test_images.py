#!/usr/bin/env python3
"""
Quick test to check if images are being extracted and stored
"""

import sqlite3
import json

db_path = 'ten_news.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=" * 70)
    print("🖼️  IMAGE EXTRACTION TEST")
    print("=" * 70)
    
    # Check total articles
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]
    print(f"\n📊 Total articles in database: {total}")
    
    # Check articles with images
    cursor.execute('SELECT COUNT(*) FROM articles WHERE image_url IS NOT NULL AND image_url != ""')
    with_images = cursor.fetchone()[0]
    print(f"🖼️  Articles with images: {with_images}")
    print(f"📈 Image percentage: {round(with_images/total*100, 1) if total > 0 else 0}%")
    
    # Check published articles with images
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE')
    published = cursor.fetchone()[0]
    print(f"\n✅ Published articles: {published}")
    
    cursor.execute('SELECT COUNT(*) FROM articles WHERE published = TRUE AND image_url IS NOT NULL AND image_url != ""')
    published_with_images = cursor.fetchone()[0]
    print(f"🖼️  Published with images: {published_with_images}")
    print(f"📈 Published image percentage: {round(published_with_images/published*100, 1) if published > 0 else 0}%")
    
    # Show some sample images
    print(f"\n{'=' * 70}")
    print("📸 SAMPLE IMAGES (First 5 published articles)")
    print("=" * 70)
    
    cursor.execute('''
        SELECT title, image_url, image_extraction_method, source
        FROM articles
        WHERE published = TRUE
        ORDER BY published_at DESC
        LIMIT 5
    ''')
    
    for i, row in enumerate(cursor.fetchall(), 1):
        title, image_url, method, source = row
        print(f"\n{i}. {title[:60]}...")
        print(f"   Source: {source}")
        print(f"   Method: {method}")
        if image_url:
            print(f"   ✅ Image: {image_url[:70]}...")
        else:
            print(f"   ❌ No image")
    
    # Check extraction methods
    print(f"\n{'=' * 70}")
    print("📊 IMAGE EXTRACTION METHODS")
    print("=" * 70)
    
    cursor.execute('''
        SELECT image_extraction_method, COUNT(*) as count
        FROM articles
        WHERE image_extraction_method IS NOT NULL AND published = TRUE
        GROUP BY image_extraction_method
        ORDER BY count DESC
    ''')
    
    for method, count in cursor.fetchall():
        print(f"   {method}: {count} articles")
    
    conn.close()
    
    print(f"\n{'=' * 70}")
    if published_with_images > 0:
        print("✅ SUCCESS: Images are being extracted!")
    else:
        print("⚠️  WARNING: No images found in published articles")
    print("=" * 70)
    print()
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nMake sure:")
    print("  1. The RSS fetcher has run at least once")
    print("  2. The database file 'ten_news.db' exists")
    print("  3. Some articles have been published")


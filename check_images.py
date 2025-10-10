#!/usr/bin/env python3
"""
Image Extraction Diagnostics
Checks if images are being extracted from RSS articles
"""

import sqlite3
import os

# Check which database exists
if os.path.exists('ten_news.db'):
    db_path = 'ten_news.db'
elif os.path.exists('news.db'):
    db_path = 'news.db'
else:
    print("❌ No database found! (looked for ten_news.db and news.db)")
    exit(1)

print(f"📊 Using database: {db_path}")
print()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check how many articles have images
cursor.execute('''
    SELECT 
        COUNT(*) as total_articles,
        COUNT(image_url) as articles_with_images,
        COUNT(CASE WHEN image_url IS NULL THEN 1 END) as articles_without_images,
        ROUND(COUNT(image_url) * 100.0 / COUNT(*), 2) as percentage_with_images
    FROM articles
''')

print("IMAGE EXTRACTION STATISTICS:")
print("=" * 60)
result = cursor.fetchone()
print(f"Total articles: {result[0]}")
print(f"Articles WITH images: {result[1]}")
print(f"Articles WITHOUT images: {result[2]}")
print(f"Success rate: {result[3]}%")
print()

if result[3] < 70:
    print("⚠️  WARNING: Image success rate is below 70%!")
    print("   This indicates image extraction may not be working properly.")
    print()
elif result[3] == 0:
    print("❌ CRITICAL: NO images are being extracted!")
    print("   The _extract_image_url() method may be missing or broken.")
    print()
else:
    print("✅ Image extraction is working!")
    print()

# Check breakdown by extraction method
cursor.execute('''
    SELECT 
        image_extraction_method,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM articles), 2) as percentage
    FROM articles
    WHERE image_extraction_method IS NOT NULL
    GROUP BY image_extraction_method
    ORDER BY count DESC
''')

print("EXTRACTION METHODS USED:")
print("=" * 60)
methods = cursor.fetchall()
if methods:
    for row in methods:
        print(f"{row[0]:20} {row[1]:6} articles ({row[2]}%)")
else:
    print("⚠️  No extraction method data found")
print()

# Show some sample articles with images
print("SAMPLE ARTICLES WITH IMAGES:")
print("=" * 60)
cursor.execute('''
    SELECT source, title, image_url, image_extraction_method
    FROM articles
    WHERE image_url IS NOT NULL
    LIMIT 5
''')
samples = cursor.fetchall()
if samples:
    for row in samples:
        print(f"Source: {row[0]}")
        print(f"Title: {row[1][:60]}...")
        print(f"Image: {row[2][:80]}...")
        print(f"Method: {row[3]}")
        print()
else:
    print("⚠️  No articles with images found")
    print()

print("SAMPLE ARTICLES WITHOUT IMAGES:")
print("=" * 60)
cursor.execute('''
    SELECT source, title, url
    FROM articles
    WHERE image_url IS NULL
    LIMIT 5
''')
samples = cursor.fetchall()
if samples:
    for row in samples:
        print(f"Source: {row[0]}")
        print(f"Title: {row[1][:60]}...")
        print(f"URL: {row[2][:80]}...")
        print()
else:
    print("✅ All articles have images!")
    print()

# Check published articles (what the website shows)
print("PUBLISHED ARTICLES IMAGE STATUS:")
print("=" * 60)
cursor.execute('''
    SELECT 
        COUNT(*) as total_published,
        COUNT(image_url) as published_with_images,
        ROUND(COUNT(image_url) * 100.0 / COUNT(*), 2) as percentage_with_images
    FROM articles
    WHERE published = TRUE
''')
pub_result = cursor.fetchone()
if pub_result[0] > 0:
    print(f"Total published articles: {pub_result[0]}")
    print(f"Published WITH images: {pub_result[1]}")
    print(f"Published image success rate: {pub_result[2]}%")
    print()
    
    if pub_result[2] == 0:
        print("❌ CRITICAL: No published articles have images!")
        print("   This is why you see no images on the website.")
    elif pub_result[2] < 70:
        print("⚠️  WARNING: Low image rate for published articles")
    else:
        print("✅ Published articles have good image coverage")
else:
    print("⚠️  No published articles found yet")
print()

conn.close()

print("=" * 60)
print("DIAGNOSIS COMPLETE")
print("=" * 60)


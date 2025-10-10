#!/usr/bin/env python3
"""
Image Enhancer - Backfill missing images for articles
Scrapes og:image from article pages for articles without images
"""

import sqlite3
import requests
from bs4 import BeautifulSoup
import logging
import time
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DB_PATH = 'ten_news.db'
BATCH_SIZE = 50  # Process 50 articles at a time

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(
        DB_PATH,
        timeout=30.0,
        isolation_level=None,
        check_same_thread=False
    )
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=30000')
    return conn

def extract_og_image(article_url):
    """
    Scrape article page for og:image
    Returns: (image_url, extraction_method) or (None, 'none')
    """
    try:
        response = requests.get(
            article_url,
            timeout=5,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
            verify=True
        )
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try og:image first (most common)
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            return og_image.get('content'), 'og_image'
        
        # Try twitter:image as fallback
        twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
        if twitter_image and twitter_image.get('content'):
            return twitter_image.get('content'), 'twitter_image'
        
        # Try first article image as last resort
        article_elem = soup.find('article')
        if article_elem:
            img = article_elem.find('img')
            if img and img.get('src'):
                return img.get('src'), 'article_img'
        
        # Try any img tag in body
        body = soup.find('body')
        if body:
            img = body.find('img')
            if img and img.get('src'):
                return img.get('src'), 'body_img'
        
        return None, 'none'
        
    except Exception as e:
        logging.debug(f"Failed to extract image: {e}")
        return None, 'error'

def enhance_images():
    """Enhance images for articles missing them"""
    logging.info("=" * 60)
    logging.info("🖼️  IMAGE ENHANCER STARTING")
    logging.info("=" * 60)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get articles without images
    cursor.execute('''
        SELECT id, url, title, source
        FROM articles
        WHERE image_url IS NULL OR image_url = ''
        ORDER BY 
            CASE WHEN published = TRUE THEN 0 ELSE 1 END,  -- Published articles first
            fetched_at DESC
        LIMIT ?
    ''', (BATCH_SIZE,))
    
    articles = cursor.fetchall()
    
    if not articles:
        logging.info("✅ No articles need image enhancement")
        conn.close()
        return
    
    logging.info(f"📊 Found {len(articles)} articles without images")
    logging.info(f"🔍 Scraping article pages for og:image tags...\n")
    
    success_count = 0
    failed_count = 0
    
    for idx, (article_id, url, title, source) in enumerate(articles, 1):
        logging.info(f"[{idx}/{len(articles)}] Processing: {source}")
        logging.info(f"   Title: {title[:60]}...")
        
        image_url, method = extract_og_image(url)
        
        if image_url:
            # Update database with new image
            cursor.execute('''
                UPDATE articles
                SET image_url = ?, image_extraction_method = ?
                WHERE id = ?
            ''', (image_url, method, article_id))
            conn.commit()
            
            logging.info(f"   ✅ Found image via {method}")
            logging.info(f"   🖼️  {image_url[:60]}...\n")
            success_count += 1
        else:
            logging.info(f"   ❌ No image found\n")
            failed_count += 1
        
        # Small delay to avoid overwhelming servers
        time.sleep(0.5)
    
    conn.close()
    
    logging.info("=" * 60)
    logging.info(f"✅ IMAGE ENHANCEMENT COMPLETE")
    logging.info(f"   Success: {success_count}/{len(articles)}")
    logging.info(f"   Failed: {failed_count}/{len(articles)}")
    logging.info(f"   Success rate: {(success_count/len(articles)*100):.1f}%")
    logging.info("=" * 60)

def get_image_stats():
    """Get current image statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            COUNT(image_url) as with_images,
            ROUND(COUNT(image_url) * 100.0 / COUNT(*), 2) as percentage
        FROM articles
    ''')
    
    total, with_images, percentage = cursor.fetchone()
    
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            COUNT(image_url) as with_images,
            ROUND(COUNT(image_url) * 100.0 / COUNT(*), 2) as percentage
        FROM articles
        WHERE published = TRUE
    ''')
    
    pub_total, pub_with_images, pub_percentage = cursor.fetchone()
    
    conn.close()
    
    return {
        'total_articles': total,
        'articles_with_images': with_images,
        'percentage': percentage,
        'published_total': pub_total,
        'published_with_images': pub_with_images,
        'published_percentage': pub_percentage
    }

if __name__ == '__main__':
    # Show before stats
    print("\n📊 BEFORE IMAGE ENHANCEMENT:")
    print("=" * 60)
    stats = get_image_stats()
    print(f"All articles: {stats['articles_with_images']}/{stats['total_articles']} have images ({stats['percentage']}%)")
    print(f"Published articles: {stats['published_with_images']}/{stats['published_total']} have images ({stats['published_percentage']}%)")
    print()
    
    # Run enhancement
    enhance_images()
    
    # Show after stats
    print("\n📊 AFTER IMAGE ENHANCEMENT:")
    print("=" * 60)
    stats = get_image_stats()
    print(f"All articles: {stats['articles_with_images']}/{stats['total_articles']} have images ({stats['percentage']}%)")
    print(f"Published articles: {stats['published_with_images']}/{stats['published_total']} have images ({stats['published_percentage']}%)")
    print()


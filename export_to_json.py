#!/usr/bin/env python3
"""Export published articles to JSON format for Next.js website"""

import sqlite3
import json
from datetime import datetime

def export_to_json():
    """Export articles from SQLite to JSON"""
    
    # Connect to database
    conn = sqlite3.connect('ten_news.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get published articles (score >= 60 for 0-100 personas scoring system)
    cursor.execute('''
        SELECT * FROM articles
        WHERE published = TRUE AND ai_final_score >= 60
        ORDER BY ai_final_score DESC, published_at DESC
        LIMIT 100
    ''')
    
    articles = cursor.fetchall()
    conn.close()
    
    if not articles:
        print("❌ No published articles found")
        return
    
    print(f"📰 Found {len(articles)} published articles")
    
    # Convert to website format
    formatted_articles = []
    
    for article in articles:
        article_dict = dict(article)
        
        # Parse timeline if it exists
        timeline_data = None
        if article_dict.get('timeline'):
            try:
                timeline_data = json.loads(article_dict['timeline'])
            except:
                pass
        
        formatted_article = {
            "title": article_dict['title'],
            "url": article_dict['url'],
            "source": article_dict['source'],
            "description": article_dict.get('description', ''),
            "content": article_dict.get('content', ''),
            "urlToImage": article_dict.get('image_url'),
            "author": article_dict.get('author'),
            "publishedAt": article_dict.get('published_at'),
            "category": article_dict.get('category', 'World'),
            "emoji": article_dict.get('emoji', '📰'),
            "final_score": article_dict.get('ai_final_score'),
            "summary": article_dict.get('summary', ''),
            "timeline": timeline_data,
            "details": article_dict.get('details_section', '').split('\n\n') if article_dict.get('details_section') else []
        }
        
        formatted_articles.append(formatted_article)
    
    # Create final JSON structure
    output = {
        "status": "ok",
        "totalResults": len(formatted_articles),
        "articles": formatted_articles,
        "generatedAt": datetime.now().isoformat(),
        "displayDate": datetime.now().strftime('%A, %B %d, %Y').upper(),
        "digest_date": datetime.now().strftime('%B %d, %Y'),
        "dailyGreeting": f"Breaking News - {len(formatted_articles)} Stories",
        "readingTime": f"{len(formatted_articles) * 2} minutes read"
    }
    
    # Save to file (in public/ directory so Vercel can serve it)
    today = datetime.now().strftime('%Y_%m_%d')
    filename = f'public/tennews_data_{today}.json'
    
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✅ Exported to: {filename}")
    print(f"📊 Articles: {len(formatted_articles)}")
    print(f"⭐ Avg score: {sum(a['final_score'] for a in formatted_articles) / len(formatted_articles):.1f}")
    print("\n🌐 Your website will automatically pick up this file!")
    print("   Just refresh tennews.ai")

if __name__ == '__main__':
    export_to_json()


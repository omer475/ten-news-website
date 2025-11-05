#!/usr/bin/env python3
"""
Publish processed articles to local SQLite database
"""

import sqlite3
import json
from datetime import datetime
from typing import List, Dict

def publish_to_local_database(articles: List[Dict]):
    """
    Publish articles directly to local SQLite database
    """
    print("📤 Publishing Articles to Local Database...")
    
    try:
        # Connect to local database
        conn = sqlite3.connect('ten_news.db')
        cursor = conn.cursor()
        
        published_count = 0
        
        for i, article in enumerate(articles, 1):
            try:
                # Prepare article data for database
                db_article = {
                    'title': article.get('title', ''),
                    'description': article.get('summary', {}).get('paragraph', ''),
                    'content': article.get('text', ''),
                    'url': article.get('url', ''),
                    'source': article.get('source', 'Unknown'),
                    'category': 'World News',
                    'ai_final_score': float(article.get('score', 0)),
                    'summary': article.get('summary', {}).get('paragraph', ''),
                    'timeline': json.dumps(article.get('timeline', [])),
                    'details_section': json.dumps(article.get('details', [])),
                    'published': True,
                    'published_at': datetime.now().isoformat(),
                    'published_date': datetime.now().isoformat(),
                    'view_count': 0,
                    'emoji': '📰'
                }
                
                # Insert article into database
                cursor.execute('''
                    INSERT INTO articles (
                        title, description, content, url, source, category,
                        ai_final_score, summary, timeline, details_section,
                        published, published_at, published_date, view_count, emoji
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    db_article['title'],
                    db_article['description'],
                    db_article['content'],
                    db_article['url'],
                    db_article['source'],
                    db_article['category'],
                    db_article['ai_final_score'],
                    db_article['summary'],
                    db_article['timeline'],
                    db_article['details_section'],
                    db_article['published'],
                    db_article['published_at'],
                    db_article['published_date'],
                    db_article['view_count'],
                    db_article['emoji']
                ))
                
                published_count += 1
                print(f"   [{i}/{len(articles)}] ✅ {article.get('title', '')[:50]}...")
                
            except Exception as e:
                print(f"   [{i}/{len(articles)}] ❌ Error: {e}")
                continue
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print(f"\n✅ Publishing Complete:")
        print(f"   📤 Articles published: {published_count}")
        print(f"   🌍 Live on: http://localhost:3000 (if API server running)")
        print(f"   📊 Database: ten_news.db")
        
        return published_count
        
    except Exception as e:
        print(f"❌ Publishing failed: {e}")
        return 0

def create_sample_articles():
    """Create sample articles for testing"""
    
    sample_articles = [
        {
            'title': 'European Central Bank raises interest rates to 4.5 percent',
            'summary': {'paragraph': 'The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.'},
            'text': 'The European Central Bank announced Thursday it is raising interest rates by 0.25 percentage points to 4.5 percent, marking the tenth consecutive increase since July 2023.',
            'url': 'https://www.reuters.com/markets/europe/ecb-rates-2024',
            'source': 'Reuters',
            'score': 850,
            'details': ['Previous rate: 4.25%', 'Inflation target: 2%', 'Current inflation: 5.3%'],
            'timeline': [
                {'date': 'Jul 27, 2023', 'event': 'ECB begins rate hike cycle with increase to 3.75 percent'},
                {'date': 'Mar 14, 2024', 'event': 'ECB holds rates steady for first time in eight months'}
            ]
        },
        {
            'title': 'UN Security Council votes on Gaza ceasefire resolution',
            'summary': {'paragraph': 'The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.'},
            'text': 'The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire in Gaza.',
            'url': 'https://apnews.com/un-gaza-vote',
            'source': 'Associated Press',
            'score': 920,
            'details': ['Casualties: 1,200+ Israelis', 'Displaced: 1.8M Palestinians', 'Resolution votes: 14-1'],
            'timeline': [
                {'date': 'Oct 7, 2023', 'event': 'Hamas attacks Israel, conflict begins'},
                {'date': 'Oct 15, 2023', 'event': 'UN Security Council first emergency meeting'}
            ]
        }
    ]
    
    return sample_articles

if __name__ == "__main__":
    print("🧪 Testing Local Database Publishing...")
    
    # Test with sample articles
    sample_articles = create_sample_articles()
    published_count = publish_to_local_database(sample_articles)
    
    if published_count > 0:
        print(f"\n🎉 Successfully published {published_count} articles to local database!")
        print("\nNext steps:")
        print("1. Start your API server: python3 api.py")
        print("2. Visit: http://localhost:3000")
        print("3. Your articles will be available via the API")
    else:
        print("\n❌ Failed to publish articles")

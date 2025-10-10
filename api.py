"""
TEN NEWS - REST API
Provides published articles to frontend
Compatible with existing frontend format
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

DB_PATH = 'ten_news.db'

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/news', methods=['GET'])
def get_news():
    """
    Get published articles
    Query params:
    - limit: number of articles (default 50)
    - offset: pagination offset (default 0)
    - category: filter by category (optional)
    """
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    category = request.args.get('category', None)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Build query
    query = '''
        SELECT 
            id, url, source, title, description, content,
            image_url, author, published_date, published_at,
            category, emoji, ai_final_score, summary,
            timeline, details_section, view_count
        FROM articles
        WHERE published = TRUE
    '''
    
    params = []
    
    if category:
        query += ' AND category = ?'
        params.append(category)
    
    query += ' ORDER BY ai_final_score DESC, published_at DESC'
    query += ' LIMIT ? OFFSET ?'
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Format articles for frontend (compatible with existing format)
    articles = []
    for row in rows:
        article = {
            'id': row['id'],
            'title': row['title'],
            'url': row['url'],
            'source': row['source'],
            'description': row['description'],
            'content': row['content'],
            'urlToImage': row['image_url'],  # Frontend expects 'urlToImage'
            'author': row['author'],
            'publishedAt': row['published_date'] or row['published_at'],
            'category': row['category'],
            'emoji': row['emoji'],
            'final_score': row['ai_final_score'],
            
            # Enhanced content
            'summary': row['summary'],
            'timeline': json.loads(row['timeline']) if row['timeline'] else None,
            'details': row['details_section'],
            
            # Stats
            'views': row['view_count']
        }
        articles.append(article)
    
    # Get total count
    count_query = 'SELECT COUNT(*) as total FROM articles WHERE published = TRUE'
    if category:
        count_query += ' AND category = ?'
        cursor.execute(count_query, [category])
    else:
        cursor.execute(count_query)
    
    total = cursor.fetchone()['total']
    
    conn.close()
    
    # Response format compatible with existing frontend
    return jsonify({
        'status': 'ok',
        'totalResults': total,
        'articles': articles,
        'generatedAt': datetime.now().isoformat(),
        'displayTimestamp': datetime.now().strftime('%A, %B %d, %Y at %H:%M %Z')
    })

@app.route('/api/news/<int:article_id>', methods=['GET'])
def get_article(article_id):
    """Get single article by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            id, url, source, title, description, content,
            image_url, author, published_date, published_at,
            category, emoji, ai_final_score, summary,
            timeline, details_section, view_count
        FROM articles
        WHERE id = ? AND published = TRUE
    ''', (article_id,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({'error': 'Article not found'}), 404
    
    # Increment view count
    cursor.execute('''
        UPDATE articles SET view_count = view_count + 1
        WHERE id = ?
    ''', (article_id,))
    conn.commit()
    
    article = {
        'id': row['id'],
        'title': row['title'],
        'url': row['url'],
        'source': row['source'],
        'description': row['description'],
        'content': row['content'],
        'urlToImage': row['image_url'],
        'author': row['author'],
        'publishedAt': row['published_date'] or row['published_at'],
        'category': row['category'],
        'emoji': row['emoji'],
        'final_score': row['ai_final_score'],
        'summary': row['summary'],
        'timeline': json.loads(row['timeline']) if row['timeline'] else None,
        'details': row['details_section'],
        'views': row['view_count'] + 1
    }
    
    conn.close()
    
    return jsonify(article)

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories with article counts"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT category, COUNT(*) as count
        FROM articles
        WHERE published = TRUE
        GROUP BY category
        ORDER BY count DESC
    ''')
    
    categories = [{'name': row['category'], 'count': row['count']} 
                  for row in cursor.fetchall()]
    
    conn.close()
    
    return jsonify(categories)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Published articles
    cursor.execute('SELECT COUNT(*) as count FROM articles WHERE published = TRUE')
    published_count = cursor.fetchone()['count']
    
    # Total fetched
    cursor.execute('SELECT COUNT(*) as count FROM articles')
    total_count = cursor.fetchone()['count']
    
    # Articles with images
    cursor.execute('SELECT COUNT(*) as count FROM articles WHERE published = TRUE AND image_url IS NOT NULL')
    with_images = cursor.fetchone()['count']
    
    # Latest fetch cycle
    cursor.execute('''
        SELECT * FROM fetch_cycles
        ORDER BY started_at DESC
        LIMIT 1
    ''')
    latest_cycle = cursor.fetchone()
    
    # Source stats
    cursor.execute('''
        SELECT 
            COUNT(*) as total_sources,
            SUM(consecutive_failures) as total_failures,
            AVG(average_articles_per_fetch) as avg_articles
        FROM source_stats
    ''')
    source_stats = cursor.fetchone()
    
    conn.close()
    
    stats = {
        'published_articles': published_count,
        'total_fetched': total_count,
        'articles_with_images': with_images,
        'image_percentage': round(with_images / published_count * 100, 1) if published_count > 0 else 0,
        'total_sources': source_stats['total_sources'],
        'avg_articles_per_source': round(source_stats['avg_articles'], 2) if source_stats['avg_articles'] else 0,
        'last_fetch': {
            'started_at': latest_cycle['started_at'] if latest_cycle else None,
            'duration': latest_cycle['duration_seconds'] if latest_cycle else None,
            'new_articles': latest_cycle['new_articles_found'] if latest_cycle else 0,
        } if latest_cycle else None
    }
    
    return jsonify(stats)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM articles')
        count = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'articles_count': count,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    # For development
    app.run(host='0.0.0.0', port=5000, debug=True)


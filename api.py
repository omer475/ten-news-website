"""
TEN NEWS LIVE - REST API
Flask API for frontend to fetch articles
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
from config import DATABASE_PATH, API_HOST, API_PORT, API_DEBUG

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """
    Get published articles
    
    Query params:
    - category: Filter by category (breaking, science, technology, etc.)
    - limit: Number of articles (default: 50)
    - offset: Pagination offset (default: 0)
    - hours: Articles from last X hours (default: 24)
    """
    category = request.args.get('category')
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    hours = int(request.args.get('hours', 24))
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Build query
    query = '''
        SELECT id, url, source, title, description, image_url, 
               author, published_date, category, ai_final_score,
               ai_emoji, published_at, view_count
        FROM articles
        WHERE published = TRUE
        AND published_at >= datetime('now', ?)
    '''
    params = [f'-{hours} hours']
    
    if category:
        query += ' AND category = ?'
        params.append(category)
    
    query += ' ORDER BY ai_final_score DESC, published_at DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    articles = [dict(row) for row in cursor.fetchall()]
    
    # Get total count
    count_query = '''
        SELECT COUNT(*) as total
        FROM articles
        WHERE published = TRUE
        AND published_at >= datetime('now', ?)
    '''
    count_params = [f'-{hours} hours']
    
    if category:
        count_query += ' AND category = ?'
        count_params.append(category)
    
    cursor.execute(count_query, count_params)
    total = cursor.fetchone()['total']
    
    conn.close()
    
    return jsonify({
        'articles': articles,
        'total': total,
        'limit': limit,
        'offset': offset,
        'has_more': (offset + limit) < total
    })

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get article counts by category"""
    hours = int(request.args.get('hours', 24))
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT category, 
               COUNT(*) as count,
               MAX(published_at) as latest,
               AVG(ai_final_score) as avg_score
        FROM articles
        WHERE published = TRUE
        AND published_at >= datetime('now', ?)
        GROUP BY category
        ORDER BY count DESC
    ''', (f'-{hours} hours',))
    
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({'categories': categories})

@app.route('/api/article/<int:article_id>', methods=['GET'])
def get_article(article_id):
    """Get single article and increment view count"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, url, source, title, description,
               image_url, author, published_date, category,
               ai_final_score, ai_emoji, published_at, view_count
        FROM articles
        WHERE id = ? AND published = TRUE
    ''', (article_id,))
    
    article = cursor.fetchone()
    
    if not article:
        conn.close()
        return jsonify({'error': 'Article not found'}), 404
    
    # Increment view count
    cursor.execute('''
        UPDATE articles
        SET view_count = view_count + 1
        WHERE id = ?
    ''', (article_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'article': dict(article)})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Total published
    cursor.execute('SELECT COUNT(*) as total FROM articles WHERE published = TRUE')
    total_published = cursor.fetchone()['total']
    
    # Published today
    cursor.execute('''
        SELECT COUNT(*) as today
        FROM articles
        WHERE published = TRUE
        AND date(published_at) = date('now')
    ''')
    today_count = cursor.fetchone()['today']
    
    # Last fetch cycle
    cursor.execute('''
        SELECT *
        FROM fetch_cycles
        ORDER BY started_at DESC
        LIMIT 1
    ''')
    last_fetch_row = cursor.fetchone()
    last_fetch = dict(last_fetch_row) if last_fetch_row else None
    
    # Last AI filter cycle
    cursor.execute('''
        SELECT *
        FROM ai_filter_cycles
        ORDER BY started_at DESC
        LIMIT 1
    ''')
    last_filter_row = cursor.fetchone()
    last_filter = dict(last_filter_row) if last_filter_row else None
    
    # Top sources today
    cursor.execute('''
        SELECT source, COUNT(*) as count
        FROM articles
        WHERE published = TRUE
        AND date(published_at) = date('now')
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
    ''')
    top_sources = [dict(row) for row in cursor.fetchall()]
    
    # Articles waiting for AI
    cursor.execute('SELECT COUNT(*) as waiting FROM articles WHERE ai_processed = FALSE')
    waiting_for_ai = cursor.fetchone()['waiting']
    
    conn.close()
    
    return jsonify({
        'total_published': total_published,
        'published_today': today_count,
        'waiting_for_ai': waiting_for_ai,
        'last_fetch_cycle': last_fetch,
        'last_filter_cycle': last_filter,
        'top_sources_today': top_sources
    })

@app.route('/api/search', methods=['GET'])
def search_articles():
    """
    Search published articles
    
    Query params:
    - q: Search query
    - limit: Number of results (default: 50)
    """
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 50))
    
    if not query:
        return jsonify({'error': 'Query parameter required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, url, source, title, description, image_url,
               category, published_at, ai_final_score, ai_emoji
        FROM articles
        WHERE published = TRUE
        AND (title LIKE ? OR description LIKE ?)
        ORDER BY ai_final_score DESC, published_at DESC
        LIMIT ?
    ''', (f'%{query}%', f'%{query}%', limit))
    
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'query': query,
        'results': results,
        'count': len(results)
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print(f"🚀 Ten News Live API starting on http://{API_HOST}:{API_PORT}")
    app.run(host=API_HOST, port=API_PORT, debug=API_DEBUG)


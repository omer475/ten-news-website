#!/usr/bin/env python3
"""
FEED RANKING API
==========================================
Purpose: Provide ranked news feed for frontend
Features:
  - Rank articles by importance, recency, source count
  - Include source attribution
  - Update history
  - Component data
"""

import os
import json
from typing import List, Dict, Optional
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access


# ==========================================
# SUPABASE CLIENT
# ==========================================

def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    
    return create_client(url, key)


supabase = get_supabase_client()


# ==========================================
# FEED ENDPOINT
# ==========================================

@app.route('/api/feed', methods=['GET'])
def get_feed():
    """
    Get ranked news feed for frontend.
    
    Query params:
        - limit: Number of articles to return (default: 50)
        - offset: Pagination offset (default: 0)
        - category: Filter by category (optional)
        
    Returns:
        JSON with articles sorted by:
        1. Importance score (higher = more important)
        2. Recency (last_updated_at)
        3. Source count (more sources = more validated)
    """
    try:
        # Get query parameters
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        category = request.args.get('category', None, type=str)
        
        # Build query
        query = supabase.table('published_articles').select(
            '''
            *,
            clusters (
                id,
                event_name,
                status,
                source_count,
                importance_score,
                created_at,
                last_updated_at
            )
            '''
        )
        
        # Filter by category if provided
        if category:
            query = query.eq('category', category)
        
        # Execute query with sorting
        result = query.order(
            'clusters.importance_score', desc=True
        ).order(
            'last_updated_at', desc=True
        ).range(offset, offset + limit - 1).execute()
        
        if not result.data:
            return jsonify({
                'articles': [],
                'count': 0,
                'updated_at': datetime.utcnow().isoformat()
            })
        
        # Format articles for frontend
        feed_data = []
        
        for article in result.data:
            cluster = article.get('clusters', {})
            
            # Get source articles for this cluster
            sources_result = supabase.table('source_articles').select(
                'id, url, title, source_name, score, published_at'
            ).eq('cluster_id', cluster.get('id')).order('score', desc=True).execute()
            
            sources = sources_result.data if sources_result.data else []
            
            # Format article
            feed_data.append({
                'id': article['id'],
                'cluster_id': article['cluster_id'],
                'event_name': cluster.get('event_name', 'Unknown'),
                
                # Titles (dual language)
                'title_news': article['title_news'],
                'title_b2': article['title_b2'],
                
                # Summaries (dual language)
                'summary_bullets_news': json.loads(article['summary_bullets_news']) if article.get('summary_bullets_news') else [],
                'summary_bullets_b2': json.loads(article['summary_bullets_b2']) if article.get('summary_bullets_b2') else [],
                
                # Content (dual language)
                'content_news': article['content_news'],
                'content_b2': article['content_b2'],
                
                # Components
                'timeline': json.loads(article['timeline']) if article.get('timeline') else [],
                'details': json.loads(article['details']) if article.get('details') else [],
                'graph': json.loads(article['graph']) if article.get('graph') else None,
                'map': json.loads(article['map']) if article.get('map') else None,
                'components': article.get('components', []),
                
                # Metadata
                'category': article.get('category', 'World News'),
                'emoji': article.get('emoji', '📰'),
                'importance_score': cluster.get('importance_score', 0),
                'source_count': cluster.get('source_count', len(sources)),
                'version': article['version_number'],
                
                # Timestamps
                'published_at': article['published_at'],
                'updated_at': article['last_updated_at'],
                'created_at': article['created_at'],
                
                # Sources
                'sources': [
                    {
                        'name': s['source_name'],
                        'title': s['title'],
                        'url': s['url'],
                        'score': s['score'],
                        'published_at': s['published_at']
                    }
                    for s in sources
                ],
                
                # View count
                'view_count': article.get('view_count', 0)
            })
        
        return jsonify({
            'articles': feed_data,
            'count': len(feed_data),
            'updated_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Feed error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==========================================
# ARTICLE DETAIL ENDPOINT
# ==========================================

@app.route('/api/article/<int:article_id>', methods=['GET'])
def get_article_detail(article_id: int):
    """
    Get detailed view of single article with update history.
    
    Args:
        article_id: Published article ID
        
    Returns:
        JSON with full article data including update history
    """
    try:
        # Get published article
        result = supabase.table('published_articles').select(
            '''
            *,
            clusters (*)
            '''
        ).eq('id', article_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Article not found'}), 404
        
        article = result.data[0]
        cluster = article.get('clusters', {})
        
        # Get source articles
        sources_result = supabase.table('source_articles').select(
            '*'
        ).eq('cluster_id', cluster.get('id')).order('score', desc=True).execute()
        
        sources = sources_result.data if sources_result.data else []
        
        # Get update history
        updates_result = supabase.table('article_updates_log').select(
            '*'
        ).eq('article_id', article_id).order('updated_at', desc=True).execute()
        
        updates = updates_result.data if updates_result.data else []
        
        # Format response
        return jsonify({
            'id': article['id'],
            'cluster_id': article['cluster_id'],
            'event_name': cluster.get('event_name'),
            
            # Titles
            'title_news': article['title_news'],
            'title_b2': article['title_b2'],
            
            # Summaries
            'summary_bullets_news': json.loads(article['summary_bullets_news']) if article.get('summary_bullets_news') else [],
            'summary_bullets_b2': json.loads(article['summary_bullets_b2']) if article.get('summary_bullets_b2') else [],
            
            # Content
            'content_news': article['content_news'],
            'content_b2': article['content_b2'],
            
            # Components
            'timeline': json.loads(article['timeline']) if article.get('timeline') else [],
            'details': json.loads(article['details']) if article.get('details') else [],
            'graph': json.loads(article['graph']) if article.get('graph') else None,
            'map': json.loads(article['map']) if article.get('map') else None,
            'components': article.get('components', []),
            
            # Metadata
            'category': article.get('category'),
            'emoji': article.get('emoji'),
            'importance_score': cluster.get('importance_score'),
            'source_count': cluster.get('source_count'),
            'version': article['version_number'],
            
            # Timestamps
            'published_at': article['published_at'],
            'updated_at': article['last_updated_at'],
            'created_at': article['created_at'],
            
            # Sources
            'sources': [
                {
                    'id': s['id'],
                    'name': s['source_name'],
                    'title': s['title'],
                    'description': s['description'],
                    'url': s['url'],
                    'score': s['score'],
                    'published_at': s['published_at'],
                    'fetched_at': s['fetched_at']
                }
                for s in sources
            ],
            
            # Update history
            'update_history': [
                {
                    'updated_at': u['updated_at'],
                    'trigger_type': u['trigger_type'],
                    'trigger_details': u['trigger_details'],
                    'sources_added': u['sources_added_count'],
                    'old_version': u.get('old_version'),
                    'new_version': u.get('new_version')
                }
                for u in updates
            ],
            
            # View count
            'view_count': article.get('view_count', 0)
        })
        
    except Exception as e:
        print(f"❌ Article detail error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==========================================
# STATISTICS ENDPOINT
# ==========================================

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """
    Get overall system statistics.
    
    Returns:
        JSON with system stats
    """
    try:
        # Count active clusters
        clusters_result = supabase.table('clusters').select(
            'id', count='exact'
        ).eq('status', 'active').execute()
        
        active_clusters = clusters_result.count if clusters_result.count else 0
        
        # Count published articles
        articles_result = supabase.table('published_articles').select(
            'id', count='exact'
        ).execute()
        
        published_articles = articles_result.count if articles_result.count else 0
        
        # Count source articles
        sources_result = supabase.table('source_articles').select(
            'id', count='exact'
        ).execute()
        
        source_articles = sources_result.count if sources_result.count else 0
        
        # Get average sources per cluster
        avg_sources = source_articles / max(active_clusters, 1)
        
        return jsonify({
            'active_clusters': active_clusters,
            'published_articles': published_articles,
            'source_articles': source_articles,
            'avg_sources_per_cluster': round(avg_sources, 2),
            'updated_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return jsonify({'error': str(e)}), 500


# ==========================================
# HEALTH CHECK
# ==========================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    })


# ==========================================
# MAIN ENTRY POINT
# ==========================================

if __name__ == '__main__':
    print("🚀 Starting Feed Ranking API")
    print("=" * 80)
    print("\nEndpoints:")
    print("  GET /api/feed - Get ranked news feed")
    print("  GET /api/article/<id> - Get article detail")
    print("  GET /api/stats - Get system statistics")
    print("  GET /api/health - Health check")
    print("\nPress Ctrl+C to stop\n")
    
    # Run Flask app
    port = int(os.getenv('API_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)


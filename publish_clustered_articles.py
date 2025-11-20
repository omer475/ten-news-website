#!/usr/bin/env python3
"""
PUBLISH CLUSTERED ARTICLES
==========================================
Purpose: Publish synthesized articles from published_articles table to Supabase
Features:
  - Publish complete articles with all fields
  - Include source attribution
  - Handle updates (overwrite existing)
  - Dual-language support
"""

import os
import json
from typing import List, Dict
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    
    return create_client(url, key)


def publish_article_to_main_table(article: Dict, sources: List[Dict]) -> bool:
    """
    Publish a synthesized article to the main articles table.
    
    Args:
        article: Published article from published_articles table
        sources: Source articles for attribution
        
    Returns:
        True if successful
    """
    try:
        supabase = get_supabase_client()
        
        # Check if article already exists (by cluster_id or URL)
        # For clustered articles, use cluster_id as unique identifier
        cluster_url = f"https://tennews.ai/cluster/{article['cluster_id']}"
        
        existing = supabase.table('articles').select('id').eq('url', cluster_url).execute()
        
        # Prepare article data for main articles table
        article_data = {
            # Core fields
            'url': cluster_url,
            'source': 'Today+ Synthesis',  # Indicates this is synthesized
            'title': article['title_news'],  # Use news version as main title
            'description': article['content_news'][:200],  # First 200 chars as description
            
            # Dual-language titles
            'title_news': article['title_news'],
            'title_b2': article['title_b2'],
            
            # Dual-language summaries
            'summary_bullets_news': article['summary_bullets_news'],
            'summary_bullets_b2': article['summary_bullets_b2'],
            
            # Dual-language content
            'content_news': article['content_news'],
            'content_b2': article['content_b2'],
            
            # Components
            'timeline': article.get('timeline'),
            'details': article.get('details'),
            'graph': article.get('graph'),
            'map': article.get('map'),
            'components': article.get('components', []),
            
            # Metadata
            'category': article.get('category', 'World News'),
            'emoji': article.get('emoji', '📰'),
            'ai_final_score': article.get('importance_score', 0),
            
            # Source attribution (store cluster_id and source count)
            'ai_reasoning': f"Synthesized from {len(sources)} sources. Cluster ID: {article['cluster_id']}",
            
            # Publishing
            'published': True,
            'published_at': article['published_at'],
            'ai_processed': True,
            
            # Use first source's image if available
            'image_url': sources[0].get('image_url') if sources and sources[0].get('image_url') else None,
            
            # Timestamps
            'fetched_at': article['created_at'],
            'created_at': article['created_at'],
            'updated_at': article['last_updated_at']
        }
        
        if existing.data:
            # Update existing article
            result = supabase.table('articles').update(article_data).eq('id', existing.data[0]['id']).execute()
            print(f"  ✓ Updated article: {article['title_news'][:60]}")
        else:
            # Insert new article
            result = supabase.table('articles').insert(article_data).execute()
            print(f"  ✓ Published article: {article['title_news'][:60]}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Publishing error: {e}")
        return False


def publish_all_articles():
    """
    Publish all articles from published_articles table to main articles table.
    """
    print(f"\n{'='*60}")
    print(f"PUBLISHING CLUSTERED ARTICLES")
    print(f"{'='*60}\n")
    
    try:
        supabase = get_supabase_client()
        
        # Get all published articles
        result = supabase.table('published_articles').select(
            '*, clusters(*)'
        ).execute()
        
        if not result.data:
            print("No published articles found")
            return
        
        print(f"Found {len(result.data)} articles to publish\n")
        
        published_count = 0
        failed_count = 0
        
        for i, article in enumerate(result.data, 1):
            cluster_id = article['cluster_id']
            
            # Get source articles
            sources_result = supabase.table('source_articles').select('*').eq('cluster_id', cluster_id).execute()
            sources = sources_result.data if sources_result.data else []
            
            print(f"[{i}/{len(result.data)}] Publishing...")
            print(f"  Sources: {len(sources)}")
            
            if publish_article_to_main_table(article, sources):
                published_count += 1
            else:
                failed_count += 1
        
        print(f"\n{'='*60}")
        print(f"PUBLISHING COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Published: {published_count}")
        if failed_count > 0:
            print(f"✗ Failed: {failed_count}")
        
    except Exception as e:
        print(f"❌ Publishing error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("📤 CLUSTERED ARTICLES PUBLISHER")
    print("=" * 80)
    
    publish_all_articles()


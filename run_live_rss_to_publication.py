#!/usr/bin/env python3
"""
TEN NEWS - LIVE RSS TO PUBLICATION PIPELINE
1. Fetch NEW RSS articles only
2. Process only NEW articles through 5-step pipeline
3. Publish to website
"""

import os
import sys
import json
import sqlite3
import time
from datetime import datetime
from typing import List, Dict

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  python-dotenv not available, using system environment variables")

# Import your step modules
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step2_scrapingbee_full_article_fetching import ScrapingBeeArticleFetcher, FetcherConfig
from step3_gemini_component_selection import GeminiComponentSelector, ComponentConfig
from step4_perplexity_dynamic_context_search import PerplexityContextSearcher, PerplexityConfig
from step5_claude_final_writing_formatting import ClaudeFinalWriter, WriterConfig

def fetch_new_rss_articles():
    """
    Step 1: Run RSS fetcher to get NEW articles only
    """
    print("📰 STEP 1: FETCHING NEW RSS ARTICLES")
    print("-" * 40)
    
    try:
        # Import and run RSS fetcher
        from rss_fetcher import OptimizedRSSFetcher
        
        print("🔄 Starting RSS fetcher...")
        fetcher = OptimizedRSSFetcher()
        
        # Run one fetch cycle
        print("📡 Fetching from 200+ RSS sources...")
        results = fetcher._parallel_fetch_all_sources()
        
        print(f"✅ RSS Fetch Complete:")
        print(f"   📊 Total articles found: {results['total_articles']}")
        print(f"   🆕 New articles: {results['new_articles']}")
        print(f"   📰 Sources fetched: {results['sources_fetched']}")
        print(f"   ❌ Failed sources: {results['failed_sources']}")
        
        return results['new_articles']
        
    except Exception as e:
        print(f"❌ RSS fetch failed: {e}")
        return 0

def get_new_unread_articles(start_time: str, expected_count: int) -> List[Dict]:
    """
    Get only the NEW unread articles from the current RSS fetch cycle
    """
    try:
        conn = sqlite3.connect('ten_news.db')
        cursor = conn.cursor()
        
        # Get ONLY articles fetched after the cycle start time - limit to expected count
        cursor.execute('''
            SELECT title, source, description, url, fetched_at, id
            FROM articles 
            WHERE published = 0 
            AND fetched_at > ?
            ORDER BY fetched_at DESC
            LIMIT ?
        ''', (start_time, expected_count))
        
        articles = []
        article_ids = []
        for row in cursor.fetchall():
            articles.append({
                'title': row[0],
                'source': row[1], 
                'text': row[2] or '',  # description as text
                'url': row[3],
                'fetched_at': row[4],
                'id': row[5]
            })
            article_ids.append(row[5])
        
        # Mark these articles as "processing" to avoid double-processing
        if article_ids:
            placeholders = ','.join(['?' for _ in article_ids])
            cursor.execute(f'''
                UPDATE articles 
                SET published = -1 
                WHERE id IN ({placeholders})
            ''', article_ids)
            conn.commit()
        
        conn.close()
        return articles
        
    except Exception as e:
        print(f"❌ Error loading new articles: {e}")
        return []

def publish_articles_to_website(articles: List[Dict]):
    """
    Publish processed articles to the website
    """
    print("\n🌍 STEP 6: PUBLISHING TO WEBSITE")
    print("-" * 40)
    
    try:
        # Import your existing publish function
        from supabase_storage import save_articles_to_supabase
        
        # DEBUG: Check first article structure
        if articles and len(articles) > 0:
            print(f"\n🔍 DEBUG: First article has {len(articles[0].keys())} keys")
            print(f"🔍 DEBUG: Has 'detailed_text'? {'detailed_text' in articles[0]}")
            print(f"🔍 DEBUG: Has 'summary_bullets'? {'summary_bullets' in articles[0]}")
            print(f"🔍 DEBUG: Has 'title'? {'title' in articles[0]}")
            if 'detailed_text' in articles[0]:
                print(f"🔍 DEBUG: detailed_text length: {len(articles[0]['detailed_text'])} chars")
        
        print(f"📤 Publishing {len(articles)} articles to tennews.ai...")
        
        # Convert articles to the format expected by Supabase function - FULL FIELD MAPPING
        articles_to_publish = []
        article_ids = []
        for article in articles:
            db_article = {
                # Core fields
                'url': article.get('url', ''),
                'guid': article.get('guid', ''),
                'source': article.get('source', 'Unknown'),
                'title': article.get('title', ''),
                'description': article.get('description', ''),
                'content': article.get('text', ''),
                'image_url': article.get('image_url', ''),
                'author': article.get('author', ''),
                'published_date': article.get('published_date') or article.get('published_time'),
                
                # AI scoring
                'score': float(article.get('score', 0)),
                'ai_final_score': float(article.get('score', 0)),
                'ai_category': article.get('category', 'World News'),
                
                # Publishing
                'category': article.get('category', 'World News'),
                'emoji': article.get('emoji', '📰'),
                
                # Enhanced content
                'article': article.get('detailed_text', ''),  # NEW: detailed article text (150-200 words)
                'summary_bullets': article.get('summary_bullets', []),  # NEW: bullet points
                'timeline': article.get('timeline', []),
                'details': article.get('details', []),
                'graph': article.get('graph', {}),
                'map': article.get('map', {}),
                'components': article.get('components', []),  # NEW: Component order array
                
                # Timestamps
                'publishedAt': datetime.now().isoformat(),
                'image_extraction_method': article.get('image_extraction_method', '')
            }
            
            # DEBUG: Check if article and summary_bullets are populated
            if not db_article['article']:
                print(f"  ⚠️ WARNING: Article {i+1}/{len(articles)} has empty 'article' field. Keys: {list(article.keys())[:10]}")
            if not db_article['summary_bullets']:
                print(f"  ⚠️ WARNING: Article {i+1}/{len(articles)} has empty 'summary_bullets' field")
            articles_to_publish.append(db_article)
            if 'id' in article:
                article_ids.append(article['id'])
        
        # Publish to Supabase
        success = save_articles_to_supabase(articles_to_publish, source_part=1)
        success_count = len(articles_to_publish) if success else 0
        
        # Mark articles as published in local database
        if success and article_ids:
            conn = sqlite3.connect('ten_news.db')
            cursor = conn.cursor()
            placeholders = ','.join(['?' for _ in article_ids])
            cursor.execute(f'''
                UPDATE articles 
                SET published = 1 
                WHERE id IN ({placeholders})
            ''', article_ids)
            conn.commit()
            conn.close()
        
        print(f"✅ Publishing Complete:")
        print(f"   📤 Articles published: {success_count}")
        print(f"   🌍 Live on: https://tennews.ai")
        
        return success_count
        
    except Exception as e:
        print(f"❌ Publishing failed: {e}")
        return 0

def run_live_rss_to_publication_pipeline():
    """
    Complete pipeline: RSS Fetch → Process → Publish
    """
    
    print("🚀 STARTING LIVE RSS TO PUBLICATION PIPELINE")
    print("=" * 60)
    
    # Record pipeline start time
    pipeline_start_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # API Keys from environment
    GEMINI_API_KEY = os.getenv('GOOGLE_API_KEY')
    SCRAPINGBEE_API_KEY = os.getenv('SCRAPINGBEE_API_KEY')
    PERPLEXITY_API_KEY = os.getenv('PERPLEXITY_API_KEY')
    ANTHROPIC_API_KEY = os.getenv('CLAUDE_API_KEY')
    
    # Validate API keys
    missing_keys = []
    if not GEMINI_API_KEY:
        missing_keys.append('GOOGLE_API_KEY')
    if not SCRAPINGBEE_API_KEY:
        missing_keys.append('SCRAPINGBEE_API_KEY')
    if not PERPLEXITY_API_KEY:
        missing_keys.append('PERPLEXITY_API_KEY')
    if not ANTHROPIC_API_KEY:
        missing_keys.append('CLAUDE_API_KEY')
    
    if missing_keys:
        print(f"❌ Missing API keys: {', '.join(missing_keys)}")
        return False
    
    # ==========================================
    # STEP 1: FETCH NEW RSS ARTICLES
    # ==========================================
    new_articles_count = fetch_new_rss_articles()
    
    if new_articles_count == 0:
        print("❌ No new articles fetched - stopping pipeline")
        return False
    
    # ==========================================
    # STEP 2: GET NEW UNREAD ARTICLES
    # ==========================================
    print("\n📰 STEP 2: LOADING NEW UNREAD ARTICLES")
    print("-" * 40)
    
    # Get ONLY articles from this RSS fetch cycle
    new_articles = get_new_unread_articles(pipeline_start_time, new_articles_count)
    
    if not new_articles:
        print("❌ No new unread articles found - stopping pipeline")
        return False
    
    print(f"✅ Loaded {len(new_articles)} new unread articles from current fetch")
    
    # ==========================================
    # STEP 3: GEMINI NEWS SCORING & FILTERING
    # ==========================================
    print("\n🤖 STEP 3: GEMINI NEWS SCORING & FILTERING")
    print("-" * 40)
    
    try:
        # Process articles in batches of 30
        batch_size = 30
        all_approved = []
        all_filtered = []
        
        total_batches = (len(new_articles) + batch_size - 1) // batch_size
        print(f"📊 Processing {len(new_articles)} articles in {total_batches} batches of {batch_size}")
        
        for i in range(0, len(new_articles), batch_size):
            batch = new_articles[i:i+batch_size]
            batch_num = i // batch_size + 1
            
            print(f"\n🔄 Processing batch {batch_num}/{total_batches} ({len(batch)} articles)...")
            
            try:
                batch_results = score_news_articles_step1(batch, GEMINI_API_KEY)
                all_approved.extend(batch_results['approved'])
                all_filtered.extend(batch_results['filtered'])
                
                print(f"✅ Batch {batch_num}: {len(batch_results['approved'])} approved, {len(batch_results['filtered'])} filtered")
                
            except Exception as e:
                print(f"❌ Batch {batch_num} failed: {e}")
                continue
            
            # Small delay between batches
            if i + batch_size < len(new_articles):
                time.sleep(1)
        
        approved_articles = all_approved
        
        print(f"\n✅ Step 3 Complete:")
        print(f"   📊 Total scored: {len(approved_articles) + len(all_filtered)}")
        print(f"   ✅ Approved: {len(approved_articles)} ({len(approved_articles)/(len(approved_articles) + len(all_filtered))*100:.1f}%)")
        print(f"   ❌ Filtered: {len(all_filtered)}")
        
        if not approved_articles:
            print("❌ No articles approved - stopping pipeline")
            return False
            
    except Exception as e:
        print(f"❌ Step 3 failed: {e}")
        return False
    
    # ==========================================
    # STEP 4: SCRAPINGBEE FULL ARTICLE FETCHING
    # ==========================================
    print("\n📄 STEP 4: SCRAPINGBEE FULL ARTICLE FETCHING")
    print("-" * 40)
    
    try:
        fetcher = ScrapingBeeArticleFetcher(
            api_key=SCRAPINGBEE_API_KEY,
            config=FetcherConfig(
                render_js=False,
                parallel_workers=5,
                max_text_length=15000
            )
        )
        
        full_articles = fetcher.fetch_batch_parallel(approved_articles)
        
        print(f"✅ Step 4 Complete:")
        print(f"   📄 Articles fetched: {len(full_articles)}")
        print(f"   📊 Success rate: {len(full_articles)/len(approved_articles)*100:.1f}%")
        
        if not full_articles:
            print("❌ No articles fetched - stopping pipeline")
            return False
            
    except Exception as e:
        print(f"❌ Step 4 failed: {e}")
        return False
    
    # ==========================================
    # STEP 5: GEMINI COMPONENT SELECTION
    # ==========================================
    print("\n🎯 STEP 5: GEMINI COMPONENT SELECTION")
    print("-" * 40)
    
    try:
        component_selector = GeminiComponentSelector(
            api_key=GEMINI_API_KEY,
            config=ComponentConfig()
        )
        
        articles_with_components = component_selector.select_components_batch(full_articles)
        
        print(f"✅ Step 5 Complete:")
        print(f"   🎯 Articles processed: {len(articles_with_components)}")
        
    except Exception as e:
        print(f"❌ Step 5 failed: {e}")
        return False
    
    # ==========================================
    # STEP 6: PERPLEXITY DYNAMIC CONTEXT SEARCH
    # ==========================================
    print("\n🔍 STEP 6: PERPLEXITY DYNAMIC CONTEXT SEARCH")
    print("-" * 40)
    
    try:
        context_searcher = PerplexityContextSearcher(
            api_key=PERPLEXITY_API_KEY,
            config=PerplexityConfig()
        )
        
        articles_with_context = context_searcher.search_all_articles(articles_with_components)
        
        print(f"✅ Step 6 Complete:")
        print(f"   🔍 Articles processed: {len(articles_with_context)}")
        
    except Exception as e:
        print(f"❌ Step 6 failed: {e}")
        return False
    
    # ==========================================
    # STEP 7: CLAUDE FINAL WRITING & FORMATTING
    # ==========================================
    print("\n✍️ STEP 7: CLAUDE FINAL WRITING & FORMATTING")
    print("-" * 40)
    
    try:
        final_writer = ClaudeFinalWriter(
            api_key=ANTHROPIC_API_KEY,
            config=WriterConfig()
        )
        
        final_articles = final_writer.write_all_articles(articles_with_context)
        
        print(f"✅ Step 7 Complete:")
        print(f"   ✍️ Final articles: {len(final_articles)}")
        
    except Exception as e:
        print(f"❌ Step 7 failed: {e}")
        return False
    
    # ==========================================
    # STEP 8: PUBLISH TO WEBSITE
    # ==========================================
    published_count = publish_articles_to_website(final_articles)
    
    # ==========================================
    # PIPELINE SUMMARY
    # ==========================================
    print("\n" + "=" * 60)
    print("🎉 LIVE RSS TO PUBLICATION PIPELINE COMPLETE!")
    print("=" * 60)
    print(f"📰 RSS fetch: {new_articles_count} new articles")
    print(f"📊 New unread: {len(new_articles)} articles")
    print(f"✅ Step 3 approved: {len(approved_articles)} articles")
    print(f"📄 Step 4 fetched: {len(full_articles)} full articles")
    print(f"🎯 Step 5 selected components: {len(articles_with_components)} articles")
    print(f"🔍 Step 6 searched context: {len(articles_with_context)} articles")
    print(f"✍️ Step 7 finalized: {len(final_articles)} articles")
    print(f"🌍 Step 8 published: {published_count} articles")
    print(f"🌐 Live on: https://tennews.ai")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = run_live_rss_to_publication_pipeline()
    
    if success:
        print("\n✅ Pipeline completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Pipeline failed!")
        sys.exit(1)

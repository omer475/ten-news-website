#!/usr/bin/env python3
"""
TEN NEWS - 5-STEP LIVE NEWS GENERATION PIPELINE
Complete end-to-end pipeline that transforms RSS articles into publication-ready news
"""

import os
import sys
import json
import time
import sqlite3
from datetime import datetime
from typing import List, Dict

# Import your step modules
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step2_scrapingbee_full_article_fetching import ScrapingBeeArticleFetcher, FetcherConfig
from step3_gemini_component_selection import GeminiComponentSelector, ComponentConfig
from step4_perplexity_dynamic_context_search import PerplexityContextSearcher, PerplexityConfig
from step5_claude_final_writing_formatting import ClaudeFinalWriter, WriterConfig

def load_rss_articles_from_db() -> List[Dict]:
    """
    Load unread RSS articles from your database
    """
    try:
        conn = sqlite3.connect('ten_news.db')
        cursor = conn.cursor()
        
        # Get recent unread articles (last 24 hours)
        cursor.execute('''
            SELECT title, source, description, url, fetched_at
            FROM articles 
            WHERE published = 0 
            AND fetched_at > datetime('now', '-1 day')
            ORDER BY fetched_at DESC
            LIMIT 1000
        ''')
        
        articles = []
        for row in cursor.fetchall():
            articles.append({
                'title': row[0],
                'source': row[1], 
                'text': row[2] or '',  # description as text
                'url': row[3],
                'fetched_at': row[4]
            })
        
        conn.close()
        return articles
        
    except Exception as e:
        print(f"❌ Error loading RSS articles: {e}")
        return []

def run_complete_5step_pipeline():
    """
    Run the complete 5-step live news generation pipeline
    """
    
    print("🚀 STARTING COMPLETE 5-STEP LIVE NEWS GENERATION PIPELINE")
    print("=" * 60)
    
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
        print("Set them in your environment or .env file")
        return False
    
    # Load RSS articles from database
    print("\n📰 STEP 0: LOADING RSS ARTICLES")
    print("-" * 40)
    rss_articles = load_rss_articles_from_db()
    
    if not rss_articles:
        print("❌ No RSS articles found in database")
        print("Run your RSS fetcher first to populate articles")
        return False
    
    print(f"✅ Loaded {len(rss_articles)} RSS articles")
    
    # ==========================================
    # STEP 1: GEMINI NEWS SCORING & FILTERING
    # ==========================================
    print("\n🤖 STEP 1: GEMINI NEWS SCORING & FILTERING")
    print("-" * 40)
    
    try:
        # Process articles in batches of 30 to avoid token limits
        batch_size = 30
        all_approved = []
        all_filtered = []
        
        total_batches = (len(rss_articles) + batch_size - 1) // batch_size
        print(f"📊 Processing {len(rss_articles)} articles in {total_batches} batches of {batch_size}")
        
        for i in range(0, len(rss_articles), batch_size):
            batch = rss_articles[i:i+batch_size]
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
            if i + batch_size < len(rss_articles):
                time.sleep(1)
        
        approved_articles = all_approved
        filtered_articles = all_filtered
        
        print(f"\n✅ Step 1 Complete:")
        print(f"   📊 Total scored: {len(approved_articles) + len(filtered_articles)}")
        print(f"   ✅ Approved: {len(approved_articles)} ({len(approved_articles)/(len(approved_articles) + len(filtered_articles))*100:.1f}%)")
        print(f"   ❌ Filtered: {len(filtered_articles)}")
        
        if not approved_articles:
            print("❌ No articles approved - stopping pipeline")
            return False
            
    except Exception as e:
        print(f"❌ Step 1 failed: {e}")
        return False
    
    # ==========================================
    # STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING
    # ==========================================
    print("\n📄 STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING")
    print("-" * 40)
    
    try:
        fetcher = ScrapingBeeArticleFetcher(
            api_key=SCRAPINGBEE_API_KEY,
            config=FetcherConfig(
                render_js=False,  # Use standard (cheaper)
                parallel_workers=5,
                max_text_length=15000
            )
        )
        
        full_articles = fetcher.fetch_batch_parallel(approved_articles)
        
        print(f"✅ Step 2 Complete:")
        print(f"   📄 Articles fetched: {len(full_articles)}")
        print(f"   📊 Success rate: {len(full_articles)/len(approved_articles)*100:.1f}%")
        
        if not full_articles:
            print("❌ No articles fetched - stopping pipeline")
            return False
            
    except Exception as e:
        print(f"❌ Step 2 failed: {e}")
        return False
    
    # ==========================================
    # STEP 3: GEMINI COMPONENT SELECTION
    # ==========================================
    print("\n🎯 STEP 3: GEMINI COMPONENT SELECTION")
    print("-" * 40)
    
    try:
        component_selector = GeminiComponentSelector(
            api_key=GEMINI_API_KEY,
            config=ComponentConfig()
        )
        
        articles_with_components = component_selector.select_components_batch(full_articles)
        
        print(f"✅ Step 3 Complete:")
        print(f"   🎯 Articles processed: {len(articles_with_components)}")
        
        # Show component distribution
        component_counts = {'timeline': 0, 'details': 0, 'graph': 0, 'map': 0}
        for article in articles_with_components:
            for component in article.get('components', []):
                component_counts[component] += 1
        
        print(f"   📊 Component distribution:")
        for comp, count in component_counts.items():
            print(f"      {comp}: {count}")
            
    except Exception as e:
        print(f"❌ Step 3 failed: {e}")
        return False
    
    # ==========================================
    # STEP 4: PERPLEXITY DYNAMIC CONTEXT SEARCH
    # ==========================================
    print("\n🔍 STEP 4: PERPLEXITY DYNAMIC CONTEXT SEARCH")
    print("-" * 40)
    
    try:
        context_searcher = PerplexityContextSearcher(
            api_key=PERPLEXITY_API_KEY,
            config=PerplexityConfig()
        )
        
        articles_with_context = context_searcher.search_all_articles(articles_with_components)
        
        print(f"✅ Step 4 Complete:")
        print(f"   🔍 Articles processed: {len(articles_with_context)}")
        
    except Exception as e:
        print(f"❌ Step 4 failed: {e}")
        return False
    
    # ==========================================
    # STEP 5: CLAUDE FINAL WRITING & FORMATTING
    # ==========================================
    print("\n✍️ STEP 5: CLAUDE FINAL WRITING & FORMATTING")
    print("-" * 40)
    
    try:
        final_writer = ClaudeFinalWriter(
            api_key=ANTHROPIC_API_KEY,
            config=WriterConfig()
        )
        
        final_articles = final_writer.write_all_articles(articles_with_context)
        
        print(f"✅ Step 5 Complete:")
        print(f"   ✍️ Final articles: {len(final_articles)}")
        
    except Exception as e:
        print(f"❌ Step 5 failed: {e}")
        return False
    
    # ==========================================
    # SAVE RESULTS
    # ==========================================
    print("\n💾 SAVING RESULTS")
    print("-" * 40)
    
    timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
    output_file = f"5step_pipeline_results_{timestamp}.json"
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(final_articles, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Results saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Failed to save results: {e}")
        return False
    
    # ==========================================
    # PIPELINE SUMMARY
    # ==========================================
    print("\n" + "=" * 60)
    print("🎉 5-STEP PIPELINE COMPLETE!")
    print("=" * 60)
    print(f"📰 Started with: {len(rss_articles)} RSS articles")
    print(f"✅ Step 1 approved: {len(approved_articles)} articles")
    print(f"📄 Step 2 fetched: {len(full_articles)} full articles")
    print(f"🎯 Step 3 selected components for: {len(articles_with_components)} articles")
    print(f"🔍 Step 4 searched context for: {len(articles_with_context)} articles")
    print(f"✍️ Step 5 finalized: {len(final_articles)} articles")
    print(f"💾 Results saved to: {output_file}")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = run_complete_5step_pipeline()
    
    if success:
        print("\n✅ Pipeline completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Pipeline failed!")
        sys.exit(1)

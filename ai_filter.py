"""
TEN NEWS - AI FILTER (NEW 5-STEP SYSTEM)
Processes RSS articles with comprehensive AI workflow
Runs every 5 minutes

NEW 5-STEP SYSTEM:
- Step 1: Gemini scores all RSS articles (1000 → ~150 approved)
- Step 2: Jina fetches full text for approved articles only
- Step 3: Claude writes title + summary from full article text
- Step 4: Perplexity searches for contextual information
- Step 5: Claude formats timeline + details from context

FEATURES:
- Efficient filtering: Only process approved articles
- Resource optimization: Fetch full text only when needed
- Higher quality: Full article content for better AI processing
- Cost effective: Much cheaper than old system
- Scalable: Handles large RSS feeds efficiently
"""

import sqlite3
import time
import logging
from datetime import datetime
import json
import os
import requests
import google.generativeai as genai
from rss_sources import get_source_credibility
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Import new 5-step workflow components
from step1_gemini_news_scoring_filtering import score_news_articles_step1, process_large_rss_feed
from step2_jina_full_article_fetching import JinaArticleFetcher, fetch_articles_parallel
from step1_claude_title_summary import claude_write_title_summary
from step2_perplexity_context_search import search_perplexity_context
from step3_claude_format_timeline_details import claude_format_timeline_details

class AINewsFilter:
    def __init__(self):
        self.db_path = 'ten_news.db'
        self.batch_size = 30  # Process 30 articles at a time
        self.filter_interval = 300  # 5 minutes
        self.min_score = 700  # Minimum score to publish (0-1000 scale, must-know news only)
        
        # Parallel processing configuration
        self.parallel_workers = 10  # Score 10 articles simultaneously
        self.scoring_lock = threading.Lock()  # Thread-safe logging
        
        # API Configuration
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.perplexity_api_key = os.getenv('PERPLEXITY_API_KEY')
        
        # Initialize Gemini
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
        else:
            self.logger.warning("⚠️  Google API key not set")
        
        # Initialize Jina fetcher
        self.jina_fetcher = JinaArticleFetcher(timeout=10)
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        
        # Create console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        self.logger.info("🚀 AI News Filter initialized with NEW 5-STEP SYSTEM")
        self.logger.info("   Step 1: Gemini scores RSS articles")
        self.logger.info("   Step 2: Jina fetches full text")
        self.logger.info("   Step 3: Claude writes title + summary")
        self.logger.info("   Step 4: Perplexity searches context")
        self.logger.info("   Step 5: Claude formats timeline + details")

    def _get_db_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def _get_unprocessed_articles(self):
        """Get articles that haven't been AI processed yet"""
        conn = self._get_db_connection()
        conn.row_factory = sqlite3.Row  # Access columns by name
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM articles
            WHERE ai_processed = FALSE
            ORDER BY fetched_at DESC
            LIMIT ?
        ''', (self.batch_size * 3,))  # Get more than one batch
        
        articles = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return articles

    def _convert_db_articles_to_rss_format(self, db_articles):
        """
        Convert database articles to RSS format for Step 1 processing
        """
        rss_articles = []
        for article in db_articles:
            rss_article = {
                'title': article['title'],
                'source': article['source'],
                'text': article.get('description', ''),
                'url': article['url']
            }
            rss_articles.append(rss_article)
        return rss_articles

    def _process_batch_new_system(self, articles):
        """
        NEW 5-STEP SYSTEM: Process articles with complete workflow
        """
        self.logger.info(f"🔄 Processing batch of {len(articles)} articles with NEW 5-STEP SYSTEM...")
        
        # STEP 0: FILTER OUT ARTICLES WITHOUT IMAGES (before processing)
        articles_with_images = []
        rejected_no_image = 0
        
        for article in articles:
            if article.get('image_url') and article['image_url'].strip():
                articles_with_images.append(article)
            else:
                # Mark as processed but rejected (no image)
                self._mark_processed_only(article['id'], 0, 'no_image', 'No image URL - filtered before processing')
                rejected_no_image += 1
        
        if rejected_no_image > 0:
            self.logger.info(f"🖼️  Filtered out {rejected_no_image} articles without images")
        
        if not articles_with_images:
            self.logger.info(f"⚠️  No articles with images to process")
            return
        
        try:
            # Convert to RSS format for Step 1
            rss_articles = self._convert_db_articles_to_rss_format(articles_with_images)
            
            # STEP 1: Gemini Scoring
            self.logger.info(f"🔍 STEP 1: Gemini scoring {len(rss_articles)} articles...")
            step1_start = time.time()
            
            step1_results = score_news_articles_step1(rss_articles, self.google_api_key)
            approved_articles = step1_results['approved']
            
            step1_time = time.time() - step1_start
            self.logger.info(f"✅ Step 1 complete: {len(approved_articles)}/{len(rss_articles)} approved ({step1_results['approval_rate']:.1f}%)")
            self.logger.info(f"⏱️  Time: {step1_time:.1f}s")
            
            if not approved_articles:
                self.logger.info("❌ No articles approved - marking all as processed")
                for article in articles_with_images:
                    self._mark_processed_only(article['id'], 0, 'filtered', 'Not approved by Gemini scoring')
                return
            
            # STEP 2: Jina Fetching
            self.logger.info(f"📡 STEP 2: Jina fetching full text for {len(approved_articles)} articles...")
            step2_start = time.time()
            
            urls = [article['url'] for article in approved_articles]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Match full articles with scores and original DB data
            url_to_data = {article['url']: article for article in approved_articles}
            db_article_map = {article['url']: article for article in articles_with_images}
            
            processed_articles = []
            for full_article in full_articles:
                url = full_article['url']
                if url in url_to_data and url in db_article_map:
                    processed_article = {
                        'db_article': db_article_map[url],
                        'score': url_to_data[url]['score'],
                        'full_text': full_article['text'],
                        'title': full_article['title']
                    }
                    processed_articles.append(processed_article)
            
            step2_time = time.time() - step2_start
            self.logger.info(f"✅ Step 2 complete: {len(processed_articles)}/{len(approved_articles)} articles fetched")
            self.logger.info(f"⏱️  Time: {step2_time:.1f}s")
            
            if not processed_articles:
                self.logger.info("❌ No articles fetched - marking approved as processed")
                for article in approved_articles:
                    db_article = db_article_map.get(article['url'])
                    if db_article:
                        self._mark_processed_only(db_article['id'], article['score'], 'fetch_failed', 'Failed to fetch full text')
                return
            
            # STEP 3: Claude Title & Summary
            self.logger.info(f"✍️  STEP 3: Claude writing titles and summaries for {len(processed_articles)} articles...")
            step3_start = time.time()
            
            step3_results = []
            for i, article in enumerate(processed_articles):
                self.logger.info(f"  Processing {i+1}/{len(processed_articles)}: {article['title'][:50]}...")
                
                try:
                    claude_result = claude_write_title_summary({
                        'title': article['title'],
                        'description': article['full_text']
                    })
                    
                    step3_results.append({
                        'processed_article': article,
                        'claude_title': claude_result['title'],
                        'claude_detailed_text': claude_result['summary'],
                        'summary_bullets': claude_result.get('summary_bullets', [])
                    })
                    
                except Exception as e:
                    self.logger.error(f"    ❌ Step 3 error: {e}")
                    # Mark as processed but failed
                    self._mark_processed_only(article['db_article']['id'], article['score'], 'claude_error', f'Step 3 error: {e}')
                    continue
            
            step3_time = time.time() - step3_start
            self.logger.info(f"✅ Step 3 complete: {len(step3_results)}/{len(processed_articles)} articles processed")
            self.logger.info(f"⏱️  Time: {step3_time:.1f}s")
            
            if not step3_results:
                self.logger.info("❌ No articles processed in Step 3")
                return
            
            # STEP 4: Perplexity Context Search
            self.logger.info(f"🔍 STEP 4: Perplexity searching for context for {len(step3_results)} articles...")
            step4_start = time.time()
            
            step4_results = []
            for i, article in enumerate(step3_results):
                self.logger.info(f"  Searching context {i+1}/{len(step3_results)}: {article['claude_title'][:50]}...")
                
                try:
                    perplexity_result = search_perplexity_context(
                        article['claude_title'],
                        article['claude_detailed_text']
                    )
                    
                    step4_results.append({
                        'step3_data': article,
                        'perplexity_context': perplexity_result['results'],
                        'citations': perplexity_result.get('citations', [])
                    })
                    
                except Exception as e:
                    self.logger.error(f"    ❌ Step 4 error: {e}")
                    # Mark as processed but failed
                    db_article = article['processed_article']['db_article']
                    score = article['processed_article']['score']
                    self._mark_processed_only(db_article['id'], score, 'perplexity_error', f'Step 4 error: {e}')
                    continue
            
            step4_time = time.time() - step4_start
            self.logger.info(f"✅ Step 4 complete: {len(step4_results)}/{len(step3_results)} articles processed")
            self.logger.info(f"⏱️  Time: {step4_time:.1f}s")
            
            if not step4_results:
                self.logger.info("❌ No articles processed in Step 4")
                return
            
            # STEP 5: Claude Timeline & Details
            self.logger.info(f"📊 STEP 5: Claude formatting timeline and details for {len(step4_results)} articles...")
            step5_start = time.time()
            
            final_articles = []
            for i, article in enumerate(step4_results):
                self.logger.info(f"  Formatting {i+1}/{len(step4_results)}: {article['step3_data']['claude_title'][:50]}...")
                
                try:
                    timeline_details = claude_format_timeline_details(
                        article['step3_data']['claude_title'],
                        article['step3_data']['claude_detailed_text'],
                        article['perplexity_context']
                    )
                    
                    # Prepare final article data
                    db_article = article['step3_data']['processed_article']['db_article']
                    score = article['step3_data']['processed_article']['score']
                    
                    final_article = {
                        'db_article': db_article,
                        'score': score,
                        'title': article['step3_data']['claude_title'],
                        'detailed_text': article['step3_data']['claude_detailed_text'],
                        'summary_bullets': article['step3_data'].get('summary_bullets', []),
                        'timeline': timeline_details['timeline'],
                        'details': timeline_details['details'],
                        'citations': article['citations']
                    }
                    
                    final_articles.append(final_article)
                    
                except Exception as e:
                    self.logger.error(f"    ❌ Step 5 error: {e}")
                    # Mark as processed but failed
                    db_article = article['step3_data']['processed_article']['db_article']
                    score = article['step3_data']['processed_article']['score']
                    self._mark_processed_only(db_article['id'], score, 'claude_format_error', f'Step 5 error: {e}')
                    continue
            
            step5_time = time.time() - step5_start
            self.logger.info(f"✅ Step 5 complete: {len(final_articles)}/{len(step4_results)} articles processed")
            self.logger.info(f"⏱️  Time: {step5_time:.1f}s")
            
            # PUBLISH SUCCESSFUL ARTICLES
            if final_articles:
                self.logger.info(f"📝 Generating content for publication...")
                self._publish_articles(final_articles)
            
            # Calculate total time
            total_time = step1_time + step2_time + step3_time + step4_time + step5_time
            self.logger.info(f"🎉 5-STEP WORKFLOW COMPLETE!")
            self.logger.info(f"📊 Final statistics:")
            self.logger.info(f"   Input articles: {len(articles_with_images)}")
            self.logger.info(f"   Final articles: {len(final_articles)}")
            self.logger.info(f"   Success rate: {len(final_articles)/len(articles_with_images)*100:.1f}%")
            self.logger.info(f"   Total time: {total_time:.1f}s")
            
        except Exception as e:
            self.logger.error(f"❌ 5-step workflow error: {e}")
            # Mark all articles as processed but failed
            for article in articles_with_images:
                self._mark_processed_only(article['id'], 0, 'workflow_error', f'Workflow error: {e}')

    def _publish_articles(self, final_articles):
        """
        Publish successfully processed articles to database
        """
        for article in final_articles:
            db_article = article['db_article']
            
            # Convert timeline to JSON string
            timeline_json = json.dumps(article['timeline'])
            
            # Convert details to JSON string
            details_json = json.dumps(article['details'])
            
            # Convert citations to JSON string
            citations_json = json.dumps(article['citations'])
            
            # Update database
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Prepare summary bullets JSON
            summary_bullets_json = json.dumps(article.get('summary_bullets', []))
            
            cursor.execute('''
                UPDATE articles SET
                    ai_processed = TRUE,
                    ai_final_score = ?,
                    ai_category = 'must_know',
                    ai_reasoning = '5-step workflow: Gemini-Jina-Claude-Perplexity-Claude',
                    published = TRUE,
                    ai_title = ?,
                    article = ?,
                    summary_bullets = ?,
                    ai_timeline = ?,
                    ai_details = ?,
                    ai_citations = ?,
                    published_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                article['score'],
                article['title'],
                article['detailed_text'],
                summary_bullets_json,
                timeline_json,
                details_json,
                citations_json,
                db_article['id']
            ))
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"✅ Published: {article['title']}")
            self.logger.info(f"   Score: {article['score']}")
            self.logger.info(f"   Timeline: {len(article['timeline'])} events")
            self.logger.info(f"   Details: {len(article['details'])} items")

    def _mark_processed_only(self, article_id, score, category, reasoning):
        """Mark article as processed but NOT published"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE articles SET
                ai_processed = TRUE,
                ai_final_score = ?,
                ai_category = ?,
                ai_reasoning = ?,
                published = FALSE
            WHERE id = ?
        ''', (score, category, reasoning, article_id))
        
        conn.commit()
        conn.close()

    def run_cycle(self):
        """Run one complete AI processing cycle"""
        self.logger.info("=" * 60)
        self.logger.info(f"🤖 AI Filter cycle starting at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 60)
        
        # Get unprocessed articles
        articles = self._get_unprocessed_articles()
        
        if not articles:
            self.logger.info("ℹ️  No unprocessed articles found")
            return
        
        self.logger.info(f"📊 Processing {len(articles)} unprocessed articles")
        
        # Process in batches
        for i in range(0, len(articles), self.batch_size):
            batch = articles[i:i + self.batch_size]
            self._process_batch_new_system(batch)
        
        self.logger.info("✅ AI processing complete")

    def run_forever(self):
        """Run AI filter continuously"""
        self.logger.info("🚀 Starting AI News Filter with NEW 5-STEP SYSTEM")
        self.logger.info(f"⏰ Running every {self.filter_interval} seconds")
        
        while True:
            try:
                self.run_cycle()
            except Exception as e:
                self.logger.error(f"❌ Cycle error: {e}")
            
            self.logger.info(f"😴 Sleeping for {self.filter_interval}s ({self.filter_interval//60} minutes)...")
            time.sleep(self.filter_interval)

# Run if executed directly
if __name__ == '__main__':
    ai_filter = AINewsFilter()
    ai_filter.run_forever()

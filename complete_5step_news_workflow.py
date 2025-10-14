import os
import sys
import time
from typing import List, Dict, Optional

# Import all step implementations
from step1_gemini_news_scoring_filtering import score_news_articles_step1, process_large_rss_feed
from step2_jina_full_article_fetching import JinaArticleFetcher, fetch_articles_parallel
from step1_claude_title_summary import claude_write_title_summary
from step2_perplexity_context_search import search_perplexity_context
from step3_claude_format_timeline_details import claude_format_timeline_details

class CompleteNewsWorkflow:
    """
    Complete 5-step news generation workflow:
    1. Gemini scores RSS articles (1000 → ~150)
    2. Jina fetches full text for approved articles
    3. Claude writes title + summary
    4. Perplexity searches for context
    5. Claude formats timeline + details
    """
    
    def __init__(self):
        self.gemini_key = os.getenv('GOOGLE_API_KEY')
        self.claude_key = os.getenv('CLAUDE_API_KEY')
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')
        
        # Validate API keys
        if not self.gemini_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        if not self.claude_key:
            raise ValueError("CLAUDE_API_KEY environment variable not set")
        if not self.perplexity_key:
            print("⚠️  PERPLEXITY_API_KEY not set - will use mock data for Step 4")
        
        # Initialize components
        self.jina_fetcher = JinaArticleFetcher(timeout=10)
        
        print("🚀 Complete News Workflow initialized")
        print("=" * 60)
    
    def process_rss_feed(self, rss_articles: List[Dict], batch_size: int = 30) -> Dict:
        """
        Process complete RSS feed through all 5 steps
        
        Args:
            rss_articles: List of RSS articles with 'title', 'source', 'text', 'url'
            batch_size: Articles per Gemini batch (max 30)
        
        Returns:
            Dict with complete results and statistics
        """
        
        print(f"📰 PROCESSING RSS FEED: {len(rss_articles)} articles")
        print("=" * 60)
        
        start_time = time.time()
        results = {
            'input_count': len(rss_articles),
            'step1_results': None,
            'step2_results': None,
            'step3_results': None,
            'step4_results': None,
            'step5_results': None,
            'final_articles': [],
            'statistics': {},
            'errors': []
        }
        
        try:
            # STEP 1: Gemini Scoring
            print("\n🔍 STEP 1: Gemini scoring articles...")
            step1_start = time.time()
            
            if len(rss_articles) > batch_size:
                step1_results = process_large_rss_feed(rss_articles, self.gemini_key, batch_size)
            else:
                step1_results = score_news_articles_step1(rss_articles, self.gemini_key)
            
            results['step1_results'] = step1_results
            approved_articles = step1_results['approved']
            
            step1_time = time.time() - step1_start
            print(f"✅ Step 1 complete: {len(approved_articles)}/{len(rss_articles)} approved ({step1_results['approval_rate']:.1f}%)")
            print(f"⏱️  Time: {step1_time:.1f}s")
            
            if not approved_articles:
                print("❌ No articles approved - stopping workflow")
                return results
            
            # STEP 2: Jina Fetching
            print(f"\n📡 STEP 2: Jina fetching full text for {len(approved_articles)} articles...")
            step2_start = time.time()
            
            urls = [article['url'] for article in approved_articles]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Match full articles with scores
            url_to_score = {article['url']: article['score'] for article in approved_articles}
            for article in full_articles:
                article['score'] = url_to_score.get(article['url'], 0)
            
            results['step2_results'] = {
                'fetched_count': len(full_articles),
                'failed_count': len(approved_articles) - len(full_articles),
                'articles': full_articles
            }
            
            step2_time = time.time() - step2_start
            print(f"✅ Step 2 complete: {len(full_articles)}/{len(approved_articles)} articles fetched")
            print(f"⏱️  Time: {step2_time:.1f}s")
            
            if not full_articles:
                print("❌ No articles fetched - stopping workflow")
                return results
            
            # STEP 3: Claude Title & Summary
            print(f"\n✍️  STEP 3: Claude writing titles and summaries for {len(full_articles)} articles...")
            step3_start = time.time()
            
            step3_results = []
            for i, article in enumerate(full_articles):
                print(f"  Processing {i+1}/{len(full_articles)}: {article['title'][:50]}...")
                
                try:
                    claude_result = claude_write_title_summary({
                        'title': article['title'],
                        'description': article['text']
                    })
                    
                    step3_results.append({
                        'original_article': article,
                        'claude_title': claude_result['title'],
                        'claude_summary': claude_result['summary']
                    })
                    
                except Exception as e:
                    print(f"    ❌ Error: {e}")
                    results['errors'].append(f"Step 3 error for {article['url']}: {e}")
                    continue
            
            results['step3_results'] = {
                'processed_count': len(step3_results),
                'failed_count': len(full_articles) - len(step3_results),
                'articles': step3_results
            }
            
            step3_time = time.time() - step3_start
            print(f"✅ Step 3 complete: {len(step3_results)}/{len(full_articles)} articles processed")
            print(f"⏱️  Time: {step3_time:.1f}s")
            
            if not step3_results:
                print("❌ No articles processed - stopping workflow")
                return results
            
            # STEP 4: Perplexity Context Search
            print(f"\n🔍 STEP 4: Perplexity searching for context for {len(step3_results)} articles...")
            step4_start = time.time()
            
            step4_results = []
            for i, article in enumerate(step3_results):
                print(f"  Searching context {i+1}/{len(step3_results)}: {article['claude_title'][:50]}...")
                
                try:
                    perplexity_result = search_perplexity_context(
                        article['claude_title'],
                        article['claude_summary']
                    )
                    
                    step4_results.append({
                        'step3_data': article,
                        'perplexity_context': perplexity_result['results'],
                        'citations': perplexity_result.get('citations', [])
                    })
                    
                except Exception as e:
                    print(f"    ❌ Error: {e}")
                    results['errors'].append(f"Step 4 error for {article['original_article']['url']}: {e}")
                    continue
            
            results['step4_results'] = {
                'processed_count': len(step4_results),
                'failed_count': len(step3_results) - len(step4_results),
                'articles': step4_results
            }
            
            step4_time = time.time() - step4_start
            print(f"✅ Step 4 complete: {len(step4_results)}/{len(step3_results)} articles processed")
            print(f"⏱️  Time: {step4_time:.1f}s")
            
            if not step4_results:
                print("❌ No articles processed - stopping workflow")
                return results
            
            # STEP 5: Claude Timeline & Details
            print(f"\n📊 STEP 5: Claude formatting timeline and details for {len(step4_results)} articles...")
            step5_start = time.time()
            
            final_articles = []
            for i, article in enumerate(step4_results):
                print(f"  Formatting {i+1}/{len(step4_results)}: {article['step3_data']['claude_title'][:50]}...")
                
                try:
                    timeline_details = claude_format_timeline_details(
                        article['step3_data']['claude_title'],
                        article['step3_data']['claude_summary'],
                        article['perplexity_context']
                    )
                    
                    # Combine all data into final article
                    final_article = {
                        'url': article['step3_data']['original_article']['url'],
                        'original_title': article['step3_data']['original_article']['title'],
                        'score': article['step3_data']['original_article']['score'],
                        'title': article['step3_data']['claude_title'],
                        'summary': article['step3_data']['claude_summary'],
                        'timeline': timeline_details['timeline'],
                        'details': timeline_details['details'],
                        'citations': article['citations'],
                        'workflow': '5-step Gemini-Jina-Claude-Perplexity-Claude'
                    }
                    
                    final_articles.append(final_article)
                    
                except Exception as e:
                    print(f"    ❌ Error: {e}")
                    results['errors'].append(f"Step 5 error for {article['step3_data']['original_article']['url']}: {e}")
                    continue
            
            results['step5_results'] = {
                'processed_count': len(final_articles),
                'failed_count': len(step4_results) - len(final_articles),
                'articles': final_articles
            }
            
            step5_time = time.time() - step5_start
            print(f"✅ Step 5 complete: {len(final_articles)}/{len(step4_results)} articles processed")
            print(f"⏱️  Time: {step5_time:.1f}s")
            
            # Final results
            results['final_articles'] = final_articles
            
            # Calculate statistics
            total_time = time.time() - start_time
            results['statistics'] = {
                'total_time': total_time,
                'step_times': {
                    'step1': step1_time,
                    'step2': step2_time,
                    'step3': step3_time,
                    'step4': step4_time,
                    'step5': step5_time
                },
                'success_rate': len(final_articles) / len(rss_articles) * 100,
                'step_success_rates': {
                    'step1': step1_results['approval_rate'],
                    'step2': len(full_articles) / len(approved_articles) * 100,
                    'step3': len(step3_results) / len(full_articles) * 100,
                    'step4': len(step4_results) / len(step3_results) * 100,
                    'step5': len(final_articles) / len(step4_results) * 100
                }
            }
            
            print(f"\n🎉 WORKFLOW COMPLETE!")
            print("=" * 60)
            print(f"📊 FINAL STATISTICS:")
            print(f"   Input articles: {len(rss_articles)}")
            print(f"   Final articles: {len(final_articles)}")
            print(f"   Success rate: {results['statistics']['success_rate']:.1f}%")
            print(f"   Total time: {total_time:.1f}s")
            print(f"   Errors: {len(results['errors'])}")
            
            return results
            
        except Exception as e:
            print(f"❌ Workflow error: {e}")
            results['errors'].append(f"Workflow error: {e}")
            return results
    
    def display_results(self, results: Dict):
        """
        Display workflow results in a formatted way
        """
        if not results['final_articles']:
            print("❌ No articles processed successfully")
            return
        
        print(f"\n📰 FINAL NEWS ARTICLES ({len(results['final_articles'])} articles)")
        print("=" * 80)
        
        for i, article in enumerate(results['final_articles'], 1):
            print(f"\n{i}. {article['title']}")
            print(f"   Original: {article['original_title']}")
            print(f"   Score: {article['score']}")
            print(f"   URL: {article['url']}")
            
            print(f"\n   📄 Summary:")
            print(f"   {article['summary']}")
            
            print(f"\n   ⏰ Timeline:")
            for event in article['timeline']:
                print(f"   • {event['date']}: {event['event']}")
            
            print(f"\n   📊 Details:")
            for detail in article['details']:
                print(f"   • {detail}")
            
            if article['citations']:
                print(f"\n   🔗 Sources: {len(article['citations'])} citations")
            
            print(f"\n   {'-'*60}")
    
    def save_results(self, results: Dict, filename: str = None):
        """
        Save results to JSON file
        """
        if not filename:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"news_workflow_results_{timestamp}.json"
        
        import json
        
        # Convert to JSON-serializable format
        json_results = {
            'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"),
            'input_count': results['input_count'],
            'final_articles': results['final_articles'],
            'statistics': results['statistics'],
            'errors': results['errors']
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(json_results, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Results saved to: {filename}")


# Example usage and testing
if __name__ == "__main__":
    print("🧪 TESTING COMPLETE 5-STEP NEWS WORKFLOW")
    print("=" * 80)
    
    # Sample RSS articles for testing (using URLs that work with Jina)
    sample_rss_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.bbc.com/news"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://techcrunch.com/"
        },
        {
            "title": "Major tech company announces layoffs affecting 10,000 employees",
            "source": "Bloomberg",
            "text": "Tech giant announces significant workforce reduction due to economic pressures.",
            "url": "https://www.bbc.com/news"
        },
        {
            "title": "Celebrity couple announces divorce",
            "source": "Entertainment Weekly",
            "text": "Famous actor and actress announce separation after 5 years.",
            "url": "https://techcrunch.com/"
        },
        {
            "title": "Local bakery wins best pastry award",
            "source": "City News",
            "text": "Downtown bakery receives recognition for their croissants.",
            "url": "https://www.bbc.com/news"
        }
    ]
    
    try:
        # Initialize workflow
        workflow = CompleteNewsWorkflow()
        
        # Process articles
        results = workflow.process_rss_feed(sample_rss_articles)
        
        # Display results
        workflow.display_results(results)
        
        # Save results
        workflow.save_results(results)
        
        print(f"\n💰 COST ESTIMATION:")
        print(f"   Step 1 (Gemini scoring): ~$0.0001")
        print(f"   Step 2 (Jina fetching): $0 (free tier)")
        print(f"   Step 3 (Claude title/summary): ~$0.009")
        print(f"   Step 4 (Perplexity search): ~$0.001")
        print(f"   Step 5 (Claude timeline/details): ~$0.0135")
        print(f"   Total per article: ~$0.0236 (2.36 cents)")
        
    except Exception as e:
        print(f"❌ Error: {e}")

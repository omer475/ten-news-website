#!/usr/bin/env python3
"""
COMPLETE CLUSTERED NEWS WORKFLOW
==========================================
Today+ clustered news generation pipeline:
1. RSS Fetch (existing)
2. Step 1: Gemini scoring → approved articles
3. Step 1.5: Event clustering → group articles by event
4. Step 2: Jina fetching → full text for ALL cluster sources
5. Step 3: Multi-source synthesis → ONE article per cluster
6. Steps 4-6: Context search & component generation
7. Publish to Supabase
"""

import os
import sys
import time
from typing import List, Dict, Optional
from datetime import datetime

# Import all step implementations
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step1_5_event_clustering import EventClusteringEngine
from step2_jina_full_article_fetching import JinaArticleFetcher, fetch_articles_parallel
from step3_multi_source_synthesis import MultiSourceSynthesizer
from step2_perplexity_context_search import search_perplexity_context
from step3_gemini_component_selection import select_components
from step4_perplexity_dynamic_context_search import search_dynamic_context
from step6_claude_component_generation import ClaudeComponentWriter


class ClusteredNewsWorkflow:
    """
    Complete clustered news generation workflow with multi-source synthesis.
    
    Pipeline:
    1. Gemini scoring (1000 → ~150 articles)
    2. Event clustering (150 → ~30 clusters)
    3. Jina fetching (all sources per cluster)
    4. Multi-source synthesis (ONE article per cluster)
    5. Context search & components
    6. Publish
    """
    
    def __init__(self):
        """Initialize workflow with API keys and components"""
        # Get API keys
        self.gemini_key = os.getenv('GOOGLE_API_KEY')
        self.claude_key = os.getenv('ANTHROPIC_API_KEY')
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')
        
        # Validate required keys
        if not self.gemini_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        if not self.claude_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        if not self.perplexity_key:
            print("⚠️  PERPLEXITY_API_KEY not set - will use mock data for context")
        
        # Initialize components
        self.clustering_engine = EventClusteringEngine()
        self.jina_fetcher = JinaArticleFetcher(timeout=10)
        self.synthesizer = MultiSourceSynthesizer(self.claude_key)
        self.component_writer = ClaudeComponentWriter(self.claude_key)
        
        print("🚀 Clustered News Workflow initialized")
        print("=" * 60)
    
    def process_rss_feed(self, rss_articles: List[Dict], batch_size: int = 30) -> Dict:
        """
        Process complete RSS feed through clustered pipeline.
        
        Args:
            rss_articles: List of RSS articles with 'title', 'source', 'text', 'url'
            batch_size: Articles per Gemini batch (max 30)
            
        Returns:
            Dict with complete results and statistics
        """
        print(f"\n📰 PROCESSING RSS FEED: {len(rss_articles)} articles")
        print("=" * 60)
        
        start_time = time.time()
        results = {
            'input_count': len(rss_articles),
            'step1_results': None,
            'clustering_results': None,
            'step2_results': None,
            'step3_results': None,
            'step4_results': None,
            'step5_results': None,
            'step6_results': None,
            'final_articles': [],
            'statistics': {},
            'errors': []
        }
        
        try:
            # ==========================================
            # STEP 1: GEMINI SCORING
            # ==========================================
            print("\n🔍 STEP 1: Gemini scoring articles...")
            step1_start = time.time()
            
            step1_results = score_news_articles_step1(rss_articles, self.gemini_key)
            
            results['step1_results'] = step1_results
            approved_articles = step1_results['approved']
            
            step1_time = time.time() - step1_start
            print(f"✅ Step 1 complete: {len(approved_articles)}/{len(rss_articles)} approved ({step1_results['approval_rate']:.1f}%)")
            print(f"⏱️  Time: {step1_time:.1f}s")
            
            if not approved_articles:
                print("❌ No articles approved - stopping workflow")
                return results
            
            # ==========================================
            # STEP 1.5: EVENT CLUSTERING
            # ==========================================
            print("\n🔗 STEP 1.5: Event clustering...")
            clustering_start = time.time()
            
            clustering_results = self.clustering_engine.cluster_articles(approved_articles)
            results['clustering_results'] = clustering_results
            
            clustering_time = time.time() - clustering_start
            print(f"⏱️  Time: {clustering_time:.1f}s")
            
            # Get clusters ready for processing
            clusters = self.clustering_engine.get_clusters_for_processing()
            
            if not clusters:
                print("❌ No clusters created - stopping workflow")
                return results
            
            print(f"\n✅ Clustering complete: {len(approved_articles)} articles → {len(clusters)} clusters")
            
            # ==========================================
            # STEP 2: JINA FETCHING (ALL CLUSTER SOURCES)
            # ==========================================
            print(f"\n📡 STEP 2: Jina fetching full text for all cluster sources...")
            step2_start = time.time()
            
            # Collect all unique URLs from all clusters
            all_urls = set()
            for cluster in clusters:
                for source in cluster['sources']:
                    all_urls.add(source['url'])
            
            all_urls = list(all_urls)
            print(f"   Fetching {len(all_urls)} unique articles...")
            
            full_articles = fetch_articles_parallel(all_urls, max_workers=10)
            
            # Create URL-to-article mapping
            url_to_full_article = {article['url']: article for article in full_articles}
            
            # Enrich cluster sources with full text
            for cluster in clusters:
                for source in cluster['sources']:
                    if source['url'] in url_to_full_article:
                        full_article = url_to_full_article[source['url']]
                        source['content'] = full_article.get('text', full_article.get('content', ''))
                        source['full_text_fetched'] = True
                    else:
                        source['full_text_fetched'] = False
            
            step2_time = time.time() - step2_start
            print(f"✅ Step 2 complete: {len(full_articles)}/{len(all_urls)} articles fetched")
            print(f"⏱️  Time: {step2_time:.1f}s")
            
            results['step2_results'] = {
                'fetched_count': len(full_articles),
                'failed_count': len(all_urls) - len(full_articles),
                'articles': full_articles
            }
            
            # ==========================================
            # STEP 3: MULTI-SOURCE SYNTHESIS
            # ==========================================
            print(f"\n✍️  STEP 3: Multi-source synthesis (one article per cluster)...")
            step3_start = time.time()
            
            synthesized_articles = self.synthesizer.synthesize_all_clusters(clusters)
            
            step3_time = time.time() - step3_start
            print(f"⏱️  Time: {step3_time:.1f}s")
            
            if not synthesized_articles:
                print("❌ No articles synthesized - stopping workflow")
                return results
            
            results['step3_results'] = {
                'processed_count': len(synthesized_articles),
                'failed_count': len(clusters) - len(synthesized_articles),
                'articles': synthesized_articles
            }
            
            # ==========================================
            # STEP 4: COMPONENT SELECTION
            # ==========================================
            print(f"\n🎯 STEP 4: Component selection (which components to generate)...")
            step4_start = time.time()
            
            for i, article in enumerate(synthesized_articles):
                try:
                    # Select components (timeline, details, graph, map)
                    components = select_components({
                        'title': article['title_news'],
                        'content': article['content_news']
                    })
                    
                    article['components'] = components.get('selected_components', [])
                    
                except Exception as e:
                    print(f"  ⚠️ Component selection error: {e}")
                    article['components'] = []
            
            step4_time = time.time() - step4_start
            print(f"✅ Step 4 complete")
            print(f"⏱️  Time: {step4_time:.1f}s")
            
            # ==========================================
            # STEP 5: PERPLEXITY CONTEXT SEARCH
            # ==========================================
            print(f"\n🔍 STEP 5: Perplexity context search for selected components...")
            step5_start = time.time()
            
            for i, article in enumerate(synthesized_articles):
                if not article.get('components'):
                    continue
                
                try:
                    # Search context for selected components
                    context_data = search_dynamic_context(
                        article['title_news'],
                        article['content_news'],
                        article['components']
                    )
                    
                    article['context_data'] = context_data
                    
                except Exception as e:
                    print(f"  ⚠️ Context search error: {e}")
                    article['context_data'] = {}
            
            step5_time = time.time() - step5_start
            print(f"✅ Step 5 complete")
            print(f"⏱️  Time: {step5_time:.1f}s")
            
            # ==========================================
            # STEP 6: COMPONENT GENERATION
            # ==========================================
            print(f"\n📊 STEP 6: Claude component generation...")
            step6_start = time.time()
            
            final_articles = self.component_writer.write_all_articles(synthesized_articles)
            
            step6_time = time.time() - step6_start
            print(f"⏱️  Time: {step6_time:.1f}s")
            
            results['step6_results'] = {
                'processed_count': len(final_articles),
                'articles': final_articles
            }
            
            results['final_articles'] = final_articles
            
            # ==========================================
            # STATISTICS
            # ==========================================
            total_time = time.time() - start_time
            results['statistics'] = {
                'total_time': total_time,
                'step_times': {
                    'step1': step1_time,
                    'clustering': clustering_time,
                    'step2': step2_time,
                    'step3': step3_time,
                    'step4': step4_time,
                    'step5': step5_time,
                    'step6': step6_time
                },
                'input_articles': len(rss_articles),
                'approved_articles': len(approved_articles),
                'clusters_created': len(clusters),
                'final_articles': len(final_articles),
                'cost_reduction': ((1 - len(clusters) / max(len(approved_articles), 1)) * 100)
            }
            
            print(f"\n🎉 WORKFLOW COMPLETE!")
            print("=" * 60)
            print(f"📊 FINAL STATISTICS:")
            print(f"   Input articles: {len(rss_articles)}")
            print(f"   Approved articles: {len(approved_articles)}")
            print(f"   Clusters created: {len(clusters)}")
            print(f"   Final articles: {len(final_articles)}")
            print(f"   Total time: {total_time:.1f}s")
            print(f"   💰 Cost reduction: {results['statistics']['cost_reduction']:.1f}% (clustering efficiency)")
            print(f"   Errors: {len(results['errors'])}")
            
            return results
            
        except Exception as e:
            print(f"❌ Workflow error: {e}")
            import traceback
            traceback.print_exc()
            results['errors'].append(f"Workflow error: {e}")
            return results
    
    def display_results(self, results: Dict):
        """
        Display workflow results in a formatted way.
        """
        if not results['final_articles']:
            print("❌ No articles processed successfully")
            return
        
        print(f"\n📰 FINAL SYNTHESIZED ARTICLES ({len(results['final_articles'])} articles)")
        print("=" * 80)
        
        for i, article in enumerate(results['final_articles'], 1):
            print(f"\n{i}. {article['title_news']}")
            print(f"   B2 Title: {article['title_b2']}")
            print(f"   Event: {article['event_name']}")
            print(f"   Sources: {article['source_count']}")
            print(f"   Importance: {article['importance_score']}/1000")
            
            print(f"\n   📄 Content (News) - {len(article['content_news'].split())} words:")
            print(f"   {article['content_news'][:200]}...")
            
            print(f"\n   📄 Bullets (News):")
            for bullet in article['summary_bullets_news']:
                print(f"   • {bullet}")
            
            if article.get('timeline'):
                print(f"\n   ⏰ Timeline:")
                for event in article['timeline']:
                    print(f"   • {event['date']}: {event['event']}")
            
            if article.get('details'):
                print(f"\n   📊 Details:")
                for detail in article['details']:
                    print(f"   • {detail}")
            
            print(f"\n   🔗 Source Articles:")
            for source in article.get('sources', [])[:5]:  # Show first 5
                print(f"   - {source['source_name']}: {source['title'][:50]}...")
            
            print(f"\n   {'-'*60}")
    
    def save_results(self, results: Dict, filename: str = None):
        """
        Save results to JSON file.
        """
        if not filename:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"clustered_news_results_{timestamp}.json"
        
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


# ==========================================
# MAIN ENTRY POINT
# ==========================================

if __name__ == "__main__":
    from dotenv import load_dotenv
    
    load_dotenv()
    
    print("🧪 TESTING CLUSTERED NEWS WORKFLOW")
    print("=" * 80)
    
    # Sample RSS articles for testing
    sample_rss_articles = [
        {
            "title": "Turkey Earthquake Death Toll Rises to 50",
            "source": "BBC News",
            "text": "A powerful earthquake struck Turkey, killing at least 50 people.",
            "url": "https://www.bbc.com/news/turkey-quake-1",
            "published_date": datetime.utcnow().isoformat()
        },
        {
            "title": "Earthquake Strikes Turkey, Dozens Dead",
            "source": "CNN",
            "text": "An earthquake devastated Turkey on Monday, leaving dozens dead.",
            "url": "https://www.cnn.com/turkey-earthquake-1",
            "published_date": datetime.utcnow().isoformat()
        },
        {
            "title": "Turkey Quake Leaves 50 Dead, Hundreds Injured",
            "source": "Reuters",
            "text": "Turkey was hit by a powerful earthquake, officials report 50 deaths.",
            "url": "https://www.reuters.com/turkey-quake-1",
            "published_date": datetime.utcnow().isoformat()
        },
        {
            "title": "European Central Bank Raises Interest Rates to 4.5%",
            "source": "Bloomberg",
            "text": "The ECB announced Thursday it is raising rates to combat inflation.",
            "url": "https://www.bloomberg.com/ecb-rates-1",
            "published_date": datetime.utcnow().isoformat()
        },
        {
            "title": "ECB Hikes Rates to 4.5 Percent",
            "source": "Financial Times",
            "text": "European Central Bank increased interest rates to 4.5%.",
            "url": "https://www.ft.com/ecb-rates-1",
            "published_date": datetime.utcnow().isoformat()
        }
    ]
    
    try:
        # Initialize workflow
        workflow = ClusteredNewsWorkflow()
        
        # Process articles
        results = workflow.process_rss_feed(sample_rss_articles)
        
        # Display results
        workflow.display_results(results)
        
        # Save results
        workflow.save_results(results)
        
        print(f"\n💰 COST COMPARISON:")
        print(f"   Old System (individual articles): {len(results['step1_results']['approved'])} × $0.02 = ${len(results['step1_results']['approved']) * 0.02:.2f}")
        print(f"   New System (clustered): {len(results['clustering_results'].get('clusters', []))} × $0.02 = ${len(results['clustering_results'].get('clusters', [])) * 0.02:.2f}")
        print(f"   Savings: {results['statistics'].get('cost_reduction', 0):.1f}%")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()


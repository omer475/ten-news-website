"""
LIVE NEWS GENERATION WITH CLUSTERING
====================================
This script runs continuously and:
1. Fetches RSS articles every 10 minutes
2. Scores and filters them
3. Clusters similar articles
4. Synthesizes multi-source articles with Claude
5. Publishes to Supabase

Press Ctrl+C to stop
"""

import time
from datetime import datetime
import feedparser
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from rss_sources import ALL_SOURCES
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step1_5_event_clustering import EventClusteringEngine
from step3_multi_source_synthesis import MultiSourceSynthesizer
from supabase import create_client
import os
from dotenv import load_dotenv
import warnings
import urllib3

# Suppress SSL warnings (many RSS sources have certificate issues)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Load environment variables
load_dotenv()

def get_supabase_client():
    """Initialize Supabase client"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file")
    
    return create_client(url, key)

# Initialize clients
supabase = get_supabase_client()
clustering_engine = EventClusteringEngine()

# Get API keys
anthropic_key = os.getenv('ANTHROPIC_API_KEY')
gemini_key = os.getenv('GEMINI_API_KEY')

if not anthropic_key:
    raise ValueError("ANTHROPIC_API_KEY must be set in .env file")
if not gemini_key:
    raise ValueError("GEMINI_API_KEY must be set in .env file")

synthesizer = MultiSourceSynthesizer(api_key=anthropic_key)

def fetch_rss_articles(max_articles_per_source=10):
    """Fetch NEW articles from all RSS sources in parallel (skips already-seen articles)"""
    print(f"\n📡 Fetching from {len(ALL_SOURCES)} RSS sources...")
    
    articles = []
    
    def normalize_url(url):
        """Simple URL normalization for duplicate detection"""
        from urllib.parse import urlparse, parse_qs, urlunparse
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')
        tracking_params = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'ref', 'source', 'fbclid', 'gclid', '_ga', 'mc_cid', 'mc_eid'
        ]
        query_params = parse_qs(parsed.query)
        clean_params = {k: v for k, v in query_params.items() if k not in tracking_params}
        clean_query = '&'.join([f"{k}={v[0]}" for k, v in clean_params.items()])
        normalized = urlunparse((parsed.scheme, domain, parsed.path, parsed.params, clean_query, ''))
        return normalized
    
    def fetch_one_source(source_name, url):
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, timeout=10, headers=headers, verify=False)
            feed = feedparser.parse(response.content)
            
            new_count = 0
            for entry in feed.entries[:max_articles_per_source]:
                article_url = entry.get('link', '')
                if not article_url:
                    continue
                
                # Check if we already have this article (by normalized URL)
                normalized = normalize_url(article_url)
                
                # Quick check against Supabase source_articles table
                try:
                    existing = supabase.table('source_articles')\
                        .select('id')\
                        .eq('normalized_url', normalized)\
                        .limit(1)\
                        .execute()
                    
                    if existing.data:
                        # Already have this article - stop processing this source
                        # (RSS feeds are ordered newest first, so older articles follow)
                        break
                except:
                    pass  # If check fails, continue processing
                
                # New article!
                articles.append({
                    'url': article_url,
                    'title': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'source': source_name,
                    'published_date': entry.get('published', '')
                })
                new_count += 1
            
            if new_count > 0:
                return f"✅ {source_name}: {new_count} new articles"
            else:
                return f"   {source_name}: 0 new (all seen before)"
        except Exception as e:
            return f"❌ {source_name}: {str(e)[:50]}"
    
    # Parallel fetch with 30 workers
    with ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(fetch_one_source, name, url) for name, url in ALL_SOURCES]
        for future in as_completed(futures):
            result = future.result()
            if result.startswith("✅"):
                print(result)
    
    print(f"📰 Total NEW articles fetched: {len(articles)}")
    return articles

def save_published_article(article_data):
    """Save synthesized article to published_articles table"""
    try:
        result = supabase.table('published_articles').insert({
            'cluster_id': article_data['cluster_id'],
            'title': article_data['title'],
            'content_news': article_data['content_news'],
            'content_b2': article_data['content_b2'],
            'summary': article_data['summary'],
            'keywords': article_data['keywords'],
            'num_sources': article_data['num_sources'],
            'category': article_data['category'],
            'published_at': datetime.now().isoformat()
        }).execute()
        return True
    except Exception as e:
        print(f"❌ Error saving article: {e}")
        return False

def run_pipeline_cycle():
    """Run one complete pipeline cycle"""
    
    print("\n" + "="*80)
    print(f"🚀 STARTING NEW CYCLE - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Step 1: Fetch RSS articles
    print("\n📡 Step 1: Fetching RSS articles...")
    articles = fetch_rss_articles(max_articles_per_source=10)
    
    if not articles:
        print("⚠️  No articles fetched. Waiting for next cycle...")
        return
    
    # Step 2: Score and filter with Gemini
    print(f"\n🎯 Step 2: Scoring {len(articles)} articles with Gemini...")
    scoring_result = score_news_articles_step1(articles, gemini_key)
    
    # Get approved articles (already filtered by Gemini)
    high_score_articles = scoring_result.get('approved', [])
    filtered_count = len(scoring_result.get('filtered', []))
    print(f"✅ {len(high_score_articles)} articles approved, {filtered_count} filtered")
    
    if not high_score_articles:
        print("⚠️  No high-scoring articles. Waiting for next cycle...")
        return
    
    # Step 3: Cluster articles
    print(f"\n🔗 Step 3: Clustering {len(high_score_articles)} articles...")
    clustering_result = clustering_engine.process_articles(high_score_articles)
    
    print(f"   📊 Clusters: {clustering_result['new_clusters_created']} new, "
          f"{clustering_result['matched_to_existing']} matched")
    
    # Step 4: Get clusters ready for synthesis
    print(f"\n✍️  Step 4: Synthesizing multi-source articles...")
    
    # Get clusters with 2+ sources that don't have published articles yet
    clusters = supabase.table('clusters').select('*').eq('status', 'active').execute()
    
    synthesized_count = 0
    for cluster in clusters.data:
        # Check if already published
        existing = supabase.table('published_articles')\
            .select('id')\
            .eq('cluster_id', cluster['id'])\
            .execute()
        
        if existing.data:
            continue  # Skip if already published
        
        # Get source articles for this cluster
        sources = supabase.table('source_articles')\
            .select('*')\
            .eq('cluster_id', cluster['id'])\
            .execute()
        
        if len(sources.data) < 2:
            continue  # Need at least 2 sources
        
        # Synthesize article
        print(f"   📝 Synthesizing: {cluster['title']} ({len(sources.data)} sources)")
        
        try:
            synthesized = synthesizer.synthesize_article(cluster['id'])
            
            if synthesized and save_published_article(synthesized):
                synthesized_count += 1
                print(f"   ✅ Published: {synthesized['title'][:60]}...")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print(f"\n📊 Cycle Summary:")
    print(f"   Articles fetched: {len(articles)}")
    print(f"   Approved by Gemini: {len(high_score_articles)}")
    print(f"   Clusters: {clustering_result['new_clusters_created']} new, "
          f"{clustering_result['matched_to_existing']} matched")
    print(f"   Published: {synthesized_count} articles")

def main():
    """Main loop - runs forever"""
    
    print("\n" + "="*80)
    print("🚀 LIVE NEWS GENERATION WITH CLUSTERING")
    print("="*80)
    print("\nThis will run continuously:")
    print("  1. Fetch RSS articles every 10 minutes")
    print("  2. Score with Gemini")
    print("  3. Cluster similar articles")
    print("  4. Synthesize with Claude")
    print("  5. Publish to Supabase")
    print("\nPress Ctrl+C to stop")
    print("="*80)
    
    cycle_count = 0
    
    while True:
        try:
            cycle_count += 1
            
            run_pipeline_cycle()
            
            # Wait 10 minutes before next cycle
            print(f"\n😴 Sleeping 10 minutes until next cycle...")
            time.sleep(600)
            
        except KeyboardInterrupt:
            print("\n\n🛑 Stopped by user")
            break
        except Exception as e:
            print(f"\n❌ Error in cycle {cycle_count}: {e}")
            print("   Waiting 1 minute before retry...")
            time.sleep(60)
    
    print("\n✅ Live system stopped")

if __name__ == '__main__':
    main()


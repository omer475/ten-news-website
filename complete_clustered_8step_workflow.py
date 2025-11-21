"""
COMPLETE 8-STEP NEWS WORKFLOW WITH CLUSTERING
==============================================

Step 0: RSS Feed Collection (171 sources)
Step 1: Gemini Scoring & Filtering (score ≥70)
Step 1.5: Event Clustering (clusters similar articles)
Step 2: Jina Full Article Fetching (all sources in cluster)
Step 3: Smart Image Selection (selects best image from sources)
Step 4: Multi-Source Synthesis with Claude (generates article from all sources)
Step 5: Component Selection & Perplexity Search (decides which components + fetches data)
Steps 6-7: Claude Component Generation (timeline, details, graph)
Step 8: Publishing to Supabase
"""

import time
from datetime import datetime
import feedparser
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv
import warnings
import urllib3

# Import all pipeline components
from rss_sources import ALL_SOURCES
from step1_gemini_news_scoring_filtering import score_news_articles_step1
from step1_5_event_clustering import EventClusteringEngine
from step2_jina_full_article_fetching import JinaArticleFetcher, fetch_articles_parallel
from step3_image_selection import select_best_image_for_cluster
from step4_multi_source_synthesis import MultiSourceSynthesizer
from step5_gemini_component_selection import GeminiComponentSelector
from step2_perplexity_context_search import search_perplexity_context
from step6_7_claude_component_generation import ClaudeComponentWriter
from supabase import create_client

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Load environment
load_dotenv()

# Initialize clients
def get_supabase_client():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)

supabase = get_supabase_client()
clustering_engine = EventClusteringEngine()
jina_fetcher = JinaArticleFetcher()

# Get API keys
gemini_key = os.getenv('GEMINI_API_KEY')
anthropic_key = os.getenv('ANTHROPIC_API_KEY')
perplexity_key = os.getenv('PERPLEXITY_API_KEY')
scrapingbee_key = os.getenv('SCRAPINGBEE_API_KEY')

if not all([gemini_key, anthropic_key, perplexity_key]):
    raise ValueError("Missing required API keys in .env file")

component_selector = GeminiComponentSelector(api_key=gemini_key)
component_writer = ClaudeComponentWriter(api_key=anthropic_key)


# ==========================================
# STEP 0: RSS FEED COLLECTION
# ==========================================

def normalize_url(url):
    """Normalize URL for duplicate detection"""
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

def fetch_rss_articles(max_articles_per_source=10):
    """Step 0: Fetch NEW articles from 171 RSS sources with deduplication"""
    from article_deduplication import get_new_articles_only, mark_article_as_processed
    
    print(f"\n{'='*80}")
    print(f"📡 STEP 0: RSS FEED COLLECTION")
    print(f"{'='*80}")
    print(f"Fetching from {len(ALL_SOURCES)} premium sources...")
    
    all_fetched_articles = []
    source_counts = {}
    
    def fetch_one_source(source_name, url):
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(url, timeout=10, headers=headers, verify=False)
            feed = feedparser.parse(response.content)
            
            source_articles = []
            for entry in feed.entries[:max_articles_per_source]:
                article_url = entry.get('link', '')
                if not article_url:
                    continue
                
                # Handle published date properly
                published_date = entry.get('published', None)
                if published_date == '':
                    published_date = None
                
                # Extract image URL from RSS entry
                image_url = None
                
                # Try media:content (most common in news RSS)
                if hasattr(entry, 'media_content') and entry.media_content:
                    image_url = entry.media_content[0].get('url')
                
                # Try media:thumbnail
                elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                    image_url = entry.media_thumbnail[0].get('url')
                
                # Try enclosures (some news sites use this)
                elif hasattr(entry, 'enclosures') and entry.enclosures:
                    for enclosure in entry.enclosures:
                        if enclosure.get('type', '').startswith('image/'):
                            image_url = enclosure.get('href')
                            break
                
                # Try links array
                elif hasattr(entry, 'links'):
                    for link in entry.links:
                        if link.get('type', '').startswith('image/') or link.get('rel') == 'enclosure':
                            image_url = link.get('href')
                            break
                
                source_articles.append({
                    'url': article_url,
                    'title': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'source': source_name,
                    'published_date': published_date,
                    'image_url': image_url
                })
            
            return (source_name, source_articles)
        except Exception as e:
            return (source_name, [])
    
    # Parallel fetch from all sources
    with ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(fetch_one_source, name, url) for name, url in ALL_SOURCES]
        for future in as_completed(futures):
            source_name, source_articles = future.result()
            if source_articles:
                all_fetched_articles.extend(source_articles)
                source_counts[source_name] = len(source_articles)
    
    print(f"\n📊 Fetched {len(all_fetched_articles)} articles from {len(source_counts)} sources")
    
    # Apply deduplication (time-based + database check)
    # Use 24-hour window to catch articles when system is offline for extended periods
    new_articles = get_new_articles_only(all_fetched_articles, supabase, time_window=1440)  # 24 hours
    
    # Mark new articles as processed
    for article in new_articles:
        mark_article_as_processed(article, supabase)
    
    # Show which sources had new articles
    new_by_source = {}
    for article in new_articles:
        source = article.get('source', 'Unknown')
        new_by_source[source] = new_by_source.get(source, 0) + 1
    
    for source_name, count in sorted(new_by_source.items()):
                print(f"✅ {source_name}: {count} new")
    
    print(f"\n✅ Step 0 Complete: {len(new_articles)} NEW articles (after deduplication)")
    return new_articles


# ==========================================
# COMPLETE PIPELINE
# ==========================================

def run_complete_pipeline():
    """Run the complete 7-step clustered news workflow"""
    
    print("\n" + "="*80)
    print("🚀 COMPLETE 8-STEP CLUSTERED NEWS WORKFLOW")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # STEP 0: RSS Feed Collection
    articles = fetch_rss_articles()
    if not articles:
        print("⚠️  No new articles - ending cycle")
        return
    
    # STEP 1: Gemini Scoring & Filtering
    print(f"\n{'='*80}")
    print(f"🎯 STEP 1: GEMINI SCORING & FILTERING")
    print(f"{'='*80}")
    print(f"Scoring {len(articles)} articles...")
    
    scoring_result = score_news_articles_step1(articles, gemini_key)
    approved_articles = scoring_result.get('approved', [])
    filtered_count = len(scoring_result.get('filtered', []))
    
    print(f"\n✅ Step 1 Complete: {len(approved_articles)} approved, {filtered_count} filtered")
    
    if not approved_articles:
        print("⚠️  No articles approved - ending cycle")
        return
    
    # STEP 1.5: Event Clustering
    print(f"\n{'='*80}")
    print(f"🔗 STEP 1.5: EVENT CLUSTERING (NEW)")
    print(f"{'='*80}")
    print(f"Clustering {len(approved_articles)} articles...")
    
    clustering_result = clustering_engine.cluster_articles(approved_articles)
    
    print(f"\n✅ Step 1.5 Complete:")
    print(f"   📊 New clusters: {clustering_result['new_clusters_created']}")
    print(f"   🔗 Matched existing: {clustering_result['matched_to_existing']}")
    if clustering_result.get('failed', 0) > 0:
        print(f"   ⚠️  Failed: {clustering_result['failed']}")
    
    # ONLY process NEW/UPDATED clusters from THIS cycle (not old ones)
    clusters_to_process = []
    
    # Get cluster IDs that were created or updated in Step 1.5
    affected_cluster_ids = clustering_result.get('cluster_ids', [])
    
    if not affected_cluster_ids:
        print(f"   🎯 No clusters to process this cycle")
        print("⚠️  No new clusters created - ending cycle")
        return
    
    # For each affected cluster, check if it's ready (not yet published)
    for cluster_id in affected_cluster_ids:
        # Check if already published
        existing = supabase.table('published_articles')\
            .select('id')\
            .eq('cluster_id', cluster_id)\
            .execute()
        
        if existing.data:
            continue  # Already published
        
        # Get source count
        sources = supabase.table('source_articles')\
            .select('id')\
            .eq('cluster_id', cluster_id)\
            .execute()
        
        # Process clusters with 1+ sources (single-source articles are now allowed)
        if len(sources.data) >= 1:
            clusters_to_process.append(cluster_id)
    
    print(f"   🎯 Clusters ready for processing: {len(clusters_to_process)} (NEW this cycle)")
    
    if not clusters_to_process:
        print("⚠️  No clusters ready - ending cycle")
        return
    
    # Process each cluster through Steps 2-7
    published_count = 0
    
    for cluster_id in clusters_to_process:
        try:
            print(f"\n{'='*80}")
            print(f"📰 PROCESSING CLUSTER {cluster_id}")
            print(f"{'='*80}")
            
            # Get cluster metadata
            cluster_result = supabase.table('clusters')\
                .select('*')\
                .eq('id', cluster_id)\
                .execute()
            
            cluster = cluster_result.data[0] if cluster_result.data else {}
            
            # Get all source articles in this cluster
            sources = supabase.table('source_articles')\
                .select('*')\
                .eq('cluster_id', cluster_id)\
                .execute()
            
            cluster_sources = sources.data
            print(f"   Sources in cluster: {len(cluster_sources)}")
            
            # STEP 2: ScrapingBee Full Article Fetching (all sources)
            print(f"\n📡 STEP 2: SCRAPINGBEE FULL ARTICLE FETCHING")
            print(f"   Fetching full text for {len(cluster_sources)} sources...")
            
            urls = [s['url'] for s in cluster_sources]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Add full text back to sources
            url_to_text = {a['url']: a.get('text', '') for a in full_articles if a.get('text')}
            for source in cluster_sources:
                source['full_text'] = url_to_text.get(source['url'], source.get('content', ''))
            
            success_count = len([s for s in cluster_sources if s.get('full_text')])
            print(f"   ✅ Fetched full text: {success_count}/{len(cluster_sources)}")
            
            # STEP 3: Smart Image Selection
            print(f"\n📸 STEP 3: SMART IMAGE SELECTION")
            print(f"   Selecting best image from {len(cluster_sources)} sources...")
            
            # DEBUG: Check if sources have image_url field
            for i, src in enumerate(cluster_sources[:2], 1):  # Check first 2 sources
                img_url = src.get('image_url')
                print(f"   🔍 DEBUG Source {i}: image_url = {img_url[:50] if img_url else 'NONE'}...")
            
            selected_image = select_best_image_for_cluster(cluster_sources, cluster.get('event_name', ''))
            
            if selected_image:
                print(f"   ✅ Selected: {selected_image['source_name']} (score: {selected_image['quality_score']:.1f})")
            else:
                print(f"   ⚠️  No suitable image found")
            
            print(f"\n✍️  STEP 4: MULTI-SOURCE SYNTHESIS")
            print(f"   Synthesizing article from {len(cluster_sources)} sources...")
            
            synthesized = synthesize_multisource_article(cluster_sources, cluster_id)
            
            if not synthesized:
                print(f"   ❌ Synthesis failed - skipping cluster")
                continue
            
            # Add image data to synthesized article
            if selected_image:
                synthesized['image_url'] = selected_image['url']
                synthesized['image_source'] = selected_image['source_name']
                synthesized['image_score'] = selected_image['quality_score']
            else:
                synthesized['image_url'] = None
                synthesized['image_source'] = None
                synthesized['image_score'] = 0
            
            print(f"   ✅ Synthesized: {synthesized['title_news'][:60]}...")
            
            # STEP 5: Component Selection & Perplexity Search
            print(f"\n🔍 STEP 5: COMPONENT SELECTION & PERPLEXITY SEARCH")
            
            # Select components based on synthesized title + full content
            article_for_selection = {
                'title': synthesized['title_news'],
                'text': synthesized['content_news']  # Full 200-word article from Claude
            }
            
            component_result = component_selector.select_components(article_for_selection)
            selected = component_result.get('components', [])  # Fixed: was 'selected_components'
            print(f"   Selected components: {', '.join(selected) if selected else 'none'}")
            
            context_data = {}
            if selected and perplexity_key:
                # Get context using title and summary
                perplexity_result = search_perplexity_context(
                    synthesized['title_news'], 
                    synthesized['content_news'][:500]  # Use first 500 chars as summary
                )
                # Use same context for all selected components
                for component in selected:
                    context_data[component] = perplexity_result
                print(f"   ✅ Context fetched for {len(context_data)} components")
            
            # STEP 5 & 6: Generate components with Claude
            print(f"\n📊 STEPS 6-7: COMPONENT GENERATION")
            
            components = {}
            if selected and context_data:
                article_for_components = {
                    'title_news': synthesized['title_news'],
                    'selected_components': selected,
                    'context_data': context_data
                }
                component_result = component_writer.write_components(article_for_components)
                if component_result:
                    # Extract individual components from result
                    components = {
                        'timeline': component_result.get('timeline'),
                        'details': component_result.get('details'),
                        'graph': component_result.get('graph')
                    }
                    # Remove None values
                    components = {k: v for k, v in components.items() if v is not None}
                    print(f"   ✅ Generated: {', '.join(components.keys())}")
            
            # STEP 8: Publishing to Supabase
            print(f"\n💾 STEP 8: PUBLISHING TO SUPABASE")
            
            # Calculate article importance score (0-1000)
            # Based on average source score + bonus for multi-source coverage
            source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
            avg_score = sum(source_scores) / len(source_scores) if source_scores else 500
            
            # Bonus for multi-source articles (up to +100 points)
            source_bonus = min(len(cluster_sources) * 10, 100)
            
            article_score = int(min(avg_score + source_bonus, 1000))
            print(f"   📊 Article score: {article_score}/1000 (avg: {int(avg_score)}, sources: {len(cluster_sources)})")
            
            article_data = {
                'cluster_id': cluster_id,
                'url': cluster_sources[0]['url'],  # Primary source URL
                'source': cluster_sources[0]['source_name'],
                'category': synthesized.get('category', 'Other'),
                'title_news': synthesized['title_news'],
                'title_b2': synthesized['title_b2'],
                'content_news': synthesized['content_news'],
                'content_b2': synthesized['content_b2'],
                'summary_bullets_news': synthesized.get('summary_bullets_news', []),
                'summary_bullets_b2': synthesized.get('summary_bullets_b2', []),
                'timeline': components.get('timeline'),
                'details': components.get('details'),
                'graph': components.get('graph'),
                'components_order': selected,
                'num_sources': len(cluster_sources),
                'published_at': datetime.now().isoformat(),
                'ai_final_score': article_score,  # Importance score for sorting (0-1000)
                # Image data from Step 3
                'image_url': synthesized.get('image_url'),
                'image_source': synthesized.get('image_source'),
                'image_score': synthesized.get('image_score')
            }
            
            result = supabase.table('published_articles').insert(article_data).execute()
            
            print(f"   ✅ Published article ID: {result.data[0]['id']}")
            published_count += 1
            
        except Exception as e:
            print(f"   ❌ Error processing cluster {cluster_id}: {e}")
            continue
    
    # Summary
    print(f"\n{'='*80}")
    print(f"✅ PIPELINE COMPLETE")
    print(f"{'='*80}")
    print(f"   Articles fetched: {len(articles)}")
    print(f"   Approved by Gemini: {len(approved_articles)}")
    print(f"   Clusters processed: {len(clusters_to_process)}")
    print(f"   Articles published: {published_count}")
    print(f"{'='*80}\n")


# ==========================================
# MULTI-SOURCE SYNTHESIS
# ==========================================

def synthesize_multisource_article(sources: List[Dict], cluster_id: int) -> Optional[Dict]:
    """
    Synthesize one article from multiple sources using Claude
    """
    import anthropic
    import json
    import time
    
    client = anthropic.Anthropic(api_key=anthropic_key)
    
    # Limit sources to avoid token limits
    limited_sources = sources[:10]  # Max 10 sources
    
    # Build prompt with all sources
    sources_text = "\n\n".join([
        f"SOURCE {i+1} ({s.get('source_name', 'Unknown')}):\n"
        f"Title: {s.get('title', 'Unknown')}\n"
        f"Content: {s.get('full_text', s.get('description', ''))[:1500]}"  # Increased from 800 to 1500 chars (~225 words)
        for i, s in enumerate(limited_sources)
    ])
    
    prompt = f"""You are writing a news article by synthesizing information from {len(limited_sources)} sources about the same event.

SOURCES:
{sources_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a professional news editor synthesizing multiple source articles into ONE comprehensive article.
Your goal: Create a cohesive, factual news story that combines the best information from ALL sources.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ HIGHLIGHTING REQUIREMENTS (**BOLD** SYNTAX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use **bold** to highlight KEY TERMS ONLY. Be selective - highlight what matters most.

WHAT TO HIGHLIGHT:
  ✓ Specific numbers: **$22.1 billion**, **3.2%**, **847 points**
  ✓ Key people: **Jerome Powell**, **Elon Musk**, **President Biden**
  ✓ Organizations: **Federal Reserve**, **Nvidia**, **European Central Bank**
  ✓ Places: **Wall Street**, **Tokyo**, **Dubai Air Show**
  ✓ Important dates: **Wednesday**, **November 20**, **2025**
  ✓ Key entities: **S&P 500**, **Bitcoin**, **Nikkei 225**

WHAT NOT TO HIGHLIGHT:
  ✗ Common words: "said," "announced," "market," "today"
  ✗ Every number - only the most significant ones
  ✗ Generic terms: "company," "officials," "experts"
  ✗ Articles and prepositions: "the," "at," "in"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY HIGHLIGHTING COUNTS:

📌 TITLE (title_news + title_b2):
   • Minimum: 2 highlighted terms
   • Maximum: 3 highlighted terms
   • Focus on: Main subject + key number/impact

📌 BULLET POINTS (summary_bullets_news + summary_bullets_b2):
   • Per bullet: 2-4 highlighted terms (MANDATORY)
   • Each of the 3 bullets MUST have at least 2 highlights, maximum 4
   • Total across all 3 bullets: 6-12 highlights

📌 ARTICLE CONTENT (content_news + content_b2):
   • Minimum: 5 highlighted terms across entire article
   • Maximum: 15 highlighted terms across entire article
   • Distribute throughout - don't cluster all in first paragraph

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ GENERAL WRITING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SYNTHESIZE, DON'T COPY - Combine information from ALL sources into one coherent story
2. NEVER quote sources or use "according to" - Write as firsthand reporter
3. HANDLE CONFLICTS - Use most recent source OR say "at least X" OR specify range
4. INVERTED PYRAMID - Most newsworthy info first (who, what, when, where)
5. JOURNALISTIC STANDARDS - Objective, neutral, third person, active voice, factual only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TITLE REQUIREMENTS (8-10 words max)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE_NEWS: [Subject] + [Strong Verb] + [Key Detail]
- ACTIVE voice with strong verbs (Plunge, Crash, Soar, Jump, Fall, Drop, Rise, Surge)
- Present tense, include numbers, use **bold** for 2-3 key terms
- ✓ "**Bitcoin** Drops **8%** as Crypto Fear Index Hits **2022** Lows"
- ✗ NO "The/A", weak verbs, passive voice, vague adjectives

TITLE_B2: Same meaning, simple vocabulary
- Common verbs (Fall, Drop, Rise, Jump, Say, Ask, Start, Stop)
- ✓ "**Bitcoin** Falls **8%** as Crypto Fear Hits **2022** Low"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 BULLET SUMMARY (15-20 words each, exactly 3 bullets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MUST provide NEW information NOT in title. Progressive structure:
  Bullet 1: Immediate impact/consequence (with specific numbers, 2-4 highlights MANDATORY)
  Bullet 2: Key factual details (who, when, where, names, 2-4 highlights MANDATORY)
  Bullet 3: Context, cause, or future implications (2-4 highlights MANDATORY)

MANDATORY: Specific numbers in 2+ bullets, named entities, NO title repetition, 15-20 words per bullet
✓ "**S&P 500** fell **3.2%** losing **$1.1 trillion** while **Tokyo's Nikkei** dropped 2.8%"
✗ "Market volatility spread" (vague, no highlights, too short)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 ARTICLE CONTENT (220-280 words)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTENT_NEWS: AP/Reuters style, 5-15 highlights distributed throughout
  Para 1 (35-45w): 5 Ws, 2-3 highlights
  Para 2 (40-50w): Key details, 1-2 highlights  
  Para 3 (40-50w): Background/context, 1-2 highlights
  Para 4 (40-50w): Supporting details, 1-2 highlights
  Para 5 (35-45w): Future implications, 0-2 highlights

MANDATORY: 5+ specific numbers, 3+ named entities, distribute highlights across ALL paragraphs

CONTENT_B2: Simple B2 English, 5-15 highlights distributed throughout
  5 paragraphs (35-50w each), 2-3 sentences per paragraph
  Max 20 words/sentence, simple tenses, active voice only
  Simplify: "Plummeted"→"fell quickly", "Volatility"→"going up and down"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT FORMAT (JSON):
{{
  "title_news": "Advanced title with **2-3 bold** key terms (8-10 words)",
  "title_b2": "Simple title with **2-3 bold** key terms (8-10 words)",
  "summary_bullets_news": [
    "Impact with **2-4 highlights** (15-20 words)",
    "Details with **2-4 highlights** (15-20 words)",
    "Context with **2-4 highlights** (15-20 words)"
  ],
  "summary_bullets_b2": [
    "Simple impact with **2-4 highlights** (15-20 words)",
    "Simple details with **2-4 highlights** (15-20 words)",
    "Simple context with **2-4 highlights** (15-20 words)"
  ],
  "content_news": "220-280 word article with **5-15 highlights** distributed throughout...",
  "content_b2": "220-280 word article with **5-15 highlights** distributed throughout...",
  "category": "Tech|Business|Science|International|Finance|Crypto|Other"
}}

Return ONLY valid JSON, no markdown, no explanations."""
    
    # Try up to 3 times
    for attempt in range(3):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                temperature=0.3,
                timeout=60,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Get response text
            response_text = response.content[0].text if response.content else ""
            
            if not response_text:
                print(f"   ⚠️  Empty response from Claude (attempt {attempt + 1}/3)")
                if attempt < 2:
                    time.sleep(3)
                    continue
                return None
            
            # Clean response (remove markdown if present)
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            # Parse JSON
            result = json.loads(response_text)
            
            # Validate required fields
            required = ['title_news', 'title_b2', 'content_news', 'content_b2']
            if all(k in result for k in required):
                return result
            else:
                missing = [k for k in required if k not in result]
                print(f"   ⚠️  Missing fields: {missing} (attempt {attempt + 1}/3)")
                if attempt < 2:
                    time.sleep(3)
                    continue
                return None
            
        except json.JSONDecodeError as e:
            print(f"   ⚠️  JSON parse error (attempt {attempt + 1}/3): {str(e)[:100]}")
            if attempt < 2:
                time.sleep(3)
                continue
            return None
            
        except anthropic.APIError as e:
            error_msg = str(e)
            if 'overloaded' in error_msg.lower():
                print(f"   ⚠️  Claude overloaded (attempt {attempt + 1}/3) - waiting 10s...")
                time.sleep(10)
            elif 'rate_limit' in error_msg.lower():
                print(f"   ⚠️  Rate limited (attempt {attempt + 1}/3) - waiting 5s...")
                time.sleep(5)
            else:
                print(f"   ⚠️  API error: {error_msg[:100]}")
                if attempt < 2:
                    time.sleep(3)
            continue
            
        except Exception as e:
            print(f"   ⚠️  Synthesis error (attempt {attempt + 1}/3): {str(e)[:100]}")
            if attempt < 2:
                time.sleep(3)
                continue
            return None
    
    print(f"   ❌ Failed after 3 attempts")
    return None


# ==========================================
# MAIN LOOP
# ==========================================

def main():
    """Run continuous workflow"""
    
    print("\n" + "="*80)
    print("🚀 COMPLETE 8-STEP CLUSTERED NEWS SYSTEM")
    print("="*80)
    print("\nThis system will:")
    print("  📰 Fetch RSS from 171 sources")
    print("  🎯 Score with Gemini")
    print("  🔗 Cluster similar events")
    print("  📡 Fetch full article text")
    print("  ✍️  Synthesize multi-source articles")
    print("  🔍 Search for context")
    print("  📊 Generate components")
    print("  💾 Publish to Supabase")
    print("\nPress Ctrl+C to stop")
    print("="*80)
    
    cycle = 0
    
    while True:
        try:
            cycle += 1
            print(f"\n\n{'#'*80}")
            print(f"# CYCLE {cycle} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'#'*80}")
            
            run_complete_pipeline()
            
            print(f"\n😴 Sleeping 5 minutes until next cycle...")
            time.sleep(300)  # 5 minutes = 300 seconds
            
        except KeyboardInterrupt:
            print("\n\n🛑 Stopped by user")
            break
        except Exception as e:
            print(f"\n❌ Error in cycle {cycle}: {e}")
            print("   Waiting 1 minute before retry...")
            time.sleep(60)
    
    print("\n✅ System stopped")


if __name__ == '__main__':
    main()


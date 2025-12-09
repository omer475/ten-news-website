"""
COMPLETE 8-STEP NEWS WORKFLOW WITH CLUSTERING
==============================================

Step 0: RSS Feed Collection (171 sources)
Step 1: Personas Scoring & Filtering (score ≥60)
Step 1.5: Event Clustering (clusters similar articles)
Step 2: Jina Full Article Fetching (all sources in cluster)
Step 3: Smart Image Selection (selects best image from sources)
Step 4: Multi-Source Synthesis with Claude (generates article from all sources)
Step 5: Component Selection & Gemini Search (decides which components + fetches data)
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
from step1_personas_scoring import score_news_articles_step1
from step1_5_event_clustering import EventClusteringEngine
from step2_jina_full_article_fetching import JinaArticleFetcher, fetch_articles_parallel
from step3_image_selection import select_best_image_for_cluster
from step4_multi_source_synthesis import MultiSourceSynthesizer
from step5_gemini_component_selection import GeminiComponentSelector
from step2_gemini_context_search import search_gemini_context
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
scrapingbee_key = os.getenv('SCRAPINGBEE_API_KEY')

if not all([gemini_key, anthropic_key]):
    raise ValueError("Missing required API keys in .env file (GEMINI_API_KEY, ANTHROPIC_API_KEY)")

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
            
            # STEP 5: Component Selection & Gemini Search
            print(f"\n🔍 STEP 5: COMPONENT SELECTION & GEMINI SEARCH")
            
            # Select components based on synthesized title + full content
            article_for_selection = {
                'title': synthesized['title_news'],
                'text': synthesized['content_news']  # Full 200-word article from Claude
            }
            
            component_result = component_selector.select_components(article_for_selection)
            selected = component_result.get('components', [])  # Fixed: was 'selected_components'
            print(f"   Selected components: {', '.join(selected) if selected else 'none'}")
            
            context_data = {}
            if selected and gemini_key:
                # Get context using title and summary (now using Gemini)
                gemini_result = search_gemini_context(
                    synthesized['title_news'], 
                    synthesized['content_news'][:500]  # Use first 500 chars as summary
                )
                # Use same context for all selected components
                for component in selected:
                    context_data[component] = gemini_result
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
            
            # Check if article for this cluster already exists (prevent duplicates)
            existing = supabase.table('published_articles').select('id').eq('cluster_id', cluster_id).execute()
            if existing.data and len(existing.data) > 0:
                print(f"   ⏭️ Cluster {cluster_id} already published (ID: {existing.data[0]['id']}), skipping...")
                continue
            
            # Use the HIGHEST persona score from Step 1 (from any source in cluster)
            source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
            article_score = max(source_scores) if source_scores else 50
            
            print(f"   📊 Article score: {article_score}/100 (highest from {len(cluster_sources)} source(s))")
            
            # Get title and content (support both old and new field names from Claude)
            title = synthesized.get('title', synthesized.get('title_news', ''))
            content = synthesized.get('content', synthesized.get('content_news', ''))
            
            # Get bullets (support both old and new field names)
            bullets_standard = synthesized.get('summary_bullets_standard', synthesized.get('summary_bullets_news', []))
            bullets_detailed = synthesized.get('summary_bullets_detailed', [])
            
            # If detailed bullets are empty, use standard bullets as fallback
            if not bullets_detailed:
                bullets_detailed = bullets_standard
            
            article_data = {
                'cluster_id': cluster_id,
                'url': cluster_sources[0]['url'],  # Primary source URL
                'source': cluster_sources[0]['source_name'],
                'category': synthesized.get('category', 'Other'),
                # Title and content
                'title_news': title,
                'content_news': content,
                # Standard bullets (60-80 chars)
                'summary_bullets_news': bullets_standard,
                # Detailed bullets (90-120 chars) - for language toggle
                'summary_bullets_detailed': bullets_detailed,
                'timeline': components.get('timeline'),
                'details': components.get('details'),
                'graph': components.get('graph'),
                'components_order': selected,
                'num_sources': len(cluster_sources),
                'published_at': datetime.now().isoformat(),
                'ai_final_score': article_score,  # Importance score for sorting (0-100)
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

You are a professional news editor for Ten News, synthesizing multiple source articles into ONE comprehensive article. Your goal: Create a cohesive, engaging, trustworthy news story that combines the best information from ALL sources.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ CORE WRITING PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ACTIVE VOICE + PRESENT TENSE
   The active voice is shorter, stronger, and more direct. Present tense creates immediacy.
   ✓ "Tesla Cuts 10,000 Jobs" 
   ✗ "Jobs Were Cut by Tesla" (passive)
   ✗ "Tesla Has Cut Jobs" (past tense)

2. STRONG, SPECIFIC VERBS
   Use verbs that convey action: reveals, unveils, launches, warns, slashes, blocks, sparks
   Avoid weak verbs: announces, says, gets, makes, has, is, are, was, were

3. CONCRETE LANGUAGE (NOT ABSTRACT)
   Concrete language is more understandable, interesting, and memorable.
   ✓ "iPhone Prices Drop 20%" (concrete - you can picture it)
   ✗ "Major Changes Coming" (abstract - vague)

4. FRONT-LOAD IMPORTANT INFORMATION
   Mobile users give headlines 1.7 seconds. Put the most critical info in the first 3-5 words.
   ✓ "Apple Unveils iPhone 16 with AI Features"
   ✗ "In a Surprise Move, Apple Announces New iPhone"

5. INVERTED PYRAMID STRUCTURE
   Most newsworthy information first (who, what, when, where), then supporting details.
   Never bury the lead.

6. SYNTHESIZE, DON'T COPY
   Combine information from ALL sources. Never quote sources or use "according to."
   Write as a firsthand reporter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TITLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 40-60 characters (8-12 words). Truncates at 40 chars on mobile.

STRUCTURE: [Subject] + [Strong Verb] + [Specific Detail/Number]

FORMULA CHECKLIST:
  ✓ Start with the subject (WHO or WHAT) - never start with a verb
  ✓ Strong verb appears in first 5 words
  ✓ Include a specific number when relevant (odd numbers outperform even)
  ✓ Use present tense, active voice
  ✓ Omit articles (a, an, the) to save space
  ✓ Use concrete, specific language

POWER VERBS TO USE:
  • Impact: Cuts, Slashes, Drops, Falls, Crashes, Plunges
  • Growth: Surges, Soars, Jumps, Climbs, Rises, Gains
  • Action: Launches, Unveils, Reveals, Blocks, Bans, Rejects
  • Conflict: Warns, Threatens, Faces, Battles, Fights

WORDS TO AVOID:
  • Weak verbs: announces, says, reports, notes, indicates
  • Vague words: major, significant, important, various, some
  • Clickbait: shocking, incredible, you won't believe

ENGAGEMENT WITHOUT CLICKBAIT:
  Research shows negative words increase clicks by 2.3% each, but sensationalism erodes trust.
  Use ONE moderate emotional trigger per headline without exaggeration.
  ✓ "CEO Warns of 'Worst Crisis in Company History'" (factual, direct)
  ✗ "SHOCKING: You Won't Believe What CEO Just Said" (clickbait)

EXAMPLES:
  ✓ "Tesla Cuts 10,000 Jobs Amid 15% Sales Drop" (52 chars)
  ✓ "UK Raises Skilled Worker Visa Salary to £38,700" (48 chars)
  ✓ "Fed Holds Rates at 5.5%, Signals 3 Cuts in 2024" (48 chars)
  
  ✗ "There Are Going to Be Some Changes to Policy" (vague, passive)
  ✗ "A Major Company Announces Important News" (abstract, weak verb)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TITLE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use strong, professional vocabulary:
  "Bitcoin Plummets 8% as Crypto Fear Index Hits 2022 Lows"
  
Use action verbs: Plummets, Falls, Surges, Rises, Unveils, Shows, Sparks, Starts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 SUMMARY BULLETS (Exactly 3 bullets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: Under 80 characters each (10-15 words per bullet)

STRUCTURE (Inverted Pyramid):
  • Bullet 1: WHAT happened (the core news fact not in title)
  • Bullet 2: WHO/WHERE/WHEN (key context and details)
  • Bullet 3: WHY IT MATTERS (significance, impact, what's next)

WRITING RULES FOR BULLETS:
  ✓ Each bullet provides NEW information not in the title
  ✓ Include specific numbers in at least 2 bullets
  ✓ Use parallel structure (all bullets start with same part of speech)
  ✓ Active voice, present tense
  ✓ Front-load important words
  ✓ All bullets approximately equal length

PARALLEL STRUCTURE EXAMPLE:
  ✓ GOOD (all start with subject + verb):
    • Fed raises rates to 5.5%, highest level since 2007
    • Markets drop 2% following the announcement
    • Economists predict two more increases this year

  ✗ BAD (inconsistent structure):
    • The Fed raised rates to 5.5%
    • A 2% market drop followed
    • Economists are predicting more increases

WHAT TO INCLUDE:
  ✓ Key facts (numbers, names, outcomes)
  ✓ Direct impact on readers
  ✓ Unexpected or newsworthy elements

WHAT TO EXCLUDE:
  ✗ Background readers likely know
  ✗ Information already in the title
  ✗ Vague statements without specifics

EXAMPLES:
  ✓ "Company announces 10,000 layoffs planned for Q2" (48 chars)
  ✓ "Decision follows three consecutive quarters of losses" (54 chars)
  ✓ "Remaining 45,000 workers face restructuring review" (51 chars)

  ✗ "The company said stores will close" (too vague)
  ✗ "This will affect many jobs" (no specifics)
  ✗ "It's because of economic conditions" (abstract)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY_BULLETS_NEWS vs SUMMARY_BULLETS_DETAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST generate TWO versions of bullet summaries:

SUMMARY_BULLETS_NEWS (Standard - 60-80 chars each):
  • Short, scannable bullet points
  • 10-15 words each
  
SUMMARY_BULLETS_DETAILED (Detailed - 90-120 chars each):
  • Same info, expanded with more context
  • 15-22 words each

EXAMPLE:
  STANDARD: "Layoffs hit **10%** of workforce across **US**, **Europe**, **Asia**"
  DETAILED: "Layoffs eliminate **10%** of **Tesla's** 140,000 global workforce, hitting factories in **US**, **Europe**, and **Asia**"

SUMMARY_BULLETS_NEWS (Standard 60-80 chars):
  • "Federal Reserve maintains hawkish stance despite market turbulence"

SUMMARY_BULLETS_DETAILED (Expanded 90-120 chars):
  • "Federal Reserve maintains hawkish stance despite market turbulence, signaling more rate hikes ahead"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 ARTICLE CONTENT (220-280 words, 5 paragraphs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRUCTURE (Inverted Pyramid):
  Para 1 (40-50w): The Lead - WHO, WHAT, WHEN, WHERE (most critical facts)
  Para 2 (45-55w): Key Details - HOW, specific numbers, named sources
  Para 3 (45-55w): Context - Background needed to understand the story
  Para 4 (45-55w): Supporting Info - Additional facts, reactions, quotes
  Para 5 (40-50w): Implications - What happens next, broader significance

WRITING RULES:
  ✓ Active voice throughout
  ✓ Present tense for current news, past tense for completed actions
  ✓ Sentences under 25 words
  ✓ One idea per sentence
  ✓ Include 5+ specific numbers
  ✓ Include 3+ named entities (people, organizations, places)
  ✓ No editorializing or opinion
  ✓ No "according to" or source attribution phrases

READABILITY TARGET:
  Flesch Reading Ease: 60-70 (easily understood by average reader)
  Grade Level: 7th-8th grade maximum
  Use common vocabulary, short sentences, active voice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT_NEWS STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AP/Reuters professional style:
  • Full vocabulary range
  • Complex sentence structures allowed (under 25 words)
  • Industry terminology acceptable
  • Active voice preferred
  • Present tense for current news

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ HIGHLIGHTING REQUIREMENTS (**BOLD** SYNTAX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use **bold** to highlight KEY TERMS that help readers scan. Be selective.

WHAT TO HIGHLIGHT:
  ✓ Specific numbers: **$22.1 billion**, **3.2%**, **847 points**
  ✓ Key people: **Jerome Powell**, **Elon Musk**, **Rishi Sunak**
  ✓ Organizations: **Federal Reserve**, **Nvidia**, **NHS**
  ✓ Important places: **Wall Street**, **Westminster**, **Silicon Valley**
  ✓ Key dates: **Wednesday**, **November 20**, **Q3 2024**
  ✓ Named entities: **S&P 500**, **Bitcoin**, **iPhone 16**

WHAT NOT TO HIGHLIGHT:
  ✗ Common words: said, announced, market, today, company
  ✗ Every number - only the most significant
  ✗ Generic terms: officials, experts, sources

HIGHLIGHT COUNTS:
  • Title: 2-3 highlights (main subject + key number/impact)
  • Bullets: 2-3 highlights per bullet (6-9 total across 3 bullets)
  • Content: 8-12 highlights distributed across all 5 paragraphs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: FACTUAL ACCURACY (ZERO TOLERANCE FOR ERRORS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCURACY IS NON-NEGOTIABLE. Every fact must be verified against the sources.

BEFORE WRITING, IDENTIFY AND LOCK:
  1. COUNTRY/LOCATION: Which country/city is this about? Lock it. Never confuse.
  2. KEY PEOPLE: Who are the main actors? Their exact names and roles.
  3. ORGANIZATIONS: Which companies/governments/institutions are involved?
  4. NUMBERS: What are the specific figures mentioned?
  5. DATES/TIMING: When did this happen?

ABSOLUTE RULES:
  ✗ NEVER mix up countries (e.g., Spain vs Turkey, UK vs US)
  ✗ NEVER confuse people's names or roles
  ✗ NEVER invent facts not present in ANY source
  ✗ NEVER combine facts from different unrelated events

IF SOURCES CONFLICT:
  • Use the fact mentioned by MOST sources
  • Prefer more specific facts over vague ones
  • Never blend contradictory facts into one statement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OUTPUT FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "title_news": "40-60 char title with **2-3 bold** terms, strong verb, specific detail",
  "summary_bullets_news": [
    "WHAT: 60-80 chars with **2-3 highlights**",
    "WHO/WHERE/WHEN: 60-80 chars with **2-3 highlights**",
    "WHY IT MATTERS: 60-80 chars with **2-3 highlights**"
  ],
  "summary_bullets_detailed": [
    "WHAT: 90-120 chars, expanded with more context, **2-3 highlights**",
    "WHO/WHERE/WHEN: 90-120 chars, expanded with more context, **2-3 highlights**",
    "WHY IT MATTERS: 90-120 chars, expanded with more context, **2-3 highlights**"
  ],
  "content_news": "220-280 words, 5 paragraphs, inverted pyramid, **8-12 highlights** distributed throughout, AP/Reuters style",
  "category": "Tech|Business|Science|Politics|Finance|Crypto|Health|Entertainment|Sports|World"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK REFERENCE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
  □ 40-60 characters
  □ Active voice, present tense
  □ Strong verb in first 5 words
  □ Specific number included
  □ No articles (a, an, the)
  □ 2-3 highlights

BULLETS STANDARD (summary_bullets_news):
  □ Exactly 3 bullets
  □ Each 60-80 characters
  □ Bullet 1 = What happened
  □ Bullet 2 = Key context
  □ Bullet 3 = Why it matters
  □ 2-3 highlights per bullet

BULLETS DETAILED (summary_bullets_detailed):
  □ Exactly 3 bullets  
  □ Each 90-120 characters
  □ Same info as standard, expanded with more detail
  □ 2-3 highlights per bullet

CONTENT:
  □ 220-280 words
  □ 5 paragraphs (inverted pyramid)
  □ 5+ specific numbers
  □ 3+ named entities
  □ Sentences under 25 words
  □ Active voice throughout
  □ 8-12 highlights distributed evenly

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
            required = ['title_news', 'summary_bullets_news', 'summary_bullets_detailed', 'content_news']
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


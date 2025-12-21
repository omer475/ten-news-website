"""
COMPLETE 10-STEP NEWS WORKFLOW WITH CLUSTERING
===============================================

Step 0: RSS Feed Collection (287 sources)
Step 1: Gemini V8.2 Scoring & Filtering (score ≥70)
Step 1.5: Event Clustering (clusters similar articles)
Step 2: Bright Data Full Article Fetching (all sources in cluster)
Step 3: Smart Image Selection (selects best image from sources)
Step 4: Multi-Source Synthesis with Claude (generates article from all sources)
Step 5: Gemini Context Search (Google Search grounding for component data)
Step 6: Gemini Component Selection (decides which components based on search data)
Step 7: Claude Component Generation (timeline, details, graph, map)
Step 8: Fact Verification (catches hallucinations, regenerates if needed)
Step 9: Publishing to Supabase
"""

import time
import re
from datetime import datetime, timedelta
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
from step2_brightdata_full_article_fetching import BrightDataArticleFetcher, fetch_articles_parallel
from step3_image_selection import select_best_image_for_cluster
from step4_multi_source_synthesis import MultiSourceSynthesizer
from step5_gemini_component_selection import GeminiComponentSelector
from step2_gemini_context_search import search_gemini_context
from step6_7_claude_component_generation import ClaudeComponentWriter
from step8_fact_verification import FactVerifier
from supabase import create_client

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Load environment
load_dotenv()

# ============================================================================
# IMPROVED IMAGE EXTRACTION (Step 0)
# ============================================================================
# Regex to extract src from <img> tags in HTML content
IMG_TAG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

def extract_image_url(entry) -> Optional[str]:
    """
    Extract the best image URL from an RSS feed entry.
    
    Priority order:
    1. media:content - choose largest image by area (width * height)
    2. media:thumbnail - first URL
    3. enclosures - only image/* types
    4. links - image/* types or rel="enclosure"
    5. HTML fallback - <img> tags in content/summary/description
    
    Args:
        entry: A feedparser entry object
        
    Returns:
        Image URL string or None if no image found
    """
    
    # 1) media:content – choose the "best" candidate (largest image)
    media_content = getattr(entry, 'media_content', None)
    if media_content:
        best = None
        best_area = 0
        for m in media_content:
            url = m.get('url')
            if not url:
                continue

            mtype = m.get('type', '')
            # Skip non-image types (but allow empty type as it might still be image)
            if mtype and not mtype.startswith('image/'):
                continue

            try:
                w = int(m.get('width') or 0)
                h = int(m.get('height') or 0)
            except (ValueError, TypeError):
                w, h = 0, 0
            area = w * h

            # Prefer larger images, or take first valid one if no dimensions
            if area > best_area or (best is None and area == 0):
                best_area = area
                best = url

        if best:
            return best

    # 2) media:thumbnail - take first URL
    media_thumb = getattr(entry, 'media_thumbnail', None)
    if media_thumb:
        for t in media_thumb:
            url = t.get('url')
            if url:
                return url

    # 3) enclosures with image/* type
    enclosures = getattr(entry, 'enclosures', None)
    if enclosures:
        for enc in enclosures:
            mtype = enc.get('type', '')
            if mtype.startswith('image/'):
                url = enc.get('href') or enc.get('url')
                if url:
                    return url

    # 4) links with image/* type or rel="enclosure"
    links = getattr(entry, 'links', None)
    if links:
        for link in links:
            ltype = link.get('type', '')
            if ltype.startswith('image/') or link.get('rel') == 'enclosure':
                url = link.get('href')
                if url:
                    return url

    # 5) HTML fallback: <img src="..."> in content/summary/description
    html_candidates = []

    # Check entry.content (list of content blocks)
    if hasattr(entry, 'content'):
        for c in entry.content:
            val = c.get('value') if isinstance(c, dict) else None
            if val:
                html_candidates.append(val)

    # Check entry.summary
    if hasattr(entry, 'summary') and entry.summary:
        html_candidates.append(entry.summary)

    # Check entry.description
    if hasattr(entry, 'description') and entry.description:
        html_candidates.append(entry.description)

    for html in html_candidates:
        if not html:
            continue
        match = IMG_TAG_RE.search(html)
        if match:
            img_url = match.group(1)
            # Handle protocol-relative URLs
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            return img_url

    # 6) Nothing found
    return None

# Initialize clients
def get_supabase_client():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)

supabase = get_supabase_client()
clustering_engine = EventClusteringEngine()

# Get API keys
gemini_key = os.getenv('GEMINI_API_KEY')
anthropic_key = os.getenv('ANTHROPIC_API_KEY')
brightdata_key = os.getenv('BRIGHTDATA_API_KEY')

if not all([gemini_key, anthropic_key, brightdata_key]):
    raise ValueError("Missing required API keys in .env file (GEMINI_API_KEY, ANTHROPIC_API_KEY, BRIGHTDATA_API_KEY)")

# Initialize Bright Data fetcher
brightdata_fetcher = BrightDataArticleFetcher(api_key=brightdata_key)

component_selector = GeminiComponentSelector(api_key=gemini_key)
component_writer = ClaudeComponentWriter(api_key=anthropic_key)
fact_verifier = FactVerifier(api_key=anthropic_key)


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
                
                # Extract image URL from RSS entry using improved extraction
                image_url = extract_image_url(entry)
                
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
    """Run the complete 9-step clustered news workflow"""
    
    print("\n" + "="*80)
    print("🚀 COMPLETE 10-STEP CLUSTERED NEWS WORKFLOW")
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
            
            # STEP 2: Bright Data Full Article Fetching (all sources)
            print(f"\n📡 STEP 2: BRIGHT DATA FULL ARTICLE FETCHING")
            print(f"   Fetching full text for {len(cluster_sources)} sources...")
            
            urls = [s['url'] for s in cluster_sources]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Add full text back to sources
            url_to_text = {a['url']: a.get('text', '') for a in full_articles if a.get('text')}
            for source in cluster_sources:
                source['full_text'] = url_to_text.get(source['url'], source.get('content', ''))
            
            success_count = len([s for s in cluster_sources if s.get('full_text') and len(s.get('full_text', '')) > 100])
            print(f"   ✅ Fetched full text: {success_count}/{len(cluster_sources)}")
            
            # STRICT: Require actual article content - no description fallback
            # If Bright Data couldn't fetch content, eliminate this cluster
            if success_count == 0:
                print(f"   ❌ ELIMINATED: No article content fetched (blocked by site)")
                print(f"      Reason: Cannot write accurate article without source content")
                print(f"      Skipping cluster {cluster_id}")
                continue
            
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
            
            # ==========================================
            # STEP 5: GEMINI CONTEXT SEARCH
            # ==========================================
            print(f"\n🔍 STEP 5: GEMINI CONTEXT SEARCH")
            print(f"   Searching for component data with Google Search grounding...")
            
            bullets_text = ' '.join(synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])))
            
            # Get the full article text from sources (use first source with content)
            full_article_text = ""
            for source in cluster_sources:
                if source.get('full_text') and len(source.get('full_text', '')) > 100:
                    full_article_text = source['full_text'][:3000]  # Limit to 3000 chars
                    break
            
            # Get search context with Gemini (uses Google Search grounding)
            gemini_result = None
            search_context_text = ""
            if gemini_key:
                try:
                    gemini_result = search_gemini_context(
                        synthesized['title_news'], 
                        bullets_text,
                        full_article_text
                    )
                    search_context_text = gemini_result.get('results', '') if gemini_result else ""
                    print(f"   ✅ Step 5 Complete: Search context fetched ({len(search_context_text)} chars)")
                except Exception as search_error:
                    print(f"   ⚠️ Step 5 Failed: {search_error}")
                    print(f"   📋 Continuing with limited context...")
                    search_context_text = ""
            else:
                print(f"   ⚠️ No Gemini API key - skipping context search")
            
            # ==========================================
            # STEP 6: GEMINI COMPONENT SELECTION
            # ==========================================
            print(f"\n📋 STEP 6: GEMINI COMPONENT SELECTION")
            print(f"   Analyzing search data to select appropriate components...")
            
            # Build article data for component selection
            article_for_selection = {
                'title': synthesized['title_news'],
                'text': bullets_text,
                'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', []))
            }
            
            # Component selection with robust fallback
            selected = []
            component_result = {}
            try:
                component_result = component_selector.select_components(article_for_selection, search_context_text)
                selected = component_result.get('components', []) if isinstance(component_result, dict) else []
                print(f"   ✅ Step 6 Complete: Selected [{', '.join(selected) if selected else 'none'}]")
            except Exception as comp_error:
                print(f"   ⚠️ Step 6 Failed: {comp_error}")
                print(f"   📋 Using default components: timeline, details")
                selected = ['timeline', 'details']  # Default fallback
                component_result = {'components': selected, 'emoji': '📰'}
            
            # Build context_data for component generation
            context_data = {}
            if selected and gemini_result:
                for component in selected:
                    context_data[component] = gemini_result
            
            # ==========================================
            # STEP 7: CLAUDE COMPONENT GENERATION
            # ==========================================
            print(f"\n📊 STEP 7: CLAUDE COMPONENT GENERATION")
            print(f"   Generating content for: {', '.join(selected) if selected else 'none'}")
            
            components = {}
            # Get map_locations from component selection result
            map_locations = component_result.get('map_locations', []) if isinstance(component_result, dict) else []
            
            if selected and context_data:
                try:
                    article_for_components = {
                        'title_news': synthesized['title_news'],
                        'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])),
                        'selected_components': selected,
                        'context_data': context_data,
                        'map_locations': map_locations  # Pass map locations to component generation
                    }
                    generation_result = component_writer.write_components(article_for_components)
                    if generation_result:
                        # Extract individual components from result
                        components = {
                            'timeline': generation_result.get('timeline'),
                            'details': generation_result.get('details'),
                            'graph': generation_result.get('graph'),
                            'map': generation_result.get('map')
                        }
                        # Remove None values
                        components = {k: v for k, v in components.items() if v is not None}
                        print(f"   ✅ Step 7 Complete: Generated [{', '.join(components.keys())}]")
                    else:
                        print(f"   ⚠️ Step 7 Failed: No components generated")
                except Exception as comp_gen_error:
                    print(f"   ⚠️ Step 7 Failed: {comp_gen_error}")
                    print(f"   📋 Continuing without components")
                    components = {}
            else:
                print(f"   ⏭️ Skipping - no components selected or no context data")
            
            # STEP 8: Fact Verification (Hallucination Check)
            print(f"\n🔍 STEP 8: FACT VERIFICATION")
            print(f"   Checking for hallucinations in generated content...")
            
            # Try up to 3 times: original + 2 regenerations
            max_verification_attempts = 3
            verification_passed = False
            verification_feedback = None  # Store feedback for regeneration
            
            for attempt in range(max_verification_attempts):
                if attempt > 0:
                    print(f"\n   🔄 REGENERATING ARTICLE (Attempt {attempt + 1}/{max_verification_attempts})")
                    print(f"      Re-synthesizing with verification feedback...")
                    
                    # Pass verification feedback to help Claude fix the specific issues
                    synthesized = synthesize_multisource_article(
                        cluster_sources, 
                        cluster_id,
                        verification_feedback=verification_feedback
                    )
                    
                    if not synthesized:
                        print(f"      ❌ Regeneration failed")
                        continue
                    
                    # Re-add image data after regeneration
                    if selected_image:
                        synthesized['image_url'] = selected_image['url']
                        synthesized['image_source'] = selected_image['source_name']
                        synthesized['image_score'] = selected_image['quality_score']
                    
                    print(f"      ✅ New article: {synthesized.get('title_news', '')[:50]}...")
                
                # Verify the article
                verified, discrepancies, verification_summary = fact_verifier.verify_article(
                    cluster_sources, 
                    synthesized
                )
                
                if verified:
                    verification_passed = True
                    print(f"   ✅ Verification PASSED: {verification_summary}")
                    break
                else:
                    print(f"   ⚠️  Verification FAILED (Attempt {attempt + 1}/{max_verification_attempts})")
                    print(f"      Summary: {verification_summary}")
                    if discrepancies:
                        print(f"      Discrepancies: {len(discrepancies)}")
                        for i, d in enumerate(discrepancies[:3], 1):  # Show up to 3 issues
                            issue = d.get('issue', 'Unknown')
                            print(f"         {i}. {issue[:80]}...")
                    
                    # Store feedback for next regeneration attempt
                    verification_feedback = {
                        'discrepancies': discrepancies,
                        'summary': verification_summary
                    }
            
            if not verification_passed:
                print(f"\n   ❌ ELIMINATED: Failed verification after {max_verification_attempts} attempts")
                print(f"      Cluster {cluster_id} will not be published")
                continue
            
            # Re-add image data (in case of regeneration)
            if selected_image:
                synthesized['image_url'] = selected_image['url']
                synthesized['image_source'] = selected_image['source_name']
                synthesized['image_score'] = selected_image['quality_score']
            else:
                synthesized['image_url'] = None
                synthesized['image_source'] = None
                synthesized['image_score'] = 0
            
            # STEP 9: Publishing to Supabase
            print(f"\n💾 STEP 9: PUBLISHING TO SUPABASE")
            
            # Check if article for this cluster already exists (prevent duplicates)
            existing = supabase.table('published_articles').select('id').eq('cluster_id', cluster_id).execute()
            if existing.data and len(existing.data) > 0:
                print(f"   ⏭️ Cluster {cluster_id} already published (ID: {existing.data[0]['id']}), skipping...")
                continue
            
            # Get title for duplicate checking
            title = synthesized.get('title', synthesized.get('title_news', ''))
            
            # CHECK FOR SIMILAR TITLES in recently published articles (last 24 hours)
            # This catches duplicates that slipped through clustering
            is_duplicate = False
            try:
                from difflib import SequenceMatcher
                import re
                
                cutoff_time = (datetime.now() - timedelta(hours=24)).isoformat()
                recent_articles = supabase.table('published_articles')\
                    .select('id, title_news')\
                    .gte('published_at', cutoff_time)\
                    .execute()
                
                # Clean title for comparison (remove bold markers, lowercase)
                def clean_title(t):
                    if not t:
                        return ''
                    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)  # Remove **bold**
                    t = re.sub(r'[^\w\s]', '', t.lower())  # Remove punctuation
                    return t.strip()
                
                clean_new_title = clean_title(title)
                
                for recent in (recent_articles.data or []):
                    recent_title = recent.get('title_news', '')
                    clean_recent_title = clean_title(recent_title)
                    
                    if clean_new_title and clean_recent_title:
                        similarity = SequenceMatcher(None, clean_new_title, clean_recent_title).ratio()
                        
                        if similarity >= 0.70:  # 70% similar = likely same news
                            print(f"   ⏭️ DUPLICATE TITLE DETECTED (similarity: {similarity:.0%})")
                            print(f"      New: {title[:60]}...")
                            print(f"      Existing (ID {recent['id']}): {recent_title[:60]}...")
                            print(f"      Skipping cluster {cluster_id}")
                            is_duplicate = True
                            break  # Exit the inner loop
                            
            except Exception as e:
                print(f"   ⚠️ Title duplicate check error (continuing anyway): {e}")
            
            if is_duplicate:
                continue  # Skip this cluster, move to next
            
            # Use the HIGHEST persona score from Step 1 (from any source in cluster)
            source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
            article_score = max(source_scores) if source_scores else 50
            
            print(f"   📊 Article score: {article_score}/100 (highest from {len(cluster_sources)} source(s))")
            
            # Title already set above for duplicate checking
            
            # Get bullets (new format: summary_bullets, 80-100 chars)
            bullets = synthesized.get('summary_bullets', synthesized.get('summary_bullets_news', []))
            
            # Get 5 W's (new format: WHO/WHAT/WHEN/WHERE/WHY)
            five_ws = synthesized.get('five_ws', {})
            
            article_data = {
                'cluster_id': cluster_id,
                'url': cluster_sources[0]['url'],  # Primary source URL
                'source': cluster_sources[0]['source_name'],
                'category': synthesized.get('category', 'Other'),
                # Title
                'title_news': title,
                # Summary bullets (80-100 chars) - narrative format
                'summary_bullets_news': bullets,
                # 5 W's - structured quick-reference (WHO/WHAT/WHEN/WHERE/WHY)
                'five_ws': five_ws,
                'timeline': components.get('timeline'),
                'details': components.get('details'),
                'graph': components.get('graph'),
                'map': components.get('map'),  # Map component with location data
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

def synthesize_multisource_article(sources: List[Dict], cluster_id: int, verification_feedback: Optional[Dict] = None) -> Optional[Dict]:
    """
    Synthesize one article from multiple sources using Gemini (temporarily switched from Claude)
    
    Args:
        sources: List of source articles
        cluster_id: Cluster ID
        verification_feedback: Optional dict with 'discrepancies' and 'summary' from failed verification
    """
    import requests
    import json
    import time
    
    # Use Gemini API (temporarily instead of Claude)
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={gemini_key}"
    
    # Limit sources to avoid token limits
    limited_sources = sources[:10]  # Max 10 sources
    
    # Build prompt with all sources
    sources_text = "\n\n".join([
        f"SOURCE {i+1} ({s.get('source_name', 'Unknown')}):\n"
        f"Title: {s.get('title', 'Unknown')}\n"
        f"Content: {s.get('full_text', s.get('description', ''))[:1500]}"  # Increased from 800 to 1500 chars (~225 words)
        for i, s in enumerate(limited_sources)
    ])
    
    # Add verification feedback section if provided (for regeneration after failed verification)
    feedback_section = ""
    if verification_feedback:
        discrepancies = verification_feedback.get('discrepancies', [])
        summary = verification_feedback.get('summary', '')
        
        if discrepancies:
            feedback_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ PREVIOUS VERIFICATION FAILED - ERRORS TO FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERIFICATION SUMMARY: {summary}

ISSUES FOUND IN PREVIOUS VERSION:
"""
            for i, d in enumerate(discrepancies, 1):
                feedback_section += f"""
{i}. ERROR TYPE: {d.get('type', 'Unknown')}
   ISSUE: {d.get('issue', 'N/A')}
   WHAT YOU WROTE: {d.get('generated_claim', 'N/A')}
   WHAT SOURCES SAY: {d.get('source_fact', 'N/A')}
"""
            feedback_section += """
⚠️ CRITICAL: Fix these specific errors in your new version. Stick STRICTLY to the facts in the sources.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""
    
    prompt = f"""You are synthesizing information from {len(limited_sources)} sources about the same event.

SOURCES:
{sources_text}
{feedback_section}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a professional news editor for Ten News, synthesizing multiple source articles into a concise news summary. Your goal: Create engaging, trustworthy headlines and summaries that combine the best information from ALL sources.

{"⚠️ IMPORTANT: This is a REGENERATION after verification failure. Address the specific errors listed above and stick strictly to the source facts." if verification_feedback else ""}

You will produce:
  • TITLE: Punchy headline (40-60 chars)
  • BULLETS: 3 narrative bullets for reading (80-100 chars each)
  • 5 W's: Structured quick-reference factsheet (WHO/WHAT/WHEN/WHERE/WHY)

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

LENGTH: 40-60 characters (8-10 words)

STRUCTURE: [Subject] + [Strong Verb] + [Specific Detail/Number]

CHECKLIST:
  ✓ Start with the subject (WHO or WHAT) - never start with a verb
  ✓ Strong verb appears in first 5 words
  ✓ Include a specific number when relevant (odd numbers outperform even)
  ✓ Use present tense, active voice
  ✓ Omit articles (a, an, the) to save space
  ✓ Use concrete, specific language
  ✓ 2-3 **bold** highlights

POWER VERBS TO USE:
  • Impact: Cuts, Slashes, Drops, Falls, Crashes, Plunges, Tumbles
  • Growth: Surges, Soars, Jumps, Climbs, Rises, Gains, Spikes
  • Action: Launches, Unveils, Reveals, Blocks, Bans, Rejects, Halts
  • Conflict: Warns, Threatens, Faces, Battles, Fights, Clashes

WORDS TO AVOID:
  • Weak verbs: announces, says, reports, notes, indicates
  • Vague words: major, significant, important, various, some
  • Clickbait: shocking, incredible, you won't believe

NAME RECOGNITION RULES:
  For GLOBALLY KNOWN figures (no title needed):
    • Elon Musk, Jeff Bezos, Mark Zuckerberg
    • Trump, Biden, Putin, Macron, Xi Jinping
    • Taylor Swift, Cristiano Ronaldo
    ✓ "**Musk** Unveils New Tesla Roadster"

  For LESSER-KNOWN figures (MUST include title/role):
    • Regional politicians, governors, ministers
    • Lesser-known CEOs, executives
    • Foreign leaders not widely recognized globally
    ✓ "**SD Governor Noem** Testifies on Global Security Threats"
    ✓ "**Moldovan President Sandu** Meets with EU Leaders"
    ✓ "**Rivian CEO RJ Scaringe** Warns of EV Price Wars"
    ✗ "**Noem** Testifies..." (unclear who this is)
    ✗ "**Sandu** Meets..." (unclear who this is)

  RULE: If a global reader might ask "who is this?", add the title.

EXAMPLES:
  ✓ "**Tesla** Cuts **14,000** Jobs Amid Global Sales Slump" (50 chars)
  ✓ "**Fed** Holds Rates at **5.5%**, Signals 3 Cuts for 2024" (49 chars)
  ✓ "**Bitcoin** Crashes **15%** as Mt. Gox Repayments Begin" (48 chars)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 SUMMARY BULLETS (Exactly 3 bullets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE: Narrative summary for readers who want context and flow.

LENGTH: 80-100 characters per bullet (15-20 words)

STRUCTURE (Inverted Pyramid):
  • Bullet 1: WHAT happened (the core news fact not already in title)
  • Bullet 2: WHO/HOW (key players, names, method, cause)
  • Bullet 3: WHY IT MATTERS (significance, impact, what's next)

WRITING RULES:
  ✓ Each bullet provides NEW information not in the title
  ✓ Include specific numbers in at least 2 bullets
  ✓ Use parallel structure (all bullets start with same part of speech)
  ✓ Active voice, present tense
  ✓ Front-load important words
  ✓ All bullets approximately equal length
  ✓ 2-3 **bold** highlights per bullet

PARALLEL STRUCTURE EXAMPLE:
  ✓ GOOD (all start with subject + verb):
    • Fed raises rates to 5.5%, highest level since 2007
    • Markets drop 2% following the announcement
    • Economists predict two more increases this year

  ✗ BAD (inconsistent structure):
    • The Fed raised rates to 5.5%
    • A 2% market drop followed
    • Economists are predicting more increases

EXAMPLES (80-100 chars):
  • "Layoffs eliminate **10%** of **Tesla's** 140,000 global workforce across **US**, **Europe**, and **Asia**" (95 chars)
  • "CEO **Elon Musk** blames overcapacity and intensifying price war with Chinese rival **BYD** after Q4 loss" (93 chars)
  • "Stock tumbles **8%** to **$165** in after-hours trading, erasing **$50B** in market value this week" (89 chars)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 5 W's QUICK REFERENCE (Exactly 5 fields)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE: Structured factsheet for quick scanning and at-a-glance reference.

STRUCTURE:
  • WHO: Key people and organizations involved (20-50 chars)
  • WHAT: The core action or event (30-60 chars)
  • WHEN: Specific timing (15-40 chars)
  • WHERE: Location(s) affected (20-50 chars)
  • WHY: Cause or reason (30-60 chars)

WRITING RULES:
  ✓ Short, punchy phrases (not full sentences)
  ✓ Most important entity/fact first in each field
  ✓ Include specific numbers where relevant
  ✓ 1-2 **bold** highlights per field
  ✓ No repetition across fields
  ✓ Can omit articles and verbs for brevity

EXAMPLE:

  five_ws: {{
    "who": "**Tesla**, CEO **Elon Musk**",
    "what": "Cutting **14,000** jobs (**10%** of workforce)",
    "when": "Announced **Wednesday**, effective **Q2 2024**",
    "where": "**US**, **Europe**, and **Asia** factories",
    "why": "Overcapacity and **BYD** competition after Q4 sales loss"
  }}

MORE EXAMPLES BY CATEGORY:

  FINANCE:
    "who": "**Federal Reserve**, Chair **Jerome Powell**",
    "what": "Holds interest rates at **5.5%**",
    "when": "**Wednesday**, sixth consecutive meeting",
    "where": "**US** economy, global markets",
    "why": "Inflation remains above **2%** target"

  TECH:
    "who": "**Apple**, CEO **Tim Cook**",
    "what": "Launches **iPhone 16** with **AI** features",
    "when": "**September 12**, available **September 20**",
    "where": "**29 countries** at launch",
    "why": "Competing with **Samsung** Galaxy AI push"

  CRYPTO:
    "who": "**Mt. Gox** creditors, **Bitcoin** holders",
    "what": "**$9B** in Bitcoin repayments begin",
    "when": "Starting **July 2024**, over 90 days",
    "where": "Global, primarily **Japan** and **US**",
    "why": "Court-ordered distribution after 2014 hack"

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
  • Title: 2-3 highlights
  • Bullets: 2-3 highlights per bullet (6-9 total)
  • 5 W's: 1-2 highlights per field (5-10 total)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OUTPUT FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "title": "40-60 char title with **2-3 bold** terms",
  "summary_bullets": [
    "WHAT: 80-100 chars, **2-3 highlights**",
    "WHO/HOW: 80-100 chars, **2-3 highlights**",
    "WHY IT MATTERS: 80-100 chars, **2-3 highlights**"
  ],
  "five_ws": {{
    "who": "Key people/orgs, 20-50 chars, **1-2 highlights**",
    "what": "Core action, 30-60 chars, **1-2 highlights**",
    "when": "Timing, 15-40 chars, **1-2 highlights**",
    "where": "Location(s), 20-50 chars, **1-2 highlights**",
    "why": "Cause/reason, 30-60 chars, **1-2 highlights**"
  }},
  "category": "Tech|Business|Science|Politics|Finance|Crypto|Health|Entertainment|Sports|World"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 COMPLETE EXAMPLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "title": "**Tesla** Cuts **14,000** Jobs Amid Global EV Sales Slump",

  "summary_bullets": [
    "Layoffs eliminate **10%** of **Tesla's** 140,000 global workforce across **US**, **Europe**, and **Asia** factories",
    "CEO **Elon Musk** blames overcapacity and intensifying price war with Chinese rival **BYD** after Q4 sales loss",
    "Stock tumbles **8%** to **$165** in after-hours trading, erasing **$50B** in market value this week alone"
  ],

  "five_ws": {{
    "who": "**Tesla**, CEO **Elon Musk**",
    "what": "Cutting **14,000** jobs (**10%** of workforce)",
    "when": "Announced **Wednesday**, effective **Q2 2024**",
    "where": "**US**, **Europe**, and **Asia** factories",
    "why": "Overcapacity and **BYD** competition after Q4 sales loss"
  }},

  "category": "Business"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK REFERENCE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
  □ 40-60 characters
  □ Active voice, present tense
  □ Strong verb in first 5 words
  □ Specific number included
  □ 2-3 highlights

BULLETS:
  □ Exactly 3 bullets
  □ Each 80-100 characters
  □ Bullet 1 = What happened
  □ Bullet 2 = Who/How
  □ Bullet 3 = Why it matters
  □ Parallel structure
  □ 2-3 highlights per bullet

5 W's:
  □ All 5 fields completed (WHO/WHAT/WHEN/WHERE/WHY)
  □ Short phrases, not full sentences
  □ Specific facts in each field
  □ 1-2 highlights per field
  □ No repetition across fields

Return ONLY valid JSON, no markdown, no explanations."""
    
    # Try up to 3 times
    for attempt in range(3):
        try:
            # Build Gemini API request
            request_data = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 2048,
                    "responseMimeType": "application/json"
                }
            }
            
            response = requests.post(gemini_url, json=request_data, timeout=60)
            
            # Handle rate limiting
            if response.status_code == 429:
                wait_time = (attempt + 1) * 5
                print(f"   ⚠️  Rate limited (attempt {attempt + 1}/3) - waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            
            response.raise_for_status()
            response_json = response.json()
            
            # Get response text from Gemini format
            response_text = response_json['candidates'][0]['content']['parts'][0]['text']
            
            if not response_text:
                print(f"   ⚠️  Empty response from Gemini (attempt {attempt + 1}/3)")
                if attempt < 2:
                    time.sleep(3)
                    continue
                return None
            
            # Clean response (remove markdown if present)
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            # Parse JSON
            result = json.loads(response_text)
            
            # Validate required fields (new format with 5W's - no content field)
            required = ['title', 'summary_bullets', 'five_ws', 'category']
            if all(k in result for k in required):
                # Map to old field names for backward compatibility
                result['title_news'] = result['title']
                result['summary_bullets_news'] = result['summary_bullets']
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
            
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            print(f"   ⚠️  API error (attempt {attempt + 1}/3): {error_msg[:100]}")
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
# SINGLE CYCLE (for Cloud Run)
# ==========================================

def run_single_cycle():
    """
    Run a single iteration of the workflow.
    Used by Cloud Run to execute once per trigger.
    
    Returns:
        dict with stats about the run
    """
    stats = {
        'articles_processed': 0,
        'articles_published': 0,
        'clusters_found': 0,
        'errors': []
    }
    
    try:
        run_complete_pipeline()
        # Note: run_complete_pipeline doesn't return stats currently
        # You can enhance it later to return detailed stats
        return stats
    except Exception as e:
        stats['errors'].append(str(e))
        raise


# ==========================================
# MAIN LOOP
# ==========================================

def main():
    """Run continuous workflow"""
    
    print("\n" + "="*80)
    print("🚀 COMPLETE 10-STEP CLUSTERED NEWS SYSTEM")
    print("="*80)
    print("\nThis system will:")
    print("  📰 Fetch RSS from 287 sources")
    print("  🎯 Score with Gemini V8.2")
    print("  🔗 Cluster similar events")
    print("  📡 Fetch full article text")
    print("  ✍️  Synthesize multi-source articles")
    print("  🔍 Step 5: Search for context (Gemini)")
    print("  📋 Step 6: Select components (Gemini)")
    print("  📊 Step 7: Generate components (Claude)")
    print("  🔬 Verify facts (catch hallucinations)")
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


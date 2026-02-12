"""
COMPLETE 11-STEP NEWS WORKFLOW WITH CLUSTERING
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
Step 10: Article Scoring (AI importance scoring 700-950)
Step 11: Article Tagging (countries + topics for personalization)
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
from step3_image_selection import select_best_image_for_cluster, ImageSelector
from image_quality_checker import ImageQualityChecker, check_and_select_best_image
from step4_multi_source_synthesis import MultiSourceSynthesizer
from step5_gemini_component_selection import GeminiComponentSelector
from step2_gemini_context_search import search_gemini_context
from step6_7_claude_component_generation import ClaudeComponentWriter
from step8_fact_verification import FactVerifier
from step10_article_scoring import score_article_with_references, get_reference_articles, generate_interest_tags
from step11_article_tagging import tag_article
from step6_world_event_detection import detect_world_events
from supabase import create_client

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Load environment
load_dotenv()

# ============================================================================
# CLUSTER STATUS TRACKING HELPERS
# ============================================================================

def get_supabase_client():
    """Get Supabase client for status updates"""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    return create_client(url, key)

def update_cluster_status(cluster_id: int, status: str, failure_reason: str = None, 
                          failure_details: str = None, increment_attempt: bool = True):
    """
    Update cluster publish_status and tracking fields.
    
    Args:
        cluster_id: The cluster ID
        status: 'pending', 'processing', 'published', 'failed', 'skipped'
        failure_reason: 'no_content', 'no_image', 'synthesis_failed', 
                       'verification_failed', 'duplicate', 'api_error'
        failure_details: Detailed error message
        increment_attempt: Whether to increment attempt_count
    """
    try:
        supabase = get_supabase_client()
        now = datetime.now().isoformat()
        
        # Build update data
        update_data = {
            'publish_status': status,
            'last_attempt_at': now
        }
        
        if failure_reason:
            update_data['failure_reason'] = failure_reason
        if failure_details:
            update_data['failure_details'] = failure_details[:500]  # Limit length
        
        # Get current cluster data for history tracking
        current = supabase.table('clusters').select('attempt_count, first_attempt_at, attempt_history').eq('id', cluster_id).execute()
        
        if current.data:
            cluster_data = current.data[0]
            current_attempt = cluster_data.get('attempt_count') or 0
            
            # Set first_attempt_at if this is the first attempt
            if not cluster_data.get('first_attempt_at'):
                update_data['first_attempt_at'] = now
            
            # Increment attempt count
            if increment_attempt:
                update_data['attempt_count'] = current_attempt + 1
            
            # Track if this is a recovery (previously failed, now published)
            if status == 'published' and current_attempt > 0:
                update_data['recovered'] = True
                update_data['attempts_before_success'] = current_attempt + 1
            
            # Add to attempt history
            history = cluster_data.get('attempt_history') or []
            history_entry = {
                'attempt': current_attempt + 1,
                'at': now,
                'status': status,
                'reason': failure_reason
            }
            history.append(history_entry)
            update_data['attempt_history'] = history
        
        # Update the cluster
        supabase.table('clusters').update(update_data).eq('id', cluster_id).execute()
        
    except Exception as e:
        print(f"   ⚠️ Could not update cluster status: {e}")

def update_source_article_status(source_id: int, content_fetched: bool = None, 
                                  fetch_failure_reason: str = None,
                                  has_image: bool = None, image_quality_score: float = None):
    """
    Update source article tracking fields.
    
    Args:
        source_id: The source article ID
        content_fetched: Whether Bright Data successfully fetched content
        fetch_failure_reason: 'blocked', 'timeout', 'paywall', 'not_found', 'parse_error'
        has_image: Whether the source has a usable image
        image_quality_score: Image quality score from selection
    """
    try:
        supabase = get_supabase_client()
        
        update_data = {}
        if content_fetched is not None:
            update_data['content_fetched'] = content_fetched
        if fetch_failure_reason:
            update_data['fetch_failure_reason'] = fetch_failure_reason
        if has_image is not None:
            update_data['has_image'] = has_image
        if image_quality_score is not None:
            update_data['image_quality_score'] = image_quality_score
        
        if update_data:
            supabase.table('source_articles').update(update_data).eq('id', source_id).execute()
            
    except Exception as e:
        print(f"   ⚠️ Could not update source article status: {e}")

def update_source_reliability(source_domain: str, success: bool, failure_reason: str = None):
    """
    Track source domain reliability for analytics.
    
    Args:
        source_domain: The domain (e.g., 'bbc.com', 'reuters.com')
        success: Whether the fetch was successful
        failure_reason: Why it failed (if applicable)
    """
    try:
        supabase = get_supabase_client()
        now = datetime.now().isoformat()
        
        # Check if domain exists
        existing = supabase.table('source_reliability').select('*').eq('source_domain', source_domain).execute()
        
        if existing.data:
            # Update existing record
            record = existing.data[0]
            update_data = {
                'total_attempts': (record.get('total_attempts') or 0) + 1,
                'last_attempt_at': now
            }
            if success:
                update_data['successful_fetches'] = (record.get('successful_fetches') or 0) + 1
                update_data['last_success_at'] = now
            else:
                update_data['failed_fetches'] = (record.get('failed_fetches') or 0) + 1
                if failure_reason:
                    update_data['common_failure_reason'] = failure_reason
            
            supabase.table('source_reliability').update(update_data).eq('id', record['id']).execute()
        else:
            # Create new record
            insert_data = {
                'source_domain': source_domain,
                'total_attempts': 1,
                'successful_fetches': 1 if success else 0,
                'failed_fetches': 0 if success else 1,
                'first_seen_at': now,
                'last_attempt_at': now,
                'common_failure_reason': failure_reason if not success else None
            }
            if success:
                insert_data['last_success_at'] = now
            
            supabase.table('source_reliability').insert(insert_data).execute()
            
    except Exception as e:
        # Don't fail the pipeline for analytics errors
        pass

def extract_domain(url: str) -> str:
    """Extract domain from URL for reliability tracking"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except:
        return 'unknown'

# ============================================================================
# PRE-SYNTHESIS CLUSTER VALIDATION (Step 3.5)
# ============================================================================

def validate_cluster_sources(sources: List[Dict], cluster_name: str = "") -> List[Dict]:
    """
    Validate that all sources in a cluster are about the SAME event before synthesis.
    
    This prevents the issue where unrelated articles get clustered together due to:
    - Loose embedding matches
    - Keyword similarity (e.g., "trump" in "trump card")
    - Same category but different stories
    
    Args:
        sources: List of source articles in the cluster
        cluster_name: Name of the cluster for logging
        
    Returns:
        List of validated sources (outliers removed)
    """
    import google.generativeai as genai
    
    # Skip validation for single-source clusters
    if len(sources) <= 1:
        return sources
    
    # Skip validation for 2-source clusters (assume embedding match is correct)
    if len(sources) == 2:
        return sources
    
    print(f"   🔍 VALIDATING {len(sources)} sources for cluster: {cluster_name[:50]}...")
    
    try:
        # Configure Gemini
        gemini_key = os.getenv('GEMINI_API_KEY')
        if not gemini_key:
            print(f"      ⚠️ No Gemini key - skipping validation")
            return sources
        
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Build source list for AI
        sources_text = ""
        for i, source in enumerate(sources):
            title = source.get('title', 'Unknown')
            source_name = source.get('source_name', 'Unknown')
            sources_text += f"{i+1}. [{source_name}] {title}\n"
        
        prompt = f"""You are validating a news cluster. Check if ALL these articles are about the SAME SPECIFIC EVENT.

CLUSTER NAME: {cluster_name}

ARTICLES IN CLUSTER:
{sources_text}

TASK: Identify any articles that are about a DIFFERENT event/topic than the majority.

SAME EVENT examples (should be KEPT):
- "Mall fire kills 50" and "Mall fire death toll rises" = SAME (keep both)
- "Trump threatens tariffs" and "Europe reacts to Trump tariffs" = SAME (keep both)

DIFFERENT EVENT examples (should be REMOVED):
- "Trump threatens tariffs" mixed with "India's trump card in manufacturing" = DIFFERENT (word match error)
- "Apple iPhone launch" mixed with "Apple faces antitrust lawsuit" = DIFFERENT (same company, different stories)
- "Research paper about tumor cells" mixed with "Breaking news about hospital fire" = DIFFERENT (scientific journal mixed with news)

Respond with ONLY the numbers of articles to REMOVE (outliers that don't belong).
If ALL articles belong together, respond with: NONE

Format: REMOVE: 3, 5, 7
Or: NONE

Your response:"""

        response = model.generate_content(prompt)
        result_text = response.text.strip().upper()
        
        # Parse response
        if "NONE" in result_text or "ALL" in result_text or not result_text:
            print(f"      ✅ All {len(sources)} sources validated - same event")
            return sources
        
        # Extract article numbers to remove
        import re
        numbers_match = re.findall(r'\d+', result_text)
        to_remove = set()
        
        for num_str in numbers_match:
            try:
                idx = int(num_str) - 1  # Convert to 0-indexed
                if 0 <= idx < len(sources):
                    to_remove.add(idx)
            except ValueError:
                continue
        
        if not to_remove:
            print(f"      ✅ All {len(sources)} sources validated - same event")
            return sources
        
        # Remove outliers
        validated_sources = []
        removed_sources = []
        
        for i, source in enumerate(sources):
            if i in to_remove:
                removed_sources.append(source)
            else:
                validated_sources.append(source)
        
        # Log what was removed
        print(f"      ⚠️ REMOVED {len(removed_sources)} unrelated sources:")
        for source in removed_sources:
            print(f"         ❌ [{source.get('source_name', 'Unknown')}] {source.get('title', 'Unknown')[:60]}...")
        
        print(f"      ✅ Keeping {len(validated_sources)} validated sources")
        
        # Safety: Never remove all sources
        if not validated_sources:
            print(f"      ⚠️ Validation removed all sources - keeping original")
            return sources
        
        return validated_sources
        
    except Exception as e:
        print(f"      ⚠️ Validation error: {e} - keeping all sources")
        return sources

# ============================================================================
# IMPROVED IMAGE EXTRACTION (Step 0)
# ============================================================================
# Regex to extract src from <img> tags in HTML content
IMG_TAG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

# Sources that need special image handling
# Guardian: Select highest width from RSS media:content
# BBC/DW: Need Bright Data scraping for og:image (handled in Step 2)
SOURCES_NEEDING_OG_IMAGE_SCRAPE = [
    'feeds.bbci.co.uk',
    'bbc.co.uk',
    'bbc.com',
    'rss.dw.com',
    'dw.com',
    'venturebeat.com',
    'venturebeat',
    'cbc.ca',           # CBC Canada - needs og:image scraping
    'lemonde.fr',       # Le Monde - needs og:image scraping
    'straitstimes.com', # The Straits Times - needs og:image scraping
]

def extract_image_url(entry, source_url: str = None) -> Optional[str]:
    """
    Extract the best image URL from an RSS feed entry.
    
    Special handling:
    - Guardian: Select width=700 from media:content (highest quality available)
    - BBC/DW: Returns low-quality RSS image; will be replaced with og:image in Step 2
    
    Priority order:
    1. media:content - choose largest image by WIDTH (for Guardian) or AREA
    2. media:thumbnail - first URL
    3. enclosures - only image/* types
    4. links - image/* types or rel="enclosure"
    5. HTML fallback - <img> tags in content/summary/description
    
    Args:
        entry: A feedparser entry object
        source_url: The RSS feed URL (to detect source type)
        
    Returns:
        Image URL string or None if no image found
    """
    
    # Check if this is Guardian - they provide multiple sizes, select width=700
    is_guardian = source_url and 'theguardian.com' in source_url
    
    # 1) media:content – choose the "best" candidate
    # For Guardian: prioritize by width (select 700px version)
    # For others: prioritize by area (width * height)
    media_content = getattr(entry, 'media_content', None)
    if media_content:
        best = None
        best_score = 0
        
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
            
            # For Guardian: score by width (prefer 700px)
            # For others: score by area
            if is_guardian:
                score = w  # Just use width as score
            else:
                score = w * h

            # Prefer higher scoring images, or take first valid one if no dimensions
            if score > best_score or (best is None and score == 0):
                best_score = score
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


def needs_og_image_scrape(source_url: str) -> bool:
    """Check if this source needs og:image scraping from article page."""
    if not source_url:
        return False
    return any(domain in source_url.lower() for domain in SOURCES_NEEDING_OG_IMAGE_SCRAPE)

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
component_writer = ClaudeComponentWriter(api_key=gemini_key)  # Using Gemini (Claude API limit reached)
fact_verifier = FactVerifier(api_key=gemini_key)  # Using Gemini (Claude API limit reached)


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
            response = requests.get(url, timeout=5, headers=headers, verify=False)
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
                # Pass source URL for source-specific handling (e.g., Guardian width selection)
                image_url = extract_image_url(entry, source_url=url)
                
                # Check if this source needs og:image scraping (BBC, DW)
                needs_scrape = needs_og_image_scrape(url)
                
                source_articles.append({
                    'url': article_url,
                    'title': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'source': source_name,
                    'published_date': published_date,
                    'image_url': image_url,
                    'needs_og_scrape': needs_scrape,  # Flag for BBC/DW og:image extraction
                    'source_feed_url': url  # Original RSS feed URL
                })
            
            return (source_name, source_articles)
        except Exception as e:
            return (source_name, [])
    
    # Parallel fetch from all sources
    with ThreadPoolExecutor(max_workers=50) as executor:
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
    
    # Mark new articles as processed (batched for speed)
    if new_articles:
        try:
            batch_records = [{
                'article_url': a.get('url'),
                'source': a.get('source', 'Unknown'),
                'title': a.get('title', 'No title'),
                'published_date': a.get('published_date')
            } for a in new_articles]
            # Batch upsert in chunks of 50
            for i in range(0, len(batch_records), 50):
                chunk = batch_records[i:i+50]
                supabase.table('processed_articles')\
                    .upsert(chunk, on_conflict='article_url')\
                    .execute()
        except Exception as e:
            print(f"⚠️  Batch dedup insert failed, falling back to sequential: {e}")
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

def check_api_health():
    """Quick health check on Anthropic API before starting pipeline.
    Catches credit/billing issues early instead of failing on every cluster."""
    print("🔑 Checking Anthropic API health...")
    try:
        test_response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": anthropic_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}]
            },
            timeout=15
        )
        if test_response.status_code >= 400:
            try:
                error_body = test_response.json()
                error_msg = error_body.get('error', {}).get('message', test_response.text[:500])
                error_type = error_body.get('error', {}).get('type', 'unknown')
            except Exception:
                error_msg = test_response.text[:500]
                error_type = 'unknown'
            print(f"🚨 ANTHROPIC API HEALTH CHECK FAILED: [{error_type}] {error_msg}")
            print(f"🚨 Pipeline will NOT be able to synthesize articles. Skipping this run.")
            return False
        print("✅ Anthropic API is healthy")
        return True
    except Exception as e:
        print(f"🚨 ANTHROPIC API HEALTH CHECK FAILED: {type(e).__name__}: {str(e)[:300]}")
        print(f"🚨 Pipeline will NOT be able to synthesize articles. Skipping this run.")
        return False


def run_complete_pipeline():
    """Run the complete 9-step clustered news workflow"""

    print("\n" + "="*80)
    print("🚀 COMPLETE 10-STEP CLUSTERED NEWS WORKFLOW")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    # PRE-CHECK: Verify API keys are working before wasting time
    if not check_api_health():
        print("⚠️  Aborting pipeline - Anthropic API not available")
        return

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
    filtered_articles = scoring_result.get('filtered', [])
    filtered_count = len(filtered_articles)

    print(f"\n✅ Step 1 Complete: {len(approved_articles)} approved, {filtered_count} filtered")
    
    # SAVE FILTERED ARTICLES TO SUPABASE (for analysis)
    if filtered_articles:
        try:
            filtered_to_save = []
            for article in filtered_articles:
                filtered_to_save.append({
                    'title': article.get('title', 'Unknown'),
                    'score': article.get('score', 0),
                    'source': article.get('source', 'Unknown'),
                    'url': article.get('url', ''),
                    'category': article.get('category', 'Other'),
                    'path': article.get('path', 'DISQUALIFIED'),
                    'disqualifier': article.get('disqualifier', None),
                    'filtered_at': datetime.now().isoformat()
                })
            
            # Insert in batches of 50
            for i in range(0, len(filtered_to_save), 50):
                batch = filtered_to_save[i:i+50]
                supabase.table('filtered_articles').insert(batch).execute()
            
            print(f"   📊 Saved {len(filtered_to_save)} filtered articles to Supabase")
        except Exception as e:
            print(f"   ⚠️ Could not save filtered articles: {e}")
    
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
    
    # ==========================================
    # PARALLEL CLUSTER PROCESSING (3 workers)
    # ==========================================
    import threading
    
    # Gemini rate limiter - allows max 2 concurrent Gemini API calls
    # This prevents 429 errors without adding any artificial delay.
    # Workers only wait if 2 other workers are already mid-Gemini-call.
    gemini_semaphore = threading.Semaphore(5)
    
    # Thread-safe counter for published articles
    published_lock = threading.Lock()
    published_count = 0
    
    # Duplicate title cache shared across threads (prevents parallel duplicates)
    title_cache_lock = threading.Lock()
    published_titles_cache = []  # Populated before parallel processing
    
    # Pre-fetch recent titles once (shared across all workers)
    try:
        from difflib import SequenceMatcher
        cutoff_time = (datetime.now() - timedelta(hours=24)).isoformat()
        recent_articles_result = supabase.table('published_articles')\
            .select('id, title_news')\
            .gte('published_at', cutoff_time)\
            .execute()
        
        def _clean_title(t):
            if not t:
                return ''
            t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
            t = re.sub(r'[^\w\s]', '', t.lower())
            return t.strip()
        
        for r in (recent_articles_result.data or []):
            published_titles_cache.append({
                'id': r['id'],
                'title_news': r.get('title_news', ''),
                'clean': _clean_title(r.get('title_news', ''))
            })
    except Exception as e:
        print(f"   ⚠️ Could not pre-fetch recent titles: {e}")
    
    def process_single_cluster(cluster_id):
        """Process a single cluster through Steps 2-11. Thread-safe."""
        nonlocal published_count
        
        try:
            print(f"\n{'='*80}")
            print(f"📰 PROCESSING CLUSTER {cluster_id}")
            print(f"{'='*80}")
            
            # Mark cluster as processing
            update_cluster_status(cluster_id, 'processing', increment_attempt=False)
            
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
            print(f"   [Cluster {cluster_id}] Sources in cluster: {len(cluster_sources)}")
            
            # STEP 2: Bright Data Full Article Fetching (all sources)
            print(f"\n📡 [Cluster {cluster_id}] STEP 2: BRIGHT DATA FULL ARTICLE FETCHING")
            print(f"   Fetching full text for {len(cluster_sources)} sources...")
            
            urls = [s['url'] for s in cluster_sources]
            full_articles = fetch_articles_parallel(urls, max_workers=5)
            
            # Build URL mappings for text and og:image
            url_to_text = {a['url']: a.get('text', '') for a in full_articles if a.get('text')}
            url_to_og_image = {a['url']: a.get('og_image') for a in full_articles if a.get('og_image')}
            
            # Add full text and fetch/upgrade images for ALL sources without images
            for source in cluster_sources:
                source['full_text'] = url_to_text.get(source['url'], source.get('content', ''))
                
                # Check if source has no image or needs upgrade (fetch og:image from Bright Data)
                current_image = source.get('image_url')
                has_no_image = not current_image or not current_image.strip()
                
                # Sources that need og:image upgrade (low-quality RSS images)
                source_url = source.get('url', '').lower()
                source_name = source.get('source_name', source.get('source', '')).lower()
                needs_upgrade = any(domain in source_url or domain in source_name 
                                   for domain in ['bbc.co.uk', 'bbc.com', 'dw.com', 'deutsche welle', 'cbc.ca', 'lemonde.fr', 'venturebeat.com', 'venturebeat'])
                
                # Use og:image from scraped page if source has no image OR needs upgrade
                if (has_no_image or needs_upgrade) and source['url'] in url_to_og_image:
                    og_image = url_to_og_image[source['url']]
                    if og_image:
                        source['image_url'] = og_image
                        if has_no_image:
                            print(f"   📸 [Cluster {cluster_id}] Fetched image for {source.get('source_name', source.get('source', 'Unknown'))}: {og_image[:60]}...")
                        else:
                            print(f"   📸 [Cluster {cluster_id}] Upgraded image for {source.get('source_name', source.get('source', 'Unknown'))}: {og_image[:60]}...")
            
            # Track source article status for analytics
            for source in cluster_sources:
                source_id = source.get('id')
                if source_id:
                    content_ok = bool(source.get('full_text') and len(source.get('full_text', '')) > 100)
                    image_ok = bool(source.get('image_url'))
                    
                    # Update source article tracking
                    update_source_article_status(
                        source_id,
                        content_fetched=content_ok,
                        fetch_failure_reason='blocked' if not content_ok else None,
                        has_image=image_ok
                    )
                    
                    # Track domain reliability
                    domain = extract_domain(source.get('url', ''))
                    if domain:
                        update_source_reliability(domain, success=content_ok, 
                            failure_reason='blocked' if not content_ok else None)
            
            success_count = len([s for s in cluster_sources if s.get('full_text') and len(s.get('full_text', '')) > 100])
            print(f"   ✅ [Cluster {cluster_id}] Fetched full text: {success_count}/{len(cluster_sources)}")
            
            # STRICT: Require actual article content - no description fallback
            if success_count == 0:
                print(f"   ❌ [Cluster {cluster_id}] ELIMINATED: No article content fetched")
                update_cluster_status(cluster_id, 'failed', 'no_content', 
                    f'All {len(cluster_sources)} sources blocked or failed to fetch')
                return False
            
            # STEP 3: Smart Image Selection
            print(f"\n📸 [Cluster {cluster_id}] STEP 3: SMART IMAGE SELECTION")
            
            selector = ImageSelector(debug=True)
            all_candidates = []
            for source in cluster_sources:
                image_url = source.get('image_url') or source.get('urlToImage')
                if not image_url:
                    continue
                all_candidates.append({
                    'url': image_url,
                    'source_name': source.get('source_name', source.get('source', 'Unknown')),
                    'source_url': source.get('url', ''),
                    'article_score': source.get('score', 50),
                    'width': source.get('image_width', 0),
                    'height': source.get('image_height', 0)
                })
            
            valid_candidates = []
            for candidate in all_candidates:
                if selector._is_valid_image(candidate):
                    candidate['quality_score'] = selector._calculate_image_score(candidate)
                    valid_candidates.append(candidate)
            
            if not valid_candidates:
                print(f"   ❌ [Cluster {cluster_id}] ELIMINATED: No image found")
                update_cluster_status(cluster_id, 'failed', 'no_image',
                    f'No usable image found in {len(cluster_sources)} sources')
                return False
            
            valid_candidates.sort(key=lambda x: x['quality_score'], reverse=True)
            
            # STEP 3.1: AI Image Quality Check (Gemini 2.0 Flash)
            print(f"\n🔍 [Cluster {cluster_id}] STEP 3.1: AI IMAGE QUALITY CHECK")
            
            selected_image = None
            try:
                with gemini_semaphore:
                    ai_approved = check_and_select_best_image(valid_candidates, min_confidence=70)
                if ai_approved:
                    selected_image = {
                        'url': ai_approved['url'],
                        'source_name': ai_approved['source_name'],
                        'quality_score': ai_approved['quality_score']
                    }
                    print(f"   ✅ [Cluster {cluster_id}] AI-approved image from {selected_image['source_name']}")
                else:
                    print(f"   ⚠️  [Cluster {cluster_id}] No images passed AI quality check")
            except Exception as e:
                print(f"   ⚠️  [Cluster {cluster_id}] AI quality check failed: {str(e)[:80]}")
            
            if not selected_image:
                selected_image = {
                    'url': valid_candidates[0]['url'],
                    'source_name': valid_candidates[0]['source_name'],
                    'quality_score': valid_candidates[0]['quality_score']
                }
                print(f"   ↩️  [Cluster {cluster_id}] Using rule-based best: {selected_image['source_name']} (score: {selected_image['quality_score']:.1f})")
            
            # STEP 3.5: VALIDATE CLUSTER SOURCES (removes unrelated articles)
            if len(cluster_sources) > 2:
                with gemini_semaphore:
                    cluster_sources = validate_cluster_sources(
                        cluster_sources, 
                        cluster.get('event_name', f'Cluster {cluster_id}')
                    )
                
                if not cluster_sources:
                    print(f"   ❌ [Cluster {cluster_id}] No valid sources after validation")
                    update_cluster_status(cluster_id, 'failed', 'validation_failed',
                        'All sources were unrelated after validation')
                    return False
            
            # STEP 4: MULTI-SOURCE SYNTHESIS
            print(f"\n✍️  [Cluster {cluster_id}] STEP 4: MULTI-SOURCE SYNTHESIS")
            print(f"   Synthesizing article from {len(cluster_sources)} sources...")
            
            synthesized = synthesize_multisource_article(cluster_sources, cluster_id)
            
            if not synthesized:
                print(f"   ❌ [Cluster {cluster_id}] Synthesis failed")
                update_cluster_status(cluster_id, 'failed', 'synthesis_failed',
                    'Claude API failed to synthesize article from sources')
                return False
            
            synthesized['image_url'] = selected_image['url']
            synthesized['image_source'] = selected_image['source_name']
            synthesized['image_score'] = selected_image['quality_score']
            
            print(f"   ✅ [Cluster {cluster_id}] Synthesized: {synthesized['title_news'][:60]}...")
            
            # ==========================================
            # STEPS 5+6: CONTEXT SEARCH + COMPONENT SELECTION (sequential, both Gemini)
            # ==========================================
            print(f"\n🔍 [Cluster {cluster_id}] STEP 5: GEMINI CONTEXT SEARCH")
            
            bullets_text = ' '.join(synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])))
            
            full_article_text = ""
            for source in cluster_sources:
                if source.get('full_text') and len(source.get('full_text', '')) > 100:
                    full_article_text = source['full_text'][:3000]
                    break
            
            gemini_result = None
            search_context_text = ""
            if gemini_key:
                try:
                    with gemini_semaphore:
                        gemini_result = search_gemini_context(
                            synthesized['title_news'], 
                            bullets_text,
                            full_article_text
                        )
                    search_context_text = gemini_result.get('results', '') if gemini_result else ""
                    print(f"   ✅ [Cluster {cluster_id}] Step 5 Complete: ({len(search_context_text)} chars)")
                except Exception as search_error:
                    print(f"   ⚠️ [Cluster {cluster_id}] Step 5 Failed: {search_error}")
                    search_context_text = ""
            
            print(f"\n📋 [Cluster {cluster_id}] STEP 6: GEMINI COMPONENT SELECTION")
            
            article_for_selection = {
                'title': synthesized['title_news'],
                'text': bullets_text,
                'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', []))
            }
            
            selected = []
            component_result = {}
            try:
                with gemini_semaphore:
                    component_result = component_selector.select_components(article_for_selection, search_context_text)
                selected = component_result.get('components', []) if isinstance(component_result, dict) else []
                print(f"   ✅ [Cluster {cluster_id}] Step 6 Complete: [{', '.join(selected) if selected else 'none'}]")
            except Exception as comp_error:
                print(f"   ⚠️ [Cluster {cluster_id}] Step 6 Failed: {comp_error}")
                selected = ['timeline', 'details']
                component_result = {'components': selected, 'emoji': '📰'}
            
            context_data = {}
            if selected and gemini_result:
                for component in selected:
                    context_data[component] = gemini_result
            
            # ==========================================
            # STEP 7: COMPONENT GENERATION (with retry)
            # ==========================================
            print(f"\n📊 [Cluster {cluster_id}] STEP 7: COMPONENT GENERATION")
            
            components = {}
            map_locations = component_result.get('map_locations', []) if isinstance(component_result, dict) else []
            
            if selected and context_data:
                max_component_retries = 3
                for comp_attempt in range(max_component_retries):
                    try:
                        article_for_components = {
                            'title_news': synthesized['title_news'],
                            'summary_bullets_news': synthesized.get('summary_bullets_news', synthesized.get('summary_bullets', [])),
                            'selected_components': selected,
                            'context_data': context_data,
                            'map_locations': map_locations
                        }
                        with gemini_semaphore:
                            generation_result = component_writer.write_components(article_for_components)

                        if generation_result:
                            components = {
                                'timeline': generation_result.get('timeline'),
                                'details': generation_result.get('details'),
                                'graph': generation_result.get('graph'),
                                'map': generation_result.get('map')
                            }
                            components = {k: v for k, v in components.items() if v is not None}

                            missing_components = [c for c in selected if c not in components]
                            if missing_components and comp_attempt < max_component_retries - 1:
                                print(f"   ⚠️ [Cluster {cluster_id}] Missing: {missing_components} - retrying ({comp_attempt + 2}/{max_component_retries})...")
                                time.sleep(2)
                                continue

                            print(f"   ✅ [Cluster {cluster_id}] Step 7 Complete: [{', '.join(components.keys())}]")
                            break

                        if comp_attempt < max_component_retries - 1:
                            print(f"   ⚠️ [Cluster {cluster_id}] No components - retrying ({comp_attempt + 2}/{max_component_retries})...")
                            time.sleep(2)
                            continue
                        components = {}

                    except Exception as comp_gen_error:
                        if comp_attempt < max_component_retries - 1:
                            print(f"   ⚠️ [Cluster {cluster_id}] Component error: {comp_gen_error} - retrying ({comp_attempt + 2}/{max_component_retries})...")
                            time.sleep(2)
                            continue
                        print(f"   ⚠️ [Cluster {cluster_id}] Step 7 Failed: {comp_gen_error}")
                        components = {}
            
            # STEP 8: Fact Verification
            print(f"\n🔍 [Cluster {cluster_id}] STEP 8: FACT VERIFICATION")
            
            max_verification_attempts = 3
            verification_passed = False
            verification_feedback = None
            
            for attempt in range(max_verification_attempts):
                if attempt > 0:
                    print(f"\n   🔄 [Cluster {cluster_id}] REGENERATING (Attempt {attempt + 1}/{max_verification_attempts})")
                    
                    synthesized = synthesize_multisource_article(
                        cluster_sources, 
                        cluster_id,
                        verification_feedback=verification_feedback
                    )
                    
                    if not synthesized:
                        print(f"      ❌ [Cluster {cluster_id}] Regeneration failed")
                        continue
                    
                    if selected_image:
                        synthesized['image_url'] = selected_image['url']
                        synthesized['image_source'] = selected_image['source_name']
                        synthesized['image_score'] = selected_image['quality_score']
                    
                    print(f"      ✅ [Cluster {cluster_id}] New article: {synthesized.get('title_news', '')[:50]}...")
                
                with gemini_semaphore:
                    verified, discrepancies, verification_summary = fact_verifier.verify_article(
                        cluster_sources, 
                        synthesized
                    )
                
                if verified:
                    verification_passed = True
                    print(f"   ✅ [Cluster {cluster_id}] Verification PASSED: {verification_summary}")
                    break
                else:
                    print(f"   ⚠️  [Cluster {cluster_id}] Verification FAILED (Attempt {attempt + 1}/{max_verification_attempts})")
                    if discrepancies:
                        for i, d in enumerate(discrepancies[:3], 1):
                            issue = d.get('issue', 'Unknown')
                            print(f"         {i}. {issue[:80]}...")
                    
                    verification_feedback = {
                        'discrepancies': discrepancies,
                        'summary': verification_summary
                    }
            
            if not verification_passed:
                print(f"\n   ❌ [Cluster {cluster_id}] ELIMINATED: Failed verification after {max_verification_attempts} attempts")
                update_cluster_status(cluster_id, 'failed', 'verification_failed',
                    f'Failed fact verification after {max_verification_attempts} attempts')
                return False
            
            synthesized['image_url'] = selected_image['url']
            synthesized['image_source'] = selected_image['source_name']
            synthesized['image_score'] = selected_image['quality_score']
            
            # STEP 9: Publishing to Supabase
            print(f"\n💾 [Cluster {cluster_id}] STEP 9: PUBLISHING TO SUPABASE")
            
            # Check if already published (prevent duplicates)
            existing = supabase.table('published_articles').select('id').eq('cluster_id', cluster_id).execute()
            if existing.data and len(existing.data) > 0:
                print(f"   ⏭️ [Cluster {cluster_id}] Already published (ID: {existing.data[0]['id']})")
                return False
            
            title = synthesized.get('title', synthesized.get('title_news', ''))
            
            # CHECK FOR SIMILAR TITLES (thread-safe)
            is_duplicate = False
            skip_reason = None
            try:
                clean_new_title = _clean_title(title)
                
                # Check against pre-fetched cache + newly published in this run
                with title_cache_lock:
                    all_titles_to_check = list(published_titles_cache)
                
                for recent in all_titles_to_check:
                    if clean_new_title and recent['clean']:
                        similarity = SequenceMatcher(None, clean_new_title, recent['clean']).ratio()
                        if similarity >= 0.65:
                            print(f"   ⏭️ [Cluster {cluster_id}] DUPLICATE TITLE (similarity: {similarity:.0%})")
                            print(f"      New: {title[:60]}...")
                            print(f"      Existing (ID {recent['id']}): {recent['title_news'][:60]}...")
                            is_duplicate = True
                            skip_reason = "duplicate_title"
                            break
                            
            except Exception as e:
                print(f"   ⚠️ [Cluster {cluster_id}] Duplicate check error: {e}")
            
            if is_duplicate:
                update_cluster_status(cluster_id, 'skipped', 'duplicate',
                    f'Duplicate detected: {skip_reason}')
                return False
            
            # STEPS 10+11: SCORING + TAGGING (run in parallel - both use Gemini independently)
            print(f"\n   🎯 [Cluster {cluster_id}] STEPS 10+11: SCORING + TAGGING (parallel)")
            bullets = synthesized.get('summary_bullets', synthesized.get('summary_bullets_news', []))
            article_category = synthesized.get('category', 'Other')
            
            article_score = 750  # default
            interest_tags = []
            article_countries = []
            article_topics = []
            
            # Wrappers that acquire gemini semaphore before calling API
            def _score_with_sem():
                with gemini_semaphore:
                    return score_article_with_references(title, bullets, gemini_key, supabase)
            def _tags_with_sem():
                with gemini_semaphore:
                    return generate_interest_tags(title, bullets, gemini_key)
            def _tagging_with_sem():
                with gemini_semaphore:
                    return tag_article(title, bullets, article_category, gemini_key)
            
            with ThreadPoolExecutor(max_workers=3) as step_executor:
                # Run scoring, interest tags, and article tagging in parallel (semaphore-throttled)
                score_future = step_executor.submit(_score_with_sem)
                tags_future = step_executor.submit(_tags_with_sem)
                tagging_future = step_executor.submit(_tagging_with_sem)
                
                try:
                    article_score = score_future.result(timeout=30)
                    print(f"   📊 [Cluster {cluster_id}] Score: {article_score}/1000")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Scoring failed: {e}")
                
                try:
                    interest_tags = tags_future.result(timeout=30)
                    print(f"   🏷️ [Cluster {cluster_id}] Tags: {interest_tags}")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Interest tags failed: {e}")
                
                try:
                    tags_result = tagging_future.result(timeout=30)
                    article_countries = tags_result.get('countries', [])
                    article_topics = tags_result.get('topics', [])
                    print(f"   🌍 [Cluster {cluster_id}] Countries: {article_countries}")
                    print(f"   📌 [Cluster {cluster_id}] Topics: {article_topics}")
                except Exception as e:
                    print(f"   ⚠️ [Cluster {cluster_id}] Tagging failed: {e}")
            
            five_ws = synthesized.get('five_ws', {})
            
            source_titles = [
                {
                    'title': s.get('title', 'Unknown'),
                    'source': s.get('source_name', s.get('source', 'Unknown'))
                }
                for s in cluster_sources
            ]
            
            successful_components = [c for c in selected if components.get(c) is not None]
            
            if len(successful_components) < len(selected):
                failed_components = [c for c in selected if c not in successful_components]
                print(f"   ⚠️ [Cluster {cluster_id}] Some components failed: {failed_components}")
            
            article_data = {
                'cluster_id': cluster_id,
                'url': cluster_sources[0]['url'],
                'source': cluster_sources[0]['source_name'],
                'category': synthesized.get('category', 'Other'),
                'title_news': title,
                'summary_bullets_news': bullets,
                'five_ws': five_ws,
                'timeline': components.get('timeline'),
                'details': components.get('details'),
                'graph': components.get('graph'),
                'map': components.get('map'),
                'components_order': successful_components,
                'num_sources': len(cluster_sources),
                'published_at': datetime.now().isoformat(),
                'ai_final_score': article_score,
                'interest_tags': interest_tags,
                'countries': article_countries,
                'topics': article_topics,
                'image_url': synthesized.get('image_url'),
                'image_source': synthesized.get('image_source'),
                'image_score': synthesized.get('image_score'),
                'source_titles': source_titles
            }
            
            result = supabase.table('published_articles').insert(article_data).execute()
            
            published_article_id = result.data[0]['id']
            print(f"   ✅ [Cluster {cluster_id}] Published article ID: {published_article_id}")
            if len(source_titles) > 1:
                print(f"   📚 [Cluster {cluster_id}] MULTI-SOURCE ({len(source_titles)} articles):")
                for st in source_titles:
                    print(f"      • [{st['source']}] {st['title'][:70]}...")
            
            with published_lock:
                published_count += 1
            
            # Add to title cache for other workers' duplicate detection
            with title_cache_lock:
                published_titles_cache.append({
                    'id': published_article_id,
                    'title_news': title,
                    'clean': _clean_title(title)
                })
            
            # Mark cluster as successfully published
            update_cluster_status(cluster_id, 'published')
            
            # WORLD EVENT DETECTION
            try:
                title = synthesized.get('title', synthesized.get('title_news', ''))
                content = synthesized.get('bullets', '')
                
                detect_world_events([{
                    'id': published_article_id,
                    'title': title,
                    'content': content,
                    'bullets': content,
                    'image_url': synthesized.get('image_url'),
                    'components': {
                        'graph': components.get('graph'),
                        'map': components.get('map'),
                        'info_box': components.get('info_box')
                    }
                }])
            except Exception as we_error:
                print(f"   ⚠️ [Cluster {cluster_id}] World event detection skipped: {we_error}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ [Cluster {cluster_id}] Error: {e}")
            update_cluster_status(cluster_id, 'failed', 'api_error', str(e)[:500])
            return False
    
    # ==========================================
    # EXECUTE CLUSTERS IN PARALLEL (3 workers)
    # ==========================================
    MAX_PARALLEL_CLUSTERS = 10
    print(f"\n⚡ Processing {len(clusters_to_process)} clusters with {MAX_PARALLEL_CLUSTERS} parallel workers...")
    
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_CLUSTERS) as cluster_executor:
        future_to_cluster = {
            cluster_executor.submit(process_single_cluster, cid): cid 
            for cid in clusters_to_process
        }
        
        for future in as_completed(future_to_cluster):
            cid = future_to_cluster[future]
            try:
                result = future.result()
                if result:
                    print(f"   ✅ Cluster {cid} completed successfully")
                else:
                    print(f"   ⏭️ Cluster {cid} skipped or failed")
            except Exception as e:
                print(f"   ❌ Cluster {cid} exception: {e}")
    
    # Summary
    print(f"\n{'='*80}")
    print(f"✅ PIPELINE COMPLETE")
    print(f"{'='*80}")
    print(f"   Articles fetched: {len(articles)}")
    print(f"   Approved (Step 1): {len(approved_articles)}")
    print(f"   Clusters processed: {len(clusters_to_process)}")
    print(f"   Articles published: {published_count}")
    print(f"{'='*80}\n")


# ==========================================
# MULTI-SOURCE SYNTHESIS
# ==========================================

def synthesize_multisource_article(sources: List[Dict], cluster_id: int, verification_feedback: Optional[Dict] = None) -> Optional[Dict]:
    """
    Synthesize one article from multiple sources using Claude (better rate limits than Gemini)
    
    Args:
        sources: List of source articles
        cluster_id: Cluster ID
        verification_feedback: Optional dict with 'discrepancies' and 'summary' from failed verification
    """
    import requests
    import json
    import time
    
    # Use Claude API (better rate limits than Gemini)
    claude_url = "https://api.anthropic.com/v1/messages"
    claude_headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
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

CRITICAL RULES:
1. ALWAYS output valid JSON - never explanations or commentary
2. If sources cover different topics, focus on the MAJORITY topic
3. If sources are completely unrelated, pick the MOST newsworthy one
4. NEVER say "Looking at the sources" or explain your reasoning
5. Output starts with {{ and ends with }} - nothing else

Return ONLY valid JSON, no markdown, no explanations."""
    
    # Try up to 5 times with exponential backoff
    for attempt in range(5):
        try:
            # Build Claude API request
            request_data = {
                "model": "claude-sonnet-4-5-20250929",
                "max_tokens": 2048,
                "temperature": 0.3,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            
            response = requests.post(claude_url, headers=claude_headers, json=request_data, timeout=60)
            
            # Handle rate limiting with exponential backoff
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 10  # 10s, 20s, 40s, 80s, 160s
                print(f"   ⚠️  Rate limited (attempt {attempt + 1}/5) - waiting {wait_time}s...")
                time.sleep(wait_time)
                continue

            if response.status_code >= 400:
                # Log the actual error body for debugging
                try:
                    error_body = response.json()
                    error_msg = error_body.get('error', {}).get('message', response.text[:500])
                    error_type = error_body.get('error', {}).get('type', 'unknown')
                    print(f"   ⚠️  API error (attempt {attempt + 1}/5): [{error_type}] {error_msg}")
                except Exception:
                    print(f"   ⚠️  API error (attempt {attempt + 1}/5): HTTP {response.status_code} - {response.text[:500]}")
                if attempt < 4:
                    time.sleep(3)
                continue

            response_json = response.json()
            
            # Check if response has expected structure
            if 'content' not in response_json or not response_json['content']:
                print(f"   ⚠️  No content in Claude response (attempt {attempt + 1}/5)")
                print(f"      Response: {str(response_json)[:200]}")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None
            
            # Get response text from Claude format
            response_text = response_json['content'][0].get('text', '')
            
            if not response_text:
                print(f"   ⚠️  Empty response from Claude (attempt {attempt + 1}/5)")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None
            
            # Clean response (remove markdown if present)
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            # Debug: Check if response is empty after cleaning
            if not response_text:
                print(f"   ⚠️  Response empty after cleaning (attempt {attempt + 1}/5)")
                print(f"      Original length: {len(response_json['content'][0].get('text', ''))}")
                if attempt < 4:
                    time.sleep(5)
                    continue
                return None
            
            # Check if Claude returned commentary instead of JSON
            if response_text.startswith('Looking') or response_text.startswith('I ') or not response_text.startswith('{'):
                print(f"   ⚠️  Claude returned text instead of JSON (attempt {attempt + 1}/5)")
                print(f"      Preview: {response_text[:100]}...")
                if attempt < 4:
                    time.sleep(3)
                    continue
                return None
            
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
                print(f"   ⚠️  Missing fields: {missing} (attempt {attempt + 1}/5)")
                if attempt < 4:
                    time.sleep(3)
                    continue
                return None
            
        except json.JSONDecodeError as e:
            print(f"   ⚠️  JSON parse error (attempt {attempt + 1}/5): {str(e)[:100]}")
            print(f"      Response preview: {response_text[:200] if response_text else 'EMPTY'}...")
            if attempt < 4:
                time.sleep(3)
                continue
            return None
            
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            print(f"   ⚠️  API error (attempt {attempt + 1}/5): {error_msg[:100]}")
            if attempt < 4:
                time.sleep(3)
            continue
            
        except Exception as e:
            print(f"   ⚠️  Synthesis error (attempt {attempt + 1}/5): {str(e)[:100]}")
            if attempt < 4:
                time.sleep(3)
                continue
            return None
    
    print(f"   ❌ Failed after 5 attempts")
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


#!/usr/bin/env python3
"""
STEP 1.5: EVENT CLUSTERING ENGINE
==========================================
Purpose: Group articles about the same event for multi-source synthesis
Input: Approved articles from Step 1 (Gemini scoring)
Output: Clusters of articles about the same event
Algorithm: Title similarity (75%) OR keyword overlap (3+)
"""

import re
import os
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from collections import Counter
from urllib.parse import urlparse, parse_qs, urlunparse
from supabase import create_client, Client
from dotenv import load_dotenv
import anthropic
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

load_dotenv()

# ==========================================
# ANTHROPIC CLIENT FOR AI SIMILARITY CHECK
# ==========================================

def get_anthropic_client():
    """Get Anthropic client for Claude Haiku 4.5"""
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY must be set in environment")
    return anthropic.Anthropic(api_key=api_key)

# ==========================================
# CONFIGURATION
# ==========================================

class ClusteringConfig:
    """Configuration for clustering algorithm"""
    
    # Matching thresholds - MORE LENIENT to prevent duplicate articles
    TITLE_SIMILARITY_THRESHOLD = 0.60  # 60% title similarity = same event (lowered from 75%)
    MIN_TITLE_SIMILARITY = 0.40  # Minimum 40% title similarity even with keyword match (lowered from 55%)
    KEYWORD_MATCH_THRESHOLD = 3  # 3+ shared keywords = same event (lowered from 5)
    ENTITY_MATCH_THRESHOLD = 2  # 2+ shared entities adds confidence
    
    # Time windows
    MAX_CLUSTER_AGE_HOURS = 24  # Only match with clusters created in last 24h
    MAX_ARTICLE_AGE_HOURS = 48  # Only process articles from last 48h
    
    # Cluster lifecycle
    CLUSTER_INACTIVITY_HOURS = 24  # Close cluster after 24h without updates
    CLUSTER_MAX_LIFETIME_HOURS = 48  # Close cluster after 48h regardless
    
    # PARALLEL PROCESSING SETTINGS
    PARALLEL_WORKERS = 3  # Number of parallel threads (reduced from 5 to prevent Supabase connection issues)
    BATCH_SIZE = 8  # Number of articles to batch in one AI call (reduced for stability)
    
    # Keywords to ignore (stopwords)
    STOPWORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'said', 'says',
        'new', 'news', 'today', 'now', 'just', 'after', 'report', 'reports',
        'breaking', 'live', 'update', 'latest', 'here', 'what', 'how', 'why',
        'when', 'where', 'who', 'which', 'that', 'this', 'these', 'those'
    }
    
    # Tracking parameters to remove from URLs
    TRACKING_PARAMS = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'source', 'fbclid', 'gclid', '_ga', 'mc_cid', 'mc_eid',
        'icid', 'ncid', 'ocid', 'sr_share'
    }


# ==========================================
# URL NORMALIZATION
# ==========================================

def normalize_url(url: str) -> str:
    """
    Normalize URL by removing tracking parameters and www.
    
    Example:
        Input: https://www.bbc.com/news/article?utm_source=rss&ref=twitter
        Output: https://bbc.com/news/article
    
    Args:
        url: Original URL with potential tracking parameters
        
    Returns:
        Cleaned, normalized URL for duplicate detection
    """
    try:
        parsed = urlparse(url)
        
        # Remove www. from domain
        domain = parsed.netloc.replace('www.', '')
        
        # Parse query parameters
        query_params = parse_qs(parsed.query)
        
        # Remove tracking parameters
        clean_params = {
            k: v for k, v in query_params.items() 
            if k not in ClusteringConfig.TRACKING_PARAMS
        }
        
        # Reconstruct query string
        clean_query = '&'.join([f"{k}={v[0]}" for k, v in clean_params.items()])
        
        # Reconstruct URL without fragment
        normalized = urlunparse((
            parsed.scheme,
            domain,
            parsed.path,
            parsed.params,
            clean_query,
            ''  # Remove fragment
        ))
        
        return normalized.lower().rstrip('/')
        
    except Exception as e:
        print(f"⚠️ URL normalization error: {e}")
        return url.lower().rstrip('/')


# ==========================================
# KEYWORD & ENTITY EXTRACTION
# ==========================================

def extract_keywords(title: str, description: str = None) -> List[str]:
    """
    Extract significant keywords from title and description.
    Focus on proper nouns, locations, and important terms.
    
    Args:
        title: Article title
        description: Article description (optional)
        
    Returns:
        List of top 10 keywords (lowercase)
    """
    text = title
    if description:
        text = f"{title} {description}"
    
    # Find proper nouns (capitalized words) before lowercasing
    proper_nouns = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    proper_nouns_lower = [p.lower() for p in proper_nouns]
    
    # Lowercase and tokenize
    text_lower = text.lower()
    words = re.findall(r'\b[a-z]{3,}\b', text_lower)
    
    # Remove stopwords
    keywords = [w for w in words if w not in ClusteringConfig.STOPWORDS]
    
    # Combine and count
    all_keywords = keywords + proper_nouns_lower
    keyword_counts = Counter(all_keywords)
    
    # Return top 10 most common
    top_keywords = [word for word, count in keyword_counts.most_common(10)]
    
    return top_keywords


def extract_entities(title: str, description: str = None) -> List[str]:
    """
    Extract named entities (people, places, organizations).
    Uses simple pattern matching for entities (sequences of capitalized words).
    
    Args:
        title: Article title
        description: Article description (optional)
        
    Returns:
        List of unique entities
    """
    text = title
    if description:
        text = f"{title} {description}"
    
    # Pattern: sequences of capitalized words (potential entities)
    # Examples: "Donald Trump", "United States", "European Central Bank"
    entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    
    # Deduplicate and return
    return list(set(entities))


# ==========================================
# TITLE SIMILARITY
# ==========================================

def calculate_title_similarity(title1: str, title2: str) -> float:
    """
    Calculate similarity ratio between two titles (legacy string-based method).
    
    Args:
        title1: First title
        title2: Second title
        
    Returns:
        Similarity score between 0.0 and 1.0
        (0.75+ indicates same event)
    """
    # Normalize titles
    t1 = title1.lower().strip()
    t2 = title2.lower().strip()
    
    # Remove punctuation for comparison
    t1 = re.sub(r'[^\w\s]', '', t1)
    t2 = re.sub(r'[^\w\s]', '', t2)
    
    # Calculate similarity using SequenceMatcher
    similarity = SequenceMatcher(None, t1, t2).ratio()
    
    return similarity


# ==========================================
# AI-POWERED TITLE SIMILARITY (Claude Haiku 4.5)
# ==========================================

def check_title_similarity_ai(new_title: str, cluster_titles: List[Tuple[int, str]], debug: bool = False) -> Dict[int, bool]:
    """
    Use Claude Haiku 4.5 to determine if a new article covers the same event as existing clusters.
    
    Args:
        new_title: Title of the new article to check
        cluster_titles: List of tuples (cluster_id, cluster_representative_title)
        debug: If True, print debug information
        
    Returns:
        Dict mapping cluster_id to True (same event) or False (different event)
    """
    if not cluster_titles:
        return {}
    
    # Build the prompt with numbered clusters
    cluster_list = "\n".join([f"{i+1}. {title}" for i, (_, title) in enumerate(cluster_titles)])
    
    prompt = f"""Match news articles about the SAME story (even if worded differently).

SAME STORY (match YES):
- Same news event reported by different sources (BBC vs CNN vs Reuters)
- Same announcement/incident with different headlines
- Example: "Trump Wins Election" = "Donald Trump Declared President-Elect" = "Republicans Celebrate Trump Victory"

DIFFERENT STORY (match NO):
- Completely different events or topics
- Different dates/incidents (yesterday's event vs today's)

NEW ARTICLE: "{new_title}"

CLUSTERS:
{cluster_list}

Reply ONLY: 1:YES, 2:NO, 3:YES (etc.) - be GENEROUS with YES if it's the same news story.
Nothing else."""

    try:
        client = get_anthropic_client()
        
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=200,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        result_text = response.content[0].text.strip()
        
        # Extract just the first line (the actual response)
        first_line = result_text.split('\n')[0].strip()
        
        if debug:
            print(f"  🤖 AI Response: {first_line}")
        
        # Parse the response: "1:YES, 2:NO, 3:NO, ..." or just "22:YES" for matches only
        results = {}
        
        # Initialize ALL clusters as NO (not matching) - AI only returns what it finds
        for cluster_id, _ in cluster_titles:
            results[cluster_id] = False
        
        # Handle various formats the AI might use
        parts = first_line.replace(" ", "").replace(";", ",").split(",")
        for part in parts:
            if ":" in part:
                try:
                    # Extract number and decision
                    idx_str, decision = part.split(":", 1)
                    # Clean up any non-numeric characters from index
                    idx_str = ''.join(c for c in idx_str if c.isdigit())
                    if idx_str:
                        idx = int(idx_str) - 1  # Convert to 0-based index
                        if 0 <= idx < len(cluster_titles):
                            cluster_id = cluster_titles[idx][0]
                            # Check if decision contains YES
                            results[cluster_id] = "YES" in decision.upper()
                except (ValueError, IndexError):
                    continue
        
        return results
        
    except Exception as e:
        print(f"  ❌ AI similarity check error: {e}")
        print(f"  ℹ️  Falling back to legacy string-based matching for all clusters")
        # Return None for all clusters to signal "use fallback" (not "AI said no match")
        # This ensures the legacy keyword/entity matching is used when AI is unavailable
        return {cluster_id: None for cluster_id, _ in cluster_titles}


def check_batch_articles_similarity_ai(articles_with_titles: List[Tuple[int, str]], cluster_titles: List[Tuple[int, str]], debug: bool = False) -> Dict[int, Dict[int, bool]]:
    """
    BATCH CHECK: Use Claude Haiku 4.5 to check MULTIPLE articles against clusters in ONE call.
    Much faster than checking one article at a time!
    
    Args:
        articles_with_titles: List of tuples (article_index, article_title)
        cluster_titles: List of tuples (cluster_id, cluster_representative_title)
        debug: If True, print debug information
        
    Returns:
        Dict mapping article_index -> Dict[cluster_id -> True/False/None]
    """
    if not cluster_titles or not articles_with_titles:
        return {}
    
    # Build the prompt with numbered articles and clusters
    articles_list = "\n".join([f"A{i+1}. {title}" for i, (_, title) in enumerate(articles_with_titles)])
    cluster_list = "\n".join([f"C{i+1}. {title}" for i, (_, title) in enumerate(cluster_titles)])
    
    prompt = f"""Match news articles to clusters covering the SAME story (even if worded differently).

SAME STORY (should match):
- Same news event from different sources (BBC, CNN, Reuters covering same thing)
- Same announcement with different headlines
- Example: "Biden Signs Climate Bill" matches "President Signs Landmark Climate Legislation"

DIFFERENT (no match):
- Completely unrelated topics
- Different incidents/dates

NEW ARTICLES:
{articles_list}

EXISTING CLUSTERS:
{cluster_list}

For each article, which cluster covers the SAME news story? Be GENEROUS - if it's about the same event, match it!
Format: A1:C3, A2:NONE, A3:C1
Reply ONLY the matches."""

    try:
        client = get_anthropic_client()
        
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=500,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        result_text = response.content[0].text.strip()
        first_line = result_text.split('\n')[0].strip()
        
        if debug:
            print(f"  🤖 Batch AI Response: {first_line}")
        
        # Initialize results - all articles start with no matches
        results = {}
        for article_idx, _ in articles_with_titles:
            results[article_idx] = {cluster_id: False for cluster_id, _ in cluster_titles}
        
        # Parse response: "A1:C3, A2:NONE, A3:C1"
        parts = first_line.replace(" ", "").replace(";", ",").split(",")
        for part in parts:
            if ":" in part:
                try:
                    article_part, cluster_part = part.split(":", 1)
                    
                    # Extract article index (A1 -> 0)
                    article_num = ''.join(c for c in article_part if c.isdigit())
                    if not article_num:
                        continue
                    article_list_idx = int(article_num) - 1
                    
                    if article_list_idx < 0 or article_list_idx >= len(articles_with_titles):
                        continue
                    
                    article_idx = articles_with_titles[article_list_idx][0]
                    
                    # Check if it's NONE or a cluster match
                    if "NONE" in cluster_part.upper():
                        continue  # Already initialized as False
                    
                    # Extract cluster index (C3 -> 2)
                    cluster_num = ''.join(c for c in cluster_part if c.isdigit())
                    if not cluster_num:
                        continue
                    cluster_list_idx = int(cluster_num) - 1
                    
                    if cluster_list_idx < 0 or cluster_list_idx >= len(cluster_titles):
                        continue
                    
                    cluster_id = cluster_titles[cluster_list_idx][0]
                    results[article_idx][cluster_id] = True
                    
                except (ValueError, IndexError):
                    continue
        
        return results
        
    except Exception as e:
        print(f"  ❌ Batch AI similarity check error: {e}")
        # Return None for all to signal "use fallback"
        results = {}
        for article_idx, _ in articles_with_titles:
            results[article_idx] = {cluster_id: None for cluster_id, _ in cluster_titles}
        return results


# ==========================================
# EVENT MATCHING
# ==========================================

def check_time_proximity(article: Dict, cluster: Dict) -> bool:
    """
    Check if an article is within the time window for a cluster.
    
    Args:
        article: Article with published_at
        cluster: Cluster with created_at
        
    Returns:
        True if within time window, False otherwise
    """
    try:
        cluster_created = datetime.fromisoformat(cluster['created_at'].replace('Z', '+00:00'))
        article_published = article.get('published_at')
        
        if article_published:
            if isinstance(article_published, str):
                article_published = datetime.fromisoformat(article_published.replace('Z', '+00:00'))
            
            time_diff = abs((article_published - cluster_created).total_seconds() / 3600)
            if time_diff > ClusteringConfig.MAX_CLUSTER_AGE_HOURS:
                return False
        return True
    except Exception:
        return True  # On error, allow the comparison


def is_same_event(article: Dict, cluster: Dict, cluster_sources: List[Dict], debug: bool = False, ai_decision: Optional[bool] = None) -> Dict:
    """
    Determine if an article belongs to an existing cluster.
    
    Uses AI-powered semantic matching via Claude Haiku 4.5.
    
    Args:
        article: Article to match with title, keywords, entities, published_at
        cluster: Cluster metadata with created_at
        cluster_sources: List of source articles in the cluster
        debug: If True, print debug information
        ai_decision: Pre-computed AI decision (True=same event, False=different, None=not checked)
        
    Returns:
        Dict with 'match' (bool), 'reason' (str), 'title_sim' (float), 'shared_keywords' (list)
    """
    # Check 1: Time proximity (24 hours)
    if not check_time_proximity(article, cluster):
        return {'match': False, 'reason': 'too_old', 'title_sim': 0.0, 'shared_keywords': []}
    
    # Check 2: AI decision (if provided from batched call)
    # ai_decision can be: True (match), False (no match), or None (AI unavailable, use fallback)
    if ai_decision is True:
        if debug:
            print(f"  ✅ AI MATCH: Claude Haiku determined this is the same event")
        return {'match': True, 'reason': 'ai_semantic_match', 'title_sim': 1.0, 'shared_keywords': []}
    elif ai_decision is False:
        if debug:
            print(f"  ❌ AI REJECTED: Claude Haiku determined this is a different event")
        return {'match': False, 'reason': 'ai_semantic_different', 'title_sim': 0.0, 'shared_keywords': []}
    
    # Fallback: Legacy string-based matching (ai_decision is None - AI unavailable or errored)
    if debug:
        print(f"  ⚠️  Using fallback matching (AI unavailable)")
    if not cluster_sources:
        return {'match': False, 'reason': 'no_sources', 'title_sim': 0.0, 'shared_keywords': []}
    
    representative = max(cluster_sources, key=lambda x: x.get('score', 0))
    
    article_title = article.get('title', '')
    representative_title = representative.get('title', '')
    
    title_similarity = calculate_title_similarity(article_title, representative_title)
    
    # STRONG MATCH: High title similarity (75%+)
    if title_similarity >= ClusteringConfig.TITLE_SIMILARITY_THRESHOLD:
        if debug:
            print(f"  ✅ FALLBACK STRONG MATCH: Title similarity {title_similarity:.2%} >= {ClusteringConfig.TITLE_SIMILARITY_THRESHOLD:.0%}")
        return {'match': True, 'reason': 'high_title_similarity', 'title_sim': title_similarity, 'shared_keywords': []}
    
    # Check keyword/entity overlap only if title similarity meets minimum threshold (55%+)
    if title_similarity < ClusteringConfig.MIN_TITLE_SIMILARITY:
        if debug:
            print(f"  ❌ FALLBACK REJECTED: Title similarity {title_similarity:.2%} < minimum {ClusteringConfig.MIN_TITLE_SIMILARITY:.0%}")
        return {'match': False, 'reason': 'title_too_different', 'title_sim': title_similarity, 'shared_keywords': []}
    
    # Get keywords and entities for overlap check
    article_keywords = set(article.get('keywords', []))
    article_entities = set(article.get('entities', []))
    
    rep_keywords = set(representative.get('keywords', []))
    rep_entities = set(representative.get('entities', []))
    
    shared_keywords = article_keywords.intersection(rep_keywords)
    shared_entities = article_entities.intersection(rep_entities)
    
    # MODERATE MATCH: Good keyword overlap + decent title similarity
    if len(shared_keywords) >= ClusteringConfig.KEYWORD_MATCH_THRESHOLD:
        if debug:
            print(f"  ✅ FALLBACK KEYWORD MATCH: Title {title_similarity:.2%}, Keywords: {len(shared_keywords)}/{ClusteringConfig.KEYWORD_MATCH_THRESHOLD} ({', '.join(list(shared_keywords)[:5])}...)")
        return {'match': True, 'reason': 'keyword_match', 'title_sim': title_similarity, 'shared_keywords': list(shared_keywords)}
    
    # ENTITY MATCH: Shared named entities (people, places, orgs) + decent title similarity
    if len(shared_entities) >= ClusteringConfig.ENTITY_MATCH_THRESHOLD:
        if debug:
            print(f"  ✅ FALLBACK ENTITY MATCH: Title {title_similarity:.2%}, Entities: {len(shared_entities)}/{ClusteringConfig.ENTITY_MATCH_THRESHOLD} ({', '.join(list(shared_entities))})")
        return {'match': True, 'reason': 'entity_match', 'title_sim': title_similarity, 'shared_keywords': list(shared_entities)}
    
    if debug:
        print(f"  ❌ FALLBACK NO MATCH: Title {title_similarity:.2%}, Keywords: {len(shared_keywords)}, Entities: {len(shared_entities)} (AI was not available)")
    
    return {'match': False, 'reason': 'insufficient_overlap', 'title_sim': title_similarity, 'shared_keywords': list(shared_keywords)}


# ==========================================
# SUPABASE CLIENT
# ==========================================

def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment")
    
    return create_client(url, key)


# ==========================================
# CLUSTERING ENGINE
# ==========================================

class EventClusteringEngine:
    """
    Main clustering engine that groups articles about the same event.
    """
    
    def __init__(self):
        """Initialize clustering engine with Supabase client"""
        self.supabase = get_supabase_client()
        self.config = ClusteringConfig()
    
    def get_or_create_source_article(self, article: Dict, max_retries: int = 3) -> Optional[int]:
        """
        Get existing article from source_articles by URL, or create if not exists.
        Includes retry logic for transient connection issues.
        
        Args:
            article: Article dict with url, title, description, etc.
            max_retries: Number of retry attempts for connection failures
            
        Returns:
            Article ID if successful, None if failed
        """
        import time
        
        for attempt in range(max_retries):
            try:
                # Normalize URL
                normalized_url = normalize_url(article.get('url', ''))
                
                # Try to find existing article first
                result = self.supabase.table('source_articles').select('id').eq(
                    'normalized_url', normalized_url
                ).execute()
                
                if result.data and len(result.data) > 0:
                    # Article already exists, return its ID
                    return result.data[0]['id']
                
                # Article doesn't exist, create it
                # Extract keywords and entities
                keywords = extract_keywords(
                    article.get('title', ''),
                    article.get('description', '')
                )
                entities = extract_entities(
                    article.get('title', ''),
                    article.get('description', '')
                )
                
                # Prepare article data
                article_data = {
                    'url': article.get('url', ''),
                    'normalized_url': normalized_url,
                    'title': article.get('title', ''),
                    'description': article.get('description', ''),
                    'content': article.get('content', article.get('text', '')),
                    'source_name': article.get('source', 'Unknown'),
                    'source_url': article.get('url', ''),
                    'published_at': article.get('published_date', article.get('published_at')),
                    'score': article.get('score', 0),
                    'keywords': keywords,
                    'entities': entities,
                    'category': article.get('category', article.get('ai_category', 'World News')),
                    'cluster_id': None,  # Not yet clustered
                    'image_url': article.get('image_url')  # Image from RSS feed
                }
                
                # Insert into source_articles
                result = self.supabase.table('source_articles').insert(article_data).execute()
                
                if result.data:
                    return result.data[0]['id']
                
                return None
                
            except Exception as e:
                error_str = str(e)
                error_lower = error_str.lower()
                
                # Handle duplicate key violation (article already exists)
                if '23505' in error_str or 'duplicate key' in error_lower or 'unique_normalized_url' in error_str:
                    # This is expected - article was inserted by another process or previous run
                    # Try to fetch the existing article
                    try:
                        normalized_url = normalize_url(article.get('url', ''))
                        result = self.supabase.table('source_articles').select('id').eq(
                            'normalized_url', normalized_url
                        ).execute()
                        if result.data and len(result.data) > 0:
                            return result.data[0]['id']  # Return existing article ID
                    except:
                        pass
                    return None  # Could not fetch, but not a critical error
                
                # Retry on connection-related errors
                if any(err in error_lower for err in ['disconnect', 'timeout', 'connection', 'reset']):
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 0.5  # 0.5s, 1s, 1.5s
                        time.sleep(wait_time)
                        continue
                print(f"❌ Error getting/creating source article: {e}")
                return None
        
        return None
    
    def get_active_clusters(self) -> List[Dict]:
        """
        Get all active clusters (not closed, updated within 24 hours).
        
        Returns:
            List of cluster dicts
        """
        try:
            # Get clusters updated in last 24 hours
            cutoff_time = datetime.utcnow() - timedelta(hours=self.config.MAX_CLUSTER_AGE_HOURS)
            
            result = self.supabase.table('clusters').select('*').eq(
                'status', 'active'
            ).gte(
                'last_updated_at', cutoff_time.isoformat()
            ).order('last_updated_at', desc=True).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting active clusters: {e}")
            return []
    
    def get_cluster_sources(self, cluster_id: int) -> List[Dict]:
        """
        Get all source articles for a cluster.
        
        Args:
            cluster_id: Cluster ID
            
        Returns:
            List of source article dicts
        """
        try:
            result = self.supabase.table('source_articles').select(
                '*'
            ).eq(
                'cluster_id', cluster_id
            ).order('score', desc=True).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting cluster sources: {e}")
            return []
    
    def create_cluster(self, article: Dict, source_article_id: int) -> Optional[int]:
        """
        Create a new cluster for an article that doesn't match existing clusters.
        
        Args:
            article: Article dict
            source_article_id: ID of the source article in database
            
        Returns:
            Cluster ID if successful, None if failed
        """
        try:
            # Generate event name (simplified title)
            event_name = self._generate_event_name(article.get('title', ''))
            
            # Create cluster
            cluster_data = {
                'event_name': event_name,
                'main_title': article.get('title', ''),
                'status': 'active',
                'source_count': 1,
                'importance_score': article.get('score', 0)
            }
            
            result = self.supabase.table('clusters').insert(cluster_data).execute()
            
            if result.data:
                cluster_id = result.data[0]['id']
                
                # Assign article to cluster
                self.supabase.table('source_articles').update({
                    'cluster_id': cluster_id
                }).eq('id', source_article_id).execute()
                
                return cluster_id
            
            return None
            
        except Exception as e:
            print(f"❌ Error creating cluster: {e}")
            return None
    
    def add_to_cluster(self, cluster_id: int, source_article_id: int) -> bool:
        """
        Add a source article to an existing cluster.
        
        Args:
            cluster_id: Cluster ID
            source_article_id: Source article ID
            
        Returns:
            True if successful
        """
        try:
            # Update source article's cluster_id
            self.supabase.table('source_articles').update({
                'cluster_id': cluster_id
            }).eq('id', source_article_id).execute()
            
            # Update cluster's last_updated_at (trigger will handle source_count and importance_score)
            self.supabase.table('clusters').update({
                'last_updated_at': datetime.utcnow().isoformat()
            }).eq('id', cluster_id).execute()
            
            return True
            
        except Exception as e:
            print(f"❌ Error adding to cluster: {e}")
            return False
    
    def _generate_event_name(self, title: str) -> str:
        """
        Generate a concise event name from article title.
        Removes filler words, keeps key terms.
        
        Args:
            title: Article title
            
        Returns:
            Concise event name (5-7 words)
        """
        # Remove common news phrases
        filler_phrases = [
            'breaking:', 'live:', 'just in:', 'update:', 'latest:',
            'here\'s what', 'what to know', 'what we know', 'everything you need to know'
        ]
        
        clean_title = title.lower()
        for phrase in filler_phrases:
            clean_title = clean_title.replace(phrase, '')
        
        # Take first 5-7 words
        words = clean_title.split()[:7]
        
        return ' '.join(words).strip().title()
    
    def cluster_articles(self, articles: List[Dict]) -> Dict:
        """
        Main clustering algorithm: group articles by event.
        NOW WITH PARALLEL PROCESSING for faster AI similarity checks!
        
        Process:
        1. Save all articles to source_articles table (parallel)
        2. Get active clusters and cache cluster sources
        3. Batch articles and check against clusters in parallel
        4. Process results and create/update clusters
        
        Args:
            articles: List of approved articles from Step 1
            
        Returns:
            Dict with clustering statistics and cluster IDs
        """
        print(f"\n{'='*60}")
        print(f"STEP 1.5: EVENT CLUSTERING (PARALLEL MODE)")
        print(f"{'='*60}")
        print(f"Total articles to cluster: {len(articles)}")
        print(f"⚡ Using {self.config.PARALLEL_WORKERS} parallel workers, batch size {self.config.BATCH_SIZE}\n")
        
        stats = {
            'total_articles': len(articles),
            'saved_articles': 0,
            'matched_to_existing': 0,
            'new_clusters_created': 0,
            'failed': 0,
            'cluster_ids': []  # Track ALL affected cluster IDs (new + updated)
        }
        
        # Thread-safe lock for stats and active_clusters
        stats_lock = threading.Lock()
        
        # Get active clusters
        active_clusters = self.get_active_clusters()
        print(f"📊 Found {len(active_clusters)} active clusters")
        
        # Pre-fetch cluster sources for all active clusters (cached)
        print(f"📦 Pre-caching cluster sources...")
        cluster_sources_cache = {}
        cluster_titles_cache = []  # (cluster_id, rep_title)
        
        for cluster in active_clusters:
            sources = self.get_cluster_sources(cluster['id'])
            cluster_sources_cache[cluster['id']] = sources
            if sources:
                rep = max(sources, key=lambda x: x.get('score', 0))
                rep_title = rep.get('title', cluster.get('main_title', ''))
                cluster_titles_cache.append((cluster['id'], rep_title))
        
        print(f"✅ Cached {len(cluster_titles_cache)} clusters with sources\n")
        
        # PHASE 1: Save all articles to database in parallel
        print(f"📝 Phase 1: Saving articles to database...")
        article_source_ids = {}  # article_index -> source_id
        
        def save_article(idx_article_tuple):
            idx, article = idx_article_tuple
            source_id = self.get_or_create_source_article(article)
            return idx, source_id
        
        with ThreadPoolExecutor(max_workers=self.config.PARALLEL_WORKERS) as executor:
            futures = [executor.submit(save_article, (i, a)) for i, a in enumerate(articles)]
            for future in as_completed(futures):
                idx, source_id = future.result()
                if source_id:
                    article_source_ids[idx] = source_id
                    with stats_lock:
                        stats['saved_articles'] += 1
                else:
                    with stats_lock:
                        stats['failed'] += 1
        
        print(f"✅ Saved {stats['saved_articles']}/{len(articles)} articles\n")
        
        # Prepare articles for clustering (add keywords/entities)
        for i, article in enumerate(articles):
            article['keywords'] = extract_keywords(
                article.get('title', ''),
                article.get('description', '')
            )
            article['entities'] = extract_entities(
                article.get('title', ''),
                article.get('description', '')
            )
            article['_idx'] = i  # Track original index
        
        # PHASE 2: Batch AI similarity checks
        print(f"🤖 Phase 2: AI similarity checks (batched & parallel)...")
        
        # Filter articles that were saved successfully
        valid_articles = [(i, articles[i]) for i in article_source_ids.keys()]
        
        # Process in batches
        batch_size = self.config.BATCH_SIZE
        all_ai_results = {}  # article_idx -> {cluster_id -> True/False/None}
        
        def process_batch(batch_articles):
            """Process a batch of articles against all clusters"""
            if not cluster_titles_cache:
                return {idx: {} for idx, _ in batch_articles}
            
            # Check time proximity for each article
            batch_with_valid_clusters = []
            for idx, article in batch_articles:
                # For simplicity, assume all clusters are time-valid
                # (more precise filtering can be added if needed)
                batch_with_valid_clusters.append((idx, article.get('title', '')))
            
            if not batch_with_valid_clusters:
                return {idx: {} for idx, _ in batch_articles}
            
            # Make single batched AI call for this batch
            return check_batch_articles_similarity_ai(
                batch_with_valid_clusters,
                cluster_titles_cache,
                debug=False
            )
        
        # Process batches in parallel
        batches = [valid_articles[i:i + batch_size] for i in range(0, len(valid_articles), batch_size)]
        print(f"   Processing {len(batches)} batches of up to {batch_size} articles each...")
        
        with ThreadPoolExecutor(max_workers=self.config.PARALLEL_WORKERS) as executor:
            batch_futures = {executor.submit(process_batch, batch): batch for batch in batches}
            completed = 0
            for future in as_completed(batch_futures):
                batch_results = future.result()
                all_ai_results.update(batch_results)
                completed += 1
                if completed % 3 == 0 or completed == len(batches):
                    print(f"   ✓ Completed {completed}/{len(batches)} batches")
        
        print(f"✅ AI checks complete\n")
        
        # PHASE 3: Process results and assign to clusters
        print(f"\n{'='*80}")
        print(f"📊 PHASE 3: ASSIGNING ARTICLES TO CLUSTERS (DETAILED)")
        print(f"{'='*80}")
        
        # Track NEW clusters created in THIS batch (need AI check for these)
        new_batch_clusters = []  # List of (cluster_id, title) tuples
        original_cluster_count = len(active_clusters)  # Clusters before this batch
        
        for i, article in enumerate(articles):
            if i not in article_source_ids:
                continue  # Article wasn't saved successfully
            
            source_id = article_source_ids[i]
            full_title = article.get('title', 'Unknown')  # Full title, not truncated
            ai_decisions = all_ai_results.get(i, {})
            
            matched = False
            matched_cluster = None
            
            # STEP 1: Check against EXISTING clusters (from DB, with pre-computed AI decisions)
            for cluster in active_clusters[:original_cluster_count]:
                cluster_id = cluster['id']
                cluster_sources = cluster_sources_cache.get(cluster_id, [])
                
                # Check time proximity
                if not check_time_proximity(article, cluster):
                    continue
                
                ai_decision = ai_decisions.get(cluster_id)
                
                match_result = is_same_event(
                    article, cluster, cluster_sources,
                    debug=False,
                    ai_decision=ai_decision
                )
                
                if match_result['match']:
                    matched_cluster = cluster
                    matched = True
                    break
            
            # STEP 2: If no match with existing, check against NEW clusters from THIS batch
            # Use AI for semantic matching (important for same-event, different-wording articles)
            if not matched and new_batch_clusters:
                # Run AI check against new batch clusters
                new_cluster_ai_results = check_title_similarity_ai(
                    article.get('title', ''),
                    new_batch_clusters,
                    debug=False
                )
                
                for cluster in active_clusters[original_cluster_count:]:
                    cluster_id = cluster['id']
                    ai_decision = new_cluster_ai_results.get(cluster_id)
                    
                    if ai_decision is True:
                        matched_cluster = cluster
                        matched = True
                        break
                    elif ai_decision is None:
                        # AI unavailable, use fallback string matching
                        cluster_sources = cluster_sources_cache.get(cluster_id, [])
                        match_result = is_same_event(
                            article, cluster, cluster_sources,
                            debug=False,
                            ai_decision=None
                        )
                        if match_result['match']:
                            matched_cluster = cluster
                            matched = True
                            break
            
            if matched and matched_cluster:
                # Add to existing cluster
                if self.add_to_cluster(matched_cluster['id'], source_id):
                    print(f"\n   ✅ MATCHED [{i+1}/{len(articles)}]")
                    print(f"      📰 Article: {full_title}")
                    print(f"      📁 Added to cluster: {matched_cluster['event_name']}")
                    print(f"      🔗 Cluster ID: {matched_cluster['id']}")
                    with stats_lock:
                        stats['matched_to_existing'] += 1
                        if matched_cluster['id'] not in stats['cluster_ids']:
                            stats['cluster_ids'].append(matched_cluster['id'])
            else:
                # Create new cluster
                cluster_id = self.create_cluster(article, source_id)
                if cluster_id:
                    event_name = self._generate_event_name(article.get('title', ''))
                    print(f"\n   ✨ NEW CLUSTER [{i+1}/{len(articles)}]")
                    print(f"      📰 Article: {full_title}")
                    print(f"      📁 Cluster name: {event_name}")
                    print(f"      🔗 Cluster ID: {cluster_id}")
                    with stats_lock:
                        stats['new_clusters_created'] += 1
                        stats['cluster_ids'].append(cluster_id)
                    
                    # Add to active clusters and caches for subsequent matching
                    new_cluster = {
                        'id': cluster_id,
                        'event_name': event_name,
                        'main_title': article.get('title', ''),
                        'created_at': datetime.utcnow().isoformat(),
                        'last_updated_at': datetime.utcnow().isoformat(),
                        'source_count': 1,
                        'importance_score': article.get('score', 0),
                        'status': 'active'
                    }
                    active_clusters.append(new_cluster)
                    cluster_sources_cache[cluster_id] = [{
                        'title': article.get('title', ''),
                        'score': article.get('score', 0)
                    }]
                    cluster_titles_cache.append((cluster_id, article.get('title', '')))
                    
                    # Track this new cluster for AI matching with subsequent articles
                    new_batch_clusters.append((cluster_id, article.get('title', '')))
                else:
                    print(f"\n   ❌ FAILED [{i+1}/{len(articles)}]")
                    print(f"      📰 Article: {full_title}")
                    print(f"      ⚠️  Could not create cluster")
                    with stats_lock:
                        stats['failed'] += 1
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"CLUSTERING COMPLETE (PARALLEL)")
        print(f"{'='*60}")
        print(f"✓ Articles saved: {stats['saved_articles']}/{stats['total_articles']}")
        print(f"✓ Matched to existing clusters: {stats['matched_to_existing']}")
        print(f"✓ New clusters created: {stats['new_clusters_created']}")
        print(f"✓ Total active clusters: {len(active_clusters)}")
        if stats['failed'] > 0:
            print(f"⚠ Failed: {stats['failed']}")
        
        return stats
    
    def get_clusters_for_processing(self) -> List[Dict]:
        """
        Get clusters that are ready for article generation.
        Returns clusters with at least 1 source article.
        
        Returns:
            List of cluster dicts with source articles
        """
        try:
            # Get all active clusters
            clusters = self.get_active_clusters()
            
            # Enrich with source articles
            clusters_with_sources = []
            
            for cluster in clusters:
                sources = self.get_cluster_sources(cluster['id'])
                
                if sources:  # Only include clusters with sources
                    cluster['sources'] = sources
                    clusters_with_sources.append(cluster)
            
            return clusters_with_sources
            
        except Exception as e:
            print(f"❌ Error getting clusters for processing: {e}")
            return []


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    print("🧪 TESTING EVENT CLUSTERING ENGINE")
    print("=" * 80)
    
    # Sample articles for testing
    test_articles = [
        {
            "title": "Turkey Earthquake Death Toll Rises to 50",
            "description": "A powerful earthquake struck Turkey, killing at least 50 people.",
            "url": "https://www.bbc.com/news/turkey-earthquake-1?utm_source=rss",
            "source": "BBC News",
            "score": 920,
            "published_at": datetime.utcnow().isoformat()
        },
        {
            "title": "Earthquake Strikes Turkey, Dozens Dead",
            "description": "An earthquake in Turkey has left dozens dead and hundreds injured.",
            "url": "https://www.cnn.com/turkey-quake?ref=twitter",
            "source": "CNN",
            "score": 880,
            "published_at": datetime.utcnow().isoformat()
        },
        {
            "title": "Turkey Quake Leaves 50 Dead, Hundreds Injured",
            "description": "Turkey was struck by a major earthquake, officials report 50 deaths.",
            "url": "https://www.reuters.com/article/turkey-earthquake",
            "source": "Reuters",
            "score": 850,
            "published_at": datetime.utcnow().isoformat()
        },
        {
            "title": "European Central Bank Raises Interest Rates",
            "description": "The ECB announced a rate hike to combat inflation.",
            "url": "https://www.bloomberg.com/ecb-rates",
            "source": "Bloomberg",
            "score": 780,
            "published_at": datetime.utcnow().isoformat()
        }
    ]
    
    try:
        # Initialize engine
        engine = EventClusteringEngine()
        
        # Test clustering
        stats = engine.cluster_articles(test_articles)
        
        print(f"\n📊 CLUSTERING STATISTICS:")
        print(f"   Total articles: {stats['total_articles']}")
        print(f"   Matched to existing: {stats['matched_to_existing']}")
        print(f"   New clusters: {stats['new_clusters_created']}")
        print(f"   Failed: {stats['failed']}")
        
        # Get clusters for processing
        print(f"\n📰 CLUSTERS READY FOR PROCESSING:")
        clusters = engine.get_clusters_for_processing()
        
        for i, cluster in enumerate(clusters, 1):
            print(f"\n{i}. {cluster['event_name']}")
            print(f"   Sources: {len(cluster['sources'])}")
            print(f"   Importance: {cluster['importance_score']}")
            for source in cluster['sources']:
                print(f"   - {source['source_name']}: {source['title'][:50]}...")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()


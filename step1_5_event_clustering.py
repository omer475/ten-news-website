#!/usr/bin/env python3
"""
STEP 1.5: EVENT CLUSTERING ENGINE (v2.0 - EMBEDDING-BASED)
==========================================
Purpose: Group articles about the same event for multi-source synthesis
Input: Approved articles from Step 1 (Gemini scoring)
Output: Clusters of articles about the same event
Algorithm: Gemini embeddings + cosine similarity (threshold 0.87 - strict for accuracy)
"""

import re
import os
import time
import numpy as np
import requests
from typing import List, Dict, Optional, Set, Tuple, Union
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from collections import Counter
from urllib.parse import urlparse, parse_qs, urlunparse
from supabase import create_client, Client
from dotenv import load_dotenv
import anthropic
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import google.generativeai as genai

load_dotenv()

# ==========================================
# AI CLUSTER MATCHING (FOR UNMATCHED ARTICLES)
# ==========================================

# Weak keywords - these alone shouldn't trigger auto-clustering
# (country names, generic terms that appear in many unrelated stories)
WEAK_KEYWORDS = {
    # Countries (matching on country alone is too weak)
    'usa', 'china', 'india', 'russia', 'japan', 'germany', 'france', 'italy',
    'spain', 'portugal', 'brazil', 'mexico', 'canada', 'australia', 'korea',
    'ukraine', 'israel', 'iran', 'turkey', 'poland', 'netherlands', 'sweden',
    'norway', 'denmark', 'finland', 'austria', 'switzerland', 'belgium',
    'greece', 'egypt', 'saudi', 'emirates', 'qatar', 'pakistan', 'indonesia',
    'vietnam', 'thailand', 'malaysia', 'singapore', 'philippines', 'taiwan',
    'hong', 'kong', 'africa', 'europe', 'asia', 'america', 'americas',
    # Generic terms
    'government', 'president', 'minister', 'official', 'report', 'reports',
    'company', 'market', 'economy', 'economic', 'business', 'industry',
    'million', 'billion', 'trillion', 'percent', 'year', 'years', 'month',
    'week', 'today', 'world', 'global', 'international', 'national', 'local',
    'major', 'breaking', 'update', 'latest', 'recent', 'former', 'current'
}


def extract_keywords(text: str) -> Set[str]:
    """
    Extract meaningful keywords from article title for cluster matching.
    Returns lowercase keywords for comparison. ALWAYS returns a set.
    """
    try:
        if not text:
            return set()
        
        # Common stop words to ignore
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
            'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
            'his', 'her', 'their', 'my', 'your', 'our', 'after', 'before', 'over',
            'under', 'new', 'says', 'said', 'amid', 'into', 'about', 'than', 'more',
            'first', 'last', 'just', 'also', 'up', 'down', 'out', 'off', 'all',
            'warns', 'faces', 'launches', 'reveals', 'seeks', 'hits', 'plans'
        }
        
        # Clean text - remove markdown bold markers
        clean_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', str(text))
        
        # Extract words (at least 3 chars)
        words = re.findall(r'\b[a-zA-Z]{3,}\b', clean_text.lower())
        
        # Filter out stop words - build set explicitly
        result = set()
        for word in words:
            if word not in stop_words:
                result.add(word)
        
        return result
    except Exception as e:
        print(f"      ⚠️ Keyword extraction error: {e}")
        return set()


def score_cluster_by_keywords(cluster_name: str, article_keywords) -> int:
    """
    Score a cluster based on how many keywords match the article.
    Higher score = more relevant cluster.
    """
    try:
        # Ensure both are sets - be very defensive
        if isinstance(article_keywords, set):
            article_set = article_keywords
        elif article_keywords:
            article_set = set(article_keywords)
        else:
            article_set = set()
        
        # Get cluster keywords and ensure it's a set
        cluster_keywords = extract_keywords(cluster_name)
        if isinstance(cluster_keywords, set):
            cluster_set = cluster_keywords
        elif cluster_keywords:
            cluster_set = set(cluster_keywords)
        else:
            cluster_set = set()
        
        # Count matching keywords using set intersection
        matches = len(cluster_set.intersection(article_set))
        return matches
    except Exception as e:
        print(f"      ⚠️ Keyword scoring error: {e}")
        return 0


def count_strong_keyword_matches(cluster_name: str, article_keywords) -> tuple:
    """
    Count keyword matches, separating strong (topic-specific) from weak (generic).
    Returns (total_matches, strong_matches).
    
    Strong keywords = specific topics, names, events
    Weak keywords = country names, generic business terms
    """
    try:
        # Ensure article_keywords is a set
        if isinstance(article_keywords, set):
            article_set = article_keywords
        elif article_keywords:
            article_set = set(article_keywords)
        else:
            return (0, 0)
        
        cluster_keywords = extract_keywords(cluster_name)
        if not isinstance(cluster_keywords, set):
            cluster_keywords = set(cluster_keywords) if cluster_keywords else set()
        
        # Find all matches
        all_matches = cluster_keywords.intersection(article_set)
        
        # Separate strong from weak
        strong_matches = set()
        for word in all_matches:
            if word not in WEAK_KEYWORDS:
                strong_matches.add(word)
        
        return (len(all_matches), len(strong_matches))
    except Exception as e:
        print(f"      ⚠️ Keyword matching error: {e}")
        return (0, 0)


def prioritize_clusters_by_keywords(new_article_title: str, existing_clusters: List[Dict]) -> List[Dict]:
    """
    Sort clusters so keyword-matching clusters appear first.
    This ensures AI sees the most relevant clusters.
    
    Args:
        new_article_title: The new article's title
        existing_clusters: All active clusters
        
    Returns:
        Sorted list with keyword-matched clusters first, then others
    """
    article_keywords = extract_keywords(new_article_title)
    
    # Score each cluster
    scored_clusters = []
    for cluster in existing_clusters:
        cluster_name = cluster.get('event_name', '')
        score = score_cluster_by_keywords(cluster_name, article_keywords)
        scored_clusters.append((cluster, score))
    
    # Sort by score (descending) - keyword matches first
    scored_clusters.sort(key=lambda x: x[1], reverse=True)
    
    # Return just the clusters (without scores)
    return [c[0] for c in scored_clusters]


def ai_check_cluster_match(new_article_title: str, existing_clusters: List[Dict]) -> Dict:
    """
    Use AI to check if an article that embedding didn't match should belong to any existing cluster.
    This catches articles that embedding missed due to different wording.
    
    IMPROVED v2: 
    - Prioritizes clusters by keyword matching before sending to AI
    - AUTO-ADDS to cluster if 2+ keywords match (skips AI for obvious matches)
    
    Args:
        new_article_title: Title of the new article being processed
        existing_clusters: List of existing clusters with their names
        
    Returns:
        Dict with:
        - 'action': 'add_to_cluster' | 'new_cluster_major_update' | 'new_cluster_different_topic'
        - 'cluster_id': int or None (if adding to existing cluster)
        - 'reason': str
    """
    try:
        # Extract keywords from new article
        article_keywords = extract_keywords(new_article_title)
        
        # IMPROVEMENT: Prioritize clusters by keyword matching
        prioritized_clusters = prioritize_clusters_by_keywords(new_article_title, existing_clusters)
        
        if not prioritized_clusters:
            return {
                'action': 'new_cluster_different_topic',
                'cluster_id': None,
                'reason': 'No existing clusters to compare'
            }
        
        # Check top cluster's keyword match score (both total and strong)
        top_cluster = prioritized_clusters[0]
        total_matches, strong_matches = count_strong_keyword_matches(
            top_cluster.get('event_name', ''), 
            article_keywords
        )
        
        # AUTO-ADD DISABLED: Let AI decide all cases with improved prompt
        # Previously caused wrong clustering (e.g., unrelated articles with same country)
        # Only auto-add if EXTREMELY high confidence (4+ strong keywords - very rare)
        if strong_matches >= 4:
            print(f"      📊 Keyword match: {total_matches} total, {strong_matches} strong → AUTO-ADDING (high confidence)")
            print(f"         Cluster: {top_cluster.get('event_name', 'Unknown')}")
            return {
                'action': 'add_to_cluster',
                'cluster_id': top_cluster['id'],
                'reason': f'Auto-matched: {strong_matches} strong keywords (high confidence)'
            }
        
        # Log keyword matching for debugging - AI will decide
        if total_matches > 0:
            print(f"      📊 Keyword pre-filter: {total_matches} matches ({strong_matches} strong) - AI will decide")
        
        # Configure Gemini for AI check (only for 0-1 keyword matches)
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Build the list of existing clusters (top 50 - prioritized by keyword relevance)
        clusters_text = ""
        clusters_for_matching = prioritized_clusters[:50]
        for i, cluster in enumerate(clusters_for_matching):
            clusters_text += f"{i+1}. [ID:{cluster['id']}] {cluster['event_name']}\n"
        
        prompt = f"""You are clustering news articles. Add to existing cluster ONLY if it's the SAME SPECIFIC EVENT.

EXISTING CLUSTERS:
{clusters_text}

NEW ARTICLE: {new_article_title}

════════════════════════════════════════════════════════════════════════════════
RULE: Same SPECIFIC EVENT = Same cluster. Different events = Different clusters.
════════════════════════════════════════════════════════════════════════════════

✅ ADD_TO_CLUSTER - SAME specific event, just different source/angle:
• "Japan PM drums with SK President" → "Japan-SK summit drums session" ✅ SAME EVENT
• "Starlink free internet for Iran" → "Musk activates Starlink in Iran" ✅ SAME EVENT
• "2025 third hottest year" → "Earth records hottest 3 years" ✅ SAME CLIMATE REPORT
• "Trump 25% tariff on Iran partners" → "Trump threatens Iran tariffs" ✅ SAME POLICY
• "Iran protester executed" → "Iran executions during protests" ✅ SAME CRISIS

❌ NEW_CLUSTER - Different events, even if same country/topic:
• "Iran economic crisis" vs "Iran protest deaths" → DIFFERENT aspects, NEW CLUSTER
• "Ukraine drone strike" vs "UPS plane crash Kentucky" → COMPLETELY DIFFERENT
• "MIT smart pill" vs "Smart home without WiFi" → COMPLETELY DIFFERENT
• "Trump Detroit speech" vs "Trump Davos trip" → DIFFERENT events
• "Venezuela oil prices" vs "Anthropic AI launch" → COMPLETELY DIFFERENT

CRITICAL TEST: Would a news editor combine these into ONE article?
- YES → ADD_TO_CLUSTER (same event, merge the coverage)
- NO → NEW_CLUSTER (different stories, keep separate)

════════════════════════════════════════════════════════════════════════════════
⚠️ DO NOT cluster articles just because they mention the same country/company!
   "Iran protests" and "Iran economy" are DIFFERENT stories!
   "Apple new product" and "Apple lawsuit" are DIFFERENT stories!
════════════════════════════════════════════════════════════════════════════════

RESPONSE FORMAT (one line only):
→ ADD_TO_CLUSTER | CLUSTER_ID: [number] | REASON: same event - [brief]
→ NEW_CLUSTER_DIFFERENT_TOPIC | REASON: different event - [brief]

YOUR RESPONSE:"""

        response = model.generate_content(prompt)
        result_text = response.text.strip().upper()
        reason = result_text.split("REASON:")[-1].strip() if "REASON:" in result_text else ""
        
        # Parse response
        if "ADD_TO_CLUSTER" in result_text and "CLUSTER_ID:" in result_text:
            # Extract cluster ID - use the prioritized list that AI saw
            match = re.search(r'CLUSTER_ID:\s*(\d+)', result_text)
            if match:
                cluster_index = int(match.group(1)) - 1  # Convert to 0-indexed
                # IMPORTANT: Use clusters_for_matching (the prioritized list sent to AI)
                if 0 <= cluster_index < len(clusters_for_matching):
                    cluster_id = clusters_for_matching[cluster_index]['id']
                    cluster_name = clusters_for_matching[cluster_index].get('event_name', 'Unknown')
                    print(f"      🧠 AI Cluster Check: ADD TO EXISTING CLUSTER #{cluster_id}")
                    print(f"         Cluster: {cluster_name}")
                    print(f"         Reason: {reason}")
                    return {
                        'action': 'add_to_cluster',
                        'cluster_id': cluster_id,
                        'reason': reason if reason else "AI matched to cluster"
                    }
        
        # SMART CHECK: If AI says "NEW_CLUSTER" but reason says it's the SAME EVENT,
        # override and add to top cluster anyway (AI is contradicting itself)
        # Only override for STRONG contradiction phrases, not just "related"
        same_event_phrases = ['SAME EVENT', 'SAME STORY', 'SAME NEWS', 'IDENTICAL', 'SAME INCIDENT', 'SAME SPECIFIC']
        if any(phrase in reason for phrase in same_event_phrases):
            print(f"      🧠 AI Cluster Check: NEW CLUSTER (DIFFERENT TOPIC)")
            print(f"         Reason: {reason}")
            print(f"      ⚠️ OVERRIDE: AI said 'same event' but chose new cluster - adding to top match!")
            top_cluster_id = clusters_for_matching[0]['id']
            top_cluster_name = clusters_for_matching[0].get('event_name', 'Unknown')
            return {
                'action': 'add_to_cluster',
                'cluster_id': top_cluster_id,
                'reason': f'Override: AI contradicted itself - {reason}'
            }
        
        if "NEW_CLUSTER_MAJOR_UPDATE" in result_text:
            print(f"      🧠 AI Cluster Check: NEW CLUSTER (MAJOR UPDATE)")
            print(f"         Reason: {reason}")
            return {
                'action': 'new_cluster_major_update',
                'cluster_id': None,
                'reason': reason if reason else "Major update detected"
            }
        
        # Default: new cluster for different topic
        print(f"      🧠 AI Cluster Check: NEW CLUSTER (DIFFERENT TOPIC)")
        print(f"         Reason: {reason}")
        return {
            'action': 'new_cluster_different_topic',
            'cluster_id': None,
            'reason': reason if reason else "Different topic"
        }
        
    except Exception as e:
        print(f"      ⚠️ AI cluster check error: {e}")
        # On error, default to creating new cluster (safer)
        return {
            'action': 'new_cluster_different_topic',
            'cluster_id': None,
            'reason': f'Error in check: {str(e)}'
        }

# ==========================================
# GEMINI CLIENT FOR EMBEDDINGS
# ==========================================

_gemini_api_key = None

def get_gemini_api_key():
    """Get Gemini API key for embeddings"""
    global _gemini_api_key
    if _gemini_api_key is None:
        _gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not _gemini_api_key:
            raise ValueError("GEMINI_API_KEY must be set in environment")
    return _gemini_api_key


def get_embedding(text: str) -> List[float]:
    """
    Get Gemini embedding for a text string.
    Uses text-embedding-004 model.
    
    Args:
        text: Text to embed (article title)
        
    Returns:
        List of floats (768-dimensional vector)
    """
    try:
        api_key = get_gemini_api_key()
        # Clean text - remove HTML entities and special chars
        clean_text = re.sub(r'&#\d+;|&\w+;', '', text)
        clean_text = clean_text.strip()[:500]  # Limit length
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
        
        payload = {
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": clean_text}]
            }
        }
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        return result['embedding']['values']
    except Exception as e:
        print(f"  ⚠️ Embedding error: {e}")
        return None


def get_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Get embeddings for multiple texts using Gemini with PARALLEL processing.
    
    Args:
        texts: List of texts to embed
        
    Returns:
        List of embeddings (same order as input)
    """
    api_key = get_gemini_api_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
    
    def get_single_embedding(idx_text):
        idx, text = idx_text
        max_retries = 3
        for attempt in range(max_retries):
            try:
                clean_text = re.sub(r'&#\d+;|&\w+;', '', text)
                clean_text = clean_text.strip()[:500]
                
                payload = {
                    "model": "models/text-embedding-004",
                    "content": {
                        "parts": [{"text": clean_text}]
                    }
                }
                
                response = requests.post(url, json=payload, timeout=30)
                
                # Handle rate limiting
                if response.status_code == 429:
                    wait_time = (attempt + 1) * 2  # 2, 4, 6 seconds
                    time.sleep(wait_time)
                    continue
                
                response.raise_for_status()
                result = response.json()
                return idx, result['embedding']['values']
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                print(f"  ⚠️ Embedding error for text {idx}: {e}")
                return idx, None
        return idx, None
    
    # Process in parallel with 3 workers (reduced to avoid Gemini rate limits)
    embeddings = [None] * len(texts)
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = executor.map(get_single_embedding, enumerate(texts))
        for idx, embedding in futures:
            embeddings[idx] = embedding
    
    return embeddings


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First embedding vector
        vec2: Second embedding vector
        
    Returns:
        Similarity score between 0 and 1
    """
    if vec1 is None or vec2 is None:
        return 0.0
    
    a = np.array(vec1)
    b = np.array(vec2)
    
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return dot_product / (norm_a * norm_b)


# ==========================================
# ANTHROPIC CLIENT (FALLBACK ONLY)
# ==========================================

def get_anthropic_client():
    """Get Anthropic client for Claude Haiku 4.5 (fallback only)"""
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY must be set in environment")
    return anthropic.Anthropic(api_key=api_key)

# ==========================================
# CONFIGURATION
# ==========================================

class ClusteringConfig:
    """Configuration for clustering algorithm"""
    
    # EMBEDDING-BASED MATCHING (PRIMARY METHOD - v2.0)
    EMBEDDING_SIMILARITY_THRESHOLD = 0.75  # Cosine similarity threshold - VERY AGGRESSIVE to catch all duplicates
    # 0.90+ = Almost identical titles
    # 0.85-0.90 = Same event, different wording
    # 0.75-0.85 = Same event OR same topic, significantly different wording (MATCH THESE)
    # 0.70-0.78 = Related topics, might be different events
    # <0.70 = Definitely different events
    
    # FALLBACK: String-based matching (if embeddings fail)
    TITLE_SIMILARITY_THRESHOLD = 0.80  # 80% title similarity = same event (INCREASED)
    MIN_TITLE_SIMILARITY = 0.60  # Minimum 60% for keyword match (INCREASED)
    KEYWORD_MATCH_THRESHOLD = 5  # 5+ shared keywords = same event
    ENTITY_MATCH_THRESHOLD = 2  # 2+ shared entities adds confidence
    
    # Time windows
    MAX_CLUSTER_AGE_HOURS = 72  # Only match with clusters created in last 72h (3 days)
    MAX_ARTICLE_AGE_HOURS = 48  # Only process articles from last 48h
    
    # Cluster lifecycle
    CLUSTER_INACTIVITY_HOURS = 72  # Close cluster after 72h without updates (3 days)
    CLUSTER_MAX_LIFETIME_HOURS = 168  # Close cluster after 168h regardless (7 days)
    
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
            temperature=0,  # Deterministic matching
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
            temperature=0,  # Deterministic matching
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
        cluster: Cluster with last_updated_at / created_at
        
    Returns:
        True if within time window, False otherwise
    """
    try:
        # IMPORTANT:
        # We select "active clusters" based on last_updated_at (see get_active_clusters()).
        # Using created_at here incorrectly blocks matching to long-running clusters and
        # causes duplicate clusters for the same event. So we gate on last_updated_at,
        # falling back to created_at for legacy rows.
        cluster_ref_ts = cluster.get('last_updated_at') or cluster.get('created_at')
        if not cluster_ref_ts:
            return True
        cluster_ref = datetime.fromisoformat(str(cluster_ref_ts).replace('Z', '+00:00'))
        article_published = article.get('published_at')
        
        if article_published:
            if isinstance(article_published, str):
                article_published = datetime.fromisoformat(article_published.replace('Z', '+00:00'))
            
            time_diff = abs((article_published - cluster_ref).total_seconds() / 3600)
            if time_diff > ClusteringConfig.MAX_CLUSTER_AGE_HOURS:
                return False
        return True
    except Exception:
        return True  # On error, allow the comparison


def is_same_event_embedding(article_embedding: List[float], cluster_embedding: List[float], 
                           article_title: str, cluster_title: str, debug: bool = False) -> Dict:
    """
    Determine if an article belongs to an existing cluster using EMBEDDING SIMILARITY.
    
    This is the new v2.0 method - uses Gemini embeddings + cosine similarity.
    Much more accurate than AI-based matching (no hallucination).
    
    Args:
        article_embedding: Pre-computed embedding for article title
        cluster_embedding: Pre-computed embedding for cluster representative title
        article_title: Article title (for logging)
        cluster_title: Cluster title (for logging)
        debug: If True, print debug information
        
    Returns:
        Dict with 'match' (bool), 'reason' (str), 'similarity' (float)
    """
    # Calculate cosine similarity
    similarity = cosine_similarity(article_embedding, cluster_embedding)
    
    # Threshold check
    threshold = ClusteringConfig.EMBEDDING_SIMILARITY_THRESHOLD
    is_match = similarity >= threshold
    
    if debug:
        status = "✅ MATCH" if is_match else "❌ NO MATCH"
        print(f"  {status}: Similarity {similarity:.3f} (threshold: {threshold})")
        print(f"    Article: {article_title[:60]}...")
        print(f"    Cluster: {cluster_title[:60]}...")
    
    return {
        'match': is_match,
        'reason': 'embedding_match' if is_match else 'embedding_different',
        'similarity': similarity
    }


def is_same_event(article: Dict, cluster: Dict, cluster_sources: List[Dict], debug: bool = False, 
                  article_embedding: List[float] = None, cluster_embedding: List[float] = None) -> Dict:
    """
    Determine if an article belongs to an existing cluster.
    
    v2.0: Uses EMBEDDING SIMILARITY (primary) with string fallback.
    
    Args:
        article: Article to match with title, keywords, entities, published_at
        cluster: Cluster metadata with created_at
        cluster_sources: List of source articles in the cluster
        debug: If True, print debug information
        article_embedding: Pre-computed embedding for article title
        cluster_embedding: Pre-computed embedding for cluster representative title
        
    Returns:
        Dict with 'match' (bool), 'reason' (str), 'similarity' (float), 'shared_keywords' (list)
    """
    # Check 1: Time proximity (24 hours)
    if not check_time_proximity(article, cluster):
        return {'match': False, 'reason': 'too_old', 'similarity': 0.0, 'shared_keywords': []}
    
    if not cluster_sources:
        return {'match': False, 'reason': 'no_sources', 'similarity': 0.0, 'shared_keywords': []}
    
    representative = max(cluster_sources, key=lambda x: x.get('score', 0))
    article_title = article.get('title', '')
    cluster_title = representative.get('title', cluster.get('main_title', ''))
    
    # PRIMARY METHOD: Embedding similarity (v2.0)
    if article_embedding is not None and cluster_embedding is not None:
        result = is_same_event_embedding(
            article_embedding, cluster_embedding,
            article_title, cluster_title, debug
        )
        result['shared_keywords'] = []
        return result
    
    # FALLBACK: Legacy string-based matching (if embeddings not available)
    if debug:
        print(f"  ⚠️  Using fallback string matching (embeddings not available)")
    
    title_similarity = calculate_title_similarity(article_title, cluster_title)
    
    # STRONG MATCH: High title similarity (75%+)
    if title_similarity >= ClusteringConfig.TITLE_SIMILARITY_THRESHOLD:
        if debug:
            print(f"  ✅ FALLBACK STRONG MATCH: Title similarity {title_similarity:.2%}")
        return {'match': True, 'reason': 'high_title_similarity', 'similarity': title_similarity, 'shared_keywords': []}
    
    # Check keyword/entity overlap only if title similarity meets minimum threshold
    if title_similarity < ClusteringConfig.MIN_TITLE_SIMILARITY:
        if debug:
            print(f"  ❌ FALLBACK REJECTED: Title similarity {title_similarity:.2%} < minimum")
        return {'match': False, 'reason': 'title_too_different', 'similarity': title_similarity, 'shared_keywords': []}
    
    # Get keywords and entities for overlap check
    article_keywords = set(article.get('keywords', []))
    article_entities = set(article.get('entities', []))
    rep_keywords = set(representative.get('keywords', []))
    rep_entities = set(representative.get('entities', []))
    
    shared_keywords = article_keywords.intersection(rep_keywords)
    shared_entities = article_entities.intersection(rep_entities)
    
    # MODERATE MATCH: Good keyword overlap + decent title similarity
    if len(shared_keywords) >= ClusteringConfig.KEYWORD_MATCH_THRESHOLD:
        return {'match': True, 'reason': 'keyword_match', 'similarity': title_similarity, 'shared_keywords': list(shared_keywords)}
    
    # ENTITY MATCH: Shared named entities
    if len(shared_entities) >= ClusteringConfig.ENTITY_MATCH_THRESHOLD:
        return {'match': True, 'reason': 'entity_match', 'similarity': title_similarity, 'shared_keywords': list(shared_entities)}
    
    return {'match': False, 'reason': 'insufficient_overlap', 'similarity': title_similarity, 'shared_keywords': list(shared_keywords)}


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
    
    def get_or_create_source_article(self, article: Dict, max_retries: int = 3) -> Optional[Tuple[int, bool]]:
        """
        Get existing article from source_articles by URL, or create if not exists.
        Includes retry logic for transient connection issues.
        
        Args:
            article: Article dict with url, title, description, etc.
            max_retries: Number of retry attempts for connection failures
            
        Returns:
            Tuple of (Article ID, already_clustered) if successful, None if failed
            - already_clustered: True if article already has a cluster_id (skip clustering)
        """
        import time
        
        for attempt in range(max_retries):
            try:
                # Normalize URL
                normalized_url = normalize_url(article.get('url', ''))
                
                # Try to find existing article first - also check if already clustered
                result = self.supabase.table('source_articles').select('id, cluster_id').eq(
                    'normalized_url', normalized_url
                ).execute()
                
                if result.data and len(result.data) > 0:
                    # Article already exists
                    existing_article = result.data[0]
                    already_clustered = existing_article.get('cluster_id') is not None
                    return (existing_article['id'], already_clustered)
                
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
                    return (result.data[0]['id'], False)  # New article, not yet clustered
                
                return None
                
            except Exception as e:
                error_str = str(e)
                error_lower = error_str.lower()
                
                # Handle duplicate key violation (article already exists)
                if '23505' in error_str or 'duplicate key' in error_lower or 'unique_normalized_url' in error_str:
                    # This is expected - article was inserted by another process or previous run
                    # Try to fetch the existing article with cluster_id check
                    try:
                        normalized_url = normalize_url(article.get('url', ''))
                        result = self.supabase.table('source_articles').select('id, cluster_id').eq(
                            'normalized_url', normalized_url
                        ).execute()
                        if result.data and len(result.data) > 0:
                            existing_article = result.data[0]
                            already_clustered = existing_article.get('cluster_id') is not None
                            return (existing_article['id'], already_clustered)
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
    
    def get_all_cluster_sources_batch(self, cluster_ids: List[int]) -> Dict[int, List[Dict]]:
        """
        Get all source articles for multiple clusters in ONE query.
        Much faster than calling get_cluster_sources for each cluster.
        
        Args:
            cluster_ids: List of cluster IDs
            
        Returns:
            Dict mapping cluster_id -> list of source articles
        """
        try:
            if not cluster_ids:
                return {}
            
            # Fetch all sources for all clusters in one query
            result = self.supabase.table('source_articles').select(
                'id, cluster_id, title, score, source_name, url'
            ).in_(
                'cluster_id', cluster_ids
            ).order('score', desc=True).execute()
            
            # Group by cluster_id
            cluster_sources = {}
            for source in (result.data or []):
                cid = source.get('cluster_id')
                if cid not in cluster_sources:
                    cluster_sources[cid] = []
                cluster_sources[cid].append(source)
            
            return cluster_sources
            
        except Exception as e:
            print(f"❌ Error batch fetching cluster sources: {e}")
            return {}
            return []
    
    def create_cluster(self, article: Dict, source_article_id: int, embedding: List[float] = None) -> Optional[int]:
        """
        Create a new cluster for an article that doesn't match existing clusters.
        
        Args:
            article: Article dict
            source_article_id: ID of the source article in database
            embedding: Optional embedding vector to cache in database
            
        Returns:
            Cluster ID if successful, None if failed
        """
        try:
            # Generate event name (simplified title)
            event_name = self._generate_event_name(article.get('title', ''))
            
            # Create cluster (base data without embedding first)
            cluster_data = {
                'event_name': event_name,
                'main_title': article.get('title', ''),
                'status': 'active',
                'source_count': 1,
                'importance_score': article.get('score', 0)
            }
            
            # Try with embedding first, fall back without if column doesn't exist
            if embedding:
                cluster_data['embedding'] = embedding
                try:
                    result = self.supabase.table('clusters').insert(cluster_data).execute()
                except Exception as embed_err:
                    if 'embedding' in str(embed_err):
                        # Embedding column doesn't exist yet, try without it
                        print(f"   ⚠️ Embedding column not found, creating cluster without caching")
                        del cluster_data['embedding']
                        result = self.supabase.table('clusters').insert(cluster_data).execute()
                    else:
                        raise embed_err
            else:
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
            'already_clustered': 0,  # Articles skipped because already in a cluster
            'failed': 0,
            'cluster_ids': []  # Track ALL affected cluster IDs (new + updated)
        }
        
        # Thread-safe lock for stats and active_clusters
        stats_lock = threading.Lock()
        
        # Get active clusters
        active_clusters = self.get_active_clusters()
        print(f"📊 Found {len(active_clusters)} active clusters")
        
        # Pre-fetch ALL cluster sources in ONE query (optimized)
        print(f"📦 Pre-caching cluster sources (batch mode)...")
        cluster_ids = [c['id'] for c in active_clusters]
        cluster_sources_cache = self.get_all_cluster_sources_batch(cluster_ids)
        
        # Build cluster titles cache for embedding
        cluster_titles_cache = []  # (cluster_id, rep_title)
        for cluster in active_clusters:
            sources = cluster_sources_cache.get(cluster['id'], [])
            if sources:
                rep = max(sources, key=lambda x: x.get('score', 0))
                rep_title = rep.get('title', cluster.get('main_title', ''))
            else:
                rep_title = cluster.get('main_title', cluster.get('event_name', ''))
            cluster_titles_cache.append((cluster['id'], rep_title))
        
        print(f"✅ Cached {len(cluster_sources_cache)} clusters with sources (1 query)\n")
        
        # PHASE 1: Save all articles to database in parallel
        print(f"📝 Phase 1: Saving articles to database...")
        article_source_ids = {}  # article_index -> source_id
        already_clustered_ids = set()  # Track articles that are already in a cluster (SKIP THESE)
        
        def save_article(idx_article_tuple):
            idx, article = idx_article_tuple
            result = self.get_or_create_source_article(article)
            if result is None:
                return idx, None, False
            source_id, already_clustered = result
            return idx, source_id, already_clustered
        
        with ThreadPoolExecutor(max_workers=self.config.PARALLEL_WORKERS) as executor:
            futures = [executor.submit(save_article, (i, a)) for i, a in enumerate(articles)]
            for future in as_completed(futures):
                idx, source_id, already_clustered = future.result()
                if source_id:
                    if already_clustered:
                        # Article already exists AND is already in a cluster - SKIP clustering
                        already_clustered_ids.add(idx)
                    else:
                        # New article or existing but not yet clustered
                        article_source_ids[idx] = source_id
                    with stats_lock:
                        stats['saved_articles'] += 1
                else:
                    with stats_lock:
                        stats['failed'] += 1
        
        skipped_count = len(already_clustered_ids)
        stats['already_clustered'] = skipped_count
        print(f"✅ Saved {stats['saved_articles']}/{len(articles)} articles")
        if skipped_count > 0:
            print(f"⏭️  Skipping {skipped_count} articles already in clusters\n")
        else:
            print()
        
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
        
        # PHASE 2: Generate embeddings for all articles and clusters
        print(f"🧠 Phase 2: Generating embeddings (Gemini text-embedding-004)...")
        
        # Filter articles that were saved successfully
        valid_articles = [(i, articles[i]) for i in article_source_ids.keys()]
        
        # Get all article titles for batch embedding
        article_titles = [articles[i].get('title', '') for i in article_source_ids.keys()]
        cluster_titles = [title for _, title in cluster_titles_cache]
        
        # Generate embeddings in batches (Gemini processes one at a time)
        print(f"   📰 Embedding {len(article_titles)} article titles...")
        article_embeddings = {}
        
        # Process in batches of 100
        for batch_start in range(0, len(valid_articles), 100):
            batch_end = min(batch_start + 100, len(valid_articles))
            batch_indices = [idx for idx, _ in valid_articles[batch_start:batch_end]]
            batch_titles = [articles[idx].get('title', '') for idx in batch_indices]
            
            batch_embeddings = get_embeddings_batch(batch_titles)
            for idx, emb in zip(batch_indices, batch_embeddings):
                article_embeddings[idx] = emb
            
            if (batch_end) % 100 == 0 or batch_end == len(valid_articles):
                print(f"   ✓ Embedded {batch_end}/{len(valid_articles)} articles")
        
        # Use CACHED embeddings from database, only generate for clusters without them
        print(f"   📁 Loading cached cluster embeddings...")
        cluster_embeddings = {}
        clusters_needing_embedding = []
        
        # First, load cached embeddings from active_clusters
        for cluster_id, title in cluster_titles_cache:
            # Find this cluster in active_clusters to check for cached embedding
            cluster_data = next((c for c in active_clusters if c['id'] == cluster_id), None)
            if cluster_data and cluster_data.get('embedding'):
                # Use cached embedding
                cluster_embeddings[cluster_id] = cluster_data['embedding']
            else:
                # Need to generate embedding for this cluster
                clusters_needing_embedding.append((cluster_id, title))
        
        cached_count = len(cluster_embeddings)
        need_gen_count = len(clusters_needing_embedding)
        
        if need_gen_count > 0:
            print(f"   📁 Generating {need_gen_count} new embeddings ({cached_count} cached)...")
            titles_to_embed = [title for _, title in clusters_needing_embedding]
            new_embeddings = get_embeddings_batch(titles_to_embed)
            
            # Store new embeddings and save to database
            for (cluster_id, title), emb in zip(clusters_needing_embedding, new_embeddings):
                cluster_embeddings[cluster_id] = emb
                # Save embedding to database for future caching
                try:
                    self.supabase.table('clusters').update({
                        'embedding': emb
                    }).eq('id', cluster_id).execute()
                except Exception as e:
                    pass  # Non-critical, continue even if save fails
        else:
            print(f"   📁 All {cached_count} cluster embeddings loaded from cache!")
        
        print(f"✅ Embeddings ready ({cached_count} cached, {need_gen_count} generated)\n")
        
        # PHASE 3: Process results and assign to clusters (EMBEDDING-BASED v2.0)
        print(f"\n{'='*80}")
        print(f"📊 PHASE 3: ASSIGNING ARTICLES TO CLUSTERS (EMBEDDING-BASED)")
        print(f"{'='*80}")
        print(f"   Similarity threshold: {self.config.EMBEDDING_SIMILARITY_THRESHOLD}")
        
        # Track NEW clusters created in THIS batch
        new_batch_clusters = []  # List of (cluster_id, title, embedding) tuples
        original_cluster_count = len(active_clusters)  # Clusters before this batch
        
        for i, article in enumerate(articles):
            if i not in article_source_ids:
                continue  # Article wasn't saved successfully
            
            source_id = article_source_ids[i]
            full_title = article.get('title', 'Unknown')
            article_emb = article_embeddings.get(i)
            
            matched = False
            matched_cluster = None
            best_similarity = 0.0
            
            # STEP 1: Check against EXISTING clusters using embeddings
            for cluster in active_clusters[:original_cluster_count]:
                cluster_id = cluster['id']
                cluster_emb = cluster_embeddings.get(cluster_id)
                
                # Check time proximity
                if not check_time_proximity(article, cluster):
                    continue
                
                # Calculate embedding similarity
                if article_emb is not None and cluster_emb is not None:
                    similarity = cosine_similarity(article_emb, cluster_emb)
                    
                    if similarity >= self.config.EMBEDDING_SIMILARITY_THRESHOLD and similarity > best_similarity:
                        best_similarity = similarity
                        matched_cluster = cluster
                        matched = True
                else:
                    # Fallback: string matching if embeddings not available
                    cluster_sources = cluster_sources_cache.get(cluster_id, [])
                    match_result = is_same_event(article, cluster, cluster_sources, debug=False)
                    if match_result['match']:
                        matched_cluster = cluster
                        matched = True
                        break
            
            # STEP 2: If no match with existing, check against NEW clusters from THIS batch
            if not matched and new_batch_clusters:
                for new_cluster_id, new_cluster_title, new_cluster_emb in new_batch_clusters:
                    if article_emb is not None and new_cluster_emb is not None:
                        similarity = cosine_similarity(article_emb, new_cluster_emb)
                        
                        if similarity >= self.config.EMBEDDING_SIMILARITY_THRESHOLD:
                            # Find the cluster object
                            for cluster in active_clusters[original_cluster_count:]:
                                if cluster['id'] == new_cluster_id:
                                    matched_cluster = cluster
                                    matched = True
                                    best_similarity = similarity
                                    break
                            if matched:
                                break
            
            if matched and matched_cluster:
                # EMBEDDING MATCHED (>= 0.75) - Add directly to cluster (embedding is reliable)
                sim_display = f" (similarity: {best_similarity:.3f})" if best_similarity > 0 else ""
                print(f"\n   ✅ EMBEDDING MATCH [{i+1}/{len(articles)}]{sim_display}")
                print(f"      📰 Article: {full_title}")
                print(f"      📁 Adding to cluster: {matched_cluster['event_name']}")
                
                # Add directly to cluster - embedding match is reliable
                if self.add_to_cluster(matched_cluster['id'], source_id):
                    print(f"      ✅ Added to existing cluster: {matched_cluster['id']}")
                with stats_lock:
                    stats['matched_to_existing'] += 1
                    if matched_cluster['id'] not in stats['cluster_ids']:
                        stats['cluster_ids'].append(matched_cluster['id'])
            else:
                # NO EMBEDDING MATCH - Use AI to check if it belongs to any cluster
                print(f"\n   🧠 AI CLUSTER CHECK [{i+1}/{len(articles)}]")
                print(f"      📰 Article: {full_title}")
                print(f"      No embedding match found - asking AI to verify...")
                
                # AI checks all active clusters to see if article belongs somewhere
                ai_result = ai_check_cluster_match(
                    new_article_title=full_title,
                    existing_clusters=active_clusters
                )
                
                if ai_result['action'] == 'add_to_cluster' and ai_result['cluster_id']:
                    # AI found a matching cluster that embedding missed
                    if self.add_to_cluster(ai_result['cluster_id'], source_id):
                        # Find cluster name for logging
                        cluster_name = "Unknown"
                        for c in active_clusters:
                            if c['id'] == ai_result['cluster_id']:
                                cluster_name = c['event_name']
                                break
                        print(f"      ✅ AI added to cluster: {ai_result['cluster_id']} ({cluster_name})")
                    with stats_lock:
                        stats['matched_to_existing'] += 1
                        if ai_result['cluster_id'] not in stats['cluster_ids']:
                            stats['cluster_ids'].append(ai_result['cluster_id'])
                    continue
                
                # AI says create new cluster (either major update or different topic)
                # BEFORE creating, check if similar article is already PUBLISHED
                skip_article = False
                try:
                    from difflib import SequenceMatcher
                    import re
                    
                    cutoff_time = (datetime.utcnow() - timedelta(hours=24)).isoformat()
                    recent_published = self.supabase.table('published_articles')\
                        .select('id, title_news')\
                        .gte('published_at', cutoff_time)\
                        .execute()
                    
                    def clean_title(t):
                        if not t:
                            return ''
                        t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
                        t = re.sub(r'[^\w\s]', '', t.lower())
                        return t.strip()
                    
                    clean_new_title = clean_title(full_title)
                    
                    for pub in (recent_published.data or []):
                        pub_title = pub.get('title_news', '')
                        clean_pub_title = clean_title(pub_title)
                        
                        if clean_new_title and clean_pub_title:
                            similarity = SequenceMatcher(None, clean_new_title, clean_pub_title).ratio()
                            
                            if similarity >= 0.65:  # 65% = likely same story
                                print(f"      ⏭️ SKIPPING - Similar to published article (similarity: {similarity:.0%})")
                                print(f"         Published (ID {pub['id']}): {pub_title[:60]}...")
                                skip_article = True
                                break
                except Exception as e:
                    print(f"      ⚠️ Published article check error: {e}")
                
                if skip_article:
                    with stats_lock:
                        stats['failed'] += 1
                    continue
                
                # Create new cluster (AI decided it's a major update or different topic)
                # Pass embedding for database caching
                cluster_id = self.create_cluster(article, source_id, embedding=article_emb)
                if cluster_id:
                    event_name = self._generate_event_name(article.get('title', ''))
                    if ai_result['action'] == 'new_cluster_major_update':
                        print(f"      ✨ NEW CLUSTER (MAJOR UPDATE): {cluster_id}")
                    else:
                        print(f"      ✨ NEW CLUSTER (DIFFERENT TOPIC): {cluster_id}")
                    print(f"         📁 Cluster name: {event_name}")
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
                    cluster_embeddings[cluster_id] = article_emb  # Store embedding for new cluster
                    
                    # Track this new cluster for embedding matching with subsequent articles
                    new_batch_clusters.append((cluster_id, article.get('title', ''), article_emb))
                else:
                    print(f"\n   ❌ FAILED [{i+1}/{len(articles)}]")
                    print(f"      📰 Article: {full_title}")
                    print(f"      ⚠️  Could not create cluster")
                    with stats_lock:
                        stats['failed'] += 1
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"CLUSTERING COMPLETE (EMBEDDING-BASED v2.0)")
        print(f"{'='*60}")
        print(f"✓ Articles saved: {stats['saved_articles']}/{stats['total_articles']}")
        print(f"✓ Matched to existing clusters: {stats['matched_to_existing']}")
        print(f"✓ New clusters created: {stats['new_clusters_created']}")
        if stats['already_clustered'] > 0:
            print(f"⏭️ Already in clusters (skipped): {stats['already_clustered']}")
        print(f"✓ Total active clusters: {len(active_clusters)}")
        print(f"✓ Embedding threshold: {self.config.EMBEDDING_SIMILARITY_THRESHOLD}")
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


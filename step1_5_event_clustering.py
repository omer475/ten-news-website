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

load_dotenv()

# ==========================================
# CONFIGURATION
# ==========================================

class ClusteringConfig:
    """Configuration for clustering algorithm"""
    
    # Matching thresholds
    TITLE_SIMILARITY_THRESHOLD = 0.75  # 75% title similarity = same event (strong match)
    MIN_TITLE_SIMILARITY = 0.55  # Minimum 55% title similarity even with keyword match (lowered to prevent duplicate articles)
    KEYWORD_MATCH_THRESHOLD = 5  # 5+ shared keywords = same event (increased from 3)
    ENTITY_MATCH_THRESHOLD = 2  # 2+ shared entities adds confidence
    
    # Time windows
    MAX_CLUSTER_AGE_HOURS = 24  # Only match with clusters created in last 24h
    MAX_ARTICLE_AGE_HOURS = 48  # Only process articles from last 48h
    
    # Cluster lifecycle
    CLUSTER_INACTIVITY_HOURS = 24  # Close cluster after 24h without updates
    CLUSTER_MAX_LIFETIME_HOURS = 48  # Close cluster after 48h regardless
    
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
    Calculate similarity ratio between two titles.
    
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
# EVENT MATCHING
# ==========================================

def is_same_event(article: Dict, cluster: Dict, cluster_sources: List[Dict], debug: bool = False) -> Dict:
    """
    Determine if an article belongs to an existing cluster.
    
    Matching criteria (IMPROVED for accuracy):
    1. Published within 24 hours of cluster creation
    2. Title similarity >= 75% (strong match), OR
    3. Title similarity >= 70% AND (5+ shared keywords OR 2+ shared entities)
    
    Args:
        article: Article to match with title, keywords, entities, published_at
        cluster: Cluster metadata with created_at
        cluster_sources: List of source articles in the cluster
        debug: If True, print debug information
        
    Returns:
        Dict with 'match' (bool), 'reason' (str), 'title_sim' (float), 'shared_keywords' (list)
    """
    # Check 1: Time proximity (24 hours)
    cluster_created = datetime.fromisoformat(cluster['created_at'].replace('Z', '+00:00'))
    article_published = article.get('published_at')
    
    if article_published:
        if isinstance(article_published, str):
            article_published = datetime.fromisoformat(article_published.replace('Z', '+00:00'))
        
        time_diff = abs((article_published - cluster_created).total_seconds() / 3600)
        if time_diff > ClusteringConfig.MAX_CLUSTER_AGE_HOURS:
            return {'match': False, 'reason': 'too_old', 'title_sim': 0.0, 'shared_keywords': []}
    
    # Get representative article from cluster (highest score)
    if not cluster_sources:
        return {'match': False, 'reason': 'no_sources', 'title_sim': 0.0, 'shared_keywords': []}
    
    representative = max(cluster_sources, key=lambda x: x.get('score', 0))
    
    # Check 2: Title similarity
    article_title = article.get('title', '')
    representative_title = representative.get('title', '')
    
    title_similarity = calculate_title_similarity(article_title, representative_title)
    
    # STRONG MATCH: High title similarity
    if title_similarity >= ClusteringConfig.TITLE_SIMILARITY_THRESHOLD:
        if debug:
            print(f"  ✅ STRONG MATCH: Title similarity {title_similarity:.2%} >= {ClusteringConfig.TITLE_SIMILARITY_THRESHOLD:.0%}")
        return {'match': True, 'reason': 'high_title_similarity', 'title_sim': title_similarity, 'shared_keywords': []}
    
    # Check 3: Keyword/Entity overlap (ONLY if title similarity >= 70%)
    if title_similarity < ClusteringConfig.MIN_TITLE_SIMILARITY:
        if debug:
            print(f"  ❌ REJECTED: Title similarity {title_similarity:.2%} < minimum {ClusteringConfig.MIN_TITLE_SIMILARITY:.0%}")
        return {'match': False, 'reason': 'title_too_different', 'title_sim': title_similarity, 'shared_keywords': []}
    
    article_keywords = set(article.get('keywords', []))
    article_entities = set(article.get('entities', []))
    
    rep_keywords = set(representative.get('keywords', []))
    rep_entities = set(representative.get('entities', []))
    
    shared_keywords = article_keywords.intersection(rep_keywords)
    shared_entities = article_entities.intersection(rep_entities)
    
    # MODERATE MATCH: Good keyword overlap + decent title similarity
    if len(shared_keywords) >= ClusteringConfig.KEYWORD_MATCH_THRESHOLD:
        if debug:
            print(f"  ✅ MODERATE MATCH: Title {title_similarity:.2%}, Keywords: {len(shared_keywords)}/{ClusteringConfig.KEYWORD_MATCH_THRESHOLD} ({', '.join(list(shared_keywords)[:5])}...)")
        return {'match': True, 'reason': 'keyword_match', 'title_sim': title_similarity, 'shared_keywords': list(shared_keywords)}
    
    # ENTITY MATCH: Shared named entities (people, places, orgs) + decent title similarity
    if len(shared_entities) >= ClusteringConfig.ENTITY_MATCH_THRESHOLD:
        if debug:
            print(f"  ✅ ENTITY MATCH: Title {title_similarity:.2%}, Entities: {len(shared_entities)}/{ClusteringConfig.ENTITY_MATCH_THRESHOLD} ({', '.join(list(shared_entities))})")
        return {'match': True, 'reason': 'entity_match', 'title_sim': title_similarity, 'shared_keywords': list(shared_entities)}
    
    if debug:
        print(f"  ❌ NO MATCH: Title {title_similarity:.2%}, Keywords: {len(shared_keywords)}, Entities: {len(shared_entities)}")
    
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
    
    def get_or_create_source_article(self, article: Dict) -> Optional[int]:
        """
        Get existing article from source_articles by URL, or create if not exists.
        
        Args:
            article: Article dict with url, title, description, etc.
            
        Returns:
            Article ID if successful, None if failed
        """
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
            print(f"❌ Error getting/creating source article: {e}")
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
        
        Process:
        1. Save all articles to source_articles table
        2. Get active clusters
        3. For each article, try to match with existing cluster
        4. If no match, create new cluster
        
        Args:
            articles: List of approved articles from Step 1
            
        Returns:
            Dict with clustering statistics and cluster IDs
        """
        print(f"\n{'='*60}")
        print(f"STEP 1.5: EVENT CLUSTERING")
        print(f"{'='*60}")
        print(f"Total articles to cluster: {len(articles)}\n")
        
        stats = {
            'total_articles': len(articles),
            'saved_articles': 0,
            'matched_to_existing': 0,
            'new_clusters_created': 0,
            'failed': 0,
            'cluster_ids': []  # Track ALL affected cluster IDs (new + updated)
        }
        
        # Get active clusters
        active_clusters = self.get_active_clusters()
        print(f"📊 Found {len(active_clusters)} active clusters\n")
        
        for i, article in enumerate(articles, 1):
            title = article.get('title', 'Unknown')[:60]
            print(f"[{i}/{len(articles)}] Processing: {title}")
            
            # Get or create article in source_articles table
            source_id = self.get_or_create_source_article(article)
            
            if not source_id:
                print(f"  ❌ Failed to get/create article")
                stats['failed'] += 1
                continue
            
            stats['saved_articles'] += 1
            
            # Add keywords and entities to article for matching
            article['keywords'] = extract_keywords(
                article.get('title', ''),
                article.get('description', '')
            )
            article['entities'] = extract_entities(
                article.get('title', ''),
                article.get('description', '')
            )
            
            # Try to match with existing clusters
            matched = False
            
            for cluster in active_clusters:
                cluster_sources = self.get_cluster_sources(cluster['id'])
                
                match_result = is_same_event(article, cluster, cluster_sources, debug=True)
                
                if match_result['match']:
                    # Add to this cluster
                    if self.add_to_cluster(cluster['id'], source_id):
                        print(f"  ✓ Added to cluster: {cluster['event_name']}")
                        stats['matched_to_existing'] += 1
                        # Track this cluster as updated
                        if cluster['id'] not in stats['cluster_ids']:
                            stats['cluster_ids'].append(cluster['id'])
                        matched = True
                        break
            
            # If no match found, create new cluster
            if not matched:
                cluster_id = self.create_cluster(article, source_id)
                if cluster_id:
                    event_name = self._generate_event_name(article.get('title', ''))
                    print(f"  ✨ Created new cluster: {event_name}")
                    stats['new_clusters_created'] += 1
                    # Track this new cluster
                    stats['cluster_ids'].append(cluster_id)
                    
                    # Add to active clusters for subsequent matching
                    active_clusters.append({
                        'id': cluster_id,
                        'event_name': event_name,
                        'main_title': article.get('title', ''),
                        'created_at': datetime.utcnow().isoformat(),
                        'last_updated_at': datetime.utcnow().isoformat(),
                        'source_count': 1,
                        'importance_score': article.get('score', 0),
                        'status': 'active'
                    })
                else:
                    print(f"  ❌ Failed to create cluster")
                    stats['failed'] += 1
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"CLUSTERING COMPLETE")
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


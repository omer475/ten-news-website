#!/usr/bin/env python3
"""
CLUSTER LIFECYCLE MANAGER
==========================================
Purpose: Manage cluster lifecycle - auto-close stale clusters
Rules:
  - Close cluster after 24 hours of inactivity
  - Close cluster after 48 hours max lifetime
  - Closed clusters don't accept new articles or updates
"""

import os
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


# ==========================================
# CONFIGURATION
# ==========================================

class LifecycleConfig:
    """Configuration for cluster lifecycle management"""
    
    # Cluster closure rules
    INACTIVITY_HOURS = 24  # Close after 24h without updates
    MAX_LIFETIME_HOURS = 48  # Close after 48h regardless of activity
    
    # Merge detection
    MERGE_SIMILARITY_THRESHOLD = 0.80  # 80% title similarity for merging
    MERGE_SHARED_SOURCES_THRESHOLD = 2  # 2+ shared sources = possible duplicate


# ==========================================
# LIFECYCLE MANAGER
# ==========================================

class ClusterLifecycleManager:
    """
    Manages the lifecycle of event clusters.
    Auto-closes stale clusters based on inactivity and age rules.
    """
    
    def __init__(self):
        """Initialize lifecycle manager with Supabase client"""
        self.supabase = self._get_supabase_client()
        self.config = LifecycleConfig()
    
    def _get_supabase_client(self) -> Client:
        """Get Supabase client instance"""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        
        return create_client(url, key)
    
    def get_active_clusters(self) -> List[Dict]:
        """
        Get all active clusters.
        
        Returns:
            List of active cluster dicts
        """
        try:
            result = self.supabase.table('clusters').select(
                '*'
            ).eq('status', 'active').execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting active clusters: {e}")
            return []
    
    def close_cluster(self, cluster_id: int, reason: str) -> bool:
        """
        Mark cluster as closed (no longer accepts new articles or updates).
        
        Args:
            cluster_id: Cluster ID
            reason: Reason for closure (e.g., "24h_inactivity", "max_lifetime_reached")
            
        Returns:
            True if successful
        """
        try:
            self.supabase.table('clusters').update({
                'status': 'closed',
                'closed_at': datetime.utcnow().isoformat()
            }).eq('id', cluster_id).execute()
            
            print(f"  ✓ Cluster {cluster_id} closed: {reason}")
            return True
            
        except Exception as e:
            print(f"❌ Error closing cluster {cluster_id}: {e}")
            return False
    
    def check_inactivity(self, cluster: Dict) -> bool:
        """
        Check if cluster has been inactive for too long.
        
        Args:
            cluster: Cluster dict with last_updated_at
            
        Returns:
            True if cluster should be closed due to inactivity
        """
        last_updated = datetime.fromisoformat(
            cluster['last_updated_at'].replace('Z', '+00:00')
        )
        hours_since_update = (
            datetime.utcnow() - last_updated.replace(tzinfo=None)
        ).total_seconds() / 3600
        
        return hours_since_update >= self.config.INACTIVITY_HOURS
    
    def check_max_lifetime(self, cluster: Dict) -> bool:
        """
        Check if cluster has exceeded maximum lifetime.
        
        Args:
            cluster: Cluster dict with created_at
            
        Returns:
            True if cluster should be closed due to age
        """
        created_at = datetime.fromisoformat(
            cluster['created_at'].replace('Z', '+00:00')
        )
        hours_since_creation = (
            datetime.utcnow() - created_at.replace(tzinfo=None)
        ).total_seconds() / 3600
        
        return hours_since_creation >= self.config.MAX_LIFETIME_HOURS
    
    def manage_lifecycle(self) -> Dict:
        """
        Main lifecycle management: check all active clusters and close stale ones.
        
        Returns:
            Statistics dict
        """
        print(f"\n{'='*60}")
        print(f"CLUSTER LIFECYCLE MANAGEMENT")
        print(f"{'='*60}\n")
        
        stats = {
            'active_clusters': 0,
            'closed_inactivity': 0,
            'closed_max_lifetime': 0,
            'total_closed': 0
        }
        
        try:
            # Get all active clusters
            clusters = self.get_active_clusters()
            stats['active_clusters'] = len(clusters)
            
            if not clusters:
                print("No active clusters found")
                return stats
            
            print(f"Checking {len(clusters)} active clusters...\n")
            
            for cluster in clusters:
                cluster_id = cluster['id']
                event_name = cluster['event_name'][:50]
                
                # Check max lifetime (priority check)
                if self.check_max_lifetime(cluster):
                    created_hours_ago = (
                        datetime.utcnow() - 
                        datetime.fromisoformat(cluster['created_at'].replace('Z', '+00:00')).replace(tzinfo=None)
                    ).total_seconds() / 3600
                    
                    print(f"🕐 {event_name}")
                    print(f"   Age: {created_hours_ago:.1f}h (max: {self.config.MAX_LIFETIME_HOURS}h)")
                    
                    if self.close_cluster(cluster_id, 'max_lifetime_reached'):
                        stats['closed_max_lifetime'] += 1
                        stats['total_closed'] += 1
                    continue
                
                # Check inactivity
                if self.check_inactivity(cluster):
                    inactive_hours = (
                        datetime.utcnow() - 
                        datetime.fromisoformat(cluster['last_updated_at'].replace('Z', '+00:00')).replace(tzinfo=None)
                    ).total_seconds() / 3600
                    
                    print(f"💤 {event_name}")
                    print(f"   Inactive: {inactive_hours:.1f}h (limit: {self.config.INACTIVITY_HOURS}h)")
                    
                    if self.close_cluster(cluster_id, '24h_inactivity'):
                        stats['closed_inactivity'] += 1
                        stats['total_closed'] += 1
                    continue
            
            print(f"\n{'='*60}")
            print(f"LIFECYCLE MANAGEMENT COMPLETE")
            print(f"{'='*60}")
            print(f"Active clusters: {stats['active_clusters']}")
            print(f"Closed (inactivity): {stats['closed_inactivity']}")
            print(f"Closed (max lifetime): {stats['closed_max_lifetime']}")
            print(f"Total closed: {stats['total_closed']}")
            print(f"Still active: {stats['active_clusters'] - stats['total_closed']}")
            
            return stats
            
        except Exception as e:
            print(f"❌ Lifecycle management error: {e}")
            return stats
    
    def get_cluster_sources(self, cluster_id: int) -> List[Dict]:
        """Get source articles for a cluster"""
        try:
            result = self.supabase.table('source_articles').select(
                'id, url, normalized_url, title'
            ).eq('cluster_id', cluster_id).execute()
            
            return result.data if result.data else []
        except:
            return []
    
    def calculate_title_similarity(self, title1: str, title2: str) -> float:
        """Calculate similarity between two titles (from clustering engine)"""
        from difflib import SequenceMatcher
        import re
        
        # Normalize
        t1 = re.sub(r'[^\w\s]', '', title1.lower().strip())
        t2 = re.sub(r'[^\w\s]', '', title2.lower().strip())
        
        return SequenceMatcher(None, t1, t2).ratio()
    
    def should_merge_clusters(self, cluster1: Dict, cluster2: Dict) -> bool:
        """
        Check if two clusters should be merged (they're about the same event).
        
        Args:
            cluster1: First cluster
            cluster2: Second cluster
            
        Returns:
            True if clusters should be merged
        """
        # High title similarity
        similarity = self.calculate_title_similarity(
            cluster1['main_title'],
            cluster2['main_title']
        )
        
        if similarity >= self.config.MERGE_SIMILARITY_THRESHOLD:
            return True
        
        # Shared sources (same URLs)
        sources1 = self.get_cluster_sources(cluster1['id'])
        sources2 = self.get_cluster_sources(cluster2['id'])
        
        urls1 = set(s['normalized_url'] for s in sources1)
        urls2 = set(s['normalized_url'] for s in sources2)
        
        shared_urls = urls1.intersection(urls2)
        
        if len(shared_urls) >= self.config.MERGE_SHARED_SOURCES_THRESHOLD:
            return True
        
        return False
    
    def merge_clusters(self, primary_id: int, secondary_id: int) -> bool:
        """
        Merge secondary cluster into primary cluster.
        
        Args:
            primary_id: Primary cluster ID (keeps this one)
            secondary_id: Secondary cluster ID (will be closed)
            
        Returns:
            True if successful
        """
        try:
            print(f"  🔗 Merging cluster {secondary_id} into {primary_id}")
            
            # Move all source articles from secondary to primary
            self.supabase.table('source_articles').update({
                'cluster_id': primary_id
            }).eq('cluster_id', secondary_id).execute()
            
            # Close secondary cluster
            self.close_cluster(secondary_id, f'merged_into_{primary_id}')
            
            # Update primary cluster timestamp (trigger will update source_count and importance_score)
            self.supabase.table('clusters').update({
                'last_updated_at': datetime.utcnow().isoformat()
            }).eq('id', primary_id).execute()
            
            print(f"  ✓ Merge complete")
            return True
            
        except Exception as e:
            print(f"❌ Merge error: {e}")
            return False
    
    def detect_and_merge_duplicates(self) -> Dict:
        """
        Detect and merge duplicate clusters about the same event.
        
        Returns:
            Statistics dict
        """
        print(f"\n{'='*60}")
        print(f"DETECTING DUPLICATE CLUSTERS")
        print(f"{'='*60}\n")
        
        stats = {
            'clusters_checked': 0,
            'duplicates_found': 0,
            'merges_performed': 0
        }
        
        try:
            # Get all active clusters
            clusters = self.get_active_clusters()
            stats['clusters_checked'] = len(clusters)
            
            if len(clusters) < 2:
                print("Not enough clusters to check for duplicates")
                return stats
            
            print(f"Checking {len(clusters)} clusters for duplicates...\n")
            
            # Check pairs of clusters
            merged = set()  # Track merged cluster IDs
            
            for i, cluster1 in enumerate(clusters):
                if cluster1['id'] in merged:
                    continue
                
                for cluster2 in clusters[i+1:]:
                    if cluster2['id'] in merged:
                        continue
                    
                    if self.should_merge_clusters(cluster1, cluster2):
                        event1 = cluster1['event_name'][:40]
                        event2 = cluster2['event_name'][:40]
                        
                        print(f"🔍 Duplicate detected:")
                        print(f"   Primary: {event1}")
                        print(f"   Secondary: {event2}")
                        
                        stats['duplicates_found'] += 1
                        
                        # Merge (keep cluster with higher importance_score)
                        if cluster1['importance_score'] >= cluster2['importance_score']:
                            if self.merge_clusters(cluster1['id'], cluster2['id']):
                                merged.add(cluster2['id'])
                                stats['merges_performed'] += 1
                        else:
                            if self.merge_clusters(cluster2['id'], cluster1['id']):
                                merged.add(cluster1['id'])
                                stats['merges_performed'] += 1
                                break  # cluster1 is merged, move to next
            
            print(f"\n{'='*60}")
            print(f"DUPLICATE DETECTION COMPLETE")
            print(f"{'='*60}")
            print(f"Clusters checked: {stats['clusters_checked']}")
            print(f"Duplicates found: {stats['duplicates_found']}")
            print(f"Merges performed: {stats['merges_performed']}")
            
            return stats
            
        except Exception as e:
            print(f"❌ Duplicate detection error: {e}")
            return stats


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    print("🧪 TESTING CLUSTER LIFECYCLE MANAGER")
    print("=" * 80)
    
    try:
        manager = ClusterLifecycleManager()
        
        # Test 1: Manage lifecycle (close stale clusters)
        print("\n=== TEST 1: LIFECYCLE MANAGEMENT ===")
        lifecycle_stats = manager.manage_lifecycle()
        
        # Test 2: Detect duplicates
        print("\n\n=== TEST 2: DUPLICATE DETECTION ===")
        duplicate_stats = manager.detect_and_merge_duplicates()
        
        print(f"\n📊 OVERALL STATISTICS:")
        print(f"   Active clusters: {lifecycle_stats['active_clusters']}")
        print(f"   Closed: {lifecycle_stats['total_closed']}")
        print(f"   Duplicates merged: {duplicate_stats['merges_performed']}")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()


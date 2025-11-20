#!/usr/bin/env python3
"""
ARTICLE UPDATE MANAGER
==========================================
Purpose: Monitor clusters and trigger article regeneration when new sources arrive
Triggers: 1) High-score article (≥850/1000), 2) Volume (4+ new sources)
Safety: 30-minute cooldown between updates
"""

import os
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Import synthesis module
from step3_multi_source_synthesis import MultiSourceSynthesizer

load_dotenv()


# ==========================================
# CONFIGURATION
# ==========================================

class UpdateConfig:
    """Configuration for update triggers"""
    
    # Trigger thresholds
    HIGH_SCORE_THRESHOLD = 850  # Score >= 850 triggers immediate update
    VOLUME_THRESHOLD = 4  # 4+ new sources trigger update
    
    # Safety cooldown
    COOLDOWN_MINUTES = 30  # Minimum time between updates
    
    # Scoring weight (for importance calculation)
    MAX_SCORE = 1000


# ==========================================
# UPDATE MANAGER
# ==========================================

class ArticleUpdateManager:
    """
    Manages article updates when new sources arrive.
    Monitors clusters and triggers regeneration based on rules.
    """
    
    def __init__(self, claude_api_key: str):
        """
        Initialize update manager.
        
        Args:
            claude_api_key: Anthropic API key for synthesis
        """
        self.supabase = self._get_supabase_client()
        self.synthesizer = MultiSourceSynthesizer(claude_api_key)
        self.config = UpdateConfig()
    
    def _get_supabase_client(self) -> Client:
        """Get Supabase client instance"""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        
        return create_client(url, key)
    
    def get_published_article(self, cluster_id: int) -> Optional[Dict]:
        """
        Get published article for a cluster.
        
        Args:
            cluster_id: Cluster ID
            
        Returns:
            Published article dict or None
        """
        try:
            result = self.supabase.table('published_articles').select(
                '*'
            ).eq('cluster_id', cluster_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            print(f"❌ Error getting published article: {e}")
            return None
    
    def count_new_sources_since_update(self, cluster_id: int, last_update: str) -> int:
        """
        Count how many new sources have been added since last update.
        
        Args:
            cluster_id: Cluster ID
            last_update: ISO timestamp of last update
            
        Returns:
            Count of new sources
        """
        try:
            result = self.supabase.table('source_articles').select(
                'id', count='exact'
            ).eq(
                'cluster_id', cluster_id
            ).gt(
                'fetched_at', last_update
            ).execute()
            
            return result.count if result.count else 0
            
        except Exception as e:
            print(f"❌ Error counting new sources: {e}")
            return 0
    
    def get_cluster_sources(self, cluster_id: int, since: Optional[str] = None) -> List[Dict]:
        """
        Get source articles for a cluster.
        
        Args:
            cluster_id: Cluster ID
            since: Optional ISO timestamp to only get sources after this time
            
        Returns:
            List of source article dicts
        """
        try:
            query = self.supabase.table('source_articles').select('*').eq('cluster_id', cluster_id)
            
            if since:
                query = query.gt('fetched_at', since)
            
            result = query.order('score', desc=True).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting cluster sources: {e}")
            return []
    
    def get_cluster(self, cluster_id: int) -> Optional[Dict]:
        """Get cluster metadata"""
        try:
            result = self.supabase.table('clusters').select('*').eq('id', cluster_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"❌ Error getting cluster: {e}")
            return None
    
    def check_cooldown(self, published_article: Dict) -> bool:
        """
        Check if enough time has passed since last update.
        
        Args:
            published_article: Published article with last_updated_at
            
        Returns:
            True if cooldown period has passed, False if still in cooldown
        """
        last_updated = datetime.fromisoformat(
            published_article['last_updated_at'].replace('Z', '+00:00')
        )
        time_since_update = (datetime.utcnow() - last_updated.replace(tzinfo=None)).total_seconds() / 60
        
        return time_since_update >= self.config.COOLDOWN_MINUTES
    
    def check_update_triggers(self, cluster_id: int, new_article: Dict) -> Optional[str]:
        """
        Check if article should be updated based on triggers.
        
        Triggers:
        1. High score (≥850/1000) = immediate update
        2. Volume (4+ new sources since last update) = batch update
        
        Safety: 30-minute cooldown between updates
        
        Args:
            cluster_id: Cluster ID
            new_article: Newly added source article
            
        Returns:
            Trigger type if update needed, None if no update
        """
        # Get published article
        published_article = self.get_published_article(cluster_id)
        
        if not published_article:
            # No published article yet, no update needed
            return None
        
        # Check cooldown
        if not self.check_cooldown(published_article):
            print(f"  ⏰ Cooldown active (updated {published_article['last_updated_at']})")
            return None
        
        # Trigger 1: High-score article
        article_score = new_article.get('score', 0)
        if article_score >= self.config.HIGH_SCORE_THRESHOLD:
            print(f"  🔥 High-score trigger: {article_score}/1000")
            return 'high_score'
        
        # Trigger 2: Volume trigger (4+ new sources)
        new_sources_count = self.count_new_sources_since_update(
            cluster_id,
            published_article['last_updated_at']
        )
        
        if new_sources_count >= self.config.VOLUME_THRESHOLD:
            print(f"  📊 Volume trigger: {new_sources_count} new sources")
            return 'volume'
        
        return None
    
    def trigger_article_update(self, cluster_id: int, trigger_type: str, trigger_details: str) -> bool:
        """
        Regenerate published article with new sources.
        
        Args:
            cluster_id: Cluster ID
            trigger_type: 'high_score', 'volume', or 'manual'
            trigger_details: Description of what triggered the update
            
        Returns:
            True if update successful
        """
        try:
            print(f"\n🔄 Triggering update for cluster {cluster_id}")
            print(f"   Trigger: {trigger_type} - {trigger_details}")
            
            # Get current published article
            published_article = self.get_published_article(cluster_id)
            if not published_article:
                print(f"  ❌ No published article found")
                return False
            
            # Get cluster
            cluster = self.get_cluster(cluster_id)
            if not cluster:
                print(f"  ❌ Cluster not found")
                return False
            
            # Get all source articles
            all_sources = self.get_cluster_sources(cluster_id)
            
            # Mark new sources (added since last update)
            last_update = published_article['last_updated_at']
            new_sources_count = 0
            
            for source in all_sources:
                fetched_at = datetime.fromisoformat(source['fetched_at'].replace('Z', '+00:00'))
                updated_at = datetime.fromisoformat(last_update.replace('Z', '+00:00'))
                
                if fetched_at > updated_at:
                    source['is_new'] = True
                    new_sources_count += 1
                else:
                    source['is_new'] = False
            
            print(f"   Total sources: {len(all_sources)} ({new_sources_count} new)")
            
            # Synthesize updated article
            cluster['sources'] = all_sources
            updated_content = self.synthesizer.synthesize_cluster(
                cluster,
                all_sources,
                is_update=True,
                current_article=published_article
            )
            
            if not updated_content:
                print(f"  ❌ Synthesis failed")
                return False
            
            # Update published_articles table
            new_version = published_article['version_number'] + 1
            
            update_data = {
                'title_news': updated_content['title_news'],
                'title_b2': updated_content['title_b2'],
                'summary_bullets_news': json.dumps(updated_content['summary_bullets_news']),
                'summary_bullets_b2': json.dumps(updated_content['summary_bullets_b2']),
                'content_news': updated_content['content_news'],
                'content_b2': updated_content['content_b2'],
                'version_number': new_version,
                'last_updated_at': datetime.utcnow().isoformat()
            }
            
            self.supabase.table('published_articles').update(
                update_data
            ).eq('id', published_article['id']).execute()
            
            # Log the update
            self._log_update(
                published_article['id'],
                trigger_type,
                trigger_details,
                new_sources_count,
                published_article['version_number'],
                new_version
            )
            
            # Update cluster timestamp
            self.supabase.table('clusters').update({
                'last_updated_at': datetime.utcnow().isoformat()
            }).eq('id', cluster_id).execute()
            
            print(f"  ✅ Update complete: v{published_article['version_number']} → v{new_version}")
            
            return True
            
        except Exception as e:
            print(f"❌ Update error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _log_update(self, article_id: int, trigger_type: str, trigger_details: str, sources_added: int, old_version: int, new_version: int):
        """
        Log update to article_updates_log table.
        
        Args:
            article_id: Published article ID
            trigger_type: Type of trigger
            trigger_details: Details about trigger
            sources_added: Number of new sources
            old_version: Previous version number
            new_version: New version number
        """
        try:
            log_data = {
                'article_id': article_id,
                'trigger_type': trigger_type,
                'trigger_details': trigger_details,
                'sources_added_count': sources_added,
                'old_version': old_version,
                'new_version': new_version
            }
            
            self.supabase.table('article_updates_log').insert(log_data).execute()
            
        except Exception as e:
            print(f"⚠️ Failed to log update: {e}")
    
    def process_new_article(self, cluster_id: int, new_article: Dict) -> bool:
        """
        Process a newly added article and check if update is needed.
        
        Args:
            cluster_id: Cluster ID the article was added to
            new_article: The newly added source article
            
        Returns:
            True if update was triggered
        """
        print(f"\n🔍 Checking update triggers for cluster {cluster_id}")
        print(f"   New article: {new_article.get('title', 'Unknown')[:60]}")
        print(f"   Score: {new_article.get('score', 0)}/1000")
        
        # Check triggers
        trigger_type = self.check_update_triggers(cluster_id, new_article)
        
        if trigger_type:
            # Build trigger details
            source_name = new_article.get('source_name', 'Unknown')
            score = new_article.get('score', 0)
            trigger_details = f"Source: {source_name}, Score: {score}/1000"
            
            # Trigger update
            return self.trigger_article_update(cluster_id, trigger_type, trigger_details)
        else:
            print(f"  ⏸️  No update triggered")
            return False
    
    def scan_for_updates(self) -> Dict:
        """
        Scan all active clusters for pending updates.
        Checks volume trigger for clusters that weren't updated by high-score trigger.
        
        Returns:
            Statistics dict
        """
        print(f"\n{'='*60}")
        print(f"SCANNING FOR PENDING UPDATES")
        print(f"{'='*60}\n")
        
        stats = {
            'clusters_checked': 0,
            'updates_triggered': 0,
            'cooldown_blocked': 0,
            'no_update_needed': 0
        }
        
        try:
            # Get all active clusters
            clusters = self.supabase.table('clusters').select(
                '*'
            ).eq('status', 'active').execute()
            
            if not clusters.data:
                print("No active clusters found")
                return stats
            
            stats['clusters_checked'] = len(clusters.data)
            
            for cluster in clusters.data:
                cluster_id = cluster['id']
                event_name = cluster['event_name'][:50]
                
                print(f"Checking: {event_name}")
                
                # Get published article
                published_article = self.get_published_article(cluster_id)
                
                if not published_article:
                    print(f"  ⏩ No published article yet")
                    stats['no_update_needed'] += 1
                    continue
                
                # Check cooldown
                if not self.check_cooldown(published_article):
                    print(f"  ⏰ In cooldown period")
                    stats['cooldown_blocked'] += 1
                    continue
                
                # Check volume trigger
                new_sources_count = self.count_new_sources_since_update(
                    cluster_id,
                    published_article['last_updated_at']
                )
                
                if new_sources_count >= self.config.VOLUME_THRESHOLD:
                    print(f"  📊 Volume trigger: {new_sources_count} new sources")
                    trigger_details = f"{new_sources_count} new sources accumulated"
                    
                    if self.trigger_article_update(cluster_id, 'volume', trigger_details):
                        stats['updates_triggered'] += 1
                else:
                    print(f"  ⏸️  No update needed ({new_sources_count} new sources)")
                    stats['no_update_needed'] += 1
            
            print(f"\n{'='*60}")
            print(f"SCAN COMPLETE")
            print(f"{'='*60}")
            print(f"Clusters checked: {stats['clusters_checked']}")
            print(f"Updates triggered: {stats['updates_triggered']}")
            print(f"Cooldown blocked: {stats['cooldown_blocked']}")
            print(f"No update needed: {stats['no_update_needed']}")
            
            return stats
            
        except Exception as e:
            print(f"❌ Scan error: {e}")
            return stats


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    from dotenv import load_dotenv
    
    load_dotenv()
    claude_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not claude_key:
        print("❌ ANTHROPIC_API_KEY not set")
        exit(1)
    
    print("🧪 TESTING ARTICLE UPDATE MANAGER")
    print("=" * 80)
    
    try:
        manager = ArticleUpdateManager(claude_key)
        
        # Test: Scan for updates
        print("\nScanning for pending updates...")
        stats = manager.scan_for_updates()
        
        print(f"\n📊 SCAN RESULTS:")
        print(f"   Clusters checked: {stats['clusters_checked']}")
        print(f"   Updates triggered: {stats['updates_triggered']}")
        print(f"   Cooldown blocked: {stats['cooldown_blocked']}")
        print(f"   No update needed: {stats['no_update_needed']}")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()


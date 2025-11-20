#!/usr/bin/env python3
"""
CLUSTER MONITOR DAEMON
==========================================
Purpose: Continuously monitor clusters for real-time updates
Runs alongside RSS fetcher to handle:
  - New article matching to clusters
  - Update trigger checking
  - Article regeneration
  - Cluster lifecycle management
"""

import os
import time
import signal
import sys
from typing import Dict
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Import managers
from article_update_manager import ArticleUpdateManager
from cluster_lifecycle_manager import ClusterLifecycleManager
from step1_5_event_clustering import EventClusteringEngine

load_dotenv()


# ==========================================
# CONFIGURATION
# ==========================================

class DaemonConfig:
    """Configuration for daemon operation"""
    
    # Monitoring intervals
    CHECK_NEW_ARTICLES_MINUTES = 15  # Check for new articles every 15 min
    LIFECYCLE_CHECK_HOURS = 1  # Check cluster lifecycle every hour
    DUPLICATE_CHECK_HOURS = 6  # Check for duplicate clusters every 6 hours
    
    # Batch processing
    MAX_ARTICLES_PER_BATCH = 50  # Process up to 50 new articles per check


# ==========================================
# CLUSTER MONITOR DAEMON
# ==========================================

class ClusterMonitorDaemon:
    """
    Background daemon that monitors clusters and triggers updates.
    
    Responsibilities:
    - Match new articles to existing clusters
    - Check update triggers (high score, volume)
    - Trigger article regeneration
    - Manage cluster lifecycle (close stale)
    - Detect and merge duplicates
    """
    
    def __init__(self):
        """Initialize daemon with managers and clients"""
        # Get API key for synthesis
        claude_key = os.getenv('ANTHROPIC_API_KEY')
        if not claude_key:
            raise ValueError("ANTHROPIC_API_KEY must be set")
        
        # Initialize components
        self.supabase = self._get_supabase_client()
        self.clustering_engine = EventClusteringEngine()
        self.update_manager = ArticleUpdateManager(claude_key)
        self.lifecycle_manager = ClusterLifecycleManager()
        self.config = DaemonConfig()
        
        # State tracking
        self.running = False
        self.last_article_check = datetime.min
        self.last_lifecycle_check = datetime.min
        self.last_duplicate_check = datetime.min
        
        # Statistics
        self.stats = {
            'cycles_completed': 0,
            'articles_processed': 0,
            'updates_triggered': 0,
            'clusters_closed': 0,
            'clusters_merged': 0,
            'errors': 0
        }
        
        print("🤖 Cluster Monitor Daemon initialized")
        print("=" * 60)
    
    def _get_supabase_client(self) -> Client:
        """Get Supabase client instance"""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        
        return create_client(url, key)
    
    def get_new_unclustered_articles(self) -> list:
        """
        Get recently added articles that haven't been clustered yet.
        
        Returns:
            List of unclustered source articles
        """
        try:
            # Get articles added in last 24 hours that don't have cluster_id
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            result = self.supabase.table('source_articles').select(
                '*'
            ).is_(
                'cluster_id', 'null'
            ).gte(
                'fetched_at', cutoff_time.isoformat()
            ).order(
                'score', desc=True
            ).limit(
                self.config.MAX_ARTICLES_PER_BATCH
            ).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting unclustered articles: {e}")
            return []
    
    def process_new_articles(self) -> Dict:
        """
        Process newly added articles: match to clusters or create new ones.
        
        Returns:
            Statistics dict
        """
        print(f"\n{'='*60}")
        print(f"PROCESSING NEW ARTICLES")
        print(f"{'='*60}")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        stats = {
            'articles_found': 0,
            'matched_to_existing': 0,
            'new_clusters_created': 0,
            'updates_triggered': 0,
            'errors': 0
        }
        
        try:
            # Get unclustered articles
            new_articles = self.get_new_unclustered_articles()
            stats['articles_found'] = len(new_articles)
            
            if not new_articles:
                print("No new articles to process")
                return stats
            
            print(f"Found {len(new_articles)} unclustered articles\n")
            
            # Get active clusters
            active_clusters = self.clustering_engine.get_active_clusters()
            print(f"Active clusters: {len(active_clusters)}\n")
            
            # Process each article
            for i, article in enumerate(new_articles, 1):
                title = article.get('title', 'Unknown')[:60]
                print(f"[{i}/{len(new_articles)}] {title}")
                
                try:
                    # Extract keywords and entities for matching
                    from step1_5_event_clustering import extract_keywords, extract_entities
                    
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
                    
                    from step1_5_event_clustering import is_same_event
                    
                    for cluster in active_clusters:
                        cluster_sources = self.clustering_engine.get_cluster_sources(cluster['id'])
                        
                        if is_same_event(article, cluster, cluster_sources):
                            # Add to cluster
                            source_id = article['id']
                            if self.clustering_engine.add_to_cluster(cluster['id'], source_id):
                                print(f"  ✓ Added to cluster: {cluster['event_name'][:50]}")
                                stats['matched_to_existing'] += 1
                                matched = True
                                
                                # Check if update should be triggered
                                trigger = self.update_manager.check_update_triggers(cluster['id'], article)
                                if trigger:
                                    self.update_manager.trigger_article_update(
                                        cluster['id'],
                                        trigger,
                                        f"Source: {article.get('source_name', 'Unknown')}, Score: {article.get('score', 0)}"
                                    )
                                    stats['updates_triggered'] += 1
                                
                                break
                    
                    # If no match, create new cluster
                    if not matched:
                        cluster_id = self.clustering_engine.create_cluster(article, article['id'])
                        if cluster_id:
                            event_name = self.clustering_engine._generate_event_name(article.get('title', ''))
                            print(f"  ✨ Created new cluster: {event_name}")
                            stats['new_clusters_created'] += 1
                            
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
                            stats['errors'] += 1
                    
                except Exception as e:
                    print(f"  ❌ Error processing article: {e}")
                    stats['errors'] += 1
            
            # Update global stats
            self.stats['articles_processed'] += stats['articles_found']
            self.stats['updates_triggered'] += stats['updates_triggered']
            
            print(f"\n{'='*60}")
            print(f"PROCESSING COMPLETE")
            print(f"{'='*60}")
            print(f"Articles processed: {stats['articles_found']}")
            print(f"Matched to existing: {stats['matched_to_existing']}")
            print(f"New clusters: {stats['new_clusters_created']}")
            print(f"Updates triggered: {stats['updates_triggered']}")
            if stats['errors'] > 0:
                print(f"Errors: {stats['errors']}")
            
            return stats
            
        except Exception as e:
            print(f"❌ Processing error: {e}")
            self.stats['errors'] += 1
            return stats
    
    def run_lifecycle_management(self) -> Dict:
        """
        Run cluster lifecycle management.
        
        Returns:
            Statistics dict
        """
        stats = self.lifecycle_manager.manage_lifecycle()
        self.stats['clusters_closed'] += stats['total_closed']
        return stats
    
    def run_duplicate_detection(self) -> Dict:
        """
        Run duplicate cluster detection and merging.
        
        Returns:
            Statistics dict
        """
        stats = self.lifecycle_manager.detect_and_merge_duplicates()
        self.stats['clusters_merged'] += stats['merges_performed']
        return stats
    
    def should_check_articles(self) -> bool:
        """Check if it's time to process new articles"""
        minutes_since_last = (datetime.utcnow() - self.last_article_check).total_seconds() / 60
        return minutes_since_last >= self.config.CHECK_NEW_ARTICLES_MINUTES
    
    def should_check_lifecycle(self) -> bool:
        """Check if it's time to run lifecycle management"""
        hours_since_last = (datetime.utcnow() - self.last_lifecycle_check).total_seconds() / 3600
        return hours_since_last >= self.config.LIFECYCLE_CHECK_HOURS
    
    def should_check_duplicates(self) -> bool:
        """Check if it's time to check for duplicates"""
        hours_since_last = (datetime.utcnow() - self.last_duplicate_check).total_seconds() / 3600
        return hours_since_last >= self.config.DUPLICATE_CHECK_HOURS
    
    def run_cycle(self):
        """
        Run one monitoring cycle: check various tasks based on schedule.
        """
        cycle_start = time.time()
        
        print(f"\n{'#'*60}")
        print(f"# MONITORING CYCLE #{self.stats['cycles_completed'] + 1}")
        print(f"# {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'#'*60}")
        
        tasks_run = []
        
        # Task 1: Process new articles (every 15 min)
        if self.should_check_articles():
            tasks_run.append("new_articles")
            self.process_new_articles()
            self.last_article_check = datetime.utcnow()
        
        # Task 2: Lifecycle management (every hour)
        if self.should_check_lifecycle():
            tasks_run.append("lifecycle")
            self.run_lifecycle_management()
            self.last_lifecycle_check = datetime.utcnow()
        
        # Task 3: Duplicate detection (every 6 hours)
        if self.should_check_duplicates():
            tasks_run.append("duplicates")
            self.run_duplicate_detection()
            self.last_duplicate_check = datetime.utcnow()
        
        # Update stats
        self.stats['cycles_completed'] += 1
        cycle_time = time.time() - cycle_start
        
        print(f"\n{'='*60}")
        print(f"CYCLE COMPLETE")
        print(f"{'='*60}")
        print(f"Tasks run: {', '.join(tasks_run) if tasks_run else 'none (waiting)'}")
        print(f"Cycle time: {cycle_time:.1f}s")
        print(f"\nOVERALL STATISTICS:")
        print(f"  Cycles: {self.stats['cycles_completed']}")
        print(f"  Articles processed: {self.stats['articles_processed']}")
        print(f"  Updates triggered: {self.stats['updates_triggered']}")
        print(f"  Clusters closed: {self.stats['clusters_closed']}")
        print(f"  Clusters merged: {self.stats['clusters_merged']}")
        if self.stats['errors'] > 0:
            print(f"  Errors: {self.stats['errors']}")
    
    def start(self):
        """Start the daemon (runs indefinitely)"""
        self.running = True
        
        print(f"\n🚀 Starting Cluster Monitor Daemon")
        print(f"   New articles check: every {self.config.CHECK_NEW_ARTICLES_MINUTES} minutes")
        print(f"   Lifecycle check: every {self.config.LIFECYCLE_CHECK_HOURS} hour(s)")
        print(f"   Duplicate check: every {self.config.DUPLICATE_CHECK_HOURS} hour(s)")
        print(f"\n   Press Ctrl+C to stop\n")
        
        # Set up signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        try:
            while self.running:
                self.run_cycle()
                
                # Sleep for 1 minute between cycles
                if self.running:
                    time.sleep(60)
                    
        except KeyboardInterrupt:
            print("\n\n⚠️  Keyboard interrupt received")
            self.stop()
        except Exception as e:
            print(f"\n\n❌ Daemon error: {e}")
            import traceback
            traceback.print_exc()
            self.stop()
    
    def stop(self):
        """Stop the daemon"""
        print(f"\n🛑 Stopping Cluster Monitor Daemon...")
        self.running = False
        
        print(f"\n📊 FINAL STATISTICS:")
        print(f"   Total cycles: {self.stats['cycles_completed']}")
        print(f"   Articles processed: {self.stats['articles_processed']}")
        print(f"   Updates triggered: {self.stats['updates_triggered']}")
        print(f"   Clusters closed: {self.stats['clusters_closed']}")
        print(f"   Clusters merged: {self.stats['clusters_merged']}")
        print(f"   Errors: {self.stats['errors']}")
        
        print(f"\n✅ Daemon stopped\n")
    
    def _signal_handler(self, signum, frame):
        """Handle termination signals"""
        print(f"\n\n⚠️  Signal {signum} received")
        self.stop()
        sys.exit(0)


# ==========================================
# MAIN ENTRY POINT
# ==========================================

if __name__ == "__main__":
    print("🤖 CLUSTER MONITOR DAEMON")
    print("=" * 80)
    
    try:
        daemon = ClusterMonitorDaemon()
        daemon.start()
        
    except Exception as e:
        print(f"❌ Daemon initialization error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


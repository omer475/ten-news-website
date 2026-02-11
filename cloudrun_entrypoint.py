"""
Cloud Run Entrypoint for Ten News
==================================
Runs a SINGLE iteration of the news workflow.
Cloud Scheduler triggers this every 10 minutes.
Includes run lock to prevent overlapping executions.
"""

import os
import sys
import time
from datetime import datetime, timedelta
from flask import Flask, jsonify

app = Flask(__name__)

# Run lock timeout - if a run has been going for longer than this, assume it crashed
RUN_LOCK_TIMEOUT_MINUTES = 30


def acquire_run_lock(supabase):
    """
    Try to acquire a run lock via Supabase.
    Returns True if lock acquired, False if another run is active.
    """
    try:
        now = datetime.utcnow()
        cutoff = (now - timedelta(minutes=RUN_LOCK_TIMEOUT_MINUTES)).isoformat()
        
        # Check for active lock (started recently enough to still be valid)
        result = supabase.table('pipeline_run_lock')\
            .select('*')\
            .eq('is_running', True)\
            .gte('started_at', cutoff)\
            .execute()
        
        if result.data and len(result.data) > 0:
            active_run = result.data[0]
            started = active_run.get('started_at', 'unknown')
            print(f"🔒 Another run is active (started: {started}). Skipping this trigger.")
            return False
        
        # Clear any stale locks (older than timeout)
        supabase.table('pipeline_run_lock')\
            .update({'is_running': False, 'finished_at': now.isoformat()})\
            .eq('is_running', True)\
            .lt('started_at', cutoff)\
            .execute()
        
        # Acquire lock - upsert a single row (id=1)
        supabase.table('pipeline_run_lock').upsert({
            'id': 1,
            'is_running': True,
            'started_at': now.isoformat(),
            'finished_at': None
        }).execute()
        
        print(f"🔓 Run lock acquired at {now.isoformat()}")
        return True
        
    except Exception as e:
        print(f"⚠️ Run lock check failed (proceeding anyway): {e}")
        # If the lock table doesn't exist yet, proceed without locking
        return True


def release_run_lock(supabase):
    """Release the run lock."""
    try:
        now = datetime.utcnow()
        supabase.table('pipeline_run_lock').update({
            'is_running': False,
            'finished_at': now.isoformat()
        }).eq('id', 1).execute()
        print(f"🔓 Run lock released at {now.isoformat()}")
    except Exception as e:
        print(f"⚠️ Could not release run lock: {e}")


def run_news_workflow():
    """
    Execute a single iteration of the news workflow.
    Returns tuple of (success: bool, message: str, stats: dict)
    """
    start_time = time.time()
    stats = {
        'articles_processed': 0,
        'articles_published': 0,
        'clusters_found': 0,
        'errors': []
    }
    
    try:
        print("=" * 60)
        print(f"🚀 TEN NEWS - Cloud Run Execution")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("=" * 60)
        
        # Import the workflow components
        from complete_clustered_8step_workflow import (
            run_single_cycle,
            supabase,
            clustering_engine
        )
        
        # Check run lock - skip if another run is active
        if not acquire_run_lock(supabase):
            elapsed = time.time() - start_time
            return True, f"Skipped (another run active) in {elapsed:.1f}s", stats
        
        try:
            # Run a single cycle of the workflow
            result = run_single_cycle()
            
            if result:
                stats.update(result)
            
            elapsed = time.time() - start_time
            print(f"\n✅ Workflow completed in {elapsed:.1f} seconds")
            print(f"📊 Stats: {stats}")
            
            return True, f"Workflow completed in {elapsed:.1f}s", stats
        
        finally:
            # Always release the lock, even if the run fails
            release_run_lock(supabase)
        
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Workflow failed after {elapsed:.1f}s: {str(e)}"
        print(f"\n❌ {error_msg}")
        stats['errors'].append(str(e))
        
        # Try to release lock on error
        try:
            from complete_clustered_8step_workflow import supabase
            release_run_lock(supabase)
        except:
            pass
        
        return False, error_msg, stats


@app.route('/', methods=['GET', 'POST'])
def trigger_workflow():
    """HTTP endpoint to trigger the news workflow"""
    print(f"📥 Received trigger request at {datetime.now().isoformat()}")
    
    success, message, stats = run_news_workflow()
    
    status_code = 200 if success else 500
    return jsonify({
        'success': success,
        'message': message,
        'stats': stats,
        'timestamp': datetime.now().isoformat()
    }), status_code


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Cloud Run"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }), 200


def main():
    """Main entry point - runs once and exits"""
    success, message, stats = run_news_workflow()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

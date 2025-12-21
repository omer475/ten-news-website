"""
Cloud Run Entrypoint for Ten News
==================================
Runs a SINGLE iteration of the news workflow.
Cloud Scheduler triggers this every 10 minutes.
"""

import os
import sys
import time
from datetime import datetime
from flask import Flask, jsonify

app = Flask(__name__)

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
        
        # Run a single cycle of the workflow
        # We need to call the main processing logic
        result = run_single_cycle()
        
        if result:
            stats.update(result)
        
        elapsed = time.time() - start_time
        print(f"\n✅ Workflow completed in {elapsed:.1f} seconds")
        print(f"📊 Stats: {stats}")
        
        return True, f"Workflow completed in {elapsed:.1f}s", stats
        
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Workflow failed after {elapsed:.1f}s: {str(e)}"
        print(f"\n❌ {error_msg}")
        stats['errors'].append(str(e))
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




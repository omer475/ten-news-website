"""
Cloud Run Entrypoint for Ten News
==================================
Runs a SINGLE iteration of the news workflow.
Cloud Scheduler triggers this as a Cloud Run Job every 20 minutes.
Includes run lock to prevent overlapping executions.
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone


# Run lock timeout - if a run has been going for longer than this, assume it crashed
RUN_LOCK_TIMEOUT_MINUTES = 30

# Daily cluster-centroid rebuild window (UTC). Fires on the first
# 20-min-cron tick whose hour falls in this range AND whose most-recent
# centroid was rebuilt > 22 hours ago. The 22h gate prevents a re-run
# if 03:00 and 03:20 both fall inside the window on reboot / clock drift.
CLUSTER_REBUILD_HOUR_UTC = 3
CLUSTER_REBUILD_MIN_AGE_HOURS = 22


def should_rebuild_clusters(supabase) -> bool:
    """True if now is in the rebuild window AND centroids are stale enough."""
    now = datetime.now(timezone.utc)
    if now.hour != CLUSTER_REBUILD_HOUR_UTC:
        return False
    try:
        res = supabase.table('global_cluster_centroids') \
            .select('last_rebuilt_at') \
            .order('last_rebuilt_at', desc=True) \
            .limit(1) \
            .execute()
        if not res.data:
            # Table is empty — first run, rebuild.
            return True
        last = res.data[0]['last_rebuilt_at']
        # Supabase returns ISO-8601 with timezone.
        last_dt = datetime.fromisoformat(last.replace('Z', '+00:00'))
        age_h = (now - last_dt).total_seconds() / 3600.0
        return age_h >= CLUSTER_REBUILD_MIN_AGE_HOURS
    except Exception as e:
        print(f"⚠️ Could not check centroid staleness (skipping rebuild): {e}")
        return False


def run_cluster_rebuild():
    """Invoke the global centroid rebuild. Swallows errors so the regular
    workflow still runs even if the rebuild fails."""
    try:
        print("=" * 60)
        print(f"🗂️  NIGHTLY CLUSTER REBUILD starting at {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)
        from services.global_cluster_builder import main as rebuild_main
        # global_cluster_builder.main() uses argparse; fake empty args so it
        # runs in default (full-rebuild) mode.
        saved_argv = sys.argv
        try:
            sys.argv = ['global_cluster_builder.py']
            rebuild_main()
        finally:
            sys.argv = saved_argv
        print("✅ Cluster rebuild done")
    except Exception as e:
        print(f"❌ Cluster rebuild failed (continuing with regular workflow): {e}")


def acquire_run_lock(supabase):
    """
    Try to acquire a run lock via Supabase.
    Returns True if lock acquired, False if another run is active.
    """
    try:
        now = datetime.now(timezone.utc)
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
        return True


def release_run_lock(supabase):
    """Release the run lock."""
    try:
        now = datetime.now(timezone.utc)
        supabase.table('pipeline_run_lock').update({
            'is_running': False,
            'finished_at': now.isoformat()
        }).eq('id', 1).execute()
        print(f"🔓 Run lock released at {now.isoformat()}")
    except Exception as e:
        print(f"⚠️ Could not release run lock: {e}")


def main():
    """Main entry point - runs once and exits (Cloud Run Job)"""
    start_time = time.time()
    stats = {
        'articles_processed': 0,
        'articles_published': 0,
        'clusters_found': 0,
        'errors': []
    }

    try:
        print("=" * 60)
        print(f"🚀 TEN NEWS - Cloud Run Job Execution")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("=" * 60)

        # Import the workflow components
        from complete_clustered_8step_workflow import (
            run_single_cycle,
            supabase
        )

        # Check run lock - skip if another run is active
        if not acquire_run_lock(supabase):
            elapsed = time.time() - start_time
            print(f"Skipped (another run active) in {elapsed:.1f}s")
            sys.exit(0)

        try:
            # Nightly rebuild of 10 super + 100 leaf cluster centroids.
            # Fires once per day (03:00 UTC tick when centroids > 22h old),
            # takes ~10-15 min, swallows its own errors so the regular
            # workflow still runs even if the rebuild bombs.
            if should_rebuild_clusters(supabase):
                run_cluster_rebuild()

            # Run a single cycle of the workflow
            result = run_single_cycle()

            if result:
                stats.update(result)

            elapsed = time.time() - start_time
            print(f"\n✅ Workflow completed in {elapsed:.1f} seconds")
            print(f"📊 Stats: {stats}")
            sys.exit(0)

        finally:
            # Always release the lock, even if the run fails
            release_run_lock(supabase)

    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Workflow failed after {elapsed:.1f}s: {str(e)}"
        print(f"\n❌ {error_msg}")

        # Try to release lock on error
        try:
            from complete_clustered_8step_workflow import supabase
            release_run_lock(supabase)
        except Exception:
            pass

        sys.exit(1)


if __name__ == '__main__':
    main()

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

# Cleanup (2026-05-11): removed nightly global-cluster rebuild + its predicate
# (was should_rebuild_clusters / run_cluster_rebuild). The v11 hierarchical
# super/leaf cluster system that consumed those centroids is gone (Phase 1.1
# v11 deletion + Phase 0.1 broken-RPC cleanup). Trinity's J=256/K=2048
# codebook (vq_primary / vq_secondary stamped per-article at publish time)
# is the live hierarchy and doesn't need a nightly rebuild — its centroids
# are static unless the codebook is retrained, which is a separate, manual
# step (scripts/train_rq_vae.py).


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
            # Nightly window (~03:00 UTC) refreshes the article_dwell_stats
            # percentile table — Kuaishou EVV/FVV anchors, cheap aggregate
            # over user_article_events, runs in seconds. The previous nightly
            # super/leaf cluster rebuild was removed (v11 system deletion).
            # Source: Kuaishou CIKM 2023 (arXiv:2308.13249).
            now_utc = datetime.now(timezone.utc)
            if now_utc.hour == 3:
                try:
                    rows = supabase.rpc('refresh_article_dwell_stats').execute()
                    print(f"🕒 article_dwell_stats refreshed ({rows.data} rows)")
                except Exception as e:
                    print(f"⚠️ article_dwell_stats refresh failed (non-blocking): {e}")

            # ── Pipeline 2 (curated content) runs CONCURRENTLY with Pipeline 1
            # in a daemon thread, so total cycle time stays ~max(P1, P2) rather
            # than the sum. Fully non-fatal: any P2 error is swallowed so it can
            # never break Pipeline 1 or the lock release. Toggle PIPELINE2_ENABLED=0
            # to disable (instant rollback without a redeploy).
            p2_thread = None
            if os.getenv('PIPELINE2_ENABLED', '1') == '1':
                import threading

                def _run_pipeline2():
                    try:
                        from pipeline2_ai_editor import run_ai_editor_cycle
                        from pipeline2_processor import run_pipeline2_processor
                        run_ai_editor_cycle(supabase)
                        run_pipeline2_processor(supabase)
                    except Exception as e:
                        print(f"⚠️ Pipeline 2 failed (non-fatal): {e}")

                p2_thread = threading.Thread(target=_run_pipeline2, name='pipeline2', daemon=True)
                p2_thread.start()

            # Run a single cycle of the workflow (Pipeline 1)
            result = run_single_cycle()

            if result:
                stats.update(result)

            # Let Pipeline 2 finish (bounded) before we exit / release the lock —
            # a daemon thread is killed at process exit, so we must join it here.
            if p2_thread is not None:
                p2_thread.join(timeout=600)
                if p2_thread.is_alive():
                    print("⚠️ Pipeline 2 still running after 600s — exiting anyway")

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

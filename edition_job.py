"""
edition_job.py — the ONCE-DAILY job that publishes today+'s Edition.

Orchestrates:
    1. edition_editor.build_edition   (select 15 + write + modules, §12/§13)
    2. edition_illustrations.attach_illustrations  (§6.4, fail-soft)
    3. upsert the editions row as 'published'

Designed to run at 07:00 Europe/London (Cloud Scheduler -> Cloud Run Job, or the
Next.js cron at /api/cron/publish-edition). Idempotent: re-running for the same
date overwrites that day's row.
"""

import os
import sys
import json
import time
from datetime import datetime, timezone

from edition_editor import build_edition, fetch_countdown, uk_today, get_supabase
from edition_illustrations import attach_illustrations


def publish_edition(supabase, payload, *, status='published'):
    """Upsert the §13 payload as one editions row keyed by date."""
    date = payload['edition_date']
    row = {
        'edition_date': date,
        'payload': payload,
        'status': status,
        'published_at': datetime.now(timezone.utc).isoformat() if status == 'published' else None,
    }
    supabase.table('editions').upsert(row, on_conflict='edition_date').execute()
    print(f"  💾 edition {date} upserted (status={status})")
    return date


def run_edition_job(date_str=None, *, publish=True, with_illustrations=True):
    """Build, illustrate, and publish the edition for date_str (default today UK)."""
    t0 = time.time()
    date_str = date_str or uk_today()
    sb = get_supabase()
    api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY not set')

    print('=' * 60)
    print(f'📅 EDITION JOB — {date_str}')
    print('=' * 60)

    payload = build_edition(sb, api_key, date_str)

    if with_illustrations:
        try:
            attach_illustrations(sb, api_key, payload)
        except Exception as e:
            # Illustrations are best-effort; never fail the edition over art.
            print(f"  ⚠️ illustration step failed (non-fatal): {e}")

    status = 'published' if publish else 'draft'
    publish_edition(sb, payload, status=status)

    n = len(payload['items'])
    illos = sum(1 for it in payload['items'] if (it.get('illustration') or {}).get('asset_url'))
    print(f"✅ done in {time.time() - t0:.1f}s — {n} items, {illos} illustrations, status={status}")
    return payload


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Build + publish the daily Edition')
    ap.add_argument('--date', default=None, help='YYYY-MM-DD (default: today UK)')
    ap.add_argument('--draft', action='store_true', help='store as draft, do not publish')
    ap.add_argument('--no-illustrations', action='store_true', help='skip illustration generation')
    ap.add_argument('--out', default=None, help='also write payload JSON to this path')
    args = ap.parse_args()

    payload = run_edition_job(
        args.date,
        publish=not args.draft,
        with_illustrations=not args.no_illustrations,
    )
    if args.out:
        with open(args.out, 'w') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f'wrote {args.out}')
    sys.exit(0)

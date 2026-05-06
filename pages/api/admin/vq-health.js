// VQ stamping health endpoint.
//
// Reads the `vq_stamping_health` view (migration 076) and returns a JSON
// snapshot of pipeline VQ-stamping freshness. Designed to be hit by a Vercel
// cron OR an external uptime monitor (Better Stack, Pingdom, etc.).
//
// Returns HTTP 200 with `ok: true` if last-6h stamped fraction is healthy.
// Returns HTTP 503 with `ok: false, reason: ...` if degraded — uptime
// monitors will then page on the failed status.
//
// Background: Trinity Step 12 silently stopped writing vq_primary on
// 2026-05-01 and went unnoticed for 5 days. Without VQ codes, the M-tier
// retrievers fall back to the explore pool, which serves random fresh
// content rather than personalized news. This endpoint is the canary.

import { createClient } from '@supabase/supabase-js'

const HEALTHY_PCT_FLOOR = 95          // % stamped in last 6h required for healthy
const MIN_PUBLISHED_FOR_SIGNAL = 20   // below this, "no data yet" rather than alarm

export default async function handler(req, res) {
  // Optional shared-secret protection. Most ops monitors expect a static URL,
  // so auth is opt-in via env var.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    return res.status(500).json({ ok: false, reason: 'supabase_env_missing' })
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  try {
    const { data, error } = await supabase
      .from('vq_stamping_health')
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ ok: false, reason: 'view_query_failed', detail: error.message })
    }

    const {
      published_6h,
      stamped_6h,
      unstamped_6h,
      pct_stamped_6h,
      unstamped_24h,
      last_stamped_at,
      oldest_unstamped_in_24h,
    } = data

    const snapshot = {
      published_6h,
      stamped_6h,
      unstamped_6h,
      pct_stamped_6h,
      unstamped_24h,
      last_stamped_at,
      oldest_unstamped_in_24h,
    }

    if (published_6h < MIN_PUBLISHED_FOR_SIGNAL) {
      return res.status(200).json({
        ok: true,
        status: 'insufficient_data',
        snapshot,
      })
    }

    if (pct_stamped_6h < HEALTHY_PCT_FLOOR) {
      return res.status(503).json({
        ok: false,
        status: 'degraded',
        reason: `only ${pct_stamped_6h}% of last-6h articles are stamped (floor ${HEALTHY_PCT_FLOOR}%)`,
        snapshot,
      })
    }

    return res.status(200).json({ ok: true, status: 'healthy', snapshot })
  } catch (e) {
    return res.status(500).json({ ok: false, reason: 'unexpected', detail: String(e) })
  }
}

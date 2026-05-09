// Phoenix Phase 7.C — daily Beta decay cron
//
// Vercel cron runs at 04:00 UTC daily. Calls the migration-091 RPC
// decay_cluster_explore_bandit which multiplies cluster_state.explore_engages
// and explore_shows by γ=0.97. Half-life ~23 days. Active clusters maintain
// counts via daily +1 increments; stale ones fade exponentially.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const DECAY_GAMMA = 0.97

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }

  const start = Date.now()
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { data, error } = await supabase.rpc('decay_cluster_explore_bandit', { p_gamma: DECAY_GAMMA })
    if (error) {
      return res.status(500).json({ ok: false, error: error.message, elapsed_ms: Date.now() - start })
    }
    const summary = Array.isArray(data) && data[0] ? data[0] : null
    return res.status(200).json({
      ok: true,
      gamma: DECAY_GAMMA,
      rows_updated: summary?.rows_updated || 0,
      sum_engages_before: summary?.sum_engages_before || 0,
      sum_shows_before: summary?.sum_shows_before || 0,
      elapsed_ms: Date.now() - start,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e), elapsed_ms: Date.now() - start })
  }
}

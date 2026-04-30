// Dark-launch route for Trinity (Phase 1).
//
// Runs Trinity-M + Trinity-LT against a target user and returns a JSON report.
// DOES NOT serve to the iOS app. The legacy /api/feed/main path keeps producing
// the live feed during the soak period.
//
// Use cases:
//   - Sanity-check the codebook on a single user before flipping trinity_enabled.
//   - Compare top-20 from Trinity vs v11 visually.
//   - Verify the Apple / Türkiye / Sam Altman starvation fix landed.
//
// Usage:
//   GET /api/feed/trinity-debug?user=<uuid>
//   GET /api/feed/trinity-debug?user=<uuid>&compact=1   (smaller response)
//
// Response shape:
//   {
//     userId, qualifyingCount, codebook: { id, version, signalType, itemCount },
//     histograms: { topPrimaries: [{c1, count}], topSecondaries: [{c2, count, parent}] },
//     trinityM:  { picked: [c2…], articles: [{id, title, score, c1, c2}] },
//     trinityLT: { picked: [c2…], articles: [{id, title, score, c1, c2, b_score}] },
//     fellThroughCold: bool, reason: string,
//     duration_ms
//   }

import { createClient } from '@supabase/supabase-js'
import {
  buildHistograms,
  trinityM,
  trinityLT,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  retrieveCandidates,
  J_PRIMARY,
  K_SECONDARY,
  HISTOGRAM_WINDOW,
} from '../../../lib/trinity.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const DEFAULT_TEST_USER = '5082a1df-24e4-4a39-a0c0-639c4de70627'

export default async function handler(req, res) {
  const t0 = Date.now()
  const userId = String(req.query.user || DEFAULT_TEST_USER)
  const compact = String(req.query.compact || '') === '1'

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const codebook = await loadActiveCodebook(supabase)
  if (!codebook) {
    return res.status(503).json({
      error: 'No active codebook. Run scripts/train_rq_vae.py first.',
      duration_ms: Date.now() - t0,
    })
  }

  const [{ h1, h2, qualifyingCount }, clusterState, articleCounts] = await Promise.all([
    buildHistograms(supabase, userId),
    loadClusterState(supabase),
    loadArticleCountsBySecondary(supabase),
  ])

  const fellThroughCold = qualifyingCount < 50    // matches plan §risks
  if (fellThroughCold) {
    return res.json({
      userId,
      qualifyingCount,
      codebook: snapshot(codebook),
      fellThroughCold: true,
      reason: `User has only ${qualifyingCount} qualifying behaviors; need >=50 for Trinity. Cold-start path would route to trending pool here.`,
      histograms: topHistogramSlices(h1, h2, codebook.parentMap),
      duration_ms: Date.now() - t0,
    })
  }

  // Run both retrievers.
  const mPicks  = trinityM(h1, h2, codebook.parentMap)
  const ltPicks = trinityLT(h2, clusterState, articleCounts)

  // Pull a small candidate set from each retriever to make the report concrete.
  const [mArticles, ltArticles] = await Promise.all([
    mPicks.length  ? retrieveCandidates(supabase, mPicks,  { perClusterLimit: 5, hoursWindow: 7 * 24 }) : [],
    ltPicks.length ? retrieveCandidates(supabase, ltPicks, { perClusterLimit: 3, hoursWindow: 7 * 24 }) : [],
  ])

  const mFmt  = mArticles.map((a) => ({
    id: a.id,
    title: a.title_news,
    category: a.category,
    score: a.ai_final_score,
    c1: a.vq_primary,
    c2: a.vq_secondary,
  }))

  const ltFmt = ltArticles.map((a) => ({
    id: a.id,
    title: a.title_news,
    category: a.category,
    score: a.ai_final_score,
    c1: a.vq_primary,
    c2: a.vq_secondary,
    b_score: clusterState.get(a.vq_secondary)?.b_score ?? null,
  }))

  return res.json({
    userId,
    qualifyingCount,
    histogramWindow: HISTOGRAM_WINDOW,
    codebook: snapshot(codebook),
    histograms: topHistogramSlices(h1, h2, codebook.parentMap),
    trinityM:  { picked: mPicks,  articles: compact ? mFmt.slice(0, 5)  : mFmt },
    trinityLT: { picked: ltPicks, articles: compact ? ltFmt.slice(0, 5) : ltFmt },
    fellThroughCold: false,
    duration_ms: Date.now() - t0,
  })
}


function snapshot(cb) {
  return { id: cb.id, version: cb.version, signalType: cb.signalType, dim: cb.dim, itemCount: cb.itemCount }
}


function topHistogramSlices(h1, h2, parentMap) {
  const top = (arr, n) => Array.from(arr)
    .map((v, i) => ({ i, v }))
    .filter(p => p.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
  return {
    topPrimaries: top(h1, 10).map(p => ({ c1: p.i, count: p.v })),
    topSecondaries: top(h2, 15).map(p => ({ c2: p.i, count: p.v, parent: parentMap[p.i] })),
  }
}

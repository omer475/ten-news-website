// Trinity (ByteDance KDD 2024) — paper-exact retrieval algorithms.
//
// Source: Yan et al., "Trinity: Syncretizing Multi-/Long-tail/Long-term Interests All in One",
//         KDD 2024 (arXiv:2402.02842). Algorithms 1 and 2.
//
// Trinity v2 — built on the post-cleanup baseline (2026-05-01). Carries
// every lesson from v1 (PRs #94-#98, since reverted):
//   - J=256 / K=2048 (paper: 128/1024) — doubled because our test user's
//     histogram concentrated 27% in c1=56 at J=128. Streaming-VQ KDD 2025
//     direction.
//   - Adaptive thresholds T_p/T_s scale by qualifyingCount / 2500 (paper's
//     ratio). For our 600-behavior test user: T_p=15, T_s=5 (paper-exact
//     for ≥2500-behavior users).
//   - Read-fraction qualifying gate (text articles): dwell ≥ 0.5 ×
//     expected_read_seconds OR liked/saved/shared/revisit. The paper uses
//     `playtime ≥ 10s` (video-only).

import { expectedReadSecondsForArticle } from './readingTime.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const J_PRIMARY = 256
export const K_SECONDARY = 2048
export const SUBCODEBOOK_K = 8

export const HISTOGRAM_WINDOW = 2500    // last N qualifying behaviors per request

// Paper-exact thresholds (used for users with ≥ HISTOGRAM_WINDOW qualifying behaviors).
export const T_P = 30                   // h¹[c1] >= T_p to consider primary
export const T_S = 10                   // h²[c2] >= T_s to consider secondary kid
export const N_M = 10                   // # clusters returned by Trinity-M

export const N_C = 600                  // long-tail pool size (top by B-score)
export const T_I = 3                    // drop clusters with < T_i articles
export const T_L = 3                    // keep only clusters with user h²[c2] >= T_l
export const N_LT = 20                  // # clusters sampled by Trinity-LT
export const LT_ALPHA = 0.75            // sampling exponent (paper)
export const LT_BETA = 0.1              // sampling additive (paper)

// (deviation:) per-article qualifying gate for text articles.
export const QUALIFYING_READ_FRACTION = 0.5
export const QUALIFYING_EVENTS = new Set([
  'article_liked', 'article_saved', 'article_shared', 'article_revisit',
])

// EMA decay rate for the long-tail B-score. Paper does not specify a value;
// 0.1 means "long memory, smooth updates" — flips a cluster from short-tail
// to long-tail over ~10 sessions of non-exposure.
export const LT_EMA_RATE = 0.1

// Article-counts cache.
const ARTICLE_COUNTS_CACHE_TTL_MS = 5 * 60 * 1000
let articleCountsCache = null


// Adaptive thresholds: paper used T_p=30/T_s=10 for Douyin where users have
// ~2,500 qualifying behaviors. Smaller users have fewer per primary; preserve
// the *ratio* (1.2% / 0.4%) to keep the algorithm working at every scale.
// Lower bound 15/5 so we still require real evidence; upper bound = paper.
export function adaptiveThresholds(qualifyingCount) {
  const ratio = Math.min(1, qualifyingCount / HISTOGRAM_WINDOW)
  const tP = Math.max(15, Math.round(T_P * ratio))
  const tS = Math.max(5,  Math.round(T_S * ratio))
  return { tP, tS }
}


// ---------------------------------------------------------------------------
// Histogram builder
// ---------------------------------------------------------------------------

export async function buildHistograms(supabase, userId) {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  if (!userId) return { h1, h2, qualifyingCount: 0 }

  const { data: events, error: evErr } = await supabase
    .from('user_article_events')
    .select('article_id, event_type, view_seconds, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.ceil(HISTOGRAM_WINDOW * 1.5))

  if (evErr) {
    console.error('[trinity] buildHistograms event fetch failed:', evErr.message)
    return { h1, h2, qualifyingCount: 0 }
  }
  if (!events || events.length === 0) return { h1, h2, qualifyingCount: 0 }

  const articleIds = Array.from(new Set(events.map(e => e.article_id).filter(Boolean)))
  if (articleIds.length === 0) return { h1, h2, qualifyingCount: 0 }

  const { data: articles, error: aErr } = await supabase
    .from('published_articles')
    .select('id, vq_primary, vq_secondary, expected_read_seconds, title_news, summary_bullets_news')
    .in('id', articleIds)

  if (aErr) {
    console.error('[trinity] buildHistograms article fetch failed:', aErr.message)
    return { h1, h2, qualifyingCount: 0 }
  }
  const articleById = new Map()
  for (const a of articles || []) articleById.set(a.id, a)

  let qualifyingCount = 0
  for (const ev of events) {
    if (qualifyingCount >= HISTOGRAM_WINDOW) break
    const art = articleById.get(ev.article_id)
    if (!art) continue
    const c1 = art.vq_primary
    const c2 = art.vq_secondary
    if (c1 == null || c2 == null) continue
    if (c1 < 0 || c1 >= J_PRIMARY) continue
    if (c2 < 0 || c2 >= K_SECONDARY) continue
    if (!isQualifying(ev, art)) continue
    h1[c1] += 1
    h2[c2] += 1
    qualifyingCount += 1
  }
  return { h1, h2, qualifyingCount }
}


function isQualifying(event, article) {
  if (QUALIFYING_EVENTS.has(event.event_type)) return true
  const dwell = pickDwellSeconds(event)
  if (dwell <= 0) return false
  const expected = expectedReadSecondsForArticle(article)
  if (!expected || expected <= 0) return false
  return (dwell / expected) >= QUALIFYING_READ_FRACTION
}

function pickDwellSeconds(event) {
  if (Number.isFinite(event.view_seconds) && event.view_seconds > 0) return event.view_seconds
  const meta = event.metadata
  if (meta && typeof meta === 'object') {
    const d = Number(meta.dwell ?? meta.view_seconds ?? meta.dwell_seconds)
    if (Number.isFinite(d) && d > 0) return d
  }
  return 0
}


// ---------------------------------------------------------------------------
// Trinity-M — Algorithm 1.
// ---------------------------------------------------------------------------

export function trinityM(h1, h2, parentMap, rng = Math.random, thresholds = null) {
  if (!parentMap || parentMap.length !== K_SECONDARY) {
    throw new Error(`trinityM: parentMap must have length ${K_SECONDARY}`)
  }
  const tP = thresholds?.tP ?? T_P
  const tS = thresholds?.tS ?? T_S
  const out = []
  const seen = new Set()

  const childrenByPrimary = bucketChildren(parentMap)
  const primaryOrder = sortIndicesDesc(h1, J_PRIMARY)

  for (const c1 of primaryOrder) {
    if (h1[c1] < tP) break
    const kids = childrenByPrimary[c1] || []
    const eligible = kids.filter(c2 => h2[c2] >= tS)

    let pick
    if (eligible.length > 0) {
      pick = eligible[Math.floor(rng() * eligible.length)]
    } else if (kids.length > 0) {
      pick = argmaxOver(kids, h2)
    } else {
      continue
    }
    if (!seen.has(pick)) {
      out.push(pick)
      seen.add(pick)
    }
    if (out.length >= N_M) break
  }

  if (out.length < N_M) {
    const globalOrder = sortIndicesDesc(h2, K_SECONDARY)
    for (const c2 of globalOrder) {
      if (h2[c2] === 0) break
      if (seen.has(c2)) continue
      out.push(c2)
      seen.add(c2)
      if (out.length >= N_M) break
    }
  }
  return out
}


// ---------------------------------------------------------------------------
// Trinity-LT — Algorithm 2.
// ---------------------------------------------------------------------------

export function trinityLT(h2, clusterStateMap, articleCountsBySecondary, rng = Math.random) {
  const ranked = []
  for (const [c2, state] of clusterStateMap.entries()) {
    if (c2 < 0 || c2 >= K_SECONDARY) continue
    const inv = articleCountsBySecondary[c2] || 0
    if (inv < T_I) continue
    ranked.push([c2, state.b_score])
  }
  for (let c2 = 0; c2 < K_SECONDARY; c2++) {
    if (!clusterStateMap.has(c2) && (articleCountsBySecondary[c2] || 0) >= T_I) {
      ranked.push([c2, Number.MAX_SAFE_INTEGER])
    }
  }
  ranked.sort((a, b) => b[1] - a[1])
  const longtail = ranked.slice(0, N_C).map(r => r[0])

  const eligible = longtail.filter(c2 => h2[c2] >= T_L)
  if (eligible.length === 0) return []

  const weights = eligible.map(c2 => Math.pow(LT_BETA + h2[c2], LT_ALPHA))
  return weightedSampleWithoutReplacement(eligible, weights, Math.min(N_LT, eligible.length), rng)
}


// ---------------------------------------------------------------------------
// EMA update for cluster_state on shown clusters.
// ---------------------------------------------------------------------------

export function emaUpdates(currentStateMap, shownClusterIds, nowMs = Date.now()) {
  const rows = []
  const seen = new Set()
  for (const c2 of shownClusterIds) {
    if (seen.has(c2)) continue
    seen.add(c2)
    const prev = currentStateMap.get(c2)
    const lastMs = prev ? new Date(prev.last_shown_at).getTime() : nowMs
    const gapSec = Math.max(0, (nowMs - lastMs) / 1000)
    const prevB = prev ? prev.b_score : 0
    const newB = (1 - LT_EMA_RATE) * prevB + LT_EMA_RATE * gapSec
    rows.push({
      cluster_id: c2,
      last_shown_at: new Date(nowMs).toISOString(),
      b_score: newB,
      shown_count: (prev?.shown_count || 0) + 1,
      updated_at: new Date(nowMs).toISOString(),
    })
  }
  return rows
}


// ---------------------------------------------------------------------------
// DB loaders.
// ---------------------------------------------------------------------------

export async function loadClusterState(supabase) {
  const { data, error } = await supabase
    .from('cluster_state')
    .select('cluster_id, last_shown_at, b_score, shown_count')
  if (error) {
    console.error('[trinity] loadClusterState failed:', error.message)
    return new Map()
  }
  const map = new Map()
  for (const row of data || []) map.set(row.cluster_id, row)
  return map
}


export async function loadActiveCodebook(supabase) {
  // Serving never reads centroids — only parent_map. Centroids live in
  // vq_centroids, read by the Python pipeline at projection time.
  const { data, error } = await supabase
    .from('vq_codebooks')
    .select('id, version, signal_type, parent_map, dim, item_count')
    .eq('is_active', true)
    .order('trained_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[trinity] loadActiveCodebook failed:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  const cb = data[0]
  return {
    id: cb.id,
    version: cb.version,
    signalType: cb.signal_type,
    parentMap: cb.parent_map,
    dim: cb.dim,
    itemCount: cb.item_count,
  }
}


export async function loadArticleCountsBySecondary(supabase) {
  const now = Date.now()
  if (articleCountsCache && (now - articleCountsCache.ts) < ARTICLE_COUNTS_CACHE_TTL_MS) {
    return articleCountsCache.counts
  }
  const counts = new Int32Array(K_SECONDARY)
  const { data, error } = await supabase.rpc('count_articles_by_vq_secondary')
  if (error || !data) {
    console.error('[trinity] count_articles_by_vq_secondary failed:', error?.message)
    return counts
  }
  for (const row of data) {
    const c = row.vq_secondary
    if (c != null && c >= 0 && c < K_SECONDARY) counts[c] = row.cnt
  }
  articleCountsCache = { ts: now, counts }
  return counts
}


// ---------------------------------------------------------------------------
// Per-cluster article retrieval.
// ---------------------------------------------------------------------------

export async function retrieveCandidates(supabase, secondaryClusterIds, opts = {}) {
  const { perClusterLimit = 20, hoursWindow = 7 * 24, excludeIds = [], minScore = 0 } = opts
  if (!secondaryClusterIds || secondaryClusterIds.length === 0) return []

  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  const tasks = secondaryClusterIds.map(c2 =>
    fetchCluster(supabase, c2, sinceIso, perClusterLimit, excludeIds, minScore)
  )
  const results = await Promise.all(tasks)
  const out = []
  for (let i = 0; i < results.length; i++) {
    const cluster = secondaryClusterIds[i]
    for (const row of results[i]) out.push({ ...row, _vq_cluster: cluster })
  }
  return out
}


async function fetchCluster(supabase, c2, sinceIso, limit, excludeIds, minScore) {
  let q = supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .eq('vq_secondary', c2)
    .gte('created_at', sinceIso)
    .gte('ai_final_score', minScore)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error(`[trinity] fetchCluster c2=${c2} failed:`, error.message)
    return []
  }
  return data || []
}


// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function bucketChildren(parentMap) {
  const buckets = new Array(J_PRIMARY)
  for (let i = 0; i < J_PRIMARY; i++) buckets[i] = []
  for (let c2 = 0; c2 < parentMap.length; c2++) {
    const c1 = parentMap[c2]
    if (c1 >= 0 && c1 < J_PRIMARY) buckets[c1].push(c2)
  }
  return buckets
}

function sortIndicesDesc(arr, n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = i
  out.sort((a, b) => arr[b] - arr[a])
  return out
}

function argmaxOver(indices, arr) {
  let best = indices[0]
  let bestVal = arr[best]
  for (let i = 1; i < indices.length; i++) {
    const v = arr[indices[i]]
    if (v > bestVal) { best = indices[i]; bestVal = v }
  }
  return best
}

function weightedSampleWithoutReplacement(items, weights, k, rng) {
  // Efraimidis–Spirakis: key = u^(1/w), top-k by key.
  const keys = []
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(weights[i], 1e-12)
    const u = Math.max(rng(), 1e-12)
    keys.push([Math.pow(u, 1 / w), items[i]])
  }
  keys.sort((a, b) => b[0] - a[0])
  return keys.slice(0, k).map(p => p[1])
}

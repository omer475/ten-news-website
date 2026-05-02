// Trinity (ByteDance KDD 2024) — paper-exact retrieval algorithms.
//
// Source: Yan et al., "Trinity: Syncretizing Multi-/Long-tail/Long-term Interests All in One",
//         KDD 2024 (arXiv:2402.02842). Algorithms 1 and 2.
//
// Trinity v3 — 2026-05-02 session diagnostics rebuild.
// Carries v1+v2 lessons (J=256/K=2048, vq_centroids table, adaptive T_p/T_s,
// bucket boost, full seen-history dedup, await impression insert, has_more=true,
// soft M/LT exclusion, pad-spread). Adds three principled upgrades:
//
//   v3-A. Adaptive multi-tier retrieval (`retrieveCandidatesAdaptive`).
//         Try 7d → 14d → 21d windows, stop at first tier that yields ≥ minPool.
//         Replaces the flat 7d window that exhausted heavy users' pools.
//
//   v3-B. Content-aware recency decay (`recencyWeightForArticle`).
//         Half-life = (article.shelf_life_days * 24) / 2.
//         Breaking news (shelf=1d) decays in 12h; evergreen (shelf=14d) lasts
//         a week. Replaces the flat 36h half-life that crushed Trinity's
//         older-but-relevant picks vs fresh trending.
//
//   v3-C. Thompson Sampling exploration arm (`exploreArm`).
//         Beta(α=1+engages, β=1+skips) sampled per cluster where user h²=0.
//         Pick top-k by sample. Yields one explore slot per slate, gradually
//         learning which directions pay off. Replaces having no exploration
//         path at all (Trinity-M and Trinity-LT both require user history).
//
// Plus: trinityLT supports `excludeClusters` opt with `softExclude` fallback.

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

// v3-A. Adaptive retrieval window tiers (hours). Try in order, stop at the
// first tier whose pool is large enough.
export const ADAPTIVE_WINDOW_TIERS_H = [7 * 24, 14 * 24, 21 * 24]

// v3-B. Recency decay defaults (used as fallbacks when shelf_life_days
// is missing).  Half-life = shelf_life_days * 24 / 2.
export const DEFAULT_SHELF_LIFE_DAYS = 3

// v3-C. Exploration arm size — fraction of slate dedicated to exploration.
// 1 of 20 = 5%. Matches typical TikTok bandit budgets.
export const EXPLORE_SLOT_FRACTION = 0.05
export const EXPLORE_BETA_PRIOR_ALPHA = 1
export const EXPLORE_BETA_PRIOR_BETA  = 1

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
    // Track which primaries are already represented. Pad in two passes:
    //   pass 0: prefer c2's whose primary is NOT yet picked (more c1 spread)
    //   pass 1: anything else by global-largest h²
    // Without this, when the user histogram is concentrated, the pad ends up
    // duplicating the already-dominant primaries (live: 2026-05-02 12:53 hit
    // only 7 distinct primaries because pad picked 3 children of c1=39).
    const usedPrimaries = new Set()
    for (const c2 of out) usedPrimaries.add(parentMap[c2])
    const globalOrder = sortIndicesDesc(h2, K_SECONDARY)
    for (const phase of [0, 1]) {
      for (const c2 of globalOrder) {
        if (h2[c2] === 0) break
        if (seen.has(c2)) continue
        const c1 = parentMap[c2]
        if (phase === 0 && usedPrimaries.has(c1)) continue
        out.push(c2)
        seen.add(c2)
        usedPrimaries.add(c1)
        if (out.length >= N_M) break
      }
      if (out.length >= N_M) break
    }
  }
  return out
}


// ---------------------------------------------------------------------------
// Trinity-LT — Algorithm 2.
// ---------------------------------------------------------------------------

export function trinityLT(h2, clusterStateMap, articleCountsBySecondary, rng = Math.random, opts = {}) {
  // Optional: exclude clusters Trinity-M already chose so the two retrievers
  // cover different ground. v3 adds soft-exclude: if hard-exclude leaves
  // fewer than N_LT/2 eligible clusters, drop the exclusion and let LT
  // pick anyway. Live 2026-05-02 13:09 session had M take 10 clusters and
  // LT got only 2 picks because exclusion starved it.
  const excludeSet = opts.excludeClusters instanceof Set
    ? opts.excludeClusters
    : new Set(opts.excludeClusters || [])
  const softExcludeFloor = Math.max(1, Math.ceil(N_LT / 2))

  function buildPool(useExcludes) {
    const ranked = []
    for (const [c2, state] of clusterStateMap.entries()) {
      if (c2 < 0 || c2 >= K_SECONDARY) continue
      if (useExcludes && excludeSet.has(c2)) continue
      const inv = articleCountsBySecondary[c2] || 0
      if (inv < T_I) continue
      ranked.push([c2, state.b_score])
    }
    for (let c2 = 0; c2 < K_SECONDARY; c2++) {
      if (useExcludes && excludeSet.has(c2)) continue
      if (!clusterStateMap.has(c2) && (articleCountsBySecondary[c2] || 0) >= T_I) {
        ranked.push([c2, Number.MAX_SAFE_INTEGER])
      }
    }
    ranked.sort((a, b) => b[1] - a[1])
    const longtail = ranked.slice(0, N_C).map(r => r[0])
    return longtail.filter(c2 => h2[c2] >= T_L)
  }

  let eligible = buildPool(true)
  if (eligible.length < softExcludeFloor && excludeSet.size > 0) {
    // Soft fallback: drop the exclusion when hard exclusion leaves us starved.
    eligible = buildPool(false)
  }
  if (eligible.length === 0) return []

  const weights = eligible.map(c2 => Math.pow(LT_BETA + h2[c2], LT_ALPHA))
  return weightedSampleWithoutReplacement(eligible, weights, Math.min(N_LT, eligible.length), rng)
}


// ---------------------------------------------------------------------------
// v3-C. Thompson Sampling exploration arm.
// ---------------------------------------------------------------------------
//
// Picks `nSlots` cluster ids the user has h² == 0 in (genuinely unexplored),
// scoring each with a Beta(α=1+engages, β=1+skips) sample drawn from the
// cluster_state explore_engages / explore_shows columns. This is the standard
// Thompson Sampling policy for multi-armed bandits — provably no-regret in
// expectation (Russo et al., "A Tutorial on Thompson Sampling," 2018).
//
// Why h²==0 specifically: clusters where the user has h²>=1 are already
// addressed by Trinity-LT. The explore arm fills the gap of "clusters this
// user has never engaged with at all."

export function exploreArm(h2, clusterStateMap, articleCountsBySecondary, nSlots, rng = Math.random) {
  if (nSlots <= 0) return []
  const candidates = []
  for (let c2 = 0; c2 < K_SECONDARY; c2++) {
    if (h2[c2] !== 0) continue                                  // user already touched
    if ((articleCountsBySecondary[c2] || 0) < T_I) continue     // too few articles
    const state = clusterStateMap.get(c2)
    const a = EXPLORE_BETA_PRIOR_ALPHA + (state?.explore_engages || 0)
    const b = EXPLORE_BETA_PRIOR_BETA  + Math.max(0, (state?.explore_shows || 0) - (state?.explore_engages || 0))
    candidates.push([c2, sampleBeta(a, b, rng)])
  }
  if (candidates.length === 0) return []
  candidates.sort((x, y) => y[1] - x[1])
  return candidates.slice(0, nSlots).map(p => p[0])
}


// Beta sampling via two Gamma draws (Marsaglia–Tsang for Gamma(α,1)).
// Standard textbook approach; faster than rejection-based Beta.
function sampleBeta(a, b, rng) {
  const x = sampleGamma(a, rng)
  const y = sampleGamma(b, rng)
  if (x + y === 0) return 0.5
  return x / (x + y)
}

function sampleGamma(k, rng) {
  if (k < 1) {
    // Boost: Gamma(k+1, 1) sampling, then scale by U^(1/k)
    const u = Math.max(rng(), 1e-12)
    return sampleGamma(k + 1, rng) * Math.pow(u, 1 / k)
  }
  // Marsaglia–Tsang
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x, v
    do {
      x = sampleNormal(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function sampleNormal(rng) {
  // Box–Muller
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}


// ---------------------------------------------------------------------------
// v3-B. Content-aware recency decay using shelf_life_days.
// ---------------------------------------------------------------------------
//
// Half-life = shelf_life_days * 24 / 2.
// At t = shelf_life_days, weight = 0.25; at t = 0.5 * shelf_life_days, weight = 0.5.
// Replaces the flat 36h half-life that crushed Trinity's older-but-relevant picks.

export function recencyWeightForArticle(article, nowMs = Date.now()) {
  const ageMs = nowMs - new Date(article.created_at || article.published_at || nowMs).getTime()
  const ageH = Math.max(0, ageMs / 3600000)
  const shelfDays = Number.isFinite(article.shelf_life_days) && article.shelf_life_days > 0
    ? article.shelf_life_days
    : DEFAULT_SHELF_LIFE_DAYS
  const halfLifeH = shelfDays * 24 / 2
  const lambda = Math.log(2) / halfLifeH
  return Math.exp(-lambda * ageH)
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
    .select('cluster_id, last_shown_at, b_score, shown_count, explore_engages, explore_shows')
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


// v3-A. Adaptive multi-tier retrieval. Try each tier's hoursWindow in order;
// stop at the first that yields ≥ minPoolSize. The user's interest pool is
// often exhausted at 7d (heavy users see ~95% of last-7d articles in their
// strongest primaries); 14d / 21d windows give 8–35× more candidates without
// reaching back into truly stale content.
export async function retrieveCandidatesAdaptive(supabase, secondaryClusterIds, opts = {}) {
  const {
    perClusterLimit = 20,
    excludeIds = [],
    minScore = 0,
    minPoolSize = 30,
    tiersHours = ADAPTIVE_WINDOW_TIERS_H,
  } = opts
  if (!secondaryClusterIds || secondaryClusterIds.length === 0) {
    return { pool: [], hoursWindow: tiersHours[0] }
  }
  let pool = []
  let chosenWindow = tiersHours[tiersHours.length - 1]
  for (const hoursWindow of tiersHours) {
    pool = await retrieveCandidates(supabase, secondaryClusterIds, {
      perClusterLimit, hoursWindow, excludeIds, minScore,
    })
    chosenWindow = hoursWindow
    if (pool.length >= minPoolSize) break
  }
  return { pool, hoursWindow: chosenWindow }
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

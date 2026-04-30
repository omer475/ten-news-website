// Trinity (ByteDance KDD 2024) — paper-exact retrieval algorithms.
//
// Source: Yan et al., "Trinity: Syncretizing Multi-/Long-tail/Long-term Interests All in One",
//         KDD 2024 (arXiv:2402.02842). Algorithms 1 and 2.
//
// One platform-specific deviation from the paper:
//   The paper qualifies behaviors as `playtime >= 10s` for video. We have
//   variable-length text articles so we use `read_fraction >= QUALIFYING_READ_FRACTION`,
//   where read_fraction = view_seconds / expected_read_seconds (per-article).
//   `expected_read_seconds` is learned per-article and stored on
//   `published_articles.expected_read_seconds` (see lib/readingTime.js,
//   scripts/refresh_expected_read_seconds.py).

import { expectedReadSecondsForArticle } from './readingTime.js'

// ---------------------------------------------------------------------------
// Constants — paper-exact unless noted "(deviation:)".
// ---------------------------------------------------------------------------

export const J_PRIMARY = 256            // # primary clusters (doubled from 128 — Streaming-VQ direction)
export const K_SECONDARY = 2048         // # secondary clusters (doubled from 1024)
export const SUBCODEBOOK_K = 8          // K / J = 2048 / 256 (matches train_rq_vae.py hierarchy)

export const HISTOGRAM_WINDOW = 2500    // last N qualifying behaviors per request

export const T_P = 30                   // Trinity-M:  h¹[c1] >= T_p to consider primary
export const T_S = 10                   // Trinity-M:  h²[c2] >= T_s to consider secondary kid
export const N_M = 10                   // Trinity-M:  number of clusters returned

export const N_C = 600                  // Trinity-LT: long-tail pool size (top by B-score)
export const T_I = 3                    // Trinity-LT: drop clusters with < T_i articles
export const T_L = 3                    // Trinity-LT: keep only clusters with user h²[c2] >= T_l
export const N_LT = 20                  // Trinity-LT: number of clusters sampled
export const LT_ALPHA = 0.75            // sampling exponent  (paper)
export const LT_BETA = 0.1              // sampling additive  (paper)

// (deviation:) per-article qualifying gate for text articles.
export const QUALIFYING_READ_FRACTION = 0.5
export const QUALIFYING_EVENTS = new Set([
  'article_liked', 'article_saved', 'article_shared', 'article_revisit',
])

// EMA decay rate for the long-tail B-score. Paper does not specify a value;
// 0.1 means "long memory, smooth updates" — flips a cluster from short-tail
// to long-tail over ~10 sessions of non-exposure.
export const LT_EMA_RATE = 0.1

// Article-counts cache (per-secondary inventory) lifetime.
const ARTICLE_COUNTS_CACHE_TTL_MS = 5 * 60 * 1000
let articleCountsCache = null  // { ts: number, counts: Int32Array(K_SECONDARY) }


// ---------------------------------------------------------------------------
// Histogram builder — Trinity §3 ("statistical interest histograms").
// ---------------------------------------------------------------------------
//
// Build h¹ (length J_PRIMARY) and h² (length K_SECONDARY) from the user's last
// HISTOGRAM_WINDOW qualifying behaviors. Plain integer counts. No weights. No
// decay. No negatives — Trinity is positive-only.
//
// Returns { h1, h2, qualifyingCount }. If the user has < N qualifying events,
// the histograms are sparse but valid; the caller decides whether to fall
// through to a cold-start path.

export async function buildHistograms(supabase, userId) {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  if (!userId) return { h1, h2, qualifyingCount: 0 }

  // Pull last HISTOGRAM_WINDOW * 1.5 events to leave headroom for non-qualifying
  // skips that get filtered out below. Most users will be smaller than this.
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
  if (!events || events.length === 0) {
    return { h1, h2, qualifyingCount: 0 }
  }

  const articleIds = Array.from(new Set(events.map(e => e.article_id).filter(Boolean)))
  if (articleIds.length === 0) return { h1, h2, qualifyingCount: 0 }

  // Pull cluster ids + per-article expected read time in one shot.
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
    if (c1 == null || c2 == null) continue       // article not yet stamped by codebook
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
  // Read-fraction gate: dwell on the card for at least
  // QUALIFYING_READ_FRACTION × the article's expected read time.
  const dwell = pickDwellSeconds(event)
  if (dwell <= 0) return false
  const expected = expectedReadSecondsForArticle(article)
  if (!expected || expected <= 0) return false
  return (dwell / expected) >= QUALIFYING_READ_FRACTION
}

function pickDwellSeconds(event) {
  if (Number.isFinite(event.view_seconds) && event.view_seconds > 0) return event.view_seconds
  // Some events store dwell under metadata.dwell. Fall back.
  const meta = event.metadata
  if (meta && typeof meta === 'object') {
    const d = Number(meta.dwell ?? meta.view_seconds ?? meta.dwell_seconds)
    if (Number.isFinite(d) && d > 0) return d
  }
  return 0
}


// ---------------------------------------------------------------------------
// Trinity-M — Algorithm 1.  "Multi-interest retriever."
// ---------------------------------------------------------------------------
//
// for each primary cluster c1 with h¹[c1] >= T_p (sorted descending by h¹):
//     kids = { c2 : parent(c2) == c1  AND  h²[c2] >= T_s }
//     if kids non-empty:
//         pick c2 = uniform-random choice over kids   ← "the diversity trick"
//     else:
//         pick c2 = argmax_{c2: parent(c2)==c1} h²[c2]      (fallback)
//     out.append(c2)
//     if |out| == N_M: break
// pad with global argmax_{c2} h²[c2] if |out| < N_M
//
// This is the part of Trinity that prevents "interest amnesia" by ensuring
// every primary interest gets exactly one slot, and which secondary subtopic
// fills that slot is random — so a user's #2/#3 secondary topics get exposure.

export function trinityM(h1, h2, parentMap, rng = Math.random) {
  if (!parentMap || parentMap.length !== K_SECONDARY) {
    throw new Error(`trinityM: parentMap must have length ${K_SECONDARY}`)
  }
  const out = []
  const seen = new Set()

  // Bucket secondary cluster ids by primary parent for O(1) child lookups.
  const childrenByPrimary = bucketChildren(parentMap)

  // Sort primary clusters by user histogram, descending.
  const primaryOrder = sortIndicesDesc(h1, J_PRIMARY)

  for (const c1 of primaryOrder) {
    if (h1[c1] < T_P) break   // sorted, so anything below threshold is also below
    const kids = childrenByPrimary[c1] || []
    const eligible = kids.filter(c2 => h2[c2] >= T_S)

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

  // Pad to N_M with global largest h² (excluding picks we already have).
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
// Trinity-LT — Algorithm 2.  "Long-tail retriever."
// ---------------------------------------------------------------------------
//
// EMA per cluster (refreshed elsewhere on serve, see updateClusterStateOnServe):
//     B[c2]  = (1-α_ema) * B[c2]  +  α_ema * (now - last_shown[c2])
// long-tail pool = top N_C clusters by B[c2], excluding clusters with <T_i articles.
// user-eligible  = { c2 in pool : h²[c2] >= T_l }
// sample N_LT clusters from user-eligible weighted by Pr(c) ∝ (β + h²[c])^α.
//
// This is the +0.546% diversity / interest-amnesia fix from the paper:
// rarely-shown clusters that the user has *some* affinity for get sampled
// proportionally to their affinity (gentle exponent α=0.75) but with a small
// floor (β=0.1) so even h²=0 clusters have a tiny chance.

export function trinityLT(h2, clusterStateMap, articleCountsBySecondary, rng = Math.random) {
  // Step 1: rank clusters by B-score, drop low-inventory clusters.
  const ranked = []
  for (const [c2, state] of clusterStateMap.entries()) {
    if (c2 < 0 || c2 >= K_SECONDARY) continue
    const inv = articleCountsBySecondary[c2] || 0
    if (inv < T_I) continue
    ranked.push([c2, state.b_score])
  }
  // Clusters that have never been shown (not in cluster_state) get implicit
  // very-high B (they're the most under-shown). Add them with +Infinity until
  // they accrue exposures. Avoid using truly Infinity — use a large sentinel.
  for (let c2 = 0; c2 < K_SECONDARY; c2++) {
    if (!clusterStateMap.has(c2) && (articleCountsBySecondary[c2] || 0) >= T_I) {
      ranked.push([c2, Number.MAX_SAFE_INTEGER])
    }
  }
  ranked.sort((a, b) => b[1] - a[1])
  const longtail = ranked.slice(0, N_C).map(r => r[0])

  // Step 2: keep only clusters where the user has h²[c2] >= T_l
  const eligible = longtail.filter(c2 => h2[c2] >= T_L)
  if (eligible.length === 0) return []

  // Step 3: weighted sample without replacement.
  // weight(c2) = (β + h²[c2])^α
  const weights = eligible.map(c2 => Math.pow(LT_BETA + h2[c2], LT_ALPHA))
  return weightedSampleWithoutReplacement(eligible, weights, Math.min(N_LT, eligible.length), rng)
}


// ---------------------------------------------------------------------------
// Cluster-state EMA update (called once per serve, after we know which
// secondary clusters were exposed in this response).
// ---------------------------------------------------------------------------
//
// For each shown c2:
//     gap_seconds = (now - state.last_shown_at)   in seconds
//     B[c2]_new   = (1 - α_ema) * B[c2]_old + α_ema * gap_seconds
//     last_shown[c2] = now
// For clusters NOT shown this serve, we leave state alone — their
// (now - last_shown) gap grows organically the next time we touch them.
//
// Returns an array of upsert payloads for cluster_state. Caller does the DB write.

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
// Cluster-state and codebook loaders.
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
  // Serving never reads centroids — only parent_map. Centroid vectors live in
  // vq_centroids (one row per centroid) and are read by the Python pipeline's
  // Step 12 when projecting new articles.
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
    parentMap: cb.parent_map,           // length K_SECONDARY (1024 or 2048 per codebook)
    dim: cb.dim,
    itemCount: cb.item_count,
  }
}


export async function loadArticleCountsBySecondary(supabase) {
  const now = Date.now()
  if (articleCountsCache && (now - articleCountsCache.ts) < ARTICLE_COUNTS_CACHE_TTL_MS) {
    return articleCountsCache.counts
  }
  // Single grouped query. With the partial index on vq_secondary this is fast.
  const { data, error } = await supabase.rpc('count_articles_by_vq_secondary')
  let counts = new Int32Array(K_SECONDARY)
  if (error || !data) {
    // Fallback: pull groups via a generic select. Slower but works without the RPC.
    const { data: rows, error: e2 } = await supabase
      .from('published_articles')
      .select('vq_secondary, count:id', { count: 'exact', head: false })
      .not('vq_secondary', 'is', null)
    if (e2 || !rows) {
      console.error('[trinity] loadArticleCountsBySecondary fallback failed:', e2?.message)
      return counts
    }
    // Without an aggregation RPC we cannot use group-by directly through PostgREST;
    // do an in-memory tally over a select+limit chain. This path should rarely fire
    // — production should run with the RPC defined. See migration follow-up.
    for (const row of rows) {
      const c = row.vq_secondary
      if (c != null && c >= 0 && c < K_SECONDARY) counts[c] = (counts[c] || 0) + 1
    }
  } else {
    for (const row of data) {
      const c = row.vq_secondary
      if (c != null && c >= 0 && c < K_SECONDARY) counts[c] = row.cnt
    }
  }
  articleCountsCache = { ts: now, counts }
  return counts
}


// ---------------------------------------------------------------------------
// Per-cluster article retrieval.
// ---------------------------------------------------------------------------

export async function retrieveCandidates(supabase, secondaryClusterIds, opts = {}) {
  const {
    perClusterLimit = 20,
    hoursWindow = 7 * 24,
    excludeIds = [],
    minScore = 0,
  } = opts
  if (!secondaryClusterIds || secondaryClusterIds.length === 0) return []

  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  const exclude = excludeIds.length > 0 ? excludeIds : []

  // One query per cluster, parallelized. Each request fetches
  // perClusterLimit articles ordered by ai_final_score DESC (newest tie-break).
  const tasks = secondaryClusterIds.map(c2 => fetchCluster(supabase, c2, sinceIso, perClusterLimit, exclude, minScore))
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


// Weighted sampling without replacement using the Efraimidis–Spirakis algorithm
// (key = u^(1/w) where u ~ Uniform(0,1)). Stable and unbiased.
function weightedSampleWithoutReplacement(items, weights, k, rng) {
  const keys = []
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(weights[i], 1e-12)
    const u = Math.max(rng(), 1e-12)
    const key = Math.pow(u, 1 / w)
    keys.push([key, items[i]])
  }
  keys.sort((a, b) => b[0] - a[0])
  return keys.slice(0, k).map(p => p[1])
}

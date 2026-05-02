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

// v3-A / v4. Adaptive retrieval window tiers (hours). Try in order, stop at
// first tier whose pool is large enough. v3 had [7d, 14d, 21d] — heavy users
// exhausted 7d via dedup and the system widened to 21d, surfacing 9-10d old
// articles (live audit 2026-05-02 13:45: median age 8d, 9 of 25 slots ≥ 9d).
// v4 caps at 7d hard. The freshness gap is filled by trinity-fresh instead.
export const ADAPTIVE_WINDOW_TIERS_H = [3 * 24, 7 * 24]

// v3-B. Recency decay defaults (used as fallbacks when shelf_life_days
// is missing).  Half-life = shelf_life_days * 24 / 2.
export const DEFAULT_SHELF_LIFE_DAYS = 3

// v4. Stale age penalty. Articles older than this get a hard score multiplier
// regardless of shelf_life — protects against high-shelf-life "evergreen"
// articles outranking fresh content for news-feed users.
export const STALE_AGE_DAYS = 7
export const STALE_PENALTY_FACTOR = 0.4

// v4. trinity-fresh retriever — last-N-hours articles in the user's top
// primary clusters (broad scope, not the narrow secondaries M/LT use).
// This is the primary freshness floor; ensures fresh content reaches users
// whose narrow Trinity secondaries are exhausted by dedup.
// v5: window 48h (was 36h), pool wider (top 10 primaries, was 5),
// min score 500 (was 600) — survives back-to-back sessions where v4
// exhausted on session 2.
export const FRESH_WINDOW_H = 48
export const FRESH_TOP_PRIMARIES = 10
export const FRESH_MIN_SCORE = 500

// v3-C. Exploration arm size — fraction of slate dedicated to exploration.
// v5: 5% → 20% (4 of 20 slots), per Vombatkere et al. ACM WebConf 2024
// audit of real TikTok feeds: heavy users see ~26% exploration, new users
// ~69%. Our 5% was far below TikTok's audited band even for top-quartile
// heavy users. arxiv.org/abs/2403.12410.
export const EXPLORE_SLOT_FRACTION = 0.20
export const EXPLORE_BETA_PRIOR_ALPHA = 1
export const EXPLORE_BETA_PRIOR_BETA  = 1

// v5. Multi-tier interest budgets (Trinity KDD 2024 architecture).
// The paper specifies separate retrievers for short-term, long-tail, and
// long-term interest tiers run in parallel — NOT a single rerank-sort.
// Slot allocation matches Trinity's "underdelivered themes" principle:
//   tier1 (top-3 primaries, short-term):     45% of slate
//   tier2 (ranks 4-10, mid-term):            25% of slate
//   tier3 (long-tail / explore):             30% of slate
// Live audit 2026-05-02: a single rerank gave the user's top primary 64%
// of slots (14/22) when their histogram was 26%. Tier budgets prevent that.
export const TIER1_TOP_PRIMARIES = 3      // top-3 primaries by h¹
export const TIER2_RANK_START    = 3      // ranks 4-10 (0-indexed: 3..9)
export const TIER2_RANK_END      = 10
export const TIER1_SLOT_FRACTION = 0.45
export const TIER2_SLOT_FRACTION = 0.25
// Tier 3 = remaining (1 - tier1 - tier2 - explore) = 0.10
// Plus reserved fresh = absorbed into tier1 (top-3 primaries).

// v5. Per-primary slate cap (TikTok no-consecutive + YouTube DPP k=6 analog).
// Max-N from any single vq_primary in a 20-slot slate. The leaked Algo 101
// confirms TikTok blocks consecutive same-creator videos; balanced index
// (Streaming VQ KDD 2025) prevents popular clusters from dominating.
// 4/20 = 20% — a cluster can be present but cannot crowd out other interests.
export const MAX_PER_PRIMARY = 4
export const FORBID_CONSECUTIVE_SAME_PRIMARY = true

// v5. Negative-feedback ("Not Interested") parameters.
// Per Monolith RecSys 2022: negative signals propagate via real-time gradient
// updates, NOT hard exclusion. We translate to:
//   - Decrement h¹[primary] by NOT_INTERESTED_HISTOGRAM_DECREMENT per event
//   - Soft-exclude the primary's secondaries for NOT_INTERESTED_COOLDOWN_HOURS
//     (Trinity-M / Trinity-LT skip them; explore can still pick).
// This mirrors TikTok's "we'll show fewer like that" — softer than blocklist.
export const NOT_INTERESTED_HISTOGRAM_DECREMENT = 3
export const NOT_INTERESTED_COOLDOWN_HOURS      = 48

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
  const cooldownPrimaries = new Set()
  if (!userId) return { h1, h2, qualifyingCount: 0, cooldownPrimaries }

  const { data: events, error: evErr } = await supabase
    .from('user_article_events')
    .select('article_id, event_type, view_seconds, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.ceil(HISTOGRAM_WINDOW * 1.5))

  if (evErr) {
    console.error('[trinity] buildHistograms event fetch failed:', evErr.message)
    return { h1, h2, qualifyingCount: 0, cooldownPrimaries }
  }
  if (!events || events.length === 0) return { h1, h2, qualifyingCount: 0, cooldownPrimaries }

  const articleIds = Array.from(new Set(events.map(e => e.article_id).filter(Boolean)))
  if (articleIds.length === 0) return { h1, h2, qualifyingCount: 0, cooldownPrimaries }

  const { data: articles, error: aErr } = await supabase
    .from('published_articles')
    .select('id, vq_primary, vq_secondary, expected_read_seconds, title_news, summary_bullets_news')
    .in('id', articleIds)

  if (aErr) {
    console.error('[trinity] buildHistograms article fetch failed:', aErr.message)
    return { h1, h2, qualifyingCount: 0, cooldownPrimaries }
  }
  const articleById = new Map()
  for (const a of articles || []) articleById.set(a.id, a)

  let qualifyingCount = 0
  // v5: collect not-interested events for histogram down-weighting + cooldown.
  const cooldownCutoffMs = Date.now() - NOT_INTERESTED_COOLDOWN_HOURS * 3600 * 1000
  for (const ev of events) {
    if (ev.event_type !== 'article_not_interested') continue
    const art = articleById.get(ev.article_id)
    if (!art) continue
    const c1 = art.vq_primary
    if (c1 == null || c1 < 0 || c1 >= J_PRIMARY) continue
    h1[c1] -= NOT_INTERESTED_HISTOGRAM_DECREMENT
    const evMs = new Date(ev.created_at).getTime()
    if (evMs >= cooldownCutoffMs) cooldownPrimaries.add(c1)
  }

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

  // Floor h1 at 0 — negative counts would break sortIndicesDesc semantics.
  for (let c1 = 0; c1 < J_PRIMARY; c1++) {
    if (h1[c1] < 0) h1[c1] = 0
  }

  return { h1, h2, qualifyingCount, cooldownPrimaries }
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

export function trinityM(h1, h2, parentMap, rng = Math.random, thresholds = null, opts = {}) {
  if (!parentMap || parentMap.length !== K_SECONDARY) {
    throw new Error(`trinityM: parentMap must have length ${K_SECONDARY}`)
  }
  const tP = thresholds?.tP ?? T_P
  const tS = thresholds?.tS ?? T_S
  // v5. Optional primary set restrictor — for tier1/tier2 retrieval we only
  // want to draw from a specific subset of primaries (e.g. top-3 only).
  const onlyPrimaries = opts.onlyPrimaries instanceof Set
    ? opts.onlyPrimaries
    : (Array.isArray(opts.onlyPrimaries) ? new Set(opts.onlyPrimaries) : null)
  // v5. Skip "Not Interested" cooldown primaries (soft-exclude — Monolith-style).
  const cooldownPrimaries = opts.cooldownPrimaries instanceof Set
    ? opts.cooldownPrimaries
    : new Set(opts.cooldownPrimaries || [])
  const maxClusters = opts.maxClusters ?? N_M
  const out = []
  const seen = new Set()

  const childrenByPrimary = bucketChildren(parentMap)
  const primaryOrder = sortIndicesDesc(h1, J_PRIMARY)

  for (const c1 of primaryOrder) {
    if (h1[c1] < tP) break
    if (onlyPrimaries && !onlyPrimaries.has(c1)) continue
    if (cooldownPrimaries.has(c1)) continue
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
    if (out.length >= maxClusters) break
  }

  // v5. Pad pass only when not restricted to a subset (tier1/tier2 retrieval
  // intentionally narrows; padding to N_M would defeat the tier point).
  if (!onlyPrimaries && out.length < maxClusters) {
    // Track which primaries are already represented. Pad in two passes:
    //   pass 0: prefer c2's whose primary is NOT yet picked (more c1 spread)
    //   pass 1: anything else by global-largest h²
    const usedPrimaries = new Set()
    for (const c2 of out) usedPrimaries.add(parentMap[c2])
    const globalOrder = sortIndicesDesc(h2, K_SECONDARY)
    for (const phase of [0, 1]) {
      for (const c2 of globalOrder) {
        if (h2[c2] === 0) break
        if (seen.has(c2)) continue
        const c1 = parentMap[c2]
        if (cooldownPrimaries.has(c1)) continue
        if (phase === 0 && usedPrimaries.has(c1)) continue
        out.push(c2)
        seen.add(c2)
        usedPrimaries.add(c1)
        if (out.length >= maxClusters) break
      }
      if (out.length >= maxClusters) break
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
  // pick anyway.
  const excludeSet = opts.excludeClusters instanceof Set
    ? opts.excludeClusters
    : new Set(opts.excludeClusters || [])
  // v5. Cooldown primaries (Not Interested) — soft-exclude their secondaries.
  const cooldownPrimaries = opts.cooldownPrimaries instanceof Set
    ? opts.cooldownPrimaries
    : new Set(opts.cooldownPrimaries || [])
  const parentMap = opts.parentMap || null
  const isCooldown = (c2) => {
    if (cooldownPrimaries.size === 0 || !parentMap) return false
    const c1 = parentMap[c2]
    return c1 != null && cooldownPrimaries.has(c1)
  }
  const softExcludeFloor = Math.max(1, Math.ceil(N_LT / 2))

  function buildPool(useExcludes) {
    const ranked = []
    for (const [c2, state] of clusterStateMap.entries()) {
      if (c2 < 0 || c2 >= K_SECONDARY) continue
      if (useExcludes && excludeSet.has(c2)) continue
      if (isCooldown(c2)) continue
      const inv = articleCountsBySecondary[c2] || 0
      if (inv < T_I) continue
      ranked.push([c2, state.b_score])
    }
    for (let c2 = 0; c2 < K_SECONDARY; c2++) {
      if (useExcludes && excludeSet.has(c2)) continue
      if (isCooldown(c2)) continue
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


// v4. Personalized-fresh retriever: last-N-hours articles whose vq_primary is
// in the user's top primaries. Primary scoping is broader than M's secondary
// scoping, so it survives narrow dedup. This is the freshness floor.
export async function retrievePersonalizedFresh(supabase, primaryClusterIds, opts = {}) {
  const {
    hoursWindow = FRESH_WINDOW_H,
    excludeIds = [],
    minScore = FRESH_MIN_SCORE,
    limit = 60,
  } = opts
  if (!primaryClusterIds || primaryClusterIds.length === 0) return []
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .in('vq_primary', primaryClusterIds)
    .gte('created_at', sinceIso)
    .gte('ai_final_score', minScore)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error('[trinity] retrievePersonalizedFresh failed:', error.message)
    return []
  }
  return data || []
}


// v4. Top-N primary clusters by user's h¹. Used to scope trinity-fresh.
export function topPrimariesFromHistogram(h1, n) {
  const indexed = []
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] > 0) indexed.push([i, h1[i]])
  }
  indexed.sort((a, b) => b[1] - a[1])
  return indexed.slice(0, n).map(p => p[0])
}


// v5. Split user's primary histogram into three interest tiers.
// Trinity (KDD 2024) describes parallel multi-, long-tail-, and long-term-
// retrievers, each with its own slot budget — NOT a single rerank-sort.
// Top-3 primaries are short-term (most-engaged); ranks 4-10 are mid-term
// (real but secondary interests); everything else falls to long-tail/explore.
//   tier1: top-3 primaries by h¹
//   tier2: ranks 4 through 10 by h¹
// The third tier ("long-tail/explore") is implicit — it's whatever the
// existing trinityLT + exploreArm produce; this function returns only the
// first two tiers since they need explicit primary lists.
export function getInterestTiers(h1, opts = {}) {
  const topN = opts.topN ?? TIER1_TOP_PRIMARIES
  const midStart = opts.midStart ?? TIER2_RANK_START
  const midEnd = opts.midEnd ?? TIER2_RANK_END
  const indexed = []
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] > 0) indexed.push([i, h1[i]])
  }
  indexed.sort((a, b) => b[1] - a[1])
  return {
    tier1: indexed.slice(0, topN).map(p => p[0]),
    tier2: indexed.slice(midStart, midEnd).map(p => p[0]),
  }
}


// v5. Compose a feed slate from k retriever pools using fixed slot budgets.
// Round-robin across pools so each retriever's allocation is honored even
// when one pool's items would have outranked the others on raw score.
// This implements Trinity's multi-retriever fan-out — replaces the v3/v4
// single-rerank sort that gave the user's strongest cluster 64% of slots.
//
// pools: Array<{ name: string, items: Article[], budget: int }>
//   - items must be pre-ranked descending (caller does rerank per pool)
//   - budget = number of slots reserved for this pool
//   - sum of budgets must equal slateSize (caller enforces)
//
// slateSize: total slots to fill
//
// Returns array of items in slate order. Each item gets `_retrieverTier`
// stamped onto it for downstream attribution.
export function composeWithBudgets(pools, slateSize) {
  if (!Array.isArray(pools) || pools.length === 0) return []
  const cursors = pools.map(() => 0)
  const remaining = pools.map(p => Math.max(0, p.budget))
  const seenIds = new Set()
  const out = []

  // Round-robin pass: each pool donates one item per cycle until budget runs
  // out or its pool is empty. Pools with smaller budgets finish first; the
  // remaining pools keep contributing.
  let progress = true
  while (progress && out.length < slateSize) {
    progress = false
    for (let i = 0; i < pools.length; i++) {
      if (out.length >= slateSize) break
      if (remaining[i] <= 0) continue
      const pool = pools[i]
      while (cursors[i] < pool.items.length) {
        const item = pool.items[cursors[i]]
        cursors[i] += 1
        if (item == null || item.id == null) continue
        if (seenIds.has(item.id)) continue
        seenIds.add(item.id)
        out.push({ ...item, _retrieverTier: pool.name })
        remaining[i] -= 1
        progress = true
        break
      }
    }
  }

  // Backfill: any leftover budget gets donated to whoever still has items.
  // This protects against a pool being underfilled (empty) leaving the slate
  // short — better to overfill another tier than ship a 14-slot slate.
  if (out.length < slateSize) {
    for (let i = 0; i < pools.length && out.length < slateSize; i++) {
      const pool = pools[i]
      while (cursors[i] < pool.items.length && out.length < slateSize) {
        const item = pool.items[cursors[i]]
        cursors[i] += 1
        if (item == null || item.id == null) continue
        if (seenIds.has(item.id)) continue
        seenIds.add(item.id)
        out.push({ ...item, _retrieverTier: pool.name })
      }
    }
  }

  return out
}


// v5. Per-primary slate cap with no-consecutive-same-primary rule.
// TikTok confirmed (Algo 101 leak + support docs): the FYP never shows two
// items from the same creator/sound back-to-back. YouTube CIKM 2018 uses a
// windowed DPP (k=6-12) for diversity rerank — same shape. Streaming VQ
// (KDD 2025) explicitly enforces balanced cluster distribution at the index.
//
// We translate to: max MAX_PER_PRIMARY items per slate from any vq_primary,
// AND no two consecutive slots from the same primary. Items beyond cap or
// that would create a same-primary pair get pushed back; if the full slate
// can't satisfy both rules, we relax no-consecutive first (cap is harder).
export function applyPrimaryCap(slate, opts = {}) {
  const maxPerPrimary = opts.maxPerPrimary ?? MAX_PER_PRIMARY
  const noConsecutive = opts.noConsecutive ?? FORBID_CONSECUTIVE_SAME_PRIMARY

  // First pass: enforce cap. Items past the cap are removed (held aside for
  // the second pass which may add them back if the slate is short).
  const counts = new Map()
  const kept = []
  const overflow = []
  for (const item of slate) {
    const p = item.vq_primary
    if (p == null) { kept.push(item); continue }
    const c = counts.get(p) || 0
    if (c >= maxPerPrimary) { overflow.push(item); continue }
    counts.set(p, c + 1)
    kept.push(item)
  }

  if (!noConsecutive) {
    // Cap-only — no reordering. Pad from overflow if needed.
    return kept.concat(overflow)
  }

  // Second pass: rearrange-so-no-two-adjacent-equal (heap-based greedy).
  // At each step, pick the primary with the MOST remaining items that is
  // not equal to prevPrimary. If only prevPrimary has items left, accept
  // the repeat. This is the canonical "task scheduler" / "reorganize string"
  // greedy — proven optimal when the most-frequent count ≤ ceil(n/2).
  // Without this (using "first remaining" picking), [1,1,2,2,3,3] yields
  // [1,2,1,2,3,3] — a same-primary pair survives despite [1,2,3,1,2,3]
  // being achievable.
  const buckets = new Map()
  const insertOrder = new Map() // primary → original-index, for stable tie-break
  let nextOrder = 0
  for (const it of kept) {
    const p = it.vq_primary
    if (!buckets.has(p)) {
      buckets.set(p, [])
      insertOrder.set(p, nextOrder++)
    }
    buckets.get(p).push(it)
  }

  const reordered = []
  let prevPrimary = null
  while (true) {
    let bestPrimary = null, bestSize = -1, bestOrder = Infinity
    let fallbackPrimary = null, fallbackSize = -1
    for (const [p, arr] of buckets) {
      if (arr.length === 0) continue
      if (p === prevPrimary) {
        if (arr.length > fallbackSize) { fallbackPrimary = p; fallbackSize = arr.length }
        continue
      }
      const ord = insertOrder.get(p)
      if (arr.length > bestSize || (arr.length === bestSize && ord < bestOrder)) {
        bestPrimary = p; bestSize = arr.length; bestOrder = ord
      }
    }
    const pick = bestPrimary !== null ? bestPrimary : fallbackPrimary
    if (pick === null) break
    reordered.push(buckets.get(pick).shift())
    prevPrimary = pick
  }

  return reordered.concat(overflow)
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

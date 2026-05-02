// Trinity v5 serving orchestrator.
//
// v5 (TikTok-aligned rebuild, 2026-05-02):
//   v5-A. Multi-tier retriever fan-out with FIXED SLOT BUDGETS — replaces the
//         single rerank-sort that gave the user's top primary 64% of slots
//         (live audit 14/22 from cluster 224). Trinity (KDD 2024) describes
//         parallel retrievers per histogram tier; we now match that.
//         Slot budgets in a 20-slate (Trinity paper layout):
//           trinity-fresh:        4 (20%)
//           trinity-m  tier1:     5 (25%)  top-3 primaries
//           trinity-m  tier2:     4 (20%)  ranks 4-10
//           trinity-lt:           3 (15%)  long-tail / long-term
//           explore:              4 (20%)  Vombatkere TikTok audit, WebConf 2024
//   v5-B. Per-primary slate cap (4/20 = 20%) + hard no-consecutive rule.
//         TikTok Algo 101 leak + YouTube DPP k=6 (CIKM 2018) + Streaming VQ
//         (KDD 2025) balanced index.
//   v5-C. Exploration 5% → 20%. Vombatkere et al. 2024 audited TikTok at
//         26-69% exploration depending on user maturity; 5% was way below.
//   v5-D. Fresh pool widened (top-10 primaries, 48h, min score 500). v4's
//         narrower pool (top-5, 36h, 600) exhausted on session 2.
//   v5-E. Not Interested negative signal — buildHistograms decrements h¹
//         and adds the primary to a 48h cooldown set (soft-exclude in M/LT).
//         Per Monolith RecSys 2022: negative signals propagate via real-time
//         gradient, not hard exclusion.

import {
  buildHistograms,
  trinityM,
  trinityLT,
  exploreArm,
  emaUpdates,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  retrieveCandidates,
  retrieveCandidatesAdaptive,
  retrievePersonalizedFresh,
  topPrimariesFromHistogram,
  getInterestTiers,
  composeWithBudgets,
  applyPrimaryCap,
  recencyWeightForArticle,
  adaptiveThresholds,
  EXPLORE_SLOT_FRACTION,
  FRESH_TOP_PRIMARIES,
  STALE_AGE_DAYS,
  STALE_PENALTY_FACTOR,
} from './trinity.js'

const COLD_START_QUALIFYING_FLOOR = 50
const FINAL_FEED_SIZE = 20
const PER_M_LIMIT = 12
const PER_LT_LIMIT = 8
const PER_EXPLORE_LIMIT = 4
const FRESH_POOL_LIMIT = 80   // v5: was 60
const TRENDING_POOL_SIZE = 100
const MMR_DUPLICATE_CEILING = 0.78

const ADAPTIVE_MIN_POOL = 60

// v5-A. Slot budgets per retriever (20-slate). Sum = FINAL_FEED_SIZE.
// Adjust proportionally if feedSize differs from default.
const SLOT_BUDGETS = {
  'trinity-fresh':   4,
  'trinity-m-tier1': 5,
  'trinity-m-tier2': 4,
  'trinity-lt':      3,
  'explore':         4,
}

// v5. Bucket boosts kept for intra-pool ranking (each pool reranks
// independently before the budget compose). Cross-pool ordering is now
// done by composeWithBudgets, not by these multipliers.
const BUCKET_BOOST = {
  'trinity-fresh':   1.6,
  'trinity-m-tier1': 1.5,
  'trinity-m-tier2': 1.3,
  'trinity-lt':      1.2,
  'explore':         1.1,
  'topup-trending':  0.6,
  'cold-trending':   1.0,
}


export async function serveTrinityFeed(supabase, opts) {
  const t0 = Date.now()
  const {
    userId,
    seenIds = [],
    feedSize = FINAL_FEED_SIZE,
  } = opts

  const codebook = await loadActiveCodebook(supabase)
  if (!codebook) {
    return {
      articles: [],
      attribution: [],
      debug: { error: 'no-active-codebook', durationMs: Date.now() - t0 },
    }
  }

  const [
    { h1, h2, qualifyingCount, cooldownPrimaries },
    clusterState,
    articleCounts,
  ] = await Promise.all([
    buildHistograms(supabase, userId),
    loadClusterState(supabase),
    loadArticleCountsBySecondary(supabase),
  ])

  // ─── COLD-START PATH ──────────────────────────────────────────────────
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR) {
    const cold = await retrieveTrending(supabase, {
      hoursWindow: 7 * 24, excludeIds: seenIds, limit: TRENDING_POOL_SIZE,
    })
    for (const a of cold) a._retriever = 'cold-trending'
    const ranked = rerank(cold)
    let picked = mmrDiversify(ranked, feedSize)
    picked = applyPrimaryCap(picked)
    return {
      articles: picked,
      attribution: picked.map(() => 'cold-trending'),
      debug: {
        path: 'cold-start', qualifyingCount, codebookId: codebook.id,
        durationMs: Date.now() - t0,
      },
    }
  }

  // ─── WARM-USER (TRINITY V5) PATH ──────────────────────────────────────
  const thresholds = adaptiveThresholds(qualifyingCount)
  const { tier1, tier2 } = getInterestTiers(h1)

  // v5-A. Run trinityM twice — once scoped to tier1 (top-3 primaries), once
  // scoped to tier2 (ranks 4-10). Each gets its own retrieval and slot budget.
  const mClustersTier1 = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds, {
    onlyPrimaries: tier1,
    cooldownPrimaries,
    maxClusters: 6,
  })
  const mClustersTier2 = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds, {
    onlyPrimaries: tier2,
    cooldownPrimaries,
    maxClusters: 5,
  })

  // Trinity-LT covers ranks 11+ via long-tail B-score; exclude tier1+tier2
  // M-picks so LT lives at the long end of the histogram.
  const ltExcludeSet = new Set([...mClustersTier1, ...mClustersTier2])
  const ltClusters = trinityLT(h2, clusterState, articleCounts, Math.random, {
    excludeClusters: ltExcludeSet,
    cooldownPrimaries,
    parentMap: codebook.parentMap,
  })

  // v5-C. Explore arm bumped from 5% → 20%. Pick more clusters than slots
  // so MMR has room to drop near-duplicates without starving the bucket.
  const exploreSlotsBudget = SLOT_BUDGETS.explore
  const explClusters = exploreArm(h2, clusterState, articleCounts, exploreSlotsBudget * 3, Math.random)

  // v5-D. Fresh pool: top-10 primaries × 48h. Skip cooldown primaries.
  const freshPrimariesAll = topPrimariesFromHistogram(h1, FRESH_TOP_PRIMARIES)
  const freshPrimaries = freshPrimariesAll.filter(p => !cooldownPrimaries.has(p))

  // Run the four retrievers in parallel.
  const [mTier1Result, mTier2Result, ltResult, exploreResult, freshPool] = await Promise.all([
    mClustersTier1.length
      ? retrieveCandidatesAdaptive(supabase, mClustersTier1, {
          perClusterLimit: PER_M_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    mClustersTier2.length
      ? retrieveCandidatesAdaptive(supabase, mClustersTier2, {
          perClusterLimit: PER_M_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    ltClusters.length
      ? retrieveCandidatesAdaptive(supabase, ltClusters, {
          perClusterLimit: PER_LT_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    explClusters.length
      ? retrieveCandidatesAdaptive(supabase, explClusters, {
          perClusterLimit: PER_EXPLORE_LIMIT, excludeIds: seenIds, minScore: 500,
          minPoolSize: exploreSlotsBudget * 2,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    freshPrimaries.length
      ? retrievePersonalizedFresh(supabase, freshPrimaries, {
          excludeIds: seenIds, limit: FRESH_POOL_LIMIT,
        })
      : Promise.resolve([]),
  ])

  // Stamp retriever identity on each pool item; used by the per-pool reranker
  // (BUCKET_BOOST) and by attribution downstream.
  stampPool(freshPool,         'trinity-fresh')
  stampPool(mTier1Result.pool, 'trinity-m-tier1')
  stampPool(mTier2Result.pool, 'trinity-m-tier2')
  stampPool(ltResult.pool,     'trinity-lt')
  stampPool(exploreResult.pool,'explore')

  // v5-A. Rerank EACH pool independently (intra-pool by score × recency × stale),
  // then compose with fixed slot budgets. Cross-pool ordering is the budget,
  // not a global score sort.
  const freshRanked = rerank(freshPool)
  const mTier1Ranked = rerank(mTier1Result.pool)
  const mTier2Ranked = rerank(mTier2Result.pool)
  const ltRanked = rerank(ltResult.pool)
  const exploreRanked = rerank(exploreResult.pool)

  // Scale budgets if caller asked for non-default feedSize.
  const scale = feedSize / FINAL_FEED_SIZE
  const scaledBudgets = scaleBudgets(SLOT_BUDGETS, scale, feedSize)

  // Compose: round-robin across pools, honoring budgets. Items already
  // present in another pool (rare — fresh ∩ tier1) are deduped by id.
  const composed = composeWithBudgets([
    { name: 'trinity-fresh',   items: freshRanked,    budget: scaledBudgets['trinity-fresh'] },
    { name: 'trinity-m-tier1', items: mTier1Ranked,   budget: scaledBudgets['trinity-m-tier1'] },
    { name: 'trinity-m-tier2', items: mTier2Ranked,   budget: scaledBudgets['trinity-m-tier2'] },
    { name: 'trinity-lt',      items: ltRanked,       budget: scaledBudgets['trinity-lt'] },
    { name: 'explore',         items: exploreRanked,  budget: scaledBudgets['explore'] },
  ], feedSize)

  // v5-B. Per-primary cap + no-consecutive same-primary.
  let slate = applyPrimaryCap(composed)

  // MMR semantic-dedup pass. Runs AFTER cap so we don't drop a unique-cluster
  // item just because it's similar to a top-pick — the cap already enforced
  // primary diversity, MMR removes near-duplicates within that.
  slate = mmrDiversify(slate, feedSize)

  // EMA update for shown personalized clusters (M tiers + LT + fresh).
  const personalized = new Set(['trinity-m-tier1', 'trinity-m-tier2', 'trinity-lt', 'trinity-fresh'])
  const shownClusters = new Set(
    slate.filter(a => personalized.has(a._retriever) || personalized.has(a._retrieverTier))
         .map(a => a.vq_secondary).filter(c => c != null)
  )
  const updates = emaUpdates(clusterState, Array.from(shownClusters))
  if (updates.length > 0) {
    supabase.from('cluster_state').upsert(updates, { onConflict: 'cluster_id' }).then(({ error }) => {
      if (error) console.error('[trinity] cluster_state upsert failed:', error.message)
    })
  }

  const exploreShown = slate.filter(a => (a._retrieverTier || a._retriever) === 'explore')
                            .map(a => a.vq_secondary).filter(c => c != null)
  if (exploreShown.length > 0) {
    bumpExploreShows(supabase, exploreShown)
  }

  // Backfill _retriever from _retrieverTier so downstream attribution works.
  for (const a of slate) {
    if (!a._retriever && a._retrieverTier) a._retriever = a._retrieverTier
  }

  return {
    articles: slate,
    attribution: slate.map(a => a._retriever),
    debug: {
      path: 'trinity-v5', qualifyingCount,
      codebookId: codebook.id, thresholds,
      tier1, tier2,
      mClustersTier1, mClustersTier2, ltClusters,
      explClusters: explClusters.slice(0, exploreSlotsBudget * 3),
      freshPrimaries, freshCandidates: freshPool.length,
      cooldownPrimaries: Array.from(cooldownPrimaries),
      mTier1WindowH: mTier1Result.hoursWindow,
      mTier2WindowH: mTier2Result.hoursWindow,
      ltWindowH: ltResult.hoursWindow,
      exploreWindowH: exploreResult.hoursWindow,
      poolSize: composed.length,
      shownClustersCount: shownClusters.size,
      exploreServed: exploreShown.length,
      bucketCounts: countBuckets(slate),
      primaryCounts: countPrimaries(slate),
      durationMs: Date.now() - t0,
    },
  }
}


function stampPool(pool, retrieverName) {
  for (const a of pool) a._retriever = retrieverName
}


function scaleBudgets(budgets, scale, target) {
  const out = {}
  let total = 0
  const keys = Object.keys(budgets)
  for (const k of keys) {
    out[k] = Math.max(0, Math.round(budgets[k] * scale))
    total += out[k]
  }
  // Adjust the largest budget to absorb rounding drift.
  if (total !== target) {
    const drift = target - total
    let largestKey = keys[0]
    for (const k of keys) if (out[k] > out[largestKey]) largestKey = k
    out[largestKey] = Math.max(0, out[largestKey] + drift)
  }
  return out
}


function countBuckets(picked) {
  const counts = {}
  for (const a of picked) {
    const k = a._retrieverTier || a._retriever || 'unknown'
    counts[k] = (counts[k] || 0) + 1
  }
  return counts
}


function countPrimaries(picked) {
  const counts = {}
  for (const a of picked) {
    if (a.vq_primary == null) continue
    counts[a.vq_primary] = (counts[a.vq_primary] || 0) + 1
  }
  return counts
}


// Per-pool rerank: score × recency × bucket boost × stale penalty.
function rerank(candidates) {
  const now = Date.now()
  for (const a of candidates) {
    const recency = recencyWeightForArticle(a, now)
    const quality = Number(a.ai_final_score || 0)
    const bucketBoost = BUCKET_BOOST[a._retriever] ?? 1.0
    const ageDays = (now - new Date(a.created_at || a.published_at || now).getTime()) / 86400000
    const stale = ageDays > STALE_AGE_DAYS ? STALE_PENALTY_FACTOR : 1
    a._score = quality * recency * bucketBoost * stale
  }
  candidates.sort((a, b) => b._score - a._score)
  return candidates
}


function mmrDiversify(ranked, feedSize) {
  if (ranked.length === 0) return []
  const picked = []
  const pickedEmbeds = []
  for (const cand of ranked) {
    if (picked.length >= feedSize) break
    const emb = parseEmbedding(cand.embedding_minilm_vec)
    if (!emb) {
      picked.push(cand); pickedEmbeds.push(null); continue
    }
    let maxSim = 0
    for (const pe of pickedEmbeds) {
      if (!pe) continue
      const sim = cosineSim(emb, pe)
      if (sim > maxSim) maxSim = sim
    }
    if (maxSim >= MMR_DUPLICATE_CEILING) continue
    picked.push(cand)
    pickedEmbeds.push(emb)
  }
  return picked
}


async function retrieveTrending(supabase, { hoursWindow, excludeIds, limit }) {
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .gte('created_at', sinceIso)
    .gte('ai_final_score', 400)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds && excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error('[trinity] retrieveTrending failed:', error.message)
    return []
  }
  return data || []
}


function bumpExploreShows(supabase, clusterIds) {
  supabase.from('cluster_state')
    .select('cluster_id, explore_shows')
    .in('cluster_id', clusterIds)
    .then(({ data, error }) => {
      if (error) {
        console.error('[trinity] explore_shows read failed:', error.message)
        return
      }
      const existing = new Map((data || []).map(r => [r.cluster_id, r.explore_shows || 0]))
      const upserts = clusterIds.map(c2 => ({
        cluster_id: c2,
        explore_shows: (existing.get(c2) || 0) + 1,
        last_shown_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      supabase.from('cluster_state').upsert(upserts, { onConflict: 'cluster_id' }).then(({ error: upErr }) => {
        if (upErr) console.error('[trinity] explore_shows upsert failed:', upErr.message)
      })
    })
}


function parseEmbedding(value) {
  if (!value) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try { return JSON.parse(s) } catch { return null }
    }
  }
  return null
}


function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

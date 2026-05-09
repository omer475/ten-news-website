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
  LT_EMA_RATE,
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
  applyPublisherCap,
  applyEventCap,
  CROSS_SESSION_EVENT_DEMOTE,
  recencyWeightForArticle,
  adaptiveThresholds,
  EXPLORE_SLOT_FRACTION,
  SAME_TAG_TODAY_WINDOW_HOURS,
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

// v5.1 (Phase 1, 2026-05-06): sliding MMR ceiling across slate positions.
// Pinterest Pinnability + Google News diversity papers: λ slides 0.7 → 0.5 →
// 0.4 across positions to hook the user with relevance early and prevent
// boredom late. We implement via a similarity ceiling because our MMR is
// implemented as a "skip-if-too-similar" gate rather than a softmax score.
// Higher ceiling = more lenient dedup (relevance dominates).
// Lower ceiling = stricter dedup (diversity dominates).
const MMR_CEILING_EARLY = 0.85    // positions 0-2:   relevance-heavy
const MMR_CEILING_MID   = 0.78    // positions 3-6:   balanced (was the constant)
const MMR_CEILING_LATE  = 0.70    // positions 7+:    diversity-heavy

function mmrCeilingForPosition(pos) {
  if (pos < 3) return MMR_CEILING_EARLY
  if (pos < 7) return MMR_CEILING_MID
  return MMR_CEILING_LATE
}

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

// v5.1 (Phase 1 fix #6, 2026-05-06) — engagement-state-aware slot
// allocation. Multi-Armed Bandit with Abandonment (Yahoo IEEE 2022):
// when recent rewards are low, abandonment risk is high → push
// exploitation (best-bet items). When recent rewards are high → push
// exploration. Translates to "user is bored, give them what they
// definitely like" vs "user is engaged, broaden horizons."
//
// Trade slots between explore and tier1/tier2 based on recentEngagementZ.
// recentEngagementZ ∈ [-1, +1], where:
//   −1 = all skips in last N         → all-out exploitation
//    0 = neutral / not enough signal → defaults
//   +1 = all engages in last N        → push EXPLOITATION (engaged users
//                                       want more of what's working — TikTok
//                                       Algo 101 "satisfaction zone")
//
// Phoenix Phase 1.5 (2026-05-08): INVERTED from the previous version which
// pushed MORE explore on high engagement. The TikTok-aligned intuition
// (per the leaked Algo 101 + every public ByteDance/Kuaishou paper) is:
//   high engagement → user is satisfied → KEEP exploiting
//   low engagement  → user is bored     → try new things
// Previous behavior caused a feedback spiral: every engaged tap inflated
// explore, which served random content, which got engagement-mined out of
// curiosity, which kept inflating explore. Reversing the relationship
// breaks the loop.
//
//   z < −0.5  : explore 4→6, tier1 5→4, tier2 4→3 (bored, try new)
//   z > +0.5  : explore 4→1, tier1 5→7, tier2 4→5 (engaged, exploit)
//   else      : SLOT_BUDGETS unchanged
function engagementAwareSlotBudgets(recentEngagementZ) {
  if (recentEngagementZ > 0.5) {
    return {
      'trinity-fresh':   4,
      'trinity-m-tier1': 7,
      'trinity-m-tier2': 5,
      'trinity-lt':      3,
      'explore':         1,
    }
  }
  if (recentEngagementZ < -0.5) {
    return {
      'trinity-fresh':   4,
      'trinity-m-tier1': 4,
      'trinity-m-tier2': 3,
      'trinity-lt':      3,
      'explore':         6,
    }
  }
  return SLOT_BUDGETS
}

// Phoenix Phase 6.A (2026-05-09). Two-phase explore schedule by user
// activity level. The 2025 TikTok reproducibility study (arxiv:2504.18140)
// empirically confirmed: TikTok runs "heavy explore for first ~1000
// videos, then rapid exploitation kicks in." Translating to our text
// platform using qualifyingCount as activity proxy:
//
//   New user (QC < 100):       30% explore — discover taste fast
//   Mid user  (QC 100-500):    20% explore — current default
//   Heavy user (QC >= 500):    10% explore — mostly exploit known taste
//
// Engagement Z still applies WITHIN each phase (±1-2 explore slots) so
// a heavy user who's bored gets some explore lift, an engaged new user
// gets some explore reduction.
const EXPLORE_PHASE_THRESHOLDS_QC = [100, 500]

function phaseAwareSlotBudgets(qualifyingCount, recentEngagementZ) {
  // Phase 1: new user — 30% explore, even budget across exploit buckets
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[0]) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 4,
      'trinity-m-tier2': 3,
      'trinity-lt':      4,
      'explore':         6,
    }
  }
  // Phase 2: mid user — defer to existing engagement-Z logic (20% explore)
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[1]) {
    return engagementAwareSlotBudgets(recentEngagementZ)
  }
  // Phase 3: heavy user — 10% explore, exploit-heavy
  if (recentEngagementZ > 0.5) {
    return {
      'trinity-fresh':   4,
      'trinity-m-tier1': 8,
      'trinity-m-tier2': 5,
      'trinity-lt':      2,
      'explore':         1,
    }
  }
  if (recentEngagementZ < -0.5) {
    return {
      'trinity-fresh':   4,
      'trinity-m-tier1': 5,
      'trinity-m-tier2': 4,
      'trinity-lt':      3,
      'explore':         4,
    }
  }
  return {
    'trinity-fresh':   4,
    'trinity-m-tier1': 7,
    'trinity-m-tier2': 5,
    'trinity-lt':      2,
    'explore':         2,
  }
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
    recentEngagementZ = 0,  // v5.1 fix #6 — bandit-with-abandonment signal in [-1,+1]
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
    { h1, h2, qualifyingCount, cooldownPrimaries: histogramCooldownPrimaries },
    clusterState,
    articleCounts,
    persistedCooldownPrimaries,
    publisherPenalties,
    todaysPrimaryCounts,
    avoidClusters,
  ] = await Promise.all([
    buildHistograms(supabase, userId),
    loadClusterState(supabase),
    loadArticleCountsBySecondary(supabase),
    loadPrimaryCooldowns(supabase, userId),
    loadPublisherPenalties(supabase, userId),
    // Phoenix Phase 2.B (2026-05-08): same-tag-today penalty input.
    loadTodaysPrimaryCounts(supabase, userId),
    // Phoenix Phase 4.F (2026-05-09): per-cluster avoid set — clusters
    // user has been impressed >=8× with engage rate <12% (last 60 days).
    // Catches sub-category negatives (basketball within Sports, Iran-war
    // within World) that the category-level multiplier misses.
    loadAvoidClusters(supabase, userId),
  ])

  // v5.1 fix #9 — Merge persistent primary cooldowns from
  // user_primary_cooldown (track.js Not Interested handler) with the
  // session-derived ones from buildHistograms. Trinity-M / Trinity-LT
  // skip this combined set; explore can still pick.
  const cooldownPrimaries = new Set(histogramCooldownPrimaries || [])
  for (const p of persistedCooldownPrimaries) cooldownPrimaries.add(p)

  // ─── COLD-START PATH ──────────────────────────────────────────────────
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR) {
    const cold = await retrieveTrending(supabase, {
      hoursWindow: 7 * 24, excludeIds: seenIds, limit: TRENDING_POOL_SIZE,
    })
    for (const a of cold) a._retriever = 'cold-trending'
    const ranked = rerank(cold)
    let picked = mmrDiversify(ranked, feedSize)
    picked = applyPrimaryCap(picked)
    picked = applyPublisherCap(picked)
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
  // Phoenix Phase 5.B (2026-05-09): pass avoidClusters so tier1/tier2 also
  // filter sub-category negatives (Phase 4.F was incomplete — only LT/explore).
  const mClustersTier1 = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds, {
    onlyPrimaries: tier1,
    cooldownPrimaries,
    avoidClusters,
    maxClusters: 6,
  })
  const mClustersTier2 = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds, {
    onlyPrimaries: tier2,
    cooldownPrimaries,
    avoidClusters,
    maxClusters: 5,
  })

  // Trinity-LT covers ranks 11+ via long-tail B-score; exclude tier1+tier2
  // M-picks so LT lives at the long end of the histogram.
  // Phoenix Phase 4.F: also exclude clusters in the user's avoid set.
  const ltExcludeSet = new Set([...mClustersTier1, ...mClustersTier2])
  for (const c2 of avoidClusters) ltExcludeSet.add(c2)
  const ltClusters = trinityLT(h2, clusterState, articleCounts, Math.random, {
    excludeClusters: ltExcludeSet,
    cooldownPrimaries,
    parentMap: codebook.parentMap,
  })

  // v5-C. Explore arm bumped from 5% → 20%. Pick more clusters than slots
  // so MMR has room to drop near-duplicates without starving the bucket.
  // Phoenix Phase 2.B (2026-05-08): same-tag-today penalty wired through.
  // Reduces explore Beta sample for clusters whose primary is over-served
  // today — confirmed TikTok mechanism (Algo 101 leak).
  const exploreSlotsBudget = SLOT_BUDGETS.explore
  const explClusters = exploreArm(
    h2, clusterState, articleCounts, exploreSlotsBudget * 3, Math.random,
    { parentMap: codebook.parentMap, todaysPrimaryCounts, avoidClusters }
  )

  // v5-D. Fresh pool: top-10 primaries × 48h. Skip cooldown primaries.
  const freshPrimariesAll = topPrimariesFromHistogram(h1, FRESH_TOP_PRIMARIES)
  const freshPrimaries = freshPrimariesAll.filter(p => !cooldownPrimaries.has(p))

  // Run the four retrievers + Phoenix trending fallback in parallel.
  // Phoenix Phase 1.3 (2026-05-08): trendingFallback is a personalized-trending
  // backstop. composeWithBudgets will pull from it ONLY when personalized
  // pools come back under-budget. Replaces the old behavior where empty
  // personalized pools silently spilled into explore.
  const trendingPrimariesForFallback = freshPrimaries.length > 0
    ? freshPrimaries
    : topPrimariesFromHistogram(h1, FRESH_TOP_PRIMARIES)
  let [mTier1Result, mTier2Result, ltResult, exploreResult, freshPool, trendingFallback] = await Promise.all([
    mClustersTier1.length
      ? retrieveCandidatesAdaptive(supabase, mClustersTier1, {
          perClusterLimit: PER_M_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL, userId,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    mClustersTier2.length
      ? retrieveCandidatesAdaptive(supabase, mClustersTier2, {
          perClusterLimit: PER_M_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL, userId,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    ltClusters.length
      ? retrieveCandidatesAdaptive(supabase, ltClusters, {
          perClusterLimit: PER_LT_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL, userId,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    explClusters.length
      ? retrieveCandidatesAdaptive(supabase, explClusters, {
          perClusterLimit: PER_EXPLORE_LIMIT, excludeIds: seenIds, minScore: 500,
          minPoolSize: exploreSlotsBudget * 2, userId,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    freshPrimaries.length
      ? retrievePersonalizedFresh(supabase, freshPrimaries, {
          excludeIds: seenIds, limit: FRESH_POOL_LIMIT, userId,
        })
      : Promise.resolve([]),
    // Phoenix trending fallback: top-10 primaries × 7-day window, broader
    // score floor (200), bigger pool. Used by composeWithBudgets only when
    // personalized pools come back under-budget.
    trendingPrimariesForFallback.length
      ? retrievePersonalizedFresh(supabase, trendingPrimariesForFallback, {
          excludeIds: seenIds, limit: 60, userId, hoursWindow: 7 * 24, minScore: 200,
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
  stampPool(trendingFallback,  'trending-fallback')

  // v5.1 Phase 1 — Story-cluster dedup (Google News pattern). Two passes:
  //   1. Attach _world_event_id to every candidate via a single batched
  //      lookup against article_world_events.
  //   2. Build a Set of recent event_ids for the user (last 24h impressions
  //      joined with article_world_events) so rerank can apply 0.3×
  //      cross-session demote to articles in already-seen stories.
  // The in-slate strict 1-per-event cap runs later via applyEventCap.
  //
  // Audit fix F8 (2026-05-06): substitute for the disabled step6 world-event
  // detection — run a same-pool embedding-cosine near-duplicate pass on every
  // pool before compose. With cosine ≥ 0.92, drops AP/Reuters wire pickups of
  // the same story even when they have different ids, world_event_ids, and
  // publishers. Cheap because every retrieval candidate already carries
  // embedding_minilm_vec.
  freshPool          = dedupNearDuplicates(freshPool || [])
  mTier1Result       = { ...mTier1Result, pool: dedupNearDuplicates(mTier1Result.pool || []) }
  mTier2Result       = { ...mTier2Result, pool: dedupNearDuplicates(mTier2Result.pool || []) }
  ltResult           = { ...ltResult,     pool: dedupNearDuplicates(ltResult.pool || []) }
  exploreResult      = { ...exploreResult, pool: dedupNearDuplicates(exploreResult.pool || []) }
  trendingFallback   = dedupNearDuplicates(trendingFallback || [])

  const allCandidates = [
    ...freshPool, ...mTier1Result.pool, ...mTier2Result.pool,
    ...ltResult.pool, ...exploreResult.pool, ...trendingFallback,
  ]
  const [recentEventIds, categoryMultipliers] = await Promise.all([
    loadRecentEventIds(supabase, userId),
    loadCategoryMultipliers(supabase, userId),
  ])
  await attachWorldEventIds(supabase, allCandidates)

  // v5-A. Rerank EACH pool independently (intra-pool by score × recency × stale),
  // then compose with fixed slot budgets. Cross-pool ordering is the budget,
  // not a global score sort.
  const rerankOpts = { recentEventIds, categoryMultipliers, publisherPenalties }
  const freshRanked = rerank(freshPool, rerankOpts)
  const mTier1Ranked = rerank(mTier1Result.pool, rerankOpts)
  const mTier2Ranked = rerank(mTier2Result.pool, rerankOpts)
  const ltRanked = rerank(ltResult.pool, rerankOpts)
  const exploreRanked = rerank(exploreResult.pool, rerankOpts)
  const trendingRanked = rerank(trendingFallback, rerankOpts)

  // v5.1 fix #6 — pick budgets adaptively based on the user's recent
  // engagement state (bandit-with-abandonment) before scaling.
  // Phoenix Phase 6.A: phase-aware (by qualifyingCount activity level) +
  // engagement-Z aware budget. Replaces pure engagementAwareSlotBudgets.
  const baseBudgets = phaseAwareSlotBudgets(qualifyingCount, recentEngagementZ)

  // Scale budgets if caller asked for non-default feedSize.
  const scale = feedSize / FINAL_FEED_SIZE
  const scaledBudgets = scaleBudgets(baseBudgets, scale, feedSize)

  // Compose: round-robin across pools, honoring budgets. Items already
  // present in another pool (rare — fresh ∩ tier1) are deduped by id.
  // Phoenix Phase 1.3: explore is hardCap=true so empty personalized pools
  // can't silently turn into a 90% explore feed. trending-fallback (budget=0,
  // soft-cap) absorbs any remaining deficit instead.
  const composed = composeWithBudgets([
    { name: 'trinity-fresh',     items: freshRanked,    budget: scaledBudgets['trinity-fresh'] },
    { name: 'trinity-m-tier1',   items: mTier1Ranked,   budget: scaledBudgets['trinity-m-tier1'] },
    { name: 'trinity-m-tier2',   items: mTier2Ranked,   budget: scaledBudgets['trinity-m-tier2'] },
    { name: 'trinity-lt',        items: ltRanked,       budget: scaledBudgets['trinity-lt'] },
    { name: 'explore',           items: exploreRanked,  budget: scaledBudgets['explore'], hardCap: true },
    { name: 'trending-fallback', items: trendingRanked, budget: 0 },
  ], feedSize)

  // v5-B + Phoenix Phase 7.A: per-primary cap + calibrated to user's mix.
  // Steck RecSys 2018: slate proportion should match user's historical
  // interest mix. Compute per-primary caps from h1: target = round(mix × N × 1.2),
  // bounded [2, 7] to keep diversity floor + ceiling.
  const userPrimaryCaps = buildUserPrimaryCaps(h1, feedSize)
  let slate = applyPrimaryCap(composed, { userPrimaryCaps })

  // v5.1 — Per-publisher cap + no-consecutive same-publisher (TikTok
  // creator-dedup analog). Run after the primary cap because primary
  // balance is the higher-priority diversity axis (interest topology),
  // publisher diversity is secondary cosmetic balance.
  slate = applyPublisherCap(slate)

  // v5.1 — Story-cluster cap (1 per world_event_id). Strict drop;
  // information-redundant duplicates of an already-included story add
  // nothing for the reader. Google News pattern. Runs after publisher
  // cap because story-uniqueness is more important than publisher
  // distribution — a 5-Reuters slate with 5 unique stories beats a
  // 5-publisher slate with 4 versions of the same story.
  slate = applyEventCap(slate)

  // MMR semantic-dedup pass. Runs AFTER caps so we don't drop a
  // unique-cluster item just because it's similar to a top-pick — the
  // caps already enforced primary + publisher + event diversity, MMR
  // removes near-duplicates within that (covers cases where two distinct
  // event_ids cover the same story, e.g. early-coverage drift).
  slate = mmrDiversify(slate, feedSize)

  // EMA update for shown personalized clusters (M tiers + LT + fresh).
  // Phoenix Phase 5.C+5.D (2026-05-09):
  //   * AWAIT both cluster_state mutations (Vercel kills lambda on return).
  //   * Use atomic bump_cluster_b_score RPC (migration 090) instead of
  //     JS-side read-modify-write upsert. Two concurrent requests now
  //     atomically compose their EMA updates instead of last-write-wins.
  const personalized = new Set(['trinity-m-tier1', 'trinity-m-tier2', 'trinity-lt', 'trinity-fresh'])
  const shownClusterIds = Array.from(new Set(
    slate.filter(a => personalized.has(a._retriever) || personalized.has(a._retrieverTier))
         .map(a => a.vq_secondary).filter(c => c != null)
  ))
  const exploreShown = slate.filter(a => (a._retrieverTier || a._retriever) === 'explore')
                            .map(a => a.vq_secondary).filter(c => c != null)
  await Promise.all([
    shownClusterIds.length > 0
      ? supabase.rpc('bump_cluster_b_score', {
          p_cluster_ids: shownClusterIds,
          p_alpha: LT_EMA_RATE,
        }).then(({ error }) => {
          if (error) console.error('[trinity] bump_cluster_b_score RPC failed:', error.message)
        })
      : Promise.resolve(),
    exploreShown.length > 0
      ? bumpExploreShows(supabase, exploreShown)
      : Promise.resolve(),
  ])

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
      // v5.1 fix #6 — surface bandit-with-abandonment state for verification
      recentEngagementZ,
      slotBudgetsUsed: baseBudgets,
      // v5.1 fix #2 — story-cluster dedup observability
      recentEventIdsCount: recentEventIds.size,
      // v5.1 fix #4 — per-category multiplier observability
      categoryMultipliersCount: categoryMultipliers.size,
      // v5.1 fix #9 — multi-level Not Interested observability
      publisherPenaltiesCount: publisherPenalties.size,
      persistedCooldownPrimariesCount: persistedCooldownPrimaries.size,
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
// Optional opts:
//   recentEventIds: Set<event_id> for cross-session story demote (fix #2)
//   categoryMultipliers: Map<category, multiplier> for per-category demote (fix #4)
//   publisherPenalties: Map<source_lower, mult> for Not Interested propagation (fix #9)
// Phoenix Phase 1.2b (2026-05-08): soft seen-decay replaces the hard
// antijoin filter. Articles seen 0 / 1 / 2 / 3+ times decay to multipliers
// 1.0 / 0.4 / 0.1 / 0.02. Pools never come back empty in narrow taste
// clusters; the score chain attenuates re-shows. Aligns with TikTok's
// in-cluster exhaustion handling (per ex-engineer talks): score decay,
// not hard filter — hard filter is reserved for explicit Not Interested
// and abuse blocks.
function seenDecay(seenCount) {
  if (!seenCount || seenCount <= 0) return 1.0
  if (seenCount === 1) return 0.4
  if (seenCount === 2) return 0.1
  return 0.02
}

function rerank(candidates, opts = {}) {
  const now = Date.now()
  const recentEventIds = opts.recentEventIds || null
  const categoryMultipliers = opts.categoryMultipliers || null
  const publisherPenalties = opts.publisherPenalties || null
  for (const a of candidates) {
    const recency = recencyWeightForArticle(a, now)
    const quality = Number(a.ai_final_score || 0)
    const bucketBoost = BUCKET_BOOST[a._retriever] ?? 1.0
    const ageDays = (now - new Date(a.created_at || a.published_at || now).getTime()) / 86400000
    // v5.1 (audit fix F22 / smooth stale): replace the 0.4× cliff at exactly
    // 7 days with a smooth 1/(1 + 0.3 × max(0, ageDays-7)). At 6.99d → 1.0;
    // at 7.01d → ~0.997 (vs. 0.4 cliff); at 14d → 0.32; at 30d → 0.13.
    const stale = ageDays <= STALE_AGE_DAYS
      ? 1
      : 1 / (1 + 0.3 * (ageDays - STALE_AGE_DAYS))
    let eventDemote = 1
    if (recentEventIds && a._world_event_id != null && recentEventIds.has(a._world_event_id)) {
      eventDemote = CROSS_SESSION_EVENT_DEMOTE  // 0.3× — already-seen story
    }
    let catMult = 1
    if (categoryMultipliers && a.category) {
      const m = categoryMultipliers.get(a.category)
      if (m != null) catMult = m
    }
    let pubMult = 1
    if (publisherPenalties && typeof a.source === 'string') {
      const m = publisherPenalties.get(a.source.toLowerCase())
      if (m != null) pubMult = m
    }
    // Phoenix Phase 1.2b — soft seen-decay (replaces hard antijoin).
    const seenMult = seenDecay(a.seen_count)
    // v5.1 (audit fix A5): use log-quality so a 600→700 quality bump is
    // commensurate with the bucket boost / category multiplier scales.
    // Raw `quality` (0-1000) used to dominate every other multiplier.
    // log1p(quality / 100) gives range ~[0, 2.4] — comparable to bucket
    // boosts (1.1-1.6) and stale/cat/pub multipliers (0.25-1.0).
    const qualityNorm = Math.log1p(quality / 100)
    a._score = qualityNorm * recency * bucketBoost * stale * eventDemote * catMult * pubMult * seenMult
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
    const ceiling = mmrCeilingForPosition(picked.length)
    if (maxSim >= ceiling) continue
    picked.push(cand)
    pickedEmbeds.push(emb)
  }
  return picked
}


async function retrieveTrending(supabase, { hoursWindow, excludeIds, limit }) {
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    // The JSONB component columns (details/timeline/graph/map/five_ws)
    // were missing — without them, every Trinity-served article arrived
    // at the iOS feed with `safeJsonParse(undefined, null)` resolving to
    // null, so the feed card's `componentSections` had no data to render
    // info boxes for. The Explore page worked because its prefetch hits
    // `/api/news/[id]` (which does `select('*')`); the main feed had no
    // such hydration. Also adding `components`, `countries`, `topics`,
    // `interest_tags`, `country_relevance`, `topic_relevance`,
    // `cluster_id` so the Trinity slate matches v11's ARTICLE_COLUMNS
    // shape downstream of `formatArticle`.
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, components, details, timeline, graph, map, five_ws, countries, topics, interest_tags, country_relevance, topic_relevance, cluster_id, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
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


// Phoenix Phase 5.C (2026-05-09): now returns a Promise. Caller awaits
// before returning the response so Vercel doesn't kill the lambda
// before the RPC commits. Cost: ~50ms latency, but no more silent
// data loss in the explore-arm Beta posterior.
async function bumpExploreShows(supabase, clusterIds) {
  // Audit fix A2 (2026-05-06): use atomic RPC instead of select+upsert.
  // The old read-modify-write pattern lost concurrent increments —
  // two simultaneous Trinity requests each read the same value and each
  // wrote +1, producing +1 instead of +2. Migration 078 adds
  // bump_cluster_explore_shows() which uses ON CONFLICT DO UPDATE for
  // a single-statement atomic increment.
  if (!clusterIds || clusterIds.length === 0) return
  const { error } = await supabase.rpc('bump_cluster_explore_shows', { p_cluster_ids: clusterIds })
  if (error) console.error('[trinity] bump_cluster_explore_shows failed:', error.message)
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


// v5.1 Phase 1 — Per-category engagement multiplier with Beta-shrinkage.
//
// Calls user_category_engage_stats RPC (migration 068, originally
// v11/Phase 10.5) and returns Map<category, multiplier>. Multiplier
// curve matches the v11 ladder (0.25× / 0.40× / 0.65× / 0.85× / 1.00×)
// applied to a Beta(10,10)-shrunk engagement rate so a single bad
// article in a small sample doesn't kill a category.
//
// Beta(10,10) is the industry-typical empirical-Bayes prior: 10
// pseudo-positives + 10 pseudo-negatives = neutral 50% prior with
// modest pull. Ten pseudo-counts means a category needs ~50+ real
// impressions before observed rate dominates the prior. This is the
// "per-category long-term engagement multiplier" mechanism TikTok
// publishes ("weighted profile of content categories" in their help
// docs) and that PR #72 already shipped for v11 — Trinity v5 just
// never adopted it. Last night's session showed Sports converting at
// 7.5% and Tech at 27% but the algorithm didn't suppress Sports;
// this fixes that.
const CATEGORY_BETA_ALPHA = 10
const CATEGORY_BETA_BETA  = 10

function categoryMultiplierFromRate(rate) {
  if (rate >= 0.18) return 1.00
  if (rate >= 0.14) return 0.85
  if (rate >= 0.10) return 0.65
  if (rate >= 0.07) return 0.40
  return 0.25
}

async function loadCategoryMultipliers(supabase, userId) {
  const out = new Map()
  if (!userId) return out
  try {
    // p_min_total=30 (was 100 in v11) because Beta(10,10) shrinkage
    // already corrects for small-sample noise.
    const { data, error } = await supabase.rpc('user_category_engage_stats', {
      p_user_id: userId,
      p_days: 30,
      p_min_total: 30,
    })
    if (error) {
      console.error('[trinity] user_category_engage_stats RPC failed:', error.message)
      return out
    }
    for (const row of (data || [])) {
      if (!row.category) continue
      const total = Number(row.total_impressions) || 0
      const engaged = Number(row.engaged) || 0
      const shrunkRate = (engaged + CATEGORY_BETA_ALPHA)
                       / (total + CATEGORY_BETA_ALPHA + CATEGORY_BETA_BETA)
      out.set(row.category, categoryMultiplierFromRate(shrunkRate))
    }
  } catch (err) {
    console.error('[trinity] loadCategoryMultipliers exception:', err.message)
  }
  return out
}


// v5.1 Phase 1 fix #9 — Multi-level Not Interested propagation helpers.
//
// loadPublisherPenalties: returns Map<source_lowercase, multiplier> from
// user_publisher_penalty (migration 077). Caller applies in rerank()
// alongside other multipliers. Publisher names normalized to lowercase
// to match attached-source casing variations.
async function loadPublisherPenalties(supabase, userId) {
  const out = new Map()
  if (!userId) return out
  try {
    const { data, error } = await supabase
      .from('user_publisher_penalty')
      .select('publisher, penalty, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
    if (error || !data) return out
    for (const row of data) {
      if (row.publisher) out.set(row.publisher.toLowerCase(), Number(row.penalty) || 0.5)
    }
  } catch (err) {
    console.error('[trinity] loadPublisherPenalties failed:', err.message)
  }
  return out
}

// loadPrimaryCooldowns: returns Set<vq_primary> from user_primary_cooldown
// (migration 077). Merged into the cooldownPrimaries the histogram builder
// returns, so Trinity-M / Trinity-LT skip these primaries; explore arm
// can still pick — "we'll show fewer like that" semantics.
async function loadPrimaryCooldowns(supabase, userId) {
  const out = new Set()
  if (!userId) return out
  try {
    const { data, error } = await supabase
      .from('user_primary_cooldown')
      .select('vq_primary')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
    if (error || !data) return out
    for (const row of data) {
      if (row.vq_primary != null) out.add(Number(row.vq_primary))
    }
  } catch (err) {
    console.error('[trinity] loadPrimaryCooldowns failed:', err.message)
  }
  return out
}


// Phoenix Phase 7.A (2026-05-09). buildUserPrimaryCaps.
//
// Returns Map<vq_primary, capInteger> where each cap = round(mix × slateSize × 1.2),
// bounded [2, 7]. Steck RecSys 2018 calibrated recommendations: slate proportion
// should match user's historical interest mix instead of flat MAX_PER_PRIMARY=4.
//
// Effect:
//   * User with 50% AI taste, 20-slot slate → AI cap = round(0.5 × 20 × 1.2) = 12, capped at 7
//   * User with 5% Crypto taste, 20-slot slate → Crypto cap = round(0.05 × 20 × 1.2) = 1, floored at 2
//   * Strong interests get more slots; weak interests still represented at floor
//
// 1.2 multiplier gives 20% headroom over pure proportion (allows over-representation
// when a strong primary has many fresh items). Floor 2 prevents single-slot starvation.
// Ceiling 7 prevents 1 cluster dominating an entire slate.
function buildUserPrimaryCaps(h1, slateSize) {
  const caps = new Map()
  let total = 0
  for (let i = 0; i < h1.length; i++) total += h1[i]
  if (total <= 0) return caps  // empty histogram → fall back to flat MAX_PER_PRIMARY

  for (let p = 0; p < h1.length; p++) {
    if (h1[p] <= 0) continue
    const mix = h1[p] / total
    const target = Math.round(mix * slateSize * 1.2)
    caps.set(p, Math.max(2, Math.min(7, target)))
  }
  return caps
}


// Phoenix Phase 4.F (2026-05-09). loadAvoidClusters.
//
// Returns Set<vq_secondary> of clusters where the user has been impressed
// many times but rarely engaged. Used by exploreArm + trinityLT to suppress
// sub-category negatives (e.g. basketball within Sports) that the
// category-level multiplier misses.
//
// Why this matters: the user's category engage rates are 12-33% across all
// categories — Sports is 19%, not low enough to trigger the existing
// category-multiplier gate (<10% threshold). But within Sports, specific
// sub-clusters (Michigan college football, Connecticut Sun WNBA) have
// per-cluster engage rates <8% with 24+ impressions — those ARE rejected
// by the user even though parent-category looks OK on average.
async function loadAvoidClusters(supabase, userId) {
  if (!userId) return new Set()
  try {
    const { data, error } = await supabase.rpc('user_avoid_clusters', {
      p_user_id: userId,
      p_min_impressions: 8,
      p_max_engage_rate: 0.12,
      p_days: 60,
    })
    if (error) {
      console.error('[trinity] user_avoid_clusters RPC failed:', error.message)
      return new Set()
    }
    return new Set((data || []).map(r => r.vq_secondary).filter(c => c != null))
  } catch (err) {
    console.error('[trinity] loadAvoidClusters exception:', err.message)
    return new Set()
  }
}


// Phoenix Phase 2.B (2026-05-08). loadTodaysPrimaryCounts.
//
// Returns Map<vq_primary, count> of articles the user has been served in
// the last SAME_TAG_TODAY_WINDOW_HOURS. Feeds the explore arm's same-tag-
// today penalty (lib/trinity.js exploreArm). The leaked TikTok Algo 101
// names this `same_tag_today` as a homogenization-prevention feature.
//
// Implementation: query last-1000 impressions for window (PostgREST max-
// rows safety bound — covers ~24h for power users at typical scroll
// rates), join to articles for vq_primary, aggregate.
async function loadTodaysPrimaryCounts(supabase, userId) {
  if (!userId) return new Map()
  try {
    const sinceIso = new Date(Date.now() - SAME_TAG_TODAY_WINDOW_HOURS * 3600 * 1000).toISOString()
    const { data: impr, error: e1 } = await supabase
      .from('user_feed_impressions')
      .select('article_id')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (e1 || !impr || impr.length === 0) return new Map()
    const articleIds = Array.from(new Set(impr.map(r => r.article_id).filter(Boolean)))
    if (articleIds.length === 0) return new Map()
    const { data: arts, error: e2 } = await supabase
      .from('published_articles')
      .select('id, vq_primary')
      .in('id', articleIds)
    if (e2 || !arts) return new Map()
    const primaryById = new Map()
    for (const a of arts) {
      if (a.vq_primary != null) primaryById.set(a.id, a.vq_primary)
    }
    const counts = new Map()
    for (const i of impr) {
      const p = primaryById.get(i.article_id)
      if (p == null) continue
      counts.set(p, (counts.get(p) || 0) + 1)
    }
    return counts
  } catch (err) {
    console.error('[trinity] loadTodaysPrimaryCounts failed:', err.message)
    return new Map()
  }
}


// v5.1 Phase 1 — Story-cluster dedup helpers.
//
// loadRecentEventIds: returns Set<event_id> of stories the user has seen
// in the last 24h, by joining last-50 user_feed_impressions with
// article_world_events. Used by rerank() for cross-session demote
// (0.3× multiplier on candidates in already-seen events).
async function loadRecentEventIds(supabase, userId) {
  if (!userId) return new Set()
  try {
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: impr, error: e1 } = await supabase
      .from('user_feed_impressions')
      .select('article_id')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50)
    if (e1 || !impr || impr.length === 0) return new Set()
    const articleIds = impr.map(r => r.article_id).filter(Boolean)
    if (articleIds.length === 0) return new Set()
    const { data: awe, error: e2 } = await supabase
      .from('article_world_events')
      .select('event_id')
      .in('article_id', articleIds)
    if (e2 || !awe) return new Set()
    return new Set(awe.map(r => r.event_id).filter(x => x != null))
  } catch (err) {
    console.error('[trinity] loadRecentEventIds failed:', err.message)
    return new Set()
  }
}

// attachWorldEventIds: in-place set candidate._world_event_id from a single
// batched lookup. O(1) extra DB round-trip vs O(N) per-article.
async function attachWorldEventIds(supabase, candidates) {
  if (!candidates || candidates.length === 0) return
  // Collect distinct article ids to look up.
  const ids = []
  const seenIds = new Set()
  for (const a of candidates) {
    if (a && a.id != null && !seenIds.has(a.id)) {
      ids.push(a.id)
      seenIds.add(a.id)
    }
  }
  if (ids.length === 0) return
  try {
    // Chunk to avoid the postgrest URL length cap on .in() (typically
    // ~2000 ids). 500 is well within bounds.
    const CHUNK = 500
    const map = new Map()  // article_id → event_id (first wins if duplicate)
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('article_world_events')
        .select('article_id, event_id')
        .in('article_id', slice)
      if (error) continue
      for (const row of (data || [])) {
        if (!map.has(row.article_id)) map.set(row.article_id, row.event_id)
      }
    }
    for (const a of candidates) {
      if (a && a.id != null && map.has(a.id)) {
        a._world_event_id = map.get(a.id)
      }
    }
  } catch (err) {
    console.error('[trinity] attachWorldEventIds failed:', err.message)
  }
}


// Audit fix F8 (2026-05-06): drop near-duplicate articles from a pool by
// embedding cosine similarity. Threshold 0.92 calibrated to drop genuine
// wire-pickups (AP/Reuters/AFP cover the same fact in near-identical
// language → cosine 0.93–0.97) while sparing distinct-angle stories
// (e.g. UAE-OPEC vs OPEC-output-hike → cosine 0.78–0.85).
//
// Per-pool, not cross-pool — composeWithBudgets dedups by id; mmrDiversify
// applies softer ceilings (0.70–0.85) for cross-pool. The 0.92 cliff here
// catches the cases MMR's per-position ceiling won't (a 0.95 dup at slate
// position 0+1 would slip past the 0.85 early ceiling).
function dedupNearDuplicates(pool) {
  if (!pool || pool.length <= 1) return pool || []
  const NEAR_DUP_CEILING = 0.92
  const kept = []
  const keptEmbeds = []
  for (const cand of pool) {
    const emb = parseEmbedding(cand.embedding_minilm_vec)
    if (!emb) {
      // Items without embedding can't be dedup'd; pass through.
      kept.push(cand); keptEmbeds.push(null); continue
    }
    let isDup = false
    for (const pe of keptEmbeds) {
      if (!pe) continue
      if (cosineSim(emb, pe) >= NEAR_DUP_CEILING) { isDup = true; break }
    }
    if (isDup) continue
    kept.push(cand); keptEmbeds.push(emb)
  }
  return kept
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

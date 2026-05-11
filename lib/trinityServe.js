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

import { synthesizeWarmStartHistogram, ONBOARDING_TOPIC_MAP } from './coldStart.js'
import { rerankV1 } from './ranker_v1.js'

// Phase 3.1 (2026-05-10): X-style learned weighted-sum ranker.
// Set RANKER_VERSION=v1 in env to enable. Default v0 keeps the legacy
// 9-multiplier rerank(). When v1, candidates are scored by
// Σ weight × P(action) + policy multipliers per ranker_v1.js.
const RANKER_VERSION = process.env.RANKER_VERSION || 'v0'
import {
  buildHistograms,
  trinityM,
  trinityLT,
  exploreArm,
  retrieveFollowed,
  LT_EMA_RATE,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
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
  SAME_TAG_TODAY_WINDOW_HOURS,
  FRESH_TOP_PRIMARIES,
  FRESH_MIN_SCORE,
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
//
// Phase 2.1 (2026-05-10): adds 'trinity-follow' = 3 slots (15%) for users
// with social-graph follows. Rebalanced from fresh (-1) and tier1 (-1).
// When user has 0 follows, phaseAwareSlotBudgets redistributes those 3
// back into fresh + tier1 (no penalty for non-followers).
//
// Per WebConf 2024 audit, top-personalization-quartile TikTok users get
// ~30% of videos from followed creators. We start at 15% and let the
// engagement signal grow it (Phase 3 learned ranker can lift further).
const SLOT_BUDGETS = {
  'trinity-fresh':   3,
  'trinity-m-tier1': 4,
  'trinity-m-tier2': 4,
  'trinity-lt':      3,
  'trinity-follow':  3,
  'explore':         3,
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
// Phase 2.1 (2026-05-10): every budget shape now includes trinity-follow.
// Sum still = 20. When user has 0 follows, redistributeFollowsBudget below
// reallocates the 3 follow slots back into fresh + tier1.
export function engagementAwareSlotBudgets(recentEngagementZ) {
  if (recentEngagementZ > 0.5) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 6,
      'trinity-m-tier2': 4,
      'trinity-lt':      2,
      'trinity-follow':  3,
      'explore':         2,
    }
  }
  if (recentEngagementZ < -0.5) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 3,
      'trinity-m-tier2': 3,
      'trinity-lt':      3,
      'trinity-follow':  3,
      'explore':         5,
    }
  }
  return SLOT_BUDGETS
}

// Phase 2.1 (2026-05-10). When user has 0 follows, the trinity-follow pool
// will be empty. Reallocate its slots into fresh + tier1 (where personalized
// signal is strongest) so the slate doesn't shrink. Returns a new budget
// object — does not mutate.
export function redistributeFollowsBudget(budgets, hasFollows) {
  if (hasFollows) return budgets
  const out = { ...budgets }
  const followSlots = out['trinity-follow'] || 0
  if (followSlots <= 0) return out
  out['trinity-follow'] = 0
  // Split follow slots: 60% to fresh (it benefits more from extra slots —
  // recency is a strong signal), 40% to tier1.
  const toFresh = Math.ceil(followSlots * 0.6)
  const toTier1 = followSlots - toFresh
  out['trinity-fresh'] = (out['trinity-fresh'] || 0) + toFresh
  out['trinity-m-tier1'] = (out['trinity-m-tier1'] || 0) + toTier1
  return out
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

export function phaseAwareSlotBudgets(qualifyingCount, recentEngagementZ) {
  // Phase 1: new user — 30% explore, follow gets a smaller share (new users
  // typically have 0-1 follows). Sum = 20.
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[0]) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 3,
      'trinity-m-tier2': 3,
      'trinity-lt':      3,
      'trinity-follow':  2,
      'explore':         6,
    }
  }
  // Phase 2: mid user — defer to existing engagement-Z logic (20% explore)
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[1]) {
    return engagementAwareSlotBudgets(recentEngagementZ)
  }
  // Phase 3: heavy user — 30% explore (Phoenix Phase 9.C.1, 2026-05-09).
  //
  // Source correction: Vombatkere et al. ACM WebConf 2024 measured TikTok's
  // actual exploit fraction at 30-50% of slate even for active heavy users
  // (mean ≥50% over 1k-video session). The previous Phase 6.A intuition that
  // heavy users want LESS exploration (10%) came from creator-marketing
  // blogs, not the peer-reviewed audit. Session 2 (18:55-19:07 UTC) had
  // tier1+tier2+fresh combined producing 19/67 articles for a user with 12k
  // events — a starved feed because we tried too hard to exploit a narrow
  // personalized lane. Bumping explore to 30% restores room for discovery.
  //
  // Engagement-Z still shifts ±2-3 slots within phase: bored users get more
  // explore (40%); engaged users keep some exploit lift (20%).
  // Heavy user (Phase 9.C.1 + 2.1) — follow gets full 3-slot allocation.
  if (recentEngagementZ > 0.5) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 5,
      'trinity-m-tier2': 4,
      'trinity-lt':      2,
      'trinity-follow':  3,
      'explore':         3,    // 15% — engaged user, modest explore
    }
  }
  if (recentEngagementZ < -0.5) {
    return {
      'trinity-fresh':   3,
      'trinity-m-tier1': 3,
      'trinity-m-tier2': 3,
      'trinity-lt':      2,
      'trinity-follow':  3,
      'explore':         6,    // 30% — bored user, push discovery
    }
  }
  return {
    'trinity-fresh':   3,
    'trinity-m-tier1': 4,
    'trinity-m-tier2': 3,
    'trinity-lt':      2,
    'trinity-follow':  3,
    'explore':         5,      // 25% — neutral heavy user, default
  }
}

// Phase 3.0 (2026-05-10): BUCKET_BOOST deleted. The hand-coded per-retriever
// boosts (fresh 1.6, tier1 1.5, ...) were how the ranker chose between pools
// when scores tied. composeWithBudgets now handles cross-pool ordering by
// slot budgets, so the boosts were a stale double-counting. The learned
// ranker (next phase) subsumes any remaining benefit.


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
    todaysPrimaryCounts,
    avoidClusters,
  ] = await Promise.all([
    buildHistograms(supabase, userId),
    loadClusterState(supabase),
    loadArticleCountsBySecondary(supabase),
    loadPrimaryCooldowns(supabase, userId),
    // Phoenix Phase 2.B (2026-05-08): same-tag-today penalty input.
    loadTodaysPrimaryCounts(supabase, userId),
    // Phoenix Phase 4.F (2026-05-09): per-cluster avoid set — clusters
    // user has been impressed >=8× with engage rate <12% (last 60 days).
    // Catches sub-category negatives (basketball within Sports, Iran-war
    // within World) that the category-level multiplier misses.
    loadAvoidClusters(supabase, userId),
  ])
  // Phoenix Phase 6.B — time-of-day primary boost.
  // Phoenix Phase 6.C — ENF multi-granular negative feedback.
  // Phase 2.2 — tap-then-read funnel stats.
  // Phase 3.1 — for v1 ranker: per-user action rates + followed authors + onboarding tags.
  const [hourPrimaryBoosts, negativeDimensions, userFunnelStats, userActionRates, userFollowedAuthors, userOnboardingTags] = await Promise.all([
    loadHourPrimaryBoosts(supabase, userId),
    loadNegativeDimensions(supabase, userId),
    loadUserFunnelStats(supabase, userId),
    RANKER_VERSION === 'v1' ? loadUserActionRates(supabase, userId) : Promise.resolve({}),
    RANKER_VERSION === 'v1' ? loadUserFollowedAuthors(supabase, userId) : Promise.resolve(new Set()),
    RANKER_VERSION === 'v1' ? loadUserOnboardingTags(supabase, userId) : Promise.resolve(new Set()),
  ])

  // v5.1 fix #9 — Merge persistent primary cooldowns from
  // user_primary_cooldown (track.js Not Interested handler) with the
  // session-derived ones from buildHistograms. Trinity-M / Trinity-LT
  // skip this combined set; explore can still pick.
  const cooldownPrimaries = new Set(histogramCooldownPrimaries || [])
  for (const p of persistedCooldownPrimaries) cooldownPrimaries.add(p)

  // ─── PHASE 1.8: COLD-START WARM-START SYNTHESIS ──────────────────────
  // Inject synthetic h¹/h² weights from the user's onboarding-selected
  // topics. Decays linearly to 0 at qualifyingCount=100. Mutates h1/h2
  // in place. Lets the warm-user path (M/LT/explore) work even at QC=0
  // for users who completed onboarding — replaces the cold-trending fork
  // for that case.
  const synthDebug = await synthesizeWarmStartHistogram(supabase, userId, h1, h2, qualifyingCount)

  // ─── COLD-START PATH ──────────────────────────────────────────────────
  // After synthesis: only fall into trending fallback when the user has BOTH
  // (a) too few real qualifying events AND (b) synthesis didn't inject any
  // signal (no onboarding topics, or live-aggregation returned nothing).
  //
  // Phase 0.6 (2026-05-11): WARN log if a user with >= 50 qualifying events
  // somehow reaches this branch. Should be impossible (the gate above requires
  // qualifyingCount < 50). Existence of the log line means one of:
  //   - trinity_build_histogram RPC failed silently and returned qc=0
  //   - codebook loading raced (loadActiveCodebook returned null upstream)
  //   - synthesis returned applied=false despite onboarding tags
  // Audit case 2026-05-11 06:08 UTC: a heavy user (qc=6,683) got 25 slots of
  // cold-trending. This alarm catches recurrences immediately.
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR && !synthDebug.applied) {
    if (qualifyingCount >= 50) {
      console.warn(
        `[trinity.cold_warn] user=${userId?.slice(0, 8) || 'guest'} ` +
        `qc=${qualifyingCount} synthApplied=${synthDebug.applied} ` +
        `synthReason=${synthDebug.reason || 'none'} ` +
        `codebookId=${codebook?.id || 'none'}`
      )
    }
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

  // Phase 0.6 (2026-05-11): per-request histogram diagnostic. Lets us watch
  // adaptive-threshold distribution + tier population across the user base
  // without a debug-endpoint roundtrip.
  console.log(
    `[trinity.histogram] user=${userId?.slice(0, 8) || 'guest'} ` +
    `qc=${qualifyingCount} tP=${thresholds.tP} tS=${thresholds.tS} ` +
    `tier1=${tier1.length} tier2=${tier2.length} ` +
    `cooldownPrimaries=${cooldownPrimaries.size} ` +
    `synth=${synthDebug.applied ? `yes(f=${synthDebug.factor?.toFixed?.(2) || synthDebug.factor})` : 'no'}`
  )

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

  // Phase 2.1 (2026-05-10): follow-graph retriever runs alongside the others.
  // Returns empty when user has no follows (then redistributeFollowsBudget
  // reallocates the slots).
  // Run the five retrievers + Phoenix trending fallback in parallel.
  // Phoenix Phase 1.3 (2026-05-08): trendingFallback is a personalized-trending
  // backstop. composeWithBudgets will pull from it ONLY when personalized
  // pools come back under-budget. Replaces the old behavior where empty
  // personalized pools silently spilled into explore.
  const trendingPrimariesForFallback = freshPrimaries.length > 0
    ? freshPrimaries
    : topPrimariesFromHistogram(h1, FRESH_TOP_PRIMARIES)
  let [mTier1Result, mTier2Result, ltResult, exploreResult, freshPool, trendingFallback, followPool] = await Promise.all([
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
    // Phase 0.4 (2026-05-11): merged two prior 48h fresh calls (top-3 at
    // minScore=300, ranks 4-10 at minScore=500) into ONE call at the lower
    // floor. JS-side split below classifies each row into trinity-fresh vs
    // trending-fresh-overflow by per-primary rank + score, preserving Phase
    // 1.4 semantics with one less DB roundtrip.
    freshPrimaries.length
      ? retrievePersonalizedFresh(supabase, freshPrimaries, {
          excludeIds: seenIds, limit: FRESH_POOL_LIMIT * 2, userId, minScore: 300,
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
    // Phase 2.1 — follow-graph retriever (returns empty if no follows).
    userId
      ? retrieveFollowed(supabase, userId, {
          excludeIds: seenIds, hoursWindow: 7 * 24, minScore: 200, limit: 30,
        })
      : Promise.resolve([]),
  ])

  // Phase 0.4 (2026-05-11): split the merged 48h fresh pool into two logical
  // pools by per-primary rank + score. Top-3 primary articles OR any article
  // with ai_final_score >= FRESH_MIN_SCORE (500) goes to `trinity-fresh`;
  // remaining lower-score ranks-4-10 rows spill into `trending-fallback` for
  // compose-time backfill. Preserves Phase 1.4 semantics (different score
  // floors per primary rank) without two separate DB calls.
  if (Array.isArray(freshPool) && freshPool.length > 0) {
    const top3Set = new Set(freshPrimariesAll.slice(0, 3))
    const freshSplit = []
    const overflowSplit = []
    for (const a of freshPool) {
      const score = Number(a.ai_final_score) || 0
      if (top3Set.has(a.vq_primary) || score >= FRESH_MIN_SCORE) {
        freshSplit.push(a)
      } else {
        overflowSplit.push(a)
      }
    }
    freshPool = freshSplit
    if (overflowSplit.length > 0) {
      trendingFallback = [...(trendingFallback || []), ...overflowSplit]
    }
  }

  // Stamp retriever identity on each pool item; used by the per-pool reranker
  // (BUCKET_BOOST) and by attribution downstream.
  stampPool(freshPool,         'trinity-fresh')
  stampPool(mTier1Result.pool, 'trinity-m-tier1')
  stampPool(mTier2Result.pool, 'trinity-m-tier2')
  stampPool(ltResult.pool,     'trinity-lt')
  stampPool(exploreResult.pool,'explore')
  stampPool(trendingFallback,  'trending-fallback')
  stampPool(followPool,        'trinity-follow')

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
  followPool         = dedupNearDuplicates(followPool || [])

  const allCandidates = [
    ...freshPool, ...mTier1Result.pool, ...mTier2Result.pool,
    ...ltResult.pool, ...exploreResult.pool, ...trendingFallback,
    ...followPool,
  ]
  const [recentEventIds, categoryMultipliers] = await Promise.all([
    loadRecentEventIds(supabase, userId),
    loadCategoryMultipliers(supabase, userId),
  ])
  await attachWorldEventIds(supabase, allCandidates)

  // Phase 3.0 (2026-05-10): freshMult / exploreImpressionBoosts deleted.
  // The explore-only cold-content boost (Phase 7.B) was a tiny-scope tweak;
  // re-add as a learned head later if it shows up in offline analysis.

  // Rerank EACH pool independently. Cross-pool ordering happens in
  // composeWithBudgets via slot budgets, not a global score sort.
  //
  // Phase 3.1 — v1 X-style ranker (additive Σ weight × P(action) + policy
  // multipliers) is gated by RANKER_VERSION env var. v0 falls back to the
  // legacy 9-multiplier multiplicative rerank.
  const scorer = RANKER_VERSION === 'v1' ? rerankV1 : rerank
  const rerankOpts = RANKER_VERSION === 'v1'
    ? {
        userActionRates, userFollowedAuthors, userOnboardingTags,
        userFunnelStats, negativeDimensions, hourPrimaryBoosts,
        categoryMultipliers, recentEventIds, todaysPrimaryCounts,
      }
    : { recentEventIds, categoryMultipliers, hourPrimaryBoosts, negativeDimensions, userFunnelStats, todaysPrimaryCounts }
  const freshRanked = scorer(freshPool, rerankOpts)
  const mTier1Ranked = scorer(mTier1Result.pool, rerankOpts)
  const mTier2Ranked = scorer(mTier2Result.pool, rerankOpts)
  const ltRanked = scorer(ltResult.pool, rerankOpts)
  const exploreRanked = scorer(exploreResult.pool, rerankOpts)
  const trendingRanked = scorer(trendingFallback, rerankOpts)
  const followRanked = scorer(followPool, rerankOpts)

  // v5.1 fix #6 — pick budgets adaptively based on the user's recent
  // engagement state (bandit-with-abandonment) before scaling.
  // Phoenix Phase 6.A: phase-aware (by qualifyingCount activity level) +
  // engagement-Z aware budget. Replaces pure engagementAwareSlotBudgets.
  let baseBudgets = phaseAwareSlotBudgets(qualifyingCount, recentEngagementZ)
  // Phase 2.1 — when user has no follows, redistribute follow slots to
  // fresh + tier1 so the slate doesn't shrink.
  baseBudgets = redistributeFollowsBudget(baseBudgets, followPool.length > 0)

  // Scale budgets if caller asked for non-default feedSize.
  const scale = feedSize / FINAL_FEED_SIZE
  const scaledBudgets = scaleBudgets(baseBudgets, scale, feedSize)

  // Compose: round-robin across pools, honoring budgets, then global-score
  // backfill from non-hardCap pools. Phase 1.2 (2026-05-10): over-fetch by
  // 2× feedSize so the downstream cap chain has room to drop similar / capped
  // items without leaving the slate visibly short. The MMR step at the end
  // trims back to feedSize, so the over-fetch is compute-bounded by the
  // pool sizes already retrieved (no extra DB cost).
  //
  // Phoenix Phase 1.3: explore is hardCap=true so empty personalized pools
  // can't silently turn into a 90% explore feed. trending-fallback (budget=0,
  // soft-cap) absorbs remaining deficit by score.
  const overFetchTarget = feedSize * 2
  const composed = composeWithBudgets([
    { name: 'trinity-fresh',     items: freshRanked,    budget: scaledBudgets['trinity-fresh'] || 0 },
    { name: 'trinity-m-tier1',   items: mTier1Ranked,   budget: scaledBudgets['trinity-m-tier1'] || 0 },
    { name: 'trinity-m-tier2',   items: mTier2Ranked,   budget: scaledBudgets['trinity-m-tier2'] || 0 },
    { name: 'trinity-lt',        items: ltRanked,       budget: scaledBudgets['trinity-lt'] || 0 },
    { name: 'trinity-follow',    items: followRanked,   budget: scaledBudgets['trinity-follow'] || 0 },
    { name: 'explore',           items: exploreRanked,  budget: scaledBudgets['explore'] || 0, hardCap: true },
    { name: 'trending-fallback', items: trendingRanked, budget: 0 },
  ], overFetchTarget)

  // v5-B + Phoenix Phase 7.A: per-primary cap + calibrated to user's mix.
  // Phase 1.2: applyPrimaryCap already pads from overflow (rare clusters are
  // diversity assets), so no targetSize hint needed.
  const userPrimaryCaps = buildUserPrimaryCaps(h1, feedSize)
  let slate = applyPrimaryCap(composed, { userPrimaryCaps })

  // v5.1 — Per-publisher cap + no-consecutive same-publisher (TikTok
  // creator-dedup analog). Phase 1.2: pass allowOverflowPad+targetSize so
  // a Reuters-heavy day doesn't shrink the slate below feedSize. Cap is
  // still preferred when supply is sufficient.
  slate = applyPublisherCap(slate, { allowOverflowPad: true, targetSize: feedSize })

  // v5.1 — Story-cluster cap (1 per world_event_id). Strict drop;
  // information-redundant duplicates of an already-included story add
  // nothing for the reader. Google News pattern. Runs after publisher
  // cap because story-uniqueness is more important than publisher
  // distribution — a 5-Reuters slate with 5 unique stories beats a
  // 5-publisher slate with 4 versions of the same story.
  slate = applyEventCap(slate)

  // MMR semantic-dedup pass — final trim to feedSize. Phase 1.2: MMR is
  // the LAST chain step but is no longer a bare truncate-and-drop. After
  // MMR runs, if the slate is still short of feedSize (rare — every cap
  // dropped something), backfillToTarget pulls the highest-scoring remaining
  // candidates from non-hardCap pools.
  slate = mmrDiversify(slate, feedSize)
  if (slate.length < feedSize) {
    slate = backfillToTarget(slate, [trendingRanked, ltRanked, mTier2Ranked, freshRanked, mTier1Ranked, followRanked], feedSize)
  }

  // EMA update for shown personalized clusters (M tiers + LT + fresh + follow).
  // Phoenix Phase 5.C+5.D (2026-05-09):
  //   * AWAIT both cluster_state mutations (Vercel kills lambda on return).
  //   * Use atomic bump_cluster_b_score RPC (migration 090) instead of
  //     JS-side read-modify-write upsert. Two concurrent requests now
  //     atomically compose their EMA updates instead of last-write-wins.
  const personalized = new Set(['trinity-m-tier1', 'trinity-m-tier2', 'trinity-lt', 'trinity-fresh', 'trinity-follow'])
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
      shownClustersCount: shownClusterIds.length,
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
      persistedCooldownPrimariesCount: persistedCooldownPrimaries.size,
      // Phase 1.8 — warm-start synthesis observability.
      synthApplied: synthDebug.applied,
      synthFactor: synthDebug.factor,
      synthTopicsCount: synthDebug.topicsCount || 0,
      synthPrimariesCount: (synthDebug.primaries || []).length,
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
// Phase 1.4 (2026-05-10): smooth seen-decay replaces the cliff at 3+ views.
//
// Pre-1.4: cliff 1.0 / 0.4 / 0.1 / 0.02 dropped to effective-exclusion at
// 3+ views. This was OK as a soft attenuator alongside a 14d hard window,
// but mig 099's 24h hard window asked the soft layer to do too much work.
// The cliff at 3 views meant a 4th-view article was ~50× weaker than 0
// views — a hard exclusion in all but name.
//
// New: smooth 1 / (1 + 0.4 × seenCount) gives:
//   0 views → 1.000   (fresh)
//   1 view  → 0.714
//   2 views → 0.556
//   3 views → 0.455
//   4 views → 0.385
//   5 views → 0.333
//   10 views → 0.200
// Continuous, no cliff. Pairs with the restored 7d hard window from
// migration 104: anything in last 7 days is hard-excluded; older repeats
// attenuate smoothly.
function seenDecay(seenCount) {
  if (!seenCount || seenCount <= 0) return 1.0
  return 1.0 / (1.0 + 0.4 * seenCount)
}

// Phase 3.0 (2026-05-10) — multiplier cleanup. Down from 15 multipliers to 9.
// Deletions and rationale:
//   stale            — duplicate of recency (both decay by age). DELETED.
//   bucketBoost      — hand-coded retriever-pool boost. Learned ranker will
//                      subsume this. DELETED.
//   pubMult          — duplicate of negMult.source. DELETED.
//   dwellMult        — Phase 1.3, superseded by funnelMult in Phase 2.2.
//                      Both were running concurrently. DELETED.
//   freshMult        — explore-pool-only cold-content boost. Tiny scope,
//                      can be re-added as a learned head later. DELETED.
//   engageReEmergeMult — Phase 2.5 (mine, 2026-05-10) caused the bad
//                      session (9 of 25 cards were old engaged articles).
//                      DELETED — migration 111 restores the 30-day cliff.
//
// Survivors (9):
//   qualityNorm  — log-compressed article AI quality
//   recency      — exponential age decay by shelf_life
//   eventDemote  — cross-session story dedup (0.3×)
//   catMult      — per-category engage rate, Beta-shrunk
//   seenMult     — smooth view-count attenuation
//   hourMult     — time-of-day primary boost
//   negMult      — ENF per-dimension fast-skip decay
//   funnelMult   — tap-then-read per-primary boost (Phase 2.2)
//   todayPenalty — same-tag-today (Phase 2.3)
function rerank(candidates, opts = {}) {
  const now = Date.now()
  const recentEventIds = opts.recentEventIds || null
  const categoryMultipliers = opts.categoryMultipliers || null
  const hourPrimaryBoosts = opts.hourPrimaryBoosts instanceof Map ? opts.hourPrimaryBoosts : null
  const negDims = opts.negativeDimensions || null
  const todaysPrimaryCounts = opts.todaysPrimaryCounts instanceof Map
    ? opts.todaysPrimaryCounts
    : null
  const userFunnelStats = opts.userFunnelStats instanceof Map
    ? opts.userFunnelStats
    : null
  for (const a of candidates) {
    const recency = recencyWeightForArticle(a, now)
    const quality = Number(a.ai_final_score || 0)
    let eventDemote = 1
    if (recentEventIds && a._world_event_id != null && recentEventIds.has(a._world_event_id)) {
      eventDemote = CROSS_SESSION_EVENT_DEMOTE
    }
    let catMult = 1
    if (categoryMultipliers && a.category) {
      const m = categoryMultipliers.get(a.category)
      if (m != null) catMult = m
    }
    const seenMult = seenDecay(a.seen_count)
    let hourMult = 1
    if (hourPrimaryBoosts && a.vq_primary != null) {
      const m = hourPrimaryBoosts.get(a.vq_primary)
      if (m != null) hourMult = m
    }
    let negMult = 1
    if (negDims) {
      const clusterSkips = a.vq_secondary != null
        ? (negDims.cluster.get(String(a.vq_secondary)) || 0)
        : 0
      const primarySkips = a.vq_primary != null
        ? (negDims.primary.get(String(a.vq_primary)) || 0)
        : 0
      const sourceSkips = typeof a.source === 'string'
        ? (negDims.source.get(a.source.toLowerCase()) || 0)
        : 0
      if (clusterSkips > 0) negMult *= 1 / (1 + clusterSkips * 0.5)
      if (primarySkips > 0) negMult *= 1 / (1 + primarySkips * 0.3)
      if (sourceSkips > 0)  negMult *= 1 / (1 + sourceSkips  * 0.4)
    }
    // Phase 2.2 — tap-then-read funnel boost. Empirical-Bayes-shrunk per-
    // primary tapRate × deepReadRate. Beta(5,20) on tap, Beta(2,6) on read.
    let funnelMult = 1.0
    const fs = userFunnelStats && a.vq_primary != null ? userFunnelStats.get(a.vq_primary) : null
    if (fs && fs.impressions >= 5) {
      const tapShrunk  = (fs.taps + 5) / (fs.impressions + 25)
      const readShrunk = (fs.deep_reads + 2) / (Math.max(1, fs.taps) + 8)
      funnelMult = Math.max(0.7, Math.min(1.6, (tapShrunk / 0.20) * (readShrunk / 0.30)))
    }
    // Phase 2.3 — same-tag-today penalty (TikTok Algo 101 leak).
    let todayPenalty = 1.0
    if (todaysPrimaryCounts && a.vq_primary != null) {
      const seenToday = todaysPrimaryCounts.get(a.vq_primary) || 0
      if (seenToday > 0) {
        todayPenalty = 1.0 / (1.0 + 0.08 * seenToday)
      }
    }
    // log-quality keeps the AI score commensurate with the other 0-1.5 multipliers.
    const qualityNorm = Math.log1p(quality / 100)
    a._score = qualityNorm * recency * eventDemote * catMult * seenMult * hourMult * negMult * funnelMult * todayPenalty
  }
  candidates.sort((a, b) => b._score - a._score)
  return candidates
}


// Phase 1.2 (2026-05-10). Final safety net after the cap chain + MMR.
// If the slate is short of feedSize, walk the provided candidate pools (in
// the order passed) and append items not already in the slate, by score, until
// feedSize is reached or all pools are exhausted. Caller supplies trending
// fallback first (most permissive) then progressively narrower pools.
//
// This sits BELOW the cap chain — pads are not subject to per-primary or
// per-publisher caps. They appear only when caps would otherwise have left
// the slate visibly short. In normal operation (compose over-fetches 2×) the
// caps drop fewer than feedSize items and this is a no-op.
function backfillToTarget(slate, candidatePools, feedSize) {
  if (slate.length >= feedSize) return slate
  const seenIds = new Set(slate.map(a => a?.id).filter(id => id != null))
  const overflow = []
  for (const pool of candidatePools) {
    if (!Array.isArray(pool)) continue
    for (const item of pool) {
      if (item == null || item.id == null) continue
      if (seenIds.has(item.id)) continue
      overflow.push(item)
      seenIds.add(item.id)
    }
  }
  overflow.sort((a, b) => (b._score || 0) - (a._score || 0))
  const out = slate.slice()
  for (const item of overflow) {
    if (out.length >= feedSize) break
    out.push({ ...item, _retrieverTier: item._retriever || item._retrieverTier || 'backfill' })
  }
  if (out.length < feedSize) {
    console.warn(`[trinity.backfill] slate still under feedSize after backfill: got ${out.length} of ${feedSize}`)
  }
  return out
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


// Phase 3.0 — loadPublisherPenalties deleted along with pubMult.
// negMult.source (ENF dimension) now handles publisher-level penalties.
// The user_publisher_penalty table writes from track.js Not-Interested are
// still active but unread; can be cleaned up in a future migration.

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


// Phoenix Phase 6.C (2026-05-09). loadNegativeDimensions.
//
// Source: ENF (arxiv:2511.18700, ByteDance Nov 2025) +6.2% watch / -9.4%
// fast-skip. Attributes user skips to specific dimensions (cluster, source,
// primary) and propagates the negative signal ALONG THAT DIMENSION ONLY.
//
// Returns { cluster: Map, source: Map, primary: Map } where each Map is
// (dimension_value → time-decayed fast-skip count). Rerank computes per-
// candidate penalty by summing matched dimensions.
async function loadNegativeDimensions(supabase, userId) {
  const out = { cluster: new Map(), source: new Map(), primary: new Map() }
  if (!userId) return out
  try {
    // Phoenix Phase 9.A.2 (2026-05-09): drop threshold 3 → 1. Two fast-skips
    // is real signal — the old threshold filtered out cluster 1798
    // (2 skips on Yahoo Finance analyst targets) entirely, letting tier1
    // confidently re-pick it. With logistic decay, even 1 skip applies a
    // gentle taper; 2+ skips compounds.
    const { data, error } = await supabase.rpc('get_user_negative_dimensions', {
      p_user_id: userId,
      p_days_back: 30,
      p_min_count: 1,
    })
    if (error) {
      console.error('[trinity] get_user_negative_dimensions RPC failed:', error.message)
      return out
    }
    for (const row of (data || [])) {
      const map = out[row.dim_type]
      if (map) map.set(row.dim_value, Number(row.decayed_count) || 0)
    }
    return out
  } catch (err) {
    console.error('[trinity] loadNegativeDimensions exception:', err.message)
    return out
  }
}


// Phase 3.0 — loadGlobalImpressionBoosts deleted along with freshMult.
// article_global_impression_counts RPC still exists in DB but no callers.


// Phase 2.2 (2026-05-10). loadUserFunnelStats.
//
// Returns Map<vq_primary, { impressions, taps, deep_reads }> for the user's
// last 30 days. Feeds funnelMult in rerank() — a per-primary boost based on
// empirical-Bayes-shrunk tap rate × deep-read rate. Replaces dwellMult as
// the primary watch-time signal because the two-stage funnel separates
// "did the title earn a tap" from "did the body deliver".
async function loadUserFunnelStats(supabase, userId) {
  if (!userId) return new Map()
  try {
    const { data, error } = await supabase.rpc('user_funnel_stats', {
      p_user_id: userId,
      p_days_back: 30,
    })
    if (error) {
      console.error('[trinity] user_funnel_stats RPC failed:', error.message)
      return new Map()
    }
    const out = new Map()
    for (const row of (data || [])) {
      if (row.vq_primary != null) {
        out.set(row.vq_primary, {
          impressions: Number(row.impressions) || 0,
          taps: Number(row.taps) || 0,
          deep_reads: Number(row.deep_reads) || 0,
        })
      }
    }
    return out
  } catch (err) {
    console.error('[trinity] loadUserFunnelStats exception:', err.message)
    return new Map()
  }
}


// Phase 3.0 — loadUserMedianDwellByPrimary deleted along with dwellMult.
// loadUserFunnelStats (Phase 2.2) replaced it with the richer tap-then-read
// funnel signal. user_median_dwell_by_primary RPC still exists in DB but
// no callers.


// Phase 3.1 (2026-05-10). loadUserActionRates.
//
// Returns per-user empirical rates of explicit positive actions, used by
// the X-style v1 ranker as P(action) baselines. Read in last 30 days,
// normalized to per-impression rate (n_action / n_total_events).
async function loadUserActionRates(supabase, userId) {
  if (!userId) return {}
  try {
    const { data, error } = await supabase
      .from('user_article_events')
      .select('event_type')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(20000)
    if (error || !Array.isArray(data) || data.length === 0) return {}
    const counts = {}
    for (const r of data) {
      counts[r.event_type] = (counts[r.event_type] || 0) + 1
    }
    const total = data.length
    if (total === 0) return {}
    return {
      likeRate:        (counts.article_liked   || 0) / total,
      saveRate:        (counts.article_saved   || 0) / total,
      revisitRate:     (counts.article_revisit || 0) / total,
      shareRate:       (counts.article_shared  || 0) / total,
      moreLikeThisRate: (counts.article_more_like_this || 0) / total,
      entityTapRate:   (counts.entity_tap || 0) / total,
      chipTapRate:     (counts.entity_chip_tap || 0) / total,
      detailViewRate:  (counts.article_detail_view || 0) / total,
      skipRate:        (counts.article_skipped || 0) / total,
      notInterestedRate: (counts.article_not_interested || 0) / total,
    }
  } catch (err) {
    console.error('[trinity] loadUserActionRates failed:', err.message)
    return {}
  }
}


// Phase 3.1 (2026-05-10). loadUserFollowedAuthors.
//
// Returns Set<author_id> the user follows. Used by v1 ranker as
// P(follow_publisher) — 1.0 when set, 0.001 baseline otherwise.
async function loadUserFollowedAuthors(supabase, userId) {
  if (!userId) return new Set()
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('publisher_id')
      .eq('user_id', userId)
      .limit(500)
    if (error || !Array.isArray(data)) return new Set()
    return new Set(data.map(r => r.publisher_id).filter(Boolean))
  } catch (err) {
    console.error('[trinity] loadUserFollowedAuthors failed:', err.message)
    return new Set()
  }
}


// Phase 3.1 (2026-05-10). loadUserOnboardingTags.
//
// Returns Set<lowercase_tag> derived from the user's followed_topics +
// the ONBOARDING_TOPIC_MAP tag expansion. Used by v1 ranker as the
// onboarding-interest floor multiplier (1.3× when article matches a
// declared interest, 1.0× otherwise, NEVER decays).
async function loadUserOnboardingTags(supabase, userId) {
  if (!userId) return new Set()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('followed_topics')
      .eq('id', userId)
      .single()
    if (error || !data || !Array.isArray(data.followed_topics)) return new Set()
    const out = new Set()
    for (const code of data.followed_topics) {
      const meta = ONBOARDING_TOPIC_MAP[code]
      if (meta && Array.isArray(meta.tags)) {
        for (const t of meta.tags) out.add(t.toLowerCase())
      }
    }
    return out
  } catch (err) {
    console.error('[trinity] loadUserOnboardingTags failed:', err.message)
    return new Set()
  }
}


// Phoenix Phase 6.B (2026-05-09). loadHourPrimaryBoosts.
//
// Source: Long-Term Interest Clock (LIC, arxiv:2501.15817), Douyin
// production +0.122% active days. Time-of-day interests vary (K-pop at
// night, NFL Monday morning, work-news at 9am).
//
// Returns Map<vq_primary, multiplier> in [1.0, 1.3]. Multiplier scales by
// the user's engage-rate at the current hour relative to baseline 0.20.
// Primaries with strong hour-engagement get up to 1.3× boost; others 1.0.
// Cold-start: <5 events at this hour → empty Map (no boost, no penalty).
async function loadHourPrimaryBoosts(supabase, userId) {
  if (!userId) return new Map()
  try {
    const hourUTC = new Date().getUTCHours()
    const { data, error } = await supabase.rpc('user_hour_primary_stats', {
      p_user_id: userId,
      p_hour_of_day: hourUTC,
      p_days_back: 21,
      p_min_total: 5,
    })
    if (error) {
      console.error('[trinity] user_hour_primary_stats RPC failed:', error.message)
      return new Map()
    }
    const out = new Map()
    for (const row of (data || [])) {
      const rate = Number(row.engage_rate) || 0
      // 0.20 baseline (typical engage rate). Scale: rate 0.20 → 1.0×,
      // rate 0.50 → 1.15×, rate 0.80+ → 1.3× ceiling.
      const boost = Math.max(1.0, Math.min(1.3, 1.0 + (rate - 0.20) * 0.5))
      if (boost > 1.0) out.set(row.vq_primary, boost)
    }
    return out
  } catch (err) {
    console.error('[trinity] loadHourPrimaryBoosts exception:', err.message)
    return new Map()
  }
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

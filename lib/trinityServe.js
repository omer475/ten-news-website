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
// Set RANKER_VERSION=v1 in env to force-enable for all users; v0 to force-
// disable. When unset, Phase 2.5 (2026-05-11) per-user canary bucketing
// kicks in via pickRankerVersion below: deterministic FNV-1a hash of userId
// mod 1000; first RANKER_V1_CANARY_PCT promille of users get v1.
//
// 2026-05-12: disabled (was 10). The current ranker_v1_model.json was trained
// with wrong-sign coefficients on dominant features (cluster_fit=-0.24 in
// p_tap, -1.32 in p_save; is_followed_author=-0.10; log_expected_read=-0.17)
// and the p_save head has 0.23% positive class (16 positives / 6881). The
// canary was actively penalizing followed creators and good topic fits for
// 10% of users. Re-enable only after retraining with sign-validated heads
// and per-head AUC ≥ 0.6 on held-out data.
const RANKER_V1_CANARY_PCT = 0

export function pickRankerVersion(userId) {
  const env = process.env.RANKER_VERSION
  if (env === 'v0' || env === 'v1') return env  // explicit override
  if (!userId) return 'v0'                       // guests always v0 (no signal yet)
  // FNV-1a 32-bit hash → bucket in [0, 999].
  let hash = 2166136261 >>> 0
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return (hash % 1000) < (RANKER_V1_CANARY_PCT * 10) ? 'v1' : 'v0'
}
import {
  buildHistograms,
  writeHistogramCache,
  trinityLT,
  exploreArm,
  retrieveFollowed,
  retrievePersonalPerPrimary,
  LT_EMA_RATE,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  retrieveCandidatesAdaptive,
  retrievePersonalizedFresh,
  topPrimariesFromHistogram,
  primariesAboveThreshold,
  allocatePerPrimaryBudgets,
  getInterestTiers,
  composeWithBudgets,
  applyDiversityDiscount,
  assignStoryClusters,
  classifyPastEmbeddingsToClusters,
  computeSkipPenalty,
  pinPersonalToTopSlots,
  applyEventCap,
  CROSS_SESSION_EVENT_DEMOTE,
  recencyWeightForArticle,
  adaptiveThresholds,
  SAME_TAG_TODAY_WINDOW_HOURS,
  FRESH_TOP_PRIMARIES,
  FRESH_MIN_SCORE,
  FRESH_WINDOW_H,
} from './trinity.js'
import { loadSessionExposure, bumpSessionExposure } from './sessionExposure.js'

const COLD_START_QUALIFYING_FLOOR = 50
const FINAL_FEED_SIZE = 20
const PER_M_LIMIT = 12
const PER_LT_LIMIT = 8
const PER_EXPLORE_LIMIT = 4
const FRESH_POOL_LIMIT = 80   // v5: was 60
const TRENDING_POOL_SIZE = 100

// 2026-05-18 — weight-proportional retrieval allocation for trinity-personal.
//
// Pre-change behavior: every qualifying primary received perPrimaryLimit=20
// candidates uniformly. Trinity paper (arxiv:2402.02842) Algorithm 2 and
// Pinterest PinnerSage (arxiv:2007.03634) both allocate retrieval proportional
// to histogram weight; we were the outlier. Heavy-user audit (test user
// 5082a1df, Trump-China cycle May 14) showed Tech rank-1 h1=2133 and China
// rank-7 h1=552 each contributing 20 candidates, so score-chain suppression
// of rank-7 simply surfaced the next weak topic instead of more Tech.
//
// New behavior: allocatePerPrimaryBudgets(h1, primaries, { totalBudget=90 })
// returns a Map<primary, candidateLimit> with sum ≈ totalBudget. Top-h1
// primary gets ~30 slots, median primary ~8, weakest ~2.
//
// Env override TRINITY_PERSONAL_TOTAL_BUDGET for live tuning without redeploy.
//
// 2026-05-20 (PR12) — raised 90 → 150. Production audit log line:
//   [trinity.personal] primariesIn=50 candidates=50 alloc=[1,1,1,1,1] sum=50
// showed weight-proportional allocation was BYPASSED for users with 50
// qualifying primaries. `allocatePerPrimaryBudgets` has a fallback branch
// when `totalBudget < N × floor` (90 < 50 × 2 = 100): every primary gets
// exactly 1 candidate, h1 weight ignored. With 150 budget, 20 × 2 = 40 ≤ 150,
// so weight-proportional math runs and the heavy primaries get a big share.
// Combined with the primary cap drop below (50 → 20).
const PERSONAL_TOTAL_BUDGET = Math.max(
  10,
  Number(process.env.TRINITY_PERSONAL_TOTAL_BUDGET) || 150
)
const PERSONAL_PER_PRIMARY_FLOOR = 2
const PERSONAL_PER_PRIMARY_CAP = 40

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

// Slot budgets per retriever (20-slate). Sum = FINAL_FEED_SIZE.
//
// 2026-05-13 (composition cleanup): trinity-follow dropped from main feed.
// Following has its own tab (/api/feed/following endpoint, PR #150). Per
// TikTok / Instagram / Threads transparency reports, the For You feed serves
// minimal raw follow content (~5-10%) — followed creators surface via the
// Personal / Fresh pools through creator-affinity boost (mig 119) when their
// content matches the user's taste. The 3 slots previously reserved for
// follow are reallocated to Personal (the highest-engaging bucket per
// 2026-05-13 audit: 57% post-mig-119).
//
// trending-fallback also dropped (was the 7-day backup pool when personal
// came up under-budget). With pool-priority backfill, personal/fresh refill
// their own deficits — no separate fallback pool needed.
const SLOT_BUDGETS = {
  'trinity-fresh':    4,
  'trinity-personal': 10,
  'trinity-lt':       3,
  'explore':          3,
}

// 2026-05-17 cleanup: engagementAwareSlotBudgets was supposed to read
// `recentEngagementZ` from the caller (bored / neutral / engaged) and shift
// slot allocations between exploit and explore. In practice the iOS client
// never computes the signal — every prod request defaulted to z=0 and the
// neutral branch always won. The branched code was dead weight.
//
// Function kept callable (1-arg signature) so phaseAwareSlotBudgets's
// mid-user branch can still invoke it without a separate code path. Always
// returns SLOT_BUDGETS now; if we ever wire iOS to compute z, restore the
// branches from git history.
export function engagementAwareSlotBudgets(_recentEngagementZ) {
  return SLOT_BUDGETS
}

// redistributeFollowsBudget retired by composition cleanup 2026-05-13 — the
// trinity-follow bucket no longer exists in the main feed budget.

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

// 2026-05-17 cleanup: dropped the bored/engaged branches (recentEngagementZ
// was always 0 in prod — iOS never computed the signal). Kept the second
// parameter in the signature so existing callers and tests don't break;
// it's ignored. Two real phases now:
//   Phase 1 (new user, QC < 100):  30% explore, lighter personal — discover taste fast.
//   Phase 2 (mid, QC < 500):       SLOT_BUDGETS (engagementAware default).
//   Phase 3 (heavy, QC ≥ 500):     neutral heavy-user default.
export function phaseAwareSlotBudgets(qualifyingCount, _recentEngagementZ) {
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[0]) {
    return {
      'trinity-fresh':    4,
      'trinity-personal': 7,
      'trinity-lt':       3,
      'explore':          6,
    }
  }
  if (qualifyingCount < EXPLORE_PHASE_THRESHOLDS_QC[1]) {
    return engagementAwareSlotBudgets(0)
  }
  // 2026-05-17 (Wave 7): explore lowered 5 → 2 (25% → 10%). Until the
  // platform has more users, the explore arm's cluster_state Beta posterior
  // (which measures GLOBAL cluster engages/shows) is mostly noise — clusters
  // have tiny counts and Thompson Sampling is dominated by the prior. The
  // 3 freed slots go to personal (+2) and fresh (+1) where the user's own
  // history is the signal. Reverts to higher explore once user base grows.
  return {
    'trinity-fresh':    5,
    'trinity-personal': 11,
    'trinity-lt':       2,
    'explore':          2,      // 10% — small user base, explore Beta is noisy
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
    // 2026-05-17 cleanup: recentEngagementZ removed from opts — iOS never
    // computed the signal, so it was always 0 in production. See
    // engagementAwareSlotBudgets / phaseAwareSlotBudgets comments.
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
    { h1, h2, h2_strong, qualifyingCount, cooldownPrimaries: histogramCooldownPrimaries, source: histogramSource },
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
  // Phase 2.5 (2026-05-11): per-user ranker version via deterministic hash.
  // Same user → same version across requests. Skips the v1-only loaders for
  // v0 users to save RPC calls.
  const rankerVersion = pickRankerVersion(userId)

  // Phoenix Phase 6.B — time-of-day primary boost.
  // Phoenix Phase 6.C — ENF multi-granular negative feedback.
  // Phase 2.2 — tap-then-read funnel stats.
  // Phase 3.1 — for v1 ranker: per-user action rates + followed authors + onboarding tags.
  // Phase 1.3 (2026-05-11) — per-creator affinity for follow-pool rerank.
  // Fix B (2026-05-12): 3-axis session-exposure memory (primary + secondary
  // + source) loaded in parallel. Read-side decay applied in loadSessionExposure;
  // multipliers attached to each candidate _score below.
  const [hourPrimaryBoosts, negativeDimensions, userFunnelStats, userActionRates, userFollowedAuthors, userOnboardingTags, creatorAffinity, sessionExposure, userMedianReadSeconds] = await Promise.all([
    loadHourPrimaryBoosts(supabase, userId),
    loadNegativeDimensions(supabase, userId),
    loadUserFunnelStats(supabase, userId),
    rankerVersion === 'v1' ? loadUserActionRates(supabase, userId) : Promise.resolve({}),
    rankerVersion === 'v1' ? loadUserFollowedAuthors(supabase, userId) : Promise.resolve(new Set()),
    rankerVersion === 'v1' ? loadUserOnboardingTags(supabase, userId) : Promise.resolve(new Set()),
    loadUserCreatorAffinity(supabase, userId),
    loadSessionExposure(supabase, userId),
    // PR3 (2026-05-18) — reading-time fit. Returns NULL when user has < 20
    // events with valid view_seconds in last 30d; readTimeFit falls back
    // to 1.0× (no penalty).
    loadUserMedianReadSeconds(supabase, userId),
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
        `codebookId=${codebook?.id || 'none'} ` +
        `histogramSource=${histogramSource || 'unknown'}`
      )
    }
    // 2026-05-13 alarm: an established user dropping to cold-trending means
    // the RPC + retry + cache layers ALL came up empty. Use console.error so
    // it's visible above the noise in Vercel logs and a future
    // log-drain-to-Sentry will surface it as an issue immediately.
    if (userId && histogramSource === 'rpc-empty') {
      console.error(
        `[trinity.cold_alarm] user=${userId.slice(0, 8)} fell to cold-trending ` +
        `despite a valid auth context. RPC returned empty on both attempts ` +
        `AND no cache existed. Investigate trinity_build_histogram timeout / ` +
        `pool exhaustion.`
      )
    }
    const cold = await retrieveTrending(supabase, {
      hoursWindow: 7 * 24, excludeIds: seenIds, limit: TRENDING_POOL_SIZE,
    })
    for (const a of cold) a._retriever = 'cold-trending'
    const ranked = rerank(cold)
    let picked = mmrDiversify(ranked, feedSize)
    // P1+P3 fix: same X-style diversity discount on cold-start slate.
    picked = applyDiversityDiscount(picked)
    return {
      articles: picked,
      attribution: picked.map(() => 'cold-trending'),
      debug: {
        path: 'cold-start', qualifyingCount, codebookId: codebook.id,
        histogramSource,
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
  // personalPrimaries computed below; log size after.
  //
  // 2026-05-20 (PR12) — maxCap tightened 50 → 20. Production audit showed
  // heavy users qualify for 50 primaries above threshold, but the 30+
  // lowest-h1 primaries are noise (h1 = 50-200) and don't deserve retrieval
  // budget. With maxCap=50 + budget=90 + floor=2, allocatePerPrimaryBudgets'
  // pathological branch fired (50 × 2 = 100 > 90) giving every primary
  // exactly 1 candidate. Cap at top-20 by h1 weight; this keeps the user's
  // actual interests covered while letting weight-proportional allocation
  // give heavy primaries a big share (top-h1 → ~30 candidates, median ~5).
  const personalPrimaries = primariesAboveThreshold(h1, thresholds.tP, 20)
    .filter(p => !cooldownPrimaries.has(p))
  console.log(
    `[trinity.histogram] user=${userId?.slice(0, 8) || 'guest'} ` +
    `qc=${qualifyingCount} tP=${thresholds.tP} tS=${thresholds.tS} ` +
    `tier1=${tier1.length} tier2=${tier2.length} personalPrimaries=${personalPrimaries.length} ` +
    `cooldownPrimaries=${cooldownPrimaries.size} ` +
    `synth=${synthDebug.applied ? `yes(f=${synthDebug.factor?.toFixed?.(2) || synthDebug.factor})` : 'no'}`
  )

  // P2 fix (2026-05-12). Replaced trinityM tier1/tier2 secondary-cluster
  // sampling with multi-vector ANN retrieval per primary (see
  // retrievePersonalPerPrimary in lib/trinity.js).
  //
  // 2026-05-12 — Personal primaries now selected by THRESHOLD, not rank.
  // Earlier code used top-N_M (=10) which silently capped heavy users:
  // audit showed primaries ranked 11-30 had 487 unseen quality articles
  // that the algorithm never queried, and on heavy-usage days the top-10
  // primaries returned 0 unseen articles → personal pool collapsed →
  // backfill flooded with follow/explore.
  //
  // Trinity paper (KDD 2024, Algorithm 1) specifies threshold-based
  // selection: every primary with h[c] >= Tp qualifies. Tp = 30 in the
  // paper, adaptively lowered for users with thin histories — exactly
  // what `thresholds.tP` already computes from `adaptiveThresholds()`.
  // No paper has a fixed top-N rank cap on the personal retriever.
  //
  // Pinterest (PinnerSage) does the same conceptually — stores 3-100
  // clusters per user, no fixed-rank ceiling, samples by importance.
  // We use deterministic threshold filter to match Trinity exactly.
  //
  // maxCap=50 is a latency guardrail: bounds ANN query fan-out for
  // pathological histograms. Typical users qualify in 3-40 primaries.
  // (personalPrimaries already computed above for logging — re-use it.)

  // Trinity-LT covers the long-tail (low-h² secondaries). Exclude clusters
  // whose primary is in the personalPrimaries set — those are already
  // covered by trinity-personal. Phoenix Phase 4.F: also exclude clusters
  // in the user's avoid set.
  const ltExcludeSet = new Set()
  const personalPrimarySet = new Set(personalPrimaries)
  for (let c2 = 0; c2 < codebook.parentMap.length; c2++) {
    if (personalPrimarySet.has(codebook.parentMap[c2])) ltExcludeSet.add(c2)
  }
  for (const c2 of avoidClusters) ltExcludeSet.add(c2)
  // 2026-05-17 (Wave 8): pass h2_strong instead of h2. Long-tail only
  // qualifies sub-clusters where the user has STRONG positive engagement
  // (explicit actions OR ratio >= 50% reads). Filters out clusters that
  // qualified solely from brief positive dwells (slow-scrolls). Matches
  // TikTok Trinity paper §3 long-behavior-sequence filter.
  const ltClusters = trinityLT(h2_strong, clusterState, articleCounts, Math.random, {
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
  // 2026-05-14 — pass negativeDimensions so the explore arm respects
  // seconds-fresh fast-skip signal (bumped on every <6s dwell via
  // track.js → bump_user_negative_dim RPC). Without this, the explore arm
  // only consulted the 60-day avoidClusters aggregate; skipping 4 wrestling
  // cards in the current session didn't influence the next slate's picks.
  // ENF (arxiv:2511.18700) and Kuaishou WTG (arxiv:2308.13249) both
  // describe seconds-fresh negative-signal propagation as the differentiator.
  const explClusters = exploreArm(
    h2, clusterState, articleCounts, exploreSlotsBudget * 3, Math.random,
    { parentMap: codebook.parentMap, todaysPrimaryCounts, avoidClusters, negativeDimensions }
  )

  // Fresh pool: ALL interest primaries × 48h (mig 119 / 2026-05-13). The
  // earlier FRESH_TOP_PRIMARIES=10 cap was arbitrary — it left primaries 11-N
  // invisible to the fresh retriever even when the user had genuine interest
  // weight in them. PR #156 already switched the personal pool to the same
  // threshold-based selection (Trinity KDD 2024 Algorithm 1 spec); this aligns
  // fresh with personal so both buckets see the user's full interest set.
  // `freshPrimariesAll` is also used downstream as the follow-pool's
  // onlyPrimaries filter — top-20 cap applied there is intentional.
  const freshPrimariesAll = primariesAboveThreshold(h1, thresholds.tP, 50)
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
    : primariesAboveThreshold(h1, thresholds.tP, 50)
  // 2026-05-13 (composition cleanup): retired the trinity-follow and
  // trending-fallback retrievals. Following has its own tab. Pool-priority
  // backfill (rewritten below) handles deficit when personal/fresh come up
  // under-budget — no need for a separate trending fallback pool.
  let [personalPool, ltResult, exploreResult, freshPool] = await Promise.all([
    // P2 fix (2026-05-12). Multi-vector ANN per primary. Returns up to
    // N_primaries × perPrimaryLimit candidates; light rank + dedup downstream.
    personalPrimaries.length && userId
      ? retrievePersonalPerPrimary(supabase, userId, personalPrimaries, {
          // 2026-05-19 — timeless retrieval. Was 48h hard cap which combined
          // with 2-day dedup mathematically guaranteed 0 candidates for daily
          // users. Recency decay (exp(-ln(2)·age/halfLife)) handles age, not
          // a hard cut. Matches TikTok / Pinterest / Instagram retrieval shape.
          // FRESH_WINDOW_H is env-overrideable via TRINITY_RETRIEVAL_WINDOW_H
          // (set to 48 to restore legacy behavior).
          hoursWindow: FRESH_WINDOW_H,
          minScore: 200,
          // 2026-05-18 — weight-proportional allocation replaces uniform=20.
          // Trinity paper Algorithm 2: sample by histogram weight, not flat.
          perPrimaryLimitMap: allocatePerPrimaryBudgets(h1, personalPrimaries, {
            totalBudget: PERSONAL_TOTAL_BUDGET,
            perPrimaryFloor: PERSONAL_PER_PRIMARY_FLOOR,
            perPrimaryCap: PERSONAL_PER_PRIMARY_CAP,
          }),
          excludeIds: seenIds,
        })
      : Promise.resolve([]),
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
          excludeIds: seenIds, limit: FRESH_POOL_LIMIT * 2, userId, minScore: 300,
        })
      : Promise.resolve([]),
  ])

  // Stamp retriever identity on each pool item; used by attribution
  // downstream + per-pool diversity discount in compose.
  stampPool(freshPool,         'trinity-fresh')
  stampPool(personalPool,      'trinity-personal')
  stampPool(ltResult.pool,     'trinity-lt')
  stampPool(exploreResult.pool,'explore')

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
  personalPool       = dedupNearDuplicates(personalPool || [])
  ltResult           = { ...ltResult,     pool: dedupNearDuplicates(ltResult.pool || []) }
  exploreResult      = { ...exploreResult, pool: dedupNearDuplicates(exploreResult.pool || []) }

  // 2026-05-17 cleanup: removed `await attachRedundancyScores(...)` call.
  // The AI pipeline never populates published_articles.redundancy_adjusted_score
  // (each article is scored independently, no view of siblings), so the
  // attach-and-read path was always falling through to ai_final_score.
  // Cross-story protection lives in applyDiversityDiscount story axis instead.

  // Phase 2.2 (2026-05-11) — light ranker prune. Cheap heuristic gate that
  // drops each large pool to top-50 before the heavy rerank runs. Mirrors
  // X's retrieval → light-ranker → heavy-ranker 3-stage pipeline. Skip for
  // explore (histogram-fit zeroes out unfamiliar primaries by design — kills
  // the explore arm) and trinity-follow (pool already ≤ 30, no pruning gain).
  const lightCtx = { h1 }
  freshPool          = lightRank(freshPool,          lightCtx, 50)
  // trinity-personal can return up to N_primaries × perPrimaryLimit candidates.
  // Light-rank prune to 60 (slightly higher than other pools because it covers
  // many primaries — more diverse content survives the cut).
  personalPool       = lightRank(personalPool,       lightCtx, 60)
  ltResult           = { ...ltResult,     pool: lightRank(ltResult.pool,     lightCtx, 50) }
  // exploreResult deliberately skipped (histogram-fit would kill explore).

  const allCandidates = [
    ...freshPool, ...personalPool,
    ...ltResult.pool, ...exploreResult.pool,
  ]
  // 2026-05-17 (Wave 4): replaced loadRecentEventIds (24h pipeline-event_id
  // lookup, only fired on 29% of articles with event_ids) with
  // loadRecentImpressionEmbeddings (no time window, rolling buffer of last
  // 200 impressions joined with their embeddings). Cluster-based decay
  // matches twitter/the-algorithm ImpressedImageClusterBasedListwiseRescoringProvider
  // — count of impressions per cluster, no clock involved.
  // Wave 9 (2026-05-17): load skip embeddings in parallel for the
  // rerank skipPenalty input. Last 200 fast-skipped article embeddings.
  const [recentImpressionEmbeddings, categoryMultipliers, skipEmbeddings] = await Promise.all([
    loadRecentImpressionEmbeddings(supabase, userId),
    loadCategoryMultipliers(supabase, userId),
    loadRecentSkipEmbeddings(supabase, userId),
  ])
  // Event-id attach still needed for applyEventCap (1-per-event_id hard cap).
  await attachWorldEventIds(supabase, allCandidates)

  // Phase 3.0 (2026-05-10): freshMult / exploreImpressionBoosts deleted.
  // The explore-only cold-content boost (Phase 7.B) was a tiny-scope tweak;
  // re-add as a learned head later if it shows up in offline analysis.

  // Rerank EACH pool independently. Cross-pool ordering happens in
  // composeWithBudgets via slot budgets, not a global score sort.
  //
  // Phase 3.1 — v1 X-style ranker (additive Σ weight × P(action) + policy
  // multipliers) is gated by pickRankerVersion (Phase 2.5 — per-user hash
  // bucketing for canary rollout). v0 keeps the legacy 9-multiplier rerank.
  console.log(`[trinity.ranker] user=${userId?.slice(0, 8) || 'guest'} version=${rankerVersion}`)
  // Fix B observability — per-request session-exposure stats.
  console.log(
    `[trinity.exposure] user=${userId?.slice(0, 8) || 'guest'} ` +
    `primaryEntries=${sessionExposure.stats.primaryCount} ` +
    `secondaryEntries=${sessionExposure.stats.secondaryCount} ` +
    `sourceEntries=${sessionExposure.stats.sourceCount}`
  )
  const scorer = rankerVersion === 'v1' ? rerankV1 : rerank
  // 2026-05-17 (Wave 4): dropped `recentEventIds` from rerankOpts.
  // The 24h time-window event-id demote in rerank is removed; cross-slate
  // memory is now handled by applyDiversityDiscount + recentClusterCounts
  // (cluster-count decay, no time window).
  const rerankOpts = rankerVersion === 'v1'
    ? {
        userActionRates, userFollowedAuthors, userOnboardingTags,
        userFunnelStats, negativeDimensions, hourPrimaryBoosts,
        categoryMultipliers, todaysPrimaryCounts,
        creatorAffinity,  // Phase 1.3
        skipEmbeddings,   // Wave 9
      }
    : { categoryMultipliers, hourPrimaryBoosts, negativeDimensions, userFunnelStats, todaysPrimaryCounts, creatorAffinity, h1, h2, skipEmbeddings, userMedianReadSeconds }
  const freshRanked = scorer(freshPool, rerankOpts)
  const personalRanked = scorer(personalPool, rerankOpts)
  const ltRanked = scorer(ltResult.pool, rerankOpts)
  const exploreRanked = scorer(exploreResult.pool, rerankOpts)

  // 3-axis session-exposure multiplier (Kuaishou tri-level fatigue model).
  // 2026-05-13: primary axis disabled in sessionExposure.js — X / Instagram /
  // Threads don't apply per-topic intra-session decay on text feeds; it's
  // a Kuaishou-style video-platform pattern that over-discounts narrow-taste
  // users' core interest. Secondary + source axes still apply (those still
  // catch genuine over-serving of sub-clusters and publishers).
  const applyExposure = (arr) => {
    for (const it of arr) {
      const m = sessionExposure.multiplierFor(it)
      if (m !== 1.0) it._score = (it._score || 0) * m
    }
    arr.sort((a, b) => (b._score || 0) - (a._score || 0))
    return arr
  }
  applyExposure(freshRanked); applyExposure(personalRanked); applyExposure(ltRanked)
  applyExposure(exploreRanked)

  // Phase-aware + engagement-Z aware slot budgets. 2026-05-13: follow +
  // trending-fallback retired; redistributeFollowsBudget no longer needed.
  const baseBudgets = phaseAwareSlotBudgets(qualifyingCount)

  // Scale budgets if caller asked for non-default feedSize.
  const scale = feedSize / FINAL_FEED_SIZE
  const scaledBudgets = scaleBudgets(baseBudgets, scale, feedSize)

  // Compose: round-robin across pools, honoring budgets, then diversity-
  // discounted greedy backfill from non-hardCap pools. 2026-05-13: dropped
  // the 2× over-fetch (`feedSize * 2`) — the over-fetch only existed to feed
  // MMR; MMR is now removed, so we compose exactly feedSize cards.
  //
  // explore stays hardCap=true so empty personalized pools can't silently
  // turn into a 90% explore feed.
  const overFetchTarget = feedSize

  // P5 fix (2026-05-12): stamp `_storyClusterId` on every candidate via
  // online single-linkage clustering on `embedding_minilm_vec`.
  const allRankedForCluster = [
    ...freshRanked, ...personalRanked, ...ltRanked, ...exploreRanked,
  ]
  assignStoryClusters(allRankedForCluster)

  // 2026-05-17 (Wave 4): cross-slate story-cluster decay. Classify the
  // user's last 200 impression embeddings into the current cluster
  // centroids; the resulting Map<storyClusterId, count> seeds the story
  // axis of applyDiversityDiscount so a slate that just served 5 cards in
  // cluster c47 starts the next slate with axisCounts[story][c47] = 5.
  // Pattern from twitter/the-algorithm
  // ImpressedImageClusterBasedListwiseRescoringProvider.scala. No time
  // window — old impressions naturally fall out of the rolling-200 buffer
  // as new ones come in.
  const recentClusterCounts = classifyPastEmbeddingsToClusters(
    allRankedForCluster,
    recentImpressionEmbeddings,
  )

  const composed = composeWithBudgets([
    { name: 'trinity-fresh',    items: freshRanked,    budget: scaledBudgets['trinity-fresh'] || 0 },
    { name: 'trinity-personal', items: personalRanked, budget: scaledBudgets['trinity-personal'] || 0 },
    { name: 'trinity-lt',       items: ltRanked,       budget: scaledBudgets['trinity-lt'] || 0 },
    { name: 'explore',          items: exploreRanked,  budget: scaledBudgets['explore'] || 0, hardCap: true },
  ], overFetchTarget)

  // 2026-05-17 (Wave 4): true position-aware listwise rescoring (X
  // ListwiseRescoringProvider pattern: at each slot, pick max-adjusted
  // candidate; increment axisCounts for the pick before the next slot).
  // Axes: story, primary, source, author. Story axis seeded with
  // cross-slate impression counts so back-to-back slates can't reshow
  // the same story cluster.
  //
  // Replaces the prior 2-pass shape (sort by raw score, apply discounts
  // in that order, re-sort) and the pinPersonalToTopSlots hack (which
  // caused same-primary cards at slots 3-4, audit Session A+B slate 1).
  let slate = applyDiversityDiscount(composed, { recentClusterCounts })

  // Story-cluster cap (1 per world_event_id). Strict drop — kept as
  // belt-and-suspenders. Pipeline event_id coverage is only ~29% of
  // articles so this catches the obvious dupes; cluster decay above
  // handles the rest including all the no-event-id articles.
  slate = applyEventCap(slate)
  // 2026-05-17 (Wave 4): dropped pinPersonalToTopSlots call. Personal-
  // pool cards now rise naturally via the rerank chain (interestStrength
  // multiplier + listwise rescoring places them at the top without
  // forcing same-primary adjacency). pinPersonalToTopSlots remains
  // exported for back-compat with tests; no callers in production code.

  // 2026-05-13 (composition cleanup): retired the cross-pool MMR step.
  //
  // Why: X / Threads / Instagram / TikTok do NOT apply text-embedding MMR.
  // X uses 5 axis-based diversity providers (author, candidate source, image
  // cluster, media cluster, author decay) — never text cosine. The MMR layer
  // here was a 4th similarity check stacked on top of three earlier ones
  // (dedupNearDuplicates 0.92 per-pool catches AP/Reuters wire pickups;
  // applyDiversityDiscount soft-discounts on story/primary/source axes;
  // applyEventCap drops 1-per-world_event_id Google-News-style). With those
  // three already running, MMR's only effect was killing same-topic-different-
  // article content that's exactly what the user wants (audit 2026-05-13:
  // personal pool dropped from budget 8 to 2 cards per slate because MMR
  // rejected the 6 remaining personal cards as too-similar to each other —
  // which is the entire point of "personal").
  //
  // After dropping MMR, the slate output of compose IS the final slate, as
  // long as it reached feedSize. If under-budget pools left a deficit,
  // backfillToTarget below fills pool-by-pool from the same pools that fed
  // compose.
  if (slate.length < feedSize) {
    // 2026-05-13: pool-priority fill (was raw-score sort).
    // 2026-05-17 (Wave 5): when explore underdelivers, absorb the deficit
    // into the personal pool's budget BEFORE backfill. Pre-change behavior:
    // explore returned 2 of 6 budgeted cards → 4-card deficit fell to LT
    // overflow → LT took slots 0-2 (NBA/Fashion/foreign politics)
    // (audit Session B slate 1). New behavior: personal absorbs the explore
    // deficit so the gap is filled with user's actual interests instead of
    // long-tail content.
    const exploreInSlate = slate.filter(a =>
      (a._retrieverTier || a._retriever) === 'explore'
    ).length
    const exploreDeficit = Math.max(0, (scaledBudgets['explore'] || 0) - exploreInSlate)
    const personalBackfillBudget = (scaledBudgets['trinity-personal'] || 0) + exploreDeficit
    const slateBefore = slate.length
    slate = backfillToTarget(slate, [
      { name: 'trinity-personal', items: personalRanked, budget: personalBackfillBudget },
      { name: 'trinity-fresh',    items: freshRanked,    budget: scaledBudgets['trinity-fresh']    || 0 },
      { name: 'trinity-lt',       items: ltRanked,       budget: scaledBudgets['trinity-lt']       || 0 },
    ], feedSize)
    // 2026-05-18 — Re-discount AFTER backfill so the secondary / story /
    // primary / source / author axes see the safety-net additions. Pre-fix
    // production audit (5082a1df, 15:21 UTC): backfilled LT cards landed
    // 8 articles from a single vq_secondary cluster in one slate because
    // applyDiversityDiscount ran BEFORE backfill — the post-backfill
    // additions skipped the diversity layer entirely.
    if (slate.length > slateBefore) {
      slate = applyDiversityDiscount(slate, { recentClusterCounts })
      slate = applyEventCap(slate)
    }
  }

  // EMA update for shown personalized clusters (M tiers + LT + fresh + follow).
  // Phoenix Phase 5.C+5.D (2026-05-09):
  //   * AWAIT both cluster_state mutations (Vercel kills lambda on return).
  //   * Use atomic bump_cluster_b_score RPC (migration 090) instead of
  //     JS-side read-modify-write upsert. Two concurrent requests now
  //     atomically compose their EMA updates instead of last-write-wins.
  const personalized = new Set(['trinity-personal', 'trinity-lt', 'trinity-fresh'])
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
    // Fix B (2026-05-12): write the 3-axis session-exposure log AFTER the
    // slate is finalized. Fire from inside Promise.all so it's awaited
    // before lambda returns (Vercel kills mid-flight requests on return).
    bumpSessionExposure(supabase, userId, slate),
  ])

  // Backfill _retriever from _retrieverTier so downstream attribution works.
  for (const a of slate) {
    if (!a._retriever && a._retrieverTier) a._retriever = a._retrieverTier
  }

  // 2026-05-13: write the last-known-good histogram to cache so a future
  // RPC failure can fall back to it instead of cold-trending. Only writes
  // when the histogram came from the live RPC (skips cache-source slates
  // to avoid feedback loops) and qc >= 50 (handled inside the helper).
  // Fire-and-forget — never awaited, never throws.
  if (histogramSource === 'live') {
    writeHistogramCache(supabase, userId, h1, h2, qualifyingCount, cooldownPrimaries)
      .catch(err => console.error('[trinity] cache write error:', err.message))
  }

  return {
    articles: slate,
    attribution: slate.map(a => a._retriever),
    debug: {
      path: 'trinity-v5', qualifyingCount, histogramSource,
      codebookId: codebook.id, thresholds,
      tier1, tier2,
      personalPrimaries, ltClusters,
      explClusters: explClusters.slice(0, exploreSlotsBudget * 3),
      freshPrimaries, freshCandidates: freshPool.length,
      personalCandidates: personalPool.length,
      cooldownPrimaries: Array.from(cooldownPrimaries),
      ltWindowH: ltResult.hoursWindow,
      exploreWindowH: exploreResult.hoursWindow,
      poolSize: composed.length,
      shownClustersCount: shownClusterIds.length,
      exploreServed: exploreShown.length,
      bucketCounts: countBuckets(slate),
      primaryCounts: countPrimaries(slate),
      // 2026-05-17 cleanup: recentEngagementZ removed (always 0 in prod).
      slotBudgetsUsed: baseBudgets,
      // 2026-05-17 (Wave 4): replaced recentEventIdsCount with cluster-count map size.
      recentClusterCountsSize: recentClusterCounts.size,
      recentImpressionEmbeddingsLoaded: recentImpressionEmbeddings.length,
      skipEmbeddingsLoaded: skipEmbeddings.length,
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


// Phase 2.1 (2026-05-11) — light ranker. Cheap heuristic prune stage that
// runs BEFORE the heavy rerank() / scoreV1() for each large pool.
//
// 2026-05-17 — per-primary stratified pruning added. Pre-change, the prune
// did a single global sort and took top-N. When primary 62 had 25 high-
// light-score candidates (Trump-Beijing news cycle), they took 25 of 60
// slots in the personal pool and crowded out primary 39 (user's #1 Tech)
// candidates entirely. Now: group by vq_primary, take perPrimaryCap from
// each group, then merge + global sort + slice to topN.
// Source: TikTok Trinity (KDD 2024) Algorithm 1 — one secondary cluster
// per primary at retrieval. We apply the same fairness at the prune stage.
//
// Pure JS, no DB calls. Uses only signals already loaded for heavy rerank:
//   * Article quality (ai_final_score), log-compressed
//   * Article age (recency via shelf_life half-life)
//   * Histogram fit (h1[primary] / max(h1)) — how much the cluster matches
//   * Soft seen-count decay
//
// Important: this is a PRUNE step, NOT a final ranker. The heavy ranker
// re-scores the survivors with the full feature set + learned weights.
//
// Caller should skip this for the explore pool (histogram-fit definition
// would zero out unfamiliar primaries by design, defeating the purpose of
// the explore arm) and the follow pool (already small, ≤30 candidates).
export function lightRank(candidates, ctx = {}, topN = 50) {
  if (!Array.isArray(candidates) || candidates.length <= topN) return candidates
  const { h1 } = ctx
  let maxH1 = 0
  if (h1 && h1.length) for (let i = 0; i < h1.length; i++) if (h1[i] > maxH1) maxH1 = h1[i]
  const now = Date.now()
  for (const a of candidates) {
    // 2026-05-17 cleanup: redundancy_adjusted_score column is never populated
    // by the AI pipeline (each article is scored alone, no view of siblings).
    // The `?? a.ai_final_score` fallback always fired. Now reads ai_final_score
    // directly. JS-side cross-story protection lives in applyDiversityDiscount
    // story axis (lib/trinity.js).
    const quality = Math.log1p(Number(a.ai_final_score ?? 0) / 100)
    const recency = recencyWeightForArticle(a, now)
    const fit = (h1 && a.vq_primary != null && maxH1 > 0)
      ? Math.max(0.1, h1[a.vq_primary] / maxH1)
      : 0.5
    const seen = seenDecay(a.seen_count)
    a._lightScore = quality * recency * fit * seen
  }
  // Per-primary stratified prune. Group by vq_primary; take perPrimaryCap
  // from each group; merge and slice to topN.
  const byPrimary = new Map()
  for (const a of candidates) {
    const p = a.vq_primary != null ? a.vq_primary : '__null__'
    if (!byPrimary.has(p)) byPrimary.set(p, [])
    byPrimary.get(p).push(a)
  }
  const numPrimaries = byPrimary.size || 1
  const perPrimaryCap = Math.max(2, Math.ceil(topN / numPrimaries))
  const survivors = []
  for (const group of byPrimary.values()) {
    group.sort((a, b) => (b._lightScore || 0) - (a._lightScore || 0))
    const take = Math.min(perPrimaryCap, group.length)
    for (let i = 0; i < take; i++) survivors.push(group[i])
  }
  // Global sort to honor topN cap (some primaries may contribute fewer
  // than perPrimaryCap candidates).
  survivors.sort((a, b) => (b._lightScore || 0) - (a._lightScore || 0))
  return survivors.slice(0, topN)
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
//   eventDemote  — REMOVED 2026-05-17 (Wave 4). Replaced by cross-slate
//                  cluster-count decay in applyDiversityDiscount.
//   catMult      — per-category engage rate, Beta-shrunk
//   seenMult     — smooth view-count attenuation
//   hourMult     — time-of-day primary boost
//   negMult      — ENF per-dimension fast-skip decay
//   funnelMult   — tap-then-read per-primary boost (Phase 2.2)
//   todayPenalty — same-tag-today (Phase 2.3)
//   interestStrength — h1[primary]/max(h1), floor 0.10 (added 2026-05-14, lowered 2026-05-17)
//   interestStrengthH2 — h2[secondary]/max(h2), floor 0.10 (added 2026-05-18).
//                  Trinity paper uses h² in scoring (Algorithm 2). The h1 fit
//                  catches "user doesn't care about Politics at all"; the h2
//                  fit catches "user reads US Politics but not Tamil Nadu
//                  state Politics" inside the same h1 cluster. Suppressed for
//                  the explore pool (unfamiliar clusters by design).
//                  Env flag TRINITY_INTEREST_FIT_H2 (default on).
//   skipPenalty  — Wave 9 embedding-based skip memory. For each candidate,
//                  count user's recent fast-skipped articles whose embedding
//                  has cosine ≥ 0.60 to it. Multiplier = 0.5^count.
//                  X InteractionGraphNegativeJob pattern, but content-similarity
//                  granularity (TikTok/Instagram Two-Tower idea).
export function rerank(candidates, opts = {}) {
  const now = Date.now()
  // 2026-05-17 (Wave 4): `recentEventIds` removed. The 24h pipeline-event_id
  // demote was starved (only 29% of articles have event_ids; first slate
  // of a fresh morning has empty memory). Replaced by cluster-count decay
  // in applyDiversityDiscount.
  const categoryMultipliers = opts.categoryMultipliers || null
  const hourPrimaryBoosts = opts.hourPrimaryBoosts instanceof Map ? opts.hourPrimaryBoosts : null
  const negDims = opts.negativeDimensions || null
  const todaysPrimaryCounts = opts.todaysPrimaryCounts instanceof Map
    ? opts.todaysPrimaryCounts
    : null
  const userFunnelStats = opts.userFunnelStats instanceof Map
    ? opts.userFunnelStats
    : null
  // Phase 1.3 (2026-05-11) — per-creator affinity, only applied to follow-pool.
  const creatorAffinity = opts.creatorAffinity instanceof Map ? opts.creatorAffinity : null
  // 2026-05-14 — relative-interest weighting. Before this, primaries that merely
  // qualified (h1 >= adaptive Tp ≈ 15-30) competed equally with the user's top
  // primaries in scoring. On news-event days (Trump-Beijing audit, S3 2026-05-14)
  // a rank-7 primary (h1=552 vs max 2119) dominated 10 of 25 slots because the
  // breaking-news supply scored 847 vs 682 for the user's actual top interests.
  // Sources:
  //   * Pinterest PinnerSage (KDD 2020, arxiv:2007.03634) §3.3 —
  //     importance-weighted cluster sampling, no floor.
  //   * Trinity (KDD 2024, arxiv:2402.02842) Algorithm 2 — long-tail sampler
  //     uses (β + h²)^α weighting, no floor.
  // 2026-05-17 — floor lowered 0.40 → 0.10. Audit (Session B 2026-05-16
  // 09:37) showed user's rank-6 primary 62 hit floor 0.40, but so did rank-25
  // primary 26 (NBA). Two interests four ranks apart competed on equal
  // footing; LT-pool NBA cards won top slots from personal-pool China cards.
  // Lowering the floor preserves the h/max(h) gradient — user's top primaries
  // dominate, distant primaries appear only when content is exceptional.
  const h1 = opts.h1 && opts.h1.length ? opts.h1 : null
  let maxH1 = 0
  if (h1) for (let i = 0; i < h1.length; i++) if (h1[i] > maxH1) maxH1 = h1[i]
  const INTEREST_STRENGTH_FLOOR = 0.10
  // 2026-05-18 — h2 (vq_secondary) interest fit. Trinity paper Algorithm 2
  // uses h² weighting in scoring. The flag is on by default; set
  // TRINITY_INTEREST_FIT_H2=0 to disable without redeploy.
  const h2EnvFlag = process.env.TRINITY_INTEREST_FIT_H2
  const interestFitH2Enabled = h2EnvFlag == null || (h2EnvFlag !== '0' && h2EnvFlag !== 'false')
  const h2 = (interestFitH2Enabled && opts.h2 && opts.h2.length) ? opts.h2 : null
  let maxH2 = 0
  if (h2) for (let i = 0; i < h2.length; i++) if (h2[i] > maxH2) maxH2 = h2[i]
  // Wave 9: skip-embedding penalty input.
  const skipEmbeddings = Array.isArray(opts.skipEmbeddings) ? opts.skipEmbeddings : null
  // PR3 (2026-05-18) — reading-time fit. User's typical session length
  // (median view_seconds over last 30d). Null/undefined → no penalty.
  // Gaussian σ=0.6 in log-space: a ratio of e^±0.6 ≈ 1.82× / 0.55× off
  // median lands at exp(-0.5) ≈ 0.61× multiplier. Floor 0.6 prevents
  // total wipeout for legitimate long-form pieces.
  const userMedianReadSeconds = (typeof opts.userMedianReadSeconds === 'number' && opts.userMedianReadSeconds > 0)
    ? opts.userMedianReadSeconds
    : null
  const READ_TIME_FIT_FLOOR = 0.6
  const READ_TIME_FIT_SIGMA_SQ = 0.36  // σ² = 0.6² in log-space
  for (const a of candidates) {
    const recency = recencyWeightForArticle(a, now)
    // Wave 1: dropped the _redundancyAdjustedScore read (pipeline column
    // is always NULL — AI scoring is per-article with no view of siblings).
    // Wave 4: dropped eventDemote (24h time-window pipeline-event_id lookup
    // was starved by 71% null-event_id coverage; replaced by cluster-count
    // cross-slate decay in applyDiversityDiscount). Cross-story protection
    // lives entirely in applyDiversityDiscount story axis now.
    const quality = Number(a.ai_final_score ?? 0)
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
      // Mig 119: switched 'source' → 'author' axis. Today+ is a social platform —
      // every author writes independently, so per-publisher penalties wrongly
      // group good writers with skipped ones. Old source rows decay out via the
      // 13.5-day half-life in get_user_negative_dimensions; keep the source line
      // active during the transition window. Defensive `.author` access for
      // legacy fixtures that don't pass the full shape.
      const authorSkips = (a.author_id && negDims.author)
        ? (negDims.author.get(String(a.author_id)) || 0)
        : 0
      const sourceSkips = (typeof a.source === 'string' && negDims.source)
        ? (negDims.source.get(a.source.toLowerCase()) || 0)
        : 0
      if (clusterSkips > 0) negMult *= 1 / (1 + clusterSkips * 0.5)
      if (primarySkips > 0) negMult *= 1 / (1 + primarySkips * 0.3)
      if (authorSkips > 0)  negMult *= 1 / (1 + authorSkips  * 0.4)
      if (sourceSkips > 0)  negMult *= 1 / (1 + sourceSkips  * 0.4)  // legacy, fades
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
    // Per-creator affinity. RealGraph-style boost for creators the user has
    // engaged with; demote for creators they ignore. Mig 119: removed the
    // _retriever === 'trinity-follow' gate. X's RealGraph applies author
    // affinity globally, not per-pool — when a creator the user likes shows
    // up in personal/fresh/lt via any retriever path, the boost should still
    // apply. Other retrievers are scoped by VQ cluster, but author affinity
    // is an orthogonal signal so there's no double-counting.
    let creatorAffinityMult = 1.0
    if (creatorAffinity && a.author_id) {
      const m = creatorAffinity.get(a.author_id)
      if (m != null) creatorAffinityMult = m
    }
    // Relative-interest weighting. See block comment above on rerank.
    let interestStrength = 1.0
    if (h1 && maxH1 > 0 && a.vq_primary != null) {
      const h = h1[a.vq_primary] || 0
      interestStrength = Math.max(INTEREST_STRENGTH_FLOOR, h / maxH1)
    }
    // 2026-05-18 — h2 (sub-topic) interest fit. Catches the "user reads US
    // Politics but not Tamil Nadu state politics" case inside a single h1
    // cluster. Suppressed for the explore pool because explore by definition
    // serves unfamiliar clusters (would otherwise crush every explore card).
    let interestStrengthH2 = 1.0
    if (h2 && maxH2 > 0 && a.vq_secondary != null && a._retriever !== 'explore') {
      const hs = h2[a.vq_secondary] || 0
      interestStrengthH2 = Math.max(INTEREST_STRENGTH_FLOOR, hs / maxH2)
    }
    // Wave 9: embedding-based skip penalty. For each candidate, count
    // user's recent fast-skipped articles whose embedding has cosine ≥
    // SKIP_PENALTY_THRESHOLD (0.60). Multiplier = 0.5^count. Handles the
    // Galatasaray case (skip NBA cards without blocking all Sports).
    let skipPenalty = 1.0
    if (skipEmbeddings && a.embedding_minilm_vec) {
      skipPenalty = computeSkipPenalty(a.embedding_minilm_vec, skipEmbeddings)
    }
    // PR3 (2026-05-18) — reading-time fit. Match article length to user's
    // typical session length. Gaussian in log-space: a 300s long-form piece
    // served to a 60s-median user gets ratio=5 → logRatio=ln(5)≈1.61 →
    // exp(-1.61²/0.72)≈0.027 → floor 0.6×. A 60s article gets 1.0×.
    // No penalty when median unknown (cold user) or expected_read_seconds
    // missing on the article.
    let readTimeFit = 1.0
    if (userMedianReadSeconds && a.expected_read_seconds && a.expected_read_seconds > 0) {
      const logRatio = Math.log(a.expected_read_seconds / userMedianReadSeconds)
      readTimeFit = Math.max(
        READ_TIME_FIT_FLOOR,
        Math.exp(-(logRatio * logRatio) / (2 * READ_TIME_FIT_SIGMA_SQ))
      )
    }
    // log-quality keeps the AI score commensurate with the other 0-1.5 multipliers.
    const qualityNorm = Math.log1p(quality / 100)
    a._score = qualityNorm * recency * catMult * seenMult * hourMult * negMult * funnelMult * todayPenalty * creatorAffinityMult * interestStrength * interestStrengthH2 * skipPenalty * readTimeFit
  }
  candidates.sort((a, b) => b._score - a._score)
  return candidates
}


// 2026-05-13 (composition cleanup): rewritten as pool-priority fill.
//
// Old behavior: collected overflow from all pools, sorted by raw _score, took
// the top N. That let LT cards win backfill slots even when Personal had
// higher priority (audit 2026-05-13: Personal pool budgeted 8 but stuck at 2
// because backfill kept pulling LT after MMR-equivalent drops).
//
// New behavior: caller passes `{ name, items, budget }[]` in priority order.
// For each pool in order, count how many items it already contributed to the
// slate. If under budget, pull more items from the pool (by score order) until
// the pool hits its budget OR the slate hits feedSize. Then move to the next
// pool. The order itself is the priority, not raw score.
//
// Matches industry: X's open-source home-mixer fills its In-Network slot
// budget before pulling Out-of-Network candidates. Pinterest similarly fills
// the per-cluster user-vector channels in priority order.
export function backfillToTarget(slate, pools, feedSize) {
  if (slate.length >= feedSize) return slate
  const out = slate.slice()
  const seenIds = new Set(out.map(a => a?.id).filter(id => id != null))

  // Count how many items each pool already contributed to the slate.
  const contributed = new Map()
  for (const it of out) {
    const k = it?._retrieverTier || it?._retriever
    if (k) contributed.set(k, (contributed.get(k) || 0) + 1)
  }

  for (const pool of pools) {
    if (out.length >= feedSize) break
    if (!pool || !Array.isArray(pool.items)) continue
    const have = contributed.get(pool.name) || 0
    const deficit = Math.max(0, (pool.budget || 0) - have)
    if (deficit === 0) continue
    let added = 0
    for (const item of pool.items) {
      if (added >= deficit) break
      if (out.length >= feedSize) break
      if (item == null || item.id == null) continue
      if (seenIds.has(item.id)) continue
      out.push({ ...item, _retrieverTier: pool.name })
      seenIds.add(item.id)
      added += 1
    }
    // Keep contributed in sync so the safety-net cap below can read an
    // accurate count (pre-PR4 bug: safety net allowed budget+2 EXTRA items
    // on top of the budgeted backfill above, dumping 8 LT cards when budget
    // was 3 and SAFETY_EXTRA=2 — the intent is 5 total, not 5 + 3 already).
    if (added > 0) contributed.set(pool.name, have + added)
  }

  // 2026-05-18 — CAPPED safety net (was unlimited).
  //
  // Pre-change behavior: when the budgeted backfill above couldn't reach
  // feedSize (heavy-user personal+fresh pools starved by lifetime dedup),
  // a "safety net" branch dumped UNLIMITED items from each pool in priority
  // order regardless of budget. Production audit (test user 5082a1df,
  // 2026-05-18 15:21 UTC): trinity-lt pool had ~600 candidates from
  // trinityLT cluster sampling, personal+fresh together delivered ~8 cards,
  // and the safety net then dumped 14+ LT cards to fill the 20-card slate —
  // including 8 articles from a single vq_secondary=170 (Ukraine war)
  // cluster that bypassed applyDiversityDiscount entirely (discount runs
  // BEFORE backfill in the call site, so safety-net additions never saw
  // the secondary-axis penalty added in PR2).
  //
  // New behavior: each pool may contribute at most `budget + SAFETY_EXTRA`
  // items in the safety net (was unlimited). LT with budget=3 caps at 5
  // safety-net contributions, not 17.
  const SAFETY_EXTRA = 2
  if (out.length < feedSize) {
    for (const pool of pools) {
      if (out.length >= feedSize) break
      if (!pool || !Array.isArray(pool.items)) continue
      const have = contributed.get(pool.name) || 0
      const safetyCap = (pool.budget || 0) + SAFETY_EXTRA
      if (have >= safetyCap) continue
      let added = 0
      for (const item of pool.items) {
        if (out.length >= feedSize) break
        if (have + added >= safetyCap) break
        if (item == null || item.id == null) continue
        if (seenIds.has(item.id)) continue
        out.push({ ...item, _retrieverTier: pool.name })
        seenIds.add(item.id)
        added += 1
      }
    }
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

// 2026-05-14 — ratio-to-best multiplier replaces absolute bands.
//
// Old ladder (kept as fallback for thin-data users): rate ≥ 0.18 → 1.00× /
// 0.14 → 0.85× / 0.10 → 0.65× / 0.07 → 0.40× / else 0.25×. Problem: this
// treats Sports 19.9% and Tech 34.1% identically (both ≥ 0.18 → 1.00×),
// even though the user engages with Tech 1.7× as often as Sports. Audit
// session 4 showed Sports landed at 32% of slate because the catMult
// couldn't separate "real interest" from "tolerated interest".
//
// New: each category's multiplier is its rate divided by the user's best
// category's rate. So Tech 34.1/34.1 = 1.00×, Sports 19.9/34.1 = 0.58×,
// Politics 18.8/34.1 = 0.55×, Entertainment 14.8/34.1 = 0.43×. Floor 0.30
// keeps small-but-real interests visible.
//
// Sources:
//   * PinnerSage (KDD 2020, arxiv:2007.03634) §3.3 — importance-weighted
//     cluster sampling, proportional to engagement signal.
//   * Trinity (KDD 2024, arxiv:2402.02842) Algorithm 2 — (β + h²)^α
//     weighting, same proportional shape applied per cluster.
//
// Fallback to old behavior when < 3 categories returned (max-rate
// denominator is unstable with thin data). Min sample is still gated by
// the RPC's p_min_total=30 filter.
const CATEGORY_MULTIPLIER_FLOOR = 0.30
const CATEGORY_MULTIPLIER_MIN_SAMPLE = 3

export function categoryMultiplierFromRate(rate, maxRate) {
  // Ratio-to-best path. Caller passes maxRate when ≥ MIN_SAMPLE categories
  // qualify. Floor protects weak-but-real interests.
  if (Number.isFinite(maxRate) && maxRate > 0) {
    return Math.max(CATEGORY_MULTIPLIER_FLOOR, rate / maxRate)
  }
  // Fallback (thin data): old absolute bands.
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
    // Pass 1: compute shrunk rate per category.
    const rates = []  // [category, shrunkRate]
    for (const row of (data || [])) {
      if (!row.category) continue
      const total = Number(row.total_impressions) || 0
      const engaged = Number(row.engaged) || 0
      const shrunkRate = (engaged + CATEGORY_BETA_ALPHA)
                       / (total + CATEGORY_BETA_ALPHA + CATEGORY_BETA_BETA)
      rates.push([row.category, shrunkRate])
    }
    // Pass 2: ratio-to-best (when ≥ MIN_SAMPLE) or fallback to absolute bands.
    const maxRate = rates.length >= CATEGORY_MULTIPLIER_MIN_SAMPLE
      ? Math.max(...rates.map(r => r[1]))
      : null
    for (const [category, shrunkRate] of rates) {
      out.set(category, categoryMultiplierFromRate(shrunkRate, maxRate))
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
// Returns { cluster: Map, source: Map, primary: Map, author: Map } where each
// Map is (dimension_value → time-decayed fast-skip count). Rerank computes
// per-candidate penalty by summing matched dimensions. Mig 119 added the
// `author` dim — `source` stays during the 13.5-day transition window while
// existing per-publisher rows decay out via get_user_negative_dimensions's
// 0.95/day decay.
async function loadNegativeDimensions(supabase, userId) {
  const out = { cluster: new Map(), source: new Map(), primary: new Map(), author: new Map() }
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


// PR3 (2026-05-18). loadUserMedianReadSeconds.
//
// Scalar percentile_cont(0.5) over last-30d user_article_events.view_seconds,
// bounded 5-600s, gated by n ≥ 20. RPC returns NULL when signal too thin;
// loader returns null in that case and rerank's readTimeFit defaults to 1.0
// (no penalty). Heavy users typically median 60-180s.
//
// Used by rerank() readTimeFit multiplier: penalize articles whose
// expected_read_seconds is far (in log-space) from this median.
//
// Text-social-specific signal. Not in TikTok / X / Instagram public docs
// because their content format doesn't have a meaningful "expected read
// time" dimension.
async function loadUserMedianReadSeconds(supabase, userId) {
  if (!userId) return null
  try {
    const { data, error } = await supabase.rpc('user_median_read_seconds', {
      p_user_id: userId,
      p_days_back: 30,
      p_min_events: 20,
    })
    if (error) {
      console.error('[trinity] user_median_read_seconds RPC failed:', error.message)
      return null
    }
    // RPC returns scalar numeric or NULL.
    if (data == null) return null
    const n = Number(data)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch (err) {
    console.error('[trinity] loadUserMedianReadSeconds exception:', err.message)
    return null
  }
}


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


// Phase 1.3 (2026-05-11). loadUserCreatorAffinity.
//
// Returns Map<author_id, multiplier ∈ [0.5, 1.5]> from the user_creator_affinity
// RPC (migration 108). Empirical-Bayes-shrunk per-author engagement rate,
// bounded so a single-event spike can't flip the score. Same Beta(5, 20)
// shrink + 0.20 baseline as loadUserFunnelStats — keeps the two boosts on a
// comparable scale.
//
// Used only for the trinity-follow retriever pool in rerank(). The
// X-style RealGraph analog: when the user has demonstrated affinity for a
// specific creator, their content gets up to 1.5×; when they've been shown
// repeatedly without engaging, down to 0.5×.
async function loadUserCreatorAffinity(supabase, userId) {
  if (!userId) return new Map()
  try {
    const { data, error } = await supabase.rpc('user_creator_affinity', {
      p_user_id: userId,
      p_days_back: 60,
    })
    if (error) {
      console.error('[trinity] user_creator_affinity RPC failed:', error.message)
      return new Map()
    }
    const out = new Map()
    for (const row of (data || [])) {
      if (!row.author_id) continue
      const impressions = Number(row.impressions) || 0
      const engagements = Number(row.engagements) || 0
      if (impressions < 3) continue
      // Beta(5, 20) shrunk engage rate. 0.20 baseline → multiplier 1.0×.
      const shrunk = (engagements + 5) / (impressions + 25)
      const mult = Math.max(0.5, Math.min(1.5, shrunk / 0.20))
      out.set(row.author_id, mult)
    }
    return out
  } catch (err) {
    console.error('[trinity] loadUserCreatorAffinity exception:', err.message)
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


// 2026-05-17 (Wave 4). loadRecentImpressionEmbeddings — returns the
// `embedding_minilm_vec` field for the user's last N impressions. Used as
// input to classifyPastEmbeddingsToClusters, which yields the
// recentClusterCounts Map that seeds applyDiversityDiscount's story-axis
// counter for cross-slate redundancy decay.
//
// No time window — uses a rolling buffer of the last 200 impressions.
// Old impressions naturally fall out as new ones are written. Pattern from
// twitter/the-algorithm ImpressedImageClusterBasedListwiseRescoringProvider
// — same idea (count of recent impressions per cluster, no clock).
//
// Returns an array of embedding values (raw — JSON string or array), to be
// parsed by classifyPastEmbeddingsToClusters. Empty array on any error or
// for guest users.
// 2026-05-17 (Wave 9, extended in Wave 10). loadRecentSkipEmbeddings —
// returns weighted skip-history for the rerank() skipPenalty multiplier.
//
// Wave 9 only captured `article_skipped` (dwell < 3s) and
// `article_not_interested`. But the user's actual dismissal pattern is
// 3-5 second views (read title → swipe). iOS classifies those as
// `article_view` (not `article_skipped`). Wave 9 missed those signals.
//
// Wave 10: apply the same dwell+ratio rule used in migration 124 to
// build skip-history. Each entry carries a weight:
//
//   FULL WEIGHT (1.0): clear rejection
//     • event_type = 'article_not_interested' (explicit hard reject)
//     • dwell < 3s (fast skip — Kuaishou WTG GVV negative band)
//     • ratio = dwell / expected_read_seconds < 0.20 (very low read)
//
//   HALF WEIGHT (0.5): soft rejection
//     • dwell ≥ 3s AND ratio 0.20–0.50 (read title, didn't engage)
//
//   NOT A SKIP: real read
//     • ratio ≥ 0.50 (excluded from input)
//
// Sources:
//   * Kuaishou WTG (CIKM 2023, arxiv:2308.13249) — read-ratio negative bands.
//   * twitter/the-algorithm InteractionGraphNegativeJob — per-user negative
//     signal aggregation across multiple event types.
//
// Returns array of { embedding, weight } objects (raw embedding for parsing
// inside computeSkipPenalty). Capped at `limit` entries; we overfetch from
// the events table because many will be filtered out (real reads).
async function loadRecentSkipEmbeddings(supabase, userId, limit = 200) {
  if (!userId) return []
  try {
    // Overfetch: many events will be filtered out (real reads, missing
    // embeddings, etc.). Pull 3× the limit from the events table.
    const fetchN = limit * 3
    const { data: events, error: e1 } = await supabase
      .from('user_article_events')
      .select('article_id, event_type, view_seconds')
      .eq('user_id', userId)
      .in('event_type', ['article_skipped', 'article_view', 'article_not_interested'])
      .order('created_at', { ascending: false })
      .limit(fetchN)
    if (e1 || !events || events.length === 0) return []

    const articleIds = Array.from(new Set(
      events.map(r => r.article_id).filter(Boolean)
    ))
    if (articleIds.length === 0) return []

    const { data: arts, error: e2 } = await supabase
      .from('published_articles')
      .select('id, embedding_minilm_vec, expected_read_seconds')
      .in('id', articleIds)
    if (e2 || !arts) return []

    const articleMap = new Map(arts.map(a => [a.id, a]))

    // Apply the dwell+ratio rule. Keep the first `limit` entries (events
    // are already ordered newest-first), drop the rest.
    const entries = []
    for (const ev of events) {
      if (entries.length >= limit) break
      const art = articleMap.get(ev.article_id)
      if (!art || !art.embedding_minilm_vec) continue
      const dwell = Number(ev.view_seconds) || 0
      const expected = Number(art.expected_read_seconds) || 0

      let weight = 0
      if (ev.event_type === 'article_not_interested') {
        weight = 1.0  // explicit hard reject
      } else if (dwell < 3.0) {
        weight = 1.0  // fast-skip threshold (Kuaishou WTG GVV)
      } else if (expected > 0) {
        const ratio = dwell / expected
        if (ratio < 0.20) weight = 1.0       // very low read → full skip
        else if (ratio < 0.50) weight = 0.5  // title glance → soft skip
        // ratio >= 0.50 → real read, weight stays 0 (excluded)
      } else {
        // Defensive: no expected_read_seconds — fall back to absolute seconds.
        if (dwell < 6.0) weight = 0.5  // 3-6s view without expected → soft skip
        // ≥6s without expected → real engagement (excluded)
      }

      if (weight > 0) {
        entries.push({ embedding: art.embedding_minilm_vec, weight })
      }
    }
    return entries
  } catch (err) {
    console.error('[trinity] loadRecentSkipEmbeddings failed:', err.message)
    return []
  }
}


async function loadRecentImpressionEmbeddings(supabase, userId, limit = 200) {
  if (!userId) return []
  try {
    const { data: impr, error: e1 } = await supabase
      .from('user_feed_impressions')
      .select('article_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (e1 || !impr || impr.length === 0) return []
    const articleIds = impr.map(r => r.article_id).filter(Boolean)
    if (articleIds.length === 0) return []
    // Fetch embeddings in one batched query.
    const { data: arts, error: e2 } = await supabase
      .from('published_articles')
      .select('id, embedding_minilm_vec')
      .in('id', articleIds)
    if (e2 || !arts) return []
    // Return just the embeddings (we don't need the ids downstream).
    return arts.map(a => a.embedding_minilm_vec).filter(e => e != null)
  } catch (err) {
    console.error('[trinity] loadRecentImpressionEmbeddings failed:', err.message)
    return []
  }
}

// 2026-05-17 cleanup: attachRedundancyScores deleted. The AI pipeline cannot
// compute event-cluster redundancy (each article is scored alone, no view of
// siblings). The column `published_articles.redundancy_adjusted_score` was
// always NULL in production. JS-side story-cluster decay in
// applyDiversityDiscount handles cross-story redundancy instead.


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

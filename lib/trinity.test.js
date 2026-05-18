// Unit tests for the Trinity algorithms.
// Run with: node lib/trinity.test.js

import {
  trinityM,
  trinityLT,
  exploreArm,
  MAX_EXPLORE_PER_PRIMARY,
  emaUpdates,
  adaptiveThresholds,
  recencyWeightForArticle,
  topPrimariesFromHistogram,
  getInterestTiers,
  composeWithBudgets,
  applyPrimaryCap,
  applyDiversityDiscount,
  assignStoryClusters,
  classifyPastEmbeddingsToClusters,
  computeSkipPenalty,
  SKIP_PENALTY_THRESHOLD,
  SKIP_PENALTY_DECAY,
  STORY_CLUSTER_THRESHOLD,
  retrievePersonalPerPrimary,
  retrievePersonalizedFresh,
  pinPersonalToTopSlots,
  primariesAboveThreshold,
  allocatePerPrimaryBudgets,
  DIV_DECAY,
  DIV_FLOOR,
  ADAPTIVE_WINDOW_TIERS_H,
  STALE_AGE_DAYS,
  EXPLORE_SLOT_FRACTION,
  EXPLORE_BETA_PRIOR_ALPHA,
  EXPLORE_BETA_PRIOR_BETA,
  SAME_TAG_TODAY_PENALTY,
  SAME_TAG_TODAY_WINDOW_HOURS,
  NOT_INTERESTED_HISTOGRAM_DECREMENT,
  NOT_INTERESTED_COOLDOWN_HOURS,
  MAX_PER_PRIMARY,
  MAX_PER_PUBLISHER,
  MAX_PER_EVENT,
  TIER1_TOP_PRIMARIES,
  J_PRIMARY,
  K_SECONDARY,
  T_P,
  T_S,
  T_L,
  T_I,
  N_C,
  N_M,
  N_LT,
  HISTOGRAM_WINDOW,
} from './trinity.js'

let passed = 0
let failed = 0
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

const PARENT_MAP = (() => {
  const m = new Array(K_SECONDARY)
  for (let c2 = 0; c2 < K_SECONDARY; c2++) m[c2] = Math.floor(c2 / 8)
  return m
})()

function seededRng(seed = 0xC0FFEE) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}


function testAdaptiveThresholds() {
  let t = adaptiveThresholds(HISTOGRAM_WINDOW)
  assert(t.tP === T_P && t.tS === T_S,
    'adaptiveThresholds = paper at full-history',
    `got ${JSON.stringify(t)}`)
  // Phase 0.5 (2026-05-11): restored floors to 15/5 (KDD paper values).
  // Phoenix 1.6 had over-corrected to 3/2; that pinned tP/tS to the floor
  // for any user under ~250 qc, so the "adaptive" thresholds barely adapted.
  t = adaptiveThresholds(0)
  assert(t.tP === 15 && t.tS === 5,
    'adaptiveThresholds at QC=0 returns restored floors {tP:15, tS:5}',
    `got ${JSON.stringify(t)}`)
  t = adaptiveThresholds(50)
  assert(t.tP === 15 && t.tS === 5,
    'adaptiveThresholds respects 15/5 floor for light users',
    `got ${JSON.stringify(t)}`)
  t = adaptiveThresholds(1500)
  assert(t.tP > 15 && t.tP < T_P,
    'adaptiveThresholds scales above floor mid-range',
    `got ${JSON.stringify(t)}`)
}


function testTrinityM_hotspot() {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  for (const c1 of [3, 17, 42]) {
    h1[c1] = T_P + 5
    h2[c1 * 8] = T_S + 1
  }
  for (let c2 = 500; c2 < 520; c2++) h2[c2] = 1
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  const expectedFirstThree = new Set([3 * 8, 17 * 8, 42 * 8])
  const firstThreePicks = new Set(out.slice(0, 3))
  assert(out.length === N_M, 'trinity-m returns N_M picks with global pad',
    `got ${out.length}`)
  assert([...firstThreePicks].every(p => expectedFirstThree.has(p)),
    'trinity-m primary picks honour T_P / T_S')
}


function testTrinityM_oneRandomSecondaryPerPrimary() {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h1[5] = T_P + 1
  for (let s = 0; s < 8; s++) h2[5 * 8 + s] = T_S + 1
  const seen = new Set()
  for (let seed = 1; seed <= 50; seed++) {
    const rng = seededRng(seed * 31)
    const pick = trinityM(h1, h2, PARENT_MAP, rng)[0]
    seen.add(pick)
  }
  assert(seen.size >= 4,
    'trinity-m diversifies across seeds (one random secondary per primary)',
    `only saw ${seen.size} distinct picks`)
}


function testTrinityM_fallbackToArgmax() {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h1[10] = T_P + 5
  h2[10 * 8 + 0] = T_S - 1
  h2[10 * 8 + 3] = T_S - 5
  h2[10 * 8 + 7] = T_S - 2
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  assert(out[0] === 10 * 8 + 0,
    'trinity-m fallback picks argmax kid when none clear T_S',
    `got ${out[0]}`)
}


function testTrinityM_padFromGlobalLargest() {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h2[12] = 50
  h2[34] = 25
  h2[7]  = 12
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  assert(out.slice(0, 3).join(',') === '12,34,7',
    'trinity-m pads to N_M from global argmax h²',
    `got ${out.slice(0, 3)}`)
}


function testTrinityM_adaptiveThresholds() {
  // Sparse-history user has 4 primaries with h¹=16 (sparse but real). Their
  // top kids have h²=6.
  // Add a HIGH-h² cluster that paper thresholds would prefer when forced to
  // pad from global-largest (so the test can distinguish primary-path picks
  // from pad-path picks).
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  for (const c1 of [1, 2, 3, 4]) {
    h1[c1] = 16
    h2[c1 * 8] = 6
  }
  // Paper-thresholds: only the global-largest pad fires. Set up a clear
  // hierarchy so the pad path picks something OTHER than [8,16,24,32] first.
  h2[1000] = 100
  h2[1001] = 90
  h2[1002] = 80
  h2[1003] = 70

  const sparseT = adaptiveThresholds(600)
  const sparseOut = trinityM(h1, h2, PARENT_MAP, seededRng(1), sparseT)
  // First 4 picks should be from the primary-path (random kid of c1=1..4 = c2=8/16/24/32).
  const sparseFirst4 = sparseOut.slice(0, 4)
  const sparseHits = sparseFirst4.filter(c2 => [8, 16, 24, 32].includes(c2)).length
  assert(sparseHits >= 3,
    'trinity-m adaptive thresholds put primary-path picks first',
    `first-4 = ${sparseFirst4}, sparse-hits = ${sparseHits}`)

  const paperT = adaptiveThresholds(HISTOGRAM_WINDOW)
  const paperOut = trinityM(h1, h2, PARENT_MAP, seededRng(1), paperT)
  // First pick = global largest h² (1000). Then pad prefers DIFFERENT
  // primaries (1001/1002/1003 are all c1=125 children, so the new
  // pad-with-primary-spread skips them in pass 0 and picks c2's from other
  // primaries). 1001/1002/1003 land later via pass 1 if there's still room.
  assert(paperOut[0] === 1000,
    'trinity-m paper thresholds: global largest first',
    `first pick=${paperOut[0]}`)
  // Test setup has 8 c2's with h²>0 spread across 5 primaries (c1=125 has 4
  // children with h²>0; c1=1,2,3,4 have one each). Pad pass-0 should hit
  // all 5 distinct primaries before pass-1 backfills duplicates.
  const distinctPrimaries = new Set(paperOut.map(c2 => Math.floor(c2 / 8)))
  assert(distinctPrimaries.size === 5,
    'trinity-m paper thresholds: pad spreads across all available primaries',
    `distinctPrimaries=${distinctPrimaries.size} picks=${paperOut}`)
  // Earlier slots should be from DIFFERENT primaries (pass 0 wins).
  const firstFivePrimaries = new Set(paperOut.slice(0, 5).map(c2 => Math.floor(c2 / 8)))
  assert(firstFivePrimaries.size === 5,
    'trinity-m: first 5 picks span 5 distinct primaries (pass 0 dominates)',
    `first5primaries=${[...firstFivePrimaries]}`)
}


function testTrinityLT_basicSampling() {
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  const state = new Map()
  const lowClusters = []
  for (let c = 100; c < 140; c++) {
    h2[c] = T_L
    inv[c] = T_I + 1
    state.set(c, { b_score: 1e6 - c, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
    lowClusters.push(c)
  }
  const HIGH = 200
  h2[HIGH] = T_L + 200
  inv[HIGH] = T_I + 1
  state.set(HIGH, { b_score: 1e6 - HIGH, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  h2[300] = T_L - 1
  inv[300] = T_I + 1
  state.set(300, { b_score: 1e6 - 300, last_shown_at: new Date(0).toISOString(), shown_count: 0 })

  const sampled = new Map()
  for (let seed = 1; seed <= 200; seed++) {
    const out = trinityLT(h2, state, inv, seededRng(seed * 7))
    for (const c of out) sampled.set(c, (sampled.get(c) || 0) + 1)
  }
  assert(!sampled.has(300), 'trinity-lt excludes clusters below T_L',
    `300 sampled ${sampled.get(300)} times`)
  const high = sampled.get(HIGH) || 0
  const totalLow = lowClusters.reduce((s, c) => s + (sampled.get(c) || 0), 0)
  const avgLow = totalLow / lowClusters.length
  assert(high > avgLow * 1.5, 'trinity-lt prefers higher h² (α=0.75)',
    `high=${high} avgLow=${avgLow.toFixed(1)}`)
}


function testTrinityLT_excludesLowInventory() {
  const h2 = new Int32Array(K_SECONDARY)
  h2[200] = T_L + 5
  h2[201] = T_L + 5
  const inv = new Int32Array(K_SECONDARY)
  inv[200] = T_I + 5
  inv[201] = T_I - 1
  const state = new Map()
  state.set(200, { b_score: 100, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  state.set(201, { b_score: 100, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  let sampled201 = 0
  for (let seed = 1; seed <= 100; seed++) {
    const out = trinityLT(h2, state, inv, seededRng(seed))
    if (out.includes(201)) sampled201 += 1
  }
  assert(sampled201 === 0, 'trinity-lt drops clusters with inventory < T_I',
    `cluster 201 was sampled ${sampled201}/100`)
}


function testTrinityLT_returnsAtMostNLT() {
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  const state = new Map()
  for (let c = 300; c < 400; c++) {
    h2[c] = T_L + 2
    inv[c] = T_I + 1
    state.set(c, { b_score: 1000 + c, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  }
  const out = trinityLT(h2, state, inv, seededRng(42))
  assert(out.length === N_LT, 'trinity-lt returns exactly N_LT clusters', `got ${out.length}`)
}


function testEMA_dedupes() {
  const state = new Map()
  state.set(7, { b_score: 0, last_shown_at: new Date(Date.now() - 60_000).toISOString(), shown_count: 5 })
  const rows = emaUpdates(state, [7, 9, 7], Date.now())
  assert(rows.length === 2, 'ema dedupes shownClusterIds', `got ${rows.length}`)
  const update7 = rows.find(r => r.cluster_id === 7)
  assert(update7 && update7.b_score > 0, 'ema bumps b_score')
  const update9 = rows.find(r => r.cluster_id === 9)
  assert(update9 && update9.shown_count === 1, 'ema initialises new cluster shown_count')
}


testAdaptiveThresholds()
testTrinityM_hotspot()
testTrinityM_oneRandomSecondaryPerPrimary()
testTrinityM_fallbackToArgmax()
testTrinityM_padFromGlobalLargest()
testTrinityM_adaptiveThresholds()
testTrinityLT_basicSampling()
testTrinityLT_excludesLowInventory()
testTrinityLT_returnsAtMostNLT()
testEMA_dedupes()


// ─── v3 tests ──────────────────────────────────────────────────────────

function testRecency_shelfLifeAware() {
  const now = new Date('2026-05-02T13:00:00Z').getTime()
  // Breaking news shelf=1d. At 12h old, should be 0.5 (one half-life).
  const breakingArticle = {
    created_at: new Date(now - 12 * 3600 * 1000).toISOString(),
    shelf_life_days: 1,
  }
  const wB = recencyWeightForArticle(breakingArticle, now)
  assert(Math.abs(wB - 0.5) < 0.02,
    'recency: breaking @ 12h ≈ 0.5 (12h half-life)',
    `got ${wB.toFixed(3)}`)

  // Evergreen shelf=14d. At 5d (120h) old, half-life=168h → ~0.61
  const evergreenArticle = {
    created_at: new Date(now - 5 * 24 * 3600 * 1000).toISOString(),
    shelf_life_days: 14,
  }
  const wE = recencyWeightForArticle(evergreenArticle, now)
  assert(wE > 0.55 && wE < 0.7,
    'recency: 5-day-old evergreen still > 0.55 (was 0.10 at flat 36h half-life)',
    `got ${wE.toFixed(3)}`)
}


function testExploreArm_picksFromHzeroOnly() {
  const h2 = new Int32Array(K_SECONDARY)
  h2[100] = 5         // user has h² > 0 here — should NOT be explored
  h2[200] = 1
  const inv = new Int32Array(K_SECONDARY)
  inv[100] = 10; inv[200] = 10
  inv[500] = 10; inv[600] = 10; inv[700] = 10
  const state = new Map()
  state.set(500, { explore_engages: 5, explore_shows: 5, b_score: 0, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  state.set(600, { explore_engages: 0, explore_shows: 5, b_score: 0, last_shown_at: new Date(0).toISOString(), shown_count: 0 })

  const samples = new Map()
  for (let seed = 1; seed <= 200; seed++) {
    const rng = (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
    const picks = exploreArm(h2, state, inv, 1, rng)
    for (const c2 of picks) samples.set(c2, (samples.get(c2) || 0) + 1)
  }

  assert(!samples.has(100) && !samples.has(200),
    'exploreArm never picks clusters with h² > 0',
    `got picks for ${[...samples.keys()]}`)
  const c500 = samples.get(500) || 0
  const c600 = samples.get(600) || 0
  assert(c500 > c600 * 1.5,
    'exploreArm: high-engagement cluster wins more samples (Thompson Sampling)',
    `c500=${c500} c600=${c600}`)
}


function testTrinityLT_softExclusionFallback() {
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  const state = new Map()
  const userClusters = []
  for (let c = 100; c < 108; c++) {
    h2[c] = T_L + 5
    inv[c] = T_I + 1
    state.set(c, { b_score: 100, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
    userClusters.push(c)
  }
  // Hard exclusion would empty the eligibility pool. Soft fallback should
  // drop the exclusion and let LT pick from the user's clusters.
  const out = trinityLT(h2, state, inv, seededRng(1), { excludeClusters: userClusters })
  assert(out.length > 0,
    'trinityLT soft-falls-back when hard-exclude would starve the pool',
    `got ${out.length} picks`)
}


testRecency_shelfLifeAware()
testExploreArm_picksFromHzeroOnly()
testTrinityLT_softExclusionFallback()

// ───────────────────────────────────────────────────────────────────────
// Fix E (2026-05-14) — exploreArm reads user_negative_dimensions to make
// seconds-fresh fast-skip signal influence cluster picks.
// ───────────────────────────────────────────────────────────────────────

function _makeHotClusterState(clusterId, hotEngages = 5, hotShows = 20) {
  // Helper: build a cluster_state Map with one "mildly hot" cluster (Beta
  // mean ≈ 0.22, realistic for a popular-but-not-dominant cluster on the
  // platform) and one cold cluster (zero engage). The hot one wins
  // Thompson Sampling reliably without penalties; the penalty math from
  // Fix E should flip them at moderate skip counts (~6-10 skips).
  // Defaults match what a "wrestling" or "darts" cluster typically looks
  // like in production — popular with some users, not universally hot.
  const state = new Map()
  state.set(clusterId,     { explore_engages: hotEngages, explore_shows: hotShows, b_score: 0, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  state.set(clusterId + 1, { explore_engages: 0,          explore_shows: hotShows, b_score: 0, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  return state
}

function testExploreArm_respectsClusterSkips() {
  // Two clusters, both eligible. Cluster 500 is "hot" globally (high
  // explore_engages) — Thompson Sampling normally picks it 70%+ of the time.
  // But the user has fast-skipped cluster 500 ten times this week.
  // Penalty: 10 × 0.05 = 0.50 (hit the cap). Beta samples for cluster 500
  // are typically in [0.2, 0.6]; subtracting 0.50 nearly always drops it
  // below cluster 501's unpenalized Beta sample.
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY); inv[500] = 10; inv[501] = 10
  const state = _makeHotClusterState(500)
  const negativeDimensions = {
    cluster: new Map([['500', 10]]),   // 10 fast-skips on cluster 500
    primary: new Map(),
    source: new Map(),
    author: new Map(),
  }
  const samples = new Map()
  for (let seed = 1; seed <= 200; seed++) {
    const rng = (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
    const picks = exploreArm(h2, state, inv, 1, rng, { negativeDimensions })
    for (const c2 of picks) samples.set(c2, (samples.get(c2) || 0) + 1)
  }
  const c500 = samples.get(500) || 0
  const c501 = samples.get(501) || 0
  assert(c501 > c500,
    'exploreArm: cluster with fast-skip history loses to unskipped cluster despite hot global state',
    `c500=${c500} c501=${c501}`)
}

function testExploreArm_respectsPrimarySkips() {
  // Same shape, but the penalty comes from PRIMARY axis. Cluster 500 has
  // primary 60; user has 15 fast-skips on primary 60. Penalty: 15 × 0.03
  // = 0.45 (under cap). Cluster 501 has primary 80, no skips.
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY); inv[500] = 10; inv[501] = 10
  const state = _makeHotClusterState(500)
  const parentMap = new Array(K_SECONDARY)
  for (let c = 0; c < K_SECONDARY; c++) parentMap[c] = Math.floor(c / 8)  // matches production
  // parentMap[500] = 62, parentMap[501] = 62 — same primary by default,
  // so we override to put 501 in a different primary.
  parentMap[501] = 100
  const negativeDimensions = {
    cluster: new Map(),
    primary: new Map([['62', 15]]),
    source: new Map(),
    author: new Map(),
  }
  const samples = new Map()
  for (let seed = 1; seed <= 200; seed++) {
    const rng = (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
    const picks = exploreArm(h2, state, inv, 1, rng, { negativeDimensions, parentMap })
    for (const c2 of picks) samples.set(c2, (samples.get(c2) || 0) + 1)
  }
  const c500 = samples.get(500) || 0
  const c501 = samples.get(501) || 0
  assert(c501 > c500,
    'exploreArm: primary-axis skip history demotes a hot cluster under that primary',
    `c500=${c500} c501=${c501}`)
}

function testExploreArm_noNegDimsOptIsNoOp() {
  // Without opts.negativeDimensions, behavior must match the original
  // Thompson-Sampling-only path — the hot cluster (500) should still beat
  // the cold one (501) most of the time.
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY); inv[500] = 10; inv[501] = 10
  const state = _makeHotClusterState(500)
  const samples = new Map()
  for (let seed = 1; seed <= 200; seed++) {
    const rng = (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
    const picks = exploreArm(h2, state, inv, 1, rng)  // no opts.negativeDimensions
    for (const c2 of picks) samples.set(c2, (samples.get(c2) || 0) + 1)
  }
  const c500 = samples.get(500) || 0
  const c501 = samples.get(501) || 0
  assert(c500 > c501 * 1.5,
    'exploreArm: with no negativeDimensions opt, hot cluster still wins (no-op preservation)',
    `c500=${c500} c501=${c501}`)
}

function testExploreArm_penaltyCappedSoNotPermanent() {
  // 100 fast-skips on a cluster shouldn't make it impossible to ever pick
  // again — the cap at 0.5 means even a heavily-skipped cluster retains
  // some baseline picking probability if its Beta sample is high enough.
  // With 100 skips × 0.05 = 5.0, the cap clamps to 0.5. A Beta sample
  // of 0.9 from a very hot cluster still survives at 0.4 after penalty.
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY); inv[500] = 10
  const state = new Map()
  state.set(500, { explore_engages: 100, explore_shows: 110, b_score: 0, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  const negativeDimensions = {
    cluster: new Map([['500', 100]]),  // would be -5.0 uncapped
    primary: new Map(),
    source: new Map(),
    author: new Map(),
  }
  let picked = 0
  for (let seed = 1; seed <= 100; seed++) {
    const rng = (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
    const picks = exploreArm(h2, state, inv, 1, rng, { negativeDimensions })
    if (picks.includes(500)) picked += 1
  }
  // Sole candidate — cluster 500 should always be selected even with the
  // cap-clamped penalty (no other cluster to compete).
  assert(picked === 100,
    'exploreArm: penalty cap prevents permanent exclusion (sole candidate still picked)',
    `picked=${picked}/100`)
}

// 2026-05-17 (Wave 5) — exploreArm per-primary cap.
function testExploreArm_perPrimaryCapEnforced() {
  // 6 secondary clusters available, all in primary 124. With cap=2 (no
  // other primary candidates exist), only 2 should be picked even when
  // nSlots=4. This catches the audit failure: 4 PGA Sports cards from
  // primary 124 in one explore bucket (session B slate 2).
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  // parentMap: c2/8 → c1
  const parentMap = new Int32Array(K_SECONDARY)
  for (let c2 = 0; c2 < K_SECONDARY; c2++) parentMap[c2] = Math.floor(c2 / 8)
  // 6 secondary clusters under primary 124 (c2 992..997 → c1 124).
  for (let c2 = 992; c2 <= 997; c2++) inv[c2] = 10
  const state = new Map()
  for (let c2 = 992; c2 <= 997; c2++) {
    state.set(c2, { explore_engages: 10, explore_shows: 12, b_score: 0,
      last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  }
  // RNG seeded for determinism.
  const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
  const picks = exploreArm(h2, state, inv, 4, rng, { parentMap })
  assert(picks.length === MAX_EXPLORE_PER_PRIMARY,
    'exploreArm cap: only MAX_EXPLORE_PER_PRIMARY picks when all candidates share one primary',
    `got ${picks.length} (expected ${MAX_EXPLORE_PER_PRIMARY})`)
  for (const c2 of picks) {
    assert(parentMap[c2] === 124,
      `exploreArm cap: picked cluster ${c2} is in primary 124`,
      `parent=${parentMap[c2]}`)
  }
}

function testExploreArm_perPrimaryCapAcrossMultiplePrimaries() {
  // 8 secondaries across 4 primaries (2 per primary). Cap = 2 per primary,
  // nSlots = 8 → all 8 should be picked (each primary at max).
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  const parentMap = new Int32Array(K_SECONDARY)
  for (let c2 = 0; c2 < K_SECONDARY; c2++) parentMap[c2] = Math.floor(c2 / 8)
  // c2 [800..807] are all in primary 100. Use only 800, 801, 808, 809, 816, 817, 824, 825
  // so we get 4 primaries × 2 secondaries.
  const eligible = [800, 801, 808, 809, 816, 817, 824, 825]
  for (const c2 of eligible) inv[c2] = 10
  const state = new Map()
  for (const c2 of eligible) {
    state.set(c2, { explore_engages: 10, explore_shows: 12, b_score: 0,
      last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  }
  const rng = (() => { let s = 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
  const picks = exploreArm(h2, state, inv, 8, rng, { parentMap })
  // Group picks by primary.
  const byPrimary = new Map()
  for (const c2 of picks) {
    const c1 = parentMap[c2]
    byPrimary.set(c1, (byPrimary.get(c1) || 0) + 1)
  }
  for (const [c1, count] of byPrimary) {
    assert(count <= MAX_EXPLORE_PER_PRIMARY,
      `exploreArm cap: primary ${c1} contributes ≤ ${MAX_EXPLORE_PER_PRIMARY} (got ${count})`,
      `got ${count}`)
  }
  assert(picks.length >= 4,
    'exploreArm cap: enough picks across primaries to fill some of nSlots',
    `got ${picks.length}`)
}

function testExploreArm_noParentMapFallsBackToOldBehavior() {
  // When no parentMap is provided, the cap can't apply (can't determine
  // primary). Behavior should fall back to the pre-cap "top-N by score".
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  for (let c2 = 800; c2 <= 805; c2++) inv[c2] = 10
  const state = new Map()
  for (let c2 = 800; c2 <= 805; c2++) {
    state.set(c2, { explore_engages: 10, explore_shows: 12, b_score: 0,
      last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  }
  const rng = (() => { let s = 5; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
  const picks = exploreArm(h2, state, inv, 4, rng)  // no parentMap
  assert(picks.length === 4,
    'exploreArm: without parentMap, returns top nSlots by Beta score',
    `got ${picks.length}`)
}

testExploreArm_respectsClusterSkips()
testExploreArm_respectsPrimarySkips()
testExploreArm_noNegDimsOptIsNoOp()
testExploreArm_penaltyCappedSoNotPermanent()
testExploreArm_perPrimaryCapEnforced()
testExploreArm_perPrimaryCapAcrossMultiplePrimaries()
testExploreArm_noParentMapFallsBackToOldBehavior()


// v4 tests.

function testV5_1_windowTiersExtendedTo14d() {
  // v5.1 (Phase 1 fix, 2026-05-06) re-added a 14d third tier to address
  // power-user dedup exhaustion. Stale-age penalty (0.4× for >7d articles)
  // keeps the freshness preference intact.
  const max = ADAPTIVE_WINDOW_TIERS_H[ADAPTIVE_WINDOW_TIERS_H.length - 1]
  assert(max === 14 * 24,
    'v5.1: ADAPTIVE_WINDOW_TIERS_H ends at 14d',
    `got ${max}h, expected ${14 * 24}h`)
}


function testV4_topPrimaries_returnsTopByCount() {
  const h1 = new Int32Array(J_PRIMARY)
  h1[5]  = 100
  h1[39] = 50
  h1[7]  = 25
  h1[200] = 10
  h1[12] = 5
  const top3 = topPrimariesFromHistogram(h1, 3)
  assert(top3.length === 3 && top3[0] === 5 && top3[1] === 39 && top3[2] === 7,
    'v4: topPrimariesFromHistogram returns top-N by count',
    `got ${JSON.stringify(top3)}`)
}


function testV4_topPrimaries_skipsZeroEntries() {
  const h1 = new Int32Array(J_PRIMARY)
  h1[10] = 4
  h1[20] = 2
  // request 5; only 2 primaries have non-zero count
  const top = topPrimariesFromHistogram(h1, 5)
  assert(top.length === 2 && top[0] === 10 && top[1] === 20,
    'v4: topPrimariesFromHistogram skips zero-count primaries',
    `got ${JSON.stringify(top)}`)
}


function testV4_staleAgeThreshold_atSevenDays() {
  // Sanity: STALE_AGE_DAYS exists and equals 7. The penalty is applied in
  // trinityServe.rerank so we just verify the constant here.
  assert(STALE_AGE_DAYS === 7,
    'v4: STALE_AGE_DAYS = 7',
    `got ${STALE_AGE_DAYS}`)
}


testV5_1_windowTiersExtendedTo14d()
testV4_topPrimaries_returnsTopByCount()
testV4_topPrimaries_skipsZeroEntries()
testV4_staleAgeThreshold_atSevenDays()


// ─── v5 tests ─────────────────────────────────────────────────────────

function testV5_exploreFractionAt20Percent() {
  assert(EXPLORE_SLOT_FRACTION === 0.20,
    'v5: EXPLORE_SLOT_FRACTION = 0.20 (Vombatkere TikTok audit)',
    `got ${EXPLORE_SLOT_FRACTION}`)
}


function testV5_maxPerPrimaryAt4() {
  assert(MAX_PER_PRIMARY === 4,
    'v5: MAX_PER_PRIMARY = 4 (TikTok DPP k≈6 analog)',
    `got ${MAX_PER_PRIMARY}`)
}


function testV5_getInterestTiers_splitsCorrectly() {
  const h1 = new Int32Array(J_PRIMARY)
  const ranks = [
    [10, 100], [20, 80], [30, 60],   // tier1 (top-3)
    [40, 50], [50, 40], [60, 30],    // tier2 begins
    [70, 25], [80, 20], [90, 15], [100, 10],  // tier2 ends at rank 9
    [110, 5], [120, 3],              // tier3 (long-tail)
  ]
  for (const [c, v] of ranks) h1[c] = v
  const { tier1, tier2 } = getInterestTiers(h1)
  assert(tier1.length === 3 && tier1[0] === 10 && tier1[2] === 30,
    'v5: getInterestTiers tier1 = top-3 primaries',
    `got tier1=${JSON.stringify(tier1)}`)
  assert(tier2.length === 7 && tier2[0] === 40 && tier2[6] === 100,
    'v5: getInterestTiers tier2 = ranks 4-10',
    `got tier2=${JSON.stringify(tier2)}`)
  // tier1 and tier2 must not overlap
  const overlap = tier1.filter(p => tier2.includes(p))
  assert(overlap.length === 0,
    'v5: tier1 and tier2 disjoint',
    `overlap=${JSON.stringify(overlap)}`)
}


function testV5_composeWithBudgets_honoursAllocations() {
  // 3 pools, budgets 4 / 4 / 4, total 12.
  const a = [{id:1,vq_primary:1},{id:2,vq_primary:1},{id:3,vq_primary:1},{id:4,vq_primary:1},{id:5,vq_primary:1}]
  const b = [{id:10,vq_primary:2},{id:11,vq_primary:2},{id:12,vq_primary:2},{id:13,vq_primary:2},{id:14,vq_primary:2}]
  const c = [{id:20,vq_primary:3},{id:21,vq_primary:3},{id:22,vq_primary:3},{id:23,vq_primary:3},{id:24,vq_primary:3}]
  const composed = composeWithBudgets([
    { name: 'A', items: a, budget: 4 },
    { name: 'B', items: b, budget: 4 },
    { name: 'C', items: c, budget: 4 },
  ], 12)
  assert(composed.length === 12, 'v5: compose returns slateSize items', `got ${composed.length}`)
  const counts = { A: 0, B: 0, C: 0 }
  for (const it of composed) counts[it._retrieverTier] += 1
  assert(counts.A === 4 && counts.B === 4 && counts.C === 4,
    'v5: compose honours each pool\'s budget',
    `got ${JSON.stringify(counts)}`)
}


function testV5_composeWithBudgets_backfillsWhenPoolEmpty() {
  // Pool B is empty; its 4-slot budget must be picked up by A and C.
  const a = Array.from({length:10}, (_,i) => ({id:i+1, vq_primary:1}))
  const b = []
  const c = Array.from({length:10}, (_,i) => ({id:i+50, vq_primary:3}))
  const composed = composeWithBudgets([
    { name: 'A', items: a, budget: 4 },
    { name: 'B', items: b, budget: 4 },
    { name: 'C', items: c, budget: 4 },
  ], 12)
  assert(composed.length === 12,
    'v5: compose backfills when one pool is empty',
    `got ${composed.length}`)
}


function testV5_applyPrimaryCap_enforcesMaxFour() {
  // 8 items all from primary 100 — cap should drop 4.
  const slate = Array.from({length:8}, (_,i) => ({id:i+1, vq_primary:100}))
  const capped = applyPrimaryCap(slate, { maxPerPrimary: 4, noConsecutive: false })
  // The 4 inside cap stay; the 4 overflow get pushed to the end (still over cap)
  // but since the cap is already filled, only the first 4 count toward the cap.
  // Either way, no more than 4 from primary 100 in any non-overflow window.
  const counts = capped.filter((_, i) => i < 4).filter(it => it.vq_primary === 100).length
  assert(counts === 4,
    'v5: applyPrimaryCap caps any primary at MAX_PER_PRIMARY',
    `got ${counts} of 100 in first 4 slots`)
}


function testV5_applyPrimaryCap_noConsecutive() {
  // Build a slate that starts with 3 same-primary then alternates.
  const slate = [
    {id:1, vq_primary:1},
    {id:2, vq_primary:1},
    {id:3, vq_primary:2},
    {id:4, vq_primary:2},
    {id:5, vq_primary:3},
    {id:6, vq_primary:3},
  ]
  const out = applyPrimaryCap(slate, { maxPerPrimary: 10, noConsecutive: true })
  let consecutiveSame = 0
  for (let i = 1; i < out.length; i++) {
    if (out[i].vq_primary === out[i-1].vq_primary) consecutiveSame += 1
  }
  assert(consecutiveSame === 0,
    'v5: applyPrimaryCap eliminates consecutive same-primary',
    `got ${consecutiveSame} consecutive same-primary pairs in ${JSON.stringify(out.map(o => o.vq_primary))}`)
}


function testV5_applyPrimaryCap_acceptsRepeatWhenNoAlternative() {
  // All same primary — cap=10, can't avoid consecutive.
  const slate = Array.from({length:5}, (_,i) => ({id:i+1, vq_primary:1}))
  const out = applyPrimaryCap(slate, { maxPerPrimary: 10, noConsecutive: true })
  // Should still return all 5 — accepts repeats when no alternative exists.
  assert(out.length === 5,
    'v5: applyPrimaryCap accepts unavoidable repeats rather than dropping items',
    `got ${out.length}`)
}


testV5_exploreFractionAt20Percent()
testV5_maxPerPrimaryAt4()
testV5_getInterestTiers_splitsCorrectly()
testV5_composeWithBudgets_honoursAllocations()
testV5_composeWithBudgets_backfillsWhenPoolEmpty()
testV5_applyPrimaryCap_enforcesMaxFour()
testV5_applyPrimaryCap_noConsecutive()
testV5_applyPrimaryCap_acceptsRepeatWhenNoAlternative()


// Phase 0.6 (2026-05-11) — snapshot of the algorithm constants that have
// historically been silently bumped across sessions. Any future PR that
// changes one of these has to update the test, making the change explicit.
function testConstantsSnapshot() {
  assert(MAX_PER_PRIMARY === 4,
    'snapshot: MAX_PER_PRIMARY = 4 (TikTok DPP k≈6 analog)',
    `got ${MAX_PER_PRIMARY}`)
  assert(MAX_PER_PUBLISHER === 3,
    'snapshot: MAX_PER_PUBLISHER = 3 (TikTok creator-dedup analog)',
    `got ${MAX_PER_PUBLISHER}`)
  assert(MAX_PER_EVENT === 1,
    'snapshot: MAX_PER_EVENT = 1 (Google News story-cluster dedup)',
    `got ${MAX_PER_EVENT}`)
  assert(EXPLORE_SLOT_FRACTION === 0.20,
    'snapshot: EXPLORE_SLOT_FRACTION = 0.20 (Vombatkere TikTok audit)',
    `got ${EXPLORE_SLOT_FRACTION}`)
  assert(EXPLORE_BETA_PRIOR_ALPHA === 0.5 && EXPLORE_BETA_PRIOR_BETA === 4.5,
    'snapshot: explore Beta prior = (0.5, 4.5) (10% engage-rate prior, Spotify BaRT)',
    `got (${EXPLORE_BETA_PRIOR_ALPHA}, ${EXPLORE_BETA_PRIOR_BETA})`)
  assert(SAME_TAG_TODAY_PENALTY === 0.05 && SAME_TAG_TODAY_WINDOW_HOURS === 24,
    'snapshot: same-tag-today = 0.05 per same-primary impression in 24h window',
    `got (${SAME_TAG_TODAY_PENALTY}, ${SAME_TAG_TODAY_WINDOW_HOURS}h)`)
  assert(NOT_INTERESTED_HISTOGRAM_DECREMENT === 3 && NOT_INTERESTED_COOLDOWN_HOURS === 48,
    'snapshot: Not-Interested decrement=3, cooldown=48h (TikTok soft-exclude)',
    `got (${NOT_INTERESTED_HISTOGRAM_DECREMENT}, ${NOT_INTERESTED_COOLDOWN_HOURS}h)`)
}

testConstantsSnapshot()


// ---------------------------------------------------------------------------
// P1+P3 fix (2026-05-11) — X-style diversity discount tests.
// ---------------------------------------------------------------------------

function testDiversityDiscountFormulaMatchesX() {
  // X formula: (1 - 0.25) * 0.5^n + 0.25
  //   n=0 → 1.000   (first item, no discount)
  //   n=1 → 0.625
  //   n=2 → 0.4375
  //   n=3 → 0.34375
  //   n=∞ → 0.25 (floor)
  assert(DIV_DECAY === 0.5,  'DIV_DECAY = 0.5 (X open-source value)', `got ${DIV_DECAY}`)
  assert(DIV_FLOOR === 0.25, 'DIV_FLOOR = 0.25 (X open-source value)', `got ${DIV_FLOOR}`)
}

function testDiversityDiscountSamePrimary() {
  // 5 items all from primary=39, scored 100/90/80/70/60. With Fix A
  // (2026-05-12) the primary axis floor is 0.10 instead of the default 0.25,
  // so the discount keeps biting after the 3rd item instead of asymptoting.
  // Expected after discount on primary axis (floor=0.10):
  //   #1: 100 * (1-0.10)*0.5^0 + 0.10 = 100 * 1.00     = 100.00
  //   #2:  90 * (1-0.10)*0.5^1 + 0.10 =  90 * 0.55     =  49.50
  //   #3:  80 * (1-0.10)*0.5^2 + 0.10 =  80 * 0.325    =  26.00
  //   #4:  70 * (1-0.10)*0.5^3 + 0.10 =  70 * 0.2125   =  14.88
  //   #5:  60 * (1-0.10)*0.5^4 + 0.10 =  60 * 0.15625  =   9.38
  const slate = [
    { id: 1, vq_primary: 39, source: 'A', _score: 100 },
    { id: 2, vq_primary: 39, source: 'B', _score:  90 },
    { id: 3, vq_primary: 39, source: 'C', _score:  80 },
    { id: 4, vq_primary: 39, source: 'D', _score:  70 },
    { id: 5, vq_primary: 39, source: 'E', _score:  60 },
  ]
  const out = applyDiversityDiscount(slate)
  assert(out.length === 5, 'no items dropped at default dropBelow=0', `got ${out.length}`)
  assert(out[0].id === 1, 'first item is the highest raw score',
    `got id=${out[0].id} score=${out[0]._score}`)
  assert(Math.abs(out[0]._score - 100) < 0.01,
    'first item score unchanged (×1.0)', `got ${out[0]._score}`)
  // Primary floor 0.10 → 2nd item mult = 0.55 → score 49.50.
  assert(Math.abs(out[1]._score - 49.50) < 0.5,
    '2nd item discounted by 0.55× (primary floor 0.10, prior=1)',
    `got ${out[1]._score.toFixed(2)}`)
  // 5th item should be heavily discounted now (vs old floor 0.25 asymptote).
  assert(out[4]._score < 15,
    '5th item heavily discounted (Fix A floor=0.10 prevents asymptote)',
    `got ${out[4]._score.toFixed(2)}`)
}

function testDiversityDiscountVariedPrimary() {
  // 4 items, varied primary. None should be discounted (each unique).
  const slate = [
    { id: 1, vq_primary: 39, source: 'A', _score: 100 },
    { id: 2, vq_primary: 50, source: 'B', _score:  90 },
    { id: 3, vq_primary: 70, source: 'C', _score:  80 },
    { id: 4, vq_primary: 90, source: 'D', _score:  70 },
  ]
  const out = applyDiversityDiscount(slate)
  for (const item of out) {
    const original = slate.find(s => s.id === item.id)
    assert(item._score === original._score,
      `varied primaries: id=${item.id} score unchanged (no discount)`,
      `expected ${original._score}, got ${item._score}`)
  }
}

function testDiversityDiscountDropBelow() {
  // With dropBelow=0.30, items below that combined multiplier are dropped.
  // 6 items all same primary AND same source — both axes discount.
  // After 3 items at same primary AND same source, mult = 0.4375 * 0.4375 = 0.191 < 0.30 → drop.
  const slate = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, vq_primary: 1, source: 'X', _score: 100 - i,
  }))
  const out = applyDiversityDiscount(slate, { dropBelow: 0.30 })
  assert(out.length <= 3,
    'dropBelow=0.30: ≤3 items survive when all share primary AND source',
    `got ${out.length}`)
}

testDiversityDiscountFormulaMatchesX()
testDiversityDiscountSamePrimary()
testDiversityDiscountVariedPrimary()
testDiversityDiscountDropBelow()


// ---------------------------------------------------------------------------
// P5 fix (2026-05-12). assignStoryClusters + story-axis discount tests.
// ---------------------------------------------------------------------------

// Helper — synthesize a length-384 unit vector pointing in a base direction
// plus a small per-axis offset. Two items with the same "direction" will be
// high-cosine; two items with different directions will be low-cosine.
function fakeEmb384(direction, jitter = 0) {
  const v = new Array(384)
  for (let i = 0; i < 384; i++) {
    // Different "directions" 0,1,2 correspond to dominant lobes at different
    // axes; jitter perturbs slightly. Cosine between two items with same
    // direction stays high (>0.55); across directions stays low (<0.55).
    v[i] = (i % 3 === direction ? 1.0 : 0.0) + jitter * Math.sin(i)
  }
  return v
}

function testStoryClusterConstantLocked() {
  // 2026-05-13: lowered 0.55 → 0.52 to catch "same event, different framing"
  // story sprawl (audit found 4 Trump-China-Beijing cards at cosine 0.50-0.55
  // in one slate that all fell below the 0.55 threshold).
  assert(Math.abs(STORY_CLUSTER_THRESHOLD - 0.52) < 1e-9,
    'STORY_CLUSTER_THRESHOLD locked at 0.52 (post-#162 audit)',
    `got ${STORY_CLUSTER_THRESHOLD}`)
}

function testStoryClustersEmptyInput() {
  const items = []
  assignStoryClusters(items)
  assert(items.length === 0, 'assignStoryClusters: empty in → empty out')
}

function testStoryClustersGroupsSimilarItems() {
  // Three items in direction=0 (should share cluster), two in direction=1
  // (separate cluster).
  const items = [
    { id: 1, embedding_minilm_vec: fakeEmb384(0, 0.01) },
    { id: 2, embedding_minilm_vec: fakeEmb384(0, 0.02) },
    { id: 3, embedding_minilm_vec: fakeEmb384(0, 0.03) },
    { id: 4, embedding_minilm_vec: fakeEmb384(1, 0.01) },
    { id: 5, embedding_minilm_vec: fakeEmb384(1, 0.02) },
  ]
  assignStoryClusters(items)
  const c1 = items[0]._storyClusterId
  const c2 = items[3]._storyClusterId
  assert(items[1]._storyClusterId === c1 && items[2]._storyClusterId === c1,
    'story cluster: 3 same-direction items share cluster',
    `ids=${items.slice(0,3).map(i=>i._storyClusterId).join(',')}`)
  assert(items[4]._storyClusterId === c2,
    'story cluster: 2 different-direction items share their own cluster',
    `id4=${items[3]._storyClusterId} id5=${items[4]._storyClusterId}`)
  assert(c1 !== c2, 'story cluster: different directions get different clusters')
}

function testStoryClustersAcceptsJsonString() {
  // pgvector text repr.
  const items = [
    { id: 1, embedding_minilm_vec: JSON.stringify(fakeEmb384(0, 0.01)) },
    { id: 2, embedding_minilm_vec: JSON.stringify(fakeEmb384(0, 0.02)) },
  ]
  assignStoryClusters(items)
  assert(items[0]._storyClusterId != null && items[0]._storyClusterId === items[1]._storyClusterId,
    'story cluster: parses JSON-string embeddings correctly')
}

function testStoryClustersUniqueWhenNoEmbedding() {
  const items = [
    { id: 1, embedding_minilm_vec: null },
    { id: 2, embedding_minilm_vec: null },
  ]
  assignStoryClusters(items)
  assert(items[0]._storyClusterId !== items[1]._storyClusterId,
    'no-embedding items get unique clusters (never discounted)',
    `ids=${items.map(i=>i._storyClusterId).join(',')}`)
}

function testDiversityDiscountStoryAxis() {
  // 4 items in 3 different vq_primaries but ALL in the same story cluster
  // (Iran-war scenario). The story axis should discount items 2/3/4 below
  // their raw scores, dropping their final rank.
  const slate = [
    { id: 1, vq_primary: 235, _storyClusterId: 'c0', _score: 900 },
    { id: 2, vq_primary: 61,  _storyClusterId: 'c0', _score: 880 },
    { id: 3, vq_primary: 34,  _storyClusterId: 'c0', _score: 870 },
    { id: 4, vq_primary: 161, _storyClusterId: 'c0', _score: 860 },
    { id: 5, vq_primary: 39,  _storyClusterId: 'c1', _score: 700 },
  ]
  const out = applyDiversityDiscount(slate)
  // After discount: item 1 keeps raw 900 (prior=0 → mult=1). Items 2,3,4
  // each get the story-axis discount (prior=1,2,3 respectively). Item 5 has
  // its own story cluster, so it competes on raw 700.
  // Expected ordering: 1, 5, then 2/3/4.
  assert(out[0].id === 1, 'story axis: top story-cluster anchor stays first',
    `got id=${out[0].id}`)
  // Item 5 (different story cluster, raw 700) should outrank item 4 (same
  // cluster, original 860 but discounted by story-axis).
  const idx5 = out.findIndex(it => it.id === 5)
  const idx4 = out.findIndex(it => it.id === 4)
  assert(idx5 < idx4,
    'story axis: item from different story cluster outranks heavily-discounted same-cluster item',
    `idx5=${idx5} idx4=${idx4}`)
}

function testDiversityDiscountStoryFloorLowered() {
  // Wave 1 (2026-05-17) — story-axis floor lowered 0.20 → 0.05. Build 8
  // items in the same story cluster but all with DIFFERENT vq_primary and
  // DIFFERENT source so the primary and source axes don't fire. With floor
  // 0.05 and decay 0.5, the 8th item's story multiplier is
  // (1-0.05)·0.5^7 + 0.05 = 0.95·(1/128) + 0.05 ≈ 0.0574, not 0.20.
  const slate = []
  for (let i = 0; i < 8; i++) {
    slate.push({
      id: i + 1,
      vq_primary: 10 + i,        // unique primary per item
      source: `Source${i}`,      // unique source per item
      author_id: `Auth${i}`,     // unique author per item (Wave 4 author axis)
      _storyClusterId: 'c-same',
      _score: 100,
    })
  }
  const out = applyDiversityDiscount(slate)
  // Listwise (Wave 4) returns a fresh array with mutated _score per pick.
  const minScore = Math.min(...out.map(it => it._score))
  assert(minScore < 8.0,
    'applyDiversityDiscount: 8th same-cluster item lands near new floor 0.05× raw',
    `minScore=${minScore.toFixed(3)} (expected ≈ 5.7, previously ≈ 20 with floor 0.20)`)
  assert(minScore > 4.5,
    'applyDiversityDiscount: tiny safety floor 0.05 still prevents zero',
    `minScore=${minScore.toFixed(3)}`)
}


// ---------------------------------------------------------------------------
// 2026-05-17 (Wave 4) — listwise rescoring + cross-slate decay.
// ---------------------------------------------------------------------------

function testListwiseCrossSlateSeedsStoryAxis() {
  // recentClusterCounts pre-seeds axisCounts.story. A candidate in cluster
  // c1 that had 5 prior impressions starts the listwise pass at position 5
  // for the story axis, so its multiplier ≈ (1-0.05)*0.5^5 + 0.05 ≈ 0.0797.
  // A candidate in c2 with 0 prior impressions starts at position 0 →
  // multiplier 1.0. Even if c1's raw score is higher, c2 wins after the
  // cross-slate seed kicks in.
  const slate = [
    { id: 1, vq_primary: 39, source: 'A', author_id: 'a1', _storyClusterId: 'c1', _score: 100 },
    { id: 2, vq_primary: 40, source: 'B', author_id: 'a2', _storyClusterId: 'c2', _score: 80 },
  ]
  const recentClusterCounts = new Map([['c1', 5]])
  const out = applyDiversityDiscount(slate.slice(), { recentClusterCounts })
  assert(out[0].id === 2,
    'cross-slate seed: c2 (no prior) wins over c1 (5 prior impressions) despite lower raw score',
    `top id=${out[0].id} c1_adj=${out.find(o => o.id === 1)._score.toFixed(3)} c2_adj=${out.find(o => o.id === 2)._score.toFixed(3)}`)
  const c1Item = out.find(o => o.id === 1)
  assert(c1Item._score < 10,
    'cross-slate seed: c1 with 5 prior impressions drops to ≈ 0.08× raw',
    `c1._score=${c1Item._score.toFixed(3)}`)
}

function testListwiseEmptyRecentCountsIsNoOp() {
  // No opts → no-op vs ordinary call.
  const slate = [
    { id: 1, vq_primary: 39, _storyClusterId: 'c0', _score: 100 },
    { id: 2, vq_primary: 39, _storyClusterId: 'c0', _score: 90 },
  ]
  const a = applyDiversityDiscount(JSON.parse(JSON.stringify(slate)))
  const b = applyDiversityDiscount(JSON.parse(JSON.stringify(slate)), { recentClusterCounts: new Map() })
  assert(a.length === b.length,
    'empty recentClusterCounts: same length as no opts',
    `a=${a.length} b=${b.length}`)
  for (let i = 0; i < a.length; i++) {
    assert(Math.abs(a[i]._score - b[i]._score) < 1e-9,
      `empty recentClusterCounts: position ${i} score matches no-opts call`,
      `a=${a[i]._score} b=${b[i]._score}`)
  }
}

function testListwiseAuthorAxis() {
  // 3 cards same author, 1 card different author. Author axis floor 0.20.
  const slate = [
    { id: 1, vq_primary: 39, source: 'A', author_id: 'shared', _storyClusterId: 'c0', _score: 100 },
    { id: 2, vq_primary: 40, source: 'B', author_id: 'shared', _storyClusterId: 'c1', _score:  95 },
    { id: 3, vq_primary: 41, source: 'C', author_id: 'shared', _storyClusterId: 'c2', _score:  90 },
    { id: 4, vq_primary: 42, source: 'D', author_id: 'other',  _storyClusterId: 'c3', _score:  60 },
  ]
  const out = applyDiversityDiscount(slate.slice())
  // id=1 first (no prior). id=4 (different author, no priors) should beat
  // id=2/3 (same-author priors).
  const idx1 = out.findIndex(it => it.id === 1)
  const idx4 = out.findIndex(it => it.id === 4)
  const idx2 = out.findIndex(it => it.id === 2)
  assert(idx1 === 0, 'listwise: top raw-score item anchors first', `idx1=${idx1}`)
  assert(idx4 < idx2,
    'listwise author axis: different-author item beats 2nd same-author item even at lower raw score',
    `idx4=${idx4} idx2=${idx2}`)
}

function testListwiseTrueMaxAdjustedPerPosition() {
  // Subtle case: at position 1, the listwise must recompute adjusted score
  // for all remaining candidates using updated axisCounts. Old per-iteration-
  // discount code could leave a candidate's discount stale.
  //
  // Setup: 3 items, all same primary, all same story cluster, scores 100/90/80.
  // After id=1 picks (position 0, no priors → mult 1.0, _score 100):
  //   axisCounts.story[c0]=1, axisCounts.primary[39]=1
  //   id=2 adjusted = 90 * (story 0.525) * (primary 0.55) ≈ 90 * 0.289 ≈ 25.97
  //   id=3 adjusted = 80 * 0.289 ≈ 23.09
  // Position 1 picks id=2 at 25.97.
  // Position 2: axisCounts.story[c0]=2, primary[39]=2.
  //   id=3 adjusted = 80 * (story 0.2875) * (primary 0.325) ≈ 80 * 0.0934 ≈ 7.47
  // So the final scores stored on items reflect their ACTUAL position's
  // discount, not the raw-order discount.
  const slate = [
    { id: 1, vq_primary: 39, _storyClusterId: 'c0', _score: 100 },
    { id: 2, vq_primary: 39, _storyClusterId: 'c0', _score:  90 },
    { id: 3, vq_primary: 39, _storyClusterId: 'c0', _score:  80 },
  ]
  const out = applyDiversityDiscount(slate.slice())
  assert(out[0].id === 1 && Math.abs(out[0]._score - 100) < 0.01,
    'listwise position 0: max raw score, no discount',
    `got id=${out[0].id} score=${out[0]._score}`)
  assert(out[1].id === 2,
    'listwise position 1: 2nd highest after applying prior=1 discount',
    `got id=${out[1].id}`)
  // Position 2 with story prior 2 + primary prior 2: 80 × ((1-0.05)·0.25 + 0.05) × ((1-0.10)·0.25 + 0.10) = 80 × 0.2875 × 0.325 ≈ 7.475
  assert(out[2]._score < 10,
    'listwise position 2: deeply discounted (story prior 2 + primary prior 2)',
    `got ${out[2]._score.toFixed(2)}`)
}

function testClassifyPastEmbeddingsToClusters() {
  // Build 3 current items in 2 clusters via assignStoryClusters, then
  // classify 4 past embeddings.
  const a = fakeEmb384(0, 0.01)
  const b = fakeEmb384(0, 0.02)
  const c = fakeEmb384(1, 0.01)
  const current = [
    { id: 1, embedding_minilm_vec: a },
    { id: 2, embedding_minilm_vec: b },
    { id: 3, embedding_minilm_vec: c },
  ]
  assignStoryClusters(current)
  const c0 = current[0]._storyClusterId
  const c1 = current[2]._storyClusterId
  assert(current[1]._storyClusterId === c0 && c0 !== c1,
    'precondition: items 1,2 share cluster; item 3 is in its own cluster')

  // 3 past embeddings in direction=0 (matches c0), 1 in direction=1 (matches c1).
  const pastEmbs = [
    fakeEmb384(0, 0.005),
    fakeEmb384(0, 0.015),
    fakeEmb384(0, 0.025),
    fakeEmb384(1, 0.005),
  ]
  const counts = classifyPastEmbeddingsToClusters(current, pastEmbs)
  assert(counts.get(c0) === 3,
    `classifyPast: 3 past embeddings classified into ${c0}`,
    `got ${counts.get(c0)}`)
  assert(counts.get(c1) === 1,
    `classifyPast: 1 past embedding classified into ${c1}`,
    `got ${counts.get(c1)}`)
}

function testClassifyPastEmbeddingsIgnoresUnclusterable() {
  // Past embeddings that don't match any current cluster are ignored.
  const current = [{ id: 1, embedding_minilm_vec: fakeEmb384(0, 0.01) }]
  assignStoryClusters(current)
  const pastEmbs = [fakeEmb384(2, 0.01)]  // far from cluster 0
  const counts = classifyPastEmbeddingsToClusters(current, pastEmbs)
  let total = 0
  for (const v of counts.values()) total += v
  assert(total === 0,
    'classifyPast: past embedding far from all current clusters → ignored',
    `total counts = ${total}`)
}

function testClassifyPastEmbeddingsEmptyInputs() {
  assert(classifyPastEmbeddingsToClusters([], []).size === 0,
    'classifyPast: empty inputs → empty map')
  assert(classifyPastEmbeddingsToClusters([{ id: 1, embedding_minilm_vec: null }], []).size === 0,
    'classifyPast: empty past embeddings → empty map')
}

testStoryClusterConstantLocked()
testStoryClustersEmptyInput()
testStoryClustersGroupsSimilarItems()
testStoryClustersAcceptsJsonString()
testStoryClustersUniqueWhenNoEmbedding()
testDiversityDiscountStoryAxis()
testDiversityDiscountStoryFloorLowered()
testListwiseCrossSlateSeedsStoryAxis()
testListwiseEmptyRecentCountsIsNoOp()
testListwiseAuthorAxis()
testListwiseTrueMaxAdjustedPerPosition()
testClassifyPastEmbeddingsToClusters()
testClassifyPastEmbeddingsIgnoresUnclusterable()
testClassifyPastEmbeddingsEmptyInputs()

// ---------------------------------------------------------------------------
// 2026-05-17 (Wave 9). computeSkipPenalty — embedding-based skip memory.
// X InteractionGraphNegativeJob pattern at content-similarity granularity.
// ---------------------------------------------------------------------------
function testSkipPenaltyConstantsLocked() {
  assert(Math.abs(SKIP_PENALTY_THRESHOLD - 0.60) < 1e-9,
    'SKIP_PENALTY_THRESHOLD = 0.60', `got ${SKIP_PENALTY_THRESHOLD}`)
  assert(Math.abs(SKIP_PENALTY_DECAY - 0.5) < 1e-9,
    'SKIP_PENALTY_DECAY = 0.5', `got ${SKIP_PENALTY_DECAY}`)
}

function testSkipPenaltyNoSkipsIsNoOp() {
  const cand = fakeEmb384(0, 0.01)
  assert(computeSkipPenalty(cand, []) === 1.0,
    'no skipped articles → multiplier 1.0')
  assert(computeSkipPenalty(cand, null) === 1.0,
    'null skipped → multiplier 1.0')
}

function testSkipPenaltyOneCloseSkip() {
  // Candidate and skip in same direction → cosine very high → counts.
  const cand = fakeEmb384(0, 0.01)
  const skips = [fakeEmb384(0, 0.02)]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.5) < 1e-9,
    'one close skip → multiplier 0.5',
    `got ${mult}`)
}

function testSkipPenaltyThreeCloseSkips() {
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    fakeEmb384(0, 0.02),
    fakeEmb384(0, 0.03),
    fakeEmb384(0, 0.04),
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.125) < 1e-9,
    'three close skips → multiplier 0.125',
    `got ${mult}`)
}

function testSkipPenaltyFarSkipIgnored() {
  // Candidate direction 0, skip direction 2 → cosine ≈ 0 → ignored.
  const cand = fakeEmb384(0, 0.01)
  const skips = [fakeEmb384(2, 0.01)]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 1.0) < 1e-9,
    'far-direction skip ignored (below threshold)',
    `got ${mult}`)
}

function testSkipPenaltyMixedSkips() {
  // 2 close, 3 far. Only the 2 close should count → multiplier 0.25.
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    fakeEmb384(0, 0.02),  // close (same direction)
    fakeEmb384(0, 0.03),  // close
    fakeEmb384(2, 0.01),  // far
    fakeEmb384(2, 0.02),  // far
    fakeEmb384(2, 0.03),  // far
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.25) < 1e-9,
    'mixed skips: only the close ones (cosine ≥ 0.60) count',
    `got ${mult}`)
}

function testSkipPenaltyJsonStringEmbedding() {
  // pgvector text repr. Same parser as assignStoryClusters.
  const cand = JSON.stringify(fakeEmb384(0, 0.01))
  const skips = [JSON.stringify(fakeEmb384(0, 0.02))]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.5) < 1e-9,
    'parses JSON-string embeddings correctly',
    `got ${mult}`)
}

function testSkipPenaltyNullEmbedding() {
  // Candidate without an embedding can't be measured → no penalty.
  const mult = computeSkipPenalty(null, [fakeEmb384(0, 0.01)])
  assert(mult === 1.0,
    'null candidate embedding → multiplier 1.0 (no penalty, defensive)')
}

testSkipPenaltyConstantsLocked()
testSkipPenaltyNoSkipsIsNoOp()
testSkipPenaltyOneCloseSkip()
testSkipPenaltyThreeCloseSkips()
testSkipPenaltyFarSkipIgnored()
testSkipPenaltyMixedSkips()
testSkipPenaltyJsonStringEmbedding()
testSkipPenaltyNullEmbedding()

// ---------------------------------------------------------------------------
// 2026-05-17 (Wave 10). Weighted skip entries — dwell+ratio rule.
// ---------------------------------------------------------------------------

function testSkipPenaltyWeightedHalfSkip() {
  // One soft skip (weight 0.5) close to candidate → multiplier 0.5^0.5 ≈ 0.707.
  const cand = fakeEmb384(0, 0.01)
  const skips = [{ embedding: fakeEmb384(0, 0.02), weight: 0.5 }]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - Math.sqrt(0.5)) < 0.01,
    'one half-weight skip → multiplier ≈ 0.707 (decay^0.5)',
    `got ${mult.toFixed(3)}`)
}

function testSkipPenaltyWeightedMixedFullAndHalf() {
  // 1 full + 2 half = 2.0 total weight → multiplier 0.5^2 = 0.25.
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    { embedding: fakeEmb384(0, 0.02), weight: 1.0 },
    { embedding: fakeEmb384(0, 0.03), weight: 0.5 },
    { embedding: fakeEmb384(0, 0.04), weight: 0.5 },
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.25) < 1e-6,
    '1 full (1.0) + 2 half (0.5 x 2) = 2.0 total → multiplier 0.25',
    `got ${mult.toFixed(4)}`)
}

function testSkipPenaltyWeightedZeroWeightIgnored() {
  // weight = 0 means "not a skip — exclude from input." Should be ignored.
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    { embedding: fakeEmb384(0, 0.02), weight: 0 },
    { embedding: fakeEmb384(0, 0.03), weight: 0 },
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(mult === 1.0,
    'all weight-0 entries → no penalty (multiplier 1.0)',
    `got ${mult}`)
}

function testSkipPenaltyWeightedBackcompatRawArray() {
  // Wave 9 callers pass raw embeddings (not objects). Wave 10 must still
  // treat each as full weight 1.0.
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    fakeEmb384(0, 0.02),  // raw array — Wave 9 form
    fakeEmb384(0, 0.03),  // raw array
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - 0.25) < 1e-9,
    'raw embeddings (Wave 9 back-compat) treated as full weight → 0.5^2 = 0.25',
    `got ${mult}`)
}

function testSkipPenaltyWeightedMixedRawAndObjects() {
  // Defensive: array of mixed raw + object entries. Both should work.
  const cand = fakeEmb384(0, 0.01)
  const skips = [
    fakeEmb384(0, 0.02),                                  // raw, weight 1.0
    { embedding: fakeEmb384(0, 0.03), weight: 0.5 },      // object, weight 0.5
  ]
  const mult = computeSkipPenalty(cand, skips)
  assert(Math.abs(mult - Math.pow(0.5, 1.5)) < 1e-6,
    'mixed raw + weighted object → totalWeight = 1.0 + 0.5 = 1.5 → 0.5^1.5 ≈ 0.354',
    `got ${mult.toFixed(4)}`)
}

function testSkipPenaltyWeightedFarSoftSkipIgnored() {
  // A half-weight skip in a different direction should be below threshold
  // (cosine ≈ 0) and NOT count toward totalWeight.
  const cand = fakeEmb384(0, 0.01)
  const skips = [{ embedding: fakeEmb384(2, 0.01), weight: 0.5 }]
  const mult = computeSkipPenalty(cand, skips)
  assert(mult === 1.0,
    'far-direction soft skip below cosine threshold → no penalty',
    `got ${mult}`)
}

testSkipPenaltyWeightedHalfSkip()
testSkipPenaltyWeightedMixedFullAndHalf()
testSkipPenaltyWeightedZeroWeightIgnored()
testSkipPenaltyWeightedBackcompatRawArray()
testSkipPenaltyWeightedMixedRawAndObjects()
testSkipPenaltyWeightedFarSoftSkipIgnored()


// ---------------------------------------------------------------------------
// Fix C (2026-05-12). pinPersonalToTopSlots — slot position policy.
// ---------------------------------------------------------------------------
function testPinPersonal_noopWhenAlreadySatisfied() {
  const slate = [
    { id: 1, _retrieverTier: 'trinity-personal' },
    { id: 2, _retrieverTier: 'trinity-fresh' },
    { id: 3, _retrieverTier: 'trinity-personal' },
    { id: 4, _retrieverTier: 'trinity-lt' },
    { id: 5, _retrieverTier: 'trinity-follow' },
    { id: 6, _retrieverTier: 'trinity-personal' },
  ]
  const out = pinPersonalToTopSlots(slate.slice(), { minPersonal: 2, topN: 5 })
  assert(out[0].id === 1 && out[2].id === 3,
    'pin: noop when top-5 already has 2+ personal',
    `got ids=${out.map(x=>x.id).join(',')}`)
}

function testPinPersonal_swapsInFromLater() {
  // Top 5 has 0 personal; slots 5+ have personals at 5 and 7.
  const slate = [
    { id: 1, _retrieverTier: 'trinity-fresh' },
    { id: 2, _retrieverTier: 'trinity-follow' },
    { id: 3, _retrieverTier: 'trinity-follow' },
    { id: 4, _retrieverTier: 'trinity-lt' },
    { id: 5, _retrieverTier: 'trinity-fresh' },
    { id: 6, _retrieverTier: 'trinity-personal' },
    { id: 7, _retrieverTier: 'trinity-lt' },
    { id: 8, _retrieverTier: 'trinity-personal' },
  ]
  const out = pinPersonalToTopSlots(slate, { minPersonal: 2, topN: 5 })
  // Now top 5 should contain at least 2 personal cards.
  let topPersonal = 0
  for (let i = 0; i < 5; i++) {
    if (out[i]._retrieverTier === 'trinity-personal') topPersonal += 1
  }
  assert(topPersonal >= 2,
    'pin: swaps personal items into top 5',
    `got ${topPersonal} personal in top 5; ids=${out.map(x=>x.id).join(',')}`)
}

function testPinPersonal_handlesEmptyOrTiny() {
  assert(pinPersonalToTopSlots([]).length === 0, 'pin: empty in → empty out')
  const tiny = [{ id: 1, _retrieverTier: 'trinity-fresh' }]
  assert(pinPersonalToTopSlots(tiny.slice(), { topN: 5 }).length === 1,
    'pin: slate shorter than topN returns unchanged')
}

function testPinPersonal_respectsRetrieverField() {
  // Items may have either _retrieverTier or _retriever — both should match.
  const slate = [
    { id: 1, _retrieverTier: 'trinity-fresh' },
    { id: 2, _retrieverTier: 'trinity-follow' },
    { id: 3, _retrieverTier: 'trinity-follow' },
    { id: 4, _retrieverTier: 'trinity-lt' },
    { id: 5, _retrieverTier: 'trinity-fresh' },
    { id: 6, _retriever: 'trinity-personal' },   // uses _retriever, not _retrieverTier
    { id: 7, _retrieverTier: 'trinity-personal' },
  ]
  const out = pinPersonalToTopSlots(slate, { minPersonal: 2, topN: 5 })
  let topPersonal = 0
  for (let i = 0; i < 5; i++) {
    const it = out[i]
    if (it._retrieverTier === 'trinity-personal' || it._retriever === 'trinity-personal') {
      topPersonal += 1
    }
  }
  assert(topPersonal === 2, 'pin: recognizes both _retrieverTier and _retriever fields',
    `got ${topPersonal}`)
}

testPinPersonal_noopWhenAlreadySatisfied()
testPinPersonal_swapsInFromLater()
testPinPersonal_handlesEmptyOrTiny()
testPinPersonal_respectsRetrieverField()


// ---------------------------------------------------------------------------
// P2 fix (2026-05-12). retrievePersonalPerPrimary — integration smoke tests.
//
// Verifies the orchestration: get-vectors → per-primary ANN → merge/dedup.
// Uses injected getVectors + supabase.rpc stubs so the test runs offline.
// ---------------------------------------------------------------------------

async function testPersonalReturnsEmptyOnNoUserId() {
  const out = await retrievePersonalPerPrimary(null, null, [39, 224])
  assert(Array.isArray(out) && out.length === 0,
    'retrievePersonal: null userId → empty')
}

async function testPersonalReturnsEmptyOnNoPrimaries() {
  const out = await retrievePersonalPerPrimary({}, 'u', [])
  assert(Array.isArray(out) && out.length === 0,
    'retrievePersonal: empty primaries → empty')
}

async function testPersonalReturnsEmptyWhenNoVectors() {
  const stub = { rpc: async () => ({ data: [], error: null }) }
  const out = await retrievePersonalPerPrimary(stub, 'user-empty', [39, 224], {
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: new Map(), bufferSize: 0, cacheHit: false,
    }),
    formatVectorForPg: () => '[]',
  })
  assert(out.length === 0,
    'retrievePersonal: empty vectorsByPrimary → empty pool')
}

async function testPersonalOnePerPrimary() {
  const rpcCalls = []
  const stub = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, primary: args.p_vq_primary })
      return {
        data: [
          { id: args.p_vq_primary * 100 + 1, vq_primary: args.p_vq_primary, ai_final_score: 700 },
          { id: args.p_vq_primary * 100 + 2, vq_primary: args.p_vq_primary, ai_final_score: 650 },
        ],
        error: null,
      }
    },
  }
  const vectors = new Map([[39, new Float32Array(384)], [224, new Float32Array(384)]])
  const out = await retrievePersonalPerPrimary(stub, 'user-1', [39, 224], {
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 50, cacheHit: false,
    }),
    formatVectorForPg: () => '[0,0,0]',
  })
  assert(out.length === 4,
    'retrievePersonal: 2 primaries × 2 candidates = 4 articles',
    `got ${out.length}`)
  assert(rpcCalls.length === 2,
    'retrievePersonal: one RPC per primary',
    `got ${rpcCalls.length}`)
  const primariesQueried = new Set(rpcCalls.map(c => c.primary))
  assert(primariesQueried.has(39) && primariesQueried.has(224),
    'retrievePersonal: queried both primaries')
}

async function testPersonalSkipsPrimariesWithoutVector() {
  const rpcCalls = []
  const stub = {
    rpc: async (_n, args) => {
      rpcCalls.push(args.p_vq_primary)
      return { data: [{ id: 1, vq_primary: args.p_vq_primary, ai_final_score: 500 }], error: null }
    },
  }
  const vectors = new Map([[39, new Float32Array(384)]])  // 224 absent
  const out = await retrievePersonalPerPrimary(stub, 'user-1', [39, 224], {
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 10, cacheHit: false,
    }),
    formatVectorForPg: () => '[0,0]',
  })
  assert(rpcCalls.length === 1 && rpcCalls[0] === 39,
    'retrievePersonal: skipped primary 224 (no vector)',
    `calls=${rpcCalls.join(',')}`)
  assert(out.length === 1, 'retrievePersonal: 1 candidate from the 1 primary that had a vector')
}

async function testPersonalDedupsById() {
  const stub = {
    rpc: async (_n, args) => ({
      data: [
        { id: 999, vq_primary: args.p_vq_primary, ai_final_score: 700 },
        { id: args.p_vq_primary * 100, vq_primary: args.p_vq_primary, ai_final_score: 600 },
      ],
      error: null,
    }),
  }
  const vectors = new Map([[39, new Float32Array(384)], [224, new Float32Array(384)]])
  const out = await retrievePersonalPerPrimary(stub, 'user-1', [39, 224], {
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 50, cacheHit: false,
    }),
    formatVectorForPg: () => '[0]',
  })
  const ids = out.map(a => a.id)
  assert(new Set(ids).size === ids.length,
    'retrievePersonal: dedups duplicate article id across primaries',
    `ids=${ids.join(',')}`)
  assert(ids.includes(999), 'retrievePersonal: kept the shared article id=999')
}

async function testPersonalHandlesRpcError() {
  const stub = {
    rpc: async (_n, args) => {
      if (args.p_vq_primary === 39) {
        return { data: null, error: { message: 'simulated ANN failure' } }
      }
      return { data: [{ id: 1, vq_primary: args.p_vq_primary, ai_final_score: 500 }], error: null }
    },
  }
  const vectors = new Map([[39, new Float32Array(384)], [224, new Float32Array(384)]])
  const out = await retrievePersonalPerPrimary(stub, 'user-1', [39, 224], {
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 10, cacheHit: false,
    }),
    formatVectorForPg: () => '[0]',
  })
  assert(out.length === 1 && out[0].vq_primary === 224,
    'retrievePersonal: per-primary RPC error is contained (other primaries succeed)',
    `got len=${out.length}`)
}

// ---------------------------------------------------------------------------
// 2026-05-17 — retrievePersonalizedFresh per-primary fan-out (Wave 2).
//
// Pre-change: single RPC with p_vq_primaries=[all] and global sort. Heavy
// supply in one primary crowded out everything else (audit Session B
// 2026-05-16: primary 39 returned 0 of 27 available fresh Tech articles
// because primary 62 had 78 high-scoring China articles).
// Post-change: one RPC per primary, merge + dedup. Each user-interest
// primary gets representation.
// ---------------------------------------------------------------------------

async function testFreshFanOutFiresOneRpcPerPrimary() {
  const rpcCalls = []
  const stub = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, primaries: args.p_vq_primaries, limit: args.p_limit })
      return {
        data: args.p_vq_primaries.map((p, i) => ({
          id: p * 1000 + i,
          vq_primary: p,
          ai_final_score: 700,
        })),
        error: null,
      }
    },
  }
  await retrievePersonalizedFresh(stub, [39, 224, 62], { userId: 'u', limit: 60 })
  assert(rpcCalls.length === 3,
    'fresh fan-out: one RPC per primary (3 primaries → 3 calls)',
    `got ${rpcCalls.length}`)
  const queried = new Set(rpcCalls.map(c => c.primaries[0]))
  assert(queried.has(39) && queried.has(224) && queried.has(62),
    'fresh fan-out: each primary queried exactly once',
    `queried=${Array.from(queried).join(',')}`)
  // perPrimaryLimit = max(2, ceil(60*2 / 3)) = 40
  assert(rpcCalls.every(c => c.limit === 40),
    'fresh fan-out: per-primary limit = ceil(limit*2 / N) = 40',
    `limits=${rpcCalls.map(c => c.limit).join(',')}`)
}

async function testFreshFanOutMergesAndDedupsById() {
  // primary 39 returns id 100 + 39001, primary 62 returns id 100 + 62001.
  // The shared id=100 should dedup; merged result has 3 unique entries.
  const stub = {
    rpc: async (_n, args) => {
      const p = args.p_vq_primaries[0]
      return {
        data: [
          { id: 100, vq_primary: p, ai_final_score: 800 },           // shared
          { id: p * 1000 + 1, vq_primary: p, ai_final_score: 700 },  // unique
        ],
        error: null,
      }
    },
  }
  const out = await retrievePersonalizedFresh(stub, [39, 62], { userId: 'u', limit: 60 })
  const ids = out.map(a => a.id)
  assert(new Set(ids).size === ids.length,
    'fresh fan-out: dedups duplicate article id across primaries',
    `ids=${ids.join(',')}`)
  assert(ids.includes(100),
    'fresh fan-out: kept the shared id once')
  assert(out.length === 3,
    'fresh fan-out: 2 primaries × 2 candidates, minus 1 dup = 3 unique',
    `got ${out.length}`)
}

async function testFreshFanOutHeavySupplyDoesntCrowdOut() {
  // The bug we're fixing: primary 62 has 18 high-scoring articles; primary 39
  // has 5 medium-scoring articles. Under the OLD global-sort behavior, the
  // top 8 would all be primary 62. New behavior: each primary gets a fair
  // share at retrieval time so primary 39 articles survive.
  const stub = {
    rpc: async (_n, args) => {
      const p = args.p_vq_primaries[0]
      if (p === 62) {
        // 18 articles all scoring high
        return {
          data: Array.from({ length: 18 }, (_, i) => ({
            id: 62000 + i, vq_primary: 62, ai_final_score: 900 - i,
          })),
          error: null,
        }
      }
      if (p === 39) {
        // 5 articles scoring medium
        return {
          data: Array.from({ length: 5 }, (_, i) => ({
            id: 39000 + i, vq_primary: 39, ai_final_score: 700 - i * 10,
          })),
          error: null,
        }
      }
      return { data: [], error: null }
    },
  }
  // limit=10, N=2 → perPrimaryLimit = max(2, ceil(20/2)) = 10. RPC returns
  // up to 18 for 62 and 5 for 39, BUT the stub honors p_limit only if we
  // slice — here the stub returns its full list regardless. Real RPC would
  // respect p_limit. For test purposes: just verify primary 39 articles
  // make it into the merged result.
  const out = await retrievePersonalizedFresh(stub, [62, 39], { userId: 'u', limit: 10 })
  const fromPrimary39 = out.filter(a => a.vq_primary === 39).length
  const fromPrimary62 = out.filter(a => a.vq_primary === 62).length
  assert(fromPrimary39 >= 5,
    'fresh fan-out: low-supply primary 39 contributes all 5 of its articles',
    `got ${fromPrimary39}`)
  assert(fromPrimary62 >= 5,
    'fresh fan-out: high-supply primary 62 still represented',
    `got ${fromPrimary62}`)
}

async function testFreshFanOutAppliesExcludeIds() {
  const stub = {
    rpc: async (_n, args) => {
      const p = args.p_vq_primaries[0]
      return {
        data: [
          { id: p * 100 + 1, vq_primary: p, ai_final_score: 700 },
          { id: p * 100 + 2, vq_primary: p, ai_final_score: 650 },
        ],
        error: null,
      }
    },
  }
  // Exclude p=39's first article.
  const out = await retrievePersonalizedFresh(stub, [39, 62], {
    userId: 'u', limit: 60, excludeIds: [3901],
  })
  assert(!out.some(a => a.id === 3901),
    'fresh fan-out: excludeIds filter applied to merged result')
  assert(out.length === 3,
    'fresh fan-out: 4 candidates - 1 excluded = 3',
    `got ${out.length}`)
}

async function testFreshFanOutGuestPathSkipsRpc() {
  // No userId → falls into the legacy global query path (not the fan-out).
  // Stub returns an empty published_articles select.
  const rpcCalls = []
  const fromCalls = []
  const stub = {
    rpc: async (n) => { rpcCalls.push(n); return { data: [], error: null } },
    from: (table) => {
      fromCalls.push(table)
      const chain = {
        select: () => chain,
        in: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        not: () => chain,
        then: (resolve) => resolve({ data: [], error: null }),
      }
      return chain
    },
  }
  await retrievePersonalizedFresh(stub, [39, 62], { limit: 60 })  // no userId
  assert(rpcCalls.length === 0,
    'fresh guest path: no RPC calls when userId is null',
    `got ${rpcCalls.length}`)
  assert(fromCalls.includes('published_articles'),
    'fresh guest path: falls through to direct table query',
    `from=${fromCalls.join(',')}`)
}

// ---------------------------------------------------------------------------
// PR1 (2026-05-18) — weight-proportional per-primary budget allocation.
// Trinity paper Algorithm 2 / Pinterest PinnerSage importance sampling.
// ---------------------------------------------------------------------------

function makeH1(weightsByPrimary) {
  // Sparse → dense Float64Array indexed by vq_primary id.
  const h = new Float64Array(J_PRIMARY)
  for (const [p, w] of Object.entries(weightsByPrimary)) h[Number(p)] = w
  return h
}

function sumOf(map) {
  let s = 0
  for (const v of map.values()) s += v
  return s
}

function testAllocateProportionsRespectH1() {
  // Tech (h1=2000) rank 1 vs China (h1=500) rank 7. Tech should get ~4×.
  const h1 = makeH1({ 39: 2000, 224: 1000, 62: 500, 84: 250 })
  const out = allocatePerPrimaryBudgets(h1, [39, 224, 62, 84], {
    totalBudget: 75,
    perPrimaryFloor: 2,
    perPrimaryCap: 40,
  })
  const a39 = out.get(39)
  const a224 = out.get(224)
  const a62 = out.get(62)
  const a84 = out.get(84)
  assert(a39 > a224 && a224 > a62 && a62 >= a84,
    'allocate: monotonic in h1',
    `[${a39},${a224},${a62},${a84}]`)
  assert(a39 >= 3 * a62,
    'allocate: top-h1 gets ≥3× China-rank-7 slots',
    `top=${a39} rank7=${a62}`)
  assert(sumOf(out) === 75, 'allocate: sum === totalBudget', `sum=${sumOf(out)}`)
}

function testAllocateFloorBindsForWeakPrimaries() {
  // One dominant primary, four near-zero ones. Floor=3 → weakest 4 each get 3.
  const h1 = makeH1({ 1: 5000, 2: 1, 3: 1, 4: 1, 5: 1 })
  const out = allocatePerPrimaryBudgets(h1, [1, 2, 3, 4, 5], {
    totalBudget: 60,
    perPrimaryFloor: 3,
    perPrimaryCap: 50,
  })
  for (const p of [2, 3, 4, 5]) {
    assert(out.get(p) >= 3,
      `allocate: floor binds for weak primary ${p}`,
      `got ${out.get(p)}`)
  }
  assert(out.get(1) === 60 - 4 * out.get(2),
    'allocate: top primary absorbs the residual budget',
    `top=${out.get(1)} weakEach=${out.get(2)}`)
  assert(sumOf(out) === 60, 'allocate: sum exact', `sum=${sumOf(out)}`)
}

function testAllocateCapBindsForDominantPrimary() {
  // 99% of weight in primary 1, but cap=20. Residual must redistribute.
  const h1 = makeH1({ 1: 9900, 2: 50, 3: 50 })
  const out = allocatePerPrimaryBudgets(h1, [1, 2, 3], {
    totalBudget: 90,
    perPrimaryFloor: 2,
    perPrimaryCap: 20,
  })
  assert(out.get(1) === 20,
    'allocate: cap clamps the dominant primary',
    `got ${out.get(1)}`)
  // Residual (90 - 20 - small from 2/3) should flow back to the remaining
  // primaries. They will hit cap too in this extreme case.
  assert(out.get(2) === 20 && out.get(3) === 20,
    'allocate: residual rebalances to next-strongest, hitting cap',
    `2=${out.get(2)} 3=${out.get(3)}`)
}

function testAllocateSumIsExactWhenNonPathological() {
  // Random-ish weights. Sum invariant is the contract.
  const h1 = makeH1({ 10: 173, 11: 91, 12: 47, 13: 22, 14: 9 })
  const out = allocatePerPrimaryBudgets(h1, [10, 11, 12, 13, 14], {
    totalBudget: 80,
    perPrimaryFloor: 2,
    perPrimaryCap: 40,
  })
  assert(sumOf(out) === 80, 'allocate: sum invariant', `sum=${sumOf(out)}`)
  for (const v of out.values()) {
    assert(v >= 2 && v <= 40,
      'allocate: every value within [floor, cap]',
      `value=${v}`)
  }
}

function testAllocateColdUserFallsBackToUniform() {
  // All-zero h1 (cold user). Should distribute evenly at/above floor.
  const h1 = makeH1({})
  const out = allocatePerPrimaryBudgets(h1, [1, 2, 3, 4], {
    totalBudget: 40,
    perPrimaryFloor: 2,
    perPrimaryCap: 40,
  })
  const values = Array.from(out.values())
  const min = Math.min(...values)
  const max = Math.max(...values)
  assert(max - min <= 1,
    'allocate: cold user → near-uniform allocation',
    `values=${values.join(',')}`)
  assert(values.every(v => v >= 2), 'allocate: cold user respects floor')
}

function testAllocateEmptyPrimariesReturnsEmptyMap() {
  const out = allocatePerPrimaryBudgets(new Float64Array(J_PRIMARY), [], {
    totalBudget: 90,
  })
  assert(out.size === 0, 'allocate: empty primaries → empty map', `size=${out.size}`)
}

function testAllocateBudgetTooSmallForFloorsDistributesEvenly() {
  // 5 primaries × floor=10 = 50; budget=20. Each gets floor(20/5)=4, clamped
  // up to floor would exceed budget. The pathological branch divides evenly.
  const h1 = makeH1({ 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 })
  const out = allocatePerPrimaryBudgets(h1, [1, 2, 3, 4, 5], {
    totalBudget: 20,
    perPrimaryFloor: 10,
    perPrimaryCap: 40,
  })
  assert(out.size === 5, 'allocate: pathological — still emits a value per primary',
    `size=${out.size}`)
  for (const v of out.values()) {
    assert(v >= 1, 'allocate: pathological — non-zero per primary')
  }
}

async function testPersonalPerPrimaryUsesLimitMap() {
  // PR1 wiring — perPrimaryLimitMap must drive p_limit at the RPC level.
  const rpcCalls = []
  const stub = {
    rpc: async (_n, args) => {
      rpcCalls.push({ primary: args.p_vq_primary, limit: args.p_limit })
      return { data: [{ id: args.p_vq_primary, vq_primary: args.p_vq_primary, ai_final_score: 700 }], error: null }
    },
  }
  const vectors = new Map([
    [39, new Float32Array(384)],
    [224, new Float32Array(384)],
    [62, new Float32Array(384)],
  ])
  const limitMap = new Map([[39, 30], [224, 12], [62, 4]])
  await retrievePersonalPerPrimary(stub, 'user-pr1', [39, 224, 62], {
    perPrimaryLimitMap: limitMap,
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 50, cacheHit: false,
    }),
    formatVectorForPg: () => '[0]',
  })
  const limitFor = (p) => rpcCalls.find(c => c.primary === p)?.limit
  assert(limitFor(39) === 30,
    'personalPerPrimary: limit map drives p_limit for primary 39',
    `got ${limitFor(39)}`)
  assert(limitFor(224) === 12,
    'personalPerPrimary: limit map drives p_limit for primary 224',
    `got ${limitFor(224)}`)
  assert(limitFor(62) === 4,
    'personalPerPrimary: limit map drives p_limit for primary 62',
    `got ${limitFor(62)}`)
}

async function testPersonalPerPrimaryLegacyLimitStillWorks() {
  // Backwards-compat: if no limit map is provided, uniform perPrimaryLimit
  // is still used. Protects existing test stubs and cold-user paths.
  const rpcCalls = []
  const stub = {
    rpc: async (_n, args) => {
      rpcCalls.push({ primary: args.p_vq_primary, limit: args.p_limit })
      return { data: [], error: null }
    },
  }
  const vectors = new Map([[39, new Float32Array(384)], [224, new Float32Array(384)]])
  await retrievePersonalPerPrimary(stub, 'user-pr1-legacy', [39, 224], {
    perPrimaryLimit: 15,
    getPrimaryUserVectors: async () => ({
      vectorsByPrimary: vectors, bufferSize: 10, cacheHit: false,
    }),
    formatVectorForPg: () => '[0]',
  })
  assert(rpcCalls.every(c => c.limit === 15),
    'personalPerPrimary: legacy uniform perPrimaryLimit honored',
    `limits=${rpcCalls.map(c => c.limit).join(',')}`)
}

;(async () => {
  await testPersonalReturnsEmptyOnNoUserId()
  await testPersonalReturnsEmptyOnNoPrimaries()
  await testPersonalReturnsEmptyWhenNoVectors()
  await testPersonalOnePerPrimary()
  await testPersonalSkipsPrimariesWithoutVector()
  await testPersonalDedupsById()
  await testPersonalHandlesRpcError()
  await testFreshFanOutFiresOneRpcPerPrimary()
  await testFreshFanOutMergesAndDedupsById()
  await testFreshFanOutHeavySupplyDoesntCrowdOut()
  await testFreshFanOutAppliesExcludeIds()
  await testFreshFanOutGuestPathSkipsRpc()

  // PR1 — weight-proportional allocation.
  testAllocateProportionsRespectH1()
  testAllocateFloorBindsForWeakPrimaries()
  testAllocateCapBindsForDominantPrimary()
  testAllocateSumIsExactWhenNonPathological()
  testAllocateColdUserFallsBackToUniform()
  testAllocateEmptyPrimariesReturnsEmptyMap()
  testAllocateBudgetTooSmallForFloorsDistributesEvenly()
  await testPersonalPerPrimaryUsesLimitMap()
  await testPersonalPerPrimaryLegacyLimitStillWorks()

  console.log(`\nResults: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
})()

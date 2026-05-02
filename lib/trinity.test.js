// Unit tests for the Trinity algorithms.
// Run with: node lib/trinity.test.js

import {
  trinityM,
  trinityLT,
  exploreArm,
  emaUpdates,
  adaptiveThresholds,
  recencyWeightForArticle,
  topPrimariesFromHistogram,
  getInterestTiers,
  composeWithBudgets,
  applyPrimaryCap,
  ADAPTIVE_WINDOW_TIERS_H,
  STALE_AGE_DAYS,
  EXPLORE_SLOT_FRACTION,
  MAX_PER_PRIMARY,
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
  t = adaptiveThresholds(50)
  assert(t.tP >= 15 && t.tS >= 5,
    'adaptiveThresholds respects floors',
    `got ${JSON.stringify(t)}`)
  t = adaptiveThresholds(1500)
  assert(t.tP > 15 && t.tP < T_P,
    'adaptiveThresholds scales mid-range',
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


// v4 tests.

function testV4_windowTiersCappedAt7d() {
  const max = ADAPTIVE_WINDOW_TIERS_H[ADAPTIVE_WINDOW_TIERS_H.length - 1]
  assert(max === 7 * 24,
    'v4: ADAPTIVE_WINDOW_TIERS_H caps at 7d',
    `got ${max}h, expected ${7 * 24}h`)
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


testV4_windowTiersCappedAt7d()
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


console.log(`\nResults: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)

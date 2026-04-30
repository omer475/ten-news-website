// Unit tests for the Trinity algorithms in lib/trinity.js.
// Run with: node lib/trinity.test.js
//
// These tests verify paper-exact behaviour of Algorithms 1 and 2 with no
// dependency on Supabase or the network. They cover the qualifying-event gate,
// Trinity-M (multi-interest), Trinity-LT (long-tail) and the EMA update.

import {
  trinityM,
  trinityLT,
  emaUpdates,
  J_PRIMARY,
  K_SECONDARY,
  T_P,
  T_S,
  T_L,
  T_I,
  N_C,
  N_M,
  N_LT,
  LT_ALPHA,
  LT_BETA,
} from './trinity.js'

let passed = 0
let failed = 0
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// Build a deterministic 128->1024 hierarchical parent map (8 sub per primary).
const PARENT_MAP = (() => {
  const m = new Array(K_SECONDARY)
  for (let c2 = 0; c2 < K_SECONDARY; c2++) m[c2] = Math.floor(c2 / 8)
  return m
})()


// Seeded LCG so tests are reproducible.
function seededRng(seed = 0xC0FFEE) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}


// ---------- Trinity-M ----------

function testTrinityM_hotspot() {
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  // Three primary interests, all above T_P; only their first child is above T_S.
  // Add ample non-zero h² elsewhere so the global-argmax pad can fill to N_M.
  for (const c1 of [3, 17, 42]) {
    h1[c1] = T_P + 5
    h2[c1 * 8] = T_S + 1
  }
  for (let c2 = 500; c2 < 520; c2++) h2[c2] = 1
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  const expectedFirstThree = new Set([3 * 8, 17 * 8, 42 * 8])
  const firstThreePicks = new Set(out.slice(0, 3))
  assert(out.length === N_M, 'trinity-m returns N_M picks when global pad is available',
    `got ${out.length} expected ${N_M}`)
  assert([...firstThreePicks].every(p => expectedFirstThree.has(p)),
    'trinity-m primary picks honour T_P / T_S',
    `got ${[...firstThreePicks]}`)
}


function testTrinityM_oneRandomSecondaryPerPrimary() {
  // One primary, several eligible kids — picks should vary across rng seeds.
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h1[5] = T_P + 1
  for (let s = 0; s < 8; s++) h2[5 * 8 + s] = T_S + 1   // all 8 kids eligible
  const seen = new Set()
  for (let seed = 1; seed <= 50; seed++) {
    const rng = seededRng(seed * 31)
    const pick = trinityM(h1, h2, PARENT_MAP, rng)[0]
    seen.add(pick)
  }
  assert(seen.size >= 4,
    'trinity-m "one random secondary per primary" diversifies across seeds',
    `only saw ${seen.size} distinct child picks across 50 seeds`)
}


function testTrinityM_fallbackToArgmaxWhenNoEligibleKids() {
  // Primary is hot, but no kid clears T_S. Fall back to argmax kid instead.
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h1[10] = T_P + 5
  h2[10 * 8 + 0] = T_S - 1
  h2[10 * 8 + 3] = T_S - 5
  h2[10 * 8 + 7] = T_S - 2  // largest below T_S
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  // Fallback expected: argmax under threshold = local index 0 (T_S - 1 is largest).
  assert(out[0] === 10 * 8 + 0,
    'trinity-m fallback picks argmax kid when no kid clears T_S',
    `got first pick ${out[0]}, expected ${10 * 8 + 0}`)
}


function testTrinityM_paddingFromGlobalLargest() {
  // No primary clears T_P. Output should pad from globally-largest h².
  const h1 = new Int32Array(J_PRIMARY)
  const h2 = new Int32Array(K_SECONDARY)
  h2[12] = 50
  h2[34] = 25
  h2[7]  = 12
  const out = trinityM(h1, h2, PARENT_MAP, seededRng())
  assert(out.slice(0, 3).join(',') === '12,34,7',
    'trinity-m pads to N_M with global argmax h² when no primary qualifies',
    `got ${out.slice(0, 3)}`)
}


// ---------- Trinity-LT ----------

function testTrinityLT_basicSamplingHonoursThresholds() {
  // Make eligible pool larger than N_LT so sampling actually competes.
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  const state = new Map()
  // 40 low-affinity clusters (h² = T_L), 1 very-high affinity cluster.
  // With α=0.75 and many low competitors, the high-affinity one should be
  // sampled in nearly every run; that's the directional check we want.
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
  // A cluster below T_L; should never be sampled.
  h2[300] = T_L - 1
  inv[300] = T_I + 1
  state.set(300, { b_score: 1e6 - 300, last_shown_at: new Date(0).toISOString(), shown_count: 0 })

  const sampled = new Map()
  let runs = 0
  for (let seed = 1; seed <= 200; seed++) {
    const out = trinityLT(h2, state, inv, seededRng(seed * 7))
    runs += 1
    for (const c of out) sampled.set(c, (sampled.get(c) || 0) + 1)
  }

  assert(!sampled.has(300),
    'trinity-lt excludes clusters below T_L',
    `got 300 sampled ${sampled.get(300)} times`)

  const high = sampled.get(HIGH) || 0
  // Average low-cluster sample rate across the 40 competitors.
  const totalLow = lowClusters.reduce((s, c) => s + (sampled.get(c) || 0), 0)
  const avgLow = totalLow / lowClusters.length
  assert(high > avgLow * 1.5,
    'trinity-lt weight monotonically prefers higher user h² (α=0.75)',
    `high=${high} avgLow=${avgLow.toFixed(1)} (high should be ~1.5× avg low at minimum)`)
}


function testTrinityLT_dropsClustersBelowTi() {
  const h2 = new Int32Array(K_SECONDARY)
  h2[200] = T_L + 5
  h2[201] = T_L + 5
  const inv = new Int32Array(K_SECONDARY)
  inv[200] = T_I + 5         // ok
  inv[201] = T_I - 1         // below floor
  const state = new Map()
  state.set(200, { b_score: 100, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  state.set(201, { b_score: 100, last_shown_at: new Date(0).toISOString(), shown_count: 0 })

  let sampled201 = 0
  for (let seed = 1; seed <= 100; seed++) {
    const out = trinityLT(h2, state, inv, seededRng(seed))
    if (out.includes(201)) sampled201 += 1
  }
  assert(sampled201 === 0, 'trinity-lt drops clusters with inventory < T_I',
    `cluster 201 was sampled ${sampled201}/100 runs`)
}


function testTrinityLT_returnsAtMostNLT() {
  const h2 = new Int32Array(K_SECONDARY)
  const inv = new Int32Array(K_SECONDARY)
  for (let c = 300; c < 400; c++) {
    h2[c] = T_L + 2
    inv[c] = T_I + 1
  }
  const state = new Map()
  for (let c = 300; c < 400; c++) {
    state.set(c, { b_score: 1000 + c, last_shown_at: new Date(0).toISOString(), shown_count: 0 })
  }
  const out = trinityLT(h2, state, inv, seededRng(42))
  assert(out.length === N_LT,
    'trinity-lt returns exactly N_LT clusters when pool is large',
    `got ${out.length} expected ${N_LT}`)
}


// ---------- EMA update ----------

function testEMA_updatesShownClusters() {
  const state = new Map()
  state.set(7, { b_score: 0, last_shown_at: new Date(Date.now() - 60_000).toISOString(), shown_count: 5 })
  const rows = emaUpdates(state, [7, 9, 7], Date.now())  // duplicate 7 should dedupe
  assert(rows.length === 2, 'ema update dedupes shownClusterIds', `got ${rows.length}`)
  const update7 = rows.find(r => r.cluster_id === 7)
  assert(update7 && update7.b_score > 0,
    'ema update bumps b_score for shown cluster',
    `b_score=${update7?.b_score}`)
  const update9 = rows.find(r => r.cluster_id === 9)
  assert(update9 && update9.shown_count === 1,
    'ema update initialises new cluster shown_count',
    `shown_count=${update9?.shown_count}`)
}


// Run all tests.
testTrinityM_hotspot()
testTrinityM_oneRandomSecondaryPerPrimary()
testTrinityM_fallbackToArgmaxWhenNoEligibleKids()
testTrinityM_paddingFromGlobalLargest()
testTrinityLT_basicSamplingHonoursThresholds()
testTrinityLT_dropsClustersBelowTi()
testTrinityLT_returnsAtMostNLT()
testEMA_updatesShownClusters()

console.log(`\nResults: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)

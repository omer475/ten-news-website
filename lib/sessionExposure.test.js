// Tests for lib/sessionExposure.js (Fix B, 2026-05-12).
// Run: node lib/sessionExposure.test.js

import {
  loadSessionExposure,
  bumpSessionExposure,
  HALF_LIFE_MIN,
  FLOOR,
  _internals,
} from './sessionExposure.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// ---------------------------------------------------------------------------
// Constants locked
function testConstantsLocked() {
  assert(HALF_LIFE_MIN.primary === 60, 'primary half-life = 60 min', `got ${HALF_LIFE_MIN.primary}`)
  assert(HALF_LIFE_MIN.secondary === 30, 'secondary half-life = 30 min', `got ${HALF_LIFE_MIN.secondary}`)
  assert(HALF_LIFE_MIN.source === 20, 'source half-life = 20 min', `got ${HALF_LIFE_MIN.source}`)
  assert(FLOOR.primary === 0.50, 'primary floor 0.50', `got ${FLOOR.primary}`)
  assert(FLOOR.secondary === 0.40, 'secondary floor 0.40', `got ${FLOOR.secondary}`)
  assert(FLOOR.source === 0.35, 'source floor 0.35', `got ${FLOOR.source}`)
}

// ---------------------------------------------------------------------------
// Decay math
function testDecayedCountAtZeroAge() {
  const c = _internals.decayedCount(9, 0, 60)
  assert(Math.abs(c - 9) < 1e-6, 'decayedCount at age=0 == raw count', `got ${c}`)
}

function testDecayedCountAfterHalfLife() {
  // After exactly one half-life, count should halve.
  const c = _internals.decayedCount(9, 60, 60)
  assert(Math.abs(c - 4.5) < 0.01, 'decayedCount halves after half-life', `got ${c}`)
}

function testDecayedCountAfterMultipleHalfLives() {
  const c = _internals.decayedCount(9, 180, 60)  // 3 half-lives
  assert(Math.abs(c - 9 * 0.125) < 0.01,
    'decayedCount after 3 half-lives → ~1/8 of original',
    `got ${c.toFixed(3)}`)
}

function testDecayedCountZeroOrNegativeInput() {
  assert(_internals.decayedCount(0, 60, 60) === 0, 'count=0 → 0')
  assert(_internals.decayedCount(-1, 60, 60) === 0, 'count<0 → 0')
}

// ---------------------------------------------------------------------------
// Multiplier formula
function testMultiplierAtZeroExposure() {
  // No exposure → multiplier 1.0 (full score)
  assert(_internals.multForAxis('primary', 0) === 1.0,
    'primary mult at exposure=0 → 1.0')
}

function testMultiplierApproachesFloor() {
  // Very high exposure → mult ≈ floor
  const m = _internals.multForAxis('primary', 1000)
  assert(Math.abs(m - 0.50) < 0.01,
    'primary mult at huge exposure approaches floor 0.50', `got ${m}`)
}

function testMultiplierMonotonicallyDecreases() {
  let prev = 1.0
  for (let c = 1; c <= 20; c++) {
    const m = _internals.multForAxis('primary', c)
    assert(m <= prev, `mult monotonically decreases at c=${c}`, `prev=${prev} m=${m}`)
    prev = m
  }
}

function testSecondaryFloorTighter() {
  // Secondary floors at 0.40 (tighter than primary's 0.50).
  const m = _internals.multForAxis('secondary', 1000)
  assert(Math.abs(m - 0.40) < 0.01,
    'secondary mult approaches floor 0.40', `got ${m}`)
}

function testSourceFloorTightest() {
  const m = _internals.multForAxis('source', 1000)
  assert(Math.abs(m - 0.35) < 0.01,
    'source mult approaches floor 0.35', `got ${m}`)
}

// ---------------------------------------------------------------------------
// loadSessionExposure — stubbed Supabase client.
function makeStub(rows, error = null) {
  return {
    from(table) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        limit: () => builder,
        then: (resolve) => resolve({ data: error ? null : rows, error }),
      }
      return builder
    },
  }
}

async function testLoadEmptyUser() {
  const x = await loadSessionExposure(makeStub([]), 'u-1')
  assert(typeof x.multiplierFor === 'function', 'empty load returns mult fn')
  assert(x.multiplierFor({ vq_primary: 62 }) === 1.0,
    'empty load: every article gets 1.0× mult')
}

async function testLoadNullUserId() {
  const x = await loadSessionExposure(makeStub([]), null)
  assert(x.multiplierFor({}) === 1.0, 'null userId → noop mult')
}

async function testLoadHappyPath() {
  // 2026-05-13 (composition cleanup): primary axis is DISABLED in the
  // read-side. Test still asserts source + secondary discounts apply.
  // User has 4 secondary-494 hits 8 min ago + 6 SCMP source hits 10 min ago.
  const now = Date.now()
  const rows = [
    { axis: 'primary',   value: '62',  count: 9, last_updated_at: new Date(now - 5*60_000).toISOString() },
    { axis: 'secondary', value: '494', count: 4, last_updated_at: new Date(now - 8*60_000).toISOString() },
    { axis: 'source',    value: 'scmp', count: 6, last_updated_at: new Date(now - 10*60_000).toISOString() },
  ]
  const x = await loadSessionExposure(makeStub(rows), 'u-1')

  // Article in primary 62 from SCMP → multiplier discounted by source axis.
  // Primary axis is disabled so it contributes 1.0; source axis carries the
  // discount.
  const m62 = x.multiplierFor({ vq_primary: 62, source: 'SCMP' })
  assert(m62 < 0.8,
    'happy: source SCMP discounts via source axis',
    `got ${m62.toFixed(3)}`)

  // Article in secondary 494 → discounted by secondary axis even though
  // primary is disabled.
  const mSec = x.multiplierFor({ vq_primary: 224, vq_secondary: 494, source: 'TechCrunch' })
  assert(mSec < 1.0,
    'happy: secondary-494 discounts via secondary axis',
    `got ${mSec.toFixed(3)}`)

  // Primary-only exposure (no secondary/source match) → multiplier is 1.0
  // because primary axis is disabled.
  const mPrimaryOnly = x.multiplierFor({ vq_primary: 62, source: 'TechCrunch' })
  assert(mPrimaryOnly === 1.0,
    'happy: primary-only exposure ignored (primary axis disabled)',
    `got ${mPrimaryOnly.toFixed(3)}`)

  // Article in a primary with zero exposure → 1.0×.
  const mFresh = x.multiplierFor({ vq_primary: 224, source: 'TechCrunch' })
  assert(mFresh === 1.0,
    'happy: untouched primary + fresh source → 1.0×',
    `got ${mFresh}`)
}

async function testLoadOldEntryDecaysToNoop() {
  // Entry from 5 hours ago — should be near-zero exposure after decay.
  const rows = [
    { axis: 'primary', value: '62', count: 9, last_updated_at: new Date(Date.now() - 5*3600_000).toISOString() },
  ]
  const x = await loadSessionExposure(makeStub(rows), 'u-1')
  const m = x.multiplierFor({ vq_primary: 62 })
  assert(m > 0.95,
    'old entry (5h ago) decays to near-1.0',
    `got ${m.toFixed(3)}`)
}

async function testLoadErrorPath() {
  const x = await loadSessionExposure(makeStub([], { message: 'simulated' }), 'u-1')
  assert(x.multiplierFor({ vq_primary: 62 }) === 1.0,
    'RPC error returns noop mult')
}

// ---------------------------------------------------------------------------
// bumpSessionExposure
async function testBumpBuildsCorrectArrays() {
  const captured = []
  const stub = {
    rpc: async (name, args) => {
      captured.push({ name, args })
      return { data: null, error: null }
    },
  }
  await bumpSessionExposure(stub, 'u-1', [
    { vq_primary: 62, vq_secondary: 494, source: 'SCMP' },
    { vq_primary: 19, vq_secondary: 156, source: 'TechCrunch' },
  ])
  assert(captured.length === 1, 'bump: one RPC call', `got ${captured.length}`)
  assert(captured[0].name === 'bump_session_exposure', 'bump: correct RPC name')
  const a = captured[0].args
  assert(a.p_axes.length === a.p_values.length,
    'bump: axes/values arrays same length')
  assert(a.p_axes.length === 6,
    'bump: 2 items × 3 axes = 6 entries', `got ${a.p_axes.length}`)
  // Source values should be lowercased.
  const sources = a.p_axes.map((ax, i) => ax === 'source' ? a.p_values[i] : null).filter(Boolean)
  assert(sources.every(s => s === s.toLowerCase()),
    'bump: source values lowercased',
    `got ${sources.join(',')}`)
}

async function testBumpSkipsEmptySlate() {
  let called = false
  const stub = { rpc: async () => { called = true; return { data: null, error: null } } }
  await bumpSessionExposure(stub, 'u-1', [])
  assert(!called, 'bump: empty slate skips RPC')
}

async function testBumpSkipsNullUserId() {
  let called = false
  const stub = { rpc: async () => { called = true; return { data: null, error: null } } }
  await bumpSessionExposure(stub, null, [{ vq_primary: 62 }])
  assert(!called, 'bump: null userId skips RPC')
}

async function testBumpHandlesMissingFields() {
  const captured = []
  const stub = {
    rpc: async (n, a) => { captured.push(a); return { data: null, error: null } },
  }
  await bumpSessionExposure(stub, 'u-1', [
    { vq_primary: 62 },                              // primary only
    { vq_secondary: 494, source: 'SCMP' },           // no primary
    { source: 'TechCrunch' },                        // source only
  ])
  assert(captured[0].p_axes.length === 4,
    'bump: skips missing fields',
    `got ${captured[0].p_axes.length}`)
}

;(async () => {
  testConstantsLocked()
  testDecayedCountAtZeroAge()
  testDecayedCountAfterHalfLife()
  testDecayedCountAfterMultipleHalfLives()
  testDecayedCountZeroOrNegativeInput()
  testMultiplierAtZeroExposure()
  testMultiplierApproachesFloor()
  testMultiplierMonotonicallyDecreases()
  testSecondaryFloorTighter()
  testSourceFloorTightest()
  await testLoadEmptyUser()
  await testLoadNullUserId()
  await testLoadHappyPath()
  await testLoadOldEntryDecaysToNoop()
  await testLoadErrorPath()
  await testBumpBuildsCorrectArrays()
  await testBumpSkipsEmptySlate()
  await testBumpSkipsNullUserId()
  await testBumpHandlesMissingFields()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})()

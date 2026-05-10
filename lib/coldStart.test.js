// Phase 1.8 (2026-05-10) — Unit tests for cold-start warm-start synthesis.
//
// Run: node lib/coldStart.test.js

import {
  ONBOARDING_TOPIC_MAP,
  syntheticDecayFactor,
  loadUserOnboardingTopics,
  resolveClustersForTopics,
  synthesizeWarmStartHistogram,
  SYNTHETIC_PRIMARY_WEIGHT,
  SYNTHETIC_SECONDARY_WEIGHT,
  SYNTHETIC_DECAY_THRESHOLD,
} from './coldStart.js'
import { J_PRIMARY, K_SECONDARY } from './trinity.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// ---------------------------------------------------------------------------
// syntheticDecayFactor
// ---------------------------------------------------------------------------
function testDecayFactor() {
  assert(syntheticDecayFactor(0) === 1.0, 'decay: QC=0 → factor=1.0')
  assert(syntheticDecayFactor(50) === 0.5, 'decay: QC=50 → factor=0.5')
  assert(syntheticDecayFactor(100) === 0.0, 'decay: QC=100 → factor=0.0')
  assert(syntheticDecayFactor(150) === 0.0, 'decay: QC>threshold → factor=0.0')
  assert(syntheticDecayFactor(-5) === 1.0, 'decay: negative QC → factor=1.0 (treat as 0)')
}

// ---------------------------------------------------------------------------
// ONBOARDING_TOPIC_MAP shape
// ---------------------------------------------------------------------------
function testTopicMapShape() {
  assert(typeof ONBOARDING_TOPIC_MAP === 'object', 'topic map: is an object')
  assert(Object.keys(ONBOARDING_TOPIC_MAP).length >= 30, 'topic map: has >= 30 topics')
  assert('ai_ml' in ONBOARDING_TOPIC_MAP, 'topic map: contains ai_ml')
  assert('nba' in ONBOARDING_TOPIC_MAP, 'topic map: contains nba')
  assert('bitcoin' in ONBOARDING_TOPIC_MAP, 'topic map: contains bitcoin')
  for (const [code, meta] of Object.entries(ONBOARDING_TOPIC_MAP)) {
    if (!Array.isArray(meta.tags) || meta.tags.length === 0) {
      fail(`topic map: ${code} has empty/missing tags`, JSON.stringify(meta))
      return
    }
  }
  ok('topic map: every entry has non-empty tags array')
}

// ---------------------------------------------------------------------------
// loadUserOnboardingTopics
// ---------------------------------------------------------------------------
async function testLoadOnboardingTopics() {
  const stub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { followed_topics: ['ai_ml', 'nba', 'crypto_regulation'] },
            error: null,
          }),
        }),
      }),
    }),
  }
  const topics = await loadUserOnboardingTopics(stub, 'user-1')
  assert(Array.isArray(topics) && topics.length === 3, 'load topics: returns array of 3', `got ${JSON.stringify(topics)}`)
  assert(topics.includes('ai_ml'), 'load topics: includes ai_ml')

  const empty = await loadUserOnboardingTopics(stub, null)
  assert(Array.isArray(empty) && empty.length === 0, 'load topics: null userId returns empty')
}

// ---------------------------------------------------------------------------
// resolveClustersForTopics — table-hit path
// ---------------------------------------------------------------------------
async function testResolveClustersFromTable() {
  const stub = {
    from: (table) => {
      if (table === 'onboarding_topic_clusters') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { topic_code: 'ai_ml', vq_primary: 39, vq_secondary: 312, weight: 0.6 },
                { topic_code: 'ai_ml', vq_primary: 39, vq_secondary: 313, weight: 0.4 },
              ],
              error: null,
            }),
          }),
        }
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  }
  const map = await resolveClustersForTopics(stub, ['ai_ml'])
  assert(map.size === 2, 'resolve: returns 2 secondaries from lookup table', `size=${map.size}`)
  assert(map.get(312)?.vq_primary === 39, 'resolve: secondary 312 maps to primary 39')
  assert(map.get(312)?.weight === 0.6, 'resolve: weight preserved')
}

// ---------------------------------------------------------------------------
// resolveClustersForTopics — live fallback path
// ---------------------------------------------------------------------------
async function testResolveClustersLiveFallback() {
  const stub = {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),  // table empty
      }),
    }),
    rpc: (name) => {
      if (name === 'onboarding_clusters_live') {
        return Promise.resolve({
          data: [
            { vq_primary: 224, vq_secondary: 1792, cnt: 50 },
            { vq_primary: 224, vq_secondary: 1793, cnt: 30 },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    },
  }
  const map = await resolveClustersForTopics(stub, ['nba'])
  assert(map.size === 2, 'fallback: returns 2 secondaries from live RPC', `size=${map.size}`)
  // Weights normalized: 50/(50+30)=0.625, 30/(50+30)=0.375
  const w1 = map.get(1792)?.weight
  assert(Math.abs(w1 - 0.625) < 0.01, 'fallback: top secondary weight = 0.625', `got ${w1}`)
}

// ---------------------------------------------------------------------------
// synthesizeWarmStartHistogram — happy path at QC=0
// ---------------------------------------------------------------------------
async function testSynthesizeAtCold() {
  const stub = {
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { followed_topics: ['ai_ml'] },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'onboarding_topic_clusters') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { topic_code: 'ai_ml', vq_primary: 39, vq_secondary: 312, weight: 1.0 },
              ],
              error: null,
            }),
          }),
        }
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  }

  const h1 = new Float64Array(J_PRIMARY)
  const h2 = new Float64Array(K_SECONDARY)
  const debug = await synthesizeWarmStartHistogram(stub, 'user-1', h1, h2, 0)
  assert(debug.applied === true, 'synthesize: applied=true at QC=0', JSON.stringify(debug))
  assert(debug.factor === 1.0, 'synthesize: factor=1.0 at QC=0')
  assert(h1[39] === SYNTHETIC_PRIMARY_WEIGHT, `synthesize: h1[39] = ${SYNTHETIC_PRIMARY_WEIGHT}`, `got ${h1[39]}`)
  assert(h2[312] === SYNTHETIC_SECONDARY_WEIGHT, `synthesize: h2[312] = ${SYNTHETIC_SECONDARY_WEIGHT}`, `got ${h2[312]}`)
}

// ---------------------------------------------------------------------------
// synthesizeWarmStartHistogram — half-decay at QC=50
// ---------------------------------------------------------------------------
async function testSynthesizeAtMid() {
  const stub = {
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { followed_topics: ['ai_ml'] },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'onboarding_topic_clusters') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { topic_code: 'ai_ml', vq_primary: 39, vq_secondary: 312, weight: 1.0 },
              ],
              error: null,
            }),
          }),
        }
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  }

  const h1 = new Float64Array(J_PRIMARY)
  const h2 = new Float64Array(K_SECONDARY)
  // h1 already has 100 from real engagement on primary 39
  h1[39] = 100
  const debug = await synthesizeWarmStartHistogram(stub, 'user-1', h1, h2, 50)
  assert(debug.applied === true, 'synthesize-mid: applied=true at QC=50')
  assert(debug.factor === 0.5, 'synthesize-mid: factor=0.5 at QC=50', `got ${debug.factor}`)
  // h1[39] = 100 (real) + 12 * 0.5 = 106
  assert(h1[39] === 100 + SYNTHETIC_PRIMARY_WEIGHT * 0.5, 'synthesize-mid: h1[39] = real + half synthetic',
    `got ${h1[39]} expected ${100 + SYNTHETIC_PRIMARY_WEIGHT * 0.5}`)
}

// ---------------------------------------------------------------------------
// synthesizeWarmStartHistogram — no-op above threshold
// ---------------------------------------------------------------------------
async function testSynthesizeAboveThreshold() {
  const stub = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { followed_topics: ['ai_ml'] }, error: null }) }) }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }
  const h1 = new Float64Array(J_PRIMARY)
  const h2 = new Float64Array(K_SECONDARY)
  const debug = await synthesizeWarmStartHistogram(stub, 'user-1', h1, h2, SYNTHETIC_DECAY_THRESHOLD + 1)
  assert(debug.applied === false, 'synthesize: applied=false above threshold')
  assert(debug.reason === 'qc-above-threshold', 'synthesize: reason=qc-above-threshold')
  assert(h1[39] === 0, 'synthesize: h1 unchanged above threshold')
}

// ---------------------------------------------------------------------------
// synthesizeWarmStartHistogram — no topics
// ---------------------------------------------------------------------------
async function testSynthesizeNoTopics() {
  const stub = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { followed_topics: [] }, error: null }) }) }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }
  const h1 = new Float64Array(J_PRIMARY)
  const h2 = new Float64Array(K_SECONDARY)
  const debug = await synthesizeWarmStartHistogram(stub, 'user-1', h1, h2, 0)
  assert(debug.applied === false, 'synthesize: applied=false with no topics')
  assert(debug.reason === 'no-topics', 'synthesize: reason=no-topics')
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('Phase 1.8 — coldStart.js unit tests\n')
  testDecayFactor()
  testTopicMapShape()
  await testLoadOnboardingTopics()
  await testResolveClustersFromTable()
  await testResolveClustersLiveFallback()
  await testSynthesizeAtCold()
  await testSynthesizeAtMid()
  await testSynthesizeAboveThreshold()
  await testSynthesizeNoTopics()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error('test runner error:', e); process.exit(1) })

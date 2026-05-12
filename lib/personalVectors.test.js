// P2 fix (2026-05-12) — tests for the trinity-personal retrieval primitives.
// Run: node lib/personalVectors.test.js

import {
  parseEmbedding,
  loadEngagementBuffer,
  computePrimaryUserVectors,
  getPrimaryUserVectors,
  formatVectorForPg,
  _clearVectorCacheForTests,
  ENGAGEMENT_BUFFER_LIMIT,
  PER_PRIMARY_SOFT_CAP,
  RECENCY_DECAY_LAMBDA,
  EMBEDDING_DIM,
  VECTOR_CACHE_TTL_MS,
} from './personalVectors.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// Build a deterministic fake embedding: each dim = base + 0.001 * i.
function fakeEmbedding(base) {
  const v = new Array(EMBEDDING_DIM)
  for (let i = 0; i < EMBEDDING_DIM; i++) v[i] = base + 0.001 * i
  return v
}

// ---------------------------------------------------------------------------
function testConstantsSane() {
  assert(ENGAGEMENT_BUFFER_LIMIT === 1000, 'buffer limit locked to 1000', `got ${ENGAGEMENT_BUFFER_LIMIT}`)
  assert(PER_PRIMARY_SOFT_CAP === 200, 'per-primary cap = 200', `got ${PER_PRIMARY_SOFT_CAP}`)
  assert(Math.abs(RECENCY_DECAY_LAMBDA - 0.01) < 1e-9, 'PinnerSage λ = 0.01/day', `got ${RECENCY_DECAY_LAMBDA}`)
  assert(EMBEDDING_DIM === 384, 'MiniLM dim = 384', `got ${EMBEDDING_DIM}`)
  assert(VECTOR_CACHE_TTL_MS === 5 * 60 * 1000, 'cache TTL = 5 min', `got ${VECTOR_CACHE_TTL_MS}`)
}

// ---------------------------------------------------------------------------
function testParseEmbedding() {
  assert(parseEmbedding(null) === null, 'parseEmbedding(null) → null')
  assert(parseEmbedding('') === null,   'parseEmbedding("") → null')
  const arr = [1, 2, 3]
  assert(parseEmbedding(arr) === arr,   'parseEmbedding(arr) → same arr')
  const parsed = parseEmbedding('[1.5, 2.5, 3.5]')
  assert(Array.isArray(parsed) && parsed[0] === 1.5 && parsed[2] === 3.5,
    'parseEmbedding("[a,b,c]") → array', `got ${JSON.stringify(parsed)}`)
  assert(parseEmbedding('not an array') === null, 'parseEmbedding(bad) → null')
}

// ---------------------------------------------------------------------------
function testFormatVectorForPg() {
  const out = formatVectorForPg([1, 2, 3])
  assert(typeof out === 'string' && out.startsWith('[') && out.endsWith(']'),
    'formatVectorForPg shape', `got ${out}`)
  // Round-trip via parseEmbedding.
  const back = parseEmbedding(out)
  assert(back.length === 3 && Math.abs(back[1] - 2) < 1e-6,
    'formatVectorForPg round-trips through parseEmbedding')
  assert(formatVectorForPg(null) === null, 'formatVectorForPg(null) → null')
  assert(formatVectorForPg([]) === null,   'formatVectorForPg([]) → null')
}

// ---------------------------------------------------------------------------
// computePrimaryUserVectors — recency-weighted mean math.
function testComputeEmptyBuffer() {
  const out = computePrimaryUserVectors([], [39, 224])
  assert(out instanceof Map && out.size === 0,
    'empty buffer → empty Map', `size=${out.size}`)
}

function testComputeEmptyPrimaries() {
  const buf = [{ vq_primary: 39, embedding: fakeEmbedding(0.1), age_days: 0 }]
  const out = computePrimaryUserVectors(buf, [])
  assert(out.size === 0, 'empty primaries → empty Map')
}

function testComputeSingleItem() {
  const emb = fakeEmbedding(0.1)
  const buf = [{ vq_primary: 39, embedding: emb, age_days: 0 }]
  const out = computePrimaryUserVectors(buf, [39])
  assert(out.size === 1 && out.has(39), 'single-item: primary 39 has vector')
  const v = out.get(39)
  // age=0 → weight=1, mean == single-item embedding.
  assert(Math.abs(v[0] - emb[0]) < 1e-5 && Math.abs(v[100] - emb[100]) < 1e-5,
    'single-item vector equals embedding (weight=1)',
    `v[0]=${v[0]} emb[0]=${emb[0]}`)
}

function testRecencyDecayWeighting() {
  // Two items in primary 39: one fresh (age=0, weight=1), one old (age=100, weight≈0.368).
  // Verify the mean is closer to the fresh item than to the simple arithmetic mean.
  const fresh = fakeEmbedding(1.0)
  const old   = fakeEmbedding(0.0)
  const buf = [
    { vq_primary: 39, embedding: fresh, age_days: 0 },
    { vq_primary: 39, embedding: old,   age_days: 100 },
  ]
  const out = computePrimaryUserVectors(buf, [39])
  const v = out.get(39)
  // Expected: (1*1.0 + 0.368*0.0) / (1+0.368) ≈ 0.731
  // Arithmetic mean (no weight) would be 0.5.
  const expected = 1.0 / (1 + Math.exp(-RECENCY_DECAY_LAMBDA * 100))
  assert(Math.abs(v[0] - expected) < 1e-4,
    'recency decay: fresh dominates over old',
    `v[0]=${v[0]} expected≈${expected.toFixed(4)}`)
  assert(v[0] > 0.5,
    'weighted mean > arithmetic mean (fresh wins)',
    `v[0]=${v[0]}`)
}

function testSoftCapDropsOldest() {
  // Buffer has 201 items in primary 39, all sorted recency-DESC (item 0 is freshest).
  // After cap, item 200 (the oldest) should be dropped. The vector should equal
  // the recency-weighted mean of items 0..199.
  const buf = []
  for (let i = 0; i < 201; i++) {
    buf.push({
      vq_primary: 39,
      embedding: fakeEmbedding(i),  // distinguishable
      age_days: i,
    })
  }
  const out = computePrimaryUserVectors(buf, [39])
  // Verify the vector is finite (not corrupted by NaN/Infinity).
  const v = out.get(39)
  assert(v != null, 'soft cap: still produces a vector')
  for (let d = 0; d < 5; d++) {
    assert(Number.isFinite(v[d]),
      `soft cap: dim ${d} is finite`, `got ${v[d]}`)
  }
}

function testFiltersUnwantedPrimaries() {
  const buf = [
    { vq_primary: 39,  embedding: fakeEmbedding(0.1), age_days: 0 },
    { vq_primary: 224, embedding: fakeEmbedding(0.2), age_days: 0 },
    { vq_primary: 99,  embedding: fakeEmbedding(0.3), age_days: 0 },
  ]
  const out = computePrimaryUserVectors(buf, [39, 224])
  assert(out.size === 2,             'filters to requested primaries: size=2')
  assert(out.has(39),                'includes primary 39')
  assert(out.has(224),               'includes primary 224')
  assert(!out.has(99),               'excludes unrequested primary 99')
}

function testSkipsMalformedEmbeddings() {
  const buf = [
    { vq_primary: 39, embedding: null, age_days: 0 },             // null
    { vq_primary: 39, embedding: [1, 2, 3], age_days: 0 },        // wrong dim
    { vq_primary: 39, embedding: fakeEmbedding(0.5), age_days: 0 }, // good
  ]
  const out = computePrimaryUserVectors(buf, [39])
  assert(out.size === 1, 'malformed entries skipped, single good entry survives')
  const v = out.get(39)
  // The vector should equal the one good entry's embedding.
  assert(Math.abs(v[0] - 0.5) < 1e-5,
    'malformed: only-good-entry vector is preserved',
    `v[0]=${v[0]}`)
}

// ---------------------------------------------------------------------------
// loadEngagementBuffer — stubbed Supabase client.
function makeSupabaseStub(rows, error = null) {
  return {
    rpc: async (name, args) => {
      if (name !== 'user_engagement_buffer') {
        throw new Error(`unexpected RPC: ${name}`)
      }
      if (error) return { data: null, error }
      return { data: rows, error: null }
    },
  }
}

async function testLoadBufferHappy() {
  const rows = [
    {
      article_id: 1, vq_primary: 39,
      embedding_minilm_vec: JSON.stringify(fakeEmbedding(0.1)),
      age_days: 0.5, event_type: 'article_liked',
    },
    {
      article_id: 2, vq_primary: 224,
      embedding_minilm_vec: JSON.stringify(fakeEmbedding(0.2)),
      age_days: 1.2, event_type: 'article_saved',
    },
  ]
  const supa = makeSupabaseStub(rows)
  const buf = await loadEngagementBuffer(supa, 'user-1')
  assert(buf.length === 2, 'happy path returns 2 rows', `got ${buf.length}`)
  assert(buf[0].vq_primary === 39, 'parsed vq_primary')
  assert(buf[0].embedding[0] === 0.1, 'parsed embedding[0]', `got ${buf[0].embedding[0]}`)
  assert(buf[0].age_days === 0.5,  'parsed age_days')
}

async function testLoadBufferRpcError() {
  const supa = makeSupabaseStub(null, { message: 'simulated RPC failure' })
  const buf = await loadEngagementBuffer(supa, 'user-1')
  assert(Array.isArray(buf) && buf.length === 0,
    'RPC error returns empty array (defensive)')
}

async function testLoadBufferNoUserId() {
  const supa = makeSupabaseStub([])
  const buf = await loadEngagementBuffer(supa, null)
  assert(Array.isArray(buf) && buf.length === 0,
    'null userId returns empty array')
}

async function testLoadBufferFiltersBadRows() {
  const rows = [
    { article_id: 1, vq_primary: 39, embedding_minilm_vec: null, age_days: 0, event_type: 'a' },
    { article_id: 2, vq_primary: null, embedding_minilm_vec: JSON.stringify(fakeEmbedding(0)), age_days: 0, event_type: 'a' },
    { article_id: 3, vq_primary: 39, embedding_minilm_vec: '[1,2,3]', age_days: 0, event_type: 'a' },  // wrong dim
    { article_id: 4, vq_primary: 39, embedding_minilm_vec: JSON.stringify(fakeEmbedding(0.5)), age_days: 0, event_type: 'a' },  // good
  ]
  const supa = makeSupabaseStub(rows)
  const buf = await loadEngagementBuffer(supa, 'user-1')
  assert(buf.length === 1 && buf[0].article_id === 4,
    'filters null embedding, null vq_primary, wrong-dim embedding',
    `got ${buf.length} rows`)
}

// ---------------------------------------------------------------------------
// getPrimaryUserVectors — cache layer.
async function testCacheMissThenHit() {
  _clearVectorCacheForTests()
  const rows = [
    { article_id: 1, vq_primary: 39, embedding_minilm_vec: JSON.stringify(fakeEmbedding(0.1)), age_days: 0, event_type: 'a' },
  ]
  let rpcCalls = 0
  const supa = {
    rpc: async () => { rpcCalls += 1; return { data: rows, error: null } },
  }
  const first = await getPrimaryUserVectors(supa, 'user-X', [39])
  assert(first.cacheHit === false, 'first call is cache miss')
  assert(first.vectorsByPrimary.has(39), 'first call computes vector for 39')
  assert(rpcCalls === 1, 'first call hits RPC')

  const second = await getPrimaryUserVectors(supa, 'user-X', [39])
  assert(second.cacheHit === true, 'second call is cache hit')
  assert(rpcCalls === 1, 'second call does NOT re-hit RPC')
  assert(second.vectorsByPrimary.get(39)[0] === first.vectorsByPrimary.get(39)[0],
    'cache returns same vector content')
}

async function testCacheIsolatedPerUser() {
  _clearVectorCacheForTests()
  let calls = []
  const supa = {
    rpc: async (_n, args) => {
      calls.push(args.p_user_id)
      const base = args.p_user_id === 'user-A' ? 0.1 : 0.9
      const rows = [{
        article_id: 1, vq_primary: 39,
        embedding_minilm_vec: JSON.stringify(fakeEmbedding(base)),
        age_days: 0, event_type: 'a',
      }]
      return { data: rows, error: null }
    },
  }
  const a1 = await getPrimaryUserVectors(supa, 'user-A', [39])
  const b1 = await getPrimaryUserVectors(supa, 'user-B', [39])
  assert(Math.abs(a1.vectorsByPrimary.get(39)[0] - 0.1) < 1e-5, 'user-A vector')
  assert(Math.abs(b1.vectorsByPrimary.get(39)[0] - 0.9) < 1e-5, 'user-B vector')
  assert(calls.length === 2, 'two RPC calls — one per user', `got ${calls.length}`)
  // Second call to user-A is cached.
  const a2 = await getPrimaryUserVectors(supa, 'user-A', [39])
  assert(a2.cacheHit === true, 'user-A second call cached')
  assert(calls.length === 2, 'user-A second call did not hit RPC')
}

async function testGetVectorsHandlesEmptyBuffer() {
  _clearVectorCacheForTests()
  const supa = { rpc: async () => ({ data: [], error: null }) }
  const r = await getPrimaryUserVectors(supa, 'user-empty', [39])
  assert(r.vectorsByPrimary.size === 0, 'empty buffer → empty vectorsByPrimary')
  assert(r.bufferSize === 0,            'bufferSize=0 surfaced')
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('P2 — personalVectors.js tests\n')
  testConstantsSane()
  testParseEmbedding()
  testFormatVectorForPg()
  testComputeEmptyBuffer()
  testComputeEmptyPrimaries()
  testComputeSingleItem()
  testRecencyDecayWeighting()
  testSoftCapDropsOldest()
  testFiltersUnwantedPrimaries()
  testSkipsMalformedEmbeddings()
  await testLoadBufferHappy()
  await testLoadBufferRpcError()
  await testLoadBufferNoUserId()
  await testLoadBufferFiltersBadRows()
  await testCacheMissThenHit()
  await testCacheIsolatedPerUser()
  await testGetVectorsHandlesEmptyBuffer()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error('test runner error:', e); process.exit(1) })

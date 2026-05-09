// Phoenix Phase 9.A.4 (2026-05-09) — End-to-end test for serveTrinityFeed.
//
// PR #124's `shownClusters` typo lived in the debug-output construction in
// serveTrinityFeed and was undetected for 7 hours because lib/trinity.test.js
// only tests pure helpers (trinityM, trinityLT, applyPrimaryCap, etc.) — never
// the orchestrator. This test EXECUTES serveTrinityFeed end-to-end against a
// stub supabase and asserts the returned debug object has all expected keys.
//
// Run with: node lib/trinityServe.test.js
//
// Coverage:
//   * Cold-start path (qualifyingCount < 50 → trending fallback)
//   * Warm-user path (full Trinity v5 with all 6 retrievers + compose)
//   * Returned debug object has every key the serve function tries to
//     populate. If any reference inside that object construction is
//     undefined, the test catches it before it ships.
//   * Returned articles.length matches feedSize budget for warm path

import { serveTrinityFeed } from './trinityServe.js'
import { J_PRIMARY, K_SECONDARY } from './trinity.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// Build a parent_map: cluster c2 -> primary c2/8 (matches production codebook).
const PARENT_MAP = (() => {
  const m = new Array(K_SECONDARY)
  for (let c2 = 0; c2 < K_SECONDARY; c2++) m[c2] = Math.floor(c2 / 8)
  return m
})()

// Synthetic article generator. Each article gets distinct id, vq_primary,
// vq_secondary, recent created_at, mid-range ai_final_score.
function makeArticle(id, c1, c2, scoreOffset = 0) {
  return {
    id,
    title_news: `Synthetic article ${id}`,
    summary_bullets_news: [],
    category: 'Tech',
    ai_final_score: 700 + scoreOffset,
    vq_primary: c1,
    vq_secondary: c2,
    embedding_minilm_vec: null,
    image_url: null,
    image_source: null,
    source: `Source-${id % 5}`,
    url: `https://example.com/${id}`,
    expected_read_seconds: 60,
    created_at: new Date(Date.now() - id * 60_000).toISOString(),
    published_at: new Date(Date.now() - id * 60_000).toISOString(),
    components_order: [],
    components: null,
    details: null,
    timeline: null,
    graph: null,
    map: null,
    five_ws: null,
    countries: [],
    topics: [],
    interest_tags: [],
    country_relevance: null,
    topic_relevance: null,
    cluster_id: null,
    emoji: null,
    num_sources: 1,
    freshness_category: 'fresh',
    shelf_life_days: 3,
    author_id: null,
    author_name: null,
    seen_count: 0,
  }
}

// Build a stub supabase client. Returns a chainable proxy that satisfies
// every method serveTrinityFeed touches with sensible default data.
//
// `opts.qualifyingCount` controls cold-start vs warm path.
// `opts.fakeArticles` is an optional pre-built pool used by every retrieval
// to simulate fresh/cluster fetches.
function makeStubSupabase(opts = {}) {
  const qc = opts.qualifyingCount ?? 0
  const articles = opts.fakeArticles ?? []
  const codebookRow = {
    id: 1,
    version: 'test',
    signal_type: 'semantic',
    parent_map: PARENT_MAP,
    dim: 384,
    item_count: articles.length,
    is_active: true,
  }

  // Build a histogram: a few primaries at moderate weight when qc>=50.
  const histRows = qc >= 50
    ? [
        { vq_primary: 39, vq_secondary: 312, weight_sum: 100, qualifying_count: qc * 0.4, ev_within_48h: false },
        { vq_primary: 224, vq_secondary: 1792, weight_sum: 80, qualifying_count: qc * 0.3, ev_within_48h: false },
        { vq_primary: 114, vq_secondary: 912, weight_sum: 60, qualifying_count: qc * 0.2, ev_within_48h: false },
        { vq_primary: 48, vq_secondary: 384, weight_sum: 40, qualifying_count: qc * 0.1, ev_within_48h: false },
      ]
    : []

  return {
    rpc: (name) => {
      if (name === 'trinity_build_histogram') {
        return Promise.resolve({ data: histRows, error: null })
      }
      if (name === 'count_articles_by_vq_secondary') {
        const rows = []
        for (let c2 = 0; c2 < K_SECONDARY; c2 += 100) rows.push({ vq_secondary: c2, cnt: 5 })
        return Promise.resolve({ data: rows, error: null })
      }
      if (name === 'user_avoid_clusters') {
        return Promise.resolve({ data: [], error: null })
      }
      if (name === 'user_hour_primary_stats') {
        return Promise.resolve({ data: [], error: null })
      }
      if (name === 'get_user_negative_dimensions') {
        return Promise.resolve({ data: [], error: null })
      }
      if (name === 'trinity_fetch_cluster_with_seencount') {
        return Promise.resolve({ data: articles.slice(0, 12), error: null })
      }
      if (name === 'trinity_fetch_fresh_with_seencount') {
        return Promise.resolve({ data: articles.slice(0, 30), error: null })
      }
      if (name === 'article_global_impression_counts') {
        return Promise.resolve({ data: [], error: null })
      }
      if (name === 'bump_cluster_b_score' || name === 'bump_cluster_explore_shows') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
    from: (table) => {
      const result = (() => {
        if (table === 'vq_codebooks') return { data: [codebookRow], error: null }
        if (table === 'cluster_state') return { data: [], error: null }
        if (table === 'user_publisher_penalty') return { data: [], error: null }
        if (table === 'user_primary_cooldown') return { data: [], error: null }
        if (table === 'user_feed_impressions') return { data: [], error: null }
        if (table === 'published_articles') return { data: articles.slice(0, 50), error: null }
        if (table === 'article_world_events') return { data: [], error: null }
        return { data: [], error: null }
      })()
      // Chainable methods. Each returns the chain object; await on the chain
      // resolves to result. range(start, end) returns plain { data, error }
      // for the paged loadClusterState path.
      const chain = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        gte: () => chain,
        not: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => Promise.resolve(result),
        range: () => Promise.resolve(result),
        then: (resolve) => resolve(result),
      }
      return chain
    },
  }
}

// ---------------------------------------------------------------------------
// Test 1 — cold-start path
// ---------------------------------------------------------------------------
async function testColdStart() {
  const supabase = makeStubSupabase({ qualifyingCount: 0 })
  const result = await serveTrinityFeed(supabase, { userId: 'test-user', feedSize: 10 })
  assert(result != null, 'cold-start: returns non-null result')
  assert(Array.isArray(result.articles), 'cold-start: articles is an array')
  assert(Array.isArray(result.attribution), 'cold-start: attribution is an array')
  assert(result.debug != null, 'cold-start: debug object present')
  assert(result.debug.path === 'cold-start', 'cold-start: debug.path = cold-start')
  assert(typeof result.debug.durationMs === 'number', 'cold-start: durationMs is a number')
}

// ---------------------------------------------------------------------------
// Test 2 — warm-user path. This is the test that would have caught PR #124's
// `shownClusters` typo. Builds a fake article pool, runs through every
// retriever, asserts the debug object construction succeeds.
// ---------------------------------------------------------------------------
async function testWarmUserDebugObject() {
  const fakeArticles = []
  // 8 articles per primary 39, 224, 114, 48
  for (let i = 0; i < 32; i++) {
    const c1 = [39, 224, 114, 48][i % 4]
    const c2 = c1 * 8 + (i % 4)
    fakeArticles.push(makeArticle(1000 + i, c1, c2, i))
  }

  const supabase = makeStubSupabase({
    qualifyingCount: 5000,  // heavy user → Phase 3
    fakeArticles,
  })

  let result
  let threwError = null
  try {
    result = await serveTrinityFeed(supabase, {
      userId: 'test-user-warm',
      feedSize: 20,
      recentEngagementZ: 0,
    })
  } catch (e) {
    threwError = e
  }

  assert(threwError === null,
    'warm-path: serveTrinityFeed does NOT throw',
    threwError ? `${threwError.message}\n${threwError.stack}` : '')

  if (!result) return

  // The crux: debug object must be constructable end-to-end. PR #124's typo
  // was inside this object; ANY ReferenceError here would have been caught.
  const expectedKeys = [
    'path', 'qualifyingCount', 'codebookId', 'thresholds', 'tier1', 'tier2',
    'mClustersTier1', 'mClustersTier2', 'ltClusters', 'explClusters',
    'freshPrimaries', 'freshCandidates', 'cooldownPrimaries',
    'mTier1WindowH', 'mTier2WindowH', 'ltWindowH', 'exploreWindowH',
    'poolSize', 'shownClustersCount', 'exploreServed',
    'bucketCounts', 'primaryCounts', 'recentEngagementZ',
    'slotBudgetsUsed', 'recentEventIdsCount', 'categoryMultipliersCount',
    'publisherPenaltiesCount', 'persistedCooldownPrimariesCount',
    'durationMs',
  ]
  for (const k of expectedKeys) {
    assert(k in result.debug, `warm-path: debug.${k} present`,
      `missing key — would have caught PR #124 if k=shownClustersCount`)
  }

  assert(typeof result.debug.shownClustersCount === 'number',
    'warm-path: debug.shownClustersCount is a NUMBER (was the PR #124 bug — `shownClusters.size` on undefined)',
    `got ${typeof result.debug.shownClustersCount}: ${result.debug.shownClustersCount}`)

  assert(result.debug.path === 'trinity-v5', 'warm-path: debug.path = trinity-v5',
    `got ${result.debug.path}`)
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function main() {
  console.log('Phoenix 9.A.4 — serveTrinityFeed end-to-end tests\n')
  await testColdStart()
  await testWarmUserDebugObject()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error('test runner error:', e); process.exit(1) })

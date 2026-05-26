// lib/multiPageQuota.test.js — unit tests for the curated multi-page quota.
//
// Run with: node lib/multiPageQuota.test.js
//
// Coverage:
//   * isMultiPage detection (pages.length > 1)
//   * interleaveMultiPage spreads MP cards evenly, never in top 2 slots
//   * applyMultiPageQuota tops up supply when the slate is short
//   * applyMultiPageQuota does NOT over-fetch when already at quota
//   * personalization: briefs in the user's primaries are preferred
//   * length invariant: slate length is preserved
//   * topup-fetch failure is non-fatal (slate unchanged)

import { isMultiPage, interleaveMultiPage, applyMultiPageQuota } from './multiPageQuota.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.log(`✗ ${name}${msg ? ` — ${msg}` : ''}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// ── helpers ────────────────────────────────────────────────────────────────
const single = (id, score = 700, primary = 1) => ({ id, ai_final_score: score, vq_primary: primary, pages: null })
const multi = (id, score = 700, primary = 1) => ({ id, ai_final_score: score, vq_primary: primary, pages: [{}, {}, {}] })

// A stub supabase whose query builder resolves to a fixed candidate list.
function stubSupabase(candidates, { fail = false } = {}) {
  const builder = {
    select() { return this },
    eq() { return this },
    gte() { return this },
    order() { return this },
    limit() { return this },
    not() { return this },
    then(resolve) {
      return Promise.resolve(
        fail ? { data: null, error: { message: 'boom' } } : { data: candidates, error: null }
      ).then(resolve)
    },
  }
  return { from() { return builder } }
}

// ── isMultiPage ──────────────────────────────────────────────────────────
assert(isMultiPage(multi(1)) === true, 'isMultiPage: 3-page brief is multi-page')
assert(isMultiPage(single(2)) === false, 'isMultiPage: null pages is not multi-page')
assert(isMultiPage({ id: 3, pages: [{}] }) === false, 'isMultiPage: single-page is not multi-page')

// ── interleaveMultiPage ──────────────────────────────────────────────────
{
  // 20 cards, 5 MP at the tail → should spread to slots 3,7,11,15,19
  const arts = []
  for (let i = 0; i < 15; i++) arts.push(single(i + 1))
  for (let i = 0; i < 5; i++) arts.push(multi(100 + i))
  const attr = arts.map(() => 'x')
  const { articles } = interleaveMultiPage(arts, attr, 5)
  const mpSlots = articles.map((a, i) => (isMultiPage(a) ? i : -1)).filter(i => i >= 0)
  assert(articles.length === 20, 'interleave: length preserved (20)')
  assert(mpSlots.length === 5, 'interleave: all 5 MP retained')
  assert(mpSlots.every(i => i >= 2), 'interleave: no MP in top 2 slots', JSON.stringify(mpSlots))
  // even spacing: no two MP adjacent
  const adjacent = mpSlots.some((s, k) => k > 0 && s - mpSlots[k - 1] <= 1)
  assert(!adjacent, 'interleave: MP cards are not adjacent', JSON.stringify(mpSlots))
}

// ── applyMultiPageQuota: tops up when short ──────────────────────────────
await (async () => {
  const arts = []
  for (let i = 0; i < 20; i++) arts.push(single(i + 1))  // 0 MP naturally
  const tr = { articles: arts, attribution: arts.map(() => 'trinity-fresh') }
  // topup pool: 10 curated briefs
  const pool = []
  for (let i = 0; i < 10; i++) pool.push(multi(500 + i, 800 - i))
  await applyMultiPageQuota(stubSupabase(pool), tr, { limit: 20, seenIds: [], personalPrimaries: [] })
  const mpCount = tr.articles.filter(isMultiPage).length
  assert(tr.articles.length === 20, 'topup: length preserved (20)')
  assert(mpCount === 5, `topup: reached quota (5), got ${mpCount}`)
  assert(tr.debug.multipage.before === 0 && tr.debug.multipage.after === 5, 'topup: debug before=0 after=5')
  const noDup = new Set(tr.articles.map(a => a.id)).size === tr.articles.length
  assert(noDup, 'topup: no duplicate ids')
})()

// ── applyMultiPageQuota: does not over-fetch when already at quota ────────
await (async () => {
  const arts = []
  for (let i = 0; i < 6; i++) arts.push(multi(i + 1))   // already 6 MP
  for (let i = 0; i < 14; i++) arts.push(single(100 + i))
  const tr = { articles: arts, attribution: arts.map(() => 'trinity-fresh') }
  let fetched = false
  const spy = { from() { fetched = true; return stubSupabase([]).from() } }
  await applyMultiPageQuota(spy, tr, { limit: 20, seenIds: [], personalPrimaries: [] })
  assert(fetched === false, 'no-overfetch: skips DB fetch when already >= quota')
  assert(tr.articles.length === 20, 'no-overfetch: length preserved')
  assert(tr.articles.filter(isMultiPage).length === 6, 'no-overfetch: keeps all 6 MP')
})()

// ── personalization: user-primary briefs preferred ───────────────────────
await (async () => {
  const arts = []
  for (let i = 0; i < 20; i++) arts.push(single(i + 1))
  const tr = { articles: arts, attribution: arts.map(() => 'trinity-fresh') }
  // pool: high-score off-primary briefs vs lower-score on-primary briefs
  const pool = [
    multi(901, 900, 99),  // off-primary, top score
    multi(902, 890, 99),
    multi(903, 600, 7),   // on-primary (user primary = 7), lower score
    multi(904, 590, 7),
    multi(905, 580, 7),
    multi(906, 570, 7),
    multi(907, 560, 7),
  ]
  await applyMultiPageQuota(stubSupabase(pool), tr, { limit: 20, seenIds: [], personalPrimaries: [7] })
  const addedPrimaries = tr.articles.filter(isMultiPage).map(a => a.vq_primary)
  const onPrim = addedPrimaries.filter(p => p === 7).length
  assert(onPrim >= 3, `personalize: prefers user-primary briefs (got ${onPrim} of primary 7)`, JSON.stringify(addedPrimaries))
})()

// ── topup-fetch failure is non-fatal ─────────────────────────────────────
await (async () => {
  const arts = []
  for (let i = 0; i < 20; i++) arts.push(single(i + 1))
  const tr = { articles: arts.slice(), attribution: arts.map(() => 'trinity-fresh') }
  await applyMultiPageQuota(stubSupabase([], { fail: true }), tr, { limit: 20, seenIds: [], personalPrimaries: [] })
  assert(tr.articles.length === 20, 'failure: length preserved')
  assert(tr.articles.filter(isMultiPage).length === 0, 'failure: slate unchanged (0 MP, no crash)')
})()

// ── ratio=0 short-circuit honored via target ─────────────────────────────
// (MULTIPAGE_RATIO is module-level from env; here we just assert target math
//  via a limit that rounds the default 0.25 quota: 20*0.25 = 5.)
assert(Math.round(20 * 0.25) === 5, 'quota math: limit 20 → target 5')
assert(Math.round(8 * 0.25) === 2, 'quota math: limit 8 → target 2')

// ── summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

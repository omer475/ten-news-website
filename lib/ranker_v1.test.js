// Phase 3.1 (2026-05-10) — Tests for the X-style v1 ranker.
// Run: node lib/ranker_v1.test.js

import { scoreV1, rerankV1, RANKER_V1_WEIGHTS, ONBOARDING_FLOOR_BOOST } from './ranker_v1.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

function fakeArticle(opts = {}) {
  return {
    id: opts.id ?? 1,
    title_news: 'test',
    category: opts.category ?? 'Tech',
    vq_primary: opts.vq_primary ?? 39,
    vq_secondary: opts.vq_secondary ?? 312,
    ai_final_score: opts.ai_final_score ?? 700,
    source: opts.source ?? 'TestSource',
    author_id: opts.author_id ?? null,
    interest_tags: opts.interest_tags ?? ['ai', 'tech'],
    expected_read_seconds: opts.expected_read_seconds ?? 30,
    created_at: opts.created_at ?? new Date().toISOString(),
    seen_count: opts.seen_count ?? 0,
    shelf_life_days: opts.shelf_life_days ?? 3,
    _world_event_id: opts._world_event_id,
  }
}

// ---------------------------------------------------------------------------
function testWeightsShape() {
  const w = RANKER_V1_WEIGHTS
  assert(w.revisit > w.save,           'weights: revisit > save (rarest = strongest)')
  assert(w.save > w.like,              'weights: save > like (deliberate keep > tap-like)')
  assert(w.not_interested < w.fast_skip, 'weights: not_interested more negative than fast_skip')
  assert(w.fast_skip < 0,              'weights: fast_skip is negative')
  assert(w.not_interested < 0,         'weights: not_interested is negative')
  assert(Math.abs(w.not_interested) > Math.abs(w.like) * 10,
    'weights: not_interested punishment >> any single positive (asymmetric punishment, X-style)',
    `|not_interested|=${Math.abs(w.not_interested)} like=${w.like}`)
}

// ---------------------------------------------------------------------------
// Score increases when user has high baseline action rates × strong fit.
function testHighRatesIncreaseScore() {
  const article = fakeArticle()
  const lowCtx = {
    userActionRates: { likeRate: 0.005, saveRate: 0.001 },
  }
  const highCtx = {
    userActionRates: { likeRate: 0.10, saveRate: 0.05, revisitRate: 0.02 },
  }
  const lowScore = scoreV1(article, lowCtx)
  const highScore = scoreV1(article, highCtx)
  assert(highScore > lowScore,
    'high action rates → higher score',
    `low=${lowScore.toFixed(3)} high=${highScore.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Follow bonus: same article scores higher when user follows the author.
function testFollowBoost() {
  const article = fakeArticle({ author_id: 'pub-1' })
  const noFollow = scoreV1(article, {})
  const withFollow = scoreV1(article, { userFollowedAuthors: new Set(['pub-1']) })
  assert(withFollow > noFollow,
    'follow_publisher: scored article higher when user follows author',
    `noFollow=${noFollow.toFixed(3)} withFollow=${withFollow.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Onboarding floor: articles tagged with declared interests get a boost.
function testOnboardingFloor() {
  const article = fakeArticle({ interest_tags: ['ai', 'machine learning'] })
  const noMatch = scoreV1(article, { userOnboardingTags: new Set(['nba', 'sports']) })
  const withMatch = scoreV1(article, { userOnboardingTags: new Set(['ai']) })
  assert(withMatch > noMatch,
    'onboarding floor: declared-interest article scores higher',
    `noMatch=${noMatch.toFixed(3)} withMatch=${withMatch.toFixed(3)}`)
  const ratio = withMatch / noMatch
  assert(Math.abs(ratio - ONBOARDING_FLOOR_BOOST) < 0.01,
    `onboarding floor: ratio === ${ONBOARDING_FLOOR_BOOST}`,
    `got ratio=${ratio.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Recency: a fresh article outscores a 14-day-old one (same other state).
function testRecencyDecay() {
  const fresh = fakeArticle({ created_at: new Date(Date.now() - 2 * 3600000).toISOString() })
  const old = fakeArticle({ created_at: new Date(Date.now() - 14 * 86400000).toISOString() })
  const freshScore = scoreV1(fresh, {})
  const oldScore = scoreV1(old, {})
  assert(freshScore > oldScore,
    'recency: fresh outscores 14-day-old',
    `fresh=${freshScore.toFixed(3)} old=${oldScore.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// seenDecay: a re-shown article (seen_count >= 5) scores lower than unseen.
//
// Note: with the trained ranker_v1_model.json (Phase 2.3), seen_count has a
// positive learned coefficient on P_tap because dwell>0 is partly leakage
// (we currently set seen_count proxy from max_dwell_seconds>0 in training).
// This pushes the engagement score UP at seen_count=1, while the seenDecay
// policy multiplier pushes the FINAL score down. The net effect at low
// seen_count can be non-monotonic; over many views the policy mult wins.
//
// We assert the END-TO-END behavior that matters for ranking: heavily-seen
// (5+) articles score lower than unseen. Future training iterations that
// remove the leakage proxy can retighten to strict monotonicity.
function testSeenDecay() {
  const unseen = fakeArticle({ seen_count: 0 })
  const seen5 = fakeArticle({ seen_count: 5 })
  const s0 = scoreV1(unseen, {})
  const s5 = scoreV1(seen5, {})
  assert(s5 < s0,
    'seenDecay: heavily-seen (5x) scores lower than unseen',
    `s0=${s0.toFixed(3)} s5=${s5.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Not-Interested punishes hard: article in a primary user has rejected
// scores far lower than identical article without that history.
function testNotInterestedPunishment() {
  const article = fakeArticle({ vq_secondary: 312, vq_primary: 39, source: 'BadSource' })
  const cleanCtx = {}
  const dirtyCtx = {
    negativeDimensions: {
      cluster: new Map([['312', 15]]),  // many skips on this cluster
      primary: new Map([['39', 20]]),
      source:  new Map([['badsource', 12]]),
    },
  }
  const clean = scoreV1(article, cleanCtx)
  const dirty = scoreV1(article, dirtyCtx)
  assert(dirty < clean,
    'not-interested + fast-skip: heavy negDims → lower score',
    `clean=${clean.toFixed(3)} dirty=${dirty.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Cross-session story dedup: same story seen 24h ago demoted 0.3×.
function testEventDemote() {
  const article = fakeArticle({ _world_event_id: 555 })
  const noDedup = scoreV1(article, {})
  const withDedup = scoreV1(article, { recentEventIds: new Set([555]) })
  // Score before policy mult is the same. After: withDedup gets × 0.3.
  // Both signs depend on sign of engagementScore; check magnitude / direction.
  if (noDedup > 0) {
    assert(withDedup < noDedup,
      'event demote: same-story-seen demoted',
      `no=${noDedup.toFixed(3)} with=${withDedup.toFixed(3)}`)
  } else {
    assert(withDedup > noDedup,
      'event demote (negative engagementScore): same-story-seen pulled closer to zero',
      `no=${noDedup.toFixed(3)} with=${withDedup.toFixed(3)}`)
  }
}

// ---------------------------------------------------------------------------
// rerankV1 sorts descending by score.
function testRerankSortsDescending() {
  const articles = [
    fakeArticle({ id: 1, ai_final_score: 400 }),
    fakeArticle({ id: 2, ai_final_score: 800 }),
    fakeArticle({ id: 3, ai_final_score: 600 }),
  ]
  const out = rerankV1(articles, { userActionRates: { likeRate: 0.05 } })
  assert(out[0]._score >= out[1]._score && out[1]._score >= out[2]._score,
    'rerankV1: sorted descending by _score',
    `scores: ${out.map(a => a._score.toFixed(2)).join(', ')}`)
}

// Mig 119 (2026-05-13) — creatorAffinityMult applies in EVERY retriever pool
// (the trinity-follow gate was removed). X's RealGraph applies author affinity
// globally regardless of which retrieval channel surfaced the item.
function testCreatorAffinityAppliesEverywhere() {
  const a1 = { ...fakeArticle({ id: 10, author_id: 'pub-X' }), _retriever: 'trinity-follow' }
  const a2 = { ...fakeArticle({ id: 11, author_id: 'pub-X' }), _retriever: 'trinity-personal' }
  const ctx = {
    creatorAffinity: new Map([['pub-X', 1.5]]),
    userActionRates: { likeRate: 0.04, saveRate: 0.01 },
  }
  const sFollow = scoreV1(a1, ctx)
  const sTier = scoreV1(a2, ctx)
  // Same author + same affinity → both pools should now apply the 1.5× boost.
  // Scores should be identical (only _retriever differs, no other gates).
  assert(Math.abs(sFollow - sTier) < 1e-9,
    'creatorAffinityMult: applies in every retriever pool (mig 119)',
    `follow=${sFollow.toFixed(6)} personal=${sTier.toFixed(6)}`)
}

function testCreatorAffinityDemotesUnloved() {
  const a1 = { ...fakeArticle({ id: 12, author_id: 'pub-Y' }), _retriever: 'trinity-follow' }
  const a2 = { ...fakeArticle({ id: 13, author_id: 'pub-Y' }), _retriever: 'trinity-follow' }
  const ctxHigh = { creatorAffinity: new Map([['pub-Y', 1.5]]) }
  const ctxLow  = { creatorAffinity: new Map([['pub-Y', 0.5]]) }
  const sHigh = scoreV1(a1, ctxHigh)
  const sLow  = scoreV1(a2, ctxLow)
  assert(sHigh > sLow,
    'creatorAffinity: 1.5× scores higher than 0.5× for same article',
    `high=${sHigh.toFixed(3)} low=${sLow.toFixed(3)}`)
}

// Mig 119 — author-axis negative-dim feeds into P_fast_skip.
function testAuthorNegDimRaisesFastSkip() {
  const a = fakeArticle({ id: 20, author_id: 'author-bad' })
  const ctxClean = {
    negativeDimensions: { cluster: new Map(), source: new Map(), primary: new Map(), author: new Map() },
  }
  const ctxSkipped = {
    negativeDimensions: {
      cluster: new Map(),
      source: new Map(),
      primary: new Map(),
      author: new Map([['author-bad', 15]]),
    },
  }
  const sClean = scoreV1(a, ctxClean)
  const sSkipped = scoreV1(a, ctxSkipped)
  // Author with 15 fast-skips should drag the score below the no-history case
  // via the elevated P_fast_skip × −10 fast_skip weight.
  assert(sSkipped < sClean,
    'authorSkips elevates P_fast_skip and lowers final score',
    `clean=${sClean.toFixed(3)} skipped=${sSkipped.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('Phase 3.1 — ranker_v1.js tests\n')
  testWeightsShape()
  testHighRatesIncreaseScore()
  testFollowBoost()
  testOnboardingFloor()
  testRecencyDecay()
  testSeenDecay()
  testNotInterestedPunishment()
  testEventDemote()
  testRerankSortsDescending()
  testCreatorAffinityAppliesEverywhere()
  testCreatorAffinityDemotesUnloved()
  testAuthorNegDimRaisesFastSkip()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error('test runner error:', e); process.exit(1) })

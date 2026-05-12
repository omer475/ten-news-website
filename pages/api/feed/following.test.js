// Tests for /api/feed/following. Run: node pages/api/feed/following.test.js
//
// Imports `handleFollowing` directly with an injected Supabase stub — no
// @supabase/supabase-js load needed. Covers: chronological order, empty
// no-follows, cursor pagination, limit clamp, FOLLOWS_HARD_CAP, JSON shape.

import { handleFollowing, MAX_LIMIT, FOLLOWS_HARD_CAP } from './following.js'

let passed = 0, failed = 0
const ok = (name) => { passed += 1; console.log(`✓ ${name}`) }
const fail = (name, msg) => { failed += 1; console.error(`✗ ${name}: ${msg}`) }
const assert = (cond, name, msg = '') => cond ? ok(name) : fail(name, msg)

// In-memory Supabase stub. The handler chains .select().eq().in().order().limit()
// then awaits the builder. Each chain method returns the same builder until
// awaited, at which point it resolves with { data, error }.
function makeStub({ follows = [], articles = [] } = {}) {
  let captureFn = null
  const stub = {
    setCapture(fn) { captureFn = fn },
    from(table) {
      const cap = { table, eqs: {}, ins: {}, lt: null, order: null, limit: null }
      const builder = {
        select() { return builder },
        eq(col, val) { cap.eqs[col] = val; return builder },
        in(col, vals) { cap.ins[col] = vals; return builder },
        order(col, opts) { cap.order = { col, opts }; return builder },
        limit(n) { cap.limit = n; return builder },
        lt(col, val) { cap.lt = { col, val }; return builder },
        then(resolve) {
          if (captureFn) captureFn(cap)
          if (table === 'user_follows') {
            return resolve({ data: follows.slice(0, cap.limit || 999), error: null })
          }
          if (table === 'published_articles') {
            let rows = articles.slice()
            if (cap.ins.author_id) rows = rows.filter(a => cap.ins.author_id.includes(a.author_id))
            if (cap.lt && cap.lt.col === 'published_at') {
              rows = rows.filter(a => a.published_at < cap.lt.val)
            }
            if (cap.order?.col === 'published_at') {
              const asc = cap.order.opts?.ascending !== false
              rows.sort((a, b) => (a.published_at > b.published_at ? 1 : -1) * (asc ? 1 : -1))
            }
            if (cap.limit) rows = rows.slice(0, cap.limit)
            return resolve({ data: rows, error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return builder
    },
  }
  return stub
}

function makeReq(query = {}, method = 'GET') { return { method, query } }
function makeRes() {
  const r = {
    statusCode: 200, _headers: {}, _body: null,
    setHeader(k, v) { this._headers[k] = v; return r },
    status(c) { this.statusCode = c; return r },
    json(b) { this._body = b; return r },
  }
  return r
}

function fakeArticle(id, isoPublishedAt, authorId = 'pub-1') {
  return {
    id, title_news: `Article ${id}`, summary_bullets_news: '[]',
    category: 'Tech', ai_final_score: 700,
    vq_primary: 39, vq_secondary: 312, embedding_minilm_vec: null,
    image_url: 'https://x.com/img.jpg', image_source: null, source: 'TestSource',
    url: 'https://x.com', expected_read_seconds: 30,
    created_at: isoPublishedAt, published_at: isoPublishedAt,
    components_order: null, components: null, details: null,
    timeline: null, graph: null, map: null, five_ws: null,
    countries: null, topics: null, interest_tags: null,
    country_relevance: null, topic_relevance: null,
    cluster_id: null, emoji: null, num_sources: 3,
    freshness_category: 'fresh', shelf_life_days: 3,
    author_id: authorId, author_name: 'Test Author',
  }
}

// ---------------------------------------------------------------------------
async function testRejectsNonGet() {
  const res = makeRes()
  await handleFollowing(makeStub(), makeReq({}, 'POST'), res)
  assert(res.statusCode === 405, '405 on non-GET', `got ${res.statusCode}`)
}

async function testRejectsMissingUserId() {
  const res = makeRes()
  await handleFollowing(makeStub(), makeReq({}), res)
  assert(res.statusCode === 400, '400 when user_id missing', `got ${res.statusCode}`)
}

async function testEmptyFollowsReturns200() {
  const res = makeRes()
  await handleFollowing(makeStub({ follows: [], articles: [] }),
    makeReq({ user_id: 'u-empty' }), res)
  assert(res.statusCode === 200, 'no-follows: 200', `got ${res.statusCode}`)
  assert(Array.isArray(res._body?.articles) && res._body.articles.length === 0,
    'no-follows: articles is empty array')
  assert(res._body.next_cursor === null, 'no-follows: next_cursor=null')
  assert(res._body.has_more === false,   'no-follows: has_more=false')
  assert(res._body.feed_state === 'empty_no_follows', 'no-follows: feed_state=empty_no_follows')
}

async function testHappyPathReturnsChronological() {
  const follows = [{ publisher_id: 'pub-1' }, { publisher_id: 'pub-2' }]
  const articles = [
    fakeArticle(1, '2026-05-10T00:00:00Z', 'pub-1'),
    fakeArticle(2, '2026-05-11T00:00:00Z', 'pub-1'),
    fakeArticle(3, '2026-05-12T00:00:00Z', 'pub-2'),
  ]
  const res = makeRes()
  await handleFollowing(makeStub({ follows, articles }),
    makeReq({ user_id: 'u-1', limit: '10' }), res)
  assert(res.statusCode === 200, 'happy: 200', `got ${res.statusCode}`)
  const arts = res._body.articles
  assert(arts.length === 3, 'happy: 3 articles', `got ${arts.length}`)
  assert(arts[0].id === 3 && arts[1].id === 2 && arts[2].id === 1,
    'happy: newest published_at first',
    `ids=${arts.map(a => a.id).join(',')}`)
  assert(res._body.has_more === false, 'happy (3 < limit 10): has_more=false')
  assert(res._body.next_cursor === null, 'happy: next_cursor=null when result < limit')
}

async function testPaginationCursor() {
  const follows = [{ publisher_id: 'pub-1' }]
  const articles = [
    fakeArticle(1, '2026-05-10T00:00:00Z'),
    fakeArticle(2, '2026-05-11T00:00:00Z'),
    fakeArticle(3, '2026-05-12T00:00:00Z'),
  ]
  // First page (limit=2).
  let res = makeRes()
  await handleFollowing(makeStub({ follows, articles }),
    makeReq({ user_id: 'u-1', limit: '2' }), res)
  assert(res._body.articles.length === 2, 'page 1: 2 articles')
  assert(res._body.articles[0].id === 3 && res._body.articles[1].id === 2,
    'page 1: ids 3 then 2')
  assert(res._body.has_more === true, 'page 1: has_more=true')
  assert(res._body.next_cursor === '2026-05-11T00:00:00Z',
    'page 1: cursor is last published_at',
    `got ${res._body.next_cursor}`)
  // Second page using that cursor.
  res = makeRes()
  await handleFollowing(makeStub({ follows, articles }),
    makeReq({ user_id: 'u-1', limit: '2', cursor: '2026-05-11T00:00:00Z' }), res)
  assert(res._body.articles.length === 1, 'page 2: 1 article (strictly <)')
  assert(res._body.articles[0].id === 1, 'page 2: id 1')
  assert(res._body.has_more === false, 'page 2: has_more=false')
  assert(res._body.next_cursor === null, 'page 2: cursor null at end')
}

async function testLimitClamp() {
  const stub = makeStub({ follows: [{ publisher_id: 'pub-1' }], articles: [] })
  let articlesLimit = null
  stub.setCapture((cap) => {
    if (cap.table === 'published_articles') articlesLimit = cap.limit
  })
  const res = makeRes()
  await handleFollowing(stub, makeReq({ user_id: 'u-1', limit: '999' }), res)
  assert(articlesLimit === MAX_LIMIT,
    `limit clamped to MAX_LIMIT=${MAX_LIMIT}`,
    `got ${articlesLimit}`)
}

async function testFollowsHardCap() {
  const follows = Array.from({ length: 600 }, (_, i) => ({ publisher_id: `pub-${i}` }))
  const stub = makeStub({ follows, articles: [] })
  let followsLimit = null
  stub.setCapture((cap) => {
    if (cap.table === 'user_follows') followsLimit = cap.limit
  })
  const res = makeRes()
  await handleFollowing(stub, makeReq({ user_id: 'u-1' }), res)
  assert(followsLimit === FOLLOWS_HARD_CAP,
    `follows capped at ${FOLLOWS_HARD_CAP}`,
    `got ${followsLimit}`)
}

async function testArticleShape() {
  const follows = [{ publisher_id: 'pub-1' }]
  const articles = [fakeArticle(42, '2026-05-12T00:00:00Z')]
  const res = makeRes()
  await handleFollowing(makeStub({ follows, articles }),
    makeReq({ user_id: 'u-1' }), res)
  const a = res._body.articles[0]
  const required = [
    'id', 'title', 'title_news', 'url', 'source', 'category', 'emoji',
    'image_url', 'urlToImage', 'publishedAt', 'created_at', 'ai_final_score',
    'summary_bullets_news', 'summary_bullets', 'expected_read_seconds',
    'author_id', 'author_name',
  ]
  for (const k of required) {
    assert(k in a, `article shape: has ${k}`, `missing ${k}`)
  }
}

;(async () => {
  await testRejectsNonGet()
  await testRejectsMissingUserId()
  await testEmptyFollowsReturns200()
  await testHappyPathReturnsChronological()
  await testPaginationCursor()
  await testLimitClamp()
  await testFollowsHardCap()
  await testArticleShape()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})()

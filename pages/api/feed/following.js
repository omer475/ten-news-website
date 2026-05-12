// pages/api/feed/following.js — pure-chronological feed of articles from
// publishers the user follows. The "Following" tab of the Today+ app
// (iOS work in parallel terminal).
//
// Universal pattern across every major social platform: TikTok, X,
// Instagram, YouTube, Threads, Snapchat all ship a separate Following /
// Subscriptions tab that bypasses the ranking algorithm and shows the
// user's followed-creator content in reverse-chronological order. This is
// that endpoint for our app.
//
// Contract:
//   GET /api/feed/following?user_id={uuid}&limit=20&cursor={iso8601}
//
//   limit:  1..50 (default 20)
//   cursor: ISO 8601 timestamp; returns articles strictly older than this
//           (used for infinite scroll — pass the oldest published_at from
//           the previous page).
//
// Response (matches /api/feed/main JSON contract):
//   {
//     articles: Article[],
//     next_cursor: string | null,   // published_at of the last article
//     has_more: boolean,            // true iff result count == limit
//     total: number,
//   }
//
// Empty cases:
//   * No user_id supplied → 400.
//   * User has no follows → 200, articles: [], next_cursor: null. iOS
//     surfaces the empty-state card.
//   * No more articles → 200, articles: [], next_cursor: null, has_more: false.

import { formatArticle, FEED_ARTICLE_COLUMNS } from '../../../lib/formatArticle.js'

export const FOLLOWS_HARD_CAP = 500       // PostgREST IN-clause sanity bound
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50

// Inner handler taking an injected supabase client. Exported for unit tests
// (so the test file can stub the client without needing @supabase loaded).
// The default export below creates a real client and delegates here.
export async function handleFollowing(supabase, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = req.query.user_id || null
  if (!userId) {
    return res.status(400).json({ error: 'user_id required' })
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : ''
  const cursor = cursorRaw ? cursorRaw : null

  const t0 = Date.now()

  // 1) Followed publishers. Cap at FOLLOWS_HARD_CAP — defensive bound.
  const { data: follows, error: fErr } = await supabase
    .from('user_follows')
    .select('publisher_id')
    .eq('user_id', userId)
    .limit(FOLLOWS_HARD_CAP)
  if (fErr) {
    console.error('[following] user_follows query failed:', fErr.message)
    return res.status(503).json({ error: 'feed_unavailable', reason: 'follows_query_error' })
  }
  const publisherIds = (follows || [])
    .map(r => r.publisher_id)
    .filter(p => p != null)

  if (publisherIds.length === 0) {
    console.log(`[following.empty] user=${userId.slice(0, 8)} reason=no_follows`)
    return res.status(200).json({
      articles: [], next_cursor: null, has_more: false, total: 0,
      feed_state: 'empty_no_follows',
    })
  }

  // 2) Pure-chrono article fetch from followed publishers. Cursor is a
  //    strict `<` filter on published_at — matches Apollo GraphQL cursor
  //    pagination semantics (the cursor item itself is excluded so the
  //    next page starts strictly after).
  let q = supabase
    .from('published_articles')
    .select(FEED_ARTICLE_COLUMNS)
    .in('author_id', publisherIds)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (cursor) {
    q = q.lt('published_at', cursor)
  }
  const { data, error: aErr } = await q
  if (aErr) {
    console.error('[following] articles query failed:', aErr.message)
    return res.status(503).json({ error: 'feed_unavailable', reason: 'articles_query_error' })
  }

  const rows = Array.isArray(data) ? data : []
  const articles = rows.map(a => formatArticle(a, {}))

  // 3) next_cursor = published_at of the last article we returned. iOS
  //    passes this back on the next loadMore call. When the result is
  //    shorter than the requested limit, we've hit the end — null cursor.
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
  const nextCursor = (rows.length === limit && lastRow?.published_at)
    ? lastRow.published_at
    : null

  console.log(
    `[following.path] user=${userId.slice(0, 8)} follows=${publisherIds.length} ` +
    `returned=${articles.length}/${limit} cursor=${cursor ? 'paged' : 'first'} ` +
    `next=${nextCursor ? 'yes' : 'end'} ms=${Date.now() - t0}`
  )

  return res.status(200).json({
    articles,
    next_cursor: nextCursor,
    has_more: nextCursor !== null,
    total: articles.length,
    feed_state: articles.length > 0 ? 'normal' : 'end_of_feed',
  })
}

// Default Next.js handler. Constructs the real Supabase client lazily so the
// test runner can import this file without forcing @supabase/supabase-js to
// load (and import only the exported `handleFollowing` for unit tests).
export default async function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)
  return handleFollowing(supabase, req, res)
}

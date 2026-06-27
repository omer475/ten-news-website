// lib/essentials.js — "Today's essentials" boundary (TodayPlus Feature 2).
//
// Defines a FINITE daily set of must-know stories so the feed can show a real
// finish line ("you're caught up on today's essentials — keep reading?").
//
// The set is GLOBAL (same for every user that day), not personalized — it is
// the editorial spine, computed independently of any one user's slate, then
// deduplicated to 1 per world_event.
//
// Sizing is ADAPTIVE rather than a hard score threshold. A strict
// ai_final_score >= 900 cut yields only ~4 stories on a normal news day
// (measured 2026-06-26), too thin to be a meaningful "finish line." Instead we
// take the TOP stories by score within a quality FLOOR, targeting ~TARGET and
// capping at CAP, while always including every true must-know (>= PRIMARY):
//   K = min(CAP, max(#stories>=PRIMARY, min(TARGET, #available>=FLOOR)))
// Quiet day -> a handful of genuine must-knows; big news day -> up to CAP.
//
// /api/feed/main marks each served article is_essential = (id ∈ set) and
// returns essentials_total = |set|. Computing the set here (rather than
// storing an is_essential column) guarantees the contract invariant —
// essentials_total always equals the number of is_essential=true items in the
// full set — and needs no daily batch job or schema change.

const PRIMARY_SCORE = 900     // the true Must-Know / breaking-cover bar
const FLOOR_SCORE = 820       // quality floor — nothing below is "essential"
const TARGET = 10             // desired finish-line size on a normal day
const CAP = 12                // hard upper bound (prompt suggested 10-15)
const WINDOW_HOURS = 36       // a news "day" with timezone slack
const MEMO_TTL_MS = 5 * 60 * 1000  // the set is identical across users; memoize

let _memo = null  // { ids:Set<number>, total:number, expiresAt:number }

// Test/ops hook — drop the memo so the next call recomputes immediately.
export function _clearEssentialsCache() { _memo = null }

/**
 * Returns the current "today's essentials" set.
 * @returns {Promise<{ids: Set<number>, total: number}>}
 */
export async function getEssentials(supabase, opts = {}) {
  const now = Date.now()
  if (_memo && _memo.expiresAt > now) return { ids: _memo.ids, total: _memo.total }

  const floor = opts.floorScore ?? FLOOR_SCORE
  const primary = opts.primaryScore ?? PRIMARY_SCORE
  const target = opts.target ?? TARGET
  const cap = opts.cap ?? CAP
  const windowHours = opts.windowHours ?? WINDOW_HOURS

  const empty = { ids: new Set(), total: 0 }
  try {
    const sinceIso = new Date(now - windowHours * 3600 * 1000).toISOString()
    // Pull above-floor candidates best-first. Over-fetch so world_event dedup
    // still leaves enough distinct stories to reach the cap.
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, ai_final_score, published_at')
      .gte('ai_final_score', floor)
      .gte('published_at', sinceIso)
      .order('ai_final_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(cap * 8)
    if (error) {
      console.error('[essentials] query failed:', error.message)
      return empty
    }
    const rows = data || []
    if (rows.length === 0) {
      _memo = { ids: new Set(), total: 0, expiresAt: now + MEMO_TTL_MS }
      return empty
    }

    // Dedup 1-per-world_event. Articles with no world_event mapping count as
    // their own solo event so a singleton must-know is never dropped.
    const ids = rows.map(r => r.id)
    const eventByArticle = new Map()
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data: ev, error: evErr } = await supabase
        .from('article_world_events')
        .select('article_id, event_id')
        .in('article_id', slice)
      if (evErr) { console.error('[essentials] event lookup failed:', evErr.message); continue }
      for (const row of (ev || [])) {
        if (!eventByArticle.has(row.article_id)) eventByArticle.set(row.article_id, row.event_id)
      }
    }

    const seenEvents = new Set()
    const deduped = []  // [{id, score}], best-first, 1 per world_event
    for (const r of rows) {  // already sorted best-first
      const evKey = eventByArticle.has(r.id) ? `e:${eventByArticle.get(r.id)}` : `a:${r.id}`
      if (seenEvents.has(evKey)) continue
      seenEvents.add(evKey)
      deduped.push({ id: r.id, score: r.ai_final_score })
    }

    // Adaptive size: always keep every true must-know (>= primary); otherwise
    // top up toward TARGET with the next-best; never exceed CAP.
    const numPrimary = deduped.filter(d => d.score >= primary).length
    const k = Math.min(cap, Math.max(numPrimary, Math.min(target, deduped.length)))
    const set = new Set(deduped.slice(0, k).map(d => d.id))

    _memo = { ids: set, total: set.size, expiresAt: now + MEMO_TTL_MS }
    console.log(`[essentials] total=${set.size} (primary>=${primary}: ${numPrimary}, pool>=${floor}: ${deduped.length}, window=${windowHours}h)`)
    return { ids: set, total: set.size }
  } catch (err) {
    console.error('[essentials] fatal:', err.message)
    return empty
  }
}

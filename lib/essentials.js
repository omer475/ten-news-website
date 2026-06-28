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
// Task 6: a major BREAKING world event must always surface, even if its best
// article scores below the floor or falls outside the score-based top-N.
const MAJOR_IMPORTANCE = 8    // world_events.importance bar for "major breaking"
const MAJOR_MAX = 4          // most force-included majors per day
const HARD_CAP = 14         // absolute ceiling once majors are unioned in

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

    // Task 6: force-include the representative article of the top ongoing
    // high-importance world events, so a major breaking story is always shown.
    let majorAdded = 0
    try {
      const reps = await majorEventReps(supabase, windowHours, set)
      for (const id of reps) {
        if (set.size >= HARD_CAP) break
        if (!set.has(id)) { set.add(id); majorAdded++ }
      }
    } catch (e) {
      console.error('[essentials] major-event force-include failed:', e.message)
    }

    _memo = { ids: set, total: set.size, expiresAt: now + MEMO_TTL_MS }
    console.log(`[essentials] total=${set.size} (primary>=${primary}: ${numPrimary}, pool>=${floor}: ${deduped.length}, majors+${majorAdded}, window=${windowHours}h)`)
    return { ids: set, total: set.size }
  } catch (err) {
    console.error('[essentials] fatal:', err.message)
    return empty
  }
}

// Representative article ids for the top ongoing high-importance world events
// (the rep = that event's highest-scoring article within the window). Returns
// up to MAJOR_MAX ids not already in `alreadyIn`, in event-importance order.
async function majorEventReps(supabase, windowHours, alreadyIn) {
  const { data: evs } = await supabase
    .from('world_events')
    .select('id, importance, last_article_at')
    .eq('status', 'ongoing')
    .gte('importance', MAJOR_IMPORTANCE)
    .order('importance', { ascending: false })
    .order('last_article_at', { ascending: false })
    .limit(MAJOR_MAX * 4)
  const eventIds = (evs || []).map(e => e.id)
  if (!eventIds.length) return []

  const { data: links } = await supabase
    .from('article_world_events')
    .select('article_id, event_id')
    .in('event_id', eventIds)
  const artIds = [...new Set((links || []).map(l => l.article_id))]
  if (!artIds.length) return []

  // Major breaking events deserve a slightly wider window than the score-based
  // spine (their best article may be a touch older).
  const sinceIso = new Date(Date.now() - Math.max(windowHours, 72) * 3600 * 1000).toISOString()
  const { data: arts } = await supabase
    .from('published_articles')
    .select('id, ai_final_score, published_at')
    .in('id', artIds)
    .gte('published_at', sinceIso)
  const scoreById = new Map((arts || []).map(a => [a.id, a.ai_final_score || 0]))

  const bestByEvent = new Map()  // event_id -> { id, score }
  for (const l of (links || [])) {
    if (!scoreById.has(l.article_id)) continue
    const sc = scoreById.get(l.article_id)
    const cur = bestByEvent.get(l.event_id)
    if (!cur || sc > cur.score) bestByEvent.set(l.event_id, { id: l.article_id, score: sc })
  }

  const reps = []
  for (const e of (evs || [])) {            // preserve importance order
    const b = bestByEvent.get(e.id)
    if (b && !alreadyIn.has(b.id) && !reps.includes(b.id)) reps.push(b.id)
    if (reps.length >= MAJOR_MAX) break
  }
  return reps
}

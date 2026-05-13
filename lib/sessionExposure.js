// 3-axis session-exposure memory (Fix B, 2026-05-12).
//
// Tracks per-user counts of (primary, secondary, source) values served in
// recent slates with exponential time decay. Reads at request time to
// produce a per-candidate "exposure multiplier" that discounts items in
// over-served categories.
//
// Matches Kuaishou's "tri-level fatigue model" (WTG paper CIKM 2023,
// arxiv:2308.13249) section 3.3. Same shape as Instagram's connected-
// content fatigue (transparency 2023) and TikTok's per-category exposure
// (Trinity paper KDD 2024 + Algo 101 leak).
//
// Persistence: migration 114 — table `user_session_exposure` + RPC
// `bump_session_exposure`. Decay is applied in JS at read; the table
// stores raw counts + timestamps and never needs a sweeper.

// Half-lives in minutes. Faster decay on finer axes so a bored user can
// see different sub-topics within a primary again sooner than they can see
// the SAME sub-topic again.
//
// 2026-05-13 (composition cleanup): primary axis DISABLED below in
// loadSessionExposure. X / Threads / Instagram don't apply per-topic intra-
// session decay on text feeds — that's a Kuaishou video-platform pattern
// where re-seeing the same video is annoying. For a text feed where the
// user has clear narrow interests (Tech), discounting the primary topic
// just because it was served recently is over-correction. Audit 2026-05-13:
// primary 39 (Tech, user's top interest) was getting 0.58× multiplier after
// 8 exposures in 10 min, letting LT win compose backfill. Secondary (sub-
// cluster) and source (publisher) axes still apply — those catch genuine
// over-serving without killing core interest.
export const HALF_LIFE_MIN = Object.freeze({
  primary:   60,    // unused after primaryAxisEnabled=false (kept for tests)
  secondary: 30,
  source:    20,
})

// Multiplier floors per axis.
export const FLOOR = Object.freeze({
  primary:   0.50,
  secondary: 0.40,
  source:    0.35,
})

// Multiplier shape per axis: 1.0 / (1 + slope * decayed_count).
const SLOPE = Object.freeze({
  primary:   0.10,
  secondary: 0.13,
  source:    0.15,
})

// 2026-05-13: read-side flag. When false, primaryMult always returns 1.0
// regardless of write-side bumpSessionExposure rows. Lets us roll back by
// flipping this single flag without rewriting the multiplier-build loop.
const PRIMARY_AXIS_ENABLED = false

// Decay factor at lookup time. half-life T_h → λ = ln(2) / T_h.
function decayedCount(count, ageMinutes, halfLifeMin) {
  if (!count || count <= 0) return 0
  const lambda = Math.LN2 / halfLifeMin
  return count * Math.exp(-lambda * Math.max(0, ageMinutes))
}

function multForAxis(axis, decayedCnt) {
  const slope = SLOPE[axis] ?? 0.10
  const floor = FLOOR[axis] ?? 0.30
  const raw = 1.0 / (1.0 + slope * decayedCnt)
  return Math.max(floor, raw)
}

// ---------------------------------------------------------------------------
// loadSessionExposure — read+decay user's exposure rows.
//
// Returns an object: { multiplierFor(article) → number, debug stats }.
// The closure pre-computes per-(axis, value) multipliers once so the hot
// path is a small Map.get per candidate.
//
// Empty user (no rows yet) returns a no-op multiplier (always 1.0).
// ---------------------------------------------------------------------------
export async function loadSessionExposure(supabase, userId) {
  const empty = {
    multiplierFor: () => 1.0,
    primaryMult:   () => 1.0,
    secondaryMult: () => 1.0,
    sourceMult:    () => 1.0,
    stats: { primaryCount: 0, secondaryCount: 0, sourceCount: 0 },
  }
  if (!userId) return empty
  try {
    const { data, error } = await supabase
      .from('user_session_exposure')
      .select('axis, value, count, last_updated_at')
      .eq('user_id', userId)
      .gte('last_updated_at', new Date(Date.now() - 6 * 3600_000).toISOString())  // ignore >6h old (effectively 0)
      .limit(2000)
    if (error || !Array.isArray(data) || data.length === 0) return empty

    const now = Date.now()
    const mults = {
      primary:   new Map(),
      secondary: new Map(),
      source:    new Map(),
    }
    let primaryCount = 0, secondaryCount = 0, sourceCount = 0
    for (const row of data) {
      const axis = row.axis
      if (!(axis in HALF_LIFE_MIN)) continue
      // 2026-05-13: skip primary-axis rows entirely (read-side disabled).
      if (axis === 'primary' && !PRIMARY_AXIS_ENABLED) continue
      const ageMin = (now - new Date(row.last_updated_at).getTime()) / 60_000
      const decayed = decayedCount(Number(row.count) || 0, ageMin, HALF_LIFE_MIN[axis])
      if (decayed < 0.05) continue  // negligible — skip
      const m = multForAxis(axis, decayed)
      mults[axis].set(row.value, m)
      if (axis === 'primary') primaryCount += 1
      else if (axis === 'secondary') secondaryCount += 1
      else if (axis === 'source') sourceCount += 1
    }

    const primaryMult = (article) => {
      // 2026-05-13: primary-axis exposure disabled (composition cleanup).
      if (!PRIMARY_AXIS_ENABLED) return 1.0
      const v = article?.vq_primary
      if (v == null) return 1.0
      return mults.primary.get(String(v)) ?? 1.0
    }
    const secondaryMult = (article) => {
      const v = article?.vq_secondary
      if (v == null) return 1.0
      return mults.secondary.get(String(v)) ?? 1.0
    }
    const sourceMult = (article) => {
      const v = typeof article?.source === 'string' ? article.source.trim().toLowerCase() : null
      if (!v) return 1.0
      return mults.source.get(v) ?? 1.0
    }
    const multiplierFor = (article) =>
      primaryMult(article) * secondaryMult(article) * sourceMult(article)

    return {
      multiplierFor, primaryMult, secondaryMult, sourceMult,
      stats: { primaryCount, secondaryCount, sourceCount },
    }
  } catch (err) {
    console.error('[session_exposure] load failed:', err.message)
    return empty
  }
}

// ---------------------------------------------------------------------------
// bumpSessionExposure — fire-and-forget UPSERT after a slate is served.
// Sends one batched RPC call. The RPC uses ON CONFLICT to upsert atomically.
// ---------------------------------------------------------------------------
export async function bumpSessionExposure(supabase, userId, slate) {
  if (!userId || !Array.isArray(slate) || slate.length === 0) return
  const axes = []
  const values = []
  for (const item of slate) {
    if (item?.vq_primary != null) {
      axes.push('primary')
      values.push(String(item.vq_primary))
    }
    if (item?.vq_secondary != null) {
      axes.push('secondary')
      values.push(String(item.vq_secondary))
    }
    if (typeof item?.source === 'string' && item.source.trim()) {
      axes.push('source')
      values.push(item.source.trim().toLowerCase())
    }
  }
  if (axes.length === 0) return
  try {
    const { error } = await supabase.rpc('bump_session_exposure', {
      p_user_id: userId, p_axes: axes, p_values: values,
    })
    if (error) console.error('[session_exposure] bump_session_exposure failed:', error.message)
  } catch (err) {
    console.error('[session_exposure] bump threw:', err.message)
  }
}

// For tests: expose the pure decay/multiplier math.
export const _internals = { decayedCount, multForAxis, SLOPE }

// lib/multiPageQuota.js — curated multi-page (Pipeline 2) feed quota.
//
// Product decision (2026-05-26): curated multi-page briefs are a flagship
// feature, but flowing through the normal Trinity pools they competed purely
// on ai_final_score and landed at ~4% of the slate. This layer runs AFTER
// serveTrinityFeed (it never touches the tuned ranking pipeline) and
// guarantees ~MULTIPAGE_FEED_RATIO of the slate is multi-page:
//
//   1. Top up supply — if the natural slate has fewer multi-page cards than
//      the quota, fetch the user's best unseen curated briefs (their top
//      primaries first, then by score) and swap them in for the lowest-
//      priority non-multipage cards at the tail. Slate length is preserved.
//   2. Interleave — spread the multi-page cards ~every 1/ratio slots, never
//      in the top 2 (reserved for serveTrinityFeed's personalized pins).
//
// Fully env-gated (MULTIPAGE_FEED_RATIO=0 disables) and designed to be wrapped
// by the caller so a topup-fetch failure can never take the feed down.

export const MULTIPAGE_RATIO = Math.max(0, Math.min(0.5, parseFloat(process.env.MULTIPAGE_FEED_RATIO ?? '0.25')))
const MULTIPAGE_MIN_SCORE = parseInt(process.env.MULTIPAGE_MIN_SCORE ?? '500', 10)
const MULTIPAGE_WINDOW_H = parseInt(process.env.MULTIPAGE_WINDOW_H ?? String(14 * 24), 10)

// Canonical published_articles projection — matches lib/trinityServe.js so
// formatArticle gets every field (incl. pages/format/source_type).
const MULTIPAGE_COLS = 'id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, components, details, timeline, graph, map, five_ws, countries, topics, interest_tags, country_relevance, topic_relevance, cluster_id, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name, pages, format, source_type'

export const isMultiPage = (a) => Array.isArray(a?.pages) && a.pages.length > 1

// Fetch the best unseen curated multi-page briefs to top up the slate.
// curated_brief ⟺ multi-page today; the JS filter is a defensive backstop.
export async function fetchMultiPageCandidates(supabase, { excludeIds, limit }) {
  const sinceIso = new Date(Date.now() - MULTIPAGE_WINDOW_H * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    .select(MULTIPAGE_COLS)
    .eq('source_type', 'curated_brief')
    .gte('created_at', sinceIso)
    .gte('ai_final_score', MULTIPAGE_MIN_SCORE)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds && excludeIds.length > 0) {
    q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  }
  const { data, error } = await q
  if (error) {
    console.error('[trinity.multipage] topup fetch failed:', error.message)
    return []
  }
  return (data || []).filter(isMultiPage)
}

// Pure interleave: spread multi-page cards evenly across `n` slots. Returns
// reordered { articles, attribution }. Exported for unit testing.
export function interleaveMultiPage(articles, attribution, target) {
  const n = articles.length
  const mpTarget = Math.min(articles.filter(isMultiPage).length, target)
  if (n === 0 || mpTarget <= 0) return { articles, attribution }
  const paired = articles.map((a, i) => ({ a, b: attribution[i] }))
  const mp = paired.filter(p => isMultiPage(p.a))
  const non = paired.filter(p => !isMultiPage(p.a))
  const step = Math.max(1, Math.round(n / mpTarget))
  const positions = []
  let pos = Math.min(Math.max(2, step - 1), n - 1)  // keep top 2 slots clear
  while (positions.length < mpTarget && pos < n) { positions.push(pos); pos += step }
  const out = new Array(n)
  for (let k = 0; k < positions.length; k++) out[positions[k]] = mp[k]
  const fill = [...mp.slice(positions.length), ...non]  // overflow MP + the rest
  let fi = 0
  for (let i = 0; i < n; i++) { if (!out[i]) out[i] = fill[fi++] }
  return { articles: out.map(p => p.a), attribution: out.map(p => p.b) }
}

// Guarantee ~MULTIPAGE_RATIO of the slate is multi-page, then spread the
// multi-page cards evenly. Mutates trinityResult.{articles,attribution} in
// place and stamps trinityResult.debug.multipage for observability.
export async function applyMultiPageQuota(supabase, trinityResult, { limit, seenIds = [], personalPrimaries = [] }) {
  let arts = trinityResult.articles
  let attr = trinityResult.attribution || arts.map(() => 'unknown')
  const target = Math.round(limit * MULTIPAGE_RATIO)
  const before = arts.filter(isMultiPage).length
  if (target <= 0) return

  // 1. Top up supply if the natural slate is short of the quota.
  if (before < target) {
    const need = target - before
    const exclude = Array.from(new Set([...seenIds, ...arts.map(a => a.id)].filter(Boolean)))
    const cand = await fetchMultiPageCandidates(supabase, {
      excludeIds: exclude,
      limit: Math.max(need * 4, 24),
    })
    // Personalize: briefs in the user's top primaries first, then by score.
    const prim = new Set(personalPrimaries || [])
    cand.sort((a, b) => {
      const pa = prim.has(a.vq_primary) ? 1 : 0
      const pb = prim.has(b.vq_primary) ? 1 : 0
      if (pa !== pb) return pb - pa
      return (b.ai_final_score || 0) - (a.ai_final_score || 0)
    })
    const removable = arts.filter(a => !isMultiPage(a)).length
    const add = Math.min(need, cand.length, removable)
    if (add > 0) {
      // Drop the `add` lowest-priority NON-multipage cards from the tail
      // (slate is rank-ordered, so the tail is least important), then append
      // the new multi-page briefs. Slate length stays == limit.
      let toDrop = add
      const keptA = [], keptB = []
      for (let i = arts.length - 1; i >= 0; i--) {
        if (toDrop > 0 && !isMultiPage(arts[i])) { toDrop--; continue }
        keptA.unshift(arts[i]); keptB.unshift(attr[i])
      }
      for (let k = 0; k < add; k++) { keptA.push(cand[k]); keptB.push('multipage-quota') }
      arts = keptA; attr = keptB
    }
  }

  // 2. Interleave so multi-page cards are spread evenly.
  const res = interleaveMultiPage(arts, attr, target)
  trinityResult.articles = res.articles
  trinityResult.attribution = res.attribution
  trinityResult.debug = trinityResult.debug || {}
  trinityResult.debug.multipage = { target, before, after: res.articles.filter(isMultiPage).length }
}

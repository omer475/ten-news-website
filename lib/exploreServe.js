// Explore (Discovery) feed orchestrator.
//
// DIFFERENT GOAL FROM THE FOR-YOU FEED:
//   For You (serveTrinityFeed) EXPLOITS the user's known taste — top primaries,
//   ANN on the taste vector. Explore DISCOVERS — it deliberately reaches one
//   hop OUTSIDE the user's core interests, surfaces brand-new interest clusters,
//   trending + fresh + curated content, with hard diversity caps and a
//   serendipity guarantee.
//
// Pattern: Instagram Explore (multi-source candidate generation → light rank →
//   heavy diversity), TikTok FYP (adjacent/new-category injection + near-dup
//   dedup), plus a Thompson-sampling bandit over unexplored clusters (reuses
//   the For-You explore arm's cluster_state Beta posteriors).
//
// The ONE RULE: if a card clearly belongs in For You (it's in the user's TOP
//   primaries), it is DOWN-WEIGHTED here. Explore = "what you'll love next",
//   not "what you already love".

import {
  buildHistograms,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  exploreArm,
  retrieveCandidatesAdaptive,
  retrievePersonalPerPrimary,
  topPrimariesFromHistogram,
  primariesAboveThreshold,
  adaptiveThresholds,
  assignStoryClusters,
  applyPrimaryCap,
  applyPublisherCap,
} from './trinity.js'
import { rerank } from './trinityServe.js'
import { FEED_ARTICLE_COLUMNS } from './formatArticle.js'

const COLD_START_QC = 50
const FORYOU_TOP_PRIMARIES = 8     // these belong to For You — down-weight here
const FORYOU_DOWNWEIGHT = 0.45     // how hard to demote core-taste content

// Lane budgets for a 25-card explore slate. composeWithBudgets backfills from
// other lanes when one comes up short (e.g. guests have no adjacent/bandit pool).
const LANE_BUDGETS = {
  'explore-adjacent': 6,   // one hop out from core taste (IG "media-based")
  'explore-new':      5,   // bandit: unexplored interest clusters
  'explore-trending': 4,   // best of the recent window (popularity/quality)
  'explore-curated':  4,   // Pipeline 2 evergreen (lists/explainers/recipes)
  'explore-fresh':    6,   // fresh + high-quality across ALL categories
}

function stamp(pool, name) { for (const a of (pool || [])) a._retriever = name; return pool || [] }

// ─── lane queries ────────────────────────────────────────────────────────────

// Trending: best of the last 3 days by quality + actual engagement. On a small
// user base engagement_count is thin, so quality leads and engagement breaks
// ties. Broad across categories (no primary filter) — that's the point.
async function retrieveTrendingBroad(supabase, { excludeIds = [], hoursWindow = 72, limit = 60 } = {}) {
  const since = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase.from('published_articles')
    .select(FEED_ARTICLE_COLUMNS)
    .gte('created_at', since)
    .gte('ai_final_score', 650)
    .not('embedding_minilm_vec', 'is', null)
    .order('ai_final_score', { ascending: false })
    .limit(limit)
  const { data, error } = await q
  if (error) { console.error('[explore.trending]', error.message); return [] }
  return dropSeen(data, excludeIds)
}

// Curated Pipeline-2 content — inherently discovery-oriented (evergreen lists,
// explainers, recipes, history). source_type = 'curated_brief'.
async function retrieveCurated(supabase, { excludeIds = [], hoursWindow = 21 * 24, limit = 30 } = {}) {
  const since = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  const { data, error } = await supabase.from('published_articles')
    .select(FEED_ARTICLE_COLUMNS)
    .eq('source_type', 'curated_brief')
    .gte('created_at', since)
    .not('embedding_minilm_vec', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[explore.curated]', error.message); return [] }
  return dropSeen(data, excludeIds)
}

// Fresh & broad: newest high-quality across every category, for breadth.
async function retrieveFreshBroad(supabase, { excludeIds = [], hoursWindow = 36, limit = 70 } = {}) {
  const since = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  const { data, error } = await supabase.from('published_articles')
    .select(FEED_ARTICLE_COLUMNS)
    .gte('created_at', since)
    .gte('ai_final_score', 550)
    .not('embedding_minilm_vec', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[explore.fresh]', error.message); return [] }
  return dropSeen(data, excludeIds)
}

function dropSeen(rows, excludeIds) {
  if (!Array.isArray(rows)) return []
  if (!excludeIds || excludeIds.length === 0) return rows
  const ex = new Set(excludeIds.map(Number))
  return rows.filter(r => !ex.has(Number(r.id)))
}

// ─── diversity: hard category cap (Explore must stay broad) ───────────────────
function applyCategoryCap(slate, maxPerCategory) {
  const counts = new Map()
  const kept = []
  const overflow = []
  for (const a of slate) {
    const c = a.category || 'Other'
    const n = counts.get(c) || 0
    if (n < maxPerCategory) { counts.set(c, n + 1); kept.push(a) }
    else overflow.push(a)
  }
  return kept.concat(overflow)  // overflow trails; trimmed to feedSize by caller
}

// Keep at most `maxPerStory` per online-clustered story (near-duplicate dedup).
function capByStoryCluster(slate, maxPerStory = 1) {
  const counts = new Map()
  const out = []
  for (const a of slate) {
    const s = a._storyClusterId
    if (s == null) { out.push(a); continue }
    const n = counts.get(s) || 0
    if (n < maxPerStory) { counts.set(s, n + 1); out.push(a) }
  }
  return out
}

// ─── main orchestrator ────────────────────────────────────────────────────────
export async function serveExploreFeed(supabase, opts) {
  const t0 = Date.now()
  const { userId = null, seenIds = [], feedSize = 25 } = opts || {}

  const codebook = await loadActiveCodebook(supabase)
  const [hist, clusterState, articleCounts] = await Promise.all([
    buildHistograms(supabase, userId).catch(() => ({ h1: null, h2: null, qualifyingCount: 0, cooldownPrimaries: [] })),
    loadClusterState(supabase).catch(() => new Map()),
    loadArticleCountsBySecondary(supabase).catch(() => new Map()),
  ])
  const { h1, h2, qualifyingCount = 0, cooldownPrimaries = [] } = hist
  const cold = !userId || qualifyingCount < COLD_START_QC || !h1
  const coolSet = new Set(cooldownPrimaries || [])
  const topPrimaries = (!cold && h1) ? new Set(topPrimariesFromHistogram(h1, FORYOU_TOP_PRIMARIES)) : new Set()

  // ── candidate lanes (run in parallel) ──
  // Lane 1: adjacent interests — primaries above threshold but OUTSIDE the
  // For-You top set (one hop out). ANN per primary on the user's taste vector.
  let adjacentPrimaries = []
  if (!cold && h1 && codebook) {
    const thr = adaptiveThresholds(qualifyingCount)
    adjacentPrimaries = primariesAboveThreshold(h1, thr.tP, 40)
      .filter(p => !topPrimaries.has(p) && !coolSet.has(p))
      .slice(0, 15)
  }
  // Lane 2: bandit — unexplored clusters via Thompson sampling.
  const banditClusters = (h2 && codebook)
    ? exploreArm(h2, clusterState, articleCounts, 24, Math.random, { parentMap: codebook.parentMap })
    : []

  const [adjacentPool, banditRes, trendingPool, curatedPool, freshPool] = await Promise.all([
    (adjacentPrimaries.length && userId)
      ? retrievePersonalPerPrimary(supabase, userId, adjacentPrimaries, {
          hoursWindow: 7 * 24, minScore: 500, perPrimaryLimit: 6, excludeIds: seenIds,
        }).catch(() => [])
      : Promise.resolve([]),
    banditClusters.length
      ? retrieveCandidatesAdaptive(supabase, banditClusters, {
          perClusterLimit: 4, excludeIds: seenIds, minScore: 550, minPoolSize: 20, userId,
        }).catch(() => ({ pool: [] }))
      : Promise.resolve({ pool: [] }),
    retrieveTrendingBroad(supabase, { excludeIds: seenIds }),
    retrieveCurated(supabase, { excludeIds: seenIds }),
    retrieveFreshBroad(supabase, { excludeIds: seenIds }),
  ])

  stamp(adjacentPool, 'explore-adjacent')
  stamp(banditRes.pool, 'explore-new')
  stamp(trendingPool, 'explore-trending')
  stamp(curatedPool, 'explore-curated')
  stamp(freshPool, 'explore-fresh')

  // ── rank each lane (discovery-tuned) ──
  // rerank = quality × recency × category-engage × seen-decay. Then DOWN-WEIGHT
  // any candidate whose primary is core For-You taste, and give curated a small
  // discovery bump (it's chosen for breadth, not news quality).
  const rankLane = (pool, { curatedBump = false } = {}) => {
    if (!pool || !pool.length) return []
    rerank(pool, {})
    for (const a of pool) {
      let s = a._score || 0
      if (a.vq_primary != null && topPrimaries.has(a.vq_primary)) s *= FORYOU_DOWNWEIGHT
      if (curatedBump) s *= 1.15
      a._score = s
    }
    pool.sort((x, y) => (y._score || 0) - (x._score || 0))
    return pool
  }
  const adjacentR = rankLane(adjacentPool)
  const banditR   = rankLane(banditRes.pool)
  const trendingR = rankLane(trendingPool)
  const curatedR  = rankLane(curatedPool, { curatedBump: true })
  const freshR    = rankLane(freshPool)

  // ── compose by lane budgets (round-robin + backfill from other lanes) ──
  const { composeWithBudgets } = await import('./trinity.js')
  let slate = composeWithBudgets([
    { name: 'explore-adjacent', items: adjacentR, budget: LANE_BUDGETS['explore-adjacent'] },
    { name: 'explore-new',      items: banditR,   budget: LANE_BUDGETS['explore-new'] },
    { name: 'explore-trending', items: trendingR, budget: LANE_BUDGETS['explore-trending'] },
    { name: 'explore-curated',  items: curatedR,  budget: LANE_BUDGETS['explore-curated'] },
    { name: 'explore-fresh',    items: freshR,    budget: LANE_BUDGETS['explore-fresh'] },
  ], feedSize * 2)

  // ── diversity (Explore must stay broad) ──
  try { assignStoryClusters(slate) } catch (e) { /* embedding parse — non-fatal */ }
  slate = capByStoryCluster(slate, 1)                                  // near-dup stories
  slate = applyPrimaryCap(slate, { maxPerPrimary: 3, noConsecutive: true })
  slate = applyPublisherCap(slate, { maxPerPublisher: 2, noConsecutive: true })
  slate = applyCategoryCap(slate, Math.max(4, Math.ceil(feedSize * 0.25)))  // ≤25% any category

  // ── serendipity guarantee: ensure ≥3 "new/bandit" cards survive into the slate ──
  const head = slate.slice(0, feedSize)
  const newInHead = head.filter(a => a._retriever === 'explore-new').length
  if (newInHead < 3 && banditR.length) {
    const present = new Set(head.map(a => Number(a.id)))
    const inject = banditR.filter(a => !present.has(Number(a.id))).slice(0, 3 - newInHead)
    // splice them into spots 2,5,8… so they're discoverable, not buried
    let pos = 2
    for (const a of inject) { head.splice(Math.min(pos, head.length), 0, a); pos += 3 }
  }
  slate = head.slice(0, feedSize)

  return {
    articles: slate,
    attribution: slate.map(a => a._retriever || 'explore'),
    debug: {
      path: cold ? 'explore-cold' : 'explore-warm',
      qualifyingCount,
      adjacentPrimaries: adjacentPrimaries.length,
      banditClusters: banditClusters.length,
      laneSizes: {
        adjacent: adjacentPool.length, new: banditRes.pool.length,
        trending: trendingPool.length, curated: curatedPool.length, fresh: freshPool.length,
      },
      bucketCounts: slate.reduce((m, a) => { const k = a._retriever || 'x'; m[k] = (m[k] || 0) + 1; return m }, {}),
      categoryCounts: slate.reduce((m, a) => { const k = a.category || 'Other'; m[k] = (m[k] || 0) + 1; return m }, {}),
      durationMs: Date.now() - t0,
    },
  }
}

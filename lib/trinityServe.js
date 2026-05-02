// Trinity v4 serving orchestrator.
//
// Wraps the pure algorithms in lib/trinity.js with:
//   - DB calls to load codebook / cluster state / article counts
//   - Reranker (ai_final_score × content-aware recency × stale × bucket_boost)
//   - MMR diversity rail
//   - Cluster-state EMA update on shown clusters
//   - Cold-start fallback (trending pool when histogram too sparse)
//
// v4 changes from v3 (2026-05-02 freshness rebuild):
//   v4-A. ADAPTIVE_WINDOW_TIERS_H capped at 7d (was [7d, 14d, 21d]).
//         Live audit: v3 widened to 14d/21d for heavy users, surfacing 9-10d
//         old articles (median age 8d, 9 of 25 slots ≥ 9d). v4 forbids that.
//   v4-B. NEW retriever `trinity-fresh` — pulls last 36h articles from the
//         user's top-N primary clusters (broad scope, survives narrow dedup).
//         Reuses h¹ from the histogram. This is the freshness floor.
//   v4-C. Hard stale-age penalty in rerank — articles older than STALE_AGE_DAYS
//         get score × STALE_PENALTY_FACTOR (0.4) regardless of shelf_life_days.
//         Prevents "evergreen" tagged articles outranking fresh news content.
//   v4-D. BUCKET_BOOST recalibrated: trinity-fresh=1.6, m=1.5, lt=1.3 (down
//         from 1.4 — LT explicitly surfaces older clusters; lower boost lets
//         the stale penalty land harder on Trinity-LT picks).
//
// v3 changes (kept):
//   v3-A. retrieveCandidatesAdaptive (now bounded at 7d).
//   v3-B. Content-aware recency via shelf_life_days.
//   v3-C. No topup-trending for warm users.
//   v3-D. Thompson Sampling exploration arm.
//   v3-E. Soft M/LT exclusion in trinityLT.

import {
  buildHistograms,
  trinityM,
  trinityLT,
  exploreArm,
  emaUpdates,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  retrieveCandidates,
  retrieveCandidatesAdaptive,
  retrievePersonalizedFresh,
  topPrimariesFromHistogram,
  recencyWeightForArticle,
  adaptiveThresholds,
  EXPLORE_SLOT_FRACTION,
  FRESH_TOP_PRIMARIES,
  STALE_AGE_DAYS,
  STALE_PENALTY_FACTOR,
} from './trinity.js'

const COLD_START_QUALIFYING_FLOOR = 50
const FINAL_FEED_SIZE = 20
const PER_M_LIMIT = 12
const PER_LT_LIMIT = 8
const PER_EXPLORE_LIMIT = 4
const FRESH_POOL_LIMIT = 60
const TRENDING_POOL_SIZE = 100
const MMR_DUPLICATE_CEILING = 0.78

// Adaptive retrieval target. We want the joint pool to comfortably exceed
// feed size after dedup. Tier expansion stops once we hit this.
const ADAPTIVE_MIN_POOL = 60

// v4. Bucket-aware reranker boost.
//   trinity-fresh: personalized AND fresh — highest. Restores the freshness
//                  floor that v3's window widening killed.
//   trinity-m:     short-term explicit personalization
//   trinity-lt:    long-tail / long-term — softer boost (was 1.4); LT
//                  inherently surfaces older clusters, lower boost lets the
//                  stale-age penalty land harder.
//   explore:       deliberate frontier picks, modest boost
//   topup-trending: cold-start spine only
const BUCKET_BOOST = {
  'trinity-fresh':   1.6,
  'trinity-m':       1.5,
  'trinity-lt':      1.3,
  'explore':         1.2,
  'topup-trending':  0.6,
  'cold-trending':   1.0,
}


export async function serveTrinityFeed(supabase, opts) {
  const t0 = Date.now()
  const {
    userId,
    seenIds = [],
    feedSize = FINAL_FEED_SIZE,
    // Note: hoursWindow is now ignored at the top level; adaptive retrieval
    // selects per-tier window. Kept in opts for backward-compat.
  } = opts

  const codebook = await loadActiveCodebook(supabase)
  if (!codebook) {
    return {
      articles: [],
      attribution: [],
      debug: { error: 'no-active-codebook', durationMs: Date.now() - t0 },
    }
  }

  const [{ h1, h2, qualifyingCount }, clusterState, articleCounts] = await Promise.all([
    buildHistograms(supabase, userId),
    loadClusterState(supabase),
    loadArticleCountsBySecondary(supabase),
  ])

  // ─── COLD-START PATH ──────────────────────────────────────────────────
  // No personalization signal yet; trending is the only sensible spine.
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR) {
    const cold = await retrieveTrending(supabase, {
      hoursWindow: 7 * 24, excludeIds: seenIds, limit: TRENDING_POOL_SIZE,
    })
    const ranked = rerank(cold)
    const picked = mmrDiversify(ranked, feedSize)
    return {
      articles: picked,
      attribution: picked.map(() => 'cold-trending'),
      debug: {
        path: 'cold-start', qualifyingCount, codebookId: codebook.id,
        durationMs: Date.now() - t0,
      },
    }
  }

  // ─── WARM-USER (TRINITY) PATH ─────────────────────────────────────────
  const thresholds = adaptiveThresholds(qualifyingCount)
  const mClusters  = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds)
  // Trinity-LT excludes M's picks (soft fallback in trinityLT itself if
  // exclusion would starve the eligibility pool).
  const ltClusters = trinityLT(h2, clusterState, articleCounts, Math.random, {
    excludeClusters: mClusters,
  })

  // v3-D: exploration arm. Reserve some slots for genuinely new (h²=0) clusters.
  const exploreSlots = Math.max(1, Math.round(feedSize * EXPLORE_SLOT_FRACTION))
  const explClusters = exploreArm(h2, clusterState, articleCounts, exploreSlots * 3, Math.random)
  // Pick more clusters than slots to give MMR & rerank some flexibility.

  // v4-B: top-N user primaries (broad scope) for trinity-fresh.
  const freshPrimaries = topPrimariesFromHistogram(h1, FRESH_TOP_PRIMARIES)

  // v3-A / v4-A: tiered adaptive retrieval (now bounded at 7d in trinity.js).
  // v4-B adds a fourth retriever — trinity-fresh — running in parallel.
  const [mResult, ltResult, exploreResult, freshPool] = await Promise.all([
    mClusters.length
      ? retrieveCandidatesAdaptive(supabase, mClusters, {
          perClusterLimit: PER_M_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    ltClusters.length
      ? retrieveCandidatesAdaptive(supabase, ltClusters, {
          perClusterLimit: PER_LT_LIMIT, excludeIds: seenIds, minPoolSize: ADAPTIVE_MIN_POOL,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    explClusters.length
      ? retrieveCandidatesAdaptive(supabase, explClusters, {
          perClusterLimit: PER_EXPLORE_LIMIT, excludeIds: seenIds, minScore: 500,
          minPoolSize: exploreSlots * 2,
        })
      : Promise.resolve({ pool: [], hoursWindow: 0 }),
    freshPrimaries.length
      ? retrievePersonalizedFresh(supabase, freshPrimaries, {
          excludeIds: seenIds, limit: FRESH_POOL_LIMIT,
        })
      : Promise.resolve([]),
  ])

  // v4-B: fresh first — gives trinity-fresh tag priority over M/LT for any
  // article that overlaps (article in M's secondary AND in user's top primary).
  const mergedById = new Map()
  for (const a of freshPool)
    if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-fresh' })
  for (const a of mResult.pool)
    if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-m' })
  for (const a of ltResult.pool)
    if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-lt' })
  for (const a of exploreResult.pool)
    if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'explore' })
  let candidates = Array.from(mergedById.values())

  // v3-C: NO topup-trending for warm users. Adaptive retrieval handles thin
  // pools. If we somehow have a near-empty pool here, accept the small slate
  // rather than flood with breaking news.

  const ranked = rerank(candidates)
  const picked = mmrDiversify(ranked, feedSize)

  // EMA update for shown personalized clusters (M / LT / fresh — all draw
  // from the user's interests). Explore is tracked via its own bandit counters.
  const shownClusters = new Set(
    picked.filter(a => a._retriever === 'trinity-m'
                     || a._retriever === 'trinity-lt'
                     || a._retriever === 'trinity-fresh')
          .map(a => a.vq_secondary).filter(c => c != null)
  )
  const updates = emaUpdates(clusterState, Array.from(shownClusters))
  if (updates.length > 0) {
    supabase.from('cluster_state').upsert(updates, { onConflict: 'cluster_id' }).then(({ error }) => {
      if (error) console.error('[trinity] cluster_state upsert failed:', error.message)
    })
  }

  // v3-D: bandit "show" counter for explore picks. Engage counter is updated
  // separately by the analytics pipeline when the user actually engages.
  const exploreShown = picked.filter(a => a._retriever === 'explore')
                             .map(a => a.vq_secondary).filter(c => c != null)
  if (exploreShown.length > 0) {
    bumpExploreShows(supabase, exploreShown)
  }

  return {
    articles: picked,
    attribution: picked.map(a => a._retriever),
    debug: {
      path: 'trinity-v4', qualifyingCount,
      codebookId: codebook.id, thresholds,
      mClusters, ltClusters, explClusters: explClusters.slice(0, exploreSlots * 3),
      freshPrimaries, freshCandidates: freshPool.length,
      mWindowH: mResult.hoursWindow,
      ltWindowH: ltResult.hoursWindow,
      exploreWindowH: exploreResult.hoursWindow,
      poolSize: candidates.length,
      shownClustersCount: shownClusters.size,
      exploreServed: exploreShown.length,
      bucketCounts: countBuckets(picked),
      durationMs: Date.now() - t0,
    },
  }
}


function countBuckets(picked) {
  const counts = {}
  for (const a of picked) counts[a._retriever] = (counts[a._retriever] || 0) + 1
  return counts
}


// v3-B + v4-C: rerank uses content-aware recency × bucket boost × hard stale
// penalty. Stale penalty fires when an article's age exceeds STALE_AGE_DAYS,
// dragging score down by STALE_PENALTY_FACTOR. This is independent of the
// shelf_life half-life — protects against high-shelf-life "evergreen"
// articles outranking fresh news content for the news-feed user.
function rerank(candidates) {
  const now = Date.now()
  for (const a of candidates) {
    const recency = recencyWeightForArticle(a, now)
    const quality = Number(a.ai_final_score || 0)
    const bucketBoost = BUCKET_BOOST[a._retriever] ?? 1.0
    const ageDays = (now - new Date(a.created_at || a.published_at || now).getTime()) / 86400000
    const stale = ageDays > STALE_AGE_DAYS ? STALE_PENALTY_FACTOR : 1
    a._score = quality * recency * bucketBoost * stale
  }
  candidates.sort((a, b) => b._score - a._score)
  return candidates
}


function mmrDiversify(ranked, feedSize) {
  if (ranked.length === 0) return []
  const picked = []
  const pickedEmbeds = []
  for (const cand of ranked) {
    if (picked.length >= feedSize) break
    const emb = parseEmbedding(cand.embedding_minilm_vec)
    if (!emb) {
      picked.push(cand); pickedEmbeds.push(null); continue
    }
    let maxSim = 0
    for (const pe of pickedEmbeds) {
      if (!pe) continue
      const sim = cosineSim(emb, pe)
      if (sim > maxSim) maxSim = sim
    }
    if (maxSim >= MMR_DUPLICATE_CEILING) continue
    picked.push(cand)
    pickedEmbeds.push(emb)
  }
  return picked
}


async function retrieveTrending(supabase, { hoursWindow, excludeIds, limit }) {
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .gte('created_at', sinceIso)
    .gte('ai_final_score', 400)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds && excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error('[trinity] retrieveTrending failed:', error.message)
    return []
  }
  return data || []
}


// v3-D: increment explore_shows for clusters served via the explore arm.
// Fire-and-forget, never blocks the response. Engages counter is bumped
// elsewhere by analytics when the user actually engages with an article.
function bumpExploreShows(supabase, clusterIds) {
  // Single round-trip: read existing state, then upsert with incremented counts.
  // Using a SQL helper would be cleaner, but the round-trip cost is one query
  // anyway since we have to upsert.
  supabase.from('cluster_state')
    .select('cluster_id, explore_shows')
    .in('cluster_id', clusterIds)
    .then(({ data, error }) => {
      if (error) {
        console.error('[trinity] explore_shows read failed:', error.message)
        return
      }
      const existing = new Map((data || []).map(r => [r.cluster_id, r.explore_shows || 0]))
      const upserts = clusterIds.map(c2 => ({
        cluster_id: c2,
        explore_shows: (existing.get(c2) || 0) + 1,
        last_shown_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      supabase.from('cluster_state').upsert(upserts, { onConflict: 'cluster_id' }).then(({ error: upErr }) => {
        if (upErr) console.error('[trinity] explore_shows upsert failed:', upErr.message)
      })
    })
}


function parseEmbedding(value) {
  if (!value) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try { return JSON.parse(s) } catch { return null }
    }
  }
  return null
}


function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

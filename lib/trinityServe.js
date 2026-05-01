// Trinity v2 serving orchestrator.
//
// Wraps the pure algorithms in lib/trinity.js with:
//   - DB calls to load codebook / cluster state / article counts
//   - Reranker (ai_final_score × recency × bucket_boost)
//   - MMR diversity rail
//   - Cluster-state EMA update on shown clusters
//   - Cold-start fallback (trending pool when histogram too sparse)
//
// Lessons baked in from v1 (PRs #94-#98):
//   - Bucket-aware reranker boost. Without it, the topup-trending bucket
//     scored 16/20 slots in the 2026-04-30 21:51 session because raw
//     ai_final_score crowned breaking-news every time.
//   - TRENDING_TOPUP_FLOOR = feedSize. v1 had feedSize × 3 = 60, so
//     trending fired on ~every request. New floor only fires when pool
//     is genuinely thin.
//   - Adaptive thresholds passed to trinityM (T_p / T_s scale to user).

import {
  buildHistograms,
  trinityM,
  trinityLT,
  emaUpdates,
  loadActiveCodebook,
  loadClusterState,
  loadArticleCountsBySecondary,
  retrieveCandidates,
  adaptiveThresholds,
  HISTOGRAM_WINDOW,
} from './trinity.js'

const COLD_START_QUALIFYING_FLOOR = 50
const FINAL_FEED_SIZE = 20
const PER_M_LIMIT = 12
const PER_LT_LIMIT = 8
const TRENDING_POOL_SIZE = 100
const RECENCY_HALF_LIFE_HOURS = 36
const MMR_DUPLICATE_CEILING = 0.78

// Bucket-aware reranker boost. Trinity is silent on the final-stage scorer
// (TikTok uses a watch-time two-tower, our Phase 7). Until then, this preserves
// Trinity's diversity at the rank step:
//   - trinity-m / trinity-lt: explicit personalization, prefer
//   - topup-trending: fallback only, demote
const BUCKET_BOOST = {
  'trinity-m':       1.5,
  'trinity-lt':      1.4,
  'topup-trending':  0.6,
  'cold-trending':   1.0,
}

// Trending top-up only fires when the joint Trinity pool is genuinely thin
// (< feedSize). Anything more aggressive crowds out Trinity's diversity.
const TRENDING_TOPUP_FLOOR = FINAL_FEED_SIZE


export async function serveTrinityFeed(supabase, opts) {
  const t0 = Date.now()
  const {
    userId,
    seenIds = [],
    feedSize = FINAL_FEED_SIZE,
    hoursWindow = 7 * 24,
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

  // Cold-start path: not enough history to drive Trinity.
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR) {
    const cold = await retrieveTrending(supabase, {
      hoursWindow, excludeIds: seenIds, limit: TRENDING_POOL_SIZE,
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

  const thresholds = adaptiveThresholds(qualifyingCount)
  const mClusters  = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds)
  const ltClusters = trinityLT(h2, clusterState, articleCounts)

  const [mPool, ltPool] = await Promise.all([
    mClusters.length  ? retrieveCandidates(supabase, mClusters,  { perClusterLimit: PER_M_LIMIT,  hoursWindow, excludeIds: seenIds }) : [],
    ltClusters.length ? retrieveCandidates(supabase, ltClusters, { perClusterLimit: PER_LT_LIMIT, hoursWindow, excludeIds: seenIds }) : [],
  ])

  const mergedById = new Map()
  for (const a of mPool)  if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-m' })
  for (const a of ltPool) if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-lt' })
  let candidates = Array.from(mergedById.values())

  // Trending top-up only when joint pool is genuinely thin.
  if (candidates.length < TRENDING_TOPUP_FLOOR) {
    const trending = await retrieveTrending(supabase, {
      hoursWindow,
      excludeIds: [...seenIds, ...candidates.map(c => c.id)],
      limit: TRENDING_TOPUP_FLOOR * 2,
    })
    for (const a of trending) candidates.push({ ...a, _retriever: 'topup-trending' })
  }

  const ranked = rerank(candidates)
  const picked = mmrDiversify(ranked, feedSize)

  const shownClusters = new Set(picked.map(a => a.vq_secondary).filter(c => c != null))
  const updates = emaUpdates(clusterState, Array.from(shownClusters))
  if (updates.length > 0) {
    supabase.from('cluster_state').upsert(updates, { onConflict: 'cluster_id' }).then(({ error }) => {
      if (error) console.error('[trinity] cluster_state upsert failed:', error.message)
    })
  }

  return {
    articles: picked,
    attribution: picked.map(a => a._retriever),
    debug: {
      path: 'trinity', qualifyingCount,
      codebookId: codebook.id, thresholds,
      mClusters, ltClusters,
      poolSize: candidates.length,
      shownClustersCount: shownClusters.size,
      durationMs: Date.now() - t0,
    },
  }
}


function rerank(candidates) {
  const now = Date.now()
  const lambdaH = Math.log(2) / RECENCY_HALF_LIFE_HOURS
  for (const a of candidates) {
    const ageH = (now - new Date(a.created_at || a.published_at || now).getTime()) / 3600000
    const recency = Math.exp(-lambdaH * Math.max(0, ageH))
    const quality = Number(a.ai_final_score || 0)
    const bucketBoost = BUCKET_BOOST[a._retriever] ?? 1.0
    a._score = quality * recency * bucketBoost
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

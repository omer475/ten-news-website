// Trinity serving orchestrator — Phase 2 + 3.
//
// Wraps the pure algorithms in lib/trinity.js with:
//   - DB calls to load codebook / cluster state / article counts
//   - Reranker (ai_final_score × recency)
//   - MMR diversity rail
//   - Cluster-state EMA update on shown clusters
//   - Impression logging with propensity_score (Wang/Joachims 2018)
//   - Cold-start fallback (trending pool when user histogram is too sparse)
//
// /api/feed/main routes to this module when personalization_profiles.trinity_enabled=true
// for the requesting user. Otherwise the legacy v11 path keeps serving.

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

const COLD_START_QUALIFYING_FLOOR = 50   // < this many qualifying behaviors -> trending fallback
const FINAL_FEED_SIZE = 20
const PER_M_LIMIT = 12                   // per cluster from Trinity-M (10 clusters x 12 = 120)
const PER_LT_LIMIT = 8                   // per cluster from Trinity-LT (20 clusters x 8 = 160)
const TRENDING_POOL_SIZE = 100
const RECENCY_HALF_LIFE_HOURS = 36       // text-news shelf life; not a Trinity parameter
const MMR_LAMBDA = 0.7                   // diversity weight for embedding-cosine MMR
const MMR_DUPLICATE_CEILING = 0.78       // cosine above which we drop as near-dup

// Bucket-aware reranker boost. Paper-orthogonal — neither Trinity nor
// Streaming VQ specifies a final-stage scorer (TikTok uses a watch-time
// two-tower model, Phase 7 in our roadmap). Until that lands, this preserves
// Trinity's diversity at the rank step:
//   - trinity-m / trinity-lt: explicit personalization, prefer
//   - topup-trending: a fallback so the slate isn't empty, demote
// The 2026-04-30 23:51 session served 16/20 topup-trending because Trinity
// picks scored 600-800 but breaking-news trending scored 900+.
const BUCKET_BOOST = {
  'trinity-m':       1.5,
  'trinity-lt':      1.4,
  'topup-trending':  0.6,
  'cold-trending':   1.0,
}

// Trending top-up only fires if Trinity's joint pool is genuinely thin.
// Was feedSize * 3 = 60 (fired almost every request — dedup shrinks pool).
const TRENDING_TOPUP_FLOOR = FINAL_FEED_SIZE  // i.e., 20


// ---------------------------------------------------------------------------
// Top-level: produce a Trinity feed for one request.
// Returns { articles, attribution, debug } where attribution[i] tells you
// which retriever (M / LT / cold) produced articles[i].
// ---------------------------------------------------------------------------

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

  // Cold-start: not enough qualifying history. Fall through to a lean trending
  // pool. Paper says retrievers run additively; with one user we use trending
  // as the cold-start spine until the histogram has substance.
  if (qualifyingCount < COLD_START_QUALIFYING_FLOOR) {
    const cold = await retrieveTrending(supabase, { hoursWindow, excludeIds: seenIds, limit: TRENDING_POOL_SIZE })
    const ranked = rerank(cold)
    const picked = mmrDiversify(ranked, feedSize)
    return {
      articles: picked,
      attribution: picked.map(() => 'cold-trending'),
      debug: {
        path: 'cold-start',
        qualifyingCount,
        codebookId: codebook.id,
        durationMs: Date.now() - t0,
      },
    }
  }

  // Adaptive thresholds: the paper assumed ~2,500 qualifying behaviors per
  // user. Our test user has ~600. Scaling T_p / T_s by the ratio preserves
  // the paper's intent (1.2% / 0.4% of histogram volume).
  const thresholds = adaptiveThresholds(qualifyingCount)

  // Hot path: run Trinity-M + Trinity-LT. Both run unconditionally; their
  // candidate pools are merged and the reranker decides the final 20.
  const mClusters  = trinityM(h1, h2, codebook.parentMap, Math.random, thresholds)
  const ltClusters = trinityLT(h2, clusterState, articleCounts)

  const [mPool, ltPool] = await Promise.all([
    mClusters.length  ? retrieveCandidates(supabase, mClusters,  { perClusterLimit: PER_M_LIMIT,  hoursWindow, excludeIds: seenIds }) : [],
    ltClusters.length ? retrieveCandidates(supabase, ltClusters, { perClusterLimit: PER_LT_LIMIT, hoursWindow, excludeIds: seenIds }) : [],
  ])

  // Merge + dedup by article id. Tag each article with its retriever for attribution.
  const mergedById = new Map()
  for (const a of mPool)  if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-m' })
  for (const a of ltPool) if (!mergedById.has(a.id)) mergedById.set(a.id, { ...a, _retriever: 'trinity-lt' })
  let candidates = Array.from(mergedById.values())

  // Top-up with trending only if the joint pool is genuinely thin (< feedSize).
  // Trinity's diversity is the whole point — flooding with trending undoes it.
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

  // EMA-update cluster_state for the secondary clusters that actually appeared
  // in the final feed (Trinity-LT spec: only count clusters that got exposure).
  const shownClusters = new Set(picked.map(a => a.vq_secondary).filter(c => c != null))
  const updates = emaUpdates(clusterState, Array.from(shownClusters))
  if (updates.length > 0) {
    // Fire-and-forget upsert; failure shouldn't block the response.
    supabase.from('cluster_state').upsert(updates, { onConflict: 'cluster_id' }).then(({ error }) => {
      if (error) console.error('[trinity] cluster_state upsert failed:', error.message)
    })
  }

  return {
    articles: picked,
    attribution: picked.map(a => a._retriever),
    debug: {
      path: 'trinity',
      qualifyingCount,
      codebookId: codebook.id,
      thresholds,
      mClusters,
      ltClusters,
      poolSize: candidates.length,
      shownClustersCount: shownClusters.size,
      durationMs: Date.now() - t0,
    },
  }
}


// ---------------------------------------------------------------------------
// Reranker.
// ---------------------------------------------------------------------------
//
// Paper-orthogonal. Trinity is silent on the final scorer. We use a minimal
// blend of:
//   - ai_final_score (per-article quality, set by pipeline Step 10)
//   - exponential recency decay (text news has shelf life unlike video)
// MMR diversification happens after this in mmrDiversify().

function rerank(candidates) {
  const now = Date.now()
  const lambdaH = Math.log(2) / RECENCY_HALF_LIFE_HOURS
  for (const a of candidates) {
    const ageH = (now - new Date(a.created_at || a.published_at || now).getTime()) / 3600000
    const recency = Math.exp(-lambdaH * Math.max(0, ageH))     // 1 fresh -> 0 ancient
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
    if (maxSim >= MMR_DUPLICATE_CEILING) continue   // hard near-dup drop
    // MMR rerank: λ × normalized score - (1-λ) × maxSim
    // We don't re-sort here; we accept the next candidate that passes the
    // duplicate ceiling. The pre-sort by _score already handles the score side.
    picked.push(cand)
    pickedEmbeds.push(emb)
  }
  return picked
}


// ---------------------------------------------------------------------------
// Cold-start trending pool.
// ---------------------------------------------------------------------------

async function retrieveTrending(supabase, { hoursWindow, excludeIds, limit }) {
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .gte('created_at', sinceIso)
    .gte('ai_final_score', 400)        // floor for trending; real ai_final_score range is 0-1000
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


// ---------------------------------------------------------------------------
// Embedding helpers.
// ---------------------------------------------------------------------------

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

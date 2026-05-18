// Per-primary user-vector computation for the trinity-personal retriever
// (P2 fix, 2026-05-11). Implements the user-side of the multi-vector retrieval
// architecture locked in spec section 3.2.
//
// Sources:
//   - Trinity (KDD 2024, arxiv:2402.02842) — engagement-filtered behavior
//     buffer, N_M = 10 top primaries. Buffer size scaled to 1000 for our
//     text-feed throughput (vs Trinity's 2500 for video).
//   - PinnerSage (KDD 2020, arxiv:2007.03634) — per-cluster user vector =
//     recency-weighted mean of engaged-article embeddings, λ = 0.01/day.

// ---------------------------------------------------------------------------
// Constants — locked, see /Users/omersogancioglu/.claude/plans/algorithm-spec-locked-2026-05-11.md
// ---------------------------------------------------------------------------

export const ENGAGEMENT_BUFFER_LIMIT = 1000
export const PER_PRIMARY_SOFT_CAP = 200
export const RECENCY_DECAY_LAMBDA = 0.01    // PinnerSage λ per day
export const EMBEDDING_DIM = 384            // MiniLM dim — must match HNSW index
export const VECTOR_CACHE_TTL_MS = 5 * 60 * 1000  // spec 4.7

// PR6 (2026-05-18) — per-primary buffer constants.
// Production audit on test user 5082a1df: with the legacy global-1000-cap
// buffer, primary 39 (their #1 Tech interest by 60-day histogram, h1=1929)
// had only 15 rows in the buffer despite 155 deep-read events in 60 days.
// The recency cap let recent algorithm-bug-era serving (heavy China/LT)
// drown out the user's actual long-term interests. New per-primary RPC
// `user_engagement_buffer_per_primary` (mig 127) returns top-200 deep-reads
// PER vq_primary across the user's top-50 primaries — independent of which
// primaries the algorithm happens to be serving lately. PinnerSage pattern.
export const PER_PRIMARY_BUFFER_LIMIT = 200
export const MAX_PRIMARIES_IN_BUFFER = 50
// Env override `TRINITY_PER_PRIMARY_BUFFER=0` reverts to the legacy RPC for
// fast rollback without redeploy. Default on.
const _perPrimaryEnv = process.env.TRINITY_PER_PRIMARY_BUFFER
export const PER_PRIMARY_BUFFER_ENABLED =
  _perPrimaryEnv == null || (_perPrimaryEnv !== '0' && _perPrimaryEnv !== 'false')

// ---------------------------------------------------------------------------
// LRU cache for per-primary user vectors. Keyed by user_id. Module-level
// state intentionally — Vercel keeps the Node module warm across requests in
// the same lambda instance, so this is a cross-request cache (best-effort
// because a cold lambda starts empty).
//
// Stored value:
//   {
//     vectorsByPrimary: Map<primary:number, Float32Array(384)>,
//     bufferSize: number,
//     createdAt: number,
//   }
// ---------------------------------------------------------------------------

const _vectorCache = new Map()

function cacheGet(userId) {
  if (!userId) return null
  const entry = _vectorCache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.createdAt > VECTOR_CACHE_TTL_MS) {
    _vectorCache.delete(userId)
    return null
  }
  return entry
}

function cachePut(userId, vectorsByPrimary, bufferSize) {
  if (!userId) return
  _vectorCache.set(userId, {
    vectorsByPrimary, bufferSize, createdAt: Date.now(),
  })
  // Cap cache size to prevent unbounded memory growth on busy lambdas. LRU
  // eviction by insertion order — Map preserves insertion order.
  if (_vectorCache.size > 200) {
    const oldestKey = _vectorCache.keys().next().value
    _vectorCache.delete(oldestKey)
  }
}

export function _clearVectorCacheForTests() {
  _vectorCache.clear()
}

// ---------------------------------------------------------------------------
// parseEmbedding — pgvector text repr "[0.1, 0.2, ...]" or already-parsed
// arrays. Mirrors the helper in lib/trinityServe.js so we don't cross-import.
// ---------------------------------------------------------------------------

export function parseEmbedding(value) {
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

// ---------------------------------------------------------------------------
// loadEngagementBuffer — calls the user_engagement_buffer RPC (mig 113).
// Returns parsed buffer rows: { article_id, vq_primary, embedding[], age_days,
// event_type }. Filters out rows that fail to parse (defensive — the RPC
// already excludes nulls but PostgREST can yield empty arrays).
// ---------------------------------------------------------------------------

export async function loadEngagementBuffer(supabase, userId, opts = {}) {
  if (!userId) return []
  // PR6 (2026-05-18) — prefer the per-primary RPC (mig 127). Falls back to
  // legacy global-cap RPC if env flag disabled or the new RPC errors.
  const usePerPrimary = opts.usePerPrimary ?? PER_PRIMARY_BUFFER_ENABLED
  try {
    let rpcName
    let rpcArgs
    if (usePerPrimary) {
      rpcName = 'user_engagement_buffer_per_primary'
      rpcArgs = {
        p_user_id: userId,
        p_per_primary_limit: opts.perPrimaryLimit ?? PER_PRIMARY_BUFFER_LIMIT,
        p_max_primaries: opts.maxPrimaries ?? MAX_PRIMARIES_IN_BUFFER,
      }
    } else {
      rpcName = 'user_engagement_buffer'
      rpcArgs = { p_user_id: userId, p_limit: opts.limit ?? ENGAGEMENT_BUFFER_LIMIT }
    }
    const { data, error } = await supabase.rpc(rpcName, rpcArgs)
    if (error) {
      console.error(`[trinity.personal] ${rpcName} RPC failed:`, error.message)
      // Auto-fallback if the per-primary RPC isn't deployed yet (mig 127
      // pending). Avoid silent breakage during the rollout window.
      if (usePerPrimary && /function .* does not exist/i.test(error.message)) {
        return loadEngagementBuffer(supabase, userId, { ...opts, usePerPrimary: false })
      }
      return []
    }
    if (!Array.isArray(data)) return []
    const out = []
    for (const row of data) {
      const emb = parseEmbedding(row.embedding_minilm_vec)
      if (!emb || emb.length !== EMBEDDING_DIM) continue
      if (row.vq_primary == null) continue
      out.push({
        article_id: row.article_id,
        vq_primary: Number(row.vq_primary),
        embedding: emb,
        age_days: Number(row.age_days) || 0,
        event_type: row.event_type,
      })
    }
    return out
  } catch (err) {
    console.error('[trinity.personal] loadEngagementBuffer threw:', err.message)
    return []
  }
}

// ---------------------------------------------------------------------------
// computePrimaryUserVectors — pure JS, no DB. For each requested primary,
// compute the recency-weighted mean of engaged-article embeddings.
//
// Returns Map<primary:number, Float32Array(384)>. Primaries with zero items
// in the buffer are omitted (caller treats as "no personal signal yet for
// this primary, fall back to fresh pool").
//
// Math (PinnerSage formula):
//   for each item in buffer.filter(vq_primary == p)[:200]:
//     w_i = exp(-0.01 * age_days_i)
//   user_vec_p = sum(w_i * emb_i) / sum(w_i)
//
// Soft cap of 200 per primary is taken on most-recent-first ordering because
// the buffer comes ORDER BY created_at DESC from the RPC.
// ---------------------------------------------------------------------------

export function computePrimaryUserVectors(buffer, primaries) {
  const out = new Map()
  if (!Array.isArray(buffer) || buffer.length === 0) return out
  if (!Array.isArray(primaries) || primaries.length === 0) return out

  const primarySet = new Set(primaries.map(Number))

  // Group buffer items by primary (preserves order; buffer is recency-DESC).
  const byPrimary = new Map()
  for (const item of buffer) {
    if (!primarySet.has(item.vq_primary)) continue
    let bucket = byPrimary.get(item.vq_primary)
    if (!bucket) {
      bucket = []
      byPrimary.set(item.vq_primary, bucket)
    }
    if (bucket.length < PER_PRIMARY_SOFT_CAP) bucket.push(item)
  }

  for (const [primary, items] of byPrimary) {
    if (items.length === 0) continue
    const vec = new Float32Array(EMBEDDING_DIM)
    let totalWeight = 0
    for (const it of items) {
      const w = Math.exp(-RECENCY_DECAY_LAMBDA * it.age_days)
      if (!Number.isFinite(w) || w <= 0) continue
      const emb = it.embedding
      if (!emb || emb.length !== EMBEDDING_DIM) continue
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        vec[d] += w * emb[d]
      }
      totalWeight += w
    }
    if (totalWeight <= 0) continue
    for (let d = 0; d < EMBEDDING_DIM; d++) vec[d] /= totalWeight
    out.set(primary, vec)
  }
  return out
}

// ---------------------------------------------------------------------------
// getPrimaryUserVectors — cached entry point. Returns the Map<primary, vec>
// for `primaries`, computing + caching when absent.
//
// Cache strategy: cache the ENTIRE Map for a user (across all primaries we've
// ever computed). On a request asking for primaries P, if the cache entry is
// missing any of P, recompute from a fresh buffer fetch.
//
// Rationale: spec 4.7 caches "per-primary user vectors" with a 5-min TTL. We
// implement this as one cache entry per user, lazily populated. The hot path
// (same user, same top-10 primaries within 5 minutes) is a single Map.get.
// ---------------------------------------------------------------------------

export async function getPrimaryUserVectors(supabase, userId, primaries, opts = {}) {
  if (!userId || !Array.isArray(primaries) || primaries.length === 0) {
    return { vectorsByPrimary: new Map(), bufferSize: 0, cacheHit: false }
  }
  const cached = cacheGet(userId)
  if (cached) {
    // Cache hit only if every requested primary is already represented OR
    // confirmed absent from the buffer. The latter is encoded by the
    // existence of the cache entry itself — if we computed vectors and a
    // primary isn't in the Map, the user has zero engaged articles in it.
    return {
      vectorsByPrimary: cached.vectorsByPrimary,
      bufferSize: cached.bufferSize,
      cacheHit: true,
    }
  }
  const buffer = await loadEngagementBuffer(supabase, userId, opts)
  // Compute vectors for ALL primaries present in the buffer (not just the
  // requested ones) so subsequent requests with different top-N see the same
  // cached state. Cheap — at most J_PRIMARY=256 distinct values.
  const allPrimaries = Array.from(new Set(buffer.map(b => b.vq_primary)))
  const vectorsByPrimary = computePrimaryUserVectors(buffer, allPrimaries)
  cachePut(userId, vectorsByPrimary, buffer.length)
  return { vectorsByPrimary, bufferSize: buffer.length, cacheHit: false }
}

// ---------------------------------------------------------------------------
// formatVectorForPg — Float32Array → "[0.123,0.456,...]" string for
// PostgREST. pgvector accepts a JSON-style array literal.
// ---------------------------------------------------------------------------

export function formatVectorForPg(vec) {
  if (!vec || vec.length === 0) return null
  const parts = new Array(vec.length)
  for (let i = 0; i < vec.length; i++) parts[i] = Number(vec[i]).toFixed(6)
  return '[' + parts.join(',') + ']'
}

// lib/feedCache.js — precomputed first-page feed cache (X/TikTok/IG-style
// fan-out-on-write). Written by /api/cron/precompute-feeds (offline) and as a
// cache-aside write in /api/feed/main; read by /api/feed/main on the first
// page to replace the ~8s live recompute with a sub-ms PK lookup.
//
// On any miss / staleness / too-few-unseen / error, callers fall through to
// the live Trinity path, so the cache can never be slower or lower-quality
// than recomputing.

// Freshness window. Precompute runs every 10 min, so 12 min guarantees a
// just-built slate is still considered fresh between cron ticks.
export const FEED_CACHE_FRESH_MS = 12 * 60 * 1000

// Lightweight per-article exposure metadata, derived from the RAW Trinity
// slate (the objects serveTrinityFeed returns still carry _retriever /
// vq_* / source). Persisted instead of the full article so a cache HIT can
// replay recordSlateExposure() at serve time without storing heavy objects.
export function buildExposureMeta(rawSlate) {
  return (rawSlate || []).map(a => ({
    p: a?.vq_primary ?? null,
    s: a?.vq_secondary ?? null,
    src: typeof a?.source === 'string' ? a.source : null,
    r: a?._retriever || a?._retrieverTier || null,
  }))
}

// Expand stored meta back into the shape recordSlateExposure expects.
export function expandExposureMeta(meta) {
  return (meta || []).map(m => ({
    vq_primary: m?.p ?? null,
    vq_secondary: m?.s ?? null,
    source: m?.src ?? null,
    _retriever: m?.r ?? null,
  }))
}

// Upsert a freshly built slate. `formatted` is the client payload (chip_tags
// attached); `exposureMeta` must be 1:1 aligned with it.
export async function writeFeedCache(supabase, userId, formatted, exposureMeta, poolSize) {
  if (!userId || !Array.isArray(formatted) || formatted.length === 0) return
  const article_ids = formatted.map(a => Number(a.id)).filter(Boolean)
  const { error } = await supabase.from('user_feed_cache').upsert({
    user_id: userId,
    slate: formatted,
    exposure: Array.isArray(exposureMeta) ? exposureMeta : [],
    article_ids,
    pool_size: poolSize || formatted.length,
    built_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) console.error('[feedCache] write failed:', error.message)
}

// Returns { articles, exposure, poolSize, ageMs } when a fresh slate still
// yields >= `limit` unseen articles after removing the caller's seen ids;
// otherwise null (→ caller computes live).
export async function readFeedCache(supabase, userId, { limit, seenIds, freshMs = FEED_CACHE_FRESH_MS }) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('user_feed_cache')
    .select('slate, exposure, pool_size, built_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null

  const ageMs = Date.now() - new Date(data.built_at).getTime()
  if (!(ageMs >= 0) || ageMs > freshMs) return null

  const slate = Array.isArray(data.slate) ? data.slate : []
  const exposure = Array.isArray(data.exposure) ? data.exposure : []
  if (slate.length === 0) return null

  const seen = new Set((seenIds || []).map(Number))
  const keptArticles = []
  const keptExposure = []
  for (let i = 0; i < slate.length; i++) {
    const id = Number(slate[i]?.id)
    if (id && seen.has(id)) continue
    keptArticles.push(slate[i])
    keptExposure.push(exposure[i] ?? null)   // kept parallel to articles
  }
  // Not enough fresh content left for a full page → let the live path run so
  // the user gets new articles rather than a short, mostly-seen slate.
  if (keptArticles.length < limit) return null

  return {
    articles: keptArticles.slice(0, limit),
    exposure: keptExposure.slice(0, limit),
    poolSize: data.pool_size || keptArticles.length,
    ageMs,
  }
}

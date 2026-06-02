// pages/api/feed/topic.js — entity-scoped article feed (4-lane retrieval).
//
// Powers the chip-tap drill-down on the iOS For You feed: when a user
// taps a topic chip under an article, iOS opens TopicFeedView which
// calls this endpoint to get related articles. Same JSON shape as
// /api/feed/main / following so ArticleCardContinuousView renders
// unchanged.
//
// Match strategy (4 parallel lanes, merged then re-ranked):
//   A) interest_tags @> [entity]           — curated tag, highest precision
//   B) title_news ILIKE %entity%           — headline lexical match
//   C) summary_bullets_news::text ILIKE    — bullet text, post-filtered by
//                                            embedding cosine ≥ 0.30 vs source
//                                            (kills "Ford" matching surnames)
//   D) topic_knn_candidates(source_vec)    — embedding kNN over HNSW, cosine
//                                            ≥ 0.40 — semantic fallback that
//                                            catches articles about the same
//                                            topic area even without lexical
//                                            overlap
//
// Lanes C and D require source_id (chip-tap origin article). When absent,
// the endpoint degrades gracefully to lanes A+B only and logs a warning so
// adoption can be tracked.
//
// After merging:
//   1) dedupe by id, exclude source_id (user already saw it)
//   2) blended score: 0.55 * log10(score)/3 + 0.45 * 2^(-hoursOld/36)
//      Recency half-life 36h matches Reddit/HN norms for topic surfaces.
//   3) cluster_id dedup — keep one article per news cluster
//   4) per-publisher cap — max 2 from the same author in the first 10 slots
//   5) paginate
//
// No hard age cutoff (previously 30d). The recency-decay term naturally
// pushes old articles toward 0; old strong articles only surface for niche
// entities with sparse recent coverage, which is exactly when we want them.
//
// Cache: 120s public + 60s SWR.

import { formatArticle, FEED_ARTICLE_COLUMNS } from '../../../lib/formatArticle.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40

// Per-lane fetch cap. Title-ILIKE is a broad net; cap stops a popular entity
// ("Trump" → 3000+ title matches) from drowning the curated tag pool.
const PER_LANE_FETCH = 80
// Lane C is the broadest lexical lane (bullet ILIKE). Cap tighter to bound
// the cosine post-filter cost.
const LANE_C_CANDIDATE_CAP = 100
const LANE_D_K = 30

// ─── Scoring constants ──────────────────────────────────────────────
// Topic pages are exploratory — recency weighs nearly as much as quality.
const QUALITY_WEIGHT = 0.55
const RECENCY_WEIGHT = 0.45
const RECENCY_HALF_LIFE_HOURS = 36   // between Reddit (~12h) and HN (~24h)
const QUALITY_NORM_DIVISOR = 3       // log10(1000) = 3 → maps score 1..1000 to [0,1]
const PUBLISHER_CAP_IN_TOP_K = 2
const PUBLISHER_CAP_TOP_K = 10

// ─── Cosine thresholds (tuning knobs) ───────────────────────────────
const LANE_C_MIN_COSINE = 0.30       // post-filter on bullet ILIKE; loose
const LANE_D_MIN_COSINE = 0.40       // kNN floor; tighter because cosine is
                                     // the only signal in lane D

// Parse a pgvector text serialization "[0.1,0.2,...]" → Float32Array.
function parseVector(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return Float32Array.from(raw)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? Float32Array.from(parsed) : null
    } catch {
      return null
    }
  }
  return null
}

// Cosine similarity for two unit-magnitude vectors of identical dim.
// pgvector text serialization preserves the original magnitudes, so we
// compute the full normalized cosine inline — no shortcuts.
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i], bv = b[i]
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 0 ? dot / denom : 0
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawEntity = (req.query.entity || '').toString().trim()
  if (!rawEntity) {
    return res.status(400).json({ error: 'entity query param required' })
  }
  // Strip anything that would break PostgREST `or`/`ilike` filters or
  // smuggle additional predicates. Letters, numbers, spaces, hyphens,
  // apostrophes, and ampersands cover every real entity name we tag.
  const cleaned = rawEntity.replace(/[^\p{L}\p{N}\s\-'&]/gu, '').trim()
  if (!cleaned) {
    return res.status(400).json({ error: 'entity contains no usable characters' })
  }
  const entityLower = cleaned.toLowerCase()

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT))

  // Optional source_id — when present, unlocks lanes C and D.
  const sourceIdRaw = parseInt(req.query.source_id, 10)
  const sourceId = Number.isFinite(sourceIdRaw) && sourceIdRaw > 0 ? sourceIdRaw : null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const t0 = Date.now()

  try {
    // ── Step 1: fetch source embedding (single row, fast) ─────────
    // Required for lanes C (post-filter) and D (kNN seed). When sourceId
    // missing OR the row has no embedding, both lanes are skipped and
    // the endpoint falls back to legacy 2-lane (A+B) behavior.
    let sourceVec = null
    let sourceVecText = null  // pgvector string form, needed by RPC
    if (sourceId) {
      const { data: srcRow, error: srcErr } = await supabase
        .from('published_articles')
        .select('embedding_minilm_vec')
        .eq('id', sourceId)
        .maybeSingle()
      if (srcErr) {
        console.error('[feed:topic] source lookup failed:', srcErr.message)
      }
      if (srcRow?.embedding_minilm_vec) {
        sourceVec = parseVector(srcRow.embedding_minilm_vec)
        // Preserve the original string form for the RPC call — pgvector
        // accepts the same "[...]" syntax it returns.
        sourceVecText = typeof srcRow.embedding_minilm_vec === 'string'
          ? srcRow.embedding_minilm_vec
          : JSON.stringify(Array.from(sourceVec || []))
      }
    } else {
      console.warn('[feed:topic] no source_id — lanes C/D skipped (legacy client)')
    }
    const withEmb = sourceVec !== null

    // ── Step 2: fire all 4 lanes in parallel ──────────────────────
    const laneA = supabase
      .from('published_articles')
      .select(FEED_ARTICLE_COLUMNS)
      .contains('interest_tags', [entityLower])
      .order('ai_final_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(PER_LANE_FETCH)

    const laneB = supabase
      .from('published_articles')
      .select(FEED_ARTICLE_COLUMNS)
      .ilike('title_news', `%${entityLower}%`)
      .order('ai_final_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(PER_LANE_FETCH)

    // Lane C — bullet ILIKE plus a cosine post-filter in JS. We fetch
    // the embedding here so the post-filter doesn't need a second query.
    const laneC = withEmb
      ? supabase
          .from('published_articles')
          .select(`${FEED_ARTICLE_COLUMNS}, embedding_minilm_vec`)
          .filter('summary_bullets_news::text', 'ilike', `%${entityLower}%`)
          .order('ai_final_score', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(LANE_C_CANDIDATE_CAP)
      : Promise.resolve({ data: [], error: null })

    // Lane D — embedding kNN via the topic_knn_candidates SQL function.
    // Returns ids + similarity; hydrate to full rows below.
    const laneD = withEmb
      ? supabase.rpc('topic_knn_candidates', {
          source_vec: sourceVecText,
          k: LANE_D_K,
          min_sim: LANE_D_MIN_COSINE,
        })
      : Promise.resolve({ data: [], error: null })

    const [aRes, bRes, cRes, dRes] = await Promise.all([laneA, laneB, laneC, laneD])

    if (aRes.error) console.error('[feed:topic] lane A failed:', aRes.error.message)
    if (bRes.error) console.error('[feed:topic] lane B failed:', bRes.error.message)
    if (cRes.error) console.error('[feed:topic] lane C failed:', cRes.error.message)
    if (dRes.error) console.error('[feed:topic] lane D failed:', dRes.error.message)

    // ── Step 2b: post-filter lane C by cosine ─────────────────────
    let laneCRows = []
    if (withEmb && Array.isArray(cRes.data)) {
      for (const row of cRes.data) {
        const v = parseVector(row.embedding_minilm_vec)
        if (!v) continue
        const sim = cosineSim(sourceVec, v)
        if (sim >= LANE_C_MIN_COSINE) {
          // Strip the embedding before it joins the merge pool — keeps
          // memory small and formatArticle doesn't need it.
          // eslint-disable-next-line no-unused-vars
          const { embedding_minilm_vec, ...rest } = row
          laneCRows.push(rest)
        }
      }
    }

    // ── Step 2c: hydrate lane D ids to full rows ──────────────────
    let laneDRows = []
    const laneDIds = (dRes.data || []).map(r => r.id).filter(id => id !== sourceId)
    if (laneDIds.length > 0) {
      const { data: hydrated, error: hErr } = await supabase
        .from('published_articles')
        .select(FEED_ARTICLE_COLUMNS)
        .in('id', laneDIds)
      if (hErr) {
        console.error('[feed:topic] lane D hydrate failed:', hErr.message)
      } else {
        laneDRows = hydrated || []
      }
    }

    // ── Step 3: merge + dedupe by id, exclude source_id ───────────
    const seen = new Set()
    if (sourceId) seen.add(sourceId)
    const merged = []
    for (const row of [
      ...(aRes.data || []),
      ...(bRes.data || []),
      ...laneCRows,
      ...laneDRows,
    ]) {
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      merged.push(row)
    }

    // ── Step 4: blended quality+recency score ─────────────────────
    // qualityNorm = log10(score)/3 → maps 1..1000 onto [0,1]
    // recency    = 2^(-hoursOld/halfLife) → 1.0 at fresh, 0.5 at halfLife
    // final      = 0.55 * qualityNorm + 0.45 * recency
    const now = Date.now()
    const HALF_LIFE_LN2 = Math.LN2 / RECENCY_HALF_LIFE_HOURS
    const scored = merged.map(row => {
      const rawScore = row.ai_final_score || 0
      const qualityNorm = Math.log10(Math.max(rawScore, 1)) / QUALITY_NORM_DIVISOR
      const tMs = row.created_at ? Date.parse(row.created_at) : now
      const hoursOld = Math.max(0, (now - tMs) / (3600 * 1000))
      const recency = Math.exp(-HALF_LIFE_LN2 * hoursOld)
      const blended = QUALITY_WEIGHT * qualityNorm + RECENCY_WEIGHT * recency
      return { row, blended }
    })
    scored.sort((a, b) => b.blended - a.blended)

    // ── Step 5: cluster_id dedup (one per news cluster) ───────────
    const clusterSeen = new Set()
    const deduped = []
    for (const item of scored) {
      const cid = item.row.cluster_id
      if (cid != null) {
        if (clusterSeen.has(cid)) continue
        clusterSeen.add(cid)
      }
      deduped.push(item.row)
    }

    // ── Step 6: per-publisher cap in top K ────────────────────────
    const counts = new Map()
    const top = []
    const overflow = []
    for (const row of deduped) {
      const pub = row.author_id || row.source || 'unknown'
      const cur = counts.get(pub) || 0
      if (top.length < PUBLISHER_CAP_TOP_K && cur >= PUBLISHER_CAP_IN_TOP_K) {
        overflow.push(row)
      } else {
        top.push(row)
        counts.set(pub, cur + 1)
      }
    }
    const ranked = [...top, ...overflow]

    // ── Step 7: paginate ──────────────────────────────────────────
    const page = ranked.slice(offset, offset + limit)
    const formatted = page.map(a => formatArticle(a, {}))

    console.log(
      `[feed:topic] entity="${entityLower}" src=${sourceId || 'none'} withEmb=${withEmb} ` +
      `tag=${(aRes.data || []).length} title=${(bRes.data || []).length} ` +
      `bullet=${(cRes.data || []).length}→${laneCRows.length} ` +
      `knn=${(dRes.data || []).length}→${laneDRows.length} ` +
      `merged=${merged.length} clusterDeduped=${deduped.length} ranked=${ranked.length} ` +
      `returned=${formatted.length} offset=${offset} ms=${Date.now() - t0}`
    )

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60')
    return res.status(200).json({
      entity: rawEntity,
      offset,
      limit,
      count: formatted.length,
      articles: formatted,
    })
  } catch (err) {
    console.error('[feed:topic] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

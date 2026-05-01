import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { readFractionPenaltyScale, readFractionEngageScale } from '../../../lib/readingTime'

// Hard cap on per-user interest clusters. cluster_user_interests RPC respects
// this via LEAST(p_max_clusters, ...); the incremental write path below must
// force-merge when at cap instead of silently creating an 8th, 9th, ... cluster.
const MAX_CLUSTERS = 7

// Fix M (2026-04-19): TikTok-style single-event dwell signal.
// The app is a vertical-swipe feed — one action (swipe-away), one measurement
// (dwell). The iOS client labels events as article_skipped/view/engaged by
// dwell tier, but the server ignores those labels for signal direction and
// uses raw dwell instead. Source: TikTok passive-skip model (arxiv 2308.04086),
// Tencent dwell-time reweighting (arxiv 2209.09000).
//
// Calibration for this app's short-card format:
//   offset=5s  — user-stated engagement threshold
//   tau=2      — tight transition, saturates near 10s (cards are bullets+image)
//   max_dwell=30s — cap backgrounded-app outliers
//
//   1s  → -0.76 (strong negative, instant swipe)
//   3s  → -0.46 (quick-skip)
//   5s  →  0.00 (neutral boundary)
//   7s  → +0.46
//   10s → +0.85 (clearly engaged)
//   15s → +1.00 (saturated)
function dwellSignal(dwellSec) {
  if (dwellSec == null || dwellSec < 0) return { direction: 'neutral', weight: 0 }
  const clamped = Math.min(dwellSec, 30)
  const offset = 5
  const tau = 2
  const genuineness = 1 / (1 + Math.exp(-(clamped - offset) / tau))
  const signed = (genuineness - 0.5) * 2  // [-1, +1]
  if (signed < 0) return { direction: 'negative', weight: Math.abs(signed) }
  if (signed > 0) return { direction: 'positive', weight: signed }
  return { direction: 'neutral', weight: 0 }
}

// Fix M: signal-write wrapper. Ignores client-side event_type classification
// (article_skipped / article_view / article_engaged are all dwell tiers of the
// same underlying swipe event). Direction is determined from dwell alone.
// Explicit actions stack on top with elevated weights.
function signalFromCard(eventType, dwellSec) {
  // Explicit action events override dwell-based direction (always positive).
  if (eventType === 'article_liked')   return { direction: 'positive', weight: 2.0 }
  if (eventType === 'article_saved')   return { direction: 'positive', weight: 3.0 }
  if (eventType === 'article_shared')  return { direction: 'positive', weight: 3.0 }
  if (eventType === 'article_revisit') return { direction: 'positive', weight: 2.5 }

  // article_skipped / article_view / article_engaged / article_detail_view:
  // all are dwell-classified labels for the same "card impression" event.
  // Use raw dwell to decide direction + magnitude.
  return dwellSignal(dwellSec)
}

// ============================================================
// K-MEANS CLUSTERING (JavaScript implementation for V23)
// ============================================================

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

function weightedAverage(embeddings, weights) {
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  let totalW = 0;
  for (let j = 0; j < embeddings.length; j++) {
    const w = weights[j];
    totalW += w;
    for (let i = 0; i < dim; i++) avg[i] += embeddings[j][i] * w;
  }
  if (totalW <= 0) return avg;
  for (let i = 0; i < dim; i++) avg[i] /= totalW;
  return avg;
}

function silhouetteScore(embeddings, labels, centroids) {
  if (embeddings.length < 3) return -1;
  const k = centroids.length;
  let totalScore = 0;
  let count = 0;
  for (let i = 0; i < embeddings.length; i++) {
    const myCluster = labels[i];
    // a(i) = avg distance to same cluster
    let aSum = 0, aCount = 0;
    for (let j = 0; j < embeddings.length; j++) {
      if (j === i || labels[j] !== myCluster) continue;
      aSum += 1 - cosineSim(embeddings[i], embeddings[j]);
      aCount++;
    }
    if (aCount === 0) continue;
    const a = aSum / aCount;
    // b(i) = min avg distance to other clusters
    let minB = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue;
      let bSum = 0, bCount = 0;
      for (let j = 0; j < embeddings.length; j++) {
        if (labels[j] !== c) continue;
        bSum += 1 - cosineSim(embeddings[i], embeddings[j]);
        bCount++;
      }
      if (bCount > 0) minB = Math.min(minB, bSum / bCount);
    }
    if (minB === Infinity) continue;
    const s = (minB - a) / Math.max(a, minB);
    totalScore += s;
    count++;
  }
  return count > 0 ? totalScore / count : -1;
}

function runKMeans(embeddings, weights, k, maxIter = 20) {
  const n = embeddings.length;
  const dim = embeddings[0].length;
  if (n < k) return null;

  // Initialize centroids with K-Means++ (weighted)
  const centroids = [];
  const totalW = weights.reduce((a, b) => a + b, 0);
  // First centroid: weighted random
  let cumW = 0;
  const r = Math.random() * totalW;
  for (let i = 0; i < n; i++) {
    cumW += weights[i];
    if (cumW >= r) { centroids.push([...embeddings[i]]); break; }
  }
  // Remaining centroids: pick proportional to distance from nearest existing centroid
  for (let c = 1; c < k; c++) {
    const dists = embeddings.map(emb => {
      let minD = Infinity;
      for (const cent of centroids) {
        minD = Math.min(minD, 1 - cosineSim(emb, cent));
      }
      return minD * minD;
    });
    const totalD = dists.reduce((a, b) => a + b, 0);
    let cumD = 0;
    const r2 = Math.random() * totalD;
    for (let i = 0; i < n; i++) {
      cumD += dists[i];
      if (cumD >= r2) { centroids.push([...embeddings[i]]); break; }
    }
  }

  // Iterate
  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // Assign to nearest centroid
    const newLabels = embeddings.map(emb => {
      let bestC = 0, bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const sim = cosineSim(emb, centroids[c]);
        if (sim > bestSim) { bestSim = sim; bestC = c; }
      }
      return bestC;
    });

    // Check convergence
    const changed = newLabels.some((l, i) => l !== labels[i]);
    labels = newLabels;
    if (!changed) break;

    // Update centroids (weighted average)
    for (let c = 0; c < k; c++) {
      const clusterEmbs = [];
      const clusterWeights = [];
      for (let i = 0; i < n; i++) {
        if (labels[i] === c) { clusterEmbs.push(embeddings[i]); clusterWeights.push(weights[i]); }
      }
      if (clusterEmbs.length > 0) {
        centroids[c] = weightedAverage(clusterEmbs, clusterWeights);
      }
    }
  }

  return { centroids, labels };
}

function findOptimalClusters(embeddings, weights, minK = 2, maxK = 8) {
  let bestK = 2, bestScore = -Infinity, bestResult = null;
  for (let k = minK; k <= Math.min(maxK, Math.floor(embeddings.length / 3)); k++) {
    const result = runKMeans(embeddings, weights, k);
    if (!result) continue;
    // Check min 3 articles per cluster
    const counts = {};
    for (const l of result.labels) counts[l] = (counts[l] || 0) + 1;
    if (Object.values(counts).some(c => c < 3)) continue;

    const score = silhouetteScore(embeddings, result.labels, result.centroids);
    if (score > bestScore) { bestScore = score; bestK = k; bestResult = result; }
  }
  return bestResult || runKMeans(embeddings, weights, 2);
}

async function runClusteringForUser(admin, persId, phase) {
  // Fetch all positive engagements from buffer
  const { data: buffer } = await admin
    .from('engagement_buffer')
    .select('embedding_minilm, interaction_weight, created_at')
    .eq('personalization_id', persId)
    .gt('interaction_weight', 0)
    .order('created_at', { ascending: false });

  if (!buffer || buffer.length < 6) return;

  const embeddings = [];
  const weights = [];
  const now = Date.now();
  const DECAY_LAMBDA = 0.0231; // 30-day half-life for initial clustering

  for (const row of buffer) {
    const emb = row.embedding_minilm;
    if (!emb || !Array.isArray(emb) || emb.length !== 384) continue;
    const daysOld = (now - new Date(row.created_at).getTime()) / 86400000;
    const decayedWeight = row.interaction_weight * Math.exp(-DECAY_LAMBDA * daysOld);
    if (decayedWeight < 0.01) continue;
    embeddings.push(emb);
    weights.push(decayedWeight);
  }

  if (embeddings.length < 6) return;

  // Run K-Means
  const result = phase === 2
    ? runKMeans(embeddings, weights, Math.min(3, Math.floor(embeddings.length / 3)))
    : findOptimalClusters(embeddings, weights);

  if (!result) return;

  // Compute cluster metadata
  const clusterData = [];
  const k = result.centroids.length;
  let totalWeight = 0;
  for (let c = 0; c < k; c++) {
    let clusterWeight = 0;
    let count = 0;
    let maxDate = 0;
    for (let i = 0; i < embeddings.length; i++) {
      if (result.labels[i] === c) {
        clusterWeight += weights[i];
        count++;
        const d = new Date(buffer[i]?.created_at).getTime();
        if (d > maxDate) maxDate = d;
      }
    }
    totalWeight += clusterWeight;
    clusterData.push({ centroid: result.centroids[c], weight: clusterWeight, count, lastEngaged: new Date(maxDate).toISOString() });
  }

  // Delete old clusters
  await admin.from('user_interest_clusters').delete().eq('personalization_id', persId);

  // Insert new clusters
  for (let c = 0; c < clusterData.length; c++) {
    const d = clusterData[c];
    const importance = totalWeight > 0 ? d.weight / totalWeight : 1 / k;
    await admin.from('user_interest_clusters').insert({
      user_id: persId, // reuse user_id column for personalization_id
      cluster_index: c,
      medoid_embedding: d.centroid,
      medoid_minilm: d.centroid,
      article_count: d.count,
      importance_score: importance,
      is_centroid: true,
      personalization_id: persId,
      last_engaged_at: d.lastEngaged,
    });
  }

  console.log(`[analytics] Clustered ${embeddings.length} articles into ${k} clusters for ${persId.substring(0, 8)}`);
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createAuthedClient({ req, res })
    const admin = getAdminSupabase()
    if (!admin) {
      console.log('[analytics] No admin client - missing SUPABASE_SERVICE_KEY')
      return res.status(500).json({ error: 'Server analytics storage not configured (missing SUPABASE_SERVICE_KEY)' })
    }

    // Auth: prefer cookie-based session, but also allow Authorization: Bearer <access_token>
    let user = null
    let authMethod = null
    try {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) {
        user = data.user
        authMethod = 'cookie'
      }
    } catch (_) {}

    if (!user) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization
      const token = (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer '))
        ? authHeader.slice(7).trim()
        : null

      console.log('[analytics] Trying bearer auth, token present:', !!token)
      
      if (token) {
        try {
          const { data, error } = await admin.auth.getUser(token)
          if (!error && data?.user) {
            user = data.user
            authMethod = 'bearer'
          } else if (error) {
            console.log('[analytics] Bearer auth error:', error.message)
          }
        } catch (e) {
          console.log('[analytics] Bearer auth exception:', e.message)
        }
      }
    }

    // Accept guest_device_id from request body for unauthenticated users
    const { guest_device_id: bodyDeviceId } = req.body || {}

    if (!user && !bodyDeviceId) {
      console.log('[analytics] No user and no guest_device_id')
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const effectiveUserId = user?.id || null
    const effectiveDeviceId = bodyDeviceId || null

    console.log('[analytics] Auth:', effectiveUserId ? `user ${effectiveUserId.substring(0, 8)}` : `guest ${effectiveDeviceId?.substring(0, 8)}`)

    const {
      event_type,
      session_id = null,
      article_id = null,
      cluster_id = null,
      category = null,
      source = null,
      referrer = null,
      page = null,
      metadata = {}
    } = req.body || {}

    if (!event_type || typeof event_type !== 'string') {
      return res.status(400).json({ error: 'event_type is required' })
    }

    // ==========================================================
    // Phase 3.2: explicit "Not Interested" long-press handler.
    // Per plan, combines three signals:
    //   1. Insert 14-day suppression of the article's (super, leaf)
    //   2. bulk_update_entity_signals with typed_signals at weight -2.0
    //      (amplified vs the -1.0 implicit-skip weight so this reaches
    //      the "10-50 implicit skips" calibration from YouTube 2021)
    //   3. update_super_arm + update_leaf_arm with negative weight 3.0
    //      (triple the normal skip reward, per plan)
    // Returns early — does not go through the generic event pipeline below.
    // ==========================================================
    if (event_type === 'article_not_interested') {
      if (!article_id) return res.status(400).json({ error: 'article_id required' })
      if (!effectiveUserId) return res.status(400).json({ error: 'auth required' })

      try {
        const { data: artRow } = await admin
          .from('published_articles')
          .select('id, super_cluster_id, leaf_cluster_id, typed_signals')
          .eq('id', article_id)
          .maybeSingle()

        const hasLeaf = artRow?.super_cluster_id != null && artRow?.leaf_cluster_id != null
        const suppressedUntil = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()

        // 1. Suppression row.
        if (hasLeaf) {
          await admin.from('user_leaf_suppress').upsert({
            user_id: effectiveUserId,
            super_cluster_id: artRow.super_cluster_id,
            leaf_cluster_id: artRow.leaf_cluster_id,
            source_article_id: article_id,
            suppressed_until: suppressedUntil,
          }, { onConflict: 'user_id,super_cluster_id,leaf_cluster_id' })
        }

        // 2. Entity-signal penalty — use weight 2.0 (the bulk RPC handles sign
        // via is_positive). Only if the article has typed_signals.
        const sigs = Array.isArray(artRow?.typed_signals) ? artRow.typed_signals : []
        if (sigs.length > 0) {
          await admin.rpc('bulk_update_entity_signals', {
            p_user_id: effectiveUserId,
            p_entities: sigs,
            p_is_positive: false,
            p_weight: 2.0,
          }).catch((e) => console.log('[not_interested] entity signals err:', e?.message || e))
        }

        // 3. Bandit arm penalty — triple-strength negative.
        if (hasLeaf) {
          await admin.rpc('update_leaf_arm', {
            p_user_id: effectiveUserId,
            p_super: artRow.super_cluster_id,
            p_leaf: artRow.leaf_cluster_id,
            p_is_positive: false,
            p_weight: 3.0,
          }).catch((e) => console.log('[not_interested] leaf arm err:', e?.message || e))
          await admin.rpc('update_super_arm', {
            p_user_id: effectiveUserId,
            p_super: artRow.super_cluster_id,
            p_is_positive: false,
            p_weight: 3.0,
          }).catch((e) => console.log('[not_interested] super arm err:', e?.message || e))
        }

        // Still record the event for analytics/replay consistency.
        await admin.from('user_article_events').insert({
          user_id: effectiveUserId,
          article_id,
          event_type: 'article_not_interested',
          metadata: {
            super_cluster_id: artRow?.super_cluster_id,
            leaf_cluster_id: artRow?.leaf_cluster_id,
            suppressed_until: hasLeaf ? suppressedUntil : null,
          },
        })

        return res.status(200).json({
          success: true,
          suppressed_leaf: hasLeaf ? `${artRow.super_cluster_id}:${artRow.leaf_cluster_id}` : null,
          suppressed_until: hasLeaf ? suppressedUntil : null,
        })
      } catch (e) {
        console.error('[not_interested] handler error:', e?.message || e)
        return res.status(500).json({ error: 'internal error' })
      }
    }

    // ==========================================================
    // Phase 3.2b: positive mirror of Not Interested — "Show more like this".
    // Same three-action shape, sign flipped:
    //   1. No suppression insert (no data structure for positive "pin")
    //   2. bulk_update_entity_signals with typed_signals at +2.0 weight
    //   3. update_super_arm + update_leaf_arm with positive weight 3.0
    // ==========================================================
    if (event_type === 'article_more_like_this') {
      if (!article_id) return res.status(400).json({ error: 'article_id required' })
      if (!effectiveUserId) return res.status(400).json({ error: 'auth required' })

      try {
        const { data: artRow } = await admin
          .from('published_articles')
          .select('id, super_cluster_id, leaf_cluster_id, typed_signals')
          .eq('id', article_id)
          .maybeSingle()

        const hasLeaf = artRow?.super_cluster_id != null && artRow?.leaf_cluster_id != null
        const sigs = Array.isArray(artRow?.typed_signals) ? artRow.typed_signals : []

        if (sigs.length > 0) {
          await admin.rpc('bulk_update_entity_signals', {
            p_user_id: effectiveUserId,
            p_entities: sigs,
            p_is_positive: true,
            p_weight: 2.0,
          }).catch((e) => console.log('[more_like_this] entity signals err:', e?.message || e))
        }

        if (hasLeaf) {
          await admin.rpc('update_leaf_arm', {
            p_user_id: effectiveUserId,
            p_super: artRow.super_cluster_id,
            p_leaf: artRow.leaf_cluster_id,
            p_is_positive: true,
            p_weight: 3.0,
          }).catch((e) => console.log('[more_like_this] leaf arm err:', e?.message || e))
          await admin.rpc('update_super_arm', {
            p_user_id: effectiveUserId,
            p_super: artRow.super_cluster_id,
            p_is_positive: true,
            p_weight: 3.0,
          }).catch((e) => console.log('[more_like_this] super arm err:', e?.message || e))
        }

        await admin.from('user_article_events').insert({
          user_id: effectiveUserId,
          article_id,
          event_type: 'article_more_like_this',
          metadata: {
            super_cluster_id: artRow?.super_cluster_id,
            leaf_cluster_id: artRow?.leaf_cluster_id,
          },
        })

        return res.status(200).json({
          success: true,
          boosted_leaf: hasLeaf ? `${artRow.super_cluster_id}:${artRow.leaf_cluster_id}` : null,
        })
      } catch (e) {
        console.error('[more_like_this] handler error:', e?.message || e)
        return res.status(500).json({ error: 'internal error' })
      }
    }

    // Extract view_seconds from metadata for article_exit events
    let view_seconds = null
    if (event_type === 'article_exit' && metadata?.total_active_seconds) {
      view_seconds = parseInt(metadata.total_active_seconds, 10) || null
    } else if (event_type === 'article_engaged' && metadata?.engaged_seconds) {
      view_seconds = parseInt(metadata.engaged_seconds, 10) || null
    }

    // Phase 10.1 (2026-04-25): noise filter on dwell.
    //
    // The 2026-04-24 23:37 session showed three consecutive articles with
    // ~530 s dwell each — caused by iOS background-suspension while the
    // user had the app open. Wall-clock kept ticking. Real attention was
    // on the first article (60 s); the next two slots were idle window.
    //
    // Reference: D2Co (RecSys 2023, Zhao et al.) and CWT (KDD 2024). They
    // model watch_time as a mixture of true_interest + duration_bias +
    // noise_term, where noise comes from "leaving the device unattended,
    // accidental device malfunction, intentional re-play, or data stream
    // delays." The standard production fix is a hard cap at K × expected
    // duration (K ≈ 2-3) — anything beyond is noise, not signal.
    //
    // We do two things here:
    //   1. Cap raw view_seconds at 600 s (10 min). No news article needs
    //      more than 10 minutes of dwell; beyond that is always idle.
    //   2. Reject `article_skipped` events with dwell > 300 s entirely —
    //      you cannot meaningfully "skip" an article you stared at for
    //      5 minutes; that's an idle/background false event.
    if (view_seconds != null && view_seconds > 600) {
      console.log(`[analytics] Capping dwell ${view_seconds}s → 600s (idle/background noise filter, Phase 10.1)`)
      view_seconds = 600
    }
    if (event_type === 'article_skipped') {
      const claimedDwell = metadata?.total_active_seconds
        ? parseFloat(metadata.total_active_seconds)
        : (metadata?.dwell ? parseFloat(metadata.dwell) : 0)
      if (claimedDwell > 300) {
        console.log(`[analytics] Dropping article_skipped with ${claimedDwell}s dwell — almost certainly app-background, not a skip (Phase 10.1)`)
        return res.status(200).json({ ok: true, dropped: 'idle_skip_filter' })
      }
    }

    // For guests without auth, we still need a user_id for the events table.
    // Use the guest_device_id as a pseudo-UUID (or the auth user id).
    const eventUserId = effectiveUserId || effectiveDeviceId

    const row = {
      user_id: eventUserId,
      session_id,
      event_type,
      article_id,
      cluster_id,
      category,
      source,
      referrer,
      page,
      view_seconds,
      metadata: (metadata && typeof metadata === 'object') ? metadata : {}
    }

    console.log('[analytics] Inserting event:', event_type, 'article:', article_id)

    const { error: insertError } = await admin
      .from('user_article_events')
      .insert(row)

    if (insertError) {
      console.error('[analytics] Insert error:', insertError.message, insertError.code, insertError.details)
      return res.status(500).json({ error: 'Failed to store event', details: insertError.message })
    }

    console.log('[analytics] Event stored successfully:', event_type)

    // ============================================================
    // V3 ALGORITHM: Resolve personalization_id, then update
    // sliding window + entity affinity (replaces EMA)
    // ============================================================
    const TASTE_UPDATE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_skipped', 'article_liked', 'article_shared']
    if (TASTE_UPDATE_EVENTS.includes(event_type) && article_id) {
      // Resolve personalization_id (creates row if needed)
      const rpcParams = effectiveUserId
        ? { p_auth_id: effectiveUserId }
        : { p_device_id: effectiveDeviceId }

      admin.rpc('resolve_personalization_id', rpcParams).then(({ data: persData, error: persError }) => {
        if (persError || !persData || persData.length === 0) {
          console.log('[analytics] Failed to resolve personalization_id:', persError?.message)
          return
        }
        const persId = persData[0].personalization_id

        // For skips: only process if card was visible 1s+ (deliberate skip)
        if (event_type === 'article_skipped') {
          const viewSec = metadata?.dwell ? parseFloat(metadata.dwell) :
                          metadata?.total_active_seconds ? parseFloat(metadata.total_active_seconds) : 0
          if (viewSec < 1) {
            console.log('[analytics] Fast skip ignored (< 1s dwell)')
            return
          }
        }

        // ============================================================
        // BUCKET-WEIGHTED LEARNING
        // Articles from trending/discovery barely move the taste profile.
        // Only personal-bucket and explore/search get full weight.
        // ============================================================
        const bucket = (metadata?.bucket || 'personal').toLowerCase()
        const dwellSec = metadata?.dwell ? parseFloat(metadata.dwell) :
                         metadata?.total_active_seconds ? parseFloat(metadata.total_active_seconds) : 0

        // ── Change 4: Override bucket multiplier on strong engagement signals ──
        // Strong signals (save, like, revisit) override bucket suppression.
        // A user who saves a trending article is telling you they love it.
        const baseBucketMult = bucket === 'trending' ? 0.2
          : (bucket === 'discovery' || bucket === 'exploration' || bucket === 'cold-start') ? 0.1
          : 1.0 // personal, explore, search = full weight

        // Interaction weight for the signal — TikTok 2025 priority order:
        // shares > comments > likes (public commitment > private intent
        // > cheap social signal). Revisit ranks highest because the user
        // deliberately scrolled BACK — strongest implicit endorsement
        // there is. Save ranks below share because saving is private
        // and reversible, while sharing is public commitment.
        // Source: TikTok Algorithm 2025 published priority weights.
        const signalWeight = event_type === 'article_revisit' ? 4.0  // scroll-back, strongest
          : event_type === 'article_shared' ? 3.5  // public commitment
          : event_type === 'article_saved' ? 2.5   // private bookmark
          : event_type === 'article_liked' ? 1.0   // cheap social signal
          : event_type === 'article_engaged' ? 1.0
          : event_type === 'article_view' ? 0.3    // glance
          : 0.0
        const maxSignal = 4.0
        const effectiveMultiplier = baseBucketMult + (Math.max(signalWeight, 0) / maxSignal) * (1.0 - baseBucketMult)
        // personal save: 1.0, trending save: 0.8, trending glance: 0.26, discovery read: 0.33

        // ── Change 5: Glanced articles (3-6s dwell, article_view) update taste vector ──
        const isGlance = event_type === 'article_view' && dwellSec >= 3 && dwellSec < 6
        const isSkip = event_type === 'article_skipped'

        // Determine what goes into the engagement buffer
        let bufferEventType = event_type
        let bufferMultiplier = effectiveMultiplier

        if (isGlance) {
          // Glance: add to buffer with low weight (0.3)
          bufferEventType = 'article_glanced'
          bufferMultiplier = effectiveMultiplier * 0.3
        } else if (isSkip && dwellSec < 1) {
          // Instant skip: skip with normal weight
          bufferEventType = 'article_skipped'
        } else if (effectiveMultiplier < 0.15 && !['article_saved', 'article_shared', 'article_liked', 'article_revisit'].includes(event_type)) {
          // Weak signal from suppressed bucket: skip buffer
          bufferMultiplier = 0.0
          bufferEventType = 'article_glance' // legacy: just increment counter
        }

        // Update sliding window → writes to session_taste_vector_minilm (Change 1)
        admin.rpc('update_sliding_window', {
          p_pers_id: persId,
          p_article_id: article_id,
          p_event_type: bufferEventType,
          p_bucket_multiplier: bufferMultiplier,
        }).then(({ error: swError }) => {
          if (swError) console.log('[analytics] Sliding window update failed:', swError.message)
          else console.log('[analytics] Buffer:', persId.substring(0, 8), bucket, event_type, 'x' + effectiveMultiplier.toFixed(2))
        })

        // ============================================================
        // NEW: Update entity_signals (replaces dual tag_profile/skip_profile)
        // Tracks positive/negative counts with time windows per entity.
        // One unified signal instead of two saturating counters.
        //
        // Phase B (feed v11) — Kuaishou CIKM 2023 (arXiv:2308.13249):
        // weight skips by COMPLETION RATIO, not raw dwell.
        //
        // Original Phase B used raw seconds:
        //   < 3s → 0.5×, 3–20s → 1.0×, ≥20s → 1.8× ("loudest negative")
        //
        // That was wrong on two axes (audit 2026-04-27):
        //   1. 15s on a 1-bullet card = full re-read (good signal); 15s on
        //      a 3-bullet+component card = read-half-and-bailed. Same raw
        //      seconds, opposite intent. Need to normalise by article length.
        //   2. The "longer dwell + skip = louder negative" rule is the
        //      opposite of what Kuaishou's play-ratio model says. A user
        //      who finished the card and *then* swiped consumed it — that's
        //      near-neutral, not a loud "no". The loud "no" is the < 1s
        //      instant-swipe.
        //
        // New formula uses completion = dwell / expected_read_seconds:
        //   < 0.15  → 1.0× negative   (didn't even try — real rejection)
        //   0.15–0.40 → 0.7× negative (brief glance)
        //   0.40–0.75 → 0.4× negative (significant read but bailed)
        //   0.75–1.20 → 0.2× negative (basically finished, neutral-ish)
        //   ≥ 1.20  → 0.0×             (re-read past expected — neutral)
        //
        // expected_read_seconds is rarely populated in the DB (1 of 7617 as
        // of 2026-04-27), so we compute on the fly from bullet character
        // count + component presence: 250 wpm ≈ 20 chars/sec, +6s if the
        // article has a component card to scan, +3s for headline.
        // ============================================================
        const ENTITY_SIGNAL_POSITIVE = ['article_engaged', 'article_liked', 'article_saved', 'article_shared', 'article_revisit']
        const ENTITY_SIGNAL_NEGATIVE = ['article_skipped']
        const isSignalPositive = ENTITY_SIGNAL_POSITIVE.includes(event_type)
        const isSignalNegative = ENTITY_SIGNAL_NEGATIVE.includes(event_type)

        function expectedReadSecondsFromArticle(art, observedMedian) {
          // Preferred: observed median dwell across other readers (Kuaishou
          // CIKM 2023 production approach). When ≥5 users have read this
          // exact article, their p50 dwell is the strongest available
          // anchor for "what consumed-it looks like." Fed by the
          // article_dwell_stats table refreshed nightly.
          if (Number.isFinite(observedMedian) && observedMedian >= 3) {
            return observedMedian
          }
          if (!art) return 25
          // Cold-start fallback — pipeline-stored estimate, then text length.
          const stored = Number(art.expected_read_seconds)
          if (Number.isFinite(stored) && stored > 0) return stored
          const bullets = Array.isArray(art.summary_bullets_news)
            ? art.summary_bullets_news
            : (typeof art.summary_bullets_news === 'string'
                ? JSON.parse(art.summary_bullets_news || '[]')
                : [])
          const totalChars = bullets.reduce((sum, b) =>
            sum + (typeof b === 'string' ? b.length : 0), 0)
          const hasComponent = Array.isArray(art.components_order) && art.components_order.length > 0
          const seconds = 3 + (totalChars / 20) + (hasComponent ? 6 : 0)
          return Math.max(8, Math.min(60, Math.round(seconds)))
        }

        function computeSignalWeight(eventType, viewSec, expectedReadSec) {
          if (eventType !== 'article_skipped') return 1.0
          const dwell = Number.isFinite(viewSec) ? viewSec : 0
          const expected = Math.max(Number.isFinite(expectedReadSec) ? expectedReadSec : 25, 8)
          const completion = dwell / expected
          if (completion < 0.15) return 1.0  // real rejection
          if (completion < 0.40) return 0.7  // brief glance
          if (completion < 0.75) return 0.4  // significant read, still bailed
          if (completion < 1.20) return 0.2  // basically consumed it
          return 0.0                            // re-read past expected — neutral
        }

        if ((isSignalPositive || isSignalNegative) && article_id && effectiveUserId) {
          // Three parallel queries — article metadata + observed dwell
          // percentile + the impression's slot_index for IPS correction.
          // Same wall-clock latency as one query.
          //
          // Position-bias correction (Wang et al. 2018, "Position Bias
          // Estimation for Unbiased Learning to Rank in Personal Search"):
          // engagement on slot 0 carries more cumulative bias than
          // engagement on slot 20 — users see top-of-feed items
          // disproportionately. Weight every entity-signal write by
          // (1 + slot)^η with η = 0.70 (industry standard, same value
          // Phase 8.1 uses on ranker training labels).
          //   slot  0 → weight  1.0×  (saw it because we ranked it #1)
          //   slot  5 → weight  3.6×
          //   slot 10 → weight  5.4×
          //   slot 20 → weight  8.4×  (rare slot, stronger signal)
          //
          // Without this, the model thinks "everything I served first was
          // good" and top-bias compounds over time.
          Promise.all([
            admin.from('published_articles')
              .select('interest_tags, summary_bullets_news, components_order, expected_read_seconds')
              .eq('id', article_id).single(),
            admin.from('article_dwell_stats')
              .select('median_dwell_sec, observation_count')
              .eq('article_id', article_id).maybeSingle(),
            admin.from('user_feed_impressions')
              .select('slot_index')
              .eq('user_id', effectiveUserId)
              .eq('article_id', article_id)
              .order('created_at', { ascending: false })
              .limit(1).maybeSingle(),
          ]).then(([{ data: artData }, { data: dwellStats }, { data: imprData }]) => {
            if (!artData) return
            const tags = Array.isArray(artData.interest_tags) ? artData.interest_tags
              : (typeof artData.interest_tags === 'string' ? JSON.parse(artData.interest_tags || '[]') : [])
            const observedMedian = dwellStats?.median_dwell_sec
            const expectedRead = expectedReadSecondsFromArticle(artData, observedMedian)
            const baseWeight = computeSignalWeight(event_type, dwellSec, expectedRead)

            // Position-bias IPS multiplier. slot defaults to 0 if no
            // impression row found (shouldn't happen for engagement
            // events — every event implies a prior impression — but
            // be safe).
            const slot = Number.isFinite(imprData?.slot_index) ? imprData.slot_index : 0
            const ipsMultiplier = Math.pow(1 + Math.max(slot, 0), 0.70)
            const signalWeightForRpc = baseWeight * ipsMultiplier

            // (cleanup) Removed legacy per-tag `update_entity_signal` RPC loop.
            // Same signal already written via `bulk_update_entity_signals` calls
            // earlier in this handler; the RPC `update_entity_signal` is no
            // longer read by main.js.
            void signalWeightForRpc;
          }).catch(() => {})

          // Phase D (feed v11) — per-(user, article) exposure tracking.
          // Drives the exposureMultiplier in pages/api/feed/main.js so the
          // same article doesn't keep coming back after the user already
          // engaged-then-ignored, or skipped, this exact piece. Source:
          // Douyin disclosure 2025 (per-content exposure decay).
          admin.rpc('upsert_article_exposure', {
            p_user_id: effectiveUserId,
            p_article_id: article_id,
            p_is_engaged: isSignalPositive,
            p_is_skipped: isSignalNegative,
            p_event_at: new Date().toISOString(),
          }).catch(err => {
            if (!err?.message?.includes('relation') && !err?.message?.includes('does not exist')) {
              console.log('[analytics] article_exposure upsert failed:', err?.message)
            }
          })
        }

        // (cleanup) Removed three dead-write blocks:
        //   - UCB tracking against `subtopic_entity_clusters` (table is empty
        //     in prod — bestCat never matched, the entire block was a no-op).
        //   - `user_cluster_stats` upsert + `increment_cluster_stats` RPC
        //     (RPC doesn't exist; main.js never reads the table).
        //   - `update_bucket_stats` and `update_subtopic_stats` RPC calls
        //     (their target columns/tables are not read by main.js).
      })

      // REMOVED: Legacy EMA update was overwriting the cluster-computed taste vector
      // with a naive average of ALL articles (engaged AND skipped), making the vector
      // anti-discriminative (delta -0.079 — MORE similar to skipped articles).
      // taste_vector_minilm is now ONLY set by the clustering service.
    }

    // ============================================================
    // TYPED ENTITY SIGNALS — unified behavioral signal store
    // Replaces tag_profile (positive) and skip_profile (negative).
    // Reads typed_signals from the article, writes to user_entity_signals.
    // ============================================================

    // Fix M (2026-04-19): card-impression events (skipped/view/engaged) are
    // all client-side labels for one underlying swipe action. Ignore the
    // event_type for direction; use raw dwell to decide positive/negative.
    // Explicit actions (liked/saved/shared) override dwell-direction.
    // article_exit is dropped entirely — recordSwipeAway already covers the
    // feed signal and article_exit from the detail-view path would double-write.
    const SIGNAL_EVENTS = new Set([
      'article_skipped', 'article_view', 'article_engaged', 'article_detail_view',
      'article_liked', 'article_saved', 'article_shared', 'article_revisit',
    ])

    if (effectiveUserId && article_id && SIGNAL_EVENTS.has(event_type)) {
      const _dwellSec = metadata?.dwell ? parseFloat(metadata.dwell)
        : metadata?.total_active_seconds ? parseFloat(metadata.total_active_seconds)
        : metadata?.engaged_seconds ? parseFloat(metadata.engaged_seconds)
        : null
      const _sig = signalFromCard(event_type, _dwellSec)

      // dwellSignal returns 'neutral' for missing dwell or dead-center 5s.
      // Neutral means no write — we don't nudge entity signals on ambiguous events.
      if (_sig && _sig.direction !== 'neutral' && _sig.weight > 0.02) {
        const isPositive = _sig.direction === 'positive'

        admin
          .from('published_articles')
          .select('typed_signals, expected_read_seconds')
          .eq('id', article_id)
          .single()
          .then(({ data: articleData }) => {
            if (!articleData) return
            const typed = typeof articleData.typed_signals === 'string'
              ? JSON.parse(articleData.typed_signals || '[]')
              : (articleData.typed_signals || [])
            if (!Array.isArray(typed) || typed.length === 0) return

            const validSignals = typed.filter(s => {
              if (typeof s !== 'string') return false
              const parts = s.split(':')
              if (parts.length !== 2) return false
              return parts[1].length > 0 && parts[1].length <= 64
            })
            if (validSignals.length === 0) return

            // Layer read-fraction on top of Fix M's dwellSignal. Fix M sets
            // direction + raw-dwell weight calibrated for an "average" card.
            // For variable-length articles a 3 s skip on a 3-sentence card is
            // not the same negative as a 3 s skip on a 400-word longform.
            // Multiply weight by the read-fraction scale so the magnitude
            // reflects how much of the article was actually consumed.
            const expected = (articleData.expected_read_seconds && Number.isFinite(articleData.expected_read_seconds))
              ? articleData.expected_read_seconds : 30
            const fractionScale = isPositive
              ? readFractionEngageScale(_dwellSec || 0, expected)
              : readFractionPenaltyScale(_dwellSec || 0, expected)
            const finalWeight = _sig.weight * fractionScale
            if (!(finalWeight > 0.02)) return  // dropped by length-aware dampening

            admin.rpc('bulk_update_entity_signals', {
              p_user_id: effectiveUserId,
              p_signals: validSignals,
              p_is_positive: isPositive,
              p_weight: finalWeight,
            }).then(({ error: sigError }) => {
              if (sigError) console.log('[analytics] entity signal update failed:', sigError.message)
            })
          })
          .catch(() => {})
      }
    }

    // Legacy event_type sets retained for older code paths below (cluster/bandit block).
    const POSITIVE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_liked', 'article_shared']
    const NEGATIVE_EVENTS = ['article_skipped']

    // Explore page signals → typed entity signals
    const EXPLORE_EVENTS = ['explore_topic_tap', 'explore_topic_dwell', 'explore_article_tap']
    if (effectiveUserId && EXPLORE_EVENTS.includes(event_type)) {
      const entityName = (metadata?.entity_name || '').trim()
      if (entityName) {
        // Treat explore interactions as positive signals
        // For article_tap, also read the article's typed_signals
        if (event_type === 'explore_article_tap' && article_id) {
          admin
            .from('published_articles')
            .select('typed_signals')
            .eq('id', article_id)
            .single()
            .then(({ data: articleData }) => {
              const typed = typeof articleData?.typed_signals === 'string'
                ? JSON.parse(articleData.typed_signals || '[]')
                : (articleData?.typed_signals || [])
              const validSignals = (typed || []).filter(s => typeof s === 'string' && s.includes(':'))
              if (validSignals.length > 0) {
                admin.rpc('bulk_update_entity_signals', {
                  p_user_id: effectiveUserId,
                  p_signals: validSignals,
                  p_is_positive: true,
                }).then(() => {}).catch(() => {})
              }
            })
            .catch(() => {})
        }
      }
    }

    // Search query signals: treat search terms as positive topic signals
    if (effectiveUserId && event_type === 'search_query' && metadata?.query) {
      const query = metadata.query.toLowerCase().trim()
      if (query.length >= 2) {
        const slug = query.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        if (slug.length > 0 && slug.length <= 64) {
          admin.rpc('bulk_update_entity_signals', {
            p_user_id: effectiveUserId,
            p_signals: [`topic:${slug}`],
            p_is_positive: true,
          }).then(() => {}).catch(() => {})
        }
      }
    }

    // Awaited block: atomic cluster maintenance (positive direction) + bandit
    // posterior update (either direction). Runs synchronously before the
    // response so Vercel doesn't kill mid-chain.
    // Fix M: use dwell-based direction (not event_type). Skip on neutral.
    if (effectiveUserId && article_id && SIGNAL_EVENTS.has(event_type)) {
      const _banditDwellSec = metadata?.dwell ? parseFloat(metadata.dwell)
        : metadata?.total_active_seconds ? parseFloat(metadata.total_active_seconds)
        : metadata?.engaged_seconds ? parseFloat(metadata.engaged_seconds)
        : null
      const _banditSig = signalFromCard(event_type, _banditDwellSec)
      if (!_banditSig || _banditSig.direction === 'neutral' || _banditSig.weight <= 0.02) {
        return res.status(200).json({ ok: true })
      }
      const isPositive = _banditSig.direction === 'positive'
      try {
        const { data: artRow } = await admin
          .from('published_articles')
          .select('embedding_minilm, cluster_assignments, expected_read_seconds')
          .eq('id', article_id)
          .single()

        // Phase 2 (Migration 046) + Migration 047: dual-credit bandit update.
        // Each engagement credits both the LEAF arm (fine-grained) and the
        // SUPER arm (coarse). Super-level learning accelerates cold-start on
        // new leaves and enables hierarchical Thompson sampling in retrieval.
        // Matches TikTok Deep Retrieval D-layer hierarchy.
        if (artRow?.cluster_assignments && Array.isArray(artRow.cluster_assignments) && artRow.cluster_assignments.length > 0) {
          const explicitWeightForLeaf = event_type === 'article_saved' ? 3.0
            : event_type === 'article_shared' ? 2.0
            : event_type === 'article_liked' ? 1.5
            : event_type === 'article_revisit' ? 4.0
            : null
          // Bandit posterior also gets length-aware reward shaping. A 90 s
          // dwell on a 10 s card and a 90 s dwell on a 200 s longform are very
          // different signals; Fix M's _banditSig.weight is dwell-only and
          // can't tell them apart. Skip the scaling for explicit actions
          // (save/share/like/revisit) — those carry their own intent.
          const _expectedRead = (artRow.expected_read_seconds && Number.isFinite(artRow.expected_read_seconds))
            ? artRow.expected_read_seconds : 30
          const _fracScale = isPositive
            ? readFractionEngageScale(_banditDwellSec || 0, _expectedRead)
            : readFractionPenaltyScale(_banditDwellSec || 0, _expectedRead)
          const leafBandit = explicitWeightForLeaf != null
            ? explicitWeightForLeaf
            : _banditSig.weight * _fracScale

          // Credit each leaf in cluster_assignments
          const superCredits = new Map()  // super_idx → summed credit
          for (const ca of artRow.cluster_assignments) {
            const credit = leafBandit * (Number(ca.weight) || 0)
            if (credit < 0.02) continue
            const superIdx = Number(ca.super)
            const leafIdx = Number(ca.leaf)
            if (!Number.isInteger(superIdx) || !Number.isInteger(leafIdx)) continue
            try {
              await admin.rpc('update_leaf_arm', {
                p_user_id: effectiveUserId,
                p_super: superIdx,
                p_leaf: leafIdx,
                p_is_positive: isPositive,
                p_weight: credit,
              })
            } catch (e) {
              console.log('[leaf-bandit] rpc error:', e?.message || e)
            }
            // Accumulate super-level credit. Use 0.5x scaling so super arms
            // build posterior more slowly than leaves (super is aggregate).
            superCredits.set(superIdx, (superCredits.get(superIdx) || 0) + credit * 0.5)
          }
          // Flush super-level credits
          for (const [superIdx, credit] of superCredits.entries()) {
            if (credit < 0.02) continue
            try {
              await admin.rpc('update_super_arm', {
                p_user_id: effectiveUserId,
                p_super: superIdx,
                p_is_positive: isPositive,
                p_weight: credit,
              })
            } catch (e) {
              console.log('[super-bandit] rpc error:', e?.message || e)
            }
          }
        }

        if (artRow?.embedding_minilm && Array.isArray(artRow.embedding_minilm)) {
          const rpcParams2 = effectiveUserId
            ? { p_auth_id: effectiveUserId }
            : { p_device_id: effectiveDeviceId }
          const { data: persResolved } = await admin.rpc('resolve_personalization_id', rpcParams2)
          const bPersId = persResolved?.[0]?.personalization_id

          if (bPersId) {
            let bestIdx = -1

            if (isPositive) {
              // Atomic insert-or-merge under FOR UPDATE lock — returns the
              // assigned cluster_index. Hard-caps at MAX_CLUSTERS=7 by
              // force-merging into nearest when at cap.
              const { data: iomRows, error: iomErr } = await admin.rpc('insert_or_merge_cluster', {
                p_user_id: effectiveUserId,
                p_personalization_id: bPersId,
                p_article_id: article_id,
                p_embedding: artRow.embedding_minilm,
                p_max_clusters: 7,
              })
              if (iomErr) {
                console.log('[cluster] insert_or_merge_cluster error:', iomErr.message)
              } else if (iomRows && iomRows.length > 0) {
                bestIdx = iomRows[0].cluster_index
              }
            } else {
              // Skip event — don't touch clusters, just find the nearest for
              // the bandit β update.
              const { data: bClusters } = await admin
                .from('user_interest_clusters')
                .select('cluster_index, medoid_minilm')
                .or(`personalization_id.eq.${bPersId},user_id.eq.${effectiveUserId}`)
                .eq('is_archived', false)

              if (bClusters && bClusters.length > 0) {
                let bestSim = -1
                for (const c of bClusters) {
                  if (!c.medoid_minilm || !Array.isArray(c.medoid_minilm)) continue
                  const sim = cosineSim(artRow.embedding_minilm, c.medoid_minilm)
                  if (sim > bestSim) { bestSim = sim; bestIdx = c.cluster_index }
                }
              }
            }

            if (bestIdx >= 0) {
              // Fix M: bandit weight combines explicit-action elevation with
              // dwell magnitude. For implicit events (dwell-classified), use
              // the sigmoid weight directly. For explicit, use legacy weights.
              const explicitWeight = event_type === 'article_saved' ? 3.0
                : event_type === 'article_shared' ? 2.0
                : event_type === 'article_liked' ? 1.5
                : event_type === 'article_revisit' ? 4.0
                : null
              const banditWeight = explicitWeight != null ? explicitWeight : _banditSig.weight
              const { error: armErr } = await admin.rpc('update_bandit_arm', {
                p_user_id: effectiveUserId,
                p_arm_key: `cluster:${bestIdx}`,
                p_is_positive: isPositive,
                p_weight: banditWeight,
              })
              if (armErr) console.log('[bandit] rpc error:', armErr.message)
            }
          }
        }
      } catch (e) {
        console.log('[track] cluster/bandit update exception:', e.message)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


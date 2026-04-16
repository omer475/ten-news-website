import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

    // Extract view_seconds from metadata for article_exit events
    let view_seconds = null
    if (event_type === 'article_exit' && metadata?.total_active_seconds) {
      view_seconds = parseInt(metadata.total_active_seconds, 10) || null
    } else if (event_type === 'article_engaged' && metadata?.engaged_seconds) {
      view_seconds = parseInt(metadata.engaged_seconds, 10) || null
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

        // Interaction weight for the signal
        const signalWeight = event_type === 'article_saved' ? 3.0
          : event_type === 'article_shared' ? 2.0
          : event_type === 'article_liked' ? 1.5
          : event_type === 'article_revisit' ? 4.0
          : event_type === 'article_engaged' ? 1.0
          : event_type === 'article_view' ? 0.3 // glance
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

        // Update entity affinity for ALL engagements (not just personal bucket)
        // Strong signals from any bucket should update entity preferences
        if (effectiveMultiplier >= 0.2 && ['article_engaged', 'article_liked', 'article_saved', 'article_shared', 'article_revisit', 'article_skipped'].includes(event_type)) {
          admin.rpc('update_entity_affinity', {
            p_pers_id: persId,
            p_article_id: article_id,
            p_event_type: event_type,
          }).then(({ error: eaError }) => {
            if (eaError) console.log('[analytics] Entity affinity update failed:', eaError.message)
          })
        }

        // ============================================================
        // NEW: Update entity_signals (replaces dual tag_profile/skip_profile)
        // Tracks positive/negative counts with time windows per entity.
        // One unified signal instead of two saturating counters.
        // ============================================================
        const ENTITY_SIGNAL_POSITIVE = ['article_engaged', 'article_liked', 'article_saved', 'article_shared', 'article_revisit']
        const ENTITY_SIGNAL_NEGATIVE = ['article_skipped']
        const isSignalPositive = ENTITY_SIGNAL_POSITIVE.includes(event_type)
        const isSignalNegative = ENTITY_SIGNAL_NEGATIVE.includes(event_type)

        if ((isSignalPositive || isSignalNegative) && article_id && effectiveUserId) {
          admin.from('published_articles').select('interest_tags').eq('id', article_id).single()
            .then(({ data: artData }) => {
              if (!artData) return
              const tags = Array.isArray(artData.interest_tags) ? artData.interest_tags
                : (typeof artData.interest_tags === 'string' ? JSON.parse(artData.interest_tags || '[]') : [])
              // Update first 5 tags (position-weighted: top tags are primary signals)
              for (const tag of tags.slice(0, 5)) {
                admin.rpc('update_entity_signal', {
                  p_user_id: effectiveUserId,
                  p_entity: tag.toLowerCase(),
                  p_is_positive: isSignalPositive,
                  p_event_at: new Date().toISOString(),
                }).catch(err => {
                  // Table may not exist yet — non-blocking
                  if (!err?.message?.includes('relation') && !err?.message?.includes('does not exist')) {
                    console.log('[analytics] entity_signal update failed:', err?.message)
                  }
                })
              }
            }).catch(() => {})
        }

        // UCB TRACKING: lightweight — only match against user's own interest clusters
        if (bucket === 'personal' && article_id) {
          admin.from('published_articles').select('embedding_minilm, category').eq('id', article_id).single().then(({ data: artInfo }) => {
            if (!artInfo?.embedding_minilm || !Array.isArray(artInfo.embedding_minilm)) return

            // Find which precomputed cluster this article is closest to (limit to 20 for performance)
            admin.from('subtopic_entity_clusters').select('subtopic_category, cluster_index, centroid_embedding').limit(20).then(({ data: allClusters }) => {
              if (!allClusters) return

              let bestCat = null, bestIdx = null, bestSim = -1
              for (const c of allClusters) {
                const centroid = typeof c.centroid_embedding === 'string' ? JSON.parse(c.centroid_embedding) : c.centroid_embedding
                if (!Array.isArray(centroid)) continue
                const sim = cosineSim(artInfo.embedding_minilm, centroid)
                if (sim > bestSim) { bestSim = sim; bestCat = c.subtopic_category; bestIdx = c.cluster_index; }
              }

              if (bestCat && bestSim > 0.3) {
                const isEngaged = !['article_skipped', 'article_glance'].includes(event_type)
                admin.from('user_cluster_stats').upsert({
                  personalization_id: persId,
                  subtopic_category: bestCat,
                  cluster_index: bestIdx,
                  times_shown: 1,
                  times_engaged: isEngaged ? 1 : 0,
                  last_shown_at: new Date().toISOString(),
                }, { onConflict: 'personalization_id,subtopic_category,cluster_index' })
                .then(() => {
                  // Increment existing stats
                  admin.rpc('increment_cluster_stats', { p_pers_id: persId, p_cat: bestCat, p_idx: bestIdx, p_engaged: isEngaged })
                    .catch(() => {
                      // RPC doesn't exist yet, do manual update
                      admin.from('user_cluster_stats')
                        .select('times_shown, times_engaged')
                        .eq('personalization_id', persId)
                        .eq('subtopic_category', bestCat)
                        .eq('cluster_index', bestIdx)
                        .single()
                        .then(({ data: stat }) => {
                          if (stat) {
                            admin.from('user_cluster_stats').update({
                              times_shown: (stat.times_shown || 0) + 1,
                              times_engaged: (stat.times_engaged || 0) + (isEngaged ? 1 : 0),
                              last_shown_at: new Date().toISOString(),
                            }).eq('personalization_id', persId).eq('subtopic_category', bestCat).eq('cluster_index', bestIdx).then(() => {}).catch(() => {})
                          }
                        }).catch(() => {})
                    })
                }).catch(() => {})
              }
            }).catch(() => {})
          }).catch(() => {})
        }

        // INCREMENTAL CLUSTERING — from the very first engagement
        // No phases, no triggers. Clusters form and evolve with every positive engagement.
        if (event_type !== 'article_skipped' && event_type !== 'article_glance') {
          admin.from('published_articles').select('embedding_minilm').eq('id', article_id).single().then(({ data: artData }) => {
            if (!artData?.embedding_minilm || !Array.isArray(artData.embedding_minilm)) return
            const artEmb = artData.embedding_minilm

            admin.from('user_interest_clusters')
              .select('id, cluster_index, medoid_minilm, article_count, importance_score')
              .eq('personalization_id', persId)
              .eq('is_archived', false)
              .then(({ data: clusters }) => {
                if (!clusters || clusters.length === 0) {
                  // First engagement — create first cluster
                  admin.from('user_interest_clusters').insert({
                    user_id: null, cluster_index: 0,
                    medoid_embedding: artEmb, medoid_minilm: artEmb,
                    article_count: 1, importance_score: 1.0,
                    personalization_id: persId,
                    last_engaged_at: new Date().toISOString()
                  }).then(() => console.log('[analytics] First cluster created for', persId.substring(0, 8))).catch(() => {})
                  return
                }

                // Find nearest cluster
                let bestIdx = -1, bestSim = -1
                for (let i = 0; i < clusters.length; i++) {
                  const centroid = clusters[i].medoid_minilm
                  if (!centroid || !Array.isArray(centroid)) continue
                  const sim = cosineSim(artEmb, centroid)
                  if (sim > bestSim) { bestSim = sim; bestIdx = i; }
                }

                const MERGE_THRESHOLD = 0.70
                const MAX_CLUSTERS = 7

                if (bestIdx >= 0 && bestSim >= MERGE_THRESHOLD) {
                  // Close to existing cluster — update it
                  const cluster = clusters[bestIdx]
                  const count = cluster.article_count || 1
                  const centroid = cluster.medoid_minilm
                  const learningRate = 1.0 / (count + 1)
                  const newCentroid = centroid.map((v, i) => (1 - learningRate) * v + learningRate * artEmb[i])
                  const newCount = count + 1
                  const totalCount = clusters.reduce((s, c) => s + (c.article_count || 0), 0) + 1

                  admin.from('user_interest_clusters').update({
                    medoid_minilm: newCentroid, medoid_embedding: newCentroid,
                    article_count: newCount, importance_score: newCount / totalCount,
                    last_engaged_at: new Date().toISOString()
                  }).eq('id', cluster.id).then(() => {
                    for (const c of clusters) {
                      if (c.id === cluster.id) continue
                      admin.from('user_interest_clusters')
                        .update({ importance_score: (c.article_count || 0) / totalCount })
                        .eq('id', c.id).then(() => {}).catch(() => {})
                    }
                  }).catch(() => {})

                } else if (clusters.length < MAX_CLUSTERS) {
                  // Too far from any cluster + room for new one → create it
                  const totalCount = clusters.reduce((s, c) => s + (c.article_count || 0), 0) + 1
                  const newIdx = clusters.length > 0 ? Math.max(...clusters.map(c => c.cluster_index)) + 1 : 0
                  admin.from('user_interest_clusters').insert({
                    user_id: null, cluster_index: newIdx,
                    medoid_embedding: artEmb, medoid_minilm: artEmb,
                    article_count: 1, importance_score: 1 / totalCount,
                    personalization_id: persId,
                    last_engaged_at: new Date().toISOString()
                  }).then(() => {
                    console.log('[analytics] New interest cluster #' + newIdx + ' for', persId.substring(0, 8))
                  }).catch(() => {})
                }
              }).catch(() => {})
          }).catch(() => {})
        }

        // ============================================================
        // BUCKET ENGAGEMENT STATS — for adaptive budget allocation
        // Tracks how well trending/exploration performs for this user
        // ============================================================
        if (bucket === 'trending' || bucket === 'exploration' || bucket === 'discovery' || bucket === 'cold-start') {
          const isEngaged = !['article_skipped', 'article_glance'].includes(event_type)
          admin.rpc('update_bucket_stats', {
            p_pers_id: persId,
            p_bucket: bucket,
            p_engaged: isEngaged,
          }).catch(() => {})
        }

        // ============================================================
        // SUBTOPIC ENGAGEMENT STATS — for weighted subtopic allocation
        // Matches article to user's subtopics via category + tags
        // ============================================================
        if (article_id && bucket === 'personal') {
          admin.from('published_articles').select('category, interest_tags').eq('id', article_id).single().then(({ data: artInfo }) => {
            if (!artInfo) return
            const artCat = artInfo.category
            const artTags = Array.isArray(artInfo.interest_tags) ? artInfo.interest_tags :
              (typeof artInfo.interest_tags === 'string' ? JSON.parse(artInfo.interest_tags || '[]') : [])

            // Find which subtopic this article belongs to by matching the metadata bucket subtopic
            // Use the article's category + tags to find best matching subtopic
            const subtopicName = metadata?.subtopic_name
            if (subtopicName) {
              admin.rpc('update_subtopic_stats', {
                p_pers_id: persId,
                p_subtopic: subtopicName,
                p_event_type: event_type,
              }).catch(() => {})
            }
          }).catch(() => {})
        }
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

    const POSITIVE_EVENTS = ['article_engaged', 'article_saved', 'article_detail_view', 'article_liked', 'article_shared']
    const NEGATIVE_EVENTS = ['article_skipped']

    if (effectiveUserId && article_id && (POSITIVE_EVENTS.includes(event_type) || NEGATIVE_EVENTS.includes(event_type))) {
      const isPositive = POSITIVE_EVENTS.includes(event_type)

      // Use atomic RPC to prevent race conditions (concurrent events overwriting each other)

      admin
        .from('published_articles')
        .select('typed_signals')
        .eq('id', article_id)
        .single()
        .then(({ data: articleData }) => {
          if (!articleData) return
          const typed = typeof articleData.typed_signals === 'string'
            ? JSON.parse(articleData.typed_signals || '[]')
            : (articleData.typed_signals || [])
          if (!Array.isArray(typed) || typed.length === 0) return

          // Filter to valid typed signals (type:value format, not category words)
          const validSignals = typed.filter(s => {
            if (typeof s !== 'string') return false
            const parts = s.split(':')
            if (parts.length !== 2) return false
            return parts[1].length > 0 && parts[1].length <= 64
          })
          if (validSignals.length === 0) return

          admin.rpc('bulk_update_entity_signals', {
            p_user_id: effectiveUserId,
            p_signals: validSignals,
            p_is_positive: isPositive,
          }).then(({ error: sigError }) => {
            if (sigError) console.log('[analytics] entity signal update failed:', sigError.message)
          })
        })
        .catch(() => {})
    }

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

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Analytics track error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


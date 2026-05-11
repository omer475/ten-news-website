// lib/ranker_v1.js — Phase 3.1 (TikTok mirror plan).
//
// X-style weighted-sum ranker. Replaces the 9-multiplier formula in
// lib/trinityServe.js rerank() with an additive sum over 11 prediction
// heads × hand-tuned weights, multiplied by 3 policy multipliers.
//
// The shape mirrors X's open-sourced Heavy Ranker:
//   score = Σ weight_i × P(action_i)
// adapted for our text-platform signals (no comments, no clicks-into-
// article, no retweet). Replaces TikTok's E[playtime] with our E[dwell]
// and adds revisit / chip_tap / more_like_this as text-platform-specific
// heads.
//
// V0 (this file): pseudo-probabilities from empirical user rates and
// already-loaded signal maps when no trained model is available.
//
// V1 (Phase 2.4, 2026-05-11): loads `lib/ranker_v1_model.json` at module
// init. When the file contains trained heads (P_tap, P_save, E_dwell),
// scoreV1 uses model predictions for the corresponding pseudo-prob
// slots. Heads not in the model (P_more_like_this, P_entity_tap,
// P_chip_tap, P_follow_publisher) keep their pseudo-prob baselines.
//
// When the stub model is loaded (default state, `heads: {}`), scoreV1
// is byte-identical to the V0 logic — same code path, no model use.
//
// Gated by pickRankerVersion (lib/trinityServe.js Phase 2.5): per-user
// FNV-1a hash bucketing for canary rollout. Forced via RANKER_VERSION
// env var: 'v0' / 'v1' overrides the canary bucketing.

import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)

// Try to load the trained model JSON at module init. The stub file
// (committed at lib/ranker_v1_model.json) has empty `heads`; the Python
// training script (Phase 2.3 scripts/train_ranker_v1.py) overwrites it
// with real coefficients. If the file is missing entirely, fall back to
// V0 pseudo-probabilities with a single startup warning.
let _model = null
try {
  _model = _require('./ranker_v1_model.json')
  if (!_model || typeof _model !== 'object') _model = null
  if (_model && _model.version) {
    if (_model.version === 'stub') {
      console.log('[trinity.ranker] v1 stub model loaded — using V0 pseudo-probs')
    } else {
      console.log(`[trinity.ranker] v1 trained model loaded version=${_model.version}`)
    }
  }
} catch (err) {
  console.warn(`[trinity.ranker] v1 model JSON not loaded: ${err.message} — falling back to V0`)
  _model = null
}

// Returns true when the loaded model has trained coefficients for at
// least one head. Falsy state means scoreV1 should use pseudo-probs.
function modelHasTrainedHeads() {
  if (!_model || !_model.heads || typeof _model.heads !== 'object') return false
  return Object.keys(_model.heads).length > 0
}

// Predict one head's probability given a feature vector. Returns null
// when the head isn't trained — caller falls back to pseudo-prob.
function modelPredict(headName, features) {
  if (!modelHasTrainedHeads()) return null
  const head = _model.heads[headName]
  if (!head || !Array.isArray(head.coefficients)) return null
  const order = _model.feature_order || []
  const means = _model.scaler_means || []
  const stds  = _model.scaler_stds  || []
  let logit = head.intercept || 0
  for (let i = 0; i < order.length; i++) {
    const raw = features[order[i]] || 0
    const norm = stds[i] ? (raw - (means[i] || 0)) / stds[i] : raw
    logit += (head.coefficients[i] || 0) * norm
  }
  let p = 1 / (1 + Math.exp(-logit))
  // Optional Platt calibration: sigmoid(a * logit + b) on top of base sigmoid.
  if (Number.isFinite(head.platt_a) && Number.isFinite(head.platt_b)) {
    p = 1 / (1 + Math.exp(-(head.platt_a * Math.log(p / Math.max(1e-9, 1 - p)) + head.platt_b)))
  }
  return Math.max(0, Math.min(1, p))
}

// ---------------------------------------------------------------------------
// Weights — modeled on X's Heavy Ranker, adapted to our signal set.
// ---------------------------------------------------------------------------

export const RANKER_V1_WEIGHTS = Object.freeze({
  // Positive heads (intent strength roughly increasing)
  like:             1.0,
  save:             5.0,
  revisit:         12.0,   // rare but strongest single positive
  follow_publisher: 4.0,
  more_like_this:   2.5,
  read_complete:    1.5,   // dwell >= expected_read_seconds
  dwell_per_sec:    0.04,  // continuous regression on E[dwell]
  entity_tap:       0.3,   // bullet bold entity
  chip_tap:         0.8,   // trending-topic chip (between save and share)

  // Negative heads (asymmetric punishment, X-style)
  fast_skip:      -10.0,   // dwell <3s
  not_interested: -40.0,   // explicit long-press reject
})

// Onboarding-interest floor — multiplicative, never decays.
export const ONBOARDING_FLOOR_BOOST = 1.3

// ---------------------------------------------------------------------------
// V0 — pseudo-probabilities from existing signals.
//
// Each P(action) below is a heuristic stand-in until V1 trains a model.
// The KEY property to preserve: rates scale with user-article fit. The
// HEAD WEIGHTS handle the intent ranking; the probabilities handle the
// per-(user, article) fit.
// ---------------------------------------------------------------------------

/**
 * Compute the V0 X-style score for one candidate.
 *
 * @param article - candidate with vq_primary, vq_secondary, source, ai_final_score, etc.
 * @param ctx - per-user context with:
 *   - userActionRates: { likeRate, saveRate, revisitRate, ... } baseline rates
 *   - userFollowedAuthors: Set<author_id>
 *   - userOnboardingTags: Set<topic_code> (declared interests)
 *   - userFunnelStats: Map<vq_primary, {impressions, taps, deep_reads}>
 *   - negativeDimensions: { cluster, source, primary } skip-count Maps
 *   - hourPrimaryBoosts: Map<vq_primary, multiplier>
 *   - categoryMultipliers: Map<category, multiplier>
 *   - recentEventIds: Set<event_id>
 *   - todaysPrimaryCounts: Map<vq_primary, count>
 * @returns numeric score
 */
export function scoreV1(article, ctx = {}) {
  const w = RANKER_V1_WEIGHTS
  const {
    userActionRates = {},
    userFollowedAuthors = new Set(),
    userOnboardingTags = new Set(),
    userFunnelStats = null,
    negativeDimensions = null,
    hourPrimaryBoosts = null,
    categoryMultipliers = null,
    recentEventIds = null,
    todaysPrimaryCounts = null,
    creatorAffinity = null,  // Phase 1.3 — per-creator engagement rate, follow-pool only
  } = ctx

  // --- Fit factor: how well does this article match the user's signal? ---
  // Combines categoryMult + hourMult + funnelMult into one [0.3, 2.5] scalar.
  // Each P(positive_action) is scaled by this fit factor.
  let fit = 1.0
  if (categoryMultipliers && article.category) {
    const m = categoryMultipliers.get(article.category)
    if (m != null) fit *= m
  }
  if (hourPrimaryBoosts && article.vq_primary != null) {
    const m = hourPrimaryBoosts.get(article.vq_primary)
    if (m != null) fit *= m
  }
  // Funnel tap×read rates per-primary, Beta-shrunk
  const fs = userFunnelStats && article.vq_primary != null
    ? userFunnelStats.get(article.vq_primary)
    : null
  let tapRate = 0.20   // baseline
  let readRate = 0.30  // baseline P(deep_read | tap)
  if (fs && fs.impressions >= 5) {
    tapRate  = (fs.taps + 5) / (fs.impressions + 25)             // Beta(5, 20)
    readRate = (fs.deep_reads + 2) / (Math.max(1, fs.taps) + 8)  // Beta(2, 6)
  }
  const funnelFit = Math.max(0.7, Math.min(1.6, (tapRate / 0.20) * (readRate / 0.30)))
  fit *= funnelFit

  // Quality contribution to fit (squashed by log so it doesn't dominate)
  const quality = Number(article.ai_final_score || 0)
  const qualityFit = 0.5 + 0.5 * Math.log1p(quality / 100) / Math.log1p(10)  // ~[0.5, 1.5]
  fit *= qualityFit

  // --- Pseudo-probabilities for each head ---

  // Phase 2.4 (2026-05-11): when the trained model is loaded, use its
  // predictions for the heads it covers. Other heads keep pseudo-probs.
  // Feature vector is built once per candidate and reused across heads.
  let trainedFeatures = null
  if (modelHasTrainedHeads()) {
    const ageHoursLog = Math.log1p(Math.max(0, (Date.now() - new Date(article.created_at || article.published_at || Date.now()).getTime()) / 3600000))
    trainedFeatures = {
      log_quality: Math.log1p(Number(article.ai_final_score || 0) / 100),
      age_hours_log: ageHoursLog,
      log_expected_read: Math.log1p(Number(article.expected_read_seconds) || 30),
      log_num_sources: Math.log1p(Number(article.num_sources) || 1),
      cluster_fit: fit,
      tap_rate: tapRate,
      read_rate: readRate,
      is_followed_author: (article.author_id && userFollowedAuthors.has(article.author_id)) ? 1 : 0,
      seen_count: Number(article.seen_count) || 0,
    }
  }

  // --- Positive-action probabilities ---
  // Baselines calibrated so engagement_score is POSITIVE at typical-user
  // baseline. This matters because policy multipliers (recency, seenDecay)
  // are < 1, so multiplying a NEGATIVE engagement score would invert their
  // direction. Positive baseline keeps the multipliers behaving correctly.
  const P_tap_model = trainedFeatures ? modelPredict('p_tap', trainedFeatures) : null
  const P_like           = P_tap_model != null
    ? clip(0.0, 0.40, P_tap_model)
    : clip(0.0, 0.40, (userActionRates.likeRate         || 0.040) * fit)
  const P_save_model = trainedFeatures ? modelPredict('p_save', trainedFeatures) : null
  const P_save           = P_save_model != null
    ? clip(0.0, 0.15, P_save_model)
    : clip(0.0, 0.15, (userActionRates.saveRate         || 0.010) * fit)
  const P_revisit        = clip(0.0, 0.08, (userActionRates.revisitRate      || 0.005) * fit)
  const P_more_like_this = clip(0.0, 0.05, (userActionRates.moreLikeThisRate || 0.003) * fit)
  const P_entity_tap     = clip(0.0, 0.15, (userActionRates.entityTapRate    || 0.050) * fit)
  const P_chip_tap       = clip(0.0, 0.15, (userActionRates.chipTapRate      || 0.020) * fit)

  // Follow publisher: ~1.0 if user follows the author, near-zero baseline otherwise.
  const P_follow_publisher = article.author_id && userFollowedAuthors.has(article.author_id)
    ? 1.0 : 0.001

  // Read complete: direct empirical estimate from funnel stats.
  const P_read_complete = readRate

  // E[dwell] seconds: model regression head if trained, else pseudo-prob.
  const expectedRead = Number(article.expected_read_seconds) || 30
  const E_dwell_model = trainedFeatures ? modelPredict('e_dwell', trainedFeatures) : null
  const E_dwell = E_dwell_model != null
    ? Math.max(0, E_dwell_model * expectedRead)   // model returns ratio; rescale to seconds
    : tapRate * expectedRead * 0.5

  // --- Negative-action probabilities ---
  // Fast skip: LOW baseline (0.05) — most articles aren't fast-skipped. Elevated
  // when negDims has skip-history on this cluster / primary / source. Earlier
  // version used (1 - tapRate)*0.8 which gave 0.64 at baseline and inverted the
  // policy multipliers — fixed.
  let P_fast_skip = 0.05
  if (negativeDimensions) {
    const clusterSkips = article.vq_secondary != null
      ? (negativeDimensions.cluster.get(String(article.vq_secondary)) || 0) : 0
    const primarySkips = article.vq_primary != null
      ? (negativeDimensions.primary.get(String(article.vq_primary)) || 0) : 0
    const sourceSkips = typeof article.source === 'string'
      ? (negativeDimensions.source.get(article.source.toLowerCase()) || 0) : 0
    P_fast_skip = clip(0.05, 0.50,
      0.05 + clusterSkips * 0.03 + primarySkips * 0.015 + sourceSkips * 0.02)
  }

  // Not interested: rare baseline (0.003), elevated only on heavy negative history.
  let P_not_interested = 0.003
  if (negativeDimensions) {
    const clusterSkips = article.vq_secondary != null
      ? (negativeDimensions.cluster.get(String(article.vq_secondary)) || 0) : 0
    const primarySkips = article.vq_primary != null
      ? (negativeDimensions.primary.get(String(article.vq_primary)) || 0) : 0
    if (clusterSkips > 8) P_not_interested = Math.min(0.10, 0.005 + clusterSkips * 0.005)
    if (primarySkips > 12) P_not_interested = Math.max(P_not_interested, 0.03)
  }

  // --- The X-style weighted sum (engagement_score) ---
  const engagementScore =
      w.like             * P_like
    + w.save             * P_save
    + w.revisit          * P_revisit
    + w.follow_publisher * P_follow_publisher
    + w.more_like_this   * P_more_like_this
    + w.read_complete    * P_read_complete
    + w.dwell_per_sec    * E_dwell
    + w.entity_tap       * P_entity_tap
    + w.chip_tap         * P_chip_tap
    + w.fast_skip        * P_fast_skip
    + w.not_interested   * P_not_interested

  // --- Policy multipliers (not learned, applied OUTSIDE the additive sum) ---
  // 1) Onboarding interest floor — declared topics never decay.
  let onboardingFloor = 1.0
  if (userOnboardingTags.size > 0 && Array.isArray(article.interest_tags)) {
    for (const t of article.interest_tags) {
      const lower = typeof t === 'string' ? t.toLowerCase() : ''
      if (userOnboardingTags.has(lower)) {
        onboardingFloor = ONBOARDING_FLOOR_BOOST
        break
      }
    }
  }

  // 2) Recency — exponential by shelf_life_days half-life
  const recency = recencyWeight(article)

  // 3) Seen decay — smooth 1 / (1 + 0.4 × n)
  const seenMult = article.seen_count > 0
    ? 1 / (1 + 0.4 * Number(article.seen_count))
    : 1.0

  // 4) Cross-session story dedup
  let eventDemote = 1.0
  if (recentEventIds && article._world_event_id != null && recentEventIds.has(article._world_event_id)) {
    eventDemote = 0.3
  }

  // 5) Same-tag-today
  let todayPenalty = 1.0
  if (todaysPrimaryCounts && article.vq_primary != null) {
    const seenToday = todaysPrimaryCounts.get(article.vq_primary) || 0
    if (seenToday > 0) todayPenalty = 1 / (1 + 0.08 * seenToday)
  }

  // 6) Per-creator affinity (Phase 1.3) — only applied to follow-pool items.
  // RealGraph-style multiplier in [0.5, 1.5]. Other retrievers are scoped by
  // VQ cluster, not author; applying affinity there would double-count the
  // cluster-fit signal already in `fit`.
  let creatorAffinityMult = 1.0
  if (creatorAffinity && article._retriever === 'trinity-follow' && article.author_id) {
    const m = creatorAffinity.get(article.author_id)
    if (m != null) creatorAffinityMult = m
  }

  const policyMult = onboardingFloor * recency * seenMult * eventDemote * todayPenalty * creatorAffinityMult

  // Engagement score is signed (negatives can push it below 0). Multiply by
  // policy. Negative final scores still rank below positive — that's fine.
  return engagementScore * policyMult
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clip(lo, hi, v) {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function recencyWeight(article, nowMs = Date.now()) {
  const ageMs = nowMs - new Date(article.created_at || article.published_at || nowMs).getTime()
  const ageH = Math.max(0, ageMs / 3600000)
  const shelfDays = Number.isFinite(article.shelf_life_days) && article.shelf_life_days > 0
    ? article.shelf_life_days : 3
  const halfLifeH = shelfDays * 24 / 2
  return Math.exp(-Math.log(2) * ageH / halfLifeH)
}

// ---------------------------------------------------------------------------
// Batch rerank — drop-in replacement for trinityServe.js rerank() when
// RANKER_VERSION=v1.
// ---------------------------------------------------------------------------

export function rerankV1(candidates, opts = {}) {
  for (const a of candidates) {
    a._score = scoreV1(a, opts)
  }
  candidates.sort((a, b) => b._score - a._score)
  return candidates
}

// Trinity (ByteDance KDD 2024) — paper-exact retrieval algorithms.
//
// Source: Yan et al., "Trinity: Syncretizing Multi-/Long-tail/Long-term Interests All in One",
//         KDD 2024 (arXiv:2402.02842). Algorithms 1 and 2.
//
// Trinity v3 — 2026-05-02 session diagnostics rebuild.
// Carries v1+v2 lessons (J=256/K=2048, vq_centroids table, adaptive T_p/T_s,
// bucket boost, full seen-history dedup, await impression insert, has_more=true,
// soft M/LT exclusion, pad-spread). Adds three principled upgrades:
//
//   v3-A. Adaptive multi-tier retrieval (`retrieveCandidatesAdaptive`).
//         Try 7d → 14d → 21d windows, stop at first tier that yields ≥ minPool.
//         Replaces the flat 7d window that exhausted heavy users' pools.
//
//   v3-B. Content-aware recency decay (`recencyWeightForArticle`).
//         Half-life = (article.shelf_life_days * 24) / 2.
//         Breaking news (shelf=1d) decays in 12h; evergreen (shelf=14d) lasts
//         a week. Replaces the flat 36h half-life that crushed Trinity's
//         older-but-relevant picks vs fresh trending.
//
//   v3-C. Thompson Sampling exploration arm (`exploreArm`).
//         Beta(α=1+engages, β=1+skips) sampled per cluster where user h²=0.
//         Pick top-k by sample. Yields one explore slot per slate, gradually
//         learning which directions pay off. Replaces having no exploration
//         path at all (Trinity-M and Trinity-LT both require user history).
//
// Plus: trinityLT supports `excludeClusters` opt with `softExclude` fallback.

import { expectedReadSecondsForArticle } from './readingTime.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const J_PRIMARY = 256
export const K_SECONDARY = 2048
export const SUBCODEBOOK_K = 8

export const HISTOGRAM_WINDOW = 2500    // adaptive-thresholds reference scale (paper)

// Phoenix Phase 1.6 (2026-05-08): lifetime histogram with exponential time
// decay replaces the fixed 3750-event window. 30-day half-life mirrors
// Pinterest PinnerSage's 60-90 day cluster window with stronger recent bias;
// retains long-term taste signals (211 lifetime events on a primary stay
// visible) while letting the histogram adapt to short-term shifts.
export const HISTOGRAM_LIFETIME_CAP = 30000   // hard cap on events loaded — sanity bound
export const HISTOGRAM_HALFLIFE_DAYS = 30     // exponential decay half-life

// Paper-exact thresholds (used for users with ≥ HISTOGRAM_WINDOW qualifying behaviors).
export const T_P = 30                   // h¹[c1] >= T_p to consider primary
export const T_S = 10                   // h²[c2] >= T_s to consider secondary kid
export const N_M = 10                   // # clusters returned by Trinity-M

export const N_C = 600                  // long-tail pool size (top by B-score)
export const T_I = 3                    // drop clusters with < T_i articles
export const T_L = 3                    // keep only clusters with user h²[c2] >= T_l
export const N_LT = 20                  // # clusters sampled by Trinity-LT
export const LT_ALPHA = 0.75            // sampling exponent (paper)
export const LT_BETA = 0.1              // sampling additive (paper)

// (deviation:) per-article qualifying gate for text articles.
export const QUALIFYING_READ_FRACTION = 0.5

// Phoenix Phase 8.A (2026-05-09): removed dead JS-side engagementWeight()
// + QUALIFYING_EVENT_WEIGHTS Map + QUALIFYING_EVENTS Set + isQualifying() +
// pickDwellSeconds(). All replaced by the server-side trinity_build_histogram
// RPC (migration 084 effort-weighted positives + Phase 4.A.3 engagement-aware
// exclude). Canonical weights now live in migration 084.

// EMA decay rate for the long-tail B-score. Paper does not specify a value;
// 0.1 means "long memory, smooth updates" — flips a cluster from short-tail
// to long-tail over ~10 sessions of non-exposure.
export const LT_EMA_RATE = 0.1

// v3-A / v4 / v5.1. Adaptive retrieval window tiers (hours). Try in order,
// stop at first tier whose pool is large enough.
//
// History:
//   v3 had [7d, 14d, 21d] — heavy users exhausted 7d via dedup and the
//   system widened to 21d, surfacing 9-10d old articles (live audit
//   2026-05-02 13:45: median age 8d, 9 of 25 slots ≥ 9d).
//   v4 capped at 7d hard. The freshness gap was filled by trinity-fresh.
//
// v5.1 (Phase 1 fix, 2026-05-06): re-add a 14d third tier to address
// power-user dedup exhaustion. The 2026-05-05 22:00 UTC session diagnostic
// found 0 unseen articles in the 48h window across all 10 of the user's
// top primaries, even though 18-23 unseen articles existed in 7d. The
// 14d tier only fires when the 7d pool is genuinely empty after dedup
// (retrieveCandidatesAdaptive's tier-escalation rule), and stale-age
// penalty (0.4× for >7d articles) keeps the freshness preference intact.
//
// HLLM (ByteDance 2024) implicitly does this — its LLM item-encoder
// treats older items as feature-equivalent to newer ones, letting them
// re-enter retrieval freely.
export const ADAPTIVE_WINDOW_TIERS_H = [3 * 24, 7 * 24, 14 * 24]

// v3-B. Recency decay defaults (used as fallbacks when shelf_life_days
// is missing).  Half-life = shelf_life_days * 24 / 2.
export const DEFAULT_SHELF_LIFE_DAYS = 3

// v4. Stale age penalty. Articles older than this get a hard score multiplier
// regardless of shelf_life — protects against high-shelf-life "evergreen"
// articles outranking fresh content for news-feed users.
export const STALE_AGE_DAYS = 7
export const STALE_PENALTY_FACTOR = 0.4

// v4. trinity-fresh retriever — last-N-hours articles in the user's top
// primary clusters (broad scope, not the narrow secondaries M/LT use).
// This is the primary freshness floor; ensures fresh content reaches users
// 2026-05-19 — timeless retrieval window.
//
// Audit (test user 5082a1df): Tech (40% engagement) landed at avg slot 12.9
// while Sports (17% engagement) landed at slot 9.3. Root cause: 48h hard
// window cut off the personal pool to ~4 unseen candidates for the user's
// top interest, so the slate fell back to long-tail cluster sampling that
// surfaced gaming / WNBA / random foreign content.
//
// Peers (TikTok / Instagram / YouTube / Pinterest) have NO hard time cap on
// retrieval — they trust recency decay multipliers to demote older content
// naturally. We already compute recency decay (recencyWeightForArticle uses
// exp(-ln(2)·age/halfLife) with halfLife = shelf_life_days × 12). A 6-day-old
// article with 3-day shelf life scores ~0.06× — auto-demoted, doesn't need a
// hard cut.
//
// 2026-05-19 (PR8) — tuned 8760 (1 year) → 720 (30 days).
//
// PR #196 (timeless) overshot: the user vector matched articles from 50-60 days
// ago, and even though recency decay drove their scores to ~0.003, those scores
// could still win when no fresher article matched the vector. Production slate
// showed 60-day-old articles at slot 0.
//
// 720 hours (30 days) matches Twitter/X cr-mixer's `MaxTweetAgeHoursParam`
// upper bound exactly (open-source `cr-mixer/server/.../param/GlobalParams.scala`).
// Pinterest engagement-weighted corpus uses 90 days. YouTube has no cap but
// applies a "freshness" feature.
//
// For our test user: 30-day window yields ~180 eligible articles per primary
// (vs 0 at 48h, 926 at 1 year). Enough supply to fill the slate. Article ages
// capped at 30 days max — no more 60-day-old "fresh news."
//
// Env override TRINITY_RETRIEVAL_WINDOW_H for fast rollback (e.g., set to 48
// for legacy or 8760 to restore timeless).
export const FRESH_WINDOW_H = Math.max(
  24,
  Number(process.env.TRINITY_RETRIEVAL_WINDOW_H) || 720
)

// 2026-05-21 — personal-pool ANN retrieval window (5 days).
//
// The per-primary ANN ranks candidates by VECTOR SIMILARITY, not age. With the
// 720h (30d) window, the user's top primaries held ~9x more old unseen articles
// than fresh ones (verified on test user 5082a1df: 1,392 unseen @7-30d vs 159
// @<72h), so the cosine-nearest matches skewed old and padded the lower slots
// with 7-24 day-old content. A 120h (5d) window keeps the personal pool recent
// while leaving ample supply (the <72h unseen count alone exceeds the
// ~60-candidate post-lightRank pool). Recency decay then orders freshest first
// within the window. Env override TRINITY_PERSONAL_WINDOW_H. Floor 48h.
export const PERSONAL_POOL_WINDOW_H = Math.max(
  48,
  Number(process.env.TRINITY_PERSONAL_WINDOW_H) || 120
)
// FRESH_TOP_PRIMARIES retired by mig 119 — fresh pool now uses
// primariesAboveThreshold (every interest primary above adaptive Tp), same as
// the personal pool. Constant kept exported only as a sane upper bound on the
// downstream `freshPrimariesAll.slice(0, 20)` follow-pool filter cap.
export const FRESH_TOP_PRIMARIES = 50
// Mig 119: lowered 500 → 300. The 500 floor was set when fresh was capped at
// top-3 primaries (high quality bar to compensate for narrow scope). With
// every interest primary eligible the supply expands; the 300 floor matches
// where ai_final_score genuinely separates signal from noise.
export const FRESH_MIN_SCORE = 300

// v3-C. Exploration arm size — fraction of slate dedicated to exploration.
// v5: 5% → 20% (4 of 20 slots), per Vombatkere et al. ACM WebConf 2024
// audit of real TikTok feeds: heavy users see ~26% exploration, new users
// ~69%. Our 5% was far below TikTok's audited band even for top-quartile
// heavy users. arxiv.org/abs/2403.12410.
export const EXPLORE_SLOT_FRACTION = 0.20

// Phoenix Phase 2.A (2026-05-08). Informative Beta prior on explore bandit.
//
// Old: Beta(1, 1) — uninformative uniform prior. Mean engage rate prior =
// 50%, std = 0.29. A brand-new cluster with 0/0 stats produced posterior
// samples uniformly in [0, 1] — half of all untested clusters got high
// samples by pure chance. Thompson Sampling was effectively random over
// the long tail of unexplored clusters because no cluster could
// statistically separate from the prior.
//
// New: Beta(0.5, 4.5) — population-mean engage rate prior. Mean = 10%,
// std = 0.12. Skeptical default: untested clusters get sampled around
// 0.05-0.25, anchored to a realistic engage-rate baseline. A cluster
// with 1 engage / 1 show now updates to Beta(1.5, 4.5) — clearly
// distinguishable from Beta(0.5, 4.5). Tested clusters with strong
// engagement bubble up; untested clusters need to actually demonstrate
// engagement to win, instead of winning by random sampling.
//
// Source: standard Bayesian recsys practice, e.g. Spotify BaRT (RecSys
// 2018), Yahoo Adam Bandits, Pinterest Pixie. The 0.5 / 4.5 specific
// values calibrate to a 10% engage-rate prior with weak weight (N₀ = 5).
export const EXPLORE_BETA_PRIOR_ALPHA = 0.5
export const EXPLORE_BETA_PRIOR_BETA  = 4.5

// Phoenix Phase 2.B (2026-05-08). Same-tag-today penalty for the explore arm.
// The leaked TikTok Algo 101 doc explicitly names a `same_tag_today` negative
// feature used to "break up" homogenization within a session. Translation for
// our cluster-bandit explore: when the user has already seen N articles from
// primary P today, every secondary under P gets its Beta sample reduced by
// SAME_TAG_TODAY_PENALTY × N. This stops a strong primary (e.g. AI for our
// test user) from also dominating the explore arm's picks — explore should
// surface OFF-tree clusters, not double-down on what the user already has.
//
// λ=0.05: if user has seen 5 AI articles today, AI explore clusters lose
// 0.25 from their Beta sample. Beta samples typically range 0.05-0.5 for
// unexplored clusters, so 0.25 is a real penalty without being nuclear.
// Window 24h matches TikTok's "today" semantic.
export const SAME_TAG_TODAY_PENALTY = 0.05
export const SAME_TAG_TODAY_WINDOW_HOURS = 24

// v5. Multi-tier interest budgets (Trinity KDD 2024 architecture).
// The paper specifies separate retrievers for short-term, long-tail, and
// long-term interest tiers run in parallel — NOT a single rerank-sort.
// Slot allocation matches Trinity's "underdelivered themes" principle:
//   tier1 (top-3 primaries, short-term):     45% of slate
//   tier2 (ranks 4-10, mid-term):            25% of slate
//   tier3 (long-tail / explore):             30% of slate
// Live audit 2026-05-02: a single rerank gave the user's top primary 64%
// of slots (14/22) when their histogram was 26%. Tier budgets prevent that.
export const TIER1_TOP_PRIMARIES = 3      // top-3 primaries by h¹
export const TIER2_RANK_START    = 3      // ranks 4-10 (0-indexed: 3..9)
export const TIER2_RANK_END      = 10
export const TIER1_SLOT_FRACTION = 0.45
export const TIER2_SLOT_FRACTION = 0.25
// Tier 3 = remaining (1 - tier1 - tier2 - explore) = 0.10
// Plus reserved fresh = absorbed into tier1 (top-3 primaries).

// v5. Per-primary slate cap (TikTok no-consecutive + YouTube DPP k=6 analog).
// Max-N from any single vq_primary in a 20-slot slate. The leaked Algo 101
// confirms TikTok blocks consecutive same-creator videos; balanced index
// (Streaming VQ KDD 2025) prevents popular clusters from dominating.
// 4/20 = 20% — a cluster can be present but cannot crowd out other interests.
export const MAX_PER_PRIMARY = 4
export const FORBID_CONSECUTIVE_SAME_PRIMARY = true

// 2026-05-17 (Wave 5). Cap on same-primary secondary clusters picked by the
// explore arm. Audit (Session B slate 2): 4 PGA Sports cards from primary
// 124 because Thompson sampling picked 4 different secondaries all under
// that one primary. TikTok newsroom: "won't show two videos in a row by
// same creator." We apply the same idea to the explore bucket's selection.
export const MAX_EXPLORE_PER_PRIMARY = 2

// v5.1 (Phase 1, 2026-05-06). Per-publisher (article.source) slate cap.
// TikTok Creator Academy: "the system generally avoids showing two videos
// in a row made with the same sound or by the same creator." For a
// publisher-feed news app, `source` ("Reuters", "AP", "BBC") is the
// closest analog to TikTok's per-creator dedup. Twitter open-source
// home-mixer "Author Diversity" rule does the same at N=1.
// 3/20 = 15% — a publisher can have presence without dominating.
export const MAX_PER_PUBLISHER = 3
export const FORBID_CONSECUTIVE_SAME_PUBLISHER = true

// v5.1 (Phase 1, 2026-05-06). Per-story-cluster slate cap.
// News-specific addition: TikTok dedup is per-creator+sound, but two
// AP/Reuters articles about the same UAE-OPEC story are
// information-redundant in a way TikTok's two same-creator videos are
// NOT (different angles, edits, performances). Google News story
// clustering shows the top-ranked article per event and demotes the
// rest. We mirror that with a strict 1-per-event_id cap. Articles must
// have `_world_event_id` attached (loaded by trinityServe from the
// article_world_events join table); articles without an event_id
// pass through untouched.
// Cross-session demote (0.3×) for already-seen events is a separate
// mechanism applied during ranking, not in this cap.
export const MAX_PER_EVENT = 1
export const CROSS_SESSION_EVENT_DEMOTE = 0.3

// P1+P3 fix (2026-05-11). X-style diversity discount.
//
// Source: X open-source `AuthorDiversityDiscountProvider.scala` (twitter/
// the-algorithm `home-mixer/server/.../scorer/`). Mechanism:
//   score *= (1 - Floor) × Decay^prior_count_on_same_axis + Floor
// With Decay=0.5, Floor=0.25:
//   1st pick from axis: ×1.000
//   2nd:                ×0.625
//   3rd:                ×0.438
//   4th:                ×0.344
//   5th+:               → asymptote 0.25
// Smooth, not a hard cap. Allows truly exceptional content to overcome the
// penalty (e.g. a 6th article from a publisher needs to be 4× better than
// next-best from a fresh publisher to win the slot).
//
// Applied in composeWithBudgets backfill on (pool, vq_primary, source) axes
// AND in lib/trinityServe.js post-compose to re-discount the full slate
// (replaces the hard MAX_PER_PRIMARY=4 / MAX_PER_PUBLISHER=3 caps with a
// smoother soft attenuation). MAX_PER_EVENT=1 stays as a strict cap because
// duplicate-story handling needs a hard rule.
export const DIV_DECAY = 0.5
export const DIV_FLOOR = 0.25

// v5. Negative-feedback ("Not Interested") parameters.
// Per Monolith RecSys 2022: negative signals propagate via real-time gradient
// updates, NOT hard exclusion. We translate to:
//   - Decrement h¹[primary] by NOT_INTERESTED_HISTOGRAM_DECREMENT per event
//   - Soft-exclude the primary's secondaries for NOT_INTERESTED_COOLDOWN_HOURS
//     (Trinity-M / Trinity-LT skip them; explore can still pick).
// This mirrors TikTok's "we'll show fewer like that" — softer than blocklist.
export const NOT_INTERESTED_HISTOGRAM_DECREMENT = 3
export const NOT_INTERESTED_COOLDOWN_HOURS      = 48

// 2026-05-17 (Wave 9). Embedding-based skip memory.
//
// Pattern source: twitter/the-algorithm InteractionGraphNegativeJob.scala
// aggregates 5 negative signal types (blocks, mutes, reports, see-less,
// unfollows) into a per-(user, target) negative graph; downstream retrieval
// filters by this graph. The "target" granularity in X is author. For our
// text-feed with cluster hierarchy, the right granularity is
// content-similarity — same pattern TikTok/Instagram use because their
// Two-Tower models learn the right "neighborhood" via embeddings.
//
// Mechanism: for each candidate article, count how many of the user's
// recent fast-skipped articles have embedding cosine ≥ SKIP_PENALTY_THRESHOLD.
// Multiplier = SKIP_PENALTY_DECAY ^ count. Same exponential shape as
// X's AuthorDiversityDiscountProvider and our existing applyDiversityDiscount.
//
// Threshold 0.60 — empirically: same article rewrites cosine 0.92+,
// same story 0.75-0.92, same sub-topic 0.55-0.75, related broad topic
// 0.40-0.55, different sub-topic 0.30-0.45. 0.60 catches "same sub-topic"
// without bleeding into adjacent broader topics (Galatasaray case: NBA-skip
// cosine to Galatasaray ≈ 0.30-0.45, below threshold).
//
// Decay 0.5 — matches DIV_DECAY (X open-source formula).
//
//   0 skipped neighbors → 1.0× (no penalty)
//   1 skipped neighbor  → 0.5×
//   2 skipped neighbors → 0.25×
//   3+ skipped neighbors → 0.125× and below — effectively dropped from slate
export const SKIP_PENALTY_THRESHOLD = 0.60
export const SKIP_PENALTY_DECAY     = 0.5

// Article-counts cache.
const ARTICLE_COUNTS_CACHE_TTL_MS = 5 * 60 * 1000
let articleCountsCache = null


// Adaptive thresholds: paper used T_p=30/T_s=10 for Douyin where users have
// ~2,500 qualifying behaviors. Smaller users have fewer per primary; preserve
// the *ratio* (1.2% / 0.4%) to keep the algorithm working at every scale.
// Floor 15/5 so we still require real evidence; ceiling = paper values.
//
// Phase 0.5 (2026-05-11): restored floors from 3/2 → 15/5 (KDD paper values).
// Phoenix Phase 1.6 had lowered them claiming "the 15/5 floor blocked
// Trinity-M for power users with deep-but-flat histograms." That was an
// over-correction — the audit showed tP/tS were pinned to 3/2 for nearly
// every user under ~250 qc, so the "adaptive" thresholds barely adapted at
// all. If a real power user's top-primary histogram weight is genuinely
// <15, the warm-start synth path (lib/coldStart.js) or the explore arm
// fills the gap. Restoring matches the KDD paper and the audited Trinity
// production deployments in the literature.
export function adaptiveThresholds(qualifyingCount) {
  const ratio = Math.min(1, qualifyingCount / HISTOGRAM_WINDOW)
  const tP = Math.max(15, Math.round(T_P * ratio))
  const tS = Math.max(5,  Math.round(T_S * ratio))
  return { tP, tS }
}


// ---------------------------------------------------------------------------
// Histogram builder
// ---------------------------------------------------------------------------

export async function buildHistograms(supabase, userId) {
  // Phoenix Phase 1.8 (2026-05-08): server-side aggregated histogram via
  // trinity_build_histogram RPC (migration 083). Replaces the JS event
  // loader which was silently capped at 1000 rows by PostgREST's default
  // max-rows — power users with 16K+ events never had their lifetime
  // taste reflected (qualifyingCount stuck at ~942).
  //
  // The RPC mirrors engagementWeight() + the time-decay loop in pure SQL
  // and returns aggregated (vq_primary, vq_secondary, weight_sum). One
  // round-trip, no row cap, much faster.
  //
  // Graceful-degradation chain (2026-05-13): the RPC was returning 0 rows
  // intermittently for established users (statement_timeout / transient
  // PG connection drop), and the algorithm was falling straight through
  // to cold-trending. Now we try the RPC → retry once after 100ms →
  // fall back to the last-known-good cache (user_histogram_cache) →
  // only THEN give up and return empty. The `source` field tells the
  // caller which layer answered.
  //
  // h1/h2 are Float64Array (Phase 1.7) so fractional weights accumulate.
  const empty = (source = 'none') => ({
    h1: new Float64Array(J_PRIMARY),
    h2: new Float64Array(K_SECONDARY),
    h2_strong: new Float64Array(K_SECONDARY),
    qualifyingCount: 0,
    cooldownPrimaries: new Set(),
    source,
  })
  if (!userId) return empty('guest')

  // Layer 1 — live RPC.
  let { data: rows, error } = await callHistogramRpc(supabase, userId)

  if (error) {
    console.error('[trinity] trinity_build_histogram RPC failed:', error.message)
  }

  // Layer 2 — retry once after 100ms if the live result was empty/error.
  if (!rows || rows.length === 0) {
    await new Promise(r => setTimeout(r, 100))
    const retry = await callHistogramRpc(supabase, userId)
    if (retry.error) {
      console.error('[trinity] trinity_build_histogram retry failed:', retry.error.message)
    } else if (retry.data && retry.data.length > 0) {
      rows = retry.data
      console.log(`[trinity.histogram_retry_ok] user=${userId.slice(0, 8)} rows=${rows.length}`)
    }
  }

  // Layer 3 — last-known-good cache. Substitutes when both live + retry
  // returned empty. Only used for established users (the cache row only
  // exists if a previous request wrote a healthy histogram).
  if (!rows || rows.length === 0) {
    const cached = await readHistogramCache(supabase, userId)
    if (cached) {
      console.warn(
        `[trinity.histogram_cache_hit] user=${userId.slice(0, 8)} ` +
        `qc=${cached.qualifyingCount} age_s=${cached.ageSeconds}`
      )
      return { ...cached, source: 'cache' }
    }
  }

  // No data anywhere — caller will fall through to cold-trending or
  // onboarding synth.
  if (!rows || rows.length === 0) return empty('rpc-empty')

  const h1 = new Float64Array(J_PRIMARY)
  const h2 = new Float64Array(K_SECONDARY)
  // 2026-05-17 (Wave 8 / Mig 125): h2_strong sums weight_sum_strong from
  // the RPC. Only counts explicit actions (like/save/share/revisit) +
  // long-reads (ratio >= 50%). Used by trinityLT for cluster qualification
  // — matches Trinity paper §3 "long behavior sequence" filter.
  // Defensive: if weight_sum_strong is missing (pre-migration RPC), fall
  // back to weight_sum so behavior degrades gracefully.
  const h2_strong = new Float64Array(K_SECONDARY)
  const cooldownPrimaries = new Set()
  let qualifyingCount = 0
  for (const r of rows) {
    const c1 = r.vq_primary
    const c2 = r.vq_secondary
    if (c1 == null || c2 == null) continue
    if (c1 < 0 || c1 >= J_PRIMARY) continue
    if (c2 < 0 || c2 >= K_SECONDARY) continue
    const w = Number(r.weight_sum) || 0
    const w_strong = r.weight_sum_strong != null
      ? (Number(r.weight_sum_strong) || 0)
      : w  // fallback when RPC pre-migration
    h1[c1] += w
    h2[c2] += w
    h2_strong[c2] += w_strong
    qualifyingCount += Number(r.qualifying_count) || 0
    // 48h cooldown for not-interested events.
    if (r.ev_within_48h) cooldownPrimaries.add(c1)
  }

  // Floor h1 at 0 — negative counts would break sortIndicesDesc semantics.
  for (let c1 = 0; c1 < J_PRIMARY; c1++) {
    if (h1[c1] < 0) h1[c1] = 0
  }
  // h2 floor too — fixes a latent bug where a heavily-skipped secondary
  // could produce a negative h2 that confused trinityM/LT.
  for (let c2 = 0; c2 < K_SECONDARY; c2++) {
    if (h2[c2] < 0) h2[c2] = 0
    if (h2_strong[c2] < 0) h2_strong[c2] = 0
  }

  return { h1, h2, h2_strong, qualifyingCount, cooldownPrimaries, source: 'live' }
}

async function callHistogramRpc(supabase, userId) {
  return supabase.rpc('trinity_build_histogram', {
    p_user_id: userId,
    p_halflife_days: HISTOGRAM_HALFLIFE_DAYS,
    p_max_events: HISTOGRAM_LIFETIME_CAP,
  })
}

/**
 * Read the last-known-good histogram for a user. Returns null if there is
 * no cached row, the cached_at is older than 7 days (we'd rather cold-
 * start than serve a week-stale taste vector), or any deserialize fails.
 */
async function readHistogramCache(supabase, userId) {
  const STALE_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000

  const { data, error } = await supabase
    .from('user_histogram_cache')
    .select('h1, h2, qualifying_count, cooldown_primaries, cached_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[trinity] histogram cache read failed:', error.message)
    return null
  }
  if (!data) return null

  const cachedAtMs = new Date(data.cached_at).getTime()
  const ageMs = Date.now() - cachedAtMs
  if (ageMs > STALE_CUTOFF_MS) return null

  // Defensive hydration — column types are jsonb / int[].
  if (!Array.isArray(data.h1) || data.h1.length !== J_PRIMARY) return null
  if (!Array.isArray(data.h2) || data.h2.length !== K_SECONDARY) return null

  const h1 = new Float64Array(J_PRIMARY)
  for (let i = 0; i < J_PRIMARY; i++) h1[i] = Number(data.h1[i]) || 0
  const h2 = new Float64Array(K_SECONDARY)
  for (let i = 0; i < K_SECONDARY; i++) h2[i] = Number(data.h2[i]) || 0
  // 2026-05-17 (Wave 8): cache doesn't persist h2_strong; on cache-fallback
  // path (~1% of requests when RPC fails), default h2_strong = h2 so LT
  // behaves as it did pre-Wave-8. Avoids a second migration just for the
  // rare cache-hit case.
  const h2_strong = new Float64Array(K_SECONDARY)
  for (let i = 0; i < K_SECONDARY; i++) h2_strong[i] = h2[i]

  const cooldownPrimaries = new Set(
    Array.isArray(data.cooldown_primaries) ? data.cooldown_primaries : []
  )

  return {
    h1,
    h2,
    h2_strong,
    qualifyingCount: Number(data.qualifying_count) || 0,
    cooldownPrimaries,
    ageSeconds: Math.round(ageMs / 1000),
  }
}

/**
 * Persist a healthy histogram so a future RPC failure can substitute it.
 * Fire-and-forget — never throws, never blocks the slate response. Skipped
 * for guests and for low-confidence histograms (qc < 50, where the cache
 * wouldn't beat cold-trending anyway).
 */
export async function writeHistogramCache(supabase, userId, h1, h2, qualifyingCount, cooldownPrimaries) {
  if (!userId) return
  if (qualifyingCount < 50) return
  if (!h1 || !h2) return

  const row = {
    user_id: userId,
    h1: Array.from(h1),
    h2: Array.from(h2),
    qualifying_count: qualifyingCount,
    cooldown_primaries: Array.from(cooldownPrimaries || []),
    cached_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_histogram_cache')
    .upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[trinity] histogram cache write failed:', error.message)
  }
}


// Phoenix Phase 8.A (2026-05-09): removed dead JS-side weighting helpers
// (engagementWeight, isQualifying, pickDwellSeconds). All histogram
// weighting now happens server-side in trinity_build_histogram RPC
// (migration 084) which mirrors the dwell-tier + effort-weighted-positives
// logic in pure SQL. Canonical weight definitions live in migration 084.


// ---------------------------------------------------------------------------
// Trinity-M — Algorithm 1.
// ---------------------------------------------------------------------------

export function trinityM(h1, h2, parentMap, rng = Math.random, thresholds = null, opts = {}) {
  if (!parentMap || parentMap.length !== K_SECONDARY) {
    throw new Error(`trinityM: parentMap must have length ${K_SECONDARY}`)
  }
  const tP = thresholds?.tP ?? T_P
  const tS = thresholds?.tS ?? T_S
  // v5. Optional primary set restrictor — for tier1/tier2 retrieval we only
  // want to draw from a specific subset of primaries (e.g. top-3 only).
  const onlyPrimaries = opts.onlyPrimaries instanceof Set
    ? opts.onlyPrimaries
    : (Array.isArray(opts.onlyPrimaries) ? new Set(opts.onlyPrimaries) : null)
  // v5. Skip "Not Interested" cooldown primaries (soft-exclude — Monolith-style).
  const cooldownPrimaries = opts.cooldownPrimaries instanceof Set
    ? opts.cooldownPrimaries
    : new Set(opts.cooldownPrimaries || [])
  // Phoenix Phase 5.B (2026-05-09): per-cluster avoid set (sub-category negatives
  // — basketball within Sports, Iran-war within World, etc). Phase 4.F applied
  // this to exploreArm + trinityLT only; trinityM was missed. Result: a user
  // who'd rejected basketball 24× still got basketball secondaries via tier1
  // if h¹[Sports] was high. This closes that gap.
  const avoidClusters = opts.avoidClusters instanceof Set
    ? opts.avoidClusters
    : null
  const maxClusters = opts.maxClusters ?? N_M
  const out = []
  const seen = new Set()

  const childrenByPrimary = bucketChildren(parentMap)
  const primaryOrder = sortIndicesDesc(h1, J_PRIMARY)

  for (const c1 of primaryOrder) {
    if (h1[c1] < tP) break
    if (onlyPrimaries && !onlyPrimaries.has(c1)) continue
    if (cooldownPrimaries.has(c1)) continue
    const kids = childrenByPrimary[c1] || []
    // Phoenix Phase 5.B: filter avoid-set secondaries before eligibility check.
    const allowedKids = avoidClusters
      ? kids.filter(c2 => !avoidClusters.has(c2))
      : kids
    const eligible = allowedKids.filter(c2 => h2[c2] >= tS)

    let pick
    if (eligible.length > 0) {
      pick = eligible[Math.floor(rng() * eligible.length)]
    } else if (allowedKids.length > 0) {
      pick = argmaxOver(allowedKids, h2)
    } else {
      continue
    }
    if (!seen.has(pick)) {
      out.push(pick)
      seen.add(pick)
    }
    if (out.length >= maxClusters) break
  }

  // v5. Pad pass only when not restricted to a subset (tier1/tier2 retrieval
  // intentionally narrows; padding to N_M would defeat the tier point).
  if (!onlyPrimaries && out.length < maxClusters) {
    // Track which primaries are already represented. Pad in two passes:
    //   pass 0: prefer c2's whose primary is NOT yet picked (more c1 spread)
    //   pass 1: anything else by global-largest h²
    const usedPrimaries = new Set()
    for (const c2 of out) usedPrimaries.add(parentMap[c2])
    const globalOrder = sortIndicesDesc(h2, K_SECONDARY)
    for (const phase of [0, 1]) {
      for (const c2 of globalOrder) {
        if (h2[c2] === 0) break
        if (seen.has(c2)) continue
        if (avoidClusters && avoidClusters.has(c2)) continue  // Phase 5.B
        const c1 = parentMap[c2]
        if (cooldownPrimaries.has(c1)) continue
        if (phase === 0 && usedPrimaries.has(c1)) continue
        out.push(c2)
        seen.add(c2)
        usedPrimaries.add(c1)
        if (out.length >= maxClusters) break
      }
      if (out.length >= maxClusters) break
    }
  }
  return out
}


// ---------------------------------------------------------------------------
// Trinity-LT — Algorithm 2.
// ---------------------------------------------------------------------------

export function trinityLT(h2, clusterStateMap, articleCountsBySecondary, rng = Math.random, opts = {}) {
  // Optional: exclude clusters Trinity-M already chose so the two retrievers
  // cover different ground. v3 adds soft-exclude: if hard-exclude leaves
  // fewer than N_LT/2 eligible clusters, drop the exclusion and let LT
  // pick anyway.
  const excludeSet = opts.excludeClusters instanceof Set
    ? opts.excludeClusters
    : new Set(opts.excludeClusters || [])
  // v5. Cooldown primaries (Not Interested) — soft-exclude their secondaries.
  const cooldownPrimaries = opts.cooldownPrimaries instanceof Set
    ? opts.cooldownPrimaries
    : new Set(opts.cooldownPrimaries || [])
  const parentMap = opts.parentMap || null
  const isCooldown = (c2) => {
    if (cooldownPrimaries.size === 0 || !parentMap) return false
    const c1 = parentMap[c2]
    return c1 != null && cooldownPrimaries.has(c1)
  }
  const softExcludeFloor = Math.max(1, Math.ceil(N_LT / 2))

  function buildPool(useExcludes) {
    const ranked = []
    for (const [c2, state] of clusterStateMap.entries()) {
      if (c2 < 0 || c2 >= K_SECONDARY) continue
      if (useExcludes && excludeSet.has(c2)) continue
      if (isCooldown(c2)) continue
      const inv = articleCountsBySecondary[c2] || 0
      if (inv < T_I) continue
      ranked.push([c2, state.b_score])
    }
    for (let c2 = 0; c2 < K_SECONDARY; c2++) {
      if (useExcludes && excludeSet.has(c2)) continue
      if (isCooldown(c2)) continue
      if (!clusterStateMap.has(c2) && (articleCountsBySecondary[c2] || 0) >= T_I) {
        ranked.push([c2, Number.MAX_SAFE_INTEGER])
      }
    }
    ranked.sort((a, b) => b[1] - a[1])
    const longtail = ranked.slice(0, N_C).map(r => r[0])
    return longtail.filter(c2 => h2[c2] >= T_L)
  }

  let eligible = buildPool(true)
  if (eligible.length < softExcludeFloor && excludeSet.size > 0) {
    // Soft fallback: drop the exclusion when hard exclusion leaves us starved.
    eligible = buildPool(false)
  }
  if (eligible.length === 0) return []

  const weights = eligible.map(c2 => Math.pow(LT_BETA + h2[c2], LT_ALPHA))
  return weightedSampleWithoutReplacement(eligible, weights, Math.min(N_LT, eligible.length), rng)
}


// ---------------------------------------------------------------------------
// v3-C. Thompson Sampling exploration arm.
// ---------------------------------------------------------------------------
//
// Picks `nSlots` cluster ids the user has h² == 0 in (genuinely unexplored),
// scoring each with a Beta(α=1+engages, β=1+skips) sample drawn from the
// cluster_state explore_engages / explore_shows columns. This is the standard
// Thompson Sampling policy for multi-armed bandits — provably no-regret in
// expectation (Russo et al., "A Tutorial on Thompson Sampling," 2018).
//
// Why h²==0 specifically: clusters where the user has h²>=1 are already
// addressed by Trinity-LT. The explore arm fills the gap of "clusters this
// user has never engaged with at all."
//
// Phoenix Phase 2.B (2026-05-08): same-tag-today penalty. If `parentMap` and
// `todaysPrimaryCounts` are provided, subtract SAME_TAG_TODAY_PENALTY × count
// from each cluster's Beta sample before sorting. Confirmed TikTok mechanism
// from the Algo 101 leak — prevents the strongest primary from dominating
// the explore arm's picks within a session.

// 2026-05-14 — Fix E: explore arm subtracts seconds-fresh fast-skip signal
// from each cluster's Beta sample. The prior behavior consulted only the
// 60-day `avoidClusters` aggregate (≥ 8 impressions + < 12% engage), which
// can't react within a session. ENF (arxiv:2511.18700) and Kuaishou WTG
// (arxiv:2308.13249) both describe seconds-fresh negative-signal flow:
// when the user fast-skips, the cluster/author/primary skip counters bump
// immediately (track.js fires bump_user_negative_dim within ~50ms), and
// the NEXT request's retrieval/explore picks see the updated counts.
// Penalty caps at NEG_DIM_PENALTY_CAP so a single hot-skip session can't
// drive a cluster permanently negative.
export const NEG_DIM_PENALTY_PER_CLUSTER_SKIP = 0.05
export const NEG_DIM_PENALTY_PER_PRIMARY_SKIP = 0.03
export const NEG_DIM_PENALTY_CAP              = 0.50

export function exploreArm(h2, clusterStateMap, articleCountsBySecondary, nSlots, rng = Math.random, opts = {}) {
  if (nSlots <= 0) return []
  const parentMap = opts.parentMap || null
  const todaysCounts = opts.todaysPrimaryCounts instanceof Map ? opts.todaysPrimaryCounts : null
  const lambda = Number.isFinite(opts.sameTagPenalty) ? opts.sameTagPenalty : SAME_TAG_TODAY_PENALTY
  // Phoenix Phase 4.F (2026-05-09): per-cluster avoid set. Skip secondary
  // clusters where the user has been impressed >=8 times with engage rate
  // <12% in last 60 days. These are sub-category negatives (basketball
  // within Sports, Iran-war within World) the user has actively rejected.
  // The Thompson Sampling Beta posterior uses GLOBAL cluster_state stats
  // and can't see this per-user signal, so the explore arm would otherwise
  // keep sampling these clusters because OTHER users engaged with them.
  const avoidClusters = opts.avoidClusters instanceof Set ? opts.avoidClusters : null
  // 2026-05-14 — seconds-fresh negative-dimension penalty (Fix E).
  // Expected shape: { cluster: Map<string, count>, primary: Map<string, count>, ... }
  // from get_user_negative_dimensions RPC (migrations 094 + 106). Author/source
  // axes are skipped here — the explore arm picks at the cluster level; those
  // signals apply at article retrieval time via the rerank negMult chain.
  const negDims = opts.negativeDimensions || null
  const candidates = []
  for (let c2 = 0; c2 < K_SECONDARY; c2++) {
    if (h2[c2] !== 0) continue                                  // user already touched
    if ((articleCountsBySecondary[c2] || 0) < T_I) continue     // too few articles
    if (avoidClusters && avoidClusters.has(c2)) continue        // user has rejected this cluster
    const state = clusterStateMap.get(c2)
    const a = EXPLORE_BETA_PRIOR_ALPHA + (state?.explore_engages || 0)
    const b = EXPLORE_BETA_PRIOR_BETA  + Math.max(0, (state?.explore_shows || 0) - (state?.explore_engages || 0))
    let score = sampleBeta(a, b, rng)
    // Same-tag-today penalty: reduce score for clusters whose primary is
    // already over-represented in today's served impressions.
    if (parentMap && todaysCounts && lambda > 0) {
      const c1 = parentMap[c2]
      const seenToday = c1 != null ? (todaysCounts.get(c1) || 0) : 0
      if (seenToday > 0) score -= lambda * seenToday
    }
    // Fix E: seconds-fresh fast-skip penalty. Decayed-count from
    // get_user_negative_dimensions: γ=0.95/day, so a 1-day-old skip
    // still counts ~0.95×. Capped so a single hot-skip session can't
    // zero a cluster permanently.
    if (negDims) {
      const clusterSkips = negDims.cluster ? (negDims.cluster.get(String(c2)) || 0) : 0
      let primarySkips = 0
      if (parentMap) {
        const c1 = parentMap[c2]
        if (c1 != null && negDims.primary) {
          primarySkips = negDims.primary.get(String(c1)) || 0
        }
      }
      const rawPenalty = NEG_DIM_PENALTY_PER_CLUSTER_SKIP * clusterSkips
                       + NEG_DIM_PENALTY_PER_PRIMARY_SKIP * primarySkips
      const penalty = Math.min(NEG_DIM_PENALTY_CAP, rawPenalty)
      if (penalty > 0) score -= penalty
    }
    candidates.push([c2, score])
  }
  if (candidates.length === 0) return []
  candidates.sort((x, y) => y[1] - x[1])
  // 2026-05-17 (Wave 5): per-primary cap. Limit each parent primary to
  // MAX_EXPLORE_PER_PRIMARY secondary clusters so the explore bucket can't
  // be dominated by one primary even when Thompson sampling rolls high on
  // its secondaries. Falls back to old behavior (top-N by score) when no
  // parentMap is provided.
  if (parentMap) {
    const seenPerPrimary = new Map()
    const picked = []
    for (const [c2] of candidates) {
      if (picked.length >= nSlots) break
      const c1 = parentMap[c2]
      if (c1 == null) {
        picked.push(c2)
        continue
      }
      const count = seenPerPrimary.get(c1) || 0
      if (count >= MAX_EXPLORE_PER_PRIMARY) continue
      seenPerPrimary.set(c1, count + 1)
      picked.push(c2)
    }
    return picked
  }
  return candidates.slice(0, nSlots).map(p => p[0])
}


// Beta sampling via two Gamma draws (Marsaglia–Tsang for Gamma(α,1)).
// Standard textbook approach; faster than rejection-based Beta.
function sampleBeta(a, b, rng) {
  const x = sampleGamma(a, rng)
  const y = sampleGamma(b, rng)
  if (x + y === 0) return 0.5
  return x / (x + y)
}

function sampleGamma(k, rng) {
  if (k < 1) {
    // Boost: Gamma(k+1, 1) sampling, then scale by U^(1/k)
    const u = Math.max(rng(), 1e-12)
    return sampleGamma(k + 1, rng) * Math.pow(u, 1 / k)
  }
  // Marsaglia–Tsang
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x, v
    do {
      x = sampleNormal(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function sampleNormal(rng) {
  // Box–Muller
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}


// ---------------------------------------------------------------------------
// v3-B. Content-aware recency decay using shelf_life_days.
// ---------------------------------------------------------------------------
//
// Half-life = shelf_life_days * 24 / 2.
// At t = shelf_life_days, weight = 0.25; at t = 0.5 * shelf_life_days, weight = 0.5.
// Replaces the flat 36h half-life that crushed Trinity's older-but-relevant picks.

// PR3 (2026-05-18) — text-social freshness fallbacks. When shelf_life_days
// is NULL/missing on an article (AI pipeline didn't populate it), branch on
// freshness_category before falling through to the generic 3-day default.
// A breaking-news piece is dead in 24h; a feature/evergreen piece can stay
// fresh for 3+ days. The per-row AI-pipeline shelf_life_days value still
// wins when present — this only affects the fallback path.
//
// This is text-social specific. TikTok / X / Instagram public docs don't
// publish per-content-type half-lives because their content lasts longer
// (video can be relevant for months, photo for weeks).
const NEWS_SHELF_LIFE_FALLBACK = {
  breaking: 1,
  news: 2,
}

export function recencyWeightForArticle(article, nowMs = Date.now()) {
  const ageMs = nowMs - new Date(article.created_at || article.published_at || nowMs).getTime()
  const ageH = Math.max(0, ageMs / 3600000)
  let shelfDays
  if (Number.isFinite(article.shelf_life_days) && article.shelf_life_days > 0) {
    shelfDays = article.shelf_life_days
  } else if (article.freshness_category && NEWS_SHELF_LIFE_FALLBACK[article.freshness_category] != null) {
    shelfDays = NEWS_SHELF_LIFE_FALLBACK[article.freshness_category]
  } else {
    shelfDays = DEFAULT_SHELF_LIFE_DAYS
  }
  const halfLifeH = shelfDays * 24 / 2
  const lambda = Math.log(2) / halfLifeH
  return Math.exp(-lambda * ageH)
}


// ---------------------------------------------------------------------------
// EMA update for cluster_state on shown clusters.
// ---------------------------------------------------------------------------

export function emaUpdates(currentStateMap, shownClusterIds, nowMs = Date.now()) {
  const rows = []
  const seen = new Set()
  for (const c2 of shownClusterIds) {
    if (seen.has(c2)) continue
    seen.add(c2)
    const prev = currentStateMap.get(c2)
    const lastMs = prev ? new Date(prev.last_shown_at).getTime() : nowMs
    const gapSec = Math.max(0, (nowMs - lastMs) / 1000)
    const prevB = prev ? prev.b_score : 0
    const newB = (1 - LT_EMA_RATE) * prevB + LT_EMA_RATE * gapSec
    rows.push({
      cluster_id: c2,
      last_shown_at: new Date(nowMs).toISOString(),
      b_score: newB,
      shown_count: (prev?.shown_count || 0) + 1,
      updated_at: new Date(nowMs).toISOString(),
    })
  }
  return rows
}


// ---------------------------------------------------------------------------
// DB loaders.
// ---------------------------------------------------------------------------

export async function loadClusterState(supabase) {
  // v5.1 (audit fix A1, 2026-05-06) — same-shape pagination bug as the
  // vq_centroids one fixed last week. supabase-js defaults to a 1000-row
  // PostgREST cap; cluster_state has up to K_SECONDARY = 2048 rows once
  // the EMA writer warms it. Without explicit pagination the tail rows
  // are silently dropped, and Trinity-LT then treats the missing-state
  // clusters as having Number.MAX_SAFE_INTEGER B-score (lib/trinity.js
  // sampling logic), preferentially picking exactly the wrong arms.
  const map = new Map()
  const PAGE_SIZE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('cluster_state')
      .select('cluster_id, last_shown_at, b_score, shown_count, explore_engages, explore_shows')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('[trinity] loadClusterState failed:', error.message)
      return map
    }
    const page = data || []
    for (const row of page) map.set(row.cluster_id, row)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return map
}


export async function loadActiveCodebook(supabase) {
  // Serving never reads centroids — only parent_map. Centroids live in
  // vq_centroids, read by the Python pipeline at projection time.
  const { data, error } = await supabase
    .from('vq_codebooks')
    .select('id, version, signal_type, parent_map, dim, item_count')
    .eq('is_active', true)
    .order('trained_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[trinity] loadActiveCodebook failed:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  const cb = data[0]
  return {
    id: cb.id,
    version: cb.version,
    signalType: cb.signal_type,
    parentMap: cb.parent_map,
    dim: cb.dim,
    itemCount: cb.item_count,
  }
}


export async function loadArticleCountsBySecondary(supabase) {
  const now = Date.now()
  if (articleCountsCache && (now - articleCountsCache.ts) < ARTICLE_COUNTS_CACHE_TTL_MS) {
    return articleCountsCache.counts
  }
  const counts = new Int32Array(K_SECONDARY)
  const { data, error } = await supabase.rpc('count_articles_by_vq_secondary')
  if (error || !data) {
    console.error('[trinity] count_articles_by_vq_secondary failed:', error?.message)
    return counts
  }
  for (const row of data) {
    const c = row.vq_secondary
    if (c != null && c >= 0 && c < K_SECONDARY) counts[c] = row.cnt
  }
  articleCountsCache = { ts: now, counts }
  return counts
}


// ---------------------------------------------------------------------------
// Per-cluster article retrieval.
// ---------------------------------------------------------------------------

export async function retrieveCandidates(supabase, secondaryClusterIds, opts = {}) {
  const { perClusterLimit = 20, hoursWindow = 7 * 24, excludeIds = [], minScore = 0, userId = null } = opts
  if (!secondaryClusterIds || secondaryClusterIds.length === 0) return []

  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  const tasks = secondaryClusterIds.map(c2 =>
    fetchCluster(supabase, c2, sinceIso, perClusterLimit, excludeIds, minScore, userId)
  )
  const results = await Promise.all(tasks)
  const out = []
  for (let i = 0; i < results.length; i++) {
    const cluster = secondaryClusterIds[i]
    for (const row of results[i]) out.push({ ...row, _vq_cluster: cluster })
  }
  return out
}


// v3-A. Adaptive multi-tier retrieval. Try each tier's hoursWindow in order;
// stop at the first that yields ≥ minPoolSize. The user's interest pool is
// often exhausted at 7d (heavy users see ~95% of last-7d articles in their
// strongest primaries); 14d / 21d windows give 8–35× more candidates without
// reaching back into truly stale content.
export async function retrieveCandidatesAdaptive(supabase, secondaryClusterIds, opts = {}) {
  const {
    perClusterLimit = 20,
    excludeIds = [],
    minScore = 0,
    minPoolSize = 30,
    tiersHours = ADAPTIVE_WINDOW_TIERS_H,
    userId = null,
  } = opts
  if (!secondaryClusterIds || secondaryClusterIds.length === 0) {
    return { pool: [], hoursWindow: tiersHours[0] }
  }
  let pool = []
  let chosenWindow = tiersHours[tiersHours.length - 1]
  for (const hoursWindow of tiersHours) {
    pool = await retrieveCandidates(supabase, secondaryClusterIds, {
      perClusterLimit, hoursWindow, excludeIds, minScore, userId,
    })
    chosenWindow = hoursWindow
    if (pool.length >= minPoolSize) break
  }
  return { pool, hoursWindow: chosenWindow }
}


// Phase 2.1 (2026-05-10). Follow-graph retriever.
//
// Pulls articles authored by publishers the user follows (user_follows table,
// publisher_id → published_articles.author_id). TikTok's followed-creator
// retrieval channel — typically allocated ~10-20% of slate for users with a
// social graph. Source: WebConf 2024 audit of TikTok shows top-personalization-
// quartile users get ~30% of videos from followed creators.
//
// Returns articles with `_retriever = 'trinity-follow'` stamped. Empty array
// when user has no follows. Excludes seen IDs and engagement-completed articles
// (same dedup as the seencount RPCs — passed through `excludeIds`).
//
// Phase 1.1 (2026-05-11). Histogram-fit filter (`onlyPrimaries` opt).
// Without this, a firehose publisher writing ~500 articles/week dominates
// the slate with off-taste content (live audit on test user: 32% of feed
// from a single publisher, mostly primaries the user doesn't engage with).
// When onlyPrimaries is provided, the article query is restricted to that
// primary set — typically the user's top-20 by histogram weight. Caller can
// pass null/undefined to opt out (pre-Phase-1.1 behavior).
export async function retrieveFollowed(supabase, userId, opts = {}) {
  if (!userId) return []
  const {
    hoursWindow = 7 * 24,
    excludeIds = [],
    minScore = 200,
    limit = 30,
    onlyPrimaries = null,
  } = opts

  // 1. Fetch the user's follow set. Cap at 200 to keep the IN clause bounded.
  const { data: follows, error: fErr } = await supabase
    .from('user_follows')
    .select('publisher_id')
    .eq('user_id', userId)
    .limit(200)
  if (fErr) {
    console.error('[trinity] retrieveFollowed user_follows query failed:', fErr.message)
    return []
  }
  const publisherIds = (follows || [])
    .map(r => r.publisher_id)
    .filter(p => p != null)
  if (publisherIds.length === 0) return []

  // 2. Hot fix (2026-05-12, mig 115b): call retrieve_followed_with_seen_dedup
  // RPC instead of a raw .from('published_articles') query. The RPC applies
  // an antijoin against user_feed_impressions — JS-only path used to filter
  // on iOS-supplied excludeIds only, which missed older repeats. Audit
  // found 4-7 repeat follow cards per slate when this RPC didn't exist.
  //
  // 2026-05-12 (mig 117): dedup is now lifetime (default 36500d). TikTok
  // and Instagram never repeat content; for text news the recency penalty
  // already drops old articles out of recall, so there's no upside to a
  // shorter window — only the downside that personal/follow pools starve
  // and the safety net floods follow content (Fix 1).
  const { data, error } = await supabase.rpc('retrieve_followed_with_seen_dedup', {
    p_user_id: userId,
    p_publisher_ids: publisherIds,
    p_only_primaries: Array.isArray(onlyPrimaries) && onlyPrimaries.length > 0 ? onlyPrimaries : null,
    p_hours_window: hoursWindow,
    p_min_score: minScore,
    p_limit: limit,
  })
  if (error) {
    console.error('[trinity] retrieve_followed_with_seen_dedup RPC failed:', error.message)
    return []
  }
  if (!Array.isArray(data)) return []
  // Apply iOS-side excludeIds as a final safety net (covers in-flight
  // concurrent requests where DB hasn't yet committed the prior slate's
  // impressions). Mirrors the post-RPC filter in retrievePersonalizedFresh.
  if (excludeIds && excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds.map(Number))
    return data.filter(a => !excludeSet.has(Number(a.id)))
  }
  return data
}


// v4. Personalized-fresh retriever: last-N-hours articles whose vq_primary is
// in the user's top primaries. Primary scoping is broader than M's secondary
// scoping, so it survives narrow dedup. This is the freshness floor.
// 2026-05-17 — per-primary fan-out. Pre-change behavior was a single global
// RPC call with p_vq_primaries=[all 20 user primaries] and p_limit=120, with
// the RPC sorting by ai_final_score descending across primaries. Heavy news
// supply in one primary (e.g. primary 62, 78 fresh articles scoring 820-940
// during the Trump-Beijing summit) crowded out lower-volume primaries
// entirely. Audit Session B slate 1 had ZERO cards from user's top primary
// 39 (27 fresh articles, top score 810).
//
// New behavior: fire one RPC per primary, each requesting top-K per primary,
// then merge + dedup by id in JS. Each user-interest primary gets
// representation in the candidate pool regardless of supply imbalance.
//
// Source: TikTok Trinity (KDD 2024, arxiv:2402.02842) Algorithm 1 — one
// secondary cluster per primary, hard per-primary fairness at retrieval.
// Pinterest PinnerSage (KDD 2020) — importance-balanced cluster sampling.
//
// Cost: N parallel HTTP RPCs vs 1. With N ≈ 20 and Supabase's connection
// pool, total wall time is roughly the slowest single RPC (~50-100ms),
// not 20× slower. The existing retrievePersonalPerPrimary uses the same
// pattern in production.
export async function retrievePersonalizedFresh(supabase, primaryClusterIds, opts = {}) {
  const {
    hoursWindow = FRESH_WINDOW_H,
    excludeIds = [],
    minScore = FRESH_MIN_SCORE,
    limit = 60,
    userId = null,
  } = opts
  if (!primaryClusterIds || primaryClusterIds.length === 0) return []
  // Per-primary fan-out path (warm users with RPC).
  if (userId) {
    const N = primaryClusterIds.length
    // Per-primary cap: aim for the same pool size as before (limit * 2 = 120
    // by default) but spread evenly. Floor at 2 so single-card primaries
    // still contribute.
    const perPrimaryLimit = Math.max(2, Math.ceil((limit * 2) / N))
    const calls = primaryClusterIds.map(p =>
      supabase.rpc('trinity_fetch_fresh_with_seencount', {
        p_user_id: userId,
        p_vq_primaries: [p],
        p_hours_window: hoursWindow,
        p_min_score: minScore,
        p_limit: perPrimaryLimit,
      })
    )
    const results = await Promise.all(calls)
    const excludeSet = excludeIds && excludeIds.length > 0
      ? new Set(excludeIds.map(Number))
      : null
    const seenIds = new Set()
    const merged = []
    let rpcErrors = 0
    for (let i = 0; i < results.length; i++) {
      const { data, error } = results[i]
      if (error) {
        rpcErrors += 1
        console.error(
          `[trinity] retrievePersonalizedFresh RPC failed for primary=${primaryClusterIds[i]}:`,
          error.message
        )
        continue
      }
      if (!Array.isArray(data)) continue
      for (const row of data) {
        if (!row || row.id == null) continue
        const idNum = Number(row.id)
        if (seenIds.has(idNum)) continue
        if (excludeSet && excludeSet.has(idNum)) continue
        seenIds.add(idNum)
        merged.push(row)
      }
    }
    if (rpcErrors > 0 && merged.length === 0) {
      console.error(`[trinity] retrievePersonalizedFresh: all ${N} RPC calls failed; falling back to legacy path`)
      // Fall through to legacy path below.
    } else {
      return merged
    }
  }
  const sinceIso = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString()
  let q = supabase
    .from('published_articles')
    // JSONB component columns (details/timeline/graph/map/five_ws) +
    // components/topics/countries/relevance/cluster_id added so the
    // Trinity slate ships the same shape as v11's ARTICLE_COLUMNS —
    // formatArticle() and the iOS Article model both expect them.
    // Without these the iOS feed card has no data for its info boxes.
    // Sister site: lib/trinityServe.js retrieveTrending has the same
    // fix.
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, components, details, timeline, graph, map, five_ws, countries, topics, interest_tags, country_relevance, topic_relevance, cluster_id, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .in('vq_primary', primaryClusterIds)
    .gte('created_at', sinceIso)
    .gte('ai_final_score', minScore)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error('[trinity] retrievePersonalizedFresh failed:', error.message)
    return []
  }
  return data || []
}


// P2 fix (2026-05-12). Trinity multi-vector personal retriever.
//
// Replaces the broken `trinity-m-tier1` / `trinity-m-tier2` pools that
// consistently returned 0 articles on the live test user. For each of the
// user's top-N primary clusters (default 10 — Trinity's N_M), build a
// per-primary user vector (recency-weighted mean of engaged-article
// embeddings from the engagement buffer) and run pgvector cosine ANN against
// fresh articles within that primary.
//
// Sources:
//   - Trinity (KDD 2024, arxiv:2402.02842) — N_M=10 top primaries +
//     engagement-filtered behavior buffer.
//   - PinnerSage (KDD 2020, arxiv:2007.03634) — per-cluster recency-weighted
//     user vector with λ=0.01/day.
//   - X open-source `the-algorithm` — ANN candidate stage in retrieval.
//
// Locked params (spec section 3.2):
//   - Top-N primaries: 10
//   - Buffer size: 1000 (scaled down from Trinity's 2500 for text feeds)
//   - Per-primary cap: soft 200
//   - λ: 0.01/day
//   - Per-primary ANN: top 20 candidates
//
// Returns flat array of candidate articles (no _retriever stamp — caller
// stamps the pool name on the merged result).
export async function retrievePersonalPerPrimary(supabase, userId, primaries, opts = {}) {
  if (!userId) return []
  if (!Array.isArray(primaries) || primaries.length === 0) return []

  const {
    // 2026-05-19 — default raised from 48 to FRESH_WINDOW_H (timeless).
    // Recency decay multiplier handles age; no hard cap needed.
    hoursWindow = FRESH_WINDOW_H,
    minScore = 200,
    perPrimaryLimit = 20,
    // 2026-05-18 — weight-proportional per-primary allocation. When
    // provided, overrides perPrimaryLimit on a per-primary basis. Primaries
    // not in the map fall through to perPrimaryLimit. Built upstream via
    // allocatePerPrimaryBudgets(h1, primaries, { totalBudget, ... }).
    perPrimaryLimitMap = null,
    excludeIds = [],
    getPrimaryUserVectors,   // injectable for tests; default below
    formatVectorForPg,        // injectable for tests; default below
  } = opts

  // Lazy import so the module-level cache stays in personalVectors.js and
  // we don't introduce a static cross-file import cycle. The dynamic import
  // is cached by Node after first call (no perf hit per request).
  let getVecs = getPrimaryUserVectors
  let fmtVec = formatVectorForPg
  if (!getVecs || !fmtVec) {
    const pv = await import('./personalVectors.js')
    getVecs = getVecs || pv.getPrimaryUserVectors
    fmtVec = fmtVec || pv.formatVectorForPg
  }

  const { vectorsByPrimary, bufferSize, cacheHit } = await getVecs(supabase, userId, primaries)

  // Empty buffer → no personal signal yet. Caller falls back to fresh pool.
  if (vectorsByPrimary.size === 0) {
    return []
  }

  // Build the ANN call list: one parallel RPC per primary that has a vector.
  // Primaries without a vector (zero engagement in that primary) are skipped
  // silently — they'll get coverage from the fresh pool / explore arm.
  const excludeArray = Array.isArray(excludeIds) && excludeIds.length > 0
    ? excludeIds.map(id => Number(id)).filter(n => Number.isFinite(n))
    : null

  const calls = []
  const primariesCalled = []
  const perPrimaryLimits = []  // observability: log the actual limits used
  for (const p of primaries) {
    const vec = vectorsByPrimary.get(Number(p))
    if (!vec) continue
    const vecLit = fmtVec(vec)
    if (!vecLit) continue
    primariesCalled.push(Number(p))
    // 2026-05-18 — weight-proportional limit when caller passed a budget map.
    // Falls through to legacy uniform perPrimaryLimit when no map provided
    // (preserves test stubs + cold-user path).
    const limitForPrimary = (perPrimaryLimitMap && perPrimaryLimitMap.get(Number(p)) != null)
      ? Number(perPrimaryLimitMap.get(Number(p)))
      : perPrimaryLimit
    perPrimaryLimits.push(limitForPrimary)
    calls.push(
      // Hot fix (2026-05-12, mig 115): pass p_user_id so the RPC can apply
      // the seen-history antijoin against user_feed_impressions.
      //
      // 2026-05-19 (PR8) — explicitly pass p_dedup_days: 7 to match
      // Twitter/X's open-source `ImpressionBloomFilterModule.scala`
      // `DefaultTTL = 7.days`. The RPC's default is 2 days, but a heavy
      // user opens the app daily and burns through the 2-day window in one
      // session — articles got re-served 4-5 times. 7 days is the only
      // peer-verified industry value for re-serve cooldown.
      supabase.rpc('articles_ann_in_primary', {
        p_user_id: userId,
        p_user_vec: vecLit,
        p_vq_primary: Number(p),
        p_exclude_ids: excludeArray,
        p_hours_window: hoursWindow,
        p_min_score: minScore,
        p_limit: limitForPrimary,
        p_dedup_days: 7,
      })
    )
  }

  if (calls.length === 0) return []

  const results = await Promise.all(calls)

  // Merge + dedup by id. Stamp ann_similarity onto each item so the heavy
  // ranker can read it as a feature later (and so the audit query can see
  // how well the per-primary vector matched the candidate set).
  const seen = new Set()
  const out = []
  for (let i = 0; i < results.length; i++) {
    const { data, error } = results[i]
    if (error) {
      console.error(
        `[trinity.personal] articles_ann_in_primary failed for primary=${primariesCalled[i]}:`,
        error.message
      )
      continue
    }
    if (!Array.isArray(data)) continue
    for (const row of data) {
      const id = row?.id
      if (id == null || seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
  }

  // Observability — single log line per request, mirrors [trinity.histogram]
  // / [trinity.ranker] format. Includes cache state so we can confirm the
  // 5-min LRU is working in prod. The 2026-05-18 weight-proportional rollout
  // also logs the per-primary budget distribution (top-5) so PR1 deploy can
  // be verified live: top primary should get ≥3× the median primary's limit.
  let allocSummary = ''
  if (perPrimaryLimitMap) {
    const sorted = perPrimaryLimits.slice().sort((a, b) => b - a)
    const top = sorted.slice(0, 5).join(',')
    const sumAlloc = perPrimaryLimits.reduce((s, v) => s + v, 0)
    allocSummary = ` alloc=[${top}] sum=${sumAlloc}`
  } else {
    allocSummary = ` alloc=uniform${perPrimaryLimit}`
  }
  console.log(
    `[trinity.personal] user=${userId.slice(0, 8)} ` +
    `primariesIn=${primaries.length} primariesWithVec=${primariesCalled.length} ` +
    `candidates=${out.length} bufferSize=${bufferSize} cache=${cacheHit ? 'hit' : 'miss'}` +
    allocSummary
  )

  return out
}


// v4. Top-N primary clusters by user's h¹. Used to scope trinity-fresh.
export function topPrimariesFromHistogram(h1, n) {
  const indexed = []
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] > 0) indexed.push([i, h1[i]])
  }
  indexed.sort((a, b) => b[1] - a[1])
  return indexed.slice(0, n).map(p => p[0])
}

// 2026-05-12 — Paper-correct Trinity-M primary selection.
//
// The KDD 2024 Trinity paper (arxiv:2402.02842) Algorithm 1 does NOT cap
// the personal retriever at a fixed rank. It includes every primary whose
// histogram count exceeds the threshold Tp (paper-exact 30, adaptively
// lowered for users with thin histories). Our previous N_M=10 hard cap was
// a misreading of the paper — N_M is the OUTPUT size (one candidate per
// primary per query), not the INPUT primary count.
//
// For light users: ~3-5 primaries qualify (cold-start path handles them).
// For heavy users: 25-40 primaries qualify (was 10 — left ~487 unseen
// quality articles in primaries 11-30 invisible to the algorithm).
//
// Pinterest's PinnerSage (KDD 2020) uses the same "no fixed cap" principle:
// stores 3-100 clusters per user, samples 3 per request weighted by
// importance. Our Trinity stack samples deterministically by threshold.
//
// The `maxCap` argument is a safety ceiling against pathological users
// (would bound ANN query count and latency); the paper has no such cap.
export function primariesAboveThreshold(h1, threshold, maxCap = 50) {
  const indexed = []
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] >= threshold) indexed.push([i, h1[i]])
  }
  indexed.sort((a, b) => b[1] - a[1])
  return indexed.slice(0, maxCap).map(p => p[0])
}


// 2026-05-18 — weight-proportional per-primary budget allocation.
//
// Trinity paper (arxiv:2402.02842) Algorithm 2 specifies retrieval sampling
// proportional to histogram weight: `w_c = (β + h²[c])^α`. Pinterest's
// PinnerSage (arxiv:2007.03634 §3.3) samples user clusters by importance
// score (λ=0.01/day recency-weighted engagement). X SimClusters affinity
// weighting follows the same pattern.
//
// Today (pre-2026-05-18) we did uniform allocation: every qualifying primary
// got exactly perPrimaryLimit=20 candidates regardless of h1 weight. Heavy
// user audit (5082a1df) showed Tech rank-1 (h1=2133) and China rank-7
// (h1=552) both contributing 20 articles, so when a strong news cycle hit
// China, score-chain suppression of rank-7 simply revealed the next weakest
// topic instead of more Tech.
//
// This helper outputs a Map<primary, candidateLimit> with sum ≈ totalBudget.
// Primaries with zero h1 weight get the floor. Primaries that would exceed
// the cap are clamped, and the residual is redistributed to the highest-h1
// primaries below cap. Net effect: top-h1 primary gets ≥3× the slots of the
// median primary on typical heavy users.
export function allocatePerPrimaryBudgets(h1, primaries, opts = {}) {
  const {
    totalBudget = 90,
    perPrimaryFloor = 2,
    perPrimaryCap = 40,
  } = opts
  const out = new Map()
  if (!Array.isArray(primaries) || primaries.length === 0) return out

  const N = primaries.length
  const minTotal = N * perPrimaryFloor

  // Pathological: totalBudget can't satisfy floors. Distribute what we have
  // evenly. Callers shouldn't hit this in practice (N ≤ 50, totalBudget ≥ 60).
  if (totalBudget < minTotal) {
    const each = Math.max(1, Math.floor(totalBudget / N))
    for (const p of primaries) out.set(Number(p), Math.min(each, perPrimaryCap))
    return out
  }

  // Sum h1 across qualifying primaries. If sum is zero (cold user, all-zero
  // histogram), fall back to uniform allocation at floor.
  let sumW = 0
  for (const p of primaries) {
    const w = (h1 && Number.isFinite(h1[Number(p)])) ? h1[Number(p)] : 0
    if (w > 0) sumW += w
  }
  if (sumW <= 0) {
    const each = Math.max(perPrimaryFloor, Math.min(perPrimaryCap, Math.floor(totalBudget / N)))
    for (const p of primaries) out.set(Number(p), each)
    return out
  }

  // Allocate proportionally, clamp to [floor, cap].
  const rows = []
  let used = 0
  for (const p of primaries) {
    const pid = Number(p)
    const w = (h1 && Number.isFinite(h1[pid])) ? Math.max(0, h1[pid]) : 0
    let raw = Math.round((totalBudget * w) / sumW)
    raw = Math.max(perPrimaryFloor, Math.min(perPrimaryCap, raw))
    rows.push({ pid, w, alloc: raw })
    used += raw
  }

  // Rebalance residual so sum(out) === totalBudget exactly. If we overshot
  // (residual<0), trim from lowest-h1 primaries that are above floor. If we
  // undershot (residual>0), pad highest-h1 primaries that are below cap.
  let residual = totalBudget - used
  if (residual > 0) {
    const sorted = rows.slice().sort((a, b) => b.w - a.w)
    while (residual > 0) {
      let progressed = false
      for (const r of sorted) {
        if (r.alloc < perPrimaryCap) {
          r.alloc += 1
          residual -= 1
          progressed = true
          if (residual === 0) break
        }
      }
      if (!progressed) break  // all at cap
    }
  } else if (residual < 0) {
    const sorted = rows.slice().sort((a, b) => a.w - b.w)
    while (residual < 0) {
      let progressed = false
      for (const r of sorted) {
        if (r.alloc > perPrimaryFloor) {
          r.alloc -= 1
          residual += 1
          progressed = true
          if (residual === 0) break
        }
      }
      if (!progressed) break  // all at floor
    }
  }

  for (const r of rows) out.set(r.pid, r.alloc)
  return out
}


// v5. Split user's primary histogram into three interest tiers.
// Trinity (KDD 2024) describes parallel multi-, long-tail-, and long-term-
// retrievers, each with its own slot budget — NOT a single rerank-sort.
// Top-3 primaries are short-term (most-engaged); ranks 4-10 are mid-term
// (real but secondary interests); everything else falls to long-tail/explore.
//   tier1: top-3 primaries by h¹
//   tier2: ranks 4 through 10 by h¹
// The third tier ("long-tail/explore") is implicit — it's whatever the
// existing trinityLT + exploreArm produce; this function returns only the
// first two tiers since they need explicit primary lists.
export function getInterestTiers(h1, opts = {}) {
  const topN = opts.topN ?? TIER1_TOP_PRIMARIES
  const midStart = opts.midStart ?? TIER2_RANK_START
  const midEnd = opts.midEnd ?? TIER2_RANK_END
  const indexed = []
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] > 0) indexed.push([i, h1[i]])
  }
  indexed.sort((a, b) => b[1] - a[1])
  return {
    tier1: indexed.slice(0, topN).map(p => p[0]),
    tier2: indexed.slice(midStart, midEnd).map(p => p[0]),
  }
}


// v5 + Phoenix Phase 1.3 (2026-05-08).
// Compose a feed slate from k retriever pools using fixed slot budgets.
// Round-robin across pools so each retriever's allocation is honored even
// when one pool's items would have outranked the others on raw score.
//
// pools: Array<{ name, items, budget, hardCap? }>
//   - items must be pre-ranked descending (caller does rerank per pool)
//   - budget = slots reserved for this pool
//   - hardCap = if true, this pool will never exceed its budget even
//     during backfill. Use for `explore` so empty personalized pools
//     don't silently turn into a 90% explore feed.
//   - sum of budgets must equal slateSize (caller enforces)
//
// Phoenix backfill priority order (when out.length < slateSize):
//   1. Pools without hardCap, in declared order (personalized first)
//   2. Pools with hardCap stay at their budget — never spilled into
//   3. Caller is expected to provide a trending_fallback pool (budget=0)
//      with hardCap=false so backfill can pull from it last.
//
// Logs a structured warning whenever any pool returns under-budget.
// Returns array of items in slate order. Each item gets `_retrieverTier`.
export function composeWithBudgets(pools, slateSize) {
  if (!Array.isArray(pools) || pools.length === 0) return []
  const cursors = pools.map(() => 0)
  const remaining = pools.map(p => Math.max(0, p.budget))
  const filled = pools.map(() => 0)
  const seenIds = new Set()
  const out = []

  // Round-robin pass: each pool donates one item per cycle until budget runs
  // out or its pool is empty. Pools with smaller budgets finish first; the
  // remaining pools keep contributing.
  let progress = true
  while (progress && out.length < slateSize) {
    progress = false
    for (let i = 0; i < pools.length; i++) {
      if (out.length >= slateSize) break
      if (remaining[i] <= 0) continue
      const pool = pools[i]
      while (cursors[i] < pool.items.length) {
        const item = pool.items[cursors[i]]
        cursors[i] += 1
        if (item == null || item.id == null) continue
        if (seenIds.has(item.id)) continue
        seenIds.add(item.id)
        out.push({ ...item, _retrieverTier: pool.name })
        remaining[i] -= 1
        filled[i] += 1
        progress = true
        break
      }
    }
  }

  // P1+P3 fix (2026-05-11): diversity-discounted greedy backfill.
  //
  // Source: X open-source AuthorDiversityDiscountProvider.scala — the formula
  // `score *= (1 - Floor) * Decay^prior_count + Floor` with Decay=0.5,
  // Floor=0.25. Applied across THREE axes during overflow pick:
  //   * pool          — fixes P1 (follow over-firing at 45%)
  //   * vq_primary    — fixes P3 (one topic dominating, e.g. Iran 33%)
  //   * source (pub.) — soft alternative to the hard publisher cap below
  //
  // Each pick discounts itself by what's ALREADY in the slate (round-robin
  // items count). The next-best discounted score wins the next slot. After 2
  // items from same pool, the 3rd is at 0.625× score; 4th at 0.44×; floor
  // 0.25×. Same shape per primary cluster.
  //
  // hardCap pools (explore) still respect their budget — backfill never
  // pulls from them. Round-robin minimums above are honored before this
  // step runs.
  if (out.length < slateSize) {
    const overflowByPool = pools.map((p, i) => {
      if (p.hardCap) return []
      const items = []
      for (let j = cursors[i]; j < p.items.length; j++) {
        const it = p.items[j]
        if (it != null && it.id != null && !seenIds.has(it.id)) {
          items.push(it)
        }
      }
      return items
    })

    // Axis counts seeded from round-robin output so backfill respects what's
    // already in the slate.
    // P5 fix (2026-05-12): added `story` axis (embedding-cluster id stamped
    // upstream by assignStoryClusters). Catches Iran-war sprawl across
    // primaries — same news event in different vq_primary clusters all hash
    // to the same _storyClusterId.
    const poolCounts = new Map()         // pool name → count in slate
    const primaryCounts = new Map()      // vq_primary → count in slate
    const sourceCounts = new Map()       // source (lowercased) → count in slate
    const storyCounts = new Map()        // _storyClusterId → count in slate
    for (const it of out) {
      const poolKey = it._retrieverTier
      if (poolKey) poolCounts.set(poolKey, (poolCounts.get(poolKey) || 0) + 1)
      if (it.vq_primary != null) {
        primaryCounts.set(it.vq_primary, (primaryCounts.get(it.vq_primary) || 0) + 1)
      }
      const src = typeof it.source === 'string' ? it.source.toLowerCase() : null
      if (src) sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1)
      const story = it._storyClusterId
      if (story != null) storyCounts.set(story, (storyCounts.get(story) || 0) + 1)
    }

    // Greedy pick: at each step, compute the discount-adjusted score for
    // every remaining overflow item and pick the global max.
    while (out.length < slateSize) {
      let bestAdjusted = -Infinity
      let bestPoolIdx = -1
      let bestItemIdx = -1
      for (let i = 0; i < pools.length; i++) {
        const items = overflowByPool[i]
        if (!items.length) continue
        const poolName = pools[i].name
        const poolPrior = poolCounts.get(poolName) || 0
        const poolMult = (1 - DIV_FLOOR) * Math.pow(DIV_DECAY, poolPrior) + DIV_FLOOR
        for (let j = 0; j < items.length; j++) {
          const it = items[j]
          const primaryPrior = it.vq_primary != null ? (primaryCounts.get(it.vq_primary) || 0) : 0
          const primaryMult = (1 - DIV_FLOOR) * Math.pow(DIV_DECAY, primaryPrior) + DIV_FLOOR
          const src = typeof it.source === 'string' ? it.source.toLowerCase() : null
          const sourcePrior = src ? (sourceCounts.get(src) || 0) : 0
          const sourceMult = (1 - DIV_FLOOR) * Math.pow(DIV_DECAY, sourcePrior) + DIV_FLOOR
          const storyPrior = it._storyClusterId != null ? (storyCounts.get(it._storyClusterId) || 0) : 0
          const storyMult = (1 - DIV_FLOOR) * Math.pow(DIV_DECAY, storyPrior) + DIV_FLOOR
          const adjusted = (it._score || 0) * poolMult * primaryMult * sourceMult * storyMult
          if (adjusted > bestAdjusted) {
            bestAdjusted = adjusted
            bestPoolIdx = i
            bestItemIdx = j
          }
        }
      }
      if (bestPoolIdx < 0) break
      const pick = overflowByPool[bestPoolIdx].splice(bestItemIdx, 1)[0]
      seenIds.add(pick.id)
      out.push({ ...pick, _retrieverTier: pools[bestPoolIdx].name })
      filled[bestPoolIdx] += 1
      // Update axis counts for the next iteration.
      const poolName = pools[bestPoolIdx].name
      poolCounts.set(poolName, (poolCounts.get(poolName) || 0) + 1)
      if (pick.vq_primary != null) {
        primaryCounts.set(pick.vq_primary, (primaryCounts.get(pick.vq_primary) || 0) + 1)
      }
      const src = typeof pick.source === 'string' ? pick.source.toLowerCase() : null
      if (src) sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1)
      const pickStory = pick._storyClusterId
      if (pickStory != null) storyCounts.set(pickStory, (storyCounts.get(pickStory) || 0) + 1)
    }
  }

  // Structured under-budget warnings — surfaces silent pool failures.
  for (let i = 0; i < pools.length; i++) {
    const p = pools[i]
    if (p.budget > 0 && filled[i] < p.budget) {
      console.warn(`[trinity.compose] pool=${p.name} budget=${p.budget} filled=${filled[i]} deficit=${p.budget - filled[i]}`)
    }
  }
  if (out.length < slateSize) {
    console.warn(`[trinity.compose] slate underfilled: got ${out.length} of ${slateSize}`)
  }

  return out
}


// P5 fix (2026-05-12). assignStoryClusters.
//
// Online single-linkage clustering on `embedding_minilm_vec` to assign each
// candidate a `_storyClusterId`. Story-level deduplication that the per-
// vq_primary axis can't catch: a news event (e.g. Iran-war) spawns articles
// across 5+ primaries (Politics, Oil, Europe, ME, Trade) but their semantic
// embeddings cluster tight (cosine 0.55-0.80).
//
// Source: Google News / Apple News story-clustering pattern. Lieberman 2010,
// BERT update 2019. X's open-source `the-algorithm` does an equivalent
// content-embedding diversity stage. TikTok / Pinterest / Instagram /
// Kuaishou all cluster on embeddings (NOT human-tagged topic categories) per
// their public papers and audits.
//
// Cost: ~O(N × C) cosines where N=candidate count, C=#clusters. For
// N=200, C<=N/3≈70 typical, dim=384: <600k float multiplies, ~5-10ms.
//
// Mutates `items[i]._storyClusterId` in-place. Items without an embedding
// get their own unique cluster (treated as "always diverse" — defensive).
//
// 2026-05-13 (post-PR #162 audit): lowered 0.55 → 0.52. Audit showed 4 cards
// about the same Trump-China-Beijing trade visit in one slate, scoring
// 0.50-0.55 cosine to each other. They wrote different angles (Europe impact /
// China framing / arrival news / business angle) so all fell just below the
// 0.55 threshold — system treated them as different stories. 0.52 catches
// this "same event, different framing" case while still permitting genuinely
// distinct stories on related topics.
export const STORY_CLUSTER_THRESHOLD = 0.52

function _cosineSim384(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i]
    dot += ai * bi
    na += ai * ai
    nb += bi * bi
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function _parseEmbeddingForCluster(value) {
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

// 2026-05-17 (Wave 4). After assignStoryClusters has stamped current
// candidates with _storyClusterId, this helper classifies an array of
// PAST impression embeddings into the same cluster space. Returns a
// Map<storyClusterId, count> usable as `opts.recentClusterCounts` for
// applyDiversityDiscount cross-slate seeding.
//
// Past embeddings that don't match any current cluster (cosine < threshold
// against every current centroid) are ignored — those are old stories the
// user saw that aren't represented in the current candidate set, so there's
// nothing for them to decay.
//
// Centroids are reconstructed from the items[] array by reading the first
// item per _storyClusterId. This is non-invasive — assignStoryClusters
// keeps its existing signature; the cross-slate logic lives here.
//
// Source pattern: twitter/the-algorithm
// ImpressedImageClusterBasedListwiseRescoringProvider.scala — counts of
// impressed clusters in a rolling buffer, used to apply (1-decay)^count
// to candidates that share each cluster. We do the equivalent for story
// clusters identified by JS-side embedding similarity.
// 2026-05-17 (Wave 9). computeSkipPenalty — embedding-based skip memory.
// 2026-05-17 (Wave 10). Now accepts WEIGHTED entries (see below).
//
// For one candidate, sum the weights of all "skip neighbors" (skip-history
// items whose embedding cosine ≥ threshold to the candidate). Return
// multiplier = decay^totalWeight (default 0.5^totalWeight).
//
// Each skipEntries item can be either:
//   • Raw embedding (array or JSON string) — back-compat with Wave 9 callers,
//     treated as full weight 1.0.
//   • { embedding, weight } — Wave 10 form. weight ∈ [0, 1], so partial
//     evidence (e.g. a 4-second view of a 10-second article — short-glance
//     dismissal) counts as a half-skip with weight 0.5.
//
// Why weighted: the user's rule, applied uniformly:
//   dwell < 3s    → strong skip (weight 1.0)
//   ratio < 20%   → strong skip (weight 1.0)
//   ratio 20-50%  → soft skip   (weight 0.5)
//   ratio ≥ 50%   → not a skip  (excluded from input)
//
// This matches the migration 124 histogram-weight bands, applied to skip
// memory. Pattern: TikTok/Kuaishou WTG read-ratio thresholds.
//
// Cost: O(N × 384) cosine multiplies where N = skip-history count. With
// N=200 and dim=384, ~77k float multiplies per candidate. At slate compose
// time we have up to ~250 candidates → ~19M ops. Fast (<50ms).
export function computeSkipPenalty(candidateEmbedding, skipEntries, opts = {}) {
  if (!Array.isArray(skipEntries) || skipEntries.length === 0) return 1.0
  const candEmb = _parseEmbeddingForCluster(candidateEmbedding)
  if (!candEmb) return 1.0
  const threshold = opts.threshold ?? SKIP_PENALTY_THRESHOLD
  const decay = opts.decay ?? SKIP_PENALTY_DECAY
  let totalWeight = 0
  for (const entry of skipEntries) {
    // Back-compat: raw embedding (not an object with `embedding` key) → weight 1.0.
    const isObj = entry != null && typeof entry === 'object' && !Array.isArray(entry) && 'embedding' in entry
    const raw = isObj ? entry.embedding : entry
    const weight = isObj ? (Number.isFinite(entry.weight) ? entry.weight : 1.0) : 1.0
    if (weight <= 0) continue
    const skipEmb = _parseEmbeddingForCluster(raw)
    if (!skipEmb) continue
    if (_cosineSim384(candEmb, skipEmb) >= threshold) totalWeight += weight
  }
  return Math.pow(decay, totalWeight)
}


export function classifyPastEmbeddingsToClusters(items, pastEmbeddings, threshold = STORY_CLUSTER_THRESHOLD) {
  if (!Array.isArray(items) || items.length === 0) return new Map()
  if (!Array.isArray(pastEmbeddings) || pastEmbeddings.length === 0) return new Map()

  // Reconstruct cluster centroids: for each non-solo _storyClusterId, the
  // first item carrying that id supplies the centroid embedding (matches
  // assignStoryClusters' single-link convention).
  const centroidsByCluster = new Map()
  for (const it of items) {
    if (!it || !it._storyClusterId) continue
    if (it._storyClusterId.startsWith('solo_')) continue
    if (centroidsByCluster.has(it._storyClusterId)) continue
    const emb = _parseEmbeddingForCluster(it.embedding_minilm_vec)
    if (emb) centroidsByCluster.set(it._storyClusterId, emb)
  }

  const counts = new Map()
  for (const pastEmb of pastEmbeddings) {
    const emb = _parseEmbeddingForCluster(pastEmb)
    if (!emb) continue
    let bestCluster = null
    let bestSim = threshold
    for (const [cid, centroid] of centroidsByCluster) {
      const sim = _cosineSim384(emb, centroid)
      if (sim > bestSim) { bestSim = sim; bestCluster = cid }
    }
    if (bestCluster != null) {
      counts.set(bestCluster, (counts.get(bestCluster) || 0) + 1)
    }
  }
  return counts
}


export function assignStoryClusters(items, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return items
  const threshold = opts.threshold ?? STORY_CLUSTER_THRESHOLD
  // Cluster centroid = first-member's embedding (single-link approximation;
  // cheap and standard for online story clustering).
  const clusterCentroids = []  // index i → embedding
  const embeds = new Array(items.length)
  let nextClusterId = 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it == null) continue
    const emb = _parseEmbeddingForCluster(it.embedding_minilm_vec)
    embeds[i] = emb
    if (!emb) {
      it._storyClusterId = `solo_${i}`   // unique → never discounted
      continue
    }
    let bestCluster = -1
    let bestSim = threshold
    for (let c = 0; c < clusterCentroids.length; c++) {
      const sim = _cosineSim384(emb, clusterCentroids[c])
      if (sim > bestSim) { bestSim = sim; bestCluster = c }
    }
    if (bestCluster >= 0) {
      it._storyClusterId = `c${bestCluster}`
    } else {
      const cid = nextClusterId++
      clusterCentroids.push(emb)
      it._storyClusterId = `c${cid}`
    }
  }
  return items
}


// applyDiversityDiscount — true position-aware listwise rescoring.
//
// 2026-05-17 (Wave 4) — rewritten as max-adjusted-per-position listwise.
// Pre-change: sorted by raw _score once, applied per-axis discount in that
// order, then re-sorted by adjusted _score. This was approximately correct
// but couldn't honor cross-slate state: every slate started with axisCounts
// = 0, so back-to-back slates served the same story cluster repeatedly.
//
// Post-change:
//   1. axisCounts.story can be SEEDED from opts.recentClusterCounts (Map
//      <storyClusterId, count>) — typically the user's last 200 impressions
//      from user_feed_impressions joined on story_cluster_id. This carries
//      cross-slate / cross-session memory. Pattern from
//      ImpressedImageClusterBasedListwiseRescoringProvider.scala in
//      twitter/the-algorithm.
//   2. At each output position, pick the candidate with the highest
//      adjusted score given current axisCounts. Increment axisCounts on
//      ALL axes for the picked item before the next position. This is the
//      exact pattern of ListwiseRescoringProvider.scala — the picked-so-far
//      slate state influences the next pick.
//   3. Axes now include `author` (X AuthorBasedListwiseRescoringProvider).
//
// Story-axis floor lowered 0.20 → 0.05 — see Wave 1 reasoning.
// pinPersonalToTopSlots's intent (≥ 2 personal in top 5) is now achieved
// naturally: personal-pool cards already carry interestStrength via rerank,
// so they win the position-aware listwise without the same-primary
// adjacency bug the pin had.
//
// Source quotes:
//   * X ListwiseRescoringProvider.scala: group by key, sort by score desc,
//     zipWithIndex, apply per-position rescoring factor.
//   * X ImpressedImageClusterBasedListwiseRescoringProvider.scala:
//     decayFactors.product where each factor is (1 - decayFactor)^count
//     (count from impressed-clusters map).
//   * TikTok newsroom: "won't show two videos in a row by same creator/sound."
//
// Inputs:
//   slate                         — items post-compose, pre-event-cap
//   opts.axes                     — override default axes
//   opts.dropBelow                — drop items whose combined multiplier < threshold
//   opts.decay                    — default per-axis decay (DIV_DECAY = 0.5)
//   opts.floor                    — default per-axis floor (DIV_FLOOR = 0.25)
//   opts.recentClusterCounts      — Map<storyClusterId, count> seed for story axis
//
// Cost: O(N²) in slate size (re-scoring all remaining per position). For
// N ≤ 25 this is < 625 ops per call, comparable to a sort.
export function applyDiversityDiscount(slate, opts = {}) {
  if (!Array.isArray(slate) || slate.length === 0) return slate
  const defaultDecay = opts.decay ?? DIV_DECAY
  const defaultFloor = opts.floor ?? DIV_FLOOR
  const dropBelow = opts.dropBelow ?? 0

  // 2026-05-20 (PR11 debug) — production audit shows the slate's slot order
  // is REVERSED vs `_score × recency` for heavy users (test user 5082a1df:
  // articles with quality×recency ≈ 0 land at slots 1-15, articles with
  // quality×recency ≈ 500-668 land at slots 20-24). The math in rerank() at
  // trinityServe.js:1190 says old articles should score ≈ 0 due to the
  // recency exp-decay. Listwise picking here should pick max-adjusted first.
  // Something between rerank's output and the slate stored in
  // user_feed_impressions is reversing the order. Add a one-shot DEBUG log
  // of the (_score, age, retriever) tuple for every item entering this
  // function. Grep [trinity.divdebug] in Vercel logs after a slate to see
  // what `_score` values actually look like. Removed once root cause found.
  if (process.env.TRINITY_DIV_DEBUG === '1') {
    const now = Date.now()
    const summary = slate.slice(0, 30).map((it, i) => {
      const ageH = it.created_at
        ? Math.round((now - new Date(it.created_at).getTime()) / 3600000)
        : null
      const s = typeof it._score === 'number' ? it._score : 'undef'
      const sStr = typeof s === 'number' ? s.toExponential(3) : s
      return `${i}=${(it._retriever || it._retrieverTier || '?').slice(0,4)}|q${it.ai_final_score ?? '?'}|a${ageH ?? '?'}h|s=${sStr}`
    }).join(' ')
    console.log(`[trinity.divdebug] applyDiversityDiscount IN: n=${slate.length} ${summary}`)
  }
  // Default axes — story (cross-cluster news redundancy), primary (within-
  // primary spread), source (publisher diversity), author (writer diversity).
  const axes = opts.axes || [
    // 2026-05-18 — story floor tightened 0.05 → 0.15. Wave 1's drop to 0.05
    // was too aggressive: the 6th+ same-cluster card kept only 5% of raw
    // score, which over-diversified in the opposite direction (slates were
    // dropping personal cards because explore/LT picks with low raw score
    // and zero same-cluster count beat them). 0.15 is the compromise between
    // pre-Wave-1's 0.20 and Wave-1's 0.05.
    { name: 'story',   fn: it => it?._storyClusterId, floor: 0.15 },
    { name: 'primary', fn: it => it?.vq_primary,      floor: 0.10 },
    // 2026-05-18 — added 'secondary' axis (Trinity h2 sub-cluster).
    // X open-source DiversityDiscountProvider.scala applies the same
    // (1-floor) × decay^count curve to authors; we apply it here to the
    // fine-grained 2048-cluster level so the 5th "AI chip earnings" angle
    // article inside a balanced retrieval gets dampened (cosine ≥ 0.92
    // dedup already catches near-duplicates, this catches semantic siblings).
    { name: 'secondary', fn: it => it?.vq_secondary, floor: 0.25 },
    { name: 'source',  fn: it => (typeof it?.source === 'string' && it.source.trim()) ? it.source.trim().toLowerCase() : null },
    // Wave 4 (2026-05-17): added author axis (X AuthorBasedListwiseRescoringProvider).
    { name: 'author',  fn: it => it?.author_id, floor: 0.20 },
  ]

  // axisCounts[a] = Map<value, count>. Cross-slate seeding applies to story
  // axis only; other axes start fresh per slate (they're slate-local concerns).
  const axisCounts = axes.map(() => new Map())
  const storyAxisIdx = axes.findIndex(a => a.name === 'story')
  if (storyAxisIdx >= 0 && opts.recentClusterCounts instanceof Map) {
    for (const [clusterId, count] of opts.recentClusterCounts.entries()) {
      if (clusterId != null && Number.isFinite(count) && count > 0) {
        axisCounts[storyAxisIdx].set(clusterId, count)
      }
    }
  }

  // Helper: compute adjusted score for a candidate given the current
  // axisCounts. Does not mutate counts.
  const adjustedScore = (item) => {
    let multiplier = 1
    for (let a = 0; a < axes.length; a++) {
      const val = axes[a].fn(item)
      if (val == null) continue
      const prior = axisCounts[a].get(val) || 0
      const f = axes[a].floor ?? defaultFloor
      const d = axes[a].decay ?? defaultDecay
      multiplier *= (1 - f) * Math.pow(d, prior) + f
    }
    return { adjusted: (item._score || 0) * multiplier, multiplier }
  }

  const remaining = slate.slice()
  const picked = []
  while (remaining.length > 0) {
    // Pick max-adjusted across all remaining items.
    let bestIdx = -1
    let bestAdjusted = -Infinity
    let bestMult = 1
    for (let i = 0; i < remaining.length; i++) {
      const { adjusted, multiplier } = adjustedScore(remaining[i])
      if (multiplier < dropBelow) continue
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted
        bestIdx = i
        bestMult = multiplier
      }
    }
    if (bestIdx < 0) break  // all remaining items dropped by dropBelow
    const pick = remaining.splice(bestIdx, 1)[0]
    pick._score = bestAdjusted
    picked.push(pick)
    // Increment axisCounts for the picked item before the next iteration.
    for (let a = 0; a < axes.length; a++) {
      const val = axes[a].fn(pick)
      if (val == null) continue
      axisCounts[a].set(val, (axisCounts[a].get(val) || 0) + 1)
    }
  }
  // PR11 debug: log output order
  if (process.env.TRINITY_DIV_DEBUG === '1') {
    const now = Date.now()
    const summary = picked.slice(0, 30).map((it, i) => {
      const ageH = it.created_at
        ? Math.round((now - new Date(it.created_at).getTime()) / 3600000)
        : null
      const s = typeof it._score === 'number' ? it._score : 'undef'
      const sStr = typeof s === 'number' ? s.toExponential(3) : s
      return `${i}=${(it._retriever || it._retrieverTier || '?').slice(0,4)}|q${it.ai_final_score ?? '?'}|a${ageH ?? '?'}h|s=${sStr}`
    }).join(' ')
    console.log(`[trinity.divdebug] applyDiversityDiscount OUT: n=${picked.length} ${summary}`)
  }
  return picked
}


// Fix C (2026-05-12). pinPersonalToTopSlots.
//
// After applyDiversityDiscount produces a score-sorted slate, ensure at
// least `minPersonal` items from the trinity-personal pool land in the top
// `topN` slots. If fewer than `minPersonal` personal items are already in
// the top, swap them in from later positions.
//
// Source: TikTok Trinity paper (KDD 2024, arxiv:2402.02842) Algorithm 3
// "slot position policy" — pins high-confidence personalized content to
// top positions. Instagram does the same via "position-aware re-ranking"
// (transparency report 2023). Pinterest's Pinnability paper (2023) calls
// this "position calibration." X has RescoreProvider with a position prior.
//
// Cost: O(slate length). Negligible.
export function pinPersonalToTopSlots(slate, opts = {}) {
  const minPersonal = opts.minPersonal ?? 2
  const topN = opts.topN ?? 5
  const poolName = opts.poolName ?? 'trinity-personal'
  if (!Array.isArray(slate) || slate.length < topN) return slate

  const isPersonal = (it) => it?._retrieverTier === poolName || it?._retriever === poolName
  // Count personal items already in top N.
  let personalInTop = 0
  for (let i = 0; i < topN; i++) {
    if (isPersonal(slate[i])) personalInTop += 1
  }
  if (personalInTop >= minPersonal) return slate

  const out = slate.slice()
  // Walk past the top region, find personal items, swap them in.
  for (let pos = topN; pos < out.length && personalInTop < minPersonal; pos++) {
    if (!isPersonal(out[pos])) continue
    // Find the lowest-personal slot in top region (preferring later slots
    // so we don't displace another personal already there).
    let swapIdx = -1
    for (let i = topN - 1; i >= 0; i--) {
      if (!isPersonal(out[i])) { swapIdx = i; break }
    }
    if (swapIdx < 0) break
    const tmp = out[swapIdx]
    out[swapIdx] = out[pos]
    out[pos] = tmp
    personalInTop += 1
  }
  return out
}


// v5. Per-primary slate cap with no-consecutive-same-primary rule.
// TikTok confirmed (Algo 101 leak + support docs): the FYP never shows two
// items from the same creator/sound back-to-back. YouTube CIKM 2018 uses a
// windowed DPP (k=6-12) for diversity rerank — same shape. Streaming VQ
// (KDD 2025) explicitly enforces balanced cluster distribution at the index.
//
// We translate to: max MAX_PER_PRIMARY items per slate from any vq_primary,
// AND no two consecutive slots from the same primary. Items beyond cap or
// that would create a same-primary pair get pushed back; if the full slate
// can't satisfy both rules, we relax no-consecutive first (cap is harder).
export function applyPrimaryCap(slate, opts = {}) {
  const maxPerPrimary = opts.maxPerPrimary ?? MAX_PER_PRIMARY
  const noConsecutive = opts.noConsecutive ?? FORBID_CONSECUTIVE_SAME_PRIMARY
  // Phoenix Phase 7.A (2026-05-09): per-primary cap can be user-mix-aware.
  // Steck RecSys 2018 calibrated recommendations: slate proportion should
  // match user's historical interest mix instead of a flat cap that
  // under-represents strong interests. If `userPrimaryCaps` Map is provided,
  // each primary uses its own cap = max(2, min(7, round(mix × slateSize × 1.2))).
  // Falls back to flat MAX_PER_PRIMARY when not provided (back-compat).
  const userPrimaryCaps = opts.userPrimaryCaps instanceof Map ? opts.userPrimaryCaps : null
  const capFor = (p) => {
    if (userPrimaryCaps != null) {
      const v = userPrimaryCaps.get(p)
      if (Number.isFinite(v) && v > 0) return v
    }
    return maxPerPrimary
  }

  // First pass: enforce cap. Items past the cap are removed (held aside for
  // the second pass which may add them back if the slate is short).
  const counts = new Map()
  const kept = []
  const overflow = []
  for (const item of slate) {
    const p = item.vq_primary
    if (p == null) { kept.push(item); continue }
    const c = counts.get(p) || 0
    if (c >= capFor(p)) { overflow.push(item); continue }
    counts.set(p, c + 1)
    kept.push(item)
  }

  if (!noConsecutive) {
    // Cap-only — no reordering. Pad from overflow if needed.
    return kept.concat(overflow)
  }

  // Second pass: rearrange-so-no-two-adjacent-equal (heap-based greedy).
  // At each step, pick the primary with the MOST remaining items that is
  // not equal to prevPrimary. If only prevPrimary has items left, accept
  // the repeat. This is the canonical "task scheduler" / "reorganize string"
  // greedy — proven optimal when the most-frequent count ≤ ceil(n/2).
  // Without this (using "first remaining" picking), [1,1,2,2,3,3] yields
  // [1,2,1,2,3,3] — a same-primary pair survives despite [1,2,3,1,2,3]
  // being achievable.
  const buckets = new Map()
  const insertOrder = new Map() // primary → original-index, for stable tie-break
  let nextOrder = 0
  for (const it of kept) {
    const p = it.vq_primary
    if (!buckets.has(p)) {
      buckets.set(p, [])
      insertOrder.set(p, nextOrder++)
    }
    buckets.get(p).push(it)
  }

  const reordered = []
  let prevPrimary = null
  while (true) {
    let bestPrimary = null, bestSize = -1, bestOrder = Infinity
    let fallbackPrimary = null, fallbackSize = -1
    for (const [p, arr] of buckets) {
      if (arr.length === 0) continue
      if (p === prevPrimary) {
        if (arr.length > fallbackSize) { fallbackPrimary = p; fallbackSize = arr.length }
        continue
      }
      const ord = insertOrder.get(p)
      if (arr.length > bestSize || (arr.length === bestSize && ord < bestOrder)) {
        bestPrimary = p; bestSize = arr.length; bestOrder = ord
      }
    }
    const pick = bestPrimary !== null ? bestPrimary : fallbackPrimary
    if (pick === null) break
    reordered.push(buckets.get(pick).shift())
    prevPrimary = pick
  }

  return reordered.concat(overflow)
}


// v5.1 — Per-publisher slate cap. Same shape as applyPrimaryCap but keys
// on `article.source`. Run after applyPrimaryCap so primary balancing
// happens first; this then refines for per-publisher distribution.
//
// Articles with no `source` field (or null) are passed through untouched —
// the cap only restricts items that explicitly identify a publisher. This
// matches TikTok behavior: items without a creator (system content) bypass
// the per-creator rule.
export function applyPublisherCap(slate, opts = {}) {
  const maxPerPublisher = opts.maxPerPublisher ?? MAX_PER_PUBLISHER
  const noConsecutive = opts.noConsecutive ?? FORBID_CONSECUTIVE_SAME_PUBLISHER
  // Phase 1.2 (2026-05-10): optional overflow padding. When the caller
  // wants to ensure a minimum slate size, pass `allowOverflowPad: true`
  // and `targetSize: N`. After cap+rearrange, items dropped by the cap
  // are concat'd back at the end up to targetSize. This trades a violation
  // of the per-publisher cap for slate completeness — only applied when the
  // alternative is a visibly short slate.
  const allowOverflowPad = !!opts.allowOverflowPad
  const targetSize = Number.isFinite(opts.targetSize) ? opts.targetSize : null

  const sourceOf = (item) => {
    const s = item?.source
    if (typeof s !== 'string') return null
    const trimmed = s.trim()
    return trimmed ? trimmed.toLowerCase() : null
  }

  // First pass: enforce cap.
  const counts = new Map()
  const kept = []
  const overflow = []
  for (const item of slate) {
    const p = sourceOf(item)
    if (p == null) { kept.push(item); continue }
    const c = counts.get(p) || 0
    if (c >= maxPerPublisher) { overflow.push(item); continue }
    counts.set(p, c + 1)
    kept.push(item)
  }

  // Note: unlike applyPrimaryCap which pads with overflow at the end (rare
  // clusters are themselves a diversity asset), publisher overflow is
  // dropped strictly UNLESS allowOverflowPad is set. A 4th Reuters article
  // is information-redundant with the 3 already kept; we only pad when the
  // slate would otherwise be visibly short.
  const padIfShort = (arr) => {
    if (!allowOverflowPad || targetSize == null || arr.length >= targetSize) return arr
    const need = targetSize - arr.length
    return arr.concat(overflow.slice(0, need))
  }

  if (!noConsecutive) {
    return padIfShort(kept)
  }

  // Second pass: same heap-based "task scheduler" rearrange used by
  // applyPrimaryCap. Items with null source are buckets too — treated as
  // their own group keyed on a sentinel so they never trip the
  // no-consecutive rule against each other.
  const NULL_KEY = Symbol('null-source')
  const buckets = new Map()
  const insertOrder = new Map()
  let nextOrder = 0
  for (const it of kept) {
    const p = sourceOf(it) ?? NULL_KEY
    if (!buckets.has(p)) {
      buckets.set(p, [])
      insertOrder.set(p, nextOrder++)
    }
    buckets.get(p).push(it)
  }

  const reordered = []
  let prevPublisher = null
  while (true) {
    let bestPublisher = null, bestSize = -1, bestOrder = Infinity
    let fallbackPublisher = null, fallbackSize = -1
    for (const [p, arr] of buckets) {
      if (arr.length === 0) continue
      // Null-source items don't trigger the no-consecutive rule against
      // each other (they're untracked at the source level).
      if (p === prevPublisher && p !== NULL_KEY) {
        if (arr.length > fallbackSize) { fallbackPublisher = p; fallbackSize = arr.length }
        continue
      }
      const ord = insertOrder.get(p)
      if (arr.length > bestSize || (arr.length === bestSize && ord < bestOrder)) {
        bestPublisher = p; bestSize = arr.length; bestOrder = ord
      }
    }
    const pick = bestPublisher !== null ? bestPublisher : fallbackPublisher
    if (pick === null) break
    reordered.push(buckets.get(pick).shift())
    prevPublisher = pick
  }

  return padIfShort(reordered)
}


// v5.1 — Per-story-event slate cap. Strict 1-per-event_id rule (Google
// News pattern). Articles must carry `_world_event_id` (set by
// trinityServe from the article_world_events lookup before rerank).
// Articles without an event_id pass through.
//
// Picks the FIRST occurrence of each event_id (which by call site is
// already score-ranked, so it's the highest-scoring article for that
// event). Subsequent same-event articles are dropped.
export function applyEventCap(slate, opts = {}) {
  const maxPerEvent = opts.maxPerEvent ?? MAX_PER_EVENT
  const seen = new Map()  // event_id → count
  const out = []
  for (const item of slate) {
    const e = item?._world_event_id
    if (e == null) { out.push(item); continue }
    const c = seen.get(e) || 0
    if (c >= maxPerEvent) continue   // strict drop
    seen.set(e, c + 1)
    out.push(item)
  }
  return out
}


// Phoenix Phase 1.2b (2026-05-08): replaced the hard-antijoin RPC with
// the seen-count variant. The old antijoin (migration 080) deleted every
// article the user had ever seen, leaving narrow taste-cluster pools
// empty for power users (12K+ lifetime impressions); composeWithBudgets
// then spilled the explore bucket into the empty slots → ~93% explore
// feed. The new RPC returns articles with seen_count attached so the
// rerank score chain can apply soft decay (1.0 / 0.4 / 0.1 / 0.02 by
// 0/1/2/3+ views). Pools never come back empty if any matching content
// exists; attenuation handles re-show suppression.
//
// Falls back to the old NOT IN path for guests (userId=null) and on RPC
// error so we never hard-fail.
async function fetchCluster(supabase, c2, sinceIso, limit, excludeIds, minScore, userId) {
  if (userId) {
    const hoursWindow = Math.max(1, Math.round((Date.now() - new Date(sinceIso).getTime()) / 3600000))
    const { data, error } = await supabase.rpc('trinity_fetch_cluster_with_seencount', {
      p_user_id: userId,
      p_vq_secondary: c2,
      p_hours_window: hoursWindow,
      p_min_score: minScore || 0,
      p_limit: limit,
    })
    if (!error && Array.isArray(data)) {
      // Phoenix Phase 4.E (2026-05-09): post-RPC excludeIds filter. See
      // retrievePersonalizedFresh comment — same race-condition guard.
      // Catches concurrent in-flight requests that iOS knows about but
      // the DB hasn't seen yet (impressions commit at end of handler).
      if (excludeIds && excludeIds.length > 0) {
        const excludeSet = new Set(excludeIds.map(Number))
        return data.filter(a => !excludeSet.has(Number(a.id)))
      }
      return data
    }
    console.error(`[trinity] fetchCluster c2=${c2} seencount RPC failed:`, error?.message)
    // Fall through to legacy path on error.
  }
  let q = supabase
    .from('published_articles')
    // JSONB component columns (details/timeline/graph/map/five_ws) +
    // components/topics/countries/relevance/cluster_id added so the
    // Trinity slate ships the same shape as v11's ARTICLE_COLUMNS —
    // formatArticle() and the iOS Article model both expect them.
    // Without these the iOS feed card has no data for its info boxes.
    // Sister site: lib/trinityServe.js retrieveTrending has the same
    // fix.
    .select('id, title_news, summary_bullets_news, category, ai_final_score, vq_primary, vq_secondary, embedding_minilm_vec, image_url, image_source, source, url, expected_read_seconds, created_at, published_at, components_order, components, details, timeline, graph, map, five_ws, countries, topics, interest_tags, country_relevance, topic_relevance, cluster_id, emoji, num_sources, freshness_category, shelf_life_days, author_id, author_name')
    .eq('vq_secondary', c2)
    .gte('created_at', sinceIso)
    .gte('ai_final_score', minScore)
    .order('ai_final_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) {
    console.error(`[trinity] fetchCluster c2=${c2} failed:`, error.message)
    return []
  }
  return data || []
}


// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function bucketChildren(parentMap) {
  const buckets = new Array(J_PRIMARY)
  for (let i = 0; i < J_PRIMARY; i++) buckets[i] = []
  for (let c2 = 0; c2 < parentMap.length; c2++) {
    const c1 = parentMap[c2]
    if (c1 >= 0 && c1 < J_PRIMARY) buckets[c1].push(c2)
  }
  return buckets
}

function sortIndicesDesc(arr, n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = i
  out.sort((a, b) => arr[b] - arr[a])
  return out
}

function argmaxOver(indices, arr) {
  let best = indices[0]
  let bestVal = arr[best]
  for (let i = 1; i < indices.length; i++) {
    const v = arr[indices[i]]
    if (v > bestVal) { best = indices[i]; bestVal = v }
  }
  return best
}

function weightedSampleWithoutReplacement(items, weights, k, rng) {
  // Efraimidis–Spirakis: key = u^(1/w), top-k by key.
  const keys = []
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(weights[i], 1e-12)
    const u = Math.max(rng(), 1e-12)
    keys.push([Math.pow(u, 1 / w), items[i]])
  }
  keys.sort((a, b) => b[0] - a[0])
  return keys.slice(0, k).map(p => p[1])
}

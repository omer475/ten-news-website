// Canonical event weight table. Mirrors the SQL CASE in
// migrations/119_reading_time_rewrite.sql — keep both in sync.
//
// X-aligned downscale on Like (X has Like = +0.5; we use +0.8 since we
// lack a Retweet-equivalent stronger lightweight positive). Negative
// asymmetry follows X's pattern (NegFeedbackV2 = −74 vs Like = +0.5 →
// ~150× ratio): we scale Not Interested 12× a Like.

export const EVENT_WEIGHTS = Object.freeze({
  article_liked:           0.8,   // low-effort double-tap, X-aligned
  article_detail_view:     2.5,   // source tap = curiosity + click-through
  article_revisit:         3.0,   // intentional re-engagement (rare, strong)
  article_saved:           3.0,   // deliberate "keep this"
  article_shared:          4.0,   // friend-share = "this matters"
  article_not_interested: -10.0,  // 3× stronger than before; ~12× Like magnitude
})

/**
 * Get the canonical effort-weighted score for an explicit-positive
 * (or explicit-negative) event_type. Returns 0 for dwell-tier events
 * (article_engaged / article_skipped / article_view) — those are weighted
 * server-side in trinity_build_histogram via dwell-bucket logic, not as
 * fixed-table values.
 */
export function explicitWeight(eventType) {
  const w = EVENT_WEIGHTS[eventType]
  return Number.isFinite(w) ? w : 0
}

/**
 * Set of event types with explicit-positive weights (for membership checks).
 * Phoenix Phase 8.B replaces the various ad-hoc lists scattered across
 * track.js with a single canonical set.
 */
export const EXPLICIT_POSITIVE_EVENTS = Object.freeze(new Set([
  'article_liked', 'article_detail_view', 'article_revisit',
  'article_saved', 'article_shared',
]))

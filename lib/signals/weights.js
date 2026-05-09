// Phoenix Phase 8.B (2026-05-09). Canonical event weight table.
//
// Mirrors the SQL definitions in migrations/084_trinity_histogram_effort_weighted.sql.
// All JS-side code that needs to weight an event_type should import from here
// to avoid drift. The Day 2 audit found 5 different weight schedules across
// track.js + trinity.js + migration 084 — this file is the single source of
// truth for the JS half (migration 084 is the SQL mirror).
//
// Source: X open-sourced "the-algorithm" engagement weight philosophy
// (effort cost → signal strength), adapted for our text-platform action set.
// share > save > revisit > detail_view > like; no_interest much stronger negative.

export const EVENT_WEIGHTS = Object.freeze({
  article_liked:        1.5,   // low-effort double-tap
  article_detail_view:  2.0,   // source tap = curiosity + click-through
  article_revisit:      2.5,   // intentional re-engagement (rare, strong)
  article_saved:        3.0,   // deliberate "keep this"
  article_shared:       4.0,   // friend-share = "this matters"
  article_not_interested: -3.0,
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

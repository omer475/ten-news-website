// TodayPlus Feed — interstitial modules (spec §8)
// All share the header: mono gold label + hairline rule. No boxes — open
// layouts with hairline dividers only. Banned: polls, quizzes, any aggregate
// user counts (no fake social proof, §1.4).

import React, { useEffect, useState } from 'react';
import { TP, FONT_HEAD, FONT_BODY, FONT_MONO, Markup } from './tokens';
import { CountUp, useRevealOnce, revealStyle } from './shared';

// ── Reminders / pins (consume-only; graceful no-op until the endpoint ships) ──
// One shared store backs both the countdown "Remind me" button and the alarm on
// pinned events. Optimistic: localStorage is the source of truth for the toggle
// state; the POST/DELETE is best-effort. event_id is whatever stably identifies
// the event in the contract (event_id → id → "name|datetime").
export function eventIdOf(row) {
  if (!row) return null;
  if (row.event_id != null) return String(row.event_id);
  if (row.id != null) return String(row.id);
  if (row.name && row.datetime) return `${row.name}|${row.datetime}`;
  return null;
}
function readReminders() {
  try { const a = JSON.parse(localStorage.getItem('tp_reminders') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function writeReminders(ids) {
  try { localStorage.setItem('tp_reminders', JSON.stringify(ids.slice(-200))); } catch (_) {}
}
function postReminder(eventId, on) {
  try {
    let gid = null;
    try { gid = localStorage.getItem('tn_guest_id'); } catch (_) {}
    fetch('/api/feed/reminder', {
      method: on ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: Number(eventId), guest_device_id: gid || undefined }),
    }).catch(() => {});
  } catch (_) {}
}

// ── Module rotation via seen-ids: once an item is READ (55%-visible signal) its
// id is remembered, and sent to /api/feed/modules so the next refresh can return
// FRESH items. No-op until the backend honors `seen`; ids are best-effort stable.
// Returns the BACKEND-assigned ids for an item so they echo back exactly in
// `seen_ids` (history → module.ids[], notd → module.id, briefs → row.id,
// countdown → numeric upcoming_events id). Falls back to nothing when absent.
export function moduleSeenIds(item) {
  if (!item) return [];
  switch (item.kind) {
    case 'countdown': { const id = item.row && item.row.id; return id != null ? [String(id)] : []; }
    case 'notd': { const id = item.module && item.module.id; return id != null ? [String(id)] : []; }
    case 'history': { const ids = item.module && item.module.ids; return Array.isArray(ids) ? ids.map(String) : []; }
    case 'briefs': {
      const rows = (item.module && item.module.rows) || [];
      return rows.map((r) => r && r.id).filter((x) => x != null).map(String);
    }
    default: return [];
  }
}
export function getSeenModuleIds() {
  try { const a = JSON.parse(localStorage.getItem('tp_module_seen') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
export function markModuleSeen(ids) {
  if (!ids || !ids.length) return;
  try {
    const cur = new Set(getSeenModuleIds());
    ids.forEach((i) => cur.add(i));
    localStorage.setItem('tp_module_seen', JSON.stringify(Array.from(cur).slice(-400)));
  } catch (_) {}
}

export function ReminderButton({ eventId, accent, label = 'Remind me', onToggle }) {
  const [on, setOn] = useState(false);
  useEffect(() => { if (eventId != null) setOn(readReminders().includes(String(eventId))); }, [eventId]);
  if (eventId == null) return null;
  const toggle = (e) => {
    if (e) { e.stopPropagation(); }
    const id = String(eventId);
    const next = !on;
    setOn(next); // optimistic
    const cur = readReminders();
    writeReminders(next ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id));
    postReminder(id, next);
    try { onToggle?.(next); } catch (_) {}
  };
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Reminder set — tap to remove' : label}
      style={{
        all: 'unset', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 34, padding: '0 14px', borderRadius: 999,
        fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: on ? TP.bg : accent,
        background: on ? accent : `color-mix(in srgb, ${accent} 8%, transparent)`,
        border: `1px solid ${on ? accent : `color-mix(in srgb, ${accent} 32%, transparent)`}`,
        transition: 'all 0.16s ease',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {on ? 'Reminder set' : label}
    </button>
  );
}

function ModuleHeader({ title, shown = true, animate = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
        letterSpacing: '0.26em', textTransform: 'uppercase', color: TP.gold,
        whiteSpace: 'nowrap', ...revealStyle(shown, animate, 0, 6),
      }}>{title}</span>
      <span style={{
        flex: 1, height: 1, background: TP.line,
        transform: shown ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
        transition: animate ? 'transform 0.7s cubic-bezier(.2,.7,.2,1) 0.1s' : 'none',
      }} />
    </div>
  );
}

// ── 8.1 COUNTING DOWN — ticks every second (a live clock keeps ticking under
// reduce-motion; only decorative animation is killed) ────────────────────────

export function CountdownModule({ row }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(row.datetime).getTime();
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const parts = [
    [Math.floor(total / 86400), 'DAYS'],
    [Math.floor((total % 86400) / 3600), 'HOURS'],
    [Math.floor((total % 3600) / 60), 'MIN'],
    [total % 60, 'SEC'],
  ];

  // Unique per instance — the primary and each injected countdown card render
  // the same component, so a fixed key would let only the first one animate
  // (animatedKeys is module-global).
  const revealKey = 'mod.countdown.' + (row?.id ?? row?.datetime ?? 'primary');
  const [ref, shown, animate] = useRevealOnce(revealKey, 0.3);
  return (
    <section ref={ref}>
      <ModuleHeader title="COUNTING DOWN" shown={shown} animate={animate} />
      <h3 style={{
        fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17,
        letterSpacing: '-0.01em', color: TP.ink, margin: '16px 0 0',
        ...revealStyle(shown, animate, 0.12, 10),
      }}>{row.name}</h3>
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 14, ...revealStyle(shown, animate, 0.22, 12) }}>
        {parts.map(([value, label], i) => (
          <React.Fragment key={label}>
            {i > 0 ? <span style={{ width: 1, background: TP.line }} /> : null}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 30, lineHeight: 1,
                letterSpacing: '-0.02em', color: TP.ink, fontVariantNumeric: 'tabular-nums',
              }}>{String(value).padStart(2, '0')}</div>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: TP.ink3, marginTop: 4,
              }}>{label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {row.context ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2, margin: '14px 0 0' }}>
          {row.context}
        </p>
      ) : null}
      <div style={revealStyle(shown, animate, 0.34, 8)}>
        <ReminderButton eventId={eventIdOf(row)} accent={TP.gold} />
      </div>
    </section>
  );
}

// ── Pinned countdowns — rendered at the TOP of the feed, compact + distinct,
// every visit until the event passes. The alarm un-pins (DELETE reminder). ─────

function compactRemain(target, now) {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${total % 60}s`;
}

function PinnedCountdown({ row, onUnpin }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const target = new Date(row.datetime).getTime();
  const id = eventIdOf(row);
  const unpin = (e) => {
    if (e) e.stopPropagation();
    const cur = readReminders();
    writeReminders(cur.filter((x) => x !== String(id)));
    postReminder(String(id), false);
    try { onUnpin?.(String(id)); } catch (_) {}
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14,
      background: `color-mix(in srgb, ${TP.gold} 6%, transparent)`,
      border: `1px solid ${TP.line}`,
    }}>
      <span aria-hidden style={{
        width: 7, height: 7, borderRadius: '50%', background: TP.gold, flexShrink: 0,
        boxShadow: `0 0 0 4px color-mix(in srgb, ${TP.gold} 14%, transparent)`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: TP.ink3 }}>
          PINNED · COUNTDOWN
        </div>
        <div style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: TP.ink, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{row.name}</div>
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 16, color: TP.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {compactRemain(target, now)}
      </div>
      <button onClick={unpin} aria-label="Remove pin" title="Remove pin" style={{
        all: 'unset', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 999, color: TP.gold, flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" />
        </svg>
      </button>
    </div>
  );
}

export function PinnedRail({ events, onUnpin }) {
  const future = (events || []).filter((e) => e && e.datetime && new Date(e.datetime).getTime() > Date.now());
  if (!future.length) return null;
  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {future.slice(0, 4).map((e) => <PinnedCountdown key={eventIdOf(e) || e.datetime} row={e} onUnpin={onUnpin} />)}
    </div>
  );
}

// ── 8.2 TODAY IN HISTORY ─────────────────────────────────────────────────────

export function HistoryModule({ module }) {
  const rows = (module.rows || []).slice(0, 3);
  const [ref, shown, animate] = useRevealOnce('mod.history', 0.3);
  return (
    <section ref={ref}>
      <ModuleHeader title="TODAY IN HISTORY" shown={shown} animate={animate} />
      <div style={{ marginTop: 16 }}>
        {rows.map((row, i) => {
          const arr = Array.isArray(row);
          const year = arr ? row[0] : row?.year;
          const text = arr ? row[1] : row?.text;
          const major = arr ? !!row[3] : !!row?.major; // landmark anchor (row 0)
          return (
            <React.Fragment key={i}>
              {i > 0 ? <div style={{ height: 1, background: TP.line, margin: '13px 0' }} /> : null}
              <div style={{ display: 'flex', alignItems: 'baseline', ...revealStyle(shown, animate, 0.15 + i * 0.14, 10) }}>
                <span style={{
                  fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 18.5,
                  letterSpacing: '-0.012em', color: TP.gold, width: 64, flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>{year}</span>
                <span style={{
                  fontFamily: FONT_BODY, fontSize: major ? 15.2 : 14.7, lineHeight: 1.5,
                  color: major ? TP.ink : TP.ink2, fontWeight: major ? 500 : 400,
                }}>
                  <Markup raw={text || ''} emColor={TP.gold} strongColor={TP.ink} />
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

// ── 8.3 IN 10 SECONDS / WHILE YOU SCROLLED ──────────────────────────────────

export function BriefsModule({ module, title }) {
  const rows = (module.rows || []).slice(0, 3);
  const [ref, shown, animate] = useRevealOnce('mod.briefs', 0.3);
  return (
    <section ref={ref}>
      <ModuleHeader title={title} shown={shown} animate={animate} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', ...revealStyle(shown, animate, 0.15 + i * 0.12, 10) }}>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: TP.gold, width: 42, flexShrink: 0,
            }}>{row.tag}</span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14.9, lineHeight: 1.5, color: TP.ink2 }}>
              <Markup raw={row.text || ''} emColor={TP.gold} strongColor={TP.ink} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 8.5 NUMBER OF THE DAY ────────────────────────────────────────────────────

// Human-readable NOTD number. The backend pre-scales value + unit (3.9 / "M"),
// so we just render the value cleanly — never re-scale into "$0.0039B".
// The decimal count is fixed from the TARGET so the tabular-nums column doesn't
// jitter during the count-up and a sub-1 target never collapses to a bare int.
function notdDecimals(target) {
  const abs = Math.abs(target);
  if (abs % 1 < 1e-9) return 0;   // integer
  if (abs >= 100) return 0;       // 250.4 -> 250
  if (abs >= 1) return 1;         // 3.94 -> 3.9
  if (abs >= 0.01) return 2;      // 0.42
  return 3;                       // tiny but bounded — never exponential
}
function fmtFixed(v, dp) {
  if (v == null || Number.isNaN(v)) return '0';
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function NotdModule({ module, moduleKey }) {
  const [ref, shown, animate] = useRevealOnce('mod.notd', 0.3);
  // Hide the whole module when there's no real number to show.
  if (!module || module.value == null) return null;
  const target = Number(module.value) || 0;
  const dp = notdDecimals(target);
  return (
    <section ref={ref}>
      <ModuleHeader title="NUMBER OF THE DAY" shown={shown} animate={animate} />
      <div style={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 54, lineHeight: 0.95,
        letterSpacing: '-0.025em', color: TP.ink, marginTop: 16,
        ...revealStyle(shown, animate, 0.12, 12),
      }}>
        <CountUp
          value={target}
          prefix={module.prefix || ''}
          unit={module.unit || ''}
          unitStyle={{ fontSize: '0.42em', color: TP.gold }}
          animKey={`notd.${moduleKey}`}
          format={(v) => fmtFixed(v, dp)}
        />
      </div>
      {module.title ? (
        <p style={{
          fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15.5, lineHeight: 1.32,
          letterSpacing: '-0.01em', color: TP.ink, margin: '13px 0 0',
          ...revealStyle(shown, animate, 0.24, 10),
        }}>
          {module.title}
        </p>
      ) : null}
      {module.context ? (
        <p style={{
          fontFamily: FONT_BODY, fontSize: 14.2, lineHeight: 1.55, color: TP.ink2, margin: '7px 0 0',
          ...revealStyle(shown, animate, 0.3, 10),
        }}>
          {module.context}
        </p>
      ) : null}
    </section>
  );
}

// ── Rotation: each module appears AT MOST ONCE per feed (user direction
// 2026-06-12 — no repeating Today in History / Number of the Day). Once the
// list is exhausted, no more interstitials are inserted. MARKET PULSE (§8.4)
// is client-side prices and intentionally skipped in v1. ──────────────────────

// The primary COUNTING DOWN event: prefer the user-aware countdown_primary,
// fall back to the first future row of the old global `countdowns` shape.
export function primaryCountdown(modules) {
  if (!modules) return null;
  const p = modules.countdown_primary;
  if (p && p.datetime && new Date(p.datetime).getTime() > Date.now()) return p;
  return (modules.countdowns?.rows || []).find((r) => r && new Date(r.datetime).getTime() > Date.now()) || null;
}

// Future-only countdown_cards (the extra relevant events spread through the feed),
// excluding whatever is already shown as the primary.
export function countdownCards(modules) {
  if (!modules || !Array.isArray(modules.countdown_cards)) return [];
  const primary = primaryCountdown(modules);
  const pKey = primary ? `${primary.name}|${primary.datetime}` : null;
  return modules.countdown_cards.filter(
    (c) => c && c.datetime && new Date(c.datetime).getTime() > Date.now() && `${c.name}|${c.datetime}` !== pKey
  );
}

export function buildModuleRotation(modules) {
  if (!modules) return () => null;
  const kinds = [];

  if (primaryCountdown(modules)) kinds.push('countdown');
  if (modules.history?.rows?.length) kinds.push('history');
  if (modules.briefs?.rows?.length) kinds.push('briefs');
  if (modules.notd && modules.notd.value != null) kinds.push('notd');

  let cursor = 0;

  return function next() {
    if (cursor >= kinds.length) return null;   // exhausted — never repeat
    const kind = kinds[cursor];
    cursor += 1;
    switch (kind) {
      case 'countdown': {
        const row = primaryCountdown(modules);
        if (!row) return next();
        return { kind, row };
      }
      case 'history': return { kind, module: modules.history };
      case 'briefs': return { kind, module: modules.briefs, title: 'IN 10 SECONDS' };
      case 'notd': return { kind, module: modules.notd };
      default: return null;
    }
  };
}

export function ModuleBlock({ item, moduleKey }) {
  switch (item.kind) {
    case 'countdown': return <CountdownModule row={item.row} />;
    case 'history': return <HistoryModule module={item.module} />;
    case 'briefs': return <BriefsModule module={item.module} title={item.title} />;
    case 'notd': return <NotdModule module={item.module} moduleKey={moduleKey} />;
    default: return null;
  }
}

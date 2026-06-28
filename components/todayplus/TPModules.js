// TodayPlus Feed — interstitial modules (spec §8)
// All share the header: mono gold label + hairline rule. No boxes — open
// layouts with hairline dividers only. Banned: polls, quizzes, any aggregate
// user counts (no fake social proof, §1.4).

import React, { useEffect, useState } from 'react';
import { TP, FONT_HEAD, FONT_BODY, FONT_MONO, Markup } from './tokens';
import { CountUp, useRevealOnce, revealStyle } from './shared';

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
    </section>
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

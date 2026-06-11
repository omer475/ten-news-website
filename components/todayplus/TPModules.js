// TodayPlus Feed — interstitial modules (spec §8)
// All share the header: mono gold label + hairline rule. No boxes — open
// layouts with hairline dividers only. Banned: polls, quizzes, any aggregate
// user counts (no fake social proof, §1.4).

import React, { useEffect, useState } from 'react';
import { TP, FONT_HEAD, FONT_BODY, FONT_MONO, Markup } from './tokens';
import { CountUp } from './shared';

function ModuleHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
        letterSpacing: '0.26em', textTransform: 'uppercase', color: TP.gold,
        whiteSpace: 'nowrap',
      }}>{title}</span>
      <span style={{ flex: 1, height: 1, background: TP.line }} />
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

  return (
    <section>
      <ModuleHeader title="COUNTING DOWN" />
      <h3 style={{
        fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18.4,
        letterSpacing: '-0.02em', color: TP.ink, margin: '16px 0 0',
      }}>{row.name}</h3>
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 14 }}>
        {parts.map(([value, label], i) => (
          <React.Fragment key={label}>
            {i > 0 ? <span style={{ width: 1, background: TP.line }} /> : null}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 34, lineHeight: 1,
                letterSpacing: '-0.04em', color: TP.ink, fontVariantNumeric: 'tabular-nums',
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
  return (
    <section>
      <ModuleHeader title="TODAY IN HISTORY" />
      <div style={{ marginTop: 16 }}>
        {rows.map((row, i) => {
          const [year, text] = Array.isArray(row) ? row : [row?.year, row?.text];
          return (
            <React.Fragment key={i}>
              {i > 0 ? <div style={{ height: 1, background: TP.line, margin: '13px 0' }} /> : null}
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{
                  fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 20.8,
                  letterSpacing: '-0.03em', color: TP.gold, width: 64, flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>{year}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.5, color: TP.ink2 }}>
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
  return (
    <section>
      <ModuleHeader title={title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline' }}>
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

export function NotdModule({ module, moduleKey }) {
  return (
    <section>
      <ModuleHeader title="NUMBER OF THE DAY" />
      <div style={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 64, lineHeight: 0.95,
        letterSpacing: '-0.05em', color: TP.ink, marginTop: 16,
      }}>
        <CountUp
          value={Number(module.value) || 0}
          prefix={module.prefix || ''}
          unit={module.unit || ''}
          unitStyle={{ fontSize: '0.42em', color: TP.gold }}
          animKey={`notd.${moduleKey}`}
        />
      </div>
      {module.context ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.55, color: TP.ink2, margin: '14px 0 0' }}>
          {module.context}
        </p>
      ) : null}
    </section>
  );
}

// ── Rotation (§4): rotate through available modules in order, reshuffle when
// exhausted; modules never affect image-rhythm state. MARKET PULSE (§8.4) is
// client-side prices and intentionally skipped in v1 — the other 4 rotate. ──

export function buildModuleRotation(modules) {
  if (!modules) return () => null;
  const kinds = [];
  const firstFutureCountdown = () =>
    (modules.countdowns?.rows || []).find((r) => new Date(r.datetime).getTime() > Date.now()) || null;

  if (firstFutureCountdown()) kinds.push('countdown');
  if (modules.history?.rows?.length) kinds.push('history');
  if (modules.briefs?.rows?.length) kinds.push('briefs');
  if (modules.notd) kinds.push('notd');

  let cycle = [...kinds];
  let cursor = 0;
  let briefsFlip = false;

  return function next() {
    if (!cycle.length) return null;
    if (cursor >= cycle.length) {
      cycle = [...cycle].sort(() => Math.random() - 0.5);
      cursor = 0;
    }
    const kind = cycle[cursor];
    cursor += 1;
    switch (kind) {
      case 'countdown': {
        const row = firstFutureCountdown();
        if (!row) {
          cycle = cycle.filter((k) => k !== 'countdown');
          cursor = Math.min(cursor, cycle.length);
          return next();
        }
        return { kind, row };
      }
      case 'history': return { kind, module: modules.history };
      case 'briefs': {
        briefsFlip = !briefsFlip;
        return { kind, module: modules.briefs, title: briefsFlip ? 'IN 10 SECONDS' : 'WHILE YOU SCROLLED' };
      }
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

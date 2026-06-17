// TodayPlus Feed — interstitial modules (spec §8)
// All share the header: mono gold label + hairline rule. No boxes — open
// layouts with hairline dividers only. Banned: polls, quizzes, any aggregate
// user counts (no fake social proof, §1.4).

import React, { useEffect, useState } from 'react';
import { TP, FONT_HEAD, FONT_BODY, FONT_MONO, Markup } from './tokens';
import { CountUp, useRevealOnce, revealStyle } from './shared';

// The Cloud Run image pipeline sometimes writes a RELATIVE storage path
// (/storage/v1/object/public/…) instead of a full Supabase URL. On the website
// that resolves to todayplus.news/storage/… → 404, so the image never shows.
// Normalize any relative storage path to the absolute Supabase URL. (The proper
// fix is in the pipeline — it should store the full public URL.)
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
function absUrl(u) {
  if (!u || typeof u !== 'string') return u;
  if (/^https?:\/\//i.test(u)) return u;            // already absolute
  if (u.startsWith('/storage/') && SUPABASE_URL) return SUPABASE_URL + u;
  return u;
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

  const [ref, shown, animate] = useRevealOnce('mod.countdown', 0.3);
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

// ── 8.2 TODAY IN HISTORY — illustrated set ───────────────────────────────────
// Each day, all 3 entries are illustrated in ONE rotating art style (style_index
// 0..15), so the module reads as a cohesive set. Rows are [year, text, imageURL]
// (imageURL may be null → text-only fallback). The square image is the visual
// anchor; the year sits big in gold beside it. Images are ~1.6–2MB PNGs, so they
// lazy-load and fade in over a skeleton.

function HistoryRow({ year, text, image, shown, animate, delay }) {
  const [loaded, setLoaded] = useState(false);
  const yearEl = (size) => (
    <span style={{
      fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size,
      letterSpacing: '-0.014em', color: TP.gold, fontVariantNumeric: 'tabular-nums',
      lineHeight: 1, display: 'block',
    }}>{year}</span>
  );

  // text-only fallback (no illustration for this entry)
  if (!image) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, ...revealStyle(shown, animate, delay, 10) }}>
        <span style={{ width: 64, flexShrink: 0 }}>{yearEl(20.8)}</span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.5, color: TP.ink2 }}>
          <Markup raw={text || ''} emColor={TP.gold} strongColor={TP.ink} />
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 15, ...revealStyle(shown, animate, delay, 10) }}>
      <div style={{
        position: 'relative', width: 88, height: 88, borderRadius: 16, flexShrink: 0,
        overflow: 'hidden', background: TP.line,
        boxShadow: '0 2px 10px rgba(22,21,15,0.07)',
      }}>
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.55s ease-out',
          }}
        />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(22,21,15,0.06)',
        }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        {yearEl(20.8)}
        <p style={{
          fontFamily: FONT_BODY, fontSize: 14.4, lineHeight: 1.48, color: TP.ink2,
          margin: '6px 0 0',
        }}>
          <Markup raw={text || ''} emColor={TP.gold} strongColor={TP.ink} />
        </p>
      </div>
    </div>
  );
}

export function HistoryModule({ module }) {
  const rows = (module.rows || []).slice(0, 3);
  const style = module.style;
  const [ref, shown, animate] = useRevealOnce('mod.history', 0.3);
  return (
    <section ref={ref}>
      <ModuleHeader title="TODAY IN HISTORY" shown={shown} animate={animate} />
      {style ? (
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: TP.ink3, marginTop: 9,
          ...revealStyle(shown, animate, 0.1, 6),
        }}>
          Illustrated in — <span style={{ color: TP.gold }}>{style}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {rows.map((row, i) => {
          const [year, text, image] = Array.isArray(row)
            ? row
            : [row?.year, row?.text, row?.image_url || row?.image];
          return (
            <HistoryRow
              key={i}
              year={year}
              text={text}
              image={absUrl(image) || null}
              shown={shown}
              animate={animate}
              delay={0.15 + i * 0.14}
            />
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

export function NotdModule({ module, moduleKey }) {
  const [ref, shown, animate] = useRevealOnce('mod.notd', 0.3);
  return (
    <section ref={ref}>
      <ModuleHeader title="NUMBER OF THE DAY" shown={shown} animate={animate} />
      <div style={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 54, lineHeight: 0.95,
        letterSpacing: '-0.025em', color: TP.ink, marginTop: 16,
        ...revealStyle(shown, animate, 0.12, 12),
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
        <p style={{
          fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.55, color: TP.ink2, margin: '14px 0 0',
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

export function buildModuleRotation(modules) {
  if (!modules) return () => null;
  const kinds = [];
  const firstFutureCountdown = () =>
    (modules.countdowns?.rows || []).find((r) => new Date(r.datetime).getTime() > Date.now()) || null;

  if (firstFutureCountdown()) kinds.push('countdown');
  if (modules.history?.rows?.length) kinds.push('history');
  if (modules.briefs?.rows?.length) kinds.push('briefs');
  if (modules.notd) kinds.push('notd');

  let cursor = 0;

  return function next() {
    if (cursor >= kinds.length) return null;   // exhausted — never repeat
    const kind = kinds[cursor];
    cursor += 1;
    switch (kind) {
      case 'countdown': {
        const row = firstFutureCountdown();
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

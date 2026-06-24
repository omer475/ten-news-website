// TodayPlus Feed — shared card chrome + engagement primitives
// Spec §5 (common), §6 (open stats row), §7 (count-ups, parallax, entrances).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  TP, FONT_HEAD, FONT_BODY, FONT_MONO,
  formatNumber, ageLabel, Markup, plainText,
  shouldAnimateOnce, hasAnimated,
} from './tokens';

// ── hooks ────────────────────────────────────────────────────────────────────

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Fires `onVisible` the first time the element is ≥ threshold visible. */
export function useVisibleOnce(threshold, onVisible) {
  const ref = useRef(null);
  const firedRef = useRef(false);
  const cbRef = useRef(onVisible);
  cbRef.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || firedRef.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold && !firedRef.current) {
            firedRef.current = true;
            cbRef.current?.();
            io.disconnect();
          }
        });
      },
      { threshold: [threshold] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

// ── Entrance (§5 common): fade in + rise 22px at ≥12% visible, once ─────────

export function Entrance({ entryKey, children }) {
  const reduced = useReducedMotion();
  const done = hasAnimated(`enter.${entryKey}`);
  const [shown, setShown] = useState(done);
  const ref = useVisibleOnce(0.12, () => {
    shouldAnimateOnce(`enter.${entryKey}`);
    setShown(true);
  });
  const active = shown || done || reduced;
  return (
    <div
      ref={ref}
      style={{
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(22px)',
        transition: reduced ? 'none' : 'opacity 0.55s cubic-bezier(.2,.7,.2,1), transform 0.55s cubic-bezier(.2,.7,.2,1)',
      }}
    >
      {children}
    </div>
  );
}

// ── Choreographed in-card reveals ───────────────────────────────────────────
// Cards stagger their internal elements (kicker → headline → figure → bullets)
// the first time they're really looked at. One-shot per session; Reduce Motion
// and scroll-backs render the final state instantly.

export function useRevealOnce(key, threshold = 0.3) {
  const reduced = useReducedMotion();
  const done = hasAnimated(`reveal.${key}`);
  const [revealed, setRevealed] = useState(done);
  const ref = useVisibleOnce(threshold, () => {
    shouldAnimateOnce(`reveal.${key}`);
    setRevealed(true);
  });
  const shown = revealed || done || reduced;
  const animate = !reduced && !done;
  return [ref, shown, animate];
}

export const revealStyle = (shown, animate, delay = 0, dy = 12) => ({
  opacity: shown ? 1 : 0,
  transform: shown ? 'none' : `translateY(${dy}px)`,
  transition: animate
    ? `opacity 0.65s cubic-bezier(.2,.7,.2,1) ${delay}s, transform 0.65s cubic-bezier(.2,.7,.2,1) ${delay}s`
    : 'none',
});

// ── Count-up (§7.2): 0 → target, 0.9s ease-out-cubic, once per key ──────────

export function CountUp({ value, prefix = '', unit = '', unitStyle, animKey, style }) {
  const reduced = useReducedMotion();
  const already = hasAnimated(`count.${animKey}`);
  const [display, setDisplay] = useState(already || reduced ? value : 0);
  const rafRef = useRef(null);

  const start = useCallback(() => {
    if (reduced || !shouldAnimateOnce(`count.${animKey}`)) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const hasDecimals = Math.abs(value % 1) > 1e-9;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = value * eased;
      setDisplay(hasDecimals ? v : Math.floor(v));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [value, animKey, reduced]);

  const ref = useVisibleOnce(0.5, start);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{formatNumber(display)}
      {unit ? <span style={unitStyle}>{unit}</span> : null}
    </span>
  );
}

// ── Image parallax (§7.3): ±26px translate, oversized layer, rAF ────────────

// Focus-anchored cropping: when the image aspect doesn't match the container,
// position the crop so display.image_focus sits as close to the visual target
// as possible, clamped so an edge gap can never show. Older articles without
// image_focus fall back to {0.5, 0.5} (the old center crop). Cover passes
// targetY≈0.42 to bias the subject above the scrim/text zone.
export function focusObjectPosition(img, focus, targetY = 0.5) {
  const natW = img.naturalWidth || 0;
  const natH = img.naturalHeight || 0;
  const boxW = img.clientWidth || 0;
  const boxH = img.clientHeight || 0;
  if (!natW || !natH || !boxW || !boxH) return '50% 50%';
  const fx = Number.isFinite(focus?.x) ? Math.min(1, Math.max(0, focus.x)) : 0.5;
  const fy = Number.isFinite(focus?.y) ? Math.min(1, Math.max(0, focus.y)) : 0.5;
  const scale = Math.max(boxW / natW, boxH / natH);
  const sW = natW * scale;
  const sH = natH * scale;
  const overflowX = sW - boxW;
  const overflowY = sH - boxH;
  const posX = overflowX > 0.5
    ? (Math.min(overflowX, Math.max(0, fx * sW - 0.5 * boxW)) / overflowX) * 100
    : 50;
  const posY = overflowY > 0.5
    ? (Math.min(overflowY, Math.max(0, fy * sH - targetY * boxH)) / overflowY) * 100
    : 50;
  return `${posX.toFixed(1)}% ${posY.toFixed(1)}%`;
}

export function ParallaxImage({ src, alt = '', aspectRatio, borderRadius = 26, children, overlay, focus, focusTargetY = 0.5 }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [objectPosition, setObjectPosition] = useState('50% 50%');

  const fx = focus?.x;
  const fy = focus?.y;
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !loaded) return;
    setObjectPosition(focusObjectPosition(img, { x: fx, y: fy }, focusTargetY));
  }, [loaded, fx, fy, focusTargetY]);

  useEffect(() => {
    if (reduced) return undefined;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return undefined;
    let raf = null;
    const update = () => {
      raf = null;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const offsetFromCenter = rect.top + rect.height / 2 - vh / 2;
      const y = (offsetFromCenter / vh) * -26;
      img.style.transform = `translateY(${y}px) scale(1.12)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        aspectRatio,
        borderRadius,
        overflow: 'hidden',
        background: TP.line,
        transform: 'translateZ(0)',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        borderRadius, boxShadow: 'inset 0 0 0 1px rgba(22,21,15,0.05)',
      }} />
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            position: 'absolute',
            inset: '-12% 0',
            width: '100%',
            height: '124%',
            objectFit: 'cover',
            objectPosition,
            transform: reduced ? 'none' : 'scale(1.12)',
            willChange: 'transform',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease-out',
          }}
        />
      ) : null}
      {overlay}
      {children}
    </div>
  );
}


// ── Live countdown chip (add-on, any card) ──────────────────────────────────
// 6px accent dot + mono uppercase "IPO · IN 2D 14H". Ticks per minute (per
// second under 1h); pulses under 24h; date-only datetimes (T00:00:00) show
// IN 3 DAYS / TOMORROW; disappears once the moment passes.

export function TPCountdownChip({ countdown, accent, light = false }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const target = countdown ? new Date(countdown.datetime).getTime() : NaN;
  const remaining = target - now;
  const underHour = remaining > 0 && remaining < 3600000;
  const expired = !countdown || Number.isNaN(target) || remaining <= 0;

  useEffect(() => {
    if (expired) return undefined;
    const id = setInterval(() => setNow(Date.now()), underHour ? 1000 : 60000);
    return () => clearInterval(id);
  }, [underHour, expired]);

  if (expired) return null;

  const dateOnly = /T00:00(:00)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(countdown.datetime || '');
  let when;
  if (dateOnly) {
    const days = Math.ceil(remaining / 86400000);
    when = days <= 1 ? 'TOMORROW' : `IN ${days} DAYS`;
  } else if (remaining >= 86400000) {
    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    when = `IN ${d}D ${h}H`;
  } else if (remaining >= 3600000) {
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    when = `IN ${h}H ${m}M`;
  } else {
    const m = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    when = `IN ${m}M ${String(sec).padStart(2, '0')}S`;
  }
  const text = countdown.label ? `${countdown.label} · ${when}` : when;
  const pulse = !reduced && remaining < 86400000 && !dateOnly;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: light ? 'rgba(255,255,255,0.92)' : TP.ink2,
      whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
    }}>
      <span className={pulse ? 'tp-cd-pulse' : ''} style={{
        width: 6, height: 6, borderRadius: '50%', background: accent,
        '--tp-cd-color': `color-mix(in srgb, ${accent} 55%, transparent)`,
      }} />
      {text}
      <style jsx global>{`
        .tp-cd-pulse { animation: tp-cd-pulse 2s ease-out infinite; }
        @keyframes tp-cd-pulse {
          0% { box-shadow: 0 0 0 0 var(--tp-cd-color); }
          100% { box-shadow: 0 0 0 8px transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-cd-pulse { animation: none !important; }
        }
      `}</style>
    </span>
  );
}

// ── Kicker row (§5 common) ───────────────────────────────────────────────────

// Per user direction (2026-06-12): no written topic/category names on cards —
// the category lives only in the accent color. The row keeps the accent dash
// (a quiet category-color cue) + the right-aligned timestamp.
export function KickerRow({ category, accent, story, prefix, countdown, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      {label ? (
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
          letterSpacing: '0.2em', textTransform: 'uppercase', color: accent,
        }}>{label}</span>
      ) : (
        <span style={{ width: 26, height: 3, borderRadius: 99, background: `color-mix(in srgb, ${accent} 85%, white)`, flexShrink: 0 }} />
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {countdown ? <TPCountdownChip countdown={countdown} accent={accent} /> : null}
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3 }}>
          {ageLabel(story?.publishedAt)}
        </span>
      </span>
    </div>
  );
}

// ── Bullets (§2.4): 6px accent dot, 20px indent ─────────────────────────────

export function Bullets({ bullets, accent, max = 3, reveal }) {
  if (!bullets || bullets.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {bullets.slice(0, max).map((raw, i) => (
        <div key={i} style={{
          position: 'relative', paddingLeft: 20,
          ...(reveal ? revealStyle(reveal.shown, reveal.animate, (reveal.baseDelay || 0) + i * 0.1, 10) : null),
        }}>
          <span style={{
            position: 'absolute', left: 2, top: 8.5, width: 6, height: 6,
            borderRadius: '50%', background: `color-mix(in srgb, ${accent} 80%, white)`,
            boxShadow: `0 0 0 2.5px color-mix(in srgb, ${accent} 12%, transparent)`,
          }} />
          <span style={{
            fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.58, color: TP.ink2,
            letterSpacing: '0.001em',
          }}>
            <Markup raw={raw} emColor={accent} strongColor={TP.ink} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Open stats row (§6) — never inside a box ─────────────────────────────────

export function StatsRow({ stats, accent, cardKey }) {
  const [ref, shown, animate] = useRevealOnce(`stats.${cardKey}`, 0.5);
  if (!stats || stats.length === 0) return null;
  return (
    <div ref={ref} style={{ display: 'flex', gap: 14 }}>
      {stats.slice(0, 3).map((stat, i) => {
        const [label, value, prefix, unit, sub] = stat;
        const delay = i * 0.12;
        return (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              width: 26, height: 3, borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 50%, white))`,
              marginBottom: 10,
              transform: shown ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left',
              transition: animate ? `transform 0.55s cubic-bezier(.2,.7,.2,1) ${delay}s` : 'none',
            }} />
            <div style={revealStyle(shown, animate, delay + 0.08, 8)}>
              <div style={{
                fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 23, lineHeight: 1,
                letterSpacing: '-0.02em', color: TP.ink,
              }}>
                <CountUp
                  value={Number(value) || 0}
                  prefix={prefix || ''}
                  unit={unit || ''}
                  unitStyle={{ fontSize: '0.6em', color: accent, fontWeight: 800 }}
                  animKey={`${cardKey}.stat${i}`}
                />
              </div>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: TP.ink3, marginTop: 7,
              }}>{label}</div>
              {sub ? (
                <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, lineHeight: 1.4, color: TP.ink2, marginTop: 3 }}>{sub}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Footer (§5 common): tag pills + info / bookmark / share ─────────────────

function loadBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem('tp_bookmarks') || '[]')); } catch { return new Set(); }
}

export function CardFooter({ story, tags, onOpen }) {
  const reduced = useReducedMotion();
  const [bookmarked, setBookmarked] = useState(false);
  const [pop, setPop] = useState(false);
  const id = String(story.id || '');

  useEffect(() => { setBookmarked(loadBookmarks().has(id)); }, [id]);

  const toggleBookmark = (e) => {
    e.stopPropagation();
    const set = loadBookmarks();
    if (set.has(id)) set.delete(id); else set.add(id);
    try { localStorage.setItem('tp_bookmarks', JSON.stringify([...set])); } catch {}
    setBookmarked(set.has(id));
    if (!reduced) {
      setPop(true);
      setTimeout(() => setPop(false), 400);
    }
  };

  const share = async (e) => {
    e.stopPropagation();
    const title = story.display ? plainText(story.display.title) : (story.title_news || story.title || '');
    const url = story.url && story.url !== '#' ? story.url : (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(`${title} ${url}`);
    } catch {}
  };

  const iconBtn = (onClick, label, svg, tint = TP.ink3, extra = {}) => (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        all: 'unset', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint,
        flexShrink: 0, WebkitTapHighlightColor: 'transparent', ...extra,
      }}
    >{svg}</button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <div style={{ flex: 1 }} />
      {/* tag chips removed per design — feed stays clean */}
      {iconBtn(toggleBookmark, 'Bookmark', (
        <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? TP.gold : 'none'} stroke={bookmarked ? TP.gold : 'currentColor'} strokeWidth="1.6" strokeLinejoin="round"><path d="M6 3.8h12a.7.7 0 01.7.7v15.6a.4.4 0 01-.64.32L12 16l-6.06 4.42a.4.4 0 01-.64-.32V4.5a.7.7 0 01.7-.7z"/></svg>
      ), bookmarked ? TP.gold : TP.ink3, {
        transform: pop ? 'scale(1.3)' : 'scale(1)',
        transition: reduced ? 'none' : 'transform 0.4s cubic-bezier(.3,1.8,.4,1)',
      })}
      {iconBtn(share, 'Share', (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 13v6.2a.8.8 0 00.8.8h12.4a.8.8 0 00.8-.8V13"/></svg>
      ))}
    </div>
  );
}

// ── Headline ─────────────────────────────────────────────────────────────────

export function Headline({ raw, accent, size = 24, color = TP.ink, as: Tag = 'h2', style }) {
  return (
    <Tag style={{
      fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size, lineHeight: 1.16,
      letterSpacing: '-0.015em', color, margin: 0,
      textWrap: 'balance', fontOpticalSizing: 'auto',
      ...style,
    }}>
      <Markup raw={raw} emColor={accent} strongColor={color} strongWeight={800} />
    </Tag>
  );
}

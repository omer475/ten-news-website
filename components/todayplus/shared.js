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

export function ParallaxImage({ src, alt = '', aspectRatio, borderRadius = 22, children, overlay }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const imgRef = useRef(null);

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
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: '-12% 0',
            width: '100%',
            height: '124%',
            objectFit: 'cover',
            transform: reduced ? 'none' : 'scale(1.12)',
            willChange: 'transform',
          }}
        />
      ) : null}
      {overlay}
      {children}
    </div>
  );
}

// ── Kicker row (§5 common) ───────────────────────────────────────────────────

// Per user direction (2026-06-12): no written topic/category names on cards —
// the category lives only in the accent color. The row keeps the accent dash
// (a quiet category-color cue) + the right-aligned timestamp.
export function KickerRow({ category, accent, story, prefix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ width: 22, height: 2, borderRadius: 2, background: accent }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3 }}>
        {ageLabel(story?.publishedAt)}
      </span>
    </div>
  );
}

// ── Bullets (§2.4): 6px accent dot, 20px indent ─────────────────────────────

export function Bullets({ bullets, accent, max = 3 }) {
  if (!bullets || bullets.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {bullets.slice(0, max).map((raw, i) => (
        <div key={i} style={{ position: 'relative', paddingLeft: 20 }}>
          <span style={{
            position: 'absolute', left: 2, top: 8, width: 6, height: 6,
            borderRadius: '50%', background: accent,
          }} />
          <span style={{
            fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: TP.ink2,
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
  if (!stats || stats.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {stats.slice(0, 3).map((stat, i) => {
        const [label, value, prefix, unit, sub] = stat;
        return (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ width: 22, height: 2, borderRadius: 2, background: accent, marginBottom: 10 }} />
            <div style={{
              fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 26, lineHeight: 1,
              letterSpacing: '-0.04em', color: TP.ink,
            }}>
              <CountUp
                value={Number(value) || 0}
                prefix={prefix || ''}
                unit={unit || ''}
                unitStyle={{ fontSize: '0.6em', color: accent }}
                animKey={`${cardKey}.stat${i}`}
              />
            </div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: TP.ink3, marginTop: 7,
            }}>{label}</div>
            {sub ? (
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: TP.ink2, marginTop: 2 }}>{sub}</div>
            ) : null}
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
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', flex: 1, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {(tags || []).map((tag) => (
          <span key={tag} style={{
            fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: TP.ink2,
            border: `1px solid ${TP.line}`, borderRadius: 99, padding: '7px 13px',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{tag}</span>
        ))}
      </div>
      {iconBtn((e) => { e.stopPropagation(); onOpen?.(story); }, 'Details', (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.2M12 7.6v.2"/></svg>
      ))}
      {iconBtn(toggleBookmark, 'Bookmark', (
        <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? TP.gold : 'none'} stroke={bookmarked ? TP.gold : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round"><path d="M6 3.8h12a.7.7 0 01.7.7v15.6a.4.4 0 01-.64.32L12 16l-6.06 4.42a.4.4 0 01-.64-.32V4.5a.7.7 0 01.7-.7z"/></svg>
      ), bookmarked ? TP.gold : TP.ink3, {
        transform: pop ? 'scale(1.3)' : 'scale(1)',
        transition: reduced ? 'none' : 'transform 0.4s cubic-bezier(.3,1.8,.4,1)',
      })}
      {iconBtn(share, 'Share', (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 13v6.2a.8.8 0 00.8.8h12.4a.8.8 0 00.8-.8V13"/></svg>
      ))}
    </div>
  );
}

// ── Headline ─────────────────────────────────────────────────────────────────

export function Headline({ raw, accent, size = 24, color = TP.ink, as: Tag = 'h2' }) {
  return (
    <Tag style={{
      fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size, lineHeight: 1.13,
      letterSpacing: '-0.03em', color, margin: 0,
    }}>
      <Markup raw={raw} emColor={accent} strongColor={color} strongWeight={800} />
    </Tag>
  );
}

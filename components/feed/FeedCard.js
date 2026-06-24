'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import GraphChart from '../GraphChart';

// Mapbox is heavy + needs the browser — load it only when a map box is shown.
const MapboxMap = dynamic(() => import('../MapboxMap'), { ssr: false });

// Apple system font (SF Pro) — used across the card for a clean, smooth feel.
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';

// Real liquid glass (same multi-layer specular highlights as the onboarding GlassTile).
const GLASS_SHADOW = 'inset 0 0 0 0.5px rgba(255,255,255,0.35), inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.7), inset -1px -1px 0px -1px rgba(255,255,255,0.5), inset -1.5px -4px 0.5px -3px rgba(255,255,255,0.4), inset -0.15px -0.5px 2px 0px rgba(0,0,0,0.06), inset -0.75px 1.25px 0px -1px rgba(0,0,0,0.08), inset 0px 1.5px 2px -1px rgba(0,0,0,0.06), 0px 0.5px 2.5px 0px rgba(0,0,0,0.04), 0px 2px 6px 0px rgba(0,0,0,0.03)';

/*
 * FeedCard — one article in the continuous (Threads/X-style) feed.
 * Faithful port of the iOS app's ArticleCardView: header row → inline image
 * (18px radius, side margins) → title → up to 3 bullets → action row → info boxes.
 * Self-contained: owns its own expand/collapse + carousel state so it can drop
 * into a plain scroll list without touching the page's global state soup.
 */

// 8-color rotating bullet-dot palette (matches the app exactly)
const BULLET_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA', '#FF2D55', '#FFD60A'];

// Category gradient fallback when no image / before color extraction (mirrors index.js)
const CATEGORY_GRADIENTS = {
  Tech: ['#667eea', '#764ba2'], Technology: ['#667eea', '#764ba2'],
  Business: ['#11998e', '#38ef7d'], Finance: ['#f093fb', '#f5576c'],
  Politics: ['#4facfe', '#00f2fe'], World: ['#43e97b', '#38f9d7'],
  Science: ['#fa709a', '#fee140'], Health: ['#a8edea', '#fed6e3'],
  Sports: ['#ff9a9e', '#fecfef'], Crypto: ['#f7971e', '#ffd200'],
  News: ['#667eea', '#764ba2'],
};

function gradientFor(category) {
  const c = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.News;
  return `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`;
}

// Hero image fades to fully transparent at the bottom so the card's rounded
// bottom corners + page background show through (photo dissolves into the page).
// Gentle now that the headline sits below the photo, so most of the image stays.
const BOTTOM_FADE = 'linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)';

// Titles: strip the "**" emphasis markers entirely — no highlighted words.
function renderPlain(text) {
  if (!text) return null;
  return String(text).replace(/\*\*/g, '');
}

// Bullets: "**word**" → bold (same text color, no accent tint).
function renderBold(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Title: "**word**" → colored with the image's dominant accent, rest stays white.
function renderHighlight(text, color) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} style={{ color }}>{part.slice(2, -2)}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// "rgb(r,g,b)" or "#rrggbb" → translucent rgba(...) — for accent-tinted chips/boxes.
function withAlpha(color, a) {
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith('rgb(')) return `rgba(${color.slice(4, -1)}, ${a})`;
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Compact HSL→RGB (h 0-360, s/l 0-100) for the category-fallback accent.
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

// Per-story fallback accent when the photo's colour can't be read (no image / blocked).
// Hue from the category, nudged by the story id so neighbouring cards still differ.
const CATEGORY_HUE = {
  WORLD: 212, POLITICS: 354, BUSINESS: 150, FINANCE: 145, ECONOMY: 150,
  TECHNOLOGY: 265, TECH: 265, SCIENCE: 188, HEALTH: 330, SPORTS: 22,
  ENTERTAINMENT: 286, CULTURE: 286, CRYPTO: 38, CLIMATE: 162, ENVIRONMENT: 162,
};
function accentForCategory(category, id) {
  const key = String(category || '').toUpperCase().replace(/\s+/g, '').replace(/NEWS$/, '');
  const baseHue = CATEGORY_HUE[key] != null ? CATEGORY_HUE[key] : 212;
  const hash = String(id || category || 'x').split('').reduce((a, c) => c.charCodeAt(0) + ((a << 5) - a), 0);
  const hue = ((baseHue + (Math.abs(hash) % 31) - 15) + 360) % 360;
  const [r, g, b] = hslToRgb(hue, 68, 62);
  return `rgb(${r}, ${g}, ${b})`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Source → logo via Google's favicon service (no extra deps, works for any domain-ish name)
function logoFor(source) {
  if (!source) return null;
  const domain = String(source).toLowerCase().replace(/\s+/g, '') + '.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// Which info boxes this story actually has, in the right order (mirrors index.js)
function availableInfoTypes(story) {
  const has = (t) => {
    switch (t) {
      case 'details': return story.details && story.details.length > 0;
      case 'timeline': return story.timeline && story.timeline.length > 0;
      case 'map': return !!story.map;
      case 'graph': return !!story.graph;
      case 'scorecard': return !!story.scorecard;
      case 'recipe': return !!story.recipe;
      default: return false;
    }
  };
  if (Array.isArray(story.components) && story.components.length > 0) {
    return story.components.filter(has);
  }
  return ['scorecard', 'recipe', 'details', 'timeline', 'map', 'graph'].filter(has);
}

const INFO_LABEL = {
  details: 'Details', timeline: 'Timeline', map: 'Map',
  graph: 'Chart', scorecard: 'Score', recipe: 'Recipe',
};

// Small line glyph per info-box type — gives the switcher pills + box a newsy, structured feel.
function InfoIcon({ type, color = 'currentColor', size = 14 }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const glyph = {
    details: <><circle cx="12" cy="12" r="9" {...s} /><path d="M12 11v5M12 7.6h.01" {...s} /></>,
    timeline: <><circle cx="12" cy="12" r="9" {...s} /><path d="M12 7v5l3 2" {...s} /></>,
    map: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" {...s} /><circle cx="12" cy="10" r="2.4" {...s} /></>,
    graph: <><path d="M4 5v14h16M8 15l3-4 3 2 4-6" {...s} /></>,
    scorecard: <><path d="M7 4h10v3a5 5 0 0 1-10 0V4zM9 20h6M12 12v4" {...s} /></>,
    recipe: <><path d="M7 3v6a2 2 0 0 0 4 0V3M9 9v12M16.5 3C15 3 14 5 14 8s1 3.5 2.5 3.5V21" {...s} /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>{glyph[type] || glyph.details}</svg>;
}

export default function FeedCard({ story, isDark = false, onOpen, onEngage, minimal = false, textOnly = false }) {
  const colors = {
    text: isDark ? '#F5F5F7' : '#1d1d1f',
    secondary: isDark ? '#86868B' : '#6e6e73',
    chipBg: isDark ? 'rgba(245,245,247,0.06)' : '#F2F2F4',
    chipText: isDark ? 'rgba(245,245,247,0.66)' : '#5a5a5f',
    divider: isDark ? 'rgba(245,245,247,0.10)' : 'rgba(0,0,0,0.06)',
    glassBg: isDark ? 'rgba(245,245,247,0.05)' : 'rgba(0,0,0,0.04)',
    cardBg: isDark ? 'transparent' : '#FFFFFF',
    actionHover: isDark ? 'rgba(245,245,247,0.10)' : 'rgba(0,0,0,0.05)',
  };

  const title = story.title_news || story.title || '';
  const bullets = (story.summary_bullets_news || story.summary_bullets || []).slice(0, 3);
  const entities = (story.interest_tags || []).slice(0, 3);
  const [saved, setSaved] = useState(false);

  const handleShare = useCallback(async (e) => {
    e && e.stopPropagation();
    const url = story.url || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (_) { /* user cancelled share — ignore */ }
  }, [story, title]);
  const imageUrl = useMemo(() => {
    const raw = story.urlToImage || story.image_url;
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.length < 5 || ['null', 'undefined', 'none'].includes(s.toLowerCase())) return null;
    return s;
  }, [story]);

  // --- accent colour pulled from the hero photo; the title's highlighted words use it ---
  // The visible <img> is cross-origin and would taint a canvas, so we read pixels from a
  // small CORS-enabled proxy copy of the same photo. Falls back to a per-story colour.
  const fallbackAccent = useMemo(() => accentForCategory(story.category, story.id), [story.category, story.id]);
  const [accent, setAccent] = useState(fallbackAccent);
  useEffect(() => { setAccent(fallbackAccent); }, [fallbackAccent]);

  useEffect(() => {
    if (!imageUrl || typeof window === 'undefined') return;
    let cancelled = false;
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}&w=56&h=56&fit=cover&output=jpg`;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement('canvas');
        const w = (c.width = img.naturalWidth || 56);
        const h = (c.height = img.naturalHeight || 56);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const cr = data[i], cg = data[i + 1], cb = data[i + 2];
          const max = Math.max(cr, cg, cb), min = Math.min(cr, cg, cb);
          // bias toward saturated, mid-bright pixels — skip greys / too dark / blown-out
          if (max - min < 28 || max < 55 || max > 245) continue;
          r += cr; g += cg; b += cb; n++;
        }
        if (n > 0) {
          r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
          // keep the hue but lift dark colours so they read on the dark card
          const mx = Math.max(r, g, b);
          if (mx < 165) {
            const k = 165 / Math.max(mx, 1);
            r = Math.min(255, Math.round(r * k));
            g = Math.min(255, Math.round(g * k));
            b = Math.min(255, Math.round(b * k));
          }
          setAccent(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (_) { /* keep fallback */ }
    };
    img.src = proxied;
    return () => { cancelled = true; img.onload = null; };
  }, [imageUrl]);

  // --- info boxes ---
  const infoTypes = useMemo(() => availableInfoTypes(story), [story]);
  const [activeInfo, setActiveInfo] = useState(infoTypes[0] || null);
  const [infoExpanded, setInfoExpanded] = useState(false);
  useEffect(() => { setActiveInfo(infoTypes[0] || null); }, [story]); // eslint-disable-line

  // --- multi-page carousel ---
  const pages = Array.isArray(story.pages) && story.pages.length > 1 ? story.pages : null;
  const [page, setPage] = useState(0);
  const scrollerRef = useRef(null);
  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== page) setPage(idx);
  }, [page]);

  const handleOpen = useCallback(() => {
    onEngage && onEngage(story);
    onOpen && onOpen(story);
  }, [story, onOpen, onEngage]);

  return (
    <article
      style={{
        padding: '18px 16px',
        borderBottom: `0.5px solid ${colors.divider}`,
        background: colors.cardBg,
        maxWidth: 640,
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: APPLE_FONT,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}
    >
      {/* Hero image — hidden in text-only mode */}
      {!textOnly && (
      <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', marginBottom: 14 }}>
        {pages ? (
          <div ref={scrollerRef} onScroll={onScroll}
               style={{
                 display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
                 gap: 0, scrollbarWidth: 'none',
               }}>
            {pages.map((p, i) => (
              <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                {(p.image || imageUrl) ? (
                  <img src={p.image || imageUrl} alt=""
                       style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block',
                                WebkitMaskImage: BOTTOM_FADE, maskImage: BOTTOM_FADE }}
                       referrerPolicy="no-referrer" />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '3 / 2', background: gradientFor(story.category) }} />
                )}
              </div>
            ))}
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: '100%', maxHeight: '74vh', objectFit: 'cover', display: 'block',
                     WebkitMaskImage: BOTTOM_FADE, maskImage: BOTTOM_FADE }}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '3 / 2', background: gradientFor(story.category) }} />
        )}

        {/* page dots (carousel) — top centre over the image */}
        {pages && (
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {pages.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === page ? '#fff' : 'rgba(255,255,255,0.45)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }} />
            ))}
          </div>
        )}

        {/* category chip — floating top-left, picks up the photo's accent for a pop of colour */}
        {story.category && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px 5px 8px', borderRadius: 999,
            background: 'rgba(0,0,0,0.40)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '0.5px solid rgba(255,255,255,0.16)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff' }}>
              {story.category}
            </span>
          </div>
        )}
      </div>
      )}

      {/* Headline block — below the photo so the image stays fully visible */}
      <div onClick={handleOpen} style={{ cursor: 'pointer', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
          {textOnly && story.category && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent }}>
              {story.category}
            </span>
          )}
          {logoFor(story.source) && (
            <img src={logoFor(story.source)} alt="" width={16} height={16}
                 style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                 referrerPolicy="no-referrer"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.01em', color: colors.text }}>
            {story.source || 'Today+'}
          </span>
          <span style={{ fontSize: 12, lineHeight: 1, color: colors.secondary }}>·</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: colors.secondary }}>
            {timeAgo(story.publishedAt || story.published_at)}
          </span>
        </div>
        <h2 style={{
          margin: 0,
          fontSize: 25, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.26,
          color: colors.text,
        }}>
          {renderHighlight(pages ? (pages[page].title || title) : title, accent)}
        </h2>
      </div>

      {/* Bullets (up to 3) */}
      {(pages ? pages[page].bullets : bullets) && (pages ? pages[page].bullets : bullets).length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(pages ? (pages[page].bullets || []) : bullets).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', marginTop: 10, flexShrink: 0,
                background: withAlpha(accent, 1 - i * 0.22),
              }} />
              <div style={{ fontSize: 18, lineHeight: 1.5, color: colors.text, letterSpacing: '-0.2px' }}>
                {renderBold(b)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info boxes — interactive context under the bullets (timeline · map · chart · details · score · recipe) */}
      {!minimal && infoTypes.length > 0 && activeInfo && (
        <div style={{ marginTop: 16 }}>
          {/* switcher pills — only when there's more than one type to choose from */}
          {infoTypes.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {infoTypes.map((t) => {
                const on = t === activeInfo;
                return (
                  <button key={t} onClick={() => { setActiveInfo(t); setInfoExpanded(false); }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            border: `0.5px solid ${on ? 'transparent' : colors.divider}`,
                            cursor: 'pointer', borderRadius: 999, padding: '6px 12px',
                            fontSize: 12, fontWeight: 600,
                            background: on ? withAlpha(accent, 0.16) : colors.chipBg,
                            color: on ? accent : colors.chipText,
                            transition: 'background 0.15s ease, color 0.15s ease',
                          }}>
                    <InfoIcon type={t} color={on ? accent : colors.chipText} />
                    {INFO_LABEL[t]}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{
            borderRadius: 18, padding: 16,
            // Real liquid glass — same recipe as the onboarding country/interest tiles.
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: GLASS_SHADOW,
          }}>
            <InfoBox type={activeInfo} story={story} accent={accent} colors={colors}
                     expanded={infoExpanded} onToggle={() => setInfoExpanded((v) => !v)} />
          </div>
        </div>
      )}

      {/* Action row: entities on the left, Save + Share on the right (app layout) */}
      {!minimal && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        {/* Entities (interest_tags) — horizontally scrollable, takes remaining space */}
        <div style={{
          display: 'flex', gap: 6, flex: 1, minWidth: 0,
          overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {entities.map((tag, i) => (
            <span key={i} style={{
              flexShrink: 0,
              fontSize: 12.5, fontWeight: 500, lineHeight: 1,
              color: colors.chipText, background: colors.chipBg,
              padding: '6px 11px', borderRadius: 999, whiteSpace: 'nowrap',
              textTransform: 'capitalize',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Save + Share */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <ActionButton
            label={saved ? 'Saved' : 'Save'}
            isDark={isDark}
            active={saved}
            activeColor={accent}
            restColor={colors.text}
            onClick={(e) => { e.stopPropagation(); setSaved((v) => !v); }}
          >
            <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-3.6L6 20z"
                  fill={saved ? 'currentColor' : 'none'} stroke="currentColor"
                  strokeWidth={1.7} strokeLinejoin="round" />
          </ActionButton>
          <ActionButton label="Share" isDark={isDark} restColor={colors.text} onClick={handleShare}>
            <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M8 7l4-4 4 4" />
              <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </g>
          </ActionButton>
        </div>
      </div>
      )}
    </article>
  );
}

// Bare icon action (Save / Share) — no box, just the glyph with subtle hover + press.
function ActionButton({ children, label, onClick, active, activeColor, restColor }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
        color: active ? activeColor : restColor,
        opacity: active ? 1 : (hover ? 1 : 0.6),
        transform: press ? 'scale(0.86)' : 'scale(1)',
        transition: 'transform 0.1s ease, color 0.18s ease, opacity 0.18s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width={22} height={22} viewBox="0 0 24 24">{children}</svg>
    </button>
  );
}

// --- individual info boxes ---
function InfoBox({ type, story, accent, colors, expanded, onToggle }) {
  if (type === 'graph' && story.graph) {
    // Light data card (charts read best on white): accent title + expand arrow + line chart.
    return (
      <div style={{ position: 'relative', background: '#FFFFFF', borderRadius: 16, padding: '14px 14px 6px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}>
        {story.graph.title && (
          <div style={{ fontSize: 14, fontWeight: 800, color: accent, lineHeight: 1.2, marginBottom: 8, paddingRight: 26, letterSpacing: '-0.2px' }}>
            {story.graph.title}
          </div>
        )}
        <button onClick={onToggle} aria-label={expanded ? 'Collapse chart' : 'Expand chart'} style={{
          position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent',
          cursor: 'pointer', color: '#1d1d1f', padding: 0, lineHeight: 0,
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {expanded
              ? <path d="M10 14 4 20M4 15v5h5M14 10l6-6M20 9V4h-5" />
              : <path d="M7 17 17 7M9 7h8v8" />}
          </svg>
        </button>
        <div style={{ height: expanded ? 240 : 150, width: '100%' }}>
          <GraphChart graph={story.graph} expanded={expanded} accentColor={accent} />
        </div>
      </div>
    );
  }
  if (type === 'map' && story.map) {
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        {/* position:relative is REQUIRED — MapboxMap renders position:absolute inset:0,
            so without a positioned wrapper it escapes and fills the whole viewport. */}
        <div style={{ position: 'relative', height: expanded ? 240 : 92, borderRadius: 16, overflow: 'hidden' }}>
          <MapboxMap
            center={story.map.center || { lat: 0, lon: 0 }}
            markers={story.map.markers || []}
            expanded={expanded}
            highlightColor={accent}
            locationType={story.map.location_type || 'auto'}
            regionName={story.map.region_name || null}
            location={story.map.location || story.map.name || null}
          />
        </div>
      </Expandable>
    );
  }
  if (type === 'timeline' && story.timeline) {
    const items = expanded ? story.timeline : story.timeline.slice(0, 3);
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: accent }}>{t.date || t.time}</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.4 }}>{t.text || t.event}</div>
              </div>
            </div>
          ))}
        </div>
      </Expandable>
    );
  }
  if (type === 'details' && story.details) {
    // Stat row (image): up to 3 columns separated by thin dividers — uppercase label,
    // big accent number, small unit. The number/unit are split off the value string.
    const items = story.details.slice(0, 3);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, alignItems: 'start' }}>
        {items.map((d, i) => {
          const label = d.label || d.name || '';
          const raw = String(d.value ?? d.description ?? '');
          const m = raw.match(/^([^a-zA-Z]*[0-9][^a-zA-Z]*)\s*(.*)$/);
          const value = m ? m[1].trim() : raw;
          const unit = m ? m[2].trim() : '';
          // Big & bold for short number-like values (100, 2024); smaller for text facts.
          const len = value.length;
          const valueSize = len <= 5 ? 30 : len <= 9 ? 22 : len <= 16 ? 16 : 14;
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: '2px 8px',
              borderLeft: i > 0 ? `1px solid ${colors.divider}` : 'none',
            }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 9 }}>
                {label}
              </span>
              <span style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 1.15, letterSpacing: valueSize >= 22 ? '-0.5px' : '-0.1px', color: accent }}>
                {value}
              </span>
              {unit && <span style={{ fontSize: 12, color: colors.secondary, marginTop: 7 }}>{unit}</span>}
            </div>
          );
        })}
      </div>
    );
  }
  // scorecard / recipe / fallback: simple structured render
  if (type === 'scorecard' && story.scorecard) {
    const s = story.scorecard;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{s.home_team || s.homeTeam}</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: accent }}>{s.home_score ?? s.homeScore}</span>
        <span style={{ color: colors.secondary }}>:</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: colors.text }}>{s.away_score ?? s.awayScore}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{s.away_team || s.awayTeam}</span>
      </div>
    );
  }
  if (type === 'recipe' && story.recipe) {
    const r = story.recipe;
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
    const steps = Array.isArray(r.steps) ? r.steps : (Array.isArray(r.instructions) ? r.instructions : []);
    const meta = [
      r.prep_time && ['Prep', r.prep_time],
      r.cook_time && ['Cook', r.cook_time],
      (r.servings || r.serves) && ['Serves', r.servings || r.serves],
    ].filter(Boolean);
    const shownSteps = expanded ? steps : steps.slice(0, 3);
    const shownIng = expanded ? ingredients : ingredients.slice(0, 6);
    const txt = (x) => (typeof x === 'string' ? x : (x && (x.text || x.step || x.name || x.item)) || '');
    const body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {meta.length > 0 && (
          <div style={{ display: 'flex', gap: 18 }}>
            {meta.map(([label, value], i) => (
              <div key={i}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: colors.secondary }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: accent }}>{value}</div>
              </div>
            ))}
          </div>
        )}
        {shownIng.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {shownIng.map((ing, i) => (
              <span key={i} style={{ fontSize: 12.5, color: colors.chipText, background: colors.chipBg, padding: '5px 10px', borderRadius: 999 }}>
                {txt(ing)}
              </span>
            ))}
          </div>
        )}
        {shownSteps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shownSteps.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: withAlpha(accent, 0.18), color: accent,
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: colors.text }}>{txt(st)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
    const hasMore = steps.length > 3 || ingredients.length > 6;
    return hasMore
      ? <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>{body}</Expandable>
      : body;
  }
  return null;
}

function Expandable({ expanded, onToggle, colors, children }) {
  return (
    <div>
      {children}
      <button onClick={onToggle} style={{
        marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, color: colors.secondary, padding: 0,
      }}>
        {expanded ? 'Show less ▲' : 'Show more ▼'}
      </button>
    </div>
  );
}

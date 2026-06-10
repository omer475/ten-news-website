'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import GraphChart from '../GraphChart';

// Mapbox is heavy + needs the browser — load it only when a map box is shown.
const MapboxMap = dynamic(() => import('../MapboxMap'), { ssr: false });

// Apple system font (SF Pro) — used across the card for a clean, smooth feel.
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';

// Apple's standard iOS System Colors (light/default sRGB). Each article's
// highlighted words are tinted with whichever of these is CLOSEST to the
// dominant colour of its hero photo — so the accent always harmonises with
// the image, but only ever Apple's own palette is used.
// Highlight palette: Apple's curated system colours PLUS a dense wheel of vivid,
// white-readable hues sharing Apple's characteristics (high saturation, moderate
// lightness). The dense wheel means a photo's dominant colour almost always finds
// a close, sensible match instead of snapping to a far-off swatch.
const APPLE_SYSTEM_COLORS = (() => {
  const base = [
    // Apple's standard iOS System Colors…
    [255, 59, 48],   // red      #FF3B30
    [255, 149, 0],   // orange   #FF9500
    [255, 204, 0],   // yellow   #FFCC00
    [52, 199, 89],   // green    #34C759
    [0, 199, 190],   // mint     #00C7BE
    [48, 176, 199],  // teal     #30B0C7
    [50, 173, 230],  // cyan     #32ADE6
    [0, 122, 255],   // blue     #007AFF
    [88, 86, 214],   // indigo   #5856D6
    [175, 82, 222],  // purple   #AF52DE
    [255, 45, 85],   // pink     #FF2D55
    // (brown + gray intentionally excluded — highlights should read as a vivid hue)
  ];
  // ~44 evenly-spaced hues, two saturation/lightness rings, all readable on white.
  const wheel = [];
  const STEPS = 22;
  for (let i = 0; i < STEPS; i++) {
    const h = i / STEPS;
    // Yellow/green band is intrinsically light → darken it so it still reads on white.
    const lift = (h > 0.10 && h < 0.46) ? 0.07 : 0;
    wheel.push(hslToRgb(h, 0.88, 0.50 - lift)); // vivid ring
    wheel.push(hslToRgb(h, 0.72, 0.42 - lift)); // deeper ring (more "ink"-like)
  }
  return base.concat(wheel);
})();

// Sensible per-category Apple colour when there's no photo to sample.
const CATEGORY_APPLE = {
  TECHNOLOGY: [0, 122, 255], TECH: [0, 122, 255],
  BUSINESS: [52, 199, 89], FINANCE: [52, 199, 89], ECONOMY: [52, 199, 89],
  POLITICS: [255, 59, 48], WORLD: [88, 86, 214],
  SCIENCE: [48, 176, 199], HEALTH: [255, 45, 85],
  SPORTS: [255, 149, 0], CRYPTO: [255, 149, 0],
  ENTERTAINMENT: [175, 82, 222], CULTURE: [175, 82, 222],
  CLIMATE: [52, 199, 89], ENVIRONMENT: [52, 199, 89],
};

const rgbStr = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// Perceptual-ish nearest Apple colour (weighted RGB / "redmean"-style distance).
function nearestAppleColor([r, g, b]) {
  let best = APPLE_SYSTEM_COLORS[7], bestD = Infinity; // default blue
  for (const c of APPLE_SYSTEM_COLORS) {
    const rm = (r + c[0]) / 2;
    const dr = r - c[0], dg = g - c[1], db = b - c[2];
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// --- HSL <-> RGB + WCAG contrast, used to keep the tint readable on the card bg ---
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function relLum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// Nudge lightness until the tint clears ~3:1 against the card background, keeping its hue.
function makeReadable(rgb, isDark) {
  const bg = isDark ? [10, 10, 12] : [255, 255, 255];
  let [h, s, l] = rgbToHsl(...rgb);
  let out = rgb, guard = 0;
  while (contrast(out, bg) < 3.0 && guard++ < 24) {
    l = isDark ? Math.min(0.92, l + 0.035) : Math.max(0.16, l - 0.035);
    out = hslToRgb(h, s, l);
  }
  return out;
}
function categoryAppleColor(category, isDark) {
  const key = String(category || '').toUpperCase().replace(/\s+/g, '').replace(/NEWS$/, '');
  const base = CATEGORY_APPLE[key] || APPLE_SYSTEM_COLORS[7];
  return rgbStr(makeReadable(base, isDark));
}
// Parse an "rgb(r, g, b)" / "#rrggbb" string back to [r,g,b].
function parseRgb(color) {
  if (!color) return [0, 0, 0];
  if (color.startsWith('rgb')) return color.slice(color.indexOf('(') + 1, -1).split(',').map((n) => parseInt(n, 10));
  const h = color.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// Opposite hue (+180°) of the article accent, kept saturated + readable on the bg.
function complementOf(color, isDark) {
  let [h, s, l] = rgbToHsl(...parseRgb(color));
  h = (h + 0.5) % 1;
  s = Math.min(1, Math.max(s, 0.6));
  return rgbStr(makeReadable(hslToRgb(h, s, l), isDark));
}

// RGB(0-255) → HSL in degrees / percent.
function hsl255(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Pick the highlight colour the SAME WAY the iOS "blur" colour was chosen — the
// dominant saturated hue of the photo's BOTTOM HALF, with the same hue-weighted
// scoring — but render it as a LIGHT-THEME colour (readable on white) instead of
// the dark ~10%-lightness blur. Returns an [r,g,b] or null (→ category fallback).
function pickBlurHueLight(data, W, H) {
  const bottomStart = (H / 2) | 0;
  const buckets = {};
  const total = W * H;
  for (let i = 0; i < total * 4; i += 10 * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 125) continue;
    if (r > 250 && g > 250 && b > 250) continue;
    if (r < 10 && g < 10 && b < 10) continue;
    const rK = ((r / 15) | 0) * 15, gK = ((g / 15) | 0) * 15, bK = ((b / 15) | 0) * 15;
    const key = rK + ',' + gK + ',' + bK;
    const pixelIdx = (i / 4) | 0;
    const px = ((pixelIdx % W) / 10) | 0;
    const py = (((pixelIdx / W) | 0) / 10) | 0;
    const isBottom = ((pixelIdx / W) | 0) >= bottomStart;
    let bk = buckets[key];
    if (!bk) bk = buckets[key] = { count: 0, bottomCount: 0, positions: new Set(), rK, gK, bK };
    bk.count++; if (isBottom) bk.bottomCount++; bk.positions.add(px + ',' + py);
  }
  const vals = Object.values(buckets);
  if (!vals.length) return null;
  const maxCoverage = Math.max(1, ...vals.map((b) => b.positions.size));
  const bottom = vals.filter((b) => b.bottomCount > 0).sort((a, b) => b.bottomCount - a.bottomCount);
  if (!bottom.length) return null;
  let best = bottom[0], bestScore = -1;
  const maxBottom = bottom[0].bottomCount || 1;
  for (const bk of bottom) {
    const hsl = hsl255(bk.rK, bk.gK, bk.bK);
    const freq = bk.bottomCount / maxBottom;
    let score = freq * 0.4 + (hsl.s / 100) * 0.45 + (bk.positions.size / maxCoverage) * 0.15;
    const muddy = hsl.h >= 20 && hsl.h <= 55 && hsl.s < 35;
    if (muddy && freq < 0.7) score *= 0.3;
    if (hsl.s < 15 && hsl.l < 30) score *= 0.4;
    if (hsl.s >= 40) {
      if (hsl.h >= 180 && hsl.h <= 300) score *= 1.3;
      if (hsl.h >= 330 || hsl.h <= 15) score *= 1.25;
      if (hsl.h >= 100 && hsl.h <= 170) score *= 1.2;
      if (hsl.h >= 40 && hsl.h <= 70) score *= 1.2;
      if (hsl.h >= 15 && hsl.h <= 40) score *= 1.15;
    }
    if (score > bestScore) { bestScore = score; best = bk; }
  }
  const blurHSL = hsl255(best.rK, best.gK, best.bK);
  if (blurHSL.s < 12) return null; // greyscale bottom → category fallback
  let finalH = blurHSL.h, finalS = blurHSL.s;
  // Same hue nudges the blur used so pure yellow/lime don't wash out on white.
  if (finalH >= 50 && finalH <= 65) { finalH = 35; finalS = Math.max(finalS, 65); }
  else if (finalH >= 65 && finalH <= 85) { finalH = 45; finalS = Math.max(finalS, 55); }
  finalS = Math.max(58, Math.min(85, finalS * 1.1));
  // Light-theme lightness, then guarantee ≥3:1 contrast on white.
  return makeReadable(hslToRgb(finalH / 360, finalS / 100, 0.44), false);
}

/*
 * FeedCard — one article in the continuous feed.
 * Apple-editorial styling: every article shares ONE flat background (no per-card
 * box/shadow), a single ink colour for headlines (emphasis from weight, never
 * hue), one quiet bullet dot, a single restrained blue accent, and compact type.
 */

// Category gradient fallback when there's no usable hero photo (mirrors index.js).
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

// Titles + bullets: "**word**" → tinted with the article's Apple accent colour
// and semibold. Everything else stays ink. (rest = base weight for that block.)
function renderHighlight(text, color, restWeight = 400) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} style={{ color, fontWeight: Math.max(600, restWeight) }}>{part.slice(2, -2)}</span>;
    }
    return <span key={i} style={{ fontWeight: restWeight }}>{part}</span>;
  });
}

// "rgb(r,g,b)" or "#rrggbb" → translucent rgba(...) — for the accent-tinted active pill.
function withAlpha(color, a) {
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith('rgb(')) return `rgba(${color.slice(4, -1)}, ${a})`;
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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

// Small line glyph per info-box type — gives the switcher pills a structured feel.
function InfoIcon({ type, color = 'currentColor', size = 13 }) {
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

export default function FeedCard({ story, isDark = false, onOpen, onEngage, onTagTap, minimal = false, textOnly = false }) {
  // Per-article accent = the Apple system colour closest to the hero photo
  // (falls back to a per-category Apple colour before the photo is read).
  const fallbackAccent = useMemo(() => categoryAppleColor(story.category, isDark), [story.category, isDark]);
  const [accent, setAccent] = useState(fallbackAccent);
  useEffect(() => { setAccent(fallbackAccent); }, [fallbackAccent]);
  // Bullet dots use the OPPOSITE (complementary) colour of the article accent.
  const bulletDot = useMemo(() => complementOf(accent, isDark), [accent, isDark]);

  const colors = {
    text: isDark ? '#F5F5F7' : '#1d1d1f',
    secondary: isDark ? 'rgba(235,235,245,0.6)' : '#86868b',
    chipBg: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F4',
    chipText: isDark ? 'rgba(255,255,255,0.72)' : '#6e6e73',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    // Every article sits on this one flat background — no boxes.
    cardBg: isDark ? '#0A0A0C' : '#FFFFFF',
    // Info boxes: pure white, defined only by a thin light-grey outline.
    boxBg: isDark ? '#1C1C1E' : '#FFFFFF',
    boxBorder: isDark ? 'rgba(255,255,255,0.12)' : '#E5E5E7',
    dot: isDark ? 'rgba(235,235,245,0.32)' : '#C7C7CC',
  };

  const title = story.title_news || story.title || '';
  const bullets = (story.summary_bullets_news || story.summary_bullets || []).slice(0, 3);
  const entities = (story.interest_tags || []).slice(0, 3);
  const [saved, setSaved] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false); // source popover ("i" button)

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

  // Read the hero photo's dominant colour (via a CORS-friendly proxy so the canvas
  // isn't tainted), snap it to the nearest Apple system colour, then nudge it to
  // stay readable on the card. That colour tints the highlighted words.
  useEffect(() => {
    if (!imageUrl || typeof window === 'undefined') return;
    let cancelled = false;
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}&w=80&h=80&fit=cover&output=jpg`;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement('canvas');
        const w = (c.width = img.naturalWidth || 80);
        const h = (c.height = img.naturalHeight || 80);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        // Highlight colour chosen the SAME way the iOS blur colour was — dominant
        // saturated hue of the bottom half — but as a light-theme (white-bg) colour.
        const out = pickBlurHueLight(data, w, h);
        if (out) setAccent(rgbStr(out));
        else setAccent(fallbackAccent); // greyscale photo → category colour
      } catch (_) { /* keep fallback */ }
    };
    img.src = proxied;
    return () => { cancelled = true; img.onload = null; };
  }, [imageUrl, isDark]);

  // --- info boxes ---
  const infoTypes = useMemo(() => availableInfoTypes(story), [story]);
  const [activeInfo, setActiveInfo] = useState(infoTypes[0] || null);
  const [infoExpanded, setInfoExpanded] = useState(false);

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
        padding: '22px 16px 18px',
        // One continuous background for all articles, hairline divider between.
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
      {/* Hero image — hidden in text-only mode. Clean edges (no bottom fade). */}
      {!textOnly && (
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16,
                    boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.06)' : 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
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
                       style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block' }}
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
            style={{ width: '100%', maxHeight: '58vh', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '3 / 2', background: gradientFor(story.category) }} />
        )}

        {/* page dots (carousel) — top centre over the image */}
        {pages && (
          <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {pages.map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i === page ? '#fff' : 'rgba(255,255,255,0.45)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }} />
            ))}
          </div>
        )}

      </div>
      )}

      {/* Headline block — title on the left, publish time top-right on the same level */}
      <div onClick={handleOpen} style={{ cursor: 'pointer', marginBottom: 9 }}>
        {textOnly && story.category && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 6 }}>
            {story.category}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <h2 style={{
            flex: 1, minWidth: 0, margin: 0,
            fontSize: 25, fontWeight: 800, letterSpacing: '-0.028em', lineHeight: 1.17,
            color: colors.text,
          }}>
            {renderHighlight(pages ? (pages[page].title || title) : title, accent, 800)}
          </h2>
          <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 400, color: colors.secondary, marginTop: 5, whiteSpace: 'nowrap' }}>
            {timeAgo(story.publishedAt || story.published_at)}
          </span>
        </div>
      </div>

      {/* Bullets (up to 3) — one quiet dot, compact text */}
      {(pages ? pages[page].bullets : bullets) && (pages ? pages[page].bullets : bullets).length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {(pages ? (pages[page].bullets || []) : bullets).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', marginTop: 10, flexShrink: 0,
                background: bulletDot,
              }} />
              <div style={{ fontSize: 16.5, lineHeight: 1.5, color: colors.text, letterSpacing: '-0.01em' }}>
                {renderHighlight(b, accent, 400)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info boxes — interactive context under the bullets */}
      {!minimal && infoTypes.length > 0 && activeInfo && (
        <div style={{ marginTop: 13 }}>
          {/* switcher pills — only when there's more than one type to choose from */}
          {infoTypes.length > 1 && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 9, flexWrap: 'wrap' }}>
              {infoTypes.map((t) => {
                const on = t === activeInfo;
                return (
                  <button key={t} onClick={() => { setActiveInfo(t); setInfoExpanded(false); }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            border: `0.5px solid ${on ? 'transparent' : colors.divider}`,
                            cursor: 'pointer', borderRadius: 999, padding: '5px 10px',
                            fontSize: 11, fontWeight: 600,
                            background: on ? withAlpha(accent, 0.12) : colors.chipBg,
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

          {/* Stat box — subtly tinted with the article accent so it reads as designed-in. */}
          <div style={{
            borderRadius: 14, padding: '12px 14px',
            background: isDark ? withAlpha(accent, 0.12) : withAlpha(accent, 0.06),
            border: `1px solid ${withAlpha(accent, isDark ? 0.24 : 0.16)}`,
          }}>
            <InfoBox type={activeInfo} story={story} accent={accent} colors={colors}
                     expanded={infoExpanded} onToggle={() => setInfoExpanded((v) => !v)} />
          </div>
        </div>
      )}

      {/* Action row: tappable entity tags on the left, info + Save + Share on the right */}
      {!minimal && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        {/* Entities (interest_tags) — tap to open that tag's feed */}
        <div style={{
          display: 'flex', gap: 5, flex: 1, minWidth: 0,
          overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {entities.map((tag, i) => (
            <button key={i}
              onClick={(e) => { e.stopPropagation(); onTagTap && onTagTap(tag, story.id); }}
              style={{
                flexShrink: 0, border: 'none', cursor: onTagTap ? 'pointer' : 'default',
                fontSize: 11.5, fontWeight: 500, lineHeight: 1,
                color: colors.chipText, background: colors.chipBg,
                padding: '6px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                textTransform: 'capitalize', WebkitTapHighlightColor: 'transparent',
              }}>
              {tag}
            </button>
          ))}
        </div>

        {/* Info ("i") + Save + Share */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
          <ActionButton label="About this story" isDark={isDark} active={infoOpen} activeColor={accent}
                        restColor={colors.text} onClick={(e) => { e.stopPropagation(); setInfoOpen((v) => !v); }}>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.7} />
            <path d="M12 11v5M12 7.6h.01" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </ActionButton>
          <ActionButton
            label={saved ? 'Saved' : 'Save'}
            isDark={isDark}
            active={saved}
            activeColor="#FF9500"
            restColor="#FF9500"
            onClick={(e) => { e.stopPropagation(); setSaved((v) => !v); }}
          >
            <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-3.6L6 20z"
                  fill={saved ? 'currentColor' : 'none'} stroke="currentColor"
                  strokeWidth={1.7} strokeLinejoin="round" />
          </ActionButton>
          <ActionButton label="Share" isDark={isDark} restColor="#007AFF" onClick={handleShare}>
            <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M8 7l4-4 4 4" />
              <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </g>
          </ActionButton>

          {/* Source popover — opened by the "i" button */}
          {infoOpen && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setInfoOpen(false); }}
                   style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', bottom: 40, right: 0, zIndex: 41,
                minWidth: 180, maxWidth: 260, padding: '12px 14px',
                borderRadius: 14, background: isDark ? '#1C1C1E' : '#FFFFFF',
                border: `1px solid ${colors.boxBorder}`,
                boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.6)' : '0 8px 30px rgba(0,0,0,0.14)',
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 7 }}>
                  Source
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (story.url && typeof window !== 'undefined') window.open(story.url, '_blank', 'noopener');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent',
                    padding: 0, cursor: story.url ? 'pointer' : 'default', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {logoFor(story.source) && (
                    <img src={logoFor(story.source)} alt="" width={18} height={18}
                         style={{ borderRadius: 5, objectFit: 'cover', flexShrink: 0 }}
                         referrerPolicy="no-referrer"
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <span style={{ fontSize: 15, fontWeight: 600, color: story.url ? accent : colors.text, letterSpacing: '-0.01em' }}>
                    {story.source || 'Today+'}
                  </span>
                  {story.url && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
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
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
        color: active ? activeColor : restColor,
        opacity: active ? 1 : (hover ? 1 : 0.9),
        transform: press ? 'scale(0.86)' : 'scale(1)',
        transition: 'transform 0.1s ease, color 0.18s ease, opacity 0.18s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width={19} height={19} viewBox="0 0 24 24">{children}</svg>
    </button>
  );
}

// --- individual info boxes ---
function InfoBox({ type, story, accent, colors, expanded, onToggle }) {
  if (type === 'graph' && story.graph) {
    // The box is already pure white — render the chart straight on it, no nested card.
    return (
      <div style={{ position: 'relative' }}>
        {story.graph.title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, lineHeight: 1.2, marginBottom: 8, paddingRight: 26, letterSpacing: '-0.01em' }}>
            {story.graph.title}
          </div>
        )}
        <button onClick={onToggle} aria-label={expanded ? 'Collapse chart' : 'Expand chart'} style={{
          position: 'absolute', top: 0, right: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', color: colors.secondary, padding: 0, lineHeight: 0,
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {expanded
              ? <path d="M10 14 4 20M4 15v5h5M14 10l6-6M20 9V4h-5" />
              : <path d="M7 17 17 7M9 7h8v8" />}
          </svg>
        </button>
        <div style={{ height: expanded ? 210 : 118, width: '100%' }}>
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
        <div style={{ position: 'relative', height: expanded ? 230 : 88, borderRadius: 12, overflow: 'hidden' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {items.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 9 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: accent }}>{t.date || t.time}</div>
                <div style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.4 }}>{t.text || t.event}</div>
              </div>
            </div>
          ))}
        </div>
      </Expandable>
    );
  }
  if (type === 'details' && story.details) {
    // Stat row: up to 3 columns separated by thin dividers — uppercase label,
    // INK number (editorial, not coloured), small unit. Compact sizes.
    const items = story.details.slice(0, 3);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, alignItems: 'start' }}>
        {items.map((d, i) => {
          const label = d.label || d.name || '';
          const raw = String(d.value ?? d.description ?? '');
          const m = raw.match(/^([^a-zA-Z]*[0-9][^a-zA-Z]*)\s*(.*)$/);
          const value = m ? m[1].trim() : raw;
          const unit = m ? m[2].trim() : '';
          const len = value.length;
          const valueSize = len <= 5 ? 18 : len <= 9 ? 15 : len <= 16 ? 13 : 12;
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: '0 8px',
              borderLeft: i > 0 ? `1px solid ${colors.divider}` : 'none',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 4 }}>
                {label}
              </span>
              <span style={{ fontSize: valueSize, fontWeight: 700, lineHeight: 1.1, letterSpacing: valueSize >= 15 ? '-0.02em' : '-0.005em', color: accent }}>
                {value}
              </span>
              {unit && <span style={{ fontSize: 10.5, color: colors.secondary, marginTop: 3 }}>{unit}</span>}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{s.home_team || s.homeTeam}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>{s.home_score ?? s.homeScore}</span>
        <span style={{ color: colors.secondary }}>:</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>{s.away_score ?? s.awayScore}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{s.away_team || s.awayTeam}</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {meta.length > 0 && (
          <div style={{ display: 'flex', gap: 16 }}>
            {meta.map(([label, value], i) => (
              <div key={i}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: colors.secondary }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: accent }}>{value}</div>
              </div>
            ))}
          </div>
        )}
        {shownIng.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {shownIng.map((ing, i) => (
              <span key={i} style={{ fontSize: 11.5, color: colors.chipText, background: colors.chipBg, padding: '4px 9px', borderRadius: 999 }}>
                {txt(ing)}
              </span>
            ))}
          </div>
        )}
        {shownSteps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {shownSteps.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                  background: withAlpha(accent, 0.16), color: accent,
                  fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: colors.text }}>{txt(st)}</div>
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
        marginTop: 9, background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 11.5, fontWeight: 600, color: colors.secondary, padding: 0,
      }}>
        {expanded ? 'Show less ▲' : 'Show more ▼'}
      </button>
    </div>
  );
}

'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import GraphChart from '../GraphChart';

// Mapbox is heavy + needs the browser — load it only when a map box is shown.
const MapboxMap = dynamic(() => import('../MapboxMap'), { ssr: false });

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';

/*
 * FeedCard — IMMERSIVE continuous-scroll card (port of the iOS full-screen feed).
 * Each card's background is the photo's dark "blur" colour; the photo dissolves
 * into it. The headline + bullet accents use the photo's bright "accent" colour.
 * White text throughout. Save / Share / i live under the details (no side rail).
 */

// Category gradient fallback when there's no usable hero photo.
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

// Per-category fallback before the photo's colours are read.
const CAT_HUE = {
  WORLD: 215, POLITICS: 2, BUSINESS: 145, FINANCE: 145, ECONOMY: 145,
  TECHNOLOGY: 212, TECH: 212, SCIENCE: 190, HEALTH: 332, SPORTS: 24,
  ENTERTAINMENT: 282, CULTURE: 282, CRYPTO: 38, CLIMATE: 150, ENVIRONMENT: 150,
};
function fallbackColors(category) {
  const key = String(category || '').toUpperCase().replace(/\s+/g, '').replace(/NEWS$/, '');
  const h = CAT_HUE[key] != null ? CAT_HUE[key] : 220;
  return { blur: `hsl(${h}, 38%, 9%)`, accent: `hsl(${h}, 80%, 62%)` };
}

// RGB(0-255) → HSL in degrees / percent.
function hsl255(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Faithful JS port of the iOS ArticleColorExtractor: returns the dark, saturated
// "blur" colour (card background, from the bottom half) and the bright "accent"
// colour (headline highlights). Both as CSS hsl() strings.
function extractImmersiveColors(data, W, H) {
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
  const maxCount = Math.max(1, ...vals.map((b) => b.count));
  const maxCoverage = Math.max(1, ...vals.map((b) => b.positions.size));

  // Dominant saturated hue of the bottom half — biases the accent into the same family.
  let preferredH = null;
  {
    const scored = vals.filter((b) => b.bottomCount > 0).map((b) => {
      const hsl = hsl255(b.rK, b.gK, b.bK);
      return { h: hsl.h, s: hsl.s, score: b.bottomCount * (hsl.s / 100) };
    }).filter((x) => x.s >= 25).sort((a, b) => b.score - a.score);
    if (scored.length) preferredH = scored[0].h;
  }

  // --- accent ---
  let accent = vals.map((b) => {
    const hsl = hsl255(b.rK, b.gK, b.bK);
    if (!(hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80)) return null;
    return { h: hsl.h, s: hsl.s, l: hsl.l, count: b.count, coverage: b.positions.size, score: 0 };
  }).filter(Boolean);
  if (!accent.length) {
    let fb = null, fbs = -1;
    for (const b of vals) { const hsl = hsl255(b.rK, b.gK, b.bK); if (hsl.s > fbs) { fbs = hsl.s; fb = { ...hsl, count: b.count, coverage: b.positions.size }; } }
    if (fb) accent = [{ h: fb.h, s: fb.s, l: fb.l, count: fb.count, coverage: fb.coverage, score: 0 }];
  }
  if (!accent.length) return null;
  for (const c of accent) {
    const normFreq = c.count / maxCount, normSat = c.s / 100, normCov = c.coverage / maxCoverage;
    let score = normFreq * 0.5 + normSat * 0.3 + normCov * 0.2;
    if (c.h >= 200 && c.h <= 220 && c.s < 60) score *= 0.85;
    if (c.h >= 15 && c.h <= 50 && c.s < 65) score *= 0.7;
    if (preferredH != null) { const raw = Math.abs(c.h - preferredH); const diff = Math.min(raw, 360 - raw); if (diff <= 45) score *= 1.3; else if (diff > 90) score *= 0.5; }
    c.score = score;
  }
  accent.sort((a, b) => b.score - a.score);
  const aw = accent[0];
  const accentS = Math.min(90, aw.s * 1.15);
  const accentL = aw.l <= 40 ? 55 + (aw.l / 40) * 10 : 65 + ((aw.l - 40) / 40) * 10;
  const accentCol = `hsl(${aw.h.toFixed(0)}, ${Math.max(65, accentS).toFixed(0)}%, ${Math.max(55, Math.min(75, accentL)).toFixed(0)}%)`;

  // --- blur (bottom-half background) ---
  const bottom = vals.filter((b) => b.bottomCount > 0).sort((a, b) => b.bottomCount - a.bottomCount);
  let best = bottom[0] || vals.slice().sort((a, b) => b.count - a.count)[0];
  let bestScore = -1;
  const maxBottom = bottom[0] ? bottom[0].bottomCount : 1;
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
  const sourceH = blurHSL.s >= 15 ? blurHSL.h : aw.h;
  const sourceS = blurHSL.s >= 15 ? blurHSL.s : aw.s;
  let finalH, finalS, finalL;
  if (blurHSL.s < 10 && aw.s < 15) { finalH = 0; finalS = 0; finalL = 5; }
  else if (sourceH >= 50 && sourceH <= 65) { finalH = 35; finalS = 70; finalL = 10; }
  else if (sourceH >= 65 && sourceH <= 85) { finalH = 45; finalS = 55; finalL = 9; }
  else { finalH = sourceH; finalS = Math.max(50, Math.min(80, sourceS * 1.1)); finalL = 10; }
  let adjL;
  if (finalS === 0) adjL = finalL;
  else if (finalH >= 200 && finalH <= 260) adjL = 12;
  else if (finalH >= 260 && finalH <= 320) adjL = 11;
  else if (finalH >= 320 || finalH <= 15) adjL = 10;
  else if (finalH >= 15 && finalH <= 50) adjL = 9;
  else if (finalH >= 80 && finalH <= 170) adjL = 9;
  else adjL = 10;
  const blurCol = `hsl(${finalH.toFixed(0)}, ${finalS.toFixed(0)}%, ${adjL.toFixed(0)}%)`;

  return { accent: accentCol, blur: blurCol };
}

// "**word**" → tinted with the article accent + heavier weight; rest = restWeight.
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

function withAlpha(color, a) {
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith('rgb(')) return `rgba(${color.slice(4, -1)}, ${a})`;
  if (color.startsWith('hsl(')) return `hsla(${color.slice(4, -1)}, ${a})`;
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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function logoFor(source) {
  if (!source) return null;
  const domain = String(source).toLowerCase().replace(/\s+/g, '') + '.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

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
  if (Array.isArray(story.components) && story.components.length > 0) return story.components.filter(has);
  return ['scorecard', 'recipe', 'details', 'timeline', 'map', 'graph'].filter(has);
}

const INFO_LABEL = { details: 'Details', timeline: 'Timeline', map: 'Map', graph: 'Chart', scorecard: 'Score', recipe: 'Recipe' };

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

export default function FeedCard({ story, isDark = true, onOpen, onEngage, onTagTap, minimal = false, textOnly = false }) {
  const fallback = useMemo(() => fallbackColors(story.category), [story.category]);
  const [colorsImg, setColorsImg] = useState(fallback);
  useEffect(() => { setColorsImg(fallback); }, [fallback]);
  const accent = colorsImg.accent;
  const blur = colorsImg.blur;

  // White-on-dark palette for the immersive card.
  const colors = {
    text: '#FFFFFF',
    body: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.55)',
    chipBg: 'rgba(255,255,255,0.12)',
    chipText: 'rgba(255,255,255,0.82)',
    divider: 'rgba(255,255,255,0.14)',
    boxBg: 'rgba(255,255,255,0.08)',
    boxBorder: 'rgba(255,255,255,0.14)',
  };

  const title = story.title_news || story.title || '';
  const bullets = (story.summary_bullets_news || story.summary_bullets || []).slice(0, 3);
  const entities = (story.interest_tags || []).slice(0, 3);
  const [saved, setSaved] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleShare = useCallback(async (e) => {
    e && e.stopPropagation();
    const url = story.url || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title, url });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(url);
    } catch (_) {}
  }, [story, title]);

  const imageUrl = useMemo(() => {
    const raw = story.urlToImage || story.image_url;
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.length < 5 || ['null', 'undefined', 'none'].includes(s.toLowerCase())) return null;
    return s;
  }, [story]);

  // Read the photo and derive the blur + accent colours (iOS algorithm).
  useEffect(() => {
    if (!imageUrl || typeof window === 'undefined') return;
    let cancelled = false;
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}&w=80&h=80&fit=cover&output=jpg`;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const W = img.naturalWidth || 80, H = img.naturalHeight || 80;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const out = extractImmersiveColors(ctx.getImageData(0, 0, W, H).data, W, H);
        if (out) setColorsImg(out);
      } catch (_) {}
    };
    img.src = proxied;
    return () => { cancelled = true; img.onload = null; };
  }, [imageUrl]);

  const infoTypes = useMemo(() => availableInfoTypes(story), [story]);
  const [activeInfo, setActiveInfo] = useState(infoTypes[0] || null);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const pages = Array.isArray(story.pages) && story.pages.length > 1 ? story.pages : null;
  const [page, setPage] = useState(0);
  const scrollerRef = useRef(null);
  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== page) setPage(idx);
  }, [page]);

  const handleOpen = useCallback(() => { onEngage && onEngage(story); onOpen && onOpen(story); }, [story, onOpen, onEngage]);

  const heroImg = pages ? (pages[page].image || imageUrl) : imageUrl;
  const showTitle = pages ? (pages[page].title || title) : title;
  const showBullets = pages ? (pages[page].bullets || []) : bullets;

  return (
    <article className="feed-card-immersive" style={{
      maxWidth: 600, borderRadius: 24, overflow: 'hidden',
      // Solid black background for every article (highlights stay per-photo).
      background: '#000000', color: colors.text, boxSizing: 'border-box',
      fontFamily: APPLE_FONT, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
      boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
    }}>
      {/* Hero photo dissolving into the blur background */}
      {!textOnly && (
        <div style={{ position: 'relative' }}>
          {pages ? (
            <div ref={scrollerRef} onScroll={onScroll}
                 style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
              {pages.map((p, i) => (
                <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', position: 'relative' }}>
                  {(p.image || imageUrl) ? (
                    <img src={p.image || imageUrl} alt="" referrerPolicy="no-referrer"
                         style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4 / 3', background: gradientFor(story.category) }} />
                  )}
                </div>
              ))}
            </div>
          ) : heroImg ? (
            <img src={heroImg} alt={title} loading="lazy" referrerPolicy="no-referrer"
                 style={{ width: '100%', maxHeight: '64vh', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '4 / 3', background: gradientFor(story.category) }} />
          )}
          {/* dissolve overlay → blur colour at the bottom */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', pointerEvents: 'none',
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 55%, #000000 100%)' }} />
          {pages && (
            <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {pages.map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === page ? '#fff' : 'rgba(255,255,255,0.45)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content on the blur background */}
      <div style={{ padding: textOnly ? '20px 20px 18px' : '0 20px 18px', marginTop: textOnly ? 0 : -34, position: 'relative' }}>
        <div onClick={handleOpen} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: colors.secondary, marginTop: textOnly ? 0 : 2, marginBottom: 8 }}>
            {timeAgo(story.publishedAt || story.published_at)}
          </div>
          <h2 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-0.028em', lineHeight: 1.17, color: colors.text }}>
            {renderHighlight(showTitle, accent, 800)}
          </h2>
        </div>

        {showBullets && showBullets.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {showBullets.slice(0, 3).map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 9, flexShrink: 0, background: accent }} />
                <div style={{ fontSize: 16.5, lineHeight: 1.5, color: colors.body, letterSpacing: '-0.01em' }}>
                  {renderHighlight(b, accent, 400)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info / detail boxes intentionally hidden per request. */}

        {/* Action row: tags + i / Save / Share */}
        {!minimal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {entities.map((tag, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); onTagTap && onTagTap(tag, story.id); }}
                  style={{ flexShrink: 0, border: 'none', cursor: onTagTap ? 'pointer' : 'default', fontSize: 12, fontWeight: 500, lineHeight: 1,
                           color: colors.chipText, background: colors.chipBg, padding: '7px 11px', borderRadius: 999, whiteSpace: 'nowrap',
                           textTransform: 'capitalize', WebkitTapHighlightColor: 'transparent' }}>
                  {tag}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, position: 'relative' }}>
              <ActionButton label="About this story" active={infoOpen} activeColor={accent} restColor="#FFFFFF" onClick={(e) => { e.stopPropagation(); setInfoOpen((v) => !v); }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.7} />
                <path d="M12 11v5M12 7.6h.01" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </ActionButton>
              <ActionButton label={saved ? 'Saved' : 'Save'} active={saved} activeColor={accent} restColor="#FFFFFF" onClick={(e) => { e.stopPropagation(); setSaved((v) => !v); }}>
                <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-3.6L6 20z" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
              </ActionButton>
              <ActionButton label="Share" restColor="#FFFFFF" onClick={handleShare}>
                <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </g>
              </ActionButton>

              {infoOpen && (
                <>
                  <div onClick={(e) => { e.stopPropagation(); setInfoOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', bottom: 40, right: 0, zIndex: 41, minWidth: 180, maxWidth: 260, padding: '12px 14px',
                                borderRadius: 14, background: 'rgba(28,28,30,0.96)', border: `1px solid ${colors.divider}`,
                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 7 }}>Source</div>
                    <button onClick={(e) => { e.stopPropagation(); if (story.url && typeof window !== 'undefined') window.open(story.url, '_blank', 'noopener'); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: story.url ? 'pointer' : 'default', textAlign: 'left' }}>
                      {logoFor(story.source) && (
                        <img src={logoFor(story.source)} alt="" width={18} height={18} style={{ borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      <span style={{ fontSize: 15, fontWeight: 600, color: story.url ? accent : '#fff' }}>{story.source || 'Today+'}</span>
                      {story.url && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M7 17 17 7M9 7h8v8" /></svg>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ActionButton({ children, label, onClick, active, activeColor, restColor }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button aria-label={label} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
               color: active ? activeColor : restColor, opacity: active ? 1 : (hover ? 1 : 0.82),
               transform: press ? 'scale(0.86)' : 'scale(1)', transition: 'transform 0.1s ease, color 0.18s ease, opacity 0.18s ease', WebkitTapHighlightColor: 'transparent' }}>
      <svg width={21} height={21} viewBox="0 0 24 24">{children}</svg>
    </button>
  );
}

function InfoBox({ type, story, accent, colors, expanded, onToggle }) {
  if (type === 'graph' && story.graph) {
    return (
      <div style={{ position: 'relative', background: '#FFFFFF', borderRadius: 14, padding: '14px 14px 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
        {story.graph.title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1d1d1f', lineHeight: 1.2, marginBottom: 8, paddingRight: 26, letterSpacing: '-0.01em' }}>{story.graph.title}</div>
        )}
        <button onClick={onToggle} aria-label={expanded ? 'Collapse chart' : 'Expand chart'} style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#86868b', padding: 0, lineHeight: 0 }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {expanded ? <path d="M10 14 4 20M4 15v5h5M14 10l6-6M20 9V4h-5" /> : <path d="M7 17 17 7M9 7h8v8" />}
          </svg>
        </button>
        <div style={{ height: expanded ? 210 : 118, width: '100%' }}><GraphChart graph={story.graph} expanded={expanded} accentColor={accent} /></div>
      </div>
    );
  }
  if (type === 'map' && story.map) {
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <div style={{ position: 'relative', height: expanded ? 230 : 90, borderRadius: 12, overflow: 'hidden' }}>
          <MapboxMap center={story.map.center || { lat: 0, lon: 0 }} markers={story.map.markers || []} expanded={expanded} highlightColor={accent}
                     locationType={story.map.location_type || 'auto'} regionName={story.map.region_name || null} location={story.map.location || story.map.name || null} />
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
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: accent }}>{t.date || t.time}</div>
                <div style={{ fontSize: 13, color: colors.body, lineHeight: 1.4 }}>{t.text || t.event}</div>
              </div>
            </div>
          ))}
        </div>
      </Expandable>
    );
  }
  if (type === 'details' && story.details) {
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
          const valueSize = len <= 5 ? 22 : len <= 9 ? 17 : len <= 16 ? 14 : 12.5;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 8px', borderLeft: i > 0 ? `1px solid ${colors.divider}` : 'none' }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 6 }}>{label}</span>
              <span style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: accent }}>{value}</span>
              {unit && <span style={{ fontSize: 11, color: colors.secondary, marginTop: 4 }}>{unit}</span>}
            </div>
          );
        })}
      </div>
    );
  }
  if (type === 'scorecard' && story.scorecard) {
    const s = story.scorecard;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{s.home_team || s.homeTeam}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: accent }}>{s.home_score ?? s.homeScore}</span>
        <span style={{ color: colors.secondary }}>:</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: accent }}>{s.away_score ?? s.awayScore}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{s.away_team || s.awayTeam}</span>
      </div>
    );
  }
  if (type === 'recipe' && story.recipe) {
    const r = story.recipe;
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
    const steps = Array.isArray(r.steps) ? r.steps : (Array.isArray(r.instructions) ? r.instructions : []);
    const meta = [r.prep_time && ['Prep', r.prep_time], r.cook_time && ['Cook', r.cook_time], (r.servings || r.serves) && ['Serves', r.servings || r.serves]].filter(Boolean);
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
                <div style={{ fontSize: 15, fontWeight: 800, color: accent }}>{value}</div>
              </div>
            ))}
          </div>
        )}
        {shownIng.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {shownIng.map((ing, i) => (
              <span key={i} style={{ fontSize: 11.5, color: colors.chipText, background: colors.chipBg, padding: '4px 9px', borderRadius: 999 }}>{txt(ing)}</span>
            ))}
          </div>
        )}
        {shownSteps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {shownSteps.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, background: withAlpha(accent, 0.22), color: accent, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: colors.body }}>{txt(st)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
    const hasMore = steps.length > 3 || ingredients.length > 6;
    return hasMore ? <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>{body}</Expandable> : body;
  }
  return null;
}

function Expandable({ expanded, onToggle, colors, children }) {
  return (
    <div>
      {children}
      <button onClick={onToggle} style={{ marginTop: 9, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: colors.secondary, padding: 0 }}>
        {expanded ? 'Show less ▲' : 'Show more ▼'}
      </button>
    </div>
  );
}

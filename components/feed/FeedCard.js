'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import GraphChart from '../GraphChart';

// Mapbox is heavy + needs the browser — load it only when a map box is shown.
const MapboxMap = dynamic(() => import('../MapboxMap'), { ssr: false });

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

// "**bold**" → <strong> spans tinted with the accent color (titles + bullets)
function renderEmphasis(text, accent) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: accent, fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
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

export default function FeedCard({ story, isDark = false, onOpen, onEngage }) {
  const colors = {
    text: isDark ? '#FFFFFF' : '#1d1d1f',
    secondary: isDark ? 'rgba(255,255,255,0.55)' : '#6e6e73',
    chipBg: isDark ? 'rgba(255,255,255,0.08)' : '#EDEBE2',
    divider: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    glassBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  const title = story.title_news || story.title || '';
  const bullets = (story.summary_bullets_news || story.summary_bullets || []).slice(0, 3);
  const imageUrl = useMemo(() => {
    const raw = story.urlToImage || story.image_url;
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.length < 5 || ['null', 'undefined', 'none'].includes(s.toLowerCase())) return null;
    return s;
  }, [story]);

  // --- dynamic accent color from the hero image (canvas), category fallback ---
  const fallbackAccent = (CATEGORY_GRADIENTS[story.category] || CATEGORY_GRADIENTS.News)[0];
  const [accent, setAccent] = useState(fallbackAccent);
  const imgRef = useRef(null);

  const extractColor = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return;
    try {
      const canvas = document.createElement('canvas');
      const w = (canvas.width = 24);
      const h = (canvas.height = 24);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const cr = data[i], cg = data[i + 1], cb = data[i + 2];
        const max = Math.max(cr, cg, cb), min = Math.min(cr, cg, cb);
        // bias toward saturated, mid-bright pixels for a vivid accent
        if (max - min < 25 || max < 50 || max > 240) continue;
        r += cr; g += cg; b += cb; n++;
      }
      if (n > 0) setAccent(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
    } catch (_) {
      /* CORS-tainted canvas — keep category fallback */
    }
  }, []);

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
        padding: '14px 16px',
        borderBottom: `0.5px solid ${colors.divider}`,
        background: 'transparent',
        maxWidth: 640,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Header row: avatar + source + flag … time-ago */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {logoFor(story.source) && (
            <img src={logoFor(story.source)} alt="" width={18} height={18}
                 style={{ borderRadius: 4 }} referrerPolicy="no-referrer"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.1px', color: colors.text }}>
          {story.source || 'Today+'}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: colors.secondary }}>
          {timeAgo(story.publishedAt || story.published_at)}
        </div>
      </div>

      {/* Hero image (or carousel) */}
      {pages ? (
        <div>
          <div ref={scrollerRef} onScroll={onScroll}
               style={{
                 display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
                 borderRadius: 18, gap: 0, scrollbarWidth: 'none',
               }}>
            {pages.map((p, i) => (
              <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                {(p.image || imageUrl) && (
                  <img src={p.image || imageUrl} alt=""
                       style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block', borderRadius: 18 }}
                       referrerPolicy="no-referrer" />
                )}
              </div>
            ))}
          </div>
          {/* page dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            {pages.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === page ? accent : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.25)'),
              }} />
            ))}
          </div>
        </div>
      ) : imageUrl ? (
        <div onClick={handleOpen} style={{ cursor: 'pointer' }}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={extractColor}
            style={{
              width: '100%', maxHeight: '60vh', objectFit: 'cover', display: 'block',
              borderRadius: 18, marginBottom: 12,
            }}
          />
        </div>
      ) : (
        <div onClick={handleOpen}
             style={{ width: '100%', aspectRatio: '3 / 2', borderRadius: 18, marginBottom: 12,
                      background: gradientFor(story.category), cursor: 'pointer' }} />
      )}

      {/* Title */}
      <h2 onClick={handleOpen} style={{
        margin: pages ? '12px 0 0' : 0,
        fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.18,
        color: colors.text, cursor: 'pointer',
      }}>
        {renderEmphasis(pages ? (pages[page].title || title) : title, accent)}
      </h2>

      {/* Bullets (up to 3) */}
      {(pages ? pages[page].bullets : bullets) && (pages ? pages[page].bullets : bullets).length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(pages ? (pages[page].bullets || []) : bullets).slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', marginTop: 9, flexShrink: 0,
                background: BULLET_COLORS[i % BULLET_COLORS.length],
              }} />
              <div style={{ fontSize: 16, lineHeight: 1.45, color: colors.text }}>
                {renderEmphasis(b, accent)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info boxes (the part the user wanted added back) */}
      {infoTypes.length > 0 && activeInfo && (
        <div style={{ marginTop: 14 }}>
          {/* switcher pills */}
          {infoTypes.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {infoTypes.map((t) => (
                <button key={t} onClick={() => { setActiveInfo(t); setInfoExpanded(false); }}
                        style={{
                          border: 'none', cursor: 'pointer', borderRadius: 999,
                          padding: '5px 12px', fontSize: 12, fontWeight: 600,
                          background: t === activeInfo ? accent : colors.chipBg,
                          color: t === activeInfo ? '#fff' : colors.secondary,
                        }}>
                  {INFO_LABEL[t]}
                </button>
              ))}
            </div>
          )}

          <div style={{
            borderRadius: 22, background: colors.glassBg, padding: 14,
            border: `0.5px solid ${colors.divider}`,
          }}>
            <InfoBox type={activeInfo} story={story} accent={accent} colors={colors}
                     expanded={infoExpanded} onToggle={() => setInfoExpanded((v) => !v)} />
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: colors.secondary }}>
        <ActionIcon label="Like" path="M12 21s-7.5-4.6-10-9.2C.6 8.9 2 5.5 5.2 5.5c1.9 0 3 1 3.8 2.2C9.8 6.5 10.9 5.5 12.8 5.5 16 5.5 17.4 8.9 16 11.8 13.5 16.4 12 21 12 21z" />
        <ActionIcon label="Save" path="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        <ActionIcon label="Repost" path="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
        <ActionIcon label="Share" path="M14 9V5l7 7-7 7v-4.1C9 11.8 5.5 13 3 16c1-5 4-8 11-9z" />
      </div>
    </article>
  );
}

function ActionIcon({ path, label }) {
  return (
    <button aria-label={label} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
    }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </button>
  );
}

// --- individual info boxes ---
function InfoBox({ type, story, accent, colors, expanded, onToggle }) {
  if (type === 'graph' && story.graph) {
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <GraphChart graph={story.graph} expanded={expanded} accentColor={accent} />
      </Expandable>
    );
  }
  if (type === 'map' && story.map) {
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <div style={{ height: expanded ? 240 : 92, borderRadius: 16, overflow: 'hidden' }}>
          <MapboxMap map={story.map} accentColor={accent} />
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
    const items = expanded ? story.details : story.details.slice(0, 3);
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {items.map((d, i) => (
            <div key={i} style={{ minWidth: 80 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: colors.secondary }}>
                {d.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{d.value}</div>
            </div>
          ))}
        </div>
      </Expandable>
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

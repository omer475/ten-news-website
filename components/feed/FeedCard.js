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

export default function FeedCard({ story, isDark = false, onOpen, onEngage }) {
  const colors = {
    text: isDark ? '#FFFFFF' : '#1d1d1f',
    secondary: isDark ? 'rgba(255,255,255,0.55)' : '#6e6e73',
    chipBg: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F4',
    chipText: isDark ? 'rgba(255,255,255,0.70)' : '#5a5a5f',
    divider: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    glassBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    cardBg: isDark ? '#0E0E0E' : '#FFFFFF',
    actionHover: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
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
        background: colors.cardBg,
        maxWidth: 640,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Hero image with liquid-glass gradient + title overlaid on top (app design) */}
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
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
                       ref={i === 0 ? imgRef : undefined}
                       onLoad={i === 0 ? extractColor : undefined}
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
            ref={imgRef}
            src={imageUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={extractColor}
            style={{ width: '100%', maxHeight: '62vh', objectFit: 'cover', display: 'block',
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

      {/* Headline block — below the photo so the image stays fully visible */}
      <div onClick={handleOpen} style={{ cursor: 'pointer', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          {logoFor(story.source) && (
            <img src={logoFor(story.source)} alt="" width={15} height={15}
                 style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                 referrerPolicy="no-referrer"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em', color: colors.text }}>
            {story.source || 'Today+'}
          </span>
          <span style={{ fontSize: 12, lineHeight: 1, color: colors.secondary }}>·</span>
          <span style={{ fontSize: 12.5, fontWeight: 400, color: colors.secondary }}>
            {timeAgo(story.publishedAt || story.published_at)}
          </span>
        </div>
        <h2 style={{
          margin: 0,
          fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.28,
          color: colors.text,
        }}>
          {renderHighlight(pages ? (pages[page].title || title) : title, accent)}
        </h2>
      </div>

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
                {renderBold(b)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info boxes — interactive context under the bullets (timeline · map · chart · details · score · recipe) */}
      {infoTypes.length > 0 && activeInfo && (
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
            borderRadius: 18, background: colors.glassBg, padding: 14,
            border: `0.5px solid ${colors.divider}`,
          }}>
            {/* single-type label (the pills already label when there are several) */}
            {infoTypes.length === 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <InfoIcon type={activeInfo} color={accent} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.secondary }}>
                  {INFO_LABEL[activeInfo]}
                </span>
              </div>
            )}
            <InfoBox type={activeInfo} story={story} accent={accent} colors={colors}
                     expanded={infoExpanded} onToggle={() => setInfoExpanded((v) => !v)} />
          </div>
        </div>
      )}

      {/* Action row: entities on the left, Save + Share on the right (app layout) */}
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
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <GraphChart graph={story.graph} expanded={expanded} accentColor={accent} />
      </Expandable>
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
    const items = expanded ? story.details : story.details.slice(0, 3);
    return (
      <Expandable expanded={expanded} onToggle={onToggle} colors={colors}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {items.map((d, i) => (
            <div key={i} style={{ minWidth: 80 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: colors.secondary }}>
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

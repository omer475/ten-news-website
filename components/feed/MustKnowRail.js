'use client';

import React from 'react';

// Apple-system red.
const RED = '#FF3B30';

function withA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function stripStars(t) {
  return String(t || '').replace(/\*\*/g, '');
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
  return `${Math.floor(hrs / 24)}d`;
}

/*
 * MustKnowRail — the day's most important stories (importance score > 900),
 * shown at the very top of the feed as a red-threaded list: a "MUST KNOW"
 * header with a vertical line running down through each numbered story.
 */
export default function MustKnowRail({ stories, isDark = true, onOpen }) {
  if (!stories || stories.length === 0) return null;

  const text = isDark ? '#F5F5F7' : '#1d1d1f';
  const sub = isDark ? '#86868B' : '#6e6e73';
  const nodeBg = isDark ? '#000000' : '#FFFFFF';

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '20px 16px 10px', boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes mkPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.82)}}' }} />

      {/* Header: live dot + MUST KNOW + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, paddingLeft: 1 }}>
        <span style={{
          width: 16, height: 16, borderRadius: '50%', background: RED,
          boxShadow: `0 0 12px ${withA(RED, 0.85)}`, animation: 'mkPulse 2.2s ease-in-out infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: RED }}>
          Must Know
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: sub, letterSpacing: '0.02em' }}>{stories.length}</span>
      </div>

      {/* Threaded list */}
      <div style={{ position: 'relative' }}>
        {/* the vertical thread — from just under the header down through the stories, fading out */}
        <div style={{
          position: 'absolute', left: 8, top: -10, bottom: 6, width: 2, borderRadius: 2,
          background: `linear-gradient(180deg, ${RED} 0%, ${withA(RED, 0.85)} 65%, ${withA(RED, 0)} 100%)`,
        }} />

        {stories.map((s, i) => {
          const last = i === stories.length - 1;
          return (
            <div
              key={s.id || i}
              onClick={() => onOpen && onOpen(s)}
              style={{ position: 'relative', paddingLeft: 32, paddingBottom: last ? 0 : 18, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              {/* numbered node on the thread */}
              <div style={{
                position: 'absolute', left: 0, top: 0, width: 18, height: 18, borderRadius: '50%',
                background: nodeBg, border: `2px solid ${RED}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 3px ${nodeBg}`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: RED, lineHeight: 1 }}>{i + 1}</span>
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.28, letterSpacing: '-0.2px', color: text }}>
                {stripStars(s.title_news || s.title)}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: sub, marginTop: 4 }}>
                {(s.source || 'Today+')}
                {(s.publishedAt || s.published_at) ? ` · ${timeAgo(s.publishedAt || s.published_at)}` : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* divider below the rail */}
      <div style={{ height: 0.5, background: isDark ? 'rgba(245,245,247,0.1)' : 'rgba(0,0,0,0.07)', marginTop: 18 }} />
    </section>
  );
}

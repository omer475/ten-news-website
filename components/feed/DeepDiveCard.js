'use client';

import React, { useState } from 'react';

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';

/*
 * DeepDiveCard — the "Reading of the Day" (Quiet Deep Dive).
 * Collapsed: a clean editorial card (kicker + headline + dek), no image.
 * Tapping ANYWHERE on the card expands the full piece INLINE (with the hero
 * image at the top, then sections + sources) and the feed below flows down;
 * tapping again collapses. Once opened it's marked seen and won't reappear today.
 */
export default function DeepDiveCard({ deepDive, isDark = false, onSeen }) {
  const [open, setOpen] = useState(false);
  if (!deepDive) return null;

  const accent = isDark ? '#5E5CE6' : '#5856D6'; // indigo — quietly "special", distinct from news red/blue
  const colors = {
    text: isDark ? '#F5F5F7' : '#1d1d1f',
    secondary: isDark ? 'rgba(235,235,245,0.6)' : '#6e6e73',
    card: isDark ? '#161618' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    bodyText: isDark ? 'rgba(235,235,245,0.85)' : '#3a3a3c',
    sourceBg: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
  };

  const sections = Array.isArray(deepDive.sections) ? deepDive.sections : [];
  const sources = Array.isArray(deepDive.sources) ? deepDive.sources : [];
  const hero = deepDive.heroImage;

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && onSeen) onSeen(deepDive.slug || deepDive.id);
      return next;
    });
  };

  return (
    <article className="reading-card" style={{ fontFamily: APPLE_FONT, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      {/* Whole card toggles open/closed on tap */}
      <div
        onClick={toggle}
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 20,
          overflow: 'hidden',
          cursor: 'pointer',
          color: colors.text,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Header (no image when collapsed) */}
        <div style={{ padding: '16px 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H11v15H4.5A1.5 1.5 0 0 1 3 17.5zM21 5.5A1.5 1.5 0 0 0 19.5 4H13v15h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>
              Reading of the Day
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.18, color: colors.text }}>
            {deepDive.headline}
          </h2>
          {deepDive.dek && (
            <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.5, color: colors.secondary, letterSpacing: '-0.01em' }}>
              {deepDive.dek}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: accent }}>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{open ? 'Close' : 'Read'}</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                 style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Expanding body — grid 0fr→1fr animates the auto height smoothly */}
        <div style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.5s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 18px 20px' }}>
              {/* hero image — shown only when expanded, at the top of the first paragraph */}
              {hero && (
                <img src={hero} alt="" referrerPolicy="no-referrer"
                     style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 14, display: 'block', marginBottom: 18 }} />
              )}
              {sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 20 }}>
                  {s.heading && (
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', color: colors.text }}>
                      {s.heading}
                    </h3>
                  )}
                  {String(s.body || '').split('\n').filter(Boolean).map((para, j) => (
                    <p key={j} style={{ margin: j === 0 ? 0 : '12px 0 0', fontSize: 16, lineHeight: 1.62, color: colors.bodyText, letterSpacing: '-0.005em' }}>
                      {para}
                    </p>
                  ))}
                </div>
              ))}

              {sources.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: colors.secondary, marginBottom: 10 }}>
                    Sources
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         style={{
                           display: 'inline-flex', alignItems: 'center', gap: 5,
                           fontSize: 12.5, fontWeight: 500, color: accent, textDecoration: 'none',
                           background: colors.sourceBg, border: `1px solid ${colors.border}`,
                           padding: '5px 10px', borderRadius: 999,
                         }}>
                        {src.title}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17 17 7M9 7h8v8" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

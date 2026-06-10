'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getUserInterests } from '../../utils/userInterests';
import { getTimeAgo } from '../../utils/timeHelpers';

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';
const ROUNDED_FONT = 'ui-rounded, "SF Pro Rounded", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/*
 * BundlesSection — "Catch Up": personalized story bundles (POST /api/bundles).
 *
 * A horizontal snap-scroll row of cards, one per bundle: a warm header
 * ("What's going on with OpenAI") + 2-4 compact article rows. Personalization
 * comes from the SAME reading-behavior signals the feed uses — the weighted
 * interest map from getUserInterests() (reading seconds -> weights), followed
 * topics/country from preferences, and read article ids — so a topic the user
 * actually reads rises, and already-read articles are excluded server-side.
 */

const CACHE_KEY = 'tn_bundles_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // refresh at most every 10 min per tab

function readSignals() {
  const signals = { interests: {}, topics: [], country: '', readArticleIds: [] };
  try { signals.interests = getUserInterests() || {}; } catch (_) {}
  try {
    const prefs = JSON.parse(localStorage.getItem('todayplus_preferences') || '{}');
    signals.topics = Array.isArray(prefs.followed_topics) ? prefs.followed_topics : [];
    signals.country = (Array.isArray(prefs.followed_countries) && prefs.followed_countries[0]) || '';
  } catch (_) {}
  try {
    // Same store ReadArticleTracker writes — read directly to avoid spinning
    // up a second IntersectionObserver just for the ids.
    signals.readArticleIds = Object.keys(JSON.parse(localStorage.getItem('tennews_read_articles') || '{}'));
  } catch (_) {}
  return signals;
}

export default function BundlesSection({ isDark = false, textOnly = false, onOpenArticle }) {
  const [bundles, setBundles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Session cache so tab-internal navigations don't re-hit the endpoint.
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.ts < CACHE_TTL_MS && Array.isArray(c.bundles) && c.bundles.length) {
        setBundles(c.bundles);
        return;
      }
    } catch (_) {}

    fetch('/api/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...readSignals(), limit: 6 }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list = (d && Array.isArray(d.bundles)) ? d.bundles : [];
        setBundles(list);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), bundles: list })); } catch (_) {}
      })
      .catch(() => { if (!cancelled) setBundles([]); });
    return () => { cancelled = true; };
  }, []);

  const open = useCallback((article, bundle) => {
    if (onOpenArticle) onOpenArticle(article, bundle);
  }, [onOpenArticle]);

  if (!bundles || bundles.length === 0) return null;

  const accent = isDark ? '#0A84FF' : '#0066CC'; // Apple blue — the one accent
  const colors = {
    text: isDark ? '#F5F5F7' : '#1d1d1f',
    secondary: isDark ? 'rgba(235,235,245,0.6)' : '#6e6e73',
    card: isDark ? '#161618' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    hairline: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    thumbBg: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f7',
  };

  return (
    <section style={{ fontFamily: APPLE_FONT, WebkitFontSmoothing: 'antialiased', maxWidth: 672, margin: '0 auto', width: '100%' }}>
      {/* Section label — same scale as Must Know, in the accent blue */}
      <div style={{ padding: '28px 16px 14px 10px' }}>
        <span style={{
          display: 'inline-block', fontSize: 24, fontWeight: 800, letterSpacing: '0.01em',
          textTransform: 'uppercase', color: accent, fontFamily: ROUNDED_FONT,
        }}>
          Catch Up
        </span>
      </div>

      <div
        className="bundles-scroll"
        style={{
          display: 'flex', gap: 12, overflowX: 'auto',
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          padding: '0 16px 6px 10px', scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      >
        {bundles.map((b) => {
          const kicker = b.isMajor ? 'Top story'
            : (b.matchedInterests && b.matchedInterests.length ? 'For you' : 'Worth following');
          return (
            <article
              key={b.id}
              style={{
                flex: '0 0 auto', width: 'min(82vw, 440px)', scrollSnapAlign: 'start',
                background: colors.card, border: `1px solid ${colors.border}`,
                borderRadius: 20, padding: '15px 18px 6px', boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: b.isMajor ? accent : colors.secondary, marginBottom: 7 }}>
                {kicker}
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: colors.text }}>
                {b.header}
              </h3>

              {(b.articles || []).map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => open(a, b)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') open(a, b); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderTop: i === 0 ? 'none' : `0.5px solid ${colors.hairline}`,
                    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: colors.text,
                      letterSpacing: '-0.01em',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {a.title}
                    </div>
                    {a.date && (
                      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: colors.secondary }}>
                        {getTimeAgo(a.date)}
                      </div>
                    )}
                  </div>
                  {!textOnly && a.image && (
                    <img
                      src={a.image}
                      alt=""
                      loading="lazy"
                      style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: colors.thumbBg }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
              ))}
            </article>
          );
        })}
      </div>

      <style jsx>{`
        .bundles-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}

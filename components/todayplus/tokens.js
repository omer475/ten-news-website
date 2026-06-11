// TodayPlus Feed — design tokens + text helpers (spec §2)
// The redesigned feed is a LIGHT surface; colors are calibrated for the warm
// white background and do not follow the site dark-mode toggle.

import React from 'react';

export const TP = {
  bg: '#FCFBF8',
  ink: '#16150F',
  ink2: '#5F5B51',
  ink3: '#A39E92',
  line: '#EAE6DD',
  gold: '#A8802F',      // brand accent on white (NOT the old #C9A464)
  goldSoft: '#C9A464',  // only on dark surfaces (cover overlay, map card)
  red: '#C8362F',
  green: '#1E7F4F',
  breakingDot: '#FF5A52',
  mapBg: '#0E1320',
  mapLand: '#1A2233',
  mapLandStroke: '#27314A',
  mapGrid: '#1D2536',
  mapText: '#E8EAF2',
};

// §2.2 + the 3 pipeline additions (SPORTS/CULTURE/HEALTH)
export const CATEGORY_ACCENTS = {
  WORLD: '#B5443F',
  AI: '#A8802F',
  ECONOMY: '#946A1C',
  TECH: '#2F66D0',
  POLICY: '#7A4FB6',
  MARKETS: '#A8802F',
  SCIENCE: '#1F8A70',
  ENERGY: '#C25A1F',
  SPORTS: '#2D7A31',
  CULTURE: '#B23A77',
  HEALTH: '#0E7C86',
};

export function accentFor(category) {
  return CATEGORY_ACCENTS[(category || '').toUpperCase()] || TP.gold;
}

// Type system v4 — young, app-like energy (not a newspaper).
// Gabarito: bold rounded geometric display — friendly, confident, the
// Duolingo/Spotify generation. Figtree: clean warm body. IBM Plex Mono:
// small technical labels for a cool data edge.
export const FONT_HEAD = "'Gabarito', -apple-system, BlinkMacSystemFont, sans-serif";
export const FONT_SERIF = "'Gabarito', -apple-system, BlinkMacSystemFont, sans-serif"; // serif voice retired (too news)
export const FONT_BODY = "'Figtree', -apple-system, BlinkMacSystemFont, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";

// §7.2 number formatting: thousands separators for ≥1000; one decimal iff the
// target has decimals. Prefix/unit are passed around the formatted number.
export function formatNumber(value) {
  const hasDecimals = Math.abs(value % 1) > 1e-9;
  // Years must not get thousands separators ("CLOSES 2,027" reads wrong).
  const looksLikeYear = !hasDecimals && value >= 1900 && value <= 2100;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: hasDecimals ? 1 : 0,
    useGrouping: Math.abs(value) >= 1000 && !looksLikeYear,
  });
}

// Relative age label computed client-side ("30m", "2h", "1d") — the contract
// does not provide ageLabel.
export function ageLabel(publishedAt) {
  if (!publishedAt) return '';
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(1, Math.floor((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── <em>/<b> markup (the only markup in title/bullets/quote.text) ──────────

const unescapeHtml = (s) =>
  s.includes('&')
    ? s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    : s;

/** Parse into segments: [{ text, em, b }] */
export function parseMarkup(raw) {
  if (!raw) return [];
  const out = [];
  const re = /<em>([\s\S]*?)<\/em>|<b>([\s\S]*?)<\/b>/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ text: unescapeHtml(raw.slice(last, m.index)), em: false, b: false });
    if (m[1] !== undefined) out.push({ text: unescapeHtml(m[1]), em: true, b: false });
    else out.push({ text: unescapeHtml(m[2]), em: false, b: true });
    last = re.lastIndex;
  }
  if (last < raw.length) out.push({ text: unescapeHtml(raw.slice(last)), em: false, b: false });
  return out;
}

export function plainText(raw) {
  return parseMarkup(raw).map((s) => s.text).join('');
}

/**
 * Render markup → React nodes. Entity <em> runs take `emColor`, same weight,
 * no italic (§2.3); <b> runs take `strongColor` + weight 600.
 */
export function Markup({ raw, emColor, strongColor = TP.ink, strongWeight = 600 }) {
  const segments = parseMarkup(raw);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.em) return <span key={i} style={{ color: emColor }}>{seg.text}</span>;
        if (seg.b) return <span key={i} style={{ color: strongColor, fontWeight: strongWeight }}>{seg.text}</span>;
        return <React.Fragment key={i}>{seg.text}</React.Fragment>;
      })}
    </>
  );
}

// ── One-shot animation registry (§7.2 / §10.3) ──────────────────────────────
// Count-ups, bar fills, chart growths and entrances fire exactly once per key
// per session — never re-animating on scroll-back, even across unmounts.

const animatedKeys = new Set();

export function shouldAnimateOnce(key) {
  if (animatedKeys.has(key)) return false;
  animatedKeys.add(key);
  return true;
}

export function hasAnimated(key) {
  return animatedKeys.has(key);
}

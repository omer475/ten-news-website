// TodayPlus Feed — design tokens + text helpers (spec §2)
// The feed supports BOTH a dark and a light surface. Every color below is a CSS
// custom property (set on the feed root by tpVars), so inline styles flip the
// whole theme instantly with no prop-threading. The hard-coded fallback in each
// var() is the dark palette, so the feed degrades to dark if a var is missing.

import React from 'react';

export const TP = {
  bg: 'var(--tp-bg, #000000)',
  ink: 'var(--tp-ink, #F5F5F7)',
  ink2: 'var(--tp-ink2, #86868B)',
  ink3: 'var(--tp-ink3, #6E6E73)',
  line: 'var(--tp-line, rgba(245,245,247,0.10))',
  gold: 'var(--tp-gold, #F5F5F7)',  // strong accent = full-contrast ink
  goldSoft: '#C9A464',  // cover-image overlay accent — always sits on a dark scrim
  red: '#FF453A',
  green: '#34C759',
  breakingDot: '#FF5A52',
  // The stylised world-map widget stays dark in both themes (reads as a dark
  // "card" floating in the light feed — intentional, like an Apple map tile).
  mapBg: '#0A0A0A',
  mapLand: '#1A2233',
  mapLandStroke: '#27314A',
  mapGrid: '#1D2536',
  mapText: '#E8EAF2',
};

// ONE accent for every category — the full-contrast ink. No per-category
// rainbow: the screen stays at two colors (ink + background), with TP.red the
// only exception, reserved for breaking / negative deltas. Stays a CONCRETE hex
// (not a CSS var) because accents feed SVG presentation attributes (stroke=/
// fill=/stopColor=) in the charts, where var() does NOT resolve.
export function accentFor(category, isDark = true) {
  return isDark ? '#F5F5F7' : '#1D1D1F';
}

// The CSS variables to spread onto the feed root for the active theme. Only the
// surface tokens are vars (used in HTML inline styles + a few SVG `style`
// attributes, both of which resolve var()); accents are concrete (see above).
export function tpVars(isDark) {
  return isDark
    ? {
        '--tp-bg': '#000000',
        '--tp-ink': '#F5F5F7',
        '--tp-ink2': '#86868B',
        '--tp-ink3': '#6E6E73',
        '--tp-line': 'rgba(245,245,247,0.10)',
        '--tp-gold': '#F5F5F7',
      }
    : {
        '--tp-bg': '#FFFFFF',
        '--tp-ink': '#1D1D1F',
        '--tp-ink2': '#6E6E73',
        '--tp-ink3': '#A1A1A6',
        '--tp-line': 'rgba(0,0,0,0.10)',
        '--tp-gold': '#1D1D1F',
      };
}

// Special hand-drawn display face — used ONLY for expressive moments
// (personalization headings, pull-quotes), never for news body copy. Swappable
// in ONE place: redefine --font-scribble (see styles/globals.css + _document).
export const FONT_SCRIBBLE = "var(--font-scribble, 'Caveat', 'Segoe Print', cursive)";

// Type system v4 — young, app-like energy (not a newspaper).
// Gabarito: bold rounded geometric display — friendly, confident, the
// Duolingo/Spotify generation. Figtree: clean warm body. IBM Plex Mono:
// small technical labels for a cool data edge.
// Match the onboarding: clean Apple system type (SF Pro) across the feed.
export const FONT_HEAD = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Helvetica Neue', sans-serif";
export const FONT_SERIF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
export const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Helvetica Neue', sans-serif";
export const FONT_MONO = "'SF Mono', ui-monospace, 'IBM Plex Mono', monospace";

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

/** Parse into segments: [{ text, em, b }].
 * Handles <em>/<b> (the display contract) plus **markdown bold**, which some
 * pipeline fields (e.g. module briefs) still emit. */
export function parseMarkup(raw) {
  if (!raw) return [];
  const out = [];
  const re = /<em>([\s\S]*?)<\/em>|<b>([\s\S]*?)<\/b>|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ text: unescapeHtml(raw.slice(last, m.index)), em: false, b: false });
    if (m[1] !== undefined) out.push({ text: unescapeHtml(m[1]), em: true, b: false });
    else out.push({ text: unescapeHtml(m[2] !== undefined ? m[2] : m[3]), em: false, b: true });
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

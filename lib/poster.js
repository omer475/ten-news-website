/**
 * TODAY — poster rendering.
 *
 * The artwork is a commissioned illustration generated once a day and stored as
 * an image. This module only handles the type set over it, in two places that
 * must agree: the live page (DOM, see pages/index.js) and the 1080x1920 export
 * drawn here. The ratios below are the single source of truth for both.
 *
 * If a story has no illustration, `drawFallback` sets a plain typographic
 * cover instead — flat ground, big type, rules. Never a cartoon.
 */

const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';
const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const SANS = '"Inter Tight", system-ui, -apple-system, sans-serif';

export const TYPE = {
  // The illustration is a rounded card; the type sits on the page beneath it.
  gutter: 0.042,        // page margin around the card, as a fraction of width
  cardTop: 0.03,
  cardHeight: 0.585,    // card height as a fraction of the poster height
  radius: 0.055,        // corner radius, as a fraction of width

  textGap: 0.06,        // between the card and the kicker
  kickerSize: 0.028,
  kickerGap: 0.036,
  titleSize: 0.076,
  titleLead: 0.96,
  titleMax: 3,
  titleGap: 0.034,
  footSize: 0.033,
  footLead: 1.4,
  footMax: 5,
  colophonGap: 0.034,
  colophonSize: 0.021,
};

const EXPORT_W = 1080;
const EXPORT_H = 1920;

/* ------------------------------------------------------------------ utils */

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return [17, 17, 17];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a colour toward near-black, so a fallback ground is always dark. */
function deepen(hex) {
  const [r, g, b] = hexToRgb(hex);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luma < 0.35) return `rgb(${r},${g},${b})`;
  const k = 0.22;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

/**
 * Ink for one band.
 *
 * The builder mixes a title colour out of each picture's own accent and
 * checks it for contrast against that band, so the type belongs to the page
 * rather than being stamped on it. Plain white/black is only the fallback —
 * for older editions, and for a poster whose illustration never arrived.
 */
export function inkFor(story, band) {
  const art = story?.art;
  if (!art?.image_url) return '#ffffff';
  const mixed = band === 'top' ? art.titleTop : art.titleBottom;
  if (/^#[0-9a-f]{6}$/i.test(String(mixed || ''))) return mixed;
  const v = band === 'top' ? art.topInk : art.bottomInk;
  return v === 'dark' ? '#111111' : '#ffffff';
}

/** Is this band's ground dark? Decides which way the scrim goes. */
export function bandIsDark(story, band) {
  const art = story?.art;
  if (!art?.image_url) return true;
  return (band === 'top' ? art.topInk : art.bottomInk) !== 'dark';
}

/* ---- relative luminance and contrast, so nothing is set on top of itself -- */

function relLuma(rgb) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function contrast(a, b) {
  const la = relLuma(a);
  const lb = relLuma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hex(rgb) {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
}

/** Walk a colour toward white or black until it clears `target` against `bg`. */
function legible(colour, bg, target) {
  const toward = relLuma(bg) < 0.4 ? [255, 255, 255] : [0, 0, 0];
  let best = toward;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const cand = colour.map((c, k) => c + (toward[k] - c) * t);
    if (contrast(cand, bg) >= target) return hex(cand);
    best = cand;
  }
  return hex(best);
}

/**
 * The page the card sits on. It has to CONTRAST with the artwork or the rounded
 * corners have nothing to read against, so it is a deepened version of the
 * artwork's own ground rather than the ground itself.
 */
export function panelFor(story) {
  const tint = story?.art?.tint;
  return /^#[0-9a-f]{6}$/i.test(String(tint || '')) ? deepen(tint) : '#101012';
}

/**
 * Ink for the page. The builder measured its ink against a background this
 * renderer no longer uses, which put a dark red kicker on a dark red page, so
 * both the ink and the accent are re-checked here against what is actually
 * behind them.
 */
export function panelInkFor(story) {
  const bg = hexToRgb(panelFor(story));
  return contrast([255, 255, 255], bg) >= 4.5 ? '#ffffff' : '#111111';
}

/** The kicker: the artwork's own colour, pushed until it is readable. */
export function accentFor(story) {
  const bg = hexToRgb(panelFor(story));
  const raw = story?.art?.accent;
  const rgb = /^#[0-9a-f]{6}$/i.test(String(raw || '')) ? hexToRgb(raw) : [230, 230, 230];
  return legible(rgb, bg, 4.5);
}

/** Measure the type so the export lays it out exactly as the page does. */
export function measurePanel(ctx, w, h, story) {
  const cover = story.cover || {};
  const maxW = w * (1 - TYPE.gutter * 2);

  let titleSize = w * TYPE.titleSize;
  let title;
  for (;;) {
    ctx.font = `${titleSize}px ${DISPLAY}`;
    title = wrapLines(ctx, String(cover.title || story.headline || '').toUpperCase(), maxW);
    if (title.length <= TYPE.titleMax || titleSize <= w * 0.045) break;
    titleSize *= 0.94;
  }
  const footSize = w * TYPE.footSize;
  ctx.font = `500 ${footSize}px ${SANS}`;
  const foot = wrapLines(ctx, cover.standfirst || story.dek || '', maxW).slice(0, TYPE.footMax);
  return { title: title.slice(0, TYPE.titleMax), titleSize, foot, footSize };
}

/** Round-cornered clip for the artwork card. */
export function cardRect(w, h) {
  return {
    x: w * TYPE.gutter,
    y: h * TYPE.cardTop,
    w: w * (1 - TYPE.gutter * 2),
    h: h * TYPE.cardHeight,
    r: w * TYPE.radius,
  };
}

/** The type, set on the page underneath the card. */
export function drawType(ctx, w, h, story, edition) {
  const x = w * TYPE.gutter;
  const ink = panelInkFor(story);
  const accent = accentFor(story);
  const m = measurePanel(ctx, w, h, story);
  const card = cardRect(w, h);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = card.y + card.h + w * TYPE.textGap;

  if (story.tag) {
    ctx.font = `700 ${w * TYPE.kickerSize}px ${SANS}`;
    ctx.fillStyle = accent;
    ctx.fillText(String(story.tag).toUpperCase().split('').join(' '), x, y);
  }
  y += w * TYPE.kickerGap;

  ctx.font = `${m.titleSize}px ${DISPLAY}`;
  ctx.fillStyle = ink;
  m.title.forEach((line, i) => {
    ctx.fillText(line, x, y + m.titleSize * 0.82 + i * m.titleSize * TYPE.titleLead);
  });
  y += m.title.length * m.titleSize * TYPE.titleLead + w * TYPE.titleGap;

  ctx.font = `500 ${m.footSize}px ${SANS}`;
  ctx.globalAlpha = 0.85;
  m.foot.forEach((line, i) => {
    ctx.fillText(line, x, y + m.footSize * 0.8 + i * m.footSize * TYPE.footLead);
  });
  ctx.globalAlpha = 1;
  y += m.foot.length * m.footSize * TYPE.footLead + w * TYPE.colophonGap;

  ctx.font = `500 ${w * TYPE.colophonSize}px ${SANS}`;
  ctx.globalAlpha = 0.5;
  ctx.fillText(
    `TODAY · ${edition?.date || ''}${edition?.issue ? ` · NO. ${edition.issue}` : ''}`,
    x, y + w * TYPE.colophonSize,
  );
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------------- export */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    // Same-origin proxy keeps the export canvas untainted whatever host the
    // illustration is stored on.
    img.src = src.startsWith('/') ? src : `/api/edition-image?url=${encodeURIComponent(src)}`;
  });
}

/** Cover-fit an image into the frame, cropping the overflow. */
function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Save one poster as a 1080x1920 PNG. */
export async function exportPoster(story, edition, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = panelFor(story);
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  const card = cardRect(EXPORT_W, EXPORT_H);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, card.r);
  ctx.clip();
  const url = story?.art?.image_url;
  let drew = false;
  if (url) {
    try {
      const img = await loadImage(url);
      const scale = Math.max(card.w / img.width, card.h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, card.x + (card.w - dw) / 2, card.y + (card.h - dh) / 2, dw, dh);
      drew = true;
    } catch {
      drew = false;
    }
  }
  if (!drew) {
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(card.x, card.y, card.w, card.h);
  }
  ctx.restore();

  drawType(ctx, EXPORT_W, EXPORT_H, story, edition);

  const a = document.createElement('a');
  a.download = filename || `today-${story.id || 'poster'}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/** Paint the fallback cover into a live canvas element. */
export function paintFallback(canvas, story, edition) {
  if (!canvas) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 360;
  const h = rect.height || 780;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFallback(ctx, w, h, story);
}

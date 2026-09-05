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
  margin: 0.075,        // side margin, as a fraction of width

  // Everything is set in the foot band, which the artwork brief keeps empty
  // from 66% down: kicker, headline, then a paragraph at reading size.
  kickerY: 0.703,
  titleTop: 0.752,      // first title baseline
  titleSize: 0.072,
  titleLead: 0.95,
  titleMax: 3,
  footGap: 0.03,        // between the headline and the paragraph
  footSize: 0.036,      // the paragraph is meant to be read, not squinted at
  footLead: 1.38,
  footMax: 4,
  colophonY: 0.975,
  colophonSize: 0.021,

  scrim: 0.34,
  scrimAlpha: 0.14,
  scrimTop: 0,
  scrimTopAlpha: 0,
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

/** The kicker colour, lifted out of the artwork — this is what varies page to page. */
export function accentFor(story) {
  const a = story?.art?.accent;
  if (!/^#[0-9a-f]{6}$/i.test(String(a || ''))) return inkFor(story, 'top');
  // Guard the one case the extractor can get wrong: an accent that vanishes
  // into its own band.
  const [r, g, b] = hexToRgb(a);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const onDark = bandIsDark(story, 'top');
  if (onDark && luma < 0.28) return '#ffffff';
  if (!onDark && luma > 0.82) return '#111111';
  return a;
}

/* --------------------------------------------------------------- fallback */

/** A plain typographic cover, used only when the illustration is missing. */
export function drawFallback(ctx, w, h, story) {
  ctx.fillStyle = deepen(story?.art?.tint || '#1b1b1b');
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = Math.max(1, w * 0.002);
  for (let i = 1; i < 22; i++) {
    const y = h * 0.3 + i * h * 0.013;
    ctx.beginPath();
    ctx.moveTo(w * TYPE.margin, y);
    ctx.lineTo(w * (1 - TYPE.margin) - (i % 3) * w * 0.12, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------- type */

/** All the cover type, set in the empty foot band: kicker, headline, paragraph. */
export function drawType(ctx, w, h, story, edition) {
  const cover = story.cover || {};
  const x = w * TYPE.margin;
  const maxW = w * (1 - TYPE.margin * 2);
  const ink = inkFor(story, 'bottom');
  const accent = accentFor(story);

  // Light insurance against a subject straying into the band.
  const botBase = bandIsDark(story, 'bottom') ? '0,0,0' : '255,255,255';
  const grad = ctx.createLinearGradient(0, h * (1 - TYPE.scrim), 0, h);
  grad.addColorStop(0, `rgba(${botBase},0)`);
  grad.addColorStop(1, `rgba(${botBase},${TYPE.scrimAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * (1 - TYPE.scrim), w, h * TYPE.scrim);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Kicker, in the artwork's own colour
  if (story.tag) {
    ctx.font = `700 ${w * 0.028}px ${SANS}`;
    ctx.fillStyle = accent;
    ctx.fillText(String(story.tag).toUpperCase().split('').join(' '), x, h * TYPE.kickerY);
  }

  // Headline — condensed display caps, the masthead's own voice
  const title = String(cover.title || story.headline || '').toUpperCase();
  let size = w * TYPE.titleSize;
  let lines;
  for (;;) {
    ctx.font = `${size}px ${DISPLAY}`;
    lines = wrapLines(ctx, title, maxW);
    if (lines.length <= TYPE.titleMax || size <= w * 0.046) break;
    size *= 0.94;
  }
  lines = lines.slice(0, TYPE.titleMax);
  ctx.fillStyle = ink;
  const titleLead = size * TYPE.titleLead;
  lines.forEach((line, i) => ctx.fillText(line, x, h * TYPE.titleTop + i * titleLead));

  // Paragraph, directly under the headline
  const afterTitle = h * TYPE.titleTop + (lines.length - 1) * titleLead + w * TYPE.footGap;
  let fs = w * TYPE.footSize;
  let foot;
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    foot = wrapLines(ctx, cover.standfirst || story.dek || '', maxW);
    if (foot.length <= TYPE.footMax || fs <= w * 0.019) break;
    fs *= 0.95;
  }
  foot = foot.slice(0, TYPE.footMax);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.9;
  foot.forEach((line, i) => ctx.fillText(line, x, afterTitle + fs + i * fs * TYPE.footLead));
  ctx.globalAlpha = 1;

  // Colophon
  ctx.font = `500 ${w * TYPE.colophonSize}px ${SANS}`;
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.fillText(
    `TODAY · ${edition?.date || ''}${edition?.issue ? ` · NO. ${edition.issue}` : ''}`,
    x, h * TYPE.colophonY,
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

  const url = story?.art?.image_url;
  let drew = false;
  if (url) {
    try {
      const img = await loadImage(url);
      drawCover(ctx, img, EXPORT_W, EXPORT_H);
      drew = true;
    } catch {
      drew = false;
    }
  }
  if (!drew) drawFallback(ctx, EXPORT_W, EXPORT_H, story);

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

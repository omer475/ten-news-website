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
  tagY: 0.075,          // baseline of the tag line
  bigY: 0.215,          // baseline of the big cover line
  bigSize: 0.185,       // cap height of the big line, as a fraction of width
  labelGap: 0.028,      // gap under the big line
  labelSize: 0.036,
  hookBottom: 0.115,    // distance from the foot of the poster to the last hook line
  hookSize: 0.062,
  hookLead: 1.16,
  footY: 0.955,
  footSize: 0.026,
  scrim: 0.5,           // height of the bottom scrim
  scrimAlpha: 0.62,     // its strength at the very bottom
  scrimTop: 0.3,        // height of the top scrim
  scrimTopAlpha: 0.34,
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

function fitFont(ctx, text, maxWidth, size, weight, family, floor) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > floor) {
    s *= 0.94;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
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
  const k = 0.22;   // keep a trace of the artwork's colour, lose the brightness
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

/**
 * Which ink the cover type uses. The stored `overlay` is measured from the
 * illustration, so it only applies when there IS one — the fallback ground is
 * always dark and always takes light type.
 */
function overlayOf(story) {
  if (!story?.art?.image_url) return 'light';
  return story.art.overlay === 'dark' ? 'dark' : 'light';
}

/* --------------------------------------------------------------- fallback */

/** A plain typographic cover, used only when the illustration is missing. */
export function drawFallback(ctx, w, h, story) {
  ctx.fillStyle = deepen(story?.art?.tint || '#1b1b1b');
  ctx.fillRect(0, 0, w, h);

  // A quiet field of rules, so it reads as a set cover rather than a blank.
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = Math.max(1, w * 0.002);
  for (let i = 1; i < 22; i++) {
    const y = h * 0.24 + i * h * 0.014;
    ctx.beginPath();
    ctx.moveTo(w * TYPE.margin, y);
    ctx.lineTo(w * (1 - TYPE.margin) - (i % 3) * w * 0.12, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------- type */

/** The cover type, drawn identically on the export and (in CSS) on the page. */
export function drawType(ctx, w, h, story, edition) {
  const light = overlayOf(story) === 'light';
  const ink = light ? '#ffffff' : '#111111';
  const cover = story.cover || {};
  const x = w * TYPE.margin;
  const maxW = w * (1 - TYPE.margin * 2);

  // Scrim, so type never fights the illustration underneath it.
  const grad = ctx.createLinearGradient(0, h * (1 - TYPE.scrim), 0, h);
  const base = light ? '0,0,0' : '255,255,255';
  grad.addColorStop(0, `rgba(${base},0)`);
  grad.addColorStop(1, `rgba(${base},${TYPE.scrimAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * (1 - TYPE.scrim), w, h * TYPE.scrim);

  const topGrad = ctx.createLinearGradient(0, 0, 0, h * TYPE.scrimTop);
  topGrad.addColorStop(0, `rgba(${base},${TYPE.scrimTopAlpha})`);
  topGrad.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * TYPE.scrimTop);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;

  // Tag
  if (story.tag) {
    ctx.font = `700 ${w * 0.03}px ${SANS}`;
    const spaced = String(story.tag).toUpperCase().split('').join(' ');
    ctx.fillText(spaced, x, h * TYPE.tagY);
  }

  // Big cover line
  const big = String(cover.big || '').trim();
  if (big) {
    fitFont(ctx, big, maxW, w * TYPE.bigSize, '', DISPLAY, w * 0.06);
    ctx.fillText(big, x, h * TYPE.bigY);

    const label = String(cover.bigLabel || '').toUpperCase();
    if (label) {
      const size = fitFont(ctx, label, maxW, w * TYPE.labelSize, '600', SANS, w * 0.02);
      ctx.globalAlpha = 0.88;
      ctx.fillText(label, x, h * TYPE.bigY + w * TYPE.labelGap + size * 0.2);
      ctx.globalAlpha = 1;
    }
  }

  // Hook, set in the display serif, at most three lines
  let size = w * TYPE.hookSize;
  let lines;
  for (;;) {
    ctx.font = `700 ${size}px ${SERIF}`;
    lines = wrapLines(ctx, cover.hook || story.dek || '', maxW);
    if (lines.length <= 3 || size <= w * 0.036) break;
    size *= 0.93;
  }
  lines = lines.slice(0, 3);
  const lead = size * TYPE.hookLead;
  const lastBaseline = h * (1 - TYPE.hookBottom);
  lines.forEach((line, i) => {
    ctx.fillText(line, x, lastBaseline - (lines.length - 1 - i) * lead);
  });

  // Footer
  const date = edition?.date || '';
  const foot = `TODAY · ${date}${edition?.issue ? ` · NO. ${edition.issue}` : ''}`;
  ctx.font = `500 ${w * TYPE.footSize}px ${SANS}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(foot, x, h * TYPE.footY);
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

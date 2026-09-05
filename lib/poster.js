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
  padTop: 0.055,        // panel padding, top and bottom
  padBottom: 0.05,

  kickerSize: 0.028,
  kickerGap: 0.038,
  titleSize: 0.075,
  titleLead: 0.96,
  titleMax: 3,
  titleGap: 0.036,
  footSize: 0.034,
  footLead: 1.4,
  footMax: 5,
  colophonGap: 0.036,
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

/** The solid block the type is printed on, and the ink that goes on it. */
export function panelFor(story) {
  const p = story?.art?.panel;
  return /^#[0-9a-f]{6}$/i.test(String(p || '')) ? p : '#14140f';
}

export function panelInkFor(story) {
  const p = story?.art?.panelInk;
  return /^#[0-9a-f]{6}$/i.test(String(p || '')) ? p : '#ffffff';
}

/**
 * Measure the type block so the panel can be sized to its contents rather than
 * to a guess. Returns the height as a fraction of the poster height — the last
 * layout overflowed because the band was fixed and the text was not.
 */
export function measurePanel(ctx, w, h, story) {
  const cover = story.cover || {};
  const maxW = w * (1 - TYPE.margin * 2);

  let titleSize = w * TYPE.titleSize;
  let title;
  for (;;) {
    ctx.font = `${titleSize}px ${DISPLAY}`;
    title = wrapLines(ctx, String(cover.title || story.headline || '').toUpperCase(), maxW);
    if (title.length <= TYPE.titleMax || titleSize <= w * 0.045) break;
    titleSize *= 0.94;
  }
  title = title.slice(0, TYPE.titleMax);

  const footSize = w * TYPE.footSize;
  ctx.font = `500 ${footSize}px ${SANS}`;
  const foot = wrapLines(ctx, cover.standfirst || story.dek || '', maxW).slice(0, TYPE.footMax);

  const height = w * TYPE.padTop
    + w * TYPE.kickerSize + w * TYPE.kickerGap
    + title.length * titleSize * TYPE.titleLead + w * TYPE.titleGap
    + foot.length * footSize * TYPE.footLead + w * TYPE.colophonGap
    + w * TYPE.colophonSize + w * TYPE.padBottom;

  return { title, titleSize, foot, footSize, height };
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

/** The type, printed on a solid block across the foot — never over the picture. */
export function drawType(ctx, w, h, story, edition) {
  const x = w * TYPE.margin;
  const panel = panelFor(story);
  const ink = panelInkFor(story);
  const m = measurePanel(ctx, w, h, story);
  const top = h - m.height;

  ctx.fillStyle = panel;
  ctx.fillRect(0, top, w, m.height);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = top + w * TYPE.padTop + w * TYPE.kickerSize;

  if (story.tag) {
    ctx.font = `700 ${w * TYPE.kickerSize}px ${SANS}`;
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.72;
    ctx.fillText(String(story.tag).toUpperCase().split('').join(' '), x, y);
    ctx.globalAlpha = 1;
  }
  y += w * TYPE.kickerGap;

  ctx.font = `${m.titleSize}px ${DISPLAY}`;
  ctx.fillStyle = ink;
  m.title.forEach((line, i) => {
    ctx.fillText(line, x, y + m.titleSize * 0.82 + i * m.titleSize * TYPE.titleLead);
  });
  y += m.title.length * m.titleSize * TYPE.titleLead + w * TYPE.titleGap;

  ctx.font = `500 ${m.footSize}px ${SANS}`;
  ctx.globalAlpha = 0.88;
  m.foot.forEach((line, i) => {
    ctx.fillText(line, x, y + m.footSize * 0.8 + i * m.footSize * TYPE.footLead);
  });
  ctx.globalAlpha = 1;
  y += m.foot.length * m.footSize * TYPE.footLead + w * TYPE.colophonGap;

  ctx.font = `500 ${w * TYPE.colophonSize}px ${SANS}`;
  ctx.globalAlpha = 0.55;
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

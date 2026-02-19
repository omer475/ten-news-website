// Helper: Convert RGB to HSL
export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  return [h * 360, s * 100, l * 100];
};

// Helper: Convert HSL to RGB
export const hslToRgb = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// Helper function for hex conversion
export const toHex = (n) => {
  const hex = Math.round(n).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
};

// Calculate relative luminance for contrast checking
export const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Calculate contrast ratio between two colors
export const getContrastRatio = (rgb1, rgb2) => {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Check if color is too close to white
export const isTooCloseToWhite = (r, g, b, minLightness = 85) => {
  // Check RGB values - if all are above 230, it's very close to white
  if (r > 230 && g > 230 && b > 230) return true;

  // Check lightness in HSL
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l > minLightness) return true;

  // Additional check: if saturation is very low and lightness is high
  if (s < 5 && l > 80) return true;

  return false;
};

// Get fallback color based on background hue
export const getFallbackColorByHue = (hue) => {
  // Blue range: 200-260 degrees
  if (hue >= 200 && hue <= 260) return { r: 26, g: 39, b: 57 }; // #1A2739 dark navy

  // Green range: 100-180 degrees
  if (hue >= 100 && hue <= 180) return { r: 30, g: 56, b: 42 }; // #1E382A forest green

  // Orange/Red range: 0-50 and 320-360 degrees
  if ((hue >= 0 && hue <= 50) || (hue >= 320 && hue <= 360)) return { r: 59, g: 36, b: 26 }; // #3B241A deep brown

  // Default: Gray/neutral
  return { r: 43, g: 43, b: 43 }; // #2B2B2B graphite gray
};

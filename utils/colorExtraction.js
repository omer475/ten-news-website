import { rgbToHsl, hslToRgb, toHex } from './colorUtils';

// Filter colors to keep only colorful ones (saturation >= 35%)
export const filterColorfulColors = (colors) => {
  return colors.filter(color => {
    const [h, s, l] = color.hsl;
    return s >= 35 && l >= 20 && l <= 80; // Colorful, not too dark/light
  });
};

// Extract diverse color candidates from image with frequency and coverage tracking
export const extractColorfulCandidates = (pixels, width, height) => {
  const colorMap = {};
  const totalPixelsSampled = pixels.length / 4; // Total RGBA pixel count

  // Sample pixels (every 10th pixel)
  for (let i = 0; i < pixels.length; i += 40) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const alpha = pixels[i + 3];

    // Skip transparent or extreme pixels
    if (alpha < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10)) {
      continue;
    }

    // Round to group similar colors
    const rKey = Math.round(r / 15) * 15;
    const gKey = Math.round(g / 15) * 15;
    const bKey = Math.round(b / 15) * 15;
    const key = `${rKey},${gKey},${bKey}`;

    // Track frequency and spatial coverage
    if (!colorMap[key]) {
      colorMap[key] = {
        count: 0,
        positions: new Set()
      };
    }
    colorMap[key].count += 1;

    // Track spatial coverage (approximate grid position)
    const pixelIndex = i / 4;
    const x = Math.floor((pixelIndex % width) / 10); // Divide into 10-pixel grid
    const y = Math.floor(Math.floor(pixelIndex / width) / 10);
    colorMap[key].positions.add(`${x},${y}`);
  }

  // Calculate max values for normalization
  const maxCount = Math.max(...Object.values(colorMap).map(v => v.count));
  const maxCoverage = Math.max(...Object.values(colorMap).map(v => v.positions.size));

  // Get top 20 most frequent colors with frequency and coverage data
  const sortedColors = Object.entries(colorMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([key, data]) => {
      const [r, g, b] = key.split(',').map(Number);
      const hsl = rgbToHsl(r, g, b);
      return {
        r, g, b,
        hsl,
        rgb: { r, g, b },
        frequency: data.count,
        normalizedFrequency: data.count / maxCount,
        coverage: data.positions.size,
        normalizedCoverage: data.positions.size / maxCoverage
      };
    });

  return sortedColors;
};

// Analyze hue distribution to identify dominant color families
export const getDominantHueRange = (colorCandidates) => {
  const hueRanges = {
    red: { range: [0, 40, 340, 360], count: 0, totalSat: 0 },      // Red/Orange
    green: { range: [80, 160], count: 0, totalSat: 0 },            // Green
    blue: { range: [180, 260], count: 0, totalSat: 0 },            // Blue
    yellow: { range: [40, 80], count: 0, totalSat: 0 },            // Yellow
    purple: { range: [260, 340], count: 0, totalSat: 0 }           // Purple/Magenta
  };

  colorCandidates.forEach(color => {
    const [h, s] = color.hsl;
    const freq = color.normalizedFrequency || 1;

    // Check which hue range this color belongs to
    if ((h >= 0 && h <= 40) || (h >= 340 && h <= 360)) {
      hueRanges.red.count += freq;
      hueRanges.red.totalSat += s * freq;
    } else if (h >= 80 && h <= 160) {
      hueRanges.green.count += freq;
      hueRanges.green.totalSat += s * freq;
    } else if (h >= 180 && h <= 260) {
      hueRanges.blue.count += freq;
      hueRanges.blue.totalSat += s * freq;
    } else if (h >= 40 && h <= 80) {
      hueRanges.yellow.count += freq;
      hueRanges.yellow.totalSat += s * freq;
    } else if (h >= 260 && h <= 340) {
      hueRanges.purple.count += freq;
      hueRanges.purple.totalSat += s * freq;
    }
  });

  // Find the most dominant hue range (weighted by frequency and saturation)
  let maxScore = 0;
  let dominantRange = null;

  Object.entries(hueRanges).forEach(([name, data]) => {
    const score = data.count * (data.totalSat / Math.max(data.count, 1));
    if (score > maxScore) {
      maxScore = score;
      dominantRange = name;
    }
  });

  return dominantRange;
};

// Select the most dominant color using weighted scoring
export const selectColorForArticle = (colorCandidates, articleIndex) => {
  // Filter to colorful only (saturation >= 35%, lightness 20-80%)
  let colorfulColors = filterColorfulColors(colorCandidates);

  // If no colorful colors, use most saturated from all candidates
  if (colorfulColors.length === 0) {
    const sortedBySaturation = colorCandidates.sort((a, b) => b.hsl[1] - a.hsl[1]);
    colorfulColors = sortedBySaturation.slice(0, 1);
  }

  // Get the dominant hue range from the image
  const dominantHueRange = getDominantHueRange(colorfulColors);

  // Calculate composite score for each color
  // Weights: Frequency (50%), Saturation (30%), Coverage (20%)
  const WEIGHT_FREQUENCY = 0.50;
  const WEIGHT_SATURATION = 0.30;
  const WEIGHT_COVERAGE = 0.20;

  colorfulColors.forEach(color => {
    const [h, s, l] = color.hsl;

    // Normalize saturation (0-100 range)
    const normalizedSaturation = s / 100;

    // Calculate composite score
    let score =
      (WEIGHT_FREQUENCY * color.normalizedFrequency) +
      (WEIGHT_SATURATION * normalizedSaturation) +
      (WEIGHT_COVERAGE * color.normalizedCoverage);

    // Boost score if color is in the dominant hue range
    const inDominantRange = (
      (dominantHueRange === 'red' && ((h >= 0 && h <= 40) || (h >= 340 && h <= 360))) ||
      (dominantHueRange === 'green' && h >= 80 && h <= 160) ||
      (dominantHueRange === 'blue' && h >= 180 && h <= 260) ||
      (dominantHueRange === 'yellow' && h >= 40 && h <= 80) ||
      (dominantHueRange === 'purple' && h >= 260 && h <= 340)
    );

    if (inDominantRange) {
      score *= 1.3; // 30% boost for colors in dominant hue range
    }

    // Slight penalty for very common "sky blue" bias (hue 200-220)
    if (h >= 200 && h <= 220 && s < 60) {
      score *= 0.85; // Reduce score by 15%
    }

    color.compositeScore = score;
  });

  // Sort by composite score (highest first)
  colorfulColors.sort((a, b) => b.compositeScore - a.compositeScore);

  // Select the highest scoring color
  const selectedColor = { ...colorfulColors[0] };

  // Only boost saturation slightly, NO hue shifting
  selectedColor.hsl = [...selectedColor.hsl];
  selectedColor.hsl[1] = Math.min(100, selectedColor.hsl[1] * 1.15);

  // Convert to RGB
  const [r, g, b] = hslToRgb(...selectedColor.hsl);
  selectedColor.rgb = { r, g, b };
  selectedColor.r = r;
  selectedColor.g = g;
  selectedColor.b = b;

  return selectedColor;
};

// Create blur color (dark but more vibrant and varied)
export const createBlurColor = (hsl) => {
  const [h, s, l] = hsl;

  // More varied darkness range based on original lightness
  const newL = Math.max(20, Math.min(45, l * 0.5)); // Dark: 20-45%

  // Keep more saturation for vibrant colors, reduce less
  // If original is very saturated, keep it high
  const newS = Math.min(85, s * 1.0); // Preserve saturation, cap at 85%

  return [h, newS, newL];
};

// Create title highlight color (DARKER than blur, readable on light backgrounds)
export const createTitleHighlightColor = (blurHsl) => {
  const [h, s, l] = blurHsl;

  let newL;
  if (l <= 30) {
    // If blur is very dark (20-30%), make highlight medium-dark (55-65%)
    newL = 55 + (l / 30) * 10; // 55-65% range
  } else {
    // If blur is medium (30-45%), make highlight medium (65-75%)
    newL = 65 + ((l - 30) / 15) * 10; // 65-75% range
  }

  // Increase saturation for vibrancy
  const newS = Math.min(90, s * 1.6); // Boost saturation by 60%

  // Ensure minimum values for readability and vibrancy
  const finalL = Math.max(55, Math.min(75, newL)); // Clamp between 55-75%
  const finalS = Math.max(65, Math.min(90, newS)); // Clamp between 65-90%

  return [h, finalS, finalL];
};

// Create bullet text color (VIVID and CLEAR)
export const createBulletTextColor = (blurHsl, titleHsl) => {
  const [h, s1, l1] = blurHsl;
  const [, s2, l2] = titleHsl;

  // Create a vibrant middle color that's clearly visible
  const midL = Math.min(85, (l1 + l2) / 2 + 25); // Much lighter (was +10, now +25)
  const midS = Math.min(90, (s1 + s2) / 2 + 20); // Much more saturated (was +5, now +20)

  // Ensure it's not too similar to blur or title
  const finalL = Math.max(70, midL); // Ensure minimum lightness of 70%
  const finalS = Math.max(75, midS); // Ensure minimum saturation of 75%

  return [h, finalS, finalL];
};

// Create information box color (DARKER, READABLE on white background)
export const createInfoBoxColor = (blurHsl) => {
  const [h, s, l] = blurHsl;

  let newL;
  if (l <= 30) {
    newL = 50 + (l / 30) * 10; // 50-60% range
  } else {
    newL = 60 + ((l - 30) / 15) * 10; // 60-70% range
  }

  // Increase saturation for vibrancy (but not too much)
  const newS = Math.min(85, s * 1.4); // Boost saturation by 40%

  // Ensure minimum values for readability
  const finalL = Math.max(50, Math.min(70, newL)); // Clamp between 50-70%
  const finalS = Math.max(60, Math.min(85, newS)); // Clamp between 60-85%

  return [h, finalS, finalL];
};

// Helper function to generate 2 complementary border colors from blur color
export const getBorderColorsFromBlur = (blurColor) => {
  if (!blurColor) {
    // Default colors if no blur color
    return {
      color1: '#1e3a8a', // Navy (dominant)
      color2: 'transparent'  // Transparent
    };
  }

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Local RGB to HSL (returns object format)
  const localRgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  // Local HSL to RGB (returns object format)
  const localHslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
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
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  // Convert RGB to hex
  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  try {
    const rgb = hexToRgb(blurColor);
    const hsl = localRgbToHsl(rgb.r, rgb.g, rgb.b);

    // Generate 2 colors:
    // Color 1: Lighter version of the blur color (dominant color)
    const lighterL = Math.min(75, hsl.l + 30); // Add 30% lightness, cap at 75%
    const color1Hsl = { h: hsl.h, s: Math.min(hsl.s + 5, 100), l: lighterL };
    const color1Rgb = localHslToRgb(color1Hsl.h, color1Hsl.s, color1Hsl.l);

    // Color 2: Transparent
    return {
      color1: rgbToHex(color1Rgb.r, color1Rgb.g, color1Rgb.b),
      color2: 'transparent'
    };
  } catch (error) {
    console.error('Error generating border colors:', error);
    return {
      color1: '#1e3a8a',
      color2: 'transparent'
    };
  }
};

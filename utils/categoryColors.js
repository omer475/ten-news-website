// Category color mapping system - Refined professional palette
export const getCategoryColors = (category) => {
  const colorMap = {
    'World': '#2563EB',           // Royal Blue - International news, global affairs
    'Politics': '#DC2626',        // Crimson Red - Government, elections, policy
    'Business': '#059669',        // Emerald Green - Economy, markets, finance
    'Technology': '#7C3AED',      // Purple - Tech industry, innovation
    'Science': '#0891B2',         // Teal - Research, discoveries, environment
    'Health': '#DB2777',          // Rose - Medicine, wellness, public health
    'Sports': '#EA580C',          // Orange - Athletics, competitions
    'Lifestyle': '#CA8A04',       // Amber - Fashion, food, travel
    // Legacy/fallback categories
    'Breaking News': '#DC2626',   // Use Politics color
    'Environment': '#0891B2',     // Use Science color
    'General': '#2563EB'          // Use World color
  };

  const baseColor = colorMap[category] || '#1E3A8A'; // Default to Navy Blue (World)

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return {
    primary: baseColor,
    light: hexToRgba(baseColor, 0.2),    // 20% opacity for lighter version
    lighter: hexToRgba(baseColor, 0.15), // 15% opacity for even lighter version (category badge background)
    shadow: hexToRgba(baseColor, 0.3)    // 30% opacity for shadow
  };
};

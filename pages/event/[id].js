import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const GraphChart = dynamic(() => import('../../components/GraphChart'), { ssr: false });
const MapboxMap = dynamic(() => import('../../components/MapboxMap'), { ssr: false });


// Color extraction utilities (same as news pages)
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
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

const toHex = (n) => n.toString(16).padStart(2, '0');

// Extract dominant color from image (simplified, matches NewFirstPage)
const extractDominantColorFromImage = (imgElement) => {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(imgElement, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;
      
      // Collect colorful pixels
      const colorCounts = {};
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        
        // Convert to HSL inline
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
        
        // Only consider colorful pixels
        if (s * 100 > 15 && l * 100 > 10 && l * 100 < 90) {
          const key = `${Math.round(r/25)*25},${Math.round(g/25)*25},${Math.round(b/25)*25}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
      }
      
      // Find most common color
      let maxCount = 0;
      let dominantColor = null;
      for (const [key, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = key;
        }
      }
      
      if (dominantColor) {
        const [r, g, b] = dominantColor.split(',').map(Number);
        // Create darker blur color (40% of original)
        const darkR = Math.round(r * 0.4);
        const darkG = Math.round(g * 0.4);
        const darkB = Math.round(b * 0.4);
        const blurColor = `#${darkR.toString(16).padStart(2,'0')}${darkG.toString(16).padStart(2,'0')}${darkB.toString(16).padStart(2,'0')}`;
        resolve(blurColor);
      } else {
        resolve(null);
      }
    } catch (e) {
      console.log('Color extraction failed:', e);
      resolve(null);
    }
  });
};

// Function to render text with **highlighted** words
const renderHighlightedText = (text, accentColor) => {
  if (!text) return null;
  
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const highlightedText = part.slice(2, -2);
      return (
        <span key={index} style={{ fontWeight: 600, color: accentColor }}>
          {highlightedText}
        </span>
      );
    }
    return part;
  });
};

export default function EventPage() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [blurColor, setBlurColor] = useState(null);
  const [loading, setLoading] = useState(true);
  const colorExtractedRef = useRef(false); // Track if color was extracted from image

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch event from API (no fallbacks - only real events from database)
  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/world-events/${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.event) {
            // Transform API data to match expected format
            const apiEvent = data.event;
            // Create fallback latest development if none exists
            let latestDev = apiEvent.latestDevelopment;
            if (!latestDev && apiEvent.background) {
              latestDev = {
                title: `Latest on ${apiEvent.name}`,
                summary: apiEvent.background,
                time: 'Recently'
              };
            }
            
            // Get components from latest development
            const components = latestDev?.components || {};
            
            setEvent({
              id: apiEvent.slug || apiEvent.id,
              name: apiEvent.name,
              status: apiEvent.status === 'ongoing' ? 'Active' : 'Resolved',
              oneLiner: apiEvent.topic_prompt || '',
              accentColor: apiEvent.blur_color || '#0057B7',
              heroImage: apiEvent.image_url,
              latestDevelopment: latestDev,
              timeline: apiEvent.timeline?.map(t => ({
                date: t.date,
                event: t.headline
              })) || [],
              background: apiEvent.background,
              keyFacts: apiEvent.keyFacts || [],
              totalArticles: apiEvent.totalArticles || 0,
              // Live Updates Feed
              liveUpdates: apiEvent.liveUpdates || [],
              // Day Counter (only for applicable events)
              dayCounter: apiEvent.dayCounter || null,
              // Components from the latest linked article
              graph: components.graph || null,
              map: components.map || null,
              infoBox: components.info_box || null
            });
            // Only use blur color from DB if we haven't extracted one from the image yet
            if (apiEvent.blur_color && !colorExtractedRef.current) {
              setBlurColor(apiEvent.blur_color);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch event:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  // Handle image load and extract dominant color
  const handleImageLoad = async (e) => {
    const img = e.target;
    
    // First try direct extraction
    try {
      const color = await extractDominantColorFromImage(img);
      if (color) {
        colorExtractedRef.current = true; // Mark that we extracted color from image
        setBlurColor(color);
        return;
      }
    } catch (err) {
      console.log('Direct extraction failed, trying without CORS...');
    }
    
    // If failed, try loading image without crossOrigin (for base64 or same-origin)
    try {
      const newImg = new Image();
      newImg.onload = async () => {
        try {
          const color = await extractDominantColorFromImage(newImg);
          if (color) {
            colorExtractedRef.current = true; // Mark that we extracted color from image
            setBlurColor(color);
          }
        } catch (e) {
          console.log('Color extraction failed');
        }
      };
      newImg.src = img.src;
    } catch (err) {
      console.log('Fallback extraction failed');
    }
  };

  if (!mounted || loading || !event) {
    return (
      <>
        <Head>
          <title>Loading... | Today+</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        </Head>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fff'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            border: '2px solid #f0f0f0', 
            borderTop: '2px solid #1d1d1f', 
            borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite' 
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{event.name} | Today+</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
          background: #fff;
          color: #1d1d1f;
          height: auto !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
          overflow-y: visible !important;
          position: relative !important;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: auto;
        }

        #__next {
          min-height: 100vh;
          overflow: visible;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #fff;
          overflow: visible;
          position: relative;
        }

        /* Header */
        .header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
        }

        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #1d1d1f;
          transition: all 0.2s;
          padding: 0;
        }

        .back-btn:active {
          transform: scale(0.95);
          opacity: 0.7;
        }

        .header-title {
          font-size: 17px;
          font-weight: 600;
          color: #1d1d1f;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .header-spacer {
          width: 60px;
        }

        /* Hero Image Container */
        .hero-image-container {
          position: relative;
          width: calc(100% - 32px);
          height: 320px;
          overflow: hidden;
          border-radius: 20px;
          margin: 0 16px;
        }

        .hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 20px;
        }

        /* Blur overlay - starts from middle of image */
        .hero-blur-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 55%;
          backdrop-filter: blur(50px);
          -webkit-backdrop-filter: blur(50px);
          mask-image: linear-gradient(to bottom, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.05) 10%, 
            rgba(0,0,0,0.19) 20%, 
            rgba(0,0,0,0.45) 30%, 
            rgba(0,0,0,0.79) 40%, 
            rgba(0,0,0,1) 50%, 
            rgba(0,0,0,1) 100%
          );
          -webkit-mask-image: linear-gradient(to bottom, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.05) 10%, 
            rgba(0,0,0,0.19) 20%, 
            rgba(0,0,0,0.45) 30%, 
            rgba(0,0,0,0.79) 40%, 
            rgba(0,0,0,1) 50%, 
            rgba(0,0,0,1) 100%
          );
          pointer-events: none;
          z-index: 1;
          border-radius: 0 0 20px 20px;
        }

        /* Title overlay on image */
        .hero-title-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 0;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          z-index: 2;
          border-radius: 20px;
        }

        .hero-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 100px;
          margin-bottom: 12px;
          width: fit-content;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .hero-status-dot {
          width: 6px;
          height: 6px;
          background: ${event.accentColor};
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px ${event.accentColor};
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }

        .hero-status-text {
          font-size: 12px;
          font-weight: 600;
          color: white;
          letter-spacing: 0.02em;
        }

        .hero-title {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          line-height: 1.1;
          color: white;
          margin-bottom: 10px;
          text-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }

        .hero-subtitle {
          font-size: 15px;
          font-weight: 400;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 1px 8px rgba(0,0,0,0.3);
        }

        /* Content below image */
        .content {
          padding: 24px 20px 60px;
          background: #fff;
        }


        .section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #86868b;
        }

        .section-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(0,0,0,0.08) 0%, transparent 100%);
        }

        /* Latest Section */
        .latest-card {
          animation: fadeIn 0.5s ease 0.3s both;
        }

        .latest-card h3 {
          font-size: 20px;
          font-weight: 600;
          line-height: 1.3;
          color: #1d1d1f;
          letter-spacing: -0.2px;
          margin-bottom: 14px;
        }

        .latest-image {
          width: 100%;
          height: 220px;
          object-fit: cover;
          display: block;
          border-radius: 16px;
          margin-bottom: 14px;
        }

        .latest-content {
          padding: 0;
        }

        .latest-card p {
          font-size: 17px;
          font-weight: 450;
          line-height: 1.6;
          color: #1d1d1f;
          margin-bottom: 10px;
        }

        .latest-time {
          font-size: 13px;
          color: #86868b;
        }

        /* Key Facts */
        .facts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          animation: fadeIn 0.5s ease 0.4s both;
        }

        .fact-card {
          background: #f5f5f7;
          border-radius: 12px;
          padding: 16px 12px;
          text-align: center;
        }

        .fact-value {
          font-size: 18px;
          font-weight: 700;
          color: #1d1d1f;
          letter-spacing: -0.3px;
          margin-bottom: 4px;
        }

        .fact-label {
          font-size: 11px;
          font-weight: 500;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        /* Timeline */
        .timeline {
          animation: fadeIn 0.5s ease 0.5s both;
        }

        .timeline-item {
          display: flex;
          align-items: baseline;
          padding: 16px 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          animation: slideIn 0.4s ease both;
        }

        .timeline-item:first-child {
          padding-top: 0;
        }

        .timeline-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .timeline-dot {
          display: none;
        }

        .timeline-content {
          display: flex;
          align-items: baseline;
          gap: 16px;
          width: 100%;
        }

        .timeline-date {
          font-size: 13px;
          font-weight: 600;
          color: #86868b;
          min-width: 52px;
          flex-shrink: 0;
        }

        .timeline-text {
          font-size: 16px;
          font-weight: 400;
          line-height: 1.5;
          color: #1d1d1f;
          flex: 1;
        }

        /* Info Box Section */
        .info-box-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 16px;
          animation: fadeIn 0.5s ease 0.4s both;
        }

        .info-box-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .info-box-item:last-child {
          border-bottom: none;
        }

        .info-box-label {
          font-size: 14px;
          color: #86868b;
          font-weight: 500;
        }

        .info-box-value {
          font-size: 15px;
          color: #1d1d1f;
          font-weight: 600;
          text-align: right;
        }

        /* Graph Container */
        .graph-container {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 16px;
          min-height: 250px;
          animation: fadeIn 0.5s ease 0.45s both;
        }

        /* Map Container */
        .map-container {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          overflow: hidden;
          min-height: 300px;
          animation: fadeIn 0.5s ease 0.5s both;
        }

        /* Background Section */
        .background-card {
          animation: fadeIn 0.5s ease 0.6s both;
        }

        .background-card p {
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: #48484a;
        }

        /* Highlighted text */
        .highlight {
          font-weight: 600;
          color: ${event.accentColor};
        }

        /* Day Counter - Liquid Glass Design */
        .day-counter {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;
          
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 16px 20px;
          margin: 16px 20px 8px 20px;
          border-radius: 20px;
          animation: fadeIn 0.5s ease 0.2s both;
          
          /* Liquid Glass Effect */
          background-color: color-mix(in srgb, var(--c-glass) 25%, transparent);
          backdrop-filter: blur(12px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(12px) saturate(var(--saturation));
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
        }

        .day-counter-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 68px;
          height: 68px;
          background: ${event.accentColor};
          border-radius: 16px;
          color: white;
          box-shadow: 0 4px 12px ${event.accentColor}40;
        }

        .day-counter-number {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -1px;
          line-height: 1;
        }

        .day-counter-day-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.9;
          margin-top: 3px;
        }

        .day-counter-info {
          flex: 1;
        }

        .day-counter-title {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
          margin-bottom: 4px;
        }

        .day-counter-subtitle {
          font-size: 12px;
          color: #86868b;
          font-weight: 400;
        }

        /* Live Updates Feed */
        .live-updates-feed {
          animation: fadeIn 0.5s ease 0.55s both;
        }

        .live-update-item {
          display: flex;
          gap: 14px;
          padding: 16px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          animation: slideIn 0.4s ease both;
        }

        .live-update-item:first-child {
          padding-top: 0;
        }

        .live-update-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .live-update-image {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
          background: #f5f5f7;
        }

        .live-update-content {
          flex: 1;
          min-width: 0;
        }

        .live-update-title {
          font-size: 15px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.35;
          margin-bottom: 6px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .live-update-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #86868b;
        }

        .live-update-category {
          text-transform: capitalize;
          color: ${event.accentColor};
          font-weight: 500;
        }

        .live-update-time {
          color: #86868b;
        }

        .live-updates-count {
          font-size: 12px;
          color: #86868b;
          text-align: center;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          margin-top: 16px;
        }

        @media (max-width: 480px) {
          .hero-image-container {
            height: 300px;
          }
          .hero-title {
            font-size: 26px;
          }
          .hero-subtitle {
            font-size: 14px;
          }
          .hero-title-overlay {
            padding: 20px 16px;
            min-height: 180px;
          }
          .day-counter {
            margin: 12px 16px 4px 16px;
            padding: 14px 16px;
            gap: 14px;
            border-radius: 18px;
          }
          .day-counter-badge {
            min-width: 58px;
            height: 58px;
            border-radius: 14px;
          }
          .day-counter-number {
            font-size: 22px;
          }
          .day-counter-day-label {
            font-size: 9px;
          }
          .day-counter-title {
            font-size: 13px;
          }
          .day-counter-subtitle {
            font-size: 11px;
          }
        }

        @media (max-width: 390px) {
          .hero-image-container {
            height: 280px;
          }
          .hero-title {
            font-size: 24px;
          }
          .hero-subtitle {
            font-size: 13px;
          }
          .facts-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .fact-card {
            padding: 12px 8px;
          }
          .fact-value {
            font-size: 16px;
          }
          .fact-label {
            font-size: 10px;
          }
        }
      `}</style>

      <div className="page">
        {/* Header */}
        <header className="header">
          <button className="back-btn" onClick={() => router.push('/')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="header-title">Event</span>
          <div className="header-spacer" />
        </header>

        {/* Hero Image with Blur Overlay */}
        <div className="hero-image-container">
          {event.heroImage && (
            <img 
              className="hero-image" 
              src={event.heroImage} 
              alt={event.name}
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
            />
          )}
          <div 
            className="hero-blur-overlay" 
            style={{ background: blurColor || event.accentColor }}
          />
          <div 
            className="hero-title-overlay"
            style={{ 
              background: `linear-gradient(to bottom,
                ${blurColor || event.accentColor}15 0%,
                ${blurColor || event.accentColor}30 20%,
                ${blurColor || event.accentColor}60 40%,
                ${blurColor || event.accentColor}90 60%,
                ${blurColor || event.accentColor}cc 75%,
                ${blurColor || event.accentColor}ee 85%,
                ${blurColor || event.accentColor}fa 92%,
                ${blurColor || event.accentColor}ff 100%)`
            }}
          >
            {event.status && (
              <div className="hero-status-badge">
                <span className="hero-status-dot" />
                <span className="hero-status-text">{event.status}</span>
              </div>
            )}
            <h1 className="hero-title">{event.name || 'Event'}</h1>
            {event.oneLiner && (
              <p className="hero-subtitle">{renderHighlightedText(event.oneLiner, 'rgba(255,255,255,0.95)')}</p>
            )}
          </div>
        </div>

        {/* Day Counter - only for applicable events */}
        {event.dayCounter && (
          <div className="day-counter">
            <div className="day-counter-badge">
              <span className="day-counter-number">{event.dayCounter.days}</span>
              <span className="day-counter-day-label">Days</span>
            </div>
            <div className="day-counter-info">
              <div className="day-counter-title">Ongoing since {new Date(event.dayCounter.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="day-counter-subtitle">This event has been active for {event.dayCounter.days} days</div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="content">
          {/* Latest Development */}
          {event.latestDevelopment && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">Latest</span>
                <div className="section-line" />
              </div>
              <div className="latest-card">
                <h3>{event.latestDevelopment.title}</h3>
                <div className="latest-content">
                  <p>{renderHighlightedText(event.latestDevelopment.summary, event.accentColor)}</p>
                  <span className="latest-time">{event.latestDevelopment.time}</span>
                </div>
              </div>
            </section>
          )}

          {/* Info Box from Article */}
          {event.infoBox && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">{event.infoBox.title || 'Details'}</span>
                <div className="section-line" />
              </div>
              <div className="info-box-card">
                {event.infoBox.items?.map((item, idx) => (
                  <div key={idx} className="info-box-item">
                    <span className="info-box-label">{item.label}</span>
                    <span className="info-box-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Graph from Article */}
          {event.graph && event.graph.data && event.graph.data.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">{event.graph.title || 'Data'}</span>
                <div className="section-line" />
              </div>
              <div className="graph-container">
                <GraphChart graph={event.graph} expanded={true} accentColor={event.accentColor} />
              </div>
            </section>
          )}

          {/* Map from Article */}
          {event.map && event.map.locations && event.map.locations.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">{event.map.title || 'Location'}</span>
                <div className="section-line" />
              </div>
              <div className="map-container">
                <MapboxMap map={event.map} expanded={true} accentColor={event.accentColor} />
              </div>
            </section>
          )}

          {/* Key Facts */}
          {event.keyFacts && event.keyFacts.length > 0 && (
            <section className="section">
              <div className="facts-grid">
                {event.keyFacts.map((fact, idx) => (
                <div key={idx} className="fact-card">
                  <div className="fact-value">{fact.value}</div>
                  <div className="fact-label">{fact.label}</div>
                </div>
              ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          {event.timeline && event.timeline.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">Timeline</span>
                <div className="section-line" />
              </div>
              <div className="timeline">
                {event.timeline.map((item, idx) => (
                <div 
                  key={idx} 
                  className="timeline-item"
                  style={{ animationDelay: `${0.5 + idx * 0.05}s` }}
                >
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-date">{item.date}</div>
                    <div className="timeline-text">{renderHighlightedText(item.event, event.accentColor)}</div>
                  </div>
                </div>
                ))}
              </div>
            </section>
          )}

          {/* Live Updates Feed */}
          {event.liveUpdates && event.liveUpdates.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">Live Updates</span>
                <div className="section-line" />
              </div>
              <div className="live-updates-feed">
                {event.liveUpdates.slice(0, 10).map((update, idx) => (
                  <div 
                    key={update.id || idx} 
                    className="live-update-item"
                    style={{ animationDelay: `${0.55 + idx * 0.05}s` }}
                  >
                    {update.image && (
                      <img 
                        className="live-update-image" 
                        src={update.image} 
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className="live-update-content">
                      <div className="live-update-title">{update.title}</div>
                      <div className="live-update-meta">
                        {update.category && (
                          <>
                            <span className="live-update-category">{update.category}</span>
                            <span>•</span>
                          </>
                        )}
                        <span className="live-update-time">{update.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {event.totalArticles > 10 && (
                  <div className="live-updates-count">
                    Showing 10 of {event.totalArticles} related articles
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Background */}
          {event.background && (
            <section className="section">
              <div className="section-header">
                <span className="section-title">Background</span>
                <div className="section-line" />
              </div>
              <div className="background-card">
                <p>{renderHighlightedText(event.background, event.accentColor)}</p>
              </div>
            </section>
          )}
        </main>

      </div>
    </>
  );
}

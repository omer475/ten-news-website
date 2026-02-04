import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import TodayPlusLoader from '../../components/TodayPlusLoader';

// Dynamic imports for heavy components
const GraphChart = dynamic(() => import('../../components/GraphChart'), { ssr: false });
const MapboxMap = dynamic(() => import('../../components/MapboxMap'), { ssr: false });
const EventComponents = dynamic(() => import('../../components/events/EventComponents'), { ssr: true });


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
            // Get latest development from API (comes from world_event_latest table)
            let latestDev = apiEvent.latestDevelopment;
            console.log('Latest Development from API:', latestDev);
            
            // Get components from latest development
            const components = latestDev?.components || {};
            
            setEvent({
              id: apiEvent.slug || apiEvent.id,
              dbId: apiEvent.id, // Store the actual database UUID for visit tracking
              name: apiEvent.name,
              status: apiEvent.status === 'ongoing' ? 'Active' : 'Resolved',
              oneLiner: apiEvent.topicPrompt || apiEvent.topic_prompt || '',
              accentColor: apiEvent.blurColor || apiEvent.blur_color || '#0057B7',
              heroImage: apiEvent.imageUrl || apiEvent.image_url,
              latestDevelopment: latestDev,
              // Timeline data for EventTimeline component
              timeline: apiEvent.timeline?.map(t => ({
                id: t.id,
                date: t.date || t.rawDate,
                headline: t.headline,
                source_article_id: t.source_article_id || t.articleId
              })) || [],
              background: apiEvent.background,
              keyFacts: apiEvent.keyFacts || apiEvent.key_facts || [],
              totalArticles: apiEvent.totalArticles || 0,
              // Live Updates Feed
              liveUpdates: apiEvent.liveUpdates || [],
              // Day Counter - new format (calculated on frontend)
              started_at: apiEvent.startedAt || apiEvent.started_at || null,
              ends_at: apiEvent.endsAt || apiEvent.ends_at || null,
              day_counter_type: apiEvent.dayCounterType || apiEvent.day_counter_type || null,
              show_day_counter: apiEvent.showDayCounter || apiEvent.show_day_counter || false,
              // Legacy day counter support
              dayCounter: apiEvent.dayCounter || null,
              // Smart Event Components (perspectives, what to watch, geographic impact, historical comparison)
              components: apiEvent.components || components || null
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

  // Save visit timestamp when event page is viewed (for "NEW" badge on first page)
  useEffect(() => {
    if (event && event.dbId) {
      localStorage.setItem(`tennews_event_visit_${event.dbId}`, Date.now().toString());
    }
  }, [event]);

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
        <TodayPlusLoader />
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
          overflow-y: auto !important;
          position: relative !important;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: auto;
          touch-action: pan-y !important;
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
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }

        /* Back button - floating on image */
        .back-btn {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #fff;
          transition: all 0.2s;
          padding: 0;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
        }

        .back-btn:hover {
          opacity: 0.8;
        }

        .back-btn:active {
          transform: scale(0.95);
        }

        /* Hero Image Container */
        .hero-image-container {
          position: relative;
          width: 100%;
          height: 320px;
          overflow: hidden;
          border-radius: 0;
          margin: 0;
        }

        .hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 0;
        }

        /* Liquid glass overlay - gradient from 0% to 100% opacity */
        .hero-liquid-glass {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 35%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border-radius: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        /* Background gradient layer (controls opacity of white overlay) */
        .hero-liquid-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.2) 20%,
            rgba(255, 255, 255, 0.5) 45%,
            rgba(255, 255, 255, 0.8) 70%,
            rgba(255, 255, 255, 1) 100%
          );
          z-index: 0;
        }

        /* Blur layer with gradient mask (controls blur intensity) */
        .hero-liquid-glass::after {
          content: '';
          position: absolute;
          inset: 0;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          -webkit-mask: linear-gradient(to bottom, transparent 0%, black 50%);
          mask: linear-gradient(to bottom, transparent 0%, black 50%);
          z-index: 1;
        }

        /* Title overlay on image - sits on top of liquid glass */
        .hero-title-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          z-index: 2;
          border-radius: 0;
        }

        /* Ensure all content inside title overlay is above liquid glass */
        .hero-title-overlay > * {
          position: relative;
          z-index: 2;
        }

        .hero-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          line-height: 1.15;
          color: #1d1d1f;
          margin-bottom: 8px;
        }

        .hero-subtitle {
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: #6b7280;
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

        /* Event Status Bar - Compact Design */
        .event-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 12px 20px 8px 20px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.04),
            inset 0 0 0 1px rgba(0, 0, 0, 0.04);
          animation: fadeIn 0.5s ease 0.2s both;
        }

        .day-text {
          font-size: 13px;
          font-weight: 500;
          color: #1d1d1f;
        }

        .day-text strong {
          font-weight: 700;
          color: ${event.accentColor || '#007aff'};
        }

        .status-text {
          font-size: 13px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .status-date {
          font-size: 12px;
          color: #86868b;
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
          .event-status-bar {
            margin: 10px 16px 6px 16px;
            padding: 8px 12px;
            border-radius: 10px;
          }
          .day-text {
            font-size: 12px;
          }
          .status-date {
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
        {/* Hero Image with Blur Overlay */}
        <div className="hero-image-container">
          {/* Back button on image - goes to previous page in history */}
          <button className="back-btn" onClick={() => {
            // Use browser history to go back to where user came from
            if (window.history.length > 1) {
              router.back();
            } else {
              // Fallback to home if no history
              router.push('/');
            }
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          {event.heroImage && (
            <img 
              className="hero-image" 
              src={event.heroImage} 
              alt={event.name}
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
            />
          )}
          {/* Liquid glass overlay - gradient from 0% to 100% opacity */}
          <div className="hero-liquid-glass" />
          <div className="hero-title-overlay">
            <h1 className="hero-title">{event.name || 'Event'}</h1>
            {event.oneLiner && (
              <p className="hero-subtitle">{renderHighlightedText(event.oneLiner, 'rgba(255,255,255,0.95)')}</p>
            )}
          </div>
        </div>

        {/* Event Status Bar - Only show if show_day_counter is true */}
        {event.show_day_counter && (
          <div className="event-status-bar">
            {(() => {
              // Calculate days from started_at or dayCounter.startDate
              const startDate = event.started_at || (event.dayCounter && event.dayCounter.startDate);
              if (startDate) {
                const start = new Date(startDate);
                const now = new Date();
                const diffTime = Math.abs(now - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return (
                  <span className="day-text">
                    Day <strong>{diffDays.toLocaleString()}</strong>
                  </span>
                );
              }
              return <span className="status-text">{event.status === 'Resolved' ? 'Resolved' : 'Ongoing'}</span>;
            })()}
            {(() => {
              const startDate = event.started_at || (event.dayCounter && event.dayCounter.startDate);
              if (startDate) {
                return (
                  <span className="status-date">
                    Since {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Content */}
        <main className="content">
          {/* Smart Event Components (Timeline, Perspectives, What to Watch, Geographic Impact, Historical) */}
          <EventComponents event={event} />

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

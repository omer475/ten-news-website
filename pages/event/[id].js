import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import TodayPlusLoader from '../../components/TodayPlusLoader';

// Dynamic import for map component (uses D3.js, heavy)
const GeographicImpactSection = dynamic(
  () => import('../../components/events/GeographicImpactSection'),
  { ssr: false }
);

// ============================================
// UTILITIES (DO NOT MODIFY)
// ============================================

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
      
      const colorCounts = {};
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
        
        if (s * 100 > 15 && l * 100 > 10 && l * 100 < 90) {
          const key = `${Math.round(r/25)*25},${Math.round(g/25)*25},${Math.round(b/25)*25}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
      }
      
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

const renderHighlightedText = (text, accentColor) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const highlightedText = part.slice(2, -2);
      return (
        <span key={index} style={{ fontWeight: 700, color: accentColor }}>
          {highlightedText}
        </span>
      );
    }
    return part;
  });
};

// ============================================
// SCROLL ANIMATION UTILITIES
// ============================================

// Hook to track scroll progress of an element (0 to 1)
function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementHeight = rect.height;
      
      // Progress from when element enters viewport to when it leaves
      const start = windowHeight;
      const end = -elementHeight;
      const current = rect.top;
      
      const p = Math.max(0, Math.min(1, (start - current) / (start - end)));
      setProgress(p);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [ref]);
  
  return progress;
}

// Map a value from one range to another
function remap(value, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// Linear interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Format relative time
function getRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date is within last 7 days
function isRecent(dateString) {
  const date = new Date(dateString);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date >= weekAgo;
}

// ============================================
// SECTION HEAD COMPONENT
// ============================================

function SectionHead({ title, subtitle, accentColor, style }) {
  return (
    <div className="section-head" style={style}>
      <span className="section-title-text">{title}</span>
      {subtitle && <span className="section-subtitle">{subtitle}</span>}
      <div className="section-head-line" />
      
      <style jsx>{`
        .section-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          will-change: opacity, transform;
        }
        .section-title-text {
          font-size: 13px;
          font-weight: 700;
          color: #1d1d1f;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .section-subtitle {
          font-size: 12px;
          font-weight: 500;
          color: #9ca3af;
        }
        .section-head-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(0,0,0,0.08) 0%, transparent 100%);
        }
      `}</style>
    </div>
  );
}

// ============================================
// STANCE CONFIG FOR PERSPECTIVES
// ============================================

const stanceCfg = {
  supportive: { color: '#10b981', bg: '#10b98112', label: 'Supports' },
  opposed: { color: '#ef4444', bg: '#ef444412', label: 'Opposes' },
  concerned: { color: '#f59e0b', bg: '#f59e0b12', label: 'Concerned' },
  neutral: { color: '#6b7280', bg: '#6b728012', label: 'Neutral' },
  defensive: { color: '#3b82f6', bg: '#3b82f612', label: 'Defending' },
  divided: { color: '#8b5cf6', bg: '#8b5cf612', label: 'Divided' }
};

// ============================================
// LATEST DEVELOPMENT SECTION
// ============================================

function LatestSection({ latest, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const [displayTime, setDisplayTime] = useState('');
  
  useEffect(() => {
    if (latest?.published_at) {
      setDisplayTime(getRelativeTime(latest.published_at));
    } else if (latest?.time) {
      setDisplayTime(latest.time);
    }
  }, [latest]);
  
  // Latest Development is mandatory - show placeholder if missing
  if (!latest || (!latest.title && !latest.summary)) {
    return (
      <section ref={ref} className="full-section">
        <div style={{ padding: '36px 28px', maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ background: `${accentColor || '#0057B7'}18`, color: accentColor || '#0057B7', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>LATEST</span>
          </div>
          <p style={{ fontSize: '15px', color: '#86868b', lineHeight: 1.7 }}>
            Latest development will be updated as the story progresses.
          </p>
        </div>
      </section>
    );
  }
  
  const details = latest.components?.details || latest.components?.info_boxes || [];
  
  const badgeOpacity = remap(p, 0.12, 0.22, 0, 1);
  const titleOpacity = remap(p, 0.15, 0.25, 0, 1);
  const titleY = remap(p, 0.15, 0.27, 24, 0);
  const summaryOpacity = remap(p, 0.2, 0.3, 0, 1);
  const statsOpacity = remap(p, 0.25, 0.35, 0, 1);
  const statsY = remap(p, 0.25, 0.35, 18, 0);
  const cardScale = remap(p, 0.1, 0.24, 0.93, 1);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        {/* Label row */}
        <div className="latest-label-row" style={{ opacity: badgeOpacity }}>
          <div className="latest-label-left">
            <span className="pulse-dot" />
            <span className="latest-label-text">LATEST DEVELOPMENT</span>
          </div>
          {displayTime && <span className="latest-time">{displayTime}</span>}
        </div>
        
        {/* Card */}
        <div className="latest-card" style={{ transform: `scale(${cardScale})`, transformOrigin: 'top center' }}>
          <h3 className="latest-title" style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
            {latest.title}
          </h3>
          {latest.summary && (
            <p className="latest-summary" style={{ opacity: summaryOpacity }}>
              {latest.summary}
            </p>
          )}
          
          {details.length > 0 && (
            <div className="latest-stats" style={{ opacity: statsOpacity, transform: `translateY(${statsY}px)` }}>
              {details.slice(0, 3).map((detail, idx) => (
                <div key={idx} className="latest-stat">
                  <span className="stat-value" style={{ color: accentColor }}>{detail.value}</span>
                  <span className="stat-label">{detail.label}</span>
                  {idx < Math.min(details.length, 3) - 1 && <div className="stat-divider" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        .latest-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          will-change: opacity;
        }
        .latest-label-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: lp 2s ease-in-out infinite;
        }
        .latest-label-text {
          font-size: 11px;
          font-weight: 700;
          color: #86868b;
          letter-spacing: 1.5px;
        }
        .latest-time {
          font-size: 12px;
          color: #c4c4c6;
        }
        .latest-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 22px;
          padding: 28px 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03), 0 6px 24px rgba(0,0,0,0.06);
          will-change: transform;
        }
        .latest-title {
          font-size: clamp(20px, 4.5vw, 26px);
          font-weight: 800;
          color: #1d1d1f;
          letter-spacing: -0.4px;
          line-height: 1.25;
          margin: 0 0 12px 0;
          will-change: opacity, transform;
        }
        .latest-summary {
          font-size: 15px;
          color: #48484a;
          line-height: 1.7;
          margin: 0;
          will-change: opacity;
        }
        .latest-stats {
          display: flex;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(0,0,0,0.06);
          will-change: opacity, transform;
        }
        .latest-stat {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .stat-label {
          font-size: 10px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        .stat-divider {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 28px;
          background: rgba(0,0,0,0.07);
        }
        
        @keyframes lp {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.75); opacity: 0.6; }
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
          .latest-card {
            padding: 22px 18px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// TIMELINE SECTION
// ============================================

function TimelineSection({ entries, liveUpdates, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const [showHistorical, setShowHistorical] = useState(false);
  
  // Build "This Week" from liveUpdates (all articles linked to event from last 7 days)
  // Build "Historical" from world_event_timeline entries older than 7 days
  const { recentEntries, historicalEntries } = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // "This Week" = all linked articles from the last 7 days (from liveUpdates)
    const recent = (liveUpdates || [])
      .filter(update => {
        const pubDate = new Date(update.publishedAt);
        return pubDate >= sevenDaysAgo;
      })
      .map(update => ({
        id: update.id,
        date: update.publishedAt,
        headline: update.title,
        category: update.category,
        image: update.image,
        isArticle: true
      }));
    
    // "Historical" = timeline entries older than 7 days + any old articles
    const historical = [];
    
    // Add timeline entries (from world_event_timeline table)
    if (entries && entries.length > 0) {
      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate < sevenDaysAgo) {
          historical.push(entry);
        }
      });
    }
    
    // Sort: newest first for recent, oldest first for historical
    recent.sort((a, b) => new Date(b.date) - new Date(a.date));
    historical.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return { recentEntries: recent, historicalEntries: historical };
  }, [entries, liveUpdates]);
  
  const totalEntries = recentEntries.length + historicalEntries.length;
  
  // Always render timeline (it's mandatory)
  if (totalEntries === 0 && (!entries || entries.length === 0)) {
    // Truly no data at all - show minimal placeholder
    return (
      <section ref={ref} className="full-section">
        <div className="section-inner">
          <SectionHead 
            title="Timeline" 
            subtitle="Developing"
            accentColor={accentColor}
          />
          <div style={{ padding: '20px 0', color: '#86868b', fontSize: '14px', textAlign: 'center' }}>
            Timeline will be updated as the story develops.
          </div>
        </div>
      </section>
    );
  }
  
  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 18, 0);
  const recentLineHeight = remap(p, 0.18, 0.5, 0, 100);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead 
          title="Timeline" 
          subtitle={`${totalEntries} events`}
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />
        
        {/* Historical Timeline Card */}
        {historicalEntries.length > 0 && (
          <div className={`historical-card ${showHistorical ? 'open' : ''}`}>
            <button 
              className="historical-header"
              onClick={() => setShowHistorical(!showHistorical)}
            >
              <div className="historical-header-left">
                <div className="historical-header-text">
                  <span className="historical-title">Historical Timeline</span>
                  <span className="historical-subtitle">View past events before this week</span>
                </div>
              </div>
              <div className="historical-header-right">
                <span className="historical-count">{historicalEntries.length}</span>
                <div className={`historical-chevron ${showHistorical ? 'open' : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </button>
            
            {/* Expandable Content */}
            {showHistorical && (
              <div className="historical-content">
                <div className="historical-timeline">
                  {historicalEntries.map((entry, i) => {
                    const dateObj = new Date(entry.date);
                    return (
                      <div 
                        key={entry.id || `hist-${i}`} 
                        className="hist-entry"
                        style={{ animationDelay: `${i * 0.04}s` }}
                      >
                        <div className="hist-entry-dot" />
                        <div className="hist-entry-date">
                          <span className="hist-date-day">{dateObj.getDate()}</span>
                          <span className="hist-date-month">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="hist-date-year">{dateObj.getFullYear()}</span>
                        </div>
                        <div className="hist-entry-text">{entry.headline}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* This Week Label */}
        {recentEntries.length > 0 && (
          <div className="week-label">
            <span className="week-label-text">This Week</span>
            <span className="week-label-count">{recentEntries.length}</span>
          </div>
        )}
        
        {/* Recent Timeline (Always Visible) */}
        {recentEntries.length > 0 ? (
          <div className="timeline-track recent">
            <div className="timeline-bg-line recent" />
            <div className="timeline-fill-line" style={{ height: `${recentLineHeight}%` }} />
            
            {recentEntries.map((entry, i) => {
              const entryStart = 0.2 + (i / Math.max(recentEntries.length, 1)) * 0.28;
              const entryOpacity = remap(p, entryStart, entryStart + 0.05, 0, 1);
              const entryX = remap(p, entryStart, entryStart + 0.06, -16, 0);
              const isLast = i === recentEntries.length - 1;
              
              return (
                <div 
                  key={entry.id || `recent-${i}`} 
                  className="timeline-entry"
                  style={{ opacity: entryOpacity, transform: `translateX(${entryX}px)` }}
                >
                  <div 
                    className={`timeline-dot recent ${isLast ? 'last' : ''}`}
                    style={{ borderColor: accentColor, ...(isLast ? { background: accentColor } : {}) }}
                  />
                  <div className="timeline-entry-content">
                    <span className="timeline-date" style={{ color: accentColor }}>
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="timeline-headline">{entry.headline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-recent">No updates this week</div>
        )}
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        
        /* Historical Card - Liquid Glass */
        .historical-card {
          margin-bottom: 20px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.3),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.95),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
            inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.5),
            inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.06),
            inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.08),
            inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.08),
            inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.04),
            0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.06),
            0px 4px 16px 0px rgba(0, 0, 0, 0.05);
        }
        .historical-card:hover {
          background: rgba(255, 255, 255, 0.75);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.4),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.95),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
            inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.5),
            inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.06),
            inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.08),
            inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.08),
            inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.04),
            0px 1px 4px 0px rgba(0, 0, 0, 0.08),
            0px 6px 20px 0px rgba(0, 0, 0, 0.06);
        }
        .historical-card.open {
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.5),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.95),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
            inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.5),
            inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.06),
            inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.08),
            inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.08),
            inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.04),
            0px 2px 6px 0px rgba(0, 0, 0, 0.1),
            0px 8px 28px 0px rgba(0, 0, 0, 0.08);
        }
        
        .historical-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 18px 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .historical-header:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .historical-header-left {
          display: flex;
          align-items: center;
        }
        .historical-header-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        .historical-title {
          font-size: 15px;
          font-weight: 700;
          color: #1d1d1f;
        }
        .historical-subtitle {
          font-size: 12px;
          color: #6b7280;
        }
        
        .historical-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .historical-count {
          font-size: 12px;
          font-weight: 700;
          color: #48484a;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          padding: 5px 12px;
          border-radius: 20px;
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.6),
            inset 0.5px 1px 0px -0.5px rgba(255, 255, 255, 0.9),
            0px 1px 2px rgba(0, 0, 0, 0.04);
        }
        .historical-chevron {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 10px;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.5),
            inset 0.5px 1px 0px -0.5px rgba(255, 255, 255, 0.9),
            0px 1px 3px rgba(0, 0, 0, 0.05);
        }
        .historical-chevron.open {
          transform: rotate(180deg);
          background: #1d1d1f;
          color: #fff;
          box-shadow: 
            0px 2px 6px rgba(0, 0, 0, 0.15),
            0px 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Historical Content */
        .historical-content {
          padding: 0 20px 20px 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.04);
          animation: expandContent 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        
        .historical-timeline {
          padding-top: 16px;
        }
        
        /* Historical Entry */
        .hist-entry {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.03);
          animation: entrySlideIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards;
          opacity: 0;
        }
        .hist-entry:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .hist-entry:first-child {
          padding-top: 0;
        }
        
        .hist-entry-dot {
          width: 8px;
          height: 8px;
          background: rgba(0, 0, 0, 0.15);
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 6px;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .hist-entry-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 48px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 12px;
          flex-shrink: 0;
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.6),
            inset 0.5px 1px 0px -0.5px rgba(255, 255, 255, 0.95),
            0px 1px 3px rgba(0, 0, 0, 0.04);
        }
        .hist-date-day {
          font-size: 20px;
          font-weight: 800;
          color: #1d1d1f;
          line-height: 1;
        }
        .hist-date-month {
          font-size: 10px;
          font-weight: 700;
          color: #48484a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 3px;
        }
        .hist-date-year {
          font-size: 9px;
          font-weight: 500;
          color: #86868b;
          margin-top: 1px;
        }
        
        .hist-entry-text {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #1d1d1f;
          line-height: 1.55;
          padding-top: 8px;
        }
        
        @keyframes expandContent {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes entrySlideIn {
          from { 
            opacity: 0; 
            transform: translateY(8px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        /* Week Label */
        .week-label {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .week-label-text {
          font-size: 12px;
          font-weight: 700;
          color: #3b82f6;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .week-label-count {
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          background: #3b82f6;
          padding: 2px 8px;
          border-radius: 10px;
        }
        
        /* Timeline Track */
        .timeline-track {
          position: relative;
          padding-left: 32px;
        }
        .timeline-bg-line {
          position: absolute;
          left: 9px;
          top: 5px;
          bottom: 5px;
          width: 2px;
          background: rgba(0,0,0,0.06);
          border-radius: 1px;
        }
        .timeline-bg-line.recent {
          background: linear-gradient(to bottom, rgba(59,130,246,0.2), rgba(59,130,246,0.1));
        }
        .timeline-fill-line {
          position: absolute;
          left: 9px;
          top: 5px;
          width: 2px;
          background: linear-gradient(to bottom, #93c5fd, #3b82f6);
          border-radius: 1px;
          will-change: height;
        }
        
        /* Timeline Entry */
        .timeline-entry {
          position: relative;
          padding-bottom: 18px;
          will-change: opacity, transform;
        }
        .timeline-entry:last-child {
          padding-bottom: 0;
        }
        
        /* Timeline Dot */
        .timeline-dot {
          position: absolute;
          left: -32px;
          top: 4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          border: 2.5px solid #d1d5db;
          z-index: 1;
        }
        .timeline-dot.recent {
          border-color: ${accentColor};
        }
        .timeline-dot.last {
          box-shadow: 0 0 8px rgba(59,130,246,0.25);
        }
        
        /* Timeline Content */
        .timeline-entry-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .timeline-date {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
        }
        .timeline-headline {
          font-size: 14px;
          font-weight: 500;
          color: #1d1d1f;
          line-height: 1.45;
        }
        
        /* No Recent */
        .no-recent {
          text-align: center;
          padding: 24px;
          background: #f9f9fb;
          border-radius: 14px;
          font-size: 13px;
          color: #9ca3af;
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
          .historical-card {
            border-radius: 16px;
          }
          .historical-header {
            padding: 14px 16px;
          }
          .historical-title {
            font-size: 14px;
          }
          .historical-subtitle {
            font-size: 11px;
          }
          .historical-count {
            font-size: 11px;
            padding: 4px 10px;
          }
          .historical-chevron {
            width: 26px;
            height: 26px;
            border-radius: 8px;
          }
          .historical-content {
            padding: 0 16px 16px 16px;
          }
          .hist-entry {
            gap: 10px;
          }
          .hist-entry-date {
            min-width: 42px;
            padding: 8px 10px;
            border-radius: 10px;
          }
          .hist-date-day {
            font-size: 17px;
          }
          .hist-entry-text {
            font-size: 13px;
            padding-top: 6px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// WHAT TO WATCH SECTION
// ============================================

function WatchSection({ items, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const [expandedIdx, setExpandedIdx] = useState(null);
  
  if (!items || items.length === 0) return null;
  
  const sorted = useMemo(() => 
    [...items].sort((a, b) => new Date(a.date) - new Date(b.date)),
  [items]);
  
  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 16, 0);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead 
          title="What to Watch" 
          subtitle={`${items.length} upcoming`}
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />
        
        <div className="watch-cards">
          {sorted.map((item, i) => {
            const cardStart = 0.2 + i * 0.055;
            const cardOpacity = remap(p, cardStart, cardStart + 0.08, 0, 1);
            const cardY = remap(p, cardStart, cardStart + 0.08, 24, 0);
            const cardScale = remap(p, cardStart, cardStart + 0.08, 0.96, 1);
            const isOpen = expandedIdx === i;
            const date = new Date(item.date);
            
            return (
              <div 
                key={i}
                className={`watch-card ${isOpen ? 'expanded' : ''}`}
                onClick={() => setExpandedIdx(isOpen ? null : i)}
                style={{ 
                  opacity: cardOpacity, 
                  transform: `translateY(${cardY}px) scale(${cardScale})` 
                }}
              >
                <div className="watch-card-main">
                  <div className="watch-date-block">
                    <span className="watch-month">{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                    <span className="watch-day">{date.getDate()}</span>
                  </div>
                  <div className="watch-content">
                    <span className="watch-title">{item.title}</span>
                    {!isOpen && item.description && (
                      <span className="watch-desc-preview">{item.description}</span>
                    )}
                  </div>
                  <svg className={`watch-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                
                {isOpen && (
                  <div className="watch-expanded">
                    <p className="watch-desc-full">{item.description}</p>
                    <span className={`watch-badge ${item.confirmed ? 'confirmed' : 'expected'}`}>
                      {item.confirmed ? 'Confirmed' : 'Expected'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        .watch-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .watch-card {
          display: flex;
          flex-direction: column;
          padding: 16px 18px;
          background: #f9f9fb;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
          will-change: opacity, transform, background, box-shadow;
        }
        .watch-card:hover {
          background: #f3f3f5;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .watch-card.expanded {
          background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .watch-card-main {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .watch-date-block {
          min-width: 46px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .watch-month {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
        }
        .watch-day {
          font-size: 26px;
          font-weight: 800;
          color: #1d1d1f;
          line-height: 1;
        }
        .watch-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .watch-title {
          font-size: 15px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.35;
        }
        .watch-desc-preview {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .watch-chevron {
          flex-shrink: 0;
          color: #c4c4c6;
          transition: transform 0.25s ease;
          margin-top: 6px;
        }
        .watch-chevron.open {
          transform: rotate(180deg);
        }
        .watch-expanded {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(0,0,0,0.05);
          animation: ru 0.25s ease;
        }
        .watch-desc-full {
          font-size: 13px;
          color: #48484a;
          line-height: 1.55;
          margin: 0 0 12px 0;
        }
        .watch-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .watch-badge.confirmed {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }
        .watch-badge.expected {
          background: rgba(245, 158, 11, 0.1);
          color: #d97706;
        }
        
        @keyframes ru {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// PERSPECTIVES SECTION
// ============================================

function PerspectivesSection({ perspectives, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    if (!perspectives || perspectives.length <= 1 || userInteracted) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % perspectives.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [perspectives, userInteracted]);
  
  const handleSelect = (idx) => {
    setUserInteracted(true);
    setActiveIdx(idx);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
  
  if (!perspectives || perspectives.length === 0) return null;
  
  const active = perspectives[activeIdx];
  const cfg = stanceCfg[active?.stance] || stanceCfg.neutral;
  
  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 16, 0);
  const pillsOpacity = remap(p, 0.22, 0.3, 0, 1);
  const cardOpacity = remap(p, 0.26, 0.34, 0, 1);
  const cardScale = remap(p, 0.26, 0.36, 0.94, 1);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead 
          title="Perspectives" 
          subtitle={`${perspectives.length} viewpoints`}
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />
        
        {/* Pills */}
        <div className="persp-pills" style={{ opacity: pillsOpacity }}>
          {perspectives.map((persp, i) => {
            const pCfg = stanceCfg[persp.stance] || stanceCfg.neutral;
            const isActive = i === activeIdx;
            return (
              <button 
                key={i}
                className={`persp-pill ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(i)}
              >
                <span className="persp-pill-dot" style={{ background: isActive ? '#fff' : pCfg.color }} />
                {persp.entity?.split(' ').slice(0, 2).join(' ')}
              </button>
            );
          })}
        </div>
        
        {/* Card */}
        <div 
          className="persp-card"
          style={{ opacity: cardOpacity, transform: `scale(${cardScale})` }}
          key={activeIdx}
        >
          <div className="persp-card-header">
            <span className="persp-entity">{active.entity}</span>
            <span className="persp-stance" style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>
          <p className="persp-quote">"{active.position}"</p>
        </div>
        
        {/* Nav dots */}
        {perspectives.length > 1 && (
          <div className="persp-dots">
            {perspectives.map((_, i) => (
              <button 
                key={i}
                className={`persp-dot ${i === activeIdx ? 'active' : ''}`}
                onClick={() => handleSelect(i)}
              />
            ))}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        .persp-pills {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          margin-bottom: 16px;
          will-change: opacity;
        }
        .persp-pills::-webkit-scrollbar { display: none; }
        .persp-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          border: none;
          border-radius: 12px;
          background: #f3f3f5;
          font-size: 13px;
          font-weight: 600;
          color: #48484a;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .persp-pill.active {
          background: #1d1d1f;
          color: #fff;
        }
        .persp-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .persp-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 20px;
          padding: 20px 22px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06);
          animation: si 0.4s cubic-bezier(0.22,1,0.36,1);
          will-change: opacity, transform;
        }
        .persp-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .persp-entity {
          font-size: 18px;
          font-weight: 700;
          color: #1d1d1f;
        }
        .persp-stance {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 5px 12px;
          border-radius: 20px;
        }
        .persp-quote {
          font-size: 14px;
          font-style: italic;
          color: #48484a;
          line-height: 1.7;
          margin: 0;
        }
        .persp-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 18px;
        }
        .persp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d1d5db;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .persp-dot.active {
          width: 20px;
          border-radius: 3px;
          background: #1d1d1f;
        }
        
        @keyframes si {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// HISTORICAL CONTEXT SECTION
// ============================================

function HistoricalSection({ data, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const [expandedIdx, setExpandedIdx] = useState(-1);
  
  if (!data || !data.comparisons || data.comparisons.length === 0) return null;
  
  const { comparisons, timeline_insight, context_note } = data;
  
  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 16, 0);
  const insightOpacity = remap(p, 0.2, 0.3, 0, 1);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead 
          title="Historical Context" 
          subtitle={`${comparisons.length} precedent${comparisons.length > 1 ? 's' : ''}`}
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />
        
        {timeline_insight && (
          <p className="hist-insight" style={{ opacity: insightOpacity }}>{timeline_insight}</p>
        )}
        
        <div className="hist-panels">
          {comparisons.map((comp, i) => {
            const panelStart = 0.26 + i * 0.055;
            const panelOpacity = remap(p, panelStart, panelStart + 0.08, 0, 1);
            const panelY = remap(p, panelStart, panelStart + 0.08, 20, 0);
            const isOpen = expandedIdx === i;
            
            return (
              <div 
                key={i}
                className={`hist-panel ${isOpen ? 'expanded' : ''}`}
                style={{ opacity: panelOpacity, transform: `translateY(${panelY}px)` }}
              >
                <button className="hist-panel-header" onClick={() => setExpandedIdx(isOpen ? -1 : i)}>
                  <div className="hist-header-content">
                    <span className="hist-event-name">{comp.event_name}</span>
                    <span className="hist-years">{comp.years}</span>
                  </div>
                  <span className={`hist-chevron ${isOpen ? 'open' : ''}`}>▾</span>
                </button>
                
                {isOpen && (
                  <div className="hist-panel-content">
                    <p className="hist-summary">{comp.summary}</p>
                    
                    <div className="hist-grid">
                      <div className="hist-box similar">
                        <span className="hist-box-label">Similarities</span>
                        <ul className="hist-box-list">
                          {comp.similarities?.slice(0, 3).map((s, si) => (
                            <li key={si}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="hist-box different">
                        <span className="hist-box-label">Differences</span>
                        <ul className="hist-box-list">
                          {comp.differences?.slice(0, 3).map((d, di) => (
                            <li key={di}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {context_note && (
          <p className="hist-context-note">{context_note}</p>
        )}
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        .hist-insight {
          font-size: 15px;
          color: #48484a;
          line-height: 1.65;
          margin: 0 0 20px 0;
          will-change: opacity;
        }
        .hist-panels {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .hist-panel {
          background: #f9f9fb;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
          will-change: opacity, transform, background, box-shadow;
        }
        .hist-panel.expanded {
          background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .hist-panel-header {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .hist-header-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .hist-event-name {
          font-size: 15px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.4;
        }
        .hist-years {
          display: inline-block;
          width: fit-content;
          font-size: 11px;
          color: #6b7280;
          background: rgba(0,0,0,0.04);
          padding: 4px 10px;
          border-radius: 6px;
        }
        .hist-chevron {
          font-size: 14px;
          color: #9ca3af;
          transition: transform 0.25s ease;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .hist-chevron.open {
          transform: rotate(180deg);
          color: #1d1d1f;
        }
        .hist-panel-content {
          padding: 0 20px 20px;
          animation: ru 0.25s ease;
        }
        .hist-summary {
          font-size: 14px;
          color: #48484a;
          line-height: 1.6;
          margin: 0 0 16px 0;
        }
        .hist-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .hist-box {
          padding: 14px 16px;
          border-radius: 12px;
        }
        .hist-box.similar {
          background: rgba(16, 185, 129, 0.06);
        }
        .hist-box.different {
          background: rgba(239, 68, 68, 0.06);
        }
        .hist-box-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .hist-box.similar .hist-box-label {
          color: #059669;
        }
        .hist-box.different .hist-box-label {
          color: #dc2626;
        }
        .hist-box-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .hist-box-list li {
          font-size: 12px;
          color: #48484a;
          line-height: 1.5;
          padding-left: 12px;
          position: relative;
          margin-bottom: 6px;
        }
        .hist-box-list li:last-child {
          margin-bottom: 0;
        }
        .hist-box-list li::before {
          content: '·';
          position: absolute;
          left: 0;
          color: #9ca3af;
          font-weight: 700;
        }
        .hist-context-note {
          font-size: 11px;
          font-style: italic;
          color: #9ca3af;
          line-height: 1.5;
          margin: 16px 0 0 0;
        }
        
        @keyframes ru {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
          .hist-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// MAP SECTION (Geographic Impact)
// ============================================

function MapSection({ data, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);

  if (!data || !data.countries || data.countries.length === 0) return null;

  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 16, 0);
  const mapOpacity = remap(p, 0.2, 0.35, 0, 1);
  const mapY = remap(p, 0.2, 0.35, 20, 0);

  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead
          title="Affected Countries"
          subtitle={`${data.total_countries_affected || data.countries.length} countries`}
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />

        <div style={{ opacity: mapOpacity, transform: `translateY(${mapY}px)`, willChange: 'opacity, transform' }}>
          <GeographicImpactSection data={data} accentColor={accentColor} />
        </div>
      </div>

      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }

        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// BACKGROUND SECTION
// ============================================

function BackgroundSection({ text, accentColor }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  
  // Background is mandatory - show placeholder if missing
  if (!text) {
    return (
      <section ref={ref} className="full-section">
        <div style={{ padding: '36px 28px', maxWidth: '680px', margin: '0 auto' }}>
          <SectionHead title="Background" subtitle="Context" accentColor={accentColor} />
          <p style={{ fontSize: '15px', color: '#86868b', lineHeight: 1.7, marginTop: '12px' }}>
            Background information will be updated as more details emerge.
          </p>
        </div>
      </section>
    );
  }
  
  const headerOpacity = remap(p, 0.14, 0.24, 0, 1);
  const headerY = remap(p, 0.14, 0.26, 16, 0);
  const textOpacity = remap(p, 0.22, 0.38, 0, 1);
  const textBlur = remap(p, 0.22, 0.36, 4, 0);
  
  return (
    <section ref={ref} className="full-section">
      <div className="section-inner">
        <SectionHead 
          title="Background"
          accentColor={accentColor}
          style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)` }}
        />
        
        <p 
          className="bg-text"
          style={{ 
            opacity: textOpacity, 
            filter: `blur(${textBlur}px)`,
            willChange: 'opacity, filter'
          }}
        >
          {renderHighlightedText(text, accentColor)}
        </p>
      </div>
      
      <style jsx>{`
        .full-section {
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .section-inner {
          padding: 36px 28px;
          max-width: 680px;
          margin: 0 auto;
        }
        .bg-text {
          font-size: clamp(16px, 3.2vw, 20px);
          color: #48484a;
          line-height: 1.8;
          max-width: 560px;
          margin: 0;
        }
        
        @media (max-width: 480px) {
          .section-inner {
            padding: 28px 20px;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer() {
  return (
    <footer className="page-footer">
      <span className="footer-brand">Today+</span>
      
      <style jsx>{`
        .page-footer {
          padding: 48px 28px 36px;
          border-top: 1px solid rgba(0,0,0,0.05);
          text-align: center;
        }
        .footer-brand {
          font-size: 18px;
          font-weight: 800;
          color: #d1d5db;
        }
      `}</style>
    </footer>
  );
}

// ============================================
// MAIN EVENT PAGE COMPONENT
// ============================================

export default function EventPage() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [blurColor, setBlurColor] = useState(null);
  const [loading, setLoading] = useState(true);
  const colorExtractedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch event from API
  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/world-events/${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.event) {
            const apiEvent = data.event;
            let latestDev = apiEvent.latestDevelopment;
            const components = latestDev?.components || {};
            
            setEvent({
              id: apiEvent.slug || apiEvent.id,
              dbId: apiEvent.id,
              name: apiEvent.name,
              status: apiEvent.status === 'ongoing' ? 'Active' : 'Resolved',
              oneLiner: apiEvent.topicPrompt || apiEvent.topic_prompt || '',
              accentColor: apiEvent.blurColor || apiEvent.blur_color || '#0057B7',
              heroImage: apiEvent.imageUrl || apiEvent.image_url || 
                (apiEvent.liveUpdates && apiEvent.liveUpdates.length > 0 ? apiEvent.liveUpdates[0].image : null),
              latestDevelopment: latestDev,
              timeline: apiEvent.timeline?.map(t => ({
                id: t.id,
                date: t.date || t.rawDate,
                headline: t.headline,
                source_article_id: t.source_article_id || t.articleId
              })) || [],
              background: apiEvent.background,
              keyFacts: apiEvent.keyFacts || apiEvent.key_facts || [],
              totalArticles: apiEvent.totalArticles || 0,
              liveUpdates: apiEvent.liveUpdates || [],
              started_at: apiEvent.startedAt || apiEvent.started_at || null,
              ends_at: apiEvent.endsAt || apiEvent.ends_at || null,
              day_counter_type: apiEvent.dayCounterType || apiEvent.day_counter_type || null,
              show_day_counter: apiEvent.showDayCounter || apiEvent.show_day_counter || false,
              dayCounter: apiEvent.dayCounter || null,
              components: apiEvent.components || components || null,
              lastArticleAt: apiEvent.lastArticleAt || null
            });
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

  useEffect(() => {
    if (event && event.dbId) {
      localStorage.setItem(`tennews_event_visit_${event.dbId}`, Date.now().toString());
      // Also mark in the read-events tracker used by homepage filtering
      // This ensures visiting the event page hides it from homepage until a new development
      try {
        const readEvents = JSON.parse(localStorage.getItem('tennews_read_events') || '{}');
        // Use last_article_at (same key the homepage uses for comparison)
        const timestamp = event.lastArticleAt || new Date().toISOString();
        readEvents[event.dbId] = timestamp;
        localStorage.setItem('tennews_read_events', JSON.stringify(readEvents));
        console.log('📖 Event marked as read:', { id: event.dbId, name: event.name, lastArticleAt: timestamp });
        console.log('📖 All read events:', readEvents);
      } catch (e) {
        console.error('📖 Failed to mark event as read:', e);
      }
    }
  }, [event]);

  const handleImageLoad = async (e) => {
    const img = e.target;
    try {
      const color = await extractDominantColorFromImage(img);
      if (color) {
        colorExtractedRef.current = true;
        setBlurColor(color);
        return;
      }
    } catch (err) {}
    
    try {
      const newImg = new Image();
      newImg.onload = async () => {
        try {
          const color = await extractDominantColorFromImage(newImg);
          if (color) {
            colorExtractedRef.current = true;
            setBlurColor(color);
          }
        } catch (e) {}
      };
      newImg.src = img.src;
    } catch (err) {}
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
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
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
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          pointer-events: auto;
        }

        .back-btn:hover { opacity: 0.8; }
        .back-btn:active { transform: scale(0.95); }

        .hero-image-container {
          position: relative;
          width: 100%;
          height: 320px;
          overflow: hidden;
        }

        .hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .hero-liquid-glass {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 35%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          pointer-events: none;
          z-index: 1;
        }

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

        .hero-title-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          z-index: 2;
        }

        .hero-title-overlay > * {
          position: relative;
          z-index: 2;
        }

        .hero-title {
          font-size: clamp(26px, 6vw, 34px);
          font-weight: 800;
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

        .event-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 16px 28px 0 28px;
          padding: 12px 16px;
          border-radius: 14px;
          background: #f9f9fb;
          border: 1px solid rgba(0,0,0,0.04);
        }

        .day-text {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .day-text strong {
          font-weight: 800;
          color: ${event.accentColor || '#007aff'};
        }

        .status-date {
          font-size: 12px;
          color: #86868b;
        }

        @media (max-width: 480px) {
          .hero-image-container { height: 300px; }
          .hero-title { font-size: 26px; }
          .hero-title-overlay { padding: 20px 20px; }
          .event-status-bar { margin: 12px 20px 0 20px; }
        }
      `}</style>

      <div className="page">
        {/* Hero Section */}
        <div className="hero-image-container">
          <button className="back-btn" onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.history.length > 1 && document.referrer) {
              window.history.back();
            } else {
              window.location.href = '/';
            }
          }} onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.history.length > 1 && document.referrer) {
              window.history.back();
            } else {
              window.location.href = '/';
            }
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          {event.heroImage ? (
            <img 
              className="hero-image" 
              src={event.heroImage} 
              alt={event.name}
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
            />
          ) : (
            <div className="hero-image-placeholder" style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              background: event.accentColor 
                ? `linear-gradient(160deg, ${event.accentColor}, ${event.accentColor}99, ${event.accentColor}44, #1d1d1f)`
                : 'linear-gradient(160deg, #667eea, #764ba2, #1d1d1f)'
            }} />
          )}
          <div className="hero-liquid-glass" />
          <div className="hero-title-overlay">
            <h1 className="hero-title">{event.name || 'Event'}</h1>
            {event.oneLiner && (
              <p className="hero-subtitle">{renderHighlightedText(event.oneLiner, 'rgba(255,255,255,0.95)')}</p>
            )}
          </div>
        </div>

        {/* Status Bar */}
        {event.show_day_counter && (
          <div className="event-status-bar">
            {(() => {
              const startDate = event.started_at || (event.dayCounter && event.dayCounter.startDate);
              if (startDate) {
                const start = new Date(startDate);
                const now = new Date();
                const diffTime = Math.abs(now - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return <span className="day-text">Day <strong>{diffDays.toLocaleString()}</strong></span>;
              }
              return <span className="day-text">{event.status === 'Resolved' ? 'Resolved' : 'Ongoing'}</span>;
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

        {/* Scroll-Animated Sections */}
        {/* 1. MANDATORY: Latest Development (with key stats) */}
        <LatestSection latest={event.latestDevelopment} accentColor={event.accentColor} />
        {/* 2. OPTIONAL: What to Watch */}
        <WatchSection items={event.components?.what_to_watch} accentColor={event.accentColor} />
        {/* 3. MANDATORY: Timeline (This Week from live articles + Historical) */}
        <TimelineSection entries={event.timeline} liveUpdates={event.liveUpdates} accentColor={event.accentColor} />
        {/* 4. OPTIONAL: Map (Affected Countries) */}
        <MapSection data={event.components?.geographic_impact} accentColor={event.accentColor} />
        {/* 5. OPTIONAL: Perspectives */}
        <PerspectivesSection perspectives={event.components?.perspectives} accentColor={event.accentColor} />
        {/* 6. OPTIONAL: Historical Context */}
        <HistoricalSection data={event.components?.historical_comparison} accentColor={event.accentColor} />
        {/* 7. MANDATORY: Background (context) */}
        <BackgroundSection text={event.background} accentColor={event.accentColor} />
        <Footer />
      </div>
    </>
  );
}

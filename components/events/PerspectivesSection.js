/**
 * PerspectivesSection
 * 
 * Different stakeholder perspectives on an event.
 * Modern, Revolut-inspired design with smooth interactions.
 */

import React, { useState, useEffect, useRef } from 'react';

// Stance configuration with gradients
const stanceConfig = {
  supportive: { 
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    bg: 'rgba(16, 185, 129, 0.06)',
    color: '#059669',
    label: 'Supports'
  },
  opposed: { 
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    bg: 'rgba(239, 68, 68, 0.06)',
    color: '#dc2626',
    label: 'Opposes'
  },
  concerned: { 
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    bg: 'rgba(245, 158, 11, 0.06)',
    color: '#d97706',
    label: 'Concerned'
  },
  neutral: { 
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    bg: 'rgba(107, 114, 128, 0.06)',
    color: '#4b5563',
    label: 'Neutral'
  },
  defensive: { 
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    bg: 'rgba(59, 130, 246, 0.06)',
    color: '#2563eb',
    label: 'Defending'
  },
  divided: { 
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    bg: 'rgba(139, 92, 246, 0.06)',
    color: '#7c3aed',
    label: 'Divided'
  }
};

export default function PerspectivesSection({ perspectives, accentColor }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const intervalRef = useRef(null);
  
  // Auto-rotate every 3 seconds until user interacts
  useEffect(() => {
    if (!perspectives || perspectives.length <= 1 || userInteracted) {
      return;
    }
    
    intervalRef.current = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % perspectives.length);
    }, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [perspectives, userInteracted]);
  
  // Handle user interaction - stop auto-rotation
  const handleUserSelect = (index) => {
    setUserInteracted(true);
    setActiveIndex(index);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };
  
  if (!perspectives || perspectives.length === 0) return null;
  
  const activePerspective = perspectives[activeIndex];
  const activeConfig = stanceConfig[activePerspective?.stance] || stanceConfig.neutral;
  
  return (
    <>
      <style jsx>{`
        .perspectives-section {
          margin: 20px 0;
          animation: fadeIn 0.4s ease;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
        }

        /* Main card - liquid glass */
        .main-card {
          position: relative;
          padding: 18px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 18px;
          box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        /* Entity selector pills */
        .entity-pills {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 14px;
          margin-bottom: 14px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .entity-pills::-webkit-scrollbar {
          display: none;
        }

        .entity-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          color: #48484a;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          background-color: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.1),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.9), 
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8), 
            inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.6), 
            inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.06), 
            inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.1), 
            inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.1), 
            inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.05), 
            0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.05), 
            0px 3px 8px 0px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
        }

        .entity-pill:hover {
          background-color: rgba(255, 255, 255, 0.18);
          color: #1d1d1f;
        }

        .entity-pill.active {
          background-color: rgba(29, 29, 31, 0.85);
          color: #fff;
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.05),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.15), 
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.1), 
            0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.1), 
            0px 3px 8px 0px rgba(0, 0, 0, 0.08);
        }

        .pill-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Active perspective content */
        .perspective-content {
          animation: slideIn 0.25s ease;
        }

        .content-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .stance-indicator {
          width: 4px;
          height: 32px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .entity-info {
          flex: 1;
          min-width: 0;
        }

        .entity-name {
          font-size: 16px;
          font-weight: 600;
          color: #1d1d1f;
          letter-spacing: -0.2px;
          line-height: 1.3;
        }

        .entity-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }

        .stance-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .quote-block {
          position: relative;
          padding-left: 14px;
        }

        .quote-line {
          position: absolute;
          left: 0;
          top: 2px;
          bottom: 2px;
          width: 2px;
          border-radius: 1px;
          background: #e5e7eb;
        }

        .quote-text {
          font-size: 14px;
          font-weight: 400;
          color: #374151;
          line-height: 1.6;
          margin: 0;
          font-style: italic;
        }

        .quote-text::before {
          content: '"';
        }

        .quote-text::after {
          content: '"';
        }

        .source-footer {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          font-size: 10px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .source-footer svg {
          opacity: 0.5;
          flex-shrink: 0;
        }

        /* Navigation dots */
        .nav-dots {
          display: flex;
          justify-content: center;
          gap: 5px;
          margin-top: 14px;
        }

        .nav-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #d1d5db;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-dot:hover {
          background: #9ca3af;
        }

        .nav-dot.active {
          width: 16px;
          border-radius: 2.5px;
          background: #1d1d1f;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateX(8px); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }
      `}</style>

      <section className="perspectives-section">
        <div className="section-label">Different Perspectives</div>
        
        <div className="main-card" onTouchStart={() => setUserInteracted(true)}>
          {/* Entity selector */}
          <div className="entity-pills">
            {perspectives.map((p, index) => {
              const config = stanceConfig[p.stance] || stanceConfig.neutral;
              const isActive = index === activeIndex;
              
              return (
                <button
                  key={index}
                  className={`entity-pill ${isActive ? 'active' : ''}`}
                  onClick={() => handleUserSelect(index)}
                >
                  <span 
                    className="pill-indicator" 
                    style={{ background: isActive ? '#fff' : config.color }}
                  />
                  {p.entity?.split(' ').slice(0, 2).join(' ')}
                </button>
              );
            })}
          </div>
          
          {/* Active perspective */}
          {activePerspective && (
            <div className="perspective-content" key={activeIndex}>
              <div className="content-top">
                <div 
                  className="stance-indicator" 
                  style={{ background: activeConfig.gradient }}
                />
                <div className="entity-info">
                  <div className="entity-name">{activePerspective.entity}</div>
                  <div className="entity-meta">
                    <span className="stance-label" style={{ color: activeConfig.color }}>
                      {activeConfig.label}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="quote-block">
                <div className="quote-line" />
                <p className="quote-text">{activePerspective.position}</p>
              </div>
              
              {activePerspective.source_context && (
                <div className="source-footer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>{activePerspective.source_context}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Navigation dots */}
          {perspectives.length > 1 && (
            <div className="nav-dots">
              {perspectives.map((_, index) => (
                <button
                  key={index}
                  className={`nav-dot ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => handleUserSelect(index)}
                  aria-label={`View perspective ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

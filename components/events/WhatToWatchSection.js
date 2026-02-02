/**
 * WhatToWatchSection
 * 
 * Professional, elegant design for upcoming events
 * Matches website's liquid glass aesthetic
 */

import React, { useMemo, useState } from 'react';

export default function WhatToWatchSection({ items }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  
  if (!items || items.length === 0) return null;
  
  const sortedItems = useMemo(() => 
    [...items].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [items]
  );

  const handleClick = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <>
      <style jsx>{`
        .watch-section {
          margin: 24px 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .count-badge {
          font-size: 9px;
          color: #fff;
          background: #1d1d1f;
          padding: 2px 6px;
          border-radius: 6px;
          font-weight: 600;
        }

        /* Cards container */
        .cards-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Individual card */
        .watch-card {
          position: relative;
          padding: 14px 16px;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7), 
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.6), 
            0px 1px 3px rgba(0, 0, 0, 0.03);
        }

        .watch-card:hover {
          background-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
          box-shadow: 
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.1),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.8), 
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.7), 
            0px 4px 12px rgba(0, 0, 0, 0.06);
        }

        .watch-card.expanded {
          background-color: rgba(255, 255, 255, 0.14);
        }

        /* Card header row */
        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        /* Date block */
        .date-block {
          flex-shrink: 0;
          min-width: 44px;
          text-align: center;
        }

        .date-month {
          font-size: 9px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          line-height: 1;
        }

        .date-day {
          font-size: 22px;
          font-weight: 700;
          color: #1d1d1f;
          line-height: 1.1;
          margin-top: 2px;
        }

        .date-year {
          font-size: 9px;
          font-weight: 500;
          color: #c4c4c6;
          margin-top: 1px;
        }

        /* Content */
        .card-content {
          flex: 1;
          min-width: 0;
          padding-top: 2px;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.35;
          margin: 0 0 4px 0;
        }

        .card-subtitle {
          font-size: 11px;
          color: #9ca3af;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Chevron indicator */
        .chevron {
          flex-shrink: 0;
          width: 16px;
          height: 16px;
          color: #c4c4c6;
          transition: transform 0.2s ease;
          margin-top: 4px;
        }

        .watch-card.expanded .chevron {
          transform: rotate(180deg);
        }

        /* Expanded content */
        .expanded-content {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.04);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .expanded-description {
          font-size: 13px;
          color: #48484a;
          line-height: 1.55;
          margin: 0;
        }

        .expanded-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }

        .status-tag {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.04);
          color: #86868b;
        }

        .status-tag.unconfirmed {
          background: #fef3c7;
          color: #92400e;
        }

        /* Divider between date and content on mobile */
        @media (max-width: 380px) {
          .card-header {
            flex-direction: column;
            gap: 8px;
          }
          
          .date-block {
            display: flex;
            align-items: baseline;
            gap: 6px;
            text-align: left;
          }
          
          .date-day {
            font-size: 18px;
          }
          
          .date-month {
            font-size: 10px;
          }
        }
      `}</style>

      <section className="watch-section">
        <div className="section-header">
          <span className="section-title">What to Watch</span>
          <span className="count-badge">{sortedItems.length}</span>
        </div>
        
        <div className="cards-container">
          {sortedItems.map((item, index) => {
            const isExpanded = expandedIndex === index;
            const date = new Date(item.date);
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const day = date.getDate();
            const year = date.getFullYear();
            
            return (
              <div 
                key={index} 
                className={`watch-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleClick(index)}
              >
                <div className="card-header">
                  <div className="date-block">
                    <div className="date-month">{month}</div>
                    <div className="date-day">{day}</div>
                    <div className="date-year">{year}</div>
                  </div>
                  
                  <div className="card-content">
                    <h3 className="card-title">{item.title}</h3>
                    {!isExpanded && item.description && (
                      <p className="card-subtitle">{item.description}</p>
                    )}
                  </div>
                  
                  <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                
                {isExpanded && item.description && (
                  <div className="expanded-content">
                    <p className="expanded-description">{item.description}</p>
                    <div className="expanded-footer">
                      {!item.confirmed && (
                        <span className="status-tag unconfirmed">Expected</span>
                      )}
                      {item.confirmed && (
                        <span className="status-tag">Confirmed</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

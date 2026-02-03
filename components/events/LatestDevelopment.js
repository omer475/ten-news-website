/**
 * LatestDevelopment
 * 
 * Displays the most recent development for an event.
 * Highlighted section at the top of the event page.
 */

import React, { useState, useEffect } from 'react';

/**
 * Format relative time (e.g., "2 hours ago")
 */
function getRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LatestDevelopment({ latest, accentColor }) {
  // Use state for time display to avoid hydration mismatch
  const [displayTime, setDisplayTime] = useState('');
  
  useEffect(() => {
    if (latest?.published_at) {
      setDisplayTime(getRelativeTime(latest.published_at));
    } else if (latest?.time) {
      setDisplayTime(latest.time);
    }
  }, [latest]);
  
  if (!latest) {
    return null;
  }
  
  const { title, summary, components } = latest;
  
  // Get details from components (3 details from original article)
  const details = components?.details || components?.info_boxes || [];
  
  return (
    <>
      <style jsx>{`
        .latest-section {
          margin-bottom: 24px;
          animation: fadeIn 0.5s ease both;
        }

        .latest-card {
          position: relative;
          padding: 18px 20px;
          border-radius: 16px;
          border: none;
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
        }

        .latest-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .latest-label {
          display: flex;
          align-items: center;
        }

        .latest-label-text {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #ef4444;
          padding: 4px 10px;
          border-radius: 20px;
        }

        .latest-time {
          font-size: 12px;
          color: #6b7280;
        }

        .latest-title {
          font-size: 18px;
          font-weight: 700;
          color: #1d1d1f;
          margin-bottom: 8px;
          line-height: 1.35;
        }

        .latest-summary {
          font-size: 15px;
          color: #374151;
          line-height: 1.65;
        }

        /* Details grid */
        .details-grid {
          display: flex;
          justify-content: space-between;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .detail-item {
          flex: 1;
          text-align: center;
          padding: 8px 12px;
          position: relative;
        }

        .detail-item:not(:last-child)::after {
          content: '';
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 32px;
          width: 1px;
          background: rgba(0, 0, 0, 0.1);
        }

        .detail-value {
          font-size: 16px;
          font-weight: 700;
          color: #1d1d1f;
          margin-bottom: 2px;
        }

        .detail-label {
          font-size: 9px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          line-height: 1.3;
        }

        @media (max-width: 360px) {
          .details-grid {
            flex-direction: column;
            gap: 8px;
          }
          
          .detail-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;
            padding: 8px 0;
          }
          
          .detail-item:not(:last-child)::after {
            display: none;
          }
          
          .detail-item:not(:last-child) {
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            padding-bottom: 8px;
          }
          
          .detail-value {
            font-size: 14px;
            margin-bottom: 0;
          }
          
          .detail-label {
            font-size: 10px;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }


        @media (max-width: 480px) {
          .latest-title {
            font-size: 16px;
          }
          .latest-summary {
            font-size: 14px;
          }
        }
      `}</style>

      <section className="latest-section">
        <div className="latest-card">
          <div className="latest-header">
            <div className="latest-label">
              <span className="latest-label-text">Latest Development</span>
            </div>
            
            {displayTime && (
              <time className="latest-time">{displayTime}</time>
            )}
          </div>
          
          <h3 className="latest-title">{title}</h3>
          <p className="latest-summary">{summary}</p>
          
          {/* Details from original article */}
          {details && details.length > 0 && (
            <div className="details-grid">
              {details.slice(0, 3).map((detail, idx) => (
                <div key={idx} className="detail-item">
                  <div className="detail-value">{detail.value}</div>
                  <div className="detail-label">{detail.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

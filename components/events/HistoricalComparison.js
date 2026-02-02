/**
 * HistoricalComparison
 * 
 * Shows historical parallels with current event.
 * Collapsible cards - all closed by default.
 * 
 * Design: Minimal, Apple-inspired with liquid glass elements
 */

import React, { useState } from 'react';

export default function HistoricalComparison({ data, accentColor }) {
  const [expandedIndex, setExpandedIndex] = useState(-1); // All closed by default
  
  if (!data || !data.comparisons || data.comparisons.length === 0) return null;
  
  const { headline, comparisons, context_note, timeline_insight } = data;
  
  return (
    <>
      <style jsx>{`
        .historical-section {
          margin: 20px 0;
          animation: fadeIn 0.5s ease both;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-badge {
          font-size: 11px;
          color: #86868b;
          background: #f5f5f7;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 500;
        }

        .insight-box {
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          color: #1d1d1f;
          line-height: 1.5;
        }

        .comparisons-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .comparison-card {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 14px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .comparison-card.expanded {
          border-color: #e0e0e0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }

        .comparison-header {
          width: 100%;
          padding: 14px 16px;
          text-align: left;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: background 0.2s;
        }

        .comparison-header:hover {
          background: #fafafa;
        }

        .comparison-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .comparison-name {
          font-size: 15px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .years-badge {
          font-size: 11px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 3px 8px;
          border-radius: 8px;
          font-weight: 500;
        }

        .expand-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #86868b;
          transition: transform 0.25s ease;
          font-size: 10px;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .comparison-details {
          padding: 0 16px 16px 16px;
          animation: slideDown 0.25s ease;
        }

        .summary-text {
          font-size: 13px;
          color: #48484a;
          line-height: 1.6;
          margin-bottom: 14px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .detail-box {
          padding: 10px 12px;
          border-radius: 10px;
          background: #f9fafb;
        }

        .detail-box.similar {
          background: #f0fdf4;
        }

        .detail-box.different {
          background: #fef2f2;
        }

        .detail-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .detail-label.similar {
          color: #16a34a;
        }

        .detail-label.different {
          color: #dc2626;
        }

        .detail-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .detail-item {
          font-size: 12px;
          color: #374151;
          line-height: 1.5;
          margin-bottom: 4px;
          padding-left: 10px;
          position: relative;
        }

        .detail-item::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #9ca3af;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .resolution-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .info-chip {
          flex: 1;
          padding: 10px 12px;
          border-radius: 10px;
        }

        .info-chip.resolution {
          background: #eff6ff;
        }

        .info-chip.lessons {
          background: #fefce8;
        }

        .chip-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .chip-label.resolution {
          color: #1d4ed8;
        }

        .chip-label.lessons {
          color: #a16207;
        }

        .chip-text {
          font-size: 12px;
          line-height: 1.5;
        }

        .chip-text.resolution {
          color: #1e40af;
        }

        .chip-text.lessons {
          color: #854d0e;
        }

        .context-note {
          margin-top: 10px;
          font-size: 11px;
          color: #9ca3af;
          font-style: italic;
          line-height: 1.5;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
          .details-grid {
            grid-template-columns: 1fr;
          }
          
          .resolution-row {
            flex-direction: column;
          }
        }
      `}</style>

      <section className="historical-section">
        <div className="section-header">
          <span className="section-title">Historical Context</span>
          <span className="section-badge">{comparisons.length} precedent{comparisons.length > 1 ? 's' : ''}</span>
        </div>
        
        {timeline_insight && (
          <div className="insight-box">
            {timeline_insight}
          </div>
        )}
        
        <div className="comparisons-list">
          {comparisons.map((comparison, index) => {
            const isExpanded = expandedIndex === index;
            
            return (
              <div key={index} className={`comparison-card ${isExpanded ? 'expanded' : ''}`}>
                <button
                  onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                  className="comparison-header"
                >
                  <div className="comparison-info">
                    <span className="comparison-name">{comparison.event_name}</span>
                    <span className="years-badge">{comparison.years}</span>
                  </div>
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                </button>
                
                {isExpanded && (
                  <div className="comparison-details">
                    <p className="summary-text">{comparison.summary}</p>
                    
                    <div className="details-grid">
                      <div className="detail-box similar">
                        <div className="detail-label similar">Similarities</div>
                        <ul className="detail-list">
                          {comparison.similarities?.slice(0, 3).map((item, i) => (
                            <li key={i} className="detail-item">{item}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="detail-box different">
                        <div className="detail-label different">Differences</div>
                        <ul className="detail-list">
                          {comparison.differences?.slice(0, 3).map((item, i) => (
                            <li key={i} className="detail-item">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="resolution-row">
                      {comparison.resolution && (
                        <div className="info-chip resolution">
                          <div className="chip-label resolution">How it ended</div>
                          <p className="chip-text resolution">{comparison.resolution}</p>
                        </div>
                      )}
                      
                      {comparison.key_lessons && (
                        <div className="info-chip lessons">
                          <div className="chip-label lessons">Key lesson</div>
                          <p className="chip-text lessons">{comparison.key_lessons}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {context_note && (
          <p className="context-note">{context_note}</p>
        )}
      </section>
    </>
  );
}

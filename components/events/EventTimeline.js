/**
 * EventTimeline
 * 
 * Minimal vertical timeline design with separate sections
 */

import React, { useMemo, useState } from 'react';

export default function EventTimeline({ entries, accentColor }) {
  const [showHistorical, setShowHistorical] = useState(false);
  
  if (!entries || entries.length === 0) return null;

  // Check if entry is recent (within last week)
  const isRecent = (dateString) => {
    const date = new Date(dateString);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  };
  
  // Split into recent and historical
  const { recentEntries, historicalEntries } = useMemo(() => {
    const recent = [];
    const historical = [];
    
    entries.forEach(entry => {
      if (isRecent(entry.date)) {
        recent.push(entry);
      } else {
        historical.push(entry);
      }
    });
    
    // Sort both arrays (oldest first)
    recent.sort((a, b) => new Date(a.date) - new Date(b.date));
    historical.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return { recentEntries: recent, historicalEntries: historical };
  }, [entries]);

  return (
    <>
      <style jsx>{`
        .timeline-section {
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

        .show-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          width: auto;
          margin: 0 auto 16px;
          font-size: 10px;
          font-weight: 500;
          color: #9ca3af;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 12px;
          transition: color 0.15s;
        }

        .show-more-btn:hover {
          color: #6b7280;
        }

        .show-more-btn svg {
          opacity: 0.5;
        }

        .subsection-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          text-align: center;
          padding: 8px 0;
        }

        .subsection-label.history {
          color: #9ca3af;
          margin-top: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .hide-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: rgba(0, 0, 0, 0.04);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.15s;
          padding: 0;
        }

        .hide-btn:hover {
          background: rgba(0, 0, 0, 0.08);
          color: #6b7280;
        }

        .subsection-label.week {
          color: #3b82f6;
          margin-top: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          padding-top: 20px;
        }

        .timeline {
          position: relative;
          padding-left: 20px;
        }

        /* Vertical line */
        .timeline::before {
          content: '';
          position: absolute;
          left: 5px;
          top: 8px;
          bottom: 8px;
          width: 1.5px;
          background: linear-gradient(to bottom, #e5e7eb, #d1d5db);
          border-radius: 1px;
        }

        .timeline.recent::before {
          background: linear-gradient(to bottom, #93c5fd, #3b82f6);
        }

        .timeline-entry {
          position: relative;
          padding-bottom: 16px;
        }

        .timeline-entry:last-child {
          padding-bottom: 0;
        }

        /* Dot */
        .entry-dot {
          position: absolute;
          left: -20px;
          top: 5px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #d1d5db;
          z-index: 1;
        }

        .timeline-entry:first-child .entry-dot {
          border-color: #9ca3af;
        }

        .timeline.recent .timeline-entry .entry-dot {
          border-color: #3b82f6;
        }

        .timeline.recent .timeline-entry:last-child .entry-dot {
          border-color: #3b82f6;
          background: #3b82f6;
        }

        .entry-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .entry-date {
          font-size: 10px;
          font-weight: 500;
          color: #9ca3af;
        }

        .timeline.recent .entry-date {
          color: #3b82f6;
        }

        .entry-text {
          font-size: 13px;
          font-weight: 500;
          color: #1d1d1f;
          line-height: 1.4;
        }

        .no-recent {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          padding: 16px;
          background: rgba(0, 0, 0, 0.02);
          border-radius: 10px;
        }
      `}</style>

      <section className="timeline-section">
        <div className="section-header">
          <span className="section-title">Timeline</span>
          <span className="count-badge">{entries.length}</span>
        </div>

        {/* Show Historical Button */}
        {!showHistorical && historicalEntries.length > 0 && (
          <button className="show-more-btn" onClick={() => setShowHistorical(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 8 12 16"/>
              <polyline points="8 12 12 8 16 12"/>
            </svg>
            <span>View Historical Events</span>
          </button>
        )}

        {/* Historical Events Section */}
        {showHistorical && historicalEntries.length > 0 && (
          <>
            <div className="subsection-label history">
              <span>Historical Events</span>
              <button className="hide-btn" onClick={() => setShowHistorical(false)} title="Hide historical events">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
            </div>
            <div className="timeline">
              {historicalEntries.map((entry, index) => {
                const entryDate = new Date(entry.date);
                const dateStr = entryDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });
                
                return (
                  <div key={entry.id || `hist-${index}`} className="timeline-entry">
                    <div className="entry-dot" />
                    <div className="entry-content">
                      <span className="entry-date">{dateStr}</span>
                      <span className="entry-text">{entry.headline}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* This Week Section */}
        {recentEntries.length > 0 ? (
          <>
            <div className={`subsection-label week ${!showHistorical ? 'no-top-margin' : ''}`} style={!showHistorical ? { marginTop: 0, borderTop: 'none', paddingTop: 0 } : {}}>
              This Week
            </div>
            <div className="timeline recent">
              {recentEntries.map((entry, index) => {
                const entryDate = new Date(entry.date);
                const dateStr = entryDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });
                
                return (
                  <div key={entry.id || `recent-${index}`} className="timeline-entry">
                    <div className="entry-dot" />
                    <div className="entry-content">
                      <span className="entry-date">{dateStr}</span>
                      <span className="entry-text">{entry.headline}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="no-recent">No updates this week</div>
        )}
      </section>
    </>
  );
}

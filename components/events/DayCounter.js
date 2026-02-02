/**
 * DayCounter
 * 
 * Displays a dynamic day count for events:
 * - "Day 1,067" for ongoing events (days since started_at)
 * - "Ends in 4 days" for events with end date (days until ends_at)
 * - "Day 3 • Ends in 2 days" for events with both dates
 * 
 * IMPORTANT: This is calculated on the frontend using JavaScript.
 * No API calls or cron jobs needed - updates automatically on page load.
 */

import React, { useMemo } from 'react';

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = date2.getTime() - date1.getTime();
  return Math.floor(diffTime / oneDay);
}

/**
 * Format a number with commas for readability
 */
function formatNumber(num) {
  return num.toLocaleString();
}

export default function DayCounter({ 
  startedAt,
  endsAt,
  counterType,
  showCounter = false,
  accentColor = '#dc2626'
}) {
  // Calculate day counts
  const counterData = useMemo(() => {
    if (!showCounter || !counterType) {
      return null;
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let daysSince = null;
    let daysUntil = null;
    
    if (startedAt && (counterType === 'days_since' || counterType === 'both')) {
      const startDate = new Date(startedAt);
      startDate.setHours(0, 0, 0, 0);
      const days = daysBetween(startDate, now);
      if (days >= 0) {
        daysSince = days;
      }
    }
    
    if (endsAt && (counterType === 'days_until' || counterType === 'both')) {
      const endDate = new Date(endsAt);
      endDate.setHours(0, 0, 0, 0);
      const days = daysBetween(now, endDate);
      if (days >= 0) {
        daysUntil = days;
      }
    }
    
    return { daysSince, daysUntil };
  }, [startedAt, endsAt, counterType, showCounter]);
  
  if (!counterData) {
    return null;
  }
  
  const { daysSince, daysUntil } = counterData;
  
  if (daysSince === null && daysUntil === null) {
    return null;
  }
  
  return (
    <>
      <style jsx>{`
        .day-counter-container {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 14px;
        }

        .day-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 600;
        }

        .day-badge.since {
          background: #fee2e2;
          color: #991b1b;
        }

        .day-badge.until {
          background: #dbeafe;
          color: #1e40af;
        }

        .pulse-dot {
          position: relative;
          width: 8px;
          height: 8px;
        }

        .pulse-dot-inner {
          position: relative;
          display: inline-flex;
          border-radius: 50%;
          width: 8px;
          height: 8px;
          background: #dc2626;
        }

        .pulse-dot-ping {
          position: absolute;
          display: inline-flex;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #f87171;
          opacity: 0.75;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .static-dot {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
        }

        .separator {
          color: #d1d5db;
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @media (max-width: 480px) {
          .separator {
            display: none;
          }
        }
      `}</style>

      <div className="day-counter-container">
        {daysSince !== null && (
          <span className="day-badge since">
            <span className="pulse-dot">
              <span className="pulse-dot-ping"></span>
              <span className="pulse-dot-inner"></span>
            </span>
            Day {formatNumber(daysSince + 1)}
          </span>
        )}
        
        {daysSince !== null && daysUntil !== null && (
          <span className="separator">•</span>
        )}
        
        {daysUntil !== null && (
          <span className="day-badge until">
            <span className="static-dot"></span>
            {daysUntil === 0 ? 'Ends today' : daysUntil === 1 ? 'Ends tomorrow' : `Ends in ${formatNumber(daysUntil)} days`}
          </span>
        )}
      </div>
    </>
  );
}

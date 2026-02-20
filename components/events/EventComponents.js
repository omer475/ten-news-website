/**
 * EventComponents
 * 
 * Main wrapper component that renders all event sections in the correct order.
 * Conditionally renders components based on available data.
 */

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to reduce initial bundle size
const LatestDevelopment = dynamic(() => import('./LatestDevelopment'), { ssr: true });
const EventTimeline = dynamic(() => import('./EventTimeline'), { ssr: true });
const WhatToWatchSection = dynamic(() => import('./WhatToWatchSection'), { ssr: true });
const DataAnalyticsSection = dynamic(() => import('./DataAnalyticsSection'), { ssr: false });

export default function EventComponents({ event }) {
  if (!event) return null;
  
  const {
    components,
    dataAnalytics,
    dataSources,
    timeline,
    latestDevelopment,
    accentColor
  } = event;

  // Get metadata flags (with fallbacks for missing metadata)
  const metadata = components?.components_metadata || {};

  // Check what data is actually available
  const hasTimeline = timeline && timeline.length > 0;
  const hasLatest = latestDevelopment && (latestDevelopment.title || latestDevelopment.summary);

  // Smart event components from world_events.components
  // Prefer dedicated dataAnalytics column, fall back to components.data_analytics
  const hasWhatToWatch = components?.what_to_watch?.length > 0;
  const analyticsData = dataAnalytics || components?.data_analytics;
  const hasDataAnalytics = analyticsData?.charts?.length > 0;

  return (
    <>
      <style jsx>{`
        .event-components {
          margin-top: 8px;
        }

        .components-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(0,0,0,0.06), transparent);
          margin: 24px 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="event-components">
        {/* Latest Development (highlighted box with details inside) */}
        {hasLatest && (
          <LatestDevelopment
            latest={latestDevelopment}
            accentColor={accentColor}
          />
        )}

        {/* What to Watch - Upcoming Dates */}
        {hasWhatToWatch && (
          <>
            <WhatToWatchSection
              items={components.what_to_watch}
              accentColor={accentColor}
            />
            <div className="components-divider" />
          </>
        )}

        {/* Timeline - Chronological Facts (simplified) */}
        {hasTimeline && (
          <>
            <EventTimeline
              entries={timeline}
              accentColor={accentColor}
            />
            {hasDataAnalytics && (
              <div className="components-divider" />
            )}
          </>
        )}

        {/* Data Analytics Charts */}
        {hasDataAnalytics && (
          <DataAnalyticsSection
            data={analyticsData}
            dataSources={dataSources || []}
          />
        )}
      </div>
    </>
  );
}

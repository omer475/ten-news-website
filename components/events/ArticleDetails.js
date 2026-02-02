/**
 * ArticleDetails
 * 
 * Displays the components (graph, details/info boxes) from the latest article
 * linked to the event. Uses liquid glass design and swipeable tabs.
 * Data comes directly from Supabase (not AI-generated).
 */

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import GraphChart to avoid SSR issues
const GraphChart = dynamic(() => import('../GraphChart'), {
  ssr: false,
  loading: () => <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>Loading chart...</div>
});

export default function ArticleDetails({ articleComponents, accentColor }) {
  const [activeTab, setActiveTab] = useState(null);
  
  if (!articleComponents) {
    return null;
  }
  
  const { graph, details, infoBoxes } = articleComponents;
  
  // Determine available tabs
  const availableTabs = useMemo(() => {
    const tabs = [];
    if (details && Array.isArray(details) && details.length > 0) {
      tabs.push({ id: 'details', label: 'Key Facts', icon: 'info' });
    }
    if (graph && graph.data && graph.data.length > 0) {
      tabs.push({ id: 'graph', label: 'Data', icon: 'chart' });
    }
    return tabs;
  }, [details, graph]);
  
  // Set initial active tab if not set
  if (activeTab === null && availableTabs.length > 0) {
    setActiveTab(availableTabs[0].id);
  }
  
  // Don't render if no tabs available
  if (availableTabs.length === 0) {
    return null;
  }
  
  const renderIcon = (iconType) => {
    switch (iconType) {
      case 'info':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        );
      case 'chart':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        );
      default:
        return null;
    }
  };
  
  return (
    <>
      <style jsx>{`
        .article-details-section {
          margin: 24px 0;
          animation: fadeIn 0.5s ease both;
        }

        .details-glass {
          position: relative;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          overflow: hidden;
        }

        .tabs-header {
          display: flex;
          gap: 0;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.3);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          background: transparent;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: rgba(0, 0, 0, 0.04);
          color: #374151;
        }

        .tab-btn.active {
          background: rgba(0, 0, 0, 0.06);
          color: #1d1d1f;
          font-weight: 600;
        }

        .tab-btn svg {
          opacity: 0.7;
        }

        .tab-btn.active svg {
          opacity: 1;
        }

        .tab-content {
          padding: 20px;
        }

        /* Details/Info Box Grid */
        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .detail-label {
          font-size: 10px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .detail-value {
          font-size: 18px;
          font-weight: 700;
          color: #1d1d1f;
          line-height: 1.2;
        }

        .detail-subtitle {
          font-size: 11px;
          color: #86868b;
          margin-top: 2px;
        }

        /* Graph Container */
        .graph-wrapper {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .graph-title {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
          margin-bottom: 12px;
          text-align: center;
        }

        .source-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          font-size: 12px;
          color: #007aff;
          text-decoration: none;
          transition: color 0.2s;
        }

        .source-link:hover {
          color: #0056b3;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
          .details-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .detail-value {
            font-size: 16px;
          }
          
          .tabs-header {
            padding: 10px 12px;
          }
          
          .tab-btn {
            padding: 6px 12px;
            font-size: 12px;
          }
        }
      `}</style>

      <section className="article-details-section">
        <div className="details-glass">
          {/* Tab Header */}
          {availableTabs.length > 1 && (
            <div className="tabs-header">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {renderIcon(tab.icon)}
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Tab Content */}
          <div className="tab-content">
            {/* Details Tab */}
            {activeTab === 'details' && details && (
              <div className="details-grid">
                {details.slice(0, 6).map((detail, idx) => {
                  // Handle both string and object formats
                  let label = '';
                  let value = '';
                  let subtitle = '';
                  
                  if (typeof detail === 'object' && detail !== null) {
                    label = detail.label || detail.name || '';
                    value = detail.value || detail.description || '';
                  } else if (typeof detail === 'string') {
                    const parts = detail.split(':');
                    label = parts[0]?.trim() || '';
                    value = parts[1]?.trim() || '';
                  }
                  
                  // Extract number and subtitle
                  const valueMatch = value.match(/^([^a-z]*[0-9][^a-z]*)\s*(.*)$/i);
                  if (valueMatch) {
                    value = valueMatch[1].trim();
                    subtitle = valueMatch[2].trim();
                  }
                  
                  return (
                    <div key={idx} className="detail-item">
                      <span className="detail-label">{label}</span>
                      <span className="detail-value" style={{ color: accentColor || '#1d1d1f' }}>
                        {value}
                      </span>
                      {subtitle && <span className="detail-subtitle">{subtitle}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Graph Tab */}
            {activeTab === 'graph' && graph && (
              <div className="graph-wrapper">
                {graph.title && <div className="graph-title">{graph.title}</div>}
                <GraphChart 
                  graph={graph} 
                  expanded={true} 
                  accentColor={accentColor}
                />
              </div>
            )}
          </div>
          
          {/* Link to full article */}
          {articleComponents.articleId && (
            <a 
              href={`/news?id=${articleComponents.articleId}`}
              className="source-link"
            >
              View source article
              <span>→</span>
            </a>
          )}
        </div>
      </section>
    </>
  );
}

// Archive page for resolved/past world events
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function EventsArchive() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchivedEvents = async () => {
      try {
        const response = await fetch('/api/world-events/archive');
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error('Failed to fetch archived events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedEvents();
  }, []);

  const handleBack = () => {
    router.push('/');
  };

  const handleEventClick = (slug) => {
    router.push(`/event/${slug}`);
  };

  return (
    <>
      <Head>
        <title>Past Events | Today+</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      
      <div className="archive-page">
        <header className="header">
          <button className="back-btn" onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>Past Events</h1>
        </header>

        <main className="content">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading archived events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="empty">
              <p>No archived events yet</p>
              <span>Resolved world events will appear here</span>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="event-card"
                  onClick={() => handleEventClick(event.slug)}
                >
                  <div className="event-image-container">
                    <img 
                      src={event.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80'} 
                      alt={event.name}
                      className="event-image"
                    />
                    <div 
                      className="event-overlay"
                      style={{ background: `linear-gradient(to top, ${event.blur_color || '#1a365d'}ee, transparent)` }}
                    />
                  </div>
                  <div className="event-info">
                    <h3>{event.name}</h3>
                    <div className="event-meta">
                      <span className="resolved-badge">Resolved</span>
                      <span className="date">
                        {event.resolved_at ? new Date(event.resolved_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }) : ''}
                      </span>
                    </div>
                    <p className="event-summary">{event.topic_prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .archive-page {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .header h1 {
          font-size: 20px;
          font-weight: 600;
          color: #1d1d1f;
          margin: 0;
        }

        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.04);
          border: none;
          cursor: pointer;
          color: #1d1d1f;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: rgba(0, 0, 0, 0.08);
        }

        .content {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .loading, .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          color: #86868b;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-top-color: #007AFF;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty p {
          font-size: 18px;
          font-weight: 500;
          color: #1d1d1f;
          margin: 0 0 8px;
        }

        .empty span {
          font-size: 14px;
        }

        .events-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .event-card {
          display: flex;
          gap: 16px;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .event-image-container {
          position: relative;
          width: 140px;
          min-width: 140px;
          height: 120px;
        }

        .event-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .event-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50%;
        }

        .event-info {
          flex: 1;
          padding: 16px 16px 16px 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .event-info h3 {
          font-size: 17px;
          font-weight: 600;
          color: #1d1d1f;
          margin: 0 0 8px;
          line-height: 1.3;
        }

        .event-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .resolved-badge {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #34c759;
          background: rgba(52, 199, 89, 0.12);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .date {
          font-size: 13px;
          color: #86868b;
        }

        .event-summary {
          font-size: 14px;
          color: #6e6e73;
          margin: 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (max-width: 480px) {
          .event-image-container {
            width: 100px;
            min-width: 100px;
            height: 100px;
          }

          .event-info h3 {
            font-size: 15px;
          }
        }
      `}</style>
    </>
  );
}

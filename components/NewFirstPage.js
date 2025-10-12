import { useState, useEffect } from 'react';

export default function NewFirstPage({ onContinue }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Categories data
  const categories = ['All', 'News', 'Exclusives', 'Guides', 'Recommended'];

  // History events data
  const historyEvents = [
    {
      year: '1492',
      event: 'Christopher Columbus discovers America'
    },
    {
      year: '1968',
      event: 'Apollo 7 launched, first crewed Apollo mission'
    },
    {
      year: '2001',
      event: 'iPod was first introduced by Apple Inc.'
    }
  ];

  // Trending topics data
  const trendingTopics = [
    { title: 'Climate Summit', count: '234 articles' },
    { title: 'Tech Innovation', count: '189 articles' },
    { title: 'Space Exploration', count: '156 articles' },
    { title: 'Global Economy', count: '142 articles' }
  ];

  // Auto-scroll history carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHistoryIndex((prev) => (prev + 1) % historyEvents.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [historyEvents.length]);

  return (
    <>
      <style jsx>{`
        .first-page-container {
          width: 100%;
          background: #ffffff;
          min-height: 100vh;
          padding-top: 60px;
          padding-bottom: 40px;
        }

        /* Categories */
        .categories {
          padding: 12px 0 8px;
          background: white;
          border-bottom: 1px solid #f3f4f6;
        }

        .categories-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 0 12px;
        }

        .categories-scroll::-webkit-scrollbar {
          display: none;
        }

        .category-btn {
          flex-shrink: 0;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #4b5563;
        }

        .category-btn:hover {
          background: #f3f4f6;
        }

        .category-btn.active {
          background: #fee2e2;
          color: #dc2626;
        }

        /* Hero Section */
        .hero {
          padding: 12px 0 8px;
        }

        .hero-card {
          position: relative;
          border-radius: 0;
          overflow: hidden;
          height: 176px;
          cursor: pointer;
          margin: 0 12px;
          border-radius: 12px;
        }

        .hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom right, #4f46e5, #7c3aed, #ec4899);
        }

        .hero-blur {
          position: absolute;
          inset: 0;
          opacity: 0.1;
        }

        .blur-circle-1 {
          position: absolute;
          top: 40px;
          right: 40px;
          width: 128px;
          height: 128px;
          background: white;
          border-radius: 50%;
          filter: blur(60px);
        }

        .blur-circle-2 {
          position: absolute;
          bottom: 40px;
          left: 40px;
          width: 96px;
          height: 96px;
          background: #c084fc;
          border-radius: 50%;
          filter: blur(40px);
        }

        .hero-content {
          position: relative;
          height: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 16px;
        }

        .hero-btn {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: white;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .hero-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Sections */
        .section {
          padding: 8px 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 0 12px;
        }

        .section-title {
          font-weight: bold;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #111827;
        }

        .icon {
          width: 16px;
          height: 16px;
          color: #4f46e5;
        }

        .dots {
          display: flex;
          gap: 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d1d5db;
          transition: all 0.3s;
        }

        .dot.active {
          background: #4f46e5;
          width: 16px;
          border-radius: 3px;
        }

        /* History Carousel */
        .history-carousel {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-behavior: smooth;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 0 12px 8px 12px;
        }

        .history-carousel::-webkit-scrollbar {
          display: none;
        }

        .history-card {
          flex-shrink: 0;
          width: 256px;
          background: white;
          border-radius: 8px;
          border: 1px solid #f3f4f6;
          overflow: hidden;
          scroll-snap-align: center;
        }

        .history-image {
          height: 128px;
          background: linear-gradient(to bottom right, #818cf8, #a78bfa);
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .history-year {
          color: white;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 6px;
        }

        .history-event {
          color: white;
          font-size: 14px;
          line-height: 1.3;
          font-weight: 500;
        }

        /* Trending Topics */
        .trending-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          padding: 0 12px;
        }

        .trending-card {
          background: white;
          border-radius: 8px;
          padding: 10px;
          border: 1px solid #f3f4f6;
        }

        .trending-title {
          font-weight: 600;
          font-size: 12px;
          color: #111827;
          margin-bottom: 2px;
        }

        .trending-count {
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>

      <div className="first-page-container">
        {/* Categories */}
        <div className="categories">
          <div className="categories-scroll">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-btn ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Section */}
        <div className="hero">
          <div className="hero-card" onClick={onContinue}>
            <div className="hero-gradient">
              <div className="hero-blur">
                <div className="blur-circle-1"></div>
                <div className="blur-circle-2"></div>
              </div>
            </div>
            <div className="hero-content">
              <button className="hero-btn">
                Read 10 News for Today
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Today in History */}
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
              Today in History
            </h3>
            <div className="dots">
              {historyEvents.map((_, index) => (
                <div
                  key={index}
                  className={`dot ${index === currentHistoryIndex ? 'active' : ''}`}
                ></div>
              ))}
            </div>
          </div>
          
          <div className="history-carousel">
            {historyEvents.map((event, index) => (
              <div key={index} className="history-card">
                <div className="history-image">
                  <span className="history-year">{event.year}</span>
                  <p className="history-event">{event.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Topics */}
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
              Trending Topics
            </h3>
          </div>
          
          <div className="trending-grid">
            {trendingTopics.map((topic, index) => (
              <div key={index} className="trending-card">
                <h4 className="trending-title">{topic.title}</h4>
                <p className="trending-count">{topic.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

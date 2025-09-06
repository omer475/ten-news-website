import { useEffect, useState } from 'react';

export default function Home() {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadNewsData = async () => {
      try {
        let newsData = null;
        
        // Try to fetch from API endpoint
        try {
          const response = await fetch('/api/news');
          if (response.ok) {
            newsData = await response.json();
            console.log('✅ Loaded news from API');
          }
        } catch (error) {
          console.log('📰 API not available, using fallback');
        }
        
        let processedStories = [];
        
        if (newsData && newsData.articles && newsData.articles.length > 0) {
          // Create opening story from news data
          const openingStory = {
            type: 'opening',
            date: newsData.displayDate || new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            }).toUpperCase(),
            headline: newsData.dailyGreeting || 'Today Essential Global News',
            subheadline: `${newsData.readingTime || '5 minute read'} • ${newsData.articles.length} stories curated by AI`
          };
          
          processedStories.push(openingStory);
          
          // Convert news generator articles to website format
          newsData.articles.forEach((article, index) => {
            processedStories.push({
              type: 'news',
              number: article.rank || (index + 1),
              category: (article.category || 'WORLD NEWS').toUpperCase(),
              emoji: article.emoji || '📰',
              title: article.title || 'News Story',
              summary: article.summary || 'News summary will appear here.',
              details: article.details || [],
              source: article.source || 'Ten News',
              url: article.url || '#'
            });
          });
        } else {
          // Fallback: Create sample stories showing system status
          processedStories = [
            {
              type: 'opening',
              date: new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              }).toUpperCase(),
              headline: 'Ten News Automation Active',
              subheadline: 'Fresh AI-curated content will appear daily at 7 AM UK time'
            },
            {
              type: 'news',
              number: 1,
              category: 'SYSTEM STATUS',
              emoji: '🤖',
              title: 'GitHub Actions Automation Running',
              summary: 'Your Ten News system is active and will generate fresh content daily using GDELT global news database and Claude AI curation.',
              details: ['Daily 7 AM UK schedule', 'GDELT API integration', 'Claude AI processing'],
              source: 'Ten News System',
              url: '#'
            }
          ];
        }
        
        // Add newsletter signup at the end
        processedStories.push({
          type: 'newsletter',
          content: 'Professional Newsletter Signup'
        });
        
        setStories(processedStories);
        setLoading(false);
      } catch (error) {
        console.error('Error loading news:', error);
        setLoading(false);
      }
    };

    loadNewsData();
  }, []);

  const goToStory = (index) => {
    if (index >= 0 && index < stories.length) {
      setCurrentIndex(index);
      setMenuOpen(false);
    }
  };

  const nextStory = () => goToStory(currentIndex + 1);
  const prevStory = () => goToStory(currentIndex - 1);

  useEffect(() => {
    let startY = 0;
    let isTransitioning = false;

    const handleTouchStart = (e) => {
      if (!isTransitioning) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e) => {
      if (isTransitioning) return;
      
      const endY = e.changedTouches[0].clientY;
      const diff = startY - endY;
      
      if (Math.abs(diff) > 30) {
        isTransitioning = true;
        if (diff > 0) {
          nextStory();
        } else {
          prevStory();
        }
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleWheel = (e) => {
      if (isTransitioning) return;
      e.preventDefault();
      
      if (Math.abs(e.deltaY) > 30) {
        isTransitioning = true;
        if (e.deltaY > 0) {
          nextStory();
        } else {
          prevStory();
        }
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleKeyDown = (e) => {
      if (isTransitioning) return;
      
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        isTransitioning = true;
        nextStory();
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        isTransitioning = true;
        prevStory();
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, stories.length]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading latest news...</div>
      </div>
    );
  }

  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          background: #ffffff;
          color: #1d1d1f;
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
          touch-action: none;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #fff;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1d1d1f;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        .loading-text {
          font-size: 16px;
          color: #86868b;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .logo {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .logo-ten {
          background: linear-gradient(135deg, #007AFF, #5856D6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .header-center {
          display: flex;
          gap: 24px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #86868b;
        }

        .header-center span {
          cursor: pointer;
          transition: color 0.2s;
          position: relative;
        }

        .header-center span:hover {
          color: #1d1d1f;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 13px;
          font-weight: 500;
        }

        .time {
          color: #86868b;
        }

        .subscribe-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #007AFF, #5856D6);
          color: white;
          border: none;
          border-radius: 980px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .subscribe-btn:hover {
          transform: scale(1.05);
        }

        .story-container {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 80px 24px 60px;
          background: #fff;
          transition: all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
          overflow-y: auto;
        }

        .story-content {
          max-width: 1000px;
          width: 100%;
          margin: 0 auto;
        }

        .opening-container {
          text-align: center;
          max-width: 900px;
          margin: 0 auto;
        }

        .date-header {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          color: #FF3B30;
          text-transform: uppercase;
          margin-bottom: 32px;
        }

        .main-headline {
          font-size: 48px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -2px;
          margin-bottom: 24px;
        }

        .subheadline {
          font-size: 18px;
          color: #86868b;
          line-height: 1.6;
          margin-bottom: 48px;
        }

        .breaking-badge {
          display: inline-block;
          padding: 6px 12px;
          background: #FF3B30;
          color: white;
          border-radius: 980px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 32px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .news-grid {
          display: grid;
          gap: 24px;
        }

        .news-item {
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 20px;
          padding: 24px 0;
          border-bottom: 1px solid #e5e5e7;
          cursor: pointer;
          transition: all 0.2s;
        }

        .news-item:hover {
          padding-left: 8px;
        }

        .news-item:last-child {
          border-bottom: none;
        }

        .news-number {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #007AFF, #5856D6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .news-content {
          padding-top: 4px;
        }

        .news-category {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #007AFF;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .news-title {
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 12px;
          color: #1d1d1f;
        }

        .news-summary {
          font-size: 15px;
          color: #4a4a4a;
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .news-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #86868b;
        }

        .progress-indicator {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 100;
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 12px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .progress-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d2d2d7;
          cursor: pointer;
          transition: all 0.3s;
        }

        .progress-dot.active {
          width: 24px;
          border-radius: 4px;
          background: #1d1d1f;
        }

        .newsletter-container {
          text-align: center;
          padding: 60px 24px;
          background: #000;
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .newsletter-title {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
        }

        .newsletter-subtitle {
          font-size: 18px;
          color: #86868b;
          margin-bottom: 40px;
        }

        .newsletter-form {
          max-width: 440px;
          margin: 0 auto;
          display: flex;
          gap: 12px;
        }

        .newsletter-input {
          flex: 1;
          padding: 16px 20px;
          font-size: 16px;
          border: none;
          border-radius: 12px;
          background: #1c1c1e;
          color: #fff;
        }

        .newsletter-input::placeholder {
          color: #6e6e73;
        }

        .newsletter-button {
          padding: 16px 32px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .newsletter-button:hover {
          transform: scale(1.05);
        }

        .scroll-hint {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 1px;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-10px); }
        }

        @media (max-width: 768px) {
          .header-center {
            display: none;
          }
          
          .header-right .time {
            display: none;
          }
          
          .news-item {
            grid-template-columns: 40px 1fr;
            gap: 16px;
          }
          
          .news-number {
            font-size: 24px;
          }
          
          .news-title {
            font-size: 20px;
          }
        }
      `}</style>
      
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div className="header">
          <div className="logo">
            <span className="logo-ten">TEN</span> NEWS
          </div>
          
          <div className="header-center">
            <span>WORLD</span>
            <span>BUSINESS</span>
            <span>TECH</span>
            <span>SCIENCE</span>
            <span>SPORTS</span>
          </div>
          
          <div className="header-right">
            <span className="time">{currentTime}</span>
            <button className="subscribe-btn">SUBSCRIBE</button>
          </div>
        </div>

        {/* Stories */}
        {stories.map((story, index) => (
          <div
            key={index}
            className="story-container"
            style={{
              transform: `${
                index === currentIndex 
                  ? 'translateY(0) scale(1)' 
                  : index < currentIndex 
                    ? 'translateY(-100%) scale(0.9)' 
                    : 'translateY(100%) scale(0.95)'
              }`,
              opacity: index === currentIndex ? 1 : 0,
              zIndex: index === currentIndex ? 10 : 1,
              pointerEvents: index === currentIndex ? 'auto' : 'none',
            }}
          >
            <div className="story-content">
              {story.type === 'opening' ? (
                <div className="opening-container">
                  <div className="date-header">{story.date}</div>
                  <div className="breaking-badge">LIVE NEWS</div>
                  <h1 className="main-headline">
                    {story.headline}
                  </h1>
                  <p className="subheadline">
                    {story.subheadline || 'Ten essential stories shaping our world today. AI-curated from global sources — your morning briefing starts here.'}
                  </p>
                  <div className="scroll-hint">Scroll to continue ↓</div>
                </div>
              ) : story.type === 'news' ? (
                <div className="news-grid">
                  {story.number === 1 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '32px 0',
                      borderBottom: '2px solid #1d1d1f',
                      marginBottom: '24px'
                    }}>
                      <h2 style={{ 
                        fontSize: '38px',
                        fontWeight: 800,
                        letterSpacing: '-1px'
                      }}>
                        Today Essential Reading
                      </h2>
                    </div>
                  )}
                  
                  <div className="news-item" onClick={() => story.url && story.url !== '#' && window.open(story.url, '_blank')}>
                    <div className="news-number">{story.number < 10 ? `0${story.number}` : story.number}</div>
                    <div className="news-content">
                      <div className="news-category">{story.category}</div>
                      <h3 className="news-title">{story.emoji} {story.title}</h3>
                      <p className="news-summary">{story.summary}</p>
                      <div className="news-meta">
                        <span className="news-source">{story.source}</span>
                        {story.details && story.details.slice(0, 2).map((detail, i) => (
                          <span key={i}>{detail}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : story.type === 'newsletter' ? (
                <div className="newsletter-container">
                  <h2 className="newsletter-title">Stay Informed</h2>
                  <p className="newsletter-subtitle">
                    Get Ten News delivered to your inbox every morning
                  </p>
                  <div className="newsletter-form">
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      className="newsletter-input"
                    />
                    <button className="newsletter-button">
                      Subscribe
                    </button>
                  </div>
                  <p className="newsletter-info">
                    Join 2.5M+ readers • No spam • Unsubscribe anytime
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {/* Progress Indicator */}
        <div className="progress-indicator">
          {stories.map((_, index) => (
            <div
              key={index}
              className={`progress-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToStory(index)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

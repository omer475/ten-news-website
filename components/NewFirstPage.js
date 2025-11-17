import { useState } from 'react';

export default function NewFirstPage({ onContinue, user, userProfile, stories, readTracker }) {
  // Safety check for stories
  if (!stories || !Array.isArray(stories)) {
    stories = [];
  }

  // Timeline fullscreen state
  const [todayFullscreen, setTodayFullscreen] = useState(false);

  // Calculate important news count
  const getImportantNewsCount = () => {
    // Filter out opening and all-read stories, only get news
    const newsStories = stories.filter(story => story.type === 'news');
    
    // Filter important news (score >= 950)
    let importantNews = newsStories.filter(story => story.final_score >= 950);
    
    // For logged-in users, filter out read articles
    if (user && readTracker) {
      importantNews = importantNews.filter(story => !readTracker.hasBeenRead(story.id));
    }
    
    return importantNews.length;
  };

  const getTotalNewsCount = () => {
    return stories.filter(story => story.type === 'news').length;
  };

  const getFirstName = () => {
    if (!user) return null;
    
    // Try to get name from profile first
    if (userProfile?.full_name) {
      const firstName = userProfile.full_name.split(' ')[0];
      return firstName;
    }
    
    // Fallback to user metadata
    if (user.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0];
      return firstName;
    }
    
    // Fallback to email username
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'there';
  };

  const importantNewsCount = getImportantNewsCount();
  const totalNewsCount = getTotalNewsCount();
  const firstName = getFirstName();

  // Helper function to clean title from markdown
  const cleanTitle = (title) => {
    if (!title) return '';
    // Remove markdown bold markers
    return title.replace(/\*\*/g, '');
  };

  // Helper function to format time since published
  const formatTimeSince = (publishedDate) => {
    const now = new Date();
    const published = new Date(publishedDate);
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else {
      return `${diffDays}d`;
    }
  };

  // Get all news stories with images (randomized)
  const storiesWithImages = stories
    .filter(story => story.type === 'news' && story.urlToImage)
    .sort(() => Math.random() - 0.5);

  // Get For You articles (5 random articles with images)
  const forYouArticles = storiesWithImages.slice(0, 5);

  // Get Today timeline stories (first 20 news articles)
  const todayStories = stories
    .filter(story => story.type === 'news')
    .slice(0, 20);

  // Determine the message to display
  let greetingLine = '';
  let messageLine = '';

  if (user) {
    // Logged in user
    greetingLine = `Hi ${firstName},`;
    
    if (importantNewsCount > 0) {
      messageLine = `There ${importantNewsCount === 1 ? 'is' : 'are'} ${importantNewsCount} important ${importantNewsCount === 1 ? 'news' : 'news'} to know`;
    } else {
      messageLine = `There ${totalNewsCount === 1 ? 'is' : 'are'} ${totalNewsCount} new ${totalNewsCount === 1 ? 'news' : 'news'}`;
    }
  } else {
    // Guest user
    greetingLine = 'Hello,';
    
    if (importantNewsCount > 0) {
      messageLine = `There ${importantNewsCount === 1 ? 'is' : 'are'} ${importantNewsCount} important ${importantNewsCount === 1 ? 'news' : 'news'} you must know`;
    } else {
      messageLine = `There ${totalNewsCount === 1 ? 'is' : 'are'} ${totalNewsCount} new ${totalNewsCount === 1 ? 'news' : 'news'}`;
    }
  }

  return (
    <>
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .container {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          overflow: hidden;
          height: 100vh;
          background: #ffffff;
        }

        /* Section 1: Hello Header */
        .hello-section {
          flex-shrink: 0;
          margin-bottom: 32px;
          padding-top: 20px;
        }

        .hello-text {
          font-size: 40px;
          color: #999;
          margin-bottom: 4px;
          font-weight: 400;
        }

        .important-news {
          font-size: 32px;
          font-weight: 700;
          color: #000;
          line-height: 1.2;
        }

        /* Section 2: For You */
        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #000;
          margin: 16px 0 12px;
          flex-shrink: 0;
        }

        .section-icon {
          width: 18px;
          height: 18px;
          stroke: url(#iconGradient);
          fill: none;
          stroke-width: 2;
        }

        .for-you-container {
          flex-shrink: 0;
          margin-bottom: 16px;
        }

        .for-you-scroll {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 4px;
        }

        .for-you-scroll::-webkit-scrollbar {
          display: none;
        }

        .for-you-card {
          flex: 0 0 85%;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #f0f0f0;
          scroll-snap-align: start;
          cursor: pointer;
        }

        .card-image {
          width: 100%;
          height: 140px;
          object-fit: cover;
        }

        .card-content {
          padding: 12px;
          background: #ffffff;
        }

        .card-category {
          font-size: 10px;
          font-weight: 600;
          color: #667eea;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .card-title {
          font-size: 15px;
          font-weight: 600;
          color: #000;
          line-height: 1.3;
        }

        /* Section 3: Today Timeline */
        .timeline {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0;
          border-left: none;
        }
        
        .timeline::before,
        .timeline::after {
          display: none;
        }

        .timeline-item {
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
          border-left: none;
          cursor: pointer;
        }
        
        .timeline-item::before,
        .timeline-item::after {
          display: none;
        }

        .timeline-item:last-child {
          border-bottom: none;
        }

        .timeline-content {
          flex: 1;
          border-left: none;
        }
        
        .timeline-content::before,
        .timeline-content::after {
          display: none;
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          line-height: 1.3;
          margin-bottom: 4px;
        }

        .timeline-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .timeline-category {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          color: #667eea;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timeline-dot {
          width: 2px;
          height: 2px;
          background: #d0d0d0;
          border-radius: 50%;
        }

        .timeline-time {
          font-size: 10px;
          color: #999;
        }

        /* Hide scrollbar but keep functionality */
        .timeline::-webkit-scrollbar {
          display: none;
        }
        .timeline {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Full Screen Today View */
        .today-fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: white;
          z-index: 200;
          display: none;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        .today-fullscreen.active {
          display: flex;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .fullscreen-header {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }

        .back-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          font-size: 18px;
        }

        .fullscreen-title {
          font-size: 18px;
          font-weight: 700;
          color: #000;
        }

        .fullscreen-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .fullscreen-item {
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
        }

        .fullscreen-item:last-child {
          border-bottom: none;
        }

        .fullscreen-item-title {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          line-height: 1.4;
          margin-bottom: 6px;
        }

        .fullscreen-item-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fullscreen-category {
          font-size: 10px;
          font-weight: 600;
          color: #667eea;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .fullscreen-dot {
          width: 2px;
          height: 2px;
          background: #d0d0d0;
          border-radius: 50%;
        }

        .fullscreen-time {
          font-size: 11px;
          color: #999;
        }

        .today-title-clickable {
          cursor: pointer;
        }
      `}</style>

      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>

      <div className="container">
        {/* Section 1: Hello Header */}
        <div className="hello-section">
          <div className="hello-text">{greetingLine}</div>
          <div className="important-news">{messageLine}</div>
        </div>

        {/* Section 2: For You */}
        <div className="for-you-container">
          <div className="section-title">
            <svg className="section-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <circle cx="12" cy="17" r="0.5" fill="url(#iconGradient)"/>
            </svg>
            For You
          </div>
          <div className="for-you-scroll">
            {forYouArticles.map((article, index) => (
              <div
                key={article.id || index}
                className="for-you-card"
                onClick={() => window.location.href = `/?story=${article.rank}`}
              >
                <img
                  src={article.urlToImage}
                  alt={article.title}
                  className="card-image"
                />
                <div className="card-content">
                  <div className="card-category">{article.category}</div>
                  <div className="card-title">
                    {cleanTitle(article.title).length > 60 ? cleanTitle(article.title).substring(0, 60) + '...' : cleanTitle(article.title)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Today Timeline */}
        <div className="section-title today-title-clickable" onClick={() => setTodayFullscreen(true)}>
          <svg className="section-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Today
        </div>
        <div className="timeline">
          {todayStories.map((story, index) => (
            <div
              key={story.id || index}
              className="timeline-item"
              onClick={() => window.location.href = `/?story=${story.rank}`}
            >
              <div className="timeline-content">
                <div className="timeline-title">{cleanTitle(story.title)}</div>
                <div className="timeline-meta">
                  <span className="timeline-category">{story.category}</span>
                  <span className="timeline-dot"></span>
                  <span className="timeline-time">{formatTimeSince(story.publishedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Screen Today View */}
      <div className={`today-fullscreen ${todayFullscreen ? 'active' : ''}`}>
        <div className="fullscreen-header">
          <button className="back-btn" onClick={() => setTodayFullscreen(false)}>
            ←
          </button>
          <div className="fullscreen-title">Today</div>
          <div style={{ width: '32px' }}></div>
        </div>
        <div className="fullscreen-content">
          {todayStories.map((story, index) => (
            <div
              key={story.id || index}
              className="fullscreen-item"
              onClick={() => window.location.href = `/?story=${story.rank}`}
            >
              <div className="fullscreen-item-title">{cleanTitle(story.title)}</div>
              <div className="fullscreen-item-meta">
                <span className="fullscreen-category">{story.category}</span>
                <span className="fullscreen-dot"></span>
                <span className="fullscreen-time">{formatTimeSince(story.publishedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

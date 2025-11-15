export default function NewFirstPage({ onContinue, user, userProfile, stories, readTracker }) {
  // Today in History events (sample data - in production, fetch based on current date)
  const historyEvents = [
    { year: '1969', event: 'Apollo 12 launched to the Moon' },
    { year: '2001', event: 'iPod was first introduced by Apple Inc.' },
    { year: '1985', event: 'Microsoft Windows 1.0 released' }
  ];

  // Get latest articles (filter out opening/closing stories and limit to 5)
  const getLatestArticles = () => {
    console.log('Stories received:', stories);
    console.log('Stories length:', stories?.length);
    
    if (!stories || stories.length === 0) {
      console.log('No stories available');
      return [];
    }
    
    const newsStories = stories.filter(story => story.type === 'news');
    console.log('Total news stories after filter:', newsStories.length);
    console.log('First 5 stories:', newsStories.slice(0, 5));
    
    return newsStories.slice(0, 5);
  };

  // Calculate time ago from published date
  const getTimeAgo = (publishedAt) => {
    if (!publishedAt) return 'Just now';
    
    const now = new Date();
    const published = new Date(publishedAt);
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const latestArticles = getLatestArticles();

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
        .welcome-container {
          width: 100%;
          height: 100vh;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-y: auto;
          padding: 80px 20px 40px 20px;
        }

        .main-content {
          cursor: pointer;
          width: 100%;
          max-width: 600px;
        }

        .greeting-line {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 48px;
          font-weight: 400;
          color: #808080;
          margin: 0;
          padding: 0;
          line-height: 1.1;
          text-align: left;
          width: 100%;
        }

        .message-line {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 48px;
          font-weight: 400;
          color: #000000;
          margin: 0;
          padding: 0;
          line-height: 1.1;
          text-align: left;
          width: 100%;
        }

        .history-section {
          width: 100%;
          max-width: 600px;
          margin-top: 60px;
          flex-shrink: 0;
        }

        .history-title {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #808080;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 24px 0;
        }

        .history-events {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .history-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .history-year {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #000000;
          min-width: 60px;
          flex-shrink: 0;
        }

        .history-event {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 16px;
          font-weight: 400;
          color: #4a4a4a;
          line-height: 1.5;
          margin: 0;
        }

        .history-divider {
          width: 100%;
          height: 1px;
          background: #e5e5e5;
          margin: 16px 0;
        }

        .timeline-section {
          width: 100%;
          max-width: 600px;
          margin-top: 50px;
          margin-bottom: 40px;
          flex-shrink: 0;
          background: rgba(255, 0, 0, 0.05);
          padding: 20px;
          border-radius: 12px;
        }

        .timeline-title {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #808080;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 24px 0;
        }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 12px;
          border-radius: 12px;
          transition: background-color 0.2s ease;
          cursor: pointer;
        }

        .timeline-item:hover {
          background-color: #f8f8f8;
        }

        .timeline-image {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          background-color: #e5e5e5;
        }

        .timeline-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .timeline-article-title {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #000000;
          line-height: 1.4;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .timeline-time {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #999999;
        }

        @media (max-width: 768px) {
          .greeting-line,
          .message-line {
            font-size: 36px;
          }

          .history-section {
            margin-top: 60px;
          }

          .timeline-section {
            margin-top: 50px;
          }
        }

        @media (max-width: 480px) {
          .greeting-line,
          .message-line {
            font-size: 28px;
          }

          .history-section {
            margin-top: 50px;
          }

          .history-year {
            font-size: 14px;
            min-width: 50px;
          }

          .history-event {
            font-size: 14px;
          }

          .timeline-section {
            margin-top: 40px;
          }

          .timeline-image {
            width: 50px;
            height: 50px;
          }

          .timeline-article-title {
            font-size: 14px;
          }

          .timeline-time {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="welcome-container">
        <div className="main-content" onClick={onContinue}>
          <p className="greeting-line">{greetingLine}</p>
          <p className="message-line">{messageLine}</p>
        </div>

        <div className="history-section">
          <h3 className="history-title">Today in History</h3>
          <div className="history-events">
            {historyEvents.map((item, index) => (
              <div key={index}>
                <div className="history-item">
                  <span className="history-year">{item.year}</span>
                  <p className="history-event">{item.event}</p>
                </div>
                {index < historyEvents.length - 1 && <div className="history-divider" />}
              </div>
            ))}
          </div>
        </div>

        <div className="timeline-section">
          <h3 className="timeline-title">Latest Articles</h3>
          <div className="timeline-items">
            {latestArticles.length > 0 ? (
              latestArticles.map((article) => (
                <div 
                  key={article.id} 
                  className="timeline-item"
                  onClick={onContinue}
                >
                  {article.image_url && (
                    <img 
                      src={article.image_url} 
                      alt={article.title}
                      className="timeline-image"
                    />
                  )}
                  <div className="timeline-content">
                    <h4 className="timeline-article-title">{article.title}</h4>
                    <span className="timeline-time">{getTimeAgo(article.published_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#999', fontSize: '14px' }}>Loading articles...</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

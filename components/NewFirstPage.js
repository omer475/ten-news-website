export default function NewFirstPage({ onContinue, user, userProfile, stories, readTracker }) {
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

  // Get last 5 published news
  const getLatestNews = () => {
    const newsStories = stories.filter(story => story.type === 'news');
    return newsStories.slice(0, 5);
  };

  // Format time ago
  const getTimeAgo = (publishedAt) => {
    if (!publishedAt) return 'Just now';
    
    const now = new Date();
    const published = new Date(publishedAt);
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const importantNewsCount = getImportantNewsCount();
  const totalNewsCount = getTotalNewsCount();
  const firstName = getFirstName();
  const latestNews = getLatestNews();

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
          min-height: 100vh;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 120px 20px 40px 20px;
          cursor: pointer;
        }

        .content-wrapper {
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
          margin-bottom: 48px;
        }

        .timeline-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          background: #f8f8f8;
          transition: all 0.2s ease;
        }

        .timeline-item:hover {
          background: #f0f0f0;
          transform: translateX(4px);
        }

        .timeline-image {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          background: #e0e0e0;
        }

        .timeline-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .timeline-title {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #000000;
          margin: 0;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .timeline-time {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: #808080;
          margin: 0;
        }

        @media (max-width: 768px) {
          .greeting-line,
          .message-line {
            font-size: 36px;
          }

          .timeline-image {
            width: 50px;
            height: 50px;
          }

          .timeline-title {
            font-size: 13px;
          }

          .timeline-time {
            font-size: 11px;
          }
        }

        @media (max-width: 480px) {
          .greeting-line,
          .message-line {
            font-size: 28px;
          }

          .message-line {
            margin-bottom: 32px;
          }

          .timeline-item {
            gap: 10px;
            padding: 10px;
          }

          .timeline-image {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>

      <div className="welcome-container" onClick={onContinue}>
        <div className="content-wrapper">
          <p className="greeting-line">{greetingLine}</p>
          <p className="message-line">{messageLine}</p>

          <div className="timeline-container">
            {latestNews.map((story, index) => (
              <div key={story.id} className="timeline-item">
                <img 
                  src={story.image_url || '/placeholder-image.png'} 
                  alt={story.title}
                  className="timeline-image"
                />
                <div className="timeline-content">
                  <p className="timeline-title">{story.title}</p>
                  <p className="timeline-time">{getTimeAgo(story.published_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function NewFirstPage({ onContinue, user, userProfile, stories, readTracker }) {
  // Today in History events (sample data - in production, fetch based on current date)
  const historyEvents = [
    { year: '1969', event: 'Apollo 12 launched to the Moon' },
    { year: '2001', event: 'iPod was first introduced by Apple Inc.' },
    { year: '1985', event: 'Microsoft Windows 1.0 released' }
  ];

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
          min-height: 100vh;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 120px 20px 40px 20px;
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
          margin-top: 80px;
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

        @media (max-width: 768px) {
          .greeting-line,
          .message-line {
            font-size: 36px;
          }

          .history-section {
            margin-top: 60px;
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
      </div>
    </>
  );
}

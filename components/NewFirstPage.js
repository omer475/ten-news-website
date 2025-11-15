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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 120px 20px 40px 20px;
          cursor: pointer;
          position: relative;
        }

        .blur-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          backdrop-filter: blur(80px);
          -webkit-backdrop-filter: blur(80px);
          background: rgba(255, 255, 255, 0.25);
          z-index: 1;
        }

        .content-wrapper {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 48px 40px;
          border-radius: 24px;
          backdrop-filter: blur(100px);
          -webkit-backdrop-filter: blur(100px);
          background: rgba(255, 255, 255, 0.35);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .greeting-line {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 48px;
          font-weight: 400;
          color: #ffffff;
          margin: 0;
          padding: 0;
          line-height: 1.1;
          text-align: left;
          width: 100%;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .message-line {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          font-size: 48px;
          font-weight: 400;
          color: #ffffff;
          margin: 0;
          padding: 0;
          line-height: 1.1;
          text-align: left;
          width: 100%;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
          .greeting-line,
          .message-line {
            font-size: 36px;
          }
        }

        @media (max-width: 480px) {
          .greeting-line,
          .message-line {
            font-size: 28px;
          }
        }
      `}</style>

      <div className="welcome-container" onClick={onContinue}>
        <div className="blur-overlay"></div>
        <div className="content-wrapper">
          <p className="greeting-line">{greetingLine}</p>
          <p className="message-line">{messageLine}</p>
        </div>
      </div>
    </>
  );
}

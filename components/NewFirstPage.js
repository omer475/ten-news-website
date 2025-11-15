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
          background-color: color-mix(in srgb, #ffffff 12%, transparent);
          backdrop-filter: blur(4px) saturate(150%);
          -webkit-backdrop-filter: blur(4px) saturate(150%);
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, #fff 10%, transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, #fff 90%, transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, #fff 80%, transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, #fff 60%, transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, #000 12%, transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, #000 20%, transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, #000 20%, transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, #000 10%, transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, #000 10%, transparent), 
            0px 3px 8px 0px color-mix(in srgb, #000 8%, transparent);
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

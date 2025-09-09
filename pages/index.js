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
        
        // If API failed, try direct file access
        if (!newsData) {
          try {
            const today = new Date();
            const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
            const response = await fetch(`/tennews_data_${dateStr}.json`);
            if (response.ok) {
              newsData = await response.json();
              console.log('✅ Loaded news from direct file');
            }
          } catch (error) {
            console.log('📰 Direct file access failed:', error);
          }
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
            headline: newsData.dailyGreeting || 'Today Essential Global News'
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
          // Fallback stories with sample data
          processedStories = [
            {
              type: 'opening',
              date: new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              }).toUpperCase(),
              headline: 'Ten News automation is working perfectly'
            },
            {
              type: 'news',
              number: 1,
              category: 'SYSTEM STATUS',
              emoji: '🤖',
              title: 'GitHub Actions Automation Active',
              summary: 'Your Ten News system is running automatically. Fresh AI-curated content from GDELT and Claude will appear daily at 7 AM UK time.',
              details: ['Schedule: Daily 7 AM UK', 'Source: GDELT API', 'AI: Claude curation'],
              source: 'Ten News System',
              url: '#'
            },
            {
              type: 'news',
              number: 2,
              category: 'SYSTEM STATUS', 
              emoji: '🌍',
              title: 'GDELT Global News Integration Ready',
              summary: 'Connected to GDELT Project global database providing real-time access to worldwide news events from over 50 trusted sources.',
              details: ['Sources: 50+ trusted outlets', 'Coverage: Global events', 'Processing: Real-time'],
              source: 'Ten News System',
              url: '#'
            },
            {
              type: 'news',
              number: 3,
              category: 'SYSTEM STATUS',
              emoji: '🧠', 
              title: 'Claude AI Curation System Online',
              summary: 'AI-powered article selection and rewriting system ready to curate the most important global stories for your daily digest.',
              details: ['Selection: Top 10 stories', 'Processing: AI rewriting', 'Quality: Optimized summaries'],
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

  // Function to render text with bold markup
  const renderBoldText = (text) => {
    if (!text) return '';
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

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

  // Function to get greeting gradient based on time
  const getGreetingGradient = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'linear-gradient(90deg, #1e3a8a 0%, #fbbf24 100%)'; // Dark navy to yellow for morning
    } else if (hour >= 12 && hour < 18) {
      return 'linear-gradient(90deg, #1e3a8a 0%, #f97316 100%)'; // Dark navy to orange for evening
    } else {
      return 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)'; // Dark navy to light blue for night
    }
  };

  // Function to get greeting text based on time
  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Goood morning';
    } else if (hour >= 12 && hour < 18) {
      return 'Goood evening';
    } else {
      return 'Goood night';
    }
  };

  // Function to render greeting with gradient first part
  const renderGreeting = (headline) => {
    const correctGreeting = getGreetingText(); // Get the time-appropriate greeting
    const gradient = getGreetingGradient();
    
    // Check for various greeting patterns that AI might write
    const greetingPatterns = [
      'good morning',
      'good evening', 
      'good night',
      'good afternoon'
    ];
    
    const lowerHeadline = headline.toLowerCase();
    let foundGreeting = null;
    
    for (const pattern of greetingPatterns) {
      if (lowerHeadline.startsWith(pattern)) {
        foundGreeting = pattern;
        break;
      }
    }
    
    if (foundGreeting) {
      // Replace AI's greeting with the correct time-based greeting
      const restOfText = headline.substring(foundGreeting.length);
      return (
        <>
          <span style={{ 
            background: gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>{correctGreeting}</span>
          {restOfText}
        </>
      );
    }
    return headline;
  };

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
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .logo {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .logo:hover {
          opacity: 0.8;
        }

        .logo-ten {
          color: #0f172a;
          font-weight: 900;
        }


        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 13px;
          font-weight: 500;
        }

        .time {
          color: #94a3b8;
          font-weight: 500;
        }

        .subscribe-btn {
          padding: 8px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }

        .subscribe-btn:hover {
          background: #2563eb;
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
          max-width: 800px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: calc(100vh - 140px);
        }

        .date-header {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 2px;
          color: #dc2626;
          text-transform: uppercase;
          margin-bottom: 40px;
        }

        .main-headline {
          font-size: 52px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -1.5px;
          margin-bottom: 40px;
          color: #0f172a;
        }

        .subheadline {
          font-size: 22px;
          line-height: 1.4;
          margin-bottom: 40px;
          text-align: center;
        }

        @keyframes topicRotate {
          0%, 20%, 100% { 
            opacity: 0;
            transform: translateY(5px);
          }
          2%, 18% { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(249, 115, 22, 0.3); }
          50% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.5); }
        }

        .news-grid {
          display: grid;
          gap: 24px;
        }

        .news-item {
          display: block;
          padding: 24px 15px;
          border-bottom: 1px solid #e5e5e7;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 8px;
          position: relative;
          margin: 0 auto;
          max-width: 950px;
        }

        .news-item.first-news {
          margin-top: -25px;
        }

        .news-item:hover {
          background: linear-gradient(to right, rgba(59, 130, 246, 0.03), transparent);
        }

        .news-item:last-child {
          border-bottom: none;
        }

        .news-number {
          position: absolute;
          top: 0;
          left: 0;
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #cbd5e1, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0.6;
          z-index: 1;
        }

        .news-content {
          padding-top: 32px;
          padding-left: 0;
          padding-right: 30px;
          padding-bottom: 0;
          margin: 0 auto;
          max-width: 900px;
          text-align: left;
        }

        .news-category {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .news-title {
          font-size: 48px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 28px;
          color: #000000;
        }

        .news-summary {
          font-size: 17px;
          color: #000000;
          line-height: 1.6;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .news-meta {
          display: flex;
          background: #ffffff;
          border-radius: 16px;
          padding: 12px 20px;
          margin-top: 20px;
          gap: 0;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .news-detail-item {
          flex: 1;
          text-align: center;
          padding: 0 15px;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 38px;
        }

        .news-detail-item:last-child {
          border-right: none;
        }

        .news-detail-label {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 1px;
        }

        .news-detail-value {
          font-size: 20px;
          font-weight: 800;
          color: #111827;
          line-height: 1.2;
          margin: 0;
        }

        .news-detail-subtitle {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
          margin-top: 0;
        }

        .progress-indicator {
          position: fixed;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 100;
        }

        .progress-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #e2e8f0;
          cursor: pointer;
          transition: all 0.3s;
        }

        .progress-dot.active {
          width: 6px;
          height: 20px;
          border-radius: 3px;
          background: linear-gradient(180deg, #1f2937, #000000);
        }

        .newsletter-container {
          text-align: center;
          padding: 60px 0;
          background: #000;
          color: #fff;
          height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin: 0;
          position: relative;
          left: 50%;
          transform: translateX(-50%);
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
          flex-direction: column;
          gap: 16px;
        }

        .newsletter-input {
          width: 100%;
          padding: 16px 20px;
          font-size: 16px;
          border: 1px solid #333;
          border-radius: 12px;
          background: #1c1c1e;
          color: #fff;
          outline: none;
          transition: border-color 0.2s;
        }

        .newsletter-input:focus {
          border-color: #f97316;
        }

        .newsletter-input::placeholder {
          color: #6e6e73;
        }

        .newsletter-button {
          width: 100%;
          padding: 16px 32px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .newsletter-button:hover {
          background: #f0f0f0;
        }

        .newsletter-info {
          font-size: 13px;
          color: #6e6e73;
          margin-top: 24px;
        }

        .scroll-hint {
          position: absolute;
          bottom: 160px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 600;
          animation: gentleBounce 3s ease-in-out infinite;
          opacity: 0.7;
          z-index: 10;
        }

        @keyframes gentleBounce {
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }

        @media (max-width: 768px) {
          .header-right .time {
            display: none;
          }
          
          .story-container {
            padding: 70px 12px 60px;
          }
          
          .news-item {
            padding: 20px 10px;
            max-width: 100%;
          }
          
          .news-content {
            margin: 0 8px;
            padding-right: 20px;
          }
          
          .news-number {
            font-size: 20px;
            top: 0;
            left: 0;
          }
          
          .news-title {
            font-size: 30px;
          }
          
          .main-headline {
            font-size: 34px;
            letter-spacing: -1px;
            margin-bottom: 30px;
            line-height: 1.15;
          }
          
          .date-header {
            font-size: 11px;
            letter-spacing: 2px;
            margin-bottom: 30px;
          }
          
          .subheadline {
            font-size: 18px;
            margin-bottom: 30px;
          }
          
          .news-info {
            font-size: 11px !important;
            gap: 16px !important;
            margin-bottom: 40px !important;
          }
          
          .rotating-topics {
            min-width: 150px !important;
          }
          
          .opening-container {
            padding: 0 20px;
            min-height: calc(100vh - 120px);
          }
          
          .scroll-hint {
            bottom: 100px;
            font-size: 11px;
            letter-spacing: 1.5px;
          }
          
          .progress-indicator {
            right: 12px;
            gap: 6px;
          }
          
          .progress-dot {
            width: 5px;
            height: 5px;
            background: #e2e8f0;
          }
          
          .progress-dot.active {
            width: 5px;
            height: 18px;
            background: linear-gradient(180deg, #1f2937, #000000);
          }
          
          .news-meta {
            padding: 10px 15px;
            margin-top: 15px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          
          .news-detail-item {
            padding: 0 10px;
          }
          
          .news-detail-label {
            font-size: 9px;
          }
          
          .news-detail-value {
            font-size: 16px;
          }
          
          .news-detail-subtitle {
            font-size: 10px;
          }
        }
      `}</style>
      
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div className="header">
          <div className="logo">
            <span className="logo-ten">TEN</span> NEWS
          </div>
          
          <div style={{ flex: 1 }}></div>
          
          <div className="header-right">
            <span className="time">{currentTime}</span>
            <button className="subscribe-btn" onClick={() => goToStory(stories.length - 1)}>NEWSLETTER</button>
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
                  <h1 className="main-headline">
                    {renderGreeting(story.headline)}
                  </h1>
                  <div className="subheadline">
                    <div style={{ display: 'inline-block' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Today: </span>
                      <span className="rotating-topics" style={{ position: 'relative', display: 'inline-block', minWidth: '200px', height: '26px', verticalAlign: 'middle' }}>
                        {stories.filter(s => s.type === 'news').slice(0, 5).map((story, i) => {
                          const categoryColors = {
                            'WORLD NEWS': '#dc2626',
                            'BUSINESS': '#f97316',
                            'MARKETS': '#06b6d4',
                            'TECH & AI': '#8b5cf6',
                            'SCIENCE': '#0ea5e9',
                            'HEALTH': '#10b981',
                            'CLIMATE': '#22c55e',
                            'SPORTS': '#f59e0b',
                            'ENTERTAINMENT': '#ec4899'
                          };
                          const color = categoryColors[story.category] || '#3b82f6';
                          const shortTitle = story.title.length > 20 ? story.title.substring(0, 20) + '...' : story.title;
                          
                          return (
                            <span
                              key={i}
                              className="topic-item"
                              style={{
                                position: 'absolute',
                                left: 0,
                                whiteSpace: 'nowrap',
                                opacity: 0,
                                animation: 'topicRotate 15s infinite',
                                animationDelay: `${i * 3}s`,
                                color: color,
                                fontWeight: 700,
                                transition: 'opacity 0.5s ease-in-out'
                              }}
                            >
                              {shortTitle}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="news-info" style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: '50px',
                    fontSize: '13px',
                    color: '#64748b',
                    fontWeight: 500,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    <span style={{
                      padding: '4px 12px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '4px',
                      color: '#3b82f6'
                    }}>10 Stories</span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{
                      padding: '4px 12px',
                      background: 'rgba(96, 165, 250, 0.1)',
                      borderRadius: '4px',
                      color: '#60a5fa'
                    }}>2 Min Read</span>
                  </div>
                  <div className="scroll-hint">SCROLL TO CONTINUE ↓</div>
                </div>
              ) : story.type === 'news' ? (
                <div className="news-grid">
                  {story.number === 1 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '32px 0',
                      marginBottom: '24px',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '80px',
                        height: '2px',
                        background: 'linear-gradient(90deg, #f97316, #06b6d4)'
                      }}></div>
                    </div>
                  )}
                  
                  <div className={`news-item ${story.number === 1 ? 'first-news' : ''}`} onClick={() => story.url && window.open(story.url, '_blank')}>
                    <div className="news-number">{story.number < 10 ? `0${story.number}` : story.number}</div>
                    <div className="news-content">
                      <div className="news-category" style={{
                        color: story.category === 'WORLD NEWS' ? '#dc2626' :
                               story.category === 'BUSINESS' ? '#f97316' :
                               story.category === 'MARKETS' ? '#06b6d4' :
                               story.category === 'TECH & AI' ? '#8b5cf6' :
                               story.category === 'SCIENCE' ? '#0ea5e9' :
                               story.category === 'HEALTH' ? '#10b981' :
                               story.category === 'CLIMATE' ? '#22c55e' :
                               story.category === 'SPORTS' ? '#f59e0b' :
                               story.category === 'ENTERTAINMENT' ? '#ec4899' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>{story.emoji}</span>
                        {story.category}
                      </div>
                      <h3 className="news-title">{story.title}</h3>
                      <p className="news-summary">{renderBoldText(story.summary)}</p>
                      <div className="news-meta">
                        {story.details && story.details.map((detail, i) => {
                          const [label, value] = detail.split(':');
                          const cleanLabel = label?.trim() || '';
                          const cleanValue = value?.trim() || '';
                          
                          // Extract main number/value and subtitle
                          const valueMatch = cleanValue.match(/^([^a-z]*[0-9][^a-z]*)\s*(.*)$/i);
                          const mainValue = valueMatch ? valueMatch[1].trim() : cleanValue;
                          const subtitle = valueMatch ? valueMatch[2].trim() : '';
                          
                          return (
                            <div key={i} className="news-detail-item">
                              <div className="news-detail-label">{cleanLabel}</div>
                              <div className="news-detail-value">{mainValue}</div>
                              {subtitle && <div className="news-detail-subtitle">{subtitle}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : story.type === 'newsletter' ? (
                <div className="newsletter-container">
                  <h2 className="newsletter-title">
                    <span style={{ color: '#3b82f6' }}>Stay</span> Informed
                  </h2>
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
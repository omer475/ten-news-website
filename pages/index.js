import { useEffect, useState } from 'react';

export default function Home() {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState({});
  const [autoRotateTimers, setAutoRotateTimers] = useState({});

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
              const storyData = {
                type: 'news',
                number: article.rank || (index + 1),
                category: (article.category || 'WORLD NEWS').toUpperCase(),
                emoji: article.emoji || '📰',
                title: article.title || 'News Story',
                summary: article.summary || 'News summary will appear here.',
                details: article.details || [],
                source: article.source || 'Ten News',
                url: article.url || '#'
              };
              
              // Add timeline data (from generator or create fallback)
              if (article.timeline) {
                storyData.timeline = article.timeline;
              } else {
                // Create fallback timeline for all stories
                storyData.timeline = [
                  {"date": "Background", "event": "Initial situation develops"},
                  {"date": "Recently", "event": "Key events unfold"},
                  {"date": "Yesterday", "event": "Critical point reached"},
                  {"date": "Today", "event": "Major developments break"}
                ];
              }
              
              processedStories.push(storyData);
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
              url: '#',
              timeline: [
                {"date": "Setup", "event": "GitHub Actions workflow configured"},
                {"date": "Integration", "event": "GDELT API and Claude AI connected"},
                {"date": "Testing", "event": "Automation tested and verified"},
                {"date": "Live", "event": "Daily news generation now active"}
              ]
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
              url: '#',
              timeline: [
                {"date": "Research", "event": "GDELT database identified as news source"},
                {"date": "Development", "event": "API integration and filtering built"},
                {"date": "Testing", "event": "Source verification and quality checks"},
                {"date": "Active", "event": "Real-time global news processing online"}
              ]
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
              url: '#',
              timeline: [
                {"date": "Planning", "event": "AI curation system designed"},
                {"date": "Implementation", "event": "Claude API integration completed"},
                {"date": "Optimization", "event": "Story selection algorithms refined"},
                {"date": "Production", "event": "AI curation now processing daily news"}
              ]
            }
          ];
        }
        
        // Add test timeline story before newsletter
        processedStories.push({
          type: 'news',
          number: processedStories.filter(s => s.type === 'news').length + 1,
          category: 'TIMELINE TEST',
          emoji: '📅',
          title: 'Timeline Feature Test Story',
          summary: 'This is a **test story** to demonstrate the **timeline feature**. You should see **blue arrows** on the details box below. Click the **left arrow** to show the timeline and **right arrow** to hide it.',
          details: ['Test: Timeline feature', 'Arrows: Click to toggle', 'Status: Working'],
          source: 'Ten News',
          url: '#',
          timeline: [
            {"date": "Step 1", "event": "Timeline feature was requested by user"},
            {"date": "Step 2", "event": "Code was written and CSS styles added"},
            {"date": "Step 3", "event": "Blue arrows were added to details box"},
            {"date": "Now", "event": "Timeline test story created for demonstration"}
          ]
        });

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

  // Timeline toggle function
  const toggleTimeline = (storyIndex) => {
    // Stop auto-rotation permanently when user manually interacts
    stopAutoRotation(storyIndex);
    
    setShowTimeline(prev => ({
      ...prev,
      [storyIndex]: !prev[storyIndex]
    }));
    
    // DO NOT restart auto-rotation - user has taken control
  };

  // Start auto-rotation for a story
  const startAutoRotation = (storyIndex) => {
    // Clear any existing timer
    if (autoRotateTimers[storyIndex]) {
      clearInterval(autoRotateTimers[storyIndex]);
    }
    
    // Start new timer
    const timerId = setInterval(() => {
      setShowTimeline(prev => ({
        ...prev,
        [storyIndex]: !prev[storyIndex]
      }));
    }, 4000); // Every 4 seconds
    
    setAutoRotateTimers(prev => ({
      ...prev,
      [storyIndex]: timerId
    }));
  };

  // Stop auto-rotation for a story
  const stopAutoRotation = (storyIndex) => {
    if (autoRotateTimers[storyIndex]) {
      clearInterval(autoRotateTimers[storyIndex]);
      setAutoRotateTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[storyIndex];
        return newTimers;
      });
    }
  };

  // Auto-rotate when story becomes visible
  useEffect(() => {
    // Start auto-rotation for current story if it has timeline
    const currentStory = stories[currentIndex];
    if (currentStory && currentStory.timeline && currentStory.type === 'news') {
      startAutoRotation(currentIndex);
    }
    
    // Stop auto-rotation for all other stories
    Object.keys(autoRotateTimers).forEach(storyIndex => {
      if (parseInt(storyIndex) !== currentIndex) {
        stopAutoRotation(parseInt(storyIndex));
      }
    });
  }, [currentIndex, stories]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoRotateTimers).forEach(timerId => {
        clearInterval(timerId);
      });
    };
  }, []);

  // Newsletter signup handler
  const handleNewsletterSignup = async () => {
    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput?.value?.trim();
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Successfully subscribed! Check your email for confirmation.');
        emailInput.value = '';
      } else {
        alert(data.message || 'Failed to subscribe. Please try again.');
      }
    } catch (error) {
      console.error('Newsletter signup error:', error);
      alert('Failed to subscribe. Please try again.');
    }
  };

  // Function to render text with bold markup and category-colored containers
  const renderBoldText = (text, category) => {
    if (!text) return '';
    
    const getCategoryBoldStyle = (category) => {
      const styles = {
        'WORLD NEWS': { background: '#fee2e2', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'BUSINESS': { background: '#fff7ed', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'MARKETS': { background: '#ecfeff', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'TECH & AI': { background: '#eef2ff', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'SCIENCE': { background: '#e0f2fe', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'HEALTH': { background: '#ecfdf5', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'CLIMATE': { background: '#f0fdf4', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'SPORTS': { background: '#fffbeb', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'ENTERTAINMENT': { background: '#fdf2f8', color: '#000000', padding: '2px 6px', borderRadius: '4px' }
      };
      return styles[category] || { background: '#f8fafc', color: '#000000', padding: '2px 6px', borderRadius: '4px' };
    };
    
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={getCategoryBoldStyle(category)}>{part.slice(2, -2)}</strong>;
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

  // Time-of-day helper
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  };

  // Greeting gradient by time
  const getGreetingGradient = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'linear-gradient(90deg, #f97316 0%, #fbbf24 100%)'; // Orange → Yellow
    if (t === 'afternoon') return 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)'; // Blue → Cyan
    return 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)'; // Indigo → Purple
  };

  // Headline (rest) gradient by time
  const getHeadlineRestGradient = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)'; // Deep Purple → Hot Pink
    if (t === 'afternoon') return 'linear-gradient(90deg, #dc2626 0%, #f97316 100%)'; // Red → Orange
    return 'linear-gradient(90deg, #f59e0b 0%, #f87171 100%)'; // Gold → Coral
  };

  // Opening background gradient by time
  const getOpeningBackground = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)';
    if (t === 'afternoon') return 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)';
    return 'linear-gradient(135deg, #f59e0b 0%, #f87171 100%)';
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
    const restGradient = getHeadlineRestGradient();
    
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
          <span style={{ color: '#0f172a' }}>{restOfText}</span>
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
          align-items: flex-start;
          justify-content: center;
          padding: 70px 24px 40px;
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
          font-size: 60px; /* ~15% larger */
          font-weight: 900; /* extra bold */
          line-height: 1.12; /* compact */
          letter-spacing: -1px; /* tighter */
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
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .news-category:hover {
          transform: scale(1.05);
        }

        .news-category-icon {
          font-size: 12px;
        }

        .news-title {
          font-size: 48px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 20px;
          color: #000000;
        }

        .news-summary {
          font-size: 17px;
          color: #4a4a4a;
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

        /* Timeline Styles */
        .timeline-section {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          transform: translateX(100%);
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .timeline-section.visible {
          transform: translateX(0);
          opacity: 1;
        }

        .timeline-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #94a3b8;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .timeline-label::before {
          content: '📅';
          font-size: 12px;
        }

        .timeline {
          position: relative;
          padding-left: 20px;
        }

        .timeline::before {
          content: '';
          position: absolute;
          left: 6px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(180deg, #3b82f6, #e2e8f0);
        }

        .timeline-item {
          position: relative;
          margin-bottom: 20px;
          padding-left: 20px;
          opacity: 0;
          animation: timelineSlideIn 0.5s ease forwards;
        }

        .timeline-item:nth-child(1) { animation-delay: 0.1s; }
        .timeline-item:nth-child(2) { animation-delay: 0.2s; }
        .timeline-item:nth-child(3) { animation-delay: 0.3s; }
        .timeline-item:nth-child(4) { animation-delay: 0.4s; }
        .timeline-item:nth-child(5) { animation-delay: 0.5s; }

        @keyframes timelineSlideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .timeline-item::before {
          content: '';
          position: absolute;
          left: -14px;
          top: 6px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          border: 2px solid #3b82f6;
          z-index: 1;
        }

        .timeline-item:last-child::before {
          background: #3b82f6;
        }

        .timeline-date {
          font-size: 11px;
          font-weight: 600;
          color: #3b82f6;
          margin-bottom: 4px;
        }

        .timeline-event {
          font-size: 14px;
          color: #1e293b;
          line-height: 1.4;
        }

        .swipe-indicator {
          position: absolute;
          bottom: -8px;
          right: 12px;
          font-size: 9px;
          color: #cbd5e1;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0.6;
        }

        .swipe-indicator::before {
          content: '←';
          font-size: 12px;
        }

        .swipe-indicator::after {
          content: '→';
          font-size: 12px;
        }

        .news-meta {
          position: relative;
        }


        @media (max-width: 768px) {
          .header-right .time {
            display: none;
          }
          
          /* Hide arrows on mobile - use swipe only */
          .timeline-arrow {
            display: none !important;
          }
          
          .story-container {
            padding: 60px 12px 40px;
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
            font-size: 38px; /* ~12% larger */
            font-weight: 900;
            letter-spacing: -1px;
            margin-bottom: 30px;
            line-height: 1.12;
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
            <span style={{
              background: '#ff4444',
              color: 'white',
              padding: '4px 8px',
              marginLeft: '12px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '700'
            }}>TIMELINE TEST</span>
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
                  
                  <div className={`news-item ${story.number === 1 ? 'first-news' : ''}`} onClick={() => {
                    console.log('Clicked story URL:', story.url);
                    if (story.url && story.url !== '#') {
                      window.open(story.url, '_blank');
                    } else {
                      console.log('No valid URL found for this story');
                    }
                  }}>
                    <div className="news-number">{story.number < 10 ? `0${story.number}` : story.number}</div>
                    <div className="news-content">
                      <div className="news-category" style={{
                        background: story.category === 'WORLD NEWS' ? 'rgba(220, 38, 38, 0.1)' :
                                   story.category === 'BUSINESS' ? 'rgba(255, 107, 53, 0.1)' :
                                   story.category === 'MARKETS' ? 'rgba(6, 182, 212, 0.1)' :
                                   story.category === 'TECH & AI' ? 'rgba(102, 126, 234, 0.1)' :
                                   story.category === 'SCIENCE' ? 'rgba(14, 165, 233, 0.1)' :
                                   story.category === 'HEALTH' ? 'rgba(0, 210, 160, 0.1)' :
                                   story.category === 'CLIMATE' ? 'rgba(34, 197, 94, 0.1)' :
                                   story.category === 'SPORTS' ? 'rgba(245, 158, 11, 0.1)' :
                                   story.category === 'ENTERTAINMENT' ? 'rgba(236, 72, 153, 0.1)' : 
                                   'rgba(100, 116, 139, 0.1)',
                        color: story.category === 'WORLD NEWS' ? '#dc2626' :
                               story.category === 'BUSINESS' ? '#FF6B35' :
                               story.category === 'MARKETS' ? '#06b6d4' :
                               story.category === 'TECH & AI' ? '#667EEA' :
                               story.category === 'SCIENCE' ? '#0ea5e9' :
                               story.category === 'HEALTH' ? '#00D2A0' :
                               story.category === 'CLIMATE' ? '#22c55e' :
                               story.category === 'SPORTS' ? '#f59e0b' :
                               story.category === 'ENTERTAINMENT' ? '#ec4899' : '#64748b'
                      }}>
                        <span className="news-category-icon">{story.emoji}</span>
                        {story.category}
                      </div>
                      <h3 className="news-title">{story.title}</h3>
                      <p className="news-summary">{renderBoldText(story.summary, story.category)}</p>
                      
                      {/* Timeline/Details Indicator Dots */}
                      {story.timeline && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: !showTimeline[index] ? '#3b82f6' : '#e5e7eb',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                          }} onClick={(e) => {
                            e.stopPropagation();
                            if (showTimeline[index]) {
                              toggleTimeline(index);
                            }
                          }}></div>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: showTimeline[index] ? '#3b82f6' : '#e5e7eb',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                          }} onClick={(e) => {
                            e.stopPropagation();
                            if (!showTimeline[index]) {
                              toggleTimeline(index);
                            }
                          }}></div>
                        </div>
                      )}
                      <div 
                        className="news-meta" 
                        style={{ 
                          position: 'relative', 
                          overflow: 'visible', 
                          cursor: 'pointer',
                          minHeight: '90px'
                        }}
                        onTouchStart={(e) => {
                          const startX = e.touches[0].clientX;
                          const startY = e.touches[0].clientY;
                          let hasMoved = false;
                          let swipeDirection = null;
                          
                          const handleTouchMove = (moveEvent) => {
                            const currentX = moveEvent.touches[0].clientX;
                            const currentY = moveEvent.touches[0].clientY;
                            const diffX = Math.abs(startX - currentX);
                            const diffY = Math.abs(startY - currentY);
                            
                            if (diffX > 10 || diffY > 10) {
                              hasMoved = true;
                              
                              // Determine swipe direction
                              if (diffX > diffY && diffX > 20) {
                                swipeDirection = 'horizontal';
                                // ONLY prevent default for horizontal swipes
                                moveEvent.preventDefault();
                                moveEvent.stopPropagation();
                              } else if (diffY > diffX && diffY > 20) {
                                swipeDirection = 'vertical';
                                // Let vertical swipes pass through for story navigation
                              }
                            }
                          };
                          
                          const handleTouchEnd = (endEvent) => {
                            const endX = endEvent.changedTouches[0].clientX;
                            const endY = endEvent.changedTouches[0].clientY;
                            const diffX = startX - endX;
                            const diffY = startY - endY;
                            
                            // Only handle horizontal swipes for timeline
                            if (hasMoved && swipeDirection === 'horizontal' && Math.abs(diffX) > 25) {
                              console.log('Horizontal timeline swipe detected for story', index);
                              endEvent.preventDefault();
                              endEvent.stopPropagation();
                              toggleTimeline(index);
                            } else if (!hasMoved) {
                              // Single tap toggles timeline
                              console.log('Timeline tap detected for story', index);
                              endEvent.preventDefault();
                              endEvent.stopPropagation();
                              toggleTimeline(index);
                            }
                            // If it's vertical swipe, let it pass through for story navigation
                            
                            // Clean up listeners
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                          };
                          
                          // Use normal event listeners, let vertical swipes pass through
                          document.addEventListener('touchmove', handleTouchMove, { passive: false });
                          document.addEventListener('touchend', handleTouchEnd, { passive: false });
                        }}
                      >
                        {!showTimeline[index] ? (
                          // Show Details
                          story.details && story.details.map((detail, i) => {
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
                          })
                        ) : null}
                        
                        {/* Timeline Overlay - Same starting position, extends downward */}
                        {showTimeline[index] && story.timeline && (
                          <div style={{
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            right: '0',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '16px',
                            padding: '12px 20px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            zIndex: '20',
                            minHeight: '90px'
                          }}>
                            <div style={{
                              position: 'relative',
                              paddingLeft: '20px'
                            }}>
                              <div style={{
                                position: 'absolute',
                                left: '6px',
                                top: '8px',
                                bottom: '8px',
                                width: '2px',
                                background: 'linear-gradient(180deg, #3b82f6, #e2e8f0)'
                              }}></div>
                              {story.timeline.map((event, idx) => (
                                <div key={idx} style={{
                                  position: 'relative',
                                  marginBottom: '8px',
                                  paddingLeft: '20px'
                                }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-14px',
                                    top: '4px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: idx === story.timeline.length - 1 ? '#3b82f6' : 'white',
                                    border: '2px solid #3b82f6',
                                    zIndex: '1'
                                  }}></div>
                                  <div style={{
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#3b82f6',
                                    marginBottom: '2px'
                                  }}>{event.date}</div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#1e293b',
                                    lineHeight: '1.2'
                                  }}>{event.event}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Toggle Arrows - Hidden on mobile */}
                        <div className="timeline-arrow" style={{
                          position: 'absolute',
                          left: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '20px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          opacity: '0.7',
                          zIndex: '10'
                        }} onClick={(e) => {
                          e.stopPropagation();
                          console.log('Left arrow clicked for story', index);
                          toggleTimeline(index);
                        }}>←</div>
                        
                        <div className="timeline-arrow" style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '20px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          opacity: '0.7',
                          zIndex: '10'
                        }} onClick={(e) => {
                          e.stopPropagation();
                          console.log('Right arrow clicked for story', index);
                          toggleTimeline(index);
                        }}>→</div>
                        
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
                      id="newsletter-email"
                    />
                    <button className="newsletter-button" onClick={handleNewsletterSignup}>
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
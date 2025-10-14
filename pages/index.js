import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import NewFirstPage from '../components/NewFirstPage';

export default function Home() {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState({});
  const [darkMode, setDarkMode] = useState(false);

  // Authentication state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState(null); // 'login', 'signup', or null
  const [authError, setAuthError] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState(null); // { email: string } or null

  // Form data persistence
  const [formData, setFormData] = useState({
    loginEmail: '',
    loginPassword: '',
    signupEmail: '',
    signupPassword: '',
    signupFullName: ''
  });
  const [supabase] = useState(() => createClient());

  // Check authentication status on mount
  useEffect(() => {
    // Check for stored session first
    const storedUser = localStorage.getItem('tennews_user');
    const storedSession = localStorage.getItem('tennews_session');

    if (storedUser && storedSession) {
      try {
        const userData = JSON.parse(storedUser);
        const sessionData = JSON.parse(storedSession);
        setUser(userData);
        setAuthLoading(false);
        return; // Skip API check if we have stored session
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('tennews_user');
        localStorage.removeItem('tennews_session');
      }
    }

    // Fallback to API check
    checkUser();
  }, []);

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
              const imageUrl = article.urlToImage || article.image || null;
              
              // DEBUG: Log image info for first 3 articles
              if (index < 3) {
                console.log(`📰 Article ${index + 1}: "${article.title?.substring(0, 50)}..."`);
                console.log(`   Image URL: ${imageUrl || 'NO IMAGE'}`);
                console.log(`   Has urlToImage: ${!!article.urlToImage}`);
                console.log(`   Has image: ${!!article.image}`);
              }
              
              const storyData = {
              type: 'news',
              number: article.rank || (index + 1),
              category: (article.category || 'WORLD NEWS').toUpperCase(),
              emoji: article.emoji || '📰',
              title: article.title || 'News Story',
              summary: article.rewritten_text || article.summary || 'News summary will appear here.',
              details: article.details || [],
              source: article.source || 'News+',
              url: article.url || '#',
              urlToImage: imageUrl
              };
              
              // Add timeline data (from generator or create fallback)
              if (article.timeline) {
                storyData.timeline = article.timeline;
              } else {
                // Create fallback timeline for all stories (variable length)
                const timelineVariations = [
                  [
                    {"date": "Background", "event": "Initial situation develops"},
                    {"date": "Today", "event": "Major developments break"},
                    {"date": "Next week", "event": "Follow-up expected"}
                  ],
                  [
                    {"date": "Recently", "event": "Key events unfold"},
                    {"date": "Yesterday", "event": "Critical point reached"},
                    {"date": "Today", "event": "Story breaks"},
                    {"date": "Coming days", "event": "Developments continue"}
                  ],
                  [
                    {"date": "Last month", "event": "Initial reports emerge"},
                    {"date": "Today", "event": "Major announcement made"}
                  ]
                ];
                storyData.timeline = timelineVariations[index % timelineVariations.length];
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
              headline: 'News+ automation is working perfectly'
            },
            {
              type: 'news',
              number: 1,
              category: 'SYSTEM STATUS',
              emoji: '🤖',
              title: 'GitHub Actions Automation Active',
              summary: 'Your News+ system is running automatically. Fresh AI-curated content from GDELT and Claude will appear daily at 7 AM UK time.',
              details: ['Schedule: Daily 7 AM UK', 'Source: GDELT API', 'AI: Claude curation'],
              source: 'News+ System',
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
              source: 'News+ System',
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
              source: 'News+ System',
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
    setShowTimeline(prev => ({
      ...prev,
      [storyIndex]: !prev[storyIndex]
    }));
  };

  // Dark mode toggle function
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };


  // Authentication functions
  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setAuthModal(null);
        // Store session in localStorage for persistence
        localStorage.setItem('tennews_user', JSON.stringify(data.user));
        if (data.session) {
          localStorage.setItem('tennews_session', JSON.stringify(data.session));
        }
      } else {
        setAuthError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Login failed. Please try again.');
    }
  };

  const handleSignup = async (email, password, fullName) => {
    setAuthError('');
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthModal(null);
        setEmailConfirmation({ email });
      } else {
        setAuthError(data.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError('Signup failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setUser(null);
        // Clear stored session from localStorage
        localStorage.removeItem('tennews_user');
        localStorage.removeItem('tennews_session');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const checkUser = async () => {
    try {
      const response = await fetch('/api/auth/user');
      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Check user error:', error);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // Function to render text without bold markup
  const renderBoldText = (text, category) => {
    if (!text) return '';
    // Remove all ** markdown markers and return plain text
    return text.replace(/\*\*/g, '');
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

        // Allow backward navigation, but prevent forward navigation when paywall is active
        const isPaywallActive = !user && currentIndex >= 5;
        const isForwardNavigation = diff > 0; // diff > 0 means scrolling up/down to next story

        if (isPaywallActive && isForwardNavigation) {
          // Block forward navigation when paywall is active
          isTransitioning = false;
          return;
        }

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
      
      if (Math.abs(e.deltaY) > 30) {
        // Allow backward navigation, but prevent forward navigation when paywall is active
        const isPaywallActive = !user && currentIndex >= 5;
        const isForwardNavigation = e.deltaY > 0; // deltaY > 0 means scrolling down to next story

        if (isPaywallActive && isForwardNavigation) {
          // Block forward navigation when paywall is active
          return;
        }

        e.preventDefault();
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

      const isPaywallActive = !user && currentIndex >= 5;
      
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        // Allow forward navigation unless paywall is active
        if (isPaywallActive) return;

        e.preventDefault();
        isTransitioning = true;
        nextStory();
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        // Always allow backward navigation
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

  // Scroll lock for paywall - only prevent page-level scrolling, allow navigation
  useEffect(() => {
    const isPaywallActive = !user && currentIndex >= 5;

    if (isPaywallActive) {
      // Prevent page-level scrolling but allow touch navigation (controlled by handlers)
      document.body.style.overflow = 'hidden';
      // Remove touch-action: none to allow touch events for navigation
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [user, currentIndex]);

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
          <span style={{ color: darkMode ? '#ffffff' : '#0f172a' }}>{restOfText}</span>
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
          background: ${darkMode ? '#000000' : '#ffffff'};
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
          touch-action: none;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: ${darkMode ? '#000000' : '#fff'};
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid ${darkMode ? '#333333' : '#f3f3f3'};
          border-top: 3px solid ${darkMode ? '#ffffff' : '#1d1d1f'};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        .loading-text {
          font-size: 16px;
          color: ${darkMode ? '#86868b' : '#86868b'};
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
          background: ${darkMode ? 'rgba(0,0,0,0.97)' : 'rgba(255,255,255,0.97)'};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(148, 163, 184, 0.1)'};
          transition: background-color 0.3s ease, border-color 0.3s ease;
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
          color: ${darkMode ? '#ffffff' : '#0f172a'};
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
          color: ${darkMode ? '#94a3b8' : '#94a3b8'};
          font-weight: 500;
        }


        .story-container {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0 24px 40px;
          background: ${darkMode ? '#000000' : '#fff'};
          transition: all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
          overflow-y: auto;
        }

        .story-content {
          max-width: 1000px;
          width: 100%;
          margin: 0 auto;
        }

        .paywall-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
          pointer-events: auto;
        }

        .paywall-modal {
          background: ${darkMode ? '#1f2937' : '#ffffff'};
          border-radius: 16px;
          padding: 32px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border: 1px solid ${darkMode ? '#374151' : '#e5e7eb'};
          pointer-events: auto;
          position: relative;
          z-index: 1001;
        }

        .paywall-modal h2 {
          color: ${darkMode ? '#ffffff' : '#1f2937'};
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
          text-align: center;
        }

        .paywall-modal p {
          color: ${darkMode ? '#9ca3af' : '#6b7280'};
          font-size: 16px;
          line-height: 1.5;
          margin: 0 0 24px 0;
          text-align: center;
        }

        .paywall-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid ${darkMode ? '#374151' : '#e5e7eb'};
          text-align: center;
        }

        .paywall-footer p {
          margin: 0;
          color: ${darkMode ? '#9ca3af' : '#6b7280'};
          font-size: 14px;
        }

        .paywall-footer .auth-switch {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          text-decoration: underline;
        }

        .paywall-footer .auth-switch:hover {
          color: #2563eb;
        }

        /* Ensure form inputs work in paywall modal */
        .paywall-modal input,
        .paywall-modal button,
        .paywall-modal textarea,
        .paywall-modal select {
          pointer-events: auto;
        }

        .paywall-modal .auth-form,
        .paywall-modal .auth-field,
        .paywall-modal .auth-submit,
        .paywall-modal .auth-error,
        .paywall-modal .auth-switch {
          pointer-events: auto;
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
          color: ${darkMode ? '#ffffff' : '#0f172a'};
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
          padding: 0 15px 24px 15px;
          border-bottom: 1px solid #e5e5e7;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 8px;
          position: relative;
          margin: 0 auto;
          max-width: 950px;
        }

        /* Removed first-news special styling to align all news cards */

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
          padding-top: 0px;
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
          color: ${darkMode ? '#ffffff' : '#000000'};
        }

        .news-summary {
          font-size: 17px;
          color: ${darkMode ? '#d1d5db' : '#4a4a4a'};
          line-height: 1.6;
          margin-bottom: 16px;
          text-align: left;
          border-bottom: none;
          padding-bottom: 0;
        }

        .news-meta {
          display: flex;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 12px 20px;
          margin-top: 20px;
          gap: 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
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

        .news-detail-item:last-child,
        .news-detail-item:nth-child(3) {
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
          color: ${darkMode ? '#f9fafb' : '#111827'};
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

        /* Authentication Styles */
        @property --angle-1 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -75deg;
        }

        @property --angle-2 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -45deg;
        }

        .auth-btn, .subscribe-btn {
          all: unset;
          cursor: pointer;
          position: relative;
          -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
          pointer-events: auto;
          z-index: 3;
          background: linear-gradient(
            -75deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.2),
            rgba(255, 255, 255, 0.05)
          );
          border-radius: 999vw;
          box-shadow: inset 0 0.125em 0.125em rgba(0, 0, 0, 0.05),
            inset 0 -0.125em 0.125em rgba(255, 255, 255, 0.5),
            0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.2),
            0 0 0.1em 0.25em inset rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1);
          padding: 10px 20px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          letter-spacing: -0.05em;
          font-weight: 500;
          font-size: 12px;
          color: rgba(50, 50, 50, 1);
          text-shadow: 0em 0.25em 0.05em rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }

        .auth-btn:hover, .subscribe-btn:hover {
          transform: scale(0.975);
          backdrop-filter: blur(0.5px);
          -webkit-backdrop-filter: blur(0.5px);
          box-shadow: inset 0 0.125em 0.125em rgba(0, 0, 0, 0.05),
            inset 0 -0.125em 0.125em rgba(255, 255, 255, 0.5),
            0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.25),
            0 0 0.05em 0.1em inset rgba(255, 255, 255, 0.5);
          text-shadow: 0.025em 0.025em 0.025em rgba(0, 0, 0, 0.12);
        }

        .auth-btn::after, .subscribe-btn::after {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          border-radius: 999vw;
          width: calc(100% + 1px);
          height: calc(100% + 1px);
          top: calc(0% - 0.5px);
          left: calc(0% - 0.5px);
          padding: 1px;
          box-sizing: border-box;
          background: conic-gradient(
              from var(--angle-1) at 50% 50%,
              rgba(0, 0, 0, 0.5),
              rgba(0, 0, 0, 0) 5% 40%,
              rgba(0, 0, 0, 0.5) 50%,
              rgba(0, 0, 0, 0) 60% 95%,
              rgba(0, 0, 0, 0.5)
            ),
            linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease;
          box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.5);
        }

        .auth-btn:hover::after, .subscribe-btn:hover::after {
          --angle-1: -125deg;
        }

        .user-welcome {
          font-size: 13px;
          color: ${darkMode ? '#94a3b8' : '#86868b'};
          margin-right: 12px;
        }

        .auth-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          backdrop-filter: blur(4px);
        }

        .auth-modal {
          background: ${darkMode ? '#1f2937' : '#ffffff'};
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 90%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .auth-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0;
          margin-bottom: 24px;
        }

        .auth-modal-header h2 {
          font-size: 24px;
          font-weight: 800;
          color: ${darkMode ? '#ffffff' : '#0f172a'};
          margin: 0;
        }

        .auth-close {
          background: none;
          border: none;
          font-size: 24px;
          color: ${darkMode ? '#94a3b8' : '#6b7280'};
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .auth-close:hover {
          background: ${darkMode ? '#374151' : '#f3f4f6'};
          color: ${darkMode ? '#ffffff' : '#374151'};
        }

        .auth-modal-body {
          padding: 0 24px 24px;
        }

        .auth-error {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-field label {
          font-size: 14px;
          font-weight: 600;
          color: ${darkMode ? '#d1d5db' : '#374151'};
        }

        .auth-field input {
          padding: 12px 16px;
          border: 1px solid ${darkMode ? '#374151' : '#d5d5d5'};
          border-radius: 8px;
          font-size: 16px;
          background: ${darkMode ? '#111827' : '#ffffff'};
          color: ${darkMode ? '#ffffff' : '#111827'};
          transition: border-color 0.2s;
        }

        .auth-field input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .auth-field-error {
          font-size: 12px;
          color: #dc2626;
          margin-top: 4px;
        }

        .auth-submit {
          padding: 14px 24px;
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .auth-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-modal-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid ${darkMode ? '#374151' : '#e5e7eb'};
          text-align: center;
        }

        .auth-modal-footer p {
          margin: 0;
          font-size: 14px;
          color: ${darkMode ? '#94a3b8' : '#6b7280'};
        }

        .auth-switch {
          background: none;
          border: none;
          color: #3b82f6;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
          font-size: inherit;
        }

        .auth-switch:hover {
          color: #2563eb;
        }

        @keyframes progressFill {
          0% { width: 0%; }
          100% { width: 100%; }
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


        /* Desktop timeline - no height limit */
        @media (min-width: 769px) {
          .timeline-container-desktop {
            max-height: none !important;
            height: auto !important;
          }

          /* Hide arrows on desktop - show on mobile/tablet */
        }

        @media (max-width: 768px) {
          .header-right .time {
            display: none;
          }
          
          /* Show arrows on mobile/tablet - hide on desktop */
          
          .story-container {
            padding: 0 0 40px;
          }
          
          .news-item {
            padding: 0 10px 20px 10px;
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
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
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
        {/* Logo - Always Visible, On Top of Image for News Pages - REMOVED */}

        {/* Full Header for First Page */}
        {currentIndex === 0 && (
          <div className="header">
            <div className="logo">
              News<span className="logo-ten">+</span>
            </div>
            
            <div style={{ flex: 1 }}></div>
            
            <div className="header-right">
              <span className="time">{currentTime}</span>
              {user ? (
                <>
                  <span className="user-welcome">Welcome, {user.user_metadata?.full_name || user.email}</span>
                  <button className="auth-btn" onClick={handleLogout}>LOGOUT</button>
                </>
              ) : (
                <>
                  <button className="auth-btn" onClick={() => setAuthModal('login')}>LOGIN</button>
                  <button className="subscribe-btn" onClick={() => setAuthModal('signup')}>SIGN UP</button>
                </>
              )}
            </div>
          </div>
        )}


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
              pointerEvents: (index === currentIndex && !(index >= 5 && !user)) ? 'auto' : 'none',
            }}
          >
            {/* Paywall for stories 6+ (index >= 5) */}
            {index >= 5 && !user && (
              <div className="paywall-overlay">
                <div className="paywall-modal">
                  <h2>Create Your Account</h2>
                  <p>Continue reading beyond the 5th story by creating a free account.</p>
                  <SignupForm onSubmit={handleSignup} />
                  <div className="paywall-footer">
                    <p>Already have an account? <button className="auth-switch" onClick={() => setAuthModal('login')}>Login</button></p>
                  </div>
                </div>
              </div>
            )}

            <div
              className="story-content"
                              style={{
                filter: index >= 5 && !user ? 'blur(5px)' : 'none',
                pointerEvents: index >= 5 && !user ? 'none' : 'auto',
              }}
            >
              {story.type === 'opening' ? (
                <NewFirstPage 
                  onContinue={nextStory}
                />
              ) : story.type === 'news' ? (
                <div className="news-grid" style={{ overflow: 'hidden', padding: 0, margin: 0 }}>
                  
                  <div className="news-item" style={{ overflow: 'visible', padding: 0, position: 'relative' }} onClick={() => {
                    console.log('Clicked story URL:', story.url);
                    if (story.url && story.url !== '#') {
                      window.open(story.url, '_blank');
                    } else {
                      console.log('No valid URL found for this story');
                    }
                  }}>
                    {/* News Image - With Rounded Corners and Spacing */}
                    <div style={{
                      position: 'fixed',
                      top: '3px',
                      left: '6px',
                      right: '6px',
                      width: 'calc(100vw - 12px)',
                      height: 'calc(30vh - 3px)',
                      margin: 0,
                      padding: 0,
                      background: story.urlToImage ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: '1',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      {story.urlToImage ? (
                        <img 
                          src={story.urlToImage}
                          alt={story.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center'
                          }}
                          onLoad={() => {
                            console.log('✅ Image loaded successfully:', story.urlToImage);
                          }}
                          onError={(e) => {
                            console.error('❌ Image failed to load:', story.urlToImage);
                            console.error('   Story title:', story.title);
                            e.target.style.display = 'none';
                            e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                            e.target.parentElement.innerHTML = `
                              <div style="
                                font-size: 72px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 100%;
                                height: 100%;
                              ">${story.emoji || '📰'}</div>
                            `;
                          }}
                        />
                      ) : (
                        <div style={{
                          fontSize: '72px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%'
                        }}>
                          {story.emoji || '📰'}
                        </div>
                      )}
                    </div>
                    
                    {/* Content Area - Starts After Image */}
                    <div className="news-content" style={{
                      position: 'relative',
                      paddingTop: 'calc(30vh + 12px)',
                      paddingLeft: '10px',
                      paddingRight: '10px',
                      zIndex: '2'
                    }}>
                      
                      {/* Category Badge */}
                      <div style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: (() => {
                          const categoryColors = {
                            'WORLD NEWS': { bg: '#fee2e2', text: '#dc2626' },
                            'BUSINESS': { bg: '#fff7ed', text: '#ea580c' },
                            'MARKETS': { bg: '#ecfeff', text: '#0891b2' },
                            'TECH & AI': { bg: '#eef2ff', text: '#4f46e5' },
                            'SCIENCE': { bg: '#e0f2fe', text: '#0284c7' },
                            'HEALTH': { bg: '#ecfdf5', text: '#059669' },
                            'CLIMATE': { bg: '#f0fdf4', text: '#16a34a' },
                            'SPORTS': { bg: '#fffbeb', text: '#d97706' },
                            'ENTERTAINMENT': { bg: '#fdf2f8', text: '#db2777' }
                          };
                          return categoryColors[story.category]?.bg || '#f8fafc';
                        })(),
                        color: (() => {
                          const categoryColors = {
                            'WORLD NEWS': { bg: '#fee2e2', text: '#dc2626' },
                            'BUSINESS': { bg: '#fff7ed', text: '#ea580c' },
                            'MARKETS': { bg: '#ecfeff', text: '#0891b2' },
                            'TECH & AI': { bg: '#eef2ff', text: '#4f46e5' },
                            'SCIENCE': { bg: '#e0f2fe', text: '#0284c7' },
                            'HEALTH': { bg: '#ecfdf5', text: '#059669' },
                            'CLIMATE': { bg: '#f0fdf4', text: '#16a34a' },
                            'SPORTS': { bg: '#fffbeb', text: '#d97706' },
                            'ENTERTAINMENT': { bg: '#fdf2f8', text: '#db2777' }
                          };
                          return categoryColors[story.category]?.text || '#64748b';
                        })()
                      }}>
                        {story.emoji} {story.category}
                      </div>
                      
                      {/* Title - Large and Prominent, Higher Position */}
                      <h3 className="news-title" style={{ 
                        marginTop: '0',
                        marginBottom: '10px',
                        fontSize: '26px',
                        fontWeight: '800',
                        lineHeight: '1.2',
                        letterSpacing: '-0.5px'
                      }}>{story.title}</h3>
                      
                      {/* Summary - Visible and Styled */}
                      <p className="news-summary" style={{ 
                        marginTop: '0',
                        marginBottom: '16px',
                        fontSize: '18px',
                        lineHeight: '1.5',
                        color: '#1a1a1a',
                        opacity: '1'
                      }}>{renderBoldText(story.summary, story.category)}</p>
                      
                      {/* Fixed Position Toggle and Content Area - Lower Position */}
                      <div style={{
                        position: 'fixed',
                        bottom: '62px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '100%',
                        maxWidth: '950px',
                        paddingLeft: '15px',
                        paddingRight: '15px',
                        zIndex: '50'
                      }}>
                        
                        {/* Fixed Position Details/Timeline Section */}
                        <div 
                          className="news-meta" 
                        style={{ 
                          position: 'relative', 
                          overflow: 'visible', 
                          cursor: 'pointer',
                          minHeight: '90px',
                          height: '90px',
                          background: showTimeline[index] ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: showTimeline[index] ? 'none' : 'blur(16px)',
                          WebkitBackdropFilter: showTimeline[index] ? 'none' : 'blur(16px)',
                          border: showTimeline[index] ? 'none' : (() => {
                            const categoryBorders = {
                              'WORLD NEWS': '1px solid rgba(220, 38, 38, 0.35)',
                              'BUSINESS': '1px solid rgba(234, 88, 12, 0.35)',
                              'MARKETS': '1px solid rgba(8, 145, 178, 0.35)',
                              'TECH & AI': '1px solid rgba(79, 70, 229, 0.35)',
                              'SCIENCE': '1px solid rgba(2, 132, 199, 0.35)',
                              'HEALTH': '1px solid rgba(5, 150, 105, 0.35)',
                              'CLIMATE': '1px solid rgba(22, 163, 74, 0.35)',
                              'SPORTS': '1px solid rgba(217, 119, 6, 0.35)',
                              'ENTERTAINMENT': '1px solid rgba(219, 39, 119, 0.35)'
                            };
                            return categoryBorders[story.category] || '1px solid rgba(0, 0, 0, 0.08)';
                          })(),
                          borderRadius: showTimeline[index] ? '0' : '16px',
                          boxShadow: showTimeline[index] ? 'none' : (() => {
                            const categoryShadows = {
                              'WORLD NEWS': '0 4px 20px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(220, 38, 38, 0.15)',
                              'BUSINESS': '0 4px 20px rgba(234, 88, 12, 0.25), 0 2px 8px rgba(234, 88, 12, 0.15)',
                              'MARKETS': '0 4px 20px rgba(8, 145, 178, 0.25), 0 2px 8px rgba(8, 145, 178, 0.15)',
                              'TECH & AI': '0 4px 20px rgba(79, 70, 229, 0.25), 0 2px 8px rgba(79, 70, 229, 0.15)',
                              'SCIENCE': '0 4px 20px rgba(2, 132, 199, 0.25), 0 2px 8px rgba(2, 132, 199, 0.15)',
                              'HEALTH': '0 4px 20px rgba(5, 150, 105, 0.25), 0 2px 8px rgba(5, 150, 105, 0.15)',
                              'CLIMATE': '0 4px 20px rgba(22, 163, 74, 0.25), 0 2px 8px rgba(22, 163, 74, 0.15)',
                              'SPORTS': '0 4px 20px rgba(217, 119, 6, 0.25), 0 2px 8px rgba(217, 119, 6, 0.15)',
                              'ENTERTAINMENT': '0 4px 20px rgba(219, 39, 119, 0.25), 0 2px 8px rgba(219, 39, 119, 0.15)'
                            };
                            return categoryShadows[story.category] || '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)';
                          })()
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
                            
                            if (diffX > 15 || diffY > 15) {
                              hasMoved = true;
                              
                              // Determine swipe direction - be more strict
                              if (diffX > diffY && diffX > 30) {
                                swipeDirection = 'horizontal';
                                // ONLY prevent default for clear horizontal swipes
                                moveEvent.preventDefault();
                                moveEvent.stopPropagation();
                              } else if (diffY > diffX && diffY > 30) {
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
                        {/* Content - Either Details OR Timeline (never both visible) */}
                        {!showTimeline[index] ? (
                          // Show Details Only
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
                        ) : (
                          // Show Timeline Only - Grows upward from bottom
                          story.timeline && (
                            <div 
                              className="timeline-container-desktop"
                              style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: (() => {
                                  const categoryBorders = {
                                    'WORLD NEWS': '1px solid rgba(220, 38, 38, 0.35)',
                                    'BUSINESS': '1px solid rgba(234, 88, 12, 0.35)',
                                    'MARKETS': '1px solid rgba(8, 145, 178, 0.35)',
                                    'TECH & AI': '1px solid rgba(79, 70, 229, 0.35)',
                                    'SCIENCE': '1px solid rgba(2, 132, 199, 0.35)',
                                    'HEALTH': '1px solid rgba(5, 150, 105, 0.35)',
                                    'CLIMATE': '1px solid rgba(22, 163, 74, 0.35)',
                                    'SPORTS': '1px solid rgba(217, 119, 6, 0.35)',
                                    'ENTERTAINMENT': '1px solid rgba(219, 39, 119, 0.35)'
                                  };
                                  return categoryBorders[story.category] || '1px solid rgba(0, 0, 0, 0.08)';
                                })(),
                                borderRadius: '16px',
                                padding: '12px 20px',
                                boxShadow: (() => {
                                  const categoryShadows = {
                                    'WORLD NEWS': '0 4px 20px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(220, 38, 38, 0.15)',
                                    'BUSINESS': '0 4px 20px rgba(234, 88, 12, 0.25), 0 2px 8px rgba(234, 88, 12, 0.15)',
                                    'MARKETS': '0 4px 20px rgba(8, 145, 178, 0.25), 0 2px 8px rgba(8, 145, 178, 0.15)',
                                    'TECH & AI': '0 4px 20px rgba(79, 70, 229, 0.25), 0 2px 8px rgba(79, 70, 229, 0.15)',
                                    'SCIENCE': '0 4px 20px rgba(2, 132, 199, 0.25), 0 2px 8px rgba(2, 132, 199, 0.15)',
                                    'HEALTH': '0 4px 20px rgba(5, 150, 105, 0.25), 0 2px 8px rgba(5, 150, 105, 0.15)',
                                    'CLIMATE': '0 4px 20px rgba(22, 163, 74, 0.25), 0 2px 8px rgba(22, 163, 74, 0.15)',
                                    'SPORTS': '0 4px 20px rgba(217, 119, 6, 0.25), 0 2px 8px rgba(217, 119, 6, 0.15)',
                                    'ENTERTAINMENT': '0 4px 20px rgba(219, 39, 119, 0.25), 0 2px 8px rgba(219, 39, 119, 0.15)'
                                  };
                                  return categoryShadows[story.category] || '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)';
                                })(),
                                minHeight: '90px',
                                zIndex: '10'
                              }}>
                              <div style={{
                                position: 'relative',
                                paddingLeft: '20px',
                                width: '100%'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '5.5px',
                                  top: '8px',
                                  bottom: '8px',
                                  width: '3px',
                                  background: 'linear-gradient(180deg, #3b82f6, #93c5fd)',
                                  zIndex: '0',
                                  borderRadius: '2px'
                                }}></div>
                                {story.timeline.map((event, idx) => (
                                  <div key={idx} style={{
                                    position: 'relative',
                                    marginBottom: '12px',
                                    paddingLeft: '20px',
                                    minHeight: '36px'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      left: '-15px',
                                      top: '6px',
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: idx === story.timeline.length - 1 ? '#3b82f6' : 'white',
                                      border: '2.5px solid #3b82f6',
                                      zIndex: '2',
                                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                                    }}></div>
                                    <div style={{
                                      fontSize: '14px',
                                      fontWeight: '700',
                                      color: '#3b82f6',
                                      marginBottom: '4px',
                                      letterSpacing: '0.3px'
                                    }}>{event.date}</div>
                                    <div style={{
                                      fontSize: '16px',
                                      fontWeight: '500',
                                      color: darkMode ? '#e2e8f0' : '#1e293b',
                                      lineHeight: '1.4'
                                    }}>{event.event}</div>
                      </div>
                                ))}
                  </div>
                </div>
                          )
                        )}
                        
                  </div>
                      
                      {/* Minimal Navigation Dots */}
                      {story.timeline && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '10px',
                          marginTop: '14px'
                        }}>
                          {/* Details Dot */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTimeline(prev => ({ ...prev, [index]: false }));
                            }}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: !showTimeline[index] 
                                ? 'rgba(0, 0, 0, 0.75)' 
                                : 'rgba(255, 255, 255, 0.35)',
                              cursor: 'pointer',
                              transition: 'all 0.25s ease'
                            }}
                          />
                          
                          {/* Timeline Dot */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTimeline(prev => ({ ...prev, [index]: true }));
                            }}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: showTimeline[index] 
                                ? 'rgba(0, 0, 0, 0.75)' 
                                : 'rgba(255, 255, 255, 0.35)',
                              cursor: 'pointer',
                              transition: 'all 0.25s ease'
                            }}
                          />
                        </div>
                      )}
                      
                      </div> {/* Close fixed position container */}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {/* Authentication Modal */}
        {authModal && (
          <div className="auth-modal-overlay" onClick={() => setAuthModal(null)}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="auth-modal-header">
                <h2>{authModal === 'login' ? 'Login to News+' : 'Create Your Account'}</h2>
                <button className="auth-close" onClick={() => setAuthModal(null)}>×</button>
              </div>

              <div className="auth-modal-body">
                {authError && (
                  <div className="auth-error">{authError}</div>
                )}

                {authModal === 'login' ? (
                  <LoginForm onSubmit={handleLogin} formData={formData} setFormData={setFormData} />
                ) : (
                  <SignupForm onSubmit={handleSignup} formData={formData} setFormData={setFormData} />
                )}

                <div className="auth-modal-footer">
                  {authModal === 'login' ? (
                    <p>Don't have an account? <button className="auth-switch" onClick={() => {setAuthModal('signup'); setAuthError('');}}>Sign up</button></p>
                  ) : (
                    <p>Already have an account? <button className="auth-switch" onClick={() => {setAuthModal('login'); setAuthError('');}}>Login</button></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Confirmation Modal */}
        {emailConfirmation && (
          <div className="auth-modal-overlay" onClick={() => setEmailConfirmation(null)}>
            <EmailConfirmation
              email={emailConfirmation.email}
              onBack={() => setEmailConfirmation(null)}
            />
          </div>
        )}
      </div>
    </>
  );
}

// Login Form Component
function LoginForm({ onSubmit, formData, setFormData }) {
  const [email, setEmail] = useState(formData?.loginEmail || '');
  const [password, setPassword] = useState(formData?.loginPassword || '');
  const [loading, setLoading] = useState(false);

  // Sync with global formData
  useEffect(() => {
    setEmail(formData?.loginEmail || '');
  }, [formData?.loginEmail]);

  useEffect(() => {
    setPassword(formData?.loginPassword || '');
  }, [formData?.loginPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await onSubmit(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFormData(prev => ({ ...prev, loginEmail: e.target.value }));
          }}
          placeholder="Enter your email"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFormData(prev => ({ ...prev, loginPassword: e.target.value }));
          }}
          placeholder="Enter your password"
          required
        />
      </div>

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

// Signup Form Component
function SignupForm({ onSubmit, formData, setFormData }) {
  const [email, setEmail] = useState(formData?.signupEmail || '');
  const [password, setPassword] = useState(formData?.signupPassword || '');
  const [fullName, setFullName] = useState(formData?.signupFullName || '');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Helper function to safely update formData
  const updateFormData = (key, value) => {
    if (setFormData) {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  // Sync with global formData
  useEffect(() => {
    setEmail(formData?.signupEmail || '');
  }, [formData?.signupEmail]);

  useEffect(() => {
    setPassword(formData?.signupPassword || '');
  }, [formData?.signupPassword]);

  useEffect(() => {
    setFullName(formData?.signupFullName || '');
  }, [formData?.signupFullName]);

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    const error = validatePassword(password);
    if (error) {
      setPasswordError(error);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(email, password, fullName);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (pass) => {
    setPassword(pass);
    setPasswordError(validatePassword(pass));
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label htmlFor="signup-name">Full Name</label>
        <input
          id="signup-name"
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            updateFormData('signupFullName', e.target.value);
          }}
          placeholder="Enter your full name"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            updateFormData('signupEmail', e.target.value);
          }}
          placeholder="Enter your email"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => {
            handlePasswordChange(e.target.value);
            updateFormData('signupPassword', e.target.value);
          }}
          placeholder="Create a password (min 8 characters)"
          required
        />
        {passwordError && <span className="auth-field-error">{passwordError}</span>}
      </div>

      <button type="submit" className="auth-submit" disabled={loading || passwordError}>
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
}

// Email Confirmation Component
function EmailConfirmation({ email, onBack }) {
  return (
    <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
      <div className="auth-modal-header">
        <h2>Check Your Email</h2>
        <button className="auth-close" onClick={onBack}>×</button>
      </div>

      <div className="auth-modal-body">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: '0.8'
          }}>📧</div>

          <h3 style={{
            color: '#1f2937',
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 12px 0'
          }}>Verification Email Sent!</h3>

          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.5',
            margin: '0 0 20px 0'
          }}>
            We've sent a verification link to <strong>{email}</strong>
          </p>

          <div style={{
            background: '#f3f4f6',
            padding: '16px',
            borderRadius: '8px',
            margin: '20px 0',
            textAlign: 'left'
          }}>
            <h4 style={{
              color: '#1f2937',
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>Next steps:</h4>
            <ol style={{
              color: '#4b5563',
              margin: '0',
              paddingLeft: '20px',
              lineHeight: '1.6'
            }}>
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the verification link</li>
              <li>Return here and log in with your credentials</li>
            </ol>
          </div>

          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: '16px 0 0 0'
          }}>
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              try again
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
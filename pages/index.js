import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import NewFirstPage from '../components/NewFirstPage';

export default function Home() {
  const [stories, setStories] = useState([]);
  // Safely handle external images: avoid mixed content and hotlink blocking
  const getSafeImageUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const url = rawUrl.trim();
    if (url === '') return null;
    // If http (not https), proxy to avoid mixed-content blocks
    if (url.startsWith('http://')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState({});
  const [showDetails, setShowDetails] = useState({});
  const [showMap, setShowMap] = useState({});
  const [showGraph, setShowGraph] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [readArticles, setReadArticles] = useState(new Set());
  const [expandedTimeline, setExpandedTimeline] = useState({});
  const [showBulletPoints, setShowBulletPoints] = useState({});
  // Removed globalShowBullets - only showing summary text now
  const [showDetailedArticle, setShowDetailedArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showDetailedText, setShowDetailedText] = useState({}); // Track which articles show detailed text
  const [imageDominantColors, setImageDominantColors] = useState({}); // Store dominant color for each image

  // Swipe handling for summary/bullet toggle and detailed article navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.toggle-switch') || e.target.closest('[data-expand-icon]')) {
      return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.toggle-switch') || e.target.closest('[data-expand-icon]')) {
      return;
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.toggle-switch') || e.target.closest('[data-expand-icon]')) {
      return;
    }
    
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      // Prevent click event when swiping
      e.preventDefault();
      e.stopPropagation();
      
      // If detailed article is open, swipe left-to-right closes it
      if (showDetailedArticle && isRightSwipe) {
        setShowDetailedArticle(false);
        setSelectedArticle(null);
        return;
      }
      
      // If detailed text is showing for current article, swipe right returns to summary
      if (showDetailedText[currentIndex] && isRightSwipe) {
        setShowDetailedText(prev => ({ ...prev, [currentIndex]: false }));
        return;
      }
      
      // No more bullet/summary toggle - only detailed text navigation
    }
  };

  // Function to open detailed article
  const openDetailedArticle = (story) => {
    setSelectedArticle(story);
    setShowDetailedArticle(true);
  };

  // Function to close detailed article
  const closeDetailedArticle = () => {
    setShowDetailedArticle(false);
    setSelectedArticle(null);
  };

  // Function to toggle detailed text for current article
  const toggleDetailedText = (storyIndex) => {
    setShowDetailedText(prev => ({ ...prev, [storyIndex]: !prev[storyIndex] }));
  };

  // Helper function to count available components for a story
  const getAvailableComponentsCount = (story) => {
    let count = 0;
    if (story.details && story.details.length > 0) count++;
    if (story.timeline && story.timeline.length > 0) count++;
    if (story.map) count++;
    if (story.graph) count++;
    return count;
  };

  // Helper function to get available information types for a story
  const getAvailableInformationTypes = (story) => {
    const types = [];
    if (story.details && story.details.length > 0) types.push('details');
    if (story.timeline && story.timeline.length > 0) types.push('timeline');
    if (story.map) types.push('map');
    if (story.graph) types.push('graph');
    return types;
  };

  // Helper function to get current information type for a story
  const getCurrentInformationType = (story, index) => {
    if (showTimeline[index]) return 'timeline';
    if (showDetails[index]) return 'details';
    if (showMap[index]) return 'map';
    if (showGraph[index]) return 'graph';
    return 'details'; // default
  };

  // Helper function to switch to next information type
  const switchToNextInformationType = (story, index) => {
    const availableTypes = getAvailableInformationTypes(story);
    const currentType = getCurrentInformationType(story, index);
    const currentIndex = availableTypes.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % availableTypes.length;
    const nextType = availableTypes[nextIndex];

    // Reset all states
    setShowTimeline(prev => ({ ...prev, [index]: false }));
    setShowDetails(prev => ({ ...prev, [index]: false }));
    setShowMap(prev => ({ ...prev, [index]: false }));
    setShowGraph(prev => ({ ...prev, [index]: false }));

    // Set the new state
    switch (nextType) {
      case 'timeline':
        setShowTimeline(prev => ({ ...prev, [index]: true }));
        break;
      case 'details':
        setShowDetails(prev => ({ ...prev, [index]: true }));
        break;
      case 'map':
        setShowMap(prev => ({ ...prev, [index]: true }));
        break;
      case 'graph':
        setShowGraph(prev => ({ ...prev, [index]: true }));
        break;
    }
  };

  // Function to calculate time since published
  const getTimeAgo = (publishedAt) => {
    if (!publishedAt) return '';
    
    try {
      const publishedDate = new Date(publishedAt);
      const now = new Date();
      const diffInMs = now - publishedDate;
      const diffInMinutes = Math.floor(diffInMs / 60000);
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      if (diffInHours < 24) return `${diffInHours}h`;
      if (diffInDays < 7) return `${diffInDays}d`;
      
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks}w`;
    } catch (error) {
      return '';
    }
  };

  // Function to extract dominant color from image
  const extractDominantColor = (imgElement, storyIndex) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = imgElement.naturalWidth || imgElement.width;
      canvas.height = imgElement.naturalHeight || imgElement.height;
      
      // Draw image on canvas
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      // Sample pixels (every 10th pixel for performance)
      const colorMap = {};
      for (let i = 0; i < pixels.length; i += 40) { // RGBA, so step by 4, but sample every 10 pixels
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const alpha = pixels[i + 3];
        
        // Skip transparent or very light/dark pixels
        if (alpha < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10)) {
          continue;
        }
        
        // Round to nearest 10 to group similar colors
        const rKey = Math.round(r / 10) * 10;
        const gKey = Math.round(g / 10) * 10;
        const bKey = Math.round(b / 10) * 10;
        const key = `${rKey},${gKey},${bKey}`;
        
        colorMap[key] = (colorMap[key] || 0) + 1;
      }
      
      // Find most common color
      let maxCount = 0;
      let dominantColor = null;
      for (const [color, count] of Object.entries(colorMap)) {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = color;
        }
      }
      
      if (dominantColor) {
        const [r, g, b] = dominantColor.split(',').map(Number);
        
        // Check if the color is white (high RGB values)
        const isWhite = r > 200 && g > 200 && b > 200;
        
        if (isWhite) {
          // Use black gradient for white images
          const rgbaColor = `rgba(0, 0, 0, 1.0)`;
          const lightRgbaColor = `rgba(20, 20, 20, 1.0)`;
          setImageDominantColors(prev => ({ 
            ...prev, 
            [storyIndex]: { original: rgbaColor, light: lightRgbaColor, isWhite: true }
          }));
        } else {
          // Make the color lighter and more vibrant
          const lightR = Math.min(255, r + 40);
          const lightG = Math.min(255, g + 40);
          const lightB = Math.min(255, b + 40);
          
          const rgbaColor = `rgba(${r}, ${g}, ${b}, 1.0)`;
          const lightRgbaColor = `rgba(${lightR}, ${lightG}, ${lightB}, 1.0)`;
          
          // Store both the original and lighter versions
          setImageDominantColors(prev => ({ 
            ...prev, 
            [storyIndex]: { original: rgbaColor, light: lightRgbaColor, isWhite: false }
          }));
        }
      }
    } catch (error) {
      console.error('Error extracting dominant color:', error);
      // Fallback to dark color
      setImageDominantColors(prev => ({ 
        ...prev, 
        [storyIndex]: { original: 'rgba(0, 0, 0, 1.0)', light: 'rgba(50, 50, 50, 1.0)' }
      }));
    }
  };

  // Category color mapping system - Updated with exact brand colors
  const getCategoryColors = (category) => {
    const colorMap = {
      'World': '#1E3A8A',           // Navy Blue - International news, global affairs, foreign policy
      'Politics': '#DC2626',        // Crimson Red - Government, elections, policy, political developments
      'Business': '#059669',        // Emerald Green - Economy, markets, finance, corporate news
      'Technology': '#9333EA',      // Bright Purple - Tech industry, innovation, digital trends, gadgets
      'Science': '#06B6D4',         // Cyan - Research, discoveries, environmental issues, health studies
      'Health': '#EC4899',          // Pink - Medicine, wellness, public health, medical breakthroughs
      'Sports': '#F97316',          // Vibrant Orange - Athletics, competitions, teams, sporting events
      'Lifestyle': '#EAB308',       // Golden Yellow - Fashion, food, travel, home, personal interest
      // Legacy/fallback categories
      'Breaking News': '#DC2626',   // Use Politics color
      'Environment': '#06B6D4',     // Use Science color
      'General': '#1E3A8A'          // Use World color
    };
    
    const baseColor = colorMap[category] || '#1E3A8A'; // Default to Navy Blue (World)
    
    // Helper function to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    return {
      primary: baseColor,
      light: hexToRgba(baseColor, 0.2),    // 20% opacity for lighter version
      lighter: hexToRgba(baseColor, 0.15), // 15% opacity for even lighter version (category badge background)
      shadow: hexToRgba(baseColor, 0.3)    // 30% opacity for shadow
    };
  };

  // Initialize default component display
  useEffect(() => {
    if (stories.length > 0) {
      const newShowDetails = {};
      stories.forEach((story, index) => {
        // Set default to details if available, otherwise timeline, otherwise map, otherwise graph
        if (story.details && story.details.length > 0) {
          newShowDetails[index] = true;
        } else if (story.timeline && story.timeline.length > 0) {
          setShowTimeline(prev => ({ ...prev, [index]: true }));
        } else if (story.map) {
          setShowMap(prev => ({ ...prev, [index]: true }));
        } else if (story.graph) {
          setShowGraph(prev => ({ ...prev, [index]: true }));
        }
      });
      setShowDetails(newShowDetails);
    }
  }, [stories]); 

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
  const [supabase] = useState(() => {
    if (typeof window === 'undefined') return null;
    return createClient();
  });

  // Check authentication status on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
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
    console.log('🔄 useEffect starting...');
    const loadNewsData = async () => {
      try {
        console.log('📡 About to fetch API...');
        const response = await fetch(`/api/news?t=${Date.now()}`);
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
          const newsData = await response.json();
          console.log('📰 API Response:', newsData);
          console.log('📰 Articles count:', newsData.articles?.length);
          
          if (newsData.articles && newsData.articles.length > 0) {
            // Create opening story
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
            
            const processedStories = [openingStory];
            
             // Convert articles to story format
             newsData.articles.forEach((article, index) => {
               const storyData = {
                 type: 'news',
                 number: article.rank || (index + 1),
                 category: (article.category || 'WORLD NEWS').toUpperCase(),
                 emoji: article.emoji || '📰',
                 title: article.title || 'News Story',
                 detailed_text: article.detailed_text || 'Article text will appear here.',
                 summary_bullets: article.summary_bullets || [],
                 details: article.details || [],
                 source: article.source || 'Today+',
                 url: article.url || '#',
                urlToImage: (article.urlToImage && article.urlToImage.trim() !== '') ? article.urlToImage.trim() : null,
                 timeline: article.timeline && article.timeline.length > 0 ? article.timeline : [
                   {"date": "Background", "event": "Initial situation develops"},
                   {"date": "Today", "event": "Major developments break"},
                   {"date": "Next week", "event": "Follow-up expected"}
                 ],
                 publishedAt: article.publishedAt || article.published_at || article.added_at,
                 id: article.id || `article_${index}`
               };
               
               processedStories.push(storyData);
             });
            
            console.log('📰 Setting stories:', processedStories.length);
            setStories(processedStories);
            console.log('📰 Stories set successfully');
          } else {
            console.log('📰 No articles found in response');
            setStories([]);
          }
        } else {
          console.log('📡 Response not ok:', response.status);
          setStories([]);
        }
      } catch (error) {
        console.error('Error loading news:', error);
        setStories([]);
      } finally {
        console.log('📰 Setting loading to false');
        setLoading(false);
      }
    };
    
    loadNewsData();
  }, []);

  const goToStory = (index) => {
    if (index >= 0 && index < stories.length) {
      setCurrentIndex(index);
      setMenuOpen(false);
      
      // Mark article as read when user navigates to it
      const story = stories[index];
      if (story && story.type === 'news' && story.id && user) {
        markArticleAsRead(story.id);
      }
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

  // Summary display mode toggle function - per story
  const toggleSummaryDisplayMode = (storyIndex) => {
    setShowBulletPoints(prev => ({
      ...prev,
      [storyIndex]: !prev[storyIndex]
    }));
    console.log(`🔄 Toggling summary display mode for story ${storyIndex}`);
  };

  // Dark mode toggle function
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Mark article as read
  const markArticleAsRead = async (articleId) => {
    if (!user || !articleId) return;
    
    try {
      const response = await fetch('/api/reading-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId }),
      });

      if (response.ok) {
        setReadArticles(prev => new Set([...prev, articleId]));
      }
    } catch (error) {
      console.error('Error marking article as read:', error);
    }
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

  // Helper: produce a much darker color from an rgba/rgb blur color
  const getDarkerFromBlurColor = (blurColor) => {
    if (!blurColor) return null;
    const match = blurColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    // Darken strongly (keep it readable on light images)
    const factor = 0.35; // 35% of original brightness
    const R = Math.max(0, Math.min(255, Math.round(r * factor)));
    const G = Math.max(0, Math.min(255, Math.round(g * factor)));
    const B = Math.max(0, Math.min(255, Math.round(b * factor)));
    return `rgb(${R}, ${G}, ${B})`;
  };

  // Function to render text with highlighted important words (for bullet texts - bold + colored)
  const renderBoldText = (text, blurColor) => {
    if (!text) return '';
    if (!blurColor) {
      // Fallback: just remove ** markers
      return text.replace(/\*\*/g, '');
    }
    
    // Extract color from rgba string (convert rgba(r, g, b, a) to rgb)
    const colorMatch = blurColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (colorMatch) {
      const highlightColor = getDarkerFromBlurColor(blurColor) || 'rgb(30,30,30)';
      
      // Replace **text** with bold and colored spans
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.replace(/\*\*/g, '');
          return (
            <span key={i} style={{ fontWeight: '700', color: highlightColor }}>
              {content}
            </span>
          );
        }
        return part;
      });
    }
    return text.replace(/\*\*/g, '');
  };

  // Function to render title with highlighted important words (colored but not bold)
  const renderTitleWithHighlight = (text, blurColor) => {
    if (!text) return '';
    if (!blurColor) {
      return text;
    }
    
    // Extract color from rgba string
    const colorMatch = blurColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (colorMatch) {
      const highlightColor = getDarkerFromBlurColor(blurColor) || 'rgb(30,30,30)';
      
      // Replace **text** with colored (but not bold) spans
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.replace(/\*\*/g, '');
          return (
            <span key={i} style={{ color: highlightColor }}>
              {content}
            </span>
          );
        }
        return part;
      });
    }
    return text;
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
      
      // Block navigation if article is open
      const isArticleOpen = showDetailedText[currentIndex];
      if (isArticleOpen) {
        return; // Don't allow story navigation when article is open
      }
      
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
      
      // Block navigation if article is open
      const isArticleOpen = showDetailedText[currentIndex];
      if (isArticleOpen) {
        return; // Don't allow story navigation when article is open
      }
      
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

      // Block navigation if article is open
      const isArticleOpen = showDetailedText[currentIndex];
      if (isArticleOpen && (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        return; // Don't allow story navigation when article is open
      }

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
      } else if (e.key === 's' || e.key === 'S') {
        // Toggle summary/bullet points with 'S' key
        e.preventDefault();
        const currentStory = stories[currentIndex];
        if (currentStory && currentStory.type === 'news') {
          toggleSummaryDisplayMode(currentIndex);
        }
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
  }, [currentIndex, stories.length, showDetailedText, user]);

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

  console.log('🏠 Current state - loading:', loading, 'stories:', stories.length);
  
  // Temporary debug - force loading to false if stories exist
  if (stories.length > 0 && loading) {
    console.log('🔧 Debug: Forcing loading to false');
    setLoading(false);
  }
  
  // Temporary debug - show current state
  console.log('🔧 Debug: Current state - loading:', loading, 'stories:', stories.length);
  
  // Emergency fallback - if loading takes too long, show something
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && stories.length === 0) {
        console.log('🔧 Emergency: Setting loading to false after timeout');
        setLoading(false);
      }
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, [loading, stories.length]);
  
  // Force loading to false if we have stories but still loading
  useEffect(() => {
    if (stories.length > 0 && loading) {
      console.log('🔧 Force: Setting loading to false because stories exist');
      setLoading(false);
    }
  }, [stories.length, loading]);
  
  // Additional safety check - force render if we have data
  useEffect(() => {
    if (stories.length > 0) {
      console.log('🔧 Safety: Stories exist, ensuring loading is false');
      setLoading(false);
    }
  }, [stories.length]);
  
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
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
          font-size: 48px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.5px;
          margin-bottom: 20px;
          color: ${darkMode ? '#ffffff' : '#000000'};
        }

        .news-summary {
          font-size: 16px;
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
          border-top: 1px solid #e5e5e5;
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
          color: #666666;
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
          width: 1px;
          background: #cccccc;
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

        @keyframes slideInFromBottom {
          0% {
            opacity: 0;
            transform: translateY(100vh);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .timeline-item::before {
          content: '';
          position: absolute;
          left: -14px;
          top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #000000;
          z-index: 1;
        }

        .timeline-item:last-child::before {
          background: #000000;
        }

        .timeline-date {
          font-size: 11px;
          font-weight: 600;
          color: #666666;
          margin-bottom: 4px;
        }

        .timeline-event {
          font-size: 14px;
          color: #000000;
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

        .summary-mode-indicator {
          position: absolute;
          top: '-8px';
          right: '12px';
          font-size: '9px';
          color: '#3b82f6';
          font-weight: '600';
          text-transform: 'uppercase';
          letter-spacing: '0.5px';
          opacity: '0.8';
          background: 'rgba(59, 130, 246, 0.1)';
          padding: '2px 6px';
          borderRadius: '4px';
        }

        .summary-content {
          transition: opacity 0.3s ease-in-out;
        }

        .summary-content.switching {
          opacity: 0.7;
        }

        .news-meta {
          position: relative;
        }

        .toggle-switch {
          display: flex;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 6px;
          padding: 2px;
          gap: 2px;
        }

        .toggle-option {
          background: none;
          border: none;
          padding: 5px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 24px;
        }

        .toggle-option.active {
          background: #ffffff;
        }

        .toggle-option.active .grid-square,
        .toggle-option.active .list-dot,
        .toggle-option.active .list-bar {
          background: #000000;
        }

        .grid-icon {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          width: 14px;
          height: 14px;
        }

        .grid-square {
          background: #666666;
          border-radius: 1px;
        }

        .list-icon {
          display: flex;
          flex-direction: column;
          gap: 2px;
          width: 14px;
          height: 14px;
        }

        .list-line {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .list-dot {
          width: 2px;
          height: 2px;
          background: #666666;
          border-radius: 50%;
        }

        .list-bar {
          width: 8px;
          height: 1px;
          background: #666666;
          border-radius: 1px;
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
            background: #ffffff;
            border: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
              Today<span className="logo-ten">+</span>
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
                  
                    {/* Original News Item View - Everything stays the same */}
                    <div className="news-item" style={{ overflow: 'visible', padding: 0, position: 'relative' }} onClick={() => {
                      // Toggle detailed text to show article under summary
                      toggleDetailedText(index);
                    }}>
                    {/* News Image - Full Screen */}
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      width: '100vw',
                      height: '38vh',
                      margin: 0,
                      padding: 0,
                      background: story.urlToImage ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: '1',
                      borderRadius: 0,
                      overflow: 'hidden'
                    }}>
                      {(story.urlToImage && story.urlToImage.trim() !== '') ? (
                        <img 
                          key={`img-${story.id || index}-${story.urlToImage}`}
                          src={getSafeImageUrl(story.urlToImage)}
                          alt={story.title}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center'
                          }}
                          onLoad={(e) => {
                            console.log('✅ Image loaded successfully:', story.urlToImage);
                            extractDominantColor(e.target, index);
                          }}
                          onError={(e) => {
                            console.error('❌ Image failed to load:', story.urlToImage);
                            console.error('   Story title:', story.title);
                            // Try proxy fallback once if not already attempted
                            if (!e.target.dataset.proxied && story.urlToImage) {
                              const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(story.urlToImage.trim())}`;
                              e.target.dataset.proxied = '1';
                              e.target.src = proxied;
                              return;
                            }
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
                      
                      {/* Title Overlay with Image-Based Color Gradient - Starts from Top */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '24px 16px 20px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        background: imageDominantColors[index]?.light 
                          ? `linear-gradient(to bottom, 
                              ${imageDominantColors[index].light.replace('1.0', '0.15')} 0%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.25')} 10%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.45')} 30%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.65')} 50%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.85')} 70%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.95')} 80%, 
                              ${imageDominantColors[index].light.replace('1.0', '0.98')} 90%, 
                              ${imageDominantColors[index].light} 95%, 
                              ${imageDominantColors[index].light} 100%)`
                          : imageDominantColors[index]?.original
                          ? `linear-gradient(to bottom, 
                              ${imageDominantColors[index].original.replace('1.0', '0.18')} 0%, 
                              ${imageDominantColors[index].original.replace('1.0', '0.35')} 15%, 
                              ${imageDominantColors[index].original.replace('1.0', '0.55')} 40%, 
                              ${imageDominantColors[index].original.replace('1.0', '0.75')} 65%, 
                              ${imageDominantColors[index].original.replace('1.0', '0.88')} 80%, 
                              ${imageDominantColors[index].original.replace('1.0', '0.95')} 90%, 
                              ${imageDominantColors[index].original} 100%)`
                          : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.4) 35%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.93) 90%, rgba(0,0,0,0.98) 95%, rgba(0,0,0,1.0) 100%)',
                        zIndex: 2
                      }}>
                        <h3 style={{ 
                          margin: 0,
                          fontSize: '22px',
                          fontWeight: '800',
                          lineHeight: '1.2',
                          letterSpacing: '-0.5px',
                          color: '#ffffff'
                         }}>{renderTitleWithHighlight(story.title, imageDominantColors[index]?.light || imageDominantColors[index]?.original)}</h3>
                      </div>
                    </div>
                    
                    {/* Content Area - Starts After Image */}
                      <div className="news-content" style={{
                        position: 'relative',
                        paddingTop: 'calc(38vh + 8px)',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        zIndex: '2'
                      }}>
                      
                      {/* Time Since Published and Timeline Button Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2px',
                        marginTop: '0'
                      }}>
                        {/* Time Since Published - Minimal Design */}
                        {story.publishedAt && (
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '400',
                            color: '#86868b',
                            letterSpacing: '0.3px'
                          }}>
                            {getTimeAgo(story.publishedAt)}
                          </div>
                        )}

                        {/* Dynamic Information Switch - Only show if multiple information types available */}
                        {getAvailableComponentsCount(story) > 1 && (
                          <div className="toggle-switch">
                            {getAvailableInformationTypes(story).map((infoType, buttonIndex) => {
                              const isActive = getCurrentInformationType(story, index) === infoType;
                              return (
                                <button
                                  key={infoType}
                                  className={`toggle-option ${isActive ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log(`${infoType} option clicked for story`, index);
                                    
                                    // Reset all states
                                    setShowTimeline(prev => ({ ...prev, [index]: false }));
                                    setShowDetails(prev => ({ ...prev, [index]: false }));
                                    setShowMap(prev => ({ ...prev, [index]: false }));
                                    setShowGraph(prev => ({ ...prev, [index]: false }));

                                    // Set the selected state
                                    switch (infoType) {
                                      case 'timeline':
                                        setShowTimeline(prev => ({ ...prev, [index]: true }));
                                        break;
                                      case 'details':
                                        setShowDetails(prev => ({ ...prev, [index]: true }));
                                        break;
                                      case 'map':
                                        setShowMap(prev => ({ ...prev, [index]: true }));
                                        break;
                                      case 'graph':
                                        setShowGraph(prev => ({ ...prev, [index]: true }));
                                        break;
                                    }
                                  }}
                                >
                                  {infoType === 'details' && (
                                    <div className="grid-icon">
                                      <div className="grid-square"></div>
                                      <div className="grid-square"></div>
                                      <div className="grid-square"></div>
                                      <div className="grid-square"></div>
                                    </div>
                                  )}
                                  {infoType === 'timeline' && (
                                    <div className="list-icon">
                                      <div className="list-line">
                                        <div className="list-dot"></div>
                                        <div className="list-bar"></div>
                                      </div>
                                      <div className="list-line">
                                        <div className="list-dot"></div>
                                        <div className="list-bar"></div>
                                      </div>
                                      <div className="list-line">
                                        <div className="list-dot"></div>
                                        <div className="list-bar"></div>
                                      </div>
                                    </div>
                                  )}
                                  {infoType === 'map' && (
                                    <div className="map-icon" style={{
                                      width: '14px',
                                      height: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <div style={{
                                        width: '10px',
                                        height: '10px',
                                        border: `2px solid ${isActive ? '#000000' : '#666666'}`,
                                        borderRadius: '50%',
                                        position: 'relative'
                                      }}>
                                        <div style={{
                                          position: 'absolute',
                                          top: '50%',
                                          left: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          width: '4px',
                                          height: '4px',
                                          background: isActive ? '#000000' : '#666666',
                                          borderRadius: '50%'
                                        }}></div>
                                      </div>
                                    </div>
                                  )}
                                  {infoType === 'graph' && (
                                    <div className="graph-icon" style={{
                                      width: '14px',
                                      height: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <div style={{
                                        width: '12px',
                                        height: '8px',
                                        display: 'flex',
                                        alignItems: 'end',
                                        gap: '1px'
                                      }}>
                                        <div style={{
                                          width: '2px',
                                          height: '3px',
                                          background: isActive ? '#000000' : '#666666',
                                          borderRadius: '1px'
                                        }}></div>
                                        <div style={{
                                          width: '2px',
                                          height: '6px',
                                          background: isActive ? '#000000' : '#666666',
                                          borderRadius: '1px'
                                        }}></div>
                                        <div style={{
                                          width: '2px',
                                          height: '4px',
                                          background: isActive ? '#000000' : '#666666',
                                          borderRadius: '1px'
                                        }}></div>
                                        <div style={{
                                          width: '2px',
                                          height: '8px',
                                          background: isActive ? '#000000' : '#666666',
                                          borderRadius: '1px'
                                        }}></div>
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* Summary/Bullet Points - Swipeable */}
                      <div 
                        className="news-summary" 
                        style={{ 
                          marginTop: '0',
                          marginBottom: '16px',
                          fontSize: '16px',
                          lineHeight: '1.6',
                          color: '#4a4a4a',
                          opacity: '1',
                          minHeight: '60px',
                          padding: '8px 0',
                          position: 'relative'
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
                              if (diffX > diffY && diffX > 50) {
                                swipeDirection = 'horizontal';
                                moveEvent.preventDefault();
                                moveEvent.stopPropagation();
                              } else if (diffY > diffX && diffY > 30) {
                                swipeDirection = 'vertical';
                              }
                            }
                          };
                          
                          const handleTouchEnd = (endEvent) => {
                            const endX = endEvent.changedTouches[0].clientX;
                            const diffX = Math.abs(startX - endX);
                            
                            // Only handle horizontal swipes for summary/bullet points toggle
                            if (hasMoved && swipeDirection === 'horizontal' && diffX > 50) {
                              console.log('Horizontal summary swipe detected for story', index);
                              endEvent.preventDefault();
                              endEvent.stopPropagation();
                              toggleSummaryDisplayMode(index);
                            }
                            
                            // Clean up listeners
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                          };
                          
                          document.addEventListener('touchmove', handleTouchMove, { passive: false });
                          document.addEventListener('touchend', handleTouchEnd, { passive: false });
                        }}
                      >
                        <div 
                          className="summary-content"
                          onTouchStart={onTouchStart}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Summary Header */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px'
                          }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
                              <path d="M4 4h8M4 8h8M4 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span style={{
                              fontSize: '15px',
                              fontWeight: '700',
                              letterSpacing: '0.3px',
                              color: '#1a1a1a',
                              textTransform: 'none'
                            }}><span style={{ fontSize: '15px' }}>S</span><span style={{ fontSize: '15px', textTransform: 'uppercase' }}>ummary</span></span>
                          </div>
                          
                          {/* Show Only Bullet Text */}
                          <div style={{ margin: 0 }}>
                            {story.summary_bullets && story.summary_bullets.length > 0 ? (
                              <ul style={{
                                margin: 0,
                                paddingLeft: '20px',
                                listStyleType: 'disc'
                              }}>
                                {story.summary_bullets.map((bullet, i) => (
                                  <li key={i} style={{
                                    marginBottom: '8px',
                                    fontSize: '16px',
                                    lineHeight: '1.6',
                                    fontWeight: '400',
                                    color: '#1a1a1a',
                                    fontFamily: 'Georgia, "Times New Roman", Times, serif'
                                  }}>
                                    {renderBoldText(bullet, imageDominantColors[index]?.light || imageDominantColors[index]?.original)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
                                No bullet points available
                              </p>
                            )}
                          </div>
                          
                          {/* Show Detailed Article Text Below Bullets - Scrollable */}
                          {showDetailedText[index] && (
                            <div 
                              style={{
                                marginTop: '16px',
                                marginBottom: '100px',
                                fontSize: '16px',
                                lineHeight: '1.8',
                                color: '#1a1a1a',
                                opacity: 1,
                                transform: 'translateY(0)',
                                transition: 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                animation: 'slideInFromBottom 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                              }}
                              onTouchStart={(e) => {
                                const startX = e.touches[0].clientX;
                                const startY = e.touches[0].clientY;
                                let hasMoved = false;
                                
                                const handleTouchMove = (moveEvent) => {
                                  const currentX = moveEvent.touches[0].clientX;
                                  const diffX = Math.abs(currentX - startX);
                                  const diffY = Math.abs(moveEvent.touches[0].clientY - startY);
                                  
                                  if (diffX > 10 || diffY > 10) {
                                    hasMoved = true;
                                  }
                                };
                                
                                const handleTouchEnd = (endEvent) => {
                                  const endX = endEvent.changedTouches[0].clientX;
                                  const diffX = endX - startX;
                                  
                                  // Swipe right to close article
                                  if (hasMoved && diffX > 100) {
                                    endEvent.preventDefault();
                                    endEvent.stopPropagation();
                                    toggleDetailedText(index); // Close article
                                  }
                                  
                                  document.removeEventListener('touchmove', handleTouchMove);
                                  document.removeEventListener('touchend', handleTouchEnd);
                                };
                                
                                document.addEventListener('touchmove', handleTouchMove, { passive: false });
                                document.addEventListener('touchend', handleTouchEnd, { passive: false });
                              }}
                            >
                              <div dangerouslySetInnerHTML={{
                                __html: story.detailed_text
                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  .split('. ')
                                  .reduce((acc, sentence, i, arr) => {
                                    // Group every 2-3 sentences into a paragraph
                                    if (i % 3 === 0) {
                                      const paragraph = arr.slice(i, i + 3).join('. ') + (i + 3 < arr.length ? '.' : '');
                                      return acc + '<p style="margin-bottom: 16px; text-align: justify;">' + paragraph + '</p>';
                                    } else if (i % 3 === 1 && i === arr.length - 1) {
                                      return acc + '<p style="margin-bottom: 16px; text-align: justify;">' + sentence + '</p>';
                                    }
                                    return acc;
                                  }, '')
                              }} />
                            </div>
                          )}
                        </div>
                        
                      </div>
                      
                      {/* Fixed Position Toggle and Content Area - Lower Position */}
                      <div style={{
                        position: showDetailedText[index] ? 'relative' : 'fixed',
                        bottom: showDetailedText[index] ? 'auto' : '32px',
                        left: showDetailedText[index] ? '0' : '50%',
                        transform: showDetailedText[index] ? 'none' : 'translateX(-50%)',
                        width: '100%',
                        maxWidth: showDetailedText[index] ? '950px' : '950px',
                        paddingLeft: '15px',
                        paddingRight: '15px',
                        zIndex: '50',
                        marginTop: showDetailedText[index] ? '0' : '0',
                        marginLeft: showDetailedText[index] ? 'auto' : '0',
                        marginRight: showDetailedText[index] ? 'auto' : '0'
                      }}>
                        
                        {/* Details/Timeline Section - At end of article when detailed text is showing */}
                        <div 
                          className="news-meta" 
                        style={{ 
                          position: 'relative', 
                          overflow: 'visible', 
                          cursor: getAvailableComponentsCount(story) > 1 ? 'pointer' : 'default',
                          minHeight: '85px',
                          height: showTimeline[index] ? (expandedTimeline[index] ? 'auto' : '85px') : '85px',
                          maxHeight: showTimeline[index] ? (expandedTimeline[index] ? '300px' : '85px') : '85px',
                          background: showTimeline[index] ? 'transparent' : '#ffffff',
                          backdropFilter: showTimeline[index] ? 'none' : 'none',
                          WebkitBackdropFilter: showTimeline[index] ? 'none' : 'none',
                            border: 'none',
                            borderRadius: showTimeline[index] ? '0' : '8px',
                            boxShadow: showTimeline[index] ? 'none' : `0 2px 8px ${getCategoryColors(story.category).shadow}`
                        }}
                        onTouchStart={(e) => {
                          // Only handle if there are multiple information types
                          if (getAvailableComponentsCount(story) <= 1) return;
                          
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
                            
                            // Only handle horizontal swipes for information switching
                            if (hasMoved && swipeDirection === 'horizontal' && Math.abs(diffX) > 25) {
                              console.log('Horizontal information swipe detected for story', index);
                              endEvent.preventDefault();
                              endEvent.stopPropagation();
                              switchToNextInformationType(story, index);
                            } else if (!hasMoved) {
                              // Check if the touch target is the expand icon
                              const touchTarget = endEvent.target;
                              const isExpandIcon = touchTarget.closest('[data-expand-icon]');
                              
                              if (!isExpandIcon) {
                                // Single tap switches information type
                                console.log('Information box tap detected for story', index);
                                endEvent.preventDefault();
                                endEvent.stopPropagation();
                                switchToNextInformationType(story, index);
                              }
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
                        {/* Content - Show one component at a time */}
                        {showDetails[index] ? (
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
                              <div className="news-detail-value" style={{ color: getCategoryColors(story.category).primary }}>{mainValue}</div>
                              {subtitle && <div className="news-detail-subtitle">{subtitle}</div>}
                            </div>
                          );
                          })
                        ) : showTimeline[index] ? (
                          // Show Timeline Only - Grows upward from bottom
                          story.timeline && (
                            <div 
                              className="timeline-container-desktop"
                              style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                height: expandedTimeline[index] ? '300px' : '85px',
                                maxHeight: expandedTimeline[index] ? '300px' : '85px',
                                transition: 'height 0.3s ease-in-out',
                                background: '#ffffff',
                                backdropFilter: 'none',
                                WebkitBackdropFilter: 'none',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 20px 12px 20px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                minHeight: '85px',
                                zIndex: '10',
                                overflowY: expandedTimeline[index] ? 'visible' : 'auto'
                              }}>
                               {/* Expand Icon */}
                               <div 
                                 data-expand-icon="true"
                                 style={{
                                 position: 'absolute',
                                 top: '8px',
                                 right: '8px',
                                 width: '28px',
                                 height: '28px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 cursor: 'pointer',
                                 zIndex: '20',
                                 transition: 'all 0.2s ease'
                               }}
                               onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 console.log('Expand icon clicked for story', index);
                                 setExpandedTimeline(prev => ({
                                   ...prev,
                                   [index]: !prev[index]
                                 }));
                               }}
                               onTouchEnd={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 console.log('Expand icon touched for story', index);
                                 setExpandedTimeline(prev => ({
                                   ...prev,
                                   [index]: !prev[index]
                                 }));
                               }}>
                                 <span style={{
                                   fontSize: '18px',
                                   fontWeight: 'bold',
                                   color: '#666',
                                   transform: expandedTimeline[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                                   transition: 'transform 0.2s ease'
                                 }}>
                                   ↗
                                 </span>
                               </div>
                              
                              <div style={{
                                position: 'relative',
                                height: '100%',
                                overflowY: expandedTimeline[index] ? 'visible' : 'auto',
                                paddingRight: '8px',
                                paddingLeft: '20px',
                                paddingTop: '0px',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '5.5px',
                                  top: '0px',
                                  bottom: '8px',
                                  width: '3px',
                                  background: 'linear-gradient(180deg, #3b82f6, #93c5fd)',
                                  zIndex: '0',
                                  borderRadius: '2px'
                                }}></div>
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start',
                                  height: '100%',
                                  paddingTop: '0px',
                                  paddingBottom: '8px'
                                }}>
                                  {story.timeline.map((event, idx) => (
                                    <div key={idx} style={{
                                      position: 'relative',
                                      marginBottom: '12px',
                                      paddingLeft: '20px',
                                      minHeight: '36px',
                                      marginTop: idx === 0 ? '0px' : '0px'
                                    }}>
                                    <div style={{
                                      position: 'absolute',
                                      left: '-15px',
                                      top: '0px',
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: idx === story.timeline.length - 1 ? '#3b82f6' : 'white',
                                      border: '2.5px solid #3b82f6',
                                      zIndex: '2',
                                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                                    }}></div>
                                    <div style={{
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      color: '#3b82f6',
                                      marginBottom: '3px',
                                      letterSpacing: '0.3px',
                                      marginTop: '0px'
                                    }}>{event.date}</div>
                                    <div style={{
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      color: darkMode ? '#e2e8f0' : '#1e293b',
                                      lineHeight: '1.3',
                                      marginTop: '0px'
                                    }}>{event.event}</div>
                                  </div>
                                ))}
                                </div>
                              </div>
                            </div>
                          )
                        ) : showMap[index] ? (
                          // Show Map Only
                          story.map && (
                            <div 
                              className="map-container"
                              style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                height: '200px',
                                background: '#ffffff',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                zIndex: '10',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                flexDirection: 'column'
                              }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '8px'
                              }}>📍 Location Map</div>
                              <div style={{
                                    width: '100%',
                                height: '150px',
                                background: '#f8fafc',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                border: '1px solid #e2e8f0',
                                color: '#64748b',
                                fontSize: '12px'
                              }}>
                                Map visualization for: {story.map.center?.lat?.toFixed(2)}, {story.map.center?.lon?.toFixed(2)}
                                  </div>
                            </div>
                          )
                        ) : showGraph[index] ? (
                          // Show Graph Only
                          story.graph && (
                            <div 
                              className="graph-container"
                              style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                height: '200px',
                                background: '#ffffff',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                zIndex: '10',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                flexDirection: 'column'
                              }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '8px'
                              }}>📊 Data Visualization</div>
                                    <div style={{
                                      width: '100%',
                                height: '150px',
                                background: '#f8fafc',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                border: '1px solid #e2e8f0',
                                color: '#64748b',
                                fontSize: '12px'
                              }}>
                                Graph visualization for: {story.graph.title || 'Data Trends'}
                              </div>
                            </div>
                          )
                        ) : null}
                        
                  </div>
                      
                      {/* Component Navigation Dots - Only show if multiple components available */}
                      {getAvailableComponentsCount(story) > 1 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '14px'
                        }}>
                          {/* Details Dot */}
                          {story.details && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDetails(prev => ({ ...prev, [index]: true }));
                                setShowTimeline(prev => ({ ...prev, [index]: false }));
                                setShowMap(prev => ({ ...prev, [index]: false }));
                                setShowGraph(prev => ({ ...prev, [index]: false }));
                              }}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: showDetails[index] 
                                  ? 'rgba(0, 0, 0, 0.6)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            />
                          )}
                          
                          {/* Timeline Dot */}
                          {story.timeline && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDetails(prev => ({ ...prev, [index]: false }));
                                setShowTimeline(prev => ({ ...prev, [index]: true }));
                                setShowMap(prev => ({ ...prev, [index]: false }));
                                setShowGraph(prev => ({ ...prev, [index]: false }));
                              }}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: showTimeline[index] 
                                  ? 'rgba(0, 0, 0, 0.6)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            />
                          )}

                          {/* Map Dot */}
                          {story.map && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDetails(prev => ({ ...prev, [index]: false }));
                                setShowTimeline(prev => ({ ...prev, [index]: false }));
                                setShowMap(prev => ({ ...prev, [index]: true }));
                                setShowGraph(prev => ({ ...prev, [index]: false }));
                              }}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: showMap[index] 
                                  ? 'rgba(0, 0, 0, 0.6)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            />
                          )}

                          {/* Graph Dot */}
                          {story.graph && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDetails(prev => ({ ...prev, [index]: false }));
                                setShowTimeline(prev => ({ ...prev, [index]: false }));
                                setShowMap(prev => ({ ...prev, [index]: false }));
                                setShowGraph(prev => ({ ...prev, [index]: true }));
                              }}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: showGraph[index] 
                                  ? 'rgba(0, 0, 0, 0.6)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            />
                          )}
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
                <h2>{authModal === 'login' ? 'Login to Today+' : 'Create Your Account'}</h2>
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

        {/* Detailed Article Overlay */}
        {showDetailedArticle && selectedArticle && (
          <div 
            className="detailed-article-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Header with close button */}
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 1001
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: getCategoryColors(selectedArticle.category).lighter,
                  color: getCategoryColors(selectedArticle.category).primary
                }}>
                  {selectedArticle.emoji} {selectedArticle.category}
                </div>
              </div>
              
              <button
                onClick={closeDetailedArticle}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '18px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              color: 'white'
            }}>
              {/* Article title */}
              <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                lineHeight: '1.3',
                margin: '0 0 20px 0',
                color: 'white'
              }}>
                {selectedArticle.title}
              </h1>

              {/* Detailed article text */}
              <div style={{
                fontSize: '16px',
                lineHeight: '1.6',
                marginBottom: '30px',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>
                <div dangerouslySetInnerHTML={{
                  __html: selectedArticle.detailed_text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }} />
              </div>

              {/* Additional components if available */}
              {selectedArticle.timeline && selectedArticle.timeline.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: 'white',
                    borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    Timeline
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedArticle.timeline.map((event, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'rgba(255, 255, 255, 0.7)',
                          minWidth: '80px',
                          flexShrink: 0
                        }}>
                          {event.date}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          lineHeight: '1.4',
                          color: 'rgba(255, 255, 255, 0.9)'
                        }}>
                          {event.event}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedArticle.details && selectedArticle.details.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: 'white',
                    borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    Key Details
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedArticle.details.map((detail, index) => (
                      <div key={index} style={{
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px'
                      }}>
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Swipe instruction */}
              <div style={{
                textAlign: 'center',
                marginTop: '40px',
                padding: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                Swipe left to right to return to articles
              </div>
            </div>
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
}// Force deployment - Thu Oct 23 15:14:36 BST 2025

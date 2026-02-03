import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { createClient } from '../lib/supabase';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import NewFirstPage from '../components/NewFirstPage';
import TodayPlusLoader from '../components/TodayPlusLoader';
import dynamic from 'next/dynamic';
import ReadArticleTracker from '../utils/ReadArticleTracker';
import { sortArticlesByScore } from '../utils/sortArticles';
import { 
  getUserInterests, 
  updateInterests, 
  // rankArticles,  // DISABLED: Personalization ranking disabled - articles sorted by score only
  getEngagementWeight,
  decayOldInterests,
  syncInterestsToSupabase,
  incrementArticlesRead
} from '../utils/userInterests';

// Dynamically import GraphChart to avoid SSR issues
const GraphChart = dynamic(() => import('../components/GraphChart'), {
    ssr: false,
  loading: () => <div style={{ padding: '10px' }}>Loading chart...</div>
  });


// Dynamically import MapboxMap to avoid SSR issues
const MapboxMap = dynamic(() => import('../components/MapboxMap'), {
    ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: 'rgba(245,245,245,0.95)', borderRadius: '8px' }} />
  });

export default function Home({ initialNews, initialWorldEvents }) {
  // Use initial data from SSR if available, otherwise start empty
  const [stories, setStories] = useState(initialNews?.stories || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(!initialNews?.stories?.length);
  
  // TikTok-style smooth swipe states
  const [dragOffset, setDragOffset] = useState(0);  // Current drag position (px)
  const [isDragging, setIsDragging] = useState(false);  // Is user currently dragging
  const [swipeVelocity, setSwipeVelocity] = useState(0);  // Velocity for spring animation
  const [transitionDuration, setTransitionDuration] = useState(0.4);  // Dynamic transition duration
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState({});
  const [showDetails, setShowDetails] = useState({});
  const [showMap, setShowMap] = useState({});
  const [showGraph, setShowGraph] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('morning'); // Default to avoid hydration mismatch
  
  // 10 random colors for the + icon
  const plusIconColors = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#0ea5e9', // Sky Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
  ];
  const [plusColor] = useState(() => plusIconColors[Math.floor(Math.random() * plusIconColors.length)]);
  const [readArticles, setReadArticles] = useState(new Set());
  const [expandedTimeline, setExpandedTimeline] = useState({});
  const [expandedGraph, setExpandedGraph] = useState({});
  const [expandedMap, setExpandedMap] = useState({});
  const [showBulletPoints, setShowBulletPoints] = useState({});
  // Removed globalShowBullets - only showing summary text now
  const [showDetailedArticle, setShowDetailedArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showDetailedText, setShowDetailedText] = useState({}); // Track which articles show detailed text
  const [imageDominantColors, setImageDominantColors] = useState({}); // Store dominant color for each image
  const [loadedImages, setLoadedImages] = useState(new Set()); // Track which images have successfully loaded
  const [sharedArticleId, setSharedArticleId] = useState(null); // Track shared article from URL parameter
  const [sharedArticleData, setSharedArticleData] = useState(null); // The actual shared article data
  const [pendingNavigation, setPendingNavigation] = useState(null); // Track pending navigation to shared article index
  
  // Pagination state for loading articles in batches
  // MAX_ARTICLES prevents memory issues with 600+ articles
  const MAX_ARTICLES_IN_MEMORY = 150;
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreArticles, setHasMoreArticles] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalArticles, setTotalArticles] = useState(0);
  
  // Auto-rotation state for information boxes
  const [autoRotationEnabled, setAutoRotationEnabled] = useState({}); // Track which articles have auto-rotation active
  const [progressBarKey, setProgressBarKey] = useState({}); // Track progress bar resets
  
  // Engagement tracking state
  const [articleViewStart, setArticleViewStart] = useState(null); // Timestamp when current article started
  const [engagedSent, setEngagedSent] = useState({}); // Track which articles have had 'engaged' event sent
  const [maxScrollPercent, setMaxScrollPercent] = useState(0); // Max scroll depth on current article
  
  // Read article tracker (localStorage-based)
  const readTrackerRef = useRef(null);
  
  // Track if we've already handled the shared article navigation (prevent race conditions)
  const sharedArticleHandledRef = useRef(false);
  // Store the shared article ID in a ref for immediate access (avoids React state timing issues)
  const sharedArticleIdRef = useRef(null);
  // Store stories in a ref so we can access latest value in intervals/callbacks
  const storiesRef = useRef([]);

  // Language mode for summaries (advanced vs B2) - GLOBAL setting for all articles
  const [languageMode, setLanguageMode] = useState('advanced');  // 'advanced' = bullets, 'b2' = 5W's
  const [showLanguageOptions, setShowLanguageOptions] = useState({});  // Track dropdown visibility per article

  // Safe area color state - for dynamic notch/home indicator colors
  const [safeAreaColor, setSafeAreaColor] = useState('#ffffff');

  // Paywall threshold - after important articles
  const paywallThreshold = 999; // No paywall for now

  // Update safe area color when current article changes
  useEffect(() => {
    const currentStory = stories[currentIndex];
    const isImportant = currentStory?.final_score >= 900 || currentStory?.isImportant || false;
    const newColor = '#ffffff'; // Always white - important news only has red accent lines
    
    // Update state
    setSafeAreaColor(newColor);
    
    // Also update the theme-color meta tag directly for iOS Safari
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', newColor);
    }
    
    // Update apple-mobile-web-app-status-bar-style
    const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBarMeta) {
      statusBarMeta.setAttribute('content', isImportant ? 'black' : 'default');
    }
    
    // Also update body background for the safe area effect on some browsers
    document.body.style.backgroundColor = newColor;
    document.documentElement.style.backgroundColor = newColor;
    
  }, [currentIndex, stories]);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is outside the language button
      if (!e.target.closest('.language-icon-btn') && !e.target.closest('.language-dropdown-box')) {
        setShowLanguageOptions({});
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Set time values on client side only to avoid hydration mismatch
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }));
      
      const hour = now.getHours();
      if (hour >= 5 && hour < 12) {
        setTimeOfDay('morning');
      } else if (hour >= 12 && hour < 18) {
        setTimeOfDay('afternoon');
      } else {
        setTimeOfDay('evening');
      }
    };
    
    updateTime(); // Set immediately on mount
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh when user returns to the page after leaving Safari/Chrome
  // This ensures users always see fresh news when they come back
  useEffect(() => {
    let hiddenTime = null;
    const REFRESH_THRESHOLD_MS = 60 * 1000; // Refresh if hidden for more than 1 minute

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is being hidden (user switched apps, locked phone, etc.)
        hiddenTime = Date.now();
        console.log('📱 Page hidden - tracking time...');
      } else {
        // Page is visible again
        if (hiddenTime) {
          const timeHidden = Date.now() - hiddenTime;
          console.log(`📱 Page visible again - was hidden for ${Math.round(timeHidden / 1000)}s`);
          
          if (timeHidden >= REFRESH_THRESHOLD_MS) {
            // User was away for more than 1 minute - refresh for fresh news
            console.log('🔄 Refreshing page for fresh news...');
            window.location.reload();
          }
        }
        hiddenTime = null;
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Swipe handling for summary/bullet toggle and detailed article navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || 
        e.target.closest('[data-expand-icon]') ||
        e.target.closest('.language-icon-btn') ||
        e.target.closest('.language-dropdown-box') ||
        e.target.closest('.language-switcher__option') ||
        e.target.closest('.share-button')) {
      return;
    }
    // Don't handle swipe when touching expanded information boxes
    if (e.target.closest('.map-container-advanced') || 
        e.target.closest('.timeline-container') ||
        e.target.closest('.graph-container')) {
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        return;
      }
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || 
        e.target.closest('[data-expand-icon]') ||
        e.target.closest('.language-icon-btn') ||
        e.target.closest('.language-dropdown-box') ||
        e.target.closest('.language-switcher__option') ||
        e.target.closest('.share-button')) {
      return;
    }
    // Don't handle swipe when touching expanded information boxes
    if (e.target.closest('.map-container-advanced') || 
        e.target.closest('.timeline-container') ||
        e.target.closest('.graph-container')) {
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        return;
      }
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || 
        e.target.closest('[data-expand-icon]') ||
        e.target.closest('.language-icon-btn') ||
        e.target.closest('.language-dropdown-box') ||
        e.target.closest('.language-switcher__option') ||
        e.target.closest('.share-button')) {
      return;
    }
    // Don't handle swipe when touching expanded information boxes
    if (e.target.closest('.map-container-advanced') || 
        e.target.closest('.timeline-container') ||
        e.target.closest('.graph-container')) {
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        return;
      }
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
      
      // Swipe navigation - no detailed text to handle anymore
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

  // toggleDetailedText removed - now using language mode toggle instead

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
    // If components array exists, use it to determine order
    if (story.components && Array.isArray(story.components) && story.components.length > 0) {
      // Filter to only include components that actually have data
      return story.components.filter(type => {
        switch (type) {
          case 'details':
            return story.details && story.details.length > 0;
          case 'timeline':
            return story.timeline && story.timeline.length > 0;
          case 'map':
            return story.map;
          case 'graph':
            return story.graph;
          default:
        return false;
        }
      });
    }
    
    // Fallback: check which components exist (old behavior)
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
    
    // If no state is set, default to the first component from the components array
    const availableTypes = getAvailableInformationTypes(story);
    return availableTypes.length > 0 ? availableTypes[0] : 'details';
  };

  // Helper function to switch to next information type
  const switchToNextInformationType = (story, index, isAutoRotation = false) => {
    const availableTypes = getAvailableInformationTypes(story);
    const currentType = getCurrentInformationType(story, index);
    const currentIndex = availableTypes.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % availableTypes.length;
    const nextType = availableTypes[nextIndex];

    // Track component switch - only for manual clicks, not auto-rotation
    if (story?.type === 'news' && !isAutoRotation) {
      trackEvent('component_click', { component: nextType, action: 'switch', from: currentType }, story);
    }

    // Reset all states
    setShowTimeline(prev => ({ ...prev, [index]: false }));
    setShowDetails(prev => ({ ...prev, [index]: false }));
    setShowMap(prev => ({ ...prev, [index]: false }));
    setShowGraph(prev => ({ ...prev, [index]: false }));
    
    // Reset expanded states - components should start collapsed
    setExpandedTimeline(prev => ({ ...prev, [index]: false }));
    setExpandedGraph(prev => ({ ...prev, [index]: false }));
    setExpandedMap(prev => ({ ...prev, [index]: false }));

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

  // Function to get source domain for logo.dev API
  const getSourceDomain = (source) => {
    if (!source) return null;
    
    // Common news source mappings to their domains
    const sourceDomains = {
      'cnn': 'cnn.com',
      'bbc': 'bbc.com',
      'bbc news': 'bbc.com',
      'reuters': 'reuters.com',
      'associated press': 'apnews.com',
      'ap': 'apnews.com',
      'ap news': 'apnews.com',
      'new york times': 'nytimes.com',
      'nyt': 'nytimes.com',
      'the new york times': 'nytimes.com',
      'washington post': 'washingtonpost.com',
      'the washington post': 'washingtonpost.com',
      'guardian': 'theguardian.com',
      'the guardian': 'theguardian.com',
      'fox news': 'foxnews.com',
      'fox': 'foxnews.com',
      'nbc': 'nbcnews.com',
      'nbc news': 'nbcnews.com',
      'abc news': 'abcnews.go.com',
      'abc': 'abcnews.go.com',
      'cbs news': 'cbsnews.com',
      'cbs': 'cbsnews.com',
      'cnbc': 'cnbc.com',
      'bloomberg': 'bloomberg.com',
      'financial times': 'ft.com',
      'ft': 'ft.com',
      'wall street journal': 'wsj.com',
      'wsj': 'wsj.com',
      'the wall street journal': 'wsj.com',
      'politico': 'politico.com',
      'axios': 'axios.com',
      'the hill': 'thehill.com',
      'huffpost': 'huffpost.com',
      'huffington post': 'huffpost.com',
      'the huffington post': 'huffpost.com',
      'buzzfeed': 'buzzfeed.com',
      'buzzfeed news': 'buzzfeed.com',
      'vice': 'vice.com',
      'vice news': 'vice.com',
      'vox': 'vox.com',
      'the verge': 'theverge.com',
      'verge': 'theverge.com',
      'techcrunch': 'techcrunch.com',
      'wired': 'wired.com',
      'ars technica': 'arstechnica.com',
      'engadget': 'engadget.com',
      'mashable': 'mashable.com',
      'gizmodo': 'gizmodo.com',
      'the atlantic': 'theatlantic.com',
      'atlantic': 'theatlantic.com',
      'npr': 'npr.org',
      'pbs': 'pbs.org',
      'al jazeera': 'aljazeera.com',
      'sky news': 'news.sky.com',
      'sky': 'news.sky.com',
      'daily mail': 'dailymail.co.uk',
      'the daily mail': 'dailymail.co.uk',
      'telegraph': 'telegraph.co.uk',
      'the telegraph': 'telegraph.co.uk',
      'independent': 'independent.co.uk',
      'the independent': 'independent.co.uk',
      'times': 'thetimes.co.uk',
      'the times': 'thetimes.co.uk',
      'forbes': 'forbes.com',
      'fortune': 'fortune.com',
      'business insider': 'businessinsider.com',
      'insider': 'businessinsider.com',
      'yahoo': 'yahoo.com',
      'yahoo news': 'news.yahoo.com',
      'google news': 'news.google.com',
      'usa today': 'usatoday.com',
      'los angeles times': 'latimes.com',
      'la times': 'latimes.com',
      'chicago tribune': 'chicagotribune.com',
      'today+': 'tennews.ai',
      'tennews': 'tennews.ai',
      'time': 'time.com',
      'newsweek': 'newsweek.com',
      'economist': 'economist.com',
      'the economist': 'economist.com'
    };
    
    const normalizedSource = source.toLowerCase().trim();
    
    // Check if we have a direct mapping
    if (sourceDomains[normalizedSource]) {
      return sourceDomains[normalizedSource];
    }
    
    // If source looks like a domain already, use it directly
    if (normalizedSource.includes('.')) {
      return normalizedSource;
    }
    
    // Try to construct a domain from the source name
    const cleanName = normalizedSource.replace(/[^a-z0-9]/g, '');
    return `${cleanName}.com`;
  };

  // Get logo URL from logo.dev
  const getLogoUrl = (source) => {
    const domain = getSourceDomain(source);
    if (!domain) return null;
    return `https://img.logo.dev/${domain}?token=pk_JnGAFnpEQqu1eh3MHrQM3A`;
  };

  // Extract color candidates using enhanced frequency analysis
  // Helper function for hex conversion
  const toHex = (n) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  // Filter colors to keep only colorful ones (saturation >= 35%)
  const filterColorfulColors = (colors) => {
    return colors.filter(color => {
      const [h, s, l] = color.hsl;
      return s >= 35 && l >= 20 && l <= 80; // Colorful, not too dark/light
    });
  };

  // Extract diverse color candidates from image with frequency and coverage tracking
  const extractColorfulCandidates = (pixels, width, height) => {
    const colorMap = {};
    const totalPixelsSampled = pixels.length / 4; // Total RGBA pixel count
    
    // Sample pixels (every 10th pixel)
    for (let i = 0; i < pixels.length; i += 40) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const alpha = pixels[i + 3];
      
      // Skip transparent or extreme pixels
      if (alpha < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10)) {
        continue;
      }
      
      // Round to group similar colors
      const rKey = Math.round(r / 15) * 15;
      const gKey = Math.round(g / 15) * 15;
      const bKey = Math.round(b / 15) * 15;
      const key = `${rKey},${gKey},${bKey}`;
      
      // Track frequency and spatial coverage
      if (!colorMap[key]) {
        colorMap[key] = { 
          count: 0, 
          positions: new Set() 
        };
      }
      colorMap[key].count += 1;
      
      // Track spatial coverage (approximate grid position)
      const pixelIndex = i / 4;
      const x = Math.floor((pixelIndex % width) / 10); // Divide into 10-pixel grid
      const y = Math.floor(Math.floor(pixelIndex / width) / 10);
      colorMap[key].positions.add(`${x},${y}`);
    }
    
    // Calculate max values for normalization
    const maxCount = Math.max(...Object.values(colorMap).map(v => v.count));
    const maxCoverage = Math.max(...Object.values(colorMap).map(v => v.positions.size));
    
    // Get top 20 most frequent colors with frequency and coverage data
    const sortedColors = Object.entries(colorMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([key, data]) => {
        const [r, g, b] = key.split(',').map(Number);
        const hsl = rgbToHsl(r, g, b);
        return { 
          r, g, b, 
          hsl, 
          rgb: { r, g, b },
          frequency: data.count,
          normalizedFrequency: data.count / maxCount,
          coverage: data.positions.size,
          normalizedCoverage: data.positions.size / maxCoverage
        };
      });
    
    return sortedColors;
  };

  // Analyze hue distribution to identify dominant color families
  const getDominantHueRange = (colorCandidates) => {
    const hueRanges = {
      red: { range: [0, 40, 340, 360], count: 0, totalSat: 0 },      // Red/Orange
      green: { range: [80, 160], count: 0, totalSat: 0 },            // Green
      blue: { range: [180, 260], count: 0, totalSat: 0 },            // Blue
      yellow: { range: [40, 80], count: 0, totalSat: 0 },            // Yellow
      purple: { range: [260, 340], count: 0, totalSat: 0 }           // Purple/Magenta
    };
    
    colorCandidates.forEach(color => {
      const [h, s] = color.hsl;
      const freq = color.normalizedFrequency || 1;
      
      // Check which hue range this color belongs to
      if ((h >= 0 && h <= 40) || (h >= 340 && h <= 360)) {
        hueRanges.red.count += freq;
        hueRanges.red.totalSat += s * freq;
      } else if (h >= 80 && h <= 160) {
        hueRanges.green.count += freq;
        hueRanges.green.totalSat += s * freq;
      } else if (h >= 180 && h <= 260) {
        hueRanges.blue.count += freq;
        hueRanges.blue.totalSat += s * freq;
      } else if (h >= 40 && h <= 80) {
        hueRanges.yellow.count += freq;
        hueRanges.yellow.totalSat += s * freq;
      } else if (h >= 260 && h <= 340) {
        hueRanges.purple.count += freq;
        hueRanges.purple.totalSat += s * freq;
      }
    });
    
    // Find the most dominant hue range (weighted by frequency and saturation)
    let maxScore = 0;
    let dominantRange = null;
    
    Object.entries(hueRanges).forEach(([name, data]) => {
      const score = data.count * (data.totalSat / Math.max(data.count, 1));
      if (score > maxScore) {
        maxScore = score;
        dominantRange = name;
      }
    });
    
    return dominantRange;
  };

  // Select the most dominant color using weighted scoring
  const selectColorForArticle = (colorCandidates, articleIndex) => {
    // Filter to colorful only (saturation >= 35%, lightness 20-80%)
    let colorfulColors = filterColorfulColors(colorCandidates);
    
    // If no colorful colors, use most saturated from all candidates
    if (colorfulColors.length === 0) {
      const sortedBySaturation = colorCandidates.sort((a, b) => b.hsl[1] - a.hsl[1]);
      colorfulColors = sortedBySaturation.slice(0, 1);
    }
    
    // Get the dominant hue range from the image
    const dominantHueRange = getDominantHueRange(colorfulColors);
    
    // Calculate composite score for each color
    // Weights: Frequency (50%), Saturation (30%), Coverage (20%)
    const WEIGHT_FREQUENCY = 0.50;
    const WEIGHT_SATURATION = 0.30;
    const WEIGHT_COVERAGE = 0.20;
    
    colorfulColors.forEach(color => {
      const [h, s, l] = color.hsl;
      
      // Normalize saturation (0-100 range)
      const normalizedSaturation = s / 100;
      
      // Calculate composite score
      let score = 
        (WEIGHT_FREQUENCY * color.normalizedFrequency) +
        (WEIGHT_SATURATION * normalizedSaturation) +
        (WEIGHT_COVERAGE * color.normalizedCoverage);
      
      // Boost score if color is in the dominant hue range
      const inDominantRange = (
        (dominantHueRange === 'red' && ((h >= 0 && h <= 40) || (h >= 340 && h <= 360))) ||
        (dominantHueRange === 'green' && h >= 80 && h <= 160) ||
        (dominantHueRange === 'blue' && h >= 180 && h <= 260) ||
        (dominantHueRange === 'yellow' && h >= 40 && h <= 80) ||
        (dominantHueRange === 'purple' && h >= 260 && h <= 340)
      );
      
      if (inDominantRange) {
        score *= 1.3; // 30% boost for colors in dominant hue range
      }
      
      // Slight penalty for very common "sky blue" bias (hue 200-220)
      if (h >= 200 && h <= 220 && s < 60) {
        score *= 0.85; // Reduce score by 15%
      }
      
      color.compositeScore = score;
    });
    
    // Sort by composite score (highest first)
    colorfulColors.sort((a, b) => b.compositeScore - a.compositeScore);
    
    // Select the highest scoring color
    const selectedColor = { ...colorfulColors[0] };
    
    // Only boost saturation slightly, NO hue shifting
    selectedColor.hsl = [...selectedColor.hsl];
    selectedColor.hsl[1] = Math.min(100, selectedColor.hsl[1] * 1.15);
    
    // Convert to RGB
    const [r, g, b] = hslToRgb(...selectedColor.hsl);
    selectedColor.rgb = { r, g, b };
    selectedColor.r = r;
    selectedColor.g = g;
    selectedColor.b = b;
    
    return selectedColor;
  };

  // Create blur color (dark but more vibrant and varied)
  const createBlurColor = (hsl) => {
    const [h, s, l] = hsl;
    
    // More varied darkness range based on original lightness
    const newL = Math.max(20, Math.min(45, l * 0.5)); // Dark: 20-45%
    
    // Keep more saturation for vibrant colors, reduce less
    // If original is very saturated, keep it high
    const newS = Math.min(85, s * 1.0); // Preserve saturation, cap at 85%
    
    return [h, newS, newL];
  };

  // Create title highlight color (DARKER than blur, readable on light backgrounds)
  const createTitleHighlightColor = (blurHsl) => {
    const [h, s, l] = blurHsl;
    
    // Make it DARKER than blur for better contrast
    // Blur is typically 20-45% lightness, we want 55-75% for title highlights
    // This ensures they're darker than blur but still readable on light backgrounds
    
    let newL;
    if (l <= 30) {
      // If blur is very dark (20-30%), make highlight medium-dark (55-65%)
      newL = 55 + (l / 30) * 10; // 55-65% range
    } else {
      // If blur is medium (30-45%), make highlight medium (65-75%)
      newL = 65 + ((l - 30) / 15) * 10; // 65-75% range
    }
    
    // Increase saturation for vibrancy
    const newS = Math.min(90, s * 1.6); // Boost saturation by 60%
    
    // Ensure minimum values for readability and vibrancy
    const finalL = Math.max(55, Math.min(75, newL)); // Clamp between 55-75%
    const finalS = Math.max(65, Math.min(90, newS)); // Clamp between 65-90%
    
    return [h, finalS, finalL];
  };

  // Create bullet text color (VIVID and CLEAR)
  const createBulletTextColor = (blurHsl, titleHsl) => {
    const [h, s1, l1] = blurHsl;
    const [, s2, l2] = titleHsl;
    
    // Create a vibrant middle color that's clearly visible
    const midL = Math.min(85, (l1 + l2) / 2 + 25); // Much lighter (was +10, now +25)
    const midS = Math.min(90, (s1 + s2) / 2 + 20); // Much more saturated (was +5, now +20)
    
    // Ensure it's not too similar to blur or title
    const finalL = Math.max(70, midL); // Ensure minimum lightness of 70%
    const finalS = Math.max(75, midS); // Ensure minimum saturation of 75%
    
    return [h, finalS, finalL];
  };

  // Create information box color (DARKER, READABLE on white background)
  const createInfoBoxColor = (blurHsl) => {
    const [h, s, l] = blurHsl;
    
    // Make it DARKER than blur for readability on white
    // Blur is typically 20-45% lightness, we want 50-70% for info boxes
    // This ensures good contrast on white background
    
    // Calculate darker version: increase lightness but keep it readable
    // If blur is very dark (20-30%), make info box medium-dark (50-60%)
    // If blur is medium (30-45%), make info box medium (60-70%)
    let newL;
    if (l <= 30) {
      newL = 50 + (l / 30) * 10; // 50-60% range
    } else {
      newL = 60 + ((l - 30) / 15) * 10; // 60-70% range
    }
    
    // Increase saturation for vibrancy (but not too much)
    const newS = Math.min(85, s * 1.4); // Boost saturation by 40%
    
    // Ensure minimum values for readability
    const finalL = Math.max(50, Math.min(70, newL)); // Clamp between 50-70%
    const finalS = Math.max(60, Math.min(85, newS)); // Clamp between 60-85%
    
    return [h, finalS, finalL];
  };

  // Main extraction function with index-based selection
  const extractDominantColor = (imgElement, storyIndex) => {
    try {
      console.log(`🎨 Starting color extraction for article ${storyIndex}`);
      console.log(`   Image src: ${imgElement.src}`);
      console.log(`   Image dimensions: ${imgElement.naturalWidth}x${imgElement.naturalHeight}`);
      console.log(`   crossOrigin: ${imgElement.crossOrigin}`);
      
      // Verify image is ready
      if (!imgElement.complete || !imgElement.naturalWidth || imgElement.naturalWidth === 0) {
        throw new Error(`Image not fully loaded: complete=${imgElement.complete}, width=${imgElement.naturalWidth}`);
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      
      console.log(`   Drawing image to canvas...`);
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
      
      console.log(`   Getting image data from canvas...`);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      console.log(`   ✅ Successfully got ${pixels.length / 4} pixels`);
      
      // Extract colorful candidates
      const candidates = extractColorfulCandidates(pixels, canvas.width, canvas.height);
      console.log(`   Found ${candidates.length} color candidates`);
      
      // Select color based on article index
      const selectedColor = selectColorForArticle(candidates, storyIndex);
      console.log(`   Selected color HSL: ${selectedColor.hsl.join(', ')}`);
      console.log(`   Selected color RGB: ${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b}`);
      
      // Create blur color
      const blurHsl = createBlurColor(selectedColor.hsl);
      const [bR, bG, bB] = hslToRgb(...blurHsl);
      const blurColorHex = `#${toHex(bR)}${toHex(bG)}${toHex(bB)}`;
      console.log(`   🎨 Final blur color: ${blurColorHex}`);
      
      // Create title highlight color  
      const highlightHsl = createTitleHighlightColor(blurHsl);
      const [hR, hG, hB] = hslToRgb(...highlightHsl);
      const highlightColor = `rgb(${hR}, ${hG}, ${hB})`;
      
      // Create bullet text color
      const linkHsl = createBulletTextColor(blurHsl, highlightHsl);
      const [lR, lG, lB] = hslToRgb(...linkHsl);
      const linkColor = `rgb(${lR}, ${lG}, ${lB})`;
      
      // Create information box color (DARKER, readable on white)
      const infoBoxHsl = createInfoBoxColor(blurHsl);
      const [iR, iG, iB] = hslToRgb(...infoBoxHsl);
      const infoBoxColor = `rgb(${iR}, ${iG}, ${iB})`;
      
      // Store all colors
      setImageDominantColors(prev => ({
        ...prev,
        [storyIndex]: {
          blurColor: blurColorHex,
          highlight: highlightColor,
          link: linkColor,
          infoBox: infoBoxColor
        }
      }));
      
      console.log(`   ✅ Color extraction complete for article ${storyIndex}`);
    } catch (error) {
      console.error(`❌ Color extraction FAILED for article ${storyIndex}:`, error);
      console.error(`   Error type: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      
      // IMPROVED: Use category-based fallback colors for better variety
      const story = stories[storyIndex];
      const category = story?.category?.replace(/\s+/g, '') || 'World';
      
      // Category-to-hue mapping for meaningful colors
      const categoryHues = {
        'World': 220,        // Blue - global affairs
        'Politics': 0,       // Red - political content
        'Business': 150,     // Green - business/finance
        'Technology': 270,   // Purple - tech
        'Science': 180,      // Cyan - scientific
        'Health': 330,       // Pink - health/medical
        'Sports': 25,        // Orange - sports
        'Entertainment': 50, // Yellow-Orange - entertainment
        'Lifestyle': 40,     // Amber - lifestyle
        'Finance': 140,      // Teal-Green - markets
        'Environment': 160,  // Sea Green - environment
        'Breaking News': 350 // Red-Pink - breaking
      };
      
      const baseHue = categoryHues[category] || 220; // Default to blue
      
      // Add slight variation using story ID
      const idHash = (story?.id || '').toString().split('').reduce((acc, char) => 
        char.charCodeAt(0) + ((acc << 5) - acc), 0);
      const hueVariation = (Math.abs(idHash) % 21) - 10; // -10 to +10
      const hue = (baseHue + hueVariation + 360) % 360;
      
      console.log(`   Using category-based fallback color for '${category}' (hue: ${hue})`);
      
      // Fallback colors - category-based with vibrant saturation
      const fallbackBlurHsl = [hue, 55, 35]; // More saturated than before
      const [r, g, b] = hslToRgb(...fallbackBlurHsl);
      const blurColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      
      const highlightHsl = createTitleHighlightColor(fallbackBlurHsl);
      const linkHsl = createBulletTextColor(fallbackBlurHsl, highlightHsl);
      const fallbackInfoBoxHsl = createInfoBoxColor(fallbackBlurHsl);
      const [fiR, fiG, fiB] = hslToRgb(...fallbackInfoBoxHsl);
      const fallbackInfoBoxColor = `rgb(${fiR}, ${fiG}, ${fiB})`;
      
      setImageDominantColors(prev => ({
        ...prev,
        [storyIndex]: {
          blurColor: blurColor,
          highlight: `hsl(${highlightHsl[0]}, ${highlightHsl[1]}%, ${highlightHsl[2]}%)`,
          link: `hsl(${linkHsl[0]}, ${linkHsl[1]}%, ${linkHsl[2]}%)`,
          infoBox: fallbackInfoBoxColor
        }
      }));
    }
  };

  // Category color mapping system - Refined professional palette
  const getCategoryColors = (category) => {
    const colorMap = {
      'World': '#2563EB',           // Royal Blue - International news, global affairs
      'Politics': '#DC2626',        // Crimson Red - Government, elections, policy
      'Business': '#059669',        // Emerald Green - Economy, markets, finance
      'Technology': '#7C3AED',      // Purple - Tech industry, innovation
      'Science': '#0891B2',         // Teal - Research, discoveries, environment
      'Health': '#DB2777',          // Rose - Medicine, wellness, public health
      'Sports': '#EA580C',          // Orange - Athletics, competitions
      'Lifestyle': '#CA8A04',       // Amber - Fashion, food, travel
      // Legacy/fallback categories
      'Breaking News': '#DC2626',   // Use Politics color
      'Environment': '#0891B2',     // Use Science color
      'General': '#2563EB'          // Use World color
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

  // Helper function to generate 2 complementary border colors from blur color
  const getBorderColorsFromBlur = (blurColor) => {
    if (!blurColor) {
      // Default colors if no blur color
      return {
        color1: '#1e3a8a', // Navy (dominant)
        color2: 'transparent'  // Transparent
      };
    }

    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    // Convert RGB to HSL
    const rgbToHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: h * 360, s: s * 100, l: l * 100 };
    };

    // Convert HSL to RGB
    const hslToRgb = (h, s, l) => {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;

      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    };

    // Convert RGB to hex
    const rgbToHex = (r, g, b) => {
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    };

    try {
      const rgb = hexToRgb(blurColor);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      // Generate 2 colors:
      // Color 1: Lighter version of the blur color (dominant color)
      // Increase lightness significantly to create a lighter version
      const lighterL = Math.min(75, hsl.l + 30); // Add 30% lightness, cap at 75%
      const color1Hsl = { h: hsl.h, s: Math.min(hsl.s + 5, 100), l: lighterL };
      const color1Rgb = hslToRgb(color1Hsl.h, color1Hsl.s, color1Hsl.l);
      
      // Color 2: Transparent
      return {
        color1: rgbToHex(color1Rgb.r, color1Rgb.g, color1Rgb.b),
        color2: 'transparent'
      };
    } catch (error) {
      console.error('Error generating border colors:', error);
      return {
        color1: '#1e3a8a',
        color2: 'transparent'
      };
    }
  };

  // Initialize default component display
  useEffect(() => {
    if (stories.length > 0) {
      const newShowDetails = {};
      const newShowTimeline = {};
      const newShowMap = {};
      const newShowGraph = {};
      
      stories.forEach((story, index) => {
        // Get the first available component type from components array
        const availableTypes = getAvailableInformationTypes(story);
        if (availableTypes.length > 0) {
          const firstType = availableTypes[0];
          
          // Set the appropriate state based on first component
          switch (firstType) {
            case 'details':
              newShowDetails[index] = true;
              break;
            case 'timeline':
              newShowTimeline[index] = true;
              break;
            case 'map':
              newShowMap[index] = true;
              break;
            case 'graph':
              newShowGraph[index] = true;
              break;
          }
        }
      });
      
      setShowDetails(newShowDetails);
      setShowTimeline(newShowTimeline);
      setShowMap(newShowMap);
      setShowGraph(newShowGraph);
    }
  }, [stories]); 

  // PRE-GENERATE category-based colors for all articles
  // This ensures blur colors always appear even if images fail to load
  useEffect(() => {
    if (stories.length === 0) return;
    
    // Category-to-hue mapping for meaningful colors
    const categoryHues = {
      'World': 220, 'Politics': 0, 'Business': 150, 'Technology': 270,
      'Science': 180, 'Health': 330, 'Sports': 25, 'Entertainment': 50,
      'Lifestyle': 40, 'Finance': 140, 'Environment': 160, 'Breaking News': 350
    };
    
    const newColors = { ...imageDominantColors };
    let hasNewColors = false;
    
    stories.forEach((story, index) => {
      // Skip if already has colors or not a news story
      if (imageDominantColors[index] || story.type !== 'news') return;
      
      // Generate category-based color
      const category = story.category?.replace(/\s+/g, '') || 'World';
      const baseHue = categoryHues[category] || 220;
      
      // Add variation using story ID
      const idHash = (story.id || '').toString().split('').reduce((acc, char) => 
        char.charCodeAt(0) + ((acc << 5) - acc), 0);
      const hueVariation = (Math.abs(idHash) % 21) - 10;
      const hue = (baseHue + hueVariation + 360) % 360;
      const saturation = 55 + (Math.abs(idHash % 25));
      const lightness = 30 + (Math.abs((idHash >> 8) % 15));
      
      const [r, g, b] = hslToRgb(hue, saturation, lightness);
      const blurColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      
      const blurHsl = [hue, saturation, lightness];
      const highlightHsl = createTitleHighlightColor(blurHsl);
      const linkHsl = createBulletTextColor(blurHsl, highlightHsl);
      const infoBoxHsl = createInfoBoxColor(blurHsl);
      const [iR, iG, iB] = hslToRgb(...infoBoxHsl);
      
      newColors[index] = {
        blurColor: blurColor,
        highlight: `hsl(${highlightHsl[0]}, ${highlightHsl[1]}%, ${highlightHsl[2]}%)`,
        link: `hsl(${linkHsl[0]}, ${linkHsl[1]}%, ${linkHsl[2]}%)`,
        infoBox: `rgb(${iR}, ${iG}, ${iB})`
      };
      hasNewColors = true;
    });
    
    if (hasNewColors) {
      console.log('🎨 Pre-generated category-based colors for', Object.keys(newColors).length, 'articles');
      setImageDominantColors(newColors);
    }
  }, [stories]); // Re-run when stories change

  // Authentication state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState(null); // 'login', 'signup', or null
  const [authError, setAuthError] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState(null); // { email: string } or null
  const [showResetPassword, setShowResetPassword] = useState(false); // Password reset modal

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

  // Analytics session ID (per page load)
  const [analyticsSessionId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  });

  // Analytics tracking helper with auto-refresh + interest updates
  const trackEvent = async (eventType, metadata = {}, article = null) => {
    if (typeof window === 'undefined') return;
    
    // Update user interests based on engagement (for personalization)
    if (article?.interest_tags && article.interest_tags.length > 0) {
      const weight = getEngagementWeight(eventType, metadata);
      console.log('[interests] Article has tags:', article.interest_tags.length, 'weight:', weight);
      if (weight > 0) {
        updateInterests(article.interest_tags, weight);
        console.log('[interests] Updated localStorage:', Object.keys(getUserInterests()).length, 'keywords');
      }
    } else if (article) {
      console.log('[interests] Article has NO interest_tags:', article.id);
    }
    
    try {
      const raw = localStorage.getItem('tennews_session');
      if (!raw) {
        console.log('[analytics] No session in localStorage, skipping event:', eventType);
        return; // Not logged in
      }
      
      const session = JSON.parse(raw);
      let token = session?.access_token;
      if (!token) {
        console.log('[analytics] No access_token in session, skipping event:', eventType);
        return;
      }

      // Check if token is expired
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      
      if (expiresAt && now >= expiresAt) {
        // Token is EXPIRED - skip event rather than trigger logout
        console.log('[analytics] Token expired, skipping event (will refresh on next interaction)');
        return;
      }
      
      // If expiring soon (within 2 minutes), let the main auth handler refresh it
      if (expiresAt && now >= expiresAt - 120) {
        console.log('[analytics] Token expiring soon, still valid, continuing...');
      }

      console.log('[analytics] Sending event:', eventType, article?.id ? `article:${article.id}` : '');
      
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_type: eventType,
          session_id: analyticsSessionId,
          article_id: article?.id || null,
          cluster_id: article?.cluster_id || null,
          category: article?.category || null,
          source: article?.source || null,
          page: 'index',
          metadata
        }),
        keepalive: true
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn('[analytics] Event failed:', response.status, err);
      } else {
        console.log('[analytics] Event sent successfully:', eventType);
      }
    } catch (e) {
      console.warn('[analytics] Error sending event:', e.message);
    }
  };

  // Engagement tracking: timer for 10s engagement + exit tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const currentStory = stories[currentIndex];
    if (!currentStory || currentStory.type !== 'news' || !currentStory.id) return;
    
    // Reset state for new article
    const startTime = Date.now();
    setArticleViewStart(startTime);
    setMaxScrollPercent(0);
    
    // Engagement timer (10 seconds)
    let engagementTimer = null;
    if (!engagedSent[currentStory.id]) {
      engagementTimer = setTimeout(() => {
        const activeSeconds = Math.round((Date.now() - startTime) / 1000);
        trackEvent('article_engaged', { engaged_seconds: activeSeconds }, currentStory);
        incrementArticlesRead(); // Count this as an article read (10+ seconds)
        setEngagedSent(prev => ({ ...prev, [currentStory.id]: true }));
      }, 10000);
    }
    
    // Scroll tracking
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const scrollPercent = Math.round((scrollTop / docHeight) * 100);
        setMaxScrollPercent(prev => Math.max(prev, scrollPercent));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Cleanup: send exit event when leaving this article
    return () => {
      if (engagementTimer) clearTimeout(engagementTimer);
      window.removeEventListener('scroll', handleScroll);
      
      // Send exit event
      const totalSeconds = Math.round((Date.now() - startTime) / 1000);
      if (totalSeconds > 0) {
        trackEvent('article_exit', { 
          total_active_seconds: totalSeconds,
          max_scroll_percent: maxScrollPercent
        }, currentStory);
      }
    };
  }, [currentIndex, stories]);

  // Initialize user interests on app load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Apply decay to old interests (reduces weight of stale interests)
    decayOldInterests();
    
    // Log current interests for debugging
    const interests = getUserInterests();
    if (Object.keys(interests).length > 0) {
      console.log('🎯 User interests loaded:', Object.keys(interests).length, 'keywords');
      console.log('   Top interests:', Object.entries(interests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k}:${v.toFixed(1)}`)
        .join(', ')
      );
    }
  }, []);

  // Sync interests to Supabase periodically (every 60 seconds if logged in)
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    
    const syncInterval = setInterval(() => {
      const raw = localStorage.getItem('tennews_session');
      if (raw) {
        try {
          const session = JSON.parse(raw);
          if (session?.access_token) {
            syncInterestsToSupabase(session.access_token);
          }
        } catch (e) {}
      }
    }, 60000); // Every 60 seconds
    
    return () => clearInterval(syncInterval);
  }, [user]);

  // Listen for auth state changes - update localStorage when session changes
  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return;
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      
      // Update localStorage whenever session changes (login, token refresh, etc.)
      if (session) {
        localStorage.setItem('tennews_session', JSON.stringify(session));
        localStorage.setItem('tennews_user', JSON.stringify(session.user));
        console.log('📦 Session saved to localStorage, expires:', new Date(session.expires_at * 1000).toISOString());
      }
      
      if (event === 'SIGNED_IN') {
        console.log('✅ User signed in');
        setUser(session?.user || null);
      } else if (event === 'SIGNED_OUT') {
        // Only clear session if it was an explicit logout (no session in storage or user clicked logout)
        const storedSession = localStorage.getItem('tennews_session');
        if (!storedSession || window.__userClickedLogout) {
          console.log('👋 User signed out (explicit)');
          localStorage.removeItem('tennews_session');
          localStorage.removeItem('tennews_user');
          setUser(null);
          window.__userClickedLogout = false;
        } else {
          console.log('⚠️ Ignoring SIGNED_OUT event (possibly stale - session exists in localStorage)');
          // Try to restore the session
          try {
            const parsed = JSON.parse(storedSession);
            if (parsed?.user) {
              setUser(parsed.user);
            }
          } catch (e) {}
        }
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 Password recovery detected - showing reset modal');
        setShowResetPassword(true);
      }
    });
    
    // Also check URL for recovery type
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      console.log('🔐 Recovery type in URL - showing reset modal');
      setShowResetPassword(true);
    }
    
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  // Check authentication status on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const checkAuth = async () => {
      // First, try to get session from Supabase client
      if (supabase) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (!error && session) {
            // Session found in Supabase - user is logged in
            console.log('✅ Session found in Supabase:', session.user.email);
            setUser(session.user);
            
            // Fetch user profile
            try {
              const profileResponse = await fetch('/api/auth/user');
              const profileData = await profileResponse.json();
              if (profileResponse.ok && profileData.profile) {
                setUserProfile(profileData.profile);
              }
            } catch (profileError) {
              console.log('⚠️ Error fetching profile:', profileError);
            }
            
            setAuthLoading(false);
            
            // Also save to localStorage for consistency
            localStorage.setItem('tennews_session', JSON.stringify(session));
            localStorage.setItem('tennews_user', JSON.stringify(session.user));
            return;
          }
        } catch (error) {
          console.log('⚠️ Error checking Supabase session:', error);
        }
      }
      
      // Fallback: Check localStorage
      const storedUser = localStorage.getItem('tennews_user');
      const storedSession = localStorage.getItem('tennews_session');

      if (storedUser && storedSession) {
        try {
          const userData = JSON.parse(storedUser);
          const sessionData = JSON.parse(storedSession);
          setUser(userData);
          
          // Fetch profile from API
          try {
            const profileResponse = await fetch('/api/auth/user');
            const profileData = await profileResponse.json();
            if (profileResponse.ok && profileData.profile) {
              setUserProfile(profileData.profile);
            }
          } catch (profileError) {
            console.log('⚠️ Error fetching profile:', profileError);
          }
          
          setAuthLoading(false);
          return;
        } catch (error) {
          // Invalid stored data, clear it
          localStorage.removeItem('tennews_user');
          localStorage.removeItem('tennews_session');
        }
      }

      // Final fallback: API check
      checkUser();
    };
    
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize ReadArticleTracker
  const [isTrackerReady, setIsTrackerReady] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      readTrackerRef.current = new ReadArticleTracker();
      setIsTrackerReady(true);
      
      // Log all read articles immediately
      const readArticles = readTrackerRef.current.getReadArticles();
      console.log('✅ ReadArticleTracker initialized with', Object.keys(readArticles).length, 'read articles:', Object.keys(readArticles));
    }
  }, []);

  // CRITICAL FIX: Filter out read articles from SSR data after hydration
  // SSR can't access localStorage, so we must filter client-side after ReadArticleTracker is ready
  const [hasFilteredSSRArticles, setHasFilteredSSRArticles] = useState(false);
  
  useEffect(() => {
    console.log('🔍🔍🔍 SSR FILTER EFFECT RUNNING 🔍🔍🔍');
    console.log('🔍 State: isTrackerReady=', isTrackerReady, 'hasFiltered=', hasFilteredSSRArticles, 'stories.length=', stories.length);
    
    // Only run once after readTracker is initialized and we have stories from SSR
    if (!isTrackerReady) {
      console.log('🔍 SKIP: Tracker not ready');
      return;
    }
    if (!readTrackerRef.current) {
      console.log('🔍 SKIP: readTrackerRef.current is null');
      return;
    }
    if (hasFilteredSSRArticles) {
      console.log('🔍 SKIP: Already filtered (hasFilteredSSRArticles=true)');
      return;
    }
    if (stories.length <= 1) {
      console.log('🔍 SKIP: Not enough stories (length=', stories.length, ')');
      return;
    }
    
    console.log('🔍 PROCEEDING WITH FILTER...');
    
    // Get current read articles for debugging
    const readArticles = readTrackerRef.current.getReadArticles();
    const readIds = Object.keys(readArticles);
    console.log('🔍 Read articles in localStorage:', readIds);
    
    // Filter out read articles from the SSR-loaded stories
    const openingStory = stories.find(s => s.type === 'opening');
    const newsStories = stories.filter(s => s.type === 'news');
    const otherStories = stories.filter(s => s.type !== 'news' && s.type !== 'opening');
    
    console.log('🔍 News stories to filter:', newsStories.length);
    console.log('🔍 News story IDs:', newsStories.map(s => s.id));
    
    const unreadNewsStories = newsStories.filter(story => {
      if (!story.id) {
        console.log('🔍 Keeping story with no ID');
        return true;
      }
      const articleIdStr = String(story.id);
      const isRead = readTrackerRef.current.hasBeenRead(articleIdStr);
      console.log('🔍 Checking article', articleIdStr, '- isRead:', isRead);
      if (isRead) {
        console.log('🔍 >>> FILTERING OUT:', articleIdStr, story.title?.substring(0, 30));
      }
      return !isRead;
    });
    
    const filteredCount = newsStories.length - unreadNewsStories.length;
    console.log(`🔍 FILTER COMPLETE: ${filteredCount} removed, ${unreadNewsStories.length} remaining`);
    
    // ALWAYS update stories and mark as filtered
    const newStories = openingStory 
      ? [openingStory, ...unreadNewsStories, ...otherStories]
      : [...unreadNewsStories, ...otherStories];
    
    console.log('🔍 Setting new stories array with', newStories.length, 'items');
    setStories(newStories);
    storiesRef.current = newStories;
    setHasFilteredSSRArticles(true);
    console.log('🔍🔍🔍 SSR FILTER COMPLETE 🔍🔍🔍');
  }, [isTrackerReady, stories, hasFilteredSSRArticles]);

  // Keep storiesRef updated with latest stories value
  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  // Capture shared article ID from URL on initial load
  // Use sessionStorage to persist across any page reloads on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const articleId = urlParams.get('article');
      
      const fetchSharedArticle = async (id) => {
        try {
          console.log('🔗 Fetching shared article directly from API:', id);
          const response = await fetch(`/api/article/${id}?t=${Date.now()}`);
          if (response.ok) {
            const articleData = await response.json();
            if (articleData && articleData.id) {
              console.log('✅ Fetched shared article:', articleData.title?.substring(0, 50));
              
              // Parse five_ws if it's a string
              let fiveWs = articleData.five_ws || null;
              if (typeof fiveWs === 'string') {
                try { fiveWs = JSON.parse(fiveWs); } catch (e) { fiveWs = null; }
              }
              
              // Process the article the SAME way as regular articles
              const processedArticle = {
                id: articleData.id,
                type: 'news',
                number: articleData.rank || 1,
                category: (articleData.category || 'WORLD NEWS').toUpperCase(),
                emoji: articleData.emoji || '📰',
                title: articleData.title || 'News Story',
                
                // Dual-language content fields (from Step 5 generation)
                title_news: articleData.title_news || null,
                content_news: articleData.content_news || null,
                summary_bullets_news: articleData.summary_bullets_news || articleData.summary_bullets || null,
                five_ws: fiveWs,
                
                // Legacy fields for backward compatibility
                detailed_text: articleData.detailed_text || articleData.content_news || null,
                summary_bullets: articleData.summary_bullets || articleData.summary_bullets_news || [],
                summary_bullets_b2: articleData.summary_bullets_b2 || articleData.summary_bullets || [],
                
                details: articleData.details || [],
                details_b2: articleData.details_b2 || articleData.details || [],
                detailed_bullets: articleData.detailed_bullets || [],
                detailed_bullets_b2: articleData.detailed_bullets_b2 || articleData.detailed_bullets || [],
                
                source: articleData.source || 'Today+',
                url: articleData.url || '#',
                urlToImage: (articleData.urlToImage || articleData.image_url || '').trim() || null,
                blurColor: articleData.blurColor || null,
                
                map: articleData.map || articleData.map_data || null,
                graph: articleData.graph || articleData.graph_data || null,
                timeline: articleData.timeline || [],
                
                // CRITICAL: Include components array
                components: articleData.components || ['details'],
                
                publishedAt: articleData.publishedAt || articleData.published_at || articleData.created_at,
                final_score: articleData.final_score || articleData.ai_final_score || 500,
                isSharedArticle: true, // Mark as shared article for priority handling
                interest_tags: articleData.interest_tags || []  // For personalization
              };
              
              console.log('✅ Processed shared article with bullets:', processedArticle.summary_bullets?.length || 0);
              setSharedArticleData(processedArticle);
            }
          } else {
            console.log('⚠️ Failed to fetch shared article, status:', response.status);
          }
        } catch (error) {
          console.error('❌ Error fetching shared article:', error);
        }
      };
      
      if (articleId) {
        console.log('🔗 Shared article ID from URL:', articleId);
        // Store in sessionStorage for persistence across reloads
        sessionStorage.setItem('sharedArticleId', articleId);
        // Store in ref for immediate access
        sharedArticleIdRef.current = articleId;
        sharedArticleHandledRef.current = false;
        setSharedArticleId(articleId);
        
        // Fetch the shared article directly from API
        fetchSharedArticle(articleId);
        
        // DON'T clean up the URL yet - wait until we've navigated
      } else {
        // Check sessionStorage for a shared article ID (in case page reloaded)
        const storedId = sessionStorage.getItem('sharedArticleId');
        if (storedId && !sharedArticleHandledRef.current) {
          console.log('🔗 Shared article ID from sessionStorage:', storedId);
          sharedArticleIdRef.current = storedId;
          setSharedArticleId(storedId);
          // Also fetch the article in case it's not in the loaded batch
          fetchSharedArticle(storedId);
        }
      }
    }
  }, []);

  // Handle shared article - find it in loaded stories and navigate
  // Use an interval to keep trying until successful (mobile can be slow)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Get shared article ID from all sources
    const targetId = sharedArticleIdRef.current || sharedArticleId || 
      sessionStorage.getItem('sharedArticleId');
    
    // No shared article to look for
    if (!targetId || sharedArticleHandledRef.current) return;
    
    console.log('🔗 Starting shared article search for:', targetId);
    
    const checkAndNavigate = () => {
      // Skip if already handled
      if (sharedArticleHandledRef.current) return true;
      
      // Use ref to get latest stories value (fixes closure issue)
      const currentStories = storiesRef.current;
      
      // Skip if stories not loaded yet
      if (currentStories.length <= 1) {
        console.log('🔗 Waiting for stories to load...', currentStories.length);
        return false;
      }
      
      console.log('🔗 Searching for article', targetId, 'in', currentStories.length, 'stories');
      
      // Find the article in loaded stories
      const foundIndex = currentStories.findIndex(s => 
        s.type === 'news' && String(s.id) === String(targetId)
      );
      
      if (foundIndex > 0) {
        console.log('✅ Found shared article at index:', foundIndex);
        
        // Mark as handled FIRST
        sharedArticleHandledRef.current = true;
        sessionStorage.removeItem('sharedArticleId');
        sharedArticleIdRef.current = null;
        setSharedArticleId(null);
        
        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Navigate directly to the found index
        setCurrentIndex(foundIndex);
        console.log('✅ Navigated to index:', foundIndex);
        
        return true; // Success
      }
      
      console.log('🔗 Article not found yet, will retry...');
      return false; // Keep trying
    };
    
    // Try immediately
    if (checkAndNavigate()) return;
    
    // Keep trying every 200ms for up to 5 seconds (mobile can be slow)
    let attempts = 0;
    const maxAttempts = 25;
    const interval = setInterval(() => {
      attempts++;
      if (checkAndNavigate() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          console.log('⚠️ Gave up looking for shared article after', maxAttempts, 'attempts');
          sessionStorage.removeItem('sharedArticleId');
          sharedArticleIdRef.current = null;
          setSharedArticleId(null);
        }
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [sharedArticleId]);

  // Handle when shared article data is fetched and ready
  // This integrates the fetched article into stories and navigates to it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sharedArticleData || sharedArticleHandledRef.current) return;
    if (stories.length <= 1) return; // Wait for stories to load
    
    console.log('🔗 Shared article data ready, integrating into stories:', sharedArticleData.title?.substring(0, 50));
    
    // Check if article already exists in stories
    const existingIndex = stories.findIndex(s => 
      s.type === 'news' && String(s.id) === String(sharedArticleData.id)
    );
    
    if (existingIndex > 0) {
      // Article already in stories, just navigate to it
      console.log('✅ Shared article found in stories at index:', existingIndex);
      sharedArticleHandledRef.current = true;
      sessionStorage.removeItem('sharedArticleId');
      sharedArticleIdRef.current = null;
      setSharedArticleId(null);
      setSharedArticleData(null);
      window.history.replaceState({}, '', window.location.pathname);
      setCurrentIndex(existingIndex);
    } else if (existingIndex === -1) {
      // Article not in stories, add it at position 1 (after opening story)
      console.log('✅ Adding shared article to stories at index 1');
      const newStories = [
        stories[0], // Opening story stays first
        sharedArticleData,
        ...stories.slice(1)
      ];
      setStories(newStories);
      storiesRef.current = newStories;
      
      // Mark as handled and navigate
      sharedArticleHandledRef.current = true;
      sessionStorage.removeItem('sharedArticleId');
      sharedArticleIdRef.current = null;
      setSharedArticleId(null);
      setSharedArticleData(null);
      window.history.replaceState({}, '', window.location.pathname);
      
      // Navigate to index 1 (the shared article)
      setCurrentIndex(1);
      console.log('✅ Navigated to shared article at index 1');
    }
  }, [sharedArticleData, stories]);

  // Handle pending navigation - navigate after stories are fully loaded
  useEffect(() => {
    if (pendingNavigation !== null && stories.length > pendingNavigation && !loading) {
      console.log(`🚀 Executing pending navigation to index ${pendingNavigation}`);
      // Navigate immediately - no need to defer with requestAnimationFrame
      setCurrentIndex(pendingNavigation);
      setPendingNavigation(null);
      console.log(`✅ Navigated to shared article at index ${pendingNavigation}`);
    }
  }, [pendingNavigation, stories.length, loading]);

  // Add debug helpers for sorting (with access to stories state)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.debugSorting) {
      // Extend debugSorting with functions that have access to current stories
      window.debugSorting.showTopArticles = (n = 10) => {
        if (stories.length === 0) {
          console.log('ℹ️ No articles loaded yet');
          return;
        }
        
        const newsStories = stories.filter(s => s.type === 'news');
        const topN = newsStories.slice(0, n);
        
        console.log(`📊 Top ${Math.min(n, newsStories.length)} articles (out of ${newsStories.length} total):`);
        console.table(topN.map((story, idx) => ({
          rank: idx + 1,
          score: story.final_score ?? 'N/A',
          title: story.title?.substring(0, 60) || 'No title',
          date: story.publishedAt || 'N/A',
          category: story.category || 'N/A'
        })));
        
        return topN;
      };
      
      window.debugSorting.checkIfSorted = () => {
        const newsStories = stories.filter(s => s.type === 'news');
        if (newsStories.length === 0) {
          console.log('ℹ️ No news articles loaded');
          return true;
        }
        
        let isSorted = true;
        let outOfOrder = [];
        
        for (let i = 0; i < newsStories.length - 1; i++) {
          const currentScore = newsStories[i].final_score ?? 0;
          const nextScore = newsStories[i + 1].final_score ?? 0;
          
          if (currentScore < nextScore) {
            isSorted = false;
            outOfOrder.push({
              index: i,
              current: {
                title: newsStories[i].title?.substring(0, 40),
                score: currentScore
              },
              next: {
                title: newsStories[i + 1].title?.substring(0, 40),
                score: nextScore
              }
            });
          }
        }
        
        if (isSorted) {
          console.log('✅ Articles are correctly sorted by score!');
          console.log(`📊 Score range: ${newsStories[0]?.final_score ?? 'N/A'} (highest) to ${newsStories[newsStories.length - 1]?.final_score ?? 'N/A'} (lowest)`);
        } else {
          console.error('❌ Articles are NOT sorted correctly!');
          console.table(outOfOrder);
        }
        
        return isSorted;
      };
      
      window.debugSorting.checkArticleScores = () => {
        const newsStories = stories.filter(s => s.type === 'news');
        console.log(`📊 All article scores (${newsStories.length} articles):`);
        console.table(newsStories.map((story, idx) => ({
          index: idx,
          score: story.final_score ?? 'N/A',
          title: story.title?.substring(0, 50) || 'No title',
          date: story.publishedAt || 'N/A'
        })));
        
        // Show statistics
        const scores = newsStories
          .map(s => s.final_score)
          .filter(s => typeof s === 'number');
        
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const max = Math.max(...scores);
          const min = Math.min(...scores);
          
          console.log('\n📈 Score Statistics:');
          console.log(`   Highest: ${max}`);
          console.log(`   Lowest: ${min}`);
          console.log(`   Average: ${avg.toFixed(2)}`);
          console.log(`   Total articles with scores: ${scores.length}/${newsStories.length}`);
        }
      };
      
      // Debug helpers updated with access to current stories
    }
  }, [stories]);

  // Track article when currentIndex changes (mark as read after 2 seconds)
  useEffect(() => {
    if (!readTrackerRef.current || !stories[currentIndex]) {
      console.log('⚠️ Tracking skipped - tracker or story missing');
      return;
    }
    
    const story = stories[currentIndex];
    console.log('🔍 Checking story for tracking:', { 
      type: story.type, 
      hasId: !!story.id, 
      id: story.id,
      index: currentIndex 
    });
    
    // Only track news articles (not opening story)
    if (story.type !== 'news' || !story.id) {
      console.log('⏭️ Skipping tracking - not a news article or missing ID');
      return;
    }
    
    console.log('⏱️ Starting 2-second timer for article:', story.id);
    
    // Mark as read after 2 seconds of viewing
    const timer = setTimeout(() => {
      if (readTrackerRef.current && story.id) {
        readTrackerRef.current.markAsRead(story.id);
        console.log('✅ Article marked as read:', story.id);
      }
    }, 2000);
    
    return () => {
      console.log('🧹 Cleanup timer for:', story.id);
      clearTimeout(timer);
    };
  }, [currentIndex, stories]);

  // Function to load more articles (pagination)
  const loadMoreArticles = async (pageNum) => {
    if (loadingMore || !hasMoreArticles) return;
    
    setLoadingMore(true);
    try {
      console.log(`📡 Loading more articles (page ${pageNum})...`);
      const response = await fetch(`/api/news?page=${pageNum}&pageSize=30&t=${Date.now()}`);
      
      if (response.ok) {
        const newsData = await response.json();
        
        if (newsData.articles && newsData.articles.length > 0) {
          // Convert new articles to story format
          const newStories = newsData.articles.map((article, index) => {
            const sampleDetails = article.details && article.details.length > 0 ? article.details : [
              'Impact Score: 8.5/10 High significance',
              'Read Time: 4 min Estimated reading duration',
              'Source Credibility: Verified from trusted sources'
            ];
            
            const sampleTimeline = (article.timeline && Array.isArray(article.timeline) && article.timeline.length > 0) 
              ? article.timeline 
              : [
                  {"date": "3 days ago", "event": "Initial reports emerge"},
                  {"date": "Yesterday", "event": "Key developments unfold"},
                  {"date": "Today", "event": "Major announcement breaks"},
                  {"date": "Tomorrow", "event": "Expected follow-up responses"}
                ];

            return {
              type: 'news',
              number: article.rank || (index + 1),
              category: (article.category || 'WORLD NEWS').toUpperCase(),
              emoji: article.emoji || '📰',
              title: article.title || 'News Story',
              title_news: article.title_news || null,
              content_news: article.content_news || null,
              summary_bullets_news: article.summary_bullets_news || null,
              // Parse five_ws if it's a string
              five_ws: (() => {
                let fw = article.five_ws || null;
                if (typeof fw === 'string') {
                  try { fw = JSON.parse(fw); } catch (e) { fw = null; }
                }
                return fw;
              })(),
              detailed_text: article.detailed_text || article.content_news || null,
              summary_bullets: article.summary_bullets || article.summary_bullets_news || [],
              details: sampleDetails,
              source: article.source || 'Today+',
              url: article.url || '#',
              urlToImage: (article.urlToImage || article.image_url || '').trim() || null,
              blurColor: article.blurColor || null,
              map: article.map || null,
              graph: article.graph || null,
              timeline: sampleTimeline,
              components: article.components || null,
              publishedAt: article.publishedAt || article.published_at || article.added_at,
              id: article.id || `article_${pageNum}_${index}`,
              final_score: article.final_score,
              interest_tags: article.interest_tags || []  // For personalization
            };
          });
          
          // Filter out read articles
          let unreadNewStories = newStories;
          if (readTrackerRef.current) {
            unreadNewStories = newStories.filter(story => 
              !readTrackerRef.current.hasBeenRead(story.id)
            );
          }
          
          // Check if this is the last page OR we've hit memory cap
          const isLastPage = !newsData.pagination?.hasMore;
          
          // Insert new stories with memory cap
          setStories(prev => {
            // Remove existing "all caught up" page if present
            const withoutAllRead = prev.filter(s => s.type !== 'all-read');
            
            // Count current news articles
            const currentNewsCount = withoutAllRead.filter(s => s.type === 'news').length;
            const newNewsCount = unreadNewStories.length;
            const totalAfterAdd = currentNewsCount + newNewsCount;
            
            // Check if we've hit memory cap (150 articles)
            const hitMemoryCap = totalAfterAdd >= MAX_ARTICLES_IN_MEMORY;
            
            // Add new stories
            let updated = [...withoutAllRead, ...unreadNewStories];
            
            // If over cap, keep only the most recent MAX_ARTICLES_IN_MEMORY news articles
            if (hitMemoryCap) {
              const openingStory = updated.find(s => s.type === 'opening');
              const newsStories = updated.filter(s => s.type === 'news').slice(0, MAX_ARTICLES_IN_MEMORY);
              updated = openingStory ? [openingStory, ...newsStories] : newsStories;
              console.log(`⚠️ Memory cap reached: keeping ${MAX_ARTICLES_IN_MEMORY} articles`);
            }
            
            // Add "all caught up" when: last page OR memory cap reached
            if (isLastPage || hitMemoryCap) {
              const allCaughtUpStory = {
                type: 'all-read',
                title: "All Caught Up",
                message: hitMemoryCap 
                  ? `You've loaded ${MAX_ARTICLES_IN_MEMORY} articles` 
                  : "You've read all today's articles",
                subtitle: hitMemoryCap 
                  ? "Refresh for the latest news"
                  : "Come back in a few minutes"
              };
              return [...updated, allCaughtUpStory];
            }
            
            return updated;
          });
          
          console.log(`✅ Loaded ${unreadNewStories.length} more articles${isLastPage ? ' (last page)' : ''}`);
        }
        
        // Update pagination state
        if (newsData.pagination) {
          // Check if we've hit memory cap
          const currentNewsCount = stories.filter(s => s.type === 'news').length;
          const hitMemoryCap = currentNewsCount + (newsData.articles?.length || 0) >= MAX_ARTICLES_IN_MEMORY;
          
          // Stop loading if memory cap reached OR no more pages
          setHasMoreArticles(newsData.pagination.hasMore && !hitMemoryCap);
          setTotalArticles(newsData.pagination.total);
        } else {
          setHasMoreArticles(false);
        }
        
        setCurrentPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading more articles:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Load more articles when user gets close to the end
  useEffect(() => {
    // Calculate how close to the end we are (stories includes opening + news + all-caught-up)
    const newsStoriesCount = stories.filter(s => s.type === 'news').length;
    const storiesFromEnd = newsStoriesCount - currentIndex;
    
    // Load more when 5 or fewer stories left to view
    if (storiesFromEnd <= 5 && hasMoreArticles && !loadingMore && currentIndex > 0) {
      console.log(`📦 Near end (${storiesFromEnd} stories left), loading page ${currentPage + 1}...`);
      loadMoreArticles(currentPage + 1);
    }
  }, [currentIndex, stories.length, hasMoreArticles, loadingMore, currentPage]);

  useEffect(() => {
    // If we have SSR data, still do a background refresh for freshness
    const hasSSRData = stories.length > 0 && !loading;
    
    const loadNewsData = async (isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) {
        console.log('🔄 Background refresh - checking for new articles...');
      }
      try {
        const response = await fetch(`/api/news?page=1&pageSize=30&t=${Date.now()}`);
        
        if (response.ok) {
          const newsData = await response.json();
          console.log('📰 API Response:', newsData);
          console.log('📰 Articles count:', newsData.articles?.length);
          // Debug: Log five_ws data from first few articles
          if (newsData.articles?.length > 0) {
            newsData.articles.slice(0, 3).forEach((a, i) => {
              console.log(`📋 Article ${i} five_ws:`, typeof a.five_ws, a.five_ws);
            });
          }
          
          // Always create opening story, even if no articles
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
          
          if (newsData.articles && newsData.articles.length > 0) {
            
            // API already filters articles older than 24 hours
            const recentArticles = newsData.articles;
            
             // Convert articles to story format
             recentArticles.forEach((article, index) => {
               // Sample preview data
               const sampleDetails = article.details && article.details.length > 0 ? article.details : [
                 'Impact Score: 8.5/10 High significance',
                 'Read Time: 4 min Estimated reading duration',
                 'Source Credibility: Verified from trusted sources'
               ];
               
               const sampleTimeline = (article.timeline && Array.isArray(article.timeline) && article.timeline.length > 0) 
                 ? article.timeline 
                 : (article.timeline && typeof article.timeline === 'string' && article.timeline.trim() !== '')
                   ? (() => {
                       try {
                         const parsed = JSON.parse(article.timeline);
                         return Array.isArray(parsed) && parsed.length > 0 ? parsed : [
                           {"date": "3 days ago", "event": "Initial reports emerge about the developing situation"},
                           {"date": "Yesterday", "event": "Key developments unfold as more information becomes available"},
                           {"date": "Today", "event": "Major announcement breaks, drawing significant attention"},
                           {"date": "Tomorrow", "event": "Expected follow-up meetings and official responses"}
                         ];
                       } catch {
                         return [
                           {"date": "3 days ago", "event": "Initial reports emerge about the developing situation"},
                           {"date": "Yesterday", "event": "Key developments unfold as more information becomes available"},
                           {"date": "Today", "event": "Major announcement breaks, drawing significant attention"},
                           {"date": "Tomorrow", "event": "Expected follow-up meetings and official responses"}
                         ];
                       }
                     })()
                   : [
                     {"date": "3 days ago", "event": "Initial reports emerge about the developing situation"},
                     {"date": "Yesterday", "event": "Key developments unfold as more information becomes available"},
                     {"date": "Today", "event": "Major announcement breaks, drawing significant attention"},
                     {"date": "Tomorrow", "event": "Expected follow-up meetings and official responses"}
                   ];

               // Generate map data based on article content
              const generateMapFromContent = (title, category) => {
                const titleLower = (title || '').toLowerCase();
                
                // Location coordinates mapping
                const locationMap = {
                  ukraine: { lat: 48.3794, lon: 31.1656, location: 'Ukraine', region: 'Eastern Europe', description: 'Major developments in the ongoing conflict zone' },
                  russia: { lat: 55.7558, lon: 37.6173, location: 'Moscow, Russia', region: 'Russia', description: 'Center of Russian political activity' },
                  poland: { lat: 52.2297, lon: 21.0122, location: 'Warsaw, Poland', region: 'Central Europe', description: 'NATO eastern flank operations' },
                  nato: { lat: 50.8503, lon: 4.3517, location: 'Brussels, Belgium', region: 'NATO HQ', description: 'Alliance headquarters coordination' },
                  china: { lat: 39.9042, lon: 116.4074, location: 'Beijing, China', region: 'East Asia', description: 'Chinese government activity' },
                  taiwan: { lat: 25.0330, lon: 121.5654, location: 'Taipei, Taiwan', region: 'East Asia', description: 'Cross-strait developments' },
                  israel: { lat: 31.7683, lon: 35.2137, location: 'Jerusalem, Israel', region: 'Middle East', description: 'Regional security situation' },
                  gaza: { lat: 31.5, lon: 34.47, location: 'Gaza Strip', region: 'Middle East', description: 'Humanitarian crisis zone' },
                  iran: { lat: 35.6892, lon: 51.3890, location: 'Tehran, Iran', region: 'Middle East', description: 'Regional power dynamics' },
                  syria: { lat: 33.5138, lon: 36.2765, location: 'Damascus, Syria', region: 'Middle East', description: 'Civil conflict developments' },
                  'middle east': { lat: 29.3117, lon: 47.4818, location: 'Middle East', region: 'MENA', description: 'Regional developments' },
                  europe: { lat: 50.1109, lon: 8.6821, location: 'Europe', region: 'EU', description: 'European affairs' },
                  'united states': { lat: 38.9072, lon: -77.0369, location: 'Washington D.C.', region: 'North America', description: 'US government activity' },
                  washington: { lat: 38.9072, lon: -77.0369, location: 'Washington D.C.', region: 'United States', description: 'US government activity' },
                  trump: { lat: 38.9072, lon: -77.0369, location: 'United States', region: 'North America', description: 'US political developments' },
                  korea: { lat: 37.5665, lon: 126.9780, location: 'Seoul, South Korea', region: 'East Asia', description: 'Korean peninsula situation' },
                  japan: { lat: 35.6762, lon: 139.6503, location: 'Tokyo, Japan', region: 'East Asia', description: 'Japanese developments' },
                  india: { lat: 28.6139, lon: 77.2090, location: 'New Delhi, India', region: 'South Asia', description: 'Indian subcontinent news' },
                  australia: { lat: -33.8688, lon: 151.2093, location: 'Sydney, Australia', region: 'Oceania', description: 'Australian developments' },
                  uk: { lat: 51.5074, lon: -0.1278, location: 'London, UK', region: 'Western Europe', description: 'British affairs' },
                  france: { lat: 48.8566, lon: 2.3522, location: 'Paris, France', region: 'Western Europe', description: 'French developments' },
                  germany: { lat: 52.5200, lon: 13.4050, location: 'Berlin, Germany', region: 'Central Europe', description: 'German affairs' },
                };

                // Check title for location keywords
                for (const [keyword, mapData] of Object.entries(locationMap)) {
                  if (titleLower.includes(keyword)) {
                    return {
                      center: { lat: mapData.lat, lon: mapData.lon },
                      location: mapData.location,
                      name: mapData.location,  // For auto-detection
                      region: mapData.region,
                      description: mapData.description,
                      zoom: 5,
                      location_type: 'auto',  // Let MapboxMap auto-detect based on location name
                      region_name: null
                    };
                  }
                }
                return null;
              };

              // Try to generate map from article content if not provided
              const generatedMap = article.map || generateMapFromContent(article.title, article.category);

              const storyData = {
                type: 'news',
                number: article.rank || (index + 1),
                category: (article.category || 'WORLD NEWS').toUpperCase(),
                emoji: article.emoji || '📰',
                title: article.title || 'News Story',
               
               // Dual-language content fields (from Step 5 generation)
               title_news: article.title_news || null,
               content_news: article.content_news || null,
               summary_bullets_news: article.summary_bullets_news || null,
               // Parse five_ws if it's a string
               five_ws: (() => {
                 let fw = article.five_ws || null;
                 if (typeof fw === 'string') {
                   try { fw = JSON.parse(fw); } catch (e) { fw = null; }
                 }
                 return fw;
               })(),
               
               // Legacy fields for backward compatibility (old articles)
               detailed_text: article.detailed_text || article.content_news || null,
               summary_bullets: article.summary_bullets || article.summary_bullets_news || [],
               
                details: sampleDetails,
                source: article.source || 'Today+',
                url: article.url || '#',
                urlToImage: (article.urlToImage || article.image_url || '').trim() || null,
                blurColor: article.blurColor || null,  // Pre-computed blur color
                map: generatedMap,
                graph: article.graph || null,
                timeline: sampleTimeline,
                // Include components array, adding 'map' if map data was generated
                components: (() => {
                  let comps = article.components || ['details'];
                  // If map data was generated and not already in components, add it
                  if (generatedMap && !comps.includes('map')) {
                    comps = [...comps, 'map'];
                  }
                  return comps;
                })(),  // CRITICAL: Include components array with map support
                publishedAt: article.publishedAt || article.published_at || article.added_at,
                id: article.id || `article_${index}`,
                final_score: article.final_score,  // IMPORTANT: Include final_score for red border styling
                interest_tags: article.interest_tags || []  // For personalization
              };
               
               processedStories.push(storyData);
             });
            
            // Filter out read articles using ReadArticleTracker
            console.log('📰 loadNewsData: Starting filter, readTrackerRef.current exists:', !!readTrackerRef.current);
            let unreadStories = processedStories;
            if (readTrackerRef.current) {
              const readArticleIds = Object.keys(readTrackerRef.current.getReadArticles());
              console.log('📰 loadNewsData: Read article IDs from localStorage:', readArticleIds);
              console.log('📰 loadNewsData: Incoming story IDs:', processedStories.filter(s => s.type === 'news').map(s => String(s.id)));
              
              unreadStories = processedStories.filter((story, index) => {
                // Always keep opening story
                if (index === 0) return true;
                // Keep non-news stories
                if (story.type !== 'news') return true;
                // Filter out read articles
                const isRead = readTrackerRef.current.hasBeenRead(story.id);
                if (isRead) {
                  console.log('📰 loadNewsData: Filtering out read article:', String(story.id));
                }
                return !isRead;
              });
              
              const filteredCount = processedStories.length - unreadStories.length;
              console.log(`📰 loadNewsData: Filtered ${filteredCount} read articles, ${unreadStories.length} remaining`);
            } else {
              console.log('📰 loadNewsData: NO readTrackerRef.current - SKIP FILTER');
            }
            
            // Sort articles by score (highest first), with date tie-breaking
            // Keep opening story first, sort only the news articles
            let finalStories = unreadStories;
            if (unreadStories.length > 1) {
              const openingStory = unreadStories[0]; // First story (opening page)
              let newsArticles = unreadStories.slice(1); // All news articles
              
              console.log('📊 Sorting news articles by score...');
              let sortedNews = sortArticlesByScore(newsArticles);
              
              // DISABLED: Personalization ranking - articles now sorted purely by score
              // Interest data is still collected and synced to Supabase for future use
              // To re-enable, uncomment the following:
              // const userInterests = getUserInterests();
              // if (Object.keys(userInterests).length > 0) {
              //   console.log('🎯 Applying personalization with', Object.keys(userInterests).length, 'interests');
              //   sortedNews = rankArticles(sortedNews, 0.7); // 70% personalization weight
              // }
              
              // Handle shared article - prioritize it to appear first
              // Check ref, state, and sessionStorage for the shared article ID
              let foundSharedArticle = false;
              const storedArticleId = typeof window !== 'undefined' ? sessionStorage.getItem('sharedArticleId') : null;
              const targetArticleId = sharedArticleIdRef.current || sharedArticleId || storedArticleId;
              if (targetArticleId && !sharedArticleHandledRef.current) {
                console.log('🔗 Looking for shared article:', targetArticleId);
                
                // First, try to find it in the current sorted list
                const sharedIndex = sortedNews.findIndex(story => 
                  String(story.id) === String(targetArticleId)
                );
                
                if (sharedIndex !== -1) {
                  // Found in current list - move it to the front
                  const sharedArticle = sortedNews[sharedIndex];
                  sortedNews = [
                    sharedArticle,
                    ...sortedNews.slice(0, sharedIndex),
                    ...sortedNews.slice(sharedIndex + 1)
                  ];
                  console.log('✅ Shared article moved to front:', sharedArticle.title?.substring(0, 40));
                  foundSharedArticle = true;
                  sharedArticleHandledRef.current = true; // Mark as handled
                } else {
                  // Not in current list - check if it was filtered out (already read)
                  // Look in the full processed stories list
                  const sharedFromAll = processedStories.find(story => 
                    story.type === 'news' && String(story.id) === String(targetArticleId)
                  );
                  
                  if (sharedFromAll) {
                    // Add it to the front even if it was read
                    sortedNews = [sharedFromAll, ...sortedNews];
                    console.log('✅ Shared article (previously read) added to front:', sharedFromAll.title?.substring(0, 40));
                    foundSharedArticle = true;
                    sharedArticleHandledRef.current = true; // Mark as handled
                  } else if (sharedArticleData) {
                    // Use the article we fetched from the API (stored in state)
                    sortedNews = [sharedArticleData, ...sortedNews];
                    console.log('✅ Shared article (from API) added to front:', sharedArticleData.title?.substring(0, 40));
                    foundSharedArticle = true;
                    sharedArticleHandledRef.current = true; // Mark as handled
                  } else {
                    console.log('⚠️ Shared article not found, waiting for API fetch...');
                  }
                }
                
                // Only clear if we found it
                if (foundSharedArticle) {
                  sharedArticleIdRef.current = null;
                  setSharedArticleId(null);
                  setSharedArticleData(null);
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('sharedArticleId');
                  }
                }
              }
              
              // Log articles that qualify as important (score >= 900)
              const importantArticles = sortedNews.filter(a => a.final_score >= 900);
              if (importantArticles.length > 0) {
                console.log(`🚨 ${importantArticles.length} article(s) marked as IMPORTANT (score >= 900):`, 
                  importantArticles.map(a => `${a.title?.substring(0, 30)}... (${a.final_score})`));
              }
              
              // Only add "all caught up" page if there are NO more articles to load
              // Otherwise, auto-loading will add more articles
              const hasMoreToLoad = newsData.pagination?.hasMore;
              
              if (hasMoreToLoad) {
                // More pages available - don't show "all caught up" yet
                finalStories = [openingStory, ...sortedNews];
              } else {
                // No more pages - add "all caught up" at the end
                const allCaughtUpStory = {
                  type: 'all-read',
                  title: "All Caught Up",
                  message: "You've read all today's articles",
                  subtitle: "Come back in a few minutes"
                };
                finalStories = [openingStory, ...sortedNews, allCaughtUpStory];
              }
              
              // If we found a shared article, navigate directly to it
              if (foundSharedArticle && finalStories.length > 1) {
                console.log('🎯 Navigating directly to shared article at index 1');
                // Use setTimeout to ensure stories state is set before navigation
                setTimeout(() => {
                  setCurrentIndex(1);
                  console.log('✅ Navigated to shared article at index 1');
                }, 100);
              }
            } else if (unreadStories.length === 1) {
              // Only opening story left, all articles have been read
              console.log('✅ All articles have been read!');
              
              // Create a special "all caught up" story after opening page
              const allCaughtUpStory = {
                type: 'all-read',
                title: "All Caught Up",
                message: "You've read all today's articles",
                subtitle: "Come back in a few minutes"
              };
              
              finalStories = [unreadStories[0], allCaughtUpStory];
            }
            
            console.log('📰 Setting stories:', finalStories.length);
            
            // For background refresh, only update if there are new articles
            if (isBackgroundRefresh) {
              // CRITICAL: Use storiesRef.current to get the LATEST filtered stories
              // (not the stale closure value of 'stories')
              const currentStories = storiesRef.current || [];
              const currentIds = new Set(currentStories.filter(s => s.id).map(s => String(s.id)));
              const newArticles = finalStories.filter(s => s.id && !currentIds.has(String(s.id)));
              
              console.log('🔄 Background refresh comparison:', {
                currentStoriesCount: currentStories.length,
                finalStoriesCount: finalStories.length,
                newArticlesCount: newArticles.length
              });
              
              if (newArticles.length > 0) {
                console.log(`🆕 Background refresh found ${newArticles.length} new articles - updating`);
                setStories(finalStories);
                storiesRef.current = finalStories;
              } else {
                console.log('✅ Background refresh - no new articles, keeping current filtered data');
              }
            } else {
              setStories(finalStories);
              storiesRef.current = finalStories;
            }
            
            // Track pagination info
            if (newsData.pagination) {
              setHasMoreArticles(newsData.pagination.hasMore);
              setTotalArticles(newsData.pagination.total);
              console.log(`📦 Pagination: ${newsData.articles.length}/${newsData.pagination.total} articles loaded, hasMore: ${newsData.pagination.hasMore}`);
            }
            
            console.log('📰 Stories set successfully');
          } else {
            console.log('📰 No articles found in response, using mock data for localhost testing');
            
            // Mock news articles for localhost testing
            const mockArticles = [
              {
                type: 'news',
                id: 'mock_1',
                number: 1,
                category: 'POLITICS',
                emoji: '🏛️',
                title: 'Global Leaders Meet for Historic Climate Summit',
                title_news: 'Global Leaders Meet for Historic Climate Summit',
                content_news: 'World leaders from over 190 countries have gathered in Geneva for what experts are calling the most significant climate summit in decades. The three-day conference aims to establish binding commitments for reducing carbon emissions by 50% before 2035. Major economies including the US, China, and EU have signaled willingness to adopt stricter environmental policies, marking a significant shift in global climate diplomacy.',
                summary_bullets: [
                  'World leaders from 190+ nations gather in Geneva for landmark climate negotiations this week',
                  'Summit targets ambitious 50% carbon emission cuts by 2035, with binding commitments expected',
                  'US, China and EU signal unprecedented cooperation on environmental policy and green energy'
                ],
                summary_bullets_news: ['World leaders from 190+ nations gather in Geneva for landmark climate negotiations this week', 'Summit targets ambitious 50% carbon emission cuts by 2035, with binding commitments expected', 'US, China and EU signal unprecedented cooperation on environmental policy and green energy'],
                five_ws: {
                  who: '**190+ world leaders**, **US**, **China**, **EU**',
                  what: 'Historic **climate summit** with binding emission targets',
                  when: '**Today** in Geneva, 3-day conference',
                  where: '**Geneva**, Switzerland',
                  why: 'Combat climate change with **50% emission cuts** by 2035'
                },
                urlToImage: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800',
                publishedAt: new Date().toISOString(),
                source: 'Today+',
                final_score: 950,
                isImportant: true, // BREAKING NEWS - This article is marked as important
                details: [
                  'Countries attending: 190+',
                  'Emission target: 50% reduction',
                  'Timeline: 2035'
                ],
                timeline: [
                  { date: '2015', event: 'Paris Agreement signed by 196 parties' },
                  { date: '2021', event: 'COP26 Glasgow strengthens commitments' },
                  { date: 'Today', event: 'Geneva Summit sets new ambitious targets' }
                ],
                components: ['details', 'timeline']
              },
              {
                type: 'news',
                id: 'mock_2',
                number: 2,
                category: 'TECHNOLOGY',
                emoji: '🤖',
                title: 'AI Breakthrough: New Model Achieves Human-Level Reasoning',
                title_news: 'AI Breakthrough: New Model Achieves Human-Level Reasoning',
                content_news: 'Researchers at a leading AI lab have announced a major breakthrough in artificial intelligence, unveiling a new model that demonstrates human-level reasoning capabilities across multiple domains. The system, trained on a novel architecture, shows unprecedented performance in complex problem-solving, mathematical reasoning, and creative tasks. Industry experts suggest this could accelerate the timeline for artificial general intelligence.',
                summary_bullets: [
                  'Revolutionary AI system achieves unprecedented 97.3% accuracy on complex reasoning benchmarks',
                  'Model demonstrates human-level performance in mathematics, coding, and creative problem solving',
                  'Experts predict this breakthrough could accelerate timeline to artificial general intelligence'
                ],
                summary_bullets_news: ['Revolutionary AI system achieves unprecedented 97.3% accuracy on complex reasoning benchmarks', 'Model demonstrates human-level performance in mathematics, coding, and creative problem solving', 'Experts predict this breakthrough could accelerate timeline to artificial general intelligence'],
                five_ws: {
                  who: 'Leading **AI lab** researchers',
                  what: 'New model achieves **97.3%** on reasoning benchmarks',
                  when: '**Today**, announced at press conference',
                  where: 'Global AI research community',
                  why: 'Novel architecture enables **human-level reasoning**'
                },
                urlToImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
                publishedAt: new Date(Date.now() - 3600000).toISOString(),
                source: 'Today+',
                final_score: 920,
                details: [
                  'Benchmark score: 97.3%',
                  'Training cost: $50M',
                  'Parameters: 1.5 Trillion'
                ],
                timeline: [
                  { date: '2022', event: 'ChatGPT launches, sparking AI revolution' },
                  { date: '2024', event: 'Multimodal AI becomes mainstream' },
                  { date: 'Today', event: 'Human-level reasoning achieved' }
                ],
                components: ['details', 'timeline']
              },
              {
                type: 'news',
                id: 'mock_3',
                number: 3,
                category: 'BUSINESS',
                emoji: '📈',
                title: 'Markets Rally as Central Banks Signal Rate Cuts',
                title_news: 'Markets Rally as Central Banks Signal Rate Cuts',
                content_news: 'Global stock markets surged to record highs following coordinated signals from major central banks indicating potential interest rate cuts in the coming months. The Federal Reserve, European Central Bank, and Bank of England have all hinted at easing monetary policy as inflation shows signs of stabilizing. Analysts predict this could fuel a continued bull market through the end of the year.',
                summary_bullets: [
                  'Global stock indices surge to all-time highs as investors anticipate coordinated rate cuts',
                  'Federal Reserve, ECB and Bank of England all signal pivot toward easier monetary policy',
                  'Inflation drops to 2.8% across G7 nations, opening door for central bank policy reversal'
                ],
                summary_bullets_news: ['Global stock indices surge to all-time highs as investors anticipate coordinated rate cuts', 'Federal Reserve, ECB and Bank of England all signal pivot toward easier monetary policy', 'Inflation drops to 2.8% across G7 nations, opening door for central bank policy reversal'],
                five_ws: {
                  who: '**Federal Reserve**, **ECB**, **Bank of England**',
                  what: 'Signal coordinated **rate cuts**, markets rally to record highs',
                  when: '**Today**, policy statements released',
                  where: '**Global markets**, **US**, **Europe**, **UK**',
                  why: 'Inflation drops to **2.8%**, easing concerns'
                },
                urlToImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
                publishedAt: new Date(Date.now() - 7200000).toISOString(),
                source: 'Today+',
                final_score: 750,  // Regular article - NOT important
                details: [
                  'S&P 500 gain: +2.4%',
                  'Current rate: 5.25%',
                  'Inflation: 2.8%'
                ],
                timeline: [
                  { date: 'Mar 2022', event: 'Fed begins aggressive rate hike cycle' },
                  { date: 'Jul 2024', event: 'Rates peak at 5.5%' },
                  { date: 'Today', event: 'Central banks signal policy pivot' }
                ],
                components: ['details', 'timeline']
              },
              {
                type: 'news',
                id: 'mock_4',
                number: 4,
                category: 'SCIENCE',
                emoji: '🔬',
                title: 'Scientists Discover New Exoplanet with Earth-Like Conditions',
                title_news: 'Scientists Discover New Exoplanet with Earth-Like Conditions',
                content_news: 'Astronomers have announced the discovery of a potentially habitable exoplanet orbiting a star just 40 light-years from Earth. The planet, named Kepler-442c, sits within its star\'s habitable zone and shows signs of having liquid water on its surface. Initial spectroscopic analysis suggests the presence of an atmosphere containing oxygen and nitrogen, making it the most Earth-like world ever discovered.',
                summary_bullets: [
                  'Astronomers discover Earth-sized planet orbiting Sun-like star just 40 light-years away',
                  'Planet Kepler-442c sits perfectly in habitable zone with signs of liquid water on surface',
                  'Spectroscopic analysis reveals atmosphere containing oxygen and nitrogen, similar to Earth'
                ],
                summary_bullets_news: ['Astronomers discover Earth-sized planet orbiting Sun-like star just 40 light-years away', 'Planet Kepler-442c sits perfectly in habitable zone with signs of liquid water on surface', 'Spectroscopic analysis reveals atmosphere containing oxygen and nitrogen, similar to Earth'],
                five_ws: {
                  who: '**NASA** astronomers, international research team',
                  what: 'Discovered **Kepler-442c** with Earth-like conditions',
                  when: '**Today**, announced in Nature journal',
                  where: '**40 light-years** from Earth, in habitable zone',
                  why: 'Shows signs of **liquid water** and oxygen atmosphere'
                },
                urlToImage: 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=800',
                publishedAt: new Date(Date.now() - 10800000).toISOString(),
                source: 'Today+',
                final_score: 720,  // Regular article - NOT important
                details: [
                  'Distance: 40 light-years',
                  'Planet size: 1.2x Earth',
                  'Temperature: 15°C avg'
                ],
                timeline: [
                  { date: '1995', event: 'First exoplanet discovered' },
                  { date: '2016', event: 'Proxima b found in nearest star system' },
                  { date: 'Today', event: 'Most Earth-like planet identified' }
                ],
                components: ['details', 'timeline']
              },
              {
                type: 'news',
                id: 'mock_5',
                number: 5,
                category: 'HEALTH',
                emoji: '💊',
                title: 'Breakthrough Treatment Shows Promise Against Alzheimer\'s',
                title_news: 'Breakthrough Treatment Shows Promise Against Alzheimer\'s',
                content_news: 'A new experimental drug has shown remarkable results in early clinical trials for Alzheimer\'s disease, reducing cognitive decline by 60% compared to placebo. The treatment, which targets amyloid plaques in the brain, represents a significant advancement in the fight against the devastating neurological condition. Researchers are now planning larger Phase 3 trials with hopes of FDA approval within three years.',
                summary_bullets: [
                  'Experimental Alzheimer\'s drug shows remarkable 60% reduction in cognitive decline in trials',
                  'Treatment works by targeting and clearing harmful amyloid plaques that accumulate in brain',
                  'FDA fast-track approval expected within 3 years following successful Phase 3 clinical trials'
                ],
                summary_bullets_news: ['Experimental Alzheimer\'s drug shows remarkable 60% reduction in cognitive decline in trials', 'Treatment works by targeting and clearing harmful amyloid plaques that accumulate in brain', 'FDA fast-track approval expected within 3 years following successful Phase 3 clinical trials'],
                five_ws: {
                  who: '**Pfizer** researchers, **1,200** trial patients',
                  what: 'New drug reduces cognitive decline by **60%**',
                  when: 'Trial results **today**, FDA approval in **3 years**',
                  where: 'Clinical trials across **US** and **Europe**',
                  why: 'Targets **amyloid plaques** that cause Alzheimer\'s'
                },
                urlToImage: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800',
                publishedAt: new Date(Date.now() - 14400000).toISOString(),
                source: 'Today+',
                final_score: 680,  // Regular article - NOT important
                details: [
                  'Decline reduction: 60%',
                  'Trial patients: 1,200',
                  'FDA timeline: 3 years'
                ],
                timeline: [
                  { date: '1906', event: 'Alzheimer\'s disease first identified' },
                  { date: '2021', event: 'First Alzheimer\'s drug approved in 20 years' },
                  { date: 'Today', event: 'Revolutionary treatment shows 60% improvement' }
                ],
                components: ['details', 'timeline']
              }
            ];
            
            // Process mock articles same as real ones
            const mockStories = [openingStory];
            mockArticles.forEach(article => {
              mockStories.push(article);
            });
            
            console.log('📰 Using', mockArticles.length, 'mock articles for testing');
            setStories(mockStories);
          }
        } else {
          console.log('📡 Response not ok:', response.status);
          // Show opening page even on error
          const fallbackOpening = {
            type: 'opening',
            date: new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            }).toUpperCase(),
            headline: 'Today Essential Global News'
          };
          setStories([fallbackOpening]);
        }
      } catch (error) {
        console.error('Error loading news:', error);
        // Show opening page even on error
        const fallbackOpening = {
          type: 'opening',
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          }).toUpperCase(),
          headline: 'Today Essential Global News'
        };
        setStories([fallbackOpening]);
      } finally {
        console.log('📰 Setting loading to false');
        setLoading(false);
      }
    };
    
    if (hasSSRData) {
      // Already have SSR data - do background refresh after 2 seconds
      // This ensures fresh content while showing cached data immediately
      const timer = setTimeout(() => {
        loadNewsData(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      // No SSR data - load immediately
      loadNewsData(false);
    }
  }, []);

  const goToStory = (index, navigationSource = 'direct') => {
    if (index >= 0 && index < stories.length) {
      // Track exit from current article before navigating
      const currentStory = stories[currentIndex];
      if (currentStory && currentStory.type === 'news' && currentStory.id) {
        // Exit event will be handled by engagement tracking
      }
      
      setCurrentIndex(index);
      setMenuOpen(false);
      
      // Mark article as read when user navigates to it
      const story = stories[index];
      if (story && story.type === 'news' && story.id && user) {
        markArticleAsRead(story.id);
        // Track article view with feed position and navigation source
        trackEvent('article_view', { 
          feed_position: index,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
          navigation_source: navigationSource
        }, story);
      }
    }
  };

  const nextStory = () => {
    const story = stories[currentIndex + 1];
    if (story?.type === 'news') {
      trackEvent('next_article', { from_position: currentIndex, to_position: currentIndex + 1 }, story);
    }
    goToStory(currentIndex + 1, 'swipe_next');
  };
  
  const prevStory = () => {
    const story = stories[currentIndex - 1];
    if (story?.type === 'news') {
      trackEvent('prev_article', { from_position: currentIndex, to_position: currentIndex - 1 }, story);
    }
    goToStory(currentIndex - 1, 'swipe_prev');
  };

  // Timeline toggle function
  const toggleTimeline = (storyIndex) => {
    const isOpening = !showTimeline[storyIndex];
    setShowTimeline(prev => ({
      ...prev,
      [storyIndex]: !prev[storyIndex]
    }));
    // Track component interaction
    const story = stories[storyIndex];
    if (story?.type === 'news') {
      trackEvent('component_click', { component: 'timeline', action: isOpening ? 'open' : 'close' }, story);
    }
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
      // Detect user's timezone automatically
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, fullName, timezone }),
      });

      let data;
      try {
        const text = await response.text();
        console.log('Raw response:', text);
        console.log('Response status:', response.status);
        try {
          data = JSON.parse(text);
        } catch (jsonError) {
          console.error('Failed to parse JSON:', jsonError, 'Raw text:', text);
          setAuthError('Server error: Invalid response. Status: ' + response.status);
          return;
        }
      } catch (parseError) {
        console.error('Failed to get response:', parseError);
        setAuthError('Server error. Please try again.');
        return;
      }

      console.log('Signup response:', { ok: response.ok, status: response.status, data });

      if (response.ok && data.success) {
        setAuthModal(null);
        setEmailConfirmation({ email });
      } else {
        // Ensure we always display a proper error string, never an object
        let errorMessage = 'Signup failed. Please try again.';
        
        // Debug: log what we received
        console.log('Signup failed - data type:', typeof data, 'data:', data);
        
        if (typeof data === 'string' && data.length > 0) {
          errorMessage = data;
        } else if (data && typeof data.message === 'string' && data.message.length > 0) {
          errorMessage = data.message;
        } else if (data && typeof data.error === 'string' && data.error.length > 0) {
          errorMessage = data.error;
        } else if (data && Object.keys(data).length === 0) {
          // Empty object case
          errorMessage = 'Server returned an empty response. Please try again.';
        }
        
        setAuthError(errorMessage);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError('Signup failed. Please check your connection and try again.');
    }
  };

  const handleForgotPassword = async (email) => {
    setAuthError('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthModal(null);
        setEmailConfirmation({ email, type: 'reset' });
      } else {
        const errorMessage = typeof data.message === 'string' 
          ? data.message 
          : 'Failed to send reset email. Please try again.';
        setAuthError(errorMessage);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setAuthError('Failed to send reset email. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      // Mark this as an explicit user logout (not an automatic session expiry)
      if (typeof window !== 'undefined') {
        window.__userClickedLogout = true;
      }
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setUser(null);
        // Clear stored session from localStorage
        localStorage.removeItem('tennews_user');
        localStorage.removeItem('tennews_session');
        localStorage.removeItem('tennews_interests'); // Also clear personalization data
      } else {
        console.error('Logout failed');
        if (typeof window !== 'undefined') window.__userClickedLogout = false;
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (typeof window !== 'undefined') window.__userClickedLogout = false;
    }
  };

  const checkUser = async () => {
    try {
      const response = await fetch('/api/auth/user');
      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setUserProfile(data.profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Check user error:', error);
      setUser(null);
      setUserProfile(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper: Convert RGB to HSL
  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
        default: h = 0;
      }
    }
    return [h * 360, s * 100, l * 100];
  };

  // Helper: Convert HSL to RGB
  const hslToRgb = (h, s, l) => {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  // Calculate relative luminance for contrast checking
  const getLuminance = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  // Calculate contrast ratio between two colors
  const getContrastRatio = (rgb1, rgb2) => {
    const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  // Check if color is too close to white
  const isTooCloseToWhite = (r, g, b, minLightness = 85) => {
    // Check RGB values - if all are above 230, it's very close to white
    if (r > 230 && g > 230 && b > 230) return true;
    
    // Check lightness in HSL
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > minLightness) return true;
    
    // Additional check: if saturation is very low and lightness is high
    if (s < 5 && l > 80) return true;
    
    return false;
  };

  // Get fallback color based on background hue
  const getFallbackColorByHue = (hue) => {
    // Blue range: 200-260 degrees
    if (hue >= 200 && hue <= 260) return { r: 26, g: 39, b: 57 }; // #1A2739 dark navy
    
    // Green range: 100-180 degrees
    if (hue >= 100 && hue <= 180) return { r: 30, g: 56, b: 42 }; // #1E382A forest green
    
    // Orange/Red range: 0-50 and 320-360 degrees
    if ((hue >= 0 && hue <= 50) || (hue >= 320 && hue <= 360)) return { r: 59, g: 36, b: 26 }; // #3B241A deep brown
    
    // Default: Gray/neutral
    return { r: 43, g: 43, b: 43 }; // #2B2B2B graphite gray
  };


  // Function to render text with highlighted important words (for bullet texts - bold + colored)
  const renderBoldText = (text, colors, category = null, isImportant = false) => {
    if (!text) return '';
    
    // Ensure text is a string
    const textStr = typeof text === 'string' ? text : String(text);

    // Use image blur color or category color for highlights
    const highlightColor = colors?.blurColor || (category ? getCategoryColors(category).primary : '#000000');
    
    const parts = textStr.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.replace(/\*\*/g, '');
        return (
          <span key={i} style={{ fontWeight: '600', color: highlightColor }}>
            {content}
          </span>
        );
      }
      return <span key={i} style={{ color: 'inherit' }}>{part}</span>;
    });
  };

  // Function to render title with highlighted important words (colored AND bold)
  const renderTitleWithHighlight = (text, colors, category = null, isImportant = false) => {
    if (!text) return '';
    
    // Ensure text is a string
    const textStr = typeof text === 'string' ? text : String(text);

    // For important articles (black bg), use bright/light highlight colors
    const highlightColor = isImportant
      ? '#F59E0B' // Bright amber/gold for important article titles (visible on black)
      : (colors?.highlight || (category ? getCategoryColors(category).primary : '#ffffff'));
    
    const parts = textStr.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.replace(/\*\*/g, '');
        return (
          <span key={i} style={{ fontWeight: '700', color: highlightColor }}>
            {content}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    let startY = 0;
    let isTransitioning = false;
    
    // Velocity tracking - using array for smooth averaging
    let velocityHistory = [];
    const VELOCITY_SAMPLES = 5;

    const handleTouchStart = (e) => {
      // Don't capture touch if it's on auth modal (but allow paywall - need to swipe back)
      if (e.target.closest('.auth-modal-overlay') || e.target.closest('.auth-modal')) {
        return;
      }
      
      // For paywall, only block if touching form elements
      if (e.target.closest('.paywall-modal')) {
        const isFormElement = e.target.tagName === 'INPUT' || 
                              e.target.tagName === 'BUTTON' || 
                              e.target.tagName === 'TEXTAREA' ||
                              e.target.closest('.auth-form');
        if (isFormElement) return;
      }

      // Don't capture touch if it's on the language switcher
      if (e.target.closest('.language-icon-btn') ||
          e.target.closest('.language-dropdown-box') ||
          e.target.closest('.language-switcher__option')) {
        return;
      }

      // Don't capture touch on expanded information boxes
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        if (e.target.closest('.map-container-advanced') ||
            e.target.closest('.timeline-container') ||
            e.target.closest('.graph-container')) {
          return;
        }
      }

      // Prevent default to stop any scrolling
      e.preventDefault();

      if (!isTransitioning) {
        const touch = e.touches[0];
        startY = touch.clientY;
        velocityHistory = [{ y: touch.clientY, t: Date.now() }];
        setIsDragging(true);
        setDragOffset(0);
      }
    };

    const handleTouchEnd = (e) => {
      // Don't handle touch if it's on auth modal (but allow paywall - need to swipe back)
      if (e.target.closest('.auth-modal-overlay') || e.target.closest('.auth-modal')) {
        return;
      }
      
      // For paywall, only block if touching form elements
      if (e.target.closest('.paywall-modal')) {
        const isFormElement = e.target.tagName === 'INPUT' || 
                              e.target.tagName === 'BUTTON' || 
                              e.target.tagName === 'TEXTAREA' ||
                              e.target.closest('.auth-form');
        if (isFormElement) {
          setDragOffset(0);
          return;
        }
      }

      // Don't handle touch if it's on the language switcher
      if (e.target.closest('.language-icon-btn') ||
          e.target.closest('.language-dropdown-box') ||
          e.target.closest('.language-switcher__option')) {
        return;
      }

      // Don't handle touch on expanded information boxes
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        if (e.target.closest('.map-container-advanced') ||
            e.target.closest('.timeline-container') ||
            e.target.closest('.graph-container')) {
          return;
        }
      }

      // Calculate velocity from history (average of recent samples)
      let velocity = 0;
      if (velocityHistory.length >= 2) {
        const recent = velocityHistory.slice(-3);  // Last 3 samples
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) {
          velocity = ((first.y - last.y) / dt) * 1000;  // px/s, positive = swiping up
        }
      }
      
      const absVelocity = Math.abs(velocity);
      
      // Smooth transitions - not too fast, not too slow
      const dynamicDuration = absVelocity > 2000 ? 0.3 : 
                              absVelocity > 1000 ? 0.35 : 
                              absVelocity > 500 ? 0.4 : 0.45;
      setTransitionDuration(dynamicDuration);

      setIsDragging(false);
      setDragOffset(0);

      if (isTransitioning) return;

      const endY = e.changedTouches[0].clientY;
      const diff = startY - endY;
      
      // Very responsive thresholds - small swipes work
      const FLICK_VELOCITY = 300;  // Lower = more sensitive
      const MIN_DISTANCE = 30;     // Minimum distance for slow swipes
      
      const shouldNavigate = absVelocity > FLICK_VELOCITY || Math.abs(diff) > MIN_DISTANCE;
      const direction = absVelocity > FLICK_VELOCITY ? (velocity > 0 ? 1 : -1) : (diff > 0 ? 1 : -1);

      if (shouldNavigate) {
        isTransitioning = true;

        // Allow backward navigation, but prevent forward navigation when paywall is active
        const isPaywallActive = !user && currentIndex >= paywallThreshold;

        if (isPaywallActive && direction > 0) {
          // Block forward navigation but reset state properly
          isTransitioning = false;
          setTransitionDuration(0.3);
          setDragOffset(0);
          return;
        }

        if (direction > 0) {
          nextStory();
        } else {
          prevStory();
        }
        
        setTimeout(() => {
          isTransitioning = false;
          setTransitionDuration(0.4);
        }, dynamicDuration * 1000 + 50);
      } else {
        // Snap back smoothly
        setTransitionDuration(0.35);
      }
    };

    // Card follows finger 1:1 during drag
    const handleTouchMove = (e) => {
      // Don't block touch if it's on auth modal (but allow paywall - need to swipe back)
      if (e.target.closest('.auth-modal-overlay') || e.target.closest('.auth-modal')) {
        return;
      }
      
      // For paywall, only block if touching form elements
      if (e.target.closest('.paywall-modal')) {
        const isFormElement = e.target.tagName === 'INPUT' || 
                              e.target.tagName === 'BUTTON' || 
                              e.target.tagName === 'TEXTAREA' ||
                              e.target.closest('.auth-form');
        if (isFormElement) return;
      }

      // Don't block touch if it's on the language switcher
      if (e.target.closest('.language-icon-btn') ||
          e.target.closest('.language-dropdown-box') ||
          e.target.closest('.language-switcher__option')) {
        return;
      }

      // Don't block touch on expanded information boxes
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        if (e.target.closest('.map-container-advanced') ||
            e.target.closest('.timeline-container') ||
            e.target.closest('.graph-container')) {
          return;
        }
      }

      // Prevent default scroll behavior
      e.preventDefault();

      if (startY && !isTransitioning) {
        const touch = e.touches[0];
        const currentY = touch.clientY;
        const now = Date.now();
        
        // Track velocity history
        velocityHistory.push({ y: currentY, t: now });
        if (velocityHistory.length > VELOCITY_SAMPLES) {
          velocityHistory.shift();
        }

        const diff = startY - currentY;
        
        // 1:1 follow - card moves exactly with finger
        // Only apply rubber-band resistance at edges
        const isAtStart = currentIndex === 0 && diff < 0;
        const isAtEnd = currentIndex === stories.length - 1 && diff > 0;
        
        let offset;
        if (isAtStart || isAtEnd) {
          // Rubber-band effect at edges - exponential resistance
          const resistance = 0.4;
          offset = diff * resistance * (1 - Math.min(Math.abs(diff) / 500, 0.5));
        } else {
          // Full 1:1 tracking in the middle
          offset = diff;
        }
        
        setDragOffset(offset);
      }
    };

    const handleWheel = (e) => {
      // Don't block wheel if it's on auth modal
      if (e.target.closest('.auth-modal-overlay') || e.target.closest('.auth-modal')) {
        return;
      }
      
      // Always prevent default scrolling - TikTok style
      e.preventDefault();

      if (isTransitioning) return;

      // Don't navigate when scrolling on expanded information boxes
      const isAnyExpanded = expandedMap[currentIndex] || expandedTimeline[currentIndex] || expandedGraph[currentIndex];
      if (isAnyExpanded) {
        const target = e.target;
        if (target.closest('.map-container-advanced') ||
            target.closest('.timeline-container') ||
            target.closest('.graph-container')) {
          return;
        }
      }
      
      if (Math.abs(e.deltaY) > 30) {
        // Allow backward navigation, but prevent forward navigation when paywall is active
        const isPaywallActive = !user && currentIndex >= paywallThreshold;
        const isForwardNavigation = e.deltaY > 0; // deltaY > 0 means scrolling down to next story

        if (isPaywallActive && isForwardNavigation) {
          // Block forward navigation when paywall is active
          return;
        }

        isTransitioning = true;
        if (e.deltaY > 0) {
          nextStory();
        } else {
          prevStory();
        }
        setTimeout(() => {
          isTransitioning = false;
        }, 350);  // Match TikTok-style faster transition
      }
    };

    const handleKeyDown = (e) => {
      if (isTransitioning) return;

      // Don't intercept keyboard shortcuts when user is typing in an input field
      const activeElement = document.activeElement;
      const target = e.target;
      const isInputFocused = (
        (activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        )) ||
        (target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )) ||
        (target && target.closest && (
          target.closest('.auth-modal') ||
          target.closest('.paywall-modal') ||
          target.closest('.auth-form')
        ))
      );
      if (isInputFocused) return;

      const isPaywallActive = !user && currentIndex >= paywallThreshold;

      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        // Allow forward navigation unless paywall is active
        if (isPaywallActive) return;

        e.preventDefault();
        isTransitioning = true;
        nextStory();
        setTimeout(() => {
          isTransitioning = false;
        }, 350);  // Match TikTok-style faster transition
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        // Always allow backward navigation
        e.preventDefault();
        isTransitioning = true;
        prevStory();
        setTimeout(() => {
          isTransitioning = false;
        }, 350);  // Match TikTok-style faster transition
      }
      // Removed 's' key handler - was interfering with typing in login/signup forms
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, stories.length, user, paywallThreshold, expandedMap, expandedTimeline, expandedGraph]);

  // Scroll lock for paywall - only prevent page-level scrolling, allow navigation
  useEffect(() => {
    const isPaywallActive = !user && currentIndex >= paywallThreshold;

    // TikTok-style: Always prevent scrolling - navigation is via swipe only
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    };
  }, [user, currentIndex, paywallThreshold]);

  // Force loading to false if stories exist (prevents stuck loading state)
  if (stories.length > 0 && loading) {
    setLoading(false);
  }
  
  // Emergency fallback - if loading takes too long, show something
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && stories.length === 0) {
        setLoading(false);
      }
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, [loading, stories.length]);
  
  // Force loading to false if we have stories
  useEffect(() => {
    if (stories.length > 0 && loading) {
      setLoading(false);
    }
  }, [stories.length, loading]);

  // Auto-rotation for information boxes
  useEffect(() => {
    // Only run if we're not in detailed article view and have stories
    if (showDetailedArticle || stories.length === 0 || !stories[currentIndex]) {
      return;
    }

    const currentStory = stories[currentIndex];
    
    // Check if auto-rotation is enabled for this article (default to true if not set)
    const isRotationEnabled = autoRotationEnabled[currentIndex] !== false;
    
    // Check if there are multiple information components to rotate through
    const componentsCount = getAvailableComponentsCount(currentStory);
    
    // Stop auto-rotation if timeline or graph is expanded
    const isExpanded = expandedTimeline[currentIndex] || expandedGraph[currentIndex];
    
    if (!isRotationEnabled || componentsCount <= 1 || isExpanded) {
      return;
    }

    // Initialize progress bar key if not set
    if (!progressBarKey[currentIndex]) {
      setProgressBarKey(prev => ({ ...prev, [currentIndex]: Date.now() }));
    }

    // Set up interval to rotate every 4 seconds
    const intervalId = setInterval(() => {
      console.log(`🔄 Auto-rotating information box for article ${currentIndex}`);
      switchToNextInformationType(currentStory, currentIndex, true); // true = isAutoRotation, skip analytics
      // Reset progress bar animation
      setProgressBarKey(prev => ({ ...prev, [currentIndex]: Date.now() }));
    }, 4000);

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [currentIndex, showDetailedArticle, stories, autoRotationEnabled, progressBarKey, showTimeline, showDetails, showMap, showGraph, expandedTimeline, expandedGraph]);
  
  if (loading) {
    return <TodayPlusLoader />;
  }

  // Time-of-day helper - uses state to avoid hydration mismatch
  const getTimeOfDay = () => timeOfDay;

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

  // Function to get greeting text based on time - uses timeOfDay state
  const getGreetingText = () => {
    if (timeOfDay === 'morning') {
      return 'Goood morning';
    } else if (timeOfDay === 'afternoon') {
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

  // Compute if current article is important (for inline usage)
  const currentStoryData = stories[currentIndex];
  const isCurrentArticleImportant = currentStoryData?.final_score >= 900 || currentStoryData?.isImportant || false;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        {/* Dynamic theme-color - updated via useEffect for better iOS support */}
        <meta name="theme-color" content={safeAreaColor} />
        <meta name="apple-mobile-web-app-status-bar-style" content={isCurrentArticleImportant ? 'black' : 'default'} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..1000&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
      </Head>
      
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* Share button - MUST be interactive on mobile */
        .share-button {
          touch-action: auto !important;
          pointer-events: auto !important;
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          user-select: none !important;
        }

        /* Apple HIG - Base Styles - TikTok-style fixed viewport */
        html {
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          padding: 0;
          margin: 0;
          width: 100vw;
          height: 100%;
          min-height: 100vh;
          min-height: -webkit-fill-available;
          overflow: hidden;
          touch-action: none;
        }

        /* Apple HIG - Body Typography & Colors - TikTok-style no scroll */
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          color: ${darkMode ? '#f5f5f7' : '#1d1d1f'};
          transition: background-color 0.3s cubic-bezier(0.28, 0, 0.4, 1), color 0.3s cubic-bezier(0.28, 0, 0.4, 1);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow: hidden;
          width: 100%;
          height: 100%;
          touch-action: none;
          /* Apply safe area padding like test page */
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }

        /* Dynamic Safe Area Overlays - Changes based on article importance */
        .safe-area-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: env(safe-area-inset-top, 47px);
          min-height: env(safe-area-inset-top, 47px);
          z-index: 99999;
          pointer-events: none;
          transition: background-color 0.25s ease-out;
          will-change: background-color;
        }
        
        .safe-area-bottom {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: env(safe-area-inset-bottom, 34px);
          min-height: env(safe-area-inset-bottom, 34px);
          z-index: 99999;
          pointer-events: none;
          transition: background-color 0.25s ease-out;
          will-change: background-color;
        }
        
        /* Ensure html/body also transition for complete effect */
        html, body {
          transition: background-color 0.25s ease-out !important;
        }

        /* Glassmorphism Variables */
        :root {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
          
          /* Responsive Typography Scale - Default for iPhone 16 Pro (393px) */
          --title-size: clamp(26px, 8vw, 48px);
          --headline-size: clamp(32px, 10vw, 60px);
          --summary-size: clamp(13px, 4vw, 17px);
          --bullet-size: clamp(14px, 4.2vw, 17px);
          --category-size: clamp(9px, 2.8vw, 12px);
          --time-size: clamp(11px, 3.3vw, 14px);
          --info-label-size: clamp(8px, 2.2vw, 10px);
          --info-value-size: clamp(16px, 4.5vw, 20px);
          --info-unit-size: clamp(10px, 2.8vw, 12px);
          
          /* Responsive Spacing */
          --content-padding: clamp(12px, 5vw, 22px);
          --title-margin: clamp(12px, 5vw, 22px);
          --section-gap: clamp(6px, 2.5vw, 14px);
          --bullet-spacing: clamp(10px, 3vw, 16px);
          
          /* Responsive Image/Header Area Height */
          --image-height: 42vh;
          --content-top-offset: 52px;
          
          /* Responsive element sizes */
          --button-size: clamp(28px, 8vw, 36px);
          --icon-size: clamp(12px, 3.5vw, 16px);
          --logo-size: clamp(14px, 4.5vw, 20px);
          --share-btn-size: clamp(28px, 8vw, 36px);
          --lang-btn-size: clamp(30px, 9vw, 38px);
          --lang-icon-size: clamp(13px, 4vw, 17px);
          --gap-size: clamp(6px, 2vw, 10px);
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;
        }

        /* Glass Container - Matching Switch Button Design */
        .glass-container {
          position: relative;
          display: flex;
          flex-direction: column;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          background-color: color-mix(in srgb, var(--c-glass) 25%, transparent);
          backdrop-filter: blur(12px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(12px) saturate(var(--saturation));
          border-radius: 20px;
          box-sizing: border-box;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2);
        }
        
        /* Glass Container - Matching Switch Button Design */
        .glass-container {
          position: relative;
          display: flex;
          flex-direction: column;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          background-color: color-mix(in srgb, var(--c-glass) 25%, transparent);
          backdrop-filter: blur(12px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(12px) saturate(var(--saturation));
          border-radius: 20px;
          box-sizing: border-box;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2);
        }

        /* Glass Container - Matching Switch Button Design */
        .glass-container {
          position: relative;
          display: flex;
          flex-direction: column;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          border-radius: 20px;
          box-sizing: border-box;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2);
          /* Keep original glassmorphism background */
          background-color: color-mix(in srgb, var(--c-glass) 25%, transparent);
          backdrop-filter: blur(12px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(12px) saturate(var(--saturation));
        }


        .glass-container .glass-filter {
          display: none;
        }

        .glass-container .glass-overlay {
          display: none;
        }

        .glass-container .glass-specular {
          display: none;
        }

        .glass-container .glass-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          color: #000;
          padding: 6px var(--content-padding, 20px) 12px var(--content-padding, 20px);
          line-height: 1.4;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100dvh;
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

        /* Apple HIG - Header Design */
        .header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 52px;
          background: ${darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(251,251,253,0.8)'};
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0;
          padding-bottom: 0;
          padding-left: var(--content-padding, 20px);
          padding-right: var(--content-padding, 20px);
          border-bottom: 0.5px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
          transition: all 0.3s cubic-bezier(0.28, 0, 0.4, 1);
          touch-action: auto;
          pointer-events: auto;
        }

        /* Logo - Apple-inspired Typography */
        .logo {
          font-size: clamp(18px, 5vw, 21px);
          font-weight: 600;
          letter-spacing: -0.6px;
          cursor: pointer;
          transition: opacity 0.25s cubic-bezier(0.28, 0, 0.4, 1);
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .logo:hover {
          opacity: 0.7;
        }

        .logo-ten {
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
          font-weight: 700;
          font-size: 22px;
        }

        /* Header Right - Navigation */
        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 14px;
          font-weight: 400;
        }

        /* Time Display - Apple Style */
        .time {
          color: ${darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.56)'};
          font-weight: 400;
          font-size: 14px;
          letter-spacing: -0.2px;
          font-variant-numeric: tabular-nums;
        }


        /* Apple HIG - Story Container - TikTok-style fixed pages */
        .story-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: calc(68px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(200px + env(safe-area-inset-bottom, 0px));
          padding-left: calc(20px + env(safe-area-inset-left, 0px));
          padding-right: calc(20px + env(safe-area-inset-right, 0px));
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          /* TikTok-style smooth spring transition */
          transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), 
                      opacity 0.3s ease-out;
          overflow: hidden;
          touch-action: none;
          z-index: 10;
          will-change: transform, opacity;
        }
        
        .story-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          /* Reduce height to leave space for information box at bottom */
          height: calc(100dvh - 250px);
          background: ${darkMode ? '#000000' : '#fff'};
          z-index: -1;
          pointer-events: none;
          /* Ensure it doesn't extend below the content area where information box is */
          max-height: calc(100dvh - 250px);
        }

        .story-content {
          max-width: 100%;
          width: 100%;
          margin: 0;
          background: transparent !important;
          background-color: transparent !important;
        }

        .paywall-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
          z-index: 1000;
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .paywall-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          max-width: 360px;
          width: 90%;
          pointer-events: auto !important;
          touch-action: auto !important;
          position: relative;
          z-index: 1001;
        }
        
        .paywall-modal * {
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .paywall-modal h2 {
          color: #1d1d1f;
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
          text-align: center;
          letter-spacing: -0.3px;
        }

        .paywall-modal p {
          color: #86868b;
          font-size: 15px;
          line-height: 1.5;
          margin: 0 0 24px 0;
          text-align: center;
        }

        .paywall-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
        }

        .paywall-footer p {
          margin: 0;
          color: #86868b;
          font-size: 14px;
        }

        .paywall-footer .auth-switch {
          background: none;
          border: none;
          color: #0066cc;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          pointer-events: auto;
        }

        .paywall-footer .auth-switch:hover {
          text-decoration: underline;
        }

        /* Ensure form inputs work in paywall modal */
        .paywall-modal input,
        .paywall-modal button,
        .paywall-modal textarea,
        .paywall-modal select {
          pointer-events: auto !important;
        }

        .paywall-modal .auth-form,
        .paywall-modal .auth-field,
        .paywall-modal .auth-submit,
        .paywall-modal .auth-error,
        .paywall-modal .auth-switch {
          pointer-events: auto !important;
        }

        .opening-container {
          text-align: center;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 var(--content-padding, 20px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: calc(100vh - 140px);
        }

        .date-header {
          font-size: clamp(10px, 3vw, 12px);
          font-weight: 600;
          letter-spacing: clamp(1px, 0.5vw, 2px);
          color: #dc2626;
          text-transform: uppercase;
          margin-bottom: clamp(24px, 6vw, 40px);
        }

        .main-headline {
          font-size: var(--headline-size);
          font-weight: 900; /* extra bold */
          line-height: 1.12; /* compact */
          letter-spacing: -1px; /* tighter */
          margin-bottom: clamp(24px, 6vw, 40px);
          color: ${darkMode ? '#ffffff' : '#0f172a'};
        }

        .subheadline {
          font-size: clamp(16px, 5vw, 22px);
          line-height: 1.4;
          margin-bottom: clamp(24px, 6vw, 40px);
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

        /* Important News - Premium Animations */
        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes importantPulse {
          0%, 100% { 
            opacity: 1;
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.7), 0 0 30px rgba(239, 68, 68, 0.4), 6px 0 25px rgba(239, 68, 68, 0.25);
          }
          50% { 
            opacity: 0.95;
            box-shadow: 0 0 25px rgba(239, 68, 68, 0.9), 0 0 50px rgba(239, 68, 68, 0.5), 10px 0 40px rgba(239, 68, 68, 0.35);
          }
        }

        .news-grid {
          display: grid;
          gap: 24px;
        }

        .news-item {
          display: block;
          padding: 0;
          border-bottom: 1px solid #e5e5e7;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 8px;
          position: relative;
          margin: 0;
          max-width: 100%;
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
          padding-bottom: 0;
          margin: 0 auto;
          max-width: 100%;
          width: 100%;
          text-align: left;
          background: transparent !important;
          background-color: transparent !important;
        }

        .news-category {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: clamp(4px, 1.5vw, 6px) clamp(8px, 2.5vw, 12px);
          border-radius: 6px;
          font-size: var(--category-size);
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: clamp(6px, 2vw, 10px);
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
          font-size: var(--title-size);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.5px;
          margin-bottom: var(--title-margin);
          color: ${darkMode ? '#ffffff' : '#000000'};
        }

        .news-summary {
          font-size: var(--summary-size);
          color: ${darkMode ? '#d1d5db' : '#4a4a4a'};
          line-height: 1.6;
          margin-bottom: var(--section-gap);
          text-align: left;
          border-bottom: none;
          padding-bottom: 0;
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

        /* Streak page bounce animation */
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
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

        /* Minimal Header Button Styles */
        .auth-btn {
          all: unset;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          pointer-events: auto;
          touch-action: auto;
          padding: 8px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          letter-spacing: -0.01em;
          font-weight: 400;
          font-size: 14px;
          color: ${darkMode ? 'rgba(255,255,255,0.9)' : '#1d1d1f'};
          background: transparent;
          border-radius: 980px;
          transition: all 0.2s ease;
          border: none;
        }

        .auth-btn:hover {
          background: ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'};
        }

        .auth-btn:active {
          transform: scale(0.96);
        }

        .subscribe-btn {
          all: unset;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          pointer-events: auto;
          touch-action: auto;
          padding: 8px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          letter-spacing: -0.01em;
          font-weight: 400;
          font-size: 14px;
          color: #ffffff;
          background: #007AFF;
          border-radius: 980px;
          transition: all 0.2s ease;
          border: none;
        }

        .subscribe-btn:hover {
          background: #0066d6;
        }

        .subscribe-btn:active {
          transform: scale(0.96);
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
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          pointer-events: auto;
        }

        .auth-modal {
          background: ${darkMode ? '#1f2937' : '#ffffff'};
          border-radius: 16px;
          width: 90%;
          max-width: 360px;
          max-height: 90vh;
          overflow-y: auto;
          pointer-events: auto;
        }

        .auth-modal * {
          pointer-events: auto;
        }

        .auth-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0;
          margin-bottom: 20px;
        }

        .auth-modal-header h2 {
          font-size: 22px;
          font-weight: 600;
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
          margin: 0;
          letter-spacing: -0.3px;
        }

        .auth-close {
          background: none;
          border: none;
          font-size: 24px;
          color: ${darkMode ? '#94a3b8' : '#86868b'};
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .auth-close:hover {
          background: ${darkMode ? '#374151' : '#f5f5f7'};
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
        }

        .auth-modal-body {
          padding: 0 24px 24px;
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .auth-error {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          pointer-events: auto !important;
          touch-action: auto !important;
        }
        
        .auth-form * {
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          pointer-events: auto !important;
          touch-action: auto !important;
        }

        .auth-field label {
          font-size: 14px;
          font-weight: 500;
          color: ${darkMode ? '#d1d5db' : '#1d1d1f'};
        }

        .auth-field input {
          padding: 12px 14px;
          border: 1px solid ${darkMode ? '#374151' : '#d2d2d7'};
          border-radius: 8px;
          font-size: 16px;
          background: ${darkMode ? '#111827' : '#ffffff'};
          color: ${darkMode ? '#ffffff' : '#1d1d1f'};
          transition: border-color 0.2s;
          pointer-events: auto !important;
          touch-action: auto !important;
          -webkit-user-select: text !important;
          user-select: text !important;
          -webkit-appearance: none;
          appearance: none;
        }

        .auth-field input:focus {
          outline: none;
          border-color: #0066cc;
        }

        .auth-field input::placeholder {
          color: ${darkMode ? '#6b7280' : '#86868b'};
        }

        .auth-field-error {
          font-size: 12px;
          color: #dc2626;
          margin-top: 4px;
        }

        .auth-submit {
          padding: 14px 24px;
          background: #007AFF;
          color: white;
          border: none;
          border-radius: 980px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
          pointer-events: auto !important;
        }

        .auth-submit:hover:not(:disabled) {
          background: #0066d6;
        }

        .auth-submit:active:not(:disabled) {
          transform: scale(0.98);
        }

        .auth-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-modal-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid ${darkMode ? '#374151' : '#e5e5e5'};
          text-align: center;
        }

        .auth-modal-footer p {
          margin: 0;
          font-size: 14px;
          color: ${darkMode ? '#94a3b8' : '#86868b'};
        }

        .auth-switch {
          background: none;
          border: none;
          color: #0066cc;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          padding: 0;
          font-size: inherit;
        }

        .auth-switch:hover {
          text-decoration: underline;
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

        /* Glassmorphism Switcher - Subtle Rounded Corners */
        .switcher {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
          --c-action: #0052f5;
          --c-bg: #E8E8E9;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;

          position: relative;
          display: flex;
          align-items: center;
          gap: 2px;
          width: auto;
          height: calc(var(--button-size, 36px) * 0.95);
          box-sizing: border-box;
          padding: 3px;
          margin: 0;
          border: none;
          border-radius: 12px;
          font-size: 10px;
          font-family: "DM Sans", sans-serif;
          background-color: color-mix(in srgb, var(--c-glass) 12%, transparent);
          backdrop-filter: blur(4px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(4px) saturate(var(--saturation));
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1);
        }

        .switcher__input {
          clip: rect(0 0 0 0);
          clip-path: inset(100%);
          height: 1px;
          width: 1px;
          overflow: hidden;
          position: absolute;
          white-space: nowrap;
        }

        /* Glassmorphism Switcher Button - Subtle Rounded Corners */
        .switcher__option {
          --c: var(--c-content);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;
          width: var(--button-size, 36px);
          height: calc(var(--button-size, 36px) * 0.78);
          box-sizing: border-box;
          border-radius: 9px;
          opacity: 1;
          transition: all 160ms;
          background: none;
          border: none;
          cursor: pointer;
        }

        .switcher__option:hover {
          --c: var(--c-action);
          cursor: pointer;
        }

        .switcher__option:hover .switcher__icon {
          scale: 1.2;
        }

        .switcher__option.active {
          --c: var(--c-content);
          cursor: auto;
        }

        .switcher__option.active .switcher__icon {
          scale: 1;
        }

        /* Glassmorphism Active Indicator - Subtle Rounded Corners */
        .switcher::after {
          content: '';
          position: absolute;
          left: 3px;
          top: 3px;
          display: block;
          width: var(--button-size, 36px);
          height: calc(var(--button-size, 36px) * 0.78);
          border-radius: 9px;
          background-color: color-mix(in srgb, var(--c-glass) 36%, transparent);
          z-index: -1;
          translate: 0 0;
          opacity: 1;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1px 0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -0.75px -0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1px -3px 0.5px -2.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.5px 1px 1.5px -0.5px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px -2px 0.5px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 1.5px 3px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1),
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1),
            opacity 400ms cubic-bezier(1, 0.0, 0.4, 1);
        }

        .switcher:has(.switcher__option:nth-child(1).active)::after {
          translate: 0 0;
          transform-origin: right;
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1),
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1);
          animation: scaleToggle 440ms ease; 
        }

        .switcher:has(.switcher__option:nth-child(2).active)::after {
          translate: 38px 0;
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1),
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1);
          animation: scaleToggle2 440ms ease; 
        }

        .switcher:has(.switcher__option:nth-child(3).active)::after {
          translate: 76px 0;
          transform-origin: left;
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1),
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1);
          animation: scaleToggle3 440ms ease; 
        }

        .switcher:has(.switcher__option:nth-child(4).active)::after {
          translate: 114px 0;
          transform-origin: left;
          transition: 
            background-color 400ms cubic-bezier(1, 0.0, 0.4, 1),
            box-shadow 400ms cubic-bezier(1, 0.0, 0.4, 1),
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1);
          animation: scaleToggle4 440ms ease; 
        }

        @keyframes scaleToggle {
          0% { scale: 1 1; }
          50% { scale: 1.1 1; }
          100% { scale: 1 1; }
        }

        @keyframes scaleToggle2 {
          0% { scale: 1 1; }
          50% { scale: 1.2 1; }
          100% { scale: 1 1; }
        } 

        @keyframes scaleToggle3 {
          0% { scale: 1 1; }
          50% { scale: 1.1 1; }
          100% { scale: 1 1; }
        }

        @keyframes scaleToggle4 {
          0% { scale: 1 1; }
          50% { scale: 1.1 1; }
          100% { scale: 1 1; }
        }

        /* Language Icon Button */
        .language-icon-btn {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          width: var(--lang-btn-size, 36px);
          height: calc(var(--lang-btn-size, 36px) * 0.9);
          --saturation: 150%;

          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 34px;
          padding: 0;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          background-color: color-mix(in srgb, var(--c-glass) 12%, transparent);
          backdrop-filter: blur(4px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(4px) saturate(var(--saturation));
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: all 0.2s ease;
        }

        .language-icon-btn:hover {
          background-color: color-mix(in srgb, var(--c-glass) 18%, transparent);
        }

        .language-icon-btn svg {
          width: var(--lang-icon-size, 16px);
          height: var(--lang-icon-size, 16px);
          opacity: 1;
        }

        /* Dropdown Box Animation */
        .language-dropdown-box {
          animation: langDropdownFade 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
          z-index: 10000;
        }

        @keyframes langDropdownFade {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        /* Language Switcher - EXACT Copy of Info Switcher */
        .language-switcher {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
          --c-action: #0052f5;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;

          position: relative;
          display: flex;
          align-items: center;
          gap: 2px;
          width: auto;
          height: 34px;
          padding: 3px;
          border-radius: 12px;
          background-color: color-mix(in srgb, var(--c-glass) 12%, transparent);
          backdrop-filter: blur(4px) saturate(var(--saturation));
          -webkit-backdrop-filter: blur(4px) saturate(var(--saturation));
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 0.9px 1.5px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -1px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1.5px -4px 0.5px -3px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.15px -0.5px 2px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent), 
            inset -0.75px 1.25px 0px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px 1.5px 2px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 1px -3.25px 0.5px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 0.5px 2.5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 3px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: all 400ms cubic-bezier(1, 0.0, 0.4, 1);
        }

        .language-switcher__option {
          --c: var(--c-content);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
          padding: 0 12px;
          min-width: 60px;
          height: 28px;
          border-radius: 9px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          font-family: "DM Sans", sans-serif;
          color: var(--c);
          transition: all 160ms;
        }

        .language-switcher__option:hover {
          --c: var(--c-action);
        }

        .language-switcher__option.active {
          --c: var(--c-content);
          cursor: auto;
        }

        .language-switcher__option svg {
          width: 12px;
          height: 12px;
          opacity: 0.7;
        }

        /* Active Indicator */
        .language-switcher::after {
          content: '';
          position: absolute;
          left: 3px;
          top: 3px;
          width: 60px;
          height: 28px;
          border-radius: 9px;
          background-color: color-mix(in srgb, var(--c-glass) 36%, transparent);
          z-index: -1;
          translate: 0 0;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1px 0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -0.75px -0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1px -3px 0.5px -2.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.5px 1px 1.5px -0.5px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px -2px 0.5px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 1.5px 3px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: translate 400ms cubic-bezier(1, 0.0, 0.4, 1);
        }

        .language-switcher:has(.language-switcher__option:nth-child(1).active)::after {
          translate: 0 0;
        }

        .language-switcher:has(.language-switcher__option:nth-child(2).active)::after {
          translate: 64px 0;
        }

        /* Timeline Animations */
        @keyframes timelineSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Pulse animation for tap indicator */
        @keyframes pulse {
          0%, 100% {
            opacity: 0.7;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(2px);
          }
        }
        
        /* Animation for language switch */
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes timelineItemFadeIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes timelineDotPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          }
        }

        @keyframes timelineLineGrow {
          from {
            transform: scaleY(0);
            transform-origin: top;
          }
          to {
            transform: scaleY(1);
            transform-origin: top;
          }
        }

        /* Advanced Map Animations */
        @keyframes mapPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(2.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes markerPulse {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.2);
            filter: brightness(1.3);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mapGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.5);
          }
        }

        .timeline-container-animated {
          animation: timelineSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .timeline-item-animated {
          animation: timelineItemFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        .timeline-item-animated:nth-child(1) {
          animation-delay: 0.1s;
        }

        .timeline-item-animated:nth-child(2) {
          animation-delay: 0.2s;
        }

        .timeline-item-animated:nth-child(3) {
          animation-delay: 0.3s;
        }

        .timeline-item-animated:nth-child(4) {
          animation-delay: 0.4s;
        }

        .timeline-item-animated:nth-child(5) {
          animation-delay: 0.5s;
        }

        .timeline-item-animated:nth-child(6) {
          animation-delay: 0.6s;
        }

        .timeline-line-animated {
          animation: timelineLineGrow 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .timeline-dot-animated {
          animation: timelineDotPulse 2s ease-in-out infinite;
        }

        /* Details Animations */
        @keyframes detailsSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes detailsItemScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes detailsValuePop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .details-container-animated {
          animation: detailsSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .details-item-animated {
          animation: detailsItemScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        .details-item-animated:nth-child(1) {
          animation-delay: 0.1s;
        }

        .details-item-animated:nth-child(2) {
          animation-delay: 0.2s;
        }

        .details-item-animated:nth-child(3) {
          animation-delay: 0.3s;
        }

        .details-value-animated {
          animation: detailsValuePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        .details-value-animated:nth-child(1) {
          animation-delay: 0.2s;
        }

        .details-value-animated:nth-child(2) {
          animation-delay: 0.3s;
        }

        .details-value-animated:nth-child(3) {
          animation-delay: 0.4s;
        }

        .switcher__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          transition: scale 200ms cubic-bezier(0.5, 0, 0, 1);
        }

        /* Original Grid Icon */
        .grid-icon {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          width: var(--icon-size, 14px);
          height: var(--icon-size, 14px);
          padding: 0.5px;
        }

        .grid-square {
          background: #000000;
          border-radius: 2px;
          width: 100%;
          height: 100%;
          transition: all 0.2s ease;
        }

        .switcher__option.active .grid-square {
          background: #000000;
        }

        .switcher__option:hover:not(.active) .grid-square {
          background: #000000;
        }

        /* Original List Icon */
        .list-icon {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 3px;
          width: var(--icon-size, 14px);
          height: var(--icon-size, 14px);
          position: relative;
        }

        .list-icon::before {
          content: '';
          position: absolute;
          left: 3px;
          top: 0;
          bottom: 0;
          width: 1.5px;
          background: #000000;
          border-radius: 1px;
          z-index: 0;
        }

        .list-line {
          display: flex;
          align-items: center;
          gap: 4px;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        .list-dot {
          width: 4px;
          height: 4px;
          background: #ffffff;
          border: 1.5px solid #000000;
          border-radius: 50%;
          flex-shrink: 0;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .list-bar {
          width: 6px;
          height: 2px;
          background: #000000;
          border-radius: 1px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .switcher__option.active .list-dot {
          background: #000000;
          border-color: #000000;
        }

        .switcher__option.active .list-bar {
          background: #000000;
        }

        .switcher__option.active .list-icon::before {
          background: #000000;
        }

        .switcher__option:hover:not(.active) .list-dot {
          border-color: #000000;
        }

        .switcher__option:hover:not(.active) .list-bar {
          background: #000000;
        }

        .switcher__option:hover:not(.active) .list-icon::before {
          background: #000000;
        }

        /* Apple HIG - Map Icon (SF Symbols Style) */
        .map-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Apple HIG - Graph Icon (SF Symbols Style) */
        .graph-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }


        /* Desktop timeline - controlled by React state for expand/collapse */
        @media (min-width: 769px) {
          .timeline-container-desktop {
            /* Height controlled by inline styles - do not override */
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
            margin: 0 auto;
            max-width: 100%;
            width: 100%;
          }
          
          .news-number {
            font-size: 20px;
            top: 0;
            left: 0;
          }
          
          .date-header {
            font-size: 11px;
            letter-spacing: 2px;
            margin-bottom: 30px;
          }
          
          .subheadline {
            font-size: clamp(15px, 4.5vw, 18px);
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
            padding: 0 var(--content-padding);
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
        }
        
        /* iPhone Pro Max / Plus models (wider screens ~430px) */
        @media (min-width: 414px) and (max-width: 480px) {
          :root {
            --title-size: 38px;
            --headline-size: 48px;
            --summary-size: 17px;
            --bullet-size: 17px;
            --category-size: 12px;
            --time-size: 14px;
            --info-label-size: 10px;
            --info-value-size: 20px;
            --info-unit-size: 11px;
            --content-padding: 22px;
            --title-margin: 22px;
            --section-gap: 14px;
            --bullet-spacing: 16px;
            --button-size: 38px;
            --icon-size: 16px;
            --logo-size: 20px;
            --share-btn-size: 38px;
            --lang-btn-size: 40px;
            --lang-icon-size: 18px;
            --gap-size: 10px;
          }
        }
        
        /* Standard iPhone 16/17 models (~390px) */
        @media (min-width: 380px) and (max-width: 413px) {
          :root {
            --title-size: 32px;
            --headline-size: 42px;
            --summary-size: 16px;
            --bullet-size: 16px;
            --category-size: 11px;
            --time-size: 13px;
            --info-label-size: 9px;
            --info-value-size: 18px;
            --info-unit-size: 10px;
            --content-padding: 18px;
            --title-margin: 18px;
            --section-gap: 12px;
            --bullet-spacing: 14px;
            --button-size: 34px;
            --icon-size: 15px;
            --logo-size: 18px;
            --share-btn-size: 34px;
            --lang-btn-size: 36px;
            --lang-icon-size: 16px;
            --gap-size: 8px;
          }
        }
        
        /* iPhone SE / iPhone 16e / smaller models (~375px and below) */
        @media (max-width: 379px) {
          :root {
            --title-size: 26px;
            --headline-size: 34px;
            --summary-size: 14px;
            --bullet-size: 14px;
            --category-size: 10px;
            --time-size: 12px;
            --info-label-size: 8px;
            --info-value-size: 20px;
            --info-unit-size: 10px;
            --content-padding: 14px;
            --title-margin: 14px;
            --section-gap: 10px;
            --bullet-spacing: 12px;
            --button-size: 30px;
            --icon-size: 13px;
            --logo-size: 16px;
            --share-btn-size: 30px;
            --lang-btn-size: 32px;
            --lang-icon-size: 14px;
            --gap-size: 6px;
          }
          
          .news-category {
            padding: 4px 8px;
          }
          
          .header {
            padding-left: 14px;
            padding-right: 14px;
          }
          
          .logo {
            font-size: 17px;
          }
        }
        
        /* Extra small screens (very compact phones) */
        @media (max-width: 340px) {
          :root {
            --title-size: 22px;
            --headline-size: 28px;
            --summary-size: 13px;
            --bullet-size: 13px;
            --category-size: 9px;
            --time-size: 11px;
            --info-label-size: 7px;
            --info-value-size: 18px;
            --info-unit-size: 9px;
            --content-padding: 10px;
            --title-margin: 10px;
            --section-gap: 8px;
            --bullet-spacing: 10px;
            --button-size: 26px;
            --icon-size: 11px;
            --logo-size: 14px;
            --share-btn-size: 26px;
            --lang-btn-size: 28px;
            --lang-icon-size: 12px;
            --gap-size: 5px;
          }
          
          .logo {
            font-size: 16px;
          }
        }
        
        /* Height-based responsive adjustments for different phone heights */
        /* Shorter phones (like iPhone SE) */
        @media (max-height: 700px) {
          :root {
            --image-height: 36vh;
            --content-top-offset: 40px;
          }
        }
        
        /* Taller phones (like iPhone Pro Max) */
        @media (min-height: 900px) {
          :root {
            --image-height: 44vh;
            --content-top-offset: 56px;
          }
        }
      `}</style>

      {/* Dynamic Safe Area Overlays - Color changes based on article importance */}
      {/* Using key prop to force re-render when color changes */}
      <div 
        key={`safe-top-${safeAreaColor}`}
        className="safe-area-top" 
        style={{ 
          backgroundColor: safeAreaColor,
          background: safeAreaColor 
        }} 
      />
      <div 
        key={`safe-bottom-${safeAreaColor}`}
        className="safe-area-bottom" 
        style={{ 
          backgroundColor: safeAreaColor,
          background: safeAreaColor 
        }} 
      />

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100dvh', overflow: 'hidden', touchAction: 'none' }}>
        {/* Logo - Always Visible, On Top of Image for News Pages - REMOVED */}

        {/* Full Header for First Page */}
        {currentIndex === 0 && (
          <div className="header">
            <div className="logo">
              Today<span className="logo-ten" style={{ color: plusColor }}>+</span>
            </div>
            
            <div style={{ flex: 1 }}></div>
            
            <div className="header-right">
              <span className="time">{currentTime}</span>
              {user ? (
                <>
                  <button className="auth-btn" onClick={handleLogout} onTouchEnd={(e) => { e.preventDefault(); handleLogout(); }}>Log out</button>
                </>
              ) : (
                <>
                  <button className="auth-btn" onClick={() => setAuthModal('login')} onTouchEnd={(e) => { e.preventDefault(); setAuthModal('login'); }}>Log in</button>
                  <button className="subscribe-btn" onClick={() => setAuthModal('signup')} onTouchEnd={(e) => { e.preventDefault(); setAuthModal('signup'); }}>Sign up</button>
                </>
              )}
            </div>
          </div>
        )}


        {/* Stories - Virtual rendering: only render stories near current index for performance */}
        {stories.map((story, index) => {
          // Only render stories within a window of ±3 from current index
          // This prevents rendering 500+ stories and crashing the browser
          const renderWindow = 3;
          const shouldRender = Math.abs(index - currentIndex) <= renderWindow;
          
          if (!shouldRender) {
            // Return an empty placeholder to maintain array indices
            return <div key={index} style={{ display: 'none' }} />;
          }
          
          // Check if this is an important article (score >= 900)
          const isImportantArticle = story.final_score >= 900 || story.isImportant;
          
          return (
          <div
            key={index}
            className="story-container"
            style={{
              transform: `${
                index === currentIndex 
                  ? `translateY(${-dragOffset}px)` 
                  : index < currentIndex 
                    ? `translateY(calc(-100% - ${dragOffset > 0 ? dragOffset * 0.8 : 0}px))` 
                    : `translateY(calc(100% - ${dragOffset < 0 ? dragOffset * 0.8 : 0}px))`
              }`,
              opacity: index === currentIndex ? 1 : (Math.abs(dragOffset) > 20 ? 0.7 : 0),
              zIndex: index === currentIndex ? 10 : 1,
              pointerEvents: index === currentIndex ? 'auto' : 'none',
              background: 'transparent',
              boxSizing: 'border-box',
              // Instant response while dragging, smooth ease when releasing
              transition: isDragging
                ? 'none'
                : `transform ${transitionDuration}s cubic-bezier(0.25, 0.1, 0.25, 1), opacity ${transitionDuration * 0.8}s ease-out`,
              overflow: 'hidden',
              touchAction: 'none',
              willChange: 'transform'
            }}
          >
            {/* Paywall for stories after threshold */}
            {index >= paywallThreshold && !user && (
              <div 
                className="paywall-overlay"
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                <div 
                  className="paywall-modal"
                  style={{ touchAction: 'auto', pointerEvents: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  <h2>Create Your Account</h2>
                  <p>Create a free account to continue reading more news.</p>
                  {authError && (
                    <div className="auth-error" style={{ marginBottom: '16px' }}>{authError}</div>
                  )}
                  <SignupForm onSubmit={handleSignup} />
                  <div className="paywall-footer" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
                    <p>Already have an account? <button className="auth-switch" onClick={() => setAuthModal('login')} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setAuthModal('login'); }} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>Login</button></p>
                  </div>
                </div>
              </div>
            )}

            <div
              className="story-content"
                              style={{
                background: 'transparent',
                backgroundColor: 'transparent',
                filter: index >= paywallThreshold && !user ? 'blur(5px)' : 'none',
                pointerEvents: index >= paywallThreshold && !user ? 'none' : 'auto',
              }}
            >
              {story.type === 'opening' ? (
                <NewFirstPage 
                  key={`first-page-${currentIndex === 0 ? 'visible' : 'hidden'}`}
                  onContinue={nextStory}
                  user={user}
                  userProfile={userProfile}
                  stories={stories}
                  readTracker={readTrackerRef.current}
                  isVisible={currentIndex === 0}
                  initialWorldEvents={initialWorldEvents}
                />
              ) : story.type === 'all-read' ? (
                // Minimal "All Caught Up" page - White background, clean design
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100vh',
                  padding: '60px 30px',
                  textAlign: 'center',
                  background: '#ffffff',
                  color: '#1d1d1f'
                }}>
                  {/* Loading or Checkmark Icon */}
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: '#f5f5f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '32px'
                  }}>
                    {loadingMore ? (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid #e0e0e0',
                        borderTop: '3px solid #1d1d1f',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    lineHeight: '1.2',
                    color: '#1d1d1f',
                    letterSpacing: '-0.5px',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    opacity: 1,
                    transform: 'translateY(0)'
                  }}>
                    {loadingMore ? 'Loading More...' : (hasMoreArticles ? 'Loading More Articles...' : story.title)}
                  </h1>
                  
                  <p style={{
                    fontSize: '17px',
                    fontWeight: '400',
                    marginBottom: '8px',
                    color: '#6e6e73',
                    lineHeight: '1.4',
                    maxWidth: '280px'
                  }}>
                    {loadingMore ? 'Fetching the next batch of news' : (hasMoreArticles ? `${totalArticles - stories.filter(s => s.type === 'news').length} more articles available` : story.message)}
                  </p>
                  
                  <p style={{
                    fontSize: '15px',
                    fontWeight: '400',
                    marginBottom: '40px',
                    color: '#86868b',
                    lineHeight: '1.4'
                  }}>
                    {loadingMore ? 'Please wait...' : (hasMoreArticles ? 'Swipe back to continue reading' : story.subtitle)}
                  </p>
                  
                  {hasMoreArticles ? (
                    <button
                      onClick={() => loadMoreArticles(currentPage + 1)}
                      disabled={loadingMore}
                      style={{
                        padding: '12px 24px',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#ffffff',
                        background: loadingMore ? '#999999' : '#1d1d1f',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loadingMore ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s, transform 0.1s',
                        letterSpacing: '-0.2px'
                      }}
                      onMouseOver={(e) => {
                        if (!loadingMore) {
                          e.target.style.background = '#333333';
                          e.target.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!loadingMore) {
                          e.target.style.background = '#1d1d1f';
                          e.target.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {loadingMore ? 'Loading...' : 'Load More Articles'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (readTrackerRef.current) {
                          readTrackerRef.current.clearHistory();
                          window.location.reload();
                        }
                      }}
                      style={{
                        padding: '12px 24px',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#ffffff',
                        background: '#1d1d1f',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s, transform 0.1s',
                        letterSpacing: '-0.2px'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#333333';
                        e.target.style.transform = 'scale(1.02)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#1d1d1f';
                        e.target.style.transform = 'scale(1)';
                      }}
                    >
                      Refresh Reading List
                    </button>
                  )}
                </div>
              ) : story.type === 'news' ? (
                <div className="news-grid" style={{ overflow: 'visible', padding: 0, margin: 0 }}>
                  
                    // Original News Item View - Everything stays the same
                  <div className="news-item" style={{ overflow: 'visible', padding: 0, position: 'relative' }}>
                    {/* News Image - With Rounded Corners and Spacing */}
                    <div style={{
                      position: 'fixed',
                      top: 'calc(-1 * env(safe-area-inset-top, 0px))',
                      left: '0',
                      right: '0',
                      width: '100vw',
                      height: 'calc(var(--image-height, 42vh) + env(safe-area-inset-top, 0px))',
                      margin: 0,
                      padding: 0,
                      background: (story.urlToImage && story.urlToImage.trim() !== '' && story.urlToImage !== 'null' && story.urlToImage !== 'undefined') ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'block',
                      zIndex: '1',
                      overflow: 'visible',
                      pointerEvents: 'none'
                    }}>
                      {(() => {
                        // Always try to show image if URL exists - be very lenient with validation
                        // Only reject if clearly invalid (null, empty, or too short to be a URL)
                        const rawUrl = story.urlToImage;
                        const hasImageUrl = rawUrl && 
                                          (typeof rawUrl === 'string' || typeof rawUrl === 'object') && 
                                          String(rawUrl).trim() !== '' && 
                                          String(rawUrl).toLowerCase() !== 'null' && 
                                          String(rawUrl).toLowerCase() !== 'undefined' &&
                                          String(rawUrl).toLowerCase() !== 'none' &&
                                          String(rawUrl).trim().length >= 5; // At least 5 chars for a valid URL
                        
                        if (!hasImageUrl) {
                          // Clean gradient placeholder (no emoji/text)
                          const categoryGradients = {
                            'Tech': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            'Business': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                            'Finance': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            'Politics': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            'World': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                            'Science': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                            'Health': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                            'Sports': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                            'Entertainment': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                            'Crypto': 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)'
                          };
                          const gradient = categoryGradients[story.category] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                          
                          return (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              background: gradient
                            }} />
                          );
                        }
                        
                        const imageUrl = String(story.urlToImage).trim();
                        // Use stable key based on story ID and URL hash, NOT timestamp
                        const urlHash = imageUrl.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
                        const imageKey = `img-${story.id || index}-${urlHash}`;
                        const isImageLoaded = loadedImages.has(imageUrl);
                        
                        return (
                          <img 
                            key={imageKey}
                            src={imageUrl}
                            alt={story.title || 'News image'}
                            loading={isImageLoaded ? "eager" : "lazy"}
                            decoding="async"
                            referrerPolicy="no-referrer"
                            style={{
                              width: '100%',
                              height: '100%',
                              minWidth: '100%',
                              minHeight: '100%',
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'cover',
                              objectPosition: 'center',
                              display: 'block',
                              margin: 0,
                              padding: 0,
                              flexShrink: 0,
                              flexGrow: 1,
                              opacity: 1,
                              visibility: 'visible',
                              pointerEvents: 'auto',
                              position: 'relative',
                              zIndex: 1
                            }}
                            onLoad={(e) => {
                              console.log('✅ Image loaded successfully:', imageUrl);
                              
                              // Mark as loaded
                              setLoadedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.add(imageUrl);
                                return newSet;
                              });
                              
                              // Ensure image is visible
                              e.target.style.opacity = '1';
                              e.target.style.visibility = 'visible';
                              e.target.style.display = 'block';
                              
                              // ADVANCED MULTI-STRATEGY COLOR EXTRACTION
                              const attemptColorExtraction = async () => {
                                console.log(`🎨 Starting advanced color extraction for article ${index}...`);
                                
                                // Strategy 1: Try direct extraction if CORS available
                                const tryDirectExtraction = () => {
                                  return new Promise((resolve, reject) => {
                                    try {
                                      // Check if we can read the existing image
                                      const canvas = document.createElement('canvas');
                                      const ctx = canvas.getContext('2d');
                                      canvas.width = e.target.naturalWidth;
                                      canvas.height = e.target.naturalHeight;
                                      ctx.drawImage(e.target, 0, 0);
                                      ctx.getImageData(0, 0, 1, 1); // Test if we can read
                                      
                                      console.log(`  ✓ Strategy 1: Direct extraction - SUCCESS`);
                                      extractDominantColor(e.target, index);
                                      resolve(true);
                                    } catch (err) {
                                      console.log(`  ✗ Strategy 1: Direct extraction - CORS blocked`);
                                      reject(err);
                                    }
                                  });
                                };
                                
                                // Strategy 2: Try CORS-enabled duplicate image
                                const tryCORSImage = () => {
                                  return new Promise((resolve, reject) => {
                                    const corsImg = new Image();
                                    corsImg.crossOrigin = 'anonymous';
                                    
                                    const timeout = setTimeout(() => {
                                      console.log(`  ✗ Strategy 2: CORS image - TIMEOUT`);
                                      reject(new Error('timeout'));
                                    }, 3000);
                                    
                                    corsImg.onload = () => {
                                      clearTimeout(timeout);
                                      try {
                                        console.log(`  ✓ Strategy 2: CORS image - SUCCESS`);
                                        extractDominantColor(corsImg, index);
                                        resolve(true);
                                      } catch (err) {
                                        console.log(`  ✗ Strategy 2: CORS image - Extraction failed`);
                                        reject(err);
                                      }
                                    };
                                    
                                    corsImg.onerror = () => {
                                      clearTimeout(timeout);
                                      console.log(`  ✗ Strategy 2: CORS image - FAILED to load`);
                                      reject(new Error('cors load failed'));
                                    };
                                    
                                    corsImg.src = imageUrl;
                                  });
                                };
                                
                                // Strategy 3: Try with CORS proxy
                                const tryCORSProxy = () => {
                                  return new Promise((resolve, reject) => {
                                    const proxyImg = new Image();
                                    proxyImg.crossOrigin = 'anonymous';
                                    
                                    // Try multiple proxy services
                                    const proxies = [
                                      `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`,
                                      `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`
                                    ];
                                    
                                    let proxyIndex = 0;
                                    
                                    const tryNextProxy = () => {
                                      if (proxyIndex >= proxies.length) {
                                        console.log(`  ✗ Strategy 3: All proxies failed`);
                                        reject(new Error('all proxies failed'));
                                        return;
                                      }
                                      
                                      const proxyUrl = proxies[proxyIndex];
                                      console.log(`  → Strategy 3: Trying proxy ${proxyIndex + 1}/${proxies.length}`);
                                      
                                      const timeout = setTimeout(() => {
                                        proxyIndex++;
                                        tryNextProxy();
                                      }, 2000);
                                      
                                      proxyImg.onload = () => {
                                        clearTimeout(timeout);
                                        try {
                                          console.log(`  ✓ Strategy 3: Proxy ${proxyIndex + 1} - SUCCESS`);
                                          extractDominantColor(proxyImg, index);
                                          resolve(true);
                                        } catch (err) {
                                          console.log(`  ✗ Strategy 3: Proxy ${proxyIndex + 1} - Extraction failed`);
                                          proxyIndex++;
                                          tryNextProxy();
                                        }
                                      };
                                      
                                      proxyImg.onerror = () => {
                                        clearTimeout(timeout);
                                        console.log(`  ✗ Strategy 3: Proxy ${proxyIndex + 1} - FAILED`);
                                        proxyIndex++;
                                        tryNextProxy();
                                      };
                                      
                                      proxyImg.src = proxyUrl;
                                    };
                                    
                                    tryNextProxy();
                                  });
                                };
                                
                                // Strategy 4: Category-based color with URL hash variation
                                // This generates VIBRANT, MEANINGFUL colors based on article category
                                const trySimplifiedExtraction = () => {
                                  return new Promise((resolve) => {
                                    console.log(`  → Strategy 4: Category-based color generation`);
                                    
                                    // Category-to-hue mapping for meaningful colors
                                    const categoryHues = {
                                      'World': 220,        // Blue - global affairs
                                      'Politics': 0,       // Red - political content
                                      'Business': 150,     // Green - business/finance
                                      'Technology': 270,   // Purple - tech
                                      'Science': 180,      // Cyan - scientific
                                      'Health': 330,       // Pink - health/medical
                                      'Sports': 25,        // Orange - sports
                                      'Entertainment': 50, // Yellow-Orange - entertainment
                                      'Lifestyle': 40,     // Amber - lifestyle
                                      'Finance': 140,      // Teal-Green - markets
                                      'Environment': 160,  // Sea Green - environment
                                      'Breaking News': 350 // Red-Pink - breaking
                                    };
                                    
                                    // Get base hue from category, or use URL hash for variety
                                    const category = story.category?.replace(/\s+/g, '') || 'World';
                                    let baseHue = categoryHues[category] || categoryHues['World'];
                                    
                                    // Add slight variation using URL/ID hash to prevent identical colors for same category
                                    const hashSource = `${story.id || ''}${imageUrl}`;
                                    const hash = hashSource.split('').reduce((acc, char) => {
                                      return char.charCodeAt(0) + ((acc << 5) - acc);
                                    }, 0);
                                    
                                    // Add ±20 hue variation based on hash
                                    const hueVariation = (Math.abs(hash) % 41) - 20; // -20 to +20
                                    const hue = (baseHue + hueVariation + 360) % 360;
                                    
                                    // Generate MORE VIBRANT colors (higher saturation)
                                    const saturation = 55 + (Math.abs(hash % 25)); // 55-80% (was 40-70%)
                                    const lightness = 30 + (Math.abs((hash >> 8) % 15)); // 30-45% (slightly lighter)
                                    
                                    const [r, g, b] = hslToRgb(hue, saturation, lightness);
                                    const blurColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                                    
                                    console.log(`  ✓ Strategy 4: Generated color ${blurColor} for category '${category}'`);
                                    
                                    // Use the same VIBRANT color generation functions
                                    const blurHsl = [hue, saturation, lightness];
                                    const highlightHsl = createTitleHighlightColor(blurHsl);
                                    const linkHsl = createBulletTextColor(blurHsl, highlightHsl);
                                    const infoBoxHsl = createInfoBoxColor(blurHsl);
                                    
                                    const [iR, iG, iB] = hslToRgb(...infoBoxHsl);
                                    const infoBoxColorHex = `rgb(${iR}, ${iG}, ${iB})`;
                                    
                                setImageDominantColors(prev => ({ 
                                  ...prev, 
                                  [index]: { 
                                        blurColor: blurColor,
                                        highlight: `hsl(${highlightHsl[0]}, ${highlightHsl[1]}%, ${highlightHsl[2]}%)`,
                                        link: `hsl(${linkHsl[0]}, ${linkHsl[1]}%, ${linkHsl[2]}%)`,
                                        infoBox: infoBoxColorHex
                                  }
                                }));
                                    
                                    resolve(true);
                                  });
                                };
                                
                                // Execute strategies in sequence with fallbacks
                                try {
                                  await tryDirectExtraction();
                                } catch (err1) {
                                try {
                                    await tryCORSImage();
                                  } catch (err2) {
                                    try {
                                      await tryCORSProxy();
                                    } catch (err3) {
                                      // Final fallback - use simplified extraction
                                      await trySimplifiedExtraction();
                                    }
                                  }
                                }
                                
                                console.log(`🎨 Color extraction complete for article ${index}`);
                              };
                              
                              // Start extraction immediately (don't wait)
                              attemptColorExtraction().catch(err => {
                                console.error(`❌ All color extraction strategies failed:`, err);
                                // Keep the default fallback color already set
                              });
                            }}
                            onError={(e) => {
                              console.error('❌ Image failed to load:', imageUrl);
                              const imgElement = e.target;
                              const parentElement = imgElement.parentElement;
                              
                              let retryCount = parseInt(imgElement.dataset.retryCount || '0');
                              const maxRetries = 6;
                              
                              if (retryCount < maxRetries) {
                                  retryCount++;
                                  imgElement.dataset.retryCount = retryCount.toString();
                                console.log(`🔄 Retry ${retryCount}/${maxRetries} for: ${imageUrl.substring(0, 60)}...`);
                                  
                                // Try different strategies on each retry
                                if (retryCount === 1) {
                                    // Retry 1: Remove referrer policy entirely
                                    imgElement.removeAttribute('referrerPolicy');
                                    imgElement.removeAttribute('crossOrigin');
                                    setTimeout(() => { imgElement.src = imageUrl; }, 150);
                                } else if (retryCount === 2) {
                                    // Retry 2: Try with unsafe-url referrer (some CDNs need this)
                                    imgElement.referrerPolicy = 'unsafe-url';
                                    setTimeout(() => { imgElement.src = imageUrl; }, 200);
                                } else if (retryCount === 3) {
                                    // Retry 3: Use CORS anonymous with no-referrer
                                    imgElement.crossOrigin = 'anonymous';
                                    imgElement.referrerPolicy = 'no-referrer';
                                    setTimeout(() => { imgElement.src = imageUrl; }, 250);
                                } else if (retryCount === 4) {
                                    // Retry 4: Remove CORS, use origin referrer
                                    imgElement.removeAttribute('crossOrigin');
                                    imgElement.referrerPolicy = 'origin';
                                    setTimeout(() => { imgElement.src = imageUrl; }, 300);
                                } else if (retryCount === 5) {
                                    // Retry 5: Try CORS proxy (images.weserv.nl - free image proxy)
                                    console.log(`🔄 Trying image proxy for: ${imageUrl.substring(0, 60)}...`);
                                    imgElement.removeAttribute('crossOrigin');
                                    imgElement.removeAttribute('referrerPolicy');
                                    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&n=-1`;
                                    setTimeout(() => { imgElement.src = proxyUrl; }, 350);
                                  } else {
                                    // Retry 6: Alternative proxy (wsrv.nl)
                                    console.log(`🔄 Trying alternative proxy for: ${imageUrl.substring(0, 60)}...`);
                                    const altProxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&n=-1`;
                                    setTimeout(() => { imgElement.src = altProxyUrl; }, 400);
                                  }
                              } else {
                                // All retries failed - show clean gradient fallback (no emoji/text)
                                console.warn('⚠️ All retries failed, showing gradient fallback');
                                imgElement.style.display = 'none';
                                if (parentElement && !parentElement.querySelector('.image-fallback')) {
                                      // Category-based gradients for visual appeal
                                      const categoryGradients = {
                                        'Tech': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        'Business': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                                        'Finance': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                        'Politics': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                        'World': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                                        'Science': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                        'Health': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                                        'Sports': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                                        'Entertainment': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                                        'Crypto': 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)'
                                      };
                                      const gradient = categoryGradients[story.category] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                                      
                                      parentElement.style.background = gradient;
                                      const fallback = document.createElement('div');
                                      fallback.className = 'image-fallback';
                                      fallback.style.cssText = `
                                        width: 100%;
                                        height: 100%;
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        z-index: 1;
                                      `;
                                      parentElement.appendChild(fallback);
                                    }
                                  }
                            }}
                            onLoadStart={() => {
                              console.log('🔄 Image loading started:', imageUrl.substring(0, 80));
                            }}
                          />
                        );
                      })()}
                      
                      {/* Graduated Blur Overlay - Ease-In Curve (55-100%) */}
                      <div style={{
                        position: 'fixed',
                        top: 'calc(var(--image-height, 42vh) * 0.55)',
                        left: '0',
                        width: '100%',
                        height: 'calc(var(--image-height, 42vh) * 0.45 + 74px)',
                        backdropFilter: 'blur(50px)',
                        WebkitBackdropFilter: 'blur(50px)',
                        background: imageDominantColors[index]?.blurColor
                          ? imageDominantColors[index].blurColor
                          : 'rgba(0,0,0,0.5)',
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 10%, rgba(0,0,0,0.19) 20%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.79) 40%, rgba(0,0,0,1) 50%, rgba(0,0,0,1) 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 10%, rgba(0,0,0,0.19) 20%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.79) 40%, rgba(0,0,0,1) 50%, rgba(0,0,0,1) 100%)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}></div>
                      
                      {/* Title Overlay with Image-Based Color Gradient */}
                      {story.urlToImage && story.urlToImage.trim() !== '' && story.urlToImage !== 'null' && story.urlToImage !== 'undefined' && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: '-20px',
                        left: 0,
                        right: 0,
                        padding: '24px 16px 8px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        background: imageDominantColors[index]?.blurColor
                          ? `linear-gradient(to bottom,
                              ${imageDominantColors[index].blurColor}26 0%,
                              ${imageDominantColors[index].blurColor}40 10%,
                              ${imageDominantColors[index].blurColor}73 30%,
                              ${imageDominantColors[index].blurColor}A6 50%,
                              ${imageDominantColors[index].blurColor}D9 70%,
                              ${imageDominantColors[index].blurColor}F2 80%,
                              ${imageDominantColors[index].blurColor}FA 90%,
                              ${imageDominantColors[index].blurColor}FF 95%,
                              ${imageDominantColors[index].blurColor}FF 100%)`
                          : 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 10%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 80%, rgba(0,0,0,0.98) 90%, rgba(0,0,0,1.0) 95%, rgba(0,0,0,1.0) 100%)',
                        zIndex: 3,
                        pointerEvents: 'none'
                      }}>
                        <h3 style={{ 
                          margin: 0,
                          fontSize: '28px',
                          fontWeight: '700',
                          lineHeight: '1.1',
                          letterSpacing: '-0.8px',
                          color: '#ffffff'
                        }}>{(() => {
                          const title = story.title_news || story.title;
                          return renderTitleWithHighlight(title, imageDominantColors[index], story.category, false);
                        })()}</h3>
                      </div>
                      )}
                      
                    </div>
                    
                    {/* Share Button - Fixed position outside image container */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Prevent double-firing on touch devices
                        if (e.currentTarget.dataset.justTouched === 'true') {
                          e.currentTarget.dataset.justTouched = 'false';
                          return;
                        }
                        
                        const articleId = story.id;
                        if (!articleId) return;
                        
                        // Track share event for personalization (HIGH weight)
                        trackEvent('article_shared', { share_method: 'click' }, story);
                        
                        // Use current domain for share URL (works on localhost and production)
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://todayplus.news';
                        const shareUrl = `${baseUrl}/?article=${articleId}`;
                        const shareTitle = story.title_news || story.title || 'News on Today+';
                        
                        // Try native share first (requires HTTPS)
                        if (navigator.share) {
                          navigator.share({ title: shareTitle, url: shareUrl }).catch((err) => {
                            // Don't show fallback if user just cancelled the share
                            if (err.name === 'AbortError') return;
                            console.log('Share failed:', err);
                          });
                        } else if (navigator.clipboard && navigator.clipboard.writeText) {
                          navigator.clipboard.writeText(shareUrl)
                            .then(() => alert('Link copied!'))
                            .catch(() => {
                              // Fallback to prompt if clipboard fails (non-HTTPS)
                              prompt('Copy this link to share:', shareUrl);
                            });
                        } else {
                          // Final fallback - show prompt dialog to copy manually
                          prompt('Copy this link to share:', shareUrl);
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Mark that we handled this via touch (to prevent onClick from also firing)
                        e.currentTarget.dataset.justTouched = 'true';
                        
                        const articleId = story.id;
                        if (!articleId) return;
                        
                        // Track share event for personalization (HIGH weight)
                        trackEvent('article_shared', { share_method: 'touch' }, story);
                        
                        // Use current domain for share URL (works on localhost and production)
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://todayplus.news';
                        const shareUrl = `${baseUrl}/?article=${articleId}`;
                        const shareTitle = story.title_news || story.title || 'News on Today+';
                        
                        // Try native share first (requires HTTPS)
                        if (navigator.share) {
                          navigator.share({ title: shareTitle, url: shareUrl }).catch((err) => {
                            // Don't show fallback if user just cancelled the share
                            if (err.name === 'AbortError') return;
                            console.log('Share failed:', err);
                          });
                        } else if (navigator.clipboard && navigator.clipboard.writeText) {
                          navigator.clipboard.writeText(shareUrl)
                            .then(() => alert('Link copied!'))
                            .catch(() => {
                              // Fallback to prompt if clipboard fails (non-HTTPS)
                              prompt('Copy this link to share:', shareUrl);
                            });
                        } else {
                          // Final fallback - show prompt dialog to copy manually
                          prompt('Copy this link to share:', shareUrl);
                        }
                      }}
                      className="share-button"
                      style={{
                        position: 'fixed',
                        top: 'calc(env(safe-area-inset-top, 0px) + var(--content-padding, 16px))',
                        right: 'var(--content-padding, 16px)',
                        width: 'var(--share-btn-size, 34px)',
                        height: 'var(--share-btn-size, 34px)',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        pointerEvents: 'auto',
                        touchAction: 'auto',
                        backgroundColor: 'color-mix(in srgb, rgba(255, 255, 255, 0.6) 12%, transparent)',
                        backdropFilter: 'blur(4px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(4px) saturate(150%)',
                        boxShadow: `
                          inset 0 0 0 0.5px rgba(255, 255, 255, 0.1),
                          inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.9),
                          inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
                          inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.6),
                          inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.12),
                          inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.2),
                          inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.2),
                          inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.1),
                          0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.1),
                          0px 3px 8px 0px rgba(0, 0, 0, 0.08)
                        `,
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                      }}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#ffffff" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ pointerEvents: 'none' }}
                      >
                        <path d="M21 12L14 5V9C7 10 4 15 3 20C5.5 16.5 9 14.5 14 14.5V19L21 12Z"/>
                      </svg>
                    </button>
                    
                    {/* Professional category-based fallback when no image */}
                    {(!story.urlToImage || story.urlToImage.trim() === '' || story.urlToImage === 'null' || story.urlToImage === 'undefined') && (() => {
                      const categoryGradients = {
                        'Tech': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        'Business': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        'Finance': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        'Politics': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        'World': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                        'Science': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        'Health': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                        'Sports': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                        'Entertainment': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                        'Crypto': 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)'
                      };
                      const categoryEmojis = {
                        'Tech': '💻', 'Business': '📊', 'Finance': '💰', 'Politics': '🏛️',
                        'World': '🌍', 'Science': '🔬', 'Health': '🏥', 'Sports': '⚽',
                        'Entertainment': '🎬', 'Crypto': '₿'
                      };
                      const gradient = categoryGradients[story.category] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                      const emoji = categoryEmojis[story.category] || story.emoji || '📰';
                      
                      return (
                        <div style={{
                          position: 'fixed',
                          top: '0',
                          left: '0',
                          right: '0',
                          width: '100vw',
                          height: 'var(--image-height, 42vh)',
                          margin: 0,
                          padding: 0,
                          background: gradient,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          zIndex: '1',
                          overflow: 'hidden',
                          pointerEvents: 'none'
                        }}>
                          <div style={{
                            fontSize: 'clamp(48px, 15vw, 64px)',
                            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
                          }}>
                            {emoji}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'rgba(255,255,255,0.9)',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            {story.category || 'News'}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Apple HIG - Content Container */}
                    <div style={{
                      position: 'fixed',
                      top: 'calc(var(--image-height, 42vh) + 20px)',
                      left: '0',
                      right: '0',
                      bottom: '0',
                      background: darkMode ? '#000000' : '#ffffff',
                      borderTopLeftRadius: '22px',
                      borderTopRightRadius: '22px',
                      zIndex: '1',
                      pointerEvents: 'none',
                      boxShadow: '0 -1px 0 0 rgba(0, 0, 0, 0.04)'
                    }}></div>
                    
                    {/* Must Know badge for important articles - liquid glass style on top left */}
                    {isImportantArticle && (
                        <div style={{
                          position: 'fixed',
                        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                        left: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px 6px 8px',
                        borderRadius: '12px',
                          zIndex: 100,
                          pointerEvents: 'none',
                        backgroundColor: 'color-mix(in srgb, rgba(255, 255, 255, 0.6) 12%, transparent)',
                        backdropFilter: 'blur(4px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(4px) saturate(150%)',
                        boxShadow: `
                          inset 0 0 0 0.5px rgba(255, 255, 255, 0.1),
                          inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.9),
                          inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
                          inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.6),
                          inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.12),
                          inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.2),
                          inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.2),
                          inset 1px -3.25px 0.5px -2px rgba(0, 0, 0, 0.1),
                          0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.1),
                          0px 3px 8px 0px rgba(0, 0, 0, 0.08)
                        `
                      }}>
                        {/* Lightning bolt icon for urgency */}
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="#ffffff"
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                        >
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#ffffff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}>
                          Must Know
                        </span>
                      </div>
                    )}
                    
                    {/* Content Area - Starts After Image */}
                    <div className="news-content" style={{
                      position: 'relative',
                        paddingTop: 'calc(var(--image-height, 42vh) + var(--content-top-offset, 52px))',
                        paddingLeft: 'var(--content-padding, 20px)',
                        paddingRight: 'var(--content-padding, 20px)',
                        zIndex: '2',
                        background: 'transparent',
                        width: '100%',
                        maxWidth: '100%',
                        margin: '0 auto',
                        marginTop: '-85px'
                      }}>
                      
                      {/* Time Since Published and Timeline Button Row - Fixed Position */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                        marginTop: '18px',
                        width: '100%',
                        position: 'relative',
                        zIndex: 10005
                      }}>
                        {/* Publisher Logo + Time Display */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-size, 8px)',
                          flex: '0 0 auto'
                        }}>
                          {/* Publisher Logo - Clickable to visit source */}
                          {story.source && story.url && (
                            <div
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                trackEvent('source_click', { url: story.url, source_name: story.source }, story);
                                window.open(story.url, '_blank', 'noopener,noreferrer');
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                trackEvent('source_click', { url: story.url, source_name: story.source }, story);
                                window.open(story.url, '_blank', 'noopener,noreferrer');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <img
                                src={getLogoUrl(story.source)}
                                alt={story.source}
                                style={{
                                  width: 'var(--logo-size, 18px)',
                                  height: 'var(--logo-size, 18px)',
                                  borderRadius: '4px',
                                  objectFit: 'contain',
                                  backgroundColor: 'transparent',
                                  transition: 'transform 0.2s ease, opacity 0.2s ease'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.transform = 'scale(1.1)';
                                  e.target.style.opacity = '0.8';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.transform = 'scale(1)';
                                  e.target.style.opacity = '1';
                                }}
                              />
                            </div>
                          )}
                          {/* Time Display */}
                          <div style={{
                            fontSize: 'var(--time-size, 13px)',
                            fontWeight: '400',
                            color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.56)',
                            letterSpacing: '-0.08px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
                          }}>
                            {story.publishedAt ? getTimeAgo(story.publishedAt) : '2h'}
                          </div>
                        </div>

                        {/* Right Side Buttons Group - Language Toggle + Switcher */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-size, 8px)',
                          flex: '0 0 auto'
                        }}>
                          {/* Language Icon Button with Working Switcher Dropdown */}
                          <div 
                            style={{ 
                              position: 'relative',
                              flex: '0 0 auto',
                              zIndex: 10010
                            }}
                          >
                            {/* Language Toggle Button - Direct Toggle with Better Icons */}
                            <button
                              className="language-icon-btn"
                              style={{}}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const currentMode = languageMode || 'advanced';
                                const newMode = currentMode === 'advanced' ? 'b2' : 'advanced';
                                setLanguageMode(newMode);
                                console.log(`✅ Language toggled globally to: ${newMode}`);
                              }}
                            >
                              {(() => {
                                const currentMode = languageMode || 'advanced';
                                const iconColor = darkMode ? '#ffffff' : '#000000';
                                return currentMode === 'advanced' ? (
                                  // Minimal bullet list icon (currently showing bullets, tap to switch to 5W)
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill={iconColor}>
                                    <circle cx="3" cy="5" r="1.5"/>
                                    <rect x="7" y="4" width="11" height="2" rx="1"/>
                                    <circle cx="3" cy="10" r="1.5"/>
                                    <rect x="7" y="9" width="11" height="2" rx="1"/>
                                    <circle cx="3" cy="15" r="1.5"/>
                                    <rect x="7" y="14" width="11" height="2" rx="1"/>
                                  </svg>
                                ) : (
                                  // Minimal 5W grid icon (currently showing 5W, tap to switch to bullets)
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill={iconColor}>
                                    <rect x="1" y="1" width="8" height="4" rx="1"/>
                                    <rect x="11" y="1" width="8" height="4" rx="1"/>
                                    <rect x="1" y="7.5" width="8" height="4" rx="1"/>
                                    <rect x="11" y="7.5" width="8" height="4" rx="1"/>
                                    <rect x="1" y="14" width="8" height="4" rx="1"/>
                                  </svg>
                                );
                              })()}
                                </button>
                                
                        </div>

                        {/* Dynamic Information Switch - Always show - Right Side */}
                        {getAvailableComponentsCount(story) >= 1 && (
                          <div className="switcher" style={{ 
                            position: 'relative',
                            flex: '0 0 auto',
                            ...(darkMode ? {
                              '--c-glass': 'rgba(255, 255, 255, 0.08)',
                              '--c-bg': 'rgba(40, 40, 40, 0.9)',
                              background: 'rgba(40, 40, 40, 0.9)'
                            } : {})
                          }}>
                            {getAvailableInformationTypes(story).map((infoType, buttonIndex) => {
                              const isActive = getCurrentInformationType(story, index) === infoType;
                              return (
                                <button
                                  key={infoType}
                                  className={`switcher__option ${isActive ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log(`${infoType} option clicked for story`, index);
                                    
                                    // Disable auto-rotation for this article when user manually interacts
                                    setAutoRotationEnabled(prev => ({ ...prev, [index]: false }));
                                    
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
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log(`${infoType} option touched for story`, index);
                                    
                                    // Disable auto-rotation for this article when user manually interacts
                                    setAutoRotationEnabled(prev => ({ ...prev, [index]: false }));
                                    
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
                                  <div className="switcher__icon">
                                    {infoType === 'details' && (
                                      <div className="grid-icon">
                                        <div className="grid-square" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                        <div className="grid-square" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                        <div className="grid-square" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                        <div className="grid-square" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                      </div>
                                    )}
                                    {infoType === 'timeline' && (
                                      <div className="list-icon">
                                        <div className="list-line">
                                          <div className="list-dot" style={darkMode ? { background: '#ffffff', border: '1.5px solid #ffffff' } : {}}></div>
                                          <div className="list-bar" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                        </div>
                                        <div className="list-line">
                                          <div className="list-dot" style={darkMode ? { background: '#ffffff', border: '1.5px solid #ffffff' } : {}}></div>
                                          <div className="list-bar" style={darkMode ? { background: '#ffffff' } : {}}></div>
                                        </div>
                                        <div className="list-line">
                                          <div className="list-dot" style={darkMode ? { background: '#ffffff', border: '1.5px solid #ffffff' } : {}}></div>
                                          <div className="list-bar" style={darkMode ? { background: '#ffffff' } : {}}></div>
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
                                          border: `2px solid #000000`,
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
                                            background: '#000000',
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
                                            background: darkMode ? '#ffffff' : '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '6px',
                                            background: darkMode ? '#ffffff' : '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '4px',
                                            background: darkMode ? '#ffffff' : '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '8px',
                                            background: darkMode ? '#ffffff' : '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        </div>
                      </div>
                      
                      {/* Summary/Bullet Points - Click/Tap to toggle between bullets and 5W's */}
                      <div
                        className="news-summary"
                        style={{
                          marginTop: '-18px',
                          marginBottom: '0',
                          fontSize: '16px',
                          lineHeight: '1.6',
                          color: '#4a4a4a',
                          opacity: '1',
                          padding: '8px 0',
                          position: 'relative',
                          zIndex: 5,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          height: 'calc(58vh - 180px)',
                          minHeight: '160px',
                          maxHeight: 'calc(58vh - 140px)'
                        }}
                        onTouchStart={(e) => {
                          // Store touch start position for tap detection
                          e.currentTarget.touchStartX = e.touches[0].clientX;
                          e.currentTarget.touchStartY = e.touches[0].clientY;
                          e.currentTarget.touchStartTime = Date.now();
                        }}
                        onTouchEnd={(e) => {
                          // Check if it was a tap (not a swipe)
                          const diffX = Math.abs(e.changedTouches[0].clientX - (e.currentTarget.touchStartX || 0));
                          const diffY = Math.abs(e.changedTouches[0].clientY - (e.currentTarget.touchStartY || 0));
                          const timeDiff = Date.now() - (e.currentTarget.touchStartTime || 0);
                          
                          // If movement is small and duration is short, it's a tap
                          if (diffX < 15 && diffY < 15 && timeDiff < 300) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Toggle between bullets and 5W's (same as language button)
                            const currentMode = languageMode || 'advanced';
                            const newMode = currentMode === 'advanced' ? 'b2' : 'advanced';
                            setLanguageMode(newMode);
                            console.log(`✅ Tapped on text - toggled to: ${newMode}`);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Toggle between bullets and 5W's (same as language button)
                          const currentMode = languageMode || 'advanced';
                          const newMode = currentMode === 'advanced' ? 'b2' : 'advanced';
                          setLanguageMode(newMode);
                          console.log(`✅ Clicked on text area - toggled to: ${newMode}`);
                        }}
                      >
                        <div 
                          className="summary-content"
                          style={{ 
                            cursor: 'pointer', 
                            pointerEvents: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            height: '100%'
                          }}
                        >
                          {/* Show Only Bullet Text - Fixed Position */}
                          <div style={{ 
                            margin: 0,
                            marginTop: '-3px',
                            marginBottom: '0px',
                            position: 'relative',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            height: '100%'
                          }}>
                              {(() => {
                                // Toggle between bullets and 5W's based on language mode
                                // 'advanced' mode = narrative bullets (80-100 chars)
                                // 'b2' mode = 5 W's structured format (WHO/WHAT/WHEN/WHERE/WHY)
                                const mode = languageMode || 'advanced';
                                
                                // Get bullets and 5W's
                                const bullets = story.summary_bullets_news || story.summary_bullets || [];
                                // Parse five_ws if it's a string (failsafe)
                                let fiveWs = story.five_ws || null;
                                if (typeof fiveWs === 'string') {
                                  try {
                                    fiveWs = JSON.parse(fiveWs);
                                  } catch (e) {
                                    console.error('Error parsing five_ws string:', e);
                                    fiveWs = null;
                                  }
                                }
                                
                                // Show 5W's if mode is 'b2' and five_ws exists with at least one field
                                const hasFiveWsData = fiveWs && typeof fiveWs === 'object' && Object.keys(fiveWs).length > 0;
                                const showFiveWs = mode === 'b2' && hasFiveWsData;
                                
                                // Render 5 W's format
                                if (showFiveWs) {
                                  const wsLabels = [
                                    { key: 'who', label: 'WHO' },
                                    { key: 'what', label: 'WHAT' },
                                    { key: 'when', label: 'WHEN' },
                                    { key: 'where', label: 'WHERE' },
                                    { key: 'why', label: 'WHY' }
                                  ];
                                  
                                  // Function to strip 5W labels from the text
                                  const strip5WLabel = (text, labelKey) => {
                                    if (!text || typeof text !== 'string') return text;
                                    // Remove patterns like "WHO:", "Who:", "who:", "WHO -", "WHO–", etc.
                                    const patterns = [
                                      new RegExp(`^\\s*${labelKey}\\s*[:：\\-–—]\\s*`, 'i'),
                                      new RegExp(`^\\s*${labelKey}\\s+`, 'i')
                                    ];
                                    let cleaned = text;
                                    for (const pattern of patterns) {
                                      cleaned = cleaned.replace(pattern, '');
                                    }
                                    return cleaned.trim();
                                  };
                                  
                                  return (
                                    <div style={{
                                      margin: 0,
                                      marginTop: '0',
                                      padding: 0,
                                      transition: 'opacity 0.3s ease',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-evenly',
                                      flex: 1,
                                      height: '100%',
                                      minHeight: '150px'
                                    }}>
                                      {wsLabels.map((ws, i) => {
                                        let value = fiveWs[ws.key];
                                        if (!value) return null;
                                        
                                        // Strip any embedded 5W label from the text
                                        value = strip5WLabel(value, ws.key);
                                        
                                        return (
                                          <div key={ws.key} style={{
                                            marginBottom: '0',
                                            animation: 'fadeSlideIn 0.4s ease',
                                            animationDelay: `${i * 0.06}s`,
                                            animationFillMode: 'both',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px',
                                            flex: '0 0 auto'
                                          }}>
                                            <span style={{
                                              fontSize: '12px',
                                              fontWeight: '700',
                                              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
                                              color: imageDominantColors[index]?.blurColor || getCategoryColors(story.category).primary,
                                              width: '52px',
                                              minWidth: '52px',
                                              maxWidth: '52px',
                                              letterSpacing: '0.03em',
                                              paddingTop: '2px',
                                              textAlign: 'left'
                                            }}>
                                              {ws.label}
                                            </span>
                                            <span style={{
                                              fontSize: '15px',
                                              lineHeight: '1.45',
                                              fontWeight: '400',
                                              color: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                                              flex: 1
                                            }}>
                                              {renderBoldText(value, imageDominantColors[index], story.category, false)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                
                                // Render narrative bullets (default)
                                return bullets && bullets.length > 0 ? (
                                <ul style={{
                                  margin: 0,
                                  marginTop: '0',
                                  padding: 0,
                                  listStyle: 'none',
                                  transition: 'opacity 0.3s ease',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-evenly',
                                  flex: 1,
                                  height: '100%',
                                  minHeight: '150px'
                                }}>
                                  {bullets.map((bullet, i) => (
                                    <li key={`${languageMode}-${i}`} style={{
                                      marginBottom: '0',
                                      fontSize: 'var(--bullet-size, 15px)',
                                      lineHeight: '1.5',
                                      fontWeight: '400',
                                      letterSpacing: '-0.01em',
                                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
                                      animation: 'fadeSlideIn 0.4s ease',
                                      animationDelay: `${i * 0.08}s`,
                                      animationFillMode: 'both',
                                      paddingLeft: 'var(--bullet-spacing, 16px)',
                                      position: 'relative',
                                      color: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                                      flex: '0 0 auto'
                                    }}>
                                      <span style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: '8px',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: imageDominantColors[index]?.blurColor || getCategoryColors(story.category).primary
                                      }}></span>
                                      {renderBoldText(bullet, imageDominantColors[index], story.category, false)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
                                  No bullet points available
                                </p>
                                );
                              })()}
                          </div>
                          
                          {/* Article text removed - clicking on bullets/5W's now toggles between them */}
                        </div>
                        
                      </div>
                      
                    </div>
                    {/* End of news-content div */}
                      
                      {/* Fixed Position Toggle and Content Area - Lower Position */}
                    {/* Always show information box if there are any available components, regardless of image presence */}
                    {/* MOVED OUTSIDE news-content to fix stacking context issue */}
                    {getAvailableComponentsCount(story) > 0 && (
                      <div style={{
                        position: 'fixed',
                        bottom: '5px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '100%',
                        maxWidth: '1200px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        zIndex: 99999,
                        marginTop: '0',
                        marginLeft: '0',
                        marginRight: '0',
                        pointerEvents: 'auto',
                        display: 'block',
                        visibility: 'visible',
                        opacity: 1,
                        isolation: 'isolate'
                      }}>
                        
                        {/* Details/Timeline Section - At end of article when detailed text is showing */}
                        <div 
                        style={{ 
                          position: 'relative', 
                          overflow: 'visible', 
                          cursor: getAvailableComponentsCount(story) > 1 ? 'pointer' : 'default',
                          display: 'flex',
                          visibility: 'visible',
                          minHeight: '85px',
                          zIndex: 99999,
                          opacity: 1,
                          height: showTimeline[index] ? (expandedTimeline[index] ? '300px' : '85px') : '85px',
                          maxHeight: showTimeline[index] ? (expandedTimeline[index] ? '300px' : '85px') : '85px',
                          backgroundColor: 'transparent',
                          background: 'transparent',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                          border: 'none',
                          borderRadius: '0',
                          boxShadow: 'none'
                        }}
                        onTouchStart={(e) => {
                          // Check if touch started on expand icon - if so, don't handle it
                          const touchTarget = e.target;
                          const isExpandIcon = touchTarget.closest('[data-expand-icon]');
                          if (isExpandIcon) return;
                          
                          // Don't handle swipe/tap when any info box is expanded
                          const isAnyExpanded = expandedMap[index] || expandedTimeline[index] || expandedGraph[index];
                          if (isAnyExpanded) return;
                          
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
                              
                              // Disable auto-rotation for this article when user manually interacts
                              setAutoRotationEnabled(prev => ({ ...prev, [index]: false }));
                              
                              switchToNextInformationType(story, index);
                            } else if (!hasMoved) {
                              // Check if the touch target is the expand icon
                              const touchTarget = endEvent.target;
                              const isExpandIcon = touchTarget.closest('[data-expand-icon]');
                              
                              // Check if any information box is expanded - don't switch if expanded
                              const isAnyExpanded = expandedMap[index] || expandedTimeline[index] || expandedGraph[index];
                              
                              if (!isExpandIcon && !isAnyExpanded) {
                                // Single tap switches information type (only when collapsed)
                                console.log('Information box tap detected for story', index);
                                endEvent.preventDefault();
                                endEvent.stopPropagation();
                                
                                // Disable auto-rotation for this article when user manually interacts
                                setAutoRotationEnabled(prev => ({ ...prev, [index]: false }));
                                
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
                        {/* Default to first component from components array */}
                        {(() => {
                          // If no state is set, default to first component in the components array
                          if (!showDetails[index] && !showTimeline[index] && !showMap[index] && !showGraph[index]) {
                            const availableTypes = getAvailableInformationTypes(story);
                            if (availableTypes.length > 0) {
                              const firstType = availableTypes[0];
                              
                              switch (firstType) {
                                case 'details':
                                  setShowDetails(prev => {
                                    if (!prev[index]) {
                                      return { ...prev, [index]: true };
                                    }
                                    return prev;
                                  });
                                  break;
                                case 'timeline':
                                  setShowTimeline(prev => {
                                    if (!prev[index]) {
                                      return { ...prev, [index]: true };
                                    }
                                    return prev;
                                  });
                                  break;
                                case 'map':
                                  setShowMap(prev => {
                                    if (!prev[index]) {
                                      return { ...prev, [index]: true };
                                    }
                                    return prev;
                                  });
                                  break;
                                case 'graph':
                                  setShowGraph(prev => {
                                    if (!prev[index]) {
                                      return { ...prev, [index]: true };
                                    }
                                    return prev;
                                  });
                                  break;
                              }
                            }
                          }
                          return null;
                        })()}
                        {/* Render components based on what's active, respecting components array order */}
                        {(() => {
                          // Determine which component to show based on active state
                          // If a state is explicitly set, show that component
                          if (showGraph[index]) {
                            // Show Graph - Similar to timeline with expand/collapse
                            return story.graph && (
                              <div 
                                className="glass-container graph-container-desktop"
                                style={{
                                  position: 'absolute',
                                  bottom: '0',
                                  left: '0',
                                  right: '0',
                                  height: expandedGraph[index] ? '300px' : '85px',
                                  maxHeight: expandedGraph[index] ? '300px' : '85px',
                                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                  minHeight: '85px',
                                  zIndex: '10',
                                  overflowY: expandedGraph[index] ? 'visible' : 'hidden'
                                }}>
                                <div className="glass-filter"></div>
                                <div className="glass-overlay"></div>
                                <div className="glass-specular"></div>
                                <div className="glass-content" style={{
                                  height: '100%',
                                  width: '100%',
                                  padding: '8px 12px',
                                  justifyContent: 'flex-start',
                                  position: 'relative'
                                }}>
                                {/* Expand Icon */}
                                <div 
                                  data-expand-icon="true"
                                  style={{
                                    position: 'absolute',
                                    top: '6px',
                                    right: '6px',
                                    width: '24px',
                                    height: '24px',
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
                                    console.log('Expand graph icon clicked for story', index);
                                    setExpandedGraph(prev => ({
                                      ...prev,
                                      [index]: !prev[index]
                                    }));
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Expand graph icon touched for story', index);
                                    setExpandedGraph(prev => ({
                                      ...prev,
                                      [index]: !prev[index]
                                    }));
                                  }}>
                                  <span style={{
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    color: '#000000',
                                    transform: expandedGraph[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)'
                                  }}>
                                    ↗
                                  </span>
                                </div>
                                
                                <div style={{
                                  position: 'relative',
                                  height: '100%',
                                  width: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start'
                                }}>
                                  {/* Graph Title - Minimal */}
                                  <div style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    color: imageDominantColors[index]?.highlight || '#000000',
                                    marginBottom: '4px',
                                    letterSpacing: '0.3px',
                                    textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                    opacity: 0.9
                                  }}>
                                    {story.graph.title || 'Data Visualization'}
                                  </div>
                                  
                                  {/* Chart Container */}
                                  <div style={{
                                    width: '100%',
                                    height: expandedGraph[index] ? '260px' : '55px',
                                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    overflow: expandedGraph[index] ? 'visible' : 'hidden'
                                  }}>
                                    {story.graph && story.graph.data && story.graph.data.length > 0 ? (
                                      <GraphChart 
                                        graph={story.graph} 
                                        expanded={expandedGraph[index]} 
                                        accentColor={imageDominantColors[index]?.highlight || '#3b82f6'}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                              justifyContent: 'center',
                                        color: '#000000',
                                        fontSize: '12px',
                                        textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)'
                            }}>
                                        No graph data available
                                      </div>
                                    )}
                                  </div>
                                </div>
                                </div>
                            </div>
                          );
                          } else if (showTimeline[index]) {
                            // Show Timeline
                            return story.timeline && (
                            <div 
                              className="glass-container timeline-container-desktop timeline-container-animated"
                              style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                height: expandedTimeline[index] ? '300px' : '85px',
                                maxHeight: expandedTimeline[index] ? '300px' : '85px',
                                transition: 'height 0.3s ease-in-out',
                                minHeight: '85px',
                                zIndex: '10',
                                overflow: expandedTimeline[index] ? 'visible' : 'hidden'
                              }}>
                              <div className="glass-filter"></div>
                              <div className="glass-overlay"></div>
                              <div className="glass-specular"></div>
                              <div className="glass-content" style={{
                                height: '100%',
                                overflow: expandedTimeline[index] ? 'visible' : 'hidden',
                                padding: '8px 12px',
                                justifyContent: 'flex-start',
                                position: 'relative'
                              }}>
                               {/* Expand Icon */}
                               <div 
                                 data-expand-icon="true"
                                 style={{
                                 position: 'absolute',
                                 top: '6px',
                                 right: '6px',
                                 width: '24px',
                                 height: '24px',
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
                                 console.log('Expand icon clicked for story', index, 'current state:', expandedTimeline[index], 'will toggle to:', !expandedTimeline[index]);
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
                                   fontSize: '16px',
                                   fontWeight: 'bold',
                                   color: '#000000',
                                   transform: expandedTimeline[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                                   transition: 'transform 0.2s ease',
                                   textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)'
                                 }}>
                                   ↗
                                 </span>
                               </div>
                              
                              <div style={{
                                position: 'relative',
                                height: '100%',
                                overflow: expandedTimeline[index] ? 'visible' : 'hidden',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start'
                              }}>
                                <div className="timeline-line-animated" style={{
                                  position: 'absolute',
                                  left: '8px',
                                  top: '0px',
                                  bottom: '8px',
                                  width: '2px',
                                  background: imageDominantColors[index]?.highlight 
                                    ? `linear-gradient(180deg, ${imageDominantColors[index].highlight}, ${imageDominantColors[index].blurColor})`
                                    : 'linear-gradient(180deg, #3b82f6, #93c5fd)',
                                  zIndex: '0',
                                  borderRadius: '2px',
                                  boxShadow: imageDominantColors[index]?.highlight 
                                    ? `0 2px 4px ${imageDominantColors[index].highlight}40`
                                    : '0 2px 4px rgba(59, 130, 246, 0.3)'
                                }}></div>
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start',
                                  height: '100%',
                                  paddingLeft: '20px',
                                  paddingTop: '0px',
                                  paddingBottom: '8px'
                                }}>
                                  {story.timeline.slice(0, expandedTimeline[index] ? story.timeline.length : 2).map((event, idx) => (
                                    <div key={idx} className="timeline-item-animated" style={{
                                      position: 'relative',
                                      marginBottom: expandedTimeline[index] ? '12px' : '8px',
                                      paddingLeft: '0px',
                                      minHeight: expandedTimeline[index] ? '36px' : '24px',
                                      marginTop: idx === 0 ? '0px' : '0px'
                                    }}>
                                    <div className="timeline-dot-animated" style={{
                                      position: 'absolute',
                                      left: '-15px',
                                      top: '2px',
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      background: idx === story.timeline.length - 1 
                                        ? (imageDominantColors[index]?.highlight || '#3b82f6')
                                        : 'white',
                                      border: `2px solid ${imageDominantColors[index]?.highlight || '#3b82f6'}`,
                                      zIndex: '2',
                                      boxShadow: imageDominantColors[index]?.highlight 
                                        ? `0 2px 4px ${imageDominantColors[index].highlight}33`
                                        : '0 2px 4px rgba(59, 130, 246, 0.2)'
                                    }}></div>
                                    <div style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      color: imageDominantColors[index]?.highlight || '#000000',
                                      marginBottom: '2px',
                                      letterSpacing: '0.3px',
                                      marginTop: '0px',
                                      textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                      opacity: 0.9
                                    }}>{event.date}</div>
                                    <div style={{
                                      fontSize: expandedTimeline[index] ? '13px' : '11px',
                                      fontWeight: '500',
                                      color: '#000000',
                                      lineHeight: '1.3',
                                      marginTop: '0px',
                                      textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                      overflow: expandedTimeline[index] ? 'visible' : 'hidden',
                                      textOverflow: expandedTimeline[index] ? 'clip' : 'ellipsis',
                                      whiteSpace: expandedTimeline[index] ? 'normal' : 'nowrap'
                                    }}>{event.event}</div>
                                  </div>
                                ))}
                                </div>
                              </div>
                              </div>
                            </div>
                          );
                          } else if (showMap[index]) {
                            // Show Map - Advanced Professional Design
                            return story.map && (
                              <div 
                                className="glass-container map-container-advanced"
                                style={{
                                  position: 'absolute',
                                  bottom: '0',
                                  left: '0',
                                  right: '0',
                                  height: expandedMap[index] ? '320px' : '85px',
                                  maxHeight: expandedMap[index] ? '320px' : '85px',
                                  // Smooth spring animation - faster expand, natural deceleration
                                  transition: expandedMap[index] 
                                    ? 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1), max-height 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
                                    : 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1), max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                                  minHeight: '85px',
                                  zIndex: '10',
                                  overflow: 'hidden',
                                  willChange: 'height, max-height'
                                }}>
                                <div className="glass-filter"></div>
                                <div className="glass-overlay"></div>
                                <div className="glass-specular"></div>
                                <div className="glass-content" style={{
                                  height: '100%',
                                  width: '100%',
                                  padding: '8px 12px',
                                  justifyContent: 'flex-start',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}>
                                  {/* Expand Icon */}
                                  <div 
                                    data-expand-icon="true"
                                    style={{
                                      position: 'absolute',
                                      top: '6px',
                                      right: '6px',
                                      width: '24px',
                                      height: '24px',
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
                                      setExpandedMap(prev => ({
                                        ...prev,
                                        [index]: !prev[index]
                                      }));
                                    }}
                                    onTouchEnd={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setExpandedMap(prev => ({
                                        ...prev,
                                        [index]: !prev[index]
                                      }));
                                    }}>
                                    <span style={{
                                      fontSize: '16px',
                                      fontWeight: 'bold',
                                      color: '#000000',
                                      transform: expandedMap[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                      textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)'
                                    }}>
                                      ↗
                                    </span>
                                  </div>

                                  {/* Map Container */}
                                  <div style={{
                                    position: 'relative',
                                    height: '100%',
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column'
                                  }}>
                                    {/* Location Header - Compact */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginBottom: expandedMap[index] ? '8px' : '4px'
                                    }}>
                                      <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: imageDominantColors[index]?.highlight || '#3b82f6',
                                        boxShadow: `0 0 8px ${imageDominantColors[index]?.highlight || '#3b82f6'}`,
                                        animation: 'pulse 2s ease-in-out infinite'
                                      }}></div>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        color: imageDominantColors[index]?.highlight || '#000000',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)'
                                      }}>
                                        {story.map.location || 'Global Location'}
                                      </span>
                                    </div>

                                    {/* Mapbox Map */}
                                    <div style={{
                                      flex: 1,
                                      position: 'relative',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      height: expandedMap[index] ? '260px' : '50px',
                                      minHeight: expandedMap[index] ? '260px' : '50px',
                                      // Match outer container's smooth spring animation
                                      transition: expandedMap[index]
                                        ? 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1), min-height 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
                                        : 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1), min-height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                                      willChange: 'height, min-height'
                                    }}>
                                      <MapboxMap
                                        center={story.map.center || { lat: 0, lon: 0 }}
                                        markers={story.map.markers || []}
                                        expanded={expandedMap[index]}
                                        highlightColor={imageDominantColors[index]?.highlight || '#3b82f6'}
                                        locationType={story.map.location_type || 'auto'}
                                        regionName={story.map.region_name || null}
                                        location={story.map.location || story.map.name || null}
                                      />

                                      {/* Coordinates Display - Bottom Left */}
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '10px',
                                        display: 'flex',
                                        gap: '12px',
                                        fontSize: '9px',
                                        fontFamily: 'SF Mono, Monaco, monospace',
                                        color: 'rgba(255,255,255,0.7)',
                                        letterSpacing: '0.5px',
                                        zIndex: 10
                                      }}>
                                        <span>LAT {story.map.center?.lat?.toFixed(4) || '0.0000'}°</span>
                                        <span>LON {story.map.center?.lon?.toFixed(4) || '0.0000'}°</span>
                                      </div>

                                      {/* Region Label - Bottom Right */}
                                      {story.map.region && (
                                        <div style={{
                                          position: 'absolute',
                                          bottom: '8px',
                                          right: '10px',
                                          fontSize: '9px',
                                          fontWeight: '600',
                                          color: imageDominantColors[index]?.highlight || '#3b82f6',
                                          textTransform: 'uppercase',
                                          letterSpacing: '1px',
                                          background: 'rgba(0,0,0,0.5)',
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          zIndex: 10
                                        }}>
                                          {story.map.region}
                                        </div>
                                      )}

                                      {/* Expanded Info Panel */}
                                      {expandedMap[index] && story.map.description && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '10px',
                                          left: '10px',
                                          right: '60px',
                                          background: 'rgba(0,0,0,0.6)',
                                          backdropFilter: 'blur(8px)',
                                          borderRadius: '6px',
                                          padding: '8px 12px',
                                          fontSize: '11px',
                                          color: 'rgba(255,255,255,0.9)',
                                          lineHeight: '1.4',
                                          animation: 'fadeIn 0.3s ease',
                                          zIndex: 10
                                        }}>
                                          {story.map.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (showDetails[index]) {
                            // Show Details
                            return story.details && (
                              <div
                                className={`glass-container details-container-desktop details-container-animated`}
                                style={{
                                  position: 'absolute',
                                  bottom: '0',
                                  left: '0',
                                  right: '0',
                                  height: '85px',
                                  maxHeight: '85px',
                                  minHeight: '85px',
                                  zIndex: '10',
                                  overflow: 'hidden',
                                  display: 'flex'
                                }}>
                                <div className="glass-filter"></div>
                                <div className="glass-overlay"></div>
                                <div className="glass-specular"></div>
                                <div className="glass-content" style={{
                                  height: '100%',
                                  width: '100%',
                                  display: 'flex',
                                  flexDirection: 'row',
                                  justifyContent: 'space-around',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '10px 16px'
                                }}>
                                  {story.details.slice(0, 3).map((detail, i) => {
                                    // Handle both string and object formats
                                    let cleanLabel = '';
                                    let cleanValue = '';
                                    
                                    if (typeof detail === 'object' && detail !== null) {
                                      // Object format: { label: 'Impact Score', value: '8.5/10' }
                                      cleanLabel = detail.label || detail.name || '';
                                      cleanValue = detail.value || detail.description || '';
                                    } else if (typeof detail === 'string') {
                                      // String format: "Impact Score: 8.5/10"
                                      const [label, value] = detail.split(':');
                                      cleanLabel = label?.trim() || '';
                                      cleanValue = value?.trim() || '';
                                    }
                                    
                                    // Extract main number/value and subtitle
                                    const valueMatch = cleanValue.match(/^([^a-z]*[0-9][^a-z]*)\s*(.*)$/i);
                                    const mainValue = valueMatch ? valueMatch[1].trim() : cleanValue;
                                    const subtitle = valueMatch ? valueMatch[2].trim() : '';
                                    
                                    return (
                                      <div key={i} className="news-detail-item details-item-animated" style={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        flex: 1,
                                        color: darkMode ? '#ffffff' : '#000000'
                                      }}>
                                        <div className="news-detail-label" style={{
                                          color: darkMode ? 'rgba(255,255,255,0.7)' : '#000000',
                                          fontSize: 'var(--info-label-size, 9px)',
                                          fontWeight: '700',
                                          marginBottom: '3px',
                                          textAlign: 'center',
                                          textShadow: darkMode ? 'none' : '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                          opacity: 0.7,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px'
                                        }}>{cleanLabel}</div>
                                        <div className="news-detail-value details-value-animated" style={{ 
                                          color: imageDominantColors[index]?.infoBox || imageDominantColors[index]?.blurColor || '#3A4A5E',
                                          fontSize: 'var(--info-value-size, 18px)',
                                          fontWeight: '800',
                                          textAlign: 'center',
                                          textShadow: 'none',
                                          lineHeight: '1.1'
                                        }}>{mainValue}</div>
                                        {subtitle && <div className="news-detail-subtitle" style={{ 
                                          color: darkMode ? 'rgba(255,255,255,0.6)' : '#333333',
                                          fontSize: 'var(--info-unit-size, 9px)',
                                          marginTop: '2px',
                                          textAlign: 'center',
                                          textShadow: darkMode ? 'none' : '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                          opacity: 0.8
                                        }}>{subtitle}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          } else {
                            // No state set - fallback to default based on available components
                            return null;
                          }
                        })()}
                        
                  </div>
                      
                      {/* Component Navigation Dots - HIDDEN */}
                      {false && getAvailableComponentsCount(story) > 1 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '14px'
                        }}>
                          {/* Dynamically render dots based on components array order */}
                          {getAvailableInformationTypes(story).map((componentType, dotIndex) => {
                            const handleClick = (type) => {
                              // Reset all states
                              setShowDetails(prev => ({ ...prev, [index]: false }));
                                setShowTimeline(prev => ({ ...prev, [index]: false }));
                                setShowMap(prev => ({ ...prev, [index]: false }));
                                setShowGraph(prev => ({ ...prev, [index]: false }));
                              // Reset expanded states
                              setExpandedTimeline(prev => ({ ...prev, [index]: false }));
                              setExpandedGraph(prev => ({ ...prev, [index]: false }));
                              setExpandedMap(prev => ({ ...prev, [index]: false }));
                              
                              // Set the clicked one
                              switch (type) {
                                case 'details':
                                  setShowDetails(prev => ({ ...prev, [index]: true }));
                                  break;
                                case 'timeline':
                                setShowTimeline(prev => ({ ...prev, [index]: true }));
                                  break;
                                case 'map':
                                setShowMap(prev => ({ ...prev, [index]: true }));
                                  break;
                                case 'graph':
                                  setShowGraph(prev => ({ ...prev, [index]: true }));
                                  break;
                              }
                            };
                            
                            const isActive = 
                              (componentType === 'details' && showDetails[index]) ||
                              (componentType === 'timeline' && showTimeline[index]) ||
                              (componentType === 'map' && showMap[index]) ||
                              (componentType === 'graph' && showGraph[index]);
                            
                            return (
                            <div
                                key={`${index}-${componentType}-${dotIndex}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                  handleClick(componentType);
                              }}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                  background: isActive 
                                  ? 'rgba(0, 0, 0, 0.6)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            />
                            );
                          })}
                        </div>
                      )}
                      
                    </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
        })}


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

      {/* Authentication Modal - OUTSIDE main container for touch events */}
      {authModal && (
        <div 
          className="auth-modal-overlay" 
          onClick={() => setAuthModal(null)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setAuthModal(null); } }}
          style={{ touchAction: 'auto', pointerEvents: 'auto' }}
        >
          <div 
            className="auth-modal" 
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ touchAction: 'auto', pointerEvents: 'auto' }}
          >
            <div className="auth-modal-header" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
              <h2>{authModal === 'login' ? 'Login to Today+' : 'Create Your Account'}</h2>
              <button 
                className="auth-close" 
                onClick={() => setAuthModal(null)} 
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setAuthModal(null); }}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >×</button>
            </div>

            <div className="auth-modal-body" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
              {authError && (
                <div className="auth-error">{authError}</div>
              )}

              {authModal === 'login' ? (
                <LoginForm onSubmit={handleLogin} onForgotPassword={handleForgotPassword} formData={formData} setFormData={setFormData} />
              ) : (
                <SignupForm onSubmit={handleSignup} formData={formData} setFormData={setFormData} />
              )}

              <div className="auth-modal-footer">
                {authModal === 'login' ? (
                  <p>Don't have an account? <button className="auth-switch" onClick={() => {setAuthModal('signup'); setAuthError('');}} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setAuthModal('signup'); setAuthError(''); }}>Sign up</button></p>
                ) : (
                  <p>Already have an account? <button className="auth-switch" onClick={() => {setAuthModal('login'); setAuthError('');}} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setAuthModal('login'); setAuthError(''); }}>Login</button></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Confirmation Modal - OUTSIDE main container for touch events */}
      {emailConfirmation && (
        <div className="auth-modal-overlay" onClick={() => setEmailConfirmation(null)} onTouchEnd={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setEmailConfirmation(null); } }} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
          <EmailConfirmation
            email={emailConfirmation.email}
            type={emailConfirmation.type}
            onBack={() => setEmailConfirmation(null)}
          />
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="auth-modal-overlay" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
          <ResetPasswordModal 
            supabase={supabase}
            onSuccess={() => {
              setShowResetPassword(false);
              // Clear the hash from URL
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }}
            onCancel={() => {
              setShowResetPassword(false);
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }}
          />
        </div>
      )}
    </>
  );
}

// Login Form Component
function LoginForm({ onSubmit, onForgotPassword, formData, setFormData }) {
  const [email, setEmail] = useState(formData?.loginEmail || '');
  const [password, setPassword] = useState(formData?.loginPassword || '');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return;

    setResetLoading(true);
    try {
      await onForgotPassword(email);
    } finally {
      setResetLoading(false);
    }
  };

  if (forgotPasswordMode) {
    return (
      <form onSubmit={handleForgotPassword} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFormData(prev => ({ ...prev, loginEmail: e.target.value }));
            }}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Enter your email"
            required
            style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
          />
        </div>

        <button 
          type="submit" 
          className="auth-submit" 
          disabled={resetLoading}
          style={{ touchAction: 'auto', pointerEvents: 'auto' }}
        >
          {resetLoading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <button 
          type="button"
          onClick={() => setForgotPasswordMode(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#3b82f6', 
            cursor: 'pointer', 
            fontSize: '14px',
            marginTop: '12px',
            textDecoration: 'underline'
          }}
        >
          Back to Login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFormData(prev => ({ ...prev, loginEmail: e.target.value }));
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your email"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFormData(prev => ({ ...prev, loginPassword: e.target.value }));
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your password"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <button 
        type="button"
        onClick={() => setForgotPasswordMode(true)}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#3b82f6', 
          cursor: 'pointer', 
          fontSize: '14px',
          marginBottom: '8px',
          textAlign: 'right',
          width: '100%',
          padding: 0
        }}
      >
        Forgot password?
      </button>

      <button 
        type="submit" 
        className="auth-submit" 
        disabled={loading}
        style={{ touchAction: 'auto', pointerEvents: 'auto' }}
      >
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
    <form onSubmit={handleSubmit} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-name">Full Name</label>
        <input
          id="signup-name"
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            updateFormData('signupFullName', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your full name"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            updateFormData('signupEmail', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your email"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => {
            handlePasswordChange(e.target.value);
            updateFormData('signupPassword', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Create a password (min 8 characters)"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
        {passwordError && <span className="auth-field-error">{passwordError}</span>}
      </div>

      <button 
        type="submit" 
        className="auth-submit" 
        disabled={loading || passwordError}
        style={{ touchAction: 'auto', pointerEvents: 'auto' }}
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
}

// Email Confirmation Component
function EmailConfirmation({ email, type, onBack }) {
  const isReset = type === 'reset';
  
  return (
    <div className="auth-modal" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-modal-header" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <h2>Check Your Email</h2>
        <button className="auth-close" onClick={onBack} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>×</button>
      </div>

      <div className="auth-modal-body" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: '0.8'
          }}>{isReset ? '🔐' : '📧'}</div>

          <h3 style={{
            color: '#1f2937',
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 12px 0'
          }}>{isReset ? 'Password Reset Email Sent!' : 'Verification Email Sent!'}</h3>

          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.5',
            margin: '0 0 20px 0'
          }}>
            {isReset 
              ? <>We've sent a password reset link to <strong>{email}</strong></>
              : <>We've sent a verification link to <strong>{email}</strong></>
            }
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
              <li>Click the {isReset ? 'reset' : 'verification'} link</li>
              <li>{isReset ? 'Create a new password' : 'Return here and log in with your credentials'}</li>
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

// Reset Password Modal Component
function ResetPasswordModal({ supabase, onSuccess, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [settingUpSession, setSettingUpSession] = useState(true);

  // Set up session from URL tokens when modal mounts
  useEffect(() => {
    const setupSession = async () => {
      try {
        // Check if there are tokens in the URL hash
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('🔐 Found tokens in URL, setting up session...');
          const hashParams = new URLSearchParams(hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });

            if (error) {
              console.error('❌ Error setting session:', error);
              setError('Failed to verify reset link. Please request a new one.');
              setSettingUpSession(false);
              return;
            }

            if (data?.session) {
              console.log('✅ Session established for password reset');
              setSessionReady(true);
            }
          }
        } else {
          // Try to get existing session
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            console.log('✅ Existing session found');
            setSessionReady(true);
          } else {
            setError('Reset link expired or invalid. Please request a new one.');
          }
        }
      } catch (err) {
        console.error('❌ Session setup error:', err);
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setSettingUpSession(false);
      }
    };

    setupSession();
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!sessionReady) {
      setError('Session not ready. Please wait or request a new reset link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (settingUpSession) {
    return (
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div className="auth-modal-header">
          <h2>Reset Password</h2>
        </div>
        <div className="auth-modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Verifying reset link...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div className="auth-modal-header">
          <h2>Password Updated!</h2>
        </div>
        <div className="auth-modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <p style={{ color: '#22c55e', fontSize: '16px', fontWeight: '500' }}>
            Your password has been successfully updated.
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-modal-header">
        <h2>Reset Password</h2>
        <button className="auth-close" onClick={onCancel}>×</button>
      </div>

      <div className="auth-modal-body" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
          Enter your new password below
        </p>

        {error && (
          <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Enter new password (min 8 characters)"
              required
              style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Confirm new password"
              required
              style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
            />
          </div>

          <button 
            type="submit" 
            className="auth-submit" 
            disabled={loading}
            style={{ touchAction: 'auto', pointerEvents: 'auto' }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Server-Side Rendering with CDN caching for fast page loads
export async function getServerSideProps({ req, res }) {
  // Enable CDN caching for faster subsequent loads
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  
  try {
    // Determine base URL for API calls
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req?.headers?.host || 'localhost:3000';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    
    // Fetch news and world events via API (reliable approach)
    const [newsResponse, eventsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/news?page=1&pageSize=30`, {
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => null),
      fetch(`${baseUrl}/api/world-events?limit=8`, {
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => null)
    ]);

    let initialNews = null;
    let initialWorldEvents = null;

    if (newsResponse?.ok) {
      const newsData = await newsResponse.json();
      if (newsData.articles && newsData.articles.length > 0) {
        // Create opening story
        const openingStory = {
          type: 'opening',
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          }).toUpperCase(),
          headline: newsData.dailyGreeting || "Today's Essential Global News"
        };
        
        // Format articles as stories with defaults for information boxes
        const defaultDetails = ['Impact Score: High significance', 'Read Time: 3-4 min', 'Source Credibility: Verified'];
        const defaultTimeline = [
          { date: 'Recently', event: 'Initial reports emerge' },
          { date: 'Yesterday', event: 'Key developments unfold' },
          { date: 'Today', event: 'Latest updates breaking' }
        ];
        
        const newsStories = newsData.articles
          .filter(article => article && article.id)
          .map((article, index) => {
            // Build components array
            let components = article.components;
            if (!components || !Array.isArray(components) || components.length === 0) {
              components = ['details'];
              if (article.timeline) components.push('timeline');
              if (article.map) components.push('map');
              if (article.graph) components.push('graph');
            }
            
            return {
              type: 'news',
              rank: index + 1,
              id: article.id,
              title: article.title || article.title_news,
              summary_bullets: article.summary_bullets || [],
              summary_bullets_news: article.summary_bullets_news || [],
              summary_bullets_detailed: article.summary_bullets_detailed || [],
              five_ws: article.five_ws || null,
              url: article.url,
              urlToImage: article.urlToImage,
              source: article.source,
              category: article.category,
              emoji: article.emoji || '📰',
              details: (article.details && article.details.length > 0) ? article.details : defaultDetails,
              timeline: article.timeline || defaultTimeline,
              graph: article.graph || null,
              map: article.map || null,
              components,
              final_score: article.final_score || 0,
              interest_tags: article.interest_tags || []
            };
          });
        
        initialNews = {
          stories: [openingStory, ...newsStories],
          pagination: newsData.pagination || null
        };
      }
    }

    // Process world events response
    if (eventsResponse?.ok) {
      const eventsData = await eventsResponse.json();
      if (eventsData.events && eventsData.events.length > 0) {
        initialWorldEvents = eventsData.events;
      }
    }

    return {
      props: {
        initialNews: initialNews || null,
        initialWorldEvents: initialWorldEvents || null
      }
    };
  } catch (error) {
    console.error('SSR fetch error:', error);
    return {
      props: {
        initialNews: null,
        initialWorldEvents: null
      }
    };
  }
}

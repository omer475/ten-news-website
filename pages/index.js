import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { createClient } from '../lib/supabase';
import NewFirstPage from '../components/NewFirstPage';
import dynamic from 'next/dynamic';
import ReadArticleTracker from '../utils/ReadArticleTracker';
import { sortArticlesByScore } from '../utils/sortArticles';

// Dynamically import GraphChart to avoid SSR issues
const GraphChart = dynamic(() => import('../components/GraphChart'), {
    ssr: false,
  loading: () => <div style={{ padding: '10px' }}>Loading chart...</div>
  });

export default function Home() {
  const [stories, setStories] = useState([]);
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
  const [expandedGraph, setExpandedGraph] = useState({});
  const [showBulletPoints, setShowBulletPoints] = useState({});
  // Removed globalShowBullets - only showing summary text now
  const [showDetailedArticle, setShowDetailedArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showDetailedText, setShowDetailedText] = useState({}); // Track which articles show detailed text
  const [imageDominantColors, setImageDominantColors] = useState({}); // Store dominant color for each image
  const [loadedImages, setLoadedImages] = useState(new Set()); // Track which images have successfully loaded
  
  // Auto-rotation state for information boxes
  const [autoRotationEnabled, setAutoRotationEnabled] = useState({}); // Track which articles have auto-rotation active
  const [progressBarKey, setProgressBarKey] = useState({}); // Track progress bar resets
  
  // Read article tracker (localStorage-based)
  const readTrackerRef = useRef(null);

  // Language mode for summaries (advanced vs B2)
  const [languageMode, setLanguageMode] = useState({});  // Track language mode per article
  const [showLanguageOptions, setShowLanguageOptions] = useState({});  // Track dropdown visibility per article

  // Swipe handling for summary/bullet toggle and detailed article navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || e.target.closest('[data-expand-icon]')) {
      return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || e.target.closest('[data-expand-icon]')) {
      return;
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e) => {
    // Only handle swipe on summary content, not on buttons or other elements
    if (e.target.closest('.switcher') || e.target.closest('[data-expand-icon]')) {
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
    // If components array exists, use it to determine order
    if (story.components && Array.isArray(story.components) && story.components.length > 0) {
      console.log(`📊 Story "${story.title?.substring(0, 30)}..." has components array:`, story.components);
      // Filter to only include components that actually have data
      const filtered = story.components.filter(type => {
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
      console.log(`✅ Filtered components for this story:`, filtered);
      return filtered;
    }
    
    console.log(`⚠️  Story "${story.title?.substring(0, 30)}..." has NO components array, using fallback`);
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
    
    // Reset expanded states - components should start collapsed
    setExpandedTimeline(prev => ({ ...prev, [index]: false }));
    setExpandedGraph(prev => ({ ...prev, [index]: false }));

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

  // Extract diverse color candidates from image
  const extractColorfulCandidates = (pixels, width, height) => {
    const colorMap = {};
    
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
      
      colorMap[key] = (colorMap[key] || 0) + 1;
    }
    
    // Get top 20 most frequent colors
    const sortedColors = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        const hsl = rgbToHsl(r, g, b);
        return { r, g, b, hsl, rgb: { r, g, b } };
      });
    
    return sortedColors;
  };

  // Select the most dominant color from the image
  const selectColorForArticle = (colorCandidates, articleIndex) => {
    // Filter to colorful only (saturation >= 30%, lightness 20-80%)
    let colorfulColors = filterColorfulColors(colorCandidates);
    
    // If no colorful colors, use most saturated from all candidates
    if (colorfulColors.length === 0) {
      const sortedBySaturation = colorCandidates.sort((a, b) => b.hsl[1] - a.hsl[1]);
      colorfulColors = sortedBySaturation.slice(0, 1);
    }
    
    // Sort by frequency and vibrancy to get the TRUE dominant color from the image
    // Vibrancy = saturation * (1 - distance from mid-lightness)
    colorfulColors.sort((a, b) => {
      const vibrancyA = a.hsl[1] * (1 - Math.abs(a.hsl[2] - 50) / 50);
      const vibrancyB = b.hsl[1] * (1 - Math.abs(b.hsl[2] - 50) / 50);
      return vibrancyB - vibrancyA;
    });
    
    // Select the FIRST (most vibrant) color - this is the actual dominant color
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

  // Create title highlight color (lighter, subtle)
  const createTitleHighlightColor = (blurHsl) => {
    const [h, s, l] = blurHsl;
    const newL = Math.min(85, l + 50); // Much lighter
    const newS = Math.min(70, s * 1.2); // Slightly more saturated
    return [h, newS, newL];
  };

  // Create bullet text color (between blur and title)
  const createBulletTextColor = (blurHsl, titleHsl) => {
    const [h, s1, l1] = blurHsl;
    const [, s2, l2] = titleHsl;
    const midL = (l1 + l2) / 2 + 10; // Between the two, slightly lighter
    const midS = (s1 + s2) / 2 + 5; // Average saturation
    return [h, Math.min(75, midS), Math.min(70, midL)];
  };

  // Main extraction function with index-based selection
  const extractDominantColor = (imgElement, storyIndex) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = imgElement.naturalWidth || imgElement.width;
      canvas.height = imgElement.naturalHeight || imgElement.height;
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      // Extract colorful candidates
      const candidates = extractColorfulCandidates(pixels, canvas.width, canvas.height);
      
      // Select color based on article index
      const selectedColor = selectColorForArticle(candidates, storyIndex);
      
      // Create blur color
      const blurHsl = createBlurColor(selectedColor.hsl);
      const [bR, bG, bB] = hslToRgb(...blurHsl);
      const blurColorHex = `#${toHex(bR)}${toHex(bG)}${toHex(bB)}`;
      
      // Create title highlight color  
      const highlightHsl = createTitleHighlightColor(blurHsl);
      const [hR, hG, hB] = hslToRgb(...highlightHsl);
      const highlightColor = `rgb(${hR}, ${hG}, ${hB})`;
      
      // Create bullet text color
      const linkHsl = createBulletTextColor(blurHsl, highlightHsl);
      const [lR, lG, lB] = hslToRgb(...linkHsl);
      const linkColor = `rgb(${lR}, ${lG}, ${lB})`;
      
      // Store all colors
      setImageDominantColors(prev => ({
        ...prev,
        [storyIndex]: {
          blurColor: blurColorHex,
          highlight: highlightColor,
          link: linkColor
        }
      }));
    } catch (error) {
      console.error('Color extraction error:', error);
      // Fallback colors
      setImageDominantColors(prev => ({
        ...prev,
        [storyIndex]: {
          blurColor: '#3A4A5E',
          highlight: '#A8C4E0',
          link: '#5A6F8E'
        }
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

  // Authentication state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
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
  useEffect(() => {
    if (typeof window !== 'undefined') {
      readTrackerRef.current = new ReadArticleTracker();
      console.log('✅ ReadArticleTracker initialized');
    }
  }, []);

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
      
      console.log('🐛 Debug helpers updated with access to current stories');
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
               
               const sampleDetailedText = article.detailed_text || `**Breaking News Update**

This is a preview of the full article content. In the complete version, you would see the detailed analysis and comprehensive coverage of today's top stories.

The article delves into the key developments, providing context and background information that helps readers understand the broader implications. Expert opinions and multiple perspectives are included to give a well-rounded view of the situation.

Additional paragraphs would continue here, exploring various aspects of the story, including historical context, potential future outcomes, and relevant statistics. The content is structured to be both informative and engaging, making complex topics accessible to a wide audience.

**Key Takeaways:**
- Important point one that summarizes a critical aspect
- Second significant finding that provides insight
- Third major conclusion that ties everything together

The article concludes with forward-looking analysis and what readers should watch for in the coming days as this story continues to develop.`;
               
               // Generate fallback bullets if none provided
               let bulletPoints = article.summary_bullets || [];
               if (!bulletPoints || bulletPoints.length === 0) {
                 // Try to generate bullets from summary or detailed text
                 const sourceText = article.summary || article.detailed_text || sampleDetailedText;
                 if (sourceText && sourceText.length > 50) {
                   // Split into sentences and take first few as bullets
                   const sentences = sourceText.split(/[.!?]+/).filter(s => s.trim().length > 20);
                   bulletPoints = sentences.slice(0, Math.min(4, sentences.length)).map(s => s.trim());
                 }
               }

              const storyData = {
                type: 'news',
                number: article.rank || (index + 1),
                category: (article.category || 'WORLD NEWS').toUpperCase(),
                emoji: article.emoji || '📰',
                title: article.title || 'News Story',
                detailed_text: sampleDetailedText,
                summary_bullets: bulletPoints,
                details: sampleDetails,
                source: article.source || 'Today+',
                url: article.url || '#',
                urlToImage: (article.urlToImage || article.image_url || '').trim() || null,
                blurColor: article.blurColor || null,  // Pre-computed blur color
                map: article.map || null,
                graph: article.graph || null,
                timeline: sampleTimeline,
                components: article.components || null,  // CRITICAL: Include components array
                publishedAt: article.publishedAt || article.published_at || article.added_at,
                id: article.id || `article_${index}`,
                final_score: article.final_score  // IMPORTANT: Include final_score for red border styling
              };
               
               processedStories.push(storyData);
             });
            
            // Filter out read articles using ReadArticleTracker
            let unreadStories = processedStories;
            if (readTrackerRef.current) {
              unreadStories = processedStories.filter((story, index) => {
                // Always keep opening story
                if (index === 0) return true;
                // Keep non-news stories
                if (story.type !== 'news') return true;
                // Filter out read articles
                return !readTrackerRef.current.hasBeenRead(story.id);
              });
              
              const filteredCount = processedStories.length - unreadStories.length;
              if (filteredCount > 0) {
                console.log(`🔍 Filtered out ${filteredCount} read articles`);
              }
            }
            
            // Sort articles by score (highest first), with date tie-breaking
            // Keep opening story first, sort only the news articles
            let finalStories = unreadStories;
            if (unreadStories.length > 1) {
              const openingStory = unreadStories[0]; // First story (opening page)
              const newsArticles = unreadStories.slice(1); // All news articles
              
              console.log('📊 Sorting news articles by score...');
              const sortedNews = sortArticlesByScore(newsArticles);
              
              // Combine: opening story first, then sorted news, then "all caught up" page
              const allCaughtUpStory = {
                type: 'all-read',
                title: "All Caught Up",
                message: "You've read all today's articles",
                subtitle: "Come back in a few minutes"
              };
              
              finalStories = [openingStory, ...sortedNews, allCaughtUpStory];
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
            setStories(finalStories);
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
  const renderBoldText = (text, colors, category = null) => {
    if (!text) return '';
    
    const linkColor = colors?.blurColor || 
      (category ? getCategoryColors(category).primary : '#000000');
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.replace(/\*\*/g, '');
        return (
          <span key={i} style={{ fontWeight: '500', color: linkColor }}>
            {content}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Function to render title with highlighted important words (colored AND bold)
  const renderTitleWithHighlight = (text, colors, category = null) => {
    if (!text) return '';
    
    const highlightColor = colors?.highlight || 
      (category ? getCategoryColors(category).primary : '#ffffff');
    
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
      return <span key={i}>{part}</span>;
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
      switchToNextInformationType(currentStory, currentIndex);
      // Reset progress bar animation
      setProgressBarKey(prev => ({ ...prev, [currentIndex]: Date.now() }));
    }, 4000);

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [currentIndex, showDetailedArticle, stories, autoRotationEnabled, progressBarKey, showTimeline, showDetails, showMap, showGraph, expandedTimeline, expandedGraph]);
  
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..1000&display=swap" rel="stylesheet" />
      </Head>
      
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* Apple HIG - Base Styles */
        html {
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          padding: 0;
          margin: 0;
          height: 100%;
          min-height: 100dvh;
        }

        /* Apple HIG - Body Typography & Colors */
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          color: ${darkMode ? '#f5f5f7' : '#1d1d1f'};
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
          min-height: 100dvh;
          touch-action: none;
          transition: background-color 0.3s cubic-bezier(0.28, 0, 0.4, 1), color 0.3s cubic-bezier(0.28, 0, 0.4, 1);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Glassmorphism Variables */
        :root {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
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
          z-index: 3;
          display: flex;
          flex-direction: column;
          width: 100%;
          color: #000;
          padding: 6px 20px 12px 20px;
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
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 max(env(safe-area-inset-left, 20px), 20px) 0 max(env(safe-area-inset-right, 20px), 20px);
          border-bottom: 0.5px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
          transition: all 0.3s cubic-bezier(0.28, 0, 0.4, 1);
        }

        /* Logo - Apple-inspired Typography */
        .logo {
          font-size: 21px;
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


        /* Apple HIG - Story Container */
        .story-container {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 68px;
          padding-bottom: 200px;
          padding-left: max(env(safe-area-inset-left, 20px), 20px);
          padding-right: max(env(safe-area-inset-right, 20px), 20px);
          background: ${darkMode ? '#000000' : '#f5f5f7'};
          transition: all 0.5s cubic-bezier(0.28, 0, 0.4, 1);
          overflow-y: auto;
          z-index: 10;
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

        /* Apple HIG - Button Styles */
        .auth-btn {
          all: unset;
          cursor: pointer;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          pointer-events: auto;
          padding: 7px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          letter-spacing: -0.01em;
          font-weight: 400;
          font-size: 14px;
          color: ${darkMode ? 'rgba(255,255,255,0.92)' : '#1d1d1f'};
          background: transparent;
          border-radius: 980px;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          border: none;
        }

        .auth-btn:hover {
          background: ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'};
        }

        .auth-btn:active {
          transform: scale(0.96);
          background: ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'};
        }

        .subscribe-btn {
          all: unset;
          cursor: pointer;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          pointer-events: auto;
          padding: 7px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          letter-spacing: -0.01em;
          font-weight: 400;
          font-size: 14px;
          color: #ffffff;
          background: ${darkMode ? '#0a84ff' : '#007aff'};
          border-radius: 980px;
          transition: all 0.2s cubic-bezier(0.28, 0, 0.4, 1);
          border: none;
        }

        .subscribe-btn:hover {
          background: ${darkMode ? '#409cff' : '#0051d5'};
        }

        .subscribe-btn:active {
          transform: scale(0.96);
          background: ${darkMode ? '#66b0ff' : '#003ea7'};
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
          height: 34px;
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
          width: 36px;
          height: 28px;
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
          width: 36px;
          height: 28px;
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

        /* Language Toggle Button - EXACT Same Glass Design as Switcher */
        .language-toggle-btn {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;
          
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border: none;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          font-family: "DM Sans", sans-serif;
          color: var(--c-content);
          cursor: pointer;
          
          /* EXACT Glass Effect from Switcher */
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

        .language-toggle-btn:hover {
          background-color: color-mix(in srgb, var(--c-glass) 18%, transparent);
        }

        .language-toggle-btn svg {
          width: 14px;
          height: 14px;
          opacity: 0.8;
        }

        .language-toggle-btn span {
          font-size: 12px;
          letter-spacing: -0.01em;
        }

        /* Language Dropdown - EXACT Same Glass Design */
        .language-dropdown {
          --c-glass: #ffffff;
          --c-light: #fff;
          --c-dark: #000;
          --c-content: #224;
          --glass-reflex-dark: 1;
          --glass-reflex-light: 1;
          --saturation: 150%;
          
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          display: flex;
          align-items: center;
          gap: 2px;
          width: auto;
          height: 34px;
          padding: 3px;
          border: none;
          border-radius: 12px;
          z-index: 1000;
          
          /* EXACT Glass Effect from Switcher */
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
          animation: slideDown 300ms cubic-bezier(0.4, 0.0, 0.2, 1);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Language Option Buttons - Match Switcher Option */
        .language-option {
          --c: var(--c-content);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
          width: auto;
          min-width: 70px;
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

        .language-option svg {
          width: 13px;
          height: 13px;
          opacity: 0.7;
        }

        .language-option:hover {
          --c: var(--c-action);
          transform: scale(1.1);
        }

        .language-option.active {
          --c: var(--c-content);
          cursor: auto;
        }

        /* Active indicator for dropdown */
        .language-dropdown::after {
          content: '';
          position: absolute;
          left: 3px;
          top: 3px;
          display: block;
          width: 70px;
          height: 28px;
          border-radius: 9px;
          background-color: color-mix(in srgb, var(--c-glass) 36%, transparent);
          z-index: -1;
          box-shadow: 
            inset 0 0 0 0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1px 0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent), 
            inset -0.75px -0.5px 0px -0.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent), 
            inset -1px -3px 0.5px -2.5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent), 
            inset -0.5px 1px 1.5px -0.5px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent), 
            inset 0px -2px 0.5px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent), 
            0px 1.5px 3px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent);
          transition: 
            translate 400ms cubic-bezier(1, 0.0, 0.4, 1),
            opacity 400ms cubic-bezier(1, 0.0, 0.4, 1);
        }

        .language-dropdown:has(.language-option:nth-child(1).active)::after {
          translate: 0 0;
        }

        .language-dropdown:has(.language-option:nth-child(2).active)::after {
          translate: 74px 0;
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
          width: 14px;
          height: 14px;
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
          width: 14px;
          height: 14px;
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
              background: 'transparent',
              boxSizing: 'border-box',
              // Red gradient border for important news (score >= 950)
              ...(story.type === 'news' && story.final_score >= 950 && {
                border: '4px solid',
                borderImage: 'linear-gradient(135deg, black 0%, #1a0000 5%, #330000 10%, #4d0000 15%, #660000 20%, #800000 25%, #990000 30%, #b30000 35%, #cc0000 40%, #e60000 45%, red 50%, #e60000 55%, #cc0000 60%, #b30000 65%, #990000 70%, #800000 75%, #660000 80%, #4d0000 85%, #330000 90%, #1a0000 95%, black 100%) 1',
                boxShadow: '0 0 20px rgba(255, 0, 0, 0.3)'
              })
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
                background: 'transparent',
                backgroundColor: 'transparent',
                filter: index >= 5 && !user ? 'blur(5px)' : 'none',
                pointerEvents: index >= 5 && !user ? 'none' : 'auto',
              }}
            >
              {story.type === 'opening' ? (
                <NewFirstPage 
                  onContinue={nextStory}
                  user={user}
                  userProfile={userProfile}
                  stories={stories}
                  readTracker={readTrackerRef.current}
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
                  {/* Checkmark Icon */}
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
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    lineHeight: '1.2',
                    color: '#1d1d1f',
                    letterSpacing: '-0.5px'
                  }}>
                    {story.title}
                  </h1>
                  
                  <p style={{
                    fontSize: '17px',
                    fontWeight: '400',
                    marginBottom: '8px',
                    color: '#6e6e73',
                    lineHeight: '1.4',
                    maxWidth: '280px'
                  }}>
                    {story.message}
                  </p>
                  
                  <p style={{
                    fontSize: '15px',
                    fontWeight: '400',
                    marginBottom: '40px',
                    color: '#86868b',
                    lineHeight: '1.4'
                  }}>
                    {story.subtitle}
                  </p>
                  
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
                </div>
              ) : story.type === 'news' ? (
                <div className="news-grid" style={{ overflow: 'hidden', padding: 0, margin: 0 }}>
                  
                    // Original News Item View - Everything stays the same
                  <div className="news-item" style={{ overflow: 'visible', padding: 0, position: 'relative' }} onClick={() => {
                      // Toggle detailed text to show article under summary
                      toggleDetailedText(index);
                  }}>
                    {/* News Image - With Rounded Corners and Spacing */}
                    <div style={{
                      position: 'fixed',
                      top: '0',
                      left: '0',
                      right: '0',
                      width: '100vw',
                      height: '38vh',
                      margin: 0,
                      padding: 0,
                      background: (story.urlToImage && story.urlToImage.trim() !== '' && story.urlToImage !== 'null' && story.urlToImage !== 'undefined') ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'block',
                      zIndex: '1',
                      overflow: 'hidden',
                      pointerEvents: 'none',
                      // Ensure image container doesn't interfere with information box
                      maxHeight: '38vh'
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
                          return (
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
                            crossOrigin="anonymous"
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
                              console.log('   Image dimensions:', e.target.naturalWidth, 'x', e.target.naturalHeight);
                              
                              // Mark this image as successfully loaded
                              setLoadedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.add(imageUrl);
                                return newSet;
                              });
                              
                              // Use pre-computed blur color if available, otherwise extract
                              if (story.blurColor) {
                                // Use pre-computed color from article data
                                setImageDominantColors(prev => ({ 
                                  ...prev, 
                                  [index]: { 
                                    blurColor: story.blurColor,
                                    // Still need to extract for highlight/link colors
                                    ...(prev[index] || {})
                                  }
                                }));
                              }
                              
                              // Always extract for highlight/link colors
                              if (e.target.complete && e.target.naturalWidth > 0) {
                                try {
                                  extractDominantColor(e.target, index);
                                } catch (error) {
                                  console.warn('Color extraction failed:', error);
                                }
                              }
                              // Ensure image is visible and persistent
                              e.target.style.opacity = '1';
                              e.target.style.visibility = 'visible';
                              e.target.style.display = 'block';
                              e.target.style.minWidth = '100%';
                              e.target.style.minHeight = '100%';
                            }}
                            onError={(e) => {
                              console.error('❌ Image failed to load:', imageUrl);
                              console.error('   Story title:', story.title);
                              const imgElement = e.target;
                              const parentElement = imgElement.parentElement;
                              
                              // More aggressive retry strategy
                              let retryCount = parseInt(imgElement.dataset.retryCount || '0');
                              const maxRetries = 5; // Increased retries
                              
                              const tryLoadImage = () => {
                                if (retryCount < maxRetries && imageUrl && !imageUrl.includes('data:') && !imageUrl.includes('blob:')) {
                                  retryCount++;
                                  imgElement.dataset.retryCount = retryCount.toString();
                                  
                                  // Try different CORS settings
                                  if (retryCount % 2 === 0) {
                                    imgElement.crossOrigin = 'anonymous';
                                  } else {
                                    imgElement.crossOrigin = undefined;
                                  }
                                  
                                  // Try different referrer policies
                                  if (retryCount === 3) {
                                    imgElement.referrerPolicy = 'no-referrer-when-downgrade';
                                  } else if (retryCount === 4) {
                                    imgElement.referrerPolicy = 'origin';
                                  } else {
                                    imgElement.referrerPolicy = 'no-referrer';
                                  }
                                  
                                  // Try with timestamp to bypass cache
                                  const separator = imageUrl.includes('?') ? '&' : '?';
                                  const newSrc = imageUrl + separator + '_retry=' + retryCount + '&_t=' + Date.now();
                                  console.log(`🔄 Retry ${retryCount}/${maxRetries}: ${newSrc.substring(0, 80)}...`);
                                  imgElement.src = newSrc;
                                  return;
                                }
                                
                                // Only show fallback after all retries exhausted
                                if (retryCount >= maxRetries) {
                                  console.warn('⚠️ All image load attempts failed, showing fallback');
                                  // Remove from loaded images set if it was previously loaded
                                  setLoadedImages(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(imageUrl);
                                    return newSet;
                                  });
                                  imgElement.style.display = 'none';
                                  if (parentElement) {
                                    const existingFallback = parentElement.querySelector('.image-fallback');
                                    if (!existingFallback) {
                                      parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                                      const fallback = document.createElement('div');
                                      fallback.className = 'image-fallback';
                                      fallback.style.cssText = `
                                        font-size: 72px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        width: 100%;
                                        height: 100%;
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        z-index: 1;
                                      `;
                                      fallback.textContent = story.emoji || '📰';
                                      parentElement.appendChild(fallback);
                                    }
                                  }
                                }
                              };
                              
                              // Try loading again with increasing delays
                              setTimeout(tryLoadImage, 300 * retryCount);
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
                        top: 'calc(38vh * 0.55)',
                        left: '0',
                        width: '100%',
                        height: 'calc(38vh * 0.45 + 74px)',
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
                      
                      {/* Title Overlay with Image-Based Color Gradient - Starts from Top */}
                      {/* Only show overlay if image exists, and limit it to not cover bottom area */}
                      {story.urlToImage && story.urlToImage.trim() !== '' && story.urlToImage !== 'null' && story.urlToImage !== 'undefined' && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: '-12px',
                        left: 0,
                        right: 0,
                        padding: '24px 16px 4px 16px',
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
                        zIndex: 2,
                        pointerEvents: 'none'
                      }}>
                        </div>
                      )}
                      
                      {/* Title - In front of everything */}
                      {/* Apple HIG - Title Typography */}
                      <div style={{
                        position: 'fixed',
                        bottom: 'calc(100vh - 38vh - 12px)',
                        left: '20px',
                        right: '20px',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}>
                        <h3 style={{ 
                          margin: 0,
                          fontSize: '28px',
                          fontWeight: '700',
                          lineHeight: '1.14',
                          letterSpacing: '-0.8px',
                          color: '#ffffff',
                          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                        }}>{renderTitleWithHighlight(story.title, imageDominantColors[index], story.category)}</h3>
                      </div>
                    </div>
                    
                    {/* Emoji fallback when no image */}
                    {(!story.urlToImage || story.urlToImage.trim() === '' || story.urlToImage === 'null' || story.urlToImage === 'undefined') && (
                      <div style={{
                      position: 'fixed',
                      top: '0',
                      left: '0',
                      right: '0',
                      width: '100vw',
                      height: '38vh',
                      margin: 0,
                      padding: 0,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: '1',
                      overflow: 'hidden',
                      pointerEvents: 'none'
                    }}>
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
                    </div>
                    )}
                    
                    {/* Apple HIG - Content Container */}
                    <div style={{
                      position: 'fixed',
                      top: 'calc(38vh + 50px)',
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
                    
                    {/* Content Area - Starts After Image */}
                    <div className="news-content" style={{
                      position: 'relative',
                        paddingTop: 'calc(38vh - 60px)',
                        paddingLeft: '20px',
                        paddingRight: '20px',
                        zIndex: '2',
                        background: 'transparent',
                        width: '100%',
                        maxWidth: '100%',
                        margin: '0 auto'
                      }}>
                      
                      {/* Time Since Published and Timeline Button Row - Fixed Position */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                        marginTop: '28px',
                        width: '100%',
                        position: 'relative',
                        zIndex: 10
                      }}>
                        {/* Apple HIG - Time Display */}
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '400',
                          color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.56)',
                          letterSpacing: '-0.08px',
                          flex: '0 0 auto',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
                        }}>
                          {story.publishedAt ? getTimeAgo(story.publishedAt) : '2h'}
                        </div>

                        {/* Right Side Buttons Group - Language Toggle + Switcher */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: '0 0 auto'
                        }}>
                          {/* Language Toggle Button - EXACT Same Glass Design as Switcher */}
                          <div className="language-toggle-wrapper" style={{ 
                            position: 'relative', 
                            flex: '0 0 auto'
                          }}>
                          <button
                            className="language-toggle-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowLanguageOptions(prev => ({
                                ...prev,
                                [index]: !prev[index]
                              }));
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                            </svg>
                            <span>{languageMode[index] === 'b2' ? 'Easy' : 'Adv'}</span>
                          </button>
                          
                          {/* Dropdown - EXACT Same Glass Design as Switcher */}
                          {showLanguageOptions[index] && (
                            <div className="language-dropdown">
                              <button
                                className={`language-option ${languageMode[index] === 'b2' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLanguageMode(prev => ({ ...prev, [index]: 'b2' }));
                                  setShowLanguageOptions(prev => ({ ...prev, [index]: false }));
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                </svg>
                                <span>Easy</span>
                              </button>
                              
                              <button
                                className={`language-option ${(languageMode[index] === 'advanced' || !languageMode[index]) ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLanguageMode(prev => ({ ...prev, [index]: 'advanced' }));
                                  setShowLanguageOptions(prev => ({ ...prev, [index]: false }));
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <span>Adv</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Dynamic Information Switch - Only show if multiple information types available - Right Side */}
                        {getAvailableComponentsCount(story) > 1 && (
                          <div className="switcher" style={{ 
                            position: 'relative',
                            flex: '0 0 auto'
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
                                >
                                  <div className="switcher__icon">
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
                                            background: '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '6px',
                                            background: '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '4px',
                                            background: '#000000',
                                            borderRadius: '1px'
                                          }}></div>
                                          <div style={{
                                            width: '2px',
                                            height: '8px',
                                            background: '#000000',
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
                      
                      {/* Summary/Bullet Points - Swipeable - Fixed Position */}
                      <div 
                        className="news-summary" 
                        style={{ 
                          marginTop: '0px',
                          marginBottom: '32px',
                          fontSize: '16px',
                          lineHeight: '1.6',
                          color: '#4a4a4a',
                          opacity: '1',
                          minHeight: '60px',
                          padding: '16px 0',
                          position: 'relative',
                          zIndex: 10
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
                          {/* Show Only Bullet Text - Fixed Position */}
                          <div style={{ 
                            margin: 0,
                            marginTop: '-3px',
                            marginBottom: '0px',
                            position: 'relative',
                            width: '100%'
                          }}>
                              {story.summary_bullets && story.summary_bullets.length > 0 ? (
                                <ul style={{
                                  margin: 0,
                                  paddingLeft: '20px',
                                  listStyleType: 'disc'
                                }}>
                                  {story.summary_bullets.map((bullet, i) => (
                                    <li key={i} style={{
                                    marginBottom: '16px',
                                      fontSize: '17px',
                                    lineHeight: '1.47',
                                    fontWeight: '400',
                                    color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                    letterSpacing: '-0.022em',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
                                  }}>
                                    {renderBoldText(bullet, imageDominantColors[index], story.category)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>
                                  No bullet points available
                                </p>
                              )}
                          </div>
                          
                          {/* Show Detailed Article Text Below Bullets - Scrollable - Does NOT affect positions above */}
                          {/* Apple HIG - Article Text */}
                          {showDetailedText[index] && (
                            <div 
                              style={{
                                marginTop: '24px',
                                marginBottom: '100px',
                                fontSize: '17px',
                                lineHeight: '1.53',
                                color: darkMode ? '#f5f5f7' : '#1d1d1f',
                                letterSpacing: '-0.022em',
                                opacity: 1,
                                transform: 'translateY(0)',
                                transition: 'all 0.5s cubic-bezier(0.28, 0, 0.4, 1)',
                                animation: 'slideInFromBottom 0.5s cubic-bezier(0.28, 0, 0.4, 1)',
                                position: 'relative',
                                zIndex: 1,
                                width: '100%',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
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
                                __html: (() => {
                                  // Get a darker version of the blur color
                                  const blurColor = imageDominantColors[index]?.blurColor || '#000000';
                                  // Function to darken the color
                                  const darkenColor = (color) => {
                                    if (color.startsWith('rgb')) {
                                      const match = color.match(/\d+/g);
                                      if (match && match.length >= 3) {
                                        const r = Math.max(0, parseInt(match[0]) - 80);
                                        const g = Math.max(0, parseInt(match[1]) - 80);
                                        const b = Math.max(0, parseInt(match[2]) - 80);
                                        return `rgb(${r}, ${g}, ${b})`;
                                      }
                                    }
                                    return '#1a1a1a';
                                  };
                                  const darkColor = darkenColor(blurColor);
                                  
                                  return story.detailed_text
                                    .replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${darkColor}; font-weight: 600;">$1</strong>`)
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
                                    }, '');
                                })()
                              }} />
                            </div>
                          )}
                        </div>
                        
                      </div>
                      
                    </div>
                    {/* End of news-content div */}
                      
                      {/* Fixed Position Toggle and Content Area - Lower Position */}
                    {/* Always show information box if there are any available components, regardless of image presence */}
                    {/* MOVED OUTSIDE news-content to fix stacking context issue */}
                    {(() => {
                        const componentCount = getAvailableComponentsCount(story);
                        // Debug logging
                        if (componentCount === 0) {
                          console.log(`⚠️ Story ${index} (${story.title?.substring(0, 50)}) has NO components:`, {
                            hasDetails: !!(story.details && story.details.length > 0),
                            hasTimeline: !!(story.timeline && story.timeline.length > 0),
                            hasMap: !!story.map,
                            hasGraph: !!story.graph,
                            urlToImage: story.urlToImage
                          });
                        } else {
                          // Log when components exist to help debug visibility issues
                          console.log(`✅ Story ${index} (${story.title?.substring(0, 30)}) has ${componentCount} component(s), image: ${!!story.urlToImage}`);
                        }
                        return componentCount > 0;
                      })() && (
                      <div style={{
                        position: showDetailedText[index] ? 'relative' : 'fixed',
                        bottom: showDetailedText[index] ? 'auto' : '32px',
                        left: showDetailedText[index] ? '0' : '50%',
                        transform: showDetailedText[index] ? 'none' : 'translateX(-50%)',
                        width: '100%',
                        maxWidth: showDetailedText[index] ? '1200px' : '1200px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        zIndex: 99999,
                        marginTop: showDetailedText[index] ? '0' : '0',
                        marginLeft: showDetailedText[index] ? 'auto' : '0',
                        marginRight: showDetailedText[index] ? 'auto' : '0',
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
                              
                              if (!isExpandIcon) {
                                // Single tap switches information type
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
                                  transition: 'height 0.3s ease-in-out',
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
                                    transition: 'transform 0.2s ease',
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
                                    transition: 'height 0.3s ease-in-out',
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
                            // Show Map
                            return story.map && (
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
                            );
                          } else if (showDetails[index]) {
                            // Show Details
                            return story.details && (
                              <div 
                                className="glass-container details-container-desktop details-container-animated"
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
                                    const [label, value] = detail.split(':');
                                    const cleanLabel = label?.trim() || '';
                                    const cleanValue = value?.trim() || '';
                                    
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
                                        color: '#000000'
                                      }}>
                                        <div className="news-detail-label" style={{ 
                                          color: '#000000',
                                          fontSize: '9px',
                                          fontWeight: '700',
                                          marginBottom: '3px',
                                          textAlign: 'center',
                                          textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                          opacity: 0.7,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px'
                                        }}>{cleanLabel}</div>
                                        <div className="news-detail-value details-value-animated" style={{ 
                                          color: imageDominantColors[index]?.highlight || '#000000',
                                          fontSize: '18px',
                                          fontWeight: '800',
                                          textAlign: 'center',
                                          textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
                                          lineHeight: '1.1'
                                        }}>{mainValue}</div>
                                        {subtitle && <div className="news-detail-subtitle" style={{ 
                                          color: '#333333',
                                          fontSize: '9px',
                                          marginTop: '2px',
                                          textAlign: 'center',
                                          textShadow: '1px 1px 1px rgba(255, 255, 255, 0.5)',
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
                      
                      {/* Component Navigation Dots - Only show if multiple components available */}
                      {getAvailableComponentsCount(story) > 1 && (
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

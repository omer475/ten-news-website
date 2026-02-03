import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';

export default function NewFirstPage({ onContinue, user, userProfile, stories: initialStories, readTracker, isVisible = true, initialWorldEvents }) {
  const router = useRouter();
  
  // Calculate time window for map
  const getInitialTimeWindow = () => {
    if (typeof window === 'undefined') return 24;
    try {
      const lastVisit = localStorage.getItem('tennews_last_visit');
      if (!lastVisit) return 24;
      const now = Date.now();
      const lastTime = parseInt(lastVisit);
      const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
      return Math.min(24, Math.max(1, Math.ceil(hoursDiff)));
    } catch {
      return 24;
    }
  };

  const [stories, setStories] = useState(initialStories || []);
  const mapTimeWindowRef = useRef(getInitialTimeWindow());
  const mapTimeWindow = mapTimeWindowRef.current;

  const mapContainerRef = useRef(null);
  const eventsScrollRef = useRef(null);
  const eventsAutoScrollRef = useRef(true);
  const eventsScrollAnimationRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(() => {
    // Check if scripts are already loaded on mount
    if (typeof window !== 'undefined') {
      return { 
        d3: !!window.d3, 
        topojson: !!window.topojson 
      };
    }
    return { d3: false, topojson: false };
  });
  const [newsCountByCountry, setNewsCountByCountry] = useState({});
  
  // Globe rotation state
  const rotationRef = useRef({ x: 0, y: -20 });
  const isRotatingRef = useRef(true);
  const isDraggingRef = useRef(false);
  const projectionRef = useRef(null);
  const pathRef = useRef(null);
  const globeRef = useRef(null);

  // Get user's first name
  const getFirstName = () => {
    if (!user) return null;
    if (userProfile?.full_name) return userProfile.full_name.split(' ')[0];
    if (user.user_metadata?.full_name) return user.user_metadata.full_name.split(' ')[0];
    if (user.email) return user.email.split('@')[0];
    return null;
  };
  const firstName = getFirstName();

  // Time of day
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  // Get last visit info with precise time tracking
  const getLastVisitInfo = () => {
    if (typeof window === 'undefined') return { minutes: 0, hours: 0, text: 'just now' };
    try {
      const lastVisit = localStorage.getItem('tennews_last_visit');
      if (!lastVisit) return { minutes: 0, hours: 0, text: 'just now' };
      const now = Date.now();
      const lastTime = parseInt(lastVisit);
      const diffMs = now - lastTime;
      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      
      // Generate precise time text
      let text;
      if (minutes < 1) {
        text = 'just now';
      } else if (minutes < 60) {
        text = `in the last ${minutes} minute${minutes === 1 ? '' : 's'}`;
      } else if (hours < 24) {
        text = `in the last ${hours} hour${hours === 1 ? '' : 's'}`;
      } else {
        const days = Math.floor(hours / 24);
        text = days === 1 ? 'since yesterday' : `in the last ${days} days`;
      }
      
      return { minutes, hours, text };
    } catch {
      return { minutes: 0, hours: 0, text: 'just now' };
    }
  };
  
  // Save current visit time to localStorage (runs once on mount)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Small delay to ensure we read the old value first for greeting
      const timer = setTimeout(() => {
        localStorage.setItem('tennews_last_visit', Date.now().toString());
        console.log('✅ Saved new visit timestamp to localStorage');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Analyze stories for categories
  const analyzeStories = () => {
    const newsStories = (stories || []).filter(s => s.type === 'news' || !s.type);
    const categories = {};
    newsStories.forEach(s => {
      const cat = (s.category || 'general').toLowerCase();
      categories[cat] = (categories[cat] || 0) + 1;
    });
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const topCategories = sorted.slice(0, 2).map(e => e[0]);
    const highScored = newsStories.filter(s => (s.final_score || 0) >= 900);
    return {
      topCategories,
      highScoredCount: highScored.length,
      hasBreaking: highScored.some(s => (s.final_score || 0) >= 980),
      hasVeryHigh: highScored.some(s => (s.final_score || 0) >= 950)
    };
  };

  // Category labels
  const categoryLabels = {
    'politics': 'politics', 'world': 'international news', 'business': 'business',
    'technology': 'technology', 'science': 'science', 'health': 'health',
    'sports': 'sports', 'entertainment': 'entertainment', 'finance': 'the markets',
    'economy': 'the economy', 'conflict': 'global affairs', 'general': 'current events'
  };

  // Country name to ID mapping for globe
  const countryNameToId = {
    'united states': 840, 'usa': 840, 'us': 840, 'america': 840, 'canada': 124,
    'mexico': 484, 'brazil': 76, 'argentina': 32, 'united kingdom': 826, 'uk': 826,
    'france': 250, 'germany': 276, 'italy': 380, 'spain': 724, 'russia': 643,
    'china': 156, 'japan': 392, 'south korea': 410, 'india': 356, 'australia': 36,
    'israel': 376, 'iran': 364, 'ukraine': 804, 'turkey': 792, 'egypt': 818,
    'south africa': 710, 'nigeria': 566, 'saudi arabia': 682, 'indonesia': 360,
    'pakistan': 586, 'bangladesh': 50, 'vietnam': 704, 'thailand': 764, 'malaysia': 458,
    'philippines': 608, 'poland': 616, 'netherlands': 528, 'belgium': 56, 'sweden': 752,
    'norway': 578, 'denmark': 208, 'finland': 246, 'switzerland': 756, 'austria': 40,
    'greece': 300, 'portugal': 620, 'ireland': 372, 'new zealand': 554, 'singapore': 702,
    'chile': 152, 'colombia': 170, 'peru': 604, 'venezuela': 862, 'cuba': 192,
    'afghanistan': 4, 'iraq': 368, 'syria': 760, 'lebanon': 422, 'jordan': 400,
    'morocco': 504, 'algeria': 12, 'tunisia': 788, 'libya': 434, 'kenya': 404,
    'ethiopia': 231, 'sudan': 729, 'myanmar': 104, 'nepal': 524, 'sri lanka': 144,
    'georgia': 268, 'czech republic': 203, 'hungary': 348, 'romania': 642, 'bulgaria': 100,
    'greenland': 304, 'taiwan': 158, 'north korea': 408, 'serbia': 688, 'croatia': 191,
    'slovakia': 703, 'slovenia': 705, 'iceland': 352, 'luxembourg': 442, 'malta': 470,
    'cyprus': 196, 'estonia': 233, 'latvia': 428, 'lithuania': 440, 'qatar': 634,
    'uae': 784, 'united arab emirates': 784, 'kuwait': 414, 'bahrain': 48, 'oman': 512,
    'yemen': 887, 'palestine': 275, 'gaza': 275
  };

  // Capital city coordinates [longitude, latitude] - keeping for potential future use
  const capitalCoordinates = {
    'united states': [-77.0369, 38.9072], 'usa': [-77.0369, 38.9072], 'us': [-77.0369, 38.9072], 'america': [-77.0369, 38.9072],
    'canada': [-75.6972, 45.4215], 'mexico': [-99.1332, 19.4326], 'brazil': [-47.9292, -15.7801],
    'argentina': [-58.3816, -34.6037], 'united kingdom': [-0.1276, 51.5074], 'uk': [-0.1276, 51.5074],
    'france': [2.3522, 48.8566], 'germany': [13.4050, 52.5200], 'italy': [12.4964, 41.9028],
    'spain': [-3.7038, 40.4168], 'russia': [37.6173, 55.7558], 'china': [116.4074, 39.9042],
    'japan': [139.6917, 35.6895], 'south korea': [126.9780, 37.5665], 'india': [77.2090, 28.6139],
    'australia': [149.1300, -35.2809], 'israel': [35.2137, 31.7683], 'iran': [51.3890, 35.6892],
    'ukraine': [30.5234, 50.4501], 'turkey': [32.8597, 39.9334], 'egypt': [31.2357, 30.0444],
    'south africa': [28.0473, -25.7479], 'nigeria': [7.4951, 9.0579], 'saudi arabia': [46.6753, 24.7136],
    'indonesia': [106.8456, -6.2088], 'pakistan': [73.0479, 33.6844], 'bangladesh': [90.4125, 23.8103],
    'vietnam': [105.8342, 21.0278], 'thailand': [100.5018, 13.7563], 'malaysia': [101.6869, 3.1390],
    'philippines': [120.9842, 14.5995], 'poland': [21.0122, 52.2297], 'netherlands': [4.9041, 52.3676],
    'belgium': [4.3517, 50.8503], 'sweden': [18.0686, 59.3293], 'norway': [10.7522, 59.9139],
    'denmark': [12.5683, 55.6761], 'finland': [24.9384, 60.1699], 'switzerland': [7.4474, 46.9480],
    'austria': [16.3738, 48.2082], 'greece': [23.7275, 37.9838], 'portugal': [-9.1393, 38.7223],
    'ireland': [-6.2603, 53.3498], 'new zealand': [174.7762, -41.2865], 'singapore': [103.8198, 1.3521],
    'chile': [-70.6693, -33.4489], 'colombia': [-74.0721, 4.7110], 'peru': [-77.0428, -12.0464],
    'venezuela': [-66.9036, 10.4806], 'cuba': [-82.3666, 23.1136], 'afghanistan': [69.1723, 34.5553],
    'iraq': [44.3661, 33.3152], 'syria': [36.2765, 33.5138], 'lebanon': [35.5018, 33.8938],
    'jordan': [35.9106, 31.9454], 'morocco': [-6.8498, 33.9716], 'algeria': [3.0588, 36.7538],
    'tunisia': [10.1658, 36.8065], 'libya': [13.1913, 32.8872], 'kenya': [36.8219, -1.2921],
    'ethiopia': [38.7578, 8.9806], 'sudan': [32.5599, 15.5007], 'myanmar': [96.1951, 16.8661],
    'nepal': [85.3240, 27.7172], 'sri lanka': [79.8612, 6.9271], 'georgia': [44.7833, 41.7151],
    'czech republic': [14.4378, 50.0755], 'hungary': [19.0402, 47.4979], 'romania': [26.1025, 44.4268],
    'bulgaria': [23.3219, 42.6977], 'greenland': [-51.7214, 64.1836], 'taiwan': [121.5654, 25.0330],
    'north korea': [125.7625, 39.0392], 'serbia': [20.4489, 44.7866], 'croatia': [15.9819, 45.8150],
    'slovakia': [17.1077, 48.1486], 'slovenia': [14.5058, 46.0569], 'iceland': [-21.9426, 64.1466],
    'luxembourg': [6.1319, 49.6116], 'malta': [14.5146, 35.8989], 'cyprus': [33.3823, 35.1856],
    'estonia': [24.7536, 59.4370], 'latvia': [24.1052, 56.9496], 'lithuania': [25.2797, 54.6872],
    'qatar': [51.5310, 25.2854], 'uae': [54.3773, 24.4539], 'united arab emirates': [54.3773, 24.4539],
    'kuwait': [47.9774, 29.3759], 'bahrain': [50.5577, 26.2285], 'oman': [58.5922, 23.5880],
    'yemen': [44.2075, 15.3694], 'palestine': [35.2332, 31.9522], 'gaza': [34.4668, 31.5018]
  };
  
  // 15 Globe color themes - light pastel land colors with dark highlights
  const globeColorThemes = [
    { name: 'indigo', land: '#a5b4fc', back: 'rgba(165, 180, 252, 0.5)', stroke: 'rgba(165, 180, 252, 0.6)', ocean: 'rgba(165, 180, 252, 0.02)', highlight: '#312e81' },
    { name: 'emerald', land: '#6ee7b7', back: 'rgba(110, 231, 183, 0.5)', stroke: 'rgba(110, 231, 183, 0.6)', ocean: 'rgba(110, 231, 183, 0.02)', highlight: '#064e3b' },
    { name: 'violet', land: '#c4b5fd', back: 'rgba(196, 181, 253, 0.5)', stroke: 'rgba(196, 181, 253, 0.6)', ocean: 'rgba(196, 181, 253, 0.02)', highlight: '#4c1d95' },
    { name: 'rose', land: '#fda4af', back: 'rgba(253, 164, 175, 0.5)', stroke: 'rgba(253, 164, 175, 0.6)', ocean: 'rgba(253, 164, 175, 0.02)', highlight: '#881337' },
    { name: 'amber', land: '#fcd34d', back: 'rgba(252, 211, 77, 0.5)', stroke: 'rgba(252, 211, 77, 0.6)', ocean: 'rgba(252, 211, 77, 0.02)', highlight: '#78350f' },
    { name: 'cyan', land: '#67e8f9', back: 'rgba(103, 232, 249, 0.5)', stroke: 'rgba(103, 232, 249, 0.6)', ocean: 'rgba(103, 232, 249, 0.02)', highlight: '#164e63' },
    { name: 'fuchsia', land: '#f0abfc', back: 'rgba(240, 171, 252, 0.5)', stroke: 'rgba(240, 171, 252, 0.6)', ocean: 'rgba(240, 171, 252, 0.02)', highlight: '#701a75' },
    { name: 'lime', land: '#bef264', back: 'rgba(190, 242, 100, 0.5)', stroke: 'rgba(190, 242, 100, 0.6)', ocean: 'rgba(190, 242, 100, 0.02)', highlight: '#365314' },
    { name: 'sky', land: '#7dd3fc', back: 'rgba(125, 211, 252, 0.5)', stroke: 'rgba(125, 211, 252, 0.6)', ocean: 'rgba(125, 211, 252, 0.02)', highlight: '#0c4a6e' },
    { name: 'teal', land: '#5eead4', back: 'rgba(94, 234, 212, 0.5)', stroke: 'rgba(94, 234, 212, 0.6)', ocean: 'rgba(94, 234, 212, 0.02)', highlight: '#134e4a' },
    { name: 'orange', land: '#fdba74', back: 'rgba(253, 186, 116, 0.5)', stroke: 'rgba(253, 186, 116, 0.6)', ocean: 'rgba(253, 186, 116, 0.02)', highlight: '#7c2d12' },
    { name: 'blue', land: '#93c5fd', back: 'rgba(147, 197, 253, 0.5)', stroke: 'rgba(147, 197, 253, 0.6)', ocean: 'rgba(147, 197, 253, 0.02)', highlight: '#1e3a8a' },
    { name: 'pink', land: '#f9a8d4', back: 'rgba(249, 168, 212, 0.5)', stroke: 'rgba(249, 168, 212, 0.6)', ocean: 'rgba(249, 168, 212, 0.02)', highlight: '#831843' },
    { name: 'purple', land: '#d8b4fe', back: 'rgba(216, 180, 254, 0.5)', stroke: 'rgba(216, 180, 254, 0.6)', ocean: 'rgba(216, 180, 254, 0.02)', highlight: '#581c87' },
    { name: 'green', land: '#86efac', back: 'rgba(134, 239, 172, 0.5)', stroke: 'rgba(134, 239, 172, 0.6)', ocean: 'rgba(134, 239, 172, 0.02)', highlight: '#14532d' }
  ];
  
  // Select random theme on mount
  const [globeTheme] = useState(() => globeColorThemes[Math.floor(Math.random() * globeColorThemes.length)]);

  // Time-based theme colors for professional design
  const getTimeTheme = () => {
    const time = getTimeOfDay();
    const themes = {
      morning: {
        greeting: 'Good morning',
        primary: '#f97316',      // Warm orange
        secondary: '#ea580c',    // Deep orange
        accent: '#fbbf24',       // Golden yellow
        gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
        glow: 'rgba(249, 115, 22, 0.3)'
      },
      afternoon: {
        greeting: 'Good afternoon',
        primary: '#0ea5e9',      // Sky blue
        secondary: '#0284c7',    // Ocean blue
        accent: '#06b6d4',       // Cyan
        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
        glow: 'rgba(14, 165, 233, 0.3)'
      },
      evening: {
        greeting: 'Good evening',
        primary: '#8b5cf6',      // Violet
        secondary: '#7c3aed',    // Purple
        accent: '#a855f7',       // Magenta
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
        glow: 'rgba(139, 92, 246, 0.3)'
      },
      night: {
        greeting: 'Good evening',
        primary: '#6366f1',      // Indigo
        secondary: '#4f46e5',    // Deep indigo
        accent: '#818cf8',       // Light indigo
        gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)',
        glow: 'rgba(99, 102, 241, 0.3)'
      }
    };
    return themes[time];
  };

  // Generate personalized greeting
  const getPersonalizedGreeting = () => {
    const theme = getTimeTheme();
    const analysis = analyzeStories();
    const lastVisit = getLastVisitInfo();
    
    // Use the precise time text from getLastVisitInfo
    const timePeriod = lastVisit.text;

    const topCat = analysis.topCategories[0] || 'current events';
    const catLabel = categoryLabels[topCat] || topCat;
    const capCat = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);

    // Generate sub messages with highlight markers for styling
    let subMessages = [];
    if (analysis.hasBreaking) {
      subMessages = [
        { highlight: `Major ${catLabel} developments`, rest: timePeriod },
        { highlight: `Breaking ${catLabel} news`, rest: timePeriod },
        { highlight: `Important ${catLabel} updates`, rest: timePeriod }
      ];
    } else if (analysis.hasVeryHigh) {
      subMessages = [
        { highlight: `${capCat} had significant updates`, rest: timePeriod },
        { highlight: `Notable ${catLabel} developments`, rest: timePeriod },
        { highlight: `${capCat} made headlines`, rest: timePeriod }
      ];
    } else if (analysis.highScoredCount >= 5) {
      subMessages = [
        { highlight: `Active day for ${catLabel}`, rest: timePeriod },
        { highlight: `Plenty happening`, rest: `in ${catLabel} ${timePeriod}` },
        { highlight: `${capCat} has been busy`, rest: timePeriod }
      ];
    } else if (analysis.highScoredCount >= 1) {
      subMessages = [
        { highlight: `Some ${catLabel} updates`, rest: timePeriod },
        { highlight: `A few ${catLabel} stories`, rest: timePeriod },
        { highlight: `${capCat} news`, rest: timePeriod }
      ];
    } else {
      subMessages = [
        { highlight: `Here's what's happening`, rest: timePeriod },
        { highlight: `Your news update`, rest: timePeriod },
        { highlight: `The latest`, rest: timePeriod }
      ];
    }

    const selectedSub = subMessages[Math.floor(Math.random() * subMessages.length)];

    return {
      greeting: theme.greeting,
      name: firstName || null,
      subHighlight: selectedSub.highlight,
      subRest: selectedSub.rest,
      theme
    };
  };

  const [personalGreeting] = useState(() => getPersonalizedGreeting());

  // Witty swipe hints - randomly selected each time
  const swipeHints = [
    "Swipe up. The news won't read itself.",
    "Your doom scroll awaits. Swipe up.",
    "Go on, swipe. We both know you're avoiding work.",
    "Swipe up. Reality isn't going anywhere.",
    "The world's a mess. Swipe to see why.",
    "Swipe up. Those emails can wait.",
    "Spoiler: it's not great news. Swipe anyway.",
    "The algorithm demands you swipe up.",
    "Swipe up. Pretend you're staying informed.",
    "Breaking: You haven't swiped yet.",
    "Swipe up. Touch grass later.",
    "The globe spins. So should your thumb.",
    "Yes, it's still bad out there. Swipe to confirm.",
    "One does not simply scroll past. Swipe up.",
    "Swipe up. We promise some of it is good news."
  ];
  
  const [swipeHint] = useState(() => swipeHints[Math.floor(Math.random() * swipeHints.length)]);


  // State for extracted blur colors from event images
  const [eventColors, setEventColors] = useState({});

  // Extract dominant color from image (same approach as news pages)
  const extractColorFromImage = (imgElement, eventId) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(imgElement, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;
      
      // Collect colorful pixels
      const colorCounts = {};
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        
        // Convert to HSL
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
        
        // Only consider colorful pixels
        if (s * 100 > 15 && l * 100 > 10 && l * 100 < 90) {
          const key = `${Math.round(r/25)*25},${Math.round(g/25)*25},${Math.round(b/25)*25}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
      }
      
      // Find most common color
      let maxCount = 0;
      let dominantColor = null;
      for (const [key, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = key;
        }
      }
      
      if (dominantColor) {
        const [r, g, b] = dominantColor.split(',').map(Number);
        // Create darker blur color
        const darkR = Math.round(r * 0.4);
        const darkG = Math.round(g * 0.4);
        const darkB = Math.round(b * 0.4);
        const blurColor = `#${darkR.toString(16).padStart(2,'0')}${darkG.toString(16).padStart(2,'0')}${darkB.toString(16).padStart(2,'0')}`;
        
        setEventColors(prev => ({ ...prev, [eventId]: blurColor }));
      }
    } catch (e) {
      console.log('Color extraction failed for event', eventId);
    }
  };

  // State for world events - use SSR data first, then cache, then fetch
  const [worldEvents, setWorldEvents] = useState(() => {
    // Use SSR data if available
    if (initialWorldEvents && initialWorldEvents.length > 0) {
      return initialWorldEvents;
    }
    // Fall back to localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tennews_world_events');
        if (cached) {
          const { events, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000 && events.length > 0) {
            return events;
          }
        }
      } catch (e) {}
    }
    return [];
  });
  const [eventsLoading, setEventsLoading] = useState(() => {
    // Not loading if we have SSR data
    if (initialWorldEvents && initialWorldEvents.length > 0) {
      return false;
    }
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tennews_world_events');
        if (cached) {
          const { events, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000 && events.length > 0) {
            return false;
          }
        }
      } catch (e) {}
    }
    return true;
  });

  // Fetch world events from API (runs in background, updates cache)
  useEffect(() => {
    // Skip if we already have SSR data
    if (initialWorldEvents && initialWorldEvents.length > 0 && worldEvents.length > 0) {
      setEventsLoading(false);
      return;
    }
    
    const fetchWorldEvents = async () => {
      try {
        const lastVisit = localStorage.getItem('tennews_last_visit') || Date.now() - 24 * 60 * 60 * 1000;
        const response = await fetch(`/api/world-events?since=${lastVisit}&limit=8`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.events && data.events.length > 0) {
            setWorldEvents(data.events);
            // Cache for instant loading next time
            localStorage.setItem('tennews_world_events', JSON.stringify({
              events: data.events,
              timestamp: Date.now()
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch world events:', error);
      } finally {
        setEventsLoading(false);
      }
    };

    fetchWorldEvents();
  }, []);

  // Auto-scroll events - snap to each card, stay 4 seconds, then smooth scroll to next
  useEffect(() => {
    const el = eventsScrollRef.current;
    if (!el || worldEvents.length === 0) return;

    let currentIndex = 0;
    const cardCount = worldEvents.length;
    
    const scrollToCard = (index) => {
      if (!eventsAutoScrollRef.current || !el) return;
      
      // Calculate card width including gap
      const cardWidth = el.firstElementChild?.offsetWidth || 300;
      const gap = 16; // matches CSS gap
      const scrollPosition = index * (cardWidth + gap);
      
      // Smooth scroll to the target position
      el.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    };

    const advanceToNext = () => {
      if (!eventsAutoScrollRef.current) return;
      
      currentIndex++;
      
      // When reaching the duplicated set, reset to start seamlessly
      if (currentIndex >= cardCount) {
        // Jump instantly to start (same visual position due to duplication)
        el.scrollLeft = 0;
        currentIndex = 0;
        // Then scroll to first card after a tiny delay
        setTimeout(() => {
          if (eventsAutoScrollRef.current) {
            scrollToCard(1);
            currentIndex = 1;
          }
        }, 50);
      } else {
        scrollToCard(currentIndex);
      }
    };

    // Start auto-scroll after initial delay
    const initialTimeout = setTimeout(() => {
      // Set up interval to advance every 4 seconds
      eventsScrollAnimationRef.current = setInterval(advanceToNext, 4000);
    }, 2000);

    return () => {
      clearTimeout(initialTimeout);
      if (eventsScrollAnimationRef.current) {
        clearInterval(eventsScrollAnimationRef.current);
      }
    };
  }, [worldEvents]);

  // Handle infinite scroll loop for manual scrolling
  const handleEventsScroll = useCallback(() => {
    const el = eventsScrollRef.current;
    if (!el || worldEvents.length === 0) return;
    
    const halfWidth = el.scrollWidth / 2;
    
    // When scrolling past halfway, jump back seamlessly
    if (el.scrollLeft >= halfWidth) {
      el.scrollLeft = el.scrollLeft - halfWidth;
    } else if (el.scrollLeft <= 0) {
      el.scrollLeft = halfWidth + el.scrollLeft;
    }
  }, [worldEvents]);

  // Stop auto-scroll when user interacts
  const stopAutoScroll = useCallback(() => {
    eventsAutoScrollRef.current = false;
    if (eventsScrollAnimationRef.current) {
      clearInterval(eventsScrollAnimationRef.current);
      eventsScrollAnimationRef.current = null;
    }
  }, []);

  // Fetch country counts from API
  const fetchCountryCounts = useCallback(async () => {
    try {
      let response = await fetch(`/api/map-countries?hours=${mapTimeWindow}`);
      if (response.ok) {
        let data = await response.json();
        if (data.totalArticles === 0 && mapTimeWindow < 24) {
          response = await fetch(`/api/map-countries?hours=24`);
          if (response.ok) data = await response.json();
        }
        if (data.countryCounts && Object.keys(data.countryCounts).length > 0) {
          setNewsCountByCountry(data.countryCounts);
        }
      }
    } catch (error) {
      console.error('Error fetching country counts:', error);
    }
  }, [mapTimeWindow]);

  useEffect(() => {
    fetchCountryCounts();
    const interval = setInterval(fetchCountryCounts, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCountryCounts]);

  useEffect(() => {
    if (initialStories && Array.isArray(initialStories)) {
      setStories(initialStories);
    }
  }, [initialStories]);

  // Load 3D globe - NEW DESIGN WITH FRONT AND BACK LAYERS
  useEffect(() => {
    if (!scriptsLoaded.d3 || !scriptsLoaded.topojson) return;
    if (typeof window === 'undefined') return;
    if (!isVisible) return;

    const loadGlobe = async () => {
      try {
        const d3 = window.d3;
        const topojson = window.topojson;
        if (!d3 || !topojson) return;
        
        const container = mapContainerRef.current;
        if (!container) return;
        
        const containerWidth = container.offsetWidth || 400;
        const containerHeight = container.offsetHeight || 400;
        const size = Math.min(containerWidth, containerHeight);
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2.2;
        
        container.innerHTML = '';
        
        const svg = d3.select(container)
          .append('svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `0 0 ${size} ${size}`)
          .style('overflow', 'visible');
        
        // Front projection (normal view)
        const projectionFront = d3.geoOrthographic()
          .scale(radius)
          .translate([cx, cy])
          .clipAngle(90);
        
        // Back projection (opposite side)
        const projectionBack = d3.geoOrthographic()
          .scale(radius)
          .translate([cx, cy])
          .clipAngle(90);
        
        projectionRef.current = projectionFront;
        const pathFront = d3.geoPath().projection(projectionFront);
        const pathBack = d3.geoPath().projection(projectionBack);
        pathRef.current = pathFront;
        
        // ===== RENDER LAYERS =====
        
        // Layer 0: Ocean circle with theme color
        svg.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', radius)
          .attr('fill', globeTheme.ocean);
        
        // Layer 1: Back countries (mirrored horizontally)
        const globeBack = svg.append('g')
          .attr('class', 'globe-back')
          .attr('transform', `translate(${size}, 0) scale(-1, 1)`);
        
        // Layer 2: Front countries
        const globeFront = svg.append('g')
          .attr('class', 'globe-countries');
        globeRef.current = globeFront;
        
        // Store references for rotation updates
        const globeBackRef = { current: globeBack };
        
        const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topo = await res.json();
        const countries = topojson.feature(topo, topo.objects.countries);
        
        const exclude = [304, 10]; // Greenland, Antarctica
        const filtered = {
          ...countries,
          features: countries.features.filter(f => !exclude.includes(+f.id))
        };
        
        // Render back countries with theme colors
        globeBack.selectAll('path')
          .data(filtered.features)
          .enter()
          .append('path')
          .attr('d', pathBack)
          .attr('fill', globeTheme.back)
          .attr('stroke', globeTheme.stroke)
          .attr('stroke-width', 0.4)
          .attr('opacity', 0.35);
        
        // Render front countries with theme colors
        globeFront.selectAll('path')
          .data(filtered.features)
          .enter()
          .append('path')
          .attr('d', pathFront)
          .attr('data-id', d => d.id)
          .attr('fill', globeTheme.land)
          .attr('stroke', 'rgba(255,255,255,0.5)')
          .attr('stroke-width', 0.5);
        
        // Update function for both projections
        const updateGlobe = () => {
          // Front: normal rotation
          projectionFront.rotate([rotationRef.current.x, rotationRef.current.y]);
          
          // Back: 180 degrees opposite, negate Y because of horizontal mirror
          projectionBack.rotate([rotationRef.current.x + 180, -rotationRef.current.y]);
          
          globeFront.selectAll('path').attr('d', pathFront);
          globeBackRef.current.selectAll('path').attr('d', pathBack);
        };
        
        // Disable pointer events - globe is view-only
        svg.style('pointer-events', 'none');
        
        // Auto rotation - smooth and elegant
        let animationId;
        let isActive = true;
        const rotate = () => {
          if (!isActive) return;
          if (isRotatingRef.current && !isDraggingRef.current) {
            rotationRef.current.x += 0.15;
            updateGlobe();
          }
          animationId = requestAnimationFrame(rotate);
        };
        
        updateGlobe();
        rotate();
        
        setMapLoaded(true);
        
        return () => { 
          isActive = false;
          if (animationId) cancelAnimationFrame(animationId); 
        };
      } catch (error) {
        console.error('Error loading globe:', error);
        return () => {};
      }
    };

    const cleanup = loadGlobe();
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then(fn => fn && fn());
      } else if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [scriptsLoaded, isVisible, globeTheme]);

  // Color countries with news using contrasting color
  useEffect(() => {
    if (!mapLoaded || Object.keys(newsCountByCountry).length === 0 || !globeRef.current) return;
    
    const d3 = window.d3;
    if (!d3) return;
    
    const container = mapContainerRef.current;
    if (!container) return;
    
    const svg = d3.select(container).select('svg');
    
    // Color countries with news
    svg.selectAll('.globe-countries path').each(function() {
      const el = d3.select(this);
      const countryId = parseInt(el.attr('data-id'));
      let hasNews = false;
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        if (countryNameToId[name.toLowerCase().trim()] === countryId) {
          // Use dark highlight color for countries with news
          el.attr('fill', globeTheme.highlight);
          hasNews = true;
          break;
        }
      }
      
      // Keep default land color for countries without news
      if (!hasNews) {
        el.attr('fill', globeTheme.land);
      }
    });
  }, [mapLoaded, newsCountByCountry, globeTheme]);

  // Click/tap handler for navigation - parent handles swipe
  const handleClick = (e) => {
    if (onContinue) onContinue();
  };

  // Smooth drag-to-scroll with momentum
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    velX: 0,
    lastX: 0,
    lastTime: 0,
    momentumId: null,
    hasMoved: false,  // Track if user actually dragged
    startY: 0
  });

  const handleMouseDown = (e) => {
    stopAutoScroll();
    const el = eventsScrollRef.current;
    if (!el) return;
    
    // Cancel any ongoing momentum
    if (dragState.current.momentumId) {
      cancelAnimationFrame(dragState.current.momentumId);
    }
    
    dragState.current.isDown = true;
    dragState.current.startX = e.pageX;
    dragState.current.startY = e.pageY;
    dragState.current.scrollLeft = el.scrollLeft;
    dragState.current.lastX = e.pageX;
    dragState.current.lastTime = Date.now();
    dragState.current.velX = 0;
    dragState.current.hasMoved = false;  // Reset hasMoved
    el.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!dragState.current.isDown) return;
    
    const el = eventsScrollRef.current;
    if (!el) return;
    
    const x = e.pageX;
    const now = Date.now();
    const dt = now - dragState.current.lastTime;
    
    // Check if user has moved more than threshold (10px)
    const moveDistance = Math.abs(x - dragState.current.startX);
    if (moveDistance > 10) {
      dragState.current.hasMoved = true;
      e.preventDefault();
    }
    
    if (dt > 0) {
      dragState.current.velX = (x - dragState.current.lastX) / dt;
    }
    
    dragState.current.lastX = x;
    dragState.current.lastTime = now;
    
    const walk = x - dragState.current.startX;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    if (!dragState.current.isDown) return;
    dragState.current.isDown = false;
    
    const el = eventsScrollRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    
    // Only apply momentum if user actually dragged
    if (!dragState.current.hasMoved) return;
    
    // Apply momentum
    let velocity = dragState.current.velX * 150;
    const friction = 0.95;
    
    const momentum = () => {
      if (Math.abs(velocity) > 0.5) {
        el.scrollLeft -= velocity;
        velocity *= friction;
        dragState.current.momentumId = requestAnimationFrame(momentum);
      }
    };
    
    if (Math.abs(velocity) > 1) {
      dragState.current.momentumId = requestAnimationFrame(momentum);
    }
  };

  const handleMouseLeave = () => {
    if (dragState.current.isDown) {
      handleMouseUp();
    }
  };

  // Touch event handlers for mobile - use scroll position to detect swipe
  const handleTouchStart = (e) => {
    stopAutoScroll();
    dragState.current.hasMoved = false;
    
    const el = eventsScrollRef.current;
    if (el) {
      dragState.current.scrollLeft = el.scrollLeft;
    }
  };

  const handleTouchMove = () => {
    // Check if scroll position changed (means user is swiping)
    const el = eventsScrollRef.current;
    if (el && Math.abs(el.scrollLeft - dragState.current.scrollLeft) > 3) {
      dragState.current.hasMoved = true;
    }
  };

  const handleTouchEnd = () => {
    // Check scroll position one more time
    const el = eventsScrollRef.current;
    if (el && Math.abs(el.scrollLeft - dragState.current.scrollLeft) > 3) {
      dragState.current.hasMoved = true;
    }
  };

  // Smooth wheel scrolling
  const handleEventsWheel = useCallback((e) => {
    stopAutoScroll();
    const el = eventsScrollRef.current;
    if (!el) return;
    
    e.preventDefault();
    el.scrollBy({
      left: e.deltaY * 2,
      behavior: 'smooth'
    });
  }, [stopAutoScroll]);

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/d3@7" 
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, d3: true }))}
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/topojson-client@3" 
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, topojson: true }))}
      />
      
      <style jsx>{`
        .first-page-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fafafa;
          z-index: 1;
          overflow-x: visible;
          overflow-y: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
        }

        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          position: relative;
          z-index: 1;
          overflow-x: visible;
          overflow-y: visible;
        }

        .greeting-section {
          text-align: left;
          animation: fadeUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          padding-top: 0;
          opacity: 0;
          z-index: 2;
          width: 100%;
        }

        @keyframes fadeUp {
          0% { 
            opacity: 0; 
            transform: translateY(20px);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .greeting-hi {
          display: block;
          font-size: 34px;
          font-weight: 600;
          letter-spacing: -0.5px;
          color: #1d1d1f;
          line-height: 1.2;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
          text-align: left;
          margin-bottom: 24px;
        }

        .greeting-name {
          font-weight: 700;
        }

        .greeting-subtitle {
          color: #86868b;
          font-weight: 500;
        }

        /* Ongoing Events Section */
        .events-section {
          width: 100vw;
          margin-left: -24px;
          margin-top: 32px;
          animation: fadeUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s forwards;
          opacity: 0;
          position: relative;
          z-index: 10;
        }

        .events-header {
          font-size: 13px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          padding-left: 24px;
          text-align: left;
        }

        .events-scroll {
          display: flex;
          gap: 16px;
          overflow-x: scroll;
          overflow-y: hidden;
          padding: 4px 24px 20px 24px;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          touch-action: pan-x pan-y;
          overscroll-behavior-x: contain;
        }

        .events-scroll::-webkit-scrollbar {
          display: none;
        }

        .event-card {
          flex-shrink: 0;
          width: calc(100vw - 60px);
          cursor: pointer;
          transition: transform 0.2s ease;
          scroll-snap-align: center;
          text-decoration: none;
          display: block;
          color: inherit;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }

        .event-card:active {
          transform: scale(0.98);
        }

        .event-image-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08);
        }

        .event-skeleton {
          flex-shrink: 0;
          width: calc(100vw - 60px);
          aspect-ratio: 1 / 1;
          border-radius: 24px;
          background: #e8e8e8;
          cursor: default;
          scroll-snap-align: center;
        }

        .event-skeleton .skeleton-shimmer {
          width: 100%;
          height: 100%;
          border-radius: 24px;
        }

        .skeleton-shimmer {
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            #e8e8e8 0%,
            #f5f5f5 50%,
            #e8e8e8 100%
          );
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .event-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 150%;
          object-fit: cover;
          object-position: top center;
          opacity: 0.5;
        }

        .event-blur {
          display: none;
        }

        /* Liquid glass overlay - gradient blur from top to bottom */
        .event-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 35%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 20px;
          border-radius: 0 0 24px 24px;
          overflow: hidden;
        }

        /* Background gradient layer */
        .event-overlay::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.2) 20%,
            rgba(255, 255, 255, 0.5) 45%,
            rgba(255, 255, 255, 0.8) 70%,
            rgba(255, 255, 255, 1) 100%
          );
          z-index: 0;
        }

        /* Blur layer with gradient mask */
        .event-overlay::after {
          content: '';
          position: absolute;
          inset: 0;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          -webkit-mask: linear-gradient(to bottom, transparent 0%, black 50%);
          mask: linear-gradient(to bottom, transparent 0%, black 50%);
          z-index: 1;
        }

        .event-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
          position: relative;
          z-index: 2;
        }

        .event-name {
          font-size: 24px;
          font-weight: 700;
          color: #000;
          line-height: 1.2;
          letter-spacing: -0.5px;
          text-align: center;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .event-tagline {
          font-size: 13px;
          font-weight: 400;
          color: #333;
          line-height: 1.4;
          text-align: center;
          margin: 0;
          max-width: 95%;
        }

        .event-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 4px;
        }

        .event-updates {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .update-dot {
          width: 6px;
          height: 6px;
          background: #ff3b30;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .event-read-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .event-read-time::before {
          content: '•';
          opacity: 0.5;
        }

        .event-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .event-time::before {
          content: '•';
          opacity: 0.5;
        }

        .event-new-badge {
          background: #ff3b30;
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 3px 6px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }

        .event-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 8px;
          height: 8px;
          padding: 0;
          background: #FF3B30;
          border-radius: 50%;
          font-size: 0;
          box-shadow: 0 1px 3px rgba(255,59,48,0.4);
        }




        @keyframes subtleBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        .swipe-hint {
          text-align: center;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #86868b;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          margin-top: 24px;
          padding: 0 20px 40px 20px;
          animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards, subtleBounce 2s ease-in-out 1.6s infinite;
          opacity: 0;
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 0;
          }
          .greeting-section {
            padding-top: 0;
            padding-left: 16px;
            padding-right: 16px;
            width: 100%;
            margin: 0;
          }
          .greeting-hi {
            font-size: 28px;
            margin-bottom: 12px;
          }
          .events-section {
            margin-top: 24px;
            margin-left: -16px;
          }
          .events-header {
            font-size: 12px;
            padding-left: 16px;
            margin-bottom: 10px;
          }
          .events-scroll {
            gap: 8px;
            padding: 4px 16px 8px 16px;
          }
          .event-card {
            width: calc(100vw - 48px);
          }
          .event-image-wrapper {
            border-radius: 20px;
          }
          .event-overlay {
            padding: 16px;
            border-radius: 0 0 20px 20px;
          }
          .event-overlay::before,
          .event-overlay::after {
            border-radius: 0 0 20px 20px;
          }
          .event-name {
            font-size: 22px;
          }
          .event-tagline {
            font-size: 12px;
          }
          .event-meta {
            font-size: 10px;
            gap: 10px;
          }
          .event-skeleton {
            width: calc(100vw - 48px);
            border-radius: 20px;
          }
          .event-skeleton .skeleton-shimmer {
            border-radius: 20px;
          }
          .events-scroll {
            padding: 4px 16px 16px 16px;
            gap: 12px;
          }
          .swipe-hint {
            bottom: 15px;
            font-size: 14px;
          }
        }

        @media (max-width: 375px) {
          .greeting-hi {
            font-size: 26px;
          }
          .events-section {
            margin-top: 20px;
          }
          .events-header {
            font-size: 11px;
            margin-bottom: 8px;
          }
          .events-scroll {
            gap: 6px;
          }
          .event-card {
            width: calc(100vw - 40px);
          }
          .event-image-wrapper {
            border-radius: 18px;
          }
          .event-overlay {
            padding: 14px;
            border-radius: 0 0 18px 18px;
          }
          .event-overlay::before,
          .event-overlay::after {
            border-radius: 0 0 18px 18px;
          }
          .event-name {
            font-size: 20px;
          }
          .event-tagline {
            font-size: 11px;
          }
          .event-meta {
            font-size: 9px;
            gap: 8px;
          }
          .event-content {
            gap: 6px;
          }
          .event-skeleton {
            width: calc(100vw - 40px);
            border-radius: 18px;
          }
          .event-skeleton .skeleton-shimmer {
            border-radius: 18px;
          }
          .event-badge {
            min-width: 16px;
            height: 16px;
            font-size: 9px;
            border-radius: 8px;
          }
          .event-badge {
            min-width: 14px;
            height: 14px;
            font-size: 9px;
          }
        }
      `}</style>

      <div 
        className="first-page-container" 
        onClick={handleClick}
      >
        <div className="content-wrapper">
          <div className="greeting-section">
            <span className="greeting-hi">
              {personalGreeting.greeting}{personalGreeting.name && <span className="greeting-name">, {personalGreeting.name}</span>}, <span className="greeting-subtitle">{personalGreeting.subHighlight} {personalGreeting.subRest}</span>
            </span>
          </div>
            
          {/* Ongoing Events Section - show skeletons while loading, then real events */}
          {(eventsLoading || worldEvents.length > 0) && (
            <div 
              className="events-section"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="events-header">World Events</div>
              <div 
                className="events-scroll"
                ref={eventsScrollRef}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onWheel={handleEventsWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onScroll={handleEventsScroll}
              >
                {eventsLoading && worldEvents.length === 0 ? (
                  // Show skeleton placeholders while loading
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={`skeleton-${i}`} className="event-card event-skeleton">
                        <div className="skeleton-shimmer" />
                      </div>
                    ))}
                  </>
                ) : (
                  // Show actual events (duplicated for infinite scroll)
                  [...worldEvents, ...worldEvents].map((event, index) => {
                    return (
                      <a 
                        key={`${event.id}-${index}`} 
                        href={`/event/${event.slug || event.id}`}
                        className="event-card"
                        onClick={(e) => {
                          // Don't navigate if user was swiping
                          if (dragState.current.hasMoved) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Reset for next interaction
                            dragState.current.hasMoved = false;
                            return;
                          }
                          // Allow normal link behavior for navigation
                        }}
                      >
                        <div className="event-image-wrapper">
                          {event.image_url && (
                            <img 
                              className="event-image" 
                              src={event.image_url} 
                              alt={event.name}
                              crossOrigin="anonymous"
                            />
                          )}
                          <div className="event-overlay">
                            <div className="event-content">
                              <span className="event-name">{event.name}</span>
                              {event.background && (
                                <p className="event-tagline">
                                  {event.background.split('.')[0].slice(0, 60)}{event.background.split('.')[0].length > 60 ? '...' : ''}
                                </p>
                              )}
                              <div className="event-meta">
                                {(() => {
                                  // Check for new articles since last visit to this event
                                  const lastVisitKey = `tennews_event_visit_${event.id}`;
                                  const lastVisit = typeof window !== 'undefined' ? localStorage.getItem(lastVisitKey) : null;
                                  const hasNewSinceVisit = lastVisit && event.last_article_at && 
                                    new Date(event.last_article_at) > new Date(parseInt(lastVisit));
                                  
                                  return hasNewSinceVisit ? (
                                    <span className="event-new-badge">NEW</span>
                                  ) : null;
                                })()}
                                {event.newUpdates > 0 && (
                                  <span className="event-updates">
                                    <span className="update-dot"></span>
                                    {event.newUpdates} update{event.newUpdates !== 1 ? 's' : ''}
                                  </span>
                                )}
                                <span className="event-read-time">
                                  {Math.max(1, Math.ceil((event.newUpdates || 1) * 1.5))} min read
                                </span>
                                {event.last_article_at && (
                                  <span className="event-time">
                                    {(() => {
                                      const diff = Date.now() - new Date(event.last_article_at).getTime();
                                      const hours = Math.floor(diff / (1000 * 60 * 60));
                                      const days = Math.floor(hours / 24);
                                      if (days > 0) return `${days}d ago`;
                                      if (hours > 0) return `${hours}h ago`;
                                      return 'Just now';
                                    })()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="swipe-hint">{swipeHint}</div>
        </div>
      </div>
    </>
  );
}

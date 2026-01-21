import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';

export default function NewFirstPage({ onContinue, user, userProfile, stories: initialStories, readTracker, isVisible = true }) {
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
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
        }

        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0 24px;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .greeting-section {
          text-align: center;
          animation: fadeUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          padding-top: 100px;
          opacity: 0;
          z-index: 2;
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

        .greeting-sub {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          margin: 0 auto;
          margin-top: 0;
          animation: fadeUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        .status-line {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 320px;
          gap: 20px;
        }

        .greeting-hi {
          display: block;
          font-size: 48px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #000000;
          line-height: 1.0;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
        }

        .greeting-name {
          font-weight: 600;
        }

        .status-text {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #1d1d1f;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
          line-height: 1.4;
          background: linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%);
          padding: 10px 20px;
          border-radius: 100px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .status-text::before {
          content: '';
          width: 6px;
          height: 6px;
          background: #34c759;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(52, 199, 89, 0.6);
        }

        .status-time {
          display: none;
        }

        .status-dot {
          display: none;
        }

        .globe-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          position: relative;
          animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
          width: 100%;
        }

        .globe-container {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 420px;
          max-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
        }

        .globe-container :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
          pointer-events: none;
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
          position: absolute;
          bottom: 40px;
          left: 0;
          right: 0;
          width: 100%;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #86868b;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          text-align: center;
          animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards, subtleBounce 2s ease-in-out 1.6s infinite;
          opacity: 0;
          padding: 0 20px;
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 0;
            overflow: hidden;
          }
          .greeting-section {
            padding-top: 90px;
            padding-left: 24px;
            padding-right: 24px;
          }
          .status-line {
            max-width: 300px;
            gap: 16px;
          }
          .greeting-hi {
            font-size: 42px;
          }
          .status-text {
            font-size: 13px;
            padding: 8px 16px;
          }
          .globe-section {
            overflow: hidden;
            width: 100vw;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .globe-container {
            max-width: none;
            max-height: none;
            width: 160vw;
            height: 160vw;
            margin-top: 0;
            touch-action: none;
          }
          .swipe-hint {
            bottom: 30px;
            font-size: 14px;
          }
        }

        @media (max-width: 375px) {
          .status-line {
            max-width: 280px;
            gap: 14px;
          }
          .greeting-hi {
            font-size: 36px;
          }
          .status-text {
            font-size: 12px;
            padding: 8px 14px;
          }
        }
      `}</style>

      <div 
        className="first-page-container" 
        onClick={handleClick}
      >
        <div className="content-wrapper">
          <div className="greeting-section">
            <div className="greeting-sub">
              <div className="status-line">
                <span className="greeting-hi">
                  {personalGreeting.greeting}{personalGreeting.name && <span className="greeting-name">, {personalGreeting.name}</span>}
                </span>
                <span className="status-text">{personalGreeting.subHighlight} {personalGreeting.subRest}.</span>
              </div>
            </div>
          </div>

          <div className="globe-section">
            <div className="globe-container" ref={mapContainerRef}></div>
            <div className="swipe-hint">{swipeHint}</div>
          </div>
        </div>
      </div>
    </>
  );
}

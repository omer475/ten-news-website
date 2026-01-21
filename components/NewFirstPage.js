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
    'georgia': 268, 'czech republic': 203, 'hungary': 348, 'romania': 642, 'bulgaria': 100
  };

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

  // Color scale for globe - Grayscale with blue accent for activity
  const getColor = (value) => {
    // Grayscale to blue scale - gray = less activity, blue = more activity
    const colors = [
      { pos: 0, r: 180, g: 185, b: 190 },    // Light gray - Low activity
      { pos: 0.5, r: 130, g: 160, b: 200 },  // Gray-blue - Medium activity  
      { pos: 1, r: 90, g: 130, b: 180 }      // Muted blue - High/Breaking
    ];
    
    let lower = colors[0], upper = colors[colors.length - 1];
    for (let i = 0; i < colors.length - 1; i++) {
      if (value >= colors[i].pos && value <= colors[i + 1].pos) {
        lower = colors[i]; upper = colors[i + 1]; break;
      }
    }
    const range = upper.pos - lower.pos;
    const factor = range === 0 ? 0 : (value - lower.pos) / range;
    const r = Math.round(lower.r + (upper.r - lower.r) * factor);
    const g = Math.round(lower.g + (upper.g - lower.g) * factor);
    const b = Math.round(lower.b + (upper.b - lower.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  };

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
        
        // Layer 1: Back countries (mirrored horizontally)
        const globeBack = svg.append('g')
          .attr('class', 'globe-back')
          .attr('transform', `translate(${size}, 0) scale(-1, 1)`);
        
        // Layer 2: Front countries
        const globeFront = svg.append('g')
          .attr('class', 'globe-countries');
        globeRef.current = globeFront;
        
        // Store back reference for rotation updates
        const globeBackRef = { current: globeBack };
        
        const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topo = await res.json();
        const countries = topojson.feature(topo, topo.objects.countries);
        
        const exclude = [304, 10]; // Greenland, Antarctica
        const filtered = {
          ...countries,
          features: countries.features.filter(f => !exclude.includes(+f.id))
        };
        
        // Render back countries (faded, behind)
        globeBack.selectAll('path')
          .data(filtered.features)
          .enter()
          .append('path')
          .attr('class', 'country-back')
          .attr('d', pathBack)
          .attr('data-id', d => d.id);
        
        // Render front countries
        globeFront.selectAll('path')
          .data(filtered.features)
          .enter()
          .append('path')
          .attr('class', 'country-front')
          .attr('d', pathFront)
          .attr('data-id', d => d.id);
        
        // Update function for both projections
        const updateGlobe = () => {
          // Front: normal rotation
          projectionFront.rotate([rotationRef.current.x, rotationRef.current.y]);
          
          // Back: 180 degrees opposite, negate Y because of horizontal mirror
          projectionBack.rotate([rotationRef.current.x + 180, -rotationRef.current.y]);
          
          globeFront.selectAll('path').attr('d', pathFront);
          globeBackRef.current.selectAll('path').attr('d', pathBack);
        };
        
        // Drag functionality
        const sensitivity = 0.25;
        const drag = d3.drag()
          .on('start', () => {
            isDraggingRef.current = true;
            isRotatingRef.current = false;
          })
          .on('drag', (event) => {
            rotationRef.current.x += event.dx * sensitivity;
            rotationRef.current.y -= event.dy * sensitivity;
            rotationRef.current.y = Math.max(-90, Math.min(90, rotationRef.current.y));
            updateGlobe();
          })
          .on('end', () => {
            isDraggingRef.current = false;
            setTimeout(() => { isRotatingRef.current = true; }, 2000);
          });
        
        svg.call(drag);
        svg.style('cursor', 'grab');
        
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
  }, [scriptsLoaded, isVisible]);

  // Color globe countries with professional highlighting
  useEffect(() => {
    if (!mapLoaded || Object.keys(newsCountByCountry).length === 0 || !globeRef.current) return;
    
    const d3 = window.d3;
    if (!d3) return;
    
    const counts = Object.values(newsCountByCountry);
    const maxCount = Math.max(...counts, 1);
    
    globeRef.current.selectAll('.country-front').each(function() {
      const el = d3.select(this);
      const countryId = parseInt(el.attr('data-id'));
      let hasNews = false;
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        if (countryNameToId[name.toLowerCase().trim()] === countryId) {
          const intensity = count / maxCount;
          el.style('fill', getColor(intensity));
          hasNews = true;
          break;
        }
      }
      
      // Reset non-news countries to match the new design
      if (!hasNews) {
        el.style('fill', '#e0e0e0');
      }
    });
  }, [mapLoaded, newsCountByCountry]);

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
          padding-top: 120px;
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
          display: block;
          text-align: center;
          max-width: 340px;
        }

        .greeting-hi {
          display: block;
          font-size: 34px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #000000;
          line-height: 1.1;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          margin-bottom: 16px;
        }

        .greeting-name {
          font-weight: 700;
        }

        .status-text {
          display: block;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: #6e6e73;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          line-height: 1.4;
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
          cursor: grab;
        }

        .globe-container :global(svg:active) {
          cursor: grabbing;
        }

        .globe-container :global(.country-back) {
          fill: #f0f0f0;
          stroke: #e8e8e8;
          stroke-width: 0.3;
          opacity: 0.35;
        }

        .globe-container :global(.country-front) {
          fill: #e0e0e0;
          stroke: #ffffff;
          stroke-width: 0.5;
        }

        .swipe-hint {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #86868b;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          text-align: center;
          animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards;
          opacity: 0;
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 0;
            overflow: hidden;
          }
          .greeting-section {
            padding-top: 100px;
            padding-left: 24px;
            padding-right: 24px;
          }
          .status-line {
            max-width: 300px;
          }
          .greeting-hi {
            font-size: 30px;
            margin-bottom: 14px;
          }
          .status-text {
            font-size: 20px;
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
          }
          .greeting-hi {
            font-size: 26px;
            margin-bottom: 12px;
          }
          .status-text {
            font-size: 18px;
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
            <div className="swipe-hint">Swipe up. The news won't read itself.</div>
          </div>
        </div>
      </div>
    </>
  );
}

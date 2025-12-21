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

  // Generate personalized greeting
  const getPersonalizedGreeting = () => {
    const time = getTimeOfDay();
    const name = firstName ? ` ${firstName}` : '';
    const analysis = analyzeStories();
    const lastVisit = getLastVisitInfo();
    
    // Use the precise time text from getLastVisitInfo
    const timePeriod = lastVisit.text;
    
    const greetings = {
      morning: `Good morning${name}`,
      afternoon: `Good afternoon${name}`,
      evening: `Good evening${name}`,
      night: `Good evening${name}`
    };

    const topCat = analysis.topCategories[0] || 'current events';
    const catLabel = categoryLabels[topCat] || topCat;
    const capCat = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);

    let subMessages = [];
    if (analysis.hasBreaking) {
      subMessages = [
        `Major ${catLabel} developments ${timePeriod}`,
        `Breaking ${catLabel} news ${timePeriod}`,
        `Important ${catLabel} updates ${timePeriod}`
      ];
    } else if (analysis.hasVeryHigh) {
      subMessages = [
        `${capCat} had significant updates ${timePeriod}`,
        `Notable ${catLabel} developments ${timePeriod}`,
        `${capCat} made headlines ${timePeriod}`
      ];
    } else if (analysis.highScoredCount >= 5) {
      subMessages = [
        `Active day for ${catLabel} ${timePeriod}`,
        `Plenty happening in ${catLabel} ${timePeriod}`,
        `${capCat} has been busy ${timePeriod}`
      ];
    } else if (analysis.highScoredCount >= 1) {
      subMessages = [
        `Some ${catLabel} updates ${timePeriod}`,
        `A few ${catLabel} stories ${timePeriod}`,
        `${capCat} news ${timePeriod}`
      ];
    } else {
      subMessages = [
        `Here's what's happening ${timePeriod}`,
        `Your news update ${timePeriod}`,
        `The latest ${timePeriod}`
      ];
    }

    return {
      hi: greetings[time],
      sub: subMessages[Math.floor(Math.random() * subMessages.length)]
    };
  };

  const [personalGreeting] = useState(() => getPersonalizedGreeting());

  // Color scale for globe - Minimal Modern Single-Tone
  const getColor = (value) => {
    // Elegant indigo scale - lighter = less activity, darker = more activity
    const colors = [
      { pos: 0, r: 165, g: 180, b: 252 },    // Light indigo - Low activity
      { pos: 0.5, r: 99, g: 102, b: 241 },   // Indigo - Medium activity  
      { pos: 1, r: 67, g: 56, b: 202 }       // Deep indigo - High/Breaking
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

  // Load 3D globe - MINIMAL MODERN DESIGN
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
        
        const projection = d3.geoOrthographic()
          .scale(radius)
          .center([0, 0])
          .translate([cx, cy])
          .clipAngle(90);
        
        projectionRef.current = projection;
        const path = d3.geoPath().projection(projection);
        pathRef.current = path;
        
        const defs = svg.append('defs');
        
        // ===== MINIMAL MODERN DESIGN =====
        
        // Clip path
        defs.append('clipPath')
          .attr('id', 'globe-clip')
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', radius);
        
        // ===== RENDER LAYERS =====
        
        // Layer 1: Ocean/Sea - light grey sphere
        svg.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', radius)
          .attr('fill', '#e8eaed')
          .attr('class', 'globe-ocean');
        
        // Layer 2: Countries
        const globe = svg.append('g')
          .attr('class', 'globe-countries')
          .attr('clip-path', 'url(#globe-clip)');
        globeRef.current = globe;
        
        const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topo = await res.json();
        const countries = topojson.feature(topo, topo.objects.countries);
        
        const exclude = [304, 10]; // Greenland, Antarctica
        const filtered = {
          ...countries,
          features: countries.features.filter(f => !exclude.includes(+f.id))
        };
        
        globe.selectAll('path')
          .data(filtered.features)
          .enter()
          .append('path')
          .attr('class', 'country')
          .attr('d', path)
          .attr('data-id', d => d.id);
        
        // Disable pointer events on SVG
        svg.style('pointer-events', 'none');
        
        // Auto rotation - smooth and elegant
        let animationId;
        let isActive = true;
        const rotate = () => {
          if (!isActive) return;
          if (isRotatingRef.current && !isDraggingRef.current) {
            rotationRef.current.x += 0.05;
            projection.rotate([rotationRef.current.x, rotationRef.current.y]);
            globe.selectAll('path').attr('d', path);
          }
          animationId = requestAnimationFrame(rotate);
        };
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
    
    globeRef.current.selectAll('.country').each(function() {
      const el = d3.select(this);
      const countryId = parseInt(el.attr('data-id'));
      let hasNews = false;
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        if (countryNameToId[name.toLowerCase().trim()] === countryId) {
          const intensity = count / maxCount;
          el.style('fill', getColor(intensity))
            .classed('highlighted', intensity > 0.3);
          
          // Add subtle animation delay based on country position
          el.style('transition-delay', `${Math.random() * 0.3}s`);
          hasNews = true;
          break;
        }
      }
      
      // Reset non-news countries to visible gray
      if (!hasNews) {
        el.style('fill', '#c9cdd3')
          .classed('highlighted', false);
      }
    });
  }, [mapLoaded, newsCountByCountry]);

  const handleContinue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContinue) onContinue();
  };

  // Touch swipe detection for the container - VERY LENIENT
  const touchStartRef = useRef({ y: 0, x: 0, time: 0 });

  const handleTouchStart = (e) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      x: e.touches[0].clientX,
      time: Date.now()
    };
  };

  const handleTouchMove = (e) => {
    // Check for swipe during move for immediate response
    const deltaY = touchStartRef.current.y - e.touches[0].clientY;
    // If swiping up more than 50px, navigate immediately
    if (deltaY > 50) {
      e.preventDefault();
      if (onContinue) onContinue();
    }
  };

  const handleTouchEnd = (e) => {
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartRef.current.x - e.changedTouches[0].clientX);
    const deltaTime = Date.now() - touchStartRef.current.time;

    // SUPER LENIENT: Any upward movement of 15px+ within 2 seconds
    // OR any tap (deltaY and deltaX both small)
    const isSwipeUp = deltaY > 15 && deltaTime < 2000;
    const isTap = Math.abs(deltaY) < 10 && deltaX < 10 && deltaTime < 500;
    
    if (isSwipeUp || isTap) {
      e.preventDefault();
      if (onContinue) onContinue();
    }
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
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
          z-index: 1000;
          overflow: hidden;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Subtle geometric pattern overlay */
        .first-page-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }

        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 1;
          gap: 24px;
        }

        .greeting-section {
          text-align: center;
          animation: fadeInDown 0.8s ease-out;
          padding-top: 40px;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .greeting-hi {
          font-size: 42px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #0f172a;
          margin-bottom: 12px;
          line-height: 1.1;
        }

        .greeting-sub {
          font-size: 24px;
          font-weight: 500;
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: #475569;
          max-width: 340px;
          margin: 0 auto;
          margin-top: 8px;
        }

        .greeting-sub::first-letter {
          text-transform: uppercase;
        }

        .globe-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          max-height: 55vh;
          position: relative;
          animation: fadeIn 1s ease-out 0.3s both;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .globe-container {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 380px;
          max-height: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
          pointer-events: none;
        }

        .globe-container :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }

        .globe-container :global(.globe-ocean) {
          transition: fill 0.3s ease;
        }

        .globe-container :global(.country) {
          fill: #c9cdd3;
          stroke: #e8eaed;
          stroke-width: 0.5;
          transition: fill 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .globe-container :global(.country.highlighted) {
          stroke: #e8eaed;
          stroke-width: 0.6;
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 30px 0;
            overflow: hidden;
          }
          .greeting-section {
            padding-top: 80px;
            padding-left: 24px;
            padding-right: 24px;
          }
          .greeting-hi {
            font-size: 36px;
            margin-bottom: 10px;
          }
          .greeting-sub {
            font-size: 20px;
            max-width: 300px;
            line-height: 1.35;
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
            width: 180vw;
            height: 180vw;
            margin-top: 5vh;
            touch-action: none;
            pointer-events: none;
          }
        }

        @media (max-width: 375px) {
          .greeting-hi {
            font-size: 32px;
          }
          .greeting-sub {
            font-size: 18px;
            max-width: 260px;
          }
        }
      `}</style>

      <div 
        className="first-page-container" 
        onClick={handleContinue}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="content-wrapper">
          <div className="greeting-section">
            <div className="greeting-hi">{personalGreeting.hi}</div>
            <div className="greeting-sub">{personalGreeting.sub}</div>
          </div>

          <div className="globe-section">
            <div className="globe-container" ref={mapContainerRef}></div>
          </div>
        </div>
      </div>
    </>
  );
}

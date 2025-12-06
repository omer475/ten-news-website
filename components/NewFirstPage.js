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

  // Get last visit info
  const getLastVisitInfo = () => {
    if (typeof window === 'undefined') return { hours: 24, period: 'day' };
    try {
      const lastVisit = localStorage.getItem('tennews_last_visit');
      if (!lastVisit) return { hours: 24, period: 'day' };
      const now = Date.now();
      const lastTime = parseInt(lastVisit);
      const hours = Math.floor((now - lastTime) / (1000 * 60 * 60));
      return { hours: Math.max(1, hours), period: hours <= 1 ? 'hour' : hours <= 6 ? 'few hours' : 'day' };
    } catch {
      return { hours: 24, period: 'day' };
    }
  };

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
    
    const timePeriod = lastVisit.hours <= 1 ? 'in the last hour' :
                       lastVisit.hours <= 3 ? `in the last ${lastVisit.hours} hours` :
                       lastVisit.hours <= 12 ? `in the last ${lastVisit.hours} hours` :
                       'since yesterday';
    
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

  // Color scale for globe
  const getColor = (value) => {
    const colors = [
      { pos: 0, r: 74, g: 222, b: 128 },    // Emerald green
      { pos: 0.4, r: 250, g: 204, b: 21 },  // Yellow
      { pos: 0.7, r: 251, g: 146, b: 60 },  // Orange
      { pos: 1, r: 239, g: 68, b: 68 }      // Red
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

  // Load 3D globe
  useEffect(() => {
    if (!scriptsLoaded.d3 || !scriptsLoaded.topojson) return;
    if (typeof window === 'undefined') return;
    if (!isVisible) return; // Don't load if not visible

    const loadGlobe = async () => {
      try {
        const d3 = window.d3;
        const topojson = window.topojson;
        if (!d3 || !topojson) return;
        
        const container = mapContainerRef.current;
        if (!container) return;
        
        const containerWidth = container.offsetWidth || 350;
        const containerHeight = container.offsetHeight || 350;
        const size = Math.min(containerWidth, containerHeight);
        
        container.innerHTML = '';
        
        const svg = d3.select(container)
          .append('svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `0 0 ${size} ${size}`)
          .style('cursor', 'grab');
        
        const projection = d3.geoOrthographic()
          .scale(size / 2.2)
          .center([0, 0])
          .translate([size / 2, size / 2]);
        
        projectionRef.current = projection;
        const path = d3.geoPath().projection(projection);
        pathRef.current = path;
        
        // Outer glow
        const defs = svg.append('defs');
        const filter = defs.append('filter').attr('id', 'glow');
        filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        // Globe sphere with gradient
        // Smoother gradient for globe
        const gradient = defs.append('radialGradient')
          .attr('id', 'globe-gradient')
          .attr('cx', '35%').attr('cy', '35%');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(129, 140, 248, 0.08)');
        gradient.append('stop').attr('offset', '40%').attr('stop-color', 'rgba(99, 102, 241, 0.05)');
        gradient.append('stop').attr('offset', '70%').attr('stop-color', 'rgba(55, 65, 81, 0.15)');
        gradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(30, 41, 59, 0.25)');
        
        // Softer glow filter
        const glowFilter = defs.append('filter')
          .attr('id', 'softGlow')
          .attr('x', '-50%').attr('y', '-50%')
          .attr('width', '200%').attr('height', '200%');
        glowFilter.append('feGaussianBlur')
          .attr('in', 'SourceGraphic')
          .attr('stdDeviation', '2')
          .attr('result', 'blur');
        const glowMerge = glowFilter.append('feMerge');
        glowMerge.append('feMergeNode').attr('in', 'blur');
        glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        svg.append('circle')
          .attr('cx', size / 2)
          .attr('cy', size / 2)
          .attr('r', size / 2.2)
          .attr('class', 'globe-sphere')
          .style('fill', 'url(#globe-gradient)')
          .style('filter', 'url(#softGlow)');
        
        const globe = svg.append('g').attr('class', 'globe-countries');
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
        
        // Globe auto-rotates only - no user interaction
        // User can tap or swipe up to navigate (handled by container)
        svg.style('pointer-events', 'none'); // Disable all mouse/touch on globe
        
        // Auto rotation
        let animationId;
        let isActive = true;
        const rotate = () => {
          if (!isActive) return;
          if (isRotatingRef.current && !isDraggingRef.current) {
            rotationRef.current.x += 0.12;
            projection.rotate([rotationRef.current.x, rotationRef.current.y]);
            globe.selectAll('path').attr('d', path);
          }
          animationId = requestAnimationFrame(rotate);
        };
        rotate();
        
        setMapLoaded(true);
        
        // Return cleanup function
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

  // Color globe countries
  useEffect(() => {
    if (!mapLoaded || Object.keys(newsCountByCountry).length === 0 || !globeRef.current) return;
    
    const d3 = window.d3;
    if (!d3) return;
    
    const counts = Object.values(newsCountByCountry);
    const maxCount = Math.max(...counts, 1);
    
    globeRef.current.selectAll('.country').each(function() {
      const el = d3.select(this);
      const countryId = parseInt(el.attr('data-id'));
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        if (countryNameToId[name.toLowerCase().trim()] === countryId) {
          el.style('fill', getColor(count / maxCount));
          break;
        }
      }
    });
  }, [mapLoaded, newsCountByCountry]);

  const handleContinue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContinue) onContinue();
  };

  // Touch swipe detection for the container
  const touchStartRef = useRef({ y: 0, x: 0, time: 0 });
  
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      x: e.touches[0].clientX,
      time: Date.now()
    };
  };
  
  const handleTouchMove = (e) => {
    // Allow default behavior for vertical scrolling
  };
  
  const handleTouchEnd = (e) => {
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartRef.current.x - e.changedTouches[0].clientX);
    const deltaTime = Date.now() - touchStartRef.current.time;
    
    // If swiped up (deltaY > 0 means finger moved up), navigate to next
    // Very lenient: 30px up, within 1 second
    if (deltaY > 30 && deltaTime < 1000) {
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
          background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          z-index: 1000;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        }

        /* Animated background stars */
        .first-page-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(2px 2px at 40% 70%, rgba(255,255,255,0.1) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(2px 2px at 60% 80%, rgba(255,255,255,0.1) 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.12) 0%, transparent 100%);
          pointer-events: none;
          animation: twinkle 4s ease-in-out infinite;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
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
          gap: 20px;
        }

        .greeting-section {
          text-align: center;
          animation: fadeInDown 0.8s ease-out;
          padding-top: 60px;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .greeting-hi {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.25em;
          color: rgba(129, 140, 248, 0.9);
          margin-bottom: 20px;
          text-transform: uppercase;
        }

        .greeting-sub {
          font-size: 36px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.03em;
          color: #ffffff;
          max-width: 440px;
          margin: 0 auto;
          text-shadow: 0 4px 30px rgba(0,0,0,0.4);
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

        .globe-glow {
          position: absolute;
          width: 140%;
          height: 140%;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(99, 102, 241, 0.12) 0%,
            rgba(99, 102, 241, 0.08) 20%,
            rgba(139, 92, 246, 0.05) 40%,
            rgba(139, 92, 246, 0.02) 60%,
            transparent 80%
          );
          border-radius: 50%;
          pointer-events: none;
          animation: smoothPulse 6s ease-in-out infinite;
          filter: blur(20px);
        }

        @keyframes smoothPulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.7;
          }
          50% { 
            transform: scale(1.03); 
            opacity: 1;
          }
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
          touch-action: pan-y;
        }

        .globe-container :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }

        .globe-container :global(.globe-sphere) {
          stroke: rgba(148, 163, 184, 0.15);
          stroke-width: 0.5;
        }

        .globe-container :global(.country) {
          fill: rgba(100, 116, 139, 0.5);
          stroke: rgba(148, 163, 184, 0.1);
          stroke-width: 0.25;
          transition: fill 0.5s ease-out;
        }

        @media (max-width: 480px) {
          .content-wrapper {
            padding: 30px 0;
            overflow: hidden;
          }
          .greeting-section {
            padding-top: 100px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .greeting-sub {
            font-size: 28px;
            max-width: 320px;
          }
          .greeting-hi {
            font-size: 11px;
          }
          .globe-section {
            overflow: hidden;
            width: 100vw;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .globe-glow {
            display: none;
          }
          .globe-container {
            max-width: none;
            max-height: none;
            width: 180vw;
            height: 180vw;
            margin-top: 5vh;
            touch-action: pan-y;
          }
        }

        @media (max-width: 375px) {
          .greeting-sub {
            font-size: 24px;
            max-width: 280px;
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
            <div className="globe-glow"></div>
            <div className="globe-container" ref={mapContainerRef}></div>
          </div>
        </div>
      </div>
    </>
  );
}

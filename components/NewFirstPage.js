import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';

export default function NewFirstPage({ onContinue, user, userProfile, stories: initialStories, readTracker }) {
  // Calculate time window immediately (before any localStorage updates)
  const getInitialTimeWindow = () => {
    if (typeof window === 'undefined') return 24;
    try {
      const lastVisit = localStorage.getItem('tennews_last_visit');
      if (!lastVisit) return 24; // First time user
      
      const now = Date.now();
      const lastTime = parseInt(lastVisit);
      const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
      
      // Round up to nearest hour, with minimum of 1 hour and max of 24 hours
      return Math.min(24, Math.max(1, Math.ceil(hoursDiff)));
    } catch {
      return 24;
    }
  };

  // Safety check for stories
  const [stories, setStories] = useState(initialStories || []);
  const [lastHourStories, setLastHourStories] = useState([]);
  const mapTimeWindowRef = useRef(getInitialTimeWindow());
  const mapTimeWindow = mapTimeWindowRef.current;

  const mapContainerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState({ d3: false, topojson: false });
  const [newsCountByCountry, setNewsCountByCountry] = useState({});
  
  // Globe rotation state
  const rotationRef = useRef({ x: 0, y: -20 });
  const isRotatingRef = useRef(true);
  const isDraggingRef = useRef(false);
  const projectionRef = useRef(null);
  const pathRef = useRef(null);
  const globeRef = useRef(null);

  // Filter stories based on last visit time window
  const filterStoriesByTimeWindow = useCallback((storiesToFilter) => {
    const cutoffTime = new Date(Date.now() - mapTimeWindow * 60 * 60 * 1000);
    
    console.log('=== MAP DEBUG ===');
    console.log('Time window (hours):', mapTimeWindow);
    console.log('Cutoff time:', cutoffTime.toISOString());
    console.log('Total stories:', storiesToFilter.length);
    
    const filtered = storiesToFilter.filter(story => {
      // Accept both 'news' type and articles without type (from API)
      if (story.type && story.type !== 'news') return false;
      const createdAt = story.created_at ? new Date(story.created_at) : null;
      return createdAt && createdAt >= cutoffTime;
    });
    
    console.log('Filtered stories (within time window):', filtered.length);
    if (storiesToFilter.length > 0) {
      const sample = storiesToFilter[0];
      console.log('Sample story created_at:', sample.created_at);
      console.log('Sample story type:', sample.type);
    }
    console.log('=================');
    
    return filtered;
  }, [mapTimeWindow]);

  // Fetch country counts from dedicated map API
  const fetchCountryCounts = useCallback(async () => {
    try {
      // First try with user's time window
      let response = await fetch(`/api/map-countries?hours=${mapTimeWindow}`);
      if (response.ok) {
        let data = await response.json();
        console.log('Map API response:', data);
        
        // If no data found, fallback to 24 hours
        if (data.totalArticles === 0 && mapTimeWindow < 24) {
          console.log('No articles in time window, falling back to 24 hours');
          response = await fetch(`/api/map-countries?hours=24`);
          if (response.ok) {
            data = await response.json();
            console.log('24h fallback response:', data);
          }
        }
        
        if (data.countryCounts && Object.keys(data.countryCounts).length > 0) {
          setNewsCountByCountry(data.countryCounts);
        }
      }
    } catch (error) {
      console.error('Error fetching country counts:', error);
    }
  }, [mapTimeWindow]);

  // Fetch country counts on mount and set up hourly refresh
  useEffect(() => {
    // Initial fetch
    fetchCountryCounts();

    // Set up hourly refresh
    const refreshInterval = setInterval(() => {
      fetchCountryCounts();
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(refreshInterval);
  }, [fetchCountryCounts]);

  // Update stories when initial stories change
  useEffect(() => {
    if (initialStories && Array.isArray(initialStories)) {
      setStories(initialStories);
    }
  }, [initialStories]);

  // Country name to ISO numeric ID mapping for the map
  const countryNameToId = {
    'afghanistan': 4, 'albania': 8, 'algeria': 12, 'andorra': 20, 'angola': 24,
    'argentina': 32, 'armenia': 51, 'australia': 36, 'austria': 40, 'azerbaijan': 31,
    'bahamas': 44, 'bahrain': 48, 'bangladesh': 50, 'barbados': 52, 'belarus': 112,
    'belgium': 56, 'belize': 84, 'benin': 204, 'bhutan': 64, 'bolivia': 68,
    'bosnia': 70, 'bosnia and herzegovina': 70, 'botswana': 72, 'brazil': 76,
    'brunei': 96, 'bulgaria': 100, 'burkina faso': 854, 'burundi': 108,
    'cambodia': 116, 'cameroon': 120, 'canada': 124, 'central african republic': 140,
    'chad': 148, 'chile': 152, 'china': 156, 'colombia': 170, 'comoros': 174,
    'congo': 178, 'dr congo': 180, 'democratic republic of congo': 180,
    'costa rica': 188, 'croatia': 191, 'cuba': 192, 'cyprus': 196, 'czechia': 203,
    'czech republic': 203, 'denmark': 208, 'djibouti': 262, 'dominican republic': 214,
    'ecuador': 218, 'egypt': 818, 'el salvador': 222, 'equatorial guinea': 226,
    'eritrea': 232, 'estonia': 233, 'eswatini': 748, 'ethiopia': 231, 'fiji': 242,
    'finland': 246, 'france': 250, 'gabon': 266, 'gambia': 270, 'georgia': 268,
    'germany': 276, 'ghana': 288, 'greece': 300, 'grenada': 308, 'guatemala': 320,
    'guinea': 324, 'guinea-bissau': 624, 'guyana': 328, 'haiti': 332, 'honduras': 340,
    'hungary': 348, 'iceland': 352, 'india': 356, 'indonesia': 360, 'iran': 364,
    'iraq': 368, 'ireland': 372, 'israel': 376, 'italy': 380, 'ivory coast': 384,
    'jamaica': 388, 'japan': 392, 'jordan': 400, 'kazakhstan': 398, 'kenya': 404,
    'north korea': 408, 'south korea': 410, 'korea': 410, 'kuwait': 414,
    'kyrgyzstan': 417, 'laos': 418, 'latvia': 428, 'lebanon': 422, 'lesotho': 426,
    'liberia': 430, 'libya': 434, 'liechtenstein': 438, 'lithuania': 440,
    'luxembourg': 442, 'madagascar': 450, 'malawi': 454, 'malaysia': 458,
    'maldives': 462, 'mali': 466, 'malta': 470, 'mauritania': 478, 'mauritius': 480,
    'mexico': 484, 'moldova': 498, 'monaco': 492, 'mongolia': 496, 'montenegro': 499,
    'morocco': 504, 'mozambique': 508, 'myanmar': 104, 'burma': 104, 'namibia': 516,
    'nepal': 524, 'netherlands': 528, 'new zealand': 554, 'nicaragua': 558,
    'niger': 562, 'nigeria': 566, 'north macedonia': 807, 'macedonia': 807,
    'norway': 578, 'oman': 512, 'pakistan': 586, 'panama': 591,
    'papua new guinea': 598, 'paraguay': 600, 'peru': 604, 'philippines': 608,
    'poland': 616, 'portugal': 620, 'qatar': 634, 'romania': 642, 'russia': 643,
    'russian federation': 643, 'rwanda': 646, 'saudi arabia': 682, 'senegal': 686,
    'serbia': 688, 'sierra leone': 694, 'singapore': 702, 'slovakia': 703,
    'slovenia': 705, 'solomon islands': 90, 'somalia': 706, 'south africa': 710,
    'south sudan': 728, 'spain': 724, 'sri lanka': 144, 'sudan': 729,
    'suriname': 740, 'sweden': 752, 'switzerland': 756, 'syria': 760,
    'taiwan': 158, 'tajikistan': 762, 'tanzania': 834, 'thailand': 764,
    'timor-leste': 626, 'togo': 768, 'tonga': 776, 'trinidad and tobago': 780,
    'tunisia': 788, 'turkey': 792, 'turkmenistan': 795, 'uganda': 800,
    'ukraine': 804, 'united arab emirates': 784, 'uae': 784, 'united kingdom': 826,
    'uk': 826, 'britain': 826, 'great britain': 826, 'england': 826, 'scotland': 826,
    'wales': 826, 'northern ireland': 826,
    'united states': 840, 'usa': 840, 'us': 840, 'u.s.': 840, 'u.s': 840,
    'america': 840, 'american': 840, 'uruguay': 858, 'uzbekistan': 860, 'vanuatu': 548,
    'vatican': 336, 'venezuela': 862, 'vietnam': 704, 'yemen': 887,
    'zambia': 894, 'zimbabwe': 716, 'palestine': 275, 'palestinian': 275, 'gaza': 275,
    'west bank': 275, 'european union': 0, 'eu': 0
  };

  // Country aliases and common references
  const countryAliases = {
    'chinese': 'china',
    'russian': 'russia',
    'ukrainian': 'ukraine',
    'american': 'united states',
    'british': 'united kingdom',
    'french': 'france',
    'german': 'germany',
    'italian': 'italy',
    'spanish': 'spain',
    'japanese': 'japan',
    'korean': 'south korea',
    'indian': 'india',
    'brazilian': 'brazil',
    'australian': 'australia',
    'canadian': 'canada',
    'mexican': 'mexico',
    'israeli': 'israel',
    'iranian': 'iran',
    'iraqi': 'iraq',
    'syrian': 'syria',
    'turkish': 'turkey',
    'saudi': 'saudi arabia',
    'egyptian': 'egypt',
    'south african': 'south africa',
    'nigerian': 'nigeria',
    'pakistani': 'pakistan',
    'afghan': 'afghanistan',
    'polish': 'poland',
    'dutch': 'netherlands',
    'belgian': 'belgium',
    'swiss': 'switzerland',
    'austrian': 'austria',
    'greek': 'greece',
    'swedish': 'sweden',
    'norwegian': 'norway',
    'danish': 'denmark',
    'finnish': 'finland',
    'portuguese': 'portugal',
    'indonesian': 'indonesia',
    'vietnamese': 'vietnam',
    'thai': 'thailand',
    'philippine': 'philippines',
    'filipino': 'philippines',
    'taiwanese': 'taiwan',
    'singaporean': 'singapore',
    'malaysian': 'malaysia',
    'argentinian': 'argentina',
    'colombian': 'colombia',
    'venezuelan': 'venezuela',
    'peruvian': 'peru',
    'chilean': 'chile'
  };

  // Extract country mentions from article text
  const extractCountriesFromText = (text) => {
    if (!text) return [];
    const normalizedText = text.toLowerCase();
    const foundCountries = new Set();

    // Check for country names
    Object.keys(countryNameToId).forEach(country => {
      // Create word boundary regex for more accurate matching
      const regex = new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedText)) {
        foundCountries.add(country);
      }
    });

    // Check for country aliases/adjectives
    Object.entries(countryAliases).forEach(([alias, country]) => {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalizedText)) {
        foundCountries.add(country);
      }
    });

    return Array.from(foundCountries);
  };

  // Count news by country from last hour stories only
  const countNewsByCountry = useCallback(() => {
    const counts = {};
    
    lastHourStories.forEach(story => {
      // Combine title and description for country extraction
      const textToSearch = [
        story.title,
        story.title_news,
        story.description,
        story.category
      ].filter(Boolean).join(' ');

      const countries = extractCountriesFromText(textToSearch);
      
      countries.forEach(country => {
        // Normalize country name for display
        const displayName = country.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        counts[displayName] = (counts[displayName] || 0) + 1;
      });
    });

    return counts;
  }, [lastHourStories]);

  // Calculate total news count
  const getTotalNewsCount = () => {
    return stories.filter(story => story.type === 'news').length;
  };

  const getFirstName = () => {
    if (!user) return null;
    
    if (userProfile?.full_name) {
      return userProfile.full_name.split(' ')[0];
    }
    
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'there';
  };

  const totalNewsCount = getTotalNewsCount();
  const firstName = getFirstName();

  // Calculate last visit text
  const getLastVisitText = () => {
    // For now, use a static value - you can integrate with actual last visit tracking
    return '2h ago';
  };

  // Get time of day for contextual greetings
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  // Get and update last visit time
  const getLastVisitInfo = () => {
    if (typeof window === 'undefined') return { hours: 2, period: 'the last 2 hours' };
    
    try {
      const lastVisit = localStorage.getItem('tennews_last_visit');
      const now = Date.now();
      
      // Update last visit time
      localStorage.setItem('tennews_last_visit', now.toString());
      
      if (!lastVisit) return { hours: 24, period: 'yesterday' };
      
      const lastTime = parseInt(lastVisit);
      const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
      const lastHour = new Date(lastTime).getHours();
      const currentHour = new Date().getHours();
      
      // Determine the period description - minutes for < 1 hour, then specific hours
      let period = '';
      const minutesDiff = hoursDiff * 60;
      
      if (minutesDiff < 20) {
        period = 'the last 15 minutes';
      } else if (minutesDiff < 40) {
        period = 'the last 30 minutes';
      } else if (minutesDiff < 55) {
        period = 'the last 45 minutes';
      } else if (hoursDiff < 1.25) {
        period = 'the last hour';
      } else if (hoursDiff < 2) {
        period = 'the last 2 hours';
      } else if (hoursDiff < 3) {
        period = 'the last 3 hours';
      } else if (hoursDiff < 4) {
        period = 'the last 4 hours';
      } else if (hoursDiff < 5) {
        period = 'the last 5 hours';
      } else if (hoursDiff < 6) {
        period = 'the last 6 hours';
      } else if (hoursDiff < 7) {
        period = 'the last 7 hours';
      } else if (hoursDiff < 8) {
        period = 'the last 8 hours';
      } else if (hoursDiff < 9) {
        period = 'the last 9 hours';
      } else if (hoursDiff < 10) {
        period = 'the last 10 hours';
      } else if (hoursDiff < 11) {
        period = 'the last 11 hours';
      } else if (hoursDiff < 12) {
        period = 'the last 12 hours';
      } else if (hoursDiff < 18) {
        // Check time of day for context
        if (currentHour >= 12 && lastHour >= 5 && lastHour < 12) {
          period = 'this morning';
        } else if (currentHour >= 17 && lastHour >= 12 && lastHour < 17) {
          period = 'this afternoon';
        } else if (lastHour >= 21 || lastHour < 5) {
          period = 'last night';
        } else {
          period = 'earlier today';
        }
      } else if (hoursDiff < 24) {
        if (lastHour >= 21 || lastHour < 5) {
          period = 'last night';
        } else if (lastHour >= 5 && lastHour < 12) {
          period = 'this morning';
        } else if (lastHour >= 12 && lastHour < 17) {
          period = 'this afternoon';
        } else {
          period = 'this evening';
        }
      } else if (hoursDiff < 36) {
        if (lastHour >= 21 || lastHour < 5) {
          period = 'last night';
        } else if (lastHour >= 5 && lastHour < 12) {
          period = 'yesterday morning';
        } else if (lastHour >= 12 && lastHour < 17) {
          period = 'yesterday afternoon';
        } else {
          period = 'yesterday evening';
        }
      } else if (hoursDiff < 48) {
        period = 'yesterday';
      } else if (hoursDiff < 72) {
        period = '2 days ago';
    } else {
        period = 'a few days ago';
      }
      
      return { hours: hoursDiff, period };
    } catch (e) {
      return { hours: 2, period: 'the last 2 hours' };
    }
  };

  // Analyze stories by score and category
  const analyzeStories = () => {
    const newsStories = stories.filter(s => s.type === 'news');
    
    // Find high-scored articles (score >= 900)
    const highScored = newsStories.filter(s => s.final_score >= 900);
    const veryHighScored = newsStories.filter(s => s.final_score >= 950);
    const breakingNews = newsStories.filter(s => s.final_score >= 980);
    
    // Get top categories from high-scored articles
    const categoryCount = {};
    highScored.forEach(s => {
      const cat = s.category?.toLowerCase() || 'general';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    
    // Sort categories by count
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);
    
    // Get the highest scored article
    const topArticle = newsStories.reduce((max, s) => 
      (s.final_score || 0) > (max?.final_score || 0) ? s : max, null);
    
    return {
      hasBreaking: breakingNews.length > 0,
      hasVeryHigh: veryHighScored.length > 0,
      highScoredCount: highScored.length,
      topCategories,
      topArticle,
      topScore: topArticle?.final_score || 0,
      totalCount: newsStories.length
    };
  };

  // Category display names
  const categoryLabels = {
    'politics': 'politics',
    'world': 'international news',
    'business': 'business',
    'technology': 'technology',
    'science': 'science',
    'health': 'health',
    'sports': 'sports',
    'entertainment': 'entertainment',
    'finance': 'the markets',
    'economy': 'the economy',
    'conflict': 'global conflicts',
    'war': 'conflict zones',
    'climate': 'climate',
    'general': 'current events'
  };

  // Personalized greeting generator based on scores and time since last visit
  const getPersonalizedGreeting = () => {
    const time = getTimeOfDay();
    const name = firstName ? ` ${firstName}` : '';
    const analysis = analyzeStories();
    const lastVisit = getLastVisitInfo();
    const period = lastVisit.period;
    
    // Get time description for the message
    const getTimeDescription = () => {
      const hours = lastVisit.hours;
      if (hours < 1) return 'in the last hour';
      if (hours === 1) return 'in the last hour';
      if (hours <= 3) return `in the last ${hours} hours`;
      if (hours <= 6) return `in the last ${hours} hours`;
      if (hours <= 12) return `in the last ${hours} hours`;
      if (hours <= 24) return 'since yesterday';
      return 'recently';
    };
    const timePeriod = getTimeDescription();
    
    // Simple greetings with name
    const hiGreetings = {
      morning: [`Good morning${name}`],
      afternoon: [`Good afternoon${name}`],
      evening: [`Good evening${name}`],
      night: [`Good evening${name}`]
    };

    // Get category labels
    const topCat = analysis.topCategories[0];
    const cat2 = analysis.topCategories[1];
    const catLabel = categoryLabels[topCat] || topCat || 'current events';
    const catLabel2 = cat2 ? (categoryLabels[cat2] || cat2) : null;
    const capCat = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    
    // 50+ natural, meaningful message variations for each scenario (with time reference)
    let subOptions = [];
    
    if (analysis.hasBreaking) {
      // BREAKING NEWS - urgent, important (with time reference)
      subOptions = [
        `${timePeriod}, breaking news in ${catLabel}`,
        `Major ${catLabel} developments ${timePeriod}`,
        `${capCat} breaking ${timePeriod}`,
        `Important ${catLabel} news ${timePeriod}`,
        `${timePeriod}, major ${catLabel} story`,
        `Breaking: ${catLabel} update ${timePeriod}`,
        `Critical ${catLabel} developments ${timePeriod}`,
        `${timePeriod}, big ${catLabel} news`,
        `Urgent ${catLabel} updates ${timePeriod}`,
        `${capCat} made headlines ${timePeriod}`,
        `Major ${catLabel} story developing`,
        `Important ${catLabel} news just broke`,
        `Big story unfolding in ${catLabel}`,
        `${capCat} news you need to see`,
        `Something big happened in ${catLabel}`,
        `Major developments in ${catLabel}`,
        `${capCat} is making headlines`,
        `Significant ${catLabel} news today`,
        `A major ${catLabel} story broke`,
        `${capCat} breaking right now`,
        `Big ${catLabel} news just dropped`,
        `${capCat} story everyone's talking about`,
        `Major ${catLabel} update just in`,
        `${capCat} news demands attention`,
        `Something significant in ${catLabel}`,
        `${capCat} just made news`,
        `Important ${catLabel} story breaking`,
        `${capCat} in the headlines`,
        `Big ${catLabel} development`,
        `${capCat} story just broke`,
        `Major news in ${catLabel}`,
        `${capCat} update you should see`,
        `Significant ${catLabel} story`,
        `${capCat} making waves`,
        `Important ${catLabel} just happened`,
        `${capCat} story unfolding now`,
        `Major ${catLabel} breaking`,
        `${capCat} news just came in`,
        `Big ${catLabel} story today`,
        `${capCat} update just dropped`,
        `Important ${catLabel} development`,
        `${capCat} breaking news`,
        `Major ${catLabel} happening now`,
        `${capCat} in breaking news`,
        `Significant ${catLabel} update`,
        `${capCat} story developing`,
        `Big news from ${catLabel}`,
        `${capCat} headline just in`,
        `Major ${catLabel} news alert`,
        `${capCat} story to watch`,
        `Important ${catLabel} breaking now`,
        `${capCat} development breaking`,
        `Big ${catLabel} headline`,
        `${capCat} news breaking`,
        `Major ${catLabel} story today`,
        `${capCat} just hit the news`,
        `Important ${catLabel} update`,
        `${capCat} story you need to see`,
        `Big ${catLabel} news breaking`,
        `${capCat} making major news`,
        `Significant ${catLabel} breaking`,
      ];
    } else if (analysis.hasVeryHigh) {
      // IMPORTANT NEWS - with time reference
      subOptions = [
        `${timePeriod}, a lot happened in ${catLabel}`,
        `Big ${catLabel} developments ${timePeriod}`,
        `${capCat} had a busy one ${timePeriod}`,
        `Important ${catLabel} news ${timePeriod}`,
        `Plenty happened in ${catLabel} ${timePeriod}`,
        `${capCat} dominated news ${timePeriod}`,
        `Major ${catLabel} updates ${timePeriod}`,
        `${capCat} in the spotlight ${timePeriod}`,
        `Notable ${catLabel} developments ${timePeriod}`,
        `${capCat} has been eventful ${timePeriod}`,
        `${timePeriod}, significant ${catLabel} news`,
        `${capCat} made headlines ${timePeriod}`,
        `Big things in ${catLabel} ${timePeriod}`,
        `${capCat} had major updates ${timePeriod}`,
        `Important ${catLabel} developments ${timePeriod}`,
        `${timePeriod}, ${catLabel} is trending`,
        `Noteworthy ${catLabel} news ${timePeriod}`,
        `${capCat} had a big day ${timePeriod}`,
        `Significant ${catLabel} ${timePeriod}`,
        `${capCat} making moves ${timePeriod}`,
        `Big ${catLabel} day ${timePeriod}`,
        `${capCat} had key updates ${timePeriod}`,
        `${timePeriod}, ${catLabel} made waves`,
        `Major ${catLabel} stories ${timePeriod}`,
        `${capCat} developments ${timePeriod}`,
        `${timePeriod}, important ${catLabel}`,
        `${catLabel} news worth seeing ${timePeriod}`,
        `${capCat} made noise ${timePeriod}`,
        `Notable ${catLabel} today`,
        `${capCat} worth your time`,
        `Important ${catLabel} stories`,
        `${capCat} had developments`,
        `Significant ${catLabel} stories`,
        `${capCat} news to know`,
        `Big ${catLabel} updates`,
        `${capCat} in focus today`,
        `Important ${catLabel} to read`,
        `${capCat} made headlines`,
        `Notable ${catLabel} news`,
        `${capCat} had a day`,
        `Significant things in ${catLabel}`,
        `${capCat} developments today`,
        `Important ${catLabel} updates`,
        `${capCat} in the news`,
        `Big ${catLabel} news today`,
        `${capCat} updates to see`,
        `Notable ${catLabel} updates`,
        `${capCat} had important news`,
        `Significant ${catLabel} developments`,
        `${capCat} news today`,
        catLabel2 ? `${capCat} and ${catLabel2} in the spotlight` : `${capCat} leading today`,
        catLabel2 ? `Developments in ${catLabel} and ${catLabel2}` : `${capCat} developments today`,
      ];
    } else if (analysis.highScoredCount >= 5) {
      // BUSY DAY - with time reference
      subOptions = [
        `${timePeriod}, busy day for ${catLabel}`,
        `A lot to catch up on ${timePeriod}`,
        `${capCat} has been active ${timePeriod}`,
        `Plenty of ${catLabel} news ${timePeriod}`,
        `${capCat} kept things interesting ${timePeriod}`,
        `Several ${catLabel} stories ${timePeriod}`,
        `${capCat} had a full day ${timePeriod}`,
        `Lots happening in ${catLabel} ${timePeriod}`,
        `${capCat} was busy ${timePeriod}`,
        `Active day for ${catLabel} ${timePeriod}`,
        `${capCat} had plenty going on ${timePeriod}`,
        `Busy ${catLabel} day ${timePeriod}`,
        `${timePeriod}, multiple ${catLabel} stories`,
        `${capCat} filled with news ${timePeriod}`,
        `${timePeriod}, lots of ${catLabel} updates`,
        `${capCat} had many stories ${timePeriod}`,
        `${timePeriod}, busy time in ${catLabel}`,
        `Plenty in ${catLabel} ${timePeriod}`,
        `${capCat} packed with news ${timePeriod}`,
        `${timePeriod}, ${catLabel} very active`,
        `A lot in ${catLabel} ${timePeriod}`,
        `${capCat} had lots ${timePeriod}`,
        `Many ${catLabel} stories ${timePeriod}`,
        `${timePeriod}, lots to see in ${catLabel}`,
        `${capCat} full of stories ${timePeriod}`,
        `A busy ${catLabel} roundup ${timePeriod}`,
        `${capCat} had a lot ${timePeriod}`,
        `Plenty to read ${timePeriod}`,
        `${capCat} stacked with news ${timePeriod}`,
        `${timePeriod}, many ${catLabel} updates`,
        `A lot happened ${timePeriod}`,
        `${capCat} news stacked up ${timePeriod}`,
        `Several ${catLabel} updates ${timePeriod}`,
        `${timePeriod}, ${catLabel} with lots of news`,
        `${capCat} had several stories ${timePeriod}`,
        `Lots of ${catLabel} news ${timePeriod}`,
        `${timePeriod}, multiple things in ${catLabel}`,
        `${capCat} had a busy one ${timePeriod}`,
        `Plenty of ${catLabel} updates`,
        `${capCat} with many stories`,
        `A lot of ${catLabel} news`,
        catLabel2 ? `${capCat} and ${catLabel2} were busy` : `${capCat} stayed busy`,
        catLabel2 ? `Active day for ${catLabel} and ${catLabel2}` : `Active ${catLabel} day`,
      ];
    } else if (analysis.highScoredCount >= 1) {
      // SOME STORIES - with time reference
      subOptions = [
        `${timePeriod}, some ${catLabel} worth reading`,
        `A few interesting ${catLabel} stories ${timePeriod}`,
        `${capCat} has some updates ${timePeriod}`,
        `Some notable ${catLabel} news ${timePeriod}`,
        `A few ${catLabel} stories ${timePeriod}`,
        `${capCat} had a few highlights ${timePeriod}`,
        `Some ${catLabel} to catch up on ${timePeriod}`,
        `${timePeriod}, a couple of ${catLabel} stories`,
        `${capCat} worth a look ${timePeriod}`,
        `Some ${catLabel} developments ${timePeriod}`,
        `${capCat} has updates ${timePeriod}`,
        `A few ${catLabel} updates ${timePeriod}`,
        `${timePeriod}, some ${catLabel} news`,
        `${capCat} had some news ${timePeriod}`,
        `A few things in ${catLabel} ${timePeriod}`,
        `${timePeriod}, some ${catLabel} stories`,
        `${capCat} with updates ${timePeriod}`,
        `A few ${catLabel} highlights ${timePeriod}`,
        `Some ${catLabel} to read ${timePeriod}`,
        `${capCat} had a few ${timePeriod}`,
        `Notable ${catLabel} stories ${timePeriod}`,
        `${timePeriod}, a few ${catLabel} to see`,
        `Some things in ${catLabel} ${timePeriod}`,
        `${capCat} news to check ${timePeriod}`,
        `A few ${catLabel} news ${timePeriod}`,
        `${timePeriod}, some ${catLabel} updates`,
        `${capCat} stories to read ${timePeriod}`,
        `A couple things ${timePeriod}`,
        `Some ${catLabel} highlights ${timePeriod}`,
        `${capCat} had updates ${timePeriod}`,
      ];
    } else {
      // REGULAR DAY - with time reference
      subOptions = [
        `Here's what's happening ${timePeriod}`,
        `Your news update from ${timePeriod}`,
        `Here's the latest ${timePeriod}`,
        `Catch up on what happened ${timePeriod}`,
        `Here's your briefing ${timePeriod}`,
        `The latest news ${timePeriod}`,
        `Your news roundup ${timePeriod}`,
        `Here's what you missed ${timePeriod}`,
        `Time to catch up ${timePeriod}`,
        `${timePeriod}, here's the update`,
        `Here's today's news ${timePeriod}`,
        `The news awaits ${timePeriod}`,
        `Your update is ready ${timePeriod}`,
        `Here's what's new ${timePeriod}`,
        `Catch up on the news ${timePeriod}`,
        `Your briefing ${timePeriod}`,
        `Here's your update ${timePeriod}`,
        `The latest awaits ${timePeriod}`,
        `News update ${timePeriod}`,
        `Here's the roundup ${timePeriod}`,
        `Time for your update ${timePeriod}`,
        `The news ${timePeriod}`,
        `Here's what happened ${timePeriod}`,
        `Your news is ready ${timePeriod}`,
        `Catch up time ${timePeriod}`,
        `Here's your news ${timePeriod}`,
        `The update is ready ${timePeriod}`,
        `News roundup ${timePeriod}`,
        `Here's today's update ${timePeriod}`,
        `Your daily news ${timePeriod}`,
        `The briefing awaits ${timePeriod}`,
        `Here's the news ${timePeriod}`,
        `Time for news ${timePeriod}`,
        `Your roundup is ready ${timePeriod}`,
        `Here's what's going on ${timePeriod}`,
        `The latest news ${timePeriod}`,
        `News update for you ${timePeriod}`,
        `Here's today's briefing ${timePeriod}`,
      ];
    }

    const randomHi = hiGreetings[time][Math.floor(Math.random() * hiGreetings[time].length)];
    const randomSub = subOptions[Math.floor(Math.random() * subOptions.length)];

    return { hi: randomHi, sub: randomSub };
  };

  // Generate greeting once per render
  const [personalGreeting] = useState(() => getPersonalizedGreeting());

  // Get color based on intensity (0-1)
  const getColor = (value) => {
    const colors = [
      { pos: 0, r: 102, g: 194, b: 114 },      // Green
      { pos: 0.33, r: 234, g: 190, b: 85 },    // Yellow
      { pos: 0.66, r: 232, g: 120, b: 85 },    // Orange
      { pos: 1, r: 192, g: 57, b: 57 }         // Red
    ];
    
    let lower = colors[0];
    let upper = colors[colors.length - 1];
    
    for (let i = 0; i < colors.length - 1; i++) {
      if (value >= colors[i].pos && value <= colors[i + 1].pos) {
        lower = colors[i];
        upper = colors[i + 1];
        break;
      }
    }
    
    const range = upper.pos - lower.pos;
    const factor = range === 0 ? 0 : (value - lower.pos) / range;
    
    const r = Math.round(lower.r + (upper.r - lower.r) * factor);
    const g = Math.round(lower.g + (upper.g - lower.g) * factor);
    const b = Math.round(lower.b + (upper.b - lower.b) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Load the 3D globe when scripts are ready
  useEffect(() => {
    console.log('Globe useEffect triggered:', { 
      d3: scriptsLoaded.d3, 
      topojson: scriptsLoaded.topojson, 
      countriesCount: Object.keys(newsCountByCountry).length 
    });
    
    if (!scriptsLoaded.d3 || !scriptsLoaded.topojson) {
      console.log('Scripts not ready, waiting...');
      return;
    }
    if (typeof window === 'undefined') return;

    const loadGlobe = async () => {
      try {
        const d3 = window.d3;
        const topojson = window.topojson;
        
        if (!d3 || !topojson) {
          console.error('D3 or TopoJSON not loaded');
          return;
        }
        
        const container = mapContainerRef.current;
        if (!container) return;
        
        // Get container dimensions
        const containerWidth = container.offsetWidth || 300;
        const containerHeight = container.offsetHeight || 300;
        const size = Math.min(containerWidth, containerHeight);
        
        // Clear existing SVG
        container.innerHTML = '';
        
        // Create new SVG
        const svg = d3.select(container)
          .append('svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `0 0 ${size} ${size}`)
          .style('cursor', 'grab');
        
        // Create projection
        const projection = d3.geoOrthographic()
          .scale(size / 2.3)
          .center([0, 0])
          .translate([size / 2, size / 2]);
        
        projectionRef.current = projection;
        
        const path = d3.geoPath().projection(projection);
        pathRef.current = path;
        
        // Add sphere outline
        svg.append('circle')
          .attr('cx', size / 2)
          .attr('cy', size / 2)
          .attr('r', size / 2.3)
          .attr('class', 'globe-sphere');
        
        const globe = svg.append('g').attr('class', 'globe-countries');
        globeRef.current = globe;
        
        // Fetch world map data
        const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topo = await res.json();
        const countries = topojson.feature(topo, topo.objects.countries);
        
        // Exclude Greenland and Antarctica
        const exclude = [304, 10];
        const filteredCountries = {
          ...countries,
          features: countries.features.filter(f => !exclude.includes(+f.id))
        };
        
        // Draw countries
        globe.selectAll('path')
          .data(filteredCountries.features)
          .enter()
          .append('path')
          .attr('class', 'country')
          .attr('d', path)
          .attr('data-id', d => d.id);
        
        // Drag to rotate
        const sensitivity = 0.25;
        const drag = d3.drag()
          .on('start', () => {
            isDraggingRef.current = true;
            isRotatingRef.current = false;
            svg.style('cursor', 'grabbing');
          })
          .on('drag', (event) => {
            rotationRef.current.x += event.dx * sensitivity;
            rotationRef.current.y -= event.dy * sensitivity;
            rotationRef.current.y = Math.max(-90, Math.min(90, rotationRef.current.y));
            projection.rotate([rotationRef.current.x, rotationRef.current.y]);
            globe.selectAll('path').attr('d', path);
          })
          .on('end', () => {
            isDraggingRef.current = false;
            svg.style('cursor', 'grab');
            setTimeout(() => { isRotatingRef.current = true; }, 2000);
          });
        
        svg.call(drag);
        
        // Auto rotation
        let animationId;
        const rotate = () => {
          if (isRotatingRef.current && !isDraggingRef.current) {
            rotationRef.current.x += 0.15;
            projection.rotate([rotationRef.current.x, rotationRef.current.y]);
            globe.selectAll('path').attr('d', path);
          }
          animationId = requestAnimationFrame(rotate);
        };
        rotate();
        
        setMapLoaded(true);
        
        // Cleanup
        return () => {
          if (animationId) cancelAnimationFrame(animationId);
        };
      } catch (error) {
        console.error('Error loading globe:', error);
      }
    };

    loadGlobe();
  }, [scriptsLoaded]);

  // Separate useEffect for coloring - runs whenever country data changes
  useEffect(() => {
    if (!mapLoaded) return;
    if (Object.keys(newsCountByCountry).length === 0) return;
    if (!globeRef.current) return;
    
    console.log('=== COLORING GLOBE ===');
    console.log('Countries in data:', Object.keys(newsCountByCountry).length);
    
    const d3 = window.d3;
    if (!d3) return;
    
    const counts = Object.values(newsCountByCountry);
    const maxCount = Math.max(...counts, 1);
    
    let coloredCount = 0;
    
    globeRef.current.selectAll('.country').each(function() {
      const el = d3.select(this);
      const countryId = parseInt(el.attr('data-id'));
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        const normalizedName = name.toLowerCase().trim();
        if (countryNameToId[normalizedName] === countryId) {
          const intensity = count / maxCount;
          el.style('fill', getColor(intensity));
          coloredCount++;
          break;
        }
      }
    });
    
    console.log('Colored:', coloredCount, 'countries');
    console.log('====================');
  }, [mapLoaded, newsCountByCountry]);

  const handleContinue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContinue) {
      onContinue();
    }
  };

  return (
    <>
      {/* Load D3 and TopoJSON */}
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
          background: linear-gradient(180deg, 
            #0a0a0f 0%,
            #0d1117 40%,
            #161b22 100%
          );
          z-index: 1000;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Subtle grid pattern overlay */
        .first-page-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Content wrapper */
        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          z-index: 1;
        }

        /* Greeting Section */
        .greeting-section {
          text-align: center;
          margin-bottom: 8px;
          flex-shrink: 0;
        }

        .greeting-hi {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 12px;
          text-transform: uppercase;
        }

        .greeting-sub {
          font-size: 26px;
          font-weight: 500;
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: rgba(255, 255, 255, 0.85);
          max-width: 400px;
          margin: 0 auto;
        }

        .greeting-sub::first-letter {
          text-transform: uppercase;
        }

        /* Globe Section */
        .globe-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          max-height: 55vh;
          position: relative;
        }

        /* Globe glow effect */
        .globe-glow {
          position: absolute;
          width: 80%;
          height: 80%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
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
        }

        .globe-container :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
          filter: drop-shadow(0 0 40px rgba(99, 102, 241, 0.15));
        }

        .globe-container :global(.globe-sphere) {
          fill: rgba(255, 255, 255, 0.02);
          stroke: rgba(255, 255, 255, 0.08);
          stroke-width: 1;
        }

        .globe-container :global(.country) {
          fill: rgba(255, 255, 255, 0.12);
          stroke: rgba(255, 255, 255, 0.05);
          stroke-width: 0.3;
          transition: fill 0.3s ease;
        }

        /* Tap hint */
        .tap-hint {
          text-align: center;
          padding: 20px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.2);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .greeting-sub {
            font-size: 22px;
            max-width: 340px;
          }
          .greeting-hi {
            font-size: 10px;
          }
          .globe-section {
            max-height: 50vh;
          }
          .globe-container {
            max-width: 320px;
            max-height: 320px;
          }
        }

        @media (max-width: 375px) {
          .greeting-sub {
            font-size: 20px;
            max-width: 300px;
          }
        }

        @media (min-height: 800px) {
          .globe-section {
            max-height: 50vh;
          }
        }
      `}</style>

      <div className="first-page-container" onClick={handleContinue}>
        <div className="content-wrapper">
          <div className="greeting-section">
            <div className="greeting-hi">
              {personalGreeting.hi}
            </div>
            <div className="greeting-sub">{personalGreeting.sub}</div>
          </div>

          <div className="globe-section">
            <div className="globe-glow"></div>
            <div className="globe-container" ref={mapContainerRef}>
              {/* Globe will be rendered here by D3 */}
            </div>
          </div>

          <div className="tap-hint">Scroll down to continue</div>
        </div>
      </div>
    </>
  );
}

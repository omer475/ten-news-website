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
      const response = await fetch(`/api/map-countries?hours=${mapTimeWindow}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Map API response:', data);
        if (data.countryCounts) {
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
    const name = firstName ? `, ${firstName}` : '';
    const analysis = analyzeStories();
    const lastVisit = getLastVisitInfo();
    const period = lastVisit.period;
    
    // Simple greetings
    const hiGreetings = {
      morning: [`Good morning${name}`, `Morning${name}`],
      afternoon: [`Good afternoon${name}`, `Afternoon${name}`],
      evening: [`Good evening${name}`, `Evening${name}`],
      night: [`Good evening${name}`, `Evening${name}`]
    };

    // Get category labels
    const topCat = analysis.topCategories[0];
    const cat2 = analysis.topCategories[1];
    const catLabel = categoryLabels[topCat] || topCat || 'current events';
    const catLabel2 = cat2 ? (categoryLabels[cat2] || cat2) : null;
    const capCat = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
    
    // 50+ natural, meaningful message variations for each scenario
    let subOptions = [];
    
    if (analysis.hasBreaking) {
      // BREAKING NEWS - urgent, important (50+ messages)
      subOptions = [
        `Breaking news in ${catLabel}`,
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
      // IMPORTANT NEWS - notable but not breaking (50+ messages)
      subOptions = [
        `A lot happened in ${catLabel}`,
        `Big developments in ${catLabel}`,
        `${capCat} had a busy day`,
        `Important ${catLabel} news today`,
        `Plenty happening in ${catLabel}`,
        `${capCat} is worth your attention`,
        `Some significant ${catLabel} news`,
        `${capCat} dominated the news`,
        `Major ${catLabel} updates today`,
        `${capCat} in the spotlight`,
        `Notable ${catLabel} developments`,
        `${capCat} has been eventful`,
        `Important things in ${catLabel}`,
        `${capCat} made news today`,
        `Significant ${catLabel} updates`,
        `${capCat} worth following`,
        `Big things in ${catLabel}`,
        `${capCat} had major updates`,
        `Important ${catLabel} developments`,
        `${capCat} is trending`,
        `Noteworthy ${catLabel} news`,
        `${capCat} had a big day`,
        `Significant ${catLabel} today`,
        `${capCat} news worth reading`,
        `Important ${catLabel} happened`,
        `${capCat} making moves`,
        `Big ${catLabel} day`,
        `${capCat} had key updates`,
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
      // BUSY DAY - lots of stories (50+ messages)
      subOptions = [
        `Busy day for ${catLabel}`,
        `A lot to catch up on in ${catLabel}`,
        `${capCat} has been active`,
        `Plenty of ${catLabel} news`,
        `${capCat} kept things interesting`,
        `Several ${catLabel} stories to read`,
        `${capCat} had a full day`,
        `Lots happening in ${catLabel}`,
        `${capCat} was busy`,
        `Active day for ${catLabel}`,
        `${capCat} had plenty going on`,
        `Busy ${catLabel} day`,
        `${capCat} has lots to share`,
        `Multiple ${catLabel} stories`,
        `${capCat} filled with news`,
        `A full ${catLabel} day`,
        `${capCat} kept busy`,
        `Lots of ${catLabel} updates`,
        `${capCat} had many stories`,
        `Busy time in ${catLabel}`,
        `${capCat} has been full`,
        `Plenty in ${catLabel}`,
        `${capCat} packed with news`,
        `Multiple ${catLabel} updates`,
        `${capCat} very active`,
        `A lot in ${catLabel}`,
        `${capCat} had lots`,
        `Many ${catLabel} stories`,
        `${capCat} busy day`,
        `Lots to see in ${catLabel}`,
        `${capCat} full of stories`,
        `A busy ${catLabel} roundup`,
        `${capCat} had a lot`,
        `Plenty to read in ${catLabel}`,
        `${capCat} stacked with news`,
        `Many ${catLabel} updates`,
        `${capCat} had many updates`,
        `A lot happening in ${catLabel}`,
        `${capCat} news stacked up`,
        `Several ${catLabel} updates`,
        `${capCat} with lots of news`,
        `Busy ${catLabel} updates`,
        `${capCat} had several stories`,
        `Lots of ${catLabel} news`,
        `${capCat} filled with updates`,
        `Multiple things in ${catLabel}`,
        `${capCat} had a busy one`,
        `Plenty of ${catLabel} updates`,
        `${capCat} with many stories`,
        `A lot of ${catLabel} news`,
        catLabel2 ? `${capCat} and ${catLabel2} were busy` : `${capCat} stayed busy`,
        catLabel2 ? `Active day for ${catLabel} and ${catLabel2}` : `Active ${catLabel} day`,
      ];
    } else if (analysis.highScoredCount >= 1) {
      // SOME STORIES - lighter day (50+ messages)
      subOptions = [
        `Some ${catLabel} worth reading`,
        `A few interesting ${catLabel} stories`,
        `${capCat} has some updates`,
        `Some notable ${catLabel} news`,
        `A few ${catLabel} stories to check`,
        `${capCat} had a few highlights`,
        `Some ${catLabel} to catch up on`,
        `A couple of ${catLabel} stories`,
        `${capCat} worth a look`,
        `Some ${catLabel} developments`,
        `${capCat} has updates`,
        `A few ${catLabel} updates`,
        `Some ${catLabel} news`,
        `${capCat} had some news`,
        `A few things in ${catLabel}`,
        `Some ${catLabel} stories`,
        `${capCat} with updates`,
        `A few ${catLabel} highlights`,
        `Some ${catLabel} to read`,
        `${capCat} had a few`,
        `Notable ${catLabel} stories`,
        `A few ${catLabel} to see`,
        `Some things in ${catLabel}`,
        `${capCat} news to check`,
        `A few ${catLabel} news`,
        `Some ${catLabel} updates`,
        `${capCat} stories to read`,
        `A couple things in ${catLabel}`,
        `Some ${catLabel} highlights`,
        `${capCat} had updates`,
        `A few notable ${catLabel}`,
        `Some ${catLabel} to see`,
        `${capCat} with some news`,
        `A few ${catLabel} developments`,
        `Some interesting ${catLabel}`,
        `${capCat} with a few stories`,
        `A few ${catLabel} worth reading`,
        `Some ${catLabel} stood out`,
        `${capCat} had a couple`,
        `A few in ${catLabel}`,
        `Some ${catLabel} caught attention`,
        `${capCat} stories worth seeing`,
        `A few ${catLabel} stories today`,
        `Some ${catLabel} news today`,
        `${capCat} updates today`,
        `A few ${catLabel} today`,
        `Some notable ${catLabel}`,
        `${capCat} had noteworthy news`,
        `A few ${catLabel} made news`,
        `Some ${catLabel} worth noting`,
        `${capCat} with highlights`,
        `A few ${catLabel} stories stood out`,
      ];
    } else {
      // REGULAR DAY - general updates (50+ messages)
      subOptions = [
        `Here's what's happening`,
        `Your news update is ready`,
        `Here's the latest`,
        `Catch up on what happened`,
        `Here's your briefing`,
        `The latest news for you`,
        `Your news roundup`,
        `Here's what you missed`,
        `Time to catch up`,
        `Your daily update`,
        `Here's today's news`,
        `The news awaits`,
        `Your update is ready`,
        `Here's what's new`,
        `Catch up on the news`,
        `Your briefing is ready`,
        `Here's your update`,
        `The latest awaits`,
        `News update ready`,
        `Here's the roundup`,
        `Time for your update`,
        `The news for you`,
        `Here's what happened`,
        `Your news is ready`,
        `Catch up time`,
        `Here's your news`,
        `The update is ready`,
        `News roundup ready`,
        `Here's today's update`,
        `Your daily news`,
        `The briefing awaits`,
        `Here's the news`,
        `Time for news`,
        `Your roundup is ready`,
        `Here's what's going on`,
        `The latest news`,
        `News update for you`,
        `Here's today's briefing`,
        `Your news awaits`,
        `Catch up on today`,
        `Here's your daily news`,
        `The news update`,
        `Ready for your update`,
        `Here's what to know`,
        `Your update awaits`,
        `The day's news`,
        `Here's your roundup`,
        `News ready for you`,
        `Here's today`,
        `Your news update`,
        `The latest for you`,
        `Here's your news update`,
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

  // Load the map when scripts are ready
  useEffect(() => {
    console.log('Map useEffect triggered:', { 
      d3: scriptsLoaded.d3, 
      topojson: scriptsLoaded.topojson, 
      countriesCount: Object.keys(newsCountByCountry).length 
    });
    
    if (!scriptsLoaded.d3 || !scriptsLoaded.topojson) {
      console.log('Scripts not ready, waiting...');
      return;
    }
    if (typeof window === 'undefined') return;

    const loadMap = async () => {
      try {
        const d3 = window.d3;
        const topojson = window.topojson;
        
        if (!d3 || !topojson) {
          console.error('D3 or TopoJSON not loaded');
          return;
        }
        
        // Fetch world map data
        const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
        const topo = await res.json();
        const geo = topojson.feature(topo, topo.objects.countries);
        
        const svg = mapContainerRef.current?.querySelector('svg');
        const g = svg?.querySelector('#countries');
        
        if (!svg || !g) return;

        const proj = d3.geoNaturalEarth1().scale(320).translate([800, 450]);
        const path = d3.geoPath().projection(proj);
        
        // Exclude Greenland and Antarctica
        const exclude = [304, 10];
        
        // Clear existing paths
        g.innerHTML = '';
        
        geo.features.forEach(f => {
          if (exclude.includes(+f.id)) return;
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const d = path(f);
          if (d) {
            p.setAttribute('d', d);
            p.setAttribute('class', 'country');
            p.setAttribute('data-id', f.id);
            g.appendChild(p);
          }
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };

    loadMap();
  }, [scriptsLoaded]);

  // Separate useEffect for coloring - runs whenever country data changes
  useEffect(() => {
    if (!mapLoaded) return;
    if (Object.keys(newsCountByCountry).length === 0) return;
    
    console.log('=== COLORING MAP ===');
    console.log('Countries in data:', Object.keys(newsCountByCountry).length);
    
    const svg = mapContainerRef.current?.querySelector('svg');
    const g = svg?.querySelector('#countries');
    if (!g) return;
    
    const countryElements = g.querySelectorAll('.country');
    const counts = Object.values(newsCountByCountry);
    const maxCount = Math.max(...counts, 1);
    
    let coloredCount = 0;
    
    countryElements.forEach(el => {
      const countryId = parseInt(el.getAttribute('data-id'));
      
      for (const [name, count] of Object.entries(newsCountByCountry)) {
        const normalizedName = name.toLowerCase().trim();
        if (countryNameToId[normalizedName] === countryId) {
          const intensity = count / maxCount;
          el.style.fill = getColor(intensity);
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
          background: linear-gradient(165deg, 
            #E8F4FC 0%,
            #F0F8FD 20%,
            #F7FBFE 40%,
            #FFFFFF 60%,
            #FFFFFF 100%
          );
          z-index: 1000;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Greeting Section */
        .greeting-section {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding: 24px 24px 0;
          padding-top: max(12vh, 80px);
          position: relative;
          flex-shrink: 0;
        }

        .greeting-content {
          margin-left: 0;
          padding-left: 16px;
          position: relative;
        }

        .greeting-content::before {
          content: '';
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: 3px;
          background: linear-gradient(180deg, #2563EB 0%, #7C3AED 100%);
          border-radius: 2px;
        }

        .greeting-hi {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: rgba(0, 0, 0, 0.45);
          margin-bottom: 12px;
          text-transform: uppercase;
        }

        .greeting-sub {
          font-size: 38px;
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: #1a1a1a;
          max-width: 340px;
        }

        /* Last Visit */
        .last-visit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.4);
          margin-top: 20px;
          letter-spacing: 0;
        }

        .last-visit-dot {
          width: 6px;
          height: 6px;
          background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%);
          border-radius: 50%;
        }

        /* Map Section */
        .map-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 24px;
          min-height: 0;
        }

        .map-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: rgba(0, 0, 0, 0.5);
          text-transform: uppercase;
          margin-bottom: 16px;
          flex-shrink: 0;
        }

        .map-label-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.6;
        }

        .map-wrapper {
          flex: 1;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.04);
        }

        .map-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .map-container :global(svg) {
          width: 115%;
          height: auto;
          max-height: 100%;
          display: block;
          margin-left: -7%;
        }

        .map-container :global(.country) {
          fill: #E5E7EB;
          stroke: #ffffff;
          stroke-width: 0.5;
          transition: fill 0.3s ease;
        }

        /* Tap hint */
        .tap-hint {
          text-align: center;
          padding: 16px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.25);
          letter-spacing: 0.05em;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .greeting-sub {
            font-size: 32px;
          }
          .greeting-hi {
            font-size: 12px;
          }
          .greeting-section {
            padding-top: max(10vh, 70px);
            padding-left: 20px;
            padding-right: 20px;
          }
          .map-section {
            padding: 16px;
          }
          .map-wrapper {
            border-radius: 16px;
            padding: 12px;
          }
        }

        @media (max-width: 375px) {
          .greeting-sub {
            font-size: 28px;
          }
        }
      `}</style>

      <div className="first-page-container" onClick={handleContinue}>
        <div className="greeting-section">
          <div className="greeting-content">
            <div className="greeting-hi">
              {personalGreeting.hi}
            </div>
            <div className="greeting-sub">{personalGreeting.sub}</div>
            <div className="last-visit">
              <span className="last-visit-dot"></span>
              <span>{getLastVisitText()}</span>
            </div>
          </div>
        </div>

        <div className="map-section">
          <div className="map-label">
            <svg className="map-label-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 12h20M12 2c2.5 2.5 4 5.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-5.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Global Activity</span>
          </div>
          <div className="map-wrapper">
            <div className="map-container" ref={mapContainerRef}>
              <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="round" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                    <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" result="rounded"/>
                    <feComposite in="SourceGraphic" in2="rounded" operator="atop"/>
                  </filter>
                </defs>
                <g id="countries"></g>
              </svg>
            </div>
          </div>
        </div>

        <div className="tap-hint">Tap anywhere to continue</div>
      </div>
    </>
  );
}

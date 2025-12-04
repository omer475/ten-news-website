import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';

export default function NewFirstPage({ onContinue, user, userProfile, stories, readTracker }) {
  // Safety check for stories
  if (!stories || !Array.isArray(stories)) {
    stories = [];
  }

  const mapContainerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState({ d3: false, topojson: false });
  const [newsCountByCountry, setNewsCountByCountry] = useState({});

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

  // Count news by country from all stories
  const countNewsByCountry = () => {
    const counts = {};
    
    stories.filter(story => story.type === 'news').forEach(story => {
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
  };

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
      topScore: topArticle?.final_score || 0
    };
  };

  // Category display names
  const categoryLabels = {
    'politics': 'politics',
    'world': 'world news',
    'business': 'business',
    'technology': 'tech',
    'science': 'science',
    'health': 'health',
    'sports': 'sports',
    'entertainment': 'entertainment',
    'finance': 'markets',
    'economy': 'the economy',
    'conflict': 'global conflicts',
    'war': 'conflict coverage',
    'climate': 'climate news',
    'general': 'current events'
  };

  // Personalized greeting generator based on scores
  const getPersonalizedGreeting = () => {
    const time = getTimeOfDay();
    const name = firstName || '';
    const analysis = analyzeStories();
    
    // MASSIVE time-based hi greetings (30+ per time period)
    const hiGreetings = {
      morning: [
        `Rise and shine${name ? `, ${name}` : ''}`,
        `Good morning${name ? `, ${name}` : ''}`,
        `Morning${name ? `, ${name}` : ''}`,
        `Hey${name ? ` ${name}` : ''}, early bird`,
        `Top of the morning${name ? `, ${name}` : ''}`,
        `Wakey wakey${name ? `, ${name}` : ''}`,
        `Fresh start${name ? `, ${name}` : ''}`,
        `Hello sunshine${name ? `, ${name}` : ''}`,
        `Up and at 'em${name ? `, ${name}` : ''}`,
        `Ready to roll${name ? `, ${name}` : ''}?`,
        `New day${name ? `, ${name}` : ''}`,
        `Morning coffee time${name ? `, ${name}` : ''}`,
        `Bright and early${name ? `, ${name}` : ''}`,
        `Starting strong${name ? `, ${name}` : ''}`,
        `Hello${name ? ` ${name}` : ''}, sunshine`,
        `Off to a good start${name ? `, ${name}` : ''}?`,
        `Another day begins${name ? `, ${name}` : ''}`,
        `Welcome to today${name ? `, ${name}` : ''}`,
        `Let's do this${name ? `, ${name}` : ''}`,
        `Morning has broken${name ? `, ${name}` : ''}`,
        `Seize the day${name ? `, ${name}` : ''}`,
        `Time to wake up${name ? `, ${name}` : ''}`,
        `Coffee ready${name ? `, ${name}` : ''}?`,
        `Morning vibes${name ? `, ${name}` : ''}`,
        `Early riser${name ? `, ${name}` : ''}`,
        `Dawn patrol${name ? `, ${name}` : ''}`,
        `First light${name ? `, ${name}` : ''}`,
        `AM edition${name ? `, ${name}` : ''}`,
        `Sunrise check-in${name ? `, ${name}` : ''}`,
        `Your morning awaits${name ? `, ${name}` : ''}`,
      ],
      afternoon: [
        `Hey${name ? ` ${name}` : ''}`,
        `Good afternoon${name ? `, ${name}` : ''}`,
        `What's up${name ? `, ${name}` : ''}`,
        `Afternoon${name ? `, ${name}` : ''}`,
        `Back for more${name ? `, ${name}` : ''}?`,
        `Midday check-in${name ? `, ${name}` : ''}`,
        `How's your day${name ? `, ${name}` : ''}?`,
        `Taking a break${name ? `, ${name}` : ''}?`,
        `Lunch break${name ? `, ${name}` : ''}?`,
        `Afternoon vibes${name ? `, ${name}` : ''}`,
        `Hope it's going well${name ? `, ${name}` : ''}`,
        `Quick update${name ? `, ${name}` : ''}`,
        `Checking in${name ? `, ${name}` : ''}`,
        `Hello again${name ? `, ${name}` : ''}`,
        `PM edition${name ? `, ${name}` : ''}`,
        `Day going fast${name ? `, ${name}` : ''}?`,
        `Halfway there${name ? `, ${name}` : ''}`,
        `Post-lunch${name ? `, ${name}` : ''}`,
        `Afternoon slump${name ? `, ${name}` : ''}?`,
        `Need a pick-me-up${name ? `, ${name}` : ''}?`,
        `Still at it${name ? `, ${name}` : ''}?`,
        `Making progress${name ? `, ${name}` : ''}?`,
        `Quick scroll${name ? `, ${name}` : ''}?`,
        `Day's flying by${name ? `, ${name}` : ''}`,
        `Powering through${name ? `, ${name}` : ''}?`,
        `Time for news${name ? `, ${name}` : ''}`,
        `Staying informed${name ? `, ${name}` : ''}`,
        `Your daily dose${name ? `, ${name}` : ''}`,
        `Catching up${name ? `, ${name}` : ''}?`,
        `In the loop${name ? `, ${name}` : ''}`,
      ],
      evening: [
        `Evening${name ? `, ${name}` : ''}`,
        `Good evening${name ? `, ${name}` : ''}`,
        `Welcome back${name ? `, ${name}` : ''}`,
        `Winding down${name ? `, ${name}` : ''}?`,
        `End of day check-in${name ? `, ${name}` : ''}`,
        `Day's almost done${name ? `, ${name}` : ''}`,
        `Evening edition${name ? `, ${name}` : ''}`,
        `Relaxing yet${name ? `, ${name}` : ''}?`,
        `Home time${name ? `, ${name}` : ''}`,
        `Kicking back${name ? `, ${name}` : ''}?`,
        `Sunset scrolling${name ? `, ${name}` : ''}`,
        `Evening reading${name ? `, ${name}` : ''}`,
        `Day's recap${name ? `, ${name}` : ''}`,
        `Almost bedtime${name ? `, ${name}` : ''}`,
        `Couch time${name ? `, ${name}` : ''}?`,
        `Evening vibes${name ? `, ${name}` : ''}`,
        `Golden hour${name ? `, ${name}` : ''}`,
        `Dinner time${name ? `, ${name}` : ''}?`,
        `Post-work${name ? `, ${name}` : ''}`,
        `Unwinding${name ? `, ${name}` : ''}?`,
        `Final stretch${name ? `, ${name}` : ''}`,
        `Day in review${name ? `, ${name}` : ''}`,
        `Tonight's headlines${name ? `, ${name}` : ''}`,
        `Before bed${name ? `, ${name}` : ''}`,
        `Evening catch-up${name ? `, ${name}` : ''}`,
        `Night approaches${name ? `, ${name}` : ''}`,
        `Sunset summary${name ? `, ${name}` : ''}`,
        `Evening debrief${name ? `, ${name}` : ''}`,
        `Wrapping up${name ? `, ${name}` : ''}?`,
        `Day's end${name ? `, ${name}` : ''}`,
      ],
      night: [
        `Still up${name ? `, ${name}` : ''}?`,
        `Night owl${name ? `, ${name}` : ''}`,
        `Late night${name ? `, ${name}` : ''}`,
        `Can't sleep${name ? `, ${name}` : ''}?`,
        `Burning midnight oil${name ? `, ${name}` : ''}?`,
        `Night shift${name ? `, ${name}` : ''}?`,
        `Insomniac${name ? `, ${name}` : ''}?`,
        `Midnight reader${name ? `, ${name}` : ''}`,
        `Late night scroll${name ? `, ${name}` : ''}`,
        `Sleepless${name ? `, ${name}` : ''}?`,
        `Night mode${name ? `, ${name}` : ''}`,
        `After hours${name ? `, ${name}` : ''}`,
        `Past bedtime${name ? `, ${name}` : ''}`,
        `Night edition${name ? `, ${name}` : ''}`,
        `Quiet hours${name ? `, ${name}` : ''}`,
        `Late show${name ? `, ${name}` : ''}`,
        `Midnight snack${name ? `, ${name}` : ''}?`,
        `Dark mode${name ? `, ${name}` : ''}`,
        `Moonlight reading${name ? `, ${name}` : ''}`,
        `Sleep can wait${name ? `, ${name}` : ''}`,
        `One more scroll${name ? `, ${name}` : ''}?`,
        `Night crawler${name ? `, ${name}` : ''}`,
        `3 AM thoughts${name ? `, ${name}` : ''}?`,
        `Nocturnal${name ? `, ${name}` : ''}`,
        `Starlight hours${name ? `, ${name}` : ''}`,
        `Night watch${name ? `, ${name}` : ''}`,
        `Graveyard shift${name ? `, ${name}` : ''}?`,
        `Twilight zone${name ? `, ${name}` : ''}`,
        `After midnight${name ? `, ${name}` : ''}`,
        `Witching hour${name ? `, ${name}` : ''}`,
      ]
    };

    // MASSIVE score-based sub messages (100+ total)
    let subOptions = [];
    
    if (analysis.hasBreaking) {
      // Breaking news (score >= 980) - 25+ options
      subOptions = [
        'Breaking news you need to see',
        'Major story developing now',
        'This one\'s important',
        'Big news just dropped',
        'You\'ll want to see this',
        'Stop everything, big news',
        'Urgent story breaking',
        'Can\'t miss this one',
        'Headlines are exploding',
        'World is watching this',
        'History in the making',
        'This changes things',
        'Major development alert',
        'Everyone\'s talking about this',
        'Top story is massive',
        'Breaking: must read',
        'Significant news alert',
        'Critical update incoming',
        'The big one just hit',
        'Developing story, stay tuned',
        'News that matters right now',
        'Don\'t scroll past this',
        'Pay attention to this one',
        'Major headline alert',
        'This is the story today',
        'Breaking story unfolding',
        'Big moment in the news',
        'Alert: major story',
        'This just changed everything',
        'The world just shifted',
      ];
    } else if (analysis.hasVeryHigh) {
      // Very high scored (>= 950) - 30+ options with category
      const topCat = analysis.topCategories[0];
      const catLabel = categoryLabels[topCat] || topCat || 'the news';
      const capCat = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
      subOptions = [
        `Big day for ${catLabel}`,
        `Major ${catLabel} developments`,
        `${capCat} is buzzing today`,
        'Some heavy hitters today',
        'Top stories worth your time',
        `Important ${catLabel} news`,
        `${capCat} making headlines`,
        `Significant ${catLabel} updates`,
        `${capCat} is moving fast`,
        `Major moves in ${catLabel}`,
        `${capCat} dominates today`,
        `Key ${catLabel} stories`,
        `${capCat} worth watching`,
        `Big ${catLabel} moment`,
        `${capCat} is on fire`,
        `Noteworthy ${catLabel}`,
        `${capCat} takes center stage`,
        `Essential ${catLabel} reading`,
        `${capCat} is trending`,
        `Important day for ${catLabel}`,
        `${capCat} in the spotlight`,
        `Major ${catLabel} coverage`,
        `${capCat} steals the show`,
        `Critical ${catLabel} updates`,
        `${capCat} is happening`,
        `Today belongs to ${catLabel}`,
        `${capCat} stories to follow`,
        `Eyes on ${catLabel} today`,
        `${capCat} news you need`,
        `Big ${catLabel} energy today`,
      ];
    } else if (analysis.highScoredCount >= 5) {
      // Multiple high-scored articles - 25+ options
      const cats = analysis.topCategories.slice(0, 2);
      const catLabels = cats.map(c => categoryLabels[c] || c);
      const cat1 = catLabels[0] || 'the news';
      const cat2 = catLabels[1] || '';
      subOptions = [
        `Busy day in ${cat1}`,
        'Lots of important stories',
        cat2 ? `${cat1} and ${cat2} making waves` : `${cat1} making waves`,
        'Quality stories waiting',
        'Packed with good reads',
        'Solid lineup today',
        'Several standout pieces',
        'News-heavy day',
        'Plenty to digest',
        'Stacked with stories',
        'Full news plate',
        'Rich content today',
        'Multiple must-reads',
        'Heavy news day',
        'Loaded with updates',
        'Lots happening today',
        'Big news buffet',
        'Stories stacking up',
        'Eventful day indeed',
        'News keeps coming',
        'Full agenda today',
        'Overflowing inbox',
        'Stories galore',
        'Abundant headlines',
        'News-packed day',
        'Plenty on the menu',
        'Full slate awaits',
        'Much to cover today',
        'Headlines aplenty',
        'News is flowing',
      ];
    } else if (analysis.highScoredCount >= 1) {
      // Some high-scored articles - 25+ options
      const topCat = analysis.topCategories[0];
      const catLabel = categoryLabels[topCat] || 'news';
      subOptions = [
        `Some ${catLabel} worth reading`,
        'A few standout stories',
        `Notable ${catLabel} today`,
        'Curated highlights ready',
        'Quality over quantity today',
        'Selected stories for you',
        'Handpicked updates',
        'Choice stories await',
        'Refined selection today',
        'Best of the day',
        'Top picks ready',
        'Highlights compiled',
        'Essential reads only',
        'Cream of the crop',
        'Worth-your-time stories',
        'Quality selection',
        'Curated for you',
        'The good stuff',
        'Noteworthy pieces',
        'Selected highlights',
        'Prime picks today',
        'Focused selection',
        'Key stories only',
        'Distilled news',
        'Best bits today',
        'Quality catches',
        'Notable mentions',
        'Top tier stories',
        'Selective updates',
        'The essentials',
      ];
    } else {
      // Regular day - time-based defaults (20+ per time)
      const defaults = {
        morning: [
          'Your morning briefing',
          'Starting fresh today',
          'Here\'s what\'s new',
          'Morning news awaits',
          'Start informed',
          'Daily digest ready',
          'Fresh updates inside',
          'Morning roundup',
          'Today\'s first look',
          'Wake up to news',
          'Morning headlines',
          'Daily kickoff',
          'News with coffee',
          'First thing today',
          'Morning dispatch',
          'Today begins here',
          'AM news drop',
          'Sunrise stories',
          'Morning intel',
          'Day\'s first edition',
        ],
        afternoon: [
          'Your afternoon update',
          'Catching you up',
          'Here\'s the latest',
          'Midday news drop',
          'Afternoon dispatch',
          'PM update ready',
          'Latest developments',
          'Afternoon intel',
          'Day\'s progress report',
          'Midday roundup',
          'Afternoon briefing',
          'Quick catch-up',
          'News since morning',
          'Afternoon edition',
          'Day\'s updates',
          'PM news check',
          'Afternoon summary',
          'Staying current',
          'Daily checkpoint',
          'Afternoon snapshot',
        ],
        evening: [
          'Your evening digest',
          'End of day roundup',
          'Today\'s wrap-up',
          'Evening summary',
          'Day in review',
          'Tonight\'s briefing',
          'Evening edition',
          'Day\'s final take',
          'Sunset summary',
          'Evening intel',
          'Daily closeout',
          'End of day report',
          'Evening roundup',
          'Today\'s recap',
          'Night edition',
          'Evening dispatch',
          'Day\'s highlights',
          'Closing summary',
          'Evening briefing',
          'Day\'s final word',
        ],
        night: [
          'Night reading',
          'Late night digest',
          'While you\'re up',
          'Midnight news',
          'Night edition',
          'After hours update',
          'Night owl news',
          'Late night intel',
          'Quiet hours reading',
          'Night dispatch',
          'Midnight briefing',
          'Late night roundup',
          'Night shift news',
          'After dark update',
          'Nighttime digest',
          'Late edition',
          'Night mode news',
          'Moonlight reading',
          'Night watch update',
          'Late night summary',
        ]
      };
      subOptions = defaults[time];
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
    if (!scriptsLoaded.d3 || !scriptsLoaded.topojson) return;
    if (stories.length === 0) return;
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

        // Calculate news by country
        const newsCounts = countNewsByCountry();
        setNewsCountByCountry(newsCounts);

        // Apply colors to countries
        const countryElements = g.querySelectorAll('.country');
        const counts = Object.values(newsCounts);
        const maxCount = Math.max(...counts, 1);
        
        countryElements.forEach(el => {
          const countryId = parseInt(el.getAttribute('data-id'));
          let articleCount = null;
          
          for (const [name, count] of Object.entries(newsCounts)) {
            const normalizedName = name.toLowerCase().trim();
            if (countryNameToId[normalizedName] === countryId) {
              articleCount = count;
              break;
            }
          }
          
          if (articleCount !== null && articleCount > 0) {
            const intensity = articleCount / maxCount;
            el.style.fill = getColor(intensity);
          }
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };

    loadMap();
  }, [scriptsLoaded, stories]);

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
            #3ABAED 0%,
            #5DC8F1 15%,
            #7FD6F5 25%,
            #A1E4F9 35%,
            #C3F2FD 45%,
            #FFFFFF 50%,
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
          padding: 40px 16px;
          padding-top: max(25vh, 120px);
          position: relative;
          flex-shrink: 0;
        }

        .greeting-content {
          margin-left: 0;
          padding-left: 14px;
          position: relative;
        }

        .greeting-content::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3.5px;
          background: linear-gradient(180deg, #1E88C9 0%, #B83A3A 100%);
          border-radius: 2px;
        }

        .greeting-hi {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: rgba(0, 0, 0, 0.4);
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .greeting-main {
          font-size: 52px;
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: rgba(0, 0, 0, 0.88);
        }

        .greeting-sub {
          font-size: 52px;
          font-weight: 400;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: rgba(0, 0, 0, 0.35);
        }

        /* Last Visit */
        .last-visit {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.3);
          margin-top: 24px;
          letter-spacing: 0;
        }

        .last-visit-dot {
          width: 5px;
          height: 5px;
          background: rgba(0, 0, 0, 0.18);
          border-radius: 50%;
        }

        /* Map Section */
        .map-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 0 40px;
          min-height: 0;
        }

        .map-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: rgba(0, 0, 0, 0.32);
          text-transform: uppercase;
          margin-bottom: 20px;
          flex-shrink: 0;
        }

        .map-label-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          background: none;
          margin: 0;
        }

        .map-container {
          position: relative;
          width: 100%;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          min-height: 0;
        }

        .map-container :global(svg) {
          width: 108%;
          height: auto;
          max-height: 100%;
          display: block;
          background: #ffffff;
          margin-left: -6%;
          margin-right: -2%;
        }

        .map-container :global(.country) {
          fill: #d8d8d8;
          stroke: none;
          transition: fill 0.3s ease;
        }

        /* Tap to continue hint */
        .continue-hint {
          position: absolute;
          bottom: max(30px, env(safe-area-inset-bottom, 30px));
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.25);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          animation: pulse 2s infinite;
          cursor: pointer;
          padding: 10px 20px;
          z-index: 10;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        /* Responsive */
        @media (max-width: 480px) {
          .greeting-main,
          .greeting-sub {
            font-size: 42px;
          }
          .greeting-hi {
            font-size: 13px;
          }
          .greeting-section {
            padding-top: max(20vh, 100px);
          }
        }

        @media (max-width: 375px) {
          .greeting-main,
          .greeting-sub {
            font-size: 36px;
          }
        }
      `}</style>

      <div className="first-page-container" onClick={handleContinue}>
        <div className="greeting-section">
          <div className="greeting-content">
            <div className="greeting-hi">
              {personalGreeting.hi}
            </div>
            <div className="greeting-main">
              {totalNewsCount} new {totalNewsCount === 1 ? 'story' : 'stories'}
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
              <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 3v15" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M15 6v15" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Global activity</span>
          </div>
          <div className="map-container" ref={mapContainerRef}>
            <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
              <rect width="100%" height="100%" fill="#ffffff"/>
              <defs>
                <filter id="round" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                  <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" result="rounded"/>
                  <feComposite in="SourceGraphic" in2="rounded" operator="atop"/>
                </filter>
              </defs>
              <g id="countries" filter="url(#round)"></g>
            </svg>
          </div>
        </div>

        <div className="continue-hint">Tap to continue</div>
      </div>
    </>
  );
}

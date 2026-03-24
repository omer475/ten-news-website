import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper to parse JSON safely
const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

// ==========================================
// COSINE SIMILARITY for embedding-based matching
// ==========================================
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

// ==========================================
// ONBOARDING TOPIC -> CATEGORY MAPPING
// Maps user-selected onboarding topics to DB categories + interest_tags.
// Kept for explore/search, NOT used for feed scoring.
// ==========================================

const ONBOARDING_TOPIC_MAP = {
  // -- Politics (8) --
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'republican party', 'supreme court', 'pentagon'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'germany', 'france', 'uk', 'hungary', 'spain'] },
  'Asian Politics':              { categories: ['Politics'], tags: ['asian politics', 'china', 'india', 'japan', 'southeast asia', 'asean', 'asia', 'north korea', 'taiwan'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz'] },
  'Latin America':               { categories: ['Politics'], tags: ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba'] },
  'Africa & Oceania':            { categories: ['Politics'], tags: ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes'] },

  // -- Sports (8) --
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'dunk', 'playoffs'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup'] },
  'MLB/Baseball':                { categories: ['Sports'], tags: ['mlb', 'baseball', 'world series', 'home run', 'pitcher'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout'] },
  'Tennis':                      { categories: ['Sports'], tags: ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open tennis', 'djokovic', 'nadal', 'sinner'] },
  'Golf':                        { categories: ['Sports'], tags: ['golf', 'pga', 'masters', 'ryder cup', 'lpga', 'tiger woods'] },
  'Olympics & Paralympics':      { categories: ['Sports'], tags: ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc', 'olympic'] },

  // -- Business (8) --
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'energy security', 'nuclear energy'] },
  'Automotive':                  { categories: ['Business'], tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Corporate Deals':             { categories: ['Business'], tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },

  // -- Entertainment (6+) --
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'paparazzi', 'star', 'billionaire'] },
  'K-Pop & K-Drama':             { categories: ['Entertainment'], tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'] },
  'Bollywood & Indian Cinema':    { categories: ['Entertainment'], tags: ['bollywood', 'indian cinema', 'shah rukh khan', 'alia bhatt', 'salman khan', 'tollywood', 'indian film'] },
  'Anime & Manga':                { categories: ['Entertainment'], tags: ['anime', 'manga', 'one piece', 'naruto', 'dragon ball', 'studio ghibli', 'crunchyroll', 'shonen'] },
  'Hip-Hop & Rap':                { categories: ['Entertainment'], tags: ['hip-hop', 'rap', 'rapper', 'hip hop', 'drake', 'kendrick', 'travis scott', 'kanye'] },
  'Afrobeats & African Music':    { categories: ['Entertainment'], tags: ['afrobeats', 'afro beats', 'burna boy', 'wizkid', 'davido', 'rema', 'asake', 'amapiano'] },
  'Latin Music & Reggaeton':      { categories: ['Entertainment'], tags: ['reggaeton', 'latin music', 'bad bunny', 'latin pop', 'bachata', 'salsa', 'shakira'] },
  'Comedy & Humor':               { categories: ['Entertainment'], tags: ['comedy', 'humor', 'standup', 'comedian', 'funny', 'memes', 'satire'] },

  // -- Tech (6) --
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Social Media':                { categories: ['Tech'], tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin', 'space exploration'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor'] },

  // -- Science (4) --
  'Space & Astronomy':           { categories: ['Science'], tags: ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Earth Science':               { categories: ['Science'], tags: ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'] },

  // -- Health (4) --
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'drug', 'fda', 'medication', 'biotech', 'pharmaceuticals'] },

  // -- Finance (3) --
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },

  // -- Crypto (3) --
  'Bitcoin':                     { categories: ['Finance', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized'] },
  'Crypto Regulation & Legal':   { categories: ['Finance', 'Tech'], tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'] },

  // -- Lifestyle (8) --
  'Pets & Animals':              { categories: ['Lifestyle'], tags: ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'] },
  'Food & Cooking':              { categories: ['Lifestyle', 'Entertainment'], tags: ['food', 'cooking', 'restaurant', 'recipe', 'chef', 'cuisine', 'dining', 'michelin'] },
  'Travel & Adventure':          { categories: ['Lifestyle'], tags: ['travel', 'adventure', 'tourism', 'vacation', 'destination', 'backpacking', 'hotel', 'airline'] },
  'Fitness & Workout':           { categories: ['Lifestyle', 'Health'], tags: ['fitness', 'workout', 'gym', 'exercise', 'bodybuilding', 'crossfit', 'running', 'marathon'] },
  'Beauty & Skincare':           { categories: ['Lifestyle'], tags: ['beauty', 'skincare', 'makeup', 'cosmetics', 'dermatology', 'skincare routine', 'anti-aging'] },
  'Parenting & Family':          { categories: ['Lifestyle'], tags: ['parenting', 'family', 'children', 'baby', 'motherhood', 'fatherhood', 'pregnancy'] },
  'Home & Garden':               { categories: ['Lifestyle'], tags: ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },

  // -- News (1) --
  'Breaking News & World Affairs': { categories: ['Politics', 'Business', 'Science', 'Health'], tags: ['breaking news', 'world news', 'headline', 'current events', 'global affairs', 'news', 'latest news'] },

  // -- Fashion (2) --
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
};

// ==========================================
// APP TOPIC ALIAS -- maps short IDs (from iOS app / DB) to full topic names
// ==========================================

const APP_TOPIC_ALIAS = {
  // Parent categories -> multiple subtopics
  'politics':       ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Latin America', 'Africa & Oceania', 'Human Rights & Civil Liberties'],
  'sports':         ['NFL', 'NBA', 'Soccer/Football', 'MLB/Baseball', 'Cricket', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'Tennis', 'Golf', 'Olympics & Paralympics'],
  'business':       ['Oil & Energy', 'Automotive', 'Retail & Consumer', 'Corporate Deals', 'Trade & Tariffs', 'Corporate Earnings', 'Startups & Venture Capital', 'Real Estate'],
  'entertainment':  ['Movies & Film', 'TV & Streaming', 'Music', 'Gaming', 'Celebrity News', 'K-Pop & K-Drama', 'Bollywood & Indian Cinema', 'Anime & Manga', 'Hip-Hop & Rap', 'Afrobeats & African Music', 'Latin Music & Reggaeton', 'Comedy & Humor'],
  'technology':     ['AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity', 'Space Tech', 'Robotics & Hardware'],
  'tech':           ['AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity', 'Space Tech', 'Robotics & Hardware'],
  'science':        ['Space & Astronomy', 'Climate & Environment', 'Biology & Nature', 'Earth Science'],
  'health':         ['Medical Breakthroughs', 'Public Health', 'Mental Health', 'Pharma & Drug Industry'],
  'finance':        ['Stock Markets', 'Banking & Lending', 'Commodities'],
  'crypto':         ['Bitcoin', 'DeFi & Web3', 'Crypto Regulation & Legal'],
  'lifestyle':      ['Pets & Animals', 'Food & Cooking', 'Travel & Adventure', 'Fitness & Workout', 'Beauty & Skincare', 'Parenting & Family', 'Home & Garden', 'Shopping & Product Reviews'],
  'fashion':        ['Sneakers & Streetwear', 'Celebrity Style & Red Carpet'],
  // Specific subtopic short IDs -> single topic
  'ai':             ['AI & Machine Learning'],
  'f1':             ['F1 & Motorsport'],
  'nfl':            ['NFL'],
  'nba':            ['NBA'],
  'soccer':         ['Soccer/Football'],
  'baseball':       ['MLB/Baseball'],
  'cricket':        ['Cricket'],
  'boxing':         ['Boxing & MMA/UFC'],
  'gaming':         ['Gaming'],
  'kpop':           ['K-Pop & K-Drama'],
  'startups':       ['Startups & Venture Capital'],
  'cybersecurity':  ['Cybersecurity'],
  'space':          ['Space & Astronomy', 'Space Tech'],
  'climate':        ['Climate & Environment'],
  'environment':    ['Climate & Environment', 'Biology & Nature'],
  'energy':         ['Oil & Energy'],
  'trade':          ['Trade & Tariffs'],
  'defense':        ['War & Conflict'],
  'conflict':       ['War & Conflict'],
  'diplomacy':      ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Human Rights & Civil Liberties'],
  'economy':        ['Stock Markets', 'Banking & Lending', 'Corporate Earnings', 'Trade & Tariffs'],
  'culture':        ['K-Pop & K-Drama', 'Celebrity Style & Red Carpet', 'Movies & Film'],
  'human_rights':   ['Human Rights & Civil Liberties'],
  'transportation': ['Automotive', 'F1 & Motorsport'],
  'law':            ['Crypto Regulation & Legal'],
  'disaster':       ['Earth Science'],
  'infrastructure': ['Real Estate'],
  // Underscore format (from iOS)
  'war_conflict':           ['War & Conflict'],
  'us_politics':            ['US Politics'],
  'european_politics':      ['European Politics'],
  'asian_politics':         ['Asian Politics'],
  'middle_east':            ['Middle East'],
  'latin_america':          ['Latin America'],
  'africa_oceania':         ['Africa & Oceania'],
  'human_rights_civil':     ['Human Rights & Civil Liberties'],
  'oil_energy':             ['Oil & Energy'],
  'trade_tariffs':          ['Trade & Tariffs'],
  'corporate_deals':        ['Corporate Deals'],
  'corporate_earnings':     ['Corporate Earnings'],
  'startups_vc':            ['Startups & Venture Capital'],
  'real_estate':            ['Real Estate'],
  'retail_consumer':        ['Retail & Consumer'],
  'movies_film':            ['Movies & Film'],
  'tv_streaming':           ['TV & Streaming'],
  'celebrity_news':         ['Celebrity News'],
  'kpop_kdrama':            ['K-Pop & K-Drama'],
  'ai_ml':                  ['AI & Machine Learning'],
  'smartphones_gadgets':    ['Smartphones & Gadgets'],
  'social_media':           ['Social Media'],
  'space_tech':             ['Space Tech'],
  'space_astronomy':        ['Space & Astronomy'],
  'robotics_hardware':      ['Robotics & Hardware'],
  'climate_environment':    ['Climate & Environment'],
  'biology_nature':         ['Biology & Nature'],
  'earth_science':          ['Earth Science'],
  'medical_breakthroughs':  ['Medical Breakthroughs'],
  'public_health':          ['Public Health'],
  'mental_health':          ['Mental Health'],
  'pharma_drug':            ['Pharma & Drug Industry'],
  'stock_markets':          ['Stock Markets'],
  'banking_lending':        ['Banking & Lending'],
  'bitcoin':                ['Bitcoin'],
  'defi_web3':              ['DeFi & Web3'],
  'crypto_regulation':      ['Crypto Regulation & Legal'],
  'boxing_mma':             ['Boxing & MMA/UFC'],
  'sneakers_streetwear':    ['Sneakers & Streetwear'],
  'celebrity_style':        ['Celebrity Style & Red Carpet'],
  'pets_animals':           ['Pets & Animals'],
  'bollywood':              ['Bollywood & Indian Cinema'],
  'anime':                  ['Anime & Manga'],
  'anime_manga':            ['Anime & Manga'],
  'hiphop':                 ['Hip-Hop & Rap'],
  'hip_hop':                ['Hip-Hop & Rap'],
  'afrobeats':              ['Afrobeats & African Music'],
  'food':                   ['Food & Cooking'],
  'food_cooking':           ['Food & Cooking'],
  'tennis':                 ['Tennis'],
  'golf':                   ['Golf'],
  'latin_music':            ['Latin Music & Reggaeton'],
  'reggaeton':              ['Latin Music & Reggaeton'],
  'comedy':                 ['Comedy & Humor'],
  'news':                   ['Breaking News & World Affairs'],
  'travel':                 ['Travel & Adventure'],
  'travel_adventure':       ['Travel & Adventure'],
  'fitness':                ['Fitness & Workout'],
  'fitness_workout':        ['Fitness & Workout'],
  'beauty':                 ['Beauty & Skincare'],
  'beauty_skincare':        ['Beauty & Skincare'],
  'skincare':               ['Beauty & Skincare'],
  'parenting':              ['Parenting & Family'],
  'parenting_family':       ['Parenting & Family'],
};

// Resolve a short topic ID to full ONBOARDING_TOPIC_MAP names
function resolveTopicAliases(topics) {
  const resolved = new Set();
  for (const t of topics) {
    const lower = t.toLowerCase().trim();
    // Direct match in ONBOARDING_TOPIC_MAP (full name)
    if (ONBOARDING_TOPIC_MAP[t]) {
      resolved.add(t);
      continue;
    }
    // Alias lookup
    const aliases = APP_TOPIC_ALIAS[lower];
    if (aliases) {
      for (const a of aliases) resolved.add(a);
    }
  }
  return [...resolved];
}

// ==========================================
// ARTICLE FORMATTING
// ==========================================

function formatArticle(article, eventMap = {}) {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timeline = safeJsonParse(article.timeline, null);
  const graph = safeJsonParse(article.graph, null);
  const details = safeJsonParse(article.details, []);
  const components = article.components_order || safeJsonParse(article.components, null);
  const countries = safeJsonParse(article.countries, []);
  const topics = safeJsonParse(article.topics, []);
  const countryRelevance = safeJsonParse(article.country_relevance, null);
  const topicRelevance = safeJsonParse(article.topic_relevance, null);
  const interestTags = safeJsonParse(article.interest_tags, []);

  // Parse map data
  let map = null;
  const rawMap = safeJsonParse(article.map, null);
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const primary = rawMap[0];
      map = {
        center: { lat: primary.coordinates?.lat || 0, lon: primary.coordinates?.lng || primary.coordinates?.lon || 0 },
        markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
        name: primary.name,
        location: [primary.name, primary.city, primary.country].filter(Boolean).join(', '),
        city: primary.city,
        country: primary.country,
        region: primary.country,
        description: primary.description,
      };
    } else if (!Array.isArray(rawMap)) {
      map = {
        center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
        markers: [],
        name: rawMap.name,
        location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
        city: rawMap.city,
        country: rawMap.country,
        region: rawMap.country,
        description: rawMap.description,
      };
    }
  }

  // Clean image URL
  let imageUrl = null;
  const raw = article.image_url;
  if (raw) {
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
      imageUrl = s;
    }
  }

  const formatted = {
    id: article.id,
    title: article.title_news,
    title_news: article.title_news || null,
    url: article.url,
    source: article.source || 'Ten News',
    category: article.category,
    emoji: article.emoji || '📰',
    image_url: imageUrl,
    urlToImage: imageUrl,
    image_source: article.image_source || null,
    publishedAt: article.published_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score || 0,
    final_score: article.ai_final_score || 0,
    base_score: article.ai_final_score || 0,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets: summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsNews,
    content_news: null,
    detailed_text: '',
    five_ws: fiveWs,
    timeline,
    graph,
    map,
    details,
    components,
    countries,
    topics,
    country_relevance: countryRelevance,
    topic_relevance: topicRelevance,
    interest_tags: interestTags,
    num_sources: article.num_sources,
    cluster_id: article.cluster_id,
    version_number: article.version_number,
    views: article.view_count || 0,
  };

  // Add world event if available
  if (eventMap[article.id]) {
    formatted.world_event = eventMap[article.id];
  }

  return formatted;
}

// ==========================================
// RECENCY DECAY (shelf-life-aware, two-phase)
// ==========================================

function getRecencyDecay(createdAt, category, shelfLifeDays) {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const shelfLifeHours = (shelfLifeDays || 7) * 24;

  if (ageHours <= shelfLifeHours) {
    // Within shelf life: gentle exponential decay
    const freshness = Math.exp(-0.5 * ageHours / shelfLifeHours);
    return freshness * 0.85 + 0.15; // 100% -> 67% over shelf life
  } else {
    // Past shelf life: steep penalty but NOT zero
    const overageHours = ageHours - shelfLifeHours;
    const penalty = Math.exp(-2.0 * overageHours / shelfLifeHours);
    return penalty * 0.30 + 0.05; // drops to 5-35% quickly past shelf life
  }
}

// ==========================================
// TITLE DEDUP HELPERS
// ==========================================

function getTitleWords(title) {
  if (!title) return new Set();
  const stopWords = new Set(['the','a','an','in','on','at','to','for','of','is','are','was','were','and','or','but','with','by','from','as','its','it','has','had','have','this','that','be','been','after','new','says','could','may','will','would','about','than','more','into','over','out','up','just','also','amid','per']);
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

function titleSimilarity(titleA, titleB) {
  const wordsA = getTitleWords(titleA);
  const wordsB = getTitleWords(titleB);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

// ==========================================
// DIVERSITY ENFORCEMENT (max consecutive same category)
// ==========================================

function enforceConsecutiveLimit(articles, maxConsecutive) {
  for (let i = maxConsecutive; i < articles.length; i++) {
    let allSame = true;
    for (let j = 0; j < maxConsecutive; j++) {
      if (articles[i - j - 1]?.category !== articles[i]?.category) {
        allSame = false;
        break;
      }
    }
    if (allSame) {
      // Swap with nearest different-category article ahead
      for (let k = i + 1; k < articles.length; k++) {
        if (articles[k].category !== articles[i].category) {
          [articles[i], articles[k]] = [articles[k], articles[i]];
          break;
        }
      }
    }
  }
}

// ==========================================
// COLUMNS TO SELECT
// ==========================================

const ARTICLE_COLUMNS = [
  'id', 'title_news', 'url', 'source', 'category', 'emoji',
  'image_url', 'image_source', 'published_at', 'created_at',
  'ai_final_score', 'summary_bullets_news',
  'five_ws', 'timeline', 'graph', 'map', 'details',
  'components_order', 'components', 'countries', 'topics',
  'country_relevance', 'topic_relevance', 'interest_tags',
  'num_sources', 'cluster_id', 'version_number', 'view_count',
  'shelf_life_days', 'freshness_category', 'embedding_minilm',
].join(', ');

// ==========================================
// NEW: EMBEDDING-BASED SESSION MOMENTUM
// Averages engaged article embeddings, subtracts skipped signal
// ==========================================

async function computeSessionVector(supabase, engagedIds, skippedIds) {
  const DIM = 384;
  let sessionVector = null;

  if (engagedIds.length > 0) {
    const { data: engaged } = await supabase
      .from('published_articles')
      .select('embedding_minilm')
      .in('id', engagedIds.slice(0, 20));

    if (engaged && engaged.length > 0) {
      const avg = new Array(DIM).fill(0);
      let count = 0;
      for (const a of engaged) {
        if (!a.embedding_minilm || !Array.isArray(a.embedding_minilm)) continue;
        for (let i = 0; i < DIM; i++) avg[i] += a.embedding_minilm[i];
        count++;
      }
      if (count > 0) {
        for (let i = 0; i < DIM; i++) avg[i] /= count;
        sessionVector = avg;
      }
    }
  }

  if (skippedIds.length > 0 && sessionVector) {
    const { data: skipped } = await supabase
      .from('published_articles')
      .select('embedding_minilm')
      .in('id', skippedIds.slice(0, 20));

    if (skipped && skipped.length > 0) {
      const skipAvg = new Array(DIM).fill(0);
      let count = 0;
      for (const a of skipped) {
        if (!a.embedding_minilm || !Array.isArray(a.embedding_minilm)) continue;
        for (let i = 0; i < DIM; i++) skipAvg[i] += a.embedding_minilm[i];
        count++;
      }
      if (count > 0) {
        for (let i = 0; i < DIM; i++) sessionVector[i] -= 0.3 * skipAvg[i] / count;
      }
    }
  }

  return sessionVector;
}

// ==========================================
// NEW: EMBEDDING-BASED SCORING
// pgvecSimilarity * 500 + quality * 200 + sessionBoost * 200
// ==========================================

function scoreEmbedding(article, pgvecSimilarity, sessionVector, skipProfile) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const quality = ((article.ai_final_score || 0) / 1000) * recency;

  let sessionBoost = 0;
  if (sessionVector && article.embedding_minilm && Array.isArray(article.embedding_minilm)) {
    sessionBoost = Math.max(0, cosineSim(sessionVector, article.embedding_minilm));
  }

  let skipPenalty = 0;
  if (skipProfile) {
    const tags = safeJsonParse(article.interest_tags, []);
    const n = Math.max(tags.length, 1);
    let skipScore = 0;
    const now = Date.now();
    const HALF = 7 * 24 * 3600000;
    for (const tag of tags) {
      const entry = skipProfile[tag.toLowerCase()];
      if (typeof entry === 'object' && entry?.w) {
        skipScore += entry.w * Math.exp(-0.693 * (now - new Date(entry.t || 0).getTime()) / HALF);
      } else if (typeof entry === 'number') {
        skipScore += entry;
      }
    }
    skipPenalty = Math.min(skipScore / n * 0.3, 0.4);
  }

  return (pgvecSimilarity * 500 + quality * 200 + sessionBoost * 200) * (1 - skipPenalty);
}

// ==========================================
// V3 SCORING: vector×500 + entity×200 + quality×200 + freshness×100 + session×150
// ==========================================

function scoreArticleV3(article, similarity, entityAffinities) {
  const vectorScore = similarity || 0;
  const tags = safeJsonParse(article.interest_tags, []);
  let entityBonus = 0;
  let matchCount = 0;
  for (const tag of tags) {
    const affinity = entityAffinities[tag.toLowerCase()];
    if (affinity && affinity > 0) {
      entityBonus += 0.10 * (affinity / 10.0);
      matchCount++;
      if (matchCount >= 3) break;
    }
  }
  entityBonus = Math.min(entityBonus * (matchCount / Math.max(tags.length, 1)), 0.30);
  const quality = (article.ai_final_score || 0) / 1000;
  const ageHours = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
  const maxHours = article.shelf_life_hours || (article.shelf_life_days || 7) * 24;
  const freshnessBoost = Math.max(0, 0.10 * (1 - ageHours / maxHours));
  return vectorScore * 500 + entityBonus * 200 + quality * 200 + freshnessBoost * 100;
}

// ==========================================
// NEW: EMBEDDING CACHE for MMR diversity
// ==========================================

// ==========================================
// UNIFIED MULTI-POINT RETRIEVAL
// 0 engagements: 1 query per subtopic the user picked
// 1-19 engagements: raw article embeddings (consolidated) + subtopics as backup
// 20+ engagements: K-Means clusters (stored or computed on the fly)
// ==========================================

function consolidateNearDuplicates(engagements, threshold = 0.85) {
  const groups = [];
  for (const eng of engagements) {
    let found = false;
    for (const group of groups) {
      if (cosineSim(eng.embedding, group.centroid) > threshold) {
        group.members.push(eng);
        group.totalWeight += eng.weight;
        const dim = group.centroid.length;
        for (let i = 0; i < dim; i++) {
          group.centroid[i] = (group.centroid[i] * (group.totalWeight - eng.weight) + eng.embedding[i] * eng.weight) / group.totalWeight;
        }
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ centroid: [...eng.embedding], members: [eng], totalWeight: eng.weight });
    }
  }
  return groups;
}

async function getSubtopicVectors(supabase, followedTopics) {
  // Find 1 representative article per subtopic the user selected
  if (!followedTopics || followedTopics.length === 0) return [];

  const vectors = [];
  const categories = new Set();

  for (const topic of followedTopics) {
    const mapping = ONBOARDING_TOPIC_MAP[topic];
    if (!mapping) continue;
    for (const cat of mapping.categories) categories.add(cat);
  }

  if (categories.size === 0) return [];

  // Get 1 top article per category (with embedding)
  for (const cat of categories) {
    const { data: art } = await supabase
      .from('published_articles')
      .select('embedding_minilm')
      .eq('category', cat)
      .not('embedding_minilm', 'is', null)
      .order('ai_final_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (art?.embedding_minilm && Array.isArray(art.embedding_minilm)) {
      vectors.push({ vector: art.embedding_minilm, importance: 1.0 / categories.size });
    }
  }

  return vectors;
}

async function getQueryVectors(supabase, personalizationId, followedTopics) {
  // Fetch engagements
  let engagements = [];
  if (personalizationId) {
    const { data: buffer } = await supabase
      .from('engagement_buffer')
      .select('embedding_minilm, interaction_weight, created_at')
      .eq('personalization_id', personalizationId)
      .gt('interaction_weight', 0)
      .order('created_at', { ascending: false })
      .limit(500);

    for (const row of (buffer || [])) {
      const emb = row.embedding_minilm;
      if (!emb || !Array.isArray(emb) || emb.length !== 384) continue;
      engagements.push({ embedding: emb, weight: row.interaction_weight });
    }
  }

  // ---- 0 engagements: use subtopics directly ----
  if (engagements.length === 0) {
    return await getSubtopicVectors(supabase, followedTopics);
  }

  // ---- 1-19 engagements: raw embeddings + subtopics as backup ----
  if (engagements.length < 20) {
    const groups = consolidateNearDuplicates(engagements, 0.85);
    const totalWeight = groups.reduce((s, g) => s + g.totalWeight, 0);
    const vectors = groups.map(g => ({
      vector: g.centroid,
      importance: g.totalWeight / totalWeight,
    }));

    // Also add subtopic vectors at reduced importance (so user still sees their picked topics)
    const subtopicVecs = await getSubtopicVectors(supabase, followedTopics);
    const engagementShare = engagements.length / 20; // 0 to 1 as engagements grow
    const subtopicShare = 1 - engagementShare;

    // Blend: engagement vectors get engagementShare weight, subtopics get subtopicShare
    for (const v of vectors) v.importance *= engagementShare;
    for (const sv of subtopicVecs) sv.importance *= subtopicShare;

    return [...vectors, ...subtopicVecs];
  }

  // ---- 20+ engagements: K-Means clusters ----
  // Try stored clusters first
  if (personalizationId) {
    const { data: storedClusters } = await supabase
      .from('user_interest_clusters')
      .select('cluster_index, medoid_minilm, importance_score, article_count')
      .eq('personalization_id', personalizationId)
      .eq('is_archived', false)
      .order('importance_score', { ascending: false });

    if (storedClusters && storedClusters.length >= 2) {
      const totalImportance = storedClusters.reduce((s, c) => s + (c.importance_score || 0), 0) || 1;
      return storedClusters
        .filter(c => c.medoid_minilm && Array.isArray(c.medoid_minilm))
        .map(c => ({
          vector: c.medoid_minilm,
          importance: (c.importance_score || 0) / totalImportance,
        }));
    }
  }

  // No stored clusters — consolidate on the fly with lower threshold
  const groups = consolidateNearDuplicates(engagements, 0.60);
  const totalWeight = groups.reduce((s, g) => s + g.totalWeight, 0);
  return groups.map(g => ({
    vector: g.centroid,
    importance: g.totalWeight / totalWeight,
  }));
}

function buildEmbeddingCache(articles) {
  const cache = new Map();
  for (const a of articles) {
    if (a.embedding_minilm && Array.isArray(a.embedding_minilm)) {
      cache.set(a.id, a.embedding_minilm);
    }
  }
  return cache;
}

// ==========================================
// NEW: MMR with embedding cosine similarity
// ==========================================

function mmrSelectEmb(candidates, selected, embCache, lambda) {
  if (candidates.length === 0) return null;
  if (selected.length === 0) return candidates.shift();

  const maxScore = Math.max(...candidates.map(c => c._score), 1);
  let bestIdx = 0;
  let bestMMR = -Infinity;
  const recent = selected.slice(-8);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normScore = c._score / maxScore;
    let maxSim = 0;
    const cEmb = embCache.get(c.id);

    for (const s of recent) {
      let sim = 0;
      const sEmb = embCache.get(s.id);
      if (cEmb && sEmb) sim = Math.max(0, cosineSim(cEmb, sEmb));

      // Title-based dedup
      const tSim = titleSimilarity(c.title_news || '', s.title_news || '');
      if (tSim >= 0.4) sim = Math.max(sim, 0.85);
      else if (tSim >= 0.25) sim = Math.max(sim, 0.6);

      // Same category penalty — ensures feed diversity across categories
      if (c.category === s.category) sim = Math.max(sim, 0.25);

      // Same cluster penalty (v23 interest clusters, not article clusters)
      if (c._cluster !== undefined && c._cluster === s._cluster) sim = Math.max(sim, 0.15);
      // Legacy article cluster dedup
      if (c.cluster_id && c.cluster_id === s.cluster_id) sim = Math.max(sim, 0.4);

      maxSim = Math.max(maxSim, sim);
    }

    const mmr = lambda * normScore - (1 - lambda) * maxSim;
    if (mmr > bestMMR) {
      bestMMR = mmr;
      bestIdx = i;
    }
  }

  return candidates.splice(bestIdx, 1)[0];
}

// ==========================================
// MAIN HANDLER
// ==========================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const homeCountry = req.query.home_country || null;
    const followedCountries = req.query.followed_countries ? req.query.followed_countries.split(',') : [];
    const followedTopics = req.query.followed_topics ? req.query.followed_topics.split(',') : [];
    const userId = req.query.user_id || null;
    const guestDeviceId = req.query.guest_device_id || null;

    // Session signals from client (real-time skip/engage tracking)
    const sessionEngagedIds = req.query.engaged_ids ? req.query.engaged_ids.split(',').map(Number).filter(Boolean) : [];
    const sessionSkippedIds = req.query.skipped_ids ? req.query.skipped_ids.split(',').map(Number).filter(Boolean) : [];
    // Client-sent seen IDs for dedup (prevents repeats even for guests without server events)
    const clientSeenIds = req.query.seen_ids ? req.query.seen_ids.split(',').map(Number).filter(Boolean) : [];

    // ==========================================
    // LOAD USER DATA
    // ==========================================

    let userPrefs = null;
    let tasteVector = null;
    let tasteVectorMinilm = null;
    let skipProfile = null;
    let hasInterestClusters = false;
    let persUserId = null;
    let personalizationId = null;
    let userPhase = 1;
    let totalInteractions = 0;

    // V3: Try personalization_profiles first (non-blocking)
    if (userId || guestDeviceId) {
      try {
        const rpcParams = userId ? { p_auth_id: userId } : { p_device_id: guestDeviceId };
        const { data: persData, error: persError } = await supabase.rpc('resolve_personalization_id', rpcParams);
        if (!persError && persData && persData.length > 0) {
          personalizationId = persData[0].personalization_id;
          userPhase = persData[0].phase;
          totalInteractions = persData[0].total_interactions;
          const { data: ppData } = await supabase
            .from('personalization_profiles')
            .select('taste_vector_minilm')
            .eq('personalization_id', personalizationId)
            .single();
          if (ppData?.taste_vector_minilm) tasteVectorMinilm = ppData.taste_vector_minilm;
        }
      } catch (e) { /* V3 not available — continue with legacy */ }
    }

    if (userId) {
      // Look up profiles table (where real users live, id = auth UUID)
      let { data: userData } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile')
        .eq('id', userId)
        .single();

      if (!userData) {
        // Fallback: try legacy users table
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, skip_profile')
          .eq('id', userId)
          .single();
        if (!legacyUser) {
          const { data: linkedUser } = await supabase
            .from('users')
            .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, skip_profile')
            .eq('auth_user_id', userId)
            .single();
          if (linkedUser) userData = linkedUser;
        } else {
          userData = legacyUser;
        }
      }

      if (userData) {
        userPrefs = userData;
        tasteVector = userData.taste_vector;
        persUserId = userData.id;
      }

      // Extract MiniLM taste vector and skip profile
      tasteVectorMinilm = userData?.taste_vector_minilm || null;
      skipProfile = userData?.skip_profile || null;

      // Check if user has interest clusters (PinnerSage)
      if (tasteVector && persUserId) {
        const { count } = await supabase
          .from('user_interest_clusters')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', persUserId);
        hasInterestClusters = (count || 0) > 0;
      }
    }

    if (!userPrefs) {
      // Fallback: use query params for users not in DB (guest/anonymous)
      userPrefs = { home_country: homeCountry || '', followed_countries: followedCountries, followed_topics: followedTopics };
    }

    // ==========================================
    // PARSE CURSOR
    // ==========================================

    let offset = 0;

    if (cursor) {
      if (cursor.startsWith('v2_')) {
        const parts = cursor.split('_');
        offset = parseInt(parts[1]) || 0;
      } else {
        // Legacy numeric offset cursor
        offset = parseInt(cursor) || 0;
      }
    }

    // ==========================================
    // GET SEEN ARTICLE IDS (for dedup across pages)
    // ==========================================

    let seenArticleIds = [];
    if (persUserId || userId) {
      const { data: seenEvents } = await supabase
        .from('user_article_events')
        .select('article_id')
        .eq('user_id', userId)
        .in('event_type', ['article_view', 'article_detail_view', 'article_skipped', 'article_engaged'])
        .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (seenEvents) {
        seenArticleIds = [...new Set(seenEvents.map(e => e.article_id).filter(Boolean))];
      }
    }
    // Merge client-sent seen IDs
    if (clientSeenIds.length > 0) {
      seenArticleIds = [...new Set([...seenArticleIds, ...clientSeenIds])];
    }

    // ==========================================
    // ALWAYS USE V2 FEED
    // ==========================================

    const similarityFloor = userPrefs?.similarity_floor || 0;

    return await handleV2Feed(req, res, supabase, {
      userId: persUserId || userId,
      userPrefs,
      tasteVector,
      tasteVectorMinilm,
      hasInterestClusters,
      similarityFloor,
      skipProfile,
      seenArticleIds,
      sessionEngagedIds,
      sessionSkippedIds,
      limit,
      offset,
      personalizationId,
      userPhase,
      totalInteractions,
    });

  } catch (error) {
    console.error('Main feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// =================================================================
// EMBEDDING-FIRST FEED (v22)
// pgvector similarity is PRIMARY. Tags are metadata only.
// =================================================================

async function handleV2Feed(req, res, supabase, opts) {
  let { userId, userPrefs, tasteVector, tasteVectorMinilm, hasInterestClusters,
        similarityFloor, skipProfile, seenArticleIds,
        sessionEngagedIds, sessionSkippedIds, limit, offset,
        personalizationId, userPhase, totalInteractions } = opts;
  userPhase = userPhase || 1;
  totalInteractions = totalInteractions || 0;
  sessionEngagedIds = sessionEngagedIds || [];
  sessionSkippedIds = sessionSkippedIds || [];

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 365 * 24 * 3600000).toISOString();
  const fortyEightHoursAgo = new Date(now - 365 * 24 * 3600000).toISOString();

  // Personalized feed -- no shared/CDN caching
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  // ==========================================
  // PHASE 1: PARALLEL DATA LOADING
  // ==========================================

  const excludeIds = seenArticleIds.length > 0 ? seenArticleIds : null;
  const minSim = similarityFloor || 0;
  const useMinilm = !!tasteVectorMinilm;
  const hasAnyPersonalization = tasteVector || tasteVectorMinilm || hasInterestClusters;

  // ==========================================
  // V23 UNIFIED MULTI-POINT RETRIEVAL
  // No phases. One function picks the best query strategy.
  // ==========================================
  const personalMatchCount = Math.min(300 + offset, 600);
  let personalPromise;

  personalPromise = (async () => {
    // Step 1: Get query vectors
    const userFollowedTopics = userPrefs?.followed_topics || [];
    const queryVectors = await getQueryVectors(supabase, personalizationId, userFollowedTopics);

    if (queryVectors.length === 0) {
      return { data: [], error: null };
    }

    // Step 2: Multi-query per vector to overcome HNSW 40-result cap
    // For each interest vector, run 3 queries with slight perturbations
    // Each returns ~40 different articles → 120 per interest instead of 40
    const allQueries = [];

    for (let idx = 0; idx < queryVectors.length; idx++) {
      const qv = queryVectors[idx];
      const matchCount = Math.max(40, Math.round(personalMatchCount * qv.importance));

      // Query 1: original vector
      allQueries.push(
        supabase.rpc('match_articles_personal_minilm', {
          query_embedding: qv.vector, match_count: matchCount,
          hours_window: 8760, exclude_ids: excludeIds, min_similarity: minSim,
        }).then(result => {
          if (result.data) for (const r of result.data) r._cluster = idx;
          return result;
        })
      );

      // Query 2-5: perturbed vectors (noise=0.1 explores different HNSW paths, 96% stay relevant)
      for (let p = 0; p < 4; p++) {
        const perturbed = qv.vector.map(v => v + (Math.random() - 0.5) * 0.2);
        allQueries.push(
          supabase.rpc('match_articles_personal_minilm', {
            query_embedding: perturbed, match_count: matchCount,
            hours_window: 8760, exclude_ids: excludeIds, min_similarity: minSim,
          }).then(result => {
            if (result.data) for (const r of result.data) r._cluster = idx;
            return result;
          })
        );
      }
    }

    const results = await Promise.all(allQueries);

    // Step 3: Merge — keep best similarity per article
    const bestSim = new Map();
    for (const result of results) {
      if (result.data) {
        for (const row of result.data) {
          const existing = bestSim.get(row.id);
          if (!existing || row.similarity > existing.similarity) {
            bestSim.set(row.id, row);
          }
        }
      }
    }

    return { data: [...bestSim.values()].sort((a, b) => b.similarity - a.similarity).slice(0, personalMatchCount), error: null };
  })();

  const [personalResult, trendingResult, discoveryResult] = await Promise.all([
    // 1. PERSONAL: pgvector similarity search
    personalPromise,

    // 2. TRENDING: high editorial score, recent 48h
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', fortyEightHoursAgo)
      .gte('ai_final_score', 600)
      .order('ai_final_score', { ascending: false })
      .limit(150),

    // 3. DISCOVERY: quality content in 7d
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', sevenDaysAgo)
      .gte('ai_final_score', 300)
      .order('ai_final_score', { ascending: false })
      .limit(300),
  ]);

  if (personalResult.error) {
    console.error('Personal query error (continuing with trending+discovery):', personalResult.error);
  }

  // ==========================================
  // PHASE 2: BUILD CANDIDATE POOLS
  // ==========================================

  const sessionExcludeIds = new Set([...sessionEngagedIds, ...sessionSkippedIds]);

  // Personal: from pgvector results with similarity scores
  const personalSimilarityMap = {};
  let personalIdOrder = [];

  if (hasInterestClusters) {
    // Group candidates by cluster
    const clusterBuckets = {};
    for (const r of (personalResult.data || [])) {
      const ci = r.cluster_index ?? 0;
      if (!clusterBuckets[ci]) clusterBuckets[ci] = [];
      clusterBuckets[ci].push(r);
      if (!personalSimilarityMap[r.id] || r.similarity > personalSimilarityMap[r.id]) {
        personalSimilarityMap[r.id] = r.similarity;
      }
    }

    // Sort each cluster by similarity
    for (const ci of Object.keys(clusterBuckets)) {
      clusterBuckets[ci].sort((a, b) => b.similarity - a.similarity);
    }

    // Load cluster metadata for proportional weighting
    const { data: clusterMeta } = await supabase
      .from('user_interest_clusters')
      .select('cluster_index, article_count')
      .eq('user_id', userId);

    const totalEngaged = (clusterMeta || []).reduce((s, c) => s + (c.article_count || 1), 0);
    const clusterWeights = {};
    for (const c of (clusterMeta || [])) {
      clusterWeights[c.cluster_index] = Math.min(
        (c.article_count || 1) / Math.max(totalEngaged, 1),
        0.5
      );
    }

    // Proportional allocation (min 1 per cluster)
    const clusterKeys = Object.keys(clusterBuckets);
    const targetTotal = 300;
    const allocations = {};
    for (const ci of clusterKeys) {
      const weight = clusterWeights[ci] || (1 / clusterKeys.length);
      allocations[ci] = Math.max(1, Math.round(weight * targetTotal));
    }

    // Fill from each cluster up to its allocation
    const seen = new Set();
    for (const ci of clusterKeys) {
      let added = 0;
      for (const r of clusterBuckets[ci]) {
        if (added >= allocations[ci]) break;
        if (!seen.has(r.id)) {
          seen.add(r.id);
          personalIdOrder.push(r.id);
          added++;
        }
      }
    }
  } else {
    // Single taste vector: sort by similarity
    const sorted = (personalResult.data || []).sort((a, b) => b.similarity - a.similarity);
    for (const r of sorted) {
      personalSimilarityMap[r.id] = r.similarity;
      personalIdOrder.push(r.id);
    }
  }

  // Filter out session-excluded articles
  personalIdOrder = personalIdOrder.filter(id => !sessionExcludeIds.has(id));
  const personalIds = new Set(personalIdOrder);

  // Trending: exclude personal dupes and seen
  const trendingIds = new Set();
  const trendingArticleMeta = [];
  for (const a of (trendingResult.data || [])) {
    if (personalIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    trendingIds.add(a.id);
    trendingArticleMeta.push(a);
  }

  // Discovery: exclude personal + trending + seen
  const discoveryArticleMeta = [];
  for (const a of (discoveryResult.data || [])) {
    if (personalIds.has(a.id) || trendingIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    discoveryArticleMeta.push(a);
  }

  // ==========================================
  // PHASE 3: FETCH FULL ARTICLE DATA
  // ==========================================

  const allCandidateIds = [
    ...personalIds,
    ...trendingIds,
    ...discoveryArticleMeta.map(a => a.id),
  ];
  const uniqueIds = [...new Set(allCandidateIds)];

  if (uniqueIds.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Fetch full article data in batches
  let allArticles = [];
  for (let i = 0; i < uniqueIds.length; i += 300) {
    const batch = uniqueIds.slice(i, i + 300);
    const { data, error } = await supabase
      .from('published_articles')
      .select(ARTICLE_COLUMNS)
      .in('id', batch);
    if (!error && data) allArticles = allArticles.concat(data);
  }

  // Filter out test articles
  allArticles = allArticles.filter(a => {
    const url = a?.url || '';
    const title = a?.title_news || a?.title || '';
    return !(/test/i.test(url) || /test/i.test(title));
  });

  const articleMap = {};
  for (const a of allArticles) articleMap[a.id] = a;

  // ==========================================
  // PHASE 4: SESSION MOMENTUM
  // ==========================================

  const sessionVector = await computeSessionVector(supabase, sessionEngagedIds, sessionSkippedIds);

  // ==========================================
  // PHASE 5: SCORE ALL CANDIDATES
  // ==========================================

  // V3: Load entity affinities for scoring
  let entityAffinities = {};
  if (personalizationId) {
    try {
      const { data: affinityRows } = await supabase
        .from('user_entity_affinity')
        .select('entity, affinity_score')
        .eq('personalization_id', personalizationId)
        .order('affinity_score', { ascending: false })
        .limit(100);
      if (affinityRows) {
        for (const row of affinityRows) entityAffinities[row.entity] = row.affinity_score;
      }
    } catch (e) { /* entity affinity not available */ }
  }

  // Personal: embedding-based scoring (V3 when available, else V2)
  const personalScored = personalIdOrder
    .filter(id => articleMap[id])
    .map(id => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      const score = personalizationId
        ? scoreArticleV3(article, similarity, entityAffinities)
        : scoreEmbedding(article, similarity, sessionVector, skipProfile);
      return {
        ...article,
        _score: score,
        _similarity: similarity,
        _bucket: 'personal',
      };
    })
    .sort((a, b) => b._score - a._score);

  // Track personal categories for discovery diversity boost
  const personalCategories = new Set(personalScored.map(a => a.category));

  // Trending: ai_final_score * recency
  const trendingScored = trendingArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
      return {
        ...article,
        _score: (article.ai_final_score || 0) * recency,
        _bucket: 'trending',
      };
    })
    .sort((a, b) => b._score - a._score);

  // Discovery: ai_final_score * recency * catBoost(unfamiliar=1.5) * random(0.3)
  const discoveryScored = discoveryArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
      const catBoost = personalCategories.has(article.category) ? 1.0 : 1.5;
      const randomBoost = 1.0 + (Math.random() * 0.3);
      return {
        ...article,
        _score: (article.ai_final_score || 0) * recency * catBoost * randomBoost,
        _bucket: 'discovery',
      };
    })
    .sort((a, b) => b._score - a._score);

  // ==========================================
  // PHASE 6: FILL FEED WITH EMBEDDING MMR
  // ==========================================

  const embeddingCache = buildEmbeddingCache(allArticles);

  const CLUSTER_CAP = 2; // max articles per cluster_id
  const clusterCounts = {};

  function isClusterCapped(article) {
    const clusterId = article.cluster_id;
    if (clusterId && (clusterCounts[clusterId] || 0) >= CLUSTER_CAP) return true;
    return false;
  }

  function recordClusterSelection(article) {
    const clusterId = article.cluster_id;
    if (clusterId) clusterCounts[clusterId] = (clusterCounts[clusterId] || 0) + 1;
  }

  // MMR select with cluster dedup
  function mmrSelectDeduped(pool, sel, lambda) {
    let attempts = 0;
    while (attempts < 5 && pool.length > 0) {
      const picked = mmrSelectEmb(pool, sel, embeddingCache, lambda);
      if (!picked) return null;
      if (!isClusterCapped(picked)) return picked;
      attempts++;
    }
    return null;
  }

  // ==========================================
  // V23: 30-article slot pattern with MMR within each pool
  // P=Personal, T=Trending, E=Exploration, CS=Cold-Start
  // ==========================================
  const V23_SLOTS = ['P','P','T','P','E','P','P','T','P','CS','P','P','T','P','E','P','P','T','P','E','P','P','T','P','CS','P','P','T','P','E'];

  // Step 1: MMR-select within each pool
  const pPool = [...personalScored];
  const tPool = [...trendingScored];
  const dPool = [...discoveryScored];

  const pSelected = [];
  for (let i = 0; i < 18 && pPool.length > 0; i++) {
    const picked = mmrSelectDeduped(pPool, pSelected, 0.7);
    if (!picked) break;
    picked.bucket = 'personal';
    recordClusterSelection(picked);
    pSelected.push(picked);
  }

  const tSelected = [];
  for (let i = 0; i < 6 && tPool.length > 0; i++) {
    const picked = mmrSelectDeduped(tPool, tSelected, 0.85);
    if (!picked) break;
    picked.bucket = 'trending';
    tSelected.push(picked);
  }

  const eSelected = [];
  for (let i = 0; i < 4 && dPool.length > 0; i++) {
    const picked = mmrSelectDeduped(dPool, eSelected, 0.5);
    if (!picked) break;
    picked.bucket = 'exploration';
    eSelected.push(picked);
  }

  // Cold-start: new/unscored content from categories user doesn't usually see
  const csSelected = dPool.slice(0, 2).map(a => ({ ...a, bucket: 'cold-start' }));

  // Step 2: Interleave into slot pattern
  const selected = [];
  let pIdx = 0, tIdx = 0, eIdx = 0, csIdx = 0;

  for (let pos = 0; pos < Math.min(V23_SLOTS.length, limit); pos++) {
    const slot = V23_SLOTS[pos];
    let picked = null;

    if (slot === 'P' && pIdx < pSelected.length) picked = pSelected[pIdx++];
    else if (slot === 'T' && tIdx < tSelected.length) picked = tSelected[tIdx++];
    else if (slot === 'E' && eIdx < eSelected.length) picked = eSelected[eIdx++];
    else if (slot === 'CS' && csIdx < csSelected.length) picked = csSelected[csIdx++];

    // Backfill: P→next P, T→next T, etc. If pool empty, try others
    if (!picked) {
      if (pIdx < pSelected.length) picked = pSelected[pIdx++];
      else if (tIdx < tSelected.length) picked = tSelected[tIdx++];
      else if (eIdx < eSelected.length) picked = eSelected[eIdx++];
    }

    if (picked) selected.push(picked);
  }

  // ==========================================
  // PHASE 7: FORMAT + RESPOND
  // ==========================================

  enforceConsecutiveLimit(selected, 2);

  if (selected.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  const pageIds = selected.map(a => a.id);

  const formattedArticles = selected.map(a => {
    const formatted = formatArticle(a);
    formatted.bucket = a.bucket;
    formatted.final_score = a._score;
    return formatted;
  });

  // Log feed impressions for skip tracking (fire-and-forget)
  if (userId && pageIds.length > 0) {
    const impressions = pageIds.map(aid => ({ user_id: userId, article_id: aid }));
    supabase.from('user_feed_impressions').insert(impressions).then(() => {}).catch(() => {});
  }

  // Pagination cursor
  const totalAvailable = personalScored.length + trendingScored.length + discoveryScored.length;
  const totalServed = offset + selected.length;
  const hasMore = totalAvailable > selected.length && totalServed < totalAvailable;
  const nextCursor = hasMore ? `v2_${totalServed}_${selected[selected.length - 1]?.id || 0}` : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: totalAvailable,
    _v: 'v22',
  });
}

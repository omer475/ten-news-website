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

function scoreArticleV3(article, similarity, entityAffinities, skipEmbeddings, sessionCategoryCounts) {
  // ==========================================
  // USER RELEVANCE (60% of total score)
  // Entity affinity is the PRIMARY signal — not a bonus
  // ==========================================

  // Entity match: does this article contain entities the user loves?
  // Normalized against user's max affinity (no cap)
  const tags = safeJsonParse(article.interest_tags, []);
  const maxAffinity = Math.max(1, ...Object.values(entityAffinities));
  let entityScore = 0;
  for (const tag of tags) {
    const affinity = entityAffinities[tag.toLowerCase()];
    if (affinity && affinity > 0) {
      entityScore = Math.max(entityScore, affinity / maxAffinity); // relative to user's top interest
    }
  }

  // Embedding similarity from ANN search
  const clusterScore = similarity || 0;

  // Combined user relevance
  const userRelevance = 0.50 * entityScore + 0.50 * clusterScore;

  // ==========================================
  // CONTENT QUALITY (25% of total score)
  // ==========================================
  const quality = (article.ai_final_score || 0) / 1000;

  // ==========================================
  // FRESHNESS (15% of total score)
  // ==========================================
  const ageHours = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
  const maxHours = article.shelf_life_hours || (article.shelf_life_days || 7) * 24;
  const freshness = Math.max(0, 1 - ageHours / maxHours);

  // ==========================================
  // BLEND: 60% user relevance + 25% quality + 15% freshness
  // ==========================================
  let score = (
    0.60 * userRelevance +
    0.25 * quality +
    0.15 * freshness
  ) * 1000; // scale to 0-1000 range

  // ==========================================
  // NEGATIVE SIGNALS (multiplicative penalties)
  // ==========================================

  // Skip repulsion
  if (skipEmbeddings && skipEmbeddings.length > 0 && article.embedding_minilm && Array.isArray(article.embedding_minilm)) {
    let maxSkipSim = 0;
    for (const skipEmb of skipEmbeddings) {
      const sim = cosineSim(article.embedding_minilm, skipEmb);
      if (sim > maxSkipSim) maxSkipSim = sim;
    }
    score *= (1 - 0.3 * maxSkipSim);
  }

  // Session saturation
  let saturationPenalty = 1.0;
  if (sessionCategoryCounts) {
    const catCount = sessionCategoryCounts[article.category] || 0;
    if (catCount === 0) saturationPenalty = 1.0;
    else if (catCount <= 2) saturationPenalty = 0.85;
    else if (catCount <= 4) saturationPenalty = 0.6;
    else if (catCount <= 6) saturationPenalty = 0.3;
    else saturationPenalty = 0.1;
  }
  return score * saturationPenalty;
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

// Map subtopic names to concept_entities categories
const SUBTOPIC_TO_ENTITY_CATEGORY = {
  'Soccer/Football': 'Soccer', 'NBA': 'Basketball', 'NFL': 'Football',
  'MLB/Baseball': 'Baseball', 'Cricket': 'Cricket', 'F1 & Motorsport': 'Motorsport',
  'Boxing & MMA/UFC': 'Combat Sports', 'Olympics & Paralympics': 'Sports Events',
  'Gaming': 'Gaming', 'Movies & Film': 'Entertainment', 'TV & Streaming': 'Entertainment',
  'Music': 'K-Pop & Music', 'Celebrity News': 'Entertainment', 'K-Pop & K-Drama': 'K-Pop & Music',
  'AI & Machine Learning': 'AI & Tech', 'Smartphones & Gadgets': 'AI & Tech',
  'Cybersecurity': 'AI & Tech', 'Space Tech': 'Science', 'Robotics & Hardware': 'AI & Tech',
  'Social Media': 'AI & Tech',
  'Space & Astronomy': 'Science', 'Climate & Environment': 'Science',
  'Biology & Nature': 'Science', 'Earth Science': 'Science',
  'Medical Breakthroughs': 'Health', 'Public Health': 'Health',
  'Mental Health': 'Health', 'Pharma & Drug Industry': 'Health',
  'Stock Markets': 'Finance', 'Banking & Lending': 'Finance', 'Commodities': 'Finance',
  'Oil & Energy': 'Business', 'Automotive': 'Automotive',
  'Retail & Consumer': 'Business', 'Corporate Deals': 'Business',
  'Trade & Tariffs': 'Business', 'Corporate Earnings': 'Business',
  'Startups & Venture Capital': 'Business', 'Real Estate': 'Business',
  'Bitcoin': 'Finance', 'DeFi & Web3': 'Finance', 'Crypto Regulation & Legal': 'Finance',
  'Sneakers & Streetwear': 'Fashion', 'Celebrity Style & Red Carpet': 'Fashion',
  'Pets & Animals': 'Lifestyle', 'War & Conflict': 'World Politics',
  'US Politics': 'US Politics', 'European Politics': 'World Politics',
  'Asian Politics': 'World Politics', 'Middle East': 'World Politics',
  'Latin America': 'World Politics', 'Africa & Oceania': 'World Politics',
  'Human Rights & Civil Liberties': 'World Politics',
  'Food & Cooking': 'Food', 'Travel & Adventure': 'Travel',
  'Fitness & Nutrition': 'Health', 'Fashion & Beauty': 'Fashion',
};

async function getSubtopicVectors(supabase, followedTopics, personalizationId) {
  // UCB-BASED CLUSTER SELECTION from precomputed subtopic_entity_clusters
  if (!followedTopics || followedTopics.length === 0) return [];

  const TOTAL_BUDGET = 18;
  const MIN_PER_TOPIC = 2;

  // Step 1: Load precomputed clusters for each subtopic
  const topicClusters = {};
  const seenCategories = new Set();

  for (const topic of followedTopics) {
    const entityCat = SUBTOPIC_TO_ENTITY_CATEGORY[topic];
    if (!entityCat || seenCategories.has(entityCat)) continue;
    seenCategories.add(entityCat);

    const { data: clusters } = await supabase
      .from('subtopic_entity_clusters')
      .select('cluster_index, centroid_embedding, entity_names, cluster_size')
      .eq('subtopic_category', entityCat)
      .order('cluster_size', { ascending: false });

    if (!clusters || clusters.length === 0) continue;

    topicClusters[topic] = clusters.map(c => ({
      index: c.cluster_index,
      centroid: typeof c.centroid_embedding === 'string' ? JSON.parse(c.centroid_embedding) : c.centroid_embedding,
      entities: c.entity_names || [],
      size: c.cluster_size || 1,
      category: entityCat,
    })).filter(c => Array.isArray(c.centroid) && c.centroid.length === 384);
  }

  const topicNames = Object.keys(topicClusters);
  if (topicNames.length === 0) return [];

  // Step 2: Load UCB stats if user has engagement history
  let ucbStats = {};
  if (personalizationId) {
    const { data: stats } = await supabase
      .from('user_cluster_stats')
      .select('subtopic_category, cluster_index, times_shown, times_engaged, ucb_score')
      .eq('personalization_id', personalizationId);

    for (const s of (stats || [])) {
      const key = s.subtopic_category + '_' + s.cluster_index;
      ucbStats[key] = s;
    }
  }

  // Step 3: Allocate budget per subtopic (equal in session 1, weighted by engagement later)
  const maxTopics = Math.floor(TOTAL_BUDGET / MIN_PER_TOPIC);
  const activeTopics = topicNames.slice(0, maxTopics);

  // Check if we have ANY engagement data
  const hasHistory = Object.keys(ucbStats).length > 0;

  const allocation = {};
  let remaining = TOTAL_BUDGET;

  if (!hasHistory) {
    // Session 1: equal split
    for (const topic of activeTopics) {
      allocation[topic] = Math.max(MIN_PER_TOPIC, Math.min(Math.floor(TOTAL_BUDGET / activeTopics.length), remaining));
      remaining -= allocation[topic];
    }
  } else {
    // Session 2+: weight by engagement rate, min 1 per topic
    const topicEngagement = {};
    for (const topic of activeTopics) {
      const entityCat = SUBTOPIC_TO_ENTITY_CATEGORY[topic];
      let shown = 0, engaged = 0;
      for (const c of (topicClusters[topic] || [])) {
        const key = entityCat + '_' + c.index;
        const stat = ucbStats[key];
        if (stat) { shown += stat.times_shown; engaged += stat.times_engaged; }
      }
      topicEngagement[topic] = shown > 0 ? engaged / shown : 0.5;
    }

    // Proportional allocation weighted by engagement
    const totalEng = activeTopics.reduce((s, t) => s + topicEngagement[t], 0);
    for (const topic of activeTopics) {
      const ideal = Math.round((topicEngagement[topic] / Math.max(totalEng, 0.1)) * TOTAL_BUDGET);
      allocation[topic] = Math.max(1, Math.min(ideal, remaining));
      remaining -= allocation[topic];
    }
  }

  // Distribute leftover to topics with most untested clusters
  while (remaining > 0) {
    let distributed = false;
    for (const topic of activeTopics) {
      if (remaining <= 0) break;
      if ((topicClusters[topic]?.length || 0) > allocation[topic]) {
        allocation[topic]++;
        remaining--;
        distributed = true;
      }
    }
    if (!distributed) break;
  }

  // Step 4: UCB cluster selection within each subtopic
  const vectors = [];

  for (const topic of activeTopics) {
    const clusters = topicClusters[topic] || [];
    const nSlots = allocation[topic] || 0;
    if (clusters.length === 0 || nSlots === 0) continue;

    const entityCat = SUBTOPIC_TO_ENTITY_CATEGORY[topic];

    // Compute UCB score for each cluster
    const totalTests = Object.values(ucbStats).reduce((s, st) => s + (st.times_shown || 0), 0);
    const scored = clusters.map(c => {
      const key = entityCat + '_' + c.index;
      const stat = ucbStats[key];
      if (!stat || stat.times_shown === 0) {
        return { ...c, ucb: Infinity }; // untested → test first
      }
      const engRate = stat.times_engaged / stat.times_shown;
      const explorationBonus = Math.sqrt(2 * Math.log(Math.max(1, totalTests)) / stat.times_shown);
      return { ...c, ucb: engRate + explorationBonus };
    });

    // Sort by UCB (highest first), then pick using MMR for spread among ties
    scored.sort((a, b) => b.ucb - a.ucb);

    const selected = [];
    for (let i = 0; i < nSlots && scored.length > 0; i++) {
      if (i === 0 || selected.length === 0) {
        selected.push(scored.shift());
      } else {
        // Among top UCB candidates, pick most diverse from already selected
        const topCandidates = scored.slice(0, Math.min(5, scored.length));
        let bestIdx = 0, bestDiv = -Infinity;
        for (let j = 0; j < topCandidates.length; j++) {
          const minSim = Math.min(...selected.map(s => cosineSim(topCandidates[j].centroid, s.centroid)));
          const diversity = 1 - minSim;
          if (diversity > bestDiv) { bestDiv = diversity; bestIdx = j; }
        }
        selected.push(topCandidates[bestIdx]);
        scored.splice(scored.indexOf(topCandidates[bestIdx]), 1);
      }
    }

    const topicWeight = nSlots / TOTAL_BUDGET;
    for (const cluster of selected) {
      vectors.push({
        vector: cluster.centroid,
        importance: topicWeight / selected.length,
        _subtopicCategory: entityCat,
        _clusterIndex: cluster.index,
      });
    }
  }

  return vectors;
}

// Simple K-Means for entity clustering (lightweight, runs at query time)
function simpleKMeans(embeddings, k, maxIter = 20) {
  const n = embeddings.length;
  const dim = embeddings[0].length;
  if (n < k) return { labels: embeddings.map((_, i) => i), centroids: embeddings.map(e => [...e]) };

  // K-Means++ init
  const centroids = [[...embeddings[Math.floor(Math.random() * n)]]];
  for (let c = 1; c < k; c++) {
    const dists = embeddings.map(e => {
      let minD = Infinity;
      for (const ce of centroids) minD = Math.min(minD, 1 - cosineSim(e, ce));
      return minD * minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, cum = 0;
    for (let i = 0; i < n; i++) { cum += dists[i]; if (cum >= r) { centroids.push([...embeddings[i]]); break; } }
  }

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const nl = embeddings.map(e => {
      let b = 0, bs = -Infinity;
      for (let c = 0; c < k; c++) { const s = cosineSim(e, centroids[c]); if (s > bs) { bs = s; b = c; } }
      return b;
    });
    if (nl.every((l, i) => l === labels[i])) break;
    labels = nl;
    for (let c = 0; c < k; c++) {
      const members = embeddings.filter((_, i) => labels[i] === c);
      if (!members.length) continue;
      for (let d = 0; d < dim; d++) centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length;
    }
  }
  return { labels, centroids };
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
    return await getSubtopicVectors(supabase, followedTopics, personalizationId);
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
    const subtopicVecs = await getSubtopicVectors(supabase, followedTopics, personalizationId);
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
    let bucketStats = null;
    let subtopicOrder = [];

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
          // Load adaptive budget stats (separate query, graceful if columns don't exist yet)
          try {
            const { data: bsData } = await supabase
              .from('personalization_profiles')
              .select('trending_shown, trending_engaged, exploration_shown, exploration_engaged, subtopic_order')
              .eq('personalization_id', personalizationId)
              .single();
            if (bsData) {
              bucketStats = {
                trending_shown: bsData.trending_shown || 0,
                trending_engaged: bsData.trending_engaged || 0,
                exploration_shown: bsData.exploration_shown || 0,
                exploration_engaged: bsData.exploration_engaged || 0,
              };
              subtopicOrder = bsData.subtopic_order || [];
            }
          } catch (e) { /* columns not yet migrated — use defaults */ }
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
      bucketStats,
      subtopicOrder,
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
        personalizationId, userPhase, totalInteractions,
        bucketStats, subtopicOrder } = opts;
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
  // PER-SUBTOPIC PIPELINES — each interest gets its own retrieval
  // Cricket candidates never compete against Business candidates
  // ==========================================
  let personalPromise;
  let userQueryVectors = [];

  personalPromise = (async () => {
    const userFollowedTopics = userPrefs?.followed_topics || [];
    const queryVectors = await getQueryVectors(supabase, personalizationId, userFollowedTopics);
    userQueryVectors = queryVectors;

    if (queryVectors.length === 0) return { data: [], error: null, perSubtopic: {} };

    // Each query vector is one subtopic cluster. Group them by source subtopic.
    // getSubtopicVectors returns vectors with importance. Each vector = 1 entity cluster.
    // Run ANN per vector, keep results SEPARATE per vector index.
    const perVector = {};

    // Build a topic→category lookup from query vectors
    const vectorTopicMap = {}; // idx → subtopic category name
    for (let idx = 0; idx < queryVectors.length; idx++) {
      vectorTopicMap[idx] = queryVectors[idx]._subtopicCategory || ('unknown_' + idx);
    }

    // TAG-FILTERED RETRIEVAL: search by subtopic tags + ANN fallback
    // Each subtopic gets articles that ACTUALLY match its tags
    const perSubtopic = {};

    // Group query vectors by topic
    const topicVectors = {};
    for (let idx = 0; idx < queryVectors.length; idx++) {
      const topic = vectorTopicMap[idx];
      if (!topicVectors[topic]) topicVectors[topic] = [];
      topicVectors[topic].push(queryVectors[idx]);
    }

    // For each unique topic, find articles using tag filter + ANN
    const topicQueries = Object.entries(topicVectors).map(async ([topic, vectors]) => {
      const results = new Map();

      // Get tags for this entity category from ONBOARDING_TOPIC_MAP
      const subtopicTags = [];
      const subtopicCategories = [];
      for (const [topicName, mapping] of Object.entries(ONBOARDING_TOPIC_MAP)) {
        if (SUBTOPIC_TO_ENTITY_CATEGORY[topicName] === topic) {
          subtopicTags.push(...mapping.tags);
          subtopicCategories.push(...mapping.categories);
        }
      }
      const uniqueTags = [...new Set(subtopicTags)].slice(0, 10);
      const uniqueCats = [...new Set(subtopicCategories)];

      // PATH 1: Tag-filtered search (primary — most precise)
      if (uniqueTags.length > 0 && uniqueCats.length > 0) {
        const orFilter = uniqueTags.slice(0, 6).map(t => 'interest_tags.cs.["' + t + '"]').join(',');
        const { data: tagResults } = await supabase
          .from('published_articles')
          .select('id, ai_final_score, category, embedding_minilm')
          .or(orFilter)
          .in('category', uniqueCats)
          .not('embedding_minilm', 'is', null)
          .order('ai_final_score', { ascending: false })
          .limit(20);

        for (const a of (tagResults || [])) {
          if (excludeIds && excludeIds.includes(a.id)) continue;
          results.set(a.id, { id: a.id, similarity: 0.8, _source: 'tag_filtered' });
        }
      }

      // PATH 2: ANN search using cluster centroid (broader, catches related)
      if (results.size < 10 && vectors.length > 0) {
        const { data: annResults } = await supabase.rpc('match_articles_personal_minilm', {
          query_embedding: vectors[0].vector, match_count: 20,
          hours_window: 8760, exclude_ids: excludeIds, min_similarity: minSim,
        });

        for (const r of (annResults || [])) {
          if (!results.has(r.id)) {
            results.set(r.id, { ...r, _source: 'ann' });
          }
        }
      }

      // PATH 3: Title text search (fallback for missed articles)
      if (results.size < 5 && uniqueTags.length > 0) {
        const searchTag = uniqueTags[0];
        const { data: textResults } = await supabase
          .from('published_articles')
          .select('id, ai_final_score, category')
          .ilike('title_news', '%' + searchTag + '%')
          .not('embedding_minilm', 'is', null)
          .order('ai_final_score', { ascending: false })
          .limit(10);

        for (const a of (textResults || [])) {
          if (!results.has(a.id)) {
            results.set(a.id, { id: a.id, similarity: 0.6, _source: 'text' });
          }
        }
      }

      return { topic, results: [...results.values()].sort((a, b) => (b.similarity || 0) - (a.similarity || 0)) };
    });

    const topicResults = await Promise.all(topicQueries);

    for (const { topic, results } of topicResults) {
      perSubtopic[topic] = results;
    }

    // Also create merged pool for backward compat
    const allMerged = new Map();
    for (const [idx, articles] of Object.entries(perSubtopic)) {
      for (const a of articles) {
        a._cluster = parseInt(idx);
        const existing = allMerged.get(a.id);
        if (!existing || a.similarity > existing.similarity) allMerged.set(a.id, a);
      }
    }

    return {
      data: [...allMerged.values()].sort((a, b) => b.similarity - a.similarity),
      error: null,
      perSubtopic,
    };
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
  const perSubtopicResults = personalResult.perSubtopic || {};

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

  // Load skip embeddings for skip repulsion (last 50 skipped articles)
  let skipEmbeddings = [];
  if (personalizationId) {
    try {
      const { data: skipRows } = await supabase
        .from('engagement_buffer')
        .select('embedding_minilm')
        .eq('personalization_id', personalizationId)
        .lt('interaction_weight', 0)
        .order('created_at', { ascending: false })
        .limit(50);
      if (skipRows) {
        skipEmbeddings = skipRows
          .filter(r => r.embedding_minilm && Array.isArray(r.embedding_minilm))
          .map(r => r.embedding_minilm);
      }
    } catch (e) { /* no skip data */ }
  }

  // Compute session category counts (from articles already seen this session)
  const sessionCategoryCounts = {};
  if (sessionEngagedIds && sessionEngagedIds.length > 0) {
    for (const id of sessionEngagedIds) {
      const art = articleMap[id];
      if (art) sessionCategoryCounts[art.category] = (sessionCategoryCounts[art.category] || 0) + 1;
    }
  }

  // Personal: embedding-based scoring (V3 when available, else V2)
  const personalScored = personalIdOrder
    .filter(id => articleMap[id])
    .map(id => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      const score = personalizationId
        ? scoreArticleV3(article, similarity, entityAffinities, skipEmbeddings, sessionCategoryCounts)
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
  // Helper: compute skip penalty for any article
  function computeSkipPenalty(article) {
    if (skipEmbeddings.length === 0 || !article.embedding_minilm || !Array.isArray(article.embedding_minilm)) return 0;
    let maxSim = 0;
    for (const skipEmb of skipEmbeddings) {
      const sim = cosineSim(article.embedding_minilm, skipEmb);
      if (sim > maxSim) maxSim = sim;
    }
    return 0.3 * maxSim;
  }

  // Helper: compute saturation multiplier for any article
  function computeSaturation(article) {
    const catCount = sessionCategoryCounts[article.category] || 0;
    if (catCount === 0) return 1.0;
    if (catCount <= 2) return 0.85;
    if (catCount <= 4) return 0.6;
    if (catCount <= 6) return 0.3;
    return 0.1;
  }

  // Helper: best cluster similarity for an article
  function bestClusterSim(article) {
    if (userQueryVectors.length === 0 || !article.embedding_minilm || !Array.isArray(article.embedding_minilm)) return 0;
    let best = 0;
    for (const qv of userQueryVectors) {
      const sim = cosineSim(article.embedding_minilm, qv.vector);
      if (sim > best) best = sim;
    }
    return best;
  }

  // TRENDING: High quality articles, but if user skipped a similar trending topic → remove it
  // Skip repulsion hard-blocks trending articles too similar to skips (>0.7)
  const trendingScored = trendingArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
      const baseScore = (article.ai_final_score || 0) * recency;

      // Hard block: if article is very similar to skipped content, exclude from trending
      const skipPen = computeSkipPenalty(article);
      if (skipPen > 0.21) return null; // 0.3 × 0.7 = 0.21 → skip sim > 0.7 means hard block

      const satMult = computeSaturation(article);
      return {
        ...article,
        _score: (baseScore * (1 - skipPen)) * satMult,
        _bucket: 'trending',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);

  // Apply story dedup to trending pool
  const trendingDeduped = deduplicateStories(trendingScored);

  // DISCOVERY: "Nearby but new" — similarity 0.3-0.8 to user's interests
  // Expands interests without showing stuff they hate
  const discoveryScored = discoveryArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];

      // Compute similarity to user's interest clusters
      const clusterSim = bestClusterSim(article);

      // Sweet spot filter only when we have user vectors
      if (userQueryVectors.length > 0) {
        if (clusterSim > 0.8) return null; // too close — that's main feed territory
        if (clusterSim < 0.2) return null; // too far — random stuff
      }

      // Skip repulsion — discovery respects what they don't like
      const skipPen = computeSkipPenalty(article);
      if (skipPen > 0.21) return null; // too close to stuff they skip

      const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
      const satMult = computeSaturation(article);

      // Score: higher for the middle of the sweet spot (around 0.5 sim)
      const discoveryBoost = 1.0 - Math.abs(clusterSim - 0.5) * 2; // peaks at 0.5 sim
      return {
        ...article,
        _score: (article.ai_final_score || 0) * recency * (1 + discoveryBoost) * (1 - skipPen) * satMult,
        _bucket: 'discovery',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);

  // Apply story dedup to discovery pool
  const discoveryDeduped = deduplicateStories(discoveryScored);

  // ==========================================
  // STORY DEDUPLICATION — group similar articles about the same event
  // Uses embedding similarity + entity overlap + temporal proximity
  // Keeps only the best article per story cluster in each pool
  // ==========================================
  function deduplicateStories(articles) {
    if (articles.length <= 1) return articles;

    const clusters = []; // [{representative, members}]

    for (const article of articles) {
      const emb = article.embedding_minilm;
      const tags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
      const pubTime = new Date(article.created_at).getTime();

      let bestCluster = null;
      let bestScore = 0;

      for (const cluster of clusters) {
        const rep = cluster.representative;
        const repEmb = rep.embedding_minilm;

        // Embedding similarity
        let embSim = 0;
        if (emb && repEmb && Array.isArray(emb) && Array.isArray(repEmb)) {
          embSim = cosineSim(emb, repEmb);
        }

        // Entity/tag overlap
        const repTags = safeJsonParse(rep.interest_tags, []).map(t => t.toLowerCase());
        const tagOverlap = tags.length > 0
          ? tags.filter(t => repTags.includes(t)).length / Math.max(tags.length, 1)
          : 0;

        // Temporal proximity (within 48h)
        const repTime = new Date(rep.created_at).getTime();
        const hoursApart = Math.abs(pubTime - repTime) / 3600000;
        const temporalScore = Math.max(0, 1.0 - hoursApart / 48);

        // Combined story match score
        const matchScore = 0.35 * embSim + 0.35 * tagOverlap + 0.30 * temporalScore;

        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestCluster = cluster;
        }
      }

      const STORY_THRESHOLD = 0.55;
      if (bestCluster && bestScore > STORY_THRESHOLD) {
        // Same story — keep the higher scored article as representative
        if ((article._score || 0) > (bestCluster.representative._score || 0)) {
          bestCluster.representative = article;
        }
        bestCluster.members.push(article);
      } else {
        // New story cluster
        clusters.push({ representative: article, members: [article] });
      }
    }

    return clusters.map(c => c.representative);
  }

  // Apply story dedup to each pool
  const personalDedupedMap = {};
  for (const [topic, articles] of Object.entries(perSubtopicResults)) {
    const deduped = deduplicateStories(
      (articles || []).filter(r => articleMap[r.id]).map(r => ({
        ...articleMap[r.id],
        _similarity: r.similarity || 0,
      }))
    );
    personalDedupedMap[topic] = deduped.map(a => ({ id: a.id, similarity: a._similarity || 0.8 }));
  }

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
  // V23: CATEGORY CAPS + GUARANTEED INTEREST SLOTS + SLOT PATTERN
  // ==========================================

  // Determine which ARTICLE categories the user selected
  // Maps subtopic selections to the actual article categories in the database
  const SUBTOPIC_TO_ARTICLE_CATEGORIES = {
    'War & Conflict': ['World','Politics'], 'Middle East': ['World','Politics'],
    'US Politics': ['Politics','World'], 'European Politics': ['Politics','World'],
    'Asian Politics': ['World','Politics'], 'Latin America': ['World'],
    'Africa & Oceania': ['World'], 'Human Rights & Civil Liberties': ['Politics','World'],
    'NBA': ['Sports'], 'NFL': ['Sports'], 'Soccer/Football': ['Sports'],
    'Cricket': ['Sports'], 'MLB/Baseball': ['Sports'], 'F1 & Motorsport': ['Sports'],
    'Boxing & MMA/UFC': ['Sports'], 'Olympics & Paralympics': ['Sports'],
    'Movies & Film': ['Entertainment'], 'TV & Streaming': ['Entertainment'],
    'Music': ['Entertainment'], 'Gaming': ['Entertainment','Tech'],
    'Celebrity News': ['Entertainment'], 'K-Pop & K-Drama': ['Entertainment'],
    'AI & Machine Learning': ['Tech'], 'Smartphones & Gadgets': ['Tech'],
    'Cybersecurity': ['Tech'], 'Space Tech': ['Tech','Science'],
    'Robotics & Hardware': ['Tech'], 'Social Media': ['Tech'],
    'Space & Astronomy': ['Science'], 'Climate & Environment': ['Science'],
    'Biology & Nature': ['Science'], 'Earth Science': ['Science'],
    'Medical Breakthroughs': ['Health'], 'Public Health': ['Health'],
    'Mental Health': ['Health'], 'Pharma & Drug Industry': ['Health'],
    'Stock Markets': ['Finance','Business'], 'Banking & Lending': ['Finance'],
    'Commodities': ['Finance','Business'], 'Oil & Energy': ['Business'],
    'Automotive': ['Business'], 'Retail & Consumer': ['Business'],
    'Corporate Deals': ['Business'], 'Trade & Tariffs': ['Business'],
    'Corporate Earnings': ['Business'], 'Startups & Venture Capital': ['Business'],
    'Real Estate': ['Business'], 'Bitcoin': ['Crypto','Finance'],
    'DeFi & Web3': ['Crypto','Finance'], 'Crypto Regulation & Legal': ['Crypto'],
    'Sneakers & Streetwear': ['Fashion','Lifestyle'], 'Celebrity Style & Red Carpet': ['Fashion'],
    'Food & Cooking': ['Food'], 'Travel & Adventure': ['Travel'],
    'Pets & Animals': ['Lifestyle'],
  };

  const userSelectedCategories = new Set();
  const userTopics = userPrefs?.followed_topics || [];
  for (const topic of userTopics) {
    const cats = SUBTOPIC_TO_ARTICLE_CATEGORIES[topic];
    if (cats) cats.forEach(c => userSelectedCategories.add(c));
  }

  // HARD CATEGORY CAPS — only applies when user has selected topics
  function applyCategoryCaps(articles, maxPerBatch) {
    // If no topics selected (anonymous user), no caps
    if (userSelectedCategories.size === 0) return articles;

    const caps = {};
    const defaultCap = Math.max(3, Math.round(maxPerBatch * 0.15));

    for (const cat of ['World', 'Politics', 'Sports', 'Entertainment', 'Tech', 'Business', 'Finance', 'Science', 'Health', 'Lifestyle', 'Food', 'Fashion']) {
      if (userSelectedCategories.has(cat)) {
        caps[cat] = Math.round(maxPerBatch * 0.30);
      } else {
        caps[cat] = Math.round(maxPerBatch * 0.10);
      }
    }

    const catCounts = {};
    return articles.filter(a => {
      const cat = a.category || 'Other';
      const count = catCounts[cat] || 0;
      const cap = caps[cat] || defaultCap;
      if (count >= cap) return false;
      catCounts[cat] = count + 1;
      return true;
    });
  }

  // ==========================================
  // PER-SUBTOPIC QUOTA SELECTION
  // Each interest fills its own slots. Cricket never competes with Business.
  // ==========================================

  // ==========================================
  // ADAPTIVE BUDGET ALLOCATION
  // Shrinks trending/exploration when they don't work for this user.
  // Recovered slots go to personal content.
  // ==========================================
  const TOTAL_FEED_SLOTS = 26;
  const CS_BUDGET = 2; // cold-start always 2
  let TRENDING_BUDGET, EXPLORE_BUDGET, PERSONAL_BUDGET;

  if (!bucketStats || (bucketStats.trending_shown + bucketStats.exploration_shown) < 10) {
    // New user or insufficient data: fixed ratio for testing
    TRENDING_BUDGET = 4;
    EXPLORE_BUDGET = 4;
  } else {
    // Calculate engagement rates per bucket
    const tRate = bucketStats.trending_shown > 0
      ? bucketStats.trending_engaged / bucketStats.trending_shown : 0;
    const eRate = bucketStats.exploration_shown > 0
      ? bucketStats.exploration_engaged / bucketStats.exploration_shown : 0;

    // Scale slots with engagement — if it doesn't work, shrink it
    // 30%+ engagement → 4 slots (full), 15% → 2 slots, 0% → 1 slot (minimum)
    TRENDING_BUDGET = Math.max(1, Math.min(4, Math.round(4 * (tRate / 0.30))));
    EXPLORE_BUDGET = Math.max(1, Math.min(4, Math.round(4 * (eRate / 0.25))));
  }
  PERSONAL_BUDGET = TOTAL_FEED_SLOTS - TRENDING_BUDGET - EXPLORE_BUDGET;
  const MIN_PER_SUBTOPIC = 1;

  // Allocate personal slots per SUBTOPIC GROUP (not per vector index)
  // Vector indices 0-2 might all be Cricket clusters → group them as one subtopic
  const pSelected = [];
  const usedArticleIds = new Set();

  // Use story-deduplicated personal map (falls back to original if dedup produced nothing)
  const effectiveSubtopicResults = Object.keys(personalDedupedMap).length > 0 ? personalDedupedMap : perSubtopicResults;
  const subtopicNames = Object.keys(effectiveSubtopicResults);

  if (subtopicNames.length > 0) {
    const maxSubtopics = Math.floor(PERSONAL_BUDGET / Math.max(MIN_PER_SUBTOPIC, 1));
    const activeSubtopics = subtopicNames.slice(0, maxSubtopics);

    // Build pools per topic, with World filtering for non-World users
    const WORLD_ENTITY_CATS = new Set(['World Politics']);
    const userSelectedWorld = activeSubtopics.some(t => WORLD_ENTITY_CATS.has(t));

    const subtopicPools = {};
    for (const topic of activeSubtopics) {
      let pool = effectiveSubtopicResults[topic] || [];

      // If user didn't select World topics AND this isn't a World subtopic,
      // remove World-category articles that snuck through tag overlap
      if (!userSelectedWorld && !WORLD_ENTITY_CATS.has(topic)) {
        pool = pool.filter(r => {
          const art = articleMap[r.id];
          return !art || art.category !== 'World';
        });
      }

      subtopicPools[topic] = pool;
    }

    // ==========================================
    // TWO-PHASE WEIGHTED SUBTOPIC ALLOCATION
    // Phase A (session 1): weight by onboarding order + category concentration
    // Phase B (session 2+): weight by actual engagement rates
    // ==========================================
    const quotas = {};
    let remaining = PERSONAL_BUDGET;

    // Load subtopic engagement stats if available (graceful if table not yet created)
    let subtopicEngStats = {};
    if (personalizationId) {
      try {
        const { data: sstats, error: ssErr } = await supabase
          .from('user_subtopic_stats')
          .select('subtopic_name, times_shown, times_engaged')
          .eq('personalization_id', personalizationId);
        if (!ssErr) {
          for (const s of (sstats || [])) {
            subtopicEngStats[s.subtopic_name] = s;
          }
        }
      } catch (e) { /* table not yet migrated */ }
    }

    const hasSubtopicHistory = Object.keys(subtopicEngStats).length > 0 &&
      Object.values(subtopicEngStats).some(s => s.times_shown >= 3);

    if (!hasSubtopicHistory) {
      // PHASE A: Use onboarding order + category concentration
      // Earlier picks = stronger interests, more picks in same category = higher weight
      const userTopicsList = subtopicOrder.length > 0 ? subtopicOrder : (userPrefs?.followed_topics || []);

      // Count subtopics per parent category for concentration signal
      const categoryCount = {};
      for (const topic of userTopicsList) {
        const cats = SUBTOPIC_TO_ARTICLE_CATEGORIES[topic] || [];
        for (const cat of cats) {
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        }
      }
      const totalUserTopics = userTopicsList.length || 1;

      const weights = {};
      for (let i = 0; i < activeSubtopics.length; i++) {
        const topic = activeSubtopics[i];
        // Find order position in user's original selection
        const orderIdx = userTopicsList.findIndex(t =>
          (SUBTOPIC_TO_ENTITY_CATEGORY[t] || '').toLowerCase() === topic.toLowerCase() || t === topic
        );
        const orderWeight = orderIdx >= 0 ? (1.0 - orderIdx * 0.05) : 0.5;

        // Category concentration weight
        const topicCats = SUBTOPIC_TO_ARTICLE_CATEGORIES[
          userTopicsList.find(t => (SUBTOPIC_TO_ENTITY_CATEGORY[t] || '') === topic) || topic
        ] || [];
        const concWeight = topicCats.reduce((max, cat) =>
          Math.max(max, (categoryCount[cat] || 0) / totalUserTopics), 0
        );

        weights[topic] = Math.max(0.1, orderWeight + concWeight);
      }

      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
      for (const topic of activeSubtopics) {
        const raw = (weights[topic] / totalWeight) * PERSONAL_BUDGET;
        quotas[topic] = Math.max(MIN_PER_SUBTOPIC, Math.min(Math.round(raw), remaining));
        remaining -= quotas[topic];
      }
    } else {
      // PHASE B: Rebalance by actual engagement data
      const weights = {};
      for (const topic of activeSubtopics) {
        const stat = subtopicEngStats[topic];
        if (!stat || stat.times_shown === 0) {
          weights[topic] = 0.5; // untested, neutral — give it a chance
        } else {
          const rate = stat.times_engaged / stat.times_shown;
          const volume = Math.min(stat.times_engaged || 0, 10);
          weights[topic] = rate + (0.1 * volume);
        }
      }

      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
      for (const topic of activeSubtopics) {
        const raw = (weights[topic] / totalWeight) * PERSONAL_BUDGET;
        quotas[topic] = Math.max(MIN_PER_SUBTOPIC, Math.min(Math.round(raw), remaining));
        remaining -= quotas[topic];
      }
    }

    // Distribute leftover to highest-weighted subtopics with available articles
    while (remaining > 0) {
      let distributed = false;
      // Sort by weight descending to give extras to strongest interests
      const byWeight = [...activeSubtopics].sort((a, b) =>
        (subtopicPools[b]?.length || 0) - (subtopicPools[a]?.length || 0)
      );
      for (const topic of byWeight) {
        if (remaining <= 0) break;
        if ((subtopicPools[topic]?.length || 0) > quotas[topic]) {
          quotas[topic]++;
          remaining--;
          distributed = true;
        }
      }
      if (!distributed) break;
    }

    // Score articles within each subtopic pool
    const subtopicQueues = {};
    for (const topic of activeSubtopics) {
      const candidates = (subtopicPools[topic] || [])
        .filter(r => articleMap[r.id])
        .map(r => {
          const article = articleMap[r.id];
          const similarity = r.similarity || 0;
          return {
            ...article,
            _score: personalizationId
              ? scoreArticleV3(article, similarity, entityAffinities, skipEmbeddings, sessionCategoryCounts)
              : scoreEmbedding(article, similarity, sessionVector, skipProfile),
            _similarity: similarity,
            _bucket: 'personal',
            _subtopicName: topic,
          };
        })
        .sort((a, b) => b._score - a._score);
      subtopicQueues[topic] = candidates;
    }

    // Round-robin selection across subtopics
    const maxRounds = Math.max(...Object.values(quotas));
    for (let round = 0; round < maxRounds; round++) {
      for (const topic of activeSubtopics) {
        if (round >= (quotas[topic] || 0)) continue;
        const queue = subtopicQueues[topic];
        // Find next unused article
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (!usedArticleIds.has(candidate.id)) {
            candidate.bucket = 'personal';
            pSelected.push(candidate);
            usedArticleIds.add(candidate.id);
            break;
          }
        }
      }
    }
  } else {
    // Fallback: no per-subtopic data, use merged pool
    const pPool = applyCategoryCaps([...personalScored], 18);
    for (let i = 0; i < 18 && pPool.length > 0; i++) {
      const picked = mmrSelectDeduped(pPool, pSelected, 0.7);
      if (!picked) break;
      picked.bucket = 'personal';
      pSelected.push(picked);
    }
  }

  // PERSONALIZED TRENDING: blend global trending score with user relevance
  // Also suppresses categories user consistently skips
  const suppressedCategories = new Set();
  if (bucketStats && bucketStats.trending_shown >= 10) {
    // Build category skip history from session data
    for (const a of trendingScored) {
      if (!userSelectedCategories.has(a.category) && a.category !== 'Other') {
        // If user never selected this category AND trending is low-engagement, suppress it
        suppressedCategories.add(a.category);
      }
    }
    // Don't suppress user-selected categories
    for (const cat of userSelectedCategories) suppressedCategories.delete(cat);
  }

  const personalizedTrending = trendingDeduped
    .filter(a => !suppressedCategories.has(a.category))
    .map(a => {
      const trendScore = a._score || 0;
      // Personal relevance from entity affinities
      let personalScore = 0;
      if (entityAffinities && Object.keys(entityAffinities).length > 0) {
        const tags = safeJsonParse(a.interest_tags, []);
        const maxAff = Math.max(1, ...Object.values(entityAffinities));
        for (const tag of tags) {
          const aff = entityAffinities[tag.toLowerCase()];
          if (aff && aff > 0) personalScore = Math.max(personalScore, aff / maxAff);
        }
      }
      // Blend: 50% trending importance + 50% personal relevance
      const blendedScore = 0.50 * (trendScore / Math.max(1, trendingDeduped[0]?._score || 1)) + 0.50 * personalScore;
      return { ...a, _trendBlend: blendedScore };
    })
    .sort((a, b) => b._trendBlend - a._trendBlend);

  const tSelected = [];
  const trendingCats = new Set();
  for (const article of personalizedTrending) {
    if (tSelected.length >= TRENDING_BUDGET) break;
    if (trendingCats.has(article.category)) continue; // max 1 per category
    if (usedArticleIds.has(article.id)) continue;
    article.bucket = 'trending';
    tSelected.push(article);
    trendingCats.add(article.category);
    usedArticleIds.add(article.id);
  }

  // EXPLORATION: category-diverse, suppress categories user doesn't engage with
  const dPool = discoveryDeduped
    .filter(a => !suppressedCategories.has(a.category));
  const eSelected = [];
  const exploreCats = new Set();
  for (const article of dPool) {
    if (eSelected.length >= EXPLORE_BUDGET) break;
    if (exploreCats.has(article.category)) continue;
    if (usedArticleIds.has(article.id)) continue;
    article.bucket = 'exploration';
    eSelected.push(article);
    exploreCats.add(article.category);
    usedArticleIds.add(article.id);
  }

  const csSelected = dPool.filter(a => !usedArticleIds.has(a.id)).slice(0, CS_BUDGET).map(a => ({ ...a, bucket: 'cold-start' }));

  // Step 2: Build DYNAMIC slot pattern based on adaptive budgets
  // Personal slots dominate, with trending/exploration/cold-start distributed evenly
  const totalSlots = PERSONAL_BUDGET + TRENDING_BUDGET + EXPLORE_BUDGET + CS_BUDGET;
  const dynamicSlots = [];
  let pRemain = PERSONAL_BUDGET, tRemain = TRENDING_BUDGET, eRemain = EXPLORE_BUDGET, csRemain = CS_BUDGET;

  // Distribute: every ~5 personal slots, insert 1 trending or exploration
  let nonPersonalQueue = [];
  for (let i = 0; i < TRENDING_BUDGET; i++) nonPersonalQueue.push('T');
  for (let i = 0; i < EXPLORE_BUDGET; i++) nonPersonalQueue.push('E');
  for (let i = 0; i < CS_BUDGET; i++) nonPersonalQueue.push('CS');

  const pInterval = PERSONAL_BUDGET > 0 ? Math.max(2, Math.floor(PERSONAL_BUDGET / (nonPersonalQueue.length + 1))) : 2;
  let pCount = 0;
  let npIdx = 0;
  for (let i = 0; i < totalSlots; i++) {
    if (pCount >= pInterval && npIdx < nonPersonalQueue.length) {
      dynamicSlots.push(nonPersonalQueue[npIdx++]);
      pCount = 0;
    } else if (pRemain > 0) {
      dynamicSlots.push('P');
      pRemain--;
      pCount++;
    } else if (npIdx < nonPersonalQueue.length) {
      dynamicSlots.push(nonPersonalQueue[npIdx++]);
    }
  }
  // Append any remaining non-personal
  while (npIdx < nonPersonalQueue.length) dynamicSlots.push(nonPersonalQueue[npIdx++]);

  const selected = [];
  let pI = 0, tI = 0, eI = 0, csI = 0;

  for (let pos = 0; pos < Math.min(dynamicSlots.length, limit); pos++) {
    const slot = dynamicSlots[pos];
    let picked = null;

    if (slot === 'P' && pI < pSelected.length) picked = pSelected[pI++];
    else if (slot === 'T' && tI < tSelected.length) picked = tSelected[tI++];
    else if (slot === 'E' && eI < eSelected.length) picked = eSelected[eI++];
    else if (slot === 'CS' && csI < csSelected.length) picked = csSelected[csI++];

    if (!picked) {
      // Fallback to personal if slot empty
      if (pI < pSelected.length) picked = pSelected[pI++];
      else if (tI < tSelected.length) picked = tSelected[tI++];
      else if (eI < eSelected.length) picked = eSelected[eI++];
    }

    if (picked) selected.push(picked);
  }

  // FALLBACK: if all pools empty (anonymous user, no personalization), serve raw trending+discovery
  if (selected.length === 0) {
    const fallbackArticles = [...(trendingResult.data || []), ...(discoveryResult.data || [])]
      .filter(a => articleMap[a.id])
      .map(a => ({ ...articleMap[a.id], bucket: 'trending', _score: articleMap[a.id]?.ai_final_score || 0 }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);
    selected.push(...fallbackArticles);
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
    if (a._subtopicName) formatted.subtopic_name = a._subtopicName;
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
    _v: 'v14',
  });
}

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
// ONBOARDING TOPIC → CATEGORY MAPPING
// Maps user-selected onboarding topics to DB categories + interest_tags.
// altCategories provides fallback categories for niche topics.
// ==========================================

const ONBOARDING_TOPIC_MAP = {
  // ── Politics (8) ──
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'republican party', 'supreme court', 'pentagon'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'germany', 'france', 'uk', 'hungary', 'spain'] },
  'Asian Politics':              { categories: ['Politics'], tags: ['asian politics', 'china', 'india', 'japan', 'southeast asia', 'asean', 'asia', 'north korea', 'taiwan'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz'] },
  'Latin America':               { categories: ['Politics'], tags: ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba'] },
  'Africa & Oceania':            { categories: ['Politics'], tags: ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes'] },

  // ── Sports (8) ──
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'dunk', 'playoffs'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup'] },
  'MLB/Baseball':                { categories: ['Sports'], tags: ['mlb', 'baseball', 'world series', 'home run', 'pitcher'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout'] },
  'Olympics & Paralympics':      { categories: ['Sports'], tags: ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc', 'olympic'] },

  // ── Business (8) ──
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'energy security', 'nuclear energy'] },
  'Automotive':                  { categories: ['Business'], tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Corporate Deals':             { categories: ['Business'], tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },

  // ── Entertainment (6) ──
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'paparazzi', 'star', 'billionaire'] },
  'K-Pop & K-Drama':             { categories: ['Entertainment'], tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'] },

  // ── Tech (6) ──
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Social Media':                { categories: ['Tech'], tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin', 'space exploration'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor'] },

  // ── Science (4) ──
  'Space & Astronomy':           { categories: ['Science'], tags: ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Earth Science':               { categories: ['Science'], tags: ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'] },

  // ── Health (4) ──
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'drug', 'fda', 'medication', 'biotech', 'pharmaceuticals'] },

  // ── Finance (3) ──
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },

  // ── Crypto (3) ──
  'Bitcoin':                     { categories: ['Finance', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized'] },
  'Crypto Regulation & Legal':   { categories: ['Finance', 'Tech'], tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'] },

  // ── Lifestyle (3) ──
  'Pets & Animals':              { categories: ['Lifestyle'], tags: ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'] },
  'Home & Garden':               { categories: ['Lifestyle'], tags: ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },

  // ── Fashion (2) ──
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
};

// ==========================================
// APP TOPIC ID → ONBOARDING_TOPIC_MAP KEYS
// The iOS app saves short topic IDs (e.g., "ai", "sports", "f1").
// This maps them to the full ONBOARDING_TOPIC_MAP keys so interest
// matching actually works for real app users.
// ==========================================

const APP_TOPIC_ALIAS = {
  // ── Broad category aliases (old Topics.all IDs) ──
  'politics':       ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Latin America', 'Africa & Oceania'],
  'ai':             ['AI & Machine Learning'],
  'science':        ['Space & Astronomy', 'Climate & Environment', 'Biology & Nature', 'Earth Science'],
  'sports':         ['NFL', 'NBA', 'Soccer/Football', 'MLB/Baseball', 'Cricket', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'Olympics & Paralympics'],
  'f1':             ['F1 & Motorsport'],
  'startups':       ['Startups & Venture Capital'],
  'technology':     ['AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity', 'Space Tech', 'Robotics & Hardware'],
  'entertainment':  ['Movies & Film', 'TV & Streaming', 'Music', 'Gaming', 'Celebrity News', 'K-Pop & K-Drama'],
  'finance':        ['Stock Markets', 'Banking & Lending', 'Commodities'],
  'crypto':         ['Bitcoin', 'DeFi & Web3', 'Crypto Regulation & Legal'],
  'health':         ['Medical Breakthroughs', 'Public Health', 'Mental Health', 'Pharma & Drug Industry'],
  'business':       ['Oil & Energy', 'Automotive', 'Retail & Consumer', 'Corporate Deals', 'Trade & Tariffs', 'Corporate Earnings', 'Startups & Venture Capital', 'Real Estate'],
  'economy':        ['Corporate Earnings', 'Stock Markets', 'Banking & Lending', 'Trade & Tariffs'],
  'defense':        ['War & Conflict'],
  'diplomacy':      ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Human Rights & Civil Liberties'],
  'energy':         ['Oil & Energy'],
  'space':          ['Space & Astronomy', 'Space Tech'],
  'cybersecurity':  ['Cybersecurity'],
  'trade':          ['Trade & Tariffs'],
  'climate':        ['Climate & Environment'],
  'human_rights':   ['Human Rights & Civil Liberties'],
  'conflict':       ['War & Conflict'],
  'environment':    ['Climate & Environment', 'Biology & Nature'],
  'transportation': ['Automotive', 'F1 & Motorsport'],
  'culture':        ['K-Pop & K-Drama', 'Celebrity Style & Red Carpet'],
  'law':            ['Crypto Regulation & Legal'],
  'disaster':       ['Earth Science'],
  'infrastructure': ['Real Estate'],
  // ── App subtopic IDs (TopicCategories.all subtopic .id values) ──
  // Politics subtopics
  'war_conflict':       ['War & Conflict'],
  'us_politics':        ['US Politics'],
  'european_politics':  ['European Politics'],
  'asian_politics':     ['Asian Politics'],
  'middle_east':        ['Middle East'],
  'latin_america':      ['Latin America'],
  'africa_oceania':     ['Africa & Oceania'],
  // Sports subtopics
  'nfl':                ['NFL'],
  'nba':                ['NBA'],
  'soccer':             ['Soccer/Football'],
  'baseball':           ['MLB/Baseball'],
  'cricket':            ['Cricket'],
  'f1_motorsport':      ['F1 & Motorsport'],
  'boxing_mma':         ['Boxing & MMA/UFC'],
  'olympics':           ['Olympics & Paralympics'],
  // Business subtopics
  'oil_energy':         ['Oil & Energy'],
  'automotive':         ['Automotive'],
  'retail_consumer':    ['Retail & Consumer'],
  'corporate_deals':    ['Corporate Deals'],
  'trade_tariffs':      ['Trade & Tariffs'],
  'corporate_earnings': ['Corporate Earnings'],
  'startups_vc':        ['Startups & Venture Capital'],
  'real_estate':        ['Real Estate'],
  // Entertainment subtopics
  'movies_film':        ['Movies & Film'],
  'tv_streaming':       ['TV & Streaming'],
  'music':              ['Music'],
  'gaming':             ['Gaming'],
  'celebrity_news':     ['Celebrity News'],
  'kpop_kdrama':        ['K-Pop & K-Drama'],
  // Tech subtopics
  'ai_ml':              ['AI & Machine Learning'],
  'smartphones_gadgets': ['Smartphones & Gadgets'],
  'social_media':       ['Social Media'],
  'space_tech':         ['Space Tech'],
  'robotics_hardware':  ['Robotics & Hardware'],
  // Science subtopics
  'space_astronomy':    ['Space & Astronomy'],
  'climate_environment': ['Climate & Environment'],
  'biology_nature':     ['Biology & Nature'],
  'earth_science':      ['Earth Science'],
  // Health subtopics
  'medical_breakthroughs': ['Medical Breakthroughs'],
  'public_health':      ['Public Health'],
  'mental_health':      ['Mental Health'],
  'pharma_drugs':       ['Pharma & Drug Industry'],
  // Finance subtopics
  'stock_markets':      ['Stock Markets'],
  'banking_lending':    ['Banking & Lending'],
  'commodities':        ['Commodities'],
  // Crypto subtopics
  'bitcoin':            ['Bitcoin'],
  'defi_web3':          ['DeFi & Web3'],
  'crypto_regulation':  ['Crypto Regulation & Legal'],
  // Lifestyle subtopics
  'pets_animals':       ['Pets & Animals'],
  'home_garden':        ['Home & Garden'],
  'shopping_reviews':   ['Shopping & Product Reviews'],
  // Fashion subtopics
  'sneakers_streetwear': ['Sneakers & Streetwear'],
  'celebrity_style':    ['Celebrity Style & Red Carpet'],
};

// ==========================================
// REVERSE LOOKUP: Category → Subtopics
// When users select broad categories (e.g., "Entertainment", "Sports")
// instead of specific subtopics (e.g., "Gaming", "NBA"), this maps
// the category to all its subtopics so we can still find relevant content.
// ==========================================

const CATEGORY_TO_SUBTOPICS = {};
for (const [topicName, mapping] of Object.entries(ONBOARDING_TOPIC_MAP)) {
  for (const cat of mapping.categories) {
    if (!CATEGORY_TO_SUBTOPICS[cat]) CATEGORY_TO_SUBTOPICS[cat] = [];
    CATEGORY_TO_SUBTOPICS[cat].push({ name: topicName, tags: mapping.tags });
  }
}

// ==========================================
// ARTICLE FORMATTING (unchanged from before)
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
// RECENCY DECAY (shelf-life-aware)
// Articles decay relative to their own shelf_life_days.
// Breaking news (1-2d) dies fast. Evergreen (30-90d) stays discoverable.
// ==========================================

function getRecencyDecay(createdAt, category, shelfLifeDays) {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const shelfLifeHours = (shelfLifeDays || 7) * 24;
  const freshnessMultiplier = Math.exp(-ageHours / shelfLifeHours);
  // Blend: 70% freshness decay, 30% baseline.
  // shelf_life_days handles per-vertical tuning:
  //   Breaking news (1-2d): dies fast after ~24h
  //   Explainers (14-30d): gradual decline over weeks
  //   Evergreen (60d+): stays discoverable for months
  return freshnessMultiplier * 0.7 + 0.3;
}

// ==========================================
// USER INTEREST PROFILE (entity-level tag weights from engagement history)
// ==========================================

async function buildUserInterestProfile(supabase, userId) {
  // Get article IDs the user engaged with in the last 14 days
  // IMPROVEMENT 2: Also fetch view_seconds for dwell-time weighting
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from('user_article_events')
    .select('article_id, event_type, metadata')
    .eq('user_id', userId)
    .gte('created_at', twoWeeksAgo)
    .in('event_type', ['article_saved', 'article_engaged', 'article_detail_view'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!events || events.length === 0) return null;

  // Weight by engagement type: saved > engaged > viewed
  // IMPROVEMENT 2: Dwell time amplifies weight (log-scaled)
  const eventWeights = { article_saved: 3, article_engaged: 2, article_detail_view: 1 };
  const articleWeights = {};
  for (const e of events) {
    let w = eventWeights[e.event_type] || 1;
    // Extract dwell time from metadata
    const dwellSeconds = e.metadata?.dwell ? parseFloat(e.metadata.dwell) :
                         e.metadata?.total_active_seconds ? parseFloat(e.metadata.total_active_seconds) : 0;
    if (dwellSeconds > 5) {
      // 10s → 1.0x bonus, 20s → 2.0x, 60s → 3.58x
      w *= (1 + Math.log2(dwellSeconds / 5));
    }
    articleWeights[e.article_id] = Math.max(articleWeights[e.article_id] || 0, w);
  }

  const articleIds = Object.keys(articleWeights).map(Number).filter(Boolean);
  if (articleIds.length === 0) return null;

  // Fetch interest_tags for engaged articles (batch)
  let allTags = [];
  for (let i = 0; i < articleIds.length; i += 300) {
    const batch = articleIds.slice(i, i + 300);
    const { data } = await supabase
      .from('published_articles')
      .select('id, interest_tags')
      .in('id', batch);
    if (data) allTags = allTags.concat(data);
  }

  // Build weighted tag frequency map
  const tagScores = {};
  for (const article of allTags) {
    const tags = safeJsonParse(article.interest_tags, []);
    const weight = articleWeights[article.id] || 1;
    for (const tag of tags) {
      const t = tag.toLowerCase();
      tagScores[t] = (tagScores[t] || 0) + weight;
    }
  }

  // Normalize: divide by max score so top tag = 1.0
  const maxScore = Math.max(...Object.values(tagScores), 1);
  const profile = {};
  for (const [tag, score] of Object.entries(tagScores)) {
    profile[tag] = score / maxScore;
  }

  return profile;
}

// ==========================================
// SESSION MOMENTUM (streak detection + short-term boosts)
// ==========================================

async function computeSessionMomentum(supabase, engagedIds, skippedIds) {
  const boosts = {};
  const skipPenalties = {};
  const streakTags = new Set();

  if (engagedIds.length > 0) {
    const { data: engagedArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .in('id', engagedIds.slice(0, 30));

    // Count tag frequency across session-engaged articles
    const tagFreq = {};
    for (const a of (engagedArticles || [])) {
      const tags = safeJsonParse(a.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      }
    }

    // Streak detection: 3+ articles with same tag = strong momentum
    for (const [tag, count] of Object.entries(tagFreq)) {
      if (count >= 3) {
        boosts[tag] = 0.5;
        streakTags.add(tag);
      } else if (count >= 2) {
        boosts[tag] = 0.3;
      } else {
        boosts[tag] = 0.15;
      }
    }
  }

  if (skippedIds.length > 0) {
    const { data: skippedArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .in('id', skippedIds.slice(0, 30));

    for (const a of (skippedArticles || [])) {
      const tags = safeJsonParse(a.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        skipPenalties[t] = (skipPenalties[t] || 0) + 0.15;
      }
    }
  }

  return { boosts, skipPenalties, streakTags };
}

// ==========================================
// SCORING V3: Entity-level + session momentum + skip penalty
// ==========================================

// ==========================================
// UNIFIED PER-USER SCORING FUNCTION
// One coherent score: "how likely is THIS user to engage with THIS article?"
// Used within each pool — pools provide structural diversity, this provides ranking.
//
// Formula: categoryAffinity * 0.25 + tagOverlap * 0.30 + tasteSimilarity * 0.25
//          + freshness * 0.10 + globalPopularity * 0.10 - skipPenalty
//
// tasteSimilarity = cosine to nearest cluster vector (multi-interest) or
// single taste_vector for users without clusters yet.
// ==========================================

function scoreUnified(article, opts) {
  const {
    tagProfile = {}, skipProfile = null, sessionBoosts = {},
    similarity = 0, categoryProfile = {}, personalCategories = new Set(),
    topicSaturation = {}, discoveryStats = {},
    isDiscovery = false, isHoldback = false,
  } = opts;

  const tags = safeJsonParse(article.interest_tags, []);
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const aiScore = Math.min((article.ai_final_score || 0) / 1000, 1.0); // normalize 0-1
  const n = Math.max(tags.length, 1);
  const cat = article.category || 'Other';

  // 1. CATEGORY AFFINITY (0.25) — from engagement rate data
  let categoryAffinity = 0.5; // neutral default
  if (!isHoldback && categoryProfile[cat] && categoryProfile[cat].shown >= 2) {
    categoryAffinity = categoryProfile[cat].engaged / categoryProfile[cat].shown;
  }
  // Discovery boost: unfamiliar categories score higher
  if (isDiscovery) {
    categoryAffinity = personalCategories.has(cat) ? 0.3 : 0.8;
    // Change 5: Learned discovery preferences — blend surprise with tag-level affinity
    if (!isHoldback && discoveryStats._tags) {
      let discoveryTagAffinity = 0;
      let discoveryTagCount = 0;
      for (const tag of tags) {
        const t = tag.toLowerCase();
        const tagStat = discoveryStats._tags[t];
        if (tagStat && tagStat.shown >= 3) {
          discoveryTagAffinity += tagStat.engaged / tagStat.shown;
          discoveryTagCount++;
        }
      }
      if (discoveryTagCount > 0) {
        const learnedScore = discoveryTagAffinity / discoveryTagCount;
        categoryAffinity = categoryAffinity * 0.5 + learnedScore * 0.5;
      }
    }
  }

  // 2. TAG OVERLAP (0.30) — entity-level matching
  // Use sum of matched tag weights divided by matched count (not total tags),
  // so articles with 2/6 strong matches score high instead of being diluted by 4 non-matches.
  // Fall back to 0 if no matches.
  let tagOverlap = 0;
  let tagCap = 1.0;
  if (!isHoldback) {
    const totalTagWeight = Object.values(tagProfile).reduce(
      (sum, v) => (typeof v === 'number' ? sum + v : sum), 0
    );
    tagCap = totalTagWeight > 0 ? totalTagWeight * 0.30 : 1.0;
  }
  let matchedTagSum = 0;
  let matchedTagCount = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    const w = Math.min(tagProfile[t] || 0, tagCap);
    if (w > 0) {
      matchedTagSum += w;
      matchedTagCount++;
    }
  }
  tagOverlap = matchedTagCount > 0 ? matchedTagSum / matchedTagCount : 0;
  // Session momentum adds to tag overlap
  let momentum = 0;
  let momCount = 0;
  for (const tag of tags) {
    const b = sessionBoosts[tag.toLowerCase()] || 0;
    if (b > 0) { momentum += b; momCount++; }
  }
  if (momCount > 0) momentum /= momCount;
  tagOverlap = Math.min(tagOverlap + momentum * 0.3, 1.0);

  // 3. TASTE SIMILARITY (0.25) — pgvector cosine similarity
  // When multi-interest clusters are active, this is the similarity to the
  // NEAREST cluster vector (max across all clusters), not the single taste_vector.
  const tasteSimilarity = Math.max(0, Math.min(similarity, 1.0));

  // 4. FRESHNESS (0.10) — recency decay with shelf life
  const freshness = recency;

  // 5. GLOBAL POPULARITY (0.10) — editorial quality + additive engagement boost
  // Popularity ONLY boosts, never reduces. Articles with 0 engagement = aiScore unchanged.
  // log2 scale: 10 signals ≈ +0.10, 30 ≈ +0.14, 100+ ≈ +0.20
  const likeCount = article.like_count || 0;
  const engCount = article.engagement_count || 0;
  const popularityBoost = (likeCount + engCount) > 0
    ? Math.min(0.20, Math.log2(1 + likeCount * 5 + engCount) / 35)
    : 0;
  const globalPopularity = Math.min(1.0, aiScore + popularityBoost);

  // SKIP PENALTY — from skip_profile with 7-day half-life decay
  let skipPenalty = 0;
  if (!isHoldback && skipProfile) {
    const SKIP_HALF_LIFE_MS = 7 * 24 * 3600000;
    const now = Date.now();
    let skipScore = 0;
    for (const tag of tags) {
      const entry = skipProfile[tag.toLowerCase()];
      if (typeof entry === 'object' && entry !== null && entry.w) {
        const age = now - new Date(entry.t || 0).getTime();
        skipScore += entry.w * Math.exp(-0.693 * age / SKIP_HALF_LIFE_MS);
      } else if (typeof entry === 'number') {
        skipScore += entry * 0.5;
      }
    }
    skipScore /= n;
    const netSkip = Math.max(0, skipScore - tagOverlap * 0.5);
    skipPenalty = Math.min(netSkip, isDiscovery ? 0.4 : 0.9);
  }

  // Change 6: Topic saturation penalty — diminishing returns for repeated topics
  // 3 seen=10%, 6=25%, 10+=40% (cap)
  let saturationPenalty = 0;
  if (!isHoldback && topicSaturation) {
    let maxExposure = 0;
    // Check cluster_id exposure
    if (article.cluster_id) {
      const cKey = `c_${article.cluster_id}`;
      if (topicSaturation[cKey]) maxExposure = Math.max(maxExposure, topicSaturation[cKey].count || 0);
    }
    // Check primary tag pair exposure
    if (tags.length >= 2) {
      const pairKey = `t_${tags[0].toLowerCase()}+${tags[1].toLowerCase()}`;
      if (topicSaturation[pairKey]) maxExposure = Math.max(maxExposure, topicSaturation[pairKey].count || 0);
    }
    if (maxExposure >= 10) saturationPenalty = 0.40;
    else if (maxExposure >= 6) saturationPenalty = 0.25;
    else if (maxExposure >= 3) saturationPenalty = 0.10;
  }

  // Interest velocity: first-seen bonus for newly discovered interests
  // Tags appearing in _new_interests (within 48h) get a boost
  let velocityBoost = 1.0;
  if (!isHoldback) {
    const newInterests = tagProfile._new_interests || [];
    const now = Date.now();
    let newTagMatches = 0;
    for (const tag of tags) {
      const t = tag.toLowerCase();
      if (newInterests.find(e => e.tag === t && (now - e.ts) < 48 * 3600000)) {
        newTagMatches++;
      }
    }
    if (newTagMatches > 0) {
      // Confidence: boost is stronger with more matching new tags
      const confidence = Math.min(newTagMatches / 2, 1.0);
      velocityBoost = 1.0 + (0.30 * confidence); // up to 30% boost
    }
  }

  // Evening heuristic: after 8pm, slightly boost entertainment/lifestyle, reduce hard news
  const hour = new Date().getHours();
  const isEvening = hour >= 20 || hour < 6;
  let timeBoost = 1.0;
  if (!isHoldback && isEvening) {
    const lc = cat.toLowerCase();
    if (lc === 'entertainment' || lc === 'lifestyle') timeBoost = 1.2;
    else if (lc === 'politics' || lc === 'world') timeBoost = 0.85;
  }

  // Discovery surprise factor
  const surprise = isDiscovery ? (1 + Math.random() * 0.4) : 1.0;

  // Dynamic weights based on available signals:
  // - tagOverlap is our fastest-learning signal (updates every engagement)
  // - tasteSimilarity is slow (EMA embedding, needs many interactions)
  // As tag_profile grows, shift weight from taste→tag for faster learning
  let wCat = 0.25, wTag = 0.30, wTaste = 0.25, wFresh = 0.10, wPop = 0.10;

  // Count real tags in profile (exclude metadata keys starting with _)
  const realTagCount = Object.keys(tagProfile).filter(k => !k.startsWith('_') && typeof tagProfile[k] === 'number').length;

  if (tasteSimilarity === 0) {
    // No pgvector signal: redistribute to tag + category
    wCat = 0.35; wTag = 0.40; wTaste = 0; wFresh = 0.12; wPop = 0.13;
  } else if (realTagCount >= 15) {
    // Rich tag_profile: trust tag matching more, taste less
    // tag_profile has learned enough to be the primary signal
    wCat = 0.20; wTag = 0.40; wTaste = 0.20; wFresh = 0.10; wPop = 0.10;
  } else if (realTagCount >= 8) {
    // Growing tag_profile: start shifting
    wCat = 0.22; wTag = 0.35; wTaste = 0.23; wFresh = 0.10; wPop = 0.10;
  }

  const score = (
    categoryAffinity * wCat +
    tagOverlap * wTag +
    tasteSimilarity * wTaste +
    freshness * wFresh +
    globalPopularity * wPop
  ) * 1000 * surprise * velocityBoost * timeBoost;

  return score * (1 - skipPenalty) * (1 - saturationPenalty);
}

// Legacy wrappers for holdback group — preserve old scoring behavior
function scorePersonalV3(article, similarity, tagProfile, sessionBoosts, skipProfile, isHoldback = false) {
  if (!isHoldback) return null; // should use scoreUnified instead
  const tags = safeJsonParse(article.interest_tags, []);
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const aiScore = article.ai_final_score || 0;
  const n = Math.max(tags.length, 1);
  let tagScore = 0, momentumBoost = 0, skipScore = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    tagScore += tagProfile[t] || 0;
    momentumBoost += sessionBoosts[t] || 0;
    if (skipProfile) {
      const entry = skipProfile[t];
      if (typeof entry === 'number') skipScore += entry * 0.5;
    }
  }
  tagScore /= n; momentumBoost /= n; skipScore /= n;
  const netSkip = Math.max(0, skipScore - tagScore * 0.5);
  const skipPen = Math.min(netSkip, 0.9);
  return (tagScore * 350 + momentumBoost * 150 + similarity * 250 + (aiScore / 1000) * 250 * recency) * (1 - skipPen);
}

function scoreTrendingV3(article) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  return (article.ai_final_score || 0) * recency;
}

function scoreDiscoveryV3(article, personalCategories) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const categoryBoost = personalCategories.has(article.category) ? 0.6 : 1.5;
  const surprise = 1 + Math.random() * 0.4;
  return (article.ai_final_score || 0) * recency * categoryBoost * surprise;
}

// ==========================================
// MMR SELECTION (Maximal Marginal Relevance)
// Prevents topic flooding by penalizing candidates too similar to already-selected articles
// ==========================================

function buildTagSetsCache(articles) {
  const cache = new Map();
  for (const a of articles) {
    const tags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
    cache.set(a.id, new Set(tags));
  }
  return cache;
}

function mmrSelect(candidates, selected, tagCache, lambda) {
  if (candidates.length === 0) return null;
  if (selected.length === 0) return candidates.shift();

  const maxScore = Math.max(...candidates.map(c => c._score), 1);
  let bestIdx = 0;
  let bestMMR = -Infinity;

  // Check diversity against last 5 selected (recent context matters most)
  const recent = selected.slice(-5);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normScore = c._score / maxScore;

    let maxSim = 0;
    const cTags = tagCache.get(c.id) || new Set();

    for (const s of recent) {
      const sTags = tagCache.get(s.id) || new Set();
      let intersection = 0;
      for (const t of cTags) {
        if (sTags.has(t)) intersection++;
      }
      const unionSize = new Set([...cTags, ...sTags]).size;
      let sim = unionSize > 0 ? intersection / unionSize : 0;
      // Same category carries a minimum similarity penalty
      if (c.category === s.category) sim = Math.max(sim, 0.4);
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
// TAG-BASED FALLBACK (for users without taste vector)
// ==========================================

function calculateTagScore(article, userPrefs) {
  let score = article.ai_final_score || 0;
  const articleCountries = safeJsonParse(article.countries, []);
  const articleTopics = safeJsonParse(article.topics, []);

  if (articleCountries.includes(userPrefs.home_country)) score += 150;

  const countryMatches = articleCountries.filter(
    c => (userPrefs.followed_countries || []).includes(c)
  );
  if (countryMatches.length >= 2) score += 100;
  else if (countryMatches.length === 1) score += 75;

  const topicMatches = articleTopics.filter(
    t => (userPrefs.followed_topics || []).includes(t)
  );
  if (topicMatches.length >= 3) score += 100;
  else if (topicMatches.length === 2) score += 80;
  else if (topicMatches.length === 1) score += 50;

  return score;
}

// ==========================================
// COLUMNS TO SELECT (not SELECT *)
// ==========================================

const ARTICLE_COLUMNS = [
  'id', 'title_news', 'url', 'source', 'category', 'emoji',
  'image_url', 'image_source', 'published_at', 'created_at',
  'ai_final_score', 'summary_bullets_news',
  'five_ws', 'timeline', 'graph', 'map', 'details',
  'components_order', 'components', 'countries', 'topics',
  'country_relevance', 'topic_relevance', 'interest_tags',
  'num_sources', 'cluster_id', 'version_number', 'view_count',
  'shelf_life_days', 'freshness_category',
  'like_count', 'engagement_count',
].join(', ');

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
    let storedTagProfile = null;
    let discoveryStats = {};
    let categoryProfile = {};
    let topicSaturation = {};
    let hasInterestClusters = false;
    let persUserId = null; // The users table ID (may differ from auth user ID)

    if (userId) {
      // Look up profiles table (where real users live, id = auth UUID)
      let { data: userData } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile, tag_profile, discovery_stats, category_profile, session_momentum, topic_saturation')
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

      // Extract MiniLM taste vector, skip profile, stored tag profile, and category data
      tasteVectorMinilm = userData?.taste_vector_minilm || null;
      skipProfile = userData?.skip_profile || null;
      storedTagProfile = userData?.tag_profile || null;
      discoveryStats = userData?.discovery_stats || {};
      categoryProfile = userData?.category_profile || {};
      topicSaturation = userData?.topic_saturation || {};

      // Check if user has interest clusters (PinnerSage-lite)
      if (tasteVector && persUserId) {
        const { count } = await supabase
          .from('user_interest_clusters')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', persUserId);
        hasInterestClusters = (count || 0) > 0;
      }
    }

    if (!userPrefs && homeCountry) {
      userPrefs = { home_country: homeCountry, followed_countries: followedCountries, followed_topics: followedTopics };
    }

    // ==========================================
    // PARSE CURSOR
    // ==========================================

    let offset = 0;
    let isV2Cursor = false;

    if (cursor) {
      if (cursor.startsWith('v2_')) {
        // New v2 cursor: v2_{offset}_{lastArticleId}
        const parts = cursor.split('_');
        offset = parseInt(parts[1]) || 0;
        isV2Cursor = true;
      } else {
        // Legacy numeric offset cursor
        offset = parseInt(cursor) || 0;
      }
    }

    // ==========================================
    // GET SEEN ARTICLE IDS (for dedup across pages)
    // ==========================================

    // Always fetch seen articles to exclude (fresh candidates each request, like TikTok)
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
    // Merge client-sent seen IDs (handles guests and races where server events haven't persisted yet)
    if (clientSeenIds.length > 0) {
      seenArticleIds = [...new Set([...seenArticleIds, ...clientSeenIds])];
    }

    // ==========================================
    // ALWAYS USE V2 FEED
    // For cold-start users without taste vectors, V2 fills with
    // trending + discovery articles via MMR diversity.
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
      storedTagProfile,
      discoveryStats,
      categoryProfile,
      topicSaturation,
      seenArticleIds,
      sessionEngagedIds,
      sessionSkippedIds,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Main feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ==========================================
// V2 FEED: Professional-Grade Personalization
// Multi-cluster interests + entity-level tags + session momentum
// + MMR diversity + variable reward pattern
// ==========================================

async function handleV2Feed(req, res, supabase, opts) {
  let { userId, userPrefs, tasteVector, tasteVectorMinilm, hasInterestClusters,
        similarityFloor, skipProfile, storedTagProfile, discoveryStats, categoryProfile,
        topicSaturation, seenArticleIds, sessionEngagedIds, sessionSkippedIds, limit, offset } = opts;
  discoveryStats = discoveryStats || {};
  categoryProfile = categoryProfile || {};
  sessionEngagedIds = sessionEngagedIds || [];
  sessionSkippedIds = sessionSkippedIds || [];

  // 10% holdback: keep a control group on the pre-improvement algorithm
  // Hash userId to deterministically assign users to holdback
  const hashCode = (userId || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const isHoldback = Math.abs(hashCode) % 10 === 0;
  if (isHoldback) {
    console.log('[feed] User in holdback group:', userId?.substring(0, 8));
  }

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600000).toISOString();
  const seventyTwoHoursAgo = new Date(now - 72 * 3600000).toISOString();
  const fiveDaysAgo = new Date(now - 5 * 24 * 3600000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 3600000).toISOString();
  const fortyEightHoursAgo = new Date(now - 48 * 3600000).toISOString();

  // Personalized feed — private cache, shorter TTL
  res.setHeader('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');

  // ==========================================
  // PHASE 1: PARALLEL DATA LOADING
  // ==========================================

  const excludeIds = seenArticleIds.length > 0 ? seenArticleIds : null;
  const minSim = similarityFloor || 0;
  const useMinilm = !!tasteVectorMinilm;

  // Build personal candidate query (pgvector ANN search)
  // For cold-start users without any embedding data, skip the personal query
  // entirely — V2 will fill the feed with trending + discovery articles.
  // IMPROVEMENT 1: Deeper pages request more candidates
  let hasAnyPersonalization = tasteVector || tasteVectorMinilm || hasInterestClusters;
  // Wider pool for returning users: more seen articles = need more candidates to find fresh good ones
  const seenBoost = Math.min(seenArticleIds.length, 200); // Up to +200 extra candidates based on seen history
  const personalMatchCount = Math.min(300 + offset + seenBoost, 600);
  let personalPromise;
  if (!hasAnyPersonalization) {
    personalPromise = Promise.resolve({ data: [], error: null });
  } else if (hasInterestClusters && useMinilm) {
    personalPromise = supabase.rpc('match_articles_multi_cluster_minilm', {
      p_user_id: userId, match_per_cluster: Math.min(80 + Math.floor(offset / 3), 150), hours_window: 720,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else if (hasInterestClusters) {
    personalPromise = supabase.rpc('match_articles_multi_cluster', {
      p_user_id: userId, match_per_cluster: Math.min(80 + Math.floor(offset / 3), 150), hours_window: 720,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else if (useMinilm) {
    personalPromise = supabase.rpc('match_articles_personal_minilm', {
      query_embedding: tasteVectorMinilm, match_count: personalMatchCount, hours_window: 720,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else {
    personalPromise = supabase.rpc('match_articles_personal', {
      query_embedding: tasteVector, match_count: personalMatchCount, hours_window: 720,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  }

  const [personalResult, trendingResult, discoveryResult, userInterestProfile, collabResult] = await Promise.all([
    // 1. PERSONAL: pgvector similarity search
    personalPromise,

    // 2. TRENDING: quality content from last 5 days
    // Threshold lowered from 600→400 to include niche content (NBA, Gaming, K-Pop)
    // that scores 400-600. The scoring pipeline (scoreUnified + tag_profile) will
    // re-rank these by personalization, so low-quality irrelevant articles still rank low.
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', fiveDaysAgo)
      .gte('ai_final_score', hasAnyPersonalization ? 400 : 400)
      .order('ai_final_score', { ascending: false })
      .limit(hasAnyPersonalization ? 500 : 500),

    // 3. DISCOVERY: diverse quality content, wider pool
    // Cold-start: fetch much larger pool to compensate for empty personal
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', thirtyDaysAgo)
      .gte('ai_final_score', hasAnyPersonalization ? 400 : 300)
      .order('ai_final_score', { ascending: false })
      .limit(hasAnyPersonalization ? 200 : 500),

    // 4. USER INTEREST PROFILE: entity-level tag weights from engagement history
    buildUserInterestProfile(supabase, userId),

    // 5. COLLABORATIVE FILTERING: articles engaged by similar users (entity-based matching)
    // "Users who like galatasaray also liked..." — finds users sharing >= 2 top tags
    (userId && storedTagProfile && Object.keys(storedTagProfile).filter(k => !k.startsWith('_')).length >= 2)
      ? supabase.rpc('get_collab_articles', { p_user_id: userId, p_limit: 50, p_hours: 168 })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (personalResult.error) {
    console.error('Personal query error (continuing with trending+discovery):', personalResult.error);
  }
  if (collabResult.error) {
    console.log('[feed] Collab filtering error (may need migration 032):', collabResult.error.message);
  }

  // Build collaborative article map: article_id → recommender_count
  const collabArticleMap = {};
  for (const row of (collabResult.data || [])) {
    collabArticleMap[row.article_id] = row.recommender_count || 1;
  }
  const collabArticleIds = Object.keys(collabArticleMap).map(Number);
  if (collabArticleIds.length > 0) {
    console.log(`[feed] Collab filtering found ${collabArticleIds.length} articles from similar users for:`, userId?.substring(0, 8));
  }

  // ==========================================
  // INTEREST CATEGORY ENRICHMENT
  // For users with onboarding topic selections, fetch articles from each
  // interest category directly. This ensures Sports/Gaming/etc. users
  // always see relevant content even without a taste vector.
  // ==========================================

  const followedTopics = safeJsonParse(userPrefs?.followed_topics, []) || [];
  const interestCategories = new Set();
  const interestAltCategories = new Set();
  const interestTags = new Set(); // All subtopic tags for tag-level matching

  for (const topic of followedTopics) {
    // Resolve topic: try exact match → app alias → category reverse lookup
    const resolvedTopics = ONBOARDING_TOPIC_MAP[topic]
      ? [topic]  // Exact subtopic match (e.g., "Gaming", "NBA")
      : APP_TOPIC_ALIAS[topic.toLowerCase()]  // App shorthand (e.g., "ai" → "AI & Machine Learning")
        || (CATEGORY_TO_SUBTOPICS[topic] ? CATEGORY_TO_SUBTOPICS[topic].map(s => s.name) : null)  // Category name
        || null;

    if (resolvedTopics) {
      for (const resolved of resolvedTopics) {
        const mapping = ONBOARDING_TOPIC_MAP[resolved];
        if (mapping) {
          mapping.categories.forEach(c => interestCategories.add(c));
          if (mapping.altCategories) mapping.altCategories.forEach(c => interestAltCategories.add(c));
          mapping.tags.forEach(t => interestTags.add(t.toLowerCase()));
        }
      }
    } else {
      console.warn(`[feed] Unmatched onboarding topic: "${topic}"`);
    }
  }

  // Fetch per-category articles + tag-based articles for followed interests
  let interestArticles = [];
  if (interestCategories.size > 0 || interestTags.size > 0) {
    const allInterestCats = [...new Set([...interestCategories, ...interestAltCategories])];

    // 1. Category-based queries (broad sweep)
    const catPromises = allInterestCats.map(cat =>
      supabase
        .from('published_articles')
        .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
        .eq('category', cat)
        .gte('created_at', thirtyDaysAgo)
        .gte('ai_final_score', 150)
        .order('ai_final_score', { ascending: false })
        .limit(100)
    );

    // 2. Tag-based queries (niche content that may be in unexpected categories)
    // e.g., a "gaming" article categorized under "Tech" won't appear in Entertainment queries
    const tagArray = [...interestTags].slice(0, 50); // raised from 20 to cover broader interests
    const tagBatches = [];
    for (let i = 0; i < tagArray.length; i += 5) {
      tagBatches.push(tagArray.slice(i, i + 5));
    }
    const tagPromises = tagBatches.map(batch =>
      supabase
        .from('published_articles')
        .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
        .or(batch.map(t => `interest_tags.ilike.%${t}%`).join(','))
        .gte('created_at', thirtyDaysAgo)
        .gte('ai_final_score', 150)
        .order('ai_final_score', { ascending: false })
        .limit(50)
    );

    const [catResults, tagResults] = await Promise.all([
      Promise.all(catPromises),
      Promise.all(tagPromises),
    ]);
    for (const r of catResults) {
      if (r.data) interestArticles.push(...r.data);
    }
    for (const r of tagResults) {
      if (r.data) interestArticles.push(...r.data);
    }
    // Deduplicate
    const seen = new Set();
    interestArticles = interestArticles.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }

  // ==========================================
  // TAG_PROFILE ENRICHMENT: Supplement pgvector with tag-matched articles
  // For returning users with a learned tag_profile, query articles matching
  // their top engaged tags. This prevents taste vector contamination from
  // degrading the personal pool — even if pgvector drifts toward Politics,
  // tag_profile knows the user actually loves Soccer/Gaming/K-Pop.
  // ==========================================

  if (storedTagProfile && !isHoldback) {
    const tagEntries = Object.entries(storedTagProfile)
      .filter(([k, v]) => !k.startsWith('_') && typeof v === 'number' && v >= 0.05)
      .sort((a, b) => b[1] - a[1]);

    if (tagEntries.length >= 3) {
      const topTags = tagEntries.slice(0, 20).map(([k]) => k);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
      const tagBatchSize = 5;
      const tagProfileBatches = [];
      for (let i = 0; i < topTags.length; i += tagBatchSize) {
        tagProfileBatches.push(topTags.slice(i, i + tagBatchSize));
      }
      const tagProfilePromises = tagProfileBatches.map(batch =>
        supabase
          .from('published_articles')
          .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
          .or(batch.map(t => `interest_tags.ilike.%${t}%`).join(','))
          .gte('created_at', thirtyDaysAgo)
          .gte('ai_final_score', 150)
          .order('ai_final_score', { ascending: false })
          .limit(100)
      );
      const tagProfileResults = await Promise.all(tagProfilePromises);
      const existingIds = new Set(interestArticles.map(a => a.id));
      for (const r of tagProfileResults) {
        if (r.data) {
          for (const a of r.data) {
            if (!existingIds.has(a.id)) {
              interestArticles.push(a);
              existingIds.add(a.id);
            }
          }
        }
      }
      console.log(`[feed] Tag-profile enrichment: added articles from top ${topTags.length} tags for:`, userId?.substring(0, 8));
    }
  }

  // ==========================================
  // DOMINANT CATEGORY BOOST: For users with 70%+ engagement in one category,
  // fetch extra articles from that category directly. This ensures single-interest
  // users (Marco = 95% Sports) always have fresh content in their personal pool,
  // even when pgvector taste vector has drifted toward other categories.
  // ==========================================

  if (categoryProfile && !isHoldback) {
    let totalCatEngaged = 0;
    let dominantCat = null;
    let dominantEngaged = 0;
    for (const [cat, stats] of Object.entries(categoryProfile)) {
      const engaged = stats?.engaged || 0;
      totalCatEngaged += engaged;
      if (engaged > dominantEngaged) {
        dominantEngaged = engaged;
        dominantCat = cat;
      }
    }
    if (dominantCat && totalCatEngaged >= 5 && dominantEngaged / totalCatEngaged >= 0.70) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
      const { data: domCatArticles } = await supabase
        .from('published_articles')
        .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
        .eq('category', dominantCat)
        .gte('created_at', thirtyDaysAgo)
        .gte('ai_final_score', 150)
        .order('ai_final_score', { ascending: false })
        .limit(200);

      if (domCatArticles && domCatArticles.length > 0) {
        const existingIds = new Set(interestArticles.map(a => a.id));
        let added = 0;
        for (const a of domCatArticles) {
          if (!existingIds.has(a.id)) {
            interestArticles.push(a);
            existingIds.add(a.id);
            added++;
          }
        }
        console.log(`[feed] Dominant category boost: added ${added} ${dominantCat} articles for:`, userId?.substring(0, 8));
      }
    }
  }

  // ==========================================
  // COLD-START: Seed tag_profile from onboarding topics
  // When a user has selected topics but has no tag_profile yet,
  // seed it so the algorithm has something to work with immediately.
  // Broad categories = 0.3 weight, specific sub-topics = 0.5 weight.
  // ==========================================

  if ((!storedTagProfile || Object.keys(storedTagProfile).filter(k => !k.startsWith('_')).length === 0)
      && followedTopics.length > 0 && userId) {
    const seededProfile = {};
    for (const topic of followedTopics) {
      // Resolve topic: exact match → app alias → category reverse lookup
      const resolvedTopics = ONBOARDING_TOPIC_MAP[topic]
        ? [topic]
        : APP_TOPIC_ALIAS[topic.toLowerCase()]
          || (CATEGORY_TO_SUBTOPICS[topic] ? CATEGORY_TO_SUBTOPICS[topic].map(s => s.name) : null)
          || null;

      if (!resolvedTopics) continue;
      for (const resolved of resolvedTopics) {
        const mapping = ONBOARDING_TOPIC_MAP[resolved];
        if (!mapping) continue;
        const isSpecific = mapping.tags.length <= 8;
        const weight = isSpecific ? 0.5 : 0.3;
        for (const tag of mapping.tags) {
          seededProfile[tag.toLowerCase()] = Math.max(seededProfile[tag.toLowerCase()] || 0, weight);
        }
      }
    }
    seededProfile._last_updated = Date.now();
    storedTagProfile = seededProfile;
    // Persist the seeded profile so it's available on next request
    supabase.from('profiles').update({ tag_profile: seededProfile }).eq('id', userId)
      .then(() => console.log('[feed] Seeded tag_profile from onboarding for:', userId?.substring(0, 8)))
      .catch(() => {});
  }

  // Update personalization flag: users with onboarding topics or seeded tag_profile
  // are NOT cold-start — they should go through slot-filling, not the random bandit.
  // (pgvector personal pool will be empty, but interest articles fill pPool instead)
  if (!hasAnyPersonalization && (followedTopics.length > 0 || (storedTagProfile && Object.keys(storedTagProfile).filter(k => !k.startsWith('_')).length > 0))) {
    hasAnyPersonalization = true;
  }

  // ==========================================
  // PHASE 2: SESSION MOMENTUM (streak detection)
  // ==========================================

  const momentum = await computeSessionMomentum(supabase, sessionEngagedIds, sessionSkippedIds);

  // Use stored tag_profile if available (incrementally updated via track.js),
  // fall back to dynamically computed interest profile
  const baseTagProfile = (storedTagProfile && Object.keys(storedTagProfile).length > 0)
    ? storedTagProfile
    : (userInterestProfile || {});

  // Merge session boosts into tag profile (temporary, this request only)
  const effectiveTagProfile = { ...baseTagProfile };
  for (const [tag, boost] of Object.entries(momentum.boosts)) {
    effectiveTagProfile[tag] = Math.min((effectiveTagProfile[tag] || 0) + boost, 1.0);
  }

  // Cross-session momentum: when starting a new session (no client-side engaged IDs yet),
  // boost the effective profile with the stored momentum from the previous session.
  // This ensures the FIRST feed request of a new session reflects recent interests,
  // before track.js has had a chance to fold momentum into tag_profile.
  const storedMomentum = userPrefs?.session_momentum;
  if (sessionEngagedIds.length === 0 && storedMomentum?.tags && Object.keys(storedMomentum.tags).length > 0) {
    for (const [tag, weight] of Object.entries(storedMomentum.tags)) {
      if (typeof weight !== 'number') continue;
      effectiveTagProfile[tag] = Math.min((effectiveTagProfile[tag] || 0) + weight * 0.5, 1.0);
    }
  }

  // Merge session skip penalties into skip profile
  const effectiveSkipProfile = { ...(skipProfile || {}) };
  for (const [tag, pen] of Object.entries(momentum.skipPenalties)) {
    effectiveSkipProfile[tag] = Math.min((effectiveSkipProfile[tag] || 0) + pen, 0.9);
  }

  const sessionExcludeIds = new Set([...sessionEngagedIds, ...sessionSkippedIds]);

  // ==========================================
  // PHASE 3: PROPORTIONAL CLUSTER ALLOCATION
  // Instead of round-robin (equal per cluster), allocate proportionally
  // to engagement count. A user with 80% Galatasaray + 20% AI gets
  // ~80% Galatasaray candidates (capped at 50% to ensure diversity).
  // ==========================================

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
      // Cap any single cluster at 50% to prevent monoculture
      clusterWeights[c.cluster_index] = Math.min(
        (c.article_count || 1) / Math.max(totalEngaged, 1),
        0.5
      );
    }

    // Proportional allocation (min 1 per cluster)
    const clusterKeys = Object.keys(clusterBuckets);
    const targetTotal = 150;
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

  // TRENDING: category-cap per category, exclude personal/seen
  // Raised to 5 (from 3) so interest-category rotation has enough articles
  // per category — with only 3, a user interested in Tech might exhaust
  // the pool after 3 T slots and fall back to Iran/war
  const trendingCatMax = hasAnyPersonalization ? 15 : 20;
  const trendingCategoryCounts = {};
  const trendingIds = new Set();
  const trendingArticleMeta = [];
  for (const a of (trendingResult.data || [])) {
    if (personalIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
    trendingCategoryCounts[cat] = (trendingCategoryCounts[cat] || 0) + 1;
    if (trendingCategoryCounts[cat] > trendingCatMax) continue;
    trendingIds.add(a.id);
    trendingArticleMeta.push(a);
  }

  // DISCOVERY: diverse categories, exclude personal & trending
  // Quality-gated: only top 20% of each category (prevents bad surprise articles)
  // Cold-start: much higher caps to fill the feed
  const discoveryCatMax = hasAnyPersonalization ? 2 : 8;
  const discoveryTotalMax = hasAnyPersonalization ? 30 : 200;

  // Compute per-category quality thresholds (top 20%)
  const catScores = {};
  for (const a of (discoveryResult.data || [])) {
    const cat = a.category || 'Other';
    if (!catScores[cat]) catScores[cat] = [];
    catScores[cat].push(a.ai_final_score || 0);
  }
  const catDiscoveryThresholds = {};
  for (const [cat, scores] of Object.entries(catScores)) {
    scores.sort((a, b) => b - a);
    const idx = Math.max(0, Math.floor(scores.length * 0.20));
    catDiscoveryThresholds[cat] = scores[idx] || 0;
  }

  const discoveryCategoryCounts = {};
  const discoveryArticleMeta = [];
  for (const a of (discoveryResult.data || [])) {
    if (personalIds.has(a.id) || trendingIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
    // Quality gate: only top 20% of each category (holdback skips this)
    if (!isHoldback && hasAnyPersonalization && (a.ai_final_score || 0) < (catDiscoveryThresholds[cat] || 0)) continue;
    // Discovery memory: stop exploring categories the user consistently rejects
    if (!isHoldback && discoveryStats[cat] && discoveryStats[cat].shown >= 5) {
      const rate = discoveryStats[cat].engaged / discoveryStats[cat].shown;
      if (rate < 0.15) continue; // less than 15% engagement after 5+ shown = rejected
    }
    discoveryCategoryCounts[cat] = (discoveryCategoryCounts[cat] || 0) + 1;
    if (discoveryCategoryCounts[cat] > discoveryCatMax) continue;
    discoveryArticleMeta.push(a);
    if (discoveryArticleMeta.length >= discoveryTotalMax) break;
  }

  // INTEREST ENRICHMENT: add interest-category articles to discovery pool
  const interestIds = new Set();
  const interestArticleMeta = [];
  for (const a of interestArticles) {
    if (personalIds.has(a.id) || trendingIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    interestIds.add(a.id);
    interestArticleMeta.push(a);
  }

  // ==========================================
  // PHASE 4: FETCH FULL ARTICLE DATA
  // ==========================================

  const allCandidateIds = [
    ...personalIds,
    ...trendingIds,
    ...discoveryArticleMeta.map(a => a.id),
    ...interestIds,
    ...collabArticleIds,
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

  // Pre-compute tag sets for MMR diversity calculations
  const tagCache = buildTagSetsCache(allArticles);

  // ==========================================
  // PER-CATEGORY CAP: Adaptive personal pool diversity
  // Each category gets a cap proportional to the user's engagement with it.
  // Dominant categories (Sports for Marco at 90%) get high caps.
  // Off-topic categories (Business at 2%) get tiny caps.
  // This prevents Iran/Oil/Business from flooding a Sports user's personal pool.
  // ==========================================

  if (!isHoldback && personalIdOrder.length > 5) {
    // Compute per-category engagement share from categoryProfile
    const catShares = {};
    let totalEngaged = 0;
    for (const [cat, stats] of Object.entries(categoryProfile)) {
      const engaged = stats?.engaged || 0;
      catShares[cat] = engaged;
      totalEngaged += engaged;
    }

    if (totalEngaged >= 5) {
      // Normalize to shares and compute per-category caps
      // Each category's cap = its engagement share * pool size, with min floor of 2
      // and max ceiling of 50% (so even the dominant category leaves room for discovery)
      const poolSize = personalIdOrder.length;
      const catCaps = {};
      for (const [cat, engaged] of Object.entries(catShares)) {
        const share = engaged / totalEngaged;
        // Give each engaged category at least 5% of pool, scale up proportionally
        // Cap at 85% so there's always a little variety
        const catCapRatio = Math.max(0.05, Math.min(share * 1.2, 0.85));
        catCaps[cat] = Math.max(2, Math.ceil(poolSize * catCapRatio));
      }
      // Categories not in categoryProfile get a small default cap (5%)
      const defaultCap = Math.max(2, Math.ceil(poolSize * 0.05));

      const catCounts = {};
      personalIdOrder = personalIdOrder.filter(id => {
        const cat = articleMap[id]?.category || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        const cap = catCaps[cat] || defaultCap;
        return catCounts[cat] <= cap;
      });
    } else {
      // Not enough data yet — use flat 35% cap
      const maxPerCat = Math.ceil(personalIdOrder.length * 0.35);
      const catCounts = {};
      personalIdOrder = personalIdOrder.filter(id => {
        const cat = articleMap[id]?.category || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        return catCounts[cat] <= maxPerCat;
      });
    }
  }

  // ==========================================
  // PHASE 5: SCORE CANDIDATES
  // ==========================================

  // Shared scoring options for unified function
  const scoreOpts = {
    tagProfile: effectiveTagProfile,
    skipProfile: effectiveSkipProfile,
    sessionBoosts: momentum.boosts,
    categoryProfile,
    topicSaturation: topicSaturation || {},
    discoveryStats: discoveryStats || {},
    isHoldback,
  };

  // Personal bucket: unified scoring with pgvector similarity
  const personalScored = personalIdOrder
    .filter(id => articleMap[id])
    .map(id => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      const score = isHoldback
        ? scorePersonalV3(article, similarity, effectiveTagProfile, momentum.boosts, effectiveSkipProfile, true)
        : scoreUnified(article, { ...scoreOpts, similarity });
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

  // Trending bucket: unified scoring with interest tag boost
  // When user has interest tags, trending articles matching those interests get priority
  // so T slots don't always show Iran/war for a Gaming or Soccer user
  const trendingScored = trendingArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      let score = isHoldback
        ? scoreTrendingV3(article)
        : scoreUnified(article, scoreOpts);
      if (!isHoldback && interestTags.size > 0) {
        const tags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
        const matches = tags.filter(t => interestTags.has(t)).length;
        if (matches > 0) score *= (1 + matches * 0.3);
      }
      return { ...article, _score: score, _bucket: 'trending' };
    })
    .sort((a, b) => b._score - a._score);

  // Discovery bucket: unified scoring with interest tag boost + discovery surprise
  const discoveryScored = discoveryArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      let score = isHoldback
        ? scoreDiscoveryV3(article, personalCategories)
        : scoreUnified(article, { ...scoreOpts, isDiscovery: true, personalCategories });
      if (!isHoldback && interestTags.size > 0) {
        const tags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
        const matches = tags.filter(t => interestTags.has(t)).length;
        if (matches > 0) score *= (1 + matches * 0.3);
      }
      return { ...article, _score: score, _bucket: 'discovery' };
    })
    .sort((a, b) => b._score - a._score);

  // Interest bucket: scored through scoreUnified like everything else
  // Interest articles are candidates from the user's onboarding topics — they get
  // an interest tag bonus but go through the SAME scoring as personal/trending/discovery.
  // This ensures skip penalties, session momentum, velocity boost all apply.
  const interestScored = interestArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const articleTags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
      const tagMatches = articleTags.filter(t => interestTags.has(t)).length;
      // Filter out zero-match articles (celebrity gossip in a gaming user's feed)
      if (!isHoldback && tagMatches === 0) return null;
      // Score through unified function (same as personal/trending/discovery)
      const score = isHoldback
        ? (article.ai_final_score || 0) * (1.0 + tagMatches * 0.25) * getRecencyDecay(article.created_at, article.category, article.shelf_life_days)
        : scoreUnified(article, { ...scoreOpts, similarity: 0 });
      // Interest tag bonus: matched articles get a boost on top of unified score
      const interestBoost = tagMatches >= 3 ? 1.8 : tagMatches >= 2 ? 1.5 : tagMatches >= 1 ? 1.3 : 1.0;
      return {
        ...article,
        _score: score * interestBoost,
        _tagMatches: tagMatches,
        _bucket: 'interest',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);

  // Collaborative bucket: articles engaged by similar users (entity-based matching)
  // Scored through scoreUnified + recommender boost based on how many similar users engaged.
  // This is the "users who like X also liked Y" signal.
  const collabScored = collabArticleIds
    .filter(id => articleMap[id] && !personalIds.has(id) && !trendingIds.has(id) && !seenArticleIds.includes(id) && !sessionExcludeIds.has(id))
    .map(id => {
      const article = articleMap[id];
      const score = isHoldback
        ? (article.ai_final_score || 0) * getRecencyDecay(article.created_at, article.category, article.shelf_life_days)
        : scoreUnified(article, { ...scoreOpts, similarity: 0 });
      // Recommender boost: gentle — collab is a fallback, not primary signal
      // 1 user = 1.1x, 2 = 1.2x, 3+ = 1.3x, 5+ = 1.4x
      const recCount = collabArticleMap[id] || 1;
      const collabBoost = recCount >= 5 ? 1.4 : recCount >= 3 ? 1.3 : recCount >= 2 ? 1.2 : 1.1;
      return {
        ...article,
        _score: score * collabBoost,
        _recommenderCount: recCount,
        _bucket: 'collab',
      };
    })
    .sort((a, b) => b._score - a._score);

  // ==========================================
  // PHASE 5.5: WORLD-EVENT DEDUP (IMPROVEMENT 3)
  // Cap articles per world_event/cluster to prevent event flooding
  // (e.g., 15 Iran war articles won't all appear in the feed)
  // ==========================================

  const WORLD_EVENT_CAP = 4;   // max articles per world event (was 3)
  const CLUSTER_CAP = 4;       // max articles per article cluster (was 3)

  // Pre-fetch world event associations for all candidates
  const candidateEventMap = await fetchWorldEvents(supabase, uniqueIds);
  for (const [aid, event] of Object.entries(candidateEventMap)) {
    if (articleMap[aid]) articleMap[aid]._world_event_id = event?.id || null;
  }

  // ==========================================
  // PHASE 6: MMR-BASED SLOT FILLING (variable reward pattern)
  // IMPROVEMENT 3: World-event and cluster dedup during selection
  // IMPROVEMENT 5: Cold-start Thompson Sampling bandit
  //
  // Slot pattern per 10 cards:
  //   P P T P P S P P T S
  //   ~60% personal, 20% trending, 20% surprise/discovery
  // ==========================================

  // Session-adaptive slot pattern
  // Default: P P T P P S P P T S (~60% personal, 20% trending, 20% discovery)
  let SLOTS = ['P', 'P', 'T', 'P', 'P', 'S', 'P', 'P', 'T', 'S'];

  if (!isHoldback) {
    // Time since last session: affects initial composition
    // Fetch user's last event timestamp
    const lastSessionQuery = await supabase
      .from('user_article_events')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastEventTime = lastSessionQuery.data?.[0]?.created_at;
    const hoursSinceLastSession = lastEventTime
      ? (Date.now() - new Date(lastEventTime).getTime()) / 3600000
      : 999;

    if (hoursSinceLastSession < 4) {
      // Recent return — boost personal ratio since tag_profile is freshly enriched
      // More P slots capitalizes on what we just learned from the previous session
      SLOTS = ['P', 'P', 'P', 'T', 'P', 'P', 'P', 'S', 'P', 'T'];
    } else if (hoursSinceLastSession > 48) {
      // Returning after absence — catch them up with trending + personal
      SLOTS = ['T', 'P', 'T', 'P', 'P', 'T', 'P', 'P', 'S', 'P'];
    }

    // Mid-session adaptation: after enough session signals,
    // adjust slots based on engagement patterns
    const totalSignals = sessionEngagedIds.length + sessionSkippedIds.length;
    if (totalSignals >= 5) {
      const skipRate = sessionSkippedIds.length / totalSignals;
      if (skipRate > 0.7) {
        // User skipping most articles — increase discovery for variety
        SLOTS = ['P', 'S', 'S', 'T', 'S', 'P', 'S', 'T', 'S', 'P'];
      } else if (skipRate < 0.3) {
        // User engaging well — double down on personal
        SLOTS = ['P', 'P', 'P', 'T', 'P', 'P', 'S', 'P', 'T', 'P'];
      }
    }
  }

  const selected = [];
  // Merge interest articles into personal pool — they're scored via scoreUnified
  // with interest tag bonus, so they naturally rank alongside personal articles.
  // Deduplicate by ID (some interest articles may overlap with personal)
  const pPoolIds = new Set(personalScored.map(a => a.id));
  const uniqueInterest = interestScored.filter(a => !pPoolIds.has(a.id));
  const pPool = [...personalScored, ...uniqueInterest].sort((a, b) => b._score - a._score);
  // Collaborative pool: separate from pPool — used as fallback when P pool thins out
  // Don't merge into pPool to avoid diluting with loosely-matched "similar user" content
  const combinedMainIds = new Set([...pPoolIds, ...uniqueInterest.map(a => a.id)]);
  const cPool = collabScored.filter(a => !combinedMainIds.has(a.id));
  const tPool = [...trendingScored];
  const dPool = [...discoveryScored];

  // IMPROVEMENT 3: Track world event and cluster counts
  // Soft impression discounting: gradual fatigue instead of hard caps
  // 1/(1 + count * 0.15) → #1=100%, #4=62%, #7=49%, #10=40%
  const eventCounts = {};
  const clusterCounts = {};

  function isEventCapped(article) {
    if (isHoldback) {
      // Holdback: keep old hard cap behavior
      const eventId = article._world_event_id;
      const clusterId = article.cluster_id;
      if (eventId && (eventCounts[eventId] || 0) >= WORLD_EVENT_CAP) return true;
      if (clusterId && (clusterCounts[clusterId] || 0) >= CLUSTER_CAP) return true;
      return false;
    }
    // Soft fatigue: never fully cap, but apply heavy discount at high counts
    // Block only at extreme counts (>10) as a safety valve
    const eventId = article._world_event_id;
    const clusterId = article.cluster_id;
    if (eventId && (eventCounts[eventId] || 0) >= 10) return true;
    if (clusterId && (clusterCounts[clusterId] || 0) >= 10) return true;
    return false;
  }

  function getImpressionDiscount(article) {
    if (isHoldback) return 1.0;
    const eventId = article._world_event_id;
    const clusterId = article.cluster_id;
    const eventCount = eventId ? (eventCounts[eventId] || 0) : 0;
    const clusterCount = clusterId ? (clusterCounts[clusterId] || 0) : 0;
    const maxCount = Math.max(eventCount, clusterCount);
    return 1.0 / (1.0 + maxCount * 0.15);
  }

  function recordEventSelection(article) {
    const eventId = article._world_event_id;
    const clusterId = article.cluster_id;
    if (eventId) eventCounts[eventId] = (eventCounts[eventId] || 0) + 1;
    if (clusterId) clusterCounts[clusterId] = (clusterCounts[clusterId] || 0) + 1;
    // Soft impression discounting: reduce scores of remaining pool items
    // from the same event/cluster so they become less likely to be picked next
    if (!isHoldback && (eventId || clusterId)) {
      for (const pool of [pPool, tPool, dPool]) {
        for (const item of pool) {
          if ((eventId && item._world_event_id === eventId) ||
              (clusterId && item.cluster_id === clusterId)) {
            item._score *= getImpressionDiscount(item);
          }
        }
      }
    }
  }

  // IMPROVEMENT 3: MMR select with event/cluster dedup
  function mmrSelectDeduped(pool, sel, tc, lambda) {
    let attempts = 0;
    while (attempts < 5 && pool.length > 0) {
      const picked = mmrSelect(pool, sel, tc, lambda);
      if (!picked) return null;
      if (!isEventCapped(picked)) return picked;
      // Capped — skip this one and try next
      attempts++;
    }
    return null;
  }

  // ==========================================
  // INTEREST-AWARE TRENDING & DISCOVERY
  // Per-interest-category rotation for T slots (like Reddit per-subreddit
  // trending, Google Discover Topic Layer, SmartNews category trending).
  // Instead of global trending dominated by one news cycle, each T slot
  // picks from a different user interest category.
  // ==========================================

  const interestCatList = [...interestCategories]; // e.g., ['Tech', 'Sports', 'Science']
  let trendingCatIdx = 0; // rotation pointer for T slot category cycling

  // Helper: MMR-select from pool filtered to a specific category
  // Used for interest-category rotation (trending) and category-targeted discovery
  function mmrSelectFromCat(pool, sel, tc, lambda, targetCat) {
    let attempts = 0;
    while (attempts < 5) {
      const filtered = pool.filter(a => a.category === targetCat);
      if (filtered.length === 0) return null;
      const picked = mmrSelect([...filtered], sel, tc, lambda);
      if (!picked) return null;
      // Remove from original pool
      const idx = pool.findIndex(a => a.id === picked.id);
      if (idx >= 0) pool.splice(idx, 1);
      if (!isEventCapped(picked)) return picked;
      attempts++;
    }
    return null;
  }

  // IMPROVEMENT 5: Cold-start Thompson Sampling bandit
  // Only use bandit for truly cold-start users with NO signals at all.
  // Guest users who selected topics during onboarding should use the
  // personalized slot-filling path (with interest-category rotation)
  // even without a taste vector — their followed_topics provide enough
  // signal for interest-aware trending and discovery.
  const hasFollowedTopics = (userPrefs?.followed_topics || []).length > 0;
  if (!hasAnyPersonalization && !hasFollowedTopics) {
    // Group all candidates by category for bandit
    const categoryPools = {};
    for (const a of [...trendingScored, ...discoveryScored]) {
      const cat = a.category || 'Other';
      if (!categoryPools[cat]) categoryPools[cat] = [];
      categoryPools[cat].push(a);
    }

    // Initialize Beta priors (uniform)
    const banditState = {};
    for (const cat of Object.keys(categoryPools)) {
      banditState[cat] = { alpha: 1, beta: 1 };
    }

    // Update priors from session signals
    for (const id of sessionEngagedIds) {
      const art = articleMap[id];
      if (art) {
        const cat = art.category || 'Other';
        if (!banditState[cat]) banditState[cat] = { alpha: 1, beta: 1 };
        banditState[cat].alpha += 2; // Engage = strong positive
      }
    }
    for (const id of sessionSkippedIds) {
      const art = articleMap[id];
      if (art) {
        const cat = art.category || 'Other';
        if (!banditState[cat]) banditState[cat] = { alpha: 1, beta: 1 };
        banditState[cat].beta += 1; // Skip = mild negative
      }
    }

    // Thompson Sampling: sample from Beta distribution per category
    function sampleBeta(alpha, beta) {
      // Approximation using Jitter method for Beta(a,b)
      // For small a,b: use uniform jitter around mean
      const mean = alpha / (alpha + beta);
      const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
      const std = Math.sqrt(variance);
      // Box-Muller for normal sample
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
      return Math.max(0, Math.min(1, mean + z * std));
    }

    // Fill slots via Thompson Sampling with diversity
    let banditAttempts = 0;
    while (selected.length < limit && banditAttempts < limit * 3) {
      banditAttempts++;
      // Sample from each category's Beta distribution
      let bestSample = -1;
      let bestCat = null;
      for (const [cat, state] of Object.entries(banditState)) {
        if (!categoryPools[cat] || categoryPools[cat].length === 0) continue;
        const sample = sampleBeta(state.alpha, state.beta);
        if (sample > bestSample) {
          bestSample = sample;
          bestCat = cat;
        }
      }
      if (!bestCat) break;

      const pool = categoryPools[bestCat];
      const picked = mmrSelect(pool, selected, tagCache, 0.6);
      if (!picked) {
        delete categoryPools[bestCat]; // Exhausted
        continue;
      }
      if (isEventCapped(picked)) continue;

      picked.bucket = 'bandit';
      recordEventSelection(picked);
      selected.push(picked);
    }
  } else {
    // ALL personalized users: unified slot-filling via scoreUnified
    // Interest articles are merged into pPool and scored through the same formula,
    // so they compete fairly alongside personal articles in the slot pattern.
    for (let pos = 0; selected.length < limit; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      if (slot === 'P') {
        picked = mmrSelectDeduped(pPool, selected, tagCache, 0.85);
        // Collaborative fallback: articles from similar users (before trending)
        if (!picked && cPool.length > 0) {
          picked = mmrSelectDeduped(cPool, selected, tagCache, 0.8);
          if (picked) picked._bucket = 'collab';
        }
        // Personalized trending fallback: when personal pool is thin, try trending
        // articles from user's interest categories before falling back to generic trending
        if (!picked && interestCatList.length > 0) {
          for (let i = 0; i < interestCatList.length && !picked; i++) {
            const cat = interestCatList[(trendingCatIdx + i) % interestCatList.length];
            picked = mmrSelectFromCat(tPool, selected, tagCache, 0.75, cat);
          }
        }
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.8);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else if (slot === 'T') {
        // INTEREST-AWARE TRENDING: rotate through user's interest categories
        // Instead of global trending (dominated by Iran/war), pick "trending in Tech",
        // then "trending in Sports", then "trending in Science", etc.
        if (!isHoldback && interestCatList.length > 0) {
          for (let i = 0; i < interestCatList.length && !picked; i++) {
            const cat = interestCatList[(trendingCatIdx + i) % interestCatList.length];
            picked = mmrSelectFromCat(tPool, selected, tagCache, 0.85, cat);
          }
          trendingCatIdx = (trendingCatIdx + 1) % interestCatList.length;
        }
        // When interest-rotation found nothing, prefer personal over global trending.
        // Without this, a Sports/Entertainment user gets force-fed Iran/Business
        // trending articles because global trending is dominated by the war cycle.
        if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.85);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else {
        // UNDERREPRESENTED CATEGORY DISCOVERY: prefer categories barely shown so far
        // (like YouTube's "Something Completely Different" container)
        // Instead of just "non-interest categories" (which includes Politics/Business
        // dominated by Iran), pick from categories with 0-1 appearances in the feed.
        // This ensures genuine variety: Health, Entertainment, Lifestyle, etc.
        if (!isHoldback && dPool.length > 0) {
          // Change 5: Adjacent-interest discovery — prefer tags that co-occur
          // with engaged tags but aren't yet strongly in the user's profile
          const adjacentTags = new Set();
          const dTagStats = discoveryStats?._tags || {};
          for (const [t, stat] of Object.entries(dTagStats)) {
            if (stat.shown >= 2 && stat.engaged > 0 && stat.engaged / stat.shown >= 0.3) {
              if (!effectiveTagProfile[t] || effectiveTagProfile[t] < 0.15) {
                adjacentTags.add(t);
              }
            }
          }
          // Try adjacent-tag candidates first
          if (adjacentTags.size > 0) {
            for (let di = 0; di < dPool.length && !picked; di++) {
              const candidate = dPool[di];
              const cTags = safeJsonParse(candidate.interest_tags, []).map(t => t.toLowerCase());
              if (cTags.some(t => adjacentTags.has(t))) {
                const [removed] = dPool.splice(di, 1);
                if (!isEventCapped(removed)) picked = removed;
              }
            }
          }
          // Fallback: underrepresented category discovery
          if (!picked) {
            const shownCatCounts = {};
            for (const a of selected) {
              const cat = a.category || 'Other';
              shownCatCounts[cat] = (shownCatCounts[cat] || 0) + 1;
            }
            const underrepCats = [...new Set(dPool.map(a => a.category))]
              .filter(cat => (shownCatCounts[cat] || 0) <= 1)
              .sort(() => Math.random() - 0.5);
            for (const cat of underrepCats) {
              picked = mmrSelectFromCat(dPool, selected, tagCache, 0.4, cat);
              if (picked) break;
            }
          }
        }
        if (!picked) {
          // Fallback: original surprise logic
          if (Math.random() < 0.6 && dPool.length > 0) {
            picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
          } else if (pPool.length > 3) {
            const tailStart = Math.floor(pPool.length * 0.5);
            const tailEnd = pPool.length;
            if (tailStart < tailEnd) {
              const tailIdx = tailStart + Math.floor(Math.random() * (tailEnd - tailStart));
              const candidate = pPool.splice(tailIdx, 1)[0];
              if (candidate && !isEventCapped(candidate)) picked = candidate;
            }
          }
        }
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
        if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.8);
      }

      if (!picked) break;

      picked.bucket = slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : 'discovery';
      recordEventSelection(picked);
      selected.push(picked);
    }
  }

  // ==========================================
  // PHASE 7: ENFORCE MAX 2 CONSECUTIVE SAME CATEGORY
  // Final safety net — even if MMR allows it, never show 3+ in a row
  // ==========================================

  enforceConsecutiveLimit(selected, 2);

  // ==========================================
  // PHASE 8: FORMAT & RESPOND
  // ==========================================

  if (selected.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  const pageIds = selected.map(a => a.id);
  // Re-use the candidate event map we already fetched (no duplicate query)
  const eventMap = candidateEventMap;

  const formattedArticles = selected.map(a => {
    const formatted = formatArticle(a, eventMap);
    formatted.bucket = a.bucket;
    formatted.final_score = a._score;
    return formatted;
  });

  // Log feed impressions for skip tracking (fire-and-forget)
  if (userId && pageIds.length > 0) {
    const impressions = pageIds.map(aid => ({ user_id: userId, article_id: aid }));
    supabase.from('user_feed_impressions').insert(impressions).then(() => {}).catch(() => {});
  }

  // IMPROVEMENT 1: True pagination — encode actual offset in cursor
  const totalAvailable = personalScored.length + trendingScored.length + discoveryScored.length + interestScored.length + collabScored.length;
  const totalServed = offset + selected.length;
  const hasMore = totalAvailable > selected.length && totalServed < totalAvailable;
  const nextCursor = hasMore ? `v2_${totalServed}_${selected[selected.length - 1]?.id || 0}` : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: totalAvailable,
    _holdback: isHoldback,
  });
}

// ==========================================
// EXPLORATION FEED: Diverse discovery for new users
// ==========================================
// TikTok-style cold start: show the BEST article from EACH category,
// round-robin interleaved. No category dominates. The user's dwell-time
// signals (skip <3s / engage >=5s) quickly build a taste vector, and
// subsequent requests switch to the personalized V2 feed.

async function handleFallbackFeed(req, res, supabase, opts) {
  const { userPrefs, seenArticleIds, limit, offset } = opts;

  // Short cache — new users' feeds should adapt fast
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const thirtyDaysAgoCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch a large pool of articles within max shelf life window
  const { data: articles, error } = await supabase
    .from('published_articles')
    .select(ARTICLE_COLUMNS)
    .gte('created_at', thirtyDaysAgoCutoff)
    .gte('ai_final_score', 400)
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .limit(300);

  if (error) {
    console.error('Exploration feed query error:', error);
    return res.status(500).json({ error: 'Failed to fetch articles' });
  }

  if (!articles || articles.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Filter out test articles and already-seen articles
  const seenSet = new Set(seenArticleIds || []);
  const filtered = articles.filter(a => {
    if (seenSet.has(a.id)) return false;
    const url = a?.url || '';
    const title = a?.title_news || a?.title || '';
    return !(/test/i.test(url) || /test/i.test(title));
  });

  // Group by category, pick top articles per category (sorted by score)
  const byCategory = {};
  for (const a of filtered) {
    const cat = a.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  }

  // Sort categories by how many articles they have (largest first for round-robin)
  const categoryOrder = Object.keys(byCategory).sort(
    (a, b) => byCategory[b].length - byCategory[a].length
  );

  // Cap per category: max 2 articles from any single category per page of 10
  // This ensures no topic floods the exploration feed
  const maxPerCategory = Math.max(2, Math.ceil(limit / Math.max(categoryOrder.length, 1)));

  // Round-robin interleave: pick 1 from each category, repeat
  const result = [];
  const categoryPointers = {};
  for (const cat of categoryOrder) categoryPointers[cat] = 0;

  for (let round = 0; result.length < limit + 10 && round < 20; round++) {
    for (const cat of categoryOrder) {
      if (result.length >= limit + 10) break;
      const ptr = categoryPointers[cat];
      if (ptr >= byCategory[cat].length) continue;
      if (ptr >= maxPerCategory) continue;
      result.push(byCategory[cat][ptr]);
      categoryPointers[cat] = ptr + 1;
    }
  }

  // Apply offset pagination for subsequent pages
  const pageArticles = result.slice(offset, offset + limit);

  if (pageArticles.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Fetch world events
  const articleIds = pageArticles.map(a => a.id);
  const eventMap = await fetchWorldEvents(supabase, articleIds);

  // Format articles
  let formattedArticles = pageArticles.map(a => {
    const formatted = formatArticle(a, eventMap);
    formatted.bucket = 'exploration';
    formatted.final_score = a.ai_final_score || 0;
    return formatted;
  });

  // Apply tag-based personalization boost if user prefs exist
  if (userPrefs) {
    formattedArticles = formattedArticles.map(article => {
      const finalScore = calculateTagScore(article, userPrefs);
      return { ...article, final_score: finalScore };
    });
    formattedArticles.sort((a, b) => b.final_score - a.final_score);
  }

  const hasMore = result.length > offset + limit;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: result.length,
  });
}

// ==========================================
// WORLD EVENTS HELPER
// ==========================================

async function fetchWorldEvents(supabase, articleIds) {
  const eventMap = {};
  if (!articleIds || articleIds.length === 0) return eventMap;

  try {
    const { data: articleEvents } = await supabase
      .from('article_world_events')
      .select('article_id, event_id')
      .in('article_id', articleIds);

    if (articleEvents && articleEvents.length > 0) {
      const eventIds = [...new Set(articleEvents.map(ae => ae.event_id))];
      const { data: events } = await supabase
        .from('world_events')
        .select('id, name, slug')
        .in('id', eventIds);

      if (events) {
        const eventLookup = {};
        events.forEach(e => { eventLookup[e.id] = e; });
        articleEvents.forEach(ae => {
          if (eventLookup[ae.event_id]) {
            eventMap[ae.article_id] = eventLookup[ae.event_id];
          }
        });
      }
    }
  } catch (e) {
    // Non-critical — continue without events
  }

  return eventMap;
}

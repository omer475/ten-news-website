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
  // Blend: 40% freshness decay, 60% baseline (so even old evergreen content keeps value)
  return freshnessMultiplier * 0.4 + 0.6;
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

function scorePersonalV3(article, similarity, tagProfile, sessionBoosts, skipProfile) {
  const tags = safeJsonParse(article.interest_tags, []);
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const aiScore = article.ai_final_score || 0;
  const n = Math.max(tags.length, 1);

  let tagScore = 0;
  let momentumBoost = 0;
  let skipScore = 0;

  // IMPROVEMENT 4: Skip profile time decay — penalties fade over 7 days
  const SKIP_HALF_LIFE_MS = 7 * 24 * 3600000; // 7 days
  const now = Date.now();

  for (const tag of tags) {
    const t = tag.toLowerCase();
    tagScore += tagProfile[t] || 0;
    momentumBoost += sessionBoosts[t] || 0;
    if (skipProfile) {
      const entry = skipProfile[t];
      if (typeof entry === 'object' && entry !== null && entry.w) {
        // Time-stamped skip entry: { w: weight, t: timestamp }
        const age = now - new Date(entry.t || 0).getTime();
        const decay = Math.exp(-0.693 * age / SKIP_HALF_LIFE_MS);
        skipScore += entry.w * decay;
      } else if (typeof entry === 'number') {
        // Legacy flat number — apply 50% decay as default
        skipScore += entry * 0.5;
      }
    }
  }

  tagScore /= n;
  momentumBoost /= n;
  skipScore /= n;

  // Skip penalty: only penalize if skip signal > interest signal
  const netSkip = Math.max(0, skipScore - tagScore * 0.5);
  const skipPenalty = Math.min(netSkip, 0.9);

  // Tag match (350) + Session momentum (150) + Similarity (250) + Quality*Recency (250)
  const base = tagScore * 350 + momentumBoost * 150 + similarity * 250 + (aiScore / 1000) * 250 * recency;
  return base * (1 - skipPenalty);
}

function scoreTrendingV3(article) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  return (article.ai_final_score || 0) * recency;
}

function scoreDiscoveryV3(article, personalCategories) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  // Boost categories the user doesn't usually see (true discovery)
  const categoryBoost = personalCategories.has(article.category) ? 0.6 : 1.5;
  // Random factor for variable reward (surprise element)
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
    let hasInterestClusters = false;
    let persUserId = null; // The users table ID (may differ from auth user ID)

    if (userId) {
      // Look up profiles table (where real users live, id = auth UUID)
      let { data: userData } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, taste_vector, taste_vector_minilm, similarity_floor, skip_profile, tag_profile')
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

      // Extract MiniLM taste vector, skip profile, and stored tag profile
      tasteVectorMinilm = userData?.taste_vector_minilm || null;
      skipProfile = userData?.skip_profile || null;
      storedTagProfile = userData?.tag_profile || null;

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
        similarityFloor, skipProfile, storedTagProfile, seenArticleIds,
        sessionEngagedIds, sessionSkippedIds, limit, offset } = opts;
  sessionEngagedIds = sessionEngagedIds || [];
  sessionSkippedIds = sessionSkippedIds || [];

  const now = Date.now();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 3600000).toISOString();
  const seventyTwoHoursAgo = new Date(now - 72 * 3600000).toISOString();
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
  const hasAnyPersonalization = tasteVector || tasteVectorMinilm || hasInterestClusters;
  const personalMatchCount = Math.min(150 + offset, 400); // Widen pool for deeper pages
  let personalPromise;
  if (!hasAnyPersonalization) {
    personalPromise = Promise.resolve({ data: [], error: null });
  } else if (hasInterestClusters && useMinilm) {
    personalPromise = supabase.rpc('match_articles_multi_cluster_minilm', {
      p_user_id: userId, match_per_cluster: Math.min(50 + Math.floor(offset / 3), 100), hours_window: 2160,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else if (hasInterestClusters) {
    personalPromise = supabase.rpc('match_articles_multi_cluster', {
      p_user_id: userId, match_per_cluster: Math.min(50 + Math.floor(offset / 3), 100), hours_window: 2160,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else if (useMinilm) {
    personalPromise = supabase.rpc('match_articles_personal_minilm', {
      query_embedding: tasteVectorMinilm, match_count: personalMatchCount, hours_window: 2160,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else {
    personalPromise = supabase.rpc('match_articles_personal', {
      query_embedding: tasteVector, match_count: personalMatchCount, hours_window: 2160,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  }

  const [personalResult, trendingResult, discoveryResult, userInterestProfile] = await Promise.all([
    // 1. PERSONAL: pgvector similarity search
    personalPromise,

    // 2. TRENDING: high editorial score, last 24h
    // Cold-start users need more trending articles since personal pool is empty
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', hasAnyPersonalization ? twentyFourHoursAgo : fortyEightHoursAgo)
      .gte('ai_final_score', hasAnyPersonalization ? 750 : 500)
      .order('ai_final_score', { ascending: false })
      .limit(hasAnyPersonalization ? 50 : 300),

    // 3. DISCOVERY: diverse quality content, wider pool
    // Cold-start: fetch much larger pool to compensate for empty personal
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days')
      .gte('created_at', ninetyDaysAgo)
      .gte('ai_final_score', hasAnyPersonalization ? 400 : 300)
      .order('ai_final_score', { ascending: false })
      .limit(hasAnyPersonalization ? 200 : 500),

    // 4. USER INTEREST PROFILE: entity-level tag weights from engagement history
    buildUserInterestProfile(supabase, userId),
  ]);

  if (personalResult.error) {
    console.error('Personal query error (continuing with trending+discovery):', personalResult.error);
    // Continue with empty personal results — trending + discovery will fill the feed
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
    const mapping = ONBOARDING_TOPIC_MAP[topic];
    if (mapping) {
      mapping.categories.forEach(c => interestCategories.add(c));
      if (mapping.altCategories) mapping.altCategories.forEach(c => interestAltCategories.add(c));
      mapping.tags.forEach(t => interestTags.add(t.toLowerCase()));
    }
  }

  // Fetch per-category articles for followed interests
  let interestArticles = [];
  if (interestCategories.size > 0) {
    const allInterestCats = [...new Set([...interestCategories, ...interestAltCategories])];
    const catPromises = allInterestCats.map(cat =>
      supabase
        .from('published_articles')
        .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
        .eq('category', cat)
        .gte('created_at', ninetyDaysAgo)
        .gte('ai_final_score', 150)
        .order('ai_final_score', { ascending: false })
        .limit(100)
    );
    const catResults = await Promise.all(catPromises);
    for (const r of catResults) {
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
  // Cold-start users get higher caps since they have no personal pool
  const trendingCatMax = hasAnyPersonalization ? 3 : 10;
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
  // Cold-start: much higher caps to fill the feed
  const discoveryCatMax = hasAnyPersonalization ? 2 : 8;
  const discoveryTotalMax = hasAnyPersonalization ? 30 : 200;
  const discoveryCategoryCounts = {};
  const discoveryArticleMeta = [];
  for (const a of (discoveryResult.data || [])) {
    if (personalIds.has(a.id) || trendingIds.has(a.id) || seenArticleIds.includes(a.id) || sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
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
  // PHASE 5: SCORE CANDIDATES
  // ==========================================

  // Personal bucket: entity-level tag scoring with session momentum
  const personalScored = personalIdOrder
    .filter(id => articleMap[id])
    .map(id => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      return {
        ...article,
        _score: scorePersonalV3(article, similarity, effectiveTagProfile, momentum.boosts, effectiveSkipProfile),
        _similarity: similarity,
        _bucket: 'personal',
      };
    })
    .sort((a, b) => b._score - a._score);

  // Track personal categories for discovery diversity boost
  const personalCategories = new Set(personalScored.map(a => a.category));

  // Trending bucket: editorial importance x recency
  const trendingScored = trendingArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => ({
      ...articleMap[a.id],
      _score: scoreTrendingV3(articleMap[a.id]),
      _bucket: 'trending',
    }))
    .sort((a, b) => b._score - a._score);

  // Discovery bucket: boost unfamiliar categories for true exploration
  const discoveryScored = discoveryArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => ({
      ...articleMap[a.id],
      _score: scoreDiscoveryV3(articleMap[a.id], personalCategories),
      _bucket: 'discovery',
    }))
    .sort((a, b) => b._score - a._score);

  // Interest bucket: articles from user's followed topic categories
  // Boost articles whose interest_tags overlap with the user's subtopic tags
  const interestScored = interestArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const articleTags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
      // Count how many of the article's tags match the user's subtopic tags
      const tagMatches = articleTags.filter(t => interestTags.has(t)).length;
      // Base score + category boost + subtopic tag match boost
      const catBoost = interestCategories.has(a.category) ? 1.5 : 1.0;
      const tagBoost = 1.0 + (tagMatches * 0.25); // +25% per matching tag (was 15%)
      return {
        ...article,
        _score: (article.ai_final_score || 0) * catBoost * tagBoost * getRecencyDecay(article.created_at, article.category, article.shelf_life_days),
        _tagMatches: tagMatches,
        _bucket: 'interest',
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

  const SLOTS = ['P', 'P', 'T', 'P', 'P', 'S', 'P', 'P', 'T', 'S'];

  const selected = [];
  const pPool = [...personalScored];
  const tPool = [...trendingScored];
  const dPool = [...discoveryScored];
  const iPool = [...interestScored];

  // IMPROVEMENT 3: Track world event and cluster counts
  const eventCounts = {};
  const clusterCounts = {};

  function isEventCapped(article) {
    const eventId = article._world_event_id;
    const clusterId = article.cluster_id;
    if (eventId && (eventCounts[eventId] || 0) >= WORLD_EVENT_CAP) return true;
    if (clusterId && (clusterCounts[clusterId] || 0) >= CLUSTER_CAP) return true;
    return false;
  }

  function recordEventSelection(article) {
    const eventId = article._world_event_id;
    const clusterId = article.cluster_id;
    if (eventId) eventCounts[eventId] = (eventCounts[eventId] || 0) + 1;
    if (clusterId) clusterCounts[clusterId] = (clusterCounts[clusterId] || 0) + 1;
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

  // IMPROVEMENT 5: Cold-start Thompson Sampling bandit
  if (!hasAnyPersonalization) {
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
  } else if (interestCategories.size > 0 && iPool.length > 0) {
    // ==========================================
    // QUOTA-BASED PRE-FILL for users with interest selections
    // 70% of slots guaranteed for interest categories, 30% diversity
    // This ensures Sports/Gaming/etc. users actually see their topics.
    // ==========================================

    const interestSlots = Math.ceil(limit * 0.8);
    const diversitySlots = limit - interestSlots;

    // Pre-fill interest quota: per-category round-robin from interest pool
    const catQueues = {};
    for (const a of iPool) {
      const cat = a.category || 'Other';
      if (!catQueues[cat]) catQueues[cat] = [];
      catQueues[cat].push(a);
    }
    // Also pull matching articles from personal pool
    for (const a of pPool) {
      const cat = a.category || 'Other';
      if (interestCategories.has(cat) || interestAltCategories.has(cat)) {
        if (!catQueues[cat]) catQueues[cat] = [];
        catQueues[cat].push(a);
      }
    }

    const catKeys = Object.keys(catQueues);
    let catIdx = 0;
    const usedIds = new Set();

    while (selected.length < interestSlots && catKeys.length > 0) {
      const cat = catKeys[catIdx % catKeys.length];
      const queue = catQueues[cat];
      let picked = null;

      while (queue.length > 0) {
        const candidate = queue.shift();
        if (!usedIds.has(candidate.id) && !isEventCapped(candidate)) {
          picked = candidate;
          break;
        }
      }

      if (picked) {
        usedIds.add(picked.id);
        picked.bucket = 'interest';
        recordEventSelection(picked);
        selected.push(picked);
      } else {
        catKeys.splice(catIdx % catKeys.length, 1);
        if (catKeys.length === 0) break;
      }
      catIdx++;
    }

    // Fill remaining slots with standard slot-filling (diversity)
    for (let pos = 0; selected.length < limit; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      if (slot === 'P') {
        picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.8);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else if (slot === 'T') {
        picked = mmrSelectDeduped(tPool, selected, tagCache, 0.85);
        if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else {
        picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
        if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.8);
      }

      if (!picked) break;

      picked.bucket = slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : 'discovery';
      recordEventSelection(picked);
      selected.push(picked);
    }
  } else {
    // Personalized user without topic selections: standard slot-filling
    for (let pos = 0; selected.length < limit; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      if (slot === 'P') {
        picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.8);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else if (slot === 'T') {
        picked = mmrSelectDeduped(tPool, selected, tagCache, 0.85);
        if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.5);
      } else {
        // SURPRISE slot: variable reward
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
  const totalAvailable = personalScored.length + trendingScored.length + discoveryScored.length + interestScored.length;
  const totalServed = offset + selected.length;
  const hasMore = totalAvailable > selected.length && totalServed < totalAvailable;
  const nextCursor = hasMore ? `v2_${totalServed}_${selected[selected.length - 1]?.id || 0}` : null;

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: totalAvailable,
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

  const ninetyDaysAgoCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch a large pool of articles within max shelf life window
  const { data: articles, error } = await supabase
    .from('published_articles')
    .select(ARTICLE_COLUMNS)
    .gte('created_at', ninetyDaysAgoCutoff)
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

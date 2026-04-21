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
    author_id: article.author_id || null,
    author_name: article.author_name || null,
  };

  // Add world event if available
  if (eventMap[article.id]) {
    formatted.world_event = eventMap[article.id];
  }

  return formatted;
}

// ==========================================
// CONTENT-TYPE DECAY CURVES
// Reads freshness_category from DB when available.
// Falls back to category-name inference for old articles.
// Continuous 0.0-1.0 multiplier, no binary alive/dead.
// ==========================================

function decayMultiplier(contentType, ageHours) {
  // Steeper decay — old content was 43% of feed, killing engagement.
  // Fresh content had 92% engagement; >48h content had <20%.
  switch (contentType) {
    case 'breaking':
      // 1.0→0.3@6h→0.08@12h→0.02@24h (was 0.5@6h)
      return Math.max(0.02, Math.exp(-0.20 * ageHours));
    case 'developing':
      // 1.0→0.5@24h→0.15@48h→0.04@72h (was 0.7@24h)
      return Math.max(0.02, Math.exp(-0.03 * ageHours));
    case 'analysis':
      // 1.0→0.7@24h→0.4@48h→0.15@72h (was 0.85@24h)
      return Math.max(0.02, Math.exp(-0.015 * ageHours));
    case 'evergreen':
      // 1.0→0.8@24h→0.5@72h→0.2@7d (was 0.9@24h)
      return Math.max(0.02, Math.exp(-0.008 * ageHours));
    case 'timeless':
      // 1.0→0.9@48h→0.7@7d→0.35@30d (was 0.95@48h)
      return Math.max(0.02, Math.exp(-0.0015 * ageHours));
    default:
      return Math.max(0.02, Math.exp(-0.03 * ageHours)); // developing default
  }
}

function inferContentType(freshnessCategory, category, shelfLifeDays) {
  // Use DB field when populated with valid value
  const validTypes = new Set(['breaking', 'developing', 'analysis', 'evergreen', 'timeless']);
  if (freshnessCategory && validTypes.has(freshnessCategory)) return freshnessCategory;

  // Use shelf_life_days as hint
  if (shelfLifeDays && shelfLifeDays <= 1) return 'breaking';
  if (shelfLifeDays && shelfLifeDays <= 3) return 'developing';
  if (shelfLifeDays && shelfLifeDays >= 14) return 'evergreen';

  // Fallback: infer from category name (for old articles with null fields)
  const cat = (category || '').toLowerCase();
  if (cat === 'sports') return 'breaking';
  if (cat === 'world' || cat === 'politics' || cat === 'finance') return 'developing';
  if (cat === 'business' || cat === 'tech' || cat === 'entertainment') return 'developing';
  if (cat === 'science' || cat === 'health') return 'evergreen';
  if (cat === 'lifestyle') return 'evergreen';
  return 'developing';
}

function getRecencyDecay(createdAt, category, shelfLifeDays, freshnessCategory) {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const contentType = inferContentType(freshnessCategory, category, shelfLifeDays);
  return decayMultiplier(contentType, ageHours);
}

// Is the article still within its peak relevance window?
// Used to separate "fresh unseen" from "stale unseen" in three-tier slot filling.
function isStillFresh(article) {
  const ageHours = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
  const contentType = inferContentType(article.freshness_category, article.category, article.shelf_life_days);
  switch (contentType) {
    // Extended 2026-04-18 post-Phase-1: typed_signals give 12-signal
    // personalization coverage, so editorial-relevance decay is no longer
    // the binding constraint on inclusion. breaking 24→48h, developing 72→120h.
    case 'breaking':   return ageHours < 48;
    case 'developing': return ageHours < 120;
    case 'analysis':   return ageHours < 168;
    case 'evergreen':  return ageHours < 168;
    case 'timeless':   return ageHours < 336;
    default:           return ageHours < 120;
  }
}

// ══════════════════════════════════════════════════════════════
// UNIFIED ENTITY AFFINITY (replaces dual tag_profile + skip_profile)
//
// Single engagement-rate-based score per entity.
// Positive interactions / total interactions → ratio.
// Recent behavior weighted 70%, all-time 30%.
// Range: -1.0 (always skip) to +1.0 (always engage).
// Multiplier: 0.2x at -1.0, 1.0x at 0, 1.8x at +1.0.
// ══════════════════════════════════════════════════════════════

// Legacy computeEntityAffinity removed — replaced by tanh version at line 614+

// Map onboarding topic names to entity tags for the floor protection
const ONBOARDING_ENTITY_MAP = {
  'NBA': ['nba', 'basketball'],
  'NFL': ['nfl', 'american football', 'quarterback'],
  'Soccer/Football': ['soccer', 'football', 'premier league', 'la liga', 'champions league'],
  'MLB/Baseball': ['mlb', 'baseball', 'world series'],
  'Cricket': ['cricket', 'ipl', 'test match'],
  'F1 & Motorsport': ['f1', 'formula one', 'formula 1', 'grand prix', 'motorsport'],
  'Boxing & MMA/UFC': ['boxing', 'mma', 'ufc'],
  'Olympics & Paralympics': ['olympics', 'olympic'],
  'War & Conflict': ['war', 'conflict', 'military'],
  'US Politics': ['us politics', 'congress', 'senate', 'white house'],
  'European Politics': ['european politics', 'eu', 'european union'],
  'Asian Politics': ['china', 'india', 'japan'],
  'Middle East': ['middle east', 'iran', 'israel', 'saudi arabia'],
  'AI & Machine Learning': ['artificial intelligence', 'machine learning', 'ai', 'llm'],
  'Smartphones & Gadgets': ['smartphone', 'iphone', 'samsung', 'android'],
  'Social Media': ['social media', 'tiktok', 'instagram', 'twitter'],
  'Cybersecurity': ['cybersecurity', 'hacking', 'data breach'],
  'Space Tech': ['spacex', 'nasa', 'rocket', 'satellite'],
  'Movies & Film': ['movies', 'film', 'box office', 'cinema'],
  'TV & Streaming': ['netflix', 'streaming', 'hbo', 'disney plus'],
  'Music': ['music', 'album', 'concert'],
  'Gaming': ['gaming', 'video games', 'playstation', 'xbox'],
  'K-Pop & K-Drama': ['k-pop', 'k-drama', 'korean'],
  'Stock Markets': ['stock market', 'wall street', 'nasdaq', 'stocks'],
  'Banking & Lending': ['banking', 'interest rate', 'federal reserve'],
  'Bitcoin': ['bitcoin', 'btc'],
  'DeFi & Web3': ['defi', 'web3', 'blockchain'],
  'Space & Astronomy': ['space', 'astronomy', 'mars', 'telescope'],
  'Climate & Environment': ['climate', 'environment', 'global warming'],
  'Medical Breakthroughs': ['medical', 'treatment', 'clinical trial'],
  'Public Health': ['public health', 'vaccine', 'pandemic'],
  'Oil & Energy': ['oil', 'energy', 'opec', 'natural gas'],
  'Corporate Deals': ['merger', 'acquisition', 'ipo'],
  'Trade & Tariffs': ['trade', 'tariffs', 'sanctions'],
};

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
    .in('event_type', ['article_liked', 'article_shared', 'article_saved', 'article_engaged', 'article_detail_view'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!events || events.length === 0) return null;

  // Weight by engagement type: liked > shared > saved > engaged > viewed
  // article_liked is the strongest signal — explicit "I want more of this"
  // article_shared is second — user vouches for this content to others
  const eventWeights = { article_liked: 4, article_shared: 3.5, article_saved: 3, article_engaged: 2, article_detail_view: 1 };
  const articleWeights = {};
  for (const e of events) {
    let w = eventWeights[e.event_type] || 1;
    // Professional tiered dwell weighting (TikTok/Pinterest style)
    // Uses continuous multiplier with tier-based floors for precision
    const dwellSeconds = e.metadata?.dwell ? parseFloat(e.metadata.dwell) :
                         e.metadata?.total_active_seconds ? parseFloat(e.metadata.total_active_seconds) : 0;
    const dwellTier = e.metadata?.dwell_tier || '';
    if (dwellSeconds > 0) {
      // Tiered multipliers: the longer someone reads, the stronger the signal
      //   0-1s   instant_skip → 0.3x (strong negative handled by skip_profile)
      //   1-3s   quick_skip   → 0.5x
      //   3-6s   glance       → 0.8x (neutral, slight interest)
      //   6-12s  light_read   → 1.2x (mild interest)
      //   12-25s engaged_read → 2.0x (strong interest)
      //   25-45s deep_read    → 3.0x (very strong interest)
      //   45s+   absorbed     → 4.0x (maximum signal)
      let dwellMultiplier;
      if (dwellTier === 'absorbed' || dwellSeconds >= 45) dwellMultiplier = 4.0;
      else if (dwellTier === 'deep_read' || dwellSeconds >= 25) dwellMultiplier = 3.0;
      else if (dwellTier === 'engaged_read' || dwellSeconds >= 12) dwellMultiplier = 2.0;
      else if (dwellTier === 'light_read' || dwellSeconds >= 6) dwellMultiplier = 1.2;
      else if (dwellTier === 'glance' || dwellSeconds >= 3) dwellMultiplier = 0.8;
      else if (dwellSeconds >= 1) dwellMultiplier = 0.5;
      else dwellMultiplier = 0.3;
      w *= dwellMultiplier;
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
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);
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

  // All components multiplied by recency — prevents old articles from dominating
  const base = (tagScore * 350 + momentumBoost * 150 + similarity * 250 + (aiScore / 1000) * 250) * recency;
  return base * (1 - skipPenalty);
}

// ==========================================
// V3 SCORING: vector_score×500 + entity_bonus×200 + quality×200 + freshness×100 + session_boost×150
// ==========================================

// ══════════════════════════════════════════════════════════════
// SKIP PENALTY HELPER — used by ALL scoring functions
// Reads skip_profile to penalize content the user explicitly skipped.
// entitySignalMultiplier consolidated to single closure in handleV2Feed
// (reads typed_signals, squared formula). Module-level computeEntityAffinity
// (tanh version reading positive_7d/negative_24h) removed — superseded by
// closure at handleV2Feed which uses positive_count/negative_count directly.

// ══════════════════════════════════════════════════════════════
// LEGACY SKIP PENALTY — kept as fallback when entity_signals unavailable
// ══════════════════════════════════════════════════════════════
function computeSkipPenalty(article, userSkipProfile) {
  if (!userSkipProfile || typeof userSkipProfile !== 'object') return 0;
  const tags = safeJsonParse(article.interest_tags, []);
  let penalty = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    const w = userSkipProfile[t];
    if (w && w > 0) penalty += w;
  }
  return Math.min(penalty, 0.80); // cap — don't fully zero out
}

// Change 1: Blend long-term + session vectors.
// Typed-signal multiplier applied externally (see handleV2Feed closure).

function scoreArticleV3(article, similarity, entityAffinities, sessionBoost, sessionVectorSim, sessionInteractionCount) {
  const longTermScore = similarity || 0;
  const sessionScore = sessionVectorSim || 0;
  // Fix 10: Adaptive weighting — more session data = more session weight
  let vectorScore;
  if (sessionScore > 0) {
    const sessionCount = sessionInteractionCount || 0;
    const sessionWeight = Math.min(0.85, 0.30 + sessionCount * 0.03);
    // 0 interactions → 0.30 session, 10 → 0.60, 20+ → 0.85
    vectorScore = longTermScore * (1 - sessionWeight) + sessionScore * sessionWeight;
  } else {
    vectorScore = longTermScore;
  }

  const tags = safeJsonParse(article.interest_tags, []);
  let entityBonus = 0;
  let matchCount = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    // Exact match first
    let affinity = entityAffinities[t];
    // Fix 9: Fuzzy match — if no exact match, check if any affinity entity contains/is contained by this tag
    if (!affinity || affinity <= 0) {
      for (const [entity, score] of Object.entries(entityAffinities)) {
        if (score <= 0) continue;
        if ((t.length > 3 && entity.includes(t)) || (entity.length > 3 && t.includes(entity))) {
          affinity = score * 0.6; // 60% of exact match strength
          break;
        }
      }
    }
    if (affinity && affinity > 0) {
      entityBonus += 0.10 * affinity;
      matchCount++;
      if (matchCount >= 3) break;
    }
  }
  const totalTags = Math.max(tags.length, 1);
  entityBonus = Math.min(entityBonus * (matchCount / totalTags), 0.30);

  const quality = (article.ai_final_score || 0) / 1000;
  const momentum = sessionBoost || 0;
  const recencyDecay = getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);

  return (vectorScore * 500 + entityBonus * 200 + quality * 200 + momentum * 150) * recencyDecay;
}

function scoreTrendingV3(article, userSkipProfile) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);
  const baseScore = (article.ai_final_score || 0) * recency;
  // Entity signal multiplier applied externally (squared) — not here
  const skipPenalty = computeSkipPenalty(article, userSkipProfile);
  const skipMultiplier = Math.max(0.10, 1.0 - skipPenalty);
  return baseScore * skipMultiplier;
}

function scoreDiscoveryV3(article, personalCategories, userSkipProfile) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);
  const categoryBoost = personalCategories.has(article.category) ? 0.6 : 1.5;
  const surprise = 1 + Math.random() * 0.4;
  const baseScore = (article.ai_final_score || 0) * recency * categoryBoost * surprise;
  const skipPenalty = computeSkipPenalty(article, userSkipProfile);
  const skipMultiplier = Math.max(0.10, 1.0 - skipPenalty);
  return baseScore * skipMultiplier;
}

// ==========================================
// MMR SELECTION (Maximal Marginal Relevance)
// Uses embedding cosine similarity to detect same-story articles.
// Checks against ALL selected articles (not just last 5).
// Falls back to tag Jaccard when embeddings unavailable.
// ==========================================

function cosineSimilarityVec(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  const denom = Math.sqrt(nA) * Math.sqrt(nB);
  return denom === 0 ? 0 : dot / denom;
}

function buildEmbeddingCache(articles) {
  const cache = new Map();
  for (const a of articles) {
    const emb = safeJsonParse(a.embedding_minilm, null);
    if (emb && Array.isArray(emb) && emb.length > 0) {
      cache.set(a.id, emb);
    }
  }
  return cache;
}

function buildTagSetsCache(articles) {
  const cache = new Map();
  for (const a of articles) {
    const tags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
    cache.set(a.id, new Set(tags));
  }
  return cache;
}

function mmrSelect(candidates, selected, tagCache, lambda, embeddingCache) {
  if (candidates.length === 0) return null;
  if (selected.length === 0) return candidates.shift();

  const maxScore = Math.max(...candidates.map(c => c._score), 1);
  let bestIdx = 0;
  let bestMMR = -Infinity;

  // Check diversity against ALL selected articles
  // Hard ceiling: reject candidates too similar to any selected article
  // 0.90 was too lenient — Artemis articles at 0.60-0.79 similarity slipped through
  const DUPLICATE_CEILING = 0.70;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normScore = c._score / maxScore;

    let maxSim = 0;
    let isDuplicate = false;
    const cEmb = embeddingCache ? embeddingCache.get(c.id) : null;
    const cTags = tagCache.get(c.id) || new Set();

    for (const s of selected) {
      let sim = 0;
      const sEmb = embeddingCache ? embeddingCache.get(s.id) : null;

      if (cEmb && sEmb) {
        sim = Math.max(0, cosineSimilarityVec(cEmb, sEmb));
        // Hard ceiling: reject if too similar to ANY already-selected article
        if (sim > DUPLICATE_CEILING) { isDuplicate = true; break; }
      } else {
        const sTags = tagCache.get(s.id) || new Set();
        let intersection = 0;
        for (const t of cTags) {
          if (sTags.has(t)) intersection++;
        }
        const unionSize = new Set([...cTags, ...sTags]).size;
        sim = unionSize > 0 ? intersection / unionSize : 0;
      }
      if (c.category === s.category) sim = Math.max(sim, 0.45); // was 0.3 — stronger category diversity
      maxSim = Math.max(maxSim, sim);
    }

    // Skip duplicates entirely — don't even score them
    if (isDuplicate) continue;

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

  // home_country and followed_countries bonuses removed.
  // Country affinity is now handled by typed entity signals (loc:turkiye, etc.)
  // Onboarding seeds initial location signals; engagement accumulates real ones.

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
  'image_url', 'image_source', 'image_score', 'image_ai_generated',
  'published_at', 'created_at',
  'ai_final_score', 'summary_bullets_news',
  'five_ws', 'timeline', 'graph', 'map', 'details',
  'components_order', 'components', 'countries', 'topics',
  'country_relevance', 'topic_relevance', 'interest_tags', 'typed_signals',
  'num_sources', 'cluster_id', 'version_number', 'view_count',
  'shelf_life_days', 'freshness_category',
  'embedding_minilm',
  'author_id', 'author_name',
].join(', ');

// Lightweight columns for pool construction (no heavy JSONB).
// typed_signals included for Fix 1C (empty-signal filter) + 1A (dispersion).
// image_score / image_ai_generated included for Fix 1E (Pinterest-style image feature).
const POOL_COLUMNS = [
  'id', 'title_news', 'category', 'created_at', 'published_at',
  'ai_final_score', 'interest_tags', 'typed_signals',
  'image_score', 'image_ai_generated',
  'cluster_id', 'shelf_life_days', 'freshness_category',
  'author_id',
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
    // Stable identifier so all impressions in the same feed request can be
    // joined back together for slate-level analysis (group cohesion, slot
    // dependencies, IPS off-policy). Web Crypto when available, fallback otherwise.
    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
    const homeCountry = req.query.home_country || null;
    const followedCountries = req.query.followed_countries ? req.query.followed_countries.split(',') : [];
    const followedTopics = req.query.followed_topics ? req.query.followed_topics.split(',') : [];
    const userId = req.query.user_id || null;
    const guestDeviceId = req.query.guest_device_id || null;

    // Session signals from client (real-time skip/engage tracking)
    const sessionEngagedIds = req.query.engaged_ids ? req.query.engaged_ids.split(',').map(Number).filter(Boolean) : [];
    const sessionGlancedIds = req.query.glanced_ids ? req.query.glanced_ids.split(',').map(Number).filter(Boolean) : [];
    const sessionSkippedIds = req.query.skipped_ids ? req.query.skipped_ids.split(',').map(Number).filter(Boolean) : [];
    // Client-sent seen IDs for dedup (prevents repeats even for guests without server events)
    const clientSeenIds = req.query.seen_ids ? req.query.seen_ids.split(',').map(Number).filter(Boolean) : [];

    // ==========================================
    // LOAD USER DATA (v3: personalization_profiles first, fallback to profiles)
    // ==========================================

    let userPrefs = null;
    let tasteVector = null;
    let tasteVectorMinilm = null;
    let skipProfile = null;
    let storedTagProfile = null;
    let hasInterestClusters = false;
    let persUserId = null; // The users table ID (may differ from auth user ID)
    let personalizationId = null;
    let clusterLookupId = null;
    let clusterLookupColumn = 'user_id';
    let userPhase = 1;
    let totalInteractions = 0;
    let sessionTasteVector = null; // Change 1: short-term session vector

    // Try v3 personalization_profiles first (non-blocking — falls back to profiles if fails)
    if (userId || guestDeviceId) {
      try {
        // Direct query fallback: resolve_personalization_id RPC may not be deployed
        let persResolved = false;

        // Try RPC first
        try {
          const rpcParams = userId
            ? { p_auth_id: userId }
            : { p_device_id: guestDeviceId };
          const { data: persData, error: persError } = await supabase.rpc('resolve_personalization_id', rpcParams);
          if (!persError && persData && persData.length > 0) {
            personalizationId = persData[0].personalization_id;
            userPhase = persData[0].phase;
            totalInteractions = persData[0].total_interactions;
            persResolved = true;
          }
        } catch (rpcErr) {
          // RPC not available — fall back to direct query
        }

        // Direct query fallback if RPC failed
        if (!persResolved) {
          const lookupCol = userId ? 'auth_profile_id' : 'guest_device_id';
          const lookupVal = userId || guestDeviceId;
          const { data: directData } = await supabase
            .from('personalization_profiles')
            .select('personalization_id, phase, total_interactions')
            .eq(lookupCol, lookupVal)
            .limit(1);
          if (directData && directData.length > 0) {
            personalizationId = directData[0].personalization_id;
            userPhase = directData[0].phase;
            totalInteractions = directData[0].total_interactions;
            persResolved = true;
          }
        }

        if (persResolved) {

          // Load BOTH long-term taste vector AND session vector (Change 1)
          const { data: ppData } = await supabase
            .from('personalization_profiles')
            .select('taste_vector_minilm, session_taste_vector_minilm')
            .eq('personalization_id', personalizationId)
            .single();
          if (ppData?.taste_vector_minilm) {
            tasteVectorMinilm = ppData.taste_vector_minilm;
          }
          // Fix 3C: Contrastive session vector — compute from engagement buffer
          // Instead of using the naive averaged session vector, build one that
          // actively moves AWAY from skipped content (politics, crypto, etc.)
          if (ppData?.session_taste_vector_minilm) {
            try {
              const { data: bufferEntries } = await supabase
                .from('engagement_buffer')
                .select('embedding_minilm, interaction_weight')
                .eq('personalization_id', personalizationId)
                .order('created_at', { ascending: false })
                .limit(50);

              if (bufferEntries && bufferEntries.length >= 3) {
                const positives = bufferEntries.filter(e => e.interaction_weight > 0 && e.embedding_minilm);
                const negatives = bufferEntries.filter(e => e.interaction_weight < 0 && e.embedding_minilm);

                if (positives.length > 0) {
                  const dim = 384;
                  // Weighted positive centroid
                  const posCentroid = new Array(dim).fill(0);
                  let totalPosW = 0;
                  for (const entry of positives) {
                    const emb = Array.isArray(entry.embedding_minilm) ? entry.embedding_minilm : safeJsonParse(entry.embedding_minilm, null);
                    if (!emb || emb.length !== dim) continue;
                    const w = Math.abs(entry.interaction_weight);
                    totalPosW += w;
                    for (let i = 0; i < dim; i++) posCentroid[i] += emb[i] * w;
                  }
                  if (totalPosW > 0) {
                    for (let i = 0; i < dim; i++) posCentroid[i] /= totalPosW;
                  }

                  // Contrastive: subtract negative centroid if available
                  if (negatives.length >= 2) {
                    const negCentroid = new Array(dim).fill(0);
                    for (const entry of negatives) {
                      const emb = Array.isArray(entry.embedding_minilm) ? entry.embedding_minilm : safeJsonParse(entry.embedding_minilm, null);
                      if (!emb || emb.length !== dim) continue;
                      for (let i = 0; i < dim; i++) negCentroid[i] += emb[i];
                    }
                    for (let i = 0; i < dim; i++) negCentroid[i] /= negatives.length;

                    // Contrastive vector: pos - 0.3 * neg, then L2 normalize
                    const contrastive = new Array(dim);
                    let norm = 0;
                    for (let i = 0; i < dim; i++) {
                      contrastive[i] = posCentroid[i] - 0.3 * negCentroid[i];
                      norm += contrastive[i] * contrastive[i];
                    }
                    norm = Math.sqrt(norm);
                    if (norm > 0) {
                      for (let i = 0; i < dim; i++) contrastive[i] /= norm;
                    }
                    sessionTasteVector = contrastive;
                  } else {
                    sessionTasteVector = posCentroid;
                  }
                } else {
                  sessionTasteVector = ppData.session_taste_vector_minilm;
                }
              } else {
                sessionTasteVector = ppData.session_taste_vector_minilm;
              }
            } catch (bufferErr) {
              // Fall back to stored session vector on any error
              sessionTasteVector = ppData.session_taste_vector_minilm;
            }
          }
        }
      } catch (e) {
        // V3 not available or user not in personalization_profiles — continue with legacy
        console.log('[feed] personalization_profiles lookup failed, using legacy:', e.message);
      }
    }

    if (userId) {
      // Load profiles table for prefs + legacy taste vectors
      // Use limit(1) instead of .single() — some users have duplicate rows
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, followed_topics, taste_vector, taste_vector_minilm, similarity_floor')
        .eq('id', userId)
        .limit(1);
      let userData = profileRows?.[0] || null;

      if (!userData) {
        // Fallback: try legacy users table
        const { data: legacyRows } = await supabase
          .from('users')
          .select('id, followed_topics, taste_vector, taste_vector_minilm')
          .eq('id', userId)
          .limit(1);
        if (!legacyRows?.[0]) {
          const { data: linkedRows } = await supabase
            .from('users')
            .select('id, followed_topics, taste_vector, taste_vector_minilm')
            .eq('auth_user_id', userId)
            .limit(1);
          if (linkedRows?.[0]) userData = linkedRows[0];
        } else {
          userData = legacyRows[0];
        }
      }

      if (userData) {
        userPrefs = userData;
        tasteVector = userData.taste_vector;
        persUserId = userData.id;
      }

      // Use personalization_profiles taste vector if available (v3), else fall back to profiles
      if (!tasteVectorMinilm) {
        tasteVectorMinilm = userData?.taste_vector_minilm || null;
      }
      // skip_profile and tag_profile removed — replaced by typed entity signals
      skipProfile = null;
      storedTagProfile = null;

      // Fix 1: Use personalizationId (V3 clusters) instead of persUserId (legacy clusters with 0 importance)
      clusterLookupId = personalizationId || persUserId;
      clusterLookupColumn = personalizationId ? 'personalization_id' : 'user_id';
      if ((tasteVector || tasteVectorMinilm) && clusterLookupId) {
        const { count } = await supabase
          .from('user_interest_clusters')
          .select('id', { count: 'exact', head: true })
          .eq(clusterLookupColumn, clusterLookupId)
          .neq('suppressed', true);
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
    // LOAD FOLLOWED PUBLISHERS
    // ==========================================

    let followedPublisherIds = new Set();
    if (userId) {
      try {
        const { data: follows } = await supabase
          .from('user_follows')
          .select('publisher_id')
          .eq('user_id', userId);
        if (follows && follows.length > 0) {
          followedPublisherIds = new Set(follows.map(f => f.publisher_id));
        }
      } catch (e) {}
    }

    // ==========================================
    // GET SEEN ARTICLE IDS (for dedup across pages)
    // ==========================================

    // ══════════════════════════════════════════════════════════════
    // SESSION-AWARE SEEN ARCHITECTURE (TikTok model)
    //
    // Two separate dedup systems:
    //   1. SESSION DEDUP (client-sent seen_ids) → HARD EXCLUDE from pools
    //      Prevents within-session repeats. Pool shrinks by exactly 25/page.
    //   2. BADGE CLASSIFICATION (server events, last 6h) → badge only, no exclusion
    //      Articles seen earlier today get "Read Xh ago" badge.
    //      Articles seen 6h+ ago → fully fresh, no badge (like TikTok).
    // ══════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════
    // CANONICAL SEEN SET — ONE set, ONE source of truth for all dedup.
    // Every pool filter, SQL exclusion, and tier classification uses this.
    // Never create a separate seen variable. Add sources here, read from canonicalSeenIds.
    // ══════════════════════════════════════════════════════════════

    const canonicalSeenIds = new Set();

    // Source 1: Server-side impressions (last 14 days) — authoritative serving log
    // Power users have 6000+ impression rows — fetch ALL unique IDs, not limited rows
    if (persUserId || userId) {
      try {
        // Fetch in batches to get all unique article IDs despite Supabase row limits
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: impressions } = await supabase
            .from('user_feed_impressions')
            .select('article_id')
            .eq('user_id', userId)
            .gte('created_at', new Date(Date.now() - 14 * 24 * 3600000).toISOString())
            .order('created_at', { ascending: false })
            .range(offset, offset + batchSize - 1);
          if (impressions && impressions.length > 0) {
            for (const i of impressions) if (i.article_id) canonicalSeenIds.add(Number(i.article_id));
            offset += impressions.length;
            hasMore = impressions.length === batchSize;
          } else {
            hasMore = false;
          }
        }
      } catch (e) { /* table may not exist yet */ }
    }

    // Source 2: Client-sent seen IDs (current session + ReadingHistoryManager)
    for (const id of clientSeenIds.filter(Boolean)) canonicalSeenIds.add(Number(id));

    // Source 3: Engagement events (catches articles user reacted to)
    if (persUserId || userId) {
      try {
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: eventIds } = await supabase
            .from('user_article_events')
            .select('article_id')
            .eq('user_id', userId)
            .gte('created_at', new Date(Date.now() - 14 * 24 * 3600000).toISOString())
            .order('created_at', { ascending: false })
            .range(offset, offset + batchSize - 1);
          if (eventIds && eventIds.length > 0) {
            for (const e of eventIds) if (e.article_id) canonicalSeenIds.add(Number(e.article_id));
            offset += eventIds.length;
            hasMore = eventIds.length === batchSize;
          } else {
            hasMore = false;
          }
        }
      } catch (e) { /* non-blocking */ }
    }

    // Source 4 (Fix 1B): Twitter-style 10-min / 100-ID rolling exclusion.
    // Recently-served articles are hard-excluded even if they never hit the
    // impression log (race with async insert) or the event table (user didn't
    // react yet). Keeps feed responses independent across rapid pagination.
    if (userId) {
      try {
        const { data: recent } = await supabase
          .from('user_recent_impressions')
          .select('article_id')
          .eq('user_id', userId)
          .gte('served_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .order('served_at', { ascending: false })
          .limit(100);
        if (recent) {
          for (const r of recent) if (r.article_id) canonicalSeenIds.add(Number(r.article_id));
        }
      } catch (e) { /* table may not exist yet */ }
    }

    console.log(`[dedup] Canonical seen set: ${canonicalSeenIds.size} unique IDs`);

    // Badge metadata — separate from dedup, used for "Read Xh ago" badge on resurfaced articles
    const seenMeta = new Map();
    if (persUserId || userId) {
      const { data: seenMetaResult } = await supabase
        .from('user_article_events')
        .select('article_id, event_type, created_at')
        .eq('user_id', userId)
        .in('event_type', ['article_engaged', 'article_liked'])
        .gte('created_at', new Date(Date.now() - 7 * 24 * 3600000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (seenMetaResult) {
        for (const event of seenMetaResult) {
          const aid = event.article_id;
          const isEngaged = event.event_type === 'article_engaged' || event.event_type === 'article_liked';
          const existing = seenMeta.get(aid);
          if (!existing) {
            seenMeta.set(aid, { first_seen_at: event.created_at, was_engaged: isEngaged });
          } else {
            if (event.created_at < existing.first_seen_at) existing.first_seen_at = event.created_at;
            if (isEngaged) existing.was_engaged = true;
          }
        }
      }
    }

    // Legacy aliases — point to canonicalSeenIds for backward compat in handleV2Feed
    const seenArticleIds = [...canonicalSeenIds];
    const allSeenIds = seenArticleIds;

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
      allSeenIds,
      canonicalSeenIds,
      seenMeta,
      totalInteractions,
      sessionEngagedIds,
      sessionGlancedIds,
      sessionSkippedIds,
      personalizationId,
      sessionTasteVector,
      usedTempTasteVector: false,
      followedPublisherIds,
      clusterLookupId,
      clusterLookupColumn,
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
  const _feedT0 = Date.now();  // Fix J timing monitor
  let { userId, userPrefs, tasteVector, tasteVectorMinilm, hasInterestClusters,
        similarityFloor, skipProfile, storedTagProfile, seenArticleIds, allSeenIds,
        canonicalSeenIds, seenMeta, totalInteractions,
        sessionEngagedIds, sessionGlancedIds, sessionSkippedIds,
        personalizationId, sessionTasteVector, usedTempTasteVector, followedPublisherIds,
        clusterLookupId, clusterLookupColumn, limit, offset } = opts;
  // requestId is declared in handler() scope and not automatically visible here
  // (handleV2Feed is a sibling function). Recreate it locally so the impression
  // insert below can stamp every row with a stable per-request id. Web Crypto
  // first, fallback otherwise.
  const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
  totalInteractions = totalInteractions || 0;
  canonicalSeenIds = canonicalSeenIds || new Set();
  allSeenIds = allSeenIds || [];
  seenMeta = seenMeta || new Map();
  followedPublisherIds = followedPublisherIds || new Set();
  sessionEngagedIds = sessionEngagedIds || [];
  sessionGlancedIds = sessionGlancedIds || [];
  sessionSkippedIds = sessionSkippedIds || [];

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 3600000).toISOString();
  const seventyTwoHoursAgo = new Date(now - 72 * 3600000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 3600000).toISOString();
  const fortyEightHoursAgo = new Date(now - 48 * 3600000).toISOString();

  // Personalized feed — no shared/CDN caching, each user gets unique results
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  // ==========================================
  // PHASE 1: PARALLEL DATA LOADING
  // ==========================================

  // Filter to valid positive integers — null/NaN/0 cause SQL errors
  const cleanSeenArray = [...canonicalSeenIds].filter(id => Number.isFinite(id) && id > 0);
  const excludeIds = cleanSeenArray.length > 0 ? cleanSeenArray.slice(0, 1500) : null;
  const minSim = similarityFloor || 0;
  const useMinilm = !!tasteVectorMinilm;

  // Build personal candidate query (pgvector ANN search)
  // NOTE: Change 1 (temp taste vector) disabled — causes 504 timeouts
  // on Vercel due to extra embedding fetches. Needs optimization before re-enabling.
  let hasAnyPersonalization = tasteVector || tasteVectorMinilm || hasInterestClusters;

  // Fix 2 (2026-04-18): anti-join variants replace the old exclude_ids pattern.
  // NOT EXISTS against user_feed_impressions with (user_id, article_id) index
  // is sub-ms per candidate regardless of history size. Leaves the legacy RPCs
  // in place as fallbacks when no userId is available.
  let personalPromise;
  if (!hasAnyPersonalization) {
    personalPromise = Promise.resolve({ data: [], error: null });
  } else if (hasInterestClusters && useMinilm && userId) {
    personalPromise = supabase.rpc('match_articles_multi_cluster_minilm_antijoin', {
      p_user_id: clusterLookupId, match_per_cluster: 10, hours_window: 168,
      min_similarity: minSim,
    });
  } else if (hasInterestClusters && useMinilm) {
    personalPromise = supabase.rpc('match_articles_multi_cluster_minilm', {
      p_user_id: clusterLookupId, match_per_cluster: 10, hours_window: 168,
      exclude_ids: null, min_similarity: minSim,
    });
  } else if (hasInterestClusters) {
    personalPromise = supabase.rpc('match_articles_multi_cluster', {
      p_user_id: clusterLookupId, match_per_cluster: 10, hours_window: 168,
      exclude_ids: null, min_similarity: minSim,
    });
  } else if (useMinilm && userId) {
    personalPromise = supabase.rpc('match_articles_personal_minilm_antijoin', {
      p_user_id: userId, query_embedding: tasteVectorMinilm,
      match_count: 800, hours_window: 9999, min_similarity: minSim,
    });
  } else if (useMinilm) {
    personalPromise = supabase.rpc('match_articles_personal_minilm', {
      query_embedding: tasteVectorMinilm, match_count: 800, hours_window: 9999,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  } else {
    personalPromise = supabase.rpc('match_articles_personal', {
      query_embedding: tasteVector, match_count: 800, hours_window: 9999,
      exclude_ids: excludeIds, min_similarity: minSim,
    });
  }

  const fortyEightHoursAgoISO = new Date(now - 48 * 3600000).toISOString();

  const [personalResult, trendingResult, discoveryResult, userInterestProfile, recentEngagedResult, freshBestResult] = await Promise.all([
    // 1. PERSONAL: pgvector similarity search (catch timeout → empty)
    Promise.resolve(personalPromise).catch(err => {
      console.error('[feed] Personal query threw:', err?.message || err);
      return { data: [], error: err };
    }),

    // 2. TRENDING: per-category unseen via anti-join RPC when authenticated.
    // Fix 2 (2026-04-18): old JS pattern NOT IN (<1500 seen IDs>) was partial
    // (let 3.6k seen articles return from SQL to be filtered JS-side) and
    // URL-length bound. RPC does NOT EXISTS anti-join against
    // user_feed_impressions, returning only truly-unseen candidates.
    // Fix J (2026-04-19): per-category limit bumps to 300 when this isn't the
    // first request of the session (sessionInteractionCount > 0). Heavy users
    // exhaust the 200/cat pool by page 5-6; the larger fetch extends runway
    // without requiring a mid-request second round-trip.
    (async () => {
      const TRENDING_CATS = ['Business', 'Tech', 'Science', 'Entertainment', 'Sports', 'Politics', 'World', 'Health', 'Finance', 'Lifestyle', 'Crypto'];
      const _sessionHasActivity = (sessionSkippedIds?.length || 0) + (sessionEngagedIds?.length || 0) + (sessionGlancedIds?.length || 0) > 0;
      const _perCat = _sessionHasActivity ? 300 : 200;
      if (userId) {
        const { data, error } = await supabase.rpc('fetch_unseen_per_category', {
          p_user_id: userId,
          p_categories: TRENDING_CATS,
          p_min_score: 400,
          p_hours_window: 168,
          p_per_category: _perCat,
        });
        return { data: data || [], error };
      }
      // Guest fallback: pre-Fix-2 path
      const sqlExclude = cleanSeenArray.slice(0, 1500);
      const catPromises = TRENDING_CATS.map(cat => {
        let q = supabase.from('published_articles')
          .select('id, ai_final_score, category, created_at, shelf_life_days, freshness_category')
          .eq('category', cat)
          .gte('created_at', sevenDaysAgo)
          .gte('ai_final_score', 400)
          .order('ai_final_score', { ascending: false })
          .limit(200);
        if (sqlExclude.length > 0) q = q.not('id', 'in', `(${sqlExclude.join(',')})`);
        return q;
      });
      const results = await Promise.all(catPromises);
      const all = [];
      for (const r of results) if (r.data) all.push(...r.data);
      return { data: all, error: null };
    })(),

    // 3. DISCOVERY: same pattern, score floor 300 instead of 400
    (async () => {
      const DISC_CATS = ['Business', 'Tech', 'Science', 'Entertainment', 'Sports', 'Politics', 'World', 'Health', 'Finance', 'Lifestyle', 'Crypto'];
      if (userId) {
        const { data, error } = await supabase.rpc('fetch_unseen_per_category', {
          p_user_id: userId,
          p_categories: DISC_CATS,
          p_min_score: 300,
          p_hours_window: 168,
          p_per_category: 200,
        });
        return { data: data || [], error };
      }
      const sqlExclude = cleanSeenArray.slice(0, 1500);
      const catPromises = DISC_CATS.map(cat => {
        let q = supabase.from('published_articles')
          .select('id, ai_final_score, category, created_at, shelf_life_days, freshness_category')
          .eq('category', cat)
          .gte('created_at', sevenDaysAgo)
          .gte('ai_final_score', 300)
          .order('ai_final_score', { ascending: false })
          .limit(200);
        if (sqlExclude.length > 0) q = q.not('id', 'in', `(${sqlExclude.join(',')})`);
        return q;
      });
      const results = await Promise.all(catPromises);
      const all = [];
      for (const r of results) if (r.data) all.push(...r.data);
      return { data: all, error: null };
    })(),

    // 4. USER INTEREST PROFILE: entity-level tag weights from engagement history
    buildUserInterestProfile(supabase, userId),

    // 5. ALL EVENTS for entity signal computation (engagement rates per entity)
    //    Also used for topic saturation penalty
    (userId ? supabase
      .from('user_article_events')
      .select('article_id, event_type, created_at')
      .eq('user_id', userId)
      .in('event_type', ['article_engaged', 'article_liked', 'article_detail_view', 'article_skipped', 'article_revisit'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
      .limit(1000)
    : Promise.resolve({ data: [] })),

    // 6. FRESH BEST: highest quality × recency, NO taste vector, NO interest filter
    //    TikTok-style exploration — best content from ALL categories in last 48h
    //    Fetch 1000 — power users can have 400+ seen articles, need headroom
    supabase
      .from('published_articles')
      .select('id, ai_final_score, category, created_at, shelf_life_days, freshness_category, interest_tags')
      .gte('created_at', fortyEightHoursAgoISO)
      .gte('ai_final_score', 300)
      .order('ai_final_score', { ascending: false })
      .limit(1000),
  ]);

  if (personalResult.error) {
    console.error('Personal query error:', personalResult.error?.message || personalResult.error);
    // Multi-cluster timed out → try single taste vector as fallback
    if (tasteVectorMinilm && (!personalResult.data || personalResult.data.length === 0)) {
      console.log('[feed] Falling back to single taste vector...');
      try {
        // Use 168h (7d) window — single vector with 336h returns 95% stale content
        const { data: fallbackData, error: fallbackErr } = await supabase.rpc('match_articles_personal_minilm', {
          query_embedding: tasteVectorMinilm, match_count: 500, hours_window: 168,
          exclude_ids: excludeIds, min_similarity: minSim,
        });
        if (!fallbackErr && fallbackData) {
          personalResult.data = fallbackData;
          personalResult.error = null;
          hasInterestClusters = false; // Use single-vector path downstream
          console.log('[feed] Single vector fallback returned', fallbackData.length, 'articles');
        }
      } catch (fallbackErr2) {
        console.error('[feed] Single vector fallback also failed:', fallbackErr2?.message);
      }
    }
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
    const catPromises = allInterestCats.map(cat => {
      let q = supabase
        .from('published_articles')
        .select('id, ai_final_score, category, created_at, interest_tags, shelf_life_days')
        .eq('category', cat)
        .gte('created_at', thirtyDaysAgo)
        .gte('ai_final_score', 300)
        .order('ai_final_score', { ascending: false });
      const sqlExclude = cleanSeenArray.slice(0, 1500);
      if (sqlExclude.length > 0) {
        q = q.not('id', 'in', `(${sqlExclude.join(',')})`);
      }
      return q.limit(100);
    });
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

  // Fix 4: Normalize tag_profile to spread out saturated values
  // When 25 tags are all at 1.0, log-scale normalization restores relative ranking
  function normalizeTagProfile(tagProfile) {
    if (!tagProfile || typeof tagProfile !== 'object') return {};
    const entries = Object.entries(tagProfile);
    if (entries.length === 0) return {};
    const maxRaw = Math.max(...entries.map(([, v]) => v));
    if (maxRaw <= 0) return tagProfile;
    const normalized = {};
    for (const [entity, rawWeight] of entries) {
      normalized[entity] = Math.log1p(rawWeight) / Math.log1p(maxRaw);
    }
    return normalized;
  }

  // Use stored tag_profile if available (incrementally updated via track.js),
  // fall back to dynamically computed interest profile
  const rawTagProfile = (storedTagProfile && Object.keys(storedTagProfile).length > 0)
    ? storedTagProfile
    : (userInterestProfile || {});
  const baseTagProfile = normalizeTagProfile(rawTagProfile);

  // Merge session boosts into tag profile (temporary, this request only)
  const effectiveTagProfile = { ...baseTagProfile };
  for (const [tag, boost] of Object.entries(momentum.boosts)) {
    effectiveTagProfile[tag] = Math.min((effectiveTagProfile[tag] || 0) + boost, 1.5);
  }

  // Skip profile removed — entity signals handle negative learning.
  // Session skip penalties are still tracked via session momentum for within-session diversity.

  const sessionExcludeIds = new Set([...sessionEngagedIds, ...sessionSkippedIds]);

  // ==========================================
  // PHASE 3: PROPORTIONAL CLUSTER ALLOCATION
  // Instead of round-robin (equal per cluster), allocate proportionally
  // to engagement count. A user with 80% Galatasaray + 20% AI gets
  // ~80% Galatasaray candidates (capped at 50% to ensure diversity).
  // ==========================================

  const personalSimilarityMap = {};
  let personalIdOrder = [];

  // ══════════════════════════════════════════════
  // Fix 4: Tiered time window filtering in JS (per-cluster)
  // pgvector returns nearest neighbors regardless of age.
  // We filter here: prefer fresh articles, expand window if pool is thin.
  // ══════════════════════════════════════════════
  let personalResults = personalResult.data || [];

  if (personalResults.length > 0) {
    // Fetch created_at for all pgvector results to apply time filtering
    const pgIds = personalResults.map(r => r.id);
    const { data: pgDates } = await supabase
      .from('published_articles')
      .select('id, created_at')
      .in('id', pgIds.slice(0, 800));

    const dateMap = {};
    for (const a of (pgDates || [])) dateMap[a.id] = new Date(a.created_at).getTime();

    // ── Tiered time window: prefer fresh, expand ONLY if pool is very thin ──
    // 92% engagement came from all-<6h content. Old personal articles kill engagement.
    const TIME_TIERS = [24, 48, 96, 168]; // 24h, 48h, 4d, 7d (was 48h, 7d, 14d, 30d)

    if (hasInterestClusters) {
      // Per-cluster tiered filtering
      const clusterResults = {};
      for (const r of personalResults) {
        const ci = r.cluster_index ?? 0;
        if (!clusterResults[ci]) clusterResults[ci] = [];
        clusterResults[ci].push(r);
      }

      const filteredResults = [];
      const MIN_PER_CLUSTER = 5; // was 30 — too aggressive, pulled in 100h+ articles

      for (const [ci, results] of Object.entries(clusterResults)) {
        let clusterFiltered = [];
        for (const tierHours of TIME_TIERS) {
          const cutoff = now - tierHours * 3600000;
          clusterFiltered = results.filter(r => (dateMap[r.id] || 0) >= cutoff);
          if (clusterFiltered.length >= MIN_PER_CLUSTER) break;
        }
        // If even 30 days isn't enough, use everything pgvector returned
        if (clusterFiltered.length < MIN_PER_CLUSTER) {
          clusterFiltered = results;
        }
        filteredResults.push(...clusterFiltered);
      }
      personalResults = filteredResults;
    } else {
      // Single vector: tiered filtering — accept smaller pool rather than stale articles
      const MIN_RESULTS = 10; // was 150 — too greedy, pulled in week-old articles
      let filtered = [];
      for (const tierHours of TIME_TIERS) {
        const cutoff = now - tierHours * 3600000;
        filtered = personalResults.filter(r => (dateMap[r.id] || 0) >= cutoff);
        if (filtered.length >= MIN_RESULTS) break;
      }
      // If even 7 days isn't enough, use what we have (trending/discovery fill the rest)
      if (filtered.length < MIN_RESULTS) {
        filtered = personalResults;
      }
      personalResults = filtered;
    }
  }

  if (hasInterestClusters) {
    // Group candidates by cluster
    const clusterBuckets = {};
    for (const r of personalResults) {
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

    // Fix 1: Load cluster metadata using personalizationId (V3) for real importance scores
    const clusterLookup = clusterLookupId || userId;
    const clusterCol = clusterLookupColumn || 'user_id';
    const { data: clusterMeta } = await supabase
      .from('user_interest_clusters')
      .select('cluster_index, article_count, importance_score')
      .eq(clusterCol, clusterLookup);

    // Fix 1D: Thompson Sampling from persistent Beta posterior per cluster arm.
    // Source: Chapelle & Li, NeurIPS 2011. Arms are cluster:N keys. One sample
    // per cluster per request; blended 50/50 with the importance-score baseline.
    let banditSamples = {};
    if (userId) {
      const { data: arms } = await supabase
        .from('user_bandit_arms')
        .select('arm_key, alpha, beta')
        .eq('user_id', userId)
        .like('arm_key', 'cluster:%');
      if (arms) {
        const sampleGammaLocal = (shape) => {
          if (shape < 1) return sampleGammaLocal(shape + 1) * Math.pow(Math.random() || 1e-9, 1 / shape);
          const d = shape - 1 / 3;
          const c = 1 / Math.sqrt(9 * d);
          for (;;) {
            let x, v;
            do {
              const u1 = Math.random(), u2 = Math.random();
              x = Math.sqrt(-2 * Math.log(u1 || 1e-9)) * Math.cos(2 * Math.PI * u2);
              v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            const u = Math.random() || 1e-9;
            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
          }
        };
        const sampleBetaLocal = (alpha, beta) => {
          const x = sampleGammaLocal(alpha);
          const y = sampleGammaLocal(beta);
          return (x + y) > 0 ? x / (x + y) : 0.5;
        };
        for (const a of arms) {
          const ci = Number(a.arm_key.slice(8));  // strip "cluster:"
          if (Number.isFinite(ci)) {
            banditSamples[ci] = sampleBetaLocal(a.alpha || 1, a.beta || 1);
          }
        }
      }
    }

    // Fix 1: Use importance_score (V3) when available, fall back to article_count
    const hasImportanceScores = (clusterMeta || []).some(c => c.importance_score > 0);
    const clusterWeights = {};
    if (hasImportanceScores) {
      const totalImportance = (clusterMeta || []).reduce((s, c) => s + (c.importance_score || 0), 0) || 1;
      for (const c of (clusterMeta || [])) {
        clusterWeights[c.cluster_index] = Math.min(
          (c.importance_score || 0) / totalImportance,
          0.5
        );
      }
    } else {
      const totalEngaged = (clusterMeta || []).reduce((s, c) => s + (c.article_count || 1), 0);
      for (const c of (clusterMeta || [])) {
        // Cap any single cluster at 50% to prevent monoculture
        clusterWeights[c.cluster_index] = Math.min(
          (c.article_count || 1) / Math.max(totalEngaged, 1),
          0.5
        );
      }
    }

    // Fix 1D: blend the Thompson sample with the importance-score baseline.
    // 50/50 keeps the exploration/exploitation balance mild at first; can be
    // pushed higher later if posteriors concentrate faster than expected.
    if (Object.keys(banditSamples).length > 0) {
      const BANDIT_BLEND = 0.5;
      const sampleKeys = Object.keys(clusterWeights);
      let totalBandit = 0;
      for (const ci of sampleKeys) totalBandit += banditSamples[ci] || 0.5;
      if (totalBandit > 0) {
        for (const ci of sampleKeys) {
          const sampleShare = (banditSamples[ci] || 0.5) / totalBandit;
          clusterWeights[ci] = Math.min(
            (1 - BANDIT_BLEND) * clusterWeights[ci] + BANDIT_BLEND * sampleShare,
            0.5
          );
        }
      }
    }

    // Proportional allocation (min 1 per cluster)
    const clusterKeys = Object.keys(clusterBuckets);
    const targetTotal = 300; // increased from 150 — more candidates for slot filling
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
    const sorted = personalResults.sort((a, b) => b.similarity - a.similarity);
    for (const r of sorted) {
      personalSimilarityMap[r.id] = r.similarity;
      personalIdOrder.push(r.id);
    }
  }

  // Filter out session-excluded articles
  personalIdOrder = personalIdOrder.filter(id => !sessionExcludeIds.has(id));
  const personalIds = new Set(personalIdOrder);

  // ==========================================
  // PHASE 2b (Migration 046): AUGMENT personal pool with global leaf bandit
  // Thompson sample over the user's 100 user_leaf_arms, pick top leaves,
  // fetch_unseen_by_leaves RPC. Prepend those candidates to personalIdOrder
  // so they rank high in downstream scoring. Falls back silently when the
  // user has no leaf arms yet (new user) or leaf bandit hasn't learned
  // anything (fresh Beta(1,1) across all arms).
  // Source: TikTok Deep Retrieval (shared paths with per-user preferences).
  // ==========================================
  // Hoisted so the caught_up feedState decision can see whether the leaf
  // bandit / pivot path could deliver more content on the next request.
  let userLeafArmsLearned = 0;
  if (userId) {
    try {
      // Problem 4 (2026-04-20): load BOTH super and leaf arms for hierarchical
      // Thompson sampling. TikTok Deep Retrieval hierarchy: sample super first,
      // then sample leaves within top supers. Enables cross-sibling learning
      // transfer (engaging a Science leaf lifts other Science leaves' priors).
      const [leafArmsRes, superArmsRes] = await Promise.all([
        supabase.from('user_leaf_arms')
          .select('super_cluster_id, leaf_cluster_id, alpha, beta')
          .eq('user_id', userId),
        supabase.from('user_super_arms')
          .select('super_cluster_id, alpha, beta')
          .eq('user_id', userId),
      ]);
      const leafArms = leafArmsRes.data || [];
      const superArms = superArmsRes.data || [];
      const armCount = leafArms.length;
      const learnedArms = armCount > 0
        ? leafArms.filter(a => (a.alpha || 1) > 1.1 || (a.beta || 1) > 1.1).length
        : 0;
      userLeafArmsLearned = learnedArms;

      if (armCount >= 20 && learnedArms >= 3) {
        // Inline Thompson Sampling over Beta(α, β). Marsaglia-Tsang Gamma.
        const _sampleGamma = (shape) => {
          if (shape < 1) return _sampleGamma(shape + 1) * Math.pow(Math.random() || 1e-9, 1 / shape);
          const d = shape - 1 / 3;
          const c = 1 / Math.sqrt(9 * d);
          for (;;) {
            let x, v;
            do {
              const u1 = Math.random(), u2 = Math.random();
              x = Math.sqrt(-2 * Math.log(u1 || 1e-9)) * Math.cos(2 * Math.PI * u2);
              v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            const u = Math.random() || 1e-9;
            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
          }
        };
        const _sampleBeta = (a, b) => {
          const x = _sampleGamma(a);
          const y = _sampleGamma(b);
          return (x + y) > 0 ? x / (x + y) : 0.5;
        };

        // Problem 4 — Hierarchical Thompson:
        // Level 1: sample all super arms. Pick top 4 supers by sampled theta.
        // Level 2: within those 4 supers, sample leaf arms. Pick top 10 leaves.
        // If super data is sparse (e.g. brand-new user), degrades to flat leaf.
        const superSampled = new Map();
        if (superArms.length > 0) {
          for (const s of superArms) {
            superSampled.set(s.super_cluster_id, _sampleBeta(s.alpha || 1, s.beta || 1));
          }
        }
        const sortedSupers = [...superSampled.entries()].sort((a, b) => b[1] - a[1]);
        const topSupers = new Set(sortedSupers.slice(0, 4).map(([s]) => s));
        const useHierarchical = topSupers.size >= 3;

        const sampled = leafArms
          .filter(a => !useHierarchical || topSupers.has(a.super_cluster_id))
          .map(a => {
            // Boost leaf theta by its super's theta (additive blend 0.3)
            const leafTheta = _sampleBeta(a.alpha || 1, a.beta || 1);
            const superTheta = superSampled.get(a.super_cluster_id) || 0.5;
            return {
              super: a.super_cluster_id,
              leaf: a.leaf_cluster_id,
              theta: 0.7 * leafTheta + 0.3 * superTheta,
            };
          });
        sampled.sort((a, b) => b.theta - a.theta);
        const topLeaves = sampled.slice(0, 10).map(s => ({ super: s.super, leaf: s.leaf }));

        // Use hierarchical fetch (with sibling-leaf fallback tier)
        const { data: leafArticles } = await supabase.rpc('fetch_unseen_by_leaves_hierarchical', {
          p_user_id: userId,
          p_leaves: topLeaves,
          p_per_leaf: 20,
          p_sibling_per_leaf: 8,
          p_hours_window: 168,
          p_min_score: 400,
        });

        const leafAdded = [];
        for (const a of (leafArticles || [])) {
          if (!personalIds.has(a.id) && !sessionExcludeIds.has(a.id) && !canonicalSeenIds.has(a.id)) {
            leafAdded.push(a.id);
            personalIds.add(a.id);
          }
        }
        if (leafAdded.length > 0) {
          personalIdOrder = [...leafAdded, ...personalIdOrder];
        }
        console.log(`[feed:hierarchical-bandit] supers=${topSupers.size} leaves=${topLeaves.length} hierarchical=${useHierarchical} added=${leafAdded.length}`);
      }
    } catch (e) {
      console.log(`[feed:leaf-bandit] error: ${e?.message || e}`);
    }
  }

  // TRENDING: category-cap per category, exclude personal/seen
  // Cold-start users get higher caps since they have no personal pool
  // Category cap per pool — prevents one dominant category from flooding
  // War/conflict cycle: 49/50 top articles are "World". Cap at 5 forces diversity.
  const trendingCatMax = hasAnyPersonalization ? 5 : 10;
  const trendingCategoryCounts = {};
  const trendingIds = new Set();
  const trendingArticleMeta = [];
  for (const a of (trendingResult.data || [])) {
    if (personalIds.has(a.id) || canonicalSeenIds.has(a.id) || sessionExcludeIds.has(a.id)) continue;
    const cat = a.category || 'Other';
    trendingCategoryCounts[cat] = (trendingCategoryCounts[cat] || 0) + 1;
    if (trendingCategoryCounts[cat] > trendingCatMax) continue;
    trendingIds.add(a.id);
    trendingArticleMeta.push(a);
  }

  // DISCOVERY: diverse categories, exclude personal & trending
  // Cold-start: much higher caps to fill the feed
  // Change 3: Higher discovery category cap (15) and total (600)
  const discoveryCatMax = 5; // was 15 — same flooding issue as trending
  const discoveryTotalMax = 600;
  const discoveryCategoryCounts = {};
  const discoveryArticleMeta = [];
  for (const a of (discoveryResult.data || [])) {
    if (personalIds.has(a.id) || trendingIds.has(a.id) || canonicalSeenIds.has(a.id) || sessionExcludeIds.has(a.id)) continue;
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
    if (personalIds.has(a.id) || trendingIds.has(a.id) || canonicalSeenIds.has(a.id) || sessionExcludeIds.has(a.id)) continue;
    interestIds.add(a.id);
    interestArticleMeta.push(a);
  }

  // ── FRESH BEST: TikTok-style exploration pool ──
  // Best content from last 48h regardless of topic. No taste vector matching.
  // Max 25 per category for breadth. PRIORITIZE unseen articles over seen ones.
  const freshBestCatCounts = {};
  const freshBestArticleMeta = [];
  const freshBestIds = new Set();
  const allSeenSet_fb = canonicalSeenIds; // same canonical set
  // Sort: unseen articles first, then seen — both sorted by score within each group
  // fresh_best uses canonicalSeenIds — same set as everything else, no separate variable
  const freshBestRaw = (freshBestResult.data || []).filter(a => !canonicalSeenIds.has(a.id) && !sessionExcludeIds.has(a.id));
  const fbUnseen = freshBestRaw.filter(a => !allSeenSet_fb.has(a.id));
  const fbSeen = freshBestRaw.filter(a => allSeenSet_fb.has(a.id));
  const fbSorted = [...fbUnseen, ...fbSeen]; // unseen first
  for (const a of fbSorted) {
    const cat = a.category || 'Other';
    freshBestCatCounts[cat] = (freshBestCatCounts[cat] || 0) + 1;
    if (freshBestCatCounts[cat] > 25) continue;
    freshBestIds.add(a.id);
    freshBestArticleMeta.push(a);
    if (freshBestArticleMeta.length >= 200) break; // cap total
  }

  // ==========================================
  // PHASE 4: FETCH FULL ARTICLE DATA
  // ==========================================

  const allCandidateIds = [
    ...personalIds,
    ...trendingIds,
    ...discoveryArticleMeta.map(a => a.id),
    ...interestIds,
    ...freshBestIds,
  ];
  const uniqueIds = [...new Set(allCandidateIds)];

  if (uniqueIds.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0 });
  }

  // Fetch article data for scoring — use POOL_COLUMNS (lightweight, no embeddings)
  // Full ARTICLE_COLUMNS fetched later only for the final 25 selected articles
  const fetchColumns = hasAnyPersonalization ? POOL_COLUMNS : ARTICLE_COLUMNS;
  let allArticles = [];
  for (let i = 0; i < uniqueIds.length; i += 300) {
    const batch = uniqueIds.slice(i, i + 300);
    const { data, error } = await supabase
      .from('published_articles')
      .select(fetchColumns)
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

  // Pre-compute tag sets and embedding cache for MMR diversity calculations
  const tagCache = buildTagSetsCache(allArticles);
  const embeddingCache = buildEmbeddingCache(allArticles);

  // Fix 10: Count session interactions for adaptive weighting
  const sessionInteractionCount = (sessionEngagedIds?.length || 0) + (sessionSkippedIds?.length || 0) + (sessionGlancedIds?.length || 0);

  // Fix 5: Category-level engagement suppression
  // Load per-category engagement stats (last 7 days) to suppress 0% categories
  let categorySuppressionMap = {};
  if (userId) {
    try {
      const { data: catStats } = await supabase.rpc('get_category_engagement_stats', {
        p_user_id: userId,
        p_days: 7,
      });
      if (catStats) {
        // Compute the user's AVERAGE engagement rate across all categories
        let totalImp = 0, totalEng = 0;
        for (const row of catStats) {
          totalImp += parseInt(row.impressions) || 0;
          totalEng += parseInt(row.engaged) || 0;
        }
        const avgRate = totalImp > 0 ? totalEng / totalImp : 0.30;

        for (const row of catStats) {
          const impressions = parseInt(row.impressions) || 0;
          const engaged = parseInt(row.engaged) || 0;
          if (impressions < 10) continue;
          const rate = engaged / impressions;
          // Graduated suppression relative to user's average
          // Sports at 19% vs avg 33% → 0.58 ratio → 0.50x multiplier
          // Tech at 51% vs avg 33% → 1.55 ratio → 1.30x boost
          const ratio = rate / Math.max(avgRate, 0.10);
          if (ratio < 0.40) categorySuppressionMap[row.category] = 0.15;       // terrible: <40% of avg
          else if (ratio < 0.60) categorySuppressionMap[row.category] = 0.35;  // bad: Sports (19% vs 33% avg)
          else if (ratio < 0.80) categorySuppressionMap[row.category] = 0.60;  // below avg
          else if (ratio > 1.30) categorySuppressionMap[row.category] = 1.30;  // BOOST above avg categories
          // ratio 0.80-1.30: no suppression or boost (near average)
        }
      }
    } catch (catErr) {
      // RPC may not be deployed yet — continue without suppression
      console.log('[feed] Category suppression stats unavailable:', catErr.message);
    }
  }

  // Fix B (2026-04-19): session category stats used to read article categories
  // from articleMap, but articleMap only contains the CURRENT request's candidate
  // pool. After the anti-join retrieval fix, previously-served articles (the ones
  // that produced the session's engage/skip events) are excluded from
  // retrieval → not in articleMap → sessionCatStats never accumulates → 5-impression
  // suppression threshold is never reached.
  //
  // Fix: fetch category + typed_signals for the session's event IDs directly,
  // independent of this request's candidate retrieval. One extra query per feed
  // request; restores the intended session suppression behavior.
  const allSessionIds = [
    ...(sessionEngagedIds || []),
    ...(sessionSkippedIds || []),
    ...(sessionGlancedIds || []),
  ];
  let sessionCategoryLookup = {};
  let sessionSignalLookup = {};
  if (allSessionIds.length > 0) {
    try {
      const { data: sessionArticleMeta } = await supabase
        .from('published_articles')
        .select('id, category, typed_signals')
        .in('id', allSessionIds.slice(0, 300));  // safety cap
      if (sessionArticleMeta) {
        for (const a of sessionArticleMeta) {
          sessionCategoryLookup[a.id] = a.category;
          sessionSignalLookup[a.id] = a.typed_signals || [];
        }
      }
    } catch (e) { /* non-blocking */ }
  }

  // Session-reactive category suppression
  const sessionCatStats = {};
  function ensureCatStat(cat) {
    if (!sessionCatStats[cat]) sessionCatStats[cat] = { impressions: 0, engaged: 0 };
    return sessionCatStats[cat];
  }
  for (const id of (sessionEngagedIds || [])) {
    const cat = sessionCategoryLookup[id];
    if (!cat) continue;
    const s = ensureCatStat(cat); s.impressions++; s.engaged++;
  }
  for (const id of (sessionSkippedIds || [])) {
    const cat = sessionCategoryLookup[id];
    if (!cat) continue;
    ensureCatStat(cat).impressions++;
  }
  for (const id of (sessionGlancedIds || [])) {
    const cat = sessionCategoryLookup[id];
    if (!cat) continue;
    ensureCatStat(cat).impressions++;
  }

  // Fix C (2026-04-19): TikTok same_tag_today pattern. Tally per-signal skips vs
  // engagements within the session; apply penalty at scoring time to articles
  // whose typed_signals include tags the user is actively rejecting THIS session.
  // Skips lang:* and loc:usa (over-common signals, same as entity-dispersion).
  // Coefficients are inferred — the feature exists in the TikTok NYT-2021 leak
  // but coefficients aren't published.
  const sessionSignalSkips = new Map();
  const sessionSignalEngages = new Map();
  function _tallyForSig(map, sig) {
    if (typeof sig !== 'string') return;
    if (sig.startsWith('lang:') || sig === 'loc:usa') return;
    map.set(sig, (map.get(sig) || 0) + 1);
  }
  for (const id of (sessionSkippedIds || [])) {
    const sigs = sessionSignalLookup[id] || [];
    if (Array.isArray(sigs)) for (const s of sigs) _tallyForSig(sessionSignalSkips, s);
  }
  for (const id of (sessionEngagedIds || [])) {
    const sigs = sessionSignalLookup[id] || [];
    if (Array.isArray(sigs)) for (const s of sigs) _tallyForSig(sessionSignalEngages, s);
  }

  function sessionTopicPenalty(article) {
    const signals = safeJsonParse(article.typed_signals, []);
    if (!Array.isArray(signals)) return 1.0;
    let maxSkipsOnMatch = 0;
    let engagesOffsetting = 0;
    for (const sig of signals) {
      if (typeof sig !== 'string') continue;
      if (sig.startsWith('lang:') || sig === 'loc:usa') continue;
      const skips = sessionSignalSkips.get(sig) || 0;
      const engages = sessionSignalEngages.get(sig) || 0;
      if (skips > engages) {
        maxSkipsOnMatch = Math.max(maxSkipsOnMatch, skips - engages);
      } else if (engages > 0) {
        engagesOffsetting = Math.max(engagesOffsetting, engages);
      }
    }
    if (engagesOffsetting > 0) return 1.0;
    if (maxSkipsOnMatch >= 3) return 0.3;
    if (maxSkipsOnMatch >= 2) return 0.5;
    return 1.0;
  }

  // Fix L (2026-04-19): embedding-space secondary check. Articles whose
  // 384-dim MiniLM embedding is far from the user's interest centroids get a
  // light downweight. Catches semantic negatives that typed_signals miss
  // (the "Pakistan war article missing topic:middle_east" taxonomic gap).
  //
  // Upgrade (2026-04-21): PinnerSage-style multi-cluster scoring + session
  // intent shift. Instead of a single mean-pooled tasteVectorMinilm (which
  // mushes a multi-interest user — NFL + cooking + AI — into one centroid
  // that matches none of them well), score against ALL of the user's
  // interest centroids and take the max. PinnerSage (Pancha et al., KDD 2020).
  // When the rolling session vector diverges from long-term taste below 0.6
  // cosine, inject the session vector as an ephemeral high-weight centroid so
  // the entire pipeline auto-pivots to "what the user wants tonight."
  //
  // Falls back to the old single-vector behavior if there are no clusters yet
  // (cold-start / very early signal).
  const _fixLRef = sessionTasteVector || tasteVectorMinilm;
  let userClusterCentroidsForRerank = null; // [{ centroid, weight }]
  if (clusterLookupId && (tasteVector || tasteVectorMinilm)) {
    const { data: centroidRows } = await supabase
      .from('user_interest_clusters')
      .select('cluster_index, importance_score, article_count, medoid_minilm')
      .eq(clusterLookupColumn, clusterLookupId)
      .neq('suppressed', true);
    if (centroidRows && centroidRows.length > 0) {
      const totalImportance = centroidRows.reduce((s, c) => s + (c.importance_score || 0), 0);
      const fallbackCount = centroidRows.reduce((s, c) => s + (c.article_count || 0), 0);
      const acc = [];
      for (const row of centroidRows) {
        const centroid = safeJsonParse(row.medoid_minilm, null);
        if (!Array.isArray(centroid) || centroid.length !== 384) continue;
        const rawWeight = totalImportance > 0
          ? (row.importance_score || 0) / totalImportance
          : (row.article_count || 1) / Math.max(fallbackCount, 1);
        // Cap any single cluster at 0.6 so a dominant interest can't crowd
        // out the long tail (mirrors the upstream allocation cap of 0.5).
        acc.push({ centroid, weight: Math.min(rawWeight, 0.6) });
      }
      if (acc.length > 0) userClusterCentroidsForRerank = acc;
    }
  }

  // Intent-shift detection: cosine between rolling session vector and
  // long-term taste vector. < 0.6 means tonight's behavior diverges from
  // history (~37 % directional alignment). When that fires, inject the
  // session vector as an ephemeral cluster so the multi-cluster max picks
  // session-aligned content instead of stale centroids.
  let intentShiftCos = null;
  if (sessionTasteVector && tasteVectorMinilm
      && Array.isArray(sessionTasteVector) && Array.isArray(tasteVectorMinilm)
      && sessionTasteVector.length === tasteVectorMinilm.length
      && sessionTasteVector.length > 0) {
    intentShiftCos = cosineSimilarityVec(sessionTasteVector, tasteVectorMinilm);
  }
  const intentShifted = intentShiftCos !== null && intentShiftCos < 0.6;
  if (intentShifted && Array.isArray(sessionTasteVector) && sessionTasteVector.length === 384) {
    if (!userClusterCentroidsForRerank) userClusterCentroidsForRerank = [];
    userClusterCentroidsForRerank.push({ centroid: sessionTasteVector, weight: 0.5 });
    console.log(`[feed] intent shift detected cos=${intentShiftCos.toFixed(2)} — session vector injected as ephemeral cluster`);
  }

  // Multi-cluster max-score for an article embedding. Each cluster's cosine
  // is scaled by 0.6 + 0.4 * weight so big clusters get a small boost on top
  // of cosine, but a candidate matching a small cluster perfectly can win.
  function multiClusterAffinity(emb) {
    if (!emb || emb.length !== 384) return null;
    if (userClusterCentroidsForRerank) {
      let best = 0;
      for (const { centroid, weight } of userClusterCentroidsForRerank) {
        const sim = cosineSimilarityVec(centroid, emb);
        const score = sim * (0.6 + 0.4 * weight);
        if (score > best) best = score;
      }
      return best;
    }
    if (_fixLRef && _fixLRef.length === 384) return cosineSimilarityVec(emb, _fixLRef);
    return null;
  }

  function embeddingAffinityPenalty(article) {
    const emb = safeJsonParse(article.embedding_minilm, null);
    if (!emb || !Array.isArray(emb) || emb.length !== 384) return 1.0;
    const sim = multiClusterAffinity(emb);
    if (sim === null) return 1.0;
    if (sim < 0.10) return 0.85;
    if (sim < 0.20) return 0.95;
    return 1.0;
  }

  function getCategorySuppression(article) {
    const cat = article.category;
    const sessionData = sessionCatStats[cat];
    const historical = categorySuppressionMap[cat] || 1.0;
    if (!sessionData) return historical;

    // Fix K (2026-04-19): adaptive threshold. Old >=5 missed short sessions —
    // user had 4 Sports and 4 World skips on a 2-page session and neither
    // category suppressed (11:57 UTC diagnostic). Scale threshold with total
    // session impressions: min 3, else 15% of session length.
    const totalSessionImpressions = Object.values(sessionCatStats)
      .reduce((sum, s) => sum + (s.impressions || 0), 0);
    const threshold = Math.max(3, Math.floor(totalSessionImpressions * 0.15));
    if (sessionData.impressions < threshold) return historical;

    const sessionRate = sessionData.engaged / sessionData.impressions;
    if (sessionRate >= 0.15) return historical;

    // Fix K (2026-04-19): category is being skipped, but don't blanket-suppress.
    // First, defer to Fix C (sessionTopicPenalty): Fix C is signal-level and
    // more specific. If Fix C already fires on this article we skip Fix K's
    // entity-overlap check to avoid multiplicative stacking (Pinterest
    // PinnerSage / Twitter home-mixer / YouTube MMoE all avoid stacking
    // multiplicative penalties — drift risk).
    const fixCPenalty = sessionTopicPenalty(article);
    if (fixCPenalty < 1.0) return historical;

    // Fix K: Fix C didn't fire. Check if this article shares ANY meaningful
    // entity with articles the user skipped this session. Presence-based
    // (>=1 overlap). If no overlap, the article's sub-topic differs from
    // what user skipped — don't penalize (category label alone isn't signal).
    const articleSignals = safeJsonParse(article.typed_signals, []);
    if (Array.isArray(articleSignals)) {
      for (const sig of articleSignals) {
        if (typeof sig !== 'string') continue;
        if (sig.startsWith('lang:') || sig === 'loc:usa') continue;
        if ((sessionSignalSkips.get(sig) || 0) >= 1) {
          return 0.20;  // entity overlap with session skips: full suppression
        }
      }
    }
    // No entity overlap — different sub-topic within a skipped category.
    // Don't penalize via session path; historical suppression still applies.
    return historical;
  }

  // Underfed winner boost: amplify categories with high engagement but low serving volume
  // Food (50% rate, 12 served) and Travel (50% rate, 10 served) should appear more
  let categoryStats30d = {};
  if (userId) {
    try {
      const { data: stats30 } = await supabase.rpc('get_category_engagement_stats', {
        p_user_id: userId, p_days: 30,
      });
      if (stats30) {
        for (const row of stats30) {
          categoryStats30d[row.category] = { impressions: parseInt(row.impressions) || 0, engaged: parseInt(row.engaged) || 0 };
        }
      }
    } catch (e) { /* non-blocking */ }
  }

  function underfedWinnerBoost(article) {
    const stats = categoryStats30d[article.category];
    if (!stats || stats.impressions === 0) return 1.0;
    const rate = stats.engaged / stats.impressions;
    if (rate >= 0.40 && stats.engaged >= 5 && stats.impressions < 25) return 1.5;
    if (rate >= 0.40 && stats.impressions < 50) return 1.2;
    return 1.0;
  }

  // ==========================================
  // PHASE 5: SCORE CANDIDATES
  // ==========================================

  // Load typed entity signals for scoring (unified behavioral signal store).
  // Also fetch 24h windows + last_*_at — needed for continuous read-time decay
  // (TikTok / Pinterest-style exp half-life) and 24h-window blending so a
  // same-session skip can override months of older positives.
  let entitySignals = {};
  if (userId) {
    const { data: signalRows } = await supabase
      .from('user_entity_signals')
      .select('entity, positive_count, negative_count, positive_24h, negative_24h, positive_7d, negative_7d, last_positive_at, last_negative_at')
      .eq('user_id', userId)
      .or('positive_count.gt.0,negative_count.gt.0')
      .limit(500);
    if (signalRows) {
      for (const row of signalRows) {
        entitySignals[row.entity] = {
          positive: row.positive_count || 0,
          negative: row.negative_count || 0,
          positive_24h: row.positive_24h || 0,
          negative_24h: row.negative_24h || 0,
          positive_7d: row.positive_7d || 0,
          negative_7d: row.negative_7d || 0,
          last_positive_at: row.last_positive_at,
          last_negative_at: row.last_negative_at,
        };
      }
    }
  }

  // Continuous time-decay: 14-day half-life, applied at READ time. Lambda for
  // exp decay = ln(2) / half_life_days. No write-side cron, no race conditions,
  // reflects actual elapsed time. Closes the gap where a user's old positive
  // history (loc:germany +20 from a year ago) was dominating fresh negative
  // signals on the same entity.
  const ENTITY_DECAY_HALF_LIFE_DAYS = 14;
  const ENTITY_DECAY_LAMBDA = Math.log(2) / ENTITY_DECAY_HALF_LIFE_DAYS;
  const ENTITY_NOW_MS = Date.now();
  function entityDecayMultiplier(lastEventISO) {
    if (!lastEventISO) return 1.0;
    const elapsedMs = ENTITY_NOW_MS - new Date(lastEventISO).getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1.0;
    const days = elapsedMs / 86400000;
    return Math.exp(-ENTITY_DECAY_LAMBDA * days);
  }

  // Hard-suppression set for entities where the user has shown a clear,
  // sustained negative pattern that the soft entitySignalMultiplier dilutes
  // into invisibility (e.g. 1 strong-neg signal averaged with 4 neutral signals
  // moves the multiplier <10 %). Threshold pair: net ≤ -7 OR (affinity ≤ -0.5
  // AND ≥ 5 trials). Apply decay so a 60-day-old grudge fades naturally.
  const STRONG_NEG_NET = -7;
  const STRONG_NEG_AFFINITY = -0.5;
  const STRONG_NEG_MIN_TOTAL = 5;
  const strongNegEntities = new Set();
  for (const [entity, rec] of Object.entries(entitySignals)) {
    if (typeof entity !== 'string' || entity.startsWith('lang:')) continue;
    const decPos = (rec.positive || 0) * entityDecayMultiplier(rec.last_positive_at);
    const decNeg = (rec.negative || 0) * entityDecayMultiplier(rec.last_negative_at);
    const total = decPos + decNeg;
    if (total < STRONG_NEG_MIN_TOTAL) continue;
    const net = decPos - decNeg;
    const affinity = net / total;
    if (net <= STRONG_NEG_NET || affinity <= STRONG_NEG_AFFINITY) {
      strongNegEntities.add(entity);
    }
  }
  function passesStrongNegFilter(article) {
    if (strongNegEntities.size === 0) return true;
    const signals = safeJsonParse(article.typed_signals, []);
    if (!Array.isArray(signals)) return true;
    for (const sig of signals) {
      if (strongNegEntities.has(sig)) return false;
    }
    return true;
  }
  if (strongNegEntities.size > 0) {
    console.log(`[feed] strong-neg suppress: ${strongNegEntities.size} entities (e.g. ${[...strongNegEntities].slice(0, 5).join(', ')})`);
  }

  // Fix E (2026-04-19): pivot-mode selector support. When the algorithm enters
  // skip-cascade recovery, pivot should AMPLIFY the user's strongest recent
  // positive signals rather than filter out negatives. Source: TikTok
  // retention-oriented session design (NYT 2021 leak) — negative feedback
  // shifts the system toward content with higher predicted positive engagement,
  // not neutral content. Conviction floor: >=5 total events and >=0.65 positive
  // ratio. Sort by positive_7d desc (with positive_count desc tiebreak).
  const topPositiveSignals = (() => {
    const candidates = Object.entries(entitySignals)
      .filter(([entity]) => !entity.startsWith('lang:') && entity !== 'loc:usa')
      .filter(([, rec]) => {
        const total = (rec.positive || 0) + (rec.negative || 0);
        if (total < 5) return false;
        return (rec.positive / total) >= 0.65;
      });
    candidates.sort((a, b) => {
      const a7 = a[1].positive_7d || 0;
      const b7 = b[1].positive_7d || 0;
      if (b7 !== a7) return b7 - a7;
      return (b[1].positive || 0) - (a[1].positive || 0);
    });
    return candidates.slice(0, 8).map(c => c[0]);
  })();
  const topPositiveSet = new Set(topPositiveSignals);

  // Compute entity affinity with continuous time-decay + recent-window blending.
  // Raw counts stay in DB (auditability); decay applies at read time so the
  // signal naturally fades. 24h window is treated as ground-truth recent intent
  // (heavier blend) — a same-session skip can override an older positive history.
  function computeEntityAffinity(record) {
    const decPos = (record.positive || 0) * entityDecayMultiplier(record.last_positive_at);
    const decNeg = (record.negative || 0) * entityDecayMultiplier(record.last_negative_at);
    const decTotal = decPos + decNeg;
    if (decTotal < 1) return 0;
    const allTimeAffinity = (decPos - decNeg) / decTotal;
    const total24h = (record.positive_24h || 0) + (record.negative_24h || 0);
    if (total24h >= 2) {
      const recent = ((record.positive_24h || 0) - (record.negative_24h || 0)) / total24h;
      return recent * 0.6 + allTimeAffinity * 0.4;
    }
    const total7d = (record.positive_7d || 0) + (record.negative_7d || 0);
    if (total7d >= 3) {
      const recent7 = ((record.positive_7d || 0) - (record.negative_7d || 0)) / total7d;
      return recent7 * 0.4 + allTimeAffinity * 0.6;
    }
    return allTimeAffinity;
  }

  // Typed entity signal multiplier: replaces skip_profile AND tag_profile scoring.
  // Reads typed_signals from article, computes average affinity, returns multiplier.
  // Squared exponent (not cubed) — cubed overpenalizes mixed signals.
  function entitySignalMultiplier(article) {
    const signals = safeJsonParse(article.typed_signals, []);
    // Empty / unparsed typed_signals: article is untagged (pipeline-bug window or
    // legacy content). Don't let it bypass scoring at full weight.
    if (!Array.isArray(signals) || signals.length === 0) return 0.5;

    let affinitySum = 0;
    let matchCount = 0;

    for (const sig of signals) {
      const record = entitySignals[sig];
      if (record) {
        // Signal is in DB — use as-is. Fix C's sessionTopicPenalty handles
        // session-level downweighting separately (applied as a multiplier in
        // the scoring layer) so we do NOT stack an additional penalty here.
        const affinity = computeEntityAffinity(record);
        affinitySum += affinity;
        matchCount++;
        continue;
      }
      // Fix G (2026-04-19): in-memory skip overlay to close the write-latency
      // race. When user skips an article at T and requests the next feed page
      // at T+3s, track.js's fire-and-forget write to user_entity_signals may
      // not have propagated — the new signal is invisible to Fix C and to this
      // multiplier. This overlay treats such signals as fresh negatives for
      // THIS request only. Gated on !record so we don't double-penalize
      // signals already captured in the DB (which Fix C handles).
      // Mirrors Monolith's minute-granularity sparse-embedding sync (Liu et
      // al. 2022): critical session signals must influence the next query,
      // not the one after.
      if (typeof sig !== 'string' || sig.startsWith('lang:') || sig === 'loc:usa') continue;
      const inMemSkips = sessionSignalSkips.get(sig) || 0;
      if (inMemSkips > 0) {
        // -0.3 per skip, bounded at -1.0. Penalty is calibration; raised from
        // -0.2 because gating to first-time-in-session signals means it carries
        // the full load of the write-latency bridge.
        const affinity = Math.max(-1.0, -0.3 * inMemSkips);
        affinitySum += affinity;
        matchCount++;
      }
    }

    // Tagged but user has no record on any signal — mild penalty so strongly-matched
    // articles rank above unmatched ones, but content isn't fully suppressed.
    if (matchCount === 0) return 0.85;

    const avgAffinity = affinitySum / matchCount;
    const raw = Math.pow(1.0 + avgAffinity, 2); // 0.0 to 4.0

    // Fix A (2026-04-19): coverage factor — treat "unknown entity = uncertainty",
    // not "unknown entity = neutral". When only a small fraction of an article's
    // entities are in the user's signal table, the average affinity is dominated
    // by a handful of signals and doesn't reflect genuine preference. Damp such
    // articles so they don't slip past pivot-mode's multiplier>=1.0 gate on the
    // strength of 2 matched negatives + 6 unknowns.
    //   coverage 0.2 (1 of 5 matched) → multiplier capped at ~0.85
    //   coverage 0.4+ (e.g. 4 of 10) → no penalty
    // Calibration parameters — not cited; correction to multiplier averaging.
    const coverage = matchCount / signals.length;
    const coveragePenalty = coverage < 0.4 ? 0.7 + (coverage / 0.4) * 0.3 : 1.0;

    return raw * coveragePenalty;
  }

  // Legacy entityAffinities for backward compat during transition
  const entityAffinities = {};
  for (const [entity, record] of Object.entries(entitySignals)) {
    entityAffinities[entity] = computeEntityAffinity(record);
  }

  // Personal bucket: V3 scoring with entity affinity + vector similarity
  // Fix 1E: image_score as additive Pinterest-style feature. Scale is 0-100 in DB
  // (Gemini Flash), normalize to [0,1] and center at 0.5 so average images are
  // neutral, good images boost, bad images penalize.
  // Source: Pinterest Engineering Dec 2025 "Improving Quality of Recommended Content
  // through Pinner Surveys"; image-quality feature consumed as continuous [0,1] input.
  const IMAGE_WEIGHT = 0.10; // A/B range 0.05-0.15 (flagged inferred)
  function imageQualityFeature(article) {
    const raw = article.image_score;
    if (raw == null) return 0.5;
    return Math.max(0, Math.min(1, raw / 100));
  }
  function applyImageFeature(score, article, pool) {
    const q = imageQualityFeature(article);
    let next = score + score * IMAGE_WEIGHT * (q - 0.5);
    if (pool === 'discovery') {
      // Floor gate: bottom 5% images don't appear in Discovery (exploration pool
      // is most sensitive to image quality per Pinterest).
      if (q < 0.05) return 0;
      // AI-generated images: soft negative in Discovery only (A/B 0.75-1.0, inferred)
      if (article.image_ai_generated === true) next *= 0.85;
    }
    return next;
  }

  const personalScored = personalIdOrder
    .filter(id => articleMap[id])
    .map(id => {
      const article = articleMap[id];
      const similarity = personalSimilarityMap[id] || 0;
      // Compute session vector similarity if available (Change 1)
      let sessionVecSim = 0;
      if (sessionTasteVector && article.embedding_minilm) {
        const emb = safeJsonParse(article.embedding_minilm, null);
        if (emb && Array.isArray(emb) && emb.length === 384 && sessionTasteVector.length === 384) {
          sessionVecSim = cosineSimilarityVec(emb, sessionTasteVector);
        }
      }
      let score = personalizationId
        ? scoreArticleV3(article, similarity, entityAffinities, 0, sessionVecSim, sessionInteractionCount)
        : scorePersonalV3(article, similarity, effectiveTagProfile, momentum.boosts, null);
      // Apply typed entity signal multiplier (replaces skip_profile penalty)
      score *= entitySignalMultiplier(article);
      // Fix 5: Category suppression
      score *= getCategorySuppression(article);
      // Fix C (2026-04-19): session-level topic skip penalty
      score *= sessionTopicPenalty(article);
      score *= underfedWinnerBoost(article);
      // Boost articles from followed publishers
      if (article.author_id && followedPublisherIds.has(article.author_id)) {
        score *= 1.25;
      }
      score = applyImageFeature(score, article, 'personal');
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

  // Trending bucket: editorial importance x recency x entity signal x category suppression
  const trendingScored = trendingArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      let s = scoreTrendingV3(article, null) * entitySignalMultiplier(article) * getCategorySuppression(article);
      s *= sessionTopicPenalty(article);  // Fix C
      s *= embeddingAffinityPenalty(article);  // Fix L
      s = applyImageFeature(s, article, 'trending');
      return { ...article, _score: s, _bucket: 'trending' };
    })
    .sort((a, b) => b._score - a._score);

  // Discovery bucket: boost unfamiliar categories x entity signal x category suppression
  const discoveryScored = discoveryArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      let s = scoreDiscoveryV3(article, personalCategories, null) * entitySignalMultiplier(article) * getCategorySuppression(article);
      s *= sessionTopicPenalty(article);  // Fix C
      s *= embeddingAffinityPenalty(article);  // Fix L
      s = applyImageFeature(s, article, 'discovery');
      return { ...article, _score: s, _bucket: 'discovery' };
    })
    .filter(a => a._score > 0)  // drop discovery articles zeroed by image floor
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
      let s = (article.ai_final_score || 0) * catBoost * tagBoost * getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);
      s *= sessionTopicPenalty(article);  // Fix C
      s = applyImageFeature(s, article, 'interest');
      return {
        ...article,
        _score: s,
        _tagMatches: tagMatches,
        _bucket: 'interest',
      };
    })
    .sort((a, b) => b._score - a._score);

  // Fresh Best bucket: quality × recency, no taste vector, with skip + saturation penalty
  const freshBestScored = freshBestArticleMeta
    .filter(a => articleMap[a.id])
    .map(a => {
      const article = articleMap[a.id];
      const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days, article.freshness_category);
      const sigMult = entitySignalMultiplier(article);
      let s = (article.ai_final_score || 0) * recency * sigMult;
      // Fix H (2026-04-19): hard floor. When matched signals average clearly
      // negative (mult < 0.2), Fix F's 0.3× soft-penalty can't save a pool
      // where all surviving articles score ~1.5 and the user's fresh candidate
      // residue is 3.7× skewed toward negatives (04-19 diagnostic Q2). Return
      // -Infinity so the article is fully excluded from fresh_best.
      if (sigMult < 0.2) { s = -Infinity; }
      // Fix F (2026-04-19): soft-exclude band for clearly-misaligned but not
      // extremely-negative articles. Additional 70% penalty when 0.2 <= mult < 0.4.
      else if (sigMult < 0.4) s *= 0.3;
      s *= sessionTopicPenalty(article);  // Fix C
      s *= embeddingAffinityPenalty(article);  // Fix L
      s = applyImageFeature(s, article, 'fresh_best');
      return {
        ...article,
        _score: s,
        _bucket: 'fresh_best',
      };
    })
    .sort((a, b) => b._score - a._score);

  // ==========================================
  // PHASE 5.5: TASTE VECTOR RE-RANKING (angle-aware personalization)
  // Entity scoring can't distinguish "longevity market" from "mole rat longevity".
  // Taste vector embeddings CAN — one is near business articles, the other near biology.
  // Fetch embeddings for top 60 candidates per pool, compute cosine similarity
  // to taste vector, and re-score. This is the key to solving "right entity, wrong angle."
  // ==========================================

  const userTasteVec = tasteVectorMinilm || tasteVector;
  if (userTasteVec && hasAnyPersonalization) {
    // Collect top 60 candidates from each non-personal pool for embedding fetch
    const reRankPools = [
      { pool: trendingScored, name: 'trending' },
      { pool: discoveryScored, name: 'discovery' },
      { pool: freshBestScored, name: 'fresh_best' },
    ];

    const idsToFetch = new Set();
    for (const { pool } of reRankPools) {
      for (const a of pool.slice(0, 60)) {
        if (!embeddingCache.has(a.id)) idsToFetch.add(a.id);
      }
    }

    if (idsToFetch.size > 0) {
      const { data: tasteEmbData } = await supabase
        .from('published_articles')
        .select('id, embedding_minilm')
        .in('id', [...idsToFetch].slice(0, 200));
      if (tasteEmbData) {
        for (const a of tasteEmbData) {
          const emb = safeJsonParse(a.embedding_minilm, null);
          if (emb && Array.isArray(emb) && emb.length > 0) {
            embeddingCache.set(a.id, emb);
          }
        }
      }
    }

    // Re-score with taste vector similarity (angle-aware)
    // Problem 4-lite (2026-04-19): apply sessionTasteVector boost alongside
    // the long-term taste multiplier. Trending/discovery/fresh_best currently
    // only use long-term tasteVectorMinilm for re-rank; session-reactivity via
    // sessionTasteVector was only used in personal pool scoring (scoreArticleV3).
    // Now these pools also pick up session engagement drift.
    // Source: Pinterest multi-embedding retrieval framework (KDD 2020),
    // Instagram two-tower user-embedding approach (Meta Engineering 2023).
    //   sessionSim ∈ [-1, +1] → sessionBoost ∈ [0.5, 1.5] (multiplicative).
    //   Gated on sessionTasteVector presence — no-op for users without
    //   session activity (cold start unaffected).
    for (const { pool } of reRankPools) {
      for (const a of pool) {
        const emb = embeddingCache.get(a.id);
        if (!emb) continue;
        // Long-term taste (existing)
        if (userTasteVec.length === emb.length) {
          const sim = cosineSimilarityVec(userTasteVec, emb);
          const tasteMult = 0.3 + Math.max(0, sim) * 1.4;
          a._score *= tasteMult;
        }
        // Problem 4-lite: session-reactive taste alignment
        if (sessionTasteVector && sessionTasteVector.length === emb.length) {
          const sessionSim = cosineSimilarityVec(sessionTasteVector, emb);
          const sessionBoost = 1.0 + sessionSim * 0.5;  // [0.5, 1.5]
          a._score *= sessionBoost;
        }
      }
      pool.sort((a, b) => b._score - a._score);
    }
  }

  // ==========================================
  // PHASE 5.5a: ENTITY BLOCKLIST FOR ALL USERS (not just cold-start)
  // Combines session skips + persistent skip_profile to hard-block
  // entities the user repeatedly skipped.
  // ==========================================

  // Entity-level skip signals are handled by entitySignalMultiplier (ratio-based
  // scoring via typed_signals). No hard-blocking — the old globalBlocklist was
  // too aggressive, blocking common entities like "film", "moon", "nasa" and
  // eliminating 97% of trending articles.

  // Fix 1C (loosened 2026-04-18): drop only the genuinely empty-signal
  // pipeline-bug-window articles. Original threshold was >=3 signals, which
  // combined with the user's 5k+ seen history to starve the slate to 1-7
  // articles per page. Fix A (0.5× multiplier on empty signals) already
  // discourages them in ranking — this filter is a safety net for articles
  // that bypass the multiplier entirely.
  const PIPELINE_SIGNAL_CUTOFF_MS = Date.parse('2026-04-15T00:00:00Z');
  function passesSignalFilter(article) {
    const sigs = safeJsonParse(article.typed_signals, []);
    if (Array.isArray(sigs) && sigs.length >= 1) return true;
    const created = Date.parse(article.created_at);
    return Number.isFinite(created) && created < PIPELINE_SIGNAL_CUTOFF_MS;
  }

  // Compose filters: signal presence (Fix 1C) + strong-negative entity hard
  // suppress. Both are O(n) linear filters; running them as one .filter() chain
  // avoids double-iterating each pool.
  const passesPoolFilters = (article) => passesSignalFilter(article) && passesStrongNegFilter(article);
  const personalScoredFiltered   = personalScored.filter(passesPoolFilters);
  const trendingScoredFiltered   = trendingScored.filter(passesPoolFilters);
  const discoveryScoredFiltered  = discoveryScored.filter(passesPoolFilters);
  const interestScoredFiltered   = interestScored.filter(passesPoolFilters);
  const freshBestScoredFiltered  = freshBestScored.filter(passesPoolFilters);

  // ==========================================
  // PHASE 5.5b: WORLD-EVENT DEDUP (IMPROVEMENT 3)
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

  const selected = [];
  let banditPoolTotal = 0; // set by cold-start path, used for has_more calculation

  // ── THREE-TIER SLOT FILLING ──
  // Tier 1: FRESH UNSEEN — articles within their freshness window that user hasn't seen
  // Tier 2: RESURFACED — articles user previously engaged with (can re-read)
  // Tier 3: STALE UNSEEN — old articles user hasn't seen but are past relevance peak
  // Never show: stale breaking/developing news (misleading on a news platform)
  const allSeenSet = canonicalSeenIds; // ONE set, ONE source of truth

  function splitThreeTiers(pool) {
    const unseen = pool.filter(a => !allSeenSet.has(a.id));
    const resurfaced = pool.filter(a => allSeenSet.has(a.id));
    const freshUnseen = unseen.filter(a => isStillFresh(a));
    const staleUnseen = unseen.filter(a => !isStillFresh(a));
    return { freshUnseen, resurfaced, staleUnseen };
  }

  const pTiers = splitThreeTiers(personalScoredFiltered);
  const tTiers = splitThreeTiers(trendingScoredFiltered);
  const dTiers = splitThreeTiers(discoveryScoredFiltered);
  const iTiers = splitThreeTiers(interestScoredFiltered);
  // fresh_best: skip three-tier split — already pre-filtered for freshness (48h).
  // Directly split into unseen/resurfaced to avoid isStillFresh rejecting articles.
  // Fix H: drop Fix-H hard-excluded articles (_score = -Infinity).
  const fUnseen = freshBestScoredFiltered.filter(a => !allSeenSet.has(a.id) && Number.isFinite(a._score));
  const fResurfaced = freshBestScoredFiltered.filter(a => allSeenSet.has(a.id) && Number.isFinite(a._score));
  const fTiers = { freshUnseen: fUnseen, resurfaced: fResurfaced, staleUnseen: [] };

  // Count fresh unseen for feed_state
  const totalFreshUnseen = pTiers.freshUnseen.length + tTiers.freshUnseen.length + dTiers.freshUnseen.length + iTiers.freshUnseen.length + fUnseen.length;

  // DIAGNOSTIC: Pool sizes after three-tier split
  // console.log(`[feed-diag] canonicalSeenIds=${canonicalSeenIds.size} sessionExclude=${sessionExcludeIds.size}`);
  // console.log(`[feed-diag] personalScored=${personalScored.length} filtered=${personalScoredFiltered.length}`);
  // console.log(`[feed-diag] trendingScored=${trendingScored.length} filtered=${trendingScoredFiltered.length}`);
  // console.log(`[feed-diag] discoveryScored=${discoveryScored.length} filtered=${discoveryScoredFiltered.length}`);
  // console.log(`[feed-diag] interestScored=${interestScored.length} filtered=${interestScoredFiltered.length}`);
  // console.log(`[feed-diag] freshBestScored=${freshBestScored.length} filtered=${freshBestScoredFiltered.length}`);
  // console.log(`[feed-diag] pTiers: fresh=${pTiers.freshUnseen.length} resurf=${pTiers.resurfaced.length} stale=${pTiers.staleUnseen.length}`);
  // console.log(`[feed-diag] tTiers: fresh=${tTiers.freshUnseen.length} resurf=${tTiers.resurfaced.length} stale=${tTiers.staleUnseen.length}`);
  // console.log(`[feed-diag] dTiers: fresh=${dTiers.freshUnseen.length} resurf=${dTiers.resurfaced.length} stale=${dTiers.staleUnseen.length}`);
  // console.log(`[feed-diag] iTiers: fresh=${iTiers.freshUnseen.length} resurf=${iTiers.resurfaced.length} stale=${iTiers.staleUnseen.length}`);
  // console.log(`[feed-diag] fUnseen=${fUnseen.length} fResurfaced=${fResurfaced.length}`);
  // console.log(`[feed-diag] totalFreshUnseen=${totalFreshUnseen} hasAnyPersonalization=${hasAnyPersonalization}`);

  // ── Dynamic slot pattern ──
  // Trending (57% eng) and discovery (67% eng) outperform fresh_best (21%).
  // Fresh_best is exploration (last resort), not primary filler.
  const personalUnseenCount = pTiers.freshUnseen.length;
  // Session engage rate is a stronger signal than unseen count for deciding
  // exploit vs explore. If the user is skipping most of what we serve this
  // session, drop out of personal-dominant mode even with high unseen — those
  // candidates evidently aren't working today.
  const _sessionDecisions = (sessionEngagedIds?.length || 0) + (sessionSkippedIds?.length || 0);
  const _sessionEngageRate = _sessionDecisions >= 10
    ? (sessionEngagedIds.length / _sessionDecisions) : null;
  const _lowEngagementMode = _sessionEngageRate !== null && _sessionEngageRate < 0.3;

  let SLOTS;
  let _slotsReason;
  if (_lowEngagementMode) {
    // Skip-heavy session: open up to exploration + fresh even if personal has unseen.
    SLOTS = ['P','T','D','T','D','F','T','D','T','F'];           // 10P/30T/40D/20F
    _slotsReason = `low-engage-rate=${_sessionEngageRate.toFixed(2)}`;
  } else if (intentShifted) {
    // Session intent diverging from long-term profile. Personal pool is built
    // off long-term centroids and is the *wrong* pool to lean on right now —
    // favor trending + discovery (driven by current engagement) and let the
    // multi-cluster re-rank (which now contains the session vector) pull
    // session-relevant items to the top of those pools.
    SLOTS = ['P','T','D','T','D','D','T','D','T','F'];           // 10P/30T/50D/10F
    _slotsReason = `intent-shift cos=${intentShiftCos.toFixed(2)}`;
  } else if (personalUnseenCount >= 15) {
    SLOTS = ['P','P','T','P','P','D','P','P','T','D'];           // 60P/20T/20D
    _slotsReason = `personal-heavy unseen=${personalUnseenCount}`;
  } else if (personalUnseenCount >= 5) {
    SLOTS = ['P','T','D','T','P','D','T','D','T','F'];           // 20P/40T/30D/10F
    _slotsReason = `balanced unseen=${personalUnseenCount}`;
  } else {
    // Personal exhausted — trending + discovery first, fresh_best last resort
    SLOTS = ['T','D','T','D','T','F','T','D','T','F'];           // 50T/30D/20F
    _slotsReason = `personal-exhausted unseen=${personalUnseenCount}`;
  }
  console.log(`[feed] SLOTS=${SLOTS.join('')} reason=${_slotsReason} pools P=${pTiers.freshUnseen.length} T=${tTiers.freshUnseen.length} D=${dTiers.freshUnseen.length} F=${fUnseen.length}`);

  // Fix I (2026-04-19): when fresh_best pool is thin (post Fix H hard-floor),
  // skipping fresh_best slots entirely is better than padding the page with
  // mediocre content. Reallocate 'F' slots to 'T' (2/3) and 'D' (1/3). Threshold
  // of 3 viable articles and the 2:1 T:D split are calibration parameters.
  if (fUnseen.length < 3 && SLOTS.includes('F')) {
    let fIdx = 0;
    SLOTS = SLOTS.map(s => {
      if (s !== 'F') return s;
      const rep = fIdx % 3 === 2 ? 'D' : 'T';
      fIdx++;
      return rep;
    });
  }

  // Phase 1: Fill from FRESH UNSEEN candidates only
  const pPool = [...pTiers.freshUnseen];
  const tPool = [...tTiers.freshUnseen];
  const dPool = [...dTiers.freshUnseen];
  const iPool = [...iTiers.freshUnseen];
  const fPool = [...fUnseen];

  // Lazy-fetch embeddings for personalized path MMR (same pattern as bandit Change 3)
  // Take top 50 from each pool — these are the candidates MMR will actually score
  if (hasAnyPersonalization) {
    const mmrCandidateIds = new Set();
    for (const pool of [pPool, tPool, dPool, iPool, fPool]) {
      for (const a of pool.slice(0, 50)) {
        if (!embeddingCache.has(a.id)) mmrCandidateIds.add(a.id);
      }
    }
    if (mmrCandidateIds.size > 0) {
      const { data: embData } = await supabase
        .from('published_articles')
        .select('id, embedding_minilm')
        .in('id', [...mmrCandidateIds].slice(0, 200));
      if (embData) {
        for (const a of embData) {
          const emb = safeJsonParse(a.embedding_minilm, null);
          if (emb && Array.isArray(emb) && emb.length > 0) {
            embeddingCache.set(a.id, emb);
          }
        }
      }
    }
  }

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

  // IMPROVEMENT 3: MMR select with event/cluster + entity dedup
  // Fix E (Apr 18): also enforce one-pick-per-article across THIS request. Pool
  // assembly can legitimately place the same article in multiple pools (e.g.
  // both personal and trending); this ensures no page ever contains duplicates.
  const servedInThisRequest = new Set();

  // Hard per-leaf cluster cap. The hierarchical bandit + MAX_PER_SUPER cap
  // already keep super-clusters diverse, but inside a hot super (the user's
  // dominant interest) one specific leaf can still take 4-6 of 10 cards. In
  // observed sessions one leaf took 24 of 64 impressions across a 16-min
  // window. A hard 4-per-leaf-per-feed cap keeps the slate readable without
  // hurting personalization (the leaf still wins lots of slots, just not all).
  const MAX_PER_LEAF_PER_FEED = 4;
  function isLeafCapped(article, sel) {
    const leaf = article?.leaf_cluster_id;
    const sup = article?.super_cluster_id;
    if (leaf == null || sup == null) return false;
    let count = 0;
    for (const s of sel) {
      if (s.leaf_cluster_id === leaf && s.super_cluster_id === sup) count++;
      if (count >= MAX_PER_LEAF_PER_FEED) return true;
    }
    return false;
  }

  function mmrSelectDeduped(pool, sel, tc, lambda) {
    let attempts = 0;
    while (attempts < 10 && pool.length > 0) {
      const picked = mmrSelect(pool, sel, tc, lambda, embeddingCache);
      if (!picked) return null;
      if (servedInThisRequest.has(picked.id)) { attempts++; continue; }
      if (isEventCapped(picked)) { attempts++; continue; }
      if (isEntityCappedShared(picked)) { attempts++; continue; }
      if (isLeafCapped(picked, sel)) { attempts++; continue; }
      servedInThisRequest.add(picked.id);
      return picked;
    }
    return null;
  }

  // ==========================================
  // ENTITY-LEVEL FREQUENCY CAP (shared across all paths)
  // Tiered by how dominant an entity is in the candidate pool.
  // ==========================================

  const entityFreqInPoolShared = {};
  for (const a of allArticles) {
    const tags = safeJsonParse(a.interest_tags, []);
    for (const tag of tags) {
      const t = tag.toLowerCase();
      entityFreqInPoolShared[t] = (entityFreqInPoolShared[t] || 0) + 1;
    }
  }

  function getEntityCapShared(tag) {
    const freq = entityFreqInPoolShared[tag] || 0;
    // Tight caps to prevent topic flooding (5 Artemis articles in one feed)
    // Tags like "artemis" with freq=4-9 were getting Infinity cap (no limit)
    if (freq >= 50) return 3;
    if (freq >= 20) return 3;
    if (freq >= 10) return 3;
    if (freq >= 3) return 2; // NEW: even low-freq tags get capped at 2
    return 3; // unknown tags: max 3 (was Infinity)
  }

  const entitySelectionCountsShared = {};

  function isEntityCappedShared(article) {
    const tags = safeJsonParse(article.interest_tags, []);
    for (const tag of tags) {
      const t = tag.toLowerCase();
      const cap = getEntityCapShared(t);
      if ((entitySelectionCountsShared[t] || 0) >= cap) return true;
    }
    return false;
  }

  function recordEntitySelectionShared(article) {
    const tags = safeJsonParse(article.interest_tags, []);
    for (const tag of tags) {
      const t = tag.toLowerCase();
      entitySelectionCountsShared[t] = (entitySelectionCountsShared[t] || 0) + 1;
    }
  }

  // ==========================================
  // V15 COLD-START: Thompson Sampling bandit with:
  // - Per-category normalized pools (Fix 2)
  // - Entity-level frequency cap (Fix 1)
  // - Entity-level bandit learning (Fix 4)
  // - Proper Beta sampling via gamma distribution (Fix 6)
  // - Dynamic time window for deeper pages (Fix 5)
  // - Missing article lookup bug fix (Fix 4b)
  // - Also runs for personalized users with small pool (< 100 articles)
  // ==========================================

  // console.log(`[feed-diag] interestCategories=${[...interestCategories].join(',')} iPool=${iPool.length} pPool=${pPool.length} tPool=${tPool.length} dPool=${dPool.length} fPool=${fPool.length}`);

  if (!hasAnyPersonalization) {
    // console.log('[feed-diag] BRANCH: cold-start bandit');

    // ── Fix 6: Proper Beta sampling via Marsaglia-Tsang gamma method ──
    function normalRandom() {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
    }

    function sampleGamma(shape) {
      if (shape < 1) {
        return sampleGamma(shape + 1) * Math.pow(Math.random() || 0.001, 1 / shape);
      }
      const d = shape - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);
      while (true) {
        let x, v;
        do {
          x = normalRandom();
          v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.random() || 0.001;
        if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
      }
    }

    function sampleBeta(alpha, beta) {
      const x = sampleGamma(alpha);
      const y = sampleGamma(beta);
      return (x + y) > 0 ? x / (x + y) : 0.5;
    }

    // ── Fix 2+7: Subtopic-diverse pool construction ──
    // Instead of top 30 per category (dominated by mainstream),
    // fetch top N per SUBTOPIC within each category.
    // Guarantees niche content (K-Drama, Cricket, etc.) exists in pool.
    const pageNum = Math.floor(seenArticleIds.length / limit) + 1;
    const catTimeWindow = pageNum >= 3 ? sevenDaysAgo : fortyEightHoursAgo;
    const catFallbackWindow = sevenDaysAgo; // expanded window for empty subtopics
    const catScoreThreshold = pageNum >= 3 ? 200 : 300;

    const SUBTOPIC_MAP = {
      'Entertainment': [
        { name: 'Movies & Film', tags: ['movie', 'film', 'cinema', 'box office', 'director', 'oscar', 'hollywood'] },
        { name: 'TV & Streaming', tags: ['netflix', 'hbo', 'streaming', 'series', 'television', 'disney'] },
        { name: 'Music', tags: ['album', 'concert', 'song', 'billboard', 'grammy', 'rapper', 'singer', 'tour'] },
        { name: 'Gaming', tags: ['game', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'gaming'] },
        { name: 'K-Pop & K-Drama', tags: ['kpop', 'k-pop', 'bts', 'blackpink', 'kdrama', 'k-drama', 'korean', 'hallyu', 'stray kids', 'newjeans'] },
        { name: 'Celebrity', tags: ['celebrity', 'red carpet', 'award', 'star', 'met gala'] },
      ],
      'Sports': [
        { name: 'NFL', tags: ['nfl', 'touchdown', 'quarterback', 'super bowl', 'american football'] },
        { name: 'NBA', tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron'] },
        { name: 'Soccer', tags: ['soccer', 'football', 'premier league', 'la liga', 'champions league', 'mls', 'fifa'] },
        { name: 'Cricket', tags: ['cricket', 'ipl', 't20', 'ashes', 'test match', 'bcci'] },
        { name: 'F1 & Motorsport', tags: ['formula 1', 'f1', 'grand prix', 'racing', 'nascar'] },
        { name: 'Combat Sports', tags: ['ufc', 'mma', 'boxing', 'fight', 'knockout'] },
        { name: 'Other Sports', tags: ['tennis', 'golf', 'olympics', 'swimming', 'rugby'] },
      ],
      'Politics': [
        { name: 'US Politics', tags: ['trump', 'congress', 'senate', 'republican', 'democrat', 'white house', 'biden', 'supreme court'] },
        { name: 'Middle East', tags: ['iran', 'israel', 'hezbollah', 'hamas', 'gaza', 'tehran', 'saudi'] },
        { name: 'European Politics', tags: ['eu', 'european union', 'macron', 'germany', 'uk', 'nato', 'brexit'] },
        { name: 'Asian Politics', tags: ['china', 'india', 'modi', 'japan', 'north korea', 'taiwan'] },
        { name: 'Human Rights', tags: ['human rights', 'protest', 'democracy', 'censorship', 'war crimes'] },
      ],
      'Tech': [
        { name: 'AI & ML', tags: ['ai', 'artificial intelligence', 'chatgpt', 'openai', 'llm', 'machine learning', 'deep learning'] },
        { name: 'Consumer Tech', tags: ['iphone', 'apple', 'samsung', 'google', 'smartphone', 'gadget'] },
        { name: 'Cybersecurity', tags: ['cybersecurity', 'hack', 'breach', 'ransomware', 'privacy'] },
        { name: 'Space Tech', tags: ['spacex', 'nasa', 'rocket', 'satellite', 'starship'] },
        { name: 'Social Media', tags: ['social media', 'tiktok', 'instagram', 'twitter', 'meta', 'facebook'] },
      ],
      'Science': [
        { name: 'Space & Astronomy', tags: ['space', 'astronomy', 'mars', 'telescope', 'galaxy', 'planet', 'nasa'] },
        { name: 'Climate & Environment', tags: ['climate', 'environment', 'warming', 'carbon', 'emissions', 'biodiversity'] },
        { name: 'Biology & Nature', tags: ['biology', 'wildlife', 'evolution', 'genetics', 'species'] },
        { name: 'Physics & Earth', tags: ['physics', 'quantum', 'earthquake', 'volcano', 'ocean'] },
      ],
      'Health': [
        { name: 'Medical', tags: ['medical', 'treatment', 'surgery', 'clinical trial', 'fda'] },
        { name: 'Public Health', tags: ['pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'covid'] },
        { name: 'Mental Health', tags: ['mental health', 'anxiety', 'depression', 'therapy', 'wellbeing'] },
        { name: 'Nutrition & Fitness', tags: ['nutrition', 'diet', 'fitness', 'exercise', 'obesity'] },
      ],
    };

    const ALL_CATEGORIES = [
      'Politics', 'World', 'Business', 'Sports', 'Entertainment',
      'Tech', 'Science', 'Health', 'Finance', 'Lifestyle',
    ];

    const categoryPools = {};
    const globalMaxScore = 1000;

    // Fetch pools per category using POOL_COLUMNS (lightweight, no embeddings)
    // Then partition client-side by subtopic tags
    const generalPromises = ALL_CATEGORIES.map(cat =>
      supabase.from('published_articles').select(POOL_COLUMNS)
        .eq('category', cat)
        .gte('created_at', catTimeWindow)
        .gte('ai_final_score', catScoreThreshold)
        .order('ai_final_score', { ascending: false })
        .limit(120) // wide fetch — subtopic partitioning + decay will select the best
    );
    const generalResults = await Promise.all(generalPromises);

    for (let ci = 0; ci < ALL_CATEGORIES.length; ci++) {
      const cat = ALL_CATEGORIES[ci];
      const allArticles_cat = (generalResults[ci].data || []).filter(a => {
        if (canonicalSeenIds.has(a.id) || sessionExcludeIds.has(a.id)) return false;
        const title = a?.title_news || a?.title || '';
        return !(/test/i.test(title));
      });

      if (allArticles_cat.length === 0) continue;

      const subtopics = SUBTOPIC_MAP[cat];
      const poolArticles = [];
      const usedIds = new Set();

      if (subtopics) {
        const perSubLimit = Math.max(8, Math.floor(80 / subtopics.length));

        for (const st of subtopics) {
          const stTagSet = new Set(st.tags.map(t => t.toLowerCase()));
          const matching = allArticles_cat.filter(a => {
            if (usedIds.has(a.id)) return false;
            const artTags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
            return artTags.some(t => {
              for (const stTag of stTagSet) {
                if (t.includes(stTag) || stTag.includes(t)) return true;
              }
              return false;
            });
          });

          let picked = matching.slice(0, perSubLimit);

          // If empty, try 7-day fallback
          if (picked.length === 0) {
            const { data: fallbackData } = await supabase.from('published_articles')
              .select(POOL_COLUMNS)
              .eq('category', cat)
              .gte('created_at', catFallbackWindow)
              .gte('ai_final_score', 200)
              .order('ai_final_score', { ascending: false })
              .limit(40);
            if (fallbackData) {
              const fallbackFiltered = fallbackData.filter(a => {
                if (usedIds.has(a.id) || canonicalSeenIds.has(a.id)) return false;
                const artTags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
                return artTags.some(t => {
                  for (const stTag of stTagSet) {
                    if (t.includes(stTag) || stTag.includes(t)) return true;
                  }
                  return false;
                });
              });
              picked = fallbackFiltered.slice(0, perSubLimit);
            }
          }

          for (const a of picked) {
            usedIds.add(a.id);
            poolArticles.push(a);
          }
        }

        // Fill remaining slots with general articles
        for (const a of allArticles_cat) {
          if (poolArticles.length >= 80) break;
          if (!usedIds.has(a.id)) {
            usedIds.add(a.id);
            poolArticles.push(a);
          }
        }
      } else {
        for (const a of allArticles_cat.slice(0, 80)) {
          poolArticles.push(a);
        }
      }

      if (poolArticles.length === 0) continue;

      // Blended normalization within the pool
      const catMax = Math.max(...poolArticles.map(a => a.ai_final_score || 0));
      const catMin = Math.min(...poolArticles.map(a => a.ai_final_score || 0));
      const catRange = catMax - catMin || 1;

      categoryPools[cat] = poolArticles.map(a => {
        const raw = a.ai_final_score || 0;
        const normalizedWithinCat = (raw - catMin) / catRange;
        const normalizedGlobal = raw / globalMaxScore;
        const blendedScore = 0.7 * normalizedWithinCat + 0.3 * normalizedGlobal;
        const recency = getRecencyDecay(a.created_at, a.category, a.shelf_life_days, a.freshness_category);
        return { ...a, _score: blendedScore * recency * 1000, _bucket: 'bandit' };
      }).sort((a, b) => b._score - a._score);

      // Add to articleMap and caches
      for (const a of categoryPools[cat]) {
        if (!articleMap[a.id]) articleMap[a.id] = a;
        if (!tagCache.has(a.id)) {
          const tags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
          tagCache.set(a.id, new Set(tags));
        }
        if (!embeddingCache.has(a.id)) {
          const emb = safeJsonParse(a.embedding_minilm, null);
          if (emb && Array.isArray(emb) && emb.length > 0) embeddingCache.set(a.id, emb);
        }
      }
    }

    // ── Fix 1: Entity-level frequency cap (tiered by pool dominance) ──
    // Compute entity frequency across the entire candidate pool
    const entityFreqInPool = {};
    for (const [cat, pool] of Object.entries(categoryPools)) {
      for (const a of pool) {
        const tags = safeJsonParse(a.interest_tags, []);
        for (const tag of tags) {
          const t = tag.toLowerCase();
          entityFreqInPool[t] = (entityFreqInPool[t] || 0) + 1;
        }
      }
    }

    function getEntityCap(tag) {
      const freq = entityFreqInPool[tag] || 0;
      if (freq >= 20) return 2;   // extreme dominance (e.g. iran) → very strict
      if (freq >= 10) return 3;   // moderate dominance (e.g. oil) → strict
      if (freq >= 5) return 4;    // some presence → mild cap
      return Infinity;            // rare tag → no cap needed
    }

    const entitySelectionCounts = {};

    function isEntityCappedFn(article) {
      const tags = safeJsonParse(article.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        const cap = getEntityCap(t);
        if ((entitySelectionCounts[t] || 0) >= cap) return true;
      }
      return false;
    }

    function recordEntitySelection(article) {
      const tags = safeJsonParse(article.interest_tags, []);
      for (const tag of tags) {
        const t = tag.toLowerCase();
        entitySelectionCounts[t] = (entitySelectionCounts[t] || 0) + 1;
      }
    }

    // ── Fix 4b: Fix missing article lookup bug for session signals ──
    // Fetch metadata for engaged/skipped articles not in current articleMap
    const missingSignalIds = [...sessionEngagedIds, ...sessionSkippedIds]
      .filter(id => id && !articleMap[id]);
    if (missingSignalIds.length > 0) {
      const batchSize = 300;
      for (let i = 0; i < missingSignalIds.length; i += batchSize) {
        const batch = missingSignalIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('published_articles')
          .select('id, category, interest_tags')
          .in('id', batch);
        if (data) {
          for (const a of data) articleMap[a.id] = a;
        }
      }
    }

    // ── Change 3: Soft entity blocklist with skip severity ──
    // Hard block only when penalty > 0.80 AND weightedSkips >= 4
    // Soft penalties reduce entity scoring smoothly
    const BROAD_TAGS = new Set([
      'politics', 'sports', 'business', 'technology', 'health', 'science',
      'entertainment', 'world', 'finance', 'energy', 'military', 'economy',
      'trade', 'security', 'government', 'breaking news', 'analysis',
      'investigation', 'opinion', 'editorial', 'lifestyle', 'culture',
    ]);

    // Build soft blocklist from entity penalties (computed later in entity scoring)
    // For now, build hard blocklist from raw skip counts as safety net
    const entitySkipCounts = {};
    for (const id of sessionSkippedIds) {
      const art = articleMap[id];
      if (!art) continue;
      for (const tag of safeJsonParse(art.interest_tags, [])) {
        const t = tag.toLowerCase();
        if (!BROAD_TAGS.has(t)) entitySkipCounts[t] = (entitySkipCounts[t] || 0) + 1;
      }
    }
    // Also count glanced articles — they REDUCE the skip penalty (Change 2)
    for (const id of sessionGlancedIds) {
      const art = articleMap[id];
      if (!art) continue;
      for (const tag of safeJsonParse(art.interest_tags, [])) {
        const t = tag.toLowerCase();
        if (!BROAD_TAGS.has(t)) entitySkipCounts[t] = (entitySkipCounts[t] || 0) - 0.3; // partial offset
      }
    }

    const entityBlocklist = new Set();
    for (const [entity, count] of Object.entries(entitySkipCounts)) {
      if (count >= 3) entityBlocklist.add(entity); // hard threshold stays at 3
    }

    function isBlockedByEntity(article) {
      if (entityBlocklist.size === 0) return false;
      const tags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase());
      const primaryTags = tags.slice(0, 2);
      if (primaryTags.some(t => entityBlocklist.has(t))) return true;
      const blockedCount = tags.filter(t => entityBlocklist.has(t)).length;
      if (blockedCount >= 2) return true;
      const titleLower = (article.title_news || '').toLowerCase();
      for (const blocked of entityBlocklist) {
        if (titleLower.includes(blocked)) return true;
      }
      return false;
    }

    // Filter blocked articles from category pools and penalize categories
    for (const [cat, pool] of Object.entries(categoryPools)) {
      const beforeLen = pool.length;
      categoryPools[cat] = pool.filter(a => !isBlockedByEntity(a));
      const removedRatio = beforeLen > 0 ? (beforeLen - categoryPools[cat].length) / beforeLen : 0;
      categoryPools[cat]._blockPenalty = removedRatio > 0.5 ? 5 : removedRatio > 0.3 ? 3 : removedRatio > 0.1 ? 1 : 0;
    }

    // ── Fix 9: Global pool topic cap (15%) ──
    // Prevent any single topic from dominating the entire candidate pool
    const GLOBAL_MAX_TOPIC_SHARE = 0.10; // tighter cap with larger pool
    const globalTopicCounts = {};
    let globalPoolSize = 0;
    for (const [cat, pool] of Object.entries(categoryPools)) {
      for (const a of pool) {
        const tags = safeJsonParse(a.interest_tags, []).map(t => t.toLowerCase());
        // Count primary tags (first 2) for topic dominance
        for (const t of tags.slice(0, 2)) {
          if (!BROAD_TAGS.has(t)) {
            globalTopicCounts[t] = (globalTopicCounts[t] || 0) + 1;
          }
        }
        globalPoolSize++;
      }
    }

    // Trim dominant topics to 15% of pool
    for (const [topic, count] of Object.entries(globalTopicCounts)) {
      const maxAllowed = Math.max(6, Math.floor(globalPoolSize * GLOBAL_MAX_TOPIC_SHARE));
      if (count <= maxAllowed) continue;

      let toRemove = count - maxAllowed;
      // Remove lowest-scored articles with this topic, across all pools
      const candidates = [];
      for (const [cat, pool] of Object.entries(categoryPools)) {
        for (let i = 0; i < pool.length; i++) {
          const tags = safeJsonParse(pool[i].interest_tags, []).map(t => t.toLowerCase());
          if (tags.slice(0, 2).includes(topic)) {
            candidates.push({ cat, idx: i, score: pool[i]._score || pool[i].ai_final_score || 0 });
          }
        }
      }
      // Sort by score ascending (remove worst first)
      candidates.sort((a, b) => a.score - b.score);
      const removeSet = new Set();
      for (const c of candidates) {
        if (toRemove <= 0) break;
        removeSet.add(`${c.cat}_${c.idx}`);
        toRemove--;
      }
      // Apply removals (reverse index order to avoid shifting)
      for (const [cat, pool] of Object.entries(categoryPools)) {
        categoryPools[cat] = pool.filter((a, i) => !removeSet.has(`${cat}_${i}`));
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════
    // V21: UNIFIED ENTITY SCORING + GLANCE SIGNALS + SKIP SEVERITY
    // Changes 2+3: glanced_ids count as 0.3 positive, skip severity differentiated
    // ══════════════════════════════════════════════════════════════

    // Step 1: Compute per-entity weighted engagement rate
    // engaged=1.0, glanced=0.3, skipped=0 (counted as exposure only)
    const entityStats = {};
    for (const id of sessionEngagedIds) {
      const art = articleMap[id];
      if (!art) continue;
      for (const tag of safeJsonParse(art.interest_tags, [])) {
        const t = tag.toLowerCase();
        if (BROAD_TAGS.has(t)) continue;
        if (!entityStats[t]) entityStats[t] = { weightedEng: 0, shown: 0 };
        entityStats[t].weightedEng += 1.0;
        entityStats[t].shown++;
      }
    }
    // Change 2: Glanced articles = 0.3 positive signal
    for (const id of sessionGlancedIds) {
      const art = articleMap[id];
      if (!art) continue;
      for (const tag of safeJsonParse(art.interest_tags, [])) {
        const t = tag.toLowerCase();
        if (BROAD_TAGS.has(t)) continue;
        if (!entityStats[t]) entityStats[t] = { weightedEng: 0, shown: 0 };
        entityStats[t].weightedEng += 0.3;
        entityStats[t].shown++;
      }
    }
    for (const id of sessionSkippedIds) {
      const art = articleMap[id];
      if (!art) continue;
      for (const tag of safeJsonParse(art.interest_tags, [])) {
        const t = tag.toLowerCase();
        if (BROAD_TAGS.has(t)) continue;
        if (!entityStats[t]) entityStats[t] = { weightedEng: 0, shown: 0 };
        entityStats[t].shown++; // exposure only, no positive weight
      }
    }

    // Unified score with weighted engagement rate
    const entityScores = {};
    for (const [entity, stats] of Object.entries(entityStats)) {
      if (stats.shown === 0) continue;
      const rate = stats.weightedEng / stats.shown;
      const confidence = 1 - (1 / (1 + stats.shown));
      entityScores[entity] = 0.5 + (rate - 0.5) * confidence;
    }

    // Change 3: Soft entity blocklist (replaces hard 3-skip block)
    // entityPenalty = weightedSkips / (weightedSkips + weightedEngages + 1)
    // Hard block only when penalty > 0.80 AND weightedSkips >= 4
    const entityPenalties = {};
    for (const [entity, stats] of Object.entries(entityStats)) {
      const weightedSkips = stats.shown - stats.weightedEng; // skips+partial_glances
      const penalty = weightedSkips / (weightedSkips + stats.weightedEng + 1);
      entityPenalties[entity] = { penalty, weightedSkips, hardBlock: penalty > 0.80 && weightedSkips >= 4 };
    }

    // Step 2: Category bandit with glance support
    const banditState = {};
    for (const cat of Object.keys(categoryPools)) {
      banditState[cat] = { alpha: 1, beta: 1 };
      const penalty = categoryPools[cat]._blockPenalty || 0;
      if (penalty > 0) banditState[cat].beta += penalty;
    }

    for (const id of sessionEngagedIds) {
      const art = articleMap[id];
      if (!art) continue;
      const cat = art.category || 'Other';
      if (!banditState[cat]) banditState[cat] = { alpha: 1, beta: 1 };
      banditState[cat].alpha += 2;
    }
    // Change 2: glanced articles = alpha += 0.3 (weak positive)
    for (const id of sessionGlancedIds) {
      const art = articleMap[id];
      if (!art) continue;
      const cat = art.category || 'Other';
      if (!banditState[cat]) banditState[cat] = { alpha: 1, beta: 1 };
      banditState[cat].alpha += 0.3;
    }
    for (const id of sessionSkippedIds) {
      const art = articleMap[id];
      if (!art) continue;
      const cat = art.category || 'Other';
      if (!banditState[cat]) banditState[cat] = { alpha: 1, beta: 1 };
      banditState[cat].beta += 1;
    }

    // Step 3: Score articles using entity scores as the within-category signal
    function entityScoreMultiplier(article) {
      const tags = safeJsonParse(article.interest_tags, []).map(t => t.toLowerCase()).filter(t => !BROAD_TAGS.has(t));
      let totalScore = 0;
      let count = 0;
      for (const t of tags) {
        if (entityScores[t] !== undefined) {
          totalScore += entityScores[t];
          count++;
        }
      }
      if (count === 0) return 1.0; // no data → neutral
      const avgScore = totalScore / count;
      // Map 0-1 score to 0.4-1.6 multiplier range
      return 0.4 + avgScore * 1.2;
    }

    // Apply entity scoring to pool
    for (const [cat, pool] of Object.entries(categoryPools)) {
      for (const a of pool) {
        a._score *= entityScoreMultiplier(a);
      }
      pool.sort((a, b) => b._score - a._score);
    }

    // Count total bandit pool for accurate has_more calculation
    banditPoolTotal = 0;
    for (const pool of Object.values(categoryPools)) {
      banditPoolTotal += (pool.length || 0);
    }

    // ── Fill slots via Thompson Sampling with entity cap ──
    let banditAttempts = 0;
    while (selected.length < limit && banditAttempts < limit * 5) {
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

      // Change 3: Lazy-fetch embeddings for MMR candidates in this category
      // Only fetch once per category, cache for reuse
      if (!pool._embeddingsFetched && pool.length > 0) {
        const poolIds = pool.slice(0, 30).map(a => a.id);
        const { data: embData } = await supabase
          .from('published_articles')
          .select('id, embedding_minilm')
          .in('id', poolIds);
        if (embData) {
          for (const a of embData) {
            const emb = safeJsonParse(a.embedding_minilm, null);
            if (emb && Array.isArray(emb) && emb.length > 0) {
              embeddingCache.set(a.id, emb);
            }
          }
        }
        pool._embeddingsFetched = true;
      }

      const picked = mmrSelect(pool, selected, tagCache, 0.6, embeddingCache);
      if (!picked) {
        delete categoryPools[bestCat]; // Exhausted
        continue;
      }

      // Event/cluster cap
      if (isEventCapped(picked)) continue;
      // Entity-level cap (Fix 1)
      if (isEntityCappedFn(picked)) continue;
      // Per-leaf cap — bandit path bypasses mmrSelectDeduped, apply directly.
      if (isLeafCapped(picked, selected)) continue;

      picked.bucket = 'bandit';
      recordEventSelection(picked);
      recordEntitySelection(picked);
      recordEntitySelectionShared(picked);
      selected.push(picked);
    }
  } else if (interestCategories.size > 0 && iPool.length > 0) {
    // console.log('[feed-diag] BRANCH: quota-based interest pre-fill');
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
        if (!usedIds.has(candidate.id)
            && !servedInThisRequest.has(candidate.id)
            && !isEventCapped(candidate)
            && !isEntityCappedShared(candidate)) {
          picked = candidate;
          break;
        }
      }

      if (picked) {
        usedIds.add(picked.id);
        servedInThisRequest.add(picked.id);
        picked.bucket = 'interest';
        recordEventSelection(picked);
        recordEntitySelectionShared(picked);
        selected.push(picked);
      } else {
        catKeys.splice(catIdx % catKeys.length, 1);
        if (catKeys.length === 0) break;
      }
      catIdx++;
    }

    // Fill remaining slots — every slot tries ALL pools before giving up
    let consecutiveFails = 0;
    for (let pos = 0; selected.length < limit && consecutiveFails < 20; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      // Try preferred pool first, then ALL others as fallback
      if (slot === 'F') {
        picked = mmrSelectDeduped(fPool, selected, tagCache, 0.5);
      } else if (slot === 'P') {
        picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
      } else if (slot === 'T') {
        picked = mmrSelectDeduped(tPool, selected, tagCache, 0.70);
      } else {
        picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
      }
      // Fallback: trending/discovery first (personalized), fresh_best last (exploration)
      if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.7);
      if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
      if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
      if (!picked) picked = mmrSelectDeduped(iPool, selected, tagCache, 0.5);
      if (!picked) picked = mmrSelectDeduped(fPool, selected, tagCache, 0.5);

      if (!picked) { consecutiveFails++; continue; }
      consecutiveFails = 0;

      picked.bucket = slot === 'F' ? 'fresh_best' : slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : slot === 'D' ? 'discovery' : 'discovery';
      recordEventSelection(picked);
      recordEntitySelectionShared(picked);
      selected.push(picked);
    }
  } else {
    // console.log('[feed-diag] BRANCH: standard personalized slot-filling');
    // Fix 8: Detect skip streak — if 5+ consecutive skips, switch to high-confidence only
    // Problem 2 (2026-04-20): session-timeout reset for news app. TikTok uses
    // 30 min for entertainment usage; news users have bursty check-ins
    // (morning/lunch/evening) where a short gap shouldn't count as new session.
    // Using 60 min — catches overnight clearly, tolerates meeting breaks.
    let usePivotMode = false;
    let sessionIsFresh = false;
    if (userId) {
      try {
        const { data: lastEventRow } = await supabase
          .from('user_article_events')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (lastEventRow?.created_at) {
          const lastEventMs = new Date(lastEventRow.created_at).getTime();
          const gapMs = Date.now() - lastEventMs;
          sessionIsFresh = gapMs > 60 * 60 * 1000; // 60 min — news-app calibration
        } else {
          sessionIsFresh = true;
        }
      } catch (_e) { /* non-blocking */ }
    }
    if (!sessionIsFresh && sessionSkippedIds.length >= 5) {
      const engagedSet = new Set(sessionEngagedIds);
      const glancedSet = new Set(sessionGlancedIds);
      let consecutiveSkips = 0;
      for (let i = sessionSkippedIds.length - 1; i >= 0; i--) {
        const skipId = sessionSkippedIds[i];
        if (!engagedSet.has(skipId) && !glancedSet.has(skipId)) {
          consecutiveSkips++;
        } else {
          break;
        }
      }
      usePivotMode = consecutiveSkips >= 5;
    }
    if (sessionIsFresh) {
      console.log(`[feed:session] fresh session (gap>30min) — pivot disabled`);
    }

    // Problem 3 (2026-04-20): per-super diversity cap. TikTok-style "don't
    // let any single topic-cluster dominate the page." Track how many articles
    // from each super have been selected; skip candidates when their super is
    // full. Matches TikTok's "7 consecutive from same category → inject
    // different" mechanism (our threshold: max 5 per super per page).
    const superCountOnPage = {};
    const MAX_PER_SUPER = 5;
    function withinSuperCap(article) {
      const s = article.super_cluster_id;
      if (s == null) return true;
      return (superCountOnPage[s] || 0) < MAX_PER_SUPER;
    }
    function recordSuperPick(article) {
      const s = article.super_cluster_id;
      if (s != null) superCountOnPage[s] = (superCountOnPage[s] || 0) + 1;
    }

    // Personalized user without topic selections: standard slot-filling
    let consecutiveFails2 = 0;
    for (let pos = 0; selected.length < limit && consecutiveFails2 < 20; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      if (usePivotMode) {
        // Fix E (2026-04-19) + Problem 3 (2026-04-20):
        // Selector sources articles matching top-8 positive signals.
        // NEW: multiplier floor of 0.8 prevents pivot-pool collapse observed
        // 04-20 12:51 (pages 3-4 dropped to 9% engagement when pivot backfilled
        // with low-mult articles that matched a top-8 tag but had poor overall
        // alignment). Also: per-super diversity cap applied below.
        if (topPositiveSignals.length >= 3) {
          const PIVOT_MULT_FLOOR = 0.8;
          const pivotMatches = (a) => {
            if (!withinSuperCap(a)) return false;
            const mult = entitySignalMultiplier(a);
            if (mult < PIVOT_MULT_FLOOR) return false;
            const sigs = safeJsonParse(a.typed_signals, []);
            if (!Array.isArray(sigs)) return false;
            return sigs.some(s => topPositiveSet.has(s));
          };
          const pivotTPool = tPool.filter(pivotMatches);
          const pivotDPool = dPool.filter(pivotMatches);
          const pivotPPool = pPool.filter(pivotMatches);
          picked = mmrSelectDeduped(pivotTPool, selected, tagCache, 0.5);
          if (!picked) picked = mmrSelectDeduped(pivotDPool, selected, tagCache, 0.4);
          if (!picked) picked = mmrSelectDeduped(pivotPPool, selected, tagCache, 0.5);
          // NO fallback to unfiltered pool — better fewer articles than skip-pattern repeat
        } else {
          // Cold-start fallback: old filter behavior (multiplier >= 1.0).
          const pivotFilter = (a) => withinSuperCap(a) && entitySignalMultiplier(a) >= 1.0;
          const pivotTPool = tPool.filter(pivotFilter);
          const pivotDPool = dPool.filter(pivotFilter);
          const pivotPPool = pPool.filter(pivotFilter);
          picked = mmrSelectDeduped(pivotTPool, selected, tagCache, 0.5);
          if (!picked) picked = mmrSelectDeduped(pivotDPool, selected, tagCache, 0.4);
          if (!picked) picked = mmrSelectDeduped(pivotPPool, selected, tagCache, 0.5);
        }
      } else if (slot === 'F') {
        picked = mmrSelectDeduped(fPool, selected, tagCache, 0.5);
      } else if (slot === 'P') {
        picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
      } else if (slot === 'T') {
        picked = mmrSelectDeduped(tPool, selected, tagCache, 0.70);
      } else {
        picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
      }
      // Fallback: trending/discovery first (personalized), fresh_best last (exploration)
      if (!picked) picked = mmrSelectDeduped(tPool, selected, tagCache, 0.7);
      if (!picked) picked = mmrSelectDeduped(dPool, selected, tagCache, 0.4);
      if (!picked) picked = mmrSelectDeduped(pPool, selected, tagCache, 0.7);
      if (!picked) picked = mmrSelectDeduped(iPool, selected, tagCache, 0.5);
      if (!picked) picked = mmrSelectDeduped(fPool, selected, tagCache, 0.5);

      if (!picked) { consecutiveFails2++; continue; }
      // Problem 3 (2026-04-20): per-super diversity cap applies in normal mode
      // too. Prevents monoculture pages (e.g. 18 of 20 from super 0 even when
      // the user also likes super 4 and 7).
      if (!withinSuperCap(picked)) { consecutiveFails2++; continue; }
      consecutiveFails2 = 0;

      picked.bucket = usePivotMode ? 'pivot' : (slot === 'F' ? 'fresh_best' : slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : slot === 'D' ? 'discovery' : 'discovery');
      recordEventSelection(picked);
      recordEntitySelectionShared(picked);
      recordSuperPick(picked);
      selected.push(picked);
    }
  }

  // console.log(`[feed-diag] After phase1 slot-filling: selected=${selected.length} limit=${limit}`);
  // console.log(`[feed-diag] Remaining pools: pPool=${pPool.length} tPool=${tPool.length} dPool=${dPool.length} iPool=${iPool.length} fPool=${fPool.length}`);

  // ==========================================
  // PHASE 6b: RESURFACED TIER (fill remaining slots from previously-seen articles)
  // Tier 2: Articles user previously engaged with — better than stale unseen.
  // ==========================================

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(a => a.id));

    // ONLY resurface articles the user previously ENGAGED with (not skipped ones).
    // Resurfacing skipped articles = showing duplicates the user already rejected.
    function sortResurfacedByEngagement(pool) {
      return pool.filter(a => {
        if (selectedIds.has(a.id)) return false;
        // Only allow articles the user previously engaged with or liked
        const meta = seenMeta.get(a.id);
        return meta && meta.was_engaged;
      }).sort((a, b) => (b._score || 0) - (a._score || 0));
    }

    const rpPool = sortResurfacedByEngagement(pTiers.resurfaced);
    const rtPool = sortResurfacedByEngagement(tTiers.resurfaced);
    const rdPool = sortResurfacedByEngagement(dTiers.resurfaced);
    const riPool = sortResurfacedByEngagement(iTiers.resurfaced);
    const rfPool = sortResurfacedByEngagement(fTiers.resurfaced);

    // Fetch embeddings for tier 2+3 candidates (for MMR dedup against already-selected)
    const fallbackCandidateIds = new Set();
    for (const pool of [rpPool, rtPool, rdPool, riPool, rfPool]) {
      for (const a of pool.slice(0, 30)) {
        if (!embeddingCache.has(a.id)) fallbackCandidateIds.add(a.id);
      }
    }
    if (fallbackCandidateIds.size > 0) {
      const { data: fallbackEmbData } = await supabase
        .from('published_articles')
        .select('id, embedding_minilm')
        .in('id', [...fallbackCandidateIds].slice(0, 200));
      if (fallbackEmbData) {
        for (const a of fallbackEmbData) {
          const emb = safeJsonParse(a.embedding_minilm, null);
          if (emb && Array.isArray(emb) && emb.length > 0) {
            embeddingCache.set(a.id, emb);
          }
        }
      }
    }

    // Fill from resurfaced tier — try all pools including fresh_best
    for (let pos = 0; selected.length < limit; pos++) {
      const slot = SLOTS[pos % SLOTS.length];
      let picked = null;

      if (slot === 'F') {
        picked = mmrSelectDeduped(rfPool, selected, tagCache, 0.5);
        if (!picked) picked = mmrSelectDeduped(rdPool, selected, tagCache, 0.4);
      } else if (slot === 'P') {
        picked = mmrSelectDeduped(rpPool, selected, tagCache, 0.7);
        if (!picked) picked = mmrSelectDeduped(rfPool, selected, tagCache, 0.5);
        if (!picked) picked = mmrSelectDeduped(rtPool, selected, tagCache, 0.70);
      } else if (slot === 'T') {
        picked = mmrSelectDeduped(rtPool, selected, tagCache, 0.70);
        if (!picked) picked = mmrSelectDeduped(rfPool, selected, tagCache, 0.5);
        if (!picked) picked = mmrSelectDeduped(rpPool, selected, tagCache, 0.7);
      } else {
        picked = mmrSelectDeduped(rdPool, selected, tagCache, 0.4);
        if (!picked) picked = mmrSelectDeduped(rfPool, selected, tagCache, 0.5);
        if (!picked) picked = mmrSelectDeduped(rpPool, selected, tagCache, 0.7);
      }
      if (!picked) picked = mmrSelectDeduped(riPool, selected, tagCache, 0.5);
      if (!picked) break;

      picked._resurfaced = true;
      picked.bucket = slot === 'P' ? 'personal' : slot === 'T' ? 'trending' : 'discovery';
      recordEventSelection(picked);
      recordEntitySelectionShared(picked);
      selected.push(picked);
    }
  }

  // ==========================================
  // PHASE 6c: STALE UNSEEN TIER (last resort — old articles user never saw)
  // Only articles still within their content-type freshness window (isStillFresh).
  // Stale breaking/developing news never appears here.
  // ==========================================

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(a => a.id));
    // Filter: only evergreen/analysis/timeless that are still "fresh" per their type.
    // isStillFresh already handles this — staleUnseen are articles that FAILED isStillFresh,
    // so this tier only adds articles from the original unseen pool that were borderline.
    // Actually, staleUnseen already failed isStillFresh, so skip this tier entirely
    // to avoid showing misleading old news. Resurfaced tier is the final fallback.
  }

  // ==========================================
  // PHASE 6.5: INTEREST CATEGORY ALLOCATION FLOOR (Fix 7)
  // Ensure historically-engaged categories aren't starved by session drift.
  // If Science is 25% of all-time engagement but only 5% of current feed,
  // swap in more Science articles from available pools.
  // ==========================================

  if (hasAnyPersonalization && Object.keys(categorySuppressionMap).length > 0) {
    const selectedCatCounts = {};
    for (const a of selected) {
      selectedCatCounts[a.category] = (selectedCatCounts[a.category] || 0) + 1;
    }

    try {
      const { data: allCatStats } = await supabase.rpc('get_category_engagement_stats', {
        p_user_id: userId,
        p_days: 14,
      });
      if (allCatStats && selected.length > 0) {
        const totalEngagedCat = allCatStats.reduce((s, c) => s + parseInt(c.engaged || 0), 0);
        if (totalEngagedCat > 0) {
          for (const row of allCatStats) {
            const engaged = parseInt(row.engaged) || 0;
            const rate = engaged / totalEngagedCat;
            if (rate < 0.10) continue; // not a significant interest
            if (categorySuppressionMap[row.category]) continue; // suppressed category, don't force it

            const targetSlots = Math.min(Math.round(rate * selected.length), Math.round(selected.length * 0.4));
            const currentSlots = selectedCatCounts[row.category] || 0;

            if (currentSlots < targetSlots) {
              const selectedIds = new Set(selected.map(a => a.id));
              const allPools = [...pPool, ...tPool, ...dPool, ...iPool];
              const candidates = allPools
                .filter(a => a.category === row.category && !selectedIds.has(a.id))
                .sort((a, b) => (b._score || 0) - (a._score || 0));

              let replaced = 0;
              const needed = targetSlots - currentSlots;
              for (let i = selected.length - 1; i >= 0 && replaced < needed && candidates.length > 0; i--) {
                if (categorySuppressionMap[selected[i].category] && categorySuppressionMap[selected[i].category] <= 0.40) {
                  const replacement = candidates.shift();
                  replacement.bucket = selected[i].bucket;
                  selected[i] = replacement;
                  replaced++;
                }
              }
            }
          }
        }
      }
    } catch (catFloorErr) {
      // Non-blocking: category allocation floor is a nice-to-have
    }
  }

  // ==========================================
  // PHASE 6.9: GLOBAL CATEGORY CAP — max 4 articles per category in a feed page
  // Prevents any single category from dominating (was 8 Lifestyle after per-pool caps)
  // ==========================================
  const GLOBAL_CAT_CAP = 4;
  const globalCatCounts = {};
  const capped = [];
  for (const a of selected) {
    const cat = a.category || 'Other';
    globalCatCounts[cat] = (globalCatCounts[cat] || 0) + 1;
    if (globalCatCounts[cat] <= GLOBAL_CAT_CAP) {
      capped.push(a);
    }
  }
  selected.length = 0;
  selected.push(...capped);

  // ==========================================
  // PHASE 7: ENFORCE MAX 2 CONSECUTIVE SAME CATEGORY
  // Final safety net — even if MMR allows it, never show 3+ in a row
  // ==========================================

  enforceConsecutiveLimit(selected, 2);

  // ==========================================
  // PHASE 7.25 (Fix 1A): ENTITY-DISPERSION RE-RANK
  // Source: Twitter DiversityDiscountProvider.scala in the-algorithm repo.
  // For each article in slate order, for each typed_signal, apply geometric
  // decay based on prior occurrence of that signal earlier in the slate.
  //   discount = (1 - Floor) * Decay^count + Floor
  // Decay=0.5, Floor=0.25 → first repeat halves contribution, steady state 0.25×.
  // Skips lang:* and loc:usa — those appear on nearly every article and would
  // over-penalize every slot after the first.
  // ==========================================
  {
    const ENTITY_DECAY = 0.5;
    const ENTITY_FLOOR = 0.25;
    const entitySeenCount = new Map();
    for (const article of selected) {
      const signals = safeJsonParse(article.typed_signals, []);
      if (!Array.isArray(signals)) continue;
      let totalDiscount = 1.0;
      for (const sig of signals) {
        if (typeof sig !== 'string') continue;
        if (sig.startsWith('lang:') || sig === 'loc:usa') continue;
        const count = entitySeenCount.get(sig) || 0;
        if (count > 0) {
          const d = (1 - ENTITY_FLOOR) * Math.pow(ENTITY_DECAY, count) + ENTITY_FLOOR;
          totalDiscount *= d;
        }
      }
      article._score = (article._score || 0) * totalDiscount;
      for (const sig of signals) {
        if (typeof sig !== 'string') continue;
        if (sig.startsWith('lang:') || sig === 'loc:usa') continue;
        entitySeenCount.set(sig, (entitySeenCount.get(sig) || 0) + 1);
      }
    }
    selected.sort((a, b) => (b._score || 0) - (a._score || 0));
  }

  // ==========================================
  // PHASE 7.5: QUALITY FLOOR — "You're all caught up"
  // After the good content is served, stop before serving dregs.
  // Only applies to page 2+ for users with sufficient history.
  // ==========================================

  if (offset > 0 && totalInteractions >= 50 && selected.length > 0) {
    const topScore = Math.max(...selected.map(a => a._score || 0));
    // Fix β: loosened post-Phase 1. Entity-dispersion re-rank + image feature
    // compress the score distribution enough that the pre-Phase-1 calibration
    // (0.15 / 3) was tripping mid-page on normal sessions.
    const FLOOR_RATIO = 0.10;
    const CONSECUTIVE_FLOOR_LIMIT = 4;
    let consecutiveBelowFloor = 0;
    const qualityFiltered = [];

    for (const candidate of selected) {
      const ratio = topScore > 0 ? (candidate._score || 0) / topScore : 0;
      if (ratio < FLOOR_RATIO) {
        consecutiveBelowFloor++;
        if (consecutiveBelowFloor >= CONSECUTIVE_FLOOR_LIMIT) break;
      } else {
        consecutiveBelowFloor = 0;
      }
      qualityFiltered.push(candidate);
    }

    const caughtUpByQuality = qualityFiltered.length < selected.length;
    if (caughtUpByQuality) {
      // Fix γ: the quality floor is meant to prevent catastrophic tails (the
      // April-18 9-skip-streak failure mode), not to shave pages with mild
      // tail compression. If the cut would leave fewer than MIN_PAGE_SIZE
      // articles, keep the full pre-cut slate instead.
      const MIN_PAGE_SIZE = 15;
      if (qualityFiltered.length < MIN_PAGE_SIZE) {
        console.log('[feed:quality-floor] rescue — cut would leave too few articles', {
          topScore: topScore.toFixed(1),
          wouldCutTo: qualityFiltered.length,
          restoredTo: selected.length,
          minPageSize: MIN_PAGE_SIZE,
        });
        // Leave `selected` unchanged — the original slate is preserved.
      } else {
        console.log('[feed:quality-floor]', {
          topScore: topScore.toFixed(1),
          selectedBefore: selected.length,
          selectedAfter: qualityFiltered.length,
          cutReason: `${selected.length - qualityFiltered.length} articles below ${(FLOOR_RATIO * 100).toFixed(0)}% of top score`,
          lastKeptRatio: qualityFiltered.length > 0
            ? ((qualityFiltered[qualityFiltered.length - 1]._score || 0) / topScore).toFixed(3)
            : null,
        });
        selected.length = 0;
        selected.push(...qualityFiltered);
      }
    }
  }

  // ==========================================
  // PHASE 8: FORMAT & RESPOND
  // ==========================================

  if (selected.length === 0) {
    return res.status(200).json({ articles: [], next_cursor: null, has_more: false, total: 0, feed_state: 'caught_up', fresh_count: 0 });
  }

  const pageIds = selected.map(a => a.id);

  // Fetch full article data for cold-start pool articles (they only have POOL_COLUMNS)
  if (selected[0] && !selected[0].url) {
    const { data: fullArticles } = await supabase
      .from('published_articles')
      .select(ARTICLE_COLUMNS)
      .in('id', pageIds);
    if (fullArticles) {
      const fullMap = {};
      for (const a of fullArticles) fullMap[a.id] = a;
      for (let i = 0; i < selected.length; i++) {
        const full = fullMap[selected[i].id];
        if (full) {
          const bucket = selected[i].bucket;
          const score = selected[i]._score;
          const resurfaced = selected[i]._resurfaced;
          Object.assign(selected[i], full);
          selected[i].bucket = bucket;
          selected[i]._score = score;
          if (resurfaced) selected[i]._resurfaced = true;
        }
      }
    }
  }

  // Re-use the candidate event map we already fetched (no duplicate query)
  const eventMap = candidateEventMap;

  const formattedArticles = selected.map(a => {
    const formatted = formatArticle(a, eventMap);
    formatted.bucket = a.bucket;
    formatted.final_score = a._score;
    // Attach resurfacing metadata to every article
    const meta = seenMeta.get(a.id);
    formatted.is_resurfaced = !!a._resurfaced;
    if (a._resurfaced && meta) {
      formatted.first_seen_at = meta.first_seen_at;
      formatted.was_engaged = meta.was_engaged || false;
    }
    return formatted;
  });

  // Synchronous serving log — must commit before response so next request sees them.
  // Per-impression policy state captured for IPS off-policy evaluation
  // (Swaminathan & Joachims 2015). Pool size = candidate inventory at the
  // moment of selection — propensity is the marginal probability under a
  // uniform-random baseline policy with that inventory.
  if (userId && pageIds.length > 0) {
    const totalPoolAtPolicyTime = pTiers.freshUnseen.length + tTiers.freshUnseen.length
      + dTiers.freshUnseen.length + iTiers.freshUnseen.length + fUnseen.length;
    const propensity = totalPoolAtPolicyTime > 0 ? (1 / totalPoolAtPolicyTime) : null;
    const slotsPatternStr = SLOTS.join('');
    const impressions = pageIds.map((aid, idx) => ({
      user_id: userId,
      article_id: aid,
      bucket: selected[idx]?.bucket || null,
      slot_index: idx,
      pool_size: totalPoolAtPolicyTime || null,
      propensity_score: propensity,
      slots_pattern: slotsPatternStr,
      request_id: requestId,
    }));
    const { error: impError } = await supabase.from('user_feed_impressions').insert(impressions);
    if (impError) console.error('[feed] Impression log failed:', impError.message);

    // Fix 1B: also write to the rolling 10-min exclusion table. Upsert because
    // the same article can be served, excluded for 10 min, and (after cleanup)
    // become eligible again — we want served_at to track the LATEST serve.
    try {
      const recentRows = pageIds.map(aid => ({
        user_id: userId,
        article_id: aid,
        served_at: new Date().toISOString(),
      }));
      const { error: recentErr } = await supabase
        .from('user_recent_impressions')
        .upsert(recentRows, { onConflict: 'user_id,article_id' });
      if (recentErr) console.error('[feed] Recent impressions log failed:', recentErr.message);

      // Enforce 100-row cap per user: delete oldest beyond the top 100. The
      // 5-minute pg_cron also sweeps rows past 10 min, so this is a soft cap.
      const { data: overflow } = await supabase
        .from('user_recent_impressions')
        .select('article_id')
        .eq('user_id', userId)
        .order('served_at', { ascending: false })
        .range(100, 999);
      if (overflow && overflow.length > 0) {
        const oldIds = overflow.map(r => r.article_id);
        await supabase
          .from('user_recent_impressions')
          .delete()
          .eq('user_id', userId)
          .in('article_id', oldIds);
      }
    } catch (e) { /* non-blocking */ }
  }

  // has_more: count fresh unseen + resurfaced (stale unseen excluded from feed)
  const totalFreshUnseenRemaining = pTiers.freshUnseen.length + tTiers.freshUnseen.length + dTiers.freshUnseen.length + iTiers.freshUnseen.length + fTiers.freshUnseen.length;
  const totalResurfaced = pTiers.resurfaced.length + tTiers.resurfaced.length + dTiers.resurfaced.length + iTiers.resurfaced.length + fTiers.resurfaced.length;
  const scoredTotal = totalFreshUnseenRemaining + totalResurfaced;
  const remainingPool = Math.max(banditPoolTotal, scoredTotal);
  const requestedLimit = limit || 20;
  // Phase 2c (2026-04-20): hasMore should be true when the leaf bandit has
  // learned posteriors that can drive pivot/augment on the next request, even
  // if this request's fresh pool was thin. Prevents the iOS "You're all caught
  // up!" banner from appearing prematurely when pivot mode has plenty of
  // content left. Users observed this on 04-19 — saw the banner, scrolled,
  // pivot delivered 40+ more articles.
  const leafBanditCanDeliverMore = userLeafArmsLearned >= 5;
  const hasMore = (selected.length >= requestedLimit && remainingPool > selected.length)
    || leafBanditCanDeliverMore;
  const totalServed = offset + selected.length;
  const nextCursor = hasMore ? `v2_${totalServed}_${selected[selected.length - 1]?.id || 0}` : null;

  // feed_state: tells iOS how to present the feed
  //   normal         — plenty of fresh content
  //   thinning       — fresh content running low, might want to show "more coming soon"
  //   mostly_caught_up — very few fresh articles, show divider before resurfaced
  //   caught_up      — no fresh articles at all
  //
  // Phase 2c (2026-04-20): demote caught_up → thinning when the leaf bandit
  // has enough learned arms (>=5) to drive pivot mode on the next request.
  // Observed 04-19 session showed users seeing "all caught up" premature —
  // they scrolled past, pivot fired, 40 more articles served. Don't claim
  // "done" when there's a realistic chance the next request delivers more.
  const canLeafBanditDeliverMore = userLeafArmsLearned >= 5;
  let feedState = totalFreshUnseen >= requestedLimit ? 'normal'
    : totalFreshUnseen >= 5 ? 'thinning'
    : totalFreshUnseen > 0 ? 'mostly_caught_up'
    : 'caught_up';
  if (feedState === 'caught_up' && canLeafBanditDeliverMore) {
    feedState = 'thinning';  // pivot/leaf-augment can still deliver
  }

  const caughtUpMessage = feedState === 'caught_up'
    ? "You're all caught up! Here are some stories worth another look."
    : feedState === 'mostly_caught_up'
    ? "You've seen most of today's stories. Here are some highlights."
    : null;

  // console.log(`[feed-diag] FINAL: selected=${selected.length} feedState=${feedState} freshCount=${totalFreshUnseen} formatted=${formattedArticles.length}`);

  // Fix J (2026-04-19): per-request timing for p95 monitoring after the
  // 200→300 per-cat bump. Watch for regressions >3s on Vercel.
  const _feedMs = Date.now() - _feedT0;
  const _sessHit = (sessionSkippedIds?.length || 0) + (sessionEngagedIds?.length || 0) + (sessionGlancedIds?.length || 0);
  console.log(`[feed:timing] ms=${_feedMs} selected=${selected.length} sess_hit=${_sessHit} user=${userId || 'guest'}`);

  return res.status(200).json({
    articles: formattedArticles,
    next_cursor: nextCursor,
    has_more: hasMore,
    total: remainingPool,
    feed_state: feedState,
    fresh_count: totalFreshUnseen,
    caught_up_message: caughtUpMessage,
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

  // Private cache — new users' feeds should adapt fast, no CDN sharing
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  const sevenDaysAgoCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch a large pool of articles within 7-day window (tightened from 30 days)
  const { data: articles, error } = await supabase
    .from('published_articles')
    .select(ARTICLE_COLUMNS)
    .gte('created_at', sevenDaysAgoCutoff)
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

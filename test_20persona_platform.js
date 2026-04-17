import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// 20-PERSONA REALISTIC FEED EXPERIENCE SIMULATOR
// Each persona has emotions, gets bored, gets excited, and tells you why they left
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const SESSIONS_PER_PERSONA = 3;
const DELAY_BETWEEN_EVENTS_MS = 80;
const DELAY_BETWEEN_PAGES_MS = 400;
const DELAY_BETWEEN_SESSIONS_MS = 2500;
const STARTING_MOOD = 50; // Neutral — not optimistic, not pessimistic
const MAX_ARTICLE_AGE_HOURS = 12; // Only consider articles from the last 12 hours

async function getAccessToken(email, password) {
  const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) return null;
  return data.session.access_token;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function moodEmoji(m) { return m >= 65 ? '😊' : m >= 45 ? '😐' : m >= 25 ? '😒' : '😤'; }

// ============================================================================
// 20 PERSONAS — Each with personality, voice, and emotional triggers
// ============================================================================
const PERSONAS = [
  {
    name: 'Lena', age: 32, location: 'San Francisco',
    bio: 'AI research lead. Reads arXiv daily. Loves space docs and indie games.',
    email: 'persona_lena@tennews.test',
    homeCountry: 'usa', followedCountries: ['japan', 'uk'],
    followedTopics: ['ai', 'tech_industry', 'space', 'science', 'gaming'],
    interests: ['artificial intelligence', 'machine learning', 'tech', 'apple', 'google', 'nvidia', 'openai', 'space', 'nasa', 'spacex', 'video games', 'gaming', 'science', 'robotics', 'quantum', 'semiconductor', 'software'],
    mildInterests: ['cybersecurity', 'startups', 'consumer tech', 'climate', 'japan'],
    avoidTags: ['soccer', 'football', 'cricket', 'nfl', 'baseball', 'wwe', 'formula 1', 'basketball'],
    avoidCategories: ['Sports'],
    personality: { curiosity: 0.2, patience: 0.8, saveRate: 0.08, readStyle: 'deep', sessionSize: [25, 40] },
    opening: 'Checking if there are any AI breakthroughs or space news today',
  },
  {
    name: 'Marco', age: 35, location: 'Milan',
    bio: 'Sports editor at Gazzetta. Lives for Serie A, Champions League, and F1 race weekends.',
    email: 'persona_marco@tennews.test',
    homeCountry: 'italy', followedCountries: ['uk', 'spain'],
    followedTopics: ['football', 'f1', 'basketball', 'tennis', 'combat_sports'],
    interests: ['soccer', 'football', 'serie a', 'champions league', 'formula 1', 'f1', 'motorsport', 'basketball', 'nba', 'tennis', 'athletics', 'olympics', 'italy', 'premier league', 'transfer', 'la liga'],
    mildInterests: ['cricket', 'golf', 'rugby', 'swimming', 'boxing'],
    avoidTags: ['iran', 'geopolitics', 'stock market', 'inflation', 'federal reserve', 'nuclear', 'war', 'conflict'],
    avoidCategories: ['Finance', 'Politics'],
    personality: { curiosity: 0.1, patience: 0.5, saveRate: 0.03, readStyle: 'scanner', sessionSize: [30, 50] },
    opening: 'Quick check for match results, transfer rumors, and F1 qualifying',
  },
  {
    name: 'Nadia', age: 48, location: 'Berlin',
    bio: 'IR professor at Humboldt. Specializes in Middle East conflict and European security.',
    email: 'persona_nadia@tennews.test',
    homeCountry: 'germany', followedCountries: ['usa', 'israel', 'ukraine', 'turkiye'],
    followedTopics: ['geopolitics', 'conflicts', 'politics', 'human_rights'],
    interests: ['geopolitics', 'international relations', 'iran', 'middle east', 'israel', 'palestine', 'gaza', 'ukraine', 'russia', 'nato', 'military', 'diplomacy', 'sanctions', 'europe', 'germany', 'turkey', 'national security'],
    mildInterests: ['china', 'japan', 'human rights', 'refugees', 'trade', 'nuclear'],
    avoidTags: ['soccer', 'football', 'nfl', 'wwe', 'netflix', 'streaming', 'film', 'cricket', 'basketball', 'gaming'],
    avoidCategories: ['Sports', 'Entertainment'],
    personality: { curiosity: 0.15, patience: 1.0, saveRate: 0.12, readStyle: 'deep', sessionSize: [20, 35] },
    opening: 'Catching up on the Middle East situation and European security developments',
  },
  {
    name: 'Ryan', age: 38, location: 'New York',
    bio: 'Quant fund PM. Bloomberg terminal addict. Tracks macro, crypto, energy obsessively.',
    email: 'persona_ryan@tennews.test',
    homeCountry: 'usa', followedCountries: ['china', 'uk'],
    followedTopics: ['stock_markets', 'economics', 'banking', 'startups', 'ai'],
    interests: ['stock market', 'finance', 'wall street', 'nasdaq', 'inflation', 'federal reserve', 'interest rates', 'oil', 'energy', 'crypto', 'cryptocurrency', 'bitcoin', 'trade', 'tariff', 'gdp', 'earnings', 'recession', 'bonds'],
    mildInterests: ['ai', 'tech', 'real estate', 'gold', 'central bank', 'china'],
    avoidTags: ['soccer', 'football', 'wwe', 'netflix', 'streaming', 'film', 'music', 'concert', 'cricket', 'celebrity'],
    avoidCategories: ['Sports', 'Entertainment'],
    personality: { curiosity: 0.15, patience: 0.6, saveRate: 0.06, readStyle: 'scanner', sessionSize: [30, 50] },
    opening: 'Pre-market check — what moved overnight, any macro surprises',
  },
  {
    name: 'Priya', age: 31, location: 'Mumbai',
    bio: 'Film journalist at Times of India. Reviews Bollywood and Hollywood. TV show binger.',
    email: 'persona_priya@tennews.test',
    homeCountry: 'india', followedCountries: ['usa', 'uk'],
    followedTopics: ['entertainment', 'music', 'gaming', 'cricket', 'consumer_tech'],
    interests: ['entertainment', 'film', 'streaming', 'movies', 'netflix', 'hbo', 'bollywood', 'celebrity', 'television', 'oscar', 'disney', 'pixar', 'music', 'concert', 'india', 'cricket', 'ipl'],
    mildInterests: ['video games', 'fashion', 'social media', 'travel', 'food'],
    avoidTags: ['iran', 'geopolitics', 'stock market', 'inflation', 'military', 'nuclear', 'war', 'conflict'],
    avoidCategories: ['Finance', 'Politics'],
    personality: { curiosity: 0.25, patience: 0.7, saveRate: 0.05, readStyle: 'explorer', sessionSize: [20, 35] },
    opening: 'Any new movie trailers or Bollywood gossip today?',
  },
  {
    name: 'Yuki', age: 27, location: 'Tokyo',
    bio: 'Medical resident in neurosurgery. Follows health research and Japan news closely.',
    email: 'persona_yuki@tennews.test',
    homeCountry: 'japan', followedCountries: ['usa'],
    followedTopics: ['health', 'biotech', 'science', 'ai', 'consumer_tech'],
    interests: ['health', 'medicine', 'neuroscience', 'cancer', 'fda', 'clinical trial', 'vaccine', 'drug', 'mental health', 'brain', 'japan', 'biotech', 'pharmaceutical', 'surgery', 'hospital'],
    mildInterests: ['science', 'ai', 'nutrition', 'exercise', 'wellness', 'aging'],
    avoidTags: ['soccer', 'football', 'stock market', 'celebrity', 'war', 'conflict', 'cricket', 'wwe'],
    avoidCategories: ['Sports', 'Finance', 'Entertainment'],
    personality: { curiosity: 0.2, patience: 0.9, saveRate: 0.1, readStyle: 'deep', sessionSize: [15, 25] },
    opening: 'Looking for new clinical trial results or neuroscience papers',
  },
  {
    name: 'Carlos', age: 40, location: 'Sao Paulo',
    bio: 'Environmental reporter. Covers renewables, deforestation, and climate policy for Folha.',
    email: 'persona_carlos@tennews.test',
    homeCountry: 'usa', followedCountries: ['germany', 'china'],
    followedTopics: ['climate', 'science', 'tech_industry', 'politics', 'health'],
    interests: ['climate', 'environment', 'renewable energy', 'solar', 'wind', 'electric vehicle', 'carbon', 'deforestation', 'biodiversity', 'sustainability', 'pollution', 'agriculture', 'water', 'nature', 'wildfire'],
    mildInterests: ['science', 'space', 'health', 'brazil', 'amazon', 'trade'],
    avoidTags: ['celebrity', 'netflix', 'stock market', 'cricket', 'wwe', 'basketball', 'fashion'],
    avoidCategories: ['Entertainment', 'Sports'],
    personality: { curiosity: 0.3, patience: 0.8, saveRate: 0.09, readStyle: 'deep', sessionSize: [20, 30] },
    opening: 'Any climate policy updates or new renewable energy developments?',
  },
  {
    name: 'Ayse', age: 34, location: 'Istanbul',
    bio: 'SaaS startup founder. Follows tech, business trends, and Turkish politics avidly.',
    email: 'persona_ayse@tennews.test',
    homeCountry: 'turkiye', followedCountries: ['usa', 'germany', 'uk'],
    followedTopics: ['startups', 'tech_industry', 'ai', 'economics', 'geopolitics'],
    interests: ['startup', 'business', 'entrepreneur', 'tech', 'ai', 'ecommerce', 'turkey', 'turkish', 'erdogan', 'istanbul', 'ankara', 'venture capital', 'infrastructure', 'ceo', 'ipo', 'retail'],
    mildInterests: ['travel', 'aviation', 'europe', 'trade', 'innovation', 'education'],
    avoidTags: ['cricket', 'baseball', 'wwe', 'celebrity', 'war', 'conflict', 'nuclear'],
    avoidCategories: ['Sports'],
    personality: { curiosity: 0.25, patience: 0.6, saveRate: 0.07, readStyle: 'scanner', sessionSize: [25, 40] },
    opening: 'Checking startup news, funding rounds, and what is happening in Turkey',
  },
  {
    name: 'Mike', age: 58, location: 'Dallas',
    bio: 'Retired Army colonel. Follows defense news, US politics, and NASCAR on weekends.',
    email: 'persona_mike@tennews.test',
    homeCountry: 'usa', followedCountries: ['israel', 'ukraine'],
    followedTopics: ['politics', 'conflicts', 'geopolitics', 'american_football', 'f1'],
    interests: ['military', 'defense', 'national security', 'pentagon', 'veterans', 'gun', 'police', 'crime', 'donald trump', 'republican', 'us politics', 'congress', 'nascar', 'motorsport', 'nfl', 'american football'],
    mildInterests: ['israel', 'iran', 'china', 'russia', 'border', 'immigration', 'automotive'],
    avoidTags: ['netflix', 'streaming', 'celebrity', 'bollywood', 'k-pop', 'fashion', 'cooking', 'skincare'],
    avoidCategories: ['Entertainment'],
    personality: { curiosity: 0.1, patience: 0.7, saveRate: 0.04, readStyle: 'focused', sessionSize: [20, 35] },
    opening: 'What is the Pentagon up to? Any updates on the conflicts?',
  },
  {
    name: 'Zara', age: 20, location: 'London',
    bio: 'Uni student. TikTok native. Into music, mental health awareness, climate activism.',
    email: 'persona_zara@tennews.test',
    homeCountry: 'uk', followedCountries: ['usa'],
    followedTopics: ['music', 'entertainment', 'climate', 'health', 'human_rights'],
    interests: ['music', 'concert', 'festival', 'mental health', 'social media', 'tiktok', 'instagram', 'activism', 'climate', 'women', 'protest', 'education', 'student', 'london', 'uk', 'fashion', 'wellness'],
    mildInterests: ['film', 'streaming', 'travel', 'food', 'beauty', 'yoga'],
    avoidTags: ['stock market', 'inflation', 'federal reserve', 'nuclear', 'oil', 'war', 'military', 'pentagon'],
    avoidCategories: ['Finance'],
    personality: { curiosity: 0.35, patience: 0.4, saveRate: 0.03, readStyle: 'scanner', sessionSize: [15, 30] },
    opening: 'Scrolling through to see if anything interesting popped up',
  },
  {
    name: 'Robert', age: 68, location: 'Tampa',
    bio: 'Retired high school principal. Reads news at breakfast. Health, travel, light politics.',
    email: 'persona_robert@tennews.test',
    homeCountry: 'usa', followedCountries: ['canada', 'uk'],
    followedTopics: ['health', 'politics', 'travel', 'science', 'economics'],
    interests: ['health', 'retirement', 'medicare', 'cancer', 'heart', 'aging', 'travel', 'tourism', 'cruise', 'politics', 'election', 'florida', 'weather', 'hurricane', 'education'],
    mildInterests: ['golf', 'history', 'gardening', 'books', 'science', 'nutrition'],
    avoidTags: ['gaming', 'esports', 'tiktok', 'crypto', 'cryptocurrency', 'nft', 'k-pop', 'anime'],
    avoidCategories: [],
    personality: { curiosity: 0.3, patience: 1.0, saveRate: 0.02, readStyle: 'explorer', sessionSize: [10, 20] },
    opening: 'Morning news with coffee — let me see what is happening in the world',
  },
  {
    name: 'Devon', age: 21, location: 'Tuscaloosa',
    bio: 'College linebacker. Sports 24/7. Plays Madden and 2K in the dorm.',
    email: 'persona_devon@tennews.test',
    homeCountry: 'usa', followedCountries: [],
    followedTopics: ['american_football', 'basketball', 'football', 'combat_sports', 'gaming'],
    interests: ['nfl', 'american football', 'college football', 'basketball', 'nba', 'sports', 'draft', 'transfer', 'touchdown', 'wrestling', 'wwe', 'ufc', 'mma', 'gaming', 'video games', 'madden', 'nike', 'athlete'],
    mildInterests: ['soccer', 'baseball', 'boxing', 'gym', 'fitness', 'sneakers'],
    avoidTags: ['iran', 'geopolitics', 'stock market', 'inflation', 'parliament', 'nuclear', 'diplomacy'],
    avoidCategories: ['Finance', 'Politics', 'World'],
    personality: { curiosity: 0.05, patience: 0.3, saveRate: 0.02, readStyle: 'scanner', sessionSize: [20, 40] },
    opening: 'Need to check NFL draft news and if there are any UFC fights coming up',
  },
  {
    name: 'Camille', age: 33, location: 'Paris',
    bio: 'Creative director at a fashion house. Follows culture, design, and travel religiously.',
    email: 'persona_camille@tennews.test',
    homeCountry: 'france', followedCountries: ['italy', 'usa', 'japan'],
    followedTopics: ['entertainment', 'travel', 'consumer_tech', 'music', 'startups'],
    interests: ['fashion', 'design', 'luxury', 'entertainment', 'film', 'art', 'museum', 'travel', 'paris', 'france', 'europe', 'celebrity', 'beauty', 'architecture', 'photography', 'streaming'],
    mildInterests: ['food', 'wine', 'sustainability', 'music', 'concert', 'japan'],
    avoidTags: ['war', 'conflict', 'military', 'stock market', 'inflation', 'cricket', 'nfl', 'wrestling'],
    avoidCategories: ['Finance', 'Sports'],
    personality: { curiosity: 0.3, patience: 0.6, saveRate: 0.06, readStyle: 'explorer', sessionSize: [15, 25] },
    opening: 'Looking for something inspiring — culture, design, or travel pieces',
  },
  {
    name: 'Diego', age: 26, location: 'Miami',
    bio: 'Crypto analyst at a DeFi fund. Tracks on-chain data, macro, and fintech 16 hours a day.',
    email: 'persona_diego@tennews.test',
    homeCountry: 'usa', followedCountries: [],
    followedTopics: ['stock_markets', 'banking', 'ai', 'cybersecurity', 'startups'],
    interests: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'defi', 'blockchain', 'nft', 'stablecoin', 'fintech', 'regulation', 'sec', 'finance', 'tech', 'ai', 'startup', 'venture capital', 'web3'],
    mildInterests: ['stock market', 'federal reserve', 'inflation', 'gold', 'ecommerce'],
    avoidTags: ['soccer', 'cricket', 'wwe', 'bollywood', 'war', 'conflict', 'iran'],
    avoidCategories: ['Sports', 'World'],
    personality: { curiosity: 0.15, patience: 0.5, saveRate: 0.05, readStyle: 'scanner', sessionSize: [30, 50] },
    opening: 'What happened in crypto overnight? Any regulatory news?',
  },
  {
    name: 'Jennifer', age: 39, location: 'Chicago',
    bio: 'Middle school science teacher and mom of two. Follows education policy, health, and local politics.',
    email: 'persona_jennifer@tennews.test',
    homeCountry: 'usa', followedCountries: ['canada'],
    followedTopics: ['health', 'science', 'politics', 'climate', 'consumer_tech'],
    interests: ['education', 'school', 'teacher', 'health', 'vaccine', 'mental health', 'parenting', 'children', 'science', 'politics', 'election', 'gun violence', 'climate', 'weather', 'nutrition'],
    mildInterests: ['streaming', 'books', 'travel', 'cooking', 'exercise', 'wellness'],
    avoidTags: ['crypto', 'cryptocurrency', 'nft', 'wwe', 'mma', 'ufc', 'nascar', 'war'],
    avoidCategories: [],
    personality: { curiosity: 0.25, patience: 0.7, saveRate: 0.04, readStyle: 'explorer', sessionSize: [12, 22] },
    opening: 'Quick scroll before school — anything on education or health?',
  },
  {
    name: 'Taemin', age: 23, location: 'Seoul',
    bio: 'Semi-pro esports player (Valorant). Streams on Twitch. Follows gaming and tech hardware.',
    email: 'persona_taemin@tennews.test',
    homeCountry: 'japan', followedCountries: ['usa'],
    followedTopics: ['gaming', 'consumer_tech', 'ai', 'entertainment', 'tech_industry'],
    interests: ['gaming', 'esports', 'video games', 'twitch', 'streaming', 'playstation', 'xbox', 'nintendo', 'gpu', 'nvidia', 'amd', 'tech', 'ai', 'smartphone', 'consumer electronics', 'pc', 'vr'],
    mildInterests: ['anime', 'manga', 'film', 'music', 'k-pop', 'japan', 'space'],
    avoidTags: ['iran', 'geopolitics', 'stock market', 'inflation', 'oil', 'war', 'conflict', 'military', 'cricket'],
    avoidCategories: ['Finance', 'Politics', 'World'],
    personality: { curiosity: 0.1, patience: 0.35, saveRate: 0.02, readStyle: 'scanner', sessionSize: [25, 45] },
    opening: 'Any gaming news or new GPU announcements?',
  },
  {
    name: 'Henrik', age: 52, location: 'Geneva',
    bio: 'Former Swedish diplomat, now at a think tank. Follows geopolitics, human rights, and EU policy.',
    email: 'persona_henrik@tennews.test',
    homeCountry: 'germany', followedCountries: ['usa', 'ukraine', 'china', 'russia'],
    followedTopics: ['geopolitics', 'human_rights', 'politics', 'conflicts', 'economics'],
    interests: ['geopolitics', 'diplomacy', 'united nations', 'human rights', 'refugees', 'sanctions', 'nato', 'eu', 'europe', 'ukraine', 'russia', 'china', 'iran', 'nuclear', 'international law', 'trade', 'climate summit'],
    mildInterests: ['economics', 'gdp', 'science', 'health', 'travel', 'sweden'],
    avoidTags: ['gaming', 'esports', 'wwe', 'celebrity', 'bollywood', 'tiktok', 'k-pop', 'nfl'],
    avoidCategories: ['Entertainment', 'Sports'],
    personality: { curiosity: 0.2, patience: 1.1, saveRate: 0.1, readStyle: 'deep', sessionSize: [18, 30] },
    opening: 'Reviewing the latest developments in international affairs',
  },
  {
    name: 'Amara', age: 34, location: 'Toronto',
    bio: 'ER nurse at Toronto General. Follows health research, Canadian politics, and science news.',
    email: 'persona_amara@tennews.test',
    homeCountry: 'canada', followedCountries: ['usa', 'uk'],
    followedTopics: ['health', 'science', 'biotech', 'politics', 'climate'],
    interests: ['health', 'hospital', 'nurse', 'medicine', 'cancer', 'mental health', 'fda', 'drug', 'clinical trial', 'pandemic', 'vaccine', 'canada', 'toronto', 'science', 'public health', 'emergency'],
    mildInterests: ['education', 'women', 'travel', 'nutrition', 'biotech', 'exercise'],
    avoidTags: ['crypto', 'nft', 'wwe', 'mma', 'celebrity', 'nascar', 'war', 'conflict'],
    avoidCategories: ['Sports'],
    personality: { curiosity: 0.2, patience: 0.7, saveRate: 0.06, readStyle: 'focused', sessionSize: [12, 22] },
    opening: 'Checking for any new health studies or Canadian news on my break',
  },
  {
    name: 'Antonio', age: 43, location: 'Barcelona',
    bio: 'Owns a tapas restaurant chain. Reads business news, follows La Liga, and loves Mediterranean travel.',
    email: 'persona_antonio@tennews.test',
    homeCountry: 'spain', followedCountries: ['italy', 'france', 'usa'],
    followedTopics: ['startups', 'economics', 'football', 'travel', 'entertainment'],
    interests: ['business', 'restaurant', 'food', 'hospitality', 'tourism', 'spain', 'barcelona', 'la liga', 'soccer', 'football', 'champions league', 'travel', 'mediterranean', 'europe', 'retail', 'real estate'],
    mildInterests: ['wine', 'music', 'festival', 'film', 'formula 1', 'tennis', 'architecture'],
    avoidTags: ['crypto', 'nft', 'gaming', 'esports', 'nuclear', 'pentagon', 'war'],
    avoidCategories: [],
    personality: { curiosity: 0.3, patience: 0.6, saveRate: 0.04, readStyle: 'explorer', sessionSize: [15, 25] },
    opening: 'Let me see La Liga results and any food industry news',
  },
  {
    name: 'Fatima', age: 24, location: 'Washington DC',
    bio: 'Georgetown law student. Passionate about civil rights, immigration law, and constitutional issues.',
    email: 'persona_fatima@tennews.test',
    homeCountry: 'usa', followedCountries: ['uk', 'germany'],
    followedTopics: ['politics', 'human_rights', 'geopolitics', 'health', 'science'],
    interests: ['politics', 'law', 'supreme court', 'congress', 'civil rights', 'human rights', 'immigration', 'justice', 'constitution', 'election', 'legislation', 'protest', 'activism', 'women', 'education', 'gun violence'],
    mildInterests: ['health', 'climate', 'international relations', 'diplomacy', 'books'],
    avoidTags: ['crypto', 'nft', 'wwe', 'mma', 'nascar', 'gaming', 'esports', 'celebrity', 'bollywood'],
    avoidCategories: ['Sports'],
    personality: { curiosity: 0.2, patience: 0.8, saveRate: 0.07, readStyle: 'deep', sessionSize: [15, 28] },
    opening: 'Any Supreme Court decisions or civil rights developments?',
  },
];

// ============================================================================
// BEHAVIOR ENGINE — Satisfaction tracking, thoughts, and realistic exits
// ============================================================================

function getArticleTags(article) {
  const raw = article.interestTags || article.interest_tags || article.topics || [];
  return (Array.isArray(raw) ? raw : []).map(t => String(t).toLowerCase());
}

function simulateReaction(persona, article, ctx) {
  const tags = getArticleTags(article);
  const category = (article.category || '').trim();
  const title = (article.title || article.title_news || '').toLowerCase();

  let score = 0;
  const matched = [];
  const avoided = [];

  // Tag matching — realistic: not every match is exciting
  for (const tag of tags) {
    if (persona.interests.some(i => tag.includes(i) || i.includes(tag))) { score += 0.18; matched.push(tag); }
    else if (persona.mildInterests?.some(i => tag.includes(i) || i.includes(tag))) { score += 0.05; }
    if (persona.avoidTags?.some(a => tag.includes(a) || a.includes(tag))) { score -= 0.3; avoided.push(tag); }
  }

  // Category matching — gives a boost but not an auto-engage
  const topicCategoryMap = {
    'Tech': ['ai', 'tech_industry', 'consumer_tech', 'cybersecurity', 'space'],
    'Science': ['science', 'climate', 'biotech', 'space'],
    'Health': ['health', 'biotech'],
    'Sports': ['football', 'american_football', 'basketball', 'tennis', 'f1', 'cricket', 'combat_sports', 'olympics', 'golf', 'winter_sports', 'ice_hockey', 'rugby', 'swimming'],
    'Finance': ['stock_markets', 'economics', 'banking'],
    'Business': ['startups', 'economics', 'banking'],
    'Entertainment': ['entertainment', 'music', 'gaming'],
    'World': ['geopolitics', 'conflicts', 'human_rights'],
    'Politics': ['politics', 'geopolitics'],
    'Crypto': ['stock_markets', 'banking'],
  };
  const categoryTopics = topicCategoryMap[category] || [];
  if (categoryTopics.some(t => persona.followedTopics.includes(t))) score += 0.2;
  if (persona.avoidCategories?.includes(category)) score -= 0.4;

  // Quality boost — but realistic, high quality doesn't guarantee engagement
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += persona.personality.curiosity * 0.2;
  else if (aiScore >= 800) score += persona.personality.curiosity * 0.08;

  // Breaking news gets slight attention
  if (/breaking|just in|exclusive/i.test(title)) score += 0.08;

  // Fatigue — real users get tired of scrolling. This is significant.
  const idx = ctx.articleIndex;
  if (idx > 8) score -= 0.03;
  if (idx > 15) score -= 0.05;
  if (idx > 25) score -= 0.08;
  if (idx > 35) score -= 0.1;

  // Mood affects willingness — frustrated users are harder to please
  if (ctx.satisfaction < 35) score -= 0.08;
  if (ctx.satisfaction < 20) score -= 0.15;

  // Momentum — just engaged with something similar? Slightly more likely to engage again
  if (ctx.lastEngagedTags.length > 0) {
    const overlap = tags.filter(t => ctx.lastEngagedTags.includes(t)).length;
    if (overlap >= 2) score += 0.12;
    else if (overlap >= 1) score += 0.06;
  }

  // Desperation bonus removed — real users don't suddenly become more interested after skipping

  // Topic flooding — seeing same unwanted category repeatedly is very annoying
  const catSeenCount = ctx.categorySeen[category] || 0;
  if (persona.avoidCategories?.includes(category) && catSeenCount >= 2) score -= 0.12;
  if (persona.avoidCategories?.includes(category) && catSeenCount >= 5) score -= 0.15;

  // Content repetition — seeing many articles from same category gets stale even if liked
  if (catSeenCount >= 6 && !persona.avoidCategories?.includes(category)) score -= 0.05;
  if (catSeenCount >= 10) score -= 0.08;

  // Random variance — real users are unpredictable. Sometimes skip good stuff, sometimes read random things
  score += (Math.random() - 0.5) * 0.15;

  const p = persona.personality;
  const patience = p.patience;

  // --- Determine action + mood delta ---
  // Thresholds are higher — harder to impress
  if (score >= 0.65) {
    const dwell = (10 + Math.random() * 20) * patience;
    const shouldSave = Math.random() < p.saveRate * 1.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    // Mood boost is moderate — one good article doesn't fix everything
    const moodDelta = shouldSave ? +(6 + Math.random() * 5) : +(4 + Math.random() * 4);
    return { action: 'DEEP_READ', dwell, events, signal: 'ENGAGE', save: shouldSave, matched, avoided, moodDelta, score };
  }
  if (score >= 0.3) {
    const dwell = (4 + Math.random() * 10) * patience;
    const shouldSave = Math.random() < p.saveRate * 0.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    const moodDelta = +(2 + Math.random() * 3);
    return { action: 'ENGAGE', dwell, events, signal: 'ENGAGE', save: shouldSave, matched, avoided, moodDelta, score };
  }
  if (score >= 0.05) {
    const dwell = (2 + Math.random() * 3.5) * patience;
    // Glance barely affects mood — it's a "meh"
    return { action: 'GLANCE', dwell, events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', save: false, matched, avoided, moodDelta: -0.5, score };
  }
  if (score >= -0.1) {
    const dwell = 1 + Math.random() * 1.5;
    // Scanning something uninteresting is slightly annoying
    return { action: 'SCAN', dwell, events: ['article_view'], signal: 'NEUTRAL', save: false, matched, avoided, moodDelta: -2.5, score };
  }

  // SKIP — this is the important one. Skips hurt more than engagements help.
  const dwell = 0.3 + Math.random() * 0.8;
  const avoidPenalty = avoided.length > 0 ? -5 : -3;
  const floodPenalty = (persona.avoidCategories?.includes(category) && catSeenCount >= 2) ? -3 : 0;
  const streakPenalty = ctx.consecutiveSkips >= 3 ? -1.5 : 0; // each skip in a streak hurts more
  return { action: 'SKIP', dwell, events: ['article_skipped'], signal: 'SKIP', save: false, matched, avoided, moodDelta: avoidPenalty + floodPenalty + streakPenalty, score };
}

// ============================================================================
// THOUGHT GENERATION — What the persona is thinking at key moments
// ============================================================================

function generateThought(persona, article, reaction, ctx) {
  const category = (article.category || '').trim();
  const topic = reaction.matched[0] || category;
  const avoidTopic = reaction.avoided[0] || category;

  // SAVE moment
  if (reaction.save) {
    return pick([
      `Good piece on ${topic}. Saving.`,
      `Worth bookmarking.`,
      `Solid. Saved for later.`,
    ]);
  }

  // DEEP_READ after drought
  if (reaction.action === 'DEEP_READ' && ctx.consecutiveSkips >= 3) {
    return pick([
      `Finally something relevant. ${topic}.`,
      `Okay, this is more like it.`,
      `About time. Was about to close the app.`,
    ]);
  }

  // First match in session
  if ((reaction.action === 'ENGAGE' || reaction.action === 'DEEP_READ') && ctx.engagedCount === 0) {
    return pick([
      `Okay, ${topic}. Not bad for a start.`,
      `${topic} — let's see if the rest is this relevant.`,
      `At least the first article is on topic.`,
    ]);
  }

  // Good engagement
  if (reaction.action === 'DEEP_READ') {
    return pick([
      `Good ${category} piece.`,
      `${topic} — this is what I want to see.`,
      `Interesting ${topic} article. Read the whole thing.`,
      null, // sometimes just read without thinking about it
    ]);
  }

  if (reaction.action === 'ENGAGE' && reaction.matched.length >= 2) {
    return pick([
      `Decent article on ${topic}.`,
      `Okay, more of this.`,
      null,
    ]);
  }

  // Topic flooding — seeing the same unwanted category repeatedly
  if (reaction.action === 'SKIP' && reaction.avoided.length > 0) {
    const avoidedCatSkips = ctx.categorySkipped[category] || 0;

    if (avoidedCatSkips >= 5) {
      return `${category} AGAIN? ${avoidedCatSkips + 1} times now. Does this app even know what I selected?`;
    }
    if (avoidedCatSkips >= 3) {
      return pick([
        `More ${category}... I keep skipping these. ${avoidedCatSkips + 1} so far.`,
        `I picked ${persona.followedTopics[0]}, not ${avoidTopic}. Why is this in my feed?`,
        `${category} flooding. Come on.`,
      ]);
    }
    if (avoidedCatSkips >= 1) {
      return pick([
        `${category}? Pass.`,
        `Not interested in ${avoidTopic}.`,
        `Skip.`,
      ]);
    }
    return `${avoidTopic} — not my thing.`;
  }

  // Long skip streak — user is getting bored
  if (reaction.action === 'SKIP' && ctx.consecutiveSkips >= 5) {
    return pick([
      `Nothing relevant for a while now. About to close this.`,
      `Where is the content I actually want?`,
      `${ctx.consecutiveSkips + 1} skips in a row. This feed is wasting my time.`,
      null,
    ]);
  }

  if (reaction.action === 'SKIP' && ctx.consecutiveSkips >= 3) {
    return pick([
      `Still scrolling...`,
      `Nope.`,
      null,
    ]);
  }

  // GLANCE — mild curiosity
  if (reaction.action === 'GLANCE') {
    return pick([
      `Clickbait-y headline. Article was meh.`,
      `Opened it, not what I expected. Next.`,
      null,
      null, // most glances have no thought
    ]);
  }

  // Most articles get no thought — realistic
  return null;
}

function generateExitReason(persona, ctx) {
  const topSkippedCats = Object.entries(ctx.categorySkipped).sort((a, b) => b[1] - a[1]);
  const topEngagedCats = Object.entries(ctx.categoryEngaged).sort((a, b) => b[1] - a[1]);
  const engRate = ctx.totalSeen > 0 ? ctx.engagedCount / ctx.totalSeen : 0;

  const unwanted = topSkippedCats.slice(0, 2).map(([c]) => c).join(' and ');
  const wanted = persona.followedTopics.slice(0, 3).join(', ');
  const found = topEngagedCats.slice(0, 2).map(([c, n]) => `${c}(${n})`).join(', ');

  if (ctx.satisfaction < 15) {
    return `"Not for me. Selected ${wanted} but got mostly ${unwanted}. ${ctx.engagedCount} out of ${ctx.totalSeen} articles were worth reading. Uninstalling."`;
  }
  if (ctx.satisfaction < 25) {
    return `"Frustrating experience. Too much ${unwanted || 'stuff I do not care about'}. Found ${ctx.engagedCount} decent articles but had to wade through ${ctx.totalSeen - ctx.engagedCount} irrelevant ones. Not a good ratio."`;
  }
  if (ctx.satisfaction < 38) {
    return `"Meh. ${found ? `Some ${found} was okay` : 'A few decent articles'} but the feed does not really get me. ${topSkippedCats.length > 0 ? `Too much ${topSkippedCats[0][0]}.` : 'Needs better personalization.'}"`;
  }
  if (ctx.satisfaction < 50) {
    return `"It is alright. Found ${ctx.engagedCount} things worth reading. ${found ? `Mostly ${topEngagedCats[0]?.[0]}.` : ''} Nothing amazing but nothing terrible either. Average news app experience."`;
  }
  if (ctx.satisfaction < 62) {
    return `"Decent. ${topEngagedCats[0]?.[0] || 'Content'} selection was reasonable. ${ctx.savedCount > 0 ? `Saved ${ctx.savedCount}.` : 'Did not save anything though.'} Could be better at showing me what I actually want."`;
  }
  if (ctx.satisfaction < 75) {
    return `"Good session. Found solid ${topEngagedCats[0]?.[0] || 'content'}. ${ctx.savedCount > 0 ? `Saved ${ctx.savedCount} for later.` : 'Engaged with most of what I saw.'} The feed mostly gets me."`;
  }
  return `"Really good session. Lots of relevant ${topEngagedCats[0]?.[0] || 'content'}. ${ctx.savedCount > 0 ? `Saved ${ctx.savedCount}.` : 'Barely had to skip.'} Feed knows what I like."`;
}

function generateReturnVerdict(avgSatisfaction) {
  if (avgSatisfaction >= 72) return 'This is genuinely good. Will use it daily.';
  if (avgSatisfaction >= 60) return 'Solid app. Will keep it and check regularly.';
  if (avgSatisfaction >= 50) return 'It is okay. Might open it when bored. Not a daily habit though.';
  if (avgSatisfaction >= 40) return 'Probably not opening this again unless someone recommends it. Too much irrelevant stuff.';
  if (avgSatisfaction >= 28) return 'Not worth my time. The feed does not understand what I want.';
  return 'Uninstalling. This app showed me nothing I cared about.';
}

// ============================================================================
// API LAYER
// ============================================================================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Parse: ' + body.substring(0, 200))); } });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchFeed(userId, params = {}) {
  let url = `${API_BASE}/api/feed/main?limit=${params.limit || 25}&user_id=${encodeURIComponent(userId)}`;
  if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
  if (params.engagedIds?.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
  if (params.skippedIds?.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
  if (params.seenIds?.length) url += '&seen_ids=' + params.seenIds.slice(-300).join(',');
  return httpGet(url);
}

async function trackEvent(accessToken, eventData) {
  return httpPost(`${API_BASE}/api/analytics/track`, eventData, { 'Authorization': `Bearer ${accessToken}` });
}

// ============================================================================
// USER SETUP
// ============================================================================

async function setupPersona(persona) {
  const { data: existingUsers } = await adminDb.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === persona.email);
  let userId;

  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await adminDb.auth.admin.createUser({
      email: persona.email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: `${persona.name} (Test Persona)` },
    });
    if (error) { console.error(`  [SETUP] Auth error for ${persona.name}: ${error.message}`); return null; }
    userId = data.user.id;
    await sleep(600);
  }

  const { data: existingProfile } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
  const profileData = {
    email: persona.email, full_name: `${persona.name} (Test Persona)`,
    home_country: persona.homeCountry, followed_countries: persona.followedCountries,
    followed_topics: persona.followedTopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  };

  if (existingProfile) {
    const { error } = await adminDb.from('profiles').update(profileData).eq('id', userId);
    if (error) { console.error(`  [SETUP] Profile error for ${persona.name}: ${error.message}`); return null; }
  } else {
    const { error } = await adminDb.from('profiles').insert({ id: userId, ...profileData });
    if (error) { console.error(`  [SETUP] Profile error for ${persona.name}: ${error.message}`); return null; }
  }

  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);

  const accessToken = await getAccessToken(persona.email, PASSWORD);
  if (!accessToken) { console.error(`  [SETUP] Sign-in error for ${persona.name}`); return null; }
  return { userId, accessToken };
}

// ============================================================================
// SESSION SIMULATION — Full emotional model with narrative output
// ============================================================================

async function simulateSession(persona, userId, accessToken, sessionNum) {
  const sessionId = `sim_${persona.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;
  const sessionSize = persona.personality.sessionSize;
  const maxArticles = sessionSize[0] + Math.floor(Math.random() * (sessionSize[1] - sessionSize[0]));
  const maxPages = Math.ceil(maxArticles / 25) + 1;

  // Session state
  const engagedIds = [], skippedIds = [], seenIds = [];
  const interactions = [];
  const notableMoments = []; // Key moments to display in narrative
  let cursor = null;
  let totalTracked = 0;

  // Emotional context
  const ctx = {
    articleIndex: 0,
    consecutiveSkips: 0,
    lastEngagedTags: [],
    satisfaction: STARTING_MOOD, // Neutral — prove your worth
    engagedCount: 0,
    savedCount: 0,
    totalSeen: 0,
    categorySeen: {},
    categorySkipped: {},
    categoryEngaged: {},
    topicSkipCount: {},
  };

  let exitReason = '';
  let exitType = 'natural'; // natural, bored, frustrated

  for (let page = 1; page <= maxPages; page++) {
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    // Filter to only articles from the last MAX_ARTICLE_AGE_HOURS
    const now = Date.now();
    const cutoff = now - MAX_ARTICLE_AGE_HOURS * 3600000;
    const freshArticles = resp.articles.filter(a => {
      const created = new Date(a.created_at || a.createdAt || 0).getTime();
      return created >= cutoff;
    });
    if (freshArticles.length === 0) break; // No fresh content left

    for (const article of freshArticles) {
      const id = String(article.id);
      seenIds.push(id);
      ctx.articleIndex = interactions.length;
      ctx.totalSeen = interactions.length + 1;
      const category = (article.category || '').trim();
      ctx.categorySeen[category] = (ctx.categorySeen[category] || 0) + 1;

      // Simulate reaction
      const reaction = simulateReaction(persona, article, ctx);

      // Update satisfaction
      ctx.satisfaction = Math.max(0, Math.min(100, ctx.satisfaction + reaction.moodDelta));

      // Natural fatigue — real users get bored over time regardless of content quality
      if (ctx.articleIndex > 0 && ctx.articleIndex % 5 === 0) ctx.satisfaction = Math.max(0, ctx.satisfaction - 1.5);
      if (ctx.articleIndex > 20) ctx.satisfaction = Math.max(0, ctx.satisfaction - 0.3); // Extra drain for long sessions

      // Generate thought for notable moments
      const thought = generateThought(persona, article, reaction, ctx);
      const cleanTitle = (article.title || article.title_news || '').replace(/\*\*/g, '').substring(0, 60);

      // Track events through real API
      for (const eventType of reaction.events) {
        const eventData = {
          event_type: eventType, article_id: parseInt(id), session_id: sessionId,
          category: article.category || null, source: article.source || null, metadata: {},
        };
        if (eventType === 'article_engaged') eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)), engaged_seconds: Math.round(reaction.dwell), total_active_seconds: Math.round(reaction.dwell) };
        else if (eventType === 'article_exit') eventData.metadata = { total_active_seconds: Math.round(reaction.dwell) };
        else if (eventType === 'article_detail_view') eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)) };

        try { await trackEvent(accessToken, eventData); totalTracked++; } catch (e) {}
        await sleep(DELAY_BETWEEN_EVENTS_MS);
      }

      // Update session context
      if (reaction.signal === 'ENGAGE') {
        engagedIds.push(id);
        ctx.consecutiveSkips = 0;
        ctx.lastEngagedTags = getArticleTags(article).slice(0, 5);
        ctx.engagedCount++;
        ctx.categoryEngaged[category] = (ctx.categoryEngaged[category] || 0) + 1;
        if (reaction.save) ctx.savedCount++;
      } else if (reaction.signal === 'SKIP') {
        skippedIds.push(id);
        ctx.consecutiveSkips++;
        ctx.lastEngagedTags = [];
        ctx.categorySkipped[category] = (ctx.categorySkipped[category] || 0) + 1;
        for (const av of reaction.avoided) ctx.topicSkipCount[av] = (ctx.topicSkipCount[av] || 0) + 1;
      } else {
        if (reaction.signal !== 'GLANCE') ctx.consecutiveSkips++;
        else ctx.consecutiveSkips = 0;
      }

      // Record interaction
      const interaction = {
        num: interactions.length + 1, id, title: cleanTitle, category,
        bucket: article.bucket || '-', action: reaction.action, signal: reaction.signal,
        dwell: reaction.dwell, save: reaction.save, thought, mood: Math.round(ctx.satisfaction),
        matched: reaction.matched, avoided: reaction.avoided, score: reaction.score,
        source: (article.source || '').substring(0, 30),
        createdAt: article.created_at || article.createdAt || null,
      };
      interactions.push(interaction);

      // Decide if this is a notable moment to show in the narrative
      const isNotable = (
        interaction.num <= 3 || // First 3 articles
        (reaction.signal === 'ENGAGE' && ctx.engagedCount === 1) || // First engagement
        reaction.save || // Saves are always notable
        (reaction.action === 'SKIP' && ctx.consecutiveSkips === 4) || // Skip streak starting
        (reaction.action === 'SKIP' && ctx.consecutiveSkips >= 7 && ctx.consecutiveSkips % 3 === 0) || // Long skip streak
        (reaction.action === 'SKIP' && (ctx.categorySkipped[category] || 0) === 3 && persona.avoidCategories?.includes(category)) || // Topic flood moment
        (reaction.action === 'SKIP' && (ctx.categorySkipped[category] || 0) === 6 && persona.avoidCategories?.includes(category)) || // Major topic flood
        (reaction.action === 'DEEP_READ' && ctx.consecutiveSkips >= 3) || // Relief after skips
        (ctx.satisfaction <= 20 && reaction.moodDelta < 0) || // Frustration peak
        thought !== null // Any moment with a thought
      );

      if (isNotable) {
        notableMoments.push(interaction);
      }

      // --- EXIT DECISIONS --- (realistic: people leave apps easily)
      // Frustrated exit — doesn't take much
      if (ctx.satisfaction <= 18 && interactions.length >= 6) {
        exitType = 'frustrated';
        exitReason = generateExitReason(persona, ctx);
        break;
      }
      // Bored exit — a few skips in a row and low mood = gone
      if (ctx.satisfaction <= 30 && ctx.consecutiveSkips >= 4 && interactions.length >= 5) {
        exitType = 'bored';
        exitReason = generateExitReason(persona, ctx);
        break;
      }
      // Impatient exit — mood is mediocre and too many skips
      if (ctx.satisfaction <= 38 && ctx.consecutiveSkips >= 6) {
        exitType = 'bored';
        exitReason = generateExitReason(persona, ctx);
        break;
      }
      // Just not feeling it — mood dropped below starting point and been scrolling a while
      if (ctx.satisfaction <= 35 && interactions.length >= 12 && ctx.engagedCount < interactions.length * 0.25) {
        exitType = 'bored';
        exitReason = generateExitReason(persona, ctx);
        break;
      }
      // Natural end — reached target
      if (interactions.length >= maxArticles) {
        exitType = 'natural';
        exitReason = generateExitReason(persona, ctx);
        break;
      }
    }

    if (exitType !== 'natural' || interactions.length >= maxArticles) break;
    await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  // If we exited the loop without setting a reason
  if (!exitReason) exitReason = generateExitReason(persona, ctx);

  return {
    sessionNum, sessionId, interactions, notableMoments, totalTracked,
    exitType, exitReason, finalSatisfaction: Math.round(ctx.satisfaction),
    stats: {
      total: interactions.length, engaged: ctx.engagedCount, saved: ctx.savedCount,
      skipped: skippedIds.length, avgDwell: interactions.reduce((s, i) => s + i.dwell, 0) / (interactions.length || 1),
      engRate: interactions.length > 0 ? ctx.engagedCount / interactions.length : 0,
      categorySeen: ctx.categorySeen, categorySkipped: ctx.categorySkipped,
      categoryEngaged: ctx.categoryEngaged,
    },
  };
}

// ============================================================================
// NARRATIVE OUTPUT — Every article with full dwell time detail
// ============================================================================

function formatDwell(dwell) {
  if (dwell >= 60) return `${Math.floor(dwell / 60)}m${Math.round(dwell % 60)}s`;
  if (dwell >= 1) return `${dwell.toFixed(1)}s`;
  return `${(dwell * 1000).toFixed(0)}ms`;
}

function dwellBar(dwell, maxDwell) {
  const len = Math.min(20, Math.max(1, Math.round((dwell / Math.max(maxDwell, 1)) * 20)));
  if (dwell >= 10) return '█'.repeat(len);
  if (dwell >= 3) return '▓'.repeat(len);
  if (dwell >= 1) return '▒'.repeat(len);
  return '░'.repeat(len);
}

function printSessionNarrative(persona, session) {
  const s = session.stats;
  const exitIcon = session.exitType === 'frustrated' ? '🚪💢' : session.exitType === 'bored' ? '🚪😴' : '✅';
  const sessionLabel = session.sessionNum === 1 ? 'FIRST TIME' : session.sessionNum === 2 ? 'RETURNING' : 'ESTABLISHED';
  const maxDwell = Math.max(...session.interactions.map(i => i.dwell), 1);

  console.log(`\n  SESSION ${session.sessionNum} (${sessionLabel}):`);
  console.log(`  ┌${'─'.repeat(110)}`);
  console.log(`  │ ${moodEmoji(STARTING_MOOD)} Mood: ${STARTING_MOOD}  —  "${persona.opening}"`);
  console.log(`  │`);
  console.log(`  │  ${'#'.padStart(3)}  ${'Action'.padEnd(10)} ${'Dwell'.padStart(7)}  ${'Bar'.padEnd(20)}  ${'Mood'.padStart(4)}  ${'Category'.padEnd(14)} ${'Bucket'.padEnd(8)} Title`);
  console.log(`  │  ${'─'.repeat(106)}`);

  // Show EVERY article
  for (const m of session.interactions) {
    const actionIcon = m.action === 'DEEP_READ' ? '⭐' : m.action === 'ENGAGE' ? '👀' : m.action === 'GLANCE' ? '👁️' : m.action === 'SKIP' ? '⏭️' : '📰';
    const saveTag = m.save ? ' 💾' : '';
    const dwellStr = formatDwell(m.dwell);
    const bar = dwellBar(m.dwell, maxDwell);
    const matchStr = m.matched.length > 0 ? ` [${m.matched.slice(0,3).join(',')}]` : '';
    const avoidStr = m.avoided.length > 0 ? ` ✗${m.avoided.slice(0,2).join(',')}` : '';
    const titleTrunc = (m.title || '').substring(0, 50);

    console.log(`  │  ${String(m.num).padStart(3)}  ${(actionIcon + ' ' + m.action).padEnd(13)} ${dwellStr.padStart(7)}  ${bar.padEnd(20)}  ${moodEmoji(m.mood)}${String(m.mood).padStart(3)}  ${(m.category || '-').padEnd(14)} ${(m.bucket || '-').padEnd(8)} ${titleTrunc}${saveTag}${matchStr}${avoidStr}`);

    if (m.thought) {
      console.log(`  │       💭 "${m.thought}"`);
    }
  }

  // Session dwell summary
  const dwells = session.interactions.map(i => i.dwell);
  const totalDwell = dwells.reduce((a, b) => a + b, 0);
  const engagedDwells = session.interactions.filter(i => i.signal === 'ENGAGE').map(i => i.dwell);
  const skipDwells = session.interactions.filter(i => i.signal === 'SKIP').map(i => i.dwell);
  const glanceDwells = session.interactions.filter(i => i.action === 'GLANCE' || i.action === 'SCAN').map(i => i.dwell);
  const avgEngDwell = engagedDwells.length > 0 ? engagedDwells.reduce((a, b) => a + b, 0) / engagedDwells.length : 0;
  const avgSkipDwell = skipDwells.length > 0 ? skipDwells.reduce((a, b) => a + b, 0) / skipDwells.length : 0;
  const longestRead = session.interactions.reduce((best, i) => i.dwell > best.dwell ? i : best, { dwell: 0, title: '-', category: '-' });

  console.log(`  │  ${'─'.repeat(106)}`);
  console.log(`  │`);
  console.log(`  │  ${exitIcon} ${session.exitType === 'natural' ? 'FINISHED' : 'LEFT'} after ${s.total} articles`);
  console.log(`  │  ${session.exitReason}`);
  console.log(`  │`);
  console.log(`  │  DWELL ANALYSIS:`);
  console.log(`  │    Total time in feed:    ${formatDwell(totalDwell)}`);
  console.log(`  │    Avg dwell (all):       ${formatDwell(s.avgDwell)}`);
  console.log(`  │    Avg dwell (engaged):   ${formatDwell(avgEngDwell)} (${engagedDwells.length} articles)`);
  console.log(`  │    Avg dwell (skipped):   ${formatDwell(avgSkipDwell)} (${skipDwells.length} articles)`);
  console.log(`  │    Avg dwell (glance):    ${formatDwell(glanceDwells.length > 0 ? glanceDwells.reduce((a,b) => a+b, 0) / glanceDwells.length : 0)} (${glanceDwells.length} articles)`);
  console.log(`  │    Longest read:          ${formatDwell(longestRead.dwell)} — ${longestRead.category}: ${(longestRead.title || '').substring(0, 50)}`);
  console.log(`  │    Time on relevant:      ${formatDwell(engagedDwells.reduce((a,b) => a+b, 0))} (${totalDwell > 0 ? ((engagedDwells.reduce((a,b) => a+b, 0) / totalDwell) * 100).toFixed(0) : 0}% of session)`);
  console.log(`  │    Time wasted:           ${formatDwell(skipDwells.reduce((a,b) => a+b, 0) + glanceDwells.reduce((a,b) => a+b, 0))} (${totalDwell > 0 ? (((skipDwells.reduce((a,b) => a+b, 0) + glanceDwells.reduce((a,b) => a+b, 0)) / totalDwell) * 100).toFixed(0) : 0}% of session)`);
  console.log(`  │`);
  console.log(`  │  Engaged: ${s.engaged}/${s.total} (${(s.engRate * 100).toFixed(0)}%) │ Saved: ${s.saved} │ Final mood: ${session.finalSatisfaction} ${moodEmoji(session.finalSatisfaction)}`);
  console.log(`  └${'─'.repeat(110)}`);
}

function printPersonaReport(persona, sessions) {
  const THICK = '━'.repeat(112);

  console.log(`\n${THICK}`);
  console.log(`  ${persona.name.toUpperCase()}, ${persona.age} — ${persona.bio}`);
  console.log(`  Location: ${persona.location} │ Topics: ${persona.followedTopics.join(', ')} │ Style: ${persona.personality.readStyle}`);
  console.log(THICK);

  for (const session of sessions) {
    printSessionNarrative(persona, session);
  }

  // Aggregate dwell analysis across all sessions
  const allInteractions = sessions.flatMap(s => s.interactions);
  const allDwells = allInteractions.map(i => i.dwell);
  const totalTimeInApp = allDwells.reduce((a, b) => a + b, 0);
  const engagedArticles = allInteractions.filter(i => i.signal === 'ENGAGE');
  const skippedArticles = allInteractions.filter(i => i.signal === 'SKIP');
  const deepReads = allInteractions.filter(i => i.action === 'DEEP_READ');
  const glances = allInteractions.filter(i => i.action === 'GLANCE' || i.action === 'SCAN');

  // Dwell by category
  const dwellByCategory = {};
  const countByCategory = {};
  for (const i of allInteractions) {
    const cat = i.category || 'Unknown';
    dwellByCategory[cat] = (dwellByCategory[cat] || 0) + i.dwell;
    countByCategory[cat] = (countByCategory[cat] || 0) + 1;
  }
  const catDwellRanked = Object.entries(dwellByCategory).sort((a, b) => b[1] - a[1]);

  // Dwell by action
  const dwellByAction = {};
  for (const i of allInteractions) {
    dwellByAction[i.action] = (dwellByAction[i.action] || 0) + i.dwell;
  }

  // Top 5 longest-read articles
  const topReads = [...allInteractions].sort((a, b) => b.dwell - a.dwell).slice(0, 5);

  console.log(`\n  ┌${'─'.repeat(108)}`);
  console.log(`  │ PERSONA DWELL ANALYSIS (across ${sessions.length} sessions, ${allInteractions.length} articles)`);
  console.log(`  │${'─'.repeat(108)}`);
  console.log(`  │`);
  console.log(`  │  Total time in app:      ${formatDwell(totalTimeInApp)}`);
  console.log(`  │  Avg dwell per article:  ${formatDwell(totalTimeInApp / (allInteractions.length || 1))}`);
  console.log(`  │  Deep reads:             ${deepReads.length} articles, avg ${formatDwell(deepReads.length > 0 ? deepReads.reduce((s,i) => s+i.dwell, 0) / deepReads.length : 0)}`);
  console.log(`  │  Engagements:            ${engagedArticles.length} articles, avg ${formatDwell(engagedArticles.length > 0 ? engagedArticles.reduce((s,i) => s+i.dwell, 0) / engagedArticles.length : 0)}`);
  console.log(`  │  Glances/Scans:          ${glances.length} articles, avg ${formatDwell(glances.length > 0 ? glances.reduce((s,i) => s+i.dwell, 0) / glances.length : 0)}`);
  console.log(`  │  Skips:                  ${skippedArticles.length} articles, avg ${formatDwell(skippedArticles.length > 0 ? skippedArticles.reduce((s,i) => s+i.dwell, 0) / skippedArticles.length : 0)}`);
  console.log(`  │`);
  console.log(`  │  TIME SPENT BY CATEGORY:`);
  for (const [cat, dwell] of catDwellRanked) {
    const pct = ((dwell / totalTimeInApp) * 100).toFixed(0);
    const avgCatDwell = dwell / countByCategory[cat];
    const bar = '█'.repeat(Math.max(1, Math.round(parseFloat(pct) / 3)));
    console.log(`  │    ${cat.padEnd(16)} ${formatDwell(dwell).padStart(8)} (${pct}%) ${bar.padEnd(20)} avg ${formatDwell(avgCatDwell)}/article  (${countByCategory[cat]} articles)`);
  }
  console.log(`  │`);
  console.log(`  │  TOP 5 LONGEST READS:`);
  for (let i = 0; i < topReads.length; i++) {
    const r = topReads[i];
    const saveTag = r.save ? ' 💾' : '';
    console.log(`  │    ${i+1}. ${formatDwell(r.dwell).padStart(7)} │ ${r.action.padEnd(10)} │ ${(r.category || '-').padEnd(14)} │ ${(r.title || '').substring(0, 55)}${saveTag}`);
  }
  console.log(`  │`);
  console.log(`  │  TIME EFFICIENCY:`);
  const engagedTime = engagedArticles.reduce((s,i) => s+i.dwell, 0) + deepReads.reduce((s,i) => s+i.dwell, 0);
  // Avoid double counting - deepReads are a subset of engaged for DEEP_READ
  const relevantTime = allInteractions.filter(i => i.signal === 'ENGAGE').reduce((s,i) => s+i.dwell, 0);
  const wastedTime = totalTimeInApp - relevantTime;
  console.log(`  │    Time on relevant content:   ${formatDwell(relevantTime)} (${totalTimeInApp > 0 ? ((relevantTime / totalTimeInApp) * 100).toFixed(0) : 0}%)`);
  console.log(`  │    Time wasted (skip/glance):  ${formatDwell(wastedTime)} (${totalTimeInApp > 0 ? ((wastedTime / totalTimeInApp) * 100).toFixed(0) : 0}%)`);
  console.log(`  └${'─'.repeat(108)}`);

  // Overall verdict
  const avgSatisfaction = sessions.reduce((s, sess) => s + sess.finalSatisfaction, 0) / sessions.length;
  const avgEngRate = sessions.reduce((s, sess) => s + sess.stats.engRate, 0) / sessions.length;
  const totalSaved = sessions.reduce((s, sess) => s + sess.stats.saved, 0);

  // Adaptation
  const firstEng = sessions[0]?.stats.engRate || 0;
  const lastEng = sessions[sessions.length - 1]?.stats.engRate || 0;
  const delta = ((lastEng - firstEng) * 100).toFixed(1);
  const adaptArrow = parseFloat(delta) > 0 ? `↑${delta}pp` : parseFloat(delta) < 0 ? `↓${Math.abs(parseFloat(delta))}pp` : '→ no change';

  console.log(`\n  OVERALL VERDICT:`);
  console.log(`  ${generateReturnVerdict(avgSatisfaction)}`);
  console.log(`  Avg satisfaction: ${avgSatisfaction.toFixed(0)}/100 │ Avg engagement: ${(avgEngRate * 100).toFixed(1)}% │ Saved: ${totalSaved} │ Adaptation: ${adaptArrow}`);
}

// ============================================================================
// GRAND REPORT
// ============================================================================

function printGrandReport(allResults) {
  const THICK = '━'.repeat(90);
  console.log(`\n\n${THICK}`);
  console.log('  GRAND ENTERTAINMENT REPORT — 20 PERSONAS');
  console.log(THICK);

  const ranked = allResults.map(r => {
    const avgSat = r.sessions.reduce((s, sess) => s + sess.finalSatisfaction, 0) / r.sessions.length;
    const avgEng = r.sessions.reduce((s, sess) => s + sess.stats.engRate, 0) / r.sessions.length;
    const avgDwell = r.sessions.reduce((s, sess) => s + sess.stats.avgDwell, 0) / r.sessions.length;
    const totalSaved = r.sessions.reduce((s, sess) => s + sess.stats.saved, 0);
    const frustrations = r.sessions.filter(s => s.exitType === 'frustrated').length;
    const firstEng = r.sessions[0]?.stats.engRate || 0;
    const lastEng = r.sessions[r.sessions.length - 1]?.stats.engRate || 0;
    return { ...r, avgSat, avgEng, avgDwell, totalSaved, frustrations, adaptation: lastEng - firstEng };
  }).sort((a, b) => b.avgSat - a.avgSat);

  // Satisfaction ranking
  console.log('\n  SATISFACTION RANKING (who enjoys the app most → least):');
  console.log('  ' + '#'.padEnd(4) + 'Name'.padEnd(12) + 'Satisfaction'.padStart(14) + 'Engagement'.padStart(12) + 'Dwell'.padStart(8) + 'Saved'.padStart(7) + 'Exits'.padStart(8) + '  Verdict');
  console.log('  ' + '─'.repeat(85));

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const verdict = r.avgSat >= 65 ? 'Happy user' : r.avgSat >= 50 ? 'Decent' : r.avgSat >= 38 ? 'At risk' : 'Will churn';
    const exitStr = r.frustrations > 0 ? `${r.frustrations} rage` : 'clean';
    console.log('  ' +
      `${i + 1}.`.padEnd(4) +
      r.persona.padEnd(12) +
      `${r.avgSat.toFixed(0)}/100 ${moodEmoji(r.avgSat)}`.padStart(14) +
      `${(r.avgEng * 100).toFixed(1)}%`.padStart(12) +
      `${r.avgDwell.toFixed(1)}s`.padStart(8) +
      String(r.totalSaved).padStart(7) +
      exitStr.padStart(8) +
      `  ${verdict}`
    );
  }

  // Overall stats
  const avgSat = ranked.reduce((s, r) => s + r.avgSat, 0) / ranked.length;
  const avgEng = ranked.reduce((s, r) => s + r.avgEng, 0) / ranked.length;
  console.log('  ' + '─'.repeat(85));
  console.log('  ' + 'AVG'.padEnd(4) + ''.padEnd(12) + `${avgSat.toFixed(0)}/100`.padStart(14) + `${(avgEng * 100).toFixed(1)}%`.padStart(12));

  // Who will return?
  console.log('\n  RETENTION FORECAST:');
  const willReturn = ranked.filter(r => r.avgSat >= 55).length;
  const atRisk = ranked.filter(r => r.avgSat >= 35 && r.avgSat < 55).length;
  const willChurn = ranked.filter(r => r.avgSat < 35).length;
  console.log(`    Will return:  ${willReturn}/${ranked.length} personas`);
  console.log(`    At risk:      ${atRisk}/${ranked.length} personas`);
  console.log(`    Will churn:   ${willChurn}/${ranked.length} personas`);

  // Feed adaptation
  console.log('\n  FEED ADAPTATION (does the algorithm learn?):');
  const improved = ranked.filter(r => r.adaptation > 0.03);
  const declined = ranked.filter(r => r.adaptation < -0.03);
  const stable = ranked.filter(r => Math.abs(r.adaptation) <= 0.03);
  console.log(`    Improved:  ${improved.length} — ${improved.map(r => `${r.persona}(+${(r.adaptation*100).toFixed(0)}pp)`).join(', ') || 'none'}`);
  console.log(`    Stable:    ${stable.length} — ${stable.map(r => r.persona).join(', ') || 'none'}`);
  console.log(`    Declined:  ${declined.length} — ${declined.map(r => `${r.persona}(${(r.adaptation*100).toFixed(0)}pp)`).join(', ') || 'none'}`);

  // Frustrated personas — what went wrong
  const frustrated = ranked.filter(r => r.frustrations > 0 || r.avgSat < 38);
  if (frustrated.length > 0) {
    console.log('\n  PROBLEM AREAS (frustrated users — what went wrong):');
    for (const r of frustrated) {
      const p = PERSONAS.find(p => p.name === r.persona);
      const worstSession = r.sessions.sort((a, b) => a.finalSatisfaction - b.finalSatisfaction)[0];
      console.log(`    ${r.persona} (${p.age}, ${p.location}):`);
      console.log(`      Wanted: ${p.followedTopics.join(', ')}`);
      console.log(`      Problem: ${worstSession.exitReason}`);
    }
  }

  // Happy personas — what worked
  const happy = ranked.filter(r => r.avgSat >= 60);
  if (happy.length > 0) {
    console.log('\n  SUCCESS STORIES (happy users — what worked):');
    for (const r of happy) {
      const bestSession = r.sessions.sort((a, b) => b.finalSatisfaction - a.finalSatisfaction)[0];
      console.log(`    ${r.persona}: ${bestSession.exitReason}`);
    }
  }

  // ── GRAND DWELL TIME ANALYSIS ──
  console.log(`\n${THICK}`);
  console.log('  GRAND DWELL TIME ANALYSIS');
  console.log(THICK);

  const allInteractions = allResults.flatMap(r => r.sessions.flatMap(s => s.interactions));
  const totalArticlesSeen = allInteractions.length;
  const totalTimeAll = allInteractions.reduce((s, i) => s + i.dwell, 0);

  // Per-persona dwell summary table
  console.log('\n  PER-PERSONA DWELL SUMMARY:');
  console.log('  ' + 'Name'.padEnd(12) + 'Articles'.padStart(9) + 'Total Time'.padStart(12) + 'Avg Dwell'.padStart(11) + 'Deep Reads'.padStart(12) + 'Avg Deep'.padStart(10) + 'Skips'.padStart(7) + 'Avg Skip'.padStart(10) + 'Time Wasted'.padStart(13) + ' Longest Read');
  console.log('  ' + '─'.repeat(110));

  for (const r of ranked) {
    const ints = r.sessions.flatMap(s => s.interactions);
    const total = ints.reduce((s, i) => s + i.dwell, 0);
    const deepReads = ints.filter(i => i.action === 'DEEP_READ');
    const skips = ints.filter(i => i.signal === 'SKIP');
    const engaged = ints.filter(i => i.signal === 'ENGAGE');
    const wastedTime = total - engaged.reduce((s, i) => s + i.dwell, 0);
    const longest = ints.reduce((best, i) => i.dwell > best.dwell ? i : best, { dwell: 0, title: '-' });

    console.log('  ' +
      r.persona.padEnd(12) +
      String(ints.length).padStart(9) +
      formatDwell(total).padStart(12) +
      formatDwell(total / (ints.length || 1)).padStart(11) +
      String(deepReads.length).padStart(12) +
      formatDwell(deepReads.length > 0 ? deepReads.reduce((s,i) => s+i.dwell, 0) / deepReads.length : 0).padStart(10) +
      String(skips.length).padStart(7) +
      formatDwell(skips.length > 0 ? skips.reduce((s,i) => s+i.dwell, 0) / skips.length : 0).padStart(10) +
      (`${((wastedTime / total) * 100).toFixed(0)}%`).padStart(13) +
      ` ${formatDwell(longest.dwell)} (${(longest.title || '').substring(0, 30)})`
    );
  }

  // Global dwell by category
  console.log('\n  DWELL BY CATEGORY (all personas combined):');
  const globalCatDwell = {};
  const globalCatCount = {};
  const globalCatEngaged = {};
  const globalCatSkipped = {};
  for (const i of allInteractions) {
    const cat = i.category || 'Unknown';
    globalCatDwell[cat] = (globalCatDwell[cat] || 0) + i.dwell;
    globalCatCount[cat] = (globalCatCount[cat] || 0) + 1;
    if (i.signal === 'ENGAGE') globalCatEngaged[cat] = (globalCatEngaged[cat] || 0) + 1;
    if (i.signal === 'SKIP') globalCatSkipped[cat] = (globalCatSkipped[cat] || 0) + 1;
  }
  const globalCatRanked = Object.entries(globalCatDwell).sort((a, b) => b[1] - a[1]);
  console.log('  ' + 'Category'.padEnd(16) + 'Total Dwell'.padStart(12) + 'Articles'.padStart(10) + 'Avg Dwell'.padStart(11) + 'Engaged'.padStart(9) + 'Skipped'.padStart(9) + 'Eng Rate'.padStart(10) + '  Bar');
  console.log('  ' + '─'.repeat(95));
  for (const [cat, dwell] of globalCatRanked) {
    const count = globalCatCount[cat];
    const eng = globalCatEngaged[cat] || 0;
    const skip = globalCatSkipped[cat] || 0;
    const engRate = count > 0 ? ((eng / count) * 100).toFixed(0) : '0';
    const pct = ((dwell / totalTimeAll) * 100).toFixed(0);
    const bar = '█'.repeat(Math.max(1, Math.round(parseFloat(pct) / 2)));
    console.log('  ' +
      cat.padEnd(16) +
      formatDwell(dwell).padStart(12) +
      String(count).padStart(10) +
      formatDwell(dwell / count).padStart(11) +
      String(eng).padStart(9) +
      String(skip).padStart(9) +
      (`${engRate}%`).padStart(10) +
      `  ${bar}`
    );
  }

  // Dwell distribution
  console.log('\n  DWELL TIME DISTRIBUTION (all articles):');
  const buckets = [
    { label: '< 0.5s (instant skip)', min: 0, max: 0.5 },
    { label: '0.5-1s (quick skip)', min: 0.5, max: 1 },
    { label: '1-3s (scan/glance)', min: 1, max: 3 },
    { label: '3-8s (engaged read)', min: 3, max: 8 },
    { label: '8-15s (deep read)', min: 8, max: 15 },
    { label: '15-30s (very deep)', min: 15, max: 30 },
    { label: '30s+ (absorbed)', min: 30, max: Infinity },
  ];
  for (const b of buckets) {
    const inBucket = allInteractions.filter(i => i.dwell >= b.min && i.dwell < b.max);
    const pct = ((inBucket.length / totalArticlesSeen) * 100).toFixed(0);
    const bar = '█'.repeat(Math.max(0, Math.round(parseFloat(pct) / 2)));
    console.log(`    ${b.label.padEnd(25)} ${String(inBucket.length).padStart(5)} (${pct.padStart(3)}%) ${bar}`);
  }

  // Top 10 most-read articles across all personas
  console.log('\n  TOP 10 LONGEST-READ ARTICLES (across all personas):');
  const topGlobal = [...allInteractions].sort((a, b) => b.dwell - a.dwell).slice(0, 10);
  for (let i = 0; i < topGlobal.length; i++) {
    const r = topGlobal[i];
    const personaName = allResults.find(res => res.sessions.some(s => s.interactions.includes(r)))?.persona || '?';
    console.log(`    ${i+1}.  ${formatDwell(r.dwell).padStart(7)} │ ${personaName.padEnd(10)} │ ${r.action.padEnd(10)} │ ${(r.category || '-').padEnd(14)} │ ${(r.title || '').substring(0, 50)}${r.save ? ' 💾' : ''}`);
  }

  // Final verdict
  console.log(`\n${THICK}`);
  console.log('  FINAL VERDICT');
  console.log(THICK);
  console.log(`  Overall satisfaction: ${avgSat.toFixed(0)}/100`);
  console.log(`  Overall engagement: ${(avgEng * 100).toFixed(1)}%`);
  console.log(`  Total articles seen: ${totalArticlesSeen}`);
  console.log(`  Total time in app: ${formatDwell(totalTimeAll)} across all personas`);
  console.log(`  Avg dwell per article: ${formatDwell(totalTimeAll / (totalArticlesSeen || 1))}`);
  console.log(`  Retention forecast: ${willReturn}/${ranked.length} users would return`);

  if (avgSat >= 65) console.log('\n  Strong product. Most users find relevant content and would return.');
  else if (avgSat >= 50) console.log('\n  Decent but not sticky. Users find some value but personalization needs work.');
  else if (avgSat >= 38) console.log('\n  Below average. Too many users see irrelevant content. Retention will be poor.');
  else console.log('\n  Serious problems. The feed is not matching content to user interests. Most users would not return.');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  20-PERSONA FEED EXPERIENCE SIMULATOR (V2 — REALISTIC)                            ║');
  console.log('║  Last 12h articles only │ Neutral mood │ Real user behavior                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Sessions per persona: ${SESSIONS_PER_PERSONA} | API: ${API_BASE}\n`);

  // Phase 1: Setup
  console.log('PHASE 1: Setting up 20 test personas...');
  const personaSetups = [];
  for (const persona of PERSONAS) {
    process.stdout.write(`  ${persona.name}...`);
    const setup = await setupPersona(persona);
    if (setup) { personaSetups.push({ persona, ...setup }); console.log(` OK`); }
    else console.log(' FAILED');
  }
  console.log(`\n  ${personaSetups.length}/${PERSONAS.length} ready.\n`);
  if (personaSetups.length === 0) { console.error('No personas set up.'); process.exit(1); }

  // Phase 2: Simulate
  console.log('PHASE 2: Running simulations...\n');
  const allResults = [];

  for (const { persona, userId, accessToken } of personaSetups) {
    const sessions = [];
    for (let s = 1; s <= SESSIONS_PER_PERSONA; s++) {
      process.stdout.write(`  ${persona.name} session ${s}/${SESSIONS_PER_PERSONA}...`);
      const session = await simulateSession(persona, userId, accessToken, s);
      sessions.push(session);
      const icon = session.exitType === 'frustrated' ? '💢' : session.exitType === 'bored' ? '😴' : '✓';
      console.log(` ${icon} ${session.stats.total} articles, ${(session.stats.engRate * 100).toFixed(0)}% eng, mood ${session.finalSatisfaction}`);
      if (s < SESSIONS_PER_PERSONA) await sleep(DELAY_BETWEEN_SESSIONS_MS);
    }
    allResults.push({ persona: persona.name, sessions });

    // Print narrative for this persona
    printPersonaReport(persona, sessions);
  }

  // Phase 3: Grand report
  printGrandReport(allResults);

  // Save results
  const exportData = allResults.map(r => ({
    persona: r.persona,
    sessions: r.sessions.map(s => ({
      sessionNum: s.sessionNum, exitType: s.exitType, exitReason: s.exitReason,
      finalSatisfaction: s.finalSatisfaction, stats: s.stats,
      interactions: s.interactions,
    })),
  }));
  fs.writeFileSync('test_20persona_results.json', JSON.stringify(exportData, null, 2));
  console.log('\nResults saved to test_20persona_results.json');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

import { createClient } from '@supabase/supabase-js';
import https from 'https';

// ============================================================================
// 20-PERSONA FRESH READ TEST
// Each persona starts with ZERO history, reads ALL 24h articles,
// then checks the Explore page to see if topics are relevant.
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const DELAY_BETWEEN_EVENTS_MS = 60;
const DELAY_BETWEEN_PAGES_MS = 300;

// ============================================================================
// SUBTOPIC MAP — matches ONBOARDING_TOPIC_MAP in pages/api/feed/main.js
// ============================================================================

const SUBTOPIC_MAP = {
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'troops', 'missile', 'strike', 'ceasefire', 'nato', 'pentagon', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'supreme court', 'governor', 'election', 'legislation'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'macron', 'scholz', 'starmer', 'germany', 'france', 'uk politics'] },
  'Asian Politics':              { categories: ['Politics'], tags: ['asian politics', 'china', 'india', 'japan', 'taiwan', 'north korea', 'south korea', 'asean', 'modi', 'xi jinping', 'southeast asia'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gaza', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz', 'gulf'] },
  'Latin America':               { categories: ['Politics'], tags: ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba', 'south america'] },
  'Africa & Oceania':            { categories: ['Politics'], tags: ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes', 'refugee', 'asylum'] },
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'nfl draft'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'playoffs', 'nba draft'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup', 'transfer'] },
  'MLB/Baseball':                { categories: ['Sports'], tags: ['mlb', 'baseball', 'world series', 'home run', 'pitcher'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout', 'wrestling'] },
  'Olympics & Paralympics':      { categories: ['Sports'], tags: ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc'] },
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'nuclear energy'] },
  'Automotive':                  { categories: ['Business'], tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Corporate Deals':             { categories: ['Business'], tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars', 'academy award'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce', 'spotify'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam', 'game'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'star', 'billionaire', 'royal'] },
  'K-Pop & K-Drama':             { categories: ['Entertainment'], tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'] },
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm', 'gpt', 'claude', 'anthropic', 'google ai'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Social Media':                { categories: ['Tech'], tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor', 'gpu'] },
  'Space & Astronomy':           { categories: ['Science'], tags: ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet', 'star'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Earth Science':               { categories: ['Science'], tags: ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'] },
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery', 'drug'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'fda', 'medication', 'biotech', 'drug approval'] },
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading', 'stocks'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },
  'Bitcoin':                     { categories: ['Finance', 'Crypto', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving', 'crypto'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Crypto', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized', 'ethereum'] },
  'Crypto Regulation & Legal':   { categories: ['Finance', 'Crypto', 'Tech'], tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'] },
  'Pets & Animals':              { categories: ['Lifestyle'], tags: ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'] },
  'Home & Garden':               { categories: ['Lifestyle'], tags: ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
};

// ============================================================================
// 20 PERSONAS
// ============================================================================

const PERSONAS = [
  {
    name: 'Lena', age: 32, location: 'San Francisco, CA',
    bio: 'AI research lead at a robotics startup. Follows OpenAI/Anthropic race closely.',
    email: 'persona_lena@tennews.test',
    homeCountry: 'usa',
    subtopics: ['AI & Machine Learning', 'Space Tech', 'Gaming', 'Robotics & Hardware'],
    curiosityKeywords: ['bizarre', 'discovered', 'ancient', 'extinct', 'record-breaking', 'billion', 'breakthrough'],
    annoyanceKeywords: ['ai will replace', 'robots taking jobs', 'alarming'],
    headlineTriggers: ['first ever', 'no one expected', 'scientists shocked', 'elon musk'],
  },
  {
    name: 'Marco', age: 35, location: 'Milan, Italy',
    bio: 'Sports editor. Die-hard AC Milan fan. Follows F1 and UFC.',
    email: 'persona_marco@tennews.test',
    homeCountry: 'italy',
    subtopics: ['Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC'],
    curiosityKeywords: ['athlete', 'injury', 'salary', 'deal', 'scandal', 'record', 'fastest', 'million'],
    annoyanceKeywords: ['congress', 'legislation', 'policy', 'sanctions'],
    headlineTriggers: ['transfer', 'fired', 'champion', 'upset', 'shocking defeat'],
  },
  {
    name: 'Nadia', age: 48, location: 'Berlin, Germany',
    bio: 'International relations professor. NATO and Middle East specialist.',
    email: 'persona_nadia@tennews.test',
    homeCountry: 'germany',
    subtopics: ['War & Conflict', 'Middle East', 'European Politics', 'Human Rights & Civil Liberties'],
    curiosityKeywords: ['regulation', 'sanctions', 'climate summit', 'nuclear', 'treaty', 'exodus', 'displaced'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'gaming'],
    headlineTriggers: ['unprecedented', 'historic', 'classified', 'leaked'],
  },
  {
    name: 'Ryan', age: 38, location: 'New York, NY',
    bio: 'Quant fund portfolio manager. Trades S&P futures and tech stocks.',
    email: 'persona_ryan@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Stock Markets', 'Corporate Earnings', 'Startups & Venture Capital', 'AI & Machine Learning'],
    curiosityKeywords: ['oil price', 'fed', 'crash', 'surge', 'billion', 'ipo', 'sec', 'yankees', 'market crash'],
    annoyanceKeywords: ['wellness', 'mindfulness', 'self-care', 'horoscope'],
    headlineTriggers: ['plunges', 'surges', 'record high', 'crashes', 'bankruptcy'],
  },
  {
    name: 'Elif', age: 29, location: 'Istanbul, Turkey',
    bio: 'Product designer at a fintech startup. Galatasaray fan.',
    email: 'persona_elif@tennews.test',
    homeCountry: 'turkiye',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Trade & Tariffs', 'Middle East'],
    curiosityKeywords: ['design', 'women in tech', 'founder', 'turkish', 'istanbul', 'lira', 'earthquake'],
    annoyanceKeywords: ['death toll unchanged', 'no new developments', 'sources say'],
    headlineTriggers: ['galatasaray', 'turkey', 'turkish', 'istanbul', 'women founder'],
  },
  {
    name: 'Sophie', age: 27, location: 'Lyon, France',
    bio: 'Medical resident in oncology. Follows biotech and Ligue 1.',
    email: 'persona_sophie@tennews.test',
    homeCountry: 'france',
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature', 'Soccer/Football'],
    curiosityKeywords: ['ai in medicine', 'diagnosis', 'patient', 'hospital', 'france', 'lyon', 'restaurant', 'chef', 'humanitarian'],
    annoyanceKeywords: ['crypto', 'nft', 'meme coin', 'influencer'],
    headlineTriggers: ['cure', 'first patient', 'clinical trial', 'mbappe', 'lyon'],
  },
  {
    name: 'Thomas', age: 40, location: 'Amsterdam, Netherlands',
    bio: 'Climate journalist. Covers COP summits and EU Green Deal.',
    email: 'persona_thomas@tennews.test',
    homeCountry: 'netherlands',
    subtopics: ['Climate & Environment', 'European Politics', 'Oil & Energy'],
    curiosityKeywords: ['ev', 'electric', 'solar', 'wind', 'battery', 'pollution', 'ocean', 'flooding', 'amsterdam', 'dutch', 'netherlands'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'celebrity', 'kardashian'],
    headlineTriggers: ['record temperature', 'flooding', 'wildfire', 'ajax', 'netherlands'],
  },
  {
    name: 'Ayse', age: 34, location: 'Ankara, Turkey',
    bio: 'SaaS startup founder. Follows AI tooling and Turkish-EU trade.',
    email: 'persona_ayse@tennews.test',
    homeCountry: 'turkiye',
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Trade & Tariffs', 'Middle East'],
    curiosityKeywords: ['women founder', 'remote work', 'saas', 'productivity', 'turkey', 'ankara', 'besiktas', 'space'],
    annoyanceKeywords: ['death toll', 'massacre', 'graphic', 'celebrity divorce'],
    headlineTriggers: ['billion valuation', 'acquired', 'unicorn', 'besiktas', 'turkey'],
  },
  {
    name: 'Mike', age: 58, location: 'Dallas, TX',
    bio: 'Retired Army colonel, military analyst. Cowboys fan. Follows F1.',
    email: 'persona_mike@tennews.test',
    homeCountry: 'usa',
    subtopics: ['NFL', 'US Politics', 'War & Conflict', 'F1 & Motorsport'],
    curiosityKeywords: ['military tech', 'drone', 'veteran', 'defense contractor', 'lockheed', 'boeing', 'navy', 'air force', 'texas', 'dallas'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'fashion week'],
    headlineTriggers: ['cowboys', 'pentagon', 'troops', 'general', 'classified', 'verstappen'],
  },
  {
    name: 'Zara', age: 20, location: 'London, UK',
    bio: 'UCL sociology student. Into sustainable fashion and mental health. Arsenal fan.',
    email: 'persona_zara@tennews.test',
    homeCountry: 'uk',
    subtopics: ['Climate & Environment', 'Mental Health', 'Soccer/Football', 'Celebrity Style & Red Carpet'],
    curiosityKeywords: ['london', 'uk', 'student', 'gen z', 'tiktok', 'viral', 'animal', 'rescue', 'billionaire', 'protest', 'affordable'],
    annoyanceKeywords: ['quarterly results', 'earnings', 'commodity', 'tariff', 'fed rate'],
    headlineTriggers: ['arsenal', 'saka', 'london', 'shocking', 'viral', 'gen z'],
  },
  {
    name: 'Robert', age: 68, location: 'Tampa, FL',
    bio: 'Retired school principal. Buccaneers fan. Follows gold prices.',
    email: 'persona_robert@tennews.test',
    homeCountry: 'usa',
    subtopics: ['US Politics', 'Public Health', 'Commodities', 'NFL'],
    curiosityKeywords: ['hurricane', 'florida', 'tampa', 'education', 'school', 'teacher', 'veteran', 'retirement', 'social security', 'weather'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'nft', 'metaverse', 'k-pop'],
    headlineTriggers: ['florida', 'tampa', 'buccaneers', 'gold price', 'social security'],
  },
  {
    name: 'Devon', age: 21, location: 'Austin, TX',
    bio: 'UT Austin senior. NFL Draft + NBA playoffs obsessed. Competitive CoD player.',
    email: 'persona_devon@tennews.test',
    homeCountry: 'usa',
    subtopics: ['NFL', 'NBA', 'Boxing & MMA/UFC', 'Gaming', 'Sneakers & Streetwear'],
    curiosityKeywords: ['viral', 'insane', 'crazy', 'elon', 'tesla', 'million dollar', 'world record', 'arrest'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'quarterly', 'fiscal', 'summit'],
    headlineTriggers: ['eagles', 'mavericks', 'luka', 'ufc', 'jordan', 'nike', 'world record'],
  },
  {
    name: 'Camille', age: 33, location: 'Paris, France',
    bio: 'Creative director at Balenciaga. Lives for fashion week. PSG fan.',
    email: 'persona_camille@tennews.test',
    homeCountry: 'france',
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Shopping & Product Reviews', 'Soccer/Football'],
    curiosityKeywords: ['luxury', 'lvmh', 'kering', 'gucci', 'paris', 'france', 'design', 'architecture', 'museum', 'art', 'creative ai'],
    annoyanceKeywords: ['missile', 'troops', 'death toll', 'bitcoin', 'mining'],
    headlineTriggers: ['paris', 'psg', 'fashion', 'cannes', 'balenciaga', 'french'],
  },
  {
    name: 'Diego', age: 26, location: 'Miami, FL',
    bio: 'Crypto analyst at a DeFi fund. Real Madrid fan.',
    email: 'persona_diego@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Stock Markets', 'Cybersecurity'],
    curiosityKeywords: ['real madrid', 'champions league', 'miami', 'latin america', 'ai trading', 'algorithm', 'whale', 'vinicius'],
    annoyanceKeywords: ['wellness', 'meditation', 'yoga', 'recipe', 'garden'],
    headlineTriggers: ['real madrid', 'sec', 'hack', 'exploit', 'crash', 'billion'],
  },
  {
    name: 'Jennifer', age: 39, location: 'Toronto, Canada',
    bio: 'Science teacher and mom. Raptors fan. Follows climate + nature.',
    email: 'persona_jennifer@tennews.test',
    homeCountry: 'canada',
    subtopics: ['Public Health', 'Climate & Environment', 'Biology & Nature', 'NBA'],
    curiosityKeywords: ['canada', 'toronto', 'education', 'school', 'parent', 'children', 'iphone', 'apple', 'kid safety', 'food safety'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'hedge fund', 'derivatives'],
    headlineTriggers: ['raptors', 'toronto', 'canada', 'teacher', 'parent', 'apple'],
  },
  {
    name: 'Lars', age: 23, location: 'Stockholm, Sweden',
    bio: 'Semi-pro Counter-Strike player. Follows gaming hardware launches.',
    email: 'persona_lars@tennews.test',
    homeCountry: 'sweden',
    subtopics: ['Gaming', 'AI & Machine Learning', 'Smartphones & Gadgets', 'Robotics & Hardware'],
    curiosityKeywords: ['sweden', 'stockholm', 'space', 'mars', 'rocket', 'nasa', 'viral', 'twitch', 'youtube', 'streamer'],
    annoyanceKeywords: ['policy', 'legislation', 'committee', 'fiscal', 'tariff', 'trade deal'],
    headlineTriggers: ['nvidia', 'steam', 'playstation', 'xbox', 'aik', 'sweden'],
  },
  {
    name: 'Henrik', age: 52, location: 'Geneva, Switzerland',
    bio: 'Former diplomat, now at Geneva Centre for Security Policy.',
    email: 'persona_henrik@tennews.test',
    homeCountry: 'switzerland',
    subtopics: ['European Politics', 'Human Rights & Civil Liberties', 'Trade & Tariffs', 'Banking & Lending'],
    curiosityKeywords: ['switzerland', 'swiss', 'sweden', 'scandinavia', 'geneva', 'diplomat', 'ambassador', 'un', 'imf', 'world bank'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'sneakers', 'k-pop'],
    headlineTriggers: ['eu', 'nato', 'sanctions', 'historic', 'swiss', 'young boys'],
  },
  {
    name: 'Amara', age: 34, location: 'Montreal, Canada',
    bio: 'ER nurse at McGill. Follows pharma industry and NHL.',
    email: 'persona_amara@tennews.test',
    homeCountry: 'canada',
    subtopics: ['Medical Breakthroughs', 'Biology & Nature', 'Mental Health', 'Pharma & Drug Industry'],
    curiosityKeywords: ['canada', 'montreal', 'nurse', 'hospital', 'humanitarian', 'civilian', 'children killed', 'famine', 'ai diagnosis'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'stock market', 'earnings call'],
    headlineTriggers: ['canadiens', 'montreal', 'nurse', 'hospital', 'patient', 'first cure'],
  },
  {
    name: 'Antonio', age: 43, location: 'Barcelona, Spain',
    bio: 'Restaurant chain owner. Lifelong FC Barcelona soci.',
    email: 'persona_antonio@tennews.test',
    homeCountry: 'spain',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Retail & Consumer', 'Real Estate'],
    curiosityKeywords: ['barcelona', 'spain', 'spanish', 'restaurant', 'food', 'tourism', 'hotel', 'oil price', 'inflation', 'cost of living'],
    annoyanceKeywords: ['algorithm', 'blockchain', 'defi', 'neural network', 'prompt engineering'],
    headlineTriggers: ['barcelona', 'barca', 'la liga', 'spain', 'lamine yamal', 'messi'],
  },
  {
    name: 'Fatima', age: 24, location: 'Washington DC',
    bio: 'Georgetown law student. ACLU intern. Man City fan.',
    email: 'persona_fatima@tennews.test',
    homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Middle East', 'Public Health'],
    curiosityKeywords: ['privacy', 'surveillance', 'immigration', 'border', 'education', 'student debt', 'man city', 'haaland', 'justice'],
    annoyanceKeywords: ['earnings', 'quarterly', 'ipo', 'stock price', 'revenue'],
    headlineTriggers: ['supreme court', 'aclu', 'man city', 'haaland', 'civil rights', 'unconstitutional'],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getArticleTags(article) {
  const raw = article.interestTags || article.interest_tags || article.topics || [];
  return (Array.isArray(raw) ? raw : []).map(t => String(t).toLowerCase());
}

function buildPersonaProfile(persona) {
  const allTags = [];
  const allCategories = new Set();
  const subtopicKeywords = {};
  for (const st of persona.subtopics) {
    const def = SUBTOPIC_MAP[st];
    if (!def) continue;
    subtopicKeywords[st] = def.tags;
    allTags.push(...def.tags);
    def.categories.forEach(c => allCategories.add(c));
  }
  return { allTags, allCategories: [...allCategories], subtopicKeywords };
}

function matchArticleToSubtopics(article, profile) {
  const tags = getArticleTags(article);
  const title = (article.title || article.title_news || '').toLowerCase();
  const category = (article.category || '').trim();
  const combined = [...tags, ...title.split(/\s+/)].join(' ').toLowerCase();
  const matched = [];
  for (const [name, keywords] of Object.entries(profile.subtopicKeywords)) {
    const hit = keywords.some(kw => combined.includes(kw));
    const catHit = SUBTOPIC_MAP[name].categories.includes(category);
    if (hit || catHit) matched.push(name);
  }
  return matched;
}

// ============================================================================
// BEHAVIOR — Decide if persona engages with an article
// ============================================================================

function decideEngagement(persona, article, profile) {
  const tags = getArticleTags(article);
  const title = (article.title || article.title_news || '').toLowerCase();
  const category = (article.category || '').trim();
  const combined = [...tags, ...title.split(/\s+/)].join(' ').toLowerCase();
  const matchedSubtopics = matchArticleToSubtopics(article, profile);

  let score = 0;

  // Subtopic match
  if (matchedSubtopics.length >= 2) score += 0.5;
  else if (matchedSubtopics.length === 1) score += 0.3;

  // Direct keyword hits
  let kwHits = 0;
  for (const kw of profile.allTags) {
    if (combined.includes(kw)) kwHits++;
  }
  score += Math.min(0.3, kwHits * 0.05);

  // Category match
  if (profile.allCategories.includes(category)) score += 0.15;

  // No match penalty
  if (matchedSubtopics.length === 0 && !profile.allCategories.includes(category)) score -= 0.2;

  // Curiosity
  if (persona.curiosityKeywords && matchedSubtopics.length === 0) {
    const hits = persona.curiosityKeywords.filter(kw => combined.includes(kw)).length;
    if (hits >= 2) score += 0.3;
    else if (hits === 1) score += 0.18;
  }

  // Annoyance
  if (persona.annoyanceKeywords) {
    const hits = persona.annoyanceKeywords.filter(kw => combined.includes(kw)).length;
    if (hits >= 2) score -= 0.3;
    else if (hits === 1) score -= 0.18;
  }

  // Headline triggers
  if (persona.headlineTriggers) {
    const hits = persona.headlineTriggers.filter(kw => title.includes(kw)).length;
    if (hits >= 2) score += 0.35;
    else if (hits === 1) score += 0.2;
  }

  // Quality boost
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += 0.1;
  else if (aiScore >= 800) score += 0.05;

  // Breaking
  if (/breaking|just in|exclusive/i.test(title)) score += 0.08;

  // Random variance
  score += (Math.random() - 0.5) * 0.12;

  // Determine action
  if (score >= 0.5) {
    const dwell = 8 + Math.random() * 20;
    return { action: 'ENGAGE', dwell, events: ['article_detail_view', 'article_engaged'], matchedSubtopics, score };
  }
  if (score >= 0.2) {
    const dwell = 3 + Math.random() * 6;
    return { action: 'GLANCE', dwell, events: ['article_detail_view', 'article_exit'], matchedSubtopics, score };
  }
  if (score >= -0.05) {
    return { action: 'SCAN', dwell: 1 + Math.random() * 2, events: ['article_view'], matchedSubtopics, score };
  }
  return { action: 'SKIP', dwell: 0.3 + Math.random() * 0.7, events: ['article_skipped'], matchedSubtopics, score };
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
  let url = `${API_BASE}/api/feed/main?limit=${params.limit || 30}&user_id=${encodeURIComponent(userId)}`;
  if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
  if (params.engagedIds?.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
  if (params.skippedIds?.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
  if (params.seenIds?.length) url += '&seen_ids=' + params.seenIds.slice(-500).join(',');
  return httpGet(url);
}

async function fetchExplorePage(userId) {
  return httpGet(`${API_BASE}/api/explore/topics?user_id=${encodeURIComponent(userId)}`);
}

async function trackEvent(accessToken, eventData) {
  return httpPost(`${API_BASE}/api/analytics/track`, eventData, { 'Authorization': `Bearer ${accessToken}` });
}

function getAccessToken(email, password) {
  const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  return c.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) return null;
    return data.session.access_token;
  });
}

// ============================================================================
// SETUP — Create user + WIPE all history
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
    if (error) { console.error(`  SETUP ERROR ${persona.name}: ${error.message}`); return null; }
    userId = data.user.id;
    await sleep(600);
  }

  // WIPE: clear all history so they start fresh
  const profileData = {
    email: persona.email, full_name: `${persona.name} (Test Persona)`,
    home_country: persona.homeCountry, followed_countries: [],
    followed_topics: persona.subtopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  };

  const { data: existingProfile } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (existingProfile) {
    await adminDb.from('profiles').update(profileData).eq('id', userId);
  } else {
    await adminDb.from('profiles').insert({ id: userId, ...profileData });
  }

  // Delete all events and interests
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  try { await adminDb.from('user_interest_clusters').delete().eq('user_id', userId); } catch {}
  try { await adminDb.from('user_interests').delete().eq('user_id', userId); } catch {}

  const accessToken = await getAccessToken(persona.email, PASSWORD);
  if (!accessToken) { console.error(`  SIGN-IN ERROR ${persona.name}`); return null; }
  return { userId, accessToken };
}

// ============================================================================
// PHASE 1: READ ALL FEED ARTICLES (24h)
// ============================================================================

async function readAllFeedArticles(persona, userId, accessToken, profile) {
  const sessionId = `fresh_${persona.name.toLowerCase()}_${Date.now()}`;
  const engagedIds = [];
  const skippedIds = [];
  const seenIds = [];
  const interactions = [];
  let cursor = null;
  let totalTracked = 0;
  let pageNum = 0;
  const maxPages = 30; // safety limit

  console.log(`    Reading feed...`);

  while (pageNum < maxPages) {
    pageNum++;
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 30, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { console.error(`    Feed error page ${pageNum}: ${e.message}`); break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    // Filter to last 24h
    const cutoff = Date.now() - 24 * 3600000;
    const freshArticles = resp.articles.filter(a => {
      const created = new Date(a.created_at || a.createdAt || 0).getTime();
      return created >= cutoff;
    });
    if (freshArticles.length === 0) break;

    for (const article of freshArticles) {
      const id = String(article.id);
      if (seenIds.includes(id)) continue; // skip duplicates
      seenIds.push(id);

      const reaction = decideEngagement(persona, article, profile);
      const title = (article.title || article.title_news || '').substring(0, 65);
      const category = (article.category || '').trim();

      // Send events to API
      for (const eventType of reaction.events) {
        const eventData = {
          event_type: eventType, article_id: parseInt(id), session_id: sessionId,
          category: category || null, source: article.source || null, metadata: {},
        };
        if (eventType === 'article_engaged') {
          eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)), engaged_seconds: Math.round(reaction.dwell), total_active_seconds: Math.round(reaction.dwell) };
        } else if (eventType === 'article_exit') {
          eventData.metadata = { total_active_seconds: Math.round(reaction.dwell) };
        } else if (eventType === 'article_detail_view') {
          eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)) };
        }
        try { await trackEvent(accessToken, eventData); totalTracked++; } catch {}
        await sleep(DELAY_BETWEEN_EVENTS_MS);
      }

      if (reaction.action === 'ENGAGE') engagedIds.push(id);
      else if (reaction.action === 'SKIP') skippedIds.push(id);

      interactions.push({
        id, title, category, action: reaction.action,
        matchedSubtopics: reaction.matchedSubtopics, score: reaction.score,
        dwell: reaction.dwell,
      });
    }

    if (!cursor) break;
    await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  // Stats
  const engaged = interactions.filter(i => i.action === 'ENGAGE');
  const skipped = interactions.filter(i => i.action === 'SKIP');
  const glanced = interactions.filter(i => i.action === 'GLANCE');
  const relevant = interactions.filter(i => i.matchedSubtopics.length > 0);

  console.log(`    Read ${interactions.length} articles | Engaged: ${engaged.length} | Glanced: ${glanced.length} | Skipped: ${skipped.length} | Relevant: ${relevant.length} | Events sent: ${totalTracked}`);

  return { interactions, engagedIds, skippedIds, seenIds };
}

// ============================================================================
// PHASE 2: CHECK EXPLORE PAGE
// ============================================================================

async function checkExplorePage(persona, userId, profile) {
  console.log(`    Checking explore page...`);

  let exploreData;
  try {
    exploreData = await fetchExplorePage(userId);
  } catch (e) {
    console.error(`    Explore page error: ${e.message}`);
    return null;
  }

  const topics = exploreData.topics || exploreData.data?.topics || [];
  if (topics.length === 0) {
    console.log(`    No explore topics returned.`);
    return { topics: [], relevantCount: 0, irrelevantCount: 0, score: 0 };
  }

  // Build persona's full interest keyword set for matching
  const personaAllKeywords = new Set([
    ...profile.allTags,
    ...(persona.curiosityKeywords || []),
    ...(persona.headlineTriggers || []),
  ]);
  const personaCategories = new Set(profile.allCategories);

  const topicResults = [];

  for (const topic of topics) {
    const entityName = (topic.entity_name || topic.name || '').toLowerCase();
    const displayTitle = (topic.display_title || topic.title || entityName).toLowerCase();
    const topicCategory = (topic.category || '').trim();
    const topicType = topic.type || 'unknown'; // 'personalized' or 'trending'
    const weight = topic.weight || 0;

    // Check relevance: does this topic match any of the persona's interests?
    let isRelevant = false;
    let matchReason = '';

    // 1. Category match
    if (personaCategories.has(topicCategory)) {
      isRelevant = true;
      matchReason = `category:${topicCategory}`;
    }

    // 2. Keyword match in entity name / display title
    const combined = `${entityName} ${displayTitle}`;
    for (const kw of personaAllKeywords) {
      if (combined.includes(kw)) {
        isRelevant = true;
        matchReason = matchReason ? `${matchReason} + kw:${kw}` : `kw:${kw}`;
        break;
      }
    }

    // 3. Subtopic match
    for (const [stName, stKeywords] of Object.entries(profile.subtopicKeywords)) {
      if (stKeywords.some(kw => combined.includes(kw))) {
        isRelevant = true;
        matchReason = matchReason ? `${matchReason} + subtopic:${stName}` : `subtopic:${stName}`;
        break;
      }
    }

    // 4. Annoyance check — if this topic matches annoyance keywords, it's BAD
    let isAnnoying = false;
    if (persona.annoyanceKeywords) {
      for (const kw of persona.annoyanceKeywords) {
        if (combined.includes(kw)) {
          isAnnoying = true;
          break;
        }
      }
    }

    const articleCount = (topic.articles || []).length;

    topicResults.push({
      entityName: topic.entity_name || entityName,
      displayTitle: topic.display_title || displayTitle,
      category: topicCategory,
      type: topicType,
      weight: weight,
      articleCount,
      isRelevant,
      isAnnoying,
      matchReason: matchReason || 'none',
    });
  }

  const relevant = topicResults.filter(t => t.isRelevant && !t.isAnnoying);
  const annoying = topicResults.filter(t => t.isAnnoying);
  const irrelevant = topicResults.filter(t => !t.isRelevant && !t.isAnnoying);
  const personalized = topicResults.filter(t => t.type === 'personalized');
  const trending = topicResults.filter(t => t.type === 'trending');

  // Score: what % of explore topics are relevant to this persona?
  const relevanceScore = topicResults.length > 0 ? (relevant.length / topicResults.length * 100) : 0;
  const personalizedRelevance = personalized.length > 0 ? (personalized.filter(t => t.isRelevant && !t.isAnnoying).length / personalized.length * 100) : 0;

  return {
    topics: topicResults,
    totalTopics: topicResults.length,
    relevantCount: relevant.length,
    irrelevantCount: irrelevant.length,
    annoyingCount: annoying.length,
    personalizedCount: personalized.length,
    trendingCount: trending.length,
    relevanceScore,
    personalizedRelevance,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const THICK = '='.repeat(100);
  console.log(THICK);
  console.log('  20-PERSONA FRESH READ TEST');
  console.log('  All personas start with ZERO history, read all 24h feed articles,');
  console.log('  then check the Explore page for topic relevance.');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(THICK);

  const allResults = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const profile = buildPersonaProfile(persona);

    console.log(`\n${'─'.repeat(100)}`);
    console.log(`  [${i + 1}/20] ${persona.name.toUpperCase()}, ${persona.age} — ${persona.bio}`);
    console.log(`  Home: ${persona.homeCountry} | Subtopics: ${persona.subtopics.join(', ')}`);
    console.log('─'.repeat(100));

    // Setup + wipe history
    console.log(`    Setting up (wiping history)...`);
    const setup = await setupPersona(persona);
    if (!setup) { console.log(`    FAILED — skipping`); continue; }
    const { userId, accessToken } = setup;
    console.log(`    Ready. User ID: ${userId.substring(0, 8)}...`);

    // PHASE 1: Read all feed articles
    const feedResult = await readAllFeedArticles(persona, userId, accessToken, profile);

    // Wait a moment for the backend to process tag profiles
    console.log(`    Waiting 3s for backend profile processing...`);
    await sleep(3000);

    // PHASE 2: Check explore page
    const exploreResult = await checkExplorePage(persona, userId, profile);

    allResults.push({ persona, profile, userId, feedResult, exploreResult });

    // Print explore summary for this persona
    if (exploreResult && exploreResult.topics.length > 0) {
      console.log(`\n    EXPLORE PAGE RESULTS:`);
      console.log(`    Total topics: ${exploreResult.totalTopics} | Personalized: ${exploreResult.personalizedCount} | Trending: ${exploreResult.trendingCount}`);
      console.log(`    Relevant: ${exploreResult.relevantCount} | Irrelevant: ${exploreResult.irrelevantCount} | Annoying: ${exploreResult.annoyingCount}`);
      console.log(`    Overall relevance: ${exploreResult.relevanceScore.toFixed(1)}% | Personalized relevance: ${exploreResult.personalizedRelevance.toFixed(1)}%`);

      // Show each topic
      console.log(`\n    ${'Type'.padEnd(14)} ${'Relevant'.padEnd(10)} ${'Category'.padEnd(14)} ${'Topic'.padEnd(40)} Match Reason`);
      console.log(`    ${'─'.repeat(95)}`);
      for (const t of exploreResult.topics) {
        const icon = t.isAnnoying ? 'ANNOYING' : t.isRelevant ? 'YES' : 'NO';
        const typeStr = t.type === 'personalized' ? 'Personalized' : 'Trending';
        console.log(`    ${typeStr.padEnd(14)} ${icon.padEnd(10)} ${(t.category || '-').padEnd(14)} ${(t.displayTitle || t.entityName).substring(0, 38).padEnd(40)} ${t.matchReason.substring(0, 50)}`);
      }
    }
  }

  // ============================================================================
  // GRAND SUMMARY
  // ============================================================================

  console.log(`\n\n${THICK}`);
  console.log('  GRAND SUMMARY — 20 PERSONAS FRESH READ TEST');
  console.log(THICK);

  // Feed reading summary
  console.log('\n  FEED READING SUMMARY:');
  console.log(`  ${'Name'.padEnd(12)} ${'Articles'.padStart(9)} ${'Engaged'.padStart(9)} ${'Glanced'.padStart(9)} ${'Skipped'.padStart(9)} ${'Relevant'.padStart(10)} ${'Eng%'.padStart(7)} ${'Relev%'.padStart(8)}`);
  console.log(`  ${'─'.repeat(80)}`);

  let totalArticlesAll = 0, totalEngagedAll = 0, totalRelevantAll = 0;

  for (const r of allResults) {
    const ints = r.feedResult.interactions;
    const engaged = ints.filter(i => i.action === 'ENGAGE').length;
    const glanced = ints.filter(i => i.action === 'GLANCE').length;
    const skipped = ints.filter(i => i.action === 'SKIP').length;
    const relevant = ints.filter(i => i.matchedSubtopics.length > 0).length;
    const engRate = ints.length > 0 ? ((engaged / ints.length) * 100).toFixed(1) : '0.0';
    const relRate = ints.length > 0 ? ((relevant / ints.length) * 100).toFixed(1) : '0.0';

    totalArticlesAll += ints.length;
    totalEngagedAll += engaged;
    totalRelevantAll += relevant;

    console.log(`  ${r.persona.name.padEnd(12)} ${String(ints.length).padStart(9)} ${String(engaged).padStart(9)} ${String(glanced).padStart(9)} ${String(skipped).padStart(9)} ${String(relevant).padStart(10)} ${(engRate + '%').padStart(7)} ${(relRate + '%').padStart(8)}`);
  }

  console.log(`  ${'─'.repeat(80)}`);
  const avgEngRate = totalArticlesAll > 0 ? ((totalEngagedAll / totalArticlesAll) * 100).toFixed(1) : '0.0';
  const avgRelRate = totalArticlesAll > 0 ? ((totalRelevantAll / totalArticlesAll) * 100).toFixed(1) : '0.0';
  console.log(`  ${'AVERAGE'.padEnd(12)} ${String(Math.round(totalArticlesAll / allResults.length)).padStart(9)} ${String(Math.round(totalEngagedAll / allResults.length)).padStart(9)} ${''.padStart(9)} ${''.padStart(9)} ${String(Math.round(totalRelevantAll / allResults.length)).padStart(10)} ${(avgEngRate + '%').padStart(7)} ${(avgRelRate + '%').padStart(8)}`);

  // Explore page summary
  console.log('\n  EXPLORE PAGE RELEVANCE:');
  console.log(`  ${'Name'.padEnd(12)} ${'Topics'.padStart(8)} ${'Personal'.padStart(10)} ${'Trending'.padStart(10)} ${'Relevant'.padStart(10)} ${'Irrelevant'.padStart(12)} ${'Annoying'.padStart(10)} ${'Relevance%'.padStart(12)} ${'Personal%'.padStart(11)}`);
  console.log(`  ${'─'.repeat(100)}`);

  let totalRelevanceScore = 0, totalPersonalizedScore = 0, exploreCount = 0;

  for (const r of allResults) {
    const e = r.exploreResult;
    if (!e) { console.log(`  ${r.persona.name.padEnd(12)} FAILED`); continue; }

    totalRelevanceScore += e.relevanceScore;
    totalPersonalizedScore += e.personalizedRelevance;
    exploreCount++;

    console.log(`  ${r.persona.name.padEnd(12)} ${String(e.totalTopics).padStart(8)} ${String(e.personalizedCount).padStart(10)} ${String(e.trendingCount).padStart(10)} ${String(e.relevantCount).padStart(10)} ${String(e.irrelevantCount).padStart(12)} ${String(e.annoyingCount).padStart(10)} ${(e.relevanceScore.toFixed(1) + '%').padStart(12)} ${(e.personalizedRelevance.toFixed(1) + '%').padStart(11)}`);
  }

  if (exploreCount > 0) {
    console.log(`  ${'─'.repeat(100)}`);
    console.log(`  ${'AVERAGE'.padEnd(12)} ${''.padStart(8)} ${''.padStart(10)} ${''.padStart(10)} ${''.padStart(10)} ${''.padStart(12)} ${''.padStart(10)} ${((totalRelevanceScore / exploreCount).toFixed(1) + '%').padStart(12)} ${((totalPersonalizedScore / exploreCount).toFixed(1) + '%').padStart(11)}`);
  }

  // Worst explore personas
  const sortedByExplore = allResults
    .filter(r => r.exploreResult)
    .sort((a, b) => a.exploreResult.relevanceScore - b.exploreResult.relevanceScore);

  if (sortedByExplore.length > 0) {
    console.log('\n  WORST EXPLORE EXPERIENCE (lowest relevance):');
    for (const r of sortedByExplore.slice(0, 5)) {
      const e = r.exploreResult;
      const irrelevantTopics = e.topics.filter(t => !t.isRelevant && !t.isAnnoying).map(t => t.displayTitle || t.entityName).slice(0, 5);
      const annoyingTopics = e.topics.filter(t => t.isAnnoying).map(t => t.displayTitle || t.entityName);
      console.log(`    ${r.persona.name} (${e.relevanceScore.toFixed(0)}%): ${e.irrelevantCount} irrelevant, ${e.annoyingCount} annoying`);
      if (irrelevantTopics.length > 0) console.log(`      Irrelevant: ${irrelevantTopics.join(', ')}`);
      if (annoyingTopics.length > 0) console.log(`      Annoying: ${annoyingTopics.join(', ')}`);
    }
  }

  // Best explore personas
  if (sortedByExplore.length > 0) {
    console.log('\n  BEST EXPLORE EXPERIENCE (highest relevance):');
    for (const r of sortedByExplore.slice(-3).reverse()) {
      const e = r.exploreResult;
      const topMatches = e.topics.filter(t => t.isRelevant).map(t => t.displayTitle || t.entityName).slice(0, 5);
      console.log(`    ${r.persona.name} (${e.relevanceScore.toFixed(0)}%): ${e.relevantCount}/${e.totalTopics} relevant`);
      if (topMatches.length > 0) console.log(`      Top matches: ${topMatches.join(', ')}`);
    }
  }

  // Overall verdict
  const avgExploreRelevance = exploreCount > 0 ? totalRelevanceScore / exploreCount : 0;
  const avgPersonalizedRelevance = exploreCount > 0 ? totalPersonalizedScore / exploreCount : 0;

  console.log(`\n  ${'='.repeat(60)}`);
  console.log(`  VERDICT`);
  console.log(`  ${'='.repeat(60)}`);
  console.log(`  Feed engagement rate:          ${avgEngRate}%`);
  console.log(`  Feed relevance rate:           ${avgRelRate}%`);
  console.log(`  Explore overall relevance:     ${avgExploreRelevance.toFixed(1)}%`);
  console.log(`  Explore personalized relevance: ${avgPersonalizedRelevance.toFixed(1)}%`);

  if (avgExploreRelevance >= 70) console.log(`  Explore quality: EXCELLENT`);
  else if (avgExploreRelevance >= 50) console.log(`  Explore quality: GOOD`);
  else if (avgExploreRelevance >= 30) console.log(`  Explore quality: NEEDS WORK`);
  else console.log(`  Explore quality: POOR`);

  console.log(`\n  Done at ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

import { createClient } from '@supabase/supabase-js';
import https from 'https';

// ============================================================================
// 50-PERSONA LEARNING TEST
// Tests whether the feed LEARNS from user behavior when actual engagement
// diverges from onboarding topic selections.
//
// Each persona has TWO sets of interests:
//   1. followedTopics — what they SELECT during onboarding (saved to DB)
//   2. subtopics — what they ACTUALLY engage with while reading (different!)
//
// After 50 articles of engaging with different topics, does the feed
// start showing the REAL interests instead of the onboarding ones?
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestLearning_2026!';
const DELAY_BETWEEN_EVENTS_MS = 50;
const DELAY_BETWEEN_PAGES_MS = 300;
const STARTING_MOOD = 55;
const HTTP_TIMEOUT_MS = 20000;
const TARGET_ARTICLES = 50;

// ============================================================================
// SUBTOPIC MAP — maps descriptive subtopic names to categories + tags
// Used by behavior engine to match articles to persona interests
// ============================================================================

const SUBTOPIC_MAP = {
  // Politics
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'troops', 'missile', 'strike', 'ceasefire', 'nato', 'pentagon', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'supreme court', 'governor', 'election', 'legislation'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'macron', 'scholz', 'starmer', 'germany', 'france', 'uk politics'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gaza', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz', 'gulf'] },
  'Asian Politics':              { categories: ['Politics'], tags: ['asian politics', 'china', 'india politics', 'japan politics', 'korea', 'asean', 'xi jinping', 'modi'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes', 'refugee', 'asylum'] },
  'Latin America':               { categories: ['Politics'], tags: ['latin america', 'brazil politics', 'mexico', 'argentina', 'venezuela', 'colombia', 'south america'] },

  // Sports
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'nfl draft'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'playoffs', 'nba draft'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup', 'transfer'] },
  'MLB/Baseball':                { categories: ['Sports'], tags: ['mlb', 'baseball', 'world series', 'home run', 'pitcher'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout', 'wrestling'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'Olympics & Paralympics':      { categories: ['Sports'], tags: ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc', 'olympic'] },
  'Hockey':                      { categories: ['Sports'], tags: ['hockey', 'nhl', 'stanley cup', 'ice hockey', 'puck', 'goalie'] },

  // Business
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'nuclear energy'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },
  'Automotive':                  { categories: ['Business'], tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'Corporate Deals':             { categories: ['Business'], tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'Coffee & Commodities Trade':  { categories: ['Business'], tags: ['coffee', 'commodity', 'cocoa', 'agriculture', 'export', 'trade', 'fair trade'] },

  // Entertainment
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars', 'academy award'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce', 'spotify'] },
  'Hip-Hop & Rap':               { categories: ['Entertainment'], tags: ['hip-hop', 'rap', 'rapper', 'drake', 'kendrick', 'kanye', 'travis scott', 'hip hop'] },
  'Afrobeats':                   { categories: ['Entertainment'], tags: ['afrobeats', 'afropop', 'burna boy', 'wizkid', 'davido', 'nigerian music', 'afro'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam', 'game'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'star', 'billionaire', 'royal'] },
  'K-Pop & K-Drama':             { categories: ['Entertainment'], tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'] },
  'Bollywood':                   { categories: ['Entertainment'], tags: ['bollywood', 'hindi cinema', 'shah rukh khan', 'salman khan', 'indian film', 'bollywood box office'] },
  'Food & Lifestyle':            { categories: ['Lifestyle'], tags: ['food', 'restaurant', 'chef', 'cooking', 'recipe', 'cuisine', 'lifestyle', 'dining'] },

  // Tech
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm', 'gpt', 'claude', 'anthropic', 'google ai'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor', 'gpu'] },
  'Social Media':                { categories: ['Tech'], tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'Mobile Tech':                 { categories: ['Tech'], tags: ['mobile', 'app', 'mobile payments', 'fintech', 'mpesa', 'mobile banking', 'android', 'ios'] },
  'Cannabis Industry':           { categories: ['Business'], tags: ['cannabis', 'marijuana', 'weed', 'legal cannabis', 'dispensary', 'cbd', 'hemp'] },

  // Science
  'Space & Astronomy':           { categories: ['Science'], tags: ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Earth Science':               { categories: ['Science'], tags: ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'] },

  // Health
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery', 'drug'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'fda', 'medication', 'biotech', 'drug approval'] },
  'Wellness & Fitness':          { categories: ['Health', 'Lifestyle'], tags: ['wellness', 'fitness', 'nutrition', 'health tips', 'workout', 'yoga', 'meditation', 'self-care'] },

  // Finance
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading', 'stocks'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },

  // Crypto
  'Bitcoin':                     { categories: ['Finance', 'Crypto', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving', 'crypto'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Crypto', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized', 'ethereum'] },
  'Crypto Regulation & Legal':   { categories: ['Finance', 'Crypto', 'Tech'], tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'] },

  // Lifestyle & Fashion
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },
  'Pets & Animals':              { categories: ['Lifestyle'], tags: ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'] },
  'Digital Nomad & Culture':     { categories: ['Lifestyle'], tags: ['digital nomad', 'remote work', 'coworking', 'expat', 'travel', 'culture', 'nomad'] },

  // Defense
  'Defense & Military Tech':     { categories: ['Politics', 'Tech'], tags: ['defense', 'military tech', 'weapon', 'arms deal', 'defense budget', 'fighter jet', 'tank', 'drone strike'] },
};

// ============================================================================
// SHORT TOPIC ID → SUBTOPIC NAME MAP
// Maps the short IDs (used by iOS app and stored in DB) to the descriptive
// subtopic names used by our behavior engine. This is the same mapping as
// APP_TOPIC_ALIAS in main.js but reversed for the test engine.
// ============================================================================

const SHORT_TOPIC_TO_SUBTOPICS = {
  'politics':       ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Latin America'],
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
};

// ============================================================================
// 50 PERSONAS — LEARNING TEST
// followedTopics = what they chose at onboarding (same as V5)
// subtopics = what they ACTUALLY engage with (DIFFERENT from onboarding!)
// This tests if the algorithm adapts to real behavior vs onboarding choices.
// ============================================================================

const PERSONAS = [
  // 1. Priya: Follows [ai, f1, technology] → Actually likes: Soccer/Football, K-Pop & K-Drama, Movies & Film
  {
    name: 'Priya', age: 31, location: 'Austin, TX, USA',
    bio: 'ML engineer by day, but secretly obsessed with Premier League soccer, K-dramas, and A24 films. Her onboarding said AI and F1 but her heart is elsewhere.',
    email: 'learning_v1_priya@tennews.test', homeCountry: 'usa',
    followedTopics: ['ai', 'f1', 'technology', 'startups'],
    subtopics: ['Soccer/Football', 'K-Pop & K-Drama', 'Movies & Film'],
    personality: { patience: 0.7, curiosity: 0.75, saveRate: 0.08 },
    curiosityKeywords: ['premier league', 'transfer', 'blackpink', 'kdrama', 'oscar', 'a24', 'cinema', 'champions league'],
    annoyanceKeywords: ['f1', 'formula 1', 'nvidia', 'chip', 'semiconductor', 'robotics'],
    headlineTriggers: ['premier league', 'bts', 'k-pop', 'oscar', 'mbappe', 'champions league', 'blackpink'],
    repetitionTolerance: 3,
  },
  // 2. Emre: Follows [sports, business, trade] → Actually likes: AI & Machine Learning, Gaming, Space & Astronomy
  {
    name: 'Emre', age: 36, location: 'Istanbul, Turkey',
    bio: 'E-commerce founder who selected business and sports at onboarding, but actually spends all his time reading about AI breakthroughs, gaming news, and space missions.',
    email: 'learning_v1_emre@tennews.test', homeCountry: 'turkiye',
    followedTopics: ['sports', 'business', 'trade'],
    subtopics: ['AI & Machine Learning', 'Gaming', 'Space & Astronomy'],
    personality: { patience: 0.55, curiosity: 0.65, saveRate: 0.04 },
    curiosityKeywords: ['openai', 'chatgpt', 'playstation', 'nintendo', 'nasa', 'mars', 'spacex', 'telescope'],
    annoyanceKeywords: ['soccer', 'football', 'trade deal', 'tariff', 'retail', 'e-commerce'],
    headlineTriggers: ['openai', 'chatgpt', 'steam', 'playstation', 'nasa', 'spacex', 'mars'],
    repetitionTolerance: 3,
  },
  // 3. Olivia: Follows [climate, environment, sports] → Actually likes: Crypto (Bitcoin, DeFi), Stock Markets, Celebrity News
  {
    name: 'Olivia', age: 28, location: 'Manchester, UK',
    bio: 'Environmental journalist by profession, but her guilty pleasures are crypto trading, watching stock tickers, and celebrity gossip blogs.',
    email: 'learning_v1_olivia@tennews.test', homeCountry: 'uk',
    followedTopics: ['climate', 'environment', 'sports', 'science'],
    subtopics: ['Bitcoin', 'Stock Markets', 'Celebrity News'],
    personality: { patience: 0.65, curiosity: 0.7, saveRate: 0.06 },
    curiosityKeywords: ['bitcoin', 'btc', 'crypto', 'nasdaq', 'stocks', 'celebrity', 'gossip', 'scandal', 'wall street'],
    annoyanceKeywords: ['climate', 'emissions', 'carbon', 'environment', 'biodiversity', 'wildlife'],
    headlineTriggers: ['bitcoin', 'crypto', 'nasdaq', 'celebrity', 'scandal', 'stock market', 'wall street'],
    repetitionTolerance: 3,
  },
  // 4. Klaus: Follows [finance, economy, politics] → Actually likes: Gaming, Music, Boxing & MMA/UFC
  {
    name: 'Klaus', age: 54, location: 'Frankfurt, Germany',
    bio: 'Senior bond trader who signed up for finance news but actually can\'t stop reading about gaming releases, new music drops, and UFC fight cards.',
    email: 'learning_v1_klaus@tennews.test', homeCountry: 'germany',
    followedTopics: ['finance', 'economy', 'politics', 'sports'],
    subtopics: ['Gaming', 'Music', 'Boxing & MMA/UFC'],
    personality: { patience: 0.9, curiosity: 0.5, saveRate: 0.10 },
    curiosityKeywords: ['gaming', 'playstation', 'xbox', 'ufc', 'boxing', 'knockout', 'album', 'grammy', 'concert'],
    annoyanceKeywords: ['ecb', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'fiscal policy'],
    headlineTriggers: ['ufc', 'boxing', 'knockout', 'playstation', 'nintendo', 'grammy', 'album drop'],
    repetitionTolerance: 5,
  },
  // 5. Amelie: Follows [entertainment, culture, sports] → Actually likes: Cybersecurity, War & Conflict, Oil & Energy
  {
    name: 'Amelie', age: 25, location: 'Paris, France',
    bio: 'Fashion student who selected entertainment and culture, but is secretly fascinated by cybersecurity hacks, military conflicts, and energy geopolitics.',
    email: 'learning_v1_amelie@tennews.test', homeCountry: 'france',
    followedTopics: ['entertainment', 'culture', 'sports'],
    subtopics: ['Cybersecurity', 'War & Conflict', 'Oil & Energy'],
    personality: { patience: 0.45, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['hack', 'ransomware', 'data breach', 'military', 'troops', 'nato', 'opec', 'oil price', 'pipeline'],
    annoyanceKeywords: ['fashion', 'celebrity', 'red carpet', 'met gala', 'k-pop', 'gossip'],
    headlineTriggers: ['ransomware', 'cyber attack', 'nato', 'troops', 'opec', 'oil price', 'hack'],
    repetitionTolerance: 2,
  },
  // 6. Arjun: Follows [technology, ai, sports] → Actually likes: Medical Breakthroughs, Public Health, Latin America
  {
    name: 'Arjun', age: 29, location: 'Bangalore, India',
    bio: 'Backend engineer who picked tech topics at onboarding, but actually reads every medical breakthrough article and follows Latin American politics closely.',
    email: 'learning_v1_arjun@tennews.test', homeCountry: 'india',
    followedTopics: ['technology', 'ai', 'sports', 'startups'],
    subtopics: ['Medical Breakthroughs', 'Public Health', 'Latin America'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['clinical trial', 'cure', 'vaccine', 'who', 'cdc', 'brazil', 'mexico', 'argentina', 'latin america'],
    annoyanceKeywords: ['ai', 'chatgpt', 'nvidia', 'chip', 'startup', 'venture capital'],
    headlineTriggers: ['breakthrough', 'clinical trial', 'cure', 'vaccine', 'latin america', 'brazil', 'mexico'],
    repetitionTolerance: 3,
  },
  // 7. Lucas: Follows [crypto, sports, finance] → Actually likes: Climate & Environment, Space & Astronomy, Robotics & Hardware
  {
    name: 'Lucas', age: 27, location: 'Sao Paulo, Brazil',
    bio: 'DeFi trader who picked crypto and finance, but actually spends hours reading about climate science, space discoveries, and robot innovations.',
    email: 'learning_v1_lucas@tennews.test', homeCountry: 'brazil',
    followedTopics: ['crypto', 'sports', 'finance'],
    subtopics: ['Climate & Environment', 'Space & Astronomy', 'Robotics & Hardware'],
    personality: { patience: 0.5, curiosity: 0.65, saveRate: 0.04 },
    curiosityKeywords: ['climate', 'environment', 'telescope', 'mars', 'nasa', 'robot', 'semiconductor', 'chip', 'emissions'],
    annoyanceKeywords: ['bitcoin', 'crypto', 'defi', 'blockchain', 'soccer', 'football'],
    headlineTriggers: ['climate change', 'nasa', 'spacex', 'robot', 'nvidia', 'emissions record', 'telescope'],
    repetitionTolerance: 3,
  },
  // 8. Yuki: Follows [technology, entertainment, ai] → Actually likes: Soccer/Football, Trade & Tariffs, European Politics
  {
    name: 'Yuki', age: 23, location: 'Tokyo, Japan',
    bio: 'Game developer who signed up for tech and entertainment, but actually reads soccer transfer rumors, trade policy analysis, and EU politics obsessively.',
    email: 'learning_v1_yuki@tennews.test', homeCountry: 'japan',
    followedTopics: ['technology', 'entertainment', 'ai'],
    subtopics: ['Soccer/Football', 'Trade & Tariffs', 'European Politics'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['premier league', 'champions league', 'transfer', 'tariff', 'trade war', 'eu', 'macron', 'sanctions'],
    annoyanceKeywords: ['gaming', 'playstation', 'nintendo', 'ai', 'chatgpt', 'streaming'],
    headlineTriggers: ['premier league', 'champions league', 'tariff', 'trade deal', 'eu', 'macron', 'transfer'],
    repetitionTolerance: 2,
  },
  // 9. Marcus: Follows [politics, sports, defense] → Actually likes: K-Pop & K-Drama, Gaming, Bitcoin
  {
    name: 'Marcus', age: 45, location: 'Washington DC, USA',
    bio: 'Political consultant who onboarded with politics and defense, but secretly binge-watches K-dramas, plays Elden Ring, and tracks Bitcoin price.',
    email: 'learning_v1_marcus@tennews.test', homeCountry: 'usa',
    followedTopics: ['politics', 'sports', 'defense'],
    subtopics: ['K-Pop & K-Drama', 'Gaming', 'Bitcoin'],
    personality: { patience: 0.8, curiosity: 0.55, saveRate: 0.07 },
    curiosityKeywords: ['k-pop', 'k-drama', 'bts', 'blackpink', 'gaming', 'playstation', 'bitcoin', 'crypto', 'btc'],
    annoyanceKeywords: ['congress', 'senate', 'pentagon', 'military', 'defense', 'election'],
    headlineTriggers: ['bts', 'blackpink', 'k-drama', 'playstation', 'bitcoin', 'steam', 'xbox'],
    repetitionTolerance: 5,
  },
  // 10. Sarah: Follows [health, sports, science] → Actually likes: AI & Machine Learning, Startups & Venture Capital, Cybersecurity
  {
    name: 'Sarah', age: 38, location: 'Toronto, Canada',
    bio: 'Pediatric nurse who picked health topics but actually can\'t stop reading about AI startups, venture capital deals, and cybersecurity incidents.',
    email: 'learning_v1_sarah@tennews.test', homeCountry: 'canada',
    followedTopics: ['health', 'sports', 'science'],
    subtopics: ['AI & Machine Learning', 'Startups & Venture Capital', 'Cybersecurity'],
    personality: { patience: 0.7, curiosity: 0.55, saveRate: 0.06 },
    curiosityKeywords: ['openai', 'chatgpt', 'startup', 'unicorn', 'series a', 'hack', 'data breach', 'ransomware'],
    annoyanceKeywords: ['vaccine', 'clinical trial', 'public health', 'who', 'nba', 'basketball'],
    headlineTriggers: ['openai', 'startup', 'unicorn', 'ransomware', 'data breach', 'chatgpt', 'vc'],
    repetitionTolerance: 4,
  },
  // 11. Jaylen: Follows [sports, entertainment] → Actually likes: Stock Markets, Real Estate, Corporate Deals
  {
    name: 'Jaylen', age: 20, location: 'Atlanta, GA, USA',
    bio: 'Georgia Tech sophomore who signed up for sports and entertainment, but is secretly obsessed with stock trading, real estate investing, and M&A deals.',
    email: 'learning_v1_jaylen@tennews.test', homeCountry: 'usa',
    followedTopics: ['sports', 'entertainment'],
    subtopics: ['Stock Markets', 'Real Estate', 'Corporate Deals'],
    personality: { patience: 0.3, curiosity: 0.8, saveRate: 0.02 },
    curiosityKeywords: ['nasdaq', 'stocks', 'real estate', 'property', 'merger', 'acquisition', 'ipo', 'wall street'],
    annoyanceKeywords: ['nba', 'nfl', 'basketball', 'football', 'gaming', 'music'],
    headlineTriggers: ['nasdaq', 'stock market', 'real estate', 'merger', 'ipo', 'acquisition', 'billion deal'],
    repetitionTolerance: 2,
  },
  // 12. Mia: Follows [space, science, technology] → Actually likes: Soccer/Football, Celebrity Style & Red Carpet, Music
  {
    name: 'Mia', age: 33, location: 'Melbourne, Australia',
    bio: 'Astrophysicist who selected space and science, but her actual feed engagement is all about soccer, celebrity fashion, and music news.',
    email: 'learning_v1_mia@tennews.test', homeCountry: 'australia',
    followedTopics: ['space', 'science', 'technology'],
    subtopics: ['Soccer/Football', 'Celebrity Style & Red Carpet', 'Music'],
    personality: { patience: 0.75, curiosity: 0.8, saveRate: 0.09 },
    curiosityKeywords: ['premier league', 'transfer', 'red carpet', 'met gala', 'outfit', 'grammy', 'album', 'concert'],
    annoyanceKeywords: ['spacex', 'nasa', 'telescope', 'mars', 'asteroid', 'quantum'],
    headlineTriggers: ['premier league', 'met gala', 'red carpet', 'grammy', 'champions league', 'album', 'concert'],
    repetitionTolerance: 4,
  },
  // 13. Chidi: Follows [startups, ai, finance] → Actually likes: Cricket, Boxing & MMA/UFC, NFL
  {
    name: 'Chidi', age: 30, location: 'Lagos, Nigeria',
    bio: 'Fintech founder who selected AI and startups, but actually devours cricket scores, UFC fight results, and NFL highlights.',
    email: 'learning_v1_chidi@tennews.test', homeCountry: 'nigeria',
    followedTopics: ['startups', 'ai', 'finance', 'sports'],
    subtopics: ['Cricket', 'Boxing & MMA/UFC', 'NFL'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['ipl', 'cricket', 'ufc', 'boxing', 'knockout', 'nfl', 'quarterback', 'super bowl', 'touchdown'],
    annoyanceKeywords: ['startup', 'venture capital', 'openai', 'chatgpt', 'series a', 'unicorn'],
    headlineTriggers: ['ipl', 'cricket', 'ufc', 'boxing', 'nfl draft', 'super bowl', 'knockout'],
    repetitionTolerance: 3,
  },
  // 14. Jiwon: Follows [entertainment, culture, technology] → Actually likes: Oil & Energy, Trade & Tariffs, Banking & Lending
  {
    name: 'Jiwon', age: 22, location: 'Seoul, South Korea',
    bio: 'K-pop music student who picked entertainment and culture, but is actually a closet economics nerd following oil prices, trade wars, and banking.',
    email: 'learning_v1_jiwon@tennews.test', homeCountry: 'south korea',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['Oil & Energy', 'Trade & Tariffs', 'Banking & Lending'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.04 },
    curiosityKeywords: ['opec', 'oil price', 'crude oil', 'tariff', 'trade war', 'federal reserve', 'interest rate', 'banking'],
    annoyanceKeywords: ['k-pop', 'bts', 'blackpink', 'k-drama', 'music', 'streaming'],
    headlineTriggers: ['opec', 'oil price', 'tariff', 'federal reserve', 'interest rate', 'trade war', 'sanctions'],
    repetitionTolerance: 2,
  },
  // 15. Stefan: Follows [diplomacy, finance, economy] → Actually likes: Gaming, AI & Machine Learning, Space Tech
  {
    name: 'Stefan', age: 50, location: 'Zurich, Switzerland',
    bio: 'UBS wealth manager who onboarded with finance and diplomacy, but actually spends evenings gaming, reading AI research, and watching rocket launches.',
    email: 'learning_v1_stefan@tennews.test', homeCountry: 'switzerland',
    followedTopics: ['diplomacy', 'finance', 'economy', 'politics'],
    subtopics: ['Gaming', 'AI & Machine Learning', 'Space Tech'],
    personality: { patience: 1.0, curiosity: 0.5, saveRate: 0.12 },
    curiosityKeywords: ['gaming', 'playstation', 'xbox', 'openai', 'chatgpt', 'spacex', 'nasa', 'rocket', 'starship'],
    annoyanceKeywords: ['eu', 'nato', 'sanctions', 'ecb', 'trade', 'diplomacy', 'summit'],
    headlineTriggers: ['playstation', 'steam', 'openai', 'spacex', 'starship', 'nvidia', 'chatgpt'],
    repetitionTolerance: 6,
  },
  // 16. Carmen: Follows [politics, sports, trade] → Actually likes: Medical Breakthroughs, Pharma & Drug Industry, Biology & Nature
  {
    name: 'Carmen', age: 34, location: 'Mexico City, Mexico',
    bio: 'Political journalist who selected politics and trade, but actually reads medical journals, pharma news, and biology discoveries compulsively.',
    email: 'learning_v1_carmen@tennews.test', homeCountry: 'mexico',
    followedTopics: ['politics', 'sports', 'trade'],
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature'],
    personality: { patience: 0.65, curiosity: 0.6, saveRate: 0.05 },
    curiosityKeywords: ['clinical trial', 'fda', 'drug approval', 'pharma', 'biotech', 'genetics', 'species', 'evolution'],
    annoyanceKeywords: ['congress', 'senate', 'election', 'trade deal', 'tariff', 'soccer'],
    headlineTriggers: ['fda approval', 'clinical trial', 'breakthrough', 'pharma', 'biotech', 'new species', 'genetics'],
    repetitionTolerance: 4,
  },
  // 17. Omar: Follows [business, energy, crypto] → Actually likes: K-Pop & K-Drama, Movies & Film, Celebrity News
  {
    name: 'Omar', age: 42, location: 'Dubai, UAE',
    bio: 'Real estate developer who picked business and energy, but his actual engagement is K-drama binge sessions, movie reviews, and celebrity news.',
    email: 'learning_v1_omar@tennews.test', homeCountry: 'uae',
    followedTopics: ['business', 'energy', 'crypto', 'sports'],
    subtopics: ['K-Pop & K-Drama', 'Movies & Film', 'Celebrity News'],
    personality: { patience: 0.65, curiosity: 0.55, saveRate: 0.06 },
    curiosityKeywords: ['k-drama', 'k-pop', 'bts', 'blackpink', 'oscar', 'box office', 'celebrity', 'scandal', 'hollywood'],
    annoyanceKeywords: ['oil', 'opec', 'real estate', 'bitcoin', 'crypto', 'energy'],
    headlineTriggers: ['k-drama', 'bts', 'oscar', 'box office', 'celebrity', 'scandal', 'hollywood'],
    repetitionTolerance: 4,
  },
  // 18. Elena: Follows [health, science, sports] → Actually likes: Bitcoin, DeFi & Web3, Startups & Venture Capital
  {
    name: 'Elena', age: 41, location: 'Boston, MA, USA',
    bio: 'Oncologist who selected health and science, but her phone notifications are all crypto price alerts, DeFi protocol updates, and startup funding rounds.',
    email: 'learning_v1_elena@tennews.test', homeCountry: 'usa',
    followedTopics: ['health', 'science', 'sports', 'finance'],
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Startups & Venture Capital'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['bitcoin', 'crypto', 'defi', 'web3', 'blockchain', 'startup', 'unicorn', 'series a', 'vc'],
    annoyanceKeywords: ['medical', 'clinical trial', 'vaccine', 'pharma', 'biology', 'nature'],
    headlineTriggers: ['bitcoin', 'ethereum', 'defi', 'startup', 'unicorn', 'series a', 'blockchain'],
    repetitionTolerance: 4,
  },
  // 19. Erik: Follows [entertainment, technology, ai] → Actually likes: War & Conflict, US Politics, Middle East
  {
    name: 'Erik', age: 24, location: 'Gothenburg, Sweden',
    bio: 'Indie game developer who signed up for gaming and AI, but actually reads war coverage, US political drama, and Middle East geopolitics obsessively.',
    email: 'learning_v1_erik@tennews.test', homeCountry: 'sweden',
    followedTopics: ['entertainment', 'technology', 'ai'],
    subtopics: ['War & Conflict', 'US Politics', 'Middle East'],
    personality: { patience: 0.35, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['war', 'troops', 'nato', 'congress', 'senate', 'election', 'iran', 'israel', 'gaza', 'pentagon'],
    annoyanceKeywords: ['gaming', 'playstation', 'steam', 'ai', 'chatgpt', 'nvidia'],
    headlineTriggers: ['nato', 'troops', 'congress', 'election', 'iran', 'israel', 'gaza', 'pentagon'],
    repetitionTolerance: 2,
  },
  // 20. James: Follows [cybersecurity, defense, politics] → Actually likes: NBA, NFL, Boxing & MMA/UFC
  {
    name: 'James', age: 39, location: 'London, UK',
    bio: 'Ex-GCHQ cybersecurity consultant who selected defense and politics, but actually engages with every NBA highlight, NFL draft pick, and UFC fight result.',
    email: 'learning_v1_james@tennews.test', homeCountry: 'uk',
    followedTopics: ['cybersecurity', 'defense', 'politics', 'sports'],
    subtopics: ['NBA', 'NFL', 'Boxing & MMA/UFC'],
    personality: { patience: 0.7, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['nba', 'basketball', 'lebron', 'nfl', 'quarterback', 'ufc', 'boxing', 'knockout', 'super bowl'],
    annoyanceKeywords: ['cybersecurity', 'hack', 'data breach', 'nato', 'pentagon', 'classified'],
    headlineTriggers: ['nba', 'lebron', 'nfl draft', 'ufc', 'boxing', 'knockout', 'super bowl'],
    repetitionTolerance: 4,
  },

  // ============================================================================
  // NEW PERSONAS 21-50 — LEARNING TEST (divergent interests)
  // ============================================================================

  // 21. Diego: Follows [ai, technology, sports] → Actually likes: Bollywood, Food & Lifestyle, Celebrity Style & Red Carpet
  {
    name: 'Diego', age: 33, location: 'Mexico City, Mexico',
    bio: 'AI researcher who onboarded with tech, but actually spends all his time watching Bollywood films, reading food blogs, and following celebrity fashion.',
    email: 'learning_v1_diego@tennews.test', homeCountry: 'mexico',
    followedTopics: ['ai', 'technology', 'sports'],
    subtopics: ['Bollywood', 'Food & Lifestyle', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.7, curiosity: 0.8, saveRate: 0.07 },
    curiosityKeywords: ['bollywood', 'shah rukh khan', 'food', 'restaurant', 'chef', 'red carpet', 'met gala', 'fashion'],
    annoyanceKeywords: ['ai', 'openai', 'chatgpt', 'nvidia', 'chip', 'robotics'],
    headlineTriggers: ['bollywood', 'shah rukh khan', 'restaurant', 'chef', 'met gala', 'red carpet', 'fashion week'],
    repetitionTolerance: 3,
  },
  // 22. Tunde: Follows [crypto, entertainment, sports] → Actually likes: European Politics, Climate & Environment, Medical Breakthroughs
  {
    name: 'Tunde', age: 26, location: 'Lagos, Nigeria',
    bio: 'Crypto trader who signed up for crypto and entertainment, but actually reads EU politics, climate science papers, and medical research.',
    email: 'learning_v1_tunde@tennews.test', homeCountry: 'nigeria',
    followedTopics: ['crypto', 'entertainment', 'sports'],
    subtopics: ['European Politics', 'Climate & Environment', 'Medical Breakthroughs'],
    personality: { patience: 0.45, curiosity: 0.75, saveRate: 0.04 },
    curiosityKeywords: ['eu', 'macron', 'scholz', 'parliament', 'climate', 'emissions', 'clinical trial', 'cure', 'vaccine'],
    annoyanceKeywords: ['bitcoin', 'crypto', 'defi', 'nft', 'afrobeats', 'soccer'],
    headlineTriggers: ['eu', 'macron', 'climate change', 'emissions', 'clinical trial', 'breakthrough', 'parliament'],
    repetitionTolerance: 2,
  },
  // 23. Rohan: Follows [business, sports, entertainment, finance] → Actually likes: Cybersecurity, Space & Astronomy, Hip-Hop & Rap
  {
    name: 'Rohan', age: 35, location: 'Mumbai, India',
    bio: 'Investment banker who picked business and finance, but his real interests are cybersecurity news, space discoveries, and hip-hop culture.',
    email: 'learning_v1_rohan@tennews.test', homeCountry: 'india',
    followedTopics: ['business', 'sports', 'entertainment', 'finance'],
    subtopics: ['Cybersecurity', 'Space & Astronomy', 'Hip-Hop & Rap'],
    personality: { patience: 0.65, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['hack', 'ransomware', 'data breach', 'nasa', 'mars', 'telescope', 'drake', 'kendrick', 'rap'],
    annoyanceKeywords: ['cricket', 'bollywood', 'stock market', 'earnings', 'corporate'],
    headlineTriggers: ['ransomware', 'data breach', 'nasa', 'mars', 'drake', 'kendrick', 'hip-hop'],
    repetitionTolerance: 4,
  },
  // 24. Lena: Follows [climate, politics, environment, energy] → Actually likes: Gaming, K-Pop & K-Drama, Smartphones & Gadgets
  {
    name: 'Lena', age: 30, location: 'Berlin, Germany',
    bio: 'Climate activist who selected green topics, but her screen time says gaming, K-dramas, and phone reviews.',
    email: 'learning_v1_lena@tennews.test', homeCountry: 'germany',
    followedTopics: ['climate', 'politics', 'environment', 'energy'],
    subtopics: ['Gaming', 'K-Pop & K-Drama', 'Smartphones & Gadgets'],
    personality: { patience: 0.7, curiosity: 0.7, saveRate: 0.08 },
    curiosityKeywords: ['playstation', 'xbox', 'nintendo', 'k-drama', 'bts', 'blackpink', 'iphone', 'samsung', 'pixel'],
    annoyanceKeywords: ['climate', 'emissions', 'green deal', 'renewable', 'solar', 'wind'],
    headlineTriggers: ['playstation', 'nintendo', 'k-drama', 'bts', 'iphone', 'samsung galaxy', 'steam'],
    repetitionTolerance: 4,
  },
  // 25. Wei Lin: Follows [finance, ai, f1, economy] → Actually likes: Afrobeats, Movies & Film, Pets & Animals
  {
    name: 'Wei Lin', age: 37, location: 'Singapore',
    bio: 'Quant analyst who onboarded with finance and AI, but actually follows Afrobeats music, movie releases, and cute animal content.',
    email: 'learning_v1_weilin@tennews.test', homeCountry: 'singapore',
    followedTopics: ['finance', 'ai', 'f1', 'economy'],
    subtopics: ['Afrobeats', 'Movies & Film', 'Pets & Animals'],
    personality: { patience: 0.8, curiosity: 0.65, saveRate: 0.09 },
    curiosityKeywords: ['burna boy', 'wizkid', 'afrobeats', 'box office', 'oscar', 'cinema', 'pets', 'dog', 'cat', 'adoption'],
    annoyanceKeywords: ['stock market', 'nasdaq', 'fed rate', 'f1', 'grand prix', 'trading'],
    headlineTriggers: ['burna boy', 'wizkid', 'oscar', 'box office', 'adoption', 'cute', 'afrobeats'],
    repetitionTolerance: 5,
  },
  // 26. Ahmed: Follows [politics, sports, diplomacy] → Actually likes: Bitcoin, Startups & Venture Capital, Robotics & Hardware
  {
    name: 'Ahmed', age: 40, location: 'Cairo, Egypt',
    bio: 'Foreign affairs columnist who selected politics and diplomacy, but actually tracks Bitcoin whale wallets, reads about startup exits, and follows robotics.',
    email: 'learning_v1_ahmed@tennews.test', homeCountry: 'egypt',
    followedTopics: ['politics', 'sports', 'diplomacy'],
    subtopics: ['Bitcoin', 'Startups & Venture Capital', 'Robotics & Hardware'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['bitcoin', 'btc', 'crypto', 'startup', 'unicorn', 'robot', 'semiconductor', 'chip', 'nvidia'],
    annoyanceKeywords: ['middle east', 'iran', 'israel', 'gaza', 'diplomacy', 'nato'],
    headlineTriggers: ['bitcoin', 'startup', 'unicorn', 'robot', 'nvidia', 'chip', 'crypto'],
    repetitionTolerance: 5,
  },
  // 27. Jasmine: Follows [health, sports, science] → Actually likes: Oil & Energy, Trade & Tariffs, Corporate Earnings
  {
    name: 'Jasmine', age: 32, location: 'Vancouver, Canada',
    bio: 'Dietitian who selected health and wellness, but actually follows oil markets, trade wars, and quarterly earnings reports obsessively.',
    email: 'learning_v1_jasmine@tennews.test', homeCountry: 'canada',
    followedTopics: ['health', 'sports', 'science'],
    subtopics: ['Oil & Energy', 'Trade & Tariffs', 'Corporate Earnings'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['opec', 'oil price', 'crude oil', 'tariff', 'trade war', 'earnings', 'revenue', 'quarterly results'],
    annoyanceKeywords: ['wellness', 'nutrition', 'diet', 'mental health', 'yoga', 'nba'],
    headlineTriggers: ['opec', 'oil price', 'tariff', 'earnings', 'revenue', 'trade war', 'quarterly'],
    repetitionTolerance: 3,
  },
  // 28. Axel: Follows [entertainment, ai, space, technology] → Actually likes: Banking & Lending, Latin America, Cricket
  {
    name: 'Axel', age: 26, location: 'Stockholm, Sweden',
    bio: 'Game designer who picked entertainment and AI, but actually reads central bank analysis, Latin American news, and cricket commentary.',
    email: 'learning_v1_axel@tennews.test', homeCountry: 'sweden',
    followedTopics: ['entertainment', 'ai', 'space', 'technology'],
    subtopics: ['Banking & Lending', 'Latin America', 'Cricket'],
    personality: { patience: 0.45, curiosity: 0.9, saveRate: 0.04 },
    curiosityKeywords: ['federal reserve', 'interest rate', 'inflation', 'brazil', 'argentina', 'cricket', 'ipl', 'ashes'],
    annoyanceKeywords: ['gaming', 'spacex', 'nasa', 'ai', 'chatgpt', 'streaming'],
    headlineTriggers: ['federal reserve', 'interest rate', 'ipl', 'cricket', 'brazil', 'argentina', 'inflation'],
    repetitionTolerance: 2,
  },
  // 29. Mateo: Follows [sports, economy, politics] → Actually likes: AI & Machine Learning, Cybersecurity, DeFi & Web3
  {
    name: 'Mateo', age: 38, location: 'Buenos Aires, Argentina',
    bio: 'Economics professor who onboarded with politics and economy, but actually reads AI papers, cybersecurity reports, and DeFi protocol docs.',
    email: 'learning_v1_mateo@tennews.test', homeCountry: 'argentina',
    followedTopics: ['sports', 'economy', 'politics'],
    subtopics: ['AI & Machine Learning', 'Cybersecurity', 'DeFi & Web3'],
    personality: { patience: 0.6, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['openai', 'chatgpt', 'ransomware', 'hack', 'defi', 'blockchain', 'ethereum', 'web3'],
    annoyanceKeywords: ['soccer', 'football', 'peso', 'imf', 'election', 'congress'],
    headlineTriggers: ['openai', 'chatgpt', 'ransomware', 'hack', 'defi', 'ethereum', 'blockchain'],
    repetitionTolerance: 4,
  },
  // 30. Rashid: Follows [energy, business, f1, finance] → Actually likes: Mental Health, Wellness & Fitness, Pets & Animals
  {
    name: 'Rashid', age: 44, location: 'Dubai, UAE',
    bio: 'Sovereign wealth fund director who picked energy and F1, but actually reads mental health articles, wellness tips, and heartwarming animal stories.',
    email: 'learning_v1_rashid@tennews.test', homeCountry: 'uae',
    followedTopics: ['energy', 'business', 'f1', 'finance'],
    subtopics: ['Mental Health', 'Wellness & Fitness', 'Pets & Animals'],
    personality: { patience: 0.8, curiosity: 0.5, saveRate: 0.08 },
    curiosityKeywords: ['mental health', 'anxiety', 'therapy', 'wellness', 'fitness', 'yoga', 'pets', 'dog', 'cat', 'adoption'],
    annoyanceKeywords: ['oil', 'opec', 'f1', 'grand prix', 'real estate', 'corporate'],
    headlineTriggers: ['mental health', 'wellness', 'therapy', 'fitness', 'adoption', 'rescue', 'mindfulness'],
    repetitionTolerance: 5,
  },
  // 31. Haruto: Follows [technology, ai, entertainment] → Actually likes: Soccer/Football, Oil & Energy, Middle East
  {
    name: 'Haruto', age: 28, location: 'Tokyo, Japan',
    bio: 'Robotics engineer who selected tech, but actually reads soccer transfer news, oil market analysis, and Middle East geopolitics.',
    email: 'learning_v1_haruto@tennews.test', homeCountry: 'japan',
    followedTopics: ['technology', 'ai', 'entertainment'],
    subtopics: ['Soccer/Football', 'Oil & Energy', 'Middle East'],
    personality: { patience: 0.55, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['premier league', 'champions league', 'transfer', 'opec', 'oil', 'iran', 'israel', 'gaza'],
    annoyanceKeywords: ['robot', 'ai', 'chatgpt', 'nvidia', 'gaming', 'semiconductor'],
    headlineTriggers: ['premier league', 'champions league', 'opec', 'oil price', 'iran', 'israel', 'transfer'],
    repetitionTolerance: 3,
  },
  // 32. Charlotte: Follows [finance, sports, politics, economy] → Actually likes: Space & Astronomy, Gaming, Afrobeats
  {
    name: 'Charlotte', age: 43, location: 'London, UK',
    bio: 'Barclays MD who selected finance and politics, but her guilty pleasures are space documentaries, casual gaming, and Afrobeats playlists.',
    email: 'learning_v1_charlotte@tennews.test', homeCountry: 'uk',
    followedTopics: ['finance', 'sports', 'politics', 'economy'],
    subtopics: ['Space & Astronomy', 'Gaming', 'Afrobeats'],
    personality: { patience: 0.85, curiosity: 0.5, saveRate: 0.09 },
    curiosityKeywords: ['nasa', 'mars', 'telescope', 'galaxy', 'playstation', 'nintendo', 'burna boy', 'wizkid', 'afrobeats'],
    annoyanceKeywords: ['bank of england', 'ftse', 'stocks', 'election', 'parliament'],
    headlineTriggers: ['nasa', 'mars', 'playstation', 'burna boy', 'telescope', 'spacex', 'wizkid'],
    repetitionTolerance: 5,
  },
  // 33. Liam: Follows [science, climate, sports, environment] → Actually likes: Bitcoin, Hip-Hop & Rap, Sneakers & Streetwear
  {
    name: 'Liam', age: 31, location: 'Sydney, Australia',
    bio: 'Marine biologist who selected climate and science, but actually engages with Bitcoin charts, hip-hop beef, and sneaker drops.',
    email: 'learning_v1_liam@tennews.test', homeCountry: 'australia',
    followedTopics: ['science', 'climate', 'sports', 'environment'],
    subtopics: ['Bitcoin', 'Hip-Hop & Rap', 'Sneakers & Streetwear'],
    personality: { patience: 0.7, curiosity: 0.75, saveRate: 0.07 },
    curiosityKeywords: ['bitcoin', 'btc', 'crypto', 'drake', 'kendrick', 'rap', 'sneakers', 'jordan', 'nike', 'yeezy'],
    annoyanceKeywords: ['reef', 'coral', 'climate', 'ocean', 'wildlife', 'emissions'],
    headlineTriggers: ['bitcoin', 'drake', 'kendrick', 'jordan', 'nike', 'sneaker', 'crypto'],
    repetitionTolerance: 4,
  },
  // 34. Ryan: Follows [technology, startups, sports] → Actually likes: War & Conflict, European Politics, Commodities
  {
    name: 'Ryan', age: 29, location: 'Toronto, Canada',
    bio: 'Shopify PM who picked tech and startups, but actually reads war coverage, EU political analysis, and commodities market reports.',
    email: 'learning_v1_ryan@tennews.test', homeCountry: 'canada',
    followedTopics: ['technology', 'startups', 'sports'],
    subtopics: ['War & Conflict', 'European Politics', 'Commodities'],
    personality: { patience: 0.55, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['war', 'troops', 'conflict', 'nato', 'eu', 'macron', 'gold', 'silver', 'commodities', 'futures'],
    annoyanceKeywords: ['startup', 'shopify', 'saas', 'hockey', 'y combinator'],
    headlineTriggers: ['nato', 'troops', 'war', 'eu', 'macron', 'gold', 'commodities', 'conflict'],
    repetitionTolerance: 3,
  },
  // 35. Minji: Follows [entertainment, culture, technology] → Actually likes: Medical Breakthroughs, Stock Markets, Automotive
  {
    name: 'Minji', age: 21, location: 'Seoul, South Korea',
    bio: 'K-pop dance cover creator who selected entertainment, but is actually fascinated by medical breakthroughs, stock trading, and car reviews.',
    email: 'learning_v1_minji@tennews.test', homeCountry: 'south korea',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['Medical Breakthroughs', 'Stock Markets', 'Automotive'],
    personality: { patience: 0.3, curiosity: 0.9, saveRate: 0.03 },
    curiosityKeywords: ['clinical trial', 'cure', 'fda', 'nasdaq', 'stocks', 'tesla', 'ford', 'ev', 'electric vehicle'],
    annoyanceKeywords: ['k-pop', 'bts', 'blackpink', 'k-drama', 'samsung galaxy'],
    headlineTriggers: ['clinical trial', 'cure', 'nasdaq', 'tesla', 'fda approval', 'stock market', 'ev'],
    repetitionTolerance: 2,
  },
  // 36. Wanjiku: Follows [business, technology, sports, startups] → Actually likes: K-Pop & K-Drama, Space Tech, Mental Health
  {
    name: 'Wanjiku', age: 34, location: 'Nairobi, Kenya',
    bio: 'Mobile payments CEO who picked business and tech, but actually binges K-dramas, follows SpaceX launches, and reads mental health articles.',
    email: 'learning_v1_wanjiku@tennews.test', homeCountry: 'kenya',
    followedTopics: ['business', 'technology', 'sports', 'startups'],
    subtopics: ['K-Pop & K-Drama', 'Space Tech', 'Mental Health'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.06 },
    curiosityKeywords: ['k-drama', 'bts', 'blackpink', 'spacex', 'nasa', 'rocket', 'mental health', 'therapy', 'anxiety'],
    annoyanceKeywords: ['mobile payments', 'fintech', 'mpesa', 'startup', 'e-commerce'],
    headlineTriggers: ['k-drama', 'bts', 'spacex', 'starship', 'mental health', 'nasa', 'therapy'],
    repetitionTolerance: 3,
  },
  // 37. Alexei: Follows [cybersecurity, politics, defense, technology] → Actually likes: Cricket, Food & Lifestyle, Movies & Film
  {
    name: 'Alexei', age: 36, location: 'Tbilisi, Georgia',
    bio: 'Cybersecurity researcher who selected defense and hacking topics, but actually reads cricket coverage, food reviews, and movie critiques.',
    email: 'learning_v1_alexei@tennews.test', homeCountry: 'georgia',
    followedTopics: ['cybersecurity', 'politics', 'defense', 'technology'],
    subtopics: ['Cricket', 'Food & Lifestyle', 'Movies & Film'],
    personality: { patience: 0.75, curiosity: 0.65, saveRate: 0.07 },
    curiosityKeywords: ['ipl', 'cricket', 'ashes', 'restaurant', 'chef', 'food', 'oscar', 'box office', 'cinema'],
    annoyanceKeywords: ['ransomware', 'hack', 'cyber', 'nato', 'ukraine', 'russia'],
    headlineTriggers: ['ipl', 'cricket', 'restaurant', 'chef', 'oscar', 'box office', 'ashes'],
    repetitionTolerance: 5,
  },
  // 38. Daan: Follows [business, sports, trade, politics] → Actually likes: Space & Astronomy, AI & Machine Learning, Music
  {
    name: 'Daan', age: 31, location: 'Amsterdam, Netherlands',
    bio: 'Cannabis industry consultant who picked business and trade, but actually reads about black holes, AI research papers, and new music releases.',
    email: 'learning_v1_daan@tennews.test', homeCountry: 'netherlands',
    followedTopics: ['business', 'sports', 'trade', 'politics'],
    subtopics: ['Space & Astronomy', 'AI & Machine Learning', 'Music'],
    personality: { patience: 0.55, curiosity: 0.7, saveRate: 0.04 },
    curiosityKeywords: ['nasa', 'mars', 'telescope', 'black hole', 'openai', 'chatgpt', 'album', 'grammy', 'concert'],
    annoyanceKeywords: ['cannabis', 'trade', 'tariff', 'soccer', 'ajax'],
    headlineTriggers: ['nasa', 'black hole', 'openai', 'chatgpt', 'grammy', 'album', 'mars'],
    repetitionTolerance: 3,
  },
  // 39. Khalid: Follows [energy, defense, business, sports] → Actually likes: Gaming, Bollywood, Social Media
  {
    name: 'Khalid', age: 46, location: 'Riyadh, Saudi Arabia',
    bio: 'Aramco advisor who picked energy and defense, but actually plays FIFA, watches Bollywood, and follows social media trends.',
    email: 'learning_v1_khalid@tennews.test', homeCountry: 'saudi arabia',
    followedTopics: ['energy', 'defense', 'business', 'sports'],
    subtopics: ['Gaming', 'Bollywood', 'Social Media'],
    personality: { patience: 0.8, curiosity: 0.5, saveRate: 0.08 },
    curiosityKeywords: ['playstation', 'xbox', 'gaming', 'bollywood', 'shah rukh khan', 'tiktok', 'instagram', 'viral'],
    annoyanceKeywords: ['aramco', 'opec', 'oil', 'defense', 'arms deal', 'military'],
    headlineTriggers: ['playstation', 'xbox', 'bollywood', 'shah rukh khan', 'tiktok', 'instagram', 'viral'],
    repetitionTolerance: 5,
  },
  // 40. Sofia: Follows [startups, crypto, culture, technology] → Actually likes: War & Conflict, Public Health, Earth Science
  {
    name: 'Sofia', age: 28, location: 'Lisbon, Portugal',
    bio: 'Digital nomad who selected startups and crypto, but actually reads war reporting, pandemic coverage, and earthquake/volcano science.',
    email: 'learning_v1_sofia@tennews.test', homeCountry: 'portugal',
    followedTopics: ['startups', 'crypto', 'culture', 'technology'],
    subtopics: ['War & Conflict', 'Public Health', 'Earth Science'],
    personality: { patience: 0.5, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['war', 'troops', 'conflict', 'pandemic', 'vaccine', 'who', 'earthquake', 'volcano', 'ocean'],
    annoyanceKeywords: ['startup', 'crypto', 'bitcoin', 'web summit', 'digital nomad'],
    headlineTriggers: ['war', 'troops', 'pandemic', 'vaccine', 'earthquake', 'volcano', 'outbreak'],
    repetitionTolerance: 3,
  },
  // 41. DeAndre: Follows [sports, entertainment] → Actually likes: Climate & Environment, European Politics, Pharma & Drug Industry
  {
    name: 'DeAndre', age: 24, location: 'Chicago, IL, USA',
    bio: 'Music producer who picked sports and entertainment, but actually reads about climate change, EU parliament debates, and FDA drug approvals.',
    email: 'learning_v1_deandre@tennews.test', homeCountry: 'usa',
    followedTopics: ['sports', 'entertainment'],
    subtopics: ['Climate & Environment', 'European Politics', 'Pharma & Drug Industry'],
    personality: { patience: 0.35, curiosity: 0.8, saveRate: 0.03 },
    curiosityKeywords: ['climate', 'emissions', 'carbon', 'eu', 'macron', 'parliament', 'fda', 'pharma', 'drug approval'],
    annoyanceKeywords: ['nba', 'nfl', 'bulls', 'bears', 'hip-hop', 'rap'],
    headlineTriggers: ['climate change', 'emissions', 'eu', 'macron', 'fda approval', 'pharma', 'parliament'],
    repetitionTolerance: 2,
  },
  // 42. Bea: Follows [entertainment, culture, technology] → Actually likes: Oil & Energy, Defense & Military Tech, Real Estate
  {
    name: 'Bea', age: 23, location: 'Manila, Philippines',
    bio: 'Social media manager who selected K-pop and entertainment, but actually reads OPEC reports, defense procurement news, and real estate listings.',
    email: 'learning_v1_bea@tennews.test', homeCountry: 'philippines',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['Oil & Energy', 'Defense & Military Tech', 'Real Estate'],
    personality: { patience: 0.35, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['opec', 'oil', 'energy', 'defense', 'military', 'fighter jet', 'arms deal', 'real estate', 'property'],
    annoyanceKeywords: ['k-pop', 'bts', 'blackpink', 'tiktok', 'viral', 'influencer'],
    headlineTriggers: ['opec', 'oil price', 'defense contract', 'fighter jet', 'real estate', 'property', 'arms deal'],
    repetitionTolerance: 2,
  },
  // 43. Lukas: Follows [health, finance, science, business] → Actually likes: K-Pop & K-Drama, Gaming, Soccer/Football
  {
    name: 'Lukas', age: 48, location: 'Zurich, Switzerland',
    bio: 'Biotech CSO who picked health and finance, but actually binge-watches K-dramas, plays RPGs, and follows Champions League religiously.',
    email: 'learning_v1_lukas@tennews.test', homeCountry: 'switzerland',
    followedTopics: ['health', 'finance', 'science', 'business'],
    subtopics: ['K-Pop & K-Drama', 'Gaming', 'Soccer/Football'],
    personality: { patience: 0.85, curiosity: 0.6, saveRate: 0.10 },
    curiosityKeywords: ['k-drama', 'bts', 'blackpink', 'playstation', 'xbox', 'gaming', 'champions league', 'premier league'],
    annoyanceKeywords: ['pharma', 'fda', 'biotech', 'clinical trial', 'stock market'],
    headlineTriggers: ['k-drama', 'bts', 'playstation', 'champions league', 'premier league', 'xbox', 'gaming'],
    repetitionTolerance: 5,
  },
  // 44. Travis: Follows [space, energy, sports, technology] → Actually likes: Celebrity News, Bollywood, Music
  {
    name: 'Travis', age: 36, location: 'Houston, TX, USA',
    bio: 'NASA engineer who selected space and energy, but actually follows celebrity drama, Bollywood releases, and Grammy award coverage.',
    email: 'learning_v1_travis@tennews.test', homeCountry: 'usa',
    followedTopics: ['space', 'energy', 'sports', 'technology'],
    subtopics: ['Celebrity News', 'Bollywood', 'Music'],
    personality: { patience: 0.7, curiosity: 0.65, saveRate: 0.07 },
    curiosityKeywords: ['celebrity', 'scandal', 'gossip', 'bollywood', 'shah rukh khan', 'grammy', 'album', 'concert'],
    annoyanceKeywords: ['spacex', 'nasa', 'rocket', 'oil', 'energy', 'nfl'],
    headlineTriggers: ['celebrity', 'scandal', 'bollywood', 'grammy', 'album', 'concert', 'gossip'],
    repetitionTolerance: 4,
  },
  // 45. Kavya: Follows [startups, ai, sports, health] → Actually likes: European Politics, F1 & Motorsport, Commodities
  {
    name: 'Kavya', age: 27, location: 'Bangalore, India',
    bio: 'AI health-tech founder who selected startups and AI, but actually follows EU politics, F1 race weekends, and gold/commodity markets.',
    email: 'learning_v1_kavya@tennews.test', homeCountry: 'india',
    followedTopics: ['startups', 'ai', 'sports', 'health'],
    subtopics: ['European Politics', 'F1 & Motorsport', 'Commodities'],
    personality: { patience: 0.6, curiosity: 0.75, saveRate: 0.06 },
    curiosityKeywords: ['eu', 'macron', 'scholz', 'parliament', 'f1', 'verstappen', 'hamilton', 'gold', 'silver', 'commodities'],
    annoyanceKeywords: ['startup', 'ai', 'openai', 'venture capital', 'series a'],
    headlineTriggers: ['eu', 'macron', 'f1', 'verstappen', 'gold', 'commodities', 'grand prix'],
    repetitionTolerance: 3,
  },
  // 46. Thabo: Follows [climate, sports, trade, politics] → Actually likes: AI & Machine Learning, DeFi & Web3, Movies & Film
  {
    name: 'Thabo', age: 35, location: 'Cape Town, South Africa',
    bio: 'Trade analyst who picked climate and politics, but his actual engagement pattern is all AI breakthroughs, DeFi protocols, and cinema.',
    email: 'learning_v1_thabo@tennews.test', homeCountry: 'south africa',
    followedTopics: ['climate', 'sports', 'trade', 'politics'],
    subtopics: ['AI & Machine Learning', 'DeFi & Web3', 'Movies & Film'],
    personality: { patience: 0.65, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['openai', 'chatgpt', 'ai', 'defi', 'blockchain', 'ethereum', 'oscar', 'box office', 'cinema'],
    annoyanceKeywords: ['climate', 'trade', 'tariff', 'soccer', 'kaizer chiefs'],
    headlineTriggers: ['openai', 'chatgpt', 'defi', 'ethereum', 'oscar', 'box office', 'blockchain'],
    repetitionTolerance: 4,
  },
  // 47. Marco: Follows [crypto, business, sports] → Actually likes: Biology & Nature, Public Health, Earth Science
  {
    name: 'Marco', age: 34, location: 'Miami, FL, USA',
    bio: 'Bitcoin maxi who selected crypto and real estate, but actually reads about wildlife, public health reports, and volcano/earthquake coverage.',
    email: 'learning_v1_marco@tennews.test', homeCountry: 'usa',
    followedTopics: ['crypto', 'business', 'sports'],
    subtopics: ['Biology & Nature', 'Public Health', 'Earth Science'],
    personality: { patience: 0.5, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['wildlife', 'species', 'nature', 'pandemic', 'vaccine', 'who', 'earthquake', 'volcano', 'ocean'],
    annoyanceKeywords: ['bitcoin', 'crypto', 'defi', 'real estate', 'ufc', 'boxing'],
    headlineTriggers: ['wildlife', 'new species', 'pandemic', 'vaccine', 'earthquake', 'volcano', 'outbreak'],
    repetitionTolerance: 3,
  },
  // 48. Sakura: Follows [entertainment, technology] → Actually likes: Stock Markets, Trade & Tariffs, Asian Politics
  {
    name: 'Sakura', age: 25, location: 'Osaka, Japan',
    bio: 'Food blogger and gamer who selected entertainment, but actually tracks stock indices, trade policy debates, and Asian political developments.',
    email: 'learning_v1_sakura@tennews.test', homeCountry: 'japan',
    followedTopics: ['entertainment', 'technology'],
    subtopics: ['Stock Markets', 'Trade & Tariffs', 'Asian Politics'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['nasdaq', 'stocks', 'nikkei', 'tariff', 'trade war', 'china', 'japan politics', 'asean', 'xi jinping'],
    annoyanceKeywords: ['gaming', 'nintendo', 'food', 'ramen', 'anime', 'j-pop'],
    headlineTriggers: ['nasdaq', 'nikkei', 'tariff', 'trade war', 'china', 'japan', 'asean', 'stocks'],
    repetitionTolerance: 2,
  },
  // 49. Kacper: Follows [defense, politics, cybersecurity] → Actually likes: Startups & Venture Capital, Music, Wellness & Fitness
  {
    name: 'Kacper', age: 41, location: 'Warsaw, Poland',
    bio: 'Defense analyst who picked military and politics, but his real reading pattern is startup news, music reviews, and wellness articles.',
    email: 'learning_v1_kacper@tennews.test', homeCountry: 'poland',
    followedTopics: ['defense', 'politics', 'cybersecurity'],
    subtopics: ['Startups & Venture Capital', 'Music', 'Wellness & Fitness'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['startup', 'unicorn', 'series a', 'vc', 'album', 'grammy', 'concert', 'wellness', 'fitness', 'yoga'],
    annoyanceKeywords: ['nato', 'troops', 'military', 'war', 'cyber attack', 'defense'],
    headlineTriggers: ['startup', 'unicorn', 'grammy', 'album', 'wellness', 'fitness', 'series a'],
    repetitionTolerance: 5,
  },
  // 50. Valentina: Follows [business, sports, politics, trade] → Actually likes: Space Tech, Cybersecurity, Celebrity Style & Red Carpet
  {
    name: 'Valentina', age: 30, location: 'Bogota, Colombia',
    bio: 'Coffee exporter who selected business and trade, but actually follows rocket launches, cybersecurity breaches, and celebrity red carpet events.',
    email: 'learning_v1_valentina@tennews.test', homeCountry: 'colombia',
    followedTopics: ['business', 'sports', 'politics', 'trade'],
    subtopics: ['Space Tech', 'Cybersecurity', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.6, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['spacex', 'nasa', 'rocket', 'starship', 'ransomware', 'hack', 'red carpet', 'met gala', 'fashion'],
    annoyanceKeywords: ['coffee', 'trade', 'tariff', 'soccer', 'latin america'],
    headlineTriggers: ['spacex', 'starship', 'ransomware', 'hack', 'met gala', 'red carpet', 'nasa'],
    repetitionTolerance: 4,
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
  const allTags = [], allCategories = new Set(), subtopicKeywords = {};
  for (const st of persona.subtopics) {
    const def = SUBTOPIC_MAP[st];
    if (!def) continue;
    subtopicKeywords[st] = def.tags;
    allTags.push(...def.tags);
    def.categories.forEach(c => allCategories.add(c));
  }
  return { allTags, allCategories: [...allCategories], subtopicKeywords };
}

// Build a profile from onboarding topics (for learning analysis matching)
function buildOnboardingProfile(persona) {
  const allTags = [], allCategories = new Set(), subtopicKeywords = {};
  for (const topicId of persona.followedTopics) {
    const subtopicNames = SHORT_TOPIC_TO_SUBTOPICS[topicId] || [];
    for (const st of subtopicNames) {
      const def = SUBTOPIC_MAP[st];
      if (!def) continue;
      if (!subtopicKeywords[st]) {
        subtopicKeywords[st] = def.tags;
        allTags.push(...def.tags);
        def.categories.forEach(c => allCategories.add(c));
      }
    }
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
    if (keywords.some(kw => combined.includes(kw)) || SUBTOPIC_MAP[name]?.categories.includes(category)) matched.push(name);
  }
  return matched;
}

// Check if an article matches onboarding topics (not behavior subtopics)
function matchArticleToOnboarding(article, onboardingProfile) {
  return matchArticleToSubtopics(article, onboardingProfile);
}

// ============================================================================
// BEHAVIOR ENGINE — realistic human reading simulation
// ============================================================================

function decideEngagement(persona, article, profile, ctx) {
  const tags = getArticleTags(article);
  const title = (article.title || article.title_news || '').toLowerCase();
  const category = (article.category || '').trim();
  const combined = [...tags, ...title.split(/\s+/)].join(' ').toLowerCase();
  const matchedSubtopics = matchArticleToSubtopics(article, profile);

  let score = 0;

  // Subtopic match
  if (matchedSubtopics.length >= 2) score += 0.5;
  else if (matchedSubtopics.length === 1) score += 0.3;

  // Keyword hits (from subtopic tags)
  let kwHits = 0;
  for (const kw of profile.allTags) { if (combined.includes(kw)) kwHits++; }
  score += Math.min(0.3, kwHits * 0.05);

  // Category match
  if (profile.allCategories.includes(category)) score += 0.15;

  // No match penalty
  if (matchedSubtopics.length === 0 && !profile.allCategories.includes(category)) score -= 0.2;

  // Curiosity keywords (only relevant for off-topic articles)
  if (persona.curiosityKeywords && matchedSubtopics.length === 0) {
    const hits = persona.curiosityKeywords.filter(kw => combined.includes(kw)).length;
    if (hits >= 2) score += 0.3;
    else if (hits === 1) score += 0.18;
  }

  // Annoyance keywords
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

  // Story repetition (bigram tracking)
  const titleWords = title.split(/\s+/).filter(w => w.length > 3);
  for (let i = 0; i < titleWords.length - 1; i++) {
    const key = titleWords.slice(i, i + 2).join(' ');
    const seen = ctx.storyTracker[key] || 0;
    if (seen >= (persona.repetitionTolerance || 3)) score -= 0.15;
  }

  // AI quality score
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += 0.1;
  else if (aiScore >= 800) score += 0.05;

  // Breaking news boost
  if (/breaking|just in|exclusive/i.test(title)) score += 0.08;

  // Scroll depth fatigue
  const idx = ctx.articleIndex;
  if (idx > 10) score -= 0.03;
  if (idx > 20) score -= 0.05;
  if (idx > 30) score -= 0.08;
  if (idx > 40) score -= 0.1;

  // Mood-based penalty
  if (ctx.mood < 35) score -= 0.08;
  if (ctx.mood < 20) score -= 0.15;

  // Category fatigue
  const catCount = ctx.categorySeen[category] || 0;
  if (catCount >= 6 && matchedSubtopics.length === 0) score -= 0.08;
  if (catCount >= 10) score -= 0.1;

  // Momentum — continuing on same subtopic feels natural
  if (ctx.lastMatchedSubtopics.length > 0 && matchedSubtopics.some(s => ctx.lastMatchedSubtopics.includes(s))) score += 0.1;

  // Skip streak penalty
  if (ctx.consecutiveSkips >= 3) score -= 0.05;
  if (ctx.consecutiveSkips >= 5) score -= 0.08;

  // Random variance for realism
  score += (Math.random() - 0.5) * 0.15;

  const patience = persona.personality.patience;

  if (score >= 0.6) {
    const dwell = (10 + Math.random() * 20) * patience;
    const save = Math.random() < persona.personality.saveRate * 1.5;
    return { action: 'DEEP_READ', dwell, signal: 'ENGAGE', save, matchedSubtopics, score, moodDelta: save ? 7 : 5 };
  }
  if (score >= 0.3) {
    const dwell = (4 + Math.random() * 10) * patience;
    const save = Math.random() < persona.personality.saveRate * 0.5;
    return { action: 'ENGAGE', dwell, signal: 'ENGAGE', save, matchedSubtopics, score, moodDelta: 3 };
  }
  if (score >= 0.05) {
    const dwell = (2 + Math.random() * 3.5) * patience;
    return { action: 'GLANCE', dwell, signal: 'GLANCE', save: false, matchedSubtopics, score, moodDelta: -1 };
  }
  if (score >= -0.1) {
    return { action: 'SCAN', dwell: 1 + Math.random() * 2, signal: 'NEUTRAL', save: false, matchedSubtopics, score, moodDelta: -2.5 };
  }
  const penalty = matchedSubtopics.length === 0 ? -4 : -2;
  return { action: 'SKIP', dwell: 0.3 + Math.random() * 0.7, signal: 'SKIP', save: false, matchedSubtopics, score, moodDelta: penalty };
}

// ============================================================================
// API LAYER
// ============================================================================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`GET timeout after ${HTTP_TIMEOUT_MS}ms: ${url.substring(0, 80)}`)); }, HTTP_TIMEOUT_MS);
    const req = https.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Parse: ' + body.substring(0, 200))); } });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); });
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`POST timeout after ${HTTP_TIMEOUT_MS}ms: ${url.substring(0, 80)}`)); }, HTTP_TIMEOUT_MS);
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + (u.search || ''), method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { clearTimeout(timer); try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); });
    req.write(data);
    req.end();
  });
}

async function fetchFeed(userId, params = {}) {
  let url = `${API_BASE}/api/feed/main?limit=${params.limit || 25}&user_id=${encodeURIComponent(userId)}`;
  if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
  if (params.engagedIds?.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
  if (params.skippedIds?.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
  if (params.seenIds?.length) url += '&seen_ids=' + params.seenIds.slice(-500).join(',');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await httpGet(url);
    } catch (e) {
      if (attempt < 2) {
        console.log(`    [Feed API error: ${e.message}, retrying (${attempt + 1}/3)...]`);
        await sleep(2000 + attempt * 2000);
      } else {
        throw e;
      }
    }
  }
}

async function fetchExplorePage(userId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await httpGet(`${API_BASE}/api/explore/topics?user_id=${encodeURIComponent(userId)}`);
    } catch (e) {
      if (attempt < 2 && e.message.includes('timeout')) {
        console.log(`    [Explore API timeout, retrying (${attempt + 1}/3)...]`);
        await sleep(2000);
        continue;
      }
      throw e;
    }
  }
  return { topics: [] };
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
// SETUP — create user, wipe all history, set SHORT topic IDs
// ============================================================================

async function setupPersona(persona) {
  let userId;

  // Try to create user first; if already exists, update password and find them
  const { data: createData, error: createError } = await adminDb.auth.admin.createUser({
    email: persona.email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `${persona.name} (Learning Test)` },
  });

  if (createError && createError.message.includes('already been registered')) {
    // User exists — find them via paginated listUsers or profile table
    const { data: profileRow } = await adminDb.from('profiles').select('id').eq('email', persona.email).maybeSingle();
    if (profileRow) {
      userId = profileRow.id;
    } else {
      // Fallback: paginate through auth users
      let page = 1;
      while (!userId) {
        const { data: pageData } = await adminDb.auth.admin.listUsers({ page, perPage: 200 });
        if (!pageData?.users?.length) break;
        const found = pageData.users.find(u => u.email === persona.email);
        if (found) { userId = found.id; break; }
        page++;
      }
    }
    if (!userId) { console.error(`  SETUP ERROR ${persona.name}: user exists but ID not found`); return null; }
    // Update password to current PASSWORD so sign-in works
    await adminDb.auth.admin.updateUserById(userId, { password: PASSWORD });
  } else if (createError) {
    console.error(`  SETUP ERROR ${persona.name}: ${createError.message}`);
    return null;
  } else {
    userId = createData.user.id;
    await sleep(600);
  }

  // WIPE EVERYTHING — complete fresh start
  const profileData = {
    email: persona.email,
    full_name: `${persona.name} (Learning Test)`,
    home_country: persona.homeCountry,
    followed_countries: [],
    followed_topics: persona.followedTopics,  // SHORT IDs like the real iOS app
    onboarding_completed: true,
    taste_vector: null,
    taste_vector_minilm: null,
    tag_profile: {},
    skip_profile: {},
    similarity_floor: 0,
    category_profile: null,
    discovery_stats: null,
  };

  const { data: ep } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (ep) await adminDb.from('profiles').update(profileData).eq('id', userId);
  else await adminDb.from('profiles').insert({ id: userId, ...profileData });

  // Wipe event history
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  try { await adminDb.from('user_interests').delete().eq('user_id', userId); } catch {}
  try { await adminDb.from('concept_entities').delete().eq('user_id', userId); } catch {}

  const accessToken = await getAccessToken(persona.email, PASSWORD);
  if (!accessToken) { console.error(`  SIGN-IN ERROR ${persona.name}`); return null; }
  return { userId, accessToken };
}

// ============================================================================
// EXPLORE PAGE EVALUATION
// ============================================================================

function evaluateExplorePage(persona, topics, profile) {
  const personaAllKeywords = new Set([
    ...profile.allTags,
    ...(persona.curiosityKeywords || []),
    ...(persona.headlineTriggers || []),
  ]);
  const personaCategories = new Set(profile.allCategories);

  const results = [];
  for (const topic of topics) {
    const entity = (topic.entity_name || '').toLowerCase();
    const display = (topic.display_title || entity).toLowerCase();
    const cat = (topic.category || '').trim();
    const combined = `${entity} ${display}`;

    let isRelevant = false, matchReason = '';

    if (personaCategories.has(cat)) { isRelevant = true; matchReason = `cat:${cat}`; }

    for (const kw of personaAllKeywords) {
      if (combined.includes(kw)) {
        isRelevant = true;
        matchReason = matchReason ? `${matchReason}+kw:${kw}` : `kw:${kw}`;
        break;
      }
    }

    for (const [stName, stKws] of Object.entries(profile.subtopicKeywords)) {
      if (stKws.some(kw => combined.includes(kw))) {
        isRelevant = true;
        matchReason = matchReason ? `${matchReason}+st:${stName}` : `st:${stName}`;
        break;
      }
    }

    let isAnnoying = false;
    if (persona.annoyanceKeywords) {
      for (const kw of persona.annoyanceKeywords) { if (combined.includes(kw)) { isAnnoying = true; break; } }
    }

    results.push({
      entity: topic.entity_name || entity, display: topic.display_title || entity,
      category: cat, type: topic.type || 'unknown', weight: topic.weight || 0,
      articleCount: (topic.articles || []).length,
      isRelevant, isAnnoying, matchReason: matchReason || 'none',
    });
  }

  const relevant = results.filter(t => t.isRelevant && !t.isAnnoying);
  const personalized = results.filter(t => t.type === 'personalized');
  const personalizedRelevant = personalized.filter(t => t.isRelevant && !t.isAnnoying);

  return {
    topics: results, totalTopics: results.length,
    relevantCount: relevant.length,
    annoyingCount: results.filter(t => t.isAnnoying).length,
    irrelevantCount: results.filter(t => !t.isRelevant && !t.isAnnoying).length,
    personalizedCount: personalized.length,
    trendingCount: results.filter(t => t.type === 'trending').length,
    relevanceScore: results.length > 0 ? (relevant.length / results.length * 100) : 0,
    personalizedRelevance: personalized.length > 0 ? (personalizedRelevant.length / personalized.length * 100) : 0,
    mode: 'unknown',
  };
}

// Evaluate explore page against ONBOARDING profile (not behavior)
function evaluateExploreForOnboarding(persona, topics, onboardingProfile) {
  const onboardingKeywords = new Set(onboardingProfile.allTags);
  const onboardingCategories = new Set(onboardingProfile.allCategories);

  let matchCount = 0;
  for (const topic of topics) {
    const entity = (topic.entity_name || '').toLowerCase();
    const display = (topic.display_title || entity).toLowerCase();
    const cat = (topic.category || '').trim();
    const combined = `${entity} ${display}`;

    let matches = false;
    if (onboardingCategories.has(cat)) matches = true;
    for (const kw of onboardingKeywords) {
      if (combined.includes(kw)) { matches = true; break; }
    }
    if (matches) matchCount++;
  }
  return topics.length > 0 ? (matchCount / topics.length * 100) : 0;
}

// ============================================================================
// FEED READING — read ~50 articles across multiple pages, check explore
// every 20 articles
// ============================================================================

async function readFeedWithExploreChecks(persona, userId, accessToken, profile) {
  const sessionId = `feed_learning_${persona.name.toLowerCase()}_${Date.now()}`;
  const engagedIds = [], skippedIds = [], seenIds = [], interactions = [];
  let cursor = null, totalTracked = 0, pageNum = 0;
  const maxPages = 30;

  const ctx = {
    articleIndex: 0, consecutiveSkips: 0, lastMatchedSubtopics: [],
    mood: STARTING_MOOD, engagedCount: 0, savedCount: 0,
    categorySeen: {}, storyTracker: {},
  };

  // Explore snapshots at checkpoints (after every 20 articles)
  const exploreSnapshots = [];

  // Engagement per window of 10 articles
  const scrollWindows = [];
  let windowInteractions = [];

  // Feed phase buckets: articles 1-20, 21-40, 41-50+
  const phaseBuckets = { early: [], mid: [], late: [] };

  let exitType = 'natural';

  while (pageNum < maxPages && interactions.length < TARGET_ARTICLES) {
    pageNum++;
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) {
      console.log(`    Feed fetch error page ${pageNum}: ${e.message}`);
      break;
    }

    if (!resp.articles || resp.articles.length === 0) {
      console.log(`    No articles returned on page ${pageNum}`);
      break;
    }
    cursor = resp.next_cursor || resp.nextCursor;

    for (const article of resp.articles) {
      if (interactions.length >= TARGET_ARTICLES) break;

      const id = String(article.id);
      if (seenIds.includes(id)) continue;
      seenIds.push(id);

      ctx.articleIndex = interactions.length;
      const category = (article.category || '').trim();
      ctx.categorySeen[category] = (ctx.categorySeen[category] || 0) + 1;

      const reaction = decideEngagement(persona, article, profile, ctx);

      // Update story tracker
      const artTitle = (article.title || article.title_news || '').toLowerCase();
      const artWords = artTitle.split(/\s+/).filter(w => w.length > 3);
      for (let i = 0; i < artWords.length - 1; i++) {
        const key = artWords.slice(i, i + 2).join(' ');
        ctx.storyTracker[key] = (ctx.storyTracker[key] || 0) + 1;
      }

      // Update mood
      ctx.mood = Math.max(0, Math.min(100, ctx.mood + reaction.moodDelta));
      if (ctx.articleIndex > 0 && ctx.articleIndex % 5 === 0) ctx.mood = Math.max(0, ctx.mood - 1.5);
      if (ctx.articleIndex > 20) ctx.mood = Math.max(0, ctx.mood - 0.3);

      // Send events via track API
      // ENGAGE → article_engaged, GLANCE → article_view, SKIP → article_skipped
      const eventType = reaction.signal === 'ENGAGE' ? 'article_engaged'
        : reaction.signal === 'SKIP' ? 'article_skipped'
        : 'article_view';

      const eventData = {
        user_id: userId,
        event_type: eventType,
        article_id: parseInt(id),
        session_id: sessionId,
        metadata: {
          dwell: String(reaction.dwell.toFixed(1)),
          total_active_seconds: String(reaction.dwell.toFixed(1)),
          bucket: article.bucket || 'unknown',
        },
      };
      try { await trackEvent(accessToken, eventData); totalTracked++; } catch {}
      await sleep(DELAY_BETWEEN_EVENTS_MS);

      // If saved, send additional save event
      if (reaction.save) {
        try {
          await trackEvent(accessToken, {
            user_id: userId, event_type: 'article_saved', article_id: parseInt(id),
            session_id: sessionId, metadata: {},
          });
          totalTracked++;
        } catch {}
        await sleep(DELAY_BETWEEN_EVENTS_MS);
      }

      // Update context
      if (reaction.signal === 'ENGAGE') {
        engagedIds.push(id);
        ctx.consecutiveSkips = 0;
        ctx.lastMatchedSubtopics = reaction.matchedSubtopics;
        ctx.engagedCount++;
        if (reaction.save) ctx.savedCount++;
      } else if (reaction.signal === 'SKIP') {
        skippedIds.push(id);
        ctx.consecutiveSkips++;
        ctx.lastMatchedSubtopics = [];
      } else {
        if (reaction.signal !== 'GLANCE') ctx.consecutiveSkips++;
        else ctx.consecutiveSkips = 0;
      }

      const cleanTitle = (article.title || article.title_news || '').substring(0, 60);
      const interaction = {
        num: interactions.length + 1, id, title: cleanTitle, category,
        action: reaction.action, signal: reaction.signal, dwell: reaction.dwell,
        save: reaction.save, mood: Math.round(ctx.mood),
        matchedSubtopics: reaction.matchedSubtopics, score: reaction.score,
        bucket: article.bucket || '-',
        // Store raw article for learning analysis
        _rawArticle: article,
      };
      interactions.push(interaction);
      windowInteractions.push(interaction);

      // Phase bucket assignment
      if (interactions.length <= 20) phaseBuckets.early.push(interaction);
      else if (interactions.length <= 40) phaseBuckets.mid.push(interaction);
      else phaseBuckets.late.push(interaction);

      // Record scroll window every 10 articles
      if (windowInteractions.length >= 10) {
        const wEng = windowInteractions.filter(i => i.signal === 'ENGAGE').length;
        const wRel = windowInteractions.filter(i => i.matchedSubtopics.length > 0).length;
        const wDwell = windowInteractions.reduce((s, i) => s + i.dwell, 0) / windowInteractions.length;
        const wMood = windowInteractions[windowInteractions.length - 1].mood;
        scrollWindows.push({
          windowNum: scrollWindows.length + 1,
          start: windowInteractions[0].num, end: windowInteractions[windowInteractions.length - 1].num,
          engRate: wEng / windowInteractions.length, relevRate: wRel / windowInteractions.length,
          avgDwell: wDwell, endMood: wMood,
          engaged: wEng, total: windowInteractions.length,
        });
        windowInteractions = [];
      }

      // CHECK EXPLORE PAGE every 20 articles
      if (interactions.length % 20 === 0 && interactions.length < TARGET_ARTICLES) {
        console.log(`    [Checkpoint] ${interactions.length} articles read — checking explore page...`);
        await sleep(1500); // Brief wait for backend processing
        try {
          const exploreRaw = await fetchExplorePage(userId);
          const exploreTopics = exploreRaw.topics || [];
          const exploreEval = evaluateExplorePage(persona, exploreTopics, profile);
          exploreEval.mode = exploreRaw.mode || 'unknown';
          exploreSnapshots.push({
            afterArticles: interactions.length,
            eval: exploreEval,
            topTopics: exploreTopics.slice(0, 5).map(t => t.entity_name || t.display_title || 'unknown'),
          });
          console.log(`    Explore at ${interactions.length}: ${exploreEval.totalTopics} topics, ${exploreEval.relevantCount} relevant (${exploreEval.relevanceScore.toFixed(0)}%), mode: ${exploreEval.mode}`);
        } catch (e) {
          console.log(`    Explore check failed at ${interactions.length}: ${e.message}`);
          exploreSnapshots.push({ afterArticles: interactions.length, eval: null, topTopics: [] });
        }
      }

      // Boredom exit conditions (but push harder to reach 50)
      if (interactions.length >= 20) {
        if (ctx.mood <= 12 && interactions.length >= 6) { exitType = 'frustrated'; break; }
        if (ctx.mood <= 22 && ctx.consecutiveSkips >= 5 && interactions.length >= 10) { exitType = 'bored'; break; }
        if (ctx.mood <= 28 && ctx.consecutiveSkips >= 7) { exitType = 'bored'; break; }
        if (ctx.mood <= 25 && interactions.length >= 15 && ctx.engagedCount < interactions.length * 0.15) { exitType = 'disengaged'; break; }
      }
    }

    if (exitType !== 'natural') break;
    if (!cursor) break;
    await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  // Final partial window
  if (windowInteractions.length > 0) {
    const wEng = windowInteractions.filter(i => i.signal === 'ENGAGE').length;
    const wRel = windowInteractions.filter(i => i.matchedSubtopics.length > 0).length;
    const wDwell = windowInteractions.reduce((s, i) => s + i.dwell, 0) / windowInteractions.length;
    const wMood = windowInteractions[windowInteractions.length - 1].mood;
    scrollWindows.push({
      windowNum: scrollWindows.length + 1,
      start: windowInteractions[0].num, end: windowInteractions[windowInteractions.length - 1].num,
      engRate: wEng / windowInteractions.length, relevRate: wRel / windowInteractions.length,
      avgDwell: wDwell, endMood: wMood,
      engaged: wEng, total: windowInteractions.length,
    });
  }

  return {
    interactions, scrollWindows, exploreSnapshots, phaseBuckets,
    exitType, finalMood: Math.round(ctx.mood),
    engagedCount: ctx.engagedCount, savedCount: ctx.savedCount, totalTracked,
  };
}

// ============================================================================
// LEARNING ANALYSIS — per-persona learning metrics
// ============================================================================

function analyzeLearning(persona, feedResult) {
  const ints = feedResult.interactions;
  const onboardingProfile = buildOnboardingProfile(persona);
  const behaviorProfile = buildPersonaProfile(persona);

  // Split into early (1-20) and late (41-50) windows
  const earlyArticles = ints.filter(i => i.num <= 20);
  const lateArticles = ints.filter(i => i.num >= 41);

  function computeMatchRates(articles) {
    if (articles.length === 0) return { onboardingRate: 0, actualRate: 0 };

    let onboardingMatches = 0;
    let actualMatches = 0;

    for (const ix of articles) {
      const article = ix._rawArticle;
      if (!article) continue;

      const onbMatched = matchArticleToOnboarding(article, onboardingProfile);
      const actMatched = matchArticleToSubtopics(article, behaviorProfile);

      if (onbMatched.length > 0) onboardingMatches++;
      if (actMatched.length > 0) actualMatches++;
    }

    return {
      onboardingRate: (onboardingMatches / articles.length) * 100,
      actualRate: (actualMatches / articles.length) * 100,
    };
  }

  const earlyRates = computeMatchRates(earlyArticles);
  const lateRates = computeMatchRates(lateArticles);

  // Did the feed pivot toward actual interests?
  // Pivot = late actual rate increased AND late onboarding rate decreased (or actual > onboarding in late)
  const pivoted = lateArticles.length > 0 &&
    lateRates.actualRate > earlyRates.actualRate + 5 &&
    lateRates.actualRate > lateRates.onboardingRate;

  // Softer pivot: did actual interest match rate increase at all?
  const softPivot = lateArticles.length > 0 &&
    lateRates.actualRate > earlyRates.actualRate;

  // Onboarding decay: did onboarding topic match rate decrease?
  const onboardingDecay = lateArticles.length > 0 &&
    lateRates.onboardingRate < earlyRates.onboardingRate;

  return {
    earlyOnboardingRate: earlyRates.onboardingRate,
    earlyActualRate: earlyRates.actualRate,
    lateOnboardingRate: lateRates.onboardingRate,
    lateActualRate: lateRates.actualRate,
    earlyCount: earlyArticles.length,
    lateCount: lateArticles.length,
    pivoted,
    softPivot,
    onboardingDecay,
    // Shift magnitude
    actualShift: lateRates.actualRate - earlyRates.actualRate,
    onboardingShift: lateRates.onboardingRate - earlyRates.onboardingRate,
  };
}

// ============================================================================
// PERSONA FEEDBACK
// ============================================================================

function generateFeedback(persona, feedResult, exploreBefore, exploreAfter) {
  const ints = feedResult.interactions;
  const total = ints.length;
  const engaged = ints.filter(i => i.signal === 'ENGAGE').length;
  const engRate = total > 0 ? engaged / total : 0;
  const relevant = ints.filter(i => i.matchedSubtopics.length > 0).length;
  const relRate = total > 0 ? relevant / total : 0;
  const mood = feedResult.finalMood;
  const exit = feedResult.exitType;
  const totalDwell = ints.reduce((s, i) => s + i.dwell, 0);
  const avgDwell = total > 0 ? totalDwell / total : 0;

  const ebScore = exploreBefore?.relevanceScore || 0;
  const eaScore = exploreAfter?.relevanceScore || 0;
  const exploreImproved = eaScore > ebScore + 5;
  const exploreDeclined = eaScore < ebScore - 5;

  // Rating 1-10
  let overallRating;
  if (engRate >= 0.5 && mood >= 55) overallRating = Math.min(10, 7 + Math.floor(engRate * 4));
  else if (engRate >= 0.3 && mood >= 40) overallRating = 5 + Math.floor(engRate * 3);
  else if (engRate >= 0.15 && mood >= 25) overallRating = 3 + Math.floor(engRate * 4);
  else overallRating = Math.max(1, Math.floor(engRate * 10 + mood / 30));

  // Best features
  const bestFeatures = [];
  if (relRate >= 0.5) bestFeatures.push('Article relevance to my interests');
  if (engRate >= 0.4) bestFeatures.push('Quality of content matches');
  if (feedResult.savedCount >= 2) bestFeatures.push('Save/bookmark feature');
  if (eaScore >= 40) bestFeatures.push('Explore page topic discovery');
  if (exploreImproved) bestFeatures.push('Personalization improves over time');
  if (feedResult.scrollWindows.length >= 3) {
    const lastW = feedResult.scrollWindows[feedResult.scrollWindows.length - 1];
    const firstW = feedResult.scrollWindows[0];
    if (lastW.engRate > firstW.engRate) bestFeatures.push('Feed gets more relevant as I scroll');
  }
  if (bestFeatures.length === 0) bestFeatures.push('Clean UI and fast loading');

  // Complaints
  const complaints = [];
  const detailedComplaints = [];

  const personaCats = new Set();
  for (const st of persona.subtopics) {
    const stDef = SUBTOPIC_MAP[st];
    if (stDef) stDef.categories.forEach(c => personaCats.add(c));
  }

  const unwantedCatCounts = {};
  const skippedTitles = [];
  const worstArticles = [];
  for (const ix of ints) {
    const c = ix.category || 'Unknown';
    if (!personaCats.has(c) && ix.matchedSubtopics.length === 0) {
      unwantedCatCounts[c] = (unwantedCatCounts[c] || 0) + 1;
    }
    if (ix.action === 'SKIP' && ix.matchedSubtopics.length === 0) {
      skippedTitles.push({ title: ix.title, category: ix.category, score: ix.score });
    }
    if (ix.score < -0.05 && ix.matchedSubtopics.length === 0) {
      worstArticles.push({ title: ix.title, category: ix.category, score: ix.score, dwell: ix.dwell });
    }
  }
  worstArticles.sort((a, b) => a.score - b.score);

  if (relRate < 0.3) complaints.push('Too many articles I don\'t care about');
  if (exit === 'frustrated') complaints.push('Got frustrated and left');
  if (exit === 'bored') complaints.push('Got bored — same stuff kept appearing');
  if (ebScore < 20) complaints.push('Explore page showed irrelevant topics');
  if (eaScore < 20 && ebScore < 20) complaints.push('Explore didn\'t improve with usage');

  const topUnwanted = Object.entries(unwantedCatCounts).sort((a, b) => b[1] - a[1]);
  if (topUnwanted.length > 0) {
    for (const [cat, cnt] of topUnwanted.slice(0, 3)) {
      detailedComplaints.push(`Shown ${cnt} ${cat} article${cnt > 1 ? 's' : ''} but I don't follow ${cat}`);
    }
  }
  if (skippedTitles.length >= 5) {
    detailedComplaints.push(`Skipped ${skippedTitles.length} irrelevant articles (I actually like ${persona.subtopics.slice(0, 2).join(', ')})`);
  }
  if (worstArticles.length > 0) {
    const worst = worstArticles[0];
    detailedComplaints.push(`Worst: "${worst.title}" (${worst.category}) — score ${worst.score.toFixed(2)}, ${worst.dwell.toFixed(1)}s`);
  }

  const catCounts = {};
  for (const ix of ints) { catCounts[ix.category] = (catCounts[ix.category] || 0) + 1; }
  const dominantCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  if (dominantCat && dominantCat[1] >= total * 0.4) {
    detailedComplaints.push(`${dominantCat[1]}/${total} articles were ${dominantCat[0]} — too repetitive`);
  }

  if (avgDwell < 3.5) {
    detailedComplaints.push(`Avg dwell only ${avgDwell.toFixed(1)}s — nothing grabbed attention`);
  }

  if (total < 10 && (exit === 'bored' || exit === 'frustrated')) {
    detailedComplaints.push(`Only made it through ${total} articles — terrible first impression`);
  }

  // Feed evolution complaint
  if (feedResult.phaseBuckets.early.length > 0 && feedResult.phaseBuckets.mid.length > 0) {
    const earlyEng = feedResult.phaseBuckets.early.filter(i => i.signal === 'ENGAGE').length / feedResult.phaseBuckets.early.length;
    const midEng = feedResult.phaseBuckets.mid.filter(i => i.signal === 'ENGAGE').length / feedResult.phaseBuckets.mid.length;
    if (midEng < earlyEng - 0.1) {
      detailedComplaints.push(`Feed got WORSE: eng rate dropped from ${(earlyEng*100).toFixed(0)}% (1-20) to ${(midEng*100).toFixed(0)}% (21-40)`);
    }
  }

  // Missing subtopics
  const matchedSTs = new Set();
  for (const ix of ints) { ix.matchedSubtopics.forEach(st => matchedSTs.add(st)); }
  const missingSTs = persona.subtopics.filter(st => !matchedSTs.has(st));
  if (missingSTs.length > 0) {
    detailedComplaints.push(`Actually interested in ${missingSTs.join(', ')} but saw ZERO matching articles`);
  }

  // Best articles
  const bestArticles = ints.filter(ix => ix.action === 'DEEP_READ' || (ix.action === 'ENGAGE' && ix.save)).slice(0, 3);
  const likedExamples = bestArticles.map(ix => `"${ix.title}" (${ix.dwell.toFixed(1)}s)`);

  // Would recommend
  let wouldRecommend;
  if (overallRating >= 8) wouldRecommend = 'Definitely';
  else if (overallRating >= 6) wouldRecommend = 'Yes, with caveats';
  else if (overallRating >= 4) wouldRecommend = 'Maybe';
  else wouldRecommend = 'Not yet';

  // Personal quote (learning-specific)
  let personalQuote;
  if (engRate >= 0.5 && mood >= 50) {
    personalQuote = `Even though I selected [${persona.followedTopics.join(', ')}] at signup, the feed started showing ${persona.subtopics[0]} which I actually love! Spent ${totalDwell.toFixed(0)}s total.`;
  } else if (relRate >= 0.4 && engRate < 0.3) {
    personalQuote = `Some ${persona.subtopics[0]} articles appeared but not enough. The feed still shows too much from my onboarding topics [${persona.followedTopics.join(', ')}].`;
  } else if (exit === 'frustrated') {
    personalQuote = `I actually want ${persona.subtopics.slice(0, 2).join(' and ')} but the feed kept showing ${persona.followedTopics.join(', ')} content. Left frustrated after ${totalDwell.toFixed(0)}s.`;
  } else if (exit === 'bored') {
    personalQuote = `Feed still stuck on my onboarding choices. I've been engaging with ${persona.subtopics[0]} articles but the algorithm didn't learn.`;
  } else {
    personalQuote = `It's okay — ${engaged}/${total} worth reading, but the feed doesn't seem to learn what I ACTUALLY want (${persona.subtopics.slice(0, 2).join(', ')}).`;
  }

  // Feature requests
  const featureRequests = [];
  if (relRate < 0.4) featureRequests.push('Adapt to my BEHAVIOR not just my onboarding selections');
  if (ebScore < 30) featureRequests.push('Explore page needs to learn from my reading patterns');
  if (missingSTs.length > 0) featureRequests.push(`Show me more ${missingSTs[0]} — I keep engaging with it`);
  if (featureRequests.length === 0) featureRequests.push('Faster learning from my engagement patterns');

  return {
    overallRating, bestFeature: bestFeatures[0], allBestFeatures: bestFeatures,
    topComplaint: complaints[0] || 'Nothing major', allComplaints: complaints,
    detailedComplaints, wouldRecommend, personalQuote, featureRequests,
    feedSatisfaction: mood >= 50 ? 'Satisfied' : mood >= 30 ? 'Neutral' : 'Unsatisfied',
    exploreVerdict: eaScore >= 40 ? 'Good' : eaScore >= 20 ? 'Mediocre' : 'Poor',
    exploreImproved: exploreImproved ? 'Yes' : exploreDeclined ? 'Declined' : 'Same',
    totalDwell, avgDwell, skippedCount: skippedTitles.length, missingSTs, likedExamples,
    worstArticle: worstArticles[0] || null,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const T = '='.repeat(120);
  console.log(T);
  console.log('  50-PERSONA LEARNING TEST');
  console.log(`  - All ${PERSONAS.length} personas start from ZERO (full wipe)`);
  console.log('  - Uses SHORT topic IDs like the real iOS app');
  console.log('  - KEY: onboarding topics DIFFER from actual behavior interests');
  console.log('  - Tests if the algorithm LEARNS from engagement patterns');
  console.log('  - Each reads ~50 articles across multiple pages');
  console.log('  - Explore checked every 20 articles');
  console.log('  - Tracks: does feed pivot from onboarding topics to actual interests?');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(T);

  const allResults = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const profile = buildPersonaProfile(persona);
    const onboardingProfile = buildOnboardingProfile(persona);

    console.log(`\n${'─'.repeat(120)}`);
    console.log(`  [${i + 1}/${PERSONAS.length}] ${persona.name.toUpperCase()}, ${persona.age} — ${persona.location}`);
    console.log(`  ${persona.bio}`);
    console.log(`  Onboarding topics (SHORT IDs): [${persona.followedTopics.join(', ')}]`);
    console.log(`  ACTUAL behavior subtopics:     ${persona.subtopics.join(', ')}`);
    console.log(`  (These are DIFFERENT — testing if the feed learns!)`);
    console.log('─'.repeat(120));

    // ── SETUP ──
    console.log(`    Setting up (wiping all history)...`);
    const setup = await setupPersona(persona);
    if (!setup) { console.log('    FAILED — skipping'); continue; }
    const { userId, accessToken } = setup;
    console.log(`    User: ${userId.substring(0, 8)}... | Onboarding topics: [${persona.followedTopics.join(', ')}] | Actual interests: [${persona.subtopics.join(', ')}]`);

    // ── PHASE 1: Explore BEFORE reading ──
    console.log(`    Phase 1: Explore page BEFORE reading...`);
    let exploreBeforeRaw;
    try { exploreBeforeRaw = await fetchExplorePage(userId); } catch (e) { exploreBeforeRaw = { topics: [] }; }
    const exploreBeforeTopics = exploreBeforeRaw.topics || [];
    const exploreBefore = evaluateExplorePage(persona, exploreBeforeTopics, profile);
    exploreBefore.mode = exploreBeforeRaw.mode || 'unknown';
    const exploreBeforeOnboarding = evaluateExploreForOnboarding(persona, exploreBeforeTopics, onboardingProfile);
    console.log(`    Explore BEFORE: ${exploreBefore.totalTopics} topics | Behavior-relevant: ${exploreBefore.relevantCount} (${exploreBefore.relevanceScore.toFixed(0)}%) | Onboarding-match: ${exploreBeforeOnboarding.toFixed(0)}% | mode: ${exploreBefore.mode}`);

    // ── PHASE 1.5: SEARCH for actual interests ──
    // The user searches for what they ACTUALLY want — this should reshape the feed
    const searchTerms = persona.headlineTriggers.slice(0, 3); // Top 3 triggers as search queries
    console.log(`    Phase 1.5: Searching for actual interests: [${searchTerms.join(', ')}]`);
    for (const query of searchTerms) {
      try {
        await trackEvent(accessToken, {
          user_id: userId,
          event_type: 'search_query',
          metadata: { query },
        });
        console.log(`      Searched: "${query}"`);
        await sleep(200);
      } catch (e) {
        console.log(`      Search failed: ${e.message}`);
      }
    }
    // Wait for tag_profile to update from search signals
    console.log(`    Waiting 3s for search signals to propagate...`);
    await sleep(3000);

    // ── PHASE 2: Read feed with explore checkpoints ──
    console.log(`    Phase 2: Reading feed (target: ${TARGET_ARTICLES} articles)...`);
    const feedResult = await readFeedWithExploreChecks(persona, userId, accessToken, profile);
    const ints = feedResult.interactions;
    const engaged = ints.filter(i => i.signal === 'ENGAGE').length;
    const skipped = ints.filter(i => i.signal === 'SKIP').length;
    const glanced = ints.filter(i => i.action === 'GLANCE').length;
    const relevant = ints.filter(i => i.matchedSubtopics.length > 0).length;

    console.log(`    Read ${ints.length} articles | Engaged: ${engaged} | Glanced: ${glanced} | Skipped: ${skipped} | Relevant: ${relevant}`);
    console.log(`    Exit: ${feedResult.exitType.toUpperCase()} | Mood: ${feedResult.finalMood}/100 | Saved: ${feedResult.savedCount} | Events: ${feedResult.totalTracked}`);

    // ── DETAILED PER-ARTICLE VIEW ──
    console.log(`\n    ARTICLE-BY-ARTICLE:`);
    console.log(`    ${'#'.padEnd(5)} ${'Action'.padEnd(12)} ${'Dwell'.padStart(7)} ${'Mood'.padStart(6)} ${'Score'.padStart(7)} ${'Save'.padStart(6)} ${'Bucket'.padEnd(10)} ${'Category'.padEnd(16)} ${'Matched'.padEnd(30)} Title`);
    console.log(`    ${'─'.repeat(145)}`);
    for (const ix of ints) {
      const matchStr = ix.matchedSubtopics.length > 0 ? ix.matchedSubtopics.join(', ').substring(0, 28) : '(none)';
      console.log(`    ${String(ix.num).padEnd(5)} ${ix.action.padEnd(12)} ${(ix.dwell.toFixed(1)+'s').padStart(7)} ${String(ix.mood).padStart(6)} ${ix.score.toFixed(2).padStart(7)} ${(ix.save ? 'YES' : '').padStart(6)} ${(ix.bucket || '-').padEnd(10)} ${(ix.category || '-').padEnd(16)} ${matchStr.padEnd(30)} ${(ix.title || '').substring(0, 55)}`);
    }

    // Dwell summary
    const dwellByAction = {};
    for (const ix of ints) {
      if (!dwellByAction[ix.action]) dwellByAction[ix.action] = [];
      dwellByAction[ix.action].push(ix.dwell);
    }
    console.log(`\n    DWELL BY ACTION:`);
    for (const [action, dwells] of Object.entries(dwellByAction).sort((a, b) => b[1].length - a[1].length)) {
      const avg = dwells.reduce((s, d) => s + d, 0) / dwells.length;
      console.log(`    ${action.padEnd(12)} Count: ${String(dwells.length).padStart(3)} | Avg: ${avg.toFixed(1).padStart(5)}s | Total: ${dwells.reduce((s, d) => s + d, 0).toFixed(0).padStart(5)}s`);
    }

    // Category breakdown
    const catStats = {};
    for (const ix of ints) {
      const c = ix.category || 'Unknown';
      if (!catStats[c]) catStats[c] = { total: 0, engaged: 0, skipped: 0, dwellSum: 0, relevant: 0 };
      catStats[c].total++;
      if (ix.signal === 'ENGAGE') catStats[c].engaged++;
      if (ix.signal === 'SKIP') catStats[c].skipped++;
      catStats[c].dwellSum += ix.dwell;
      if (ix.matchedSubtopics.length > 0) catStats[c].relevant++;
    }
    console.log(`\n    CATEGORY BREAKDOWN:`);
    console.log(`    ${'Category'.padEnd(18)} ${'Shown'.padStart(6)} ${'Eng'.padStart(5)} ${'Skip'.padStart(6)} ${'Rel'.padStart(5)} ${'AvgDwell'.padStart(9)} ${'Wanted?'.padStart(9)}`);
    console.log(`    ${'─'.repeat(65)}`);
    const personaCats = new Set(profile.allCategories);
    for (const [cat, st] of Object.entries(catStats).sort((a, b) => b[1].total - a[1].total)) {
      console.log(`    ${cat.padEnd(18)} ${String(st.total).padStart(6)} ${String(st.engaged).padStart(5)} ${String(st.skipped).padStart(6)} ${String(st.relevant).padStart(5)} ${(st.dwellSum/st.total).toFixed(1).padStart(8)}s ${(personaCats.has(cat)?'YES':'no').padStart(9)}`);
    }

    // Scroll windows
    if (feedResult.scrollWindows.length > 0) {
      console.log(`\n    ENGAGEMENT OVER SCROLL DEPTH:`);
      console.log(`    ${'Window'.padEnd(18)} ${'Total'.padStart(6)} ${'Eng%'.padStart(8)} ${'Relev%'.padStart(8)} ${'AvgDwell'.padStart(10)} ${'Mood'.padStart(6)}`);
      console.log(`    ${'─'.repeat(60)}`);
      for (const sw of feedResult.scrollWindows) {
        console.log(`    ${(`#${sw.windowNum} (${sw.start}-${sw.end})`).padEnd(18)} ${String(sw.total).padStart(6)} ${(sw.engRate*100).toFixed(0).padStart(7)}% ${(sw.relevRate*100).toFixed(0).padStart(7)}% ${sw.avgDwell.toFixed(1).padStart(9)}s ${String(sw.endMood).padStart(6)}`);
      }
    }

    // Feed evolution by phase
    if (feedResult.phaseBuckets.early.length > 0) {
      console.log(`\n    FEED EVOLUTION BY PHASE:`);
      for (const [phase, label] of [['early','1-20'],['mid','21-40'],['late','41-50+']]) {
        const bucket = feedResult.phaseBuckets[phase];
        if (bucket.length === 0) continue;
        const bEng = bucket.filter(i => i.signal === 'ENGAGE').length;
        const bRel = bucket.filter(i => i.matchedSubtopics.length > 0).length;
        const bDwell = bucket.reduce((s, i) => s + i.dwell, 0) / bucket.length;
        console.log(`    Phase ${label.padEnd(6)} ${String(bucket.length).padStart(3)} articles | Eng: ${(bEng/bucket.length*100).toFixed(0).padStart(3)}% | Rel: ${(bRel/bucket.length*100).toFixed(0).padStart(3)}% | AvgDwell: ${bDwell.toFixed(1)}s | EndMood: ${bucket[bucket.length-1].mood}`);
      }
    }

    // ── LEARNING ANALYSIS (per-persona) ──
    const learning = analyzeLearning(persona, feedResult);
    console.log(`\n    LEARNING ANALYSIS:`);
    console.log(`    Articles 1-20:  Onboarding match: ${learning.earlyOnboardingRate.toFixed(0)}% | Actual interest match: ${learning.earlyActualRate.toFixed(0)}%`);
    console.log(`    Articles 41-50: Onboarding match: ${learning.lateOnboardingRate.toFixed(0)}% | Actual interest match: ${learning.lateActualRate.toFixed(0)}%`);
    console.log(`    Actual shift:   ${learning.actualShift >= 0 ? '+' : ''}${learning.actualShift.toFixed(1)}% | Onboarding shift: ${learning.onboardingShift >= 0 ? '+' : ''}${learning.onboardingShift.toFixed(1)}%`);
    console.log(`    Feed PIVOTED:   ${learning.pivoted ? 'YES — feed learned real interests!' : learning.softPivot ? 'PARTIAL — some movement toward actual interests' : 'NO — feed stuck on onboarding topics'}`);

    // Wait for backend processing
    console.log(`    Waiting 4s for backend profile processing...`);
    await sleep(4000);

    // ── PHASE 3: Final Explore check ──
    console.log(`    Phase 3: Final explore page check...`);
    let exploreAfterRaw;
    try { exploreAfterRaw = await fetchExplorePage(userId); } catch (e) { exploreAfterRaw = { topics: [] }; }
    const exploreAfterTopics = exploreAfterRaw.topics || [];
    const exploreAfter = evaluateExplorePage(persona, exploreAfterTopics, profile);
    exploreAfter.mode = exploreAfterRaw.mode || 'unknown';
    const exploreAfterOnboarding = evaluateExploreForOnboarding(persona, exploreAfterTopics, onboardingProfile);
    console.log(`    Explore AFTER: ${exploreAfter.totalTopics} topics | Behavior-relevant: ${exploreAfter.relevantCount} (${exploreAfter.relevanceScore.toFixed(0)}%) | Onboarding-match: ${exploreAfterOnboarding.toFixed(0)}% | mode: ${exploreAfter.mode}`);

    const expDelta = exploreAfter.relevanceScore - exploreBefore.relevanceScore;
    console.log(`    Explore behavior change: ${exploreBefore.relevanceScore.toFixed(0)}% -> ${exploreAfter.relevanceScore.toFixed(0)}% (${expDelta >= 0 ? '+' : ''}${expDelta.toFixed(0)}%)`);
    const expOnbDelta = exploreAfterOnboarding - exploreBeforeOnboarding;
    console.log(`    Explore onboarding change: ${exploreBeforeOnboarding.toFixed(0)}% -> ${exploreAfterOnboarding.toFixed(0)}% (${expOnbDelta >= 0 ? '+' : ''}${expOnbDelta.toFixed(0)}%)`);

    // Show explore topics AFTER
    if (exploreAfter.topics.length > 0) {
      console.log(`\n    EXPLORE TOPICS (FINAL):`);
      console.log(`    ${'Type'.padEnd(14)} ${'Match'.padEnd(8)} ${'Category'.padEnd(16)} ${'Topic'.padEnd(38)} Arts  Reason`);
      console.log(`    ${'─'.repeat(100)}`);
      for (const t of exploreAfter.topics) {
        const icon = t.isAnnoying ? 'BAD' : t.isRelevant ? 'YES' : 'NO';
        const typeStr = t.type === 'personalized' ? 'Personal' : 'Trending';
        console.log(`    ${typeStr.padEnd(14)} ${icon.padEnd(8)} ${(t.category || '-').padEnd(16)} ${(t.display || t.entity).substring(0, 36).padEnd(38)} ${String(t.articleCount).padStart(4)}  ${t.matchReason.substring(0, 40)}`);
      }
    }

    // ── PHASE 4: Feedback ──
    const feedback = generateFeedback(persona, feedResult, exploreBefore, exploreAfter);

    console.log(`\n    FEEDBACK:`);
    console.log(`    Rating: ${feedback.overallRating}/10 | ${feedback.feedSatisfaction} | Explore: ${feedback.exploreVerdict} (${feedback.exploreImproved})`);
    console.log(`    Session: ${feedback.totalDwell.toFixed(0)}s (${(feedback.totalDwell/60).toFixed(1)} min) | Avg dwell: ${feedback.avgDwell.toFixed(1)}s`);
    console.log(`    Best: ${feedback.bestFeature}`);
    console.log(`    Complaint: ${feedback.topComplaint}`);
    if (feedback.detailedComplaints.length > 0) {
      for (const dc of feedback.detailedComplaints) console.log(`      - ${dc}`);
    }
    if (feedback.missingSTs.length > 0) console.log(`    MISSING: ${feedback.missingSTs.join(', ')}`);
    if (feedback.likedExamples.length > 0) console.log(`    LIKED: ${feedback.likedExamples.join(' | ')}`);
    console.log(`    Recommend: ${feedback.wouldRecommend}`);
    console.log(`    Quote: "${feedback.personalQuote}"`);

    allResults.push({
      persona, profile, onboardingProfile, userId, feedResult, exploreBefore, exploreAfter, feedback, learning,
      exploreBeforeOnboarding, exploreAfterOnboarding,
    });
  }

  // ============================================================================
  // GRAND REPORTS
  // ============================================================================

  console.log(`\n\n${'='.repeat(140)}`);
  console.log(`  GRAND REPORT — 50-PERSONA LEARNING TEST`);
  console.log('='.repeat(140));

  // ── TABLE 1: Per-persona summary ──
  console.log('\n  TABLE 1: PER-PERSONA SUMMARY');
  console.log(`  ${'#'.padEnd(4)} ${'Name'.padEnd(12)} ${'Location'.padEnd(18)} ${'Articles'.padStart(9)} ${'Engaged'.padStart(9)} ${'Skipped'.padStart(9)} ${'Relevant'.padStart(10)} ${'Eng%'.padStart(7)} ${'Rel%'.padStart(7)} ${'Mood'.padStart(6)} ${'Rating'.padStart(8)} ${'Exit'.padStart(13)}`);
  console.log(`  ${'─'.repeat(130)}`);

  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    const ints = r.feedResult.interactions;
    const eng = ints.filter(x => x.signal === 'ENGAGE').length;
    const sk = ints.filter(x => x.signal === 'SKIP').length;
    const rel = ints.filter(x => x.matchedSubtopics.length > 0).length;
    const engRate = ints.length > 0 ? ((eng / ints.length) * 100).toFixed(1) : '0.0';
    const relRate = ints.length > 0 ? ((rel / ints.length) * 100).toFixed(1) : '0.0';
    console.log(`  ${(i+1+'.').padEnd(4)} ${r.persona.name.padEnd(12)} ${r.persona.location.substring(0,16).padEnd(18)} ${String(ints.length).padStart(9)} ${String(eng).padStart(9)} ${String(sk).padStart(9)} ${String(rel).padStart(10)} ${(engRate+'%').padStart(7)} ${(relRate+'%').padStart(7)} ${String(r.feedResult.finalMood).padStart(6)} ${(r.feedback.overallRating+'/10').padStart(8)} ${r.feedResult.exitType.padStart(13)}`);
  }

  // ── TABLE 2: LEARNING ANALYSIS ──
  console.log('\n  TABLE 2: LEARNING ANALYSIS (does the feed learn from behavior?)');
  console.log(`  ${'#'.padEnd(4)} ${'Name'.padEnd(12)} ${'Onb'.padEnd(22)} ${'Actual'.padEnd(28)} ${'1-20 Onb%'.padStart(10)} ${'1-20 Act%'.padStart(10)} ${'41-50 Onb%'.padStart(11)} ${'41-50 Act%'.padStart(11)} ${'Pivoted?'.padStart(10)}`);
  console.log(`  ${'─'.repeat(125)}`);

  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    const l = r.learning;
    const onbStr = r.persona.followedTopics.join(',').substring(0, 20);
    const actStr = r.persona.subtopics.join(',').substring(0, 26);
    const pivotStr = l.pivoted ? 'YES' : l.softPivot ? 'PARTIAL' : 'NO';
    console.log(`  ${(i+1+'.').padEnd(4)} ${r.persona.name.padEnd(12)} ${onbStr.padEnd(22)} ${actStr.padEnd(28)} ${(l.earlyOnboardingRate.toFixed(0)+'%').padStart(10)} ${(l.earlyActualRate.toFixed(0)+'%').padStart(10)} ${(l.lateCount > 0 ? l.lateOnboardingRate.toFixed(0)+'%' : 'N/A').padStart(11)} ${(l.lateCount > 0 ? l.lateActualRate.toFixed(0)+'%' : 'N/A').padStart(11)} ${pivotStr.padStart(10)}`);
  }

  // ── TABLE 3: Explore evolution ──
  console.log('\n  TABLE 3: EXPLORE PAGE EVOLUTION (behavior relevance vs onboarding match)');
  console.log(`  ${'Name'.padEnd(12)} ${'Beh Before'.padStart(12)} ${'Beh After'.padStart(12)} ${'Beh Delta'.padStart(11)} ${'Onb Before'.padStart(12)} ${'Onb After'.padStart(12)} ${'Onb Delta'.padStart(11)} ${'Mode(F)'.padStart(10)} ${'Learned?'.padStart(10)}`);
  console.log(`  ${'─'.repeat(110)}`);

  for (const r of allResults) {
    const behBefore = r.exploreBefore.relevanceScore;
    const behAfter = r.exploreAfter.relevanceScore;
    const behDelta = behAfter - behBefore;
    const onbBefore = r.exploreBeforeOnboarding;
    const onbAfter = r.exploreAfterOnboarding;
    const onbDelta = onbAfter - onbBefore;
    const learned = behDelta > 5 && behAfter > onbAfter ? 'YES' : behDelta > 5 ? 'PARTIAL' : 'NO';
    console.log(`  ${r.persona.name.padEnd(12)} ${(behBefore.toFixed(0)+'%').padStart(12)} ${(behAfter.toFixed(0)+'%').padStart(12)} ${((behDelta>=0?'+':'')+behDelta.toFixed(0)+'%').padStart(11)} ${(onbBefore.toFixed(0)+'%').padStart(12)} ${(onbAfter.toFixed(0)+'%').padStart(12)} ${((onbDelta>=0?'+':'')+onbDelta.toFixed(0)+'%').padStart(11)} ${r.exploreAfter.mode.padStart(10)} ${learned.padStart(10)}`);
  }

  // ── TABLE 4: Feed evolution (engagement rate by phase: 1-20, 21-40, 41-50) ──
  console.log('\n  TABLE 4: FEED EVOLUTION (does engagement rate improve from articles 1-20 vs 21-40 vs 41-50?)');
  console.log(`  ${'Name'.padEnd(12)} ${'1-20 Eng%'.padStart(11)} ${'1-20 Rel%'.padStart(11)} ${'21-40 Eng%'.padStart(12)} ${'21-40 Rel%'.padStart(12)} ${'41-50 Eng%'.padStart(12)} ${'41-50 Rel%'.padStart(12)} ${'Trend'.padStart(10)}`);
  console.log(`  ${'─'.repeat(95)}`);

  for (const r of allResults) {
    const pb = r.feedResult.phaseBuckets;
    const earlyEng = pb.early.length > 0 ? (pb.early.filter(i => i.signal === 'ENGAGE').length / pb.early.length * 100) : 0;
    const earlyRel = pb.early.length > 0 ? (pb.early.filter(i => i.matchedSubtopics.length > 0).length / pb.early.length * 100) : 0;
    const midEng = pb.mid.length > 0 ? (pb.mid.filter(i => i.signal === 'ENGAGE').length / pb.mid.length * 100) : 0;
    const midRel = pb.mid.length > 0 ? (pb.mid.filter(i => i.matchedSubtopics.length > 0).length / pb.mid.length * 100) : 0;
    const lateEng = pb.late.length > 0 ? (pb.late.filter(i => i.signal === 'ENGAGE').length / pb.late.length * 100) : 0;
    const lateRel = pb.late.length > 0 ? (pb.late.filter(i => i.matchedSubtopics.length > 0).length / pb.late.length * 100) : 0;

    let trend = '?';
    if (pb.mid.length > 0) {
      if (midEng > earlyEng + 5) trend = 'IMPROVING';
      else if (midEng < earlyEng - 5) trend = 'DECLINING';
      else trend = 'STABLE';
    } else {
      trend = 'SHORT';
    }

    console.log(`  ${r.persona.name.padEnd(12)} ${(earlyEng.toFixed(0)+'%').padStart(11)} ${(earlyRel.toFixed(0)+'%').padStart(11)} ${(pb.mid.length > 0 ? midEng.toFixed(0)+'%' : 'N/A').padStart(12)} ${(pb.mid.length > 0 ? midRel.toFixed(0)+'%' : 'N/A').padStart(12)} ${(pb.late.length > 0 ? lateEng.toFixed(0)+'%' : 'N/A').padStart(12)} ${(pb.late.length > 0 ? lateRel.toFixed(0)+'%' : 'N/A').padStart(12)} ${trend.padStart(10)}`);
  }

  // ── TABLE 5: Interest category performance ──
  console.log('\n  TABLE 5: ACTUAL INTEREST CATEGORY PERFORMANCE');
  const categoryGroups = {};
  for (const r of allResults) {
    for (const st of r.persona.subtopics) {
      if (!categoryGroups[st]) categoryGroups[st] = [];
      categoryGroups[st].push(r);
    }
  }
  console.log(`  ${'Subtopic'.padEnd(32)} ${'Personas'.padStart(10)} ${'Avg Eng%'.padStart(10)} ${'Avg Mood'.padStart(10)} ${'Avg Rating'.padStart(12)} ${'Explore%'.padStart(10)}`);
  console.log(`  ${'─'.repeat(90)}`);
  for (const [cat, group] of Object.entries(categoryGroups).sort((a, b) => b[1].length - a[1].length)) {
    const avgEng = group.reduce((s, r) => {
      const ints = r.feedResult.interactions;
      return s + (ints.length > 0 ? ints.filter(i => i.signal === 'ENGAGE').length / ints.length : 0);
    }, 0) / group.length;
    const avgMood = group.reduce((s, r) => s + r.feedResult.finalMood, 0) / group.length;
    const avgRating = group.reduce((s, r) => s + r.feedback.overallRating, 0) / group.length;
    const avgExp = group.reduce((s, r) => s + r.exploreAfter.relevanceScore, 0) / group.length;
    console.log(`  ${cat.padEnd(32)} ${String(group.length).padStart(10)} ${((avgEng*100).toFixed(1)+'%').padStart(10)} ${avgMood.toFixed(0).padStart(10)} ${(avgRating.toFixed(1)+'/10').padStart(12)} ${(avgExp.toFixed(0)+'%').padStart(10)}`);
  }

  // ── TABLE 6: What each persona didn't like ──
  console.log('\n  TABLE 6: WHAT EACH PERSONA DIDN\'T LIKE');
  console.log(`  ${'─'.repeat(130)}`);
  for (const r of allResults) {
    const f = r.feedback;
    console.log(`  ${r.persona.name.toUpperCase()} (${f.overallRating}/10, ${f.feedSatisfaction}, onboarding: [${r.persona.followedTopics.join(', ')}], actual: [${r.persona.subtopics.join(', ')}]):`);
    if (f.allComplaints.length > 0) {
      for (const c of f.allComplaints) console.log(`    [General] ${c}`);
    }
    if (f.detailedComplaints.length > 0) {
      for (const dc of f.detailedComplaints) console.log(`    [Specific] ${dc}`);
    }
    if (f.missingSTs.length > 0) {
      console.log(`    [Missing] Actually interested in but never shown: ${f.missingSTs.join(', ')}`);
    }
    if (f.allComplaints.length === 0 && f.detailedComplaints.length === 0) {
      console.log(`    No significant complaints`);
    }
    console.log('');
  }

  // ── TABLE 7: FINAL VERDICT ──
  const avgRating = allResults.reduce((s, r) => s + r.feedback.overallRating, 0) / allResults.length;
  const avgEngRate = allResults.reduce((s, r) => {
    const ints = r.feedResult.interactions;
    return s + (ints.length > 0 ? ints.filter(i => i.signal === 'ENGAGE').length / ints.length : 0);
  }, 0) / allResults.length;
  const avgExpBefore = allResults.reduce((s, r) => s + r.exploreBefore.relevanceScore, 0) / allResults.length;
  const avgExpAfter = allResults.reduce((s, r) => s + r.exploreAfter.relevanceScore, 0) / allResults.length;
  const frustrated = allResults.filter(r => r.feedResult.exitType === 'frustrated').length;
  const bored = allResults.filter(r => r.feedResult.exitType === 'bored' || r.feedResult.exitType === 'disengaged').length;
  const natural = allResults.filter(r => r.feedResult.exitType === 'natural').length;
  const wouldRecommend = allResults.filter(r => r.feedback.overallRating >= 6).length;
  const avgArticles = allResults.reduce((s, r) => s + r.feedResult.interactions.length, 0) / allResults.length;
  const avgTotalDwell = allResults.reduce((s, r) => s + r.feedback.totalDwell, 0) / allResults.length;
  const avgAvgDwell = allResults.reduce((s, r) => s + r.feedback.avgDwell, 0) / allResults.length;
  const totalMissingSTs = allResults.reduce((s, r) => s + r.feedback.missingSTs.length, 0);

  // Feed evolution aggregated
  const allEarlyEng = [], allMidEng = [], allLateEng = [];
  for (const r of allResults) {
    const pb = r.feedResult.phaseBuckets;
    if (pb.early.length > 0) allEarlyEng.push(pb.early.filter(i => i.signal === 'ENGAGE').length / pb.early.length);
    if (pb.mid.length > 0) allMidEng.push(pb.mid.filter(i => i.signal === 'ENGAGE').length / pb.mid.length);
    if (pb.late.length > 0) allLateEng.push(pb.late.filter(i => i.signal === 'ENGAGE').length / pb.late.length);
  }
  const avgEarlyEng = allEarlyEng.length > 0 ? allEarlyEng.reduce((s, v) => s + v, 0) / allEarlyEng.length : 0;
  const avgMidEng = allMidEng.length > 0 ? allMidEng.reduce((s, v) => s + v, 0) / allMidEng.length : 0;
  const avgLateEng = allLateEng.length > 0 ? allLateEng.reduce((s, v) => s + v, 0) / allLateEng.length : 0;

  // ── LEARNING-SPECIFIC METRICS ──
  const pivotedCount = allResults.filter(r => r.learning.pivoted).length;
  const softPivotCount = allResults.filter(r => r.learning.softPivot).length;
  const onboardingDecayCount = allResults.filter(r => r.learning.onboardingDecay).length;
  const resultsWithLate = allResults.filter(r => r.learning.lateCount > 0);

  const avgEarlyOnb = allResults.reduce((s, r) => s + r.learning.earlyOnboardingRate, 0) / allResults.length;
  const avgEarlyAct = allResults.reduce((s, r) => s + r.learning.earlyActualRate, 0) / allResults.length;
  const avgLateOnb = resultsWithLate.length > 0 ? resultsWithLate.reduce((s, r) => s + r.learning.lateOnboardingRate, 0) / resultsWithLate.length : 0;
  const avgLateAct = resultsWithLate.length > 0 ? resultsWithLate.reduce((s, r) => s + r.learning.lateActualRate, 0) / resultsWithLate.length : 0;

  // Explore learning
  const exploreLearnedCount = allResults.filter(r => {
    const behDelta = r.exploreAfter.relevanceScore - r.exploreBefore.relevanceScore;
    return behDelta > 5;
  }).length;

  console.log(`\n  ${'='.repeat(100)}`);
  console.log(`  FINAL VERDICT`);
  console.log(`  ${'='.repeat(100)}`);
  console.log(`  Average rating:              ${avgRating.toFixed(1)}/10`);
  console.log(`  Average engagement rate:     ${(avgEngRate * 100).toFixed(1)}%`);
  console.log(`  Avg articles before exit:    ${avgArticles.toFixed(1)}`);
  console.log(`  Avg session duration:        ${avgTotalDwell.toFixed(0)}s (${(avgTotalDwell / 60).toFixed(1)} min)`);
  console.log(`  Avg dwell per article:       ${avgAvgDwell.toFixed(1)}s`);
  console.log(`  Exit types:                  Natural: ${natural} | Bored: ${bored} | Frustrated: ${frustrated}`);
  console.log(`  Would recommend (>=6/10):    ${wouldRecommend}/${allResults.length} (${((wouldRecommend / allResults.length) * 100).toFixed(0)}%)`);
  console.log(`  Missing subtopics:           ${totalMissingSTs} across ${allResults.filter(r => r.feedback.missingSTs.length > 0).length} personas`);
  console.log(`  Explore BEFORE relevance:    ${avgExpBefore.toFixed(1)}%`);
  console.log(`  Explore AFTER relevance:     ${avgExpAfter.toFixed(1)}%`);
  console.log(`  Explore improved:            ${allResults.filter(r => r.feedback.exploreImproved === 'Yes').length}/${allResults.length}`);
  console.log(`  Feed evolution (avg eng%):   1-20: ${(avgEarlyEng*100).toFixed(1)}% | 21-40: ${(avgMidEng*100).toFixed(1)}% (${allMidEng.length} personas) | 41-50: ${(avgLateEng*100).toFixed(1)}% (${allLateEng.length} personas)`);

  const feedImproving = avgMidEng > avgEarlyEng + 0.03;
  console.log(`  Personalization improving:   ${feedImproving ? 'YES — feed gets better as users read more' : 'NO — feed quality not improving with usage'}`);

  console.log(`\n  ${'─'.repeat(100)}`);
  console.log(`  LEARNING METRICS (the core of this test)`);
  console.log(`  ${'─'.repeat(100)}`);
  console.log(`  Learning score:              ${pivotedCount}/${allResults.length} personas saw feed PIVOT toward actual interests (${((pivotedCount / allResults.length) * 100).toFixed(0)}%)`);
  console.log(`  Soft pivot (any movement):   ${softPivotCount}/${allResults.length} personas (${((softPivotCount / allResults.length) * 100).toFixed(0)}%)`);
  console.log(`  Onboarding decay:            ${onboardingDecayCount}/${allResults.length} personas saw onboarding topic rate decrease`);
  console.log(`  Avg onboarding->actual shift:`);
  console.log(`    Articles 1-20:  Onboarding: ${avgEarlyOnb.toFixed(1)}% | Actual interests: ${avgEarlyAct.toFixed(1)}%`);
  console.log(`    Articles 41-50: Onboarding: ${avgLateOnb.toFixed(1)}% | Actual interests: ${avgLateAct.toFixed(1)}% (${resultsWithLate.length} personas reached this far)`);
  console.log(`    Actual interest shift:     from ${avgEarlyAct.toFixed(1)}% to ${avgLateAct.toFixed(1)}%`);
  console.log(`    Onboarding topic shift:    from ${avgEarlyOnb.toFixed(1)}% to ${avgLateOnb.toFixed(1)}%`);
  console.log(`  Explore learned:             ${exploreLearnedCount}/${allResults.length} personas saw explore page shift toward behavior`);

  // Grade the learning capability
  const learningGrade = pivotedCount / allResults.length;
  if (learningGrade >= 0.5) console.log(`\n  LEARNING GRADE:              A — Algorithm learns from behavior effectively`);
  else if (learningGrade >= 0.3) console.log(`\n  LEARNING GRADE:              B — Algorithm shows some learning ability`);
  else if (learningGrade >= 0.15) console.log(`\n  LEARNING GRADE:              C — Minimal learning detected`);
  else if (learningGrade > 0) console.log(`\n  LEARNING GRADE:              D — Very weak learning`);
  else console.log(`\n  LEARNING GRADE:              F — No learning detected. Feed is stuck on onboarding topics.`);

  if (avgRating >= 7) console.log(`  APP QUALITY:                 EXCELLENT`);
  else if (avgRating >= 5) console.log(`  APP QUALITY:                 GOOD`);
  else if (avgRating >= 3.5) console.log(`  APP QUALITY:                 NEEDS IMPROVEMENT`);
  else console.log(`  APP QUALITY:                 POOR`);

  console.log(`\n  Done at ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

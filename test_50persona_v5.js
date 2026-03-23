import { createClient } from '@supabase/supabase-js';
import https from 'https';

// ============================================================================
// 50-PERSONA FEED + EXPLORE TEST V5
// FIXES from V4:
// - Uses SHORT topic IDs like the real iOS app sends (e.g., "ai", "sports")
// - All 50 diverse personas (20 original + 30 new)
// - All start from ZERO (full wipe)
// - Each persona reads ~50 articles across multiple pages (cursor-based)
// - Explore page checked every 20 articles (before, after 20, after 40, final)
// - Tracks feed evolution: does personalization improve over time?
// - Sends proper events: article_engaged, article_skipped, article_view
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersonaV5_2026!';
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
// 50 PERSONAS — all fresh (zero history), using SHORT topic IDs
// ============================================================================

const PERSONAS = [
  // 1. USA — Tech/AI enthusiast + F1 fan
  {
    name: 'Priya', age: 31, location: 'Austin, TX, USA',
    bio: 'ML engineer at a self-driving car startup. Follows every F1 race. Obsessed with NVIDIA stock. Plays indie games on Steam.',
    email: 'persona_v4_priya@tennews.test', homeCountry: 'usa',
    followedTopics: ['ai', 'f1', 'technology', 'startups'],
    subtopics: ['AI & Machine Learning', 'F1 & Motorsport', 'Robotics & Hardware', 'Startups & Venture Capital'],
    personality: { patience: 0.7, curiosity: 0.75, saveRate: 0.08 },
    curiosityKeywords: ['bizarre', 'discovered', 'billion', 'breakthrough', 'austin', 'texas', 'women in tech', 'self-driving', 'autonomous'],
    annoyanceKeywords: ['celebrity divorce', 'kardashian', 'royal family', 'gossip', 'horoscope'],
    headlineTriggers: ['nvidia', 'openai', 'verstappen', 'hamilton', 'f1', 'tesla autopilot', 'anthropic'],
    repetitionTolerance: 3,
  },
  // 2. Turkey — Soccer + Business
  {
    name: 'Emre', age: 36, location: 'Istanbul, Turkey',
    bio: 'E-commerce founder. Fenerbahce ultra since age 12. Tracks Turkish lira and EU trade. Loves kebab reviews on YouTube.',
    email: 'persona_v4_emre@tennews.test', homeCountry: 'turkiye',
    followedTopics: ['sports', 'business', 'trade'],
    subtopics: ['Soccer/Football', 'Trade & Tariffs', 'Startups & Venture Capital', 'Retail & Consumer'],
    personality: { patience: 0.55, curiosity: 0.65, saveRate: 0.04 },
    curiosityKeywords: ['turkey', 'istanbul', 'lira', 'earthquake', 'founder', 'e-commerce', 'fenerbahce', 'galatasaray'],
    annoyanceKeywords: ['k-pop', 'crypto scam', 'nft', 'metaverse', 'gaming tournament'],
    headlineTriggers: ['fenerbahce', 'turkey', 'champions league', 'trade deal', 'tariff'],
    repetitionTolerance: 3,
  },
  // 3. UK — Climate journalist + Soccer
  {
    name: 'Olivia', age: 28, location: 'Manchester, UK',
    bio: 'Environmental journalist at The Guardian. Manchester United fan. Covers COP summits and green energy policy. Cyclist and vegan.',
    email: 'persona_v4_olivia@tennews.test', homeCountry: 'uk',
    followedTopics: ['climate', 'environment', 'sports', 'science'],
    subtopics: ['Climate & Environment', 'Biology & Nature', 'Soccer/Football', 'Space & Astronomy'],
    personality: { patience: 0.65, curiosity: 0.7, saveRate: 0.06 },
    curiosityKeywords: ['ev', 'electric', 'solar', 'wind', 'battery', 'flooding', 'manchester', 'uk', 'london', 'vegan'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'celebrity gossip', 'meme coin'],
    headlineTriggers: ['man united', 'rashford', 'record temperature', 'wildfire', 'extinction'],
    repetitionTolerance: 3,
  },
  // 4. Germany — Finance + European Politics
  {
    name: 'Klaus', age: 54, location: 'Frankfurt, Germany',
    bio: 'Senior bond trader at Deutsche Bank. Reads Financial Times cover-to-cover. Bayern Munich fan. Follows ECB rate decisions religiously.',
    email: 'persona_v4_klaus@tennews.test', homeCountry: 'germany',
    followedTopics: ['finance', 'economy', 'politics', 'sports'],
    subtopics: ['Stock Markets', 'Banking & Lending', 'European Politics', 'Soccer/Football'],
    personality: { patience: 0.9, curiosity: 0.5, saveRate: 0.10 },
    curiosityKeywords: ['ecb', 'bundesbank', 'germany', 'frankfurt', 'scholz', 'dax', 'european', 'inflation', 'recession'],
    annoyanceKeywords: ['tiktok', 'influencer', 'celebrity', 'gaming', 'k-pop', 'sneakers'],
    headlineTriggers: ['bayern munich', 'ecb', 'fed rate', 'recession', 'euro', 'plunges', 'surges'],
    repetitionTolerance: 5,
  },
  // 5. France — Entertainment + Fashion
  {
    name: 'Amelie', age: 25, location: 'Paris, France',
    bio: 'Fashion design student at Parsons Paris. Lives for Met Gala and Cannes. PSG fan. Follows every A24 release. K-pop stan (BLACKPINK).',
    email: 'persona_v4_amelie@tennews.test', homeCountry: 'france',
    followedTopics: ['entertainment', 'culture', 'sports'],
    subtopics: ['Movies & Film', 'Celebrity Style & Red Carpet', 'K-Pop & K-Drama', 'Soccer/Football', 'Music'],
    personality: { patience: 0.45, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['paris', 'france', 'luxury', 'lvmh', 'gucci', 'dior', 'cannes', 'viral', 'billionaire', 'art'],
    annoyanceKeywords: ['missile', 'troops', 'death toll', 'quarterly results', 'fiscal policy'],
    headlineTriggers: ['blackpink', 'psg', 'mbappe', 'cannes', 'oscar', 'met gala', 'fashion week'],
    repetitionTolerance: 2,
  },
  // 6. India — Cricket + Tech
  {
    name: 'Arjun', age: 29, location: 'Bangalore, India',
    bio: 'Backend engineer at Flipkart. Die-hard RCB cricket fan. Follows Indian startup scene and AI tools. Plays PUBG Mobile competitively.',
    email: 'persona_v4_arjun@tennews.test', homeCountry: 'india',
    followedTopics: ['technology', 'ai', 'sports', 'startups'],
    subtopics: ['AI & Machine Learning', 'Cricket', 'Startups & Venture Capital', 'Gaming', 'Smartphones & Gadgets'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['india', 'bangalore', 'ipl', 'kohli', 'rcb', 'flipkart', 'reliance', 'jio', 'samsung', 'iphone'],
    annoyanceKeywords: ['nfl draft', 'super bowl', 'quarterback', 'hockey', 'baseball'],
    headlineTriggers: ['rcb', 'virat kohli', 'ipl', 'india startup', 'chatgpt', 'nvidia'],
    repetitionTolerance: 3,
  },
  // 7. Brazil — Soccer + Crypto
  {
    name: 'Lucas', age: 27, location: 'Sao Paulo, Brazil',
    bio: 'DeFi trader and Flamengo ultra. Charts bitcoin whale wallets. Follows Vini Jr at Real Madrid. Hosts a Portuguese crypto podcast.',
    email: 'persona_v4_lucas@tennews.test', homeCountry: 'brazil',
    followedTopics: ['crypto', 'sports', 'finance'],
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Soccer/Football', 'Stock Markets'],
    personality: { patience: 0.5, curiosity: 0.65, saveRate: 0.04 },
    curiosityKeywords: ['brazil', 'sao paulo', 'real madrid', 'flamengo', 'vinicius', 'latin america', 'whale', 'algorithm'],
    annoyanceKeywords: ['wellness', 'meditation', 'yoga', 'recipe', 'garden', 'pets'],
    headlineTriggers: ['bitcoin', 'crash', 'real madrid', 'vini jr', 'sec', 'hack', 'exploit'],
    repetitionTolerance: 3,
  },
  // 8. Japan — Tech + Gaming
  {
    name: 'Yuki', age: 23, location: 'Tokyo, Japan',
    bio: 'Game developer at a small Tokyo studio. Follows every Nintendo Direct. Into AI art and VR. Watches anime and follows J-League casually.',
    email: 'persona_v4_yuki@tennews.test', homeCountry: 'japan',
    followedTopics: ['technology', 'entertainment', 'ai'],
    subtopics: ['Gaming', 'AI & Machine Learning', 'Robotics & Hardware', 'Movies & Film'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['japan', 'tokyo', 'nintendo', 'playstation', 'sony', 'anime', 'manga', 'robot', 'vr', 'augmented'],
    annoyanceKeywords: ['policy', 'legislation', 'committee', 'fiscal', 'tariff', 'oil price'],
    headlineTriggers: ['nintendo', 'playstation', 'steam', 'switch', 'openai', 'japan'],
    repetitionTolerance: 2,
  },
  // 9. USA — Politics nerd + NFL
  {
    name: 'Marcus', age: 45, location: 'Washington DC, USA',
    bio: 'Political consultant. Philadelphia Eagles season ticket holder. Reads Politico and The Hill daily. Follows SCOTUS cases obsessively.',
    email: 'persona_v4_marcus@tennews.test', homeCountry: 'usa',
    followedTopics: ['politics', 'sports', 'defense'],
    subtopics: ['US Politics', 'NFL', 'War & Conflict', 'Human Rights & Civil Liberties'],
    personality: { patience: 0.8, curiosity: 0.55, saveRate: 0.07 },
    curiosityKeywords: ['congress', 'senate', 'washington', 'dc', 'election', 'poll', 'swing state', 'virginia', 'veteran'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'fashion week', 'sneakers', 'crypto'],
    headlineTriggers: ['eagles', 'jalen hurts', 'supreme court', 'pentagon', 'classified', 'unprecedented'],
    repetitionTolerance: 5,
  },
  // 10. Canada — Health + NBA
  {
    name: 'Sarah', age: 38, location: 'Toronto, Canada',
    bio: 'Pediatric nurse at SickKids Hospital. Toronto Raptors fan. Follows public health policy and pharma breakthroughs. Mom of two.',
    email: 'persona_v4_sarah@tennews.test', homeCountry: 'canada',
    followedTopics: ['health', 'sports', 'science'],
    subtopics: ['Public Health', 'Medical Breakthroughs', 'NBA', 'Biology & Nature'],
    personality: { patience: 0.7, curiosity: 0.55, saveRate: 0.06 },
    curiosityKeywords: ['canada', 'toronto', 'raptors', 'nurse', 'hospital', 'children', 'parent', 'vaccine', 'food safety', 'education'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'hedge fund', 'derivatives', 'nft'],
    headlineTriggers: ['raptors', 'toronto', 'sickkids', 'clinical trial', 'cure', 'first patient', 'canada'],
    repetitionTolerance: 4,
  },
  // 11. USA — Young sports fan
  {
    name: 'Jaylen', age: 20, location: 'Atlanta, GA, USA',
    bio: 'Georgia Tech sophomore. Lives for NBA and NFL. Atlanta Hawks season ticket holder. Sneakerhead with 80+ pairs. Plays 2K and Madden.',
    email: 'persona_v4_jaylen@tennews.test', homeCountry: 'usa',
    followedTopics: ['sports', 'entertainment'],
    subtopics: ['NBA', 'NFL', 'Gaming', 'Sneakers & Streetwear', 'Boxing & MMA/UFC'],
    personality: { patience: 0.3, curiosity: 0.8, saveRate: 0.02 },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'elon', 'million dollar', 'world record', 'arrest', 'atlanta', 'hawks'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'quarterly', 'fiscal', 'summit', 'infrastructure'],
    headlineTriggers: ['hawks', 'trae young', 'nfl draft', 'ufc', 'jordan', 'nike dunk', 'world record'],
    repetitionTolerance: 2,
  },
  // 12. Australia — Space + Science
  {
    name: 'Mia', age: 33, location: 'Melbourne, Australia',
    bio: 'Astrophysicist at Monash University. Watches every SpaceX launch. Runs a science podcast. Melbourne Victory A-League fan.',
    email: 'persona_v4_mia@tennews.test', homeCountry: 'australia',
    followedTopics: ['space', 'science', 'technology'],
    subtopics: ['Space & Astronomy', 'Space Tech', 'Climate & Environment', 'AI & Machine Learning'],
    personality: { patience: 0.75, curiosity: 0.8, saveRate: 0.09 },
    curiosityKeywords: ['australia', 'melbourne', 'telescope', 'mars', 'asteroid', 'galaxy', 'quantum', 'discovery', 'ancient'],
    annoyanceKeywords: ['celebrity', 'gossip', 'kardashian', 'sneakers', 'fashion', 'red carpet'],
    headlineTriggers: ['spacex', 'nasa', 'james webb', 'starship', 'black hole', 'planet', 'australia'],
    repetitionTolerance: 4,
  },
  // 13. Nigeria — Business + Tech
  {
    name: 'Chidi', age: 30, location: 'Lagos, Nigeria',
    bio: 'Fintech founder building mobile payments for Africa. Follows AI and startups globally. Chelsea FC fan. Reads TechCrunch daily.',
    email: 'persona_v4_chidi@tennews.test', homeCountry: 'nigeria',
    followedTopics: ['startups', 'ai', 'finance', 'sports'],
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Stock Markets', 'Soccer/Football'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['africa', 'nigeria', 'lagos', 'fintech', 'mobile payments', 'chelsea', 'mpesa', 'emerging market', 'billion'],
    annoyanceKeywords: ['nfl', 'super bowl', 'baseball', 'cricket', 'hockey', 'mma'],
    headlineTriggers: ['chelsea', 'unicorn', 'billion valuation', 'series a', 'africa tech', 'openai'],
    repetitionTolerance: 3,
  },
  // 14. South Korea — K-Pop + Tech
  {
    name: 'Jiwon', age: 22, location: 'Seoul, South Korea',
    bio: 'Music production student at SNU. BTS ARMY since 2016. Into AI music tools and Korean gaming scene. Follows Samsung closely.',
    email: 'persona_v4_jiwon@tennews.test', homeCountry: 'south korea',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['K-Pop & K-Drama', 'Music', 'AI & Machine Learning', 'Gaming', 'Smartphones & Gadgets'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.04 },
    curiosityKeywords: ['korea', 'seoul', 'samsung', 'bts', 'blackpink', 'k-drama', 'squid game', 'webtoon', 'aespa'],
    annoyanceKeywords: ['oil price', 'tariff', 'mortgage', 'federal reserve', 'commodity', 'pipeline'],
    headlineTriggers: ['bts', 'samsung', 'k-pop', 'blackpink', 'korean', 'grammy', 'spotify'],
    repetitionTolerance: 2,
  },
  // 15. Switzerland — Diplomacy + Banking
  {
    name: 'Stefan', age: 50, location: 'Zurich, Switzerland',
    bio: 'Private wealth manager at UBS. Former diplomat. Reads The Economist and FT. Follows European politics and watches FC Zurich.',
    email: 'persona_v4_stefan@tennews.test', homeCountry: 'switzerland',
    followedTopics: ['diplomacy', 'finance', 'economy', 'politics'],
    subtopics: ['European Politics', 'Banking & Lending', 'Trade & Tariffs', 'Human Rights & Civil Liberties', 'Stock Markets'],
    personality: { patience: 1.0, curiosity: 0.5, saveRate: 0.12 },
    curiosityKeywords: ['switzerland', 'swiss', 'zurich', 'ubs', 'geneva', 'un', 'imf', 'world bank', 'davos', 'wef'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'sneakers', 'k-pop', 'gaming'],
    headlineTriggers: ['eu', 'nato', 'sanctions', 'swiss', 'historic', 'unprecedented', 'ecb'],
    repetitionTolerance: 6,
  },
  // 16. Mexico — Soccer + Politics
  {
    name: 'Carmen', age: 34, location: 'Mexico City, Mexico',
    bio: 'Political journalist at El Universal. Club America fan. Covers US-Mexico trade and migration. Follows Latin American elections.',
    email: 'persona_v4_carmen@tennews.test', homeCountry: 'mexico',
    followedTopics: ['politics', 'sports', 'trade'],
    subtopics: ['US Politics', 'Latin America', 'Soccer/Football', 'Trade & Tariffs'],
    personality: { patience: 0.65, curiosity: 0.6, saveRate: 0.05 },
    curiosityKeywords: ['mexico', 'border', 'immigration', 'latin america', 'cartel', 'peso', 'nafta', 'usmca', 'club america'],
    annoyanceKeywords: ['k-pop', 'gaming tournament', 'esports', 'anime', 'metaverse'],
    headlineTriggers: ['mexico', 'border wall', 'club america', 'liga mx', 'tariff', 'immigration'],
    repetitionTolerance: 4,
  },
  // 17. UAE — Business + Energy
  {
    name: 'Omar', age: 42, location: 'Dubai, UAE',
    bio: 'Real estate developer in Dubai. Follows oil prices and Gulf business. Al Ahli Dubai fan. Invested in crypto early (2017).',
    email: 'persona_v4_omar@tennews.test', homeCountry: 'uae',
    followedTopics: ['business', 'energy', 'crypto', 'sports'],
    subtopics: ['Real Estate', 'Oil & Energy', 'Bitcoin', 'Soccer/Football', 'Corporate Deals'],
    personality: { patience: 0.65, curiosity: 0.55, saveRate: 0.06 },
    curiosityKeywords: ['dubai', 'uae', 'abu dhabi', 'saudi', 'opec', 'gulf', 'luxury', 'mega project', 'billion deal'],
    annoyanceKeywords: ['wellness', 'mindfulness', 'yoga', 'meditation', 'therapy', 'recipe'],
    headlineTriggers: ['dubai', 'opec', 'oil price', 'bitcoin', 'real estate', 'mega deal', 'saudi'],
    repetitionTolerance: 4,
  },
  // 18. USA — Health professional + Baseball
  {
    name: 'Elena', age: 41, location: 'Boston, MA, USA',
    bio: 'Oncologist at Mass General. Red Sox and Celtics fan. Reads NEJM and Nature. Follows pharma industry and biotech IPOs.',
    email: 'persona_v4_elena@tennews.test', homeCountry: 'usa',
    followedTopics: ['health', 'science', 'sports', 'finance'],
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature', 'NBA', 'MLB/Baseball'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['boston', 'harvard', 'mit', 'cancer', 'oncology', 'biotech', 'fda', 'clinical trial', 'celtics', 'red sox'],
    annoyanceKeywords: ['influencer', 'tiktok dance', 'reality tv', 'gossip', 'celebrity couple'],
    headlineTriggers: ['red sox', 'celtics', 'cure', 'breakthrough', 'first patient', 'fda approval', 'cancer'],
    repetitionTolerance: 4,
  },
  // 19. Sweden — Gaming + AI
  {
    name: 'Erik', age: 24, location: 'Gothenburg, Sweden',
    bio: 'Indie game developer. Streams on Twitch (12K followers). Follows NVIDIA hardware launches. AI art enthusiast. IFK Goteborg fan.',
    email: 'persona_v4_erik@tennews.test', homeCountry: 'sweden',
    followedTopics: ['entertainment', 'technology', 'ai'],
    subtopics: ['Gaming', 'AI & Machine Learning', 'Robotics & Hardware', 'Smartphones & Gadgets'],
    personality: { patience: 0.35, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['sweden', 'gothenburg', 'indie game', 'twitch', 'youtube', 'streamer', 'mars', 'rocket', 'viral'],
    annoyanceKeywords: ['policy', 'legislation', 'committee', 'fiscal', 'tariff', 'trade deal', 'mortgage'],
    headlineTriggers: ['nvidia', 'steam', 'playstation', 'xbox', 'unreal engine', 'amd', 'sweden'],
    repetitionTolerance: 2,
  },
  // 20. UK — Cybersecurity + Defense
  {
    name: 'James', age: 39, location: 'London, UK',
    bio: 'Cybersecurity consultant at Deloitte. Former GCHQ analyst. Arsenal fan. Follows geopolitics and military tech. Reads War on the Rocks.',
    email: 'persona_v4_james@tennews.test', homeCountry: 'uk',
    followedTopics: ['cybersecurity', 'defense', 'politics', 'sports'],
    subtopics: ['Cybersecurity', 'War & Conflict', 'US Politics', 'European Politics', 'Soccer/Football'],
    personality: { patience: 0.7, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['london', 'uk', 'gchq', 'mi5', 'nato', 'drone', 'surveillance', 'intelligence', 'arsenal', 'saka'],
    annoyanceKeywords: ['celebrity', 'fashion', 'gossip', 'influencer', 'sneakers', 'red carpet'],
    headlineTriggers: ['arsenal', 'saka', 'hack', 'data breach', 'ransomware', 'nato', 'classified', 'pentagon'],
    repetitionTolerance: 4,
  },

  // ============================================================================
  // NEW PERSONAS 21-50 (V5)
  // ============================================================================

  // 21. Mexico City — AI researcher + boxing fan
  {
    name: 'Diego', age: 33, location: 'Mexico City, Mexico',
    bio: 'AI researcher at UNAM. Published papers on NLP for Spanish. Canelo Alvarez superfan. Follows OpenAI and Anthropic closely. Listens to corridos.',
    email: 'persona_v5_diego@tennews.test', homeCountry: 'mexico',
    followedTopics: ['ai', 'technology', 'sports'],
    subtopics: ['AI & Machine Learning', 'Boxing & MMA/UFC', 'Robotics & Hardware', 'Startups & Venture Capital'],
    personality: { patience: 0.7, curiosity: 0.8, saveRate: 0.07 },
    curiosityKeywords: ['mexico', 'unam', 'canelo', 'spanish nlp', 'latin america', 'research', 'paper', 'deepmind', 'neural'],
    annoyanceKeywords: ['celebrity gossip', 'kardashian', 'royal family', 'fashion week', 'red carpet'],
    headlineTriggers: ['canelo', 'openai', 'anthropic', 'boxing', 'ai breakthrough', 'mexico', 'ufc'],
    repetitionTolerance: 3,
  },
  // 22. Lagos — Crypto trader + Afrobeats music lover
  {
    name: 'Tunde', age: 26, location: 'Lagos, Nigeria',
    bio: 'Full-time crypto trader since 2021. Huge Burna Boy and Wizkid fan. Runs a Telegram trading group with 5K members. Follows Nigerian Super Eagles.',
    email: 'persona_v5_tunde@tennews.test', homeCountry: 'nigeria',
    followedTopics: ['crypto', 'entertainment', 'sports'],
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Crypto Regulation & Legal', 'Afrobeats', 'Soccer/Football'],
    personality: { patience: 0.45, curiosity: 0.75, saveRate: 0.04 },
    curiosityKeywords: ['nigeria', 'lagos', 'naira', 'burna boy', 'wizkid', 'afrobeats', 'whale', 'binance', 'pump', 'africa'],
    annoyanceKeywords: ['baseball', 'hockey', 'nfl draft', 'yoga', 'meditation', 'gardening'],
    headlineTriggers: ['bitcoin', 'ethereum', 'burna boy', 'wizkid', 'nigeria', 'sec crypto', 'super eagles'],
    repetitionTolerance: 2,
  },
  // 23. Mumbai — Bollywood + Cricket + Business
  {
    name: 'Rohan', age: 35, location: 'Mumbai, India',
    bio: 'Investment banker at HDFC. Mumbai Indians cricket fanatic. Watches every Bollywood release. Follows Indian stock markets and Ambani empire.',
    email: 'persona_v5_rohan@tennews.test', homeCountry: 'india',
    followedTopics: ['business', 'sports', 'entertainment', 'finance'],
    subtopics: ['Cricket', 'Bollywood', 'Stock Markets', 'Corporate Deals', 'Corporate Earnings'],
    personality: { patience: 0.65, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['india', 'mumbai', 'bollywood', 'ipl', 'sensex', 'nifty', 'ambani', 'tata', 'reliance', 'mumbai indians'],
    annoyanceKeywords: ['k-pop', 'nfl', 'super bowl', 'hockey', 'cannabis', 'metaverse'],
    headlineTriggers: ['mumbai indians', 'ipl', 'shah rukh khan', 'sensex', 'reliance', 'bollywood', 'india'],
    repetitionTolerance: 4,
  },
  // 24. Berlin — Climate activist + European politics
  {
    name: 'Lena', age: 30, location: 'Berlin, Germany',
    bio: 'Climate policy advisor at Fridays for Future Germany. Follows EU green deal and German coalition politics. Loves cycling and Berlin techno.',
    email: 'persona_v5_lena@tennews.test', homeCountry: 'germany',
    followedTopics: ['climate', 'politics', 'environment', 'energy'],
    subtopics: ['Climate & Environment', 'European Politics', 'Biology & Nature', 'Oil & Energy'],
    personality: { patience: 0.7, curiosity: 0.7, saveRate: 0.08 },
    curiosityKeywords: ['berlin', 'germany', 'green deal', 'emissions', 'renewable', 'solar', 'wind farm', 'eu', 'scholz', 'greta'],
    annoyanceKeywords: ['crypto', 'nft', 'celebrity', 'gossip', 'meme coin', 'sneakers', 'reality tv'],
    headlineTriggers: ['climate', 'emissions record', 'eu green deal', 'germany', 'cop summit', 'berlin', 'wildfire'],
    repetitionTolerance: 4,
  },
  // 25. Singapore — Finance + AI + F1
  {
    name: 'Wei Lin', age: 37, location: 'Singapore',
    bio: 'Quantitative analyst at DBS Bank. Builds AI trading models. Attends Singapore GP every year. Follows Fed and BOJ rate decisions.',
    email: 'persona_v5_weilin@tennews.test', homeCountry: 'singapore',
    followedTopics: ['finance', 'ai', 'f1', 'economy'],
    subtopics: ['Stock Markets', 'AI & Machine Learning', 'F1 & Motorsport', 'Banking & Lending'],
    personality: { patience: 0.8, curiosity: 0.65, saveRate: 0.09 },
    curiosityKeywords: ['singapore', 'asean', 'dbs', 'quant', 'algorithm', 'fed', 'boj', 'yen', 'grand prix', 'hedge fund'],
    annoyanceKeywords: ['celebrity', 'gossip', 'reality tv', 'sneakers', 'fashion', 'pets'],
    headlineTriggers: ['singapore gp', 'f1', 'verstappen', 'fed rate', 'nasdaq', 'openai', 'singapore'],
    repetitionTolerance: 5,
  },
  // 26. Cairo — Middle East politics + Soccer
  {
    name: 'Ahmed', age: 40, location: 'Cairo, Egypt',
    bio: 'Foreign affairs columnist for Al-Ahram newspaper. Al Ahly SC ultra. Covers Iran nuclear talks and Gulf diplomacy. Speaks Arabic and English.',
    email: 'persona_v5_ahmed@tennews.test', homeCountry: 'egypt',
    followedTopics: ['politics', 'sports', 'diplomacy'],
    subtopics: ['Middle East', 'Soccer/Football', 'US Politics', 'Human Rights & Civil Liberties'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.06 },
    curiosityKeywords: ['egypt', 'cairo', 'suez', 'al ahly', 'arab', 'iran', 'israel', 'saudi', 'gaza', 'hezbollah'],
    annoyanceKeywords: ['k-pop', 'gaming', 'anime', 'sneakers', 'tiktok', 'crypto scam'],
    headlineTriggers: ['al ahly', 'egypt', 'middle east', 'iran', 'gaza', 'ceasefire', 'champions league africa'],
    repetitionTolerance: 5,
  },
  // 27. Vancouver — Health/wellness + NBA
  {
    name: 'Jasmine', age: 32, location: 'Vancouver, Canada',
    bio: 'Registered dietitian and wellness blogger. Huge Vancouver Canucks and NBA fan. Follows mental health research and holistic medicine.',
    email: 'persona_v5_jasmine@tennews.test', homeCountry: 'canada',
    followedTopics: ['health', 'sports', 'science'],
    subtopics: ['Wellness & Fitness', 'Mental Health', 'NBA', 'Public Health'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['vancouver', 'canada', 'wellness', 'nutrition', 'diet', 'mindfulness', 'self-care', 'nba', 'canucks'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'military', 'war', 'drone strike', 'tariff'],
    headlineTriggers: ['nba', 'lebron', 'mental health', 'wellness', 'diet study', 'vancouver', 'canucks'],
    repetitionTolerance: 3,
  },
  // 28. Stockholm — Gaming + AI + Space
  {
    name: 'Axel', age: 26, location: 'Stockholm, Sweden',
    bio: 'Game designer at DICE/EA Stockholm. Space nerd who follows every NASA and ESA mission. Uses AI tools for game design. Watches Allsvenskan.',
    email: 'persona_v5_axel@tennews.test', homeCountry: 'sweden',
    followedTopics: ['entertainment', 'ai', 'space', 'technology'],
    subtopics: ['Gaming', 'AI & Machine Learning', 'Space & Astronomy', 'Space Tech'],
    personality: { patience: 0.45, curiosity: 0.9, saveRate: 0.04 },
    curiosityKeywords: ['stockholm', 'sweden', 'dice', 'battlefield', 'esa', 'rocket', 'mars colony', 'indie game', 'vr'],
    annoyanceKeywords: ['tariff', 'mortgage', 'real estate', 'oil price', 'banking', 'fiscal policy'],
    headlineTriggers: ['spacex', 'nasa', 'starship', 'steam', 'unreal engine', 'nvidia', 'james webb'],
    repetitionTolerance: 2,
  },
  // 29. Buenos Aires — Soccer + Economy + Politics
  {
    name: 'Mateo', age: 38, location: 'Buenos Aires, Argentina',
    bio: 'Economics professor at UBA. Boca Juniors ultras. Analyzes Argentine peso crisis and IMF relations. Follows Messi religiously.',
    email: 'persona_v5_mateo@tennews.test', homeCountry: 'argentina',
    followedTopics: ['sports', 'economy', 'politics'],
    subtopics: ['Soccer/Football', 'Banking & Lending', 'Latin America', 'Trade & Tariffs'],
    personality: { patience: 0.6, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['argentina', 'buenos aires', 'boca juniors', 'messi', 'peso', 'imf', 'milei', 'inflation', 'south america'],
    annoyanceKeywords: ['k-pop', 'anime', 'gaming tournament', 'celebrity gossip', 'fashion week'],
    headlineTriggers: ['messi', 'boca juniors', 'argentina', 'imf', 'peso', 'latin america', 'copa libertadores'],
    repetitionTolerance: 4,
  },
  // 30. Dubai — Oil/energy + Real estate + F1
  {
    name: 'Rashid', age: 44, location: 'Dubai, UAE',
    bio: 'Managing director at an Abu Dhabi sovereign wealth fund. F1 paddock regular at Abu Dhabi GP. Follows OPEC and Gulf mega-projects.',
    email: 'persona_v5_rashid@tennews.test', homeCountry: 'uae',
    followedTopics: ['energy', 'business', 'f1', 'finance'],
    subtopics: ['Oil & Energy', 'Real Estate', 'F1 & Motorsport', 'Corporate Deals'],
    personality: { patience: 0.8, curiosity: 0.5, saveRate: 0.08 },
    curiosityKeywords: ['dubai', 'abu dhabi', 'uae', 'opec', 'sovereign wealth', 'aramco', 'neom', 'gulf', 'billion deal'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'anime', 'sneakers', 'tiktok', 'cannabis'],
    headlineTriggers: ['opec', 'oil price', 'f1', 'abu dhabi gp', 'dubai', 'mega project', 'aramco'],
    repetitionTolerance: 5,
  },
  // 31. Tokyo — Robotics + AI + Gaming (different from Yuki)
  {
    name: 'Haruto', age: 28, location: 'Tokyo, Japan',
    bio: 'Robotics engineer at Fanuc. Builds industrial automation systems. Plays competitive Valorant. Follows Honda ASIMO and Boston Dynamics.',
    email: 'persona_v5_haruto@tennews.test', homeCountry: 'japan',
    followedTopics: ['technology', 'ai', 'entertainment'],
    subtopics: ['Robotics & Hardware', 'AI & Machine Learning', 'Gaming', 'Smartphones & Gadgets'],
    personality: { patience: 0.55, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['japan', 'tokyo', 'robot', 'fanuc', 'boston dynamics', 'automation', 'semiconductor', 'valorant', 'esports'],
    annoyanceKeywords: ['celebrity', 'gossip', 'royal family', 'fashion', 'red carpet', 'reality tv'],
    headlineTriggers: ['robot', 'nvidia', 'chip', 'semiconductor', 'japan', 'boston dynamics', 'valorant'],
    repetitionTolerance: 3,
  },
  // 32. London — Finance/Banking + Soccer + Politics
  {
    name: 'Charlotte', age: 43, location: 'London, UK',
    bio: 'Managing director at Barclays investment banking. Tottenham season ticket holder. Follows UK politics and Bank of England closely.',
    email: 'persona_v5_charlotte@tennews.test', homeCountry: 'uk',
    followedTopics: ['finance', 'sports', 'politics', 'economy'],
    subtopics: ['Banking & Lending', 'Stock Markets', 'Soccer/Football', 'European Politics'],
    personality: { patience: 0.85, curiosity: 0.5, saveRate: 0.09 },
    curiosityKeywords: ['london', 'uk', 'barclays', 'bank of england', 'ftse', 'gilt', 'starmer', 'tottenham', 'spurs'],
    annoyanceKeywords: ['gaming', 'anime', 'k-pop', 'tiktok', 'influencer', 'sneakers', 'meme coin'],
    headlineTriggers: ['tottenham', 'son heung-min', 'bank of england', 'ftse', 'uk election', 'london', 'barclays'],
    repetitionTolerance: 5,
  },
  // 33. Sydney — Cricket + Climate + Science
  {
    name: 'Liam', age: 31, location: 'Sydney, Australia',
    bio: 'Marine biologist at CSIRO. Die-hard Sydney Sixers cricket fan. Studies coral reef decline on Great Barrier Reef. Science communicator.',
    email: 'persona_v5_liam@tennews.test', homeCountry: 'australia',
    followedTopics: ['science', 'climate', 'sports', 'environment'],
    subtopics: ['Climate & Environment', 'Biology & Nature', 'Cricket', 'Earth Science'],
    personality: { patience: 0.7, curiosity: 0.75, saveRate: 0.07 },
    curiosityKeywords: ['australia', 'sydney', 'reef', 'coral', 'ocean', 'csiro', 'ashes', 'cricket', 'marine', 'wildfire'],
    annoyanceKeywords: ['crypto', 'nft', 'celebrity', 'gossip', 'fashion', 'sneakers', 'meme coin'],
    headlineTriggers: ['great barrier reef', 'australia', 'ashes', 'ipl', 'climate record', 'coral', 'wildfire'],
    repetitionTolerance: 4,
  },
  // 34. Toronto — Hockey/Sports + Tech startups
  {
    name: 'Ryan', age: 29, location: 'Toronto, Canada',
    bio: 'Product manager at Shopify. Toronto Maple Leafs die-hard. Follows Canadian tech scene and Y Combinator startups. Fantasy hockey commissioner.',
    email: 'persona_v5_ryan@tennews.test', homeCountry: 'canada',
    followedTopics: ['technology', 'startups', 'sports'],
    subtopics: ['Startups & Venture Capital', 'Hockey', 'AI & Machine Learning', 'Smartphones & Gadgets'],
    personality: { patience: 0.55, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['toronto', 'canada', 'shopify', 'maple leafs', 'y combinator', 'series a', 'saas', 'hockey', 'nhl'],
    annoyanceKeywords: ['celebrity', 'gossip', 'fashion', 'red carpet', 'reality tv', 'horoscope'],
    headlineTriggers: ['maple leafs', 'shopify', 'y combinator', 'toronto', 'startup', 'stanley cup'],
    repetitionTolerance: 3,
  },
  // 35. Seoul — K-pop + Entertainment + Tech
  {
    name: 'Minji', age: 21, location: 'Seoul, South Korea',
    bio: 'K-pop dance cover creator with 200K followers on TikTok. BLACKPINK and NewJeans stan. Studies media at Yonsei. Tests every new Samsung phone.',
    email: 'persona_v5_minji@tennews.test', homeCountry: 'south korea',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['K-Pop & K-Drama', 'Music', 'Social Media', 'Smartphones & Gadgets'],
    personality: { patience: 0.3, curiosity: 0.9, saveRate: 0.03 },
    curiosityKeywords: ['korea', 'seoul', 'blackpink', 'newjeans', 'bts', 'samsung galaxy', 'tiktok', 'viral', 'kpop'],
    annoyanceKeywords: ['oil price', 'tariff', 'mortgage', 'fiscal policy', 'committee', 'defense budget'],
    headlineTriggers: ['blackpink', 'newjeans', 'samsung', 'k-pop', 'grammy', 'spotify record', 'korean'],
    repetitionTolerance: 2,
  },
  // 36. Nairobi — Business + Mobile tech + Soccer
  {
    name: 'Wanjiku', age: 34, location: 'Nairobi, Kenya',
    bio: 'CEO of a mobile payments startup in Kenya. Follows M-Pesa ecosystem and African tech scene. Gor Mahia fan. Reads The Economist Africa.',
    email: 'persona_v5_wanjiku@tennews.test', homeCountry: 'kenya',
    followedTopics: ['business', 'technology', 'sports', 'startups'],
    subtopics: ['Mobile Tech', 'Startups & Venture Capital', 'Soccer/Football', 'Trade & Tariffs'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.06 },
    curiosityKeywords: ['kenya', 'nairobi', 'mpesa', 'safaricom', 'africa', 'mobile money', 'fintech', 'gor mahia', 'east africa'],
    annoyanceKeywords: ['nfl', 'baseball', 'hockey', 'anime', 'k-pop', 'metaverse'],
    headlineTriggers: ['kenya', 'africa tech', 'mpesa', 'startup', 'mobile payments', 'champions league africa'],
    repetitionTolerance: 3,
  },
  // 37. Moscow (expat in Tbilisi) — Cybersecurity + Geopolitics
  {
    name: 'Alexei', age: 36, location: 'Tbilisi, Georgia',
    bio: 'Russian cybersecurity researcher who relocated to Tbilisi in 2022. Tracks state-sponsored hacking groups. Follows Russia-NATO dynamics. Chess player.',
    email: 'persona_v5_alexei@tennews.test', homeCountry: 'georgia',
    followedTopics: ['cybersecurity', 'politics', 'defense', 'technology'],
    subtopics: ['Cybersecurity', 'War & Conflict', 'European Politics', 'US Politics'],
    personality: { patience: 0.75, curiosity: 0.65, saveRate: 0.07 },
    curiosityKeywords: ['russia', 'georgia', 'tbilisi', 'nato', 'ukraine', 'cyber', 'hacking', 'kremlin', 'sanctions', 'chess'],
    annoyanceKeywords: ['celebrity', 'fashion', 'k-pop', 'influencer', 'sneakers', 'tiktok dance'],
    headlineTriggers: ['ransomware', 'data breach', 'nato', 'russia', 'ukraine', 'cyber attack', 'state-sponsored'],
    repetitionTolerance: 5,
  },
  // 38. Amsterdam — Cannabis industry/Lifestyle + Soccer + Trade
  {
    name: 'Daan', age: 31, location: 'Amsterdam, Netherlands',
    bio: 'Cannabis industry consultant and policy advisor. Ajax Amsterdam season ticket holder. Follows EU trade policy and Dutch politics. Craft beer enthusiast.',
    email: 'persona_v5_daan@tennews.test', homeCountry: 'netherlands',
    followedTopics: ['business', 'sports', 'trade', 'politics'],
    subtopics: ['Cannabis Industry', 'Soccer/Football', 'Trade & Tariffs', 'European Politics'],
    personality: { patience: 0.55, curiosity: 0.7, saveRate: 0.04 },
    curiosityKeywords: ['amsterdam', 'netherlands', 'dutch', 'ajax', 'cannabis', 'legal', 'eu trade', 'rotterdam', 'port'],
    annoyanceKeywords: ['nfl', 'baseball', 'cricket', 'k-pop', 'anime', 'bollywood'],
    headlineTriggers: ['ajax', 'cannabis', 'netherlands', 'eu trade', 'champions league', 'amsterdam', 'dutch'],
    repetitionTolerance: 3,
  },
  // 39. Riyadh — Oil/Energy + Defense + Sports
  {
    name: 'Khalid', age: 46, location: 'Riyadh, Saudi Arabia',
    bio: 'Senior advisor at Saudi Aramco. Follows OPEC+ decisions, defense procurement, and Saudi Vision 2030. Al Hilal fan since the Ronaldo signing.',
    email: 'persona_v5_khalid@tennews.test', homeCountry: 'saudi arabia',
    followedTopics: ['energy', 'defense', 'business', 'sports'],
    subtopics: ['Oil & Energy', 'Defense & Military Tech', 'Corporate Deals', 'Soccer/Football'],
    personality: { patience: 0.8, curiosity: 0.5, saveRate: 0.08 },
    curiosityKeywords: ['saudi', 'riyadh', 'aramco', 'vision 2030', 'opec', 'neom', 'al hilal', 'ronaldo', 'defense', 'arms deal'],
    annoyanceKeywords: ['k-pop', 'gaming', 'anime', 'tiktok', 'influencer', 'cannabis'],
    headlineTriggers: ['aramco', 'opec', 'saudi', 'al hilal', 'ronaldo', 'arms deal', 'defense contract'],
    repetitionTolerance: 5,
  },
  // 40. Lisbon — Digital nomad, startups + crypto + culture
  {
    name: 'Sofia', age: 28, location: 'Lisbon, Portugal',
    bio: 'Digital nomad running a crypto-native SaaS startup from Lisbon. Attends Web Summit every year. Loves Portuguese culture and surf. Follows Benfica.',
    email: 'persona_v5_sofia@tennews.test', homeCountry: 'portugal',
    followedTopics: ['startups', 'crypto', 'culture', 'technology'],
    subtopics: ['Startups & Venture Capital', 'Bitcoin', 'DeFi & Web3', 'Digital Nomad & Culture'],
    personality: { patience: 0.5, curiosity: 0.8, saveRate: 0.05 },
    curiosityKeywords: ['lisbon', 'portugal', 'web summit', 'benfica', 'digital nomad', 'remote work', 'coworking', 'europe', 'surf'],
    annoyanceKeywords: ['nfl', 'baseball', 'cricket', 'bollywood', 'oil pipeline', 'mortgage'],
    headlineTriggers: ['web summit', 'bitcoin', 'startup', 'lisbon', 'benfica', 'crypto', 'remote work'],
    repetitionTolerance: 3,
  },
  // 41. Chicago — NBA + NFL + Hip-hop music
  {
    name: 'DeAndre', age: 24, location: 'Chicago, IL, USA',
    bio: 'Music producer and aspiring rapper from South Side. Chicago Bulls and Bears die-hard. Follows hip-hop beef and album drops. Sells beats online.',
    email: 'persona_v5_deandre@tennews.test', homeCountry: 'usa',
    followedTopics: ['sports', 'entertainment'],
    subtopics: ['NBA', 'NFL', 'Hip-Hop & Rap', 'Music'],
    personality: { patience: 0.35, curiosity: 0.8, saveRate: 0.03 },
    curiosityKeywords: ['chicago', 'bulls', 'bears', 'drake', 'kendrick', 'rap beef', 'album drop', 'grammy', 'viral', 'south side'],
    annoyanceKeywords: ['tariff', 'fiscal policy', 'committee', 'mortgage', 'ecb', 'trade deal'],
    headlineTriggers: ['bulls', 'bears', 'drake', 'kendrick lamar', 'nfl draft', 'nba playoffs', 'hip-hop'],
    repetitionTolerance: 2,
  },
  // 42. Manila — Entertainment + K-pop + Social media
  {
    name: 'Bea', age: 23, location: 'Manila, Philippines',
    bio: 'Social media manager for a fashion brand. BTS and BLACKPINK stan. Follows Filipino and K-drama entertainment. TikTok content creator (50K followers).',
    email: 'persona_v5_bea@tennews.test', homeCountry: 'philippines',
    followedTopics: ['entertainment', 'culture', 'technology'],
    subtopics: ['K-Pop & K-Drama', 'Social Media', 'Music', 'Celebrity News'],
    personality: { patience: 0.35, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['philippines', 'manila', 'bts', 'blackpink', 'k-drama', 'tiktok', 'viral', 'influencer', 'netflix'],
    annoyanceKeywords: ['oil price', 'tariff', 'defense budget', 'fiscal policy', 'mortgage', 'pipeline'],
    headlineTriggers: ['bts', 'blackpink', 'k-pop', 'netflix', 'tiktok', 'viral', 'philippines'],
    repetitionTolerance: 2,
  },
  // 43. Zurich — Pharma/biotech + Finance + Science
  {
    name: 'Lukas', age: 48, location: 'Zurich, Switzerland',
    bio: 'Chief scientific officer at a Novartis spin-off biotech. Follows FDA approvals and pharma M&A. FC Basel fan. Reads Nature and Lancet.',
    email: 'persona_v5_lukas@tennews.test', homeCountry: 'switzerland',
    followedTopics: ['health', 'finance', 'science', 'business'],
    subtopics: ['Pharma & Drug Industry', 'Medical Breakthroughs', 'Stock Markets', 'Biology & Nature'],
    personality: { patience: 0.85, curiosity: 0.6, saveRate: 0.10 },
    curiosityKeywords: ['zurich', 'swiss', 'novartis', 'roche', 'fda', 'biotech', 'clinical trial', 'pharma', 'fc basel'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'sneakers', 'k-pop', 'tiktok'],
    headlineTriggers: ['fda approval', 'novartis', 'roche', 'biotech ipo', 'clinical trial', 'cancer', 'zurich'],
    repetitionTolerance: 5,
  },
  // 44. Houston — Space tech + Oil/Energy + NFL
  {
    name: 'Travis', age: 36, location: 'Houston, TX, USA',
    bio: 'Aerospace engineer at NASA Johnson Space Center. Houston Texans season ticket holder. Family works in oil industry. Follows SpaceX and Blue Origin.',
    email: 'persona_v5_travis@tennews.test', homeCountry: 'usa',
    followedTopics: ['space', 'energy', 'sports', 'technology'],
    subtopics: ['Space Tech', 'Space & Astronomy', 'Oil & Energy', 'NFL'],
    personality: { patience: 0.7, curiosity: 0.65, saveRate: 0.07 },
    curiosityKeywords: ['houston', 'texas', 'nasa', 'johnson space center', 'spacex', 'artemis', 'oil', 'texans', 'rocket'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'fashion week', 'influencer', 'reality tv'],
    headlineTriggers: ['spacex', 'nasa', 'houston texans', 'starship', 'oil price', 'artemis', 'blue origin'],
    repetitionTolerance: 4,
  },
  // 45. Bangalore — Startups + AI + Cricket (different from Arjun)
  {
    name: 'Kavya', age: 27, location: 'Bangalore, India',
    bio: 'Co-founder of an AI health-tech startup. YC alumni. Royal Challengers Bangalore cricket fan. Mentors women founders in India.',
    email: 'persona_v5_kavya@tennews.test', homeCountry: 'india',
    followedTopics: ['startups', 'ai', 'sports', 'health'],
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Cricket', 'Medical Breakthroughs'],
    personality: { patience: 0.6, curiosity: 0.75, saveRate: 0.06 },
    curiosityKeywords: ['bangalore', 'india', 'y combinator', 'women founders', 'rcb', 'health tech', 'series a', 'ipl', 'unicorn'],
    annoyanceKeywords: ['nfl', 'baseball', 'hockey', 'celebrity gossip', 'reality tv', 'cannabis'],
    headlineTriggers: ['rcb', 'ipl', 'y combinator', 'india startup', 'openai', 'ai health', 'women in tech'],
    repetitionTolerance: 3,
  },
  // 46. Cape Town — Soccer + Climate + Trade
  {
    name: 'Thabo', age: 35, location: 'Cape Town, South Africa',
    bio: 'Trade policy analyst at African Union. Kaizer Chiefs fan. Studies climate impact on African agriculture. Follows BRICS trade dynamics.',
    email: 'persona_v5_thabo@tennews.test', homeCountry: 'south africa',
    followedTopics: ['climate', 'sports', 'trade', 'politics'],
    subtopics: ['Climate & Environment', 'Soccer/Football', 'Trade & Tariffs', 'Latin America'],
    personality: { patience: 0.65, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['south africa', 'cape town', 'kaizer chiefs', 'brics', 'african union', 'agriculture', 'drought', 'africa'],
    annoyanceKeywords: ['k-pop', 'anime', 'nfl', 'baseball', 'crypto scam', 'celebrity divorce'],
    headlineTriggers: ['kaizer chiefs', 'south africa', 'brics', 'climate africa', 'trade', 'drought', 'champions league africa'],
    repetitionTolerance: 4,
  },
  // 47. Miami — Crypto + Real estate + Boxing/MMA
  {
    name: 'Marco', age: 34, location: 'Miami, FL, USA',
    bio: 'Real estate investor and Bitcoin maxi. Attends every Miami UFC event. Follows luxury property market and crypto regulation. Inter Miami fan.',
    email: 'persona_v5_marco@tennews.test', homeCountry: 'usa',
    followedTopics: ['crypto', 'business', 'sports'],
    subtopics: ['Bitcoin', 'Real Estate', 'Boxing & MMA/UFC', 'DeFi & Web3'],
    personality: { patience: 0.5, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['miami', 'florida', 'bitcoin', 'real estate', 'luxury', 'ufc', 'inter miami', 'messi', 'penthouse'],
    annoyanceKeywords: ['k-pop', 'anime', 'yoga', 'meditation', 'gardening', 'academic'],
    headlineTriggers: ['bitcoin', 'miami', 'ufc', 'real estate', 'inter miami', 'messi', 'crypto regulation'],
    repetitionTolerance: 3,
  },
  // 48. Osaka — Gaming + Entertainment + Food/Lifestyle
  {
    name: 'Sakura', age: 25, location: 'Osaka, Japan',
    bio: 'Food blogger and competitive gamer from Osaka. Reviews ramen shops and streams on YouTube. Follows Nintendo and Square Enix. Loves J-pop.',
    email: 'persona_v5_sakura@tennews.test', homeCountry: 'japan',
    followedTopics: ['entertainment', 'technology'],
    subtopics: ['Gaming', 'Food & Lifestyle', 'Music', 'Movies & Film'],
    personality: { patience: 0.4, curiosity: 0.85, saveRate: 0.03 },
    curiosityKeywords: ['osaka', 'japan', 'ramen', 'food', 'nintendo', 'square enix', 'final fantasy', 'youtube', 'j-pop', 'anime'],
    annoyanceKeywords: ['tariff', 'fiscal policy', 'mortgage', 'oil pipeline', 'defense budget', 'committee'],
    headlineTriggers: ['nintendo', 'final fantasy', 'japan food', 'osaka', 'square enix', 'game release'],
    repetitionTolerance: 2,
  },
  // 49. Warsaw — European politics + Defense + Cybersecurity
  {
    name: 'Kacper', age: 41, location: 'Warsaw, Poland',
    bio: 'Defense analyst at Polish Institute of International Affairs. Follows NATO eastern flank and EU defense spending. Legia Warsaw fan. Ex-military.',
    email: 'persona_v5_kacper@tennews.test', homeCountry: 'poland',
    followedTopics: ['defense', 'politics', 'cybersecurity'],
    subtopics: ['War & Conflict', 'European Politics', 'Cybersecurity', 'Defense & Military Tech'],
    personality: { patience: 0.75, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['poland', 'warsaw', 'nato', 'eastern flank', 'ukraine', 'russia', 'eu defense', 'legia', 'military'],
    annoyanceKeywords: ['celebrity', 'k-pop', 'fashion', 'influencer', 'gaming', 'sneakers', 'tiktok'],
    headlineTriggers: ['nato', 'poland', 'ukraine', 'cyber attack', 'defense spending', 'legia warsaw', 'eu defense'],
    repetitionTolerance: 5,
  },
  // 50. Bogota — Soccer + Latin American politics + Coffee/Trade
  {
    name: 'Valentina', age: 30, location: 'Bogota, Colombia',
    bio: 'Coffee export business owner. Atletico Nacional fan. Follows Colombian politics and Latin American trade. Advocates for fair trade practices.',
    email: 'persona_v5_valentina@tennews.test', homeCountry: 'colombia',
    followedTopics: ['business', 'sports', 'politics', 'trade'],
    subtopics: ['Coffee & Commodities Trade', 'Soccer/Football', 'Latin America', 'Trade & Tariffs'],
    personality: { patience: 0.6, curiosity: 0.65, saveRate: 0.05 },
    curiosityKeywords: ['colombia', 'bogota', 'coffee', 'atletico nacional', 'latin america', 'fair trade', 'export', 'cacao'],
    annoyanceKeywords: ['k-pop', 'anime', 'nfl', 'baseball', 'crypto scam', 'celebrity gossip'],
    headlineTriggers: ['colombia', 'atletico nacional', 'coffee', 'latin america', 'copa libertadores', 'fair trade', 'tariff'],
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
    user_metadata: { full_name: `${persona.name} (Test V5)` },
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
    full_name: `${persona.name} (Test V5)`,
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

// ============================================================================
// FEED READING — read ~50 articles across multiple pages, check explore
// every 20 articles
// ============================================================================

async function readFeedWithExploreChecks(persona, userId, accessToken, profile) {
  const sessionId = `feed_v5_${persona.name.toLowerCase()}_${Date.now()}`;
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
    detailedComplaints.push(`Skipped ${skippedTitles.length} irrelevant articles (I follow ${persona.subtopics.slice(0, 2).join(', ')})`);
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
    detailedComplaints.push(`Followed ${missingSTs.join(', ')} but saw ZERO matching articles`);
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

  // Personal quote
  let personalQuote;
  if (engRate >= 0.5 && mood >= 50) {
    personalQuote = `As a ${persona.bio.split('.')[0].toLowerCase()}, I found plenty of ${persona.subtopics[0]} content. Spent ${totalDwell.toFixed(0)}s total, engaged with ${engaged} articles. I'd come back daily.`;
  } else if (relRate >= 0.4 && engRate < 0.3) {
    personalQuote = `Articles touch on ${persona.subtopics[0]} but too surface-level. ${total} articles, only deeply engaged with ${engaged}. ${avgDwell.toFixed(1)}s avg dwell — need deeper content.`;
  } else if (exit === 'frustrated') {
    personalQuote = `I follow ${persona.subtopics.slice(0, 2).join(' and ')} but ${skippedTitles.length}/${total} were irrelevant. Left after ${totalDwell.toFixed(0)}s feeling frustrated.`;
  } else if (exit === 'bored') {
    personalQuote = `Started okay but got repetitive. ${dominantCat ? `Too much ${dominantCat[0]} (${dominantCat[1]}/${total}).` : ''} Mood dropped from 55 to ${mood}.`;
  } else {
    personalQuote = `It's okay — ${engaged}/${total} worth reading, but ${total - relevant} didn't match my interests. ${avgDwell.toFixed(1)}s avg dwell.`;
  }

  // Feature requests
  const featureRequests = [];
  if (relRate < 0.4) featureRequests.push('Better topic matching for MY interests');
  if (ebScore < 30) featureRequests.push('Explore page needs to reflect what I follow');
  if (missingSTs.length > 0) featureRequests.push(`Need more ${missingSTs[0]} content`);
  if (featureRequests.length === 0) featureRequests.push('More granular topic control');

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
  console.log('  50-PERSONA FEED + EXPLORE TEST V5');
  console.log(`  - All ${PERSONAS.length} personas start from ZERO (full wipe)`);
  console.log('  - Uses SHORT topic IDs like the real iOS app');
  console.log('  - Each reads ~50 articles across multiple pages');
  console.log('  - Explore checked every 20 articles');
  console.log('  - Tracks feed evolution: does personalization improve?');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(T);

  const allResults = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const profile = buildPersonaProfile(persona);

    console.log(`\n${'─'.repeat(120)}`);
    console.log(`  [${i + 1}/${PERSONAS.length}] ${persona.name.toUpperCase()}, ${persona.age} — ${persona.location}`);
    console.log(`  ${persona.bio}`);
    console.log(`  Followed topics (SHORT IDs): [${persona.followedTopics.join(', ')}]`);
    console.log(`  Behavior subtopics: ${persona.subtopics.join(', ')}`);
    console.log('─'.repeat(120));

    // ── SETUP ──
    console.log(`    Setting up (wiping all history)...`);
    const setup = await setupPersona(persona);
    if (!setup) { console.log('    FAILED — skipping'); continue; }
    const { userId, accessToken } = setup;
    console.log(`    User: ${userId.substring(0, 8)}... | Topics saved: [${persona.followedTopics.join(', ')}]`);

    // ── PHASE 1: Explore BEFORE reading ──
    console.log(`    Phase 1: Explore page BEFORE reading...`);
    let exploreBeforeRaw;
    try { exploreBeforeRaw = await fetchExplorePage(userId); } catch (e) { exploreBeforeRaw = { topics: [] }; }
    const exploreBeforeTopics = exploreBeforeRaw.topics || [];
    const exploreBefore = evaluateExplorePage(persona, exploreBeforeTopics, profile);
    exploreBefore.mode = exploreBeforeRaw.mode || 'unknown';
    console.log(`    Explore BEFORE: ${exploreBefore.totalTopics} topics | ${exploreBefore.relevantCount} relevant (${exploreBefore.relevanceScore.toFixed(0)}%) | mode: ${exploreBefore.mode}`);

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
    console.log(`    Explore AFTER: ${exploreAfter.totalTopics} topics | ${exploreAfter.relevantCount} relevant (${exploreAfter.relevanceScore.toFixed(0)}%) | mode: ${exploreAfter.mode}`);

    const expDelta = exploreAfter.relevanceScore - exploreBefore.relevanceScore;
    console.log(`    Explore change: ${exploreBefore.relevanceScore.toFixed(0)}% -> ${exploreAfter.relevanceScore.toFixed(0)}% (${expDelta >= 0 ? '+' : ''}${expDelta.toFixed(0)}%)`);

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
      persona, profile, userId, feedResult, exploreBefore, exploreAfter, feedback,
    });
  }

  // ============================================================================
  // GRAND REPORTS
  // ============================================================================

  console.log(`\n\n${'='.repeat(140)}`);
  console.log(`  GRAND REPORT — 50-PERSONA FEED + EXPLORE TEST V5`);
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

  // ── TABLE 2: Explore evolution (0, 20, 40 articles) ──
  console.log('\n  TABLE 2: EXPLORE PAGE EVOLUTION (how explore relevance changes after 0, 20, 40 articles)');
  console.log(`  ${'Name'.padEnd(12)} ${'Before'.padStart(10)} ${'After 20'.padStart(10)} ${'After 40'.padStart(10)} ${'Final'.padStart(10)} ${'Delta'.padStart(8)} ${'Mode(F)'.padStart(10)} ${'Verdict'.padStart(10)}`);
  console.log(`  ${'─'.repeat(85)}`);

  for (const r of allResults) {
    const before = r.exploreBefore.relevanceScore;
    const snapshots = r.feedResult.exploreSnapshots;
    const after20 = snapshots.find(s => s.afterArticles === 20)?.eval?.relevanceScore;
    const after40 = snapshots.find(s => s.afterArticles === 40)?.eval?.relevanceScore;
    const final_ = r.exploreAfter.relevanceScore;
    const delta = final_ - before;
    const verdict = delta > 5 ? 'IMPROVED' : delta < -5 ? 'DECLINED' : 'SAME';
    console.log(`  ${r.persona.name.padEnd(12)} ${(before.toFixed(0)+'%').padStart(10)} ${(after20 !== undefined ? after20.toFixed(0)+'%' : 'N/A').padStart(10)} ${(after40 !== undefined ? after40.toFixed(0)+'%' : 'N/A').padStart(10)} ${(final_.toFixed(0)+'%').padStart(10)} ${((delta>=0?'+':'')+delta.toFixed(0)+'%').padStart(8)} ${r.exploreAfter.mode.padStart(10)} ${verdict.padStart(10)}`);
  }

  // ── TABLE 3: Feed evolution (engagement rate by phase: 1-20, 21-40, 41-50) ──
  console.log('\n  TABLE 3: FEED EVOLUTION (does engagement rate improve from articles 1-20 vs 21-40 vs 41-50?)');
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

  // ── TABLE 4: Interest category performance ──
  console.log('\n  TABLE 4: INTEREST CATEGORY PERFORMANCE');
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

  // ── TABLE 5: What each persona didn't like ──
  console.log('\n  TABLE 5: WHAT EACH PERSONA DIDN\'T LIKE');
  console.log(`  ${'─'.repeat(130)}`);
  for (const r of allResults) {
    const f = r.feedback;
    console.log(`  ${r.persona.name.toUpperCase()} (${f.overallRating}/10, ${f.feedSatisfaction}, topics: [${r.persona.followedTopics.join(', ')}]):`);
    if (f.allComplaints.length > 0) {
      for (const c of f.allComplaints) console.log(`    [General] ${c}`);
    }
    if (f.detailedComplaints.length > 0) {
      for (const dc of f.detailedComplaints) console.log(`    [Specific] ${dc}`);
    }
    if (f.missingSTs.length > 0) {
      console.log(`    [Missing] Followed but never shown: ${f.missingSTs.join(', ')}`);
    }
    if (f.allComplaints.length === 0 && f.detailedComplaints.length === 0) {
      console.log(`    No significant complaints`);
    }
    console.log('');
  }

  // ── TABLE 6: FINAL VERDICT ──
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

  console.log(`\n  ${'='.repeat(80)}`);
  console.log(`  FINAL VERDICT`);
  console.log(`  ${'='.repeat(80)}`);
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

  if (avgRating >= 7) console.log(`  APP QUALITY:                 EXCELLENT`);
  else if (avgRating >= 5) console.log(`  APP QUALITY:                 GOOD`);
  else if (avgRating >= 3.5) console.log(`  APP QUALITY:                 NEEDS IMPROVEMENT`);
  else console.log(`  APP QUALITY:                 POOR`);

  console.log(`\n  Done at ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

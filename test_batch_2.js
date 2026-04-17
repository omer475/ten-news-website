import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// 50-PERSONA FEED TEST — V3 ALGORITHM (Sliding Window + Entity Affinity)
// Tests the v3 algorithm against personalization_profiles + sliding window
// Key changes from V7:
//   - Personas have 3-19 subtopics (realistic variety)
//   - Also clears v3 tables (personalization_profiles, engagement_buffer, entity_affinity)
//   - Tracks v3-specific: entity affinity build-up, phase transitions, interest discovery speed
//   - Comparison vs v22 results at end
//   - Same simulation engine (behavior/scoring/exits unchanged)
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const SESSIONS_PER_PERSONA = 5;
const DELAY_BETWEEN_EVENTS_MS = 5;
const DELAY_BETWEEN_PAGES_MS = 30;
const DELAY_BETWEEN_SESSIONS_MS = 500;
const TARGET_ARTICLES_PER_PERSONA = 50;
const MAX_ARTICLES_PER_SESSION = 50;

// ============================================================================
// SUBTOPIC DEFINITIONS
// ============================================================================

const SUBTOPIC_MAP = {
  // Politics
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'troops', 'missile', 'strike', 'ceasefire', 'nato', 'pentagon', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'supreme court', 'governor', 'election', 'legislation'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'macron', 'scholz', 'starmer', 'germany', 'france', 'uk politics'] },
  'Asian Politics':              { categories: ['Politics'], tags: ['asian politics', 'china', 'india', 'japan', 'taiwan', 'north korea', 'south korea', 'asean', 'modi', 'xi jinping', 'southeast asia'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gaza', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz', 'gulf'] },
  'Latin America':               { categories: ['Politics'], tags: ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba', 'south america'] },
  'Africa & Oceania':            { categories: ['Politics'], tags: ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes', 'refugee', 'asylum'] },
  // Sports
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'nfl draft'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'playoffs', 'nba draft'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup', 'transfer'] },
  'MLB/Baseball':                { categories: ['Sports'], tags: ['mlb', 'baseball', 'world series', 'home run', 'pitcher'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout', 'wrestling'] },
  'Olympics & Paralympics':      { categories: ['Sports'], tags: ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc'] },
  // Business
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'nuclear energy'] },
  'Automotive':                  { categories: ['Business'], tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Corporate Deals':             { categories: ['Business'], tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },
  // Entertainment
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars', 'academy award'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce', 'spotify'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam', 'game'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'star', 'billionaire', 'royal'] },
  'K-Pop & K-Drama':             { categories: ['Entertainment'], tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'] },
  // Tech
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm', 'gpt', 'claude', 'anthropic', 'google ai'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Social Media':                { categories: ['Tech'], tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor', 'gpu'] },
  // Science
  'Space & Astronomy':           { categories: ['Science'], tags: ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet', 'star'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Earth Science':               { categories: ['Science'], tags: ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'] },
  // Health
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery', 'drug'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'fda', 'medication', 'biotech', 'drug approval'] },
  // Finance
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading', 'stocks'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },
  // Crypto
  'Bitcoin':                     { categories: ['Finance', 'Crypto', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving', 'crypto'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Crypto', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized', 'ethereum'] },
  'Crypto Regulation & Legal':   { categories: ['Finance', 'Crypto', 'Tech'], tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'] },
  // Lifestyle
  'Pets & Animals':              { categories: ['Lifestyle'], tags: ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'] },
  'Home & Garden':               { categories: ['Lifestyle'], tags: ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },
  // Fashion
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
};

// ============================================================================
// 50 PERSONAS
// ============================================================================

const PERSONAS = [
  // GEN Z (18-26) — 15 personas
  {
    name: 'Jayden', age: 19, generation: 'GenZ', location: 'Atlanta, GA',
    bio: 'Freshman at Georgia Tech. Lives on TikTok and Twitter/X. Huge Atlanta Hawks and Falcons fan.',
    email: 'persona_jayden@tennews.test', homeCountry: 'usa',
    subtopics: ['NBA', 'NFL', 'Gaming', 'Sneakers & Streetwear'],
    personality: { patience: 0.25, saveRate: 0.02, baseSessions: [15, 35], flowMultiplier: 1.8, frustrationSpeed: 2.0 },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'atlanta', 'million dollar', 'arrest', 'rapper', 'drake', 'travis scott'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'fiscal', 'tariff', 'summit', 'mortgage'],
    headlineTriggers: ['hawks', 'falcons', 'trae young', 'jordan', 'nike', 'fortnite', 'world record'],
    repetitionTolerance: 1,
  },
  {
    name: 'Mina', age: 22, generation: 'GenZ', location: 'Seoul, South Korea',
    bio: 'K-beauty influencer (120K followers). Obsessed with K-pop. Watches every K-drama on Netflix.',
    email: 'persona_mina@tennews.test', homeCountry: 'south_korea',
    subtopics: ['K-Pop & K-Drama', 'Celebrity News', 'Celebrity Style & Red Carpet', 'Social Media', 'Movies & Film', 'Music'],
    personality: { patience: 0.35, saveRate: 0.05, baseSessions: [15, 35], flowMultiplier: 1.6, frustrationSpeed: 1.8 },
    curiosityKeywords: ['korea', 'seoul', 'japanese', 'anime', 'beauty', 'skincare', 'viral', 'aesthetic', 'instagram'],
    annoyanceKeywords: ['war', 'missile', 'tariff', 'fed rate', 'commodity', 'pipeline'],
    headlineTriggers: ['k-pop', 'newjeans', 'blackpink', 'netflix', 'korean', 'seoul', 'bts'],
    repetitionTolerance: 2,
  },
  {
    name: 'Kai', age: 20, generation: 'GenZ', location: 'Tokyo, Japan',
    bio: 'CS student at University of Tokyo. Competitive Valorant player. Follows AI research.',
    email: 'persona_kai@tennews.test', homeCountry: 'japan',
    subtopics: ['Gaming', 'AI & Machine Learning', 'Robotics & Hardware', 'Smartphones & Gadgets', 'Cybersecurity', 'Space Tech', 'Movies & Film', 'Space & Astronomy'],
    personality: { patience: 0.4, saveRate: 0.04, baseSessions: [18, 40], flowMultiplier: 1.7, frustrationSpeed: 1.6 },
    curiosityKeywords: ['japan', 'tokyo', 'anime', 'manga', 'nintendo', 'sony', 'space', 'mars', 'robot', 'quantum'],
    annoyanceKeywords: ['celebrity', 'gossip', 'fashion week', 'real estate', 'mortgage', 'gardening'],
    headlineTriggers: ['nvidia', 'openai', 'nintendo', 'playstation', 'japan', 'valorant', 'steam'],
    repetitionTolerance: 2,
  },
  {
    name: 'Priya', age: 24, generation: 'GenZ', location: 'Mumbai, India',
    bio: 'Junior data scientist at Flipkart. Cricket-obsessed. Active on Twitter debating AI ethics.',
    email: 'persona_priya@tennews.test', homeCountry: 'india',
    subtopics: ['Cricket', 'AI & Machine Learning', 'Startups & Venture Capital', 'Smartphones & Gadgets', 'Cybersecurity', 'Space Tech', 'Asian Politics', 'Stock Markets', 'Public Health'],
    personality: { patience: 0.5, saveRate: 0.04, baseSessions: [20, 45], flowMultiplier: 1.5, frustrationSpeed: 1.4 },
    curiosityKeywords: ['india', 'mumbai', 'bollywood', 'cricket', 'startup', 'women in tech', 'bangalore', 'flipkart'],
    annoyanceKeywords: ['nfl', 'super bowl', 'quarterback', 'cowboys', 'baseball', 'nascar'],
    headlineTriggers: ['ipl', 'virat', 'india', 'mumbai', 'cricket', 'kohli', 'openai'],
    repetitionTolerance: 3,
  },
  {
    name: 'Tyler', age: 21, generation: 'GenZ', location: 'Austin, TX',
    bio: 'UT Austin finance major. Day-trades meme stocks. UFC fanatic. Elon Musk superfan.',
    email: 'persona_tyler@tennews.test', homeCountry: 'usa',
    subtopics: ['Stock Markets', 'Boxing & MMA/UFC', 'Bitcoin', 'Cybersecurity', 'DeFi & Web3'],
    personality: { patience: 0.3, saveRate: 0.03, baseSessions: [15, 35], flowMultiplier: 1.9, frustrationSpeed: 2.0 },
    curiosityKeywords: ['elon', 'tesla', 'spacex', 'hack', 'exploit', 'million', 'billion', 'crash', 'austin', 'texas'],
    annoyanceKeywords: ['fashion', 'met gala', 'recipe', 'garden', 'yoga', 'meditation', 'k-pop'],
    headlineTriggers: ['tesla', 'elon musk', 'ufc', 'bitcoin', 'hack', 'sec', 'crash'],
    repetitionTolerance: 2,
  },
  {
    name: 'Aisha', age: 23, generation: 'GenZ', location: 'Lagos, Nigeria',
    bio: 'Fintech product manager at Lagos startup. Manchester United fan. Follows Afrobeats.',
    email: 'persona_aisha@tennews.test', homeCountry: 'nigeria',
    subtopics: ['Startups & Venture Capital', 'Soccer/Football', 'DeFi & Web3', 'Music', 'Bitcoin', 'Smartphones & Gadgets', 'Africa & Oceania'],
    personality: { patience: 0.5, saveRate: 0.04, baseSessions: [15, 35], flowMultiplier: 1.5, frustrationSpeed: 1.5 },
    curiosityKeywords: ['nigeria', 'lagos', 'africa', 'african', 'women founder', 'fintech', 'mobile money', 'afrobeats'],
    annoyanceKeywords: ['nfl', 'baseball', 'nascar', 'republican', 'democrat', 'gardening'],
    headlineTriggers: ['manchester united', 'nigeria', 'africa', 'startup', 'fintech', 'billion'],
    repetitionTolerance: 2,
  },
  {
    name: 'Lucas', age: 18, generation: 'GenZ', location: 'Sao Paulo, Brazil',
    bio: 'High school senior. Flamengo ultras. Plays FIFA and EA FC all day. Brazilian rap.',
    email: 'persona_lucas@tennews.test', homeCountry: 'brazil',
    subtopics: ['Soccer/Football', 'Gaming', 'Music', 'Celebrity News'],
    personality: { patience: 0.2, saveRate: 0.01, baseSessions: [12, 30], flowMultiplier: 2.0, frustrationSpeed: 2.5 },
    curiosityKeywords: ['brazil', 'sao paulo', 'rio', 'vinicius', 'neymar', 'viral', 'insane', 'million'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'fiscal', 'pharma', 'clinical trial'],
    headlineTriggers: ['flamengo', 'brazil', 'vinicius', 'neymar', 'real madrid', 'premier league'],
    repetitionTolerance: 1,
  },
  {
    name: 'Emma', age: 25, generation: 'GenZ', location: 'Melbourne, Australia',
    bio: 'Environmental science grad student. Climate activist. AFL — Melbourne Demons diehard.',
    email: 'persona_emma@tennews.test', homeCountry: 'australia',
    subtopics: ['Climate & Environment', 'Biology & Nature', 'Public Health', 'Shopping & Product Reviews', 'Earth Science', 'Pets & Animals', 'Mental Health', 'Space & Astronomy', 'Medical Breakthroughs', 'Home & Garden'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [18, 40], flowMultiplier: 1.4, frustrationSpeed: 1.3 },
    curiosityKeywords: ['australia', 'melbourne', 'reef', 'wildlife', 'animal', 'vegan', 'sustainable', 'ocean', 'pacific'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'meme coin', 'oil drilling', 'fracking'],
    headlineTriggers: ['climate', 'australia', 'reef', 'endangered', 'wildfire', 'melbourne'],
    repetitionTolerance: 3,
  },
  {
    name: 'Yuki', age: 26, generation: 'GenZ', location: 'Osaka, Japan',
    bio: 'UX designer at a gaming company. Cosplayer (30K TikTok). Watches every anime season.',
    email: 'persona_yuki@tennews.test', homeCountry: 'japan',
    subtopics: ['Gaming', 'Movies & Film', 'Smartphones & Gadgets', 'K-Pop & K-Drama'],
    personality: { patience: 0.4, saveRate: 0.04, baseSessions: [15, 35], flowMultiplier: 1.6, frustrationSpeed: 1.7 },
    curiosityKeywords: ['japan', 'osaka', 'anime', 'manga', 'cosplay', 'studio ghibli', 'nintendo', 'design'],
    annoyanceKeywords: ['war', 'troops', 'missile', 'tariff', 'commodity', 'oil price'],
    headlineTriggers: ['nintendo', 'anime', 'japan', 'playstation', 'netflix', 'studio ghibli'],
    repetitionTolerance: 2,
  },
  {
    name: 'Zoe', age: 22, generation: 'GenZ', location: 'Brooklyn, NY',
    bio: 'NYU journalism student and podcast host. Covers gen Z mental health and dating culture.',
    email: 'persona_zoe@tennews.test', homeCountry: 'usa',
    subtopics: ['Mental Health', 'Celebrity News', 'Social Media', 'Climate & Environment'],
    personality: { patience: 0.45, saveRate: 0.06, baseSessions: [15, 35], flowMultiplier: 1.5, frustrationSpeed: 1.5 },
    curiosityKeywords: ['new york', 'brooklyn', 'gen z', 'dating', 'therapy', 'viral', 'tiktok', 'student debt', 'rent'],
    annoyanceKeywords: ['quarterly', 'earnings', 'commodity', 'pipeline', 'military', 'troops'],
    headlineTriggers: ['mental health', 'gen z', 'tiktok', 'new york', 'viral', 'study finds'],
    repetitionTolerance: 2,
  },
  {
    name: 'Omar', age: 20, generation: 'GenZ', location: 'Cairo, Egypt',
    bio: 'Cairo University engineering student. Al Ahly ultras. Follows Middle East politics.',
    email: 'persona_omar@tennews.test', homeCountry: 'egypt',
    subtopics: ['Soccer/Football', 'Middle East', 'Gaming', 'AI & Machine Learning', 'War & Conflict', 'Cybersecurity', 'Space Tech'],
    personality: { patience: 0.4, saveRate: 0.03, baseSessions: [15, 38], flowMultiplier: 1.6, frustrationSpeed: 1.7 },
    curiosityKeywords: ['egypt', 'cairo', 'salah', 'arab', 'suez', 'pyramid', 'ancient', 'islam'],
    annoyanceKeywords: ['k-pop', 'celebrity divorce', 'fashion week', 'sneakers', 'yoga'],
    headlineTriggers: ['egypt', 'salah', 'liverpool', 'gaza', 'cairo', 'al ahly'],
    repetitionTolerance: 3,
  },
  {
    name: 'Ava', age: 24, generation: 'GenZ', location: 'Vancouver, Canada',
    bio: 'Physiotherapy student at UBC. Fitness Instagram (18K). Vancouver Canucks fan.',
    email: 'persona_ava@tennews.test', homeCountry: 'canada',
    subtopics: ['Public Health', 'Mental Health', 'Climate & Environment', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.5, saveRate: 0.04, baseSessions: [15, 35], flowMultiplier: 1.4, frustrationSpeed: 1.5 },
    curiosityKeywords: ['vancouver', 'canada', 'fitness', 'workout', 'hiking', 'wildfire', 'sustainable', 'wellness'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'military', 'troops', 'drone strike'],
    headlineTriggers: ['canada', 'vancouver', 'nhl', 'canucks', 'fitness', 'mental health'],
    repetitionTolerance: 2,
  },
  {
    name: 'Marcus', age: 25, generation: 'GenZ', location: 'Chicago, IL',
    bio: 'Sound engineer and music producer. Die-hard Bears and Bulls fan. Collects vinyl.',
    email: 'persona_marcus@tennews.test', homeCountry: 'usa',
    subtopics: ['Music', 'NBA', 'NFL', 'Sneakers & Streetwear'],
    personality: { patience: 0.35, saveRate: 0.03, baseSessions: [15, 38], flowMultiplier: 1.7, frustrationSpeed: 1.8 },
    curiosityKeywords: ['chicago', 'album', 'concert', 'tour', 'vinyl', 'grammy', 'producer', 'studio', 'rapper'],
    annoyanceKeywords: ['policy', 'regulation', 'pharma', 'clinical trial', 'trade deal', 'summit'],
    headlineTriggers: ['bears', 'bulls', 'chicago', 'grammy', 'album', 'rapper', 'hip hop'],
    repetitionTolerance: 2,
  },
  {
    name: 'Sofia', age: 19, generation: 'GenZ', location: 'Mexico City, Mexico',
    bio: 'Fashion design student. Instagram aesthetic curator. Club America fan.',
    email: 'persona_sofia@tennews.test', homeCountry: 'mexico',
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Music', 'Soccer/Football'],
    personality: { patience: 0.3, saveRate: 0.03, baseSessions: [12, 30], flowMultiplier: 1.8, frustrationSpeed: 2.0 },
    curiosityKeywords: ['mexico', 'latin', 'spanish', 'fashion', 'design', 'art', 'museum', 'architecture'],
    annoyanceKeywords: ['war', 'missile', 'troops', 'quarterly', 'earnings', 'semiconductor'],
    headlineTriggers: ['mexico', 'fashion', 'met gala', 'club america', 'latin', 'oscar'],
    repetitionTolerance: 1,
  },
  {
    name: 'Ethan', age: 23, generation: 'GenZ', location: 'Denver, CO',
    bio: 'Cybersecurity analyst. CTF competitor. Denver Broncos season ticket holder. Rock climber.',
    email: 'persona_ethan@tennews.test', homeCountry: 'usa',
    subtopics: ['Cybersecurity', 'Robotics & Hardware', 'NFL', 'Space Tech'],
    personality: { patience: 0.5, saveRate: 0.05, baseSessions: [18, 42], flowMultiplier: 1.5, frustrationSpeed: 1.4 },
    curiosityKeywords: ['denver', 'colorado', 'hack', 'vulnerability', 'zero day', 'space', 'climbing', 'nasa'],
    annoyanceKeywords: ['celebrity', 'gossip', 'fashion', 'k-pop', 'influencer', 'reality tv'],
    headlineTriggers: ['broncos', 'hack', 'breach', 'nvidia', 'spacex', 'ransomware', 'denver'],
    repetitionTolerance: 3,
  },
  // MILLENNIALS (27-42) — 20 personas
  {
    name: 'Lena', age: 32, generation: 'Millennial', location: 'San Francisco, CA',
    bio: 'AI research lead at a robotics startup. Follows OpenAI/Anthropic race closely.',
    email: 'persona_lena@tennews.test', homeCountry: 'usa',
    subtopics: ['AI & Machine Learning', 'Space Tech', 'Gaming', 'Robotics & Hardware', 'Cybersecurity', 'Space & Astronomy', 'Smartphones & Gadgets', 'Biology & Nature', 'Medical Breakthroughs', 'Climate & Environment', 'Movies & Film', 'DeFi & Web3', 'Startups & Venture Capital', 'Earth Science', 'Automotive', 'Music', 'European Politics', 'Mental Health', 'Shopping & Product Reviews'],
    personality: { patience: 0.8, saveRate: 0.08, baseSessions: [30, 60], flowMultiplier: 1.3, frustrationSpeed: 0.8 },
    curiosityKeywords: ['bizarre', 'discovered', 'ancient', 'extinct', 'record-breaking', 'billion', 'breakthrough'],
    annoyanceKeywords: ['ai will replace', 'robots taking jobs', 'alarming'],
    headlineTriggers: ['first ever', 'no one expected', 'scientists shocked', 'elon musk'],
    repetitionTolerance: 3,
  },
  {
    name: 'Marco', age: 35, generation: 'Millennial', location: 'Milan, Italy',
    bio: 'Sports editor at Gazzetta dello Sport. Die-hard AC Milan fan. Follows F1 and UFC.',
    email: 'persona_marco@tennews.test', homeCountry: 'italy',
    subtopics: ['Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC'],
    personality: { patience: 0.5, saveRate: 0.03, baseSessions: [35, 65], flowMultiplier: 1.4, frustrationSpeed: 1.0 },
    curiosityKeywords: ['athlete', 'injury', 'salary', 'deal', 'scandal', 'record', 'fastest', 'million'],
    annoyanceKeywords: ['congress', 'legislation', 'policy', 'sanctions'],
    headlineTriggers: ['transfer', 'fired', 'champion', 'upset', 'shocking defeat'],
    repetitionTolerance: 4,
  },
  {
    name: 'Elif', age: 29, generation: 'Millennial', location: 'Istanbul, Turkey',
    bio: 'Product designer at fintech startup. Passionate Galatasaray fan. Follows Turkish tech scene.',
    email: 'persona_elif@tennews.test', homeCountry: 'turkiye',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.4, frustrationSpeed: 1.2 },
    curiosityKeywords: ['design', 'women in tech', 'founder', 'turkish', 'istanbul', 'lira', 'earthquake'],
    annoyanceKeywords: ['death toll unchanged', 'no new developments', 'sources say'],
    headlineTriggers: ['galatasaray', 'turkey', 'turkish', 'istanbul', 'women founder'],
    repetitionTolerance: 2,
  },
  {
    name: 'Ryan', age: 38, generation: 'Millennial', location: 'New York, NY',
    bio: 'Quant fund portfolio manager. Trades S&P futures and tech stocks. Yankees season ticket holder.',
    email: 'persona_ryan@tennews.test', homeCountry: 'usa',
    subtopics: ['Stock Markets', 'Corporate Earnings', 'Startups & Venture Capital', 'AI & Machine Learning', 'Banking & Lending', 'Corporate Deals', 'Trade & Tariffs', 'Oil & Energy', 'Commodities', 'Real Estate', 'Automotive', 'Cybersecurity', 'Crypto Regulation & Legal', 'Bitcoin'],
    personality: { patience: 0.7, saveRate: 0.06, baseSessions: [25, 50], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['oil price', 'fed', 'crash', 'surge', 'billion', 'ipo', 'sec', 'yankees', 'market crash'],
    annoyanceKeywords: ['wellness', 'mindfulness', 'self-care', 'horoscope'],
    headlineTriggers: ['plunges', 'surges', 'record high', 'crashes', 'bankruptcy'],
    repetitionTolerance: 3,
  },
  {
    name: 'Sophie', age: 27, generation: 'Millennial', location: 'Lyon, France',
    bio: 'Medical resident in oncology. Follows biotech breakthroughs. Olympique Lyonnais fan.',
    email: 'persona_sophie@tennews.test', homeCountry: 'france',
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature', 'Soccer/Football', 'Public Health', 'Mental Health'],
    personality: { patience: 0.7, saveRate: 0.07, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['ai in medicine', 'diagnosis', 'patient', 'hospital', 'france', 'lyon', 'humanitarian'],
    annoyanceKeywords: ['crypto', 'nft', 'meme coin', 'influencer'],
    headlineTriggers: ['cure', 'first patient', 'clinical trial', 'mbappe', 'lyon'],
    repetitionTolerance: 3,
  },
  {
    name: 'Camille', age: 33, generation: 'Millennial', location: 'Paris, France',
    bio: 'Creative director at Balenciaga. Lives for fashion week and red carpet moments. PSG fan.',
    email: 'persona_camille@tennews.test', homeCountry: 'france',
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Shopping & Product Reviews', 'Soccer/Football'],
    personality: { patience: 0.5, saveRate: 0.06, baseSessions: [18, 40], flowMultiplier: 1.5, frustrationSpeed: 1.2 },
    curiosityKeywords: ['luxury', 'lvmh', 'kering', 'gucci', 'paris', 'france', 'design', 'architecture', 'museum', 'art', 'creative ai'],
    annoyanceKeywords: ['missile', 'troops', 'death toll', 'bitcoin', 'mining'],
    headlineTriggers: ['paris', 'psg', 'fashion', 'cannes', 'balenciaga', 'french'],
    repetitionTolerance: 3,
  },
  {
    name: 'Diego', age: 26, generation: 'Millennial', location: 'Miami, FL',
    bio: 'Crypto analyst at a DeFi fund. On-chain detective. Real Madrid fan.',
    email: 'persona_diego@tennews.test', homeCountry: 'usa',
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Stock Markets', 'Cybersecurity'],
    personality: { patience: 0.5, saveRate: 0.04, baseSessions: [25, 50], flowMultiplier: 1.5, frustrationSpeed: 1.2 },
    curiosityKeywords: ['real madrid', 'champions league', 'miami', 'latin america', 'ai trading', 'algorithm', 'whale', 'vinicius'],
    annoyanceKeywords: ['wellness', 'meditation', 'yoga', 'recipe', 'garden'],
    headlineTriggers: ['real madrid', 'sec', 'hack', 'exploit', 'crash', 'billion'],
    repetitionTolerance: 3,
  },
  {
    name: 'Amara', age: 34, generation: 'Millennial', location: 'Montreal, Canada',
    bio: 'ER nurse at McGill. Reads medical journals on break. Montreal Canadiens fan.',
    email: 'persona_amara@tennews.test', homeCountry: 'canada',
    subtopics: ['Medical Breakthroughs', 'Biology & Nature', 'Mental Health', 'Pharma & Drug Industry', 'Public Health', 'Climate & Environment', 'AI & Machine Learning', 'Pets & Animals', 'Earth Science', 'Space & Astronomy', 'Robotics & Hardware', 'Shopping & Product Reviews'],
    personality: { patience: 0.7, saveRate: 0.06, baseSessions: [18, 40], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['canada', 'montreal', 'nurse', 'hospital', 'humanitarian', 'civilian', 'famine', 'ai diagnosis'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'stock market', 'earnings call'],
    headlineTriggers: ['canadiens', 'montreal', 'nurse', 'hospital', 'patient', 'first cure'],
    repetitionTolerance: 3,
  },
  {
    name: 'Antonio', age: 43, generation: 'Millennial', location: 'Barcelona, Spain',
    bio: 'Restaurant chain owner. Lifelong FC Barcelona soci. Camp Nou season ticket since 2005.',
    email: 'persona_antonio@tennews.test', homeCountry: 'spain',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Retail & Consumer', 'Real Estate'],
    personality: { patience: 0.6, saveRate: 0.04, baseSessions: [18, 40], flowMultiplier: 1.4, frustrationSpeed: 1.1 },
    curiosityKeywords: ['barcelona', 'spain', 'spanish', 'restaurant', 'food', 'tourism', 'hotel', 'oil price', 'inflation', 'cost of living'],
    annoyanceKeywords: ['algorithm', 'blockchain', 'defi', 'neural network', 'prompt engineering'],
    headlineTriggers: ['barcelona', 'barca', 'la liga', 'spain', 'lamine yamal', 'messi'],
    repetitionTolerance: 3,
  },
  {
    name: 'Nkechi', age: 31, generation: 'Millennial', location: 'London, UK',
    bio: 'Investment banking associate at Goldman Sachs London. Arsenal fan.',
    email: 'persona_nkechi@tennews.test', homeCountry: 'uk',
    subtopics: ['Stock Markets', 'Corporate Deals', 'Soccer/Football', 'Oil & Energy'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 1.0 },
    curiosityKeywords: ['nigeria', 'africa', 'london', 'goldman', 'oil', 'women in finance', 'arsenal', 'afrobeats'],
    annoyanceKeywords: ['k-pop', 'gaming', 'cosplay', 'anime', 'tiktok dance'],
    headlineTriggers: ['arsenal', 'london', 'goldman', 'merger', 'acquisition', 'nigeria', 'oil price'],
    repetitionTolerance: 3,
  },
  {
    name: 'ChenWei', age: 36, generation: 'Millennial', location: 'Singapore',
    bio: 'VP of Engineering at logistics SaaS. Previously Alibaba. Liverpool fan.',
    email: 'persona_chenwei@tennews.test', homeCountry: 'singapore',
    subtopics: ['AI & Machine Learning', 'Trade & Tariffs', 'Robotics & Hardware', 'Asian Politics', 'Cybersecurity', 'Startups & Venture Capital', 'Stock Markets', 'Soccer/Football', 'Space Tech', 'Smartphones & Gadgets', 'Corporate Deals', 'Oil & Energy', 'European Politics', 'Gaming', 'Automotive', 'Climate & Environment'],
    personality: { patience: 0.7, saveRate: 0.06, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['singapore', 'china', 'alibaba', 'tencent', 'semiconductor', 'chip', 'asean', 'supply chain'],
    annoyanceKeywords: ['celebrity', 'gossip', 'reality tv', 'fashion week', 'sneakers'],
    headlineTriggers: ['china', 'chip ban', 'singapore', 'liverpool', 'salah', 'nvidia', 'tsmc'],
    repetitionTolerance: 4,
  },
  {
    name: 'Sarah', age: 39, generation: 'Millennial', location: 'Portland, OR',
    bio: 'Pediatrician and mom of three. Oregon Ducks football fan. Concerned about climate.',
    email: 'persona_sarah@tennews.test', homeCountry: 'usa',
    subtopics: ['Public Health', 'Climate & Environment', 'Medical Breakthroughs', 'Pets & Animals'],
    personality: { patience: 0.7, saveRate: 0.05, baseSessions: [15, 35], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['portland', 'oregon', 'parent', 'children', 'school', 'food safety', 'recall', 'wildfire', 'rescue', 'animal'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'hedge fund', 'derivatives', 'meme stock'],
    headlineTriggers: ['parent', 'children', 'school', 'vaccine', 'oregon', 'recall', 'animal rescue'],
    repetitionTolerance: 3,
  },
  {
    name: 'Hiroshi', age: 40, generation: 'Millennial', location: 'Yokohama, Japan',
    bio: 'Senior software engineer at Sony. Works on PlayStation. Yokohama F. Marinos fan.',
    email: 'persona_hiroshi@tennews.test', homeCountry: 'japan',
    subtopics: ['Gaming', 'Robotics & Hardware', 'AI & Machine Learning', 'Space & Astronomy', 'Smartphones & Gadgets', 'Space Tech', 'Movies & Film', 'Cybersecurity', 'Earth Science', 'Automotive', 'Music', 'Biology & Nature', 'F1 & Motorsport'],
    personality: { patience: 0.7, saveRate: 0.06, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 0.8 },
    curiosityKeywords: ['japan', 'yokohama', 'sony', 'playstation', 'jaxa', 'japanese', 'baseball', 'retro'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'k-pop dating', 'fashion week'],
    headlineTriggers: ['playstation', 'sony', 'japan', 'nintendo', 'jaxa', 'yokohama'],
    repetitionTolerance: 4,
  },
  {
    name: 'Fatima', age: 24, generation: 'Millennial', location: 'Washington DC',
    bio: 'Georgetown law student focused on civil rights. Interns at ACLU. Man City fan.',
    email: 'persona_fatima@tennews.test', homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Middle East', 'Public Health', 'War & Conflict', 'European Politics', 'Latin America', 'Climate & Environment', 'Soccer/Football'],
    personality: { patience: 0.8, saveRate: 0.07, baseSessions: [20, 45], flowMultiplier: 1.2, frustrationSpeed: 0.7 },
    curiosityKeywords: ['privacy', 'surveillance', 'immigration', 'border', 'education', 'student debt', 'man city', 'haaland', 'justice'],
    annoyanceKeywords: ['earnings', 'quarterly', 'ipo', 'stock price', 'revenue'],
    headlineTriggers: ['supreme court', 'aclu', 'man city', 'haaland', 'civil rights', 'unconstitutional'],
    repetitionTolerance: 4,
  },
  {
    name: 'Carlos', age: 30, generation: 'Millennial', location: 'Buenos Aires, Argentina',
    bio: 'Full-stack developer. Boca Juniors is life. Follows Argentine politics and tech.',
    email: 'persona_carlos@tennews.test', homeCountry: 'argentina',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'AI & Machine Learning', 'Latin America'],
    personality: { patience: 0.5, saveRate: 0.04, baseSessions: [20, 45], flowMultiplier: 1.5, frustrationSpeed: 1.2 },
    curiosityKeywords: ['argentina', 'buenos aires', 'messi', 'peso', 'inflation', 'remote work', 'developer'],
    annoyanceKeywords: ['nfl', 'baseball', 'nascar', 'gardening', 'home renovation'],
    headlineTriggers: ['boca juniors', 'argentina', 'messi', 'libertadores', 'buenos aires'],
    repetitionTolerance: 3,
  },
  {
    name: 'Hannah', age: 28, generation: 'Millennial', location: 'Tel Aviv, Israel',
    bio: 'Product manager at cybersecurity unicorn. Unit 8200 alumni. Tottenham fan.',
    email: 'persona_hannah@tennews.test', homeCountry: 'israel',
    subtopics: ['Cybersecurity', 'Startups & Venture Capital', 'Middle East', 'Soccer/Football'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.4, frustrationSpeed: 1.1 },
    curiosityKeywords: ['israel', 'tel aviv', 'cybersecurity', 'startup nation', 'women in tech', 'iron dome', 'spurs'],
    annoyanceKeywords: ['celebrity', 'k-pop', 'fashion week', 'reality tv', 'horoscope'],
    headlineTriggers: ['israel', 'tel aviv', 'tottenham', 'cyber', 'son heung', 'iron dome'],
    repetitionTolerance: 3,
  },
  {
    name: 'Viktor', age: 37, generation: 'Millennial', location: 'Kyiv, Ukraine',
    bio: 'War correspondent turned tech journalist. Reports on Ukraine defence tech. Shakhtar fan.',
    email: 'persona_viktor@tennews.test', homeCountry: 'ukraine',
    subtopics: ['War & Conflict', 'Cybersecurity', 'European Politics', 'Space Tech', 'Robotics & Hardware', 'AI & Machine Learning', 'US Politics', 'Middle East'],
    personality: { patience: 0.8, saveRate: 0.08, baseSessions: [25, 50], flowMultiplier: 1.2, frustrationSpeed: 0.7 },
    curiosityKeywords: ['ukraine', 'kyiv', 'drone', 'nato', 'russia', 'satellite', 'intelligence', 'defense tech'],
    annoyanceKeywords: ['celebrity', 'fashion', 'reality tv', 'influencer', 'diet'],
    headlineTriggers: ['ukraine', 'kyiv', 'nato', 'drone', 'russia', 'shakhtar', 'frontline'],
    repetitionTolerance: 5,
  },
  {
    name: 'Jasmine', age: 33, generation: 'Millennial', location: 'Dubai, UAE',
    bio: 'Real estate investment manager. PSG and Al Hilal fan. Into luxury watches.',
    email: 'persona_jasmine@tennews.test', homeCountry: 'uae',
    subtopics: ['Real Estate', 'Oil & Energy', 'Soccer/Football', 'Corporate Deals'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.4, frustrationSpeed: 1.1 },
    curiosityKeywords: ['dubai', 'uae', 'saudi', 'abu dhabi', 'luxury', 'billion', 'supercar', 'penthouse', 'gold'],
    annoyanceKeywords: ['k-pop', 'anime', 'gaming', 'cosplay', 'comic book'],
    headlineTriggers: ['dubai', 'saudi', 'opec', 'oil price', 'psg', 'billion', 'luxury'],
    repetitionTolerance: 3,
  },
  {
    name: 'Tariq', age: 41, generation: 'Millennial', location: 'Karachi, Pakistan',
    bio: 'Senior banker at Habib Bank. Pakistan cricket fanatic. Manchester City fan.',
    email: 'persona_tariq@tennews.test', homeCountry: 'pakistan',
    subtopics: ['Cricket', 'Banking & Lending', 'Asian Politics', 'Trade & Tariffs'],
    personality: { patience: 0.7, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['pakistan', 'karachi', 'cricket', 'cpec', 'china', 'islamic finance', 'rupee'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'gaming', 'sneakers', 'nfl'],
    headlineTriggers: ['pakistan', 'cricket', 'babar', 'karachi', 'man city', 'cpec', 'psl'],
    repetitionTolerance: 4,
  },
  {
    name: 'Ayse', age: 34, generation: 'Millennial', location: 'Ankara, Turkey',
    bio: 'SaaS startup founder, just closed Series A. Follows AI tooling. Besiktas fan.',
    email: 'persona_ayse@tennews.test', homeCountry: 'turkiye',
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.4, frustrationSpeed: 1.1 },
    curiosityKeywords: ['women founder', 'remote work', 'saas', 'productivity', 'turkey', 'ankara', 'besiktas', 'space'],
    annoyanceKeywords: ['death toll', 'massacre', 'graphic', 'celebrity divorce'],
    headlineTriggers: ['billion valuation', 'acquired', 'unicorn', 'besiktas', 'turkey'],
    repetitionTolerance: 2,
  },
  // GEN X & BOOMERS (43-70) — 15 personas
  {
    name: 'Nadia', age: 48, generation: 'GenX', location: 'Berlin, Germany',
    bio: 'International relations professor at Humboldt. Specializes in NATO and Middle East policy.',
    email: 'persona_nadia@tennews.test', homeCountry: 'germany',
    subtopics: ['War & Conflict', 'Middle East', 'European Politics', 'Human Rights & Civil Liberties', 'US Politics', 'Asian Politics', 'Latin America', 'Africa & Oceania', 'Trade & Tariffs', 'Climate & Environment', 'Public Health'],
    personality: { patience: 1.0, saveRate: 0.12, baseSessions: [30, 55], flowMultiplier: 1.1, frustrationSpeed: 0.5 },
    curiosityKeywords: ['regulation', 'sanctions', 'climate summit', 'nuclear', 'treaty', 'exodus', 'displaced'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'gaming'],
    headlineTriggers: ['unprecedented', 'historic', 'classified', 'leaked'],
    repetitionTolerance: 5,
  },
  {
    name: 'Mike', age: 58, generation: 'GenX', location: 'Dallas, TX',
    bio: 'Retired Army colonel, military analyst. Dallas Cowboys fan for 40+ years. Loves F1 strategy.',
    email: 'persona_mike@tennews.test', homeCountry: 'usa',
    subtopics: ['NFL', 'US Politics', 'War & Conflict', 'F1 & Motorsport'],
    personality: { patience: 0.7, saveRate: 0.05, baseSessions: [25, 55], flowMultiplier: 1.2, frustrationSpeed: 0.8 },
    curiosityKeywords: ['military tech', 'drone', 'veteran', 'defense contractor', 'lockheed', 'boeing', 'navy', 'air force', 'texas', 'dallas'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'fashion week'],
    headlineTriggers: ['cowboys', 'pentagon', 'troops', 'general', 'classified', 'verstappen'],
    repetitionTolerance: 4,
  },
  {
    name: 'Robert', age: 68, generation: 'GenX', location: 'Tampa, FL',
    bio: 'Retired school principal. Tampa Bay Bucs and Rays fan. Follows gold prices.',
    email: 'persona_robert@tennews.test', homeCountry: 'usa',
    subtopics: ['US Politics', 'Public Health', 'Commodities', 'NFL'],
    personality: { patience: 0.9, saveRate: 0.06, baseSessions: [20, 45], flowMultiplier: 1.1, frustrationSpeed: 0.5 },
    curiosityKeywords: ['hurricane', 'florida', 'tampa', 'education', 'school', 'teacher', 'veteran', 'retirement', 'social security', 'weather'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'nft', 'metaverse', 'k-pop'],
    headlineTriggers: ['florida', 'tampa', 'buccaneers', 'gold price', 'social security'],
    repetitionTolerance: 6,
  },
  {
    name: 'Henrik', age: 52, generation: 'GenX', location: 'Geneva, Switzerland',
    bio: 'Former Swedish diplomat, now director at Geneva Centre for Security Policy.',
    email: 'persona_henrik@tennews.test', homeCountry: 'switzerland',
    subtopics: ['European Politics', 'Human Rights & Civil Liberties', 'Trade & Tariffs', 'Banking & Lending'],
    personality: { patience: 0.9, saveRate: 0.10, baseSessions: [25, 48], flowMultiplier: 1.1, frustrationSpeed: 0.5 },
    curiosityKeywords: ['switzerland', 'swiss', 'sweden', 'scandinavia', 'geneva', 'diplomat', 'ambassador', 'un', 'imf', 'world bank'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'sneakers', 'k-pop'],
    headlineTriggers: ['eu', 'nato', 'sanctions', 'historic', 'swiss', 'young boys'],
    repetitionTolerance: 5,
  },
  {
    name: 'Thomas', age: 46, generation: 'GenX', location: 'Amsterdam, Netherlands',
    bio: 'Climate journalist at NRC Handelsblad. Covers COP summits and EU Green Deal. Ajax fan.',
    email: 'persona_thomas@tennews.test', homeCountry: 'netherlands',
    subtopics: ['Climate & Environment', 'European Politics', 'Oil & Energy'],
    personality: { patience: 0.6, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.3, frustrationSpeed: 1.0 },
    curiosityKeywords: ['ev', 'electric', 'solar', 'wind', 'battery', 'pollution', 'ocean', 'flooding', 'amsterdam', 'dutch', 'netherlands'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'celebrity', 'kardashian'],
    headlineTriggers: ['record temperature', 'flooding', 'wildfire', 'ajax', 'netherlands'],
    repetitionTolerance: 3,
  },
  {
    name: 'Jennifer', age: 45, generation: 'GenX', location: 'Toronto, Canada',
    bio: 'High school science teacher. Toronto Raptors fan. Follows climate science and nature docs.',
    email: 'persona_jennifer@tennews.test', homeCountry: 'canada',
    subtopics: ['Public Health', 'Climate & Environment', 'Biology & Nature', 'NBA'],
    personality: { patience: 0.7, saveRate: 0.05, baseSessions: [18, 40], flowMultiplier: 1.3, frustrationSpeed: 0.9 },
    curiosityKeywords: ['canada', 'toronto', 'education', 'school', 'parent', 'children', 'iphone', 'apple', 'kid safety', 'food safety'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'hedge fund', 'derivatives'],
    headlineTriggers: ['raptors', 'toronto', 'canada', 'teacher', 'parent', 'apple'],
    repetitionTolerance: 3,
  },
  {
    name: 'Patricia', age: 55, generation: 'GenX', location: 'Washington DC',
    bio: 'Senior editor at The Washington Post. Covers US politics and government accountability.',
    email: 'persona_patricia@tennews.test', homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Corporate Deals', 'Movies & Film', 'European Politics', 'War & Conflict', 'TV & Streaming', 'Middle East', 'Medical Breakthroughs', 'Banking & Lending', 'Cybersecurity', 'Climate & Environment', 'Public Health', 'Music', 'Celebrity News'],
    personality: { patience: 0.9, saveRate: 0.09, baseSessions: [25, 50], flowMultiplier: 1.1, frustrationSpeed: 0.5 },
    curiosityKeywords: ['washington', 'congress', 'senate', 'journalist', 'press freedom', 'book', 'publisher', 'investigation'],
    annoyanceKeywords: ['crypto', 'gaming', 'cosplay', 'sneakers', 'tiktok dance'],
    headlineTriggers: ['washington', 'congress', 'supreme court', 'investigation', 'leaked', 'oscar'],
    repetitionTolerance: 5,
  },
  {
    name: 'Rashid', age: 62, generation: 'GenX', location: 'Riyadh, Saudi Arabia',
    bio: 'Retired petroleum engineer, now Aramco consultant. Al Hilal fan. Reads FT on his iPad.',
    email: 'persona_rashid@tennews.test', homeCountry: 'saudi_arabia',
    subtopics: ['Oil & Energy', 'Middle East', 'Soccer/Football', 'Trade & Tariffs'],
    personality: { patience: 0.8, saveRate: 0.06, baseSessions: [20, 45], flowMultiplier: 1.2, frustrationSpeed: 0.7 },
    curiosityKeywords: ['saudi', 'riyadh', 'aramco', 'opec', 'gulf', 'arabic', 'mosque', 'pilgrimage'],
    annoyanceKeywords: ['k-pop', 'gaming', 'cosplay', 'anime', 'tiktok', 'sneakers'],
    headlineTriggers: ['saudi', 'opec', 'oil price', 'al hilal', 'ronaldo', 'aramco', 'vision 2030'],
    repetitionTolerance: 5,
  },
  {
    name: 'Margaret', age: 64, generation: 'GenX', location: 'Edinburgh, Scotland',
    bio: 'Retired NHS nurse. Follows Scottish independence debate. Celtic fan. BBC nature docs.',
    email: 'persona_margaret@tennews.test', homeCountry: 'uk',
    subtopics: ['European Politics', 'Public Health', 'Biology & Nature', 'Climate & Environment'],
    personality: { patience: 0.9, saveRate: 0.07, baseSessions: [18, 38], flowMultiplier: 1.1, frustrationSpeed: 0.5 },
    curiosityKeywords: ['scotland', 'edinburgh', 'nhs', 'nurse', 'wildlife', 'animal', 'attenborough', 'queen', 'royal'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'gaming', 'influencer', 'meme stock', 'nfl'],
    headlineTriggers: ['scotland', 'celtic', 'nhs', 'edinburgh', 'wildlife', 'endangered', 'royal'],
    repetitionTolerance: 5,
  },
  {
    name: 'George', age: 70, generation: 'GenX', location: 'Phoenix, AZ',
    bio: 'Retired Air Force pilot. Follows space news religiously. Arizona Cardinals fan. Amateur astronomer.',
    email: 'persona_george@tennews.test', homeCountry: 'usa',
    subtopics: ['Space & Astronomy', 'US Politics', 'War & Conflict', 'Earth Science'],
    personality: { patience: 0.95, saveRate: 0.08, baseSessions: [20, 45], flowMultiplier: 1.1, frustrationSpeed: 0.4 },
    curiosityKeywords: ['nasa', 'space', 'mars', 'telescope', 'asteroid', 'pilot', 'air force', 'arizona', 'phoenix', 'desert'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'meme', 'crypto', 'streaming'],
    headlineTriggers: ['nasa', 'mars', 'telescope', 'asteroid', 'cardinals', 'air force', 'space'],
    repetitionTolerance: 6,
  },
  {
    name: 'Ingrid', age: 50, generation: 'GenX', location: 'Oslo, Norway',
    bio: 'Oil fund analyst at Norges Bank. Manages part of the worlds largest sovereign wealth fund.',
    email: 'persona_ingrid@tennews.test', homeCountry: 'norway',
    subtopics: ['Oil & Energy', 'Stock Markets', 'Climate & Environment', 'Banking & Lending', 'Commodities', 'Trade & Tariffs', 'Real Estate', 'Corporate Earnings', 'European Politics', 'Automotive', 'US Politics', 'Public Health', 'Corporate Deals', 'Retail & Consumer', 'Startups & Venture Capital', 'Middle East', 'War & Conflict'],
    personality: { patience: 0.8, saveRate: 0.07, baseSessions: [20, 45], flowMultiplier: 1.2, frustrationSpeed: 0.7 },
    curiosityKeywords: ['norway', 'oslo', 'nordic', 'scandinavia', 'sovereign fund', 'equinor', 'fjord', 'arctic'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'gaming', 'sneakers', 'reality tv'],
    headlineTriggers: ['norway', 'oil fund', 'equinor', 'arctic', 'nordic', 'oil price', 'rosenborg'],
    repetitionTolerance: 4,
  },
  {
    name: 'Larry', age: 59, generation: 'GenX', location: 'Detroit, MI',
    bio: 'Auto industry veteran — 30 years at Ford. Now consults on EV transitions. Lions diehard.',
    email: 'persona_larry@tennews.test', homeCountry: 'usa',
    subtopics: ['Automotive', 'NFL', 'Oil & Energy', 'Trade & Tariffs', 'Corporate Earnings', 'Real Estate', 'US Politics', 'Retail & Consumer', 'F1 & Motorsport'],
    personality: { patience: 0.7, saveRate: 0.05, baseSessions: [20, 45], flowMultiplier: 1.2, frustrationSpeed: 0.8 },
    curiosityKeywords: ['detroit', 'michigan', 'ford', 'gm', 'tesla', 'ev', 'electric', 'union', 'factory', 'manufacturing'],
    annoyanceKeywords: ['k-pop', 'anime', 'cosplay', 'influencer', 'tiktok', 'fashion'],
    headlineTriggers: ['ford', 'detroit', 'lions', 'ev', 'electric vehicle', 'auto', 'tariff'],
    repetitionTolerance: 4,
  },
  {
    name: 'Zara', age: 20, generation: 'GenZ', location: 'London, UK',
    bio: 'UCL sociology student and TikTok creator (45K). Sustainable fashion. Arsenal fan.',
    email: 'persona_zara@tennews.test', homeCountry: 'uk',
    subtopics: ['Climate & Environment', 'Mental Health', 'Soccer/Football', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.4, saveRate: 0.04, baseSessions: [15, 38], flowMultiplier: 1.6, frustrationSpeed: 1.7 },
    curiosityKeywords: ['london', 'uk', 'student', 'gen z', 'tiktok', 'viral', 'animal', 'rescue', 'billionaire', 'protest', 'affordable'],
    annoyanceKeywords: ['quarterly results', 'earnings', 'commodity', 'tariff', 'fed rate'],
    headlineTriggers: ['arsenal', 'saka', 'london', 'shocking', 'viral', 'gen z'],
    repetitionTolerance: 2,
  },
  {
    name: 'Devon', age: 21, generation: 'GenZ', location: 'Austin, TX',
    bio: 'UT Austin senior. NFL Draft junkie. NBA playoffs. Philadelphia Eagles fan. CoD competitor.',
    email: 'persona_devon@tennews.test', homeCountry: 'usa',
    subtopics: ['NFL', 'NBA', 'Boxing & MMA/UFC', 'Gaming', 'Sneakers & Streetwear', 'Soccer/Football', 'F1 & Motorsport', 'Music', 'MLB/Baseball', 'Olympics & Paralympics', 'Cricket'],
    personality: { patience: 0.3, saveRate: 0.02, baseSessions: [18, 42], flowMultiplier: 1.8, frustrationSpeed: 2.0 },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'elon', 'tesla', 'million dollar', 'world record', 'arrest'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'quarterly', 'fiscal', 'summit'],
    headlineTriggers: ['eagles', 'mavericks', 'luka', 'ufc', 'jordan', 'nike', 'world record'],
    repetitionTolerance: 2,
  },
  {
    name: 'Lars', age: 23, generation: 'GenZ', location: 'Stockholm, Sweden',
    bio: 'Semi-pro Counter-Strike player. Twitch streamer (8K). Follows gaming hardware.',
    email: 'persona_lars@tennews.test', homeCountry: 'sweden',
    subtopics: ['Gaming', 'AI & Machine Learning', 'Smartphones & Gadgets', 'Robotics & Hardware'],
    personality: { patience: 0.4, saveRate: 0.03, baseSessions: [18, 42], flowMultiplier: 1.7, frustrationSpeed: 1.7 },
    curiosityKeywords: ['sweden', 'stockholm', 'space', 'mars', 'rocket', 'nasa', 'viral', 'twitch', 'youtube', 'streamer'],
    annoyanceKeywords: ['policy', 'legislation', 'committee', 'fiscal', 'tariff', 'trade deal'],
    headlineTriggers: ['nvidia', 'steam', 'playstation', 'xbox', 'aik', 'sweden'],
    repetitionTolerance: 2,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatDwell(dwell) {
  if (dwell >= 60) return `${Math.floor(dwell / 60)}m${Math.round(dwell % 60)}s`;
  if (dwell >= 1) return `${dwell.toFixed(1)}s`;
  return `${(dwell * 1000).toFixed(0)}ms`;
}
function dwellBar(dwell, maxDwell) {
  const len = Math.min(20, Math.max(1, Math.round((dwell / Math.max(maxDwell, 1)) * 20)));
  if (dwell >= 10) return '\u2588'.repeat(len);
  if (dwell >= 3) return '\u2593'.repeat(len);
  if (dwell >= 1) return '\u2592'.repeat(len);
  return '\u2591'.repeat(len);
}
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
  const matchedSubtopics = [];
  for (const [subtopicName, keywords] of Object.entries(profile.subtopicKeywords)) {
    const hit = keywords.some(kw => combined.includes(kw));
    const catHit = SUBTOPIC_MAP[subtopicName].categories.includes(category);
    if (hit || catHit) matchedSubtopics.push(subtopicName);
  }
  return matchedSubtopics;
}

// ============================================================================
// BEHAVIOR ENGINE V2 — Ultra-realistic with flow state + frustration cascade
// ============================================================================

function simulateReaction(persona, article, profile, ctx) {
  const tags = getArticleTags(article);
  const category = (article.category || '').trim();
  const title = (article.title || article.title_news || '').toLowerCase();
  const combined = [...tags, ...title.split(/\s+/)].join(' ').toLowerCase();

  let score = 0;
  const matchedSubtopics = matchArticleToSubtopics(article, profile);
  const isRelevant = matchedSubtopics.length > 0;

  // Subtopic match scoring
  if (matchedSubtopics.length >= 3) score += 0.65;
  else if (matchedSubtopics.length === 2) score += 0.5;
  else if (matchedSubtopics.length === 1) score += 0.3;

  // Direct keyword matching
  let keywordHits = 0;
  for (const kw of profile.allTags) {
    if (combined.includes(kw)) keywordHits++;
  }
  score += Math.min(0.35, keywordHits * 0.05);

  // Category match
  if (profile.allCategories.includes(category)) score += 0.15;

  // No match penalty
  if (!isRelevant && !profile.allCategories.includes(category)) score -= 0.25;

  // --- CURIOSITY ---
  if (persona.curiosityKeywords && !isRelevant) {
    const curiosityHits = persona.curiosityKeywords.filter(kw => combined.includes(kw)).length;
    if (curiosityHits >= 3) score += 0.4;
    else if (curiosityHits >= 2) score += 0.3;
    else if (curiosityHits === 1) score += 0.18;
  }

  // --- ANNOYANCE ---
  if (persona.annoyanceKeywords) {
    const annoyHits = persona.annoyanceKeywords.filter(kw => combined.includes(kw)).length;
    if (annoyHits >= 3) score -= 0.45;
    else if (annoyHits >= 2) score -= 0.3;
    else if (annoyHits === 1) score -= 0.18;
  }

  // --- HEADLINE TRIGGERS ---
  if (persona.headlineTriggers) {
    const triggerHits = persona.headlineTriggers.filter(kw => title.includes(kw)).length;
    if (triggerHits >= 3) score += 0.5;
    else if (triggerHits >= 2) score += 0.35;
    else if (triggerHits === 1) score += 0.2;
  }

  // --- STORY-LEVEL REPETITION ---
  const titleWords = title.split(/\s+/).filter(w => w.length > 3);
  const storyKeys = [];
  for (let i = 0; i < titleWords.length - 1; i++) {
    storyKeys.push(titleWords.slice(i, i + 2).join(' '));
  }
  const tolerance = persona.repetitionTolerance || 3;
  let storyRepeatPenalty = 0;
  for (const key of storyKeys) {
    const seen = ctx.storyTracker[key] || 0;
    if (seen >= tolerance) {
      storyRepeatPenalty = Math.max(storyRepeatPenalty, -0.2 - 0.08 * (seen - tolerance));
    }
  }
  score += storyRepeatPenalty;

  // --- FLOW STATE: consecutive engagements boost willingness ---
  if (ctx.consecutiveEngages >= 5) score += 0.18;
  else if (ctx.consecutiveEngages >= 3) score += 0.12;
  else if (ctx.consecutiveEngages >= 2) score += 0.06;

  // --- FRUSTRATION CASCADE: consecutive skips lower willingness ---
  if (ctx.consecutiveSkips >= 5) score -= 0.2;
  else if (ctx.consecutiveSkips >= 3) score -= 0.12;
  else if (ctx.consecutiveSkips >= 2) score -= 0.06;

  // --- VARIETY CRAVING: too many from same category = craves diversity ---
  const catSeenCount = ctx.categorySeen[category] || 0;
  const catSharePct = ctx.totalSeen > 0 ? catSeenCount / ctx.totalSeen : 0;
  if (catSharePct > 0.4 && catSeenCount >= 8) score -= 0.15;
  else if (catSharePct > 0.3 && catSeenCount >= 6 && !isRelevant) score -= 0.08;

  // Quality boost
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += 0.12;
  else if (aiScore >= 800) score += 0.06;

  // Breaking news
  if (/breaking|just in|exclusive/i.test(title)) score += 0.1;

  // Progressive fatigue within session (realistic scroll fatigue)
  const idx = ctx.articleIndex;
  const fatigueBase = persona.personality.frustrationSpeed;
  if (idx > 8) score -= 0.02 * fatigueBase;
  if (idx > 15) score -= 0.03 * fatigueBase;
  if (idx > 25) score -= 0.04 * fatigueBase;
  if (idx > 35) score -= 0.06 * fatigueBase;
  if (idx > 50) score -= 0.08 * fatigueBase;

  // Mood affects willingness
  if (ctx.satisfaction < 25) score -= 0.2;
  else if (ctx.satisfaction < 35) score -= 0.12;
  else if (ctx.satisfaction < 45) score -= 0.05;
  // HIGH mood boosts engagement (they're in a good mood, more open)
  if (ctx.satisfaction > 75) score += 0.08;
  else if (ctx.satisfaction > 65) score += 0.04;

  // Momentum from matching subtopics
  if (ctx.lastMatchedSubtopics.length > 0 && matchedSubtopics.some(s => ctx.lastMatchedSubtopics.includes(s))) {
    score += 0.1;
  }

  // Random variance (smaller, more realistic)
  score += (Math.random() - 0.5) * 0.12;

  const patience = persona.personality.patience;

  // Like rate: users like articles they find genuinely interesting
  // Gen Z: higher like rate (social media native), Gen X: lower (more selective)
  const baseLikeRate = persona.personality.saveRate * 3; // likes are ~3x more common than saves
  const baseShareRate = persona.personality.saveRate * 0.5; // shares are rarer than saves

  // Determine action with tiered dwell (professional-grade, TikTok/Pinterest style)
  if (score >= 0.6) {
    // DEEP READ: 12-50s dwell, may like/save/share
    const flowBonus = ctx.consecutiveEngages >= 3 ? 1.3 : 1.0;
    const dwell = (12 + Math.random() * 38) * patience * flowBonus;
    const shouldSave = Math.random() < persona.personality.saveRate * (score >= 0.8 ? 2.5 : 1.5);
    const shouldLike = Math.random() < baseLikeRate * (score >= 0.8 ? 2.0 : 1.0);
    const shouldShare = Math.random() < baseShareRate * (score >= 0.9 ? 3.0 : 1.0);
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    if (shouldLike) events.push('article_liked');
    if (shouldShare) events.push('article_shared');
    const moodDelta = shouldSave ? +(6 + Math.random() * 5) : shouldLike ? +(5 + Math.random() * 4) : +(4 + Math.random() * 4);
    const dwellTier = dwell >= 45 ? 'absorbed' : dwell >= 25 ? 'deep_read' : 'engaged_read';
    return { action: 'DEEP_READ', dwell, dwellTier, events, signal: 'ENGAGE', save: shouldSave, like: shouldLike, share: shouldShare, matchedSubtopics, moodDelta, score };
  }
  if (score >= 0.3) {
    // ENGAGED READ: 6-16s dwell, may like
    const dwell = (6 + Math.random() * 10) * patience;
    const shouldSave = Math.random() < persona.personality.saveRate * 0.5;
    const shouldLike = Math.random() < baseLikeRate * 0.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    if (shouldLike) events.push('article_liked');
    const moodDelta = shouldLike ? +(3 + Math.random() * 3) : +(2 + Math.random() * 3);
    const dwellTier = dwell >= 12 ? 'engaged_read' : 'light_read';
    return { action: 'ENGAGE', dwell, dwellTier, events, signal: 'ENGAGE', save: shouldSave, like: shouldLike, share: false, matchedSubtopics, moodDelta, score };
  }
  if (score >= 0.05) {
    // GLANCE: 3-6s dwell
    const dwell = (3 + Math.random() * 3) * patience;
    return { action: 'GLANCE', dwell, dwellTier: 'glance', events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', save: false, like: false, share: false, matchedSubtopics, moodDelta: -0.5, score };
  }
  if (score >= -0.1) {
    // SCAN: 1-3s dwell (quick skip)
    const dwell = 1 + Math.random() * 2;
    return { action: 'SCAN', dwell, dwellTier: 'quick_skip', events: ['article_skipped'], signal: 'SKIP', save: false, like: false, share: false, matchedSubtopics, moodDelta: -2.5, score };
  }

  // INSTANT SKIP: <1s (frustration cascade)
  const dwell = 0.2 + Math.random() * 0.6;
  const basePenalty = matchedSubtopics.length === 0 ? -4 : -2;
  const cascadePenalty = ctx.consecutiveSkips >= 4 ? -2.5 : ctx.consecutiveSkips >= 2 ? -1.5 : 0;
  return { action: 'SKIP', dwell, dwellTier: 'instant_skip', events: ['article_skipped'], signal: 'SKIP', save: false, like: false, share: false, matchedSubtopics, moodDelta: basePenalty + cascadePenalty, score };
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

function getAccessToken(email, password) {
  const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  return c.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) return null;
    return data.session.access_token;
  });
}

async function setupPersona(persona) {
  let userId;
  let accessToken;

  const { data, error } = await adminDb.auth.admin.createUser({
    email: persona.email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `${persona.name} (Test Persona)` },
  });
  if (error) {
    const signInClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({ email: persona.email, password: PASSWORD });
    if (signInError) { console.error(`  [SETUP] Cannot sign in ${persona.name}: ${signInError.message}`); return null; }
    userId = signInData.user.id;
    accessToken = signInData.session.access_token;
  } else {
    userId = data.user.id;
    await sleep(600);
    accessToken = await getAccessToken(persona.email, PASSWORD);
  }

  if (!accessToken) { console.error(`  [SETUP] No token for ${persona.name}`); return null; }

  // Clean slate for fresh test
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);

  // V3: Clean personalization_profiles, engagement_buffer, entity_affinity
  const { data: ppRow } = await adminDb.from('personalization_profiles').select('personalization_id').eq('auth_profile_id', userId).maybeSingle();
  if (ppRow) {
    await adminDb.from('engagement_buffer').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('user_entity_affinity').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('user_sessions').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('personalization_profiles').delete().eq('personalization_id', ppRow.personalization_id);
  }

  // No seed vector needed — the feed's getQueryVectors will use followed_topics
  // to find 1 representative article per subtopic category directly
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

  // V3: Create personalization_profiles row (no taste vector — feed uses followed_topics directly)
  await adminDb.from('personalization_profiles').insert({
    auth_profile_id: userId,
    phase: 1,
    total_interactions: 0,
  });

  return { userId, accessToken };
}

// ============================================================================
// SESSION SIMULATION — Dynamic length based on mood
// ============================================================================

async function simulateSession(persona, userId, accessToken, sessionNum, profile, priorHistory = {}) {
  const sessionId = `sim_v3_${persona.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;

  // User reads up to MAX_ARTICLES_PER_SESSION articles (or leaves early if bored)
  // Feed can load as many pages as needed from the database
  const maxArticlesBase = MAX_ARTICLES_PER_SESSION || 50;
  const maxPages = Math.ceil(maxArticlesBase / 25) + 3; // enough pages to reach the max

  // Carry over accumulated history so the feed knows what user already saw/liked
  const engagedIds = [...(priorHistory.engagedIds || [])];
  const skippedIds = [...(priorHistory.skippedIds || [])];
  const seenIds = [...(priorHistory.seenIds || [])];
  const interactions = [];
  let cursor = null;
  let totalTracked = 0;

  const ctx = {
    articleIndex: 0,
    consecutiveSkips: 0,
    consecutiveEngages: 0,
    lastMatchedSubtopics: [],
    satisfaction: 50,
    engagedCount: 0,
    savedCount: 0,
    likedCount: 0,
    sharedCount: 0,
    totalSeen: 0,
    categorySeen: {},
    categoryEngaged: {},
    subtopicSeen: {},
    subtopicEngaged: {},
    storyTracker: {},
    flowExtended: false, // track if session was extended by flow state
  };

  let exitType = 'natural';
  let dynamicMax = maxArticlesBase;

  for (let page = 1; page <= maxPages; page++) {
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    for (const article of resp.articles) {
      const id = String(article.id);
      seenIds.push(id);
      ctx.articleIndex = interactions.length;
      ctx.totalSeen = interactions.length + 1;
      const category = (article.category || '').trim();
      ctx.categorySeen[category] = (ctx.categorySeen[category] || 0) + 1;

      const reaction = simulateReaction(persona, article, profile, ctx);

      // Update story tracker
      const artTitle = (article.title || article.title_news || '').toLowerCase();
      const artWords = artTitle.split(/\s+/).filter(w => w.length > 3);
      for (let i = 0; i < artWords.length - 1; i++) {
        const key = artWords.slice(i, i + 2).join(' ');
        ctx.storyTracker[key] = (ctx.storyTracker[key] || 0) + 1;
      }

      // Track subtopic hits
      for (const st of reaction.matchedSubtopics) {
        ctx.subtopicSeen[st] = (ctx.subtopicSeen[st] || 0) + 1;
      }

      // Update satisfaction
      ctx.satisfaction = Math.max(0, Math.min(100, ctx.satisfaction + reaction.moodDelta));

      // Natural fatigue
      if (ctx.articleIndex > 0 && ctx.articleIndex % 5 === 0) ctx.satisfaction = Math.max(0, ctx.satisfaction - 1.5);
      if (ctx.articleIndex > 20) ctx.satisfaction = Math.max(0, ctx.satisfaction - 0.3);

      const cleanTitle = (article.title || article.title_news || '').replace(/\*\*/g, '').substring(0, 60);

      // Track events through real API with professional tiered dwell metadata
      for (const eventType of reaction.events) {
        const eventData = {
          event_type: eventType, article_id: parseInt(id), session_id: sessionId,
          category: article.category || null, source: article.source || null, metadata: {},
        };
        // All events get dwell + tier metadata for the tiered weighting system
        const baseMeta = {
          dwell: String(reaction.dwell.toFixed(1)),
          total_active_seconds: String(Math.round(reaction.dwell)),
          dwell_tier: reaction.dwellTier || 'unknown',
          bucket: article.bucket || 'unknown',
        };
        if (eventType === 'article_engaged') eventData.metadata = { ...baseMeta, engaged_seconds: String(Math.round(reaction.dwell)) };
        else if (eventType === 'article_skipped') eventData.metadata = baseMeta;
        else if (eventType === 'article_detail_view') eventData.metadata = baseMeta;
        else if (eventType === 'article_liked') eventData.metadata = baseMeta;
        else if (eventType === 'article_shared') eventData.metadata = baseMeta;
        else if (eventType === 'article_saved') eventData.metadata = baseMeta;
        else if (eventType === 'article_exit') eventData.metadata = { total_active_seconds: String(Math.round(reaction.dwell)) };

        try { await trackEvent(accessToken, eventData); totalTracked++; } catch (e) {}
        await sleep(DELAY_BETWEEN_EVENTS_MS);
      }

      // Update context
      if (reaction.signal === 'ENGAGE') {
        engagedIds.push(id);
        ctx.consecutiveSkips = 0;
        ctx.consecutiveEngages++;
        ctx.lastMatchedSubtopics = reaction.matchedSubtopics;
        ctx.engagedCount++;
        ctx.categoryEngaged[category] = (ctx.categoryEngaged[category] || 0) + 1;
        if (reaction.save) ctx.savedCount++;
        if (reaction.like) ctx.likedCount++;
        if (reaction.share) ctx.sharedCount++;
        for (const st of reaction.matchedSubtopics) {
          ctx.subtopicEngaged[st] = (ctx.subtopicEngaged[st] || 0) + 1;
        }
      } else if (reaction.signal === 'SKIP') {
        skippedIds.push(id);
        ctx.consecutiveSkips++;
        ctx.consecutiveEngages = 0;
        ctx.lastMatchedSubtopics = [];
      } else {
        ctx.consecutiveEngages = 0;
        if (reaction.signal === 'GLANCE') ctx.consecutiveSkips = 0;
        else ctx.consecutiveSkips++;
      }

      // Record interaction
      interactions.push({
        num: interactions.length + 1, id, title: cleanTitle, category,
        bucket: article.bucket || '-', action: reaction.action, signal: reaction.signal,
        dwell: reaction.dwell, dwellTier: reaction.dwellTier || '-',
        save: reaction.save, like: reaction.like || false, share: reaction.share || false,
        mood: Math.round(ctx.satisfaction),
        matchedSubtopics: reaction.matchedSubtopics, score: reaction.score,
        source: (article.source || '').substring(0, 30),
        createdAt: article.created_at || article.createdAt || null,
      });

      // --- DYNAMIC SESSION LENGTH ---
      // Flow state extension: if user is in flow, extend the session
      if (interactions.length >= dynamicMax && ctx.consecutiveEngages >= 3 && ctx.satisfaction > 60) {
        const extension = Math.round(dynamicMax * (persona.personality.flowMultiplier - 1));
        dynamicMax += extension;
        ctx.flowExtended = true;
      }

      // Exit decisions (more realistic)
      const frustSpeed = persona.personality.frustrationSpeed;
      if (ctx.satisfaction <= 15 && interactions.length >= 5) { exitType = 'frustrated'; break; }
      if (ctx.satisfaction <= 25 && ctx.consecutiveSkips >= Math.round(4 / frustSpeed) && interactions.length >= 5) { exitType = 'frustrated'; break; }
      if (ctx.satisfaction <= 30 && ctx.consecutiveSkips >= Math.round(3 / frustSpeed)) { exitType = 'bored'; break; }
      if (ctx.satisfaction <= 38 && ctx.consecutiveSkips >= Math.round(5 / frustSpeed)) { exitType = 'bored'; break; }
      if (ctx.satisfaction <= 35 && interactions.length >= 10 && ctx.engagedCount < interactions.length * 0.2) { exitType = 'bored'; break; }
      if (interactions.length >= dynamicMax) { exitType = 'natural'; break; }
    }

    if (exitType !== 'natural' || interactions.length >= dynamicMax) break;
    await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  const thisSessionSkips = interactions.filter(i => i.signal === 'SKIP').length;
  const thisSessionEngaged = interactions.filter(i => i.signal === 'ENGAGE').length;
  const thisSessionRelevant = interactions.filter(i => i.matchedSubtopics.length > 0).length;
  const thisSessionDeepReads = interactions.filter(i => i.action === 'DEEP_READ').length;
  const thisSessionDwell = interactions.reduce((s, i) => s + i.dwell, 0);

  return {
    sessionNum, sessionId, interactions, totalTracked, exitType,
    finalSatisfaction: Math.round(ctx.satisfaction),
    flowExtended: ctx.flowExtended,
    accumulatedHistory: { engagedIds: [...engagedIds], skippedIds: [...skippedIds], seenIds: [...seenIds] },
    stats: {
      total: interactions.length, engaged: ctx.engagedCount,
      saved: ctx.savedCount, liked: ctx.likedCount, shared: ctx.sharedCount,
      skipped: thisSessionSkips,
      avgDwell: interactions.reduce((s, i) => s + i.dwell, 0) / (interactions.length || 1),
      engRate: interactions.length > 0 ? ctx.engagedCount / interactions.length : 0,
      relevantRate: interactions.length > 0 ? thisSessionRelevant / interactions.length : 0,
      deepReadRate: interactions.length > 0 ? thisSessionDeepReads / interactions.length : 0,
      totalDwell: thisSessionDwell,
      categorySeen: ctx.categorySeen, categoryEngaged: ctx.categoryEngaged,
      subtopicSeen: ctx.subtopicSeen, subtopicEngaged: ctx.subtopicEngaged,
    },
  };
}

// ============================================================================
// SCORING
// ============================================================================

function scorePersona(persona, sessions, profile) {
  const allInteractions = sessions.flatMap(s => s.interactions);
  const total = allInteractions.length;
  if (total === 0) return { relevance: 1, coverage: 1, diversity: 1, quality: 1, wouldReturn: 1, total: 20 };

  const relevant = allInteractions.filter(i => i.matchedSubtopics.length > 0).length;
  const relevanceRate = relevant / total;
  const relevance = relevanceRate >= 0.7 ? 5 : relevanceRate >= 0.5 ? 4 : relevanceRate >= 0.35 ? 3 : relevanceRate >= 0.2 ? 2 : 1;

  const subtopicsWithContent = new Set();
  for (const i of allInteractions) for (const st of i.matchedSubtopics) subtopicsWithContent.add(st);
  const coverageRate = subtopicsWithContent.size / persona.subtopics.length;
  const coverage = coverageRate >= 1.0 ? 5 : coverageRate >= 0.75 ? 4 : coverageRate >= 0.5 ? 3 : coverageRate >= 0.25 ? 2 : 1;

  const catCounts = {};
  for (const i of allInteractions) catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  const cats = Object.values(catCounts);
  const maxCatShare = Math.max(...cats) / total;
  const numCats = cats.length;
  const diversity = (maxCatShare <= 0.3 && numCats >= 4) ? 5 : (maxCatShare <= 0.4 && numCats >= 3) ? 4 : (maxCatShare <= 0.5 && numCats >= 3) ? 3 : (maxCatShare <= 0.6) ? 2 : 1;

  const engagedArticles = allInteractions.filter(i => i.signal === 'ENGAGE');
  const avgEngDwell = engagedArticles.length > 0 ? engagedArticles.reduce((s, i) => s + i.dwell, 0) / engagedArticles.length : 0;
  const engRate = engagedArticles.length / total;
  const qualityScore = (avgEngDwell * 0.3) + (engRate * 10);
  const quality = qualityScore >= 6 ? 5 : qualityScore >= 4 ? 4 : qualityScore >= 2.5 ? 3 : qualityScore >= 1.5 ? 2 : 1;

  const avgSat = sessions.reduce((s, sess) => s + sess.finalSatisfaction, 0) / sessions.length;
  const frustrations = sessions.filter(s => s.exitType === 'frustrated').length;
  let wouldReturn;
  if (avgSat >= 65 && frustrations === 0) wouldReturn = 5;
  else if (avgSat >= 50 && frustrations <= 1) wouldReturn = 4;
  else if (avgSat >= 38) wouldReturn = 3;
  else if (avgSat >= 25) wouldReturn = 2;
  else wouldReturn = 1;

  return { relevance, coverage, diversity, quality, wouldReturn, total: relevance + coverage + diversity + quality + wouldReturn };
}

// ============================================================================
// TREND COMPUTATION
// ============================================================================

function computeTrend(values) {
  if (values.length < 2) return { direction: 'flat', delta: 0, pctChange: 0, slope: 0, first: values[0] || 0, second: values[0] || 0 };
  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.floor(values.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const delta = avgSecond - avgFirst;
  const pctChange = avgFirst > 0 ? ((delta / avgFirst) * 100) : 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xMean) * (values[i] - yMean); den += (i - xMean) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const direction = pctChange > 8 ? 'improving' : pctChange < -8 ? 'declining' : 'flat';
  return { direction, delta, pctChange, slope, first: avgFirst, second: avgSecond };
}

function trendArrow(trend) {
  if (trend.direction === 'improving') return '📈';
  if (trend.direction === 'declining') return '📉';
  return '➡️';
}

function sparkline(values, width = 12) {
  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => chars[Math.min(chars.length - 1, Math.floor(((v - min) / range) * (chars.length - 1)))]).join('');
}

// ============================================================================
// GRAND REPORT — Ultra detailed V7
// ============================================================================

function printGrandReport(allResults) {
  const THICK = '━'.repeat(140);
  const numSessions = SESSIONS_PER_PERSONA;

  console.log(`\n\n${THICK}`);
  console.log('  GRAND REPORT — 50 PERSONAS V3 ALGORITHM (sliding window + entity affinity, varied subtopics 3-19)');
  console.log(THICK);

  const ranked = allResults.sort((a, b) => b.scores.total - a.scores.total);

  // ── PERSONA SCORECARD ──
  console.log('\n  PERSONA SCORECARD:');
  console.log('  ' + '#'.padEnd(4) + 'Name'.padEnd(12) + 'Gen'.padEnd(6) + 'Articles'.padStart(9) + '  Subtopics'.padEnd(46) + 'Relev'.padStart(6) + 'Cover'.padStart(6) + 'Diver'.padStart(6) + 'Qual'.padStart(6) + 'Return'.padStart(7) + 'TOTAL'.padStart(7) + 'Score'.padStart(7));
  console.log('  ' + '─'.repeat(136));

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const totalArts = r.sessions.reduce((s, ses) => s + ses.stats.total, 0);
    const subtopicStr = r.persona.subtopics.join(', ').substring(0, 44);
    const pctScore = ((r.scores.total / 25) * 100).toFixed(0);
    console.log('  ' +
      `${i + 1}.`.padEnd(4) + r.persona.name.padEnd(12) + (r.persona.generation || '').padEnd(6) +
      String(totalArts).padStart(9) + `  ${subtopicStr}`.padEnd(46) +
      `${r.scores.relevance}/5`.padStart(6) + `${r.scores.coverage}/5`.padStart(6) +
      `${r.scores.diversity}/5`.padStart(6) + `${r.scores.quality}/5`.padStart(6) +
      `${r.scores.wouldReturn}/5`.padStart(7) + `${r.scores.total}/25`.padStart(7) +
      `${pctScore}%`.padStart(7)
    );
  }

  const avgScores = {
    relevance: ranked.reduce((s, r) => s + r.scores.relevance, 0) / ranked.length,
    coverage: ranked.reduce((s, r) => s + r.scores.coverage, 0) / ranked.length,
    diversity: ranked.reduce((s, r) => s + r.scores.diversity, 0) / ranked.length,
    quality: ranked.reduce((s, r) => s + r.scores.quality, 0) / ranked.length,
    wouldReturn: ranked.reduce((s, r) => s + r.scores.wouldReturn, 0) / ranked.length,
  };
  const avgTotal = Object.values(avgScores).reduce((a, b) => a + b, 0);
  const overallScore = ((avgTotal / 25) * 100).toFixed(0);

  console.log('  ' + '─'.repeat(136));
  console.log('  ' + 'AVG'.padEnd(4) + ''.padEnd(73) +
    `${avgScores.relevance.toFixed(1)}`.padStart(6) + `${avgScores.coverage.toFixed(1)}`.padStart(6) +
    `${avgScores.diversity.toFixed(1)}`.padStart(6) + `${avgScores.quality.toFixed(1)}`.padStart(6) +
    `${avgScores.wouldReturn.toFixed(1)}`.padStart(7) + `${avgTotal.toFixed(1)}`.padStart(7) +
    `${overallScore}%`.padStart(7)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PERSONALIZATION OVER TIME — THE KEY ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  PERSONALIZATION OVER TIME — Does the feed get better as users read more?');
  console.log(THICK);

  const perSessionAgg = [];
  for (let sn = 0; sn < numSessions; sn++) {
    const sessionData = { engRates: [], relevRates: [], dwells: [], satisfactions: [], deepReadRates: [], articleCounts: [], skipRates: [], saveRates: [] };
    for (const r of ranked) {
      if (r.sessions[sn]) {
        const s = r.sessions[sn];
        sessionData.engRates.push(s.stats.engRate);
        sessionData.relevRates.push(s.stats.relevantRate || 0);
        sessionData.dwells.push(s.stats.avgDwell);
        sessionData.satisfactions.push(s.finalSatisfaction);
        sessionData.deepReadRates.push(s.stats.deepReadRate || 0);
        sessionData.articleCounts.push(s.stats.total);
        sessionData.skipRates.push(s.stats.total > 0 ? s.stats.skipped / s.stats.total : 0);
        sessionData.saveRates.push(s.stats.total > 0 ? s.stats.saved / s.stats.total : 0);
      }
    }
    const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    perSessionAgg.push({
      session: sn + 1,
      avgEngRate: avg(sessionData.engRates),
      avgRelevRate: avg(sessionData.relevRates),
      avgDwell: avg(sessionData.dwells),
      avgSatisfaction: avg(sessionData.satisfactions),
      avgDeepReadRate: avg(sessionData.deepReadRates),
      avgArticles: avg(sessionData.articleCounts),
      avgSkipRate: avg(sessionData.skipRates),
      avgSaveRate: avg(sessionData.saveRates),
      count: sessionData.engRates.length,
    });
  }

  // Session-over-session table
  console.log('\n  SESSION-BY-SESSION AVERAGES (across all 50 personas):');
  console.log('  ' + 'Session'.padEnd(10) + 'Eng%'.padStart(8) + 'Relev%'.padStart(9) + 'Dwell'.padStart(9) + 'DeepRd%'.padStart(10) + 'Skip%'.padStart(8) + 'Save%'.padStart(8) + 'Satisfaction'.padStart(14) + 'Articles'.padStart(10));
  console.log('  ' + '─'.repeat(90));
  for (const s of perSessionAgg) {
    console.log('  ' +
      `S${s.session}`.padEnd(10) +
      `${(s.avgEngRate * 100).toFixed(1)}%`.padStart(8) +
      `${(s.avgRelevRate * 100).toFixed(1)}%`.padStart(9) +
      `${formatDwell(s.avgDwell)}`.padStart(9) +
      `${(s.avgDeepReadRate * 100).toFixed(1)}%`.padStart(10) +
      `${(s.avgSkipRate * 100).toFixed(1)}%`.padStart(8) +
      `${(s.avgSaveRate * 100).toFixed(1)}%`.padStart(8) +
      `${s.avgSatisfaction.toFixed(1)}`.padStart(14) +
      `${s.avgArticles.toFixed(1)}`.padStart(10)
    );
  }

  // Cumulative article milestones (every 50 articles)
  console.log(`\n  ENGAGEMENT BY ARTICLE COUNT MILESTONE (cumulative across sessions):`);
  console.log('  ' + 'Milestone'.padEnd(12) + 'Avg Eng%'.padStart(10) + 'Avg Relev%'.padStart(12) + 'Avg Skip%'.padStart(11) + 'Avg Dwell'.padStart(11) + 'Personas'.padStart(10));
  console.log('  ' + '─'.repeat(70));

  const milestones = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  for (const milestone of milestones) {
    const milestoneData = { engRates: [], relevRates: [], skipRates: [], dwells: [] };
    for (const r of ranked) {
      const allInts = r.sessions.flatMap(s => s.interactions);
      if (allInts.length < milestone) continue;
      // Look at articles [milestone-50, milestone] window
      const window = allInts.slice(Math.max(0, milestone - 50), milestone);
      const eng = window.filter(i => i.signal === 'ENGAGE').length;
      const relev = window.filter(i => i.matchedSubtopics.length > 0).length;
      const skip = window.filter(i => i.signal === 'SKIP').length;
      const dwell = window.reduce((s, i) => s + i.dwell, 0) / window.length;
      milestoneData.engRates.push(eng / window.length);
      milestoneData.relevRates.push(relev / window.length);
      milestoneData.skipRates.push(skip / window.length);
      milestoneData.dwells.push(dwell);
    }
    if (milestoneData.engRates.length === 0) continue;
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    console.log('  ' +
      `${milestone}`.padEnd(12) +
      `${(avg(milestoneData.engRates) * 100).toFixed(1)}%`.padStart(10) +
      `${(avg(milestoneData.relevRates) * 100).toFixed(1)}%`.padStart(12) +
      `${(avg(milestoneData.skipRates) * 100).toFixed(1)}%`.padStart(11) +
      `${formatDwell(avg(milestoneData.dwells))}`.padStart(11) +
      `${milestoneData.engRates.length}`.padStart(10)
    );
  }

  // Trend analysis
  const engTrend = computeTrend(perSessionAgg.map(s => s.avgEngRate));
  const relevTrend = computeTrend(perSessionAgg.map(s => s.avgRelevRate));
  const dwellTrend = computeTrend(perSessionAgg.map(s => s.avgDwell));
  const satTrend = computeTrend(perSessionAgg.map(s => s.avgSatisfaction));
  const deepTrend = computeTrend(perSessionAgg.map(s => s.avgDeepReadRate));
  const skipTrend = computeTrend(perSessionAgg.map(s => s.avgSkipRate));
  const articlesTrend = computeTrend(perSessionAgg.map(s => s.avgArticles));
  const saveTrend = computeTrend(perSessionAgg.map(s => s.avgSaveRate));

  console.log('\n  TREND ANALYSIS (first 5 sessions vs last 5 sessions):');
  console.log('  ' + '─'.repeat(100));
  const trends = [
    { name: 'Engagement Rate', trend: engTrend, spark: sparkline(perSessionAgg.map(s => s.avgEngRate)), good: 'improving' },
    { name: 'Relevance Rate', trend: relevTrend, spark: sparkline(perSessionAgg.map(s => s.avgRelevRate)), good: 'improving' },
    { name: 'Avg Dwell Time', trend: dwellTrend, spark: sparkline(perSessionAgg.map(s => s.avgDwell)), good: 'improving' },
    { name: 'Deep Read Rate', trend: deepTrend, spark: sparkline(perSessionAgg.map(s => s.avgDeepReadRate)), good: 'improving' },
    { name: 'Save Rate', trend: saveTrend, spark: sparkline(perSessionAgg.map(s => s.avgSaveRate)), good: 'improving' },
    { name: 'Satisfaction', trend: satTrend, spark: sparkline(perSessionAgg.map(s => s.avgSatisfaction)), good: 'improving' },
    { name: 'Skip Rate', trend: skipTrend, spark: sparkline(perSessionAgg.map(s => s.avgSkipRate)), good: 'declining' },
    { name: 'Session Length', trend: articlesTrend, spark: sparkline(perSessionAgg.map(s => s.avgArticles)), good: 'improving' },
  ];

  for (const t of trends) {
    const arrow = trendArrow(t.trend);
    const isGood = (t.good === 'improving' && t.trend.direction === 'improving') || (t.good === 'declining' && t.trend.direction === 'declining');
    const isBad = (t.good === 'improving' && t.trend.direction === 'declining') || (t.good === 'declining' && t.trend.direction === 'improving');
    const verdict = isGood ? '(GOOD)' : isBad ? '(CONCERN)' : '(STABLE)';
    console.log(`  ${arrow} ${t.name.padEnd(20)} ${t.spark}  ${t.trend.direction.padEnd(10)} ${t.trend.pctChange >= 0 ? '+' : ''}${t.trend.pctChange.toFixed(1)}%  ${verdict}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GENERATION COMPARISON
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  GENERATION COMPARISON');
  console.log(THICK);

  const gens = ['GenZ', 'Millennial', 'GenX'];
  console.log('  ' + 'Generation'.padEnd(14) + 'Personas'.padStart(9) + 'TotalArts'.padStart(11) + 'AvgEng%'.padStart(9) + 'AvgRelev%'.padStart(11) + 'AvgSkip%'.padStart(10) + 'AvgDwell'.padStart(10) + 'AvgSat'.padStart(8) + 'EngTrend'.padStart(10) + 'Score'.padStart(8));
  console.log('  ' + '─'.repeat(105));

  for (const gen of gens) {
    const genResults = ranked.filter(r => r.persona.generation === gen);
    if (genResults.length === 0) continue;
    const allInts = genResults.flatMap(r => r.sessions.flatMap(s => s.interactions));
    const totalArts = allInts.length;
    const eng = allInts.filter(i => i.signal === 'ENGAGE').length;
    const relev = allInts.filter(i => i.matchedSubtopics.length > 0).length;
    const skip = allInts.filter(i => i.signal === 'SKIP').length;
    const avgDwell = allInts.reduce((s, i) => s + i.dwell, 0) / (totalArts || 1);
    const avgSat = genResults.reduce((s, r) => s + r.sessions.reduce((ss, ses) => ss + ses.finalSatisfaction, 0) / r.sessions.length, 0) / genResults.length;
    const avgScore = genResults.reduce((s, r) => s + r.scores.total, 0) / genResults.length;

    // Per-gen engagement trend
    const genPerSession = [];
    for (let sn = 0; sn < numSessions; sn++) {
      const rates = genResults.map(r => r.sessions[sn]?.stats.engRate).filter(r => r !== undefined);
      if (rates.length > 0) genPerSession.push(rates.reduce((a, b) => a + b, 0) / rates.length);
    }
    const genEngTrend = computeTrend(genPerSession);

    console.log('  ' +
      gen.padEnd(14) + String(genResults.length).padStart(9) + String(totalArts).padStart(11) +
      `${((eng/totalArts)*100).toFixed(1)}%`.padStart(9) +
      `${((relev/totalArts)*100).toFixed(1)}%`.padStart(11) +
      `${((skip/totalArts)*100).toFixed(1)}%`.padStart(10) +
      formatDwell(avgDwell).padStart(10) +
      avgSat.toFixed(0).padStart(8) +
      `${trendArrow(genEngTrend)} ${genEngTrend.pctChange >= 0 ? '+' : ''}${genEngTrend.pctChange.toFixed(0)}%`.padStart(10) +
      `${((avgScore/25)*100).toFixed(0)}%`.padStart(8)
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PER-PERSONA ENGAGEMENT EVOLUTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  PER-PERSONA ENGAGEMENT EVOLUTION (10 sessions)');
  console.log(THICK);
  console.log('  ' + 'Name'.padEnd(12) + 'Gen'.padEnd(6) +
    Array.from({ length: numSessions }, (_, i) => `S${i + 1}`.padStart(7)).join('') +
    '  Trend'.padStart(8) + '  Total'.padStart(8) + '  Exits'
  );
  console.log('  ' + '─'.repeat(12 + 6 + numSessions * 7 + 8 + 8 + 30));

  for (const r of ranked) {
    const engRates = r.sessions.map(s => s.stats.engRate);
    const engT = computeTrend(engRates);
    const totalArt = r.sessions.reduce((sum, s) => sum + s.stats.total, 0);
    const exits = r.sessions.map(s => s.exitType === 'frustrated' ? 'F' : s.exitType === 'bored' ? 'B' : '.').join('');
    let line = '  ' + r.persona.name.padEnd(12) + (r.persona.generation || '').padEnd(6);
    for (const e of engRates) line += `${(e * 100).toFixed(0)}%`.padStart(7);
    line += `  ${trendArrow(engT)}`.padStart(8);
    line += `  ${totalArt}`.padStart(8);
    line += `  ${exits}`;
    console.log(line);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADDICTION INDEX
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  ADDICTION INDEX — Are users getting hooked over 10 sessions?');
  console.log(THICK);

  console.log('  ' + 'Name'.padEnd(12) + 'Score'.padStart(7) + 'Eng'.padStart(8) + 'Dwell'.padStart(8) + 'Skip'.padStart(8) + 'Sat'.padStart(8) + 'Length'.padStart(8) + 'Save'.padStart(8) + '  Signal');
  console.log('  ' + '─'.repeat(85));

  let totalAddicted = 0, totalDisengaging = 0, totalStable = 0;

  for (const r of ranked) {
    const engRates = r.sessions.map(s => s.stats.engRate);
    const dwells = r.sessions.map(s => s.stats.avgDwell);
    const skipRates = r.sessions.map(s => s.stats.total > 0 ? s.stats.skipped / s.stats.total : 0);
    const sats = r.sessions.map(s => s.finalSatisfaction);
    const lengths = r.sessions.map(s => s.stats.total);
    const saveRates = r.sessions.map(s => s.stats.total > 0 ? s.stats.saved / s.stats.total : 0);

    const engT = computeTrend(engRates);
    const dwellT = computeTrend(dwells);
    const skipT = computeTrend(skipRates);
    const satT = computeTrend(sats);
    const lenT = computeTrend(lengths);
    const saveT = computeTrend(saveRates);

    let addictionScore = 0;
    if (engT.direction === 'improving') addictionScore++;
    if (dwellT.direction === 'improving') addictionScore++;
    if (skipT.direction === 'declining') addictionScore++;
    if (satT.direction === 'improving') addictionScore++;
    if (lenT.direction === 'improving') addictionScore++;
    if (saveT.direction === 'improving') addictionScore++;
    if (engT.direction === 'declining') addictionScore--;
    if (satT.direction === 'declining') addictionScore--;
    if (skipT.direction === 'improving') addictionScore--;

    const signal = addictionScore >= 4 ? 'HOOKED' : addictionScore >= 2 ? 'WARMING' : addictionScore <= -2 ? 'LOSING' : 'NEUTRAL';
    if (addictionScore >= 4) totalAddicted++;
    else if (addictionScore <= -2) totalDisengaging++;
    else totalStable++;

    console.log('  ' +
      r.persona.name.padEnd(12) +
      `${addictionScore}/6`.padStart(7) +
      `${trendArrow(engT)}`.padStart(8) +
      `${trendArrow(dwellT)}`.padStart(8) +
      `${trendArrow(skipT)}`.padStart(8) +
      `${trendArrow(satT)}`.padStart(8) +
      `${trendArrow(lenT)}`.padStart(8) +
      `${trendArrow(saveT)}`.padStart(8) +
      `  ${signal}`
    );
  }

  console.log('  ' + '─'.repeat(85));
  console.log(`  HOOKED: ${totalAddicted}/50 | WARMING/NEUTRAL: ${totalStable}/50 | LOSING: ${totalDisengaging}/50`);

  // ══════════════════════════════════════════════════════════════════════════
  // AHA MOMENT DETECTION — When did feed "click" for each persona?
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  AHA MOMENT DETECTION — At what article count does the feed click?');
  console.log(THICK);
  console.log('  "Aha moment" = first 25-article window where engagement >= 80% AND satisfaction stays above 55\n');

  console.log('  ' + 'Name'.padEnd(12) + 'Gen'.padEnd(6) + 'Aha At'.padStart(8) + 'Window Eng%'.padStart(13) + 'Window Sat'.padStart(12) + '  Status');
  console.log('  ' + '─'.repeat(70));

  let ahaFound = 0, noAha = 0;
  const ahaArticles = [];

  for (const r of ranked) {
    const allInts = r.sessions.flatMap(s => s.interactions);
    let ahaAt = null;
    let ahaEngRate = 0;
    let ahaSat = 0;

    for (let i = 0; i <= allInts.length - 25; i++) {
      const window = allInts.slice(i, i + 25);
      const windowEng = window.filter(w => w.signal === 'ENGAGE').length / 25;
      const windowSat = window[window.length - 1].mood;
      if (windowEng >= 0.8 && windowSat >= 55) {
        ahaAt = i + 25;
        ahaEngRate = windowEng;
        ahaSat = windowSat;
        break;
      }
    }

    if (ahaAt) {
      ahaFound++;
      ahaArticles.push(ahaAt);
      console.log('  ' + r.persona.name.padEnd(12) + (r.persona.generation || '').padEnd(6) +
        `#${ahaAt}`.padStart(8) + `${(ahaEngRate * 100).toFixed(0)}%`.padStart(13) + `${ahaSat}`.padStart(12) + '  FOUND');
    } else {
      noAha++;
      console.log('  ' + r.persona.name.padEnd(12) + (r.persona.generation || '').padEnd(6) +
        '-'.padStart(8) + '-'.padStart(13) + '-'.padStart(12) + '  NOT YET');
    }
  }

  console.log('  ' + '─'.repeat(70));
  console.log(`  Aha found: ${ahaFound}/50 | No aha: ${noAha}/50` +
    (ahaArticles.length > 0 ? ` | Median aha at article #${ahaArticles.sort((a,b) => a-b)[Math.floor(ahaArticles.length / 2)]}` : ''));

  // ══════════════════════════════════════════════════════════════════════════
  // CHURN RISK
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  CHURN RISK ASSESSMENT');
  console.log(THICK);
  console.log('  Based on: declining engagement + low satisfaction + multiple bored/frustrated exits\n');

  console.log('  ' + 'Name'.padEnd(12) + 'Risk'.padEnd(10) + 'Avg Sat'.padStart(9) + 'Last Sat'.padStart(10) + 'Frustrated'.padStart(12) + 'Bored'.padStart(7) + 'Eng Trend'.padStart(11) + '  Reason');
  console.log('  ' + '─'.repeat(100));

  let highRisk = 0, medRisk = 0, lowRisk = 0;

  for (const r of ranked) {
    const avgSat = r.sessions.reduce((s, ses) => s + ses.finalSatisfaction, 0) / r.sessions.length;
    const lastSat = r.sessions[r.sessions.length - 1].finalSatisfaction;
    const frustrations = r.sessions.filter(s => s.exitType === 'frustrated').length;
    const boreds = r.sessions.filter(s => s.exitType === 'bored').length;
    const engT = computeTrend(r.sessions.map(s => s.stats.engRate));

    let risk = 'LOW';
    let reason = '';

    if ((frustrations >= 3 || avgSat < 30 || (engT.direction === 'declining' && avgSat < 40))) {
      risk = 'HIGH';
      highRisk++;
      if (frustrations >= 3) reason += 'many frustrated exits, ';
      if (avgSat < 30) reason += 'very low satisfaction, ';
      if (engT.direction === 'declining') reason += 'declining engagement, ';
    } else if (frustrations >= 1 || boreds >= 3 || avgSat < 45 || engT.direction === 'declining') {
      risk = 'MEDIUM';
      medRisk++;
      if (frustrations >= 1) reason += 'frustrated exit, ';
      if (boreds >= 3) reason += 'frequent boredom, ';
      if (avgSat < 45) reason += 'low satisfaction, ';
      if (engT.direction === 'declining') reason += 'declining engagement, ';
    } else {
      lowRisk++;
      reason = 'healthy metrics';
    }
    reason = reason.replace(/, $/, '');

    console.log('  ' + r.persona.name.padEnd(12) + risk.padEnd(10) +
      avgSat.toFixed(0).padStart(9) + String(lastSat).padStart(10) +
      String(frustrations).padStart(12) + String(boreds).padStart(7) +
      `${trendArrow(engT)} ${engT.pctChange >= 0 ? '+' : ''}${engT.pctChange.toFixed(0)}%`.padStart(11) +
      `  ${reason}`
    );
  }

  console.log('  ' + '─'.repeat(100));
  console.log(`  HIGH RISK: ${highRisk} | MEDIUM: ${medRisk} | LOW: ${lowRisk}`);

  // ── CATEGORY BREAKDOWN ──
  const allInts = ranked.flatMap(r => r.sessions.flatMap(s => s.interactions));
  const totalArticles = allInts.length;
  const totalTime = allInts.reduce((s, i) => s + i.dwell, 0);

  const catStats = {};
  for (const i of allInts) {
    const cat = i.category || 'Unknown';
    if (!catStats[cat]) catStats[cat] = { count: 0, dwell: 0, engaged: 0, relevant: 0, saved: 0 };
    catStats[cat].count++;
    catStats[cat].dwell += i.dwell;
    if (i.signal === 'ENGAGE') catStats[cat].engaged++;
    if (i.matchedSubtopics.length > 0) catStats[cat].relevant++;
    if (i.save) catStats[cat].saved++;
  }

  console.log(`\n  CATEGORY BREAKDOWN:`);
  console.log('  ' + 'Category'.padEnd(16) + 'Articles'.padStart(9) + 'Share'.padStart(7) + 'Dwell'.padStart(10) + 'Avg'.padStart(8) + 'Eng%'.padStart(7) + 'Relev%'.padStart(8) + 'Save%'.padStart(8));
  console.log('  ' + '─'.repeat(75));
  for (const [cat, s] of Object.entries(catStats).sort((a, b) => b[1].count - a[1].count)) {
    console.log('  ' + cat.padEnd(16) + String(s.count).padStart(9) +
      (`${((s.count/totalArticles)*100).toFixed(0)}%`).padStart(7) +
      formatDwell(s.dwell).padStart(10) + formatDwell(s.dwell / s.count).padStart(8) +
      (`${((s.engaged/s.count)*100).toFixed(0)}%`).padStart(7) +
      (`${((s.relevant/s.count)*100).toFixed(0)}%`).padStart(8) +
      (`${((s.saved/s.count)*100).toFixed(1)}%`).padStart(8)
    );
  }

  // ── SUBTOPIC COVERAGE HEATMAP ──
  console.log('\n  SUBTOPIC COVERAGE HEATMAP:');
  const allSubtopics = new Set();
  for (const r of ranked) r.persona.subtopics.forEach(s => allSubtopics.add(s));
  const stGlobalSeen = {}, stGlobalEngaged = {};
  for (const i of allInts) {
    for (const st of i.matchedSubtopics) {
      stGlobalSeen[st] = (stGlobalSeen[st] || 0) + 1;
      if (i.signal === 'ENGAGE') stGlobalEngaged[st] = (stGlobalEngaged[st] || 0) + 1;
    }
  }
  console.log('  ' + 'Subtopic'.padEnd(35) + 'Personas'.padStart(9) + 'Articles'.padStart(10) + 'Engaged'.padStart(9) + 'Eng%'.padStart(8));
  console.log('  ' + '─'.repeat(73));
  for (const st of [...allSubtopics].sort()) {
    const personasUsing = ranked.filter(r => r.persona.subtopics.includes(st)).length;
    const seen = stGlobalSeen[st] || 0;
    const eng = stGlobalEngaged[st] || 0;
    const icon = seen === 0 ? '✗' : seen >= 5 ? '✓' : '△';
    console.log('  ' + `${icon} ${st}`.padEnd(35) + String(personasUsing).padStart(9) +
      String(seen).padStart(10) + String(eng).padStart(9) +
      (`${seen > 0 ? ((eng/seen)*100).toFixed(0) : 0}%`).padStart(8)
    );
  }

  // ── DWELL DISTRIBUTION ──
  console.log('\n  DWELL DISTRIBUTION:');
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
    const inBucket = allInts.filter(i => i.dwell >= b.min && i.dwell < b.max);
    const pct = totalArticles > 0 ? ((inBucket.length / totalArticles) * 100).toFixed(0) : '0';
    const bar = '\u2588'.repeat(Math.max(0, Math.round(parseFloat(pct) / 2)));
    console.log(`    ${b.label.padEnd(25)} ${String(inBucket.length).padStart(6)} (${pct.padStart(3)}%) ${bar}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FLOW STATE ANALYSIS — Which personas hit flow states?
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  FLOW STATE ANALYSIS — How often do personas enter reading flow?');
  console.log(THICK);
  console.log('  Flow = 5+ consecutive engagements\n');

  console.log('  ' + 'Name'.padEnd(12) + 'Gen'.padEnd(6) + 'FlowCount'.padStart(11) + 'MaxStreak'.padStart(11) + 'FlowSessions'.padStart(14) + 'AvgFlowDwell'.padStart(14));
  console.log('  ' + '─'.repeat(70));

  for (const r of ranked) {
    let flowCount = 0;
    let maxStreak = 0;
    let flowSessions = 0;
    let flowDwells = [];

    for (const session of r.sessions) {
      let streak = 0;
      let sessionHadFlow = false;
      for (const inter of session.interactions) {
        if (inter.signal === 'ENGAGE') {
          streak++;
          if (streak >= 5) {
            if (!sessionHadFlow) { flowSessions++; sessionHadFlow = true; }
            flowCount++;
            flowDwells.push(inter.dwell);
          }
        } else {
          streak = 0;
        }
        maxStreak = Math.max(maxStreak, streak);
      }
    }

    const avgFlowDwell = flowDwells.length > 0 ? flowDwells.reduce((a, b) => a + b, 0) / flowDwells.length : 0;
    console.log('  ' + r.persona.name.padEnd(12) + (r.persona.generation || '').padEnd(6) +
      String(flowCount).padStart(11) + String(maxStreak).padStart(11) +
      `${flowSessions}/${r.sessions.length}`.padStart(14) +
      (flowDwells.length > 0 ? formatDwell(avgFlowDwell) : '-').padStart(14)
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL VERDICT
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  FINAL VERDICT');
  console.log(THICK);
  console.log(`  Overall Score: ${overallScore}/100`);
  console.log(`  Total articles seen: ${totalArticles} across ${numSessions} sessions x 50 personas`);
  console.log(`  Total time in app: ${formatDwell(totalTime)}`);
  console.log(`  Avg dwell: ${formatDwell(totalArticles > 0 ? totalTime / totalArticles : 0)}`);
  console.log(`  Scores — Relevance: ${avgScores.relevance.toFixed(1)}/5 | Coverage: ${avgScores.coverage.toFixed(1)}/5 | Diversity: ${avgScores.diversity.toFixed(1)}/5 | Quality: ${avgScores.quality.toFixed(1)}/5 | Would Return: ${avgScores.wouldReturn.toFixed(1)}/5`);

  console.log('\n  PERSONALIZATION EFFECTIVENESS:');
  const feedLearns = engTrend.direction === 'improving' || relevTrend.direction === 'improving';
  const usersGetHooked = totalAddicted > totalDisengaging;
  const satisfactionGrows = satTrend.direction === 'improving';

  if (feedLearns && usersGetHooked && satisfactionGrows) {
    console.log('  FEED IS LEARNING: Engagement and relevance improve over sessions.');
    console.log('  USERS ARE GETTING HOOKED: More users show addiction signals than disengagement.');
    console.log('  --> Personalization is working. The feed improves with usage.');
  } else if (feedLearns || usersGetHooked) {
    console.log('  MIXED SIGNALS: Some metrics improve over time, others are flat or declining.');
    if (!feedLearns) console.log('  Feed relevance is NOT improving — personalization may be static.');
    if (!usersGetHooked) console.log('  Users are NOT getting more engaged — retention risk.');
    if (!satisfactionGrows) console.log('  Satisfaction is NOT climbing — users may plateau or churn.');
    console.log('  --> Partial personalization. Feed needs better learning signals.');
  } else {
    console.log('  FEED IS NOT LEARNING: Engagement and relevance are flat or declining.');
    console.log('  Users are disengaging: Skip rates and frustration are growing.');
    console.log('  --> Personalization is not effective. Feed behaves the same regardless of user history.');
  }

  console.log(`\n  Addiction breakdown: ${totalAddicted} hooked, ${totalStable} neutral, ${totalDisengaging} losing`);
  console.log(`  Churn risk: ${highRisk} high, ${medRisk} medium, ${lowRisk} low`);
  console.log(`  Aha moments: ${ahaFound}/50 found` + (ahaArticles.length > 0 ? `, median at article #${ahaArticles.sort((a,b)=>a-b)[Math.floor(ahaArticles.length/2)]}` : ''));
  console.log(`  Engagement trend: ${trendArrow(engTrend)} ${engTrend.pctChange >= 0 ? '+' : ''}${engTrend.pctChange.toFixed(1)}% (S1->S${numSessions})`);
  console.log(`  Relevance trend: ${trendArrow(relevTrend)} ${relevTrend.pctChange >= 0 ? '+' : ''}${relevTrend.pctChange.toFixed(1)}% (S1->S${numSessions})`);
  console.log(`  Satisfaction trend: ${trendArrow(satTrend)} ${satTrend.pctChange >= 0 ? '+' : ''}${satTrend.pctChange.toFixed(1)}% (S1->S${numSessions})`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  50-PERSONA FEED TEST V7 — 500+ articles per persona, ultra-realistic behavior                              ║');
  console.log('║  10 sessions | accumulated history | flow state | dynamic session length | detailed analytics               ║');
  console.log('║  Purpose: Does the feed learn from user behavior? Do users get hooked over time?                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Sessions per persona: ${SESSIONS_PER_PERSONA} | Target articles: ${TARGET_ARTICLES_PER_PERSONA}/persona | API: ${API_BASE}\n`);

  // Phase 1: Setup
  console.log('PHASE 1: Setting up 50 test personas (clean slate)...');
  const personaSetups = [];
  const _BP = PERSONAS.slice(20, 30); for (const persona of _BP) {
    process.stdout.write(`  ${persona.name} (${persona.homeCountry})...`);
    const setup = await setupPersona(persona);
    if (setup) {
      personaSetups.push({ persona, ...setup });
      console.log(` OK — ${persona.subtopics.join(', ')}`);
    } else {
      console.log(' FAILED');
    }
    await sleep(400);
  }
  console.log(`\n  ${personaSetups.length}/${PERSONAS.length} ready.\n`);

  // Phase 2: Simulate
  console.log(`PHASE 2: Running ${SESSIONS_PER_PERSONA}-session simulations (accumulated history — feed learns from each session)...\n`);
  const allResults = [];

  const CONCURRENCY = 10;
  for (let batch = 0; batch < personaSetups.length; batch += CONCURRENCY) {
    const batchSlice = personaSetups.slice(batch, batch + CONCURRENCY);
    console.log(`  --- Batch ${Math.floor(batch / CONCURRENCY) + 1}/${Math.ceil(personaSetups.length / CONCURRENCY)} (${batchSlice.map(p => p.persona.name).join(', ')}) ---`);

    const batchResults = await Promise.all(batchSlice.map(async ({ persona, userId, accessToken }) => {
      const profile = buildPersonaProfile(persona);
      const sessions = [];
      let accumulatedHistory = { engagedIds: [], skippedIds: [], seenIds: [] };

      for (let s = 1; s <= SESSIONS_PER_PERSONA; s++) {
        // Simulate search behavior between sessions (users search for topics they care about)
        // ~40% chance of searching per session, more likely for returning users
        if (s >= 2 && Math.random() < 0.4) {
          const searchTopic = pick(persona.subtopics);
          const searchMapping = SUBTOPIC_MAP[searchTopic];
          if (searchMapping) {
            const searchQuery = pick(searchMapping.tags);
            try {
              await trackEvent(accessToken, {
                event_type: 'search_query', session_id: `search_${persona.name.toLowerCase()}_s${s}`,
                metadata: { query: searchQuery },
              });
            } catch (e) {}
            await sleep(50);
          }
        }

        // CARRY OVER history between sessions — the feed can learn
        const session = await simulateSession(persona, userId, accessToken, s, profile, accumulatedHistory);
        sessions.push(session);
        accumulatedHistory = session.accumulatedHistory;
        if (s < SESSIONS_PER_PERSONA) await sleep(DELAY_BETWEEN_SESSIONS_MS);
      }

      const scores = scorePersona(persona, sessions, profile);
      return { persona, sessions, scores, profile };
    }));

    // Print batch results
    for (const result of batchResults) {
      const { persona, sessions, scores } = result;
      const totalArt = sessions.reduce((sum, s) => sum + s.stats.total, 0);
      const engRates = sessions.map(s => s.stats.engRate);
      const engT = computeTrend(engRates);
      const flowSessions = sessions.filter(s => s.flowExtended).length;

      const totalLikes = sessions.reduce((sum, s) => sum + (s.stats.liked || 0), 0);
      const totalShares = sessions.reduce((sum, s) => sum + (s.stats.shared || 0), 0);
      const totalSaves = sessions.reduce((sum, s) => sum + (s.stats.saved || 0), 0);

      console.log(`  ┌── ${persona.name} (${persona.generation}, ${persona.location}) — ${totalArt} articles | ${totalLikes}♥ ${totalSaves}⊕ ${totalShares}↗ ──`);
      for (const session of sessions) {
        const exitIcon = session.exitType === 'frustrated' ? 'F' : session.exitType === 'bored' ? 'B' : '.';
        const flowTag = session.flowExtended ? ' FLOW' : '';
        const likeTag = (session.stats.liked || 0) > 0 ? ` ${session.stats.liked}♥` : '';
        console.log(`  │ S${String(session.sessionNum).padStart(2)}: [${exitIcon}] ${String(session.stats.total).padStart(3)} articles | ${(session.stats.engRate * 100).toFixed(0).padStart(3)}% eng | ${(session.stats.relevantRate * 100).toFixed(0).padStart(3)}% relev | sat ${String(session.finalSatisfaction).padStart(3)}${likeTag}${flowTag}`);
      }
      console.log(`  └── eng trend ${trendArrow(engT)} ${engT.pctChange >= 0 ? '+' : ''}${engT.pctChange.toFixed(0)}% | score: ${scores.total}/25 (${((scores.total/25)*100).toFixed(0)}%) | flow: ${flowSessions}\n`);
      allResults.push({ persona, sessions, scores });
    }
  }

  // Phase 3: Grand Report
  printGrandReport(allResults);

  // Save results
  const jsonResults = allResults.map(r => ({
    persona: r.persona.name, generation: r.persona.generation,
    subtopics: r.persona.subtopics, homeCountry: r.persona.homeCountry,
    scores: r.scores,
    sessions: r.sessions.map(s => ({
      sessionNum: s.sessionNum, exitType: s.exitType, finalSatisfaction: s.finalSatisfaction,
      flowExtended: s.flowExtended, stats: s.stats, interactions: s.interactions,
    })),
  }));
  fs.writeFileSync('test_50persona_results_v3_b2.json', JSON.stringify(jsonResults, null, 2));
  console.log('\nResults saved to test_50persona_results_v3.json');

  // ============================================================================
  // V3-SPECIFIC ANALYSIS: Entity Affinity + Phase + Sliding Window Stats
  // ============================================================================
  const THICK = '━'.repeat(140);
  console.log(`\n${THICK}`);
  console.log('  V3 ALGORITHM ANALYSIS — Entity Affinity + Phase Transitions + Comparison');
  console.log(THICK);

  // Check entity affinities and phases for each persona
  console.log('\n  V3 ENTITY AFFINITY & PHASE STATUS:');
  console.log('  ' + 'Name'.padEnd(14) + 'Subtopics'.padStart(10) + '  Phase'.padEnd(8) + 'Interactions'.padStart(13) + '  Top Entities (affinity score)'.padEnd(70) + 'Buffer'.padStart(8));
  console.log('  ' + '─'.repeat(120));

  for (const result of allResults) {
    const { persona } = result;
    // Find the user's personalization_profiles row
    const email = persona.email;
    const { data: profileRow } = await adminDb.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!profileRow) continue;

    const { data: ppRow } = await adminDb.from('personalization_profiles').select('personalization_id, phase, total_interactions').eq('auth_profile_id', profileRow.id).maybeSingle();
    if (!ppRow) {
      console.log(`  ${persona.name.padEnd(14)}${String(persona.subtopics.length).padStart(10)}  NO V3 PROFILE`);
      continue;
    }

    // Top 5 entity affinities
    const { data: topEntities } = await adminDb
      .from('user_entity_affinity')
      .select('entity, affinity_score')
      .eq('personalization_id', ppRow.personalization_id)
      .order('affinity_score', { ascending: false })
      .limit(5);

    // Engagement buffer count
    const { count: bufferCount } = await adminDb
      .from('engagement_buffer')
      .select('id', { count: 'exact', head: true })
      .eq('personalization_id', ppRow.personalization_id);

    const entityStr = (topEntities || []).map(e => `${e.entity}(${e.affinity_score.toFixed(1)})`).join(', ').substring(0, 68);

    console.log('  ' +
      persona.name.padEnd(14) +
      String(persona.subtopics.length).padStart(10) +
      `  P${ppRow.phase}`.padEnd(8) +
      String(ppRow.total_interactions).padStart(13) +
      `  ${entityStr}`.padEnd(70) +
      String(bufferCount || 0).padStart(8)
    );
  }

  // Phase distribution
  const { data: phaseStats } = await adminDb.from('personalization_profiles').select('phase');
  if (phaseStats) {
    const p1 = phaseStats.filter(r => r.phase === 1).length;
    const p2 = phaseStats.filter(r => r.phase === 2).length;
    const p3 = phaseStats.filter(r => r.phase === 3).length;
    console.log(`\n  Phase Distribution: P1=${p1} | P2=${p2} | P3=${p3}`);
  }

  // ============================================================================
  // COMPARISON WITH V7 (v22 algorithm)
  // ============================================================================
  console.log(`\n${THICK}`);
  console.log('  V3 vs V22 (V7 TEST) COMPARISON');
  console.log(THICK);

  try {
    const v7Data = JSON.parse(fs.readFileSync('test_50persona_results_v7.json', 'utf8'));
    const v7ByName = {};
    for (const r of v7Data) v7ByName[r.persona] = r;

    const v3Scores = allResults.map(r => r.scores.total);
    const v7Scores = v7Data.map(r => r.scores.total);
    const v3Avg = v3Scores.reduce((a, b) => a + b, 0) / v3Scores.length;
    const v7Avg = v7Scores.reduce((a, b) => a + b, 0) / v7Scores.length;

    console.log(`\n  OVERALL: V3 avg ${v3Avg.toFixed(1)}/25 (${((v3Avg/25)*100).toFixed(0)}%) vs V22 avg ${v7Avg.toFixed(1)}/25 (${((v7Avg/25)*100).toFixed(0)}%)`);
    console.log(`  Delta: ${v3Avg > v7Avg ? '+' : ''}${(v3Avg - v7Avg).toFixed(1)} points (${v3Avg > v7Avg ? 'IMPROVEMENT' : v3Avg < v7Avg ? 'REGRESSION' : 'SAME'})`);

    // Per-dimension comparison
    const dims = ['relevance', 'coverage', 'diversity', 'quality', 'wouldReturn'];
    console.log('\n  Per-Dimension:');
    for (const dim of dims) {
      const v3d = allResults.reduce((s, r) => s + r.scores[dim], 0) / allResults.length;
      const v7d = v7Data.reduce((s, r) => s + r.scores[dim], 0) / v7Data.length;
      const delta = v3d - v7d;
      console.log(`    ${dim.padEnd(14)} V3: ${v3d.toFixed(2)}  V22: ${v7d.toFixed(2)}  ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '✓' : delta < -0.2 ? '✗' : '='}`);
    }

    // Head-to-head per persona
    console.log('\n  HEAD-TO-HEAD (personas present in both):');
    console.log('  ' + 'Name'.padEnd(14) + 'V3 Score'.padStart(10) + 'V22 Score'.padStart(10) + '  Delta'.padEnd(10) + 'V3 Subtopics'.padStart(13));
    console.log('  ' + '─'.repeat(57));

    let v3Wins = 0, v7Wins = 0, ties = 0;
    for (const result of allResults) {
      const v7r = v7ByName[result.persona.name];
      if (!v7r) continue;
      const delta = result.scores.total - v7r.scores.total;
      if (delta > 0) v3Wins++;
      else if (delta < 0) v7Wins++;
      else ties++;

      console.log('  ' +
        result.persona.name.padEnd(14) +
        `${result.scores.total}/25`.padStart(10) +
        `${v7r.scores.total}/25`.padStart(10) +
        `  ${delta >= 0 ? '+' : ''}${delta}`.padEnd(10) +
        String(result.persona.subtopics.length).padStart(13)
      );
    }
    console.log(`\n  V3 wins: ${v3Wins} | V22 wins: ${v7Wins} | Ties: ${ties}`);

  } catch (e) {
    console.log('\n  No V7 results found for comparison (test_50persona_results_v7.json)');
  }

  // Subtopic count distribution
  console.log('\n  SUBTOPIC COUNT DISTRIBUTION:');
  const countDist = {};
  for (const r of allResults) {
    const n = r.persona.subtopics.length;
    countDist[n] = (countDist[n] || 0) + 1;
  }
  for (const [count, num] of Object.entries(countDist).sort((a, b) => a[0] - b[0])) {
    const bar = '█'.repeat(num * 3);
    console.log(`    ${String(count).padStart(2)} subtopics: ${bar} (${num} personas)`);
  }

  console.log(`\n${THICK}\n`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

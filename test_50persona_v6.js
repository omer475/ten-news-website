import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// 50-PERSONA FEED TEST V6 — Realistic social-media-modeled personas
// Based on TikTok/Instagram/Twitter user behavior research
// Scores: subtopic relevance, interest coverage, diversity, quality, would-return
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const SESSIONS_PER_PERSONA = 4;
const DELAY_BETWEEN_EVENTS_MS = 30;
const DELAY_BETWEEN_PAGES_MS = 200;
const DELAY_BETWEEN_SESSIONS_MS = 2000; // give API time to process events between sessions
const MAX_ARTICLE_AGE_HOURS = 72;

// ============================================================================
// SUBTOPIC DEFINITIONS — maps user selections to keywords + categories
// These match the ONBOARDING_TOPIC_MAP in pages/api/feed/main.js exactly
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
// 20 PERSONAS — home country + 2-5 subtopic selections
// ============================================================================

const PERSONAS = [
  // ═══════════════════════════════════════════════════════════════════════
  // GEN Z (18-26) — 15 personas
  // Short attention spans, visual-first, trend-driven, high skip rates
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Jayden', age: 19, location: 'Atlanta, GA',
    bio: 'Freshman at Georgia Tech. Lives on TikTok and Twitter/X. Huge Atlanta Hawks and Falcons fan. Plays Fortnite competitively. Into sneaker culture — has 40+ pairs of Jordans.',
    email: 'persona_jayden@tennews.test',
    homeCountry: 'usa',
    subtopics: ['NBA', 'NFL', 'Gaming', 'Sneakers & Streetwear'],
    personality: { patience: 0.25, saveRate: 0.02, sessionSize: [10, 22] },
    details: { favTeams: ['Atlanta Hawks', 'Atlanta Falcons'], favPlayers: ['Trae Young', 'Bijan Robinson'], specifics: 'NBA highlights, NFL Draft, Fortnite tournaments, Jordan retro drops, Nike SNKRS app' },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'atlanta', 'million dollar', 'arrest', 'rapper', 'drake', 'travis scott'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'fiscal', 'tariff', 'summit', 'mortgage'],
    headlineTriggers: ['hawks', 'falcons', 'trae young', 'jordan', 'nike', 'fortnite', 'world record'],
    repetitionTolerance: 1,
  },
  {
    name: 'Mina', age: 22, location: 'Seoul, South Korea',
    bio: 'K-beauty influencer (120K followers on Instagram). Obsessed with K-pop — ATEEZ and NewJeans bias. Studies marketing at Yonsei. Watches every K-drama on Netflix.',
    email: 'persona_mina@tennews.test',
    homeCountry: 'south_korea',
    subtopics: ['K-Pop & K-Drama', 'Celebrity News', 'Celebrity Style & Red Carpet', 'Social Media'],
    personality: { patience: 0.35, saveRate: 0.05, sessionSize: [12, 25] },
    details: { favTeams: [], favPlayers: [], specifics: 'K-pop comebacks, idol dating scandals, Netflix K-drama releases, Instagram algorithm, beauty brand collabs, Seoul Fashion Week' },
    curiosityKeywords: ['korea', 'seoul', 'japanese', 'anime', 'beauty', 'skincare', 'viral', 'aesthetic', 'instagram'],
    annoyanceKeywords: ['war', 'missile', 'tariff', 'fed rate', 'commodity', 'pipeline'],
    headlineTriggers: ['k-pop', 'newjeans', 'blackpink', 'netflix', 'korean', 'seoul', 'bts'],
    repetitionTolerance: 2,
  },
  {
    name: 'Kai', age: 20, location: 'Tokyo, Japan',
    bio: 'Computer science student at University of Tokyo. Competitive Valorant player. Follows AI research papers on arXiv. Nintendo fanboy. Reads anime news daily.',
    email: 'persona_kai@tennews.test',
    homeCountry: 'japan',
    subtopics: ['Gaming', 'AI & Machine Learning', 'Robotics & Hardware', 'Smartphones & Gadgets'],
    personality: { patience: 0.4, saveRate: 0.04, sessionSize: [15, 28] },
    details: { favTeams: [], favPlayers: [], specifics: 'Valorant Champions, Nintendo Direct, NVIDIA GPU launches, LLM benchmarks, Sony PS5 exclusives, Japanese tech startups' },
    curiosityKeywords: ['japan', 'tokyo', 'anime', 'manga', 'nintendo', 'sony', 'space', 'mars', 'robot', 'quantum'],
    annoyanceKeywords: ['celebrity', 'gossip', 'fashion week', 'real estate', 'mortgage', 'gardening'],
    headlineTriggers: ['nvidia', 'openai', 'nintendo', 'playstation', 'japan', 'valorant', 'steam'],
    repetitionTolerance: 2,
  },
  {
    name: 'Priya', age: 24, location: 'Mumbai, India',
    bio: 'Junior data scientist at Flipkart. Cricket-obsessed — IPL season is her Super Bowl. Follows Bollywood casually. Active on Twitter debating AI ethics.',
    email: 'persona_priya@tennews.test',
    homeCountry: 'india',
    subtopics: ['Cricket', 'AI & Machine Learning', 'Startups & Venture Capital', 'Smartphones & Gadgets'],
    personality: { patience: 0.5, saveRate: 0.04, sessionSize: [15, 30] },
    details: { favTeams: ['Mumbai Indians', 'India NT'], favPlayers: ['Virat Kohli', 'Jasprit Bumrah'], specifics: 'IPL matches, India vs Pakistan, AI startup funding, Flipkart vs Amazon India, iPhone India pricing' },
    curiosityKeywords: ['india', 'mumbai', 'bollywood', 'cricket', 'startup', 'women in tech', 'bangalore', 'flipkart'],
    annoyanceKeywords: ['nfl', 'super bowl', 'quarterback', 'cowboys', 'baseball', 'nascar'],
    headlineTriggers: ['ipl', 'virat', 'india', 'mumbai', 'cricket', 'kohli', 'openai'],
    repetitionTolerance: 3,
  },
  {
    name: 'Tyler', age: 21, location: 'Austin, TX',
    bio: 'UT Austin finance major. Day-trades meme stocks on Robinhood between classes. UFC fanatic — trains BJJ. Elon Musk superfan. Drives a Tesla Model 3.',
    email: 'persona_tyler@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Stock Markets', 'Boxing & MMA/UFC', 'Bitcoin', 'Cybersecurity'],
    personality: { patience: 0.3, saveRate: 0.03, sessionSize: [12, 25] },
    details: { favTeams: [], favPlayers: ['Jon Jones', 'Islam Makhachev'], specifics: 'GME/AMC, Bitcoin price, UFC fight cards, Tesla stock, cybersecurity hacks, Elon tweets' },
    curiosityKeywords: ['elon', 'tesla', 'spacex', 'hack', 'exploit', 'million', 'billion', 'crash', 'austin', 'texas'],
    annoyanceKeywords: ['fashion', 'met gala', 'recipe', 'garden', 'yoga', 'meditation', 'k-pop'],
    headlineTriggers: ['tesla', 'elon musk', 'ufc', 'bitcoin', 'hack', 'sec', 'crash'],
    repetitionTolerance: 2,
  },
  {
    name: 'Aisha', age: 23, location: 'Lagos, Nigeria',
    bio: 'Fintech product manager at a Lagos startup. Passionate about African tech ecosystem. Manchester United fan since childhood. Follows Nollywood and Afrobeats scene.',
    email: 'persona_aisha@tennews.test',
    homeCountry: 'nigeria',
    subtopics: ['Startups & Venture Capital', 'Soccer/Football', 'DeFi & Web3', 'Music'],
    personality: { patience: 0.5, saveRate: 0.04, sessionSize: [12, 25] },
    details: { favTeams: ['Manchester United', 'Nigeria NT'], favPlayers: ['Rashford', 'Osimhen'], specifics: 'African fintech funding, Lagos tech scene, Premier League, Afrobeats charts, crypto regulation Africa' },
    curiosityKeywords: ['nigeria', 'lagos', 'africa', 'african', 'women founder', 'fintech', 'mobile money', 'afrobeats'],
    annoyanceKeywords: ['nfl', 'baseball', 'nascar', 'republican', 'democrat', 'gardening'],
    headlineTriggers: ['manchester united', 'nigeria', 'africa', 'startup', 'fintech', 'billion'],
    repetitionTolerance: 2,
  },
  {
    name: 'Lucas', age: 18, location: 'Sao Paulo, Brazil',
    bio: 'High school senior obsessed with football. Flamengo ultras member. Plays FIFA and EA FC all day. Follows Brazilian rap scene. Dreams of studying abroad.',
    email: 'persona_lucas@tennews.test',
    homeCountry: 'brazil',
    subtopics: ['Soccer/Football', 'Gaming', 'Music', 'Celebrity News'],
    personality: { patience: 0.2, saveRate: 0.01, sessionSize: [10, 20] },
    details: { favTeams: ['Flamengo', 'Brazil NT'], favPlayers: ['Vinicius Jr', 'Endrick', 'Neymar'], specifics: 'Brasileirao results, Champions League, EA FC updates, Brazilian rap, transfer rumors' },
    curiosityKeywords: ['brazil', 'sao paulo', 'rio', 'vinicius', 'neymar', 'viral', 'insane', 'million'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'fiscal', 'pharma', 'clinical trial'],
    headlineTriggers: ['flamengo', 'brazil', 'vinicius', 'neymar', 'real madrid', 'premier league'],
    repetitionTolerance: 1,
  },
  {
    name: 'Emma', age: 25, location: 'Melbourne, Australia',
    bio: 'Environmental science grad student. Climate activist. Follows AFL — Melbourne Demons diehard. Vegetarian foodie who reviews restaurants on Instagram.',
    email: 'persona_emma@tennews.test',
    homeCountry: 'australia',
    subtopics: ['Climate & Environment', 'Biology & Nature', 'Public Health', 'Shopping & Product Reviews'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [12, 25] },
    details: { favTeams: ['Melbourne Demons'], favPlayers: [], specifics: 'IPCC reports, Great Barrier Reef, bushfire season, Australian wildlife, Melbourne restaurants, AFL results' },
    curiosityKeywords: ['australia', 'melbourne', 'reef', 'wildlife', 'animal', 'vegan', 'sustainable', 'ocean', 'pacific'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'meme coin', 'oil drilling', 'fracking'],
    headlineTriggers: ['climate', 'australia', 'reef', 'endangered', 'wildfire', 'melbourne'],
    repetitionTolerance: 3,
  },
  {
    name: 'Yuki', age: 26, location: 'Osaka, Japan',
    bio: 'UX designer at a gaming company. Cosplayer with 30K TikTok followers. Watches every anime season. Follows J-League casually. Into mechanical keyboards.',
    email: 'persona_yuki@tennews.test',
    homeCountry: 'japan',
    subtopics: ['Gaming', 'Movies & Film', 'Smartphones & Gadgets', 'K-Pop & K-Drama'],
    personality: { patience: 0.4, saveRate: 0.04, sessionSize: [12, 22] },
    details: { favTeams: [], favPlayers: [], specifics: 'anime releases, Nintendo, PlayStation exclusives, mechanical keyboard builds, cosplay events, Studio Ghibli, Korean dramas' },
    curiosityKeywords: ['japan', 'osaka', 'anime', 'manga', 'cosplay', 'studio ghibli', 'nintendo', 'design'],
    annoyanceKeywords: ['war', 'troops', 'missile', 'tariff', 'commodity', 'oil price'],
    headlineTriggers: ['nintendo', 'anime', 'japan', 'playstation', 'netflix', 'studio ghibli'],
    repetitionTolerance: 2,
  },
  {
    name: 'Zoe', age: 22, location: 'Brooklyn, NY',
    bio: 'NYU journalism student and podcast host. Covers gen Z mental health and dating culture. Reads The Cut and Vox daily. Knicks fan ironically. Thrift shopping addict.',
    email: 'persona_zoe@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Mental Health', 'Celebrity News', 'Social Media', 'Climate & Environment'],
    personality: { patience: 0.45, saveRate: 0.06, sessionSize: [12, 22] },
    details: { favTeams: ['NY Knicks'], favPlayers: [], specifics: 'therapy trends, dating app culture, TikTok news, NYC events, climate activism, thrift fashion, podcast charts' },
    curiosityKeywords: ['new york', 'brooklyn', 'gen z', 'dating', 'therapy', 'viral', 'tiktok', 'student debt', 'rent'],
    annoyanceKeywords: ['quarterly', 'earnings', 'commodity', 'pipeline', 'military', 'troops'],
    headlineTriggers: ['mental health', 'gen z', 'tiktok', 'new york', 'viral', 'study finds'],
    repetitionTolerance: 2,
  },
  {
    name: 'Omar', age: 20, location: 'Cairo, Egypt',
    bio: 'Cairo University engineering student. Al Ahly ultras. Follows Middle East politics intensely. Watches Premier League at cafes. Plays Mobile Legends.',
    email: 'persona_omar@tennews.test',
    homeCountry: 'egypt',
    subtopics: ['Soccer/Football', 'Middle East', 'Gaming', 'AI & Machine Learning'],
    personality: { patience: 0.4, saveRate: 0.03, sessionSize: [12, 25] },
    details: { favTeams: ['Al Ahly', 'Liverpool', 'Egypt NT'], favPlayers: ['Salah', 'Mohamed Salah'], specifics: 'Egyptian Premier League, Champions League, Gaza situation, Egyptian politics, mobile gaming' },
    curiosityKeywords: ['egypt', 'cairo', 'salah', 'arab', 'suez', 'pyramid', 'ancient', 'islam'],
    annoyanceKeywords: ['k-pop', 'celebrity divorce', 'fashion week', 'sneakers', 'yoga'],
    headlineTriggers: ['egypt', 'salah', 'liverpool', 'gaza', 'cairo', 'al ahly'],
    repetitionTolerance: 3,
  },
  {
    name: 'Ava', age: 24, location: 'Vancouver, Canada',
    bio: 'Physiotherapy student at UBC. Runs a fitness Instagram (18K). Vancouver Canucks hockey fan. Into sustainable fashion and hiking.',
    email: 'persona_ava@tennews.test',
    homeCountry: 'canada',
    subtopics: ['Public Health', 'Mental Health', 'Climate & Environment', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.5, saveRate: 0.04, sessionSize: [10, 22] },
    details: { favTeams: ['Vancouver Canucks'], favPlayers: [], specifics: 'physiotherapy research, fitness trends, BC wildfires, sustainable brands, NHL playoffs, hiking trails' },
    curiosityKeywords: ['vancouver', 'canada', 'fitness', 'workout', 'hiking', 'wildfire', 'sustainable', 'wellness'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'military', 'troops', 'drone strike'],
    headlineTriggers: ['canada', 'vancouver', 'nhl', 'canucks', 'fitness', 'mental health'],
    repetitionTolerance: 2,
  },
  {
    name: 'Marcus', age: 25, location: 'Chicago, IL',
    bio: 'Sound engineer and aspiring music producer. Works at a recording studio. Die-hard Bears and Bulls fan. Collects vinyl. Goes to Lollapalooza every year.',
    email: 'persona_marcus@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Music', 'NBA', 'NFL', 'Sneakers & Streetwear'],
    personality: { patience: 0.35, saveRate: 0.03, sessionSize: [12, 25] },
    details: { favTeams: ['Chicago Bears', 'Chicago Bulls'], favPlayers: ['DeMar DeRozan', 'Caleb Williams'], specifics: 'album drops, Grammy noms, Bears draft, Bulls trades, sneaker drops, Chicago music scene, vinyl releases' },
    curiosityKeywords: ['chicago', 'album', 'concert', 'tour', 'vinyl', 'grammy', 'producer', 'studio', 'rapper'],
    annoyanceKeywords: ['policy', 'regulation', 'pharma', 'clinical trial', 'trade deal', 'summit'],
    headlineTriggers: ['bears', 'bulls', 'chicago', 'grammy', 'album', 'rapper', 'hip hop'],
    repetitionTolerance: 2,
  },
  {
    name: 'Sofia', age: 19, location: 'Mexico City, Mexico',
    bio: 'Fashion design student at Centro. Instagram aesthetic curator. Club America fan through family tradition. Follows Mexican pop culture and telenovela drama.',
    email: 'persona_sofia@tennews.test',
    homeCountry: 'mexico',
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Music', 'Soccer/Football'],
    personality: { patience: 0.3, saveRate: 0.03, sessionSize: [10, 20] },
    details: { favTeams: ['Club America', 'Mexico NT'], favPlayers: [], specifics: 'Met Gala outfits, Mexican cinema, Latin pop, Liga MX results, Mexico City fashion scene, reggaeton' },
    curiosityKeywords: ['mexico', 'latin', 'spanish', 'fashion', 'design', 'art', 'museum', 'architecture'],
    annoyanceKeywords: ['war', 'missile', 'troops', 'quarterly', 'earnings', 'semiconductor'],
    headlineTriggers: ['mexico', 'fashion', 'met gala', 'club america', 'latin', 'oscar'],
    repetitionTolerance: 1,
  },
  {
    name: 'Ethan', age: 23, location: 'Denver, CO',
    bio: 'Cybersecurity analyst at a cloud company. CTF competitor. Denver Broncos season ticket holder. Rock climber and trail runner. Builds custom PCs.',
    email: 'persona_ethan@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Cybersecurity', 'Robotics & Hardware', 'NFL', 'Space Tech'],
    personality: { patience: 0.5, saveRate: 0.05, sessionSize: [15, 28] },
    details: { favTeams: ['Denver Broncos'], favPlayers: ['Bo Nix'], specifics: 'CVE reports, ransomware attacks, PC hardware launches, Broncos games, SpaceX launches, DEFCON talks' },
    curiosityKeywords: ['denver', 'colorado', 'hack', 'vulnerability', 'zero day', 'space', 'climbing', 'nasa'],
    annoyanceKeywords: ['celebrity', 'gossip', 'fashion', 'k-pop', 'influencer', 'reality tv'],
    headlineTriggers: ['broncos', 'hack', 'breach', 'nvidia', 'spacex', 'ransomware', 'denver'],
    repetitionTolerance: 3,
  },
  // ═══════════════════════════════════════════════════════════════════════
  // MILLENNIALS (27-42) — 20 personas
  // Moderate attention spans, topic-loyal, comparison shoppers, medium save rates
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Lena', age: 32, location: 'San Francisco, CA',
    bio: 'AI research lead at a robotics startup. Follows OpenAI/Anthropic race closely. Plays Baldur\'s Gate 3 on weekends. Watches every SpaceX launch live.',
    email: 'persona_lena@tennews.test',
    homeCountry: 'usa',
    subtopics: ['AI & Machine Learning', 'Space Tech', 'Gaming', 'Robotics & Hardware'],
    personality: { patience: 0.8, saveRate: 0.08, sessionSize: [20, 35] },
    details: { favTeams: [], favPlayers: [], specifics: 'NVIDIA earnings, LLM benchmarks, humanoid robots, Starship launches, Steam sales' },
    curiosityKeywords: ['bizarre', 'discovered', 'ancient', 'extinct', 'record-breaking', 'billion', 'breakthrough'],
    annoyanceKeywords: ['ai will replace', 'robots taking jobs', 'alarming'],
    headlineTriggers: ['first ever', 'no one expected', 'scientists shocked', 'elon musk'],
    repetitionTolerance: 3,
  },
  {
    name: 'Marco', age: 35, location: 'Milan, Italy',
    bio: 'Sports editor at Gazzetta dello Sport. Die-hard AC Milan fan since childhood. Watches every Serie A and Champions League match. Follows F1 — big Leclerc/Ferrari supporter. Also into UFC heavyweight division.',
    email: 'persona_marco@tennews.test',
    homeCountry: 'italy',
    subtopics: ['Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC'],
    personality: { patience: 0.5, saveRate: 0.03, sessionSize: [25, 45] },
    details: { favTeams: ['AC Milan', 'Ferrari F1'], favPlayers: ['Leao', 'Leclerc', 'Verstappen'], specifics: 'Serie A standings, Champions League draws, transfer rumors, Monza GP, UFC fight cards' },
    curiosityKeywords: ['athlete', 'injury', 'salary', 'deal', 'scandal', 'record', 'fastest', 'million'],
    annoyanceKeywords: ['congress', 'legislation', 'policy', 'sanctions'],
    headlineTriggers: ['transfer', 'fired', 'champion', 'upset', 'shocking defeat'],
    repetitionTolerance: 4,
  },
  {
    name: 'Elif', age: 29, location: 'Istanbul, Turkey',
    bio: 'Product designer at a fintech startup. Passionate Galatasaray fan — never misses a Super Lig derby. Follows Turkish tech scene and EU-Turkey trade dynamics.',
    email: 'persona_elif@tennews.test',
    homeCountry: 'turkiye',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 30] },
    details: { favTeams: ['Galatasaray', 'Turkey NT'], favPlayers: ['Icardi', 'Calhanoglu'], specifics: 'Super Lig results, Galatasaray transfers, Turkish lira, EU customs union, Istanbul tech ecosystem' },
    curiosityKeywords: ['design', 'women in tech', 'founder', 'turkish', 'istanbul', 'lira', 'earthquake'],
    annoyanceKeywords: ['death toll unchanged', 'no new developments', 'sources say'],
    headlineTriggers: ['galatasaray', 'turkey', 'turkish', 'istanbul', 'women founder'],
    repetitionTolerance: 2,
  },
  {
    name: 'Ryan', age: 38, location: 'New York, NY',
    bio: 'Quant fund portfolio manager at a mid-size hedge fund. Trades S&P futures and tech stocks. Obsessed with NVIDIA, Apple, and TSMC earnings. Yankees season ticket holder.',
    email: 'persona_ryan@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Stock Markets', 'Corporate Earnings', 'Startups & Venture Capital', 'AI & Machine Learning'],
    personality: { patience: 0.7, saveRate: 0.06, sessionSize: [20, 35] },
    details: { favTeams: ['NY Yankees'], favPlayers: [], specifics: 'Fed rate decisions, NVIDIA earnings, tech IPOs, YC batches, S&P500 moves, OpenAI valuation' },
    curiosityKeywords: ['oil price', 'fed', 'crash', 'surge', 'billion', 'ipo', 'sec', 'yankees', 'market crash'],
    annoyanceKeywords: ['wellness', 'mindfulness', 'self-care', 'horoscope'],
    headlineTriggers: ['plunges', 'surges', 'record high', 'crashes', 'bankruptcy'],
    repetitionTolerance: 3,
  },
  {
    name: 'Sophie', age: 27, location: 'Lyon, France',
    bio: 'Medical resident specializing in oncology at Hospices Civils de Lyon. Follows biotech breakthroughs. Olympique Lyonnais season ticket holder — watches Ligue 1 religiously.',
    email: 'persona_sophie@tennews.test',
    homeCountry: 'france',
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature', 'Soccer/Football'],
    personality: { patience: 0.7, saveRate: 0.07, sessionSize: [15, 30] },
    details: { favTeams: ['Olympique Lyonnais', 'France NT'], favPlayers: ['Lacazette', 'Mbappe'], specifics: 'cancer immunotherapy trials, FDA approvals, Ligue 1 table, Champions League, biotech IPOs' },
    curiosityKeywords: ['ai in medicine', 'diagnosis', 'patient', 'hospital', 'france', 'lyon', 'restaurant', 'chef', 'humanitarian'],
    annoyanceKeywords: ['crypto', 'nft', 'meme coin', 'influencer'],
    headlineTriggers: ['cure', 'first patient', 'clinical trial', 'mbappe', 'lyon'],
    repetitionTolerance: 3,
  },
  {
    name: 'Camille', age: 33, location: 'Paris, France',
    bio: 'Creative director at Balenciaga. Lives for fashion week and red carpet moments. Watches every A24 film on release. PSG fan but more into the fashion side of football.',
    email: 'persona_camille@tennews.test',
    homeCountry: 'france',
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Shopping & Product Reviews', 'Soccer/Football'],
    personality: { patience: 0.5, saveRate: 0.06, sessionSize: [12, 25] },
    details: { favTeams: ['PSG'], favPlayers: [], specifics: 'Met Gala, Cannes Film Festival, A24 releases, Balenciaga campaigns, PSG matches, Paris Fashion Week, luxury brand earnings' },
    curiosityKeywords: ['luxury', 'lvmh', 'kering', 'gucci', 'paris', 'france', 'design', 'architecture', 'museum', 'art', 'creative ai'],
    annoyanceKeywords: ['missile', 'troops', 'death toll', 'bitcoin', 'mining'],
    headlineTriggers: ['paris', 'psg', 'fashion', 'cannes', 'balenciaga', 'french'],
    repetitionTolerance: 3,
  },
  {
    name: 'Diego', age: 26, location: 'Miami, FL',
    bio: 'Crypto analyst at a DeFi fund. On-chain detective. Tracks whale wallets and protocol TVL daily. Real Madrid fan — stays up late for Champions League. Reads CoinDesk at breakfast.',
    email: 'persona_diego@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Stock Markets', 'Cybersecurity'],
    personality: { patience: 0.5, saveRate: 0.04, sessionSize: [20, 35] },
    details: { favTeams: ['Real Madrid'], favPlayers: ['Vinicius Jr', 'Bellingham'], specifics: 'BTC halving, ETH staking yields, SEC crypto lawsuits, DeFi hacks, Real Madrid Champions League run' },
    curiosityKeywords: ['real madrid', 'champions league', 'miami', 'latin america', 'ai trading', 'algorithm', 'whale', 'vinicius'],
    annoyanceKeywords: ['wellness', 'meditation', 'yoga', 'recipe', 'garden'],
    headlineTriggers: ['real madrid', 'sec', 'hack', 'exploit', 'crash', 'billion'],
    repetitionTolerance: 3,
  },
  {
    name: 'Amara', age: 34, location: 'Montreal, Canada',
    bio: 'ER nurse at McGill University Health Centre. Reads medical journals on break. Montreal Canadiens fan — has a Carey Price jersey. Follows pharma industry news for career growth.',
    email: 'persona_amara@tennews.test',
    homeCountry: 'canada',
    subtopics: ['Medical Breakthroughs', 'Biology & Nature', 'Mental Health', 'Pharma & Drug Industry'],
    personality: { patience: 0.7, saveRate: 0.06, sessionSize: [12, 25] },
    details: { favTeams: ['Montreal Canadiens'], favPlayers: [], specifics: 'clinical trial results, nurse staffing crisis, therapy access, Pfizer/Moderna pipeline, Canadiens games, NHL standings' },
    curiosityKeywords: ['canada', 'montreal', 'nurse', 'hospital', 'humanitarian', 'civilian', 'children killed', 'famine', 'ai diagnosis'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'stock market', 'earnings call'],
    headlineTriggers: ['canadiens', 'montreal', 'nurse', 'hospital', 'patient', 'first cure'],
    repetitionTolerance: 3,
  },
  {
    name: 'Antonio', age: 43, location: 'Barcelona, Spain',
    bio: 'Restaurant chain owner (3 tapas restaurants). Lifelong FC Barcelona soci — Camp Nou season ticket since 2005. Follows La Liga religiously. Expanding business, reads retail/real estate news.',
    email: 'persona_antonio@tennews.test',
    homeCountry: 'spain',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Retail & Consumer', 'Real Estate'],
    personality: { patience: 0.6, saveRate: 0.04, sessionSize: [12, 25] },
    details: { favTeams: ['FC Barcelona', 'Spain NT'], favPlayers: ['Lamine Yamal', 'Pedri', 'Lewandowski'], specifics: 'Barca transfer rumors, La Liga table, Champions League, Barcelona commercial rent, Spanish tourism stats, restaurant industry trends' },
    curiosityKeywords: ['barcelona', 'spain', 'spanish', 'restaurant', 'food', 'tourism', 'hotel', 'oil price', 'inflation', 'cost of living'],
    annoyanceKeywords: ['algorithm', 'blockchain', 'defi', 'neural network', 'prompt engineering'],
    headlineTriggers: ['barcelona', 'barca', 'la liga', 'spain', 'lamine yamal', 'messi'],
    repetitionTolerance: 3,
  },
  {
    name: 'Nkechi', age: 31, location: 'London, UK',
    bio: 'Investment banking associate at Goldman Sachs London. Covers African markets. Arsenal fan — goes to Emirates Stadium with colleagues. Follows Afrobeats and Nigerian politics from abroad.',
    email: 'persona_nkechi@tennews.test',
    homeCountry: 'uk',
    subtopics: ['Stock Markets', 'Corporate Deals', 'Soccer/Football', 'Oil & Energy'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 30] },
    details: { favTeams: ['Arsenal'], favPlayers: ['Saka', 'Odegaard'], specifics: 'FTSE 100, M&A deals, Arsenal Premier League, Nigerian elections, Brent crude, African sovereign debt' },
    curiosityKeywords: ['nigeria', 'africa', 'london', 'goldman', 'oil', 'women in finance', 'arsenal', 'afrobeats'],
    annoyanceKeywords: ['k-pop', 'gaming', 'cosplay', 'anime', 'tiktok dance'],
    headlineTriggers: ['arsenal', 'london', 'goldman', 'merger', 'acquisition', 'nigeria', 'oil price'],
    repetitionTolerance: 3,
  },
  {
    name: 'ChenWei', age: 36, location: 'Singapore',
    bio: 'VP of Engineering at a logistics SaaS company. Previously at Alibaba. Follows US-China tech competition closely. Liverpool fan — watches matches at hawker centres.',
    email: 'persona_chenwei@tennews.test',
    homeCountry: 'singapore',
    subtopics: ['AI & Machine Learning', 'Trade & Tariffs', 'Robotics & Hardware', 'Asian Politics'],
    personality: { patience: 0.7, saveRate: 0.06, sessionSize: [15, 30] },
    details: { favTeams: ['Liverpool'], favPlayers: ['Salah'], specifics: 'US chip ban, Alibaba earnings, Singapore tech hub, ASEAN trade, NVIDIA/TSMC supply chain, Liverpool Premier League' },
    curiosityKeywords: ['singapore', 'china', 'alibaba', 'tencent', 'semiconductor', 'chip', 'asean', 'supply chain'],
    annoyanceKeywords: ['celebrity', 'gossip', 'reality tv', 'fashion week', 'sneakers'],
    headlineTriggers: ['china', 'chip ban', 'singapore', 'liverpool', 'salah', 'nvidia', 'tsmc'],
    repetitionTolerance: 4,
  },
  {
    name: 'Sarah', age: 39, location: 'Portland, OR',
    bio: 'Pediatrician and mom of three. Oregon Ducks football fan. Reads medical journals and parenting blogs. Concerned about climate change and food safety.',
    email: 'persona_sarah@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Public Health', 'Climate & Environment', 'Medical Breakthroughs', 'Pets & Animals'],
    personality: { patience: 0.7, saveRate: 0.05, sessionSize: [10, 22] },
    details: { favTeams: ['Oregon Ducks'], favPlayers: [], specifics: 'pediatric health guidelines, CDC updates, Oregon wildfires, food recalls, vaccination debates, pet adoption' },
    curiosityKeywords: ['portland', 'oregon', 'parent', 'children', 'school', 'food safety', 'recall', 'wildfire', 'rescue', 'animal'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'hedge fund', 'derivatives', 'meme stock'],
    headlineTriggers: ['parent', 'children', 'school', 'vaccine', 'oregon', 'recall', 'animal rescue'],
    repetitionTolerance: 3,
  },
  {
    name: 'Hiroshi', age: 40, location: 'Yokohama, Japan',
    bio: 'Senior software engineer at Sony Interactive Entertainment. Works on PlayStation platform. Yokohama F. Marinos fan. Follows Japanese baseball and collects retro games.',
    email: 'persona_hiroshi@tennews.test',
    homeCountry: 'japan',
    subtopics: ['Gaming', 'Robotics & Hardware', 'AI & Machine Learning', 'Space & Astronomy'],
    personality: { patience: 0.7, saveRate: 0.06, sessionSize: [15, 28] },
    details: { favTeams: ['Yokohama F. Marinos'], favPlayers: [], specifics: 'PlayStation exclusives, Sony earnings, J-League, Japanese baseball, retro gaming, JAXA space missions, GPU benchmarks' },
    curiosityKeywords: ['japan', 'yokohama', 'sony', 'playstation', 'jaxa', 'japanese', 'baseball', 'retro'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'k-pop dating', 'fashion week'],
    headlineTriggers: ['playstation', 'sony', 'japan', 'nintendo', 'jaxa', 'yokohama'],
    repetitionTolerance: 4,
  },
  {
    name: 'Fatima', age: 24, location: 'Washington DC',
    bio: 'Georgetown law student focused on civil rights and constitutional law. Interns at the ACLU. Follows Supreme Court cases obsessively. Manchester City fan — got into football through her British roommate.',
    email: 'persona_fatima@tennews.test',
    homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Middle East', 'Public Health'],
    personality: { patience: 0.8, saveRate: 0.07, sessionSize: [15, 28] },
    details: { favTeams: ['Manchester City'], favPlayers: ['Haaland', 'De Bruyne'], specifics: 'SCOTUS rulings, ACLU cases, voting rights, Gaza/Israel policy, CDC updates, Man City Premier League run' },
    curiosityKeywords: ['privacy', 'surveillance', 'immigration', 'border', 'education', 'student debt', 'man city', 'haaland', 'justice'],
    annoyanceKeywords: ['earnings', 'quarterly', 'ipo', 'stock price', 'revenue'],
    headlineTriggers: ['supreme court', 'aclu', 'man city', 'haaland', 'civil rights', 'unconstitutional'],
    repetitionTolerance: 4,
  },
  {
    name: 'Carlos', age: 30, location: 'Buenos Aires, Argentina',
    bio: 'Full-stack developer working remotely for a US startup. Boca Juniors is life — has a half-sleeve tattoo of the club. Follows Argentine politics and tech jobs market.',
    email: 'persona_carlos@tennews.test',
    homeCountry: 'argentina',
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'AI & Machine Learning', 'Latin America'],
    personality: { patience: 0.5, saveRate: 0.04, sessionSize: [15, 28] },
    details: { favTeams: ['Boca Juniors', 'Argentina NT'], favPlayers: ['Messi', 'Cavallini'], specifics: 'Argentine Primera results, Libertadores, Messi news, Argentine peso, remote tech jobs, Buenos Aires startup scene' },
    curiosityKeywords: ['argentina', 'buenos aires', 'messi', 'peso', 'inflation', 'remote work', 'developer'],
    annoyanceKeywords: ['nfl', 'baseball', 'nascar', 'gardening', 'home renovation'],
    headlineTriggers: ['boca juniors', 'argentina', 'messi', 'libertadores', 'buenos aires'],
    repetitionTolerance: 3,
  },
  {
    name: 'Hannah', age: 28, location: 'Tel Aviv, Israel',
    bio: 'Product manager at a cybersecurity unicorn. Follows Israeli tech scene (Unit 8200 alumni). Watches Premier League — Tottenham fan. Into hiking the Israel National Trail.',
    email: 'persona_hannah@tennews.test',
    homeCountry: 'israel',
    subtopics: ['Cybersecurity', 'Startups & Venture Capital', 'Middle East', 'Soccer/Football'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 28] },
    details: { favTeams: ['Tottenham Hotspur'], favPlayers: ['Son Heung-min'], specifics: 'Israeli cybersecurity startups, Iron Dome tech, Gaza conflict, Tottenham Premier League, Series A/B funding rounds' },
    curiosityKeywords: ['israel', 'tel aviv', 'cybersecurity', 'startup nation', 'women in tech', 'iron dome', 'spurs'],
    annoyanceKeywords: ['celebrity', 'k-pop', 'fashion week', 'reality tv', 'horoscope'],
    headlineTriggers: ['israel', 'tel aviv', 'tottenham', 'cyber', 'son heung', 'iron dome'],
    repetitionTolerance: 3,
  },
  {
    name: 'Viktor', age: 37, location: 'Kyiv, Ukraine',
    bio: 'War correspondent turned tech journalist. Reports on how Ukraine uses tech in defense. Follows drone warfare innovations. Shakhtar Donetsk fan displaced from Donetsk.',
    email: 'persona_viktor@tennews.test',
    homeCountry: 'ukraine',
    subtopics: ['War & Conflict', 'Cybersecurity', 'European Politics', 'Space Tech'],
    personality: { patience: 0.8, saveRate: 0.08, sessionSize: [18, 32] },
    details: { favTeams: ['Shakhtar Donetsk'], favPlayers: [], specifics: 'Ukraine frontline updates, drone tech, NATO support, EU membership, cyber warfare, satellite intelligence' },
    curiosityKeywords: ['ukraine', 'kyiv', 'drone', 'nato', 'russia', 'satellite', 'intelligence', 'defense tech'],
    annoyanceKeywords: ['celebrity', 'fashion', 'reality tv', 'influencer', 'diet'],
    headlineTriggers: ['ukraine', 'kyiv', 'nato', 'drone', 'russia', 'shakhtar', 'frontline'],
    repetitionTolerance: 5,
  },
  {
    name: 'Jasmine', age: 33, location: 'Dubai, UAE',
    bio: 'Real estate investment manager. Follows Gulf property market obsessively. PSG and Al Hilal fan for the star players. Into luxury watches and supercars.',
    email: 'persona_jasmine@tennews.test',
    homeCountry: 'uae',
    subtopics: ['Real Estate', 'Oil & Energy', 'Soccer/Football', 'Corporate Deals'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 28] },
    details: { favTeams: ['PSG', 'Al Hilal'], favPlayers: ['Mbappe', 'Neymar'], specifics: 'Dubai property prices, OPEC decisions, Saudi Vision 2030, Premier League, luxury car launches, Abu Dhabi investments' },
    curiosityKeywords: ['dubai', 'uae', 'saudi', 'abu dhabi', 'luxury', 'billion', 'supercar', 'penthouse', 'gold'],
    annoyanceKeywords: ['k-pop', 'anime', 'gaming', 'cosplay', 'comic book'],
    headlineTriggers: ['dubai', 'saudi', 'opec', 'oil price', 'psg', 'billion', 'luxury'],
    repetitionTolerance: 3,
  },
  {
    name: 'Tariq', age: 41, location: 'Karachi, Pakistan',
    bio: 'Senior banker at Habib Bank. Passionate about Pakistan cricket — never misses a PSL match. Follows Islamic finance and CPEC developments. Manchester City fan.',
    email: 'persona_tariq@tennews.test',
    homeCountry: 'pakistan',
    subtopics: ['Cricket', 'Banking & Lending', 'Asian Politics', 'Trade & Tariffs'],
    personality: { patience: 0.7, saveRate: 0.05, sessionSize: [15, 28] },
    details: { favTeams: ['Karachi Kings', 'Pakistan NT', 'Manchester City'], favPlayers: ['Babar Azam', 'Shaheen Afridi'], specifics: 'PSL matches, Pakistan vs India, Islamic finance, CPEC, SBP rate decisions, Man City results' },
    curiosityKeywords: ['pakistan', 'karachi', 'cricket', 'cpec', 'china', 'islamic finance', 'rupee'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'gaming', 'sneakers', 'nfl'],
    headlineTriggers: ['pakistan', 'cricket', 'babar', 'karachi', 'man city', 'cpec', 'psl'],
    repetitionTolerance: 4,
  },
  {
    name: 'Ayse', age: 34, location: 'Ankara, Turkey',
    bio: 'SaaS startup founder, just closed Series A. Follows AI tooling space and Turkish-EU trade relations. Besiktas fan — grew up in Kadikoy but chose the dark side.',
    email: 'persona_ayse@tennews.test',
    homeCountry: 'turkiye',
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 30] },
    details: { favTeams: ['Besiktas'], favPlayers: [], specifics: 'Turkish startup funding, AI SaaS tools, Ankara-Brussels relations, Turkish exports, Super Lig derbies' },
    curiosityKeywords: ['women founder', 'remote work', 'saas', 'productivity', 'turkey', 'ankara', 'besiktas', 'space'],
    annoyanceKeywords: ['death toll', 'massacre', 'graphic', 'celebrity divorce'],
    headlineTriggers: ['billion valuation', 'acquired', 'unicorn', 'besiktas', 'turkey'],
    repetitionTolerance: 2,
  },
  // ═══════════════════════════════════════════════════════════════════════
  // GEN X & BOOMERS (43-70) — 15 personas
  // Patient readers, loyal to topics, high dwell times, higher save rates
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Nadia', age: 48, location: 'Berlin, Germany',
    bio: 'International relations professor at Humboldt University. Specializes in NATO and Middle East policy. Published 3 books on post-Cold War Europe. Reads Der Spiegel and FT daily.',
    email: 'persona_nadia@tennews.test',
    homeCountry: 'germany',
    subtopics: ['War & Conflict', 'Middle East', 'European Politics', 'Human Rights & Civil Liberties'],
    personality: { patience: 1.0, saveRate: 0.12, sessionSize: [20, 35] },
    details: { favTeams: [], favPlayers: [], specifics: 'NATO summits, Iran nuclear deal, Scholz coalition, Ukraine frontlines, UN Human Rights Council, refugee policy' },
    curiosityKeywords: ['regulation', 'sanctions', 'climate summit', 'nuclear', 'treaty', 'exodus', 'displaced'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'gaming'],
    headlineTriggers: ['unprecedented', 'historic', 'classified', 'leaked'],
    repetitionTolerance: 5,
  },
  {
    name: 'Mike', age: 58, location: 'Dallas, TX',
    bio: 'Retired Army colonel, now a military analyst on cable news. Dallas Cowboys fan for 40+ years. Watches every F1 race — loves the strategy. Follows US defense policy closely.',
    email: 'persona_mike@tennews.test',
    homeCountry: 'usa',
    subtopics: ['NFL', 'US Politics', 'War & Conflict', 'F1 & Motorsport'],
    personality: { patience: 0.7, saveRate: 0.05, sessionSize: [20, 40] },
    details: { favTeams: ['Dallas Cowboys', 'Red Bull Racing'], favPlayers: ['Dak Prescott', 'Verstappen'], specifics: 'Cowboys roster moves, NFC East standings, Pentagon budget, Ukraine strategy, COTA Grand Prix' },
    curiosityKeywords: ['military tech', 'drone', 'veteran', 'defense contractor', 'lockheed', 'boeing', 'navy', 'air force', 'texas', 'dallas'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'fashion week'],
    headlineTriggers: ['cowboys', 'pentagon', 'troops', 'general', 'classified', 'verstappen'],
    repetitionTolerance: 4,
  },
  {
    name: 'Robert', age: 68, location: 'Tampa, FL',
    bio: 'Retired school principal. Watches CNN and Fox to "hear both sides." Tampa Bay Buccaneers and Rays fan. Follows gold prices — has physical gold in a safe.',
    email: 'persona_robert@tennews.test',
    homeCountry: 'usa',
    subtopics: ['US Politics', 'Public Health', 'Commodities', 'NFL'],
    personality: { patience: 0.9, saveRate: 0.06, sessionSize: [15, 30] },
    details: { favTeams: ['Tampa Bay Buccaneers', 'Tampa Bay Rays'], favPlayers: [], specifics: 'Medicare policy, gold price, Bucs draft picks, Trump/Biden news, CDC announcements, NFC South' },
    curiosityKeywords: ['hurricane', 'florida', 'tampa', 'education', 'school', 'teacher', 'veteran', 'retirement', 'social security', 'weather'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'nft', 'metaverse', 'k-pop'],
    headlineTriggers: ['florida', 'tampa', 'buccaneers', 'gold price', 'social security'],
    repetitionTolerance: 6,
  },
  {
    name: 'Henrik', age: 52, location: 'Geneva, Switzerland',
    bio: 'Former Swedish diplomat, now director at the Geneva Centre for Security Policy. Follows EU/NATO policy obsessively. Reads The Economist cover to cover. BSC Young Boys fan — rare for a Swede in Geneva.',
    email: 'persona_henrik@tennews.test',
    homeCountry: 'switzerland',
    subtopics: ['European Politics', 'Human Rights & Civil Liberties', 'Trade & Tariffs', 'Banking & Lending'],
    personality: { patience: 0.9, saveRate: 0.10, sessionSize: [18, 30] },
    details: { favTeams: ['BSC Young Boys'], favPlayers: [], specifics: 'EU Council meetings, Swiss neutrality debate, ECB rate decisions, NATO expansion, sanctions policy, Swiss Super League' },
    curiosityKeywords: ['switzerland', 'swiss', 'sweden', 'scandinavia', 'geneva', 'diplomat', 'ambassador', 'un', 'imf', 'world bank'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'sneakers', 'k-pop'],
    headlineTriggers: ['eu', 'nato', 'sanctions', 'historic', 'swiss', 'young boys'],
    repetitionTolerance: 5,
  },
  {
    name: 'Thomas', age: 46, location: 'Amsterdam, Netherlands',
    bio: 'Climate journalist at NRC Handelsblad. Covers COP summits and EU Green Deal. Ajax fan who follows Eredivisie casually. Cycles everywhere.',
    email: 'persona_thomas@tennews.test',
    homeCountry: 'netherlands',
    subtopics: ['Climate & Environment', 'European Politics', 'Oil & Energy'],
    personality: { patience: 0.6, saveRate: 0.05, sessionSize: [15, 30] },
    details: { favTeams: ['Ajax'], favPlayers: [], specifics: 'EU carbon border tax, offshore wind, North Sea drilling, Timmermans policy, Eredivisie results' },
    curiosityKeywords: ['ev', 'electric', 'solar', 'wind', 'battery', 'pollution', 'ocean', 'flooding', 'amsterdam', 'dutch', 'netherlands'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'celebrity', 'kardashian'],
    headlineTriggers: ['record temperature', 'flooding', 'wildfire', 'ajax', 'netherlands'],
    repetitionTolerance: 3,
  },
  {
    name: 'Jennifer', age: 45, location: 'Toronto, Canada',
    bio: 'High school science teacher and mom of two. Toronto Raptors fan — took kids to 5 games last season. Follows climate science and nature documentaries. iPhone loyalist.',
    email: 'persona_jennifer@tennews.test',
    homeCountry: 'canada',
    subtopics: ['Public Health', 'Climate & Environment', 'Biology & Nature', 'NBA'],
    personality: { patience: 0.7, saveRate: 0.05, sessionSize: [12, 25] },
    details: { favTeams: ['Toronto Raptors'], favPlayers: ['Scottie Barnes'], specifics: 'Canadian healthcare policy, IPCC reports, wildlife conservation, Raptors games, NBA Eastern Conference, new iPhone announcements' },
    curiosityKeywords: ['canada', 'toronto', 'education', 'school', 'parent', 'children', 'iphone', 'apple', 'kid safety', 'food safety'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'hedge fund', 'derivatives'],
    headlineTriggers: ['raptors', 'toronto', 'canada', 'teacher', 'parent', 'apple'],
    repetitionTolerance: 3,
  },
  {
    name: 'Patricia', age: 55, location: 'Washington DC',
    bio: 'Senior editor at The Washington Post. Covers US politics and government accountability. Georgetown alum. Nationals and Commanders fan. Book club organizer.',
    email: 'persona_patricia@tennews.test',
    homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Corporate Deals', 'Movies & Film'],
    personality: { patience: 0.9, saveRate: 0.09, sessionSize: [18, 32] },
    details: { favTeams: ['Washington Nationals', 'Washington Commanders'], favPlayers: [], specifics: 'congressional hearings, SCOTUS decisions, lobbying scandals, Oscar nominations, DC politics, media industry M&A' },
    curiosityKeywords: ['washington', 'congress', 'senate', 'journalist', 'press freedom', 'book', 'publisher', 'investigation'],
    annoyanceKeywords: ['crypto', 'gaming', 'cosplay', 'sneakers', 'tiktok dance'],
    headlineTriggers: ['washington', 'congress', 'supreme court', 'investigation', 'leaked', 'oscar'],
    repetitionTolerance: 5,
  },
  {
    name: 'Rashid', age: 62, location: 'Riyadh, Saudi Arabia',
    bio: 'Retired petroleum engineer, now consults for Saudi Aramco. Follows oil markets obsessively. Al Hilal fan — saw Ronaldo debut live. Reads the Financial Times on his iPad every morning.',
    email: 'persona_rashid@tennews.test',
    homeCountry: 'saudi_arabia',
    subtopics: ['Oil & Energy', 'Middle East', 'Soccer/Football', 'Trade & Tariffs'],
    personality: { patience: 0.8, saveRate: 0.06, sessionSize: [15, 28] },
    details: { favTeams: ['Al Hilal'], favPlayers: ['Ronaldo', 'Neymar'], specifics: 'OPEC+ meetings, Brent crude, Saudi Vision 2030, Saudi Pro League, Middle East diplomacy, LNG exports' },
    curiosityKeywords: ['saudi', 'riyadh', 'aramco', 'opec', 'gulf', 'arabic', 'mosque', 'pilgrimage'],
    annoyanceKeywords: ['k-pop', 'gaming', 'cosplay', 'anime', 'tiktok', 'sneakers'],
    headlineTriggers: ['saudi', 'opec', 'oil price', 'al hilal', 'ronaldo', 'aramco', 'vision 2030'],
    repetitionTolerance: 5,
  },
  {
    name: 'Margaret', age: 64, location: 'Edinburgh, Scotland',
    bio: 'Retired NHS nurse. Follows Scottish independence debate passionately. Celtic fan — had season tickets for 20 years. Watches BBC nature documentaries. Knits while reading news.',
    email: 'persona_margaret@tennews.test',
    homeCountry: 'uk',
    subtopics: ['European Politics', 'Public Health', 'Biology & Nature', 'Climate & Environment'],
    personality: { patience: 0.9, saveRate: 0.07, sessionSize: [12, 22] },
    details: { favTeams: ['Celtic FC'], favPlayers: [], specifics: 'Scottish independence, NHS funding, David Attenborough series, UK climate policy, Celtic SPL results, COP summits' },
    curiosityKeywords: ['scotland', 'edinburgh', 'nhs', 'nurse', 'wildlife', 'animal', 'attenborough', 'queen', 'royal'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'gaming', 'influencer', 'meme stock', 'nfl'],
    headlineTriggers: ['scotland', 'celtic', 'nhs', 'edinburgh', 'wildlife', 'endangered', 'royal'],
    repetitionTolerance: 5,
  },
  {
    name: 'George', age: 70, location: 'Phoenix, AZ',
    bio: 'Retired Air Force pilot. Follows space news religiously — watched every NASA mission since Apollo. Arizona Cardinals fan since the St. Louis days. Amateur astronomer.',
    email: 'persona_george@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Space & Astronomy', 'US Politics', 'War & Conflict', 'Earth Science'],
    personality: { patience: 0.95, saveRate: 0.08, sessionSize: [15, 28] },
    details: { favTeams: ['Arizona Cardinals'], favPlayers: [], specifics: 'NASA Artemis missions, James Webb telescope, Mars rovers, military aviation, Air Force budget, Cardinals NFL, asteroid tracking' },
    curiosityKeywords: ['nasa', 'space', 'mars', 'telescope', 'asteroid', 'pilot', 'air force', 'arizona', 'phoenix', 'desert'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'meme', 'crypto', 'streaming'],
    headlineTriggers: ['nasa', 'mars', 'telescope', 'asteroid', 'cardinals', 'air force', 'space'],
    repetitionTolerance: 6,
  },
  {
    name: 'Ingrid', age: 50, location: 'Oslo, Norway',
    bio: 'Oil fund analyst at Norges Bank Investment Management. Manages part of the world\'s largest sovereign wealth fund. Follows global markets and energy transition. Rosenborg BK fan.',
    email: 'persona_ingrid@tennews.test',
    homeCountry: 'norway',
    subtopics: ['Oil & Energy', 'Stock Markets', 'Climate & Environment', 'Banking & Lending'],
    personality: { patience: 0.8, saveRate: 0.07, sessionSize: [15, 28] },
    details: { favTeams: ['Rosenborg BK'], favPlayers: [], specifics: 'Norwegian oil fund, Equinor, Brent crude, energy transition, ECB policy, ESG investing, Eliteserien results' },
    curiosityKeywords: ['norway', 'oslo', 'nordic', 'scandinavia', 'sovereign fund', 'equinor', 'fjord', 'arctic'],
    annoyanceKeywords: ['celebrity', 'gossip', 'k-pop', 'gaming', 'sneakers', 'reality tv'],
    headlineTriggers: ['norway', 'oil fund', 'equinor', 'arctic', 'nordic', 'oil price', 'rosenborg'],
    repetitionTolerance: 4,
  },
  {
    name: 'Larry', age: 59, location: 'Detroit, MI',
    bio: 'Auto industry veteran — 30 years at Ford. Now consults on EV transitions. Detroit Lions and Red Wings diehard. Bowls every Thursday. Reads Car and Driver.',
    email: 'persona_larry@tennews.test',
    homeCountry: 'usa',
    subtopics: ['Automotive', 'NFL', 'Oil & Energy', 'Trade & Tariffs'],
    personality: { patience: 0.7, saveRate: 0.05, sessionSize: [15, 28] },
    details: { favTeams: ['Detroit Lions', 'Detroit Red Wings'], favPlayers: [], specifics: 'Ford/GM EV plans, UAW union, Detroit manufacturing, Lions games, auto tariffs, battery supply chain' },
    curiosityKeywords: ['detroit', 'michigan', 'ford', 'gm', 'tesla', 'ev', 'electric', 'union', 'factory', 'manufacturing'],
    annoyanceKeywords: ['k-pop', 'anime', 'cosplay', 'influencer', 'tiktok', 'fashion'],
    headlineTriggers: ['ford', 'detroit', 'lions', 'ev', 'electric vehicle', 'auto', 'tariff'],
    repetitionTolerance: 4,
  },
  {
    name: 'Zara', age: 20, location: 'London, UK',
    bio: 'UCL sociology student and TikTok creator (45K followers). Into sustainable fashion and mental health advocacy. Arsenal fan through her dad. Goes to Reading Festival every year.',
    email: 'persona_zara@tennews.test',
    homeCountry: 'uk',
    subtopics: ['Climate & Environment', 'Mental Health', 'Soccer/Football', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.4, saveRate: 0.04, sessionSize: [12, 25] },
    details: { favTeams: ['Arsenal'], favPlayers: ['Saka', 'Odegaard'], specifics: 'fast fashion impact, therapy access NHS, Arsenal results, Premier League table, Met Gala outfits, Glastonbury lineup' },
    curiosityKeywords: ['london', 'uk', 'student', 'gen z', 'tiktok', 'viral', 'animal', 'rescue', 'billionaire', 'protest', 'affordable'],
    annoyanceKeywords: ['quarterly results', 'earnings', 'commodity', 'tariff', 'fed rate'],
    headlineTriggers: ['arsenal', 'saka', 'london', 'shocking', 'viral', 'gen z'],
    repetitionTolerance: 2,
  },
  {
    name: 'Devon', age: 21, location: 'Austin, TX',
    bio: 'UT Austin senior, huge sports fan. Lives for the NFL Draft and NBA playoffs. Philadelphia Eagles fan (dad is from Philly). Plays Call of Duty competitively. Collects Jordans.',
    email: 'persona_devon@tennews.test',
    homeCountry: 'usa',
    subtopics: ['NFL', 'NBA', 'Boxing & MMA/UFC', 'Gaming', 'Sneakers & Streetwear'],
    personality: { patience: 0.3, saveRate: 0.02, sessionSize: [15, 30] },
    details: { favTeams: ['Philadelphia Eagles', 'Dallas Mavericks'], favPlayers: ['Jalen Hurts', 'Luka Doncic', 'Jon Jones'], specifics: 'NFL Draft prospects, NBA standings, UFC fight nights, CoD tournaments, Jordan retro drops, Nike SNKRS' },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'elon', 'tesla', 'million dollar', 'world record', 'arrest'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'quarterly', 'fiscal', 'summit'],
    headlineTriggers: ['eagles', 'mavericks', 'luka', 'ufc', 'jordan', 'nike', 'world record'],
    repetitionTolerance: 2,
  },
  {
    name: 'Lars', age: 23, location: 'Stockholm, Sweden',
    bio: 'Semi-pro Counter-Strike player. Streams on Twitch (8K followers). Follows every gaming hardware launch. Into AI art tools. AIK supporter — goes to Allsvenskan matches in summer.',
    email: 'persona_lars@tennews.test',
    homeCountry: 'sweden',
    subtopics: ['Gaming', 'AI & Machine Learning', 'Smartphones & Gadgets', 'Robotics & Hardware'],
    personality: { patience: 0.4, saveRate: 0.03, sessionSize: [15, 30] },
    details: { favTeams: ['AIK'], favPlayers: [], specifics: 'CS2 Major tournaments, Steam Deck updates, NVIDIA RTX launches, AI image generation, Allsvenskan results, Twitch drama' },
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
  if (dwell >= 10) return '█'.repeat(len);
  if (dwell >= 3) return '▓'.repeat(len);
  if (dwell >= 1) return '▒'.repeat(len);
  return '░'.repeat(len);
}

function getArticleTags(article) {
  const raw = article.interestTags || article.interest_tags || article.topics || [];
  return (Array.isArray(raw) ? raw : []).map(t => String(t).toLowerCase());
}

// Build all keywords and categories for a persona from their subtopics
function buildPersonaProfile(persona) {
  const allTags = [];
  const allCategories = new Set();
  const subtopicKeywords = {}; // subtopic name → [keywords]

  for (const st of persona.subtopics) {
    const def = SUBTOPIC_MAP[st];
    if (!def) continue;
    subtopicKeywords[st] = def.tags;
    allTags.push(...def.tags);
    def.categories.forEach(c => allCategories.add(c));
  }

  return { allTags, allCategories: [...allCategories], subtopicKeywords };
}

// Check which subtopics an article matches
function matchArticleToSubtopics(article, profile) {
  const tags = getArticleTags(article);
  const title = (article.title || article.title_news || '').toLowerCase();
  const category = (article.category || '').trim();
  const combined = [...tags, ...title.split(/\s+/)].join(' ').toLowerCase();

  const matchedSubtopics = [];

  for (const [subtopicName, keywords] of Object.entries(profile.subtopicKeywords)) {
    const hit = keywords.some(kw => combined.includes(kw));
    const catHit = SUBTOPIC_MAP[subtopicName].categories.includes(category);
    if (hit || catHit) {
      matchedSubtopics.push(subtopicName);
    }
  }

  return matchedSubtopics;
}

// ============================================================================
// BEHAVIOR ENGINE — Simulates realistic reading behavior
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
  if (matchedSubtopics.length >= 2) score += 0.5;
  else if (matchedSubtopics.length === 1) score += 0.3;

  // Direct keyword matching (more precise)
  let keywordHits = 0;
  for (const kw of profile.allTags) {
    if (combined.includes(kw)) keywordHits++;
  }
  score += Math.min(0.3, keywordHits * 0.05);

  // Category match
  if (profile.allCategories.includes(category)) score += 0.15;

  // No match penalty — irrelevant content
  if (!isRelevant && !profile.allCategories.includes(category)) score -= 0.2;

  // --- CURIOSITY: off-topic articles can still catch attention ---
  if (persona.curiosityKeywords && !isRelevant) {
    const curiosityHits = persona.curiosityKeywords.filter(kw => combined.includes(kw)).length;
    if (curiosityHits >= 2) score += 0.3;       // strong curiosity match
    else if (curiosityHits === 1) score += 0.18; // mild curiosity
  }

  // --- ANNOYANCE: certain content actively repels the user ---
  if (persona.annoyanceKeywords) {
    const annoyHits = persona.annoyanceKeywords.filter(kw => combined.includes(kw)).length;
    if (annoyHits >= 2) score -= 0.3;
    else if (annoyHits === 1) score -= 0.18;
  }

  // --- HEADLINE TRIGGERS: specific words in the title grab attention hard ---
  if (persona.headlineTriggers) {
    const triggerHits = persona.headlineTriggers.filter(kw => title.includes(kw)).length;
    if (triggerHits >= 2) score += 0.35;       // irresistible headline
    else if (triggerHits === 1) score += 0.2;  // strong pull
  }

  // --- STORY-LEVEL REPETITION: same event/story seen too many times ---
  // Extract key phrases from title (3-word chunks) to detect "same story"
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
      storyRepeatPenalty = Math.max(storyRepeatPenalty, -0.15 - 0.05 * (seen - tolerance));
    }
  }
  score += storyRepeatPenalty;

  // Quality boost
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += 0.1;
  else if (aiScore >= 800) score += 0.05;

  // Breaking news attention
  if (/breaking|just in|exclusive/i.test(title)) score += 0.08;

  // Fatigue
  const idx = ctx.articleIndex;
  if (idx > 8) score -= 0.03;
  if (idx > 15) score -= 0.05;
  if (idx > 25) score -= 0.08;
  if (idx > 35) score -= 0.1;

  // Mood affects willingness
  if (ctx.satisfaction < 35) score -= 0.08;
  if (ctx.satisfaction < 20) score -= 0.15;

  // Content repetition (category-level, kept as baseline)
  const catSeenCount = ctx.categorySeen[category] || 0;
  if (catSeenCount >= 6 && !isRelevant) score -= 0.08;
  if (catSeenCount >= 10) score -= 0.1;

  // Momentum
  if (ctx.lastMatchedSubtopics.length > 0 && matchedSubtopics.some(s => ctx.lastMatchedSubtopics.includes(s))) {
    score += 0.1;
  }

  // Random variance
  score += (Math.random() - 0.5) * 0.15;

  const patience = persona.personality.patience;

  // Determine action
  if (score >= 0.6) {
    const dwell = (10 + Math.random() * 20) * patience;
    const shouldSave = Math.random() < persona.personality.saveRate * 1.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    const moodDelta = shouldSave ? +(6 + Math.random() * 5) : +(4 + Math.random() * 4);
    return { action: 'DEEP_READ', dwell, events, signal: 'ENGAGE', save: shouldSave, matchedSubtopics, moodDelta, score };
  }
  if (score >= 0.3) {
    const dwell = (4 + Math.random() * 10) * patience;
    const shouldSave = Math.random() < persona.personality.saveRate * 0.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (shouldSave) events.push('article_saved');
    const moodDelta = +(2 + Math.random() * 3);
    return { action: 'ENGAGE', dwell, events, signal: 'ENGAGE', save: shouldSave, matchedSubtopics, moodDelta, score };
  }
  if (score >= 0.05) {
    const dwell = (2 + Math.random() * 3.5) * patience;
    return { action: 'GLANCE', dwell, events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', save: false, matchedSubtopics, moodDelta: -0.5, score };
  }
  if (score >= -0.1) {
    const dwell = 1 + Math.random() * 1.5;
    return { action: 'SCAN', dwell, events: ['article_view'], signal: 'NEUTRAL', save: false, matchedSubtopics, moodDelta: -2.5, score };
  }

  // SKIP
  const dwell = 0.3 + Math.random() * 0.8;
  const penalty = matchedSubtopics.length === 0 ? -4 : -2;
  const streakPenalty = ctx.consecutiveSkips >= 3 ? -1.5 : 0;
  return { action: 'SKIP', dwell, events: ['article_skipped'], signal: 'SKIP', save: false, matchedSubtopics, moodDelta: penalty + streakPenalty, score };
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

  // Try to create the user; if already exists, sign in to get their ID
  const { data, error } = await adminDb.auth.admin.createUser({
    email: persona.email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `${persona.name} (Test Persona)` },
  });
  if (error) {
    // User already exists — sign in to get userId + token in one call
    const signInClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({ email: persona.email, password: PASSWORD });
    if (signInError) { console.error(`  [SETUP] Cannot sign in ${persona.name}: ${signInError.message}`); return null; }
    userId = signInData.user.id;
    accessToken = signInData.session.access_token;
  } else {
    userId = data.user.id;
    await sleep(600);
    // New user — need to sign in for access token
    accessToken = await getAccessToken(persona.email, PASSWORD);
  }

  if (!accessToken) { console.error(`  [SETUP] No token for ${persona.name}`); return null; }

  // Map subtopics to followed_topics (use subtopic names directly — API supports them)
  const followedTopics = persona.subtopics;

  const profileData = {
    email: persona.email, full_name: `${persona.name} (Test Persona)`,
    home_country: persona.homeCountry, followed_countries: [],
    followed_topics: followedTopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  };

  const { data: existingProfile } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (existingProfile) {
    await adminDb.from('profiles').update(profileData).eq('id', userId);
  } else {
    await adminDb.from('profiles').insert({ id: userId, ...profileData });
  }

  // Clean slate
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);

  return { userId, accessToken };
}

// ============================================================================
// SESSION SIMULATION
// ============================================================================

async function simulateSession(persona, userId, accessToken, sessionNum, profile, priorHistory = {}) {
  const sessionId = `sim_${persona.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;
  const sessionSize = persona.personality.sessionSize;
  const maxArticles = sessionSize[0] + Math.floor(Math.random() * (sessionSize[1] - sessionSize[0]));
  const maxPages = Math.ceil(maxArticles / 25) + 1;

  // Accumulate history from prior sessions (so feed knows what user already saw/liked/skipped)
  const engagedIds = [...(priorHistory.engagedIds || [])];
  const skippedIds = [...(priorHistory.skippedIds || [])];
  const seenIds = [...(priorHistory.seenIds || [])];
  const interactions = [];
  let cursor = null;
  let totalTracked = 0;

  const ctx = {
    articleIndex: 0,
    consecutiveSkips: 0,
    lastMatchedSubtopics: [],
    satisfaction: 50,
    engagedCount: 0,
    savedCount: 0,
    totalSeen: 0,
    categorySeen: {},
    categoryEngaged: {},
    subtopicSeen: {},  // track per-subtopic article counts
    subtopicEngaged: {},
    storyTracker: {},  // key phrase → count, for story-level repetition detection
  };

  let exitType = 'natural';

  for (let page = 1; page <= maxPages; page++) {
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    // Use all articles — don't filter by age for test purposes
    const freshArticles = resp.articles;

    for (const article of freshArticles) {
      const id = String(article.id);
      seenIds.push(id);
      ctx.articleIndex = interactions.length;
      ctx.totalSeen = interactions.length + 1;
      const category = (article.category || '').trim();
      ctx.categorySeen[category] = (ctx.categorySeen[category] || 0) + 1;

      const reaction = simulateReaction(persona, article, profile, ctx);

      // Update story tracker — record 2-word key phrases from this article's title
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

      // Update context
      if (reaction.signal === 'ENGAGE') {
        engagedIds.push(id);
        ctx.consecutiveSkips = 0;
        ctx.lastMatchedSubtopics = reaction.matchedSubtopics;
        ctx.engagedCount++;
        ctx.categoryEngaged[category] = (ctx.categoryEngaged[category] || 0) + 1;
        if (reaction.save) ctx.savedCount++;
        for (const st of reaction.matchedSubtopics) {
          ctx.subtopicEngaged[st] = (ctx.subtopicEngaged[st] || 0) + 1;
        }
      } else if (reaction.signal === 'SKIP') {
        skippedIds.push(id);
        ctx.consecutiveSkips++;
        ctx.lastMatchedSubtopics = [];
      } else {
        if (reaction.signal !== 'GLANCE') ctx.consecutiveSkips++;
        else ctx.consecutiveSkips = 0;
      }

      // Record interaction
      interactions.push({
        num: interactions.length + 1, id, title: cleanTitle, category,
        bucket: article.bucket || '-', action: reaction.action, signal: reaction.signal,
        dwell: reaction.dwell, save: reaction.save, mood: Math.round(ctx.satisfaction),
        matchedSubtopics: reaction.matchedSubtopics, score: reaction.score,
        source: (article.source || '').substring(0, 30),
        createdAt: article.created_at || article.createdAt || null,
      });

      // Exit decisions
      if (ctx.satisfaction <= 18 && interactions.length >= 6) { exitType = 'frustrated'; break; }
      if (ctx.satisfaction <= 30 && ctx.consecutiveSkips >= 4 && interactions.length >= 5) { exitType = 'bored'; break; }
      if (ctx.satisfaction <= 38 && ctx.consecutiveSkips >= 6) { exitType = 'bored'; break; }
      if (ctx.satisfaction <= 35 && interactions.length >= 12 && ctx.engagedCount < interactions.length * 0.25) { exitType = 'bored'; break; }
      if (interactions.length >= maxArticles) { exitType = 'natural'; break; }
    }

    if (exitType !== 'natural' || interactions.length >= maxArticles) break;
    await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  // Count only this session's skips (not accumulated from prior)
  const thisSessionSkips = interactions.filter(i => i.signal === 'SKIP').length;
  const thisSessionEngaged = interactions.filter(i => i.signal === 'ENGAGE').length;
  const thisSessionRelevant = interactions.filter(i => i.matchedSubtopics.length > 0).length;
  const thisSessionDeepReads = interactions.filter(i => i.action === 'DEEP_READ').length;
  const thisSessionDwell = interactions.reduce((s, i) => s + i.dwell, 0);

  return {
    sessionNum, sessionId, interactions, totalTracked, exitType,
    finalSatisfaction: Math.round(ctx.satisfaction),
    // Pass accumulated IDs for next session
    accumulatedHistory: { engagedIds: [...engagedIds], skippedIds: [...skippedIds], seenIds: [...seenIds] },
    stats: {
      total: interactions.length, engaged: ctx.engagedCount, saved: ctx.savedCount,
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
// 5-DIMENSION SCORING (1-5 each, total max 25 → scaled to 100)
// ============================================================================

function scorePersona(persona, sessions, profile) {
  const allInteractions = sessions.flatMap(s => s.interactions);
  const total = allInteractions.length;

  if (total === 0) {
    return { relevance: 1, coverage: 1, diversity: 1, quality: 1, wouldReturn: 1, total: 20 };
  }

  // 1. SUBTOPIC RELEVANCE (1-5): what % of articles matched at least one subtopic?
  const relevant = allInteractions.filter(i => i.matchedSubtopics.length > 0).length;
  const relevanceRate = relevant / total;
  const relevance = relevanceRate >= 0.7 ? 5 : relevanceRate >= 0.5 ? 4 : relevanceRate >= 0.35 ? 3 : relevanceRate >= 0.2 ? 2 : 1;

  // 2. INTEREST COVERAGE (1-5): how many of the selected subtopics got at least 1 article?
  const subtopicsWithContent = new Set();
  for (const i of allInteractions) {
    for (const st of i.matchedSubtopics) subtopicsWithContent.add(st);
  }
  const coverageRate = subtopicsWithContent.size / persona.subtopics.length;
  const coverage = coverageRate >= 1.0 ? 5 : coverageRate >= 0.75 ? 4 : coverageRate >= 0.5 ? 3 : coverageRate >= 0.25 ? 2 : 1;

  // 3. DIVERSITY (1-5): spread across categories (not dominated by one)
  const catCounts = {};
  for (const i of allInteractions) catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  const cats = Object.values(catCounts);
  const maxCatShare = Math.max(...cats) / total;
  const numCats = cats.length;
  const diversity = (maxCatShare <= 0.3 && numCats >= 4) ? 5
    : (maxCatShare <= 0.4 && numCats >= 3) ? 4
    : (maxCatShare <= 0.5 && numCats >= 3) ? 3
    : (maxCatShare <= 0.6) ? 2 : 1;

  // 4. QUALITY (1-5): based on engagement depth (dwell time on engaged articles)
  const engagedArticles = allInteractions.filter(i => i.signal === 'ENGAGE');
  const avgEngDwell = engagedArticles.length > 0 ? engagedArticles.reduce((s, i) => s + i.dwell, 0) / engagedArticles.length : 0;
  const engRate = engagedArticles.length / total;
  const qualityScore = (avgEngDwell * 0.3) + (engRate * 10); // weighted composite
  const quality = qualityScore >= 6 ? 5 : qualityScore >= 4 ? 4 : qualityScore >= 2.5 ? 3 : qualityScore >= 1.5 ? 2 : 1;

  // 5. WOULD-RETURN (1-5): based on final satisfaction trend
  const avgSat = sessions.reduce((s, sess) => s + sess.finalSatisfaction, 0) / sessions.length;
  const frustrations = sessions.filter(s => s.exitType === 'frustrated').length;
  let wouldReturn;
  if (avgSat >= 65 && frustrations === 0) wouldReturn = 5;
  else if (avgSat >= 50 && frustrations <= 1) wouldReturn = 4;
  else if (avgSat >= 38) wouldReturn = 3;
  else if (avgSat >= 25) wouldReturn = 2;
  else wouldReturn = 1;

  const totalScore = relevance + coverage + diversity + quality + wouldReturn;
  return { relevance, coverage, diversity, quality, wouldReturn, total: totalScore };
}

// ============================================================================
// OUTPUT — Every article with dwell + scores
// ============================================================================

function printSessionDetail(persona, session) {
  const s = session.stats;
  const exitIcon = session.exitType === 'frustrated' ? '💢' : session.exitType === 'bored' ? '😴' : '✓';
  const maxDwell = Math.max(...session.interactions.map(i => i.dwell), 1);

  console.log(`\n  SESSION ${session.sessionNum}:`);
  console.log(`  ┌${'─'.repeat(120)}`);
  console.log(`  │  ${'#'.padStart(3)}  ${'Action'.padEnd(10)} ${'Dwell'.padStart(7)}  ${'Bar'.padEnd(20)}  ${'Mood'.padStart(4)}  ${'Category'.padEnd(14)} ${'Bucket'.padEnd(8)} Subtopic Match                    Title`);
  console.log(`  │  ${'─'.repeat(116)}`);

  for (const m of session.interactions) {
    const actionIcon = m.action === 'DEEP_READ' ? '⭐' : m.action === 'ENGAGE' ? '👀' : m.action === 'GLANCE' ? '👁️' : m.action === 'SKIP' ? '⏭️' : '📰';
    const dwellStr = formatDwell(m.dwell);
    const bar = dwellBar(m.dwell, maxDwell);
    const saveTag = m.save ? ' 💾' : '';
    const subtopicStr = m.matchedSubtopics.length > 0 ? m.matchedSubtopics.slice(0, 2).join(', ').substring(0, 32) : '—';

    console.log(`  │  ${String(m.num).padStart(3)}  ${(actionIcon + ' ' + m.action).padEnd(13)} ${dwellStr.padStart(7)}  ${bar.padEnd(20)}  ${String(m.mood).padStart(4)}  ${(m.category || '-').padEnd(14)} ${(m.bucket || '-').padEnd(8)} ${subtopicStr.padEnd(33)} ${(m.title || '').substring(0, 40)}${saveTag}`);
  }

  // Session summary
  const dwells = session.interactions.map(i => i.dwell);
  const totalDwell = dwells.reduce((a, b) => a + b, 0);
  const engArticles = session.interactions.filter(i => i.signal === 'ENGAGE');
  const relevantCount = session.interactions.filter(i => i.matchedSubtopics.length > 0).length;

  console.log(`  │  ${'─'.repeat(116)}`);
  console.log(`  │  ${exitIcon} ${session.exitType === 'natural' ? 'FINISHED' : 'LEFT'} after ${s.total} articles │ Relevant: ${relevantCount}/${s.total} (${s.total > 0 ? ((relevantCount/s.total)*100).toFixed(0) : 0}%) │ Engaged: ${s.engaged} │ Dwell: ${formatDwell(totalDwell)} total, ${formatDwell(s.avgDwell)} avg │ Mood: ${session.finalSatisfaction}`);
  console.log(`  └${'─'.repeat(120)}`);
}

function printPersonaReport(persona, sessions, scores, profile) {
  const THICK = '━'.repeat(122);
  console.log(`\n${THICK}`);
  console.log(`  ${persona.name.toUpperCase()}, ${persona.age} — ${persona.bio} (${persona.location})`);
  console.log(`  Home: ${persona.homeCountry} │ Subtopics: ${persona.subtopics.join(', ')}`);
  console.log(THICK);

  for (const session of sessions) {
    printSessionDetail(persona, session);
  }

  // Aggregate dwell analysis
  const allInts = sessions.flatMap(s => s.interactions);
  const totalTime = allInts.reduce((s, i) => s + i.dwell, 0);
  const engaged = allInts.filter(i => i.signal === 'ENGAGE');
  const skipped = allInts.filter(i => i.signal === 'SKIP');
  const deepReads = allInts.filter(i => i.action === 'DEEP_READ');

  // Dwell by category
  const dwellByCat = {};
  const countByCat = {};
  for (const i of allInts) {
    dwellByCat[i.category] = (dwellByCat[i.category] || 0) + i.dwell;
    countByCat[i.category] = (countByCat[i.category] || 0) + 1;
  }

  // Subtopic coverage detail
  const stSeen = {};
  const stEngaged = {};
  for (const i of allInts) {
    for (const st of i.matchedSubtopics) {
      stSeen[st] = (stSeen[st] || 0) + 1;
      if (i.signal === 'ENGAGE') stEngaged[st] = (stEngaged[st] || 0) + 1;
    }
  }

  console.log(`\n  DWELL SUMMARY: ${formatDwell(totalTime)} total │ ${allInts.length} articles │ ${formatDwell(totalTime/(allInts.length||1))} avg`);
  console.log(`  Deep reads: ${deepReads.length} (avg ${formatDwell(deepReads.length > 0 ? deepReads.reduce((s,i)=>s+i.dwell,0)/deepReads.length : 0)}) │ Skips: ${skipped.length} (avg ${formatDwell(skipped.length > 0 ? skipped.reduce((s,i)=>s+i.dwell,0)/skipped.length : 0)})`);

  console.log(`\n  SUBTOPIC COVERAGE:`);
  for (const st of persona.subtopics) {
    const seen = stSeen[st] || 0;
    const eng = stEngaged[st] || 0;
    const icon = seen === 0 ? '✗' : seen >= 3 ? '✓' : '△';
    console.log(`    ${icon} ${st.padEnd(32)} seen: ${String(seen).padStart(3)}  engaged: ${String(eng).padStart(3)}`);
  }

  console.log(`\n  SCORES (1-5):`);
  console.log(`    Subtopic Relevance:  ${scores.relevance}/5  │  Interest Coverage:  ${scores.coverage}/5  │  Diversity:  ${scores.diversity}/5  │  Quality:  ${scores.quality}/5  │  Would Return:  ${scores.wouldReturn}/5`);
  console.log(`    TOTAL: ${scores.total}/25 → ${((scores.total / 25) * 100).toFixed(0)}/100`);
}

// ============================================================================
// TREND ANALYSIS — Track session-over-session evolution
// ============================================================================

function computeTrend(values) {
  if (values.length < 2) return { direction: 'flat', delta: 0, slope: 0 };
  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.floor(values.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const delta = avgSecond - avgFirst;
  const pctChange = avgFirst > 0 ? ((delta / avgFirst) * 100) : 0;
  // Linear regression slope
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
// GRAND REPORT — with temporal evolution analysis
// ============================================================================

function printGrandReport(allResults) {
  const THICK = '━'.repeat(130);
  console.log(`\n\n${THICK}`);
  console.log('  GRAND REPORT — 50 PERSONAS (V6 Subtopic Scoring + Temporal Analysis)');
  console.log(THICK);

  const ranked = allResults.sort((a, b) => b.scores.total - a.scores.total);

  // ── PERSONA SCORECARD ──
  console.log('\n  PERSONA SCORECARD:');
  console.log('  ' + '#'.padEnd(4) + 'Name'.padEnd(12) + 'Subtopics'.padEnd(50) + 'Relev'.padStart(6) + 'Cover'.padStart(6) + 'Diver'.padStart(6) + 'Qual'.padStart(6) + 'Return'.padStart(7) + 'TOTAL'.padStart(7) + 'Score'.padStart(7));
  console.log('  ' + '─'.repeat(126));

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const subtopicStr = r.persona.subtopics.join(', ').substring(0, 48);
    const pctScore = ((r.scores.total / 25) * 100).toFixed(0);
    console.log('  ' +
      `${i + 1}.`.padEnd(4) + r.persona.name.padEnd(12) + subtopicStr.padEnd(50) +
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

  console.log('  ' + '─'.repeat(126));
  console.log('  ' + 'AVG'.padEnd(4) + ''.padEnd(62) +
    `${avgScores.relevance.toFixed(1)}`.padStart(6) + `${avgScores.coverage.toFixed(1)}`.padStart(6) +
    `${avgScores.diversity.toFixed(1)}`.padStart(6) + `${avgScores.quality.toFixed(1)}`.padStart(6) +
    `${avgScores.wouldReturn.toFixed(1)}`.padStart(7) + `${avgTotal.toFixed(1)}`.padStart(7) +
    `${overallScore}%`.padStart(7)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PERSONALIZATION OVER TIME — the key analysis
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  PERSONALIZATION OVER TIME — Does the feed get better as users use it?');
  console.log(THICK);

  // Aggregate metrics per session number across all personas
  const numSessions = Math.max(...ranked.map(r => r.sessions.length));
  const perSessionAgg = [];

  for (let sn = 0; sn < numSessions; sn++) {
    const sessionData = { engRates: [], relevRates: [], dwells: [], satisfactions: [], deepReadRates: [], articleCounts: [], skipRates: [] };
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
      }
    }
    perSessionAgg.push({
      session: sn + 1,
      avgEngRate: sessionData.engRates.reduce((a, b) => a + b, 0) / sessionData.engRates.length,
      avgRelevRate: sessionData.relevRates.reduce((a, b) => a + b, 0) / sessionData.relevRates.length,
      avgDwell: sessionData.dwells.reduce((a, b) => a + b, 0) / sessionData.dwells.length,
      avgSatisfaction: sessionData.satisfactions.reduce((a, b) => a + b, 0) / sessionData.satisfactions.length,
      avgDeepReadRate: sessionData.deepReadRates.reduce((a, b) => a + b, 0) / sessionData.deepReadRates.length,
      avgArticles: sessionData.articleCounts.reduce((a, b) => a + b, 0) / sessionData.articleCounts.length,
      avgSkipRate: sessionData.skipRates.reduce((a, b) => a + b, 0) / sessionData.skipRates.length,
      count: sessionData.engRates.length,
    });
  }

  // Session-over-session table
  console.log('\n  SESSION-BY-SESSION AVERAGES (across all 50 personas):');
  console.log('  ' + 'Session'.padEnd(10) + 'Eng Rate'.padStart(10) + 'Relev%'.padStart(9) + 'Avg Dwell'.padStart(11) + 'Deep Read%'.padStart(12) + 'Skip%'.padStart(8) + 'Satisfaction'.padStart(14) + 'Avg Articles'.padStart(14));
  console.log('  ' + '─'.repeat(90));
  for (const s of perSessionAgg) {
    console.log('  ' +
      `S${s.session}`.padEnd(10) +
      `${(s.avgEngRate * 100).toFixed(1)}%`.padStart(10) +
      `${(s.avgRelevRate * 100).toFixed(1)}%`.padStart(9) +
      `${formatDwell(s.avgDwell)}`.padStart(11) +
      `${(s.avgDeepReadRate * 100).toFixed(1)}%`.padStart(12) +
      `${(s.avgSkipRate * 100).toFixed(1)}%`.padStart(8) +
      `${s.avgSatisfaction.toFixed(1)}`.padStart(14) +
      `${s.avgArticles.toFixed(1)}`.padStart(14)
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

  console.log('\n  TREND ANALYSIS (first half vs second half of sessions):');
  console.log('  ' + '─'.repeat(95));
  const trends = [
    { name: 'Engagement Rate', trend: engTrend, spark: sparkline(perSessionAgg.map(s => s.avgEngRate)), good: 'improving' },
    { name: 'Relevance Rate', trend: relevTrend, spark: sparkline(perSessionAgg.map(s => s.avgRelevRate)), good: 'improving' },
    { name: 'Avg Dwell Time', trend: dwellTrend, spark: sparkline(perSessionAgg.map(s => s.avgDwell)), good: 'improving' },
    { name: 'Deep Read Rate', trend: deepTrend, spark: sparkline(perSessionAgg.map(s => s.avgDeepReadRate)), good: 'improving' },
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

  // ── PER-PERSONA EVOLUTION ──
  console.log(`\n${THICK}`);
  console.log('  PER-PERSONA ENGAGEMENT EVOLUTION');
  console.log(THICK);
  console.log('  ' + 'Name'.padEnd(12) + '   ' +
    Array.from({ length: numSessions }, (_, i) => `S${i + 1} Eng%`.padStart(8)).join('') +
    '  Trend'.padStart(8) + '   ' +
    Array.from({ length: numSessions }, (_, i) => `S${i + 1} Sat`.padStart(7)).join('') +
    '  Trend'.padStart(8)
  );
  console.log('  ' + '─'.repeat(12 + 3 + numSessions * 8 + 8 + 3 + numSessions * 7 + 8));

  for (const r of ranked) {
    const engRates = r.sessions.map(s => s.stats.engRate);
    const sats = r.sessions.map(s => s.finalSatisfaction);
    const engT = computeTrend(engRates);
    const satT = computeTrend(sats);

    let line = '  ' + r.persona.name.padEnd(12) + '   ';
    for (const e of engRates) line += `${(e * 100).toFixed(0)}%`.padStart(8);
    line += `  ${trendArrow(engT)}`.padStart(8) + '   ';
    for (const s of sats) line += `${s}`.padStart(7);
    line += `  ${trendArrow(satT)}`.padStart(8);
    console.log(line);
  }

  // ── ADDICTION INDEX ──
  console.log(`\n${THICK}`);
  console.log('  ADDICTION INDEX — Are users getting hooked?');
  console.log(THICK);
  console.log('  Measures: session length growth, dwell depth increase, skip reduction, satisfaction climb\n');

  console.log('  ' + 'Name'.padEnd(12) + 'Addiction'.padStart(10) + 'Eng Trend'.padStart(11) + 'Dwell Trend'.padStart(13) + 'Skip Trend'.padStart(12) + 'Sat Trend'.padStart(11) + 'Sessions Longer?'.padStart(18) + '  Signal');
  console.log('  ' + '─'.repeat(100));

  let totalAddicted = 0, totalDisengaging = 0, totalStable = 0;

  for (const r of ranked) {
    const engRates = r.sessions.map(s => s.stats.engRate);
    const dwells = r.sessions.map(s => s.stats.avgDwell);
    const skipRates = r.sessions.map(s => s.stats.total > 0 ? s.stats.skipped / s.stats.total : 0);
    const sats = r.sessions.map(s => s.finalSatisfaction);
    const lengths = r.sessions.map(s => s.stats.total);

    const engT = computeTrend(engRates);
    const dwellT = computeTrend(dwells);
    const skipT = computeTrend(skipRates);
    const satT = computeTrend(sats);
    const lenT = computeTrend(lengths);

    // Addiction score: +1 for each positive signal
    let addictionScore = 0;
    if (engT.direction === 'improving') addictionScore++;
    if (dwellT.direction === 'improving') addictionScore++;
    if (skipT.direction === 'declining') addictionScore++;
    if (satT.direction === 'improving') addictionScore++;
    if (lenT.direction === 'improving') addictionScore++;

    // Negative signals
    if (engT.direction === 'declining') addictionScore--;
    if (satT.direction === 'declining') addictionScore--;
    if (skipT.direction === 'improving') addictionScore--;

    const signal = addictionScore >= 3 ? 'HOOKED' : addictionScore >= 1 ? 'WARMING UP' : addictionScore <= -2 ? 'LOSING THEM' : 'NEUTRAL';
    if (addictionScore >= 3) totalAddicted++;
    else if (addictionScore <= -2) totalDisengaging++;
    else totalStable++;

    console.log('  ' +
      r.persona.name.padEnd(12) +
      `${addictionScore}/5`.padStart(10) +
      `${trendArrow(engT)} ${engT.pctChange >= 0 ? '+' : ''}${engT.pctChange.toFixed(0)}%`.padStart(11) +
      `${trendArrow(dwellT)} ${dwellT.pctChange >= 0 ? '+' : ''}${dwellT.pctChange.toFixed(0)}%`.padStart(13) +
      `${trendArrow(skipT)} ${skipT.pctChange >= 0 ? '+' : ''}${skipT.pctChange.toFixed(0)}%`.padStart(12) +
      `${trendArrow(satT)} ${satT.pctChange >= 0 ? '+' : ''}${satT.pctChange.toFixed(0)}%`.padStart(11) +
      `${lenT.direction === 'improving' ? 'YES' : lenT.direction === 'declining' ? 'NO' : 'SAME'}`.padStart(18) +
      `  ${signal}`
    );
  }

  console.log('  ' + '─'.repeat(100));
  console.log(`  HOOKED: ${totalAddicted}/50 │ WARMING UP/NEUTRAL: ${totalStable}/50 │ LOSING THEM: ${totalDisengaging}/50`);

  // ── STANDARD SECTIONS ──

  // Dwell summary
  console.log(`\n  DWELL TIME SUMMARY:`);
  console.log('  ' + 'Name'.padEnd(12) + 'Articles'.padStart(9) + 'Total'.padStart(10) + 'Avg'.padStart(8) + 'Deep'.padStart(6) + 'Skips'.padStart(7) + 'Eng%'.padStart(7) + 'Relev%'.padStart(8) + '  Longest Read');
  console.log('  ' + '─'.repeat(110));

  for (const r of ranked) {
    const ints = r.sessions.flatMap(s => s.interactions);
    const total = ints.reduce((s, i) => s + i.dwell, 0);
    const deep = ints.filter(i => i.action === 'DEEP_READ').length;
    const skips = ints.filter(i => i.signal === 'SKIP').length;
    const eng = ints.filter(i => i.signal === 'ENGAGE').length;
    const relevant = ints.filter(i => i.matchedSubtopics.length > 0).length;
    const longest = ints.reduce((best, i) => i.dwell > best.dwell ? i : best, { dwell: 0, title: '-' });
    console.log('  ' +
      r.persona.name.padEnd(12) + String(ints.length).padStart(9) +
      formatDwell(total).padStart(10) + formatDwell(ints.length > 0 ? total / ints.length : 0).padStart(8) +
      String(deep).padStart(6) + String(skips).padStart(7) +
      (`${ints.length > 0 ? ((eng/ints.length)*100).toFixed(0) : 0}%`).padStart(7) +
      (`${ints.length > 0 ? ((relevant/ints.length)*100).toFixed(0) : 0}%`).padStart(8) +
      `  ${formatDwell(longest.dwell)} (${(longest.title || '').substring(0, 35)})`
    );
  }

  // Category breakdown
  const allInts = ranked.flatMap(r => r.sessions.flatMap(s => s.interactions));
  const totalArticles = allInts.length;
  const totalTime = allInts.reduce((s, i) => s + i.dwell, 0);

  const catStats = {};
  for (const i of allInts) {
    const cat = i.category || 'Unknown';
    if (!catStats[cat]) catStats[cat] = { count: 0, dwell: 0, engaged: 0, relevant: 0 };
    catStats[cat].count++;
    catStats[cat].dwell += i.dwell;
    if (i.signal === 'ENGAGE') catStats[cat].engaged++;
    if (i.matchedSubtopics.length > 0) catStats[cat].relevant++;
  }

  console.log('\n  CATEGORY BREAKDOWN:');
  console.log('  ' + 'Category'.padEnd(16) + 'Articles'.padStart(9) + 'Share'.padStart(7) + 'Dwell'.padStart(10) + 'Avg'.padStart(8) + 'EngRate'.padStart(8) + 'Relev%'.padStart(8));
  console.log('  ' + '─'.repeat(70));
  for (const [cat, s] of Object.entries(catStats).sort((a, b) => b[1].count - a[1].count)) {
    console.log('  ' + cat.padEnd(16) + String(s.count).padStart(9) +
      (`${((s.count/totalArticles)*100).toFixed(0)}%`).padStart(7) +
      formatDwell(s.dwell).padStart(10) + formatDwell(s.dwell / s.count).padStart(8) +
      (`${((s.engaged/s.count)*100).toFixed(0)}%`).padStart(8) +
      (`${((s.relevant/s.count)*100).toFixed(0)}%`).padStart(8)
    );
  }

  // Subtopic coverage heatmap
  console.log('\n  SUBTOPIC COVERAGE HEATMAP:');
  const allSubtopics = new Set();
  for (const r of ranked) r.persona.subtopics.forEach(s => allSubtopics.add(s));
  const stGlobalSeen = {};
  const stGlobalEngaged = {};
  for (const i of allInts) {
    for (const st of i.matchedSubtopics) {
      stGlobalSeen[st] = (stGlobalSeen[st] || 0) + 1;
      if (i.signal === 'ENGAGE') stGlobalEngaged[st] = (stGlobalEngaged[st] || 0) + 1;
    }
  }
  console.log('  ' + 'Subtopic'.padEnd(35) + 'Personas'.padStart(9) + 'Articles'.padStart(10) + 'Engaged'.padStart(9) + 'Eng Rate'.padStart(10));
  console.log('  ' + '─'.repeat(75));
  for (const st of [...allSubtopics].sort()) {
    const personasUsing = ranked.filter(r => r.persona.subtopics.includes(st)).length;
    const seen = stGlobalSeen[st] || 0;
    const eng = stGlobalEngaged[st] || 0;
    const icon = seen === 0 ? '✗' : seen >= 5 ? '✓' : '△';
    console.log('  ' + `${icon} ${st}`.padEnd(35) + String(personasUsing).padStart(9) +
      String(seen).padStart(10) + String(eng).padStart(9) +
      (`${seen > 0 ? ((eng/seen)*100).toFixed(0) : 0}%`).padStart(10)
    );
  }

  // Dwell distribution
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
    const bar = '█'.repeat(Math.max(0, Math.round(parseFloat(pct) / 2)));
    console.log(`    ${b.label.padEnd(25)} ${String(inBucket.length).padStart(5)} (${pct.padStart(3)}%) ${bar}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL VERDICT
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${THICK}`);
  console.log('  FINAL VERDICT');
  console.log(THICK);
  console.log(`  Overall Score: ${overallScore}/100`);
  console.log(`  Total articles seen: ${totalArticles} across ${numSessions} sessions × 50 personas`);
  console.log(`  Total time in app: ${formatDwell(totalTime)}`);
  console.log(`  Avg dwell: ${formatDwell(totalArticles > 0 ? totalTime / totalArticles : 0)}`);
  console.log(`  Subtopic Relevance: ${avgScores.relevance.toFixed(1)}/5 │ Coverage: ${avgScores.coverage.toFixed(1)}/5 │ Diversity: ${avgScores.diversity.toFixed(1)}/5 │ Quality: ${avgScores.quality.toFixed(1)}/5 │ Would Return: ${avgScores.wouldReturn.toFixed(1)}/5`);

  // Personalization verdict
  console.log('\n  PERSONALIZATION EFFECTIVENESS:');
  const feedLearns = engTrend.direction === 'improving' || relevTrend.direction === 'improving';
  const usersGetHooked = totalAddicted > totalDisengaging;
  const satisfactionGrows = satTrend.direction === 'improving';

  if (feedLearns && usersGetHooked && satisfactionGrows) {
    console.log('  ✅ FEED IS LEARNING: Engagement, relevance, and satisfaction all trend upward over sessions.');
    console.log('  ✅ USERS ARE GETTING HOOKED: More users show addiction signals than disengagement.');
    console.log('  → Personalization is working. The feed improves with usage.');
  } else if (feedLearns || usersGetHooked) {
    console.log('  ⚠️  MIXED SIGNALS: Some metrics improve over time, others are flat or declining.');
    if (!feedLearns) console.log('  ⚠️  Feed relevance is NOT improving across sessions — personalization may be static.');
    if (!usersGetHooked) console.log('  ⚠️  Users are NOT getting more engaged — retention risk.');
    if (!satisfactionGrows) console.log('  ⚠️  Satisfaction is NOT climbing — users may plateau or churn.');
    console.log('  → Partial personalization. Feed needs better learning signals.');
  } else {
    console.log('  ❌ FEED IS NOT LEARNING: Engagement and relevance are flat or declining over sessions.');
    console.log('  ❌ Users are disengaging: Skip rates and frustration are growing.');
    console.log('  → Personalization is not effective. Feed behaves the same regardless of user history.');
  }

  console.log(`\n  Addiction breakdown: ${totalAddicted} hooked, ${totalStable} neutral, ${totalDisengaging} losing`);
  console.log(`  Engagement trend: ${trendArrow(engTrend)} ${engTrend.pctChange >= 0 ? '+' : ''}${engTrend.pctChange.toFixed(1)}% (S1→S${numSessions})`);
  console.log(`  Relevance trend: ${trendArrow(relevTrend)} ${relevTrend.pctChange >= 0 ? '+' : ''}${relevTrend.pctChange.toFixed(1)}% (S1→S${numSessions})`);
  console.log(`  Satisfaction trend: ${trendArrow(satTrend)} ${satTrend.pctChange >= 0 ? '+' : ''}${satTrend.pctChange.toFixed(1)}% (S1→S${numSessions})`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  50-PERSONA FEED TEST V5 — Personalization Over Time Analysis                                        ║');
  console.log('║  4 sessions per persona │ Accumulated history │ Trend analysis │ Addiction tracking                   ║');
  console.log('║  Purpose: Does the feed get better as users use it? Do users get more engaged over time?             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Sessions per persona: ${SESSIONS_PER_PERSONA} | API: ${API_BASE} | Articles: last ${MAX_ARTICLE_AGE_HOURS}h\n`);

  // Phase 1: Setup
  console.log('PHASE 1: Setting up 50 test personas (clean slate)...');
  const personaSetups = [];
  for (const persona of PERSONAS) {
    process.stdout.write(`  ${persona.name} (${persona.homeCountry})...`);
    const setup = await setupPersona(persona);
    if (setup) {
      personaSetups.push({ persona, ...setup });
      console.log(` OK — ${persona.subtopics.join(', ')}`);
    } else {
      console.log(' FAILED');
    }
    await sleep(1200); // Supabase auth rate limit requires ~1s between calls
  }
  console.log(`\n  ${personaSetups.length}/${PERSONAS.length} ready.\n`);

  // Phase 2: Simulate — each session starts fresh (no client-side history carried over)
  console.log('PHASE 2: Running 4-session simulations (fresh start each session — no reading history)...\n');
  const allResults = [];

  // Run personas in batches of 5 for concurrency
  const CONCURRENCY = 5;
  for (let batch = 0; batch < personaSetups.length; batch += CONCURRENCY) {
    const batchSlice = personaSetups.slice(batch, batch + CONCURRENCY);
    console.log(`  --- Batch ${Math.floor(batch / CONCURRENCY) + 1}/${Math.ceil(personaSetups.length / CONCURRENCY)} (${batchSlice.map(p => p.persona.name).join(', ')}) ---`);

    const batchResults = await Promise.all(batchSlice.map(async ({ persona, userId, accessToken }) => {
      const profile = buildPersonaProfile(persona);
      const sessions = [];

      for (let s = 1; s <= SESSIONS_PER_PERSONA; s++) {
        const freshHistory = { engagedIds: [], skippedIds: [], seenIds: [] };
        const session = await simulateSession(persona, userId, accessToken, s, profile, freshHistory);
        sessions.push(session);
        if (s < SESSIONS_PER_PERSONA) await sleep(DELAY_BETWEEN_SESSIONS_MS);
      }

      const scores = scorePersona(persona, sessions, profile);
      return { persona, sessions, scores, profile };
    }));

    // Print results for this batch sequentially (so output doesn't interleave)
    for (const result of batchResults) {
      const { persona, sessions, scores, profile } = result;
      console.log(`  ┌── ${persona.name} (${persona.location}) ──`);
      for (const session of sessions) {
        const exitIcon = session.exitType === 'frustrated' ? '💢' : session.exitType === 'bored' ? '😴' : '✓';
        const relevPct = session.stats.relevantRate ? (session.stats.relevantRate * 100).toFixed(0) : '?';
        console.log(`  │ S${session.sessionNum}: ${exitIcon} ${session.stats.total} articles │ ${(session.stats.engRate * 100).toFixed(0)}% eng │ ${relevPct}% relev │ mood ${session.finalSatisfaction}`);
      }
      const engRates = sessions.map(s => s.stats.engRate);
      const engT = computeTrend(engRates);
      const totalSeenAll = sessions.reduce((sum, ses) => sum + ses.stats.total, 0);
      console.log(`  └── ${persona.name}: eng trend ${trendArrow(engT)} ${engT.pctChange >= 0 ? '+' : ''}${engT.pctChange.toFixed(0)}% │ total seen: ${totalSeenAll}\n`);

      printPersonaReport(persona, sessions, scores, profile);
      allResults.push({ persona, sessions, scores });
    }
  }

  // Phase 3: Grand Report + Temporal Analysis
  printGrandReport(allResults);

  // Save results
  const jsonResults = allResults.map(r => ({
    persona: r.persona.name,
    subtopics: r.persona.subtopics,
    homeCountry: r.persona.homeCountry,
    scores: r.scores,
    sessions: r.sessions.map(s => ({
      sessionNum: s.sessionNum, exitType: s.exitType, finalSatisfaction: s.finalSatisfaction,
      stats: s.stats, interactions: s.interactions,
    })),
  }));
  fs.writeFileSync('test_50persona_results_v6.json', JSON.stringify(jsonResults, null, 2));
  console.log('\nResults saved to test_50persona_results_v6.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

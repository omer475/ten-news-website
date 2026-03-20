import { createClient } from '@supabase/supabase-js';
import https from 'https';

// ============================================================================
// 20-PERSONA FULL EXPERIENCE TEST V2
// - 10 personas keep reading history, 10 start fresh
// - Check Explore page BEFORE reading feed
// - Read feed until bored (natural exit via satisfaction)
// - Track engagement over scroll position (does it improve?)
// - Check Explore page AFTER reading feed (did it improve?)
// - Scroll through explore topics, tap interesting ones
// - Each persona gives detailed feedback about the app
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const DELAY_BETWEEN_EVENTS_MS = 50;
const DELAY_BETWEEN_PAGES_MS = 250;
const STARTING_MOOD = 55;

// ============================================================================
// SUBTOPIC MAP
// ============================================================================

const SUBTOPIC_MAP = {
  'War & Conflict':              { categories: ['Politics'], tags: ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'troops', 'missile', 'strike', 'ceasefire', 'nato', 'pentagon', 'military conflict', 'military strikes'] },
  'US Politics':                 { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'supreme court', 'governor', 'election', 'legislation'] },
  'European Politics':           { categories: ['Politics'], tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'macron', 'scholz', 'starmer', 'germany', 'france', 'uk politics'] },
  'Middle East':                 { categories: ['Politics'], tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gaza', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz', 'gulf'] },
  'Human Rights & Civil Liberties': { categories: ['Politics'], tags: ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes', 'refugee', 'asylum'] },
  'NFL':                         { categories: ['Sports'], tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'nfl draft'] },
  'NBA':                         { categories: ['Sports'], tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'playoffs', 'nba draft'] },
  'Soccer/Football':             { categories: ['Sports'], tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup', 'transfer'] },
  'F1 & Motorsport':             { categories: ['Sports'], tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'] },
  'Boxing & MMA/UFC':            { categories: ['Sports'], tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout', 'wrestling'] },
  'Cricket':                     { categories: ['Sports'], tags: ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'] },
  'Oil & Energy':                { categories: ['Business'], tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'nuclear energy'] },
  'Retail & Consumer':           { categories: ['Business'], tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'Trade & Tariffs':             { categories: ['Business'], tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'] },
  'Corporate Earnings':          { categories: ['Business'], tags: ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'] },
  'Startups & Venture Capital':  { categories: ['Business', 'Finance'], tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'Real Estate':                 { categories: ['Business', 'Finance'], tags: ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'] },
  'Movies & Film':               { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars', 'academy award'] },
  'TV & Streaming':              { categories: ['Entertainment'], tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'] },
  'Music':                       { categories: ['Entertainment'], tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce', 'spotify'] },
  'Gaming':                      { categories: ['Entertainment', 'Tech'], tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam', 'game'] },
  'Celebrity News':              { categories: ['Entertainment'], tags: ['celebrity', 'famous', 'scandal', 'gossip', 'star', 'billionaire', 'royal'] },
  'AI & Machine Learning':       { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm', 'gpt', 'claude', 'anthropic', 'google ai'] },
  'Smartphones & Gadgets':       { categories: ['Tech'], tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'] },
  'Cybersecurity':               { categories: ['Tech'], tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'] },
  'Space Tech':                  { categories: ['Tech', 'Science'], tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'] },
  'Robotics & Hardware':         { categories: ['Tech'], tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor', 'gpu'] },
  'Climate & Environment':       { categories: ['Science'], tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'] },
  'Biology & Nature':            { categories: ['Science'], tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'] },
  'Medical Breakthroughs':       { categories: ['Health'], tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery', 'drug'] },
  'Public Health':               { categories: ['Health'], tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'] },
  'Mental Health':               { categories: ['Health'], tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'] },
  'Pharma & Drug Industry':      { categories: ['Health', 'Business'], tags: ['pharma', 'pharmaceutical', 'fda', 'medication', 'biotech', 'drug approval'] },
  'Stock Markets':               { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading', 'stocks'] },
  'Banking & Lending':           { categories: ['Finance'], tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'] },
  'Commodities':                 { categories: ['Finance', 'Business'], tags: ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'] },
  'Bitcoin':                     { categories: ['Finance', 'Crypto', 'Tech'], tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving', 'crypto'] },
  'DeFi & Web3':                 { categories: ['Finance', 'Crypto', 'Tech'], tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized', 'ethereum'] },
  'Sneakers & Streetwear':       { categories: ['Lifestyle'], tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'] },
  'Celebrity Style & Red Carpet': { categories: ['Lifestyle', 'Entertainment'], tags: ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'] },
  'Shopping & Product Reviews':  { categories: ['Lifestyle'], tags: ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'] },
};

// ============================================================================
// 20 PERSONAS — keepHistory: true = returning user, false = fresh start
// ============================================================================

const PERSONAS = [
  // --- 10 RETURNING USERS (keep history from previous test) ---
  {
    name: 'Lena', age: 32, location: 'San Francisco, CA',
    bio: 'AI research lead at a robotics startup. Follows OpenAI/Anthropic race closely. Plays Baldur\'s Gate 3 on weekends. Watches every SpaceX launch live.',
    email: 'persona_lena@tennews.test', homeCountry: 'usa', keepHistory: true,
    subtopics: ['AI & Machine Learning', 'Space Tech', 'Gaming', 'Robotics & Hardware'],
    personality: { patience: 0.8, curiosity: 0.7, saveRate: 0.08 },
    curiosityKeywords: ['bizarre', 'discovered', 'ancient', 'extinct', 'record-breaking', 'billion', 'breakthrough'],
    annoyanceKeywords: ['ai will replace', 'robots taking jobs', 'alarming'],
    headlineTriggers: ['first ever', 'no one expected', 'scientists shocked', 'elon musk'],
    repetitionTolerance: 3,
  },
  {
    name: 'Nadia', age: 48, location: 'Berlin, Germany',
    bio: 'International relations professor at Humboldt University. Specializes in NATO and Middle East policy. Published 3 books on post-Cold War Europe.',
    email: 'persona_nadia@tennews.test', homeCountry: 'germany', keepHistory: true,
    subtopics: ['War & Conflict', 'Middle East', 'European Politics', 'Human Rights & Civil Liberties'],
    personality: { patience: 1.0, curiosity: 0.6, saveRate: 0.12 },
    curiosityKeywords: ['regulation', 'sanctions', 'climate summit', 'nuclear', 'treaty', 'exodus', 'displaced'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'gaming'],
    headlineTriggers: ['unprecedented', 'historic', 'classified', 'leaked'],
    repetitionTolerance: 5,
  },
  {
    name: 'Ryan', age: 38, location: 'New York, NY',
    bio: 'Quant fund portfolio manager at a mid-size hedge fund. Trades S&P futures and tech stocks. Obsessed with NVIDIA, Apple, and TSMC earnings.',
    email: 'persona_ryan@tennews.test', homeCountry: 'usa', keepHistory: true,
    subtopics: ['Stock Markets', 'Corporate Earnings', 'Startups & Venture Capital', 'AI & Machine Learning'],
    personality: { patience: 0.7, curiosity: 0.5, saveRate: 0.06 },
    curiosityKeywords: ['oil price', 'fed', 'crash', 'surge', 'billion', 'ipo', 'sec', 'yankees', 'market crash'],
    annoyanceKeywords: ['wellness', 'mindfulness', 'self-care', 'horoscope'],
    headlineTriggers: ['plunges', 'surges', 'record high', 'crashes', 'bankruptcy'],
    repetitionTolerance: 3,
  },
  {
    name: 'Elif', age: 29, location: 'Istanbul, Turkey',
    bio: 'Product designer at a fintech startup. Passionate Galatasaray fan. Follows Turkish tech scene and EU-Turkey trade dynamics.',
    email: 'persona_elif@tennews.test', homeCountry: 'turkiye', keepHistory: true,
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['design', 'women in tech', 'founder', 'turkish', 'istanbul', 'lira', 'earthquake'],
    annoyanceKeywords: ['death toll unchanged', 'no new developments', 'sources say'],
    headlineTriggers: ['galatasaray', 'turkey', 'turkish', 'istanbul', 'women founder'],
    repetitionTolerance: 2,
  },
  {
    name: 'Mike', age: 58, location: 'Dallas, TX',
    bio: 'Retired Army colonel, now a military analyst on cable news. Dallas Cowboys fan for 40+ years. Follows every F1 race.',
    email: 'persona_mike@tennews.test', homeCountry: 'usa', keepHistory: true,
    subtopics: ['NFL', 'US Politics', 'War & Conflict', 'F1 & Motorsport'],
    personality: { patience: 0.7, curiosity: 0.5, saveRate: 0.05 },
    curiosityKeywords: ['military tech', 'drone', 'veteran', 'defense contractor', 'lockheed', 'boeing', 'navy', 'air force', 'texas', 'dallas'],
    annoyanceKeywords: ['influencer', 'tiktok', 'k-pop', 'fashion week'],
    headlineTriggers: ['cowboys', 'pentagon', 'troops', 'general', 'classified', 'verstappen'],
    repetitionTolerance: 4,
  },
  {
    name: 'Ayse', age: 34, location: 'Ankara, Turkey',
    bio: 'SaaS startup founder, just closed Series A. Follows AI tooling space and Turkish-EU trade relations. Besiktas fan.',
    email: 'persona_ayse@tennews.test', homeCountry: 'turkiye', keepHistory: true,
    subtopics: ['Startups & Venture Capital', 'AI & Machine Learning', 'Trade & Tariffs', 'Middle East'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['women founder', 'remote work', 'saas', 'productivity', 'turkey', 'ankara', 'besiktas', 'space'],
    annoyanceKeywords: ['death toll', 'massacre', 'graphic', 'celebrity divorce'],
    headlineTriggers: ['billion valuation', 'acquired', 'unicorn', 'besiktas', 'turkey'],
    repetitionTolerance: 2,
  },
  {
    name: 'Fatima', age: 24, location: 'Washington DC',
    bio: 'Georgetown law student focused on civil rights. Interns at the ACLU. Follows Supreme Court cases obsessively. Manchester City fan.',
    email: 'persona_fatima@tennews.test', homeCountry: 'usa', keepHistory: true,
    subtopics: ['US Politics', 'Human Rights & Civil Liberties', 'Middle East', 'Public Health'],
    personality: { patience: 0.8, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['privacy', 'surveillance', 'immigration', 'border', 'education', 'student debt', 'man city', 'haaland', 'justice'],
    annoyanceKeywords: ['earnings', 'quarterly', 'ipo', 'stock price', 'revenue'],
    headlineTriggers: ['supreme court', 'aclu', 'man city', 'haaland', 'civil rights', 'unconstitutional'],
    repetitionTolerance: 4,
  },
  {
    name: 'Lars', age: 23, location: 'Stockholm, Sweden',
    bio: 'Semi-pro Counter-Strike player. Streams on Twitch (8K followers). Follows every gaming hardware launch. Into AI art tools.',
    email: 'persona_lars@tennews.test', homeCountry: 'sweden', keepHistory: true,
    subtopics: ['Gaming', 'AI & Machine Learning', 'Smartphones & Gadgets', 'Robotics & Hardware'],
    personality: { patience: 0.4, curiosity: 0.8, saveRate: 0.03 },
    curiosityKeywords: ['sweden', 'stockholm', 'space', 'mars', 'rocket', 'nasa', 'viral', 'twitch', 'youtube', 'streamer'],
    annoyanceKeywords: ['policy', 'legislation', 'committee', 'fiscal', 'tariff', 'trade deal'],
    headlineTriggers: ['nvidia', 'steam', 'playstation', 'xbox', 'aik', 'sweden'],
    repetitionTolerance: 2,
  },
  {
    name: 'Antonio', age: 43, location: 'Barcelona, Spain',
    bio: 'Restaurant chain owner (3 tapas restaurants). Lifelong FC Barcelona soci. Camp Nou season ticket since 2005.',
    email: 'persona_antonio@tennews.test', homeCountry: 'spain', keepHistory: true,
    subtopics: ['Soccer/Football', 'Startups & Venture Capital', 'Retail & Consumer', 'Real Estate'],
    personality: { patience: 0.6, curiosity: 0.5, saveRate: 0.04 },
    curiosityKeywords: ['barcelona', 'spain', 'spanish', 'restaurant', 'food', 'tourism', 'hotel', 'oil price', 'inflation', 'cost of living'],
    annoyanceKeywords: ['algorithm', 'blockchain', 'defi', 'neural network', 'prompt engineering'],
    headlineTriggers: ['barcelona', 'barca', 'la liga', 'spain', 'lamine yamal', 'messi'],
    repetitionTolerance: 3,
  },
  {
    name: 'Henrik', age: 52, location: 'Geneva, Switzerland',
    bio: 'Former Swedish diplomat, now director at the Geneva Centre for Security Policy. Reads The Economist cover to cover.',
    email: 'persona_henrik@tennews.test', homeCountry: 'switzerland', keepHistory: true,
    subtopics: ['European Politics', 'Human Rights & Civil Liberties', 'Trade & Tariffs', 'Banking & Lending'],
    personality: { patience: 0.9, curiosity: 0.6, saveRate: 0.10 },
    curiosityKeywords: ['switzerland', 'swiss', 'sweden', 'scandinavia', 'geneva', 'diplomat', 'ambassador', 'un', 'imf', 'world bank'],
    annoyanceKeywords: ['celebrity', 'gossip', 'influencer', 'tiktok', 'sneakers', 'k-pop'],
    headlineTriggers: ['eu', 'nato', 'sanctions', 'historic', 'swiss', 'young boys'],
    repetitionTolerance: 5,
  },

  // --- 10 FRESH USERS (wipe history, start from zero) ---
  {
    name: 'Marco', age: 35, location: 'Milan, Italy',
    bio: 'Sports editor at Gazzetta dello Sport. Die-hard AC Milan fan since childhood. Watches every Serie A and Champions League match. Follows F1 and UFC.',
    email: 'persona_marco@tennews.test', homeCountry: 'italy', keepHistory: false,
    subtopics: ['Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC'],
    personality: { patience: 0.5, curiosity: 0.6, saveRate: 0.03 },
    curiosityKeywords: ['athlete', 'injury', 'salary', 'deal', 'scandal', 'record', 'fastest', 'million'],
    annoyanceKeywords: ['congress', 'legislation', 'policy', 'sanctions'],
    headlineTriggers: ['transfer', 'fired', 'champion', 'upset', 'shocking defeat'],
    repetitionTolerance: 4,
  },
  {
    name: 'Sophie', age: 27, location: 'Lyon, France',
    bio: 'Medical resident specializing in oncology. Follows biotech breakthroughs. Olympique Lyonnais season ticket holder.',
    email: 'persona_sophie@tennews.test', homeCountry: 'france', keepHistory: false,
    subtopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Biology & Nature', 'Soccer/Football'],
    personality: { patience: 0.7, curiosity: 0.6, saveRate: 0.07 },
    curiosityKeywords: ['ai in medicine', 'diagnosis', 'patient', 'hospital', 'france', 'lyon', 'restaurant', 'chef', 'humanitarian'],
    annoyanceKeywords: ['crypto', 'nft', 'meme coin', 'influencer'],
    headlineTriggers: ['cure', 'first patient', 'clinical trial', 'mbappe', 'lyon'],
    repetitionTolerance: 3,
  },
  {
    name: 'Thomas', age: 40, location: 'Amsterdam, Netherlands',
    bio: 'Climate journalist at NRC Handelsblad. Covers COP summits and EU Green Deal. Ajax fan who follows Eredivisie casually.',
    email: 'persona_thomas@tennews.test', homeCountry: 'netherlands', keepHistory: false,
    subtopics: ['Climate & Environment', 'European Politics', 'Oil & Energy'],
    personality: { patience: 0.6, curiosity: 0.7, saveRate: 0.05 },
    curiosityKeywords: ['ev', 'electric', 'solar', 'wind', 'battery', 'pollution', 'ocean', 'flooding', 'amsterdam', 'dutch', 'netherlands'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'celebrity', 'kardashian'],
    headlineTriggers: ['record temperature', 'flooding', 'wildfire', 'ajax', 'netherlands'],
    repetitionTolerance: 3,
  },
  {
    name: 'Zara', age: 20, location: 'London, UK',
    bio: 'UCL sociology student and TikTok creator (45K followers). Into sustainable fashion and mental health advocacy. Arsenal fan through her dad.',
    email: 'persona_zara@tennews.test', homeCountry: 'uk', keepHistory: false,
    subtopics: ['Climate & Environment', 'Mental Health', 'Soccer/Football', 'Celebrity Style & Red Carpet'],
    personality: { patience: 0.4, curiosity: 0.8, saveRate: 0.04 },
    curiosityKeywords: ['london', 'uk', 'student', 'gen z', 'tiktok', 'viral', 'animal', 'rescue', 'billionaire', 'protest', 'affordable'],
    annoyanceKeywords: ['quarterly results', 'earnings', 'commodity', 'tariff', 'fed rate'],
    headlineTriggers: ['arsenal', 'saka', 'london', 'shocking', 'viral', 'gen z'],
    repetitionTolerance: 2,
  },
  {
    name: 'Robert', age: 68, location: 'Tampa, FL',
    bio: 'Retired school principal. Tampa Bay Buccaneers and Rays fan. Follows gold prices — has physical gold in a safe.',
    email: 'persona_robert@tennews.test', homeCountry: 'usa', keepHistory: false,
    subtopics: ['US Politics', 'Public Health', 'Commodities', 'NFL'],
    personality: { patience: 0.9, curiosity: 0.4, saveRate: 0.06 },
    curiosityKeywords: ['hurricane', 'florida', 'tampa', 'education', 'school', 'teacher', 'veteran', 'retirement', 'social security', 'weather'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'nft', 'metaverse', 'k-pop'],
    headlineTriggers: ['florida', 'tampa', 'buccaneers', 'gold price', 'social security'],
    repetitionTolerance: 6,
  },
  {
    name: 'Devon', age: 21, location: 'Austin, TX',
    bio: 'UT Austin senior, huge sports fan. Lives for the NFL Draft and NBA playoffs. Philadelphia Eagles fan. Plays Call of Duty competitively.',
    email: 'persona_devon@tennews.test', homeCountry: 'usa', keepHistory: false,
    subtopics: ['NFL', 'NBA', 'Boxing & MMA/UFC', 'Gaming', 'Sneakers & Streetwear'],
    personality: { patience: 0.3, curiosity: 0.8, saveRate: 0.02 },
    curiosityKeywords: ['viral', 'insane', 'crazy', 'elon', 'tesla', 'million dollar', 'world record', 'arrest'],
    annoyanceKeywords: ['policy', 'regulation', 'committee', 'quarterly', 'fiscal', 'summit'],
    headlineTriggers: ['eagles', 'mavericks', 'luka', 'ufc', 'jordan', 'nike', 'world record'],
    repetitionTolerance: 2,
  },
  {
    name: 'Camille', age: 33, location: 'Paris, France',
    bio: 'Creative director at Balenciaga. Lives for fashion week and red carpet moments. Watches every A24 film on release. PSG fan.',
    email: 'persona_camille@tennews.test', homeCountry: 'france', keepHistory: false,
    subtopics: ['Celebrity Style & Red Carpet', 'Movies & Film', 'Shopping & Product Reviews', 'Soccer/Football'],
    personality: { patience: 0.5, curiosity: 0.7, saveRate: 0.06 },
    curiosityKeywords: ['luxury', 'lvmh', 'kering', 'gucci', 'paris', 'france', 'design', 'architecture', 'museum', 'art', 'creative ai'],
    annoyanceKeywords: ['missile', 'troops', 'death toll', 'bitcoin', 'mining'],
    headlineTriggers: ['paris', 'psg', 'fashion', 'cannes', 'balenciaga', 'french'],
    repetitionTolerance: 3,
  },
  {
    name: 'Diego', age: 26, location: 'Miami, FL',
    bio: 'Crypto analyst at a DeFi fund. On-chain detective. Tracks whale wallets and protocol TVL daily. Real Madrid fan.',
    email: 'persona_diego@tennews.test', homeCountry: 'usa', keepHistory: false,
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Stock Markets', 'Cybersecurity'],
    personality: { patience: 0.5, curiosity: 0.6, saveRate: 0.04 },
    curiosityKeywords: ['real madrid', 'champions league', 'miami', 'latin america', 'ai trading', 'algorithm', 'whale', 'vinicius'],
    annoyanceKeywords: ['wellness', 'meditation', 'yoga', 'recipe', 'garden'],
    headlineTriggers: ['real madrid', 'sec', 'hack', 'exploit', 'crash', 'billion'],
    repetitionTolerance: 3,
  },
  {
    name: 'Jennifer', age: 39, location: 'Toronto, Canada',
    bio: 'High school science teacher and mom of two. Toronto Raptors fan. Follows climate science and nature documentaries.',
    email: 'persona_jennifer@tennews.test', homeCountry: 'canada', keepHistory: false,
    subtopics: ['Public Health', 'Climate & Environment', 'Biology & Nature', 'NBA'],
    personality: { patience: 0.7, curiosity: 0.6, saveRate: 0.05 },
    curiosityKeywords: ['canada', 'toronto', 'education', 'school', 'parent', 'children', 'iphone', 'apple', 'kid safety', 'food safety'],
    annoyanceKeywords: ['crypto', 'defi', 'blockchain', 'hedge fund', 'derivatives'],
    headlineTriggers: ['raptors', 'toronto', 'canada', 'teacher', 'parent', 'apple'],
    repetitionTolerance: 3,
  },
  {
    name: 'Amara', age: 34, location: 'Montreal, Canada',
    bio: 'ER nurse at McGill University Health Centre. Reads medical journals on break. Montreal Canadiens fan. Follows pharma industry.',
    email: 'persona_amara@tennews.test', homeCountry: 'canada', keepHistory: false,
    subtopics: ['Medical Breakthroughs', 'Biology & Nature', 'Mental Health', 'Pharma & Drug Industry'],
    personality: { patience: 0.7, curiosity: 0.5, saveRate: 0.06 },
    curiosityKeywords: ['canada', 'montreal', 'nurse', 'hospital', 'humanitarian', 'civilian', 'children killed', 'famine', 'ai diagnosis'],
    annoyanceKeywords: ['crypto', 'bitcoin', 'nft', 'stock market', 'earnings call'],
    headlineTriggers: ['canadiens', 'montreal', 'nurse', 'hospital', 'patient', 'first cure'],
    repetitionTolerance: 3,
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
    if (keywords.some(kw => combined.includes(kw)) || SUBTOPIC_MAP[name].categories.includes(category)) matched.push(name);
  }
  return matched;
}

// ============================================================================
// BEHAVIOR ENGINE — realistic human reading
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

  // Keyword hits
  let kwHits = 0;
  for (const kw of profile.allTags) { if (combined.includes(kw)) kwHits++; }
  score += Math.min(0.3, kwHits * 0.05);

  // Category match
  if (profile.allCategories.includes(category)) score += 0.15;

  // No match penalty
  if (matchedSubtopics.length === 0 && !profile.allCategories.includes(category)) score -= 0.2;

  // Curiosity (off-topic)
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

  // Story repetition
  const titleWords = title.split(/\s+/).filter(w => w.length > 3);
  for (let i = 0; i < titleWords.length - 1; i++) {
    const key = titleWords.slice(i, i + 2).join(' ');
    const seen = ctx.storyTracker[key] || 0;
    if (seen >= (persona.repetitionTolerance || 3)) score -= 0.15;
  }

  // Quality boost
  const aiScore = article.ai_final_score || article.aiScore || 0;
  if (aiScore >= 900) score += 0.1;
  else if (aiScore >= 800) score += 0.05;

  // Breaking
  if (/breaking|just in|exclusive/i.test(title)) score += 0.08;

  // Fatigue (scroll depth)
  const idx = ctx.articleIndex;
  if (idx > 10) score -= 0.03;
  if (idx > 20) score -= 0.05;
  if (idx > 30) score -= 0.08;
  if (idx > 40) score -= 0.1;

  // Mood
  if (ctx.mood < 35) score -= 0.08;
  if (ctx.mood < 20) score -= 0.15;

  // Category fatigue
  const catCount = ctx.categorySeen[category] || 0;
  if (catCount >= 6 && matchedSubtopics.length === 0) score -= 0.08;
  if (catCount >= 10) score -= 0.1;

  // Momentum
  if (ctx.lastMatchedSubtopics.length > 0 && matchedSubtopics.some(s => ctx.lastMatchedSubtopics.includes(s))) score += 0.1;

  // Consecutive skip streak
  if (ctx.consecutiveSkips >= 3) score -= 0.05;
  if (ctx.consecutiveSkips >= 5) score -= 0.08;

  // Random variance
  score += (Math.random() - 0.5) * 0.15;

  const patience = persona.personality.patience;

  if (score >= 0.6) {
    const dwell = (10 + Math.random() * 20) * patience;
    const save = Math.random() < persona.personality.saveRate * 1.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (save) events.push('article_saved');
    return { action: 'DEEP_READ', dwell, events, signal: 'ENGAGE', save, matchedSubtopics, score, moodDelta: save ? 7 : 5 };
  }
  if (score >= 0.3) {
    const dwell = (4 + Math.random() * 10) * patience;
    const save = Math.random() < persona.personality.saveRate * 0.5;
    const events = ['article_detail_view', 'article_engaged'];
    if (save) events.push('article_saved');
    return { action: 'ENGAGE', dwell, events, signal: 'ENGAGE', save, matchedSubtopics, score, moodDelta: 3 };
  }
  if (score >= 0.05) {
    const dwell = (2 + Math.random() * 3.5) * patience;
    return { action: 'GLANCE', dwell, events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', save: false, matchedSubtopics, score, moodDelta: -1 };
  }
  if (score >= -0.1) {
    return { action: 'SCAN', dwell: 1 + Math.random() * 2, events: ['article_view'], signal: 'NEUTRAL', save: false, matchedSubtopics, score, moodDelta: -2.5 };
  }
  const penalty = matchedSubtopics.length === 0 ? -4 : -2;
  return { action: 'SKIP', dwell: 0.3 + Math.random() * 0.7, events: ['article_skipped'], signal: 'SKIP', save: false, matchedSubtopics, score, moodDelta: penalty };
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
      hostname: u.hostname, port: 443, path: u.pathname + (u.search || ''), method: 'POST',
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
// SETUP
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

  if (!persona.keepHistory) {
    // FRESH: wipe everything
    const profileData = {
      email: persona.email, full_name: `${persona.name} (Test Persona)`,
      home_country: persona.homeCountry, followed_countries: [],
      followed_topics: persona.subtopics, onboarding_completed: true,
      taste_vector: null, taste_vector_minilm: null,
      tag_profile: {}, skip_profile: {}, similarity_floor: 0,
    };
    const { data: ep } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (ep) await adminDb.from('profiles').update(profileData).eq('id', userId);
    else await adminDb.from('profiles').insert({ id: userId, ...profileData });
    await adminDb.from('user_article_events').delete().eq('user_id', userId);
    try { await adminDb.from('user_interests').delete().eq('user_id', userId); } catch {}
  }
  // RETURNING: keep existing profile, just log in

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
// EXPLORE PAGE INTERACTION — persona scrolls & taps interesting topics
// ============================================================================

async function interactWithExplorePage(persona, userId, accessToken, exploreTopics, profile) {
  const sessionId = `explore_${persona.name.toLowerCase()}_${Date.now()}`;
  let taps = 0;
  for (const topic of exploreTopics) {
    const entity = (topic.entity_name || '').toLowerCase();
    const display = (topic.display_title || entity).toLowerCase();
    const combined = `${entity} ${display}`;

    // Would this persona tap this topic?
    let interest = 0;
    for (const kw of profile.allTags) { if (combined.includes(kw)) interest++; }
    if (persona.curiosityKeywords) {
      for (const kw of persona.curiosityKeywords) { if (combined.includes(kw)) interest++; }
    }
    if (persona.headlineTriggers) {
      for (const kw of persona.headlineTriggers) { if (combined.includes(kw)) interest++; }
    }

    // Dwell on each topic card (scrolling past)
    const dwellSeconds = interest >= 2 ? 3 + Math.random() * 5 : interest === 1 ? 1.5 + Math.random() * 2 : 0.5 + Math.random() * 1;

    try {
      await trackEvent(accessToken, {
        event_type: 'explore_topic_dwell', session_id: sessionId,
        metadata: { entity_name: topic.entity_name, dwell_seconds: dwellSeconds.toFixed(1) },
      });
    } catch {}
    await sleep(30);

    // Tap if interesting
    if (interest >= 2 || (interest === 1 && Math.random() < 0.4)) {
      try {
        await trackEvent(accessToken, {
          event_type: 'explore_topic_tap', session_id: sessionId,
          metadata: { entity_name: topic.entity_name },
        });
      } catch {}
      taps++;

      // Maybe tap an article within
      if ((topic.articles || []).length > 0 && Math.random() < 0.5) {
        const art = topic.articles[Math.floor(Math.random() * topic.articles.length)];
        try {
          await trackEvent(accessToken, {
            event_type: 'explore_article_tap', article_id: art.id, session_id: sessionId,
            metadata: { entity_name: topic.entity_name },
          });
        } catch {}
      }
      await sleep(30);
    }
  }
  return taps;
}

// ============================================================================
// FEED READING — read until bored, track engagement per scroll window
// ============================================================================

async function readFeedUntilBored(persona, userId, accessToken, profile) {
  const sessionId = `feed_${persona.name.toLowerCase()}_${Date.now()}`;
  const engagedIds = [], skippedIds = [], seenIds = [], interactions = [];
  let cursor = null, totalTracked = 0, pageNum = 0;
  const maxPages = 30;

  const ctx = {
    articleIndex: 0, consecutiveSkips: 0, lastMatchedSubtopics: [],
    mood: STARTING_MOOD, engagedCount: 0, savedCount: 0,
    categorySeen: {}, storyTracker: {},
  };

  // Engagement per scroll window (groups of 10)
  const scrollWindows = [];
  let windowInteractions = [];

  let exitType = 'natural';

  while (pageNum < maxPages) {
    pageNum++;
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.next_cursor || resp.nextCursor;

    const cutoff = Date.now() - 24 * 3600000;
    const freshArticles = resp.articles.filter(a => {
      const created = new Date(a.created_at || a.createdAt || 0).getTime();
      return created >= cutoff;
    });
    if (freshArticles.length === 0) break;

    for (const article of freshArticles) {
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

      // Send events
      for (const eventType of reaction.events) {
        const eventData = {
          event_type: eventType, article_id: parseInt(id), session_id: sessionId,
          category: category || null, source: article.source || null, metadata: {},
        };
        if (eventType === 'article_engaged') eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)), engaged_seconds: Math.round(reaction.dwell), total_active_seconds: Math.round(reaction.dwell) };
        else if (eventType === 'article_exit') eventData.metadata = { total_active_seconds: Math.round(reaction.dwell) };
        else if (eventType === 'article_detail_view') eventData.metadata = { dwell: String(reaction.dwell.toFixed(1)) };
        try { await trackEvent(accessToken, eventData); totalTracked++; } catch {}
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

      // Boredom exit
      if (ctx.mood <= 18 && interactions.length >= 6) { exitType = 'frustrated'; break; }
      if (ctx.mood <= 30 && ctx.consecutiveSkips >= 4 && interactions.length >= 5) { exitType = 'bored'; break; }
      if (ctx.mood <= 38 && ctx.consecutiveSkips >= 6) { exitType = 'bored'; break; }
      if (ctx.mood <= 35 && interactions.length >= 12 && ctx.engagedCount < interactions.length * 0.2) { exitType = 'disengaged'; break; }
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

  return { interactions, scrollWindows, exitType, finalMood: Math.round(ctx.mood), engagedCount: ctx.engagedCount, savedCount: ctx.savedCount, totalTracked };
}

// ============================================================================
// PERSONA FEEDBACK — generate natural human-like review
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

  const ebScore = exploreBefore.relevanceScore;
  const eaScore = exploreAfter.relevanceScore;
  const exploreImproved = eaScore > ebScore + 5;
  const exploreDeclined = eaScore < ebScore - 5;

  // Overall satisfaction (1-10)
  let overallRating;
  if (engRate >= 0.5 && mood >= 55) overallRating = Math.min(10, 7 + Math.floor(engRate * 4));
  else if (engRate >= 0.3 && mood >= 40) overallRating = 5 + Math.floor(engRate * 3);
  else if (engRate >= 0.15 && mood >= 25) overallRating = 3 + Math.floor(engRate * 4);
  else overallRating = Math.max(1, Math.floor(engRate * 10 + mood / 30));

  // Best feature
  const bestFeatures = [];
  if (relRate >= 0.5) bestFeatures.push('Article relevance to my interests');
  if (engRate >= 0.4) bestFeatures.push('Quality of content matches');
  if (feedResult.savedCount >= 2) bestFeatures.push('Save/bookmark feature');
  if (eaScore >= 40) bestFeatures.push('Explore page topic discovery');
  if (exploreImproved) bestFeatures.push('Personalization gets better as I use it');
  if (feedResult.scrollWindows.length >= 3 && feedResult.scrollWindows[feedResult.scrollWindows.length - 1].engRate > feedResult.scrollWindows[0].engRate) {
    bestFeatures.push('Feed gets more relevant as I scroll');
  }
  if (bestFeatures.length === 0) bestFeatures.push('Clean UI and fast loading');

  // Complaints
  const complaints = [];
  if (relRate < 0.3) complaints.push('Too many articles I don\'t care about');
  if (exit === 'frustrated') complaints.push('I got frustrated and left — content wasn\'t matching my interests');
  if (exit === 'bored') complaints.push('Got bored — same types of articles kept appearing');
  if (ebScore < 20) complaints.push('Explore page showed topics I have zero interest in');
  if (eaScore < 20 && ebScore < 20) complaints.push('Explore page didn\'t improve even after I read articles');
  if (exploreBefore.annoyingCount > 0) complaints.push('Explore suggested topics I actively dislike');

  // Would recommend?
  let wouldRecommend;
  if (overallRating >= 8) wouldRecommend = 'Definitely — this app gets me';
  else if (overallRating >= 6) wouldRecommend = 'Yes, with caveats — needs some improvements';
  else if (overallRating >= 4) wouldRecommend = 'Maybe — it\'s hit or miss for my interests';
  else wouldRecommend = 'Not yet — needs significant improvement for my use case';

  // Specific quote based on persona character
  let personalQuote;
  if (engRate >= 0.5 && mood >= 50) {
    personalQuote = `As a ${persona.bio.split('.')[0].toLowerCase()}, I found plenty of content that matters to me. I'd come back.`;
  } else if (relRate >= 0.4 && engRate < 0.3) {
    personalQuote = `The articles are kind of relevant but not deep enough for what I actually follow. I need more specific ${persona.subtopics[0]} content.`;
  } else if (exit === 'frustrated') {
    personalQuote = `I'm into ${persona.subtopics.slice(0, 2).join(' and ')} but kept seeing stuff I don't care about. I'd try a different app.`;
  } else if (exit === 'bored') {
    personalQuote = `Started okay but got repetitive fast. I need more variety within ${persona.subtopics[0]}.`;
  } else {
    personalQuote = `It's okay but I wish it understood that I follow ${persona.subtopics.slice(0, 2).join(' and ')}, not generic news.`;
  }

  // Feature request
  const featureRequests = [];
  if (relRate < 0.4) featureRequests.push('Better topic matching — I want to see MY interests, not generic news');
  if (ebScore < 30) featureRequests.push('Explore page needs to actually reflect what I follow');
  if (feedResult.scrollWindows.length >= 3 && feedResult.scrollWindows[feedResult.scrollWindows.length - 1].engRate <= feedResult.scrollWindows[0].engRate) {
    featureRequests.push('Feed should learn from what I skip and stop showing similar content');
  }
  if (persona.subtopics.some(st => ['Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'NFL', 'NBA', 'Cricket'].includes(st))) {
    featureRequests.push('Live scores or match alerts integrated into the feed');
  }
  if (persona.subtopics.some(st => ['Stock Markets', 'Bitcoin', 'DeFi & Web3', 'Commodities'].includes(st))) {
    featureRequests.push('Real-time price tickers alongside relevant articles');
  }
  if (featureRequests.length === 0) featureRequests.push('More granular topic control in settings');

  return {
    overallRating, bestFeature: bestFeatures[0], allBestFeatures: bestFeatures,
    topComplaint: complaints[0] || 'Nothing major', allComplaints: complaints,
    wouldRecommend, personalQuote, featureRequests,
    feedSatisfaction: mood >= 50 ? 'Satisfied' : mood >= 30 ? 'Neutral' : 'Unsatisfied',
    exploreVerdict: eaScore >= 40 ? 'Good' : eaScore >= 20 ? 'Mediocre' : 'Poor',
    exploreImproved: exploreImproved ? 'Yes' : exploreDeclined ? 'Declined' : 'Same',
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const T = '='.repeat(110);
  console.log(T);
  console.log('  20-PERSONA FULL EXPERIENCE TEST V2');
  console.log('  10 returning users (with history) + 10 fresh users (zero history)');
  console.log('  Phase 1: Check Explore BEFORE  |  Phase 2: Read feed until bored');
  console.log('  Phase 3: Check Explore AFTER   |  Phase 4: Persona feedback');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(T);

  const allResults = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const profile = buildPersonaProfile(persona);
    const historyLabel = persona.keepHistory ? 'RETURNING' : 'FRESH';

    console.log(`\n${'─'.repeat(110)}`);
    console.log(`  [${i + 1}/20] ${persona.name.toUpperCase()}, ${persona.age} — ${persona.location} [${historyLabel}]`);
    console.log(`  ${persona.bio}`);
    console.log(`  Subtopics: ${persona.subtopics.join(', ')}`);
    console.log('─'.repeat(110));

    // Setup
    console.log(`    Setting up (${persona.keepHistory ? 'keeping history' : 'wiping history'})...`);
    const setup = await setupPersona(persona);
    if (!setup) { console.log('    FAILED — skipping'); continue; }
    const { userId, accessToken } = setup;

    // ── PHASE 1: Explore BEFORE ──
    console.log(`    Phase 1: Checking explore page BEFORE reading...`);
    let exploreBeforeRaw;
    try { exploreBeforeRaw = await fetchExplorePage(userId); } catch (e) { exploreBeforeRaw = { topics: [] }; }
    const exploreBeforeTopics = exploreBeforeRaw.topics || [];
    const exploreBefore = evaluateExplorePage(persona, exploreBeforeTopics, profile);
    exploreBefore.mode = exploreBeforeRaw.mode || 'unknown';
    console.log(`    Explore BEFORE: ${exploreBefore.totalTopics} topics | ${exploreBefore.relevantCount} relevant | ${exploreBefore.relevanceScore.toFixed(1)}% overall | ${exploreBefore.personalizedRelevance.toFixed(1)}% personalized | mode: ${exploreBefore.mode}`);

    // Interact with explore (scroll + tap interesting)
    const tapsBefore = await interactWithExplorePage(persona, userId, accessToken, exploreBeforeTopics, profile);
    console.log(`    Tapped ${tapsBefore} explore topics`);

    // ── PHASE 2: Read feed until bored ──
    console.log(`    Phase 2: Reading feed until bored...`);
    const feedResult = await readFeedUntilBored(persona, userId, accessToken, profile);
    const ints = feedResult.interactions;
    const engaged = ints.filter(i => i.signal === 'ENGAGE').length;
    const skipped = ints.filter(i => i.signal === 'SKIP').length;
    const glanced = ints.filter(i => i.action === 'GLANCE').length;
    const relevant = ints.filter(i => i.matchedSubtopics.length > 0).length;
    const exitIcon = feedResult.exitType === 'frustrated' ? 'FRUSTRATED' : feedResult.exitType === 'bored' ? 'BORED' : feedResult.exitType === 'disengaged' ? 'DISENGAGED' : 'NATURAL';
    console.log(`    Read ${ints.length} articles | Engaged: ${engaged} | Glanced: ${glanced} | Skipped: ${skipped} | Relevant: ${relevant}`);
    console.log(`    Exit: ${exitIcon} | Final mood: ${feedResult.finalMood}/100 | Saved: ${feedResult.savedCount} | Events: ${feedResult.totalTracked}`);

    // Scroll windows
    if (feedResult.scrollWindows.length > 0) {
      console.log(`\n    ENGAGEMENT OVER SCROLL DEPTH:`);
      console.log(`    ${'Window'.padEnd(10)} ${'Articles'.padStart(10)} ${'Eng%'.padStart(8)} ${'Relev%'.padStart(8)} ${'AvgDwell'.padStart(10)} ${'Mood'.padStart(6)} ${'Trend'.padStart(8)}`);
      console.log(`    ${'─'.repeat(65)}`);
      for (let w = 0; w < feedResult.scrollWindows.length; w++) {
        const sw = feedResult.scrollWindows[w];
        let trend = '—';
        if (w > 0) {
          const prev = feedResult.scrollWindows[w - 1];
          if (sw.engRate > prev.engRate + 0.05) trend = 'UP';
          else if (sw.engRate < prev.engRate - 0.05) trend = 'DOWN';
          else trend = 'FLAT';
        }
        console.log(`    ${(`#${sw.windowNum} (${sw.start}-${sw.end})`).padEnd(16)} ${String(sw.total).padStart(4)} ${(sw.engRate * 100).toFixed(0).padStart(7)}% ${(sw.relevRate * 100).toFixed(0).padStart(7)}% ${sw.avgDwell.toFixed(1).padStart(9)}s ${String(sw.endMood).padStart(6)} ${trend.padStart(8)}`);
      }
    }

    // Wait for backend processing
    console.log(`    Waiting 4s for backend profile processing...`);
    await sleep(4000);

    // ── PHASE 3: Explore AFTER ──
    console.log(`    Phase 3: Checking explore page AFTER reading...`);
    let exploreAfterRaw;
    try { exploreAfterRaw = await fetchExplorePage(userId); } catch (e) { exploreAfterRaw = { topics: [] }; }
    const exploreAfterTopics = exploreAfterRaw.topics || [];
    const exploreAfter = evaluateExplorePage(persona, exploreAfterTopics, profile);
    exploreAfter.mode = exploreAfterRaw.mode || 'unknown';
    console.log(`    Explore AFTER:  ${exploreAfter.totalTopics} topics | ${exploreAfter.relevantCount} relevant | ${exploreAfter.relevanceScore.toFixed(1)}% overall | ${exploreAfter.personalizedRelevance.toFixed(1)}% personalized | mode: ${exploreAfter.mode}`);

    const tapAfter = await interactWithExplorePage(persona, userId, accessToken, exploreAfterTopics, profile);
    console.log(`    Tapped ${tapAfter} explore topics`);

    // Explore comparison
    const expDelta = exploreAfter.relevanceScore - exploreBefore.relevanceScore;
    const expArrow = expDelta > 5 ? 'IMPROVED' : expDelta < -5 ? 'DECLINED' : 'UNCHANGED';
    console.log(`    Explore change: ${exploreBefore.relevanceScore.toFixed(1)}% -> ${exploreAfter.relevanceScore.toFixed(1)}% (${expDelta >= 0 ? '+' : ''}${expDelta.toFixed(1)}%) ${expArrow}`);

    // Show explore topics AFTER (detailed)
    if (exploreAfter.topics.length > 0) {
      console.log(`\n    EXPLORE TOPICS (AFTER):`);
      console.log(`    ${'Type'.padEnd(14)} ${'Match'.padEnd(10)} ${'Category'.padEnd(16)} ${'Topic'.padEnd(38)} Articles  Reason`);
      console.log(`    ${'─'.repeat(100)}`);
      for (const t of exploreAfter.topics) {
        const icon = t.isAnnoying ? 'BAD' : t.isRelevant ? 'YES' : 'NO';
        const typeStr = t.type === 'personalized' ? 'Personal' : 'Trending';
        console.log(`    ${typeStr.padEnd(14)} ${icon.padEnd(10)} ${(t.category || '-').padEnd(16)} ${(t.display || t.entity).substring(0, 36).padEnd(38)} ${String(t.articleCount).padStart(5)}    ${t.matchReason.substring(0, 40)}`);
      }
    }

    // ── PHASE 4: Feedback ──
    const feedback = generateFeedback(persona, feedResult, exploreBefore, exploreAfter);

    console.log(`\n    PERSONA FEEDBACK:`);
    console.log(`    Overall rating: ${feedback.overallRating}/10 | ${feedback.feedSatisfaction}`);
    console.log(`    Best feature: ${feedback.bestFeature}`);
    console.log(`    Top complaint: ${feedback.topComplaint}`);
    console.log(`    Would recommend: ${feedback.wouldRecommend}`);
    console.log(`    Explore verdict: ${feedback.exploreVerdict} (${feedback.exploreImproved})`);
    console.log(`    Quote: "${feedback.personalQuote}"`);
    console.log(`    Feature request: ${feedback.featureRequests[0]}`);

    allResults.push({
      persona, profile, userId, feedResult, exploreBefore, exploreAfter, feedback,
      historyType: persona.keepHistory ? 'returning' : 'fresh',
    });
  }

  // ============================================================================
  // GRAND REPORTS
  // ============================================================================

  console.log(`\n\n${'='.repeat(130)}`);
  console.log('  GRAND REPORT — 20-PERSONA FULL EXPERIENCE TEST V2');
  console.log('='.repeat(130));

  // ── TABLE 1: Feed Performance ──
  console.log('\n  TABLE 1: FEED READING PERFORMANCE');
  console.log(`  ${'#'.padEnd(4)} ${'Name'.padEnd(12)} ${'Type'.padEnd(10)} ${'Articles'.padStart(9)} ${'Engaged'.padStart(9)} ${'Glanced'.padStart(9)} ${'Skipped'.padStart(9)} ${'Relevant'.padStart(10)} ${'Eng%'.padStart(7)} ${'Rel%'.padStart(7)} ${'Saved'.padStart(7)} ${'Exit'.padStart(13)} ${'Mood'.padStart(6)}`);
  console.log(`  ${'─'.repeat(125)}`);

  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    const ints = r.feedResult.interactions;
    const eng = ints.filter(x => x.signal === 'ENGAGE').length;
    const gl = ints.filter(x => x.action === 'GLANCE').length;
    const sk = ints.filter(x => x.signal === 'SKIP').length;
    const rel = ints.filter(x => x.matchedSubtopics.length > 0).length;
    const engRate = ints.length > 0 ? ((eng / ints.length) * 100).toFixed(1) : '0.0';
    const relRate = ints.length > 0 ? ((rel / ints.length) * 100).toFixed(1) : '0.0';

    console.log(`  ${(i+1+'.').padEnd(4)} ${r.persona.name.padEnd(12)} ${r.historyType.padEnd(10)} ${String(ints.length).padStart(9)} ${String(eng).padStart(9)} ${String(gl).padStart(9)} ${String(sk).padStart(9)} ${String(rel).padStart(10)} ${(engRate+'%').padStart(7)} ${(relRate+'%').padStart(7)} ${String(r.feedResult.savedCount).padStart(7)} ${r.feedResult.exitType.padStart(13)} ${String(r.feedResult.finalMood).padStart(6)}`);
  }

  // ── TABLE 2: Engagement Over Scroll Depth (Aggregated) ──
  console.log('\n  TABLE 2: ENGAGEMENT OVER SCROLL DEPTH (averaged across all personas)');
  const maxWindows = Math.max(...allResults.map(r => r.feedResult.scrollWindows.length));
  console.log(`  ${'Window'.padEnd(10)} ${'Personas'.padStart(10)} ${'Avg Eng%'.padStart(10)} ${'Avg Rel%'.padStart(10)} ${'Avg Dwell'.padStart(10)} ${'Avg Mood'.padStart(10)} ${'Trend'.padStart(8)}`);
  console.log(`  ${'─'.repeat(65)}`);

  for (let w = 0; w < maxWindows; w++) {
    const windowData = allResults.filter(r => r.feedResult.scrollWindows[w]).map(r => r.feedResult.scrollWindows[w]);
    if (windowData.length === 0) continue;
    const avgEng = windowData.reduce((s, d) => s + d.engRate, 0) / windowData.length;
    const avgRel = windowData.reduce((s, d) => s + d.relevRate, 0) / windowData.length;
    const avgDwell = windowData.reduce((s, d) => s + d.avgDwell, 0) / windowData.length;
    const avgMood = windowData.reduce((s, d) => s + d.endMood, 0) / windowData.length;
    let trend = '—';
    if (w > 0) {
      const prevData = allResults.filter(r => r.feedResult.scrollWindows[w - 1]).map(r => r.feedResult.scrollWindows[w - 1]);
      const prevEng = prevData.reduce((s, d) => s + d.engRate, 0) / prevData.length;
      if (avgEng > prevEng + 0.03) trend = 'UP';
      else if (avgEng < prevEng - 0.03) trend = 'DOWN';
      else trend = 'FLAT';
    }
    console.log(`  ${(`#${w + 1}`).padEnd(10)} ${String(windowData.length).padStart(10)} ${(avgEng * 100).toFixed(1).padStart(9)}% ${(avgRel * 100).toFixed(1).padStart(9)}% ${avgDwell.toFixed(1).padStart(9)}s ${avgMood.toFixed(0).padStart(10)} ${trend.padStart(8)}`);
  }

  // ── TABLE 3: Explore Before vs After ──
  console.log('\n  TABLE 3: EXPLORE PAGE — BEFORE vs AFTER');
  console.log(`  ${'Name'.padEnd(12)} ${'Type'.padEnd(10)} ${'B:Total'.padStart(8)} ${'B:Relev'.padStart(8)} ${'B:%'.padStart(7)} ${'B:Mode'.padStart(12)} ${'A:Total'.padStart(8)} ${'A:Relev'.padStart(8)} ${'A:%'.padStart(7)} ${'A:Mode'.padStart(12)} ${'Delta'.padStart(8)} ${'Verdict'.padStart(10)}`);
  console.log(`  ${'─'.repeat(118)}`);

  for (const r of allResults) {
    const b = r.exploreBefore, a = r.exploreAfter;
    const delta = a.relevanceScore - b.relevanceScore;
    const verdict = delta > 5 ? 'IMPROVED' : delta < -5 ? 'DECLINED' : 'SAME';
    console.log(`  ${r.persona.name.padEnd(12)} ${r.historyType.padEnd(10)} ${String(b.totalTopics).padStart(8)} ${String(b.relevantCount).padStart(8)} ${(b.relevanceScore.toFixed(0)+'%').padStart(7)} ${b.mode.padStart(12)} ${String(a.totalTopics).padStart(8)} ${String(a.relevantCount).padStart(8)} ${(a.relevanceScore.toFixed(0)+'%').padStart(7)} ${a.mode.padStart(12)} ${((delta>=0?'+':'')+delta.toFixed(0)+'%').padStart(8)} ${verdict.padStart(10)}`);
  }

  // ── TABLE 4: Returning vs Fresh Comparison ──
  console.log('\n  TABLE 4: RETURNING vs FRESH USER COMPARISON');
  const returning = allResults.filter(r => r.historyType === 'returning');
  const fresh = allResults.filter(r => r.historyType === 'fresh');

  function groupStats(group) {
    const totalInts = group.reduce((s, r) => s + r.feedResult.interactions.length, 0);
    const totalEng = group.reduce((s, r) => s + r.feedResult.interactions.filter(i => i.signal === 'ENGAGE').length, 0);
    const totalRel = group.reduce((s, r) => s + r.feedResult.interactions.filter(i => i.matchedSubtopics.length > 0).length, 0);
    const avgMood = group.reduce((s, r) => s + r.feedResult.finalMood, 0) / group.length;
    const avgRating = group.reduce((s, r) => s + r.feedback.overallRating, 0) / group.length;
    const avgExpBefore = group.reduce((s, r) => s + r.exploreBefore.relevanceScore, 0) / group.length;
    const avgExpAfter = group.reduce((s, r) => s + r.exploreAfter.relevanceScore, 0) / group.length;
    return {
      count: group.length, avgArticles: totalInts / group.length,
      engRate: totalInts > 0 ? totalEng / totalInts : 0,
      relRate: totalInts > 0 ? totalRel / totalInts : 0,
      avgMood, avgRating, avgExpBefore, avgExpAfter,
    };
  }

  const retStats = groupStats(returning);
  const freshStats = groupStats(fresh);

  console.log(`  ${'Metric'.padEnd(35)} ${'Returning (10)'.padStart(18)} ${'Fresh (10)'.padStart(18)} ${'Winner'.padStart(10)}`);
  console.log(`  ${'─'.repeat(85)}`);
  const metrics = [
    ['Avg articles read', retStats.avgArticles.toFixed(1), freshStats.avgArticles.toFixed(1), retStats.avgArticles > freshStats.avgArticles ? 'Returning' : 'Fresh'],
    ['Engagement rate', (retStats.engRate*100).toFixed(1)+'%', (freshStats.engRate*100).toFixed(1)+'%', retStats.engRate > freshStats.engRate ? 'Returning' : 'Fresh'],
    ['Relevance rate', (retStats.relRate*100).toFixed(1)+'%', (freshStats.relRate*100).toFixed(1)+'%', retStats.relRate > freshStats.relRate ? 'Returning' : 'Fresh'],
    ['Avg final mood', retStats.avgMood.toFixed(0), freshStats.avgMood.toFixed(0), retStats.avgMood > freshStats.avgMood ? 'Returning' : 'Fresh'],
    ['Avg overall rating', retStats.avgRating.toFixed(1)+'/10', freshStats.avgRating.toFixed(1)+'/10', retStats.avgRating > freshStats.avgRating ? 'Returning' : 'Fresh'],
    ['Explore BEFORE relevance', retStats.avgExpBefore.toFixed(1)+'%', freshStats.avgExpBefore.toFixed(1)+'%', retStats.avgExpBefore > freshStats.avgExpBefore ? 'Returning' : 'Fresh'],
    ['Explore AFTER relevance', retStats.avgExpAfter.toFixed(1)+'%', freshStats.avgExpAfter.toFixed(1)+'%', retStats.avgExpAfter > freshStats.avgExpAfter ? 'Returning' : 'Fresh'],
  ];
  for (const [name, ret, fre, winner] of metrics) {
    console.log(`  ${name.padEnd(35)} ${ret.padStart(18)} ${fre.padStart(18)} ${winner.padStart(10)}`);
  }

  // ── TABLE 5: User Feedback Summary ──
  console.log('\n  TABLE 5: PERSONA FEEDBACK SUMMARY');
  console.log(`  ${'Name'.padEnd(12)} ${'Rating'.padStart(8)} ${'Satisfaction'.padStart(14)} ${'Explore'.padStart(10)} ${'Improved'.padStart(10)} ${'Recommend'.padStart(12)} Best Feature`);
  console.log(`  ${'─'.repeat(120)}`);

  for (const r of allResults) {
    const f = r.feedback;
    console.log(`  ${r.persona.name.padEnd(12)} ${(f.overallRating+'/10').padStart(8)} ${f.feedSatisfaction.padStart(14)} ${f.exploreVerdict.padStart(10)} ${f.exploreImproved.padStart(10)} ${(f.wouldRecommend.split('—')[0].trim()).substring(0,11).padStart(12)} ${f.bestFeature.substring(0, 50)}`);
  }

  // ── TABLE 6: Complaints & Feature Requests ──
  console.log('\n  TABLE 6: COMPLAINTS & FEATURE REQUESTS');
  console.log(`  ${'Name'.padEnd(12)} Top Complaint                                          Feature Request`);
  console.log(`  ${'─'.repeat(120)}`);

  for (const r of allResults) {
    const f = r.feedback;
    console.log(`  ${r.persona.name.padEnd(12)} ${(f.topComplaint || '-').substring(0, 50).padEnd(55)} ${(f.featureRequests[0] || '-').substring(0, 55)}`);
  }

  // ── TABLE 7: Persona Quotes ──
  console.log('\n  TABLE 7: WHAT USERS SAY');
  console.log(`  ${'─'.repeat(110)}`);
  for (const r of allResults) {
    console.log(`  ${r.persona.name.padEnd(10)} (${r.feedback.overallRating}/10): "${r.feedback.personalQuote}"`);
  }

  // ── FINAL VERDICT ──
  const avgRating = allResults.reduce((s, r) => s + r.feedback.overallRating, 0) / allResults.length;
  const avgEngRate = allResults.reduce((s, r) => {
    const ints = r.feedResult.interactions;
    return s + (ints.length > 0 ? ints.filter(i => i.signal === 'ENGAGE').length / ints.length : 0);
  }, 0) / allResults.length;
  const avgExpAfter = allResults.reduce((s, r) => s + r.exploreAfter.relevanceScore, 0) / allResults.length;
  const frustrated = allResults.filter(r => r.feedResult.exitType === 'frustrated').length;
  const bored = allResults.filter(r => r.feedResult.exitType === 'bored' || r.feedResult.exitType === 'disengaged').length;
  const natural = allResults.filter(r => r.feedResult.exitType === 'natural').length;
  const wouldRecommend = allResults.filter(r => r.feedback.overallRating >= 6).length;

  console.log(`\n  ${'='.repeat(70)}`);
  console.log(`  FINAL VERDICT`);
  console.log(`  ${'='.repeat(70)}`);
  console.log(`  Average rating:              ${avgRating.toFixed(1)}/10`);
  console.log(`  Average engagement rate:     ${(avgEngRate * 100).toFixed(1)}%`);
  console.log(`  Average explore relevance:   ${avgExpAfter.toFixed(1)}%`);
  console.log(`  Exit types:                  Natural: ${natural} | Bored: ${bored} | Frustrated: ${frustrated}`);
  console.log(`  Would recommend:             ${wouldRecommend}/20 (${((wouldRecommend / 20) * 100).toFixed(0)}%)`);
  console.log(`  Returning vs Fresh winner:   ${retStats.avgRating > freshStats.avgRating ? 'Returning users (personalization working)' : 'Fresh users (cold start is strong)' }`);

  if (avgRating >= 7) console.log(`  App quality:                 EXCELLENT`);
  else if (avgRating >= 5) console.log(`  App quality:                 GOOD`);
  else if (avgRating >= 3.5) console.log(`  App quality:                 NEEDS IMPROVEMENT`);
  else console.log(`  App quality:                 POOR`);

  console.log(`\n  Done at ${new Date().toISOString()}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

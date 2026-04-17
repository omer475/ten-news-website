const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';
const FEED_URL = 'https://www.tennews.ai/api/feed/main';
const TRACK_URL = 'https://www.tennews.ai/api/analytics/track';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 50 PERSONAS — ENTITY-LEVEL INTERESTS
//
// Users select SUBTOPICS at onboarding (like "soccer", "ai_ml").
// But their REAL interests are specific ENTITIES — not "soccer"
// but "premier league", "galatasaray", "champions league".
//
// Each entity has a hidden interest weight (0.0-1.0).
// The algorithm must discover these from behavior signals.
// An article matches if its interest_tags contain the entity.
//
// The test measures:
// 1. Does the feed show articles matching the user's entities?
// 2. Does it learn to show MORE of high-weight entities?
// 3. Is there diversity (multiple entities per page)?
// ═══════════════════════════════════════════════════════════════

const PERSONAS = [
  // ── DIVERSE INTERESTS ──
  { name: 'Maria', country: 'brazil',
    subtopics: { soccer: 0.9, movies_film: 0.8, ai_ml: 0.7, bitcoin: 0.4, travel_adventure: 0.3, music: 0.5 },
    searches: ['premier league results', 'oscar nominations', 'chatgpt news'] },

  { name: 'Jake', country: 'usa',
    subtopics: { nfl: 0.9, ai_ml: 0.8, stock_markets: 0.5, gaming: 0.85, space_astronomy: 0.3, comedy: 0.4 },
    searches: ['nfl draft picks', 'artificial intelligence', 'ps5 games'] },

  { name: 'Priya', country: 'india',
    subtopics: { cricket: 0.9, bollywood: 0.7, startups_vc: 0.6, cybersecurity: 0.4, food_cooking: 0.8, mental_health: 0.3 },
    searches: ['ipl auction', 'bollywood movies', 'startup funding india'] },

  { name: 'Emre', country: 'turkiye',
    subtopics: { soccer: 0.95, f1: 0.85, middle_east: 0.6, automotive: 0.5, gaming: 0.7, space_tech: 0.3 },
    searches: ['galatasaray transfer', 'formula one race', 'iran news'] },

  { name: 'Sophie', country: 'france',
    subtopics: { movies_film: 0.85, climate_environment: 0.8, food_cooking: 0.9, european_politics: 0.5, fashion: 0.6, music: 0.4 },
    searches: ['cannes film festival', 'climate change report', 'french cuisine'] },

  { name: 'Kenji', country: 'japan',
    subtopics: { anime_manga: 0.9, gaming: 0.85, robotics_hardware: 0.7, baseball: 0.5, space_astronomy: 0.6, food_cooking: 0.4 },
    searches: ['one piece manga', 'nintendo switch', 'nvidia chip'] },

  { name: 'Ahmed', country: 'turkiye',
    subtopics: { soccer: 0.9, middle_east: 0.8, bitcoin: 0.5, oil_energy: 0.6, boxing_mma: 0.7, travel_adventure: 0.3 },
    searches: ['turkey football', 'middle east news', 'bitcoin price'] },

  { name: 'Sarah', country: 'usa',
    subtopics: { ai_ml: 0.9, mental_health: 0.7, tv_streaming: 0.6, fitness_workout: 0.8, cybersecurity: 0.5, pets_animals: 0.4 },
    searches: ['openai news', 'therapy online', 'netflix new releases'] },

  { name: 'Carlos', country: 'spain',
    subtopics: { soccer: 0.9, tennis: 0.75, movies_film: 0.6, european_politics: 0.5, oil_energy: 0.3, latin_music: 0.8 },
    searches: ['la liga results', 'atp rankings', 'best movies 2026'] },

  { name: 'Fatima', country: 'turkiye',
    subtopics: { middle_east: 0.9, human_rights_civil: 0.8, beauty_skincare: 0.5, tv_streaming: 0.6, public_health: 0.4, kpop_kdrama: 0.7 },
    searches: ['iran israel news', 'human rights report', 'korean drama'] },

  // ── TECH-HEAVY ──
  { name: 'Raj', country: 'india',
    subtopics: { ai_ml: 0.95, cybersecurity: 0.8, startups_vc: 0.7, cricket: 0.6, space_tech: 0.5, stock_markets: 0.4 },
    searches: ['machine learning paper', 'ransomware attack', 'vc funding'] },

  { name: 'Wei', country: 'japan',
    subtopics: { robotics_hardware: 0.9, ai_ml: 0.85, smartphones_gadgets: 0.7, gaming: 0.6, asian_politics: 0.4, stock_markets: 0.3 },
    searches: ['semiconductor news', 'chatgpt update', 'iphone 18'] },

  { name: 'David', country: 'usa',
    subtopics: { ai_ml: 0.85, space_tech: 0.8, gaming: 0.9, nba: 0.5, mental_health: 0.3, social_media: 0.4 },
    searches: ['spacex launch', 'ai regulation', 'video games'] },

  // ── SPORTS-HEAVY ──
  { name: 'Tom', country: 'usa',
    subtopics: { nba: 0.95, nfl: 0.8, baseball: 0.7, ai_ml: 0.4, stock_markets: 0.3, comedy: 0.5 },
    searches: ['nba standings', 'nfl scores', 'mlb trades'] },

  { name: 'Pedro', country: 'brazil',
    subtopics: { soccer: 0.95, f1: 0.8, boxing_mma: 0.75, music: 0.5, gaming: 0.4, travel_adventure: 0.3 },
    searches: ['champions league', 'formula one standings', 'ufc results'] },

  { name: 'Aisha', country: 'turkiye',
    subtopics: { soccer: 0.85, tennis: 0.7, middle_east: 0.8, beauty_skincare: 0.5, movies_film: 0.6, food_cooking: 0.4 },
    searches: ['world cup qualifiers', 'wimbledon draw', 'turkey politics'] },

  { name: 'Henrik', country: 'germany',
    subtopics: { soccer: 0.9, f1: 0.75, european_politics: 0.7, climate_environment: 0.5, automotive: 0.6, golf: 0.4 },
    searches: ['bundesliga results', 'formula one race', 'eu policy'] },

  // ── POLITICS/WORLD ──
  { name: 'James', country: 'usa',
    subtopics: { us_politics: 0.95, stock_markets: 0.7, war_conflict: 0.8, ai_ml: 0.5, oil_energy: 0.4, nfl: 0.6 },
    searches: ['trump news', 'wall street today', 'ukraine war'] },

  { name: 'Nadia', country: 'turkiye',
    subtopics: { middle_east: 0.9, war_conflict: 0.85, oil_energy: 0.7, soccer: 0.5, human_rights_civil: 0.6, food_cooking: 0.3 },
    searches: ['iran military', 'oil prices opec', 'middle east war'] },

  { name: 'Viktor', country: 'germany',
    subtopics: { european_politics: 0.85, war_conflict: 0.9, climate_environment: 0.7, soccer: 0.5, automotive: 0.4, biology_nature: 0.3 },
    searches: ['russia ukraine', 'eu elections', 'carbon emissions'] },

  { name: 'Chen', country: 'japan',
    subtopics: { asian_politics: 0.9, ai_ml: 0.8, robotics_hardware: 0.6, baseball: 0.5, anime_manga: 0.7, space_astronomy: 0.4 },
    searches: ['china taiwan news', 'ai japan', 'semiconductor chip'] },

  // ── ENTERTAINMENT ──
  { name: 'Tyler', country: 'usa',
    subtopics: { movies_film: 0.9, gaming: 0.85, hip_hop: 0.6, nba: 0.5, tv_streaming: 0.7, celebrity_news: 0.4 },
    searches: ['oscar winners', 'video game releases', 'hip hop album'] },

  { name: 'Yara', country: 'turkiye',
    subtopics: { movies_film: 0.8, kpop_kdrama: 0.9, beauty_skincare: 0.7, middle_east: 0.5, food_cooking: 0.6, travel_adventure: 0.4 },
    searches: ['best movies 2026', 'new kdrama', 'skincare routine'] },

  { name: 'Ines', country: 'spain',
    subtopics: { tv_streaming: 0.85, latin_music: 0.8, soccer: 0.7, food_cooking: 0.6, celebrity_news: 0.5, travel_adventure: 0.4 },
    searches: ['netflix spain', 'bad bunny album', 'la liga'] },

  { name: 'Liam', country: 'uk',
    subtopics: { soccer: 0.9, comedy: 0.7, music: 0.8, celebrity_news: 0.5, us_politics: 0.4, gaming: 0.6 },
    searches: ['premier league', 'comedy special', 'new album release'] },

  // ── LIFESTYLE ──
  { name: 'Jessica', country: 'usa',
    subtopics: { fitness_workout: 0.9, mental_health: 0.8, food_cooking: 0.85, tv_streaming: 0.6, pets_animals: 0.5, beauty_skincare: 0.4 },
    searches: ['workout routine', 'anxiety treatment', 'healthy recipes'] },

  { name: 'Kim', country: 'japan',
    subtopics: { beauty_skincare: 0.9, kpop_kdrama: 0.85, food_cooking: 0.8, anime_manga: 0.6, fashion: 0.7, travel_adventure: 0.5 },
    searches: ['korean skincare', 'bts comeback', 'japanese cooking'] },

  { name: 'Anna', country: 'germany',
    subtopics: { parenting_family: 0.9, climate_environment: 0.7, food_cooking: 0.8, european_politics: 0.5, pets_animals: 0.6, mental_health: 0.4 },
    searches: ['toddler activities', 'climate change', 'easy recipes'] },

  { name: 'Lisa', country: 'australia',
    subtopics: { pets_animals: 0.85, travel_adventure: 0.8, cricket: 0.7, biology_nature: 0.6, food_cooking: 0.75, fitness_workout: 0.5 },
    searches: ['dog adoption', 'best travel destinations', 'cricket ashes'] },

  // ── FINANCE/CRYPTO ──
  { name: 'Michael', country: 'usa',
    subtopics: { stock_markets: 0.9, bitcoin: 0.8, ai_ml: 0.7, nfl: 0.5, real_estate: 0.6, automotive: 0.3 },
    searches: ['nasdaq today', 'bitcoin price', 'openai valuation'] },

  { name: 'Alex', country: 'uk',
    subtopics: { bitcoin: 0.9, defi_web3: 0.85, stock_markets: 0.7, soccer: 0.5, ai_ml: 0.6, oil_energy: 0.4 },
    searches: ['crypto bull run', 'defi yields', 'ftse 100'] },

  { name: 'Omar', country: 'turkiye',
    subtopics: { oil_energy: 0.9, middle_east: 0.85, bitcoin: 0.6, real_estate: 0.4, soccer: 0.7, automotive: 0.3 },
    searches: ['opec meeting', 'iran oil', 'bitcoin halving'] },

  // ── SCIENCE ──
  { name: 'Neil', country: 'usa',
    subtopics: { space_astronomy: 0.95, space_tech: 0.85, climate_environment: 0.6, ai_ml: 0.7, biology_nature: 0.5, movies_film: 0.4 },
    searches: ['james webb telescope', 'spacex starship', 'global warming report'] },

  { name: 'Greta', country: 'germany',
    subtopics: { climate_environment: 0.95, biology_nature: 0.85, european_politics: 0.6, earth_science: 0.7, public_health: 0.4, food_cooking: 0.5 },
    searches: ['carbon emissions', 'endangered species', 'eu green deal'] },

  { name: 'Laura', country: 'germany',
    subtopics: { medical_breakthroughs: 0.9, ai_ml: 0.7, biology_nature: 0.8, mental_health: 0.5, european_politics: 0.4, food_cooking: 0.6 },
    searches: ['cancer treatment', 'ai medical', 'genetics breakthrough'] },

  // ── CROSS-DOMAIN ──
  { name: 'Diego', country: 'mexico',
    subtopics: { soccer: 0.85, latin_music: 0.9, us_politics: 0.6, bitcoin: 0.5, movies_film: 0.7, food_cooking: 0.8 },
    searches: ['liga mx results', 'reggaeton new', 'trump mexico'] },

  { name: 'Mia', country: 'france',
    subtopics: { movies_film: 0.9, european_politics: 0.7, fashion: 0.8, food_cooking: 0.85, ai_ml: 0.5, climate_environment: 0.6 },
    searches: ['cannes 2026', 'macron news', 'paris fashion week'] },

  { name: 'Robert', country: 'usa',
    subtopics: { automotive: 0.85, us_politics: 0.8, stock_markets: 0.7, nfl: 0.6, space_tech: 0.5, real_estate: 0.4 },
    searches: ['tesla model y', 'congress vote', 'dow jones'] },

  { name: 'Tina', country: 'usa',
    subtopics: { ai_ml: 0.9, startups_vc: 0.8, movies_film: 0.6, fitness_workout: 0.5, asian_politics: 0.4, social_media: 0.7 },
    searches: ['ai startup funding', 'unicorn valuation', 'best films'] },

  { name: 'Marco', country: 'france',
    subtopics: { oil_energy: 0.85, european_politics: 0.8, soccer: 0.7, food_cooking: 0.9, real_estate: 0.5, climate_environment: 0.6 },
    searches: ['energy prices europe', 'eu summit', 'ligue 1'] },

  { name: 'Rachel', country: 'usa',
    subtopics: { us_politics: 0.8, mental_health: 0.85, tv_streaming: 0.7, parenting_family: 0.9, food_cooking: 0.6, pets_animals: 0.5 },
    searches: ['biden policy', 'therapy tips', 'hbo new series'] },

  // ── NICHE COMBOS ──
  { name: 'Hana', country: 'japan',
    subtopics: { food_cooking: 0.95, anime_manga: 0.8, travel_adventure: 0.7, biology_nature: 0.5, movies_film: 0.6, baseball: 0.4 },
    searches: ['ramen recipe', 'anime new season', 'japan travel guide'] },

  { name: 'Eric', country: 'usa',
    subtopics: { war_conflict: 0.9, nfl: 0.8, ai_ml: 0.7, space_tech: 0.6, stock_markets: 0.5, gaming: 0.85 },
    searches: ['iran conflict', 'nfl playoffs', 'chatgpt 5'] },

  { name: 'Nina', country: 'germany',
    subtopics: { war_conflict: 0.85, european_politics: 0.9, earth_science: 0.5, pets_animals: 0.6, soccer: 0.7, mental_health: 0.4 },
    searches: ['ukraine update', 'german elections', 'bundesliga'] },

  { name: 'Dmitri', country: 'germany',
    subtopics: { war_conflict: 0.9, asian_politics: 0.8, ai_ml: 0.85, space_astronomy: 0.6, movies_film: 0.5, european_politics: 0.4 },
    searches: ['russia news', 'china geopolitics', 'deep learning'] },

  { name: 'Aiden', country: 'australia',
    subtopics: { cricket: 0.9, climate_environment: 0.7, movies_film: 0.6, travel_adventure: 0.8, biology_nature: 0.5, food_cooking: 0.4 },
    searches: ['ashes cricket', 'australia climate', 'best films'] },

  { name: 'Soo-jin', country: 'japan',
    subtopics: { kpop_kdrama: 0.95, beauty_skincare: 0.85, anime_manga: 0.7, food_cooking: 0.6, fashion: 0.8, gaming: 0.5 },
    searches: ['blackpink tour', 'korean skincare', 'one piece'] },

  { name: 'Lucas', country: 'germany',
    subtopics: { gaming: 0.9, soccer: 0.8, ai_ml: 0.85, movies_film: 0.6, automotive: 0.5, space_tech: 0.7 },
    searches: ['ps5 games', 'champions league', 'openai'] },

  { name: 'Chioma', country: 'usa',
    subtopics: { afrobeats: 0.8, celebrity_news: 0.7, beauty_skincare: 0.9, us_politics: 0.5, food_cooking: 0.6, nba: 0.4 },
    searches: ['burna boy album', 'celebrity gossip', 'skincare tips'] },

  { name: 'Yuki', country: 'japan',
    subtopics: { baseball: 0.85, anime_manga: 0.9, robotics_hardware: 0.7, food_cooking: 0.6, gaming: 0.8, space_astronomy: 0.5 },
    searches: ['mlb japan', 'manga releases', 'robot news'] },
];

// ═══════════════════════════════════════════════════════
// SUBTOPIC → ONBOARDING ALIAS MAP
// Maps our readable names to the app's stored alias IDs
// ═══════════════════════════════════════════════════════
const SUBTOPIC_ALIAS = {
  'soccer': 'soccer', 'nfl': 'nfl', 'nba': 'nba', 'baseball': 'baseball',
  'cricket': 'cricket', 'f1': 'f1', 'boxing_mma': 'boxing_mma', 'tennis': 'tennis', 'golf': 'golf',
  'movies_film': 'movies_film', 'tv_streaming': 'tv_streaming', 'music': 'music',
  'gaming': 'gaming', 'celebrity_news': 'celebrity_news', 'kpop_kdrama': 'kpop_kdrama',
  'bollywood': 'bollywood', 'anime_manga': 'anime_manga', 'hip_hop': 'hip_hop',
  'afrobeats': 'afrobeats', 'latin_music': 'latin_music', 'comedy': 'comedy',
  'ai_ml': 'ai_ml', 'smartphones_gadgets': 'smartphones_gadgets', 'social_media': 'social_media',
  'cybersecurity': 'cybersecurity', 'space_tech': 'space_tech', 'robotics_hardware': 'robotics_hardware',
  'space_astronomy': 'space_astronomy', 'climate_environment': 'climate_environment',
  'biology_nature': 'biology_nature', 'earth_science': 'earth_science',
  'medical_breakthroughs': 'medical_breakthroughs', 'public_health': 'public_health',
  'mental_health': 'mental_health', 'pharma_drug': 'pharma_drug',
  'stock_markets': 'stock_markets', 'banking_lending': 'banking_lending', 'commodities': 'commodities',
  'bitcoin': 'bitcoin', 'defi_web3': 'defi_web3', 'crypto_regulation': 'crypto_regulation',
  'us_politics': 'us_politics', 'european_politics': 'european_politics', 'asian_politics': 'asian_politics',
  'middle_east': 'middle_east', 'war_conflict': 'war_conflict', 'human_rights_civil': 'human_rights_civil',
  'latin_america': 'latin_america', 'africa_oceania': 'africa_oceania',
  'oil_energy': 'oil_energy', 'automotive': 'automotive', 'retail_consumer': 'retail_consumer',
  'corporate_deals': 'corporate_deals', 'trade_tariffs': 'trade_tariffs',
  'corporate_earnings': 'corporate_earnings', 'startups_vc': 'startups_vc', 'real_estate': 'real_estate',
  'pets_animals': 'pets_animals', 'food_cooking': 'food_cooking', 'travel_adventure': 'travel_adventure',
  'fitness_workout': 'fitness_workout', 'beauty_skincare': 'beauty_skincare',
  'parenting_family': 'parenting_family', 'home_garden': 'home_garden',
  'sneakers_streetwear': 'sneakers_streetwear', 'celebrity_style': 'celebrity_style',
  'fashion': 'fashion', 'news': 'news',
};

// Tags that indicate an article matches a subtopic
const SUBTOPIC_TAGS = {
  'soccer': ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'world cup', 'mls', 'galatasaray', 'liverpool', 'barcelona', 'real madrid', 'atletico'],
  'nfl': ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown'],
  'nba': ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'march madness', 'college basketball'],
  'baseball': ['mlb', 'baseball', 'world series', 'home run'],
  'cricket': ['cricket', 'ipl', 'test match', 'ashes', 't20'],
  'f1': ['f1', 'formula 1', 'formula one', 'grand prix', 'motorsport', 'mclaren', 'ferrari', 'verstappen', 'hamilton'],
  'boxing_mma': ['boxing', 'mma', 'ufc', 'knockout', 'fight'],
  'tennis': ['tennis', 'atp', 'wta', 'wimbledon', 'djokovic', 'nadal'],
  'golf': ['golf', 'pga', 'masters', 'ryder cup'],
  'movies_film': ['movies', 'film', 'box office', 'hollywood', 'oscar', 'oscars', 'cinema', 'academy awards', 'director'],
  'tv_streaming': ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'television'],
  'music': ['music', 'album', 'concert', 'tour', 'grammy', 'singer'],
  'gaming': ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'],
  'celebrity_news': ['celebrity', 'famous', 'scandal', 'gossip', 'star', 'billionaire'],
  'kpop_kdrama': ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama'],
  'bollywood': ['bollywood', 'indian cinema', 'shah rukh khan'],
  'anime_manga': ['anime', 'manga', 'one piece', 'naruto', 'studio ghibli'],
  'hip_hop': ['hip-hop', 'rap', 'rapper', 'drake', 'kendrick'],
  'afrobeats': ['afrobeats', 'burna boy', 'wizkid', 'davido'],
  'latin_music': ['reggaeton', 'latin music', 'bad bunny'],
  'comedy': ['comedy', 'humor', 'standup', 'comedian', 'funny'],
  'ai_ml': ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'],
  'smartphones_gadgets': ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'apple', 'android'],
  'social_media': ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta'],
  'cybersecurity': ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption'],
  'space_tech': ['spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'],
  'robotics_hardware': ['robotics', 'robot', 'chip', 'semiconductor', 'nvidia', 'processor'],
  'space_astronomy': ['space', 'astronomy', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'],
  'climate_environment': ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution'],
  'biology_nature': ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'],
  'earth_science': ['earthquake', 'volcano', 'ocean', 'weather', 'geology'],
  'medical_breakthroughs': ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial'],
  'public_health': ['pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'],
  'mental_health': ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness'],
  'stock_markets': ['stock market', 'wall street', 'nasdaq', 'dow jones', 'shares', 'trading'],
  'bitcoin': ['bitcoin', 'btc', 'crypto', 'cryptocurrency', 'mining'],
  'defi_web3': ['defi', 'web3', 'blockchain', 'smart contract', 'dao'],
  'us_politics': ['us politics', 'congress', 'senate', 'white house', 'trump', 'biden', 'republican', 'democrat'],
  'european_politics': ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament'],
  'asian_politics': ['asian politics', 'china', 'india', 'japan', 'taiwan', 'asean'],
  'middle_east': ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon'],
  'war_conflict': ['war', 'conflict', 'military', 'defense', 'invasion', 'ukraine', 'russia', 'putin'],
  'human_rights_civil': ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy'],
  'oil_energy': ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices'],
  'automotive': ['automotive', 'cars', 'tesla', 'ford', 'electric vehicles', 'ev'],
  'startups_vc': ['startup', 'venture capital', 'funding', 'unicorn', 'vc'],
  'real_estate': ['real estate', 'property', 'housing', 'mortgage'],
  'food_cooking': ['food', 'cooking', 'restaurant', 'recipe', 'chef', 'cuisine'],
  'travel_adventure': ['travel', 'tourism', 'vacation', 'destination', 'hotel'],
  'fitness_workout': ['fitness', 'workout', 'gym', 'exercise', 'running'],
  'beauty_skincare': ['beauty', 'skincare', 'makeup', 'cosmetics'],
  'parenting_family': ['parenting', 'family', 'children', 'baby', 'motherhood'],
  'pets_animals': ['pets', 'animals', 'dog', 'cat', 'wildlife'],
  'fashion': ['fashion', 'sneakers', 'streetwear', 'nike', 'adidas', 'met gala'],
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function matchesSubtopic(article, subtopic) {
  const tags = Array.isArray(article.interest_tags) ? article.interest_tags : [];
  const lowerTags = tags.map(t => t.toLowerCase());
  const matchTags = SUBTOPIC_TAGS[subtopic] || [];
  for (const mt of matchTags) {
    if (lowerTags.some(t => t.includes(mt))) return true;
  }
  return false;
}

// Returns the best matching subtopic and its hidden interest weight
// subtopics is now an object: { soccer: 0.9, ai_ml: 0.7, ... }
function getBestMatch(article, subtopicWeights) {
  let bestSub = null, bestWeight = 0;
  for (const [sub, weight] of Object.entries(subtopicWeights)) {
    if (matchesSubtopic(article, sub) && weight > bestWeight) {
      bestSub = sub;
      bestWeight = weight;
    }
  }
  return { subtopic: bestSub, weight: bestWeight };
}

async function trackEvent(userId, eventType, articleId, metadata = {}) {
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, article_id: articleId || undefined, user_id: userId, guest_device_id: userId, metadata })
    });
  } catch (_) {}
}

async function fetchFeed(userId, topics, country, cursor = null, engaged = [], skipped = []) {
  let url = `${FEED_URL}?user_id=${userId}&followed_topics=${topics.join(',')}&home_country=${country}&limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engaged.length) url += `&engaged_ids=${engaged.slice(-50).join(',')}`;
  if (skipped.length) url += `&skipped_ids=${skipped.slice(-50).join(',')}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) { return { articles: [], next_cursor: null }; }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ═══════════════════════════════════════════════════════
// RUN ONE PERSONA — 5 pages, realistic multi-interest behavior
// ═══════════════════════════════════════════════════════

async function runPersona(persona, index) {
  const userId = generateUUID();
  const email = `test_v3_${persona.name.toLowerCase()}_${index}@tennews.test`;
  const subKeys = Object.keys(persona.subtopics);
  const aliases = subKeys.map(s => SUBTOPIC_ALIAS[s] || s).slice(0, 9);

  // Sort by weight to show the persona's natural preference order
  const sortedSubs = Object.entries(persona.subtopics).sort((a, b) => b[1] - a[1]);
  const topInterests = sortedSubs.filter(([, w]) => w >= 0.7).map(([s]) => s);

  console.log(`\n[${index+1}/50] ${persona.name} (${persona.country})`);
  console.log(`  Subtopics: ${sortedSubs.map(([s, w]) => `${s}(${w})`).join(', ')}`);
  console.log(`  Top interests (≥0.7): [${topInterests.join(', ')}]`);

  // 1. Create user with subtopics (not broad categories)
  const { error: createErr } = await supabase.from('users').upsert({
    id: userId, email, home_country: persona.country,
    followed_countries: [persona.country],
    followed_topics: aliases
  }, { onConflict: 'id' });

  if (createErr) {
    console.log(`  ERROR: ${createErr.message}`);
    return { persona: persona.name, error: createErr.message };
  }

  await supabase.from('users').update({ tag_profile: {}, skip_profile: {} }).eq('id', userId);

  // 2. Send searches
  for (const q of persona.searches) {
    await trackEvent(userId, 'search_query', null, { query: q });
    await sleep(150);
  }
  await sleep(2500);

  // 3. Process 5 pages
  const pages = [];
  let cursor = null;
  const allEngagedIds = [], allSkippedIds = [];
  let totalLikes = 0, totalSaves = 0, totalEngages = 0, totalSkips = 0;
  const subtopicHits = {};  // track which subtopics appeared
  const favHits = {};       // track favorite subtopic hits per page
  let totalDiverseTopics = 0; // how many DIFFERENT subtopics appeared per page

  for (let page = 1; page <= 5; page++) {
    const feed = await fetchFeed(userId, aliases, persona.country, cursor, allEngagedIds, allSkippedIds);
    const articles = feed.articles || [];
    cursor = feed.next_cursor;

    let highMatches = 0, anyMatches = 0, pageSkips = 0, pageLikes = 0, pageEngages = 0;
    const pageSubtopics = new Set();

    for (const article of articles) {
      const { subtopic: matchedSub, weight } = getBestMatch(article, persona.subtopics);

      if (matchedSub) {
        anyMatches++;
        if (weight >= 0.7) highMatches++; // "high interest" match
        pageSubtopics.add(matchedSub);
        subtopicHits[matchedSub] = (subtopicHits[matchedSub] || 0) + 1;
      }

      // Behavior driven by hidden interest weight
      // weight 0.9 → 90% chance of positive action (like/engage/save)
      // weight 0.5 → 50% chance of positive action, 30% glance, 20% skip
      // weight 0.3 → 30% positive, 30% glance, 40% skip
      // no match → 15% glance, 85% skip
      if (matchedSub && weight > 0) {
        const rand = Math.random();
        if (rand < weight * 0.08) {
          // Save — scales with weight (high interest = more saves)
          await trackEvent(userId, 'article_saved', article.id, { dwell: String(20 + Math.random() * 20), dwell_tier: 'deep_read' });
          totalSaves++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.35) {
          // Like — more likely for high-weight subtopics
          await trackEvent(userId, 'article_liked', article.id, { dwell: String(10 + weight * 15), dwell_tier: weight > 0.6 ? 'engaged_read' : 'light_read' });
          pageLikes++; totalLikes++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.7) {
          // Engaged read — dwell time proportional to interest
          await trackEvent(userId, 'article_engaged', article.id, { dwell: String(5 + weight * 20), dwell_tier: weight > 0.6 ? 'engaged_read' : 'light_read' });
          pageEngages++; totalEngages++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.85) {
          // Glance — looked but didn't deeply engage
          await trackEvent(userId, 'article_view', article.id, { dwell: String(3 + Math.random() * 3), dwell_tier: 'glance' });
        } else {
          // Even matched articles get skipped sometimes (low weight or just not in the mood)
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(1 + Math.random()), dwell_tier: 'quick_skip' });
          pageSkips++; totalSkips++; allSkippedIds.push(article.id);
        }
      } else {
        // No match — mostly skip, occasionally glance
        if (Math.random() < 0.15) {
          await trackEvent(userId, 'article_view', article.id, { dwell: '2', dwell_tier: 'glance' });
        } else {
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(0.3 + Math.random()), dwell_tier: 'instant_skip' });
          pageSkips++; totalSkips++;
          allSkippedIds.push(article.id);
        }
      }
      await sleep(30);
    }

    const anyMatchPct = articles.length > 0 ? (anyMatches / articles.length * 100) : 0;
    const highMatchPct = articles.length > 0 ? (highMatches / articles.length * 100) : 0;
    totalDiverseTopics += pageSubtopics.size;

    pages.push({ page, total: articles.length, anyMatches, highMatches, anyMatchPct, highMatchPct,
      likes: pageLikes, engages: pageEngages, skips: pageSkips, diverseTopics: pageSubtopics.size,
      topics: [...pageSubtopics] });

    const diversityBar = '◆'.repeat(pageSubtopics.size) + '◇'.repeat(Math.max(0, 6 - pageSubtopics.size));
    const matchBar = anyMatchPct >= 50 ? '★' : anyMatchPct >= 30 ? '▲' : anyMatchPct >= 15 ? '·' : '✗';
    console.log(`  P${page}: ${String(anyMatchPct.toFixed(0)).padStart(3)}% any, ${String(highMatchPct.toFixed(0)).padStart(3)}% high ${matchBar} | ${diversityBar} ${pageSubtopics.size} topics | L:${pageLikes} E:${pageEngages} S:${pageSkips}`);

    if (page < 5) await sleep(2500);
  }

  // 4. Profile check
  const { data: profile } = await supabase.from('users').select('tag_profile, skip_profile').eq('id', userId).single();
  const tagCount = Object.keys(profile?.tag_profile || {}).length;
  const skipCount = Object.keys(profile?.skip_profile || {}).length;

  // 5. Scoring
  const earlyAnyAvg = ((pages[0]?.anyMatchPct || 0) + (pages[1]?.anyMatchPct || 0)) / 2;
  const lateAnyAvg = ((pages[3]?.anyMatchPct || 0) + (pages[4]?.anyMatchPct || 0)) / 2;
  const earlyHighAvg = ((pages[0]?.highMatchPct || 0) + (pages[1]?.highMatchPct || 0)) / 2;
  const lateHighAvg = ((pages[3]?.highMatchPct || 0) + (pages[4]?.highMatchPct || 0)) / 2;
  const anyImprovement = lateAnyAvg - earlyAnyAvg;
  const highImprovement = lateHighAvg - earlyHighAvg;
  const avgDiversity = totalDiverseTopics / 5;

  // Did the algorithm learn the user's preferences?
  // "Learned" = high-interest articles increased OR any-match improved significantly
  const learned = highImprovement > 10 || (anyImprovement > 5 && highImprovement > 5);
  const softPivot = highImprovement > 5 || anyImprovement > 5;

  // Check which subtopics the feed showed most (did it match the user's weights?)
  const feedRatio = {};
  const totalHits = Object.values(subtopicHits).reduce((s, v) => s + v, 0) || 1;
  for (const [sub, hits] of Object.entries(subtopicHits)) {
    feedRatio[sub] = hits / totalHits;
  }
  // Correlation: do higher-weight subtopics get more feed share?
  let correlation = 0, corrCount = 0;
  for (const [sub, weight] of Object.entries(persona.subtopics)) {
    const ratio = feedRatio[sub] || 0;
    correlation += weight * ratio; // high weight * high ratio = good
    corrCount++;
  }
  const weightAlignment = corrCount > 0 ? (correlation / corrCount * 100) : 0;

  const result = {
    persona: persona.name,
    earlyAny: earlyAnyAvg.toFixed(1), lateAny: lateAnyAvg.toFixed(1), anyImp: anyImprovement.toFixed(1),
    earlyHigh: earlyHighAvg.toFixed(1), lateHigh: lateHighAvg.toFixed(1), highImp: highImprovement.toFixed(1),
    avgDiversity: avgDiversity.toFixed(1),
    weightAlignment: weightAlignment.toFixed(1),
    learned, softPivot,
    tagCount, skipCount,
    totalLikes, totalEngages, totalSkips, totalSaves,
    subtopicHits,
    pageProgAny: pages.map(p => p.anyMatchPct.toFixed(0) + '%').join(' → '),
    pageProgHigh: pages.map(p => p.highMatchPct.toFixed(0) + '%').join(' → '),
    pageProgDiv: pages.map(p => p.diverseTopics).join(' → '),
  };

  const label = learned ? '✅ LEARNED' : softPivot ? '🔄 PIVOT' : '❌ FLAT';
  console.log(`  ${label} | Any: ${earlyAnyAvg.toFixed(0)}→${lateAnyAvg.toFixed(0)} (${anyImprovement > 0 ? '+' : ''}${anyImprovement.toFixed(0)}) | High: ${earlyHighAvg.toFixed(0)}→${lateHighAvg.toFixed(0)} (${highImprovement > 0 ? '+' : ''}${highImprovement.toFixed(0)}) | Diversity: ${avgDiversity.toFixed(1)} topics/page | Alignment: ${weightAlignment.toFixed(0)}%`);

  // Cleanup
  await supabase.from('users').delete().eq('id', userId);
  await supabase.from('user_article_events').delete().eq('user_id', userId);

  return result;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  50-PERSONA FEED TEST v3 — REALISTIC MULTI-INTEREST');
  console.log('  Users select 5-8 SUBTOPICS, have 3 favorites');
  console.log('  Measures: match rate, favorite rate, topic diversity');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  const BATCH = 5;

  for (let i = 0; i < PERSONAS.length; i += BATCH) {
    const batch = PERSONAS.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map((p, j) => runPersona(p, i + j).catch(e => ({ persona: p.name, error: e.message })))
    );
    results.push(...batchResults);
  }

  // ═══════════════════════════════════════════════════════
  // DEEP ANALYSIS
  // ═══════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  DEEP ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const valid = results.filter(r => !r.error);
  const learned = valid.filter(r => r.learned);
  const pivot = valid.filter(r => r.softPivot && !r.learned);
  const flat = valid.filter(r => !r.softPivot);

  console.log('── OVERALL ──');
  console.log(`  Valid: ${valid.length}/${PERSONAS.length}`);
  console.log(`  Learned: ${learned.length} (${(learned.length/valid.length*100).toFixed(0)}%)`);
  console.log(`  Soft pivot: ${pivot.length} (${(pivot.length/valid.length*100).toFixed(0)}%)`);
  console.log(`  Flat/worse: ${flat.length} (${(flat.length/valid.length*100).toFixed(0)}%)`);

  const avg = (arr, fn) => arr.length > 0 ? arr.reduce((s, r) => s + fn(r), 0) / arr.length : 0;

  console.log(`\n── MATCH RATES ──`);
  console.log(`  Avg early ANY match:      ${avg(valid, r => parseFloat(r.earlyAny)).toFixed(1)}%`);
  console.log(`  Avg late ANY match:       ${avg(valid, r => parseFloat(r.lateAny)).toFixed(1)}%`);
  console.log(`  Avg ANY improvement:      ${avg(valid, r => parseFloat(r.anyImp)) > 0 ? '+' : ''}${avg(valid, r => parseFloat(r.anyImp)).toFixed(1)} pts`);
  console.log(`  Avg early HIGH match:     ${avg(valid, r => parseFloat(r.earlyHigh)).toFixed(1)}%`);
  console.log(`  Avg late HIGH match:      ${avg(valid, r => parseFloat(r.lateHigh)).toFixed(1)}%`);
  console.log(`  Avg HIGH improvement:     ${avg(valid, r => parseFloat(r.highImp)) > 0 ? '+' : ''}${avg(valid, r => parseFloat(r.highImp)).toFixed(1)} pts`);
  console.log(`  Avg weight alignment:     ${avg(valid, r => parseFloat(r.weightAlignment)).toFixed(1)}%`);
  console.log(`  (Alignment = do high-weight subtopics get more feed share?)`);
  console.log(`  (Higher = algorithm correctly prioritizes user's stronger interests)`);

  console.log(`\n── DIVERSITY ──`);
  console.log(`  Avg topics per page:      ${avg(valid, r => parseFloat(r.avgDiversity)).toFixed(1)}`);
  console.log(`  (Target: 3-5 different subtopics per page of 20)`);

  console.log(`\n── ENGAGEMENT ──`);
  const totalArticles = valid.reduce((s, r) => s + r.totalLikes + r.totalEngages + r.totalSkips, 0);
  console.log(`  Avg likes:  ${avg(valid, r => r.totalLikes).toFixed(1)} per persona`);
  console.log(`  Avg engages: ${avg(valid, r => r.totalEngages).toFixed(1)} per persona`);
  console.log(`  Avg skips:  ${avg(valid, r => r.totalSkips).toFixed(1)} per persona`);
  console.log(`  Avg tags:   ${avg(valid, r => r.tagCount).toFixed(0)}`);
  console.log(`  Avg skips profile: ${avg(valid, r => r.skipCount).toFixed(0)}`);

  // Grade — uses combined any+fav improvement
  const improvedCount = learned.length + pivot.length;
  const learnRate = improvedCount / valid.length * 100;
  let grade;
  if (learnRate >= 70) grade = 'A';
  else if (learnRate >= 50) grade = 'B';
  else if (learnRate >= 30) grade = 'C';
  else if (learnRate >= 15) grade = 'D';
  else grade = 'F';

  console.log(`\n══════════════════════════════`);
  console.log(`  GRADE: ${grade} (${learnRate.toFixed(0)}% improved)`);
  console.log(`══════════════════════════════`);

  // Top and bottom
  const sorted = [...valid].sort((a, b) => parseFloat(b.highImp) - parseFloat(a.highImp));
  console.log('\n── TOP 10 ──');
  for (const r of sorted.slice(0, 10)) {
    console.log(`  ${r.persona.padEnd(10)} Any: ${r.earlyAny}→${r.lateAny} (${r.anyImp}) | High: ${r.earlyHigh}→${r.lateHigh} (${r.highImp}) | Div: ${r.avgDiversity} | Align: ${r.weightAlignment}%`);
  }
  console.log('\n── BOTTOM 10 ──');
  for (const r of sorted.slice(-10)) {
    console.log(`  ${r.persona.padEnd(10)} Any: ${r.earlyAny}→${r.lateAny} (${r.anyImp}) | High: ${r.earlyHigh}→${r.lateHigh} (${r.highImp}) | Div: ${r.avgDiversity} | Align: ${r.weightAlignment}%`);
  }

  // Errors
  const errors = results.filter(r => r.error);
  if (errors.length) {
    console.log('\n── ERRORS ──');
    for (const e of errors) console.log(`  ${e.persona}: ${e.error}`);
  }

  console.log(`\nDone at ${new Date().toISOString()}`);
}

main().catch(console.error);

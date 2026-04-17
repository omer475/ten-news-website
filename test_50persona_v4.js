const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';
const FEED_URL = 'https://www.tennews.ai/api/feed/main';
const TRACK_URL = 'https://www.tennews.ai/api/analytics/track';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 50 PERSONAS — ENTITY-LEVEL INTEREST WEIGHTS
//
// Users select subtopics at onboarding. But their REAL interests
// are specific ENTITIES — "premier league" not "soccer".
//
// Each entity has a hidden weight (0.0-1.0) controlling behavior.
// The algorithm must discover these from engagement signals.
//
// Entities are REAL tags from the article database.
// ═══════════════════════════════════════════════════════════════

const PERSONAS = [
  { name: 'Maria', country: 'brazil', onboard: ['soccer', 'movies_film', 'ai_ml'],
    entities: { 'premier league': 0.95, 'liverpool': 0.9, 'soccer': 0.7, 'champions league': 0.6, 'movies': 0.8, 'film': 0.75, 'artificial intelligence': 0.7, 'ncaa tournament': 0.1, 'baseball': 0.1, 'nfl': 0.1 },
    searches: ['premier league results', 'liverpool champions league', 'best movies 2026'] },

  { name: 'Jake', country: 'usa', onboard: ['nfl', 'ai_ml', 'gaming'],
    entities: { 'nfl': 0.9, 'football': 0.85, 'nfl draft': 0.8, 'artificial intelligence': 0.8, 'video games': 0.85, 'basketball': 0.2, 'soccer': 0.1, 'baseball': 0.15, 'college basketball': 0.2 },
    searches: ['nfl draft picks', 'chatgpt news', 'video game releases'] },

  { name: 'Emre', country: 'turkiye', onboard: ['soccer', 'f1', 'middle_east'],
    entities: { 'premier league': 0.8, 'liverpool': 0.7, 'soccer': 0.9, 'turkey': 0.85, 'iran': 0.7, 'middle east': 0.65, 'formula one': 0.8, 'mclaren': 0.6, 'baseball': 0.05, 'nba': 0.1, 'college basketball': 0.1 },
    searches: ['galatasaray transfer', 'formula one standings', 'iran news'] },

  { name: 'Fatima', country: 'turkiye', onboard: ['middle_east', 'movies_film', 'kpop_kdrama'],
    entities: { 'iran': 0.9, 'middle east': 0.85, 'israel': 0.8, 'military': 0.7, 'movies': 0.75, 'film': 0.7, 'television': 0.6, 'bts': 0.5, 'soccer': 0.2, 'nfl': 0.05 },
    searches: ['iran israel news', 'oscar nominations', 'bts concert'] },

  { name: 'Raj', country: 'india', onboard: ['ai_ml', 'cybersecurity', 'cricket'],
    entities: { 'artificial intelligence': 0.95, 'tech': 0.8, 'cybersecurity': 0.7, 'cricket': 0.6, 'india': 0.5, 'video games': 0.3, 'soccer': 0.1, 'nfl': 0.05 },
    searches: ['openai chatgpt', 'cybersecurity news', 'ipl cricket'] },

  { name: 'Sophie', country: 'france', onboard: ['movies_film', 'climate_environment', 'food_cooking'],
    entities: { 'movies': 0.9, 'film': 0.85, 'science fiction': 0.7, 'environment': 0.8, 'climate change': 0.75, 'food': 0.9, 'cooking': 0.85, 'recipe': 0.7, 'soccer': 0.15, 'nfl': 0.05 },
    searches: ['cannes film festival', 'climate change report', 'french cooking recipe'] },

  { name: 'Tom', country: 'usa', onboard: ['nba', 'nfl', 'stock_markets'],
    entities: { 'nba': 0.95, 'basketball': 0.9, 'march madness': 0.85, 'college basketball': 0.8, 'nfl': 0.7, 'football': 0.65, 'finance': 0.4, 'baseball': 0.3, 'soccer': 0.15 },
    searches: ['nba standings', 'march madness bracket', 'nfl scores'] },

  { name: 'Sarah', country: 'usa', onboard: ['ai_ml', 'mental_health', 'tv_streaming'],
    entities: { 'artificial intelligence': 0.9, 'tech': 0.75, 'mental health': 0.85, 'health': 0.6, 'television': 0.8, 'netflix': 0.75, 'streaming': 0.7, 'soccer': 0.1, 'nfl': 0.1 },
    searches: ['openai news', 'mental health therapy', 'netflix new releases'] },

  { name: 'Viktor', country: 'germany', onboard: ['war_conflict', 'european_politics', 'climate_environment'],
    entities: { 'russia': 0.9, 'putin': 0.85, 'ukraine': 0.9, 'ukraine war': 0.85, 'military': 0.7, 'politics': 0.6, 'environment': 0.5, 'climate change': 0.45, 'soccer': 0.2, 'nfl': 0.05 },
    searches: ['russia ukraine war', 'putin news', 'eu climate policy'] },

  { name: 'James', country: 'usa', onboard: ['us_politics', 'stock_markets', 'war_conflict'],
    entities: { 'donald trump': 0.9, 'politics': 0.85, 'united states': 0.8, 'government': 0.7, 'finance': 0.6, 'iran': 0.5, 'military': 0.5, 'soccer': 0.1, 'basketball': 0.15 },
    searches: ['trump news', 'us government policy', 'wall street today'] },

  { name: 'Kenji', country: 'japan', onboard: ['anime_manga', 'gaming', 'robotics_hardware'],
    entities: { 'video games': 0.9, 'entertainment': 0.6, 'japan': 0.7, 'tech': 0.65, 'science fiction': 0.8, 'television': 0.5, 'soccer': 0.1, 'basketball': 0.1, 'nfl': 0.05 },
    searches: ['video game releases', 'anime new season', 'nvidia chip'] },

  { name: 'Tyler', country: 'usa', onboard: ['movies_film', 'gaming', 'nba'],
    entities: { 'movies': 0.9, 'film': 0.85, 'science fiction': 0.8, 'video games': 0.85, 'entertainment': 0.6, 'basketball': 0.5, 'nba': 0.45, 'television': 0.4, 'soccer': 0.1 },
    searches: ['oscar winners 2026', 'ps5 new games', 'nba highlights'] },

  { name: 'Nadia', country: 'turkiye', onboard: ['middle_east', 'war_conflict', 'oil_energy'],
    entities: { 'iran': 0.95, 'middle east': 0.9, 'military': 0.85, 'israel': 0.8, 'strait of hormuz': 0.7, 'oil prices': 0.8, 'turkey': 0.7, 'russia': 0.5, 'soccer': 0.3, 'nfl': 0.05 },
    searches: ['iran military news', 'oil prices opec', 'middle east conflict'] },

  { name: 'Pedro', country: 'brazil', onboard: ['soccer', 'f1', 'boxing_mma'],
    entities: { 'soccer': 0.95, 'premier league': 0.8, 'champions league': 0.75, 'formula one': 0.7, 'mclaren': 0.5, 'sports': 0.4, 'baseball': 0.15, 'basketball': 0.2, 'nfl': 0.1 },
    searches: ['champions league draw', 'formula one race results', 'premier league standings'] },

  { name: 'Yara', country: 'turkiye', onboard: ['movies_film', 'kpop_kdrama', 'beauty_skincare'],
    entities: { 'movies': 0.85, 'film': 0.8, 'television': 0.9, 'bts': 0.7, 'entertainment': 0.6, 'beauty': 0.5, 'fashion': 0.45, 'soccer': 0.15, 'politics': 0.2 },
    searches: ['best movies 2026', 'bts new album', 'korean skincare routine'] },

  { name: 'Ahmed', country: 'turkiye', onboard: ['soccer', 'middle_east', 'bitcoin'],
    entities: { 'soccer': 0.9, 'turkey': 0.85, 'premier league': 0.7, 'iran': 0.75, 'middle east': 0.7, 'cryptocurrency': 0.5, 'oil prices': 0.4, 'basketball': 0.1, 'nfl': 0.1 },
    searches: ['turkey football', 'iran news', 'bitcoin price'] },

  { name: 'Carlos', country: 'spain', onboard: ['soccer', 'tennis', 'movies_film'],
    entities: { 'soccer': 0.95, 'premier league': 0.85, 'champions league': 0.8, 'sports': 0.5, 'movies': 0.65, 'film': 0.6, 'entertainment': 0.4, 'baseball': 0.1, 'nfl': 0.1 },
    searches: ['la liga results', 'champions league highlights', 'best films'] },

  { name: 'David', country: 'usa', onboard: ['ai_ml', 'space_tech', 'gaming'],
    entities: { 'artificial intelligence': 0.9, 'tech': 0.8, 'video games': 0.85, 'science fiction': 0.6, 'entertainment': 0.4, 'basketball': 0.3, 'soccer': 0.1, 'nfl': 0.15 },
    searches: ['spacex launch', 'ai news', 'video game reviews'] },

  { name: 'Anna', country: 'germany', onboard: ['climate_environment', 'european_politics', 'food_cooking'],
    entities: { 'environment': 0.9, 'climate change': 0.85, 'politics': 0.7, 'food': 0.85, 'cooking': 0.8, 'recipe': 0.7, 'health': 0.5, 'germany': 0.6, 'soccer': 0.2, 'nfl': 0.05 },
    searches: ['climate change report', 'eu green deal', 'easy cooking recipe'] },

  { name: 'Michael', country: 'usa', onboard: ['stock_markets', 'bitcoin', 'ai_ml'],
    entities: { 'finance': 0.9, 'economics': 0.7, 'cryptocurrency': 0.8, 'artificial intelligence': 0.75, 'tech': 0.6, 'business': 0.65, 'oil prices': 0.4, 'nfl': 0.3, 'basketball': 0.2 },
    searches: ['nasdaq stock market', 'bitcoin price', 'openai valuation'] },

  { name: 'Alex', country: 'uk', onboard: ['bitcoin', 'defi_web3', 'soccer'],
    entities: { 'cryptocurrency': 0.9, 'finance': 0.6, 'premier league': 0.7, 'liverpool': 0.6, 'soccer': 0.65, 'tech': 0.4, 'oil prices': 0.3, 'basketball': 0.1, 'nfl': 0.1 },
    searches: ['crypto news', 'defi yields', 'premier league results'] },

  { name: 'Omar', country: 'turkiye', onboard: ['oil_energy', 'middle_east', 'soccer'],
    entities: { 'oil prices': 0.9, 'iran': 0.85, 'middle east': 0.8, 'military': 0.65, 'strait of hormuz': 0.7, 'soccer': 0.6, 'turkey': 0.55, 'business': 0.4, 'nfl': 0.05 },
    searches: ['opec oil prices', 'iran oil', 'turkey football'] },

  { name: 'Neil', country: 'usa', onboard: ['space_astronomy', 'space_tech', 'climate_environment'],
    entities: { 'science': 0.8, 'environment': 0.7, 'climate change': 0.65, 'artificial intelligence': 0.5, 'tech': 0.45, 'astronomy': 0.9, 'health': 0.3, 'soccer': 0.1, 'nfl': 0.15 },
    searches: ['james webb telescope', 'spacex starship', 'climate science'] },

  { name: 'Laura', country: 'germany', onboard: ['medical_breakthroughs', 'ai_ml', 'biology_nature'],
    entities: { 'health': 0.9, 'cancer': 0.8, 'artificial intelligence': 0.75, 'science': 0.7, 'environment': 0.5, 'mental health': 0.4, 'politics': 0.3, 'soccer': 0.1, 'nfl': 0.05 },
    searches: ['cancer treatment breakthrough', 'ai medical research', 'health science'] },

  { name: 'Jessica', country: 'usa', onboard: ['fitness_workout', 'mental_health', 'tv_streaming'],
    entities: { 'health': 0.9, 'mental health': 0.85, 'exercise': 0.7, 'television': 0.75, 'netflix': 0.7, 'streaming': 0.6, 'food': 0.5, 'entertainment': 0.4, 'soccer': 0.1, 'nfl': 0.15 },
    searches: ['workout routine', 'anxiety treatment', 'netflix new releases'] },

  { name: 'Wei', country: 'japan', onboard: ['robotics_hardware', 'ai_ml', 'asian_politics'],
    entities: { 'tech': 0.9, 'artificial intelligence': 0.85, 'nvidia': 0.7, 'japan': 0.6, 'china': 0.5, 'video games': 0.4, 'science': 0.3, 'soccer': 0.1, 'nfl': 0.05 },
    searches: ['nvidia semiconductor', 'ai chip news', 'japan technology'] },

  { name: 'Mia', country: 'france', onboard: ['movies_film', 'european_politics', 'food_cooking'],
    entities: { 'movies': 0.9, 'film': 0.85, 'politics': 0.7, 'food': 0.85, 'cooking': 0.8, 'fashion': 0.5, 'environment': 0.4, 'entertainment': 0.6, 'soccer': 0.15 },
    searches: ['cannes 2026', 'eu politics', 'french cuisine recipe'] },

  { name: 'Robert', country: 'usa', onboard: ['automotive', 'us_politics', 'stock_markets'],
    entities: { 'automotive': 0.8, 'business': 0.7, 'donald trump': 0.85, 'politics': 0.8, 'united states': 0.7, 'finance': 0.6, 'oil prices': 0.5, 'nfl': 0.4, 'soccer': 0.1 },
    searches: ['tesla electric vehicle', 'trump policy news', 'dow jones today'] },

  { name: 'Liam', country: 'uk', onboard: ['soccer', 'comedy', 'music'],
    entities: { 'premier league': 0.95, 'liverpool': 0.9, 'soccer': 0.8, 'champions league': 0.7, 'comedy': 0.6, 'music': 0.7, 'entertainment': 0.5, 'television': 0.4, 'nfl': 0.05 },
    searches: ['premier league results', 'comedy special netflix', 'new music albums'] },

  { name: 'Diego', country: 'mexico', onboard: ['soccer', 'us_politics', 'food_cooking'],
    entities: { 'soccer': 0.9, 'premier league': 0.7, 'donald trump': 0.75, 'politics': 0.6, 'united states': 0.5, 'food': 0.8, 'cooking': 0.7, 'music': 0.4, 'basketball': 0.2 },
    searches: ['soccer highlights', 'trump mexico news', 'mexican food recipe'] },

  { name: 'Marco', country: 'france', onboard: ['oil_energy', 'european_politics', 'soccer'],
    entities: { 'oil prices': 0.85, 'energy': 0.7, 'politics': 0.8, 'soccer': 0.7, 'premier league': 0.5, 'business': 0.6, 'food': 0.5, 'environment': 0.4, 'nfl': 0.05 },
    searches: ['oil prices europe', 'eu summit news', 'ligue 1 results'] },

  { name: 'Rachel', country: 'usa', onboard: ['us_politics', 'mental_health', 'tv_streaming'],
    entities: { 'politics': 0.85, 'donald trump': 0.8, 'united states': 0.7, 'mental health': 0.9, 'health': 0.7, 'television': 0.75, 'netflix': 0.6, 'crime': 0.4, 'soccer': 0.1 },
    searches: ['biden policy news', 'therapy mental health', 'hbo new series'] },

  { name: 'Lisa', country: 'australia', onboard: ['pets_animals', 'travel_adventure', 'cricket'],
    entities: { 'cricket': 0.7, 'australia': 0.6, 'travel': 0.8, 'tourism': 0.7, 'health': 0.4, 'science': 0.3, 'sports': 0.5, 'food': 0.4, 'soccer': 0.15, 'nfl': 0.05 },
    searches: ['cricket ashes', 'best travel destinations', 'australia tourism'] },

  { name: 'Eric', country: 'usa', onboard: ['war_conflict', 'nfl', 'ai_ml'],
    entities: { 'iran': 0.85, 'military': 0.8, 'middle east': 0.75, 'israel': 0.7, 'nfl': 0.8, 'football': 0.7, 'artificial intelligence': 0.65, 'tech': 0.5, 'soccer': 0.2 },
    searches: ['iran military conflict', 'nfl playoffs', 'artificial intelligence news'] },

  { name: 'Nina', country: 'germany', onboard: ['war_conflict', 'european_politics', 'soccer'],
    entities: { 'ukraine': 0.9, 'russia': 0.85, 'putin': 0.8, 'ukraine war': 0.85, 'politics': 0.7, 'germany': 0.6, 'soccer': 0.6, 'premier league': 0.4, 'nfl': 0.05 },
    searches: ['ukraine war update', 'german elections', 'bundesliga results'] },

  { name: 'Priya', country: 'india', onboard: ['soccer', 'nba', 'ai_ml'],
    entities: { 'soccer': 0.7, 'premier league': 0.65, 'basketball': 0.8, 'nba': 0.75, 'march madness': 0.6, 'artificial intelligence': 0.5, 'india': 0.4, 'cricket': 0.3, 'nfl': 0.15 },
    searches: ['premier league scores', 'nba results', 'ai news india'] },

  { name: 'Hana', country: 'japan', onboard: ['food_cooking', 'anime_manga', 'travel_adventure'],
    entities: { 'food': 0.95, 'cooking': 0.9, 'recipe': 0.8, 'japan': 0.7, 'travel': 0.6, 'tourism': 0.5, 'entertainment': 0.4, 'television': 0.3, 'soccer': 0.1 },
    searches: ['japanese ramen recipe', 'anime new season', 'japan travel guide'] },

  { name: 'Soo-jin', country: 'japan', onboard: ['kpop_kdrama', 'beauty_skincare', 'anime_manga'],
    entities: { 'bts': 0.95, 'music': 0.8, 'entertainment': 0.7, 'television': 0.6, 'beauty': 0.7, 'fashion': 0.65, 'japan': 0.5, 'video games': 0.3, 'soccer': 0.1 },
    searches: ['bts comeback', 'korean skincare', 'anime releases'] },

  { name: 'Aisha', country: 'turkiye', onboard: ['soccer', 'middle_east', 'beauty_skincare'],
    entities: { 'soccer': 0.85, 'premier league': 0.7, 'turkey': 0.8, 'iran': 0.6, 'middle east': 0.55, 'beauty': 0.5, 'fashion': 0.4, 'movies': 0.3, 'nfl': 0.05 },
    searches: ['turkey football', 'premier league highlights', 'skincare routine'] },

  { name: 'Lucas', country: 'germany', onboard: ['gaming', 'soccer', 'ai_ml'],
    entities: { 'video games': 0.9, 'soccer': 0.8, 'premier league': 0.7, 'champions league': 0.6, 'artificial intelligence': 0.75, 'tech': 0.5, 'entertainment': 0.4, 'movies': 0.35, 'nfl': 0.1 },
    searches: ['ps5 new games', 'champions league results', 'openai update'] },

  { name: 'Henrik', country: 'germany', onboard: ['soccer', 'f1', 'european_politics'],
    entities: { 'soccer': 0.9, 'premier league': 0.8, 'formula one': 0.7, 'mclaren': 0.5, 'politics': 0.65, 'germany': 0.5, 'automotive': 0.4, 'nfl': 0.05, 'basketball': 0.1 },
    searches: ['bundesliga results', 'formula one race', 'eu policy news'] },

  { name: 'Chioma', country: 'usa', onboard: ['afrobeats', 'celebrity_news', 'nba'],
    entities: { 'music': 0.85, 'entertainment': 0.8, 'basketball': 0.6, 'nba': 0.55, 'television': 0.5, 'beauty': 0.45, 'fashion': 0.5, 'crime': 0.3, 'soccer': 0.15 },
    searches: ['music awards', 'celebrity gossip', 'nba highlights'] },

  { name: 'Greta', country: 'germany', onboard: ['climate_environment', 'biology_nature', 'european_politics'],
    entities: { 'environment': 0.95, 'climate change': 0.9, 'science': 0.8, 'health': 0.5, 'politics': 0.6, 'germany': 0.45, 'food': 0.3, 'soccer': 0.1, 'nfl': 0.05 },
    searches: ['climate change science', 'endangered species', 'eu green deal'] },

  { name: 'Ines', country: 'spain', onboard: ['tv_streaming', 'latin_music', 'soccer'],
    entities: { 'television': 0.9, 'netflix': 0.85, 'streaming': 0.8, 'entertainment': 0.7, 'music': 0.75, 'soccer': 0.6, 'premier league': 0.4, 'movies': 0.5, 'nfl': 0.05 },
    searches: ['netflix new releases spain', 'music awards', 'la liga results'] },

  { name: 'Tina', country: 'usa', onboard: ['ai_ml', 'startups_vc', 'movies_film'],
    entities: { 'artificial intelligence': 0.9, 'tech': 0.8, 'business': 0.7, 'movies': 0.6, 'film': 0.55, 'entertainment': 0.4, 'finance': 0.5, 'soccer': 0.1, 'nfl': 0.15 },
    searches: ['ai startup funding', 'openai valuation', 'best films 2026'] },

  { name: 'Dmitri', country: 'germany', onboard: ['war_conflict', 'asian_politics', 'ai_ml'],
    entities: { 'russia': 0.9, 'putin': 0.85, 'ukraine': 0.8, 'ukraine war': 0.75, 'china': 0.7, 'artificial intelligence': 0.8, 'military': 0.65, 'politics': 0.5, 'soccer': 0.15 },
    searches: ['russia news', 'china geopolitics', 'ai deep learning'] },

  { name: 'Kim', country: 'japan', onboard: ['beauty_skincare', 'kpop_kdrama', 'food_cooking'],
    entities: { 'beauty': 0.9, 'fashion': 0.8, 'bts': 0.85, 'music': 0.6, 'food': 0.8, 'cooking': 0.7, 'japan': 0.5, 'entertainment': 0.5, 'television': 0.4 },
    searches: ['korean skincare routine', 'bts comeback', 'japanese cooking'] },

  { name: 'Yuki', country: 'japan', onboard: ['baseball', 'anime_manga', 'robotics_hardware'],
    entities: { 'baseball': 0.9, 'mlb': 0.85, 'japan': 0.7, 'video games': 0.6, 'tech': 0.5, 'science': 0.4, 'entertainment': 0.35, 'soccer': 0.15, 'nfl': 0.1 },
    searches: ['mlb standings japan', 'anime new season', 'robot technology'] },

  { name: 'Aiden', country: 'australia', onboard: ['cricket', 'climate_environment', 'movies_film'],
    entities: { 'cricket': 0.9, 'australia': 0.7, 'environment': 0.65, 'climate change': 0.6, 'movies': 0.7, 'film': 0.6, 'sports': 0.4, 'science': 0.3, 'soccer': 0.2 },
    searches: ['ashes cricket', 'australia climate', 'best films 2026'] },
];

// ═══════════════════════════════════════════════════════
// SUBTOPIC → ALIAS MAP
// ═══════════════════════════════════════════════════════
const SUBTOPIC_ALIAS = {
  'soccer': 'soccer', 'nfl': 'nfl', 'nba': 'nba', 'baseball': 'baseball',
  'cricket': 'cricket', 'f1': 'f1', 'boxing_mma': 'boxing_mma', 'tennis': 'tennis',
  'movies_film': 'movies_film', 'tv_streaming': 'tv_streaming', 'music': 'music',
  'gaming': 'gaming', 'celebrity_news': 'celebrity_news', 'kpop_kdrama': 'kpop_kdrama',
  'anime_manga': 'anime_manga', 'hip_hop': 'hip_hop', 'afrobeats': 'afrobeats',
  'latin_music': 'latin_music', 'comedy': 'comedy',
  'ai_ml': 'ai_ml', 'cybersecurity': 'cybersecurity', 'space_tech': 'space_tech',
  'robotics_hardware': 'robotics_hardware', 'social_media': 'social_media',
  'space_astronomy': 'space_astronomy', 'climate_environment': 'climate_environment',
  'biology_nature': 'biology_nature',
  'medical_breakthroughs': 'medical_breakthroughs', 'mental_health': 'mental_health',
  'public_health': 'public_health',
  'stock_markets': 'stock_markets', 'bitcoin': 'bitcoin', 'defi_web3': 'defi_web3',
  'us_politics': 'us_politics', 'european_politics': 'european_politics',
  'asian_politics': 'asian_politics', 'middle_east': 'middle_east',
  'war_conflict': 'war_conflict',
  'oil_energy': 'oil_energy', 'automotive': 'automotive', 'startups_vc': 'startups_vc',
  'food_cooking': 'food_cooking', 'travel_adventure': 'travel_adventure',
  'fitness_workout': 'fitness_workout', 'beauty_skincare': 'beauty_skincare',
  'parenting_family': 'parenting_family', 'pets_animals': 'pets_animals',
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getEntityMatch(article, entities) {
  const tags = Array.isArray(article.interest_tags) ? article.interest_tags : [];
  let bestEntity = null, bestWeight = 0;
  for (const tag of tags) {
    const tl = tag.toLowerCase();
    for (const [entity, weight] of Object.entries(entities)) {
      if (tl.includes(entity) || entity.includes(tl)) {
        if (weight > bestWeight) { bestEntity = entity; bestWeight = weight; }
      }
    }
  }
  return { entity: bestEntity, weight: bestWeight };
}

async function trackEvent(userId, eventType, articleId, metadata = {}) {
  try {
    await fetch(TRACK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, article_id: articleId || undefined, user_id: userId, guest_device_id: userId, metadata })
    });
  } catch (_) {}
}

async function fetchFeed(userId, topics, country, cursor = null, engaged = [], skipped = []) {
  let url = `${FEED_URL}?user_id=${userId}&followed_topics=${topics.join(',')}&home_country=${country}&limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engaged.length) url += `&engaged_ids=${engaged.slice(-50).join(',')}`;
  if (skipped.length) url += `&skipped_ids=${skipped.slice(-50).join(',')}`;
  try { const r = await fetch(url); return await r.json(); } catch (e) { return { articles: [], next_cursor: null }; }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ═══════════════════════════════════════════════════════
// RUN ONE PERSONA
// ═══════════════════════════════════════════════════════

async function runPersona(persona, index) {
  const userId = generateUUID();
  const email = `test_v4_${persona.name.toLowerCase()}_${index}@tennews.test`;
  const aliases = persona.onboard.map(s => SUBTOPIC_ALIAS[s] || s).slice(0, 9);

  const sortedEntities = Object.entries(persona.entities).sort((a, b) => b[1] - a[1]);
  const highEntities = sortedEntities.filter(([, w]) => w >= 0.7).map(([e]) => e);

  console.log(`\n[${index+1}/50] ${persona.name} (${persona.country})`);
  console.log(`  Onboard: [${persona.onboard.join(', ')}]`);
  console.log(`  Top entities: ${sortedEntities.slice(0, 5).map(([e, w]) => `${e}(${w})`).join(', ')}`);

  const { error: createErr } = await supabase.from('users').upsert({
    id: userId, email, home_country: persona.country,
    followed_countries: [persona.country], followed_topics: aliases
  }, { onConflict: 'id' });

  if (createErr) { console.log(`  ERROR: ${createErr.message}`); return { persona: persona.name, error: createErr.message }; }

  // Initialize taste_vector from THIS PERSONA'S subtopics only (like real onboarding)
  // Map onboard aliases to subtopic names
  const ALIAS_TO_SUBTOPIC = {
    'soccer': ['Soccer/Football'], 'nfl': ['NFL'], 'nba': ['NBA'], 'baseball': ['MLB/Baseball'],
    'cricket': ['Cricket'], 'f1': ['F1 & Motorsport'], 'boxing_mma': ['Boxing & MMA/UFC'],
    'tennis': ['Tennis'], 'golf': ['Golf'],
    'movies_film': ['Movies & Film'], 'tv_streaming': ['TV & Streaming'], 'music': ['Music'],
    'gaming': ['Gaming'], 'celebrity_news': ['Celebrity News'], 'kpop_kdrama': ['K-Pop & K-Drama'],
    'anime_manga': ['Anime & Manga'], 'hip_hop': ['Music'], 'afrobeats': ['Music'],
    'ai_ml': ['AI & Machine Learning'], 'cybersecurity': ['Cybersecurity'],
    'space_tech': ['Space Tech'], 'robotics_hardware': ['Robotics & Hardware'],
    'space_astronomy': ['Space & Astronomy'], 'climate_environment': ['Climate & Environment'],
    'biology_nature': ['Biology & Nature'], 'medical_breakthroughs': ['Medical Breakthroughs'],
    'mental_health': ['Mental Health'], 'public_health': ['Public Health'],
    'us_politics': ['US Politics'], 'european_politics': ['European Politics'],
    'asian_politics': ['Asian Politics'], 'middle_east': ['Middle East'],
    'war_conflict': ['War & Conflict'],
    'oil_energy': ['Oil & Energy'], 'automotive': ['Automotive'],
    'stock_markets': ['Stock Markets'], 'bitcoin': ['Bitcoin'], 'defi_web3': ['DeFi & Web3'],
    'food_cooking': ['Food & Cooking'], 'travel_adventure': ['Travel & Adventure'],
    'fitness_workout': ['Fitness & Workout'], 'beauty_skincare': ['Beauty & Skincare'],
    'pets_animals': ['Pets & Animals'], 'startups_vc': ['AI & Machine Learning'],
    'comedy': ['Comedy & Humor'], 'latin_music': ['Music'],
    'afrobeats': ['Music'],
  };
  const mySubtopics = new Set();
  for (const alias of aliases) {
    const mapped = ALIAS_TO_SUBTOPIC[alias];
    if (mapped) mapped.forEach(s => mySubtopics.add(s));
  }

  const { data: subtopicEmbs } = await supabase.from('subtopic_embeddings')
    .select('subtopic_name, embedding_minilm')
    .in('subtopic_name', [...mySubtopics]);

  if (subtopicEmbs && subtopicEmbs.length > 0) {
    const DIM = 384; const avg = new Array(DIM).fill(0); let cnt = 0;
    for (const se of subtopicEmbs) {
      // pgvector returns embedding as string "[0.1,0.2,...]" — parse it
      let emb = se.embedding_minilm;
      if (typeof emb === 'string') { try { emb = JSON.parse(emb); } catch(e) { continue; } }
      if (!emb || !Array.isArray(emb) || emb.length !== DIM) continue;
      for (let i = 0; i < DIM; i++) avg[i] += emb[i]; cnt++;
    }
    if (cnt > 0) { for (let i = 0; i < DIM; i++) avg[i] /= cnt; }
    await supabase.from('users').update({ taste_vector_minilm: avg, tag_profile: {}, skip_profile: {} }).eq('id', userId);
    console.log(`  Taste vector from ${cnt} subtopics: [${[...mySubtopics].join(', ')}]`);
  } else {
    await supabase.from('users').update({ tag_profile: {}, skip_profile: {} }).eq('id', userId);
    console.log(`  WARNING: No subtopic embeddings found for [${[...mySubtopics].join(', ')}]`);
  }

  // Searches
  for (const q of persona.searches) { await trackEvent(userId, 'search_query', null, { query: q }); await sleep(150); }
  await sleep(2500);

  // Process 5 pages
  const pages = [];
  let cursor = null;
  const allEngagedIds = [], allSkippedIds = [];
  let totalLikes = 0, totalSaves = 0, totalEngages = 0, totalSkips = 0;
  const entityHits = {};

  for (let page = 1; page <= 5; page++) {
    const feed = await fetchFeed(userId, aliases, persona.country, cursor, allEngagedIds, allSkippedIds);
    const articles = feed.articles || [];
    cursor = feed.next_cursor;

    let anyMatches = 0, highMatches = 0, pageSkips = 0, pageLikes = 0, pageEngages = 0;
    const pageEntities = new Set();

    for (const article of articles) {
      const { entity, weight } = getEntityMatch(article, persona.entities);

      if (entity) {
        anyMatches++;
        if (weight >= 0.7) highMatches++;
        pageEntities.add(entity);
        entityHits[entity] = (entityHits[entity] || 0) + 1;
      }

      // Behavior driven by entity weight (per MEGA_RAPOR):
      // Completion/dwell time is the PRIMARY signal (TikTok: 8pts)
      // Save/Share are high-value (TikTok: 6pts)
      // Like is weak (TikTok: 2pts)
      // Non-entity articles get skipped (users don't deeply engage with random content)
      if (entity && weight > 0) {
        const rand = Math.random();
        if (rand < weight * 0.08) {
          // Save — highest value action (TikTok: 5 stars, Instagram: #2 signal)
          await trackEvent(userId, 'article_saved', article.id, { dwell: String(30 + Math.random() * 30), dwell_tier: 'deep_read' });
          totalSaves++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.25) {
          // Like — weak signal but still positive (TikTok: 2pts)
          await trackEvent(userId, 'article_liked', article.id, { dwell: String(10 + weight * 15), dwell_tier: weight > 0.6 ? 'engaged_read' : 'light_read' });
          pageLikes++; totalLikes++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.65) {
          // Deep read — the KING signal (TikTok: completion=8pts, Twitter: dwell 2min=20x)
          // Dwell time proportional to interest: high weight = longer reads
          const dwellSeconds = 8 + weight * 40; // 0.9 weight = ~44 seconds
          await trackEvent(userId, 'article_engaged', article.id, { dwell: String(dwellSeconds), dwell_tier: dwellSeconds > 25 ? 'deep_read' : 'engaged_read' });
          pageEngages++; totalEngages++; allEngagedIds.push(article.id);
        } else if (rand < weight * 0.80) {
          // Glance — read headline and first few lines
          await trackEvent(userId, 'article_view', article.id, { dwell: String(3 + Math.random() * 4), dwell_tier: 'glance' });
        } else {
          // Saw it, decided not interested — deliberate skip with some dwell
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(1.5 + Math.random() * 2), dwell_tier: 'quick_skip' });
          pageSkips++; totalSkips++; allSkippedIds.push(article.id);
        }
        pageEntities.add(entity);
        entityHits[entity] = (entityHits[entity] || 0) + 1;
      } else {
        // No entity match — fast skip (didn't even read the headline properly)
        if (Math.random() < 0.10) {
          // 10% chance: glance at headline
          await trackEvent(userId, 'article_view', article.id, { dwell: '2', dwell_tier: 'glance' });
        } else {
          // 90%: instant skip
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(0.3 + Math.random() * 0.5), dwell_tier: 'instant_skip' });
          pageSkips++; totalSkips++; allSkippedIds.push(article.id);
        }
      }
      await sleep(30);
    }

    const anyPct = articles.length > 0 ? (anyMatches / articles.length * 100) : 0;
    const highPct = articles.length > 0 ? (highMatches / articles.length * 100) : 0;
    // Deep engagement = likes + engaged reads (both involve significant dwell time)
    const deepEngagePct = articles.length > 0 ? ((pageLikes + pageEngages) / articles.length * 100) : 0;
    const skipPct = articles.length > 0 ? (pageSkips / articles.length * 100) : 0;

    pages.push({ page, total: articles.length, anyMatches, highMatches, anyPct, highPct,
      likes: pageLikes, engages: pageEngages, skips: pageSkips, entityCount: pageEntities.size,
      deepEngagePct, skipPct });

    const marker = anyPct >= 50 ? '★' : anyPct >= 30 ? '▲' : anyPct >= 15 ? '·' : '✗';
    console.log(`  P${page}: ${anyPct.toFixed(0).padStart(3)}% match ${highPct.toFixed(0).padStart(3)}% high ${marker} | deep:${deepEngagePct.toFixed(0)}% skip:${skipPct.toFixed(0)}% | ${pageEntities.size} ents | L:${pageLikes} E:${pageEngages} S:${pageSkips}`);

    if (page < 5) await sleep(2500);
  }

  // Scoring
  const { data: profile } = await supabase.from('users').select('tag_profile, skip_profile').eq('id', userId).single();
  const tagCount = Object.keys(profile?.tag_profile || {}).length;

  const earlyHigh = ((pages[0]?.highPct || 0) + (pages[1]?.highPct || 0)) / 2;
  const lateHigh = ((pages[3]?.highPct || 0) + (pages[4]?.highPct || 0)) / 2;
  const highImp = lateHigh - earlyHigh;
  const earlyAny = ((pages[0]?.anyPct || 0) + (pages[1]?.anyPct || 0)) / 2;
  const lateAny = ((pages[3]?.anyPct || 0) + (pages[4]?.anyPct || 0)) / 2;
  const anyImp = lateAny - earlyAny;

  // Alignment: do high-weight entities get more feed share?
  const totalHits = Object.values(entityHits).reduce((s, v) => s + v, 0) || 1;
  let alignScore = 0, alignCount = 0;
  for (const [entity, weight] of Object.entries(persona.entities)) {
    const share = (entityHits[entity] || 0) / totalHits;
    alignScore += weight * share;
    alignCount++;
  }
  const alignment = alignCount > 0 ? (alignScore / alignCount * 100) : 0;

  const learned = highImp > 10 || (anyImp > 5 && highImp > 5);
  const softPivot = highImp > 5 || anyImp > 5;

  const result = {
    persona: persona.name, learned, softPivot,
    earlyAny: earlyAny.toFixed(1), lateAny: lateAny.toFixed(1), anyImp: anyImp.toFixed(1),
    earlyHigh: earlyHigh.toFixed(1), lateHigh: lateHigh.toFixed(1), highImp: highImp.toFixed(1),
    alignment: alignment.toFixed(1), tagCount,
    totalLikes, totalEngages, totalSkips, totalSaves,
    entityHits
  };

  const label = learned ? '✅ LEARNED' : softPivot ? '🔄 PIVOT' : '❌ FLAT';
  console.log(`  ${label} | Any: ${earlyAny.toFixed(0)}→${lateAny.toFixed(0)} (${anyImp > 0 ? '+' : ''}${anyImp.toFixed(0)}) | High: ${earlyHigh.toFixed(0)}→${lateHigh.toFixed(0)} (${highImp > 0 ? '+' : ''}${highImp.toFixed(0)}) | Align: ${alignment.toFixed(0)}%`);

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
  console.log('  50-PERSONA TEST v4 — ENTITY-LEVEL INTERESTS');
  console.log('  Users select subtopics, algorithm learns entity preferences');
  console.log('  Measures: entity match %, high-entity %, alignment score');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  for (let i = 0; i < PERSONAS.length; i += 5) {
    const batch = PERSONAS.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((p, j) => runPersona(p, i + j).catch(e => ({ persona: p.name, error: e.message })))
    );
    results.push(...batchResults);
  }

  // Analysis
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const valid = results.filter(r => !r.error);
  const learned = valid.filter(r => r.learned);
  const pivot = valid.filter(r => r.softPivot && !r.learned);
  const flat = valid.filter(r => !r.softPivot);
  const avg = (arr, fn) => arr.length > 0 ? arr.reduce((s, r) => s + fn(r), 0) / arr.length : 0;

  console.log(`Valid: ${valid.length} | Learned: ${learned.length} (${(learned.length/valid.length*100).toFixed(0)}%) | Pivot: ${pivot.length} (${(pivot.length/valid.length*100).toFixed(0)}%) | Flat: ${flat.length} (${(flat.length/valid.length*100).toFixed(0)}%)`);
  console.log(`Avg early ANY: ${avg(valid, r => parseFloat(r.earlyAny)).toFixed(1)}% → late: ${avg(valid, r => parseFloat(r.lateAny)).toFixed(1)}%`);
  console.log(`Avg early HIGH: ${avg(valid, r => parseFloat(r.earlyHigh)).toFixed(1)}% → late: ${avg(valid, r => parseFloat(r.lateHigh)).toFixed(1)}%`);
  console.log(`Avg alignment: ${avg(valid, r => parseFloat(r.alignment)).toFixed(1)}%`);
  console.log(`Avg tag_profile: ${avg(valid, r => r.tagCount).toFixed(0)} tags`);

  const learnRate = (learned.length + pivot.length) / valid.length * 100;
  let grade = learnRate >= 70 ? 'A' : learnRate >= 50 ? 'B' : learnRate >= 30 ? 'C' : learnRate >= 15 ? 'D' : 'F';
  console.log(`\n  GRADE: ${grade} (${learnRate.toFixed(0)}% improved)`);

  const sorted = [...valid].sort((a, b) => parseFloat(b.highImp) - parseFloat(a.highImp));
  console.log('\nTOP 10:');
  for (const r of sorted.slice(0, 10)) console.log(`  ${r.persona.padEnd(10)} Any:${r.earlyAny}→${r.lateAny}(${r.anyImp}) High:${r.earlyHigh}→${r.lateHigh}(${r.highImp}) Align:${r.alignment}%`);
  console.log('\nBOTTOM 10:');
  for (const r of sorted.slice(-10)) console.log(`  ${r.persona.padEnd(10)} Any:${r.earlyAny}→${r.lateAny}(${r.anyImp}) High:${r.earlyHigh}→${r.lateHigh}(${r.highImp}) Align:${r.alignment}%`);

  const errors = results.filter(r => r.error);
  if (errors.length) { console.log('\nERRORS:'); for (const e of errors) console.log(`  ${e.persona}: ${e.error}`); }
  console.log(`\nDone at ${new Date().toISOString()}`);
}

main().catch(console.error);

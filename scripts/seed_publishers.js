#!/usr/bin/env node
/**
 * Seed 104 publisher bot accounts into Supabase.
 *
 * Usage: node scripts/seed_publishers.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// Load env - try main repo first, then worktree parent
const mainEnv = path.resolve(__dirname, '..', '..', '..', '..', '.env.local');
const localEnv = path.join(__dirname, '..', '.env.local');
const fs = require('fs');
require('dotenv').config({ path: fs.existsSync(mainEnv) ? mainEnv : localEnv });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── ALL 104 PUBLISHERS ─────────────────────────────────────────────────────

const PUBLISHERS = [
  // ── POLITICS (9) ──────────────────────────────────────────────────────────
  { username: "capitoldispatch", display_name: "Capitol Dispatch", bio: "Your daily lens on Washington -- bills, battles, and everything in between.", category: "Politics", interest_tags: ["us politics", "congress", "senate", "white house", "republican", "democrat", "trump", "biden"] },
  { username: "europulse", display_name: "Euro Pulse", bio: "Tracking power shifts across the continent, from Brussels to Budapest.", category: "Politics", interest_tags: ["european politics", "eu", "european union", "brexit", "nato", "germany", "france", "uk"] },
  { username: "dragongate", display_name: "Dragon Gate", bio: "Decoding politics and power across Asia-Pacific.", category: "Politics", interest_tags: ["asian politics", "china", "india", "japan", "southeast asia", "taiwan", "north korea", "asean"] },
  { username: "crescentwire", display_name: "Crescent Wire", bio: "Middle Eastern affairs -- from the Gulf to the Levant.", category: "Politics", interest_tags: ["middle east", "iran", "israel", "saudi arabia", "palestine", "lebanon", "hezbollah", "gulf"] },
  { username: "southerncross", display_name: "Southern Cross", bio: "Latin America and the stories shaping the hemisphere.", category: "Politics", interest_tags: ["latin america", "brazil", "mexico", "argentina", "colombia", "venezuela"] },
  { username: "savannareport", display_name: "Savanna Report", bio: "Africa and Oceania: the underreported stories that matter.", category: "Politics", interest_tags: ["africa", "nigeria", "south africa", "kenya", "egypt", "australia", "oceania"] },
  { username: "warfront", display_name: "Warfront", bio: "Conflict, defense, and military intelligence -- updated as it unfolds.", category: "Politics", interest_tags: ["war", "conflict", "military", "defense", "invasion", "armed forces", "military strikes"] },
  { username: "libertybell", display_name: "Liberty Bell", bio: "Human rights, civil liberties, and the fight for freedom worldwide.", category: "Politics", interest_tags: ["human rights", "civil liberties", "freedom", "protest", "democracy", "censorship"] },
  { username: "thegloberoom", display_name: "The Globe Room", bio: "General world politics -- the big picture, every day.", category: "Politics", interest_tags: ["politics", "geopolitics", "diplomacy", "election", "government", "policy", "sanctions"] },

  // ── SPORTS (18) ───────────────────────────────────────────────────────────
  { username: "blitzreport", display_name: "Blitz Report", bio: "NFL coverage from the draft to the Super Bowl.", category: "Sports", interest_tags: ["nfl", "american football", "quarterback", "super bowl", "touchdown", "wide receiver"] },
  { username: "courtvision", display_name: "Court Vision", bio: "NBA news, trades, and analysis from tip-off to the Finals.", category: "Sports", interest_tags: ["nba", "basketball", "lakers", "celtics", "lebron", "playoffs", "dunk"] },
  { username: "thekop", display_name: "The Kop", bio: "Liverpool FC and Premier League football from Anfield and beyond.", category: "Sports", interest_tags: ["liverpool", "premier league", "anfield", "epl", "soccer", "football"] },
  { username: "pitchside", display_name: "Pitch Side", bio: "Global football: Premier League, Champions League, La Liga, and more.", category: "Sports", interest_tags: ["soccer", "football", "premier league", "champions league", "la liga", "world cup", "fifa"] },
  { username: "diamondcut", display_name: "Diamond Cut", bio: "MLB, World Series, and everything baseball.", category: "Sports", interest_tags: ["mlb", "baseball", "world series", "home run", "pitcher", "yankees"] },
  { username: "wicketwire", display_name: "Wicket Wire", bio: "Cricket from the IPL to the Ashes -- every wicket, every run.", category: "Sports", interest_tags: ["cricket", "ipl", "test match", "ashes", "t20", "bcci", "world cup cricket"] },
  { username: "gridlock", display_name: "Grid Lock", bio: "F1 and motorsport -- from pit lane to podium.", category: "Sports", interest_tags: ["f1", "formula 1", "motorsport", "grand prix", "racing", "nascar", "indycar"] },
  { username: "ringkings", display_name: "Ring Kings", bio: "Boxing, MMA, and UFC -- all the knockouts, all the drama.", category: "Sports", interest_tags: ["boxing", "mma", "ufc", "fight", "knockout", "heavyweight", "bout"] },
  { username: "torchbearer", display_name: "Torch Bearer", bio: "Olympic and Paralympic sport: the pursuit of gold.", category: "Sports", interest_tags: ["olympics", "paralympics", "olympic games", "gold medal", "ioc", "athletics"] },
  { username: "acehigh", display_name: "Ace High", bio: "Tennis: Grand Slams, ATP, WTA, and everything on court.", category: "Sports", interest_tags: ["tennis", "grand slam", "wimbledon", "us open", "atp", "wta", "roland garros"] },
  { username: "thefairway", display_name: "The Fairway", bio: "Golf from the Masters to the Ryder Cup.", category: "Sports", interest_tags: ["golf", "pga", "masters", "ryder cup", "lpga", "tiger woods", "augusta"] },
  { username: "redzone", display_name: "Red Zone", bio: "Fantasy football, picks, and NFL game day analysis.", category: "Sports", interest_tags: ["nfl", "fantasy football", "touchdowns", "draft picks", "nfl draft", "super bowl"] },
  { username: "elclasico", display_name: "El Clasico", bio: "La Liga, Real Madrid, Barcelona, and Spanish football.", category: "Sports", interest_tags: ["la liga", "real madrid", "barcelona", "spanish football", "atletico", "soccer"] },
  { username: "serieacentral", display_name: "Serie A Central", bio: "Italian football -- Serie A, Juventus, Inter, AC Milan.", category: "Sports", interest_tags: ["serie a", "juventus", "inter milan", "ac milan", "italian football", "napoli"] },
  { username: "bundesligabeat", display_name: "Bundesliga Beat", bio: "German football -- Bundesliga, Bayern, Dortmund.", category: "Sports", interest_tags: ["bundesliga", "bayern munich", "dortmund", "german football", "soccer"] },
  { username: "theruck", display_name: "The Ruck", bio: "Rugby union and league, Six Nations, World Cup.", category: "Sports", interest_tags: ["rugby", "six nations", "rugby world cup", "all blacks", "rugby union", "rugby league"] },
  { username: "hoopdreams", display_name: "Hoop Dreams", bio: "College basketball, March Madness, and NBA draft prospects.", category: "Sports", interest_tags: ["college basketball", "march madness", "ncaa", "draft", "nba draft", "basketball"] },
  { username: "transferwhisper", display_name: "Transfer Whisper", bio: "Football transfers, rumors, and deals across Europe.", category: "Sports", interest_tags: ["transfer", "transfer window", "signing", "premier league", "la liga", "deal", "soccer"] },

  // ── BUSINESS (8) ──────────────────────────────────────────────────────────
  { username: "barrelandblade", display_name: "Barrel & Blade", bio: "Oil, energy, and the forces powering the global economy.", category: "Business", interest_tags: ["oil", "energy", "opec", "natural gas", "renewable energy", "petroleum", "crude oil"] },
  { username: "torquereport", display_name: "Torque Report", bio: "Automotive news from Tesla to Toyota -- EVs, legacy, and the road ahead.", category: "Business", interest_tags: ["automotive", "cars", "tesla", "ev", "electric vehicles", "ford", "toyota"] },
  { username: "cartwatch", display_name: "Cart Watch", bio: "Retail, e-commerce, and the future of shopping.", category: "Business", interest_tags: ["retail", "amazon", "walmart", "e-commerce", "consumer", "shopping"] },
  { username: "dealsheet", display_name: "Deal Sheet", bio: "M&A, IPOs, and the biggest corporate plays.", category: "Business", interest_tags: ["merger", "acquisition", "ipo", "deal", "takeover", "corporate"] },
  { username: "tradelines", display_name: "Trade Lines", bio: "Tariffs, trade wars, and global supply chains.", category: "Business", interest_tags: ["trade", "tariffs", "sanctions", "import", "export", "trade war", "supply chain"] },
  { username: "earningscall", display_name: "Earnings Call", bio: "Quarterly results, revenue beats, and market movers.", category: "Business", interest_tags: ["earnings", "revenue", "profit", "quarterly results", "financial results", "stocks"] },
  { username: "launchpadvc", display_name: "Launchpad", bio: "Startups, venture capital, and the next unicorn.", category: "Business", interest_tags: ["startup", "venture capital", "funding", "seed round", "unicorn", "vc", "series a"] },
  { username: "propertywire", display_name: "Property Wire", bio: "Real estate, housing markets, and mortgage trends.", category: "Business", interest_tags: ["real estate", "property", "housing", "mortgage", "commercial real estate", "rent"] },

  // ── ENTERTAINMENT (12) ────────────────────────────────────────────────────
  { username: "silverscreen", display_name: "Silver Screen", bio: "Movies, box office, and cinema culture.", category: "Entertainment", interest_tags: ["movies", "film", "box office", "hollywood", "director", "oscar", "cinema"] },
  { username: "bingewatch", display_name: "Binge Watch", bio: "TV, streaming wars, and your next obsession.", category: "Entertainment", interest_tags: ["tv", "streaming", "netflix", "hbo", "disney plus", "series", "apple tv"] },
  { username: "soundcheck", display_name: "Sound Check", bio: "Music news, album drops, tours, and the Grammys.", category: "Entertainment", interest_tags: ["music", "album", "concert", "tour", "grammy", "singer", "artist"] },
  { username: "playerone", display_name: "Player One", bio: "Gaming, esports, and everything in between.", category: "Entertainment", interest_tags: ["gaming", "video games", "playstation", "xbox", "nintendo", "esports", "steam"] },
  { username: "tmzlite", display_name: "TMZ Lite", bio: "Celebrity scoops, red carpet moments, and pop culture drama.", category: "Entertainment", interest_tags: ["celebrity", "famous", "scandal", "gossip", "paparazzi", "star"] },
  { username: "hallyuwave", display_name: "Hallyu Wave", bio: "K-Pop, K-Drama, and Korean culture taking over the world.", category: "Entertainment", interest_tags: ["k-pop", "k-drama", "korean", "bts", "blackpink", "kdrama", "hallyu"] },
  { username: "bollywoodbuzz", display_name: "Bollywood Buzz", bio: "Bollywood films, stars, and the Indian entertainment scene.", category: "Entertainment", interest_tags: ["bollywood", "hindi cinema", "indian film", "bollywood stars", "tollywood"] },
  { username: "otakusignal", display_name: "Otaku Signal", bio: "Anime, manga, and Japanese pop culture.", category: "Entertainment", interest_tags: ["anime", "manga", "japanese", "shonen", "studio ghibli", "one piece", "naruto"] },
  { username: "bartalk", display_name: "Bar Talk", bio: "Hip-hop, rap culture, and the beats that move the streets.", category: "Entertainment", interest_tags: ["hip-hop", "rap", "rapper", "drake", "kendrick", "trap", "hip hop"] },
  { username: "afrobeatsdaily", display_name: "Afrobeats Daily", bio: "Afrobeats, Amapiano, and African music going global.", category: "Entertainment", interest_tags: ["afrobeats", "amapiano", "african music", "burna boy", "wizkid", "davido"] },
  { username: "reggaetonradio", display_name: "Reggaeton Radio", bio: "Latin music, reggaeton, and Latin pop.", category: "Entertainment", interest_tags: ["latin music", "reggaeton", "bad bunny", "latin pop", "bachata", "salsa"] },
  { username: "standupfeed", display_name: "Stand Up Feed", bio: "Comedy specials, stand-up tours, and funny business.", category: "Entertainment", interest_tags: ["comedy", "stand-up", "comedian", "netflix special", "saturday night live", "humor"] },

  // ── TECH (8) ──────────────────────────────────────────────────────────────
  { username: "siliconpulse", display_name: "Silicon Pulse", bio: "AI, machine learning, and the models reshaping everything.", category: "Tech", interest_tags: ["ai", "artificial intelligence", "machine learning", "chatgpt", "openai", "llm", "deep learning"] },
  { username: "pocketrocket", display_name: "Pocket Rocket", bio: "Smartphones, gadgets, and the tech in your pocket.", category: "Tech", interest_tags: ["smartphone", "iphone", "samsung", "pixel", "apple", "android", "gadget", "wearable"] },
  { username: "trendingnow", display_name: "Trending Now", bio: "Social media platforms, creators, and the trends that break the internet.", category: "Tech", interest_tags: ["social media", "twitter", "instagram", "tiktok", "meta", "x", "youtube"] },
  { username: "firewallhq", display_name: "Firewall", bio: "Cybersecurity, data breaches, and digital defense.", category: "Tech", interest_tags: ["cybersecurity", "hacking", "data breach", "ransomware", "privacy", "encryption"] },
  { username: "launchpadspace", display_name: "Launch Pad", bio: "Space tech: rockets, satellites, and the new frontier.", category: "Tech", interest_tags: ["space tech", "spacex", "nasa", "rocket", "satellite", "starship", "blue origin"] },
  { username: "chipshot", display_name: "Chip Shot", bio: "Semiconductors, robotics, and hardware powering the future.", category: "Tech", interest_tags: ["robotics", "semiconductor", "nvidia", "chip", "processor", "hardware", "tsmc"] },
  { username: "codesignal", display_name: "Code Signal", bio: "Software, programming, and developer culture.", category: "Tech", interest_tags: ["software", "programming", "developer", "open source", "github", "javascript", "python"] },
  { username: "bigtechwatch", display_name: "Big Tech Watch", bio: "Apple, Google, Meta, Amazon, Microsoft -- tracking the giants.", category: "Tech", interest_tags: ["apple", "google", "meta", "amazon", "microsoft", "big tech", "antitrust"] },

  // ── SCIENCE (5) ───────────────────────────────────────────────────────────
  { username: "cosmosdeep", display_name: "Cosmos", bio: "The universe: astronomy, telescopes, and the great beyond.", category: "Science", interest_tags: ["space", "astronomy", "nasa", "mars", "telescope", "galaxy", "planet", "asteroid"] },
  { username: "greenwire", display_name: "Green Wire", bio: "Climate change, sustainability, and the fight for the planet.", category: "Science", interest_tags: ["climate", "environment", "global warming", "carbon", "emissions", "climate change"] },
  { username: "naturedesk", display_name: "Nature Desk", bio: "Biology, wildlife, genetics, and the living world.", category: "Science", interest_tags: ["biology", "nature", "wildlife", "genetics", "evolution", "species", "ecosystem"] },
  { username: "quakewatch", display_name: "Quake Watch", bio: "Earth science: earthquakes, volcanoes, extreme weather.", category: "Science", interest_tags: ["earth science", "earthquake", "volcano", "weather", "ocean", "geology", "hurricane"] },
  { username: "labnotes", display_name: "Lab Notes", bio: "General science breakthroughs and research you should know about.", category: "Science", interest_tags: ["science", "research", "discovery", "physics", "chemistry", "experiment", "study"] },

  // ── HEALTH (5) ────────────────────────────────────────────────────────────
  { username: "pulsecheck", display_name: "Pulse Check", bio: "Medical breakthroughs, treatments, and the future of medicine.", category: "Health", interest_tags: ["medical", "breakthrough", "treatment", "cure", "clinical trial", "surgery"] },
  { username: "pubhealthwire", display_name: "Public Health Wire", bio: "Pandemics, vaccines, and global health crises.", category: "Health", interest_tags: ["public health", "pandemic", "vaccine", "cdc", "who", "outbreak", "disease"] },
  { username: "mindmatters", display_name: "Mind Matters", bio: "Mental health, therapy, and the science of wellbeing.", category: "Health", interest_tags: ["mental health", "anxiety", "depression", "therapy", "mindfulness", "wellbeing"] },
  { username: "pharmawatch", display_name: "Pharma Watch", bio: "Drug approvals, biotech, and the pharmaceutical industry.", category: "Health", interest_tags: ["pharma", "pharmaceutical", "fda", "biotech", "drug", "medication", "clinical trial"] },
  { username: "fitreport", display_name: "Fit Report", bio: "Fitness, nutrition, and the science of staying healthy.", category: "Health", interest_tags: ["fitness", "nutrition", "exercise", "diet", "workout", "health", "wellness"] },

  // ── FINANCE (6) ───────────────────────────────────────────────────────────
  { username: "bullandbear", display_name: "Bull & Bear", bio: "Stock market moves, Wall Street analysis, and trading signals.", category: "Finance", interest_tags: ["stock market", "wall street", "nasdaq", "sp500", "dow jones", "shares", "trading"] },
  { username: "ratewatch", display_name: "Rate Watch", bio: "Central banks, interest rates, and monetary policy.", category: "Finance", interest_tags: ["banking", "interest rate", "federal reserve", "loan", "credit", "inflation", "ecb"] },
  { username: "commoditydesk", display_name: "Commodity Desk", bio: "Gold, oil, copper -- tracking the raw materials that move markets.", category: "Finance", interest_tags: ["commodities", "gold", "silver", "oil price", "futures", "copper", "commodity"] },
  { username: "theledger", display_name: "The Ledger", bio: "Personal finance, investing tips, and building wealth.", category: "Finance", interest_tags: ["personal finance", "investing", "savings", "retirement", "401k", "portfolio"] },
  { username: "forexflash", display_name: "Forex Flash", bio: "Currency markets, forex pairs, and global FX moves.", category: "Finance", interest_tags: ["forex", "currency", "dollar", "euro", "yen", "exchange rate", "fx"] },
  { username: "ipoinsider", display_name: "IPO Insider", bio: "IPOs, SPACs, and companies going public.", category: "Finance", interest_tags: ["ipo", "spac", "public offering", "listing", "stock debut", "valuation"] },

  // ── CRYPTO (5) ────────────────────────────────────────────────────────────
  { username: "satoshisignal", display_name: "Satoshi Signal", bio: "Bitcoin: price, mining, halvings, and the original cryptocurrency.", category: "Crypto", interest_tags: ["bitcoin", "btc", "satoshi", "mining", "halving", "crypto"] },
  { username: "defidegen", display_name: "DeFi Degen", bio: "DeFi protocols, yield farming, and the decentralized frontier.", category: "Crypto", interest_tags: ["defi", "web3", "blockchain", "smart contract", "dao", "decentralized", "ethereum"] },
  { username: "cryptocourt", display_name: "Crypto Court", bio: "Crypto regulation, SEC battles, and legal drama.", category: "Crypto", interest_tags: ["crypto regulation", "sec", "crypto law", "crypto ban", "cryptocurrency", "compliance"] },
  { username: "altseason", display_name: "Alt Season", bio: "Altcoins, meme coins, and the wild side of crypto.", category: "Crypto", interest_tags: ["altcoin", "ethereum", "solana", "meme coin", "dogecoin", "nft", "crypto"] },
  { username: "chainbrief", display_name: "Chain Brief", bio: "Blockchain technology, Web3 development, and infrastructure.", category: "Crypto", interest_tags: ["blockchain", "web3", "layer 2", "rollup", "crypto", "protocol", "token"] },

  // ── LIFESTYLE (5) ─────────────────────────────────────────────────────────
  { username: "pawsandclaws", display_name: "Paws & Claws", bio: "Pets, animals, and heartwarming stories from the animal kingdom.", category: "Lifestyle", interest_tags: ["pets", "animals", "dog", "cat", "veterinary", "adoption", "wildlife"] },
  { username: "nesthome", display_name: "Nest", bio: "Home design, DIY projects, and making your space beautiful.", category: "Lifestyle", interest_tags: ["home", "garden", "diy", "renovation", "decor", "interior design", "landscaping"] },
  { username: "cartsmart", display_name: "Cart Smart", bio: "Product reviews, deals, and smart shopping finds.", category: "Lifestyle", interest_tags: ["shopping", "product review", "deal", "discount", "gadget review", "best buy"] },
  { username: "plateandpour", display_name: "Plate & Pour", bio: "Food, recipes, restaurants, and culinary culture.", category: "Lifestyle", interest_tags: ["food", "recipe", "restaurant", "cooking", "chef", "cuisine", "dining"] },
  { username: "wanderlusthq", display_name: "Wanderlust", bio: "Travel destinations, tips, and adventures around the world.", category: "Lifestyle", interest_tags: ["travel", "destination", "flight", "hotel", "tourism", "vacation", "adventure"] },

  // ── FASHION (4) ───────────────────────────────────────────────────────────
  { username: "dropalert", display_name: "Drop Alert", bio: "Sneakers, streetwear, and the drops you cannot miss.", category: "Fashion", interest_tags: ["sneakers", "streetwear", "nike", "adidas", "jordan", "yeezy", "drop"] },
  { username: "redcarpethq", display_name: "Red Carpet", bio: "Celebrity style, Met Gala, and fashion's biggest moments.", category: "Fashion", interest_tags: ["celebrity style", "red carpet", "met gala", "fashion", "outfit", "best dressed"] },
  { username: "hautetoday", display_name: "Haute Today", bio: "High fashion, luxury brands, and runway culture.", category: "Fashion", interest_tags: ["fashion", "luxury", "gucci", "louis vuitton", "runway", "couture", "designer"] },
  { username: "streetfit", display_name: "Street Fit", bio: "Everyday style, streetwear culture, and fit inspiration.", category: "Fashion", interest_tags: ["streetwear", "fashion", "outfit", "style", "clothing", "brand", "collaboration"] },

  // ── SPORTS TEAMS (10) ─────────────────────────────────────────────────────
  { username: "bronxbombers", display_name: "Bronx Bombers", bio: "New York Yankees coverage -- from Spring Training to October.", category: "Sports", interest_tags: ["yankees", "new york yankees", "mlb", "baseball", "bronx", "aaron judge"] },
  { username: "lakeshow", display_name: "Lake Show", bio: "Los Angeles Lakers -- Showtime, always.", category: "Sports", interest_tags: ["lakers", "los angeles lakers", "nba", "basketball", "lebron", "la"] },
  { username: "thebootroom", display_name: "The Boot Room", bio: "Manchester United FC from Old Trafford.", category: "Sports", interest_tags: ["manchester united", "man utd", "premier league", "old trafford", "epl", "soccer"] },
  { username: "campnoudigest", display_name: "Camp Nou Digest", bio: "FC Barcelona news and La Liga updates.", category: "Sports", interest_tags: ["barcelona", "barca", "la liga", "camp nou", "spanish football", "soccer"] },
  { username: "bernabeubrief", display_name: "Bernabeu Brief", bio: "Real Madrid and the white empire.", category: "Sports", interest_tags: ["real madrid", "bernabeu", "la liga", "champions league", "soccer", "hala madrid"] },
  { username: "gunnersgazette", display_name: "Gunners Gazette", bio: "Arsenal FC -- North London is red.", category: "Sports", interest_tags: ["arsenal", "gunners", "premier league", "emirates", "epl", "soccer"] },
  { username: "bluelockfc", display_name: "Blue Lock", bio: "Chelsea FC coverage from Stamford Bridge.", category: "Sports", interest_tags: ["chelsea", "stamford bridge", "premier league", "epl", "soccer", "blues"] },
  { username: "dabears", display_name: "Da Bears", bio: "Chicago sports: Bears, Bulls, Cubs, and the Windy City.", category: "Sports", interest_tags: ["chicago bears", "chicago bulls", "cubs", "nfl", "nba", "mlb", "chicago"] },
  { username: "bayareaball", display_name: "Bay Area Ball", bio: "Golden State Warriors and Bay Area sports.", category: "Sports", interest_tags: ["warriors", "golden state", "nba", "basketball", "stephen curry", "bay area"] },
  { username: "lonestargrid", display_name: "Lone Star Gridiron", bio: "Dallas Cowboys and Texas football.", category: "Sports", interest_tags: ["dallas cowboys", "cowboys", "nfl", "texas football", "americas team", "nfc east"] },

  // ── TECH COMPANIES (4) ────────────────────────────────────────────────────
  { username: "cupertinoinsider", display_name: "Cupertino Insider", bio: "Apple: iPhone, Mac, Vision Pro, and the ecosystem.", category: "Tech", interest_tags: ["apple", "iphone", "mac", "vision pro", "wwdc", "ios", "macos", "apple watch"] },
  { username: "openaiwatch", display_name: "OpenAI Watch", bio: "OpenAI, ChatGPT, GPT, and the AI race.", category: "Tech", interest_tags: ["openai", "chatgpt", "gpt", "ai", "artificial intelligence", "sam altman", "llm"] },
  { username: "teslatracker", display_name: "Tesla Tracker", bio: "Tesla, Elon Musk, and the EV revolution.", category: "Tech", interest_tags: ["tesla", "elon musk", "ev", "electric vehicle", "cybertruck", "autopilot", "spacex"] },
  { username: "nvidiacore", display_name: "Nvidia Core", bio: "Nvidia, GPUs, and the AI hardware arms race.", category: "Tech", interest_tags: ["nvidia", "gpu", "graphics card", "cuda", "jensen huang", "ai chip", "rtx"] },

  // ── GEO/THEMATIC (5) ─────────────────────────────────────────────────────
  { username: "indiaink", display_name: "India Ink", bio: "India: politics, cricket, Bollywood, and 1.4 billion stories.", category: "Politics", interest_tags: ["india", "modi", "bjp", "cricket", "bollywood", "delhi", "mumbai"] },
  { username: "chinabrief", display_name: "China Brief", bio: "China's politics, economy, and global ambitions.", category: "Politics", interest_tags: ["china", "beijing", "xi jinping", "chinese", "taiwan", "south china sea"] },
  { username: "ukrainefront", display_name: "Ukraine Front", bio: "Ukraine conflict: frontline updates and analysis.", category: "Politics", interest_tags: ["ukraine", "russia", "zelensky", "kyiv", "war", "frontline", "donbas", "crimea"] },
  { username: "climateaction", display_name: "Climate Action", bio: "Climate policy, COP summits, and the energy transition.", category: "Science", interest_tags: ["climate change", "cop", "paris agreement", "renewable energy", "net zero", "carbon"] },
  { username: "pandemicwatch", display_name: "Pandemic Watch", bio: "Infectious disease outbreaks, WHO alerts, and global health security.", category: "Health", interest_tags: ["pandemic", "outbreak", "virus", "who", "epidemic", "bird flu", "covid", "mpox"] },
];

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function seedPublishers() {
  console.log(`\nSeeding ${PUBLISHERS.length} publisher accounts...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const pub of PUBLISHERS) {
    const email = `bot-${pub.username}@tennews.ai`;
    const password = crypto.randomBytes(32).toString('hex');

    try {
      // Check if publisher already exists
      const { data: existing } = await supabase
        .from('publishers')
        .select('id')
        .eq('username', pub.username)
        .single();

      if (existing) {
        console.log(`  SKIP  ${pub.display_name} (@${pub.username}) — already exists`);
        skipped++;
        continue;
      }

      // 1. Create auth user (admin API, auto-confirms email)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: pub.display_name, is_bot: true }
      });

      if (authError) {
        // If user already exists in auth but not in publishers, try to find and use them
        if (authError.message.includes('already') || authError.message.includes('exists')) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existingUser = users?.find(u => u.email === email);
          if (existingUser) {
            // Just create the publisher entry
            await ensureProfile(existingUser.id, email, pub.display_name);
            await createPublisherEntry(existingUser.id, pub);
            console.log(`  OK    ${pub.display_name} (@${pub.username}) — linked to existing auth user`);
            created++;
            continue;
          }
        }
        throw new Error(`Auth: ${authError.message}`);
      }

      const userId = authData.user.id;

      // 2. Ensure profile exists
      await ensureProfile(userId, email, pub.display_name);

      // 3. Create publisher entry
      await createPublisherEntry(userId, pub);

      console.log(`  OK    ${pub.display_name} (@${pub.username})`);
      created++;

      // Small delay to avoid rate limits
      await sleep(100);

    } catch (err) {
      console.error(`  FAIL  ${pub.display_name} (@${pub.username}): ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Total publishers in DB: ${created + skipped}`);
}

async function ensureProfile(userId, email, displayName) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: displayName,
    display_name: displayName,
    created_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (error) {
    console.warn(`    Profile upsert warning: ${error.message}`);
  }
}

async function createPublisherEntry(userId, pub) {
  const { error } = await supabase.from('publishers').insert({
    id: userId,
    username: pub.username,
    display_name: pub.display_name,
    bio: pub.bio,
    category: pub.category,
    interest_tags: pub.interest_tags,
    is_verified: true,
    is_bot: true,
    follower_count: 0,
    article_count: 0
  });

  if (error) throw new Error(`Publisher insert: ${error.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

seedPublishers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

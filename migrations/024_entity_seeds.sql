-- ============================================================
-- ENTITY SEEDS: Country + Subtopic → Tag Profile Seeding
-- Solves cold-start: Turkish soccer fan sees Galatasaray on scroll 1
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_seeds (
  id BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,           -- "TR", "US", "IN", or "DEFAULT" for universal
  subtopic TEXT NOT NULL,               -- exact match to onboarding subtopics
  entity_tag TEXT NOT NULL,             -- lowercase, matches interest_tags
  weight FLOAT NOT NULL DEFAULT 0.20,   -- 0.10-0.30
  popularity_rank INTEGER DEFAULT 1,    -- for future trending boost
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entity_seeds_lookup ON entity_seeds(country_code, subtopic);
CREATE INDEX IF NOT EXISTS entity_seeds_subtopic ON entity_seeds(subtopic);

-- ============================================================
-- DEFAULT ENTRIES (apply to all countries)
-- ============================================================

-- ── Politics ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'War & Conflict', 'war', 0.20),
('DEFAULT', 'War & Conflict', 'conflict', 0.20),
('DEFAULT', 'War & Conflict', 'military', 0.20),
('DEFAULT', 'War & Conflict', 'defense', 0.15),
('DEFAULT', 'War & Conflict', 'invasion', 0.15),
('DEFAULT', 'War & Conflict', 'nato', 0.15),

('DEFAULT', 'US Politics', 'us politics', 0.20),
('DEFAULT', 'US Politics', 'congress', 0.20),
('DEFAULT', 'US Politics', 'senate', 0.15),
('DEFAULT', 'US Politics', 'white house', 0.20),
('DEFAULT', 'US Politics', 'republican', 0.15),
('DEFAULT', 'US Politics', 'democrat', 0.15),

('DEFAULT', 'European Politics', 'european union', 0.20),
('DEFAULT', 'European Politics', 'eu', 0.20),
('DEFAULT', 'European Politics', 'nato', 0.15),
('DEFAULT', 'European Politics', 'parliament', 0.15),
('DEFAULT', 'European Politics', 'brexit', 0.10),

('DEFAULT', 'Asian Politics', 'china', 0.20),
('DEFAULT', 'Asian Politics', 'india', 0.15),
('DEFAULT', 'Asian Politics', 'japan', 0.15),
('DEFAULT', 'Asian Politics', 'asean', 0.10),
('DEFAULT', 'Asian Politics', 'taiwan', 0.15),

('DEFAULT', 'Middle East', 'middle east', 0.20),
('DEFAULT', 'Middle East', 'iran', 0.20),
('DEFAULT', 'Middle East', 'israel', 0.20),
('DEFAULT', 'Middle East', 'saudi arabia', 0.15),
('DEFAULT', 'Middle East', 'palestine', 0.15),

('DEFAULT', 'Latin America', 'latin america', 0.20),
('DEFAULT', 'Latin America', 'brazil', 0.15),
('DEFAULT', 'Latin America', 'mexico', 0.15),
('DEFAULT', 'Latin America', 'argentina', 0.15),
('DEFAULT', 'Latin America', 'venezuela', 0.10),

('DEFAULT', 'Africa & Oceania', 'africa', 0.20),
('DEFAULT', 'Africa & Oceania', 'australia', 0.15),
('DEFAULT', 'Africa & Oceania', 'nigeria', 0.15),
('DEFAULT', 'Africa & Oceania', 'south africa', 0.15),

('DEFAULT', 'Human Rights & Civil Liberties', 'human rights', 0.25),
('DEFAULT', 'Human Rights & Civil Liberties', 'civil liberties', 0.20),
('DEFAULT', 'Human Rights & Civil Liberties', 'democracy', 0.15),
('DEFAULT', 'Human Rights & Civil Liberties', 'protest', 0.15),
('DEFAULT', 'Human Rights & Civil Liberties', 'censorship', 0.15);

-- ── Sports ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'NFL', 'nfl', 0.25),
('DEFAULT', 'NFL', 'american football', 0.20),
('DEFAULT', 'NFL', 'super bowl', 0.20),
('DEFAULT', 'NFL', 'quarterback', 0.15),
('DEFAULT', 'NFL', 'touchdown', 0.10),

('DEFAULT', 'NBA', 'nba', 0.25),
('DEFAULT', 'NBA', 'basketball', 0.20),
('DEFAULT', 'NBA', 'playoffs', 0.15),
('DEFAULT', 'NBA', 'dunk', 0.10),

('DEFAULT', 'Soccer/Football', 'soccer', 0.20),
('DEFAULT', 'Soccer/Football', 'football', 0.20),
('DEFAULT', 'Soccer/Football', 'champions league', 0.20),
('DEFAULT', 'Soccer/Football', 'fifa', 0.15),
('DEFAULT', 'Soccer/Football', 'world cup', 0.15),

('DEFAULT', 'MLB/Baseball', 'mlb', 0.25),
('DEFAULT', 'MLB/Baseball', 'baseball', 0.20),
('DEFAULT', 'MLB/Baseball', 'world series', 0.15),
('DEFAULT', 'MLB/Baseball', 'home run', 0.10),

('DEFAULT', 'Cricket', 'cricket', 0.25),
('DEFAULT', 'Cricket', 'test match', 0.15),
('DEFAULT', 'Cricket', 't20', 0.15),
('DEFAULT', 'Cricket', 'world cup cricket', 0.15),

('DEFAULT', 'F1 & Motorsport', 'f1', 0.25),
('DEFAULT', 'F1 & Motorsport', 'formula 1', 0.20),
('DEFAULT', 'F1 & Motorsport', 'grand prix', 0.20),
('DEFAULT', 'F1 & Motorsport', 'motorsport', 0.15),
('DEFAULT', 'F1 & Motorsport', 'racing', 0.10),

('DEFAULT', 'Boxing & MMA/UFC', 'boxing', 0.20),
('DEFAULT', 'Boxing & MMA/UFC', 'ufc', 0.25),
('DEFAULT', 'Boxing & MMA/UFC', 'mma', 0.20),
('DEFAULT', 'Boxing & MMA/UFC', 'knockout', 0.15),
('DEFAULT', 'Boxing & MMA/UFC', 'heavyweight', 0.10),

('DEFAULT', 'Olympics & Paralympics', 'olympics', 0.25),
('DEFAULT', 'Olympics & Paralympics', 'paralympics', 0.20),
('DEFAULT', 'Olympics & Paralympics', 'olympic games', 0.20),
('DEFAULT', 'Olympics & Paralympics', 'gold medal', 0.15);

-- ── Business ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Oil & Energy', 'oil', 0.20),
('DEFAULT', 'Oil & Energy', 'energy', 0.20),
('DEFAULT', 'Oil & Energy', 'opec', 0.20),
('DEFAULT', 'Oil & Energy', 'oil prices', 0.20),
('DEFAULT', 'Oil & Energy', 'natural gas', 0.15),
('DEFAULT', 'Oil & Energy', 'renewable energy', 0.15),

('DEFAULT', 'Automotive', 'automotive', 0.20),
('DEFAULT', 'Automotive', 'tesla', 0.20),
('DEFAULT', 'Automotive', 'electric vehicles', 0.20),
('DEFAULT', 'Automotive', 'ev', 0.15),
('DEFAULT', 'Automotive', 'cars', 0.15),

('DEFAULT', 'Retail & Consumer', 'retail', 0.20),
('DEFAULT', 'Retail & Consumer', 'amazon', 0.20),
('DEFAULT', 'Retail & Consumer', 'e-commerce', 0.15),
('DEFAULT', 'Retail & Consumer', 'consumer', 0.15),
('DEFAULT', 'Retail & Consumer', 'shopping', 0.15),

('DEFAULT', 'Corporate Deals', 'merger', 0.20),
('DEFAULT', 'Corporate Deals', 'acquisition', 0.20),
('DEFAULT', 'Corporate Deals', 'ipo', 0.20),
('DEFAULT', 'Corporate Deals', 'takeover', 0.15),
('DEFAULT', 'Corporate Deals', 'deal', 0.10),

('DEFAULT', 'Trade & Tariffs', 'trade', 0.20),
('DEFAULT', 'Trade & Tariffs', 'tariffs', 0.25),
('DEFAULT', 'Trade & Tariffs', 'sanctions', 0.20),
('DEFAULT', 'Trade & Tariffs', 'trade war', 0.15),
('DEFAULT', 'Trade & Tariffs', 'supply chain', 0.15),

('DEFAULT', 'Corporate Earnings', 'earnings', 0.25),
('DEFAULT', 'Corporate Earnings', 'quarterly results', 0.20),
('DEFAULT', 'Corporate Earnings', 'revenue', 0.15),
('DEFAULT', 'Corporate Earnings', 'profit', 0.15),

('DEFAULT', 'Startups & Venture Capital', 'startup', 0.25),
('DEFAULT', 'Startups & Venture Capital', 'venture capital', 0.20),
('DEFAULT', 'Startups & Venture Capital', 'funding', 0.20),
('DEFAULT', 'Startups & Venture Capital', 'unicorn', 0.15),
('DEFAULT', 'Startups & Venture Capital', 'vc', 0.15),

('DEFAULT', 'Real Estate', 'real estate', 0.25),
('DEFAULT', 'Real Estate', 'housing', 0.20),
('DEFAULT', 'Real Estate', 'property', 0.20),
('DEFAULT', 'Real Estate', 'mortgage', 0.15);

-- ── Entertainment ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Movies & Film', 'movies', 0.20),
('DEFAULT', 'Movies & Film', 'film', 0.20),
('DEFAULT', 'Movies & Film', 'box office', 0.15),
('DEFAULT', 'Movies & Film', 'hollywood', 0.15),
('DEFAULT', 'Movies & Film', 'oscar', 0.15),
('DEFAULT', 'Movies & Film', 'cinema', 0.10),

('DEFAULT', 'TV & Streaming', 'streaming', 0.20),
('DEFAULT', 'TV & Streaming', 'netflix', 0.20),
('DEFAULT', 'TV & Streaming', 'hbo', 0.15),
('DEFAULT', 'TV & Streaming', 'disney plus', 0.15),
('DEFAULT', 'TV & Streaming', 'tv', 0.15),

('DEFAULT', 'Music', 'music', 0.20),
('DEFAULT', 'Music', 'album', 0.15),
('DEFAULT', 'Music', 'concert', 0.15),
('DEFAULT', 'Music', 'grammy', 0.15),
('DEFAULT', 'Music', 'tour', 0.10),

('DEFAULT', 'Gaming', 'gaming', 0.25),
('DEFAULT', 'Gaming', 'video games', 0.20),
('DEFAULT', 'Gaming', 'playstation', 0.15),
('DEFAULT', 'Gaming', 'xbox', 0.15),
('DEFAULT', 'Gaming', 'nintendo', 0.15),
('DEFAULT', 'Gaming', 'esports', 0.15),

('DEFAULT', 'Celebrity News', 'celebrity', 0.25),
('DEFAULT', 'Celebrity News', 'gossip', 0.15),
('DEFAULT', 'Celebrity News', 'scandal', 0.15),
('DEFAULT', 'Celebrity News', 'billionaire', 0.15),

('DEFAULT', 'K-Pop & K-Drama', 'k-pop', 0.25),
('DEFAULT', 'K-Pop & K-Drama', 'k-drama', 0.25),
('DEFAULT', 'K-Pop & K-Drama', 'bts', 0.20),
('DEFAULT', 'K-Pop & K-Drama', 'blackpink', 0.20),
('DEFAULT', 'K-Pop & K-Drama', 'korean', 0.15),
('DEFAULT', 'K-Pop & K-Drama', 'hallyu', 0.10);

-- ── Tech ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'AI & Machine Learning', 'ai', 0.25),
('DEFAULT', 'AI & Machine Learning', 'artificial intelligence', 0.20),
('DEFAULT', 'AI & Machine Learning', 'openai', 0.20),
('DEFAULT', 'AI & Machine Learning', 'chatgpt', 0.20),
('DEFAULT', 'AI & Machine Learning', 'machine learning', 0.15),
('DEFAULT', 'AI & Machine Learning', 'deep learning', 0.10),

('DEFAULT', 'Smartphones & Gadgets', 'smartphone', 0.20),
('DEFAULT', 'Smartphones & Gadgets', 'iphone', 0.20),
('DEFAULT', 'Smartphones & Gadgets', 'samsung', 0.20),
('DEFAULT', 'Smartphones & Gadgets', 'apple', 0.15),
('DEFAULT', 'Smartphones & Gadgets', 'android', 0.15),
('DEFAULT', 'Smartphones & Gadgets', 'gadget', 0.10),

('DEFAULT', 'Social Media', 'social media', 0.25),
('DEFAULT', 'Social Media', 'tiktok', 0.20),
('DEFAULT', 'Social Media', 'instagram', 0.20),
('DEFAULT', 'Social Media', 'twitter', 0.15),
('DEFAULT', 'Social Media', 'meta', 0.15),

('DEFAULT', 'Cybersecurity', 'cybersecurity', 0.25),
('DEFAULT', 'Cybersecurity', 'hacking', 0.20),
('DEFAULT', 'Cybersecurity', 'data breach', 0.20),
('DEFAULT', 'Cybersecurity', 'ransomware', 0.15),
('DEFAULT', 'Cybersecurity', 'privacy', 0.15),

('DEFAULT', 'Space Tech', 'spacex', 0.25),
('DEFAULT', 'Space Tech', 'nasa', 0.20),
('DEFAULT', 'Space Tech', 'rocket', 0.20),
('DEFAULT', 'Space Tech', 'satellite', 0.15),
('DEFAULT', 'Space Tech', 'starship', 0.15),

('DEFAULT', 'Robotics & Hardware', 'robotics', 0.20),
('DEFAULT', 'Robotics & Hardware', 'semiconductor', 0.20),
('DEFAULT', 'Robotics & Hardware', 'nvidia', 0.25),
('DEFAULT', 'Robotics & Hardware', 'chip', 0.20),
('DEFAULT', 'Robotics & Hardware', 'processor', 0.15);

-- ── Science ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Space & Astronomy', 'space', 0.20),
('DEFAULT', 'Space & Astronomy', 'astronomy', 0.20),
('DEFAULT', 'Space & Astronomy', 'nasa', 0.20),
('DEFAULT', 'Space & Astronomy', 'telescope', 0.15),
('DEFAULT', 'Space & Astronomy', 'galaxy', 0.15),
('DEFAULT', 'Space & Astronomy', 'mars', 0.15),

('DEFAULT', 'Climate & Environment', 'climate', 0.25),
('DEFAULT', 'Climate & Environment', 'climate change', 0.25),
('DEFAULT', 'Climate & Environment', 'environment', 0.20),
('DEFAULT', 'Climate & Environment', 'emissions', 0.15),
('DEFAULT', 'Climate & Environment', 'pollution', 0.15),

('DEFAULT', 'Biology & Nature', 'biology', 0.20),
('DEFAULT', 'Biology & Nature', 'wildlife', 0.20),
('DEFAULT', 'Biology & Nature', 'nature', 0.20),
('DEFAULT', 'Biology & Nature', 'genetics', 0.15),
('DEFAULT', 'Biology & Nature', 'evolution', 0.15),

('DEFAULT', 'Earth Science', 'earthquake', 0.20),
('DEFAULT', 'Earth Science', 'volcano', 0.20),
('DEFAULT', 'Earth Science', 'geology', 0.15),
('DEFAULT', 'Earth Science', 'ocean', 0.15),
('DEFAULT', 'Earth Science', 'weather', 0.15);

-- ── Health ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Medical Breakthroughs', 'medical', 0.20),
('DEFAULT', 'Medical Breakthroughs', 'breakthrough', 0.20),
('DEFAULT', 'Medical Breakthroughs', 'treatment', 0.20),
('DEFAULT', 'Medical Breakthroughs', 'clinical trial', 0.15),
('DEFAULT', 'Medical Breakthroughs', 'surgery', 0.15),

('DEFAULT', 'Public Health', 'public health', 0.20),
('DEFAULT', 'Public Health', 'vaccine', 0.20),
('DEFAULT', 'Public Health', 'pandemic', 0.15),
('DEFAULT', 'Public Health', 'who', 0.15),
('DEFAULT', 'Public Health', 'cdc', 0.15),

('DEFAULT', 'Mental Health', 'mental health', 0.25),
('DEFAULT', 'Mental Health', 'anxiety', 0.20),
('DEFAULT', 'Mental Health', 'depression', 0.20),
('DEFAULT', 'Mental Health', 'therapy', 0.15),
('DEFAULT', 'Mental Health', 'mindfulness', 0.15),

('DEFAULT', 'Pharma & Drug Industry', 'pharmaceutical', 0.20),
('DEFAULT', 'Pharma & Drug Industry', 'pharma', 0.20),
('DEFAULT', 'Pharma & Drug Industry', 'fda', 0.20),
('DEFAULT', 'Pharma & Drug Industry', 'biotech', 0.15),
('DEFAULT', 'Pharma & Drug Industry', 'drug', 0.15);

-- ── Finance ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Stock Markets', 'stock market', 0.25),
('DEFAULT', 'Stock Markets', 'wall street', 0.20),
('DEFAULT', 'Stock Markets', 'nasdaq', 0.20),
('DEFAULT', 'Stock Markets', 'dow jones', 0.15),
('DEFAULT', 'Stock Markets', 'trading', 0.15),

('DEFAULT', 'Banking & Lending', 'banking', 0.20),
('DEFAULT', 'Banking & Lending', 'interest rate', 0.20),
('DEFAULT', 'Banking & Lending', 'federal reserve', 0.20),
('DEFAULT', 'Banking & Lending', 'inflation', 0.20),
('DEFAULT', 'Banking & Lending', 'lending', 0.15),

('DEFAULT', 'Commodities', 'commodities', 0.25),
('DEFAULT', 'Commodities', 'gold', 0.20),
('DEFAULT', 'Commodities', 'silver', 0.15),
('DEFAULT', 'Commodities', 'oil price', 0.20),
('DEFAULT', 'Commodities', 'futures', 0.15);

-- ── Crypto ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Bitcoin', 'bitcoin', 0.30),
('DEFAULT', 'Bitcoin', 'btc', 0.25),
('DEFAULT', 'Bitcoin', 'crypto', 0.15),
('DEFAULT', 'Bitcoin', 'mining', 0.15),

('DEFAULT', 'DeFi & Web3', 'defi', 0.25),
('DEFAULT', 'DeFi & Web3', 'web3', 0.25),
('DEFAULT', 'DeFi & Web3', 'blockchain', 0.20),
('DEFAULT', 'DeFi & Web3', 'smart contract', 0.15),
('DEFAULT', 'DeFi & Web3', 'decentralized', 0.15),

('DEFAULT', 'Crypto Regulation & Legal', 'crypto regulation', 0.25),
('DEFAULT', 'Crypto Regulation & Legal', 'cryptocurrency', 0.20),
('DEFAULT', 'Crypto Regulation & Legal', 'sec', 0.20),
('DEFAULT', 'Crypto Regulation & Legal', 'crypto tax', 0.15);

-- ── Lifestyle ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Pets & Animals', 'pets', 0.25),
('DEFAULT', 'Pets & Animals', 'dog', 0.20),
('DEFAULT', 'Pets & Animals', 'cat', 0.20),
('DEFAULT', 'Pets & Animals', 'animals', 0.15),
('DEFAULT', 'Pets & Animals', 'wildlife', 0.15),

('DEFAULT', 'Home & Garden', 'home', 0.20),
('DEFAULT', 'Home & Garden', 'garden', 0.20),
('DEFAULT', 'Home & Garden', 'diy', 0.20),
('DEFAULT', 'Home & Garden', 'renovation', 0.15),
('DEFAULT', 'Home & Garden', 'decor', 0.15),

('DEFAULT', 'Shopping & Product Reviews', 'shopping', 0.20),
('DEFAULT', 'Shopping & Product Reviews', 'product review', 0.20),
('DEFAULT', 'Shopping & Product Reviews', 'deal', 0.15),
('DEFAULT', 'Shopping & Product Reviews', 'discount', 0.15),
('DEFAULT', 'Shopping & Product Reviews', 'best buy', 0.15);

-- ── Fashion ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DEFAULT', 'Sneakers & Streetwear', 'sneakers', 0.25),
('DEFAULT', 'Sneakers & Streetwear', 'streetwear', 0.20),
('DEFAULT', 'Sneakers & Streetwear', 'nike', 0.20),
('DEFAULT', 'Sneakers & Streetwear', 'adidas', 0.15),
('DEFAULT', 'Sneakers & Streetwear', 'jordan', 0.15),

('DEFAULT', 'Celebrity Style & Red Carpet', 'red carpet', 0.25),
('DEFAULT', 'Celebrity Style & Red Carpet', 'celebrity style', 0.20),
('DEFAULT', 'Celebrity Style & Red Carpet', 'fashion', 0.20),
('DEFAULT', 'Celebrity Style & Red Carpet', 'met gala', 0.15),
('DEFAULT', 'Celebrity Style & Red Carpet', 'best dressed', 0.15);


-- ============================================================
-- COUNTRY-SPECIFIC ENTITIES
-- These supplement the DEFAULT entries with local entities.
-- ============================================================

-- ── TURKEY (TR) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('TR', 'Soccer/Football', 'galatasaray', 0.25),
('TR', 'Soccer/Football', 'fenerbahce', 0.25),
('TR', 'Soccer/Football', 'besiktas', 0.25),
('TR', 'Soccer/Football', 'trabzonspor', 0.20),
('TR', 'Soccer/Football', 'super lig', 0.25),
('TR', 'Middle East', 'turkey', 0.25),
('TR', 'Middle East', 'erdogan', 0.20),
('TR', 'Middle East', 'ankara', 0.15),
('TR', 'Middle East', 'istanbul', 0.15),
('TR', 'European Politics', 'turkey', 0.25),
('TR', 'European Politics', 'erdogan', 0.20),
('TR', 'Boxing & MMA/UFC', 'turkey', 0.15),
('TR', 'Stock Markets', 'borsa istanbul', 0.20),
('TR', 'Stock Markets', 'turkish lira', 0.20);

-- ── UNITED STATES (US) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('US', 'NFL', 'chiefs', 0.20),
('US', 'NFL', 'cowboys', 0.15),
('US', 'NFL', 'patrick mahomes', 0.20),
('US', 'NFL', 'josh allen', 0.15),
('US', 'NBA', 'lakers', 0.20),
('US', 'NBA', 'celtics', 0.20),
('US', 'NBA', 'lebron', 0.20),
('US', 'NBA', 'steph curry', 0.15),
('US', 'Soccer/Football', 'mls', 0.25),
('US', 'Soccer/Football', 'usmnt', 0.20),
('US', 'Soccer/Football', 'premier league', 0.20),
('US', 'MLB/Baseball', 'yankees', 0.20),
('US', 'MLB/Baseball', 'dodgers', 0.20),
('US', 'MLB/Baseball', 'shohei ohtani', 0.20),
('US', 'US Politics', 'trump', 0.25),
('US', 'US Politics', 'biden', 0.20),
('US', 'US Politics', 'supreme court', 0.20),
('US', 'US Politics', 'pentagon', 0.15),
('US', 'Stock Markets', 'sp500', 0.20),
('US', 'Stock Markets', 'nyse', 0.15),
('US', 'Movies & Film', 'hollywood', 0.25),
('US', 'Movies & Film', 'oscars', 0.20),
('US', 'Automotive', 'ford', 0.15),
('US', 'Automotive', 'gm', 0.15);

-- ── UNITED KINGDOM (GB) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('GB', 'Soccer/Football', 'premier league', 0.30),
('GB', 'Soccer/Football', 'manchester united', 0.20),
('GB', 'Soccer/Football', 'liverpool', 0.20),
('GB', 'Soccer/Football', 'arsenal', 0.20),
('GB', 'Soccer/Football', 'chelsea', 0.20),
('GB', 'Soccer/Football', 'manchester city', 0.20),
('GB', 'Soccer/Football', 'tottenham', 0.15),
('GB', 'European Politics', 'uk', 0.25),
('GB', 'European Politics', 'parliament', 0.20),
('GB', 'European Politics', 'labour', 0.15),
('GB', 'European Politics', 'tory', 0.15),
('GB', 'European Politics', 'starmer', 0.15),
('GB', 'Cricket', 'england cricket', 0.25),
('GB', 'Cricket', 'ashes', 0.25),
('GB', 'Cricket', 'county cricket', 0.15),
('GB', 'F1 & Motorsport', 'lewis hamilton', 0.20),
('GB', 'F1 & Motorsport', 'lando norris', 0.20),
('GB', 'F1 & Motorsport', 'silverstone', 0.15),
('GB', 'Stock Markets', 'ftse', 0.20),
('GB', 'Stock Markets', 'london stock exchange', 0.15);

-- ── INDIA (IN) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('IN', 'Cricket', 'ipl', 0.30),
('IN', 'Cricket', 'bcci', 0.25),
('IN', 'Cricket', 'virat kohli', 0.25),
('IN', 'Cricket', 'rohit sharma', 0.20),
('IN', 'Cricket', 'mumbai indians', 0.15),
('IN', 'Cricket', 'csk', 0.15),
('IN', 'Cricket', 'rcb', 0.15),
('IN', 'Asian Politics', 'india', 0.30),
('IN', 'Asian Politics', 'modi', 0.25),
('IN', 'Asian Politics', 'bjp', 0.20),
('IN', 'Asian Politics', 'delhi', 0.15),
('IN', 'Soccer/Football', 'isl', 0.20),
('IN', 'Soccer/Football', 'premier league', 0.25),
('IN', 'Movies & Film', 'bollywood', 0.25),
('IN', 'Movies & Film', 'shah rukh khan', 0.15),
('IN', 'Stock Markets', 'sensex', 0.25),
('IN', 'Stock Markets', 'nifty', 0.20),
('IN', 'Stock Markets', 'bse', 0.15),
('IN', 'Smartphones & Gadgets', 'iphone', 0.20),
('IN', 'Smartphones & Gadgets', 'samsung', 0.20),
('IN', 'Smartphones & Gadgets', 'xiaomi', 0.15);

-- ── GERMANY (DE) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('DE', 'Soccer/Football', 'bundesliga', 0.30),
('DE', 'Soccer/Football', 'bayern munich', 0.25),
('DE', 'Soccer/Football', 'borussia dortmund', 0.25),
('DE', 'Soccer/Football', 'bayer leverkusen', 0.20),
('DE', 'European Politics', 'germany', 0.30),
('DE', 'European Politics', 'bundestag', 0.20),
('DE', 'European Politics', 'merz', 0.15),
('DE', 'Automotive', 'volkswagen', 0.25),
('DE', 'Automotive', 'bmw', 0.25),
('DE', 'Automotive', 'mercedes', 0.25),
('DE', 'F1 & Motorsport', 'mercedes', 0.20),
('DE', 'Stock Markets', 'dax', 0.20);

-- ── FRANCE (FR) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('FR', 'Soccer/Football', 'ligue 1', 0.25),
('FR', 'Soccer/Football', 'psg', 0.30),
('FR', 'Soccer/Football', 'marseille', 0.20),
('FR', 'Soccer/Football', 'mbappe', 0.25),
('FR', 'European Politics', 'france', 0.30),
('FR', 'European Politics', 'macron', 0.25),
('FR', 'European Politics', 'elysee', 0.15),
('FR', 'Movies & Film', 'cannes', 0.20),
('FR', 'Celebrity Style & Red Carpet', 'paris fashion', 0.25),
('FR', 'F1 & Motorsport', 'le mans', 0.15);

-- ── SPAIN (ES) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('ES', 'Soccer/Football', 'la liga', 0.30),
('ES', 'Soccer/Football', 'real madrid', 0.30),
('ES', 'Soccer/Football', 'barcelona', 0.30),
('ES', 'Soccer/Football', 'atletico madrid', 0.20),
('ES', 'Soccer/Football', 'vinicius', 0.15),
('ES', 'European Politics', 'spain', 0.30),
('ES', 'European Politics', 'sanchez', 0.15),
('ES', 'F1 & Motorsport', 'fernando alonso', 0.20),
('ES', 'F1 & Motorsport', 'carlos sainz', 0.20);

-- ── ITALY (IT) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('IT', 'Soccer/Football', 'serie a', 0.30),
('IT', 'Soccer/Football', 'juventus', 0.25),
('IT', 'Soccer/Football', 'ac milan', 0.25),
('IT', 'Soccer/Football', 'inter milan', 0.25),
('IT', 'Soccer/Football', 'napoli', 0.20),
('IT', 'European Politics', 'italy', 0.30),
('IT', 'European Politics', 'meloni', 0.20),
('IT', 'Celebrity Style & Red Carpet', 'milan fashion', 0.25),
('IT', 'Automotive', 'ferrari', 0.25),
('IT', 'F1 & Motorsport', 'ferrari', 0.25),
('IT', 'F1 & Motorsport', 'monza', 0.15);

-- ── BRAZIL (BR) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('BR', 'Soccer/Football', 'brasileirao', 0.25),
('BR', 'Soccer/Football', 'flamengo', 0.25),
('BR', 'Soccer/Football', 'corinthians', 0.20),
('BR', 'Soccer/Football', 'palmeiras', 0.20),
('BR', 'Soccer/Football', 'neymar', 0.20),
('BR', 'Soccer/Football', 'copa libertadores', 0.20),
('BR', 'Latin America', 'brazil', 0.30),
('BR', 'Latin America', 'lula', 0.20),
('BR', 'Latin America', 'brasilia', 0.15),
('BR', 'Boxing & MMA/UFC', 'ufc brazil', 0.15),
('BR', 'Boxing & MMA/UFC', 'alex pereira', 0.20),
('BR', 'F1 & Motorsport', 'interlagos', 0.15);

-- ── MEXICO (MX) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('MX', 'Soccer/Football', 'liga mx', 0.30),
('MX', 'Soccer/Football', 'club america', 0.25),
('MX', 'Soccer/Football', 'chivas', 0.25),
('MX', 'Soccer/Football', 'cruz azul', 0.20),
('MX', 'Latin America', 'mexico', 0.30),
('MX', 'Latin America', 'mexico city', 0.15),
('MX', 'Boxing & MMA/UFC', 'canelo alvarez', 0.25),
('MX', 'Boxing & MMA/UFC', 'canelo', 0.25);

-- ── JAPAN (JP) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('JP', 'Soccer/Football', 'j-league', 0.25),
('JP', 'Soccer/Football', 'premier league', 0.20),
('JP', 'MLB/Baseball', 'shohei ohtani', 0.30),
('JP', 'MLB/Baseball', 'nippon', 0.20),
('JP', 'Asian Politics', 'japan', 0.30),
('JP', 'Asian Politics', 'tokyo', 0.20),
('JP', 'Gaming', 'nintendo', 0.25),
('JP', 'Gaming', 'sony', 0.20),
('JP', 'Gaming', 'playstation', 0.20),
('JP', 'Automotive', 'toyota', 0.25),
('JP', 'Automotive', 'honda', 0.20),
('JP', 'Automotive', 'nissan', 0.15),
('JP', 'F1 & Motorsport', 'yuki tsunoda', 0.20),
('JP', 'F1 & Motorsport', 'suzuka', 0.15);

-- ── SOUTH KOREA (KR) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('KR', 'K-Pop & K-Drama', 'bts', 0.30),
('KR', 'K-Pop & K-Drama', 'blackpink', 0.25),
('KR', 'K-Pop & K-Drama', 'stray kids', 0.20),
('KR', 'K-Pop & K-Drama', 'newjeans', 0.20),
('KR', 'K-Pop & K-Drama', 'kdrama', 0.25),
('KR', 'Soccer/Football', 'k-league', 0.25),
('KR', 'Soccer/Football', 'son heung-min', 0.25),
('KR', 'Asian Politics', 'south korea', 0.30),
('KR', 'Asian Politics', 'seoul', 0.20),
('KR', 'Smartphones & Gadgets', 'samsung', 0.30),
('KR', 'Smartphones & Gadgets', 'lg', 0.15),
('KR', 'Gaming', 'esports', 0.25),
('KR', 'MLB/Baseball', 'kbo', 0.20);

-- ── AUSTRALIA (AU) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('AU', 'Cricket', 'ashes', 0.30),
('AU', 'Cricket', 'australia cricket', 0.25),
('AU', 'Cricket', 'big bash', 0.20),
('AU', 'Cricket', 'pat cummins', 0.15),
('AU', 'Soccer/Football', 'a-league', 0.25),
('AU', 'Soccer/Football', 'premier league', 0.20),
('AU', 'Africa & Oceania', 'australia', 0.30),
('AU', 'Africa & Oceania', 'canberra', 0.15),
('AU', 'F1 & Motorsport', 'melbourne grand prix', 0.20),
('AU', 'F1 & Motorsport', 'daniel ricciardo', 0.15);

-- ── CANADA (CA) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('CA', 'NBA', 'toronto raptors', 0.25),
('CA', 'Soccer/Football', 'mls', 0.20),
('CA', 'Soccer/Football', 'toronto fc', 0.15),
('CA', 'NFL', 'cfl', 0.15),
('CA', 'US Politics', 'canada', 0.15),
('CA', 'US Politics', 'trudeau', 0.20),
('CA', 'Boxing & MMA/UFC', 'gsp', 0.15);

-- ── ISRAEL (IL) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('IL', 'Middle East', 'israel', 0.30),
('IL', 'Middle East', 'tel aviv', 0.20),
('IL', 'Middle East', 'netanyahu', 0.25),
('IL', 'Middle East', 'idf', 0.20),
('IL', 'Middle East', 'gaza', 0.20),
('IL', 'War & Conflict', 'israel', 0.25),
('IL', 'War & Conflict', 'hamas', 0.20),
('IL', 'War & Conflict', 'hezbollah', 0.15),
('IL', 'AI & Machine Learning', 'israel tech', 0.15),
('IL', 'Startups & Venture Capital', 'israel startup', 0.20);

-- ── UKRAINE (UA) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('UA', 'War & Conflict', 'ukraine', 0.30),
('UA', 'War & Conflict', 'zelenskyy', 0.25),
('UA', 'War & Conflict', 'ukraine war', 0.25),
('UA', 'War & Conflict', 'kyiv', 0.20),
('UA', 'War & Conflict', 'russia', 0.20),
('UA', 'European Politics', 'ukraine', 0.30),
('UA', 'European Politics', 'zelenskyy', 0.25),
('UA', 'Soccer/Football', 'shakhtar donetsk', 0.25),
('UA', 'Soccer/Football', 'dynamo kyiv', 0.25);

-- ── CHINA (CN) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('CN', 'Asian Politics', 'china', 0.30),
('CN', 'Asian Politics', 'xi jinping', 0.25),
('CN', 'Asian Politics', 'beijing', 0.20),
('CN', 'Asian Politics', 'ccp', 0.15),
('CN', 'Trade & Tariffs', 'china trade', 0.25),
('CN', 'Trade & Tariffs', 'us china', 0.20),
('CN', 'AI & Machine Learning', 'deepseek', 0.20),
('CN', 'AI & Machine Learning', 'baidu', 0.15),
('CN', 'Smartphones & Gadgets', 'huawei', 0.25),
('CN', 'Smartphones & Gadgets', 'xiaomi', 0.20),
('CN', 'Automotive', 'byd', 0.25),
('CN', 'Automotive', 'nio', 0.20);

-- ── RUSSIA (RU) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('RU', 'War & Conflict', 'russia', 0.30),
('RU', 'War & Conflict', 'putin', 0.25),
('RU', 'War & Conflict', 'ukraine war', 0.20),
('RU', 'War & Conflict', 'moscow', 0.15),
('RU', 'European Politics', 'russia', 0.30),
('RU', 'European Politics', 'putin', 0.25),
('RU', 'Oil & Energy', 'russia oil', 0.20),
('RU', 'Oil & Energy', 'gazprom', 0.20),
('RU', 'Soccer/Football', 'russian premier league', 0.20),
('RU', 'Soccer/Football', 'spartak moscow', 0.15),
('RU', 'Soccer/Football', 'zenit', 0.15),
('RU', 'Boxing & MMA/UFC', 'khabib', 0.20);

-- ── PAKISTAN (PK) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('PK', 'Cricket', 'pakistan cricket', 0.30),
('PK', 'Cricket', 'psl', 0.25),
('PK', 'Cricket', 'babar azam', 0.25),
('PK', 'Cricket', 'shaheen afridi', 0.20),
('PK', 'Asian Politics', 'pakistan', 0.30),
('PK', 'Asian Politics', 'islamabad', 0.20),
('PK', 'Asian Politics', 'imran khan', 0.20),
('PK', 'Middle East', 'pakistan', 0.20);

-- ── IRAN (IR) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('IR', 'Middle East', 'iran', 0.30),
('IR', 'Middle East', 'tehran', 0.25),
('IR', 'Middle East', 'khamenei', 0.20),
('IR', 'War & Conflict', 'iran', 0.30),
('IR', 'War & Conflict', 'strait of hormuz', 0.20),
('IR', 'War & Conflict', 'irgc', 0.15),
('IR', 'Soccer/Football', 'persepolis', 0.25),
('IR', 'Soccer/Football', 'esteghlal', 0.25),
('IR', 'Soccer/Football', 'iran football', 0.20),
('IR', 'Oil & Energy', 'iran oil', 0.20);

-- ── SAUDI ARABIA (SA) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('SA', 'Soccer/Football', 'saudi pro league', 0.30),
('SA', 'Soccer/Football', 'al hilal', 0.25),
('SA', 'Soccer/Football', 'al nassr', 0.25),
('SA', 'Soccer/Football', 'ronaldo', 0.25),
('SA', 'Soccer/Football', 'al ittihad', 0.20),
('SA', 'Middle East', 'saudi arabia', 0.30),
('SA', 'Middle East', 'mbs', 0.20),
('SA', 'Middle East', 'riyadh', 0.20),
('SA', 'Oil & Energy', 'saudi aramco', 0.25),
('SA', 'Oil & Energy', 'opec', 0.25),
('SA', 'Boxing & MMA/UFC', 'riyadh season', 0.20);

-- ── UAE (AE) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('AE', 'Middle East', 'uae', 0.30),
('AE', 'Middle East', 'dubai', 0.25),
('AE', 'Middle East', 'abu dhabi', 0.20),
('AE', 'Soccer/Football', 'uae pro league', 0.20),
('AE', 'Soccer/Football', 'al ain', 0.20),
('AE', 'F1 & Motorsport', 'abu dhabi grand prix', 0.25),
('AE', 'F1 & Motorsport', 'yas marina', 0.15),
('AE', 'Real Estate', 'dubai real estate', 0.25),
('AE', 'Oil & Energy', 'adnoc', 0.20);

-- ── IRAQ (IQ) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('IQ', 'Middle East', 'iraq', 0.30),
('IQ', 'Middle East', 'baghdad', 0.25),
('IQ', 'War & Conflict', 'iraq', 0.25),
('IQ', 'War & Conflict', 'isis', 0.15),
('IQ', 'Soccer/Football', 'iraqi premier league', 0.20),
('IQ', 'Oil & Energy', 'iraq oil', 0.20);

-- ── AFGHANISTAN (AF) ──
INSERT INTO entity_seeds (country_code, subtopic, entity_tag, weight) VALUES
('AF', 'War & Conflict', 'afghanistan', 0.30),
('AF', 'War & Conflict', 'taliban', 0.25),
('AF', 'War & Conflict', 'kabul', 0.20),
('AF', 'Asian Politics', 'afghanistan', 0.25),
('AF', 'Human Rights & Civil Liberties', 'afghanistan', 0.25),
('AF', 'Cricket', 'afghanistan cricket', 0.20),
('AF', 'Cricket', 'rashid khan', 0.20);

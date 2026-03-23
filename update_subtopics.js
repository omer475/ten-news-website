const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 55 subtopics with their matching keywords
const SUBTOPICS = {
  // ── Politics ──
  'War & Conflict': ['war', 'conflict', 'military', 'defense', 'armed forces', 'invasion', 'military conflict', 'military strikes', 'air strikes', 'bombing'],
  'US Politics': ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'republican party', 'supreme court', 'pentagon'],
  'European Politics': ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'germany', 'france', 'uk', 'hungary', 'spain'],
  'Asian Politics': ['asian politics', 'china', 'india', 'japan', 'southeast asia', 'asean', 'asia', 'north korea', 'south korea', 'taiwan'],
  'Middle East': ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon', 'hezbollah', 'tehran', 'strait of hormuz', 'middle east conflict'],
  'Latin America': ['latin america', 'brazil', 'mexico', 'argentina', 'colombia', 'venezuela', 'cuba'],
  'Africa & Oceania': ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'],
  'Human Rights & Civil Liberties': ['human rights', 'civil liberties', 'freedom', 'protest', 'democracy', 'censorship', 'war crimes'],

  // ── Sports ──
  'NFL': ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown', 'wide receiver', 'running back'],
  'NBA': ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'dunk', 'playoffs'],
  'Soccer/Football': ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'mls', 'fifa', 'world cup'],
  'MLB/Baseball': ['mlb', 'baseball', 'world series', 'home run', 'pitcher'],
  'Cricket': ['cricket', 'ipl', 'test match', 'ashes', 'world cup cricket', 't20', 'bcci'],
  'F1 & Motorsport': ['f1', 'formula 1', 'motorsport', 'nascar', 'indycar', 'grand prix', 'racing'],
  'Boxing & MMA/UFC': ['boxing', 'mma', 'ufc', 'fight', 'knockout', 'heavyweight', 'bout'],
  'Olympics & Paralympics': ['olympics', 'paralympics', 'olympic games', 'gold medal', 'ioc', 'olympic'],

  // ── Business ──
  'Oil & Energy': ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'petroleum', 'oil prices', 'crude oil', 'energy security', 'oil supply', 'oil market', 'nuclear energy', 'energy policy'],
  'Automotive': ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'],
  'Retail & Consumer': ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'],
  'Corporate Deals': ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'],
  'Trade & Tariffs': ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war', 'supply chain'],
  'Corporate Earnings': ['earnings', 'quarterly results', 'revenue', 'profit', 'financial results'],
  'Startups & Venture Capital': ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'],
  'Real Estate': ['real estate', 'property', 'housing', 'mortgage', 'commercial real estate'],

  // ── Entertainment ──
  'Movies & Film': ['movies', 'film', 'box office', 'hollywood', 'director', 'cinema', 'oscar', 'oscars'],
  'TV & Streaming': ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series', 'show'],
  'Music': ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer', 'beyonce'],
  'Gaming': ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'],
  'Celebrity News': ['celebrity', 'famous', 'scandal', 'gossip', 'paparazzi', 'star', 'billionaire'],
  'K-Pop & K-Drama': ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama', 'hallyu'],

  // ── Tech ──
  'AI & Machine Learning': ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'],
  'Smartphones & Gadgets': ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'wearable', 'apple', 'android'],
  'Social Media': ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'],
  'Cybersecurity': ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy', 'encryption', 'vulnerability'],
  'Space Tech': ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin', 'space exploration'],
  'Robotics & Hardware': ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor'],

  // ── Science ──
  'Space & Astronomy': ['space', 'astronomy', 'nasa', 'mars', 'telescope', 'galaxy', 'asteroid', 'planet'],
  'Climate & Environment': ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'pollution', 'biodiversity', 'climate change'],
  'Biology & Nature': ['biology', 'nature', 'wildlife', 'evolution', 'genetics', 'species', 'ecosystem'],
  'Earth Science': ['earth science', 'geology', 'earthquake', 'volcano', 'ocean', 'weather'],

  // ── Health ──
  'Medical Breakthroughs': ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial', 'surgery'],
  'Public Health': ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak', 'disease'],
  'Mental Health': ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness', 'wellbeing'],
  'Pharma & Drug Industry': ['pharma', 'pharmaceutical', 'drug', 'fda', 'medication', 'biotech', 'pharmaceuticals'],

  // ── Finance ──
  'Stock Markets': ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares', 'trading'],
  'Banking & Lending': ['banking', 'lending', 'interest rate', 'federal reserve', 'loan', 'credit', 'inflation'],
  'Commodities': ['commodities', 'gold', 'silver', 'oil price', 'futures', 'copper'],

  // ── Crypto ──
  'Bitcoin': ['bitcoin', 'btc', 'satoshi', 'mining', 'halving'],
  'DeFi & Web3': ['defi', 'web3', 'blockchain', 'smart contract', 'dao', 'decentralized'],
  'Crypto Regulation & Legal': ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'crypto tax', 'cryptocurrency'],

  // ── Lifestyle ──
  'Pets & Animals': ['pets', 'animals', 'dog', 'cat', 'veterinary', 'adoption', 'wildlife'],
  'Home & Garden': ['home', 'garden', 'diy', 'renovation', 'decor', 'landscaping'],
  'Shopping & Product Reviews': ['shopping', 'product review', 'best buy', 'deal', 'discount', 'gadget review'],

  // ── Fashion ──
  'Sneakers & Streetwear': ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy', 'drop'],
  'Celebrity Style & Red Carpet': ['celebrity style', 'red carpet', 'outfit', 'best dressed', 'met gala', 'fashion'],
};

(async () => {
  const since = new Date(Date.now() - 24*3600000).toISOString();
  
  // Fetch all articles from last 24h
  let allArticles = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, title_news, category, interest_tags')
      .gte('created_at', since)
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    
    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    allArticles = allArticles.concat(data);
    offset += data.length;
    if (data.length < 500) break;
  }
  
  console.log(`Fetched ${allArticles.length} articles from last 24h\n`);
  
  let updated = 0;
  let skipped = 0;
  const subtopicCounts = {};
  
  for (const article of allArticles) {
    let tags = article.interest_tags;
    if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch { tags = []; }
    if (!tags) tags = [];
    
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const titleLower = (article.title_news || '').toLowerCase();
    
    // Find matching subtopics
    const matchedSubtopics = [];
    for (const [subtopic, keywords] of Object.entries(SUBTOPICS)) {
      const hasMatch = keywords.some(kw => tagSet.has(kw) || titleLower.includes(kw));
      if (hasMatch) {
        matchedSubtopics.push(subtopic);
        subtopicCounts[subtopic] = (subtopicCounts[subtopic] || 0) + 1;
      }
    }
    
    if (matchedSubtopics.length === 0) {
      skipped++;
      continue;
    }
    
    // Add subtopic names to interest_tags (avoid duplicates)
    const newTags = [...tags];
    let added = false;
    for (const sub of matchedSubtopics) {
      if (!tagSet.has(sub.toLowerCase())) {
        newTags.push(sub);
        added = true;
      }
    }
    
    if (!added) {
      skipped++;
      continue;
    }
    
    // Update in DB
    const { error } = await supabase
      .from('published_articles')
      .update({ interest_tags: JSON.stringify(newTags) })
      .eq('id', article.id);
    
    if (error) {
      console.error(`Error updating article ${article.id}:`, error.message);
    } else {
      updated++;
    }
  }
  
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no match or already tagged): ${skipped}`);
  console.log(`\n=== SUBTOPIC DISTRIBUTION ===`);
  const sorted = Object.entries(subtopicCounts).sort((a,b) => b[1] - a[1]);
  for (const [sub, count] of sorted) {
    console.log(`  ${sub}: ${count}`);
  }
})();

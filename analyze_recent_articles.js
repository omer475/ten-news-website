/**
 * Analyze articles from the last 12 hours in published_articles
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const twelveHoursAgo = new Date(Date.now() - 12 * 3600000).toISOString();
  console.log(`\nQuerying articles since: ${twelveHoursAgo}`);
  console.log(`Current time: ${new Date().toISOString()}\n`);

  // Supabase limits to 1000 rows by default; paginate to get all
  let allArticles = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, title_news, category, ai_final_score, created_at')
      .gte('created_at', twelveHoursAgo)
      .order('ai_final_score', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    allArticles = allArticles.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log('=' .repeat(80));
  console.log(`TOTAL ARTICLES IN LAST 12 HOURS: ${allArticles.length}`);
  console.log('='.repeat(80));

  if (allArticles.length === 0) {
    console.log('No articles found. Exiting.');
    return;
  }

  // --- Count per category ---
  const categoryCounts = {};
  const categoryArticles = {};
  for (const a of allArticles) {
    const cat = a.category || 'Uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    if (!categoryArticles[cat]) categoryArticles[cat] = [];
    categoryArticles[cat].push(a);
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  console.log('\n--- ARTICLES PER CATEGORY ---');
  for (const [cat, count] of sortedCategories) {
    console.log(`  ${cat}: ${count}`);
  }

  // --- Top 10 per category ---
  console.log('\n--- TOP 10 ARTICLES PER CATEGORY (by ai_final_score) ---');
  for (const [cat] of sortedCategories) {
    const arts = categoryArticles[cat].sort((a, b) => (b.ai_final_score || 0) - (a.ai_final_score || 0));
    console.log(`\n  [${cat}] (${arts.length} total)`);
    for (const a of arts.slice(0, 10)) {
      const score = a.ai_final_score != null ? a.ai_final_score.toFixed(1) : 'N/A';
      const title = (a.title_news || '(no title)').slice(0, 90);
      console.log(`    ${score}  ${title}`);
    }
  }

  // --- Theme/topic grouping by keywords ---
  console.log('\n\n--- THEME GROUPING (keyword-based) ---');

  const themeKeywords = {
    'Trump / US Politics': ['trump', 'maga', 'gop', 'republican', 'democrat', 'biden', 'congress', 'white house', 'senate', 'impeach'],
    'Ukraine / Russia War': ['ukraine', 'russia', 'putin', 'zelensky', 'kyiv', 'moscow', 'crimea', 'donbas'],
    'Israel / Gaza / Middle East': ['israel', 'gaza', 'hamas', 'hezbollah', 'netanyahu', 'palestine', 'ceasefire', 'west bank', 'idf'],
    'Iran': ['iran', 'tehran', 'khamenei', 'irgc', 'iranian'],
    'AI / Tech': ['ai ', 'artificial intelligence', 'openai', 'chatgpt', 'gemini', 'llm', 'machine learning', 'deepseek', 'nvidia', 'chip'],
    'Big Tech': ['apple', 'google', 'microsoft', 'meta', 'amazon', 'tiktok', 'facebook', 'instagram'],
    'Crypto / Bitcoin': ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'stablecoin', 'defi'],
    'Climate / Environment': ['climate', 'carbon', 'emission', 'warming', 'wildfire', 'flood', 'drought', 'glacier', 'renewable'],
    'Space': ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'astronaut', 'asteroid', 'starship'],
    'Football / Soccer': ['football', 'soccer', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'fifa', 'goal', 'midfielder'],
    'F1 / Motorsport': ['f1', 'formula 1', 'grand prix', 'verstappen', 'hamilton', 'leclerc', 'norris'],
    'NBA / Basketball': ['nba', 'basketball', 'lakers', 'celtics', 'lebron'],
    'NFL / American Football': ['nfl', 'super bowl', 'touchdown', 'quarterback'],
    'Tennis': ['tennis', 'djokovic', 'nadal', 'sinner', 'swiatek', 'wimbledon'],
    'Economy / Markets': ['stock', 'nasdaq', 'dow', 'wall street', 'fed ', 'interest rate', 'inflation', 'gdp', 'recession', 'tariff'],
    'Oil / Energy': ['oil', 'crude', 'opec', 'barrel', 'natural gas', 'pipeline'],
    'Health / Medicine': ['cancer', 'vaccine', 'alzheimer', 'drug', 'disease', 'hospital', 'who ', 'pandemic', 'treatment'],
    'Turkey': ['turkey', 'turkish', 'erdogan', 'ankara', 'istanbul', 'galatasaray', 'fenerbahce', 'besiktas'],
    'China': ['china', 'chinese', 'beijing', 'xi jinping', 'taiwan'],
    'India': ['india', 'indian', 'modi', 'delhi', 'mumbai', 'bollywood'],
    'Europe / EU': ['eu ', 'european', 'brussels', 'macron', 'scholz', 'starmer', 'merz'],
    'Military / Defense': ['military', 'missile', 'strike', 'bomb', 'airstrike', 'navy', 'submarine', 'troops', 'nato', 'pentagon', 'defense'],
    'Crime / Law': ['murder', 'arrest', 'prison', 'trial', 'court', 'judge', 'verdict', 'sentenced', 'police', 'shooting'],
    'Entertainment / Celebrity': ['movie', 'film', 'oscar', 'grammy', 'celebrity', 'actor', 'actress', 'netflix', 'disney', 'album'],
  };

  const themeResults = {};
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    const matched = allArticles.filter(a => {
      const title = (a.title_news || '').toLowerCase();
      return keywords.some(kw => title.includes(kw));
    });
    if (matched.length > 0) {
      themeResults[theme] = matched;
    }
  }

  const sortedThemes = Object.entries(themeResults).sort((a, b) => b[1].length - a[1].length);

  for (const [theme, articles] of sortedThemes) {
    console.log(`\n  [${theme}] — ${articles.length} articles`);
    const top = articles.sort((a, b) => (b.ai_final_score || 0) - (a.ai_final_score || 0));
    for (const a of top.slice(0, 5)) {
      const score = a.ai_final_score != null ? a.ai_final_score.toFixed(1) : 'N/A';
      console.log(`    ${score}  ${(a.title_news || '').slice(0, 85)}`);
    }
  }

  // Score distribution
  console.log('\n\n--- SCORE DISTRIBUTION ---');
  const ranges = [
    [90, 100], [80, 90], [70, 80], [60, 70], [50, 60], [40, 50], [30, 40], [20, 30], [10, 20], [0, 10]
  ];
  for (const [lo, hi] of ranges) {
    const count = allArticles.filter(a => (a.ai_final_score || 0) >= lo && (a.ai_final_score || 0) < hi).length;
    if (count > 0) {
      const bar = '#'.repeat(Math.ceil(count / 2));
      console.log(`  ${lo}-${hi}: ${count.toString().padStart(4)} ${bar}`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

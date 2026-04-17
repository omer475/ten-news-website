/**
 * V2 Feed Test — 6 users with 4-5 distinct interests, real taste vectors.
 */

const BASE_URL = 'https://www.tennews.ai';

const USERS = [
  {
    name: 'Turkish Football & Culture Fan',
    userId: '325fad3f-a873-4826-b023-8f6dc49dc978',
    interests: ['Turkish Football', 'Turkish Politics', 'Istanbul Life', 'Women Rights', 'Mediterranean'],
    keywords: ['galatasaray', 'fenerbahce', 'turkey', 'turkish', 'istanbul', 'ankara', 'erdogan', 'imamoglu', 'women', 'feminist', 'cyprus', 'greece', 'football', 'soccer'],
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Greece'],
    followedTopics: ['Sports', 'Politics'],
  },
  {
    name: 'F1 & Automotive Enthusiast',
    userId: '22957ba8-e13e-4414-a898-b99845535af4',
    interests: ['Formula 1', 'Automotive', 'Aviation', 'UK News'],
    keywords: ['f1', 'formula', 'verstappen', 'hamilton', 'leclerc', 'norris', 'ferrari', 'mclaren', 'tesla', 'ev', 'electric vehicle', 'car', 'boeing', 'airbus', 'aviation', 'airline', 'uk', 'britain', 'london', 'starmer'],
    homeCountry: 'UK',
    followedCountries: ['UK', 'Italy', 'Germany'],
    followedTopics: ['Sports', 'Business', 'Tech'],
  },
  {
    name: 'Silicon Valley AI Geek',
    userId: 'fd7664b4-f650-4471-8163-a0588fa25f81',
    interests: ['AI & LLMs', 'Big Tech', 'Cybersecurity', 'Startups', 'Robotics'],
    keywords: ['openai', 'chatgpt', 'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'apple', 'google', 'microsoft', 'meta', 'nvidia', 'hack', 'cyber', 'security', 'startup', 'ipo', 'valuation', 'robot', 'drone', 'autonomous'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Business'],
  },
  {
    name: 'Wall Street & Commodities Trader',
    userId: 'd98977f0-a3b9-47ad-9bf3-c1569b61947a',
    interests: ['Oil Markets', 'Stock Market', 'Crypto', 'Central Banks', 'Real Estate'],
    keywords: ['oil', 'crude', 'opec', 'barrel', 'refinery', 'stock', 'nasdaq', 'dow', 'wall street', 'bitcoin', 'crypto', 'ethereum', 'stablecoin', 'fed', 'interest rate', 'inflation', 'central bank', 'treasury', 'bond', 'housing', 'mortgage'],
    homeCountry: 'US',
    followedCountries: ['US', 'UK', 'Japan'],
    followedTopics: ['Finance', 'Business', 'Economy'],
  },
  {
    name: 'War & Defense Analyst',
    userId: 'c9bf839b-037e-477d-a8df-1ae1b594a006',
    interests: ['Iran-Israel', 'Russia-Ukraine', 'Military Ops', 'NATO', 'Gaza'],
    keywords: ['iran', 'israel', 'tehran', 'netanyahu', 'khamenei', 'ukraine', 'russia', 'zelensky', 'putin', 'military', 'missile', 'strike', 'bomb', 'airstrike', 'navy', 'submarine', 'nato', 'pentagon', 'defense', 'troops', 'gaza', 'palestine', 'hamas', 'hezbollah'],
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
  },
  {
    name: 'Green Science & Space Explorer',
    userId: 'fc1397a1-b0a2-442d-824b-97e4e66d8833',
    interests: ['Space', 'Climate', 'Renewable Energy', 'Medical Research', 'Ocean'],
    keywords: ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'asteroid', 'climate', 'carbon', 'emission', 'solar', 'wind', 'renewable', 'nuclear', 'hydrogen', 'battery', 'cancer', 'vaccine', 'alzheimer', 'drug', 'treatment', 'ocean', 'marine', 'whale'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Science', 'Health', 'Climate'],
  },
];

async function fetchFeed(params) {
  const url = new URL(`${BASE_URL}/api/feed/main`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

function matchesInterest(article, keywords) {
  const text = [article.title || '', article.category || ''].join(' ').toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function categorizeMatch(article, user) {
  const text = [article.title || ''].join(' ').toLowerCase();
  for (const interest of user.interests) {
    // Check if any keyword from the original interest config matches
    const kwMap = {
      'Turkish Football': ['galatasaray', 'fenerbahce', 'football', 'soccer'],
      'Turkish Politics': ['erdogan', 'ankara', 'imamoglu', 'turkish parliament'],
      'Istanbul Life': ['istanbul', 'turkish'],
      'Women Rights': ['women', 'feminist', 'gender'],
      'Mediterranean': ['cyprus', 'greece', 'mediterranean'],
      'Formula 1': ['f1', 'formula', 'verstappen', 'hamilton', 'leclerc', 'norris', 'grand prix'],
      'Automotive': ['tesla', 'ev', 'electric vehicle', 'car', 'automotive'],
      'Aviation': ['boeing', 'airbus', 'aviation', 'airline', 'flight'],
      'UK News': ['uk', 'britain', 'london', 'starmer'],
      'AI & LLMs': ['openai', 'chatgpt', 'ai', 'llm', 'gpt', 'claude'],
      'Big Tech': ['apple', 'google', 'microsoft', 'meta', 'nvidia'],
      'Cybersecurity': ['hack', 'cyber', 'security', 'breach'],
      'Startups': ['startup', 'ipo', 'valuation', 'funding'],
      'Robotics': ['robot', 'autonomous', 'drone'],
      'Oil Markets': ['oil', 'crude', 'opec', 'barrel', 'refinery', 'fuel'],
      'Stock Market': ['stock', 'nasdaq', 'dow', 'wall street', 'plunge', 'rally'],
      'Crypto': ['bitcoin', 'crypto', 'ethereum', 'stablecoin'],
      'Central Banks': ['fed', 'interest rate', 'inflation', 'central bank', 'treasury', 'bond'],
      'Real Estate': ['housing', 'mortgage', 'real estate', 'property'],
      'Iran-Israel': ['iran', 'israel', 'tehran', 'netanyahu', 'khamenei'],
      'Russia-Ukraine': ['ukraine', 'russia', 'zelensky', 'putin', 'crimea'],
      'Military Ops': ['military', 'missile', 'strike', 'bomb', 'airstrike', 'navy', 'submarine'],
      'NATO': ['nato', 'pentagon', 'defense', 'troops'],
      'Gaza': ['gaza', 'palestine', 'hamas', 'hezbollah'],
      'Space': ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'asteroid'],
      'Climate': ['climate', 'carbon', 'emission', 'warming'],
      'Renewable Energy': ['solar', 'wind', 'renewable', 'nuclear', 'hydrogen', 'battery'],
      'Medical Research': ['cancer', 'vaccine', 'alzheimer', 'drug', 'treatment', 'disease'],
      'Ocean': ['ocean', 'marine', 'whale', 'reef'],
    };
    const kws = kwMap[interest] || [];
    if (kws.some(kw => text.includes(kw))) return interest;
  }
  return null;
}

async function simulateUser(user) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`USER: ${user.name}`);
  console.log(`Interests: ${user.interests.join(' | ')}`);
  console.log('='.repeat(70));

  const seenIds = [], engagedIds = [], skippedIds = [];
  let totalArticles = 0, page = 0, cursor = null, hasMore = true;
  const categoryCount = {}, bucketCount = {}, interestCount = {};
  const matchedArticles = [];

  while (hasMore && page < 30) {
    page++;
    const params = {
      limit: 25, user_id: user.userId,
      home_country: user.homeCountry,
      followed_countries: user.followedCountries.join(','),
      followed_topics: user.followedTopics.join(','),
    };
    if (cursor) params.cursor = cursor;
    if (engagedIds.length > 0) params.engaged_ids = engagedIds.join(',');
    if (skippedIds.length > 0) params.skipped_ids = skippedIds.join(',');
    if (seenIds.length > 0) params.seen_ids = seenIds.slice(-200).join(',');

    try {
      const result = await fetchFeed(params);
      const articles = result.articles || [];
      if (articles.length === 0) { console.log(`  Page ${page}: Empty`); break; }

      let pageEngaged = 0, pageSkipped = 0;
      for (const article of articles) {
        const id = String(article.id);
        if (seenIds.includes(id)) continue;
        seenIds.push(id);
        totalArticles++;

        const cat = article.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        const bucket = article.bucket || 'unknown';
        bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

        const interest = categorizeMatch(article, user);
        if (interest) {
          interestCount[interest] = (interestCount[interest] || 0) + 1;
          engagedIds.push(id);
          pageEngaged++;
          matchedArticles.push({ title: article.title, category: cat, bucket, interest, score: article.final_score });
        } else {
          if (Math.random() < 0.5) { skippedIds.push(id); pageSkipped++; }
        }
      }

      console.log(`  Page ${page}: ${articles.length} articles | engaged=${pageEngaged} skipped=${pageSkipped} | total=${totalArticles}`);
      cursor = result.next_cursor;
      hasMore = result.has_more;
      if (!cursor) break;
    } catch (err) {
      console.log(`  Page ${page}: ERROR — ${err.message}`);
      break;
    }
  }

  const totalEngaged = engagedIds.length;
  const matchPct = totalArticles > 0 ? ((totalEngaged / totalArticles) * 100).toFixed(1) : '0';

  console.log(`\n  --- RESULTS ---`);
  console.log(`  Total: ${totalArticles} | Engaged: ${totalEngaged} (${matchPct}%)`);

  console.log(`\n  Interest breakdown:`);
  for (const interest of user.interests) {
    const count = interestCount[interest] || 0;
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`    ${interest.padEnd(20)} ${String(count).padStart(3)} ${bar}`);
  }

  console.log(`\n  Category distribution:`);
  for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(15)} ${String(count).padStart(3)}`);
  }

  console.log(`\n  Buckets: ${Object.entries(bucketCount).map(([b, c]) => `${b}=${c}`).join(' | ')}`);

  console.log(`\n  Top matched articles:`);
  for (const m of matchedArticles.slice(0, 12)) {
    console.log(`    [${m.interest}] ${m.category} — ${m.title?.slice(0, 60)}`);
  }

  return { name: user.name, totalArticles, engaged: totalEngaged, matchRate: matchPct, interestCount, buckets: bucketCount, pages: page };
}

async function main() {
  console.log('V2 Feed Test — 6 Users with Distinct Multi-Interest Taste Vectors');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results = [];
  for (const user of USERS) {
    results.push(await simulateUser(user));
  }

  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log('User'.padEnd(35) + 'Articles'.padStart(8) + 'Engaged'.padStart(8) + 'Match%'.padStart(8) + 'Pages'.padStart(6));
  console.log('-'.repeat(65));
  for (const r of results) {
    console.log(r.name.padEnd(35) + String(r.totalArticles).padStart(8) + String(r.engaged).padStart(8) + (r.matchRate + '%').padStart(8) + String(r.pages).padStart(6));
  }

  console.log('\nInterest coverage per user:');
  for (const r of results) {
    const covered = Object.keys(r.interestCount).length;
    const total = USERS.find(u => u.name === r.name).interests.length;
    const interests = Object.entries(r.interestCount).map(([i, c]) => `${i}(${c})`).join(', ');
    console.log(`  ${r.name}: ${covered}/${total} interests hit — ${interests}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

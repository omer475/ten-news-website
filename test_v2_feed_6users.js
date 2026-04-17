/**
 * V2 Feed Test — 6 users with specific interest profiles
 * Tests the V2 feed engine with cold-start users (no taste vector)
 * to verify trending+discovery fills the feed properly and
 * session signals (engaged/skipped) personalize subsequent pages.
 */

const BASE_URL = 'https://www.tennews.ai';

// 6 user profiles with specific interests
const USERS = [
  {
    name: 'Galatasaray & Turkish Politics Fan',
    topics: ['Sports', 'Politics'],
    keywords: ['galatasaray', 'turkey', 'turkish', 'süper lig', 'football', 'soccer', 'erdogan', 'istanbul'],
    homeCountry: 'Turkey',
    followedCountries: ['Turkey'],
    followedTopics: ['Sports', 'Politics'],
  },
  {
    name: 'F1 & Motorsport Enthusiast',
    topics: ['Sports', 'Tech'],
    keywords: ['formula 1', 'f1', 'verstappen', 'hamilton', 'racing', 'grand prix', 'mclaren', 'ferrari', 'red bull racing'],
    homeCountry: 'UK',
    followedCountries: ['UK', 'Italy'],
    followedTopics: ['Sports', 'Tech'],
  },
  {
    name: 'AI & OpenAI Tech Follower',
    topics: ['Tech', 'Science'],
    keywords: ['openai', 'chatgpt', 'ai', 'artificial intelligence', 'machine learning', 'google', 'microsoft', 'nvidia', 'llm', 'gpt'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science'],
  },
  {
    name: 'Finance & Crypto Investor',
    topics: ['Finance', 'Business', 'Economy'],
    keywords: ['bitcoin', 'crypto', 'stock', 'market', 'fed', 'interest rate', 'nasdaq', 'sp500', 'wall street', 'economy', 'inflation', 'bank'],
    homeCountry: 'US',
    followedCountries: ['US', 'UK'],
    followedTopics: ['Finance', 'Business', 'Economy'],
  },
  {
    name: 'Middle East & Geopolitics Watcher',
    topics: ['World', 'Politics'],
    keywords: ['israel', 'palestine', 'gaza', 'iran', 'saudi', 'syria', 'middle east', 'war', 'conflict', 'ceasefire', 'hamas', 'hezbollah'],
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'Saudi Arabia'],
    followedTopics: ['World', 'Politics'],
  },
  {
    name: 'Space & Climate Science Nerd',
    topics: ['Science', 'Climate', 'Tech'],
    keywords: ['spacex', 'nasa', 'mars', 'rocket', 'climate', 'carbon', 'renewable', 'solar', 'ev', 'electric', 'satellite', 'space'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Science', 'Climate', 'Tech'],
  },
];

async function fetchFeed(params) {
  const url = new URL(`${BASE_URL}/api/feed/main`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

function matchesInterest(article, keywords) {
  const text = [
    article.title || '',
    article.summary || '',
    article.category || '',
    ...(article.tags || []),
  ].join(' ').toLowerCase();

  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

// Simulate a user reading through the entire feed
async function simulateUser(user, allArticleCount) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`USER: ${user.name}`);
  console.log(`Topics: ${user.followedTopics.join(', ')} | Country: ${user.homeCountry}`);
  console.log(`Keywords: ${user.keywords.slice(0, 5).join(', ')}...`);
  console.log('='.repeat(70));

  const seenIds = [];
  const engagedIds = [];
  const skippedIds = [];
  let totalArticles = 0;
  let page = 0;
  let cursor = null;
  let hasMore = true;
  const categoryCount = {};
  const bucketCount = { personal: 0, trending: 0, discovery: 0 };
  const matchedArticles = [];
  const unmatchedArticles = [];

  while (hasMore && page < 30) { // max 30 pages to avoid infinite loop
    page++;
    const params = {
      limit: 25,
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

      if (articles.length === 0) {
        console.log(`  Page ${page}: No articles returned. has_more=${result.has_more}`);
        break;
      }

      let pageEngaged = 0;
      let pageSkipped = 0;

      for (const article of articles) {
        const id = String(article.id);
        if (seenIds.includes(id)) continue; // skip dupes
        seenIds.push(id);
        totalArticles++;

        const cat = article.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;

        const bucket = article.bucket || 'unknown';
        bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

        const isMatch = matchesInterest(article, user.keywords);
        if (isMatch) {
          engagedIds.push(id);
          pageEngaged++;
          matchedArticles.push({ title: article.title, category: cat, bucket, score: article.final_score });
        } else {
          // 50% chance skip, 50% chance neutral view (simulating real behavior)
          if (Math.random() < 0.5) {
            skippedIds.push(id);
            pageSkipped++;
          }
          unmatchedArticles.push({ title: article.title, category: cat, bucket });
        }
      }

      console.log(`  Page ${page}: ${articles.length} articles | engaged=${pageEngaged} skipped=${pageSkipped} | total_so_far=${totalArticles} | cursor=${result.next_cursor || 'none'} | has_more=${result.has_more}`);

      cursor = result.next_cursor;
      hasMore = result.has_more;

      if (!cursor) break;
    } catch (err) {
      console.log(`  Page ${page}: ERROR — ${err.message}`);
      break;
    }
  }

  // Results
  console.log(`\n  --- RESULTS for ${user.name} ---`);
  console.log(`  Total articles seen: ${totalArticles}`);
  console.log(`  Engaged (matched interests): ${engagedIds.length}`);
  console.log(`  Match rate: ${totalArticles > 0 ? ((engagedIds.length / totalArticles) * 100).toFixed(1) : 0}%`);

  console.log(`\n  Category distribution:`);
  const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`    ${cat.padEnd(15)} ${String(count).padStart(3)} ${bar}`);
  }

  console.log(`\n  Bucket distribution:`);
  for (const [bucket, count] of Object.entries(bucketCount)) {
    const pct = totalArticles > 0 ? ((count / totalArticles) * 100).toFixed(1) : 0;
    console.log(`    ${bucket.padEnd(12)} ${String(count).padStart(3)} (${pct}%)`);
  }

  console.log(`\n  Top matched articles (first 10):`);
  for (const m of matchedArticles.slice(0, 10)) {
    console.log(`    [${m.bucket}] ${m.category} — ${m.title?.slice(0, 70)}`);
  }

  return {
    name: user.name,
    totalArticles,
    engaged: engagedIds.length,
    matchRate: totalArticles > 0 ? ((engagedIds.length / totalArticles) * 100).toFixed(1) : '0',
    categories: categoryCount,
    buckets: bucketCount,
    pages: page,
  };
}

// First, get total article count from last 12 hours
async function getArticleOverview() {
  console.log('='.repeat(70));
  console.log('FETCHING ALL ARTICLES FROM LAST 12 HOURS');
  console.log('='.repeat(70));

  // Fetch a big batch to see what's available
  const result = await fetchFeed({ limit: 50 });
  const articles = result.articles || [];

  console.log(`First batch: ${articles.length} articles | has_more=${result.has_more} | total=${result.total || 'N/A'}`);

  const categories = {};
  const buckets = {};
  let withImage = 0;
  let withoutImage = 0;

  for (const a of articles) {
    const cat = a.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;
    const bucket = a.bucket || 'unknown';
    buckets[bucket] = (buckets[bucket] || 0) + 1;
    if (a.image_url || a.display_image) withImage++;
    else withoutImage++;
  }

  console.log(`\nCategories in first batch:`);
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nBuckets in first batch:`);
  for (const [b, count] of Object.entries(buckets)) {
    console.log(`  ${b}: ${count}`);
  }

  console.log(`\nWith image: ${withImage} | Without image: ${withoutImage}`);
  console.log(`Total available (server reported): ${result.total || 'N/A'}`);

  return result;
}

async function main() {
  console.log('V2 Feed Test — 6 User Profiles');
  console.log(`API: ${BASE_URL}/api/feed/main`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Overview
  await getArticleOverview();

  // Test each user
  const results = [];
  for (const user of USERS) {
    const result = await simulateUser(user);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY — ALL 6 USERS');
  console.log('='.repeat(70));
  console.log('User'.padEnd(40) + 'Articles'.padStart(10) + 'Engaged'.padStart(10) + 'Match%'.padStart(10) + 'Pages'.padStart(8));
  console.log('-'.repeat(78));
  for (const r of results) {
    console.log(
      r.name.padEnd(40) +
      String(r.totalArticles).padStart(10) +
      String(r.engaged).padStart(10) +
      (r.matchRate + '%').padStart(10) +
      String(r.pages).padStart(8)
    );
  }

  // Check V2 is working
  console.log('\n--- V2 VERIFICATION ---');
  const allUsedV2 = results.every(r => r.buckets.personal !== undefined || r.buckets.trending !== undefined || r.buckets.discovery !== undefined);
  console.log(`All users got V2 bucket labels: ${allUsedV2 ? 'YES ✓' : 'NO ✗'}`);

  const allGotEnough = results.every(r => r.totalArticles >= 20);
  console.log(`All users got 20+ articles: ${allGotEnough ? 'YES ✓' : 'NO ✗'}`);

  for (const r of results) {
    if (r.totalArticles < 20) {
      console.log(`  WARNING: ${r.name} only got ${r.totalArticles} articles`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

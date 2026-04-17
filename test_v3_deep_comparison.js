/**
 * DEEP A/B Comparison — designed to expose REAL differences between Legacy V2 and Improved V2.
 *
 * Test #1: PAGINATION — Don't send seen_ids, expose legacy duplicate problem
 * Test #2: COLD-START — Use a fresh user ID (no taste vector) to test Thompson Sampling bandit
 * Test #3: WORLD EVENT FLOODING — Count how many articles from the same world event appear in a page
 */

const BASE_URL = 'https://www.tennews.ai';

// User with many matching interests (to get deep pages)
const POWER_USER = {
  name: 'Iran & Middle East Geopolitics',
  userId: '24ffd676-ef6c-47e7-aed7-e462ec0b7fca',
  interests: {
    'Iran Conflict': ['iran', 'tehran', 'khamenei', 'irgc', 'iranian'],
    'Israel Military': ['israel', 'idf', 'netanyahu', 'israeli', 'mossad'],
    'Oil & Energy': ['oil', 'crude', 'opec', 'barrel', 'refinery', 'fuel'],
    'US Military': ['pentagon', 'troops', 'missile', 'submarine', 'navy', 'airstrike'],
    'Gaza & Lebanon': ['gaza', 'hamas', 'hezbollah', 'ceasefire', 'lebanon'],
  },
  homeCountry: 'US',
  followedCountries: ['Israel', 'Iran', 'US'],
  followedTopics: ['World', 'Politics'],
};

// Cold-start user (random UUID, no taste vector in DB)
const COLD_START_USER = {
  name: 'Cold Start User (no taste vector)',
  userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  interests: {
    'Sports': ['f1', 'cricket', 'football', 'basketball', 'tennis', 'goal', 'champion'],
    'Entertainment': ['movie', 'film', 'netflix', 'album', 'singer', 'celebrity'],
    'Tech': ['ai', 'openai', 'apple', 'google', 'microsoft', 'nvidia', 'robot'],
    'Finance': ['stock', 'oil', 'bitcoin', 'market', 'inflation', 'treasury'],
    'Science': ['nasa', 'spacex', 'climate', 'cancer', 'vaccine', 'ocean'],
  },
  homeCountry: 'US',
  followedCountries: ['US'],
  followedTopics: ['Sports', 'Tech', 'Entertainment'],
};

async function fetchFeed(params, legacy = false) {
  const url = new URL(`${BASE_URL}/api/feed/main`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  if (legacy) url.searchParams.set('v2_legacy', '1');
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

function categorizeMatch(article, interests) {
  const text = (article.title || '').toLowerCase();
  for (const [interest, keywords] of Object.entries(interests)) {
    if (keywords.some(kw => text.includes(kw))) return interest;
  }
  return null;
}

// ============================================================
// TEST 1: PAGINATION (don't send seen_ids → exposes duplication)
// ============================================================
async function testPagination(user, legacy) {
  const label = legacy ? 'LEGACY' : 'IMPROVED';
  const allIds = [];
  const allArticles = [];
  let cursor = null, hasMore = true, page = 0;
  let totalArticles = 0, duplicateCount = 0;

  while (hasMore && page < 10) {
    page++;
    const params = {
      limit: 25, user_id: user.userId,
      home_country: user.homeCountry,
      followed_countries: user.followedCountries.join(','),
      followed_topics: user.followedTopics.join(','),
      // NO seen_ids — this is intentional to test server-side pagination
    };
    if (cursor) params.cursor = cursor;

    const result = await fetchFeed(params, legacy);
    const articles = result.articles || [];
    if (articles.length === 0) break;

    let pageDupes = 0;
    for (const a of articles) {
      const id = String(a.id);
      if (allIds.includes(id)) {
        pageDupes++;
        duplicateCount++;
      } else {
        allIds.push(id);
        totalArticles++;
        allArticles.push(a);
      }
    }

    process.stdout.write(`    [${label}] Page ${page}: ${articles.length} articles (${pageDupes} dupes) cursor=${result.next_cursor?.slice(0, 20) || 'null'}\n`);

    cursor = result.next_cursor;
    hasMore = result.has_more;
    if (!cursor) break;
  }

  return { totalArticles, duplicateCount, pages: page, uniqueIds: allIds.length };
}

// ============================================================
// TEST 2: COLD-START DIVERSITY (fresh user, no taste vector)
// ============================================================
async function testColdStart(user, legacy) {
  const label = legacy ? 'LEGACY' : 'IMPROVED';
  const categoryCount = {};
  const bucketCount = {};
  const matchedArticles = [];
  const allIds = [];
  let totalArticles = 0;

  const params = {
    limit: 25, user_id: user.userId,
    home_country: user.homeCountry,
    followed_countries: user.followedCountries.join(','),
    followed_topics: user.followedTopics.join(','),
  };

  const result = await fetchFeed(params, legacy);
  const articles = result.articles || [];

  for (const a of articles) {
    const id = String(a.id);
    if (allIds.includes(id)) continue;
    allIds.push(id);
    totalArticles++;

    const cat = a.category || 'Other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    const bucket = a.bucket || 'unknown';
    bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

    const interest = categorizeMatch(a, user.interests);
    if (interest) matchedArticles.push({ title: a.title, category: cat, interest, bucket });
  }

  return { totalArticles, categoryCount, bucketCount, matched: matchedArticles.length, uniqueCategories: Object.keys(categoryCount).length };
}

// ============================================================
// TEST 3: WORLD EVENT FLOODING (check articles per world event per page)
// ============================================================
async function testWorldEventFlooding(user, legacy) {
  const label = legacy ? 'LEGACY' : 'IMPROVED';
  const params = {
    limit: 25, user_id: user.userId,
    home_country: user.homeCountry,
    followed_countries: user.followedCountries.join(','),
    followed_topics: user.followedTopics.join(','),
  };

  const result = await fetchFeed(params, legacy);
  const articles = result.articles || [];

  const eventCount = {};
  const clusterCount = {};
  for (const a of articles) {
    if (a.world_event?.slug) {
      eventCount[a.world_event.slug] = (eventCount[a.world_event.slug] || 0) + 1;
    }
    if (a.cluster_id) {
      clusterCount[a.cluster_id] = (clusterCount[a.cluster_id] || 0) + 1;
    }
  }

  const eventsOver2 = Object.entries(eventCount).filter(([, c]) => c > 2);
  const eventsOver3 = Object.entries(eventCount).filter(([, c]) => c > 3);
  const clustersOver2 = Object.entries(clusterCount).filter(([, c]) => c > 2);
  const clustersOver3 = Object.entries(clusterCount).filter(([, c]) => c > 3);

  return {
    totalArticles: articles.length,
    uniqueEvents: Object.keys(eventCount).length,
    eventsOver2: eventsOver2.length,
    eventsOver3: eventsOver3.length,
    eventDetails: eventsOver2,
    uniqueClusters: Object.keys(clusterCount).length,
    clustersOver2: clustersOver2.length,
    clustersOver3: clustersOver3.length,
    clusterDetails: clustersOver2,
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   DEEP A/B COMPARISON — Exposing Real Differences Between Legacy & Improved V2 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // ===================================================================
  // TEST 1: PAGINATION
  // ===================================================================
  console.log('═'.repeat(80));
  console.log('  TEST 1: PAGINATION (no seen_ids — exposes server-side cursor quality)');
  console.log('  User: ' + POWER_USER.name);
  console.log('═'.repeat(80));

  console.log('\n  --- Legacy V2 ---');
  const legacyPagination = await testPagination(POWER_USER, true);

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n  --- Improved V2 ---');
  const improvedPagination = await testPagination(POWER_USER, false);

  console.log('\n  PAGINATION RESULTS:');
  console.log(`    ${'Metric'.padEnd(25)} ${'Legacy'.padStart(10)} ${'Improved'.padStart(10)} ${'Winner'.padStart(10)}`);
  console.log('    ' + '─'.repeat(55));
  console.log(`    ${'Total Unique Articles'.padEnd(25)} ${String(legacyPagination.totalArticles).padStart(10)} ${String(improvedPagination.totalArticles).padStart(10)} ${legacyPagination.totalArticles > improvedPagination.totalArticles ? 'Legacy' : improvedPagination.totalArticles > legacyPagination.totalArticles ? 'Improved' : 'Tie'}`);
  console.log(`    ${'Duplicate Articles'.padEnd(25)} ${String(legacyPagination.duplicateCount).padStart(10)} ${String(improvedPagination.duplicateCount).padStart(10)} ${legacyPagination.duplicateCount > improvedPagination.duplicateCount ? 'Improved' : improvedPagination.duplicateCount > legacyPagination.duplicateCount ? 'Legacy' : 'Tie'}`);
  console.log(`    ${'Pages Retrieved'.padEnd(25)} ${String(legacyPagination.pages).padStart(10)} ${String(improvedPagination.pages).padStart(10)}`);

  // ===================================================================
  // TEST 2: COLD-START DIVERSITY
  // ===================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('  TEST 2: COLD-START DIVERSITY (fresh user, no taste vector)');
  console.log('  User: ' + COLD_START_USER.name + ' (random UUID)');
  console.log('═'.repeat(80));

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n  --- Legacy V2 ---');
  const legacyCold = await testColdStart(COLD_START_USER, true);
  console.log(`    Total: ${legacyCold.totalArticles} | Matched: ${legacyCold.matched} | Categories: ${legacyCold.uniqueCategories}`);
  console.log(`    Category dist: ${Object.entries(legacyCold.categoryCount).sort((a,b) => b[1]-a[1]).map(([c,n]) => `${c}(${n})`).join(', ')}`);
  console.log(`    Buckets: ${Object.entries(legacyCold.bucketCount).map(([b,c]) => `${b}=${c}`).join(', ')}`);

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n  --- Improved V2 ---');
  const improvedCold = await testColdStart(COLD_START_USER, false);
  console.log(`    Total: ${improvedCold.totalArticles} | Matched: ${improvedCold.matched} | Categories: ${improvedCold.uniqueCategories}`);
  console.log(`    Category dist: ${Object.entries(improvedCold.categoryCount).sort((a,b) => b[1]-a[1]).map(([c,n]) => `${c}(${n})`).join(', ')}`);
  console.log(`    Buckets: ${Object.entries(improvedCold.bucketCount).map(([b,c]) => `${b}=${c}`).join(', ')}`);

  // Calculate category diversity score (Shannon entropy)
  function entropy(counts) {
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    if (total === 0) return 0;
    let h = 0;
    for (const c of Object.values(counts)) {
      if (c === 0) continue;
      const p = c / total;
      h -= p * Math.log2(p);
    }
    return h;
  }

  const legacyEntropy = entropy(legacyCold.categoryCount).toFixed(2);
  const improvedEntropy = entropy(improvedCold.categoryCount).toFixed(2);

  console.log(`\n  COLD-START RESULTS:`);
  console.log(`    ${'Metric'.padEnd(25)} ${'Legacy'.padStart(10)} ${'Improved'.padStart(10)} ${'Winner'.padStart(10)}`);
  console.log('    ' + '─'.repeat(55));
  console.log(`    ${'Articles Served'.padEnd(25)} ${String(legacyCold.totalArticles).padStart(10)} ${String(improvedCold.totalArticles).padStart(10)}`);
  console.log(`    ${'Unique Categories'.padEnd(25)} ${String(legacyCold.uniqueCategories).padStart(10)} ${String(improvedCold.uniqueCategories).padStart(10)} ${improvedCold.uniqueCategories > legacyCold.uniqueCategories ? 'Improved' : legacyCold.uniqueCategories > improvedCold.uniqueCategories ? 'Legacy' : 'Tie'}`);
  console.log(`    ${'Category Entropy'.padEnd(25)} ${String(legacyEntropy).padStart(10)} ${String(improvedEntropy).padStart(10)} ${parseFloat(improvedEntropy) > parseFloat(legacyEntropy) ? 'Improved' : parseFloat(legacyEntropy) > parseFloat(improvedEntropy) ? 'Legacy' : 'Tie'}`);
  console.log(`    ${'Matched Interests'.padEnd(25)} ${String(legacyCold.matched).padStart(10)} ${String(improvedCold.matched).padStart(10)}`);

  // Top category dominance check
  const legacyTop = Math.max(...Object.values(legacyCold.categoryCount));
  const improvedTop = Math.max(...Object.values(improvedCold.categoryCount));
  const legacyDom = ((legacyTop / legacyCold.totalArticles) * 100).toFixed(0);
  const improvedDom = ((improvedTop / improvedCold.totalArticles) * 100).toFixed(0);
  console.log(`    ${'Top Cat Dominance'.padEnd(25)} ${(legacyDom + '%').padStart(10)} ${(improvedDom + '%').padStart(10)} ${parseFloat(improvedDom) < parseFloat(legacyDom) ? 'Improved' : parseFloat(legacyDom) < parseFloat(improvedDom) ? 'Legacy' : 'Tie'}`);

  // ===================================================================
  // TEST 3: WORLD EVENT FLOODING
  // ===================================================================
  console.log('\n' + '═'.repeat(80));
  console.log('  TEST 3: WORLD EVENT FLOODING (first page, Iran-heavy user)');
  console.log('  User: ' + POWER_USER.name);
  console.log('═'.repeat(80));

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n  --- Legacy V2 ---');
  const legacyFlood = await testWorldEventFlooding(POWER_USER, true);
  console.log(`    ${legacyFlood.totalArticles} articles | ${legacyFlood.uniqueEvents} unique events | ${legacyFlood.eventsOver2} events >2 | ${legacyFlood.eventsOver3} events >3`);
  if (legacyFlood.eventDetails.length > 0) {
    for (const [slug, count] of legacyFlood.eventDetails) {
      console.log(`      ${slug}: ${count} articles`);
    }
  }
  console.log(`    ${legacyFlood.uniqueClusters} unique clusters | ${legacyFlood.clustersOver2} clusters >2 | ${legacyFlood.clustersOver3} clusters >3`);
  if (legacyFlood.clusterDetails.length > 0) {
    for (const [cid, count] of legacyFlood.clusterDetails) {
      console.log(`      cluster ${cid}: ${count} articles`);
    }
  }

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n  --- Improved V2 ---');
  const improvedFlood = await testWorldEventFlooding(POWER_USER, false);
  console.log(`    ${improvedFlood.totalArticles} articles | ${improvedFlood.uniqueEvents} unique events | ${improvedFlood.eventsOver2} events >2 | ${improvedFlood.eventsOver3} events >3`);
  if (improvedFlood.eventDetails.length > 0) {
    for (const [slug, count] of improvedFlood.eventDetails) {
      console.log(`      ${slug}: ${count} articles`);
    }
  }
  console.log(`    ${improvedFlood.uniqueClusters} unique clusters | ${improvedFlood.clustersOver2} clusters >2 | ${improvedFlood.clustersOver3} clusters >3`);
  if (improvedFlood.clusterDetails.length > 0) {
    for (const [cid, count] of improvedFlood.clusterDetails) {
      console.log(`      cluster ${cid}: ${count} articles`);
    }
  }

  console.log(`\n  FLOODING RESULTS:`);
  console.log(`    ${'Metric'.padEnd(25)} ${'Legacy'.padStart(10)} ${'Improved'.padStart(10)} ${'Winner'.padStart(10)}`);
  console.log('    ' + '─'.repeat(55));
  console.log(`    ${'Events >3 articles'.padEnd(25)} ${String(legacyFlood.eventsOver3).padStart(10)} ${String(improvedFlood.eventsOver3).padStart(10)} ${improvedFlood.eventsOver3 < legacyFlood.eventsOver3 ? 'Improved' : legacyFlood.eventsOver3 < improvedFlood.eventsOver3 ? 'Legacy' : 'Tie'}`);
  console.log(`    ${'Events >2 articles'.padEnd(25)} ${String(legacyFlood.eventsOver2).padStart(10)} ${String(improvedFlood.eventsOver2).padStart(10)} ${improvedFlood.eventsOver2 < legacyFlood.eventsOver2 ? 'Improved' : legacyFlood.eventsOver2 < improvedFlood.eventsOver2 ? 'Legacy' : 'Tie'}`);
  console.log(`    ${'Clusters >3 articles'.padEnd(25)} ${String(legacyFlood.clustersOver3).padStart(10)} ${String(improvedFlood.clustersOver3).padStart(10)} ${improvedFlood.clustersOver3 < legacyFlood.clustersOver3 ? 'Improved' : legacyFlood.clustersOver3 < improvedFlood.clustersOver3 ? 'Legacy' : 'Tie'}`);

  // ===================================================================
  // FINAL VERDICT
  // ===================================================================
  console.log('\n\n' + '█'.repeat(80));
  console.log('  FINAL VERDICT');
  console.log('█'.repeat(80));

  let improvedWins = 0, legacyWins = 0;

  // Pagination
  if (improvedPagination.duplicateCount < legacyPagination.duplicateCount) { improvedWins++; console.log('  ✓ Pagination: IMPROVED (fewer dupes)'); }
  else if (legacyPagination.duplicateCount < improvedPagination.duplicateCount) { legacyWins++; console.log('  ✗ Pagination: LEGACY (fewer dupes)'); }
  else console.log('  → Pagination: TIE');

  // More unique articles
  if (improvedPagination.totalArticles > legacyPagination.totalArticles) { improvedWins++; console.log('  ✓ Content Depth: IMPROVED (more unique articles)'); }
  else if (legacyPagination.totalArticles > improvedPagination.totalArticles) { legacyWins++; console.log('  ✗ Content Depth: LEGACY (more unique articles)'); }
  else console.log('  → Content Depth: TIE');

  // Cold-start diversity
  if (parseFloat(improvedEntropy) > parseFloat(legacyEntropy)) { improvedWins++; console.log('  ✓ Cold-Start Diversity: IMPROVED (higher entropy)'); }
  else if (parseFloat(legacyEntropy) > parseFloat(improvedEntropy)) { legacyWins++; console.log('  ✗ Cold-Start Diversity: LEGACY (higher entropy)'); }
  else console.log('  → Cold-Start Diversity: TIE');

  // Event flooding
  if (improvedFlood.eventsOver3 < legacyFlood.eventsOver3) { improvedWins++; console.log('  ✓ Event Dedup: IMPROVED (fewer floods)'); }
  else if (legacyFlood.eventsOver3 < improvedFlood.eventsOver3) { legacyWins++; console.log('  ✗ Event Dedup: LEGACY (fewer floods)'); }
  else console.log('  → Event Dedup: TIE');

  // Cluster flooding
  if (improvedFlood.clustersOver3 < legacyFlood.clustersOver3) { improvedWins++; console.log('  ✓ Cluster Dedup: IMPROVED (fewer floods)'); }
  else if (legacyFlood.clustersOver3 < improvedFlood.clustersOver3) { legacyWins++; console.log('  ✗ Cluster Dedup: LEGACY (fewer floods)'); }
  else console.log('  → Cluster Dedup: TIE');

  console.log(`\n  Score: IMPROVED ${improvedWins} — ${legacyWins} LEGACY`);
  console.log('═'.repeat(80));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

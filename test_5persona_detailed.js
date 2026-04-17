const https = require('https');
const http = require('http');

// ============================================================================
// 5-PERSONA DETAILED FEED SIMULATION
// Tests the V2 feed with realistic user behavior over multiple pages
// ============================================================================

const API_BASE = 'https://www.tennews.ai/api/feed/main';

// 5 Realistic Personas
const PERSONAS = [
  {
    name: 'Sarah',
    bio: 'Tech worker in San Francisco. AI researcher. Loves gaming and Apple products.',
    interests: ['artificial intelligence', 'tech', 'apple', 'video games', 'gaming', 'science', 'space exploration', 'nasa', 'consumer electronics', 'imac', 'technology', 'startups', 'software'],
    categories: ['Tech', 'Science'],
    avoidCategories: ['Sports', 'World'],
    avoidTags: ['iran', 'soccer', 'football', 'nfl', 'baseball', 'basketball', 'formula 1', 'motorsport', 'wwe'],
  },
  {
    name: 'Marco',
    bio: 'Italian sports journalist. Lives and breathes football, F1, and basketball.',
    interests: ['sports', 'soccer', 'football', 'formula 1', 'motorsport', 'basketball', 'nfl', 'baseball', 'italy', 'serie a', 'champions league', 'athletics'],
    categories: ['Sports'],
    avoidCategories: ['Finance', 'World', 'Politics'],
    avoidTags: ['iran', 'middle east', 'geopolitics', 'international relations', 'stock market', 'inflation', 'donald trump'],
  },
  {
    name: 'Elena',
    bio: 'Political science professor in Berlin. Follows global affairs, conflicts, diplomacy.',
    interests: ['politics', 'international relations', 'geopolitics', 'iran', 'middle east', 'russia', 'ukraine', 'israel', 'military', 'national security', 'germany', 'german politics', 'europe', 'diplomacy', 'turkey'],
    categories: ['World', 'Politics'],
    avoidCategories: ['Sports', 'Entertainment'],
    avoidTags: ['sports', 'soccer', 'football', 'nfl', 'wwe', 'netflix', 'streaming', 'film', 'baseball'],
  },
  {
    name: 'James',
    bio: 'Wall Street trader. Watches markets, crypto, business news obsessively.',
    interests: ['finance', 'stock market', 'oil prices', 'inflation', 'federal reserve', 'business', 'crypto', 'cryptocurrency', 'stablecoins', 'energy', 'nuclear energy', 'retail', 'ceo', 'infrastructure', 'trade'],
    categories: ['Finance', 'Business', 'Crypto'],
    avoidCategories: ['Sports', 'Entertainment'],
    avoidTags: ['sports', 'soccer', 'football', 'wwe', 'netflix', 'streaming', 'film', 'music', 'concert'],
  },
  {
    name: 'Priya',
    bio: 'Film critic and culture writer in Mumbai. Loves movies, TV, music, gaming.',
    interests: ['entertainment', 'film', 'streaming', 'television', 'movies', 'netflix', 'music', 'concert', 'wwe', 'video games', 'celebrity', 'bollywood', 'india'],
    categories: ['Entertainment', 'Tech'],
    avoidCategories: ['World', 'Politics', 'Finance'],
    avoidTags: ['iran', 'middle east', 'geopolitics', 'international relations', 'stock market', 'inflation', 'military', 'national security'],
  }
];

// ============================================================================
// Simulate dwell time based on persona interest matching
// ============================================================================
function simulateDwell(persona, article) {
  const tags = (article.interestTags || article.interest_tags || article.topics || []).map(t => t.toLowerCase());
  const category = (article.category || '').trim();

  // Calculate interest match
  let interestMatch = 0;
  let avoidMatch = 0;

  for (const tag of tags) {
    if (persona.interests.includes(tag)) interestMatch++;
    if (persona.avoidTags.includes(tag)) avoidMatch++;
  }
  if (persona.categories.includes(category)) interestMatch += 2;
  if (persona.avoidCategories.includes(category)) avoidMatch += 2;

  // Determine dwell time
  if (avoidMatch >= 2 && interestMatch === 0) {
    // Strong avoid - quick skip (1-2s)
    return { dwell: 1.0 + Math.random() * 1.0, signal: 'SKIP', reason: 'not interested at all' };
  }
  if (avoidMatch > 0 && interestMatch <= 1) {
    // Mild avoid - brief glance (1.5-2.5s)
    return { dwell: 1.5 + Math.random() * 1.0, signal: 'SKIP', reason: 'mostly uninterested' };
  }
  if (interestMatch === 0) {
    // No match but no avoid - scan briefly (2-4s)
    const d = 2.0 + Math.random() * 2.0;
    return { dwell: d, signal: d < 3 ? 'SKIP' : 'NEUTRAL', reason: 'no strong interest' };
  }
  if (interestMatch === 1) {
    // Slight interest - read headline (3-5s)
    const d = 3.0 + Math.random() * 2.0;
    return { dwell: d, signal: d < 3 ? 'SKIP' : (d >= 5 ? 'ENGAGE' : 'NEUTRAL'), reason: 'mild interest' };
  }
  if (interestMatch >= 2) {
    // Strong interest - read article (5-15s)
    const d = 5.0 + Math.random() * 10.0;
    return { dwell: d, signal: 'ENGAGE', reason: 'highly interested' };
  }
  return { dwell: 2.5, signal: 'SKIP', reason: 'default' };
}

// ============================================================================
// Fetch feed page from API
// ============================================================================
function fetchFeed(params) {
  return new Promise((resolve, reject) => {
    let url = API_BASE + '?limit=' + (params.limit || 25);
    if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
    if (params.userId) url += '&user_id=' + encodeURIComponent(params.userId);
    if (params.engagedIds && params.engagedIds.length) url += '&engaged_ids=' + params.engagedIds.join(',');
    if (params.skippedIds && params.skippedIds.length) url += '&skipped_ids=' + params.skippedIds.join(',');
    if (params.seenIds && params.seenIds.length) url += '&seen_ids=' + params.seenIds.slice(-300).join(',');

    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('Parse error: ' + body.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// Run simulation for one persona
// ============================================================================
async function simulatePersona(persona, personaIndex) {
  const LINE = '═'.repeat(80);
  const THIN = '─'.repeat(80);

  console.log('\n' + LINE);
  console.log(`PERSONA ${personaIndex + 1}: ${persona.name}`);
  console.log(`Bio: ${persona.bio}`);
  console.log(`Interests: ${persona.interests.slice(0, 8).join(', ')}`);
  console.log(`Preferred categories: ${persona.categories.join(', ')}`);
  console.log(`Avoids: ${persona.avoidCategories.join(', ')}`);
  console.log(LINE);

  const engagedIds = [];
  const skippedIds = [];
  const seenIds = [];
  const allInteractions = [];
  let cursor = null;

  // Category tracking
  const categoryStats = { seen: {}, engaged: {}, skipped: {}, neutral: {} };
  // Tag tracking
  const engagedTags = {};
  const skippedTags = {};

  // Simulate 3 pages (75 articles)
  for (let page = 1; page <= 3; page++) {
    console.log(`\n${THIN}`);
    console.log(`PAGE ${page} ${page > 1 ? '(with ' + engagedIds.length + ' engaged + ' + skippedIds.length + ' skipped signals)' : '(cold start - no signals)'}`);
    console.log(THIN);

    const resp = await fetchFeed({
      limit: 25,
      cursor: cursor,
      engagedIds: engagedIds,
      skippedIds: skippedIds,
      seenIds: seenIds,
    });

    if (!resp.articles || resp.articles.length === 0) {
      console.log('  No more articles available.');
      break;
    }

    cursor = resp.nextCursor || resp.next_cursor;
    const articles = resp.articles;

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const id = String(article.id);
      seenIds.push(id);

      const { dwell, signal, reason } = simulateDwell(persona, article);
      const tags = (article.interestTags || article.interest_tags || article.topics || []).map(t => t.toLowerCase());
      const category = (article.category || '').trim();
      const matchedInterests = tags.filter(t => persona.interests.includes(t));
      const matchedAvoids = tags.filter(t => persona.avoidTags.includes(t));

      // Track signals
      if (signal === 'ENGAGE') {
        engagedIds.push(id);
        tags.forEach(t => { engagedTags[t] = (engagedTags[t] || 0) + 1; });
        categoryStats.engaged[category] = (categoryStats.engaged[category] || 0) + 1;
      } else if (signal === 'SKIP') {
        skippedIds.push(id);
        tags.forEach(t => { skippedTags[t] = (skippedTags[t] || 0) + 1; });
        categoryStats.skipped[category] = (categoryStats.skipped[category] || 0) + 1;
      } else {
        categoryStats.neutral[category] = (categoryStats.neutral[category] || 0) + 1;
      }
      categoryStats.seen[category] = (categoryStats.seen[category] || 0) + 1;

      // Clean title for display
      const title = (article.title || '').replace(/\*\*/g, '').substring(0, 60);
      const signalEmoji = signal === 'ENGAGE' ? '🟢' : signal === 'SKIP' ? '🔴' : '🟡';
      const bucket = article.bucket || '-';

      const interaction = {
        page, position: i + 1, id, title, category, bucket,
        dwell: dwell.toFixed(1), signal, reason,
        matchedInterests, matchedAvoids, tags: tags.slice(0, 5)
      };
      allInteractions.push(interaction);

      console.log(`  ${signalEmoji} #${String(i+1).padStart(2)} | ${signal.padEnd(7)} | ${dwell.toFixed(1).padStart(5)}s | ${category.padEnd(14)} | ${title}`);
      if (matchedInterests.length > 0) {
        console.log(`       Matched interests: ${matchedInterests.join(', ')}`);
      }
      if (matchedAvoids.length > 0) {
        console.log(`       Matched avoids: ${matchedAvoids.join(', ')}`);
      }
    }

    // Page summary
    const pageInteractions = allInteractions.filter(i => i.page === page);
    const pageEngaged = pageInteractions.filter(i => i.signal === 'ENGAGE').length;
    const pageSkipped = pageInteractions.filter(i => i.signal === 'SKIP').length;
    const pageNeutral = pageInteractions.filter(i => i.signal === 'NEUTRAL').length;
    const pageCats = {};
    pageInteractions.forEach(i => { pageCats[i.category] = (pageCats[i.category] || 0) + 1; });

    console.log(`\n  PAGE ${page} SUMMARY:`);
    console.log(`    Engaged: ${pageEngaged}/${articles.length} (${(pageEngaged/articles.length*100).toFixed(0)}%)`);
    console.log(`    Skipped: ${pageSkipped}/${articles.length} (${(pageSkipped/articles.length*100).toFixed(0)}%)`);
    console.log(`    Neutral: ${pageNeutral}/${articles.length} (${(pageNeutral/articles.length*100).toFixed(0)}%)`);
    console.log(`    Categories: ${Object.entries(pageCats).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+'('+n+')').join(', ')}`);

    // Show how signals are building
    if (page > 1) {
      console.log(`\n  SIGNAL ACCUMULATION:`);
      console.log(`    Total engaged: ${engagedIds.length} articles`);
      console.log(`    Total skipped: ${skippedIds.length} articles`);

      // Top engaged tags so far
      const topEngTags = Object.entries(engagedTags).sort((a,b)=>b[1]-a[1]).slice(0,8);
      console.log(`    Top engaged tags: ${topEngTags.map(([t,c])=>t+'('+c+')').join(', ')}`);
      const topSkipTags = Object.entries(skippedTags).sort((a,b)=>b[1]-a[1]).slice(0,8);
      console.log(`    Top skipped tags: ${topSkipTags.map(([t,c])=>t+'('+c+')').join(', ')}`);
    }

    // Show feed adaptation between pages
    if (page < 3) {
      console.log(`\n  → Sending ${engagedIds.length} engaged + ${skippedIds.length} skipped signals to next page...`);
    }
  }

  // ============================================================================
  // OVERALL PERSONA ANALYSIS
  // ============================================================================
  console.log('\n' + LINE);
  console.log(`OVERALL ANALYSIS: ${persona.name}`);
  console.log(LINE);

  const totalSeen = allInteractions.length;
  const totalEngaged = allInteractions.filter(i => i.signal === 'ENGAGE').length;
  const totalSkipped = allInteractions.filter(i => i.signal === 'SKIP').length;
  const totalNeutral = allInteractions.filter(i => i.signal === 'NEUTRAL').length;
  const avgDwell = allInteractions.reduce((s, i) => s + parseFloat(i.dwell), 0) / totalSeen;

  console.log(`\n  Total articles seen: ${totalSeen}`);
  console.log(`  Engaged: ${totalEngaged} (${(totalEngaged/totalSeen*100).toFixed(1)}%)`);
  console.log(`  Skipped: ${totalSkipped} (${(totalSkipped/totalSeen*100).toFixed(1)}%)`);
  console.log(`  Neutral: ${totalNeutral} (${(totalNeutral/totalSeen*100).toFixed(1)}%)`);
  console.log(`  Average dwell: ${avgDwell.toFixed(1)}s`);

  // Engagement by category
  console.log(`\n  CATEGORY BREAKDOWN:`);
  const allCats = new Set([...Object.keys(categoryStats.seen)]);
  console.log('  ' + 'Category'.padEnd(16) + 'Seen'.padStart(6) + 'Engaged'.padStart(9) + 'Skipped'.padStart(9) + 'Neutral'.padStart(9) + 'Eng%'.padStart(8));
  for (const cat of [...allCats].sort()) {
    const seen = categoryStats.seen[cat] || 0;
    const eng = categoryStats.engaged[cat] || 0;
    const skip = categoryStats.skipped[cat] || 0;
    const neut = categoryStats.neutral[cat] || 0;
    const rate = seen > 0 ? (eng/seen*100).toFixed(0) + '%' : '-';
    console.log('  ' + cat.padEnd(16) + String(seen).padStart(6) + String(eng).padStart(9) + String(skip).padStart(9) + String(neut).padStart(9) + rate.padStart(8));
  }

  // Feed adaptation analysis: compare engagement rate per page
  console.log(`\n  FEED ADAPTATION (engagement rate per page):`);
  for (let p = 1; p <= 3; p++) {
    const pi = allInteractions.filter(i => i.page === p);
    if (pi.length === 0) continue;
    const eng = pi.filter(i => i.signal === 'ENGAGE').length;
    const rate = (eng / pi.length * 100).toFixed(1);
    const avgD = (pi.reduce((s, i) => s + parseFloat(i.dwell), 0) / pi.length).toFixed(1);
    const cats = {};
    pi.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
    const catStr = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+'('+n+')').join(', ');
    console.log(`    Page ${p}: ${rate}% engagement, avg ${avgD}s dwell | ${catStr}`);
  }

  // Bucket distribution
  const buckets = {};
  allInteractions.forEach(i => { buckets[i.bucket] = (buckets[i.bucket] || 0) + 1; });
  console.log(`\n  BUCKET DISTRIBUTION: ${Object.entries(buckets).sort((a,b)=>b[1]-a[1]).map(([b,n])=>b+'('+n+')').join(', ')}`);

  // Final engaged tag profile
  const topEng = Object.entries(engagedTags).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topSkip = Object.entries(skippedTags).sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.log(`\n  FINAL INTEREST PROFILE (engaged tags):`);
  topEng.forEach(([t,c]) => console.log(`    ${t}: ${c}`));
  console.log(`\n  FINAL SKIP PROFILE (skipped tags):`);
  topSkip.forEach(([t,c]) => console.log(`    ${t}: ${c}`));

  return {
    name: persona.name,
    totalSeen, totalEngaged, totalSkipped, totalNeutral, avgDwell,
    engagementRate: totalEngaged / totalSeen,
    categoryStats, engagedTags, skippedTags,
    pageEngRates: [1,2,3].map(p => {
      const pi = allInteractions.filter(i => i.page === p);
      if (pi.length === 0) return null;
      return pi.filter(i => i.signal === 'ENGAGE').length / pi.length;
    }),
    allInteractions
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║      5-PERSONA DETAILED FEED SIMULATION — V2 FEED ANALYSIS                 ║');
  console.log('║      Testing with 48h articles, 3 pages per persona (75 articles each)      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('Date:', new Date().toISOString());

  const results = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    try {
      const result = await simulatePersona(PERSONAS[i], i);
      results.push(result);
    } catch (err) {
      console.error(`Error simulating ${PERSONAS[i].name}:`, err.message);
    }
  }

  // ============================================================================
  // CROSS-PERSONA COMPARISON
  // ============================================================================
  console.log('\n\n' + '╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CROSS-PERSONA COMPARISON                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  console.log('\n  ' + 'Persona'.padEnd(10) + 'Seen'.padStart(6) + 'Engaged'.padStart(9) + 'Skipped'.padStart(9) + 'EngRate'.padStart(9) + 'AvgDwell'.padStart(10));
  console.log('  ' + '─'.repeat(53));
  for (const r of results) {
    console.log('  ' + r.name.padEnd(10)
      + String(r.totalSeen).padStart(6)
      + String(r.totalEngaged).padStart(9)
      + String(r.totalSkipped).padStart(9)
      + (r.engagementRate * 100).toFixed(1).padStart(8) + '%'
      + (r.avgDwell.toFixed(1) + 's').padStart(10));
  }

  // Feed adaptation comparison
  console.log('\n  FEED ADAPTATION — Engagement rate per page:');
  console.log('  ' + 'Persona'.padEnd(10) + 'Page 1'.padStart(10) + 'Page 2'.padStart(10) + 'Page 3'.padStart(10) + 'Change'.padStart(10));
  console.log('  ' + '─'.repeat(50));
  for (const r of results) {
    const rates = r.pageEngRates.map(r => r !== null ? (r*100).toFixed(1)+'%' : 'N/A');
    const change = (r.pageEngRates[0] !== null && r.pageEngRates[2] !== null)
      ? ((r.pageEngRates[2] - r.pageEngRates[0]) * 100).toFixed(1) + 'pp'
      : 'N/A';
    console.log('  ' + r.name.padEnd(10) + rates[0].padStart(10) + rates[1].padStart(10) + rates[2].padStart(10) + change.padStart(10));
  }

  // Diversity analysis
  console.log('\n  CATEGORY DIVERSITY per persona (how many distinct categories seen):');
  for (const r of results) {
    const cats = Object.keys(r.categoryStats.seen);
    console.log(`    ${r.name}: ${cats.length} categories — ${cats.join(', ')}`);
  }

  // Content flooding analysis
  console.log('\n  CONTENT FLOODING ANALYSIS (World category exposure):');
  for (const r of results) {
    const worldSeen = r.categoryStats.seen['World'] || 0;
    const worldPct = (worldSeen / r.totalSeen * 100).toFixed(1);
    const worldEng = r.categoryStats.engaged['World'] || 0;
    const worldSkip = r.categoryStats.skipped['World'] || 0;
    console.log(`    ${r.name}: ${worldSeen}/${r.totalSeen} articles are World (${worldPct}%) — engaged ${worldEng}, skipped ${worldSkip}`);
  }

  // Iran-specific flooding
  console.log('\n  IRAN-SPECIFIC TAG EXPOSURE:');
  for (const r of results) {
    const iranEng = r.engagedTags['iran'] || 0;
    const iranSkip = r.skippedTags['iran'] || 0;
    const iranTotal = iranEng + iranSkip;
    console.log(`    ${r.name}: ${iranTotal} Iran articles encountered — engaged ${iranEng}, skipped ${iranSkip}`);
  }

  console.log('\n\n' + '╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           KEY FINDINGS                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  // Calculate key metrics
  const avgEngRate = results.reduce((s,r) => s + r.engagementRate, 0) / results.length;
  const avgWorldPct = results.reduce((s,r) => s + ((r.categoryStats.seen['World']||0)/r.totalSeen), 0) / results.length;
  const adaptImproved = results.filter(r => r.pageEngRates[2] !== null && r.pageEngRates[2] > r.pageEngRates[0]).length;

  console.log(`\n  Average engagement rate: ${(avgEngRate*100).toFixed(1)}%`);
  console.log(`  Average World category exposure: ${(avgWorldPct*100).toFixed(1)}%`);
  console.log(`  Personas where feed adapted (P3 > P1): ${adaptImproved}/${results.length}`);
  console.log(`  Average dwell time: ${(results.reduce((s,r)=>s+r.avgDwell,0)/results.length).toFixed(1)}s`);
}

main().catch(console.error);

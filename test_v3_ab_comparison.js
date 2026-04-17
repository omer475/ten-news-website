/**
 * A/B Comparison Test — Improved V2 vs Legacy V2 (original without improvements)
 * Tests 5 users with interests matched to ACTUAL 12-hour content.
 * Measures: match rate, interest coverage, diversity, dedup, pagination, position quality.
 */

const BASE_URL = 'https://www.tennews.ai';

const USERS = [
  {
    name: 'Iran & Middle East Geopolitics',
    userId: '24ffd676-ef6c-47e7-aed7-e462ec0b7fca',
    interests: {
      'Iran Conflict': ['iran', 'tehran', 'khamenei', 'irgc', 'iranian'],
      'Israel Military': ['israel', 'idf', 'netanyahu', 'israeli', 'mossad'],
      'Oil & Energy Crisis': ['oil', 'crude', 'opec', 'barrel', 'refinery', 'fuel', 'gasoline'],
      'US Military': ['pentagon', 'troops', 'missile', 'submarine', 'navy', 'airstrike'],
      'Gaza & Lebanon': ['gaza', 'hamas', 'hezbollah', 'ceasefire', 'lebanon', 'palestine'],
    },
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'US'],
    followedTopics: ['World', 'Politics'],
  },
  {
    name: 'Sports Fanatic',
    userId: '73a3eb20-752d-467a-a13f-f3d15f4f051b',
    interests: {
      'Formula 1': ['f1', 'formula', 'russell', 'verstappen', 'hamilton', 'norris', 'leclerc', 'grand prix', 'qualifying'],
      'Cricket T20': ['cricket', 't20', 'india', 'innings', 'wicket', 'batting', 'bowling', 'ipl'],
      'Football/Soccer': ['chelsea', 'psg', 'premier league', 'champions league', 'football', 'soccer', 'goal', 'transfer'],
      'NBA Basketball': ['nba', 'lebron', 'lakers', 'celtics', 'basketball', 'wnba', 'mitchell'],
      'Tennis & Golf': ['tennis', 'golf', 'wimbledon', 'masters', 'nadal', 'djokovic', 'pga', 'lpga'],
    },
    homeCountry: 'US',
    followedCountries: ['US', 'UK', 'India'],
    followedTopics: ['Sports'],
  },
  {
    name: 'Tech & AI Enthusiast',
    userId: '1c5c8b59-9a10-4fc5-87c5-35595f1de311',
    interests: {
      'AI & LLMs': ['openai', 'chatgpt', 'claude', 'artificial intelligence', 'llm', 'gpt', 'gemini', 'copyright'],
      'Big Tech': ['apple', 'google', 'microsoft', 'meta', 'nvidia', 'amazon', 'macbook'],
      'Space & NASA': ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'asteroid', 'space'],
      'Trump US Politics': ['trump', 'white house', 'congress', 'republican', 'democrat', 'tariff', 'executive order'],
      'Cybersecurity': ['hack', 'cyber', 'breach', 'ransomware', 'privacy', 'data'],
    },
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Politics'],
  },
  {
    name: 'Entertainment & Pop Culture',
    userId: 'cf62649a-ee31-4716-87f2-224ac2479ec7',
    interests: {
      'Movies & TV': ['movie', 'film', 'netflix', 'pixar', 'nolan', 'disney', 'hbo', 'streaming', 'box office', 'trailer'],
      'Music & Celebrity': ['album', 'concert', 'grammy', 'tour', 'celebrity', 'singer', 'rapper', 'musician'],
      'Health & Wellness': ['cancer', 'vaccine', 'alzheimer', 'drug', 'treatment', 'clinical', 'depression', 'mushroom', 'therapy'],
      'Wall Street & Markets': ['wall street', 'stock', 'nasdaq', 'dow', 'market', 'plunge', 'rally', 'investor', 'shares'],
      'Europe Politics': ['starmer', 'macron', 'eu', 'european', 'nato', 'germany', 'france', 'britain'],
    },
    homeCountry: 'UK',
    followedCountries: ['UK', 'US'],
    followedTopics: ['Entertainment', 'Health', 'Business'],
  },
  {
    name: 'Turkey & Ukraine Watcher',
    userId: '338e043d-13fb-4dcc-bd10-adcef358d526',
    interests: {
      'Turkey Politics': ['turkey', 'turkish', 'erdogan', 'imamoglu', 'ankara', 'istanbul', 'cyprus'],
      'Ukraine War': ['ukraine', 'zelensky', 'kyiv', 'crimea', 'drone', 'russia', 'putin', 'moscow'],
      'China & Asia': ['china', 'beijing', 'wang yi', 'xi jinping', 'taiwan', 'japan', 'asia'],
      'Women & Rights': ['women', 'feminist', 'gender', 'march', 'rights', 'protest', 'rally'],
      'Climate & Environment': ['climate', 'wildfire', 'carbon', 'emission', 'flood', 'drought', 'environment'],
    },
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
  },
];

async function fetchFeed(params, legacy = false) {
  const url = new URL(`${BASE_URL}/api/feed/main`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  if (legacy) url.searchParams.set('v2_legacy', '1');
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function categorizeMatch(article, interests) {
  const text = (article.title || '').toLowerCase();
  for (const [interest, keywords] of Object.entries(interests)) {
    if (keywords.some(kw => text.includes(kw))) return interest;
  }
  return null;
}

async function simulateUser(user, legacy = false) {
  const seenIds = [], engagedIds = [], skippedIds = [];
  let totalArticles = 0, page = 0, cursor = null, hasMore = true;
  const categoryCount = {}, bucketCount = {}, interestCount = {};
  const matchedArticles = [];
  const worldEventsSeen = {};
  let duplicateCount = 0;
  const uniqueCategories = new Set();

  while (hasMore && page < 40) {
    page++;
    const params = {
      limit: 25, user_id: user.userId,
      home_country: user.homeCountry,
      followed_countries: user.followedCountries.join(','),
      followed_topics: user.followedTopics.join(','),
    };
    if (cursor) params.cursor = cursor;
    if (engagedIds.length > 0) params.engaged_ids = engagedIds.slice(-50).join(',');
    if (skippedIds.length > 0) params.skipped_ids = skippedIds.slice(-50).join(',');
    if (seenIds.length > 0) params.seen_ids = seenIds.slice(-200).join(',');

    try {
      const result = await fetchFeed(params, legacy);
      const articles = result.articles || [];
      if (articles.length === 0) break;

      for (const article of articles) {
        const id = String(article.id);
        if (seenIds.includes(id)) { duplicateCount++; continue; }
        seenIds.push(id);
        totalArticles++;

        const position = totalArticles;
        const cat = article.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        uniqueCategories.add(cat);
        const bucket = article.bucket || 'unknown';
        bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

        if (article.world_event?.slug) {
          worldEventsSeen[article.world_event.slug] = (worldEventsSeen[article.world_event.slug] || 0) + 1;
        }

        const interest = categorizeMatch(article, user.interests);
        if (interest) {
          interestCount[interest] = (interestCount[interest] || 0) + 1;
          engagedIds.push(id);
          matchedArticles.push({ title: article.title, category: cat, bucket, interest, score: article.final_score, position });
        } else {
          if (Math.random() < 0.4) { skippedIds.push(id); }
        }
      }

      cursor = result.next_cursor;
      hasMore = result.has_more;
      if (!cursor) break;
    } catch (err) {
      console.log(`    Page ${page}: ERROR — ${err.message}`);
      break;
    }
  }

  const totalEngaged = engagedIds.length;
  const matchPct = totalArticles > 0 ? ((totalEngaged / totalArticles) * 100).toFixed(1) : '0';
  const floodedEvents = Object.entries(worldEventsSeen).filter(([, c]) => c > 3);
  const coveredInterests = Object.keys(interestCount).length;
  const avgMatchPos = matchedArticles.length > 0
    ? (matchedArticles.reduce((s, m) => s + m.position, 0) / matchedArticles.length).toFixed(1)
    : '-';
  const matchesFirst25 = matchedArticles.filter(m => m.position <= 25).length;
  const matchesFirst50 = matchedArticles.filter(m => m.position <= 50).length;

  return {
    name: user.name,
    totalArticles,
    engaged: totalEngaged,
    matchRate: parseFloat(matchPct),
    interestCount,
    interestCoverage: coveredInterests,
    totalInterests: Object.keys(user.interests).length,
    buckets: bucketCount,
    pages: page,
    duplicates: duplicateCount,
    floodedEvents: floodedEvents.length,
    floodedEventDetails: floodedEvents,
    matchesFirst25,
    matchesFirst50,
    avgMatchPosition: avgMatchPos,
    categoryCount,
    uniqueCategories: uniqueCategories.size,
    maxSameCategory: Math.max(...Object.values(categoryCount), 0),
  };
}

function printResults(label, results) {
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(90));
  console.log(
    '  User'.padEnd(40) +
    'Total'.padStart(6) +
    'Match'.padStart(6) +
    'Rate'.padStart(7) +
    'Cover'.padStart(6) +
    'Dupes'.padStart(6) +
    'Flood'.padStart(6) +
    'AvgPos'.padStart(7) +
    'In25'.padStart(5) +
    'In50'.padStart(5) +
    'Cats'.padStart(5)
  );
  console.log('  ' + '─'.repeat(87));
  for (const r of results) {
    console.log(
      ('  ' + r.name).padEnd(40) +
      String(r.totalArticles).padStart(6) +
      String(r.engaged).padStart(6) +
      (r.matchRate + '%').padStart(7) +
      `${r.interestCoverage}/${r.totalInterests}`.padStart(6) +
      String(r.duplicates).padStart(6) +
      String(r.floodedEvents).padStart(6) +
      String(r.avgMatchPosition).padStart(7) +
      String(r.matchesFirst25).padStart(5) +
      String(r.matchesFirst50).padStart(5) +
      String(r.uniqueCategories).padStart(5)
    );
  }

  const avg = (arr, key) => (arr.reduce((s, r) => s + (typeof r[key] === 'number' ? r[key] : 0), 0) / arr.length).toFixed(1);
  const sum = (arr, key) => arr.reduce((s, r) => s + r[key], 0);
  console.log('  ' + '─'.repeat(87));
  console.log(
    '  AVERAGE/TOTAL'.padEnd(40) +
    String(sum(results, 'totalArticles')).padStart(6) +
    String(sum(results, 'engaged')).padStart(6) +
    (avg(results, 'matchRate') + '%').padStart(7) +
    `${sum(results, 'interestCoverage')}/${sum(results, 'totalInterests')}`.padStart(6) +
    String(sum(results, 'duplicates')).padStart(6) +
    String(sum(results, 'floodedEvents')).padStart(6) +
    String(avg(results, 'avgMatchPosition') === 'NaN' ? '-' : avg(results, 'avgMatchPosition')).padStart(7) +
    String(sum(results, 'matchesFirst25')).padStart(5) +
    String(sum(results, 'matchesFirst50')).padStart(5)
  );

  // Interest details
  console.log('\n  Interest coverage per user:');
  for (const r of results) {
    const details = Object.entries(r.interestCount).map(([i, c]) => `${i}(${c})`).join(', ');
    console.log(`    ${r.name}: ${r.interestCoverage}/${r.totalInterests} — ${details || 'none'}`);
  }

  // Flood details
  const anyFloods = results.some(r => r.floodedEvents > 0);
  if (anyFloods) {
    console.log('\n  World event flooding:');
    for (const r of results) {
      for (const [slug, count] of r.floodedEventDetails) {
        console.log(`    ${r.name}: ${slug} → ${count} articles`);
      }
    }
  }

  return {
    avgMatchRate: parseFloat(avg(results, 'matchRate')),
    avgCoverage: parseFloat(avg(results, 'interestCoverage')),
    totalDuplicates: sum(results, 'duplicates'),
    totalFloods: sum(results, 'floodedEvents'),
    avgPosition: parseFloat(avg(results, 'avgMatchPosition')) || 0,
    totalMatchesFirst25: sum(results, 'matchesFirst25'),
    totalMatchesFirst50: sum(results, 'matchesFirst50'),
    totalEngaged: sum(results, 'engaged'),
    totalArticles: sum(results, 'totalArticles'),
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     A/B COMPARISON: Improved V2 vs Legacy V2 (original, no improvements)       ║');
  console.log('║     5 Users with Interests Matched to ACTUAL 12-Hour Content                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // ===== RUN LEGACY V2 =====
  console.log('>>> Running LEGACY V2 (no improvements)...');
  const legacyResults = [];
  for (const user of USERS) {
    process.stdout.write(`  Testing ${user.name}...`);
    const r = await simulateUser(user, true);
    console.log(` ${r.engaged}/${r.totalArticles} matched (${r.matchRate}%), ${r.duplicates} dupes`);
    legacyResults.push(r);
  }

  // Small delay between tests to avoid rate limiting
  await new Promise(r => setTimeout(r, 3000));

  // ===== RUN IMPROVED V2 =====
  console.log('\n>>> Running IMPROVED V2 (with all 5 improvements)...');
  const improvedResults = [];
  for (const user of USERS) {
    process.stdout.write(`  Testing ${user.name}...`);
    const r = await simulateUser(user, false);
    console.log(` ${r.engaged}/${r.totalArticles} matched (${r.matchRate}%), ${r.duplicates} dupes`);
    improvedResults.push(r);
  }

  // ===== PRINT RESULTS =====
  const legacyStats = printResults('LEGACY V2 (Original — No Improvements)', legacyResults);
  const improvedStats = printResults('IMPROVED V2 (Dwell Time + Event Dedup + Skip Decay + True Pagination + Bandit)', improvedResults);

  // ===== COMPARISON =====
  console.log('\n\n' + '█'.repeat(90));
  console.log('  HEAD-TO-HEAD COMPARISON');
  console.log('█'.repeat(90));

  function delta(improved, legacy, unit = '', lowerBetter = false) {
    const diff = improved - legacy;
    const sign = diff > 0 ? '+' : '';
    const arrow = lowerBetter ? (diff < 0 ? ' ✓' : diff > 0 ? ' ✗' : '') : (diff > 0 ? ' ✓' : diff < 0 ? ' ✗' : '');
    return `${sign}${diff.toFixed(1)}${unit}${arrow}`;
  }

  console.log(`
  Metric                       Legacy V2      Improved V2      Delta
  ─────────────────────────────────────────────────────────────────────
  Avg Match Rate                ${String(legacyStats.avgMatchRate + '%').padStart(8)}       ${String(improvedStats.avgMatchRate + '%').padStart(8)}       ${delta(improvedStats.avgMatchRate, legacyStats.avgMatchRate, '%')}
  Avg Interest Coverage         ${String(legacyStats.avgCoverage + '/5').padStart(8)}       ${String(improvedStats.avgCoverage + '/5').padStart(8)}       ${delta(improvedStats.avgCoverage, legacyStats.avgCoverage)}
  Total Engaged Articles        ${String(legacyStats.totalEngaged).padStart(8)}       ${String(improvedStats.totalEngaged).padStart(8)}       ${delta(improvedStats.totalEngaged, legacyStats.totalEngaged)}
  Total Articles Served         ${String(legacyStats.totalArticles).padStart(8)}       ${String(improvedStats.totalArticles).padStart(8)}       ${delta(improvedStats.totalArticles, legacyStats.totalArticles)}
  Total Duplicates              ${String(legacyStats.totalDuplicates).padStart(8)}       ${String(improvedStats.totalDuplicates).padStart(8)}       ${delta(improvedStats.totalDuplicates, legacyStats.totalDuplicates, '', true)}
  World Event Floods            ${String(legacyStats.totalFloods).padStart(8)}       ${String(improvedStats.totalFloods).padStart(8)}       ${delta(improvedStats.totalFloods, legacyStats.totalFloods, '', true)}
  Avg Match Position            ${String(legacyStats.avgPosition).padStart(8)}       ${String(improvedStats.avgPosition).padStart(8)}       ${delta(improvedStats.avgPosition, legacyStats.avgPosition, '', true)}
  Matches in First 25           ${String(legacyStats.totalMatchesFirst25).padStart(8)}       ${String(improvedStats.totalMatchesFirst25).padStart(8)}       ${delta(improvedStats.totalMatchesFirst25, legacyStats.totalMatchesFirst25)}
  Matches in First 50           ${String(legacyStats.totalMatchesFirst50).padStart(8)}       ${String(improvedStats.totalMatchesFirst50).padStart(8)}       ${delta(improvedStats.totalMatchesFirst50, legacyStats.totalMatchesFirst50)}
  `);

  // Per-user comparison
  console.log('  Per-User Match Rate Comparison:');
  console.log('  ' + '─'.repeat(70));
  for (let i = 0; i < USERS.length; i++) {
    const l = legacyResults[i];
    const imp = improvedResults[i];
    const diff = imp.matchRate - l.matchRate;
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    console.log(`    ${l.name.padEnd(35)} ${l.matchRate}% → ${imp.matchRate}%  (${diff > 0 ? '+' : ''}${diff.toFixed(1)}%) ${arrow}`);
  }

  console.log('\n  Per-User Interest Coverage Comparison:');
  console.log('  ' + '─'.repeat(70));
  for (let i = 0; i < USERS.length; i++) {
    const l = legacyResults[i];
    const imp = improvedResults[i];
    const arrow = imp.interestCoverage > l.interestCoverage ? '↑' : imp.interestCoverage < l.interestCoverage ? '↓' : '→';
    console.log(`    ${l.name.padEnd(35)} ${l.interestCoverage}/${l.totalInterests} → ${imp.interestCoverage}/${imp.totalInterests} ${arrow}`);
  }

  console.log('\n  Per-User Duplicate Comparison:');
  console.log('  ' + '─'.repeat(70));
  for (let i = 0; i < USERS.length; i++) {
    const l = legacyResults[i];
    const imp = improvedResults[i];
    const arrow = imp.duplicates < l.duplicates ? '↑' : imp.duplicates > l.duplicates ? '↓' : '→';
    console.log(`    ${l.name.padEnd(35)} ${l.duplicates} → ${imp.duplicates} dupes ${arrow}`);
  }

  // Verdict
  console.log('\n\n' + '═'.repeat(90));
  console.log('  VERDICT');
  console.log('═'.repeat(90));
  let wins = 0, losses = 0;
  if (improvedStats.avgMatchRate > legacyStats.avgMatchRate) { wins++; console.log('  ✓ Match Rate: IMPROVED wins'); }
  else if (improvedStats.avgMatchRate < legacyStats.avgMatchRate) { losses++; console.log('  ✗ Match Rate: LEGACY wins'); }
  else console.log('  → Match Rate: TIE');

  if (improvedStats.avgCoverage > legacyStats.avgCoverage) { wins++; console.log('  ✓ Interest Coverage: IMPROVED wins'); }
  else if (improvedStats.avgCoverage < legacyStats.avgCoverage) { losses++; console.log('  ✗ Interest Coverage: LEGACY wins'); }
  else console.log('  → Interest Coverage: TIE');

  if (improvedStats.totalDuplicates < legacyStats.totalDuplicates) { wins++; console.log('  ✓ Pagination (fewer dupes): IMPROVED wins'); }
  else if (improvedStats.totalDuplicates > legacyStats.totalDuplicates) { losses++; console.log('  ✗ Pagination: LEGACY wins'); }
  else console.log('  → Pagination: TIE');

  if (improvedStats.totalFloods < legacyStats.totalFloods) { wins++; console.log('  ✓ Event Dedup (fewer floods): IMPROVED wins'); }
  else if (improvedStats.totalFloods > legacyStats.totalFloods) { losses++; console.log('  ✗ Event Dedup: LEGACY wins'); }
  else console.log('  → Event Dedup: TIE');

  if (improvedStats.totalMatchesFirst25 > legacyStats.totalMatchesFirst25) { wins++; console.log('  ✓ Position Quality (more in first 25): IMPROVED wins'); }
  else if (improvedStats.totalMatchesFirst25 < legacyStats.totalMatchesFirst25) { losses++; console.log('  ✗ Position Quality: LEGACY wins'); }
  else console.log('  → Position Quality: TIE');

  console.log(`\n  Score: IMPROVED ${wins} — ${losses} LEGACY`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

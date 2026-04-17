/**
 * V3 Comparison Test — 5 users with interests matched to ACTUAL 12-hour content.
 * Measures all quality metrics: match rate, interest coverage, diversity, dedup, pagination.
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
    name: 'Sports Fanatic (F1 + Cricket + Football)',
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

async function fetchFeed(params) {
  const url = new URL(`${BASE_URL}/api/feed/main`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
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

async function simulateUser(user) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`USER: ${user.name}`);
  console.log(`Interests: ${Object.keys(user.interests).join(' | ')}`);
  console.log('='.repeat(70));

  const seenIds = [], engagedIds = [], skippedIds = [];
  let totalArticles = 0, page = 0, cursor = null, hasMore = true;
  const categoryCount = {}, bucketCount = {}, interestCount = {};
  const matchedArticles = [], unmatchedArticles = [];
  const worldEventsSeen = {};
  let duplicateCount = 0;
  const scoresByInterest = {};
  const positionsByInterest = {};

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
      const result = await fetchFeed(params);
      const articles = result.articles || [];
      if (articles.length === 0) break;

      let pageEngaged = 0, pageSkipped = 0, pageDupes = 0;

      for (const article of articles) {
        const id = String(article.id);
        if (seenIds.includes(id)) { pageDupes++; duplicateCount++; continue; }
        seenIds.push(id);
        totalArticles++;

        const position = totalArticles;
        const cat = article.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        const bucket = article.bucket || 'unknown';
        bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

        if (article.world_event?.slug) {
          worldEventsSeen[article.world_event.slug] = (worldEventsSeen[article.world_event.slug] || 0) + 1;
        }

        const interest = categorizeMatch(article, user.interests);
        if (interest) {
          interestCount[interest] = (interestCount[interest] || 0) + 1;
          engagedIds.push(id);
          pageEngaged++;
          if (!scoresByInterest[interest]) scoresByInterest[interest] = [];
          scoresByInterest[interest].push(article.final_score || 0);
          if (!positionsByInterest[interest]) positionsByInterest[interest] = [];
          positionsByInterest[interest].push(position);
          matchedArticles.push({ title: article.title, category: cat, bucket, interest, score: article.final_score, position });
        } else {
          if (Math.random() < 0.4) { skippedIds.push(id); pageSkipped++; }
          unmatchedArticles.push({ title: article.title, category: cat, bucket, position });
        }
      }

      const dupeNote = pageDupes > 0 ? ` dupes=${pageDupes}` : '';
      console.log(`  Page ${page}: ${articles.length} articles | engaged=${pageEngaged} skipped=${pageSkipped}${dupeNote} | total=${totalArticles}`);

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
  console.log(`  Total: ${totalArticles} | Engaged: ${totalEngaged} (${matchPct}%) | Duplicates: ${duplicateCount}`);

  // Interest breakdown with avg position (lower = better, means interest content appears earlier)
  console.log(`\n  Interest breakdown (count | avg position):`)
  const interestCoverage = Object.keys(user.interests).length;
  let coveredInterests = 0;
  for (const interest of Object.keys(user.interests)) {
    const count = interestCount[interest] || 0;
    const positions = positionsByInterest[interest] || [];
    const avgPos = positions.length > 0 ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(0) : '-';
    const bar = '█'.repeat(Math.min(count, 40));
    if (count > 0) coveredInterests++;
    console.log(`    ${interest.padEnd(22)} ${String(count).padStart(3)} | avg pos: ${String(avgPos).padStart(4)} ${bar}`);
  }
  console.log(`  Interest coverage: ${coveredInterests}/${interestCoverage}`);

  // Category distribution
  console.log(`\n  Category distribution:`);
  for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(15)} ${String(count).padStart(3)}`);
  }

  // Bucket distribution
  console.log(`\n  Buckets: ${Object.entries(bucketCount).map(([b, c]) => `${b}=${c}`).join(' | ')}`);

  // World event dedup check
  const floodedEvents = Object.entries(worldEventsSeen).filter(([, c]) => c > 3);
  if (floodedEvents.length > 0) {
    console.log(`\n  World event flooding (>3 articles):`);
    for (const [slug, count] of floodedEvents) {
      console.log(`    WARNING: ${slug} → ${count} articles`);
    }
  } else {
    console.log(`\n  World event dedup: OK (no event >3 articles)`);
  }

  // Position quality: % of matched articles in first 50
  const matchesInFirst50 = matchedArticles.filter(m => m.position <= 50).length;
  const matchesInFirst100 = matchedArticles.filter(m => m.position <= 100).length;
  console.log(`\n  Position quality:`);
  console.log(`    Matches in first 50:  ${matchesInFirst50}`);
  console.log(`    Matches in first 100: ${matchesInFirst100}`);
  console.log(`    Matches after 100:    ${totalEngaged - matchesInFirst100}`);

  // Top matched articles
  console.log(`\n  Top 15 matched articles:`);
  for (const m of matchedArticles.slice(0, 15)) {
    console.log(`    #${String(m.position).padStart(3)} [${m.interest}] ${m.category} — ${m.title?.slice(0, 55)}`);
  }

  return {
    name: user.name,
    totalArticles,
    engaged: totalEngaged,
    matchRate: parseFloat(matchPct),
    interestCount,
    interestCoverage: coveredInterests,
    totalInterests: interestCoverage,
    buckets: bucketCount,
    pages: page,
    duplicates: duplicateCount,
    floodedEvents: floodedEvents.length,
    matchesInFirst50,
    matchesInFirst100,
    categoryCount,
    avgMatchPosition: matchedArticles.length > 0
      ? (matchedArticles.reduce((s, m) => s + m.position, 0) / matchedArticles.length).toFixed(1)
      : '-',
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   V3 FEED TEST — 5 Users with Interests Matched to Real Content    ║');
  console.log('║   Testing Improved V2 (dwell time, event dedup, skip decay,        ║');
  console.log('║   true pagination, cold-start bandit)                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results = [];
  for (const user of USERS) {
    results.push(await simulateUser(user));
  }

  console.log('\n\n' + '═'.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(80));
  console.log(
    'User'.padEnd(38) +
    'Total'.padStart(6) +
    'Engaged'.padStart(8) +
    'Match%'.padStart(8) +
    'Cover'.padStart(6) +
    'Dupes'.padStart(6) +
    'Flood'.padStart(6) +
    'AvgPos'.padStart(7) +
    'Pages'.padStart(6)
  );
  console.log('─'.repeat(91));
  for (const r of results) {
    console.log(
      r.name.padEnd(38) +
      String(r.totalArticles).padStart(6) +
      String(r.engaged).padStart(8) +
      (r.matchRate + '%').padStart(8) +
      `${r.interestCoverage}/${r.totalInterests}`.padStart(6) +
      String(r.duplicates).padStart(6) +
      String(r.floodedEvents).padStart(6) +
      String(r.avgMatchPosition).padStart(7) +
      String(r.pages).padStart(6)
    );
  }

  // Aggregate metrics
  const totals = {
    articles: results.reduce((s, r) => s + r.totalArticles, 0),
    engaged: results.reduce((s, r) => s + r.engaged, 0),
    duplicates: results.reduce((s, r) => s + r.duplicates, 0),
    floods: results.reduce((s, r) => s + r.floodedEvents, 0),
    avgMatchRate: (results.reduce((s, r) => s + r.matchRate, 0) / results.length).toFixed(1),
    avgCoverage: (results.reduce((s, r) => s + r.interestCoverage, 0) / results.length).toFixed(1),
    totalCoverage: results.reduce((s, r) => s + r.interestCoverage, 0),
    maxCoverage: results.reduce((s, r) => s + r.totalInterests, 0),
    avgPosition: (results.filter(r => r.avgMatchPosition !== '-').reduce((s, r) => s + parseFloat(r.avgMatchPosition), 0) / results.filter(r => r.avgMatchPosition !== '-').length).toFixed(1),
    matchesFirst50: results.reduce((s, r) => s + r.matchesInFirst50, 0),
    matchesFirst100: results.reduce((s, r) => s + r.matchesInFirst100, 0),
  };

  console.log('─'.repeat(91));
  console.log(
    'TOTALS/AVERAGES'.padEnd(38) +
    String(totals.articles).padStart(6) +
    String(totals.engaged).padStart(8) +
    (totals.avgMatchRate + '%').padStart(8) +
    `${totals.totalCoverage}/${totals.maxCoverage}`.padStart(6) +
    String(totals.duplicates).padStart(6) +
    String(totals.floods).padStart(6) +
    String(totals.avgPosition).padStart(7)
  );

  console.log('\n\nInterest coverage per user:');
  for (const r of results) {
    const details = Object.entries(r.interestCount).map(([i, c]) => `${i}(${c})`).join(', ');
    console.log(`  ${r.name}: ${r.interestCoverage}/${r.totalInterests} — ${details}`);
  }

  console.log('\n\n═══════════════════════════════════');
  console.log('QUALITY SCORECARD');
  console.log('═══════════════════════════════════');
  console.log(`  Avg Match Rate:           ${totals.avgMatchRate}%`);
  console.log(`  Avg Interest Coverage:    ${totals.avgCoverage}/5`);
  console.log(`  Total Duplicates:         ${totals.duplicates}`);
  console.log(`  World Event Floods:       ${totals.floods}`);
  console.log(`  Avg Match Position:       ${totals.avgPosition} (lower=better)`);
  console.log(`  Matches in First 50:      ${totals.matchesFirst50} / ${totals.engaged} total`);
  console.log(`  Matches in First 100:     ${totals.matchesFirst100} / ${totals.engaged} total`);
  console.log(`  True Pagination:          ${totals.duplicates === 0 ? 'PASS' : `FAIL (${totals.duplicates})`}`);
  console.log(`  Event Dedup:              ${totals.floods === 0 ? 'PASS' : `FAIL (${totals.floods})`}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

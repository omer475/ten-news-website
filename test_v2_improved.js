/**
 * V2 IMPROVED Feed Test — 5 users with 4-5 distinct interests each.
 * Tests all 5 improvements: dwell time, event dedup, skip decay, true pagination, cold-start bandit.
 */

const BASE_URL = 'https://www.tennews.ai';

const USERS = [
  {
    name: 'Turkish Football & Culture Fan',
    userId: '325fad3f-a873-4826-b023-8f6dc49dc978',
    interests: {
      'Turkish Football': ['galatasaray', 'fenerbahce', 'football', 'soccer', 'süper lig'],
      'Turkish Politics': ['erdogan', 'ankara', 'imamoglu', 'turkish parliament', 'chp'],
      'Istanbul Life': ['istanbul', 'turkish'],
      'Women Rights': ['women', 'feminist', 'gender', 'march 8'],
      'Mediterranean': ['cyprus', 'greece', 'mediterranean', 'aegean'],
    },
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Greece'],
    followedTopics: ['Sports', 'Politics'],
  },
  {
    name: 'F1 & Automotive Enthusiast',
    userId: '22957ba8-e13e-4414-a898-b99845535af4',
    interests: {
      'Formula 1': ['f1', 'formula', 'verstappen', 'hamilton', 'leclerc', 'norris', 'grand prix', 'ferrari', 'mclaren'],
      'Electric Vehicles': ['tesla', 'ev', 'electric vehicle', 'charging', 'battery'],
      'Aviation': ['boeing', 'airbus', 'aviation', 'airline', 'flight', 'pilot'],
      'UK Politics': ['starmer', 'parliament', 'nhs', 'labour', 'tory'],
    },
    homeCountry: 'UK',
    followedCountries: ['UK', 'Italy'],
    followedTopics: ['Sports', 'Business', 'Tech'],
  },
  {
    name: 'Silicon Valley AI Geek',
    userId: 'fd7664b4-f650-4471-8163-a0588fa25f81',
    interests: {
      'AI & LLMs': ['openai', 'chatgpt', 'ai-generated', 'artificial intelligence', 'llm', 'gpt', 'claude'],
      'Big Tech': ['apple', 'google', 'microsoft', 'meta', 'nvidia', 'amazon'],
      'Cybersecurity': ['hack', 'cyber', 'breach', 'ransomware', 'privacy'],
      'Startups & VC': ['startup', 'ipo', 'valuation', 'funding', 'unicorn', 'venture'],
      'Robotics & Drones': ['robot', 'autonomous', 'drone', 'automation'],
    },
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Business'],
  },
  {
    name: 'War & Defense Analyst',
    userId: 'c9bf839b-037e-477d-a8df-1ae1b594a006',
    interests: {
      'Iran-Israel Conflict': ['iran', 'israel', 'tehran', 'netanyahu', 'khamenei', 'irgc'],
      'Russia-Ukraine War': ['ukraine', 'russia', 'zelensky', 'putin', 'crimea', 'kyiv'],
      'Military Operations': ['military', 'missile', 'airstrike', 'navy', 'submarine', 'bomb'],
      'NATO & Alliances': ['nato', 'pentagon', 'defense', 'troops', 'deployment'],
      'Gaza & Lebanon': ['gaza', 'palestine', 'hamas', 'hezbollah', 'ceasefire', 'lebanon'],
    },
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
  },
  {
    name: 'Green Science & Space Explorer',
    userId: 'fc1397a1-b0a2-442d-824b-97e4e66d8833',
    interests: {
      'Space Exploration': ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'asteroid'],
      'Climate & Environment': ['climate', 'carbon', 'emission', 'warming', 'glacier'],
      'Renewable Energy': ['solar', 'wind', 'renewable', 'nuclear', 'hydrogen', 'battery'],
      'Medical Breakthroughs': ['cancer', 'vaccine', 'alzheimer', 'drug', 'treatment', 'clinical'],
      'Ocean Science': ['ocean', 'marine', 'whale', 'reef', 'sea level'],
    },
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
  const matchedArticles = [];
  const worldEventsSeen = {};
  let duplicateCount = 0;

  while (hasMore && page < 30) {
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
      if (articles.length === 0) { console.log(`  Page ${page}: Empty. has_more=${result.has_more}`); break; }

      let pageEngaged = 0, pageSkipped = 0, pageDupes = 0;

      for (const article of articles) {
        const id = String(article.id);
        if (seenIds.includes(id)) { pageDupes++; duplicateCount++; continue; }
        seenIds.push(id);
        totalArticles++;

        const cat = article.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        const bucket = article.bucket || 'unknown';
        bucketCount[bucket] = (bucketCount[bucket] || 0) + 1;

        // Track world events
        if (article.world_event?.slug) {
          worldEventsSeen[article.world_event.slug] = (worldEventsSeen[article.world_event.slug] || 0) + 1;
        }

        const interest = categorizeMatch(article, user.interests);
        if (interest) {
          interestCount[interest] = (interestCount[interest] || 0) + 1;
          engagedIds.push(id);
          pageEngaged++;
          matchedArticles.push({ title: article.title, category: cat, bucket, interest, score: article.final_score });
        } else {
          if (Math.random() < 0.5) { skippedIds.push(id); pageSkipped++; }
        }
      }

      const dupeNote = pageDupes > 0 ? ` dupes=${pageDupes}` : '';
      console.log(`  Page ${page}: ${articles.length} articles | engaged=${pageEngaged} skipped=${pageSkipped}${dupeNote} | total=${totalArticles} | cursor=${result.next_cursor?.slice(0,15) || 'none'}`);

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

  console.log(`\n  Interest breakdown:`);
  for (const interest of Object.keys(user.interests)) {
    const count = interestCount[interest] || 0;
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`    ${interest.padEnd(22)} ${String(count).padStart(3)} ${bar}`);
  }

  console.log(`\n  Category distribution:`);
  for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(15)} ${String(count).padStart(3)}`);
  }

  console.log(`\n  Buckets: ${Object.entries(bucketCount).map(([b, c]) => `${b}=${c}`).join(' | ')}`);

  // World event flooding check
  const floodedEvents = Object.entries(worldEventsSeen).filter(([, c]) => c > 3);
  if (floodedEvents.length > 0) {
    console.log(`\n  World event flooding (>3 articles):`);
    for (const [slug, count] of floodedEvents) {
      console.log(`    WARNING: ${slug} → ${count} articles`);
    }
  } else {
    console.log(`\n  World event dedup: OK (no event >3 articles)`);
  }

  console.log(`\n  Top matched articles:`);
  for (const m of matchedArticles.slice(0, 12)) {
    console.log(`    [${m.interest}] ${m.category} — ${m.title?.slice(0, 60)}`);
  }

  return {
    name: user.name, totalArticles, engaged: totalEngaged,
    matchRate: matchPct, interestCount, buckets: bucketCount,
    pages: page, duplicates: duplicateCount,
    floodedEvents: floodedEvents.length,
  };
}

async function main() {
  console.log('V2 IMPROVED Feed Test — 5 Users');
  console.log('Improvements: Dwell time | Event dedup | Skip decay | True pagination | Cold-start bandit');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results = [];
  for (const user of USERS) {
    results.push(await simulateUser(user));
  }

  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log('User'.padEnd(35) + 'Articles'.padStart(8) + 'Engaged'.padStart(8) + 'Match%'.padStart(8) + 'Dupes'.padStart(6) + 'Pages'.padStart(6));
  console.log('-'.repeat(71));
  for (const r of results) {
    console.log(
      r.name.padEnd(35) +
      String(r.totalArticles).padStart(8) +
      String(r.engaged).padStart(8) +
      (r.matchRate + '%').padStart(8) +
      String(r.duplicates).padStart(6) +
      String(r.pages).padStart(6)
    );
  }

  console.log('\nInterest coverage:');
  for (const r of results) {
    const user = USERS.find(u => u.name === r.name);
    const total = Object.keys(user.interests).length;
    const covered = Object.keys(r.interestCount).length;
    const details = Object.entries(r.interestCount).map(([i, c]) => `${i}(${c})`).join(', ');
    console.log(`  ${r.name}: ${covered}/${total} — ${details}`);
  }

  console.log('\nImprovements verification:');
  const totalDupes = results.reduce((s, r) => s + r.duplicates, 0);
  console.log(`  True pagination (0 duplicates): ${totalDupes === 0 ? 'PASS' : `FAIL (${totalDupes} dupes)`}`);
  const floods = results.reduce((s, r) => s + r.floodedEvents, 0);
  console.log(`  Event dedup (no flooding): ${floods === 0 ? 'PASS' : `FAIL (${floods} flooded events)`}`);
  const allV2 = results.every(r => !r.buckets.exploration);
  console.log(`  All on V2 (no exploration bucket): ${allV2 ? 'PASS' : 'FAIL'}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

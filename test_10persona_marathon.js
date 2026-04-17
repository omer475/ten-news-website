const https = require('https');

// ============================================================================
// 10-PERSONA MARATHON FEED SIMULATION
// Each persona reads 600+ articles over 24 pages (simulating days of usage)
// Tests: session embedding + tag saturation + feed adaptation over time
// ============================================================================

const API_BASE = 'https://www.tennews.ai/api/feed/main';

const PERSONAS = [
  {
    name: 'Sarah', age: 28,
    bio: 'AI researcher at Google in San Francisco. Obsessed with LLMs, robotics, and Apple products. Plays video games on weekends.',
    interests: ['artificial intelligence', 'tech', 'apple', 'video games', 'gaming', 'science', 'space exploration', 'nasa', 'consumer electronics', 'imac', 'technology', 'startups', 'software', 'robotics', 'machine learning'],
    categories: ['Tech', 'Science'],
    avoidTags: ['iran', 'soccer', 'football', 'nfl', 'baseball', 'basketball', 'formula 1', 'motorsport', 'wwe', 'cricket', 'middle east', 'war', 'conflict'],
    avoidCategories: ['Sports', 'World'],
  },
  {
    name: 'Marco', age: 35,
    bio: 'Sports journalist in Milan. Covers Serie A, Champions League, F1. Lives for match days.',
    interests: ['sports', 'soccer', 'football', 'formula 1', 'motorsport', 'basketball', 'nfl', 'baseball', 'italy', 'serie a', 'champions league', 'athletics', 'olympics', 'paralympics', 'tennis'],
    categories: ['Sports'],
    avoidTags: ['iran', 'middle east', 'geopolitics', 'international relations', 'stock market', 'inflation', 'donald trump', 'nuclear energy', 'war', 'conflict'],
    avoidCategories: ['Finance', 'World', 'Politics'],
  },
  {
    name: 'Elena', age: 45,
    bio: 'Political science professor at Humboldt University, Berlin. Specializes in Middle East conflict and European politics.',
    interests: ['politics', 'international relations', 'geopolitics', 'iran', 'middle east', 'russia', 'ukraine', 'israel', 'military', 'national security', 'germany', 'german politics', 'europe', 'diplomacy', 'turkey', 'nato'],
    categories: ['World', 'Politics'],
    avoidTags: ['sports', 'soccer', 'football', 'nfl', 'wwe', 'netflix', 'streaming', 'film', 'baseball', 'cricket', 'basketball', 'recipe', 'cooking'],
    avoidCategories: ['Sports', 'Entertainment'],
  },
  {
    name: 'James', age: 42,
    bio: 'Hedge fund manager on Wall Street. Tracks markets, energy, macro trends. Bloomberg terminal addict.',
    interests: ['finance', 'stock market', 'oil prices', 'inflation', 'federal reserve', 'business', 'crypto', 'cryptocurrency', 'stablecoins', 'energy', 'nuclear energy', 'retail', 'ceo', 'infrastructure', 'trade', 'earnings report', 'gdp'],
    categories: ['Finance', 'Business', 'Crypto'],
    avoidTags: ['sports', 'soccer', 'football', 'wwe', 'netflix', 'streaming', 'film', 'music', 'concert', 'cricket', 'basketball', 'recipe'],
    avoidCategories: ['Sports', 'Entertainment'],
  },
  {
    name: 'Priya', age: 31,
    bio: 'Film critic and culture writer at Times of India. Reviews Bollywood and Hollywood. TV show binge-watcher.',
    interests: ['entertainment', 'film', 'streaming', 'television', 'movies', 'netflix', 'music', 'concert', 'wwe', 'video games', 'celebrity', 'bollywood', 'india', 'hbo', 'pixar', 'disney', 'oscar', 'academy awards'],
    categories: ['Entertainment'],
    avoidTags: ['iran', 'middle east', 'geopolitics', 'international relations', 'stock market', 'inflation', 'military', 'national security', 'nuclear energy', 'war', 'conflict'],
    avoidCategories: ['World', 'Politics', 'Finance'],
  },
  {
    name: 'Yuki', age: 26,
    bio: 'Medical student in Tokyo. Follows health research, neuroscience, mental health. Interested in Japan news.',
    interests: ['health', 'medicine', 'mental health', 'depression', 'cancer', 'fda', 'neuroscience', 'brain', 'japan', 'pediatrics', 'public health', 'vaccine', 'drug trial', 'clinical trial', 'wellness', 'exercise'],
    categories: ['Health', 'Science'],
    avoidTags: ['iran', 'soccer', 'football', 'stock market', 'inflation', 'celebrity', 'netflix', 'war', 'conflict', 'cricket'],
    avoidCategories: ['World', 'Finance', 'Entertainment'],
  },
  {
    name: 'Carlos', age: 38,
    bio: 'Climate journalist in São Paulo. Covers renewable energy, environmental policy, sustainability.',
    interests: ['climate', 'renewable energy', 'solar', 'wind', 'electric vehicles', 'environment', 'sustainability', 'carbon', 'nature', 'science', 'biodiversity', 'agriculture', 'water', 'pollution', 'deforestation', 'brazil'],
    categories: ['Science', 'Tech'],
    avoidTags: ['iran', 'soccer', 'celebrity', 'netflix', 'stock market', 'cricket', 'war', 'conflict', 'wwe', 'basketball'],
    avoidCategories: ['Sports', 'Entertainment', 'World'],
  },
  {
    name: 'Fatima', age: 33,
    bio: 'Turkish entrepreneur in Istanbul. Follows business, startups, tech, and Turkey/EU news.',
    interests: ['business', 'startups', 'turkey', 'europe', 'trade', 'ceo', 'entrepreneur', 'tech', 'artificial intelligence', 'ecommerce', 'retail', 'infrastructure', 'aviation', 'travel', 'tourism'],
    categories: ['Business', 'Tech'],
    avoidTags: ['iran', 'soccer', 'cricket', 'baseball', 'wwe', 'celebrity', 'war', 'conflict', 'nuclear energy'],
    avoidCategories: ['Sports', 'World'],
  },
  {
    name: 'Mike', age: 50,
    bio: 'Retired army veteran in Texas. Follows defense, geopolitics, guns, veterans affairs. Also likes cars and NASCAR.',
    interests: ['military', 'defense', 'national security', 'veterans', 'gun', 'firearms', 'police', 'crime', 'law enforcement', 'nascar', 'motorsport', 'automotive', 'texas', 'donald trump', 'republican', 'us politics'],
    categories: ['Politics', 'World'],
    avoidTags: ['netflix', 'streaming', 'celebrity', 'bollywood', 'k-pop', 'fashion', 'recipe', 'cooking', 'skincare'],
    avoidCategories: ['Entertainment'],
  },
  {
    name: 'Aisha', age: 22,
    bio: 'Gen Z college student in London. Loves TikTok culture, music, fashion, mental health awareness. Activist.',
    interests: ['mental health', 'music', 'fashion', 'social media', 'tiktok', 'instagram', 'women\'s rights', 'activism', 'climate', 'education', 'student', 'london', 'uk', 'concert', 'wellness', 'beauty'],
    categories: ['Entertainment', 'Health'],
    avoidTags: ['iran', 'stock market', 'inflation', 'federal reserve', 'nuclear energy', 'oil prices', 'war', 'conflict', 'military'],
    avoidCategories: ['Finance', 'World'],
  },
];

// ============================================================================
// Realistic dwell simulation
// ============================================================================
function simulateDwell(persona, article) {
  const tags = (article.interestTags || article.interest_tags || article.topics || []).map(t => t.toLowerCase());
  const category = (article.category || '').trim();

  let interestMatch = 0;
  let avoidMatch = 0;

  for (const tag of tags) {
    if (persona.interests.includes(tag)) interestMatch++;
    if (persona.avoidTags.includes(tag)) avoidMatch++;
  }
  if (persona.categories.includes(category)) interestMatch += 2;
  if (persona.avoidCategories.includes(category)) avoidMatch += 2;

  if (avoidMatch >= 2 && interestMatch === 0) {
    return { dwell: 1.0 + Math.random() * 1.0, signal: 'SKIP' };
  }
  if (avoidMatch > 0 && interestMatch <= 1) {
    return { dwell: 1.5 + Math.random() * 1.0, signal: 'SKIP' };
  }
  if (interestMatch === 0) {
    const d = 2.0 + Math.random() * 2.0;
    return { dwell: d, signal: d < 3 ? 'SKIP' : 'NEUTRAL' };
  }
  if (interestMatch === 1) {
    const d = 3.0 + Math.random() * 2.0;
    return { dwell: d, signal: d < 3 ? 'SKIP' : (d >= 5 ? 'ENGAGE' : 'NEUTRAL') };
  }
  if (interestMatch >= 2) {
    const d = 5.0 + Math.random() * 10.0;
    return { dwell: d, signal: 'ENGAGE' };
  }
  return { dwell: 2.5, signal: 'SKIP' };
}

// ============================================================================
// Fetch feed
// ============================================================================
function fetchFeed(params) {
  return new Promise((resolve, reject) => {
    let url = API_BASE + '?limit=' + (params.limit || 25);
    if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
    if (params.engagedIds && params.engagedIds.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
    if (params.skippedIds && params.skippedIds.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
    if (params.seenIds && params.seenIds.length) url += '&seen_ids=' + params.seenIds.slice(-300).join(',');

    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('Parse: ' + body.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// Run marathon for one persona
// ============================================================================
async function simulatePersona(persona, personaIndex) {
  const LINE = '═'.repeat(90);
  console.log('\n' + LINE);
  console.log(`PERSONA ${personaIndex + 1}: ${persona.name} (${persona.age})`);
  console.log(`${persona.bio}`);
  console.log(`Interests: ${persona.interests.slice(0, 10).join(', ')}`);
  console.log(LINE);

  const engagedIds = [];
  const skippedIds = [];
  const seenIds = [];
  let cursor = null;

  // Per-page tracking
  const pageStats = [];
  // Overall tracking
  const categoryStats = { seen: {}, engaged: {}, skipped: {} };
  const tagEngaged = {};
  const tagSkipped = {};
  let totalArticles = 0;
  let totalDwell = 0;

  // Simulate 24 pages = 600 articles
  const TOTAL_PAGES = 24;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    let resp;
    try {
      resp = await fetchFeed({
        limit: 25,
        cursor: cursor,
        engagedIds: engagedIds,
        skippedIds: skippedIds,
        seenIds: seenIds,
      });
    } catch (e) {
      console.log(`  Page ${page}: fetch error — ${e.message}`);
      break;
    }

    if (!resp.articles || resp.articles.length === 0) {
      console.log(`  Page ${page}: no more articles`);
      break;
    }

    cursor = resp.nextCursor || resp.next_cursor;
    const articles = resp.articles;

    let pageEngaged = 0, pageSkipped = 0, pageNeutral = 0;
    let pageDwell = 0;
    const pageCats = {};
    const pageBuckets = {};
    const pageIranCount = 0;
    let pageIran = 0;

    for (const article of articles) {
      const id = String(article.id);
      seenIds.push(id);
      totalArticles++;

      const { dwell, signal } = simulateDwell(persona, article);
      totalDwell += dwell;
      pageDwell += dwell;

      const tags = (article.interestTags || article.interest_tags || article.topics || []).map(t => t.toLowerCase());
      const category = (article.category || '').trim();
      const bucket = article.bucket || '-';

      pageCats[category] = (pageCats[category] || 0) + 1;
      pageBuckets[bucket] = (pageBuckets[bucket] || 0) + 1;
      categoryStats.seen[category] = (categoryStats.seen[category] || 0) + 1;

      if (tags.includes('iran')) pageIran++;

      if (signal === 'ENGAGE') {
        engagedIds.push(id);
        pageEngaged++;
        categoryStats.engaged[category] = (categoryStats.engaged[category] || 0) + 1;
        tags.forEach(t => { tagEngaged[t] = (tagEngaged[t] || 0) + 1; });
      } else if (signal === 'SKIP') {
        skippedIds.push(id);
        pageSkipped++;
        categoryStats.skipped[category] = (categoryStats.skipped[category] || 0) + 1;
        tags.forEach(t => { tagSkipped[t] = (tagSkipped[t] || 0) + 1; });
      } else {
        pageNeutral++;
      }
    }

    const engRate = (pageEngaged / articles.length * 100).toFixed(0);
    const avgDwell = (pageDwell / articles.length).toFixed(1);
    const catStr = Object.entries(pageCats).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+'('+n+')').join(', ');
    const bucketStr = Object.entries(pageBuckets).sort((a,b)=>b[1]-a[1]).map(([b,n])=>b+'('+n+')').join(', ');

    pageStats.push({
      page, total: articles.length, engaged: pageEngaged, skipped: pageSkipped, neutral: pageNeutral,
      engRate: pageEngaged / articles.length, avgDwell: pageDwell / articles.length,
      iran: pageIran, categories: pageCats, buckets: pageBuckets,
      totalEngaged: engagedIds.length, totalSkipped: skippedIds.length,
    });

    // Print compact per-page summary
    const bar = '█'.repeat(Math.round(pageEngaged / articles.length * 20)).padEnd(20, '░');
    console.log(`  P${String(page).padStart(2)} ${bar} ${engRate.padStart(3)}% eng | ${avgDwell.padStart(5)}s dwell | Iran:${String(pageIran).padStart(2)} | ${bucketStr} | ${catStr}`);
  }

  // ============================================================================
  // Overall persona summary
  // ============================================================================
  console.log('\n  OVERALL:');
  console.log(`    Articles: ${totalArticles} | Engaged: ${engagedIds.length} (${(engagedIds.length/totalArticles*100).toFixed(1)}%) | Skipped: ${skippedIds.length} (${(skippedIds.length/totalArticles*100).toFixed(1)}%) | Avg dwell: ${(totalDwell/totalArticles).toFixed(1)}s`);

  // Category breakdown
  console.log('\n    Category          Seen  Engaged  Skipped    Eng%');
  const allCats = [...new Set(Object.keys(categoryStats.seen))].sort();
  for (const cat of allCats) {
    const s = categoryStats.seen[cat] || 0;
    const e = categoryStats.engaged[cat] || 0;
    const sk = categoryStats.skipped[cat] || 0;
    const rate = s > 0 ? (e/s*100).toFixed(0) + '%' : '-';
    console.log(`    ${cat.padEnd(16)} ${String(s).padStart(5)} ${String(e).padStart(8)} ${String(sk).padStart(8)} ${rate.padStart(7)}`);
  }

  // Top engaged tags
  const topEng = Object.entries(tagEngaged).sort((a,b)=>b[1]-a[1]).slice(0,8);
  console.log(`\n    Top engaged tags: ${topEng.map(([t,c])=>t+'('+c+')').join(', ')}`);
  const topSkip = Object.entries(tagSkipped).sort((a,b)=>b[1]-a[1]).slice(0,8);
  console.log(`    Top skipped tags: ${topSkip.map(([t,c])=>t+'('+c+')').join(', ')}`);

  // Feed evolution: engagement trend over time (groups of 4 pages = ~100 articles)
  console.log('\n    FEED EVOLUTION (engagement % over time):');
  const groups = [];
  for (let i = 0; i < pageStats.length; i += 4) {
    const group = pageStats.slice(i, i + 4);
    const totalEng = group.reduce((s, p) => s + p.engaged, 0);
    const totalArt = group.reduce((s, p) => s + p.total, 0);
    const totalIran = group.reduce((s, p) => s + p.iran, 0);
    const avgD = group.reduce((s, p) => s + p.avgDwell * p.total, 0) / totalArt;
    groups.push({ eng: totalEng / totalArt, iran: totalIran, dwell: avgD, articles: totalArt });
  }
  for (let g = 0; g < groups.length; g++) {
    const gr = groups[g];
    const artRange = `${g*100+1}-${g*100+gr.articles}`;
    const bar = '█'.repeat(Math.round(gr.eng * 30)).padEnd(30, '░');
    console.log(`      Articles ${artRange.padEnd(10)} ${bar} ${(gr.eng*100).toFixed(1)}% eng | ${gr.dwell.toFixed(1)}s dwell | Iran: ${gr.iran}`);
  }

  return {
    name: persona.name, totalArticles, totalEngaged: engagedIds.length,
    totalSkipped: skippedIds.length, avgDwell: totalDwell / totalArticles,
    engRate: engagedIds.length / totalArticles,
    categoryStats, tagEngaged, tagSkipped, pageStats, groups,
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  10-PERSONA MARATHON SIMULATION — 600+ articles each, 5-day content window       ║');
  console.log('║  Testing: Session Embedding + Tag Saturation + Feed Adaptation Over Time          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('Date:', new Date().toISOString(), '\n');

  const results = [];
  for (let i = 0; i < PERSONAS.length; i++) {
    try {
      const r = await simulatePersona(PERSONAS[i], i);
      results.push(r);
    } catch (err) {
      console.error(`Error with ${PERSONAS[i].name}:`, err.message);
    }
  }

  // ============================================================================
  // GRAND SUMMARY
  // ============================================================================
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         GRAND SUMMARY                                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');

  // Per-persona
  console.log('\n  Persona       Age  Articles  Engaged  EngRate  AvgDwell  IranTotal');
  console.log('  ' + '─'.repeat(75));
  for (const r of results) {
    const p = PERSONAS.find(p => p.name === r.name);
    const iranTotal = r.pageStats.reduce((s, p) => s + p.iran, 0);
    console.log(`  ${r.name.padEnd(13)} ${String(p.age).padStart(3)}  ${String(r.totalArticles).padStart(8)}  ${String(r.totalEngaged).padStart(7)}  ${(r.engRate*100).toFixed(1).padStart(6)}%  ${(r.avgDwell).toFixed(1).padStart(7)}s  ${String(iranTotal).padStart(9)}`);
  }

  // Averages
  const avgEngRate = results.reduce((s,r) => s + r.engRate, 0) / results.length;
  const avgDwell = results.reduce((s,r) => s + r.avgDwell, 0) / results.length;
  console.log('  ' + '─'.repeat(75));
  console.log(`  ${'AVERAGE'.padEnd(13)} ${''.padStart(3)}  ${''.padStart(8)}  ${''.padStart(7)}  ${(avgEngRate*100).toFixed(1).padStart(6)}%  ${avgDwell.toFixed(1).padStart(7)}s`);

  // Feed adaptation over time (averaged)
  console.log('\n  FEED ADAPTATION OVER TIME (all personas averaged):');
  console.log('  ' + 'Period'.padEnd(18) + 'Eng Rate'.padStart(10) + 'Avg Dwell'.padStart(11) + 'Iran/100'.padStart(10));
  console.log('  ' + '─'.repeat(49));
  const maxGroups = Math.max(...results.map(r => r.groups.length));
  for (let g = 0; g < maxGroups; g++) {
    const groupResults = results.filter(r => r.groups[g]);
    if (groupResults.length === 0) continue;
    const avgEng = groupResults.reduce((s,r) => s + r.groups[g].eng, 0) / groupResults.length;
    const avgD = groupResults.reduce((s,r) => s + r.groups[g].dwell, 0) / groupResults.length;
    const avgIran = groupResults.reduce((s,r) => s + r.groups[g].iran, 0) / groupResults.length;
    const label = `Articles ${g*100+1}-${(g+1)*100}`;
    const bar = '█'.repeat(Math.round(avgEng * 25)).padEnd(25, '░');
    console.log(`  ${label.padEnd(18)} ${bar} ${(avgEng*100).toFixed(1).padStart(6)}%  ${avgD.toFixed(1).padStart(6)}s  ${avgIran.toFixed(1).padStart(8)}`);
  }

  // Who benefited most from feed adaptation
  console.log('\n  BIGGEST IMPROVEMENTS (first 100 articles vs last 100):');
  for (const r of results) {
    if (r.groups.length < 2) continue;
    const first = r.groups[0];
    const last = r.groups[r.groups.length - 1];
    const change = ((last.eng - first.eng) * 100).toFixed(1);
    const arrow = parseFloat(change) > 0 ? '↑' : parseFloat(change) < 0 ? '↓' : '→';
    console.log(`    ${r.name.padEnd(13)} ${(first.eng*100).toFixed(1)}% → ${(last.eng*100).toFixed(1)}% (${arrow}${Math.abs(parseFloat(change))}pp) | Iran: ${first.iran} → ${last.iran}`);
  }

  // Bucket distribution
  console.log('\n  BUCKET DISTRIBUTION (how articles were sourced):');
  for (const r of results) {
    const buckets = {};
    r.pageStats.forEach(p => {
      Object.entries(p.buckets).forEach(([b,n]) => { buckets[b] = (buckets[b] || 0) + n; });
    });
    const total = Object.values(buckets).reduce((s,n) => s + n, 0);
    const pcts = Object.entries(buckets).sort((a,b)=>b[1]-a[1]).map(([b,n]) => `${b}:${(n/total*100).toFixed(0)}%`);
    console.log(`    ${r.name.padEnd(13)} ${pcts.join(', ')}`);
  }
}

main().catch(console.error);

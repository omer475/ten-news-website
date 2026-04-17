const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';
const FEED_URL = 'https://www.tennews.ai/api/feed/main';
const TRACK_URL = 'https://www.tennews.ai/api/analytics/track';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// PERSONAS — interests chosen from tags with 20+ articles
// Available high-volume tags: politics, iran, basketball, soccer, crime,
// international relations, united states, middle east, television, nfl,
// college basketball, football, nba, turkey, russia, military, putin,
// israel, donald trump, china, japan, ukraine war, nhl hockey, ukraine,
// artificial intelligence, video games, war, government, geopolitics,
// march madness, oscars, film, movies, baseball, premier league,
// entertainment, fashion, music, streaming, formula one, energy,
// oil prices, netflix, celebrities, european union, liverpool, mclaren
// ═══════════════════════════════════════════════════════

const PERSONAS = [
  // SPORTS - user onboards broad, actually wants specific sport
  { name: 'Maria', country: 'brazil', onboard: ['sports','entertainment','politics'], actual: ['soccer','premier league','liverpool','atletico madrid'], searches: ['premier league','liverpool transfer','soccer results'] },
  { name: 'Jake', country: 'usa', onboard: ['sports','business','tech'], actual: ['nfl','football','super bowl'], searches: ['nfl draft','football highlights','super bowl'] },
  { name: 'Tom', country: 'usa', onboard: ['sports','entertainment','finance'], actual: ['nba','basketball','march madness','college basketball'], searches: ['nba standings','march madness bracket','basketball playoffs'] },
  { name: 'Aiden', country: 'australia', onboard: ['sports','science','health'], actual: ['baseball','mlb','world baseball classic'], searches: ['mlb standings','baseball trades','world baseball classic'] },
  { name: 'Takeshi', country: 'japan', onboard: ['sports','tech','entertainment'], actual: ['formula one','mclaren','chinese grand prix'], searches: ['formula one standings','mclaren','chinese grand prix'] },
  { name: 'Henrik', country: 'germany', onboard: ['sports','politics','business'], actual: ['nhl hockey'], searches: ['nhl playoffs','hockey standings','nhl trade deadline'] },
  { name: 'Pedro', country: 'brazil', onboard: ['sports','lifestyle','entertainment'], actual: ['soccer','atletico madrid','real betis','bundesliga'], searches: ['atletico madrid','bundesliga results','la liga'] },
  { name: 'Ahmed', country: 'turkiye', onboard: ['sports','politics','business'], actual: ['soccer','turkey','premier league','world cup 2026'], searches: ['turkey football','premier league table','world cup 2026'] },

  // POLITICS - user onboards broad, actually wants specific region
  { name: 'James', country: 'usa', onboard: ['politics','finance','business'], actual: ['donald trump','united states','government','politics'], searches: ['trump news','us government','congress vote'] },
  { name: 'Fatima', country: 'turkiye', onboard: ['politics','entertainment','lifestyle'], actual: ['iran','middle east','israel','war'], searches: ['iran news','middle east conflict','israel gaza'] },
  { name: 'Chen', country: 'japan', onboard: ['politics','tech','finance'], actual: ['china','japan','geopolitics','international relations'], searches: ['china japan relations','geopolitics asia','international relations'] },
  { name: 'Viktor', country: 'germany', onboard: ['politics','sports','business'], actual: ['russia','putin','ukraine','ukraine war'], searches: ['russia ukraine','putin news','ukraine war update'] },
  { name: 'Nadia', country: 'turkiye', onboard: ['politics','business','entertainment'], actual: ['turkey','middle east','iran','military'], searches: ['turkey politics','middle east military','iran turkey'] },
  { name: 'Emma', country: 'uk', onboard: ['politics','health','science'], actual: ['european union','geopolitics','international relations'], searches: ['european union policy','eu geopolitics','international summit'] },

  // ENTERTAINMENT - specific genres
  { name: 'Yara', country: 'turkiye', onboard: ['entertainment','politics','health'], actual: ['oscars','movies','film','academy awards','awards'], searches: ['oscar nominations','best movies','academy awards'] },
  { name: 'Ines', country: 'spain', onboard: ['entertainment','lifestyle','tech'], actual: ['television','streaming','netflix','series'], searches: ['netflix new releases','streaming shows','tv series'] },
  { name: 'Kenji', country: 'japan', onboard: ['entertainment','tech','sports'], actual: ['video games','gaming'], searches: ['video games releases','gaming news','ps5 games'] },
  { name: 'Liam', country: 'uk', onboard: ['entertainment','sports','politics'], actual: ['celebrities','fashion','entertainment'], searches: ['celebrity news','fashion week','entertainment gossip'] },
  { name: 'Sophie', country: 'france', onboard: ['entertainment','lifestyle','health'], actual: ['music','entertainment','awards'], searches: ['music awards','new album releases','grammy'] },

  // CROSS-INTEREST - onboard one thing, actually want another domain entirely
  { name: 'Sarah', country: 'usa', onboard: ['tech','business','health'], actual: ['artificial intelligence','video games'], searches: ['artificial intelligence news','ai regulation','chatgpt'] },
  { name: 'Raj', country: 'india', onboard: ['sports','entertainment','lifestyle'], actual: ['artificial intelligence','china','geopolitics'], searches: ['ai breakthrough','china tech','geopolitics ai'] },
  { name: 'Diego', country: 'mexico', onboard: ['entertainment','sports','lifestyle'], actual: ['politics','donald trump','united states','government'], searches: ['trump policy','us politics','government shutdown'] },
  { name: 'Priya', country: 'india', onboard: ['tech','finance','crypto'], actual: ['soccer','premier league','basketball','nba'], searches: ['premier league scores','nba results','soccer transfer'] },
  { name: 'Omar', country: 'turkiye', onboard: ['business','finance','crypto'], actual: ['iran','middle east','military','war'], searches: ['iran military','middle east war','strait of hormuz'] },
  { name: 'Lucas', country: 'germany', onboard: ['politics','science','health'], actual: ['nfl','football','basketball','nba'], searches: ['nfl scores','football highlights','nba game'] },

  // MIXED - partially overlapping onboarding
  { name: 'Nina', country: 'germany', onboard: ['politics','sports','entertainment'], actual: ['russia','ukraine war','putin','military'], searches: ['russia news','ukraine war update','putin speech'] },
  { name: 'Alex', country: 'uk', onboard: ['finance','tech','crypto'], actual: ['oil prices','energy','business'], searches: ['oil prices today','energy crisis','opec meeting'] },
  { name: 'David', country: 'usa', onboard: ['health','science','tech'], actual: ['artificial intelligence','video games','television'], searches: ['ai news','video game releases','tv shows'] },
  { name: 'Laura', country: 'germany', onboard: ['health','lifestyle','entertainment'], actual: ['politics','european union','international relations'], searches: ['eu news','european politics','international summit'] },
  { name: 'Michael', country: 'usa', onboard: ['finance','business','tech'], actual: ['basketball','nba','march madness','college basketball'], searches: ['nba playoffs','march madness','college basketball rankings'] },

  // NARROW vs BROAD interest
  { name: 'Hana', country: 'japan', onboard: ['entertainment','lifestyle','tech'], actual: ['japan','television','movies','film'], searches: ['japanese movies','japan entertainment','tokyo film'] },
  { name: 'Marco', country: 'france', onboard: ['business','politics','finance'], actual: ['oil prices','energy','european union','geopolitics'], searches: ['oil prices','energy market','eu energy policy'] },
  { name: 'Robert', country: 'usa', onboard: ['business','tech','finance'], actual: ['donald trump','politics','government','united states'], searches: ['trump business','us politics','government regulation'] },
  { name: 'Tina', country: 'usa', onboard: ['business','tech','entertainment'], actual: ['artificial intelligence','china','japan','geopolitics'], searches: ['ai china','japan technology','geopolitics tech'] },
  { name: 'Emre', country: 'turkiye', onboard: ['sports','tech','business'], actual: ['soccer','turkey','formula one','premier league'], searches: ['galatasaray','formula one race','premier league'] },

  // MORE SPORT SPECIFICS
  { name: 'Carlos', country: 'spain', onboard: ['sports','entertainment','business'], actual: ['basketball','nba','march madness'], searches: ['nba trade','march madness upset','basketball highlights'] },
  { name: 'Yuki', country: 'japan', onboard: ['sports','entertainment','tech'], actual: ['baseball','mlb','japan'], searches: ['mlb results','japanese baseball','world baseball'] },
  { name: 'Aisha', country: 'turkiye', onboard: ['sports','politics','entertainment'], actual: ['soccer','turkey','atletico madrid','world cup 2026'], searches: ['turkey soccer','world cup qualifiers','atletico madrid'] },

  // MORE POLITICS SPECIFICS
  { name: 'Eric', country: 'usa', onboard: ['politics','sports','entertainment'], actual: ['iran','israel','middle east','war','military'], searches: ['iran news','israel conflict','middle east war'] },
  { name: 'Anna', country: 'germany', onboard: ['politics','lifestyle','health'], actual: ['ukraine','russia','putin','ukraine war'], searches: ['ukraine update','russia sanctions','putin'] },
  { name: 'Dmitri', country: 'germany', onboard: ['politics','tech','science'], actual: ['china','geopolitics','international relations','japan'], searches: ['china politics','asian geopolitics','japan china'] },

  // MORE ENTERTAINMENT SPECIFICS
  { name: 'Tyler', country: 'usa', onboard: ['entertainment','sports','politics'], actual: ['oscars','film','movies','academy awards','science fiction'], searches: ['oscar winners','best films','science fiction movies'] },
  { name: 'Jessica', country: 'usa', onboard: ['entertainment','health','lifestyle'], actual: ['television','netflix','streaming','celebrities'], searches: ['netflix top 10','streaming new releases','celebrity news'] },
  { name: 'Kim2', country: 'japan', onboard: ['entertainment','tech','lifestyle'], actual: ['video games','japan','television'], searches: ['video games japan','gaming reviews','japanese tv'] },

  // FULLY CROSS-DOMAIN
  { name: 'Rachel', country: 'usa', onboard: ['lifestyle','health','science'], actual: ['politics','donald trump','government','crime'], searches: ['trump latest','government news','crime news'] },
  { name: 'Mia', country: 'france', onboard: ['fashion','entertainment','lifestyle'], actual: ['iran','middle east','war','military'], searches: ['iran crisis','middle east news','military conflict'] },
  { name: 'Lisa', country: 'australia', onboard: ['lifestyle','health','science'], actual: ['basketball','nba','nfl','football'], searches: ['nba scores','nfl news','basketball game'] },
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function matchesInterest(article, persona) {
  const tags = Array.isArray(article.interest_tags) ? article.interest_tags : [];
  const lowerTags = tags.map(t => t.toLowerCase());
  for (const interest of persona.actual) {
    if (lowerTags.some(t => t.includes(interest))) return true;
  }
  return false;
}

async function trackEvent(userId, eventType, articleId, metadata = {}) {
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, article_id: articleId || undefined, user_id: userId, guest_device_id: userId, metadata })
    });
  } catch (_) {}
}

async function fetchFeed(userId, topics, country, cursor = null, engaged = [], skipped = []) {
  let url = `${FEED_URL}?user_id=${userId}&followed_topics=${topics.join(',')}&home_country=${country}&limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engaged.length) url += `&engaged_ids=${engaged.join(',')}`;
  if (skipped.length) url += `&skipped_ids=${skipped.join(',')}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) { return { articles: [], next_cursor: null }; }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ═══════════════════════════════════════════════════════
// RUN ONE PERSONA — 5 pages with full signal analysis
// ═══════════════════════════════════════════════════════

async function runPersona(persona, index) {
  const userId = generateUUID();
  const email = `test_v2_${persona.name.toLowerCase()}_${index}@tennews.test`;

  console.log(`\n[${index+1}/50] ${persona.name} (${persona.country})`);
  console.log(`  Onboarding: [${persona.onboard.join(', ')}]`);
  console.log(`  Wants: [${persona.actual.join(', ')}]`);

  // 1. Create user
  const { error: createErr } = await supabase.from('users').upsert({
    id: userId, email, home_country: persona.country,
    followed_countries: [persona.country],
    followed_topics: persona.onboard.slice(0, 9)
  }, { onConflict: 'id' });

  if (createErr) {
    console.log(`  ERROR: ${createErr.message}`);
    return { persona: persona.name, error: createErr.message };
  }

  await supabase.from('users').update({ tag_profile: {}, skip_profile: {} }).eq('id', userId);

  // 2. Send searches
  for (const q of persona.searches) {
    await trackEvent(userId, 'search_query', null, { query: q });
    await sleep(150);
  }
  console.log(`  Searched: [${persona.searches.join(', ')}]`);
  await sleep(3000);

  // 3. Process 5 pages
  const pages = [];
  let cursor = null;
  const allEngagedIds = [];
  const allSkippedIds = [];
  let totalLikes = 0, totalSaves = 0, totalEngages = 0, totalSkips = 0;

  for (let page = 1; page <= 5; page++) {
    const feed = await fetchFeed(userId, persona.onboard, persona.country, cursor, allEngagedIds.slice(-50), allSkippedIds.slice(-50));
    const articles = feed.articles || [];
    cursor = feed.next_cursor;

    let matches = 0, pageSkips = 0, pageLikes = 0, pageEngages = 0, pageSaves = 0;
    const pageCats = {};

    for (const article of articles) {
      const cat = article.category || 'Other';
      pageCats[cat] = (pageCats[cat] || 0) + 1;
      const isMatch = matchesInterest(article, persona);

      if (isMatch) {
        matches++;
        const rand = Math.random();
        if (rand < 0.05) {
          await trackEvent(userId, 'article_saved', article.id, { dwell: '25', dwell_tier: 'deep_read' });
          pageSaves++; allEngagedIds.push(article.id);
        } else if (rand < 0.35) {
          await trackEvent(userId, 'article_liked', article.id, { dwell: String(15 + Math.random() * 15), dwell_tier: 'engaged_read' });
          pageLikes++; allEngagedIds.push(article.id);
        } else {
          await trackEvent(userId, 'article_engaged', article.id, { dwell: String(8 + Math.random() * 17), dwell_tier: 'engaged_read' });
          pageEngages++; allEngagedIds.push(article.id);
        }
      } else {
        if (Math.random() < 0.85) {
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(0.2 + Math.random()), dwell_tier: 'instant_skip' });
          pageSkips++; allSkippedIds.push(article.id);
        }
      }
      await sleep(30);
    }

    const matchRate = articles.length > 0 ? (matches / articles.length * 100) : 0;
    totalLikes += pageLikes; totalSaves += pageSaves; totalEngages += pageEngages; totalSkips += pageSkips;

    const topCats = Object.entries(pageCats).sort((a,b) => b[1]-a[1]).slice(0, 3).map(([c,n]) => `${c}:${n}`).join(' ');
    pages.push({ page, total: articles.length, matches, matchRate, likes: pageLikes, engages: pageEngages, skips: pageSkips, saves: pageSaves, cats: topCats });

    const marker = matchRate >= 40 ? '★' : matchRate >= 20 ? '▲' : matchRate >= 10 ? '·' : '✗';
    console.log(`  P${page}: ${matchRate.toFixed(0).padStart(3)}% match (${matches}/${articles.length}) ${marker} | L:${pageLikes} E:${pageEngages} S:${pageSkips} | ${topCats}`);

    if (page < 5) await sleep(2500);
  }

  // 4. Final profile check
  const { data: profile } = await supabase.from('users').select('tag_profile, skip_profile').eq('id', userId).single();
  const tagCount = Object.keys(profile?.tag_profile || {}).length;
  const skipCount = Object.keys(profile?.skip_profile || {}).length;

  // Check if search terms made it into tag_profile
  const tp = profile?.tag_profile || {};
  const searchHits = persona.searches.filter(q => {
    const terms = q.toLowerCase().split(/\s+/);
    return terms.some(t => tp[t] && tp[t] >= 0.3);
  });

  // 5. Scoring
  const p1Match = pages[0]?.matchRate || 0;
  const p5Match = pages[4]?.matchRate || pages[3]?.matchRate || 0;
  const p3Match = pages[2]?.matchRate || 0;
  const bestPage = Math.max(...pages.map(p => p.matchRate));
  const improvement = p5Match - p1Match;
  const earlyAvg = (pages[0]?.matchRate + (pages[1]?.matchRate || 0)) / 2;
  const lateAvg = ((pages[3]?.matchRate || 0) + (pages[4]?.matchRate || 0)) / 2;
  const avgImprovement = lateAvg - earlyAvg;

  const learned = avgImprovement > 10;
  const softPivot = avgImprovement > 5;

  // Engagement analysis
  const engagementRate = (totalLikes + totalEngages + totalSaves) / Math.max(pages.reduce((s,p) => s+p.total, 0), 1) * 100;
  const skipRate = totalSkips / Math.max(pages.reduce((s,p) => s+p.total, 0), 1) * 100;

  const result = {
    persona: persona.name,
    p1Match: p1Match.toFixed(1),
    p3Match: p3Match.toFixed(1),
    p5Match: p5Match.toFixed(1),
    bestPage: bestPage.toFixed(1),
    earlyAvg: earlyAvg.toFixed(1),
    lateAvg: lateAvg.toFixed(1),
    avgImprovement: avgImprovement.toFixed(1),
    learned, softPivot,
    tagCount, skipCount,
    totalLikes, totalEngages, totalSkips, totalSaves,
    engagementRate: engagementRate.toFixed(1),
    skipRate: skipRate.toFixed(1),
    searchHits: searchHits.length,
    searchTotal: persona.searches.length,
    onboardOverlap: persona.onboard.some(t => persona.actual.some(a => t.includes(a) || a.includes(t))),
    pageProgression: pages.map(p => p.matchRate.toFixed(0) + '%').join(' → '),
  };

  const label = learned ? '✅ LEARNED' : softPivot ? '🔄 PIVOT' : '❌ NO CHANGE';
  console.log(`  ${label} | P1→P5: ${p1Match.toFixed(0)}%→${p5Match.toFixed(0)}% (avg ${earlyAvg.toFixed(0)}→${lateAvg.toFixed(0)}, ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(0)}) | tags:${tagCount} skips:${skipCount} | search:${searchHits.length}/${persona.searches.length}`);

  // Cleanup
  await supabase.from('users').delete().eq('id', userId);
  await supabase.from('user_article_events').delete().eq('user_id', userId);

  return result;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  50-PERSONA FEED LEARNING TEST v2');
  console.log('  Tags chosen from actual content pool (20+ articles)');
  console.log('  5 pages per persona, full engagement simulation');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  const BATCH = 5;

  for (let i = 0; i < PERSONAS.length; i += BATCH) {
    const batch = PERSONAS.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map((p, j) => runPersona(p, i + j).catch(e => ({ persona: p.name, error: e.message })))
    );
    results.push(...batchResults);
  }

  // ═══════════════════════════════════════════════════════
  // DEEP ANALYSIS
  // ═══════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  DEEP ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  const valid = results.filter(r => !r.error);
  const learned = valid.filter(r => r.learned);
  const softPivot = valid.filter(r => r.softPivot && !r.learned);
  const noChange = valid.filter(r => !r.softPivot);
  const worse = valid.filter(r => parseFloat(r.avgImprovement) < -5);

  // Overall
  console.log('── OVERALL ──');
  console.log(`  Valid: ${valid.length}/${PERSONAS.length}`);
  console.log(`  Learned (>10pt avg improvement): ${learned.length} (${(learned.length/valid.length*100).toFixed(0)}%)`);
  console.log(`  Soft pivot (5-10pt): ${softPivot.length} (${(softPivot.length/valid.length*100).toFixed(0)}%)`);
  console.log(`  No change: ${noChange.length} (${(noChange.length/valid.length*100).toFixed(0)}%)`);
  console.log(`  Got worse (>5pt drop): ${worse.length} (${(worse.length/valid.length*100).toFixed(0)}%)`);

  const avgEarly = valid.reduce((s,r) => s + parseFloat(r.earlyAvg), 0) / valid.length;
  const avgLate = valid.reduce((s,r) => s + parseFloat(r.lateAvg), 0) / valid.length;
  const avgImp = valid.reduce((s,r) => s + parseFloat(r.avgImprovement), 0) / valid.length;
  const avgBest = valid.reduce((s,r) => s + parseFloat(r.bestPage), 0) / valid.length;
  const avgTags = valid.reduce((s,r) => s + r.tagCount, 0) / valid.length;
  const avgSkipTags = valid.reduce((s,r) => s + r.skipCount, 0) / valid.length;
  const avgEngRate = valid.reduce((s,r) => s + parseFloat(r.engagementRate), 0) / valid.length;
  const avgSkipRate = valid.reduce((s,r) => s + parseFloat(r.skipRate), 0) / valid.length;

  console.log(`\n── MATCH RATES ──`);
  console.log(`  Avg early (P1-P2): ${avgEarly.toFixed(1)}%`);
  console.log(`  Avg late (P4-P5): ${avgLate.toFixed(1)}%`);
  console.log(`  Avg improvement: ${avgImp > 0 ? '+' : ''}${avgImp.toFixed(1)} pts`);
  console.log(`  Avg best page: ${avgBest.toFixed(1)}%`);

  console.log(`\n── ENGAGEMENT ──`);
  console.log(`  Avg engagement rate: ${avgEngRate.toFixed(1)}%`);
  console.log(`  Avg skip rate: ${avgSkipRate.toFixed(1)}%`);
  console.log(`  Avg tag_profile size: ${avgTags.toFixed(0)} tags`);
  console.log(`  Avg skip_profile size: ${avgSkipTags.toFixed(0)} tags`);

  // Search effectiveness
  const avgSearchHit = valid.reduce((s,r) => s + r.searchHits, 0) / valid.length;
  const avgSearchTotal = valid.reduce((s,r) => s + r.searchTotal, 0) / valid.length;
  console.log(`\n── SEARCH SIGNAL ──`);
  console.log(`  Avg search terms stored: ${avgSearchHit.toFixed(1)}/${avgSearchTotal.toFixed(1)} (${(avgSearchHit/avgSearchTotal*100).toFixed(0)}%)`);

  // Cross-domain analysis
  const crossDomain = valid.filter(r => !r.onboardOverlap);
  const sameDomain = valid.filter(r => r.onboardOverlap);
  if (crossDomain.length > 0 && sameDomain.length > 0) {
    const crossAvgImp = crossDomain.reduce((s,r) => s + parseFloat(r.avgImprovement), 0) / crossDomain.length;
    const sameAvgImp = sameDomain.reduce((s,r) => s + parseFloat(r.avgImprovement), 0) / sameDomain.length;
    console.log(`\n── CROSS-DOMAIN vs SAME-DOMAIN ──`);
    console.log(`  Cross-domain (${crossDomain.length}): avg improvement ${crossAvgImp > 0 ? '+' : ''}${crossAvgImp.toFixed(1)} pts`);
    console.log(`  Same-domain (${sameDomain.length}): avg improvement ${sameAvgImp > 0 ? '+' : ''}${sameAvgImp.toFixed(1)} pts`);
  }

  // Grade
  const learnRate = (learned.length + softPivot.length) / valid.length * 100;
  let grade;
  if (learnRate >= 70) grade = 'A';
  else if (learnRate >= 50) grade = 'B';
  else if (learnRate >= 30) grade = 'C';
  else if (learnRate >= 15) grade = 'D';
  else grade = 'F';

  console.log(`\n══════════════════════════════`);
  console.log(`  GRADE: ${grade} (${learnRate.toFixed(0)}% showed improvement)`);
  console.log(`══════════════════════════════`);

  // Top and bottom
  const sorted = [...valid].sort((a, b) => parseFloat(b.avgImprovement) - parseFloat(a.avgImprovement));
  console.log('\n── TOP 10 LEARNERS ──');
  for (const r of sorted.slice(0, 10)) {
    console.log(`  ${r.persona.padEnd(10)} ${r.pageProgression} | avg ${r.earlyAvg}→${r.lateAvg} (${r.avgImprovement}) | L:${r.totalLikes} E:${r.totalEngages} S:${r.totalSkips}`);
  }
  console.log('\n── BOTTOM 10 ──');
  for (const r of sorted.slice(-10)) {
    console.log(`  ${r.persona.padEnd(10)} ${r.pageProgression} | avg ${r.earlyAvg}→${r.lateAvg} (${r.avgImprovement}) | L:${r.totalLikes} E:${r.totalEngages} S:${r.totalSkips}`);
  }

  // Per-persona full table
  console.log('\n── ALL PERSONAS ──');
  console.log('Name'.padEnd(10) + 'P1→P2→P3→P4→P5'.padEnd(30) + 'EarlyAvg→LateAvg'.padEnd(20) + 'Δ'.padEnd(8) + 'Result');
  for (const r of sorted) {
    const label = r.learned ? 'LEARNED' : r.softPivot ? 'PIVOT' : parseFloat(r.avgImprovement) < -5 ? 'WORSE' : 'FLAT';
    console.log(`${r.persona.padEnd(10)}${r.pageProgression.padEnd(30)}${(r.earlyAvg + '→' + r.lateAvg).padEnd(20)}${(r.avgImprovement > 0 ? '+' : '') + r.avgImprovement}`.padEnd(55) + label);
  }

  // Errors
  const errors = results.filter(r => r.error);
  if (errors.length) {
    console.log('\n── ERRORS ──');
    for (const e of errors) console.log(`  ${e.persona}: ${e.error}`);
  }

  console.log(`\nDone at ${new Date().toISOString()}`);
}

main().catch(console.error);

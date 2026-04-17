const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';
const FEED_URL = 'https://www.tennews.ai/api/feed/main';
const TRACK_URL = 'https://www.tennews.ai/api/analytics/track';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// 50 PERSONAS — onboarding differs from actual interests
// ═══════════════════════════════════════════════════════
const PERSONAS = [
  // --- SPORTS NICHE ---
  { name: 'Maria', city: 'São Paulo', country: 'brazil', onboard: ['sports','entertainment','business'], actual: ['soccer','brazilian','flamengo','neymar','premier league','champions league'], searches: ['flamengo','neymar psg','champions league'] },
  { name: 'Takeshi', city: 'Osaka', country: 'japan', onboard: ['sports','tech','gaming'], actual: ['f1','formula one','formula 1','grand prix','verstappen','hamilton'], searches: ['formula 1 standings','max verstappen','japanese grand prix'] },
  { name: 'Carlos', city: 'Madrid', country: 'spain', onboard: ['sports','politics','business'], actual: ['tennis','nadal','djokovic','wimbledon','atp','grand slam'], searches: ['atp rankings','nadal retirement','wimbledon draw'] },
  { name: 'Aiden', city: 'Melbourne', country: 'australia', onboard: ['sports','science','health'], actual: ['cricket','ipl','ashes','test match','t20'], searches: ['ipl auction','ashes results','cricket world cup'] },
  { name: 'Jake', city: 'Dallas', country: 'usa', onboard: ['sports','finance','tech'], actual: ['nfl','quarterback','super bowl','touchdown','football'], searches: ['nfl draft','super bowl predictions','patrick mahomes'] },
  { name: 'Yuki', city: 'Tokyo', country: 'japan', onboard: ['sports','entertainment','tech'], actual: ['boxing','mma','ufc','knockout','fight'], searches: ['ufc results','boxing heavyweight','conor mcgregor'] },
  { name: 'Henrik', city: 'Stockholm', country: 'germany', onboard: ['sports','business','science'], actual: ['golf','pga','masters','ryder cup','tiger woods'], searches: ['pga tour standings','masters tournament','tiger woods comeback'] },

  // --- MUSIC & ENTERTAINMENT ---
  { name: 'Priya', city: 'Delhi', country: 'india', onboard: ['entertainment','tech','business'], actual: ['bollywood','indian cinema','shah rukh khan','alia bhatt'], searches: ['bollywood movies 2026','shah rukh khan','indian film awards'] },
  { name: 'Soo-jin', city: 'Seoul', country: 'south korea', onboard: ['entertainment','fashion','tech'], actual: ['k-pop','bts','blackpink','kdrama','korean'], searches: ['bts comeback','blackpink tour','new kdrama'] },
  { name: 'Chioma', city: 'Lagos', country: 'nigeria', onboard: ['entertainment','fashion','business'], actual: ['afrobeats','burna boy','wizkid','davido','amapiano'], searches: ['burna boy album','wizkid tour','afrobeats playlist'] },
  { name: 'Diego', city: 'Mexico City', country: 'mexico', onboard: ['entertainment','sports','lifestyle'], actual: ['reggaeton','latin music','bad bunny','latin pop'], searches: ['bad bunny album','reggaeton new releases','latin grammy'] },
  { name: 'Tyler', city: 'Atlanta', country: 'usa', onboard: ['entertainment','sports','tech'], actual: ['hip-hop','rap','drake','kendrick','travis scott'], searches: ['kendrick lamar','hip hop album','rap beef'] },
  { name: 'Kenji', city: 'Tokyo', country: 'japan', onboard: ['gaming','entertainment','tech'], actual: ['anime','manga','one piece','naruto','studio ghibli','crunchyroll'], searches: ['one piece manga','anime new season','studio ghibli'] },
  { name: 'Liam', city: 'Dublin', country: 'uk', onboard: ['entertainment','sports','politics'], actual: ['comedy','humor','standup','comedian','funny'], searches: ['comedy special netflix','standup comedian tour','best comedy movies'] },

  // --- TECH SPECIFIC ---
  { name: 'Raj', city: 'Mumbai', country: 'india', onboard: ['tech','cricket','finance'], actual: ['ai','artificial intelligence','chatgpt','openai','machine learning','deep learning','llm'], searches: ['chatgpt update','openai gpt-5','ai regulation'] },
  { name: 'Sarah', city: 'San Francisco', country: 'usa', onboard: ['tech','business','health'], actual: ['cybersecurity','hacking','data breach','ransomware','encryption'], searches: ['ransomware attack','cybersecurity trends','data breach news'] },
  { name: 'Dmitri', city: 'Berlin', country: 'germany', onboard: ['tech','science','politics'], actual: ['space tech','spacex','nasa','rocket','starship','satellite'], searches: ['spacex launch','starship update','nasa mars mission'] },
  { name: 'Wei', city: 'Singapore', country: 'singapore', onboard: ['tech','finance','business'], actual: ['robotics','semiconductor','nvidia','chip','processor','hardware'], searches: ['nvidia earnings','semiconductor shortage','ai chip'] },
  { name: 'Omar', city: 'Istanbul', country: 'turkiye', onboard: ['tech','sports','entertainment'], actual: ['smartphone','iphone','samsung','android','gadget','wearable'], searches: ['iphone 18','samsung galaxy','best smartwatch'] },

  // --- POLITICS & WORLD ---
  { name: 'Emma', city: 'London', country: 'uk', onboard: ['politics','health','science'], actual: ['climate','environment','global warming','carbon','emissions','renewable energy'], searches: ['climate change report','renewable energy','carbon emissions'] },
  { name: 'James', city: 'Washington', country: 'usa', onboard: ['politics','finance','business'], actual: ['us politics','congress','senate','white house','trump','biden','supreme court'], searches: ['congress vote','supreme court ruling','presidential election'] },
  { name: 'Fatima', city: 'Istanbul', country: 'turkiye', onboard: ['politics','entertainment','lifestyle'], actual: ['middle east','iran','israel','palestine','gulf'], searches: ['iran nuclear deal','israel palestine','middle east peace'] },
  { name: 'Chen', city: 'Singapore', country: 'singapore', onboard: ['politics','tech','finance'], actual: ['asian politics','china','taiwan','asean','southeast asia'], searches: ['china taiwan tensions','asean summit','singapore economy'] },

  // --- FINANCE & CRYPTO ---
  { name: 'Michael', city: 'New York', country: 'usa', onboard: ['finance','tech','business'], actual: ['stock market','wall street','nasdaq','trading','shares','dow jones'], searches: ['nasdaq today','stock market crash','best stocks 2026'] },
  { name: 'Alex', city: 'London', country: 'uk', onboard: ['crypto','tech','finance'], actual: ['bitcoin','btc','mining','halving','cryptocurrency'], searches: ['bitcoin price','crypto bull run','btc halving'] },
  { name: 'Viktor', city: 'Berlin', country: 'germany', onboard: ['finance','politics','business'], actual: ['defi','web3','blockchain','smart contract','dao'], searches: ['defi yields','web3 gaming','blockchain adoption'] },

  // --- LIFESTYLE ---
  { name: 'Sophie', city: 'Paris', country: 'france', onboard: ['lifestyle','entertainment','health'], actual: ['food','cooking','restaurant','recipe','chef','cuisine','michelin'], searches: ['michelin star restaurants','cooking recipes italian','best chef'] },
  { name: 'Anna', city: 'Barcelona', country: 'spain', onboard: ['lifestyle','sports','entertainment'], actual: ['travel','adventure','tourism','vacation','destination','hotel'], searches: ['best travel destinations','adventure travel','cheap flights europe'] },
  { name: 'Jessica', city: 'Los Angeles', country: 'usa', onboard: ['lifestyle','entertainment','health'], actual: ['fitness','workout','gym','exercise','running','marathon'], searches: ['best workout routine','marathon training','home gym'] },
  { name: 'Kim', city: 'Seoul', country: 'south korea', onboard: ['lifestyle','fashion','entertainment'], actual: ['beauty','skincare','makeup','cosmetics','skincare routine'], searches: ['korean skincare routine','best moisturizer','beauty trends 2026'] },
  { name: 'Lisa', city: 'Sydney', country: 'australia', onboard: ['lifestyle','health','science'], actual: ['pets','animals','dog','cat','veterinary','adoption'], searches: ['dog adoption tips','best cat food','pet health'] },
  { name: 'Rachel', city: 'Toronto', country: 'usa', onboard: ['lifestyle','health','entertainment'], actual: ['parenting','family','children','baby','motherhood'], searches: ['toddler activities','baby sleep training','parenting tips'] },
  { name: 'Mia', city: 'Milan', country: 'france', onboard: ['fashion','entertainment','lifestyle'], actual: ['sneakers','streetwear','nike','adidas','jordan','yeezy'], searches: ['nike air jordan release','streetwear brands','sneaker drop'] },

  // --- HEALTH ---
  { name: 'David', city: 'Boston', country: 'usa', onboard: ['health','science','tech'], actual: ['mental health','anxiety','depression','therapy','mindfulness','wellbeing'], searches: ['anxiety treatment','therapy online','mindfulness meditation'] },
  { name: 'Laura', city: 'Munich', country: 'germany', onboard: ['health','lifestyle','science'], actual: ['medical','breakthrough','treatment','cure','clinical trial'], searches: ['cancer treatment breakthrough','new clinical trial','medical innovation'] },

  // --- SCIENCE ---
  { name: 'Neil', city: 'Houston', country: 'usa', onboard: ['science','tech','health'], actual: ['space','astronomy','mars','telescope','galaxy','asteroid','planet'], searches: ['james webb telescope','mars rover','asteroid discovery'] },
  { name: 'Greta', city: 'Stockholm', country: 'germany', onboard: ['science','politics','health'], actual: ['biology','nature','wildlife','evolution','genetics','ecosystem'], searches: ['endangered species','genetics breakthrough','wildlife conservation'] },

  // --- BUSINESS ---
  { name: 'Robert', city: 'Detroit', country: 'usa', onboard: ['business','tech','finance'], actual: ['automotive','cars','tesla','ford','electric vehicles','ev'], searches: ['tesla model y','electric vehicle sales','ford ev'] },
  { name: 'Tina', city: 'San Jose', country: 'usa', onboard: ['business','tech','entertainment'], actual: ['startup','venture capital','funding','unicorn','vc'], searches: ['startup funding news','unicorn valuation','vc deals 2026'] },
  { name: 'Marco', city: 'Rome', country: 'france', onboard: ['business','politics','finance'], actual: ['real estate','property','housing','mortgage','commercial real estate'], searches: ['housing market crash','commercial real estate','mortgage rates'] },
  { name: 'Nadia', city: 'Dubai', country: 'turkiye', onboard: ['business','entertainment','lifestyle'], actual: ['oil','energy','opec','renewable energy','petroleum'], searches: ['opec meeting','oil prices today','renewable energy investment'] },

  // --- MIXED/BROAD ---
  { name: 'Lucas', city: 'Amsterdam', country: 'germany', onboard: ['tech','entertainment','sports'], actual: ['gaming','video games','playstation','xbox','nintendo','esports','steam'], searches: ['ps5 pro games','xbox game pass','esports tournament'] },
  { name: 'Yara', city: 'Cairo', country: 'turkiye', onboard: ['entertainment','politics','health'], actual: ['movies','film','box office','hollywood','cinema','oscar'], searches: ['oscar nominations','best movies 2026','box office weekend'] },
  { name: 'Tom', city: 'Chicago', country: 'usa', onboard: ['sports','entertainment','finance'], actual: ['nba','basketball','lakers','celtics','lebron','playoffs'], searches: ['nba standings','lebron james','nba playoffs bracket'] },
  { name: 'Ines', city: 'Lisbon', country: 'spain', onboard: ['entertainment','lifestyle','tech'], actual: ['tv','streaming','netflix','hbo','disney plus','series'], searches: ['netflix new releases','hbo max series','best streaming shows'] },
  { name: 'Ahmed', city: 'Riyadh', country: 'turkiye', onboard: ['sports','politics','business'], actual: ['soccer','football','premier league','champions league','la liga'], searches: ['premier league standings','champions league draw','la liga results'] },
  { name: 'Nina', city: 'Moscow', country: 'germany', onboard: ['science','health','politics'], actual: ['earth science','earthquake','volcano','ocean','weather'], searches: ['earthquake today','volcanic eruption','ocean temperature'] },
  { name: 'Pedro', city: 'Buenos Aires', country: 'brazil', onboard: ['sports','entertainment','politics'], actual: ['soccer','football','messi','world cup','copa america'], searches: ['messi inter miami','copa america','world cup qualifiers'] },
  { name: 'Hana', city: 'Kyoto', country: 'japan', onboard: ['lifestyle','entertainment','health'], actual: ['food','cooking','restaurant','recipe','japanese cuisine'], searches: ['ramen recipe','sushi restaurant','japanese cooking'] },
  { name: 'Emre', city: 'Ankara', country: 'turkiye', onboard: ['sports','tech','business'], actual: ['f1','formula one','galatasaray','soccer','turkish super league'], searches: ['galatasaray transfer','f1 race results','turkish super league'] },
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function matchesInterest(article, persona) {
  const tags = Array.isArray(article.interest_tags) ? article.interest_tags : [];
  const lowerTags = tags.map(t => t.toLowerCase());
  const titleLower = (article.title_news || '').toLowerCase();
  for (const interest of persona.actual) {
    if (lowerTags.some(t => t.includes(interest))) return true;
    if (titleLower.includes(interest)) return true;
  }
  return false;
}

async function trackEvent(userId, eventType, articleId, metadata = {}) {
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        article_id: articleId || undefined,
        user_id: userId,
        guest_device_id: userId,
        metadata
      })
    });
  } catch (_) {}
}

async function fetchFeed(userId, topics, country, cursor = null) {
  let url = `${FEED_URL}?user_id=${userId}&followed_topics=${topics.join(',')}&home_country=${country}&limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (e) {
    return { articles: [], next_cursor: null };
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ═══════════════════════════════════════════════════════
// RUN ONE PERSONA
// ═══════════════════════════════════════════════════════

async function runPersona(persona, index) {
  const userId = generateUUID();
  const email = `persona_${persona.name.toLowerCase()}_${index}@tennews.test`;

  console.log(`\n[${index+1}/50] ${persona.name} (${persona.city}, ${persona.country})`);
  console.log(`  Onboarding: [${persona.onboard.join(', ')}]`);
  console.log(`  Actual interests: [${persona.actual.slice(0, 5).join(', ')}]`);

  // 1. Create user
  const { error: createErr } = await supabase.from('users').upsert({
    id: userId,
    email,
    home_country: persona.country,
    followed_countries: [persona.country],
    followed_topics: persona.onboard.slice(0, 9)
  }, { onConflict: 'id' });

  if (createErr) {
    console.log(`  ERROR creating user: ${createErr.message}`);
    return { persona: persona.name, error: createErr.message };
  }

  // 2. Clear profiles
  await supabase.from('users').update({ tag_profile: {}, skip_profile: {} }).eq('id', userId);

  // 3. Send searches
  for (const query of persona.searches) {
    await trackEvent(userId, 'search_query', null, { query });
    await sleep(200);
  }
  console.log(`  Searched: [${persona.searches.join(', ')}]`);
  await sleep(3000);

  // 4. Fetch and process 3 pages
  const pageStats = [];
  let cursor = null;

  for (let page = 1; page <= 3; page++) {
    const feed = await fetchFeed(userId, persona.onboard, persona.country, cursor);
    const articles = feed.articles || [];
    cursor = feed.next_cursor;

    let matches = 0, skips = 0, engages = 0, likes = 0, saves = 0;

    for (const article of articles) {
      const isMatch = matchesInterest(article, persona);

      if (isMatch) {
        matches++;
        const rand = Math.random();
        if (rand < 0.05) {
          // Save
          await trackEvent(userId, 'article_saved', article.id, { dwell: '20', dwell_tier: 'engaged_read' });
          saves++;
        } else if (rand < 0.35) {
          // Like
          await trackEvent(userId, 'article_liked', article.id, { dwell: String(15 + Math.random() * 15), dwell_tier: 'engaged_read' });
          likes++;
        } else {
          // Engage
          await trackEvent(userId, 'article_engaged', article.id, { dwell: String(8 + Math.random() * 17), dwell_tier: 'engaged_read' });
          engages++;
        }
      } else {
        const rand = Math.random();
        if (rand < 0.80) {
          // Skip
          await trackEvent(userId, 'article_skipped', article.id, { dwell: String(0.3 + Math.random() * 1.2), dwell_tier: 'instant_skip' });
          skips++;
        } else {
          // Neutral view
          await trackEvent(userId, 'article_view', article.id, { dwell: String(3 + Math.random() * 2), dwell_tier: 'glance' });
        }
      }
      await sleep(50); // Don't hammer the API
    }

    const matchRate = articles.length > 0 ? (matches / articles.length * 100) : 0;
    pageStats.push({ page, total: articles.length, matches, matchRate, skips, engages, likes, saves });
    console.log(`  Page ${page}: ${articles.length} articles, ${matches} matches (${matchRate.toFixed(0)}%), ${likes} likes, ${engages} engages, ${skips} skips`);

    if (page < 3) await sleep(3000); // Wait for signals to propagate
  }

  // 5. Check final profile state
  const { data: profile } = await supabase.from('users').select('tag_profile, skip_profile').eq('id', userId).single();
  const tagCount = Object.keys(profile?.tag_profile || {}).length;
  const skipCount = Object.keys(profile?.skip_profile || {}).length;

  // 6. Score
  const earlyMatch = pageStats[0]?.matchRate || 0;
  const lateMatch = pageStats[2]?.matchRate || pageStats[1]?.matchRate || 0;
  const improvement = lateMatch - earlyMatch;
  const learned = improvement > 10;
  const softPivot = improvement > 5;

  const result = {
    persona: persona.name,
    city: persona.city,
    earlyMatch: earlyMatch.toFixed(1),
    lateMatch: lateMatch.toFixed(1),
    improvement: improvement.toFixed(1),
    learned,
    softPivot,
    tagCount,
    skipCount,
    totalLikes: pageStats.reduce((s, p) => s + p.likes, 0),
    totalEngages: pageStats.reduce((s, p) => s + p.engages, 0),
    totalSkips: pageStats.reduce((s, p) => s + p.skips, 0),
  };

  console.log(`  Result: ${earlyMatch.toFixed(0)}% → ${lateMatch.toFixed(0)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(0)}%) | ${learned ? 'LEARNED' : softPivot ? 'SOFT PIVOT' : 'NO CHANGE'} | tags:${tagCount} skips:${skipCount}`);

  // Cleanup
  await supabase.from('users').delete().eq('id', userId);
  await supabase.from('user_article_events').delete().eq('user_id', userId);

  return result;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  50-PERSONA REALISTIC FEED LEARNING TEST');
  console.log('═══════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Signals: search, like, save, engage, skip`);
  console.log(`Pages per persona: 3 (60 articles total)`);
  console.log();

  const results = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < PERSONAS.length; i += BATCH_SIZE) {
    const batch = PERSONAS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((p, j) => runPersona(p, i + j).catch(e => ({ persona: p.name, error: e.message })))
    );
    results.push(...batchResults);
  }

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════');
  console.log('  FINAL RESULTS');
  console.log('═══════════════════════════════════════════\n');

  const valid = results.filter(r => !r.error);
  const learned = valid.filter(r => r.learned);
  const softPivot = valid.filter(r => r.softPivot);
  const noChange = valid.filter(r => !r.softPivot);

  console.log(`Total personas: ${PERSONAS.length}`);
  console.log(`Valid results: ${valid.length}`);
  console.log(`Learned (>10pt improvement): ${learned.length} (${(learned.length/valid.length*100).toFixed(0)}%)`);
  console.log(`Soft pivot (>5pt improvement): ${softPivot.length} (${(softPivot.length/valid.length*100).toFixed(0)}%)`);
  console.log(`No change: ${noChange.length} (${(noChange.length/valid.length*100).toFixed(0)}%)`);

  const avgImprovement = valid.reduce((s, r) => s + parseFloat(r.improvement), 0) / valid.length;
  const avgEarly = valid.reduce((s, r) => s + parseFloat(r.earlyMatch), 0) / valid.length;
  const avgLate = valid.reduce((s, r) => s + parseFloat(r.lateMatch), 0) / valid.length;
  const avgTags = valid.reduce((s, r) => s + r.tagCount, 0) / valid.length;
  const avgSkips = valid.reduce((s, r) => s + r.skipCount, 0) / valid.length;

  console.log(`\nAvg early match: ${avgEarly.toFixed(1)}%`);
  console.log(`Avg late match: ${avgLate.toFixed(1)}%`);
  console.log(`Avg improvement: ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)} pts`);
  console.log(`Avg tag_profile size: ${avgTags.toFixed(0)} tags`);
  console.log(`Avg skip_profile size: ${avgSkips.toFixed(0)} tags`);

  // Grade
  const learnRate = learned.length / valid.length * 100;
  let grade;
  if (learnRate >= 70) grade = 'A';
  else if (learnRate >= 50) grade = 'B';
  else if (learnRate >= 30) grade = 'C';
  else if (learnRate >= 15) grade = 'D';
  else grade = 'F';

  console.log(`\n  GRADE: ${grade} (${learnRate.toFixed(0)}% learned)`);

  // Top 5 / Bottom 5
  const sorted = [...valid].sort((a, b) => parseFloat(b.improvement) - parseFloat(a.improvement));
  console.log('\nTop 5 learners:');
  for (const r of sorted.slice(0, 5)) {
    console.log(`  ${r.persona.padEnd(12)} ${r.earlyMatch}% → ${r.lateMatch}% (+${r.improvement}) | likes:${r.totalLikes} engages:${r.totalEngages} tags:${r.tagCount}`);
  }
  console.log('\nBottom 5:');
  for (const r of sorted.slice(-5)) {
    console.log(`  ${r.persona.padEnd(12)} ${r.earlyMatch}% → ${r.lateMatch}% (${r.improvement}) | likes:${r.totalLikes} skips:${r.totalSkips} tags:${r.tagCount}`);
  }

  // Errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) console.log(`  ${e.persona}: ${e.error}`);
  }

  console.log(`\nDone at ${new Date().toISOString()}`);
}

main().catch(console.error);

import fs from 'fs';

const results = JSON.parse(fs.readFileSync('test_20persona_results_v5.json', 'utf8'));

const PERSONA_META = {
  Lena:     { age: 32, loc: 'San Francisco', bio: 'AI research lead, follows OpenAI/Anthropic race', alt: 'Hacker News, ArXiv, Reddit r/MachineLearning' },
  Marco:    { age: 35, loc: 'Milan', bio: 'Sports editor, AC Milan & Ferrari F1 fan', alt: 'ESPN, OneFootball, Gazzetta, Sky Sport' },
  Nadia:    { age: 48, loc: 'Berlin', bio: 'IR professor at Humboldt, NATO/Middle East specialist', alt: 'Foreign Affairs, FT, Reuters, Der Spiegel' },
  Ryan:     { age: 38, loc: 'New York', bio: 'Quant PM, trades S&P futures, Yankees fan', alt: 'Bloomberg Terminal, WSJ, CNBC, Finviz' },
  Elif:     { age: 29, loc: 'Istanbul', bio: 'Fintech designer, Galatasaray fan', alt: 'TechCrunch, OneFootball, Webrazzi, Hacker News' },
  Sophie:   { age: 27, loc: 'Lyon', bio: 'Oncology resident, Olympique Lyonnais fan', alt: 'Medscape, PubMed, L\'Equipe, STAT News' },
  Thomas:   { age: 40, loc: 'Amsterdam', bio: 'Climate journalist at NRC, Ajax fan', alt: 'Guardian Environment, Carbon Brief, NOS, NRC' },
  Ayse:     { age: 34, loc: 'Ankara', bio: 'SaaS founder, Besiktas fan', alt: 'TechCrunch, Product Hunt, LinkedIn, Webrazzi' },
  Mike:     { age: 58, loc: 'Dallas', bio: 'Retired colonel, Cowboys & Red Bull Racing fan', alt: 'Fox News, CNN, Defense One, ESPN' },
  Zara:     { age: 20, loc: 'London', bio: 'UCL student, TikTok creator, Arsenal fan', alt: 'TikTok, Instagram, Spotify, Apple News' },
  Robert:   { age: 68, loc: 'Tampa', bio: 'Retired principal, Bucs & Rays fan, gold investor', alt: 'Apple News, CNN, local TV news, Google News' },
  Devon:    { age: 21, loc: 'Austin', bio: 'UT senior, Eagles & Mavs fan, CoD player', alt: 'ESPN, Bleacher Report, TikTok Sports, Twitter/X' },
  Camille:  { age: 33, loc: 'Paris', bio: 'Balenciaga creative director, PSG & A24 fan', alt: 'Instagram, Vogue, Pinterest, Highsnobiety' },
  Diego:    { age: 26, loc: 'Miami', bio: 'DeFi analyst, Real Madrid fan', alt: 'CoinDesk, Crypto Twitter, DeFi Llama, Bloomberg' },
  Jennifer: { age: 39, loc: 'Toronto', bio: 'Science teacher, Raptors fan, mom of two', alt: 'CBC, NPR, The Verge, Apple News' },
  Lars:     { age: 23, loc: 'Stockholm', bio: 'Semi-pro CS2 player, Twitch streamer, AIK fan', alt: 'Reddit, Discord, YouTube Gaming, Tom\'s Hardware' },
  Henrik:   { age: 52, loc: 'Geneva', bio: 'Former diplomat, think tank director', alt: 'The Economist, FT, Foreign Affairs, Politico EU' },
  Amara:    { age: 34, loc: 'Montreal', bio: 'ER nurse at McGill, Canadiens fan', alt: 'STAT News, Medscape, CBC Health, Nature' },
  Antonio:  { age: 43, loc: 'Barcelona', bio: 'Restaurant owner, FC Barcelona soci since 2005', alt: 'Marca, El Pais, LinkedIn, Google News' },
  Fatima:   { age: 24, loc: 'Washington DC', bio: 'Georgetown law student, ACLU intern, Man City fan', alt: 'SCOTUSblog, NPR, Politico, Apple News' },
};

for (const r of results) {
  const meta = PERSONA_META[r.persona];
  if (!meta) continue;

  const allInts = r.sessions.flatMap(s => s.interactions);
  const total = allInts.length;
  const engaged = allInts.filter(i => i.signal === 'ENGAGE').length;
  const saved = allInts.filter(i => i.save).length;
  const deepReads = allInts.filter(i => i.action === 'DEEP_READ').length;
  const skipped = allInts.filter(i => i.signal === 'SKIP').length;
  const totalDwell = allInts.reduce((s, i) => s + i.dwell, 0);
  const engRate = total > 0 ? ((engaged / total) * 100).toFixed(0) : 0;
  const rageQuits = r.sessions.filter(s => s.exitType === 'frustrated').length;

  // Category distribution
  const catCounts = {};
  for (const i of allInts) catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const topCatStr = topCats.slice(0, 3).map(([c, n]) => `${c}(${n})`).join(', ');

  // Subtopic coverage
  const stSeen = {};
  for (const i of allInts) {
    for (const st of (i.matchedSubtopics || [])) stSeen[st] = (stSeen[st] || 0) + 1;
  }
  const coveredSt = r.subtopics.filter(st => (stSeen[st] || 0) > 0);
  const missingSt = r.subtopics.filter(st => (stSeen[st] || 0) === 0);
  const relevantCount = allInts.filter(i => (i.matchedSubtopics || []).length > 0).length;
  const relevantPct = total > 0 ? ((relevantCount / total) * 100).toFixed(0) : 0;

  // Longest read
  const longest = allInts.reduce((best, i) => i.dwell > best.dwell ? i : best, { dwell: 0, title: '-', category: '-' });

  // Score
  const pctScore = ((r.scores.total / 25) * 100).toFixed(0);

  console.log(`\n${'━'.repeat(100)}`);
  console.log(`${r.persona.toUpperCase()}, ${meta.age} — ${meta.bio} (${meta.loc})`);
  console.log(`Selected: ${r.subtopics.join(', ')}`);
  console.log(`Score: ${pctScore}/100 (R:${r.scores.relevance} C:${r.scores.coverage} D:${r.scores.diversity} Q:${r.scores.quality} W:${r.scores.wouldReturn})`);
  console.log(`Stats: ${engaged}/${total} engaged (${engRate}%) │ ${deepReads} deep reads │ ${saved} saved │ ${skipped} skipped │ ${rageQuits} rage quit(s)`);
  console.log(`Feed showed: ${topCatStr} │ Relevant: ${relevantPct}%`);
  if (missingSt.length > 0) console.log(`Missing subtopics: ${missingSt.join(', ')}`);
  console.log(`${'─'.repeat(100)}`);

  // Generate contextual feedback based on actual data
  const score = parseInt(pctScore);
  const relev = r.scores.relevance;
  const cover = r.scores.coverage;
  const wouldRet = r.scores.wouldReturn;

  // Q1: How was the experience?
  let q1;
  if (score >= 90) {
    q1 = `"Really impressed. ${relevantPct}% of what I saw was actually relevant to me. ${deepReads > 10 ? `I deep-read ${deepReads} articles — that is a lot for one sitting.` : `Found ${engaged} articles worth engaging with.`} The feed understood that I care about ${coveredSt.slice(0, 2).join(' and ')}. ${saved > 0 ? `Saved ${saved} pieces for later.` : 'Genuinely useful content.'}"`;
  } else if (score >= 75) {
    q1 = `"Pretty good overall. About ${relevantPct}% of articles matched what I selected. ${coveredSt.length === r.subtopics.length ? 'All my topics were covered, which is nice.' : `${missingSt.join(', ')} had nothing though.`} ${deepReads > 5 ? `${deepReads} deep reads — decent engagement.` : 'Could have found more to really dive into.'} Better than I expected from a new app."`;
  } else if (score >= 60) {
    q1 = `"Mixed. Only ${relevantPct}% of articles were actually about what I selected. ${missingSt.length > 0 ? `Zero content for ${missingSt.join(', ')}.` : ''} I had to scroll through a lot of ${topCats[0][0]} content I did not ask for. ${engaged} out of ${total} articles engaged — that means I wasted time on the other ${total - engaged}."`;
  } else {
    q1 = `"Disappointing. Only ${relevantPct}% of the feed was relevant. I selected ${r.subtopics.join(', ')} — and mostly got ${topCats[0][0]} and ${topCats[1]?.[0] || 'random'} content instead. ${missingSt.length > 0 ? `Nothing at all for: ${missingSt.join(', ')}.` : ''} I engaged with just ${engaged} out of ${total} articles."`;
  }

  console.log(`Q: How was your experience with the feed?`);
  console.log(`A: ${q1}`);
  console.log('');

  // Q2: What worked / what did not?
  let q2;
  if (coveredSt.length > 0 && missingSt.length > 0) {
    const bestSt = coveredSt.sort((a, b) => (stSeen[b] || 0) - (stSeen[a] || 0))[0];
    q2 = `"${bestSt} coverage was solid — saw ${stSeen[bestSt]} articles on it. ${coveredSt.length > 1 ? `${coveredSt[1]} also showed up (${stSeen[coveredSt[1]]} articles).` : ''} But ${missingSt.join(' and ')}? Completely absent. ${missingSt.length >= 2 ? 'That is a big gap.' : 'That one missing topic matters to me.'} The app needs more content sources for ${missingSt[0]}."`;
  } else if (coveredSt.length === r.subtopics.length) {
    const bestSt = coveredSt.sort((a, b) => (stSeen[b] || 0) - (stSeen[a] || 0))[0];
    const weakSt = coveredSt.sort((a, b) => (stSeen[a] || 0) - (stSeen[b] || 0))[0];
    q2 = `"All my topics showed up, which is great. ${bestSt} had the most with ${stSeen[bestSt]} articles. ${weakSt} was thinner with only ${stSeen[weakSt]}. ${total > 40 ? `Across ${total} articles, the ratio of relevant to noise was ${relevantPct}% — that is ${parseInt(relevantPct) >= 60 ? 'solid' : 'not great'}.` : ''}"`;
  } else {
    q2 = `"Almost nothing worked. Out of ${r.subtopics.length} topics I selected, only ${coveredSt.length} showed up. ${missingSt.length > 0 ? `No content at all for: ${missingSt.join(', ')}.` : ''} The feed feels like it is showing me the same trending articles as everyone else."`;
  }

  console.log(`Q: What worked and what did not?`);
  console.log(`A: ${q2}`);
  console.log('');

  // Q3: Compared to alternatives
  let q3;
  if (score >= 85) {
    q3 = `"Better than I expected. ${meta.alt.split(', ')[0]} is still my primary source, but this could be a good second screen. The personalization actually works — it learned what I care about. ${saved > 0 ? `I saved ${saved} articles I would not have found otherwise.` : 'Found things I might have missed.'} If it keeps improving, I could see using this daily."`;
  } else if (score >= 70) {
    q3 = `"Decent compared to ${meta.alt.split(', ')[0]}, but not a replacement. ${meta.alt.split(', ')[0]} gives me ${r.subtopics[0]} content instantly. Here I still had to scroll past irrelevant stuff. The concept is good though — a personalized mix across my interests is something ${meta.alt.split(', ')[0]} does not do."`;
  } else if (score >= 55) {
    q3 = `"${meta.alt.split(', ')[0]} is better for what I need. ${meta.alt.split(', ').slice(0, 2).join(' and ')} already give me ${r.subtopics[0]} and ${r.subtopics[1] || r.subtopics[0]} content without asking me to pick topics. This app asked what I care about and then mostly ignored it."`;
  } else {
    q3 = `"Not even close to ${meta.alt.split(', ')[0]}. I use ${meta.alt.split(', ').slice(0, 2).join(' and ')} and they serve exactly what I want. This app showed me ${topCats[0][0]} articles when I asked for ${r.subtopics[0]}. Why would I switch?"`;
  }

  console.log(`Q: How does this compare to ${meta.alt.split(', ')[0]}?`);
  console.log(`A: ${q3}`);
  console.log('');

  // Q4: Would you come back?
  let q4;
  if (wouldRet >= 5) {
    q4 = `"Yes. This is genuinely useful. I found ${engaged} relevant articles across ${r.sessions.length} sessions. The feed understood my interests from the start. Will keep checking it."`;
  } else if (wouldRet >= 4) {
    q4 = `"Probably yes. Not perfect — ${100 - parseInt(relevantPct)}% of the content was noise I had to skip. But the core experience was good enough. If the ${missingSt.length > 0 ? missingSt[0] + ' content improves' : 'relevance ratio goes up'}, this becomes a daily app."`;
  } else if (wouldRet >= 3) {
    q4 = `"Maybe. It is okay but not compelling enough to make it a habit. ${meta.alt.split(', ')[0]} already serves me well. I would need to see ${missingSt.length > 0 ? `actual ${missingSt[0]} content` : 'better personalization'} to come back."`;
  } else if (wouldRet >= 2) {
    q4 = `"Unlikely. ${skipped} out of ${total} articles were skips — that is too much wasted time. ${missingSt.length > 0 ? `Zero ${missingSt[0]} content after selecting it as a top interest.` : 'The feed did not learn what I care about.'} I have better options."`;
  } else {
    q4 = `"No. ${rageQuits > 0 ? `I rage-quit ${rageQuits} session(s). ` : ''}The feed showed me almost nothing I cared about. ${engaged} out of ${total} articles engaged. ${missingSt.length > 0 ? `My top interests (${missingSt.join(', ')}) had zero articles.` : ''} Uninstalling."`;
  }

  console.log(`Q: Would you come back?`);
  console.log(`A: ${q4}`);
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${'━'.repeat(100)}`);
console.log('SUMMARY: FEEDBACK ACROSS ALL 20 PERSONAS');
console.log('━'.repeat(100));

const scores = results.map(r => parseInt(((r.scores.total / 25) * 100).toFixed(0)));
const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0);

// Count patterns
const allMissing = {};
for (const r of results) {
  const allInts = r.sessions.flatMap(s => s.interactions);
  const stSeen = {};
  for (const i of allInts) {
    for (const st of (i.matchedSubtopics || [])) stSeen[st] = true;
  }
  for (const st of r.subtopics) {
    if (!stSeen[st]) allMissing[st] = (allMissing[st] || 0) + 1;
  }
}

const wouldReturn = results.filter(r => r.scores.wouldReturn >= 4).length;
const atRisk = results.filter(r => r.scores.wouldReturn === 3).length;
const willChurn = results.filter(r => r.scores.wouldReturn <= 2).length;
const perfect = results.filter(r => r.scores.total === 25).length;
const poor = results.filter(r => r.scores.total <= 15).length;
const lowRelevance = results.filter(r => r.scores.relevance <= 2).length;

console.log('');
console.log(`Overall score: ${avgScore}/100`);
console.log(`Perfect scores (25/25): ${perfect}/20`);
console.log(`Poor scores (≤15/25): ${poor}/20`);
console.log('');
console.log('RETENTION:');
console.log(`  Would return (4-5):   ${wouldReturn}/20`);
console.log(`  At risk (3):          ${atRisk}/20`);
console.log(`  Will churn (1-2):     ${willChurn}/20`);
console.log('');
console.log('CONTENT GAPS (subtopics with zero articles):');
const missingRanked = Object.entries(allMissing).sort((a, b) => b[1] - a[1]);
if (missingRanked.length > 0) {
  for (const [st, count] of missingRanked) {
    console.log(`  ✗ ${st.padEnd(35)} — missing for ${count} persona(s)`);
  }
} else {
  console.log('  None — all subtopics had content!');
}
console.log('');

console.log('WEAKEST DIMENSION:');
const dimAvgs = {
  'Subtopic Relevance': results.reduce((s, r) => s + r.scores.relevance, 0) / results.length,
  'Interest Coverage': results.reduce((s, r) => s + r.scores.coverage, 0) / results.length,
  'Diversity': results.reduce((s, r) => s + r.scores.diversity, 0) / results.length,
  'Quality': results.reduce((s, r) => s + r.scores.quality, 0) / results.length,
  'Would Return': results.reduce((s, r) => s + r.scores.wouldReturn, 0) / results.length,
};
const weakest = Object.entries(dimAvgs).sort((a, b) => a[1] - b[1])[0];
const strongest = Object.entries(dimAvgs).sort((a, b) => b[1] - a[1])[0];
console.log(`  Weakest:  ${weakest[0]} (${weakest[1].toFixed(1)}/5)`);
console.log(`  Strongest: ${strongest[0]} (${strongest[1].toFixed(1)}/5)`);
console.log('');

console.log('KEY PATTERNS:');
if (lowRelevance > 0) console.log(`  • ${lowRelevance}/20 personas got ≤20% relevant content (relevance score 1-2/5)`);
if (missingRanked.length > 0) console.log(`  • ${missingRanked.length} subtopics had ZERO articles — entertainment/lifestyle content is the biggest gap`);
if (wouldReturn >= 15) console.log(`  • ${wouldReturn}/20 would return — strong retention signal`);
else if (wouldReturn >= 10) console.log(`  • ${wouldReturn}/20 would return — decent but needs improvement for niche users`);
else console.log(`  • Only ${wouldReturn}/20 would return — serious retention risk`);

const entertainmentPersonas = results.filter(r => r.subtopics.some(st => ['Music', 'Movies & Film', 'K-Pop & K-Drama', 'Celebrity Style & Red Carpet', 'Celebrity News'].includes(st)));
const entertainmentAvg = entertainmentPersonas.length > 0 ? (entertainmentPersonas.reduce((s, r) => s + r.scores.total, 0) / entertainmentPersonas.length / 25 * 100).toFixed(0) : 'N/A';
const techPersonas = results.filter(r => r.subtopics.some(st => ['AI & Machine Learning', 'Robotics & Hardware', 'Smartphones & Gadgets', 'Cybersecurity', 'Space Tech'].includes(st)));
const techAvg = techPersonas.length > 0 ? (techPersonas.reduce((s, r) => s + r.scores.total, 0) / techPersonas.length / 25 * 100).toFixed(0) : 'N/A';
const politicsPersonas = results.filter(r => r.subtopics.some(st => ['US Politics', 'European Politics', 'War & Conflict', 'Middle East', 'Human Rights & Civil Liberties'].includes(st)));
const politicsAvg = politicsPersonas.length > 0 ? (politicsPersonas.reduce((s, r) => s + r.scores.total, 0) / politicsPersonas.length / 25 * 100).toFixed(0) : 'N/A';
const sportsPersonas = results.filter(r => r.subtopics.some(st => ['NFL', 'NBA', 'Soccer/Football', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'Cricket'].includes(st)));
const sportsAvg = sportsPersonas.length > 0 ? (sportsPersonas.reduce((s, r) => s + r.scores.total, 0) / sportsPersonas.length / 25 * 100).toFixed(0) : 'N/A';

console.log('');
console.log('SCORE BY INTEREST CLUSTER:');
console.log(`  Politics/Geopolitics users:   ${politicsAvg}/100`);
console.log(`  Tech/AI users:                ${techAvg}/100`);
console.log(`  Sports users:                 ${sportsAvg}/100`);
console.log(`  Entertainment/Lifestyle users: ${entertainmentAvg}/100`);

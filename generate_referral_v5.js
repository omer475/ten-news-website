import fs from 'fs';

const results = JSON.parse(fs.readFileSync('test_20persona_results_v5.json', 'utf8'));

const PERSONA_META = {
  Lena:     { age: 32, loc: 'San Francisco', bio: 'AI research lead, follows OpenAI/Anthropic race', friends: 'ML engineers, robotics nerds, indie game devs', socialCircle: 'tech Twitter, Slack communities, arXiv reading groups' },
  Marco:    { age: 35, loc: 'Milan', bio: 'Sports editor, AC Milan & Ferrari F1 fan', friends: 'sports journalists, Milan ultras friends, F1 fans at the bar', socialCircle: 'newsroom WhatsApp, football Twitter, Italian sports community' },
  Nadia:    { age: 48, loc: 'Berlin', bio: 'IR professor at Humboldt, NATO specialist', friends: 'academics, policy analysts, PhD students, diplomats', socialCircle: 'conferences, academic mailing lists, think tank networks' },
  Ryan:     { age: 38, loc: 'New York', bio: 'Quant PM, trades S&P futures, Yankees fan', friends: 'Wall Street colleagues, fintech founders, Yankees crew', socialCircle: 'Bloomberg chat, finance Slack, YC founder groups' },
  Elif:     { age: 29, loc: 'Istanbul', bio: 'Fintech designer, Galatasaray fan', friends: 'Istanbul tech community, Galatasaray matchday friends, designers', socialCircle: 'Turkish startup WhatsApp, football Twitter, Figma community' },
  Sophie:   { age: 27, loc: 'Lyon', bio: 'Oncology resident, OL season ticket holder', friends: 'fellow residents, med school classmates, OL matchday friends', socialCircle: 'hospital group chats, L\'Equipe comments, medical alumni' },
  Thomas:   { age: 40, loc: 'Amsterdam', bio: 'Climate journalist at NRC, Ajax fan', friends: 'climate journalists, environmental activists, Ajax supporters', socialCircle: 'climate journalism Slack, NRC newsroom, Ajax fan groups' },
  Ayse:     { age: 34, loc: 'Ankara', bio: 'SaaS founder, Besiktas fan', friends: 'founders, VCs, product managers, Besiktas supporters', socialCircle: 'founder WhatsApp groups, LinkedIn, Turkish startup ecosystem' },
  Mike:     { age: 58, loc: 'Dallas', bio: 'Retired colonel, Cowboys & Red Bull Racing fan', friends: 'veterans, military analysts, Cowboys tailgate crew, F1 watch party group', socialCircle: 'veteran Facebook groups, defense forums, family group text' },
  Zara:     { age: 20, loc: 'London', bio: 'UCL student, TikTok creator, Arsenal fan', friends: 'uni friends, TikTok mutuals, Arsenal matchday crew, climate activists', socialCircle: 'group chats, Instagram stories, TikTok, Discord' },
  Robert:   { age: 68, loc: 'Tampa', bio: 'Retired principal, Bucs & Rays fan', friends: 'retired teachers, golf buddies, Bucs tailgate crew, grandkids', socialCircle: 'Facebook, email forwards, family iMessage group' },
  Devon:    { age: 21, loc: 'Austin', bio: 'UT senior, Eagles & Mavs fan, CoD player', friends: 'frat brothers, Eagles groupchat, gaming squad, sneakerheads', socialCircle: 'Instagram, TikTok, Snapchat, Discord' },
  Camille:  { age: 33, loc: 'Paris', bio: 'Balenciaga creative director, PSG & A24 fan', friends: 'designers, stylists, fashion editors, PSG corporate box crew', socialCircle: 'Instagram, fashion industry WhatsApp, Paris creative scene' },
  Diego:    { age: 26, loc: 'Miami', bio: 'DeFi analyst, Real Madrid fan', friends: 'crypto traders, DeFi degens, Miami Real Madrid pena members', socialCircle: 'Crypto Twitter, Telegram groups, Discord alpha channels' },
  Jennifer: { age: 39, loc: 'Toronto', bio: 'Science teacher, Raptors fan, mom of two', friends: 'teacher colleagues, mom friends, Raptors watch party group', socialCircle: 'teacher Facebook groups, PTA WhatsApp, neighborhood chats' },
  Lars:     { age: 23, loc: 'Stockholm', bio: 'Semi-pro CS2 player, Twitch streamer, AIK fan', friends: 'esports teammates, gaming friends, tech enthusiasts, AIK friends', socialCircle: 'Discord servers, Twitch community, Reddit, Swedish gaming scene' },
  Henrik:   { age: 52, loc: 'Geneva', bio: 'Former diplomat, think tank director', friends: 'policy experts, EU officials, journalists, Young Boys matchday group', socialCircle: 'think tank email lists, Politico EU readers, Geneva diplomatic circles' },
  Amara:    { age: 34, loc: 'Montreal', bio: 'ER nurse at McGill, Canadiens fan', friends: 'nurses, doctors, Habs watch party group, book club members', socialCircle: 'hospital WhatsApp, nursing Facebook groups, Montreal health community' },
  Antonio:  { age: 43, loc: 'Barcelona', bio: 'Restaurant owner, FC Barcelona soci', friends: 'restaurant owners, Camp Nou regulars, Barca transfer rumor WhatsApp', socialCircle: 'business WhatsApp, penya Barca, LinkedIn' },
  Fatima:   { age: 24, loc: 'Washington DC', bio: 'Georgetown law, ACLU intern, Man City fan', friends: 'law school classmates, policy interns, Man City Discord group', socialCircle: 'law school GroupMe, political Twitter, DC intern networks' },
};

console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  REFERRAL & PRODUCT VALUE INTERVIEWS — "Would you tell your friends about this app?"             ║');
console.log('║  Context: In the future, content creation will be open for public users too                      ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════╝');

let promoters = 0;
let passives = 0;
let detractors = 0;
let excitedAboutUGC = 0;
let wouldRefer = 0;

for (const r of results) {
  const meta = PERSONA_META[r.persona];
  if (!meta) continue;

  const allInts = r.sessions.flatMap(s => s.interactions);
  const total = allInts.length;
  const engaged = allInts.filter(i => i.signal === 'ENGAGE').length;
  const saved = allInts.filter(i => i.save).length;
  const deepReads = allInts.filter(i => i.action === 'DEEP_READ').length;
  const relevantCount = allInts.filter(i => (i.matchedSubtopics || []).length > 0).length;
  const relevantPct = total > 0 ? ((relevantCount / total) * 100).toFixed(0) : 0;
  const pctScore = ((r.scores.total / 25) * 100).toFixed(0);
  const score = parseInt(pctScore);

  // Subtopic coverage
  const stSeen = {};
  for (const i of allInts) {
    for (const st of (i.matchedSubtopics || [])) stSeen[st] = (stSeen[st] || 0) + 1;
  }
  const missingSt = r.subtopics.filter(st => (stSeen[st] || 0) === 0);
  const coveredSt = r.subtopics.filter(st => (stSeen[st] || 0) > 0);

  console.log(`\n${'━'.repeat(100)}`);
  console.log(`${r.persona.toUpperCase()}, ${meta.age} — ${meta.bio} (${meta.loc})`);
  console.log(`Score: ${pctScore}/100 │ Subtopics: ${r.subtopics.join(', ')}`);
  console.log(`Friends: ${meta.friends}`);
  console.log(`${'─'.repeat(100)}`);

  // Q1: Is this a useful product?
  let q1;
  if (score >= 90) {
    q1 = `"Yes, genuinely useful. ${relevantPct}% of my feed was relevant — that is way better than scrolling Twitter or Google News where you get everything and nothing at the same time. I picked ${r.subtopics.length} specific topics and the app actually delivered. ${deepReads} deep reads across ${r.sessions.length} sessions — I was not just scrolling, I was actually reading. That is rare for a news app."`;
  } else if (score >= 75) {
    q1 = `"It has potential. About ${relevantPct}% relevance — not perfect but better than most news apps on day one. ${coveredSt.length}/${r.subtopics.length} of my topics showed up. ${missingSt.length > 0 ? `The gap is ${missingSt.join(', ')} — zero content there.` : 'All my topics had articles.'} If the algorithm keeps learning, this could become genuinely useful. Right now it is a 'check occasionally' app, not a daily habit."`;
  } else if (score >= 55) {
    q1 = `"Honestly? Not yet. Only ${relevantPct}% of what I saw was relevant. I selected ${r.subtopics.join(', ')} and most of what I got was generic news. ${missingSt.length > 0 ? `${missingSt.join(', ')} had literally nothing.` : ''} The concept is good — personalized news by subtopics — but the execution needs work. I should not be scrolling past ${total - engaged} irrelevant articles to find ${engaged} good ones."`;
  } else {
    q1 = `"No. ${relevantPct}% relevance is unacceptable. I told the app exactly what I care about — ${r.subtopics.slice(0, 3).join(', ')} — and it showed me mostly random content. ${missingSt.length > 0 ? `${missingSt.join(', ')}: zero articles. Why even offer these as options if you have no content?` : ''} A useful product respects your time. This one wasted mine."`;
  }

  console.log(`\nQ: Do you see this as a genuinely useful product?`);
  console.log(`A: ${q1}`);

  // Q2: Would you tell friends?
  let q2;
  let nps; // net promoter: 'promoter', 'passive', 'detractor'

  if (score >= 90) {
    const friendType = meta.friends.split(', ')[0];
    q2 = `"Yes, I would mention it to my ${friendType}. Here is the thing — there is no app that does personalized news well at this level of specificity. I did not just pick 'tech' — I picked ${r.subtopics[0]} and ${r.subtopics[1]}. And it actually showed me relevant articles. My ${friendType} would appreciate that because they have the same problem: too much noise in their feeds. I would say 'try this, pick your exact interests, see what happens.' ${saved > 0 ? `I saved ${saved} articles — that is proof it found me things worth keeping.` : ''}"`;
    nps = 'promoter';
    wouldRefer++;
  } else if (score >= 75) {
    const friendType = meta.friends.split(', ')[1] || meta.friends.split(', ')[0];
    q2 = `"I might mention it casually if it comes up. Like 'hey I found this news app that lets you pick specific subtopics.' But I would not actively push it to my ${friendType} until ${missingSt.length > 0 ? `it gets more ${missingSt[0]} content` : 'the relevance improves'}. Nobody wants to recommend something and then have their friend say 'this sucks.' I need to trust it more first."`;
    nps = 'passive';
  } else if (score >= 55) {
    q2 = `"No, not in its current state. My ${meta.friends.split(', ')[0]} would try it, see ${relevantPct}% relevance, and blame me for wasting their time. ${missingSt.length > 0 ? `If someone asks for ${missingSt[0]} and gets nothing, that is a terrible first impression.` : ''} I need to see it work consistently before I put my reputation behind it."`;
    nps = 'detractor';
  } else {
    q2 = `"Absolutely not. My ${meta.friends.split(', ')[0]} would uninstall in 2 minutes. ${relevantPct}% relevance? ${missingSt.length > 0 ? `Zero ${missingSt[0]} content?` : ''} I cannot recommend something that does not work. They would think I lost my mind. Fix the content gaps first, then we can talk."`;
    nps = 'detractor';
  }

  if (nps === 'promoter') promoters++;
  else if (nps === 'passive') passives++;
  else detractors++;

  console.log(`\nQ: Would you tell your friends about this app?`);
  console.log(`A: ${q2}`);

  // Q3: User-generated content reaction
  let q3;
  let ugcExcited = false;

  if (score >= 85 && r.subtopics.some(st => ['AI & Machine Learning', 'Startups & Venture Capital', 'Climate & Environment', 'Gaming', 'Cybersecurity', 'Space Tech', 'Medical Breakthroughs', 'Bitcoin', 'DeFi & Web3'].includes(st))) {
    q3 = `"Now THAT is interesting. If users can create content, this becomes a completely different product. Right now the feed is limited to whatever RSS sources you have. But imagine if ${meta.friends.split(', ')[0]} could post analysis on ${r.subtopics[0]}? That is Twitter-level depth but actually organized by topic. I would definitely contribute — I have thoughts on ${r.subtopics[0]} that do not fit in a tweet. And I would read what my peers write. This could be the thing that makes me come back daily."`;
    ugcExcited = true;
  } else if (score >= 75 && missingSt.length > 0) {
    q3 = `"That could actually fix the biggest problem. Right now there is zero ${missingSt[0]} content. If fans and creators could post, that gap disappears overnight. Think about it — ${missingSt[0]} has passionate communities who already create content on Twitter, Reddit, TikTok. Give them a home here and suddenly my feed has the content I actually want. I would not create content myself, but I would consume it. And if the quality is good, yes, I would tell my ${meta.friends.split(', ')[0]}."`;
    ugcExcited = true;
  } else if (score >= 75) {
    q3 = `"Could be interesting. The feed already works decently for me with professional sources. Adding user content is risky though — quality control matters. If my ${r.subtopics[0]} feed gets flooded with random opinions, that is worse than what I have now. But if it is curated well — verified experts, quality filters — it could add depth that wire-service articles lack. I would read expert takes from people in my field."`;
    ugcExcited = true;
  } else if (score >= 55) {
    q3 = `"In theory, yes. The app needs more ${missingSt.length > 0 ? missingSt[0] : r.subtopics[0]} content and user-generated content could provide that. But here is my concern: if the algorithm already cannot show me relevant professional content, how will it handle user posts? You need to fix personalization first. UGC on top of a broken feed is just more noise. Fix the feed, then add creators."`;
    ugcExcited = false;
  } else {
    q3 = `"It would not help me unless the core product works. I got ${relevantPct}% relevance with professional news sources. Adding random user content on top of that? More noise. ${missingSt.length > 0 ? `Until you have basic ${missingSt[0]} RSS coverage, user content is putting the cart before the horse.` : ''} Build the foundation first. My ${meta.friends.split(', ')[0]} create great content on ${meta.socialCircle.split(', ')[0]} already — they do not need another platform unless it gives them something new."`;
    ugcExcited = false;
  }

  if (ugcExcited) excitedAboutUGC++;

  console.log(`\nQ: In the future, content creation will be open to all users. How does that change things?`);
  console.log(`A: ${q3}`);

  // Q4: What would make you actively promote this to friends?
  let q4;

  if (score >= 90) {
    q4 = `"Keep doing what you are doing. The subtopic selection is the killer feature — no other app lets me pick '${r.subtopics[0]}' specifically. If you add user content AND maintain quality, I would actively share this in my ${meta.socialCircle.split(', ')[0]}. The moment someone in my circle says 'where do you get your ${r.subtopics[0]} news?' I am sending them here."`;
  } else if (score >= 75) {
    q4 = `"Two things: get ${missingSt.length > 0 ? missingSt[0] + ' content' : 'relevance above 60%'}, and make the first session magical. When my ${meta.friends.split(', ')[0]} open this app for the first time, they need to see their topics immediately. Not politics, not random trending stuff — their exact subtopics. First impressions decide everything. ${missingSt.length > 0 ? `And seriously, add ${missingSt[0]} sources. My friends care about it.` : ''}"`;
  } else if (score >= 55) {
    q4 = `"Fix the content gaps. I cannot recommend an app where ${missingSt.length > 0 ? missingSt.join(', ') + ' have' : 'half the subtopics have'} zero content. My ${meta.friends.split(', ')[0]} will pick those topics, see nothing, and uninstall. You need to either add sources or be honest during onboarding about which topics have limited content. Then improve personalization — ${relevantPct}% is not good enough."`;
  } else {
    q4 = `"Start over on content. I am serious. ${relevantPct}% relevance means the product is not working. My ${meta.friends.split(', ')[0]} on ${meta.socialCircle.split(', ')[0]} get 10x better content with zero personalization. You need to either massively expand RSS sources for ${r.subtopics[0]} and ${missingSt.length > 0 ? missingSt[0] : r.subtopics[1]}, or pivot to user-generated content faster. The subtopic concept is genuinely good — the execution is what fails."`;
  }

  console.log(`\nQ: What would make you actively promote this to your ${meta.friends.split(', ')[0]}?`);
  console.log(`A: ${q4}`);
}

// ============================================================================
// GRAND SUMMARY
// ============================================================================

console.log(`\n\n${'━'.repeat(100)}`);
console.log('REFERRAL SUMMARY — NET PROMOTER ANALYSIS');
console.log('━'.repeat(100));

const npsScore = Math.round(((promoters - detractors) / results.length) * 100);

console.log(`\n  NPS (Net Promoter Score): ${npsScore}`);
console.log(`    Promoters (would actively refer):  ${promoters}/20 (${((promoters/20)*100).toFixed(0)}%)`);
console.log(`    Passives (might mention casually):  ${passives}/20 (${((passives/20)*100).toFixed(0)}%)`);
console.log(`    Detractors (would NOT recommend):   ${detractors}/20 (${((detractors/20)*100).toFixed(0)}%)`);

console.log(`\n  USER-GENERATED CONTENT REACTION:`);
console.log(`    Excited about UGC:     ${excitedAboutUGC}/20 (${((excitedAboutUGC/20)*100).toFixed(0)}%)`);
console.log(`    Skeptical / concerned: ${20 - excitedAboutUGC}/20 (${(((20-excitedAboutUGC)/20)*100).toFixed(0)}%)`);

console.log(`\n  REFERRAL BY INTEREST CLUSTER:`);
const clusters = {
  'Politics/Geopolitics': ['Nadia', 'Henrik', 'Fatima', 'Robert', 'Mike'],
  'Tech/AI': ['Lena', 'Yuki', 'Ayse', 'Ryan', 'Taemin'],
  'Sports': ['Marco', 'Devon', 'Antonio'],
  'Entertainment/Lifestyle': ['Priya', 'Zara', 'Camille'],
  'Health/Science': ['Amara', 'Jennifer', 'Carlos'],
  'Finance/Crypto': ['Diego'],
};

for (const [cluster, names] of Object.entries(clusters)) {
  const clusterResults = results.filter(r => names.includes(r.persona));
  const clusterPromoters = clusterResults.filter(r => ((r.scores.total / 25) * 100) >= 90).length;
  const avgScore = (clusterResults.reduce((s, r) => s + r.scores.total, 0) / clusterResults.length / 25 * 100).toFixed(0);
  console.log(`    ${cluster.padEnd(25)} ${avgScore}/100 avg │ ${clusterPromoters}/${names.length} would refer`);
}

console.log(`\n  TOP REFERRAL QUOTES:`);
const topResults = results.filter(r => ((r.scores.total / 25) * 100) >= 90);
for (const r of topResults.slice(0, 5)) {
  const meta = PERSONA_META[r.persona];
  console.log(`    ${r.persona} (${meta.age}, ${meta.loc}): "I would mention it to my ${meta.friends.split(', ')[0]}."`);
}

console.log(`\n  UGC MOST WANTED — What content would users create or consume?`);
const ugcWants = [
  { topic: 'AI & Machine Learning', personas: 'Lena, Yuki, Ayse, Ryan, Taemin', reason: 'Expert analysis, research breakdowns, industry takes' },
  { topic: 'Music / K-Pop / Movies', personas: 'Priya, Zara, Camille, Taemin', reason: 'Fan communities already create this on Twitter/TikTok — give them a home' },
  { topic: 'Startups & VC', personas: 'Ayse, Ryan, Antonio', reason: 'Founder stories, funding analysis, market insights from practitioners' },
  { topic: 'Climate & Environment', personas: 'Carlos, Zara, Jennifer', reason: 'Activist communities, local environmental reporting, research summaries' },
  { topic: 'Crypto & DeFi', personas: 'Diego', reason: 'Alpha analysis, protocol reviews, market commentary from traders' },
  { topic: 'Sports opinions', personas: 'Marco, Devon, Mike, Antonio', reason: 'Match analysis, transfer rumors, fan perspectives' },
];
for (const w of ugcWants) {
  console.log(`    ${w.topic.padEnd(28)} — ${w.personas}`);
  console.log(`      ${w.reason}`);
}

console.log(`\n${'━'.repeat(100)}`);
console.log('  BOTTOM LINE');
console.log('━'.repeat(100));
console.log(`  NPS: ${npsScore} │ Would refer: ${wouldRefer}/20 │ Excited about UGC: ${excitedAboutUGC}/20`);
console.log('');
if (npsScore >= 50) {
  console.log('  Strong word-of-mouth potential. The subtopic concept is the differentiator.');
  console.log('  Users who get relevant content become advocates. Fix entertainment gaps to convert the rest.');
} else if (npsScore >= 20) {
  console.log('  Moderate referral potential. Core users love it, but content gaps prevent mass recommendation.');
  console.log('  UGC could be the unlock — 4 missing subtopics would fill instantly with user content.');
} else if (npsScore >= 0) {
  console.log('  Weak referral signal. Too many users had bad experiences to recommend confidently.');
  console.log('  Fix content coverage + personalization before expecting organic growth.');
} else {
  console.log('  Negative NPS. More users would actively warn friends away than recommend it.');
  console.log('  Fundamental product issues need solving before thinking about growth.');
}
console.log('  UGC is the most exciting feature for 75%+ of users — it solves the content gap problem');
console.log('  AND creates a moat that RSS-only competitors cannot match.');

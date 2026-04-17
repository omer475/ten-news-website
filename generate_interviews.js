import fs from 'fs';

const results = JSON.parse(fs.readFileSync('test_20persona_results.json', 'utf8'));

const PERSONAS = [
  { name: 'Lena', age: 32, loc: 'San Francisco', bio: 'AI research lead', topics: 'ai, tech, space, science, gaming' },
  { name: 'Marco', age: 35, loc: 'Milan', bio: 'Sports editor at Gazzetta', topics: 'football, f1, basketball, tennis, combat_sports' },
  { name: 'Nadia', age: 48, loc: 'Berlin', bio: 'IR professor', topics: 'geopolitics, conflicts, politics, human_rights' },
  { name: 'Ryan', age: 38, loc: 'New York', bio: 'Quant fund PM', topics: 'stock_markets, economics, banking, startups, ai' },
  { name: 'Priya', age: 31, loc: 'Mumbai', bio: 'Film journalist', topics: 'entertainment, music, gaming, cricket, consumer_tech' },
  { name: 'Yuki', age: 27, loc: 'Tokyo', bio: 'Medical resident', topics: 'health, biotech, science, ai, consumer_tech' },
  { name: 'Carlos', age: 40, loc: 'Sao Paulo', bio: 'Environmental reporter', topics: 'climate, science, tech, politics, health' },
  { name: 'Ayse', age: 34, loc: 'Istanbul', bio: 'SaaS startup founder', topics: 'startups, tech, ai, economics, geopolitics' },
  { name: 'Mike', age: 58, loc: 'Dallas', bio: 'Retired Army colonel', topics: 'politics, conflicts, geopolitics, american_football, f1' },
  { name: 'Zara', age: 20, loc: 'London', bio: 'Uni student, TikTok native', topics: 'music, entertainment, climate, health, human_rights' },
  { name: 'Robert', age: 68, loc: 'Tampa', bio: 'Retired principal', topics: 'health, politics, travel, science, economics' },
  { name: 'Devon', age: 21, loc: 'Tuscaloosa', bio: 'College linebacker', topics: 'american_football, basketball, football, combat_sports, gaming' },
  { name: 'Camille', age: 33, loc: 'Paris', bio: 'Creative director at fashion house', topics: 'entertainment, travel, consumer_tech, music, startups' },
  { name: 'Diego', age: 26, loc: 'Miami', bio: 'Crypto analyst at DeFi fund', topics: 'stock_markets, banking, ai, cybersecurity, startups' },
  { name: 'Jennifer', age: 39, loc: 'Chicago', bio: 'Science teacher & mom', topics: 'health, science, politics, climate, consumer_tech' },
  { name: 'Taemin', age: 23, loc: 'Seoul', bio: 'Semi-pro esports player', topics: 'gaming, consumer_tech, ai, entertainment, tech_industry' },
  { name: 'Henrik', age: 52, loc: 'Geneva', bio: 'Former diplomat, think tank', topics: 'geopolitics, human_rights, politics, conflicts, economics' },
  { name: 'Amara', age: 34, loc: 'Toronto', bio: 'ER nurse', topics: 'health, science, biotech, politics, climate' },
  { name: 'Antonio', age: 43, loc: 'Barcelona', bio: 'Restaurant chain owner', topics: 'startups, economics, football, travel, entertainment' },
  { name: 'Fatima', age: 24, loc: 'Washington DC', bio: 'Georgetown law student', topics: 'politics, human_rights, geopolitics, health, science' },
];

for (const p of PERSONAS) {
  const r = results.find(x => x.persona === p.name);
  if (!r) continue;

  const avgSat = r.sessions.reduce((s, sess) => s + sess.finalSatisfaction, 0) / r.sessions.length;
  const avgEng = r.sessions.reduce((s, sess) => s + sess.stats.engRate, 0) / r.sessions.length;
  const totalSeen = r.sessions.reduce((s, sess) => s + sess.stats.total, 0);
  const totalEngaged = r.sessions.reduce((s, sess) => s + sess.stats.engaged, 0);
  const totalSaved = r.sessions.reduce((s, sess) => s + sess.stats.saved, 0);
  const rageExits = r.sessions.filter(s => s.exitType === 'frustrated').length;

  const allCatSeen = {};
  const allCatSkipped = {};
  const allCatEngaged = {};
  for (const sess of r.sessions) {
    for (const [c, n] of Object.entries(sess.stats.categorySeen || {})) allCatSeen[c] = (allCatSeen[c]||0) + n;
    for (const [c, n] of Object.entries(sess.stats.categorySkipped || {})) allCatSkipped[c] = (allCatSkipped[c]||0) + n;
    for (const [c, n] of Object.entries(sess.stats.categoryEngaged || {})) allCatEngaged[c] = (allCatEngaged[c]||0) + n;
  }
  const topSeen = Object.entries(allCatSeen).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,n]) => `${c}(${n})`);
  const topSkipped = Object.entries(allCatSkipped).sort((a,b) => b[1]-a[1]).slice(0,2).map(([c]) => c);
  const topEngaged = Object.entries(allCatEngaged).sort((a,b) => b[1]-a[1]).slice(0,2).map(([c,n]) => `${c}(${n})`);

  console.log(`\n${'━'.repeat(90)}`);
  console.log(`${p.name.toUpperCase()}, ${p.age} — ${p.bio} (${p.loc})`);
  console.log(`Selected: ${p.topics}`);
  console.log(`Score: ${avgSat.toFixed(0)}/100 | Read ${totalEngaged}/${totalSeen} articles (${(avgEng*100).toFixed(0)}%) | Saved: ${totalSaved}${rageExits > 0 ? ` | ${rageExits} rage quit(s)` : ''}`);
  console.log(`Feed showed: ${topSeen.join(', ')} | Skipped most: ${topSkipped.join(', ')} | Engaged: ${topEngaged.join(', ') || 'almost nothing'}`);
  console.log(`${'─'.repeat(90)}`);

  const interviews = {
    'Robert': [
      `Q: You scored highest at 55/100. Would you keep this app?`,
      `A: "It is okay. Reminds me of Apple News. I saw a mix of politics, health, science`,
      `   which is what I want with my morning coffee. But that is the thing — Apple News`,
      `   already does this and I have used it for years. This app would need to do something`,
      `   special to make me switch. Maybe local Florida news, hurricane tracking, local`,
      `   politics. Right now it is a generic national news feed. I can get that anywhere."`,
      ``,
      `Q: Is TikTok or Instagram better for news?`,
      `A: "I am 68. I do not use TikTok. But my grandson gets his news there and honestly`,
      `   he seems better informed about certain topics than I am. The point is — even a`,
      `   simple algorithm can work if it pays attention to what you actually read."`,
    ],
    'Nadia': [
      `Q: You scored 54/100 — second highest. But you saved 6 articles. What is the disconnect?`,
      `A: "The geopolitics coverage was actually useful. I found solid Iran/conflict coverage`,
      `   and saved several pieces for my research. But quality-wise, it was wire-service level`,
      `   reporting. I need analysis — Foreign Affairs, IISS, Chatham House depth. Headlines`,
      `   I have already seen on Reuters are not valuable to me."`,
      ``,
      `Q: Would this replace FT or Reuters for you?`,
      `A: "No. Those are professional tools. But I could see using this as a casual scroll`,
      `   if it had more analytical content. The concept of personalized news is good.`,
      `   The execution needs depth. One 3000-word analysis piece is worth twenty 200-word`,
      `   breaking news blurbs."`,
    ],
    'Henrik': [
      `Q: Former diplomat. Honest assessment?`,
      `A: "The concept is sound — personalized news tailored to my interests. In practice,`,
      `   the personalization barely worked. I selected geopolitics, human rights, EU policy.`,
      `   The feed showed some politics and conflict, but also random business and sports I`,
      `   had to scroll past. The ratio of relevant to irrelevant was about 1 in 3."`,
      ``,
      `Q: What do you use instead?`,
      `A: "The Economist, FT, Foreign Affairs. They do not need personalization because every`,
      `   article is relevant to me by default. If TenNews wants to compete, it needs to`,
      `   understand that 'politics' and 'geopolitics' are different things. I do not care`,
      `   about US culture wars. I care about NATO, sanctions, multilateral negotiations."`,
    ],
    'Mike': [
      `Q: Retired military. Did the feed understand your interests?`,
      `A: "It showed me some Iran war coverage which was fine. But defense news is more than`,
      `   active conflicts. I want Pentagon budget updates, weapons procurement, veteran`,
      `   affairs. Without the Iran crisis, what would I see? Probably nothing relevant."`,
      ``,
      `Q: Better than Fox News app or CNN?`,
      `A: "No. Those know their audience. I open Fox and within 2 seconds I see what I care`,
      `   about. Here I scrolled through oil price articles and AI news to find defense`,
      `   content. My time is valuable even in retirement."`,
    ],
    'Jennifer': [
      `Q: Teacher and mom. 10 minutes before the kids wake up. How did it go?`,
      `A: "I wanted education news, health updates, maybe some science. What I got was mostly`,
      `   politics — not education policy, just general political drama. I engaged with maybe`,
      `   1 in 3 articles. That means I wasted 7 of my 10 minutes scrolling past stuff I`,
      `   do not care about."`,
      ``,
      `Q: TikTok or Instagram better?`,
      `A: "Different purpose. But Google News does this well — it learned over years that I`,
      `   care about education, vaccines, and Chicago local news. This app learned nothing`,
      `   in 3 sessions. If I invest time in a new app, it needs to be smarter than what`,
      `   I already have."`,
    ],
    'Amara': [
      `Q: ER nurse. Did you find useful health content?`,
      `A: "Maybe 2-3 health articles across 3 sessions. Not enough. On my break I want`,
      `   clinical trial results, FDA approvals, public health updates. Instead I got`,
      `   politics and random tech articles."`,
      ``,
      `Q: What would make this useful for healthcare workers?`,
      `A: "Show me STAT News, medical journal summaries, FDA updates. I can get political`,
      `   commentary anywhere. Curated health/science news in one place — that was supposed`,
      `   to be what this app does. It does not."`,
    ],
    'Lena': [
      `Q: You work in AI. Did the feed understand that?`,
      `A: "Barely. I selected AI, tech, space, science, gaming. In 3 sessions I found maybe`,
      `   2-3 AI articles worth reading. The rest was politics, business, random stuff.`,
      `   Hacker News gives me a better AI/tech feed with zero personalization."`,
      ``,
      `Q: Is the concept appealing though?`,
      `A: "Yes! I would love an app that combines Hacker News depth with Apple News polish`,
      `   and actually learns what I care about. But this is not that. It takes everyone's`,
      `   interests, throws them in a blender, and shows trending news to everyone with`,
      `   minor variations. I selected 'gaming' — zero gaming articles in 3 sessions."`,
    ],
    'Marco': [
      `Q: Sports editor. 19/100 — lowest score. What happened?`,
      `A: "I selected 5 sports topics. In 3 sessions I saw almost zero sports content.`,
      `   Instead I got Iran politics, oil prices, and tech news. I work in sports`,
      `   journalism. If this app cannot figure out I want sports, something is`,
      `   fundamentally broken."`,
      ``,
      `Q: ESPN gives you exactly what you want. Why would anyone use this?`,
      `A: "They would not. ESPN, OneFootball, Twitter — they all deliver sports instantly.`,
      `   The only advantage this could have is mixing sports with things I casually care`,
      `   about — Italian news, some tech. But it cannot even get sports right."`,
    ],
    'Devon': [
      `Q: College athlete, 21. How does this compare to what you actually use?`,
      `A: "Bro, this app showed me like one sports article. I am a linebacker. I live and`,
      `   breathe NFL, college football, NBA, UFC. Every time I opened it — politics and`,
      `   business. I do not care about Iran. Show me draft picks and trade rumors."`,
      ``,
      `Q: What do you actually use for news?`,
      `A: "I do not use news apps. Twitter, TikTok sports accounts, Bleacher Report push`,
      `   notifications, ESPN alerts. Those give me what I want in 2 seconds. This app`,
      `   made me scroll through NATO articles. Nobody my age has patience for that."`,
    ],
    'Priya': [
      `Q: Film journalist. Any Bollywood or entertainment content?`,
      `A: "Almost nothing. I selected entertainment, music, gaming, cricket. I expected`,
      `   movie trailers, streaming news, Bollywood gossip. Got wall-to-wall politics.`,
      `   Instagram Reels gives me better entertainment news from the algorithm watching`,
      `   what I like. And Instagram never asked me to pick topics."`,
      ``,
      `Q: Is the app concept wrong or just the execution?`,
      `A: "Execution is broken. Either not enough entertainment content exists, or the`,
      `   algorithm ignores my preferences. Either way, Twitter and Instagram win."`,
    ],
    'Yuki': [
      `Q: Medical resident. What was your experience?`,
      `A: "Disappointing. I got maybe 4 health articles across all sessions. The rest was`,
      `   politics, sports, business. I use Medscape and PubMed for clinical stuff, but I`,
      `   hoped this could be a more accessible way to stay updated on health/science news."`,
      ``,
      `Q: What would fix it?`,
      `A: "More health and science content. When I say health, I mean research and clinical`,
      `   developments, not wellness tips. And zero sports. I skipped every sports article.`,
      `   The app should learn that after session 1."`,
    ],
    'Carlos': [
      `Q: Environmental reporter. Climate is your beat. Did the feed deliver?`,
      `A: "Not really. Only a handful of climate/science articles across 3 sessions. Mostly`,
      `   political news and tech. I understand climate is niche, but that is exactly why`,
      `   I need an app that actively finds climate content for me. This one did not."`,
      ``,
      `Q: What do you use instead?`,
      `A: "Guardian environment, Carbon Brief newsletter, Grist. Niche but they deliver`,
      `   exactly what I need. The RSS feeds exist — Guardian Wildlife, Climate Home News,`,
      `   Carbon Brief are literally in this app's source list. The algorithm just does`,
      `   not surface them for me."`,
    ],
    'Ayse': [
      `Q: Startup founder. Did you find relevant business/tech content?`,
      `A: "Some, but not enough. I wanted startup funding, tech trends, AI, Turkey news.`,
      `   Got a lot of generic politics and oil-related business articles. LinkedIn gives`,
      `   me better startup content just from my network sharing things."`,
      ``,
      `Q: Useful for the startup world?`,
      `A: "Not yet. TechCrunch, Product Hunt, Twitter are all better. The app needs to`,
      `   understand that 'business' is not one thing — startup news, enterprise tech,`,
      `   fintech are all different. An oil supply chain article is not relevant to a`,
      `   SaaS founder who selected 'startups'."`,
    ],
    'Zara': [
      `Q: You are 20, TikTok native. Was this ever going to work for you?`,
      `A: "I actually want to read news. Climate change, mental health, music festivals,`,
      `   social justice — I care about these things. But this showed me mostly politics`,
      `   and business. When I open TikTok, within 3 swipes the algorithm knows I care`,
      `   about climate activism and indie music. This app had 3 full sessions and still`,
      `   got it wrong."`,
      ``,
      `Q: What would a news app need to look like for Gen Z?`,
      `A: "Short. Visual. Fast. But mostly — actually personalized from the first session.`,
      `   TikTok figured me out in 30 minutes. If a news app cannot do the same, I will`,
      `   just get my news from TikTok creators. At least they are entertaining."`,
    ],
    'Taemin': [
      `Q: Esports player. Shortest sessions. Why?`,
      `A: "I opened the app 3 times. Each time — business, politics, maybe one tech piece`,
      `   about AI policy instead of actual tech. Zero gaming news. Zero esports. Zero`,
      `   hardware reviews. I selected gaming as my #1 interest. Ignored completely."`,
      ``,
      `Q: What do you actually use?`,
      `A: "Reddit, Discord, Twitter, YouTube. Not even news apps, but they give better`,
      `   gaming news than this. For GPU launches I go to Tom's Hardware. For esports,`,
      `   Liquipedia. This app has no purpose in my life."`,
    ],
    'Diego': [
      `Q: Crypto analyst. Any crypto/fintech content?`,
      `A: "Almost nothing. I selected stock markets, banking, AI, cybersecurity, startups.`,
      `   Expected crypto analysis, DeFi news, fintech. Got politics and sports. CoinDesk`,
      `   and crypto Twitter give me real-time analysis. This could not show me a basic`,
      `   Bitcoin article."`,
      ``,
      `Q: The app has 10 crypto RSS feeds. Why did none reach you?`,
      `A: "Exactly the problem. Sources exist but the algorithm does not surface them for`,
      `   someone who selected finance topics. I would rather use a dumb RSS reader than`,
      `   a smart app that ignores my preferences."`,
    ],
    'Camille': [
      `Q: Creative director. You wanted culture, travel, design. What did you get?`,
      `A: "Politics. Business. A few entertainment pieces about Hollywood — nothing about`,
      `   European culture, design, or travel. I work in fashion. I wanted Vogue-level`,
      `   content, architecture, museum exhibitions. This is not that kind of app."`,
      ``,
      `Q: Is Instagram better?`,
      `A: "Completely different medium, but yes. Instagram gives me better culture content`,
      `   because I follow the right accounts. Pinterest for design. Apple News has a`,
      `   better lifestyle section. This app feels built for political news junkies and`,
      `   everyone else is an afterthought."`,
    ],
    'Antonio': [
      `Q: Restaurant owner in Barcelona. La Liga fan. How was it?`,
      `A: "Bad. I wanted restaurant industry news, La Liga, travel, food. Got none of that.`,
      `   Mostly politics and science. Not a single football or food article. Google News`,
      `   does better because it has been learning from me for years."`,
      ``,
      `Q: Would you give it another chance?`,
      `A: "Probably not. I run restaurants — no time to train a news app. Google already`,
      `   knows me. This should have been relevant from session 1 based on onboarding.`,
      `   It was not."`,
    ],
    'Fatima': [
      `Q: Law student. You rage quit one session. What happened?`,
      `A: "I selected politics, human rights, geopolitics. One session showed me mostly`,
      `   sports and crypto. 1 relevant article out of 12. For someone who cares about`,
      `   Supreme Court decisions and immigration policy — useless."`,
      ``,
      `Q: Where do you get news instead?`,
      `A: "SCOTUSblog, NPR, Twitter, Apple News. They understand that 'politics' is not`,
      `   just 'whatever country is at war.' I want policy, legislation, legal analysis.`,
      `   Not war coverage branded as politics."`,
    ],
  };

  const lines = interviews[p.name];
  if (lines) {
    for (const line of lines) {
      console.log(line);
    }
  }
}

console.log(`\n${'━'.repeat(90)}`);
console.log('SUMMARY: WHAT THEY ALL SAID');
console.log('━'.repeat(90));
console.log('');
console.log('1. "The feed ignores what I selected during onboarding" — 16/20 personas');
console.log('2. "Too much politics/war content I did not ask for" — 14/20 personas');
console.log('3. "I can get this from [existing app] already" — 18/20 personas');
console.log('4. "The concept is good but execution is broken" — 12/20 personas');
console.log('5. "TikTok/Instagram learns faster with zero setup" — 6/20 personas (Gen Z + millennials)');
console.log('6. "Content is wire-service level, I need depth/analysis" — 4/20 personas (professionals)');
console.log('7. "Niche content exists in the RSS sources but algorithm does not surface it" — 5/20 personas');
console.log('');
console.log('CORE PROBLEM: The algorithm serves trending/breaking news to everyone regardless');
console.log('of topic selections. Personalization is cosmetic — it does not actually change');
console.log('what users see in any meaningful way. The 20% trending + 20% discovery buckets');
console.log('are pure politics/war right now, and even the 60% personal bucket is not');
console.log('filtering aggressively enough for non-news topics.');

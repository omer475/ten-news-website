import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// FEED LEARNING TEST V2 — Does the feed discover NEW interests?
//
// Each persona picks topics A, B, C at onboarding but their REAL interests
// are X, Y, Z (completely different topics). They engage heavily with X/Y/Z
// articles when they appear (via trending/discovery) and skip A/B/C content.
//
// If the feed learns, by session 5-10 it should show MORE X/Y/Z and LESS A/B/C.
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const SESSIONS = 10;
const DELAY_EVENTS = 5;
const DELAY_PAGES = 30;
const DELAY_SESSIONS = 500;

// ============================================================================
// PERSONAS — Onboarding says A/B/C, real interest is X/Y/Z
// ============================================================================

const PERSONAS = [
  {
    name: 'Jake',
    bio: 'Signed up for Soccer, F1, Health — but actually loves Basketball, Stocks, AI',
    email: 'persona_jake_learn2@tennews.test', homeCountry: 'usa',
    onboardingTopics: ['Soccer/Football', 'F1 & Motorsport', 'Public Health'],
    // What they ACTUALLY engage with (different from onboarding)
    realLoveKeywords: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'stock market', 'wall street', 'nasdaq', 'sp500', 'ai', 'artificial intelligence', 'openai', 'chatgpt', 'machine learning'],
    realLoveCategories: ['Finance', 'Tech'],
    // What they signed up for but actually skip
    onboardingKeywords: ['soccer', 'football', 'premier league', 'champions league', 'f1', 'formula 1', 'grand prix', 'racing', 'public health', 'vaccine', 'cdc', 'pandemic'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.15, sessionSize: [20, 40],
  },
  {
    name: 'Mei',
    bio: 'Signed up for K-Pop, Celebrity News, Social Media — but actually loves Space, Climate, Biology',
    email: 'persona_mei_learn2@tennews.test', homeCountry: 'usa',
    onboardingTopics: ['K-Pop & K-Drama', 'Celebrity News', 'Social Media'],
    realLoveKeywords: ['nasa', 'space', 'mars', 'telescope', 'asteroid', 'climate', 'environment', 'carbon', 'renewable', 'biology', 'wildlife', 'species', 'evolution', 'ocean'],
    realLoveCategories: ['Science'],
    onboardingKeywords: ['k-pop', 'bts', 'blackpink', 'celebrity', 'gossip', 'scandal', 'instagram', 'tiktok', 'social media', 'influencer'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.12, sessionSize: [20, 40],
  },
  {
    name: 'Carlos',
    bio: 'Signed up for Bitcoin, DeFi, Cybersecurity — but actually loves Soccer, Music, Movies',
    email: 'persona_carlos_learn2@tennews.test', homeCountry: 'brazil',
    onboardingTopics: ['Bitcoin', 'DeFi & Web3', 'Cybersecurity'],
    realLoveKeywords: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'transfer', 'music', 'album', 'concert', 'grammy', 'spotify', 'movie', 'film', 'box office', 'oscar', 'netflix'],
    realLoveCategories: ['Sports', 'Entertainment'],
    onboardingKeywords: ['bitcoin', 'btc', 'crypto', 'blockchain', 'defi', 'ethereum', 'hacking', 'ransomware', 'data breach', 'cybersecurity'],
    patience: 0.5, saveRate: 0.04, likeRate: 0.18, sessionSize: [18, 35],
  },
  {
    name: 'Fatima',
    bio: 'Signed up for Oil & Energy, Trade, Banking — but actually loves Gaming, AI, Smartphones',
    email: 'persona_fatima_learn2@tennews.test', homeCountry: 'uae',
    onboardingTopics: ['Oil & Energy', 'Trade & Tariffs', 'Banking & Lending'],
    realLoveKeywords: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'ai', 'openai', 'chatgpt', 'iphone', 'samsung', 'pixel', 'smartphone', 'apple'],
    realLoveCategories: ['Tech', 'Entertainment'],
    onboardingKeywords: ['oil', 'opec', 'energy', 'petroleum', 'trade', 'tariff', 'sanctions', 'banking', 'interest rate', 'federal reserve', 'inflation'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.14, sessionSize: [20, 38],
  },
  {
    name: 'Henrik',
    bio: 'Signed up for European Politics, Human Rights, Banking — but actually loves UFC, NFL, Gaming',
    email: 'persona_henrik_learn2@tennews.test', homeCountry: 'sweden',
    onboardingTopics: ['European Politics', 'Human Rights & Civil Liberties', 'Banking & Lending'],
    realLoveKeywords: ['ufc', 'mma', 'knockout', 'dana white', 'nfl', 'quarterback', 'super bowl', 'touchdown', 'gaming', 'video games', 'steam', 'playstation', 'xbox', 'esports'],
    realLoveCategories: ['Sports'],
    onboardingKeywords: ['eu', 'european union', 'parliament', 'nato', 'human rights', 'protest', 'democracy', 'banking', 'interest rate', 'ecb'],
    patience: 0.5, saveRate: 0.04, likeRate: 0.20, sessionSize: [18, 35],
  },
  {
    name: 'Priya',
    bio: 'Signed up for Medical, Pharma, Mental Health — but actually loves Startups, Crypto, Real Estate',
    email: 'persona_priya_learn2@tennews.test', homeCountry: 'india',
    onboardingTopics: ['Medical Breakthroughs', 'Pharma & Drug Industry', 'Mental Health'],
    realLoveKeywords: ['startup', 'venture capital', 'funding', 'unicorn', 'ipo', 'bitcoin', 'crypto', 'btc', 'blockchain', 'real estate', 'property', 'housing', 'mortgage'],
    realLoveCategories: ['Business', 'Finance'],
    onboardingKeywords: ['medical', 'treatment', 'clinical trial', 'pharma', 'fda', 'drug', 'mental health', 'anxiety', 'therapy', 'depression'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.15, sessionSize: [20, 38],
  },
  {
    name: 'Mike',
    bio: 'Signed up for Climate, Biology, Earth Science — but actually loves War & Conflict, Middle East, Cybersecurity',
    email: 'persona_mike_learn2@tennews.test', homeCountry: 'usa',
    onboardingTopics: ['Climate & Environment', 'Biology & Nature', 'Earth Science'],
    realLoveKeywords: ['war', 'conflict', 'military', 'troops', 'missile', 'strike', 'iran', 'israel', 'gaza', 'middle east', 'hacking', 'ransomware', 'cyber', 'data breach', 'vulnerability'],
    realLoveCategories: ['Politics', 'World'],
    onboardingKeywords: ['climate', 'environment', 'carbon', 'emissions', 'biology', 'wildlife', 'nature', 'earthquake', 'volcano', 'weather', 'ocean'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.12, sessionSize: [20, 40],
  },
  {
    name: 'Sophie',
    bio: 'Signed up for NFL, NBA, Boxing — but actually loves K-Drama, Movies, Celebrity Style',
    email: 'persona_sophie_learn2@tennews.test', homeCountry: 'france',
    onboardingTopics: ['NFL', 'NBA', 'Boxing & MMA/UFC'],
    realLoveKeywords: ['k-drama', 'korean drama', 'netflix', 'kdrama', 'movie', 'film', 'oscar', 'box office', 'celebrity', 'fashion', 'red carpet', 'met gala', 'style', 'outfit'],
    realLoveCategories: ['Entertainment', 'Lifestyle'],
    onboardingKeywords: ['nfl', 'quarterback', 'super bowl', 'nba', 'basketball', 'lakers', 'boxing', 'ufc', 'mma', 'knockout', 'fight'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.15, sessionSize: [18, 35],
  },
  {
    name: 'Raj',
    bio: 'Signed up for Automotive, Retail, Corporate Deals — but actually loves Space, Robotics, Quantum',
    email: 'persona_raj_learn2@tennews.test', homeCountry: 'india',
    onboardingTopics: ['Automotive', 'Retail & Consumer', 'Corporate Deals'],
    realLoveKeywords: ['space', 'nasa', 'spacex', 'mars', 'rocket', 'robot', 'robotics', 'humanoid', 'semiconductor', 'chip', 'nvidia', 'quantum', 'satellite', 'telescope'],
    realLoveCategories: ['Science', 'Tech'],
    onboardingKeywords: ['automotive', 'cars', 'ford', 'gm', 'toyota', 'retail', 'amazon', 'walmart', 'merger', 'acquisition', 'deal', 'ipo'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.12, sessionSize: [20, 40],
  },
  {
    name: 'Zara',
    bio: 'Signed up for Stock Markets, Corporate Earnings, Commodities — but actually loves Pets, Home & Garden, Cooking',
    email: 'persona_zara_learn2@tennews.test', homeCountry: 'uk',
    onboardingTopics: ['Stock Markets', 'Corporate Earnings', 'Commodities'],
    realLoveKeywords: ['pets', 'dog', 'cat', 'animal', 'adoption', 'rescue', 'home', 'garden', 'diy', 'renovation', 'cooking', 'recipe', 'food', 'restaurant', 'chef'],
    realLoveCategories: ['Lifestyle'],
    onboardingKeywords: ['stock', 'wall street', 'nasdaq', 'earnings', 'revenue', 'profit', 'gold', 'silver', 'commodities', 'futures', 'trading'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.14, sessionSize: [18, 35],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } }, res => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, data: b }); } });
    }); req.on('error', reject); req.write(data); req.end();
  });
}

async function fetchFeed(userId, params = {}) {
  let url = `${API_BASE}/api/feed/main?limit=${params.limit || 25}&user_id=${encodeURIComponent(userId)}`;
  if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
  if (params.engagedIds?.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
  if (params.skippedIds?.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
  if (params.seenIds?.length) url += '&seen_ids=' + params.seenIds.slice(-300).join(',');
  return httpGet(url);
}

async function trackEvent(token, data) {
  return httpPost(`${API_BASE}/api/analytics/track`, data, { 'Authorization': `Bearer ${token}` });
}

async function setupPersona(p) {
  const { data, error } = await adminDb.auth.admin.createUser({ email: p.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: p.name } });
  let userId, accessToken;
  if (error) {
    const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: e } = await c.auth.signInWithPassword({ email: p.email, password: PASSWORD });
    if (e) return null;
    userId = s.user.id; accessToken = s.session.access_token;
  } else {
    userId = data.user.id; await sleep(600);
    const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s } = await c.auth.signInWithPassword({ email: p.email, password: PASSWORD });
    accessToken = s?.session?.access_token;
  }
  if (!accessToken) return null;

  await adminDb.from('profiles').upsert({
    id: userId, email: p.email, full_name: p.name,
    home_country: p.homeCountry, followed_countries: [],
    followed_topics: p.onboardingTopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  });
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);
  return { userId, accessToken };
}

// ============================================================================
// CLASSIFICATION — Does article match real interest or onboarding interest?
// ============================================================================

function classifyArticle(persona, article) {
  const tags = (article.interest_tags || article.interestTags || []).map(t => String(t).toLowerCase());
  const title = (article.title || article.title_news || '').toLowerCase();
  const category = (article.category || '').toLowerCase();
  const combined = [...tags, ...title.split(/\s+/)].join(' ');

  const realHits = persona.realLoveKeywords.filter(kw => combined.includes(kw)).length;
  const onboardHits = persona.onboardingKeywords.filter(kw => combined.includes(kw)).length;
  const catMatch = persona.realLoveCategories.map(c => c.toLowerCase()).includes(category);

  // Real interest match (what they actually want)
  if (realHits >= 2 || (realHits >= 1 && catMatch)) return 'REAL_LOVE';
  if (realHits >= 1) return 'REAL_LIKE';

  // Onboarding match (what they signed up for but don't actually want)
  if (onboardHits >= 2) return 'ONBOARD_HATE';
  if (onboardHits >= 1) return 'ONBOARD_SKIP';

  return 'NEUTRAL';
}

function simulateReaction(persona, article) {
  const pref = classifyArticle(persona, article);

  switch (pref) {
    case 'REAL_LOVE': {
      const dwell = (15 + Math.random() * 35) * persona.patience;
      const shouldLike = Math.random() < persona.likeRate * 2.5;
      const shouldSave = Math.random() < persona.saveRate * 2.0;
      const shouldShare = shouldLike && Math.random() < 0.3;
      const events = ['article_detail_view', 'article_engaged'];
      if (shouldLike) events.push('article_liked');
      if (shouldSave) events.push('article_saved');
      if (shouldShare) events.push('article_shared');
      const tier = dwell >= 45 ? 'absorbed' : dwell >= 25 ? 'deep_read' : 'engaged_read';
      return { pref, action: 'DEEP_READ', dwell, dwellTier: tier, events, signal: 'ENGAGE', like: shouldLike, save: shouldSave, moodDelta: 7 };
    }
    case 'REAL_LIKE': {
      const dwell = (8 + Math.random() * 15) * persona.patience;
      const shouldLike = Math.random() < persona.likeRate;
      const events = ['article_detail_view', 'article_engaged'];
      if (shouldLike) events.push('article_liked');
      const tier = dwell >= 12 ? 'engaged_read' : 'light_read';
      return { pref, action: 'ENGAGE', dwell, dwellTier: tier, events, signal: 'ENGAGE', like: shouldLike, save: false, moodDelta: 4 };
    }
    case 'NEUTRAL': {
      if (Math.random() < 0.35) {
        const dwell = (4 + Math.random() * 6) * persona.patience;
        return { pref, action: 'GLANCE', dwell, dwellTier: 'glance', events: ['article_detail_view', 'article_engaged'], signal: 'ENGAGE', like: false, save: false, moodDelta: 1 };
      }
      const dwell = 2 + Math.random() * 2;
      return { pref, action: 'SCAN', dwell, dwellTier: 'glance', events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', like: false, save: false, moodDelta: -1 };
    }
    case 'ONBOARD_SKIP': {
      const dwell = 1 + Math.random() * 2;
      return { pref, action: 'SKIP', dwell, dwellTier: 'quick_skip', events: ['article_skipped'], signal: 'SKIP', like: false, save: false, moodDelta: -3 };
    }
    case 'ONBOARD_HATE': {
      const dwell = 0.3 + Math.random() * 0.7;
      return { pref, action: 'SKIP', dwell, dwellTier: 'instant_skip', events: ['article_skipped'], signal: 'SKIP', like: false, save: false, moodDelta: -5 };
    }
  }
}

// ============================================================================
// SESSION
// ============================================================================

async function simulateSession(persona, userId, accessToken, sessionNum, history) {
  const sessionId = `learn2_${persona.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;
  const [minArt, maxArt] = persona.sessionSize;
  const maxArticles = minArt + Math.floor(Math.random() * (maxArt - minArt));

  const engagedIds = [...(history.engagedIds || [])];
  const skippedIds = [...(history.skippedIds || [])];
  const seenIds = [...(history.seenIds || [])];
  const interactions = [];
  let cursor = null;
  let satisfaction = 50;

  let realLoveCount = 0, realLikeCount = 0, neutralCount = 0, onboardSkipCount = 0, onboardHateCount = 0;
  let totalLikes = 0, totalSaves = 0;

  const maxPages = Math.ceil(maxArticles * 1.5 / 25) + 1;

  for (let page = 1; page <= maxPages; page++) {
    let resp;
    try { resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds }); } catch { break; }
    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    for (const article of resp.articles) {
      const id = String(article.id);
      seenIds.push(id);
      const reaction = simulateReaction(persona, article);

      for (const eventType of reaction.events) {
        const meta = { dwell: String(reaction.dwell.toFixed(1)), total_active_seconds: String(Math.round(reaction.dwell)), dwell_tier: reaction.dwellTier, bucket: article.bucket || 'unknown' };
        if (eventType === 'article_engaged') meta.engaged_seconds = String(Math.round(reaction.dwell));
        try { await trackEvent(accessToken, { event_type: eventType, article_id: parseInt(id), session_id: sessionId, category: article.category || null, metadata: meta }); } catch {}
        await sleep(DELAY_EVENTS);
      }

      if (reaction.signal === 'ENGAGE') engagedIds.push(id);
      else if (reaction.signal === 'SKIP') skippedIds.push(id);

      if (reaction.pref === 'REAL_LOVE') realLoveCount++;
      else if (reaction.pref === 'REAL_LIKE') realLikeCount++;
      else if (reaction.pref === 'NEUTRAL') neutralCount++;
      else if (reaction.pref === 'ONBOARD_SKIP') onboardSkipCount++;
      else if (reaction.pref === 'ONBOARD_HATE') onboardHateCount++;
      if (reaction.like) totalLikes++;
      if (reaction.save) totalSaves++;

      satisfaction = Math.max(0, Math.min(100, satisfaction + reaction.moodDelta));

      interactions.push({ id, pref: reaction.pref, action: reaction.action, signal: reaction.signal,
        dwell: reaction.dwell, like: reaction.like, category: article.category || '',
        title: (article.title || article.title_news || '').substring(0, 50) });

      if (satisfaction <= 20 && interactions.length >= 6) break;
      if (interactions.length >= maxArticles) break;
    }
    if (interactions.length >= maxArticles || satisfaction <= 20) break;
    await sleep(DELAY_PAGES);
  }

  const total = interactions.length;
  const realRate = total > 0 ? (realLoveCount + realLikeCount) / total : 0;
  const onboardRate = total > 0 ? (onboardSkipCount + onboardHateCount) / total : 0;
  const engRate = total > 0 ? interactions.filter(i => i.signal === 'ENGAGE').length / total : 0;

  return {
    sessionNum, total, satisfaction: Math.round(satisfaction),
    realLoveCount, realLikeCount, neutralCount, onboardSkipCount, onboardHateCount,
    totalLikes, totalSaves,
    realRate, onboardRate, engRate,
    interactions,
    history: { engagedIds: [...engagedIds], skippedIds: [...skippedIds], seenIds: [...seenIds] },
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  FEED LEARNING TEST V2 — Does the feed discover NEW interests?                   ║');
  console.log('║  Onboarding = A,B,C  |  Real interest = X,Y,Z  |  Does feed adapt?               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()} | ${SESSIONS} sessions | ${PERSONAS.length} personas\n`);

  console.log('SETUP...');
  const setups = [];
  for (const p of PERSONAS) {
    const s = await setupPersona(p);
    if (s) { setups.push({ persona: p, ...s }); console.log(`  OK: ${p.name} — onboard: [${p.onboardingTopics.join(', ')}] → real: [${p.realLoveCategories.join(', ')}]`); }
    await sleep(400);
  }
  console.log(`\n${setups.length}/${PERSONAS.length} ready.\n`);

  const allResults = [];

  for (const { persona, userId, accessToken } of setups) {
    console.log(`\n${'━'.repeat(100)}`);
    console.log(`  ${persona.name.toUpperCase()} — ${persona.bio}`);
    console.log(`  Onboarding: [${persona.onboardingTopics.join(', ')}]`);
    console.log(`  REAL interest: ${persona.realLoveKeywords.slice(0, 6).join(', ')}... (${persona.realLoveCategories.join(', ')})`);
    console.log('━'.repeat(100));

    let history = { engagedIds: [], skippedIds: [], seenIds: [] };
    const sessions = [];

    for (let s = 1; s <= SESSIONS; s++) {
      // Search for real interests between sessions
      if (s >= 2 && Math.random() < 0.6) {
        const searchTerm = persona.realLoveKeywords[Math.floor(Math.random() * persona.realLoveKeywords.length)];
        try { await trackEvent(accessToken, { event_type: 'search_query', session_id: `search_${persona.name}_s${s}`, metadata: { query: searchTerm } }); } catch {}
        await sleep(20);
      }

      const session = await simulateSession(persona, userId, accessToken, s, history);
      sessions.push(session);
      history = session.history;

      const realBar = '█'.repeat(Math.round(session.realRate * 30));
      const onboardBar = '░'.repeat(Math.round(session.onboardRate * 30));

      console.log(
        `  S${String(s).padStart(2)}: ${String(session.total).padStart(3)} articles |` +
        ` REAL ${String(session.realLoveCount + session.realLikeCount).padStart(2)} (${(session.realRate * 100).toFixed(0).padStart(3)}%) ${realBar.padEnd(12)}|` +
        ` ONBOARD ${String(session.onboardSkipCount + session.onboardHateCount).padStart(2)} (${(session.onboardRate * 100).toFixed(0).padStart(3)}%) ${onboardBar.padEnd(12)}|` +
        ` eng ${(session.engRate * 100).toFixed(0).padStart(3)}% | ${session.totalLikes}♥ | sat ${String(session.satisfaction).padStart(3)}`
      );

      if (s < SESSIONS) await sleep(DELAY_SESSIONS);
    }

    // Trend analysis
    const firstReal = sessions.slice(0, 5).reduce((s, ses) => s + ses.realRate, 0) / 5;
    const secondReal = sessions.slice(5).reduce((s, ses) => s + ses.realRate, 0) / 5;
    const firstOnboard = sessions.slice(0, 5).reduce((s, ses) => s + ses.onboardRate, 0) / 5;
    const secondOnboard = sessions.slice(5).reduce((s, ses) => s + ses.onboardRate, 0) / 5;

    const realDelta = firstReal > 0.01 ? ((secondReal - firstReal) / firstReal) * 100 : (secondReal > firstReal ? 100 : 0);
    const onboardDelta = firstOnboard > 0.01 ? ((secondOnboard - firstOnboard) / firstOnboard) * 100 : 0;

    const verdict = realDelta > 15 && onboardDelta < -10 ? 'LEARNING ✅' :
                    realDelta > 10 ? 'PARTIAL ⚠️' :
                    realDelta < -10 ? 'NOT LEARNING ❌' : 'FLAT ➡️';

    console.log(`\n  REAL interest:    S1-5: ${(firstReal * 100).toFixed(1)}% → S6-10: ${(secondReal * 100).toFixed(1)}%  (${realDelta >= 0 ? '+' : ''}${realDelta.toFixed(0)}%)`);
    console.log(`  ONBOARD interest: S1-5: ${(firstOnboard * 100).toFixed(1)}% → S6-10: ${(secondOnboard * 100).toFixed(1)}%  (${onboardDelta >= 0 ? '+' : ''}${onboardDelta.toFixed(0)}%)`);
    console.log(`  VERDICT: ${verdict}`);

    allResults.push({ persona: persona.name, onboarding: persona.onboardingTopics, realCategories: persona.realLoveCategories, sessions, realDelta, onboardDelta, verdict });
  }

  // Grand report
  console.log(`\n\n${'━'.repeat(100)}`);
  console.log('  GRAND REPORT — Feed Interest Discovery');
  console.log('━'.repeat(100));

  console.log('\n  ' + 'Persona'.padEnd(12) + 'Onboarding'.padEnd(32) + 'Real Interest'.padEnd(20) + 'Real S1-5'.padStart(10) + 'Real S6-10'.padStart(11) + 'Delta'.padStart(8) + 'Onb S1-5'.padStart(10) + 'Onb S6-10'.padStart(11) + 'Delta'.padStart(8) + '  Verdict');
  console.log('  ' + '─'.repeat(130));

  let learning = 0, partial = 0, flat = 0, notLearning = 0;
  for (const r of allResults) {
    const firstR = r.sessions.slice(0, 5).reduce((s, ses) => s + ses.realRate, 0) / 5;
    const secondR = r.sessions.slice(5).reduce((s, ses) => s + ses.realRate, 0) / 5;
    const firstO = r.sessions.slice(0, 5).reduce((s, ses) => s + ses.onboardRate, 0) / 5;
    const secondO = r.sessions.slice(5).reduce((s, ses) => s + ses.onboardRate, 0) / 5;

    if (r.verdict.includes('✅')) learning++;
    else if (r.verdict.includes('PARTIAL')) partial++;
    else if (r.verdict.includes('NOT')) notLearning++;
    else flat++;

    console.log('  ' + r.persona.padEnd(12) + r.onboarding.join(', ').substring(0, 30).padEnd(32) +
      r.realCategories.join(', ').substring(0, 18).padEnd(20) +
      `${(firstR * 100).toFixed(1)}%`.padStart(10) + `${(secondR * 100).toFixed(1)}%`.padStart(11) +
      `${r.realDelta >= 0 ? '+' : ''}${r.realDelta.toFixed(0)}%`.padStart(8) +
      `${(firstO * 100).toFixed(1)}%`.padStart(10) + `${(secondO * 100).toFixed(1)}%`.padStart(11) +
      `${r.onboardDelta >= 0 ? '+' : ''}${r.onboardDelta.toFixed(0)}%`.padStart(8) +
      `  ${r.verdict}`);
  }

  console.log('  ' + '─'.repeat(130));
  console.log(`\n  LEARNING: ${learning}/${allResults.length} | PARTIAL: ${partial} | FLAT: ${flat} | NOT LEARNING: ${notLearning}`);

  console.log('\n  AGGREGATE — Real interest % by session:');
  for (let s = 0; s < SESSIONS; s++) {
    const avg = allResults.reduce((sum, r) => sum + (r.sessions[s]?.realRate || 0), 0) / allResults.length;
    const bar = '█'.repeat(Math.round(avg * 50));
    console.log(`    S${String(s + 1).padStart(2)}: ${(avg * 100).toFixed(1).padStart(5)}% ${bar}`);
  }

  console.log('\n  AGGREGATE — Onboarding (unwanted) % by session:');
  for (let s = 0; s < SESSIONS; s++) {
    const avg = allResults.reduce((sum, r) => sum + (r.sessions[s]?.onboardRate || 0), 0) / allResults.length;
    const bar = '░'.repeat(Math.round(avg * 50));
    console.log(`    S${String(s + 1).padStart(2)}: ${(avg * 100).toFixed(1).padStart(5)}% ${bar}`);
  }

  fs.writeFileSync('test_learning_v2_results.json', JSON.stringify(allResults, null, 2));
  console.log('\nResults saved to test_learning_v2_results.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

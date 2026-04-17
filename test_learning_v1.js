import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// FEED LEARNING TEST — Does the feed adapt to entity-level preferences?
//
// Each persona picks BROAD topics but has HIDDEN entity preferences.
// E.g., picks "Soccer/Football" but only engages with Premier League.
// Does the feed learn to show more Premier League over 10 sessions?
//
// We measure:
//   - What % of articles match the PREFERRED entities per session?
//   - Does this % increase over time? (= feed is learning)
//   - What % match the DISLIKED entities? Does it decrease?
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
// PERSONAS — Broad topics, hidden entity preferences
// ============================================================================

const PERSONAS = [
  {
    name: 'PL_Fan',
    bio: 'Picks Soccer broadly, but ONLY cares about Premier League. Skips La Liga, Serie A, Bundesliga.',
    email: 'persona_plfan@tennews.test', homeCountry: 'uk',
    subtopics: ['Soccer/Football'],
    // Hidden preferences — what they actually engage with vs skip
    loveKeywords: ['premier league', 'arsenal', 'liverpool', 'manchester', 'chelsea', 'tottenham', 'newcastle', 'aston villa', 'west ham', 'everton', 'saka', 'salah', 'haaland', 'english football', 'epl'],
    hateKeywords: ['la liga', 'serie a', 'bundesliga', 'ligue 1', 'real madrid', 'barcelona', 'barca', 'bayern', 'juventus', 'psg', 'mls', 'liga mx'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.15, sessionSize: [20, 40],
  },
  {
    name: 'OpenAI_Only',
    bio: 'Picks AI broadly, but ONLY cares about OpenAI/ChatGPT. Skips Google AI, Meta AI, Anthropic.',
    email: 'persona_openaifan@tennews.test', homeCountry: 'usa',
    subtopics: ['AI & Machine Learning'],
    loveKeywords: ['openai', 'chatgpt', 'gpt', 'sam altman', 'dall-e', 'sora', 'gpt-4', 'gpt-5'],
    hateKeywords: ['google ai', 'gemini', 'anthropic', 'claude', 'meta ai', 'llama', 'mistral', 'deepseek', 'cohere'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.12, sessionSize: [20, 40],
  },
  {
    name: 'Tesla_Bull',
    bio: 'Picks Automotive + Stock Markets, but ONLY cares about Tesla/Elon. Skips Ford, GM, Toyota.',
    email: 'persona_teslabull@tennews.test', homeCountry: 'usa',
    subtopics: ['Automotive', 'Stock Markets'],
    loveKeywords: ['tesla', 'elon musk', 'musk', 'tsla', 'cybertruck', 'model y', 'model 3', 'spacex', 'starlink', 'ev sales'],
    hateKeywords: ['ford', 'gm', 'general motors', 'toyota', 'honda', 'bmw', 'mercedes', 'volkswagen', 'hyundai', 'rivian', 'lucid'],
    patience: 0.5, saveRate: 0.04, likeRate: 0.18, sessionSize: [15, 35],
  },
  {
    name: 'CryptoMaxi',
    bio: 'Picks Bitcoin + DeFi, but ONLY cares about Bitcoin. Hates altcoins and NFTs.',
    email: 'persona_cryptomaxi@tennews.test', homeCountry: 'usa',
    subtopics: ['Bitcoin', 'DeFi & Web3', 'Stock Markets'],
    loveKeywords: ['bitcoin', 'btc', 'satoshi', 'halving', 'lightning network', 'bitcoin etf', 'microstrategy', 'saylor'],
    hateKeywords: ['ethereum', 'eth', 'solana', 'cardano', 'nft', 'altcoin', 'memecoin', 'dogecoin', 'shiba', 'ripple', 'xrp'],
    patience: 0.5, saveRate: 0.05, likeRate: 0.20, sessionSize: [18, 35],
  },
  {
    name: 'NASA_Nerd',
    bio: 'Picks Space broadly, but ONLY cares about NASA/Mars. Skips SpaceX commercial, Blue Origin.',
    email: 'persona_nasanerd@tennews.test', homeCountry: 'usa',
    subtopics: ['Space & Astronomy', 'Space Tech', 'Earth Science'],
    loveKeywords: ['nasa', 'mars', 'james webb', 'artemis', 'moon', 'asteroid', 'telescope', 'hubble', 'perseverance', 'curiosity', 'jpl', 'planet', 'galaxy'],
    hateKeywords: ['spacex', 'starship', 'blue origin', 'bezos', 'virgin galactic', 'starlink', 'commercial space', 'rocket lab'],
    patience: 0.8, saveRate: 0.07, likeRate: 0.10, sessionSize: [20, 40],
  },
  {
    name: 'SCOTUS_Watcher',
    bio: 'Picks US Politics broadly, but ONLY cares about Supreme Court and legal battles. Skips elections, Congress.',
    email: 'persona_scotus@tennews.test', homeCountry: 'usa',
    subtopics: ['US Politics', 'Human Rights & Civil Liberties'],
    loveKeywords: ['supreme court', 'scotus', 'justice', 'ruling', 'unconstitutional', 'court', 'judge', 'lawsuit', 'legal', 'amendment', 'appeal', 'verdict'],
    hateKeywords: ['election', 'campaign', 'vote', 'ballot', 'primary', 'rally', 'poll', 'approval rating', 'midterm', 'caucus', 'debate'],
    patience: 0.8, saveRate: 0.08, likeRate: 0.12, sessionSize: [18, 35],
  },
  {
    name: 'Nvidia_Investor',
    bio: 'Picks Tech broadly, but ONLY cares about Nvidia/chips/semiconductors. Skips consumer gadgets.',
    email: 'persona_nvda@tennews.test', homeCountry: 'usa',
    subtopics: ['Robotics & Hardware', 'AI & Machine Learning', 'Stock Markets'],
    loveKeywords: ['nvidia', 'nvda', 'gpu', 'chip', 'semiconductor', 'tsmc', 'amd', 'processor', 'h100', 'a100', 'jensen', 'cuda', 'data center'],
    hateKeywords: ['iphone', 'samsung', 'pixel', 'wearable', 'smartwatch', 'airpods', 'headphones', 'smart home', 'alexa'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.14, sessionSize: [20, 40],
  },
  {
    name: 'UFC_Only',
    bio: 'Picks Boxing & MMA/UFC broadly, but ONLY cares about UFC. Skips boxing, wrestling, ONE FC.',
    email: 'persona_ufconly@tennews.test', homeCountry: 'usa',
    subtopics: ['Boxing & MMA/UFC', 'NFL'],
    loveKeywords: ['ufc', 'mma', 'dana white', 'octagon', 'knockout', 'submission', 'jones', 'makhachev', 'usman', 'adesanya', 'fight night', 'pay-per-view'],
    hateKeywords: ['boxing', 'heavyweight', 'tyson fury', 'canelo', 'ring', 'wrestling', 'wwe', 'aew', 'one championship', 'bellator'],
    patience: 0.4, saveRate: 0.03, likeRate: 0.20, sessionSize: [15, 30],
  },
  {
    name: 'Climate_Activist',
    bio: 'Picks Climate broadly, but ONLY cares about renewable energy and solutions. Skips doom/disaster.',
    email: 'persona_climatefan@tennews.test', homeCountry: 'usa',
    subtopics: ['Climate & Environment', 'Oil & Energy'],
    loveKeywords: ['solar', 'wind', 'renewable', 'clean energy', 'ev', 'electric', 'battery', 'green', 'sustainable', 'carbon capture', 'hydrogen', 'nuclear energy'],
    hateKeywords: ['wildfire', 'flood', 'hurricane', 'drought', 'heat wave', 'death toll', 'disaster', 'catastrophe', 'extinction', 'oil spill', 'oil drilling'],
    patience: 0.7, saveRate: 0.06, likeRate: 0.12, sessionSize: [18, 35],
  },
  {
    name: 'KDrama_Fan',
    bio: 'Picks K-Pop & K-Drama + Entertainment, but ONLY cares about K-Drama. Skips K-Pop music.',
    email: 'persona_kdrama@tennews.test', homeCountry: 'usa',
    subtopics: ['K-Pop & K-Drama', 'TV & Streaming', 'Movies & Film'],
    loveKeywords: ['k-drama', 'kdrama', 'korean drama', 'netflix korea', 'korean series', 'squid game', 'korean actor', 'korean actress', 'k-drama', 'korean show'],
    hateKeywords: ['k-pop', 'bts', 'blackpink', 'newjeans', 'aespa', 'stray kids', 'seventeen', 'idol', 'comeback', 'album release', 'concert tour'],
    patience: 0.6, saveRate: 0.05, likeRate: 0.15, sessionSize: [15, 30],
  },
  {
    name: 'Iran_Hawk',
    bio: 'Picks Middle East broadly, but ONLY cares about Iran military/nuclear. Skips Israel-Palestine, Gulf business.',
    email: 'persona_iranhawk@tennews.test', homeCountry: 'usa',
    subtopics: ['Middle East', 'War & Conflict'],
    loveKeywords: ['iran', 'tehran', 'irgc', 'nuclear', 'enrichment', 'strait of hormuz', 'iranian', 'persian gulf', 'ayatollah', 'hezbollah', 'iranian military'],
    hateKeywords: ['israel', 'palestine', 'gaza', 'west bank', 'saudi arabia', 'uae', 'dubai', 'vision 2030', 'opec', 'oil price', 'abraham accords'],
    patience: 0.8, saveRate: 0.07, likeRate: 0.10, sessionSize: [20, 35],
  },
  {
    name: 'Gaming_PC',
    bio: 'Picks Gaming broadly, but ONLY cares about PC gaming. Skips console/mobile.',
    email: 'persona_pcgaming@tennews.test', homeCountry: 'usa',
    subtopics: ['Gaming', 'Robotics & Hardware'],
    loveKeywords: ['steam', 'pc gaming', 'pc game', 'gpu', 'nvidia', 'amd', 'graphics card', 'fps', 'modding', 'steam deck', 'valve', 'counter-strike', 'cs2', 'valorant', 'mmorpg'],
    hateKeywords: ['playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'mobile game', 'ios game', 'android game', 'gacha', 'console exclusive'],
    patience: 0.5, saveRate: 0.04, likeRate: 0.16, sessionSize: [18, 35],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatDwell(d) { return d >= 60 ? `${Math.floor(d/60)}m${Math.round(d%60)}s` : d >= 1 ? `${d.toFixed(1)}s` : `${(d*1000).toFixed(0)}ms`; }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Parse: ' + body.substring(0, 200))); } });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = { hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } };
    const req = https.request(opts, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, data: b }); } }); });
    req.on('error', reject); req.write(data); req.end();
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

async function trackEvent(accessToken, eventData) {
  return httpPost(`${API_BASE}/api/analytics/track`, eventData, { 'Authorization': `Bearer ${accessToken}` });
}

function getAccessToken(email, password) {
  const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  return c.auth.signInWithPassword({ email, password }).then(({ data, error }) => error ? null : data.session.access_token);
}

async function setupPersona(persona) {
  const { data, error } = await adminDb.auth.admin.createUser({ email: persona.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `${persona.name} (Learning Test)` } });
  let userId, accessToken;
  if (error) {
    const c = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: e } = await c.auth.signInWithPassword({ email: persona.email, password: PASSWORD });
    if (e) { console.error(`  FAIL ${persona.name}: ${e.message}`); return null; }
    userId = s.user.id; accessToken = s.session.access_token;
  } else { userId = data.user.id; await sleep(600); accessToken = await getAccessToken(persona.email, PASSWORD); }
  if (!accessToken) return null;

  await adminDb.from('profiles').upsert({
    id: userId, email: persona.email, full_name: `${persona.name} (Learning Test)`,
    home_country: persona.homeCountry, followed_countries: [],
    followed_topics: persona.subtopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  });
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);
  return { userId, accessToken };
}

// ============================================================================
// BEHAVIOR — Entity-preference-driven engagement
// ============================================================================

function classifyArticle(persona, article) {
  const tags = (article.interest_tags || article.interestTags || []).map(t => String(t).toLowerCase());
  const title = (article.title || article.title_news || '').toLowerCase();
  const combined = [...tags, ...title.split(/\s+/)].join(' ');

  const loveHits = persona.loveKeywords.filter(kw => combined.includes(kw)).length;
  const hateHits = persona.hateKeywords.filter(kw => combined.includes(kw)).length;

  if (loveHits >= 2) return 'LOVE';
  if (loveHits >= 1 && hateHits === 0) return 'LIKE';
  if (hateHits >= 2) return 'HATE';
  if (hateHits >= 1 && loveHits === 0) return 'DISLIKE';
  return 'NEUTRAL';
}

function simulateReaction(persona, article) {
  const pref = classifyArticle(persona, article);

  // Engagement is driven by entity preference, not just topic match
  switch (pref) {
    case 'LOVE': {
      const dwell = (15 + Math.random() * 35) * persona.patience;
      const shouldLike = Math.random() < persona.likeRate * 2.5;
      const shouldSave = Math.random() < persona.saveRate * 2.0;
      const shouldShare = shouldLike && Math.random() < 0.3;
      const events = ['article_detail_view', 'article_engaged'];
      if (shouldLike) events.push('article_liked');
      if (shouldSave) events.push('article_saved');
      if (shouldShare) events.push('article_shared');
      const tier = dwell >= 45 ? 'absorbed' : dwell >= 25 ? 'deep_read' : 'engaged_read';
      return { action: 'DEEP_READ', pref, dwell, dwellTier: tier, events, signal: 'ENGAGE', like: shouldLike, save: shouldSave, share: shouldShare, moodDelta: 6 + Math.random() * 5 };
    }
    case 'LIKE': {
      const dwell = (8 + Math.random() * 15) * persona.patience;
      const shouldLike = Math.random() < persona.likeRate;
      const shouldSave = Math.random() < persona.saveRate * 0.5;
      const events = ['article_detail_view', 'article_engaged'];
      if (shouldLike) events.push('article_liked');
      if (shouldSave) events.push('article_saved');
      const tier = dwell >= 12 ? 'engaged_read' : 'light_read';
      return { action: 'ENGAGE', pref, dwell, dwellTier: tier, events, signal: 'ENGAGE', like: shouldLike, save: shouldSave, share: false, moodDelta: 3 + Math.random() * 3 };
    }
    case 'NEUTRAL': {
      // 50/50 — sometimes engages, sometimes skips
      if (Math.random() < 0.4) {
        const dwell = (4 + Math.random() * 8) * persona.patience;
        const tier = dwell >= 6 ? 'light_read' : 'glance';
        return { action: 'GLANCE', pref, dwell, dwellTier: tier, events: ['article_detail_view', 'article_engaged'], signal: 'ENGAGE', like: false, save: false, share: false, moodDelta: 1 };
      }
      const dwell = 2 + Math.random() * 3;
      return { action: 'SCAN', pref, dwell, dwellTier: 'glance', events: ['article_detail_view', 'article_exit'], signal: 'GLANCE', like: false, save: false, share: false, moodDelta: -1 };
    }
    case 'DISLIKE': {
      const dwell = 1 + Math.random() * 2;
      return { action: 'SKIP', pref, dwell, dwellTier: 'quick_skip', events: ['article_skipped'], signal: 'SKIP', like: false, save: false, share: false, moodDelta: -3 };
    }
    case 'HATE': {
      const dwell = 0.3 + Math.random() * 0.7;
      return { action: 'SKIP', pref, dwell, dwellTier: 'instant_skip', events: ['article_skipped'], signal: 'SKIP', like: false, save: false, share: false, moodDelta: -5 };
    }
  }
}

// ============================================================================
// SESSION
// ============================================================================

async function simulateSession(persona, userId, accessToken, sessionNum, history) {
  const sessionId = `learn_${persona.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;
  const [minArt, maxArt] = persona.sessionSize;
  const maxArticles = minArt + Math.floor(Math.random() * (maxArt - minArt));
  const maxPages = Math.ceil(maxArticles * 1.5 / 25) + 1;

  const engagedIds = [...(history.engagedIds || [])];
  const skippedIds = [...(history.skippedIds || [])];
  const seenIds = [...(history.seenIds || [])];
  const interactions = [];
  let cursor = null;
  let satisfaction = 50;

  // Per-session entity tracking
  let loveCount = 0, likeCount = 0, neutralCount = 0, dislikeCount = 0, hateCount = 0;
  let totalLikes = 0, totalSaves = 0, totalShares = 0;

  for (let page = 1; page <= maxPages; page++) {
    let resp;
    try { resp = await fetchFeed(userId, { limit: 25, cursor, engagedIds, skippedIds, seenIds }); } catch { break; }
    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    for (const article of resp.articles) {
      const id = String(article.id);
      seenIds.push(id);
      const reaction = simulateReaction(persona, article);

      // Track events via real API
      for (const eventType of reaction.events) {
        const meta = {
          dwell: String(reaction.dwell.toFixed(1)),
          total_active_seconds: String(Math.round(reaction.dwell)),
          dwell_tier: reaction.dwellTier,
          bucket: article.bucket || 'unknown',
        };
        if (eventType === 'article_engaged') meta.engaged_seconds = String(Math.round(reaction.dwell));
        try { await trackEvent(accessToken, { event_type: eventType, article_id: parseInt(id), session_id: sessionId, category: article.category || null, metadata: meta }); } catch {}
        await sleep(DELAY_EVENTS);
      }

      // Update IDs
      if (reaction.signal === 'ENGAGE') engagedIds.push(id);
      else if (reaction.signal === 'SKIP') skippedIds.push(id);

      // Count preferences
      if (reaction.pref === 'LOVE') loveCount++;
      else if (reaction.pref === 'LIKE') likeCount++;
      else if (reaction.pref === 'NEUTRAL') neutralCount++;
      else if (reaction.pref === 'DISLIKE') dislikeCount++;
      else if (reaction.pref === 'HATE') hateCount++;
      if (reaction.like) totalLikes++;
      if (reaction.save) totalSaves++;
      if (reaction.share) totalShares++;

      satisfaction = Math.max(0, Math.min(100, satisfaction + reaction.moodDelta));

      interactions.push({
        id, pref: reaction.pref, action: reaction.action, signal: reaction.signal,
        dwell: reaction.dwell, like: reaction.like, save: reaction.save,
        title: (article.title || article.title_news || '').substring(0, 60),
        category: article.category || '',
      });

      // Exit conditions
      if (satisfaction <= 20 && interactions.length >= 6) break;
      if (satisfaction <= 35 && interactions.length >= 10 && (dislikeCount + hateCount) > interactions.length * 0.5) break;
      if (interactions.length >= maxArticles) break;
    }
    if (interactions.length >= maxArticles || satisfaction <= 20) break;
    await sleep(DELAY_PAGES);
  }

  const total = interactions.length;
  const engRate = total > 0 ? interactions.filter(i => i.signal === 'ENGAGE').length / total : 0;
  const loveRate = total > 0 ? loveCount / total : 0;
  const hateRate = total > 0 ? (dislikeCount + hateCount) / total : 0;
  const preferredRate = total > 0 ? (loveCount + likeCount) / total : 0;

  return {
    sessionNum, total, satisfaction: Math.round(satisfaction),
    loveCount, likeCount, neutralCount, dislikeCount, hateCount,
    totalLikes, totalSaves, totalShares,
    engRate, loveRate, hateRate, preferredRate,
    interactions,
    history: { engagedIds: [...engagedIds], skippedIds: [...skippedIds], seenIds: [...seenIds] },
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  FEED LEARNING TEST — Does the feed adapt to entity-level preferences?      ║');
  console.log('║  Each persona picks broad topics but has hidden entity preferences.          ║');
  console.log('║  Measures: Does % of LOVED articles increase over sessions?                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()} | ${SESSIONS} sessions | ${PERSONAS.length} personas\n`);

  // Setup
  console.log('SETUP...');
  const setups = [];
  for (const p of PERSONAS) {
    const s = await setupPersona(p);
    if (s) { setups.push({ persona: p, ...s }); console.log(`  OK: ${p.name} — ${p.subtopics.join(', ')}`); }
    else console.log(`  FAIL: ${p.name}`);
    await sleep(400);
  }
  console.log(`\n${setups.length}/${PERSONAS.length} ready.\n`);

  // Run sessions
  const allResults = [];
  for (const { persona, userId, accessToken } of setups) {
    console.log(`\n${'━'.repeat(90)}`);
    console.log(`  ${persona.name.toUpperCase()} — ${persona.bio}`);
    console.log(`  Topics: ${persona.subtopics.join(', ')}`);
    console.log(`  LOVES: ${persona.loveKeywords.slice(0, 5).join(', ')}...`);
    console.log(`  HATES: ${persona.hateKeywords.slice(0, 5).join(', ')}...`);
    console.log('━'.repeat(90));

    let history = { engagedIds: [], skippedIds: [], seenIds: [] };
    const sessions = [];

    // Simulate search for preferred entities between sessions
    for (let s = 1; s <= SESSIONS; s++) {
      if (s >= 2 && Math.random() < 0.5) {
        const searchTerm = persona.loveKeywords[Math.floor(Math.random() * persona.loveKeywords.length)];
        try { await trackEvent(accessToken, { event_type: 'search_query', session_id: `search_${persona.name}_s${s}`, metadata: { query: searchTerm } }); } catch {}
        await sleep(20);
      }

      const session = await simulateSession(persona, userId, accessToken, s, history);
      sessions.push(session);
      history = session.history;

      // Print session summary
      const loveBar = '♥'.repeat(session.loveCount);
      const hateBar = '✗'.repeat(Math.min(session.dislikeCount + session.hateCount, 20));
      console.log(
        `  S${String(s).padStart(2)}: ${String(session.total).padStart(3)} articles |` +
        ` LOVE ${String(session.loveCount).padStart(2)} (${(session.loveRate * 100).toFixed(0).padStart(3)}%) |` +
        ` HATE ${String(session.dislikeCount + session.hateCount).padStart(2)} (${(session.hateRate * 100).toFixed(0).padStart(3)}%) |` +
        ` eng ${(session.engRate * 100).toFixed(0).padStart(3)}% |` +
        ` ${session.totalLikes}♥ ${session.totalSaves}⊕ |` +
        ` sat ${String(session.satisfaction).padStart(3)} |` +
        ` ${loveBar}`
      );

      if (s < SESSIONS) await sleep(DELAY_SESSIONS);
    }

    // Per-persona trend analysis
    const loveTrend = sessions.map(s => s.loveRate);
    const hateTrend = sessions.map(s => s.hateRate);
    const engTrend = sessions.map(s => s.engRate);

    const firstHalf = arr => arr.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = arr => arr.slice(5).reduce((a, b) => a + b, 0) / 5;

    const loveDelta = ((secondHalf(loveTrend) - firstHalf(loveTrend)) / Math.max(firstHalf(loveTrend), 0.01)) * 100;
    const hateDelta = ((secondHalf(hateTrend) - firstHalf(hateTrend)) / Math.max(firstHalf(hateTrend), 0.01)) * 100;
    const engDelta = ((secondHalf(engTrend) - firstHalf(engTrend)) / Math.max(firstHalf(engTrend), 0.01)) * 100;

    const loveArrow = loveDelta > 10 ? '📈' : loveDelta < -10 ? '📉' : '➡️';
    const hateArrow = hateDelta < -10 ? '📈' : hateDelta > 10 ? '📉' : '➡️';

    console.log(`\n  LEARNING ANALYSIS:`);
    console.log(`    LOVE% trend: S1-5 avg ${(firstHalf(loveTrend) * 100).toFixed(1)}% → S6-10 avg ${(secondHalf(loveTrend) * 100).toFixed(1)}% ${loveArrow} ${loveDelta >= 0 ? '+' : ''}${loveDelta.toFixed(0)}%`);
    console.log(`    HATE% trend: S1-5 avg ${(firstHalf(hateTrend) * 100).toFixed(1)}% → S6-10 avg ${(secondHalf(hateTrend) * 100).toFixed(1)}% ${hateArrow} ${hateDelta >= 0 ? '+' : ''}${hateDelta.toFixed(0)}%`);
    console.log(`    Eng%  trend: S1-5 avg ${(firstHalf(engTrend) * 100).toFixed(1)}% → S6-10 avg ${(secondHalf(engTrend) * 100).toFixed(1)}%`);

    const verdict = loveDelta > 15 && hateDelta < -10 ? 'LEARNING ✅' :
                    loveDelta > 5 ? 'PARTIAL LEARNING ⚠️' :
                    loveDelta < -10 ? 'NOT LEARNING ❌' : 'FLAT ➡️';
    console.log(`    VERDICT: ${verdict}`);

    allResults.push({ persona: persona.name, subtopics: persona.subtopics, sessions, loveDelta, hateDelta, engDelta, verdict });
  }

  // ============================================================================
  // GRAND REPORT
  // ============================================================================

  console.log(`\n\n${'━'.repeat(90)}`);
  console.log('  GRAND REPORT — Feed Learning Test');
  console.log('━'.repeat(90));

  console.log('\n  ' + 'Persona'.padEnd(18) + 'Topics'.padEnd(30) + 'Love S1-5'.padStart(10) + 'Love S6-10'.padStart(11) + 'Delta'.padStart(8) + 'Hate S1-5'.padStart(10) + 'Hate S6-10'.padStart(11) + 'Delta'.padStart(8) + '  Verdict');
  console.log('  ' + '─'.repeat(120));

  let learning = 0, partial = 0, flat = 0, notLearning = 0;

  for (const r of allResults) {
    const firstLove = r.sessions.slice(0, 5).reduce((s, ses) => s + ses.loveRate, 0) / 5;
    const secondLove = r.sessions.slice(5).reduce((s, ses) => s + ses.loveRate, 0) / 5;
    const firstHate = r.sessions.slice(0, 5).reduce((s, ses) => s + ses.hateRate, 0) / 5;
    const secondHate = r.sessions.slice(5).reduce((s, ses) => s + ses.hateRate, 0) / 5;

    if (r.verdict.includes('LEARNING ✅')) learning++;
    else if (r.verdict.includes('PARTIAL')) partial++;
    else if (r.verdict.includes('NOT LEARNING')) notLearning++;
    else flat++;

    console.log('  ' +
      r.persona.padEnd(18) + r.subtopics.join(', ').substring(0, 28).padEnd(30) +
      `${(firstLove * 100).toFixed(1)}%`.padStart(10) +
      `${(secondLove * 100).toFixed(1)}%`.padStart(11) +
      `${r.loveDelta >= 0 ? '+' : ''}${r.loveDelta.toFixed(0)}%`.padStart(8) +
      `${(firstHate * 100).toFixed(1)}%`.padStart(10) +
      `${(secondHate * 100).toFixed(1)}%`.padStart(11) +
      `${r.hateDelta >= 0 ? '+' : ''}${r.hateDelta.toFixed(0)}%`.padStart(8) +
      `  ${r.verdict}`
    );
  }

  console.log('  ' + '─'.repeat(120));
  console.log(`\n  LEARNING: ${learning}/${allResults.length} | PARTIAL: ${partial} | FLAT: ${flat} | NOT LEARNING: ${notLearning}`);

  // Session-over-session love% across all personas
  console.log('\n  AGGREGATE LOVE% BY SESSION (does preferred content increase?):');
  for (let s = 0; s < SESSIONS; s++) {
    const rates = allResults.map(r => r.sessions[s]?.loveRate || 0);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const bar = '█'.repeat(Math.round(avg * 50));
    console.log(`    S${String(s + 1).padStart(2)}: ${(avg * 100).toFixed(1).padStart(5)}% ${bar}`);
  }

  // Save results
  fs.writeFileSync('test_learning_results_v1.json', JSON.stringify(allResults, null, 2));
  console.log('\nResults saved to test_learning_results_v1.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

// ============================================================================
// AI PERSONA TEST — 10 Claude-powered personas with realistic human behavior
// Each persona picks their own interests, reacts naturally to articles,
// and gives written feedback at the end.
// ============================================================================

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'TestPersona2024!';
const SESSIONS_PER_PERSONA = 3;
const ARTICLES_PER_SESSION = 30;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================================
// CLAUDE API
// ============================================================================

async function askClaude(systemPrompt, userMessage) {
  const data = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.content?.[0]?.text || 'ERROR');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// 10 AI PERSONAS — Claude creates their personality
// ============================================================================

const PERSONA_SEEDS = [
  { name: 'Alex', age: 22, location: 'Los Angeles', bio: 'Film school student, basketball fan, into streetwear' },
  { name: 'Fatma', age: 28, location: 'Istanbul', bio: 'Galatasaray superfan, works in fintech, follows Turkish politics' },
  { name: 'Raj', age: 35, location: 'Bangalore', bio: 'Software engineer at a startup, cricket obsessed, follows AI news' },
  { name: 'Maria', age: 45, location: 'Madrid', bio: 'Doctor, follows medical research, Real Madrid season ticket holder' },
  { name: 'Yuto', age: 19, location: 'Tokyo', bio: 'University student, gamer, anime fan, follows Nintendo news' },
  { name: 'Chloe', age: 31, location: 'London', bio: 'Environmental journalist, vegan, Arsenal fan, follows climate science' },
  { name: 'Omar', age: 40, location: 'Dubai', bio: 'Oil industry executive, follows markets and Middle East politics' },
  { name: 'Sena', age: 24, location: 'Seoul', bio: 'K-pop stan, beauty influencer, follows Korean entertainment' },
  { name: 'Mike', age: 55, location: 'Texas', bio: 'Retired military, Cowboys fan, follows US politics and defense news' },
  { name: 'Lina', age: 27, location: 'Berlin', bio: 'UX designer, techie, follows AI/startups, casual Bundesliga fan' },
];

const AVAILABLE_SUBTOPICS = [
  'War & Conflict', 'US Politics', 'European Politics', 'Asian Politics', 'Middle East',
  'Latin America', 'Africa & Oceania', 'Human Rights & Civil Liberties',
  'NFL', 'NBA', 'Soccer/Football', 'MLB/Baseball', 'Cricket', 'F1 & Motorsport',
  'Boxing & MMA/UFC', 'Olympics & Paralympics',
  'Oil & Energy', 'Automotive', 'Retail & Consumer', 'Corporate Deals',
  'Trade & Tariffs', 'Corporate Earnings', 'Startups & Venture Capital', 'Real Estate',
  'Movies & Film', 'TV & Streaming', 'Music', 'Gaming', 'Celebrity News', 'K-Pop & K-Drama',
  'AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity',
  'Space Tech', 'Robotics & Hardware',
  'Space & Astronomy', 'Climate & Environment', 'Biology & Nature', 'Earth Science',
  'Medical Breakthroughs', 'Public Health', 'Mental Health', 'Pharma & Drug Industry',
  'Stock Markets', 'Banking & Lending', 'Commodities',
  'Bitcoin', 'DeFi & Web3', 'Crypto Regulation & Legal',
  'Pets & Animals', 'Sneakers & Streetwear', 'Celebrity Style & Red Carpet',
];

// ============================================================================
// HTTP HELPERS
// ============================================================================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchFeed(userId, params = {}) {
  let url = `${API_BASE}/api/feed/main?limit=${params.limit || 30}&user_id=${encodeURIComponent(userId)}`;
  if (params.cursor) url += '&cursor=' + encodeURIComponent(params.cursor);
  if (params.engagedIds?.length) url += '&engaged_ids=' + params.engagedIds.slice(-50).join(',');
  if (params.skippedIds?.length) url += '&skipped_ids=' + params.skippedIds.slice(-50).join(',');
  if (params.seenIds?.length) url += '&seen_ids=' + params.seenIds.slice(-300).join(',');
  return httpGet(url);
}

async function trackEvent(token, eventData) {
  return httpPost(`${API_BASE}/api/analytics/track`, eventData, { 'Authorization': `Bearer ${token}` });
}

// ============================================================================
// SETUP
// ============================================================================

async function setupPersona(seed) {
  const email = `ai_persona_${seed.name.toLowerCase()}@tennews.test`;

  const { data, error } = await adminDb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `${seed.name} (AI Persona)` },
  });

  let userId, accessToken;
  if (error) {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn, error: signErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signErr) { console.error(`Cannot sign in ${seed.name}:`, signErr.message); return null; }
    userId = signIn.user.id;
    accessToken = signIn.session.access_token;
  } else {
    userId = data.user.id;
    await sleep(600);
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    accessToken = signIn?.session?.access_token;
  }

  if (!accessToken) return null;

  // Clean slate
  await adminDb.from('user_article_events').delete().eq('user_id', userId);
  await adminDb.from('user_interest_clusters').delete().eq('user_id', userId);
  const { data: ppRow } = await adminDb.from('personalization_profiles').select('personalization_id').eq('auth_profile_id', userId).maybeSingle();
  if (ppRow) {
    await adminDb.from('engagement_buffer').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('user_entity_affinity').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('user_sessions').delete().eq('personalization_id', ppRow.personalization_id);
    await adminDb.from('personalization_profiles').delete().eq('personalization_id', ppRow.personalization_id);
  }

  // Ask Claude to pick subtopics for this persona
  const subtopicResponse = await askClaude(
    `You are ${seed.name}, ${seed.age}, from ${seed.location}. ${seed.bio}. You are signing up for a news/content app and need to pick topics you want to follow.`,
    `Here are the available topics. Pick the ones YOU personally care about. Pick between 3 and 12 topics. Only return a JSON array of topic names, nothing else.\n\nAvailable: ${JSON.stringify(AVAILABLE_SUBTOPICS)}`
  );

  let subtopics;
  try {
    subtopics = JSON.parse(subtopicResponse);
  } catch (e) {
    const match = subtopicResponse.match(/\[[\s\S]*?\]/);
    subtopics = match ? JSON.parse(match[0]) : AVAILABLE_SUBTOPICS.slice(0, 4);
  }

  // Save profile
  const profileData = {
    email, full_name: `${seed.name} (AI Persona)`,
    home_country: 'usa', followed_countries: [],
    followed_topics: subtopics, onboarding_completed: true,
    taste_vector: null, taste_vector_minilm: null,
    tag_profile: {}, skip_profile: {}, similarity_floor: 0,
  };

  const { data: existing } = await adminDb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (existing) await adminDb.from('profiles').update(profileData).eq('id', userId);
  else await adminDb.from('profiles').insert({ id: userId, ...profileData });

  await adminDb.from('personalization_profiles').insert({ auth_profile_id: userId, phase: 1, total_interactions: 0 });

  return { userId, accessToken, email, subtopics };
}

// ============================================================================
// SIMULATE SESSION WITH CLAUDE AS THE USER
// ============================================================================

async function simulateAISession(seed, userId, accessToken, sessionNum, history, allReactions) {
  const sessionId = `ai_${seed.name.toLowerCase()}_s${sessionNum}_${Date.now()}`;
  const engagedIds = [...(history.engagedIds || [])];
  const skippedIds = [...(history.skippedIds || [])];
  const seenIds = [...(history.seenIds || [])];
  const reactions = [];

  const systemPrompt = `You are ${seed.name}, ${seed.age}, from ${seed.location}. ${seed.bio}.

You are scrolling through a news/content app called Today+. You see article cards one at a time. For each article, you decide what to do based on YOUR personal interests and personality.

You must respond with ONLY a JSON object:
{
  "action": "skip" | "glance" | "read" | "like" | "save" | "share",
  "dwell_seconds": number (how long you looked at it),
  "thought": "brief honest thought about why you chose this action"
}

Actions:
- "skip": not interested at all, swipe past (0.5-1s)
- "glance": read the headline but not interested enough to read (2-3s)
- "read": read the full card content (5-15s)
- "like": read and liked it (8-20s)
- "save": really valuable, want to come back to this (10-25s)
- "share": so good you'd share with friends (10-30s)

Be honest and realistic. Skip things you don't care about. Don't be nice — skip boring stuff.`;

  let cursor = null;

  for (let page = 0; page < 3; page++) {
    let resp;
    try {
      resp = await fetchFeed(userId, { limit: ARTICLES_PER_SESSION, cursor, engagedIds, skippedIds, seenIds });
    } catch (e) { break; }

    if (!resp.articles || resp.articles.length === 0) break;
    cursor = resp.nextCursor || resp.next_cursor;

    // Show articles to Claude in batches of 5
    for (let i = 0; i < resp.articles.length; i += 5) {
      const batch = resp.articles.slice(i, Math.min(i + 5, resp.articles.length));
      const batchText = batch.map((a, idx) => {
        const title = (a.title || a.title_news || '').replace(/\*\*/g, '');
        const category = a.category || '';
        const tags = typeof a.interest_tags === 'string' ? JSON.parse(a.interest_tags || '[]') : (a.interest_tags || []);
        const bullets = a.summary_bullets_news ? (typeof a.summary_bullets_news === 'string' ? a.summary_bullets_news : JSON.stringify(a.summary_bullets_news)).substring(0, 200) : '';
        return `Article ${i + idx + 1}: [${category}] "${title}"\nTags: ${tags.slice(0, 5).join(', ')}\nPreview: ${bullets}`;
      }).join('\n\n');

      const prompt = `Session ${sessionNum}, articles ${i + 1}-${i + batch.length}. React to EACH article. Return a JSON array of ${batch.length} reaction objects.\n\n${batchText}`;

      let claudeResponse;
      try {
        claudeResponse = await askClaude(systemPrompt, prompt);
      } catch (e) {
        console.log(`  [${seed.name}] Claude error:`, e.message);
        continue;
      }

      let batchReactions;
      try {
        batchReactions = JSON.parse(claudeResponse);
        if (!Array.isArray(batchReactions)) batchReactions = [batchReactions];
      } catch (e) {
        const match = claudeResponse.match(/\[[\s\S]*?\]/);
        batchReactions = match ? JSON.parse(match[0]) : [];
      }

      // Process each reaction
      for (let j = 0; j < Math.min(batch.length, batchReactions.length); j++) {
        const article = batch[j];
        const reaction = batchReactions[j];
        const id = String(article.id);
        seenIds.push(id);

        const action = reaction.action || 'skip';
        const dwell = reaction.dwell_seconds || 1;
        const thought = reaction.thought || '';

        // Track events
        const baseMeta = { dwell: String(dwell), total_active_seconds: String(Math.round(dwell)), bucket: article.bucket || 'personal' };

        if (action === 'skip' || action === 'glance') {
          skippedIds.push(id);
          try { await trackEvent(accessToken, { event_type: 'article_skipped', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: baseMeta }); } catch (e) {}
        } else {
          engagedIds.push(id);
          try { await trackEvent(accessToken, { event_type: 'article_detail_view', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: baseMeta }); } catch (e) {}
          try { await trackEvent(accessToken, { event_type: 'article_engaged', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: { ...baseMeta, engaged_seconds: String(Math.round(dwell)) } }); } catch (e) {}

          if (action === 'like') {
            try { await trackEvent(accessToken, { event_type: 'article_liked', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: baseMeta }); } catch (e) {}
          }
          if (action === 'save') {
            try { await trackEvent(accessToken, { event_type: 'article_saved', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: baseMeta }); } catch (e) {}
          }
          if (action === 'share') {
            try { await trackEvent(accessToken, { event_type: 'article_shared', article_id: parseInt(id), session_id: sessionId, category: article.category, metadata: baseMeta }); } catch (e) {}
          }
        }

        reactions.push({
          articleNum: reactions.length + 1,
          title: (article.title_news || '').replace(/\*\*/g, '').substring(0, 60),
          category: article.category,
          bucket: article.bucket || '?',
          action, dwell, thought,
        });

        await sleep(10);
      }

      await sleep(200); // Rate limit Claude
    }

    if (reactions.length >= ARTICLES_PER_SESSION) break;
    await sleep(100);
  }

  // Stats
  const engaged = reactions.filter(r => !['skip', 'glance'].includes(r.action));
  const skipped = reactions.filter(r => ['skip', 'glance'].includes(r.action));
  const likes = reactions.filter(r => r.action === 'like').length;
  const saves = reactions.filter(r => r.action === 'save').length;
  const shares = reactions.filter(r => r.action === 'share').length;

  return {
    sessionNum, reactions,
    stats: {
      total: reactions.length,
      engaged: engaged.length,
      skipped: skipped.length,
      engRate: reactions.length > 0 ? engaged.length / reactions.length : 0,
      likes, saves, shares,
      avgDwell: reactions.length > 0 ? reactions.reduce((s, r) => s + r.dwell, 0) / reactions.length : 0,
    },
    history: { engagedIds: [...engagedIds], skippedIds: [...skippedIds], seenIds: [...seenIds] },
  };
}

// ============================================================================
// GET FEEDBACK FROM CLAUDE
// ============================================================================

async function getFeedback(seed, subtopics, allReactions) {
  const engagedTitles = allReactions.filter(r => !['skip', 'glance'].includes(r.action)).map(r => `[${r.category}] ${r.title}`).slice(-15);
  const skippedTitles = allReactions.filter(r => ['skip', 'glance'].includes(r.action)).map(r => `[${r.category}] ${r.title}`).slice(-15);
  const total = allReactions.length;
  const engaged = allReactions.filter(r => !['skip', 'glance'].includes(r.action)).length;
  const categories = {};
  for (const r of allReactions) categories[r.category] = (categories[r.category] || 0) + 1;

  const prompt = `You just used a content app called Today+ for ${SESSIONS_PER_PERSONA} sessions and saw ${total} articles total. You engaged with ${engaged} and skipped ${total - engaged}.

Your selected topics were: ${subtopics.join(', ')}

Articles you liked/read:
${engagedTitles.join('\n')}

Articles you skipped:
${skippedTitles.join('\n')}

Category breakdown of what you saw: ${JSON.stringify(categories)}

Give honest, detailed feedback as ${seed.name}:
1. Overall rating (1-10) and why
2. Did the app understand what you like?
3. What was shown too much?
4. What was missing that you wanted to see?
5. Would you come back tomorrow? Why or why not?
6. One specific suggestion to make the feed better for you`;

  return await askClaude(
    `You are ${seed.name}, ${seed.age}, from ${seed.location}. ${seed.bio}. Give honest feedback about a content app you just used. Be specific and critical — don't be nice if the experience was bad.`,
    prompt
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AI PERSONA TEST — 10 Claude-powered realistic users   ║');
  console.log('║  Each persona reacts naturally, gives written feedback  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Sessions: ${SESSIONS_PER_PERSONA} | Articles/session: ${ARTICLES_PER_SESSION} | Model: claude-haiku-4.5\n`);

  const results = [];

  for (const seed of PERSONA_SEEDS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Setting up ${seed.name} (${seed.age}, ${seed.location})...`);

    const setup = await setupPersona(seed);
    if (!setup) { console.log(`  FAILED to setup ${seed.name}`); continue; }

    console.log(`  Subtopics chosen: ${setup.subtopics.join(', ')}`);

    let history = { engagedIds: [], skippedIds: [], seenIds: [] };
    const sessions = [];
    const allReactions = [];

    for (let s = 1; s <= SESSIONS_PER_PERSONA; s++) {
      console.log(`  Session ${s}/${SESSIONS_PER_PERSONA}...`);
      const session = await simulateAISession(seed, setup.userId, setup.accessToken, s, history, allReactions);
      sessions.push(session);
      allReactions.push(...session.reactions);
      history = session.history;

      const eng = (session.stats.engRate * 100).toFixed(0);
      console.log(`    ${session.stats.total} articles | ${eng}% engaged | ${session.stats.likes}♥ ${session.stats.saves}⊕ ${session.stats.shares}↗ | avg dwell ${session.stats.avgDwell.toFixed(1)}s`);

      await sleep(500);
    }

    // Get feedback
    console.log(`  Getting feedback...`);
    const feedback = await getFeedback(seed, setup.subtopics, allReactions);

    // Print article-by-article reactions for last session
    const lastSession = sessions[sessions.length - 1];
    console.log(`\n  Last session reactions (${lastSession.reactions.length} articles):`);
    for (const r of lastSession.reactions.slice(0, 10)) {
      const icon = r.action === 'share' ? '↗' : r.action === 'save' ? '⊕' : r.action === 'like' ? '♥' : r.action === 'read' ? '✓' : r.action === 'glance' ? '~' : '✗';
      console.log(`    ${icon} [${r.action.padEnd(6)}] ${r.dwell.toString().padStart(4)}s  ${r.category.padEnd(15)} ${r.title}`);
      if (r.thought) console.log(`                    └─ "${r.thought}"`);
    }

    console.log(`\n  FEEDBACK FROM ${seed.name.toUpperCase()}:`);
    console.log('  ' + feedback.split('\n').join('\n  '));

    results.push({
      persona: seed, subtopics: setup.subtopics, sessions,
      allReactions, feedback,
      summary: {
        totalArticles: allReactions.length,
        totalEngaged: allReactions.filter(r => !['skip', 'glance'].includes(r.action)).length,
        totalLikes: allReactions.filter(r => r.action === 'like').length,
        totalSaves: allReactions.filter(r => r.action === 'save').length,
        totalShares: allReactions.filter(r => r.action === 'share').length,
        engRate: allReactions.length > 0 ? allReactions.filter(r => !['skip', 'glance'].includes(r.action)).length / allReactions.length : 0,
      },
    });
  }

  // Final summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('FINAL SUMMARY — ALL AI PERSONAS');
  console.log('═'.repeat(60));
  console.log('Name'.padEnd(12) + 'Articles'.padStart(9) + 'Eng%'.padStart(7) + 'Likes'.padStart(7) + 'Saves'.padStart(7) + 'Shares'.padStart(7) + '  Subtopics');
  console.log('─'.repeat(80));

  for (const r of results) {
    console.log(
      r.persona.name.padEnd(12) +
      String(r.summary.totalArticles).padStart(9) +
      (r.summary.engRate * 100).toFixed(0).padStart(6) + '%' +
      String(r.summary.totalLikes).padStart(7) +
      String(r.summary.totalSaves).padStart(7) +
      String(r.summary.totalShares).padStart(7) +
      '  ' + r.subtopics.slice(0, 4).join(', ')
    );
  }

  const avgEng = results.reduce((s, r) => s + r.summary.engRate, 0) / results.length;
  console.log('─'.repeat(80));
  console.log(`AVERAGE: ${(avgEng * 100).toFixed(0)}% engagement across ${results.length} AI personas\n`);

  fs.writeFileSync('test_ai_personas_results.json', JSON.stringify(results, null, 2));
  console.log('Results saved to test_ai_personas_results.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

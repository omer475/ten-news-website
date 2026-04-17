/**
 * Create 5 test users with interests matching ACTUAL articles in the last 12 hours.
 * Based on content analysis: Iran conflict (112), Sports (175), Entertainment (114),
 * Tech/AI (56), Finance/Oil (43), Turkey (13), F1 (13), Ukraine (40), US Politics (31).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 5 users — interests chosen from ACTUAL content available in last 12 hours
const USERS = [
  {
    email: 'test_iran_geopolitics@tennews.ai',
    name: 'Iran & Middle East Geopolitics',
    interests: [
      { label: 'Iran Conflict', keywords: ['iran', 'tehran', 'khamenei', 'irgc', 'iranian'] },
      { label: 'Israel Military', keywords: ['israel', 'idf', 'netanyahu', 'israeli', 'mossad'] },
      { label: 'Oil & Energy Crisis', keywords: ['oil', 'crude', 'opec', 'barrel', 'refinery', 'fuel', 'gasoline'] },
      { label: 'US Military', keywords: ['pentagon', 'troops', 'missile', 'submarine', 'navy', 'airstrike'] },
      { label: 'Gaza & Lebanon', keywords: ['gaza', 'hamas', 'hezbollah', 'ceasefire', 'lebanon', 'palestine'] },
    ],
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'US'],
    followedTopics: ['World', 'Politics'],
  },
  {
    email: 'test_sports_fan@tennews.ai',
    name: 'Sports Fanatic (F1 + Cricket + Football)',
    interests: [
      { label: 'Formula 1', keywords: ['f1', 'formula', 'russell', 'verstappen', 'hamilton', 'norris', 'leclerc', 'grand prix', 'qualifying'] },
      { label: 'Cricket T20', keywords: ['cricket', 't20', 'india', 'innings', 'wicket', 'batting', 'bowling', 'ipl'] },
      { label: 'Football/Soccer', keywords: ['chelsea', 'psg', 'premier league', 'champions league', 'football', 'soccer', 'goal', 'transfer'] },
      { label: 'NBA Basketball', keywords: ['nba', 'lebron', 'lakers', 'celtics', 'basketball', 'wnba', 'mitchell'] },
      { label: 'Tennis & Golf', keywords: ['tennis', 'golf', 'wimbledon', 'masters', 'nadal', 'djokovic', 'pga'] },
    ],
    homeCountry: 'US',
    followedCountries: ['US', 'UK', 'India'],
    followedTopics: ['Sports'],
  },
  {
    email: 'test_tech_ai@tennews.ai',
    name: 'Tech & AI Enthusiast',
    interests: [
      { label: 'AI & LLMs', keywords: ['ai', 'openai', 'chatgpt', 'claude', 'artificial intelligence', 'llm', 'gpt', 'gemini', 'copyright'] },
      { label: 'Big Tech', keywords: ['apple', 'google', 'microsoft', 'meta', 'nvidia', 'amazon', 'macbook'] },
      { label: 'Space & NASA', keywords: ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'asteroid', 'space'] },
      { label: 'Trump US Politics', keywords: ['trump', 'white house', 'congress', 'republican', 'democrat', 'tariff', 'executive order'] },
      { label: 'Cybersecurity', keywords: ['hack', 'cyber', 'breach', 'ransomware', 'privacy', 'data'] },
    ],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Politics'],
  },
  {
    email: 'test_entertainment_culture@tennews.ai',
    name: 'Entertainment & Pop Culture',
    interests: [
      { label: 'Movies & TV', keywords: ['movie', 'film', 'netflix', 'pixar', 'nolan', 'disney', 'hbo', 'streaming', 'box office', 'trailer'] },
      { label: 'Music & Celebrity', keywords: ['album', 'concert', 'grammy', 'tour', 'celebrity', 'singer', 'rapper', 'musician'] },
      { label: 'Health & Wellness', keywords: ['cancer', 'vaccine', 'alzheimer', 'drug', 'treatment', 'clinical', 'depression', 'mushroom', 'therapy'] },
      { label: 'Wall Street & Markets', keywords: ['wall street', 'stock', 'nasdaq', 'dow', 'market', 'plunge', 'rally', 'investor', 'shares'] },
      { label: 'Europe Politics', keywords: ['starmer', 'macron', 'eu', 'european', 'nato', 'germany', 'france', 'britain'] },
    ],
    homeCountry: 'UK',
    followedCountries: ['UK', 'US'],
    followedTopics: ['Entertainment', 'Health', 'Business'],
  },
  {
    email: 'test_turkey_ukraine@tennews.ai',
    name: 'Turkey & Ukraine Watcher',
    interests: [
      { label: 'Turkey Politics', keywords: ['turkey', 'turkish', 'erdogan', 'imamoglu', 'ankara', 'istanbul', 'cyprus'] },
      { label: 'Ukraine War', keywords: ['ukraine', 'zelensky', 'kyiv', 'crimea', 'drone', 'russia', 'putin', 'moscow'] },
      { label: 'China & Asia', keywords: ['china', 'beijing', 'wang yi', 'xi jinping', 'taiwan', 'japan', 'asia'] },
      { label: 'Women & Rights', keywords: ['women', 'feminist', 'gender', 'march', 'rights', 'protest', 'rally'] },
      { label: 'Climate & Environment', keywords: ['climate', 'wildfire', 'carbon', 'emission', 'flood', 'drought', 'environment'] },
    ],
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
  },
];

function averageEmbeddings(embeddings) {
  if (embeddings.length === 0) return null;
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) for (let i = 0; i < dim; i++) avg[i] += emb[i];
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += avg[i] * avg[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) avg[i] /= norm;
  return avg;
}

async function findArticlesForInterest(interest) {
  const twelveHoursAgo = new Date(Date.now() - 12 * 3600000).toISOString();
  const filters = interest.keywords.map(kw => `title_news.ilike.%${kw}%`).join(',');
  const { data, error } = await supabase
    .from('published_articles')
    .select('id, title_news, category, embedding, embedding_minilm')
    .or(filters)
    .gte('created_at', twelveHoursAgo)
    .not('embedding', 'is', null)
    .order('ai_final_score', { ascending: false })
    .limit(40);
  if (error) console.log(`    Search error for "${interest.label}": ${error.message}`);
  return data || [];
}

async function createTestUser(user) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating: ${user.name}`);
  console.log(`Interests: ${user.interests.map(i => i.label).join(' | ')}`);
  console.log('='.repeat(60));

  // 1. Get or create auth user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === user.email);
  let authUserId;
  if (existing) {
    authUserId = existing.id;
    console.log(`  Auth user exists: ${authUserId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email, password: 'TestUser123!', email_confirm: true,
      user_metadata: { full_name: user.name },
    });
    if (error) { console.error(`  Auth error: ${error.message}`); return null; }
    authUserId = data.user.id;
    console.log(`  Created auth: ${authUserId}`);
  }

  // 2. Find articles per interest
  const interestArticles = {};
  const allMatched = [];
  const seen = new Set();

  for (const interest of user.interests) {
    const articles = await findArticlesForInterest(interest);
    const unique = articles.filter(a => !seen.has(a.id));
    unique.forEach(a => seen.add(a.id));
    interestArticles[interest.label] = unique;
    allMatched.push(...unique.map(a => ({ ...a, interest: interest.label })));
    console.log(`  [${interest.label}]: ${unique.length} articles`);
    for (const a of unique.slice(0, 3)) {
      console.log(`    - ${a.title_news?.slice(0, 70)}`);
    }
  }

  if (allMatched.length === 0) {
    console.log('  No articles found!');
    return null;
  }

  // 3. Compute taste vectors — weight each interest equally
  const interestVectors = [];
  const interestMinilmVectors = [];

  for (const interest of user.interests) {
    const arts = interestArticles[interest.label];
    const gemini = arts.map(a => a.embedding).filter(e => Array.isArray(e) && e.length === 3072);
    const minilm = arts.map(a => a.embedding_minilm).filter(e => Array.isArray(e) && e.length === 384);
    if (gemini.length > 0) interestVectors.push(averageEmbeddings(gemini));
    if (minilm.length > 0) interestMinilmVectors.push(averageEmbeddings(minilm));
  }

  const tasteVector = averageEmbeddings(interestVectors.filter(Boolean));
  const tasteVectorMinilm = averageEmbeddings(interestMinilmVectors.filter(Boolean));

  console.log(`  Taste vector: ${tasteVector ? '3072D' : 'NONE'} | MiniLM: ${tasteVectorMinilm ? '384D' : 'NONE'}`);
  console.log(`  Total matched: ${allMatched.length} articles across ${user.interests.length} interests`);

  // 4. Build tag profile from matched articles
  const tagProfile = {};
  for (const article of allMatched) {
    if (article.category) {
      tagProfile[article.category] = Math.min((tagProfile[article.category] || 0) + 0.15, 1.0);
    }
    tagProfile[article.interest] = Math.min((tagProfile[article.interest] || 0) + 0.2, 1.0);
  }

  // 5. Upsert profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authUserId, email: user.email, full_name: user.name,
    taste_vector: tasteVector, taste_vector_minilm: tasteVectorMinilm,
    tag_profile: tagProfile, skip_profile: {}, similarity_floor: 0,
    home_country: user.homeCountry, followed_countries: user.followedCountries,
    followed_topics: user.followedTopics,
  }, { onConflict: 'id' });
  if (profileError) { console.error(`  Profile error: ${profileError.message}`); return null; }
  console.log(`  Profile saved. Tags: ${Object.keys(tagProfile).join(', ')}`);

  // 6. Insert engagement events (spread across interests)
  // First clear old events
  await supabase.from('user_article_events').delete().eq('user_id', authUserId);

  const events = [];
  for (const interest of user.interests) {
    for (const a of interestArticles[interest.label].slice(0, 5)) {
      events.push({
        user_id: authUserId, article_id: a.id,
        event_type: 'article_engaged', category: a.category,
        metadata: { dwell: String(5 + Math.random() * 20), interest: interest.label },
      });
    }
  }
  if (events.length > 0) {
    const { error } = await supabase.from('user_article_events').insert(events);
    if (error) console.error(`  Events error: ${error.message}`);
    else console.log(`  Inserted ${events.length} engagement events`);
  }

  return { userId: authUserId, email: user.email, name: user.name, interests: user.interests };
}

async function main() {
  console.log('Creating 5 Test Users — Interests Matched to ACTUAL 12-Hour Content\n');

  const created = [];
  for (const user of USERS) {
    const result = await createTestUser(user);
    if (result) created.push(result);
  }

  // Save IDs
  const userMap = {};
  for (const u of created) userMap[u.name] = u.userId;
  const fs = await import('fs');
  fs.writeFileSync('test_user_ids_v3.json', JSON.stringify(userMap, null, 2));

  console.log('\n\n' + '='.repeat(60));
  console.log('USER IDS (for test script):');
  console.log('='.repeat(60));
  for (const u of created) {
    console.log(`  ${u.name}: ${u.userId}`);
  }
  console.log('\nSaved to test_user_ids_v3.json');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

import { createClient } from '@supabase/supabase-js';
import https from 'https';

const API_BASE = 'https://www.tennews.ai';
const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 20000);
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timeout); try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', e => { clearTimeout(timeout); reject(e); });
  });
}

async function main() {
  // Topics: Soccer/Football (Galatasaray), AI & Machine Learning, Automotive
  const TOPICS = ['Soccer/Football', 'AI & Machine Learning', 'Automotive'];
  const TEST_USER_ID = '00000000-0000-0000-0000-000000099999';
  const EMAIL = 'test-niche-gala-ai-cars@tennews-test.com';

  console.log('=== NICHE USER FEED TEST ===');
  console.log(`Topics: ${TOPICS.join(', ')}`);
  console.log(`User ID: ${TEST_USER_ID}\n`);

  // Step 1: Create/upsert user in profiles table
  console.log('1. Creating test user...');

  // Delete existing data
  await db.from('user_article_events').delete().eq('user_id', TEST_USER_ID).then(() => {});
  await db.from('user_interest_clusters').delete().eq('user_id', TEST_USER_ID).then(() => {});

  // Create auth user or find existing one
  let actualUserId;
  const { data: authData, error: authCreateErr } = await db.auth.admin.createUser({
    email: EMAIL,
    password: 'TestNiche2024!',
    email_confirm: true,
  });
  if (authData?.user?.id) {
    actualUserId = authData.user.id;
    console.log(`   Created new auth user: ${actualUserId}`);
  } else {
    // User already exists — find by email
    const { data: existingUsers } = await db.auth.admin.listUsers();
    const found = existingUsers?.users?.find(u => u.email === EMAIL);
    if (found) {
      actualUserId = found.id;
      console.log(`   Found existing auth user: ${actualUserId}`);
    } else {
      console.error('Cannot find or create user');
      return;
    }
  }

  // Clear old data
  await db.from('user_article_events').delete().eq('user_id', actualUserId).then(() => {});
  await db.from('user_interest_clusters').delete().eq('user_id', actualUserId).then(() => {});

  const { error: profileErr } = await db.from('profiles').update({
    home_country: 'turkey',
    followed_countries: ['turkey', 'usa'],
    followed_topics: TOPICS,
    tag_profile: null,
    taste_vector: null,
    skip_profile: null,
    category_profile: null,
    discovery_stats: null,
    similarity_floor: null,
  }).eq('id', actualUserId);

  if (profileErr) {
    console.error('Profile update error:', profileErr);
  }
  console.log('   User created/updated.\n');

  // Step 2: Call the feed API
  console.log('2. Calling feed API...');
  const feedUrl = `${API_BASE}/api/feed/main?user_id=${actualUserId}&limit=25`;
  console.log(`   URL: ${feedUrl}\n`);

  let feedData;
  try {
    feedData = await httpGet(feedUrl);
  } catch (e) {
    console.error('Feed API error:', e.message);

    // Try with query params instead
    console.log('\n   Retrying with query params...');
    const fallbackUrl = `${API_BASE}/api/feed/main?home_country=turkey&followed_countries=turkey,usa&followed_topics=${encodeURIComponent(TOPICS.join(','))}&limit=25`;
    console.log(`   URL: ${fallbackUrl}\n`);
    feedData = await httpGet(fallbackUrl);
  }

  if (!feedData || !feedData.articles) {
    console.error('No articles returned:', JSON.stringify(feedData).substring(0, 500));
    return;
  }

  // Step 3: Analyze the feed
  const articles = feedData.articles;
  console.log(`3. Feed returned ${articles.length} articles\n`);

  // Category breakdown
  const catCounts = {};
  const tagCounts = {};
  const bucketCounts = {};

  for (const a of articles) {
    const cat = a.category || 'Unknown';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    bucketCounts[a.bucket || 'unknown'] = (bucketCounts[a.bucket || 'unknown'] || 0) + 1;

    const tags = Array.isArray(a.interest_tags) ? a.interest_tags : [];
    for (const t of tags) {
      tagCounts[t.toLowerCase()] = (tagCounts[t.toLowerCase()] || 0) + 1;
    }
  }

  console.log('── CATEGORY BREAKDOWN ──');
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const pct = ((count / articles.length) * 100).toFixed(0);
    console.log(`   ${cat}: ${count} (${pct}%)`);
  }

  console.log('\n── BUCKET BREAKDOWN ──');
  for (const [bucket, count] of Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${bucket}: ${count}`);
  }

  // Interest tag matches
  const interestTags = new Set([
    'soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga',
    'serie a', 'mls', 'fifa', 'world cup',
    'ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm',
    'automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'
  ]);

  let matchCount = 0;
  for (const a of articles) {
    const tags = Array.isArray(a.interest_tags) ? a.interest_tags.map(t => t.toLowerCase()) : [];
    const hasMatch = tags.some(t => interestTags.has(t));
    if (hasMatch) matchCount++;
  }
  console.log(`\n── INTEREST MATCH ──`);
  console.log(`   ${matchCount}/${articles.length} articles match user interests (${((matchCount/articles.length)*100).toFixed(0)}%)\n`);

  // Top tags
  console.log('── TOP 15 TAGS IN FEED ──');
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [tag, count] of sortedTags) {
    const marker = interestTags.has(tag) ? ' ★' : '';
    console.log(`   ${tag}: ${count}${marker}`);
  }

  // Article list
  console.log('\n── ARTICLE LIST ──');
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const tags = Array.isArray(a.interest_tags) ? a.interest_tags.slice(0, 3).join(', ') : '';
    const match = (Array.isArray(a.interest_tags) ? a.interest_tags : [])
      .some(t => interestTags.has(t.toLowerCase())) ? '★' : ' ';
    console.log(`   ${(i+1).toString().padStart(2)}. ${match} [${a.category}] ${(a.title || a.title_news || '').substring(0, 70)} | ${a.bucket || '?'} | tags: ${tags}`);
  }

  // Step 4: Also check what content EXISTS for these topics
  console.log('\n\n── CONTENT AVAILABILITY CHECK ──');

  const soccerCount = await db.from('published_articles')
    .select('id', { count: 'exact', head: true })
    .ilike('interest_tags', '%soccer%')
    .gte('created_at', new Date(Date.now() - 30*86400000).toISOString());

  const aiCount = await db.from('published_articles')
    .select('id', { count: 'exact', head: true })
    .or('interest_tags.ilike.%artificial intelligence%,interest_tags.ilike.%machine learning%,interest_tags.ilike.%ai%')
    .gte('created_at', new Date(Date.now() - 30*86400000).toISOString());

  const autoCount = await db.from('published_articles')
    .select('id', { count: 'exact', head: true })
    .or('interest_tags.ilike.%automotive%,interest_tags.ilike.%tesla%,interest_tags.ilike.%electric vehicles%')
    .gte('created_at', new Date(Date.now() - 30*86400000).toISOString());

  const iranCount = await db.from('published_articles')
    .select('id', { count: 'exact', head: true })
    .ilike('interest_tags', '%iran%')
    .gte('created_at', new Date(Date.now() - 30*86400000).toISOString());

  console.log(`   Soccer articles (30d):     ${soccerCount.count}`);
  console.log(`   AI/ML articles (30d):      ${aiCount.count}`);
  console.log(`   Automotive articles (30d):  ${autoCount.count}`);
  console.log(`   Iran articles (30d):        ${iranCount.count}`);

  // Step 5: Check what the tag_profile was seeded to
  console.log('\n── SEEDED TAG PROFILE (after feed call) ──');
  const { data: profile } = await db.from('profiles')
    .select('tag_profile, followed_topics')
    .eq('id', actualUserId)
    .single();

  if (profile?.tag_profile) {
    const tp = profile.tag_profile;
    const entries = Object.entries(tp).filter(([k]) => !k.startsWith('_')).sort((a, b) => b[1] - a[1]);
    console.log(`   ${entries.length} tags seeded:`);
    for (const [tag, weight] of entries.slice(0, 20)) {
      console.log(`   ${tag}: ${weight}`);
    }
  } else {
    console.log('   (no tag_profile found — seeding may not have triggered)');
  }
  console.log(`   followed_topics: ${JSON.stringify(profile?.followed_topics)}`);
}

main().catch(console.error);

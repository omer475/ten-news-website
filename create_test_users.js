/**
 * Create 6 test users with 4-5 distinct interests each. No overlap between users.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 6 users — each with 4-5 DISTINCT interests, minimal overlap
const USERS = [
  {
    email: 'test_galatasaray@tennews.ai',
    name: 'Turkish Football & Culture Fan',
    interests: [
      { label: 'Turkish Football', keywords: ['galatasaray', 'fenerbahce', 'besiktas', 'süper lig', 'turkish football'] },
      { label: 'Turkish Politics', keywords: ['erdogan', 'ankara', 'turkish parliament', 'imamoglu', 'chp'] },
      { label: 'Istanbul Life', keywords: ['istanbul', 'bosphorus', 'turkish'] },
      { label: 'Women Rights', keywords: ['women', 'feminist', 'gender', 'march'] },
      { label: 'Mediterranean', keywords: ['mediterranean', 'greece', 'cyprus', 'aegean'] },
    ],
    categories: ['Sports', 'Politics', 'World'],
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Greece'],
    followedTopics: ['Sports', 'Politics'],
  },
  {
    email: 'test_f1@tennews.ai',
    name: 'F1 & Automotive Enthusiast',
    interests: [
      { label: 'Formula 1', keywords: ['f1', 'formula', 'verstappen', 'hamilton', 'leclerc', 'norris', 'grand prix'] },
      { label: 'Automotive', keywords: ['tesla', 'electric vehicle', 'ev', 'car', 'automotive', 'bmw', 'mercedes'] },
      { label: 'Aviation', keywords: ['boeing', 'airbus', 'aviation', 'airline', 'flight', 'pilot'] },
      { label: 'UK News', keywords: ['uk', 'britain', 'london', 'starmer', 'parliament', 'nhs'] },
    ],
    categories: ['Sports', 'Business', 'Tech'],
    homeCountry: 'UK',
    followedCountries: ['UK', 'Italy', 'Germany'],
    followedTopics: ['Sports', 'Business', 'Tech'],
  },
  {
    email: 'test_ai@tennews.ai',
    name: 'Silicon Valley AI Geek',
    interests: [
      { label: 'AI & LLMs', keywords: ['openai', 'chatgpt', 'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini'] },
      { label: 'Big Tech', keywords: ['apple', 'google', 'microsoft', 'meta', 'amazon', 'nvidia'] },
      { label: 'Cybersecurity', keywords: ['hack', 'cyber', 'breach', 'security', 'ransomware', 'privacy'] },
      { label: 'Startups', keywords: ['startup', 'venture', 'ipo', 'valuation', 'funding', 'unicorn'] },
      { label: 'Robotics', keywords: ['robot', 'autonomous', 'drone', 'automation'] },
    ],
    categories: ['Tech', 'Business', 'Science'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Business'],
  },
  {
    email: 'test_finance@tennews.ai',
    name: 'Wall Street & Commodities Trader',
    interests: [
      { label: 'Oil & Energy Markets', keywords: ['oil', 'crude', 'opec', 'barrel', 'refinery', 'fuel', 'gasoline'] },
      { label: 'Stock Market', keywords: ['stock', 'nasdaq', 'dow', 'sp500', 'wall street', 'rally', 'plunge'] },
      { label: 'Crypto & DeFi', keywords: ['bitcoin', 'crypto', 'ethereum', 'stablecoin', 'defi', 'blockchain'] },
      { label: 'Central Banks', keywords: ['fed', 'interest rate', 'inflation', 'central bank', 'treasury', 'bond', 'boj'] },
      { label: 'Real Estate', keywords: ['housing', 'mortgage', 'real estate', 'property', 'rent'] },
    ],
    categories: ['Finance', 'Business', 'Crypto', 'Economy'],
    homeCountry: 'US',
    followedCountries: ['US', 'UK', 'Japan'],
    followedTopics: ['Finance', 'Business', 'Economy'],
  },
  {
    email: 'test_mideast@tennews.ai',
    name: 'War & Defense Analyst',
    interests: [
      { label: 'Iran-Israel Conflict', keywords: ['iran', 'israel', 'tehran', 'netanyahu', 'khamenei', 'irgc'] },
      { label: 'Russia-Ukraine War', keywords: ['ukraine', 'russia', 'zelensky', 'putin', 'crimea', 'donbas', 'kyiv'] },
      { label: 'Military Operations', keywords: ['military', 'missile', 'strike', 'bomb', 'airstrike', 'navy', 'submarine'] },
      { label: 'NATO & Alliances', keywords: ['nato', 'pentagon', 'defense', 'alliance', 'troops', 'deployment'] },
      { label: 'Gaza & Palestine', keywords: ['gaza', 'palestine', 'hamas', 'hezbollah', 'ceasefire', 'west bank'] },
    ],
    categories: ['World', 'Politics'],
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
  },
  {
    email: 'test_space@tennews.ai',
    name: 'Green Science & Space Explorer',
    interests: [
      { label: 'Space Exploration', keywords: ['spacex', 'nasa', 'rocket', 'satellite', 'orbit', 'mars', 'astronaut', 'asteroid'] },
      { label: 'Climate Change', keywords: ['climate', 'carbon', 'emission', 'warming', 'temperature', 'glacier'] },
      { label: 'Renewable Energy', keywords: ['solar', 'wind', 'renewable', 'battery', 'nuclear', 'hydrogen'] },
      { label: 'Medical Research', keywords: ['cancer', 'vaccine', 'alzheimer', 'drug', 'clinical trial', 'treatment', 'disease'] },
      { label: 'Ocean & Marine', keywords: ['ocean', 'marine', 'whale', 'reef', 'fishing', 'sea level'] },
    ],
    categories: ['Science', 'Health', 'Tech', 'Climate'],
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Science', 'Health', 'Climate'],
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
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 3600000).toISOString();
  const filters = interest.keywords.map(kw => `title_news.ilike.%${kw}%`).join(',');
  const { data, error } = await supabase
    .from('published_articles')
    .select('id, title_news, category, embedding, embedding_minilm')
    .or(filters)
    .gte('created_at', seventyTwoHoursAgo)
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
    console.log(`  Auth user: ${authUserId}`);
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
      console.log(`    - ${a.title_news?.slice(0, 60)}`);
    }
  }

  if (allMatched.length === 0) {
    console.log('  No articles found at all!');
    return null;
  }

  // 3. Compute taste vector — weight each interest's articles equally
  // For each interest, average its embeddings, then average across interests
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
  console.log(`  Total matched articles: ${allMatched.length} across ${user.interests.length} interests`);

  // 4. Build tag profile
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
  console.log(`  Profile saved`);

  // 6. Create interest clusters — one per interest topic
  await supabase.from('user_interest_clusters').delete().eq('user_id', authUserId);

  let ci = 0;
  for (const interest of user.interests) {
    if (ci >= 5) break;
    const arts = interestArticles[interest.label];
    const embs = arts.map(a => a.embedding).filter(e => Array.isArray(e) && e.length === 3072);
    const minilmE = arts.map(a => a.embedding_minilm).filter(e => Array.isArray(e) && e.length === 384);
    if (embs.length === 0) continue;

    const { error } = await supabase.from('user_interest_clusters').insert({
      user_id: authUserId, cluster_index: ci,
      medoid_embedding: averageEmbeddings(embs),
      medoid_minilm: minilmE.length > 0 ? averageEmbeddings(minilmE) : null,
      medoid_article_id: arts[0].id, article_count: arts.length,
      label: interest.label,
    });
    if (error) console.error(`  Cluster "${interest.label}" error: ${error.message}`);
    else console.log(`  Cluster ${ci}: ${interest.label} (${arts.length} articles)`);
    ci++;
  }

  // 7. Insert engagement events (spread across interests)
  const events = [];
  for (const interest of user.interests) {
    for (const a of interestArticles[interest.label].slice(0, 5)) {
      events.push({
        user_id: authUserId, article_id: a.id,
        event_type: 'article_engaged', category: a.category,
        metadata: { dwell: '8.0', interest: interest.label },
      });
    }
  }
  if (events.length > 0) {
    const { error } = await supabase.from('user_article_events').insert(events);
    if (error) console.error(`  Events error: ${error.message}`);
    else console.log(`  Inserted ${events.length} engagement events across ${user.interests.length} interests`);
  }

  return { userId: authUserId, ...user };
}

async function main() {
  console.log('Creating 6 Users with 4-5 Distinct Interests Each\n');

  const created = [];
  for (const user of USERS) {
    const result = await createTestUser(user);
    if (result) created.push(result);
  }

  // Verification
  console.log('\n\n' + '='.repeat(60));
  console.log('VERIFICATION');
  console.log('='.repeat(60));
  for (const u of created) {
    const { data: p } = await supabase.from('profiles')
      .select('id, full_name, taste_vector, taste_vector_minilm, tag_profile')
      .eq('id', u.userId).single();
    const { count: clusters } = await supabase.from('user_interest_clusters')
      .select('id', { count: 'exact', head: true }).eq('user_id', u.userId);
    const { count: events } = await supabase.from('user_article_events')
      .select('id', { count: 'exact', head: true }).eq('user_id', u.userId);

    const hasTaste = Array.isArray(p?.taste_vector) && p.taste_vector.length === 3072;
    const tags = p?.tag_profile ? Object.keys(p.tag_profile) : [];

    console.log(`\n${p?.full_name}:`);
    console.log(`  taste=${hasTaste ? '3072D' : 'NONE'} clusters=${clusters} events=${events}`);
    console.log(`  tags: ${tags.join(', ')}`);
  }

  // Save IDs
  const userMap = {};
  for (const u of created) userMap[u.name] = u.userId;
  const fs = await import('fs');
  fs.writeFileSync('test_user_ids.json', JSON.stringify(userMap, null, 2));
  console.log('\nUser IDs saved to test_user_ids.json');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

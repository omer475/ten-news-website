/**
 * Personalization test: simulates a user reading sports/football articles
 * and checks if the feed adapts.
 *
 * Usage: USER_NUM=1 READING_TOPIC=Sports node test_personalization.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const USER_NUM = parseInt(process.env.USER_NUM || '1');
const READING_TOPIC = process.env.READING_TOPIC || 'Sports';
const TEST_EMAIL = `test_personalization_${USER_NUM}@test.tennews.ai`;
const TEST_PASSWORD = 'TestPass123!';

async function main() {
  console.log(`\n=== USER ${USER_NUM}: Preferences=Turkiye,AI,Science | Reading=${READING_TOPIC} ===\n`);

  // 1. Create or get test user
  let userId;
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('home_country', 'turkiye')
    .ilike('id', `%test-user-${USER_NUM}%`)
    .single();

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Using existing user: ${userId.substring(0, 8)}`);
  } else {
    // Create via auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      // Try to find existing auth user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users?.find(u => u.email === TEST_EMAIL);
      if (existing) {
        userId = existing.id;
        console.log(`Found existing auth user: ${userId.substring(0, 8)}`);
      } else {
        console.error('Failed to create user:', authError.message);
        process.exit(1);
      }
    } else {
      userId = authData.user.id;
      console.log(`Created user: ${userId.substring(0, 8)}`);
    }

    // Set up profile with Turkiye, AI, Science preferences
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: TEST_EMAIL,
        home_country: 'turkiye',
        followed_countries: ['TR'],
        followed_topics: ['technology', 'science'],
        onboarding_completed: true,
      });
    if (upsertErr) {
      console.error('Profile upsert error:', upsertErr.message);
    } else {
      console.log('Set preferences: home=turkiye, topics=[technology, science]');
    }
  }

  // Verify profile exists
  const { data: verifyProfile, error: verifyErr } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single();
  if (verifyErr || !verifyProfile) {
    console.error('FATAL: Profile does not exist after upsert!', verifyErr?.message);
    process.exit(1);
  }
  console.log('Profile verified:', verifyProfile.email);

  // Clear any existing taste vector to start fresh
  const { error: clearErr } = await supabase
    .from('profiles')
    .update({ taste_vector: null, taste_vector_version: 0 })
    .eq('id', userId);
  if (clearErr) {
    console.error('Clear taste vector error:', clearErr.message);
  } else {
    console.log('Cleared taste vector for fresh test');
  }

  // 2. Get BEFORE feed (no taste vector — should use tag-based scoring)
  const beforeFeed = await fetchFeed(userId);
  console.log(`\nBEFORE reading ${READING_TOPIC} (tag-based scoring):`);
  printFeedSummary(beforeFeed);

  // 3. Find articles to "read" based on reading topic
  const topicFilter = READING_TOPIC === 'Sports' ? 'Sports' : READING_TOPIC;
  const { data: targetArticles } = await supabase
    .from('published_articles')
    .select('id, title_news, category, embedding')
    .eq('category', topicFilter)
    .order('created_at', { ascending: false })
    .limit(50);

  const articlesWithEmbeddings = (targetArticles || []).filter(a => a.embedding && a.embedding.length > 0);
  console.log(`\nFound ${articlesWithEmbeddings.length} ${READING_TOPIC} articles with embeddings`);

  if (articlesWithEmbeddings.length === 0) {
    console.log('No articles with embeddings found. Trying to read without embeddings...');
    // Still simulate reading — taste vector seeding happens server-side
  }

  // 4. Simulate reading 30 articles
  const toRead = articlesWithEmbeddings.slice(0, 30);
  console.log(`\nSimulating reading ${toRead.length} ${READING_TOPIC} articles...`);

  for (let i = 0; i < toRead.length; i++) {
    const article = toRead[i];

    // Insert article_exit event with 30+ seconds (triggers lr=0.20)
    const { error } = await supabase
      .from('user_article_events')
      .insert({
        user_id: userId,
        event_type: 'article_exit',
        article_id: article.id,
        view_seconds: 35,
        metadata: { total_active_seconds: '35' },
      });

    if (error) {
      console.log(`  Error recording read for article ${article.id}: ${error.message}`);
      continue;
    }

    // Manually evolve taste vector (same logic as analytics endpoint)
    await evolveTasteVector(userId, article.id, 0.20);

    if ((i + 1) % 10 === 0) {
      console.log(`  Read ${i + 1}/${toRead.length} articles`);
    }
  }

  // 5. Check taste vector was created
  const { data: profile } = await supabase
    .from('profiles')
    .select('taste_vector_version')
    .eq('id', userId)
    .single();
  console.log(`\nTaste vector version: ${profile?.taste_vector_version || 'NONE'}`);

  // 6. Get AFTER feed (should now use embedding scoring)
  const afterFeed = await fetchFeed(userId);
  console.log(`\nAFTER reading ${toRead.length} ${READING_TOPIC} articles (embedding scoring):`);
  printFeedSummary(afterFeed);

  // 7. Compare
  console.log('\n=== COMPARISON ===');
  const beforeSportsCount = countCategory(beforeFeed, 'Sports');
  const afterSportsCount = countCategory(afterFeed, 'Sports');
  const beforeSportsTop10 = countCategoryInTop(beforeFeed, 'Sports', 10);
  const afterSportsTop10 = countCategoryInTop(afterFeed, 'Sports', 10);

  console.log(`Sports in top 20: BEFORE=${beforeSportsCount} → AFTER=${afterSportsCount}`);
  console.log(`Sports in top 10: BEFORE=${beforeSportsTop10} → AFTER=${afterSportsTop10}`);
  console.log(`Scoring method: ${afterFeed[0]?.scoring_method || 'unknown'}`);

  const improved = afterSportsTop10 > beforeSportsTop10 || afterSportsCount > beforeSportsCount;
  console.log(`\nResult: ${improved ? 'PASS - Sports articles rose in feed' : 'NEEDS INVESTIGATION - No clear improvement'}`);
}

async function fetchFeed(userId) {
  const url = `https://www.tennews.ai/api/feed/main?limit=20&user_id=${userId}`;
  const resp = await fetch(url);
  const data = await resp.json();
  return data.articles || [];
}

function printFeedSummary(articles) {
  const categories = {};
  articles.forEach((a, i) => {
    const cat = a.category || 'Unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('  Category distribution:', JSON.stringify(categories));
  console.log('  Top 5 articles:');
  articles.slice(0, 5).forEach((a, i) => {
    console.log(`    ${i + 1}. [${a.category}] ${(a.title || '').substring(0, 60)} (score: ${a.final_score}, method: ${a.scoring_method || '?'})`);
  });
}

function countCategory(articles, category) {
  return articles.filter(a => a.category === category).length;
}

function countCategoryInTop(articles, category, n) {
  return articles.slice(0, n).filter(a => a.category === category).length;
}

async function evolveTasteVector(userId, articleId, learningRate) {
  // Fetch current taste vector
  const { data: profile } = await supabase
    .from('profiles')
    .select('taste_vector, taste_vector_version')
    .eq('id', userId)
    .single();

  // Fetch article embedding
  const { data: article } = await supabase
    .from('published_articles')
    .select('embedding')
    .eq('id', articleId)
    .single();

  if (!article?.embedding || !Array.isArray(article.embedding) || article.embedding.length === 0) {
    return;
  }

  const articleVector = article.embedding;

  // Seed if no taste vector
  if (!profile?.taste_vector || !Array.isArray(profile.taste_vector) || profile.taste_vector.length === 0) {
    await supabase
      .from('profiles')
      .update({
        taste_vector: articleVector,
        taste_vector_version: 1,
        taste_vector_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return;
  }

  // Evolve: newVector = (1-lr)*current + lr*article
  const currentVector = profile.taste_vector;
  if (currentVector.length !== articleVector.length) return;

  const newVector = currentVector.map((v, i) =>
    (1 - learningRate) * v + learningRate * articleVector[i]
  );

  const newVersion = (profile.taste_vector_version || 1) + 1;
  await supabase
    .from('profiles')
    .update({
      taste_vector: newVector,
      taste_vector_version: newVersion,
      taste_vector_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

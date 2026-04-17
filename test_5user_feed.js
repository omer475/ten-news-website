/**
 * 5-User Feed Personalization Test
 * Tests with interests derived from actual articles in the last 4 hours.
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { randomUUID } = require('crypto');

// 5 users with distinct multi-interest profiles matched to actual content
const TEST_USERS = [
  {
    name: 'US Politics & Finance Guy',
    interests: ['donald trump', 'politics', 'finance', 'united states', 'government', 'stock_markets', 'banking'],
    tagProfile: { 'donald trump': 0.95, 'politics': 0.90, 'finance': 0.85, 'united states': 0.80, 'government': 0.75, 'us': 0.70, 'business': 0.50, 'banking': 0.45 },
    home_country: 'usa',
    followed_countries: ['usa'],
    followed_topics: ['politics', 'finance', 'stock_markets', 'economics'],
  },
  {
    name: 'Euro Football & Motorsport Fan',
    interests: ['soccer', 'football', 'bundesliga', 'formula 1', 'motorsport', 'sports', 'rugby'],
    tagProfile: { 'soccer': 0.95, 'football': 0.90, 'bundesliga': 0.85, 'formula 1': 0.80, 'motorsport': 0.75, 'sports': 0.70, 'rugby': 0.50 },
    home_country: 'uk',
    followed_countries: ['uk', 'germany', 'spain', 'italy'],
    followed_topics: ['football', 'f1', 'sports', 'rugby'],
  },
  {
    name: 'Middle East & Conflict Watcher',
    interests: ['iran', 'middle east', 'israel', 'military', 'geopolitics', 'ukraine', 'russia', 'turkey', 'drones', 'defense'],
    tagProfile: { 'iran': 0.95, 'middle east': 0.90, 'israel': 0.85, 'military': 0.80, 'geopolitics': 0.75, 'ukraine': 0.70, 'russia': 0.65, 'turkey': 0.55, 'drones': 0.50, 'defense': 0.45 },
    home_country: 'turkiye',
    followed_countries: ['turkiye', 'israel', 'russia', 'ukraine'],
    followed_topics: ['geopolitics', 'conflicts', 'human_rights'],
  },
  {
    name: 'Tech & AI Nerd',
    interests: ['artificial intelligence', 'tech', 'gaming', 'cybersecurity', 'streaming', 'space', 'nuclear energy'],
    tagProfile: { 'artificial intelligence': 0.95, 'tech': 0.90, 'gaming': 0.85, 'cybersecurity': 0.80, 'streaming': 0.70, 'space': 0.65, 'nuclear energy': 0.50, 'science': 0.40 },
    home_country: 'usa',
    followed_countries: ['usa', 'japan', 'south_korea'],
    followed_topics: ['tech_industry', 'ai', 'consumer_tech', 'gaming', 'cybersecurity', 'space'],
  },
  {
    name: 'India Entertainment & Culture',
    interests: ['india', 'entertainment', 'film', 'cricket', 'health', 'food', 'women\'s rights', 'gender equality'],
    tagProfile: { 'india': 0.95, 'entertainment': 0.90, 'film': 0.85, 'cricket': 0.80, 'health': 0.70, 'food': 0.65, 'women\'s rights': 0.55, 'gender equality': 0.50 },
    home_country: 'india',
    followed_countries: ['india', 'australia', 'uk'],
    followed_topics: ['entertainment', 'cricket', 'health', 'food_industry'],
  },
];

async function main() {
  const cutoff4h = new Date(Date.now() - 4 * 3600000).toISOString();

  // 1. Fetch articles from last 4 hours
  console.log('Fetching articles from last 4 hours...');
  const { data: allArticles, error: fetchErr } = await supabase
    .from('published_articles')
    .select('id, title_news, category, interest_tags, ai_final_score, topics, countries, created_at')
    .gte('created_at', cutoff4h)
    .order('ai_final_score', { ascending: false })
    .limit(500);

  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }
  console.log(`Found ${allArticles.length} articles\n`);

  // 2. Create test users with taste vectors
  const userIds = [];

  for (let idx = 0; idx < TEST_USERS.length; idx++) {
    const user = TEST_USERS[idx];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Setting up USER ${idx + 1}: ${user.name}`);
    console.log(`  Interests: ${user.interests.join(', ')}`);
    console.log(`  Countries: ${user.followed_countries.join(', ')}`);
    console.log(`  Topics: ${user.followed_topics.join(', ')}`);
    console.log(`${'='.repeat(60)}`);

    // Find matching articles — use ONLY interest tags (not country) for taste vector
    // Country-based matching floods the vector with irrelevant articles
    const matchingArticles = allArticles.filter(a => {
      const tags = (a.interest_tags || []).map(t => t.toLowerCase());
      return user.interests.some(i => tags.includes(i.toLowerCase()));
    });
    console.log(`  Matching articles (by interest tags only): ${matchingArticles.length}/${allArticles.length}`);

    // Show top 5 matches
    for (const a of matchingArticles.slice(0, 5)) {
      console.log(`    [${a.category}] (${a.ai_final_score}) ${a.title_news?.substring(0, 65)}`);
    }

    // Fetch embeddings for matching articles
    const matchIds = matchingArticles.slice(0, 25).map(a => a.id);
    const { data: embData } = await supabase
      .from('published_articles')
      .select('id, embedding_minilm')
      .in('id', matchIds)
      .not('embedding_minilm', 'is', null);

    const embeddings = (embData || [])
      .map(a => {
        let emb = a.embedding_minilm;
        if (typeof emb === 'string') try { emb = JSON.parse(emb); } catch { emb = null; }
        return emb;
      })
      .filter(e => Array.isArray(e) && e.length > 0);

    if (embeddings.length === 0) {
      console.log('  ⚠️ No embeddings found, skipping user');
      continue;
    }

    // Compute average embedding (taste vector)
    const dim = embeddings[0].length;
    const avgEmb = new Array(dim).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) avgEmb[i] += emb[i];
    }
    for (let i = 0; i < dim; i++) avgEmb[i] /= embeddings.length;
    // Normalize
    const norm = Math.sqrt(avgEmb.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let i = 0; i < dim; i++) avgEmb[i] /= norm;

    console.log(`  Taste vector: ${dim}-dim from ${embeddings.length} articles`);

    const userId = randomUUID();
    userIds.push({ id: userId, ...user });

    // Insert into users table
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: `test-${userId.substring(0, 8)}@tennews-test.com`,
        taste_vector_minilm: avgEmb,
        skip_profile: {},
        home_country: user.home_country,
        followed_countries: user.followed_countries,
        followed_topics: user.followed_topics,
      }, { onConflict: 'id' });

    if (upsertErr) { console.error(`  ❌ Users insert error:`, upsertErr); continue; }

    // Try profiles table too (for tag_profile)
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: `test-${userId.substring(0, 8)}@tennews-test.com`,
        tag_profile: user.tagProfile,
        taste_vector_minilm: avgEmb,
        skip_profile: {},
        home_country: user.home_country,
        followed_countries: user.followed_countries,
        followed_topics: user.followed_topics,
      }, { onConflict: 'id' });

    if (profileErr) console.log(`  (profiles table: ${profileErr.message})`);
    else console.log(`  ✅ Created with tag_profile`);
  }

  // 3. Clear feed state
  for (const u of userIds) {
    await supabase.from('user_article_events').delete().eq('user_id', u.id);
    await supabase.from('user_feed_impressions').delete().eq('user_id', u.id);
  }

  // 4. Test feed for each user
  console.log('\n\n' + '='.repeat(80));
  console.log('FEED RESULTS');
  console.log('='.repeat(80));

  const apiBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://tennews.app';
  const allFeeds = [];

  for (const u of userIds) {
    const url = `${apiBase}/api/feed/main?user_id=${u.id}&limit=20`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`USER: ${u.name}`);
    console.log(`  Interests: ${u.interests.slice(0, 5).join(', ')}`);
    console.log(`  Countries: ${u.followed_countries.join(', ')}  |  Topics: ${u.followed_topics.join(', ')}`);
    console.log(`${'─'.repeat(70)}`);

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) { console.log(`  ❌ ${data.error}`); continue; }

      const articles = data.articles || [];
      const feedType = data.feedType || 'unknown';
      console.log(`  Feed type: ${feedType}  |  Articles: ${articles.length}`);
      if (data.debug?.bucketBreakdown) console.log(`  Buckets: ${JSON.stringify(data.debug.bucketBreakdown)}`);

      const catDist = {};
      const articleList = [];

      for (let i = 0; i < articles.length; i++) {
        const a = articles[i];
        catDist[a.category] = (catDist[a.category] || 0) + 1;
        const tags = (a.interest_tags || []).map(t => t.toLowerCase());
        const matched = u.interests.filter(int => tags.includes(int.toLowerCase()));
        const matchStr = matched.length > 0 ? ` ← MATCH[${matched.join(',')}]` : '';
        const bucket = (a._bucket || a.bucket || '?').substring(0, 5).padEnd(5);
        console.log(`  ${(i + 1).toString().padStart(2)}. [${bucket}] [${(a.category || '?').padEnd(14)}] (${String(a.ai_final_score || '?').padStart(3)}) ${(a.title_news || a.title || '').substring(0, 55)}${matchStr}`);
        articleList.push(a);
      }

      // Stats
      let interestMatchCount = 0;
      let countryMatchCount = 0;
      let topicMatchCount = 0;
      for (const a of articles) {
        const tags = (a.interest_tags || []).map(t => t.toLowerCase());
        const countries = a.countries || [];
        const topics = a.topics || [];
        if (u.interests.some(i => tags.includes(i.toLowerCase()))) interestMatchCount++;
        if (u.followed_countries.some(c => countries.includes(c))) countryMatchCount++;
        if (u.followed_topics.some(t => topics.includes(t))) topicMatchCount++;
      }

      console.log(`\n  Categories: ${Object.entries(catDist).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k}:${v}`).join(', ')}`);
      console.log(`  Interest match: ${interestMatchCount}/${articles.length} (${Math.round(interestMatchCount / Math.max(articles.length, 1) * 100)}%)`);
      console.log(`  Country match: ${countryMatchCount}/${articles.length} (${Math.round(countryMatchCount / Math.max(articles.length, 1) * 100)}%)`);
      console.log(`  Topic match: ${topicMatchCount}/${articles.length} (${Math.round(topicMatchCount / Math.max(articles.length, 1) * 100)}%)`);

      allFeeds.push({ name: u.name, feedType, articles: articleList, interestMatchCount, countryMatchCount, topicMatchCount });
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  // 5. Cross-user comparison
  console.log('\n\n' + '='.repeat(80));
  console.log('PERSONALIZATION COMPARISON');
  console.log('='.repeat(80));

  // Overlap matrix
  for (let i = 0; i < allFeeds.length; i++) {
    for (let j = i + 1; j < allFeeds.length; j++) {
      const aIds = new Set(allFeeds[i].articles.map(a => a.id));
      const bIds = new Set(allFeeds[j].articles.map(a => a.id));
      const overlap = [...aIds].filter(x => bIds.has(x)).length;
      const total = Math.max(aIds.size, bIds.size);
      console.log(`  ${allFeeds[i].name.substring(0, 28).padEnd(28)} vs ${allFeeds[j].name.substring(0, 28).padEnd(28)} → overlap: ${overlap}/${total} (${Math.round(overlap / Math.max(total, 1) * 100)}%)`);
    }
  }

  console.log('\n  Summary:');
  for (const f of allFeeds) {
    const total = f.articles.length;
    console.log(`  ${f.name.padEnd(35)} feed=${f.feedType.padEnd(10)} interest=${f.interestMatchCount}/${total}  country=${f.countryMatchCount}/${total}  topic=${f.topicMatchCount}/${total}`);
  }

  // 6. Cleanup
  console.log('\n\nCleaning up test users...');
  for (const u of userIds) {
    await supabase.from('user_article_events').delete().eq('user_id', u.id);
    await supabase.from('user_feed_impressions').delete().eq('user_id', u.id);
    await supabase.from('profiles').delete().eq('id', u.id);
    await supabase.from('users').delete().eq('id', u.id);
  }
  console.log('Done.');
}

main().catch(e => console.error('Fatal:', e));

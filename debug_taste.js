const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Find test user 1
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users?.users?.find(u => u.email?.includes('test_personalization_1'));
  if (!testUser) { console.log('No test user found'); return; }
  const uid = testUser.id;
  console.log('User:', uid.substring(0, 8));

  // Check current profile
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, taste_vector, taste_vector_version')
    .eq('id', uid)
    .single();
  console.log('Profile error:', pErr?.message || 'none');
  console.log('Profile exists:', !!profile);
  console.log('Taste vector:', profile?.taste_vector ? 'array(' + profile.taste_vector.length + ')' : String(profile?.taste_vector));
  console.log('Version:', profile?.taste_vector_version);

  // Get a Sports article with embedding
  const { data: sportArticle } = await supabase
    .from('published_articles')
    .select('id, embedding')
    .eq('category', 'Sports')
    .not('embedding', 'is', null)
    .limit(1)
    .single();
  console.log('\nSports article:', sportArticle?.id, 'embedding length:', sportArticle?.embedding?.length || 0);

  if (!sportArticle?.embedding) {
    console.log('No sports article with embedding found');
    return;
  }

  // Seed taste vector manually
  const { error: updateErr, data: updateData } = await supabase
    .from('profiles')
    .update({
      taste_vector: sportArticle.embedding,
      taste_vector_version: 99,
      taste_vector_updated_at: new Date().toISOString(),
    })
    .eq('id', uid)
    .select('taste_vector_version');
  console.log('Update error:', updateErr?.message || 'none');
  console.log('Update returned:', updateData);

  // Verify
  const { data: after } = await supabase
    .from('profiles')
    .select('taste_vector_version')
    .eq('id', uid)
    .single();
  console.log('After update - version:', after?.taste_vector_version);

  // Fetch feed with this user
  console.log('\nFetching feed with taste vector...');
  const resp = await fetch(`https://www.tennews.ai/api/feed/main?limit=20&user_id=${uid}`);
  const feed = await resp.json();
  const cats = {};
  (feed.articles || []).forEach(a => { cats[a.category || '?'] = (cats[a.category || '?'] || 0) + 1; });
  console.log('Categories:', JSON.stringify(cats));
  console.log('Scoring methods:', [...new Set((feed.articles || []).map(a => a.scoring_method))]);
  (feed.articles || []).slice(0, 8).forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.category}] ${(a.title || '').substring(0, 55)} (score:${Math.round(a.final_score)}, method:${a.scoring_method})`);
  });
}

main().catch(err => console.error('Fatal:', err));

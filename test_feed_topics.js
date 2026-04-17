const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Try 72h window since pipeline may not have run recently
  const since = new Date(Date.now() - 72 * 3600000).toISOString();

  const { data, error } = await supabase
    .from('published_articles')
    .select('id, title_news, category, interest_tags, ai_final_score, created_at')
    .gte('created_at', since)
    .order('ai_final_score', { ascending: false })
    .limit(500);

  if (error) { console.error(error); return; }

  console.log('Total articles in last 24h:', data.length);
  console.log('');

  const tagFreq = {};
  const categoryCount = {};
  for (const a of data) {
    const cat = a.category || 'Other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;

    let tags = a.interest_tags;
    if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch { tags = []; }
    if (!Array.isArray(tags)) continue;
    for (const t of tags) {
      const tl = t.toLowerCase();
      tagFreq[tl] = (tagFreq[tl] || 0) + 1;
    }
  }

  console.log('=== CATEGORIES ===');
  const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    console.log('  ' + cat + ': ' + count);
  }

  console.log('');
  console.log('=== TOP 100 INTEREST TAGS (by frequency) ===');
  const sortedTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 100);
  for (const [tag, count] of sortedTags) {
    console.log('  ' + tag + ': ' + count);
  }

  console.log('');
  console.log('=== ALL ARTICLES WITH TAGS ===');
  for (const a of data) {
    let tags = a.interest_tags;
    if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch { tags = []; }
    console.log(`[${a.category}] (${a.ai_final_score}) ${(a.title_news || '').substring(0, 90)} | tags: ${(tags || []).join(', ')}`);
  }
}
main();

import { createClient } from '@supabase/supabase-js';
import https from 'https';
const db = createClient('https://sdhdylsfngiybvoltoks.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs');
const uid = '5082a1df-24e4-4a39-a0c0-639c4de70627';

// Reset profile to fresh state — keep followed_topics
console.log('=== RESETTING YOUR ACCOUNT TO FRESH STATE ===');
const { error } = await db.from('profiles').update({
  tag_profile: null,
  taste_vector: null,
  taste_vector_minilm: null,
  skip_profile: null,
  category_profile: null,
  discovery_stats: null,
  similarity_floor: null,
  taste_vector_version: 0,
}).eq('id', uid);

if (error) console.log('Reset error:', error);
else console.log('Profile reset OK');

// Delete events
const { error: evErr } = await db.from('user_article_events').delete().eq('user_id', uid);
console.log('Events deleted:', evErr ? evErr.message : 'OK');

// Verify
const { data: p } = await db.from('profiles').select('followed_topics, tag_profile, taste_vector_version').eq('id', uid).single();
console.log('followed_topics:', JSON.stringify(p.followed_topics));
console.log('tag_profile after reset:', p.tag_profile);
console.log('taste_vector_version:', p.taste_vector_version);
console.log('');

// Now test the feed
console.log('=== TESTING FEED WITH FRESH PROFILE ===');
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 25000);
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timeout); try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', e => { clearTimeout(timeout); reject(e); });
  });
}
const url = 'https://www.tennews.ai/api/feed/main?user_id=' + uid + '&limit=20';
const data = await httpGet(url);
const articles = data.articles || [];
console.log('Articles returned:', articles.length);

const interestTags = new Set(['ai','artificial intelligence','machine learning','chatgpt','openai','deep learning','llm','gpt','f1','formula 1','motorsport','grand prix','racing','startup','venture capital','funding','vc','space','astronomy','nasa','climate','environment','biology','nature','earth science','science']);
let matches = 0;
const buckets = {};
const cats = {};
for (const a of articles) {
  buckets[a.bucket||'?'] = (buckets[a.bucket||'?']||0) + 1;
  cats[a.category||'?'] = (cats[a.category||'?']||0) + 1;
  const tags = (a.interest_tags || []).map(t => t.toLowerCase());
  if (tags.some(t => interestTags.has(t))) matches++;
}
console.log('Buckets:', JSON.stringify(buckets));
console.log('Categories:', JSON.stringify(cats));
console.log('Interest match:', matches + '/' + articles.length + ' (' + Math.round(matches/articles.length*100) + '%)');
console.log('');
for (let i = 0; i < articles.length; i++) {
  const a = articles[i];
  const tags = (a.interest_tags || []).slice(0, 4).join(', ');
  const isMatch = (a.interest_tags||[]).some(t => interestTags.has(t.toLowerCase()));
  console.log((i+1).toString().padStart(2) + '. ' + (isMatch ? 'YES' : ' NO') + ' [' + (a.bucket||'?').padEnd(10) + '] [' + (a.category||'?').padEnd(15) + '] ' + (a.title||'').substring(0,60));
  console.log('     tags: ' + tags);
}

// Check if tag_profile was seeded
console.log('\n=== TAG PROFILE AFTER FEED CALL (should be seeded) ===');
const { data: p2 } = await db.from('profiles').select('tag_profile').eq('id', uid).single();
const tp = p2.tag_profile || {};
const keys = Object.keys(tp).filter(k => k[0] !== '_');
console.log('Seeded entries:', keys.length);
const sorted = keys.sort((a,b) => tp[b] - tp[a]);
for (const k of sorted.slice(0, 20)) {
  console.log('  ' + k + ': ' + tp[k]);
}

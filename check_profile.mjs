import { createClient } from '@supabase/supabase-js';
const db = createClient('https://sdhdylsfngiybvoltoks.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs');
const uid = '5082a1df-24e4-4a39-a0c0-639c4de70627';

const { data: p } = await db.from('profiles').select('tag_profile, taste_vector, skip_profile, taste_vector_version, followed_topics').eq('id', uid).single();

console.log('followed_topics:', JSON.stringify(p?.followed_topics));
console.log('has taste_vector:', p?.taste_vector ? 'YES (v' + p?.taste_vector_version + ')' : 'NO');

const tp = p?.tag_profile || {};
const tpKeys = Object.keys(tp).filter(k => k[0] !== '_');
console.log('tag_profile entries:', tpKeys.length);
if (tpKeys.length > 0) {
  const sorted = tpKeys.sort((a,b) => (typeof tp[b] === 'number' ? tp[b] : 0) - (typeof tp[a] === 'number' ? tp[a] : 0));
  console.log('Top 15 tags:');
  for (const k of sorted.slice(0, 15)) {
    console.log('  ' + k + ': ' + JSON.stringify(tp[k]));
  }
}

const sp = p?.skip_profile || {};
const spKeys = Object.keys(sp).filter(k => k[0] !== '_');
console.log('\nskip_profile entries:', spKeys.length);
if (spKeys.length > 0) {
  console.log('Top 10 skipped tags:');
  for (const k of spKeys.slice(0, 10)) {
    console.log('  ' + k + ': ' + JSON.stringify(sp[k]));
  }
}

// Now test the feed after waiting for deployment
console.log('\n--- WAITING 15s FOR DEPLOYMENT ---\n');
await new Promise(r => setTimeout(r, 15000));

const https = await import('https');
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

const matchTags = new Set(['ai','artificial intelligence','machine learning','chatgpt','openai','deep learning','llm','gpt','f1','formula 1','motorsport','grand prix','racing','startup','venture capital','funding','vc','space','astronomy','nasa','climate','environment','biology','nature','earth science','science']);
const buckets = {};
const cats = {};
let matches = 0;
for (const a of articles) {
  buckets[a.bucket||'?'] = (buckets[a.bucket||'?']||0) + 1;
  cats[a.category||'?'] = (cats[a.category||'?']||0) + 1;
  const tags = (a.interest_tags || []).map(t => t.toLowerCase());
  if (tags.some(t => matchTags.has(t))) matches++;
}
console.log('Buckets:', JSON.stringify(buckets));
console.log('Categories:', JSON.stringify(cats));
console.log('Interest match:', matches + '/' + articles.length + ' (' + Math.round(matches/articles.length*100) + '%)');
console.log('\nArticle list:');
for (let i = 0; i < articles.length; i++) {
  const a = articles[i];
  const tags = (a.interest_tags || []).slice(0, 3).join(', ');
  const isMatch = (a.interest_tags||[]).some(t => matchTags.has(t.toLowerCase())) ? '★' : ' ';
  console.log('  ' + (i+1).toString().padStart(2) + '. ' + isMatch + ' [' + a.category + '] ' + (a.title||a.title_news||'').substring(0,65) + ' | ' + (a.bucket||'?') + ' | ' + tags);
}

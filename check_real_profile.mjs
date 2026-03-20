import { createClient } from '@supabase/supabase-js';
const db = createClient('https://sdhdylsfngiybvoltoks.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs');
const uid = '5082a1df-24e4-4a39-a0c0-639c4de70627';
const { data: p } = await db.from('profiles').select('tag_profile, taste_vector_version, followed_topics').eq('id', uid).single();

const tp = p.tag_profile || {};
const tpKeys = Object.keys(tp).filter(k => k[0] !== '_');
const sorted = tpKeys.sort((a,b) => (typeof tp[b] === 'number' ? tp[b] : 0) - (typeof tp[a] === 'number' ? tp[a] : 0));
console.log('followed_topics:', JSON.stringify(p.followed_topics));
console.log('tag_profile: ' + tpKeys.length + ' entries (v' + p.taste_vector_version + ')');
console.log('\nTop 30 tags:');
for (const k of sorted.slice(0, 30)) {
  console.log('  ' + k + ': ' + tp[k]);
}

// Check interest tag weights
console.log('\nINTEREST TAG WEIGHTS:');
const interestKeys = ['ai', 'artificial intelligence', 'machine learning', 'openai', 'chatgpt', 'f1', 'formula 1', 'motorsport', 'startup', 'venture capital', 'space', 'astronomy', 'nasa', 'science', 'grand prix', 'racing'];
for (const ik of interestKeys) {
  const found = tpKeys.find(k => k.toLowerCase() === ik);
  if (found) console.log('  ' + found + ': ' + tp[found]);
  else console.log('  ' + ik + ': (not in profile)');
}

// War/conflict tag weights
console.log('\nWAR/CONFLICT TAG WEIGHTS:');
const warKeys = ['iran', 'israel', 'war', 'conflict', 'military', 'tehran', 'middle east', 'oil', 'oil prices', 'trump', 'bombing'];
for (const wk of warKeys) {
  const found = tpKeys.find(k => k.toLowerCase() === wk);
  if (found) console.log('  ' + found + ': ' + tp[found]);
  else console.log('  ' + wk + ': (not in profile)');
}

const { count } = await db.from('user_article_events').select('id', { count: 'exact', head: true }).eq('user_id', uid);
console.log('\nTotal events:', count);

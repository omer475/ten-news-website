const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data } = await s.from('users').select('home_country, email').limit(3);
  console.log('Sample users:', JSON.stringify(data, null, 2));

  const id = '00000000-0000-0000-0000-000000000099';
  const hc = data && data[0] ? data[0].home_country : 'Turkey';
  const { data: d2, error } = await s.from('users').insert({
    id, email: 'test@test.com', home_country: hc,
    followed_countries: [], followed_topics: []
  }).select('id, home_country, taste_vector_minilm');

  console.log('Insert:', error ? error.message : 'OK');
  if (d2) console.log('Inserted:', JSON.stringify(d2));
  if (d2) await s.from('users').delete().eq('id', id);
}
main();

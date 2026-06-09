// GET /api/deep-dive/[slug] — a single deep dive by slug (direct/deep links,
// and the target of "Go deep on this" from a normal feed card).

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { shape } from './today';

const SELECT = 'id, slug, dive_date, headline, dek, hero_image, sections, sources, reading_time_min, anchor_article_id, vq_secondary, published_at, status';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'slug required' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(404).json({ error: 'not_found' });
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    const { data } = await supabase
      .from('deep_dives').select(SELECT)
      .eq('slug', slug).eq('status', 'published').limit(1);
    if (!data || !data.length) return res.status(404).json({ error: 'not_found' });

    return res.status(200).json({ deepDive: shape(data[0]) });
  } catch (e) {
    console.error('deep-dive/[slug] error:', e?.message || e);
    return res.status(404).json({ error: 'not_found' });
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, title_news, summary_bullets_news, image_url, category, source, published_at, details, map, components, components_order')
      .eq('author_id', user_id)
      .eq('is_ugc', true)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const articles = (data || []).map(a => ({
      id: a.id,
      title: a.title_news,
      bullets: typeof a.summary_bullets_news === 'string'
        ? JSON.parse(a.summary_bullets_news)
        : a.summary_bullets_news,
      image_url: a.image_url,
      category: a.category,
      source: a.source,
      published_at: a.published_at,
      details: a.details,
      map: a.map,
      components: a.components,
      components_order: a.components_order,
    }));

    return res.status(200).json({ articles });
  } catch (error) {
    console.error('Fetch published error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

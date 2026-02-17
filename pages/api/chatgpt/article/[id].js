import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Valid article ID required' });
  }

  const { data, error } = await supabase
    .from('published_articles')
    .select('id, title_news, emoji, ai_final_score, countries, topics, country_relevance, topic_relevance, category, summary_bullets_news, five_ws, details, graph, map, published_at, num_sources, source_titles, image_url, url, interest_tags')
    .eq('id', parseInt(id))
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Article not found' });
  }

  return res.status(200).json(data);
}

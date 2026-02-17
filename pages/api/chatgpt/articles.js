import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, country, min_score, hours, date, limit } = req.query;

  let query = supabase
    .from('published_articles')
    .select('id, title_news, emoji, ai_final_score, countries, topics, country_relevance, topic_relevance, category, summary_bullets_news, published_at, num_sources, image_url')
    .order('ai_final_score', { ascending: false });

  // Time filter: specific date or hours ago
  if (date) {
    const startDate = new Date(date + 'T00:00:00Z');
    const endDate = new Date(date + 'T00:00:00Z');
    endDate.setDate(endDate.getDate() + 1);
    query = query.gte('published_at', startDate.toISOString()).lt('published_at', endDate.toISOString());
  } else {
    const hoursAgo = parseInt(hours) || 24;
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    query = query.gte('published_at', since);
  }

  // Topic filter
  if (topic) {
    query = query.contains('topics', [topic]);
  }

  // Country filter
  if (country) {
    query = query.contains('countries', [country]);
  }

  // Minimum score filter
  if (min_score) {
    query = query.gte('ai_final_score', parseInt(min_score));
  }

  // Limit (default 30, max 50)
  const maxResults = Math.min(parseInt(limit) || 30, 50);
  query = query.limit(maxResults);

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    articles: data,
    count: data.length,
    filters_applied: {
      topic: topic || null,
      country: country || null,
      min_score: min_score ? parseInt(min_score) : null,
      time_window: date || `last ${parseInt(hours) || 24} hours`,
    },
  });
}

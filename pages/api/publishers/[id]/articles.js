import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = req.query;
    const page = parseInt(req.query.page) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = page * limit;

    if (!id) {
      return res.status(400).json({ error: 'Publisher ID required' });
    }

    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('id, title_news, url, source, category, emoji, image_url, image_source, published_at, created_at, ai_final_score, summary_bullets_news, interest_tags, author_id, author_name')
      .eq('author_id', id)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      console.error('Publisher articles error:', error);
      return res.status(500).json({ error: 'Failed to fetch articles' });
    }

    const formatted = (articles || []).map(a => ({
      id: a.id,
      title: a.title_news,
      title_news: a.title_news,
      url: a.url,
      source: a.source,
      category: a.category,
      emoji: a.emoji || '📰',
      image_url: a.image_url,
      urlToImage: a.image_url,
      image_source: a.image_source,
      publishedAt: a.published_at,
      created_at: a.created_at,
      ai_final_score: a.ai_final_score || 0,
      summary_bullets_news: safeJsonParse(a.summary_bullets_news, []),
      summary_bullets: safeJsonParse(a.summary_bullets_news, []),
      interest_tags: safeJsonParse(a.interest_tags, []),
      author_id: a.author_id,
      author_name: a.author_name,
    }));

    return res.status(200).json({
      articles: formatted,
      has_more: (articles || []).length === limit,
      page,
    });
  } catch (err) {
    console.error('Publisher articles error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

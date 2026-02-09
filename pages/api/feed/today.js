import { createClient } from '@supabase/supabase-js';
import { PERSONALIZATION_CONFIG } from '../../../lib/personalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get articles from last 24 hours with high base_score
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('id, title_news, url, source, category, ai_final_score, countries, topics, image_url, image_source, published_at, created_at, summary_bullets_news, five_ws')
      .gte('ai_final_score', PERSONALIZATION_CONFIG.TODAY_FEED_MIN_SCORE)
      .gte('created_at', oneDayAgo)
      .order('ai_final_score', { ascending: false })
      .limit(PERSONALIZATION_CONFIG.TODAY_FEED_MAX_ARTICLES);

    if (error) {
      console.error('Error fetching today feed:', error);
      return res.status(500).json({ error: 'Failed to fetch articles' });
    }

    // Format response
    const formattedArticles = (articles || []).map(article => ({
      id: article.id,
      title: article.title_news,
      url: article.url,
      source: article.source,
      category: article.category,
      base_score: article.ai_final_score,
      countries: article.countries || [],
      topics: article.topics || [],
      image_url: article.image_url,
      image_source: article.image_source,
      published_at: article.published_at,
      created_at: article.created_at,
      summary_bullets: article.summary_bullets_news,
      five_ws: article.five_ws,
    }));

    // Cache for 5 minutes (same for all users)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');

    return res.status(200).json({
      articles: formattedArticles,
      count: formattedArticles.length,
    });

  } catch (error) {
    console.error('Today feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

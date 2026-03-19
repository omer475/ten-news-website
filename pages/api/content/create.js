import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { title, bullets, category, tags, image_url, user_id, author_name } = req.body;

  if (!title || !bullets || !Array.isArray(bullets) || bullets.length === 0) {
    return res.status(400).json({ error: 'title and bullets are required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Build interest tags from user tags + title words + category
    const userTags = Array.isArray(tags) ? tags.map(t => t.toLowerCase()) : [];
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const interestTags = [...new Set([...userTags, category.toLowerCase(), ...words.slice(0, 4)])];

    const articleData = {
      title_news: title,
      summary_bullets_news: JSON.stringify(bullets),
      category: category || 'Lifestyle',
      image_url: image_url || null,
      source: author_name || 'Community',
      is_ugc: true,
      author_id: user_id || null,
      author_name: author_name || 'Anonymous',
      article_type: 'ugc',
      ai_final_score: 500,
      interest_tags: JSON.stringify(interestTags),
      countries: JSON.stringify([]),
      topics: JSON.stringify([category || 'Lifestyle']),
      components: [],
      components_order: [],
      published_at: new Date().toISOString(),
      shelf_life_days: 30,
      freshness_category: 'evergreen',
      num_sources: 1,
      like_count: 0,
      engagement_count: 0,
      view_count: 0,
    };

    const { data, error } = await supabase
      .from('published_articles')
      .insert(articleData)
      .select('id, title_news, category, image_url, published_at')
      .single();

    if (error) {
      console.error('Insert article error:', error);
      return res.status(500).json({ error: 'Failed to create article' });
    }

    return res.status(201).json({
      success: true,
      article: {
        id: data.id,
        title: data.title_news,
        category: data.category,
        image_url: data.image_url,
        published_at: data.published_at
      }
    });
  } catch (error) {
    console.error('Create content error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

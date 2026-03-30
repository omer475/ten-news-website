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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Article ID required' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: article, error } = await supabase
      .from('published_articles')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Parse JSONB fields
    const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
    const fiveWs = safeJsonParse(article.five_ws, null);
    const timeline = safeJsonParse(article.timeline, null);
    const graph = safeJsonParse(article.graph, null);
    const details = safeJsonParse(article.details, []);
    const components = article.components_order || safeJsonParse(article.components, null);
    const countries = safeJsonParse(article.countries, []);
    const topics = safeJsonParse(article.topics, []);
    const interestTags = safeJsonParse(article.interest_tags, []);

    // Parse map data
    let map = null;
    const rawMap = safeJsonParse(article.map, null);
    if (rawMap) {
      if (Array.isArray(rawMap) && rawMap.length > 0) {
        const primary = rawMap[0];
        map = {
          center: { lat: primary.coordinates?.lat || 0, lon: primary.coordinates?.lng || primary.coordinates?.lon || 0 },
          markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
          name: primary.name,
          location: [primary.name, primary.city, primary.country].filter(Boolean).join(', '),
          city: primary.city,
          country: primary.country,
          description: primary.description,
        };
      } else if (!Array.isArray(rawMap)) {
        map = {
          center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
          markers: [],
          name: rawMap.name,
          location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
          city: rawMap.city,
          country: rawMap.country,
          description: rawMap.description,
        };
      }
    }

    // Clean image URL
    let imageUrl = null;
    const raw = article.image_url;
    if (raw) {
      const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
      if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
        imageUrl = s;
      }
    }

    const formatted = {
      id: article.id,
      title: article.title_news,
      title_news: article.title_news,
      url: article.url,
      source: article.source || 'Ten News',
      category: article.category,
      emoji: article.emoji || '📰',
      image_url: imageUrl,
      urlToImage: imageUrl,
      image_source: article.image_source || null,
      publishedAt: article.published_at,
      created_at: article.created_at,
      ai_final_score: article.ai_final_score || 0,
      final_score: article.ai_final_score || 0,
      summary_bullets_news: summaryBulletsNews,
      summary_bullets: summaryBulletsNews,
      five_ws: fiveWs,
      timeline,
      graph,
      map,
      details,
      components,
      countries,
      topics,
      interest_tags: interestTags,
      num_sources: article.num_sources,
      cluster_id: article.cluster_id,
      version_number: article.version_number,
      views: article.view_count || 0,
    };

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ article: formatted });

  } catch (error) {
    console.error('Article detail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// API route for individual news articles - fetches directly from database
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Article ID is required' });
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Supabase not configured, falling back to news API...');
      // Fallback to fetching from news API (without pagination limit)
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      // Request a large page size to find the article
      const response = await fetch(`${baseUrl}/api/news?pageSize=500`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch news data');
      }

      const newsData = await response.json();
      
      if (!newsData.articles || newsData.articles.length === 0) {
        return res.status(404).json({ error: 'No articles found' });
      }

      const article = newsData.articles.find(a => String(a.id) === String(id));
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.status(200).json(article);
    }

    // Create Supabase client and fetch article directly by ID
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 Fetching article with ID: ${id}`);

    const { data: article, error } = await supabase
      .from('published_articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      
      // If not found by exact match, try string comparison
      if (error.code === 'PGRST116') {
        // Try finding by string ID match
        const { data: allArticles, error: listError } = await supabase
          .from('published_articles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        
        if (!listError && allArticles) {
          const found = allArticles.find(a => String(a.id) === String(id));
          if (found) {
            console.log(`✅ Found article by string match: ${found.title?.substring(0, 50)}`);
            return res.status(200).json(formatArticle(found));
          }
        }
      }
      
      return res.status(404).json({ error: 'Article not found' });
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    console.log(`✅ Found article: ${article.title?.substring(0, 50)}`);
    return res.status(200).json(formatArticle(article));

  } catch (error) {
    console.error('Error fetching article:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to format article data consistently
function formatArticle(article) {
  // Parse JSON fields if they're strings
  const parseJSON = (field) => {
    if (!field) return null;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        return null;
      }
    }
    return field;
  };

  return {
    id: article.id,
    title: article.title,
    title_news: article.title_news || article.title,
    summary: article.summary || article.summary_text,
    summary_text: article.summary_text,
    summary_text_b2: article.summary_text_b2,
    summary_bullets: parseJSON(article.summary_bullets) || [],
    summary_bullets_b2: parseJSON(article.summary_bullets_b2) || [],
    details: parseJSON(article.details) || [],
    details_b2: parseJSON(article.details_b2) || [],
    detailed_text: article.detailed_text || article.article || article.ai_detailed_text,
    detailed_bullets: parseJSON(article.detailed_bullets) || [],
    detailed_bullets_b2: parseJSON(article.detailed_bullets_b2) || [],
    url: article.url,
    urlToImage: article.image_url || article.urlToImage,
    image_url: article.image_url,
    source: article.source,
    category: article.category,
    emoji: article.emoji,
    timeline: parseJSON(article.timeline) || [],
    graph: parseJSON(article.graph) || parseJSON(article.graph_data),
    graph_data: parseJSON(article.graph_data),
    map: parseJSON(article.map) || parseJSON(article.map_data),
    map_data: parseJSON(article.map_data),
    five_ws: parseJSON(article.five_ws),
    components: parseJSON(article.components),
    citations: parseJSON(article.citations) || [],
    publishedAt: article.published_at || article.created_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score,
    final_score: article.ai_final_score || article.final_score
  };
}

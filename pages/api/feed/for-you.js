import { createClient } from '@supabase/supabase-js';
import { calculateFinalScore } from '../../../lib/personalization';

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

    // Get user preferences from query params or auth
    const { 
      home_country, 
      followed_countries, 
      followed_topics, 
      limit = 50, 
      offset = 0,
      user_id 
    } = req.query;

    let userPrefs = null;

    // Try to get from database if user_id provided
    if (user_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('home_country, followed_countries, followed_topics')
        .eq('id', user_id)
        .single();
      
      if (!userError && userData) {
        userPrefs = userData;
      }
    }

    // Fallback to query params (for localStorage-based users)
    if (!userPrefs) {
      if (!home_country || !followed_topics) {
        return res.status(400).json({ 
          error: 'Missing user preferences. Provide user_id or home_country + followed_topics' 
        });
      }
      
      userPrefs = {
        home_country,
        followed_countries: followed_countries ? followed_countries.split(',') : [],
        followed_topics: followed_topics ? followed_topics.split(',') : [],
      };
    }

    // Get articles from last 48 hours (wider window for personalized feed)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('id, title_news, url, source, category, ai_final_score, countries, topics, image_url, image_source, published_at, created_at, summary_bullets_news, five_ws')
      .gte('created_at', twoDaysAgo)
      .order('ai_final_score', { ascending: false })
      .limit(200); // Fetch more, then sort by personalized score

    if (error) {
      console.error('Error fetching for-you feed:', error);
      return res.status(500).json({ error: 'Failed to fetch articles' });
    }

    // Calculate personalized scores
    const scoredArticles = (articles || []).map(article => {
      const scored = calculateFinalScore(
        {
          ...article,
          base_score: article.ai_final_score,
          countries: article.countries || [],
          topics: article.topics || [],
        },
        userPrefs
      );
      return {
        id: article.id,
        title: article.title_news,
        url: article.url,
        source: article.source,
        category: article.category,
        base_score: article.ai_final_score,
        final_score: scored.final_score,
        countries: article.countries || [],
        topics: article.topics || [],
        image_url: article.image_url,
        image_source: article.image_source,
        published_at: article.published_at,
        created_at: article.created_at,
        summary_bullets: article.summary_bullets_news,
        five_ws: article.five_ws,
        match_reasons: scored.match_reasons,
      };
    });

    // Sort by final_score descending
    scoredArticles.sort((a, b) => b.final_score - a.final_score);

    // Apply pagination
    const parsedOffset = parseInt(offset) || 0;
    const parsedLimit = parseInt(limit) || 50;
    const paginatedArticles = scoredArticles.slice(parsedOffset, parsedOffset + parsedLimit);

    // Cache for 2 minutes (personalized, shorter cache)
    res.setHeader('Cache-Control', 'private, s-maxage=120, stale-while-revalidate=30');

    return res.status(200).json({
      articles: paginatedArticles,
      count: paginatedArticles.length,
      total: scoredArticles.length,
      has_more: parsedOffset + parsedLimit < scoredArticles.length,
    });

  } catch (error) {
    console.error('For-you feed error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

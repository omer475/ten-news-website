// Debug endpoint to test Supabase connection
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const debug = {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlPrefix: supabaseUrl?.substring(0, 30) + '...',
  };

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials', debug });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    debug.twentyFourHoursAgo = twentyFourHoursAgo;
    
    // Test 1: Simple count
    const { count, error: countError } = await supabase
      .from('published_articles')
      .select('*', { count: 'exact', head: true });
    
    debug.totalCount = count;
    debug.countError = countError?.message;

    // Test 2: Get latest 5 articles (EXACT same query as news API)
    const { data: latest, error: latestError } = await supabase
      .from('published_articles')
      .select('id, title_news, url, source, content_news, created_at, added_at, published_date, published_at, num_sources, cluster_id, version_number, image_url, author, category, emoji, ai_final_score, summary_bullets_news, summary_bullets_detailed, summary_bullets, five_ws, timeline, graph, map, components_order, components, details_section, details, view_count, interest_tags')
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5);
    
    debug.latestArticles = latest?.map(a => ({
      id: a.id,
      title: (a.title_news || 'NO TITLE').substring(0, 50),
      created_at: a.created_at,
      score: a.ai_final_score
    }));
    debug.latestError = latestError?.message;
    debug.latestCount = latest?.length || 0;

    // Test 3: Articles in last 24 hours (simple query)
    const { data: recent, error: recentError } = await supabase
      .from('published_articles')
      .select('id, title_news, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    debug.recentCount = recent?.length;
    debug.recentArticles = recent?.map(a => ({
      id: a.id,
      title: (a.title_news || 'NO TITLE').substring(0, 40),
      created_at: a.created_at
    }));
    debug.recentError = recentError?.message;

    return res.status(200).json({ success: true, debug });
  } catch (error) {
    return res.status(500).json({ error: error.message, debug });
  }
}

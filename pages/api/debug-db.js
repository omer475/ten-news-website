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
    
    // Test 1: Simple count
    const { count, error: countError } = await supabase
      .from('published_articles')
      .select('*', { count: 'exact', head: true });
    
    debug.totalCount = count;
    debug.countError = countError?.message;

    // Test 2: Get latest 5 articles
    const { data: latest, error: latestError } = await supabase
      .from('published_articles')
      .select('id, title_news, title, created_at, ai_final_score')
      .order('created_at', { ascending: false })
      .limit(5);
    
    debug.latestArticles = latest?.map(a => ({
      id: a.id,
      title: (a.title_news || a.title || 'NO TITLE').substring(0, 50),
      created_at: a.created_at,
      score: a.ai_final_score
    }));
    debug.latestError = latestError?.message;

    // Test 3: Articles in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
    debug.twentyFourHoursAgo = twentyFourHoursAgo;

    return res.status(200).json({ success: true, debug });
  } catch (error) {
    return res.status(500).json({ error: error.message, debug });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: likedEvents } = await supabase
      .from('user_article_events')
      .select('article_id')
      .eq('user_id', user_id)
      .eq('event_type', 'article_liked')
      .order('created_at', { ascending: false })
      .limit(200);

    const { data: savedEvents } = await supabase
      .from('user_article_events')
      .select('article_id')
      .eq('user_id', user_id)
      .eq('event_type', 'article_saved')
      .order('created_at', { ascending: false })
      .limit(200);

    const likedIds = [...new Set((likedEvents || []).map(e => e.article_id))];
    const savedIds = [...new Set((savedEvents || []).map(e => e.article_id))];
    const allIds = [...new Set([...likedIds, ...savedIds])];

    const articleMap = {};
    for (let i = 0; i < allIds.length; i += 50) {
      const batch = allIds.slice(i, i + 50);
      const { data } = await supabase
        .from('published_articles')
        .select('id, title_news, category, image_url, source, created_at, emoji, summary_bullets_news, interest_tags, ai_final_score')
        .in('id', batch);
      if (data) for (const a of data) articleMap[a.id] = a;
    }

    return res.status(200).json({
      liked: likedIds.map(id => articleMap[id]).filter(Boolean),
      saved: savedIds.map(id => articleMap[id]).filter(Boolean),
      liked_ids: likedIds.map(String),
      saved_ids: savedIds.map(String),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

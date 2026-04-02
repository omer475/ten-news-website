import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    const userId = req.query.user_id || null;

    if (!id) {
      return res.status(400).json({ error: 'Publisher ID required' });
    }

    // Fetch publisher
    const { data: publisher, error } = await supabase
      .from('publishers')
      .select('id, username, display_name, bio, avatar_url, cover_image_url, category, interest_tags, is_verified, follower_count, article_count')
      .eq('id', id)
      .single();

    if (error || !publisher) {
      return res.status(404).json({ error: 'Publisher not found' });
    }

    // Check if current user follows this publisher
    let isFollowing = false;
    if (userId) {
      const { data: follow } = await supabase
        .from('user_follows')
        .select('user_id')
        .eq('user_id', userId)
        .eq('publisher_id', id)
        .single();
      isFollowing = !!follow;
    }

    // Get accurate article count
    const { count } = await supabase
      .from('published_articles')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', id);

    publisher.article_count = count || 0;

    return res.status(200).json({
      publisher,
      is_following: isFollowing,
    });
  } catch (err) {
    console.error('Publisher profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

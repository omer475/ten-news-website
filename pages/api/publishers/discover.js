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
    const category = req.query.category || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const userId = req.query.user_id || null;

    let query = supabase
      .from('publishers')
      .select('id, username, display_name, bio, avatar_url, category, interest_tags, is_verified, follower_count, article_count')
      .order('follower_count', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: publishers, error } = await query;

    if (error) {
      console.error('Discover publishers error:', error);
      return res.status(500).json({ error: 'Failed to fetch publishers' });
    }

    // If user is logged in, mark which ones they follow
    let followedIds = new Set();
    if (userId) {
      const { data: follows } = await supabase
        .from('user_follows')
        .select('publisher_id')
        .eq('user_id', userId);
      if (follows) {
        followedIds = new Set(follows.map(f => f.publisher_id));
      }
    }

    const result = (publishers || []).map(p => ({
      ...p,
      is_following: followedIds.has(p.id),
    }));

    return res.status(200).json({ publishers: result });
  } catch (err) {
    console.error('Discover publishers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

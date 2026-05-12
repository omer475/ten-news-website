import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/users/[id]/following
 *
 * Returns the list of users that user [id] follows, plus total count.
 * Symmetric to /followers, just queries the other side of user_user_follows.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id: sourceUserId } = req.query;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 100);
    const offset = parseInt(req.query.offset ?? '0', 10) || 0;

    if (!sourceUserId) {
      return res.status(400).json({ error: 'source user id required' });
    }

    const { count } = await supabase
      .from('user_user_follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('follower_id', sourceUserId);

    const { data, error } = await supabase
      .from('user_user_follows')
      .select(
        `
        created_at,
        followed:profiles!user_user_follows_followed_id_fkey (
          id, username, display_name, avatar_url
        )
        `
      )
      .eq('follower_id', sourceUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('following list error:', error);
      return res.status(500).json({ error: 'Failed to load following' });
    }

    const users = (data ?? [])
      .map((row) => row.followed)
      .filter((p) => p && p.id);

    return res.status(200).json({ users, count: count ?? 0 });
  } catch (err) {
    console.error('Following endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

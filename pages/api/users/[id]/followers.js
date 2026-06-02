import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/users/[id]/followers
 *
 * Returns the list of profiles that follow user [id], plus total count.
 * Pagination via ?limit=&offset=.
 *
 * Response: { users: [{id, username, display_name, avatar_url}], count }
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
    const { id: targetUserId } = req.query;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 100);
    const offset = parseInt(req.query.offset ?? '0', 10) || 0;

    if (!targetUserId) {
      return res.status(400).json({ error: 'target user id required' });
    }

    // Total count (used by the AccountTab stat, independent of list size).
    const { count } = await supabase
      .from('user_user_follows')
      .select('followed_id', { count: 'exact', head: true })
      .eq('followed_id', targetUserId);

    // List with the follower's profile data joined in. Sort newest first.
    const { data, error } = await supabase
      .from('user_user_follows')
      .select(
        `
        created_at,
        follower:profiles!user_user_follows_follower_id_fkey (
          id, username, display_name, avatar_url
        )
        `
      )
      .eq('followed_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('followers list error:', error);
      return res.status(500).json({ error: 'Failed to load followers' });
    }

    const users = (data ?? [])
      .map((row) => row.follower)
      .filter((p) => p && p.id);

    return res.status(200).json({ users, count: count ?? 0 });
  } catch (err) {
    console.error('Followers endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

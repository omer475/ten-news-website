import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/users/[id]/profile?user_id=<viewer>
 *
 * Returns the target user's profile + social stats. If the viewer's id is
 * passed, also returns whether the viewer follows the target. One round-trip
 * for the iOS UserProfileView.
 *
 * Response: {
 *   profile: {id, username, display_name, avatar_url, ...},
 *   follower_count: N,
 *   following_count: N,
 *   is_following: bool   (only when ?user_id= is provided)
 * }
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
    const viewerId = req.query.user_id || null;

    if (!targetUserId) {
      return res.status(400).json({ error: 'target user id required' });
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, created_at')
      .eq('id', targetUserId)
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [followers, following, isFollowingRow] = await Promise.all([
      supabase
        .from('user_user_follows')
        .select('followed_id', { count: 'exact', head: true })
        .eq('followed_id', targetUserId),
      supabase
        .from('user_user_follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('follower_id', targetUserId),
      viewerId
        ? supabase
            .from('user_user_follows')
            .select('follower_id')
            .eq('follower_id', viewerId)
            .eq('followed_id', targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return res.status(200).json({
      profile,
      follower_count: followers.count ?? 0,
      following_count: following.count ?? 0,
      is_following: viewerId ? Boolean(isFollowingRow.data) : null,
    });
  } catch (err) {
    console.error('User profile endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

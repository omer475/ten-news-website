import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/users/[id]/follow   → currentUser follows [id]
 * DELETE /api/users/[id]/follow → currentUser unfollows [id]
 *
 * Body / query: { user_id: <current user's profile id> }
 * Returns: { success, follower_count }
 *
 * Mirrors the publisher-follow endpoint shape; backs the user→user graph
 * stored in public.user_user_follows.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id: targetUserId } = req.query;
    const followerId = req.body?.user_id || req.query.user_id;

    if (!targetUserId || !followerId) {
      return res.status(400).json({ error: 'target user id and follower user_id required' });
    }
    if (targetUserId === followerId) {
      return res.status(400).json({ error: 'cannot follow yourself' });
    }

    if (req.method === 'POST') {
      const { error } = await supabase
        .from('user_user_follows')
        .upsert(
          {
            follower_id: followerId,
            followed_id: targetUserId,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'follower_id,followed_id' }
        );
      if (error) {
        console.error('user_user_follows insert error:', error);
        return res.status(500).json({ error: 'Failed to follow' });
      }
    } else {
      const { error } = await supabase
        .from('user_user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followed_id', targetUserId);
      if (error) {
        console.error('user_user_follows delete error:', error);
        return res.status(500).json({ error: 'Failed to unfollow' });
      }
    }

    // Return fresh follower count for the target.
    const { count: followerCount } = await supabase
      .from('user_user_follows')
      .select('followed_id', { count: 'exact', head: true })
      .eq('followed_id', targetUserId);

    return res.status(200).json({
      success: true,
      follower_count: followerCount ?? 0,
    });
  } catch (err) {
    console.error('Follow/unfollow user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

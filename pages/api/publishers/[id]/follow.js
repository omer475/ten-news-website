import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id: publisherId } = req.query;
    const userId = req.body?.user_id || req.query.user_id;

    if (!publisherId || !userId) {
      return res.status(400).json({ error: 'Publisher ID and user_id required' });
    }

    if (req.method === 'POST') {
      // Follow
      const { error } = await supabase
        .from('user_follows')
        .upsert({
          user_id: userId,
          publisher_id: publisherId,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,publisher_id' });

      if (error) {
        console.error('Follow error:', error);
        return res.status(500).json({ error: 'Failed to follow' });
      }
    } else {
      // Unfollow
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('user_id', userId)
        .eq('publisher_id', publisherId);

      if (error) {
        console.error('Unfollow error:', error);
        return res.status(500).json({ error: 'Failed to unfollow' });
      }
    }

    // Get updated follower count
    const { data: publisher } = await supabase
      .from('publishers')
      .select('follower_count')
      .eq('id', publisherId)
      .single();

    return res.status(200).json({
      success: true,
      follower_count: publisher?.follower_count || 0,
    });
  } catch (err) {
    console.error('Follow/unfollow error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

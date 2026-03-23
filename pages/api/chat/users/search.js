import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { q, user_id } = req.query;
  if (!q || q.length < 2) {
    return res.status(200).json({ users: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const query = q.toLowerCase();

  try {
    // Search auth.users by email and metadata name
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) throw authErr;

    const matchedUsers = (authData?.users || [])
      .filter(u => {
        if (u.id === user_id) return false; // exclude self
        const email = (u.email || '').toLowerCase();
        const name = (u.user_metadata?.name || '').toLowerCase();
        return email.includes(query) || name.includes(query);
      })
      .slice(0, 20);

    // Get profile data for matched users
    const userIds = matchedUsers.map(u => u.id);
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      for (const p of (profiles || [])) {
        profileMap[p.id] = p;
      }
    }

    const users = matchedUsers.map(u => {
      const profile = profileMap[u.id];
      return {
        id: u.id,
        display_name: profile?.display_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
        avatar_url: profile?.avatar_url || u.user_metadata?.avatar_url || null,
        email: u.email || null
      };
    });

    return res.status(200).json({ users });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/users/search?q=<query>&limit=20
 *
 * Searches the profiles table by username and display_name (case-insensitive,
 * prefix-match). Used by the "Find people" sheet on the Account tab so the
 * user-user follow graph has a way to grow.
 *
 * Response: { users: [{id, username, display_name, avatar_url}] }
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
    const rawQuery = (req.query.q ?? '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 50);
    const excludeId = req.query.exclude_id ?? null;

    if (rawQuery.length < 2) {
      // Empty / single-char queries return nothing instead of dumping the
      // whole profiles table.
      return res.status(200).json({ users: [] });
    }

    // Escape user-provided patterns so % / _ don't widen the search.
    const safe = rawQuery.replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `${safe}%`;

    let q = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .not('username', 'is', null)
      .limit(limit);

    if (excludeId) q = q.neq('id', excludeId);

    const { data, error } = await q;
    if (error) {
      console.error('user search error:', error);
      return res.status(500).json({ error: 'Search failed' });
    }

    return res.status(200).json({ users: data ?? [] });
  } catch (err) {
    console.error('User search endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/feed/modules — interstitial-module content for the TodayPlus
// feed redesign (spec §8). Returns today's rows (falling back to the most
// recent available date), keyed by module type:
//   history     { rows: [[year, text] x3] }
//   notd        { value, prefix, unit, context }
//   briefs      { rows: [{ tag, text } x3] }
//   countdowns  { rows: [{ name, datetime, context }] }   (may be empty)
// MARKET PULSE is intentionally absent — live quotes are fetched client-side.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('feed_modules')
      .select('module_date, module_type, payload')
      .order('module_date', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error fetching feed modules:', error);
      return res.status(500).json({ error: 'Failed to fetch modules' });
    }

    // Keep only the newest row per type (rows are date-desc).
    const modules = {};
    let moduleDate = null;
    for (const row of data || []) {
      if (!modules[row.module_type]) {
        modules[row.module_type] = row.payload;
        if (!moduleDate) moduleDate = row.module_date;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ date: moduleDate, modules });
  } catch (e) {
    console.error('feed/modules error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

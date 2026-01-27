// API endpoint to fetch resolved/archived world events

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 20, offset = 0 } = req.query;

    // Fetch resolved world events, most recently resolved first
    const { data: events, error, count } = await supabase
      .from('world_events')
      .select('id, name, slug, image_url, blur_color, topic_prompt, resolved_at, created_at', { count: 'exact' })
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Error fetching archived events:', error);
      return res.status(500).json({ error: 'Failed to fetch archived events' });
    }

    return res.status(200).json({
      events: events || [],
      total: count || 0,
      hasMore: (parseInt(offset) + events.length) < count
    });

  } catch (error) {
    console.error('Error in archived events API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

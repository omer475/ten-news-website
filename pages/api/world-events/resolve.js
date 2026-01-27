// API endpoint to mark a world event as resolved

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId, slug } = req.body;

  if (!eventId && !slug) {
    return res.status(400).json({ error: 'eventId or slug is required' });
  }

  try {
    // Build query
    let query = supabase
      .from('world_events')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString()
      });

    if (eventId) {
      query = query.eq('id', eventId);
    } else {
      query = query.eq('slug', slug);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error('Error resolving event:', error);
      return res.status(500).json({ error: 'Failed to resolve event' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      event: data,
      message: `Event "${data.name}" has been marked as resolved`
    });

  } catch (error) {
    console.error('Error in resolve event API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

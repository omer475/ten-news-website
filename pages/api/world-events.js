// API endpoint to fetch world events for the first page
// Returns active events sorted by update count, recency, importance

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
    const { since, limit = 8 } = req.query;
    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch active world events - just the basic data, fast query
    const { data: events, error } = await supabase
      .from('world_events')
      .select(`
        id,
        name,
        slug,
        image_url,
        blur_color,
        importance,
        status,
        last_article_at,
        created_at,
        background
      `)
      .eq('status', 'ongoing')
      .order('last_article_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching world events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    if (!events || events.length === 0) {
      return res.status(200).json({ events: [], total: 0 });
    }

    // Get all article counts in a SINGLE query instead of N queries
    const eventIds = events.map(e => e.id);
    const { data: articleCounts, error: countError } = await supabase
      .from('article_world_events')
      .select('event_id')
      .in('event_id', eventIds)
      .gte('tagged_at', sinceDate.toISOString());

    // Count articles per event
    const countMap = {};
    if (!countError && articleCounts) {
      articleCounts.forEach(row => {
        countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
      });
    }

    // Add counts to events
    const eventsWithCounts = events.map(event => ({
      ...event,
      newUpdates: countMap[event.id] || 0
    }));

    // Sort by: update count (desc) → last_article_at (desc) → importance (desc)
    eventsWithCounts.sort((a, b) => {
      // First by update count
      if (b.newUpdates !== a.newUpdates) {
        return b.newUpdates - a.newUpdates;
      }
      // Then by recency
      const aTime = new Date(a.last_article_at || a.created_at).getTime();
      const bTime = new Date(b.last_article_at || b.created_at).getTime();
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      // Finally by importance
      return (b.importance || 5) - (a.importance || 5);
    });

    // Add caching headers for faster subsequent loads
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    
    return res.status(200).json({
      events: eventsWithCounts,
      total: eventsWithCounts.length
    });

  } catch (error) {
    console.error('Error in world-events API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

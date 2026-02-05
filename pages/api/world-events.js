// API endpoint to fetch world events for the first page
// Returns active events sorted by update count, recency, importance
// OPTIMIZED: Single query approach with minimal data transfer

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Short caching for better performance (30s cache, 60s stale-while-revalidate)
  // This balances freshness with performance for the first page load
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { since, limit = 8 } = req.query;
    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch active world events.
    // - image_url: event page hero image (wide)
    // - cover_image_url: event box/card cover image (4:5)
    // Note: cover_image_url may not exist if migration not run - that's ok
    const { data: events, error } = await supabase
      .from('world_events')
      .select(`
        id, name, slug, image_url, cover_image_url, blur_color, importance, status, last_article_at, created_at, background
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

    // OPTIMIZATION: Get article counts in a single batch query
    // Only fetch event_id column to minimize data transfer
    const eventIds = events.map(e => e.id);
    const { data: articleCounts, error: countError } = await supabase
      .from('article_world_events')
      .select('event_id')
      .in('event_id', eventIds)
      .gte('tagged_at', sinceDate.toISOString());

    // Count articles per event efficiently
    const countMap = {};
    if (!countError && articleCounts) {
      for (const row of articleCounts) {
        countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
      }
    }

    // Add counts to events
    const eventsWithCounts = events.map(event => {
      return {
        id: event.id,
        name: event.name,
        slug: event.slug,
        // Image priority: cover_image_url (4:5) > image_url (hero) > null
        image_url: event.cover_image_url || event.image_url || null,
        cover_image_url: event.cover_image_url || null,
        blur_color: event.blur_color,
        importance: event.importance,
        status: event.status,
        last_article_at: event.last_article_at,
        created_at: event.created_at,
        background: event.background,
        newUpdates: countMap[event.id] || 0
      };
    });

    // Sort by: update count (desc) → last_article_at (desc) → importance (desc)
    eventsWithCounts.sort((a, b) => {
      if (b.newUpdates !== a.newUpdates) return b.newUpdates - a.newUpdates;
      const aTime = new Date(a.last_article_at || a.created_at).getTime();
      const bTime = new Date(b.last_article_at || b.created_at).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return (b.importance || 5) - (a.importance || 5);
    });
    
    return res.status(200).json({
      events: eventsWithCounts,
      total: eventsWithCounts.length
    });

  } catch (error) {
    console.error('Error in world-events API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

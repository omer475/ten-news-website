// API endpoint to fetch world events for the first page
// Returns active events sorted by update count, recency, importance
// OPTIMIZED: Single query approach with minimal data transfer and timeout handling

import { createClient } from '@supabase/supabase-js';

// Create Supabase client - use anon key as fallback if service key not available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // AGGRESSIVE caching to reduce database load (5 min cache, 10 min stale-while-revalidate)
  // This significantly reduces Disk IO usage
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for Supabase configuration
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return res.status(500).json({ error: 'Database configuration error', events: [], total: 0 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { since, limit = 8 } = req.query;
    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log('📍 Fetching world events, limit:', limit);

    // Fetch active world events with timeout protection
    // Images are now stored as URLs in Supabase Storage (not base64), safe to fetch
    const eventsPromise = supabase
      .from('world_events')
      .select(`
        id, name, slug, image_url, cover_image_url, blur_color, importance, status, last_article_at, created_at, background
      `)
      .eq('status', 'ongoing')
      .order('last_article_at', { ascending: false })
      .limit(parseInt(limit));

    // Add timeout of 25 seconds to prevent Vercel function timeout (Vercel limit is 30s)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), 25000)
    );

    const { data: events, error } = await Promise.race([eventsPromise, timeoutPromise]);

    if (error) {
      console.error('Error fetching world events:', error);
      return res.status(500).json({ error: 'Failed to fetch events', events: [], total: 0 });
    }

    if (!events || events.length === 0) {
      console.log('📍 No ongoing events found');
      return res.status(200).json({ events: [], total: 0 });
    }

    console.log('📍 Found', events.length, 'events');

    // OPTIMIZATION: Get article counts in a single batch query with timeout
    const eventIds = events.map(e => e.id);
    let countMap = {};
    
    try {
      const countPromise = supabase
        .from('article_world_events')
        .select('event_id')
        .in('event_id', eventIds)
        .gte('tagged_at', sinceDate.toISOString());

      const countTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Count query timeout')), 15000)
      );

      const { data: articleCounts, error: countError } = await Promise.race([countPromise, countTimeout]);

      if (!countError && articleCounts) {
        for (const row of articleCounts) {
          countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
        }
      }
    } catch (countErr) {
      console.log('⚠️ Article count query failed (non-critical):', countErr.message);
      // Continue without counts - not critical
    }

    // Add counts to events
    // Safety: filter out any remaining base64 images (should all be URLs now after migration)
    const safeImageUrl = (url) => (url && url.startsWith('data:')) ? null : (url || null);
    
    const eventsWithCounts = events.map(event => ({
      id: event.id,
      name: event.name,
      slug: event.slug,
      image_url: safeImageUrl(event.cover_image_url) || safeImageUrl(event.image_url),
      cover_image_url: safeImageUrl(event.cover_image_url),
      blur_color: event.blur_color,
      importance: event.importance,
      status: event.status,
      last_article_at: event.last_article_at,
      created_at: event.created_at,
      background: event.background,
      newUpdates: countMap[event.id] || 0
    }));

    // Sort by: update count (desc) → last_article_at (desc) → importance (desc)
    eventsWithCounts.sort((a, b) => {
      if (b.newUpdates !== a.newUpdates) return b.newUpdates - a.newUpdates;
      const aTime = new Date(a.last_article_at || a.created_at).getTime();
      const bTime = new Date(b.last_article_at || b.created_at).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return (b.importance || 5) - (a.importance || 5);
    });
    
    console.log('📍 Returning', eventsWithCounts.length, 'events');
    
    return res.status(200).json({
      events: eventsWithCounts,
      total: eventsWithCounts.length
    });

  } catch (error) {
    console.error('Error in world-events API:', error);
    // Return empty events array instead of error to prevent UI breaking
    return res.status(200).json({ 
      error: error.message || 'Internal server error',
      events: [], 
      total: 0 
    });
  }
}

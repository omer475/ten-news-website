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

    // OPTIMIZATION: Get article counts + countries/topics in batch queries with timeout
    const eventIds = events.map(e => e.id);
    let countMap = {};
    let eventTagsMap = {}; // { eventId: { countries: [...], topics: [...] } }
    
    try {
      // Get article IDs linked to these events
      const linkPromise = supabase
        .from('article_world_events')
        .select('event_id, article_id, tagged_at')
        .in('event_id', eventIds);

      const linkTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Link query timeout')), 15000)
      );

      const { data: articleLinks, error: linkError } = await Promise.race([linkPromise, linkTimeout]);

      if (!linkError && articleLinks) {
        // Count articles since sinceDate for update counts
        for (const row of articleLinks) {
          if (new Date(row.tagged_at) >= sinceDate) {
            countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
          }
        }

        // Get unique article IDs to fetch their countries/topics
        const articleIds = [...new Set(articleLinks.map(l => l.article_id))];
        
        if (articleIds.length > 0) {
          try {
            const tagsPromise = supabase
              .from('published_articles')
              .select('id, countries, topics')
              .in('id', articleIds.slice(0, 200)); // Limit to prevent too-large queries

            const tagsTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Tags query timeout')), 10000)
            );

            const { data: articleTags, error: tagsError } = await Promise.race([tagsPromise, tagsTimeout]);

            if (!tagsError && articleTags) {
              // Build a map of article_id -> { countries, topics }
              const articleTagMap = {};
              for (const art of articleTags) {
                const countries = typeof art.countries === 'string' ? JSON.parse(art.countries || '[]') : (art.countries || []);
                const topics = typeof art.topics === 'string' ? JSON.parse(art.topics || '[]') : (art.topics || []);
                articleTagMap[art.id] = { countries, topics };
              }

              // Aggregate countries/topics per event
              for (const link of articleLinks) {
                if (!eventTagsMap[link.event_id]) {
                  eventTagsMap[link.event_id] = { countries: {}, topics: {} };
                }
                const tags = articleTagMap[link.article_id];
                if (tags) {
                  for (const c of tags.countries) {
                    eventTagsMap[link.event_id].countries[c] = (eventTagsMap[link.event_id].countries[c] || 0) + 1;
                  }
                  for (const t of tags.topics) {
                    eventTagsMap[link.event_id].topics[t] = (eventTagsMap[link.event_id].topics[t] || 0) + 1;
                  }
                }
              }
            }
          } catch (tagsErr) {
            console.log('⚠️ Article tags query failed (non-critical):', tagsErr.message);
          }
        }
      }
    } catch (countErr) {
      console.log('⚠️ Article link query failed (non-critical):', countErr.message);
      // Continue without counts/tags - not critical
    }

    // Add counts and tags to events
    // Safety: filter out base64 images (must be storage URLs for fast loading)
    const safeImageUrl = (url) => (url && typeof url === 'string' && !url.startsWith('data:')) ? url : null;
    
    const eventsWithCounts = events.map(event => {
      // For event box cards: prefer cover_image_url (4:5), fallback to image_url (hero)
      const coverUrl = safeImageUrl(event.cover_image_url);
      const heroUrl = safeImageUrl(event.image_url);
      
      // Get top countries/topics for this event (sorted by frequency)
      const eventTags = eventTagsMap[event.id];
      const countries = eventTags 
        ? Object.entries(eventTags.countries).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5)
        : [];
      const topics = eventTags
        ? Object.entries(eventTags.topics).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5)
        : [];
      
      return {
        id: event.id,
        name: event.name,
        slug: event.slug,
        // image_url is what the frontend uses for the event card - prefer cover, fallback to hero
        image_url: coverUrl || heroUrl,
        blur_color: event.blur_color,
        importance: event.importance,
        status: event.status,
        last_article_at: event.last_article_at,
        created_at: event.created_at,
        background: event.background,
        newUpdates: countMap[event.id] || 0,
        countries,  // For personalization on first page
        topics      // For personalization on first page
      };
    });

    // Sort by most recently updated first (latest article wins)
    eventsWithCounts.sort((a, b) => {
      const aTime = new Date(a.last_article_at || a.created_at).getTime();
      const bTime = new Date(b.last_article_at || b.created_at).getTime();
      return bTime - aTime;
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

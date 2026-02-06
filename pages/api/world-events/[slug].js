// API endpoint to fetch a single world event's full details
// Used by the event detail page

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Cache event details for 3 minutes to reduce database load
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=360');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    // Fetch event with timeline and latest development
    // Try to fetch all columns including new ones (started_at, ends_at, components)
    let event, error;
    
    // First try with all columns (including new ones)
    // Images are now stored as URLs in Supabase Storage (not base64), safe to fetch
    const fullQuery = await supabase
      .from('world_events')
      .select(`
        id,
        name,
        slug,
        topic_prompt,
        image_url,
        cover_image_url,
        blur_color,
        background,
        key_facts,
        status,
        importance,
        created_at,
        started_at,
        ends_at,
        day_counter_type,
        show_day_counter,
        components,
        timeline:world_event_timeline(
          id,
          date,
          headline,
          source_article_id
        ),
        latest:world_event_latest(
          title,
          summary,
          image_url,
          published_at,
          components
        )
      `)
      .eq('slug', slug)
      .single();
    
    if (fullQuery.error && fullQuery.error.code === 'PGRST204') {
      // Column doesn't exist, try with base schema only
      const baseQuery = await supabase
        .from('world_events')
        .select(`
          id,
          name,
          slug,
          topic_prompt,
          image_url,
          cover_image_url,
          blur_color,
          background,
          key_facts,
          status,
          importance,
          created_at,
          timeline:world_event_timeline(
            id,
            date,
            headline,
            source_article_id
          ),
          latest:world_event_latest(
            title,
            summary,
            image_url,
            published_at,
            components
          )
        `)
        .eq('slug', slug)
        .single();
      
      event = baseQuery.data;
      error = baseQuery.error;
    } else {
      event = fullQuery.data;
      error = fullQuery.error;
    }

    if (error) {
      console.error('Event fetch error:', error);
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Sort timeline by date (oldest first for display)
    if (event.timeline && event.timeline.length > 0) {
      event.timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Flatten latest (can come as array or single object from Supabase depending on relationship)
    let latestDev = null;
    if (event.latest) {
      // Handle both array and single object cases
      const latest = Array.isArray(event.latest) 
        ? (event.latest.length > 0 ? event.latest[0] : null)
        : event.latest;
      
      if (latest && (latest.title || latest.summary)) {
        latestDev = {
          title: latest.title,
          summary: latest.summary,
          image: latest.image_url,
          time: formatTimeAgo(latest.published_at),
          components: latest.components || {}
        };
      }
    }

    // Get total article count for this event
    const { count: totalArticles } = await supabase
      .from('article_world_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id);

    // Fetch linked articles for live updates feed (most recent 20)
    const { data: linkedArticleIds } = await supabase
      .from('article_world_events')
      .select('article_id, tagged_at')
      .eq('event_id', event.id)
      .order('tagged_at', { ascending: false })
      .limit(20);

    // Fetch actual article details including components for the latest article
    let liveUpdates = [];
    let latestArticleComponents = null;
    
    if (linkedArticleIds && linkedArticleIds.length > 0) {
      const articleIds = linkedArticleIds.map(a => a.article_id);
      
      // Fetch all articles for live updates
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, one_liner, image_url, category, published_at, created_at')
        .in('id', articleIds)
        .order('published_at', { ascending: false });

      if (articles) {
        liveUpdates = articles.map(article => ({
          id: article.id,
          title: article.title,
          summary: article.one_liner,
          image: article.image_url,
          category: article.category,
          time: formatTimeAgo(article.published_at || article.created_at),
          publishedAt: article.published_at || article.created_at
        }));
      }
      
      // Fetch full details for the LATEST article (including graph, details, map)
      const latestArticleId = linkedArticleIds[0]?.article_id;
      if (latestArticleId) {
        const { data: latestArticle } = await supabase
          .from('articles')
          .select('id, title, one_liner, image_url, category, published_at, graph, details, map, info_boxes')
          .eq('id', latestArticleId)
          .single();
        
        if (latestArticle) {
          latestArticleComponents = {
            articleId: latestArticle.id,
            title: latestArticle.title,
            graph: latestArticle.graph || null,
            details: latestArticle.details || null,
            map: latestArticle.map || null,
            infoBoxes: latestArticle.info_boxes || null
          };
        }
      }
    }

    // Smart event components (perspectives, what_to_watch, etc.) from world_events.components
    const smartComponents = event.components || {};
    
    // Article components from world_event_latest.components (graph, details, info_boxes)
    // These are stored when an article is linked to the event
    const latestArticleComponentsFromDB = (event.latest && Array.isArray(event.latest) && event.latest.length > 0)
      ? event.latest[0].components || {}
      : {};

    // Day counter fields may not exist in database yet - default to null/false
    const startedAt = event.started_at || null;
    const endsAt = event.ends_at || null;
    const dayCounterType = event.day_counter_type || null;
    const showDayCounter = event.show_day_counter || false;

    // Calculate day counter based on day_counter_type
    const dayCounter = calculateDayCounter({
      ...event,
      started_at: startedAt,
      ends_at: endsAt,
      day_counter_type: dayCounterType,
      show_day_counter: showDayCounter
    });

    // Merge article components into latestDevelopment if not already there
    // Priority: world_event_latest.components > freshly fetched from articles table
    const finalLatestDev = latestDev ? {
      ...latestDev,
      components: Object.keys(latestDev.components || {}).length > 0 
        ? latestDev.components 
        : (latestArticleComponents ? {
            graph: latestArticleComponents.graph,
            details: latestArticleComponents.details,
            map: latestArticleComponents.map,
            info_boxes: latestArticleComponents.infoBoxes,
            source_article_id: latestArticleComponents.articleId
          } : {})
    } : null;

    // Safety: filter out any remaining base64 images (should all be URLs now after migration)
    const safeImageUrl = (url) => (url && url.startsWith('data:')) ? null : (url || null);
    
    // For event page hero: prefer image_url (thumbnail), then article image, then cover
    // Event boxes use cover_image_url, so event page should use a different image
    const firstArticleImage = (liveUpdates && liveUpdates.length > 0) 
      ? safeImageUrl(liveUpdates[0].image) 
      : null;
    const heroImage = safeImageUrl(event.image_url) 
      || firstArticleImage 
      || safeImageUrl(event.cover_image_url);
    
    return res.status(200).json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        topicPrompt: event.topic_prompt,
        imageUrl: heroImage,
        coverImageUrl: safeImageUrl(event.cover_image_url),
        thumbnailUrl: safeImageUrl(event.image_url),
        blurColor: event.blur_color,
        background: event.background,
        keyFacts: event.key_facts || [],
        status: event.status,
        importance: event.importance,
        startedAt: startedAt,
        endsAt: endsAt,
        dayCounterType: dayCounterType,
        showDayCounter: showDayCounter,
        // Smart event components (perspectives, what_to_watch, geographic_impact, historical_comparison)
        components: smartComponents,
        createdAt: event.created_at,
        // Latest development with article components (graph, details, info_boxes)
        latestDevelopment: finalLatestDev,
        timeline: event.timeline ? event.timeline.map(t => ({
          id: t.id,
          date: t.date,
          headline: t.headline,
          source_article_id: t.source_article_id
        })) : [],
        totalArticles: totalArticles || 0,
        liveUpdates: liveUpdates,
        dayCounter: dayCounter
      }
    });

  } catch (error) {
    console.error('Error fetching world event:', error);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
}

// Calculate day counter based on day_counter_type
function calculateDayCounter(event) {
  if (!event.show_day_counter) {
    return null;
  }

  const now = new Date();
  const type = event.day_counter_type;

  // Calculate days since start (if applicable)
  let daysSince = null;
  if (event.started_at && (type === 'days_since' || type === 'both')) {
    daysSince = Math.floor((now - new Date(event.started_at)) / (1000 * 60 * 60 * 24));
  }

  // Calculate days until end (if applicable)
  let daysUntil = null;
  if (event.ends_at && (type === 'days_until' || type === 'both')) {
    daysUntil = Math.ceil((new Date(event.ends_at) - now) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) daysUntil = 0; // Event has ended
  }

  // Build label based on type
  let label = '';
  if (type === 'days_since' && daysSince !== null) {
    label = `Day ${daysSince}`;
  } else if (type === 'days_until' && daysUntil !== null) {
    if (daysUntil === 0) {
      label = 'Final Day';
    } else if (daysUntil === 1) {
      label = 'Ends Tomorrow';
    } else {
      label = `Ends in ${daysUntil} days`;
    }
  } else if (type === 'both' && daysSince !== null && daysUntil !== null) {
    if (daysUntil === 0) {
      label = `Day ${daysSince} • Final Day`;
    } else {
      label = `Day ${daysSince} • Ends in ${daysUntil} days`;
    }
  }

  if (!label) {
    // Fallback for show_day_counter = true but no type specified
    if (event.started_at) {
      daysSince = Math.floor((now - new Date(event.started_at)) / (1000 * 60 * 60 * 24));
      label = `Day ${daysSince}`;
    } else {
      return null;
    }
  }

  return {
    type: type || 'days_since',
    daysSince: daysSince,
    daysUntil: daysUntil,
    startDate: event.started_at,
    endDate: event.ends_at,
    label: label
  };
}

// Helper to format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper to format time ago
function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
}

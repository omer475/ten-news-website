// API endpoint to fetch a single world event's full details
// Used by the event detail page

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    // Fetch the main event
    const { data: event, error: eventError } = await supabase
      .from('world_events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Fetch latest development
    const { data: latest, error: latestError } = await supabase
      .from('world_event_latest')
      .select('*')
      .eq('event_id', event.id)
      .single();

    // Fetch timeline (most recent first, limit 10)
    const { data: timeline, error: timelineError } = await supabase
      .from('world_event_timeline')
      .select('*')
      .eq('event_id', event.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(10);

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

    // Fetch actual article details
    let liveUpdates = [];
    if (linkedArticleIds && linkedArticleIds.length > 0) {
      const articleIds = linkedArticleIds.map(a => a.article_id);
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
    }

    // Calculate day counter (days since event ACTUALLY started)
    // Uses started_at from database (real start date found via AI) or falls back to created_at
    const eventStartDate = event.started_at || event.created_at;
    const daysSinceStart = Math.floor((new Date() - new Date(eventStartDate)) / (1000 * 60 * 60 * 24));
    
    // Determine if this event should show day counter
    // Priority: 1) Database flag (show_day_counter), 2) Keyword matching for long-running events
    let shouldShowDayCounter = false;
    
    if (event.show_day_counter === true) {
      // Explicitly enabled in database
      shouldShowDayCounter = true;
    } else if (event.show_day_counter === false) {
      // Explicitly disabled in database
      shouldShowDayCounter = false;
    } else {
      // Fallback: Auto-detect based on keywords and duration
      const dayCounterKeywords = ['war', 'conflict', 'crisis', 'siege', 'invasion', 'occupation', 'blockade', 'protest', 'strike', 'uprising'];
      shouldShowDayCounter = daysSinceStart >= 7 && dayCounterKeywords.some(keyword => 
        event.name.toLowerCase().includes(keyword) || 
        (event.topic_prompt && event.topic_prompt.toLowerCase().includes(keyword))
      );
    }

    return res.status(200).json({
      event: {
        ...event,
        latestDevelopment: latest ? {
          title: latest.title,
          summary: latest.summary,
          image: latest.image_url,
          time: formatTimeAgo(latest.published_at),
          components: latest.components || {}
        } : null,
        timeline: timeline ? timeline.map(t => ({
          date: formatDate(t.date),
          time: t.time,
          headline: t.headline,
          summary: t.summary,
          significance: t.significance,
          articleId: t.source_article_id
        })) : [],
        keyFacts: event.key_facts || [],
        background: event.background,
        totalArticles: totalArticles || 0,
        liveUpdates: liveUpdates,
        dayCounter: shouldShowDayCounter ? {
          days: daysSinceStart,
          startDate: eventStartDate,
          label: `Day ${daysSinceStart}`
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching world event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
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

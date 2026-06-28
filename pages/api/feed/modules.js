// GET /api/feed/modules?user_id=... — interstitial-module content for the
// TodayPlus feed. Produces personalized selections from the daily tagged POOLS
// the pipeline writes (history pool, notd candidates, upcoming_events), using
// the same declared-interest signal Trinity uses. Guests / no-interest users
// fall back to a global selection (cacheable).
//
// ADDITIVE contract (2026-06-28): the legacy `modules.{history,notd,briefs,
// countdowns}` shape is preserved (existing consumer keeps working) AND richer
// top-level fields are added (countdown_primary, countdown_cards, history with
// per-row major flag + image, story-linked notd) for the redesigned consumer.
//   history.rows row = [year, text, image_url, [topic_tags], major]
//   notd          = { value, prefix, unit, context, source_article_id, topic_tags }
//   countdown_*    = { id?, name, datetime, context, source_article_id, topic_tags }
// MARKET PULSE is intentionally absent — live quotes are fetched client-side.

import { createClient } from '@supabase/supabase-js';
import { getUserInterestTags, tagMatchScore } from '../../../lib/userInterestTags.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Pick `n` best-matching items by topic_tags, stable on the original order
// (which is impact/soonest order) when scores tie or there's no user signal.
function rankByTags(items, getTags, userTags, n) {
  return items
    .map((it, i) => ({ it, i, s: tagMatchScore(getTags(it), userTags) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .slice(0, n)
    .map(x => x.it);
}

function selectHistory(pool, userTags) {
  if (!Array.isArray(pool) || !pool.length) return null;
  const major = pool.find(r => Array.isArray(r) && r[4] === true) || pool[0];
  const rest = pool.filter(r => r !== major);
  const matched = rankByTags(rest, r => (Array.isArray(r) ? r[3] : []) || [], userTags, 2);
  return [major, ...matched].filter(Boolean).slice(0, 3);
}

function normCountdown(e) {
  return {
    id: e.id,
    name: e.name,
    datetime: e.event_date,
    context: e.context || '',
    source_article_id: e.source_article_id ?? null,
    topic_tags: e.topic_tags || [],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = req.query.user_id || null;

    // Newest row per module type (global pools the pipeline writes).
    const { data, error } = await supabase
      .from('feed_modules')
      .select('module_date, module_type, payload')
      .order('module_date', { ascending: false })
      .limit(12);
    if (error) {
      console.error('Error fetching feed modules:', error);
      return res.status(500).json({ error: 'Failed to fetch modules' });
    }
    const pools = {};
    let moduleDate = null;
    for (const row of data || []) {
      if (!pools[row.module_type]) {
        pools[row.module_type] = row.payload;
        if (!moduleDate) moduleDate = row.module_date;
      }
    }

    // Upcoming-events pool (personalized countdowns) — future only, soonest first.
    let upcoming = [];
    try {
      const { data: ev } = await supabase
        .from('upcoming_events')
        .select('id, name, event_date, topic_tags, context, source_article_id')
        .gt('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(40);
      upcoming = ev || [];
    } catch (e) {
      console.error('[modules] upcoming_events fetch failed:', e.message);
    }

    const { tags: userTags, personalized } = await getUserInterestTags(supabase, userId);

    // ── history: 1 major + 2 interest-matched (or 2 most-impactful) ──
    const histPool = pools.history?.rows || [];
    const histRows = selectHistory(histPool, userTags) || [];
    const history = histPool.length
      ? { rows: histRows, style: pools.history?.style, style_index: pools.history?.style_index }
      : null;

    // ── notd: best-matching candidate (fallback first / hoisted) ──
    const notdCands = Array.isArray(pools.notd?.candidates) && pools.notd.candidates.length
      ? pools.notd.candidates
      : (pools.notd ? [pools.notd] : []);
    const notd = notdCands.length
      ? rankByTags(notdCands, c => c.topic_tags || [], userTags, 1)[0]
      : null;

    // ── countdowns: primary + up to 3 cards, personalized ──
    const ranked = upcoming
      .map((e, i) => ({ e, i, s: tagMatchScore(e.topic_tags || [], userTags) }))
      .sort((a, b) => (b.s - a.s) || (new Date(a.e.event_date) - new Date(b.e.event_date)));
    const countdown_primary = ranked.length ? normCountdown(ranked[0].e) : null;
    const countdown_cards = ranked.slice(1, 4).map(x => normCountdown(x.e));

    // ── briefs: global, unchanged ──
    const briefs = pools.briefs || null;

    // Legacy `modules` object — preserved so the current consumer keeps working,
    // but with personalized selections filled in.
    const modules = { ...pools };
    if (history) modules.history = history;
    if (notd) modules.notd = notd;
    if (briefs) modules.briefs = briefs;
    // global soonest countdowns (old contract shape) — keep the pipeline's
    // feed_modules.countdowns if present, else derive from upcoming_events.
    if (!modules.countdowns) {
      modules.countdowns = { rows: upcoming.slice(0, 6).map(e => ({
        name: e.name, datetime: e.event_date, context: e.context || '' })) };
    }

    // Personalized responses must not be shared-cached; global ones are.
    res.setHeader('Cache-Control', personalized
      ? 'private, max-age=60, stale-while-revalidate=120'
      : 's-maxage=900, stale-while-revalidate=3600');

    return res.status(200).json({
      date: moduleDate,
      personalized,
      modules,                 // legacy shape (current frontend)
      // richer top-level fields (redesigned consumer):
      history,
      notd,
      briefs,
      countdown_primary,
      countdown_cards,
    });
  } catch (e) {
    console.error('feed/modules error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

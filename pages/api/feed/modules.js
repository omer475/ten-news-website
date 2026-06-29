// GET /api/feed/modules?user_id=...&seen_ids=h:..,n:..,b:..,123
//
// Personalized + SEEN-AWARE interstitial modules. Selects from the daily tagged
// POOLS the pipeline writes (history pool, notd candidates, upcoming_events),
// rotating on each refresh: every item carries a STABLE id, and items whose id
// is in seen_ids are skipped. Returns empty/null per module when its pool is
// exhausted (frontend shows nothing). A read item is never repeated.
//
// ADDITIVE: legacy modules.{history,notd,briefs,countdowns} stay populated
// (now personalized + rotating) AND richer fields are added —
// modules.countdown_primary / modules.countdown_cards, history rows reshaped to
// [year, text, image_url, major] with a parallel modules.history.ids[], notd
// with source_article_id + title. notd.value is PRE-SCALED by the pipeline.
//
// Stable ids: history "h:<date>:<idx>", notd "n:<date>:<idx>",
// briefs "b:<date>:<idx>", countdowns = upcoming_events.id (number).
//
// Caching: NO shared CDN cache (rotation is per-user + per-seen-set).

import { createClient } from '@supabase/supabase-js';
import { getUserInterestTags, tagMatchScore } from '../../../lib/userInterestTags.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function parseSeen(q) {
  if (!q) return new Set();
  return new Set(String(q).split(',').map(s => s.trim()).filter(Boolean));
}

// Rank items by topic-tag match (stable on original order), take n.
function rankByTags(items, getTags, userTags, n) {
  return items
    .map((it, i) => ({ it, i, s: tagMatchScore(getTags(it), userTags) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .slice(0, n)
    .map(x => x.it);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = req.query.user_id || null;
    const seen = parseSeen(req.query.seen_ids);

    const { data, error } = await supabase
      .from('feed_modules')
      .select('module_date, module_type, payload')
      .order('module_date', { ascending: false })
      .limit(12);
    if (error) { console.error('Error fetching feed modules:', error); return res.status(500).json({ error: 'Failed to fetch modules' }); }
    const pools = {};
    let moduleDate = null;
    for (const row of data || []) {
      if (!pools[row.module_type]) { pools[row.module_type] = row.payload; if (!moduleDate) moduleDate = row.module_date; }
    }
    const date = moduleDate || 'na';

    let upcoming = [];
    try {
      const { data: ev } = await supabase
        .from('upcoming_events')
        .select('id, name, event_date, topic_tags, context, source_article_id, confidence')
        .gt('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(60);
      upcoming = ev || [];
    } catch (e) { console.error('[modules] upcoming_events fetch failed:', e.message); }

    const { tags: userTags, personalized } = await getUserInterestTags(supabase, userId);

    // ── history: major (if unseen) + interest-matched, rotating ──
    const histPool = (pools.history?.rows || []).map((r, i) => ({
      id: `h:${date}:${i}`, year: r[0], text: r[1], img: r[2] ?? null,
      tags: Array.isArray(r[3]) ? r[3] : [], major: r[4] === true,
    }));
    let history = null;
    if (histPool.length) {
      const unseen = histPool.filter(it => !seen.has(it.id));
      const major = unseen.find(it => it.major);
      const rest = unseen.filter(it => it !== major);
      const matched = rankByTags(rest, it => it.tags, userTags, major ? 2 : 3);
      const chosen = (major ? [major, ...matched] : matched).slice(0, 3);
      history = {
        rows: chosen.map(it => [it.year, it.text, it.img, it.major]),
        ids: chosen.map(it => it.id),
        style: pools.history?.style, style_index: pools.history?.style_index,
      };
    }

    // ── notd: best unseen candidate (pre-scaled, story-linked) ──
    const notdRaw = (Array.isArray(pools.notd?.candidates) && pools.notd.candidates.length)
      ? pools.notd.candidates : (pools.notd ? [pools.notd] : []);
    const notdItems = notdRaw.map((c, i) => ({ id: `n:${date}:${i}`, ...c, topic_tags: c.topic_tags || [] }));
    const notdUnseen = notdItems.filter(it => !seen.has(it.id));
    const notd = notdUnseen.length ? rankByTags(notdUnseen, c => c.topic_tags, userTags, 1)[0] : null;

    // ── briefs: 3 unseen from the pool ──
    const briefPool = (pools.briefs?.rows || []).map((b, i) => ({ id: `b:${date}:${i}`, tag: b.tag, text: b.text }));
    const briefsUnseen = briefPool.filter(it => !seen.has(it.id)).slice(0, 3);
    const briefs = briefPool.length ? { rows: briefsUnseen } : null;

    // ── countdowns: primary + cards, unseen, personalized ──
    const cdUnseen = upcoming
      .map(e => ({ id: e.id, name: e.name, datetime: e.event_date, context: e.context || '',
                   source_article_id: e.source_article_id ?? null, topic_tags: e.topic_tags || [], confidence: e.confidence }))
      .filter(e => !seen.has(String(e.id)));
    const cdRanked = cdUnseen
      .map((e, i) => ({ e, i, s: tagMatchScore(e.topic_tags, userTags) }))
      .sort((a, b) => (b.s - a.s) || (new Date(a.e.datetime) - new Date(b.e.datetime)))
      .map(x => x.e);
    const countdown_primary = cdRanked.length ? cdRanked[0] : null;
    const countdown_cards = cdRanked.slice(1, 4);

    // legacy modules object — populated with the personalized selection + new fields nested
    const modules = { ...pools };
    if (history) modules.history = history;
    if (notd) modules.notd = notd;
    if (briefs) modules.briefs = briefs;
    const cdList = (countdown_primary ? [countdown_primary, ...countdown_cards] : countdown_cards);
    modules.countdowns = { rows: cdList.map(e => ({ name: e.name, datetime: e.datetime, context: e.context })) };
    modules.countdown_primary = countdown_primary;
    modules.countdown_cards = countdown_cards;

    // Rotation is per-user + per-seen-set — never shared-cache.
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).json({
      date: moduleDate,
      personalized,
      modules,                 // legacy shape (now personalized + rotating)
      history, notd, briefs, countdown_primary, countdown_cards,
    });
  } catch (e) {
    console.error('feed/modules error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// POST /api/bundles — personalized "story bundles" (a named header + 2-4 articles).
//
// Mix of the biggest stories everyone should see + bundles matched to the user.
// Stateless / guest-friendly: the client passes its own personalization signals
// (interests, followed topics, home country, read article ids).
//
// Request body (all optional):
//   { interests: string[], topics: string[], country: string,
//     readArticleIds: (string|number)[], limit?: number }
// Response:
//   { bundles: [ { id, header, slug, importance, isMajor, matchedInterests, articles:[{id,title,recap,image,url,category,date}] } ] }

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { groupByEvent, cleanBundle, dedupeBundles, rankBundles, shapeBundle, personalizeHeaders } from '../../lib/bundles';

const WINDOW_HOURS = 48;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    // `interests` accepts either a flat array (weight 1 each) OR the weighted map
    // from the site's reading-behavior engine: getUserInterests() -> {tag: weight}
    // where weight reflects reading seconds (60s read >> a 10s glance).
    const interests = new Map();
    if (Array.isArray(body.interests)) {
      body.interests.forEach((s) => interests.set(String(s).toLowerCase(), 1));
    } else if (body.interests && typeof body.interests === 'object') {
      for (const [k, w] of Object.entries(body.interests)) {
        interests.set(String(k).toLowerCase(), Number(w) || 1);
      }
    }
    const topics = new Set((body.topics || []).map((s) => String(s).toLowerCase()));
    const country = body.country ? String(body.country) : '';
    const readIds = new Set((body.readArticleIds || []).map((x) => String(x)));
    const limit = Math.min(10, Math.max(1, parseInt(body.limit, 10) || 6));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(200).json({ bundles: [] });
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    const cutoff = new Date(Date.now() - WINDOW_HOURS * 3600000).toISOString();

    // 1) Recently-tagged event links (bounded by recency, paginated past 1000).
    let links = [];
    for (let off = 0; off < 6000; off += 1000) {
      const { data, error } = await supabase
        .from('article_world_events')
        .select('article_id, event_id')
        .gte('tagged_at', cutoff)
        .range(off, off + 999);
      if (error) { console.error('bundles links error:', error.message); break; }
      if (!data || !data.length) break;
      links = links.concat(data);
      if (data.length < 1000) break;
    }
    if (!links.length) return res.status(200).json({ bundles: [] });

    const eventIds = [...new Set(links.map((l) => l.event_id))];
    const articleIds = [...new Set(links.map((l) => String(l.article_id)))];

    // 2) Ongoing events only (id -> name/slug).
    const eventMap = {};
    for (let i = 0; i < eventIds.length; i += 300) {
      const { data: evs } = await supabase
        .from('world_events').select('id, name, slug, status')
        .in('id', eventIds.slice(i, i + 300)).eq('status', 'ongoing');
      (evs || []).forEach((e) => { eventMap[e.id] = e; });
    }

    // 3) The articles themselves (fresh window), chunked.
    const artMap = {};
    const artFields = 'id, title_news, ai_final_score, interest_tags, image_url, url, published_at, created_at, summary_bullets_news, category, countries';
    for (let i = 0; i < articleIds.length; i += 400) {
      const { data: arts } = await supabase
        .from('published_articles').select(artFields)
        .in('id', articleIds.slice(i, i + 400))
        .gte('created_at', cutoff);
      (arts || []).forEach((a) => { artMap[String(a.id)] = a; });
    }

    // 4) Build joined rows (only links whose event is ongoing AND article is fresh).
    const rows = [];
    for (const l of links) {
      const ev = eventMap[l.event_id];
      const art = artMap[String(l.article_id)];
      if (!ev || !art) continue;
      rows.push({ event_id: l.event_id, event_name: ev.name, event_slug: ev.slug, ...art });
    }
    if (!rows.length) return res.status(200).json({ bundles: [] });

    // 5) Group -> clean (drop mis-tags) -> dedupe (merge overlaps) -> rank -> shape.
    const grouped = groupByEvent(rows);
    const cleaned = grouped.map(cleanBundle).filter(Boolean);
    const deduped = dedupeBundles(cleaned);
    const ranked = rankBundles(deduped, { interests, topics, country }, { limit });
    // Rewrite the clinical event names into warm, personal headers (cached).
    await personalizeHeaders(ranked, Date.now());
    const bundles = ranked
      .map((b) => shapeBundle(b, readIds))
      .filter((b) => b.articles.length >= 2);

    return res.status(200).json({ bundles });
  } catch (e) {
    console.error('bundles error:', e?.message || e);
    return res.status(200).json({ bundles: [] });
  }
}

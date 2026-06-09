// GET /api/threads/recap?articleId=<id>&readIds=<csv> — "The thread so far"
//
// Returns a short, clean recap of the previous key moments in the story that
// the given article continues: a chronological list of prior articles in the
// same thread, each with a one-line recap (its first summary bullet), flagged
// for whether the user already read it. When the thread maps to an editorial
// world event, we also return the event slug/name so the client can deep-link
// to the full event page.
//
// Response:
//   {
//     threadKey, title, eventSlug, eventName,
//     priorReadCount,
//     items: [{ id, title, recap, date, url, wasRead }]   // oldest -> newest
//   }

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  toThreadItem, sameThread, threadLabelFromItems,
  THREAD_WINDOW_DAYS, THREAD_MAX_ITEMS,
} from '../../../lib/threads';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const articleId = String(req.query.articleId || '').trim();
  if (!articleId) return res.status(400).json({ error: 'articleId required' });
  const readIds = new Set(
    String(req.query.readIds || '').split(',').map((s) => s.trim()).filter(Boolean)
  );

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(200).json(empty(null));
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    const fields = 'id, vq_secondary, interest_tags, title_news, summary_bullets_news, published_at, created_at, url, ai_final_score';

    const { data: anchorRows } = await supabase
      .from('published_articles').select(fields).eq('id', articleId).limit(1);
    if (!anchorRows || !anchorRows.length) return res.status(200).json(empty(null));
    const anchor = toThreadItem(anchorRows[0]);
    if (anchor.vq == null) return res.status(200).json(empty(anchor.vq));

    // Candidate pool: same cluster, within the thread window.
    const cutoff = new Date(Date.now() - THREAD_WINDOW_DAYS * 86400000).toISOString();
    const { data: poolRows } = await supabase
      .from('published_articles')
      .select(fields)
      .eq('vq_secondary', anchor.vq)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(200);

    const inThread = (poolRows || [])
      .map(toThreadItem)
      .filter((it) => sameThread(anchor, it));

    // Count ALL prior reads in the thread (before we collapse for display).
    const priorReadCount = inThread.filter((it) => readIds.has(it.id)).length;

    // Keep the most significant moment per day. Prefer an article the user
    // actually read (so the "you read this" dots reflect their real history),
    // then highest score. Chronological asc for a clean "story so far".
    const byDay = new Map();
    for (const it of inThread) {
      const day = (it.date || '').slice(0, 10);
      const cur = byDay.get(day);
      const itRead = readIds.has(it.id) ? 1 : 0;
      const curRead = cur && readIds.has(cur.id) ? 1 : 0;
      if (!cur || itRead > curRead || (itRead === curRead && it.score > cur.score)) {
        byDay.set(day, it);
      }
    }
    let items = [...byDay.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (items.length > THREAD_MAX_ITEMS) {
      // keep the highest-signal moments, but never drop one the user read
      const ranked = [...items].sort((a, b) =>
        (readIds.has(b.id) - readIds.has(a.id)) || (b.score - a.score));
      const keep = new Set(ranked.slice(0, THREAD_MAX_ITEMS).map((i) => i.id));
      items = items.filter((i) => keep.has(i.id));
    }

    // Optional editorial event deep-link. Single-article event tags are noisy
    // (an article can be mis-tagged), so only trust an event that at least TWO
    // articles in this thread agree on. The display title always comes from the
    // thread's own shared tags, which are guaranteed relevant.
    let eventSlug = null, eventName = null;
    try {
      const threadIds = [anchor.id, ...inThread.map((i) => i.id)];
      const { data: evRows } = await supabase
        .from('article_world_events').select('article_id, event_id').in('article_id', threadIds);
      if (evRows && evRows.length) {
        const tally = new Map();
        evRows.forEach((r) => tally.set(r.event_id, (tally.get(r.event_id) || 0) + 1));
        const [topEvent, topCount] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] || [];
        if (topEvent && topCount >= 2) {
          const { data: we } = await supabase
            .from('world_events').select('slug, name').eq('id', topEvent).limit(1);
          if (we && we.length) { eventSlug = we[0].slug || null; eventName = we[0].name || null; }
        }
      }
    } catch { /* event mapping is best-effort */ }

    const out = items.map((it) => ({
      id: it.id,
      title: it.title,
      recap: it.recap,
      date: it.date,
      url: it.url,
      wasRead: readIds.has(it.id),
    }));

    return res.status(200).json({
      threadKey: anchor.vq,
      title: threadLabelFromItems(anchor, items),
      eventSlug,
      eventName,
      priorReadCount,
      items: out,
    });
  } catch (e) {
    console.error('threads/recap error:', e?.message || e);
    return res.status(200).json(empty(null));
  }
}

function empty(threadKey) {
  return { threadKey, title: null, eventSlug: null, eventName: null, priorReadCount: 0, items: [] };
}

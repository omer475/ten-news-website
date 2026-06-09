// POST /api/threads/match — batch "does the user have history in these threads?"
//
// The website tracks read articles client-side (localStorage, via
// ReadArticleTracker) so it works for guests with no login. The client sends
// its read article IDs plus the feed cards currently on screen; we return, per
// card, whether it continues a thread the user already read from. The client
// uses that to draw the subtle "Continues from what you read before" dot/line.
//
// Stateless: we store nothing per-user. All personal history stays on-device.
//
// Request body:
//   { readArticleIds: (string|number)[], articleIds: (string|number)[] }
// Response:
//   { matches: { [articleId]: { continuesFromRead, priorReadCount, threadKey, threadSize } } }

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { toThreadItem, sameThread, THREAD_WINDOW_DAYS } from '../../../lib/threads';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const readArticleIds = (Array.isArray(body.readArticleIds) ? body.readArticleIds : [])
      .map((x) => String(x)).filter(Boolean);
    const articleIds = (Array.isArray(body.articleIds) ? body.articleIds : [])
      .map((x) => String(x)).filter(Boolean);

    if (!articleIds.length) return res.status(200).json({ matches: {} });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(200).json({ matches: {} });
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    // Fetch the thread descriptors (vq_secondary + specific tags) for both the
    // candidate cards and the user's read history, in one round trip each.
    const fields = 'id, vq_secondary, interest_tags, title_news, summary_bullets_news, published_at, created_at, url, ai_final_score';

    const { data: anchorRows } = await supabase
      .from('published_articles').select(fields).in('id', articleIds);
    const anchors = (anchorRows || []).map(toThreadItem);

    // Only the candidate clusters matter — narrow the read-history lookup to
    // those vq_secondary values so a huge read list stays cheap.
    const candidateVqs = [...new Set(anchors.map((a) => a.vq).filter((v) => v != null))];

    let reads = [];
    if (readArticleIds.length && candidateVqs.length) {
      const cutoff = new Date(Date.now() - THREAD_WINDOW_DAYS * 86400000).toISOString();
      const { data: readRows } = await supabase
        .from('published_articles')
        .select('id, vq_secondary, interest_tags')
        .in('id', readArticleIds)
        .in('vq_secondary', candidateVqs)
        .gte('created_at', cutoff);
      reads = (readRows || []).map(toThreadItem);
    }

    // Count how many cluster-siblings in this thread are also in the candidate
    // feed (so "threadSize" reflects a live, multi-article story).
    const matches = {};
    for (const anchor of anchors) {
      const priorReads = reads.filter((r) => sameThread(anchor, r));
      const liveSiblings = anchors.filter((a) => sameThread(anchor, a)).length;
      matches[anchor.id] = {
        continuesFromRead: priorReads.length > 0,
        priorReadCount: priorReads.length,
        threadKey: anchor.vq ?? null,
        threadSize: liveSiblings + 1,
      };
    }

    return res.status(200).json({ matches });
  } catch (e) {
    console.error('threads/match error:', e?.message || e);
    return res.status(200).json({ matches: {} });
  }
}

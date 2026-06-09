// Vercel cron — generates the day's "Quiet Deep Dive(s)".
//
// Auto-picks the most important ongoing story by score (preferring stories with
// several source articles, so the deep dive has real material to synthesise),
// writes a deeply-researched narrative piece with Gemini, and stores it in
// deep_dives. Runs once or twice a day. Idempotent per day per cluster: it
// skips a story already given a deep dive today.
//
// Manual trigger (seeding / testing):
//   GET /api/cron/deep-dive?count=1[&articleId=<id>]  with the CRON_SECRET bearer.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateDeepDive } from '../../../lib/deepDiveGenerator';

export const config = { maxDuration: 300 };

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const count = Math.min(2, Math.max(1, parseInt(req.query.count, 10) || 1));
  const forcedArticleId = req.query.articleId ? String(req.query.articleId) : null;
  const today = new Date().toISOString().slice(0, 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'supabase_not_configured' });
  const supabase = createSupabaseClient(supabaseUrl, serviceKey);

  const fields = 'id, vq_secondary, title_news, summary_bullets_news, details, category, image_url, published_at, created_at, ai_final_score';

  try {
    // Already-covered clusters today (idempotency).
    const { data: existing } = await supabase
      .from('deep_dives').select('vq_secondary, anchor_article_id').eq('dive_date', today);
    const usedVqs = new Set((existing || []).map((d) => d.vq_secondary).filter((v) => v != null));
    const alreadyCount = (existing || []).filter((d) => d.status !== 'failed').length;

    // Candidate anchors: highest-score articles from the last 36h.
    let candidates;
    if (forcedArticleId) {
      const { data } = await supabase.from('published_articles').select(fields).eq('id', forcedArticleId).limit(1);
      candidates = data || [];
    } else {
      // Anchor MUST be within the feed's 24h window so a normal card can carry
      // the "Go deep on this" entry point. (Source synthesis below still pulls
      // up to 4 days of cluster history for depth.)
      const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
      const { data, error } = await supabase
        .from('published_articles').select(fields)
        .gte('created_at', cutoff)
        .order('ai_final_score', { ascending: false, nullsFirst: false })
        .limit(60);
      if (error) console.error('deep-dive candidate query error:', error.message);
      candidates = data || [];
    }

    const results = [];
    let made = 0;
    for (const anchor of candidates) {
      if (alreadyCount + made >= count) break;
      if (!forcedArticleId && anchor.vq_secondary != null && usedVqs.has(anchor.vq_secondary)) continue;

      // Gather the cluster's source articles (the corpus to synthesise).
      let cluster = [anchor];
      if (anchor.vq_secondary != null) {
        const clusterCutoff = new Date(Date.now() - 4 * 86400000).toISOString();
        const { data: sib } = await supabase
          .from('published_articles').select(fields)
          .eq('vq_secondary', anchor.vq_secondary)
          .gte('created_at', clusterCutoff)
          .order('ai_final_score', { ascending: false, nullsFirst: false })
          .limit(12);
        if (sib && sib.length) cluster = sib;
      }

      // Reserve the slot (status=generating) so concurrent runs don't double up.
      const baseSlug = `${today}-${slugify(anchor.title_news || anchor.title || `story-${anchor.id}`)}`;
      const { data: reserved, error: resErr } = await supabase
        .from('deep_dives')
        .insert({
          dive_date: today, slug: baseSlug, status: 'generating',
          anchor_article_id: anchor.id, vq_secondary: anchor.vq_secondary ?? null,
          hero_image: anchor.image_url || null,
        })
        .select('id').single();
      if (resErr) { results.push({ anchor: anchor.id, skipped: resErr.message }); continue; }

      try {
        const dive = await generateDeepDive(anchor, cluster);
        await supabase.from('deep_dives').update({
          status: 'published',
          headline: dive.headline, dek: dive.dek,
          sections: dive.sections, reading_time_min: dive.reading_time_min,
          model: dive.model,
          sources: cluster.slice(0, 12).map((a) => ({
            id: String(a.id), title: (a.title_news || a.title || '').replace(/\*\*/g, ''),
          })),
          published_at: new Date().toISOString(),
        }).eq('id', reserved.id);
        if (anchor.vq_secondary != null) usedVqs.add(anchor.vq_secondary);
        made += 1;
        results.push({ id: reserved.id, slug: baseSlug, anchor: anchor.id, headline: dive.headline, status: 'published' });
      } catch (genErr) {
        await supabase.from('deep_dives').update({ status: 'failed', error: String(genErr?.message || genErr).slice(0, 500) }).eq('id', reserved.id);
        results.push({ anchor: anchor.id, status: 'failed', error: String(genErr?.message || genErr) });
        // try the next candidate
      }
    }

    return res.status(200).json({ ok: true, date: today, generated: made, results });
  } catch (e) {
    console.error('cron/deep-dive error:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

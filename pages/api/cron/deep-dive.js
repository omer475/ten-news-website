// Vercel cron — generates the day's "interesting read".
//
// NOT the day's top news. A standalone, genuinely fascinating topic (science,
// nature, geography, space, history, the human body…), researched live via
// Google Search grounding and written in plain, delightful language people read
// for the joy of learning something. Stored in deep_dives. Runs once a day.
// Idempotent: caps at `count` published reads per day, and tells the model which
// recent topics to avoid so picks stay fresh.
//
// Manual trigger (seeding / testing):
//   GET /api/cron/deep-dive?count=1  with the CRON_SECRET bearer (if configured).

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateInterestingDeepDive, pickInterestingTopic } from '../../../lib/deepDiveGenerator';

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
  const today = new Date().toISOString().slice(0, 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'supabase_not_configured' });
  const supabase = createSupabaseClient(supabaseUrl, serviceKey);

  try {
    // How many are already done today (idempotency / daily cap).
    const { data: existing } = await supabase
      .from('deep_dives').select('id, status').eq('dive_date', today);
    const alreadyCount = (existing || []).filter((d) => d.status !== 'failed').length;

    // Recent topics/headlines to avoid repeating.
    const { data: recent } = await supabase
      .from('deep_dives').select('headline').order('dive_date', { ascending: false }).limit(40);
    const avoidTopics = (recent || []).map((d) => d.headline).filter(Boolean);

    // Candidate seeds: EVERY article from the last 24h that has an image (we
    // reuse the article's photo as the read's hero). Paginated because Supabase
    // caps a single query at 1000 rows; the model then sees the whole day and
    // picks the most curiosity-worthy one.
    const candidateCutoff = new Date(Date.now() - 24 * 3600000).toISOString();
    let candRows = [];
    for (let off = 0; off < 4000; off += 1000) {
      const { data, error } = await supabase
        .from('published_articles')
        .select('id, title_news, category, image_url')
        .gte('created_at', candidateCutoff)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .range(off, off + 999);
      if (error) { console.error('deep-dive candidate query error:', error.message); break; }
      if (!data || !data.length) break;
      candRows = candRows.concat(data);
      if (data.length < 1000) break;
    }
    const candidates = candRows
      .map((a) => ({ id: a.id, title: a.title_news, category: a.category, image_url: a.image_url }))
      .filter((c) => c.title);
    console.log(`deep-dive: ${candidates.length} candidate articles in last 24h`);

    const results = [];
    let made = 0;
    let attempts = 0;
    const usedIdx = new Set();
    while (alreadyCount + made < count && attempts < count + 3 && candidates.length) {
      attempts += 1;
      try {
        // Step 1: choose the most fascinating seed + the broader topic to tell.
        const pick = await pickInterestingTopic(candidates, avoidTopics);
        let seed = candidates[pick.index];
        if (!seed || usedIdx.has(pick.index)) seed = candidates.find((_, i) => !usedIdx.has(i));
        if (!seed) break;
        usedIdx.add(candidates.indexOf(seed));

        // Step 2: research the topic across the web and write the story.
        const dive = await generateInterestingDeepDive({
          avoidTopics, topic: pick.topic || seed.title, seedTitle: seed.title,
        });

        let slug = `${today}-${slugify(dive.topic || dive.headline)}` || `${today}-read`;
        const { data: clash } = await supabase.from('deep_dives').select('id').eq('slug', slug).limit(1);
        if (clash && clash.length) slug = `${slug}-${made + 1}`;

        const { data: row, error: insErr } = await supabase
          .from('deep_dives')
          .insert({
            dive_date: today, slug, status: 'published',
            anchor_article_id: seed.id, vq_secondary: null,
            hero_image: seed.image_url || null,
            headline: dive.headline, dek: dive.dek,
            sections: dive.sections, sources: dive.sources,
            reading_time_min: dive.reading_time_min, model: dive.model,
            published_at: new Date().toISOString(),
          })
          .select('id').single();
        if (insErr) { results.push({ status: 'failed', error: insErr.message }); continue; }

        avoidTopics.unshift(dive.headline);
        made += 1;
        results.push({ id: row.id, slug, headline: dive.headline, topic: dive.topic, seedTitle: seed.title, sources: dive.sources.length, status: 'published' });
      } catch (genErr) {
        results.push({ status: 'failed', error: String(genErr?.message || genErr) });
      }
    }

    return res.status(200).json({ ok: true, date: today, generated: made, results });
  } catch (e) {
    console.error('cron/deep-dive error:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

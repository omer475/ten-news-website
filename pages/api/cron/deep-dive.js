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
import { generateInterestingDeepDive } from '../../../lib/deepDiveGenerator';

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

    // Recent topics/headlines to avoid repeating (last ~40 days).
    const { data: recent } = await supabase
      .from('deep_dives').select('headline, slug')
      .order('dive_date', { ascending: false }).limit(40);
    const avoidTopics = (recent || []).map((d) => d.headline).filter(Boolean);

    const results = [];
    let made = 0;
    let attempts = 0;
    while (alreadyCount + made < count && attempts < count + 2) {
      attempts += 1;
      try {
        const dive = await generateInterestingDeepDive({ avoidTopics });

        // Unique slug (date + topic; suffix if it collides with an earlier pick).
        let slug = `${today}-${slugify(dive.topic || dive.headline)}` || `${today}-read`;
        const { data: clash } = await supabase.from('deep_dives').select('id').eq('slug', slug).limit(1);
        if (clash && clash.length) slug = `${slug}-${made + 1}`;

        const { data: row, error: insErr } = await supabase
          .from('deep_dives')
          .insert({
            dive_date: today, slug, status: 'published',
            anchor_article_id: null, vq_secondary: null, hero_image: null,
            headline: dive.headline, dek: dive.dek,
            sections: dive.sections, sources: dive.sources,
            reading_time_min: dive.reading_time_min, model: dive.model,
            published_at: new Date().toISOString(),
          })
          .select('id').single();
        if (insErr) { results.push({ status: 'failed', error: insErr.message }); continue; }

        avoidTopics.unshift(dive.headline); // don't pick the same thing on the next loop
        made += 1;
        results.push({ id: row.id, slug, headline: dive.headline, topic: dive.topic, sources: dive.sources.length, status: 'published' });
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

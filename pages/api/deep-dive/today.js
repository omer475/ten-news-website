// GET /api/deep-dive/today — today's Quiet Deep Dive(s).
//
// Returns the most recent published deep dives (today's if present, otherwise
// the latest published day so the surface is never empty). The client renders
// these as the "One Story, Deep" section.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SELECT = 'id, slug, dive_date, headline, dek, hero_image, sections, sources, reading_time_min, anchor_article_id, vq_secondary, published_at';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(200).json({ deepDives: [] });
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    // Find the most recent date that has a published deep dive.
    const { data: latest } = await supabase
      .from('deep_dives').select('dive_date')
      .eq('status', 'published')
      .order('dive_date', { ascending: false }).limit(1);
    if (!latest || !latest.length) return res.status(200).json({ deepDives: [] });

    const { data: dives } = await supabase
      .from('deep_dives').select(SELECT)
      .eq('status', 'published').eq('dive_date', latest[0].dive_date)
      .order('published_at', { ascending: false }).limit(2);

    return res.status(200).json({ deepDives: (dives || []).map(shape) });
  } catch (e) {
    console.error('deep-dive/today error:', e?.message || e);
    return res.status(200).json({ deepDives: [] });
  }
}

export function shape(d) {
  return {
    id: d.id,
    slug: d.slug,
    date: d.dive_date,
    headline: d.headline,
    dek: d.dek,
    heroImage: d.hero_image,
    readingTimeMin: d.reading_time_min,
    anchorArticleId: d.anchor_article_id != null ? String(d.anchor_article_id) : null,
    sections: Array.isArray(d.sections) ? d.sections : [],
    sources: Array.isArray(d.sources) ? d.sources : [],
    publishedAt: d.published_at,
  };
}

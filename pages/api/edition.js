// GET /api/edition?date=YYYY-MM-DD
//
// Serves the ONE shared daily Edition (§13 JSON) for a given date. Default = today's
// edition in Europe/London (the edition publishes 07:00 UK). The body is the §13
// payload UNCHANGED — the web terminal renders it verbatim.
//
// Resolution order:
//   1. published `editions` row for the requested date
//   2. most recent published edition on/before that date (covers pre-07:00 today)
//   3. bundled hand-written sample (so the web never gets an empty response)
//
// The edition is fully OPEN (no auth, no paywall).

import { createClient } from '@supabase/supabase-js';
import { buildSampleEdition } from '../../lib/sampleEdition.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Current calendar date in Europe/London (handles BST/GMT automatically).
function ukToday() {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const date = DATE_RE.test(req.query.date || '') ? req.query.date : ukToday();

  // Shared, non-personalized, changes once a day -> safe to CDN-cache briefly.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');

  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1) exact date, published
      const exact = await supabase
        .from('editions')
        .select('edition_date, payload')
        .eq('edition_date', date)
        .eq('status', 'published')
        .maybeSingle();

      if (exact.data?.payload) {
        return res.status(200).json(normalize(exact.data.payload, exact.data.edition_date));
      }

      // 2) most recent published on/before the requested date
      const latest = await supabase
        .from('editions')
        .select('edition_date, payload')
        .eq('status', 'published')
        .lte('edition_date', date)
        .order('edition_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest.data?.payload) {
        return res.status(200).json(normalize(latest.data.payload, latest.data.edition_date));
      }
    }
  } catch (err) {
    // Fall through to the sample rather than 500 — the web must always get a body.
    console.error('[api/edition] db lookup failed, serving sample:', err?.message || err);
  }

  // 3) bundled sample
  return res.status(200).json(buildSampleEdition(date));
}

// Guarantee edition_date is present and matches the row we served from.
function normalize(payload, editionDate) {
  if (payload && typeof payload === 'object' && !payload.edition_date && editionDate) {
    return { ...payload, edition_date: editionDate };
  }
  return payload;
}

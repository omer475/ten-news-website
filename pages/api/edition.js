/**
 * GET /api/edition        -> the current edition
 * GET /api/edition?date=YYYY-MM-DD -> a specific day
 *
 * Supabase first (a new edition goes live without a redeploy), then the JSON
 * the daily job committed under public/editions/.
 */

import fs from 'fs';
import path from 'path';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

async function fromSupabase(date) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const filter = date
    ? `edition_date=eq.${encodeURIComponent(date)}`
    : 'order=edition_date.desc';
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/daily_editions?select=payload&${filter}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0].payload : null;
  } catch {
    return null;
  }
}

function fromDisk(date) {
  const name = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}.json` : 'latest.json';
  const file = path.join(process.cwd(), 'public', 'editions', name);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const date = typeof req.query.date === 'string' ? req.query.date : null;
  const edition = (await fromSupabase(date)) || fromDisk(date);

  if (!edition) {
    res.status(404).json({ error: 'no edition available yet' });
    return;
  }

  // One edition a day: cache at the edge, revalidate in the background.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(200).json(edition);
}

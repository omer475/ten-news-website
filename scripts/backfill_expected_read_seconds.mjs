#!/usr/bin/env node
// Backfill expected_read_seconds on published_articles.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill_expected_read_seconds.js
//
// Idempotent: only touches rows where expected_read_seconds IS NULL.

import { createClient } from '@supabase/supabase-js';
import { extractArticleText, wordCount, expectedReadSeconds } from '../lib/readingTime.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const BATCH_SIZE = 500;

async function run() {
  let processed = 0;
  let totalUpdated = 0;
  let lastId = 0;

  while (true) {
    const { data, error } = await admin
      .from('published_articles')
      .select('id, title_news, summary_bullets_news, details')
      .is('expected_read_seconds', null)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;

    const updates = data.map(row => {
      const text = extractArticleText(row);
      const wc = wordCount(text);
      const secs = expectedReadSeconds(wc);
      return { id: row.id, expected_read_seconds: secs };
    });

    for (const u of updates) {
      const { error: upErr } = await admin
        .from('published_articles')
        .update({ expected_read_seconds: u.expected_read_seconds })
        .eq('id', u.id);
      if (upErr) console.error(`update ${u.id} failed:`, upErr.message);
      else totalUpdated++;
    }

    processed += data.length;
    lastId = data[data.length - 1].id;
    console.log(`  processed=${processed} updated=${totalUpdated} lastId=${lastId}`);
  }

  console.log(`\nDone. updated ${totalUpdated} rows.`);
}

run().catch(err => { console.error(err); process.exit(1); });

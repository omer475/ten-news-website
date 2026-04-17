#!/usr/bin/env node
/**
 * Backfill existing articles with publisher (author_id, author_name).
 * Matches articles to publishers using interest_tags overlap + category bonus.
 *
 * Usage: node scripts/backfill_publishers.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const mainEnv = path.resolve(__dirname, '..', '..', '..', '..', '.env.local');
const localEnv = path.join(__dirname, '..', '.env.local');
require('dotenv').config({ path: fs.existsSync(mainEnv) ? mainEnv : localEnv });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function matchPublisher(articleTags, articleCategory, publishers) {
  if (!articleTags || articleTags.length === 0) return null;

  const tagSet = new Set(articleTags.map(t => t.toLowerCase()));
  let bestPub = null;
  let bestScore = 0;

  for (const pub of publishers) {
    const pubTags = (pub.interest_tags || []).map(t => t.toLowerCase());
    let overlap = 0;
    for (const pt of pubTags) {
      if (tagSet.has(pt)) overlap++;
    }
    let score = overlap;
    if (pub.category && articleCategory &&
        pub.category.toLowerCase() === articleCategory.toLowerCase()) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPub = pub;
    }
  }

  if (bestScore >= 1 && bestPub) {
    return { author_id: bestPub.id, author_name: bestPub.display_name };
  }

  // Fallback: same category
  const catFallback = publishers.find(p =>
    p.category && articleCategory &&
    p.category.toLowerCase() === articleCategory.toLowerCase()
  );
  if (catFallback) {
    return { author_id: catFallback.id, author_name: catFallback.display_name };
  }

  return null;
}

async function backfill() {
  // 1. Load publishers
  const { data: publishers, error: pubErr } = await supabase
    .from('publishers')
    .select('id, display_name, category, interest_tags');

  if (pubErr || !publishers?.length) {
    console.error('No publishers found. Run seed_publishers.js first.');
    process.exit(1);
  }
  console.log(`Loaded ${publishers.length} publishers\n`);

  // 2. Load articles with no author_id, in batches
  let offset = 0;
  const batchSize = 500;
  let totalUpdated = 0;
  let totalSkipped = 0;

  while (true) {
    const { data: articles, error: artErr } = await supabase
      .from('published_articles')
      .select('id, interest_tags, category')
      .is('author_id', null)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (artErr) {
      console.error('Error fetching articles:', artErr.message);
      break;
    }

    if (!articles || articles.length === 0) break;

    console.log(`Processing batch at offset ${offset} (${articles.length} articles)...`);

    // Batch updates by publisher
    const updates = [];
    for (const art of articles) {
      const match = matchPublisher(art.interest_tags, art.category, publishers);
      if (match) {
        updates.push({ id: art.id, ...match });
      } else {
        totalSkipped++;
      }
    }

    // Execute updates in chunks of 50
    for (let i = 0; i < updates.length; i += 50) {
      const chunk = updates.slice(i, i + 50);
      const promises = chunk.map(u =>
        supabase
          .from('published_articles')
          .update({ author_id: u.author_id, author_name: u.author_name })
          .eq('id', u.id)
      );
      await Promise.all(promises);
      totalUpdated += chunk.length;
    }

    console.log(`  Updated ${updates.length}, skipped ${articles.length - updates.length}`);
    offset += batchSize;
  }

  // 3. Update article_count on publishers
  console.log('\nUpdating publisher article counts...');
  const { data: counts } = await supabase.rpc('', {}).catch(() => ({ data: null }));

  // Manual count update since we may not have an RPC
  for (const pub of publishers) {
    const { count } = await supabase
      .from('published_articles')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', pub.id);

    await supabase
      .from('publishers')
      .update({ article_count: count || 0 })
      .eq('id', pub.id);
  }

  console.log(`\nDone! Updated: ${totalUpdated}, Skipped: ${totalSkipped}`);
}

backfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

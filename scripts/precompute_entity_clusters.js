// Precompute entity clusters for each subtopic category
// Run nightly or on-demand: node scripts/precompute_entity_clusters.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaGR5bHNmbmdpeWJ2b2x0b2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk2NDIyNiwiZXhwIjoyMDc4MzI0MjI2fQ.LAoUYK2HdgAFyzqU5tvJlVUnCRKt6Ey_RVmBcduleLs';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function cosineSim(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i]; }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

function kmeans(embeddings, k, maxIter = 30) {
  const n = embeddings.length;
  const dim = embeddings[0].length;
  if (n < k) k = n;

  // K-Means++ init
  const centroids = [[...embeddings[Math.floor(Math.random() * n)]]];
  for (let c = 1; c < k; c++) {
    const dists = embeddings.map(e => {
      let minD = Infinity;
      for (const ce of centroids) minD = Math.min(minD, 1 - cosineSim(e, ce));
      return minD * minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, cum = 0;
    for (let i = 0; i < n; i++) { cum += dists[i]; if (cum >= r) { centroids.push([...embeddings[i]]); break; } }
  }

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const nl = embeddings.map(e => {
      let b = 0, bs = -Infinity;
      for (let c = 0; c < k; c++) { const s = cosineSim(e, centroids[c]); if (s > bs) { bs = s; b = c; } }
      return b;
    });
    if (nl.every((l, i) => l === labels[i])) break;
    labels = nl;
    for (let c = 0; c < k; c++) {
      const members = embeddings.filter((_, i) => labels[i] === c);
      if (!members.length) continue;
      for (let d = 0; d < dim; d++) centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length;
    }
  }
  return { labels, centroids };
}

const CATEGORIES = [
  'Soccer', 'Basketball', 'Football', 'Cricket', 'Gaming',
  'K-Pop & Music', 'AI & Tech', 'Entertainment', 'Finance', 'Business',
  'World Politics', 'Science', 'Health', 'Motorsport', 'Fashion', 'Food',
  'Lifestyle', 'Automotive', 'Baseball', 'Combat Sports', 'Beauty',
  'Travel', 'US Politics', 'Golf', 'Skincare', 'Sports Events', 'Tennis',
];

async function main() {
  console.log('Precomputing entity clusters...\n');

  // Clear old clusters
  await db.from('subtopic_entity_clusters').delete().neq('id', 0);

  for (const category of CATEGORIES) {
    const { data: entities } = await db.from('concept_entities')
      .select('entity_name, avg_article_embedding')
      .eq('category', category)
      .not('avg_article_embedding', 'is', null);

    if (!entities || entities.length < 2) {
      console.log(category + ': skipped (' + (entities?.length || 0) + ' entities)');
      continue;
    }

    const parsed = entities.map(e => ({
      name: e.entity_name,
      embedding: typeof e.avg_article_embedding === 'string'
        ? JSON.parse(e.avg_article_embedding) : e.avg_article_embedding,
    })).filter(e => Array.isArray(e.embedding) && e.embedding.length === 384);

    if (parsed.length < 2) continue;

    const k = Math.min(8, Math.max(2, Math.round(parsed.length / 5)));
    const result = kmeans(parsed.map(e => e.embedding), k);

    let inserted = 0;
    for (let c = 0; c < k; c++) {
      const members = parsed.filter((_, i) => result.labels[i] === c);
      if (members.length === 0) continue;

      await db.from('subtopic_entity_clusters').upsert({
        subtopic_category: category,
        cluster_index: c,
        centroid_embedding: result.centroids[c],
        entity_names: members.map(m => m.name),
        cluster_size: members.length,
      }, { onConflict: 'subtopic_category,cluster_index' });
      inserted++;
    }

    console.log(category + ': ' + parsed.length + ' entities → ' + inserted + ' clusters');
  }

  // Verify
  const { count } = await db.from('subtopic_entity_clusters').select('id', { count: 'exact', head: true });
  console.log('\nTotal clusters stored: ' + count);
}

main().then(() => { console.log('\nDone!'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });

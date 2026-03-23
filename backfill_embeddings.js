/**
 * Backfill embeddings for published_articles using Gemini embedding-001.
 * Generates 3072-dim vectors from article title + summary text.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 5;
const DELAY_MS = 500;

async function getEmbedding(text) {
  const truncated = text.slice(0, 8000);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: truncated }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        }),
      });
      if (resp.status === 429 && attempt < 2) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!resp.ok) {
        console.error(`  API error ${resp.status}: ${(await resp.text()).substring(0, 100)}`);
        return null;
      }
      const data = await resp.json();
      return data?.embedding?.values || null;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      console.error(`  Fetch error: ${err.message}`);
      return null;
    }
  }
  return null;
}

async function main() {
  console.log('Backfilling embeddings for published_articles...\n');

  // Fetch articles without embeddings (last 48h for feed coverage)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: articles, error } = await supabase
    .from('published_articles')
    .select('id, title_news, summary_bullets_news, category, embedding')
    .gte('created_at', since)
    .order('ai_final_score', { ascending: false })
    .limit(250);

  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  const needsEmbedding = articles.filter(a => !a.embedding || !Array.isArray(a.embedding) || a.embedding.length === 0);
  console.log(`Total articles (48h): ${articles.length}`);
  console.log(`Need embeddings: ${needsEmbedding.length}\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
    const batch = needsEmbedding.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(batch.map(async (article) => {
      // Build text from title + bullets
      const title = article.title_news || '';
      let bullets = [];
      try {
        const raw = article.summary_bullets_news;
        bullets = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
      } catch {}
      const text = [title, ...bullets].filter(Boolean).join('. ');

      if (!text || text.length < 10) {
        return { id: article.id, embedding: null };
      }

      const embedding = await getEmbedding(text);
      return { id: article.id, embedding, category: article.category };
    }));

    for (const r of results) {
      if (r.embedding) {
        const { error: updateError } = await supabase
          .from('published_articles')
          .update({ embedding: r.embedding })
          .eq('id', r.id);

        if (updateError) {
          console.error(`  Failed to update ${r.id}: ${updateError.message}`);
          failed++;
        } else {
          success++;
        }
      } else {
        failed++;
      }
    }

    const processed = Math.min(i + BATCH_SIZE, needsEmbedding.length);
    if (processed % 20 === 0 || processed === needsEmbedding.length) {
      console.log(`Progress: ${processed}/${needsEmbedding.length} (${success} ok, ${failed} failed)`);
    }

    if (i + BATCH_SIZE < needsEmbedding.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nDone! ${success} embeddings generated, ${failed} failed.`);

  // Verify
  const { data: verify } = await supabase
    .from('published_articles')
    .select('id, category, embedding')
    .gte('created_at', since)
    .limit(250);

  const withEmb = verify.filter(a => a.embedding && Array.isArray(a.embedding) && a.embedding.length > 0);
  const cats = {};
  withEmb.forEach(a => { cats[a.category || '?'] = (cats[a.category || '?'] || 0) + 1; });
  console.log(`\nVerification: ${withEmb.length}/${verify.length} articles now have embeddings`);
  console.log('By category:', JSON.stringify(cats));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

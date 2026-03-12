/**
 * One-time cleanup: remove bad subtopic names from existing article interest_tags.
 *
 * What it removes:
 *   1. Onboarding subtopic names that enrich_with_subtopics() injected
 *      (e.g., "Soccer/Football", "AI & Machine Learning", "Automotive")
 *   2. Trims to max 8 tags (first 6 Gemini + up to 2 ANN entities)
 *
 * Usage:
 *   source .env.local && node cleanup_interest_tags.js [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) { console.error('Missing SUPABASE env vars'); process.exit(1) }

const supabase = createClient(url, key)
const DRY_RUN = process.argv.includes('--dry-run')

// These are onboarding subtopic names that were wrongly appended to interest_tags
const BAD_SUBTOPIC_NAMES = new Set([
  'war & conflict', 'us politics', 'european politics', 'asian politics',
  'middle east', 'latin america', 'africa & oceania', 'human rights & civil liberties',
  'nfl', 'nba', 'soccer/football', 'mlb/baseball', 'cricket',
  'f1 & motorsport', 'boxing & mma/ufc', 'olympics & paralympics',
  'oil & energy', 'automotive', 'retail & consumer', 'corporate deals',
  'trade & tariffs', 'corporate earnings', 'startups & venture capital', 'real estate',
  'movies & film', 'tv & streaming', 'music', 'gaming', 'celebrity news', 'k-pop & k-drama',
  'ai & machine learning', 'smartphones & gadgets', 'social media', 'cybersecurity',
  'space tech', 'robotics & hardware', 'space & astronomy', 'climate & environment',
  'biology & nature', 'earth science', 'medical breakthroughs', 'public health',
  'mental health', 'pharma & drug industry', 'stock markets', 'banking & lending',
  'commodities', 'bitcoin', 'defi & web3', 'crypto regulation & legal',
  'pets & animals', 'home & garden', 'shopping & product reviews',
  'sneakers & streetwear', 'celebrity style & red carpet',
])

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===')

  let updated = 0
  let skipped = 0
  let offset = 0
  const BATCH = 500

  while (true) {
    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('id, interest_tags')
      .not('interest_tags', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (error) { console.error('Query error:', error.message); break }
    if (!articles || articles.length === 0) break

    for (const article of articles) {
      const tags = Array.isArray(article.interest_tags)
        ? article.interest_tags
        : (typeof article.interest_tags === 'string'
          ? JSON.parse(article.interest_tags || '[]')
          : [])

      // Remove bad subtopic names
      const cleaned = tags.filter(t => !BAD_SUBTOPIC_NAMES.has(t.toLowerCase()))

      // Trim to max 8 (first 6 Gemini-generated + up to 2 concept entities)
      const trimmed = cleaned.slice(0, 8)

      // Check if anything changed
      if (trimmed.length === tags.length && trimmed.every((t, i) => t === tags[i])) {
        skipped++
        continue
      }

      if (DRY_RUN) {
        const removed = tags.filter(t => !trimmed.includes(t))
        console.log(`  [${article.id}] Would remove: ${removed.join(', ')}`)
        console.log(`    Before (${tags.length}): ${tags.join(', ')}`)
        console.log(`    After  (${trimmed.length}): ${trimmed.join(', ')}`)
      } else {
        await supabase
          .from('published_articles')
          .update({ interest_tags: trimmed })
          .eq('id', article.id)
      }
      updated++
    }

    offset += BATCH
    process.stdout.write(`\r  Processed ${offset} articles (${updated} cleaned, ${skipped} ok)`)
  }

  console.log(`\n\nDone. ${updated} articles cleaned, ${skipped} already clean.`)
}

main().catch(console.error)

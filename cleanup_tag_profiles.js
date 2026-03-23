/**
 * One-time cleanup: remove bad subtopic names from existing user tag_profiles.
 * Also removes entries with weight < 0.08 (noise from tail tags).
 *
 * Usage:
 *   source .env.local && node cleanup_tag_profiles.js [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) { console.error('Missing SUPABASE env vars'); process.exit(1) }

const supabase = createClient(url, key)
const DRY_RUN = process.argv.includes('--dry-run')

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

const NOISE_THRESHOLD = 0.08

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, tag_profile')
    .not('tag_profile', 'is', null)

  if (error) { console.error('Query error:', error.message); return }

  let updated = 0
  let skipped = 0

  for (const profile of (profiles || [])) {
    const tp = profile.tag_profile || {}
    const cleaned = {}
    let changed = false

    for (const [tag, weight] of Object.entries(tp)) {
      const t = tag.toLowerCase()
      // Remove bad subtopic names
      if (BAD_SUBTOPIC_NAMES.has(t)) { changed = true; continue }
      // Remove noise entries
      if (weight < NOISE_THRESHOLD) { changed = true; continue }
      cleaned[t] = weight
    }

    if (!changed) { skipped++; continue }

    const removedCount = Object.keys(tp).length - Object.keys(cleaned).length
    if (DRY_RUN) {
      const removed = Object.keys(tp).filter(t => !cleaned[t.toLowerCase()])
      console.log(`  [${profile.id.substring(0, 8)}] Remove ${removedCount} tags: ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? '...' : ''}`)
    } else {
      await supabase
        .from('profiles')
        .update({ tag_profile: cleaned })
        .eq('id', profile.id)
    }
    updated++
  }

  console.log(`\nDone. ${updated} profiles cleaned, ${skipped} already clean.`)
}

main().catch(console.error)

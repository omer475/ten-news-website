import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cache entity seeds in memory (refreshes every 30 min)
let seedCache = null;
let seedCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function loadSeeds(supabase) {
  if (seedCache && Date.now() - seedCacheTime < CACHE_TTL) {
    return seedCache;
  }

  const { data, error } = await supabase
    .from('entity_seeds')
    .select('country_code, subtopic, entity_tag, weight')
    .order('weight', { ascending: false });

  if (error) {
    console.error('Failed to load entity seeds:', error.message);
    return seedCache || {};
  }

  // Group by country_code → subtopic → [{tag, weight}]
  const cache = {};
  for (const row of data) {
    const key = `${row.country_code}:${row.subtopic}`;
    if (!cache[key]) cache[key] = [];
    cache[key].push({ tag: row.entity_tag, weight: row.weight });
  }

  seedCache = cache;
  seedCacheTime = Date.now();
  return cache;
}

/**
 * Seeds a tag_profile for cold-start users based on their country + subtopic selections.
 * This ensures a Turkish soccer fan sees Galatasaray on scroll 1.
 *
 * @param {object} supabase - Supabase client
 * @param {string} country - Country code (e.g. "TR", "US", "IN")
 * @param {string[]} subtopics - Array of subtopic names (e.g. ["Soccer/Football", "AI & Machine Learning"])
 * @returns {object} tag_profile - { tag: weight } object (15-30 tags)
 */
export async function seedTagProfile(supabase, country, subtopics) {
  const seeds = await loadSeeds(supabase);
  const tagProfile = {};

  for (const subtopic of subtopics) {
    // Country-specific entries (higher priority)
    const countryKey = `${country}:${subtopic}`;
    const countrySeeds = seeds[countryKey] || [];

    // Default entries (apply to all countries)
    const defaultKey = `DEFAULT:${subtopic}`;
    const defaultSeeds = seeds[defaultKey] || [];

    // Country-specific tags first
    for (const { tag, weight } of countrySeeds) {
      tagProfile[tag] = Math.max(tagProfile[tag] || 0, weight);
    }

    // Default tags (don't override country-specific if already set)
    for (const { tag, weight } of defaultSeeds) {
      if (!tagProfile[tag]) {
        tagProfile[tag] = weight;
      }
    }
  }

  // Cap total tags at 30 — keep highest weighted
  const entries = Object.entries(tagProfile).sort((a, b) => b[1] - a[1]);
  if (entries.length > 30) {
    const trimmed = {};
    for (const [tag, weight] of entries.slice(0, 30)) {
      trimmed[tag] = weight;
    }
    return trimmed;
  }

  return tagProfile;
}

/**
 * API endpoint: POST /api/feed/seedTagProfile
 * Body: { user_id, country, subtopics }
 * Merges seeded tags into the user's existing tag_profile.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, country, subtopics } = req.body;

  if (!user_id || !country || !subtopics || !Array.isArray(subtopics)) {
    return res.status(400).json({ error: 'Missing user_id, country, or subtopics' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate seeded tag profile
  const seededTags = await seedTagProfile(supabase, country, subtopics);

  // Load existing tag_profile (if any)
  const { data: profile } = await supabase
    .from('profiles')
    .select('tag_profile')
    .eq('id', user_id)
    .single();

  const existingProfile = profile?.tag_profile || {};

  // Merge: keep existing weights if higher, add new seeds
  const merged = { ...existingProfile };
  for (const [tag, weight] of Object.entries(seededTags)) {
    if (!merged[tag] || merged[tag] < weight) {
      merged[tag] = weight;
    }
  }

  // Save to profiles
  const { error } = await supabase
    .from('profiles')
    .update({
      tag_profile: merged,
      followed_topics: subtopics,
    })
    .eq('id', user_id);

  if (error) {
    console.error('Failed to update tag_profile:', error.message);
    return res.status(500).json({ error: 'Failed to seed profile' });
  }

  return res.status(200).json({
    success: true,
    tags_seeded: Object.keys(seededTags).length,
    total_tags: Object.keys(merged).length,
    tag_profile: merged,
  });
}

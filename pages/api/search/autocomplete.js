// GET /api/search/autocomplete?q=<prefix>
//
// Returns up to 8 lightweight suggestions for the as-you-type search bar.
// Fired on every keystroke (debounced 50ms client-side), so the response
// must be tiny + sub-100ms.
//
// Three lanes, fired in parallel, capped at 4/3/3:
//   * publishers — trigram match on display_name + username
//   * entities   — trigram match on entity_name, ordered by popularity_score
//   * articles   — recent (last 7d) ai_final_score-ranked title match
//
// Response:
//   {
//     suggestions: [
//       { type: "publisher" | "entity" | "article",
//         label: string,        // what we render in the chip
//         payload: { ... }      // type-specific (id, slug, etc.)
//       }, ...
//     ]
//   }
//
// Old clients that don't call this endpoint are unaffected — it's additive.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const raw = (req.query.q || '').trim()
  if (raw.length < 1) {
    return res.status(200).json({ suggestions: [] })
  }

  const q = raw.toLowerCase()
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const [publishers, entities, articles] = await Promise.all([
      publisherSuggestions(supabase, q, 4),
      entitySuggestions(supabase, q, 3),
      articleSuggestions(supabase, q, 3),
    ])

    // Interleave so the chip rail mixes types instead of grouping them.
    // First publisher (most valuable for a social platform), then top
    // entity, then top article, then continue.
    const suggestions = interleave([publishers, entities, articles]).slice(0, 8)
    return res.status(200).json({ suggestions })
  } catch (err) {
    console.error('[autocomplete] error:', err)
    return res.status(500).json({ suggestions: [] })
  }
}

async function publisherSuggestions(supabase, q, limit) {
  const { data, error } = await supabase
    .from('publishers')
    .select('id, display_name, username, avatar_url, is_verified, follower_count')
    .or(`display_name.ilike.${q}%,username.ilike.${q}%,display_name.ilike.%${q}%`)
    .order('follower_count', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) return []
  return (data || []).map(p => ({
    type: 'publisher',
    label: p.display_name || p.username,
    payload: {
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      is_verified: p.is_verified,
      follower_count: p.follower_count || 0,
    },
  }))
}

async function entitySuggestions(supabase, q, limit) {
  const { data, error } = await supabase
    .from('concept_entities')
    .select('id, entity_name, display_title, category, popularity_score')
    .or(`entity_name.ilike.${q}%,display_title.ilike.${q}%`)
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) return []
  return (data || []).map(e => ({
    type: 'entity',
    label: e.display_title || e.entity_name,
    payload: {
      id: e.id,
      entity_name: e.entity_name,
      category: e.category,
    },
  }))
}

async function articleSuggestions(supabase, q, limit) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('published_articles')
    .select('id, title_news, ai_final_score, published_at')
    .gte('published_at', since)
    .ilike('title_news', `%${q}%`)
    .order('ai_final_score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) return []
  return (data || []).map(a => ({
    type: 'article',
    label: a.title_news,
    payload: {
      id: a.id,
      published_at: a.published_at,
    },
  }))
}

/**
 * Round-robin merge so the chip rail isn't "all publishers, then all
 * entities, then all articles" — interleaves so the user sees variety
 * in the first ~3 chips.
 */
function interleave(arrays) {
  const out = []
  const longest = Math.max(...arrays.map(a => a.length))
  for (let i = 0; i < longest; i++) {
    for (const arr of arrays) {
      if (i < arr.length) out.push(arr[i])
    }
  }
  return out
}

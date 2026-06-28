// lib/userInterestTags.js — a user's topic-interest tags for personalizing
// module SELECTION (history / notd / countdowns), in the SAME vocabulary as
// published_articles.interest_tags and the module pools' topic_tags.
//
// Source: profiles.followed_topics expanded via ONBOARDING_TOPIC_MAP (the same
// declared-interest signal Trinity uses for its onboarding-interest floor).
// Cold/guest users return an empty set -> the API falls back to global.

import { ONBOARDING_TOPIC_MAP } from './coldStart.js'

export async function getUserInterestTags(supabase, userId) {
  if (!userId) return { tags: new Set(), personalized: false }
  try {
    const { data } = await supabase
      .from('profiles').select('followed_topics').eq('id', userId).maybeSingle()
    const codes = (data && Array.isArray(data.followed_topics)) ? data.followed_topics : []
    const tags = new Set()
    for (const code of codes) {
      const meta = ONBOARDING_TOPIC_MAP[code]
      if (meta && Array.isArray(meta.tags)) {
        for (const t of meta.tags) tags.add(String(t).toLowerCase())
      }
      // the code itself often reads as a tag ("space", "politics")
      tags.add(String(code).toLowerCase().replace(/_/g, ' '))
    }
    return { tags, personalized: tags.size > 0 }
  } catch (e) {
    console.error('[userInterestTags] failed:', e.message)
    return { tags: new Set(), personalized: false }
  }
}

// How well an item's topic_tags match the user's interests. Exact tag = 2 pts,
// soft substring overlap = 1 pt. 0 when no user signal (caller falls back).
export function tagMatchScore(itemTags, userTags) {
  if (!Array.isArray(itemTags) || !userTags || userTags.size === 0) return 0
  let s = 0
  for (const t of itemTags) {
    const tl = String(t).toLowerCase()
    if (userTags.has(tl)) { s += 2; continue }
    for (const u of userTags) {
      if (u.length >= 4 && (tl.includes(u) || u.includes(tl))) { s += 1; break }
    }
  }
  return s
}
